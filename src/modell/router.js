/**
 * Router-eszközmodell: ISR 4331 jellegű router (IOS XE jellegű kimenetek).
 *
 * Portok: GigabitEthernet0/0/0–0/0/2 (beépített), Serial0/1/0–0/1/1 (kétportos soros modul az
 * 1-es foglalatban), és a tanuló által létrehozható Loopback interfészek.
 * A router portjai gyárilag LE vannak kapcsolva (shutdown) – ellentétben a switchével.
 *
 * Itt CSAK az állapot van, adatként. A működés: mag/router.js (továbbítás), mag/rip.js (RIP, RIPng),
 * mag/ospf.js (OSPFv2, OSPFv3), mag/utvonal.js (a routing tábla összeállítása).
 */

import { macNevbol } from '../mag/ethernet.js';

/** Az alapértelmezett gépnév. */
export const ALAP_ROUTER_HOSTNAME = 'Router';

/** Rövid portnév-előtagok. */
export const ROUTER_ROVID = { GigabitEthernet: 'Gi', Serial: 'Se', Loopback: 'Lo' };

/** A létrehozható Loopback-számok (a parancssor ennyit fogad el). */
export const LOOPBACK_MAX = 99;

/**
 * @typedef {Object} RouterPort
 * @property {string} nev, rovid, tipus, szam
 * @property {boolean} leallitva   – shutdown (gyárilag igaz; Loopback-nél hamis)
 * @property {boolean} fent        – üzemi állapot (a mag állítja)
 * @property {string} mac          – a port saját MAC-címe
 * @property {string} ip, maszk    – IPv4-cím ('' = nincs)
 * @property {{cim: string, hossz: number}[]} ipv6 – globális IPv6-címek (normál alakban)
 * @property {string} linkLocal    – kézzel beállított link-local cím ('' = automatikus, EUI-64)
 * @property {boolean} ipv6Be      – „ipv6 enable” (link-local cím globális cím nélkül)
 * @property {string} ripng        – melyik RIPng-folyamat fut rajta ('' = egyik sem)
 * @property {''|'originate'|'only'} ripngAlap – alapértelmezett útvonal hirdetése RIPng-ben
 * @property {number} [savszel]    – bandwidth (kbit/s), ha kézzel állították
 * @property {number} [orajel]     – clock rate (soros porton)
 * @property {number} [keses]      – delay (µs), ha kézzel állították (a „delay” parancs × 10)
 * @property {number|null} eigrp6  – melyik EIGRP-folyamat (AS) fut rajta IPv6-on (null = egyik sem)
 * @property {OspfPort} ospf       – az interfész OSPFv2-beállításai (ip ospf …)
 * @property {OspfPort} ospf6      – az interfész OSPFv3-beállításai (ipv6 ospf …)
 * @property {number|null} mtu     – ip mtu (null = alapérték)
 * @property {number|null} mtu6    – ipv6 mtu (null = alapérték)
 * @property {string} leiras       – description
 */

/**
 * Az interfész OSPF-beállításai (null = alapérték).
 * @typedef {Object} OspfPort
 * @property {number|null} folyamat, terulet – ip ospf <folyamat> area <terület> (közvetlen bekapcsolás)
 * @property {number|null} koltseg           – ip ospf cost
 * @property {number} prioritas              – ip ospf priority (alapból 1)
 * @property {''|'point-to-point'|'broadcast'} halozatTipus – ip ospf network
 * @property {number|null} hello, dead       – ip ospf hello-interval / dead-interval
 * @property {''|'null'|'egyszeru'|'md5'} hitelesites – ip ospf authentication [message-digest|null]
 * @property {Object<number, string>} kulcsok – ip ospf message-digest-key <n> md5 <jelszó>
 * @property {string} jelszo                 – ip ospf authentication-key (egyszerű jelszó)
 */

/** Új, gyári OSPF-interfészbeállítás. */
export function ujOspfPort() {
  return { folyamat: null, terulet: null, koltseg: null, prioritas: 1, halozatTipus: '', hello: null, dead: null, hitelesites: '', kulcsok: {}, jelszo: '' };
}

function ujPort(hostname, tipus, szam) {
  return {
    nev: tipus + szam,
    rovid: ROUTER_ROVID[tipus] + szam,
    tipus,
    szam,
    leallitva: tipus !== 'Loopback',
    fent: false,
    mac: macNevbol(`router:${hostname}:${tipus}${szam}`),
    ip: '',
    maszk: '',
    ipv6: [],
    linkLocal: '',
    ipv6Be: false,
    ripng: '',
    ripngAlap: '',
    eigrp6: null,
    ospf: ujOspfPort(),
    ospf6: ujOspfPort(),
    mtu: null,
    mtu6: null,
    leiras: '',
  };
}

/**
 * @typedef {Object} RipBeallitas
 * @property {number|null} verzio   – null = nincs megadva (v1-et küld, v1-et és v2-t fogad)
 * @property {string[]} halozatok   – a network parancsok (osztályos hálózatcímek)
 * @property {string[]} passziv     – passzív interfészek (teljes név)
 * @property {boolean} autoSummary  – automatikus összegzés (gyárilag be)
 * @property {boolean} alapUtvonal  – default-information originate
 * @property {{frissites: number, ervenytelen: number, visszatartas: number, torles: number}} idozitok – mp
 */

/** Új RIP-beállítás a gyári értékekkel (router rip után). */
export function ujRip() {
  return {
    verzio: null,
    halozatok: [],
    passziv: [],
    autoSummary: true,
    alapUtvonal: false,
    idozitok: { frissites: 30, ervenytelen: 180, visszatartas: 180, torles: 240 },
  };
}

/**
 * @typedef {Object} OspfBeallitas – egy OSPF-folyamat (router ospf N / ipv6 router ospf N)
 * @property {number} folyamat       – a folyamat azonosítója (csak helyileg érvényes)
 * @property {string} routerId       – kézzel megadott router ID ('' = automatikus)
 * @property {{cim: string, wildcard: string, terulet: number}[]} halozatok – network … area … (csak OSPFv2)
 * @property {string[]} passziv      – passzív interfészek
 * @property {boolean} passzivAlap   – passive-interface default
 * @property {string[]} nemPassziv   – no passive-interface … (passive-interface default mellett)
 * @property {number} referencia     – auto-cost reference-bandwidth (Mbit/s, alapból 100)
 * @property {''|'originate'|'always'} alapUtvonal – default-information originate [always]
 * @property {number} maxUtak        – maximum-paths (alapból 4)
 */

/** Új OSPF-folyamat a gyári értékekkel. */
export function ujOspf(folyamat) {
  return { folyamat, routerId: '', halozatok: [], passziv: [], passzivAlap: false, nemPassziv: [], referencia: 100, alapUtvonal: '', maxUtak: 4 };
}

/**
 * @typedef {Object} EigrpBeallitas – egy EIGRP-folyamat (router eigrp AS / ipv6 router eigrp AS)
 * @property {number} as             – az autonóm rendszer száma (a szomszédokon ugyanennyi kell)
 * @property {string} routerId       – eigrp router-id ('' = automatikus)
 * @property {{cim: string, wildcard: string|null}[]} halozatok – network … [wildcard] (csak IPv4)
 * @property {string[]} passziv      – passzív interfészek
 * @property {boolean} passzivAlap   – passive-interface default
 * @property {string[]} nemPassziv   – no passive-interface … (passive-interface default mellett)
 * @property {boolean} autoSummary   – automatikus összevonás az osztályhatáron
 * @property {boolean} leallitva     – shutdown (az IPv6-folyamat gyárilag leállított állapotban indul)
 * @property {number} maxUtak        – maximum-paths (alapból 4)
 */

/**
 * Új EIGRP-folyamat a gyári értékekkel.
 * @param {number} as
 * @param {4|6} csalad – az IPv6-folyamat gyárilag leállított (kell rá a „no shutdown”)
 */
export function ujEigrp(as, csalad = 4) {
  return {
    as,
    routerId: '',
    halozatok: [],
    passziv: [],
    passzivAlap: false,
    nemPassziv: [],
    autoSummary: true,
    leallitva: csalad === 6,
    maxUtak: 4,
  };
}

/**
 * Új, gyári állapotú router.
 * @param {{hostname?: string}} [b]
 */
export function ujRouter4331(b = {}) {
  const hostname = b.hostname || ALAP_ROUTER_HOSTNAME;
  const portok = [];
  for (let i = 0; i <= 2; i++) portok.push(ujPort(hostname, 'GigabitEthernet', `0/0/${i}`));
  for (let i = 0; i <= 1; i++) portok.push(ujPort(hostname, 'Serial', `0/1/${i}`));
  return {
    tipus: 'router',
    modell: 'ISR4331',
    hostname,
    portok,
    /** IPv4 ARP-gyorstár: ip → { mac, port, ido } */
    arpTabla: {},
    /** IPv6-szomszédok (ND): cím (normál alak) → { mac, port, ido } */
    ndTabla: {},
    /** ip route: { halozat, maszk, kovetkezo?, interfesz? } (szövegként) */
    statikus: [],
    /** ipv6 route: { prefix: 'X::/n', kovetkezo?, interfesz? } */
    statikus6: [],
    ipv6Routing: false,
    /** @type {RipBeallitas|null} */
    rip: null,
    /** RIPng-folyamatok: név → {} (a beállítások az interfészeken vannak) */
    ripng: {},
    /** @type {OspfBeallitas|null} router ospf N */
    ospf: null,
    /** @type {OspfBeallitas|null} ipv6 router ospf N */
    ospf6: null,
    /** @type {EigrpBeallitas|null} router eigrp AS */
    eigrp: null,
    /** @type {EigrpBeallitas|null} ipv6 router eigrp AS */
    eigrp6: null,
    /** debug ip rip, debug ipv6 rip, debug ip|ipv6 ospf hello/adj, debug eigrp packets/neighbors, debug ip eigrp */
    debug: {
      rip: false, ripng: false, ospfHello: false, ospfAdj: false, ospf6Hello: false, ospf6Adj: false,
      eigrp: false, eigrpCsomag: false, eigrpSzomszed: false,
    },
  };
}

/** Port keresése teljes név szerint. */
export function routerPort(r, nev) {
  return r.portok.find((p) => p.nev === nev);
}

/** Loopback interfész létrehozása (ha még nincs), a portok listájának végére. */
export function loopbackLetrehoz(r, szam) {
  const nev = `Loopback${szam}`;
  let p = routerPort(r, nev);
  if (!p) {
    p = ujPort(r.hostname, 'Loopback', String(szam));
    p.fent = true;
    r.portok.push(p);
    r.portok.sort(portSorrend);
  }
  return p;
}

const TIPUS_SORREND = { GigabitEthernet: 0, Serial: 1, Loopback: 2 };
function portSorrend(a, b) {
  if (a.tipus !== b.tipus) return TIPUS_SORREND[a.tipus] - TIPUS_SORREND[b.tipus];
  const x = a.szam.split('/').map(Number);
  const y = b.szam.split('/').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  return 0;
}

/** A router porttípusai és számai a parancssornak (a Loopback-ből 0–99 írható be). */
export function routerPortTipusok(r) {
  const e = {};
  for (const p of r.portok) if (p.tipus !== 'Loopback') (e[p.tipus] = e[p.tipus] || []).push(p.szam);
  e.Loopback = [];
  for (let i = 0; i <= LOOPBACK_MAX; i++) e.Loopback.push(String(i));
  return e;
}
