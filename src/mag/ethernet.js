/**
 * Ethernet-alapok: MAC-címek és keretek.
 *
 * A MAC-címet belül 12 kis hexa számjegyként tároljuk (pl. "0250a1b2c3d4"), és csak a
 * kiíráskor alakítjuk a megfelelő formára (IOS: 0250.a1b2.c3d4, PC: 02-50-A1-B2-C3-D4).
 *
 * Egy keret (Ethernet frame) a szimulátorban egy egyszerű objektum:
 *   azon      – a keret azonosítója (a másolatai is ugyanezt kapják; az animációhoz, próbákhoz)
 *   forrasMac – küldő MAC
 *   celMac    – cél MAC (SZORAS = mindenkinek)
 *   tipus     – mit visz: 'arp' vagy 'ipv4' (az EtherType helyett)
 *   vlan      – 802.1Q-címke (VLAN-szám), ha van; címke nélküli keretnél undefined
 *   adat      – a tartalom (ARP-üzenet vagy IP-csomag)
 */

/** A szórási (broadcast) MAC-cím: minden gép megkapja. */
export const SZORAS = 'ffffffffffff';

let kovetkezoAzon = 1;
/** Új keretazonosító. */
export function ujKeretAzon() {
  return kovetkezoAzon++;
}

/**
 * Egy névből mindig ugyanazt a MAC-címet készíti (így egy feladat minden indításkor
 * ugyanazokat a címeket mutatja). A 02-vel kezdődő cím „helyileg kiosztott”, tehát
 * egyetlen valódi gyártóé sem.
 * @param {string} nev
 * @returns {string}
 */
export function macNevbol(nev) {
  let h = 0x811c9dc5;
  for (let i = 0; i < nev.length; i++) {
    h ^= nev.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const kever = (x) => {
    x ^= x >>> 16;
    x = Math.imul(x, 0x85ebca6b) >>> 0;
    x ^= x >>> 13;
    x = Math.imul(x, 0xc2b2ae35) >>> 0;
    x ^= x >>> 16;
    return x >>> 0;
  };
  const a = kever(h);
  const b = kever(a ^ 0x9e3779b9);
  return '02' + a.toString(16).padStart(8, '0') + (b & 0xff).toString(16).padStart(2, '0');
}

/** IOS-forma: 0250.a1b2.c3d4 */
export function macPontos(mac) {
  return `${mac.slice(0, 4)}.${mac.slice(4, 8)}.${mac.slice(8, 12)}`;
}

/** PC-forma: 02-50-A1-B2-C3-D4 */
export function macKotojeles(mac) {
  return mac.toUpperCase().match(/../g).join('-');
}
