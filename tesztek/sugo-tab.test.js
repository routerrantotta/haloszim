/**
 * A ? súgó és a Tab-kiegészítés.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ujMunkamenet, fut, privbol, konfigbol } from './segito.js';

test('csak ? a sor elején: fejléc + a mód parancsai', () => {
  const { mm } = privbol();
  const k = mm.sugo('').kimenet;
  assert.equal(k[0], 'Exec commands:');
  assert.ok(k.some((s) => /^ {2}configure +\S/.test(s)));
  assert.ok(k.some((s) => /^ {2}show +\S/.test(s)));
  assert.equal(k[k.length - 1], '');
});

test('a súgó ? után is a módhoz illő fejlécet ír', () => {
  const { mm } = konfigbol('vlan 10');
  assert.equal(mm.sugo('').kimenet[0], 'VLAN configuration commands:');
  fut(mm, 'exit', 'int fa0/1');
  assert.equal(mm.sugo('').kimenet[0], 'Interface configuration commands:');
});

test('„show ?” – a következő szavak magyarázattal, fejléc nélkül', () => {
  const { mm } = privbol();
  const k = mm.sugo('show ').kimenet;
  assert.ok(!k.includes('Exec commands:'));
  assert.ok(k.some((s) => s.trim().startsWith('running-config')));
  assert.ok(k.some((s) => s.trim().startsWith('vlan')));
  assert.ok(!k.includes('  <cr>'));
});

test('<cr> ott jelenik meg, ahol már Entert lehet nyomni', () => {
  const { mm } = privbol();
  assert.ok(mm.sugo('show vlan brief ').kimenet.includes('  <cr>'));
  assert.ok(mm.sugo('show vlan ').kimenet.includes('  <cr>'));
});

test('szó közbeni ? („sh?”): az illő szavak, utána üres sor', () => {
  const { mm } = privbol();
  const k = mm.sugo('sh').kimenet;
  assert.deepEqual(k, ['show', '']);
  const k2 = mm.sugo('s').kimenet;
  assert.ok(k2[0].includes('show') && k2[0].includes('setup') && k2[0].includes('ssh'));
});

test('paraméter a súgóban: <1-4094> és WORD', () => {
  const { mm } = konfigbol();
  assert.ok(mm.sugo('vlan ').kimenet.some((s) => s.trim().startsWith('<1-4094>')));
  assert.ok(mm.sugo('hostname ').kimenet.some((s) => s.trim().startsWith('WORD')));
  assert.deepEqual(mm.sugo('vlan 1').kimenet, ['<1-4094>', '']);
});

test('interfész a súgóban: típusok, szám, perjel', () => {
  const { mm } = konfigbol();
  const k = mm.sugo('interface ').kimenet;
  assert.ok(k.some((s) => s.trim().startsWith('FastEthernet')));
  assert.ok(k.some((s) => s.trim().startsWith('GigabitEthernet')));
  assert.ok(k.some((s) => s.trim().startsWith('range')));
  assert.ok(mm.sugo('interface fa ').kimenet[0].trim().startsWith('<0-0>'));
  assert.deepEqual(mm.sugo('interface fa0').kimenet, ['/', '']);
  assert.deepEqual(mm.sugo('interface fa0/').kimenet, ['<1-24>', '']);
  assert.deepEqual(mm.sugo('interface gi0/').kimenet, ['<1-2>', '']);
});

test('ismeretlen szó a súgóban: % Unrecognized command', () => {
  const { mm } = privbol();
  assert.deepEqual(mm.sugo('xyz').kimenet, ['% Unrecognized command']);
  assert.deepEqual(mm.sugo('xyz ').kimenet, ['% Unrecognized command']);
});

test('do ? a konfigurációs módban az exec parancsokat mutatja', () => {
  const { mm } = konfigbol();
  const k = mm.sugo('do sh').kimenet;
  assert.deepEqual(k, ['show', '']);
});

test('Tab: egyértelmű előtag → teljes szó + szóköz', () => {
  const { mm } = privbol();
  assert.equal(mm.kiegeszit('conf'), 'configure ');
  assert.equal(mm.kiegeszit('sh vl'), 'sh vlan ');
  assert.equal(mm.kiegeszit('show vlan br'), 'show vlan brief ');
});

test('Tab: kétértelmű vagy ismeretlen előtagnál nincs változás', () => {
  const { mm } = privbol();
  assert.equal(mm.kiegeszit('e'), null);
  assert.equal(mm.kiegeszit('xyz'), null);
  assert.equal(mm.kiegeszit('show '), null);
});

test('Tab: interfésztípus kiegészítése', () => {
  const { mm } = konfigbol();
  assert.equal(mm.kiegeszit('int fa'), 'int FastEthernet');
  assert.equal(mm.kiegeszit('int range gi'), 'int range GigabitEthernet');
});

test('Tab almódban a globális parancsokra is működik', () => {
  const { mm } = konfigbol('int fa0/1');
  assert.equal(mm.kiegeszit('hostn'), 'hostname ');
});
