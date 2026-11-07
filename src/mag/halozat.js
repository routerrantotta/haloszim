/**
 * A hálózat: eszközök, kábelek, és a keretek útja a kábeleken.
 *
 * Minden egy közös szimulált órán (mag/ido.js) történik: egy keret elküldése után
 * `kesleltetes` ms múlva érkezik meg a kábel túlsó végére. A böngészőben ez néhány száz ms,
 * hogy a csomagok mozgása látható legyen; a tesztekben 1 ms.
 *
 * A hálózat eseményeket küld a feliratkozóknak (figyel), pl. a nézetnek az animációhoz:
 *   { tipus: 'keret',   honnan: {eszkoz, port}, hova: {eszkoz, port}, keret, idotartam }
 *   { tipus: 'eldobva', eszkoz, port, keret, ok }
 *   { tipus: 'fogadva', eszkoz, port, keret }     – egy végpont (PC) megkapta a keretet
 *   { tipus: 'naplo',   eszkoz, sor }               – konzolüzenet (pl. %LINK-3-UPDOWN)
 *   { tipus: 'allapot' }                            – változott valami, amit ki kell rajzolni
 */

import { Ora, naploIdobelyeg } from './ido.js';
import { kapcsoloFogad, macTorolPort } from './kapcsolas.js';
import { vegpontFogad } from './vegpont.js';
import { vtpTrunkValtozas } from './vtp.js';
import { routerFogad, szomszedTorol } from './router.js';
import { ripPortValtozott } from './rip.js';
import { ospfPortValtozott } from './ospf.js';

/** Ennyi idő után jön a „link up” üzenet a bekapcsolt porton (ms). */
export const LINK_FEL_IDO = 1000;
/** Ennyi idő után jön a „line protocol up”, és ekkor kezd forgalmazni a port (ms). */
export const PROTOKOLL_FEL_IDO = 2000;
/** Lekapcsoláskor ennyi idő után jön a „line protocol down” üzenet (ms). */
export const PROTOKOLL_LE_IDO = 1000;

export class Halozat {
  /**
   * @param {{ora?: Ora, kesleltetes?: number}} [p]
   */
  constructor({ ora, kesleltetes = 1 } = {}) {
    this.ora = ora || new Ora();
    /** Egy keret ennyi ms alatt ér át egy kábelen. */
    this.kesleltetes = kesleltetes;
    /** @type {Object[]} */
    this.eszkozok = [];
    /** @type {{a: {eszkoz: Object, port: Object}, b: {eszkoz: Object, port: Object}, fuggo: Object[]}[]} */
    this.kabelek = [];
    /** @type {Array<(e: Object) => void>} */
    this.figyelok = [];
  }

  /** Eszköz hozzáadása. Az eszköz „tudni fogja”, melyik hálózatban van. */
  hozzaad(eszkoz) {
    Object.defineProperty(eszkoz, 'halozat', { value: this, enumerable: false, configurable: true });
    this.eszkozok.push(eszkoz);
    return eszkoz;
  }

  /** Eszköz keresése név (hostname) szerint. */
  eszkoz(nev) {
    return this.eszkozok.find((e) => e.hostname === nev);
  }

  /**
   * Kábel két port között. A kábel azonnal működik (nincs „link up” üzenet), ha mindkét
   * vég be van kapcsolva – mintha a hálózat már így indult volna.
   */
  kabel(eszkozA, portNevA, eszkozB, portNevB, { soros = false } = {}) {
    const pa = eszkozA.portok.find((p) => p.nev === portNevA);
    const pb = eszkozB.portok.find((p) => p.nev === portNevB);
    if (!pa || !pb) throw new Error(`Nincs ilyen port: ${eszkozA.hostname} ${portNevA} / ${eszkozB.hostname} ${portNevB}`);
    if (this.kabelVege(eszkozA, pa) || this.kabelVege(eszkozB, pb)) throw new Error('A port már foglalt.');
    // Soros (pl. 64 kbit/s-os) vonal: a csomag lassabban ér át rajta. A „keses” a valódi késleltetés
    // (ms, ebből számol a ping és a traceroute), a „lassu” az animáció lassítása.
    const k = { a: { eszkoz: eszkozA, port: pa }, b: { eszkoz: eszkozB, port: pb }, fuggo: [], soros, keses: soros ? 10 : 0, lassu: soros ? 2 : 1 };
    this.kabelek.push(k);
    const fent = !pa.leallitva && !pb.leallitva;
    pa.fent = fent;
    pb.fent = fent;
    return k;
  }

  /** A porthoz csatlakozó kábel, vagy null. */
  kabelVege(eszkoz, port) {
    return this.kabelek.find((k) => (k.a.eszkoz === eszkoz && k.a.port === port) || (k.b.eszkoz === eszkoz && k.b.port === port)) || null;
  }

  /** A kábel túlsó vége: {eszkoz, port}, vagy null, ha nincs kábel. */
  szomszed(eszkoz, port) {
    const k = this.kabelVege(eszkoz, port);
    if (!k) return null;
    return k.a.eszkoz === eszkoz && k.a.port === port ? k.b : k.a;
  }

  /** Feliratkozás az eseményekre. Visszaad egy függvényt, amivel le lehet iratkozni. */
  figyel(fn) {
    this.figyelok.push(fn);
    return () => {
      this.figyelok = this.figyelok.filter((f) => f !== fn);
    };
  }

  /** @param {Object} e */
  esemeny(e) {
    for (const fn of this.figyelok.slice()) fn(e);
  }

  /** Időbélyeges konzolüzenet egy eszközön (a nézet a konzoljára írja). */
  naplo(eszkoz, uzenet) {
    if (eszkoz.tipus === 'pc') return;
    this.esemeny({ tipus: 'naplo', eszkoz, sor: `${naploIdobelyeg(this.ora.ido)}: ${uzenet}` });
  }

  /**
   * Keret küldése egy porton. Ha a port nem működik, vagy nincs rajta kábel, a keret elvész.
   * @param {Object} eszkoz
   * @param {Object} port
   * @param {Object} keret
   */
  kuld(eszkoz, port, keret) {
    if (!port.fent) return;
    const k = this.kabelVege(eszkoz, port);
    if (!k) return;
    const tul = k.a.eszkoz === eszkoz && k.a.port === port ? k.b : k.a;
    if (k.keses && keret.adat && (keret.tipus === 'ipv4' || keret.tipus === 'ipv6')) {
      keret = { ...keret, adat: { ...keret.adat, keses: (keret.adat.keses || 0) + k.keses } };
    }
    const ido = this.kesleltetes * k.lassu;
    this.esemeny({ tipus: 'keret', honnan: { eszkoz, port }, hova: tul, keret, idotartam: ido });
    this.ora.utemez(ido, () => this.fogad(tul.eszkoz, tul.port, keret));
  }

  /** @private – egy keret megérkezett egy portra */
  fogad(eszkoz, port, keret) {
    if (!port.fent) return;
    if (eszkoz.tipus === 'switch') kapcsoloFogad(this, eszkoz, port, keret);
    else if (eszkoz.tipus === 'router') routerFogad(this, eszkoz, port, keret);
    else vegpontFogad(this, eszkoz, port, keret);
  }

  /** Eldobott keret (a nézet egy jelet tesz ki, a tanuló láthatja, hol akadt el a csomag). */
  eldob(eszkoz, port, keret, ok) {
    this.esemeny({ tipus: 'eldobva', eszkoz, port, keret, ok });
  }

  /**
   * Egy port beállítása megváltozott (shutdown / no shutdown). Kiszámolja, működik-e a kábel,
   * és ha változott, kiírja a konzolüzeneteket – a valódi eszközhöz hasonló időzítéssel.
   */
  portValtozott(eszkoz, port) {
    const k = this.kabelVege(eszkoz, port);
    if (!k) {
      if (eszkoz.tipus === 'router') {
        if (port.tipus === 'Loopback') {
          const fent = !port.leallitva;
          if (fent !== port.fent) {
            port.fent = fent;
            if (fent) this.naplo(eszkoz, `%LINK-3-UPDOWN: Interface ${port.nev}, changed state to up`);
            this.naplo(eszkoz, `%LINEPROTO-5-UPDOWN: Line protocol on Interface ${port.nev}, changed state to ${fent ? 'up' : 'down'}`);
          }
        } else if (!port.leallitva) {
          this.naplo(eszkoz, `%LINK-3-UPDOWN: Interface ${port.nev}, changed state to down`);
        }
        ripPortValtozott(this, eszkoz, port);
        ospfPortValtozott(this, eszkoz);
      }
      this.esemeny({ tipus: 'allapot' });
      return;
    }
    for (const e of k.fuggo) this.ora.lemond(e);
    k.fuggo = [];
    const kell = !k.a.port.leallitva && !k.b.port.leallitva;
    const vegek = [k.a, k.b];

    if (!kell) {
      if (k.a.port.fent) {
        for (const v of vegek) {
          v.port.fent = false;
          if (v.eszkoz.tipus === 'switch') macTorolPort(v.eszkoz, v.port.nev);
          if (v.eszkoz.tipus === 'router') {
            szomszedTorol(v.eszkoz, v.port.nev);
            ripPortValtozott(this, v.eszkoz, v.port);
            ospfPortValtozott(this, v.eszkoz);
          }
          // A túloldalon (ahol nem kapcsolták le) a fizikai link is leesik.
          if (!v.port.leallitva) this.naplo(v.eszkoz, `%LINK-3-UPDOWN: Interface ${v.port.nev}, changed state to down`);
        }
        k.fuggo.push(this.ora.utemez(PROTOKOLL_LE_IDO, () => {
          for (const v of vegek) {
            this.naplo(v.eszkoz, `%LINEPROTO-5-UPDOWN: Line protocol on Interface ${v.port.nev}, changed state to down`);
          }
        }));
      }
      this.esemeny({ tipus: 'allapot' });
      return;
    }

    if (!k.a.port.fent) {
      k.fuggo.push(this.ora.utemez(LINK_FEL_IDO, () => {
        for (const v of vegek) this.naplo(v.eszkoz, `%LINK-3-UPDOWN: Interface ${v.port.nev}, changed state to up`);
      }));
      k.fuggo.push(this.ora.utemez(PROTOKOLL_FEL_IDO, () => {
        for (const v of vegek) {
          v.port.fent = true;
          this.naplo(v.eszkoz, `%LINEPROTO-5-UPDOWN: Line protocol on Interface ${v.port.nev}, changed state to up`);
        }
        if (k.a.eszkoz.tipus === 'switch') vtpTrunkValtozas(k.a.eszkoz, k.a.port);
        else if (k.b.eszkoz.tipus === 'switch') vtpTrunkValtozas(k.b.eszkoz, k.b.port);
        for (const v of vegek) {
          if (v.eszkoz.tipus !== 'router') continue;
          ripPortValtozott(this, v.eszkoz, v.port);
          ospfPortValtozott(this, v.eszkoz);
        }
        this.esemeny({ tipus: 'allapot' });
      }));
    }
    this.esemeny({ tipus: 'allapot' });
  }
}

/**
 * Kényelmi függvény a parancsoknak: ha az eszköz egy hálózatban van, szól neki a port
 * változásáról (egymagában álló switchnél – pl. a tesztekben – nem csinál semmit).
 */
export function portValtozott(eszkoz, port) {
  if (eszkoz.halozat) eszkoz.halozat.portValtozott(eszkoz, port);
}

/** A kábel túlsó vége (vagy null), hálózat nélkül is hívható. */
export function szomszed(eszkoz, port) {
  return eszkoz.halozat ? eszkoz.halozat.szomszed(eszkoz, port) : null;
}

/** Az aktuális szimulált idő (hálózat nélkül 0). */
export function most(eszkoz) {
  return eszkoz.halozat ? eszkoz.halozat.ora.ido : 0;
}
