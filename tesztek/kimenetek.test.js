/**
 * A show-parancsok kimenetének formája.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { privbol, konfigbol, fut } from './segito.js';
import { portSorok } from '../src/gyartok/ios/kimenetek/vlan-brief.js';

test('show vlan brief: fejléc, elválasztó, oszlopszélességek', () => {
  const k = privbol('show vlan brief').kimenet;
  assert.equal(k[0], '');
  assert.equal(k[1], 'VLAN Name                             Status    Ports');
  assert.equal(k[2], '---- -------------------------------- --------- -------------------------------');
  assert.equal(k[3], '1    default                          active    Fa0/1, Fa0/2, Fa0/3, Fa0/4');
  assert.equal(k[4], ' '.repeat(48) + 'Fa0/5, Fa0/6, Fa0/7, Fa0/8');
  assert.equal(k[9], ' '.repeat(48) + 'Gi0/1, Gi0/2');
  assert.equal(k[10], '1002 fddi-default                     act/unsup');
  assert.equal(k[k.length - 1], '1005 trnet-default                    act/unsup');
});

test('show vlan brief: új VLAN alapnévvel és saját névvel, port nélkül', () => {
  const { mm } = konfigbol('vlan 20', 'exit', 'vlan 10', 'name IRODA', 'end');
  const k = fut(mm, 'show vlan brief');
  const i10 = k.findIndex((s) => s.startsWith('10 '));
  const i20 = k.findIndex((s) => s.startsWith('20 '));
  assert.equal(k[i10], '10   IRODA                            active');
  assert.equal(k[i20], '20   VLAN0020                         active');
  assert.ok(i10 < i20, 'számsorrendben');
});

test('portok tördelése: egy sorba legfeljebb 31 karakter', () => {
  const sorok = portSorok(['Fa0/9', 'Fa0/10', 'Fa0/11', 'Fa0/12', 'Fa0/13']);
  assert.deepEqual(sorok, ['Fa0/9, Fa0/10, Fa0/11, Fa0/12', 'Fa0/13']);
  for (const s of portSorok(Array.from({ length: 24 }, (_, i) => `Fa0/${i + 1}`))) assert.ok(s.length <= 31);
});

test('show running-config: fejléc, gépnév, interfészek, end', () => {
  const { mm } = konfigbol('hostname SW1', 'int fa0/5', 'shutdown', 'end');
  const k = fut(mm, 'show running-config');
  assert.equal(k[0], 'Building configuration...');
  assert.equal(k[1], '');
  assert.match(k[2], /^Current configuration : \d+ bytes$/);
  assert.equal(k[3], '!');
  assert.ok(k.includes('version 15.0'));
  assert.ok(k.includes('hostname SW1'));
  const i = k.indexOf('interface FastEthernet0/5');
  assert.equal(k[i + 1], ' shutdown');
  assert.equal(k[i + 2], '!');
  assert.equal(k[k.indexOf('interface FastEthernet0/4') + 1], '!');
  assert.ok(k.includes('interface GigabitEthernet0/2'));
  assert.ok(k.includes('interface Vlan1'));
  assert.equal(k[k.length - 2], 'end');
});

test('show running-config: a bájtszám a konfiguráció hossza', () => {
  const k = privbol('show running-config').kimenet;
  const bajt = Number(/(\d+) bytes/.exec(k[2])[1]);
  const torzs = k.slice(3, k.length - 1);
  assert.equal(bajt, torzs.join('\n').length + 1);
});

test('VTP server módban a VLAN-ok NINCSENEK a running-configban (mint a valódi eszközön)', () => {
  const { mm } = konfigbol('vlan 10', 'name IRODA', 'end');
  const k = fut(mm, 'show running-config');
  assert.ok(!k.some((s) => s.startsWith('vlan 10')));
  assert.ok(!k.some((s) => s.includes('IRODA')));
});

test('transparent módban a VLAN-ok a running-configban is ott vannak', () => {
  const { mm } = konfigbol('vlan 10', 'name IRODA', 'exit', 'vlan 20', 'end');
  mm.eszkoz.vtpMod = 'transparent';
  const k = fut(mm, 'show running-config');
  const i = k.indexOf('vlan 10');
  assert.ok(i > 0);
  assert.equal(k[i + 1], ' name IRODA');
  assert.equal(k[k.indexOf('vlan 20') + 1], '!', 'alapnévnél nincs name sor');
  assert.ok(k.includes('vtp mode transparent'));
});

test('a running-config teljes parancsalakkal készül, akárhogy gépelték', () => {
  const a = konfigbol('hostn X', 'int fa0/1', 'sh', 'end').mm;
  const b = konfigbol('hostname X', 'interface FastEthernet0/1', 'shutdown', 'end').mm;
  assert.deepEqual(fut(a, 'sh run'), fut(b, 'show running-config'));
});

test('lapozható kimenet jelölése', () => {
  const { mm } = privbol();
  assert.equal(mm.bevitel('show running-config').lapozhato, true);
  assert.equal(mm.bevitel('disable').lapozhato, false);
});
