/**
 * A router exec-parancsai: show (routing tábla, protokollok, interfészek), ping, traceroute,
 * debug / undebug, clear ip route *.
 */

import { routerPing, portForras6 } from '../../../mag/router.js';
import { ripTorol } from '../../../mag/rip.js';
import { ipv6Normal } from '../../../mag/ipv6.js';
import {
  showIpIntBrief, showIpv6IntBrief, showIpRoute, showIpv6Route, showIpProtocols, showIpv6Protocols,
  showIpRipDatabase, showIpv6Rip, showIpv6RipDatabase, showIpArp, showRunningConfigRouter,
} from '../kimenetek/router.js';
import { SZO } from './alap.js';

const EXEC = ['felhasznalo', 'priv'];
const SHOW = { szo: 'show', sugo: 'Információk megjelenítése az eszközről' };
const IP = { szo: 'ip', sugo: 'IPv4-információk' };
const IPV6 = { szo: 'ipv6', sugo: 'IPv6-információk' };
const ROUTE = { szo: 'route', sugo: 'A routing tábla (melyik hálózat merre érhető el)' };
const RIP = { szo: 'rip', sugo: 'Csak a RIP-ből tanult útvonalak' };
const INTERFACE = { szo: 'interface', sugo: 'Az interfészek IP-beállításai' };
const BRIEF = { szo: 'brief', sugo: 'Rövid összefoglaló: interfészenként cím és állapot' };
const PROTOCOLS = { szo: 'protocols', sugo: 'A futó forgalomirányító protokollok és beállításaik' };
const DATABASE = { szo: 'database', sugo: 'A RIP adatbázisa (minden tanult útvonal)' };

function lista(modok, szavak, fn, lapozhato = true) {
  return { modok, szavak, lapozhato, vegrehajt: (ctx, e) => ctx.kiir(...fn(ctx.eszkoz, e)) };
}

const szurok = [
  [null, null],
  ['rip', RIP],
  ['connected', { szo: 'connected', sugo: 'Csak a közvetlenül kapcsolt hálózatok' }],
  ['static', { szo: 'static', sugo: 'Csak a statikus útvonalak' }],
  ['ospf', { szo: 'ospf', sugo: 'Csak az OSPF-ből tanult útvonalak' }],
];

const showParancsok = [
  lista(['priv'], [SHOW, { szo: 'running-config', sugo: 'Az éppen futó (érvényes) konfiguráció' }], (r) => showRunningConfigRouter(r)),
  lista(EXEC, [SHOW, IP, INTERFACE, BRIEF], (r) => showIpIntBrief(r)),
  lista(EXEC, [SHOW, IPV6, INTERFACE, BRIEF], (r) => showIpv6IntBrief(r)),
  ...szurok.map(([sz, szo]) => lista(EXEC, [SHOW, IP, ROUTE, ...(szo ? [szo] : [])], (r) => showIpRoute(r, sz))),
  ...szurok.map(([sz, szo]) => lista(EXEC, [SHOW, IPV6, ROUTE, ...(szo ? [szo] : [])], (r) => showIpv6Route(r, sz))),
  lista(EXEC, [SHOW, IP, PROTOCOLS], (r) => showIpProtocols(r)),
  lista(EXEC, [SHOW, IPV6, PROTOCOLS], (r) => showIpv6Protocols(r)),
  lista(EXEC, [SHOW, IP, { szo: 'rip', sugo: 'RIP-információk' }, DATABASE], (r) => showIpRipDatabase(r)),
  lista(EXEC, [SHOW, IPV6, { szo: 'rip', sugo: 'RIPng-folyamatok és beállításaik' }], (r) => showIpv6Rip(r)),
  lista(EXEC, [SHOW, IPV6, { szo: 'rip', sugo: 'RIPng-információk' }, { szo: 'database', sugo: 'A RIPng adatbázisa' }], (r) => showIpv6RipDatabase(r)),
  lista(EXEC, [SHOW, IP, { szo: 'arp', sugo: 'Az ARP-tábla: IP-cím → MAC-cím' }], (r) => showIpArp(r)),
];

// ---------------------------------------------------------------------------
// ping
// ---------------------------------------------------------------------------

/** A ping „folyamata”: 5 echo egymás után, a jelek (! . U) fokozatosan jelennek meg. */
function pingFolyamat(r, cel, forras) {
  return {
    folyamat: (kiir, kesz, hozzafuz) => {
      let jelek = '';
      const fuz = (j) => {
        jelek += j;
        if (hozzafuz) hozzafuz(j);
      };
      const idok = [];
      let i = 0;
      const egy = () => {
        if (i >= 5 || !r.halozat) return vege();
        i++;
        routerPing(r.halozat, r, cel, (e) => {
          if (e.fajta === 'valasz') {
            idok.push(Math.max(1, e.keses || 0));
            fuz('!');
          } else if (e.fajta === 'elerhetetlen') fuz('U');
          else if (e.fajta === 'ido-lejart') fuz('&');
          else fuz('.');
          r.halozat.ora.utemez(e.fajta === 'elerhetetlen' ? 300 : 1, egy);
        }, { forras });
      };
      const vege = () => {
        if (!hozzafuz) kiir(jelek.padEnd(5, '.'));
        const db = idok.length;
        let sor = `Success rate is ${Math.round((db / 5) * 100)} percent (${db}/5)`;
        if (db) {
          const min = Math.min(...idok);
          const max = Math.max(...idok);
          const atl = Math.round(idok.reduce((a, b) => a + b, 0) / db);
          sor += `, round-trip min/avg/max = ${min}/${atl}/${max} ms`;
        }
        kiir(sor);
        kesz();
      };
      egy();
    },
  };
}

function ping(ctx, { cim, forrasIf, forrasCim }) {
  const r = ctx.eszkoz;
  const v6 = cim.includes(':');
  const cel = v6 ? ipv6Normal(cim) : cim;
  let forras = null;
  if (forrasIf) {
    const p = r.portok.find((x) => x.nev === forrasIf);
    forras = p && (v6 ? portForras6(p) : p.ip);
    if (!forras) {
      ctx.kiir(`% Invalid source interface - ${v6 ? 'IPv6' : 'IP'} not enabled`);
      return;
    }
  } else if (forrasCim) {
    forras = forrasCim.includes(':') ? ipv6Normal(forrasCim) : forrasCim;
    const sajat = v6 ? r.portok.some((p) => p.ipv6.some((x) => x.cim === forras)) : r.portok.some((p) => p.ip === forras);
    if (!sajat) {
      ctx.kiir(`% Invalid source address- ${forras} is not a local address`);
      return;
    }
  }
  const sorok = ['Type escape sequence to abort.', `Sending 5, 100-byte ICMP Echos to ${cel}, timeout is 2 seconds:`];
  if (forras) sorok.push(`Packet sent with a source address of ${forras}`);
  ctx.kiir(...sorok, pingFolyamat(r, cel, forras));
}

// ---------------------------------------------------------------------------
// traceroute
// ---------------------------------------------------------------------------

/** Ennyi egymás utáni válasz nélküli ugrás után a szimulátor abbahagyja (a valódi eszköz 30-ig menne). */
const TRACE_TURELEM = 5;

function traceFolyamat(r, cel) {
  return {
    folyamat: (kiir, kesz) => {
      let ttl = 1;
      let ures = 0;
      const ugras = () => {
        if (!r.halozat || ttl > 30) return kesz();
        const valaszok = [];
        let proba = 0;
        const egy = () => {
          proba++;
          routerPing(r.halozat, r, cel, (e) => {
            valaszok.push(e);
            if (proba < 3) return r.halozat.ora.utemez(1, egy);
            return sorKesz();
          }, { ttl, varakozas: 3000 });
        };
        const sorKesz = () => {
          let sor = `  ${ttl}`;
          let elozo = null;
          let celba = false;
          for (const v of valaszok) {
            if (v.fajta === 'idotullepes') {
              sor += ' *';
              continue;
            }
            if (v.kitol !== elozo) {
              sor += ` ${v.kitol}`;
              elozo = v.kitol;
            }
            if (v.fajta === 'elerhetetlen') {
              sor += ' !N';
              celba = true;
            } else {
              sor += ` ${Math.max(1, v.keses || 0)} msec`;
              if (v.fajta === 'valasz') celba = true;
            }
          }
          kiir(sor);
          ures = valaszok.every((v) => v.fajta === 'idotullepes') ? ures + 1 : 0;
          if (celba) return kesz();
          if (ures >= TRACE_TURELEM) {
            kiir('[Szimulátor] Több ugrás óta nem jön válasz – a valódi eszköz 30 ugrásig próbálkozna (megszakítás: Ctrl+Shift+6).');
            return kesz();
          }
          ttl++;
          ugras();
        };
        egy();
      };
      ugras();
    },
  };
}

function traceroute(ctx, { cim }) {
  const cel = cim.includes(':') ? ipv6Normal(cim) : cim;
  ctx.kiir('Type escape sequence to abort.', `Tracing the route to ${cel}`, 'VRF info: (vrf in name/id, vrf out name/id)', traceFolyamat(ctx.eszkoz, cel));
}

const CIM4 = { param: 'ipv4', kulcs: 'cim', sugo: 'A cél IPv4-címe' };
const CIM6 = { param: 'ipv6', kulcs: 'cim', sugo: 'A cél IPv6-címe' };
const PING = { szo: 'ping', sugo: 'Elérhető-e egy cím (ICMP echo)' };
const FORRAS = { szo: 'source', sugo: 'A ping forráscíme (pl. a LAN-interfészé – így a visszautat is próbálja)' };
const TRACE = { szo: 'traceroute', sugo: 'Merre jutnak el a csomagok a célig (ugrásonként)' };

// ---------------------------------------------------------------------------
// debug, clear
// ---------------------------------------------------------------------------

const DEBUG = { szo: 'debug', sugo: 'Hibakereső üzenetek bekapcsolása' };
const UNDEBUG = { szo: 'undebug', sugo: 'Hibakereső üzenetek kikapcsolása' };
const RIP_D = { szo: 'rip', sugo: 'A RIP üzenetei (küldött és fogadott frissítések)' };

function debugAll(ctx, mit, be) {
  ctx.eszkoz.debug[mit] = be;
  const nev = mit === 'rip' ? 'RIP protocol debugging' : 'RIP Routing Protocol debugging';
  ctx.kiir(`${nev} is ${be ? 'on' : 'off'}`);
}

function mindKi(ctx) {
  for (const k of Object.keys(ctx.eszkoz.debug)) ctx.eszkoz.debug[k] = false;
  ctx.kiir('All possible debugging has been turned off');
}

const egyebParancsok = [
  { modok: EXEC, szavak: [PING, CIM4], vegrehajt: ping },
  { modok: EXEC, szavak: [PING, CIM6], vegrehajt: ping },
  ...[CIM4, CIM6].flatMap((cim) => [
    { modok: EXEC, szavak: [PING, cim, FORRAS, { param: 'interfesz', kulcs: 'forrasIf', sugo: 'Erről az interfészről (annak címével) induljon' }], vegrehajt: ping },
    { modok: EXEC, szavak: [PING, cim, FORRAS, { param: cim === CIM4 ? 'ipv4' : 'ipv6', kulcs: 'forrasCim', sugo: 'Ezzel a (saját) forráscímmel induljon' }], vegrehajt: ping },
  ]),
  { modok: EXEC, szavak: [TRACE, CIM4], vegrehajt: traceroute },
  { modok: EXEC, szavak: [TRACE, CIM6], vegrehajt: traceroute },
  { modok: ['priv'], szavak: [DEBUG, { szo: 'ip', sugo: 'IPv4-es hibakeresés' }, RIP_D], vegrehajt: (ctx) => debugAll(ctx, 'rip', true) },
  { modok: ['priv'], szavak: [DEBUG, { szo: 'ipv6', sugo: 'IPv6-os hibakeresés' }, { szo: 'rip', sugo: 'A RIPng üzenetei' }], vegrehajt: (ctx) => debugAll(ctx, 'ripng', true) },
  { modok: ['priv'], szavak: [UNDEBUG, { szo: 'ip', sugo: 'IPv4-es hibakeresés' }, RIP_D], vegrehajt: (ctx) => debugAll(ctx, 'rip', false) },
  { modok: ['priv'], szavak: [UNDEBUG, { szo: 'ipv6', sugo: 'IPv6-os hibakeresés' }, { szo: 'rip', sugo: 'A RIPng üzenetei' }], vegrehajt: (ctx) => debugAll(ctx, 'ripng', false) },
  { modok: ['priv'], szavak: [UNDEBUG, { szo: 'all', sugo: 'Minden hibakereső üzenet kikapcsolása' }], vegrehajt: mindKi },
  { modok: ['priv'], szavak: [SZO.no, { szo: 'debug', sugo: 'Hibakereső üzenetek kikapcsolása' }, { szo: 'all', sugo: 'Mindegyiket' }], vegrehajt: mindKi },
  { modok: ['priv'], szavak: [SZO.no, { szo: 'debug', sugo: 'Hibakereső üzenetek kikapcsolása' }, { szo: 'ip', sugo: 'IPv4-es hibakeresés' }, RIP_D], vegrehajt: (ctx) => debugAll(ctx, 'rip', false) },
  {
    modok: ['priv'],
    szavak: [{ szo: 'clear', sugo: 'Törlés (táblák, számlálók)' }, { szo: 'ip', sugo: 'IPv4-táblák' }, { szo: 'route', sugo: 'A routing tábla' },
      { szo: '*', sugo: 'Minden tanult útvonal törlése (a RIP újra megkérdezi a szomszédokat)' }],
    vegrehajt(ctx) {
      ripTorol(ctx.eszkoz);
    },
  },
];

export const routerExecParancsok = [...showParancsok, ...egyebParancsok];
