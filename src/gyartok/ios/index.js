/**
 * Az IOS-szerű parancssor „személyisége”: minden, ami erre a parancssorra jellemző.
 * A munkamenet (cli/terminal-munkamenet.js) ezt kapja meg; egy másik gyártó (pl. MikroTik)
 * később egy ugyanilyen felépítésű, saját fájlt kap.
 */

import { MODOK } from './modok.js';
import { formazHiba, formazSugo } from './uzenetek.js';
import { alapParancsok } from './parancsok/alap.js';
import { vlanParancsok } from './parancsok/vlan.js';
import { interfeszParancsok } from './parancsok/interfesz.js';
import { showParancsok } from './parancsok/show.js';
import { megNincsParancsok } from './parancsok/meg-nincs.js';
import { portTipusok } from '../../modell/switch.js';

/** A porttípusok magyarázata a ? súgóhoz. */
const TIPUS_LEIRASOK = {
  FastEthernet: 'FastEthernet (100 Mbit/s) port',
  GigabitEthernet: 'GigabitEthernet (1 Gbit/s) port',
};

export const ios = {
  nev: 'ios',
  felirat: 'IOS-szerű parancssor',
  modok: MODOK,
  kezdoMod: 'felhasznalo',
  parancsok: [...alapParancsok, ...vlanParancsok, ...interfeszParancsok, ...showParancsok, ...megNincsParancsok],
  formazHiba,
  formazSugo,

  /** Az értelmezőnek szükséges eszközadatok. */
  kornyezet(eszkoz) {
    return { portTipusok: portTipusok(eszkoz), tipusLeirasok: TIPUS_LEIRASOK };
  },

  /**
   * Módváltáskor: ha a konfigurációs módból kilépünk, az eszköz naplóüzenetet ír
   * (először kiírja az új promptot, utána jön az üzenet – így néz ki a valódi konzolon is).
   */
  modValtasKor(regi, uj, ctx) {
    if (MODOK[regi].konfig && !MODOK[uj].konfig) {
      ctx.kiir(ctx.prompt());
      ctx.naplo('%SYS-5-CONFIG_I: Configured from console by console');
    }
  },

  /** Ctrl+Z: konfigurációs módból vissza a privilegizált módba. */
  ctrlZ(ctx) {
    if (MODOK[ctx.mod].konfig) ctx.modValt('priv');
  },
};
