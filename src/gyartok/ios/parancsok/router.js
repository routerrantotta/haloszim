/**
 * Router-parancsok (konfiguráció): interfészcímek, statikus útvonalak, RIP és RIPng.
 *
 *   interface <név>                      (Loopback is létrehozható)
 *   ip address <cím> <maszk> | no ip address
 *   ipv6 address <cím>/<hossz> | ipv6 address <cím> link-local | ipv6 enable | no ipv6 address
 *   ipv6 rip <NÉV> enable | ipv6 rip <NÉV> default-information originate|only
 *   clock rate <bit/s>, bandwidth <kbit/s>   (eltárolja; a működést nem befolyásolja)
 *   ip route <hálózat> <maszk> <következő ugrás | interfész>
 *   ipv6 unicast-routing | ipv6 route <előtag> <következő ugrás | interfész>
 *   router rip → version, network, passive-interface, auto-summary, default-information originate, timers basic
 *   ipv6 router rip <NÉV>
 *
 * A hibaüzenetek formája a valódi eszközt követi (docs/forrasok.md), a súgószövegek saját szövegek.
 */

import { SZO } from './alap.js';
import { routerPort, loopbackLetrehoz, ujRip } from '../../../modell/router.js';
import { ripValtozott } from '../../../mag/rip.js';
import { ospfValtozott } from '../../../mag/ospf.js';
import {
  ipSzam, ipSzoveg, ervenyesMaszk, prefixHossz, halozatSzam, osztalyos, maszkSzam,
} from '../../../mag/ip.js';
import { ipv6Elemez, ipv6Szoveg, ipv6Halozat, ipv6EgyHalozat, linkLocalE, csoportcimE } from '../../../mag/ipv6.js';

const IP = { szo: 'ip', sugo: 'IPv4-beállítások' };
const IPV6 = { szo: 'ipv6', sugo: 'IPv6-beállítások' };
const ADDRESS = { szo: 'address', sugo: 'Az interfész címe' };
const ROUTE = { szo: 'route', sugo: 'Statikus útvonal' };
const RIP = { szo: 'rip', sugo: 'RIP (Routing Information Protocol)' };
const ROUTER = { szo: 'router', sugo: 'Forgalomirányító protokoll indítása / beállítása' };
const IF_MODOK = ['konfig-if', 'konfig-if-tartomany'];
/** A címbeállítás csak egyetlen interfészen értelmes (egy cím nem lehet több interfészen). */
const EGY_IF = ['konfig-if'];

function portjai(ctx) {
  return ctx.kontextus.portok.map((n) => routerPort(ctx.eszkoz, n)).filter(Boolean);
}

/** Változás után: a RIP kihirdeti, az OSPF igazodik (cím, interfész, statikus útvonal), a rajz frissül. */
function valtozott(ctx, b) {
  ripValtozott(ctx.eszkoz, b);
  ospfValtozott(ctx.eszkoz);
  if (ctx.eszkoz.halozat) ctx.eszkoz.halozat.esemeny({ tipus: 'allapot' });
}

/** A maszk hexadecimálisan (a „Bad mask” üzenethez): 0xFFFFFF00 */
function hexMaszk(m) {
  return '0x' + (ipSzam(m) >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

// ---------------------------------------------------------------------------
// Interfész-szintű parancsok
// ---------------------------------------------------------------------------

const interfeszParancsokR = [
  {
    modok: ['konfig'],
    szavak: [{ szo: 'interface', sugo: 'Interfész (port) kiválasztása a beállításhoz' }, { param: 'interfesz', kulcs: 'interfesz', sugo: 'Az interfész neve' }],
    vegrehajt(ctx, { interfesz }) {
      if (/^Loopback/.test(interfesz) && !routerPort(ctx.eszkoz, interfesz)) {
        loopbackLetrehoz(ctx.eszkoz, Number(interfesz.slice(8)));
        ctx.naplo(`%LINK-3-UPDOWN: Interface ${interfesz}, changed state to up`);
        ctx.naplo(`%LINEPROTO-5-UPDOWN: Line protocol on Interface ${interfesz}, changed state to up`);
        valtozott(ctx);
      }
      ctx.modValt('konfig-if', { portok: [interfesz] });
    },
  },
  {
    modok: EGY_IF,
    szavak: [IP, ADDRESS, { param: 'ipv4', kulcs: 'cim', sugo: 'IP-cím' }, { param: 'ipv4', kulcs: 'maszk', sugo: 'Alhálózati maszk' }],
    vegrehajt(ctx, { cim, maszk }) {
      const p = portjai(ctx)[0];
      if (!ervenyesMaszk(maszk)) {
        ctx.kiir(`Bad mask ${hexMaszk(maszk)} for address ${cim}`);
        return;
      }
      const h = prefixHossz(maszk);
      const n = ipSzam(cim);
      const elso = n >>> 24;
      if (h < 31 && ((n & ~maszkSzam(h)) >>> 0 === 0 || (n | ~maszkSzam(h)) >>> 0 === 0xffffffff)) {
        ctx.kiir(`Bad mask /${h} for address ${cim}`);
        return;
      }
      if (elso === 0 || elso === 127 || elso >= 224) {
        ctx.kiir(`Not a valid host address - ${cim}`);
        return;
      }
      // Átfedés egy másik interfész hálózatával
      for (const q of ctx.eszkoz.portok) {
        if (q === p || !q.ip) continue;
        const hq = Math.min(h, prefixHossz(q.maszk));
        if (halozatSzam(ipSzam(q.ip), hq) === halozatSzam(n, hq)) {
          ctx.kiir(`% ${ipSzoveg(halozatSzam(n, h))} overlaps with ${q.nev}`);
          return;
        }
      }
      p.ip = cim;
      p.maszk = maszk;
      for (const k of Object.keys(ctx.eszkoz.arpTabla)) if (ctx.eszkoz.arpTabla[k].port === p.nev) delete ctx.eszkoz.arpTabla[k];
      valtozott(ctx, { keres: true, csalad: 4 });
    },
  },
  {
    modok: IF_MODOK,
    szavak: [SZO.no, IP, { szo: 'address', sugo: 'Az IPv4-cím törlése' }],
    vegrehajt(ctx) {
      for (const p of portjai(ctx)) {
        p.ip = '';
        p.maszk = '';
      }
      valtozott(ctx, { csalad: 4 });
    },
  },
  {
    // ipv6 address 2001:DB8:ACAD:1::1/64
    modok: EGY_IF,
    szavak: [IPV6, ADDRESS, { param: 'ipv6-prefix', kulcs: 'pr', sugo: 'IPv6-cím és előtaghossz (pl. 2001:DB8:1::1/64)' }],
    vegrehajt(ctx, { pr }) {
      const p = portjai(ctx)[0];
      const c = ipv6Elemez(pr.cim);
      if (linkLocalE(c)) {
        ctx.kiir('% Use the link-local keyword to configure a link-local address');
        return;
      }
      if (csoportcimE(c) || pr.hossz === 0) {
        ctx.kiir(`% Invalid address ${pr.cim}/${pr.hossz}`);
        return;
      }
      for (const q of ctx.eszkoz.portok) {
        if (q === p) continue;
        for (const x of q.ipv6) {
          const hl = Math.min(x.hossz, pr.hossz);
          if (ipv6EgyHalozat(ipv6Elemez(x.cim), c, hl)) {
            ctx.kiir(`% ${ipv6Szoveg(ipv6Halozat(c, pr.hossz))}/${pr.hossz} overlaps with ${q.nev}`);
            return;
          }
        }
      }
      if (!p.ipv6.some((x) => x.cim === pr.cim)) p.ipv6.push({ cim: pr.cim, hossz: pr.hossz });
      valtozott(ctx, { keres: true, csalad: 6 });
    },
  },
  {
    // ipv6 address FE80::1 link-local
    modok: IF_MODOK,
    szavak: [IPV6, ADDRESS, { param: 'ipv6', kulcs: 'cim', sugo: 'IPv6-cím (link-local címhez)' },
      { szo: 'link-local', sugo: 'Ez a cím legyen az interfész link-local címe' }],
    vegrehajt(ctx, { cim }) {
      if (!linkLocalE(ipv6Elemez(cim))) {
        ctx.kiir(`% Invalid link-local address ${cim}`);
        return;
      }
      for (const p of portjai(ctx)) p.linkLocal = cim;
      valtozott(ctx, { keres: true, csalad: 6 });
    },
  },
  {
    modok: IF_MODOK,
    szavak: [SZO.no, IPV6, { szo: 'address', sugo: 'Az IPv6-címek törlése' }],
    vegrehajt(ctx) {
      for (const p of portjai(ctx)) {
        p.ipv6 = [];
        p.linkLocal = '';
      }
      valtozott(ctx, { csalad: 6 });
    },
  },
  {
    modok: IF_MODOK,
    szavak: [SZO.no, IPV6, ADDRESS, { param: 'ipv6-prefix', kulcs: 'pr', sugo: 'A törlendő IPv6-cím' }],
    vegrehajt(ctx, { pr }) {
      for (const p of portjai(ctx)) p.ipv6 = p.ipv6.filter((x) => !(x.cim === pr.cim && x.hossz === pr.hossz));
      valtozott(ctx, { csalad: 6 });
    },
  },
  {
    modok: IF_MODOK,
    szavak: [IPV6, { szo: 'enable', sugo: 'IPv6 bekapcsolása (csak link-local címmel)' }],
    vegrehajt(ctx) {
      for (const p of portjai(ctx)) p.ipv6Be = true;
      valtozott(ctx, { keres: true, csalad: 6 });
    },
  },
  {
    modok: IF_MODOK,
    szavak: [SZO.no, IPV6, { szo: 'enable', sugo: 'Az IPv6 kikapcsolása (ha nincs globális cím)' }],
    vegrehajt(ctx) {
      for (const p of portjai(ctx)) p.ipv6Be = false;
      valtozott(ctx, { csalad: 6 });
    },
  },
  {
    modok: IF_MODOK,
    szavak: [IPV6, { szo: 'rip', sugo: 'RIPng ezen az interfészen' }, { param: 'szo', kulcs: 'nev', nev: 'WORD', sugo: 'A RIPng-folyamat neve' },
      { szo: 'enable', sugo: 'RIPng bekapcsolása ezen az interfészen' }],
    vegrehajt(ctx, { nev }) {
      const r = ctx.eszkoz;
      if (!r.ipv6Routing) {
        ctx.kiir('% IPv6 routing not enabled');
        return;
      }
      if (!r.ripng[nev]) r.ripng[nev] = {};
      for (const p of portjai(ctx)) p.ripng = nev;
      valtozott(ctx, { keres: true, csalad: 6 });
    },
  },
  {
    modok: IF_MODOK,
    szavak: [SZO.no, IPV6, { szo: 'rip', sugo: 'RIPng ezen az interfészen' }, { param: 'szo', kulcs: 'nev', nev: 'WORD', sugo: 'A RIPng-folyamat neve' },
      { szo: 'enable', sugo: 'RIPng kikapcsolása ezen az interfészen' }],
    vegrehajt(ctx, { nev }) {
      for (const p of portjai(ctx)) {
        if (p.ripng === nev) {
          p.ripng = '';
          p.ripngAlap = '';
        }
      }
      valtozott(ctx, { csalad: 6 });
    },
  },
  ...['originate', 'only'].map((mit) => ({
    modok: IF_MODOK,
    szavak: [IPV6, { szo: 'rip', sugo: 'RIPng ezen az interfészen' }, { param: 'szo', kulcs: 'nev', nev: 'WORD', sugo: 'A RIPng-folyamat neve' },
      { szo: 'default-information', sugo: 'Alapértelmezett útvonal (::/0) hirdetése ezen az interfészen' },
      mit === 'originate'
        ? { szo: 'originate', sugo: 'A ::/0 hirdetése a többi útvonallal együtt' }
        : { szo: 'only', sugo: 'Csak a ::/0 hirdetése (a többi útvonal nélkül)' }],
    vegrehajt(ctx, { nev }) {
      const r = ctx.eszkoz;
      if (!r.ipv6Routing) {
        ctx.kiir('% IPv6 routing not enabled');
        return;
      }
      if (!r.ripng[nev]) r.ripng[nev] = {};
      for (const p of portjai(ctx)) {
        if (p.ripng && p.ripng !== nev) continue;
        p.ripngAlap = mit;
      }
      valtozott(ctx, { csalad: 6 });
    },
  })),
  {
    modok: IF_MODOK,
    szavak: [SZO.no, IPV6, { szo: 'rip', sugo: 'RIPng ezen az interfészen' }, { param: 'szo', kulcs: 'nev', nev: 'WORD', sugo: 'A RIPng-folyamat neve' },
      { szo: 'default-information', sugo: 'Az alapértelmezett útvonal hirdetésének kikapcsolása' }],
    vegrehajt(ctx) {
      for (const p of portjai(ctx)) p.ripngAlap = '';
      valtozott(ctx, { csalad: 6 });
    },
  },
  {
    modok: IF_MODOK,
    szavak: [{ szo: 'clock', sugo: 'Órajel (soros vonal DCE oldalán)' }, { szo: 'rate', sugo: 'Az órajel sebessége' },
      { param: 'szam', kulcs: 'n', min: 1200, max: 8000000, nev: '<1200-8000000>', sugo: 'Bit/másodperc' }],
    vegrehajt(ctx, { n }) {
      for (const p of portjai(ctx)) {
        if (p.tipus !== 'Serial') {
          ctx.kiir('[Szimulátor] Órajelet csak soros interfészen lehet megadni.');
          continue;
        }
        p.orajel = n;
      }
    },
  },
  {
    modok: IF_MODOK,
    szavak: [{ szo: 'bandwidth', sugo: 'Az interfész sávszélessége (a protokollok számolnak vele, a RIP nem)' },
      { param: 'szam', kulcs: 'n', min: 1, max: 10000000, nev: '<1-10000000>', sugo: 'Sávszélesség kbit/s-ban' }],
    vegrehajt(ctx, { n }) {
      for (const p of portjai(ctx)) p.savszel = n;
    },
  },
  {
    modok: IF_MODOK,
    szavak: [SZO.no, { szo: 'bandwidth', sugo: 'A sávszélesség visszaállítása az alapértékre' }],
    vegrehajt(ctx) {
      for (const p of portjai(ctx)) delete p.savszel;
    },
  },
];


// ---------------------------------------------------------------------------
// Statikus útvonalak, IPv6-továbbítás
// ---------------------------------------------------------------------------

const KOVETKEZO4 = { param: 'ipv4', kulcs: 'kovetkezo', sugo: 'A következő ugrás (szomszéd router) címe' };
const KIMENO = { param: 'interfesz', kulcs: 'interfesz', sugo: 'A kimenő interfész' };

function ipRoute(ctx, { halozat, maszk, kovetkezo, interfesz }, torol) {
  const r = ctx.eszkoz;
  if (!ervenyesMaszk(maszk) && maszk !== '0.0.0.0') {
    ctx.kiir('%Inconsistent address and mask');
    return;
  }
  const h = prefixHossz(maszk);
  if (halozatSzam(ipSzam(halozat), h) !== ipSzam(halozat)) {
    ctx.kiir('%Inconsistent address and mask');
    return;
  }
  if (interfesz && !routerPort(r, interfesz)) {
    ctx.kiir('% Interface not found');
    return;
  }
  const egyezik = (s) => s.halozat === halozat && s.maszk === maszk
    && (s.kovetkezo || null) === (kovetkezo || null) && (s.interfesz || null) === (interfesz || null);
  if (torol) {
    const elotte = r.statikus.length;
    r.statikus = r.statikus.filter((s) => !egyezik(s));
    if (r.statikus.length === elotte) ctx.kiir('%No matching route to delete');
  } else {
    if (kovetkezo && r.portok.some((p) => p.ip === kovetkezo)) {
      ctx.kiir("%Invalid next hop address (it's this router)");
      return;
    }
    if (!r.statikus.some(egyezik)) r.statikus.push({ halozat, maszk, kovetkezo, interfesz });
  }
  valtozott(ctx, { csalad: 4 });
}

function ipv6Route(ctx, { pr, kovetkezo, interfesz }, torol) {
  const r = ctx.eszkoz;
  if (kovetkezo && linkLocalE(ipv6Elemez(kovetkezo)) && !interfesz) {
    ctx.kiir('% Interface has to be specified for a link-local nexthop');
    return;
  }
  // A hálózati részre igazítva tárolódik (mint a valódi eszközön).
  const halozat = ipv6Elemez(pr.cim);
  const prefix = `${ipv6Szoveg(ipv6Halozat(halozat, pr.hossz))}/${pr.hossz}`;
  const egyezik = (s) => s.prefix === prefix && (s.kovetkezo || null) === (kovetkezo || null) && (s.interfesz || null) === (interfesz || null);
  if (torol) {
    const elotte = r.statikus6.length;
    r.statikus6 = r.statikus6.filter((s) => !egyezik(s));
    if (r.statikus6.length === elotte) ctx.kiir('%No matching route to delete');
  } else if (!r.statikus6.some(egyezik)) {
    r.statikus6.push({ prefix, kovetkezo, interfesz });
  }
  valtozott(ctx, { csalad: 6 });
}

function utvonalParancsok() {
  const l = [];
  for (const torol of [false, true]) {
    const eleje = torol ? [SZO.no, IP, ROUTE] : [IP, ROUTE];
    const cel = [{ param: 'ipv4', kulcs: 'halozat', sugo: 'A célhálózat címe' }, { param: 'ipv4', kulcs: 'maszk', sugo: 'A célhálózat maszkja' }];
    l.push({ modok: ['konfig'], szavak: [...eleje, ...cel, KOVETKEZO4], vegrehajt: (ctx, e) => ipRoute(ctx, e, torol) });
    l.push({ modok: ['konfig'], szavak: [...eleje, ...cel, KIMENO], vegrehajt: (ctx, e) => ipRoute(ctx, e, torol) });
    l.push({ modok: ['konfig'], szavak: [...eleje, ...cel, KIMENO, { ...KOVETKEZO4, sugo: 'A következő ugrás címe (a kimenő interfészen)' }], vegrehajt: (ctx, e) => ipRoute(ctx, e, torol) });

    const eleje6 = torol ? [SZO.no, IPV6, ROUTE] : [IPV6, ROUTE];
    const pr = { param: 'ipv6-prefix', kulcs: 'pr', sugo: 'A célhálózat (előtag/hossz, pl. ::/0)' };
    const kov6 = { param: 'ipv6', kulcs: 'kovetkezo', sugo: 'A következő ugrás IPv6-címe' };
    l.push({ modok: ['konfig'], szavak: [...eleje6, pr, kov6], vegrehajt: (ctx, e) => ipv6Route(ctx, e, torol) });
    l.push({ modok: ['konfig'], szavak: [...eleje6, pr, KIMENO], vegrehajt: (ctx, e) => ipv6Route(ctx, e, torol) });
    l.push({ modok: ['konfig'], szavak: [...eleje6, pr, KIMENO, kov6], vegrehajt: (ctx, e) => ipv6Route(ctx, e, torol) });
  }
  return l;
}

// ---------------------------------------------------------------------------
// RIP (router rip) és RIPng (ipv6 router rip)
// ---------------------------------------------------------------------------

const RR = ['konfig-router'];

const ripParancsok = [
  {
    modok: ['konfig'],
    szavak: [ROUTER, RIP],
    vegrehajt(ctx) {
      if (!ctx.eszkoz.rip) ctx.eszkoz.rip = ujRip();
      ctx.modValt('konfig-router', { protokoll: 'rip' });
      valtozott(ctx, { csalad: 4 });
    },
  },
  {
    modok: ['konfig'],
    szavak: [SZO.no, ROUTER, RIP],
    vegrehajt(ctx) {
      ctx.eszkoz.rip = null;
      valtozott(ctx, { csalad: 4 });
    },
  },
  {
    modok: RR,
    szavak: [{ szo: 'version', sugo: 'A RIP verziója' }, { param: 'szam', kulcs: 'v', min: 1, max: 2, nev: '<1-2>', sugo: 'Verziószám (1 vagy 2)' }],
    vegrehajt(ctx, { v }) {
      ctx.eszkoz.rip.verzio = v;
      valtozott(ctx, { keres: true, csalad: 4 });
    },
  },
  {
    modok: RR,
    szavak: [SZO.no, { szo: 'version', sugo: 'Vissza az alapértékre (v1-et küld, v1-et és v2-t fogad)' }],
    vegrehajt(ctx) {
      ctx.eszkoz.rip.verzio = null;
      valtozott(ctx, { csalad: 4 });
    },
  },
  {
    modok: RR,
    szavak: [{ szo: 'network', sugo: 'Hálózat felvétele: ezeken az interfészeken fut a RIP, és ezeket hirdeti' },
      { param: 'ipv4', kulcs: 'cim', sugo: 'Hálózatcím (osztályos hálózatként tárolódik)' }],
    vegrehajt(ctx, { cim }) {
      const n = osztalyos(ipSzam(cim));
      const szoveg = ipSzoveg(n.halozat);
      const rip = ctx.eszkoz.rip;
      if (!rip.halozatok.includes(szoveg)) {
        rip.halozatok.push(szoveg);
        rip.halozatok.sort((a, b) => ipSzam(a) - ipSzam(b));
      }
      valtozott(ctx, { keres: true, csalad: 4 });
    },
  },
  {
    modok: RR,
    szavak: [SZO.no, { szo: 'network', sugo: 'Hálózat törlése a RIP-ből' }, { param: 'ipv4', kulcs: 'cim', sugo: 'Hálózatcím' }],
    vegrehajt(ctx, { cim }) {
      const szoveg = ipSzoveg(osztalyos(ipSzam(cim)).halozat);
      const rip = ctx.eszkoz.rip;
      if (!rip.halozatok.includes(szoveg)) {
        ctx.kiir(`%RIP: Network ${szoveg} not configured`);
        return;
      }
      rip.halozatok = rip.halozatok.filter((x) => x !== szoveg);
      valtozott(ctx, { csalad: 4 });
    },
  },
  {
    modok: RR,
    szavak: [{ szo: 'passive-interface', sugo: 'Ezen az interfészen nem küld frissítést (a hálózatát továbbra is hirdeti)' },
      { param: 'interfesz', kulcs: 'interfesz', sugo: 'Az interfész neve' }],
    vegrehajt(ctx, { interfesz }) {
      const rip = ctx.eszkoz.rip;
      if (!routerPort(ctx.eszkoz, interfesz)) return;
      if (!rip.passziv.includes(interfesz)) rip.passziv.push(interfesz);
      valtozott(ctx, { csalad: 4 });
    },
  },
  {
    modok: RR,
    szavak: [SZO.no, { szo: 'passive-interface', sugo: 'Az interfész ismét küld frissítést' },
      { param: 'interfesz', kulcs: 'interfesz', sugo: 'Az interfész neve' }],
    vegrehajt(ctx, { interfesz }) {
      const rip = ctx.eszkoz.rip;
      rip.passziv = rip.passziv.filter((x) => x !== interfesz);
      valtozott(ctx, { keres: true, csalad: 4 });
    },
  },
  {
    modok: RR,
    szavak: [{ szo: 'auto-summary', sugo: 'Automatikus összegzés az osztályhatáron (gyárilag bekapcsolva)' }],
    vegrehajt(ctx) {
      ctx.eszkoz.rip.autoSummary = true;
      valtozott(ctx, { csalad: 4 });
    },
  },
  {
    modok: RR,
    szavak: [SZO.no, { szo: 'auto-summary', sugo: 'Az automatikus összegzés kikapcsolása: az alhálózatok maszkkal együtt mennek ki' }],
    vegrehajt(ctx) {
      ctx.eszkoz.rip.autoSummary = false;
      valtozott(ctx, { csalad: 4 });
    },
  },
  {
    modok: RR,
    szavak: [{ szo: 'default-information', sugo: 'Alapértelmezett útvonal hirdetése' }, { szo: 'originate', sugo: 'A 0.0.0.0/0 hirdetése a többi routernek' }],
    vegrehajt(ctx) {
      ctx.eszkoz.rip.alapUtvonal = true;
      valtozott(ctx, { csalad: 4 });
    },
  },
  {
    modok: RR,
    szavak: [SZO.no, { szo: 'default-information', sugo: 'Az alapértelmezett útvonal hirdetésének kikapcsolása' }, { szo: 'originate', sugo: 'A 0.0.0.0/0 hirdetése' }],
    vegrehajt(ctx) {
      ctx.eszkoz.rip.alapUtvonal = false;
      valtozott(ctx, { csalad: 4 });
    },
  },
  {
    modok: RR,
    szavak: [{ szo: 'timers', sugo: 'A RIP időzítői' }, { szo: 'basic', sugo: 'Frissítés, invalid, holddown, flush (másodpercben)' },
      { param: 'szam', kulcs: 'u', min: 1, max: 4294967, nev: '<1-4294967>', sugo: 'Frissítési időköz (alapból 30)' },
      { param: 'szam', kulcs: 'i', min: 1, max: 4294967, nev: '<1-4294967>', sugo: 'Ennyi idő után érvénytelen az útvonal (alapból 180)' },
      { param: 'szam', kulcs: 'hd', min: 0, max: 4294967, nev: '<0-4294967>', sugo: 'Visszatartás – holddown (alapból 180)' },
      { param: 'szam', kulcs: 'fl', min: 1, max: 4294967, nev: '<1-4294967>', sugo: 'Ennyi idő után törlődik az útvonal (alapból 240)' }],
    vegrehajt(ctx, { u, i, hd, fl }) {
      ctx.eszkoz.rip.idozitok = { frissites: u, ervenytelen: i, visszatartas: hd, torles: fl };
    },
  },
  {
    modok: RR,
    szavak: [SZO.no, { szo: 'timers', sugo: 'Az időzítők visszaállítása' }, { szo: 'basic', sugo: 'Az alapértékek: 30, 180, 180, 240' }],
    vegrehajt(ctx) {
      ctx.eszkoz.rip.idozitok = ujRip().idozitok;
    },
  },
  // IPv6
  {
    modok: ['konfig'],
    szavak: [IPV6, { szo: 'unicast-routing', sugo: 'IPv6-csomagok továbbítása (gyárilag kikapcsolva)' }],
    vegrehajt(ctx) {
      ctx.eszkoz.ipv6Routing = true;
      valtozott(ctx, { keres: true, csalad: 6 });
    },
  },
  {
    modok: ['konfig'],
    szavak: [SZO.no, IPV6, { szo: 'unicast-routing', sugo: 'Az IPv6-továbbítás kikapcsolása' }],
    vegrehajt(ctx) {
      ctx.eszkoz.ipv6Routing = false;
      valtozott(ctx, { csalad: 6 });
    },
  },
  {
    modok: ['konfig'],
    szavak: [IPV6, ROUTER, { szo: 'rip', sugo: 'RIPng (RIP IPv6-hoz)' }, { param: 'szo', kulcs: 'nev', nev: 'WORD', sugo: 'A folyamat neve (csak ezen a routeren számít)' }],
    vegrehajt(ctx, { nev }) {
      if (!ctx.eszkoz.ipv6Routing) {
        ctx.kiir('% IPv6 routing not enabled');
        return;
      }
      if (!ctx.eszkoz.ripng[nev]) ctx.eszkoz.ripng[nev] = {};
      ctx.modValt('konfig-rtr', { ripng: nev });
      valtozott(ctx, { csalad: 6 });
    },
  },
  {
    modok: ['konfig'],
    szavak: [SZO.no, IPV6, ROUTER, { szo: 'rip', sugo: 'RIPng-folyamat törlése' }, { param: 'szo', kulcs: 'nev', nev: 'WORD', sugo: 'A folyamat neve' }],
    vegrehajt(ctx, { nev }) {
      delete ctx.eszkoz.ripng[nev];
      for (const p of ctx.eszkoz.portok) {
        if (p.ripng === nev) {
          p.ripng = '';
          p.ripngAlap = '';
        }
      }
      valtozott(ctx, { csalad: 6 });
    },
  },
];

export const routerKonfigParancsok = [...interfeszParancsokR, ...utvonalParancsok(), ...ripParancsok];
