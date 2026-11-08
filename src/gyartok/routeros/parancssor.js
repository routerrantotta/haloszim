/**
 * A RouterOS-szerű parancssor értelmezője.
 *
 * Egy sor felépítése:  [menüútvonal] [parancs] [paraméterek]
 *   menüútvonal:  /interface bridge port   vagy   /interface/bridge/port   vagy (a mostani menühöz
 *                 képest) bridge port;  „..” = egy szinttel feljebb, „/” = a főmenü
 *   parancs:      add, set, remove, print, enable, disable, export (és a főmenüben: ping)
 *   paraméterek:  név=érték párok (pl. pvid=10), és a „set”/„remove” után az elem megnevezése:
 *                 sorszám (a print szerint: 0, 1 …), név (pl. ether1), vagy [find interface=ether1]
 *
 * Minden szó rövidíthető, amíg egyértelmű (/int br po pr = /interface bridge port print).
 * Ha a sorban nincs parancs, csak útvonal, akkor abba a menübe lépünk (a prompt megváltozik).
 *
 * A hibaüzenetek formája a valódi eszközét követi (pl. „bad command name x (line 1 column 6)”);
 * forrásaik a docs/forrasok.md-ben.
 */

import { MENUFA } from './menuk.js';
import { vlanListaElemez, interfeszKeres, hidKeres } from '../../modell/mikrotik.js';
import { ipSzam, ipSzoveg } from '../../mag/ip.js';
import { tablaKiir, reszletesKiir, exportKiir, identityKiir, pingFolyamat } from './kimenetek.js';

// ---------------------------------------------------------------------------
// Szavakra bontás
// ---------------------------------------------------------------------------

/**
 * A sort szavakra bontja. A [ … ] egyetlen szó (pl. [find interface=ether1]); az idézőjelek
 * között szóköz is lehet (comment="Első emelet").
 * @returns {{szoveg: string, kezdet: number}[]}
 */
export function tokenekre(sor) {
  const t = [];
  let i = 0;
  while (i < sor.length) {
    if (/\s/.test(sor[i])) {
      i++;
      continue;
    }
    const kezdet = i;
    let melyseg = 0;
    let idezet = false;
    while (i < sor.length) {
      const c = sor[i];
      if (idezet) {
        if (c === '"') idezet = false;
      } else if (c === '"') idezet = true;
      else if (c === '[') melyseg++;
      else if (c === ']') melyseg = Math.max(0, melyseg - 1);
      else if (/\s/.test(c) && melyseg === 0) break;
      i++;
    }
    t.push({ szoveg: sor.slice(kezdet, i), kezdet });
  }
  return t;
}

/** Az idézőjelek levétele egy értékről. */
function idezetNelkul(s) {
  return s.length >= 2 && s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s;
}

/** Érték kiírása (export): szóköz vagy különleges karakter esetén idézőjelben. */
export function ertekIr(v) {
  const s = String(v);
  return s === '' || /[\s"$;\\[\]=]/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s;
}

// ---------------------------------------------------------------------------
// Parancsok
// ---------------------------------------------------------------------------

const PARANCS_SUGO = {
  add: 'Új elem létrehozása',
  set: 'Elem(ek) beállításainak módosítása',
  remove: 'Elem(ek) törlése',
  print: 'Az elemek listázása (print detail: minden beállítással)',
  enable: 'Elem(ek) engedélyezése',
  disable: 'Elem(ek) letiltása',
  export: 'A beállítások kiírása parancsként (ebből a menüből és az almenükből)',
  ping: 'Ping egy IP-címre (a switch saját címéről)',
};

/** Egy menüben elérhető parancsok. */
export function parancsok(menu) {
  if (menu === MENUFA) return ['export', 'ping'];
  const a = menu.adat;
  if (!a) return ['export'];
  if (!a.lista) return ['export', 'print', 'set'];
  if (a.csakOlvas) return ['print'];
  if (a.nincsAdd) return ['disable', 'enable', 'export', 'print', 'set'];
  return ['add', 'disable', 'enable', 'export', 'print', 'remove', 'set'];
}

/** A parancs elfogad-e elem-megnevezést (numbers) első paraméterként. */
function elemesParancs(parancs, menu) {
  return menu.adat && menu.adat.lista && ['set', 'remove', 'enable', 'disable'].includes(parancs);
}

/** A parancs név=érték paraméterei. */
function nevesParameterek(parancs, menu) {
  if (parancs === 'ping') return [{ nev: 'count', tipus: 'szam', min: 1, max: 100, sugo: 'Hány pinget küldjön (alapból 4)' }];
  if (parancs !== 'add' && parancs !== 'set') return [];
  return (menu.adat.tulajdonsagok || []).filter((t) => !t.csakOlvas);
}

/** Pozícionális (név nélküli) szavak, amelyeket a parancs elfogad. */
function pozicios(parancs) {
  if (parancs === 'print') return ['detail'];
  return [];
}

// ---------------------------------------------------------------------------
// Útvonal
// ---------------------------------------------------------------------------

/** Egy szó illesztése a menü almenüire és parancsaira (egyértelmű előtag is elég). */
function szoIllesztes(menu, szo, csakMenu = false) {
  const lehetosegek = [
    ...menu.almenuk.map((a) => ({ fajta: 'menu', nev: a.nev, menu: a })),
    ...(csakMenu ? [] : parancsok(menu).map((p) => ({ fajta: 'parancs', nev: p }))),
  ];
  const pontos = lehetosegek.filter((l) => l.nev === szo);
  if (pontos.length) return { ok: true, ...pontos.find((l) => l.fajta === 'menu') || pontos[0] };
  const elotag = lehetosegek.filter((l) => l.nev.startsWith(szo));
  if (elotag.length === 1) return { ok: true, ...elotag[0] };
  return { ok: false, tobb: elotag.length > 1, lehetosegek: elotag };
}

/**
 * A sor elejéről az útvonal és a parancs.
 * @returns {{ok: true, menu, parancs: string|null, maradek: Object[]}|{ok: false, hiba: string}}
 */
export function utvonal(tokenek, kezdoMenu) {
  let menu = kezdoMenu;
  let i = 0;
  for (; i < tokenek.length; i++) {
    const t = tokenek[i];
    if (t.szoveg.includes('=') || t.szoveg.startsWith('[')) break;
    let resz = t.szoveg;
    let eltolas = 0;
    if (resz.startsWith('/')) {
      menu = MENUFA;
      resz = resz.slice(1);
      eltolas = 1;
    }
    const szavak = resz.split('/');
    for (let j = 0; j < szavak.length; j++) {
      const szo = szavak[j];
      const oszlop = t.kezdet + eltolas + 1;
      eltolas += szo.length + 1;
      if (szo === '') continue;
      if (szo === '..') {
        menu = menu.szulo || MENUFA;
        continue;
      }
      const r = szoIllesztes(menu, szo);
      if (!r.ok) return { ok: false, hiba: `${r.tobb ? 'ambiguous' : 'bad'} command name ${szo} (line 1 column ${oszlop})` };
      if (r.fajta === 'menu') {
        menu = r.menu;
        continue;
      }
      // Parancs: a szó maradéka (pl. /interface/bridge/print/x) már nem lehet útvonal.
      if (j < szavak.length - 1) return { ok: false, hiba: `expected end of command (line 1 column ${oszlop + szo.length})` };
      return { ok: true, menu, parancs: r.nev, maradek: tokenek.slice(i + 1) };
    }
  }
  if (i < tokenek.length) return { ok: false, hiba: `expected end of command (line 1 column ${tokenek[i].kezdet + 1})` };
  return { ok: true, menu, parancs: null, maradek: [] };
}

// ---------------------------------------------------------------------------
// Értékek
// ---------------------------------------------------------------------------

/**
 * Egy tulajdonság értékének ellenőrzése és átalakítása.
 * @returns {{ok: true, ertek: any}|{ok: false, hiba: string}}
 */
export function ertekElemez(t, nyers, sw) {
  const v = idezetNelkul(nyers);
  const nincs = { ok: false, hiba: `input does not match any value of ${t.nev}` };
  switch (t.tipus) {
    case 'nev':
      return v === '' ? { ok: false, hiba: `invalid value for argument ${t.nev}` } : { ok: true, ertek: v };
    case 'szoveg':
      return { ok: true, ertek: v };
    case 'bool':
      if (v === 'yes') return { ok: true, ertek: true };
      if (v === 'no') return { ok: true, ertek: false };
      return nincs;
    case 'szam': {
      if (!/^\d+$/.test(v)) return { ok: false, hiba: `invalid value for argument ${t.nev}` };
      const n = Number(v);
      if (n < t.min || n > t.max) return { ok: false, hiba: `value of ${t.nev} out of range (${t.min}..${t.max})` };
      return { ok: true, ertek: n };
    }
    case 'enum':
      return t.ertekek.includes(v) ? { ok: true, ertek: v } : nincs;
    case 'hid':
      return hidKeres(sw, v) ? { ok: true, ertek: v } : nincs;
    case 'interfesz': {
      const i = interfeszKeres(sw, v);
      return i && (!t.fajtak || t.fajtak.includes(i.fajta)) ? { ok: true, ertek: v } : nincs;
    }
    case 'interfeszLista': {
      if (v === '') return { ok: true, ertek: [] };
      const nevek = v.split(',');
      for (const n of nevek) {
        const i = interfeszKeres(sw, n);
        if (!i || (t.fajtak && !t.fajtak.includes(i.fajta))) return nincs;
      }
      return { ok: true, ertek: [...new Set(nevek)] };
    }
    case 'vlanLista': {
      if (!/^[\d,-]+$/.test(v) || v === '') return { ok: false, hiba: `invalid value for argument ${t.nev}` };
      const l = vlanListaElemez(v);
      if (!l) return { ok: false, hiba: `value of ${t.nev} out of range (1..4094)` };
      return { ok: true, ertek: v };
    }
    case 'cim': {
      const m = /^(\d+\.\d+\.\d+\.\d+)(?:\/(\d{1,2}))?$/.exec(v);
      const n = m && ipSzam(m[1]);
      const hossz = m && m[2] !== undefined ? Number(m[2]) : 32;
      if (n === null || !m || hossz > 32) return { ok: false, hiba: `invalid value for argument ${t.nev}` };
      return { ok: true, ertek: { cim: ipSzoveg(n), hossz } };
    }
    default:
      return nincs;
  }
}

/** Egy tulajdonság olvasása egy elemből (kiírható szövegként). */
export function olvas(t, e, sw) {
  const raw = t.olvas ? t.olvas(e, sw) : e[t.mezo];
  if (t.tipus === 'bool') return raw ? 'yes' : 'no';
  if (Array.isArray(raw)) return raw.join(',');
  return raw === undefined || raw === null ? '' : String(raw);
}

/** Egy tulajdonság írása egy elembe. */
function ir(t, e, ertek, sw) {
  if (t.ir) t.ir(e, ertek, sw);
  else e[t.mezo] = ertek;
}

/** A név=érték szó szétbontása. */
function nevErtek(szoveg) {
  const h = szoveg.indexOf('=');
  return { nev: szoveg.slice(0, h), ertek: szoveg.slice(h + 1) };
}

/** Paraméternév illesztése (pontos, vagy egyértelmű előtag). */
function paramIllesztes(defs, nev) {
  const pontos = defs.find((d) => d.nev === nev);
  if (pontos) return pontos;
  const e = defs.filter((d) => d.nev.startsWith(nev));
  return e.length === 1 ? e[0] : null;
}

// ---------------------------------------------------------------------------
// Elemek megnevezése (numbers)
// ---------------------------------------------------------------------------

/**
 * „0”, „0,2”, „ether1”, „[find interface=ether1]” → a menü elemei.
 * @returns {{ok: true, elemek: Object[]}|{ok: false, hiba: string}}
 */
export function elemekKeres(nyers, menu, sw) {
  const a = menu.adat;
  const mind = a.elemek(sw);
  const s = nyers.trim();
  if (s.startsWith('[')) {
    const belso = tokenekre(s.replace(/^\[\s*/, '').replace(/\s*\]$/, ''));
    if (!belso.length || belso[0].szoveg !== 'find') return { ok: false, hiba: 'expected end of command (line 1 column 2)' };
    let feltetelek = belso.slice(1);
    if (feltetelek.length && feltetelek[0].szoveg === 'where') feltetelek = feltetelek.slice(1);
    let talalt = mind;
    for (const f of feltetelek) {
      if (!f.szoveg.includes('=')) return { ok: false, hiba: 'expected end of command' };
      const { nev, ertek } = nevErtek(f.szoveg);
      const t = a.tulajdonsagok.find((x) => x.nev === nev);
      if (!t) return { ok: false, hiba: 'expected end of command' };
      const keresett = idezetNelkul(ertek);
      talalt = talalt.filter((e) => olvas(t, e, sw) === keresett);
    }
    return { ok: true, elemek: talalt };
  }
  const ki = [];
  for (const resz of s.split(',')) {
    let e = null;
    if (/^\d+$/.test(resz)) e = mind[Number(resz)];
    else if (a.nevMezo) {
      const t = a.tulajdonsagok.find((x) => x.nev === a.nevMezo);
      e = mind.find((x) => olvas(t, x, sw) === idezetNelkul(resz));
    }
    if (!e) return { ok: false, hiba: 'no such item' };
    if (!ki.includes(e)) ki.push(e);
  }
  return { ok: true, elemek: ki };
}

// ---------------------------------------------------------------------------
// Végrehajtás
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} Eredmeny
 * @property {Array} kimenet
 * @property {boolean} [valtozott]  – módosult-e a konfiguráció
 * @property {{prompt: string, folytat: (valasz: string) => Eredmeny}} [kerdes] – a switch kérdez (pl. „numbers: ”)
 * @property {string[]} [ut]       – menüváltás: az új menü útvonala
 * @property {string} [kanonikus]  – a parancs teljes alakja (a bemutató ellenőrzéséhez)
 */

/**
 * Egy sor végrehajtása.
 * @param {string} sor
 * @param {{sw: Object, menu: Object, ora: Object}} k
 * @returns {Eredmeny}
 */
export function vegrehajt(sor, k) {
  const tokenek = tokenekre(sor);
  if (!tokenek.length) return { kimenet: [] };
  const u = utvonal(tokenek, k.menu);
  if (!u.ok) return { kimenet: [u.hiba] };
  if (!u.parancs) return { kimenet: [], ut: u.menu.ut };
  const kanonikus = `/${[...u.menu.ut, u.parancs].join(' ')}`;
  const r = parancsFuttat(u.menu, u.parancs, u.maradek, k);
  return { ...r, kanonikus };
}

function parancsFuttat(menu, parancs, tokenek, k) {
  const { sw } = k;
  const defs = nevesParameterek(parancs, menu);
  const poz = pozicios(parancs);
  const ertekek = {};
  const kulcsszavak = [];
  let numbers = null;
  let cim = null;
  for (const t of tokenek) {
    if (t.szoveg.includes('=') && !t.szoveg.startsWith('[')) {
      const { nev, ertek } = nevErtek(t.szoveg);
      const d = paramIllesztes(defs, nev);
      if (!d) return { kimenet: [`expected end of command (line 1 column ${t.kezdet + 1})`] };
      const e = ertekElemez(d, ertek, sw);
      if (!e.ok) return { kimenet: [e.hiba] };
      ertekek[d.nev] = e.ertek;
      continue;
    }
    if (elemesParancs(parancs, menu) && numbers === null) {
      numbers = t.szoveg;
      continue;
    }
    if (parancs === 'ping' && cim === null) {
      cim = t.szoveg;
      continue;
    }
    const kulcs = poz.find((p) => p === t.szoveg || p.startsWith(t.szoveg));
    if (kulcs) {
      kulcsszavak.push(kulcs);
      continue;
    }
    return { kimenet: [`expected end of command (line 1 column ${t.kezdet + 1})`] };
  }

  switch (parancs) {
    case 'print':
      if (!menu.adat.lista) return { kimenet: identityKiir(sw) };
      if (kulcsszavak.includes('detail') || menu.adat.reszletesKiiras) return { kimenet: reszletesKiir(menu.adat, sw) };
      return { kimenet: tablaKiir(menu.adat, sw) };
    case 'export':
      return { kimenet: exportKiir(sw, menu, k.ora) };
    case 'ping':
      if (cim === null) return kerdez('address: ', (v) => pingInditas(sw, v, ertekek.count));
      return pingInditas(sw, cim, ertekek.count);
    case 'add':
      return hozzaad(menu, ertekek, k);
    case 'set':
      if (!menu.adat.lista) {
        for (const [n, v] of Object.entries(ertekek)) ir(menu.adat.tulajdonsagok.find((t) => t.nev === n), sw, v, sw);
        return { kimenet: [], valtozott: true };
      }
      // falls through
    case 'remove':
    case 'enable':
    case 'disable':
      if (numbers === null) return kerdez('numbers: ', (v) => (v.trim() === '' ? { kimenet: [] } : elemMuvelet(menu, parancs, v, ertekek, k)));
      return elemMuvelet(menu, parancs, numbers, ertekek, k);
    default:
      return { kimenet: [] };
  }
}

/** A switch kérdez (a következő beírt sor a válasz). */
function kerdez(prompt, folytat) {
  return { kimenet: [], kerdes: { prompt, folytat } };
}

function pingInditas(sw, cim, db) {
  const n = ipSzam(cim);
  if (n === null) return { kimenet: ['invalid value for argument address'] };
  return { kimenet: [pingFolyamat(sw, ipSzoveg(n), db || 4)] };
}

/** add: a kötelező, de meg nem adott tulajdonságokat egyenként megkérdezi (mint a valódi eszköz). */
function hozzaad(menu, ertekek, k) {
  const a = menu.adat;
  const hianyzo = a.tulajdonsagok.find((t) => t.kotelezo && ertekek[t.nev] === undefined);
  if (hianyzo) {
    return kerdez(`${hianyzo.nev}: `, (v) => {
      if (v.trim() === '') return { kimenet: [] };
      const e = ertekElemez(hianyzo, v.trim(), k.sw);
      if (!e.ok) return { kimenet: [e.hiba] };
      return hozzaad(menu, { ...ertekek, [hianyzo.nev]: e.ertek }, k);
    });
  }
  const r = a.hozzaad(k.sw, ertekek);
  if (typeof r === 'string') return { kimenet: [r] };
  for (const [n, v] of Object.entries(ertekek)) ir(a.tulajdonsagok.find((t) => t.nev === n), r.elem, v, k.sw);
  if (a.utana) a.utana(k.sw);
  return { kimenet: [], valtozott: true };
}

/** set / remove / enable / disable a megnevezett elemeken. */
function elemMuvelet(menu, parancs, numbers, ertekek, k) {
  const { sw } = k;
  const a = menu.adat;
  const ker = elemekKeres(numbers, menu, sw);
  if (!ker.ok) return { kimenet: [ker.hiba] };
  for (const e of ker.elemek) {
    if (e._dinamikus) return { kimenet: ['failure: can not modify dynamic entry'] };
  }
  for (const e of ker.elemek) {
    if (parancs === 'remove') {
      if (a.torol) a.torol(sw, e);
      continue;
    }
    const uj = parancs === 'enable' ? { disabled: false } : parancs === 'disable' ? { disabled: true } : ertekek;
    if (a.modosit) {
      const h = a.modosit(sw, e, uj);
      if (h) return { kimenet: [h] };
    }
    for (const [n, v] of Object.entries(uj)) ir(a.tulajdonsagok.find((t) => t.nev === n), e, v, sw);
  }
  if (a.utana) a.utana(sw);
  return { kimenet: [], valtozott: true };
}

// ---------------------------------------------------------------------------
// ? súgó és Tab
// ---------------------------------------------------------------------------

/** Igazított „név -- leírás” sorok. */
function sugoSorok(cim, elemek) {
  const szel = Math.max(0, ...elemek.map((e) => e.nev.length));
  return [cim, '', ...elemek.map((e) => `${e.nev.padEnd(szel)} -- ${e.sugo}`)];
}

/** A menü tartalma a súgóhoz. */
function menuSugoElemek(menu) {
  const ki = [];
  if (menu.szulo) ki.push({ nev: '..', sugo: `vissza a(z) ${menu.szulo === MENUFA ? 'főmenübe' : `/${menu.szulo.ut.join('/')} menübe`}` });
  for (const a of menu.almenuk) ki.push({ nev: a.nev, sugo: `[menü] ${a.sugo}` });
  for (const p of parancsok(menu)) ki.push({ nev: p, sugo: PARANCS_SUGO[p] });
  return ki.sort((x, y) => (x.nev === '..' ? -1 : y.nev === '..' ? 1 : x.nev.localeCompare(y.nev)));
}

/** A lehetséges értékek egy tulajdonsághoz (súgó, Tab). */
function ertekLehetosegek(t, sw) {
  switch (t.tipus) {
    case 'bool': return [{ nev: 'yes', sugo: 'igen' }, { nev: 'no', sugo: 'nem' }];
    case 'enum': return t.ertekek.map((v) => ({ nev: v, sugo: (t.ertekSugo && t.ertekSugo[v]) || '' }));
    case 'hid': return sw.hidak.map((h) => ({ nev: h.nev, sugo: 'bridge' }));
    case 'interfesz':
    case 'interfeszLista': {
      const ifek = [...sw.portok.map((p) => ({ nev: p.nev, f: 'ether' })), ...sw.hidak.map((h) => ({ nev: h.nev, f: 'bridge' })), ...sw.vlanIfek.map((v) => ({ nev: v.nev, f: 'vlan' }))];
      return ifek.filter((i) => !t.fajtak || t.fajtak.includes(i.f)).map((i) => ({ nev: i.nev, sugo: i.f === 'ether' ? 'port' : i.f }));
    }
    default: return [];
  }
}

/** Egy paraméter helyének leírása a súgóban (érték-formátum). */
function ertekForma(t) {
  switch (t.tipus) {
    case 'szam': return `szám: ${t.min}..${t.max}`;
    case 'vlanLista': return 'VLAN-azonosító(k), pl. 10 vagy 10,20 vagy 30-35';
    case 'cim': return 'IP-cím/előtaghossz, pl. 192.168.99.2/24';
    case 'interfeszLista': return 'interfésznevek vesszővel elválasztva, pl. ether23,ether24';
    case 'nev': return 'név';
    case 'szoveg': return 'szöveg (szóközzel: idézőjelek között)';
    default: return '';
  }
}

/**
 * A ? súgó: mi írható a kurzor helyére.
 * @returns {string[]}
 */
export function sugo(sor, k) {
  const vegeUres = sor === '' || /\s$/.test(sor);
  const tokenek = tokenekre(sor);
  const utolso = vegeUres ? null : tokenek[tokenek.length - 1];
  const elozok = utolso ? tokenek.slice(0, -1) : tokenek;
  const u = utvonal(elozok, k.menu);
  if (!u.ok) return [u.hiba];

  if (!u.parancs) {
    // Menü- vagy parancsnév jön (az utolsó szó lehet félig beírt útvonal).
    let menu = u.menu;
    let resz = utolso ? utolso.szoveg : '';
    if (resz.includes('/')) {
      const r = utvonal([{ szoveg: resz.slice(0, resz.lastIndexOf('/') + 1) || '/', kezdet: 0 }], menu);
      if (!r.ok || r.parancs) return [r.ok ? '' : r.hiba];
      menu = r.menu;
      resz = resz.slice(resz.lastIndexOf('/') + 1);
    }
    const elemek = menuSugoElemek(menu).filter((e) => e.nev.startsWith(resz));
    return sugoSorok(menu === MENUFA ? 'Főmenü' : menu.sugo, elemek);
  }

  const defs = nevesParameterek(u.parancs, u.menu);
  if (utolso && utolso.szoveg.includes('=') && !utolso.szoveg.startsWith('[')) {
    const { nev, ertek } = nevErtek(utolso.szoveg);
    const d = paramIllesztes(defs, nev);
    if (!d) return [`expected end of command (line 1 column ${utolso.kezdet + 1})`];
    const l = ertekLehetosegek(d, k.sw).filter((e) => e.nev.startsWith(ertek));
    if (l.length) return sugoSorok(`${d.nev} -- ${d.sugo}`, l);
    return [`${d.nev} -- ${d.sugo}`, ertekForma(d)].filter(Boolean);
  }
  // A parancs utáni szavak (az útvonal és a parancs neve nélkül).
  const parameterek = u.maradek;
  const hasznalt = parameterek.map((t) => (t.szoveg.includes('=') ? nevErtek(t.szoveg).nev : null)).filter(Boolean);
  const vanPozicios = parameterek.some((t) => !t.szoveg.includes('=') || t.szoveg.startsWith('['));
  const resz = utolso ? utolso.szoveg : '';
  const elemek = defs.filter((d) => !hasznalt.includes(d.nev) && d.nev.startsWith(resz)).map((d) => ({ nev: d.nev, sugo: d.sugo }));
  if (elemesParancs(u.parancs, u.menu) && !vanPozicios) {
    elemek.unshift({ nev: '<numbers>', sugo: 'melyik elem(ek): sorszám a print szerint (0, 1 …), név, vagy [find …]' });
  }
  for (const p of pozicios(u.parancs)) if (p.startsWith(resz)) elemek.push({ nev: p, sugo: 'részletes lista, minden beállítással' });
  if (u.parancs === 'ping' && !vanPozicios) elemek.unshift({ nev: '<address>', sugo: 'a pingelendő IP-cím' });
  return sugoSorok(PARANCS_SUGO[u.parancs], elemek);
}

/** A leghosszabb közös előtag. */
function kozosElotag(lista) {
  if (!lista.length) return '';
  let p = lista[0];
  for (const s of lista) while (!s.startsWith(p)) p = p.slice(0, -1);
  return p;
}

/**
 * Tab: az utolsó szó kiegészítése (egyértelmű esetben teljesen, egyébként a közös részig).
 * @returns {string|null}
 */
export function kiegeszit(sor, k) {
  if (sor === '' || /\s$/.test(sor)) return null;
  const tokenek = tokenekre(sor);
  const utolso = tokenek[tokenek.length - 1];
  const u = utvonal(tokenek.slice(0, -1), k.menu);
  if (!u.ok) return null;
  const eleje = sor.slice(0, utolso.kezdet);
  const s = utolso.szoveg;

  if (!u.parancs) {
    let menu = u.menu;
    const perPoz = s.lastIndexOf('/');
    let resz = s;
    if (perPoz >= 0) {
      const r = utvonal([{ szoveg: s.slice(0, perPoz + 1), kezdet: 0 }], menu);
      if (!r.ok || r.parancs) return null;
      menu = r.menu;
      resz = s.slice(perPoz + 1);
    }
    const nevek = [...menu.almenuk.map((a) => a.nev), ...parancsok(menu)].filter((n) => n.startsWith(resz));
    if (!nevek.length) return null;
    const uj = nevek.length === 1 ? `${nevek[0]} ` : kozosElotag(nevek);
    if (uj.length <= resz.length) return null;
    return eleje + s.slice(0, perPoz + 1) + uj;
  }

  const defs = nevesParameterek(u.parancs, u.menu);
  if (s.includes('=') && !s.startsWith('[')) {
    const { nev, ertek } = nevErtek(s);
    const d = paramIllesztes(defs, nev);
    if (!d) return null;
    const lista = d.tipus === 'interfeszLista' ? ertek.split(',') : [ertek];
    const reszErtek = lista[lista.length - 1];
    const nevek = ertekLehetosegek(d, k.sw).map((e) => e.nev).filter((n) => n.startsWith(reszErtek));
    if (!nevek.length) return null;
    const uj = nevek.length === 1 ? nevek[0] : kozosElotag(nevek);
    if (uj.length <= reszErtek.length) return null;
    lista[lista.length - 1] = uj;
    return `${eleje}${d.nev}=${lista.join(',')}${nevek.length === 1 && d.tipus !== 'interfeszLista' ? ' ' : ''}`;
  }
  const nevek = [...defs.map((d) => `${d.nev}=`), ...pozicios(u.parancs)].filter((n) => n.startsWith(s));
  if (!nevek.length) return null;
  const uj = nevek.length === 1 ? nevek[0] : kozosElotag(nevek);
  if (uj.length <= s.length) return null;
  return eleje + uj;
}
