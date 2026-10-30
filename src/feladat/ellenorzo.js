/**
 * Eredményalapú ellenőrzés.
 *
 * Nem azt nézzük, milyen parancsokat írt be a tanuló, hanem hogy a hálózat ÁLLAPOTA jó-e,
 * és ténylegesen MŰKÖDIK-e:
 *   - állapot-célok: létezik-e a VLAN a jó névvel, jó VLAN-ban van-e a port, működik-e a trunk,
 *     jó-e a PC IP-címe;
 *   - próbák: valódi ping és szórásos (broadcast) próba a szimulált hálózaton – a csomagok
 *     közben látszanak a topológián;
 *   - ELLENPRÓBÁK: aminek NEM szabad működnie (pl. két különböző VLAN-ban lévő gép
 *     ne érje el egymást). Enélkül egy „minden mindenkivel összeköt” hálózat is átmenne.
 *
 * A célok a feladatfájlban vannak, gyártófüggetlenül (ugyanaz a feladat később más gyártó
 * parancssorával is megoldható).
 */

import { uzemmod } from '../mag/kapcsolas.js';
import { egyPing, szorasProba } from '../mag/vegpont.js';
import { portKeres } from '../modell/switch.js';
import { esRag, nevelo } from '../magyar.js';

/** „a 10-es” / „az 5-ös” */
const aVlan = (n) => `${nevelo(n)} ${esRag(n)}`;
const AVlan = (n) => { const t = aVlan(n); return t[0].toUpperCase() + t.slice(1); };

/**
 * @typedef {Object} Eredmeny
 * @property {boolean} ok
 * @property {string} megjegyzes – rövid magyarázat (mi a helyzet most)
 */

const MOD_SZOVEG = { access: 'access', trunk: 'trunk', 'dinamikus-auto': 'dynamic auto', 'dinamikus-kezdemenyezo': 'dynamic desirable' };

function rovid(nev) {
  return nev.replace(/^FastEthernet/, 'Fa').replace(/^GigabitEthernet/, 'Gi');
}

/** A próba nélküli (azonnal eldönthető) célok. */
const ALLAPOT_CELOK = {
  vlan(f, c) {
    const sw = f.eszkoz(c.eszkoz);
    const v = sw.vlanok[c.vlan];
    if (!v) return { ok: false, megjegyzes: `${AVlan(c.vlan)} VLAN nincs létrehozva (${c.eszkoz}).` };
    if (c.nev && v.nev !== c.nev) return { ok: false, megjegyzes: `A VLAN neve most: ${v.nev} (${c.nev} kellene).` };
    return { ok: true, megjegyzes: `Megvan: ${c.vlan} ${v.nev}` };
  },

  'access-port'(f, c) {
    const sw = f.eszkoz(c.eszkoz);
    const p = portKeres(sw, c.port);
    const hibak = [];
    if (p.mod !== 'access') hibak.push(`a port üzemmódja most ${MOD_SZOVEG[p.mod]} (access kellene)`);
    if (p.accessVlan !== c.vlan) hibak.push(`a port most ${aVlan(p.accessVlan)} VLAN-ban van`);
    else if (!sw.vlanok[c.vlan]) hibak.push(`${aVlan(c.vlan)} VLAN nem létezik ezen a switchen`);
    if (p.leallitva) hibak.push('a port le van kapcsolva (shutdown)');
    if (hibak.length) return { ok: false, megjegyzes: hibak.join('; ') + '.' };
    return { ok: true, megjegyzes: `access, VLAN ${c.vlan}` };
  },

  trunk(f, c) {
    const sw = f.eszkoz(c.eszkoz);
    const p = portKeres(sw, c.port);
    if (!p.fent) return { ok: false, megjegyzes: `Nincs link a(z) ${rovid(p.nev)} porton (le van kapcsolva?).` };
    const tul = sw.halozat.szomszed(sw, p);
    const vegek = [[sw, p], [tul.eszkoz, tul.port]];
    const rossz = vegek.filter(([e, pp]) => uzemmod(e, pp) !== 'trunk');
    if (rossz.length) {
      const leiras = rossz.map(([e, pp]) => `${e.hostname} ${rovid(pp.nev)}: ${MOD_SZOVEG[pp.mod]}`).join(', ');
      return { ok: false, megjegyzes: `Nem lett trunk (${leiras}). Két „dynamic auto” port nem kezdeményez trunkot.` };
    }
    const modok = vegek.map(([e, pp]) => `${e.hostname}: ${MOD_SZOVEG[pp.mod]}`).join(', ');
    return { ok: true, megjegyzes: `Mindkét vég trunkként működik (${modok}).` };
  },

  'vlan-nincs'(f, c) {
    const sw = f.eszkoz(c.eszkoz);
    const v = sw.vlanok[c.vlan];
    if (v) return { ok: false, megjegyzes: `${AVlan(c.vlan)} VLAN (${v.nev}) megvan ezen: ${c.eszkoz}, pedig itt nem szabadna lennie.` };
    return { ok: true, megjegyzes: `${AVlan(c.vlan)} VLAN nincs ezen: ${c.eszkoz} – ahogy kell.` };
  },

  vtp(f, c) {
    const sw = f.eszkoz(c.eszkoz);
    const hibak = [];
    if (c.mod && sw.vtpMod !== c.mod) hibak.push(`a szerep most ${sw.vtpMod} (${c.mod} kellene)`);
    if (c.tartomany !== undefined && sw.vtpTartomany !== c.tartomany) {
      hibak.push(`a tartomány most ${sw.vtpTartomany ? `„${sw.vtpTartomany}”` : 'nincs megadva'} („${c.tartomany}” kellene; kis- és nagybetű számít)`);
    }
    if (c.jelszo !== undefined && sw.vtpJelszo !== c.jelszo) hibak.push(sw.vtpJelszo ? 'a jelszó nem egyezik' : 'nincs jelszó');
    if (c.verzio && sw.vtpVerzio !== c.verzio) hibak.push(`a verzió most ${sw.vtpVerzio} (${c.verzio} kellene)`);
    if (c.revizio !== undefined && sw.vtpRevizio !== c.revizio) hibak.push(`a revízió most ${sw.vtpRevizio} (${c.revizio} kellene)`);
    if (hibak.length) return { ok: false, megjegyzes: hibak.join('; ') + '.' };
    return { ok: true, megjegyzes: `${sw.vtpMod}, tartomány: ${sw.vtpTartomany}, verzió: ${sw.vtpVerzio}, revízió: ${sw.vtpMod === 'transparent' ? 0 : sw.vtpRevizio}` };
  },

  'vtp-szinkron'(f, c) {
    const sw = f.eszkoz(c.eszkoz);
    const forras = f.eszkoz(c.forras);
    const lista = (e) => Object.entries(e.vlanok).filter(([, v]) => !v.gyari).map(([n, v]) => `${n} ${v.nev}`).sort().join(', ');
    const sajat = lista(sw);
    const ott = lista(forras);
    if (sw.vtpRevizio === forras.vtpRevizio && sajat === ott) {
      return { ok: true, megjegyzes: `Azonos revízió (${sw.vtpRevizio}) és azonos VLAN-ok: ${sajat || '–'}.` };
    }
    let megj = `${c.eszkoz}: revízió ${sw.vtpRevizio}, VLAN-ok: ${sajat || '–'}. ${c.forras}: revízió ${forras.vtpRevizio}, VLAN-ok: ${ott || '–'}.`;
    if (sw.vtpRevizio > forras.vtpRevizio) megj += ` ${c.eszkoz} revíziója nagyobb – ő írná felül a többieket!`;
    else if (sw.vtpRevizio === forras.vtpRevizio) megj += ' Egyenlő revíziónál nincs átvétel: módosíts valamit a serveren (pl. hozz létre és törölj egy VLAN-t).';
    else megj += ' A hirdetés nem ért ide: nézd meg a trunkokat, a tartománynevet, a jelszót és a köztes switch verzióját.';
    return { ok: false, megjegyzes: megj };
  },

  'pc-ip'(f, c) {
    const pc = f.eszkoz(c.eszkoz);
    if (!pc.ip) return { ok: false, megjegyzes: `${c.eszkoz}-nek még nincs IP-címe (kattints a gépre).` };
    const hibak = [];
    if (pc.ip !== c.ip) hibak.push(`IP-cím most: ${pc.ip} (${c.ip} kellene)`);
    if (pc.maszk !== c.maszk) hibak.push(`maszk most: ${pc.maszk || 'nincs'} (${c.maszk} kellene)`);
    if (hibak.length) return { ok: false, megjegyzes: hibak.join('; ') + '.' };
    return { ok: true, megjegyzes: `${pc.ip} / ${pc.maszk}` };
  },
};

/** A cél PC tervezett IP-címe (a feladat címtervéből). */
function tervezettIp(f, nev) {
  const sor = (f.feladat.cimterv || []).find((s) => s.eszkoz === nev);
  return sor ? sor.ip : f.eszkoz(nev).ip;
}

const PING_SZOVEG = {
  valasz: 'Megjött a válasz.',
  idotullepes: 'Nem jött válasz (Request timed out).',
  elerhetetlen: 'Nem jött ARP-válasz: a cél nem érhető el ebben a szórási tartományban (Destination host unreachable).',
  hiba: 'A ping el sem indult: nincs IP-cím, vagy a cél másik hálózatban van, és nincs alapértelmezett átjáró.',
};

/** A próbát igénylő célok: (f, c, kesz(eredmeny)) */
const PROBA_CELOK = {
  ping(f, c, kesz) {
    const ip = tervezettIp(f, c.cel);
    egyPing(f.halozat, f.eszkoz(c.honnan), ip, (e) => {
      const ment = e.fajta === 'valasz';
      const vart = c.vart !== false;
      let megjegyzes = `${c.honnan} → ${ip}: ${PING_SZOVEG[e.fajta]}`;
      if (!vart && ment) megjegyzes += ' Pedig ennek nem szabadna sikerülnie!';
      kesz({ ok: ment === vart, megjegyzes });
    });
  },

  szoras(f, c, kesz) {
    szorasProba(f.halozat, f.eszkoz(c.honnan), (kik) => {
      const nevek = c.elerje.concat(c.neErje);
      const elerte = nevek.filter((n) => kik.includes(f.eszkoz(n)));
      const hianyzik = (c.elerje || []).filter((n) => !elerte.includes(n));
      const tilos = (c.neErje || []).filter((n) => elerte.includes(n));
      const reszek = [`Eljutott ide: ${elerte.length ? elerte.join(', ') : 'senkihez'}.`];
      if (hianyzik.length) reszek.push(`Nem jutott el ide, pedig kellene: ${hianyzik.join(', ')}.`);
      if (tilos.length) reszek.push(`Ide nem szabadna eljutnia (más VLAN): ${tilos.join(', ')}.`);
      kesz({ ok: hianyzik.length === 0 && tilos.length === 0, megjegyzes: reszek.join(' ') });
    });
  },
};

/**
 * Egy állapot-cél azonnali kiértékelése (a bemutató is ezt használja a lépések teljesülésének
 * eldöntésére). Ismeretlen típusnál null.
 * @returns {Eredmeny|null}
 */
export function allapotCel(f, c) {
  const fn = ALLAPOT_CELOK[c.tipus];
  return fn ? fn(f, c) : null;
}

/** Próbát igényel-e a cél (ezek animálva, egymás után futnak). */
export function probaE(cel) {
  return !!PROBA_CELOK[cel.tipus];
}

/**
 * Az összes cél ellenőrzése. Az állapot-célok azonnal, a próbák egymás után, a szimulált
 * órán futnak (a böngészőben valós időben, animálva; a tesztekben az óra léptetésével).
 * @param {import('./betolto.js').BetoltottFeladat} f
 * @param {{indul?: (i: number) => void, lepes?: (i: number, e: Eredmeny) => void,
 *          kesz?: (eredmenyek: Eredmeny[]) => void, szunet?: number}} [figyelok]
 * @returns {Eredmeny[]} – a (később kitöltődő) eredménylista
 */
export function ellenoriz(f, { indul = () => {}, lepes = () => {}, kesz = () => {}, szunet = 0 } = {}) {
  const celok = f.feladat.celok;
  const eredmenyek = new Array(celok.length).fill(null);
  const probak = [];
  celok.forEach((c, i) => {
    if (ALLAPOT_CELOK[c.tipus]) {
      eredmenyek[i] = ALLAPOT_CELOK[c.tipus](f, c);
      lepes(i, eredmenyek[i]);
    } else if (PROBA_CELOK[c.tipus]) {
      probak.push(i);
    } else {
      throw new Error(`Ismeretlen céltípus: ${c.tipus}`);
    }
  });

  const kovetkezo = (k) => {
    if (k >= probak.length) return kesz(eredmenyek);
    const i = probak[k];
    indul(i);
    PROBA_CELOK[celok[i].tipus](f, celok[i], (e) => {
      eredmenyek[i] = e;
      lepes(i, e);
      // Egy kis szünet a próbák között, hogy a csomagok ne keveredjenek a rajzon.
      f.halozat.ora.utemez(szunet, () => kovetkezo(k + 1));
    });
  };
  kovetkezo(0);
  return eredmenyek;
}
