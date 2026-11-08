/**
 * A RouterOS-szerű parancssor (MikroTik): menük, rövidítés, paraméterek, [find], hibaüzenetek,
 * kérdések (numbers:), súgó, Tab, print/export formája.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ujCrs326 } from '../src/modell/mikrotik.js';
import { RouterOsMunkamenet } from '../src/gyartok/routeros/munkamenet.js';
import { tokenekre } from '../src/gyartok/routeros/parancssor.js';

function uj() {
  const sw = ujCrs326({ hostname: 'SW1' });
  return { sw, mm: new RouterOsMunkamenet({ eszkoz: sw }) };
}
function fut(mm, ...sorok) {
  let k = [];
  for (const s of sorok) k = mm.bevitel(s).kimenet;
  return k.filter((x) => typeof x === 'string');
}

test('gyári állapot (defconf): minden port a „bridge”-ben, 192.168.88.1/24 a bridge-en', () => {
  const { sw } = uj();
  assert.equal(sw.hidak[0].nev, 'bridge');
  assert.equal(sw.hidPortok.length, 26);
  assert.deepEqual(sw.ipCimek.map((c) => `${c.cim}/${c.hossz} ${c.interfesz}`), ['192.168.88.1/24 bridge']);
  assert.equal(sw.portok[24].nev, 'sfp-sfpplus1');
});

test('prompt: főmenü, menü, Safe Mode', () => {
  const { mm } = uj();
  assert.equal(mm.prompt(), '[admin@SW1] > ');
  fut(mm, '/interface bridge port');
  assert.equal(mm.prompt(), '[admin@SW1] /interface/bridge/port> ');
  fut(mm, '..');
  assert.equal(mm.prompt(), '[admin@SW1] /interface/bridge> ');
  assert.deepEqual(mm.ctrlX().kimenet, ['[Safe Mode taken]']);
  assert.equal(mm.prompt(), '[admin@SW1] /interface/bridge<SAFE> ');
  assert.deepEqual(mm.ctrlX().kimenet, ['[Safe Mode released]']);
  fut(mm, '/');
  assert.equal(mm.prompt(), '[admin@SW1] > ');
});

test('rövidítés: menü, parancs és paraméternév; a perjeles útvonal is jó', () => {
  const { sw, mm } = uj();
  assert.deepEqual(fut(mm, '/int br vl add br=bridge vl=10 tag=ether24 com=IRODA'), []);
  assert.deepEqual(sw.hidVlanok[0], { hid: 'bridge', vlanok: '10', cimkezett: ['ether24'], cimkezetlen: [], komment: 'IRODA', letiltva: false });
  assert.deepEqual(fut(mm, '/interface/bridge/port/set [find interface=ether1] pvid=10'), []);
  assert.equal(sw.hidPortok[0].pvid, 10);
  assert.equal(mm.utolsoKanonikus, '/interface bridge port set');
});

test('elemek megnevezése: sorszám, név, [find], [find where]', () => {
  const { sw, mm } = uj();
  fut(mm, '/interface bridge port');
  fut(mm, 'set 1 pvid=20');
  fut(mm, 'set ether3 pvid=30');
  fut(mm, 'set [find where interface=ether4] pvid=40');
  assert.deepEqual(sw.hidPortok.slice(1, 4).map((p) => p.pvid), [20, 30, 40]);
  assert.deepEqual(fut(mm, 'set ether99 pvid=2'), ['no such item']);
});

test('hibaüzenetek a valódi eszköz formájában', () => {
  const { mm } = uj();
  assert.deepEqual(fut(mm, '/foo'), ['bad command name foo (line 1 column 2)']);
  assert.deepEqual(fut(mm, '/interface bridge port set ether1 xyz=1'), ['expected end of command (line 1 column 35)']);
  assert.deepEqual(fut(mm, '/interface bridge port set ether1 pvid=5000'), ['value of pvid out of range (1..4094)']);
  assert.deepEqual(fut(mm, '/interface bridge port set ether1 pvid=abc'), ['invalid value for argument pvid']);
  assert.deepEqual(fut(mm, '/interface bridge port set ether1 frame-types=x'), ['input does not match any value of frame-types']);
  assert.deepEqual(fut(mm, '/interface bridge port add bridge=bridge interface=ether1'), ['failure: device already added as bridge port']);
  assert.deepEqual(fut(mm, '/interface bridge add name=bridge'), ['failure: already have interface with such name']);
  assert.deepEqual(fut(mm, '/ip address add address=1.2.3/24 interface=bridge'), ['invalid value for argument address']);
});

test('kérdések: a hiányzó elem (numbers:) és a kötelező paraméter (interface:)', () => {
  const { sw, mm } = uj();
  fut(mm, '/interface bridge port');
  fut(mm, 'set pvid=7');
  assert.equal(mm.prompt(), 'numbers: ');
  fut(mm, 'ether5');
  assert.equal(sw.hidPortok[4].pvid, 7);
  fut(mm, 'remove ether6');
  fut(mm, 'add bridge=bridge');
  assert.equal(mm.prompt(), 'interface: ');
  fut(mm, 'ether6');
  assert.ok(sw.hidPortok.some((p) => p.interfesz === 'ether6'));
});

test('a dinamikus VLAN-sor nem módosítható', () => {
  const { mm } = uj();
  const k = fut(mm, '/interface bridge vlan print');
  assert.ok(k.some((s) => /^0 D bridge\s+1/.test(s)), k.join('\n'));
  assert.deepEqual(fut(mm, '/interface bridge vlan set 0 tagged=ether1'), ['failure: can not modify dynamic entry']);
});

test('print: Flags/Columns fejléc, ;;; megjegyzés, jobbra igazított számok', () => {
  const { mm } = uj();
  const k = fut(mm, '/interface bridge port print');
  assert.equal(k[0], 'Flags: I - INACTIVE');
  assert.equal(k[1], 'Columns: INTERFACE, BRIDGE, HW, PVID, PRIORITY, PATH-COST, INTERNAL-PATH-COST, HORIZON');
  assert.ok(k[2].startsWith('#    INTERFACE'));
  assert.equal(k[3], ';;; defconf');
  assert.match(k[4], /^0  I ether1\s+bridge\s+yes\s+1  0x80/);
  assert.deepEqual(fut(mm, '/system identity print'), ['  name: SW1']);
});

test('export: fejléc, csak a gyáritól eltérő beállítások, betűrendben', () => {
  const { mm } = uj();
  fut(mm, '/interface bridge set bridge vlan-filtering=yes', '/interface bridge port set ether2 pvid=20 frame-types=admit-only-untagged-and-priority-tagged',
    '/interface disable ether7', '/system identity set name=SW9');
  const k = fut(mm, '/export');
  assert.match(k[0], /^# 1970-01-02 \d\d:\d\d:\d\d by RouterOS 7\.\d+$/);
  assert.ok(k.includes('# model = CRS326-24G-2S+'));
  assert.ok(k.some((s) => /^add admin-mac=\S+ auto-mac=no comment=defconf name=bridge vlan-filtering=yes$/.test(s)), k.join('\n'));
  assert.ok(k.includes('add bridge=bridge comment=defconf frame-types=admit-only-untagged-and-priority-tagged interface=ether2 pvid=20'));
  assert.ok(k.includes('set [ find default-name=ether7 ] disabled=yes'));
  assert.deepEqual(k.slice(-2), ['/system identity', 'set name=SW9']);
  // Menüből csak a saját része
  const p = fut(mm, '/interface bridge vlan export');
  assert.ok(!p.some((s) => s.startsWith('/interface bridge port')));
});

test('? súgó: menük és parancsok, paraméterek, értékek (magyar leírással)', () => {
  const { mm } = uj();
  const fo = mm.sugo('').kimenet;
  assert.ok(fo.some((s) => /^interface\s+-- \[menü\]/.test(s)));
  assert.ok(fo.some((s) => /^ping\s+-- /.test(s)));
  const p = mm.sugo('/interface bridge port set ').kimenet;
  assert.ok(p.some((s) => s.startsWith('<numbers>')));
  assert.ok(p.some((s) => /^pvid\s+-- /.test(s)));
  const e = mm.sugo('/interface bridge port set ether1 frame-types=').kimenet;
  assert.ok(e.some((s) => s.startsWith('admit-only-vlan-tagged')));
});

test('Tab: menü, paraméternév (=-vel), érték, interfészlista', () => {
  const { mm } = uj();
  assert.equal(mm.kiegeszit('/inter'), '/interface ');
  assert.equal(mm.kiegeszit('/interface bridge port set ether1 fra'), '/interface bridge port set ether1 frame-types=');
  assert.equal(mm.kiegeszit('/interface bridge port set ether1 frame-types=admit-only-v'), '/interface bridge port set ether1 frame-types=admit-only-vlan-tagged ');
  // Több lehetőségnél a közös részig egészít ki; ha az már be van írva, nem változik semmi.
  assert.equal(mm.kiegeszit('/interface bridge vlan add tagged=ether23,sfp'), '/interface bridge vlan add tagged=ether23,sfp-sfpplus');
  assert.equal(mm.kiegeszit('/interface bridge vlan add tagged=ether23,sfp-sfpplus'), null);
});

test('szavakra bontás: [find …] és idézőjeles érték egy szó', () => {
  const t = tokenekre('set [find interface=ether1] comment="Első emelet" pvid=10');
  assert.deepEqual(t.map((x) => x.szoveg), ['set', '[find interface=ether1]', 'comment="Első emelet"', 'pvid=10']);
});
