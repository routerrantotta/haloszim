/**
 * Belépési pont: ebből készül a dist/szimulator.js.
 *
 * Használat egy oldalon:
 *   <link rel="stylesheet" href="dist/szimulator.css">
 *   <div id="hsz"></div>
 *   <script src="dist/szimulator.js"></script>
 *   <script src="feladatok/vlan-1.js"></script>
 *   <script>Haloszim.indit(document.getElementById('hsz'), { feladat: 'vlan-1' });</script>
 *
 * A feladat az URL-ben is megadható: ?feladat=vlan-1. Ha nincs betöltött feladat,
 * egyetlen switch-csel indul (szabad gyakorlás).
 */

import { Ora } from './mag/ido.js';
import { Munkamenet } from './cli/terminal-munkamenet.js';
import { ios } from './gyartok/ios/index.js';
import { Terminal } from './nezet/terminal.js';
import { Topologia } from './nezet/topologia.js';
import { PcAblak } from './nezet/pc-ablak.js';
import { FeladatPanel } from './nezet/panel.js';
import { feladatKeres, feladatBetolt } from './feladat/betolto.js';

/* global __VERZIO__ */
export const VERZIO = typeof __VERZIO__ !== 'undefined' ? __VERZIO__ : 'fejlesztői';

/** A hibajelentő oldal (a weboldal ötletküldője). */
const HIBAJELENTO = 'https://routerrantotta.hu/otlet.html';

/** Ennyi ms alatt ér át egy keret egy kábelen (az animáció sebessége). */
const ANIM_KESLELTETES = 260;

/** Feladat nélkül: egyetlen switch, szabad gyakorlás. */
const SZABAD = {
  azon: 'szabad',
  cim: 'Szabad gyakorlás',
  topologia: { meret: { szel: 400, mag: 120 }, eszkozok: [{ nev: 'Switch', tipus: 'switch', x: 44, y: 34 }], kabelek: [] },
  celok: [],
};

function elem(tag, osztaly, szoveg) {
  const e = document.createElement(tag);
  if (osztaly) e.className = osztaly;
  if (szoveg !== undefined) e.textContent = szoveg;
  return e;
}

/**
 * Elindítja a szimulátort a megadott elemben.
 * @param {HTMLElement} gyoker
 * @param {{feladat?: string}} [beallitasok]
 */
export function indit(gyoker, beallitasok = {}) {
  gyoker.classList.add('hsz');
  gyoker.textContent = '';

  let azon = beallitasok.feladat;
  try {
    azon = new URLSearchParams(window.location.search).get('feladat') || azon;
  } catch (e) {
    // nincs URL (pl. teszt): marad a megadott
  }
  const feladat = feladatKeres(azon) || SZABAD;

  // A szimulált óra a valódi idővel együtt halad (később gyorsítható, megállítható).
  const ora = new Ora();
  let elozo = performance.now();
  setInterval(() => {
    const most = performance.now();
    ora.lep(most - elozo);
    elozo = most;
  }, 20);

  const f = feladatBetolt(feladat, { ora, kesleltetes: ANIM_KESLELTETES });
  const { halozat } = f;

  const kisKepernyo = elem('p', 'hsz-kiskepernyo', 'Tipp: nagyobb képernyőn kényelmesebb a gyakorlás.');
  const felso = elem('div', feladat.celok.length ? 'hsz-felso' : 'hsz-felso hsz-felso--egy');
  const munka = elem('section', 'hsz-munka');
  munka.setAttribute('aria-label', 'Az eszközök kezelése');
  gyoker.append(kisKepernyo, felso, munka);

  let valasztott = null;
  const topologia = new Topologia(felso, { elemek: f.elemek, halozat, meret: feladat.topologia.meret }, {
    valaszt: (e) => valaszt(e, true),
  });
  if (feladat.celok.length) new FeladatPanel(felso, f);

  // „Hibás a kimenet? Jelezd!” – az utolsó parancsot is átadja az ötletküldőnek.
  const jelzo = elem('a', 'hsz-jelzo', 'Hibás a kimenet? Jelezd!');
  jelzo.target = '_blank';
  jelzo.rel = 'noopener';
  const jelzoFrissit = (parancs) => {
    const p = new URLSearchParams({ oldal: 'szimulator/index.html' });
    if (parancs) p.set('parancs', parancs.slice(0, 200));
    jelzo.href = `${HIBAJELENTO}?${p}`;
  };
  jelzoFrissit('');

  // Fülek: melyik eszközt kezeljük (a topológián kattintva is lehet választani).
  const fulek = elem('div', 'hsz-fulek');
  fulek.setAttribute('role', 'tablist');
  fulek.setAttribute('aria-label', 'Eszközök');
  const nezetHely = elem('div', 'hsz-nezetek');
  munka.append(fulek, nezetHely);

  /** eszköz → { ful, doboz, terminal, mutat(bool), cimFrissit() } */
  const nezetek = new Map();
  const frissitMind = () => {
    topologia.frissit();
    for (const n of nezetek.values()) n.cimFrissit();
  };

  for (const { eszkoz, tipus } of f.elemek) {
    const ful = elem('button', 'hsz-ful');
    ful.type = 'button';
    ful.setAttribute('role', 'tab');
    ful.addEventListener('click', () => valaszt(eszkoz, true));
    fulek.append(ful);

    let n;
    if (tipus === 'switch') {
      const doboz = elem('div', 'hsz-nezet');
      const munkamenet = new Munkamenet({ szemelyiseg: ios, eszkoz, ora });
      const terminal = new Terminal(doboz, munkamenet, { parancsUtan: jelzoFrissit });
      munkamenet.figyel(frissitMind);
      nezetHely.append(doboz);
      n = {
        doboz,
        terminal,
        munkamenet,
        mutat: (l) => { doboz.hidden = !l; },
        cimFrissit: () => {
          terminal.cim(`${eszkoz.hostname} – konzol`);
          ful.textContent = eszkoz.hostname;
        },
      };
    } else {
      const ablak = new PcAblak(nezetHely, { eszkoz, halozat, valtozott: frissitMind });
      n = {
        doboz: ablak.doboz,
        terminal: ablak.terminal,
        munkamenet: ablak.munkamenet,
        mutat: (l) => ablak.mutat(l),
        cimFrissit: () => { ful.textContent = eszkoz.hostname; },
      };
      ablak.munkamenet.figyel(frissitMind);
    }
    n.ful = ful;
    n.cimFrissit();
    n.mutat(false);
    nezetek.set(eszkoz, n);
  }

  // Az eszközök konzolüzenetei (pl. %LINK-3-UPDOWN) a saját konzoljukra kerülnek.
  halozat.figyel((e) => {
    if (e.tipus === 'naplo' && nezetek.has(e.eszkoz)) nezetek.get(e.eszkoz).terminal.aszinkronSor(e.sor);
  });

  function valaszt(eszkoz, fokusz) {
    valasztott = eszkoz;
    for (const [e, n] of nezetek) {
      n.mutat(e === eszkoz);
      n.ful.setAttribute('aria-selected', String(e === eszkoz));
      n.ful.classList.toggle('hsz-ful--aktiv', e === eszkoz);
    }
    topologia.kijelol(eszkoz);
    if (fokusz) nezetek.get(eszkoz).terminal.fokusz();
  }
  valaszt(f.elemek[0].eszkoz, false);

  const lab = elem('div', 'hsz-lab');
  const verzio = elem('span', '', `IOS-szerű parancssor · Haloszim v${VERZIO.replace(/\.0$/, '')}`);
  lab.append(verzio, jelzo);
  gyoker.append(lab);

  const elso = nezetek.get(f.elemek[0].eszkoz);
  return {
    feladat: f,
    halozat,
    ora,
    valaszt,
    nezetek,
    get valasztott() { return valasztott; },
    // Visszafelé kompatibilis mezők (az első eszköz):
    eszkoz: f.elemek[0].eszkoz,
    munkamenet: elso.munkamenet,
    terminal: elso.terminal,
  };
}

if (typeof window !== 'undefined') {
  window.Haloszim = { indit, verzio: VERZIO };
}
