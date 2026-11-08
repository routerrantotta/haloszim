/**
 * Gyártóválasztó: az eszköz gyártója szerint a megfelelő parancssori munkamenet.
 *   - Cisco (alapértelmezett): IOS-szerű parancssor (cli/terminal-munkamenet.js + gyartok/ios)
 *   - MikroTik: RouterOS-szerű parancssor (gyartok/routeros)
 */

import { Munkamenet } from '../cli/terminal-munkamenet.js';
import { szemelyiseg } from './ios/index.js';
import { RouterOsMunkamenet } from './routeros/munkamenet.js';

/** A gyártók neve a választóban (csak szövegként – logó, ikon nincs). */
export const GYARTOK = {
  cisco: { nev: 'Cisco', felirat: 'IOS-szerű parancssor' },
  mikrotik: { nev: 'MikroTik', felirat: 'RouterOS-szerű parancssor' },
};

/** Az eszköz gyártója ('cisco' vagy 'mikrotik'). */
export function gyartoja(eszkoz) {
  return (eszkoz && eszkoz.gyarto) || 'cisco';
}

/**
 * Új parancssori munkamenet az eszközhöz.
 * @param {Object} eszkoz
 * @param {import('../mag/ido.js').Ora} ora
 * @param {Object} [kapcsolat] – MikroTiknél: { mod: 'ssh', honnan: PC, ip } (hálózati kezelés), alapból konzol
 */
export function munkamenetKeszit(eszkoz, ora, kapcsolat) {
  if (gyartoja(eszkoz) === 'mikrotik') return new RouterOsMunkamenet({ eszkoz, ora, kapcsolat });
  return new Munkamenet({ szemelyiseg: szemelyiseg(eszkoz), eszkoz, ora });
}
