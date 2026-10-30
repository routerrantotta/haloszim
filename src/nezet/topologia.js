/**
 * Topológianézet (SVG): eszközök saját rajzú ikonokkal, kábelek portcímkékkel, link-LED-ek,
 * és a csomagok animációja a kábeleken.
 *
 * Rétegek (alulról felfelé): kábelek → eszközök → mozgó csomagok és jelek.
 * A rajzok saját készítésűek (nem gyártói ikonok).
 *
 * Az animáció a hálózat eseményeiből jön (mag/halozat.js): minden „keret” eseménynél egy
 * pötty végigcsúszik a kábelen. Színek: ARP = narancs, ping (ICMP) = fekete-sárga, VTP = fehér rombusz;
 * a trunkon a 802.1Q-címke (VLAN-szám) a pötty fölött látszik. Eldobott keret: ✕ jel.
 */

import { uzemmod } from '../mag/kapcsolas.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg(tag, attr = {}, szoveg) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attr)) e.setAttribute(k, String(v));
  if (szoveg !== undefined) e.textContent = szoveg;
  return e;
}

/** A switch rajzának méretei (saját egységben), és a nagyítás a topológián. */
const SW = { szel: 520, mag: 96, portSzel: 22, portMag: 17, koz: 4, nagyitas: 0.6 };
/** A PC rajzának méretei. */
const PC = { szel: 80, mag: 66 };

const MOD_SZOVEG = { access: 'access', trunk: 'trunk', 'dinamikus-auto': 'dynamic auto', 'dinamikus-kezdemenyezo': 'dynamic desirable' };

/** A port helye a switch saját rajzán (a bal felső sarka). */
function swPortHely(p) {
  const sorszam = Number(p.szam.split('/')[1]);
  const kezdX = 82;
  if (p.tipus === 'FastEthernet') {
    const oszlop = Math.floor((sorszam - 1) / 2);
    const csoport = Math.floor(oszlop / 6);
    return {
      x: kezdX + oszlop * (SW.portSzel + SW.koz) + csoport * 10,
      y: sorszam % 2 === 1 ? 24 : 24 + SW.portMag + 14,
      sorszam,
    };
  }
  return {
    x: kezdX + 12 * (SW.portSzel + SW.koz) + 2 * 10 + 34 + (sorszam - 1) * (SW.portSzel + 10),
    y: 24 + (SW.portMag + 14) / 2,
    sorszam,
  };
}

export class Topologia {
  /**
   * @param {HTMLElement} szulo
   * @param {{elemek: {eszkoz: Object, x: number, y: number, tipus: string}[], halozat: Object,
   *          meret?: {szel: number, mag: number}}} adat
   * @param {{valaszt?: (eszkoz: Object) => void, sebesseg?: () => number}} [beallitasok]
   */
  constructor(szulo, { elemek, halozat, meret }, beallitasok = {}) {
    this.elemek = elemek;
    this.halozat = halozat;
    /** Van-e értelme a VTP-jelnek a jelmagyarázatban (legalább két switch). */
    this.vanVtp = elemek.filter((e) => e.tipus === 'switch').length > 1;
    this.beallitasok = beallitasok;
    const m = meret || { szel: 800, mag: 400 };

    this.doboz = document.createElement('section');
    this.doboz.className = 'hsz-topologia';
    this.doboz.setAttribute('aria-label', 'Topológia');
    this.rajz = svg('svg', { viewBox: `0 0 ${m.szel} ${m.mag}`, class: 'hsz-topologia__rajz', role: 'group' });
    this.rajz.append(svg('title', {}, 'A hálózat rajza – kattints egy eszközre a kezeléséhez'));
    this.kabelReteg = svg('g', { class: 'hsz-kabelek' });
    this.eszkozReteg = svg('g');
    this.animReteg = svg('g', { class: 'hsz-anim' });
    this.rajz.append(this.kabelReteg, this.eszkozReteg, this.animReteg);
    this.doboz.append(this.rajz, this.jelmagyarazat());
    szulo.append(this.doboz);

    /** eszköz → { g, felirat, ipFelirat?, portok: Map<portnév, {x, y, led, pg?, cim}> } */
    this.rajzok = new Map();
    for (const e of elemek) {
      this.rajzok.set(e.eszkoz, e.tipus === 'switch' ? this.switchRajz(e) : this.pcRajz(e));
    }
    /** a kábelek rajza: { k (a hálózat kábele), ut (path), cimkek, trunkFelirat } */
    this.kabelek = halozat.kabelek.map((k) => this.kabelRajz(k));

    /** @type {{g: SVGElement, ut: SVGPathElement, hossz: number, elore: boolean, kezd: number, ido: number}[]} */
    this.mozgok = [];
    this.animFut = false;
    this.leiratkozas = halozat.figyel((e) => this.esemeny(e));
    this.frissit();
  }

  /** @private */
  jelmagyarazat() {
    const j = document.createElement('p');
    j.className = 'hsz-jelmagyarazat';
    j.innerHTML = '<span><i class="hsz-potty hsz-potty--arp"></i>ARP</span>'
      + '<span><i class="hsz-potty hsz-potty--icmp"></i>ping (ICMP)</span>'
      + (this.vanVtp ? '<span><i class="hsz-potty hsz-potty--vtp"></i>VTP-hirdetés</span>' : '')
      + '<span><b class="hsz-cimke-minta">10</b>802.1Q-címke (VLAN)</span>'
      + '<span><b class="hsz-x-minta">✕</b>eldobott keret</span>'
      + '<span><i class="hsz-vonal-minta"></i>trunk</span>';
    return j;
  }

  /** @private – kattintható csoport egy eszköznek */
  kattinthato(g, eszkoz, leiras) {
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'button');
    g.setAttribute('aria-label', leiras);
    const valaszt = () => this.beallitasok.valaszt && this.beallitasok.valaszt(eszkoz);
    g.addEventListener('click', valaszt);
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        valaszt();
      }
    });
  }

  /** @private – egy switch kirajzolása (kicsinyítve) */
  switchRajz({ eszkoz, x, y }) {
    const n = SW.nagyitas;
    const kulso = svg('g', { class: 'hsz-eszkoz' });
    this.kattinthato(kulso, eszkoz, `Switch: ${eszkoz.hostname} – kattints, és írj a parancssorába`);
    const g = svg('g', { transform: `translate(${x} ${y}) scale(${n})` });
    g.append(svg('rect', { x: 0, y: 0, width: SW.szel, height: SW.mag, rx: 10, class: 'hsz-eszkoz__haz' }));
    g.append(svg('rect', { x: 8, y: 8, width: SW.szel - 16, height: SW.mag - 16, rx: 6, class: 'hsz-eszkoz__elolap' }));
    g.append(svg('circle', { cx: 28, cy: 34, r: 5, class: 'hsz-led hsz-led--be' }));
    g.append(svg('text', { x: 38, y: 38, class: 'hsz-eszkoz__apro' }, 'SYS'));
    g.append(svg('circle', { cx: 28, cy: 56, r: 5, class: 'hsz-led' }));
    g.append(svg('text', { x: 38, y: 60, class: 'hsz-eszkoz__apro' }, 'MODE'));

    const portok = new Map();
    for (const p of eszkoz.portok) {
      const h = swPortHely(p);
      const pg = svg('g', { class: 'hsz-port' });
      const cim = svg('title');
      pg.append(cim);
      pg.append(svg('rect', { x: h.x, y: h.y, width: SW.portSzel, height: SW.portMag, rx: 2, class: 'hsz-port__aljzat' }));
      pg.append(svg('rect', { x: h.x + 6, y: h.y + SW.portMag - 6, width: SW.portSzel - 12, height: 4, class: 'hsz-port__nyelv' }));
      const led = svg('rect', { x: h.x + 5, y: h.y - 7, width: SW.portSzel - 10, height: 4, rx: 1, class: 'hsz-led' });
      pg.append(led);
      const felul = p.tipus === 'FastEthernet' && h.sorszam % 2 === 1;
      const szam = p.tipus === 'FastEthernet' ? String(h.sorszam) : `G${h.sorszam}`;
      pg.append(svg('text', { x: h.x + SW.portSzel / 2, y: felul ? h.y - 10 : h.y + SW.portMag + 11, class: 'hsz-eszkoz__apro hsz-kozep' }, szam));
      g.append(pg);
      portok.set(p.nev, {
        x: x + n * (h.x + SW.portSzel / 2),
        y: y + n * (h.y + SW.portMag / 2),
        led,
        pg,
        cim,
      });
    }
    const felirat = svg('text', { x, y: y - 9, class: 'hsz-eszkoz__nev' });
    const nev = svg('tspan');
    const tipus = svg('tspan', { class: 'hsz-eszkoz__tipus', dx: 8 }, '2960-24 jellegű switch');
    felirat.append(nev, tipus);
    kulso.append(g, felirat);
    this.eszkozReteg.append(kulso);
    return { g: kulso, felirat: nev, portok, also: y + n * SW.mag, felso: y, tipus: 'switch' };
  }

  /** @private – egy PC kirajzolása */
  pcRajz({ eszkoz, x, y }) {
    const g = svg('g', { class: 'hsz-eszkoz hsz-eszkoz--pc', transform: `translate(${x} ${y})` });
    this.kattinthato(g, eszkoz, `PC: ${eszkoz.hostname} – kattints a beállításaihoz és a parancssorához`);
    g.append(svg('rect', { x: 0, y: 0, width: PC.szel, height: 52, rx: 6, class: 'hsz-eszkoz__haz' }));
    g.append(svg('rect', { x: 6, y: 6, width: PC.szel - 12, height: 38, rx: 2, class: 'hsz-pc__kepernyo' }));
    g.append(svg('text', { x: 11, y: 20, class: 'hsz-pc__prompt' }, 'C:\\>_'));
    g.append(svg('rect', { x: PC.szel / 2 - 6, y: 52, width: 12, height: 8, class: 'hsz-eszkoz__haz' }));
    g.append(svg('rect', { x: PC.szel / 2 - 20, y: 59, width: 40, height: 7, rx: 3, class: 'hsz-eszkoz__haz' }));
    const led = svg('circle', { cx: PC.szel - 9, cy: 48, r: 2.5, class: 'hsz-led' });
    const cim = svg('title');
    g.append(led, cim);
    const felirat = svg('text', { x: PC.szel / 2, y: PC.mag + 18, class: 'hsz-eszkoz__nev hsz-kozep' });
    const ipFelirat = svg('text', { x: PC.szel / 2, y: PC.mag + 34, class: 'hsz-eszkoz__ip hsz-kozep' });
    g.append(felirat, ipFelirat);
    this.eszkozReteg.append(g);
    const portok = new Map([[eszkoz.portok[0].nev, { x: x + PC.szel / 2, y, led, cim }]]);
    return { g, felirat, ipFelirat, portok, tipus: 'pc' };
  }

  /** @private – egy kábel útvonala és portcímkéi */
  kabelRajz(k) {
    const ra = this.rajzok.get(k.a.eszkoz);
    const rb = this.rajzok.get(k.b.eszkoz);
    const pa = ra.portok.get(k.a.port.nev);
    const pb = rb.portok.get(k.b.port.nev);
    let d;
    const cimkek = [];
    if (ra.tipus === 'switch' && rb.tipus === 'switch') {
      // Két switch: a portokból felfelé, és felül át.
      const fent = Math.min(ra.felso, rb.felso) - 30;
      d = `M ${pa.x} ${pa.y} L ${pa.x} ${fent} L ${pb.x} ${fent} L ${pb.x} ${pb.y}`;
      cimkek.push({ x: pa.x + 5, y: ra.felso - 5, szoveg: k.a.port.rovid, igazit: 'start' });
      cimkek.push({ x: pb.x - 5, y: rb.felso - 5, szoveg: k.b.port.rovid, igazit: 'end' });
    } else {
      // Switch és PC: a portból lefelé, ívben a PC tetejéig.
      const [sw, swp, swk, pcp] = ra.tipus === 'switch' ? [ra, pa, k.a, pb] : [rb, pb, k.b, pa];
      const ki = sw.also + 10;
      const forditott = sw !== ra;
      // Az útvonal az „a” végtől a „b” végig tart (az animáció iránya ezen múlik).
      d = forditott
        ? `M ${pcp.x} ${pcp.y} C ${pcp.x} ${pcp.y - 80} ${swp.x} ${ki + 70} ${swp.x} ${ki} L ${swp.x} ${swp.y}`
        : `M ${swp.x} ${swp.y} L ${swp.x} ${ki} C ${swp.x} ${ki + 70} ${pcp.x} ${pcp.y - 80} ${pcp.x} ${pcp.y}`;
      const balra = pcp.x < swp.x;
      cimkek.push({ x: swp.x + (balra ? -5 : 5), y: sw.also + 14, szoveg: swk.port.rovid, igazit: balra ? 'end' : 'start' });
      cimkek.push({ x: pcp.x + 5, y: pcp.y - 6, szoveg: 'Fa0', igazit: 'start' });
    }
    const ut = svg('path', { d, class: 'hsz-kabel' });
    this.kabelReteg.append(ut);
    for (const c of cimkek) {
      this.kabelReteg.append(svg('text', { x: c.x, y: c.y, class: 'hsz-kabel__cimke', 'text-anchor': c.igazit }, c.szoveg));
    }
    return { k, ut };
  }

  /** Kijelöli az éppen kezelt eszközt. */
  kijelol(eszkoz) {
    for (const [e, r] of this.rajzok) r.g.classList.toggle('hsz-eszkoz--kijelolt', e === eszkoz);
  }

  /** Újrarajzolja a változó részeket (nevek, IP-címek, LED-ek, kábelek állapota). */
  frissit() {
    for (const [eszkoz, r] of this.rajzok) {
      r.felirat.textContent = eszkoz.hostname;
      if (r.tipus === 'pc') {
        r.ipFelirat.textContent = eszkoz.ip ? `${eszkoz.ip}` : 'nincs IP-cím';
        r.ipFelirat.classList.toggle('hsz-eszkoz__ip--nincs', !eszkoz.ip);
        const p = r.portok.get(eszkoz.portok[0].nev);
        p.led.classList.toggle('hsz-led--be', eszkoz.portok[0].fent);
        p.cim.textContent = `${eszkoz.hostname} – ${eszkoz.ip || 'nincs IP-cím'}${eszkoz.maszk ? ' / ' + eszkoz.maszk : ''}`;
        continue;
      }
      for (const p of eszkoz.portok) {
        const pe = r.portok.get(p.nev);
        pe.pg.classList.toggle('hsz-port--lekapcsolva', p.leallitva);
        pe.led.classList.toggle('hsz-led--be', p.fent);
        let allapot;
        if (p.leallitva) allapot = 'lekapcsolva (shutdown)';
        else if (p.fent) allapot = uzemmod(eszkoz, p) === 'trunk' ? 'működik, trunk' : `működik, VLAN ${p.accessVlan}`;
        else allapot = 'nincs kábel';
        pe.cim.textContent = `${p.nev} – ${allapot} (mód: ${MOD_SZOVEG[p.mod]})`;
      }
    }
    for (const kr of this.kabelek) {
      const { a, b } = kr.k;
      const fent = a.port.fent && b.port.fent;
      const trunk = fent && a.eszkoz.tipus === 'switch' && uzemmod(a.eszkoz, a.port) === 'trunk';
      kr.ut.classList.toggle('hsz-kabel--le', !fent);
      kr.ut.classList.toggle('hsz-kabel--trunk', trunk);
    }
  }

  // -------------------------------------------------------------------------
  // Animáció
  // -------------------------------------------------------------------------

  /** @private */
  esemeny(e) {
    if (e.tipus === 'keret') this.csomag(e);
    else if (e.tipus === 'eldobva') this.eldobva(e);
    else if (e.tipus === 'allapot') this.frissit();
  }

  /** @private – egy keret elindul egy kábelen */
  csomag(e) {
    const kr = this.kabelek.find((x) => x.k === this.halozat.kabelVege(e.honnan.eszkoz, e.honnan.port));
    if (!kr || typeof kr.ut.getTotalLength !== 'function') return;
    const elore = kr.k.a.eszkoz === e.honnan.eszkoz && kr.k.a.port === e.honnan.port;
    const fajta = e.keret.tipus === 'arp' || e.keret.tipus === 'vtp' ? e.keret.tipus : 'icmp';
    const g = svg('g', { class: `hsz-csomag hsz-csomag--${fajta}` });
    g.append(svg('circle', { r: 7 }));
    if (e.keret.vlan !== undefined) {
      const c = svg('g', { class: 'hsz-csomag__cimke', transform: 'translate(0 -16)' });
      c.append(svg('rect', { x: -13, y: -8, width: 26, height: 15, rx: 4 }));
      c.append(svg('text', { x: 0, y: 4, class: 'hsz-kozep' }, String(e.keret.vlan)));
      g.append(c);
    }
    g.append(svg('title', {}, csomagLeiras(e.keret)));
    this.animReteg.append(g);
    // A szimulált idő lassítható (sebesség < 1): ennyivel tovább tart az út valós időben.
    const sebesseg = this.beallitasok.sebesseg ? this.beallitasok.sebesseg() : 1;
    const m = { g, ut: kr.ut, hossz: kr.ut.getTotalLength(), elore, kezd: performance.now(), ido: Math.max(1, e.idotartam / sebesseg) };
    this.mozgok.push(m);
    this.helyez(m, 0);
    // Ha a lap nem látszik (nincs animációs képkocka), akkor is tűnjön el.
    setTimeout(() => this.torolMozgo(m), m.ido + 100);
    if (!this.animFut) {
      this.animFut = true;
      requestAnimationFrame((t) => this.kepkocka(t));
    }
  }

  /** @private */
  helyez(m, arany) {
    const hol = m.elore ? arany * m.hossz : (1 - arany) * m.hossz;
    const p = m.ut.getPointAtLength(hol);
    m.g.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
  }

  /** @private */
  torolMozgo(m) {
    m.g.remove();
    this.mozgok = this.mozgok.filter((x) => x !== m);
  }

  /** @private */
  kepkocka(most) {
    for (const m of this.mozgok.slice()) {
      const arany = (most - m.kezd) / m.ido;
      if (arany >= 1) this.torolMozgo(m);
      else this.helyez(m, Math.max(0, arany));
    }
    if (this.mozgok.length) requestAnimationFrame((t) => this.kepkocka(t));
    else this.animFut = false;
  }

  /** @private – ✕ jel ott, ahol egy keret elakadt */
  eldobva(e) {
    const r = this.rajzok.get(e.eszkoz);
    const p = r && r.portok.get(e.port.nev);
    if (!p) return;
    const g = svg('g', { class: 'hsz-eldobva', transform: `translate(${p.x} ${p.y + (r.tipus === 'switch' ? 0 : -10)})` });
    g.append(svg('circle', { r: 10 }));
    g.append(svg('text', { x: 0, y: 5, class: 'hsz-kozep' }, '✕'));
    g.append(svg('title', {}, e.ok));
    this.animReteg.append(g);
    setTimeout(() => g.remove(), 2500);
  }
}

/** A csomag rövid leírása (a pötty buboréka). */
function csomagLeiras(k) {
  if (k.tipus === 'vtp') {
    const a = k.adat;
    return `VTP-${a.keres ? 'kérés és hirdetés' : 'hirdetés'} (${a.kuldo}): tartomány ${a.tartomany}, revízió ${a.revizio}, `
      + `VLAN-ok: ${Object.keys(a.vlanok).join(', ') || '–'}`;
  }
  const cimke = k.vlan !== undefined ? ` – 802.1Q-címke: VLAN ${k.vlan}` : '';
  if (k.tipus === 'arp') {
    const a = k.adat;
    if (a.muvelet === 'keres') return `ARP-kérdés (szórás): kié a(z) ${a.celIp}? Kérdezi: ${a.kuldoIp}${cimke}`;
    return `ARP-válasz: a(z) ${a.kuldoIp} az enyém${cimke}`;
  }
  if (k.adat && k.adat.protokoll === 'icmp') {
    const fajta = k.adat.icmp.tipus === 'echo-keres' ? 'ping-kérés (echo request)' : 'ping-válasz (echo reply)';
    return `${fajta}: ${k.adat.forrasIp} → ${k.adat.celIp}${cimke}`;
  }
  return `keret${cimke}`;
}
