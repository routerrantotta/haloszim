/**
 * Eredményalapú ellenőrzés.
 *
 * Nem azt nézzük, milyen parancsokat írt be a tanuló, hanem hogy a hálózat ÁLLAPOTA jó-e,
 * és ténylegesen MŰKÖDIK-e:
 *   - állapot-célok: létezik-e a VLAN a jó névvel, jó VLAN-ban van-e a port, működik-e a trunk,
 *     jó-e a PC IP-címe;
 *   - próbák: valódi ping és szórásos (broadcast) próba a szimulált hálózaton – a csomagok
 *     közben látszanak a topológián;
 *   - ELLENPRÓBÁK: aminek NEM szabad működnie (pl. két különböző VLAN-ban lévő gép
 *     ne érje el egymást). Enélkül egy „minden mindenkivel összeköt” hálózat is átmenne.
 *
 * A célok a feladatfájlban vannak, gyártófüggetlenül (ugyanaz a feladat később más gyártó
 * parancssorával is megoldható).
 */

import { uzemmod } from '../mag/kapcsolas.js';
import { egyPing, szorasProba } from '../mag/vegpont.js';
import { routerPing } from '../mag/router.js';
import { bejegyzes } from '../mag/utvonal.js';
import { ipSzam, ipSzoveg, osztalyos } from '../mag/ip.js';
import { ipv6Szoveg, ipv6Elemez as ipv6ElemezSzoveg } from '../mag/ipv6.js';
import {
  ospfBeall, ospfAllapot, ospfTerulet, passzivE, szomszedSzerep, halozatTipus as ospfHalozatTipus, koltseg as ospfKoltseg,
  idokozok as ospfIdokozok,
} from '../mag/ospf.js';
import {
  eigrpBeall, eigrpAllapot, eigrpPorton, eigrpSzomszedok, eigrpBejegyzes, passzivE as eigrpPasszivE,
} from '../mag/eigrp.js';
import { portKeres } from '../modell/switch.js';
import { MT_CELOK } from './ellenorzo-mikrotik.js';
import { esRag, nevelo } from '../magyar.js';

/** „a 10-es” / „az 5-ös” */
const aVlan = (n) => `${nevelo(n)} ${esRag(n)}`;
const AVlan = (n) => { const t = aVlan(n); return t[0].toUpperCase() + t.slice(1); };

/**
 * @typedef {Object} Eredmeny
 * @property {boolean} ok
 * @property {string} megjegyzes – rövid magyarázat (mi a helyzet most)
 */

const MOD_SZOVEG = { access: 'access', trunk: 'trunk', 'dinamikus-auto': 'dynamic auto', 'dinamikus-kezdemenyezo': 'dynamic desirable' };

function rovid(nev) {
  return nev.replace(/^FastEthernet/, 'Fa').replace(/^GigabitEthernet/, 'Gi').replace(/^Serial/, 'Se').replace(/^Loopback/, 'Lo');
}

function kovSzoveg(k) {
  return Array.isArray(k) ? ipv6Szoveg(k) : ipSzoveg(k);
}

/** A próba nélküli (azonnal eldönthető) célok. */
const ALLAPOT_CELOK = {
  /** A MikroTik-switch kezelő IP-címe egy VLAN-interfészen (lásd ellenorzo-mikrotik.js). */
  'kezelo-ip': (f, c) => MT_CELOK['kezelo-ip'](f, c),
  'hid-port': (f, c) => MT_CELOK['hid-port'](f, c),
  'hid-vlan': (f, c) => MT_CELOK['hid-vlan'](f, c),
  'vlan-szures': (f, c) => MT_CELOK['vlan-szures'](f, c),

  vlan(f, c) {
    const sw = f.eszkoz(c.eszkoz);
    if (sw.gyarto === 'mikrotik') return MT_CELOK.vlan(f, c);
    const v = sw.vlanok[c.vlan];
    if (!v) return { ok: false, megjegyzes: `${AVlan(c.vlan)} VLAN nincs létrehozva (${c.eszkoz}).` };
    if (c.nev && v.nev !== c.nev) return { ok: false, megjegyzes: `A VLAN neve most: ${v.nev} (${c.nev} kellene).` };
    return { ok: true, megjegyzes: `Megvan: ${c.vlan} ${v.nev}` };
  },

  'access-port'(f, c) {
    const sw = f.eszkoz(c.eszkoz);
    if (sw.gyarto === 'mikrotik') return MT_CELOK['access-port'](f, c);
    const p = portKeres(sw, c.port);
    const hibak = [];
    if (p.mod !== 'access') hibak.push(`a port üzemmódja most ${MOD_SZOVEG[p.mod]} (access kellene)`);
    if (p.accessVlan !== c.vlan) hibak.push(`a port most ${aVlan(p.accessVlan)} VLAN-ban van`);
    else if (!sw.vlanok[c.vlan]) hibak.push(`${aVlan(c.vlan)} VLAN nem létezik ezen a switchen`);
    if (p.leallitva) hibak.push('a port le van kapcsolva (shutdown)');
    if (hibak.length) return { ok: false, megjegyzes: hibak.join('; ') + '.' };
    return { ok: true, megjegyzes: `access, VLAN ${c.vlan}` };
  },

  trunk(f, c) {
    const sw = f.eszkoz(c.eszkoz);
    if (sw.gyarto === 'mikrotik') return MT_CELOK.trunk(f, c);
    const p = portKeres(sw, c.port);
    if (!p.fent) return { ok: false, megjegyzes: `Nincs link a(z) ${rovid(p.nev)} porton (le van kapcsolva?).` };
    const tul = sw.halozat.szomszed(sw, p);
    const vegek = [[sw, p], [tul.eszkoz, tul.port]];
    const rossz = vegek.filter(([e, pp]) => uzemmod(e, pp) !== 'trunk');
    if (rossz.length) {
      const leiras = rossz.map(([e, pp]) => `${e.hostname} ${rovid(pp.nev)}: ${MOD_SZOVEG[pp.mod]}`).join(', ');
      return { ok: false, megjegyzes: `Nem lett trunk (${leiras}). Két „dynamic auto” port nem kezdeményez trunkot.` };
    }
    const modok = vegek.map(([e, pp]) => `${e.hostname}: ${MOD_SZOVEG[pp.mod]}`).join(', ');
    return { ok: true, megjegyzes: `Mindkét vég trunkként működik (${modok}).` };
  },

  'vlan-nincs'(f, c) {
    const sw = f.eszkoz(c.eszkoz);
    const v = sw.vlanok[c.vlan];
    if (v) return { ok: false, megjegyzes: `${AVlan(c.vlan)} VLAN (${v.nev}) megvan ezen: ${c.eszkoz}, pedig itt nem szabadna lennie.` };
    return { ok: true, megjegyzes: `${AVlan(c.vlan)} VLAN nincs ezen: ${c.eszkoz} – ahogy kell.` };
  },

  vtp(f, c) {
    const sw = f.eszkoz(c.eszkoz);
    const hibak = [];
    if (c.mod && sw.vtpMod !== c.mod) hibak.push(`a szerep most ${sw.vtpMod} (${c.mod} kellene)`);
    if (c.tartomany !== undefined && sw.vtpTartomany !== c.tartomany) {
      hibak.push(`a tartomány most ${sw.vtpTartomany ? `„${sw.vtpTartomany}”` : 'nincs megadva'} („${c.tartomany}” kellene; kis- és nagybetű számít)`);
    }
    if (c.jelszo !== undefined && sw.vtpJelszo !== c.jelszo) hibak.push(sw.vtpJelszo ? 'a jelszó nem egyezik' : 'nincs jelszó');
    if (c.verzio && sw.vtpVerzio !== c.verzio) hibak.push(`a verzió most ${sw.vtpVerzio} (${c.verzio} kellene)`);
    if (c.revizio !== undefined && sw.vtpRevizio !== c.revizio) hibak.push(`a revízió most ${sw.vtpRevizio} (${c.revizio} kellene)`);
    if (hibak.length) return { ok: false, megjegyzes: hibak.join('; ') + '.' };
    return { ok: true, megjegyzes: `${sw.vtpMod}, tartomány: ${sw.vtpTartomany}, verzió: ${sw.vtpVerzio}, revízió: ${sw.vtpMod === 'transparent' ? 0 : sw.vtpRevizio}` };
  },

  'vtp-szinkron'(f, c) {
    const sw = f.eszkoz(c.eszkoz);
    const forras = f.eszkoz(c.forras);
    const lista = (e) => Object.entries(e.vlanok).filter(([, v]) => !v.gyari).map(([n, v]) => `${n} ${v.nev}`).sort().join(', ');
    const sajat = lista(sw);
    const ott = lista(forras);
    if (sw.vtpRevizio === forras.vtpRevizio && sajat === ott) {
      return { ok: true, megjegyzes: `Azonos revízió (${sw.vtpRevizio}) és azonos VLAN-ok: ${sajat || '–'}.` };
    }
    let megj = `${c.eszkoz}: revízió ${sw.vtpRevizio}, VLAN-ok: ${sajat || '–'}. ${c.forras}: revízió ${forras.vtpRevizio}, VLAN-ok: ${ott || '–'}.`;
    if (sw.vtpRevizio > forras.vtpRevizio) megj += ` ${c.eszkoz} revíziója nagyobb – ő írná felül a többieket!`;
    else if (sw.vtpRevizio === forras.vtpRevizio) megj += ' Egyenlő revíziónál nincs átvétel: módosíts valamit a serveren (pl. hozz létre és törölj egy VLAN-t).';
    else megj += ' A hirdetés nem ért ide: nézd meg a trunkokat, a tartománynevet, a jelszót és a köztes switch verzióját.';
    return { ok: false, megjegyzes: megj };
  },

  /** RIP-beállítás egy routeren: verzió, hálózatok, passzív interfészek, auto-summary, default route hirdetése. */
  rip(f, c) {
    const r = f.eszkoz(c.eszkoz);
    if (!r.rip) return { ok: false, megjegyzes: `${c.eszkoz}-en nem fut RIP.` };
    const hibak = [];
    if (c.verzio && r.rip.verzio !== c.verzio) hibak.push(`a verzió most ${r.rip.verzio || 'nincs megadva (v1-et küld)'} (${c.verzio} kellene)`);
    for (const n of c.halozatok || []) {
      const o = ipSzoveg(osztalyos(ipSzam(n)).halozat);
      if (!r.rip.halozatok.includes(o)) hibak.push(`hiányzik a ${o} hálózat`);
    }
    for (const n of c.nemHalozatok || []) {
      const o = ipSzoveg(osztalyos(ipSzam(n)).halozat);
      if (r.rip.halozatok.includes(o)) hibak.push(`a ${o} hálózat nem kellene a RIP-be`);
    }
    for (const p of c.passziv || []) if (!r.rip.passziv.includes(p)) hibak.push(`${rovid(p)} nem passzív`);
    if (c.autoSummary !== undefined && r.rip.autoSummary !== c.autoSummary) {
      hibak.push(c.autoSummary ? 'az automatikus összegzés ki van kapcsolva' : 'az automatikus összegzés még be van kapcsolva');
    }
    if (c.alapUtvonal !== undefined && r.rip.alapUtvonal !== c.alapUtvonal) {
      hibak.push(c.alapUtvonal ? 'nem hirdeti az alapértelmezett útvonalat' : 'hirdeti az alapértelmezett útvonalat, pedig nem kellene');
    }
    if (hibak.length) return { ok: false, megjegyzes: hibak.join('; ') + '.' };
    const reszek = [`RIPv${r.rip.verzio || 1}`, `hálózatok: ${r.rip.halozatok.join(', ') || '–'}`];
    if (r.rip.passziv.length) reszek.push(`passzív: ${r.rip.passziv.map(rovid).join(', ')}`);
    reszek.push(r.rip.autoSummary ? 'auto-summary be' : 'auto-summary ki');
    return { ok: true, megjegyzes: reszek.join(', ') + '.' };
  },

  /** RIPng egy routeren: IPv6-továbbítás, mely interfészeken fut (és melyiken nem), default route hirdetése. */
  ripng(f, c) {
    const r = f.eszkoz(c.eszkoz);
    if (!r.ipv6Routing) return { ok: false, megjegyzes: `${c.eszkoz}-en nincs bekapcsolva az IPv6-továbbítás (unicast routing).` };
    const hibak = [];
    const port = (n) => r.portok.find((p) => p.nev === n);
    for (const n of c.interfeszek || []) if (!port(n).ripng) hibak.push(`${rovid(n)}: nincs rajta RIPng`);
    for (const n of c.nemInterfeszek || []) if (port(n).ripng) hibak.push(`${rovid(n)}: fut rajta RIPng, pedig nem kellene`);
    for (const [n, mit] of Object.entries(c.alapUtvonal || {})) {
      if (port(n).ripngAlap !== mit) hibak.push(`${rovid(n)}: nem hirdeti a ::/0-t (${mit})`);
    }
    if (hibak.length) return { ok: false, megjegyzes: hibak.join('; ') + '.' };
    const be = r.portok.filter((p) => p.ripng).map((p) => rovid(p.nev));
    return { ok: true, megjegyzes: `RIPng fut itt: ${be.join(', ') || '–'}.` };
  },

  /**
   * OSPF-folyamat egy routeren: { eszkoz, csalad?: 4|6, routerId, interfeszek, nemInterfeszek, terulet,
   * passziv, referencia, alapUtvonal }. A router ID a ténylegesen használt (nem csak a beírt) érték.
   */
  ospf(f, c) {
    const r = f.eszkoz(c.eszkoz);
    const cs = c.csalad || 4;
    const o = ospfBeall(r, cs);
    const nev = cs === 4 ? 'OSPF' : 'OSPFv3';
    if (!o) {
      if (c.nemInterfeszek && !c.interfeszek && !c.routerId) return { ok: true, megjegyzes: `${c.eszkoz}-en nem fut ${nev} – ahogy kell.` };
      return { ok: false, megjegyzes: `${c.eszkoz}-en nem fut ${nev}.` };
    }
    const a = ospfAllapot(r, cs);
    const hibak = [];
    if (c.routerId) {
      if (!a.fut) hibak.push(`a folyamat nem fut (nincs router ID)`);
      else if (a.rid !== c.routerId) {
        hibak.push(o.routerId === c.routerId
          ? `a router ID be van írva (${c.routerId}), de még a régi (${a.rid}) érvényes – újra kell indítani a folyamatot`
          : `a router ID most ${a.rid} (${c.routerId} kellene)`);
      }
    }
    for (const n of c.interfeszek || []) {
      const t = ospfTerulet(r, r.portok.find((p) => p.nev === n), cs);
      if (!t) hibak.push(`${rovid(n)}: nincs az ${nev}-ben`);
      else if (c.terulet !== undefined && t.terulet !== c.terulet) hibak.push(`${rovid(n)}: a ${t.terulet}-s területben van (${c.terulet} kellene)`);
    }
    for (const n of c.nemInterfeszek || []) {
      if (ospfTerulet(r, r.portok.find((p) => p.nev === n), cs)) hibak.push(`${rovid(n)}: fut rajta az ${nev}, pedig nem kellene`);
    }
    for (const n of c.passziv || []) if (!passzivE(r, r.portok.find((p) => p.nev === n), cs)) hibak.push(`${rovid(n)} nem passzív`);
    if (c.referencia !== undefined && o.referencia !== c.referencia) hibak.push(`a referencia-sávszélesség most ${o.referencia} (${c.referencia} kellene)`);
    if (c.alapUtvonal !== undefined && !!o.alapUtvonal !== c.alapUtvonal) {
      hibak.push(c.alapUtvonal ? 'nem hirdeti az alapértelmezett útvonalat' : 'hirdeti az alapértelmezett útvonalat, pedig nem kellene');
    }
    if (hibak.length) return { ok: false, megjegyzes: hibak.join('; ') + '.' };
    const be = r.portok.filter((p) => ospfTerulet(r, p, cs)).map((p) => rovid(p.nev));
    return { ok: true, megjegyzes: `${nev}, router ID ${a.rid || '–'}, interfészek: ${be.join(', ') || '–'}.` };
  },

  /** Egy szomszédság: { eszkoz, szomszed (router ID), port?, allapot: 'FULL', szerep?: 'DR'|'BDR'|'DROTHER'|'-', csalad? } */
  'ospf-szomszed'(f, c) {
    const r = f.eszkoz(c.eszkoz);
    const cs = c.csalad || 4;
    const a = ospfAllapot(r, cs);
    if (!a.fut) return { ok: false, megjegyzes: `${c.eszkoz}-en nem fut ${cs === 4 ? 'OSPF' : 'OSPFv3'}.` };
    let talalt = null;
    for (const I of a.ifek) {
      if (c.port && I.port !== c.port) continue;
      const n = I.szomszedok.find((x) => x.rid === c.szomszed);
      if (n) talalt = { I, n };
    }
    if (!talalt) return { ok: false, megjegyzes: `${c.eszkoz} nem látja szomszédként a(z) ${c.szomszed} routert${c.port ? ` a(z) ${rovid(c.port)} interfészen` : ''}.` };
    const { I, n } = talalt;
    const szerep = szomszedSzerep(I, n);
    const leiras = `${n.allapot}/${szerep}`;
    if (c.allapot && n.allapot !== c.allapot) return { ok: false, megjegyzes: `${c.eszkoz} – ${c.szomszed}: most ${leiras} (${c.allapot} kellene).` };
    if (c.szerep && szerep !== c.szerep) return { ok: false, megjegyzes: `${c.eszkoz} – ${c.szomszed}: most ${leiras} (${c.szerep === '-' ? 'pont-pont link kellene' : `${c.szerep} kellene`}).` };
    return { ok: true, megjegyzes: `${c.eszkoz} – ${c.szomszed} (${rovid(I.port)}): ${leiras}.` };
  },

  /**
   * Egy OSPF-interfész: { eszkoz, port, csalad?, halozatTipus: 'POINT_TO_POINT'|'BROADCAST', allapot: 'DR'|'BDR'|…,
   * koltseg, prioritas, hello, dead, hitelesites: 'md5', kulcs: { 1: 'jelszó' } }
   */
  'ospf-interfesz'(f, c) {
    const r = f.eszkoz(c.eszkoz);
    const cs = c.csalad || 4;
    const p = r.portok.find((x) => x.nev === c.port);
    const pb = cs === 4 ? p.ospf : p.ospf6;
    const a = ospfAllapot(r, cs);
    const I = a.ifek.find((x) => x.port === c.port);
    const hibak = [];
    if (c.halozatTipus && ospfHalozatTipus(p, cs) !== c.halozatTipus) hibak.push(`a hálózattípus most ${ospfHalozatTipus(p, cs)} (${c.halozatTipus} kellene)`);
    if (c.koltseg !== undefined && ospfKoltseg(r, p, cs) !== c.koltseg) hibak.push(`a költség most ${ospfKoltseg(r, p, cs)} (${c.koltseg} kellene)`);
    if (c.prioritas !== undefined && pb.prioritas !== c.prioritas) hibak.push(`a prioritás most ${pb.prioritas} (${c.prioritas} kellene)`);
    const idok = ospfIdokozok(p, cs);
    if (c.hello !== undefined && idok.hello !== c.hello) hibak.push(`a Hello-idő most ${idok.hello} mp (${c.hello} kellene)`);
    if (c.dead !== undefined && idok.dead !== c.dead) hibak.push(`a Dead-idő most ${idok.dead} mp (${c.dead} kellene)`);
    if (c.hitelesites && pb.hitelesites !== c.hitelesites) hibak.push(c.hitelesites === 'md5' ? 'nincs bekapcsolva az MD5-hitelesítés' : `a hitelesítés most: ${pb.hitelesites || 'nincs'}`);
    for (const [k, v] of Object.entries(c.kulcs || {})) {
      if (pb.kulcsok[k] === undefined) hibak.push(`nincs ${k}-es MD5-kulcs`);
      else if (pb.kulcsok[k] !== v) hibak.push(`a(z) ${k}-es kulcs jelszava nem egyezik`);
    }
    if (c.allapot) {
      if (!I) hibak.push('az interfészen nem fut az OSPF (vagy le van kapcsolva)');
      else if (I.allapot !== c.allapot) hibak.push(`az interfész szerepe most ${I.allapot === 'P2P' ? 'pont-pont' : I.allapot} (${c.allapot} kellene)`);
    }
    if (hibak.length) return { ok: false, megjegyzes: `${c.eszkoz} ${rovid(c.port)}: ${hibak.join('; ')}.` };
    const reszek = [ospfHalozatTipus(p, cs), `költség ${ospfKoltseg(r, p, cs)}`];
    if (I && I.tipus === 'BROADCAST') reszek.push(`szerep ${I.allapot}`);
    if (pb.hitelesites === 'md5') reszek.push('MD5');
    return { ok: true, megjegyzes: `${c.eszkoz} ${rovid(c.port)}: ${reszek.join(', ')}.` };
  },

  /**
   * EIGRP-folyamat egy routeren: { eszkoz, csalad?: 4|6, as?, routerId?, interfeszek?, nemInterfeszek?,
   * passziv?, autoSummary?, leallitva? }. A router ID a ténylegesen használt (nem csak a beírt) érték.
   */
  eigrp(f, c) {
    const r = f.eszkoz(c.eszkoz);
    const cs = c.csalad || 4;
    const e = eigrpBeall(r, cs);
    const nev = cs === 4 ? 'EIGRP' : 'EIGRP IPv6';
    if (!e) {
      if (c.nemInterfeszek && !c.interfeszek && !c.routerId) return { ok: true, megjegyzes: `${c.eszkoz}-en nem fut ${nev} – ahogy kell.` };
      return { ok: false, megjegyzes: `${c.eszkoz}-en nem fut ${nev} (nincs „${cs === 4 ? 'router eigrp' : 'ipv6 router eigrp'}”).` };
    }
    const a = eigrpAllapot(r, cs);
    const hibak = [];
    if (c.as !== undefined && e.as !== c.as) hibak.push(`az AS-szám most ${e.as} (${c.as} kellene)`);
    if (c.leallitva !== undefined && !!e.leallitva !== c.leallitva) {
      hibak.push(c.leallitva ? 'a folyamat fut, pedig le kellene állítani' : 'a folyamat le van állítva (shutdown) – kell rá a „no shutdown”');
    }
    if (c.routerId) {
      if (!a.fut) hibak.push('a folyamat nem fut');
      else if (a.rid !== c.routerId) hibak.push(`a router ID most ${a.rid} (${c.routerId} kellene)`);
    }
    for (const n of c.interfeszek || []) {
      const p = r.portok.find((x) => x.nev === n);
      if (!eigrpPorton(r, p, cs)) hibak.push(`${rovid(n)}: nincs az ${nev}-ben`);
    }
    for (const n of c.nemInterfeszek || []) {
      const p = r.portok.find((x) => x.nev === n);
      if (eigrpPorton(r, p, cs)) hibak.push(`${rovid(n)}: fut rajta az ${nev}, pedig nem kellene`);
    }
    for (const n of c.passziv || []) if (!eigrpPasszivE(r, r.portok.find((p) => p.nev === n), cs)) hibak.push(`${rovid(n)} nem passzív`);
    if (c.autoSummary !== undefined && !!e.autoSummary !== c.autoSummary) {
      hibak.push(c.autoSummary ? 'az automatikus összevonás ki van kapcsolva' : 'az automatikus összevonás (auto-summary) még be van kapcsolva');
    }
    if (hibak.length) return { ok: false, megjegyzes: hibak.join('; ') + '.' };
    const be = r.portok.filter((p) => eigrpPorton(r, p, cs)).map((p) => rovid(p.nev));
    return { ok: true, megjegyzes: `${nev} AS ${e.as}, router ID ${a.rid || '–'}, interfészek: ${be.join(', ') || '–'}.` };
  },

  /** Egy EIGRP-szomszédság: { eszkoz, cim (a szomszéd címe), port?, csalad? } */
  'eigrp-szomszed'(f, c) {
    const r = f.eszkoz(c.eszkoz);
    const cs = c.csalad || 4;
    const nev = cs === 4 ? 'EIGRP' : 'EIGRP IPv6';
    if (!eigrpAllapot(r, cs).fut) return { ok: false, megjegyzes: `${c.eszkoz}-en nem fut ${nev}.` };
    const lista = eigrpSzomszedok(r, cs);
    const cim = cs === 4 ? c.cim : ipv6Szoveg(ipv6ElemezSzoveg(c.cim));
    const n = lista.find((x) => x.cim === cim && (!c.port || x.port === c.port));
    if (!n) {
      const vannak = lista.map((x) => `${x.cim} (${rovid(x.port)})`).join(', ') || 'senki';
      return { ok: false, megjegyzes: `${c.eszkoz} nem látja szomszédként ${cim}-t. Most ezeket látja: ${vannak}.` };
    }
    return { ok: true, megjegyzes: `${c.eszkoz} – ${n.cim} (${rovid(n.port)}): szomszédság él.` };
  },

  /**
   * Topológiabejegyzés: { eszkoz, halozat: '172.16.1.0/24', csalad?, fd?, successor? (a következő
   * ugrás címe), fs?: true|false (van-e feasible successor), allapot?: 'P'|'A' }
   */
  'eigrp-topologia'(f, c) {
    const r = f.eszkoz(c.eszkoz);
    const cs = c.csalad || 4;
    if (!eigrpAllapot(r, cs).fut) return { ok: false, megjegyzes: `${c.eszkoz}-en nem fut EIGRP.` };
    const t = eigrpBejegyzes(r, cs, c.halozat);
    if (!t) return { ok: false, megjegyzes: `${c.eszkoz} topológiatáblájában nincs ${c.halozat}.` };
    const succ = t.forrasok.filter((x) => x.successor);
    const fsek = t.forrasok.filter((x) => x.fs);
    const hibak = [];
    if (c.allapot && t.allapot !== c.allapot) hibak.push(`az állapota most ${t.allapot === 'A' ? 'Active' : 'Passive'}`);
    if (c.fd !== undefined && t.fd !== c.fd) hibak.push(`az FD most ${t.fd} (${c.fd} kellene)`);
    if (c.successor && !succ.some((x) => x.cim === c.successor)) {
      hibak.push(`a successor most ${succ.map((x) => x.cim).join(', ') || 'nincs'} (${c.successor} kellene)`);
    }
    if (c.fs !== undefined && (fsek.length > 0) !== c.fs) {
      hibak.push(c.fs
        ? 'nincs feasible successora, pedig kellene lennie (AD < FD)'
        : `van feasible successora (${fsek.map((x) => x.cim).join(', ')}), pedig nem szabadna lennie`);
    }
    if (hibak.length) return { ok: false, megjegyzes: `${c.eszkoz} – ${c.halozat}: ${hibak.join('; ')}.` };
    return {
      ok: true,
      megjegyzes: `${c.eszkoz} – ${c.halozat}: FD ${t.fd}, successor ${succ.map((x) => x.cim).join(', ') || '–'}, `
        + `feasible successor: ${fsek.length ? fsek.map((x) => `${x.cim} (AD ${x.ad})`).join(', ') : 'nincs'}.`,
    };
  },

  /** IPv6-továbbítás be van-e kapcsolva. */
  'ipv6-routing'(f, c) {
    const r = f.eszkoz(c.eszkoz);
    return r.ipv6Routing
      ? { ok: true, megjegyzes: 'Az IPv6-továbbítás be van kapcsolva.' }
      : { ok: false, megjegyzes: `${c.eszkoz} nem továbbít IPv6-csomagokat (gyárilag ki van kapcsolva).` };
  },

  /**
   * Útvonal a routing táblában: { eszkoz, halozat: '172.16.3.0/24', kod?: 'R', port?: 'Serial0/1/0', nincs?: true }.
   * „nincs: true” – ellenpróba: ez az útvonal NE legyen a táblában.
   */
  utvonal(f, c) {
    const r = f.eszkoz(c.eszkoz);
    const e = bejegyzes(r, c.halozat);
    const jo = e && !e.lehetLe;
    if (c.nincs) {
      if (jo) return { ok: false, megjegyzes: `${c.eszkoz} táblájában ott van: ${e.kod} ${c.halozat} – pedig nem kellene.` };
      return { ok: true, megjegyzes: `${c.eszkoz} táblájában nincs ${c.halozat} – ahogy kell.` };
    }
    if (!jo) return { ok: false, megjegyzes: `${c.eszkoz} táblájában nincs ${c.halozat}${e && e.lehetLe ? ' (csak „possibly down” állapotban)' : ''}.` };
    if (c.kod && e.kod !== c.kod) return { ok: false, megjegyzes: `${c.halozat} megvan, de ${e.kod} kódú (${c.kod} kellene).` };
    const utak = e.utak.map((u) => u.port || (u.kovetkezo !== null && u.kovetkezo !== undefined ? kovSzoveg(u.kovetkezo) : '')).filter(Boolean);
    if (c.port && !e.utak.some((u) => u.port === c.port)) {
      return { ok: false, megjegyzes: `${c.halozat} most erre megy: ${utak.map(rovid).join(', ')} (${rovid(c.port)} felé kellene).` };
    }
    return { ok: true, megjegyzes: `${e.kod} ${c.halozat} [${e.ad}/${e.metrika}]${utak.length ? ' – ' + utak.map(rovid).join(', ') : ''}` };
  },

  'pc-ip'(f, c) {
    const pc = f.eszkoz(c.eszkoz);
    if (!pc.ip) return { ok: false, megjegyzes: `${c.eszkoz}-nek még nincs IP-címe (kattints a gépre).` };
    const hibak = [];
    if (pc.ip !== c.ip) hibak.push(`IP-cím most: ${pc.ip} (${c.ip} kellene)`);
    if (pc.maszk !== c.maszk) hibak.push(`maszk most: ${pc.maszk || 'nincs'} (${c.maszk} kellene)`);
    if (hibak.length) return { ok: false, megjegyzes: hibak.join('; ') + '.' };
    return { ok: true, megjegyzes: `${pc.ip} / ${pc.maszk}` };
  },
};

/** A cél PC tervezett IP-címe (a feladat címtervéből). */
function tervezettIp(f, nev) {
  const sor = (f.feladat.cimterv || []).find((s) => s.eszkoz === nev);
  return sor ? sor.ip : f.eszkoz(nev).ip;
}

const PING_SZOVEG = {
  valasz: 'Megjött a válasz.',
  idotullepes: 'Nem jött válasz (Request timed out).',
  elerhetetlen: 'Nem jött ARP-válasz: a cél nem érhető el ebben a szórási tartományban (Destination host unreachable).',
  hiba: 'A ping el sem indult: nincs IP-cím, vagy a cél másik hálózatban van, és nincs alapértelmezett átjáró.',
  'halozat-elerhetetlen': 'Egy router visszaszólt: nincs útvonala a célhálózat felé (Destination net unreachable).',
  'ttl-lejart': 'Lejárt a TTL útközben (hurok?).',
  'ido-lejart': 'Lejárt a TTL útközben (hurok?).',
};

/** Egy ping az eszköz fajtájától függően (PC vagy router). */
function egyProbaPing(f, honnan, ip, cb) {
  const e = f.eszkoz(honnan);
  if (e.tipus === 'router') {
    routerPing(f.halozat, e, ip, (v) => cb(v.fajta === 'elerhetetlen' ? { ...v, fajta: 'halozat-elerhetetlen' } : v));
  } else {
    egyPing(f.halozat, e, ip, cb);
  }
}

/** A próbát igénylő célok: (f, c, kesz(eredmeny)) */
const PROBA_CELOK = {
  /**
   * ping { honnan, cel (a címterv szerinti gép) vagy ip, vart: true|false, db: hány pingnek kell sikerülnie }
   * Ha routerek is vannak, előtte „bemelegítő” pingek mennek (nem számítanak): az első csomagok
   * gyakran elvesznek, amíg a routerek ARP-pal megkeresik a következő ugrást.
   */
  ping(f, c, kesz) {
    const ip = c.ip || tervezettIp(f, c.cel);
    const db = c.db || 1;
    const vart = c.vart !== false;
    const eredmenyek = [];
    // Bemelegítés: legfeljebb 3 ping, amíg az első válasz meg nem jön (útközben minden router ARP-ozhat).
    // Csak az időtúllépés lehet ARP miatti; más hibánál (pl. nincs útvonal) nincs értelme tovább próbálni.
    let bemelegites = f.halozat.eszkozok.some((x) => x.tipus === 'router') ? 3 : 0;
    let elment = bemelegites === 0;
    const kovetkezo = () => {
      egyProbaPing(f, c.honnan, ip, (e) => {
        if (bemelegites > 0) {
          if (e.fajta === 'valasz') elment = true;
          bemelegites = e.fajta === 'idotullepes' ? bemelegites - 1 : 0;
          return f.halozat.ora.utemez(1, kovetkezo);
        }
        eredmenyek.push(e);
        // Ha a bemelegítés alatt egyszer sem ment át, egy (sikertelen) próba is elég az ítélethez.
        const kell = elment || e.fajta === 'valasz' ? db : 1;
        if (eredmenyek.length < kell) return f.halozat.ora.utemez(1, kovetkezo);
        const sikeres = eredmenyek.filter((x) => x.fajta === 'valasz').length;
        const ok = vart ? sikeres === db && eredmenyek.length === db : sikeres === 0;
        const rossz = eredmenyek.find((x) => (x.fajta === 'valasz') !== vart) || eredmenyek[0];
        let megjegyzes = `${c.honnan} → ${ip}: `;
        if (eredmenyek.length > 1) megjegyzes += `${eredmenyek.length} pingből ${sikeres} sikerült. `;
        megjegyzes += PING_SZOVEG[rossz.fajta] || rossz.fajta;
        if (rossz.kitol && rossz.fajta !== 'valasz') megjegyzes += ` (${rossz.kitol})`;
        if (!vart && sikeres) megjegyzes += ' Pedig ennek nem szabadna sikerülnie!';
        if (vart && eredmenyek.length > 1 && sikeres > 0 && sikeres < eredmenyek.length) megjegyzes += ' Hol megy, hol nem – nézd meg, nincs-e két út ugyanoda.';
        kesz({ ok, megjegyzes });
      });
    };
    kovetkezo();
  },

  szoras(f, c, kesz) {
    szorasProba(f.halozat, f.eszkoz(c.honnan), (kik) => {
      const nevek = c.elerje.concat(c.neErje);
      const elerte = nevek.filter((n) => kik.includes(f.eszkoz(n)));
      const hianyzik = (c.elerje || []).filter((n) => !elerte.includes(n));
      const tilos = (c.neErje || []).filter((n) => elerte.includes(n));
      const reszek = [`Eljutott ide: ${elerte.length ? elerte.join(', ') : 'senkihez'}.`];
      if (hianyzik.length) reszek.push(`Nem jutott el ide, pedig kellene: ${hianyzik.join(', ')}.`);
      if (tilos.length) reszek.push(`Ide nem szabadna eljutnia (más VLAN): ${tilos.join(', ')}.`);
      kesz({ ok: hianyzik.length === 0 && tilos.length === 0, megjegyzes: reszek.join(' ') });
    });
  },
};

/**
 * Egy állapot-cél azonnali kiértékelése (a bemutató is ezt használja a lépések teljesülésének
 * eldöntésére). Ismeretlen típusnál null.
 * @returns {Eredmeny|null}
 */
export function allapotCel(f, c) {
  const fn = ALLAPOT_CELOK[c.tipus];
  return fn ? fn(f, c) : null;
}

/** Próbát igényel-e a cél (ezek animálva, egymás után futnak). */
export function probaE(cel) {
  return !!PROBA_CELOK[cel.tipus];
}

/**
 * Az összes cél ellenőrzése. Az állapot-célok azonnal, a próbák egymás után, a szimulált
 * órán futnak (a böngészőben valós időben, animálva; a tesztekben az óra léptetésével).
 * @param {import('./betolto.js').BetoltottFeladat} f
 * @param {{indul?: (i: number) => void, lepes?: (i: number, e: Eredmeny) => void,
 *          kesz?: (eredmenyek: Eredmeny[]) => void, szunet?: number}} [figyelok]
 * @returns {Eredmeny[]} – a (később kitöltődő) eredménylista
 */
export function ellenoriz(f, { indul = () => {}, lepes = () => {}, kesz = () => {}, szunet = 0 } = {}) {
  const celok = f.feladat.celok;
  const eredmenyek = new Array(celok.length).fill(null);
  const probak = [];
  celok.forEach((c, i) => {
    if (ALLAPOT_CELOK[c.tipus]) {
      eredmenyek[i] = ALLAPOT_CELOK[c.tipus](f, c);
      lepes(i, eredmenyek[i]);
    } else if (PROBA_CELOK[c.tipus]) {
      probak.push(i);
    } else {
      throw new Error(`Ismeretlen céltípus: ${c.tipus}`);
    }
  });

  const kovetkezo = (k) => {
    if (k >= probak.length) return kesz(eredmenyek);
    const i = probak[k];
    indul(i);
    PROBA_CELOK[celok[i].tipus](f, celok[i], (e) => {
      eredmenyek[i] = e;
      lepes(i, e);
      // Egy kis szünet a próbák között, hogy a csomagok ne keveredjenek a rajzon.
      f.halozat.ora.utemez(szunet, () => kovetkezo(k + 1));
    });
  };
  kovetkezo(0);
  return eredmenyek;
}
