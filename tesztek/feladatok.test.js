/**
 * A feladatfájlok formai ellenőrzése: a vizsga és a gyakorló mód csak akkor működik jól,
 * ha a célok szövege tényleg parancs nélküli, és minden teendőnek van parancsa és tippje.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import './segito.js';
import { feladatLista, feladatBetolt } from '../src/feladat/betolto.js';
import { lepesAlak, idoSzoveg, MODOK } from '../src/nezet/panel.js';

const CELTIPUSOK = ['vlan', 'vlan-nincs', 'access-port', 'trunk', 'pc-ip', 'vtp', 'vtp-szinkron', 'ping', 'szoras'];

for (const fd of feladatLista()) {
  test(`${fd.azon}: a teendők céljai és a leírás parancs nélküliek (vizsga mód)`, () => {
    for (const b of fd.leiras) assert.ok(!b.includes('`'), `leírás: ${b}`);
    for (const l of fd.lepesek.map(lepesAlak)) {
      assert.ok(l.cel.length > 10, 'van cél');
      assert.ok(!l.cel.includes('`'), `a cél ne tartalmazzon parancsot: ${l.cel}`);
      assert.ok(l.parancsok.length > 0, `van parancs (oktató mód): ${l.cel}`);
      assert.ok(l.tippek.length > 0, `van tipp (gyakorló mód): ${l.cel}`);
    }
  });

  test(`${fd.azon}: típus, magyarázat, ismert céltípusok, betölthető`, () => {
    assert.ok(fd.tipus);
    assert.ok(fd.magyarazat && fd.magyarazat.length >= 3);
    for (const c of fd.celok) {
      assert.ok(CELTIPUSOK.includes(c.tipus), c.tipus);
      assert.ok(c.szoveg, 'minden célnak van szövege');
    }
    const f = feladatBetolt(fd);
    for (const e of fd.topologia.eszkozok) assert.ok(f.eszkoz(e.nev));
  });
}

test('régi formájú (szöveges) teendő is használható', () => {
  assert.deepEqual(lepesAlak('Csináld meg'), { cel: 'Csináld meg', parancsok: '', tippek: [] });
});

test('időkijelzés és módok', () => {
  assert.equal(idoSzoveg(0), '00:00');
  assert.equal(idoSzoveg(65999), '01:05');
  assert.equal(idoSzoveg(3723000), '1:02:03');
  assert.deepEqual(Object.keys(MODOK), ['oktato', 'gyakorlo', 'vizsga']);
});
