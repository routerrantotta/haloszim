/**
 * EIGRP-parancsok (konfiguráció és exec).
 *
 * Globális konfiguráció:
 *   router eigrp <1-65535>               → (config-router)#   [konfig-eigrp]
 *   ipv6 router eigrp <1-65535>          → (config-rtr)#      [konfig-eigrp6]
 * A folyamat almódjában:
 *   eigrp router-id <A.B.C.D>, network <cím> [wildcard] (csak IPv4), passive-interface [default],
 *   auto-summary / no auto-summary (csak IPv4), shutdown / no shutdown
 * Interfészen:
 *   ipv6 eigrp <AS>, delay <1-16777215> (tízmikroszekundumban)
 * Exec:
 *   show ip eigrp neighbors | topology [<hálózat> <maszk>] | interfaces, ugyanez ipv6-tal,
 *   show ip route eigrp, clear ip|ipv6 eigrp neighbors, debug eigrp packets | neighbors,
 *   debug ip|ipv6 eigrp
 *
 * A hibaüzenetek formája a valódi eszközt követi (docs/forrasok.md), a súgószövegek saját szövegek.
 */

import { SZO } from './alap.js';
import { routerPort, ujEigrp } from '../../../modell/router.js';
import { eigrpValtozott, eigrpTorol, eigrpBeall } from '../../../mag/eigrp.js';
import { ipSzam, ipSzoveg, prefixHossz, osztalyos, ervenyesMaszk } from '../../../mag/ip.js';
import { ipv6Szoveg, ipv6Halozat, ipv6Elemez } from '../../../mag/ipv6.js';
import {
  showEigrpNeighbors, showEigrpTopology, showEigrpTopologyHalozat, showEigrpInterfaces,
} from '../kimenetek/eigrp.js';

const IF_MODOK = ['konfig-if', 'konfig-if-tartomany'];
const MINDKET_MOD = ['konfig-eigrp', 'konfig-eigrp6'];
const EXEC = ['felhasznalo', 'priv'];

const IP = { szo: 'ip', sugo: 'IPv4-beállítások' };
const IPV6 = { szo: 'ipv6', sugo: 'IPv6-beállítások' };
const ROUTER = { szo: 'router', sugo: 'Forgalomirányító protokoll indítása / beállítása' };
const EIGRP = { szo: 'eigrp', sugo: 'EIGRP (Enhanced Interior Gateway Routing Protocol)' };
const AS = { param: 'szam', kulcs: 'as', min: 1, max: 65535, nev: '<1-65535>', sugo: 'Az autonóm rendszer (AS) száma – a szomszédokon ugyanennyinek kell lennie' };
const SHOW = { szo: 'show', sugo: 'Információk megjelenítése az eszközről' };

/** Melyik család (4 vagy 6) a mostani almódban. */
function csaladja(ctx) {
  return ctx.mod === 'konfig-eigrp6' ? 6 : 4;
}

function beall(ctx) {
  return eigrpBeall(ctx.eszkoz, csaladja(ctx));
}

function portjai(ctx) {
  return ctx.kontextus.portok.map((n) => routerPort(ctx.eszkoz, n)).filter(Boolean);
}

/** Változás után: az EIGRP igazodik, a rajz frissül. */
function valtozott(ctx, csalad) {
  eigrpValtozott(ctx.eszkoz, csalad ? { csalad } : {});
  if (ctx.eszkoz.halozat) ctx.eszkoz.halozat.esemeny({ tipus: 'allapot' });
}

function egyFolyamat(ctx, regi, uj, elo) {
  ctx.kiir(`[Szimulátor] Egy routeren egyszerre csak egy ${elo}-folyamat futhat (most a(z) ${regi}-es AS). `
    + `Ha másikat szeretnél, előbb töröld: no ${elo === 'EIGRP' ? 'router eigrp' : 'ipv6 router eigrp'} ${regi} (ezt a(z) ${uj} helyett írd be).`);
}

// ---------------------------------------------------------------------------
// A folyamat indítása és törlése
// ---------------------------------------------------------------------------

const folyamatParancsok = [
  {
    modok: ['konfig'],
    szavak: [ROUTER, EIGRP, AS],
    vegrehajt(ctx, { as }) {
      const r = ctx.eszkoz;
      if (r.eigrp && r.eigrp.as !== as) return egyFolyamat(ctx, r.eigrp.as, as, 'EIGRP');
      if (!r.eigrp) r.eigrp = ujEigrp(as, 4);
      ctx.modValt('konfig-eigrp', { eigrp: as });
      valtozott(ctx, 4);
      return undefined;
    },
  },
  {
    modok: ['konfig'],
    szavak: [SZO.no, ROUTER, { ...EIGRP, sugo: 'Az EIGRP-folyamat törlése' }, AS],
    vegrehajt(ctx, { as }) {
      const r = ctx.eszkoz;
      if (!r.eigrp || r.eigrp.as !== as) return;
      r.eigrp = null;
      valtozott(ctx, 4);
    },
  },
  {
    modok: ['konfig'],
    szavak: [IPV6, ROUTER, { ...EIGRP, sugo: 'EIGRP IPv6-hoz (külön folyamat)' }, AS],
    vegrehajt(ctx, { as }) {
      const r = ctx.eszkoz;
      if (!r.ipv6Routing) {
        ctx.kiir('% IPv6 routing not enabled');
        return undefined;
      }
      if (r.eigrp6 && r.eigrp6.as !== as) return egyFolyamat(ctx, r.eigrp6.as, as, 'EIGRP IPv6');
      // A folyamat gyárilag leállított állapotban indul: kell rá a „no shutdown”.
      if (!r.eigrp6) r.eigrp6 = ujEigrp(as, 6);
      ctx.modValt('konfig-eigrp6', { eigrp6: as });
      valtozott(ctx, 6);
      return undefined;
    },
  },
  {
    modok: ['konfig'],
    szavak: [SZO.no, IPV6, ROUTER, { ...EIGRP, sugo: 'Az IPv6-os EIGRP-folyamat törlése' }, AS],
    vegrehajt(ctx, { as }) {
      const r = ctx.eszkoz;
      if (!r.eigrp6 || r.eigrp6.as !== as) return;
      r.eigrp6 = null;
      for (const p of r.portok) if (p.eigrp6 === as) p.eigrp6 = null;
      valtozott(ctx, 6);
    },
  },
];

// ---------------------------------------------------------------------------
// A folyamat almódja
// ---------------------------------------------------------------------------

const almodParancsok = [
  {
    modok: MINDKET_MOD,
    szavak: [{ szo: 'eigrp', sugo: 'EIGRP-beállítás' }, { szo: 'router-id', sugo: 'A router azonosítója (router ID) kézzel' },
      { param: 'ipv4', kulcs: 'rid', sugo: 'Router ID IP-cím alakban, pl. 1.1.1.1' }],
    vegrehajt(ctx, { rid }) {
      const e = beall(ctx);
      if (rid === '0.0.0.0') {
        ctx.kiir('EIGRP: Invalid router-id');
        return;
      }
      e.routerId = rid;
      valtozott(ctx, csaladja(ctx));
    },
  },
  {
    modok: MINDKET_MOD,
    szavak: [SZO.no, { szo: 'eigrp', sugo: 'EIGRP-beállítás' }, { szo: 'router-id', sugo: 'Vissza az automatikus router ID-ra' }],
    vegrehajt(ctx) {
      beall(ctx).routerId = '';
      valtozott(ctx, csaladja(ctx));
    },
  },
  {
    modok: ['konfig-eigrp'],
    szavak: [{ szo: 'network', sugo: 'Ezeken az interfészeken fusson az EIGRP (és ezeket hirdesse)' },
      { param: 'ipv4', kulcs: 'cim', sugo: 'Hálózatcím (wildcard maszk nélkül osztályos hálózatként értendő)' }],
    vegrehajt(ctx, { cim }) {
      halozatFelvesz(ctx, cim, null);
    },
  },
  {
    modok: ['konfig-eigrp'],
    szavak: [{ szo: 'network', sugo: 'Ezeken az interfészeken fusson az EIGRP (és ezeket hirdesse)' },
      { param: 'ipv4', kulcs: 'cim', sugo: 'Hálózatcím' },
      { param: 'ipv4', kulcs: 'wc', sugo: 'Wildcard maszk (0 = egyeznie kell, 1 = bármi lehet), pl. 0.0.0.3' }],
    vegrehajt(ctx, { cim, wc }) {
      halozatFelvesz(ctx, cim, wc);
    },
  },
  {
    modok: ['konfig-eigrp'],
    szavak: [SZO.no, { szo: 'network', sugo: 'Hálózat törlése az EIGRP-ből' }, { param: 'ipv4', kulcs: 'cim', sugo: 'Hálózatcím' }],
    vegrehajt(ctx, { cim }) {
      halozatTorol(ctx, cim, null);
    },
  },
  {
    modok: ['konfig-eigrp'],
    szavak: [SZO.no, { szo: 'network', sugo: 'Hálózat törlése az EIGRP-ből' }, { param: 'ipv4', kulcs: 'cim', sugo: 'Hálózatcím' },
      { param: 'ipv4', kulcs: 'wc', sugo: 'Wildcard maszk' }],
    vegrehajt(ctx, { cim, wc }) {
      halozatTorol(ctx, cim, wc);
    },
  },
  {
    modok: MINDKET_MOD,
    szavak: [{ szo: 'passive-interface', sugo: 'Ezen az interfészen nincs Hello (a hálózatát továbbra is hirdeti)' },
      { param: 'interfesz', kulcs: 'interfesz', sugo: 'Az interfész neve' }],
    vegrehajt(ctx, { interfesz }) {
      const e = beall(ctx);
      if (!routerPort(ctx.eszkoz, interfesz)) return;
      if (e.passzivAlap) e.nemPassziv = e.nemPassziv.filter((x) => x !== interfesz);
      else if (!e.passziv.includes(interfesz)) e.passziv.push(interfesz);
      valtozott(ctx, csaladja(ctx));
    },
  },
  {
    modok: MINDKET_MOD,
    szavak: [SZO.no, { szo: 'passive-interface', sugo: 'Az interfész ismét küld Hellót' },
      { param: 'interfesz', kulcs: 'interfesz', sugo: 'Az interfész neve' }],
    vegrehajt(ctx, { interfesz }) {
      const e = beall(ctx);
      if (e.passzivAlap) {
        if (!e.nemPassziv.includes(interfesz)) e.nemPassziv.push(interfesz);
      } else {
        e.passziv = e.passziv.filter((x) => x !== interfesz);
      }
      valtozott(ctx, csaladja(ctx));
    },
  },
  {
    modok: MINDKET_MOD,
    szavak: [{ szo: 'passive-interface', sugo: 'Ezen az interfészen nincs Hello' },
      { szo: 'default', sugo: 'Minden interfész passzív (a kivételeket „no passive-interface …” jelöli)' }],
    vegrehajt(ctx) {
      Object.assign(beall(ctx), { passzivAlap: true, passziv: [], nemPassziv: [] });
      valtozott(ctx, csaladja(ctx));
    },
  },
  {
    modok: MINDKET_MOD,
    szavak: [SZO.no, { szo: 'passive-interface', sugo: 'Az interfészek ismét küldenek Hellót' },
      { szo: 'default', sugo: 'Alapból egyik interfész se legyen passzív' }],
    vegrehajt(ctx) {
      Object.assign(beall(ctx), { passzivAlap: false, passziv: [], nemPassziv: [] });
      valtozott(ctx, csaladja(ctx));
    },
  },
  {
    modok: ['konfig-eigrp'],
    szavak: [{ szo: 'auto-summary', sugo: 'Automatikus összevonás az osztályhatáron' }],
    vegrehajt(ctx) {
      ctx.eszkoz.eigrp.autoSummary = true;
      valtozott(ctx, 4);
    },
  },
  {
    modok: ['konfig-eigrp'],
    szavak: [SZO.no, { szo: 'auto-summary', sugo: 'Az automatikus összevonás kikapcsolása: az alhálózatok maszkkal mennek ki' }],
    vegrehajt(ctx) {
      ctx.eszkoz.eigrp.autoSummary = false;
      valtozott(ctx, 4);
    },
  },
  ...[true, false].map((le) => ({
    modok: MINDKET_MOD,
    szavak: [...(le ? [] : [SZO.no]), { szo: 'shutdown', sugo: le ? 'A folyamat leállítása (minden szomszédság megszakad)' : 'A folyamat elindítása' }],
    vegrehajt(ctx) {
      beall(ctx).leallitva = le;
      valtozott(ctx, csaladja(ctx));
    },
  })),
];

function halozatFelvesz(ctx, cim, wc) {
  const e = ctx.eszkoz.eigrp;
  if (wc && !ervenyesMaszk(ipSzoveg((~ipSzam(wc)) >>> 0))) {
    ctx.kiir('%Invalid wildcard mask');
    return;
  }
  // Wildcard maszk nélkül a cím osztályos hálózatként tárolódik (mint a valódi eszközön).
  const szoveg = wc ? ipSzoveg((ipSzam(cim) & ~ipSzam(wc)) >>> 0) : ipSzoveg(osztalyos(ipSzam(cim)).halozat);
  if (!e.halozatok.some((n) => n.cim === szoveg && (n.wildcard || null) === (wc || null))) {
    e.halozatok.push({ cim: szoveg, wildcard: wc || null });
    e.halozatok.sort((a, b) => ipSzam(a.cim) - ipSzam(b.cim));
  }
  valtozott(ctx, 4);
}

function halozatTorol(ctx, cim, wc) {
  const e = ctx.eszkoz.eigrp;
  const szoveg = wc ? ipSzoveg((ipSzam(cim) & ~ipSzam(wc)) >>> 0) : ipSzoveg(osztalyos(ipSzam(cim)).halozat);
  const elotte = e.halozatok.length;
  e.halozatok = e.halozatok.filter((n) => !(n.cim === szoveg && (n.wildcard || null) === (wc || null)));
  if (e.halozatok.length === elotte) ctx.kiir(`% Network ${szoveg} not found`);
  valtozott(ctx, 4);
}

// ---------------------------------------------------------------------------
// Interfész-parancsok
// ---------------------------------------------------------------------------

const interfeszParancsok = [
  {
    modok: IF_MODOK,
    szavak: [IPV6, { ...EIGRP, sugo: 'EIGRP IPv6-on ezen az interfészen' }, AS],
    vegrehajt(ctx, { as }) {
      const r = ctx.eszkoz;
      if (!r.ipv6Routing) {
        ctx.kiir('% IPv6 routing not enabled');
        return;
      }
      if (!r.eigrp6) r.eigrp6 = ujEigrp(as, 6);
      else if (r.eigrp6.as !== as) {
        egyFolyamat(ctx, r.eigrp6.as, as, 'EIGRP IPv6');
        return;
      }
      for (const p of portjai(ctx)) p.eigrp6 = as;
      valtozott(ctx, 6);
    },
  },
  {
    modok: IF_MODOK,
    szavak: [SZO.no, IPV6, { ...EIGRP, sugo: 'Az EIGRP kikapcsolása ezen az interfészen' }, AS],
    vegrehajt(ctx, { as }) {
      for (const p of portjai(ctx)) if (p.eigrp6 === as) p.eigrp6 = null;
      valtozott(ctx, 6);
    },
  },
  {
    modok: IF_MODOK,
    szavak: [{ szo: 'delay', sugo: 'Az interfész késleltetése (az EIGRP metrikájába számít bele)' },
      { param: 'szam', kulcs: 'n', min: 1, max: 16777215, nev: '<1-16777215>', sugo: 'Tízmikroszekundumban (pl. 2000 = 20 000 µs)' }],
    vegrehajt(ctx, { n }) {
      for (const p of portjai(ctx)) p.keses = n * 10;
      valtozott(ctx);
    },
  },
  {
    modok: IF_MODOK,
    szavak: [SZO.no, { szo: 'delay', sugo: 'Vissza az interfész gyári késleltetésére' }],
    vegrehajt(ctx) {
      for (const p of portjai(ctx)) delete p.keses;
      valtozott(ctx);
    },
  },
];

// ---------------------------------------------------------------------------
// Exec: show, clear, debug
// ---------------------------------------------------------------------------

function lista(modok, szavak, fn) {
  return { modok, szavak, lapozhato: true, vegrehajt: (ctx, e) => ctx.kiir(...fn(ctx.eszkoz, e)) };
}

function showParancsok(csalad) {
  const ELO = [SHOW, csalad === 4 ? { szo: 'ip', sugo: 'IPv4-információk' } : { szo: 'ipv6', sugo: 'IPv6-információk' },
    { szo: 'eigrp', sugo: csalad === 4 ? 'Az EIGRP-folyamat adatai' : 'Az EIGRP IPv6-folyamatának adatai' }];
  const TOPOLOGY = { szo: 'topology', sugo: 'A topológiatábla: minden ismert út, a successorokkal és FD/AD-vel' };
  const l = [
    lista(EXEC, [...ELO, { szo: 'neighbors', sugo: 'A szomszédok (cím, interfész, Hold, uptime)' }], (r) => showEigrpNeighbors(r, csalad)),
    lista(EXEC, [...ELO, TOPOLOGY], (r) => showEigrpTopology(r, csalad)),
    lista(EXEC, [...ELO, TOPOLOGY, { szo: 'all-links', sugo: 'Minden ismert út (a feltételt nem teljesítők is)' }], (r) => showEigrpTopology(r, csalad)),
    lista(EXEC, [...ELO, { szo: 'interfaces', sugo: 'Az EIGRP-ben részt vevő interfészek (a passzívak nélkül)' }], (r) => showEigrpInterfaces(r, csalad)),
  ];
  if (csalad === 4) {
    l.push(lista(EXEC, [...ELO, TOPOLOGY, { param: 'ipv4', kulcs: 'halozat', sugo: 'A célhálózat címe' },
      { param: 'ipv4', kulcs: 'maszk', sugo: 'A célhálózat alhálózati maszkja' }],
    (r, e) => showEigrpTopologyHalozat(r, 4, `${e.halozat}/${prefixHossz(e.maszk)}`)));
  } else {
    l.push(lista(EXEC, [...ELO, TOPOLOGY, { param: 'ipv6-prefix', kulcs: 'pr', sugo: 'A célhálózat (előtag/hossz)' }],
      (r, e) => showEigrpTopologyHalozat(r, 6, `${ipv6Szoveg(ipv6Halozat(ipv6Elemez(e.pr.cim), e.pr.hossz))}/${e.pr.hossz}`)));
  }
  return l;
}

function clearParancs(csalad) {
  return {
    modok: ['priv'],
    szavak: [{ szo: 'clear', sugo: 'Törlés (táblák, számlálók)' }, csalad === 4 ? { szo: 'ip', sugo: 'IPv4' } : { szo: 'ipv6', sugo: 'IPv6' },
      { szo: 'eigrp', sugo: 'EIGRP' }, { szo: 'neighbors', sugo: 'Minden szomszédság újraépítése' }],
    vegrehajt(ctx) {
      eigrpTorol(ctx.eszkoz, csalad);
    },
  };
}

const DBG = [
  ['packets', 'eigrpCsomag', 'A Hello, Update, Query és Reply csomagok', 'EIGRP Packet debugging'],
  ['neighbors', 'eigrpSzomszed', 'A szomszédságok épülése és megszakadása', 'EIGRP Neighbor debugging'],
];

function debugParancsok() {
  const l = [];
  for (const [szo, mezo, sugo, nev] of DBG) {
    const elo = [{ szo: 'eigrp', sugo: 'Az EIGRP üzenetei' }, { szo, sugo }];
    const be = (ertek) => (ctx) => {
      ctx.eszkoz.debug[mezo] = ertek;
      ctx.kiir(`${nev} is ${ertek ? 'on' : 'off'}`);
    };
    l.push({ modok: ['priv'], szavak: [{ szo: 'debug', sugo: 'Hibakereső üzenetek bekapcsolása' }, ...elo], vegrehajt: be(true) });
    l.push({ modok: ['priv'], szavak: [{ szo: 'undebug', sugo: 'Hibakereső üzenetek kikapcsolása' }, ...elo], vegrehajt: be(false) });
    l.push({ modok: ['priv'], szavak: [SZO.no, { szo: 'debug', sugo: 'Hibakereső üzenetek kikapcsolása' }, ...elo], vegrehajt: be(false) });
  }
  for (const csalad of [4, 6]) {
    const elo = [csalad === 4 ? { szo: 'ip', sugo: 'IPv4-es hibakeresés' } : { szo: 'ipv6', sugo: 'IPv6-os hibakeresés' },
      { szo: 'eigrp', sugo: 'A DUAL algoritmus útvonal-döntései' }];
    const be = (ertek) => (ctx) => {
      ctx.eszkoz.debug.eigrp = ertek;
      ctx.kiir(`EIGRP Route Event debugging is ${ertek ? 'on' : 'off'}`);
    };
    l.push({ modok: ['priv'], szavak: [{ szo: 'debug', sugo: 'Hibakereső üzenetek bekapcsolása' }, ...elo], vegrehajt: be(true) });
    l.push({ modok: ['priv'], szavak: [{ szo: 'undebug', sugo: 'Hibakereső üzenetek kikapcsolása' }, ...elo], vegrehajt: be(false) });
  }
  return l;
}

export const eigrpParancsok = [
  ...folyamatParancsok, ...almodParancsok, ...interfeszParancsok,
  ...showParancsok(4), ...showParancsok(6), clearParancs(4), clearParancs(6), ...debugParancsok(),
];
