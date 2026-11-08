/**
 * RouterOS-szerű munkamenet: egy „bejelentkezés” a MikroTik switch parancssorába.
 *
 * Kívülről ugyanúgy használható, mint az IOS-munkamenet (cli/terminal-munkamenet.js): prompt(),
 * bevitel(sor), sugo(sor), kiegeszit(sor), tortenet(), figyel(fn) – így ugyanaz a terminálnézet
 * jeleníti meg. Ami más:
 *
 *   - nincsenek módok (> / # / config): a prompt a mostani menüt mutatja, pl.
 *     [admin@SW1] /interface/bridge>
 *   - Safe Mode (Ctrl+X): amíg be van kapcsolva, a switch megjegyzi a változtatásokat; ha a
 *     kapcsolat megszakad, visszavonja őket (a valódi eszközön a TCP időtúllépése után, kb. 9 perc;
 *     itt rövidebb, hogy ki lehessen várni). Újabb Ctrl+X: a változtatások maradnak.
 *   - Kapcsolat: a konzol (soros kábel) mindig működik; a hálózati kezelés (SSH egy PC-ről) csak
 *     addig él, amíg a PC eléri a switch IP-címét. Ha a tanuló „kizárja magát” (pl. rossz
 *     VLAN-beállítással), a kapcsolat megszakad – és a prompt a PC parancssorára vált, ahonnan
 *     ssh-val újra be lehet lépni (vagy konzolkábellel).
 */

import { MENUFA, menuUtbol } from './menuk.js';
import { vegrehajt, sugo, kiegeszit } from './parancssor.js';
import { konfigMentes, konfigVisszaallit } from '../../modell/mikrotik.js';
import { kezelhetoE } from '../../mag/hid.js';
import { portValtozott } from '../../mag/halozat.js';
import { Ora } from '../../mag/ido.js';

/** Ennyi parancsot jegyez meg (fel/le nyíl). */
export const TORTENET_MERET = 50;
/** A kapcsolat ellenőrzése ilyen sűrűn (ms, szimulált idő). */
export const KAPCSOLAT_FIGYELES = 500;
/** Ennyi ideig tartó elérhetetlenség után szakad meg a kapcsolat (ms). */
export const KAPCSOLAT_TURES = 2000;
/** A Safe Mode ennyi idő múlva vonja vissza a változtatásokat a kapcsolat megszakadása után (ms). */
export const VISSZAVONAS_IDO = 10000;

export class RouterOsMunkamenet {
  /**
   * @param {Object} p
   * @param {Object} p.eszkoz – a MikroTik switch (modell/mikrotik.js)
   * @param {Ora} [p.ora]
   * @param {{mod: 'konzol'}|{mod: 'ssh', honnan: Object, ip: string}} [p.kapcsolat]
   */
  constructor({ eszkoz, ora, kapcsolat }) {
    this.eszkoz = eszkoz;
    this.ora = ora || new Ora();
    this.felirat = 'RouterOS-szerű parancssor';
    /** A terminál ne mutassa a Ctrl+Z gombot (itt nincs konfigurációs mód). */
    this.vanCtrlZ = false;
    /** A RouterOS súgója az F1-en is (a ? mellett). */
    this.f1Sugo = true;
    this.ut = [];
    this.kontextus = {};
    this.mod = 'routeros';
    this.tortenetLista = [];
    this.varakozas = null;
    this.figyelok = [];
    /** Az utolsó végrehajtott parancs teljes alakja (pl. „/interface bridge vlan print”). */
    this.utolsoKanonikus = '';
    this.safeMode = false;
    this.mentes = null;
    this.kapcsolat = kapcsolat && kapcsolat.mod === 'ssh' ? { ...kapcsolat } : { mod: 'konzol' };
    /** 'el' = bejelentkezve; 'megszakadt' = a PC parancssorában vagyunk (ssh / konzol) */
    this.allapot = 'el';
    /** Hányszor lépett be újra a tanuló (ssh vagy konzol) egy megszakadás után. */
    this.ujraBelepesek = 0;
    this.rosszIdo = null;
    this.figyeles = null;
    if (this.kapcsolat.mod === 'ssh') this.figyelesIndit();
  }

  figyel(fn) {
    this.figyelok.push(fn);
  }

  /** @private */
  ertesit() {
    for (const fn of this.figyelok) fn();
  }

  /** A terminál fejléce. */
  fejlec() {
    if (this.allapot === 'megszakadt') return `${this.kapcsolat.honnan.hostname}\u00a0– parancssor (nincs kapcsolat a switch-csel)`;
    if (this.kapcsolat.mod === 'ssh') return `${this.eszkoz.hostname}\u00a0– SSH (${this.kapcsolat.honnan.hostname} → ${this.kapcsolat.ip})`;
    return `${this.eszkoz.hostname}\u00a0– konzol`;
  }

  prompt() {
    if (this.varakozas) return this.varakozas.prompt;
    if (this.allapot === 'megszakadt') return 'C:\\>';
    const menu = this.ut.length ? `/${this.ut.join('/')}` : '';
    const vege = this.safeMode ? '<SAFE>' : '>';
    return `[${this.eszkoz.felhasznalo}@${this.eszkoz.hostname}] ${menu}${vege} `;
  }

  tortenet() {
    return this.tortenetLista;
  }

  /** @private */
  kornyezet() {
    return { sw: this.eszkoz, menu: menuUtbol(this.ut) || MENUFA, ora: this.ora };
  }

  /**
   * Egy beírt sor feldolgozása.
   * @returns {{kimenet: Array, lapozhato: boolean}}
   */
  bevitel(sor) {
    if (this.varakozas) {
      const { folytat } = this.varakozas;
      this.varakozas = null;
      return this.eredmeny(folytat(sor));
    }
    if (this.allapot === 'megszakadt') return { kimenet: this.pcParancs(sor), lapozhato: false };
    this.utolsoKanonikus = '';
    if (sor.trim() === '') return { kimenet: [], lapozhato: false };
    if (this.tortenetLista[this.tortenetLista.length - 1] !== sor) this.tortenetLista.push(sor);
    while (this.tortenetLista.length > TORTENET_MERET) this.tortenetLista.shift();
    return this.eredmeny(vegrehajt(sor, this.kornyezet()));
  }

  /** @private – a parancs eredményének feldolgozása (menüváltás, kérdés, változás) */
  eredmeny(r) {
    if (r.ut) this.ut = r.ut;
    if (r.kerdes) {
      const k = r.kerdes;
      this.varakozas = { prompt: k.prompt, folytat: (v) => k.folytat(v) };
    }
    if (r.kanonikus) this.utolsoKanonikus = r.kanonikus;
    if (r.valtozott && this.eszkoz.halozat) this.eszkoz.halozat.esemeny({ tipus: 'allapot' });
    this.ertesit();
    if (r.valtozott) this.kapcsolatEllenoriz();
    return { kimenet: r.kimenet || [], lapozhato: false };
  }

  sugo(sor) {
    if (this.varakozas) return { kimenet: [], sor };
    if (this.allapot === 'megszakadt') {
      return {
        kimenet: [
          '[Szimulátor] Most a(z) ' + this.kapcsolat.honnan.hostname + ' gép parancssorában vagy. Amit itt írhatsz:',
          '[Szimulátor]   ssh admin@<cím>  – belépés a switchre a hálózaton át (a switch egyik IP-címére)',
          '[Szimulátor]   konzol           – a soros konzolkábel (mindig működik, de oda kell menni a switchhez)',
        ],
        sor,
      };
    }
    return { kimenet: sugo(sor, this.kornyezet()), sor };
  }

  kiegeszit(sor) {
    if (this.varakozas || this.allapot === 'megszakadt') return null;
    return kiegeszit(sor, this.kornyezet());
  }

  // -------------------------------------------------------------------------
  // Safe Mode
  // -------------------------------------------------------------------------

  /**
   * Ctrl+X: Safe Mode be/ki.
   * @returns {{kimenet: string[]}}
   */
  ctrlX() {
    if (this.allapot !== 'el' || this.varakozas) return { kimenet: [] };
    let kimenet;
    if (!this.safeMode) {
      this.safeMode = true;
      this.mentes = konfigMentes(this.eszkoz);
      kimenet = ['[Safe Mode taken]'];
    } else {
      this.safeMode = false;
      this.mentes = null;
      kimenet = ['[Safe Mode released]'];
    }
    this.ertesit();
    return { kimenet };
  }

  /** @private – a Safe Mode óta tett változtatások visszavonása */
  visszavon(mentes) {
    const sw = this.eszkoz;
    const valtozott = konfigVisszaallit(sw, mentes);
    for (const p of valtozott) portValtozott(sw, p);
    if (sw.halozat) sw.halozat.esemeny({ tipus: 'allapot' });
  }

  // -------------------------------------------------------------------------
  // Hálózati kezelés (SSH) – figyelés, megszakadás, újracsatlakozás
  // -------------------------------------------------------------------------

  /** Él-e most az út a kezelő PC és a switch címe között. */
  kapcsolatElo() {
    const h = this.eszkoz.halozat;
    if (this.kapcsolat.mod !== 'ssh' || !h) return true;
    return kezelhetoE(h, this.kapcsolat.honnan, this.eszkoz, this.kapcsolat.ip);
  }

  /** @private */
  figyelesIndit() {
    if (this.figyeles) return;
    const tick = () => {
      this.figyeles = null;
      if (this.allapot !== 'el' || this.kapcsolat.mod !== 'ssh') return;
      this.kapcsolatEllenoriz();
      if (this.allapot === 'el' && this.kapcsolat.mod === 'ssh') this.figyeles = this.ora.utemez(KAPCSOLAT_FIGYELES, tick);
    };
    this.figyeles = this.ora.utemez(KAPCSOLAT_FIGYELES, tick);
  }

  /** @private – ha az út elég ideje nem él, megszakad a kapcsolat */
  kapcsolatEllenoriz() {
    if (this.allapot !== 'el' || this.kapcsolat.mod !== 'ssh') return;
    if (this.kapcsolatElo()) {
      this.rosszIdo = null;
      return;
    }
    if (this.rosszIdo === null) {
      this.rosszIdo = this.ora.ido;
      return;
    }
    if (this.ora.ido - this.rosszIdo >= KAPCSOLAT_TURES) this.megszakad();
  }

  /** @private */
  aszinkron(sor) {
    const h = this.eszkoz.halozat;
    if (h) h.esemeny({ tipus: 'naplo', eszkoz: this.eszkoz, sor });
  }

  /** @private – a kapcsolat megszakadt */
  megszakad() {
    const k = this.kapcsolat;
    this.allapot = 'megszakadt';
    this.varakozas = null;
    this.rosszIdo = null;
    this.aszinkron(`[Szimulátor] Megszakadt a kapcsolat: ${k.honnan.hostname} nem éri el a switch ${k.ip} címét (az SSH-kapcsolat lefagyott, majd bezárult).`);
    if (this.safeMode) {
      const mentes = this.mentes;
      this.safeMode = false;
      this.mentes = null;
      this.aszinkron(`[Szimulátor] A switch Safe Mode-ban volt: hamarosan visszavonja a Safe Mode óta tett változtatásokat (a valódi eszközön a TCP időtúllépése miatt ez kb. 9 perc; itt ${VISSZAVONAS_IDO / 1000} másodperc).`);
      this.ora.utemez(VISSZAVONAS_IDO, () => {
        this.visszavon(mentes);
        this.aszinkron(`[Szimulátor] ${this.eszkoz.hostname} visszavonta a változtatásokat. Lépj be újra: ssh admin@${k.ip}`);
        this.ertesit();
      });
    } else {
      this.aszinkron('[Szimulátor] Safe Mode nélkül a változtatások megmaradtak. Ha a switch egyik címét sem éred el, kizártad magad: '
        + 'csak a soros konzolkábellel tudsz belépni (konzol).');
    }
    this.aszinkron('[Szimulátor] Most a gép parancssorában vagy: ssh admin@<cím> vagy konzol (a ? megmutatja).');
    this.ertesit();
  }

  /** @private – parancs a kezelő PC parancssorában (kapcsolat nélkül) */
  pcParancs(sor) {
    const s = sor.trim();
    if (!s) return [];
    if (/^konzol$/i.test(s)) {
      this.kapcsolat = { mod: 'konzol' };
      this.allapot = 'el';
      this.ujraBelepesek++;
      this.ut = [];
      this.ertesit();
      return [`[Szimulátor] A konzolkábellel csatlakoztál ${this.eszkoz.hostname} soros portjára (ehhez a valóságban oda kell menni a switchhez).`];
    }
    const m = /^ssh\s+(?:(\S+)@)?(\d+\.\d+\.\d+\.\d+)$/i.exec(s);
    if (!m) {
      if (/^ssh\b/i.test(s)) return ['usage: ssh [-l login_name] [user@]hostname'];
      return [`[Szimulátor] Itt csak az ssh és a konzol parancs működik; a gép többi parancsához kattints a rajzon a gépre (${this.kapcsolat.honnan.hostname}).`];
    }
    const ip = m[2];
    const h = this.eszkoz.halozat;
    const ok = h && kezelhetoE(h, this.kapcsolat.honnan, this.eszkoz, ip);
    if (!ok) return [{ varj: 1500 }, `ssh: connect to host ${ip} port 22: Connection timed out`];
    this.kapcsolat = { mod: 'ssh', honnan: this.kapcsolat.honnan, ip };
    this.allapot = 'el';
    this.ujraBelepesek++;
    this.ut = [];
    this.rosszIdo = null;
    this.figyelesIndit();
    this.ertesit();
    return [`[Szimulátor] Bejelentkezve: ${this.eszkoz.hostname} (${ip}), felhasználó: ${m[1] || 'admin'}.`];
  }
}
