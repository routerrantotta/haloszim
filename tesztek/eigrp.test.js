/**
 * EIGRP (IPv4 és IPv6): az eigrp-1 feladat hálózatán.
 *
 * A metrika számát, a successor / feasible successor döntést és a DUAL Active állapotot
 * a feladatlapon szereplő valódi (Packet Tracerben mért) értékekkel vetjük össze.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { feladatTeszt } from './segito.js';
import { PcMunkamenet } from '../src/cli/pc-munkamenet.js';
import { metrika, eigrpBejegyzes, eigrpSzomszedok, eigrpAllapot } from '../src/mag/eigrp.js';
import { bejegyzes } from '../src/mag/utvonal.js';

/** Router-parancs(ok); a fokozatos kimenetet (ping) is összegyűjti. */
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
        f.lep(20000);
        if (sor) ki.push(sor);
      }
    }
  }
  return ki;
}

/** PC-parancs. */
function pc(f, nev, sor, ido = 40000) {
  const mm = new PcMunkamenet({ eszkoz: f.eszkoz(nev), halozat: f.halozat });
  const ki = [];
  for (const e of mm.bevitel(sor).kimenet) {
    if (typeof e === 'string') ki.push(e);
    else if (e.folyamat) e.folyamat((s) => ki.push(s), () => {});
  }
  f.lep(ido);
  return ki;
}

/** Az EIGRP elindítása IPv4-en mindhárom routeren (még auto-summaryval). */
function eigrpAlap(f) {
  const { AS, L1, L2, L3 } = f.e;
  rt(f, 'R1', 'conf t', `router eigrp ${AS}`, 'eigrp router-id 1.1.1.1', `network 172.16.${L1}.0 0.0.0.255`,
    'network 10.0.12.0 0.0.0.3', 'network 10.0.13.0 0.0.0.3', 'network 1.1.1.1 0.0.0.0', 'end');
  rt(f, 'R2', 'conf t', `router eigrp ${AS}`, 'eigrp router-id 2.2.2.2', `network 192.168.${L2}.0 0.0.0.255`,
    'network 10.0.12.0 0.0.0.3', 'network 10.0.23.0 0.0.0.3', 'network 2.2.2.2 0.0.0.0', 'end');
  rt(f, 'R3', 'conf t', `router eigrp ${AS}`, 'eigrp router-id 3.3.3.3', `network 172.16.${L3}.0 0.0.0.255`,
    'network 10.0.23.0 0.0.0.3', 'network 10.0.13.0 0.0.0.3', 'network 3.3.3.3 0.0.0.0', 'end');
  f.lep(30000);
}

/** A teljes IPv4-es megoldás (összevonás nélkül, passzív LAN-okkal). */
function megold4(f) {
  eigrpAlap(f);
  for (const r of ['R1', 'R2', 'R3']) rt(f, r, 'conf t', `router eigrp ${f.e.AS}`, 'no auto-summary', 'passive-interface g0/0/0', 'end');
  f.lep(30000);
}

/** Az IPv6-os EIGRP mindhárom routeren. */
function megold6(f) {
  const AS = f.e.AS;
  for (const [r, rid] of [['R1', '1.1.1.1'], ['R2', '2.2.2.2'], ['R3', '3.3.3.3']]) {
    rt(f, r, 'conf t', 'ipv6 unicast-routing', `ipv6 router eigrp ${AS}`, `eigrp router-id ${rid}`, 'no shutdown',
      'interface range g0/0/0, s0/1/0 - 1', `ipv6 eigrp ${AS}`, 'interface lo0', `ipv6 eigrp ${AS}`, 'end');
  }
  f.lep(40000);
}

test('a metrika a K1 = K3 = 1 képlet szerint számol (a feladatlap értékei)', () => {
  // Gigabites LAN: 256 × (10^7/1 000 000 + 10/10)
  assert.equal(metrika(1000000, 10), 2816);
  // Loopback: 256 × (10^7/8 000 000 + 5000/10)
  assert.equal(metrika(8000000, 5000), 128256);
  // Egy soros vonal (1544) + egy gigabites LAN
  assert.equal(metrika(1544, 20010), 2170112);
  // Két soros vonal + egy gigabites LAN
  assert.equal(metrika(1544, 40010), 2682112);
});

test('szomszédság épül fel mindhárom routeren (két-két szomszéd)', () => {
  const f = feladatTeszt('eigrp-1');
  eigrpAlap(f);
  for (const r of ['R1', 'R2', 'R3']) {
    assert.equal(eigrpSzomszedok(f.eszkoz(r), 4).length, 2, `${r}: két szomszéd`);
  }
  const ki = rt(f, 'R1', 'show ip eigrp neighbors');
  assert.match(ki[0], new RegExp(`EIGRP-IPv4 Neighbors for AS\\(${f.e.AS}\\)`));
  assert.ok(ki.some((s) => s.includes('10.0.12.2') && s.includes('Se0/1/0')), ki.join('\n'));
  assert.ok(ki.some((s) => s.includes('10.0.13.2') && s.includes('Se0/1/1')), ki.join('\n'));
});

test('eltérő AS-szám: nincs szomszédság', () => {
  const f = feladatTeszt('eigrp-1');
  const AS = f.e.AS;
  rt(f, 'R1', 'conf t', `router eigrp ${AS}`, 'network 10.0.12.0 0.0.0.3', 'end');
  rt(f, 'R2', 'conf t', `router eigrp ${AS === 1 ? 2 : AS - 1}`, 'network 10.0.12.0 0.0.0.3', 'end');
  f.lep(40000);
  assert.equal(eigrpSzomszedok(f.eszkoz('R1'), 4).length, 0);
  assert.equal(eigrpSzomszedok(f.eszkoz('R2'), 4).length, 0);
});

test('auto-summary: a 172.16.0.0/16 a Null0-ra kerül, és a két LAN nem éri el egymást', () => {
  const f = feladatTeszt('eigrp-1');
  eigrpAlap(f);
  const sorok = rt(f, 'R1', 'show ip route');
  assert.ok(sorok.some((s) => s.includes('172.16.0.0/16 is a summary') && s.includes('Null0')), sorok.join('\n'));
  const p = pc(f, 'PC1', `ping 172.16.${f.e.L3}.10`);
  assert.ok(p.some((s) => s.includes('unreachable')), p.join('\n'));
  // Kikapcsolás után a konkrét alhálózat jelenik meg, és a ping átmegy.
  for (const r of ['R1', 'R2', 'R3']) rt(f, r, 'conf t', `router eigrp ${f.e.AS}`, 'no auto-summary', 'end');
  f.lep(30000);
  assert.equal(bejegyzes(f.eszkoz('R1'), '172.16.0.0/16'), null);
  const e = bejegyzes(f.eszkoz('R1'), `172.16.${f.e.L3}.0/24`);
  assert.equal(e.kod, 'D');
  const p2 = pc(f, 'PC1', `ping 172.16.${f.e.L3}.10`);
  assert.ok(p2.some((s) => s.includes('Reply from')), p2.join('\n'));
  // A show ip protocols kimenetében is látszik
  assert.ok(rt(f, 'R1', 'show ip protocols').some((s) => s.includes('Automatic Summarization: disabled')));
});

test('nem a hopszám dönt, hanem a sávszélesség: a 2 ugrásos, gyors út nyer', () => {
  const f = feladatTeszt('eigrp-1');
  megold4(f);
  const e = bejegyzes(f.eszkoz('R1'), `172.16.${f.e.L3}.0/24`);
  assert.equal(e.kod, 'D');
  assert.equal(e.metrika, 2682112);
  assert.deepEqual(e.utak.map((u) => u.port), ['Serial0/1/0']);
});

test('feasible successor: ahol AD < FD van, ott igen; ahol AD = FD, ott nem', () => {
  const f = feladatTeszt('eigrp-1');
  megold4(f);
  const R3 = f.eszkoz('R3');
  const lan1 = eigrpBejegyzes(R3, 4, `172.16.${f.e.L1}.0/24`);
  assert.equal(lan1.fd, 2682112);
  assert.ok(lan1.forrasok.some((x) => x.fs && x.ad === 2816), 'a LAN1-hez van feasible successor (AD 2816)');
  const lan2 = eigrpBejegyzes(R3, 4, `192.168.${f.e.L2}.0/24`);
  assert.equal(lan2.fd, 2170112);
  assert.equal(lan2.forrasok.filter((x) => x.fs).length, 0, 'a LAN2-hez nincs feasible successor');
  // Az alternatív út hirdetett távolsága pontosan az FD (ezért bukik meg a feltétel)
  assert.ok(lan2.forrasok.some((x) => !x.successor && x.ad === 2170112), JSON.stringify(lan2.forrasok));
  // A loopbackek: 1.1.1.1-hez van, 2.2.2.2-höz nincs
  assert.ok(eigrpBejegyzes(R3, 4, '1.1.1.1/32').forrasok.some((x) => x.fs));
  assert.equal(eigrpBejegyzes(R3, 4, '2.2.2.2/32').forrasok.filter((x) => x.fs).length, 0);
});

test('DUAL: feasible successorral az útvonal nem tűnik el, nélküle Active állapotba megy', () => {
  const f = feladatTeszt('eigrp-1');
  megold4(f);
  const R3 = f.eszkoz('R3');
  const L1 = `172.16.${f.e.L1}.0/24`;
  const L2 = `192.168.${f.e.L2}.0/24`;
  const ido1 = eigrpBejegyzes(R3, 4, L1).ido;
  const ido2 = eigrpBejegyzes(R3, 4, L2).ido;
  rt(f, 'R3', 'conf t', 'interface s0/1/0', 'shutdown', 'end');
  f.lep(30000);
  const uj1 = eigrpBejegyzes(R3, 4, L1);
  const uj2 = eigrpBejegyzes(R3, 4, L2);
  assert.equal(uj1.ido, ido1, 'a feasible successorral az útvonal uptime-ja nem indul újra');
  assert.ok(uj2.ido > ido2, 'feasible successor nélkül az útvonal újraépült (nulláról induló uptime)');
  // Mindkettő a lassú vonalon megy tovább
  assert.deepEqual(bejegyzes(R3, L1).utak.map((u) => u.port), ['Serial0/1/1']);
  assert.deepEqual(bejegyzes(R3, L2).utak.map((u) => u.port), ['Serial0/1/1']);
  // Visszakapcsolás után újra a gyors vonal
  rt(f, 'R3', 'conf t', 'interface s0/1/0', 'no shutdown', 'end');
  f.lep(40000);
  assert.deepEqual(bejegyzes(R3, L2).utak.map((u) => u.port), ['Serial0/1/0']);
});

test('passzív interfész: nincs rajta szomszéd, de a hálózata hirdetve van', () => {
  const f = feladatTeszt('eigrp-1');
  megold4(f);
  const a = eigrpAllapot(f.eszkoz('R1'), 4);
  const lan = a.ifek.find((I) => I.port === 'GigabitEthernet0/0/0');
  assert.ok(lan.passziv);
  assert.equal(lan.szomszedok.length, 0);
  // A LAN-t a többiek ismerik
  assert.equal(bejegyzes(f.eszkoz('R2'), `172.16.${f.e.L1}.0/24`).kod, 'D');
  // A show ip eigrp interfaces nem sorolja fel a passzív interfészt
  const ki = rt(f, 'R1', 'show ip eigrp interfaces');
  assert.ok(!ki.some((s) => s.startsWith('Gi0/0/0')), ki.join('\n'));
  assert.ok(ki.some((s) => s.startsWith('Se0/1/0')), ki.join('\n'));
  // ... a show ip protocols viszont kiírja passzívként
  assert.ok(rt(f, 'R1', 'show ip protocols').some((s) => s.trim() === 'GigabitEthernet0/0/0'));
});

test('EIGRP for IPv6: a folyamat leállítva indul, és a szomszédokat link-local címmel azonosítja', () => {
  const f = feladatTeszt('eigrp-1');
  megold4(f);
  const AS = f.e.AS;
  // Leállított folyamat: még nincs szomszédság
  rt(f, 'R1', 'conf t', 'ipv6 unicast-routing', `ipv6 router eigrp ${AS}`, 'eigrp router-id 1.1.1.1', 'end');
  rt(f, 'R2', 'conf t', 'ipv6 unicast-routing', `ipv6 router eigrp ${AS}`, 'eigrp router-id 2.2.2.2', 'end');
  rt(f, 'R1', 'conf t', 'interface range g0/0/0, s0/1/0 - 1', `ipv6 eigrp ${AS}`, 'end');
  rt(f, 'R2', 'conf t', 'interface range g0/0/0, s0/1/0 - 1', `ipv6 eigrp ${AS}`, 'end');
  f.lep(30000);
  assert.equal(eigrpAllapot(f.eszkoz('R1'), 6).fut, false, 'shutdown állapotban nem fut');
  assert.equal(eigrpSzomszedok(f.eszkoz('R1'), 6).length, 0);
  // no shutdown után felépül
  for (const r of ['R1', 'R2']) rt(f, r, 'conf t', `ipv6 router eigrp ${AS}`, 'no shutdown', 'end');
  f.lep(30000);
  const szomszedok = eigrpSzomszedok(f.eszkoz('R1'), 6);
  assert.ok(szomszedok.some((n) => n.cim === 'FE80::2'), JSON.stringify(szomszedok.map((n) => n.cim)));
  const ki = rt(f, 'R1', 'show ipv6 eigrp neighbors');
  assert.ok(ki.some((s) => s.includes('Link-local address:')), ki.join('\n'));
  assert.ok(ki.some((s) => s.trim() === 'FE80::2'), ki.join('\n'));
  assert.equal(bejegyzes(f.eszkoz('R1'), '2001:DB8:ACAD:2::/64').kod, 'D');
});

test('IPv6: a teljes megoldás után minden LAN eléri a többit', () => {
  const f = feladatTeszt('eigrp-1');
  megold4(f);
  megold6(f);
  assert.equal(bejegyzes(f.eszkoz('R1'), '2001:DB8:ACAD:3::/64').kod, 'D');
  assert.equal(bejegyzes(f.eszkoz('R3'), '2001:DB8:ACAD:1::/64').kod, 'D');
  assert.equal(bejegyzes(f.eszkoz('R2'), '2001:DB8:ACAD:FF::1/128').kod, 'D');
  const p = pc(f, 'PC1', 'ping 2001:DB8:ACAD:3::10');
  assert.ok(p.some((s) => s.includes('Reply from')), p.join('\n'));
});

test('show interfaces: a BW és a DLY érték (ebből számol az EIGRP)', () => {
  const f = feladatTeszt('eigrp-1');
  const gyors = rt(f, 'R1', 'show interfaces s0/1/0');
  assert.ok(gyors.some((s) => s.includes('BW 1544 Kbit/sec, DLY 20000 usec')), gyors.join('\n'));
  const lassu = rt(f, 'R1', 'show interfaces s0/1/1');
  assert.ok(lassu.some((s) => s.includes('BW 64 Kbit/sec, DLY 20000 usec')), lassu.join('\n'));
  const lan = rt(f, 'R1', 'show interfaces g0/0/0');
  assert.ok(lan.some((s) => s.includes('BW 1000000 Kbit/sec, DLY 10 usec')), lan.join('\n'));
});

test('a delay parancs megváltoztatja a metrikát', () => {
  const f = feladatTeszt('eigrp-1');
  megold4(f);
  const elotte = bejegyzes(f.eszkoz('R1'), `192.168.${f.e.L2}.0/24`).metrika;
  // 20 000 µs helyett 100 000 µs a gyors vonalon: a metrika nő
  rt(f, 'R1', 'conf t', 'interface s0/1/0', 'delay 10000', 'end');
  f.lep(20000);
  const utana = bejegyzes(f.eszkoz('R1'), `192.168.${f.e.L2}.0/24`).metrika;
  assert.ok(utana > elotte, `${utana} > ${elotte}`);
  assert.ok(rt(f, 'R1', 'show running-config').some((s) => s.trim() === 'delay 10000'));
});

test('a futó konfigurációban megjelennek az EIGRP-sorok', () => {
  const f = feladatTeszt('eigrp-1');
  megold4(f);
  megold6(f);
  const k = rt(f, 'R1', 'show running-config').map((s) => s.trim());
  assert.ok(k.includes(`router eigrp ${f.e.AS}`));
  assert.ok(k.includes('eigrp router-id 1.1.1.1'));
  assert.ok(k.includes('no auto-summary'));
  assert.ok(k.includes('passive-interface GigabitEthernet0/0/0'));
  assert.ok(k.includes(`network 10.0.12.0 0.0.0.3`));
  assert.ok(k.includes(`ipv6 router eigrp ${f.e.AS}`));
  assert.ok(k.includes(`ipv6 eigrp ${f.e.AS}`));
  // Az IPv6-os folyamat blokkjában nincs „shutdown” sor (a no shutdown megtörtént)
  const i = k.indexOf(`ipv6 router eigrp ${f.e.AS}`);
  assert.notEqual(k[i + 1], 'shutdown', 'az IPv6-folyamat nincs leállítva');
});

test('a topológiatábla kimenete: P állapot, (FD/AD) számpár, Connected sor', () => {
  const f = feladatTeszt('eigrp-1');
  megold4(f);
  const ki = rt(f, 'R3', 'show ip eigrp topology');
  assert.match(ki[0], new RegExp(`EIGRP-IPv4 Topology Table for AS\\(${f.e.AS}\\)/ID\\(3\\.3\\.3\\.3\\)`));
  assert.ok(ki.some((s) => s.startsWith(`P 172.16.${f.e.L1}.0/24, 1 successors, FD is 2682112`)), ki.join('\n'));
  assert.ok(ki.some((s) => s.includes('(2682112/2170112)')), ki.join('\n'));
  assert.ok(ki.some((s) => s.includes('via Connected, GigabitEthernet0/0/0')), ki.join('\n'));
  // A részletes kimenetben két blokk van ott, ahol van feasible successor
  const reszletes = rt(f, 'R3', `show ip eigrp topology 172.16.${f.e.L1}.0 255.255.255.0`);
  assert.equal(reszletes.filter((s) => s.includes('Send flag is')).length, 2);
  const egy = rt(f, 'R3', `show ip eigrp topology 192.168.${f.e.L2}.0 255.255.255.0`);
  assert.equal(egy.filter((s) => s.includes('Send flag is')).length, 1);
  assert.ok(egy.some((s) => s.includes('Minimum bandwidth is 1544 Kbit')), egy.join('\n'));
  assert.ok(egy.some((s) => s.includes('Originating router is 2.2.2.2')), egy.join('\n'));
});
