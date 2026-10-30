/**
 * VTP-parancsok (globális konfigurációs mód) és a show vtp …
 *   vtp mode server | client | transparent
 *   vtp domain <név>
 *   vtp password <jelszó>, no vtp password
 *   vtp version <1-3>
 *   show vtp status, show vtp password
 *
 * A válaszüzenetek formája: docs/forrasok.md.
 */

import { SZO } from './alap.js';
import { vtpBeallitasValtozas, vtpVlanValtozas } from '../../../mag/vtp.js';
import { showVtpStatus, showVtpPassword } from '../kimenetek/vtp-status.js';

const VTP = { szo: 'vtp', sugo: 'VTP (VLAN Trunking Protocol) beállításai' };
const MODE = { szo: 'mode', sugo: 'A switch VTP-szerepe' };
const MOD_NEV = { server: 'SERVER', client: 'CLIENT', transparent: 'TRANSPARENT' };

function modParancs(mod, sugo) {
  return {
    modok: ['konfig'],
    szavak: [VTP, MODE, { szo: mod, sugo }],
    vegrehajt(ctx) {
      const sw = ctx.eszkoz;
      if (sw.vtpMod === mod) {
        ctx.kiir(`Device mode already VTP ${MOD_NEV[mod]}.`);
        return;
      }
      sw.vtpMod = mod;
      // Transparent módba lépéskor a revíziószám nullázódik (ezzel lehet „kitakarítani” egy switchet).
      if (mod === 'transparent') sw.vtpRevizio = 0;
      ctx.kiir(`Setting device to VTP ${MOD_NEV[mod]} mode.`);
      vtpBeallitasValtozas(sw);
    },
  };
}

export const vtpParancsok = [
  modParancs('server', 'Server: VLAN-okat hoz létre és hirdet (gyári érték)'),
  modParancs('client', 'Client: a serverek hirdetéséből veszi át a VLAN-okat, maga nem módosíthat'),
  modParancs('transparent', 'Transparent: saját, helyi VLAN-ok; mások hirdetését csak továbbengedi'),
  {
    modok: ['konfig'],
    szavak: [VTP, { szo: 'domain', sugo: 'A VTP-tartomány neve' },
      { param: 'szo', kulcs: 'nev', maxHossz: 32, sugo: 'A tartomány neve (legfeljebb 32 karakter, kis- és nagybetű számít)' }],
    vegrehajt(ctx, { nev }) {
      const sw = ctx.eszkoz;
      if (sw.vtpTartomany === nev) {
        ctx.kiir(`Domain name already set to ${nev}.`);
        return;
      }
      ctx.kiir(`Changing VTP domain name from ${sw.vtpTartomany || 'NULL'} to ${nev}`);
      sw.vtpTartomany = nev;
      // Új tartomány = új kezdet: a revíziószám nullázódik.
      sw.vtpRevizio = 0;
      vtpBeallitasValtozas(sw);
    },
  },
  {
    modok: ['konfig'],
    szavak: [VTP, { szo: 'password', sugo: 'A VTP-jelszó (a tartomány minden switchén azonos legyen)' },
      { param: 'szo', kulcs: 'jelszo', maxHossz: 64, sugo: 'A jelszó (szóköz nélkül)' }],
    vegrehajt(ctx, { jelszo }) {
      ctx.eszkoz.vtpJelszo = jelszo;
      ctx.kiir(`Setting device VLAN database password to ${jelszo}`);
      vtpBeallitasValtozas(ctx.eszkoz);
    },
  },
  {
    modok: ['konfig'],
    szavak: [SZO.no, VTP, { szo: 'password', sugo: 'A VTP-jelszó törlése' }],
    vegrehajt(ctx) {
      ctx.eszkoz.vtpJelszo = '';
      ctx.kiir('Clearing device VLAN database password.');
      vtpBeallitasValtozas(ctx.eszkoz);
    },
  },
  {
    modok: ['konfig'],
    szavak: [VTP, { szo: 'version', sugo: 'A VTP verziója' },
      { param: 'szam', kulcs: 'verzio', min: 1, max: 3, sugo: 'A verzió (1, 2 vagy 3)' }],
    vegrehajt(ctx, { verzio }) {
      const sw = ctx.eszkoz;
      if (verzio === 3) {
        ctx.kiir('[Szimulátor] A VTP 3-as verziója a szimulátorban még nincs meg. Használd a 2-est: vtp version 2', '');
        return;
      }
      if (sw.vtpMod === 'client') {
        ctx.kiir('Cannot modify version in VTP client mode');
        return;
      }
      if (sw.vtpVerzio === verzio) return;
      sw.vtpVerzio = verzio;
      // A serveren a verzióváltás is módosítás: nő a revízió, és a hirdetés viszi a többiekhez.
      if (sw.vtpMod === 'server') vtpVlanValtozas(sw);
    },
  },
  {
    modok: ['felhasznalo', 'priv'],
    szavak: [{ szo: 'show', sugo: 'Információk megjelenítése az eszközről' }, VTP,
      { szo: 'status', sugo: 'A VTP állapota: szerep, tartomány, verzió, revíziószám' }],
    vegrehajt(ctx) {
      ctx.kiir(...showVtpStatus(ctx.eszkoz));
    },
  },
  {
    modok: ['priv'],
    szavak: [{ szo: 'show', sugo: 'Információk megjelenítése az eszközről' }, VTP,
      { szo: 'password', sugo: 'A beállított VTP-jelszó' }],
    vegrehajt(ctx) {
      ctx.kiir(...showVtpPassword(ctx.eszkoz));
    },
  },
];
