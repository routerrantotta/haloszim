/**
 * A MikroTik-féle bridge működése (2. réteg), a RouterOS „bridge VLAN filtering” szabályai szerint:
 *
 *   - VLAN-szűrés NÉLKÜL (vlan-filtering=no) a bridge „átlátszó”: minden keretet változatlanul
 *     továbbít (a címkéset is), a PVID és a VLAN-tábla nem számít.
 *   - VLAN-szűréssel:
 *       BEMENET: a kerettípus-szűrő (frame-types) eldobhatja a címkés vagy a címke nélküli keretet;
 *                a keret VLAN-ja a címkéje, címke nélkül a port PVID-je; ha be van kapcsolva a
 *                bemeneti szűrés (ingress-filtering), és a port nem tagja ennek a VLAN-nak, eldobja.
 *       KIMENET:  csak a VLAN tagjai kapják meg – a címkézett (tagged) tagok címkével, a
 *                címkézetlen (untagged) tagok címke nélkül.
 *       TAGSÁG:   a VLAN-tábla sorai, ÉS (RouterOS 7) minden port – a bridge is – dinamikusan
 *                címkézetlen tagja a PVID-je szerinti VLAN-nak (kivéve, ha csak címkés keretet fogad).
 *   - A bridge maga is egy „port” (a switch processzora felé): ha egy VLAN-ban tag, a switch a saját
 *     IP-címein ebben a VLAN-ban elérhető. Címke nélkül a bridge interfészére érkezik a keret, címkével
 *     az ugyanilyen VLAN-azonosítójú VLAN-interfészre (/interface vlan … interface=bridge).
 *   - MAC-tanulás VLAN-onként (a host táblában), továbbítás: ismert cél → egy port, egyébként elárasztás.
 *
 * A switch saját IP-címeit „virtuális végpontok” kezelik (ugyanaz a kód, mint a PC-ké: mag/vegpont.js):
 * így a switch válaszol az ARP-ra és a pingre, és maga is tud pingelni.
 */

import { SZORAS } from './ethernet.js';
import { vegpontFogad } from './vegpont.js';
import { ipSzam, maszkSzoveg, halozatSzam } from './ip.js';
import { hidKeres, sorVlanjai } from '../modell/mikrotik.js';

/** A MAC-bejegyzések élettartama (a RouterOS alapértéke: ageing-time=5m). */
export const HID_MAC_ELETKOR = 300000;

/** A porthoz tartozó (nem letiltott) bridge-port bejegyzés, vagy null. */
export function hidPortja(sw, interfesz) {
  return sw.hidPortok.find((hp) => hp.interfesz === interfesz && !hp.letiltva) || null;
}

/** Az interfész működik-e (a bridge-tagság szempontjából): fizikai portnál van link, a bridge mindig. */
function aktivTag(sw, hid, nev) {
  if (nev === hid.nev) return !hid.letiltva;
  const p = sw.portok.find((x) => x.nev === nev);
  return !!(p && p.fent && hidPortja(sw, nev) && hidPortja(sw, nev).hid === hid.nev);
}

/**
 * Egy VLAN tagjai a bridge-en: a VLAN-tábla sorai és a PVID szerinti dinamikus tagság.
 * @param {Object} sw
 * @param {Object} hid
 * @param {number} vlan
 * @param {{csakAktiv?: boolean}} [b] – csakAktiv: csak a működő (linkkel rendelkező) portok
 * @returns {{cimkezett: string[], cimkezetlen: string[]}}
 */
export function tagsag(sw, hid, vlan, { csakAktiv = false } = {}) {
  const cimkezett = [];
  const cimkezetlen = [];
  const hozza = (lista, nev) => {
    if (!lista.includes(nev) && (!csakAktiv || aktivTag(sw, hid, nev))) lista.push(nev);
  };
  for (const s of sw.hidVlanok) {
    if (s.letiltva || s.hid !== hid.nev || !sorVlanjai(s).includes(vlan)) continue;
    for (const n of s.cimkezett) hozza(cimkezett, n);
    for (const n of s.cimkezetlen) if (!cimkezett.includes(n)) hozza(cimkezetlen, n);
  }
  for (const d of dinamikusTagok(sw, hid, vlan)) if (!cimkezett.includes(d)) hozza(cimkezetlen, d);
  return { cimkezett, cimkezetlen };
}

/** A PVID alapján dinamikusan (címkézetlenül) tagok – a bridge is, a portok is. */
export function dinamikusTagok(sw, hid, vlan) {
  const ki = [];
  if (hid.pvid === vlan && hid.kerettipus !== 'admit-only-vlan-tagged') ki.push(hid.nev);
  for (const hp of sw.hidPortok) {
    if (hp.hid !== hid.nev || hp.letiltva) continue;
    if (hp.pvid === vlan && hp.kerettipus !== 'admit-only-vlan-tagged') ki.push(hp.interfesz);
  }
  return ki;
}

/** Az összes VLAN, amelyről a bridge tud (a táblából és a PVID-ekből). */
export function ismertVlanok(sw, hid) {
  const v = new Set();
  for (const s of sw.hidVlanok) if (s.hid === hid.nev && !s.letiltva) for (const n of sorVlanjai(s)) v.add(n);
  v.add(hid.pvid);
  for (const hp of sw.hidPortok) if (hp.hid === hid.nev && !hp.letiltva) v.add(hp.pvid);
  return [...v].sort((a, b) => a - b);
}

/** A bemeneti (ingress) beállítások: a bridge-é, ha a keret a switch processzorától jön, egyébként a portéé. */
function bemenetBeall(sw, hid, bemenet) {
  return bemenet === hid.nev ? hid : hidPortja(sw, bemenet);
}

/**
 * Bemenet: elfogadja-e a bridge a keretet, és melyik VLAN-ba teszi.
 * @returns {{ok: true, vlan: number|null}|{ok: false, miert: string}} – vlan null: VLAN-szűrés nélkül
 */
export function hidBe(sw, hid, bemenet, cimke) {
  if (!hid.vlanSzures) return { ok: true, vlan: null };
  const b = bemenetBeall(sw, hid, bemenet);
  if (cimke === undefined && b.kerettipus === 'admit-only-vlan-tagged') {
    return { ok: false, miert: `${bemenet}: csak címkés keretet fogad (frame-types=admit-only-vlan-tagged), ez pedig címke nélküli.` };
  }
  if (cimke !== undefined && b.kerettipus === 'admit-only-untagged-and-priority-tagged') {
    return { ok: false, miert: `${bemenet}: csak címke nélküli keretet fogad (frame-types=admit-only-untagged-and-priority-tagged), ez pedig ${cimke}-es címkével jött.` };
  }
  const vlan = cimke !== undefined ? cimke : b.pvid;
  if (b.bemenetiSzures) {
    const t = tagsag(sw, hid, vlan);
    if (!t.cimkezett.includes(bemenet) && !t.cimkezetlen.includes(bemenet)) {
      return { ok: false, miert: `${bemenet} nem tagja a ${vlan}-es VLAN-nak (bemeneti szűrés), ezért ${sw.hostname} eldobta a keretet.` };
    }
  }
  return { ok: true, vlan };
}

/**
 * Kimenet: kap-e a VLAN-ból keretet a port (vagy a bridge maga), és milyen címkével.
 * @returns {{ok: boolean, cimke?: number}}
 */
export function hidKi(sw, hid, vlan, kimenet, eredetiCimke) {
  if (vlan === null) return { ok: true, cimke: eredetiCimke };
  const t = tagsag(sw, hid, vlan);
  if (t.cimkezett.includes(kimenet)) return { ok: true, cimke: vlan };
  if (t.cimkezetlen.includes(kimenet)) return { ok: true, cimke: undefined };
  return { ok: false };
}

/** Port üzemmódja (a rajz és az ellenőrzés kedvéért): címkézett tag valamelyik VLAN-ban → „trunk”. */
export function hidUzemmod(sw, port) {
  const hp = hidPortja(sw, port.nev);
  if (!hp) return 'access';
  const hid = hidKeres(sw, hp.hid);
  if (!hid || !hid.vlanSzures) return 'access';
  const trunk = sw.hidVlanok.some((s) => !s.letiltva && s.hid === hid.nev && s.cimkezett.includes(port.nev));
  return trunk ? 'trunk' : 'access';
}

// ---------------------------------------------------------------------------
// MAC-tábla (host)
// ---------------------------------------------------------------------------

/** Az élő MAC-bejegyzések (a régieket közben törli). */
export function hidMacTabla(sw) {
  const ido = sw.halozat ? sw.halozat.ora.ido : 0;
  sw.macTabla = (sw.macTabla || []).filter((b) => ido - b.ido < HID_MAC_ELETKOR);
  return sw.macTabla;
}

function macTanul(sw, hid, vlan, mac, port, ido) {
  const t = hidMacTabla(sw);
  const v = vlan === null ? 0 : vlan;
  const b = t.find((x) => x.hid === hid.nev && x.vlan === v && x.mac === mac);
  if (b) {
    b.port = port;
    b.ido = ido;
  } else {
    t.push({ hid: hid.nev, vlan: v, mac, port, ido });
  }
}

// ---------------------------------------------------------------------------
// Továbbítás
// ---------------------------------------------------------------------------

/**
 * Egy keret megérkezett a switch egyik fizikai portjára.
 * @param {import('./halozat.js').Halozat} h
 */
export function hidFogad(h, sw, port, keret) {
  if (keret.tipus === 'vtp') return; // a MikroTik nem ismeri a VTP-t: eldobja
  const hp = hidPortja(sw, port.nev);
  if (!hp) return h.eldob(sw, port, keret, `${port.nev} nincs egyetlen bridge-ben sem, ezért ${sw.hostname} nem továbbítja a keretet.`);
  const hid = hidKeres(sw, hp.hid);
  if (!hid || hid.letiltva) return h.eldob(sw, port, keret, `A(z) ${hp.hid} bridge le van tiltva.`);
  const be = hidBe(sw, hid, port.nev, keret.vlan);
  if (!be.ok) return h.eldob(sw, port, keret, be.miert);
  tovabbit(h, sw, hid, port.nev, be.vlan, keret);
}

/** A keret továbbítása a bridge-en belül (a forrás egy port vagy a bridge maga). */
function tovabbit(h, sw, hid, forras, vlan, keret) {
  if (forras !== hid.nev && keret.forrasMac !== SZORAS) macTanul(sw, hid, vlan, keret.forrasMac, forras, h.ora.ido);
  const v = vlan === null ? 0 : vlan;
  let celok;
  if (keret.celMac === hid.mac) {
    celok = [hid.nev];
  } else {
    const ismert = keret.celMac !== SZORAS && hidMacTabla(sw).find((b) => b.hid === hid.nev && b.vlan === v && b.mac === keret.celMac);
    if (ismert) {
      if (ismert.port === forras) return;
      celok = [ismert.port];
    } else {
      celok = [hid.nev, ...sw.hidPortok.filter((hp) => hp.hid === hid.nev && !hp.letiltva).map((hp) => hp.interfesz)]
        .filter((n) => n !== forras);
    }
  }
  for (const cel of celok) {
    const ki = hidKi(sw, hid, vlan, cel, keret.vlan);
    if (!ki.ok) continue;
    if (cel === hid.nev) {
      cpuFogad(h, sw, hid, ki.cimke, keret);
      continue;
    }
    const p = sw.portok.find((x) => x.nev === cel);
    if (!p || !p.fent) continue;
    h.kuld(sw, p, { ...keret, vlan: ki.cimke });
  }
}

// ---------------------------------------------------------------------------
// A switch saját IP-címei (virtuális végpontok)
// ---------------------------------------------------------------------------

/** @type {WeakMap<Object, Map<string, Object>>} */
const vegpontTar = new WeakMap();

/**
 * Az L3-interfész (bridge vagy VLAN-interfész) melyik bridge-hez és milyen címkével kapcsolódik.
 * @returns {{hid: Object, cimke: number|undefined}|null}
 */
export function l3Kapcsolat(sw, ifNev) {
  const hid = hidKeres(sw, ifNev);
  if (hid) return hid.letiltva ? null : { hid, cimke: undefined };
  const v = sw.vlanIfek.find((x) => x.nev === ifNev);
  if (!v || v.letiltva) return null;
  const szulo = hidKeres(sw, v.interfesz);
  if (!szulo || szulo.letiltva) return null;
  return { hid: szulo, cimke: v.vlanId };
}

/**
 * A switch IP-címeihez tartozó végpontok (a konfigurációhoz igazítva: az új címekhez új végpont,
 * a törölt címek végpontja megszűnik).
 * @returns {Object[]} – PC-szerű objektumok: { ip, maszk, mac, arpTabla, portok: [virtuális port], ifNev }
 */
export function sajatVegpontok(sw) {
  let tar = vegpontTar.get(sw);
  if (!tar) vegpontTar.set(sw, (tar = new Map()));
  const kell = new Map();
  for (const c of sw.ipCimek) {
    if (c.letiltva) continue;
    const k = l3Kapcsolat(sw, c.interfesz);
    if (!k) continue;
    kell.set(`${c.interfesz}|${c.cim}/${c.hossz}`, { c, k });
  }
  for (const kulcs of [...tar.keys()]) if (!kell.has(kulcs)) tar.delete(kulcs);
  for (const [kulcs, { c, k }] of kell) {
    if (tar.has(kulcs)) continue;
    const ifNev = c.interfesz;
    const ep = {
      tipus: 'sajat',
      hostname: sw.hostname,
      ifNev,
      mac: k.hid.mac,
      ip: c.cim,
      maszk: maszkSzoveg(c.hossz),
      atjaro: '',
      arpTabla: {},
      ipv6: '',
      ipv6Hossz: 64,
      ipv6Atjaro: '',
      ndTabla: {},
      portok: [{ nev: ifNev, rovid: ifNev, fent: true, virtualis: true, kuld: (keret) => cpuKuld(sw, ifNev, keret) }],
    };
    tar.set(kulcs, ep);
  }
  return [...tar.values()];
}

/** A switch processzora (a bridge mint port) kapott egy keretet. */
function cpuFogad(h, sw, hid, cimke, keret) {
  let ifNev = hid.nev;
  if (cimke !== undefined) {
    const v = sw.vlanIfek.find((x) => !x.letiltva && x.interfesz === hid.nev && x.vlanId === cimke);
    if (!v) return; // ehhez a VLAN-hoz nincs VLAN-interfész: a processzor nem foglalkozik vele
    ifNev = v.nev;
  }
  for (const ep of sajatVegpontok(sw)) {
    if (ep.ifNev !== ifNev) continue;
    vegpontFogad(h, ep, ep.portok[0], { ...keret, vlan: undefined });
  }
}

/** A switch processzora küld egy keretet egy L3-interfészéről (a bridge-en át). */
function cpuKuld(sw, ifNev, keret) {
  const h = sw.halozat;
  if (!h) return;
  const k = l3Kapcsolat(sw, ifNev);
  if (!k) return;
  const be = hidBe(sw, k.hid, k.hid.nev, k.cimke);
  if (!be.ok) return;
  tovabbit(h, sw, k.hid, k.hid.nev, be.vlan, { ...keret, vlan: k.cimke });
}

/** Az a saját végpont, amelyik a célcímmel egy hálózatban van (a switch pingje ebből indul). */
export function vegpontCelhoz(sw, celIp) {
  const c = ipSzam(celIp);
  if (c === null) return null;
  return sajatVegpontok(sw).find((ep) => {
    const hossz = sw.ipCimek.find((x) => x.cim === ep.ip && x.interfesz === ep.ifNev).hossz;
    return halozatSzam(ipSzam(ep.ip), hossz) === halozatSzam(c, hossz);
  }) || null;
}

// ---------------------------------------------------------------------------
// Elérhetőség (a hálózaton át való kezeléshez, pl. SSH): csomagküldés nélkül, a szabályokból
// ---------------------------------------------------------------------------

/**
 * A 2. rétegű út bejárása egy kiinduló pontból, elárasztásként (mint egy szórás): kik kapják meg
 * a keretet? Csak MikroTik switcheken és PC-ken át megy (más eszköznél megáll).
 * @param {import('./halozat.js').Halozat} h
 * @param {{eszkoz: Object, port: Object}|{sw: Object, hid: Object, cimke?: number}} kezdo
 * @returns {{pc: Object[], cpu: {sw: Object, ifNev: string}[]}}
 */
function elarasztas(h, kezdo) {
  const pc = [];
  const cpu = [];
  const latott = new Set();
  const sor = [];
  const kuldPortrol = (eszkoz, port, cimke) => {
    if (!port.fent) return;
    const tul = h.szomszed(eszkoz, port);
    if (tul) sor.push({ eszkoz: tul.eszkoz, port: tul.port, cimke });
  };
  const hidban = (sw, hid, forras, vlan, eredetiCimke) => {
    const tagok = [hid.nev, ...sw.hidPortok.filter((hp) => hp.hid === hid.nev && !hp.letiltva).map((hp) => hp.interfesz)];
    for (const cel of tagok) {
      if (cel === forras) continue;
      const ki = hidKi(sw, hid, vlan, cel, eredetiCimke);
      if (!ki.ok) continue;
      if (cel === hid.nev) {
        let ifNev = hid.nev;
        if (ki.cimke !== undefined) {
          const v = sw.vlanIfek.find((x) => !x.letiltva && x.interfesz === hid.nev && x.vlanId === ki.cimke);
          if (!v) continue;
          ifNev = v.nev;
        }
        cpu.push({ sw, ifNev });
        continue;
      }
      const p = sw.portok.find((x) => x.nev === cel);
      if (p) kuldPortrol(sw, p, ki.cimke);
    }
  };
  if (kezdo.hid) {
    const be = hidBe(kezdo.sw, kezdo.hid, kezdo.hid.nev, kezdo.cimke);
    if (be.ok) hidban(kezdo.sw, kezdo.hid, kezdo.hid.nev, be.vlan, kezdo.cimke);
  } else {
    kuldPortrol(kezdo.eszkoz, kezdo.port, undefined);
  }
  while (sor.length) {
    const { eszkoz, port, cimke } = sor.shift();
    const kulcs = `${eszkoz.hostname}|${port.nev}|${cimke}`;
    if (latott.has(kulcs) || !port.fent) continue;
    latott.add(kulcs);
    if (eszkoz.tipus === 'pc') {
      if (cimke === undefined && !pc.includes(eszkoz)) pc.push(eszkoz);
      continue;
    }
    if (eszkoz.gyarto !== 'mikrotik') continue;
    const hp = hidPortja(eszkoz, port.nev);
    if (!hp) continue;
    const hid = hidKeres(eszkoz, hp.hid);
    if (!hid || hid.letiltva) continue;
    const be = hidBe(eszkoz, hid, port.nev, cimke);
    if (be.ok) hidban(eszkoz, hid, port.nev, be.vlan, cimke);
  }
  return { pc, cpu };
}

/**
 * Elérhető-e a switch egyik saját IP-címe egy PC-ről, a hálózaton át (mindkét irányban)?
 * Ezt figyeli a hálózati (SSH-) kezelés: ha megszakad az út, megszakad a kapcsolat is.
 * @param {import('./halozat.js').Halozat} h
 * @param {Object} pc
 * @param {Object} sw
 * @param {string} ip – a switch címe, amelyhez a PC kapcsolódik
 * @returns {boolean}
 */
export function kezelhetoE(h, pc, sw, ip) {
  if (!pc.ip || !pc.maszk || !pc.portok[0].fent) return false;
  const ep = sajatVegpontok(sw).find((x) => x.ip === ip);
  if (!ep) return false;
  const hossz = sw.ipCimek.find((x) => x.cim === ip && x.interfesz === ep.ifNev).hossz;
  // A PC-nek és a switch címének egy hálózatban kell lennie (router nincs közöttük).
  const maszkHossz = pc.maszk.split('.').reduce((a, o) => a + (Number(o) >>> 0).toString(2).replace(/0/g, '').length, 0);
  if (halozatSzam(ipSzam(pc.ip), maszkHossz) !== halozatSzam(ipSzam(ip), maszkHossz)) return false;
  if (halozatSzam(ipSzam(pc.ip), hossz) !== halozatSzam(ipSzam(ip), hossz)) return false;
  const oda = elarasztas(h, { eszkoz: pc, port: pc.portok[0] });
  if (!oda.cpu.some((c) => c.sw === sw && c.ifNev === ep.ifNev)) return false;
  const k = l3Kapcsolat(sw, ep.ifNev);
  const vissza = elarasztas(h, { sw, hid: k.hid, cimke: k.cimke });
  return vissza.pc.includes(pc);
}
