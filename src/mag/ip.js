/**
 * IPv4-segédfüggvények: címek ellenőrzése, átalakítása, azonos hálózat vizsgálata.
 * Belül a cím egy 32 bites előjel nélküli szám.
 */

/**
 * Pontozott alakból számmá alakít. Érvénytelen címnél null.
 * @param {string} szoveg – pl. "192.168.10.11"
 * @returns {number|null}
 */
export function ipSzam(szoveg) {
  if (typeof szoveg !== 'string') return null;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(szoveg.trim());
  if (!m) return null;
  const reszek = m.slice(1).map(Number);
  if (reszek.some((r) => r > 255)) return null;
  return ((reszek[0] << 24) >>> 0) + (reszek[1] << 16) + (reszek[2] << 8) + reszek[3];
}

/** Számból pontozott alak. */
export function ipSzoveg(szam) {
  return [24, 16, 8, 0].map((t) => (szam >>> t) & 255).join('.');
}

/** Érvényes-e a cím (formailag). */
export function ervenyesIp(szoveg) {
  return ipSzam(szoveg) !== null;
}

/**
 * Érvényes alhálózati maszk-e (elöl csupa 1-es, utána csupa 0-s bit; 0.0.0.0 nem).
 * @param {string} szoveg
 */
export function ervenyesMaszk(szoveg) {
  const m = ipSzam(szoveg);
  if (m === null || m === 0) return false;
  const inv = (~m) >>> 0;
  return ((inv + 1) & inv) === 0;
}

/** A maszk hossza (pl. 255.255.255.0 → 24). */
export function prefixHossz(maszk) {
  let m = ipSzam(maszk);
  let n = 0;
  while (m & 0x80000000) {
    n++;
    m = (m << 1) >>> 0;
  }
  return n;
}

/**
 * Egy hálózatban van-e a két cím az adott maszk szerint.
 * @param {string} a
 * @param {string} b
 * @param {string} maszk
 */
export function egyHalozat(a, b, maszk) {
  const x = ipSzam(a);
  const y = ipSzam(b);
  const m = ipSzam(maszk);
  if (x === null || y === null || m === null) return false;
  return ((x & m) >>> 0) === ((y & m) >>> 0);
}

/**
 * Használható-e a cím egy gép címeként az adott maszkkal
 * (nem a hálózat címe, nem a szórási cím, nem 0.x, 127.x, és nem csoportcím).
 * @returns {string|null} – a hiba magyar leírása, vagy null, ha rendben van
 */
export function gepcimHiba(ip, maszk) {
  const x = ipSzam(ip);
  const m = ipSzam(maszk);
  if (x === null) return 'Érvénytelen IP-cím.';
  if (m === null || !ervenyesMaszk(maszk)) return 'Érvénytelen alhálózati maszk.';
  const elso = x >>> 24;
  if (elso === 0 || elso === 127 || elso >= 224) return 'Ez a cím nem adható egy gépnek.';
  const gep = (x & ~m) >>> 0;
  const gepResz = (~m) >>> 0;
  if (gepResz > 1 && gep === 0) return 'Ez a hálózat címe, gépnek nem adható.';
  if (gepResz > 1 && gep === gepResz) return 'Ez a hálózat szórási címe, gépnek nem adható.';
  return null;
}
