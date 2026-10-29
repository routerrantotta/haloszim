/**
 * Az IOS-szerű parancssor hibaüzenetei és a ? súgó formája.
 *
 * A hibaüzenetek FORMÁJA a valódi eszközt követi (ugyanazok a % kezdetű sorok, a ^ jel
 * a hiba helyén), mert ezeket a tanulóknak fel kell ismerniük. A súgó magyarázó szövegei
 * saját, magyar megfogalmazások (a parancsleírásokban vannak). Források: docs/forrasok.md.
 */

/** Ennyi szimulált/valódi ms-ig „keresi” az eszköz a gépnevet (névfeloldás). */
export const NEVFELOLDAS_VARAKOZAS = 1500;

/** Egy ^ jel a megadott oszlopban (a prompt hosszát is beszámítva). */
function jelzoSor(prompt, oszlop) {
  return ' '.repeat(prompt.length + oszlop) + '^';
}

/**
 * Hibás parancs → kiírandó sorok.
 * @param {Object} r – az értelmező eredménye (ok: false)
 * @param {{sor: string, prompt: string, mod: string, modAdat: Object}} info
 * @returns {Array<string|{varj: number}>}
 */
export function formazHiba(r, info) {
  if (r.hiba === 'ketertelmu') return [`% Ambiguous command:  "${info.sor.trim()}"`];
  if (r.hiba === 'hianyos') return ['% Incomplete command.', ''];

  // Exec módban az ismeretlen első szót az eszköz gépnévnek gondolja, és megpróbál
  // csatlakozni hozzá (telnet). Egyetlen szónál névfeloldást kezd, és ez eltart egy ideig.
  if (info.modAdat.exec && r.gyokerKezdet === 0 && r.tokenIndex === 0) {
    if (r.tokenek.length === 1) {
      return [
        `Translating "${r.tokenek[0].szoveg}"...domain server (255.255.255.255)`,
        { varj: NEVFELOLDAS_VARAKOZAS },
        '% Unknown command or computer name, or unable to find computer address',
      ];
    }
    // Több szónál a második szót nem érti (az első lenne a gépnév).
    return [jelzoSor(info.prompt, r.tokenek[1].kezdet), "% Invalid input detected at '^' marker.", ''];
  }

  return [jelzoSor(info.prompt, r.oszlop || 0), "% Invalid input detected at '^' marker.", ''];
}

/**
 * A ? súgó eredménye → kiírandó sorok.
 * @param {Object} r – az értelmező sugo() eredménye
 * @param {{sor: string, prompt: string, mod: string, modAdat: Object}} info
 * @returns {string[]}
 */
export function formazSugo(r, info) {
  if (!r.ok) {
    if (r.hiba === 'ismeretlen' || (r.hiba === 'ervenytelen' && r.tokenIndex === 0)) return ['% Unrecognized command'];
    if (r.hiba === 'ketertelmu') return [`% Ambiguous command:  "${info.sor.trim()}"`];
    if (r.hiba === 'hianyos') return ['% Incomplete command.', ''];
    return [jelzoSor(info.prompt, r.oszlop || 0), "% Invalid input detected at '^' marker.", ''];
  }

  if (r.fajta === 'szavak') {
    // Az illő szavak oszlopokba rendezve (mint a valódi eszközön), majd egy üres sor.
    const szel = Math.max(...r.szavak.map((s) => s.length)) + 2;
    const egySorban = Math.max(1, Math.floor(80 / szel));
    const sorok = [];
    for (let i = 0; i < r.szavak.length; i += egySorban) {
      sorok.push(r.szavak.slice(i, i + egySorban).map((s) => s.padEnd(szel)).join('').trimEnd());
    }
    return [...sorok, ''];
  }

  // Teljes lista: „  kulcsszó   magyarázat”, a végén <cr>, ha itt már Entert lehet nyomni.
  const sorok = [];
  if (r.gyoker && info.modAdat.sugoFejlec) sorok.push(info.modAdat.sugoFejlec);
  const szel = Math.max(0, ...r.elemek.map((e) => e.nev.length));
  for (const e of r.elemek) sorok.push(`  ${e.nev.padEnd(szel)}  ${e.sugo}`.trimEnd());
  if (r.cr) sorok.push('  <cr>');
  sorok.push('');
  return sorok;
}
