/**
 * VTP (VLAN Trunking Protocol, 1-es és 2-es verzió) – egyszerűsítve, de a lényeges valódi
 * viselkedéssel:
 *
 *   - A hirdetések CSAK trunkon mennek, és csak akkor, ha a switchnek van tartományneve.
 *   - server: létrehozhat / törölhet / átnevezhet VLAN-t; minden változás +1 revízió, és hirdeti.
 *   - client: nem módosíthat VLAN-t, de a nagyobb revíziójú hirdetést átveszi és továbbadja.
 *     Ha neki magának nagyobb a revíziója, ő írja felül a többieket (a híres „revíziócsapda”).
 *   - transparent: nem veszi át és nem hirdeti a saját VLAN-jait (helyi VLAN-ok), a revíziója 0.
 *     A mások hirdetését továbbengedi: 1-es verzióban csak azonos tartománynévnél, 2-esben mindig.
 *   - Tartomány és jelszó: csak azonos tartományú és azonos jelszavú hirdetést fogad el.
 *     Név nélküli (NULL) switch az első hallott hirdetésből átveszi a tartománynevet.
 *   - Revízió nullázása: transparent módba váltás vagy a tartománynév megváltoztatása.
 *   - A verzió (2) a serverről terjed a hirdetéssel; a kliensen nem állítható.
 *
 * A gyorsabb összehangolás kedvéért (a valódi eszköz is így tesz, csak nem mindig ennyire
 * azonnal): beállításváltozáskor és trunk feljöttekor a switch „kérést” küld, amire a
 * szomszéd a saját hirdetésével válaszol; a kisebb revíziójú hirdetésre a switch a nagyobbal felel.
 * Ezen felül 5 percenként mindenki hirdet.
 */

import { uzemmod } from './kapcsolas.js';
import { alapVlanNev } from '../modell/switch.js';

/** A rendszeres hirdetések közötti idő (ms) – az IOS alapértéke 300 s. */
export const VTP_IDOKOZ = 300000;

/** A VTP-keretek cél-MAC-címe (a Cisco saját protokolljainak csoportcíme). */
const VTP_MAC = '01000ccccccc';

/** Egyszerű, determinisztikus kivonat (a jelszó és az adatbázis „ujjlenyomata”). */
function kivonat(szoveg) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < szoveg.length; i++) {
    const c = szoveg.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
  }
  return [h1, h2, Math.imul(h1 ^ h2, 0x85ebca6b) >>> 0, Math.imul(h2 + 0x9e3779b9, 0xc2b2ae35) >>> 0];
}

/** A jelszó kivonata (a hirdetésben ez utazik, nem maga a jelszó). */
function jelszoKivonat(jelszo) {
  return kivonat('jelszo:' + jelszo).join('-');
}

/** A nem gyári VLAN-ok (ezeket hirdeti a VTP). */
export function vtpVlanok(sw) {
  const v = {};
  for (const [szam, adat] of Object.entries(sw.vlanok)) if (!adat.gyari) v[szam] = adat.nev;
  return v;
}

/**
 * Az MD5-kivonat 16 bájtja (a show vtp status utolsó sorai). A valódi eszköz a tartománynévből,
 * a jelszóból és az adatbázisból számolja; mi is ezekből, csak egyszerűbb képlettel.
 * @returns {number[]}
 */
export function vtpMd5(sw) {
  const szoveg = JSON.stringify([sw.vtpTartomany, sw.vtpJelszo, sw.vtpRevizio, vtpVlanok(sw)]);
  const bajtok = [];
  for (const sz of kivonat(szoveg)) for (let i = 0; i < 4; i++) bajtok.push((sz >>> (24 - 8 * i)) & 255);
  return bajtok;
}

/** A switch működő trunk portjai. */
function trunkPortok(sw) {
  return sw.portok.filter((p) => p.fent && uzemmod(sw, p) === 'trunk');
}

/** Hirdet-e egyáltalán ez a switch (van tartománynév, és nem transparent). */
function hirdethet(sw) {
  return !!sw.halozat && !!sw.vtpTartomany && sw.vtpMod !== 'transparent';
}

function keret(sw, keres) {
  return {
    forrasMac: sw.mac,
    celMac: VTP_MAC,
    tipus: 'vtp',
    adat: {
      kuldo: sw.hostname,
      tartomany: sw.vtpTartomany,
      revizio: sw.vtpRevizio,
      verzio: sw.vtpVerzio,
      jelszoKivonat: jelszoKivonat(sw.vtpJelszo),
      vlanok: vtpVlanok(sw),
      keres,
    },
  };
}

/**
 * Hirdetés küldése a trunk portokon.
 * @param {Object} sw
 * @param {{keres?: boolean, kiveve?: Object, csak?: Object}} [p] – keres: kérés is (a szomszéd
 *        válaszoljon); kiveve: ezen a porton ne; csak: csak ezen a porton
 */
export function vtpHirdet(sw, { keres = false, kiveve = null, csak = null } = {}) {
  if (!hirdethet(sw)) return;
  const portok = csak ? [csak] : trunkPortok(sw).filter((p) => p !== kiveve);
  for (const p of portok) sw.halozat.kuld(sw, p, keret(sw, keres));
}

/** A VLAN-adatbázis megváltozott a switchen (VLAN létrehozása, törlése, átnevezése). */
export function vtpVlanValtozas(sw) {
  if (sw.vtpMod === 'transparent') return;
  sw.vtpRevizio++;
  sw.vtpModositva = sw.halozat ? sw.halozat.ora.ido : 0;
  vtpHirdet(sw);
  if (sw.halozat) sw.halozat.esemeny({ tipus: 'allapot' });
}

/** A VTP-beállítás (mód, tartomány, jelszó) megváltozott: kérjük a szomszédok adatbázisát. */
export function vtpBeallitasValtozas(sw) {
  vtpHirdet(sw, { keres: true });
}

/** Egy trunk feljött vagy átállt: mindkét vég kérést küld. */
export function vtpTrunkValtozas(sw, port) {
  if (!sw.halozat) return;
  const tul = sw.halozat.szomszed(sw, port);
  for (const [e, p] of [[sw, port], tul ? [tul.eszkoz, tul.port] : [null, null]]) {
    if (e && e.tipus === 'switch' && p.fent && uzemmod(e, p) === 'trunk') vtpHirdet(e, { keres: true, csak: p });
  }
}

/** Egy hirdetés adatainak átvétele (nagyobb revízió esetén). */
function atvesz(sw, a) {
  for (const szam of Object.keys(sw.vlanok)) {
    if (!sw.vlanok[szam].gyari && !(szam in a.vlanok)) delete sw.vlanok[szam];
  }
  for (const [szam, nev] of Object.entries(a.vlanok)) {
    const v = sw.vlanok[szam];
    if (v && v.gyari) continue;
    sw.vlanok[szam] = { nev: nev || alapVlanNev(szam), gyari: false, tamogatott: true };
  }
  sw.vtpRevizio = a.revizio;
  if (a.verzio === 2) sw.vtpVerzio = 2;
  sw.vtpModositva = sw.halozat.ora.ido;
}

/**
 * VTP-keret érkezett egy switch portjára.
 * @param {import('./halozat.js').Halozat} h
 */
export function vtpFogad(h, sw, port, k) {
  if (uzemmod(sw, port) !== 'trunk') return;
  const a = k.adat;

  if (sw.vtpMod === 'transparent') {
    // Továbbengedi (de nem veszi át): 2-es verzióban mindig, 1-esben csak a saját tartományát.
    if (sw.vtpVerzio === 2 || a.tartomany === sw.vtpTartomany) {
      for (const p of trunkPortok(sw)) if (p !== port) h.kuld(sw, p, k);
    }
    return;
  }

  if (!sw.vtpTartomany && a.tartomany) {
    // NULL tartományú switch: átveszi az első hallott tartománynevet.
    sw.vtpTartomany = a.tartomany;
  }
  if (a.tartomany !== sw.vtpTartomany) return;
  if (a.jelszoKivonat !== jelszoKivonat(sw.vtpJelszo)) {
    sw.vtpMd5Hiba = port.rovid;
    return h.eldob(sw, port, k, `A VTP-hirdetés jelszava nem egyezik (${sw.hostname}), ezért nem fogadta el.`);
  }
  sw.vtpMd5Hiba = null;

  if (a.revizio > sw.vtpRevizio) {
    atvesz(sw, a);
    h.esemeny({ tipus: 'allapot' });
    vtpHirdet(sw, { kiveve: port });
  } else if (a.revizio < sw.vtpRevizio || a.keres) {
    // Nálunk újabb az adatbázis (vagy kértek tőlünk): válaszolunk a sajátunkkal.
    vtpHirdet(sw, { csak: port });
  }
}

/** A rendszeres (5 percenkénti) hirdetések elindítása a hálózat összes switchén. */
export function vtpIdozitoIndit(h) {
  const kor = () => {
    for (const e of h.eszkozok) if (e.tipus === 'switch') vtpHirdet(e);
    h.ora.utemez(VTP_IDOKOZ, kor);
  };
  h.ora.utemez(VTP_IDOKOZ, kor);
}
