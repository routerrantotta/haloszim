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
    portok: [{ nev: 'FastEthernet0', rovid: 'Fa0', tipus: 'FastEthernet', szam: '0', leallitva: false, fent: false }],
  };
}
