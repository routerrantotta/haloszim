/**
 * Véletlen adatok a feladatokhoz.
 *
 * A feladatfájl a „valtozok” mezőben szabályokat ad meg, a szövegekben és adatokban pedig
 * helyőrzők állnak: {VLAN1}, {NEV1} … Egy „mag” (szám) alapján ebből egy konkrét változat
 * készül: ugyanaz a mag mindig ugyanazt adja (így a tanár egy ?mag=… linkkel ugyanazt a
 * változatot adhatja az egész osztálynak). Mag nélkül (oktató mód) az alapértékek érvényesek.
 *
 * Szabálytípusok:
 *   { tipus: 'szam',  alap: 10, min: 2, max: 254, kulonbozik: ['VLAN2'] }
 *   { tipus: 'lista', alap: 'IRODA', lista: ['IRODA', 'RAKTAR', …], kulonbozik: ['NEV2'] }
 *   { tipus: 'jelszo', alap: 'Rantotta2026', lista: ['Rantotta', 'Titok', …] }  → szó + 2–4 számjegy
 * A „kulonbozik” a korábban már kisorsolt változókra vonatkozik (azoktól eltérő érték kell).
 *
 * Helyőrzők:
 *   {X}     – az érték
 *   {X|es}  – szám -s képzővel: 10-es, 20-as, 5-ös
 *   {X|a}   – névelővel: a 10, az 5
 *   {X|aes} – névelővel és képzővel: a 10-es, az 5-ös (mondat elején: {X|Aes})
 * Ha egy szöveg CSAK egy számot adó helyőrzőből áll (pl. "{VLAN1}"), az eredmény szám lesz.
 */

import { esRag, nevelo } from '../magyar.js';

/** Mulberry32: kicsi, gyors, determinisztikus álvéletlen-generátor (0 ≤ x < 1). */
export function generator(mag) {
  let a = (Number(mag) >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Új, véletlen mag (1–99999). */
export function ujMag() {
  return 1 + Math.floor(Math.random() * 99999);
}

/** Érvényes mag-e (pozitív egész, legfeljebb 9 jegy). */
export function ervenyesMag(m) {
  return /^\d{1,9}$/.test(String(m)) && Number(m) > 0;
}

/**
 * A változók értékei. mag === null → az alapértékek.
 * @param {Object<string, Object>} valtozok
 * @param {number|null} mag
 * @returns {Object<string, string|number>}
 */
export function ertekek(valtozok = {}, mag = null) {
  const e = {};
  const r = mag === null ? null : generator(mag);
  for (const [nev, sz] of Object.entries(valtozok)) {
    if (!r) {
      e[nev] = sz.alap;
      continue;
    }
    const tilos = (sz.kulonbozik || []).map((n) => e[n]);
    let ertek;
    for (let proba = 0; proba < 200; proba++) {
      ertek = sorsol(sz, r);
      if (!tilos.includes(ertek)) break;
    }
    if (tilos.includes(ertek)) throw new Error(`Nem sikerült különböző értéket sorsolni: ${nev}`);
    e[nev] = ertek;
  }
  return e;
}

function sorsol(sz, r) {
  if (sz.tipus === 'szam') return sz.min + Math.floor(r() * (sz.max - sz.min + 1));
  if (sz.tipus === 'lista') return sz.lista[Math.floor(r() * sz.lista.length)];
  if (sz.tipus === 'jelszo') {
    const szo = sz.lista[Math.floor(r() * sz.lista.length)];
    const jegyek = 2 + Math.floor(r() * 3);
    let szam = '';
    for (let i = 0; i < jegyek; i++) szam += Math.floor(r() * 10);
    return szo + szam;
  }
  throw new Error(`Ismeretlen változótípus: ${sz.tipus}`);
}

const HELYORZO = /\{([A-Z][A-Z0-9_]*)(?:\|(es|a|aes|Aes))?\}/g;
const CSAK_HELYORZO = /^\{([A-Z][A-Z0-9_]*)\}$/;

/** Egy szöveg helyőrzőinek cseréje. */
export function behelyettesit(szoveg, e) {
  const csak = CSAK_HELYORZO.exec(szoveg);
  if (csak && typeof e[csak[1]] === 'number') return e[csak[1]];
  return szoveg.replace(HELYORZO, (teljes, nev, mod) => {
    if (!(nev in e)) return teljes;
    const v = e[nev];
    if (!mod) return String(v);
    if (mod === 'es') return esRag(v);
    if (mod === 'a') return `${nevelo(v)} ${v}`;
    const t = `${nevelo(v)} ${esRag(v)}`;
    return mod === 'Aes' ? t[0].toUpperCase() + t.slice(1) : t;
  });
}

function bejar(x, e) {
  if (typeof x === 'string') return behelyettesit(x, e);
  if (Array.isArray(x)) return x.map((y) => bejar(y, e));
  if (x && typeof x === 'object') {
    const uj = {};
    for (const [k, v] of Object.entries(x)) uj[behelyettesit(k, e)] = bejar(v, e);
    return uj;
  }
  return x;
}

/**
 * A feladat egy konkrét változata (új objektum; az eredeti feladatfájl nem változik).
 * @param {Object} feladat
 * @param {number|null} mag – null: alapértékek (oktató mód)
 * @returns {Object} – a változat, plusz: mag, ertekek, eredeti (a feladatfájl objektuma)
 */
export function feladatValtozat(feladat, mag = null) {
  const e = ertekek(feladat.valtozok, mag);
  const { valtozok, ...tobbi } = feladat;
  const v = bejar(tobbi, e);
  v.mag = mag;
  v.ertekek = e;
  v.eredeti = feladat;
  void valtozok;
  return v;
}
