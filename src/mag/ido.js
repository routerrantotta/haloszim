/**
 * Szimulált óra és eseménysor.
 *
 * A szimulátorban nem a valódi időt használjuk közvetlenül, hanem egy saját órát.
 * Így az idő gyorsítható, megállítható, és a tesztekben pontosan léptethető
 * (pl. később: MAC-tábla öregedése, STP-időzítők, OSPF hello).
 *
 * Az idő ezredmásodpercben (ms) telik, az eszközök „bekapcsolása” óta.
 */

/**
 * @typedef {Object} Esemeny
 * @property {number} mikor  - melyik szimulált időpontban fusson (ms)
 * @property {number} sorszam - azonos időpontnál a beütemezés sorrendje dönt
 * @property {() => void} teendo - amit akkor meg kell csinálni
 */

export class Ora {
  constructor() {
    /** Az eltelt szimulált idő ezredmásodpercben. */
    this.ido = 0;
    /** @type {Esemeny[]} */
    this.sor = [];
    this.kovetkezoSorszam = 0;
  }

  /**
   * Beütemez egy teendőt, ami `kesleltetes` ms múlva fut le.
   * @param {number} kesleltetes
   * @param {() => void} teendo
   * @returns {Esemeny} – ezzel később visszavonható (lemond)
   */
  utemez(kesleltetes, teendo) {
    const esemeny = { mikor: this.ido + Math.max(0, kesleltetes), sorszam: this.kovetkezoSorszam++, teendo };
    this.sor.push(esemeny);
    this.sor.sort((a, b) => a.mikor - b.mikor || a.sorszam - b.sorszam);
    return esemeny;
  }

  /** Visszavon egy korábban beütemezett eseményt. */
  lemond(esemeny) {
    this.sor = this.sor.filter((e) => e !== esemeny);
  }

  /**
   * Előre lépteti az órát `ms` ezredmásodperccel, és közben sorban lefuttatja
   * az esedékes eseményeket (ha egy esemény újat ütemez, az is lefut, ha belefér).
   * @param {number} ms
   */
  lep(ms) {
    const cel = this.ido + Math.max(0, ms);
    while (this.sor.length > 0 && this.sor[0].mikor <= cel) {
      const esemeny = this.sor.shift();
      this.ido = esemeny.mikor;
      esemeny.teendo();
    }
    this.ido = cel;
  }
}

const HONAPOK = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Naplóüzenetek időbélyege, ahogy egy beállított óra nélküli eszköz mutatja:
 * a „gyári” kezdődátumtól (március 1., 00:00) számolva, pl. „*Mar  1 00:03:12.045”.
 * A csillag azt jelzi, hogy az eszköz órája nincs beállítva (nem megbízható).
 * @param {number} ms – eltelt idő bekapcsolás óta
 * @returns {string}
 */
export function naploIdobelyeg(ms) {
  const osszMp = Math.floor(ms / 1000);
  const nap = 1 + Math.floor(osszMp / 86400);
  const ora = Math.floor((osszMp % 86400) / 3600);
  const perc = Math.floor((osszMp % 3600) / 60);
  const mp = osszMp % 60;
  const ezred = Math.floor(ms % 1000);
  const k = (n, h = 2) => String(n).padStart(h, '0');
  // Egyszerűsítés: márciusnál tovább nem lépünk hónapot (31 nap után is Mar marad).
  return `*${HONAPOK[2]} ${String(nap).padStart(2, ' ')} ${k(ora)}:${k(perc)}:${k(mp)}.${k(ezred, 3)}`;
}
