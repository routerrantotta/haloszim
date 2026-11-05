/**
 * PC-ablak: a gép IP-beállításai (IP-cím, maszk, alapértelmezett átjáró; IPv6-os feladatban
 * az IPv6-cím és -átjáró is) és a parancssora (ping, tracert, ipconfig, arp -a …).
 * A beállítás a „Mentés” gombra vagy Enterre lép életbe.
 */

import { Terminal } from './terminal.js';
import { PcMunkamenet } from '../cli/pc-munkamenet.js';
import { gepcimHiba, ervenyesIp, egyHalozat, ipSzoveg } from '../mag/ip.js';
import { ipBeallit } from '../mag/vegpont.js';
import { ipv6Elemez, ipv6Normal, linkLocalE, csoportcimE } from '../mag/ipv6.js';

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
   * @param {{eszkoz: Object, halozat: Object, valtozott?: () => void, parancsUtan?: (sor: string) => void,
   *          ipv6?: boolean, atjaroKell?: boolean}} p
   *   ipv6: legyenek-e IPv6-mezők; atjaroKell: a feladatban kell-e átjáró (a mező mintaszövegéhez)
   */
  constructor(szulo, { eszkoz, halozat, valtozott = () => {}, parancsUtan, ipv6 = false, atjaroKell = false }) {
    this.pc = eszkoz;
    this.valtozott = valtozott;
    this.doboz = elem('section', 'hsz-pc-ablak');
    this.doboz.setAttribute('aria-label', `${eszkoz.hostname} – IP-beállítások és parancssor`);

    const urlap = elem('form', 'hsz-pc-urlap');
    this.urlap = urlap;
    urlap.noValidate = true;
    const cim = elem('h3', 'hsz-pc-urlap__cim', 'IP-beállítások');
    urlap.append(cim);
    this.mezok = {
      ip: this.mezo(urlap, 'IP-cím', 'pl. 192.168.10.11'),
      maszk: this.mezo(urlap, 'Alhálózati maszk', 'pl. 255.255.255.0'),
      atjaro: this.mezo(urlap, 'Alapértelmezett átjáró', atjaroKell ? 'a router címe' : 'most nem kell'),
    };
    if (ipv6) {
      this.mezok.ipv6 = this.mezo(urlap, 'IPv6-cím / előtag', 'pl. 2001:DB8:1::10/64');
      this.mezok.ipv6Atjaro = this.mezo(urlap, 'IPv6-átjáró', 'pl. FE80::1');
      this.mezok.ipv6.inputMode = 'text';
      this.mezok.ipv6Atjaro.inputMode = 'text';
    }
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
    this.terminal = new Terminal(this.terminalHely, this.munkamenet, { parancsUtan });
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
    if (this.mezok.ipv6) {
      this.mezok.ipv6.value = this.pc.ipv6 ? `${this.pc.ipv6}/${this.pc.ipv6Hossz || 64}` : '';
      this.mezok.ipv6Atjaro.value = this.pc.ipv6Atjaro || '';
    }
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

    // IPv6 (ha van ilyen mező): „cím/hossz” vagy csak cím (ekkor /64).
    const v6 = {};
    if (this.mezok.ipv6) {
      const szoveg = this.mezok.ipv6.value.trim();
      const gw = this.mezok.ipv6Atjaro.value.trim();
      if (szoveg === '') {
        v6.ipv6 = '';
      } else {
        const [cim, hossz = '64'] = szoveg.split('/');
        const c = ipv6Elemez(cim);
        const h = Number(hossz);
        if (!c || !/^\d{1,3}$/.test(hossz) || h < 1 || h > 128) return this.jelez('Érvénytelen IPv6-cím (pl. 2001:DB8:1::10/64).', true, this.mezok.ipv6);
        if (linkLocalE(c) || csoportcimE(c)) return this.jelez('Ide globális IPv6-cím kell (a link-local címet a gép magától kapja).', true, this.mezok.ipv6);
        v6.ipv6 = ipv6Normal(cim);
        v6.ipv6Hossz = h;
      }
      if (gw !== '' && !ipv6Elemez(gw)) return this.jelez('Érvénytelen IPv6-átjáró (pl. FE80::1).', true, this.mezok.ipv6Atjaro);
      v6.ipv6Atjaro = gw === '' ? '' : ipv6Normal(gw);
    }

    if (ip === '' && maszk === '' && atjaro === '') {
      ipBeallit(this.pc, { ip: '', maszk: '', atjaro: '', ...v6 });
      this.jelez(v6.ipv6 ? 'Mentve (IPv4-cím nélkül).' : 'A beállítás törölve.');
      return this.valtozott();
    }
    if (!ervenyesIp(ip)) return this.jelez('Érvénytelen IP-cím (négy 0–255 közötti szám, ponttal elválasztva).', true, this.mezok.ip);
    if (maszk === '') return this.jelez('Add meg az alhálózati maszkot is.', true, this.mezok.maszk);
    const hiba = gepcimHiba(ip, maszk);
    if (hiba) return this.jelez(hiba, true, /maszk/.test(hiba) ? this.mezok.maszk : this.mezok.ip);
    if (atjaro !== '' && !ervenyesIp(atjaro)) return this.jelez('Érvénytelen átjárócím.', true, this.mezok.atjaro);

    ipBeallit(this.pc, { ip, maszk, atjaro, ...v6 });
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
