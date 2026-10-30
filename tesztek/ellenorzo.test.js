/**
 * Eredményalapú ellenőrzés ellenpróbákkal (vlan-1 feladat).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vlanFeladat, megold } from './segito.js';
import { ellenoriz } from '../src/feladat/ellenorzo.js';

function futtat(f) {
  let vege = null;
  ellenoriz(f, { kesz: (e) => (vege = e) });
  f.lep(120000);
  assert.ok(vege, 'az ellenőrzés befejeződött');
  return f.feladat.celok.map((c, i) => ({ szoveg: c.szoveg, ...vege[i] }));
}

const rosszak = (e) => e.filter((x) => !x.ok).map((x) => x.szoveg);

test('helyes megoldás (egyik switch rövidítve, másik kiírva): minden cél teljesül', () => {
  const f = vlanFeladat();
  megold(f, 'SW1', true);
  megold(f, 'SW2');
  f.ipk();
  assert.deepEqual(rosszak(futtat(f)), []);
});

test('üres feladat: semmi nem teljesül, csak a „nem megy” ellenpróba', () => {
  const f = vlanFeladat();
  const e = futtat(f);
  assert.deepEqual(e.filter((x) => x.ok).map((x) => x.szoveg), ['Ellenpróba: ping PC1 → PC2 NEM megy (különböző VLAN)']);
});

test('VLAN-ok nélkül, mindenki VLAN 1-ben, azonos hálózatban: a ping megy, de az ellenpróba megbukik', () => {
  const f = vlanFeladat();
  for (const n of ['PC1', 'PC2', 'PC3', 'PC4']) Object.assign(f.eszkoz(n), { ip: `10.0.0.${n[2]}`, maszk: '255.0.0.0' });
  f.feladat = { ...f.feladat, cimterv: f.feladat.cimterv.map((s) => ({ ...s, ip: `10.0.0.${s.eszkoz[2]}` })) };
  const e = futtat(f);
  const szoras = e.find((x) => x.szoveg.startsWith('Ellenpróba: PC1 szórása'));
  assert.equal(szoras.ok, false);
  assert.match(szoras.megjegyzes, /Ide nem szabadna eljutnia \(más VLAN\): PC2, PC4/);
});

test('trunk csak az egyik oldalon (a másik dynamic auto): elfogadva, mert működik', () => {
  const f = vlanFeladat();
  megold(f, 'SW1');
  f.sw('SW2', 'conf t', 'vlan 10', 'name IRODA', 'vlan 20', 'name RAKTAR', 'int fa0/1', 'sw mo acc', 'sw acc vl 10',
    'int fa0/2', 'sw mo acc', 'sw acc vl 20', 'end');
  f.ipk();
  assert.deepEqual(rosszak(futtat(f)), []);
});

test('trunk hiányzik: a trunk-cél és a pingek elbuknak, magyarázattal', () => {
  const f = vlanFeladat();
  for (const n of ['SW1', 'SW2']) {
    f.sw(n, 'conf t', 'vlan 10', 'name IRODA', 'vlan 20', 'name RAKTAR', 'int fa0/1', 'sw mo acc', 'sw acc vl 10',
      'int fa0/2', 'sw mo acc', 'sw acc vl 20', 'end');
  }
  f.ipk();
  const e = futtat(f);
  assert.deepEqual(rosszak(e), [
    'SW1 Gi0/1 – SW2 Gi0/1: működő trunk',
    'Ping PC1 → PC3 megy (VLAN 10, a trunkon át)',
    'Ping PC2 → PC4 megy (VLAN 20, a trunkon át)',
    'Ellenpróba: PC1 szórása (broadcast) csak PC3-hoz jut el, PC2-höz és PC4-hez nem',
    'Ellenpróba: PC2 szórása csak PC4-hez jut el, PC1-hez és PC3-hoz nem',
  ]);
  assert.match(e[8].megjegyzes, /Két „dynamic auto” port nem kezdeményez trunkot/);
  assert.match(e[13].megjegyzes, /Destination host unreachable/);
});

test('rossz VLAN-név és rossz IP: pontos magyarázat', () => {
  const f = vlanFeladat();
  megold(f, 'SW1');
  megold(f, 'SW2');
  f.sw('SW2', 'conf t', 'vlan 20', 'name Raktar', 'end');
  f.ipk();
  f.eszkoz('PC4').ip = '192.168.20.41';
  const e = futtat(f);
  assert.equal(e[3].megjegyzes, 'A VLAN neve most: Raktar (RAKTAR kellene).');
  assert.equal(e[12].megjegyzes, 'IP-cím most: 192.168.20.41 (192.168.20.14 kellene).');
  assert.equal(e[14].ok, false);
});
