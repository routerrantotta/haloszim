/**
 * OSPFv2 és OSPFv3: az ospf-1 és az ospf-2 feladat hálózatán.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { feladatTeszt } from './segito.js';
import { ellenoriz } from '../src/feladat/ellenorzo.js';
import { ospfAllapot, ospfUtvonalak } from '../src/mag/ospf.js';
import { PcMunkamenet } from '../src/cli/pc-munkamenet.js';

/** Router-parancsok; a fokozatos kimenetet (ping) is összegyűjti. */
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
        f.lep(30000);
        if (sor) ki.splice(ki.length - 1, 0, sor);
      }
    }
  }
  return ki;
}

/** A konzolüzenetek gyűjtése. */
function naplozo(f) {
  const l = [];
  f.halozat.figyel((e) => { if (e.tipus === 'naplo') l.push(`${e.eszkoz.hostname}: ${e.sor}`); });
  return l;
}

function szomszed(f, nev, rid, csalad = 4) {
  for (const I of ospfAllapot(f.eszkoz(nev), csalad).ifek) {
    const n = I.szomszedok.find((x) => x.rid === rid);
    if (n) return { ...n, I };
  }
  return null;
}

function hibak(f) {
  let e = null;
  ellenoriz(f, { kesz: (x) => { e = x; } });
  f.lep(300000);
  return e.map((x, i) => (x.ok ? null : `${f.feladat.celok[i].szoveg}: ${x.megjegyzes}`)).filter(Boolean);
}

/** Az ospf-1 alapja: OSPF mindhárom routeren (a hibás Hello-idővel R3-on). */
function alap1(f) {
  const { L1, L2, L3 } = f.e;
  rt(f, 'R1', 'conf t', 'router ospf 1', 'router-id 1.1.1.1', 'network 10.0.12.0 0.0.0.3 area 0', 'network 10.0.13.0 0.0.0.3 area 0',
    `network 192.168.${L1}.0 0.0.0.255 area 0`, 'end');
  rt(f, 'R2', 'conf t', 'router ospf 1', 'router-id 2.2.2.2', 'network 10.0.12.0 0.0.0.3 area 0', 'network 10.0.23.0 0.0.0.3 area 0',
    `network 192.168.${L2}.0 0.0.0.255 area 0`, 'end');
  rt(f, 'R3', 'conf t', 'router ospf 1', 'router-id 3.3.3.3', 'network 10.0.13.0 0.0.0.3 area 0', 'network 10.0.23.0 0.0.0.3 area 0',
    `network 192.168.${L3}.0 0.0.0.255 area 0`, 'end');
  f.lep(60000);
}

/** A teljes ospf-1 megoldás (rövidítve). */
function megold1(f) {
  alap1(f);
  rt(f, 'R3', 'conf t', 'int g0/0/0', 'no ip ospf hello', 'end');
  for (const r of ['R1', 'R2', 'R3']) rt(f, r, 'conf t', 'router ospf 1', 'pass g0/0/2', 'auto-cost ref 10000', 'end');
  rt(f, 'R1', 'conf t', 'ip route 0.0.0.0 0.0.0.0 203.0.113.1', 'router ospf 1', 'default-information originate', 'end');
  rt(f, 'R2', 'conf t', 'int g0/0/1', 'ip ospf net point-to-point', 'int g0/0/0', 'ip ospf prio 100', 'end');
  rt(f, 'R3', 'conf t', 'int g0/0/1', 'ip ospf net point-to-point', 'end');
  f.lep(60000);
  rt(f, 'R1', 'clear ip ospf process', 'yes');
  f.lep(60000);
  rt(f, 'R1', 'conf t', 'int g0/0/1', 'ip ospf cost 50', 'int g0/0/0', 'ip ospf authentication message-digest', `ip ospf message-digest-key 1 md5 ${f.e.KULCS}`, 'end');
  rt(f, 'R2', 'conf t', 'int g0/0/0', 'ip ospf authentication message-digest', `ip ospf message-digest-key 1 md5 ${f.e.KULCS}`, 'end');
  f.lep(60000);
}

test('ospf-1: a teljes megoldás után az ellenőrzés hibátlan (alapadatok és véletlen változat)', () => {
  for (const mag of [null, 42]) {
    const f = feladatTeszt('ospf-1', mag);
    megold1(f);
    assert.deepEqual(hibak(f), []);
  }
});

test('ospf-1: a beépített hiba – eltérő Hello-idő: nincs R1–R3 szomszédság, a debug megmutatja', () => {
  const f = feladatTeszt('ospf-1');
  const naplo = naplozo(f);
  alap1(f);
  assert.equal(szomszed(f, 'R1', '3.3.3.3'), null);
  assert.equal(szomszed(f, 'R1', '2.2.2.2').allapot, 'FULL');
  rt(f, 'R1', 'debug ip ospf hello');
  f.lep(11000);
  assert.ok(naplo.some((s) => s.includes('OSPF-1 HELLO Gi0/0/1: Mismatched hello parameters from 10.0.13.2')));
  assert.ok(naplo.some((s) => s.includes('Dead R 20 C 40, Hello R 5 C 10')));
  assert.deepEqual(rt(f, 'R1', 'undebug all'), ['All possible debugging has been turned off']);
  const ki = rt(f, 'R3', 'show ip ospf interface g0/0/0');
  assert.ok(ki.includes('  Timer intervals configured, Hello 5, Dead 20, Wait 20, Retransmit 5'));
  rt(f, 'R3', 'conf t', 'int g0/0/0', 'no ip ospf hello-interval', 'end');
  f.lep(60000);
  assert.equal(szomszed(f, 'R1', '3.3.3.3').allapot, 'FULL');
  assert.ok(naplo.some((s) => /R1: .*%OSPF-5-ADJCHG: Process 1, Nbr 3\.3\.3\.3 on GigabitEthernet0\/0\/1 from (LOADING|EXCHANGE) to FULL/.test(s)));
  // A hiba javítása nélkül az ellenőrzés jelzi
  const f2 = feladatTeszt('ospf-1');
  alap1(f2);
  const h = hibak(f2);
  assert.ok(h.some((x) => x.startsWith('R1 és R3 szomszédsága FULL')));
});

test('show ip ospf neighbor, interface brief, ip route: a lecke formája', () => {
  const f = feladatTeszt('ospf-1');
  alap1(f);
  rt(f, 'R3', 'conf t', 'int g0/0/0', 'no ip ospf hello-interval', 'end');
  for (const r of ['R1', 'R2', 'R3']) rt(f, r, 'conf t', 'router ospf 1', 'passive-interface g0/0/2', 'auto-cost reference-bandwidth 10000', 'end');
  f.lep(60000);
  const nbr = rt(f, 'R1', 'show ip ospf neighbor');
  assert.equal(nbr[1], 'Neighbor ID     Pri   State           Dead Time   Address         Interface');
  // Egyszerre indultak: mindkét linken a nagyobb router ID-jű szomszéd a DR (mint a lecke példájában).
  assert.match(nbr[2], /^3\.3\.3\.3 {11}1 {3}FULL\/DR {9}00:00:\d\d {4}10\.0\.13\.2 {7}GigabitEthernet0\/0\/1$/);
  assert.match(nbr[3], /^2\.2\.2\.2 {11}1 {3}FULL\/DR {9}00:00:\d\d {4}10\.0\.12\.2 {7}GigabitEthernet0\/0\/0$/);
  const brief = rt(f, 'R1', 'show ip ospf interface brief');
  assert.equal(brief[0], 'Interface    PID   Area            IP Address/Mask    Cost  State Nbrs F/C');
  assert.equal(brief[1], 'Gi0/0/2      1     0               192.168.1.1/24     10    DR    0/0');
  assert.equal(brief[2], 'Gi0/0/1      1     0               10.0.13.1/30       10    BDR   1/1');
  assert.equal(brief[3], 'Gi0/0/0      1     0               10.0.12.1/30       10    BDR   1/1');
  const ut = rt(f, 'R1', 'show ip route ospf');
  assert.ok(ut.some((s) => /^O {8}10\.0\.23\.0\/30 \[110\/20\] via 10\.0\.12\.2, \d\d:\d\d:\d\d, GigabitEthernet0\/0\/0$/.test(s)));
  assert.ok(ut.some((s) => /^ {22}\[110\/20\] via 10\.0\.13\.2, \d\d:\d\d:\d\d, GigabitEthernet0\/0\/1$/.test(s)), 'két egyenlő költségű út');
  assert.ok(ut.some((s) => /^O {5}192\.168\.2\.0\/24 \[110\/20\] via 10\.0\.12\.2/.test(s)));
  assert.ok(!ut.some((s) => /^C /.test(s)), 'a szűrő csak az OSPF-útvonalakat mutatja');
  const pr = rt(f, 'R1', 'show ip protocols');
  assert.ok(pr.includes('Routing Protocol is "ospf 1"'));
  assert.ok(pr.includes('    10.0.12.0 0.0.0.3 area 0'));
  assert.ok(pr.includes('  Passive Interface(s):'));
  assert.ok(pr.some((s) => /^ {4}3\.3\.3\.3 {14}110 {6}\d\d:\d\d:\d\d$/.test(s)));
  const db = rt(f, 'R2', 'show ip ospf database');
  assert.ok(db.includes('            OSPF Router with ID (2.2.2.2) (Process ID 1)'));
  assert.equal(db.filter((s) => /^\d+\.\d+\.\d+\.\d+ +\d+\.\d+\.\d+\.\d+ +\d+ +0x8/.test(s)).length, 6, '3 Router LSA + 3 Network LSA');
});

test('default-information originate: O*E2 a többieknél, csak ha van alapértelmezett útvonal (vagy always)', () => {
  const f = feladatTeszt('ospf-1');
  alap1(f);
  rt(f, 'R1', 'conf t', 'router ospf 1', 'default-information originate', 'end');
  f.lep(5000);
  assert.ok(!ospfUtvonalak(f.eszkoz('R2'), 4).some((e) => e.hossz === 0), 'nincs mit hirdetni');
  rt(f, 'R1', 'conf t', 'ip route 0.0.0.0 0.0.0.0 203.0.113.1', 'end');
  f.lep(5000);
  const ki = rt(f, 'R2', 'show ip route');
  assert.ok(ki.includes('Gateway of last resort is 10.0.12.1 to network 0.0.0.0'));
  assert.ok(ki.some((s) => /^O\*E2  0\.0\.0\.0\/0 \[110\/1\] via 10\.0\.12\.1, \d\d:\d\d:\d\d, GigabitEthernet0\/0\/0$/.test(s)));
  rt(f, 'R1', 'conf t', 'no ip route 0.0.0.0 0.0.0.0 203.0.113.1', 'router ospf 1', 'default-information originate always', 'end');
  f.lep(5000);
  assert.ok(ospfUtvonalak(f.eszkoz('R2'), 4).some((e) => e.hossz === 0 && e.alKod === 'E2'));
  assert.ok(rt(f, 'R1', 'show running-config').includes(' default-information originate always'));
});

test('DR-választás: egyszerre indulva a nagyobb router ID nyer; a prioritás nem preemptív, a clear után igen', () => {
  const f = feladatTeszt('ospf-1');
  // Egyszerre indul mindhárom (a 40 mp-es Wait-időzítőn belül)
  for (const [r, i] of [['R1', 1], ['R2', 2], ['R3', 3]]) rt(f, r, 'conf t', 'router ospf 1', `router-id ${i}.${i}.${i}.${i}`, 'network 10.0.0.0 0.255.255.255 area 0', 'end');
  rt(f, 'R3', 'conf t', 'int g0/0/0', 'no ip ospf hello-interval', 'end');
  f.lep(60000);
  assert.equal(szomszed(f, 'R1', '2.2.2.2').I.allapot, 'BDR');
  assert.equal(szomszed(f, 'R2', '1.1.1.1').I.allapot, 'DR');
  assert.equal(szomszed(f, 'R2', '3.3.3.3').I.allapot, 'BDR', 'R2–R3: R3 a DR');
  // R1 prioritása nagyobb lesz – de nem veszi át a helyet
  rt(f, 'R1', 'conf t', 'int g0/0/0', 'ip ospf priority 200', 'end');
  f.lep(30000);
  assert.equal(szomszed(f, 'R1', '2.2.2.2').I.allapot, 'BDR');
  // A DR (R2) folyamatának újraindítása után R1 lesz a DR
  rt(f, 'R2', 'clear ip ospf process', 'yes');
  f.lep(60000);
  assert.equal(szomszed(f, 'R1', '2.2.2.2').I.allapot, 'DR');
  assert.equal(szomszed(f, 'R1', '2.2.2.2').allapot, 'FULL');
  // 0-s prioritás: soha nem DR/BDR
  const ki = rt(f, 'R3', 'conf t', 'int g0/0/0', 'ip ospf priority 0', 'end', 'clear ip ospf process', 'yes');
  assert.deepEqual(ki, []);
  f.lep(60000);
  assert.equal(szomszed(f, 'R3', '1.1.1.1').I.allapot, 'DROTHER');
});

test('router-id: szomszéd nélkül azonnal, szomszéddal csak clear ip ospf process után érvényes', () => {
  const f = feladatTeszt('ospf-1');
  rt(f, 'R1', 'conf t', 'router ospf 1', 'network 10.0.12.0 0.0.0.3 area 0');
  assert.equal(ospfAllapot(f.eszkoz('R1'), 4).rid, '203.0.113.2', 'automatikus: a legnagyobb aktív IPv4-cím');
  assert.deepEqual(rt(f, 'R1', 'router-id 1.1.1.1'), []);
  assert.equal(ospfAllapot(f.eszkoz('R1'), 4).rid, '1.1.1.1');
  rt(f, 'R2', 'conf t', 'router ospf 1', 'router-id 2.2.2.2', 'network 10.0.12.0 0.0.0.3 area 0', 'end');
  f.lep(60000);
  assert.deepEqual(rt(f, 'R1', 'router-id 11.11.11.11'), ['% OSPF: Reload or use "clear ip ospf process" command, for this to take effect']);
  assert.equal(ospfAllapot(f.eszkoz('R1'), 4).rid, '1.1.1.1');
  rt(f, 'R1', 'end', 'clear ip ospf process', 'no');
  assert.equal(ospfAllapot(f.eszkoz('R1'), 4).rid, '1.1.1.1', 'nemleges válaszra nem indul újra');
  rt(f, 'R1', 'clear ip ospf process', 'yes');
  assert.equal(ospfAllapot(f.eszkoz('R1'), 4).rid, '11.11.11.11');
  f.lep(60000);
  assert.equal(szomszed(f, 'R2', '11.11.11.11').allapot, 'FULL');
});

test('az interfész-módszer (ip ospf 1 area 0) ugyanaz, és létrehozza a folyamatot; a wildcard a hálózatra igazodik', () => {
  const f = feladatTeszt('ospf-1');
  rt(f, 'R1', 'conf t', 'int g0/0/0', 'ip ospf 1 area 0', 'end');
  rt(f, 'R2', 'conf t', 'router ospf 1', 'network 10.0.12.1 0.0.0.3 area 0', 'end');
  f.lep(60000);
  assert.equal(szomszed(f, 'R1', ospfAllapot(f.eszkoz('R2'), 4).rid).allapot, 'FULL');
  const cfg = rt(f, 'R1', 'show running-config');
  assert.ok(cfg.includes('router ospf 1'));
  assert.ok(cfg.includes(' ip ospf 1 area 0'));
  assert.ok(rt(f, 'R2', 'show running-config').includes(' network 10.0.12.0 0.0.0.3 area 0'));
  const pr = rt(f, 'R1', 'show ip protocols');
  assert.ok(pr.includes('  Routing on Interfaces Configured Explicitly (Area 0):'));
  assert.ok(rt(f, 'R1', 'show ip ospf interface g0/0/0')[1].endsWith('Attached via Interface Enable'));
});

test('eltérő hálózattípus a két végen: a szomszédság FULL, de a link nem használható; MD5-eltérésnél a szomszédság leesik', () => {
  const f = feladatTeszt('ospf-1');
  const naplo = naplozo(f);
  alap1(f);
  rt(f, 'R3', 'conf t', 'int g0/0/0', 'no ip ospf hello-interval', 'end');
  rt(f, 'R2', 'conf t', 'int g0/0/1', 'ip ospf network point-to-point', 'end');
  f.lep(60000);
  assert.equal(szomszed(f, 'R2', '3.3.3.3').allapot, 'FULL');
  const ut = ospfUtvonalak(f.eszkoz('R2'), 4).find((e) => e.hossz === 24 && e.utak.length && e.metrika && e.halozat === (192 * 2 ** 24 + 168 * 2 ** 16 + 3 * 256));
  assert.equal(ut.utak[0].port, 'GigabitEthernet0/0/0', 'a LAN3 felé R1-en át megy');
  rt(f, 'R3', 'conf t', 'int g0/0/1', 'ip ospf network point-to-point', 'end');
  f.lep(30000);
  assert.equal(ospfUtvonalak(f.eszkoz('R2'), 4).find((e) => e.halozat === ut.halozat && e.hossz === 24).utak[0].port, 'GigabitEthernet0/0/1');
  // MD5 csak az egyik oldalon
  rt(f, 'R1', 'debug ip ospf adj', 'conf t', 'int g0/0/0', 'ip ospf authentication message-digest', 'ip ospf message-digest-key 1 md5 Titok123', 'end');
  f.lep(50000);
  assert.equal(szomszed(f, 'R1', '2.2.2.2'), null);
  assert.ok(naplo.some((s) => s.includes('Nbr 2.2.2.2 on GigabitEthernet0/0/0 from FULL to DOWN, Neighbor Down: Dead timer expired')));
  assert.ok(naplo.some((s) => s.includes('Mismatched Authentication type. Input packet specified type 0, we use type 2')));
  // Rossz jelszó a másik oldalon
  rt(f, 'R2', 'conf t', 'int g0/0/0', 'ip ospf authentication message-digest', 'ip ospf message-digest-key 1 md5 Masik', 'end');
  f.lep(30000);
  assert.equal(szomszed(f, 'R1', '2.2.2.2'), null);
  assert.ok(naplo.some((s) => s.includes('Mismatched Authentication Key - Message Digest Key 1')));
  assert.deepEqual(rt(f, 'R2', 'conf t', 'int g0/0/0', 'ip ospf message-digest-key 1 md5 Titok123'), ['OSPF: Key 1 already exists']);
  rt(f, 'R2', 'no ip ospf message-digest-key 1', 'ip ospf message-digest-key 1 md5 Titok123', 'end');
  f.lep(30000);
  assert.equal(szomszed(f, 'R1', '2.2.2.2').allapot, 'FULL');
});

test('ospf-1: a PC-k közti forgalom a legolcsóbb úton megy (tracert)', () => {
  const f = feladatTeszt('ospf-1');
  megold1(f);
  const mm = new PcMunkamenet({ eszkoz: f.eszkoz('PC1'), halozat: f.halozat });
  const ki = [];
  for (const e of mm.bevitel('tracert 192.168.3.10').kimenet) {
    if (typeof e === 'string') ki.push(e);
    else if (e.folyamat) e.folyamat((s) => ki.push(s), () => {});
  }
  f.lep(120000);
  const ugrasok = ki.filter((s) => /^ +\d+ /.test(s));
  assert.match(ugrasok[1], /10\.0\.12\.2/, 'R2-n át (a drága közvetlen link helyett)');
  assert.match(ugrasok[2], /10\.0\.23\.2/);
});

// ---------------------------------------------------------------------------
// OSPFv3
// ---------------------------------------------------------------------------

function alap2(f) {
  for (const [r, i] of [['R1', 1], ['R2', 2], ['R3', 3]]) {
    rt(f, r, 'conf t', 'ipv6 unicast-routing', 'ipv6 router ospf 1', `router-id ${i}.${i}.${i}.${i}`, 'int range g0/0/0 - 2', 'ipv6 ospf 1 area 0', 'end');
    f.lep(60000);
  }
}

function megold2(f) {
  alap2(f);
  rt(f, 'R3', 'conf t', 'int g0/0/1', 'no ipv6 mtu', 'end');
  for (const r of ['R1', 'R2', 'R3']) rt(f, r, 'conf t', 'ipv6 router ospf 1', 'passive-interface g0/0/2', 'auto-cost reference-bandwidth 10000', 'end');
  rt(f, 'R1', 'conf t', 'ipv6 route ::/0 2001:db8:feed:1::1', 'ipv6 router ospf 1', 'default-information originate', 'int g0/0/1',
    'ipv6 ospf network point-to-point', 'int g0/0/0', 'ipv6 ospf cost 50', 'end');
  rt(f, 'R3', 'conf t', 'int g0/0/0', 'ipv6 ospf network point-to-point', 'int g0/0/1', 'ipv6 ospf priority 100', 'end');
  f.lep(60000);
  rt(f, 'R2', 'clear ipv6 ospf process', 'yes');
  f.lep(60000);
}

test('ospf-2: a teljes megoldás után az ellenőrzés hibátlan (alapadatok és véletlen változat)', () => {
  for (const mag of [null, 9]) {
    const f = feladatTeszt('ospf-2', mag);
    megold2(f);
    assert.deepEqual(hibak(f), []);
  }
});

test('OSPFv3: IPv6 routing nélkül nem indul; IPv4-cím nélkül NORTRID, kézi router ID-vel indul', () => {
  const f = feladatTeszt('ospf-2');
  const naplo = naplozo(f);
  assert.deepEqual(rt(f, 'R1', 'conf t', 'ipv6 router ospf 1'), ['% IPv6 routing not enabled']);
  assert.deepEqual(rt(f, 'R1', 'int g0/0/0', 'ipv6 ospf 1 area 0'), ['% IPv6 routing not enabled']);
  rt(f, 'R1', 'exit', 'ipv6 unicast-routing', 'ipv6 router ospf 1');
  assert.equal(f.mm('R1').prompt(), 'R1(config-rtr)#');
  assert.ok(naplo.some((s) => s.includes('%OSPFv3-4-NORTRID: OSPFv3 process 1 could not pick a router-id, please configure manually')));
  assert.equal(ospfAllapot(f.eszkoz('R1'), 6).fut, false);
  rt(f, 'R1', 'router-id 1.1.1.1');
  assert.equal(ospfAllapot(f.eszkoz('R1'), 6).rid, '1.1.1.1');
});

test('OSPFv3: MTU-eltérésnél a szomszédság beragad (EXSTART / EXCHANGE), a debug megmutatja', () => {
  const f = feladatTeszt('ospf-2');
  const naplo = naplozo(f);
  alap2(f);
  rt(f, 'R3', 'debug ipv6 ospf adj');
  f.lep(20000);
  // A kisebb MTU-jú R3 eldobja R2 adatbázis-leíró csomagjait (EXSTART-ban marad), R2 viszont továbblép (EXCHANGE).
  assert.equal(szomszed(f, 'R2', '1.1.1.1', 6).allapot, 'FULL');
  assert.equal(szomszed(f, 'R2', '3.3.3.3', 6).allapot, 'EXCHANGE');
  assert.equal(szomszed(f, 'R3', '2.2.2.2', 6).allapot, 'EXSTART');
  assert.ok(naplo.some((s) => s.includes('OSPFv3-1-IPv6 ADJ   Gi0/0/1: Nbr 2.2.2.2 has larger interface MTU')));
  const nbr = rt(f, 'R2', 'show ipv6 ospf neighbor');
  assert.equal(nbr[1], '          OSPFv3 Router with ID (2.2.2.2) (Process ID 1)');
  assert.equal(nbr[3], 'Neighbor ID     Pri   State           Dead Time   Interface ID    Interface');
  assert.match(nbr[4], /^3\.3\.3\.3 {11}1 {3}EXCHANGE\/BDR {4}00:00:\d\d {4}2 {15}GigabitEthernet0\/0\/1$/);
  assert.ok(rt(f, 'R3', 'show running-config').includes(' ipv6 mtu 1400'));
  rt(f, 'R3', 'conf t', 'int g0/0/1', 'no ipv6 mtu', 'end');
  f.lep(30000);
  assert.equal(szomszed(f, 'R2', '3.3.3.3', 6).allapot, 'FULL');
});

test('OSPFv3: routing tábla link-local következő ugrással, OE2 ::/0, adatbázis és protokollok', () => {
  const f = feladatTeszt('ospf-2');
  megold2(f);
  const ut = rt(f, 'R2', 'show ipv6 route');
  const i = ut.findIndex((s) => s.startsWith('OE2 ::/0 [110/1], tag 1'));
  assert.ok(i > 0);
  assert.equal(ut[i + 1], '     via FE80::1, GigabitEthernet0/0/0');
  const r1 = rt(f, 'R1', 'show ipv6 route ospf');
  const j = r1.indexOf('O   2001:DB8:ACAD:2::/64 [110/30]');
  assert.ok(j > 0);
  assert.equal(r1[j + 1], '     via FE80::3, GigabitEthernet0/0/1');
  const db = rt(f, 'R2', 'show ipv6 ospf database');
  for (const fej of ['Router Link States (Area 0)', 'Net Link States (Area 0)', 'Link (Type-8) Link States (Area 0)',
    'Intra Area Prefix Link States (Area 0)', 'Type-5 AS External Link States']) {
    assert.ok(db.some((s) => s.trim() === fej), fej);
  }
  const pr = rt(f, 'R1', 'show ipv6 protocols');
  assert.ok(pr.includes('IPv6 Routing Protocol is "ospf 1"'));
  assert.ok(pr.includes('  Router ID 1.1.1.1'));
  assert.ok(pr.includes('  Interfaces (Area 0):'));
  const brief = rt(f, 'R1', 'show ipv6 ospf interface brief');
  assert.equal(brief[0], 'Interface    PID   Area            Intf ID    Cost  State Nbrs F/C');
  assert.ok(brief.includes('Gi0/0/1      1     0               2          10    P2P   1/1'));
  const cfg = rt(f, 'R1', 'show running-config');
  for (const sor of ['ipv6 router ospf 1', ' router-id 1.1.1.1', ' auto-cost reference-bandwidth 10000', ' passive-interface GigabitEthernet0/0/2',
    ' default-information originate', ' ipv6 ospf 1 area 0', ' ipv6 ospf network point-to-point', ' ipv6 ospf cost 50', ' description R2 fele']) {
    assert.ok(cfg.includes(sor), sor);
  }
});

test('súgó és rövidítés az OSPF-parancsoknál', () => {
  const f = feladatTeszt('ospf-1');
  const mm = f.mm('R1');
  rt(f, 'R1', 'conf t');
  assert.ok(mm.sugo('router ').kimenet.some((s) => /^ {2}ospf /.test(s)));
  rt(f, 'R1', 'router ospf 1');
  assert.equal(mm.prompt(), 'R1(config-router)#');
  const net = mm.sugo('network 10.0.12.0 0.0.0.3 area ').kimenet;
  assert.ok(net.some((s) => s.includes('<0-4294967295>')));
  assert.ok(net.some((s) => s.includes('A.B.C.D')));
  assert.deepEqual(rt(f, 'R1', 'network 10.0.12.0 0.0.0.3 area 0.0.0.0'), []);
  assert.ok(rt(f, 'R1', 'do show ip protocols').includes('    10.0.12.0 0.0.0.3 area 0'));
  assert.ok(mm.sugo('').kimenet.some((s) => /^ {2}passive-interface /.test(s)));
  assert.ok(rt(f, 'R1', 'area 0 authentication')[0].includes('a szimulátorban még nincs meg'));
  rt(f, 'R1', 'int g0/0/0', 'desc R2 fele - gigabites link', 'end');
  assert.ok(rt(f, 'R1', 'show running-config').includes(' description R2 fele - gigabites link'));
  assert.deepEqual(rt(f, 'R1', 'write memory'), ['Building configuration...', '[OK]']);
});

test('ping source: a LAN-címről indul (a visszautat is próbálja)', () => {
  const f = feladatTeszt('ospf-1');
  megold1(f);
  const ki = rt(f, 'R2', 'ping 192.168.3.1 source g0/0/2');
  assert.ok(ki.includes('Packet sent with a source address of 192.168.2.1'));
  // Az első csomag elveszhet, amíg R2 ARP-pal megkeresi R3-at (.!!!!) – a valódi routeren is így van.
  assert.ok(ki.some((s) => /^Success rate is (80|100) percent/.test(s)));
});
