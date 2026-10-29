/**
 * Építő szkript: a src/ alatti modulokból egyetlen dist/szimulator.js-t készít,
 * és a css/szimulator.css-t átmásolja a dist/ mappába.
 *
 * Futtatás: npm run build
 *
 * Az IIFE formátum azt jelenti, hogy a kész fájl egy sima <script>-tel betölthető
 * (nem kell hozzá szerver, file://-on is működik).
 */
import { build } from 'esbuild';
import { copyFile, mkdir, readFile } from 'node:fs/promises';

const csomag = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const fejlec = `/* Haloszim v${csomag.version} – routerrantotta.hu – minden jog fenntartva. */`;

await mkdir('dist', { recursive: true });

await build({
  entryPoints: ['src/fo.js'],
  bundle: true,
  format: 'iife',
  target: ['es2018'],
  outfile: 'dist/szimulator.js',
  banner: { js: fejlec },
  define: { __VERZIO__: JSON.stringify(csomag.version) },
  charset: 'utf8',
  legalComments: 'none',
});

await copyFile('css/szimulator.css', 'dist/szimulator.css');

console.log(`Kész: dist/szimulator.js és dist/szimulator.css (v${csomag.version})`);
