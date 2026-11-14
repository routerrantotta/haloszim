/**
 * Az EIGRP show-parancsainak kimenetei (IOS 15 / IOS XE 16 jellegű forma):
 *   show ip eigrp neighbors | topology [<hálózat> <maszk>] | interfaces
 *   ugyanezek ipv6-tal, és a show ip protocols / show ipv6 protocols EIGRP-része.
 *
 * A kimenet mindig az eszköz aktuális állapotából készül. A forma (oszlopok, sorrend) a nyilvános
 * forrásokban látható valódi kimeneteket követi (docs/forrasok.md); a szimulátorban nem mért
 * értékek (SRTT, RTO, Q Cnt, Reliability, Load) állandók.
 */

import { ipSzam, ipSzoveg, prefixHossz, maszkSzoveg, halozatSzam } from '../../../mag/ip.js';
import { ipv6Szoveg, ipv6Halozat, ipv6Elemez } from '../../../mag/ipv6.js';
import { savszelesseg } from '../../../mag/ospf.js';
import {
  eigrpBeall, eigrpAllapot, eigrpSzomszedok, eigrpTopologia, passzivE, keseses, EIGRP_AD, EIGRP_KULSO_AD,
} from '../../../mag/eigrp.js';

function most(r) {
  return r.halozat ? r.halozat.ora.ido : 0;
}

/** Eltelt idő hh:mm:ss alakban. */
function hms(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const p = (x) => String(x).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`;
}

function rovid(nev) {
  return nev.replace(/^GigabitEthernet/, 'Gi').replace(/^FastEthernet/, 'Fa').replace(/^Serial/, 'Se').replace(/^Loopback/, 'Lo');
}

/** Fut-e a folyamat (ha nem, a valódi eszköz üres kimenetet ad). */
function fut(r, csalad) {
  const e = eigrpBeall(r, csalad);
  return !!e && eigrpAllapot(r, csalad).fut;
}

function fejlec(r, csalad, mi) {
  const e = eigrpBeall(r, csalad);
  return `EIGRP-${csalad === 4 ? 'IPv4' : 'IPv6'} ${mi} for AS(${e.as})`;
}

function cimSzoveg(csalad, halozat, hossz) {
  return csalad === 4 ? `${ipSzoveg(halozat)}/${hossz}` : `${ipv6Szoveg(halozat)}/${hossz}`;
}

// ---------------------------------------------------------------------------
// show ip eigrp neighbors / show ipv6 eigrp neighbors
// ---------------------------------------------------------------------------

export function showEigrpNeighbors(r, csalad) {
  if (!fut(r, csalad)) return [];
  const s = [fejlec(r, csalad, 'Neighbors'),
    'H   Address                 Interface              Hold Uptime   SRTT   RTO  Q  Seq',
    '                                                   (sec)         (ms)       Cnt Num'];
  for (const n of eigrpSzomszedok(r, csalad)) {
    const hold = Math.max(0, Math.ceil((n.holdLejar - most(r)) / 1000));
    const vege = `${String(hold).padStart(4)} ${hms(most(r) - n.kezd)}${String(10).padStart(5)}${String(100).padStart(6)}  0  ${n.seq || 1}`;
    if (csalad === 4) {
      s.push(`${String(n.h).padEnd(4)}${n.cim.padEnd(24)}${rovid(n.port).padEnd(23)}${vege}`);
    } else {
      s.push(`${String(n.h).padEnd(4)}${'Link-local address:'.padEnd(24)}${rovid(n.port).padEnd(23)}${vege}`);
      s.push(`    ${n.cim}`);
    }
  }
  return s;
}

// ---------------------------------------------------------------------------
// show ip eigrp interfaces / show ipv6 eigrp interfaces
// ---------------------------------------------------------------------------

export function showEigrpInterfaces(r, csalad) {
  if (!fut(r, csalad)) return [];
  const a = eigrpAllapot(r, csalad);
  const s = [fejlec(r, csalad, 'Interfaces'),
    '                        Xmit Queue   PeerQ        Mean   Pacing Time   Multicast    Pending',
    'Interface        Peers  Un/Reliable  Un/Reliable  SRTT   Un/Reliable   Flow Timer   Routes'];
  for (const I of a.ifek) {
    // A passzív interfész nem szerepel a listában (nincs rajta EIGRP-forgalom).
    if (I.passziv) continue;
    const srtt = I.szomszedok.length ? 10 : 0;
    s.push(`${rovid(I.port).padEnd(17)}${String(I.szomszedok.length).padStart(2)}        0/0       0/0     `
      + `${String(srtt).padStart(6)}       0/${I.szomszedok.length ? 15 : 0}${String(I.szomszedok.length ? 50 : 0).padStart(12)}${'0'.padStart(12)}`);
  }
  return s;
}

// ---------------------------------------------------------------------------
// show ip eigrp topology / show ipv6 eigrp topology
// ---------------------------------------------------------------------------

const KODOK = [
  'Codes: P - Passive, A - Active, U - Update, Q - Query, R - Reply,',
  '       r - reply Status, s - sia Status',
];

export function showEigrpTopology(r, csalad) {
  if (!fut(r, csalad)) return [];
  const e = eigrpBeall(r, csalad);
  const a = eigrpAllapot(r, csalad);
  const s = [`EIGRP-${csalad === 4 ? 'IPv4' : 'IPv6'} Topology Table for AS(${e.as})/ID(${a.rid})`, ...KODOK, ''];
  for (const t of eigrpTopologia(r, csalad)) {
    const cim = cimSzoveg(csalad, t.halozat, t.hossz);
    if (t.sajat) {
      s.push(`${t.allapot} ${cim}, 1 successors, FD is ${t.legjobb}`);
      const port = r.portok.find((p) => portE(r, p, csalad, t));
      s.push(`        via Connected, ${port ? port.nev : ''}`);
      continue;
    }
    if (t.osszegzes) {
      s.push(`${t.allapot} ${cim}, 1 successors, FD is ${t.legjobb}`);
      s.push('        via Summary (' + t.legjobb + '/0), Null0');
      continue;
    }
    const successorok = t.forrasok.filter((f) => f.successor);
    const fsek = t.forrasok.filter((f) => f.fs);
    s.push(`${t.allapot} ${cim}, ${successorok.length} successors, FD is ${t.fd}`);
    for (const f of [...successorok, ...fsek]) {
      s.push(`        via ${f.cim} (${f.metrika}/${f.ad}), ${f.port}`);
    }
  }
  return s;
}

/** Melyik interfész hálózata ez a (saját, kapcsolt) bejegyzés. */
function portE(r, p, csalad, t) {
  if (csalad === 4) {
    if (!p.ip) return false;
    return prefixHossz(p.maszk) === t.hossz && halozatSzam(ipSzam(p.ip), t.hossz) === t.halozat;
  }
  return p.ipv6.some((c) => c.hossz === t.hossz && ipv6Szoveg(ipv6Halozat(ipv6Elemez(c.cim), c.hossz)) === ipv6Szoveg(t.halozat));
}

/**
 * Egy hálózat részletes topológiabejegyzése:
 *   show ip eigrp topology <hálózat> <maszk>  /  show ipv6 eigrp topology <előtag>/<hossz>
 */
export function showEigrpTopologyHalozat(r, csalad, szoveg) {
  if (!fut(r, csalad)) return [];
  const e = eigrpBeall(r, csalad);
  const a = eigrpAllapot(r, csalad);
  const [h, l] = szoveg.split('/');
  const hossz = Number(l);
  const cim = csalad === 4 ? halozatSzam(ipSzam(h), hossz) : ipv6Halozat(ipv6Elemez(h), hossz);
  const t = eigrpTopologia(r, csalad).find((x) => x.hossz === hossz && cimSzoveg(csalad, x.halozat, x.hossz) === cimSzoveg(csalad, cim, hossz));
  if (!t) return [`%Entry ${cimSzoveg(csalad, cim, hossz)} not in topology table`];
  const s = [`EIGRP-${csalad === 4 ? 'IPv4' : 'IPv6'} Topology Entry for AS(${e.as})/ID(${a.rid}) for ${cimSzoveg(csalad, t.halozat, t.hossz)}`];
  const successorok = t.forrasok.filter((f) => f.successor);
  const fsek = t.forrasok.filter((f) => f.fs);
  const db = t.sajat || t.osszegzes ? 1 : successorok.length;
  s.push(`  State is ${t.allapot === 'A' ? 'Active' : 'Passive'}, Query origin flag is 1, ${db} Successor(s), FD is ${t.sajat || t.osszegzes ? t.legjobb : t.fd}`);
  s.push('  Descriptor Blocks:');
  if (t.sajat) {
    const port = r.portok.find((p) => portE(r, p, csalad, t));
    s.push(`  0.0.0.0 (${port ? port.nev : ''}), from Connected, Send flag is 0x0`);
    s.push(`      Composite metric is (${t.legjobb}/0), Route is Internal`);
    s.push(...vektorSorok(r, t.sajat, port, a.rid));
    return s;
  }
  if (t.osszegzes) {
    s.push('  0.0.0.0 (Null0), from Summary, Send flag is 0x0');
    s.push(`      Composite metric is (${t.legjobb}/0), Route is Internal`);
    return s;
  }
  // A valódi eszköz is csak a successort és a feasible successorokat írja ki (all-links nélkül).
  for (const f of [...successorok, ...fsek]) {
    s.push(`  ${f.cim} (${f.port}), from ${f.cim}, Send flag is 0x0`);
    s.push(`      Composite metric is (${f.metrika}/${f.ad}), Route is Internal`);
    s.push(...vektorSorok(r, f.vektor, null, f.honnan, f.hop));
  }
  return s;
}

function vektorSorok(r, v, port, honnan, hop = 0) {
  const sav = port ? savszelesseg(port) : v.savszel;
  const kes = port ? keseses(port) : v.keses;
  return [
    '      Vector metric:',
    `        Minimum bandwidth is ${sav} Kbit`,
    `        Total delay is ${kes} microseconds`,
    '        Reliability is 255/255',
    '        Load is 1/255',
    '        Minimum MTU is 1500',
    `        Hop count is ${hop}`,
    `        Originating router is ${honnan || '0.0.0.0'}`,
  ];
}

// ---------------------------------------------------------------------------
// show ip protocols / show ipv6 protocols – az EIGRP-rész
// ---------------------------------------------------------------------------

export function ipProtocolsEigrp(r) {
  const e = r.eigrp;
  if (!e) return [];
  const a = eigrpAllapot(r, 4);
  const s = [`Routing Protocol is "eigrp ${e.as}"`,
    '  Outgoing update filter list for all interfaces is not set',
    '  Incoming update filter list for all interfaces is not set',
    '  Default networks flagged in outgoing updates',
    '  Default networks accepted from incoming updates',
    `  Redistributing: eigrp ${e.as}`,
    `  EIGRP-IPv4 Protocol for AS(${e.as})`,
    '    Metric weight K1=1, K2=0, K3=1, K4=0, K5=0',
    '    NSF-aware route hold timer is 240',
    `    Router-ID: ${a.rid || '0.0.0.0'}`,
    '    Topology : 0 (base)',
    '      Active Timer: 3 min',
    `      Distance: internal ${EIGRP_AD} external ${EIGRP_KULSO_AD}`,
    `      Maximum path: ${e.maxUtak}`,
    '      Maximum hopcount 100',
    '      Maximum metric variance 1',
    '',
    `  Automatic Summarization: ${e.autoSummary ? 'enabled' : 'disabled'}`,
    `  Maximum path: ${e.maxUtak}`,
    '  Routing for Networks:'];
  for (const n of e.halozatok) {
    s.push(`    ${n.wildcard ? `${n.cim}/${prefixHossz(invertal(n.wildcard))}` : n.cim}`);
  }
  const passz = r.portok.filter((p) => passzivE(r, p, 4));
  if (passz.length) {
    s.push('  Passive Interface(s):');
    for (const p of passz) s.push(`    ${p.nev}`);
  }
  s.push('  Routing Information Sources:', '    Gateway         Distance      Last Update');
  for (const f of a.forrasok.slice().sort((x, y) => ipSzam(x.cim) - ipSzam(y.cim))) {
    s.push(`    ${f.cim.padEnd(15)}${String(EIGRP_AD).padStart(9)}      ${hms(most(r) - f.ido)}`);
  }
  s.push(`  Distance: internal ${EIGRP_AD} external ${EIGRP_KULSO_AD}`, '');
  return s;
}

/** A wildcard maszk „megfordítása” alhálózati maszkra (0.0.0.3 → 255.255.255.252). */
function invertal(wc) {
  return ipSzoveg((~ipSzam(wc)) >>> 0);
}

export function ipv6ProtocolsEigrp(r) {
  const e = r.eigrp6;
  if (!e) return [];
  const a = eigrpAllapot(r, 6);
  const s = [`IPv6 Routing Protocol is "eigrp ${e.as}"`,
    '  EIGRP-IPv6 Protocol for AS(' + e.as + ')',
    '    Metric weight K1=1, K2=0, K3=1, K4=0, K5=0',
    '    NSF-aware route hold timer is 240',
    `    Router-ID: ${a.rid || '0.0.0.0'}`,
    '    Topology : 0 (base)',
    '      Active Timer: 3 min',
    `      Distance: internal ${EIGRP_AD} external ${EIGRP_KULSO_AD}`,
    `      Maximum path: ${e.maxUtak}`,
    '      Maximum hopcount 100',
    '      Maximum metric variance 1'];
  if (e.leallitva) s.push('    EIGRP is shutdown');
  s.push('  Interfaces:');
  for (const I of a.ifek) s.push(`    ${I.port}`);
  s.push('  Redistribution:', '    None');
  return s;
}

// ---------------------------------------------------------------------------
// show running-config – az EIGRP-sorok
// ---------------------------------------------------------------------------

/** A „router eigrp AS” / „ipv6 router eigrp AS” blokk. */
export function eigrpKonfigSorok(e, fej, csalad) {
  const s = [`${fej} ${e.as}`];
  if (e.leallitva) s.push(' shutdown');
  if (e.routerId) s.push(` eigrp router-id ${e.routerId}`);
  if (e.passzivAlap) {
    s.push(' passive-interface default');
    for (const p of e.nemPassziv) s.push(` no passive-interface ${p}`);
  } else {
    for (const p of e.passziv) s.push(` passive-interface ${p}`);
  }
  for (const n of e.halozatok) s.push(` network ${n.cim}${n.wildcard ? ` ${n.wildcard}` : ''}`);
  if (csalad === 4 && !e.autoSummary) s.push(' no auto-summary');
  if (e.maxUtak !== 4) s.push(` maximum-paths ${e.maxUtak}`);
  s.push('!');
  return s;
}

export { maszkSzoveg };
