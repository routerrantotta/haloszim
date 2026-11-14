/**
 * Az IOS-szerű parancssor „személyisége”: minden, ami erre a parancssorra jellemző.
 * A munkamenet (cli/terminal-munkamenet.js) ezt kapja meg; egy másik gyártó (pl. MikroTik)
 * később egy ugyanilyen felépítésű, saját fájlt kap.
 */

import { MODOK } from './modok.js';
import { formazHiba, formazSugo } from './uzenetek.js';
import { alapParancsok } from './parancsok/alap.js';
import { vlanParancsok } from './parancsok/vlan.js';
import { interfeszParancsok, interfeszKozos } from './parancsok/interfesz.js';
import { showParancsok } from './parancsok/show.js';
import { switchportParancsok } from './parancsok/switchport.js';
import { vtpParancsok } from './parancsok/vtp.js';
import { megNincsParancsok, routerMegNincsParancsok } from './parancsok/meg-nincs.js';
import { routerKonfigParancsok } from './parancsok/router.js';
import { routerExecParancsok } from './parancsok/router-exec.js';
import { ospfParancsok } from './parancsok/ospf.js';
import { eigrpParancsok } from './parancsok/eigrp.js';
import { portTipusok } from '../../modell/switch.js';
import { routerPortTipusok } from '../../modell/router.js';

/** A porttípusok magyarázata a ? súgóhoz. */
const TIPUS_LEIRASOK = {
  FastEthernet: 'FastEthernet (100 Mbit/s) port',
  GigabitEthernet: 'GigabitEthernet (1 Gbit/s) port',
  Serial: 'Soros (WAN) port',
  Loopback: 'Loopback (virtuális, mindig működő) interfész',
};

export const ios = {
  nev: 'ios',
  felirat: 'IOS-szerű parancssor',
  modok: MODOK,
  kezdoMod: 'felhasznalo',
  parancsok: [...alapParancsok, ...vlanParancsok, ...interfeszParancsok, ...switchportParancsok, ...showParancsok, ...vtpParancsok, ...megNincsParancsok],
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

/**
 * A router (ISR 4331 jellegű) parancssora: ugyanaz a „személyiség”, más parancskészlettel
 * (nincs VLAN, switchport, VTP; van IP-cím, routing, RIP, OSPF, EIGRP, ping, traceroute, debug).
 */
export const iosRouter = {
  ...ios,
  parancsok: [...alapParancsok, ...interfeszKozos, ...routerKonfigParancsok, ...routerExecParancsok, ...ospfParancsok, ...eigrpParancsok, ...routerMegNincsParancsok],
  kornyezet(eszkoz) {
    return { portTipusok: routerPortTipusok(eszkoz), tipusLeirasok: TIPUS_LEIRASOK };
  },
};

/** Az eszköz típusához illő személyiség. */
export function szemelyiseg(eszkoz) {
  return eszkoz && eszkoz.tipus === 'router' ? iosRouter : ios;
}
