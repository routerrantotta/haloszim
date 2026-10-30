/**
 * Bemutató (vezetett) mód: lépésről lépésre végigvezeti a tanulót a feladaton.
 *
 * A feladatfájl „bemutato” mezője lépések listája. Egy lépés:
 *   {
 *     hol: 'eszkoz' | 'terminal' | 'pc' | 'ellenorzes' | 'panel',  – mire mutasson a buborék
 *     eszkoz: 'SW1',                   – melyik eszközhöz tartozik (eszkoz, terminal, pc esetén)
 *     szoveg: 'Írd be: `enable`',      – mit csináljon (a `…` parancsként jelenik meg)
 *     miert: 'A privilegizált mód …',  – miért (rövid magyarázat)
 *     be: ['enable'],                  – a beírandó parancsok (a tesztek ezzel játsszák végig)
 *     kesz: { … } vagy [ { … }, … ]    – mikor teljesül (az állapot alapján, nem a beírt szöveg alapján!)
 *   }
 *
 * A „kesz” feltételtípusai:
 *   minden állapot-céltípus az ellenőrzőből (vlan, access-port, trunk, pc-ip, vtp, vlan-nincs, vtp-szinkron)
 *   { tipus: 'kivalasztva', eszkoz }           – az eszköz van kiválasztva (fül vagy kattintás a rajzon)
 *   { tipus: 'mod', eszkoz, mod, port? }       – a parancssor legalább ebben a módban van
 *                                                 (felhasznalo < priv < konfig < almódok); port: ennek az
 *                                                 interfésznek a beállításában
 *   { tipus: 'parancs', eszkoz, szavak: [] }   – az utoljára beírt parancs ez volt (rövidítve is, „do”-val is),
 *                                                 és a kimenete már végigfutott (pl. a ping befejeződött)
 *   { tipus: 'ellenorzes' }                    – az Ellenőrzés lefutott, és minden cél teljesült
 *
 * Az „átmeneti” lépések (kivalasztva, mod, parancs) csak az adott pillanatban igazak. Ha a tanuló
 * előreszaladt (pl. már a konfigurációs módban van, vagy a VLAN már kész), a bemutató ezeket
 * átugorja: ha az átmeneti lépések utáni első „tartós” lépés már teljesül, oda lép tovább.
 *
 * Ez a modul nem rajzol (a buborék: nezet/buborek.js), így a tesztekben is futtatható.
 */

import { allapotCel } from './ellenorzo.js';

/** A parancssori módok „mélysége”. */
const MOD_SZINT = { felhasznalo: 0, priv: 1, konfig: 2 };
function modSzint(mod) {
  return mod in MOD_SZINT ? MOD_SZINT[mod] : 3;
}

const ATMENETI = ['kivalasztva', 'mod', 'parancs'];

/** Átmeneti-e a lépés (csak a pillanatnyi helyzettől függ). */
function atmeneti(lepes) {
  const k = Array.isArray(lepes.kesz) ? lepes.kesz : [lepes.kesz];
  return k.every((c) => ATMENETI.includes(c.tipus));
}

/** A beírt szavak illenek-e a várt parancsra (szavanként elég az előtag, elöl „do” lehet). */
export function parancsIllik(sor, szavak) {
  let t = String(sor || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (t[0] === 'do' && szavak[0] !== 'do') t = t.slice(1);
  if (t.length < szavak.length) return false;
  return szavak.every((sz, i) => sz.toLowerCase().startsWith(t[i]) || t[i] === sz.toLowerCase());
}

export class Vezeto {
  /**
   * @param {Object[]} lepesek – a feladat „bemutato” mezője (már a változat értékeivel)
   * @param {Object} k – a környezet:
   *   f: a betöltött feladat; valasztott(): a kiválasztott eszköz neve;
   *   munkamenet(nev): az eszköz parancssori munkamenete; utolsoParancs(nev): az utolsó beírt sor;
   *   ellenorzesKesz(): igaz, ha az utolsó Ellenőrzés hibátlan volt;
   *   foglalt(nev) (nem kötelező): az eszköz terminálja éppen ír (pl. fut a ping)
   */
  constructor(lepesek, k) {
    this.lepesek = lepesek;
    this.k = k;
    this.index = 0;
  }

  /** Az aktuális lépés (vagy null, ha a bemutató végére értünk). */
  aktualis() {
    return this.index < this.lepesek.length ? this.lepesek[this.index] : null;
  }

  vege() {
    return this.index >= this.lepesek.length;
  }

  /** Egy feltétel teljesül-e. */
  feltetel(c) {
    const k = this.k;
    switch (c.tipus) {
      case 'kivalasztva':
        return k.valasztott() === c.eszkoz;
      case 'mod': {
        const mm = k.munkamenet(c.eszkoz);
        if (!mm || mm.mod === undefined) return false;
        if (modSzint(mm.mod) < modSzint(c.mod)) return false;
        if (c.port) return modSzint(mm.mod) === 3 && (mm.kontextus.portok || []).includes(c.port);
        return true;
      }
      case 'parancs':
        return parancsIllik(k.utolsoParancs(c.eszkoz), c.szavak) && !(k.foglalt && k.foglalt(c.eszkoz));
      case 'ellenorzes':
        return !!k.ellenorzesKesz();
      default: {
        const e = allapotCel(k.f, c);
        return !!(e && e.ok);
      }
    }
  }

  /** A lépés teljesült-e (több feltételnél mindegyiknek teljesülnie kell). */
  kesz(lepes) {
    const k = Array.isArray(lepes.kesz) ? lepes.kesz : [lepes.kesz];
    return k.every((c) => this.feltetel(c));
  }

  /**
   * Továbblépés, amíg a lépések teljesülnek. Visszaadja, hogy változott-e az aktuális lépés.
   * @returns {boolean}
   */
  frissit() {
    const regi = this.index;
    for (;;) {
      const l = this.aktualis();
      if (!l) break;
      if (this.kesz(l)) {
        this.index++;
        continue;
      }
      // Átmeneti lépésnél: ha a következő tartós lépés már kész, előreugrunk.
      if (atmeneti(l)) {
        let j = this.index + 1;
        while (j < this.lepesek.length && atmeneti(this.lepesek[j])) j++;
        if (j < this.lepesek.length && this.kesz(this.lepesek[j])) {
          this.index = j + 1;
          continue;
        }
      }
      break;
    }
    return this.index !== regi;
  }

  /** A lépés kihagyása (a tanuló „Tovább” gombja). */
  kihagy() {
    if (!this.vege()) this.index++;
  }

  /** Vissza az előző lépéshez. */
  vissza() {
    if (this.index > 0) this.index--;
  }
}
