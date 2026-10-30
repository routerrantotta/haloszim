/**
 * VLAN-parancsok: vlan <szám>, name <név>, no vlan, no name.
 */

import { SZO } from './alap.js';
import { alapVlanNev } from '../../../modell/switch.js';
import { vtpVlanValtozas } from '../../../mag/vtp.js';

const VLAN_SZO = { szo: 'vlan', sugo: 'VLAN létrehozása vagy szerkesztése' };
const VLAN_SZAM = { param: 'szam', kulcs: 'vlan', min: 1, max: 4094, sugo: 'A VLAN száma' };

/** 1006–4094: kiterjesztett tartomány, csak VTP transparent módban hozható létre. */
const KITERJESZTETT_TOL = 1006;

/** VTP kliens módban a VLAN-adatbázis nem módosítható (a VTP hozza a VLAN-okat). */
function kliensTiltas(ctx) {
  if (ctx.eszkoz.vtpMod !== 'client') return false;
  ctx.kiir('VTP VLAN configuration not allowed when device is in CLIENT mode.');
  return true;
}

export const vlanParancsok = [
  {
    modok: ['konfig'],
    szavak: [VLAN_SZO, VLAN_SZAM],
    vegrehajt(ctx, { vlan }) {
      const sw = ctx.eszkoz;
      if (kliensTiltas(ctx)) return;
      if (vlan >= KITERJESZTETT_TOL && sw.vtpMod !== 'transparent') {
        ctx.kiir('Extended VLAN(s) not allowed in current VTP mode.', '%Failed to commit extended VLAN(s) changes.');
        return;
      }
      if (!sw.vlanok[vlan]) {
        sw.vlanok[vlan] = { nev: alapVlanNev(vlan), gyari: false, tamogatott: true };
        vtpVlanValtozas(sw);
      }
      ctx.modValt('konfig-vlan', { vlan });
    },
  },
  {
    modok: ['konfig'],
    szavak: [SZO.no, { szo: 'vlan', sugo: 'VLAN törlése' }, VLAN_SZAM],
    vegrehajt(ctx, { vlan }) {
      const sw = ctx.eszkoz;
      if (kliensTiltas(ctx)) return;
      const v = sw.vlanok[vlan];
      if (v && v.gyari) {
        ctx.kiir(`%Default VLAN ${vlan} may not be deleted.`);
        return;
      }
      // A portok a törölt VLAN-ban maradnak (a valódi eszközön is) – ilyenkor nem forgalmaznak.
      if (!v) return;
      delete sw.vlanok[vlan];
      vtpVlanValtozas(sw);
    },
  },
  {
    modok: ['konfig-vlan'],
    szavak: [
      { szo: 'name', sugo: 'A VLAN nevének megadása' },
      { param: 'szo', kulcs: 'nev', maxHossz: 32, sugo: 'A VLAN neve (legfeljebb 32 karakter, szóköz nélkül)' },
    ],
    vegrehajt(ctx, { nev }) {
      const szam = ctx.kontextus.vlan;
      const v = ctx.eszkoz.vlanok[szam];
      if (v.gyari) {
        ctx.kiir(`%Default VLAN ${szam} may not have its name changed.`);
        return;
      }
      if (v.nev === nev) return;
      v.nev = nev;
      vtpVlanValtozas(ctx.eszkoz);
    },
  },
  {
    modok: ['konfig-vlan'],
    szavak: [SZO.no, { szo: 'name', sugo: 'A VLAN nevének visszaállítása (VLANxxxx)' }],
    vegrehajt(ctx) {
      const szam = ctx.kontextus.vlan;
      const v = ctx.eszkoz.vlanok[szam];
      if (!v.gyari && v.nev !== alapVlanNev(szam)) {
        v.nev = alapVlanNev(szam);
        vtpVlanValtozas(ctx.eszkoz);
      }
    },
  },
];
