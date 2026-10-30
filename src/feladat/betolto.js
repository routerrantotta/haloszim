/**
 * Feladat betöltése: a feladatfájl (feladatok/<nev>.js) adataiból felépíti a hálózatot.
 *
 * A feladatfájlok sima <script>-ként töltődnek be, és egy közös listába teszik magukat:
 *   window.HaloszimFeladatok = [ { azon: 'vlan-1', … }, … ]
 * Így új feladathoz nem kell újraépíteni a szimulátort, és file://-on is működik.
 */

import { Halozat } from '../mag/halozat.js';
import { ujSwitch2960 } from '../modell/switch.js';
import { ujPc } from '../modell/pc.js';
import { ipBeallit } from '../mag/vegpont.js';
import { vtpIdozitoIndit } from '../mag/vtp.js';

/** A betöltött feladatok listája (a feladatfájlok töltik fel). */
export function feladatLista() {
  const g = typeof window !== 'undefined' ? window : globalThis;
  return g.HaloszimFeladatok || [];
}

/** Feladat keresése azonosító szerint (ha nincs megadva: az első). */
export function feladatKeres(azon) {
  const lista = feladatLista();
  if (!azon) return lista[0] || null;
  return lista.find((f) => f.azon === azon) || null;
}

/**
 * @typedef {Object} BetoltottFeladat
 * @property {Object} feladat
 * @property {import('../mag/halozat.js').Halozat} halozat
 * @property {(nev: string) => Object} eszkoz – eszköz a feladatbeli neve szerint (akkor is, ha a
 *           tanuló átnevezte a hostname paranccsal)
 * @property {{nev: string, eszkoz: Object, x: number, y: number, tipus: string}[]} elemek
 */

/**
 * @param {Object} feladat
 * @param {{kesleltetes?: number, ora?: import('../mag/ido.js').Ora}} [beallitasok]
 * @returns {BetoltottFeladat}
 */
export function feladatBetolt(feladat, beallitasok = {}) {
  const halozat = new Halozat(beallitasok);
  const nevek = new Map();
  const elemek = [];
  for (const e of feladat.topologia.eszkozok) {
    let eszkoz;
    if (e.tipus === 'switch') eszkoz = ujSwitch2960({ hostname: e.nev });
    else if (e.tipus === 'pc') eszkoz = ujPc({ nev: e.nev });
    else throw new Error(`Ismeretlen eszköztípus: ${e.tipus}`);
    halozat.hozzaad(eszkoz);
    nevek.set(e.nev, eszkoz);
    elemek.push({ nev: e.nev, eszkoz, x: e.x, y: e.y, tipus: e.tipus });
  }
  for (const [a, pa, b, pb] of feladat.topologia.kabelek || []) {
    halozat.kabel(nevek.get(a), pa, nevek.get(b), pb);
  }
  // Kiinduló beállítások: PC-nél IP-cím; switchnél gépnév, VTP, VLAN-ok.
  //   { PC1: { ip, maszk }, SW3: { vtp: { mod, tartomany, jelszo, verzio, revizio }, vlanok: { 10: 'NEV' } } }
  for (const [nev, beall] of Object.entries(feladat.kiindulo || {})) {
    const eszkoz = nevek.get(nev);
    if (eszkoz.tipus === 'pc') {
      ipBeallit(eszkoz, beall);
      continue;
    }
    if (beall.hostname) eszkoz.hostname = beall.hostname;
    const v = beall.vtp || {};
    if (v.mod) eszkoz.vtpMod = v.mod;
    if (v.tartomany) eszkoz.vtpTartomany = v.tartomany;
    if (v.jelszo) eszkoz.vtpJelszo = v.jelszo;
    if (v.verzio) eszkoz.vtpVerzio = v.verzio;
    if (v.revizio) eszkoz.vtpRevizio = v.revizio;
    for (const [szam, vnev] of Object.entries(beall.vlanok || {})) {
      eszkoz.vlanok[szam] = { nev: vnev, gyari: false, tamogatott: true };
    }
  }
  vtpIdozitoIndit(halozat);
  return {
    feladat,
    halozat,
    elemek,
    eszkoz: (nev) => {
      const e = nevek.get(nev);
      if (!e) throw new Error(`Nincs ilyen eszköz a feladatban: ${nev}`);
      return e;
    },
  };
}
