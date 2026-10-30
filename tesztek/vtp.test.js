/**
 * VTP: szerepek, terjesztés, revízió (és a csapda), jelszó, verzió, transparent – a vtp-1 feladaton.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { feladatTeszt, konfigbol, fut } from './segito.js';
import { ellenoriz } from '../src/feladat/ellenorzo.js';

const TRUNK = ['int g0/1', 'sw mo tr', 'exit'];

/** A vtp-1 feladat teljes, helyes megoldása (a lépések sorrendjében). */
function megoldVtp(f, { nullaz = true } = {}) {
  if (nullaz) f.sw('SW3', 'conf t', 'vtp mode transparent', 'vtp mode client', 'end');
  else f.sw('SW3', 'conf t', 'vtp mode client', 'end');
  for (const n of ['SW1', 'SW2', 'SW3']) f.sw(n, 'conf t', 'vtp domain ROUTERRANTOTTA', 'vtp password Rantotta2026', 'end');
  f.sw('SW1', 'conf t', 'vtp version 2', 'vlan 10', 'name IRODA', 'vlan 20', 'name RAKTAR', 'end');
  f.sw('SW2', 'conf t', 'vtp mode transparent', 'vtp version 2', 'vlan 10', 'vlan 20', 'vlan 99', 'name SAJAT', 'end');
  f.sw('SW1', 'conf t', ...TRUNK, 'int f0/1', 'sw mo acc', 'sw acc vl 10', 'int f0/2', 'sw mo acc', 'sw acc vl 20', 'end');
  f.sw('SW2', 'conf t', 'int range g0/1 - 2', 'sw mo tr', 'end');
  f.sw('SW3', 'conf t', ...TRUNK, 'int f0/1', 'sw mo acc', 'sw acc vl 10', 'int f0/2', 'sw mo acc', 'sw acc vl 20', 'end');
  f.lep(5000);
}

function futtat(f) {
  let vege = null;
  ellenoriz(f, { kesz: (e) => (vege = e) });
  f.lep(120000);
  return f.feladat.celok.map((c, i) => ({ szoveg: c.szoveg, ...vege[i] }));
}
const rosszak = (e) => e.filter((x) => !x.ok).map((x) => `${x.szoveg} → ${x.megjegyzes}`);
const vlanok = (sw) => Object.entries(sw.vlanok).filter(([, v]) => !v.gyari).map(([n, v]) => `${n} ${v.nev}`).sort();

test('VTP-parancsok válaszai', () => {
  let k = konfigbol('vtp mode server').kimenet;
  assert.deepEqual(k, ['Device mode already VTP SERVER.']);
  k = konfigbol('vtp mode client').kimenet;
  assert.deepEqual(k, ['Setting device to VTP CLIENT mode.']);
  k = konfigbol('vtp mode transparent').kimenet;
  assert.deepEqual(k, ['Setting device to VTP TRANSPARENT mode.']);
  k = konfigbol('vtp domain LAB').kimenet;
  assert.deepEqual(k, ['Changing VTP domain name from NULL to LAB']);
  k = konfigbol('vtp domain LAB', 'vtp domain LAB').kimenet;
  assert.deepEqual(k, ['Domain name already set to LAB.']);
  k = konfigbol('vtp password titok').kimenet;
  assert.deepEqual(k, ['Setting device VLAN database password to titok']);
  k = konfigbol('vtp mode client', 'vtp version 2').kimenet;
  assert.deepEqual(k, ['Cannot modify version in VTP client mode']);
  k = konfigbol('vtp mode client', 'vlan 10').kimenet;
  assert.deepEqual(k, ['VTP VLAN configuration not allowed when device is in CLIENT mode.']);
});

test('revízió: VLAN-módosítás növeli; transparent és tartományváltás nulláz; server → client nem', () => {
  const { mm } = konfigbol('vlan 10', 'name A', 'vlan 20');
  assert.equal(mm.eszkoz.vtpRevizio, 3);
  fut(mm, 'vtp mode client');
  assert.equal(mm.eszkoz.vtpRevizio, 3);
  fut(mm, 'vtp mode transparent');
  assert.equal(mm.eszkoz.vtpRevizio, 0);
  const b = konfigbol('vlan 10', 'exit', 'vtp domain X').mm;
  assert.equal(b.eszkoz.vtpRevizio, 0);
});

test('show vtp status és show vtp password formája', () => {
  const { mm } = konfigbol('vtp domain LAB', 'vtp password titok', 'vlan 10', 'end');
  const k = fut(mm, 'show vtp status');
  assert.equal(k[0], 'VTP Version capable             : 1 to 3');
  assert.equal(k[1], 'VTP version running             : 1');
  assert.equal(k[2], 'VTP Domain Name                 : LAB');
  assert.match(k[5], /^Device ID                       : [0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4}$/);
  assert.match(k[6], /^Configuration last modified by 0\.0\.0\.0 at 3-1-93 \d\d:\d\d:\d\d$/);
  assert.equal(k[7], 'Local updater ID is 0.0.0.0 (no valid interface found)');
  assert.equal(k[11], 'VTP Operating Mode                : Server');
  assert.equal(k[13], 'Number of existing VLANs          : 6');
  assert.equal(k[14], 'Configuration Revision            : 1');
  assert.match(k[15], /^MD5 digest                        : (0x[0-9A-F]{2} ){7}0x[0-9A-F]{2}$/);
  assert.deepEqual(fut(mm, 'show vtp password'), ['VTP Password: titok']);
});

test('transparent: a VLAN-ok a running-configban, a vtp sorokkal együtt', () => {
  const { mm } = konfigbol('vtp domain LAB', 'vtp mode transparent', 'vlan 99', 'name SAJAT', 'end');
  const k = fut(mm, 'show running-config');
  assert.ok(k.includes('vtp domain LAB'));
  assert.ok(k.includes('vtp mode transparent'));
  const i = k.indexOf('vlan 99');
  assert.deepEqual(k.slice(i, i + 2), ['vlan 99', ' name SAJAT']);
});

test('helyes megoldás: a kliens átveszi a VLAN-okat, a transparent helyi VLAN-ja nem terjed; minden cél teljesül', () => {
  const f = feladatTeszt('vtp-1');
  megoldVtp(f);
  const sw1 = f.eszkoz('SW1');
  const sw3 = f.eszkoz('SW3');
  assert.deepEqual(vlanok(sw3), ['10 IRODA', '20 RAKTAR']);
  assert.equal(sw3.vtpRevizio, sw1.vtpRevizio);
  assert.equal(sw3.vtpVerzio, 2, 'a verzió a serverről jött');
  assert.equal(f.eszkoz('SW2').vtpRevizio, 0);
  assert.deepEqual(rosszak(futtat(f)), []);
});

test('a csapda: nullázás nélkül SW3 (15-ös revízió) felülírja SW1 VLAN-jait', () => {
  const f = feladatTeszt('vtp-1');
  megoldVtp(f, { nullaz: false });
  assert.deepEqual(vlanok(f.eszkoz('SW1')), ['10 REGI_LABOR', '30 TESZT']);
  const e = futtat(f);
  const r = rosszak(e).join('\n');
  assert.match(r, /SW1: 10-es VLAN, neve IRODA → A VLAN neve most: REGI_LABOR/);
  assert.match(r, /Ellenpróba: a régi labor VLAN-jai nem írták felül SW1-et/);
});

test('eltérő jelszó: nincs átvétel, a show vtp status jelzi az MD5-eltérést', () => {
  const f = feladatTeszt('vtp-1');
  megoldVtp(f);
  f.sw('SW3', 'conf t', 'vtp password rossz', 'end');
  f.sw('SW1', 'conf t', 'vlan 40', 'end');
  f.lep(5000);
  assert.ok(!f.eszkoz('SW3').vlanok[40]);
  const k = f.sw('SW3', 'show vtp status');
  assert.equal(k[k.length - 1], '*** MD5 digest checksum mismatch on trunk: Gi0/1 ***');
});

test('transparent 1-es verzióban csak azonos tartománynál enged tovább, 2-esben mindig', () => {
  const f = feladatTeszt('vtp-1');
  megoldVtp(f);
  f.sw('SW2', 'conf t', 'vtp version 1', 'vtp domain MASIK', 'end');
  f.sw('SW1', 'conf t', 'vlan 50', 'end');
  f.lep(5000);
  assert.ok(!f.eszkoz('SW3').vlanok[50], 'v1, más tartomány: nem megy át');
  f.sw('SW2', 'conf t', 'vtp version 2', 'end');
  f.sw('SW1', 'conf t', 'vlan 51', 'end');
  f.lep(5000);
  assert.ok(f.eszkoz('SW3').vlanok[51], 'v2: átmegy');
});

test('egyenlő revíziónál nincs átvétel (a server tartományváltás után 0-ról indul)', () => {
  const f = feladatTeszt('vtp-1');
  // SW1-en előbb VLAN-ok, csak utána tartomány → a revízió visszaesik 0-ra.
  f.sw('SW3', 'conf t', 'vtp mode transparent', 'vtp mode client', 'end');
  f.sw('SW1', 'conf t', 'vlan 10', 'name IRODA', 'vtp domain ROUTERRANTOTTA', 'vtp password Rantotta2026', ...TRUNK, 'end');
  f.sw('SW2', 'conf t', 'vtp mode transparent', 'vtp version 2', 'int range g0/1 - 2', 'sw mo tr', 'end');
  f.sw('SW3', 'conf t', ...TRUNK, 'end');
  f.lep(5000);
  assert.equal(f.eszkoz('SW1').vtpRevizio, 0);
  assert.deepEqual(vlanok(f.eszkoz('SW3')), ['10 REGI_LABOR', '30 TESZT']);
  const e = futtat(f).find((x) => x.szoveg.startsWith('SW3 a VTP-n át'));
  assert.match(e.megjegyzes, /Egyenlő revíziónál nincs átvétel/);
});

test('NULL tartományú switch átveszi a hallott tartománynevet; eltérő tartománynál nincs dinamikus trunk', () => {
  const f = feladatTeszt('vtp-1');
  // SW2 gyári (NULL), SW3 a régi ROUTERRANTOTTA-tartományban; jelszó nélkül SW2 nem fogadja el az adatot,
  // de a nevet átveszi.
  f.sw('SW2', 'conf t', 'int g0/2', 'sw mo tr', 'end');
  f.lep(5000);
  assert.equal(f.eszkoz('SW2').vtpTartomany, 'ROUTERRANTOTTA');
  // SW1 más tartományban, SW1–SW2 között csak dinamikus egyeztetés lenne: nincs trunk.
  f.sw('SW1', 'conf t', 'vtp domain MASIK', 'int g0/1', 'sw mo dyn des', 'end');
  f.lep(5000);
  const k = f.sw('SW1', 'show interfaces trunk');
  assert.deepEqual(k, []);
});
