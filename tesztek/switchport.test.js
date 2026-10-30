/**
 * Switchport-parancsok és az új show-kimenetek.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { konfigbol, fut, vlanFeladat, megold } from './segito.js';
import { portKeres } from '../src/modell/switch.js';
import { egyPing } from '../src/mag/vegpont.js';

test('switchport mode access / trunk – rövidítve és kiírva ugyanaz az állapot', () => {
  const a = konfigbol('interface FastEthernet0/1', 'switchport mode access', 'switchport access vlan 10').mm;
  const b = konfigbol('int f0/1', 'sw mo acc', 'sw acc vl 10').mm;
  for (const mm of [a, b]) {
    const p = portKeres(mm.eszkoz, 'FastEthernet0/1');
    assert.equal(p.mod, 'access');
    assert.equal(p.accessVlan, 10);
  }
  const c = konfigbol('int g0/1', 'sw mo tr').mm;
  assert.equal(portKeres(c.eszkoz, 'GigabitEthernet0/1').mod, 'trunk');
  const d = konfigbol('int g0/1', 'switchport mode dynamic desirable', 'no switchport mode').mm;
  assert.equal(portKeres(d.eszkoz, 'GigabitEthernet0/1').mod, 'dinamikus-auto');
});

test('switchport access vlan nem létező VLAN-nal: a switch létrehozza', () => {
  const { mm, kimenet } = konfigbol('int fa0/3', 'switchport access vlan 30');
  assert.deepEqual(kimenet, ['% Access VLAN does not exist. Creating vlan 30']);
  assert.equal(mm.eszkoz.vlanok[30].nev, 'VLAN0030');
  assert.deepEqual(fut(mm, 'no switchport access vlan'), []);
  assert.equal(portKeres(mm.eszkoz, 'FastEthernet0/3').accessVlan, 1);
});

test('interface range: a switchport minden kiválasztott portra érvényes', () => {
  const { mm } = konfigbol('vlan 10', 'exit', 'int range fa0/1 - 4', 'sw mo acc', 'sw acc vl 10');
  for (let i = 1; i <= 4; i++) assert.equal(portKeres(mm.eszkoz, `FastEthernet0/${i}`).accessVlan, 10);
  assert.equal(portKeres(mm.eszkoz, 'FastEthernet0/5').accessVlan, 1);
});

test('hiányos és hibás switchport-parancsok', () => {
  assert.deepEqual(konfigbol('int fa0/1', 'switchport mode').kimenet, ['% Incomplete command.', '']);
  assert.deepEqual(konfigbol('int fa0/1', 'switchport access vlan 5000').kimenet.slice(1),
    ["% Invalid input detected at '^' marker.", '']);
  const k = konfigbol('int fa0/1', 'switchport trunk native vlan 99').kimenet;
  assert.match(k[0], /^\[Szimulátor\] A\(z\) „switchport trunk” parancs/);
});

test('running-config: switchport-sorok a valódi sorrendben', () => {
  const { mm } = konfigbol('int fa0/1', 'sw acc vl 10', 'sw mo acc', 'int g0/1', 'sw mo tr', 'end');
  const k = fut(mm, 'show running-config');
  const i = k.indexOf('interface FastEthernet0/1');
  assert.deepEqual(k.slice(i, i + 4), ['interface FastEthernet0/1', ' switchport access vlan 10', ' switchport mode access', '!']);
  const j = k.indexOf('interface GigabitEthernet0/1');
  assert.deepEqual(k.slice(j, j + 3), ['interface GigabitEthernet0/1', ' switchport mode trunk', '!']);
});

test('show interfaces trunk: üres, ha nincs trunk; utána a négy szakasz', () => {
  const f = vlanFeladat();
  assert.deepEqual(f.sw('SW1', 'show interfaces trunk'), []);
  megold(f, 'SW1');
  const k = f.sw('SW1', 'show interfaces trunk');
  assert.deepEqual(k, [
    '',
    'Port        Mode             Encapsulation  Status        Native vlan',
    'Gi0/1       on               802.1q         trunking      1',
    '',
    'Port        Vlans allowed on trunk',
    'Gi0/1       1-4094',
    '',
    'Port        Vlans allowed and active in management domain',
    'Gi0/1       1,10,20',
    '',
    'Port        Vlans in spanning tree forwarding state and not pruned',
    'Gi0/1       1,10,20',
  ]);
  // A túloldal (dynamic auto) is trunkol: ott „auto” a mód.
  assert.equal(f.sw('SW2', 'sh int tr')[2], 'Gi0/1       auto             802.1q         trunking      1');
});

test('show vlan brief: a trunk port nem szerepel benne', () => {
  const f = vlanFeladat();
  megold(f, 'SW1');
  const k = f.sw('SW1', 'show vlan brief').join('\n');
  assert.doesNotMatch(k, /Gi0\/1/);
  assert.match(k, /Gi0\/2/);
  assert.match(k, /^10   IRODA\s+active    Fa0\/1$/m);
});

test('show interfaces status: connected / notconnect / disabled, trunk', () => {
  const f = vlanFeladat();
  megold(f, 'SW1');
  f.sw('SW1', 'conf t', 'int fa0/24', 'shutdown', 'end');
  const k = f.sw('SW1', 'show interfaces status');
  assert.equal(k[1], 'Port      Name               Status       Vlan       Duplex  Speed Type');
  assert.equal(k[2], 'Fa0/1                        connected    10         a-full  a-100 10/100BaseTX');
  assert.equal(k[4], 'Fa0/3                        notconnect   1            auto   auto 10/100BaseTX');
  assert.equal(k[25], 'Fa0/24                       disabled     1            auto   auto 10/100BaseTX');
  assert.equal(k[26], 'Gi0/1                        connected    trunk      a-full a-1000 10/100/1000BaseTX');
});

test('show mac address-table: statikus CPU-sorok, majd a megtanult címek', () => {
  const f = vlanFeladat();
  megold(f, 'SW1');
  megold(f, 'SW2');
  f.ipk();
  egyPing(f.halozat, f.eszkoz('PC1'), '192.168.10.13', () => {});
  f.lep();
  const k = f.sw('SW1', 'show mac address-table');
  assert.equal(k[0], '          Mac Address Table');
  assert.equal(k[3], 'Vlan    Mac Address       Type        Ports');
  assert.equal(k[5], ' All    0100.0ccc.cccc    STATIC      CPU');
  const mac = f.eszkoz('PC1').mac;
  const pontos = `${mac.slice(0, 4)}.${mac.slice(4, 8)}.${mac.slice(8)}`;
  assert.ok(k.includes(`  10    ${pontos}    DYNAMIC     Fa0/1`));
  assert.equal(k[k.length - 1], 'Total Mac Addresses for this criterion: 22');
  const d = f.sw('SW1', 'sh mac address-table dynamic');
  assert.equal(d[d.length - 1], 'Total Mac Addresses for this criterion: 2');
});

test('show interfaces (magában) még nincs meg, de a show interfaces trunk igen', () => {
  const f = vlanFeladat();
  assert.match(f.sw('SW1', 'show interfaces')[0], /^\[Szimulátor\]/);
  assert.match(f.sw('SW1', 'show interfaces fa0/1')[0], /^\[Szimulátor\]/);
});
