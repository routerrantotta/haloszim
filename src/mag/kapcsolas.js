/**
 * A switch működése (2. réteg), gyártófüggetlenül:
 *   - melyik VLAN-ba tartozik a beérkező keret (access port: a port VLAN-ja;
 *     trunk: a 802.1Q-címke, címke nélkül a natív VLAN),
 *   - MAC-cím tanulása (forrás MAC → port, VLAN-onként), öregedés 300 s után,
 *   - továbbítás: ismert cél → egy port; ismeretlen vagy szórás → az összes többi port
 *     abban a VLAN-ban (elárasztás); trunkon címkével, access porton címke nélkül,
 *   - DTP (egyszerűsítve): a „dynamic auto” port trunk lesz, ha a túloldal trunk vagy
 *     „dynamic desirable”; két „dynamic auto” port között nem lesz trunk. Ha a két switch
 *     VTP-tartományneve különbözik (és egyik sem üres), a dinamikus egyeztetés nem sikerül.
 *   - A VTP-kereteket a switch nem továbbítja, hanem maga dolgozza fel (mag/vtp.js).
 */

import { SZORAS } from './ethernet.js';
import { vtpFogad } from './vtp.js';
import { esRag, nevelo } from '../magyar.js';

/** A MAC-bejegyzések élettartama (az IOS alapértéke 300 másodperc). */
export const MAC_ELETKOR = 300000;

/**
 * A port tényleges (üzemi) módja: 'trunk' vagy 'access'.
 * @param {Object} sw
 * @param {Object} port
 * @returns {'trunk'|'access'}
 */
export function uzemmod(sw, port) {
  if (port.mod === 'trunk') return 'trunk';
  if (port.mod === 'access') return 'access';
  if (!port.fent || !sw.halozat) return 'access';
  const tul = sw.halozat.szomszed(sw, port);
  if (!tul || tul.eszkoz.tipus !== 'switch') return 'access';
  const m = tul.port.mod;
  // A DTP a VTP-tartománynevet is elküldi: eltérő nevek esetén nincs egyeztetett trunk.
  const t1 = sw.vtpTartomany;
  const t2 = tul.eszkoz.vtpTartomany;
  if (t1 && t2 && t1 !== t2 && m !== 'trunk') return 'access';
  if (port.mod === 'dinamikus-auto') return m === 'trunk' || m === 'dinamikus-kezdemenyezo' ? 'trunk' : 'access';
  if (port.mod === 'dinamikus-kezdemenyezo') return m === 'access' ? 'access' : 'trunk';
  return 'access';
}

/** Működő VLAN-e ezen a switchen (létezik és támogatott). */
export function vlanAktiv(sw, vlan) {
  const v = sw.vlanok[vlan];
  return !!v && v.tamogatott !== false;
}

/** Továbbíthat-e a port az adott VLAN-ban. */
export function portTagja(sw, port, vlan) {
  if (uzemmod(sw, port) === 'trunk') return vlanAktiv(sw, vlan);
  return port.accessVlan === vlan;
}

/** Az élő (még el nem öregedett) MAC-bejegyzések; a régieket közben törli. */
export function macTabla(sw) {
  const ido = sw.halozat ? sw.halozat.ora.ido : 0;
  sw.macTabla = (sw.macTabla || []).filter((b) => ido - b.ido < MAC_ELETKOR);
  return sw.macTabla;
}

/** Egy port összes megtanult címének törlése (pl. a link leesésekor). */
export function macTorolPort(sw, portNev) {
  sw.macTabla = (sw.macTabla || []).filter((b) => b.port !== portNev);
}

function macTanul(sw, vlan, mac, portNev, ido) {
  const t = macTabla(sw);
  const b = t.find((x) => x.vlan === vlan && x.mac === mac);
  if (b) {
    b.port = portNev;
    b.ido = ido;
  } else {
    t.push({ vlan, mac, port: portNev, ido });
  }
}

/**
 * Egy keret megérkezett a switch egyik portjára.
 * @param {import('./halozat.js').Halozat} h
 */
export function kapcsoloFogad(h, sw, port, keret) {
  if (keret.tipus === 'vtp') return vtpFogad(h, sw, port, keret);
  let vlan;
  if (uzemmod(sw, port) === 'trunk') {
    vlan = keret.vlan !== undefined ? keret.vlan : port.nativVlan;
  } else {
    if (keret.vlan !== undefined) return h.eldob(sw, port, keret, 'Címkés (802.1Q) keret érkezett egy access portra.');
    vlan = port.accessVlan;
  }
  if (!vlanAktiv(sw, vlan)) {
    return h.eldob(sw, port, keret, `${nevelo(vlan) === 'az' ? 'Az' : 'A'} ${esRag(vlan)} VLAN nem létezik ezen a switchen (${sw.hostname}), ezért a keretet eldobta.`);
  }

  if (keret.forrasMac !== SZORAS) macTanul(sw, vlan, keret.forrasMac, port.nev, h.ora.ido);

  let kimenok;
  const ismert = keret.celMac !== SZORAS && macTabla(sw).find((b) => b.vlan === vlan && b.mac === keret.celMac);
  if (ismert) {
    if (ismert.port === port.nev) return; // a cél ugyanazon a porton van: nincs mit továbbítani
    kimenok = sw.portok.filter((p) => p.nev === ismert.port);
  } else {
    kimenok = sw.portok.filter((p) => p !== port);
  }

  for (const p of kimenok) {
    if (!p.fent || !portTagja(sw, p, vlan)) continue;
    const trunk = uzemmod(sw, p) === 'trunk';
    const cimke = trunk && vlan !== p.nativVlan ? vlan : undefined;
    h.kuld(sw, p, { ...keret, vlan: cimke });
  }
}
