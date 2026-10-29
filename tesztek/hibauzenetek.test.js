/**
 * A valódi eszközre jellemző hibaüzenetek: formájuk és a ^ jel helye.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ujMunkamenet, fut, privbol, konfigbol } from './segito.js';

const ERVENYTELEN = "% Invalid input detected at '^' marker.";

/** A ^ jel oszlopa (a prompttal együtt számolva). */
function jelOszlop(sorok) {
  const s = sorok.find((x) => x.trimStart() === '^');
  return s ? s.indexOf('^') : -1;
}

test('kétértelmű rövidítés: % Ambiguous command (két szóközzel, idézőjelben)', () => {
  const { kimenet } = konfigbol('s');
  assert.deepEqual(kimenet, ['% Ambiguous command:  "s"']);
  // A priv módban az „e” is kétértelmű (enable, erase, exit).
  assert.deepEqual(privbol('e').kimenet, ['% Ambiguous command:  "e"']);
  // „dis”: disable és disconnect
  assert.deepEqual(privbol('dis').kimenet, ['% Ambiguous command:  "dis"']);
});

test('hiányos parancs: % Incomplete command. és egy üres sor', () => {
  assert.deepEqual(konfigbol('hostname').kimenet, ['% Incomplete command.', '']);
  assert.deepEqual(privbol('show').kimenet, ['% Incomplete command.', '']);
  assert.deepEqual(konfigbol('interface fastEthernet').kimenet, ['% Incomplete command.', '']);
  assert.deepEqual(konfigbol('vlan').kimenet, ['% Incomplete command.', '']);
});

test('érvénytelen szó konfigurációs módban: a ^ a hibás szó elején', () => {
  const { kimenet } = konfigbol('hostname SW1 extra');
  assert.equal(kimenet[1], ERVENYTELEN);
  // „Switch(config)#” = 15 karakter, „hostname SW1 ” = 13 → a ^ a 28. oszlopban
  assert.equal(jelOszlop(kimenet), 15 + 13);
  assert.equal(kimenet[2], '');
});

test('exec parancs konfigurációs módban do nélkül: érvénytelen az első szónál', () => {
  const { kimenet } = konfigbol('show vlan brief');
  assert.equal(kimenet[1], ERVENYTELEN);
  assert.equal(jelOszlop(kimenet), 'Switch(config)#'.length);
});

test('VLAN-szám a tartományon kívül: a ^ a számon', () => {
  const { kimenet } = konfigbol('vlan 5000');
  assert.equal(kimenet[1], ERVENYTELEN);
  assert.equal(jelOszlop(kimenet), 'Switch(config)#vlan '.length);
  assert.equal(konfigbol('vlan 0').kimenet[1], ERVENYTELEN);
});

test('nem létező port: a ^ a hibás számrészen', () => {
  const { kimenet } = konfigbol('interface fa0/25');
  assert.equal(kimenet[1], ERVENYTELEN);
  assert.equal(jelOszlop(kimenet), 'Switch(config)#interface fa0/'.length);
  const k2 = konfigbol('interface fa1/1').kimenet;
  assert.equal(jelOszlop(k2), 'Switch(config)#interface fa'.length);
});

test('exec módban egy ismeretlen szó: névfeloldás (Translating …), várakozással', () => {
  const mm = ujMunkamenet();
  const r = mm.bevitel('asdf');
  assert.equal(r.kimenet[0], 'Translating "asdf"...domain server (255.255.255.255)');
  assert.ok(typeof r.kimenet[1] === 'object' && r.kimenet[1].varj > 0);
  assert.equal(r.kimenet[2], '% Unknown command or computer name, or unable to find computer address');
});

test('exec módban több ismeretlen szó: a ^ a második szón (az első gépnév lenne)', () => {
  const mm = ujMunkamenet();
  const k = fut(mm, 'conf t');
  assert.equal(k[1], ERVENYTELEN);
  assert.equal(jelOszlop(k), 'Switch>conf '.length);
});

test('a VLAN-név legfeljebb 32 karakter', () => {
  const { kimenet } = konfigbol('vlan 10', 'name ' + 'A'.repeat(33));
  assert.equal(kimenet[1], ERVENYTELEN);
});

test('gyári VLAN nem törölhető és nem nevezhető át', () => {
  assert.deepEqual(konfigbol('no vlan 1').kimenet, ['%Default VLAN 1 may not be deleted.']);
  assert.deepEqual(konfigbol('vlan 1002', 'name X').kimenet, ['%Default VLAN 1002 may not have its name changed.']);
});

test('kiterjesztett VLAN (1006–4094) VTP server módban nem hozható létre', () => {
  const { mm, kimenet } = konfigbol('vlan 2000');
  assert.equal(kimenet[0], 'Extended VLAN(s) not allowed in current VTP mode.');
  assert.equal(mm.eszkoz.vlanok[2000], undefined);
  assert.equal(mm.mod, 'konfig');
});

test('még meg nem írt, de létező parancs: szimulátor-megjegyzés, nem hibaüzenet', () => {
  const { kimenet } = privbol('copy running-config startup-config');
  assert.ok(kimenet[0].startsWith('[Szimulátor]'));
  assert.ok(kimenet[0].includes('copy'));
});

test('üres sor: nincs kimenet, nincs előzmény', () => {
  const mm = ujMunkamenet();
  assert.deepEqual(fut(mm, '   '), []);
  assert.deepEqual(mm.tortenet(), []);
});
