/**
 * OSPF-parancsok (konfiguráció és exec).
 *
 * Globális konfiguráció:
 *   router ospf <1-65535>                → (config-router)#   [konfig-ospf]
 *   ipv6 router ospf <1-65535>           → (config-rtr)#      [konfig-ospf6]
 * A folyamat almódjában:
 *   router-id, network … area … (csak OSPFv2), passive-interface [default], auto-cost
 *   reference-bandwidth, default-information originate [always], maximum-paths
 * Interfészen:
 *   ip ospf <N> area <A>, ip ospf cost / priority / network / hello-interval / dead-interval,
 *   ip ospf authentication [message-digest | null], ip ospf message-digest-key, ip ospf authentication-key,
 *   ip mtu; ipv6 ospf <N> area <A>, ipv6 ospf cost / priority / network / hello-interval / dead-interval,
 *   ipv6 mtu; description
 * Exec:
 *   show ip ospf [neighbor | interface [brief | <if>] | database], ugyanez ipv6-tal,
 *   clear ip ospf process, clear ipv6 ospf process, debug/undebug ip|ipv6 ospf hello|adj,
 *   write memory
 *
 * A hibaüzenetek formája a valódi eszközt követi (docs/forrasok.md), a súgószövegek saját szövegek.
 */

import { SZO } from './alap.js';
import { routerPort, ujOspf } from '../../../modell/router.js';
import { ospfValtozott, ospfVanSzomszed, ospfTorol } from '../../../mag/ospf.js';
import { ipSzam, ipSzoveg } from '../../../mag/ip.js';
import {
  showOspfNeighbor, showOspfIntBrief, showOspfInterface, showOspfDatabase, showOspf,
} from '../kimenetek/ospf.js';

const IF_MODOK = ['konfig-if', 'konfig-if-tartomany'];
const MINDKET_MOD = ['konfig-ospf', 'konfig-ospf6'];

const IP = { szo: 'ip', sugo: 'IPv4-beállítások' };
const IPV6 = { szo: 'ipv6', sugo: 'IPv6-beállítások' };
const OSPF = { szo: 'ospf', sugo: 'OSPF-beállítások ezen az interfészen' };
const ROUTER = { szo: 'router', sugo: 'Forgalomirányító protokoll indítása / beállítása' };
const FOLYAMAT = { param: 'szam', kulcs: 'id', min: 1, max: 65535, nev: '<1-65535>', sugo: 'A folyamat azonosítója (csak ezen a routeren számít)' };
const AREA = { szo: 'area', sugo: 'A terület (area), amelybe az interfész kerül' };
const TERULET = { param: 'terulet', kulcs: 'terulet', sugo: 'A terület azonosítója' };

/** Melyik család (4: OSPFv2, 6: OSPFv3) a mostani almódban. */
function csaladja(ctx) {
  return ctx.mod === 'konfig-ospf6' ? 6 : 4;
}

function beall(ctx) {
  return csaladja(ctx) === 4 ? ctx.eszkoz.ospf : ctx.eszkoz.ospf6;
}

function portjai(ctx) {
  return ctx.kontextus.portok.map((n) => routerPort(ctx.eszkoz, n)).filter(Boolean);
}

/** Változás után: az OSPF (és a RIP) igazodik, a rajz frissül. */
function valtozott(ctx, csalad) {
  ospfValtozott(ctx.eszkoz, csalad ? { csalad } : {});
  if (ctx.eszkoz.halozat) ctx.eszkoz.halozat.esemeny({ tipus: 'allapot' });
}

function egyFolyamat(ctx, regi, uj) {
  ctx.kiir(`[Szimulátor] Egy routeren egyszerre csak egy OSPF-folyamat futhat (most a(z) ${regi}-es). `
    + `Ha másikat szeretnél, előbb töröld: no router ospf ${regi} (ezt a(z) ${uj}-es helyett írd be).`);
}

// ---------------------------------------------------------------------------
// Globális konfiguráció: a folyamat indítása, törlése
// ---------------------------------------------------------------------------

const folyamatParancsok = [
  {
    modok: ['konfig'],
    szavak: [ROUTER, { szo: 'ospf', sugo: 'OSPF (Open Shortest Path First)' }, FOLYAMAT],
    vegrehajt(ctx, { id }) {
      const r = ctx.eszkoz;
      if (r.ospf && r.ospf.folyamat !== id) return egyFolyamat(ctx, r.ospf.folyamat, id);
      if (!r.ospf) r.ospf = ujOspf(id);
      ctx.modValt('konfig-ospf', { ospf: id });
      valtozott(ctx, 4);
      return undefined;
    },
  },
  {
    modok: ['konfig'],
    szavak: [SZO.no, ROUTER, { szo: 'ospf', sugo: 'Az OSPF-folyamat törlése' }, FOLYAMAT],
    vegrehajt(ctx, { id }) {
      const r = ctx.eszkoz;
      if (!r.ospf || r.ospf.folyamat !== id) return;
      r.ospf = null;
      for (const p of r.portok) if (p.ospf.folyamat === id) Object.assign(p.ospf, { folyamat: null, terulet: null });
      valtozott(ctx, 4);
    },
  },
  {
    modok: ['konfig'],
    szavak: [IPV6, ROUTER, { szo: 'ospf', sugo: 'OSPFv3 (OSPF IPv6-hoz)' }, FOLYAMAT],
    vegrehajt(ctx, { id }) {
      const r = ctx.eszkoz;
      if (!r.ipv6Routing) {
        ctx.kiir('% IPv6 routing not enabled');
        return undefined;
      }
      if (r.ospf6 && r.ospf6.folyamat !== id) return egyFolyamat(ctx, r.ospf6.folyamat, id);
      if (!r.ospf6) r.ospf6 = ujOspf(id);
      ctx.modValt('konfig-ospf6', { ospf6: id });
      valtozott(ctx, 6);
      return undefined;
    },
  },
  {
    modok: ['konfig'],
    szavak: [SZO.no, IPV6, ROUTER, { szo: 'ospf', sugo: 'Az OSPFv3-folyamat törlése' }, FOLYAMAT],
    vegrehajt(ctx, { id }) {
      const r = ctx.eszkoz;
      if (!r.ospf6 || r.ospf6.folyamat !== id) return;
      r.ospf6 = null;
      for (const p of r.portok) if (p.ospf6.folyamat === id) Object.assign(p.ospf6, { folyamat: null, terulet: null });
      valtozott(ctx, 6);
    },
  },
];

// ---------------------------------------------------------------------------
// A folyamat almódja (router ospf / ipv6 router ospf)
// ---------------------------------------------------------------------------

function ujrainditasKell(ctx) {
  const c = csaladja(ctx);
  ctx.kiir(c === 4
    ? '% OSPF: Reload or use "clear ip ospf process" command, for this to take effect'
    : '% OSPFv3: Reload or use "clear ipv6 ospf process" command, for this to take effect');
}

const almodParancsok = [
  {
    modok: MINDKET_MOD,
    szavak: [{ szo: 'router-id', sugo: 'A router azonosítója (router ID) kézzel' }, { param: 'ipv4', kulcs: 'rid', sugo: 'Router ID IP-cím alakban, pl. 1.1.1.1' }],
    vegrehajt(ctx, { rid }) {
      const o = beall(ctx);
      if (rid === '0.0.0.0') {
        ctx.kiir('% OSPF: Invalid router-id');
        return;
      }
      if (o.routerId === rid) return;
      o.routerId = rid;
      if (ospfVanSzomszed(ctx.eszkoz, csaladja(ctx))) ujrainditasKell(ctx);
      valtozott(ctx, csaladja(ctx));
    },
  },
  {
    modok: MINDKET_MOD,
    szavak: [SZO.no, { szo: 'router-id', sugo: 'Vissza az automatikus router ID-ra' }],
    vegrehajt(ctx) {
      const o = beall(ctx);
      if (!o.routerId) return;
      o.routerId = '';
      if (ospfVanSzomszed(ctx.eszkoz, csaladja(ctx))) ujrainditasKell(ctx);
      valtozott(ctx, csaladja(ctx));
    },
  },
  {
    modok: ['konfig-ospf'],
    szavak: [{ szo: 'network', sugo: 'Ezeken az interfészeken fusson az OSPF (cím + wildcard maszk + terület)' },
      { param: 'ipv4', kulcs: 'cim', sugo: 'Hálózatcím (vagy az interfész címe)' },
      { param: 'ipv4', kulcs: 'wc', sugo: 'Wildcard maszk (0 = egyeznie kell, 1 = bármi lehet), pl. 0.0.0.255' },
      AREA, TERULET],
    vegrehajt(ctx, { cim, wc, terulet }) {
      const o = ctx.eszkoz.ospf;
      const n = ipSzoveg((ipSzam(cim) & ~ipSzam(wc)) >>> 0);
      const regi = o.halozatok.find((x) => x.cim === n && x.wildcard === wc);
      if (regi) {
        if (regi.terulet !== terulet) ctx.kiir(`% OSPF: "network ${n} ${wc}" is already configured in area ${regi.terulet}`);
        return;
      }
      o.halozatok.push({ cim: n, wildcard: wc, terulet });
      valtozott(ctx, 4);
    },
  },
  {
    modok: ['konfig-ospf'],
    szavak: [SZO.no, { szo: 'network', sugo: 'Egy network parancs törlése' },
      { param: 'ipv4', kulcs: 'cim', sugo: 'Hálózatcím' }, { param: 'ipv4', kulcs: 'wc', sugo: 'Wildcard maszk' }, AREA, TERULET],
    vegrehajt(ctx, { cim, wc, terulet }) {
      const o = ctx.eszkoz.ospf;
      const n = ipSzoveg((ipSzam(cim) & ~ipSzam(wc)) >>> 0);
      const elotte = o.halozatok.length;
      o.halozatok = o.halozatok.filter((x) => !(x.cim === n && x.wildcard === wc && x.terulet === terulet));
      if (o.halozatok.length === elotte) ctx.kiir('% OSPF: Specified network not found');
      valtozott(ctx, 4);
    },
  },
  {
    modok: MINDKET_MOD,
    szavak: [{ szo: 'passive-interface', sugo: 'Ezen az interfészen nincs Hello (a hálózatát továbbra is hirdeti)' },
      { param: 'interfesz', kulcs: 'interfesz', sugo: 'Az interfész neve' }],
    vegrehajt(ctx, { interfesz }) {
      const o = beall(ctx);
      if (!routerPort(ctx.eszkoz, interfesz)) return;
      if (o.passzivAlap) o.nemPassziv = o.nemPassziv.filter((x) => x !== interfesz);
      else if (!o.passziv.includes(interfesz)) o.passziv.push(interfesz);
      valtozott(ctx, csaladja(ctx));
    },
  },
  {
    modok: MINDKET_MOD,
    szavak: [SZO.no, { szo: 'passive-interface', sugo: 'Az interfész ismét küld Hellót' },
      { param: 'interfesz', kulcs: 'interfesz', sugo: 'Az interfész neve' }],
    vegrehajt(ctx, { interfesz }) {
      const o = beall(ctx);
      if (o.passzivAlap) {
        if (!o.nemPassziv.includes(interfesz)) o.nemPassziv.push(interfesz);
      } else {
        o.passziv = o.passziv.filter((x) => x !== interfesz);
      }
      valtozott(ctx, csaladja(ctx));
    },
  },
  {
    modok: MINDKET_MOD,
    szavak: [{ szo: 'passive-interface', sugo: 'Ezen az interfészen nincs Hello (a hálózatát továbbra is hirdeti)' },
      { szo: 'default', sugo: 'Minden interfész passzív (a kivételeket „no passive-interface …” jelöli)' }],
    vegrehajt(ctx) {
      const o = beall(ctx);
      o.passzivAlap = true;
      o.nemPassziv = [];
      o.passziv = [];
      valtozott(ctx, csaladja(ctx));
    },
  },
  {
    modok: MINDKET_MOD,
    szavak: [SZO.no, { szo: 'passive-interface', sugo: 'Az interfész ismét küld Hellót' },
      { szo: 'default', sugo: 'Alapból egyik interfész se legyen passzív' }],
    vegrehajt(ctx) {
      const o = beall(ctx);
      o.passzivAlap = false;
      o.nemPassziv = [];
      o.passziv = [];
      valtozott(ctx, csaladja(ctx));
    },
  },
  {
    modok: MINDKET_MOD,
    szavak: [{ szo: 'auto-cost', sugo: 'A költség számítása a sávszélességből' },
      { szo: 'reference-bandwidth', sugo: 'A referencia-sávszélesség (ennyi Mbit/s-os link költsége 1)' },
      { param: 'szam', kulcs: 'mbps', min: 1, max: 4294967, nev: '<1-4294967>', sugo: 'Mbit/s-ban (alapból 100)' }],
    vegrehajt(ctx, { mbps }) {
      beall(ctx).referencia = mbps;
      ctx.kiir(`% ${csaladja(ctx) === 4 ? 'OSPF' : 'OSPFv3'}: Reference bandwidth is changed.`, '        Please ensure reference bandwidth is consistent across all routers.');
      valtozott(ctx, csaladja(ctx));
    },
  },
  {
    modok: MINDKET_MOD,
    szavak: [SZO.no, { szo: 'auto-cost', sugo: 'A költség számítása a sávszélességből' },
      { szo: 'reference-bandwidth', sugo: 'Vissza az alapértékre (100 Mbit/s)' }],
    vegrehajt(ctx) {
      beall(ctx).referencia = 100;
      ctx.kiir(`% ${csaladja(ctx) === 4 ? 'OSPF' : 'OSPFv3'}: Reference bandwidth is changed.`, '        Please ensure reference bandwidth is consistent across all routers.');
      valtozott(ctx, csaladja(ctx));
    },
  },
  ...[false, true].map((always) => ({
    modok: MINDKET_MOD,
    szavak: [{ szo: 'default-information', sugo: 'Alapértelmezett útvonal hirdetése' },
      { szo: 'originate', sugo: 'Az alapértelmezett útvonal hirdetése (ha a routernek van ilyen)' },
      ...(always ? [{ szo: 'always', sugo: 'Akkor is hirdesse, ha a routernek nincs alapértelmezett útvonala' }] : [])],
    vegrehajt(ctx) {
      beall(ctx).alapUtvonal = always ? 'always' : 'originate';
      valtozott(ctx, csaladja(ctx));
    },
  })),
  {
    modok: MINDKET_MOD,
    szavak: [SZO.no, { szo: 'default-information', sugo: 'Az alapértelmezett útvonal hirdetésének kikapcsolása' },
      { szo: 'originate', sugo: 'Az alapértelmezett útvonal hirdetése' }],
    vegrehajt(ctx) {
      beall(ctx).alapUtvonal = '';
      valtozott(ctx, csaladja(ctx));
    },
  },
  {
    modok: MINDKET_MOD,
    szavak: [{ szo: 'maximum-paths', sugo: 'Legfeljebb ennyi egyenlő költségű utat használ' },
      { param: 'szam', kulcs: 'n', min: 1, max: 32, nev: '<1-32>', sugo: 'Az utak száma (alapból 4)' }],
    vegrehajt(ctx, { n }) {
      beall(ctx).maxUtak = n;
      valtozott(ctx, csaladja(ctx));
    },
  },
  {
    modok: MINDKET_MOD,
    szavak: [SZO.no, { szo: 'maximum-paths', sugo: 'Vissza az alapértékre (4)' }],
    vegrehajt(ctx) {
      beall(ctx).maxUtak = 4;
      valtozott(ctx, csaladja(ctx));
    },
  },
];

// ---------------------------------------------------------------------------
// Interfész-parancsok
// ---------------------------------------------------------------------------

/** Az „ip ospf …” és „ipv6 ospf …” közös parancsai (cost, priority, network, időzítők). */
function kozosInterfesz(csalad) {
  const ELO = csalad === 4 ? [IP, OSPF] : [IPV6, { ...OSPF, sugo: 'OSPFv3-beállítások ezen az interfészen' }];
  const NO = [SZO.no, ...ELO];
  const pb = (p) => (csalad === 4 ? p.ospf : p.ospf6);
  const allit = (mezo, ertek) => (ctx, e) => {
    for (const p of portjai(ctx)) pb(p)[mezo] = typeof ertek === 'function' ? ertek(e) : ertek;
    valtozott(ctx, csalad);
  };
  return [
    {
      modok: IF_MODOK,
      szavak: [...ELO, FOLYAMAT, AREA, TERULET],
      vegrehajt(ctx, { id, terulet }) {
        const r = ctx.eszkoz;
        if (csalad === 6 && !r.ipv6Routing) {
          ctx.kiir('% IPv6 routing not enabled');
          return undefined;
        }
        const o = csalad === 4 ? r.ospf : r.ospf6;
        if (o && o.folyamat !== id) return egyFolyamat(ctx, o.folyamat, id);
        // Ha még nincs ilyen folyamat, az eszköz létrehozza (router ospf N / ipv6 router ospf N).
        if (!o) {
          if (csalad === 4) r.ospf = ujOspf(id);
          else r.ospf6 = ujOspf(id);
        }
        for (const p of portjai(ctx)) Object.assign(pb(p), { folyamat: id, terulet });
        valtozott(ctx, csalad);
        return undefined;
      },
    },
    {
      modok: IF_MODOK,
      szavak: [...NO, FOLYAMAT, AREA, TERULET],
      vegrehajt(ctx, { id }) {
        for (const p of portjai(ctx)) if (pb(p).folyamat === id) Object.assign(pb(p), { folyamat: null, terulet: null });
        valtozott(ctx, csalad);
      },
    },
    {
      modok: IF_MODOK,
      szavak: [...ELO, { szo: 'cost', sugo: 'Az interfész költsége kézzel (felülírja a számoltat)' },
        { param: 'szam', kulcs: 'n', min: 1, max: 65535, nev: '<1-65535>', sugo: 'Költség' }],
      vegrehajt: allit('koltseg', (e) => e.n),
    },
    { modok: IF_MODOK, szavak: [...NO, { szo: 'cost', sugo: 'Vissza a sávszélességből számolt költségre' }], vegrehajt: allit('koltseg', null) },
    {
      modok: IF_MODOK,
      szavak: [...ELO, { szo: 'priority', sugo: 'Prioritás a DR/BDR-választáshoz' },
        { param: 'szam', kulcs: 'n', min: 0, max: 255, nev: '<0-255>', sugo: 'Prioritás (alapból 1; 0 = soha nem lesz DR/BDR)' }],
      vegrehajt: allit('prioritas', (e) => e.n),
    },
    { modok: IF_MODOK, szavak: [...NO, { szo: 'priority', sugo: 'Vissza az alapértékre (1)' }], vegrehajt: allit('prioritas', 1) },
    ...['point-to-point', 'broadcast'].map((t) => ({
      modok: IF_MODOK,
      szavak: [...ELO, { szo: 'network', sugo: 'A hálózattípus kézi megadása' },
        t === 'point-to-point'
          ? { szo: 'point-to-point', sugo: 'Pont-pont: két router, nincs DR/BDR-választás' }
          : { szo: 'broadcast', sugo: 'Többhozzáférésű (pl. Ethernet): DR/BDR-választással' }],
      vegrehajt: allit('halozatTipus', t),
    })),
    { modok: IF_MODOK, szavak: [...NO, { szo: 'network', sugo: 'Vissza az interfész alapértelmezett hálózattípusára' }], vegrehajt: allit('halozatTipus', '') },
    {
      modok: IF_MODOK,
      szavak: [...ELO, { szo: 'hello-interval', sugo: 'Ennyi másodpercenként küld Hellót (a szomszéddal egyeznie kell)' },
        { param: 'szam', kulcs: 'n', min: 1, max: 65535, nev: '<1-65535>', sugo: 'Másodperc (alapból 10)' }],
      vegrehajt: allit('hello', (e) => e.n),
    },
    { modok: IF_MODOK, szavak: [...NO, { szo: 'hello-interval', sugo: 'Vissza az alapértékre (10 mp)' }], vegrehajt: allit('hello', null) },
    {
      modok: IF_MODOK,
      szavak: [...ELO, { szo: 'dead-interval', sugo: 'Ennyi másodperc Hello nélkül = a szomszéd halott (egyeznie kell)' },
        { param: 'szam', kulcs: 'n', min: 1, max: 65535, nev: '<1-65535>', sugo: 'Másodperc (alapból a Hello négyszerese)' }],
      vegrehajt: allit('dead', (e) => e.n),
    },
    { modok: IF_MODOK, szavak: [...NO, { szo: 'dead-interval', sugo: 'Vissza az alapértékre (a Hello négyszerese)' }], vegrehajt: allit('dead', null) },
  ];
}

const hitelesitesParancsok = [
  ...[['', ''], ['message-digest', 'md5'], ['null', 'null']].map(([szo, ertek]) => ({
    modok: IF_MODOK,
    szavak: [IP, OSPF, { szo: 'authentication', sugo: 'Hitelesítés ezen az interfészen' },
      ...(szo === 'message-digest' ? [{ szo: 'message-digest', sugo: 'MD5-hitelesítés (a kulcs: ip ospf message-digest-key)' }]
        : szo === 'null' ? [{ szo: 'null', sugo: 'Nincs hitelesítés (felülírja a terület beállítását)' }] : [])],
    vegrehajt(ctx) {
      for (const p of portjai(ctx)) p.ospf.hitelesites = ertek || 'egyszeru';
      valtozott(ctx, 4);
    },
  })),
  {
    modok: IF_MODOK,
    szavak: [SZO.no, IP, OSPF, { szo: 'authentication', sugo: 'A hitelesítés kikapcsolása' }],
    vegrehajt(ctx) {
      for (const p of portjai(ctx)) p.ospf.hitelesites = '';
      valtozott(ctx, 4);
    },
  },
  {
    modok: IF_MODOK,
    szavak: [IP, OSPF, { szo: 'message-digest-key', sugo: 'MD5-kulcs (a szomszéddal azonos számmal és jelszóval)' },
      { param: 'szam', kulcs: 'n', min: 1, max: 255, nev: '<1-255>', sugo: 'A kulcs száma' },
      { szo: 'md5', sugo: 'MD5-algoritmus' }, { param: 'szo', kulcs: 'jelszo', nev: 'LINE', sugo: 'A jelszó (legfeljebb 16 karakter)', maxHossz: 16 }],
    vegrehajt(ctx, { n, jelszo }) {
      for (const p of portjai(ctx)) {
        if (p.ospf.kulcsok[n] !== undefined && p.ospf.kulcsok[n] !== jelszo) {
          ctx.kiir(`OSPF: Key ${n} already exists`);
          continue;
        }
        p.ospf.kulcsok[n] = jelszo;
      }
      valtozott(ctx, 4);
    },
  },
  {
    modok: IF_MODOK,
    szavak: [SZO.no, IP, OSPF, { szo: 'message-digest-key', sugo: 'Egy MD5-kulcs törlése' },
      { param: 'szam', kulcs: 'n', min: 1, max: 255, nev: '<1-255>', sugo: 'A kulcs száma' }],
    vegrehajt(ctx, { n }) {
      for (const p of portjai(ctx)) delete p.ospf.kulcsok[n];
      valtozott(ctx, 4);
    },
  },
  {
    modok: IF_MODOK,
    szavak: [IP, OSPF, { szo: 'authentication-key', sugo: 'Egyszerű (titkosítatlan) jelszó' },
      { param: 'szo', kulcs: 'jelszo', nev: 'LINE', sugo: 'A jelszó (legfeljebb 8 karakter)', maxHossz: 8 }],
    vegrehajt(ctx, { jelszo }) {
      for (const p of portjai(ctx)) p.ospf.jelszo = jelszo;
      valtozott(ctx, 4);
    },
  },
  {
    modok: IF_MODOK,
    szavak: [SZO.no, IP, OSPF, { szo: 'authentication-key', sugo: 'Az egyszerű jelszó törlése' }],
    vegrehajt(ctx) {
      for (const p of portjai(ctx)) p.ospf.jelszo = '';
      valtozott(ctx, 4);
    },
  },
];

const egyebInterfesz = [
  {
    modok: IF_MODOK,
    szavak: [IP, { szo: 'mtu', sugo: 'Az IPv4-csomagok legnagyobb mérete ezen az interfészen' },
      { param: 'szam', kulcs: 'n', min: 68, max: 1500, nev: '<68-1500>', sugo: 'Bájt (alapból 1500)' }],
    vegrehajt(ctx, { n }) {
      for (const p of portjai(ctx)) p.mtu = n === 1500 ? null : n;
      valtozott(ctx, 4);
    },
  },
  {
    modok: IF_MODOK,
    szavak: [SZO.no, IP, { szo: 'mtu', sugo: 'Vissza az alapértékre (1500)' }],
    vegrehajt(ctx) {
      for (const p of portjai(ctx)) p.mtu = null;
      valtozott(ctx, 4);
    },
  },
  {
    modok: IF_MODOK,
    szavak: [IPV6, { szo: 'mtu', sugo: 'Az IPv6-csomagok legnagyobb mérete ezen az interfészen' },
      { param: 'szam', kulcs: 'n', min: 1280, max: 1500, nev: '<1280-1500>', sugo: 'Bájt (alapból 1500)' }],
    vegrehajt(ctx, { n }) {
      for (const p of portjai(ctx)) p.mtu6 = n === 1500 ? null : n;
      valtozott(ctx, 6);
    },
  },
  {
    modok: IF_MODOK,
    szavak: [SZO.no, IPV6, { szo: 'mtu', sugo: 'Vissza az alapértékre (1500)' }],
    vegrehajt(ctx) {
      for (const p of portjai(ctx)) p.mtu6 = null;
      valtozott(ctx, 6);
    },
  },
  {
    modok: IF_MODOK,
    szavak: [{ szo: 'description', sugo: 'Szöveges leírás az interfészhez (pl. merre megy)' },
      { param: 'sor', kulcs: 'szoveg', nev: 'LINE', sugo: 'A leírás (legfeljebb 200 karakter)' }],
    vegrehajt(ctx, { szoveg }) {
      for (const p of portjai(ctx)) p.leiras = szoveg.slice(0, 200);
    },
  },
  {
    modok: IF_MODOK,
    szavak: [SZO.no, { szo: 'description', sugo: 'A leírás törlése' }],
    vegrehajt(ctx) {
      for (const p of portjai(ctx)) p.leiras = '';
    },
  },
];

// ---------------------------------------------------------------------------
// Exec: show, clear, debug, write
// ---------------------------------------------------------------------------

const EXEC = ['felhasznalo', 'priv'];
const SHOW = { szo: 'show', sugo: 'Információk megjelenítése az eszközről' };

function lista(modok, szavak, fn) {
  return { modok, szavak, lapozhato: true, vegrehajt: (ctx, e) => ctx.kiir(...fn(ctx.eszkoz, e)) };
}

function showParancsok(csalad) {
  const ELO = [SHOW, csalad === 4 ? { szo: 'ip', sugo: 'IPv4-információk' } : { szo: 'ipv6', sugo: 'IPv6-információk' },
    { szo: 'ospf', sugo: csalad === 4 ? 'Az OSPF-folyamat adatai' : 'Az OSPFv3-folyamat adatai' }];
  const IFACE = { szo: 'interface', sugo: 'Az OSPF-interfészek: költség, állapot, időzítők, DR/BDR' };
  return [
    lista(EXEC, ELO, (r) => showOspf(r, csalad)),
    lista(EXEC, [...ELO, { szo: 'neighbor', sugo: 'A szomszédok és a szomszédság állapota' }], (r) => showOspfNeighbor(r, csalad)),
    lista(EXEC, [...ELO, IFACE], (r) => showOspfInterface(r, csalad)),
    lista(EXEC, [...ELO, IFACE, { szo: 'brief', sugo: 'Rövid táblázat interfészenként' }], (r) => showOspfIntBrief(r, csalad)),
    lista(EXEC, [...ELO, IFACE, { param: 'interfesz', kulcs: 'interfesz', sugo: 'Az interfész neve' }], (r, e) => showOspfInterface(r, csalad, e.interfesz)),
    lista(EXEC, [...ELO, { szo: 'database', sugo: 'A link-state adatbázis (LSDB): az összegyűjtött LSA-k' }], (r) => showOspfDatabase(r, csalad)),
  ];
}

function clearParancs(csalad) {
  return {
    modok: ['priv'],
    szavak: [{ szo: 'clear', sugo: 'Törlés (táblák, számlálók)' }, csalad === 4 ? { szo: 'ip', sugo: 'IPv4' } : { szo: 'ipv6', sugo: 'IPv6' },
      { szo: 'ospf', sugo: csalad === 4 ? 'OSPF' : 'OSPFv3' }, { szo: 'process', sugo: 'A folyamat újraindítása (minden szomszédság újraépül)' }],
    vegrehajt(ctx) {
      const r = ctx.eszkoz;
      if (!(csalad === 4 ? r.ospf : r.ospf6)) return;
      ctx.kerdez(csalad === 4 ? 'Reset ALL OSPF processes? [no]: ' : 'Reset ALL OSPFv3 processes? [no]: ', (valasz) => {
        const v = valasz.trim().toLowerCase();
        if (v === 'y' || v === 'yes') ospfTorol(r, csalad);
      });
    },
  };
}

const DBG_NEV = {
  ospfHello: 'OSPF hello debugging is', ospfAdj: 'OSPF adjacency debugging is',
  ospf6Hello: 'OSPFv3 hello debugging is', ospf6Adj: 'OSPFv3 adjacency debugging is',
};

function debugParancsok() {
  const l = [];
  for (const csalad of [4, 6]) {
    for (const [szo, mezo, sugo] of [['hello', 'Hello', 'A Hello csomagok (küldés, fogadás, eltérések)'], ['adj', 'Adj', 'A szomszédság felépülése (DBD, DR/BDR, hitelesítés)']]) {
      const kulcs = `${csalad === 4 ? 'ospf' : 'ospf6'}${mezo}`;
      const elo = [csalad === 4 ? { szo: 'ip', sugo: 'IPv4-es hibakeresés' } : { szo: 'ipv6', sugo: 'IPv6-os hibakeresés' },
        { szo: 'ospf', sugo: csalad === 4 ? 'Az OSPF üzenetei' : 'Az OSPFv3 üzenetei' }, { szo: szo, sugo }];
      const be = (ertek) => (ctx) => {
        ctx.eszkoz.debug[kulcs] = ertek;
        ctx.kiir(`${DBG_NEV[kulcs]} ${ertek ? 'on' : 'off'}`);
      };
      l.push({ modok: ['priv'], szavak: [{ szo: 'debug', sugo: 'Hibakereső üzenetek bekapcsolása' }, ...elo], vegrehajt: be(true) });
      l.push({ modok: ['priv'], szavak: [{ szo: 'undebug', sugo: 'Hibakereső üzenetek kikapcsolása' }, ...elo], vegrehajt: be(false) });
    }
  }
  return l;
}

function mentes(ctx) {
  ctx.kiir('Building configuration...', '[OK]');
}

const execParancsok = [
  ...showParancsok(4),
  ...showParancsok(6),
  clearParancs(4),
  clearParancs(6),
  ...debugParancsok(),
  { modok: ['priv'], szavak: [{ szo: 'write', sugo: 'A konfiguráció mentése' }], vegrehajt: mentes },
  { modok: ['priv'], szavak: [{ szo: 'write', sugo: 'A konfiguráció mentése' }, { szo: 'memory', sugo: 'A futó konfiguráció mentése az indulóba (startup-config)' }], vegrehajt: mentes },
];

export const ospfParancsok = [
  ...folyamatParancsok, ...almodParancsok, ...kozosInterfesz(4), ...kozosInterfesz(6), ...hitelesitesParancsok,
  ...egyebInterfesz, ...execParancsok,
];

