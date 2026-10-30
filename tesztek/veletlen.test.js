/**
 * Véletlen adatok: magyar ragozás, determinisztikus változatok, és hogy MINDEN változat
 * megoldható (a helyes megoldásra minden cél teljesül, az ellenpróbák is).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { feladatTeszt } from './segito.js';
import { esRag, nevelo } from '../src/magyar.js';
import { ertekek, feladatValtozat, behelyettesit, generator } from '../src/feladat/veletlen.js';
import { feladatKeres } from '../src/feladat/betolto.js';
import { ellenoriz } from '../src/feladat/ellenorzo.js';

test('-s képző és névelő számokhoz', () => {
  const v = { 1: '1-es', 2: '2-es', 3: '3-as', 4: '4-es', 5: '5-ös', 6: '6-os', 7: '7-es', 8: '8-as', 9: '9-es',
    10: '10-es', 20: '20-as', 30: '30-as', 40: '40-es', 50: '50-es', 60: '60-as', 70: '70-es', 80: '80-as', 90: '90-es',
    99: '99-es', 100: '100-as', 115: '115-ös', 200: '200-as', 254: '254-es', 1000: '1000-es' };
  for (const [n, r] of Object.entries(v)) assert.equal(esRag(Number(n)), r);
  assert.equal(nevelo(1), 'az');
  assert.equal(nevelo(5), 'az');
  assert.equal(nevelo(50), 'az');
  assert.equal(nevelo(512), 'az');
  assert.equal(nevelo(10), 'a');
  assert.equal(nevelo(11), 'a');
  assert.equal(nevelo(100), 'a');
});

test('helyőrzők: érték, ragozás, névelő, csak-szám → szám', () => {
  const e = { V: 5, N: 'IRODA' };
  assert.equal(behelyettesit('{V}', e), 5);
  assert.equal(behelyettesit('VLAN {V} {N}', e), 'VLAN 5 IRODA');
  assert.equal(behelyettesit('{V|es} és {V|aes}, {V|Aes}; {V|a}', e), '5-ös és az 5-ös, Az 5-ös; az 5');
  assert.equal(behelyettesit('{ISMERETLEN}', e), '{ISMERETLEN}');
});

test('ugyanaz a mag ugyanazt adja, más mag mást; mag nélkül az alapértékek', () => {
  const fd = feladatKeres('vtp-1');
  assert.deepEqual(ertekek(fd.valtozok, 123), ertekek(fd.valtozok, 123));
  assert.notDeepEqual(ertekek(fd.valtozok, 123), ertekek(fd.valtozok, 124));
  assert.equal(ertekek(fd.valtozok, null).VLAN1, 10);
  const r = generator(1);
  for (let i = 0; i < 1000; i++) {
    const x = r();
    assert.ok(x >= 0 && x < 1);
  }
});

test('minden változatban: nincs maradék helyőrző, a VLAN-számok és -nevek különböznek', () => {
  for (const azon of ['vlan-1', 'vtp-1']) {
    for (let mag = 1; mag <= 300; mag++) {
      const v = feladatValtozat(feladatKeres(azon), mag);
      const { eredeti, ...valtozat } = v;
      void eredeti;
      assert.doesNotMatch(JSON.stringify(valtozat), /\{[A-Z][A-Z0-9_]*(\|[a-zA-Z]+)?\}/, `${azon} #${mag}`);
      const e = v.ertekek;
      const vlanok = [e.VLAN1, e.VLAN2, e.HELYI, e.REGI].filter((x) => x !== undefined);
      assert.equal(new Set(vlanok).size, vlanok.length, `${azon} #${mag}: különböző VLAN-ok`);
      assert.notEqual(e.NEV1, e.NEV2);
      for (const n of vlanok) assert.ok(n >= 2 && n <= 254 && n !== 1);
    }
  }
});

function futtat(f) {
  let vege = null;
  ellenoriz(f, { kesz: (x) => (vege = x) });
  f.lep(120000);
  return f.feladat.celok.map((c, i) => ({ szoveg: c.szoveg, ...vege[i] })).filter((x) => !x.ok).map((x) => `${x.szoveg} → ${x.megjegyzes}`);
}

const MAGOK = [7, 42, 1234, 9999, 31337, 55555, 77777, 99999];

test('vlan-1: minden vizsgált változat megoldható (a megoldás az adott számokkal)', () => {
  for (const mag of MAGOK) {
    const f = feladatTeszt('vlan-1', mag);
    const { e } = f;
    for (const n of ['SW1', 'SW2']) {
      f.sw(n, 'conf t', `vlan ${e.VLAN1}`, `name ${e.NEV1}`, `vlan ${e.VLAN2}`, `name ${e.NEV2}`,
        'int f0/1', 'sw mo acc', `sw acc vl ${e.VLAN1}`, 'int f0/2', 'sw mo acc', `sw acc vl ${e.VLAN2}`,
        'int g0/1', 'sw mo tr', 'end');
    }
    f.ipk();
    assert.deepEqual(futtat(f), [], `#${mag}`);
  }
});

test('vtp-1: minden vizsgált változat megoldható, és a csapda is működik', () => {
  for (const mag of MAGOK) {
    const f = feladatTeszt('vtp-1', mag);
    const { e } = f;
    f.sw('SW3', 'conf t', 'vtp mode transparent', 'vtp mode client', 'end');
    for (const n of ['SW1', 'SW2', 'SW3']) f.sw(n, 'conf t', `vtp domain ${e.TARTOMANY}`, `vtp password ${e.JELSZO}`, 'end');
    f.sw('SW1', 'conf t', 'vtp version 2', `vlan ${e.VLAN1}`, `name ${e.NEV1}`, `vlan ${e.VLAN2}`, `name ${e.NEV2}`, 'end');
    f.sw('SW2', 'conf t', 'vtp mode transparent', 'vtp version 2', `vlan ${e.VLAN1}`, `vlan ${e.VLAN2}`,
      `vlan ${e.HELYI}`, `name ${e.NEVH}`, 'end');
    for (const n of ['SW1', 'SW3']) {
      f.sw(n, 'conf t', 'int g0/1', 'sw mo tr', 'int f0/1', 'sw mo acc', `sw acc vl ${e.VLAN1}`,
        'int f0/2', 'sw mo acc', `sw acc vl ${e.VLAN2}`, 'end');
    }
    f.sw('SW2', 'conf t', 'int range g0/1 - 2', 'sw mo tr', 'end');
    f.lep(5000);
    assert.deepEqual(futtat(f), [], `#${mag}`);
    assert.equal(f.eszkoz('SW3').vtpRevizio, f.eszkoz('SW1').vtpRevizio);
  }
  // A csapda véletlen adatokkal is: nullázás nélkül a régi VLAN (REGI) felülírja SW1-et.
  const f = feladatTeszt('vtp-1', 4242);
  const { e } = f;
  assert.equal(f.eszkoz('SW3').vtpRevizio, e.REVIZIO);
  f.sw('SW3', 'conf t', 'vtp mode client', 'end');
  f.sw('SW1', 'conf t', `vtp domain ${e.TARTOMANY}`, `vtp password ${e.JELSZO}`, 'vtp version 2', `vlan ${e.VLAN1}`, `name ${e.NEV1}`, 'int g0/1', 'sw mo tr', 'end');
  f.sw('SW2', 'conf t', 'vtp mode transparent', 'vtp version 2', 'int range g0/1 - 2', 'sw mo tr', 'end');
  f.sw('SW3', 'conf t', 'int g0/1', 'sw mo tr', 'end');
  f.lep(5000);
  assert.ok(f.eszkoz('SW1').vlanok[e.REGI], 'a régi VLAN megjelent SW1-en');
  assert.equal(f.eszkoz('SW1').vlanok[e.VLAN1].nev, 'REGI_LABOR');
});
