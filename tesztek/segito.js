/**
 * Közös segédfüggvények a tesztekhez: egy friss switch + munkamenet, és parancsfuttatás.
 */
import { Munkamenet } from '../src/cli/terminal-munkamenet.js';
import { ios } from '../src/gyartok/ios/index.js';
import { ujSwitch2960 } from '../src/modell/switch.js';
import { Ora } from '../src/mag/ido.js';

/** Új, gyári állapotú switch és munkamenet (felhasználói módban). */
export function ujMunkamenet() {
  const eszkoz = ujSwitch2960();
  const ora = new Ora();
  return new Munkamenet({ szemelyiseg: ios, eszkoz, ora });
}

/**
 * Lefuttat egy vagy több parancsot, és visszaadja az UTOLSÓ kimenetét szövegsorokként
 * (a várakozásokat kihagyva).
 */
export function fut(mm, ...sorok) {
  let kimenet = [];
  for (const s of sorok) kimenet = mm.bevitel(s).kimenet;
  return kimenet.filter((e) => typeof e === 'string');
}

/** Ugyanaz, de privilegizált módból indul. */
export function privbol(...sorok) {
  const mm = ujMunkamenet();
  fut(mm, 'enable');
  return { mm, kimenet: fut(mm, ...sorok) };
}

/** Konfigurációs módból indul. */
export function konfigbol(...sorok) {
  const mm = ujMunkamenet();
  fut(mm, 'enable', 'configure terminal');
  return { mm, kimenet: sorok.length ? fut(mm, ...sorok) : [] };
}
