/**
 * A RouterOS-szerű parancssor kimenetei: print (táblázat és detail), export, ping.
 *
 * A FORMÁT a RouterOS 7 kimeneteiről vettük (Flags:/Columns: fejléc, sorszám és jelzőbetűk a sor
 * elején, ;;; megjegyzés az elem fölött, a listák soronként egy elemmel) – a forrásokat lásd
 * docs/forrasok.md. Szöveget nem másoltunk, csak az elrendezést.
 */

import { menuUtbol, EXPORT_SORREND } from './menuk.js';
import { olvas, ertekIr } from './parancssor.js';
import { MODELL, ROS_VERZIO, macSzoveg } from '../../modell/mikrotik.js';
import { vegpontCelhoz } from '../../mag/hid.js';
import { egyPing } from '../../mag/vegpont.js';

// ---------------------------------------------------------------------------
// print – táblázat
// ---------------------------------------------------------------------------

/** A sorok jelzőbetűi: csak azok a jelzők kerülnek a fejlécbe, amelyek valamelyik soron szerepelnek. */
function jelzok(adat, elemek, sw) {
  const hasznalt = (adat.zaszlok || []).filter((z) => elemek.some((e) => z.fn(e, sw)));
  const betuk = (e) => hasznalt.map((z) => (z.fn(e, sw) ? z.betu : ' ')).join('');
  const fejlec = hasznalt.length ? `Flags: ${hasznalt.map((z) => `${z.betu} - ${z.nev}`).join('; ')}` : null;
  return { szel: Math.max(1, hasznalt.length), betuk, fejlec };
}

/**
 * Táblázatos lista (a v7 alapértelmezett print kimenete).
 * @returns {string[]}
 */
export function tablaKiir(adat, sw) {
  const elemek = adat.elemek(sw);
  const j = jelzok(adat, elemek, sw);
  const osz = adat.oszlopok;
  const cellak = elemek.map((e) => osz.map((o) => {
    const v = o.ertek(e, sw);
    return Array.isArray(v) ? v : [v];
  }));
  const szel = osz.map((o, i) => Math.max(o.cim.length, ...cellak.map((c) => Math.max(0, ...c[i].map((x) => x.length)))));
  const iw = Math.max(1, String(Math.max(0, elemek.length - 1)).length);
  const sorBol = (idx, betuk, ertekek) => {
    const reszek = ertekek.map((v, i) => (osz[i].jobbra ? v.padStart(szel[i]) : v.padEnd(szel[i])));
    return `${idx.padEnd(iw)} ${betuk.padEnd(j.szel)} ${reszek.join('  ')}`.replace(/\s+$/, '');
  };
  const ki = [];
  if (j.fejlec) ki.push(j.fejlec);
  ki.push(`Columns: ${osz.map((o) => o.cim).join(', ')}`);
  ki.push(sorBol('#', '', osz.map((o) => o.cim)));
  elemek.forEach((e, n) => {
    if (e.komment || (e.elem && e.elem.komment)) ki.push(`;;; ${e.komment || e.elem.komment}`);
    const c = cellak[n];
    const sorok = Math.max(1, ...c.map((x) => x.length));
    for (let s = 0; s < sorok; s++) {
      ki.push(sorBol(s === 0 ? String(n) : '', s === 0 ? j.betuk(e) : '', c.map((x) => x[s] || '')));
    }
  });
  return ki;
}

// ---------------------------------------------------------------------------
// print detail
// ---------------------------------------------------------------------------

/** név=érték párok sorokba tördelve (a valódi eszköz is tördeli a hosszú sort). */
function tordel(parok, behuzas, szel = 100) {
  const sorok = [];
  let sor = '';
  for (const [n, v] of parok) {
    const resz = `${n}=${v}`;
    if (sor && behuzas + sor.length + 1 + resz.length > szel) {
      sorok.push(sor);
      sor = resz;
    } else sor = sor ? `${sor} ${resz}` : resz;
  }
  if (sor) sorok.push(sor);
  return sorok.map((s) => ' '.repeat(behuzas) + s);
}

/**
 * Részletes lista (print detail; a bridge-nél ez az alap).
 * @returns {string[]}
 */
export function reszletesKiir(adat, sw) {
  const elemek = adat.elemek(sw);
  const j = jelzok(adat, elemek, sw);
  const iw = Math.max(2, String(Math.max(0, elemek.length - 1)).length + 1);
  const ki = [];
  if (j.fejlec) ki.push(j.fejlec);
  elemek.forEach((e, n) => {
    const parok = adat.reszletek
      ? adat.reszletek(sw, e)
      : adat.tulajdonsagok.filter((t) => !['comment', 'disabled'].includes(t.nev)).map((t) => [t.nev, olvas(t, e, sw)]);
    const fej = `${String(n).padStart(iw)} ${j.betuk(e).padEnd(j.szel)} `;
    const komment = e.komment || (e.elem && e.elem.komment);
    const behuz = fej.length;
    const sorok = tordel(parok.map(([a, b]) => [a, b === '' ? '""' : b]), behuz);
    if (komment) {
      ki.push(`${fej};;; ${komment}`);
      ki.push(...sorok);
    } else {
      ki.push(fej + sorok[0].trimStart());
      ki.push(...sorok.slice(1));
    }
    ki.push('');
  });
  return ki;
}

/** /system identity print */
export function identityKiir(sw) {
  return [`  name: ${sw.hostname}`];
}

// ---------------------------------------------------------------------------
// export
// ---------------------------------------------------------------------------

/** Kétjegyű szám. */
const k2 = (n) => String(n).padStart(2, '0');

/** Az eszköz órája: óra (NTP) nélkül 1970. január 2-ról indul. */
function datum(ora) {
  const d = new Date(Date.UTC(1970, 0, 2) + (ora ? ora.ido : 0));
  return `${d.getUTCFullYear()}-${k2(d.getUTCMonth() + 1)}-${k2(d.getUTCDate())} ${k2(d.getUTCHours())}:${k2(d.getUTCMinutes())}:${k2(d.getUTCSeconds())}`;
}

/** Egy kitalált, de állandó „azonosító” a MAC-címből (szoftverazonosító, sorozatszám). */
function azonosito(mac, hossz, abc) {
  let h = 0;
  for (const c of mac) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  let s = '';
  for (let i = 0; i < hossz; i++) {
    h = (Math.imul(h, 1103515245) + 12345) >>> 0;
    s += abc[(h >>> 16) % abc.length];
  }
  return s;
}

/** Egy elem export-sora: csak az alapértéktől eltérő tulajdonságok, betűrendben. */
function elemExport(adat, e, sw) {
  const parok = [];
  for (const t of adat.tulajdonsagok) {
    if (t.csakOlvas) continue;
    const v = olvas(t, e, sw);
    const alap = t.alap === undefined ? undefined : t.tipus === 'bool' ? (t.alap ? 'yes' : 'no') : Array.isArray(t.alap) ? t.alap.join(',') : String(t.alap);
    if (alap !== undefined && v === alap) continue;
    if (v === '' && alap === undefined) continue;
    parok.push([t.nev, v]);
  }
  if (adat.exportExtra) parok.push(...adat.exportExtra(e));
  parok.sort((a, b) => a[0].localeCompare(b[0]));
  return `add ${parok.map(([n, v]) => `${n}=${ertekIr(v)}`).join(' ')}`;
}

/** Egy szekció sorai (fejléccel), vagy üres lista. */
function szekcio(ut, sw) {
  if (ut.join(' ') === 'interface ethernet') {
    const sorok = sw.portok.filter((p) => p.leallitva || p.komment).map((p) => {
      const parok = [];
      if (p.komment) parok.push(`comment=${ertekIr(p.komment)}`);
      if (p.leallitva) parok.push('disabled=yes');
      return `set [ find default-name=${p.nev} ] ${parok.join(' ')}`;
    });
    return sorok.length ? ['/interface ethernet', ...sorok] : [];
  }
  const menu = menuUtbol(ut);
  const adat = menu.adat;
  if (!adat.lista) {
    const parok = adat.tulajdonsagok.map((t) => [t.nev, olvas(t, sw, sw), t.alap]).filter(([, v, a]) => v !== a);
    return parok.length ? [`/${ut.join(' ')}`, `set ${parok.map(([n, v]) => `${n}=${ertekIr(v)}`).join(' ')}`] : [];
  }
  const elemek = adat.elemek(sw).filter((e) => !e._dinamikus);
  if (!elemek.length) return [];
  return [`/${ut.join(' ')}`, ...elemek.map((e) => elemExport(adat, e, sw))];
}

/**
 * export: a menü és az almenüi beállításai parancsként (a gyári értékeket kihagyja).
 * @returns {string[]}
 */
export function exportKiir(sw, menu, ora) {
  const ki = [
    `# ${datum(ora)} by RouterOS ${ROS_VERZIO}`,
    `# software id = ${azonosito(sw.mac, 4, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789')}-${azonosito(sw.mac + 'x', 4, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789')}`,
    '#',
    `# model = ${MODELL}`,
    `# serial number = ${azonosito(sw.mac + 's', 11, '0123456789ABCDEF')}`,
  ];
  const elotag = menu.ut;
  for (const ut of EXPORT_SORREND) {
    if (elotag.some((n, i) => ut[i] !== n)) continue;
    ki.push(...szekcio(ut, sw));
  }
  return ki;
}

// ---------------------------------------------------------------------------
// ping (a switch saját címéről)
// ---------------------------------------------------------------------------

const PING_FEJ = '  SEQ HOST                                     SIZE TTL TIME       STATUS';

/** Egy ping-sor a valódi kimenet oszlopaiban. */
function pingSor(seq, cim, e) {
  const eleje = `${String(seq).padStart(5)} ${cim.padEnd(40)}`;
  if (e.fajta === 'valasz') return `${eleje} ${'56'.padStart(4)} ${String(e.ttl).padStart(3)} ${`${Math.round(e.keses || 0)}ms`.padEnd(10)}`.replace(/\s+$/, '');
  return `${eleje}${' '.repeat(20)}timeout`;
}

/**
 * A switch pingje: a cél hálózatában lévő saját IP-címéről küldi (1 másodpercenként egyet).
 * A valódi eszközön a ping Ctrl+C-ig fut; itt a count (alapból 4) után megáll.
 */
export function pingFolyamat(sw, cel, db) {
  return {
    folyamat: (kiir, kesz) => {
      kiir(PING_FEJ);
      const h = sw.halozat;
      const ep = vegpontCelhoz(sw, cel);
      const idok = [];
      let i = 0;
      const egy = () => {
        if (i >= db || !h) return vege();
        const seq = i++;
        if (!ep) {
          kiir(`${String(seq).padStart(5)} ${cel.padEnd(40)}${' '.repeat(20)}no route to host`);
          return h.ora.utemez(1000, egy);
        }
        egyPing(h, ep, cel, (e) => {
          if (e.fajta === 'valasz') idok.push(Math.round(e.keses || 0));
          kiir(pingSor(seq, cel, e));
          h.ora.utemez(e.fajta === 'valasz' ? 1000 : 1, egy);
        }, { ttl: 64 });
      };
      const vege = () => {
        const n = idok.length;
        let sor = `    sent=${db} received=${n} packet-loss=${Math.round(((db - n) / db) * 100)}%`;
        if (n) {
          const atl = Math.round(idok.reduce((a, b) => a + b, 0) / n);
          sor += ` min-rtt=${Math.min(...idok)}ms avg-rtt=${atl}ms max-rtt=${Math.max(...idok)}ms`;
        }
        kiir(sor);
        kesz();
      };
      egy();
    },
  };
}

export { macSzoveg };
