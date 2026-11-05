/**
 * Végpont (PC) működése: ARP, IPv4, IPv6 (szomszédfelderítéssel), ICMP (ping, tracert).
 *
 *   - ARP: a gép szórással (broadcast) kérdezi meg, kié egy IP-cím; a gazdája válaszol.
 *     A válaszokat az ARP-gyorstár (pc.arpTabla) megjegyzi.
 *   - IPv6-ban ugyanezt a szomszédfelderítés (ND) végzi: „Neighbor Solicitation” egy csoportcímre,
 *     „Neighbor Advertisement” a válasz (pc.ndTabla).
 *   - Kinek küld? Ha a cél a saját hálózatában van, közvetlenül neki; ha nem, az
 *     alapértelmezett átjárónak. Ha nincs átjáró, a csomag el sem indul.
 *   - ping: ICMP echo request → echo reply. Útközben a routerek hibaüzenetet küldhetnek vissza:
 *     „Time exceeded” (lejárt a TTL – a tracert ebből dolgozik), „Destination net unreachable”.
 *
 * A várakozó kérések (függő ARP/ND, ping) egy belső táblában vannak, nem a modellben.
 */

import { SZORAS, ujKeretAzon } from './ethernet.js';
import { egyHalozat } from './ip.js';
import {
  ipv6Elemez, ipv6Normal, ipv6Szoveg, ipv6EgyHalozat, linkLocalE, eui64LinkLocal, solicitedNode, ipv6CsoportMac,
} from './ipv6.js';

/** Ennyi ideig vár ARP-válaszra (ms). */
export const ARP_VARAKOZAS = 3000;
/** Ennyi ideig vár a ping válaszára (ms; a PC-k alapértéke 4 s). */
export const PING_VARAKOZAS = 4000;
/** A PC által küldött csomagok TTL-je (és IPv6-ban a hop limit). */
export const ALAP_TTL = 128;

/** @type {WeakMap<Object, {arpVarok: Map, ndVarok: Map, pingVarok: Map, kovetkezoSorszam: number}>} */
const belso = new WeakMap();
function allapot(pc) {
  let a = belso.get(pc);
  if (!a) belso.set(pc, (a = { arpVarok: new Map(), ndVarok: new Map(), pingVarok: new Map(), kovetkezoSorszam: 1 }));
  return a;
}

function nic(pc) {
  return pc.portok[0];
}

function kuld(h, pc, keret) {
  h.kuld(pc, nic(pc), { azon: ujKeretAzon(), forrasMac: pc.mac, ...keret });
}

/** Van-e használható IP-beállítás. */
export function vanIp(pc) {
  return !!pc.ip && !!pc.maszk;
}

/** Van-e IPv6-cím. */
export function vanIpv6(pc) {
  return !!pc.ipv6;
}

/** A PC link-local címe (a MAC-címből, EUI-64), egységes szöveges alakban. */
export function pcLinkLocal(pc) {
  return ipv6Szoveg(eui64LinkLocal(pc.mac));
}

/**
 * Kinek kell elküldeni egy csomagot a célhoz (következő ugrás)?
 * @returns {string|null} – IP-cím, vagy null, ha nincs út (nincs átjáró)
 */
export function kovetkezoUgras(pc, celIp) {
  if (celIp.includes(':')) return kovetkezoUgras6(pc, celIp);
  if (egyHalozat(pc.ip, celIp, pc.maszk)) return celIp;
  if (pc.atjaro && egyHalozat(pc.ip, pc.atjaro, pc.maszk)) return pc.atjaro;
  return null;
}

function kovetkezoUgras6(pc, cel) {
  const c = ipv6Elemez(cel);
  if (linkLocalE(c)) return cel;
  if (pc.ipv6 && ipv6EgyHalozat(ipv6Elemez(pc.ipv6), c, pc.ipv6Hossz || 64)) return cel;
  return pc.ipv6Atjaro || null;
}

/** A PC saját IPv6-címe-e. */
function sajat6(pc, cim) {
  return cim === pc.ipv6 || cim === pcLinkLocal(pc);
}

// ---------------------------------------------------------------------------
// ARP és ND
// ---------------------------------------------------------------------------

/**
 * Egy IP-címhez tartozó MAC kiderítése (ARP-gyorstárból vagy ARP-kérdéssel).
 * @param {(mac: string|null) => void} cb – null, ha nem jött válasz
 */
export function arpFelold(h, pc, ip, cb) {
  if (ip.includes(':')) return ndFelold(h, pc, ip, cb);
  const b = pc.arpTabla[ip];
  if (b) return cb(b.mac);
  const a = allapot(pc);
  const var_ = a.arpVarok.get(ip);
  if (var_) {
    var_.cbk.push(cb);
    return;
  }
  const uj = { cbk: [cb], idozito: null };
  a.arpVarok.set(ip, uj);
  uj.idozito = h.ora.utemez(ARP_VARAKOZAS, () => {
    a.arpVarok.delete(ip);
    for (const f of uj.cbk) f(null);
  });
  kuld(h, pc, {
    celMac: SZORAS,
    tipus: 'arp',
    adat: { muvelet: 'keres', kuldoMac: pc.mac, kuldoIp: pc.ip, celMac: '000000000000', celIp: ip },
  });
}

function ndFelold(h, pc, cim, cb) {
  const b = pc.ndTabla[cim];
  if (b) return cb(b.mac);
  const a = allapot(pc);
  const var_ = a.ndVarok.get(cim);
  if (var_) {
    var_.cbk.push(cb);
    return;
  }
  const uj = { cbk: [cb], idozito: null };
  a.ndVarok.set(cim, uj);
  uj.idozito = h.ora.utemez(ARP_VARAKOZAS, () => {
    a.ndVarok.delete(cim);
    for (const f of uj.cbk) f(null);
  });
  const sn = solicitedNode(ipv6Elemez(cim));
  kuld(h, pc, {
    celMac: ipv6CsoportMac(sn),
    tipus: 'ipv6',
    adat: { forras: pcLinkLocal(pc), cel: ipv6Szoveg(sn), hop: 255, protokoll: 'icmpv6', icmp: { tipus: 'ns', cel: cim }, keses: 0 },
  });
}

/** Az ARP-gyorstár bővítése; a rá várakozók megkapják a választ. */
function arpTanul(h, pc, ip, mac) {
  pc.arpTabla[ip] = { mac, ido: h.ora.ido };
  const a = allapot(pc);
  const var_ = a.arpVarok.get(ip);
  if (var_) {
    a.arpVarok.delete(ip);
    h.ora.lemond(var_.idozito);
    for (const f of var_.cbk) f(mac);
  }
}

function ndTanul(h, pc, cim, mac) {
  pc.ndTabla[cim] = { mac, ido: h.ora.ido };
  const a = allapot(pc);
  const var_ = a.ndVarok.get(cim);
  if (var_) {
    a.ndVarok.delete(cim);
    h.ora.lemond(var_.idozito);
    for (const f of var_.cbk) f(mac);
  }
}

// ---------------------------------------------------------------------------
// Küldés
// ---------------------------------------------------------------------------

/** IP-csomag (v4 vagy v6) küldése a következő ugrás MAC-címének kiderítése után. */
function ipKuld(h, pc, celIp, adat, hibaCb) {
  const v6 = celIp.includes(':');
  const ugras = kovetkezoUgras(pc, celIp);
  if (!ugras) return hibaCb && hibaCb('nincs-ut');
  arpFelold(h, pc, ugras, (mac) => {
    if (!mac) return hibaCb && hibaCb('arp');
    if (v6) {
      const forras = linkLocalE(ipv6Elemez(celIp)) ? pcLinkLocal(pc) : pc.ipv6;
      kuld(h, pc, { celMac: mac, tipus: 'ipv6', adat: { forras, cel: celIp, hop: ALAP_TTL, keses: 0, ...adat } });
    } else {
      kuld(h, pc, { celMac: mac, tipus: 'ipv4', adat: { forrasIp: pc.ip, celIp, ttl: ALAP_TTL, keses: 0, ...adat } });
    }
  });
}

/**
 * Egyetlen ping (echo request), és a végeredménye:
 *   { fajta: 'valasz', ttl, keses }      – megjött a válasz (keses: oda-vissza idő ms-ban)
 *   { fajta: 'ttl-lejart', kitol, keses } – egy router visszaszólt: lejárt a TTL (tracert)
 *   { fajta: 'halozat-elerhetetlen', kitol } – egy router visszaszólt: nincs útvonala a célhoz
 *   { fajta: 'idotullepes' }   – nem jött válasz időben (Request timed out)
 *   { fajta: 'elerhetetlen' }  – nem jött ARP-/ND-válasz (Destination host unreachable)
 *   { fajta: 'hiba' }          – el sem tudta küldeni (nincs IP, nincs link, nincs átjáró)
 * @param {import('./halozat.js').Halozat} h
 * @param {Object} pc
 * @param {string} celIp – IPv4 vagy IPv6 cím
 * @param {(eredmeny: Object) => void} cb
 * @param {{ttl?: number}} [b]
 */
export function egyPing(h, pc, celIp, cb, { ttl = ALAP_TTL } = {}) {
  const v6 = celIp.includes(':');
  const cel = v6 ? ipv6Normal(celIp) : celIp;
  if (!nic(pc).fent) return cb({ fajta: 'hiba' });
  if (v6) {
    if (!cel) return cb({ fajta: 'hiba' });
    if (sajat6(pc, cel)) return cb({ fajta: 'valasz', ttl: ALAP_TTL, keses: 0 });
    if (!vanIpv6(pc) && !linkLocalE(ipv6Elemez(cel))) return cb({ fajta: 'hiba' });
  } else {
    if (!vanIp(pc)) return cb({ fajta: 'hiba' });
    if (cel === pc.ip) return cb({ fajta: 'valasz', ttl: ALAP_TTL, keses: 0 });
  }
  const a = allapot(pc);
  const sorszam = a.kovetkezoSorszam++;
  let kesz = false;
  const vege = (e) => {
    if (kesz) return;
    kesz = true;
    a.pingVarok.delete(sorszam);
    cb(e);
  };
  const ugras = kovetkezoUgras(pc, cel);
  if (!ugras) return vege({ fajta: 'hiba' });
  arpFelold(h, pc, ugras, (mac) => {
    if (!mac) return vege({ fajta: 'elerhetetlen' });
    const idozito = h.ora.utemez(PING_VARAKOZAS, () => vege({ fajta: 'idotullepes' }));
    a.pingVarok.set(sorszam, (v) => {
      h.ora.lemond(idozito);
      vege(v);
    });
    if (v6) {
      const forras = linkLocalE(ipv6Elemez(cel)) ? pcLinkLocal(pc) : pc.ipv6;
      kuld(h, pc, {
        celMac: mac,
        tipus: 'ipv6',
        adat: { forras, cel, hop: ttl, protokoll: 'icmpv6', icmp: { tipus: 'echo-keres', sorszam }, keses: 0 },
      });
    } else {
      kuld(h, pc, {
        celMac: mac,
        tipus: 'ipv4',
        adat: { forrasIp: pc.ip, celIp: cel, ttl, protokoll: 'icmp', icmp: { tipus: 'echo-keres', sorszam }, keses: 0 },
      });
    }
  });
}

/**
 * Szórásos próba: a PC egy „ARP-próbát” küld szórással (feladó IP-je 0.0.0.0, ezért
 * senki nem válaszol rá, és senki ARP-gyorstárát sem módosítja). Akik megkapják, azok
 * a PC-vel egy szórási tartományban (egy VLAN-ban) vannak.
 * @param {(kik: Object[]) => void} cb – az eszközök, amelyekhez eljutott
 */
export function szorasProba(h, pc, cb) {
  const azon = ujKeretAzon();
  const kik = [];
  const leiratkozas = h.figyel((e) => {
    if (e.tipus === 'fogadva' && e.keret.azon === azon && !kik.includes(e.eszkoz)) kik.push(e.eszkoz);
  });
  h.kuld(pc, nic(pc), {
    azon,
    forrasMac: pc.mac,
    celMac: SZORAS,
    tipus: 'arp',
    adat: { muvelet: 'keres', kuldoMac: pc.mac, kuldoIp: '0.0.0.0', celMac: '000000000000', celIp: pc.ip || '0.0.0.0' },
  });
  // Elég idő, hogy a keret a legtávolabbi gépig is elérjen.
  h.ora.utemez(h.kesleltetes * 12 + 50, () => {
    leiratkozas();
    cb(kik);
  });
}

// ---------------------------------------------------------------------------
// Fogadás
// ---------------------------------------------------------------------------

/** Egy ping-válasz vagy ICMP-hibaüzenet átadása a várakozó pingnek. */
function pingnek(pc, icmp, kitol, ttl, keses) {
  const a = allapot(pc);
  if (icmp.tipus === 'echo-valasz') {
    const v = a.pingVarok.get(icmp.sorszam);
    if (v) v({ fajta: 'valasz', ttl, kitol, keses });
    return;
  }
  const v = icmp.eredeti && a.pingVarok.get(icmp.eredeti.sorszam);
  if (!v) return;
  if (icmp.tipus === 'ido-lejart') v({ fajta: 'ttl-lejart', kitol, keses });
  else if (icmp.tipus === 'elerhetetlen') v({ fajta: 'halozat-elerhetetlen', kitol, keses });
}

/** Egy keret megérkezett a PC hálózati kártyájára. */
export function vegpontFogad(h, pc, port, keret) {
  if (keret.vlan !== undefined) return h.eldob(pc, port, keret, 'A PC nem ismeri a 802.1Q-címkés keretet.');
  const csoport = keret.celMac.startsWith('3333');
  if (keret.celMac !== pc.mac && keret.celMac !== SZORAS && !csoport) return; // nem neki szól: a kártya eldobja

  if (keret.tipus === 'ipv6') return ipv6Fogad(h, pc, port, keret);
  if (csoport) return;
  h.esemeny({ tipus: 'fogadva', eszkoz: pc, port, keret });

  if (keret.tipus === 'arp') {
    const arp = keret.adat;
    if (!vanIp(pc) || arp.kuldoIp === '0.0.0.0') return;
    if (arp.celIp !== pc.ip) return;
    arpTanul(h, pc, arp.kuldoIp, arp.kuldoMac);
    if (arp.muvelet === 'keres') {
      kuld(h, pc, {
        celMac: arp.kuldoMac,
        tipus: 'arp',
        adat: { muvelet: 'valasz', kuldoMac: pc.mac, kuldoIp: pc.ip, celMac: arp.kuldoMac, celIp: arp.kuldoIp },
      });
    }
    return;
  }

  if (keret.tipus === 'ipv4') {
    const ip = keret.adat;
    if (!vanIp(pc) || ip.celIp !== pc.ip) return;
    if (ip.protokoll === 'icmp' && ip.icmp.tipus === 'echo-keres') {
      ipKuld(h, pc, ip.forrasIp, { protokoll: 'icmp', icmp: { tipus: 'echo-valasz', sorszam: ip.icmp.sorszam }, keses: ip.keses || 0 });
    } else if (ip.protokoll === 'icmp') {
      pingnek(pc, ip.icmp, ip.forrasIp, ip.ttl, ip.keses || 0);
    }
  }
}

function ipv6Fogad(h, pc, port, keret) {
  const cs = keret.adat;
  if (cs.protokoll === 'icmpv6' && cs.icmp.tipus === 'ns') {
    if (!sajat6(pc, cs.icmp.cel)) return;
    h.esemeny({ tipus: 'fogadva', eszkoz: pc, port, keret });
    ndTanul(h, pc, cs.forras, keret.forrasMac);
    kuld(h, pc, {
      celMac: keret.forrasMac,
      tipus: 'ipv6',
      adat: { forras: cs.icmp.cel, cel: cs.forras, hop: 255, protokoll: 'icmpv6', icmp: { tipus: 'na', cel: cs.icmp.cel }, keses: 0 },
    });
    return;
  }
  if (!sajat6(pc, cs.cel)) return; // csoportcímek (pl. RIPng) – a PC nem foglalkozik velük
  h.esemeny({ tipus: 'fogadva', eszkoz: pc, port, keret });
  if (cs.protokoll !== 'icmpv6') return;
  if (cs.icmp.tipus === 'na') {
    ndTanul(h, pc, cs.icmp.cel, keret.forrasMac);
    return;
  }
  if (cs.icmp.tipus === 'echo-keres') {
    ipKuld(h, pc, cs.forras, { protokoll: 'icmpv6', icmp: { tipus: 'echo-valasz', sorszam: cs.icmp.sorszam }, keses: cs.keses || 0 });
    return;
  }
  pingnek(pc, cs.icmp, cs.forras, cs.hop, cs.keses || 0);
}

/**
 * A PC IP-beállításának módosítása (közben az ARP- és ND-gyorstár ürül).
 * IPv6: ipv6 (cím), ipv6Hossz (előtaghossz, alapból 64), ipv6Atjaro (általában a router link-local címe).
 */
export function ipBeallit(pc, { ip, maszk, atjaro, ipv6, ipv6Hossz, ipv6Atjaro }) {
  if (ip !== undefined) pc.ip = ip;
  if (maszk !== undefined) pc.maszk = maszk;
  if (atjaro !== undefined) pc.atjaro = atjaro;
  if (ipv6 !== undefined) pc.ipv6 = ipv6 ? ipv6Normal(ipv6) || '' : '';
  if (ipv6Hossz !== undefined) pc.ipv6Hossz = ipv6Hossz;
  if (ipv6Atjaro !== undefined) pc.ipv6Atjaro = ipv6Atjaro ? ipv6Normal(ipv6Atjaro) || '' : '';
  pc.arpTabla = {};
  pc.ndTabla = {};
}
