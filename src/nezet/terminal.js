/**
 * Terminál-komponens: fekete háttér, sárga prompt, fehér szöveg, egyenközű betű.
 *
 * Billentyűk (mint egy valódi konzolon):
 *   Enter            parancs végrehajtása
 *   ?                súgó (a parancs után szóközzel vagy szó közben is)
 *   Tab              az elkezdett szó kiegészítése
 *   ↑ / ↓, Ctrl+P/N  előzmények
 *   Ctrl+A / Ctrl+E  ugrás a sor elejére / végére
 *   Ctrl+Z           kilépés a konfigurációs módból
 *   --More-- esetén: Szóköz = következő oldal, Enter = következő sor, bármi más = kilépés
 *
 * A terminál csak megjelenít: a parancsokat a munkamenet (cli/terminal-munkamenet.js) dolgozza fel.
 */

/** Egy oldalnyi sor a --More-- előtt (24 soros terminál: 23 sor + a --More-- sor). */
const OLDAL_SOROK = 23;
/** Legfeljebb ennyi sort tart meg a képernyőn (a régebbiek eltűnnek). */
const MAX_SOROK = 1000;

/** Egyszerű elemkészítő segéd. */
function elem(tag, osztaly, szoveg) {
  const e = document.createElement(tag);
  if (osztaly) e.className = osztaly;
  if (szoveg !== undefined) e.textContent = szoveg;
  return e;
}

export class Terminal {
  /**
   * @param {HTMLElement} szulo – ide kerül a terminál
   * @param {import('../cli/terminal-munkamenet.js').Munkamenet} munkamenet
   * @param {{cim?: string, parancsUtan?: (sor: string) => void}} [beallitasok]
   */
  constructor(szulo, munkamenet, beallitasok = {}) {
    this.mm = munkamenet;
    this.beallitasok = beallitasok;
    /** Hányadik előzménynél járunk (null = az új, még be nem küldött sornál). */
    this.tortenetIndex = null;
    this.piszkozat = '';
    this.foglalt = false;
    /** Lapozás közben: a még ki nem írt sorok. */
    this.lapozas = null;

    this.doboz = elem('section', 'hsz-terminal');
    this.doboz.setAttribute('aria-label', 'IOS-szerű parancssor');
    this.fej = elem('div', 'hsz-terminal__fej');
    this.fejCim = elem('span', 'hsz-terminal__cim');
    this.fej.append(elem('span', 'hsz-terminal__pottyok'), this.fejCim);
    this.kepernyo = elem('div', 'hsz-terminal__kepernyo');
    this.kimenet = elem('div', 'hsz-terminal__kimenet');
    this.kimenet.setAttribute('role', 'log');
    this.kimenet.setAttribute('aria-live', 'polite');
    this.sor = elem('div', 'hsz-terminal__sor');
    this.promptElem = elem('span', 'hsz-terminal__prompt');
    this.bevitel = elem('input', 'hsz-terminal__bevitel');
    Object.assign(this.bevitel, { type: 'text', autocomplete: 'off', spellcheck: false });
    this.bevitel.setAttribute('autocapitalize', 'off');
    this.bevitel.setAttribute('autocorrect', 'off');
    this.bevitel.setAttribute('aria-label', 'Parancs');
    this.bevitel.setAttribute('enterkeyhint', 'send');
    this.sor.append(this.promptElem, this.bevitel);
    this.kepernyo.append(this.kimenet, this.sor);

    // Érintőképernyőn nincs Tab, ? is nehezen jön elő, és a --More---hoz sincs szóköz: gombok.
    this.gombsor = elem('div', 'hsz-terminal__gombok');
    this.gombok = {
      sugo: this.gomb('?', 'Súgó', () => this.sugo()),
      tab: this.gomb('Tab', 'Kiegészítés', () => this.tab()),
      fel: this.gomb('↑', 'Előző parancs', () => this.tortenetLep(-1)),
      le: this.gomb('↓', 'Következő parancs', () => this.tortenetLep(1)),
      ctrlz: this.gomb('Ctrl+Z', 'Kilépés a konfigurációs módból', () => this.ctrlZ()),
      tovabb: this.gomb('Tovább', 'Következő oldal (szóköz)', () => this.lapozasLep('oldal')),
      kilep: this.gomb('Kilépés', 'A lista vége (q)', () => this.lapozasLep('kilep')),
    };
    this.doboz.append(this.fej, this.kepernyo, this.gombsor);
    szulo.append(this.doboz);

    this.bevitel.addEventListener('keydown', (e) => this.billentyu(e));
    this.bevitel.addEventListener('input', () => this.bevitelValtozott());
    this.kepernyo.addEventListener('click', () => {
      // Szöveg kijelölésekor (másoláshoz) ne ugorjon el a fókusz.
      if (!window.getSelection || String(window.getSelection()) === '') this.fokusz();
    });
    // Lapozás közben a képernyőn is lehet billentyűzni.
    this.kepernyo.tabIndex = -1;
    this.kepernyo.addEventListener('keydown', (e) => {
      if (this.lapozas && e.target === this.kepernyo) this.lapozasBillentyu(e);
    });

    this.frissitPrompt();
    this.gombAllapot();
  }

  /** @private */
  gomb(felirat, cim, fn) {
    const g = elem('button', 'hsz-terminal__gomb', felirat);
    g.type = 'button';
    g.title = cim;
    g.setAttribute('aria-label', cim);
    // Ne vegye el a fókuszt a beviteli mezőtől (különben telefonon eltűnne a billentyűzet).
    g.addEventListener('mousedown', (e) => e.preventDefault());
    g.addEventListener('click', () => {
      fn();
      if (!this.lapozas) this.fokusz();
    });
    this.gombsor.append(g);
    return g;
  }

  fokusz() {
    if (this.lapozas) this.kepernyo.focus({ preventScroll: true });
    else this.bevitel.focus({ preventScroll: true });
  }

  /** A fejléc felirata (pl. a gépnév). */
  cim(szoveg) {
    this.fejCim.textContent = szoveg;
  }

  // -------------------------------------------------------------------------
  // Kiírás
  // -------------------------------------------------------------------------

  /** Egy kimeneti sor. A „[Szimulátor]” kezdetű sorok a szimulátor saját megjegyzései. */
  kiirSor(szoveg) {
    const s = elem('div', 'hsz-terminal__kisor');
    if (szoveg.startsWith('[Szimulátor]')) s.classList.add('hsz-terminal__megjegyzes');
    s.textContent = szoveg === '' ? ' ' : szoveg;
    this.kimenet.append(s);
    this.vagas();
  }

  /** A beírt sor visszaírása: sárga prompt + fehér parancs. */
  visszhang(prompt, szoveg) {
    const s = elem('div', 'hsz-terminal__kisor');
    s.append(elem('span', 'hsz-terminal__prompt', prompt), document.createTextNode(szoveg));
    if (!prompt && !szoveg) s.textContent = ' ';
    this.kimenet.append(s);
    this.vagas();
  }

  /** @private – a túl régi sorok eldobása, és görgetés az aljára */
  vagas() {
    while (this.kimenet.childElementCount > MAX_SOROK) this.kimenet.firstElementChild.remove();
    this.kepernyo.scrollTop = this.kepernyo.scrollHeight;
  }

  frissitPrompt() {
    this.promptElem.textContent = this.mm.prompt();
  }

  /** @private */
  gombAllapot() {
    const lapoz = !!this.lapozas;
    for (const [nev, g] of Object.entries(this.gombok)) {
      const lapozoGomb = nev === 'tovabb' || nev === 'kilep';
      g.hidden = lapoz ? !lapozoGomb : lapozoGomb;
      g.disabled = this.foglalt && !lapoz;
    }
  }

  /**
   * Kimenet kiírása sorban. A { varj: ms } elemeknél vár; lapozható kimenetnél
   * oldalanként megáll (--More--).
   * @param {Array<string|{varj:number}>} elemek
   * @param {boolean} lapozhato
   */
  async kiirMind(elemek, lapozhato) {
    this.foglalt = true;
    this.sor.hidden = true;
    this.gombAllapot();
    if (lapozhato && elemek.length > OLDAL_SOROK) {
      await new Promise((kesz) => this.lapozasIndit(elemek, kesz));
    } else {
      for (const e of elemek) {
        if (typeof e === 'string') this.kiirSor(e);
        else await new Promise((r) => setTimeout(r, e.varj));
      }
    }
    this.foglalt = false;
    this.sor.hidden = false;
    this.frissitPrompt();
    this.gombAllapot();
    this.vagas();
    this.fokusz();
  }

  // -------------------------------------------------------------------------
  // Lapozás (--More--)
  // -------------------------------------------------------------------------

  /** @private */
  lapozasIndit(sorok, kesz) {
    this.lapozas = { sorok: sorok.filter((s) => typeof s === 'string'), hol: 0, kesz, more: null };
    this.lapozasKiir(OLDAL_SOROK);
  }

  /** @private – `db` sor kiírása, utána --More--, vagy vége */
  lapozasKiir(db) {
    const l = this.lapozas;
    if (l.more) l.more.remove();
    const veg = Math.min(l.sorok.length, l.hol + db);
    for (; l.hol < veg; l.hol++) this.kiirSor(l.sorok[l.hol]);
    if (l.hol >= l.sorok.length) return this.lapozasVege();
    l.more = elem('div', 'hsz-terminal__kisor hsz-terminal__more', ' --More-- ');
    this.kimenet.append(l.more);
    this.vagas();
    this.gombAllapot();
    this.kepernyo.focus({ preventScroll: true });
  }

  /** @private */
  lapozasVege() {
    const l = this.lapozas;
    if (l.more) l.more.remove();
    this.lapozas = null;
    l.kesz();
  }

  /** @private */
  lapozasLep(mit) {
    if (!this.lapozas) return;
    if (mit === 'oldal') this.lapozasKiir(OLDAL_SOROK);
    else if (mit === 'sor') this.lapozasKiir(1);
    else this.lapozasVege();
  }

  /** @private */
  lapozasBillentyu(e) {
    e.preventDefault();
    if (e.key === ' ') this.lapozasLep('oldal');
    else if (e.key === 'Enter') this.lapozasLep('sor');
    else if (e.key.length === 1 || e.key === 'Escape') this.lapozasLep('kilep');
  }

  // -------------------------------------------------------------------------
  // Bevitel
  // -------------------------------------------------------------------------

  /** @private */
  billentyu(e) {
    if (this.lapozas) return this.lapozasBillentyu(e);
    if (this.foglalt) {
      e.preventDefault();
      return;
    }
    const ctrl = e.ctrlKey && !e.altKey && !e.metaKey;
    const k = e.key;
    if (k === 'Enter') {
      e.preventDefault();
      this.enter();
    } else if (k === 'Tab') {
      e.preventDefault();
      this.tab();
    } else if (k === '?') {
      e.preventDefault();
      this.sugo();
    } else if (k === 'ArrowUp' || (ctrl && (k === 'p' || k === 'P'))) {
      e.preventDefault();
      this.tortenetLep(-1);
    } else if (k === 'ArrowDown' || (ctrl && (k === 'n' || k === 'N'))) {
      e.preventDefault();
      this.tortenetLep(1);
    } else if (ctrl && (k === 'z' || k === 'Z')) {
      e.preventDefault();
      this.ctrlZ();
    } else if (ctrl && (k === 'a' || k === 'A')) {
      e.preventDefault();
      this.bevitel.setSelectionRange(0, 0);
    } else if (ctrl && (k === 'e' || k === 'E')) {
      e.preventDefault();
      const n = this.bevitel.value.length;
      this.bevitel.setSelectionRange(n, n);
    }
  }

  /** Telefonon a ? nem mindig jön billentyűeseményként: itt kapjuk el. */
  bevitelValtozott() {
    const v = this.bevitel.value;
    const hol = v.indexOf('?');
    if (hol >= 0) {
      this.bevitel.value = v.slice(0, hol) + v.slice(hol + 1);
      this.bevitel.setSelectionRange(hol, hol);
      this.sugo();
    }
  }

  /** @private */
  enter() {
    const szoveg = this.bevitel.value;
    const prompt = this.mm.prompt();
    this.bevitel.value = '';
    this.tortenetIndex = null;
    this.visszhang(prompt, szoveg);
    const r = this.mm.bevitel(szoveg);
    if (this.beallitasok.parancsUtan && szoveg.trim() !== '') this.beallitasok.parancsUtan(szoveg);
    this.kiirMind(r.kimenet, r.lapozhato);
  }

  /** ? – súgó a kurzor előtti szöveghez; utána a sor visszakerül a mezőbe. */
  sugo() {
    if (this.foglalt) return;
    const teljes = this.bevitel.value;
    const kurzor = this.bevitel.selectionStart ?? teljes.length;
    const eleje = teljes.slice(0, kurzor);
    this.visszhang(this.mm.prompt(), eleje + '?');
    const r = this.mm.sugo(eleje);
    for (const s of r.kimenet) this.kiirSor(s);
    this.bevitel.value = eleje;
    this.frissitPrompt();
    this.fokusz();
  }

  /** Tab – kiegészítés (ha nem egyértelmű, nem változik semmi, mint a valódi eszközön). */
  tab() {
    if (this.foglalt) return;
    const uj = this.mm.kiegeszit(this.bevitel.value);
    if (uj !== null) this.bevitel.value = uj;
    const n = this.bevitel.value.length;
    this.bevitel.setSelectionRange(n, n);
  }

  /** Ctrl+Z – vissza a privilegizált módba. */
  ctrlZ() {
    if (this.foglalt) return;
    const prompt = this.mm.prompt();
    const szoveg = this.bevitel.value;
    this.bevitel.value = '';
    this.tortenetIndex = null;
    this.visszhang(prompt, szoveg + '^Z');
    const r = this.mm.ctrlZ();
    this.kiirMind(r.kimenet, false);
  }

  /** Előzmények: -1 = régebbi, +1 = újabb. */
  tortenetLep(irany) {
    if (this.foglalt) return;
    const lista = this.mm.tortenet();
    if (lista.length === 0) return;
    if (this.tortenetIndex === null) {
      if (irany > 0) return;
      this.piszkozat = this.bevitel.value;
      this.tortenetIndex = lista.length;
    }
    const uj = this.tortenetIndex + irany;
    if (uj < 0) return;
    if (uj >= lista.length) {
      this.tortenetIndex = null;
      this.bevitel.value = this.piszkozat;
    } else {
      this.tortenetIndex = uj;
      this.bevitel.value = lista[uj];
    }
    const n = this.bevitel.value.length;
    requestAnimationFrame(() => this.bevitel.setSelectionRange(n, n));
  }
}
