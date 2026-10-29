/**
 * Szimulált óra és naplóidőbélyeg.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ora, naploIdobelyeg } from '../src/mag/ido.js';

test('az események időrendben és a beütemezés sorrendjében futnak', () => {
  const ora = new Ora();
  const naplo = [];
  ora.utemez(200, () => naplo.push('b'));
  ora.utemez(100, () => naplo.push('a'));
  ora.utemez(200, () => naplo.push('c'));
  ora.lep(150);
  assert.deepEqual(naplo, ['a']);
  assert.equal(ora.ido, 150);
  ora.lep(100);
  assert.deepEqual(naplo, ['a', 'b', 'c']);
});

test('lemondott esemény nem fut le; esemény újat ütemezhet', () => {
  const ora = new Ora();
  const naplo = [];
  const e = ora.utemez(10, () => naplo.push('x'));
  ora.lemond(e);
  ora.utemez(10, () => ora.utemez(10, () => naplo.push('lanc')));
  ora.lep(50);
  assert.deepEqual(naplo, ['lanc']);
});

test('naplóidőbélyeg: *Mar  1 hh:mm:ss.mmm', () => {
  assert.equal(naploIdobelyeg(0), '*Mar  1 00:00:00.000');
  assert.equal(naploIdobelyeg(3723045), '*Mar  1 01:02:03.045');
  assert.equal(naploIdobelyeg(86400000 * 9 + 1000), '*Mar 10 00:00:01.000');
});
