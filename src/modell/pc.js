/**
 * PC-eszközmodell: egy hálózati kártya (FastEthernet0), IP-cím, maszk, alapértelmezett átjáró
 * és ARP-gyorstár. Csak adat; a viselkedés (ARP, ping) a mag/vegpont.js-ben van.
 */

import { macNevbol } from '../mag/ethernet.js';

/**
 * @typedef {Object} PcAllapot
 * @property {string} tipus     – "pc"
 * @property {string} hostname  – a gép neve (pl. PC1)
 * @property {string} mac       – a hálózati kártya MAC-címe (12 hexa számjegy)
 * @property {string} ip        – IPv4-cím ('' = nincs beállítva)
 * @property {string} maszk     – alhálózati maszk ('' = nincs)
 * @property {string} atjaro    – alapértelmezett átjáró ('' = nincs)
 * @property {Object<string, {mac: string, ido: number}>} arpTabla – IP → MAC
 * @property {string} ipv6       – IPv6-cím (egységes alakban; '' = nincs)
 * @property {number} ipv6Hossz  – az IPv6-előtag hossza (általában 64)
 * @property {string} ipv6Atjaro – IPv6 alapértelmezett átjáró (általában a router link-local címe)
 * @property {Object<string, {mac: string, ido: number}>} ndTabla – IPv6-szomszédok: cím → MAC
 * @property {import('./switch.js').Port[]} portok – egyetlen port: FastEthernet0
 */

/**
 * Új PC, IP-beállítás nélkül.
 * @param {{nev: string}} p
 * @returns {PcAllapot}
 */
export function ujPc({ nev }) {
  return {
    tipus: 'pc',
    modell: 'pc',
    hostname: nev,
    mac: macNevbol('pc:' + nev),
    ip: '',
    maszk: '',
    atjaro: '',
    arpTabla: {},
    ipv6: '',
    ipv6Hossz: 64,
    ipv6Atjaro: '',
    ndTabla: {},
    portok: [{ nev: 'FastEthernet0', rovid: 'Fa0', tipus: 'FastEthernet', szam: '0', leallitva: false, fent: false }],
  };
}
