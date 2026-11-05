/**
 * A router show-parancsainak kimenetei (ISR 4331 jellegű, IOS XE 16 jellegű forma).
 *
 * A kimenet mindig az eszköz aktuális állapotából készül. A forma (oszlopok, sorrend, behúzások)
 * a nyilvános forrásokban látható valódi kimeneteket követi – lásd docs/forrasok.md.
 * A kódmagyarázó fejlécet (Codes: …) rövidítve adjuk: csak a szimulátorban előforduló kódok.
 */

import { ipSzam, ipSzoveg, prefixHossz, maszkSzoveg, osztalyos, halozatSzam } from '../../../mag/ip.js';
import { ipv6Szoveg, ipv6Elemez } from '../../../mag/ipv6.js';
import { macPontos } from '../../../mag/ethernet.js';
import {
  tabla4, tabla6, portFent, portLinkLocal, ipv6Engedelyezve, utolsoMenedek4,
} from '../../../mag/utvonal.js';
import {
  ripAdatbazis, ripForrasok, ripKovetkezo, ripPortok, ripSzamlalok, RIPNG_IDOZITOK,
} from '../../../mag/rip.js';

/** Eltelt idő hh:mm:ss alakban (a routing táblában a RIP-útvonal kora). */
export function kor(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const p = (x) => String(x).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`;
}

function most(r) {
  return r.halozat ? r.halozat.ora.ido : 0;
}

function allapotSzoveg(p) {
  if (p.leallitva) return 'administratively down';
  return portFent(p) ? 'up' : 'down';
}

// ---------------------------------------------------------------------------
// show ip interface brief / show ipv6 interface brief
// ---------------------------------------------------------------------------

export function showIpIntBrief(r) {
  const s = ['Interface              IP-Address      OK? Method Status                Protocol'];
  for (const p of r.portok) {
    const ip = p.ip || 'unassigned';
    const mod = p.ip ? 'manual' : 'unset ';
    const allapot = allapotSzoveg(p);
    const proto = portFent(p) ? 'up' : 'down';
    s.push(`${p.nev.padEnd(23)}${ip.padEnd(16)}YES ${mod.padEnd(7)}${allapot.padEnd(22)}${proto}`.trimEnd());
  }
  return s;
}

export function showIpv6IntBrief(r) {
  const s = [];
  for (const p of r.portok) {
    s.push(`${p.nev.padEnd(23)}[${allapotSzoveg(p)}/${portFent(p) ? 'up' : 'down'}]`);
    if (!ipv6Engedelyezve(p)) {
      s.push('    unassigned');
      continue;
    }
    s.push(`    ${ipv6Szoveg(portLinkLocal(p))}`);
    for (const c of p.ipv6) s.push(`    ${c.cim}`);
  }
  return s;
}

// ---------------------------------------------------------------------------
// show ip route
// ---------------------------------------------------------------------------

const KODOK4 = [
  'Codes: L - local, C - connected, S - static, R - RIP, O - OSPF, D - EIGRP',
  '       * - candidate default',
];

/** Egy útvonal első sora (a hálózat után) és a további utak sorai. */
function utSorok(r, e, eleje) {
  if (e.kod === 'C' || e.kod === 'L') return [`${eleje} is directly connected, ${e.utak[0].port}`];
  if (e.lehetLe) {
    const u = e.utak[0];
    return [`${eleje} is possibly down, routing via ${ipSzoveg(u.kovetkezo)}, ${u.port}`];
  }
  const sorok = [];
  e.utak.forEach((u, i) => {
    let resz;
    if (e.kod === 'S' && u.kovetkezo === null) resz = `is directly connected, ${u.port}`;
    else {
      resz = `[${e.ad}/${e.metrika}] via ${ipSzoveg(u.kovetkezo)}`;
      if (e.kod === 'R') resz += `, ${kor(most(r) - u.ido)}`;
      if (u.port) resz += `, ${u.port}`;
    }
    if (i === 0) sorok.push(`${eleje} ${resz}`);
    else sorok.push(`${' '.repeat(eleje.length + 1)}${resz}`);
  });
  return sorok;
}

/**
 * @param {Object} r
 * @param {'rip'|'connected'|'static'|null} [szuro]
 */
export function showIpRoute(r, szuro = null) {
  const s = [...KODOK4, ''];
  const gw = utolsoMenedek4(r);
  if (gw && !szuro) {
    const u = gw.utak[0];
    s.push(`Gateway of last resort is ${u.kovetkezo !== null ? ipSzoveg(u.kovetkezo) : '0.0.0.0'} to network 0.0.0.0`);
  } else if (!szuro) {
    s.push('Gateway of last resort is not set');
  } else if (gw) {
    s.push(`Gateway of last resort is ${gw.utak[0].kovetkezo !== null ? ipSzoveg(gw.utak[0].kovetkezo) : '0.0.0.0'} to network 0.0.0.0`);
  } else {
    s.push('Gateway of last resort is not set');
  }
  s.push('');
  const teljes = tabla4(r);
  const kell = (e) => !szuro || (szuro === 'rip' && e.kod === 'R') || (szuro === 'static' && e.kod === 'S')
    || (szuro === 'connected' && (e.kod === 'C' || e.kod === 'L'));
  // Csoportok osztályos hálózat szerint (a 0.0.0.0/0 külön, legelöl).
  const csoportok = new Map();
  for (const e of teljes) {
    const o = e.hossz === 0 ? { halozat: 0, hossz: 0 } : osztalyos(e.halozat);
    const k = `${o.halozat}/${o.hossz}`;
    if (!csoportok.has(k)) csoportok.set(k, { o, elemek: [] });
    csoportok.get(k).elemek.push(e);
  }
  const kod = (e) => `${e.kod}${e.alap ? '*' : ''}`;
  for (const { o, elemek } of [...csoportok.values()].sort((a, b) => a.o.halozat - b.o.halozat)) {
    const latszik = elemek.filter(kell);
    if (!latszik.length) continue;
    if (o.hossz === 0 || (elemek.length === 1 && elemek[0].hossz === o.hossz)) {
      for (const e of latszik) s.push(...utSorok(r, e, `${kod(e).padEnd(6)}${ipSzoveg(e.halozat)}/${e.hossz}`));
      continue;
    }
    const maszkok = new Set(elemek.map((e) => e.hossz));
    if (maszkok.size === 1) {
      const h = elemek[0].hossz;
      s.push(`      ${ipSzoveg(o.halozat)}/${h} is subnetted, ${elemek.length} subnets`);
      for (const e of latszik) s.push(...utSorok(r, e, `${kod(e).padEnd(9)}${ipSzoveg(e.halozat)}`));
    } else {
      s.push(`      ${ipSzoveg(o.halozat)}/${o.hossz} is variably subnetted, ${elemek.length} subnets, ${maszkok.size} masks`);
      for (const e of latszik) s.push(...utSorok(r, e, `${kod(e).padEnd(9)}${ipSzoveg(e.halozat)}/${e.hossz}`));
    }
  }
  return s;
}

// ---------------------------------------------------------------------------
// show ipv6 route
// ---------------------------------------------------------------------------

export function showIpv6Route(r, szuro = null) {
  const t = tabla6(r);
  const kell = (e) => !szuro || (szuro === 'rip' && e.kod === 'R') || (szuro === 'static' && e.kod === 'S')
    || (szuro === 'connected' && (e.kod === 'C' || e.kod === 'L'));
  const latszik = t.filter(kell);
  const null0 = !szuro || szuro === 'connected';
  const s = [`IPv6 Routing Table - default - ${t.length + 1} entries`,
    'Codes: C - Connected, L - Local, S - Static, R - RIP, O - OSPF Intra, D - EIGRP',
    ''];
  for (const e of latszik) {
    const cim = `${ipv6Szoveg(e.halozat)}/${e.hossz}`;
    if (e.lehetLe) {
      s.push(`${e.kod.padEnd(4)}${cim} [${e.ad}/16]`, `     via ${ipv6Szoveg(e.utak[0].kovetkezo)}, ${e.utak[0].port}`);
      continue;
    }
    s.push(`${e.kod.padEnd(4)}${cim} [${e.ad}/${e.metrika}]`);
    for (const u of e.utak) {
      if (e.kod === 'C') s.push(`     via ${u.port}, directly connected`);
      else if (e.kod === 'L') s.push(`     via ${u.port}, receive`);
      else if (!u.kovetkezo) s.push(`     via ${u.port}, directly connected`);
      else s.push(`     via ${ipv6Szoveg(u.kovetkezo)}${u.port ? `, ${u.port}` : ''}`);
    }
  }
  if (null0) s.push('L   FF00::/8 [0/0]', '     via Null0, receive');
  return s;
}

// ---------------------------------------------------------------------------
// show ip protocols / show ipv6 protocols
// ---------------------------------------------------------------------------

export function showIpProtocols(r) {
  const s = ['*** IP Routing is NSF aware ***', ''];
  const rip = r.rip;
  if (!rip) return s;
  const t = rip.idozitok;
  const kov = ripKovetkezo(r, 4);
  s.push('Routing Protocol is "rip"',
    '  Outgoing update filter list for all interfaces is not set',
    '  Incoming update filter list for all interfaces is not set',
    `  Sending updates every ${t.frissites} seconds${kov !== null ? `, next due in ${kov} seconds` : ''}`,
    `  Invalid after ${t.ervenytelen} seconds, hold down ${t.visszatartas}, flushed after ${t.torles}`,
    '  Redistributing: rip');
  const kuld = rip.verzio === 2 ? '2' : '1';
  const fogad = rip.verzio === 2 ? '2' : rip.verzio === 1 ? '1' : '1 2';
  const fogadSzoveg = rip.verzio ? `receive version ${rip.verzio}` : 'receive any version';
  s.push(`  Default version control: send version ${kuld}, ${fogadSzoveg}`);
  s.push('    Interface                           Send  Recv  Triggered RIP  Key-chain');
  for (const p of ripPortok(r, 4)) {
    if (rip.passziv.includes(p.nev)) continue;
    s.push(`    ${p.nev.padEnd(36)}${kuld.padEnd(6)}${fogad.padEnd(6)}     No        none`);
  }
  s.push(`  Automatic network summarization is ${rip.autoSummary ? '' : 'not '}in effect`);
  s.push('  Maximum path: 4', '  Routing for Networks:');
  for (const n of rip.halozatok) s.push(`    ${n}`);
  if (rip.passziv.length) {
    s.push('  Passive Interface(s):');
    for (const p of rip.passziv) s.push(`    ${p}`);
  }
  s.push('  Routing Information Sources:', '    Gateway         Distance      Last Update');
  for (const f of ripForrasok(r, 4).sort((a, b) => ipSzam(a.cim) - ipSzam(b.cim))) {
    s.push(`    ${f.cim.padEnd(15)}${'120'.padStart(9)}      ${kor(most(r) - f.ido)}`);
  }
  s.push('  Distance: (default is 120)', '');
  return s;
}

export function showIpv6Protocols(r) {
  const s = ['IPv6 Routing Protocol is "connected"', 'IPv6 Routing Protocol is "application"', 'IPv6 Routing Protocol is "ND"'];
  if (r.statikus6.length) s.push('IPv6 Routing Protocol is "static"');
  for (const nev of Object.keys(r.ripng)) {
    s.push(`IPv6 Routing Protocol is "rip ${nev}"`, '  Interfaces:');
    for (const p of r.portok) if (p.ripng === nev) s.push(`    ${p.nev}`);
    s.push('  Redistribution:', '    None');
  }
  s.push('');
  return s;
}

// ---------------------------------------------------------------------------
// show ip rip database
// ---------------------------------------------------------------------------

export function showIpRipDatabase(r) {
  if (!r.rip) return [];
  const db = ripAdatbazis(r, 4);
  const sorok = [];
  for (const c of db.kapcsolt) sorok.push({ h: c.halozat, l: c.hossz, s: [`${ipSzoveg(c.halozat)}/${c.hossz}    directly connected, ${c.port}`] });
  for (const e of db.tanult) {
    if (db.kapcsolt.some((c) => c.halozat === e.halozat && c.hossz === e.hossz)) continue;
    const fej = `${ipSzoveg(e.halozat)}/${e.hossz}`;
    if (e.le) {
      sorok.push({ h: e.halozat, l: e.hossz, s: [`${fej}    is possibly down`] });
      continue;
    }
    sorok.push({ h: e.halozat, l: e.hossz, s: [fej, ...e.utak.map((u) => `    [${e.metrika}] via ${ipSzoveg(u.kovetkezo)}, ${kor(most(r) - u.ido)}, ${u.port}`)] });
  }
  if (r.rip.autoSummary) {
    const fok = new Map();
    for (const x of sorok) {
      if (x.l === 0) continue;
      const o = osztalyos(x.h);
      if (o.hossz < x.l) fok.set(o.halozat, o);
    }
    for (const o of fok.values()) sorok.push({ h: o.halozat, l: o.hossz - 0.5, s: [`${ipSzoveg(o.halozat)}/${o.hossz}    auto-summary`] });
  }
  if (r.rip.alapUtvonal) sorok.push({ h: 0, l: -0.5, s: ['0.0.0.0/0    auto-summary'] });
  sorok.sort((a, b) => a.h - b.h || a.l - b.l);
  return sorok.flatMap((x) => x.s);
}

// ---------------------------------------------------------------------------
// show ipv6 rip / show ipv6 rip database
// ---------------------------------------------------------------------------

export function showIpv6Rip(r) {
  const s = [];
  let pid = 290;
  for (const nev of Object.keys(r.ripng)) {
    const sz = ripSzamlalok(r, 6);
    const alap = r.portok.some((p) => p.ripng === nev && p.ripngAlap);
    const t = RIPNG_IDOZITOK;
    s.push(`RIP process "${nev}", port 521, multicast-group FF02::9, pid ${pid++}`,
      '     Administrative distance is 120. Maximum paths is 16',
      `     Updates every ${t.frissites} seconds, expire after ${t.ervenytelen}`,
      `     Holddown lasts ${t.visszatartas} seconds, garbage collect after ${t.torles}`,
      '     Split horizon is on; poison reverse is off',
      `     Default routes are ${alap ? '' : 'not '}generated`,
      `     Periodic updates ${sz.periodikus}, trigger updates ${sz.valtozasra}`,
      '     Full Advertisement 0, Delayed Events 0',
      '  Interfaces:');
    for (const p of r.portok) if (p.ripng === nev) s.push(`    ${p.nev}`);
    s.push('  Redistribution:', '    None');
  }
  if (!s.length) s.push('');
  return s;
}

export function showIpv6RipDatabase(r) {
  const s = [];
  const rib = new Map(tabla6(r).map((e) => [`${ipv6Szoveg(e.halozat)}/${e.hossz}`, e.kod]));
  for (const nev of Object.keys(r.ripng)) {
    s.push(`RIP process "${nev}", local RIB`);
    if (!r.ipv6Routing) continue;
    for (const e of ripAdatbazis(r, 6).tanult) {
      const k = `${ipv6Szoveg(e.halozat)}/${e.hossz}`;
      if (e.le) {
        s.push(` ${k}, metric 16, expired`);
        continue;
      }
      s.push(` ${k}, metric ${e.metrika}${rib.get(k) === 'R' ? ', installed' : ''}`);
      for (const u of e.utak) {
        const lejar = Math.max(0, Math.ceil((u.ido + RIPNG_IDOZITOK.ervenytelen * 1000 - most(r)) / 1000));
        s.push(`     ${u.port}/${ipv6Szoveg(u.kovetkezo)}, expires in ${lejar} secs`);
      }
    }
  }
  return s;
}

// ---------------------------------------------------------------------------
// show ip arp
// ---------------------------------------------------------------------------

export function showIpArp(r) {
  const s = ['Protocol  Address          Age (min)  Hardware Addr   Type   Interface'];
  const sorok = [];
  for (const p of r.portok) {
    if (p.ip && portFent(p) && p.tipus === 'GigabitEthernet') sorok.push([p.ip, '-', p.mac, p.nev]);
  }
  for (const [ip, b] of Object.entries(r.arpTabla)) {
    const port = r.portok.find((p) => p.nev === b.port);
    if (port && port.tipus === 'GigabitEthernet') sorok.push([ip, String(Math.floor((most(r) - b.ido) / 60000)), b.mac, b.port]);
  }
  sorok.sort((a, b) => ipSzam(a[0]) - ipSzam(b[0]));
  for (const [ip, kor_, mac, port] of sorok) {
    s.push(`Internet  ${ip.padEnd(17)}${kor_.padStart(9)}   ${macPontos(mac)}  ARPA   ${port}`);
  }
  return s;
}

// ---------------------------------------------------------------------------
// show running-config
// ---------------------------------------------------------------------------

export function routerKonfiguracio(r) {
  const s = ['!', 'version 16.9', 'service timestamps debug datetime msec', 'service timestamps log datetime msec',
    'platform qfp utilization monitor load 80', 'no platform punt-keepalive disable-kernel-core', '!',
    `hostname ${r.hostname}`, '!', 'boot-start-marker', 'boot-end-marker', '!', '!', 'no aaa new-model', '!'];
  if (r.ipv6Routing) s.push('ipv6 unicast-routing');
  s.push('!', '!', '!', '!');
  for (const p of r.portok) {
    s.push(`interface ${p.nev}`);
    if (p.savszel) s.push(` bandwidth ${p.savszel}`);
    s.push(p.ip ? ` ip address ${p.ip} ${p.maszk}` : ' no ip address');
    if (p.leallitva) s.push(' shutdown');
    if (p.tipus === 'GigabitEthernet') s.push(' negotiation auto');
    if (p.tipus === 'Serial' && p.orajel) s.push(` clock rate ${p.orajel}`);
    if (p.linkLocal) s.push(` ipv6 address ${p.linkLocal} link-local`);
    for (const c of p.ipv6) s.push(` ipv6 address ${c.cim}/${c.hossz}`);
    if (p.ipv6Be) s.push(' ipv6 enable');
    if (p.ripng) {
      s.push(` ipv6 rip ${p.ripng} enable`);
      if (p.ripngAlap) s.push(` ipv6 rip ${p.ripng} default-information ${p.ripngAlap}`);
    }
    s.push('!');
  }
  if (r.rip) {
    const rip = r.rip;
    s.push('router rip');
    if (rip.verzio) s.push(` version ${rip.verzio}`);
    const t = rip.idozitok;
    if (t.frissites !== 30 || t.ervenytelen !== 180 || t.visszatartas !== 180 || t.torles !== 240) {
      s.push(` timers basic ${t.frissites} ${t.ervenytelen} ${t.visszatartas} ${t.torles}`);
    }
    for (const p of rip.passziv) s.push(` passive-interface ${p}`);
    for (const n of rip.halozatok) s.push(` network ${n}`);
    if (rip.alapUtvonal) s.push(' default-information originate');
    if (!rip.autoSummary) s.push(' no auto-summary');
    s.push('!');
  }
  s.push('ip forward-protocol nd', 'no ip http server', 'ip http secure-server');
  for (const st of r.statikus) {
    s.push(`ip route ${st.halozat} ${st.maszk}${st.interfesz ? ` ${st.interfesz}` : ''}${st.kovetkezo ? ` ${st.kovetkezo}` : ''}`);
  }
  s.push('!');
  for (const st of r.statikus6) {
    s.push(`ipv6 route ${st.prefix}${st.interfesz ? ` ${st.interfesz}` : ''}${st.kovetkezo ? ` ${st.kovetkezo}` : ''}`);
  }
  for (const nev of Object.keys(r.ripng)) s.push(`ipv6 router rip ${nev}`);
  s.push('!', '!', '!', 'control-plane', '!', '!', 'line con 0', ' transport input none', ' stopbits 1',
    'line aux 0', ' stopbits 1', 'line vty 0 4', ' login', '!', '!', 'end');
  return s;
}

export function showRunningConfigRouter(r) {
  const torzs = routerKonfiguracio(r);
  const bajt = torzs.reduce((o, sor) => o + sor.length + 1, 0);
  return ['Building configuration...', '', `Current configuration : ${bajt} bytes`, ...torzs, ''];
}

export { maszkSzoveg, prefixHossz, halozatSzam, ipv6Elemez };
