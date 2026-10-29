/**
 * Show-parancsok. A kimenet formázása a kimenetek/ mappában van.
 */

import { showVlanBrief } from '../kimenetek/vlan-brief.js';
import { showRunningConfig } from '../kimenetek/running-config.js';

const SHOW = { szo: 'show', sugo: 'Információk megjelenítése az eszközről' };
const VLAN = { szo: 'vlan', sugo: 'A VLAN-ok adatai' };

export const showParancsok = [
  {
    modok: ['felhasznalo', 'priv'],
    szavak: [SHOW, VLAN, { szo: 'brief', sugo: 'Rövid összefoglaló: VLAN-ok, állapotuk és portjaik' }],
    lapozhato: true,
    vegrehajt(ctx) {
      ctx.kiir(...showVlanBrief(ctx.eszkoz));
    },
  },
  {
    // A teljes „show vlan” a valódi eszközön működik; a szimulátorban még nincs meg.
    modok: ['felhasznalo', 'priv'],
    szavak: [SHOW, VLAN],
    vegrehajt(ctx) {
      ctx.kiir('[Szimulátor] A teljes „show vlan” még nincs meg. Próbáld így: show vlan brief', '');
    },
  },
  {
    modok: ['priv'],
    szavak: [SHOW, { szo: 'running-config', sugo: 'Az éppen futó (érvényes) konfiguráció' }],
    lapozhato: true,
    vegrehajt(ctx) {
      ctx.kiir(...showRunningConfig(ctx.eszkoz));
    },
  },
];
