/**
 * RIP (IPv4, 1. és 2. verzió) és RIPng (IPv6) – távolságvektor-alapú forgalomirányítás.
 *
 * A router a szomszédainak hirdeti, milyen hálózatokat hány ugrásból ér el; a szomszédoktól
 * hallott hálózatokat egy adatbázisba gyűjti, és ebből kerül a legjobb (legkevesebb ugrású) út
 * a routing táblába (mag/utvonal.js). Ami itt meg van valósítva:
 *   - frissítés 30 másodpercenként (a teljes tábla), és változáskor azonnal (triggered update –
 *     ilyenkor csak a változott bejegyzések mennek ki),
 *   - kérés (request): ha egy interfészen elindul a RIP, vagy feljön a link, a router megkéri a
 *     szomszédokat, hogy küldjék el a táblájukat (így nem kell 30 másodpercet várni),
 *   - időzítők: invalid (180 s után „possibly down”), holddown (180 s), flush (240 s);
 *     RIPng-ben: lejárat 180 s, holddown nincs, törlés 120 s múlva,
 *   - split horizon: amit egy interfészen tanult, azt ott nem hirdeti vissza (és a kimenő
 *     interfész saját hálózatát sem hirdeti ki ugyanott),
 *   - route poisoning: ami eltűnt, azt egyszer még 16-os metrikával (elérhetetlen) hirdeti,
 *   - automatikus összegzés (auto-summary, RIPv2-ben gyárilag bekapcsolva; RIPv1-ben mindig):
 *     egy másik osztályos hálózat felé az alhálózatok helyett az osztályos hálózatot hirdeti,
 *   - passzív interfész: ott nem küld frissítést, de a hálózatát hirdeti,
 *   - default-information originate: alapértelmezett útvonal hirdetése (RIPng-ben interfészenként),
 *   - egyenlő költségű utak (legfeljebb 4).
 *
 * Metrika (Cisco-viselkedés): RIPv2-ben a router a kapcsolt hálózatot 1-gyel hirdeti, a fogadó
 * ezt veszi át, és továbbadáskor ad hozzá 1-et. RIPng-ben a fogadó ad hozzá 1-et a kapott
 * metrikához – ezért egy szomszédos LAN RIPv2-ben 1, RIPng-ben 2 a táblában.
 */

import { SZORAS } from './ethernet.js';
import { ipSzam, ipSzoveg, prefixHossz, halozatSzam, maszkSzoveg, osztalyos } from './ip.js';
import { ipv6Elemez, ipv6Szoveg, ipv6Halozat, linkLocalE, RIPNG_CSOPORT } from './ipv6.js';

// A körkörös importok miatt a router- és útvonal-függvényeket futás közben érjük el.
import * as utvonal from './utvonal.js';
import * as routerMag from './router.js';

/** Végtelen (elérhetetlen) metrika. */
export const VEGTELEN = 16;
/** Ennyi bejegyzés fér egy frissítő üzenetbe. */
export const UZENET_MERET = 25;
/** Egyenlő költségű utak legnagyobb száma. */
export const MAX_UT = 4;
/** RIPng időzítői (mp): frissítés, lejárat, holddown, törlés („garbage collect”). */
export const RIPNG_IDOZITOK = { frissites: 30, ervenytelen: 180, visszatartas: 0, torles: 120 };
/** A változás utáni („triggered”) frissítés késleltetése (ms) – a közeli változások egybe kerülnek. */
const VILLAM_KESES = 1000;

// ---------------------------------------------------------------------------
// Belső állapot (routerenként és címcsaládonként)
// ---------------------------------------------------------------------------

const belso = new WeakMap();
function ujCsaladAllapot() {
  return {
    /** kulcs → { halozat, hossz, metrika, utak: [{kovetkezo, port, ido}], le, leKezd, utolsoJo, eloMetrika } */
    db: new Map(),
    /** port neve → Map(kulcs → metrika): amit legutóbb ott hirdetett (a poisoninghoz és a változásokhoz) */
    hirdetett: new Map(),
    /** szomszéd címe → utolsó frissítés ideje */
    forrasok: new Map(),
    kovetkezo: null,
    villam: null,
    periodikus: 0,
    valtozasra: 0,
  };
}
function all(r, csalad) {
  let a = belso.get(r);
  if (!a) belso.set(r, (a = { 4: ujCsaladAllapot(), 6: ujCsaladAllapot() }));
  return a[csalad];
}

function most(r) {
  return r.halozat ? r.halozat.ora.ido : 0;
}

function naplo(r, ...sorok) {
  if (!r.halozat) return;
  for (const s of sorok) r.halozat.naplo(r, s);
}

/** Az időzítők ms-ban. */
function idozitok(r, csalad) {
  const t = csalad === 4 ? (r.rip ? r.rip.idozitok : { frissites: 30, ervenytelen: 180, visszatartas: 180, torles: 240 }) : RIPNG_IDOZITOK;
  return { frissites: t.frissites * 1000, ervenytelen: t.ervenytelen * 1000, visszatartas: t.visszatartas * 1000, torles: t.torles * 1000 };
}

// ---------------------------------------------------------------------------
// Melyik interfészen fut?
// ---------------------------------------------------------------------------

/** Az IPv4-RIP fut-e ezen a porton (van network parancs a port osztályos hálózatára). */
export function ripPorton4(r, p) {
  if (!r.rip || !p.ip) return false;
  const o = osztalyos(ipSzam(p.ip)).halozat;
  return r.rip.halozatok.some((n) => ipSzam(n) === o);
}

/** A RIPng fut-e ezen a porton (és a router továbbít-e IPv6-ot). */
export function ripPorton6(r, p) {
  return !!(r.ipv6Routing && p.ripng && r.ripng[p.ripng] && utvonal.ipv6Engedelyezve(p));
}

function porton(r, p, csalad) {
  return csalad === 4 ? ripPorton4(r, p) : ripPorton6(r, p);
}

/** Küldhet-e frissítést ezen a porton (fut rajta, működik, és nem passzív). */
function kuldhet(r, p, csalad) {
  if (!porton(r, p, csalad) || !utvonal.portFent(p) || p.tipus === 'Loopback') return false;
  if (csalad === 4 && r.rip.passziv.includes(p.nev)) return false;
  return true;
}

/** A RIP-ben részt vevő interfészek (a show-parancsokhoz). */
export function ripPortok(r, csalad) {
  return r.portok.filter((p) => porton(r, p, csalad));
}

/** Fut-e az adott családban RIP a routeren. */
function aktiv(r, csalad) {
  return csalad === 4 ? !!r.rip : !!r.ipv6Routing && Object.keys(r.ripng).length > 0;
}

// ---------------------------------------------------------------------------
// Kulcsok és címek
// ---------------------------------------------------------------------------

function kulcs(csalad, halozat, hossz) {
  return csalad === 4 ? `${ipSzoveg(halozat)}/${hossz}` : `${ipv6Szoveg(halozat)}/${hossz}`;
}

function azonosSzomszed(csalad, a, b) {
  return csalad === 4 ? a === b : ipv6Szoveg(a) === ipv6Szoveg(b);
}

// ---------------------------------------------------------------------------
// Az adatbázis karbantartása
// ---------------------------------------------------------------------------

/** Egy bejegyzés „possibly down” állapotba kerül (RIPng-ben holddown nélkül). */
function leTesz(r, csalad, e) {
  e.le = true;
  e.leKezd = most(r);
  e.eloMetrika = e.metrika;
  e.metrika = VEGTELEN;
  e.utak = e.utak.length ? [e.utak[0]] : e.utak;
}

/**
 * Egy szomszédtól kapott útvonal feldolgozása. Igazat ad, ha változott valami.
 * @param {{kovetkezo: number|number[], port: string, metrika: number}} u
 */
function frissit(r, csalad, halozat, hossz, u) {
  const a = all(r, csalad);
  const k = kulcs(csalad, halozat, hossz);
  const t = idozitok(r, csalad);
  const ido = most(r);
  let e = a.db.get(k);
  const ut = { kovetkezo: u.kovetkezo, port: u.port, ido };

  if (u.metrika >= VEGTELEN) {
    if (!e || e.le) return false;
    const i = e.utak.findIndex((x) => x.port === u.port && azonosSzomszed(csalad, x.kovetkezo, u.kovetkezo));
    if (i < 0) return false;
    if (e.utak.length > 1) {
      e.utak.splice(i, 1);
      return true;
    }
    leTesz(r, csalad, e);
    return true;
  }

  if (!e) {
    a.db.set(k, { halozat, hossz, metrika: u.metrika, utak: [ut], le: false, utolsoJo: ido });
    return true;
  }
  if (e.le) {
    // Visszatartás (holddown): a kiesett útvonalról rosszabb hírt nem fogad el.
    if (ido < e.leKezd + t.visszatartas && u.metrika > e.eloMetrika) return false;
    Object.assign(e, { le: false, metrika: u.metrika, utak: [ut], utolsoJo: ido });
    return true;
  }
  const i = e.utak.findIndex((x) => x.port === u.port && azonosSzomszed(csalad, x.kovetkezo, u.kovetkezo));
  if (i >= 0) {
    e.utak[i].ido = ido;
    e.utolsoJo = ido;
    if (u.metrika === e.metrika) return false;
    if (u.metrika < e.metrika) {
      e.metrika = u.metrika;
      e.utak = [e.utak[i]];
      return true;
    }
    // Ugyanattól a szomszédtól rosszabb hír jött: elfogadja (ő a következő ugrás).
    if (e.utak.length > 1) e.utak.splice(i, 1);
    else e.metrika = u.metrika;
    return true;
  }
  if (u.metrika < e.metrika) {
    Object.assign(e, { metrika: u.metrika, utak: [ut], utolsoJo: ido });
    return true;
  }
  if (u.metrika === e.metrika && e.utak.length < MAX_UT) {
    e.utak.push(ut);
    e.utolsoJo = ido;
    return true;
  }
  return false;
}

/** Lejárt útvonalak kezelése (invalid → possibly down → flush). Igazat ad, ha változott valami. */
function oregit(r, csalad) {
  const a = all(r, csalad);
  const t = idozitok(r, csalad);
  const ido = most(r);
  let valtozott = false;
  for (const [k, e] of a.db) {
    if (e.le) {
      const torles = csalad === 4 ? e.utolsoJo + t.torles : e.leKezd + t.torles;
      if (ido >= Math.max(torles, e.leKezd + 1)) a.db.delete(k);
      continue;
    }
    const maradt = e.utak.filter((u) => ido - u.ido < t.ervenytelen);
    if (maradt.length === e.utak.length) continue;
    valtozott = true;
    if (maradt.length) e.utak = maradt;
    else leTesz(r, csalad, e);
  }
  return valtozott;
}

// ---------------------------------------------------------------------------
// Mit hirdet a router egy interfészen?
// ---------------------------------------------------------------------------

/** A RIP-ben részt vevő kapcsolt hálózatok: [{halozat, hossz, port}] */
function kapcsoltak(r, csalad) {
  const l = [];
  for (const p of r.portok) {
    if (!porton(r, p, csalad) || !utvonal.portFent(p)) continue;
    if (csalad === 4) {
      const h = prefixHossz(p.maszk);
      l.push({ halozat: halozatSzam(ipSzam(p.ip), h), hossz: h, port: p.nev });
    } else {
      for (const c of p.ipv6) l.push({ halozat: ipv6Halozat(ipv6Elemez(c.cim), c.hossz), hossz: c.hossz, port: p.nev });
    }
  }
  return l;
}

/**
 * A porton kiküldendő bejegyzések (kulcs → {halozat, hossz, metrika}), a split horizon és az
 * összegzés után.
 */
function hirdetes(r, csalad, p) {
  const ki = new Map();
  const tesz = (halozat, hossz, metrika) => {
    const k = kulcs(csalad, halozat, hossz);
    const regi = ki.get(k);
    if (!regi || metrika < regi.metrika) ki.set(k, { halozat, hossz, metrika });
  };
  const alap = csalad === 4 ? r.rip.alapUtvonal : p.ripngAlap;
  const nulla = csalad === 4 ? 0 : [0, 0, 0, 0, 0, 0, 0, 0];
  if (csalad === 6 && alap === 'only') {
    tesz(nulla, 0, 1);
    return ki;
  }

  // Kapcsolt hálózatok (a kimenő interfész saját hálózata nélkül)
  const kapcs = kapcsoltak(r, csalad);
  const kapcsKulcs = new Set(kapcs.map((c) => kulcs(csalad, c.halozat, c.hossz)));
  for (const c of kapcs) if (c.port !== p.nev) tesz(c.halozat, c.hossz, 1);

  // Tanult útvonalak (split horizon: amit ezen a porton tanult, azt itt nem hirdeti)
  const rib = csalad === 4 ? utvonal.tabla4(r) : utvonal.tabla6(r);
  const ribKod = new Map(rib.filter((e) => e.kod !== 'L').map((e) => [kulcs(csalad, e.halozat, e.hossz), e.kod]));
  for (const [k, e] of all(r, csalad).db) {
    if (kapcsKulcs.has(k)) continue;
    if (!e.le && ribKod.get(k) !== 'R') continue;
    if (e.utak.some((u) => u.port === p.nev)) continue;
    const m = e.le ? VEGTELEN : Math.min(VEGTELEN, e.metrika + (csalad === 4 ? 1 : 0));
    tesz(e.halozat, e.hossz, m);
  }

  if (alap) tesz(nulla, 0, 1);

  // Automatikus összegzés az osztályhatáron (IPv4; RIPv1-ben mindig)
  if (csalad === 4 && (r.rip.autoSummary || r.rip.verzio !== 2)) {
    const sajat = osztalyos(ipSzam(p.ip));
    const v1 = r.rip.verzio !== 2;
    const osszegzett = new Map();
    for (const [k, e] of ki) {
      if (e.hossz === 0) {
        osszegzett.set(k, e);
        continue;
      }
      const o = osztalyos(e.halozat);
      if (o.halozat !== sajat.halozat) {
        if (e.hossz < o.hossz) continue; // összefoglalónál nagyobb hálózat: nem foglalkozunk vele
        const ok = kulcs(4, o.halozat, o.hossz);
        const regi = osszegzett.get(ok);
        // Egy elérhető alhálózat elég ahhoz, hogy az összegzés elérhető legyen.
        if (!regi || e.metrika < regi.metrika) osszegzett.set(ok, { halozat: o.halozat, hossz: o.hossz, metrika: e.metrika });
      } else if (!v1 || e.hossz === prefixHossz(p.maszk) || e.hossz === 32) {
        osszegzett.set(k, e);
      }
    }
    return osszegzett;
  }
  return ki;
}

// ---------------------------------------------------------------------------
// Küldés
// ---------------------------------------------------------------------------

function kuldVerzio(r) {
  return r.rip && r.rip.verzio === 2 ? 2 : 1;
}

/** Egy RIP-üzenet (IPv4) kiküldése a porton – több darabban, ha sok a bejegyzés. */
function csomagKuld4(r, p, bejegyzesek, parancs = 'valasz') {
  const h = r.halozat;
  const v = kuldVerzio(r);
  const celIp = v === 2 ? '224.0.0.9' : '255.255.255.255';
  const celMac = v === 2 ? '01005e000009' : SZORAS;
  const lista = bejegyzesek.map((e) => ({
    halozat: ipSzoveg(e.halozat), maszk: v === 2 ? maszkSzoveg(e.hossz) : null, kovetkezo: '0.0.0.0', metrika: e.metrika,
  }));
  if (r.debug.rip) {
    if (parancs === 'keres') naplo(r, `RIP: sending request on ${p.nev} to ${celIp}`);
    else {
      naplo(r, `RIP: sending v${v} update to ${celIp} via ${p.nev} (${p.ip})`, 'RIP: build update entries');
      for (const e of lista) {
        naplo(r, v === 2 ? `      ${e.halozat}/${prefixHossz(e.maszk)} via 0.0.0.0, metric ${e.metrika}, tag 0` : `      network ${e.halozat} metric ${e.metrika}`);
      }
    }
  }
  const darabok = parancs === 'keres' ? [[]] : [];
  for (let i = 0; i < lista.length; i += UZENET_MERET) darabok.push(lista.slice(i, i + UZENET_MERET));
  for (const d of darabok) {
    routerMag.keretKuld(h, r, p, celMac, 'ipv4', {
      forrasIp: p.ip, celIp, ttl: 2, protokoll: 'udp', keses: 0,
      udp: { port: 520, adat: { parancs, verzio: v, bejegyzesek: d } },
    });
  }
}

/** Egy RIPng-üzenet kiküldése a porton (forrás: a port link-local címe, cél: FF02::9). */
function csomagKuld6(r, p, bejegyzesek, parancs = 'valasz') {
  const h = r.halozat;
  const forras = ipv6Szoveg(utvonal.portLinkLocal(p));
  const lista = bejegyzesek.map((e) => ({ prefix: ipv6Szoveg(e.halozat), hossz: e.hossz, metrika: e.metrika }));
  if (r.debug.ripng) {
    if (parancs === 'keres') {
      naplo(r, `RIPng: Sending multicast request on ${p.nev} for ${p.ripng}`, `       src=${forras}`, `       dst=FF02::9 (${p.nev})`);
    } else {
      naplo(r, `RIPng: Sending multicast update on ${p.nev} for ${p.ripng}`, `       src=${forras}`, `       dst=FF02::9 (${p.nev})`,
        `       sport=521, dport=521, length=${4 + 20 * lista.length}`, `       command=2, version=1, mbz=0, #rte=${lista.length}`);
      for (const e of lista) naplo(r, `       tag=0, metric=${e.metrika}, prefix=${e.prefix}/${e.hossz}`);
    }
  }
  const darabok = parancs === 'keres' ? [[]] : [];
  for (let i = 0; i < lista.length; i += UZENET_MERET) darabok.push(lista.slice(i, i + UZENET_MERET));
  for (const d of darabok) {
    routerMag.keretKuld(h, r, p, '333300000009', 'ipv6', {
      forras, cel: ipv6Szoveg(RIPNG_CSOPORT), hop: 255, protokoll: 'udp', keses: 0,
      udp: { port: 521, adat: { parancs, folyamat: p.ripng, bejegyzesek: d } },
    });
  }
}

function csomagKuld(r, p, csalad, bejegyzesek, parancs) {
  if (csalad === 4) csomagKuld4(r, p, bejegyzesek, parancs);
  else csomagKuld6(r, p, bejegyzesek, parancs);
}

/**
 * Frissítés egy porton.
 * @param {boolean} teljes – periodikus (teljes tábla) vagy változás miatti (csak a változások)
 */
function frissitesKuld(r, csalad, p, teljes) {
  const a = all(r, csalad);
  const uj = hirdetes(r, csalad, p);
  const regi = a.hirdetett.get(p.nev) || new Map();
  const kimegy = [];
  for (const [k, e] of uj) if (teljes || regi.get(k) !== e.metrika) kimegy.push(e);
  // Ami eddig ment, de most már nincs: még egyszer kihirdeti 16-os metrikával (route poisoning).
  for (const [k, m] of regi) {
    if (uj.has(k) || m >= VEGTELEN) continue;
    const [h, l] = k.split('/');
    kimegy.push({ halozat: csalad === 4 ? ipSzam(h) : ipv6Elemez(h), hossz: Number(l), metrika: VEGTELEN });
  }
  const tarol = new Map();
  for (const [k, e] of uj) if (e.metrika < VEGTELEN) tarol.set(k, e.metrika);
  a.hirdetett.set(p.nev, tarol);
  if (kimegy.length) csomagKuld(r, p, csalad, kimegy, 'valasz');
}

/** Periodikus frissítés minden portra. */
function periodikus(r, csalad) {
  const a = all(r, csalad);
  a.periodikus++;
  for (const p of r.portok) if (kuldhet(r, p, csalad)) frissitesKuld(r, csalad, p, true);
}

/** Változás miatti frissítés ütemezése (a közeli változások egy üzenetbe kerülnek). */
function villamUtemez(r, csalad) {
  const a = all(r, csalad);
  if (!r.halozat || a.villam) return;
  a.villam = r.halozat.ora.utemez(VILLAM_KESES, () => {
    a.villam = null;
    if (!aktiv(r, csalad)) return;
    a.valtozasra++;
    for (const p of r.portok) if (kuldhet(r, p, csalad)) frissitesKuld(r, csalad, p, false);
  });
}

/** Kérés küldése: a szomszédok küldjék el a teljes táblájukat. */
function keresKuld(r, csalad, csakPort) {
  for (const p of r.portok) {
    if (csakPort && p !== csakPort) continue;
    if (kuldhet(r, p, csalad)) csomagKuld(r, p, csalad, [], 'keres');
  }
}

// ---------------------------------------------------------------------------
// Fogadás
// ---------------------------------------------------------------------------

/** RIP-üzenet (UDP 520) érkezett. */
export function ripFogad4(h, r, p, cs) {
  if (!ripPorton4(r, p)) return;
  const u = cs.udp.adat;
  if (!routerMag.portHalozataban(p, cs.forrasIp)) {
    if (r.debug.rip) naplo(r, `RIP: ignored v${u.verzio} update from bad source ${cs.forrasIp} on ${p.nev}`);
    return;
  }
  const fogad = r.rip.verzio === 2 ? [2] : r.rip.verzio === 1 ? [1] : [1, 2];
  if (!fogad.includes(u.verzio)) {
    if (r.debug.rip) naplo(r, `RIP: ignored v${u.verzio} packet from ${cs.forrasIp} (illegal version)`);
    return;
  }
  if (u.parancs === 'keres') {
    if (r.debug.rip) naplo(r, `RIP: received v${u.verzio} request from ${cs.forrasIp} on ${p.nev}`);
    if (kuldhet(r, p, 4)) frissitesKuld(r, 4, p, true);
    return;
  }
  const a = all(r, 4);
  a.forrasok.set(cs.forrasIp, most(r));
  if (r.debug.rip) {
    naplo(r, `RIP: received v${u.verzio} update from ${cs.forrasIp} on ${p.nev}`);
    for (const e of u.bejegyzesek) {
      naplo(r, e.maszk ? `     ${e.halozat}/${prefixHossz(e.maszk)} via ${e.kovetkezo} in ${e.metrika} hops` : `     ${e.halozat} in ${e.metrika} hops`);
    }
  }
  let valtozott = false;
  const sajat = osztalyos(ipSzam(p.ip));
  for (const e of u.bejegyzesek) {
    if (e.metrika < 1 || e.metrika > VEGTELEN) continue;
    const n = ipSzam(e.halozat);
    let hossz;
    if (e.maszk) hossz = prefixHossz(e.maszk);
    else if (n === 0) hossz = 0;
    else if (osztalyos(n).halozat === sajat.halozat) hossz = halozatSzam(n, prefixHossz(p.maszk)) === n ? prefixHossz(p.maszk) : 32;
    else hossz = osztalyos(n).hossz;
    if (frissit(r, 4, halozatSzam(n, hossz), hossz, { kovetkezo: ipSzam(cs.forrasIp), port: p.nev, metrika: e.metrika })) valtozott = true;
  }
  if (valtozott) {
    valtozas(r);
    villamUtemez(r, 4);
  }
}

/** RIPng-üzenet (UDP 521) érkezett. */
export function ripFogad6(h, r, p, cs) {
  if (!ripPorton6(r, p)) return;
  const u = cs.udp.adat;
  if (!linkLocalE(ipv6Elemez(cs.forras))) return; // a RIPng csak link-local forrást fogad el
  if (u.parancs === 'keres') {
    if (r.debug.ripng) naplo(r, `RIPng: request received from ${cs.forras} on ${p.nev} for ${p.ripng}`);
    if (kuldhet(r, p, 6)) frissitesKuld(r, 6, p, true);
    return;
  }
  const a = all(r, 6);
  a.forrasok.set(cs.forras, most(r));
  if (r.debug.ripng) {
    naplo(r, `RIPng: response received from ${cs.forras} on ${p.nev} for ${p.ripng}`, `       src=${cs.forras} (${p.nev})`, '       dst=FF02::9',
      `       sport=521, dport=521, length=${4 + 20 * u.bejegyzesek.length}`, `       command=2, version=1, mbz=0, #rte=${u.bejegyzesek.length}`);
    for (const e of u.bejegyzesek) naplo(r, `       tag=0, metric=${e.metrika}, prefix=${e.prefix}/${e.hossz}`);
  }
  let valtozott = false;
  for (const e of u.bejegyzesek) {
    if (e.metrika < 1 || e.metrika > VEGTELEN) continue;
    const m = Math.min(VEGTELEN, e.metrika + 1);
    const hal = ipv6Halozat(ipv6Elemez(e.prefix), e.hossz);
    if (frissit(r, 6, hal, e.hossz, { kovetkezo: ipv6Elemez(cs.forras), port: p.nev, metrika: m })) valtozott = true;
  }
  if (valtozott) {
    valtozas(r);
    villamUtemez(r, 6);
  }
}

function valtozas(r) {
  if (r.halozat) r.halozat.esemeny({ tipus: 'allapot' });
}

// ---------------------------------------------------------------------------
// Kívülről hívott események
// ---------------------------------------------------------------------------

/**
 * Változott a router beállítása (network, version, auto-summary, cím, ipv6 rip …): a router
 * kihirdeti a változást, és ha kell (új interfész a RIP-ben), kérést is küld.
 * @param {{keres?: boolean, csalad?: 4|6}} [b]
 */
export function ripValtozott(r, { keres = false, csalad } = {}) {
  if (!r.halozat) return;
  for (const c of csalad ? [csalad] : [4, 6]) {
    if (!aktiv(r, c)) {
      all(r, c).db.clear();
      all(r, c).hirdetett.clear();
      continue;
    }
    // Ha egy port kikerült a RIP-ből, az onnan tanult útvonalak is mennek.
    const a = all(r, c);
    for (const [k, e] of a.db) {
      e.utak = e.utak.filter((u) => {
        const p = r.portok.find((x) => x.nev === u.port);
        return p && porton(r, p, c);
      });
      if (!e.utak.length) a.db.delete(k);
    }
    for (const nev of [...a.hirdetett.keys()]) {
      const p = r.portok.find((x) => x.nev === nev);
      if (!p || !kuldhet(r, p, c)) a.hirdetett.delete(nev);
    }
    if (keres) keresKuld(r, c);
    villamUtemez(r, c);
  }
  valtozas(r);
}

/** Egy port feljött vagy leesett: az onnan tanult útvonalak azonnal törlődnek, feljövéskor kérés megy ki. */
export function ripPortValtozott(h, r, p) {
  for (const c of [4, 6]) {
    if (!aktiv(r, c)) continue;
    const a = all(r, c);
    if (!utvonal.portFent(p)) {
      for (const [k, e] of a.db) {
        e.utak = e.utak.filter((u) => u.port !== p.nev);
        if (!e.utak.length) a.db.delete(k);
      }
      a.hirdetett.delete(p.nev);
    } else {
      keresKuld(r, c, p);
    }
    villamUtemez(r, c);
  }
}

/** clear ip route *: a tanult útvonalak törlése, és kérés a szomszédoknak. */
export function ripTorol(r) {
  if (!aktiv(r, 4)) return;
  const a = all(r, 4);
  a.db.clear();
  a.hirdetett.clear();
  keresKuld(r, 4);
  valtozas(r);
}

/**
 * A periodikus működés elindítása a hálózatban (másodpercenként ellenőriz: lejárt útvonalak,
 * esedékes 30 másodperces frissítések). Csak akkor fut, ha van router a hálózatban.
 * @param {import('./halozat.js').Halozat} h
 */
export function ripIndit(h) {
  const routerek = h.eszkozok.filter((e) => e.tipus === 'router');
  if (!routerek.length) return;
  const lep = () => {
    routerek.forEach((r, i) => {
      for (const c of [4, 6]) {
        const a = all(r, c);
        if (!aktiv(r, c)) {
          a.kovetkezo = null;
          continue;
        }
        if (oregit(r, c)) {
          valtozas(r);
          villamUtemez(r, c);
        }
        const t = idozitok(r, c);
        // Az első frissítés routerenként eltolva (a valódi routerek sem egyszerre küldenek).
        if (a.kovetkezo === null) a.kovetkezo = h.ora.ido + 5000 + ((i * 7000 + (c === 6 ? 3000 : 0)) % t.frissites);
        if (h.ora.ido >= a.kovetkezo) {
          a.kovetkezo = h.ora.ido + t.frissites;
          periodikus(r, c);
        }
      }
    });
    h.ora.utemez(1000, lep);
  };
  h.ora.utemez(1000, lep);
}

// ---------------------------------------------------------------------------
// Lekérdezések (routing tábla, show-parancsok, ellenőrzés)
// ---------------------------------------------------------------------------

/**
 * A RIP-ből a routing táblába kerülő útvonalak.
 * @returns {{halozat, hossz, metrika, utak: {kovetkezo, port, ido}[], le: boolean}[]}
 */
export function ripUtvonalak(r, csalad) {
  if (!aktiv(r, csalad)) return [];
  return [...all(r, csalad).db.values()].map((e) => ({ ...e, utak: e.utak.map((u) => ({ ...u })) }));
}

/** Az adatbázis (show ip rip database / show ipv6 rip database). */
export function ripAdatbazis(r, csalad) {
  if (!aktiv(r, csalad)) return { kapcsolt: [], tanult: [] };
  return {
    kapcsolt: kapcsoltak(r, csalad),
    tanult: ripUtvonalak(r, csalad),
  };
}

/** A szomszédok (Routing Information Sources): [{cim, ido}] */
export function ripForrasok(r, csalad) {
  return [...all(r, csalad).forrasok.entries()].map(([cim, ido]) => ({ cim, ido }));
}

/** Hány mp múlva jön a következő periodikus frissítés (vagy null). */
export function ripKovetkezo(r, csalad) {
  const a = all(r, csalad);
  if (a.kovetkezo === null) return null;
  return Math.max(0, Math.ceil((a.kovetkezo - most(r)) / 1000));
}

/** Számlálók (show ipv6 rip): periodikus és változás miatti frissítések száma. */
export function ripSzamlalok(r, csalad) {
  const a = all(r, csalad);
  return { periodikus: a.periodikus, valtozasra: a.valtozasra };
}

export { maszkSzoveg };
