/**
 * A mag: Ethernet-továbbítás, 802.1Q, MAC-tábla, ARP, ping – a vlan-1 feladat hálózatán.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vlanFeladat, megold } from './segito.js';
import { egyPing, szorasProba } from '../src/mag/vegpont.js';
import { uzemmod, macTabla } from '../src/mag/kapcsolas.js';
import { portKeres } from '../src/modell/switch.js';

function ping(f, honnan, ip) {
  let e = null;
  egyPing(f.halozat, f.eszkoz(honnan), ip, (x) => (e = x));
  f.lep();
  return e.fajta;
}

function szoras(f, honnan) {
  let kik = null;
  szorasProba(f.halozat, f.eszkoz(honnan), (k) => (kik = k.map((e) => e.hostname).sort()));
  f.lep();
  return kik;
}

test('gyári állapot: minden a VLAN 1-ben, a két switch közt nincs trunk (auto–auto), a ping mégis megy', () => {
  const f = vlanFeladat();
  for (const s of f.feladat.cimterv) Object.assign(f.eszkoz(s.eszkoz), { ip: s.ip.replace(/\.(10|20)\./, '.1.'), maszk: s.maszk });
  const sw1 = f.eszkoz('SW1');
  assert.equal(uzemmod(sw1, portKeres(sw1, 'GigabitEthernet0/1')), 'access');
  assert.equal(ping(f, 'PC1', '192.168.1.13'), 'valasz');
  assert.deepEqual(szoras(f, 'PC1'), ['PC2', 'PC3', 'PC4']);
});

test('helyes megoldás: azonos VLAN-ban megy a ping, különbözőben nem; a szórás a VLAN-on belül marad', () => {
  const f = vlanFeladat();
  megold(f, 'SW1');
  megold(f, 'SW2', true);
  f.ipk();
  assert.equal(ping(f, 'PC1', '192.168.10.13'), 'valasz');
  assert.equal(ping(f, 'PC2', '192.168.20.14'), 'valasz');
  assert.equal(ping(f, 'PC1', '192.168.20.12'), 'hiba', 'másik hálózat, nincs átjáró');
  assert.deepEqual(szoras(f, 'PC1'), ['PC3']);
  assert.deepEqual(szoras(f, 'PC4'), ['PC2']);
});

test('trunk csak az egyik oldalon: a „dynamic auto” túloldal trunk lesz (DTP)', () => {
  const f = vlanFeladat();
  megold(f, 'SW1');
  f.sw('SW2', 'conf t', 'vlan 10', 'vlan 20', 'int fa0/1', 'sw acc vl 10', 'int fa0/2', 'sw acc vl 20', 'end');
  const sw2 = f.eszkoz('SW2');
  assert.equal(uzemmod(sw2, portKeres(sw2, 'GigabitEthernet0/1')), 'trunk');
  f.ipk();
  assert.equal(ping(f, 'PC1', '192.168.10.13'), 'valasz');
});

test('trunk nélkül a VLAN 10 nem jut át a másik switchre (ARP-válasz sem jön)', () => {
  const f = vlanFeladat();
  for (const n of ['SW1', 'SW2']) {
    f.sw(n, 'conf t', 'vlan 10', 'vlan 20', 'int fa0/1', 'sw mo acc', 'sw acc vl 10', 'int fa0/2', 'sw mo acc', 'sw acc vl 20', 'end');
  }
  f.ipk();
  assert.equal(ping(f, 'PC1', '192.168.10.13'), 'elerhetetlen');
  assert.deepEqual(szoras(f, 'PC1'), []);
});

test('ha a VLAN hiányzik a túloldali switchről, a trunk eldobja a forgalmát', () => {
  const f = vlanFeladat();
  megold(f, 'SW1');
  // SW2-n csak a portok vannak beállítva, majd a 10-es VLAN-t töröljük.
  f.sw('SW2', 'conf t', 'int fa0/1', 'sw mo acc', 'sw acc vl 10', 'exit', 'no vlan 10', 'end');
  f.ipk();
  const eldobasok = [];
  f.halozat.figyel((e) => e.tipus === 'eldobva' && eldobasok.push(e.ok));
  assert.equal(ping(f, 'PC1', '192.168.10.13'), 'elerhetetlen');
  assert.ok(eldobasok.some((o) => /10-es VLAN nem létezik/.test(o)));
});

test('a trunkon a keretek 802.1Q-címkét kapnak (a natív VLAN 1 kivételével)', () => {
  const f = vlanFeladat();
  megold(f, 'SW1');
  megold(f, 'SW2');
  f.ipk();
  const cimkek = new Set();
  f.halozat.figyel((e) => {
    if (e.tipus === 'keret' && e.honnan.port.nev === 'GigabitEthernet0/1') cimkek.add(e.keret.vlan);
  });
  ping(f, 'PC1', '192.168.10.13');
  assert.deepEqual([...cimkek], [10]);
});

test('MAC-tábla: tanulás VLAN-onként és porttal, 300 s után elöregszik', () => {
  const f = vlanFeladat();
  megold(f, 'SW1');
  megold(f, 'SW2');
  f.ipk();
  ping(f, 'PC1', '192.168.10.13');
  const sw1 = f.eszkoz('SW1');
  const t = macTabla(sw1);
  const pc1 = t.find((b) => b.mac === f.eszkoz('PC1').mac);
  const pc3 = t.find((b) => b.mac === f.eszkoz('PC3').mac);
  assert.deepEqual([pc1.vlan, pc1.port], [10, 'FastEthernet0/1']);
  assert.deepEqual([pc3.vlan, pc3.port], [10, 'GigabitEthernet0/1']);
  f.lep(300000);
  assert.equal(macTabla(sw1).length, 0);
});

test('shutdown a trunk porton: a link leesik, a ping nem megy; no shutdown után újra igen', () => {
  const f = vlanFeladat();
  megold(f, 'SW1');
  megold(f, 'SW2');
  f.ipk();
  const naplo = [];
  f.halozat.figyel((e) => e.tipus === 'naplo' && naplo.push(`${e.eszkoz.hostname} ${e.sor.replace(/^\S+\s+\S+\s+\S+: /, '')}`));
  const k = f.sw('SW1', 'conf t', 'int g0/1', 'shutdown');
  assert.match(k.join('\n'), /%LINK-5-CHANGED: Interface GigabitEthernet0\/1, changed state to administratively down/);
  assert.notEqual(ping(f, 'PC1', '192.168.10.13'), 'valasz');
  assert.ok(naplo.includes('SW2 %LINK-3-UPDOWN: Interface GigabitEthernet0/1, changed state to down'));
  assert.ok(naplo.includes('SW1 %LINEPROTO-5-UPDOWN: Line protocol on Interface GigabitEthernet0/1, changed state to down'));
  f.sw('SW1', 'no shutdown');
  f.lep(3000);
  assert.ok(naplo.includes('SW2 %LINEPROTO-5-UPDOWN: Line protocol on Interface GigabitEthernet0/1, changed state to up'));
  assert.equal(ping(f, 'PC1', '192.168.10.13'), 'valasz');
});

test('rossz maszk a túloldalon: a válasz nem talál vissza', () => {
  const f = vlanFeladat();
  megold(f, 'SW1');
  megold(f, 'SW2');
  f.ipk();
  f.eszkoz('PC3').maszk = '255.255.255.252';
  assert.equal(ping(f, 'PC1', '192.168.10.13'), 'idotullepes');
});
