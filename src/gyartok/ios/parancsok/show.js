/**
 * Show-parancsok. A kimenet formázása a kimenetek/ mappában van.
 */

import { showVlanBrief } from '../kimenetek/vlan-brief.js';
import { showRunningConfig } from '../kimenetek/running-config.js';
import { showInterfacesTrunk, showInterfacesStatus } from '../kimenetek/interfaces.js';
import { showMacTabla } from '../kimenetek/mac-tabla.js';

const SHOW = { szo: 'show', sugo: 'Információk megjelenítése az eszközről' };
const VLAN = { szo: 'vlan', sugo: 'A VLAN-ok adatai' };
const INTERFACES = { szo: 'interfaces', sugo: 'Az interfészek (portok) állapota' };
const MAC = { szo: 'mac', sugo: 'MAC-beállítások' };
const ADDRESS_TABLE = { szo: 'address-table', sugo: 'A MAC-címtábla: melyik cím melyik porton és VLAN-ban van' };
const EXEC = ['felhasznalo', 'priv'];

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
  {
    modok: EXEC,
    szavak: [SHOW, INTERFACES, { szo: 'trunk', sugo: 'A trunk portok: mód, natív VLAN, átengedett VLAN-ok' }],
    lapozhato: true,
    vegrehajt(ctx) {
      ctx.kiir(...showInterfacesTrunk(ctx.eszkoz));
    },
  },
  {
    modok: EXEC,
    szavak: [SHOW, INTERFACES, { szo: 'status', sugo: 'Összefoglaló: portonként állapot, VLAN, sebesség' }],
    lapozhato: true,
    vegrehajt(ctx) {
      ctx.kiir(...showInterfacesStatus(ctx.eszkoz));
    },
  },
  {
    modok: EXEC,
    szavak: [SHOW, MAC, ADDRESS_TABLE],
    lapozhato: true,
    vegrehajt(ctx) {
      ctx.kiir(...showMacTabla(ctx.eszkoz));
    },
  },
  {
    modok: EXEC,
    szavak: [SHOW, MAC, ADDRESS_TABLE, { szo: 'dynamic', sugo: 'Csak a megtanult (dinamikus) címek' }],
    lapozhato: true,
    vegrehajt(ctx) {
      ctx.kiir(...showMacTabla(ctx.eszkoz, { csakDinamikus: true }));
    },
  },
];
