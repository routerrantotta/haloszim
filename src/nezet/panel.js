/**
 * Feladatpanel: a feladat leírása, a teendők, a címterv, az ellenőrzés és a magyarázat.
 *
 * Három mód (ugyanaz a feladatfájl és ugyanazok a célok, csak a megjelenítés más):
 *   oktato   – a teendők mellett a parancsok is; Ellenőrzés bármikor, részletes okokkal;
 *              a magyarázat bármikor lenyitható.
 *   gyakorlo – a teendők parancs nélkül (csak a cél); teendőnként „Tipp” gomb, amely
 *              fokozatosan segít (az utolsó tipp a parancs); Ellenőrzés bármikor, részletesen.
 *   vizsga   – csak a cél, tipp nélkül; az idő mérődik; „Beadás” többször is lehet, de csak
 *              ✔/✘ látszik. A részletes okok, a parancsok és a magyarázat akkor nyílnak meg,
 *              ha minden cél teljesült, vagy ha a tanuló a „Feladom” gombot választja.
 *
 * A teendő a feladatfájlban lehet egyszerű szöveg, vagy { cel, parancsok, tippek: [] }.
 */

import { ellenoriz, probaE } from '../feladat/ellenorzo.js';

function elem(tag, osztaly, szoveg) {
  const e = document.createElement(tag);
  if (osztaly) e.className = osztaly;
  if (szoveg !== undefined) e.textContent = szoveg;
  return e;
}

/**
 * Szöveg elembe írása: a `…` közötti részek <code> elemmé válnak (parancsok).
 * Csak szövegcsomópontokat készít (nincs innerHTML), így a feladatfájl szövege nem lehet kód.
 */
function szovegbe(cel, szoveg) {
  String(szoveg).split('`').forEach((resz, i) => {
    if (resz === '') return;
    cel.append(i % 2 === 1 ? elem('code', 'hsz-kod', resz) : document.createTextNode(resz));
  });
  return cel;
}

/** A teendő egységes alakja: { cel, parancsok, tippek }. */
export function lepesAlak(l) {
  if (typeof l === 'string') return { cel: l, parancsok: '', tippek: [] };
  return { cel: l.cel || '', parancsok: l.parancsok || '', tippek: l.tippek || [] };
}

/** „mm:ss” (vagy „h:mm:ss”) */
export function idoSzoveg(ms) {
  const mp = Math.floor(ms / 1000);
  const k = (n) => String(n).padStart(2, '0');
  const ora = Math.floor(mp / 3600);
  return ora ? `${ora}:${k(Math.floor((mp % 3600) / 60))}:${k(mp % 60)}` : `${k(Math.floor(mp / 60))}:${k(mp % 60)}`;
}

/** A módok neve és rövid leírása (a választó is ezt használja). */
export const MODOK = {
  oktato: { nev: 'Oktató', leiras: 'Lépésről lépésre, a parancsokkal és magyarázattal.' },
  gyakorlo: { nev: 'Gyakorló', leiras: 'Csak a cél látszik; ha elakadsz, kérj tippet.' },
  vizsga: { nev: 'Vizsga', leiras: 'Önellenőrzés: nincs parancs, nincs tipp; az idő mérődik, a végén Beadás.' },
};

/** Szünet két próba között (ms), hogy a csomagok ne keveredjenek a rajzon. */
const PROBA_SZUNET = 500;

export class FeladatPanel {
  /**
   * @param {HTMLElement} szulo
   * @param {import('../feladat/betolto.js').BetoltottFeladat} f
   * @param {{mod?: 'oktato'|'gyakorlo'|'vizsga', most?: () => number, valtozatLink?: () => string}} [beallitasok]
   */
  constructor(szulo, f, beallitasok = {}) {
    this.f = f;
    this.mod = MODOK[beallitasok.mod] ? beallitasok.mod : 'oktato';
    this.most = beallitasok.most || (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
    this.vizsga = this.mod === 'vizsga';
    /** Vizsgában: megnyíltak-e a részletek (siker vagy feladás után). */
    this.feloldva = !this.vizsga;
    this.tippekSzama = 0;
    this.beadasok = 0;
    this.kezdes = this.most();
    this.vegeIdo = null;
    const fd = f.feladat;

    this.doboz = elem('section', `hsz-panel hsz-panel--${this.mod}`);
    this.doboz.setAttribute('aria-label', 'Feladat');

    const fej = elem('div', 'hsz-panel__fej');
    fej.append(elem('h2', 'hsz-panel__cim', fd.cim));
    if (fd.szint) fej.append(elem('span', 'hsz-panel__szint', fd.szint));
    fej.append(elem('span', `hsz-panel__mod hsz-panel__mod--${this.mod}`, `${MODOK[this.mod].nev} mód`));
    this.doboz.append(fej);
    this.doboz.append(elem('p', 'hsz-panel__modleiras', MODOK[this.mod].leiras));
    if (fd.mag !== null && fd.mag !== undefined) this.doboz.append(valtozatSor(fd.mag, beallitasok.valtozatLink));

    if (this.vizsga) {
      this.ora = elem('p', 'hsz-panel__ora');
      this.ora.setAttribute('aria-live', 'off');
      this.doboz.append(this.ora);
      this.oraFrissit();
      this.oraIdozito = setInterval(() => this.oraFrissit(), 1000);
    }

    for (const bek of fd.leiras || []) this.doboz.append(szovegbe(elem('p', 'hsz-panel__szoveg'), bek));

    this.lepesSorok = [];
    if (fd.lepesek && fd.lepesek.length) {
      this.doboz.append(elem('h3', 'hsz-panel__alcim', this.vizsga ? 'Követelmények' : 'Teendők'));
      const ol = elem('ol', 'hsz-panel__lepesek');
      for (const nyers of fd.lepesek) ol.append(this.lepesSor(lepesAlak(nyers)));
      this.doboz.append(ol);
    }

    if (fd.cimterv && fd.cimterv.length) this.doboz.append(...cimtervTabla(fd.cimterv));

    this.lista = elem('ul', 'hsz-celok');
    this.lista.hidden = true;
    this.doboz.append(this.lista);

    if (fd.magyarazat && fd.magyarazat.length) {
      this.magyarazat = magyarazatElem(fd.magyarazat);
      this.doboz.append(this.magyarazat);
      if (this.vizsga) {
        this.magyarazatZar = elem('p', 'hsz-panel__zarva',
          'A magyarázat a vizsga végén nyílik meg (ha minden cél teljesült, vagy ha feladod).');
        this.magyarazat.hidden = true;
        this.doboz.append(this.magyarazatZar);
      }
    }

    // A gomb(ok) és az összegzés a panel alján marad (görgetéskor is látszik).
    const lab = elem('div', 'hsz-panel__lab');
    this.osszegzes = elem('p', 'hsz-panel__osszegzes');
    this.osszegzes.setAttribute('role', 'status');
    const gombok = elem('div', 'hsz-panel__gombok');
    this.gomb = elem('button', 'hsz-gomb hsz-gomb--fo', this.vizsga ? 'Beadás' : 'Ellenőrzés');
    this.gomb.type = 'button';
    this.gomb.addEventListener('click', () => this.ellenoriz());
    gombok.append(this.gomb);
    if (this.vizsga) {
      this.feladGomb = elem('button', 'hsz-gomb hsz-gomb--masodlagos', 'Feladom – mutasd a megoldást');
      this.feladGomb.type = 'button';
      this.feladGomb.addEventListener('click', () => {
        const ok = typeof window === 'undefined' || !window.confirm
          || window.confirm('Biztosan feladod? Megjelennek a parancsok, a részletes okok és a magyarázat.');
        if (ok) this.felold('feladva');
      });
      gombok.append(this.feladGomb);
    }
    lab.append(this.osszegzes, gombok);
    this.doboz.append(lab);
    szulo.append(this.doboz);
  }

  /** @private – egy teendő sora a módnak megfelelően */
  lepesSor(l) {
    const li = elem('li', 'hsz-lepes');
    li.append(szovegbe(elem('span', 'hsz-lepes__cel'), l.cel));
    const parancs = l.parancsok ? szovegbe(elem('span', 'hsz-lepes__parancs'), l.parancsok) : null;
    if (parancs) {
      li.append(parancs);
      parancs.hidden = this.mod !== 'oktato';
    }
    const sor = { li, parancs, tippHely: null };

    if (this.mod === 'gyakorlo') {
      // Tippek fokozatosan; a legutolsó maga a parancs.
      const tippek = [...l.tippek];
      if (l.parancsok) tippek.push(`Megoldás: ${l.parancsok}`);
      if (tippek.length) {
        const hely = elem('span', 'hsz-lepes__tippek');
        const gomb = elem('button', 'hsz-tippgomb', 'Tipp');
        gomb.type = 'button';
        let hanyadik = 0;
        gomb.addEventListener('click', () => {
          if (hanyadik >= tippek.length) return;
          hely.append(szovegbe(elem('span', 'hsz-lepes__tipp'), tippek[hanyadik]));
          hanyadik++;
          this.tippekSzama++;
          if (hanyadik >= tippek.length) {
            gomb.disabled = true;
            gomb.textContent = 'Nincs több tipp';
          } else {
            gomb.textContent = `Még egy tipp (${hanyadik}/${tippek.length})`;
          }
        });
        li.append(hely, gomb);
        sor.tippHely = hely;
      }
    }
    this.lepesSorok.push(sor);
    return li;
  }

  /** @private */
  eltelt() {
    return (this.vegeIdo !== null ? this.vegeIdo : this.most()) - this.kezdes;
  }

  /** @private */
  oraFrissit() {
    if (!this.ora) return;
    this.ora.textContent = `Eltelt idő: ${idoSzoveg(this.eltelt())}${this.beadasok ? ` · Beadások: ${this.beadasok}` : ''}`;
  }

  /**
   * Vizsgában a részletek megnyitása (siker vagy feladás után): parancsok, okok, magyarázat.
   * @param {'siker'|'feladva'} miert
   */
  felold(miert) {
    if (this.feloldva) return;
    this.feloldva = true;
    this.vegeIdo = this.most();
    clearInterval(this.oraIdozito);
    this.oraFrissit();
    for (const s of this.lepesSorok) if (s.parancs) s.parancs.hidden = false;
    if (this.magyarazat) {
      this.magyarazat.hidden = false;
      if (this.magyarazatZar) this.magyarazatZar.remove();
    }
    for (const m of this.lista.querySelectorAll('.hsz-cel__megj')) m.hidden = false;
    if (this.feladGomb) this.feladGomb.remove();
    if (miert === 'feladva') {
      this.osszegzes.textContent = `Feladva ${idoSzoveg(this.eltelt())} után. Most már látszanak a parancsok, `
        + 'a részletes okok és a magyarázat – javítsd ki, és nyomd meg az Ellenőrzést.';
      this.osszegzes.className = 'hsz-panel__osszegzes';
      this.gomb.textContent = 'Ellenőrzés';
      this.vizsgaVege = true;
    }
  }

  /** Az ellenőrzés (vizsgában: beadás) indítása. */
  ellenoriz() {
    if (this.fut) return;
    this.fut = true;
    const beadas = this.vizsga && !this.vizsgaVege;
    if (beadas) this.beadasok++;
    this.oraFrissit();
    this.gomb.disabled = true;
    this.gomb.textContent = beadas ? 'Értékelés folyik…' : 'Ellenőrzés folyik…';
    this.osszegzes.textContent = 'A próbák futnak – figyeld a csomagokat a rajzon!';
    this.osszegzes.className = 'hsz-panel__osszegzes';

    this.lista.textContent = '';
    this.lista.hidden = false;
    const sorok = this.f.feladat.celok.map((c) => {
      const li = elem('li', 'hsz-cel hsz-cel--var');
      const jel = elem('span', 'hsz-cel__jel', '·');
      jel.setAttribute('aria-hidden', 'true');
      const szoveg = elem('span', 'hsz-cel__szoveg');
      const cim = elem('span', 'hsz-cel__cim', c.szoveg);
      if (c.ellenproba) cim.classList.add('hsz-cel__cim--ellenproba');
      const megj = elem('span', 'hsz-cel__megj');
      megj.hidden = !this.feloldva;
      const allapot = elem('span', 'hsz-rejtett', probaE(c) ? 'vár' : '');
      szoveg.append(cim, megj);
      li.append(jel, allapot, szoveg);
      this.lista.append(li);
      return { li, jel, megj, allapot };
    });

    ellenoriz(this.f, {
      szunet: PROBA_SZUNET,
      indul: (i) => {
        sorok[i].li.className = 'hsz-cel hsz-cel--fut';
        sorok[i].jel.textContent = '…';
        sorok[i].allapot.textContent = 'fut';
        if (sorok[i].li.scrollIntoView) sorok[i].li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      },
      lepes: (i, e) => {
        const s = sorok[i];
        s.li.className = `hsz-cel ${e.ok ? 'hsz-cel--ok' : 'hsz-cel--hiba'}`;
        s.jel.textContent = e.ok ? '✔' : '✘';
        s.allapot.textContent = e.ok ? 'teljesült' : 'nem teljesült';
        s.megj.textContent = e.megjegyzes;
      },
      kesz: (eredmenyek) => this.kiertekel(eredmenyek, beadas),
    });
  }

  /** @private */
  kiertekel(eredmenyek, beadas) {
    const jo = eredmenyek.filter((e) => e.ok).length;
    const osszes = eredmenyek.length;
    const mind = jo === osszes;
    this.utolsoEredmeny = { jo, osszes, mind };
    this.fut = false;
    this.gomb.disabled = false;

    if (beadas) {
      if (mind) {
        this.felold('siker');
        this.vizsgaVege = true;
        this.osszegzes.textContent = `Sikeres vizsga! Mind a ${osszes} cél teljesült, az ellenpróbák is. `
          + `Idő: ${idoSzoveg(this.eltelt())}, ${this.beadasok}. beadásra. A magyarázat most már elolvasható.`;
        this.osszegzes.classList.add('hsz-panel__osszegzes--siker');
        this.gomb.textContent = 'Ellenőrzés';
      } else {
        this.osszegzes.textContent = `${jo} / ${osszes} cél teljesült (${this.beadasok}. beadás). `
          + 'A ✘ jelűeket nézd át – a részletes okokat a vizsga végén látod. Javíts, és add be újra!';
        this.gomb.textContent = 'Beadás újra';
      }
      return;
    }

    if (mind) {
      const tipp = this.mod === 'gyakorlo'
        ? (this.tippekSzama ? ` (${this.tippekSzama} tipp segítségével)` : ' – tipp nélkül!')
        : '';
      this.osszegzes.textContent = `Kész! Mind a ${osszes} cél teljesült, az ellenpróbák is${tipp}. Szép munka!`;
      this.osszegzes.classList.add('hsz-panel__osszegzes--siker');
    } else {
      this.osszegzes.textContent = `${jo} / ${osszes} cél teljesült. A ✘ jelűeknél olvasd el, mi a gond, javítsd, és ellenőrizz újra.`;
    }
    this.gomb.textContent = 'Ellenőrzés újra';
  }

  /** A panel leállítása (az óra megáll). */
  leallit() {
    clearInterval(this.oraIdozito);
  }
}

/**
 * „Változat: #12345 – Link másolása”: a tanár ezzel a linkkel ugyanazt a változatot adhatja
 * mindenkinek. Ha a vágólap nem érhető el (pl. fájlként megnyitott oldalon), a link egy
 * kijelölt szövegmezőben jelenik meg, onnan Ctrl+C-vel másolható.
 */
function valtozatSor(mag, link) {
  const p = elem('p', 'hsz-panel__valtozat');
  p.append(document.createTextNode('Véletlen adatok – változat: '), elem('b', '', `#${mag}`));
  if (!link) return p;
  const gomb = elem('button', 'hsz-tippgomb', 'Link másolása');
  gomb.type = 'button';
  gomb.title = 'Ezzel a linkkel bárki pontosan ezt a változatot kapja (pl. a tanár az osztálynak)';
  const mezo = elem('input', 'hsz-panel__link');
  mezo.type = 'text';
  mezo.readOnly = true;
  mezo.hidden = true;
  mezo.setAttribute('aria-label', 'A változat linkje');
  const megmutat = () => {
    mezo.value = link();
    mezo.hidden = false;
    mezo.focus();
    mezo.select();
  };
  gomb.addEventListener('click', () => {
    const url = link();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        gomb.textContent = 'Kimásolva!';
        setTimeout(() => { gomb.textContent = 'Link másolása'; }, 2000);
      }, megmutat);
    } else {
      megmutat();
    }
  });
  p.append(document.createTextNode(' '), gomb, mezo);
  return p;
}

/** A címterv táblázata (cím + görgethető táblázat). */
function cimtervTabla(cimterv) {
  const cim = elem('h3', 'hsz-panel__alcim', 'Címterv');
  const tabla = elem('table', 'hsz-panel__tabla');
  const fejsor = elem('tr');
  for (const c of ['Gép', 'IP-cím', 'Maszk', 'VLAN', 'Port']) fejsor.append(elem('th', '', c));
  const thead = elem('thead');
  thead.append(fejsor);
  const tbody = elem('tbody');
  for (const s of cimterv) {
    const tr = elem('tr');
    for (const c of [s.eszkoz, s.ip, s.maszk, s.vlan, s.hova]) tr.append(elem('td', '', c === undefined ? '' : String(c)));
    tbody.append(tr);
  }
  tabla.append(thead, tbody);
  const gorgeto = elem('div', 'hsz-panel__tablahely');
  gorgeto.append(tabla);
  return [cim, gorgeto];
}

/** A lenyitható magyarázat. */
function magyarazatElem(magyarazat) {
  const d = elem('details', 'hsz-magyarazat');
  d.append(elem('summary', 'hsz-magyarazat__cim', 'Magyarázat: mit, miért és miért így állítunk be?'));
  for (const resz of magyarazat) {
    d.append(szovegbe(elem('h4', 'hsz-magyarazat__alcim'), resz.cim));
    for (const bek of resz.szoveg || []) {
      if (Array.isArray(bek)) {
        const ul = elem('ul', 'hsz-magyarazat__lista');
        for (const li of bek) ul.append(szovegbe(elem('li'), li));
        d.append(ul);
      } else {
        d.append(szovegbe(elem('p', 'hsz-magyarazat__szoveg'), bek));
      }
    }
  }
  return d;
}
