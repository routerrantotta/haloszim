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
 *
 * Ha több feladat van betöltve, felül egy választó jelenik meg: feladattípus (pl. VLAN) és
 * azon belül a feladat, valamint „Újrakezdés” gomb. Váltáskor a régi hálózat leáll, és az
 * új feladat ugyanebben az elemben indul.
 */

import { Ora } from './mag/ido.js';
import { Munkamenet } from './cli/terminal-munkamenet.js';
import { ios } from './gyartok/ios/index.js';
import { Terminal } from './nezet/terminal.js';
import { Topologia } from './nezet/topologia.js';
import { PcAblak } from './nezet/pc-ablak.js';
import { FeladatPanel, MODOK } from './nezet/panel.js';
import { feladatKeres, feladatBetolt, feladatLista } from './feladat/betolto.js';
import { feladatValtozat, ujMag, ervenyesMag } from './feladat/veletlen.js';

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

/** Egy feladat típusa a választóban (ha a feladatfájl nem adja meg: „Egyéb”). */
function tipusa(f) {
  return f.tipus || 'Egyéb';
}

/**
 * Elindítja a szimulátort a megadott elemben.
 * @param {HTMLElement} gyoker
 * @param {{feladat?: string, mod?: 'oktato'|'gyakorlo'|'vizsga', mag?: number}} [beallitasok]
 */
export function indit(gyoker, beallitasok = {}) {
  gyoker.classList.add('hsz');
  gyoker.textContent = '';

  let azon = beallitasok.feladat;
  let mod = beallitasok.mod;
  let kezdoMag = beallitasok.mag;
  try {
    const p = new URLSearchParams(window.location.search);
    azon = p.get('feladat') || azon;
    mod = p.get('mod') || mod;
    if (p.get('mag')) kezdoMag = p.get('mag');
  } catch (e) {
    // nincs URL (pl. teszt): marad a megadott
  }
  kezdoMag = ervenyesMag(kezdoMag) ? Number(kezdoMag) : null;
  if (!MODOK[mod]) mod = 'oktato';

  const kisKepernyo = elem('p', 'hsz-kiskepernyo', 'Tipp: nagyobb képernyőn kényelmesebb a gyakorlás.');
  const tartalom = elem('div', 'hsz-tartalom');
  gyoker.append(kisKepernyo);

  const lista = feladatLista();
  let aktualis = null;
  let fut = null;

  let mag = null;
  /** A változat linkje (a tanár ezzel adhatja ugyanazt a változatot mindenkinek). */
  const valtozatLink = () => {
    try {
      const url = new URL(window.location.href);
      if (aktualis && aktualis.azon !== 'szabad') url.searchParams.set('feladat', aktualis.azon);
      url.searchParams.set('mod', mod);
      if (mag !== null) url.searchParams.set('mag', String(mag));
      else url.searchParams.delete('mag');
      return url.toString();
    } catch (e) {
      return '';
    }
  };

  /**
   * Egy feladat (újra)indítása; a régi hálózat leáll.
   * Oktató módban az alapadatokkal, a többiben véletlen adatokkal (ujMagErtek: undefined = új sorsolás,
   * szám = az a változat).
   */
  const betolt = (feladat, ujMod = mod, ujMagErtek) => {
    if (fut) fut.leallit();
    tartalom.textContent = '';
    aktualis = feladat;
    mod = ujMod;
    if (mod === 'oktato' || !feladat.valtozok) mag = null;
    else mag = ujMagErtek !== undefined && ujMagErtek !== null ? ujMagErtek : ujMag();
    fut = feladatInditas(tartalom, feladatValtozat(feladat, mag), mod, valtozatLink);
    if (valaszto) valaszto.igazit(feladat, mod);
    try {
      window.history.replaceState(null, '', valtozatLink());
    } catch (e) {
      // file:// alatt egyes böngészők nem engedik – nem baj, csak az URL nem frissül
    }
  };

  /** Ha már dolgozott a tanuló, váltás előtt rákérdezünk. */
  const mehet = (kerdes) => !fut || !fut.piszkos || window.confirm(kerdes);
  const valaszto = lista.length ? feladatValaszto(lista, {
    feladat: (f) => {
      if (!mehet('Másik feladatra váltasz? Az eddigi beállítások elvesznek.')) return false;
      betolt(f);
      return true;
    },
    mod: (m) => {
      if (m === mod) return true;
      if (!mehet(`${MODOK[m].nev} módra váltasz? A feladat újraindul, az eddigi beállítások elvesznek.`)) return false;
      betolt(aktualis, m);
      return true;
    },
    ujra: () => {
      if (!mehet('Biztosan újrakezded? Minden eddigi beállítás elvész.')) return;
      betolt(aktualis, mod, mag);
    },
    ujValtozat: () => {
      if (!mehet('Új változatot kérsz (más számokkal és nevekkel)? Az eddigi beállítások elvesznek.')) return;
      betolt(aktualis, mod);
    },
  }) : null;
  if (valaszto) gyoker.append(valaszto.doboz);
  gyoker.append(tartalom);
  betolt(feladatKeres(azon) || SZABAD, mod, kezdoMag);

  return {
    /** Feladat betöltése azonosító szerint. */
    betolt: (az) => {
      const f = feladatKeres(az);
      if (f) betolt(f);
    },
    get mod() { return mod; },
    get mag() { return mag; },
    /** Mód váltása (a feladat újraindul). */
    modValt: (m, ujM) => {
      if (MODOK[m]) betolt(aktualis, m, ujM);
    },
    get panel() { return fut.panel; },
    get feladat() { return fut.feladat; },
    get halozat() { return fut.halozat; },
    get ora() { return fut.ora; },
    get nezetek() { return fut.nezetek; },
    get eszkoz() { return fut.eszkoz; },
    get munkamenet() { return fut.munkamenet; },
    get terminal() { return fut.terminal; },
    valaszt: (e, fokusz) => fut.valaszt(e, fokusz),
  };
}

/**
 * A feladatválasztó: két legördülő (típus, feladat), a mód (Oktató / Gyakorló / Vizsga) és
 * Újrakezdés gomb. A visszahívások false-t adnak, ha a tanuló mégsem akart váltani.
 * @param {Object[]} lista
 * @param {{feladat: (f: Object) => boolean, mod: (m: string) => boolean, ujra: () => void, ujValtozat: () => void}} h
 */
function feladatValaszto(lista, h) {
  const doboz = elem('div', 'hsz-valaszto');
  doboz.setAttribute('role', 'group');
  doboz.setAttribute('aria-label', 'Feladat és mód választása');
  const mezo = (felirat) => {
    const l = elem('label', 'hsz-valaszto__mezo');
    const sel = elem('select');
    l.append(elem('span', '', felirat), sel);
    doboz.append(l);
    return sel;
  };
  const tipusSel = mezo('Feladattípus');
  const feladatSel = mezo('Feladat');

  // Mód: három gomb egy csoportban (egyszerre egy van lenyomva).
  const modMezo = elem('div', 'hsz-valaszto__mezo');
  const modCim = elem('span', '', 'Mód');
  modCim.id = `hsz-mod-${Math.random().toString(36).slice(2, 8)}`;
  const modGombok = elem('div', 'hsz-modok');
  modGombok.setAttribute('role', 'group');
  modGombok.setAttribute('aria-labelledby', modCim.id);
  const gombok = {};
  for (const [kulcs, m] of Object.entries(MODOK)) {
    const g = elem('button', 'hsz-modgomb', m.nev);
    g.type = 'button';
    g.title = m.leiras;
    g.addEventListener('click', () => h.mod(kulcs));
    gombok[kulcs] = g;
    modGombok.append(g);
  }
  modMezo.append(modCim, modGombok);
  doboz.append(modMezo);

  const ujraGomb = elem('button', 'hsz-gomb hsz-gomb--masodlagos', 'Újrakezdés');
  ujraGomb.type = 'button';
  ujraGomb.title = 'A feladat újraindítása az elejéről (minden beállítás elvész)';
  ujraGomb.addEventListener('click', () => h.ujra());
  const ujValtGomb = elem('button', 'hsz-gomb hsz-gomb--masodlagos', 'Új változat');
  ujValtGomb.type = 'button';
  ujValtGomb.title = 'Ugyanez a feladat más véletlen adatokkal (VLAN-számok, nevek, címek)';
  ujValtGomb.addEventListener('click', () => h.ujValtozat());
  doboz.append(ujraGomb, ujValtGomb);

  const tipusok = [...new Set(lista.map(tipusa))];
  for (const t of tipusok) tipusSel.append(new Option(t, t));

  const feladatokTolt = (tipus) => {
    feladatSel.textContent = '';
    for (const f of lista.filter((x) => tipusa(x) === tipus)) {
      feladatSel.append(new Option(f.szint ? `${f.cim} (${f.szint})` : f.cim, f.azon));
    }
  };
  let jelenlegi = null;
  const visszaallit = () => {
    if (jelenlegi) {
      tipusSel.value = tipusa(jelenlegi);
      feladatokTolt(tipusa(jelenlegi));
      feladatSel.value = jelenlegi.azon;
    }
  };
  tipusSel.addEventListener('change', () => {
    feladatokTolt(tipusSel.value);
    if (!h.feladat(lista.find((x) => x.azon === feladatSel.value))) visszaallit();
  });
  feladatSel.addEventListener('change', () => {
    if (!h.feladat(lista.find((x) => x.azon === feladatSel.value))) visszaallit();
  });

  return {
    doboz,
    /** A választó beállítása az éppen futó feladatra és módra. */
    igazit(f, mod) {
      for (const [kulcs, g] of Object.entries(gombok)) {
        g.setAttribute('aria-pressed', String(kulcs === mod));
        g.classList.toggle('hsz-modgomb--aktiv', kulcs === mod);
      }
      ujValtGomb.hidden = mod === 'oktato' || !f.valtozok;
      if (!lista.includes(f)) return;
      jelenlegi = f;
      visszaallit();
    },
  };
}

/**
 * Egy feladat felépítése a megadott elemben (topológia, panel, eszközök, lábléc).
 * @returns {Object} – a futó feladat adatai és egy leallit() függvény
 */
function feladatInditas(gyoker, feladat, mod, valtozatLink) {
  // A szimulált óra a valódi idővel együtt halad (később gyorsítható, megállítható).
  const ora = new Ora();
  let elozo = performance.now();
  const idozito = setInterval(() => {
    const most = performance.now();
    ora.lep(most - elozo);
    elozo = most;
  }, 20);

  const f = feladatBetolt(feladat, { ora, kesleltetes: ANIM_KESLELTETES });
  const { halozat } = f;

  // Széles rajz (pl. három switch egy sorban): a rajz a teljes szélességet kapja, a panel alá kerül.
  const szeles = feladat.topologia.meret && feladat.topologia.meret.szel > 900;
  const felso = elem('div', `hsz-felso${!feladat.celok.length || szeles ? ' hsz-felso--egy' : ''}`);
  const munka = elem('section', 'hsz-munka');
  munka.setAttribute('aria-label', 'Az eszközök kezelése');
  gyoker.append(felso, munka);

  let valasztott = null;
  const topologia = new Topologia(felso, { elemek: f.elemek, halozat, meret: feladat.topologia.meret }, {
    valaszt: (e) => valaszt(e, true),
  });
  const panel = feladat.celok.length ? new FeladatPanel(felso, f, { mod, valtozatLink }) : null;
  /** Dolgozott-e már a tanuló (beírt parancsot, beállított IP-t) – váltás előtt ezért kérdezünk. */
  let piszkos = false;

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
    piszkos = true;
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
    /** A feladat leállítása (az óra megáll, a hálózat eseményei elnémulnak). */
    panel,
    get piszkos() { return piszkos; },
    leallit() {
      clearInterval(idozito);
      if (panel) panel.leallit();
      halozat.figyelok = [];
    },
  };
}

if (typeof window !== 'undefined') {
  window.Haloszim = { indit, verzio: VERZIO };
}
