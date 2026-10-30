/**
 * A PC egyszerű parancssora (asztali gépek parancssorához hasonló forma):
 *   ping [-n db] <IP-cím>, ipconfig [/all], arp -a, arp -d, hostname, cls, help
 *
 * Ugyanazt a felületet adja, mint a switch munkamenete (prompt, bevitel, tortenet …), így
 * ugyanaz a terminál-komponens jeleníti meg. A ping kimenete fokozatosan jön (ahogy a
 * válaszok megérkeznek): ezt egy { folyamat } elem jelzi a kimenetben.
 */

import { egyPing, vanIp, kovetkezoUgras } from '../mag/vegpont.js';
import { ervenyesIp } from '../mag/ip.js';
import { macKotojeles } from '../mag/ethernet.js';
import { TORTENET_MERET } from './terminal-munkamenet.js';

const PROMPT = 'C:\\>';

export class PcMunkamenet {
  /**
   * @param {{eszkoz: Object, halozat: import('../mag/halozat.js').Halozat}} p
   */
  constructor({ eszkoz, halozat }) {
    this.eszkoz = eszkoz;
    this.halozat = halozat;
    this.lista = [];
    this.figyelok = [];
    /** A terminál ne fogja el a ? billentyűt (itt nincs ?-súgó). */
    this.sugoBillentyu = false;
    /** Nincs Ctrl+Z és Tab-kiegészítés. */
    this.vanCtrlZ = false;
    this.vanTab = false;
  }

  figyel(fn) {
    this.figyelok.push(fn);
  }

  prompt() {
    return PROMPT;
  }

  tortenet() {
    return this.lista;
  }

  sugo(sor) {
    return { kimenet: [], sor };
  }

  kiegeszit() {
    return null;
  }

  ctrlZ() {
    return { kimenet: [] };
  }

  /**
   * @param {string} sor
   * @returns {{kimenet: Array<string|{varj:number}|{folyamat: Function}|{torles: true}>, lapozhato: boolean}}
   */
  bevitel(sor) {
    const kimenet = [];
    const s = sor.trim();
    if (s === '') return { kimenet, lapozhato: false };
    if (this.lista[this.lista.length - 1] !== s) this.lista.push(s);
    while (this.lista.length > TORTENET_MERET * 2) this.lista.shift();

    const szavak = s.split(/\s+/);
    const parancs = szavak[0].toLowerCase();
    const arg = szavak.slice(1);
    if (parancs === 'ping') kimenet.push(...this.ping(arg));
    else if (parancs === 'ipconfig') kimenet.push(...this.ipconfig(arg));
    else if (parancs === 'arp') kimenet.push(...this.arp(arg));
    else if (parancs === 'hostname') kimenet.push(this.eszkoz.hostname, '');
    else if (parancs === 'cls') kimenet.push({ torles: true });
    else if (parancs === 'help' || parancs === '?' || parancs === '/?') kimenet.push(...sugoSzoveg());
    else {
      kimenet.push(`'${szavak[0]}' is not recognized as an internal or external command,`,
        'operable program or batch file.', '',
        '[Szimulátor] A gépen használható parancsok: ping, ipconfig, arp -a, hostname, cls, help', '');
    }
    for (const fn of this.figyelok) fn();
    return { kimenet, lapozhato: false };
  }

  /** @private */
  ping(arg) {
    let db = 4;
    let cel = null;
    for (let i = 0; i < arg.length; i++) {
      const a = arg[i].toLowerCase();
      if (a === '-n' || a === '/n') {
        const n = Number(arg[++i]);
        if (!Number.isInteger(n) || n < 1 || n > 100) {
          return ['Bad value for option -n, valid range is from 1 to 100.', ''];
        }
        db = n;
      } else if (a.startsWith('-') || a.startsWith('/')) {
        return [`Bad option ${arg[i]}.`, '', ...pingHasznalat()];
      } else {
        cel = arg[i];
      }
    }
    if (cel === null) return pingHasznalat();
    if (!ervenyesIp(cel)) {
      return [`Ping request could not find host ${cel}. Please check the name and try again.`, ''];
    }
    return ['', `Pinging ${cel} with 32 bytes of data:`, { folyamat: (kiir, kesz) => this.pingFolyamat(cel, db, kiir, kesz) }];
  }

  /** @private – a ping válaszai egyenként, ahogy megérkeznek */
  pingFolyamat(cel, db, kiir, kesz) {
    const h = this.halozat;
    const pc = this.eszkoz;
    let elkuldve = 0;
    let fogadva = 0;
    let valaszok = 0;
    const fajtak = new Set();
    const egy = () => {
      if (elkuldve >= db) return vege();
      elkuldve++;
      egyPing(h, pc, cel, (e) => {
        fajtak.add(e.fajta);
        let szunet = 1000;
        if (e.fajta === 'valasz') {
          kiir(`Reply from ${cel}: bytes=32 time<1ms TTL=${e.ttl}`);
          fogadva++;
          valaszok++;
        } else if (e.fajta === 'idotullepes') {
          kiir('Request timed out.');
          szunet = 0;
        } else if (e.fajta === 'elerhetetlen') {
          // Ezt a választ a saját gép adja, ezért a statisztika „kapott” csomagnak számolja.
          kiir(`Reply from ${pc.ip}: Destination host unreachable.`);
          fogadva++;
          szunet = 0;
        } else {
          kiir('PING: transmit failed. General failure. ');
          szunet = 500;
        }
        if (elkuldve >= db) return vege();
        h.ora.utemez(szunet, egy);
      });
    };
    const vege = () => {
      const elveszett = elkuldve - fogadva;
      kiir('');
      kiir(`Ping statistics for ${cel}:`);
      kiir(`    Packets: Sent = ${elkuldve}, Received = ${fogadva}, Lost = ${elveszett} (${Math.round((elveszett / elkuldve) * 100)}% loss),`);
      if (valaszok > 0) {
        kiir('Approximate round trip times in milli-seconds:');
        kiir('    Minimum = 0ms, Maximum = 0ms, Average = 0ms');
      }
      kiir('');
      for (const m of this.magyarazat(cel, fajtak)) kiir(m);
      kesz();
    };
    egy();
  }

  /** @private – rövid magyarázat a sikertelen pinghez (a szimulátor saját megjegyzése) */
  magyarazat(cel, fajtak) {
    const pc = this.eszkoz;
    const m = [];
    if (fajtak.has('hiba')) {
      if (!vanIp(pc)) m.push('[Szimulátor] Ennek a gépnek még nincs IP-címe vagy maszkja (kattints a beállításokra fent).');
      else if (!pc.portok[0].fent) m.push('[Szimulátor] Nincs link: a gép kábele egy lekapcsolt portra csatlakozik.');
      else if (!kovetkezoUgras(pc, cel)) {
        m.push('[Szimulátor] A cél másik hálózatban van, és nincs alapértelmezett átjáró, ezért a csomag el sem indul.');
      }
    }
    if (fajtak.has('elerhetetlen')) {
      m.push('[Szimulátor] A „Destination host unreachable” a saját gépedtől jön: senki nem válaszolt az ARP-kérdésre,'
        + ' hogy kié ez a cím. A gép ezt is „Received”-nek számolja.');
    }
    if (m.length) m.push('');
    return m;
  }

  /** @private */
  ipconfig(arg) {
    const pc = this.eszkoz;
    const minden = arg.some((a) => a.toLowerCase() === '/all');
    if (arg.length && !minden) return ['', `Error: unrecognized or incomplete command line.`, '', '[Szimulátor] Használat: ipconfig vagy ipconfig /all', ''];
    const s = [''];
    if (minden) s.push(`   Host Name . . . . . . . . . . . . : ${pc.hostname}`, '');
    s.push('Ethernet adapter FastEthernet0:', '');
    if (!pc.portok[0].fent) {
      s.push('   Media State . . . . . . . . . . . : Media disconnected');
    }
    s.push('   Connection-specific DNS Suffix  . :');
    if (minden) s.push(`   Physical Address. . . . . . . . . : ${macKotojeles(pc.mac)}`);
    s.push(`   IPv4 Address. . . . . . . . . . . : ${pc.ip || '0.0.0.0'}`);
    s.push(`   Subnet Mask . . . . . . . . . . . : ${pc.maszk || '0.0.0.0'}`);
    s.push(`   Default Gateway . . . . . . . . . : ${pc.atjaro}`.trimEnd());
    s.push('');
    return s;
  }

  /** @private */
  arp(arg) {
    const pc = this.eszkoz;
    const kapcsolo = (arg[0] || '').toLowerCase();
    if (kapcsolo === '-a' || kapcsolo === '-g') {
      const sorok = Object.entries(pc.arpTabla);
      if (sorok.length === 0) return ['No ARP Entries Found.', ''];
      const s = ['', `Interface: ${pc.ip || '0.0.0.0'} --- 0x2`, '  Internet Address      Physical Address      Type'];
      for (const [ip, b] of sorok) s.push(`  ${ip.padEnd(22)}${macKotojeles(b.mac).toLowerCase().padEnd(22)}dynamic`);
      s.push('');
      return s;
    }
    if (kapcsolo === '-d') {
      pc.arpTabla = {};
      return [''];
    }
    return ['', '[Szimulátor] Használat: arp -a (az ARP-gyorstár kiírása), arp -d (törlése)', ''];
  }
}

function pingHasznalat() {
  return ['', 'Usage: ping [-n count] target_name', '',
    '[Szimulátor] Példa: ping 192.168.10.13 (a -n után megadható, hány csomagot küldjön; alapból 4)', ''];
}

function sugoSzoveg() {
  return [
    '',
    '[Szimulátor] A gépen használható parancsok:',
    '[Szimulátor]   ping <IP-cím>      – elér-e egy másik gépet (ping -n 2 … = csak 2 csomag)',
    '[Szimulátor]   ipconfig           – a gép IP-beállításai (ipconfig /all: MAC-címmel együtt)',
    '[Szimulátor]   arp -a             – az ARP-gyorstár: melyik IP-címhez melyik MAC tartozik',
    '[Szimulátor]   arp -d             – az ARP-gyorstár törlése',
    '[Szimulátor]   hostname           – a gép neve',
    '[Szimulátor]   cls                – a képernyő törlése',
    '',
  ];
}
