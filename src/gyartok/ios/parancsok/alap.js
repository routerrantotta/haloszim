/**
 * Alapparancsok: módváltások és a gépnév.
 *
 * Minden parancs egy adatbejegyzés:
 *   modok     – melyik módokban él
 *   szavak    – a parancs szavai sorban: { szo, sugo } kulcsszó, { param, … } paraméter,
 *               { tovabb: 'mód' } = innen egy másik mód parancsai jönnek (a „do”-hoz)
 *   vegrehajt – mit csinál (ctx: eszköz, kiírás, módváltás …; ertekek: a paraméterek értékei)
 * Új parancs = új bejegyzés; a meglévő kódot nem kell átírni.
 */

import { KONFIG_MODOK, ALMODOK } from '../modok.js';
import { ALAP_HOSTNAME } from '../../../modell/switch.js';

/** Közös súgószövegek (több parancs is használja őket). */
export const SZO = {
  no: { szo: 'no', sugo: 'Parancs visszavonása, alapérték visszaállítása' },
};

/** Kilépés az eszközről: a konzol „felszabadul”, Enterre újra a felhasználói mód jön. */
function kijelentkezes(ctx) {
  ctx.kiir('', `${ctx.eszkoz.hostname} con0 is now available`, '', '', '', '', '', 'Press RETURN to get started.', '');
  ctx.modValt('felhasznalo');
  ctx.kerdez('', () => {});
}

/** Belépés konfigurációs módba (a configure terminal és a kérdésre adott válasz is ezt hívja). */
function konfigBe(ctx) {
  ctx.kiir('Enter configuration commands, one per line.  End with CNTL/Z.');
  ctx.modValt('konfig');
}

/** A gépnév: csak egyszerű (ékezet és szóköz nélküli) karakterekből állhat. */
function ervenyesGepnev(nev) {
  return /^[A-Za-z][\x21-\x7e]*$/.test(nev);
}

export const alapParancsok = [
  // ---------- felhasználói és privilegizált mód ----------
  {
    modok: ['felhasznalo', 'priv'],
    szavak: [{ szo: 'enable', sugo: 'Belépés privilegizált (rendszergazdai) módba' }],
    vegrehajt(ctx) {
      // Jelszó még nincs beállítva → azonnal beenged. Privilegizált módban nem csinál semmit.
      if (ctx.mod === 'felhasznalo') ctx.modValt('priv');
    },
  },
  {
    modok: ['priv'],
    szavak: [{ szo: 'disable', sugo: 'Vissza a felhasználói módba' }],
    vegrehajt(ctx) {
      ctx.modValt('felhasznalo');
    },
  },
  {
    modok: ['felhasznalo', 'priv'],
    szavak: [{ szo: 'exit', sugo: 'Kilépés az eszközről (a munkamenet bezárása)' }],
    vegrehajt: kijelentkezes,
  },
  {
    modok: ['felhasznalo', 'priv'],
    szavak: [{ szo: 'logout', sugo: 'Kilépés az eszközről (ugyanaz, mint az exit)' }],
    vegrehajt: kijelentkezes,
  },
  {
    modok: ['priv'],
    szavak: [
      { szo: 'configure', sugo: 'Belépés konfigurációs módba' },
      { szo: 'terminal', sugo: 'Beállítás innen, a parancssorból' },
    ],
    vegrehajt: konfigBe,
  },
  {
    // Csak „configure”: az eszköz megkérdezi, honnan jön a konfiguráció.
    modok: ['priv'],
    szavak: [{ szo: 'configure', sugo: 'Belépés konfigurációs módba' }],
    vegrehajt(ctx) {
      ctx.kerdez('Configuring from terminal, memory, or network [terminal]? ', (valasz, c) => {
        const v = valasz.trim().toLowerCase();
        if (v === '' || 'terminal'.startsWith(v)) konfigBe(c);
        else if ('memory'.startsWith(v) || 'network'.startsWith(v)) c.kiir('[Szimulátor] Ez a lehetőség a szimulátorban még nincs meg.');
        else c.kiir('?Must be "terminal", "memory" or "network"');
      });
    },
  },

  // ---------- konfigurációs módok ----------
  {
    modok: ['konfig'],
    szavak: [{ szo: 'exit', sugo: 'Kilépés a konfigurációs módból' }],
    vegrehajt(ctx) {
      ctx.modValt('priv');
    },
  },
  {
    modok: ALMODOK,
    szavak: [{ szo: 'exit', sugo: 'Kilépés ebből az almódból (vissza a konfigurációs módba)' }],
    vegrehajt(ctx) {
      ctx.modValt('konfig');
    },
  },
  {
    modok: KONFIG_MODOK,
    szavak: [{ szo: 'end', sugo: 'Kilépés a konfigurációból, vissza a privilegizált módba' }],
    vegrehajt(ctx) {
      ctx.modValt('priv');
    },
  },
  {
    modok: KONFIG_MODOK,
    szavak: [{ szo: 'do', sugo: 'Privilegizált módú parancs futtatása (pl. do show vlan brief)' }, { tovabb: 'priv' }],
  },
  {
    modok: ['konfig'],
    szavak: [
      { szo: 'hostname', sugo: 'Az eszköz nevének beállítása' },
      { param: 'szo', kulcs: 'nev', sugo: 'Az eszköz új neve' },
    ],
    vegrehajt(ctx, { nev }) {
      if (!ervenyesGepnev(nev)) {
        ctx.kiir('% Hostname contains one or more illegal characters.');
        return;
      }
      ctx.eszkoz.hostname = nev.slice(0, 63);
    },
  },
  {
    modok: ['konfig'],
    szavak: [SZO.no, { szo: 'hostname', sugo: 'Az eszköz nevének visszaállítása az alapértékre' }],
    vegrehajt(ctx) {
      ctx.eszkoz.hostname = ALAP_HOSTNAME;
    },
  },
];
