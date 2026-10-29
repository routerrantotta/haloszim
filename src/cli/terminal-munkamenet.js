/**
 * Terminál-munkamenet: egy „bejelentkezés” egy eszköz parancssorába.
 *
 * Ez tartja nyilván:
 *   - melyik módban vagyunk (pl. konfig), és a mód kiegészítő adatait (pl. melyik VLAN-t szerkesztjük),
 *   - az előzményeket (fel/le nyíl) – külön az exec és a konfigurációs módokhoz, mint az IOS-ben,
 *   - ha az eszköz kérdez valamit (pl. „Press RETURN”), akkor a választ várjuk.
 *
 * A gyártóra jellemző dolgokat (módok, parancsok, hibaüzenetek szövege) a „személyiség” adja,
 * lásd gyartok/ios/index.js. A munkamenet maga gyártófüggetlen.
 *
 * A kimenet egy lista: szöveges sorok, és közöttük lehet { varj: ms } (pl. névfeloldás várakozása).
 */

import { faEpites, illeszt, sugo, kiegeszit } from './ertelmezo.js';
import { naploIdobelyeg, Ora } from '../mag/ido.js';

/** @typedef {string | {varj: number}} KimenetElem */

/** Ennyi parancsot jegyez meg módcsoportonként (az IOS alapértéke 10). */
export const TORTENET_MERET = 10;

export class Munkamenet {
  /**
   * @param {Object} p
   * @param {Object} p.szemelyiseg – a gyártói réteg (pl. ios)
   * @param {Object} p.eszkoz      – az eszköz állapota (modell)
   * @param {Ora} [p.ora]          – szimulált óra (a naplóüzenetek időbélyegéhez)
   */
  constructor({ szemelyiseg, eszkoz, ora }) {
    this.szemelyiseg = szemelyiseg;
    this.eszkoz = eszkoz;
    this.ora = ora || new Ora();
    this.fak = faEpites(szemelyiseg.parancsok);
    this.mod = szemelyiseg.kezdoMod;
    /** A mód kiegészítő adatai, pl. { vlan: 10 } vagy { portok: ["FastEthernet0/1"] } */
    this.kontextus = {};
    /** @type {Object<string, string[]>} */
    this.tortenetek = {};
    /** Ha nem null: az eszköz egy kérdésre vár választ. */
    this.varakozas = null;
    /** @type {Array<() => void>} */
    this.figyelok = [];
  }

  /** Feliratkozás: minden parancs után szól (pl. a nézetnek, hogy frissítse a gépnevet). */
  figyel(fn) {
    this.figyelok.push(fn);
  }

  /** Az aktuális prompt, pl. „Switch(config)#”. */
  prompt() {
    if (this.varakozas) return this.varakozas.prompt;
    return this.szemelyiseg.modok[this.mod].prompt(this.eszkoz.hostname);
  }

  /** Az eszköz adatai, amelyekre az értelmezőnek szüksége van (pl. milyen portok vannak). */
  kornyezet() {
    return this.szemelyiseg.kornyezet(this.eszkoz);
  }

  /** Az aktuális módcsoport előzményei (a legrégebbi elöl). */
  tortenet() {
    const csoport = this.szemelyiseg.modok[this.mod].tortenet;
    return this.tortenetek[csoport] || [];
  }

  /** @private */
  tortenetbe(sor) {
    const csoport = this.szemelyiseg.modok[this.mod].tortenet;
    const lista = (this.tortenetek[csoport] = this.tortenetek[csoport] || []);
    if (lista[lista.length - 1] !== sor) lista.push(sor);
    while (lista.length > TORTENET_MERET) lista.shift();
  }

  /**
   * A parancsoknak átadott „eszköztár”.
   * @private
   * @param {KimenetElem[]} kimenet – ide gyűlik a kiírt szöveg
   */
  ctx(kimenet) {
    const mm = this;
    return {
      eszkoz: mm.eszkoz,
      ora: mm.ora,
      get mod() { return mm.mod; },
      get kontextus() { return mm.kontextus; },
      /** Sorok kiírása. */
      kiir: (...sorok) => kimenet.push(...sorok),
      /** Időbélyeges naplóüzenet, pl. „*Mar  1 00:01:02.345: %SYS-5-…”. */
      naplo: (uzenet) => kimenet.push(`${naploIdobelyeg(mm.ora.ido)}: ${uzenet}`),
      /** Várakozás a kiírás közben (pl. névfeloldás). */
      varj: (ms) => kimenet.push({ varj: ms }),
      /** Módváltás; a személyiség „modValtasKor” része is lefut (pl. naplóüzenet). */
      modValt: (uj, kontextus = {}) => {
        const regi = mm.mod;
        mm.mod = uj;
        mm.kontextus = kontextus;
        if (mm.szemelyiseg.modValtasKor) mm.szemelyiseg.modValtasKor(regi, uj, mm.ctx(kimenet), mm);
      },
      /** Kérdés az eszköz részéről: a következő beírt sort a `valasz` kapja meg. */
      kerdez: (promptSzoveg, valasz) => {
        mm.varakozas = { prompt: promptSzoveg, valasz };
      },
      /** Az aktuális prompt (pl. a naplóüzenet előtti sorhoz). */
      prompt: () => mm.prompt(),
    };
  }

  /** @private */
  ertesit() {
    for (const fn of this.figyelok) fn();
  }

  /**
   * Egy beírt sor (Enter) feldolgozása.
   * @param {string} sor
   * @returns {{kimenet: KimenetElem[], lapozhato: boolean}}
   */
  bevitel(sor) {
    /** @type {KimenetElem[]} */
    const kimenet = [];
    const ctx = this.ctx(kimenet);

    // Az eszköz kérdezett valamit → ez a sor a válasz.
    if (this.varakozas) {
      const { valasz } = this.varakozas;
      this.varakozas = null;
      valasz(sor, ctx);
      this.ertesit();
      return { kimenet, lapozhato: false };
    }

    if (sor.trim() === '') return { kimenet, lapozhato: false };
    this.tortenetbe(sor);

    const kornyezet = this.kornyezet();
    const promptSzoveg = this.prompt();
    let r = illeszt(this.fak, this.mod, sor, kornyezet);

    // Almódban (pl. config-if) a globális konfigurációs parancsok is működnek:
    // ilyenkor az eszköz előbb kilép az almódból.
    const visszaesik = this.szemelyiseg.modok[this.mod].visszaesik;
    if (!r.ok && visszaesik) {
      const r2 = illeszt(this.fak, visszaesik, sor, kornyezet);
      if (r2.ok) {
        this.mod = visszaesik;
        this.kontextus = {};
        r = r2;
      } else if (r.hiba === 'ervenytelen' && (r2.hiba !== 'ervenytelen' || r2.oszlop > r.oszlop)) {
        r = r2;
      }
    }

    if (!r.ok) {
      const info = { sor, prompt: promptSzoveg, mod: this.mod, modAdat: this.szemelyiseg.modok[this.mod] };
      kimenet.push(...this.szemelyiseg.formazHiba(r, info));
      return { kimenet, lapozhato: false };
    }

    r.parancs.vegrehajt(ctx, r.ertekek);
    this.ertesit();
    return { kimenet, lapozhato: !!r.parancs.lapozhato };
  }

  /**
   * A ? súgó. A `sor` a ? ELŐTTI szöveg.
   * @returns {{kimenet: string[], sor: string}} – a kiírandó súgó, és a sor, amit vissza kell írni a beviteli mezőbe
   */
  sugo(sor) {
    if (this.varakozas) return { kimenet: [], sor };
    const kornyezet = this.kornyezet();
    let r = sugo(this.fak, this.mod, sor, kornyezet);
    const visszaesik = this.szemelyiseg.modok[this.mod].visszaesik;
    if (!r.ok && visszaesik && sor.trim() !== '') {
      const r2 = sugo(this.fak, visszaesik, sor, kornyezet);
      if (r2.ok) r = r2;
    }
    const info = { sor, prompt: this.prompt(), mod: this.mod, modAdat: this.szemelyiseg.modok[this.mod] };
    return { kimenet: this.szemelyiseg.formazSugo(r, info), sor };
  }

  /**
   * Tab-kiegészítés.
   * @returns {string|null} – a kiegészített sor, vagy null
   */
  kiegeszit(sor) {
    if (this.varakozas) return null;
    const kornyezet = this.kornyezet();
    const r = kiegeszit(this.fak, this.mod, sor, kornyezet);
    if (r !== null) return r;
    const visszaesik = this.szemelyiseg.modok[this.mod].visszaesik;
    return visszaesik ? kiegeszit(this.fak, visszaesik, sor, kornyezet) : null;
  }

  /**
   * Ctrl+Z: konfigurációs módból vissza a privilegizált módba (mint az „end”).
   * @returns {{kimenet: KimenetElem[]}}
   */
  ctrlZ() {
    const kimenet = [];
    if (!this.varakozas && this.szemelyiseg.ctrlZ) {
      this.szemelyiseg.ctrlZ(this.ctx(kimenet), this);
      this.ertesit();
    }
    return { kimenet };
  }
}
