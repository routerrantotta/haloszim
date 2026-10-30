/**
 * Feladatpanel: a feladat leírása, a teendők, a címterv, és az „Ellenőrzés” gomb a célok
 * listájával (pipák: mi teljesült, mi nem, és miért). A próbák (ping, szórás) közben a
 * csomagok a topológián mozognak.
 */

import { ellenoriz, probaE } from '../feladat/ellenorzo.js';

function elem(tag, osztaly, szoveg) {
  const e = document.createElement(tag);
  if (osztaly) e.className = osztaly;
  if (szoveg !== undefined) e.textContent = szoveg;
  return e;
}

/** Szünet két próba között (ms), hogy a csomagok ne keveredjenek a rajzon. */
const PROBA_SZUNET = 500;

export class FeladatPanel {
  /**
   * @param {HTMLElement} szulo
   * @param {import('../feladat/betolto.js').BetoltottFeladat} f
   * @param {{kezdes?: () => void, vege?: () => void}} [beallitasok]
   */
  constructor(szulo, f, beallitasok = {}) {
    this.f = f;
    this.beallitasok = beallitasok;
    const fd = f.feladat;
    this.doboz = elem('section', 'hsz-panel');
    this.doboz.setAttribute('aria-label', 'Feladat');

    const fej = elem('div', 'hsz-panel__fej');
    fej.append(elem('h2', 'hsz-panel__cim', fd.cim));
    if (fd.szint) fej.append(elem('span', 'hsz-panel__szint', fd.szint));
    this.doboz.append(fej);
    for (const bek of fd.leiras || []) this.doboz.append(elem('p', 'hsz-panel__szoveg', bek));

    if (fd.lepesek && fd.lepesek.length) {
      this.doboz.append(elem('h3', 'hsz-panel__alcim', 'Teendők'));
      const ol = elem('ol', 'hsz-panel__lepesek');
      for (const l of fd.lepesek) ol.append(elem('li', '', l));
      this.doboz.append(ol);
    }

    if (fd.cimterv && fd.cimterv.length) {
      this.doboz.append(elem('h3', 'hsz-panel__alcim', 'Címterv'));
      const tabla = elem('table', 'hsz-panel__tabla');
      const fejsor = elem('tr');
      for (const c of ['Gép', 'IP-cím', 'Maszk', 'VLAN', 'Port']) fejsor.append(elem('th', '', c));
      const thead = elem('thead');
      thead.append(fejsor);
      const tbody = elem('tbody');
      for (const s of fd.cimterv) {
        const tr = elem('tr');
        for (const c of [s.eszkoz, s.ip, s.maszk, s.vlan, s.hova]) tr.append(elem('td', '', c === undefined ? '' : String(c)));
        tbody.append(tr);
      }
      tabla.append(thead, tbody);
      const gorgeto = elem('div', 'hsz-panel__tablahely');
      gorgeto.append(tabla);
      this.doboz.append(gorgeto);
    }

    this.gomb = elem('button', 'hsz-gomb hsz-gomb--fo', 'Ellenőrzés');
    this.gomb.type = 'button';
    this.gomb.addEventListener('click', () => this.ellenoriz());
    this.osszegzes = elem('p', 'hsz-panel__osszegzes');
    this.osszegzes.setAttribute('role', 'status');
    this.lista = elem('ul', 'hsz-celok');
    this.lista.hidden = true;
    // A gomb és az összegzés a panel alján marad (görgetéskor is látszik).
    const lab = elem('div', 'hsz-panel__lab');
    lab.append(this.osszegzes, this.gomb);
    this.doboz.append(this.lista, lab);
    szulo.append(this.doboz);
  }

  /** Az ellenőrzés indítása. */
  ellenoriz() {
    if (this.fut) return;
    this.fut = true;
    this.gomb.disabled = true;
    this.gomb.textContent = 'Ellenőrzés folyik…';
    this.osszegzes.textContent = 'A próbák futnak – figyeld a csomagokat a rajzon!';
    this.osszegzes.className = 'hsz-panel__osszegzes';
    if (this.beallitasok.kezdes) this.beallitasok.kezdes();

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
        sorok[i].li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      },
      lepes: (i, e) => {
        const s = sorok[i];
        s.li.className = `hsz-cel ${e.ok ? 'hsz-cel--ok' : 'hsz-cel--hiba'}`;
        s.jel.textContent = e.ok ? '✔' : '✘';
        s.allapot.textContent = e.ok ? 'teljesült' : 'nem teljesült';
        s.megj.textContent = e.megjegyzes;
      },
      kesz: (eredmenyek) => {
        const jo = eredmenyek.filter((e) => e.ok).length;
        const osszes = eredmenyek.length;
        if (jo === osszes) {
          this.osszegzes.textContent = `Kész! Mind a ${osszes} cél teljesült, az ellenpróbák is. Szép munka!`;
          this.osszegzes.classList.add('hsz-panel__osszegzes--siker');
        } else {
          this.osszegzes.textContent = `${jo} / ${osszes} cél teljesült. A ✘ jelűeknél olvasd el, mi a gond, javítsd, és ellenőrizz újra.`;
        }
        this.fut = false;
        this.gomb.disabled = false;
        this.gomb.textContent = 'Ellenőrzés újra';
        if (this.beallitasok.vege) this.beallitasok.vege();
      },
    });
  }
}
