/**
 * VLAN-parancsok: vlan <szám>, name <név>, no vlan, no name.
 */

import { SZO } from './alap.js';
import { alapVlanNev } from '../../../modell/switch.js';

const VLAN_SZO = { szo: 'vlan', sugo: 'VLAN létrehozása vagy szerkesztése' };
const VLAN_SZAM = { param: 'szam', kulcs: 'vlan', min: 1, max: 4094, sugo: 'A VLAN száma' };

/** 1006–4094: kiterjesztett tartomány, VTP server módban nem hozható létre. */
const KITERJESZTETT_TOL = 1006;

export const vlanParancsok = [
  {
    modok: ['konfig'],
    szavak: [VLAN_SZO, VLAN_SZAM],
    vegrehajt(ctx, { vlan }) {
      const sw = ctx.eszkoz;
      if (vlan >= KITERJESZTETT_TOL && sw.vtpMod === 'server') {
        ctx.kiir('Extended VLAN(s) not allowed in current VTP mode.', '%Failed to commit extended VLAN(s) changes.');
        return;
      }
      if (!sw.vlanok[vlan]) sw.vlanok[vlan] = { nev: alapVlanNev(vlan), gyari: false, tamogatott: true };
      ctx.modValt('konfig-vlan', { vlan });
    },
  },
  {
    modok: ['konfig'],
    szavak: [SZO.no, { szo: 'vlan', sugo: 'VLAN törlése' }, VLAN_SZAM],
    vegrehajt(ctx, { vlan }) {
      const sw = ctx.eszkoz;
      const v = sw.vlanok[vlan];
      if (v && v.gyari) {
        ctx.kiir(`%Default VLAN ${vlan} may not be deleted.`);
        return;
      }
      // A portok a törölt VLAN-ban maradnak (a valódi eszközön is) – ilyenkor nem forgalmaznak.
      delete sw.vlanok[vlan];
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
      v.nev = nev;
    },
  },
  {
    modok: ['konfig-vlan'],
    szavak: [SZO.no, { szo: 'name', sugo: 'A VLAN nevének visszaállítása (VLANxxxx)' }],
    vegrehajt(ctx) {
      const szam = ctx.kontextus.vlan;
      const v = ctx.eszkoz.vlanok[szam];
      if (!v.gyari) v.nev = alapVlanNev(szam);
    },
  },
];
