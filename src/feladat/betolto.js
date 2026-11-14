/**
 * Feladat betöltése: a feladatfájl (feladatok/<nev>.js) adataiból felépíti a hálózatot.
 *
 * A feladatfájlok sima <script>-ként töltődnek be, és egy közös listába teszik magukat:
 *   window.HaloszimFeladatok = [ { azon: 'vlan-1', … }, … ]
 * Így új feladathoz nem kell újraépíteni a szimulátort, és file://-on is működik.
 */

import { Halozat } from '../mag/halozat.js';
import { ujSwitch2960 } from '../modell/switch.js';
import { ujCrs326 } from '../modell/mikrotik.js';
import { ujPc } from '../modell/pc.js';
import { ipBeallit } from '../mag/vegpont.js';
import { vtpIdozitoIndit } from '../mag/vtp.js';
import { ujRouter4331, routerPort, loopbackLetrehoz, ujOspf, ujEigrp } from '../modell/router.js';
import { ripIndit, ripValtozott } from '../mag/rip.js';
import { ospfIndit, ospfValtozott } from '../mag/ospf.js';
import { eigrpIndit, eigrpValtozott } from '../mag/eigrp.js';
import { ipv6PrefixElemez, ipv6Normal } from '../mag/ipv6.js';

/** A betöltött feladatok listája (a feladatfájlok töltik fel). */
export function feladatLista() {
  const g = typeof window !== 'undefined' ? window : globalThis;
  return g.HaloszimFeladatok || [];
}

/** Feladat keresése azonosító szerint (ha nincs megadva: az első). */
export function feladatKeres(azon) {
  const lista = feladatLista();
  if (!azon) return lista[0] || null;
  return lista.find((f) => f.azon === azon) || null;
}

/**
 * A feladat gyártói (a gyártóváltóhoz): a feladat saját gyártója (alapból Cisco), és a „gyartok”
 * mezőben leírt további változatok, pl. gyartok: { mikrotik: { lepesek, bemutato, celok, … } }.
 * @returns {string[]}
 */
export function feladatGyartok(feladat) {
  return [feladat.gyarto || 'cisco', ...Object.keys(feladat.gyartok || {})];
}

/**
 * A feladat egy gyártóra szabott változata: a „gyartok[gyarto]” mezői felülírják az alapokat
 * (pl. más teendők, bemutató, portnevek), az eszközök pedig ennek a gyártónak a modelljei lesznek.
 * Ismeretlen gyártónál az alapváltozat.
 */
export function gyartoValtozat(feladat, gyarto) {
  const { gyartok, ...alap } = feladat;
  if (!gyartok || !gyartok[gyarto]) return alap;
  return { ...alap, ...gyartok[gyarto], gyarto, azon: feladat.azon };
}

/**
 * @typedef {Object} BetoltottFeladat
 * @property {Object} feladat
 * @property {import('../mag/halozat.js').Halozat} halozat
 * @property {(nev: string) => Object} eszkoz – eszköz a feladatbeli neve szerint (akkor is, ha a
 *           tanuló átnevezte a hostname paranccsal)
 * @property {{nev: string, eszkoz: Object, x: number, y: number, tipus: string}[]} elemek
 */

/**
 * @param {Object} feladat
 * @param {{kesleltetes?: number, ora?: import('../mag/ido.js').Ora}} [beallitasok]
 * @returns {BetoltottFeladat}
 */
export function feladatBetolt(feladat, beallitasok = {}) {
  const halozat = new Halozat(beallitasok);
  const nevek = new Map();
  const elemek = [];
  for (const e of feladat.topologia.eszkozok) {
    let eszkoz;
    // A gyártó az eszköznél vagy az egész feladatra adható meg (gyarto: 'mikrotik'); alapból Cisco.
    const gyarto = e.gyarto || feladat.gyarto || 'cisco';
    if (e.tipus === 'switch' && gyarto === 'mikrotik') eszkoz = ujCrs326({ hostname: e.nev });
    else if (e.tipus === 'switch') eszkoz = ujSwitch2960({ hostname: e.nev });
    else if (e.tipus === 'pc') eszkoz = ujPc({ nev: e.nev });
    else if (e.tipus === 'router') eszkoz = ujRouter4331({ hostname: e.nev });
    else throw new Error(`Ismeretlen eszköztípus: ${e.tipus}`);
    halozat.hozzaad(eszkoz);
    nevek.set(e.nev, eszkoz);
    elemek.push({ nev: e.nev, eszkoz, x: e.x, y: e.y, tipus: e.tipus, felirat: e.felirat });
  }
  // Kiinduló beállítások (a kábelezés előtt, hogy a bekapcsolt portokon azonnal éljen a link):
  //   PC: { ip, maszk, atjaro, ipv6, ipv6Hossz, ipv6Atjaro }
  //   switch: { hostname, vtp: { mod, tartomany, jelszo, verzio, revizio }, vlanok: { 10: 'NEV' } }
  //   router: lásd routerBeallit lent
  for (const [nev, beall] of Object.entries(feladat.kiindulo || {})) {
    const eszkoz = nevek.get(nev);
    if (eszkoz.tipus === 'pc') {
      ipBeallit(eszkoz, beall);
      continue;
    }
    if (eszkoz.tipus === 'router') {
      routerBeallit(eszkoz, beall);
      continue;
    }
    if (eszkoz.gyarto === 'mikrotik') {
      // MikroTik: a gyári (defconf) állapotból indul; itt csak a gépnév adható meg.
      if (beall.hostname) eszkoz.hostname = beall.hostname;
      continue;
    }
    if (beall.hostname) eszkoz.hostname = beall.hostname;
    const v = beall.vtp || {};
    if (v.mod) eszkoz.vtpMod = v.mod;
    if (v.tartomany) eszkoz.vtpTartomany = v.tartomany;
    if (v.jelszo) eszkoz.vtpJelszo = v.jelszo;
    if (v.verzio) eszkoz.vtpVerzio = v.verzio;
    if (v.revizio) eszkoz.vtpRevizio = v.revizio;
    for (const [szam, vnev] of Object.entries(beall.vlanok || {})) {
      eszkoz.vlanok[szam] = { nev: vnev, gyari: false, tamogatott: true };
    }
  }
  // Kábelek: [eszköz, port, eszköz, port] vagy a végén { soros: true } (lassú soros vonal).
  for (const [a, pa, b, pb, opciok] of feladat.topologia.kabelek || []) {
    halozat.kabel(nevek.get(a), pa, nevek.get(b), pb, opciok || {});
  }
  vtpIdozitoIndit(halozat);
  ripIndit(halozat);
  ospfIndit(halozat);
  eigrpIndit(halozat);
  for (const e of halozat.eszkozok) {
    if (e.tipus !== 'router') continue;
    ripValtozott(e, { keres: true });
    ospfValtozott(e);
    eigrpValtozott(e);
  }
  return {
    feladat,
    halozat,
    elemek,
    eszkoz: (nev) => {
      const e = nevek.get(nev);
      if (!e) throw new Error(`Nincs ilyen eszköz a feladatban: ${nev}`);
      return e;
    },
  };
}

/**
 * Egy router kiinduló beállítása:
 *   {
 *     portok: { 'GigabitEthernet0/0/0': { ip, maszk, ipv6: ['2001:DB8::1/64'], linkLocal: 'FE80::1', be: true }, 'Loopback0': {…} },
 *     statikus: [{ halozat, maszk, kovetkezo }], statikus6: [{ prefix, kovetkezo }],
 *     ipv6Routing: true,
 *     ospf: { folyamat, routerId, halozatok, … }, ospf6: { … }   – kész OSPF-folyamat (modell/router.js ujOspf)
 *   }
 * Portonként még: ospf: { hello: 5, … }, ospf6: { … } (lásd ujOspfPort), mtu, mtu6, leiras,
 * savszel (bandwidth kbit/s), orajel (clock rate), keses (delay µs), eigrp6 (az EIGRP IPv6 AS-száma).
 * A routeren: eigrp: { as, halozatok: [{cim, wildcard}], autoSummary … }, eigrp6: { as, leallitva: false }.
 * A felsorolt portok bekapcsolódnak (no shutdown), hacsak nincs „be: false”.
 */
function routerBeallit(r, b) {
  if (b.hostname) r.hostname = b.hostname;
  for (const [pnev, pb] of Object.entries(b.portok || {})) {
    let p = routerPort(r, pnev);
    if (!p && /^Loopback\d+$/.test(pnev)) p = loopbackLetrehoz(r, Number(pnev.slice(8)));
    if (!p) throw new Error(`Nincs ilyen port: ${r.hostname} ${pnev}`);
    if (pb.ip) {
      p.ip = pb.ip;
      p.maszk = pb.maszk;
    }
    for (const c of pb.ipv6 || []) {
      const pr = ipv6PrefixElemez(c);
      if (!pr) throw new Error(`Hibás IPv6-cím: ${c}`);
      p.ipv6.push({ cim: ipv6Normal(c.split('/')[0]), hossz: pr.hossz });
    }
    if (pb.linkLocal) p.linkLocal = ipv6Normal(pb.linkLocal);
    if (pb.ospf) Object.assign(p.ospf, pb.ospf);
    if (pb.ospf6) Object.assign(p.ospf6, pb.ospf6);
    if (pb.savszel) p.savszel = pb.savszel;
    if (pb.orajel) p.orajel = pb.orajel;
    if (pb.keses) p.keses = pb.keses;
    if (pb.eigrp6) p.eigrp6 = pb.eigrp6;
    if (pb.mtu) p.mtu = pb.mtu;
    if (pb.mtu6) p.mtu6 = pb.mtu6;
    if (pb.leiras) p.leiras = pb.leiras;
    p.leallitva = pb.be === false;
    if (p.tipus === 'Loopback') p.fent = !p.leallitva;
  }
  for (const s of b.statikus || []) r.statikus.push({ ...s });
  for (const s of b.statikus6 || []) r.statikus6.push({ prefix: s.prefix, kovetkezo: s.kovetkezo ? ipv6Normal(s.kovetkezo) : undefined, interfesz: s.interfesz });
  if (b.ipv6Routing) r.ipv6Routing = true;
  if (b.ospf) r.ospf = { ...ujOspf(b.ospf.folyamat || 1), ...b.ospf };
  if (b.ospf6) r.ospf6 = { ...ujOspf(b.ospf6.folyamat || 1), ...b.ospf6 };
  if (b.eigrp) r.eigrp = { ...ujEigrp(b.eigrp.as || 1, 4), ...b.eigrp };
  if (b.eigrp6) r.eigrp6 = { ...ujEigrp(b.eigrp6.as || 1, 6), ...b.eigrp6 };
}
