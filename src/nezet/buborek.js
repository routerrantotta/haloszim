/**
 * Buborék: a bemutató (oktató mód) magyarázó doboza, nyíllal egy elemre mutatva
 * (eszköz a rajzon, terminál beviteli sora, PC-űrlap, Ellenőrzés gomb …).
 *
 * „position: fixed” – a nézetablakhoz igazodik; görgetéskor és átméretezéskor újra elhelyezi magát.
 */

function elem(tag, osztaly, szoveg) {
  const e = document.createElement(tag);
  if (osztaly) e.className = osztaly;
  if (szoveg !== undefined) e.textContent = szoveg;
  return e;
}

/** `…` → <code> (csak szövegcsomópontok, nincs innerHTML). */
function szovegbe(cel, szoveg) {
  String(szoveg || '').split('`').forEach((resz, i) => {
    if (resz === '') return;
    cel.append(i % 2 === 1 ? elem('code', 'hsz-kod', resz) : document.createTextNode(resz));
  });
  return cel;
}

const KOZ = 14;

export class Buborek {
  /** @param {HTMLElement} szulo */
  constructor(szulo) {
    this.doboz = elem('div', 'hsz-buborek');
    this.doboz.setAttribute('role', 'dialog');
    this.doboz.setAttribute('aria-label', 'Bemutató');
    this.doboz.hidden = true;
    this.nyil = elem('div', 'hsz-buborek__nyil');
    this.fej = elem('div', 'hsz-buborek__fej');
    this.szamlalo = elem('span', 'hsz-buborek__szamlalo');
    this.bezar = elem('button', 'hsz-buborek__x', '×');
    this.bezar.type = 'button';
    this.bezar.title = 'A bemutató bezárása';
    this.bezar.setAttribute('aria-label', 'A bemutató bezárása');
    this.fej.append(this.szamlalo, this.bezar);
    this.szoveg = elem('p', 'hsz-buborek__szoveg');
    this.szoveg.setAttribute('aria-live', 'polite');
    this.miert = elem('p', 'hsz-buborek__miert');
    this.gombok = elem('div', 'hsz-buborek__gombok');
    this.doboz.append(this.nyil, this.fej, this.szoveg, this.miert, this.gombok);
    szulo.append(this.doboz);

    this.cel = null;
    this.helyezFn = () => this.helyez();
    window.addEventListener('resize', this.helyezFn);
    window.addEventListener('scroll', this.helyezFn, true);
    this.idozito = setInterval(this.helyezFn, 400);
  }

  /**
   * @param {{cel: Element|null, szamlalo: string, szoveg: string, miert?: string,
   *          gombok: {felirat: string, fn: () => void, fo?: boolean}[], bezar: () => void, gorget?: boolean}} p
   */
  mutat(p) {
    if (this.cel && this.cel !== p.cel) this.cel.classList.remove('hsz-kiemelt');
    this.cel = p.cel;
    if (this.cel) this.cel.classList.add('hsz-kiemelt');
    this.szamlalo.textContent = p.szamlalo;
    this.szoveg.textContent = '';
    szovegbe(this.szoveg, p.szoveg);
    this.miert.textContent = '';
    if (p.miert) {
      this.miert.append(elem('b', '', 'Miért? '));
      szovegbe(this.miert, p.miert);
    }
    this.miert.hidden = !p.miert;
    this.gombok.textContent = '';
    for (const g of p.gombok) {
      const b = elem('button', g.fo ? 'hsz-gomb hsz-gomb--kicsi' : 'hsz-tippgomb', g.felirat);
      b.type = 'button';
      b.addEventListener('click', g.fn);
      this.gombok.append(b);
    }
    this.bezar.onclick = p.bezar;
    this.doboz.hidden = false;
    if (p.gorget && this.cel && this.cel.scrollIntoView) {
      const r = this.cel.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) this.cel.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    this.helyez();
  }

  /** Elhelyezés a cél alá (ha nem fér, fölé), vízszintesen a nézetablakon belül. */
  helyez() {
    if (this.doboz.hidden) return;
    const w = this.doboz.offsetWidth;
    const h = this.doboz.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!this.cel || !this.cel.isConnected) {
      this.doboz.style.left = `${Math.max(8, (vw - w) / 2)}px`;
      this.doboz.style.top = `${Math.max(8, vh - h - 16)}px`;
      this.nyil.hidden = true;
      return;
    }
    const r = this.cel.getBoundingClientRect();
    let top;
    let lent = true;
    if (r.bottom + KOZ + h <= vh - 8) top = r.bottom + KOZ;
    else if (r.top - KOZ - h >= 8) {
      top = r.top - KOZ - h;
      lent = false;
    } else top = Math.max(8, vh - h - 8);
    const kozep = r.left + r.width / 2;
    const left = Math.min(Math.max(8, kozep - w / 2), Math.max(8, vw - w - 8));
    this.doboz.style.left = `${left}px`;
    this.doboz.style.top = `${top}px`;
    // A nyíl a cél közepe felé mutat (ha a cél látszik).
    const latszik = r.bottom > 0 && r.top < vh;
    this.nyil.hidden = !latszik;
    this.nyil.className = `hsz-buborek__nyil hsz-buborek__nyil--${lent ? 'fent' : 'lent'}`;
    this.nyil.style.left = `${Math.min(Math.max(14, kozep - left), w - 14)}px`;
  }

  elrejt() {
    this.doboz.hidden = true;
    if (this.cel) this.cel.classList.remove('hsz-kiemelt');
    this.cel = null;
  }

  /** Végleges eltávolítás (feladatváltáskor). */
  megszuntet() {
    this.elrejt();
    clearInterval(this.idozito);
    window.removeEventListener('resize', this.helyezFn);
    window.removeEventListener('scroll', this.helyezFn, true);
    this.doboz.remove();
  }
}
