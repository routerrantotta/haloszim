/**
 * Topológianézet (SVG): az eszközök saját rajzú ikonokkal, a gépnév és a portok állapota.
 *
 * A v0.1-ben még csak egyetlen switch van, kábelek nélkül, ezért minden port-LED sötét.
 * Később: több eszköz, kábelek, a ping-csomag animációja a kábeleken.
 * A rajz saját készítésű (nem gyártói ikon).
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg(tag, attr = {}, szoveg) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attr)) e.setAttribute(k, String(v));
  if (szoveg !== undefined) e.textContent = szoveg;
  return e;
}

/** A switch rajzának méretei (SVG-egységben). */
const SW = { szel: 520, mag: 96, portSzel: 22, portMag: 17, koz: 4 };

export class Topologia {
  /**
   * @param {HTMLElement} szulo
   * @param {{eszkoz: Object, x: number, y: number}[]} eszkozok – az eszközök és a helyük
   * @param {{kattintas?: (eszkoz: Object) => void}} [beallitasok]
   */
  constructor(szulo, eszkozok, beallitasok = {}) {
    this.eszkozok = eszkozok;
    this.beallitasok = beallitasok;
    this.doboz = document.createElement('section');
    this.doboz.className = 'hsz-topologia';
    this.doboz.setAttribute('aria-label', 'Topológia');
    this.rajz = svg('svg', { viewBox: '0 0 640 190', class: 'hsz-topologia__rajz', role: 'img' });
    this.rajz.append(svg('title', {}, 'A hálózat rajza'));
    this.doboz.append(this.rajz);
    szulo.append(this.doboz);
    /** eszköz → { feliratElem, portElemek } */
    this.rajzok = new Map();
    for (const e of eszkozok) this.rajzok.set(e.eszkoz, this.switchRajz(e));
    this.frissit();
  }

  /** @private – egy switch kirajzolása */
  switchRajz({ eszkoz, x, y }) {
    const g = svg('g', { class: 'hsz-eszkoz', transform: `translate(${x} ${y})`, tabindex: 0, role: 'button' });
    g.setAttribute('aria-label', 'Switch – kattints, és írj a parancssorba');

    // Ház
    g.append(svg('rect', { x: 0, y: 0, width: SW.szel, height: SW.mag, rx: 10, class: 'hsz-eszkoz__haz' }));
    g.append(svg('rect', { x: 8, y: 8, width: SW.szel - 16, height: SW.mag - 16, rx: 6, class: 'hsz-eszkoz__elolap' }));

    // Bal oldali állapot-LED-ek (saját jelölés: rendszer + mód)
    g.append(svg('circle', { cx: 28, cy: 34, r: 4.5, class: 'hsz-led hsz-led--be' }));
    g.append(svg('text', { x: 38, y: 37, class: 'hsz-eszkoz__apro' }, 'SYS'));
    g.append(svg('circle', { cx: 28, cy: 54, r: 4.5, class: 'hsz-led' }));
    g.append(svg('text', { x: 38, y: 57, class: 'hsz-eszkoz__apro' }, 'MODE'));

    // 24 FastEthernet port két sorban (felül a páratlan, alul a páros számúak), 6-os csoportokban
    const portElemek = new Map();
    const kezdX = 82;
    for (const p of eszkoz.portok) {
      let px, py;
      const sorszam = Number(p.szam.split('/')[1]);
      if (p.tipus === 'FastEthernet') {
        const oszlop = Math.floor((sorszam - 1) / 2);
        const csoport = Math.floor(oszlop / 6);
        px = kezdX + oszlop * (SW.portSzel + SW.koz) + csoport * 10;
        py = sorszam % 2 === 1 ? 24 : 24 + SW.portMag + 14;
      } else {
        px = kezdX + 12 * (SW.portSzel + SW.koz) + 2 * 10 + 34 + (sorszam - 1) * (SW.portSzel + 10);
        py = 24 + (SW.portMag + 14) / 2;
      }
      const pg = svg('g', { class: 'hsz-port' });
      const cim = svg('title');
      pg.append(cim);
      pg.append(svg('rect', { x: px, y: py, width: SW.portSzel, height: SW.portMag, rx: 2, class: 'hsz-port__aljzat' }));
      pg.append(svg('rect', { x: px + 6, y: py + SW.portMag - 6, width: SW.portSzel - 12, height: 4, class: 'hsz-port__nyelv' }));
      const led = svg('rect', { x: px + 6, y: py - 6, width: SW.portSzel - 12, height: 3, rx: 1, class: 'hsz-led' });
      pg.append(led);
      if (p.tipus === 'FastEthernet' && sorszam % 2 === 1) {
        pg.append(svg('text', { x: px + SW.portSzel / 2, y: py - 9, class: 'hsz-eszkoz__apro hsz-kozep' }, String(sorszam)));
      } else if (p.tipus === 'FastEthernet') {
        pg.append(svg('text', { x: px + SW.portSzel / 2, y: py + SW.portMag + 10, class: 'hsz-eszkoz__apro hsz-kozep' }, String(sorszam)));
      } else {
        pg.append(svg('text', { x: px + SW.portSzel / 2, y: py + SW.portMag + 10, class: 'hsz-eszkoz__apro hsz-kozep' }, `G${sorszam}`));
      }
      g.append(pg);
      portElemek.set(p.nev, { pg, cim, led });
    }

    // Felirat a ház alatt: a gépnév (élőben frissül) és a típus
    const felirat = svg('text', { x: SW.szel / 2, y: SW.mag + 30, class: 'hsz-eszkoz__nev hsz-kozep' });
    const tipus = svg('text', { x: SW.szel / 2, y: SW.mag + 50, class: 'hsz-eszkoz__tipus hsz-kozep' }, '2960-24 jellegű switch');
    g.append(felirat, tipus);

    const kattint = () => this.beallitasok.kattintas && this.beallitasok.kattintas(eszkoz);
    g.addEventListener('click', kattint);
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        kattint();
      }
    });
    this.rajz.append(g);
    return { felirat, portElemek };
  }

  /** Újrarajzolja a változó részeket (gépnév, portállapot). */
  frissit() {
    for (const { eszkoz } of this.eszkozok) {
      const r = this.rajzok.get(eszkoz);
      r.felirat.textContent = eszkoz.hostname;
      for (const p of eszkoz.portok) {
        const pe = r.portElemek.get(p.nev);
        pe.pg.classList.toggle('hsz-port--lekapcsolva', p.leallitva);
        pe.cim.textContent = `${p.nev} – ${p.leallitva ? 'lekapcsolva (shutdown)' : 'bekapcsolva, de nincs kábel'}`;
      }
    }
  }
}
