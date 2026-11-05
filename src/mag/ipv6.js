/**
 * IPv6-segédfüggvények: címek értelmezése, rövid alakja, előtagok, link-local cím.
 *
 * Belül egy IPv6-cím 8 db 16 bites szám tömbje (pl. 2001:DB8::1 → [0x2001, 0xdb8, 0, 0, 0, 0, 0, 1]).
 * Kiíráskor a szokásos rövid alakot használjuk: a vezető nullák elmaradnak, a leghosszabb
 * (legalább kételemű) nullasorozat helyén „::” áll. Az IOS nagybetűvel írja (2001:DB8:ACAD:1::1),
 * a PC kisbetűvel (2001:db8:acad:1::1).
 */

/**
 * Szövegből cím. Érvénytelen alaknál null.
 * @param {string} szoveg – pl. "2001:DB8:ACAD:1::1" vagy "fe80::1"
 * @returns {number[]|null}
 */
export function ipv6Elemez(szoveg) {
  if (typeof szoveg !== 'string') return null;
  const s = szoveg.trim();
  if (!/^[0-9a-fA-F:]+$/.test(s) || s.length < 2) return null;
  const dupla = s.split('::');
  if (dupla.length > 2) return null;
  const darabol = (r) => (r === '' ? [] : r.split(':'));
  const eleje = darabol(dupla[0]);
  const vege = dupla.length === 2 ? darabol(dupla[1]) : [];
  const jo = (x) => /^[0-9a-fA-F]{1,4}$/.test(x);
  if (!eleje.every(jo) || !vege.every(jo)) return null;
  let reszek;
  if (dupla.length === 2) {
    const hiany = 8 - eleje.length - vege.length;
    if (hiany < 1) return null;
    reszek = [...eleje, ...new Array(hiany).fill('0'), ...vege];
  } else {
    reszek = eleje;
  }
  if (reszek.length !== 8) return null;
  return reszek.map((r) => parseInt(r, 16));
}

/** Érvényes IPv6-cím-e. */
export function ervenyesIpv6(szoveg) {
  return ipv6Elemez(szoveg) !== null;
}

/**
 * Rövid alak (nagybetűvel, mint az IOS-en).
 * @param {number[]} c
 */
export function ipv6Szoveg(c) {
  // A leghosszabb, legalább kételemű nullasorozat.
  let legKezd = -1;
  let legHossz = 0;
  for (let i = 0; i < 8;) {
    if (c[i] !== 0) {
      i++;
      continue;
    }
    let j = i;
    while (j < 8 && c[j] === 0) j++;
    if (j - i > legHossz && j - i >= 2) {
      legKezd = i;
      legHossz = j - i;
    }
    i = j;
  }
  const hex = (x) => x.toString(16).toUpperCase();
  if (legKezd < 0) return c.map(hex).join(':');
  const eleje = c.slice(0, legKezd).map(hex).join(':');
  const vege = c.slice(legKezd + legHossz).map(hex).join(':');
  return `${eleje}::${vege}`;
}

/** A szöveges cím egységes (rövid, nagybetűs) alakja; érvénytelennél null. */
export function ipv6Normal(szoveg) {
  const c = ipv6Elemez(szoveg);
  return c ? ipv6Szoveg(c) : null;
}

/**
 * „Cím/hossz” alak értelmezése.
 * @param {string} szoveg – pl. "2001:DB8:ACAD:1::1/64"
 * @returns {{cim: number[], hossz: number}|null}
 */
export function ipv6PrefixElemez(szoveg) {
  const m = /^([^/\s]+)\/(\d{1,3})$/.exec(String(szoveg).trim());
  if (!m) return null;
  const cim = ipv6Elemez(m[1]);
  const hossz = Number(m[2]);
  if (!cim || hossz > 128) return null;
  return { cim, hossz };
}

/** A cím hálózati része (a gépbitek nullázva). */
export function ipv6Halozat(c, hossz) {
  return c.map((x, i) => {
    const bitek = Math.max(0, Math.min(16, hossz - i * 16));
    const maszk = bitek === 0 ? 0 : (0xffff << (16 - bitek)) & 0xffff;
    return x & maszk;
  });
}

/** Egy hálózatban vannak-e (az első `hossz` bit egyezik). */
export function ipv6EgyHalozat(a, b, hossz) {
  const x = ipv6Halozat(a, hossz);
  const y = ipv6Halozat(b, hossz);
  return x.every((v, i) => v === y[i]);
}

/** Két cím egyenlő-e. */
export function ipv6Egyenlo(a, b) {
  return !!a && !!b && a.every((v, i) => v === b[i]);
}

/** Link-local cím-e (FE80::/10). */
export function linkLocalE(c) {
  return (c[0] & 0xffc0) === 0xfe80;
}

/** Csoportcím-e (FF00::/8). */
export function csoportcimE(c) {
  return (c[0] & 0xff00) === 0xff00;
}

/**
 * Link-local cím a MAC-címből (EUI-64): FE80:: + a MAC közepére FFFE, a 7. bit átfordítva.
 * @param {string} mac – 12 hexa számjegy
 */
export function eui64LinkLocal(mac) {
  const b = mac.match(/../g).map((x) => parseInt(x, 16));
  b[0] ^= 0x02;
  return [0xfe80, 0, 0, 0, (b[0] << 8) | b[1], (b[2] << 8) | 0xff, (0xfe << 8) | b[3], (b[4] << 8) | b[5]];
}

/** Az IPv6-csoportcímhez tartozó Ethernet-cím: 33:33 + a cím utolsó 32 bitje. */
export function ipv6CsoportMac(c) {
  const h4 = (x) => x.toString(16).padStart(4, '0');
  return '3333' + h4(c[6]) + h4(c[7]);
}

/** A cím „kérelmezett csomópont” (solicited-node) csoportcíme: FF02::1:FFxx:xxxx. */
export function solicitedNode(c) {
  return [0xff02, 0, 0, 0, 0, 1, 0xff00 | (c[6] & 0xff), c[7]];
}

/** A RIPng csoportcíme: FF02::9 (minden RIPng-router). */
export const RIPNG_CSOPORT = [0xff02, 0, 0, 0, 0, 0, 0, 9];
/** Minden csomópont: FF02::1 */
export const MINDEN_CSOMOPONT = [0xff02, 0, 0, 0, 0, 0, 0, 1];
/** A „::” (nem meghatározott) cím. */
export const NULLA6 = [0, 0, 0, 0, 0, 0, 0, 0];
