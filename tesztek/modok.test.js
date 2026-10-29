/**
 * Módok, promptok, módváltások, do, előzmények.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ujMunkamenet, fut, privbol, konfigbol } from './segito.js';
import { TORTENET_MERET } from '../src/cli/terminal-munkamenet.js';

test('promptok módonként', () => {
  const mm = ujMunkamenet();
  assert.equal(mm.prompt(), 'Switch>');
  fut(mm, 'enable');
  assert.equal(mm.prompt(), 'Switch#');
  assert.deepEqual(fut(mm, 'configure terminal'), ['Enter configuration commands, one per line.  End with CNTL/Z.']);
  assert.equal(mm.prompt(), 'Switch(config)#');
  fut(mm, 'interface fa0/1');
  assert.equal(mm.prompt(), 'Switch(config-if)#');
  fut(mm, 'exit', 'interface range fa0/1 - 2');
  assert.equal(mm.prompt(), 'Switch(config-if-range)#');
  fut(mm, 'exit', 'vlan 10');
  assert.equal(mm.prompt(), 'Switch(config-vlan)#');
});

test('exit: almódból a konfig módba, onnan a privilegizáltba (naplóüzenettel)', () => {
  const { mm } = konfigbol('vlan 10');
  assert.deepEqual(fut(mm, 'exit'), []);
  assert.equal(mm.mod, 'konfig');
  const k = fut(mm, 'exit');
  assert.equal(mm.mod, 'priv');
  assert.equal(k[0], 'Switch#');
  assert.match(k[1], /^\*Mar {2}1 \d\d:\d\d:\d\d\.\d{3}: %SYS-5-CONFIG_I: Configured from console by console$/);
});

test('end és Ctrl+Z bármelyik konfigurációs módból a privilegizált módba visz', () => {
  const a = konfigbol('int fa0/3').mm;
  fut(a, 'end');
  assert.equal(a.mod, 'priv');
  const b = konfigbol('vlan 20').mm;
  b.ctrlZ();
  assert.equal(b.mod, 'priv');
  // Exec módban a Ctrl+Z nem csinál semmit
  const c = privbol().mm;
  assert.deepEqual(c.ctrlZ().kimenet, []);
  assert.equal(c.mod, 'priv');
});

test('disable: vissza a felhasználói módba; a configure terminal ott nem él', () => {
  const { mm } = privbol('disable');
  assert.equal(mm.mod, 'felhasznalo');
  fut(mm, 'configure terminal');
  assert.equal(mm.mod, 'felhasznalo');
});

test('a show running-config felhasználói módban nem érhető el, a show vlan brief igen', () => {
  const mm = ujMunkamenet();
  assert.ok(fut(mm, 'show vlan brief').some((s) => s.startsWith('VLAN Name')));
  assert.equal(fut(mm, 'show running-config')[1], "% Invalid input detected at '^' marker.");
});

test('do: exec parancs konfigurációs módból, a mód nem változik', () => {
  const { mm, kimenet } = konfigbol('vlan 10', 'name IRODA', 'do show vlan brief');
  assert.equal(mm.mod, 'konfig-vlan');
  assert.ok(kimenet.some((s) => s.startsWith('10   IRODA')));
  assert.deepEqual(fut(mm, 'do'), ['% Incomplete command.', '']);
});

test('almódban a globális parancs is működik, és kilép az almódból', () => {
  const { mm } = konfigbol('interface fa0/1', 'vlan 30');
  assert.equal(mm.mod, 'konfig-vlan');
  assert.deepEqual(mm.kontextus, { vlan: 30 });
  fut(mm, 'hostname SW9');
  assert.equal(mm.mod, 'konfig');
  assert.equal(mm.eszkoz.hostname, 'SW9');
});

test('csak „configure”: rákérdez, Enterre terminálról konfigurál', () => {
  const { mm } = privbol('configure');
  assert.equal(mm.prompt(), 'Configuring from terminal, memory, or network [terminal]? ');
  const k = fut(mm, '');
  assert.equal(k[0], 'Enter configuration commands, one per line.  End with CNTL/Z.');
  assert.equal(mm.mod, 'konfig');
  const m2 = privbol('configure', 'xyz').mm;
  assert.equal(m2.mod, 'priv');
});

test('exit exec módban: a konzol felszabadul, Enterre újra Switch>', () => {
  const { mm, kimenet } = privbol('exit');
  assert.ok(kimenet.includes('Switch con0 is now available'));
  assert.ok(kimenet.includes('Press RETURN to get started.'));
  assert.equal(mm.prompt(), '');
  fut(mm, '');
  assert.equal(mm.prompt(), 'Switch>');
});

test('előzmények: külön az exec és a konfigurációs módokban', () => {
  const mm = ujMunkamenet();
  fut(mm, 'enable', 'show vlan brief', 'configure terminal', 'hostname A', 'vlan 10');
  assert.deepEqual(mm.tortenet(), ['hostname A', 'vlan 10']);
  fut(mm, 'end');
  assert.deepEqual(mm.tortenet(), ['enable', 'show vlan brief', 'configure terminal']);
});

test('előzmények: legfeljebb 10 sor, az egymás utáni ismétlés egyszer számít', () => {
  const { mm } = privbol();
  for (let i = 0; i < 15; i++) fut(mm, `show vlan brief`, `sh vl br ${i}`);
  assert.equal(mm.tortenet().length, TORTENET_MERET);
  fut(mm, 'show vlan brief', 'show vlan brief');
  const t = mm.tortenet();
  assert.notEqual(t[t.length - 2], t[t.length - 1]);
});

test('shutdown / no shutdown a tartomány minden portján, naplóüzenettel', () => {
  const { mm, kimenet } = konfigbol('int range fa0/1 - 2, gi0/2', 'shutdown');
  assert.equal(kimenet.length, 3);
  assert.match(kimenet[0], /%LINK-5-CHANGED: Interface FastEthernet0\/1, changed state to administratively down$/);
  const le = mm.eszkoz.portok.filter((p) => p.leallitva).map((p) => p.rovid);
  assert.deepEqual(le, ['Fa0/1', 'Fa0/2', 'Gi0/2']);
  // Másodszor már nincs üzenet (már le van kapcsolva)
  assert.deepEqual(fut(mm, 'shutdown'), []);
  fut(mm, 'no shutdown');
  assert.equal(mm.eszkoz.portok.filter((p) => p.leallitva).length, 0);
});

test('hostname és no hostname', () => {
  const { mm } = konfigbol('hostname SW1');
  assert.equal(mm.prompt(), 'SW1(config)#');
  fut(mm, 'no hostname');
  assert.equal(mm.prompt(), 'Switch(config)#');
  assert.deepEqual(fut(mm, 'hostname Kapcsoló'), ['% Hostname contains one or more illegal characters.']);
  assert.equal(mm.eszkoz.hostname, 'Switch');
});

test('no vlan törli a VLAN-t, no name visszaállítja az alapnevet', () => {
  const { mm } = konfigbol('vlan 10', 'name IRODA', 'no name');
  assert.equal(mm.eszkoz.vlanok[10].nev, 'VLAN0010');
  fut(mm, 'exit', 'no vlan 10');
  assert.equal(mm.eszkoz.vlanok[10], undefined);
});
