/**
 * Router, RIPv2 és RIPng: a rip-1 feladat hálózatán.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { feladatTeszt } from './segito.js';
import { ellenoriz } from '../src/feladat/ellenorzo.js';
import { PcMunkamenet } from '../src/cli/pc-munkamenet.js';

/** PC-parancs (a fokozatos kimenettel együtt). */
function pc(f, nev, sor, ido = 60000) {
  const mm = new PcMunkamenet({ eszkoz: f.eszkoz(nev), halozat: f.halozat });
  const ki = [];
  for (const e of mm.bevitel(sor).kimenet) {
    if (typeof e === 'string') ki.push(e);
    else if (e.folyamat) e.folyamat((s) => ki.push(s), () => {});
  }
  f.lep(ido);
  return ki;
}

/** Router-parancs; a fokozatos kimenetet (ping, traceroute) is összegyűjti. */
function rt(f, nev, ...sorok) {
  const mm = f.mm(nev);
  let ki = [];
  for (const s of sorok) {
    ki = [];
    for (const e of mm.bevitel(s).kimenet) {
      if (typeof e === 'string') ki.push(e);
      else if (e.folyamat) {
        let sor = '';
        e.folyamat((x) => ki.push(x), () => {}, (t) => { sor += t; });
        f.lep(40000);
        if (sor) ki.splice(ki.length - 1, 0, sor);
      }
    }
  }
  return ki;
}

/** A RIPv2 alapbeállítása (még auto-summaryval). */
function ripv2(f) {
  const L2 = f.e.L2;
  rt(f, 'R1', 'conf t', 'router rip', 'version 2', 'network 172.16.0.0', 'network 10.1.12.0', 'passive-interface g0/0/0', 'end');
  rt(f, 'R2', 'conf t', 'router rip', 'version 2', `network 192.168.${L2}.0`, 'network 10.0.0.0', 'passive-interface g0/0/0', 'end');
  rt(f, 'R3', 'conf t', 'router rip', 'version 2', 'network 172.16.0.0', 'network 10.0.0.0', 'passive-interface g0/0/0', 'end');
  f.lep(10000);
}

/** A teljes megoldás (rövidítve). */
function megold(f) {
  ripv2(f);
  for (const r of ['R1', 'R2', 'R3']) rt(f, r, 'conf t', 'router rip', 'no auto', 'end', 'clear ip route *');
  rt(f, 'R1', 'conf t', 'ip route 0.0.0.0 0.0.0.0 203.0.113.1', 'router rip', 'default-information originate', 'exit',
    'ipv6 unicast-routing', 'ipv6 router rip RIPNG', 'int range g0/0/0 - 1, s0/1/0', 'ipv6 rip RIPNG enable',
    'int range g0/0/1, s0/1/0', 'ipv6 rip RIPNG default-information originate', 'exit', 'ipv6 route ::/0 2001:db8:feed:1::1', 'end');
  rt(f, 'R2', 'conf t', 'ipv6 unicast-routing', 'int range g0/0/0 - 2', 'ipv6 rip RIPNG enable', 'end');
  rt(f, 'R3', 'conf t', 'ipv6 unicast-routing', 'int range g0/0/0 - 1', 'ipv6 rip RIPNG enable', 'int s0/1/0', 'ipv6 rip RIPNG enable', 'end');
  f.lep(40000);
}

function ellenorzes(f) {
  let eredmeny = null;
  ellenoriz(f, { kesz: (e) => { eredmeny = e; } });
  f.lep(400000);
  return eredmeny.map((e, i) => ({ ...e, szoveg: f.feladat.celok[i].szoveg }));
}

test('kiinduló állapot: csak C és L útvonalak, a ping „Destination net unreachable”', () => {
  const f = feladatTeszt('rip-1');
  const t = rt(f, 'R1', 'show ip route');
  assert.ok(t.includes('Gateway of last resort is not set'));
  assert.ok(t.some((s) => /^C +172\.16\.1\.0\/24 is directly connected, GigabitEthernet0\/0\/0$/.test(s)), t.join('\n'));
  assert.ok(!t.some((s) => /^R /.test(s)));
  const k = pc(f, 'PC1', 'ping -n 1 192.168.2.10');
  assert.equal(k[2], 'Reply from 172.16.1.1: Destination net unreachable.');
  assert.ok(k.some((s) => /172\.16\.1\.1 routertől jött/.test(s)));
  const b = rt(f, 'R2', 'show ip interface brief');
  assert.equal(b[0], 'Interface              IP-Address      OK? Method Status                Protocol');
  assert.equal(b[1], 'GigabitEthernet0/0/0   192.168.2.1     YES manual up                    up');
});

test('auto-summary: R2-n két egyenlő költségű 172.16.0.0/16, a ping hol megy, hol nem', () => {
  const f = feladatTeszt('rip-1');
  ripv2(f);
  const t = rt(f, 'R2', 'show ip route');
  const i = t.findIndex((s) => s.startsWith('R     172.16.0.0/16 [120/1] via'));
  assert.ok(i > 0, t.join('\n'));
  assert.match(t[i + 1], /^ {20}\[120\/1\] via 10\.1\.(12\.1|23\.2), \d\d:\d\d:\d\d, GigabitEthernet0\/0\/[12]$/);
  // A network 10.1.12.0 osztályos hálózatként tárolódik
  assert.ok(rt(f, 'R1', 'show running-config').includes(' network 10.0.0.0'));
  assert.ok(rt(f, 'R1', 'show ip protocols').includes('  Automatic network summarization is in effect'));
  const e = ellenorzes(f).find((x) => x.szoveg.startsWith('PC2 → PC1'));
  assert.ok(!e.ok);
  assert.match(e.megjegyzes, /3 pingből [12] sikerült.*Hol megy, hol nem/);
});

test('teljes megoldás: minden cél teljesül; a táblák a megoldókulcs szerintiek', () => {
  const f = feladatTeszt('rip-1');
  megold(f);
  const hibak = ellenorzes(f).filter((x) => !x.ok).map((x) => `${x.szoveg}: ${x.megjegyzes}`);
  assert.deepEqual(hibak, []);

  const t = rt(f, 'R2', 'show ip route');
  assert.ok(t.includes('Gateway of last resort is 10.1.12.1 to network 0.0.0.0'), t.join('\n'));
  assert.ok(t.some((s) => /^R\* {4}0\.0\.0\.0\/0 \[120\/1\] via 10\.1\.12\.1, .*GigabitEthernet0\/0\/1$/.test(s)));
  assert.ok(t.includes('      172.16.0.0/24 is subnetted, 2 subnets'));
  assert.ok(t.some((s) => /^R {8}172\.16\.1\.0 \[120\/1\] via 10\.1\.12\.1, /.test(s)));
  assert.ok(t.some((s) => /^R {8}172\.16\.3\.0 \[120\/1\] via 10\.1\.23\.2, /.test(s)));
  assert.ok(!t.some((s) => /203\.0\.113/.test(s)), 'az ISP-link nem szivárgott be');

  const t3 = rt(f, 'R3', 'show ip route rip');
  assert.ok(t3.some((s) => /^R\* {4}0\.0\.0\.0\/0 \[120\/1\] via 10\.1\.13\.1, .*Serial0\/1\/0$/.test(s)), t3.join('\n'));

  const v6 = rt(f, 'R2', 'show ipv6 route');
  const j = v6.indexOf('R   2001:DB8:ACAD:1::/64 [120/2]');
  assert.ok(j > 0, v6.join('\n'));
  assert.equal(v6[j + 1], '     via FE80::1, GigabitEthernet0/0/1');
  assert.ok(v6.includes('R   ::/0 [120/2]'));
  assert.ok(v6.includes('L   FF00::/8 [0/0]'));

  const p = rt(f, 'R1', 'show ip protocols');
  assert.ok(p.includes('  Default version control: send version 2, receive version 2'));
  assert.ok(p.includes('  Automatic network summarization is not in effect'));
  assert.ok(p.includes('  Passive Interface(s):'));
  assert.ok(!p.some((s) => /^ {4}GigabitEthernet0\/0\/0 +2/.test(s)), 'a passzív interfész nincs a küldők között');

  const db = rt(f, 'R3', 'show ipv6 rip database');
  assert.ok(db.some((s) => /^ ::\/0, metric 2, installed$/.test(s)), db.join('\n'));
});

test('véletlen változat: a megoldás ugyanígy működik', () => {
  for (const mag of [42, 9001]) {
    const f = feladatTeszt('rip-1', mag);
    const { L1, L2, L3 } = f.e;
    assert.ok(L1 >= 30 && L2 >= 30 && L3 >= 30 && L1 !== L3);
    megold(f);
    const hibak = ellenorzes(f).filter((x) => !x.ok).map((x) => `${x.szoveg}: ${x.megjegyzes}`);
    assert.deepEqual(hibak, [], `#${mag}`);
  }
});

test('metrika: PC1 → PC3 a soros vonalon; a vonal kiesésekor poisoning, majd kerülőút, visszakapcsolva újra soros', () => {
  const f = feladatTeszt('rip-1');
  megold(f);
  // Az első tracert-nél útközben még ARP-oznak a routerek (*); a második már tiszta.
  const elso = pc(f, 'PC1', 'tracert 172.16.3.10', 120000);
  assert.ok(elso.includes('  1    <1 ms    <1 ms    <1 ms  172.16.1.1'), elso.join('\n'));
  const tr = pc(f, 'PC1', 'tracert 172.16.3.10', 120000);
  assert.ok(tr.includes('  2    20 ms    20 ms    20 ms  10.1.13.2'), tr.join('\n'));
  assert.ok(tr.includes('Trace complete.'));

  // Debug R2-n, a soros vonal le R1-en
  assert.deepEqual(rt(f, 'R2', 'debug ip rip'), ['RIP protocol debugging is on']);
  const naplo = [];
  f.halozat.figyel((e) => { if (e.tipus === 'naplo' && e.eszkoz === f.eszkoz('R2')) naplo.push(e.sor); });
  rt(f, 'R1', 'conf t', 'int s0/1/0', 'shutdown');
  f.lep(3000);
  assert.ok(naplo.some((s) => /RIP: received v2 update from 10\.1\.12\.1 on GigabitEthernet0\/0\/1$/.test(s)), naplo.join('\n'));
  assert.ok(naplo.some((s) => /10\.1\.13\.0\/30 via 0\.0\.0\.0 in 16 hops$/.test(s)));
  assert.ok(naplo.some((s) => /172\.16\.3\.0\/24 via 0\.0\.0\.0 in 16 hops$/.test(s)));
  f.lep(35000);
  let t = rt(f, 'R1', 'do show ip route');
  assert.ok(t.some((s) => /^R {8}172\.16\.3\.0\/24 \[120\/2\] via 10\.1\.12\.2, .*GigabitEthernet0\/0\/1$/.test(s)), t.join('\n'));
  // Kerülőúton négy ugrás, de gyorsabb
  const tr2 = pc(f, 'PC1', 'tracert 172.16.3.10', 120000);
  assert.ok(tr2.some((s) => /^ {2}4 .*172\.16\.3\.10$/.test(s)), tr2.join('\n'));
  rt(f, 'R1', 'no shutdown');
  f.lep(10000);
  t = rt(f, 'R1', 'do show ip route rip');
  assert.ok(t.some((s) => /^R {8}172\.16\.3\.0\/24 \[120\/1\] via 10\.1\.13\.2, .*Serial0\/1\/0$/.test(s)), t.join('\n'));
  assert.deepEqual(rt(f, 'R2', 'undebug all'), ['All possible debugging has been turned off']);
});

test('router ping és traceroute; IPv6-hibaüzenet; hibás címek', () => {
  const f = feladatTeszt('rip-1');
  megold(f);
  const p = rt(f, 'R2', 'ping 198.51.100.1');
  assert.equal(p[0], 'Type escape sequence to abort.');
  assert.equal(p[1], 'Sending 5, 100-byte ICMP Echos to 198.51.100.1, timeout is 2 seconds:');
  assert.match(p[2], /^\.*!+$/);
  assert.match(p[3], /^Success rate is \d+ percent \([1-5]\/5\), round-trip min\/avg\/max = 20\/20\/20 ms$/);
  assert.deepEqual(rt(f, 'R2', 'ping 198.51.100.1').slice(2), ['!!!!!', 'Success rate is 100 percent (5/5), round-trip min/avg/max = 20/20/20 ms']);
  const tr = rt(f, 'R2', 'traceroute 2001:DB8:ACAD:3::10');
  assert.equal(tr[1], 'Tracing the route to 2001:DB8:ACAD:3::10');
  assert.ok(tr.some((s) => /^ {2}1 2001:DB8:ACAD:23::2 /.test(s)), tr.join('\n'));

  const g = feladatTeszt('rip-1');
  assert.deepEqual(rt(g, 'R2', 'conf t', 'ipv6 router rip RIPNG'), ['% IPv6 routing not enabled']);
  assert.deepEqual(rt(g, 'R2', 'ip route 10.1.1.1 255.255.255.0 10.1.12.1'), ['%Inconsistent address and mask']);
  assert.deepEqual(rt(g, 'R2', 'int g0/0/2', 'ip address 10.1.12.1 255.255.255.252'), ['% 10.1.12.0 overlaps with GigabitEthernet0/0/1']);
  assert.deepEqual(rt(g, 'R2', 'ip address 10.1.23.0 255.255.255.252'), ['Bad mask /30 for address 10.1.23.0']);
  assert.deepEqual(rt(g, 'R2', 'ipv6 address fe80::5/64'), ['% Use the link-local keyword to configure a link-local address']);
});

test('verzióeltérés: a csak v2-t fogadó router eldobja a v1-es frissítést', () => {
  const f = feladatTeszt('rip-1');
  rt(f, 'R1', 'conf t', 'router rip', 'network 10.0.0.0', 'end');
  rt(f, 'R2', 'debug ip rip', 'conf t', 'router rip', 'version 2', 'network 10.0.0.0', 'end');
  const naplo = [];
  f.halozat.figyel((e) => { if (e.tipus === 'naplo' && e.eszkoz === f.eszkoz('R2')) naplo.push(e.sor); });
  f.lep(40000);
  assert.ok(naplo.some((s) => /RIP: ignored v1 packet from 10\.1\.12\.1 \(illegal version\)$/.test(s)), naplo.join('\n'));
  assert.ok(!rt(f, 'R2', 'show ip route').some((s) => /^R /.test(s)));
});

test('passzív interfész: a LAN felé nem megy RIP-frissítés, a hálózatát mégis hirdeti', () => {
  const f = feladatTeszt('rip-1');
  ripv2(f);
  let lanra = 0;
  f.halozat.figyel((e) => {
    if (e.tipus === 'keret' && e.hova.eszkoz === f.eszkoz('PC1') && e.keret.adat && e.keret.adat.protokoll === 'udp') lanra++;
  });
  f.lep(70000);
  assert.equal(lanra, 0);
  assert.ok(rt(f, 'R1', 'show ip rip database').some((s) => /^172\.16\.1\.0\/24 {4}directly connected, GigabitEthernet0\/0\/0$/.test(s)));
});
