/**
 * EIGRP – Enhanced Interior Gateway Routing Protocol: IPv4-re (router eigrp AS) és IPv6-ra
 * (ipv6 router eigrp AS). A két változat ugyanazzal a motorral működik; a különbségek (címek,
 * melyik interfészen fut) a „csalad” (4 vagy 6) szerint ágaznak el.
 *
 * Ami meg van valósítva:
 *   - szomszédfelderítés Hello csomagokkal (224.0.0.10 / FF02::A), Hold-időzítővel; a szomszédság
 *     csak egyező AS-szám és egyező K-értékek esetén jön létre (%DUAL-5-NBRCHANGE üzenet),
 *   - összetett metrika az alapértelmezett K-értékekkel (K1 = K3 = 1):
 *         metrika = 256 × ( 10^7 / legkisebb_sávszélesség[kbit/s] + összes_késleltetés[µs] / 10 )
 *     a hirdetésben a legkisebb sávszélesség és a halmozott késleltetés megy (nem a kész szám),
 *   - topológiatábla: minden célhálózathoz az összes szomszédtól hallott út a saját (FD) és a
 *     szomszéd hirdetett (AD) távolságával; successor és feasible successor a feltételezhetőségi
 *     feltétel szerint (AD < FD, szigorúan),
 *   - DUAL: ha a successor kiesik és van feasible successor, azonnal belép (az útvonal nem is
 *     tűnik el a táblából); ha nincs, az útvonal Active állapotba megy, a router Query-t küld, és
 *     csak a Reply-ok után épül újra (ezért indul nulláról az uptime),
 *   - megbízható szállítás egyszerűsítve: Update / Query / Reply után nyugta (Ack) megy, de nincs
 *     újraküldés (a szimulátorban nem veszik el csomag),
 *   - split horizon: amit egy interfészen tanultunk, azt ott nem hirdetjük vissza,
 *   - automatikus összevonás (auto-summary): másik osztályos hálózat felé az alhálózatok helyett az
 *     osztályos hálózat megy ki, és a router a saját összevont útvonalát a Null0 interfészre teszi
 *     (ettől lesz „fekete lyuk” nem összefüggő (diszkontiguóz) címzésnél),
 *   - passzív interfész: ott nincs Hello (szomszéd sem lehet), de a hálózatát a router hirdeti,
 *   - IPv6: külön folyamat, gyárilag leállított állapotban (kell rá a „no shutdown”), network
 *     parancs nincs – minden résztvevő interfészen külön kell bekapcsolni.
 *
 * Egyszerűsítések (lásd docs/forrasok.md): nincs újraküldés és SRTT-mérés (a show kimenetekben
 * állandó értékek), a Query-t fogadó router nem megy maga is Active állapotba (a saját táblájából
 * válaszol), nincs variance, offset-list, redistribute és „stuck in active” (SIA).
 */

import { ipSzam, ipSzoveg, prefixHossz, halozatSzam, osztalyos } from './ip.js';
import { ipv6Elemez, ipv6Szoveg, ipv6Halozat, linkLocalE } from './ipv6.js';
import { savszelesseg } from './ospf.js';

// A körkörös importok miatt a router- és útvonal-függvényeket futás közben érjük el.
import * as utvonal from './utvonal.js';
import * as routerMag from './router.js';

/** Adminisztratív távolság: belső (D) és külső (D EX) útvonal. */
export const EIGRP_AD = 90;
export const EIGRP_KULSO_AD = 170;

/** Az elérhetetlen metrika (a hirdetésben „poison”). */
export const VEGTELEN = 4294967295;

/** Alapértelmezett Hello- és Hold-idő (mp) – nagy sávszélességű linkeken. */
export const ALAP_HELLO = 5;
export const ALAP_HOLD = 15;

/** Ennyi ideig vár a router a Reply-okra (utána elérhetetlennek veszi a hálózatot). */
const ACTIVE_TURELEM = 60000;

const CSOPORT = {
  4: { cim: '224.0.0.10', mac: '01005e00000a' },
  6: { cim: 'FF02::A', mac: '33330000000a' },
};

/** Az interfészek gyári késleltetése µs-ban (IOS-alapértékek). */
const ALAP_KESES = { Serial: 20000, GigabitEthernet: 10, FastEthernet: 100, Loopback: 5000 };

// ---------------------------------------------------------------------------
// Beállítások elérése
// ---------------------------------------------------------------------------

/** A folyamat beállítása (router eigrp / ipv6 router eigrp), vagy null. */
export function eigrpBeall(r, csalad) {
  return csalad === 4 ? r.eigrp : r.eigrp6;
}

/** Az interfész késleltetése µs-ban (a „delay” parancs tízmikroszekundumos értékéből). */
export function keseses(p) {
  if (p.keses) return p.keses;
  return ALAP_KESES[p.tipus] || 1000;
}

/**
 * Az összetett metrika az alapértelmezett K-értékekkel (K1 = K3 = 1):
 *   256 × (10^7 / sávszélesség + késleltetés / 10)
 * @param {number} savszel – a legkisebb sávszélesség az úton (kbit/s)
 * @param {number} keses – a halmozott késleltetés (µs)
 */
export function metrika(savszel, keses) {
  if (!savszel || savszel <= 0) return VEGTELEN;
  return 256 * (Math.floor(10000000 / savszel) + Math.floor(keses / 10));
}

/** Az interfész „saját” metrikavektora (ennyibe kerül a hálózata a routernek). */
function sajatVektor(p) {
  return { savszel: savszelesseg(p), keses: keseses(p), hop: 0 };
}

/** Egy kapott vektor a mi interfészünkön át (a legkisebb sávszélesség és a halmozott késleltetés). */
function vektorAt(v, p) {
  return { savszel: Math.min(v.savszel, savszelesseg(p)), keses: v.keses + keseses(p), hop: v.hop + 1 };
}

function vektorMetrika(v) {
  return metrika(v.savszel, v.keses);
}

/**
 * Fut-e az EIGRP ezen az interfészen.
 * IPv4: van rá illő „network” parancs (osztályos, vagy wildcard maszkos alak).
 * IPv6: az interfészen „ipv6 eigrp AS” van, és a router továbbít IPv6-ot.
 */
export function eigrpPorton(r, p, csalad) {
  const e = eigrpBeall(r, csalad);
  if (!e || e.leallitva) return false;
  if (csalad === 6) {
    return !!r.ipv6Routing && p.eigrp6 === e.as && utvonal.ipv6Engedelyezve(p);
  }
  if (!p.ip) return false;
  const ip = ipSzam(p.ip);
  return e.halozatok.some((n) => {
    if (n.wildcard) {
      const wc = ipSzam(n.wildcard);
      return ((ip & ~wc) >>> 0) === ((ipSzam(n.cim) & ~wc) >>> 0);
    }
    const o = osztalyos(ip);
    return o.halozat === ipSzam(n.cim);
  });
}

/** Passzív-e az interfész (ott nincs Hello, de a hálózata hirdetve van). */
export function passzivE(r, p, csalad) {
  const e = eigrpBeall(r, csalad);
  if (!e) return false;
  if (e.passzivAlap) return !e.nemPassziv.includes(p.nev);
  return e.passziv.includes(p.nev);
}

/** Az EIGRP-ben részt vevő, működő interfészek. */
export function eigrpPortok(r, csalad) {
  return r.portok.filter((p) => eigrpPorton(r, p, csalad) && utvonal.portFent(p));
}

// ---------------------------------------------------------------------------
// Belső állapot
// ---------------------------------------------------------------------------

const belso = new WeakMap();

function ujAllapot() {
  return {
    fut: false,
    rid: null,
    indulas: 0,
    /** port neve → interfész-állapot */
    ifek: new Map(),
    /** kulcs ('X/n') → topológiabejegyzés */
    topologia: new Map(),
    /** a routing táblának átadott útvonalak */
    utvonalak: [],
    /** szomszéd kulcsa → utolsó frissítés ideje (show ip protocols) */
    forrasok: new Map(),
    /** a következő szomszéd „H” sorszáma */
    hKovetkezo: 0,
    sorszam: 1,
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

function csaladNev(csalad) {
  return csalad === 4 ? 'IPv4' : 'IPv6';
}

function dbgCsomag(r, szoveg) {
  if (r.debug.eigrpCsomag) naplo(r, `EIGRP: ${szoveg}`);
}

function dbgSzomszed(r, szoveg) {
  if (r.debug.eigrpSzomszed) naplo(r, `EIGRP: ${szoveg}`);
}

function dbgUtvonal(r, szoveg) {
  if (r.debug.eigrp) naplo(r, `DUAL: ${szoveg}`);
}

// ---------------------------------------------------------------------------
// Kulcsok, címek
// ---------------------------------------------------------------------------

function kulcs(csalad, halozat, hossz) {
  return csalad === 4 ? `${ipSzoveg(halozat)}/${hossz}` : `${ipv6Szoveg(halozat)}/${hossz}`;
}

function kulcsBont(csalad, k) {
  const [h, l] = k.split('/');
  return { halozat: csalad === 4 ? ipSzam(h) : ipv6Elemez(h), hossz: Number(l) };
}

/** A router saját címe az interfészen (IPv4-cím, illetve IPv6-ban a link-local cím). */
function sajatCim(p, csalad) {
  return csalad === 4 ? p.ip : ipv6Szoveg(utvonal.portLinkLocal(p));
}

/** Az interfész hálózatai (amiket az EIGRP hirdet): [{halozat, hossz}] */
function portHalozatai(p, csalad) {
  if (csalad === 4) {
    if (!p.ip) return [];
    const h = prefixHossz(p.maszk);
    return [{ halozat: halozatSzam(ipSzam(p.ip), h), hossz: h }];
  }
  return p.ipv6.map((c) => ({ halozat: ipv6Halozat(ipv6Elemez(c.cim), c.hossz), hossz: c.hossz }));
}

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

/**
 * Egy EIGRP-csomag elküldése.
 * @param {'minden'|{cim: string, mac: string}} cel
 */
function kuld(r, p, csalad, torzs, cel) {
  const h = r.halozat;
  if (!h) return;
  const a = all(r, csalad);
  const e = eigrpBeall(r, csalad);
  const adat = { ...torzs, as: e.as, rid: a.rid, k: [1, 0, 1, 0, 0], csalad };
  const celCim = cel === 'minden' ? CSOPORT[csalad].cim : cel.cim;
  const mac = cel === 'minden' ? CSOPORT[csalad].mac : cel.mac;
  if (csalad === 4) {
    routerMag.keretKuld(h, r, p, mac, 'ipv4', {
      forrasIp: p.ip, celIp: celCim, ttl: 2, protokoll: 'eigrp', keses: 0, eigrp: adat,
    });
  } else {
    routerMag.keretKuld(h, r, p, mac, 'ipv6', {
      forras: sajatCim(p, 6), cel: celCim, hop: 2, protokoll: 'eigrp', keses: 0, eigrp: adat,
    });
  }
}

function helloKuld(r, csalad, p, I) {
  dbgCsomag(r, `Sending HELLO on ${p.nev}`);
  kuld(r, p, csalad, { tipus: 'hello', hold: I.hold }, 'minden');
}

function ackKuld(r, csalad, p, n) {
  kuld(r, p, csalad, { tipus: 'ack' }, { cim: n.cim, mac: n.mac });
}

/** A szomszédnak szóló (unicast) vagy a hálózatnak szóló (multicast) Update. */
function updateKuld(r, csalad, p, bejegyzesek, { n = null, init = false } = {}) {
  if (!bejegyzesek.length && !init) return;
  dbgCsomag(r, `Sending UPDATE on ${p.nev}${n ? ` nbr ${n.cim}` : ''} (${bejegyzesek.length} prefix)`);
  kuld(r, p, csalad, { tipus: 'update', init, bejegyzesek }, n ? { cim: n.cim, mac: n.mac } : 'minden');
}

// ---------------------------------------------------------------------------
// Hirdetés: mit küld a router egy interfészen?
// ---------------------------------------------------------------------------

/**
 * A porton kihirdetendő bejegyzések: a saját (EIGRP-ben lévő) hálózatok és a táblába került
 * tanult útvonalak, split horizonnal, az auto-summary alkalmazása után.
 * @returns {{halozat: number|number[], hossz: number, savszel: number, keses: number, hop: number}[]}
 */
function hirdetes(r, csalad, p) {
  const a = all(r, csalad);
  const ki = new Map();
  const tesz = (halozat, hossz, v, honnan) => {
    const k = kulcs(csalad, halozat, hossz);
    const regi = ki.get(k);
    if (!regi || vektorMetrika(v) < vektorMetrika(regi)) ki.set(k, { halozat, hossz, ...v, honnan });
  };
  for (const [k, t] of a.topologia) {
    if (t.osszegzes) continue;
    if (t.sajat) {
      // Saját, közvetlenül kapcsolt hálózat: a kimenő interfészen is kimegy (a szomszédnak már
      // kapcsolt hálózata, ezért nem zavar).
      tesz(t.halozat, t.hossz, t.sajat, a.rid);
      continue;
    }
    if (t.allapot === 'A' || !t.utak.length) continue;
    // Split horizon: amit ezen a porton tanultunk, azt itt nem hirdetjük vissza.
    if (t.utak.some((u) => u.port === p.nev)) continue;
    void k;
    tesz(t.halozat, t.hossz, t.legjobbVektor, t.honnan || a.rid);
  }
  if (csalad === 6 || !eigrpBeall(r, 4).autoSummary) return [...ki.values()];
  // Automatikus összevonás az osztályhatáron (csak IPv4)
  const sajat = osztalyos(ipSzam(p.ip));
  const vegso = new Map();
  for (const [k, e] of ki) {
    const o = osztalyos(e.halozat);
    if (o.halozat === sajat.halozat || e.hossz <= o.hossz) {
      vegso.set(k, e);
      continue;
    }
    const ok = kulcs(4, o.halozat, o.hossz);
    const regi = vegso.get(ok);
    const uj = { halozat: o.halozat, hossz: o.hossz, savszel: e.savszel, keses: e.keses, hop: e.hop, honnan: e.honnan };
    if (!regi || vektorMetrika(uj) < vektorMetrika(regi)) vegso.set(ok, uj);
  }
  return [...vegso.values()];
}

/** Hirdetés minden működő interfészen (a változások után). */
function hirdetMindenhol(r, csalad) {
  const a = all(r, csalad);
  for (const [nev, I] of a.ifek) {
    if (!I.szomszedok.size) continue;
    const p = r.portok.find((x) => x.nev === nev);
    const uj = hirdetes(r, csalad, p);
    const regi = I.hirdetett || new Map();
    const kimegy = [];
    for (const e of uj) {
      const k = kulcs(csalad, e.halozat, e.hossz);
      const m = vektorMetrika(e);
      if (regi.get(k) !== m) kimegy.push(e);
    }
    // Ami eddig kiment, de most már nincs: elérhetetlenként (poison) megy ki.
    const ujKulcsok = new Set(uj.map((e) => kulcs(csalad, e.halozat, e.hossz)));
    for (const k of regi.keys()) {
      if (ujKulcsok.has(k)) continue;
      const b = kulcsBont(csalad, k);
      kimegy.push({ ...b, savszel: 0, keses: 0, hop: 0, torles: true });
    }
    I.hirdetett = new Map(uj.map((e) => [kulcs(csalad, e.halozat, e.hossz), vektorMetrika(e)]));
    if (kimegy.length) updateKuld(r, csalad, p, kimegy);
  }
}

// ---------------------------------------------------------------------------
// Topológiatábla és DUAL
// ---------------------------------------------------------------------------

function ujBejegyzes(halozat, hossz) {
  return {
    halozat,
    hossz,
    /** a saját kapcsolt hálózat vektora (ha a miénk), vagy null */
    sajat: null,
    /** szomszéd kulcsa → { cim, port, vektor (a mi távolságunk vektora), ad } */
    forrasok: new Map(),
    fd: VEGTELEN,
    allapot: 'P',
    /** a successorok (a táblába kerülő utak) */
    utak: [],
    legjobb: VEGTELEN,
    legjobbVektor: null,
    honnan: null,
    ido: null,
    /** Active állapotban: kiknek küldtünk Query-t, és mikor */
    kerdezett: null,
    kerdezKezd: 0,
    osszegzes: false,
  };
}

function bejegyzes(a, csalad, halozat, hossz) {
  const k = kulcs(csalad, halozat, hossz);
  let t = a.topologia.get(k);
  if (!t) a.topologia.set(k, (t = ujBejegyzes(halozat, hossz)));
  return t;
}

/** Él-e még ez a forrás (van szomszéd, és fent van a port). */
function forrasErvenyes(r, csalad, t, sk) {
  const f = t.forrasok.get(sk);
  if (!f) return false;
  const I = all(r, csalad).ifek.get(f.port);
  return !!I && I.szomszedok.has(sk);
}

/**
 * A feltételezhetőségi feltétel (feasibility condition): a szomszéd hirdetett távolsága (AD)
 * SZIGORÚAN kisebb, mint a mi feasible distance-ünk (FD).
 */
function feltetelTeljesul(f, fd) {
  return f.ad < fd;
}

/** A bejegyzés feasible successorai (a successor(ok) nélkül). */
export function feasibleSuccessorok(t) {
  return [...t.forrasok.values()].filter((f) => f.metrika > t.legjobb && feltetelTeljesul(f, t.fd));
}

/**
 * A saját („sajat”) vektorok újraszámolása: mely kapcsolt hálózatok vannak az EIGRP-ben.
 * Visszaadja, hogy változott-e valami.
 */
function sajatokIgazit(r, csalad) {
  const a = all(r, csalad);
  let valtozott = false;
  const kell = new Map();
  for (const p of r.portok) {
    if (!eigrpPorton(r, p, csalad) || !utvonal.portFent(p)) continue;
    for (const h of portHalozatai(p, csalad)) kell.set(kulcs(csalad, h.halozat, h.hossz), { h, p });
  }
  for (const [k, t] of a.topologia) {
    if (t.sajat && !kell.has(k)) {
      t.sajat = null;
      valtozott = true;
    }
  }
  for (const [k, { h, p }] of kell) {
    const t = bejegyzes(a, csalad, h.halozat, h.hossz);
    const v = sajatVektor(p);
    if (!t.sajat || t.sajat.savszel !== v.savszel || t.sajat.keses !== v.keses) {
      t.sajat = v;
      valtozott = true;
    }
    void k;
  }
  return valtozott;
}

/**
 * A szomszédoktól kapott vektorok újraszámolása a saját interfész mostani sávszélességével és
 * késleltetésével (a bandwidth / delay parancs után kell).
 */
function forrasokUjraszamol(r, csalad) {
  const a = all(r, csalad);
  for (const t of a.topologia.values()) {
    for (const f of t.forrasok.values()) {
      if (!f.hirdetett) continue;
      const p = r.portok.find((x) => x.nev === f.port);
      if (!p) continue;
      f.vektor = vektorAt(f.hirdetett, p);
      f.metrika = vektorMetrika(f.vektor);
      f.hop = f.vektor.hop;
    }
  }
}

/**
 * A DUAL kiértékelése minden (vagy a megadott) bejegyzésre: successor, FD, Active/Passive,
 * és az útvonalak összeállítása a routing táblának.
 */
function dualErtekel(r, csalad) {
  const a = all(r, csalad);
  const e = eigrpBeall(r, csalad);
  const maxUtak = e ? e.maxUtak : 4;
  const kerdezendo = [];
  for (const [k, t] of [...a.topologia]) {
    if (t.osszegzes) continue;
    // Elavult források (megszűnt szomszéd) eltakarítása
    for (const sk of [...t.forrasok.keys()]) if (!forrasErvenyes(r, csalad, t, sk)) t.forrasok.delete(sk);
    if (t.sajat) {
      // Saját hálózat: a metrika a sajátunk, nincs successor (kapcsolt útvonal)
      t.legjobb = vektorMetrika(t.sajat);
      t.legjobbVektor = t.sajat;
      t.fd = t.legjobb;
      t.allapot = 'P';
      t.utak = [];
      t.kerdezett = null;
      continue;
    }
    if (!t.forrasok.size) {
      if (t.allapot === 'A' && t.kerdezett && t.kerdezett.size) continue; // várjuk a Reply-okat
      a.topologia.delete(k);
      continue;
    }
    const legjobb = Math.min(...[...t.forrasok.values()].map((f) => f.metrika));
    if (t.allapot === 'A') {
      // Active állapotban csak a Reply-ok után döntünk (lásd replyFogad)
      continue;
    }
    const voltUt = t.utak.length > 0;
    if (voltUt && legjobb > t.fd) {
      // A távolság nőtt: csak akkor maradhatunk Passive, ha van feltételezhető (feasible) út.
      const fs = [...t.forrasok.values()].filter((f) => feltetelTeljesul(f, t.fd));
      if (!fs.length) {
        t.allapot = 'A';
        t.utak = [];
        t.ido = null;
        kerdezendo.push(t);
        dbgUtvonal(r, `${k} going active`);
        continue;
      }
    }
    t.legjobb = legjobb;
    t.fd = Math.min(t.fd === VEGTELEN ? legjobb : t.fd, legjobb);
    const successorok = [...t.forrasok.values()].filter((f) => f.metrika === legjobb).slice(0, maxUtak);
    t.legjobbVektor = successorok[0].vektor;
    t.honnan = successorok[0].honnan;
    const regiAlairas = t.utak.map((u) => `${u.port}|${u.cim}`).sort().join(',');
    t.utak = successorok.map((f) => ({ port: f.port, cim: f.cim, metrika: f.metrika }));
    const ujAlairas = t.utak.map((u) => `${u.port}|${u.cim}`).sort().join(',');
    if (t.ido === null) t.ido = most(r);
    if (regiAlairas !== ujAlairas) dbgUtvonal(r, `${k} successor: ${t.utak.map((u) => u.cim).join(', ')} (FD ${t.fd})`);
  }
  for (const t of kerdezendo) kerdezKuld(r, csalad, t);
  osszegzesIgazit(r, csalad);
  utvonalakOssze(r, csalad);
}

/** Az auto-summary miatt keletkező saját összevont útvonalak (Null0) karbantartása. */
function osszegzesIgazit(r, csalad) {
  const a = all(r, csalad);
  const e = eigrpBeall(r, 4);
  for (const [k, t] of [...a.topologia]) if (t.osszegzes) a.topologia.delete(k);
  if (csalad !== 4 || !e || !e.autoSummary) return;
  const portok = eigrpPortok(r, 4);
  for (const t of [...a.topologia.values()]) {
    if (t.osszegzes || t.legjobbVektor === null) continue;
    if (!t.sajat && !t.utak.length) continue;
    const o = osztalyos(t.halozat);
    if (t.hossz <= o.hossz) continue;
    // Csak akkor keletkezik összevonás, ha van olyan interfész, amely MÁS osztályos hálózatban van.
    const kell = portok.some((p) => osztalyos(ipSzam(p.ip)).halozat !== o.halozat);
    if (!kell) continue;
    const k = kulcs(4, o.halozat, o.hossz);
    const regi = a.topologia.get(k);
    const m = vektorMetrika(t.legjobbVektor);
    if (regi && regi.osszegzes && regi.legjobb <= m) continue;
    if (regi && !regi.osszegzes) continue;
    const s = ujBejegyzes(o.halozat, o.hossz);
    s.osszegzes = true;
    s.legjobb = m;
    s.fd = m;
    s.legjobbVektor = t.legjobbVektor;
    s.utak = [{ port: 'Null0', cim: null, metrika: m }];
    s.ido = regi ? regi.ido : most(r);
    a.topologia.set(k, s);
  }
}

/** A routing táblának átadott útvonalak összeállítása. */
function utvonalakOssze(r, csalad) {
  const a = all(r, csalad);
  const lista = [];
  for (const t of a.topologia.values()) {
    if (t.sajat || !t.utak.length || t.allapot === 'A') continue;
    lista.push({
      halozat: t.halozat,
      hossz: t.hossz,
      metrika: t.legjobb,
      osszegzes: t.osszegzes,
      utak: t.utak.map((u) => ({
        port: u.port,
        kovetkezo: u.cim === null ? null : (csalad === 4 ? ipSzam(u.cim) : ipv6Elemez(u.cim)),
        ido: t.ido === null ? most(r) : t.ido,
      })),
    });
  }
  a.utvonalak = lista;
  valtozas(r);
}

/** Query küldése minden szomszédnak (az útvonal Active lett). */
function kerdezKuld(r, csalad, t) {
  const a = all(r, csalad);
  t.kerdezett = new Set();
  t.kerdezKezd = most(r);
  const b = { halozat: t.halozat, hossz: t.hossz, savszel: 0, keses: 0, hop: 0, torles: true };
  for (const [nev, I] of a.ifek) {
    const p = r.portok.find((x) => x.nev === nev);
    for (const n of I.szomszedok.values()) {
      t.kerdezett.add(n.kulcs);
      dbgCsomag(r, `Sending QUERY on ${nev} nbr ${n.cim}`);
      kuld(r, p, csalad, { tipus: 'query', bejegyzesek: [b] }, { cim: n.cim, mac: n.mac });
    }
  }
  if (!t.kerdezett.size) {
    // Nincs kit megkérdezni: az útvonal elérhetetlen.
    t.allapot = 'P';
    t.kerdezett = null;
    t.fd = VEGTELEN;
  }
}

/** Egy Active állapot lezárása (minden Reply megjött, vagy lejárt a türelem). */
function activeLezar(r, csalad, k, t) {
  const a = all(r, csalad);
  t.allapot = 'P';
  t.kerdezett = null;
  for (const sk of [...t.forrasok.keys()]) if (!forrasErvenyes(r, csalad, t, sk)) t.forrasok.delete(sk);
  if (!t.forrasok.size) {
    a.topologia.delete(k);
    dbgUtvonal(r, `${k} unreachable (active → removed)`);
    return;
  }
  const legjobb = Math.min(...[...t.forrasok.values()].map((f) => f.metrika));
  t.legjobb = legjobb;
  t.fd = legjobb; // Active → Passive átmenetnél az FD újraindul
  const successorok = [...t.forrasok.values()].filter((f) => f.metrika === legjobb);
  t.legjobbVektor = successorok[0].vektor;
  t.honnan = successorok[0].honnan;
  t.utak = successorok.map((f) => ({ port: f.port, cim: f.cim, metrika: f.metrika }));
  t.ido = most(r); // az útvonal újraépült: az uptime nulláról indul
  dbgUtvonal(r, `${k} active → passive, FD ${t.fd}`);
}

// ---------------------------------------------------------------------------
// Szomszédok
// ---------------------------------------------------------------------------

function nbrFel(r, csalad, p, I, forras, mac, hold) {
  const a = all(r, csalad);
  const n = {
    kulcs: forras,
    cim: forras,
    mac,
    port: p.nev,
    h: a.hKovetkezo++,
    hold,
    holdLejar: most(r) + hold * 1000,
    kezd: most(r),
    seq: 0,
  };
  I.szomszedok.set(forras, n);
  naplo(r, `%DUAL-5-NBRCHANGE: EIGRP-${csaladNev(csalad)} ${eigrpBeall(r, csalad).as}: Neighbor ${forras} (${p.nev}) is up: new adjacency`);
  dbgSzomszed(r, `New peer ${forras} on ${p.nev}`);
  // Az új szomszédnak teljes táblát küldünk (init), ő is ezt teszi.
  const teljes = hirdetes(r, csalad, p);
  updateKuld(r, csalad, p, teljes, { n, init: true });
  I.hirdetett = new Map(teljes.map((x) => [kulcs(csalad, x.halozat, x.hossz), vektorMetrika(x)]));
  valtozas(r);
  return n;
}

function nbrLe(r, csalad, p, I, n, ok) {
  I.szomszedok.delete(n.kulcs);
  const a = all(r, csalad);
  a.forrasok.delete(n.kulcs);
  naplo(r, `%DUAL-5-NBRCHANGE: EIGRP-${csaladNev(csalad)} ${eigrpBeall(r, csalad) ? eigrpBeall(r, csalad).as : ''}: Neighbor ${n.cim} (${p ? p.nev : n.port}) is down: ${ok}`);
  dbgSzomszed(r, `Peer ${n.cim} went down: ${ok}`);
  // A tőle kapott Reply-okra már nem várunk.
  for (const [k, t] of a.topologia) {
    if (t.kerdezett && t.kerdezett.has(n.kulcs)) {
      t.kerdezett.delete(n.kulcs);
      if (!t.kerdezett.size) activeLezar(r, csalad, k, t);
    }
  }
  valtozas(r);
}

// ---------------------------------------------------------------------------
// Fogadás
// ---------------------------------------------------------------------------

/** EIGRP-csomag érkezett (IPv4: 88-as protokoll; IPv6: ugyanígy). */
export function eigrpFogad(h, r, p, cs, csalad, forrasMac) {
  const a = all(r, csalad);
  if (!a.fut) return;
  const I = a.ifek.get(p.nev);
  const d = cs.eigrp;
  if (!I || I.passziv) return;
  const e = eigrpBeall(r, csalad);
  const forras = csalad === 4 ? cs.forrasIp : cs.forras;
  // Más AS-ből jött csomag: a router szó nélkül eldobja (nem lesz szomszédság).
  if (d.as !== e.as) {
    dbgCsomag(r, `Ignored packet from ${forras} on ${p.nev}: AS ${d.as} (ours is ${e.as})`);
    return;
  }
  if (csalad === 4 && !routerMag.portHalozataban(p, forras)) return;
  if (csalad === 6 && !linkLocalE(ipv6Elemez(forras))) return;
  // K-értékek: ezeknek egyezniük kell.
  if (d.k && d.k.join() !== '1,0,1,0,0') {
    naplo(r, `%DUAL-5-NBRCHANGE: EIGRP-${csaladNev(csalad)} ${e.as}: Neighbor ${forras} (${p.nev}) is down: K-value mismatch`);
    return;
  }
  let n = I.szomszedok.get(forras);
  if (!n) {
    if (d.tipus !== 'hello') return; // szomszédság csak Hellóval indul
    n = nbrFel(r, csalad, p, I, forras, forrasMac, d.hold || ALAP_HOLD);
    return;
  }
  n.mac = forrasMac;
  n.holdLejar = most(r) + (d.hold || n.hold) * 1000;
  if (d.tipus === 'hello') {
    n.hold = d.hold || n.hold;
    return;
  }
  if (d.tipus === 'ack') return;
  dbgCsomag(r, `Received ${d.tipus.toUpperCase()} on ${p.nev} nbr ${forras}`);
  a.forrasok.set(n.kulcs, most(r));
  if (d.tipus === 'update') {
    frissitesFogad(r, csalad, p, n, d.bejegyzesek || []);
    ackKuld(r, csalad, p, n);
    if (d.init) updateKuld(r, csalad, p, hirdetes(r, csalad, p), { n });
    return;
  }
  if (d.tipus === 'query') {
    queryFogad(r, csalad, p, n, d.bejegyzesek || []);
    return;
  }
  if (d.tipus === 'reply') {
    replyFogad(r, csalad, p, n, d.bejegyzesek || []);
    ackKuld(r, csalad, p, n);
  }
}

/** Egy szomszédtól kapott bejegyzés eltárolása (a mi távolságunkkal együtt). */
function forrasFrissit(r, csalad, p, n, b) {
  const a = all(r, csalad);
  const t = bejegyzes(a, csalad, csalad === 4 ? halozatSzam(b.halozat, b.hossz) : ipv6Halozat(b.halozat, b.hossz), b.hossz);
  if (b.torles || !b.savszel) {
    t.forrasok.delete(n.kulcs);
    return t;
  }
  const v = vektorAt({ savszel: b.savszel, keses: b.keses, hop: b.hop }, p);
  t.forrasok.set(n.kulcs, {
    kulcs: n.kulcs,
    cim: n.cim,
    port: p.nev,
    hirdetett: { savszel: b.savszel, keses: b.keses, hop: b.hop },
    vektor: v,
    metrika: vektorMetrika(v),
    ad: metrika(b.savszel, b.keses),
    hop: v.hop,
    honnan: b.honnan || n.cim,
  });
  return t;
}

function frissitesFogad(r, csalad, p, n, bejegyzesek) {
  for (const b of bejegyzesek) forrasFrissit(r, csalad, p, n, b);
  dualErtekel(r, csalad);
  hirdetMindenhol(r, csalad);
}

/**
 * Query: a szomszéd nem találja az utat. Kitöröljük őt az adott hálózat forrásai közül, és a saját
 * táblánkból válaszolunk (a valódi EIGRP ilyenkor maga is Active állapotba mehet – ez a szimulátor
 * egyszerűsítése, lásd a fájl fejkommentjét).
 */
function queryFogad(r, csalad, p, n, bejegyzesek) {
  const a = all(r, csalad);
  const valasz = [];
  for (const b of bejegyzesek) {
    const t = forrasFrissit(r, csalad, p, n, { ...b, torles: true });
    const k = kulcs(csalad, t.halozat, t.hossz);
    // A válaszban a saját (a kérdezőn át NEM vezető) távolságunk megy.
    let v = null;
    if (t.sajat) v = t.sajat;
    else {
      const jok = [...t.forrasok.values()].filter((f) => f.kulcs !== n.kulcs);
      if (jok.length) {
        const m = Math.min(...jok.map((f) => f.metrika));
        v = jok.find((f) => f.metrika === m).vektor;
      }
    }
    if (v) valasz.push({ halozat: t.halozat, hossz: t.hossz, savszel: v.savszel, keses: v.keses, hop: v.hop, honnan: t.sajat ? a.rid : t.honnan });
    else valasz.push({ halozat: t.halozat, hossz: t.hossz, savszel: 0, keses: 0, hop: 0, torles: true });
    void k;
  }
  dbgCsomag(r, `Sending REPLY on ${p.nev} nbr ${n.cim}`);
  kuld(r, p, csalad, { tipus: 'reply', bejegyzesek: valasz }, { cim: n.cim, mac: n.mac });
  dualErtekel(r, csalad);
  hirdetMindenhol(r, csalad);
  void a;
}

function replyFogad(r, csalad, p, n, bejegyzesek) {
  const a = all(r, csalad);
  for (const b of bejegyzesek) {
    const t = forrasFrissit(r, csalad, p, n, b);
    const k = kulcs(csalad, t.halozat, t.hossz);
    if (t.kerdezett) {
      t.kerdezett.delete(n.kulcs);
      if (!t.kerdezett.size) activeLezar(r, csalad, k, t);
    }
  }
  dualErtekel(r, csalad);
  hirdetMindenhol(r, csalad);
  void a;
}

// ---------------------------------------------------------------------------
// Interfészek, a folyamat indítása és leállítása
// ---------------------------------------------------------------------------

function ifIndit(r, csalad, p) {
  const a = all(r, csalad);
  const I = {
    port: p.nev,
    hello: ALAP_HELLO,
    hold: ALAP_HOLD,
    kovHello: most(r),
    passziv: passzivE(r, p, csalad),
    szomszedok: new Map(),
    hirdetett: new Map(),
  };
  a.ifek.set(p.nev, I);
  if (!I.passziv) {
    helloKuld(r, csalad, p, I);
    I.kovHello = most(r) + I.hello * 1000;
  }
  return I;
}

function ifLeall(r, csalad, nev, ok = 'interface down') {
  const a = all(r, csalad);
  const I = a.ifek.get(nev);
  if (!I) return;
  const p = r.portok.find((x) => x.nev === nev);
  for (const n of [...I.szomszedok.values()]) nbrLe(r, csalad, p, I, n, ok);
  a.ifek.delete(nev);
}

function leallit(r, csalad, ok) {
  const a = all(r, csalad);
  for (const nev of [...a.ifek.keys()]) ifLeall(r, csalad, nev, ok);
  a.fut = false;
  a.topologia = new Map();
  a.utvonalak = [];
  a.forrasok = new Map();
}

function igazit(r, csalad) {
  const a = all(r, csalad);
  const e = eigrpBeall(r, csalad);
  if (!e || e.leallitva || (csalad === 6 && !r.ipv6Routing)) {
    if (a.fut) leallit(r, csalad, 'interface down');
    valtozas(r);
    return;
  }
  const rid = e.routerId || autoRouterId(r);
  if (!a.fut) {
    if (!rid) {
      if (!a.ridHiba) {
        a.ridHiba = true;
        naplo(r, `%EIGRP: Router-ID not configured. EIGRP-${csaladNev(csalad)} ${e.as} cannot start.`);
      }
      return;
    }
    a.fut = true;
    a.rid = rid;
    a.indulas = most(r);
    a.ridHiba = false;
  } else if (e.routerId && e.routerId !== a.rid) {
    a.rid = e.routerId;
  }
  // Interfészek
  for (const p of r.portok) {
    const kell = eigrpPorton(r, p, csalad) && utvonal.portFent(p);
    const I = a.ifek.get(p.nev);
    if (!kell) {
      if (I) ifLeall(r, csalad, p.nev);
      continue;
    }
    if (!I) {
      ifIndit(r, csalad, p);
      continue;
    }
    const pass = passzivE(r, p, csalad);
    if (I.passziv !== pass) {
      ifLeall(r, csalad, p.nev, 'interface down');
      ifIndit(r, csalad, p);
    }
  }
  sajatokIgazit(r, csalad);
  forrasokUjraszamol(r, csalad);
  dualErtekel(r, csalad);
  hirdetMindenhol(r, csalad);
  valtozas(r);
}

// ---------------------------------------------------------------------------
// Kívülről hívott események
// ---------------------------------------------------------------------------

/** Változott a beállítás (network, passive-interface, auto-summary, cím, ipv6 eigrp …). */
export function eigrpValtozott(r, { csalad } = {}) {
  if (!r.halozat) return;
  for (const c of csalad ? [csalad] : [4, 6]) igazit(r, c);
}

/** Egy port feljött vagy leesett. */
export function eigrpPortValtozott(h, r) {
  for (const c of [4, 6]) if (eigrpBeall(r, c)) igazit(r, c);
}

/** clear ip eigrp neighbors: minden szomszédság újraépül. */
export function eigrpTorol(r, csalad) {
  const a = all(r, csalad);
  if (!a.fut) return;
  leallit(r, csalad, 'manually cleared');
  a.ridHiba = false;
  igazit(r, csalad);
}

/**
 * Az időzítők: másodpercenként Hello, Hold-időzítő, és az Active állapotok türelme.
 * @param {import('./halozat.js').Halozat} h
 */
export function eigrpIndit(h) {
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
          if (I.passziv) continue;
          for (const n of [...I.szomszedok.values()]) {
            if (ido >= n.holdLejar) {
              nbrLe(r, c, p, I, n, 'holding time expired');
              dualErtekel(r, c);
              hirdetMindenhol(r, c);
            }
          }
          if (a.ifek.get(nev) === I && ido >= I.kovHello) {
            helloKuld(r, c, p, I);
            I.kovHello = ido + I.hello * 1000;
          }
        }
        // Lejárt Active állapotok
        for (const [k, t] of [...a.topologia]) {
          if (t.allapot === 'A' && ido - t.kerdezKezd >= ACTIVE_TURELEM) {
            t.kerdezett = new Set();
            activeLezar(r, c, k, t);
            dualErtekel(r, c);
            hirdetMindenhol(r, c);
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

/** Az EIGRP-ből a routing táblába kerülő útvonalak. */
export function eigrpUtvonalak(r, csalad) {
  const a = all(r, csalad);
  if (!a.fut) return [];
  return a.utvonalak.map((e) => ({ ...e, utak: e.utak.map((u) => ({ ...u })) }));
}

/** A folyamat állapota a show-parancsoknak. */
export function eigrpAllapot(r, csalad) {
  const a = all(r, csalad);
  return {
    fut: a.fut,
    rid: a.rid,
    indulas: a.indulas,
    forrasok: [...a.forrasok.entries()].map(([cim, ido]) => ({ cim, ido })),
    ifek: [...a.ifek.values()].map((I) => ({ ...I, szomszedok: [...I.szomszedok.values()].map((n) => ({ ...n })) })),
  };
}

/** A szomszédok listája (show ip eigrp neighbors). */
export function eigrpSzomszedok(r, csalad) {
  const a = all(r, csalad);
  const l = [];
  for (const I of a.ifek.values()) for (const n of I.szomszedok.values()) l.push({ ...n, ido: most(r) });
  return l.sort((x, y) => x.h - y.h);
}

/**
 * A topológiatábla (show ip eigrp topology): minden bejegyzéshez az FD, az állapot és az
 * összes forrás (szomszéd) a saját és a hirdetett távolságával.
 */
export function eigrpTopologia(r, csalad) {
  const a = all(r, csalad);
  if (!a.fut) return [];
  const l = [];
  for (const [k, t] of a.topologia) {
    const successorok = t.utak.map((u) => u.cim).filter(Boolean);
    l.push({
      kulcs: k,
      halozat: t.halozat,
      hossz: t.hossz,
      allapot: t.allapot,
      fd: t.sajat || t.osszegzes ? t.legjobb : (t.utak.length ? t.fd : t.fd),
      legjobb: t.legjobb,
      sajat: t.sajat,
      osszegzes: t.osszegzes,
      ido: t.ido,
      utak: t.utak.map((u) => ({ ...u })),
      honnan: t.honnan,
      forrasok: [...t.forrasok.values()].map((f) => ({
        cim: f.cim,
        port: f.port,
        metrika: f.metrika,
        ad: f.ad,
        hop: f.hop,
        vektor: f.vektor,
        honnan: f.honnan,
        successor: successorok.includes(f.cim),
        fs: !successorok.includes(f.cim) && feltetelTeljesul(f, t.fd),
      })),
    });
  }
  return l.sort((x, y) => (csalad === 4 ? x.halozat - y.halozat : String(x.kulcs).localeCompare(String(y.kulcs))) || x.hossz - y.hossz);
}

/** Egy hálózat topológiabejegyzése szövegesen megadva ('172.16.1.0/24'), vagy null. */
export function eigrpBejegyzes(r, csalad, szoveg) {
  const [h, l] = String(szoveg).split('/');
  const hossz = Number(l);
  const cim = csalad === 4 ? halozatSzam(ipSzam(h), hossz) : ipv6Halozat(ipv6Elemez(h), hossz);
  return eigrpTopologia(r, csalad).find((t) => t.kulcs === kulcs(csalad, cim, hossz)) || null;
}

export { kulcs as eigrpKulcs };
