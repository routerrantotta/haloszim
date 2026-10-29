/**
 * Rövidítés: a szavankénti egyértelmű előtag ugyanazt csinálja, mint a teljes parancs,
 * és a kis-/nagybetű a parancsszavakban mindegy (a nevekben viszont megmarad).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ujMunkamenet, fut, privbol, konfigbol } from './segito.js';

test('en = enable, conf t = configure terminal', () => {
  const a = ujMunkamenet();
  fut(a, 'en', 'conf t');
  const b = ujMunkamenet();
  fut(b, 'enable', 'configure terminal');
  assert.equal(a.mod, 'konfig');
  assert.equal(a.prompt(), b.prompt());
  assert.equal(a.prompt(), 'Switch(config)#');
});

test('sh vl br ugyanazt adja, mint a show vlan brief', () => {
  const rovid = privbol('sh vl br').kimenet;
  const teljes = privbol('show vlan brief').kimenet;
  assert.deepEqual(rovid, teljes);
  assert.ok(teljes.some((s) => s.startsWith('VLAN Name')));
});

test('sh run = show running-config', () => {
  assert.deepEqual(privbol('sh run').kimenet, privbol('show running-config').kimenet);
});

test('kis- és nagybetű a parancsban mindegy, a gépnévben megmarad', () => {
  const { mm } = konfigbol('HOSTNAME Kapcsolo-1');
  assert.equal(mm.eszkoz.hostname, 'Kapcsolo-1');
  assert.equal(mm.prompt(), 'Kapcsolo-1(config)#');
  fut(mm, 'hostn sw2');
  assert.equal(mm.eszkoz.hostname, 'sw2');
});

test('vlan + name rövidítve ugyanazt az állapotot állítja be', () => {
  const a = konfigbol('vl 10', 'na IRODA').mm;
  const b = konfigbol('vlan 10', 'name IRODA').mm;
  assert.deepEqual(a.eszkoz.vlanok, b.eszkoz.vlanok);
  assert.equal(a.eszkoz.vlanok[10].nev, 'IRODA');
});

test('int ra fa0/1 - 4 és interface range FastEthernet0/1 - 4 ugyanaz', () => {
  const a = konfigbol('int ra fa0/1 - 4');
  const b = konfigbol('interface range FastEthernet0/1 - 4');
  assert.deepEqual(a.mm.kontextus, b.mm.kontextus);
  assert.equal(a.mm.prompt(), 'Switch(config-if-range)#');
});

test('a felesleges szóközök nem számítanak', () => {
  const { mm } = konfigbol('   hostname    SW1   ');
  assert.equal(mm.eszkoz.hostname, 'SW1');
});

test('pontos egyezés nyer az előtag felett (exit ≠ kétértelmű)', () => {
  const { mm } = konfigbol('exit');
  assert.equal(mm.mod, 'priv');
});
