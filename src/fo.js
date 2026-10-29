/**
 * Belépési pont: ebből készül a dist/szimulator.js.
 *
 * Használat egy oldalon:
 *   <link rel="stylesheet" href="dist/szimulator.css">
 *   <div id="hsz"></div>
 *   <script src="dist/szimulator.js"></script>
 *   <script>Haloszim.indit(document.getElementById('hsz'));</script>
 */

import { Ora } from './mag/ido.js';
import { ujSwitch2960 } from './modell/switch.js';
import { Munkamenet } from './cli/terminal-munkamenet.js';
import { ios } from './gyartok/ios/index.js';
import { Terminal } from './nezet/terminal.js';
import { Topologia } from './nezet/topologia.js';

/* global __VERZIO__ */
export const VERZIO = typeof __VERZIO__ !== 'undefined' ? __VERZIO__ : 'fejlesztői';

/** A hibajelentő oldal (a weboldal ötletküldője). */
const HIBAJELENTO = 'https://routerrantotta.hu/otlet.html';

/**
 * Elindítja a szimulátort a megadott elemben.
 * @param {HTMLElement} gyoker
 * @returns {{eszkoz: Object, munkamenet: Munkamenet, ora: Ora}}
 */
export function indit(gyoker) {
  gyoker.classList.add('hsz');
  gyoker.textContent = '';

  // A szimulált óra a valódi idővel együtt halad (később gyorsítható, megállítható).
  const ora = new Ora();
  let elozo = Date.now();
  setInterval(() => {
    const most = Date.now();
    ora.lep(most - elozo);
    elozo = most;
  }, 100);

  const eszkoz = ujSwitch2960();
  const munkamenet = new Munkamenet({ szemelyiseg: ios, eszkoz, ora });

  const kisKepernyo = document.createElement('p');
  kisKepernyo.className = 'hsz-kiskepernyo';
  kisKepernyo.textContent = 'Tipp: nagyobb képernyőn kényelmesebb a gyakorlás.';

  const racs = document.createElement('div');
  racs.className = 'hsz-racs';
  gyoker.append(kisKepernyo, racs);

  let terminal;
  const topologia = new Topologia(racs, [{ eszkoz, x: 60, y: 30 }], {
    kattintas: () => terminal.fokusz(),
  });

  // „Hibás a kimenet? Jelezd!” – az utolsó parancsot is átadja az ötletküldőnek.
  const jelzo = document.createElement('a');
  jelzo.className = 'hsz-jelzo';
  jelzo.target = '_blank';
  jelzo.rel = 'noopener';
  jelzo.textContent = 'Hibás a kimenet? Jelezd!';
  const jelzoFrissit = (parancs) => {
    const p = new URLSearchParams({ oldal: 'szimulator/index.html' });
    if (parancs) p.set('parancs', parancs.slice(0, 200));
    jelzo.href = `${HIBAJELENTO}?${p}`;
  };
  jelzoFrissit('');

  terminal = new Terminal(racs, munkamenet, { parancsUtan: jelzoFrissit });
  terminal.cim(`${eszkoz.hostname}\u00a0– konzol`);
  munkamenet.figyel(() => {
    topologia.frissit();
    terminal.cim(`${eszkoz.hostname}\u00a0– konzol`);
  });

  const lab = document.createElement('div');
  lab.className = 'hsz-lab';
  const verzio = document.createElement('span');
  verzio.textContent = `IOS-szerű parancssor · Haloszim v${VERZIO.replace(/\.0$/, '')}`;
  lab.append(verzio, jelzo);
  gyoker.append(lab);

  return { eszkoz, munkamenet, ora, terminal };
}

if (typeof window !== 'undefined') {
  window.Haloszim = { indit, verzio: VERZIO };
}
