/**
 * Az OSPF show-parancsainak kimenetei (IOS XE 16 jellegű forma): show ip ospf [neighbor |
 * interface [brief | <if>] | database], show ipv6 ospf …, és a show ip protocols / show ipv6
 * protocols OSPF-része.
 *
 * A kimenet mindig az eszköz aktuális állapotából készül. A forma (oszlopok, sorrend) a
 * nyilvános forrásokban és a Routerrántotta OSPF-leckéiben látható kimeneteket követi
 * (docs/forrasok.md); a ritkábban látott sorokat rövidítve adjuk.
 */

import { ipSzam, ipSzoveg, prefixHossz } from '../../../mag/ip.js';
import { ipv6Szoveg } from '../../../mag/ipv6.js';
import { portFent, portLinkLocal } from '../../../mag/utvonal.js';
import {
  ospfBeall, ospfAllapot, ospfAdatbazis, ospfTerulet, szomszedSzerep, koltseg, interfeszAzon,
  lsaKor, lsaOsszeg, passzivE,
} from '../../../mag/ospf.js';

function most(r) {
  return r.halozat ? r.halozat.ora.ido : 0;
}

/** Idő hh:mm:ss alakban. */
function hms(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const p = (x) => String(x).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`;
}

function hmsEzred(ms) {
  const e = Math.max(0, Math.floor(ms));
  const s = Math.floor(e / 1000);
  const p = (x) => String(x).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}.${String(e % 1000).padStart(3, '0')}`;
}

function rovid(nev) {
  return nev.replace(/^GigabitEthernet/, 'Gi').replace(/^Serial/, 'Se').replace(/^Loopback/, 'Lo');
}

function fejlec(r, csalad) {
  const o = ospfBeall(r, csalad);
  const a = ospfAllapot(r, csalad);
  return csalad === 4
    ? `            OSPF Router with ID (${a.rid}) (Process ID ${o.folyamat})`
    : `          OSPFv3 Router with ID (${a.rid}) (Process ID ${o.folyamat})`;
}

/** Ha nincs futó folyamat: üres kimenet (mint a valódi eszközön). */
function fut(r, csalad) {
  return !!ospfBeall(r, csalad) && ospfAllapot(r, csalad).fut;
}

const ALLAPOT_ROVID = { BROADCAST: '', POINT_TO_POINT: 'P2P', LOOPBACK: 'LOOP' };

/** Az interfész állapota a brief-táblázatban (DR, BDR, DROTH, P2P, LOOP, WAIT). */
function ifAllapotRovid(I) {
  if (I.allapot === 'DROTHER') return 'DROTH';
  if (I.allapot === 'WAITING') return 'WAIT';
  return ALLAPOT_ROVID[I.tipus] || I.allapot;
}

// ---------------------------------------------------------------------------
// show ip ospf neighbor / show ipv6 ospf neighbor
// ---------------------------------------------------------------------------

export function showOspfNeighbor(r, csalad) {
  if (!fut(r, csalad)) return [];
  const a = ospfAllapot(r, csalad);
  const s = csalad === 4
    ? ['', 'Neighbor ID     Pri   State           Dead Time   Address         Interface']
    : ['', fejlec(r, 6), '', 'Neighbor ID     Pri   State           Dead Time   Interface ID    Interface'];
  const ifek = [...a.ifek].reverse();
  for (const I of ifek) {
    for (const n of I.szomszedok) {
      const szerep = szomszedSzerep(I, n);
      const allapot = `${n.allapot}/${szerep === '-' ? '  -' : szerep}`;
      const dead = hms(n.deadLejar - most(r));
      const kozep = csalad === 4 ? n.cim.padEnd(16) : String(n.ifId).padEnd(16);
      s.push(`${n.rid.padEnd(15)}${String(n.prioritas).padStart(4)}   ${allapot.padEnd(16)}${dead.padEnd(12)}${kozep}${I.port}`);
    }
  }
  if (csalad === 6) s.push('');
  return s;
}

// ---------------------------------------------------------------------------
// show ip ospf interface brief / show ipv6 ospf interface brief
// ---------------------------------------------------------------------------

export function showOspfIntBrief(r, csalad) {
  if (!fut(r, csalad)) return [];
  const o = ospfBeall(r, csalad);
  const a = ospfAllapot(r, csalad);
  const s = [csalad === 4
    ? 'Interface    PID   Area            IP Address/Mask    Cost  State Nbrs F/C'
    : 'Interface    PID   Area            Intf ID    Cost  State Nbrs F/C'];
  for (const I of [...a.ifek].reverse()) {
    const p = r.portok.find((x) => x.nev === I.port);
    const teljes = I.szomszedok.filter((n) => n.allapot === 'FULL').length;
    const kozep = csalad === 4 ? `${p.ip}/${prefixHossz(p.maszk)}`.padEnd(19) : String(interfeszAzon(r, p)).padEnd(11);
    s.push(`${rovid(p.nev).padEnd(13)}${String(o.folyamat).padEnd(6)}${String(I.terulet).padEnd(16)}${kozep}`
      + `${String(koltseg(r, p, csalad)).padEnd(6)}${ifAllapotRovid(I).padEnd(6)}${teljes}/${I.szomszedok.length}`);
  }
  return s;
}

// ---------------------------------------------------------------------------
// show ip ospf interface [<if>] / show ipv6 ospf interface [<if>]
// ---------------------------------------------------------------------------

function ifReszletek(r, csalad, p) {
  const o = ospfBeall(r, csalad);
  const a = ospfAllapot(r, csalad);
  const I = a.ifek.find((x) => x.port === p.nev);
  const fejSor = `${p.nev} is ${p.leallitva ? 'administratively down' : portFent(p) ? 'up' : 'down'}, line protocol is ${portFent(p) ? 'up' : 'down'}`;
  const t = ospfTerulet(r, p, csalad);
  if (!t) return [fejSor, `  ${csalad === 4 ? 'OSPF' : 'OSPFv3'} not enabled on this interface`];
  if (!I) {
    return [fejSor, csalad === 4 ? `  Internet Address ${p.ip}/${prefixHossz(p.maszk)}, Area ${t.terulet}` : `  Area ${t.terulet}, Process ID ${o.folyamat}`,
      `  Process ID ${o.folyamat}, Router ID ${a.rid || '0.0.0.0'}, Network Type ${I ? I.tipus : 'BROADCAST'}, Cost: ${koltseg(r, p, csalad)}`,
      '  Interface is down'];
  }
  const s = [fejSor];
  const tip = I.tipus;
  if (csalad === 4) {
    s.push(`  Internet Address ${p.ip}/${prefixHossz(p.maszk)}, Area ${I.terulet}, Attached via ${t.mod === 'network' ? 'Network Statement' : 'Interface Enable'}`);
    s.push(`  Process ID ${o.folyamat}, Router ID ${a.rid}, Network Type ${tip}, Cost: ${koltseg(r, p, csalad)}`);
  } else {
    s.push(`  Link Local Address ${ipv6Szoveg(portLinkLocal(p))}, Interface ID ${interfeszAzon(r, p)}`);
    s.push(`  Area ${I.terulet}, Process ID ${o.folyamat}, Instance ID 0, Router ID ${a.rid}`);
    s.push(`  Network Type ${tip}, Cost: ${koltseg(r, p, csalad)}`);
  }
  if (tip === 'LOOPBACK') {
    s.push(`  Loopback interface is treated as a stub Host`);
    return s;
  }
  const allapotNev = I.allapot === 'P2P' ? 'POINT_TO_POINT' : I.allapot;
  s.push(`  Transmit Delay is 1 sec, State ${allapotNev}${tip === 'BROADCAST' ? `, Priority ${(csalad === 4 ? p.ospf : p.ospf6).prioritas}` : ''}`);
  if (tip === 'BROADCAST') {
    if (I.dr) s.push(csalad === 4 ? `  Designated Router (ID) ${I.dr.rid}, Interface address ${I.dr.cim}` : `  Designated Router (ID) ${I.dr.rid}, local address ${I.dr.cim}`);
    else s.push('  No designated router on this network');
    if (I.bdr) s.push(csalad === 4 ? `  Backup Designated router (ID) ${I.bdr.rid}, Interface address ${I.bdr.cim}` : `  Backup Designated router (ID) ${I.bdr.rid}, local address ${I.bdr.cim}`);
    else s.push('  No backup designated router on this network');
  }
  s.push(`  Timer intervals configured, Hello ${I.idok.hello}, Dead ${I.idok.dead}, Wait ${I.idok.dead}, Retransmit 5`);
  if (I.passziv) s.push('    No Hellos (Passive interface)');
  else s.push(`    Hello due in ${hms(I.kovHello - most(r))}`);
  if (csalad === 4) {
    const h = p.ospf.hitelesites;
    if (h === 'md5') {
      const ids = Object.keys(p.ospf.kulcsok).map(Number).sort((x, y) => y - x);
      s.push('  Cryptographic authentication enabled');
      s.push(ids.length ? `    Youngest key id is ${ids[0]}` : '    No key configured, using default key id 0');
    } else if (h === 'egyszeru') {
      s.push('  Simple password authentication enabled');
    }
  }
  const teljes = I.szomszedok.filter((n) => n.allapot === 'FULL');
  s.push(`  Neighbor Count is ${I.szomszedok.length}, Adjacent neighbor count is ${teljes.length}`);
  for (const n of teljes) {
    const sz = szomszedSzerep(I, n);
    const megj = sz === 'DR' ? '  (Designated Router)' : sz === 'BDR' ? '  (Backup Designated Router)' : '';
    s.push(`    Adjacent with neighbor ${n.rid}${megj}`);
  }
  s.push('  Suppress hello for 0 neighbor(s)');
  return s;
}

export function showOspfInterface(r, csalad, nev = null) {
  if (!ospfBeall(r, csalad)) return [];
  if (nev) {
    const p = r.portok.find((x) => x.nev === nev);
    return p ? ifReszletek(r, csalad, p) : [];
  }
  if (!fut(r, csalad)) return [];
  const a = ospfAllapot(r, csalad);
  const s = [];
  for (const I of a.ifek) s.push(...ifReszletek(r, csalad, r.portok.find((x) => x.nev === I.port)));
  return s;
}

// ---------------------------------------------------------------------------
// show ip ospf database / show ipv6 ospf database
// ---------------------------------------------------------------------------

function seq(n) {
  return `0x${(n >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
}

export function showOspfDatabase(r, csalad) {
  if (!fut(r, csalad)) return [];
  const db = ospfAdatbazis(r, csalad);
  const s = ['', fejlec(r, csalad)];
  const kor = (l) => String(lsaKor(r, l)).padEnd(12);
  if (csalad === 4) {
    for (const { terulet, lsak } of db.teruletek) {
      const rt = lsak.filter((l) => l.tipus === 'router').sort((x, y) => ipSzam(x.lsId) - ipSzam(y.lsId));
      const nt = lsak.filter((l) => l.tipus === 'network').sort((x, y) => ipSzam(x.lsId) - ipSzam(y.lsId));
      s.push('', `                Router Link States (Area ${terulet})`, '', 'Link ID         ADV Router      Age         Seq#       Checksum Link count');
      for (const l of rt) s.push(`${l.lsId.padEnd(16)}${l.adv.padEnd(16)}${kor(l)}${seq(l.sorszam)} ${lsaOsszeg(l)} ${l.torzs.linkek.length}`);
      if (nt.length) {
        s.push('', `                Net Link States (Area ${terulet})`, '', 'Link ID         ADV Router      Age         Seq#       Checksum');
        for (const l of nt) s.push(`${l.lsId.padEnd(16)}${l.adv.padEnd(16)}${kor(l)}${seq(l.sorszam)} ${lsaOsszeg(l)}`);
      }
    }
    if (db.kulso.length) {
      s.push('', '                Type-5 AS External Link States', '', 'Link ID         ADV Router      Age         Seq#       Checksum Tag');
      for (const l of db.kulso) s.push(`${l.lsId.padEnd(16)}${l.adv.padEnd(16)}${kor(l)}${seq(l.sorszam)} ${lsaOsszeg(l)} ${l.torzs.tag}`);
    }
    s.push('');
    return s;
  }
  const kor6 = (l) => String(lsaKor(r, l)).padEnd(12);
  const rendez = (x, y) => ipSzam(x.adv) - ipSzam(y.adv) || Number(x.lsId) - Number(y.lsId);
  for (const { terulet, lsak } of db.teruletek) {
    const rt = lsak.filter((l) => l.tipus === 'router').sort(rendez);
    const nt = lsak.filter((l) => l.tipus === 'network').sort(rendez);
    const lt = lsak.filter((l) => l.tipus === 'link').sort(rendez);
    const pt = lsak.filter((l) => l.tipus === 'prefix').sort(rendez);
    s.push('', `                Router Link States (Area ${terulet})`, '', 'ADV Router       Age         Seq#        Fragment ID  Link count  Bits');
    for (const l of rt) {
      s.push(`${l.adv.padEnd(17)}${kor6(l)}${seq(l.sorszam).padEnd(12)}${'0'.padEnd(13)}${String(l.torzs.linkek.length).padEnd(12)}${l.torzs.asbr ? 'E' : 'None'}`);
    }
    if (nt.length) {
      s.push('', `                Net Link States (Area ${terulet})`, '', 'ADV Router       Age         Seq#        Link ID    Rtr count');
      for (const l of nt) s.push(`${l.adv.padEnd(17)}${kor6(l)}${seq(l.sorszam).padEnd(12)}${l.lsId.padEnd(11)}${l.torzs.routerek.length}`);
    }
    if (lt.length) {
      s.push('', `                Link (Type-8) Link States (Area ${terulet})`, '', 'ADV Router       Age         Seq#        Link ID    Interface');
      for (const l of lt) s.push(`${l.adv.padEnd(17)}${kor6(l)}${seq(l.sorszam).padEnd(12)}${l.lsId.padEnd(11)}${rovid(l.link || '')}`);
    }
    if (pt.length) {
      s.push('', `                Intra Area Prefix Link States (Area ${terulet})`, '', 'ADV Router       Age         Seq#        Link ID    Ref-lstype  Ref-LSID');
      for (const l of pt) {
        s.push(`${l.adv.padEnd(17)}${kor6(l)}${seq(l.sorszam).padEnd(12)}${l.lsId.padEnd(11)}${(l.torzs.ref === 'router' ? '0x2001' : '0x2002').padEnd(12)}${l.torzs.refId}`);
      }
    }
  }
  if (db.kulso.length) {
    s.push('', '                Type-5 AS External Link States', '', 'ADV Router       Age         Seq#        Prefix');
    for (const l of db.kulso) s.push(`${l.adv.padEnd(17)}${kor6(l)}${seq(l.sorszam).padEnd(12)}${l.torzs.prefix}`);
  }
  s.push('');
  return s;
}

// ---------------------------------------------------------------------------
// show ip ospf / show ipv6 ospf (a folyamat összefoglalója, rövidítve)
// ---------------------------------------------------------------------------

export function showOspf(r, csalad) {
  if (!fut(r, csalad)) return [];
  const o = ospfBeall(r, csalad);
  const a = ospfAllapot(r, csalad);
  const db = ospfAdatbazis(r, csalad);
  const s = [csalad === 4 ? ` Routing Process "ospf ${o.folyamat}" with ID ${a.rid}` : ` Routing Process "ospfv3 ${o.folyamat}" with ID ${a.rid}`];
  s.push(` Start time: ${hmsEzred(a.indulas)}, Time elapsed: ${hmsEzred(most(r) - a.indulas)}`);
  if (csalad === 4) s.push(' Supports only single TOS(TOS0) routes');
  const asbr = db.kulso.some((l) => l.adv === a.rid);
  if (asbr) s.push(' It is an autonomous system boundary router', ' Redistributing External Routes from,');
  s.push(` Number of external LSA ${db.kulso.length}`);
  const teruletek = [...new Set(a.ifek.map((I) => I.terulet))].sort((x, y) => x - y);
  s.push(` Number of areas in this router is ${teruletek.length}. ${teruletek.length} normal 0 stub 0 nssa`);
  s.push(` Reference bandwidth unit is ${o.referencia} mbps`);
  for (const T of teruletek) {
    const lsak = (db.teruletek.find((x) => x.terulet === T) || { lsak: [] }).lsak;
    const ifSzam = a.ifek.filter((I) => I.terulet === T).length;
    s.push(`    Area ${T === 0 ? 'BACKBONE(0)' : T}`);
    s.push(`        Number of interfaces in this area is ${ifSzam}`);
    if (csalad === 4) {
      const md5 = r.portok.some((p) => a.ifek.some((I) => I.port === p.nev && I.terulet === T) && p.ospf.hitelesites === 'md5');
      s.push(md5 ? '        Area has no authentication (interface-level authentication is configured)' : '        Area has no authentication');
    }
    if (a.spfIdo !== null) s.push(`        SPF algorithm last executed ${hmsEzred(most(r) - a.spfIdo)} ago`);
    s.push(`        SPF algorithm executed ${a.spfSzam} times`);
    s.push(`        Number of LSA ${lsak.length}`);
  }
  s.push('');
  return s;
}

// ---------------------------------------------------------------------------
// show ip protocols / show ipv6 protocols – az OSPF-rész
// ---------------------------------------------------------------------------

export function ipProtocolsOspf(r) {
  const o = r.ospf;
  if (!o) return [];
  const a = ospfAllapot(r, 4);
  const db = ospfAdatbazis(r, 4);
  const s = [`Routing Protocol is "ospf ${o.folyamat}"`,
    '  Outgoing update filter list for all interfaces is not set',
    '  Incoming update filter list for all interfaces is not set',
    `  Router ID ${a.fut ? a.rid : (o.routerId || '0.0.0.0')}`];
  if (db.kulso.some((l) => l.adv === a.rid)) s.push('  It is an autonomous system boundary router', ' Redistributing External Routes from,');
  const teruletek = [...new Set(a.ifek.map((I) => I.terulet))];
  const n = Math.max(teruletek.length, o.halozatok.length ? 1 : 0);
  s.push(`  Number of areas in this router is ${n}. ${n} normal 0 stub 0 nssa`);
  s.push(`  Maximum path: ${o.maxUtak}`);
  s.push('  Routing for Networks:');
  for (const h of o.halozatok) s.push(`    ${h.cim} ${h.wildcard} area ${h.terulet}`);
  const expl = r.portok.filter((p) => p.ospf.folyamat === o.folyamat && p.ospf.terulet !== null);
  const expT = [...new Set(expl.map((p) => p.ospf.terulet))].sort((x, y) => x - y);
  for (const T of expT) {
    s.push(`  Routing on Interfaces Configured Explicitly (Area ${T}):`);
    for (const p of expl.filter((x) => x.ospf.terulet === T)) s.push(`    ${p.nev}`);
  }
  const passz = r.portok.filter((p) => passzivE(r, p, 4));
  if (passz.length) {
    s.push('  Passive Interface(s):');
    for (const p of passz) s.push(`    ${p.nev}`);
  }
  s.push('  Routing Information Sources:', '    Gateway         Distance      Last Update');
  const forrasok = [];
  for (const { lsak } of db.teruletek) for (const l of lsak) if (l.tipus === 'router' && l.adv !== a.rid) forrasok.push(l);
  forrasok.sort((x, y) => ipSzam(x.adv) - ipSzam(y.adv));
  for (const l of forrasok) s.push(`    ${l.adv.padEnd(15)}${'110'.padStart(9)}      ${hms(most(r) - l.ido)}`);
  s.push('  Distance: (default is 110)', '');
  return s;
}

export function ipv6ProtocolsOspf(r) {
  const o = r.ospf6;
  if (!o) return [];
  const a = ospfAllapot(r, 6);
  const db = ospfAdatbazis(r, 6);
  const s = [`IPv6 Routing Protocol is "ospf ${o.folyamat}"`, `  Router ID ${a.fut ? a.rid : (o.routerId || '0.0.0.0')}`];
  if (db.kulso.some((l) => l.adv === a.rid)) s.push('  Autonomous system boundary router');
  const teruletek = [...new Set(a.ifek.map((I) => I.terulet))].sort((x, y) => x - y);
  s.push(`  Number of areas: ${teruletek.length} normal, 0 stub, 0 nssa`);
  for (const T of teruletek) {
    s.push(`  Interfaces (Area ${T}):`);
    for (const I of a.ifek.filter((x) => x.terulet === T)) s.push(`    ${I.port}`);
  }
  s.push('  Redistribution:', '    None');
  return s;
}

export { ipSzoveg };
