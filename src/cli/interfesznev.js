/**
 * Interfésznév-értelmező (gyártófüggetlen rész).
 *
 * Elfogadott alakok (kis- és nagybetű mindegy):
 *   f0/1, fa0/1, FastEthernet0/1, fastEthernet 0/1, g0/1, gi0/1, GigabitEthernet 0/2
 * Tartomány (interface range után):
 *   fa0/1 - 4, fa0/1-4, f0/1-4,f0/10, fa0/1 - 4 , gi0/1 - 2
 *
 * A porttípusokat és a számokat az eszköz adja meg (lásd modell/switch.js → portTipusok),
 * így ugyanez a kód routeren (Gi0/0/0) is működni fog.
 */

/**
 * @typedef {Object<string, string[]>} TipusLista – típusnév → létező számok (pl. "0/1")
 */

/**
 * A beírt előtagból megkeresi a porttípust (szavankénti rövidítés, mint a parancsoknál).
 * @param {string} elotag – pl. "fa", "g", "FastEthernet"
 * @param {TipusLista} tipusok
 * @returns {{tipus?: string, hiba?: 'nincs'|'ketertelmu', jeloltek: string[]}}
 */
export function tipusIllesztes(elotag, tipusok) {
  const kis = elotag.toLowerCase();
  const nevek = Object.keys(tipusok);
  const pontos = nevek.find((n) => n.toLowerCase() === kis);
  if (pontos) return { tipus: pontos, jeloltek: [pontos] };
  const jeloltek = nevek.filter((n) => n.toLowerCase().startsWith(kis));
  if (jeloltek.length === 1) return { tipus: jeloltek[0], jeloltek };
  if (jeloltek.length === 0) return { hiba: 'nincs', jeloltek };
  return { hiba: 'ketertelmu', jeloltek };
}

/**
 * Egy „0/1” alakú szám ellenőrzése egy adott típuson belül.
 * @param {string} szam
 * @param {string[]} letezok – az adott típus létező számai
 * @returns {{ok: true} | {ok: false, eltolas: number}} – hiba esetén a hibás rész helye a szövegben
 */
function szamEllenorzes(szam, letezok) {
  // A „0/01” is a „0/1” portot jelenti (a vezető nullák nem számítanak).
  const normal = szam.split('/').map((r) => String(Number(r))).join('/');
  if (letezok.includes(normal)) return { ok: true };
  const reszek = szam.split('/');
  const letezoReszek = letezok.map((s) => s.split('/'));
  // Részenként haladunk: az első olyan részen jelezzük a hibát, amelyik már nem létezhet.
  let eltolas = 0;
  for (let i = 0; i < reszek.length; i++) {
    const elotag = reszek.slice(0, i + 1);
    const vanIlyen = letezoReszek.some((lr) => elotag.every((r, j) => lr[j] === String(Number(r)) && /^\d+$/.test(r)));
    if (!vanIlyen) return { ok: false, eltolas };
    eltolas += reszek[i].length + 1;
  }
  // Minden rész létezett, de kevés volt belőle (pl. "0" a "0/1" helyett).
  return { ok: false, eltolas: szam.length };
}

/**
 * Egyetlen interfésznév értelmezése a szavak (tokenek) listájából, az `i`-edik szótól.
 * Egy vagy két szót használhat fel ("fa0/1" vagy "fastEthernet 0/1").
 *
 * @param {{szoveg: string, kezdet: number}[]} tokenek
 * @param {number} i
 * @param {TipusLista} tipusok
 * @returns {{ok: true, nev: string, tipus: string, szam: string, kovetkezo: number}
 *         | {ok: false, hiba: 'ervenytelen'|'hianyos'|'ketertelmu', oszlop?: number}}
 */
export function interfeszElemez(tokenek, i, tipusok) {
  const t = tokenek[i];
  const m = /^([a-zA-Z-]+)(.*)$/.exec(t.szoveg);
  if (!m) return { ok: false, hiba: 'ervenytelen', oszlop: t.kezdet };
  const illesztes = tipusIllesztes(m[1], tipusok);
  if (illesztes.hiba === 'ketertelmu') return { ok: false, hiba: 'ketertelmu' };
  if (illesztes.hiba) return { ok: false, hiba: 'ervenytelen', oszlop: t.kezdet };
  const tipus = illesztes.tipus;

  let szam = m[2];
  let szamKezdet = t.kezdet + m[1].length;
  let kovetkezo = i + 1;
  if (szam === '') {
    // A szám külön szóban jön: "fastEthernet 0/1"
    const kov = tokenek[i + 1];
    if (!kov) return { ok: false, hiba: 'hianyos' };
    szam = kov.szoveg;
    szamKezdet = kov.kezdet;
    kovetkezo = i + 2;
  }
  if (!/^\d+(\/\d+)*$/.test(szam)) {
    const rossz = szam.search(/[^\d/]/);
    return { ok: false, hiba: 'ervenytelen', oszlop: szamKezdet + Math.max(0, rossz) };
  }
  const ell = szamEllenorzes(szam, tipusok[tipus]);
  if (!ell.ok) {
    if (ell.eltolas >= szam.length) return { ok: false, hiba: 'hianyos' };
    return { ok: false, hiba: 'ervenytelen', oszlop: szamKezdet + ell.eltolas };
  }
  // A beírt "0/01" alak is a "0/1" porthoz tartozik.
  const normalSzam = szam.split('/').map((r) => String(Number(r))).join('/');
  return { ok: true, nev: tipus + normalSzam, tipus, szam: normalSzam, kovetkezo };
}

/**
 * Interfész-tartomány értelmezése (az `interface range` utáni teljes szöveg).
 * @param {string} szoveg – a sor maradéka
 * @param {number} kezdet – a maradék kezdőoszlopa a teljes sorban (a ^ jelhez)
 * @param {TipusLista} tipusok
 * @returns {{ok: true, nevek: string[]} | {ok: false, hiba: 'ervenytelen'|'hianyos'|'ketertelmu', oszlop?: number}}
 */
export function tartomanyElemez(szoveg, kezdet, tipusok) {
  const nevek = [];
  let pozicio = 0;
  const darabok = szoveg.split(',');
  for (let d = 0; d < darabok.length; d++) {
    const darab = darabok[d];
    const darabKezdet = kezdet + pozicio;
    pozicio += darab.length + 1;
    const vezeto = darab.length - darab.trimStart().length;
    const tiszta = darab.trim();
    if (tiszta === '') {
      // Üres elem: pl. a sor végén maradt vessző.
      return { ok: false, hiba: d === darabok.length - 1 ? 'hianyos' : 'ervenytelen', oszlop: darabKezdet + vezeto };
    }
    const m = /^([a-zA-Z-]+)(\s*)(\d+(?:\/\d+)*)?(?:(\s*-\s*)(\d+)?)?(.*)$/.exec(tiszta);
    const elemKezdet = darabKezdet + vezeto;
    const illesztes = tipusIllesztes(m ? m[1] : tiszta, tipusok);
    if (!m || illesztes.hiba === 'nincs') return { ok: false, hiba: 'ervenytelen', oszlop: elemKezdet };
    if (illesztes.hiba === 'ketertelmu') return { ok: false, hiba: 'ketertelmu' };
    const tipus = illesztes.tipus;
    const [, tipusSzoveg, koz1, szam, kotojel, veg, maradek] = m;
    const szamKezdet = elemKezdet + tipusSzoveg.length + koz1.length;
    if (!szam) {
      if (maradek) return { ok: false, hiba: 'ervenytelen', oszlop: szamKezdet };
      return { ok: false, hiba: 'hianyos' };
    }
    const ell = szamEllenorzes(szam, tipusok[tipus]);
    if (!ell.ok) {
      if (ell.eltolas >= szam.length && !kotojel && !maradek) return { ok: false, hiba: 'hianyos' };
      return { ok: false, hiba: 'ervenytelen', oszlop: szamKezdet + Math.min(ell.eltolas, szam.length) };
    }
    const vegKezdet = szamKezdet + szam.length + (kotojel ? kotojel.length : 0);
    if (maradek) return { ok: false, hiba: 'ervenytelen', oszlop: vegKezdet + (veg ? veg.length : 0) };
    if (kotojel && !veg) return { ok: false, hiba: 'hianyos' };

    const reszek = szam.split('/').map(Number);
    const elsoPort = reszek[reszek.length - 1];
    const utolsoPort = veg !== undefined ? Number(veg) : elsoPort;
    const elotag = reszek.slice(0, -1).join('/');
    if (utolsoPort < elsoPort) return { ok: false, hiba: 'ervenytelen', oszlop: vegKezdet };
    for (let p = elsoPort; p <= utolsoPort; p++) {
      const sz = (elotag ? elotag + '/' : '') + p;
      if (!tipusok[tipus].includes(sz)) return { ok: false, hiba: 'ervenytelen', oszlop: vegKezdet };
      const nev = tipus + sz;
      if (!nevek.includes(nev)) nevek.push(nev);
    }
  }
  return { ok: true, nevek };
}
