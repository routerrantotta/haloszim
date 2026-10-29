/**
 * Parancssor-értelmező (gyártófüggetlen „motor”).
 *
 * A parancsokat ADATKÉNT kapja meg (lásd gyartok/ios/parancsok/*.js), és ezekből
 * módonként egy fát épít. Egy beírt sort szavanként halad végig a fán:
 *   - kulcsszavak: elég az egyértelmű előtag („conf t” = „configure terminal”),
 *   - paraméterek: szám tartománnyal, szó, interfésznév, interfész-tartomány.
 *
 * Három dolgot tud:
 *   illeszt()   – egy teljes sort értelmez → melyik parancs, milyen értékekkel (vagy mi a hiba)
 *   sugo()      – a ? súgóhoz: mi írható az adott helyre
 *   kiegeszit() – a Tab-hoz: egy elkezdett szó befejezése
 *
 * A hibák itt még „nyers” formában vannak (pl. { hiba: 'ervenytelen', oszlop: 7 });
 * a gyártóra jellemző szöveget a gyártói réteg készíti belőlük.
 */

import { interfeszElemez, tartomanyElemez, tipusIllesztes } from './interfesznev.js';

// ---------------------------------------------------------------------------
// Szavakra bontás
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} Token
 * @property {string} szoveg – a szó, ahogy beírták
 * @property {number} kezdet – hányadik karakternél kezdődik a sorban (0-tól)
 */

/**
 * A sort szavakra bontja (szóköz/tabulátor mentén), a szavak helyével együtt.
 * @param {string} sor
 * @returns {Token[]}
 */
export function szavakra(sor) {
  const tokenek = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(sor)) !== null) tokenek.push({ szoveg: m[0], kezdet: m.index });
  return tokenek;
}

// ---------------------------------------------------------------------------
// Paramétertípusok
// ---------------------------------------------------------------------------

/**
 * Minden paramétertípus ugyanazt a néhány dolgot tudja:
 *   illeszt         – elfogadja-e a szó(ka)t ezen a helyen
 *   sugoElemek      – mit mutasson a ? súgó ezen a helyen (név + magyarázat)
 *   reszleges       – egy elkezdett szóhoz illő lehetőségek (a „szó?” súgóhoz)
 *   kiegeszit       – Tab: mire egészítse ki az elkezdett szót (vagy null)
 *   maradekot       – ha igaz, a sor teljes maradékát egyben kapja (interface range)
 */
const PARAM_TIPUSOK = {
  /** Egész szám egy tartományban, pl. <1-4094> */
  szam: {
    nev: (e) => e.nev || `<${e.min}-${e.max}>`,
    illeszt(e, tokenek, i) {
      const t = tokenek[i];
      if (!/^\d+$/.test(t.szoveg)) return { ok: false, hiba: 'ervenytelen', oszlop: t.kezdet };
      const n = Number(t.szoveg);
      if (n < e.min || n > e.max) return { ok: false, hiba: 'ervenytelen', oszlop: t.kezdet };
      return { ok: true, ertek: n, kovetkezo: i + 1 };
    },
    sugoElemek: (e) => [{ nev: PARAM_TIPUSOK.szam.nev(e), sugo: e.sugo }],
    reszleges: (e, r) => (/^\d+$/.test(r) ? [PARAM_TIPUSOK.szam.nev(e)] : []),
    kiegeszit: () => null,
  },

  /** Egyetlen szó (szóköz nélkül), pl. gépnév, VLAN-név */
  szo: {
    nev: (e) => e.nev || 'WORD',
    illeszt(e, tokenek, i) {
      const t = tokenek[i];
      if (e.maxHossz && t.szoveg.length > e.maxHossz) {
        return { ok: false, hiba: 'ervenytelen', oszlop: t.kezdet + e.maxHossz };
      }
      return { ok: true, ertek: t.szoveg, kovetkezo: i + 1 };
    },
    sugoElemek: (e) => [{ nev: PARAM_TIPUSOK.szo.nev(e), sugo: e.sugo }],
    reszleges: (e) => [PARAM_TIPUSOK.szo.nev(e)],
    kiegeszit: () => null,
  },

  /** Egy interfész, pl. fa0/1 vagy „FastEthernet 0/1” (egy vagy két szó) */
  interfesz: {
    illeszt(e, tokenek, i, sor, kornyezet) {
      const r = interfeszElemez(tokenek, i, kornyezet.portTipusok || {});
      if (!r.ok) return r;
      return { ok: true, ertek: r.nev, kovetkezo: r.kovetkezo };
    },
    sugoElemek: (e, kornyezet) => tipusSugo(e, kornyezet),
    reszleges: (e, r, kornyezet) => interfeszReszleges(r, kornyezet),
    kiegeszit: (e, r, kornyezet) => interfeszKiegeszit(r, kornyezet),
  },

  /** Interfész-tartomány: az interface range utáni teljes szöveg */
  'interfesz-tartomany': {
    maradekot: true,
    illeszt(e, tokenek, i, sor, kornyezet) {
      const kezdet = tokenek[i].kezdet;
      const r = tartomanyElemez(sor.slice(kezdet), kezdet, kornyezet.portTipusok || {});
      if (!r.ok) return r;
      return { ok: true, ertek: r.nevek, kovetkezo: tokenek.length };
    },
    sugoElemek: (e, kornyezet) => tipusSugo(e, kornyezet),
    reszleges: (e, r, kornyezet) => interfeszReszleges(r, kornyezet),
    kiegeszit: (e, r, kornyezet) => interfeszKiegeszit(r, kornyezet),
  },
};

/** A porttípusok listája a súgóhoz (pl. „FastEthernet  FastEthernet (100 Mbit/s) port”). */
function tipusSugo(e, kornyezet) {
  const tipusok = Object.keys(kornyezet.portTipusok || {});
  const leirasok = (kornyezet.tipusLeirasok || {});
  return tipusok.map((t) => ({ nev: t, sugo: leirasok[t] || t }));
}

/** „szó?” súgó interfésznévhez: típusnév-előtag vagy már elkezdett szám. */
function interfeszReszleges(r, kornyezet) {
  const tipusok = kornyezet.portTipusok || {};
  const m = /^([a-zA-Z-]+)(.*)$/.exec(r);
  if (!m) return [];
  if (m[2] === '') return tipusIllesztes(m[1], tipusok).jeloltek;
  const ill = tipusIllesztes(m[1], tipusok);
  if (!ill.tipus) return [];
  return szamReszleges(m[2], tipusok[ill.tipus]);
}

/** Egy elkezdett portszámhoz („0”, „0/”, „0/1”) illő következő rész a súgóban. */
function szamReszleges(szam, letezok) {
  const reszek = szam.split('/');
  const melyikResz = reszek.length - 1;
  const elotag = reszek.slice(0, -1).join('/');
  const illok = letezok.filter((s) => s.startsWith(elotag ? elotag + '/' : ''));
  if (illok.length === 0) return [];
  const ertekek = [...new Set(illok.map((s) => Number(s.split('/')[melyikResz])))].sort((a, b) => a - b);
  const utolso = reszek[melyikResz];
  if (utolso !== '' && !ertekek.some((v) => String(v).startsWith(utolso))) return [];
  const teljes = utolso !== '' && ertekek.includes(Number(utolso));
  const vanMeg = illok.some((s) => s.split('/').length > melyikResz + 1);
  if (teljes && vanMeg) return ['/'];
  return [`<${ertekek[0]}-${ertekek[ertekek.length - 1]}>`];
}

/** Tab interfésznévhez: csak a típusnév egészíthető ki (pl. „fa” → „FastEthernet”). */
function interfeszKiegeszit(r, kornyezet) {
  if (!/^[a-zA-Z-]+$/.test(r)) return null;
  const ill = tipusIllesztes(r, kornyezet.portTipusok || {});
  return ill.tipus || null;
}

// ---------------------------------------------------------------------------
// Fa építése a parancsleírásokból
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} Csomopont
 * @property {{elem: Object, csomopont: Csomopont}[]} kulcsszavak
 * @property {{elem: Object, csomopont: Csomopont}[]} parameterek
 * @property {Object|null} parancs – ha itt véget érhet a parancs, az ide tartozó leírás
 * @property {string|null} tovabb  – ha itt egy másik mód parancsai folytatódnak (pl. „do”)
 */

function ujCsomopont() {
  return { kulcsszavak: [], parameterek: [], parancs: null, tovabb: null };
}

function azonosParam(a, b) {
  return a.param === b.param && a.kulcs === b.kulcs && a.min === b.min && a.max === b.max;
}

/**
 * Módonként egy fát épít a parancsleírásokból.
 * @param {Object[]} parancsok – a gyártói réteg parancslistája
 * @returns {Object<string, Csomopont>} mód neve → a fa gyökere
 */
export function faEpites(parancsok) {
  /** @type {Object<string, Csomopont>} */
  const fak = {};
  for (const parancs of parancsok) {
    for (const mod of parancs.modok) {
      let cs = (fak[mod] = fak[mod] || ujCsomopont());
      for (const elem of parancs.szavak) {
        if (elem.tovabb) {
          cs.tovabb = elem.tovabb;
          break;
        }
        if (elem.szo) {
          let gy = cs.kulcsszavak.find((k) => k.elem.szo.toLowerCase() === elem.szo.toLowerCase());
          if (!gy) cs.kulcsszavak.push((gy = { elem, csomopont: ujCsomopont() }));
          cs = gy.csomopont;
        } else if (elem.param) {
          if (!PARAM_TIPUSOK[elem.param]) throw new Error(`Ismeretlen paramétertípus: ${elem.param}`);
          let gy = cs.parameterek.find((p) => azonosParam(p.elem, elem));
          if (!gy) cs.parameterek.push((gy = { elem, csomopont: ujCsomopont() }));
          cs = gy.csomopont;
        } else {
          throw new Error('Hibás parancsleírás: ' + JSON.stringify(elem));
        }
      }
      if (!parancs.szavak.some((e) => e.tovabb)) {
        if (cs.parancs) {
          throw new Error(`Kétszer van leírva ugyanaz a parancs (${mod}): ${parancs.szavak.map((e) => e.szo || e.param).join(' ')}`);
        }
        cs.parancs = parancs;
      }
    }
  }
  return fak;
}

// ---------------------------------------------------------------------------
// Bejárás (közös az illesztéshez, a súgóhoz és a Tab-hoz)
// ---------------------------------------------------------------------------

/**
 * Egy kulcsszó-előtaghoz illő gyerekek. Pontos egyezés esetén csak az az egy.
 */
function kulcsszoJeloltek(cs, szoveg) {
  const kis = szoveg.toLowerCase();
  const pontos = cs.kulcsszavak.find((k) => k.elem.szo.toLowerCase() === kis);
  if (pontos) return [pontos];
  return cs.kulcsszavak.filter((k) => k.elem.szo.toLowerCase().startsWith(kis));
}

/**
 * Végigmegy a szavakon a fában. Megáll, ha elfogytak a szavak, vagy hiba van.
 * @returns {{ok: boolean, cs?: Csomopont, mod: string, ertekek: Object, hiba?: string, oszlop?: number,
 *            tokenIndex?: number, gyokerKezdet: number, maradekParam?: Object, maradekIndex?: number}}
 */
function bejar(fak, mod, tokenek, sor, kornyezet, { megallMaradeknal = false } = {}) {
  let aktMod = mod;
  let cs = fak[aktMod];
  let gyokerKezdet = 0;
  const ertekek = {};
  if (!cs) return { ok: false, hiba: 'ervenytelen', oszlop: tokenek[0] ? tokenek[0].kezdet : 0, tokenIndex: 0, mod, ertekek, gyokerKezdet };
  let i = 0;
  while (i < tokenek.length) {
    // A „még nincs meg” jelölésű parancs a sor többi részét nem vizsgálja.
    if (cs.parancs && cs.parancs.nincsMeg) break;
    if (cs.tovabb) {
      aktMod = cs.tovabb;
      cs = fak[aktMod];
      gyokerKezdet = i;
      continue;
    }
    const t = tokenek[i];
    const jeloltek = kulcsszoJeloltek(cs, t.szoveg);
    if (jeloltek.length === 1) {
      cs = jeloltek[0].csomopont;
      i++;
      continue;
    }
    if (jeloltek.length > 1) {
      return { ok: false, hiba: 'ketertelmu', tokenIndex: i, mod: aktMod, ertekek, gyokerKezdet };
    }
    // Nincs illő kulcsszó → paraméterek
    let illett = false;
    let legjobbHiba = null;
    for (const p of cs.parameterek) {
      const tipus = PARAM_TIPUSOK[p.elem.param];
      if (megallMaradeknal && tipus.maradekot) {
        return { ok: true, cs, mod: aktMod, ertekek, gyokerKezdet, maradekParam: p, maradekIndex: i };
      }
      const r = tipus.illeszt(p.elem, tokenek, i, sor, kornyezet);
      if (r.ok) {
        ertekek[p.elem.kulcs] = r.ertek;
        cs = p.csomopont;
        i = r.kovetkezo;
        illett = true;
        break;
      }
      // Több paraméter közül a „legbeszédesebb” hibát tartjuk meg: a hiányos/kétértelmű
      // többet mond, mint az érvénytelen; két érvénytelen közül a későbbi helyen lévő.
      if (!legjobbHiba) legjobbHiba = r;
      else if (legjobbHiba.hiba === 'ervenytelen' && (r.hiba !== 'ervenytelen' || r.oszlop > legjobbHiba.oszlop)) legjobbHiba = r;
    }
    if (illett) continue;
    if (legjobbHiba) {
      return { ok: false, hiba: legjobbHiba.hiba, oszlop: legjobbHiba.oszlop, tokenIndex: i, mod: aktMod, ertekek, gyokerKezdet,
        felbeHagyott: legjobbHiba.hiba === 'hianyos' };
    }
    return { ok: false, hiba: 'ervenytelen', oszlop: t.kezdet, tokenIndex: i, mod: aktMod, ertekek, gyokerKezdet };
  }
  return { ok: true, cs, mod: aktMod, ertekek, gyokerKezdet, tokenIndex: i };
}

// ---------------------------------------------------------------------------
// Nyilvános műveletek
// ---------------------------------------------------------------------------

/**
 * Egy teljes sor értelmezése.
 * @param {Object<string, Csomopont>} fak
 * @param {string} mod – az aktuális mód
 * @param {string} sor
 * @param {Object} kornyezet – az eszköz adatai (pl. portTipusok)
 * @returns {{ok: true, parancs: Object, ertekek: Object, mod: string}
 *         | {ok: false, hiba: 'ervenytelen'|'ketertelmu'|'hianyos', oszlop?: number, tokenIndex: number,
 *            gyokerKezdet: number, mod: string, tokenek: Token[]}}
 */
export function illeszt(fak, mod, sor, kornyezet = {}) {
  const tokenek = szavakra(sor);
  const b = bejar(fak, mod, tokenek, sor, kornyezet);
  if (!b.ok) return { ...b, tokenek };
  if (b.cs.tovabb || !b.cs.parancs) {
    return { ok: false, hiba: 'hianyos', tokenIndex: tokenek.length, gyokerKezdet: b.gyokerKezdet, mod: b.mod, tokenek };
  }
  return { ok: true, parancs: b.cs.parancs, ertekek: b.ertekek, mod: b.mod, tokenek };
}

/**
 * A ? súgó: a sor végén álló ? előtti szöveg alapján.
 *  - „show ?”  (szóköz a ? előtt) → a következő helyre írható összes lehetőség magyarázattal
 *  - „sh?”     (nincs szóköz)     → az elkezdett szóhoz illő szavak
 * @param {Object<string, Csomopont>} fak
 * @param {string} mod
 * @param {string} sor – a ? NÉLKÜL
 * @param {Object} kornyezet
 * @returns {{ok: true, fajta: 'lista', elemek: {nev: string, sugo: string}[], cr: boolean, gyoker: boolean}
 *         | {ok: true, fajta: 'szavak', szavak: string[]}
 *         | {ok: false, hiba: string, oszlop?: number, tokenIndex: number, gyokerKezdet: number, tokenek: Token[]}}
 */
export function sugo(fak, mod, sor, kornyezet = {}) {
  const tokenek = szavakra(sor);
  const reszleges = sor === '' || /\s$/.test(sor) ? '' : tokenek.pop().szoveg;
  const b = bejar(fak, mod, tokenek, sor, kornyezet, { megallMaradeknal: true });

  if (!b.ok) {
    // Két szóból álló interfésznév közepén vagyunk: „interface fastEthernet ?”
    if (b.felbeHagyott && reszleges === '') {
      return interfeszSzamSugo(tokenek, b, kornyezet) || { ...b, tokenek };
    }
    if (b.felbeHagyott && reszleges !== '') {
      const t = tokenek[b.tokenIndex];
      const ill = tipusIllesztes(t.szoveg, kornyezet.portTipusok || {});
      if (ill.tipus) {
        const szavak = szamReszleges(reszleges, kornyezet.portTipusok[ill.tipus]);
        if (szavak.length) return { ok: true, fajta: 'szavak', szavak };
      }
    }
    return { ...b, tokenek };
  }

  // Az interface range maradéka: egyszerűsített súgó
  if (b.maradekParam) {
    return tartomanySugo(b, tokenek, reszleges, sor, kornyezet);
  }

  let cs = b.cs;
  if (cs.tovabb) cs = fak[cs.tovabb];

  // Még meg nem írt parancs: a súgó csak ennyit tud mondani róla.
  if (tokenek.length > 0 && cs.parancs && cs.parancs.nincsMeg) {
    return { ok: true, fajta: 'lista', elemek: [{ nev: '<cr>', sugo: cs.parancs.szavak[0].sugo }], cr: false, gyoker: false };
  }

  if (reszleges === '') {
    const elemek = [];
    for (const p of cs.parameterek) elemek.push(...PARAM_TIPUSOK[p.elem.param].sugoElemek(p.elem, kornyezet));
    const kulcsok = cs.kulcsszavak.map((k) => ({ nev: k.elem.szo, sugo: k.elem.sugo || '' }));
    kulcsok.sort((a, b2) => a.nev.localeCompare(b2.nev, 'en'));
    elemek.push(...kulcsok);
    return { ok: true, fajta: 'lista', elemek, cr: !!cs.parancs, gyoker: tokenek.length === 0 };
  }

  // „sh?” – az összes kulcsszó, ami így kezdődik (itt a pontos egyezés sem zárja ki a többit),
  // plusz a paraméterek, amelyek elfogadhatják az elkezdett szót.
  const kis = reszleges.toLowerCase();
  const szavak = cs.kulcsszavak.filter((k) => k.elem.szo.toLowerCase().startsWith(kis)).map((k) => k.elem.szo);
  szavak.sort((a, c) => a.localeCompare(c, 'en'));
  for (const p of cs.parameterek) szavak.push(...PARAM_TIPUSOK[p.elem.param].reszleges(p.elem, reszleges, kornyezet));
  if (szavak.length === 0) {
    return { ok: false, hiba: 'ismeretlen', tokenIndex: tokenek.length, gyokerKezdet: b.gyokerKezdet, tokenek };
  }
  return { ok: true, fajta: 'szavak', szavak: [...new Set(szavak)] };
}

/** „interface FastEthernet ?” → a portszám súgója (pl. <0-0>). */
function interfeszSzamSugo(tokenek, b, kornyezet) {
  const t = tokenek[b.tokenIndex];
  if (!t) return null;
  const ill = tipusIllesztes(t.szoveg, kornyezet.portTipusok || {});
  if (!ill.tipus) return null;
  const letezok = kornyezet.portTipusok[ill.tipus];
  const elsok = [...new Set(letezok.map((s) => Number(s.split('/')[0])))].sort((a, c) => a - c);
  return {
    ok: true,
    fajta: 'lista',
    elemek: [{ nev: `<${elsok[0]}-${elsok[elsok.length - 1]}>`, sugo: `${ill.tipus}-port száma (modul/port)` }],
    cr: false,
    gyoker: false,
  };
}

/** Súgó az interface range sor maradékához. */
function tartomanySugo(b, tokenek, reszleges, sor, kornyezet) {
  const p = b.maradekParam;
  const tipus = PARAM_TIPUSOK[p.elem.param];
  const eddigiTokenek = tokenek.slice(b.maradekIndex);
  if (eddigiTokenek.length === 0) {
    if (reszleges === '') return { ok: true, fajta: 'lista', elemek: tipus.sugoElemek(p.elem, kornyezet), cr: false, gyoker: false };
    const szavak = tipus.reszleges(p.elem, reszleges, kornyezet);
    if (szavak.length) return { ok: true, fajta: 'szavak', szavak };
    return { ok: false, hiba: 'ismeretlen', tokenIndex: tokenek.length, gyokerKezdet: b.gyokerKezdet, tokenek };
  }
  const kezdet = eddigiTokenek[0].kezdet;
  const vizsgalt = reszleges === '' ? sor : sor.slice(0, sor.length - reszleges.length);
  const szoveg = vizsgalt.slice(kezdet).trimEnd();
  if (reszleges === '') {
    if (/[-,]$/.test(szoveg)) {
      return { ok: true, fajta: 'lista', elemek: /-$/.test(szoveg) ? [{ nev: '<1-24>', sugo: 'A tartomány utolsó portja' }] : tipus.sugoElemek(p.elem, kornyezet), cr: false, gyoker: false };
    }
    const r = tartomanyElemez(szoveg, kezdet, kornyezet.portTipusok || {});
    if (!r.ok) return { ok: false, hiba: r.hiba, oszlop: r.oszlop, tokenIndex: tokenek.length, gyokerKezdet: b.gyokerKezdet, tokenek };
    return {
      ok: true,
      fajta: 'lista',
      elemek: [
        { nev: '-', sugo: 'Tartomány: az első és az utolsó port között mindegyik' },
        { nev: ',', sugo: 'Újabb port vagy tartomány hozzáadása a listához' },
      ],
      cr: true,
      gyoker: false,
    };
  }
  return { ok: true, fajta: 'szavak', szavak: tipus.reszleges(p.elem, reszleges, kornyezet) };
}

/**
 * Tab-kiegészítés: ha az utolsó (elkezdett) szó egyértelmű, kiegészíti.
 * @returns {string|null} – az új sor, vagy null, ha nincs mit kiegészíteni
 */
export function kiegeszit(fak, mod, sor, kornyezet = {}) {
  if (sor === '' || /\s$/.test(sor)) return null;
  const tokenek = szavakra(sor);
  const utolso = tokenek.pop();
  const b = bejar(fak, mod, tokenek, sor, kornyezet, { megallMaradeknal: true });
  if (!b.ok) return null;
  const eleje = sor.slice(0, utolso.kezdet);
  if (b.maradekParam) {
    const t = PARAM_TIPUSOK[b.maradekParam.elem.param].kiegeszit(b.maradekParam.elem, utolso.szoveg, kornyezet);
    return t ? eleje + t : null;
  }
  let cs = b.cs;
  if (cs.tovabb) cs = fak[cs.tovabb];
  const jeloltek = kulcsszoJeloltek(cs, utolso.szoveg);
  if (jeloltek.length === 1) return eleje + jeloltek[0].elem.szo + ' ';
  if (jeloltek.length > 1) return null;
  for (const p of cs.parameterek) {
    const t = PARAM_TIPUSOK[p.elem.param].kiegeszit(p.elem, utolso.szoveg, kornyezet);
    if (t) return eleje + t;
  }
  return null;
}
