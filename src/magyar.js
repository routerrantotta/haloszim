/**
 * Magyar nyelvtani segédek számokhoz (a véletlen adatok miatt a szövegben a szám változik,
 * a ragnak és a névelőnek pedig igazodnia kell hozzá):
 *   esRag(10) → "10-es", esRag(20) → "20-as", esRag(5) → "5-ös", esRag(6) → "6-os"
 *   nevelo(5) → "az", nevelo(10) → "a"
 */

/** Az egyesek (1–9) -s képzője: egy, kettő, három, négy, öt, hat, hét, nyolc, kilenc */
const EGYES = ['', 'es', 'es', 'as', 'es', 'ös', 'os', 'es', 'as', 'es'];
/** A kerek tízesek (10–90): tíz, húsz, harminc, negyven, ötven, hatvan, hetven, nyolcvan, kilencven */
const TIZES = ['', 'es', 'as', 'as', 'es', 'es', 'as', 'es', 'as', 'es'];

/** A szám -s képzős alakja kötőjellel: 10 → „10-es”. */
export function esRag(n) {
  const x = Math.abs(Math.trunc(Number(n)));
  let rag;
  if (x === 0) rag = 's'; // nulla → „0-s”
  else if (x % 10 !== 0) rag = EGYES[x % 10];
  else if (x % 100 !== 0) rag = TIZES[(x % 100) / 10];
  else if (x % 1000 !== 0) rag = 'as'; // száz, kétszáz …
  else rag = 'es'; // ezer
  return `${n}-${rag}`;
}

/** A határozott névelő a szám elé: „az” ha magánhangzóval kezdődik a kiejtése (1, 5, 5x, 5xx …). */
export function nevelo(n) {
  const s = String(Math.abs(Math.trunc(Number(n))));
  if (s === '1' || s[0] === '5') return 'az';
  if (s.length === 4 && s[0] === '1') return 'az'; // ezer… (egyezer)
  return 'a';
}
