/**
 * Interfész-parancsok: interface, interface range, shutdown, no shutdown.
 */

import { SZO } from './alap.js';
import { portKeres } from '../../../modell/switch.js';

const INTERFACE_SZO = { szo: 'interface', sugo: 'Interfész (port) kiválasztása a beállításhoz' };
const IF_MODOK = ['konfig-if', 'konfig-if-tartomany'];

export const interfeszParancsok = [
  {
    modok: ['konfig'],
    szavak: [INTERFACE_SZO, { param: 'interfesz', kulcs: 'interfesz', sugo: 'Az interfész neve' }],
    vegrehajt(ctx, { interfesz }) {
      ctx.modValt('konfig-if', { portok: [interfesz] });
    },
  },
  {
    modok: ['konfig'],
    szavak: [
      INTERFACE_SZO,
      { szo: 'range', sugo: 'Több interfész kiválasztása egyszerre (pl. fa0/1 - 4)' },
      { param: 'interfesz-tartomany', kulcs: 'portok', sugo: 'Interfészek listája vagy tartománya' },
    ],
    vegrehajt(ctx, { portok }) {
      ctx.modValt('konfig-if-tartomany', { portok });
    },
  },
  {
    modok: IF_MODOK,
    szavak: [{ szo: 'shutdown', sugo: 'Az interfész lekapcsolása' }],
    vegrehajt(ctx) {
      for (const nev of ctx.kontextus.portok) {
        const p = portKeres(ctx.eszkoz, nev);
        if (!p.leallitva) {
          p.leallitva = true;
          ctx.naplo(`%LINK-5-CHANGED: Interface ${p.nev}, changed state to administratively down`);
        }
      }
    },
  },
  {
    modok: IF_MODOK,
    szavak: [SZO.no, { szo: 'shutdown', sugo: 'Az interfész bekapcsolása' }],
    vegrehajt(ctx) {
      // Kábel még nincs, ezért a port bekapcsolás után is „down” marad, és nem jön üzenet.
      for (const nev of ctx.kontextus.portok) portKeres(ctx.eszkoz, nev).leallitva = false;
    },
  },
];
