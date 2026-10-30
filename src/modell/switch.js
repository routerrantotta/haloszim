/**
 * Switch-eszközmodell (Catalyst 2960-24 jellegű, 24 db FastEthernet + 2 db GigabitEthernet port).
 *
 * Itt CSAK az eszköz állapota van, adatként. A parancsok ezt módosítják, a show-parancsok
 * ebből olvasnak. A modell gyártófüggetlen: nem tudja, milyen parancssor állítja.
 */

/**
 * @typedef {Object} Vlan
 * @property {string} nev     – a VLAN neve (max. 32 karakter)
 * @property {boolean} gyari  – gyári VLAN (1, 1002–1005): nem törölhető, nem nevezhető át
 * @property {boolean} [tamogatott=true] – a 1002–1005 (FDDI, Token Ring) itt nem támogatott
 */

/**
 * @typedef {Object} Port
 * @property {string} nev       – teljes név, pl. "FastEthernet0/1"
 * @property {string} rovid     – rövid név, pl. "Fa0/1"
 * @property {string} tipus     – "FastEthernet" vagy "GigabitEthernet"
 * @property {string} szam      – pl. "0/1"
 * @property {boolean} leallitva – adminisztratívan le van-e kapcsolva (shutdown)
 * @property {number} accessVlan – melyik VLAN-ba tartozik access módban
 * @property {'dinamikus-auto'|'dinamikus-kezdemenyezo'|'access'|'trunk'} mod – a beállított üzemmód
 *           (switchport mode …; a 2960 gyári értéke a dynamic auto)
 * @property {number} nativVlan  – trunk módban a címke nélküli keretek VLAN-ja (gyárilag 1)
 * @property {boolean} fent      – üzemi állapot: van kábel, mindkét vége bekapcsolva (a mag állítja)
 */

/**
 * @typedef {Object} MacBejegyzes
 * @property {number} vlan
 * @property {string} mac  – 12 hexa számjegy
 * @property {string} port – a port teljes neve
 * @property {number} ido  – mikor látta utoljára (szimulált ms)
 */

/**
 * @typedef {Object} SwitchAllapot
 * @property {string} tipus     – "switch"
 * @property {string} modell    – "2960-24"
 * @property {string} hostname
 * @property {string} vtpMod    – VTP-szerep: "server" (gyári), "client", "transparent"
 * @property {Object<number, Vlan>} vlanok – VLAN-szám → adatok
 * @property {Port[]} portok    – a portok a fizikai sorrendjükben
 * @property {MacBejegyzes[]} macTabla – a megtanult MAC-címek (MAC address table)
 * @property {string} mac        – a switch saját (alap) MAC-címe (show vtp status: Device ID)
 * @property {string} vtpTartomany – VTP-tartomány neve ('' = NULL, gyári)
 * @property {string} vtpJelszo  – VTP-jelszó ('' = nincs)
 * @property {number} vtpVerzio  – 1 vagy 2
 * @property {number} vtpRevizio – a VLAN-adatbázis revíziószáma (configuration revision)
 * @property {number|null} vtpModositva – mikor módosult utoljára (szimulált ms), null = soha
 * @property {string|null} vtpMd5Hiba – melyik trunkon jött eltérő jelszavú hirdetés (rövid portnév)
 */

import { macNevbol } from '../mag/ethernet.js';

/** Az alapértelmezett gépnév. */
export const ALAP_HOSTNAME = 'Switch';

/** Gyári VLAN-ok, amelyek minden switchen megvannak. */
function gyariVlanok() {
  return {
    1: { nev: 'default', gyari: true, tamogatott: true },
    1002: { nev: 'fddi-default', gyari: true, tamogatott: false },
    1003: { nev: 'token-ring-default', gyari: true, tamogatott: false },
    1004: { nev: 'fddinet-default', gyari: true, tamogatott: false },
    1005: { nev: 'trnet-default', gyari: true, tamogatott: false },
  };
}

/** Rövid portnév-előtagok. */
export const ROVID_TIPUSNEV = { FastEthernet: 'Fa', GigabitEthernet: 'Gi' };

function ujPort(tipus, szam) {
  return {
    nev: tipus + szam,
    rovid: ROVID_TIPUSNEV[tipus] + szam,
    tipus,
    szam,
    leallitva: false,
    accessVlan: 1,
    mod: 'dinamikus-auto',
    nativVlan: 1,
    fent: false,
  };
}

/**
 * Új, gyári állapotú 2960-as switch.
 * @param {{hostname?: string}} [beallitasok]
 * @returns {SwitchAllapot}
 */
export function ujSwitch2960(beallitasok = {}) {
  const portok = [];
  for (let i = 1; i <= 24; i++) portok.push(ujPort('FastEthernet', `0/${i}`));
  for (let i = 1; i <= 2; i++) portok.push(ujPort('GigabitEthernet', `0/${i}`));
  return {
    tipus: 'switch',
    modell: '2960-24',
    hostname: beallitasok.hostname || ALAP_HOSTNAME,
    vtpMod: 'server',
    vlanok: gyariVlanok(),
    portok,
    macTabla: [],
    mac: macNevbol('switch:' + (beallitasok.hostname || ALAP_HOSTNAME)),
    vtpTartomany: '',
    vtpJelszo: '',
    vtpVerzio: 1,
    vtpRevizio: 0,
    vtpModositva: null,
    vtpMd5Hiba: null,
  };
}

/**
 * Megkeres egy portot a teljes neve alapján (pl. "FastEthernet0/1").
 * @param {SwitchAllapot} sw
 * @param {string} nev
 * @returns {Port | undefined}
 */
export function portKeres(sw, nev) {
  return sw.portok.find((p) => p.nev === nev);
}

/**
 * Az eszközön létező porttípusok és a hozzájuk tartozó számok (a parancssor ebből tudja,
 * mi írható be az interface parancs után).
 * @param {SwitchAllapot} sw
 * @returns {Object<string, string[]>} pl. { FastEthernet: ["0/1", …], GigabitEthernet: ["0/1","0/2"] }
 */
export function portTipusok(sw) {
  const eredmeny = {};
  for (const p of sw.portok) {
    (eredmeny[p.tipus] = eredmeny[p.tipus] || []).push(p.szam);
  }
  return eredmeny;
}

/** Az alapértelmezett VLAN-név: VLAN + négyjegyű szám, pl. 10 → "VLAN0010". */
export function alapVlanNev(szam) {
  return 'VLAN' + String(szam).padStart(4, '0');
}
