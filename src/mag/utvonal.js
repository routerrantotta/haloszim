/**
 * A router routing táblája (RIB), IPv4-re és IPv6-ra.
 *
 * A tábla nincs eltárolva: mindig az aktuális állapotból áll össze, így sosem „avul el”:
 *   C – közvetlenül kapcsolt hálózat (működő interfész + cím)
 *   L – a router saját címe (/32, IPv6-ban /128)
 *   S – statikus útvonal (ip route / ipv6 route), ha a következő ugrás elérhető
 *   R – RIP-ből (RIPng-ből) tanult útvonal (mag/rip.js adatbázisából)
 * Ugyanarra a hálózatra a kisebb adminisztratív távolságú (AD) forrás nyer:
 * kapcsolt 0, statikus 1, RIP 120.
 *
 * Továbbításkor a leghosszabb egyező előtag dönt; egyenlő költségű utaknál (ECMP) a router
 * csomagonként felváltva használja őket (a szimulátor egyszerűsítése – lásd a feladat magyarázatát).
 */

import { ipSzam, prefixHossz, halozatSzam, maszkSzam } from './ip.js';
import {
  ipv6Elemez, ipv6Halozat, ipv6EgyHalozat, ipv6Szoveg, ipv6PrefixElemez, eui64LinkLocal, linkLocalE,
} from './ipv6.js';
import { ripUtvonalak } from './rip.js';

/** Adminisztratív távolságok. */
export const AD = { C: 0, L: 0, S: 1, R: 120 };

/** Működik-e a port 3. rétegben (be van kapcsolva és él a link; a Loopback mindig, ha nincs leállítva). */
export function portFent(p) {
  if (p.leallitva) return false;
  return p.tipus === 'Loopback' ? true : !!p.fent;
}

/** Van-e IPv6 a porton (globális cím, kézi link-local vagy ipv6 enable). */
export function ipv6Engedelyezve(p) {
  return p.ipv6.length > 0 || !!p.linkLocal || p.ipv6Be;
}

/** A port link-local címe (kézi, vagy a MAC-ből számolt), tömbként; null, ha nincs IPv6 a porton. */
export function portLinkLocal(p) {
  if (!ipv6Engedelyezve(p)) return null;
  return p.linkLocal ? ipv6Elemez(p.linkLocal) : eui64LinkLocal(p.mac);
}

/** A port összes saját IPv6-címe (link-local + globálisak), tömbként. */
export function portIpv6Cimek(p) {
  const ll = portLinkLocal(p);
  if (!ll) return [];
  return [ll, ...p.ipv6.map((x) => ipv6Elemez(x.cim))];
}

// ---------------------------------------------------------------------------
// IPv4
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} Utvonal4
 * @property {'C'|'L'|'S'|'R'} kod
 * @property {number} halozat
 * @property {number} hossz
 * @property {number} ad
 * @property {number} metrika
 * @property {{kovetkezo: number|null, port: string|null, ido?: number}[]} utak
 * @property {boolean} [lehetLe]  – „possibly down” (RIP visszatartás): látszik, de nem használható
 * @property {boolean} [alap]     – alapértelmezett útvonal (0.0.0.0/0)
 */

/** Közvetlenül kapcsolt és helyi útvonalak. */
function kapcsolt4(r) {
  const t = [];
  for (const p of r.portok) {
    if (!p.ip || !portFent(p)) continue;
    const ip = ipSzam(p.ip);
    const hossz = prefixHossz(p.maszk);
    t.push({ kod: 'C', halozat: halozatSzam(ip, hossz), hossz, ad: 0, metrika: 0, utak: [{ kovetkezo: null, port: p.nev }] });
    if (hossz < 32) t.push({ kod: 'L', halozat: ip, hossz: 32, ad: 0, metrika: 0, utak: [{ kovetkezo: null, port: p.nev }] });
  }
  return t;
}

/** Melyik működő, kapcsolt hálózatban van a cím (a port neve), vagy null. */
export function kapcsoltPort4(r, ip) {
  for (const p of r.portok) {
    if (!p.ip || !portFent(p)) continue;
    const h = prefixHossz(p.maszk);
    if (halozatSzam(ipSzam(p.ip), h) === halozatSzam(ip, h)) return p.nev;
  }
  return null;
}

/** A statikus útvonalak, amelyek most használhatók. */
function statikus4(r, alap) {
  const t = [];
  for (const s of r.statikus) {
    const halozat = ipSzam(s.halozat);
    const hossz = prefixHossz(s.maszk);
    let ut = null;
    if (s.interfesz) {
      const p = r.portok.find((x) => x.nev === s.interfesz);
      if (p && portFent(p)) ut = { kovetkezo: s.kovetkezo ? ipSzam(s.kovetkezo) : null, port: p.nev };
    } else {
      // Rekurzív keresés: a következő ugrás elérhető-e (statikus útvonalak nélkül).
      const kov = ipSzam(s.kovetkezo);
      const talalt = legjobb4(alap, kov);
      if (talalt) ut = { kovetkezo: kov, port: null };
    }
    if (!ut) continue;
    let e = t.find((x) => x.halozat === halozat && x.hossz === hossz);
    if (!e) t.push((e = { kod: 'S', halozat, hossz, ad: 1, metrika: 0, utak: [] }));
    e.utak.push(ut);
  }
  return t;
}

/** A leghosszabb egyező előtag egy útvonallistában (a „possibly down” bejegyzések nélkül). */
function legjobb4(tabla, ip) {
  let jo = null;
  for (const e of tabla) {
    if (e.lehetLe) continue;
    if (halozatSzam(ip, e.hossz) !== e.halozat) continue;
    if (!jo || e.hossz > jo.hossz) jo = e;
  }
  return jo;
}

/**
 * A teljes IPv4 routing tábla (rendezve: cím, majd előtaghossz szerint).
 * @returns {Utvonal4[]}
 */
export function tabla4(r) {
  const kapcsolt = kapcsolt4(r);
  const rip = ripUtvonalak(r, 4).map((e) => ({
    kod: 'R', halozat: e.halozat, hossz: e.hossz, ad: AD.R, metrika: e.metrika, utak: e.utak, lehetLe: e.le,
  }));
  const statikus = statikus4(r, [...kapcsolt, ...rip]);
  // Előtagonként a legkisebb AD nyer.
  const nyertes = new Map();
  for (const e of [...kapcsolt, ...statikus, ...rip]) {
    const kulcs = `${e.halozat}/${e.hossz}/${e.kod === 'L' ? 'L' : ''}`;
    const regi = nyertes.get(kulcs);
    if (!regi || e.ad < regi.ad || (regi.lehetLe && !e.lehetLe)) nyertes.set(kulcs, e);
  }
  const t = [...nyertes.values()];
  for (const e of t) e.alap = e.hossz === 0;
  t.sort((a, b) => a.halozat - b.halozat || a.hossz - b.hossz);
  return t;
}

/** Egyenlő költségű utak közti váltogatáshoz: routerenként egy számláló. */
const ecmpSzamlalo = new WeakMap();
function utValaszt(r, e) {
  if (e.utak.length === 1) return e.utak[0];
  const n = ecmpSzamlalo.get(r) || 0;
  ecmpSzamlalo.set(r, n + 1);
  return e.utak[n % e.utak.length];
}

/**
 * Útvonal-keresés továbbításhoz: melyik porton, kinek (következő ugrás) kell küldeni.
 * @param {Object} r
 * @param {number} ip – a cél
 * @returns {{port: string, kovetkezo: number, bejegyzes: Utvonal4}|null}
 */
export function keres4(r, ip) {
  const t = tabla4(r);
  let e = legjobb4(t, ip);
  if (!e) return null;
  let ut = utValaszt(r, e);
  let kov = ut.kovetkezo;
  let port = ut.port;
  // Rekurzió: a következő ugráshoz vezető port (statikus útvonal következő ugrással).
  for (let i = 0; !port && i < 4; i++) {
    const e2 = legjobb4(t, kov);
    if (!e2) return null;
    const u2 = utValaszt(r, e2);
    port = u2.port;
    if (u2.kovetkezo !== null) kov = u2.kovetkezo;
  }
  if (!port) return null;
  return { port, kovetkezo: kov === null ? ip : kov, bejegyzes: e };
}

/** Az alapértelmezett átjáró (Gateway of last resort): a 0.0.0.0/0 első útja, vagy null. */
export function utolsoMenedek4(r) {
  const e = tabla4(r).find((x) => x.hossz === 0 && !x.lehetLe);
  return e || null;
}

// ---------------------------------------------------------------------------
// IPv6
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} Utvonal6
 * @property {'C'|'L'|'S'|'R'} kod
 * @property {number[]} halozat
 * @property {number} hossz
 * @property {number} ad
 * @property {number} metrika
 * @property {{kovetkezo: number[]|null, port: string|null}[]} utak
 */

function kapcsolt6(r) {
  const t = [];
  for (const p of r.portok) {
    if (!portFent(p)) continue;
    for (const c of p.ipv6) {
      const cim = ipv6Elemez(c.cim);
      t.push({ kod: 'C', halozat: ipv6Halozat(cim, c.hossz), hossz: c.hossz, ad: 0, metrika: 0, utak: [{ kovetkezo: null, port: p.nev }] });
      t.push({ kod: 'L', halozat: cim, hossz: 128, ad: 0, metrika: 0, utak: [{ kovetkezo: null, port: p.nev }] });
    }
  }
  return t;
}

function legjobb6(tabla, cim) {
  let jo = null;
  for (const e of tabla) {
    if (e.lehetLe) continue;
    if (!ipv6EgyHalozat(cim, e.halozat, e.hossz)) continue;
    if (!jo || e.hossz > jo.hossz) jo = e;
  }
  return jo;
}

function statikus6(r, alap) {
  const t = [];
  for (const s of r.statikus6) {
    const pr = ipv6PrefixElemez(s.prefix);
    let ut = null;
    const kov = s.kovetkezo ? ipv6Elemez(s.kovetkezo) : null;
    if (s.interfesz) {
      const p = r.portok.find((x) => x.nev === s.interfesz);
      if (p && portFent(p) && ipv6Engedelyezve(p)) ut = { kovetkezo: kov, port: p.nev };
    } else if (kov && !linkLocalE(kov)) {
      if (legjobb6(alap, kov)) ut = { kovetkezo: kov, port: null };
    }
    if (!ut) continue;
    const halozat = ipv6Halozat(pr.cim, pr.hossz);
    let e = t.find((x) => x.hossz === pr.hossz && ipv6EgyHalozat(x.halozat, halozat, 128));
    if (!e) t.push((e = { kod: 'S', halozat, hossz: pr.hossz, ad: 1, metrika: 0, utak: [] }));
    e.utak.push(ut);
  }
  return t;
}

/** A teljes IPv6 routing tábla. */
export function tabla6(r) {
  const kapcsolt = kapcsolt6(r);
  const rip = ripUtvonalak(r, 6).map((e) => ({
    kod: 'R', halozat: e.halozat, hossz: e.hossz, ad: AD.R, metrika: e.metrika, utak: e.utak, lehetLe: e.le,
  }));
  const statikus = statikus6(r, [...kapcsolt, ...rip]);
  const nyertes = new Map();
  for (const e of [...kapcsolt, ...statikus, ...rip]) {
    const kulcs = `${ipv6Szoveg(e.halozat)}/${e.hossz}`;
    const regi = nyertes.get(kulcs);
    if (!regi || e.ad < regi.ad) nyertes.set(kulcs, e);
  }
  const t = [...nyertes.values()];
  const cmp = (a, b) => {
    for (let i = 0; i < 8; i++) if (a.halozat[i] !== b.halozat[i]) return a.halozat[i] - b.halozat[i];
    return a.hossz - b.hossz;
  };
  t.sort(cmp);
  return t;
}

/** Útvonal-keresés IPv6-ra. */
export function keres6(r, cim) {
  const t = tabla6(r);
  const e = legjobb6(t, cim);
  if (!e) return null;
  let ut = utValaszt(r, e);
  let kov = ut.kovetkezo;
  let port = ut.port;
  for (let i = 0; !port && i < 4; i++) {
    const e2 = legjobb6(t, kov);
    if (!e2) return null;
    const u2 = utValaszt(r, e2);
    port = u2.port;
    if (u2.kovetkezo) kov = u2.kovetkezo;
  }
  if (!port) return null;
  return { port, kovetkezo: kov || cim, bejegyzes: e };
}

/** Egy szöveges „hálózat/hossz” keresése a táblában (az ellenőrzőnek és a bemutatónak). */
export function bejegyzes(r, szoveg) {
  const [h, l] = String(szoveg).split('/');
  const hossz = Number(l);
  if (h.includes(':')) {
    const c = ipv6Elemez(h);
    if (!c) return null;
    return tabla6(r).find((e) => e.hossz === hossz && ipv6EgyHalozat(e.halozat, c, 128)) || null;
  }
  const n = ipSzam(h);
  return tabla4(r).find((e) => e.hossz === hossz && e.halozat === halozatSzam(n, hossz) && e.kod !== 'L') || null;
}

export { maszkSzam };
