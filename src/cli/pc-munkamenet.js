/**
 * A PC egyszerű parancssora (asztali gépek parancssorához hasonló forma):
 *   ping [-n db] <IPv4- vagy IPv6-cím>, tracert <cím>, ipconfig [/all], arp -a, arp -d, hostname, cls, help
 *
 * Ugyanazt a felületet adja, mint a switch munkamenete (prompt, bevitel, tortenet …), így
 * ugyanaz a terminál-komponens jeleníti meg. A ping kimenete fokozatosan jön (ahogy a
 * válaszok megérkeznek): ezt egy { folyamat } elem jelzi a kimenetben.
 */

import { egyPing, vanIp, vanIpv6, kovetkezoUgras, pcLinkLocal } from '../mag/vegpont.js';
import { ervenyesIp } from '../mag/ip.js';
import { ipv6Normal } from '../mag/ipv6.js';
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
    else if (parancs === 'tracert') kimenet.push(...this.tracert(arg));
    else if (parancs === 'ipconfig') kimenet.push(...this.ipconfig(arg));
    else if (parancs === 'arp') kimenet.push(...this.arp(arg));
    else if (parancs === 'hostname') kimenet.push(this.eszkoz.hostname, '');
    else if (parancs === 'cls') kimenet.push({ torles: true });
    else if (parancs === 'help' || parancs === '?' || parancs === '/?') kimenet.push(...sugoSzoveg());
    else {
      kimenet.push(`'${szavak[0]}' is not recognized as an internal or external command,`,
        'operable program or batch file.', '',
        '[Szimulátor] A gépen használható parancsok: ping, tracert, ipconfig, arp -a, hostname, cls, help', '');
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
    if (!ervenyesIp(cel) && !ipv6Normal(cel)) {
      return [`Ping request could not find host ${cel}. Please check the name and try again.`, ''];
    }
    const v6 = !ervenyesIp(cel);
    if (v6) cel = ipv6Normal(cel).toLowerCase();
    return ['', `Pinging ${cel} with 32 bytes of data:`, { folyamat: (kiir, kesz) => this.pingFolyamat(cel, db, kiir, kesz) }];
  }

  /** @private – a ping válaszai egyenként, ahogy megérkeznek */
  pingFolyamat(cel, db, kiir, kesz) {
    const h = this.halozat;
    const pc = this.eszkoz;
    const v6 = cel.includes(':');
    let elkuldve = 0;
    let fogadva = 0;
    const idok = [];
    const fajtak = [];
    const ido = (ms) => (ms ? `=${ms}ms` : '<1ms');
    const egy = () => {
      if (elkuldve >= db) return vege();
      elkuldve++;
      egyPing(h, pc, cel, (e) => {
        fajtak.push(e);
        let szunet = 1000;
        if (e.fajta === 'valasz') {
          kiir(v6 ? `Reply from ${cel}: time${ido(e.keses)}` : `Reply from ${cel}: bytes=32 time${ido(e.keses)} TTL=${e.ttl}`);
          fogadva++;
          idok.push(e.keses || 0);
        } else if (e.fajta === 'idotullepes') {
          kiir('Request timed out.');
          szunet = 0;
        } else if (e.fajta === 'elerhetetlen') {
          // Ezt a választ a saját gép adja, ezért a statisztika „kapott” csomagnak számolja.
          kiir(`Reply from ${v6 ? (pc.ipv6 || pcLinkLocal(pc)).toLowerCase() : pc.ip}: Destination host unreachable.`);
          fogadva++;
          szunet = 0;
        } else if (e.fajta === 'halozat-elerhetetlen') {
          kiir(`Reply from ${v6 ? e.kitol.toLowerCase() : e.kitol}: Destination net unreachable.`);
          fogadva++;
        } else if (e.fajta === 'ttl-lejart') {
          kiir(`Reply from ${v6 ? e.kitol.toLowerCase() : e.kitol}: TTL expired in transit.`);
          fogadva++;
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
      if (idok.length > 0) {
        const atl = Math.round(idok.reduce((a, b) => a + b, 0) / idok.length);
        kiir('Approximate round trip times in milli-seconds:');
        kiir(`    Minimum = ${Math.min(...idok)}ms, Maximum = ${Math.max(...idok)}ms, Average = ${atl}ms`);
      }
      kiir('');
      for (const m of this.magyarazat(cel, fajtak)) kiir(m);
      kesz();
    };
    egy();
  }

  /** @private – rövid magyarázat a sikertelen pinghez (a szimulátor saját megjegyzése) */
  magyarazat(cel, eredmenyek) {
    const pc = this.eszkoz;
    const fajtak = new Set(eredmenyek.map((e) => e.fajta));
    const v6 = cel.includes(':');
    const m = [];
    if (fajtak.has('hiba')) {
      if (v6 && !vanIpv6(pc)) m.push('[Szimulátor] Ennek a gépnek még nincs IPv6-címe (kattints a beállításokra fent).');
      else if (!v6 && !vanIp(pc)) m.push('[Szimulátor] Ennek a gépnek még nincs IP-címe vagy maszkja (kattints a beállításokra fent).');
      else if (!pc.portok[0].fent) m.push('[Szimulátor] Nincs link: a gép kábele egy lekapcsolt portra csatlakozik.');
      else if (!kovetkezoUgras(pc, v6 ? ipv6Normal(cel) : cel)) {
        m.push('[Szimulátor] A cél másik hálózatban van, és nincs alapértelmezett átjáró, ezért a csomag el sem indul.');
      }
    }
    if (fajtak.has('elerhetetlen')) {
      m.push(v6
        ? '[Szimulátor] A „Destination host unreachable” a saját gépedtől jön: senki nem válaszolt a szomszédkérdésre (ND).'
        : '[Szimulátor] A „Destination host unreachable” a saját gépedtől jön: senki nem válaszolt az ARP-kérdésre,'
          + ' hogy kié ez a cím. A gép ezt is „Received”-nek számolja.');
    }
    const nincsUt = eredmenyek.find((e) => e.fajta === 'halozat-elerhetetlen');
    if (nincsUt) {
      m.push(`[Szimulátor] A „Destination net unreachable” a(z) ${nincsUt.kitol} routertől jött: nincs útvonala a célhálózat felé`
        + ' (nézd meg a routing tábláját: show ip route).');
    }
    const elso = eredmenyek.findIndex((e) => e.fajta !== 'idotullepes');
    const elsoElveszett = elso > 0 && eredmenyek.slice(elso).every((e) => e.fajta === 'valasz');
    if (elsoElveszett) {
      m.push(`[Szimulátor] ${elso === 1 ? 'Az első csomag elveszett' : 'Az első csomagok elvesztek'}, a többi átment: útközben egy router még nem ismerte a következő ugrás`
        + ` MAC-címét. Ilyenkor ${v6 ? 'szomszédkérdést (ND)' : 'ARP-kérdést'} küld, az éppen továbbítandó csomagot pedig eldobja.`);
    }
    if (m.length) m.push('');
    return m;
  }

  /** @private – tracert: ugrásonként 3 próba egyre nagyobb TTL-lel */
  tracert(arg) {
    const cel0 = arg.find((a) => !a.startsWith('-') && !a.startsWith('/'));
    if (!cel0) return ['', 'Usage: tracert target_name', '', '[Szimulátor] Példa: tracert 172.16.3.10', ''];
    if (!ervenyesIp(cel0) && !ipv6Normal(cel0)) return [`Unable to resolve target system name ${cel0}.`, ''];
    const v6 = !ervenyesIp(cel0);
    const cel = v6 ? ipv6Normal(cel0).toLowerCase() : cel0;
    return ['', `Tracing route to ${cel} over a maximum of 30 hops`, '', {
      folyamat: (kiir, kesz) => this.tracertFolyamat(cel, kiir, kesz),
    }];
  }

  /** @private */
  tracertFolyamat(cel, kiir, kesz) {
    const h = this.halozat;
    const pc = this.eszkoz;
    const v6 = cel.includes(':');
    let ttl = 1;
    let ures = 0;
    const oszlop = (e) => {
      if (e.fajta === 'idotullepes' || e.fajta === 'hiba' || e.fajta === 'elerhetetlen') return '    *    ';
      return (e.keses ? `${e.keses} ms` : '<1 ms').padStart(9);
    };
    const ugras = () => {
      const valaszok = [];
      const egy = () => {
        egyPing(h, pc, cel, (e) => {
          valaszok.push(e);
          if (valaszok.length < 3 && e.fajta !== 'hiba') return h.ora.utemez(1, egy);
          return sorKesz();
        }, { ttl });
      };
      const sorKesz = () => {
        const sor = String(ttl).padStart(3);
        if (valaszok[0].fajta === 'hiba') {
          kiir('Unable to contact IP driver. General failure.');
          kiir('');
          return kesz();
        }
        const ki = valaszok.find((e) => e.kitol);
        const halozat = valaszok.find((e) => e.fajta === 'halozat-elerhetetlen');
        if (halozat) {
          kiir(`${sor}  ${v6 ? halozat.kitol.toLowerCase() : halozat.kitol}  reports: Destination net unreachable.`);
          kiir('');
          kiir('Trace complete.');
          kiir('');
          return kesz();
        }
        const cimek = valaszok.map(oszlop).join('');
        if (!ki) {
          kiir(`${sor}${cimek}  Request timed out.`);
          ures++;
        } else {
          kiir(`${sor}${cimek}  ${v6 ? ki.kitol.toLowerCase() : ki.kitol}`);
          ures = 0;
        }
        if (valaszok.some((e) => e.fajta === 'valasz') || ttl >= 30) {
          kiir('');
          kiir('Trace complete.');
          kiir('');
          return kesz();
        }
        if (ures >= 5) {
          kiir('');
          kiir('[Szimulátor] Több ugrás óta nem jön válasz – a valódi gép 30 ugrásig próbálkozna (megszakítás: Ctrl+C).');
          kiir('');
          return kesz();
        }
        ttl++;
        ugras();
      };
      egy();
    };
    ugras();
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
    const v6 = vanIpv6(pc) || !!pc.ipv6Atjaro;
    if (v6 && pc.ipv6) s.push(`   IPv6 Address. . . . . . . . . . . : ${pc.ipv6.toLowerCase()}`);
    if (v6) s.push(`   Link-local IPv6 Address . . . . . : ${pcLinkLocal(pc).toLowerCase()}`);
    s.push(`   IPv4 Address. . . . . . . . . . . : ${pc.ip || '0.0.0.0'}`);
    s.push(`   Subnet Mask . . . . . . . . . . . : ${pc.maszk || '0.0.0.0'}`);
    if (v6 && pc.ipv6Atjaro) {
      s.push(`   Default Gateway . . . . . . . . . : ${pc.ipv6Atjaro.toLowerCase()}`);
      if (pc.atjaro) s.push(`                                       ${pc.atjaro}`);
    } else {
      s.push(`   Default Gateway . . . . . . . . . : ${pc.atjaro}`.trimEnd());
    }
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
    '[Szimulátor]   ping <IP-cím>      – elér-e egy másik gépet (ping -n 2 … = csak 2 csomag; IPv6-címmel is)',
    '[Szimulátor]   tracert <IP-cím>   – merre, mely routereken át jut el a csomag a célig',
    '[Szimulátor]   ipconfig           – a gép IP-beállításai (ipconfig /all: MAC-címmel együtt)',
    '[Szimulátor]   arp -a             – az ARP-gyorstár: melyik IP-címhez melyik MAC tartozik',
    '[Szimulátor]   arp -d             – az ARP-gyorstár törlése',
    '[Szimulátor]   hostname           – a gép neve',
    '[Szimulátor]   cls                – a képernyő törlése',
    '',
  ];
}
