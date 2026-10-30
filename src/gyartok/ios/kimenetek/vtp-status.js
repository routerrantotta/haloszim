/**
 * A „show vtp status” és a „show vtp password” kimenete (2960, IOS 15 jellegű forma, VTP 1–3-ra
 * képes szoftver). Forrás és forma: docs/forrasok.md.
 */

import { vtpMd5 } from '../../../mag/vtp.js';
import { macPontos } from '../../../mag/ethernet.js';

const MOD_NEV = { server: 'Server', client: 'Client', transparent: 'Transparent' };

/** „3-1-93 00:12:34” – az óra beállítása nélküli eszköz dátuma (a naplóban is március 1.). */
function datum(ms) {
  const mp = Math.floor(ms / 1000);
  const k = (n) => String(n).padStart(2, '0');
  const nap = 1 + Math.floor(mp / 86400);
  return `3-${nap}-93 ${k(Math.floor((mp % 86400) / 3600))}:${k(Math.floor((mp % 3600) / 60))}:${k(mp % 60)}`;
}

/** @param {Object} sw */
export function showVtpStatus(sw) {
  const sor = (cim, ertek) => `${cim.padEnd(32)}: ${ertek}`.trimEnd();
  const sor2 = (cim, ertek) => `${cim.padEnd(34)}: ${ertek}`.trimEnd();
  const md5 = vtpMd5(sw).map((b) => '0x' + b.toString(16).toUpperCase().padStart(2, '0'));
  const s = [
    sor('VTP Version capable', '1 to 3'),
    sor('VTP version running', String(sw.vtpVerzio)),
    sor('VTP Domain Name', sw.vtpTartomany),
    sor('VTP Pruning Mode', 'Disabled'),
    sor('VTP Traps Generation', 'Disabled'),
    sor('Device ID', macPontos(sw.mac)),
    `Configuration last modified by 0.0.0.0 at ${sw.vtpModositva === null ? '0-0-00 00:00:00' : datum(sw.vtpModositva)}`,
  ];
  if (sw.vtpMod === 'server') s.push('Local updater ID is 0.0.0.0 (no valid interface found)');
  s.push(
    '',
    'Feature VLAN:',
    '--------------',
    sor2('VTP Operating Mode', MOD_NEV[sw.vtpMod]),
    sor2('Maximum VLANs supported locally', '255'),
    sor2('Number of existing VLANs', String(Object.keys(sw.vlanok).length)),
    sor2('Configuration Revision', String(sw.vtpMod === 'transparent' ? 0 : sw.vtpRevizio)),
    sor2('MD5 digest', md5.slice(0, 8).join(' ')),
    ' '.repeat(36) + md5.slice(8).join(' '),
  );
  if (sw.vtpMd5Hiba) s.push(`*** MD5 digest checksum mismatch on trunk: ${sw.vtpMd5Hiba} ***`);
  return s;
}

/** @param {Object} sw */
export function showVtpPassword(sw) {
  if (!sw.vtpJelszo) return ['The VTP password is not configured.'];
  return [`VTP Password: ${sw.vtpJelszo}`];
}
