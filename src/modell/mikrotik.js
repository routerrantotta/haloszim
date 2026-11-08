/**
 * MikroTik switch eszközmodell (CRS326-24G-2S+ jellegű: 24 gigabites port – ether1…ether24 –
 * és 2 SFP+ foglalat – sfp-sfpplus1, sfp-sfpplus2), RouterOS 7 szerinti beállításokkal.
 *
 * Itt CSAK az eszköz állapota van, adatként (mint a 2960-as modellnél). A RouterOS-szerű
 * parancssor (gyartok/routeros) ezt módosítja, a bridge működése (VLAN-szűrés, MAC-tábla,
 * a switch saját IP-címei) a mag/hid.js-ben van.
 *
 * A Cisco-switchtől eltérő felépítés:
 *   - a portok egy BRIDGE-be kerülnek (hidPortok), és a bridge kapcsol közöttük;
 *   - VLAN-ok: a bridge VLAN-táblája (hidVlanok) – VLAN-onként a címkézett (tagged, „trunk”) és
 *     címkézetlen (untagged, „access”) tagok; a portok saját VLAN-ja a PVID;
 *   - mindez csak akkor számít, ha a bridge-en be van kapcsolva a VLAN-szűrés (vlan-filtering);
 *   - a switch saját IP-címe egy interfészen van (a bridge-en vagy egy VLAN-interfészen).
 *
 * Gyári állapot (defconf): minden port a „bridge” nevű bridge-ben, a bridge-en 192.168.88.1/24.
 */

import { macNevbol } from '../mag/ethernet.js';

/** A modell neve (a rajzon és az export fejlécében). */
export const MODELL = 'CRS326-24G-2S+';
/** A RouterOS változat, amelyet a kimenetek utánoznak. */
export const ROS_VERZIO = '7.24';

/** A bridge-portok lehetséges kerettípus-szűrői (frame-types). */
export const KERETTIPUSOK = ['admit-all', 'admit-only-untagged-and-priority-tagged', 'admit-only-vlan-tagged'];

/**
 * @typedef {Object} MtPort – fizikai port (a 2960-as Port mezőivel összhangban)
 * @property {string} nev       – pl. "ether1", "sfp-sfpplus1"
 * @property {string} rovid     – ugyanaz (a RouterOS nem rövidít)
 * @property {string} tipus     – "ether" vagy "sfp-sfpplus"
 * @property {string} szam      – "1", "2" …
 * @property {boolean} leallitva – letiltva (/interface disable)
 * @property {boolean} fent      – üzemi állapot (a mag állítja)
 * @property {string} mac
 * @property {string} komment
 */

/**
 * @typedef {Object} Hid – bridge
 * @property {string} nev
 * @property {string} mac
 * @property {boolean} vlanSzures    – vlan-filtering
 * @property {number} pvid           – a bridge (a switch „saját” portja) VLAN-ja
 * @property {string} kerettipus     – frame-types
 * @property {boolean} bemenetiSzures – ingress-filtering
 * @property {string} komment
 * @property {boolean} letiltva
 */

/**
 * @typedef {Object} HidPort – bridge-port (/interface bridge port)
 * @property {string} interfesz
 * @property {string} hid
 * @property {number} pvid
 * @property {string} kerettipus
 * @property {boolean} bemenetiSzures
 * @property {string} komment
 * @property {boolean} letiltva
 */

/**
 * @typedef {Object} HidVlan – a bridge VLAN-táblájának egy sora (/interface bridge vlan)
 * @property {string} hid
 * @property {string} vlanok      – vlan-ids, ahogy beírták (pl. "10" vagy "10,20" vagy "30-35")
 * @property {string[]} cimkezett  – tagged
 * @property {string[]} cimkezetlen – untagged
 * @property {string} komment
 * @property {boolean} letiltva
 */

function ujPort(tipus, szam) {
  const nev = tipus + szam;
  return { nev, rovid: nev, tipus, szam: String(szam), leallitva: false, fent: false, mac: '', komment: '' };
}

/** Egy új bridge alapértékei. */
export function ujHid(nev, mac) {
  return { nev, mac, vlanSzures: false, pvid: 1, kerettipus: 'admit-all', bemenetiSzures: true, komment: '', letiltva: false };
}

/** Egy új bridge-port alapértékei (RouterOS 7: ingress-filtering=yes). */
export function ujHidPort(interfesz, hid) {
  return { interfesz, hid, pvid: 1, kerettipus: 'admit-all', bemenetiSzures: true, komment: '', letiltva: false };
}

/**
 * Új, gyári (defconf) állapotú CRS326 jellegű switch.
 * @param {{hostname?: string, gyari?: boolean}} [b] – gyari: false → üres konfiguráció (bridge és IP nélkül)
 */
export function ujCrs326(b = {}) {
  const hostname = b.hostname || 'MikroTik';
  const portok = [];
  for (let i = 1; i <= 24; i++) portok.push(ujPort('ether', i));
  for (let i = 1; i <= 2; i++) portok.push(ujPort('sfp-sfpplus', i));
  for (const p of portok) p.mac = macNevbol(`mikrotik:${hostname}:${p.nev}`);
  const sw = {
    tipus: 'switch',
    gyarto: 'mikrotik',
    modell: MODELL,
    hostname,
    felhasznalo: 'admin',
    portok,
    hidak: [],
    hidPortok: [],
    hidVlanok: [],
    vlanIfek: [],
    ipCimek: [],
    macTabla: [],
    mac: portok[0].mac,
  };
  if (b.gyari !== false) {
    // A gyári beállítás (defconf): minden port egy bridge-ben, a bridge-en a 192.168.88.1/24.
    const h = ujHid('bridge', portok[0].mac);
    h.komment = 'defconf';
    h.adminMac = portok[0].mac;
    sw.hidak.push(h);
    for (const p of portok) sw.hidPortok.push({ ...ujHidPort(p.nev, 'bridge'), komment: 'defconf' });
    sw.ipCimek.push({ cim: '192.168.88.1', hossz: 24, interfesz: 'bridge', komment: 'defconf', letiltva: false });
  }
  return sw;
}

/** Egy fizikai port név szerint. */
export function mtPort(sw, nev) {
  return sw.portok.find((p) => p.nev === nev);
}

/** Egy bridge név szerint. */
export function hidKeres(sw, nev) {
  return sw.hidak.find((h) => h.nev === nev);
}

/** Egy VLAN-interfész név szerint. */
export function vlanIfKeres(sw, nev) {
  return sw.vlanIfek.find((v) => v.nev === nev);
}

/**
 * Minden interfész neve és fajtája: fizikai portok, bridge-ek, VLAN-interfészek.
 * @returns {{nev: string, fajta: 'ether'|'bridge'|'vlan', elem: Object}[]}
 */
export function interfeszek(sw) {
  return [
    ...sw.portok.map((p) => ({ nev: p.nev, fajta: 'ether', elem: p })),
    ...sw.hidak.map((h) => ({ nev: h.nev, fajta: 'bridge', elem: h })),
    ...sw.vlanIfek.map((v) => ({ nev: v.nev, fajta: 'vlan', elem: v })),
  ];
}

/** Interfész keresése név szerint (bármelyik fajta). */
export function interfeszKeres(sw, nev) {
  return interfeszek(sw).find((i) => i.nev === nev) || null;
}

/**
 * A vlan-ids szöveg értelmezése: „10”, „10,20”, „30-35” → számok listája; hibás alaknál null.
 * @param {string} szoveg
 * @returns {number[]|null}
 */
export function vlanListaElemez(szoveg) {
  const ki = [];
  for (const resz of String(szoveg).split(',')) {
    const m = /^(\d{1,4})(?:-(\d{1,4}))?$/.exec(resz.trim());
    if (!m) return null;
    const a = Number(m[1]);
    const b = m[2] !== undefined ? Number(m[2]) : a;
    if (a < 1 || b > 4094 || b < a) return null;
    for (let v = a; v <= b; v++) if (!ki.includes(v)) ki.push(v);
  }
  return ki;
}

/** A VLAN-tábla egy sorának VLAN-számai. */
export function sorVlanjai(sor) {
  return vlanListaElemez(sor.vlanok) || [];
}

/** MAC-cím a RouterOS írásmódjában: 48:A9:8A:01:02:03. */
export function macSzoveg(mac) {
  return mac.toUpperCase().match(/.{2}/g).join(':');
}

/**
 * A switch konfigurációjának mély másolata (a Safe Mode ebből állítja vissza a régi állapotot).
 * A MAC-tábla és az üzemi állapot (fent) nem része a konfigurációnak.
 */
export function konfigMentes(sw) {
  const m = JSON.parse(JSON.stringify({
    hostname: sw.hostname, hidak: sw.hidak, hidPortok: sw.hidPortok, hidVlanok: sw.hidVlanok, vlanIfek: sw.vlanIfek, ipCimek: sw.ipCimek,
  }));
  m.portok = sw.portok.map((p) => ({ nev: p.nev, leallitva: p.leallitva, komment: p.komment }));
  return m;
}

/**
 * A mentett konfiguráció visszaállítása. Visszaadja azokat a portokat, amelyeknek a letiltása
 * megváltozott (ezeknél a hálózatnak is szólni kell).
 */
export function konfigVisszaallit(sw, m) {
  sw.hostname = m.hostname;
  sw.hidak = m.hidak;
  sw.hidPortok = m.hidPortok;
  sw.hidVlanok = m.hidVlanok;
  sw.vlanIfek = m.vlanIfek;
  sw.ipCimek = m.ipCimek;
  const valtozott = [];
  for (const mp of m.portok) {
    const p = mtPort(sw, mp.nev);
    p.komment = mp.komment;
    if (p.leallitva !== mp.leallitva) {
      p.leallitva = mp.leallitva;
      valtozott.push(p);
    }
  }
  sw.macTabla = [];
  return valtozott;
}
