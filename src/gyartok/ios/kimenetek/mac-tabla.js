/**
 * A „show mac address-table” kimenete (2960 jellegű forma).
 *
 * A valódi switch a saját vezérlőprotokolljainak (pl. feszítőfa, CDP) csoportcímeit és a
 * szórási címet „STATIC … CPU” sorokként mutatja – ezek protokoll-szabványcímek,
 * mi is kiírjuk őket, hogy a kimenet ismerős legyen. Utánuk jönnek a megtanult címek.
 */

import { macTabla } from '../../../mag/kapcsolas.js';
import { macPontos } from '../../../mag/ethernet.js';
import { ROVID_TIPUSNEV } from '../../../modell/switch.js';

/** A switch saját (statikus, a CPU-nak szóló) címei. */
const STATIKUS = [
  '0100.0ccc.cccc', '0100.0ccc.cccd',
  ...Array.from({ length: 16 }, (_, i) => `0180.c200.00${i.toString(16).padStart(2, '0')}`),
  '0180.c200.0010', 'ffff.ffff.ffff',
];

function rovidPortnev(nev) {
  const m = /^([A-Za-z]+)(.*)$/.exec(nev);
  return (ROVID_TIPUSNEV[m[1]] || m[1]) + m[2];
}

function sor(vlan, mac, tipus, port) {
  return `${String(vlan).padStart(4)}    ${mac}    ${tipus.padEnd(8)}    ${port}`;
}

/**
 * @param {Object} sw
 * @param {{csakDinamikus?: boolean}} [p]
 * @returns {string[]}
 */
export function showMacTabla(sw, { csakDinamikus = false } = {}) {
  const s = [
    '          Mac Address Table',
    '-------------------------------------------',
    '',
    'Vlan    Mac Address       Type        Ports',
    '----    -----------       --------    -----',
  ];
  let db = 0;
  if (!csakDinamikus) {
    for (const m of STATIKUS) s.push(sor('All', m, 'STATIC', 'CPU'));
    db += STATIKUS.length;
  }
  const dinamikus = macTabla(sw).slice().sort((a, b) => a.vlan - b.vlan || a.mac.localeCompare(b.mac));
  for (const b of dinamikus) s.push(sor(b.vlan, macPontos(b.mac), 'DYNAMIC', rovidPortnev(b.port)));
  db += dinamikus.length;
  s.push(`Total Mac Addresses for this criterion: ${db}`);
  return s;
}
