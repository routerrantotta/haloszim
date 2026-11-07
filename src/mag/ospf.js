/**
 * OSPF – link-state (kapcsolatállapot-alapú) forgalomirányítás: OSPFv2 (IPv4) és OSPFv3 (IPv6).
 *
 * A két változat ugyanazzal a motorral működik; a különbségek (címek, LSA-típusok) a „csalad”
 * (4 vagy 6) szerint ágaznak el. Ami meg van valósítva:
 *   - Hello csomagok (224.0.0.5 / FF02::5) interfészenként, Hello- és Dead-időzítő; a Hellóban
 *     érkező adatok ellenőrzése (terület, időzítők, maszk, hitelesítés, azonos router ID),
 *   - szomszédsági állapotok: DOWN → INIT → 2WAY → EXSTART → EXCHANGE → LOADING → FULL,
 *     valódi DBD-, LSR-, LSU- és LSAck-csomagokkal; MTU-eltérésnél a szomszédság beragad,
 *   - hálózattípusok: broadcast (DR/BDR-választás, Wait-időzítő, a választás nem preemptív),
 *     point-to-point (soros vonal, vagy „ip ospf network point-to-point”), loopback,
 *   - LSA-k: Router (1), Network (2), AS External (5) – OSPFv3-ban Router, Network, Link,
 *     Intra-Area-Prefix és AS External; elárasztás (flooding), sorszámok, régi LSA-k törlése,
 *   - SPF (Dijkstra) a link-state adatbázisból, egyenlő költségű utak (alapból legfeljebb 4),
 *   - költség = referencia-sávszélesség ÷ interfész-sávszélesség (vagy kézi „ip ospf cost”),
 *   - passzív interfész, default-information originate [always] (O*E2 / OE2 útvonal),
 *   - hitelesítés (OSPFv2: egyszerű jelszó és MD5).
 * Egyszerűsítések: egy routeren családonként egy OSPF-folyamat; több terület között nincs
 * összegzés (ABR); az LSA-k nem öregszenek el (a szimulált idő rövid).
 */

import { ipSzam, ipSzoveg, prefixHossz, halozatSzam, maszkSzoveg } from './ip.js';
import { ipv6Elemez, ipv6Szoveg, ipv6Halozat } from './ipv6.js';

// A körkörös importok miatt a router- és útvonal-függvényeket futás közben érjük el.
import * as utvonal from './utvonal.js';
import * as routerMag from './router.js';

/** Adminisztratív távolság. */
export const OSPF_AD = 110;
/** Az első LSA-sorszám. */
export const ELSO_SORSZAM = 0x80000001;
/** Újraküldési időköz (ms): DBD, LSR, ha nem jön válasz. */
const RXMT = 5000;
/** Az SPF-számítás késleltetése egy változás után (ms). */
const SPF_KESES = 50;

const CSOPORT = {
  4: { minden: '224.0.0.5', dr: '224.0.0.6', mindenMac: '01005e000005', drMac: '01005e000006' },
  6: { minden: 'FF02::5', dr: 'FF02::6', mindenMac: '333300000005', drMac: '333300000006' },
};

/** A szomszédsági állapotok sorrendje. */
export const ALLAPOTOK = ['DOWN', 'INIT', '2WAY', 'EXSTART', 'EXCHANGE', 'LOADING', 'FULL'];
const SZINT = Object.fromEntries(ALLAPOTOK.map((a, i) => [a, i]));

// ---------------------------------------------------------------------------
// Beállítások elérése
// ---------------------------------------------------------------------------

/** A folyamat beállítása (router ospf / ipv6 router ospf), vagy null. */
export function ospfBeall(r, csalad) {
  return csalad === 4 ? r.ospf : r.ospf6;
}

function portBeall(p, csalad) {
  return csalad === 4 ? p.ospf : p.ospf6;
}

/** Az interfész alapértelmezett sávszélessége kbit/s-ban (IOS-alapértékek). */
export function savszelesseg(p) {
  if (p.savszel) return p.savszel;
  if (p.tipus === 'Serial') return 1544;
  if (p.tipus === 'Loopback') return 8000000;
  return 1000000;
}

/** Az interfész OSPF-költsége. */
export function koltseg(r, p, csalad) {
  const pb = portBeall(p, csalad);
  if (pb.koltseg) return pb.koltseg;
  const o = ospfBeall(r, csalad);
  const ref = o ? o.referencia : 100;
  return Math.max(1, Math.min(65535, Math.floor((ref * 1000) / savszelesseg(p))));
}

/** A tényleges hálózattípus: 'BROADCAST' | 'POINT_TO_POINT' | 'LOOPBACK'. */
export function halozatTipus(p, csalad) {
  if (p.tipus === 'Loopback') return 'LOOPBACK';
  const t = portBeall(p, csalad).halozatTipus;
  if (t === 'point-to-point') return 'POINT_TO_POINT';
  if (t === 'broadcast') return 'BROADCAST';
  return p.tipus === 'Serial' ? 'POINT_TO_POINT' : 'BROADCAST';
}

/** Hello- és Dead-időköz (mp). Ha csak a Hello van megadva, a Dead annak négyszerese. */
export function idokozok(p, csalad) {
  const pb = portBeall(p, csalad);
  const hello = pb.hello || 10;
  const dead = pb.dead || hello * 4;
  return { hello, dead };
}

function mtu(p, csalad) {
  return (csalad === 4 ? p.mtu : p.mtu6) || 1500;
}

/** Az interfész azonosítója (OSPFv3 Interface ID). */
export function interfeszAzon(r, p) {
  if (p.tipus === 'Loopback') return 20 + Number(p.szam);
  return r.portok.filter((x) => x.tipus !== 'Loopback').indexOf(p) + 1;
}

function popcount(n) {
  let c = 0;
  for (let x = n >>> 0; x; x >>>= 1) c += x & 1;
  return c;
}

/**
 * Melyik területen van az interfész az OSPF-ben (null = nincs benne).
 * OSPFv2: „ip ospf N area A” az interfészen, vagy a legpontosabban illő network parancs.
 * OSPFv3: „ipv6 ospf N area A” az interfészen.
 * @returns {{terulet: number, mod: 'network'|'interfesz'}|null}
 */
export function ospfTerulet(r, p, csalad) {
  const o = ospfBeall(r, csalad);
  if (!o) return null;
  const pb = portBeall(p, csalad);
  if (csalad === 6) {
    if (!r.ipv6Routing || !utvonal.ipv6Engedelyezve(p)) return null;
    if (pb.folyamat === o.folyamat && pb.terulet !== null) return { terulet: pb.terulet, mod: 'interfesz' };
    return null;
  }
  if (!p.ip) return null;
  if (pb.folyamat !== null) return pb.folyamat === o.folyamat ? { terulet: pb.terulet, mod: 'interfesz' } : null;
  const ip = ipSzam(p.ip);
  let jo = null;
  for (const n of o.halozatok) {
    const wc = ipSzam(n.wildcard);
    if (((ip & ~wc) >>> 0) !== ((ipSzam(n.cim) & ~wc) >>> 0)) continue;
    if (!jo || popcount(wc) < popcount(ipSzam(jo.wildcard))) jo = n;
  }
  return jo ? { terulet: jo.terulet, mod: 'network' } : null;
}

/** Passzív-e az interfész. */
export function passzivE(r, p, csalad) {
  const o = ospfBeall(r, csalad);
  if (!o) return false;
  if (o.passzivAlap) return !o.nemPassziv.includes(p.nev);
  return o.passziv.includes(p.nev);
}

// ---------------------------------------------------------------------------
// Belső állapot
// ---------------------------------------------------------------------------

const belso = new WeakMap();

function ujAllapot() {
  return {
    fut: false,
    rid: null,          // router ID (szövegesen)
    indulas: 0,
    nortrid: false,     // a „nem tudok router ID-t választani” üzenet már kiment
    /** port neve → interfész-állapot */
    ifek: new Map(),
    /** terület → Map(kulcs → LSA); a 'K' kulcs alatt a külső (AS External) LSA-k */
    lsdb: new Map(),
    /** saját LSA-k legutóbbi sorszámai (a folyamat újraindítása után is innen folytatja) */
    sorszamok: new Map(),
    utvonalak: [],
    utvonalIdo: new Map(),
    spf: null,
    spfSzam: 0,
    spfIdo: null,
    forrasok: new Map(), // rid → az utolsó változás ideje (show ip protocols)
    dupNaplo: new Map(),
  };
}

function all(r, csalad) {
  let a = belso.get(r);
  if (!a) belso.set(r, (a = { 4: ujAllapot(), 6: ujAllapot() }));
  return a[csalad];
}

function most(r) {
  return r.halozat ? r.halozat.ora.ido : 0;
}

function naplo(r, ...sorok) {
  if (!r.halozat) return;
  for (const s of sorok) r.halozat.naplo(r, s);
}

function valtozas(r) {
  if (r.halozat) r.halozat.esemeny({ tipus: 'allapot' });
}

function rovid(nev) {
  return nev.replace(/^GigabitEthernet/, 'Gi').replace(/^Serial/, 'Se').replace(/^Loopback/, 'Lo');
}

function dbgElo(r, csalad, fajta, p) {
  const o = ospfBeall(r, csalad);
  const fej = csalad === 4 ? `OSPF-${o ? o.folyamat : 1}` : `OSPFv3-${o ? o.folyamat : 1}-IPv6`;
  return `${fej} ${fajta.padEnd(5)} ${rovid(p.nev)}: `;
}

function dbgHello(r, csalad, p, szoveg) {
  if (csalad === 4 ? r.debug.ospfHello : r.debug.ospf6Hello) naplo(r, dbgElo(r, csalad, 'HELLO', p) + szoveg);
}

function dbgAdj(r, csalad, p, szoveg) {
  if (csalad === 4 ? r.debug.ospfAdj : r.debug.ospf6Adj) naplo(r, dbgElo(r, csalad, 'ADJ', p) + szoveg);
}

function adjNaplo(r, csalad, p, nbr, regi, uj, ok) {
  const o = ospfBeall(r, csalad);
  const fej = csalad === 4 ? `%OSPF-5-ADJCHG: Process ${o.folyamat}` : `%OSPFv3-5-ADJCHG: Process ${o.folyamat}`;
  naplo(r, `${fej}, Nbr ${nbr.rid} on ${p.nev} from ${regi} to ${uj}, ${ok}`);
}

/** A router saját címe az interfészen (v2: IPv4, v3: link-local). */
function sajatCim(p, csalad) {
  return csalad === 4 ? p.ip : ipv6Szoveg(utvonal.portLinkLocal(p));
}

// ---------------------------------------------------------------------------
// Router ID
// ---------------------------------------------------------------------------

/** Az automatikusan választható router ID: a legnagyobb loopback-, ennek híján a legnagyobb aktív IPv4-cím. */
export function autoRouterId(r) {
  const valaszt = (lista) => lista.reduce((m, p) => (m === null || ipSzam(p.ip) > ipSzam(m) ? p.ip : m), null);
  const lo = r.portok.filter((p) => p.tipus === 'Loopback' && p.ip && utvonal.portFent(p));
  if (lo.length) return valaszt(lo);
  const tobbi = r.portok.filter((p) => p.ip && utvonal.portFent(p));
  return tobbi.length ? valaszt(tobbi) : null;
}

// ---------------------------------------------------------------------------
// Csomagküldés
// ---------------------------------------------------------------------------

function kuld(r, p, csalad, ospf, cel) {
  const h = r.halozat;
  if (!h) return;
  const cs = CSOPORT[csalad];
  let celCim;
  let mac;
  if (cel === 'minden') {
    celCim = cs.minden;
    mac = cs.mindenMac;
  } else if (cel === 'dr') {
    celCim = cs.dr;
    mac = cs.drMac;
  } else {
    celCim = cel.cim;
    mac = cel.mac;
  }
  const a = all(r, csalad);
  const adat = { ...ospf, rid: a.rid, terulet: a.ifek.get(p.nev).terulet, hit: hitelesites(p, csalad) };
  if (csalad === 4) {
    routerMag.keretKuld(h, r, p, mac, 'ipv4', { forrasIp: p.ip, celIp: celCim, ttl: 1, protokoll: 'ospf', keses: 0, ospf: adat });
  } else {
    routerMag.keretKuld(h, r, p, mac, 'ipv6', { forras: sajatCim(p, 6), cel: celCim, hop: 1, protokoll: 'ospf', keses: 0, ospf: adat });
  }
}

/** A hitelesítési mező a Hellóba és a többi csomagba (OSPFv2). */
function hitelesites(p, csalad) {
  if (csalad === 6) return { tipus: 0 };
  const pb = p.ospf;
  if (pb.hitelesites === 'md5') {
    const ids = Object.keys(pb.kulcsok).map(Number).sort((a, b) => b - a);
    return ids.length ? { tipus: 2, kulcsId: ids[0], jelszo: pb.kulcsok[ids[0]] } : { tipus: 2, kulcsId: null };
  }
  if (pb.hitelesites === 'egyszeru') return { tipus: 1, jelszo: pb.jelszo };
  return { tipus: 0 };
}

function helloKuld(r, csalad, p, I) {
  const { hello, dead } = idokozok(p, csalad);
  const nbrek = [...I.szomszedok.values()].map((n) => n.rid);
  const dek = (x) => (x ? (csalad === 4 ? x.cim : x.rid) : '0.0.0.0');
  const h = {
    tipus: 'hello', hello, dead, prioritas: portBeall(p, csalad).prioritas,
    maszk: csalad === 4 ? p.maszk : undefined,
    dr: I.tipus === 'BROADCAST' ? dek(I.dr) : '0.0.0.0',
    bdr: I.tipus === 'BROADCAST' ? dek(I.bdr) : '0.0.0.0',
    szomszedok: nbrek,
    ifId: interfeszAzon(r, p),
  };
  dbgHello(r, csalad, p, `Send hello to ${CSOPORT[csalad].minden} area ${I.terulet} from ${sajatCim(p, csalad)}`);
  kuld(r, p, csalad, h, 'minden');
}

// ---------------------------------------------------------------------------
// Interfészek
// ---------------------------------------------------------------------------

/** Az interfész OSPF-állapotának létrehozása (az interfész bekerült az OSPF-be és működik). */
function ifIndit(r, csalad, p, terulet) {
  const a = all(r, csalad);
  const tipus = halozatTipus(p, csalad);
  const I = {
    port: p.nev,
    terulet,
    tipus,
    allapot: 'DOWN',
    dr: null,
    bdr: null,
    szomszedok: new Map(),
    kovHello: most(r),
    waitVege: null,
    passziv: passzivE(r, p, csalad),
    idok: idokozok(p, csalad),
    mtu: mtu(p, csalad),
  };
  a.ifek.set(p.nev, I);
  if (tipus === 'LOOPBACK') I.allapot = 'LOOPBACK';
  else if (tipus === 'POINT_TO_POINT') I.allapot = 'P2P';
  else if (I.passziv) {
    // Passzív interfészen nem jöhet szomszéd: a router rögtön magát választja DR-nek.
    valasztas(r, csalad, p, I);
  } else {
    I.allapot = 'WAITING';
    I.waitVege = most(r) + I.idok.dead * 1000;
  }
  if (!I.passziv && tipus !== 'LOOPBACK') helloKuld(r, csalad, p, I);
  I.kovHello = most(r) + I.idok.hello * 1000;
  return I;
}

/** Az interfész kikerül az OSPF-ből (vagy leesik): minden szomszédja elvész. */
function ifLeall(r, csalad, nev, ok = 'Interface down or detached') {
  const a = all(r, csalad);
  const I = a.ifek.get(nev);
  if (!I) return;
  const p = r.portok.find((x) => x.nev === nev);
  for (const n of [...I.szomszedok.values()]) szomszedLe(r, csalad, p, I, n, ok, false);
  a.ifek.delete(nev);
}

// ---------------------------------------------------------------------------
// Szomszédok
// ---------------------------------------------------------------------------

function allapotValt(r, csalad, p, I, n, uj, ok) {
  const regi = n.allapot;
  if (regi === uj) return;
  n.allapot = uj;
  if (uj === 'FULL') {
    adjNaplo(r, csalad, p, n, regi, uj, ok || 'Loading Done');
    all(r, csalad).forrasok.set(n.rid, most(r));
  }
  valtozas(r);
}

/** Egy szomszéd elvesztése. */
function szomszedLe(r, csalad, p, I, n, ok, ujravalaszt = true) {
  const regi = n.allapot;
  I.szomszedok.delete(n.rid);
  if (regi !== 'INIT' && regi !== 'DOWN') adjNaplo(r, csalad, p, n, regi, 'DOWN', `Neighbor Down: ${ok}`);
  if (ujravalaszt && I.tipus === 'BROADCAST' && I.allapot !== 'WAITING') valasztas(r, csalad, p, I);
  if (SZINT[regi] >= SZINT.EXSTART) lsaFrissit(r, csalad);
  valtozas(r);
}

/** Kell-e teljes szomszédságot (adjacency) építeni ezzel a szomszéddal? */
function kellSzomszedsag(I, n) {
  if (I.tipus !== 'BROADCAST') return true;
  const en = I.allapot === 'DR' || I.allapot === 'BDR';
  const o = (I.dr && I.dr.rid === n.rid) || (I.bdr && I.bdr.rid === n.rid);
  return en || o;
}

/** A szomszédsági döntés újraértékelése (a DR/BDR-választás után). */
function szomszedsagokIgazit(r, csalad, p, I) {
  for (const n of I.szomszedok.values()) {
    if (SZINT[n.allapot] < SZINT['2WAY']) continue;
    const kell = kellSzomszedsag(I, n);
    if (kell && n.allapot === '2WAY') exstartIndit(r, csalad, p, I, n);
    else if (!kell && SZINT[n.allapot] > SZINT['2WAY']) {
      allapotValt(r, csalad, p, I, n, '2WAY');
      n.keresek = new Set();
      lsaFrissit(r, csalad);
    }
  }
}

function exstartIndit(r, csalad, p, I, n) {
  allapotValt(r, csalad, p, I, n, 'EXSTART');
  n.fejlecKapott = false;
  n.keresek = new Set();
  dbgAdj(r, csalad, p, `Nbr ${n.rid}: Prepare dbase exchange`);
  dbdKuld(r, csalad, p, I, n, true);
}

// ---------------------------------------------------------------------------
// DR/BDR-választás
// ---------------------------------------------------------------------------

function nagyobb(a, b) {
  if (a.prioritas !== b.prioritas) return a.prioritas > b.prioritas;
  return ipSzam(a.rid) > ipSzam(b.rid);
}

function legjobb(lista) {
  return lista.reduce((m, x) => (!m || nagyobb(x, m) ? x : m), null);
}

/**
 * DR/BDR-választás egy broadcast szegmensen (RFC 2328, 9.4, egyszerűsítve). Aki már DR, az
 * marad (a választás nem preemptív): a jelöltek közül előnyben vannak azok, akik már
 * DR-nek/BDR-nek vallják magukat.
 */
function valasztas(r, csalad, p, I) {
  const a = all(r, csalad);
  const pr = portBeall(p, csalad).prioritas;
  const en = { rid: a.rid, cim: sajatCim(p, csalad), prioritas: pr, en: true };
  const regiAllapot = I.allapot;
  const regiDr = I.dr && I.dr.rid;
  const jeloltek = [];
  for (const n of I.szomszedok.values()) {
    if (SZINT[n.allapot] < SZINT['2WAY'] || n.prioritas === 0) continue;
    jeloltek.push({ rid: n.rid, cim: n.cim, prioritas: n.prioritas, drNek: n.drNek, bdrNek: n.bdrNek });
  }
  let enDr = !!(I.dr && I.dr.rid === a.rid);
  let enBdr = !!(I.bdr && I.bdr.rid === a.rid);
  let dr = null;
  let bdr = null;
  for (let kor = 0; kor < 3; kor++) {
    const mind = pr > 0 ? [...jeloltek, { ...en, drNek: enDr, bdrNek: enBdr }] : jeloltek;
    const nemDr = mind.filter((x) => !x.drNek);
    const bdrVallo = nemDr.filter((x) => x.bdrNek);
    bdr = legjobb(bdrVallo.length ? bdrVallo : nemDr);
    const drVallo = mind.filter((x) => x.drNek);
    dr = drVallo.length ? legjobb(drVallo) : bdr;
    if (dr && bdr && dr.rid === bdr.rid) bdr = legjobb(mind.filter((x) => x.rid !== dr.rid));
    const ujDr = !!(dr && dr.rid === a.rid);
    const ujBdr = !!(bdr && bdr.rid === a.rid);
    if (ujDr === enDr && ujBdr === enBdr) break;
    enDr = ujDr;
    enBdr = ujBdr;
  }
  I.dr = dr ? { rid: dr.rid, cim: dr.cim } : null;
  I.bdr = bdr ? { rid: bdr.rid, cim: bdr.cim } : null;
  I.allapot = enDr ? 'DR' : enBdr ? 'BDR' : 'DROTHER';
  I.waitVege = null;
  if (regiAllapot !== I.allapot || regiDr !== (I.dr && I.dr.rid)) {
    dbgAdj(r, csalad, p, 'DR/BDR election');
    dbgAdj(r, csalad, p, `Elect BDR ${I.bdr ? I.bdr.rid : '0.0.0.0'}`);
    dbgAdj(r, csalad, p, `Elect DR ${I.dr ? I.dr.rid : '0.0.0.0'}`);
  }
  szomszedsagokIgazit(r, csalad, p, I);
  lsaFrissit(r, csalad);
  valtozas(r);
}

// ---------------------------------------------------------------------------
// Fogadás
// ---------------------------------------------------------------------------

/** OSPF-csomag érkezett (IPv4: 89-es protokoll; IPv6: ugyanígy). */
export function ospfFogad(h, r, p, cs, csalad, forrasMac) {
  const a = all(r, csalad);
  if (!a.fut) return;
  const I = a.ifek.get(p.nev);
  const o = cs.ospf;
  if (!I || I.passziv || I.tipus === 'LOOPBACK') return;
  const forras = csalad === 4 ? cs.forrasIp : cs.forras;
  if (csalad === 4 && !routerMag.portHalozataban(p, forras)) return;
  // A DR-eknek szóló csoportcímet (224.0.0.6 / FF02::6) csak a DR és a BDR dolgozza fel.
  if ((cs.celIp || cs.cel) === CSOPORT[csalad].dr && I.allapot !== 'DR' && I.allapot !== 'BDR') return;
  // Hitelesítés (OSPFv2)
  if (csalad === 4) {
    const sajat = hitelesites(p, 4);
    const jott = o.hit || { tipus: 0 };
    if (sajat.tipus !== jott.tipus) {
      dbgAdj(r, csalad, p, `Rcv pkt from ${forras} : Mismatched Authentication type. Input packet specified type ${jott.tipus}, we use type ${sajat.tipus}`);
      return;
    }
    if (sajat.tipus === 2) {
      const kulcs = p.ospf.kulcsok[jott.kulcsId];
      if (kulcs === undefined) {
        dbgAdj(r, csalad, p, `Rcv pkt from ${forras} : Mismatched Authentication Key - No message digest key ${jott.kulcsId} on interface`);
        return;
      }
      if (kulcs !== jott.jelszo) {
        dbgAdj(r, csalad, p, `Rcv pkt from ${forras} : Mismatched Authentication Key - Message Digest Key ${jott.kulcsId}`);
        return;
      }
    }
    if (sajat.tipus === 1 && sajat.jelszo !== jott.jelszo) {
      dbgAdj(r, csalad, p, `Rcv pkt from ${forras} : Mismatched Authentication Key - Clear Text`);
      return;
    }
  }
  if (o.terulet !== I.terulet) {
    dbgHello(r, csalad, p, `Rcv pkt from ${forras}, area ${ipSzoveg(o.terulet)}, mismatched area ${ipSzoveg(I.terulet)} in the header`);
    return;
  }
  if (o.tipus === 'hello') return helloFogad(r, csalad, p, I, o, forras, forrasMac);
  const n = I.szomszedok.get(o.rid);
  if (!n) return;
  if (o.tipus === 'dbd') return dbdFogad(r, csalad, p, I, n, o);
  if (o.tipus === 'lsr') return lsrFogad(r, csalad, p, I, n, o);
  if (o.tipus === 'lsu') return lsuFogad(r, csalad, p, I, n, o);
  return undefined; // LSAck: a szimulátorban nincs teendő vele
}

function helloFogad(r, csalad, p, I, o, forras, forrasMac) {
  const a = all(r, csalad);
  const { hello, dead } = I.idok;
  const maszkHiba = csalad === 4 && I.tipus === 'BROADCAST' && o.maszk !== p.maszk;
  if (o.hello !== hello || o.dead !== dead || maszkHiba) {
    dbgHello(r, csalad, p, `Mismatched hello parameters from ${forras}`);
    dbgHello(r, csalad, p, `Dead R ${o.dead} C ${dead}, Hello R ${o.hello} C ${hello}`
      + (csalad === 4 ? ` Mask R ${o.maszk} C ${p.maszk}` : ''));
    return;
  }
  if (o.rid === a.rid) {
    const utolso = a.dupNaplo.get(p.nev);
    if (utolso === undefined || most(r) - utolso >= 60000) {
      a.dupNaplo.set(p.nev, most(r));
      naplo(r, csalad === 4
        ? `%OSPF-4-DUP_RTRID_NBR: OSPF detected duplicate router-id ${o.rid} from ${forras} on interface ${p.nev}`
        : `%OSPFv3-4-DUP_RTRID_NBR: OSPFv3 detected duplicate router-id ${o.rid} from ${forras} on interface ${p.nev}`);
    }
    return;
  }
  dbgHello(r, csalad, p, `Rcv hello from ${o.rid} area ${I.terulet} ${forras}`);
  let n = I.szomszedok.get(o.rid);
  const uj = !n;
  if (!n) {
    n = { rid: o.rid, allapot: 'DOWN', keresek: new Set(), fejlecKapott: false, rxmtKov: null };
    I.szomszedok.set(o.rid, n);
  }
  const regiPr = n.prioritas;
  const regiDr = n.drNek;
  const regiBdr = n.bdrNek;
  n.cim = forras;
  n.mac = forrasMac;
  n.prioritas = o.prioritas;
  n.ifId = o.ifId;
  n.deadLejar = most(r) + dead * 1000;
  n.drVallott = o.dr;
  n.bdrVallott = o.bdr;
  const sajatAzon = csalad === 4 ? forras : o.rid;
  n.drNek = o.dr === sajatAzon;
  n.bdrNek = o.bdr === sajatAzon;
  if (n.allapot === 'DOWN') allapotValt(r, csalad, p, I, n, 'INIT');
  if (uj) valtozas(r);

  const latnak = o.szomszedok.includes(a.rid);
  if (latnak && n.allapot === 'INIT') {
    allapotValt(r, csalad, p, I, n, '2WAY');
    dbgAdj(r, csalad, p, `2 Way Communication to ${n.rid}, state 2WAY`);
    if (I.tipus === 'BROADCAST') {
      if (I.allapot !== 'WAITING') valasztas(r, csalad, p, I);
      else if (n.bdrNek || (n.drNek && o.bdr === '0.0.0.0')) valasztas(r, csalad, p, I); // BackupSeen
    }
    if (n.allapot === '2WAY' && kellSzomszedsag(I, n)) exstartIndit(r, csalad, p, I, n);
    return;
  }
  if (!latnak && SZINT[n.allapot] >= SZINT['2WAY']) {
    // 1-WayReceived: a szomszéd már nem lát minket (pl. újraindította a folyamatot)
    const regi = n.allapot;
    n.allapot = 'INIT';
    n.keresek = new Set();
    dbgAdj(r, csalad, p, `Nbr ${n.rid}: 1-Way Hello received, state INIT`);
    if (I.tipus === 'BROADCAST' && I.allapot !== 'WAITING') valasztas(r, csalad, p, I);
    if (SZINT[regi] >= SZINT.EXSTART) lsaFrissit(r, csalad);
    valtozas(r);
    return;
  }
  if (I.tipus === 'BROADCAST' && SZINT[n.allapot] >= SZINT['2WAY']) {
    if (I.allapot === 'WAITING') {
      if (n.bdrNek || (n.drNek && o.bdr === '0.0.0.0')) valasztas(r, csalad, p, I);
    } else if (regiPr !== n.prioritas || regiDr !== n.drNek || regiBdr !== n.bdrNek) {
      valasztas(r, csalad, p, I);
    }
  }
}

// ---------------------------------------------------------------------------
// Adatbázis-csere: DBD, LSR, LSU
// ---------------------------------------------------------------------------

function fejlecek(r, csalad, terulet, portNev) {
  const db = lsdb(r, csalad, terulet);
  const kulso = lsdb(r, csalad, 'K');
  return [...db.values(), ...kulso.values()]
    .filter((l) => !l.maxAge && (l.hatokor !== 'link' || l.link === portNev))
    .map((l) => ({ kulcs: l.kulcs, sorszam: l.sorszam }));
}

function dbdKuld(r, csalad, p, I, n, init) {
  const dbd = { tipus: 'dbd', init, mtu: I.mtu, fejlecek: init ? [] : fejlecek(r, csalad, I.terulet, p.nev), kerValaszt: !n.fejlecKapott };
  dbgAdj(r, csalad, p, `Send DBD to ${n.rid} ${init ? 'flag 0x7' : 'flag 0x0'} len ${32 + dbd.fejlecek.length * 20}`);
  kuld(r, p, csalad, dbd, { cim: n.cim, mac: n.mac });
  n.rxmtKov = most(r) + RXMT;
}

function dbdFogad(r, csalad, p, I, n, d) {
  if (SZINT[n.allapot] < SZINT.EXSTART) return;
  dbgAdj(r, csalad, p, `Rcv DBD from ${n.rid} ${d.init ? 'flag 0x7' : 'flag 0x0'} len ${32 + d.fejlecek.length * 20}  mtu ${d.mtu} state ${n.allapot}`);
  if (d.mtu > I.mtu) {
    dbgAdj(r, csalad, p, `Nbr ${n.rid} has larger interface MTU`);
    return;
  }
  if (n.allapot === 'EXSTART') {
    const a = all(r, csalad);
    dbgAdj(r, csalad, p, `NBR Negotiation Done. We are the ${ipSzam(a.rid) > ipSzam(n.rid) ? 'MASTER' : 'SLAVE'}`);
    allapotValt(r, csalad, p, I, n, 'EXCHANGE');
    dbdKuld(r, csalad, p, I, n, false);
    if (d.init) return;
  }
  if (d.init) {
    // A szomszéd még az elején tart (elveszett a csomagunk): újraküldjük a fejléceket.
    if (n.allapot !== 'EXSTART') dbdKuld(r, csalad, p, I, n, false);
    return;
  }
  if (d.kerValaszt && n.fejlecKapott) dbdKuld(r, csalad, p, I, n, false);
  if (n.fejlecKapott) return;
  n.fejlecKapott = true;
  // Mi hiányzik nekünk, vagy mi régebbi nálunk?
  for (const f of d.fejlecek) {
    const sajat = lsaKeres(r, csalad, I.terulet, f.kulcs);
    if (!sajat || sajat.sorszam < f.sorszam) n.keresek.add(f.kulcs);
  }
  if (n.allapot === 'EXCHANGE') {
    dbgAdj(r, csalad, p, `Exchange Done with ${n.rid}`);
    if (n.keresek.size) {
      allapotValt(r, csalad, p, I, n, 'LOADING');
      lsrKuld(r, csalad, p, n);
    } else {
      allapotValt(r, csalad, p, I, n, 'FULL', 'Exchange Done');
      dbgAdj(r, csalad, p, `Synchronized with ${n.rid}, state FULL`);
      n.rxmtKov = null;
      lsaFrissit(r, csalad);
    }
  }
}

function lsrKuld(r, csalad, p, n) {
  kuld(r, p, csalad, { tipus: 'lsr', kulcsok: [...n.keresek] }, { cim: n.cim, mac: n.mac });
  n.rxmtKov = most(r) + RXMT;
}

function lsrFogad(r, csalad, p, I, n, k) {
  if (SZINT[n.allapot] < SZINT.EXCHANGE) return;
  const lsak = k.kulcsok.map((x) => lsaKeres(r, csalad, I.terulet, x)).filter(Boolean);
  if (lsak.length) kuld(r, p, csalad, { tipus: 'lsu', lsak: lsak.map(masol) }, { cim: n.cim, mac: n.mac });
}

function masol(l) {
  return JSON.parse(JSON.stringify(l));
}

function lsuFogad(r, csalad, p, I, n, u) {
  if (SZINT[n.allapot] < SZINT.EXCHANGE) return;
  const a = all(r, csalad);
  const ujak = [];
  let sajatVissza = false;
  for (const l of u.lsak) {
    const terulet = l.tipus === 'kulso' ? 'K' : I.terulet;
    const db = lsdb(r, csalad, terulet);
    const regi = db.get(l.kulcs);
    n.keresek.delete(l.kulcs);
    if (regi && regi.sorszam >= l.sorszam) continue;
    if (l.adv === a.rid) {
      // A saját (a folyamat újraindítása előtti) LSA-nk jött vissza nagyobb sorszámmal: a router
      // még nagyobb sorszámmal újra kiküldi, vagy ha már nem kell, törli.
      a.sorszamok.set(l.kulcs, Math.max(a.sorszamok.get(l.kulcs) || 0, l.sorszam));
      if (!regi) db.set(l.kulcs, { ...l, link: l.hatokor === 'link' ? p.nev : undefined });
      sajatVissza = true;
      continue;
    }
    if (l.maxAge) db.delete(l.kulcs);
    else db.set(l.kulcs, { ...l, link: l.hatokor === 'link' ? p.nev : undefined });
    if (l.hatokor !== 'link') ujak.push(l);
  }
  kuld(r, p, csalad, { tipus: 'ack', db: u.lsak.length }, { cim: n.cim, mac: n.mac });
  if (sajatVissza) lsaFrissit(r, csalad);
  if (ujak.length) {
    elaraszt(r, csalad, ujak, { port: p.nev, rid: n.rid });
    spfUtemez(r, csalad);
  }
  if (n.allapot === 'LOADING' && n.keresek.size === 0) {
    allapotValt(r, csalad, p, I, n, 'FULL', 'Loading Done');
    dbgAdj(r, csalad, p, `Synchronized with ${n.rid}, state FULL`);
    n.rxmtKov = null;
    lsaFrissit(r, csalad);
  }
}

/**
 * LSA-k elárasztása (flooding) a szomszédoknak. Broadcast szegmensen a DROTHER a DR-eknek
 * (224.0.0.6), a DR mindenkinek (224.0.0.5) küld; ahonnan jött, oda csak a DR küldi vissza.
 */
function elaraszt(r, csalad, lsak, honnan = null) {
  const a = all(r, csalad);
  for (const [nev, I] of a.ifek) {
    if (I.passziv || I.tipus === 'LOOPBACK') continue;
    const teljes = [...I.szomszedok.values()].filter((n) => SZINT[n.allapot] >= SZINT.EXCHANGE);
    if (!teljes.length) continue;
    if (honnan && honnan.port === nev) {
      if (I.tipus !== 'BROADCAST' || I.allapot !== 'DR') continue;
      if (teljes.every((n) => n.rid === honnan.rid)) continue;
    }
    const p = r.portok.find((x) => x.nev === nev);
    const kimegy = lsak.filter((l) => (l.terulet === I.terulet || l.tipus === 'kulso') && (l.hatokor !== 'link' || l.link === nev));
    if (!kimegy.length) continue;
    const cel = I.tipus === 'BROADCAST' && I.allapot === 'DROTHER' ? 'dr' : 'minden';
    kuld(r, p, csalad, { tipus: 'lsu', lsak: kimegy.map(masol) }, cel);
  }
}

// ---------------------------------------------------------------------------
// LSDB és saját LSA-k
// ---------------------------------------------------------------------------

function lsdb(r, csalad, terulet) {
  const a = all(r, csalad);
  if (!a.lsdb.has(terulet)) a.lsdb.set(terulet, new Map());
  return a.lsdb.get(terulet);
}

function lsaKeres(r, csalad, terulet, kulcs) {
  const l = lsdb(r, csalad, terulet).get(kulcs) || lsdb(r, csalad, 'K').get(kulcs);
  return l && !l.maxAge ? l : null;
}

function teljesSzomszedok(I) {
  return [...I.szomszedok.values()].filter((n) => n.allapot === 'FULL');
}

/** Tranzit hálózat-e az interfész (van DR, és vele teljes a szomszédság). */
function tranzitE(r, csalad, I) {
  if (I.tipus !== 'BROADCAST' || !I.dr) return false;
  const a = all(r, csalad);
  if (I.dr.rid === a.rid) return teljesSzomszedok(I).length > 0;
  const n = I.szomszedok.get(I.dr.rid);
  return !!n && n.allapot === 'FULL';
}

/** Az interfész IPv6-előtagjai (OSPFv3 Intra-Area-Prefix LSA-hoz). */
function elotagok6(p, I, k) {
  if (I.tipus === 'LOOPBACK') {
    return p.ipv6.map((c) => ({ prefix: `${ipv6Szoveg(ipv6Elemez(c.cim))}/128`, metrika: 0 }));
  }
  return p.ipv6.map((c) => ({ prefix: `${ipv6Szoveg(ipv6Halozat(ipv6Elemez(c.cim), c.hossz))}/${c.hossz}`, metrika: k }));
}

/** A router által most kiküldendő LSA-k (kulcs → {tipus, lsId, terulet, torzs, hatokor?, link?}). */
function kivantLsak(r, csalad) {
  const a = all(r, csalad);
  const o = ospfBeall(r, csalad);
  const ki = new Map();
  const tesz = (l) => {
    l.kulcs = `${l.tipus}|${l.lsId}|${a.rid}${l.link ? '|' + l.link : ''}`;
    ki.set(l.kulcs, l);
  };
  const vanAlap = utvonal.alapNemOspf(r, csalad);
  const kulsoAlap = o.alapUtvonal === 'always' || (o.alapUtvonal === 'originate' && vanAlap);
  const teruletek = new Set([...a.ifek.values()].map((I) => I.terulet));
  for (const T of teruletek) {
    const linkek = [];
    const prefixek = [];
    for (const [nev, I] of a.ifek) {
      if (I.terulet !== T) continue;
      const p = r.portok.find((x) => x.nev === nev);
      const k = koltseg(r, p, csalad);
      if (csalad === 4) {
        const hossz = prefixHossz(p.maszk);
        const halo = ipSzoveg(halozatSzam(ipSzam(p.ip), hossz));
        if (I.tipus === 'LOOPBACK') {
          linkek.push({ tipus: 'stub', id: p.ip, adat: '255.255.255.255', koltseg: 1 });
        } else if (I.tipus === 'POINT_TO_POINT') {
          for (const n of teljesSzomszedok(I)) linkek.push({ tipus: 'p2p', id: n.rid, adat: p.ip, koltseg: k });
          linkek.push({ tipus: 'stub', id: halo, adat: p.maszk, koltseg: k });
        } else if (tranzitE(r, csalad, I)) {
          linkek.push({ tipus: 'transit', id: I.dr.cim, adat: p.ip, koltseg: k });
        } else {
          linkek.push({ tipus: 'stub', id: halo, adat: p.maszk, koltseg: k });
        }
        if (I.allapot === 'DR' && tranzitE(r, csalad, I)) {
          tesz({ tipus: 'network', lsId: p.ip, terulet: T, torzs: { maszk: p.maszk, routerek: [a.rid, ...teljesSzomszedok(I).map((n) => n.rid)].sort() } });
        }
      } else {
        const ifId = interfeszAzon(r, p);
        if (I.tipus === 'POINT_TO_POINT') {
          for (const n of teljesSzomszedok(I)) linkek.push({ tipus: 'p2p', sajatIf: ifId, szomszedIf: n.ifId, szomszed: n.rid, koltseg: k });
          prefixek.push(...elotagok6(p, I, k));
        } else if (I.tipus === 'BROADCAST' && tranzitE(r, csalad, I)) {
          const drIf = I.dr.rid === a.rid ? ifId : I.szomszedok.get(I.dr.rid).ifId;
          linkek.push({ tipus: 'transit', sajatIf: ifId, drIf, dr: I.dr.rid, koltseg: k });
          if (I.allapot === 'DR') {
            tesz({ tipus: 'network', lsId: String(ifId), terulet: T, torzs: { routerek: [a.rid, ...teljesSzomszedok(I).map((n) => n.rid)].sort() } });
            tesz({ tipus: 'prefix', lsId: String(ifId * 1024), terulet: T, torzs: { ref: 'network', refId: String(ifId), prefixek: elotagok6(p, I, 0) } });
          }
        } else {
          prefixek.push(...elotagok6(p, I, k));
        }
        if (I.tipus !== 'LOOPBACK') {
          tesz({ tipus: 'link', lsId: String(ifId), terulet: T, hatokor: 'link', link: nev, torzs: { linkLocal: sajatCim(p, 6), prefixek: elotagok6(p, I, 0).map((x) => x.prefix) } });
        }
      }
    }
    linkek.sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y)));
    tesz({ tipus: 'router', lsId: '0', terulet: T, torzs: { linkek, asbr: kulsoAlap } });
    if (csalad === 6) tesz({ tipus: 'prefix', lsId: '0', terulet: T, torzs: { ref: 'router', refId: '0', prefixek } });
  }
  if (kulsoAlap && teruletek.size) {
    tesz({ tipus: 'kulso', lsId: '0.0.0.0', terulet: 'K', torzs: { prefix: csalad === 4 ? '0.0.0.0/0' : '::/0', metrika: 1, e2: true, tag: 1 } });
  }
  if (csalad === 4) for (const l of ki.values()) if (l.tipus === 'router') l.lsId = a.rid;
  // A v2-es Router LSA azonosítója a router ID: a kulcsot újra kell számolni.
  const vegso = new Map();
  for (const l of ki.values()) {
    l.kulcs = `${l.tipus}|${l.lsId}|${a.rid}${l.link ? '|' + l.link : ''}`;
    vegso.set(l.kulcs, l);
  }
  return vegso;
}

/**
 * A saját LSA-k frissítése: ami megváltozott, új sorszámmal kimegy; ami már nem kell, azt
 * törli (MaxAge-dzsel elárasztja). Utána SPF.
 */
function lsaFrissit(r, csalad) {
  const a = all(r, csalad);
  if (!a.fut) return;
  const kivant = kivantLsak(r, csalad);
  const kimegy = [];
  // A meglévő saját LSA-k
  for (const [T, db] of a.lsdb) {
    for (const [k, l] of [...db]) {
      if (l.adv !== a.rid || l.maxAge) continue;
      if (!kivant.has(k)) {
        const torolt = { ...l, maxAge: true, sorszam: l.sorszam + 1 };
        a.sorszamok.set(k, torolt.sorszam);
        db.delete(k);
        kimegy.push(torolt);
      }
    }
    void T;
  }
  for (const [k, l] of kivant) {
    const T = l.terulet;
    const db = lsdb(r, csalad, T);
    const regi = db.get(k);
    const ismert = a.sorszamok.get(k) || 0;
    if (regi && JSON.stringify(regi.torzs) === JSON.stringify(l.torzs) && regi.sorszam >= ismert) continue;
    const sorszam = Math.max(ELSO_SORSZAM, Math.max(regi ? regi.sorszam : 0, ismert) + 1);
    const uj = { ...l, adv: a.rid, sorszam, ido: most(r) };
    a.sorszamok.set(k, uj.sorszam);
    db.set(k, uj);
    kimegy.push(uj);
  }
  if (kimegy.length) {
    elaraszt(r, csalad, kimegy);
    spfUtemez(r, csalad);
  }
}

// ---------------------------------------------------------------------------
// SPF
// ---------------------------------------------------------------------------

function spfUtemez(r, csalad) {
  const a = all(r, csalad);
  if (!r.halozat || a.spf) return;
  a.spf = r.halozat.ora.utemez(SPF_KESES, () => {
    a.spf = null;
    spf(r, csalad);
  });
}

/** Egy router LSA-ja a területen (OSPFv2: lsId = rid, OSPFv3: lsId = '0'). */
function routerLsa(db, csalad, rid) {
  return db.get(`router|${csalad === 4 ? rid : '0'}|${rid}`);
}

/**
 * Dijkstra-algoritmus egy területre. Csúcsok: 'R:<rid>' és 'N:<azonosító>'. Minden csúcshoz
 * a távolság és az első ugrások ({port, kovetkezo}) – egyenlő költségnél mindegyik.
 */
function dijkstra(r, csalad, T, a) {
  const db = lsdb(r, csalad, T);
  const halok = new Map(); // N-csúcsok: azonosító → network LSA
  for (const l of db.values()) {
    if (l.maxAge || l.tipus !== 'network') continue;
    halok.set(csalad === 4 ? l.lsId : `${l.adv}:${l.lsId}`, l);
  }
  const o = ospfBeall(r, csalad);
  const max = o ? o.maxUtak : 4;

  /** A csúcs szomszédai: [{csucs, koltseg, el}] */
  const szomszedai = (csucs) => {
    const ki = [];
    if (csucs.startsWith('R:')) {
      const rid = csucs.slice(2);
      const l = routerLsa(db, csalad, rid);
      if (!l || l.maxAge) return ki;
      for (const e of l.torzs.linkek) {
        if (e.tipus === 'p2p') {
          const masik = routerLsa(db, csalad, e.id || e.szomszed);
          const vissza = masik && !masik.maxAge && masik.torzs.linkek.some((x) => x.tipus === 'p2p' && (x.id || x.szomszed) === rid);
          if (vissza) ki.push({ csucs: `R:${e.id || e.szomszed}`, koltseg: e.koltseg, el: e });
        } else if (e.tipus === 'transit') {
          const azon = csalad === 4 ? e.id : `${e.dr}:${e.drIf}`;
          const n = halok.get(azon);
          if (n && n.torzs.routerek.includes(rid)) ki.push({ csucs: `N:${azon}`, koltseg: e.koltseg, el: e });
        }
      }
    } else {
      const azon = csucs.slice(2);
      const n = halok.get(azon);
      for (const rid of n.torzs.routerek) {
        const l = routerLsa(db, csalad, rid);
        if (!l || l.maxAge) continue;
        const kapcs = l.torzs.linkek.find((x) => x.tipus === 'transit' && (csalad === 4 ? x.id === azon : `${x.dr}:${x.drIf}` === azon));
        if (kapcs) ki.push({ csucs: `R:${rid}`, koltseg: 0, el: kapcs });
      }
    }
    return ki;
  };

  const tav = new Map([[`R:${a.rid}`, 0]]);
  const elso = new Map([[`R:${a.rid}`, []]]);
  const kesz = new Set();
  for (;;) {
    let min = null;
    for (const [c, d] of tav) if (!kesz.has(c) && (min === null || d < tav.get(min))) min = c;
    if (min === null) break;
    kesz.add(min);
    for (const sz of szomszedai(min)) {
      if (kesz.has(sz.csucs)) continue;
      const d = tav.get(min) + sz.koltseg;
      let ugrasok;
      if (min === `R:${a.rid}`) {
        ugrasok = elsoUgras(r, csalad, sz, null);
      } else if (min.startsWith('N:') && elso.get(min).some((u) => u.kovetkezo === null)) {
        ugrasok = elso.get(min).filter((u) => u.kovetkezo === null).map((u) => elsoUgras(r, csalad, sz, u.port)).flat();
      } else {
        ugrasok = elso.get(min);
      }
      const regi = tav.get(sz.csucs);
      if (regi === undefined || d < regi) {
        tav.set(sz.csucs, d);
        elso.set(sz.csucs, ugrasok.slice(0, max));
      } else if (d === regi) {
        const l = elso.get(sz.csucs);
        for (const u of ugrasok) if (l.length < max && !l.some((x) => x.port === u.port && x.kovetkezo === u.kovetkezo)) l.push(u);
      }
    }
  }
  return { tav, elso, db };
}

/** Az első ugrás a gyökérből (vagy a gyökérhez kapcsolt hálózatból) egy szomszédos csúcs felé. */
function elsoUgras(r, csalad, sz, halozatPort) {
  const a = all(r, csalad);
  if (halozatPort === null) {
    // A gyökér saját linkje: p2p → a szomszéd címe; transit → maga a hálózat (közvetlen).
    const port = csalad === 4
      ? r.portok.find((p) => p.ip === sz.el.adat)
      : r.portok.find((p) => interfeszAzon(r, p) === sz.el.sajatIf);
    if (!port || !a.ifek.has(port.nev)) return [];
    if (sz.csucs.startsWith('N:')) return [{ port: port.nev, kovetkezo: null }];
    const n = a.ifek.get(port.nev).szomszedok.get(sz.csucs.slice(2));
    return n ? [{ port: port.nev, kovetkezo: n.cim }] : [];
  }
  // Közvetlenül kapcsolt hálózatról egy router: a következő ugrás az ő címe ezen a hálózaton.
  const rid = sz.csucs.slice(2);
  if (rid === a.rid) return [];
  if (csalad === 4) return [{ port: halozatPort, kovetkezo: sz.el.adat }];
  const I = a.ifek.get(halozatPort);
  const n = I && I.szomszedok.get(rid);
  return n ? [{ port: halozatPort, kovetkezo: n.cim }] : [];
}

/** Az SPF lefuttatása: a területek csúcsaiból és az LSA-k előtagjaiból útvonalak. */
function spf(r, csalad) {
  const a = all(r, csalad);
  if (!a.fut) {
    a.utvonalak = [];
    return;
  }
  a.spfSzam++;
  a.spfIdo = most(r);
  const legjobbak = new Map(); // előtag → {halozat, hossz, metrika, utak, alKod}
  const tesz = (prefix, metrika, ugrasok, alKod = '') => {
    if (!ugrasok.length || ugrasok.some((u) => u.kovetkezo === null)) return;
    const regi = legjobbak.get(prefix);
    if (!regi || metrika < regi.metrika) legjobbak.set(prefix, { prefix, metrika, utak: ugrasok.map((u) => ({ ...u })), alKod });
    else if (metrika === regi.metrika) {
      for (const u of ugrasok) if (!regi.utak.some((x) => x.port === u.port && x.kovetkezo === u.kovetkezo)) regi.utak.push({ ...u });
    }
  };
  const elerheto = new Map(); // rid → első ugrások (a külső útvonalakhoz)
  for (const T of a.lsdb.keys()) {
    if (T === 'K') continue;
    const { tav, elso, db } = dijkstra(r, csalad, T, a);
    for (const [c, d] of tav) {
      if (c === `R:${a.rid}`) continue;
      const ugr = elso.get(c);
      if (c.startsWith('R:')) {
        const rid = c.slice(2);
        if (!elerheto.has(rid)) elerheto.set(rid, ugr);
        if (csalad === 4) {
          const l = routerLsa(db, 4, rid);
          for (const e of l.torzs.linkek) {
            if (e.tipus !== 'stub') continue;
            const hossz = prefixHossz(e.adat);
            tesz(`${ipSzoveg(halozatSzam(ipSzam(e.id), hossz))}/${hossz}`, d + e.koltseg, ugr);
          }
        }
      } else if (csalad === 4) {
        const n = db.get([...db.keys()].find((k) => k.startsWith(`network|${c.slice(2)}|`)));
        if (n) {
          const hossz = prefixHossz(n.torzs.maszk);
          tesz(`${ipSzoveg(halozatSzam(ipSzam(n.lsId), hossz))}/${hossz}`, d, ugr);
        }
      }
    }
    if (csalad === 6) {
      for (const l of db.values()) {
        if (l.maxAge || l.tipus !== 'prefix') continue;
        const csucs = l.torzs.ref === 'router' ? `R:${l.adv}` : `N:${l.adv}:${l.torzs.refId}`;
        if (!tav.has(csucs) || csucs === `R:${a.rid}`) continue;
        for (const x of l.torzs.prefixek) tesz(x.prefix, tav.get(csucs) + x.metrika, elso.get(csucs));
      }
    }
  }
  for (const l of lsdb(r, csalad, 'K').values()) {
    if (l.maxAge || l.adv === a.rid || !elerheto.has(l.adv)) continue;
    tesz(l.torzs.prefix, l.torzs.metrika, elerheto.get(l.adv), 'E2');
  }
  // Útvonalak a routing táblának (az „idő” az első telepítés óta)
  const ido = most(r);
  const ujIdok = new Map();
  a.utvonalak = [...legjobbak.values()].map((e) => {
    const [h, hossz] = e.prefix.split('/');
    const alairas = `${e.metrika}|${e.utak.map((u) => u.port + u.kovetkezo).sort().join(',')}`;
    const regi = a.utvonalIdo.get(e.prefix);
    const t = regi && regi.alairas === alairas ? regi.ido : ido;
    ujIdok.set(e.prefix, { alairas, ido: t });
    e.utak.sort((x, y) => (x.port < y.port ? -1 : x.port > y.port ? 1 : 0));
    return {
      halozat: csalad === 4 ? ipSzam(h) : ipv6Elemez(h),
      hossz: Number(hossz),
      metrika: e.metrika,
      alKod: e.alKod,
      utak: e.utak.map((u) => ({ port: u.port, kovetkezo: csalad === 4 ? ipSzam(u.kovetkezo) : ipv6Elemez(u.kovetkezo), ido: t })),
    };
  });
  a.utvonalIdo = ujIdok;
  valtozas(r);
}

// ---------------------------------------------------------------------------
// Kívülről hívott események
// ---------------------------------------------------------------------------

function leallit(r, csalad, ok) {
  const a = all(r, csalad);
  for (const nev of [...a.ifek.keys()]) ifLeall(r, csalad, nev, ok);
  a.fut = false;
  a.lsdb = new Map();
  a.utvonalak = [];
  a.utvonalIdo = new Map();
  a.forrasok = new Map();
  if (a.spf && r.halozat) r.halozat.ora.lemond(a.spf);
  a.spf = null;
}

/**
 * Változott a router beállítása (OSPF, cím, interfész, statikus útvonal …): a folyamat elindul
 * vagy leáll, az interfészek be- és kikerülnek, a saját LSA-k frissülnek.
 * @param {{csalad?: 4|6}} [b]
 */
export function ospfValtozott(r, { csalad } = {}) {
  if (!r.halozat) return;
  for (const c of csalad ? [csalad] : [4, 6]) igazit(r, c);
}

function igazit(r, c) {
  const a = all(r, c);
  const o = ospfBeall(r, c);
  if (!o) {
    if (a.fut) leallit(r, c, 'Interface down or detached');
    a.nortrid = false;
    valtozas(r);
    return;
  }
  if (c === 6 && !r.ipv6Routing) {
    if (a.fut) leallit(r, c, 'Interface down or detached');
    return;
  }
  // Router ID
  const kell = o.routerId || autoRouterId(r);
  if (!a.fut) {
    if (!kell) {
      if (!a.nortrid) {
        a.nortrid = true;
        naplo(r, c === 4
          ? `%OSPF-4-NORTRID: OSPF process ${o.folyamat} failed to allocate unique router-id and cannot start`
          : `%OSPFv3-4-NORTRID: OSPFv3 process ${o.folyamat} could not pick a router-id, please configure manually`);
      }
      return;
    }
    a.fut = true;
    a.rid = kell;
    a.indulas = most(r);
    a.nortrid = false;
  } else if (o.routerId && o.routerId !== a.rid && !vanSzomszed(r, c)) {
    // Új, kézi router ID: szomszéd nélkül azonnal érvényes (különben clear ip ospf process kell).
    ujraindit(r, c);
    return;
  }
  // Interfészek
  for (const p of r.portok) {
    const t = ospfTerulet(r, p, c);
    const fent = utvonal.portFent(p);
    const I = a.ifek.get(p.nev);
    if (!t || !fent) {
      if (I) ifLeall(r, c, p.nev);
      continue;
    }
    const tipus = halozatTipus(p, c);
    const pass = passzivE(r, p, c);
    if (I && (I.terulet !== t.terulet || I.tipus !== tipus || I.passziv !== pass)) {
      ifLeall(r, c, p.nev, 'Interface down or detached');
      ifIndit(r, c, p, t.terulet);
      continue;
    }
    if (!I) {
      ifIndit(r, c, p, t.terulet);
      continue;
    }
    I.idok = idokozok(p, c);
    I.mtu = mtu(p, c);
  }
  lsaFrissit(r, c);
  spfUtemez(r, c);
  valtozas(r);
}

function vanSzomszed(r, csalad) {
  const a = all(r, csalad);
  return [...a.ifek.values()].some((I) => I.szomszedok.size > 0);
}

function ujraindit(r, csalad) {
  leallit(r, csalad, 'Interface down or detached');
  igazit(r, csalad);
}

/** clear ip ospf process / clear ipv6 ospf process. */
export function ospfTorol(r, csalad) {
  const a = all(r, csalad);
  if (!a.fut && !ospfBeall(r, csalad)) return;
  a.nortrid = false;
  ujraindit(r, csalad);
}

/** Egy port feljött vagy leesett. */
export function ospfPortValtozott(h, r) {
  for (const c of [4, 6]) if (ospfBeall(r, c)) igazit(r, c);
}

/** A statikus alapértelmezett útvonal változott (a default-information originate ezt figyeli). */
export function ospfAlapValtozott(r) {
  for (const c of [4, 6]) if (all(r, c).fut) lsaFrissit(r, c);
}

/** Fut-e a folyamat, és van-e szomszédja (a router-id parancs ebből dönt). */
export function ospfVanSzomszed(r, csalad) {
  return all(r, csalad).fut && vanSzomszed(r, csalad);
}

/**
 * Az időzítők: másodpercenként Hello-küldés, Wait-időzítő, Dead-időzítő, újraküldés.
 * @param {import('./halozat.js').Halozat} h
 */
export function ospfIndit(h) {
  const routerek = h.eszkozok.filter((e) => e.tipus === 'router');
  if (!routerek.length) return;
  const lep = () => {
    for (const r of routerek) {
      for (const c of [4, 6]) {
        const a = all(r, c);
        if (!a.fut) continue;
        const ido = h.ora.ido;
        for (const [nev, I] of [...a.ifek]) {
          const p = r.portok.find((x) => x.nev === nev);
          if (I.allapot === 'WAITING' && I.waitVege !== null && ido >= I.waitVege) valasztas(r, c, p, I);
          if (I.passziv || I.tipus === 'LOOPBACK') continue;
          for (const n of [...I.szomszedok.values()]) {
            if (ido >= n.deadLejar) {
              szomszedLe(r, c, p, I, n, 'Dead timer expired');
              continue;
            }
            if (n.rxmtKov !== null && ido >= n.rxmtKov) {
              if (n.allapot === 'EXSTART') dbdKuld(r, c, p, I, n, true);
              else if (n.allapot === 'EXCHANGE' && !n.fejlecKapott) dbdKuld(r, c, p, I, n, false);
              else if (n.allapot === 'LOADING' && n.keresek.size) lsrKuld(r, c, p, n);
              else n.rxmtKov = null;
            }
          }
          if (a.ifek.get(nev) === I && ido >= I.kovHello) {
            helloKuld(r, c, p, I);
            I.kovHello = ido + I.idok.hello * 1000;
          }
        }
      }
    }
    h.ora.utemez(1000, lep);
  };
  h.ora.utemez(1000, lep);
}

// ---------------------------------------------------------------------------
// Lekérdezések (routing tábla, show-parancsok, ellenőrzés)
// ---------------------------------------------------------------------------

/** Az OSPF-ből a routing táblába kerülő útvonalak. */
export function ospfUtvonalak(r, csalad) {
  const a = all(r, csalad);
  if (!a.fut) return [];
  return a.utvonalak.map((e) => ({ ...e, utak: e.utak.map((u) => ({ ...u })) }));
}

/**
 * A folyamat állapota a show-parancsoknak: { fut, rid, indulas, spfSzam, spfIdo, ifek: [...], forrasok }
 * Az interfészek: { port, terulet, tipus, allapot, dr, bdr, passziv, idok, kovHello, szomszedok: [...] }
 */
export function ospfAllapot(r, csalad) {
  const a = all(r, csalad);
  return {
    fut: a.fut,
    rid: a.rid,
    indulas: a.indulas,
    spfSzam: a.spfSzam,
    spfIdo: a.spfIdo,
    forrasok: [...a.forrasok.entries()].map(([rid, ido]) => ({ rid, ido })),
    ifek: [...a.ifek.values()].map((I) => ({
      ...I,
      szomszedok: [...I.szomszedok.values()].map((n) => ({ ...n, keresek: n.keresek.size })),
    })),
  };
}

/** Egy szomszéd szerepe a szegmensen ('DR', 'BDR', 'DROTHER', vagy '-' pont-pont linken). */
export function szomszedSzerep(I, n) {
  if (I.tipus !== 'BROADCAST') return '-';
  if (I.dr && I.dr.rid === n.rid) return 'DR';
  if (I.bdr && I.bdr.rid === n.rid) return 'BDR';
  return 'DROTHER';
}

/** A link-state adatbázis (a törölt LSA-k nélkül): [{terulet, lsak: [...]}], plusz a külsők. */
export function ospfAdatbazis(r, csalad) {
  const a = all(r, csalad);
  const teruletek = [];
  let kulso = [];
  for (const [T, db] of a.lsdb) {
    const lsak = [...db.values()].filter((l) => !l.maxAge);
    if (T === 'K') kulso = lsak;
    else teruletek.push({ terulet: T, lsak });
  }
  teruletek.sort((x, y) => x.terulet - y.terulet);
  return { teruletek, kulso };
}

/** Egy LSA kora másodpercben. */
export function lsaKor(r, l) {
  return Math.max(0, Math.floor((most(r) - l.ido) / 1000));
}

/** Egy LSA (ál-)ellenőrzőösszege a show ip ospf database-hez. */
export function lsaOsszeg(l) {
  const s = JSON.stringify([l.kulcs, l.sorszam, l.torzs]);
  let x = 0;
  for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) & 0xffff;
  return `0x00${x.toString(16).toUpperCase().padStart(4, '0')}`;
}

export { maszkSzoveg };
