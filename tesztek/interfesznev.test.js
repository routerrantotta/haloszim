/**
 * Interfésznevek és tartományok értelmezése.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interfeszElemez, tartomanyElemez } from '../src/cli/interfesznev.js';
import { szavakra } from '../src/cli/ertelmezo.js';
import { portTipusok, ujSwitch2960 } from '../src/modell/switch.js';

const T = portTipusok(ujSwitch2960());
const egy = (s) => interfeszElemez(szavakra(s), 0, T);

test('egy interfész sokféle alakban', () => {
  for (const s of ['f0/1', 'fa0/1', 'FastEthernet0/1', 'fastEthernet 0/1', 'FA 0/1', 'fa0/01']) {
    const r = egy(s);
    assert.ok(r.ok, s);
    assert.equal(r.nev, 'FastEthernet0/1', s);
  }
  for (const s of ['g0/1', 'gi0/1', 'GigabitEthernet0/1', 'gigabitethernet 0/1']) {
    assert.equal(egy(s).nev, 'GigabitEthernet0/1', s);
  }
});

test('hibás interfésznevek', () => {
  assert.equal(egy('fa0/25').hiba, 'ervenytelen');
  assert.equal(egy('gi0/3').hiba, 'ervenytelen');
  assert.equal(egy('xy0/1').hiba, 'ervenytelen');
  assert.equal(egy('fa').hiba, 'hianyos');
  assert.equal(egy('fa0').hiba, 'hianyos');
  assert.equal(egy('fa0/x').hiba, 'ervenytelen');
});

test('tartományok', () => {
  const t = (s) => tartomanyElemez(s, 0, T);
  assert.deepEqual(t('fa0/1 - 4').nevek, ['FastEthernet0/1', 'FastEthernet0/2', 'FastEthernet0/3', 'FastEthernet0/4']);
  assert.deepEqual(t('fa0/1-4').nevek, t('fa0/1 - 4').nevek);
  assert.deepEqual(t('f0/1-2,f0/10').nevek, ['FastEthernet0/1', 'FastEthernet0/2', 'FastEthernet0/10']);
  assert.deepEqual(t('fa0/1 - 2 , gi0/1 - 2').nevek, ['FastEthernet0/1', 'FastEthernet0/2', 'GigabitEthernet0/1', 'GigabitEthernet0/2']);
  assert.deepEqual(t('fastEthernet 0/3').nevek, ['FastEthernet0/3']);
});

test('hibás tartományok', () => {
  const t = (s) => tartomanyElemez(s, 0, T);
  assert.equal(t('fa0/1 - 30').hiba, 'ervenytelen');
  assert.equal(t('fa0/4 - 1').hiba, 'ervenytelen');
  assert.equal(t('fa0/1 -').hiba, 'hianyos');
  assert.equal(t('fa0/1,').hiba, 'hianyos');
  assert.equal(t('xx0/1').hiba, 'ervenytelen');
});
