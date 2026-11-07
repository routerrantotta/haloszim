/**
 * A router működése (3. réteg), gyártófüggetlenül:
 *   - ARP (IPv4) és szomszédfelderítés (ND, IPv6): ki melyik MAC-címen érhető el,
 *   - csomagtovábbítás a routing tábla alapján (mag/utvonal.js): TTL / hop limit csökkentése,
 *     leghosszabb egyező előtag, következő ugrás,
 *   - ICMP-hibaüzenetek: „Time exceeded” (lejárt a TTL – ebből dolgozik a traceroute) és
 *     „Destination unreachable” (nincs útvonal),
 *   - a routernek szóló csomagok: ping-válasz, RIP / RIPng (mag/rip.js), OSPF (mag/ospf.js).
 *
 * Valódi viselkedés, amit érdemes tudni: ha a router még nem ismeri a következő ugrás MAC-címét,
 * elküldi az ARP-kérdést, de az éppen továbbítandó csomagot eldobja. Ezért vész el gyakran az első
 * ping („.!!!!”). A szimulátor is így működik. IPv6-ban (szomszédfelderítés, ND) a router a
 * csomagot a válaszig sorba teszi.
 *
 * A csomagok (a keret „adat” része):
 *   IPv4: { forrasIp, celIp, ttl, protokoll: 'icmp'|'udp', icmp?: {tipus, kod?, sorszam?, eredeti?}, udp?: {port, adat}, keses }
 *   IPv6: { forras, cel, hop, protokoll: 'icmpv6'|'udp', icmp?: {…, cel? (ND)}, udp?, keses }
 * A címek szövegesek (IPv6-nál egységes, nagybetűs rövid alakban). A „keses” a csomag eddigi
 * valódi késleltetése ms-ban (a soros vonal lassú) – ebből számol a ping és a traceroute időt.
 */

import { SZORAS, ujKeretAzon } from './ethernet.js';
import { ipSzam, ipSzoveg, prefixHossz, halozatSzam } from './ip.js';
import {
  ipv6Elemez, ipv6Normal, ipv6Szoveg, ipv6EgyHalozat, linkLocalE, csoportcimE, solicitedNode, ipv6CsoportMac,
} from './ipv6.js';
import { keres4, keres6, portFent, portLinkLocal, ipv6Engedelyezve } from './utvonal.js';
import { ripFogad4, ripFogad6 } from './rip.js';
import { ospfFogad } from './ospf.js';

/** A routernek szóló IPv4-csoportcímek: RIPv2, OSPF (minden router, DR-ek). */
const CSOPORT4 = ['224.0.0.9', '224.0.0.5', '224.0.0.6'];

/** A router által indított csomagok TTL-je (IOS: 255). */
export const ROUTER_TTL = 255;
/** Ennyi időnként küldhet a router „Destination unreachable” üzenetet (IOS: 500 ms). */
export const ELERHETETLEN_KORLAT = 500;
/** A router pingje ennyit vár egy válaszra (IOS: 2 s). */
export const ROUTER_PING_VARAKOZAS = 2000;

const belso = new WeakMap();
function allapot(r) {
  let a = belso.get(r);
  if (!a) belso.set(r, (a = { varok: new Map(), sorszam: 1, utolsoElerhetetlen: -Infinity, ndSor: new Map() }));
  return a;
}

/** Csoportcímes (multicast) Ethernet-cím-e. */
function csoportMac(mac) {
  return mac.startsWith('01005e') || mac.startsWith('3333');
}

function port(r, nev) {
  return r.portok.find((p) => p.nev === nev);
}

/** Egy keret elküldése egy porton (a router saját MAC-címével). */
export function keretKuld(h, r, p, celMac, tipus, adat) {
  h.kuld(r, p, { azon: ujKeretAzon(), forrasMac: p.mac, celMac, tipus, adat });
}

// ---------------------------------------------------------------------------
// Címek
// ---------------------------------------------------------------------------

/** A router saját IPv4-címe-e (működő interfészen). */
export function sajat4(r, ip) {
  return r.portok.some((p) => p.ip === ip && portFent(p));
}

/** A router saját IPv6-címe-e (a link-local csak a beérkezés portján számít). */
function sajat6(r, cel, bePort) {
  const c = ipv6Elemez(cel);
  if (!c) return false;
  if (linkLocalE(c)) {
    const ll = bePort && portLinkLocal(bePort);
    return !!ll && ipv6Szoveg(ll) === cel;
  }
  return r.portok.some((p) => portFent(p) && p.ipv6.some((x) => x.cim === cel));
}

/** A port első globális IPv6-címe (vagy a link-local, ha nincs globális). */
export function portForras6(p) {
  if (p.ipv6.length) return p.ipv6[0].cim;
  const ll = portLinkLocal(p);
  return ll ? ipv6Szoveg(ll) : null;
}

// ---------------------------------------------------------------------------
// ARP és ND
// ---------------------------------------------------------------------------

function arpKerdez(h, r, p, celIp) {
  keretKuld(h, r, p, SZORAS, 'arp', { muvelet: 'keres', kuldoMac: p.mac, kuldoIp: p.ip, celMac: '000000000000', celIp });
}

function ndKerdez(h, r, p, cel) {
  const c = ipv6Elemez(cel);
  const sn = solicitedNode(c);
  const forras = ipv6Szoveg(portLinkLocal(p));
  keretKuld(h, r, p, ipv6CsoportMac(sn), 'ipv6', {
    forras, cel: ipv6Szoveg(sn), hop: 255, protokoll: 'icmpv6', icmp: { tipus: 'ns', cel }, keses: 0,
  });
}

/**
 * IPv4-csomag küldése egy porton egy következő ugrásnak. Ha a MAC még ismeretlen, ARP-kérdést
 * küld, és a csomagot eldobja (mint a valódi router). Igazat ad, ha a csomag elment.
 */
function kuld4Porton(h, r, p, kovetkezo, csomag) {
  const b = r.arpTabla[kovetkezo];
  if (b && b.port === p.nev) {
    keretKuld(h, r, p, b.mac, 'ipv4', csomag);
    return true;
  }
  arpKerdez(h, r, p, kovetkezo);
  return false;
}

/** Ennyi ideig várnak a csomagok a szomszéd címének feloldására (IPv6, ms). */
const ND_VARAKOZAS = 3000;

/**
 * IPv6-csomag küldése. Ha a szomszéd MAC-címe még ismeretlen, a router szomszédkérdést (NS) küld,
 * és a csomagot addig sorba teszi (legfeljebb 3-at) – IPv6-ban a router nem dobja el rögtön.
 */
function kuld6Porton(h, r, p, kovetkezo, csomag) {
  const b = r.ndTabla[kovetkezo];
  if (b && b.port === p.nev) {
    keretKuld(h, r, p, b.mac, 'ipv6', csomag);
    return true;
  }
  const a = allapot(r);
  const kulcs = `${p.nev}|${kovetkezo}`;
  let sor = a.ndSor.get(kulcs);
  if (sor) {
    if (sor.csomagok.length >= 3) return false;
    sor.csomagok.push(csomag);
    return true;
  }
  sor = { csomagok: [csomag], idozito: null };
  a.ndSor.set(kulcs, sor);
  sor.idozito = h.ora.utemez(ND_VARAKOZAS, () => a.ndSor.delete(kulcs));
  ndKerdez(h, r, p, kovetkezo);
  return true;
}

/** Egy IPv6-szomszéd megismerése; a rá váró csomagok elindulnak. */
function ndTanul(h, r, p, cim, mac) {
  r.ndTabla[cim] = { mac, port: p.nev, ido: h.ora.ido };
  const a = allapot(r);
  const kulcs = `${p.nev}|${cim}`;
  const sor = a.ndSor.get(kulcs);
  if (!sor) return;
  a.ndSor.delete(kulcs);
  h.ora.lemond(sor.idozito);
  for (const cs of sor.csomagok) keretKuld(h, r, p, mac, 'ipv6', cs);
}

/**
 * Egy, a router által indított IPv4-csomag elküldése (útvonal-kereséssel).
 * @returns {boolean} – elment-e
 */
export function routerKuld4(h, r, celIp, adat, { forrasIp, ttl = ROUTER_TTL } = {}) {
  const ut = keres4(r, ipSzam(celIp));
  if (!ut) return false;
  const p = port(r, ut.port);
  return kuld4Porton(h, r, p, ipSzoveg(ut.kovetkezo), { forrasIp: forrasIp || p.ip, celIp, ttl, keses: 0, ...adat });
}

/** Egy, a router által indított IPv6-csomag elküldése. */
export function routerKuld6(h, r, cel, adat, { forras, hop = 64 } = {}) {
  const c = ipv6Elemez(cel);
  const ut = keres6(r, c);
  if (!ut) return false;
  const p = port(r, ut.port);
  const src = forras || (linkLocalE(c) ? ipv6Szoveg(portLinkLocal(p)) : portForras6(p));
  return kuld6Porton(h, r, p, ipv6Szoveg(ut.kovetkezo), { forras: src, cel, hop, keses: 0, ...adat });
}

// ---------------------------------------------------------------------------
// ICMP-hibaüzenetek
// ---------------------------------------------------------------------------

function hibaUzenet(csomag) {
  return csomag.icmp && (csomag.icmp.tipus === 'ido-lejart' || csomag.icmp.tipus === 'elerhetetlen');
}

function icmpHiba4(h, r, bePort, csomag, tipus) {
  if (hibaUzenet(csomag) || !bePort.ip) return;
  if (tipus === 'elerhetetlen') {
    const a = allapot(r);
    if (h.ora.ido - a.utolsoElerhetetlen < ELERHETETLEN_KORLAT) return;
    a.utolsoElerhetetlen = h.ora.ido;
  }
  const eredeti = { sorszam: csomag.icmp && csomag.icmp.sorszam, forrasIp: csomag.forrasIp, celIp: csomag.celIp };
  routerKuld4(h, r, csomag.forrasIp, { protokoll: 'icmp', icmp: { tipus, eredeti }, keses: csomag.keses || 0 }, { forrasIp: bePort.ip });
}

function icmpHiba6(h, r, bePort, csomag, tipus) {
  if (hibaUzenet(csomag)) return;
  if (tipus === 'elerhetetlen') {
    const a = allapot(r);
    if (h.ora.ido - a.utolsoElerhetetlen < ELERHETETLEN_KORLAT) return;
    a.utolsoElerhetetlen = h.ora.ido;
  }
  const eredeti = { sorszam: csomag.icmp && csomag.icmp.sorszam, forras: csomag.forras, cel: csomag.cel };
  routerKuld6(h, r, csomag.forras, { protokoll: 'icmpv6', icmp: { tipus, eredeti }, keses: csomag.keses || 0 },
    { forras: portForras6(bePort) });
}

// ---------------------------------------------------------------------------
// Fogadás
// ---------------------------------------------------------------------------

/**
 * Egy keret megérkezett a router egyik portjára.
 * @param {import('./halozat.js').Halozat} h
 */
export function routerFogad(h, r, p, keret) {
  if (keret.vlan !== undefined) {
    return h.eldob(r, p, keret, 'A router ezen a porton nem ismeri a 802.1Q-címkés keretet (nincs alinterfész).');
  }
  if (keret.celMac !== p.mac && keret.celMac !== SZORAS && !csoportMac(keret.celMac)) return;
  if (!portFent(p)) return;
  h.esemeny({ tipus: 'fogadva', eszkoz: r, port: p, keret });

  if (keret.tipus === 'arp') return arpFogad(h, r, p, keret.adat);
  if (keret.tipus === 'ipv4') return ipv4Fogad(h, r, p, keret.adat, keret);
  if (keret.tipus === 'ipv6') return ipv6Fogad(h, r, p, keret);
  return undefined;
}

function arpFogad(h, r, p, arp) {
  if (!p.ip || arp.celIp !== p.ip || arp.kuldoIp === '0.0.0.0') return;
  r.arpTabla[arp.kuldoIp] = { mac: arp.kuldoMac, port: p.nev, ido: h.ora.ido };
  if (arp.muvelet === 'keres') {
    keretKuld(h, r, p, arp.kuldoMac, 'arp', { muvelet: 'valasz', kuldoMac: p.mac, kuldoIp: p.ip, celMac: arp.kuldoMac, celIp: arp.kuldoIp });
  }
}

function ipv4Fogad(h, r, p, cs, keret) {
  if (!p.ip) return; // IP-cím nélküli porton a router nem dolgoz fel IPv4-et
  if (cs.celIp === '255.255.255.255' || CSOPORT4.includes(cs.celIp) || sajat4(r, cs.celIp)) return helyi4(h, r, p, cs, keret);
  if (cs.protokoll === 'ospf') return; // az OSPF-csomagok nem mennek tovább (TTL 1)
  // Továbbítás
  const ttl = cs.ttl - 1;
  if (ttl <= 0) return icmpHiba4(h, r, p, cs, 'ido-lejart');
  const ut = keres4(r, ipSzam(cs.celIp));
  if (!ut) {
    h.eldob(r, p, { tipus: 'ipv4', adat: cs }, `${r.hostname}: nincs útvonal ide: ${cs.celIp} – a router eldobta a csomagot.`);
    return icmpHiba4(h, r, p, cs, 'elerhetetlen');
  }
  const ki = port(r, ut.port);
  const kov = ipSzoveg(ut.kovetkezo);
  if (!kuld4Porton(h, r, ki, kov, { ...cs, ttl })) {
    h.eldob(r, ki, { tipus: 'ipv4', adat: cs }, `${r.hostname} még nem ismeri ${kov} MAC-címét: ARP-kérdést küldött, ezt a csomagot pedig eldobta.`);
  }
}

function helyi4(h, r, p, cs, keret) {
  if (cs.protokoll === 'icmp') {
    const t = cs.icmp.tipus;
    if (t === 'echo-keres') {
      routerKuld4(h, r, cs.forrasIp, { protokoll: 'icmp', icmp: { tipus: 'echo-valasz', sorszam: cs.icmp.sorszam }, keses: cs.keses || 0 },
        { forrasIp: cs.celIp });
      return;
    }
    const sorszam = t === 'echo-valasz' ? cs.icmp.sorszam : cs.icmp.eredeti && cs.icmp.eredeti.sorszam;
    const v = allapot(r).varok.get(sorszam);
    if (v) v({ tipus: t, kitol: cs.forrasIp, ttl: cs.ttl, keses: cs.keses || 0 });
    return;
  }
  if (cs.protokoll === 'udp' && cs.udp.port === 520) ripFogad4(h, r, p, cs);
  if (cs.protokoll === 'ospf') ospfFogad(h, r, p, cs, 4, keret.forrasMac);
}

function ipv6Fogad(h, r, p, keret) {
  const cs = keret.adat;
  if (!ipv6Engedelyezve(p)) return;
  // Szomszédfelderítés
  if (cs.protokoll === 'icmpv6' && cs.icmp.tipus === 'ns') {
    if (!sajat6(r, cs.icmp.cel, p)) return;
    ndTanul(h, r, p, cs.forras, keret.forrasMac);
    keretKuld(h, r, p, keret.forrasMac, 'ipv6', {
      forras: cs.icmp.cel, cel: cs.forras, hop: 255, protokoll: 'icmpv6', icmp: { tipus: 'na', cel: cs.icmp.cel }, keses: 0,
    });
    return;
  }
  if (cs.protokoll === 'icmpv6' && cs.icmp.tipus === 'na') {
    ndTanul(h, r, p, cs.icmp.cel, keret.forrasMac);
    return;
  }
  const c = ipv6Elemez(cs.cel);
  if (csoportcimE(c) || sajat6(r, cs.cel, p)) return helyi6(h, r, p, cs, keret);
  if (!r.ipv6Routing) return; // IPv6-továbbítás nélkül (no ipv6 unicast-routing) a router nem továbbít
  const hop = cs.hop - 1;
  if (hop <= 0) return icmpHiba6(h, r, p, cs, 'ido-lejart');
  const ut = keres6(r, c);
  if (!ut) {
    h.eldob(r, p, { tipus: 'ipv6', adat: cs }, `${r.hostname}: nincs útvonal ide: ${cs.cel} – a router eldobta a csomagot.`);
    return icmpHiba6(h, r, p, cs, 'elerhetetlen');
  }
  const ki = port(r, ut.port);
  const kov = ipv6Szoveg(ut.kovetkezo);
  if (!kuld6Porton(h, r, ki, kov, { ...cs, hop })) {
    h.eldob(r, ki, { tipus: 'ipv6', adat: cs }, `${r.hostname} még nem ismeri ${kov} MAC-címét, és már túl sok csomag vár rá – ezt eldobta.`);
  }
}

function helyi6(h, r, p, cs, keret) {
  // Aki szól hozzánk, azt megjegyezzük (a válaszhoz kell a MAC-címe).
  if (cs.forras && linkLocalE(ipv6Elemez(cs.forras))) ndTanul(h, r, p, cs.forras, keret.forrasMac);
  if (cs.protokoll === 'icmpv6') {
    const t = cs.icmp.tipus;
    if (t === 'echo-keres') {
      routerKuld6(h, r, cs.forras, { protokoll: 'icmpv6', icmp: { tipus: 'echo-valasz', sorszam: cs.icmp.sorszam }, keses: cs.keses || 0 },
        { forras: cs.cel });
      return;
    }
    const sorszam = t === 'echo-valasz' ? cs.icmp.sorszam : cs.icmp.eredeti && cs.icmp.eredeti.sorszam;
    const v = allapot(r).varok.get(sorszam);
    if (v) v({ tipus: t, kitol: cs.forras, ttl: cs.hop, keses: cs.keses || 0 });
    return;
  }
  if (cs.protokoll === 'udp' && cs.udp.port === 521) ripFogad6(h, r, p, cs);
  if (cs.protokoll === 'ospf') ospfFogad(h, r, p, cs, 6, keret.forrasMac);
}

// ---------------------------------------------------------------------------
// A router saját pingje és traceroute-ja
// ---------------------------------------------------------------------------

/**
 * Egyetlen echo a routerről.
 *   { fajta: 'valasz', kitol, keses } | { fajta: 'ido-lejart', kitol, keses } | { fajta: 'elerhetetlen', kitol }
 *   | { fajta: 'idotullepes' }
 * @param {string} cel – IPv4 vagy IPv6 cím (szövegesen)
 * @param {{ttl?: number, varakozas?: number, forras?: string}} [b] – forras: a ping forráscíme (ping … source)
 */
export function routerPing(h, r, cel, cb, { ttl, varakozas = ROUTER_PING_VARAKOZAS, forras = null } = {}) {
  const a = allapot(r);
  const v6 = cel.includes(':');
  const celNormal = v6 ? ipv6Normal(cel) : cel;
  if (v6 ? sajat6(r, celNormal, null) : sajat4(r, celNormal)) {
    return h.ora.utemez(1, () => cb({ fajta: 'valasz', kitol: celNormal, keses: 0 }));
  }
  const sorszam = a.sorszam++;
  let kesz = false;
  const vege = (e) => {
    if (kesz) return;
    kesz = true;
    a.varok.delete(sorszam);
    h.ora.lemond(idozito);
    cb(e);
  };
  const idozito = h.ora.utemez(varakozas, () => vege({ fajta: 'idotullepes' }));
  a.varok.set(sorszam, (v) => {
    if (v.tipus === 'echo-valasz') vege({ fajta: 'valasz', kitol: v.kitol, keses: v.keses });
    else if (v.tipus === 'ido-lejart') vege({ fajta: 'ido-lejart', kitol: v.kitol, keses: v.keses });
    else vege({ fajta: 'elerhetetlen', kitol: v.kitol, keses: v.keses });
  });
  if (v6) {
    routerKuld6(h, r, celNormal, { protokoll: 'icmpv6', icmp: { tipus: 'echo-keres', sorszam } }, { hop: ttl || 64, forras: forras || undefined });
  } else {
    routerKuld4(h, r, celNormal, { protokoll: 'icmp', icmp: { tipus: 'echo-keres', sorszam } }, { ttl: ttl || ROUTER_TTL, forrasIp: forras || undefined });
  }
  return idozito;
}

/** Az ARP- és ND-bejegyzések törlése egy portról (pl. a link leesésekor). */
export function szomszedTorol(r, portNev) {
  for (const t of [r.arpTabla, r.ndTabla]) {
    for (const k of Object.keys(t)) if (t[k].port === portNev) delete t[k];
  }
}

/** Egy IPv4-cím a port hálózatában van-e (pl. a RIP forrásellenőrzéséhez). */
export function portHalozataban(p, ip) {
  if (!p.ip) return false;
  const hl = prefixHossz(p.maszk);
  return halozatSzam(ipSzam(p.ip), hl) === halozatSzam(ipSzam(ip), hl);
}

export { ipv6EgyHalozat };
