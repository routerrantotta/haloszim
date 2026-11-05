/**
 * Router-eszközmodell: ISR 4331 jellegű router (IOS XE jellegű kimenetek).
 *
 * Portok: GigabitEthernet0/0/0–0/0/2 (beépített), Serial0/1/0–0/1/1 (kétportos soros modul az
 * 1-es foglalatban), és a tanuló által létrehozható Loopback interfészek.
 * A router portjai gyárilag LE vannak kapcsolva (shutdown) – ellentétben a switchével.
 *
 * Itt CSAK az állapot van, adatként. A működés: mag/router.js (továbbítás), mag/rip.js (RIP, RIPng),
 * mag/utvonal.js (a routing tábla összeállítása).
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
 */

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
    /** debug ip rip, debug ipv6 rip */
    debug: { rip: false, ripng: false },
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
