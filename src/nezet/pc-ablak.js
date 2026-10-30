/**
 * PC-ablak: a gép IP-beállításai (IP-cím, maszk, alapértelmezett átjáró) és a parancssora
 * (ping, ipconfig, arp -a …). A beállítás a „Mentés” gombra vagy Enterre lép életbe.
 */

import { Terminal } from './terminal.js';
import { PcMunkamenet } from '../cli/pc-munkamenet.js';
import { gepcimHiba, ervenyesIp, egyHalozat, ipSzoveg } from '../mag/ip.js';
import { ipBeallit } from '../mag/vegpont.js';

function elem(tag, osztaly, szoveg) {
  const e = document.createElement(tag);
  if (osztaly) e.className = osztaly;
  if (szoveg !== undefined) e.textContent = szoveg;
  return e;
}

/** „/24” vagy „24” → „255.255.255.0” (kényelmi rövidítés), egyébként változatlan. */
function maszkAlak(szoveg) {
  const m = /^\/?(\d{1,2})$/.exec(szoveg.trim());
  if (!m || Number(m[1]) < 1 || Number(m[1]) > 32) return szoveg.trim();
  const n = Number(m[1]);
  return ipSzoveg(n === 32 ? 0xffffffff : (~((1 << (32 - n)) - 1)) >>> 0);
}

export class PcAblak {
  /**
   * @param {HTMLElement} szulo
   * @param {{eszkoz: Object, halozat: Object, valtozott?: () => void}} p
   */
  constructor(szulo, { eszkoz, halozat, valtozott = () => {} }) {
    this.pc = eszkoz;
    this.valtozott = valtozott;
    this.doboz = elem('section', 'hsz-pc-ablak');
    this.doboz.setAttribute('aria-label', `${eszkoz.hostname} – IP-beállítások és parancssor`);

    const urlap = elem('form', 'hsz-pc-urlap');
    urlap.noValidate = true;
    const cim = elem('h3', 'hsz-pc-urlap__cim', 'IP-beállítások');
    urlap.append(cim);
    this.mezok = {
      ip: this.mezo(urlap, 'IP-cím', 'pl. 192.168.10.11'),
      maszk: this.mezo(urlap, 'Alhálózati maszk', 'pl. 255.255.255.0'),
      atjaro: this.mezo(urlap, 'Alapértelmezett átjáró', 'most nem kell'),
    };
    const sor = elem('div', 'hsz-pc-urlap__gombsor');
    const mentes = elem('button', 'hsz-gomb', 'Mentés');
    mentes.type = 'submit';
    this.uzenet = elem('span', 'hsz-pc-urlap__uzenet');
    this.uzenet.setAttribute('role', 'status');
    sor.append(mentes, this.uzenet);
    urlap.append(sor);
    urlap.addEventListener('submit', (e) => {
      e.preventDefault();
      this.ment();
    });

    this.terminalHely = elem('div', 'hsz-pc-ablak__terminal');
    this.doboz.append(urlap, this.terminalHely);
    szulo.append(this.doboz);

    this.munkamenet = new PcMunkamenet({ eszkoz, halozat });
    this.terminal = new Terminal(this.terminalHely, this.munkamenet);
    this.terminal.cim(`${eszkoz.hostname} – parancssor`);
    this.betolt();
  }

  /** @private */
  mezo(urlap, felirat, pelda) {
    const l = elem('label', 'hsz-pc-urlap__mezo');
    const t = elem('span', '', felirat);
    const i = elem('input');
    Object.assign(i, { type: 'text', inputMode: 'decimal', autocomplete: 'off', spellcheck: false, placeholder: pelda });
    l.append(t, i);
    urlap.append(l);
    return i;
  }

  /** Az aktuális beállítás a mezőkbe. */
  betolt() {
    this.mezok.ip.value = this.pc.ip;
    this.mezok.maszk.value = this.pc.maszk;
    this.mezok.atjaro.value = this.pc.atjaro;
  }

  /** @private */
  jelez(szoveg, hiba, mezo) {
    this.uzenet.textContent = szoveg;
    this.uzenet.classList.toggle('hsz-pc-urlap__uzenet--hiba', !!hiba);
    for (const m of Object.values(this.mezok)) m.removeAttribute('aria-invalid');
    if (mezo) {
      mezo.setAttribute('aria-invalid', 'true');
      mezo.focus();
    }
  }

  /** @private – ellenőrzés és mentés */
  ment() {
    const ip = this.mezok.ip.value.trim();
    const maszk = maszkAlak(this.mezok.maszk.value);
    const atjaro = this.mezok.atjaro.value.trim();
    this.mezok.maszk.value = maszk;

    if (ip === '' && maszk === '' && atjaro === '') {
      ipBeallit(this.pc, { ip: '', maszk: '', atjaro: '' });
      this.jelez('A beállítás törölve.');
      return this.valtozott();
    }
    if (!ervenyesIp(ip)) return this.jelez('Érvénytelen IP-cím (négy 0–255 közötti szám, ponttal elválasztva).', true, this.mezok.ip);
    if (maszk === '') return this.jelez('Add meg az alhálózati maszkot is.', true, this.mezok.maszk);
    const hiba = gepcimHiba(ip, maszk);
    if (hiba) return this.jelez(hiba, true, /maszk/.test(hiba) ? this.mezok.maszk : this.mezok.ip);
    if (atjaro !== '' && !ervenyesIp(atjaro)) return this.jelez('Érvénytelen átjárócím.', true, this.mezok.atjaro);

    ipBeallit(this.pc, { ip, maszk, atjaro });
    if (atjaro !== '' && !egyHalozat(ip, atjaro, maszk)) {
      this.jelez('Mentve – de figyelem: az átjáró nincs a gép hálózatában, így nem használható.');
    } else {
      this.jelez('Mentve.');
    }
    this.valtozott();
  }

  /** Megjelenítés / elrejtés. */
  mutat(lathato) {
    this.doboz.hidden = !lathato;
    if (lathato) this.betolt();
  }
}
