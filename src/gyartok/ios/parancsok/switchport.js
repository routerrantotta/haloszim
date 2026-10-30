/**
 * Switchport-parancsok (interfész-, illetve interfésztartomány-módban):
 *   switchport mode access | trunk | dynamic auto | dynamic desirable
 *   no switchport mode                 → vissza a gyári dynamic auto módba
 *   switchport access vlan <1-4094>
 *   no switchport access vlan          → vissza az 1-es VLAN-ba
 *
 * Valódi viselkedés: ha az access VLAN még nem létezik, a switch létrehozza
 * („% Access VLAN does not exist. Creating vlan 30”).
 */

import { SZO } from './alap.js';
import { portKeres, alapVlanNev } from '../../../modell/switch.js';
import { macTorolPort } from '../../../mag/kapcsolas.js';
import { portValtozott } from '../../../mag/halozat.js';
import { vtpVlanValtozas, vtpTrunkValtozas } from '../../../mag/vtp.js';

const IF_MODOK = ['konfig-if', 'konfig-if-tartomany'];
const SWITCHPORT = { szo: 'switchport', sugo: 'Kapcsolóport-beállítások (VLAN, üzemmód)' };
const MODE = { szo: 'mode', sugo: 'A port üzemmódja (access, trunk …)' };
const ACCESS = { szo: 'access', sugo: 'Access mód beállításai' };
const VLAN = { szo: 'vlan', sugo: 'Melyik VLAN-hoz tartozzon a port access módban' };

/** 1006 felett kiterjesztett VLAN (VTP server módban nem hozható létre). */
const KITERJESZTETT_TOL = 1006;

/** Minden kiválasztott port módosítása; utána a MAC-tábla érintett sorai törlődnek. */
function portokra(ctx, fn) {
  for (const nev of ctx.kontextus.portok) {
    const p = portKeres(ctx.eszkoz, nev);
    fn(p);
    macTorolPort(ctx.eszkoz, p.nev);
    const tul = ctx.eszkoz.halozat && ctx.eszkoz.halozat.szomszed(ctx.eszkoz, p);
    if (tul && tul.eszkoz.tipus === 'switch') macTorolPort(tul.eszkoz, tul.port.nev);
    portValtozott(ctx.eszkoz, p);
    vtpTrunkValtozas(ctx.eszkoz, p);
  }
}

function modParancs(szavak, mod) {
  return {
    modok: IF_MODOK,
    szavak: [SWITCHPORT, MODE, ...szavak],
    vegrehajt(ctx) {
      portokra(ctx, (p) => {
        p.mod = mod;
      });
    },
  };
}

const DYNAMIC = { szo: 'dynamic', sugo: 'Dinamikus mód: a trunkról a két switch egyezteti (DTP)' };

export const switchportParancsok = [
  modParancs([{ szo: 'access', sugo: 'Access port: egyetlen VLAN, címke nélküli keretek' }], 'access'),
  modParancs([{ szo: 'trunk', sugo: 'Trunk port: több VLAN forgalma, 802.1Q-címkével' }], 'trunk'),
  modParancs([DYNAMIC, { szo: 'auto', sugo: 'Akkor lesz trunk, ha a túloldal kezdeményezi (gyári érték)' }], 'dinamikus-auto'),
  modParancs([DYNAMIC, { szo: 'desirable', sugo: 'Maga kezdeményezi a trunkot' }], 'dinamikus-kezdemenyezo'),
  {
    modok: IF_MODOK,
    szavak: [SZO.no, SWITCHPORT, { szo: 'mode', sugo: 'Az üzemmód visszaállítása a gyári értékre (dynamic auto)' }],
    vegrehajt(ctx) {
      portokra(ctx, (p) => {
        p.mod = 'dinamikus-auto';
      });
    },
  },
  {
    modok: IF_MODOK,
    szavak: [SWITCHPORT, ACCESS, VLAN, { param: 'szam', kulcs: 'vlan', min: 1, max: 4094, sugo: 'A VLAN száma' }],
    vegrehajt(ctx, { vlan }) {
      const sw = ctx.eszkoz;
      // Kliens módban a switch nem hozhat létre VLAN-t: a port beáll, de a VLAN-t a VTP-nek kell hoznia.
      if (!sw.vlanok[vlan] && sw.vtpMod !== 'client') {
        if (vlan >= KITERJESZTETT_TOL && sw.vtpMod !== 'transparent') {
          ctx.kiir('Extended VLAN(s) not allowed in current VTP mode.', '%Failed to commit extended VLAN(s) changes.');
          return;
        }
        ctx.kiir(`% Access VLAN does not exist. Creating vlan ${vlan}`);
        sw.vlanok[vlan] = { nev: alapVlanNev(vlan), gyari: false, tamogatott: true };
        vtpVlanValtozas(sw);
      }
      portokra(ctx, (p) => {
        p.accessVlan = vlan;
      });
    },
  },
  {
    modok: IF_MODOK,
    szavak: [SZO.no, SWITCHPORT, ACCESS, { szo: 'vlan', sugo: 'Vissza az 1-es VLAN-ba' }],
    vegrehajt(ctx) {
      portokra(ctx, (p) => {
        p.accessVlan = 1;
      });
    },
  },
];
