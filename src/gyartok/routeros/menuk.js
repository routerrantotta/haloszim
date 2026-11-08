/**
 * A RouterOS-szerű parancssor menüi – ADATKÉNT leírva (mint az IOS-parancsok a gyartok/ios alatt).
 *
 * A RouterOS parancssora menükből áll (/interface bridge port …), a menükben „elemek” vannak
 * (pl. bridge-portok), és minden menüben ugyanazok a parancsok működnek:
 *   add (új elem), set (módosítás), remove (törlés), print (listázás), enable/disable, export.
 * Ezért itt menünként csak azt írjuk le, milyen TULAJDONSÁGAI vannak az elemeknek
 * (pl. pvid, frame-types), és hogyan kerülnek be a modellbe (modell/mikrotik.js) – a parancsok
 * értelmezése közös (parancssor.js).
 *
 * Tulajdonság: { nev, tipus, sugo, mezo | olvas/ir, alap?, kotelezo?, min/max, ertekek, fajtak }
 *   tipus: nev | szoveg | bool | szam | enum | hid | interfesz | interfeszLista | vlanLista | cim
 *
 * A súgószövegek saját megfogalmazások (magyarul), nem a gyártói dokumentáció szövegei.
 */

import {
  KERETTIPUSOK, ujHid, ujHidPort, hidKeres, interfeszKeres, interfeszek, sorVlanjai, macSzoveg,
} from '../../modell/mikrotik.js';
import { tagsag, ismertVlanok, dinamikusTagok, hidMacTabla, hidPortja, l3Kapcsolat } from '../../mag/hid.js';
import { ipSzam, ipSzoveg, halozatSzam } from '../../mag/ip.js';
import { portValtozott } from '../../mag/halozat.js';

// ---------------------------------------------------------------------------
// Közös tulajdonságok
// ---------------------------------------------------------------------------

const KOMMENT = { nev: 'comment', tipus: 'szoveg', mezo: 'komment', alap: '', sugo: 'Megjegyzés az elemhez (a listában ;;; után látszik)' };
const LETILTVA = { nev: 'disabled', tipus: 'bool', mezo: 'letiltva', alap: false, sugo: 'Le van-e tiltva az elem (yes = nem működik)' };

const KERETTIPUS_SUGO = {
  'admit-all': 'címkés és címke nélküli keretet is fogad',
  'admit-only-untagged-and-priority-tagged': 'csak címke nélküli keretet fogad (access port)',
  'admit-only-vlan-tagged': 'csak VLAN-címkés keretet fogad (trunk port)',
};

/** Egy interfész „fut-e” (running): van link, nincs letiltva; bridge: van működő portja; VLAN: a szülője fut. */
export function fut(sw, nev) {
  const i = interfeszKeres(sw, nev);
  if (!i) return false;
  if (i.fajta === 'ether') return i.elem.fent && !i.elem.leallitva;
  if (i.fajta === 'bridge') return !i.elem.letiltva;
  return !i.elem.letiltva && fut(sw, i.elem.interfesz);
}

/** Az interfész típusa a listában. */
function ifTipus(i) {
  return i.fajta === 'ether' ? 'ether' : i.fajta;
}

// ---------------------------------------------------------------------------
// Menük
// ---------------------------------------------------------------------------

/** /interface – minden interfész (csak listázni, tiltani, megjegyzést írni lehet) */
const interfaceLista = {
  lista: true,
  nevMezo: 'name',
  szekcio: null,
  elemek: (sw) => interfeszek(sw).map((i) => ({ ...i, _sajat: i.elem })),
  tulajdonsagok: [
    { nev: 'name', tipus: 'nev', olvas: (e) => e.nev, csakOlvas: true, sugo: 'Az interfész neve' },
    { nev: 'default-name', tipus: 'nev', olvas: (e) => (e.fajta === 'ether' ? e.nev : ''), csakOlvas: true, sugo: 'A gyári név (csak a fizikai portoknál)' },
    { nev: 'type', tipus: 'nev', olvas: (e) => ifTipus(e), csakOlvas: true, sugo: 'Az interfész fajtája' },
    {
      nev: 'comment', tipus: 'szoveg', alap: '', sugo: KOMMENT.sugo,
      olvas: (e) => (e.fajta === 'ether' ? e.elem.komment : e.elem.komment || ''),
      ir: (e, v) => { e.elem.komment = v; },
    },
    {
      nev: 'disabled', tipus: 'bool', alap: false, sugo: LETILTVA.sugo,
      olvas: (e) => (e.fajta === 'ether' ? e.elem.leallitva : e.elem.letiltva),
      ir: (e, v, sw) => {
        if (e.fajta === 'ether') {
          if (e.elem.leallitva !== v) {
            e.elem.leallitva = v;
            portValtozott(sw, e.elem);
          }
        } else e.elem.letiltva = v;
      },
    },
  ],
  zaszlok: [
    { betu: 'X', nev: 'DISABLED', fn: (e) => (e.fajta === 'ether' ? e.elem.leallitva : e.elem.letiltva) },
    { betu: 'R', nev: 'RUNNING', fn: (e, sw) => fut(sw, e.nev) },
    { betu: 'S', nev: 'SLAVE', fn: (e, sw) => e.fajta === 'ether' && !!hidPortja(sw, e.nev) },
  ],
  oszlopok: [
    { cim: 'NAME', ertek: (e) => e.nev },
    { cim: 'TYPE', ertek: (e) => ifTipus(e) },
    { cim: 'ACTUAL-MTU', ertek: () => '1500', jobbra: true },
    { cim: 'L2MTU', ertek: (e) => (e.fajta === 'vlan' ? '1588' : '1592'), jobbra: true },
    { cim: 'MAX-L2MTU', ertek: (e) => (e.fajta === 'ether' ? '10218' : ''), jobbra: true },
    { cim: 'MAC-ADDRESS', ertek: (e, sw) => macSzoveg(e.fajta === 'ether' ? e.elem.mac : e.fajta === 'bridge' ? e.elem.mac : (hidKeres(sw, e.elem.interfesz) || { mac: sw.mac }).mac) },
  ],
  nincsAdd: true,
};

/** /interface bridge */
const bridgeLista = {
  lista: true,
  nevMezo: 'name',
  szekcio: '/interface bridge',
  elemek: (sw) => sw.hidak,
  tulajdonsagok: [
    { nev: 'name', tipus: 'nev', mezo: 'nev', sugo: 'A bridge neve', alapNev: 'bridge' },
    { nev: 'vlan-filtering', tipus: 'bool', mezo: 'vlanSzures', alap: false, sugo: 'VLAN-szűrés: csak bekapcsolva számít a PVID és a VLAN-tábla' },
    { nev: 'pvid', tipus: 'szam', min: 1, max: 4094, mezo: 'pvid', alap: 1, sugo: 'A bridge saját (a switch processzora felé néző) VLAN-ja' },
    { nev: 'frame-types', tipus: 'enum', ertekek: KERETTIPUSOK, ertekSugo: KERETTIPUS_SUGO, mezo: 'kerettipus', alap: 'admit-all', sugo: 'Milyen kereteket fogad a bridge a processzortól' },
    { nev: 'ingress-filtering', tipus: 'bool', mezo: 'bemenetiSzures', alap: true, sugo: 'Bemeneti szűrés: eldobja a keretet, ha a bridge nem tagja a VLAN-jának' },
    KOMMENT,
    LETILTVA,
  ],
  zaszlok: [
    { betu: 'X', nev: 'DISABLED', fn: (e) => e.letiltva },
    { betu: 'R', nev: 'RUNNING', fn: (e) => !e.letiltva },
  ],
  reszletesKiiras: true,
  hozzaad(sw, ertekek) {
    let nev = ertekek.name;
    if (!nev) for (let i = 1; !nev || interfeszKeres(sw, nev); i++) nev = `bridge${i}`;
    if (interfeszKeres(sw, nev)) return 'failure: already have interface with such name';
    const h = ujHid(nev, sw.portok[0].mac);
    sw.hidak.push(h);
    return { elem: h };
  },
  modosit(sw, e, ertekek) {
    if (ertekek.name !== undefined && ertekek.name !== e.nev && interfeszKeres(sw, ertekek.name)) return 'failure: already have interface with such name';
    return null;
  },
  torol(sw, e) {
    sw.hidak = sw.hidak.filter((x) => x !== e);
  },
  /** A részletes (detail) kiírás tulajdonságai – a valódi eszköz sorrendjét követve, rövidítve. */
  reszletek(sw, e) {
    const r = [
      ['name', `"${e.nev}"`], ['mtu', 'auto'], ['actual-mtu', '1500'], ['l2mtu', '1592'], ['arp', 'enabled'], ['arp-timeout', 'auto'],
      ['mac-address', macSzoveg(e.mac)], ['protocol-mode', 'rstp'], ['fast-forward', 'yes'], ['igmp-snooping', 'no'],
    ];
    if (e.adminMac) r.push(['auto-mac', 'no'], ['admin-mac', macSzoveg(e.adminMac)]);
    else r.push(['auto-mac', 'yes']);
    r.push(['ageing-time', '5m'], ['priority', '0x8000'], ['max-message-age', '20s'], ['forward-delay', '15s'], ['transmit-hold-count', '6'],
      ['vlan-filtering', e.vlanSzures ? 'yes' : 'no']);
    if (e.vlanSzures) r.push(['ether-type', '0x8100'], ['pvid', String(e.pvid)], ['frame-types', e.kerettipus], ['ingress-filtering', e.bemenetiSzures ? 'yes' : 'no']);
    r.push(['dhcp-snooping', 'no']);
    return r;
  },
  exportExtra: (e) => (e.adminMac ? [['admin-mac', macSzoveg(e.adminMac)], ['auto-mac', 'no']] : []),
};

/** /interface bridge port */
const bridgePortLista = {
  lista: true,
  nevMezo: 'interface',
  szekcio: '/interface bridge port',
  elemek: (sw) => sw.hidPortok,
  tulajdonsagok: [
    { nev: 'interface', tipus: 'interfesz', fajtak: ['ether', 'vlan'], mezo: 'interfesz', kotelezo: true, sugo: 'Melyik interfész legyen a bridge portja' },
    { nev: 'bridge', tipus: 'hid', mezo: 'hid', kotelezo: true, sugo: 'Melyik bridge-hez tartozzon' },
    { nev: 'pvid', tipus: 'szam', min: 1, max: 4094, mezo: 'pvid', alap: 1, sugo: 'A port VLAN-ja: a címke nélkül érkező keretek ebbe a VLAN-ba kerülnek' },
    { nev: 'frame-types', tipus: 'enum', ertekek: KERETTIPUSOK, ertekSugo: KERETTIPUS_SUGO, mezo: 'kerettipus', alap: 'admit-all', sugo: 'Milyen kereteket fogad a port (címkés, címke nélküli, mindkettő)' },
    { nev: 'ingress-filtering', tipus: 'bool', mezo: 'bemenetiSzures', alap: true, sugo: 'Bemeneti szűrés: eldobja a keretet, ha a port nem tagja a VLAN-jának' },
    KOMMENT,
    LETILTVA,
  ],
  zaszlok: [
    { betu: 'X', nev: 'DISABLED', fn: (e) => e.letiltva, csakHaVan: true },
    { betu: 'I', nev: 'INACTIVE', fn: (e, sw) => e.letiltva || !hidKeres(sw, e.hid) || !fut(sw, e.interfesz) },
    { betu: 'H', nev: 'HW-OFFLOAD', fn: (e, sw) => !e.letiltva && !!hidKeres(sw, e.hid) && fut(sw, e.interfesz) && interfeszKeres(sw, e.interfesz).fajta === 'ether' },
  ],
  oszlopok: [
    { cim: 'INTERFACE', ertek: (e) => e.interfesz },
    { cim: 'BRIDGE', ertek: (e) => e.hid },
    { cim: 'HW', ertek: (e, sw) => (interfeszKeres(sw, e.interfesz) && interfeszKeres(sw, e.interfesz).fajta === 'ether' ? 'yes' : '') },
    { cim: 'PVID', ertek: (e) => String(e.pvid), jobbra: true },
    { cim: 'PRIORITY', ertek: () => '0x80' },
    { cim: 'PATH-COST', ertek: () => '10', jobbra: true },
    { cim: 'INTERNAL-PATH-COST', ertek: () => '10', jobbra: true },
    { cim: 'HORIZON', ertek: () => 'none' },
  ],
  hozzaad(sw, ertekek) {
    if (sw.hidPortok.some((hp) => hp.interfesz === ertekek.interface)) return 'failure: device already added as bridge port';
    const hp = ujHidPort(ertekek.interface, ertekek.bridge);
    sw.hidPortok.push(hp);
    return { elem: hp };
  },
  modosit(sw, e, ertekek) {
    if (ertekek.interface !== undefined && ertekek.interface !== e.interfesz && sw.hidPortok.some((hp) => hp.interfesz === ertekek.interface)) {
      return 'failure: device already added as bridge port';
    }
    return null;
  },
  torol(sw, e) {
    sw.hidPortok = sw.hidPortok.filter((x) => x !== e);
  },
  utana: (sw) => { sw.macTabla = []; },
  reszletek(sw, e) {
    return [
      ['interface', e.interfesz], ['bridge', e.hid], ['priority', '0x80'], ['path-cost', '10'], ['internal-path-cost', '10'],
      ['edge', 'auto'], ['point-to-point', 'auto'], ['learn', 'auto'], ['horizon', 'none'], ['hw', 'yes'],
      ['pvid', String(e.pvid)], ['frame-types', e.kerettipus], ['ingress-filtering', e.bemenetiSzures ? 'yes' : 'no'],
      ['unknown-unicast-flood', 'yes'], ['unknown-multicast-flood', 'yes'], ['broadcast-flood', 'yes'], ['tag-stacking', 'no'],
    ];
  },
};

/** A VLAN-tábla sorai, a dinamikusakkal (PVID szerint) együtt. */
function vlanSorok(sw) {
  const ki = [...sw.hidVlanok];
  for (const hid of sw.hidak) {
    for (const v of ismertVlanok(sw, hid)) {
      const vanStatikus = sw.hidVlanok.some((s) => !s.letiltva && s.hid === hid.nev && sorVlanjai(s).includes(v));
      if (vanStatikus) continue;
      const dyn = dinamikusTagok(sw, hid, v);
      if (!dyn.length) continue;
      ki.push({ hid: hid.nev, vlanok: String(v), cimkezett: [], cimkezetlen: dyn, komment: '', letiltva: false, _dinamikus: true });
    }
  }
  return ki;
}

/** Egy VLAN-tábla-sor aktuális (működő) tagjai. */
function aktualisTagok(sw, s) {
  const hid = hidKeres(sw, s.hid);
  if (!hid || s.letiltva) return { cimkezett: [], cimkezetlen: [] };
  const c = [];
  const u = [];
  for (const v of sorVlanjai(s)) {
    const t = tagsag(sw, hid, v, { csakAktiv: true });
    for (const n of t.cimkezett) if (!c.includes(n) && (s.cimkezett.includes(n) || s._dinamikus)) c.push(n);
    for (const n of t.cimkezetlen) if (!u.includes(n) && !c.includes(n)) u.push(n);
  }
  return { cimkezett: c, cimkezetlen: u };
}

/** /interface bridge vlan */
const bridgeVlanLista = {
  lista: true,
  nevMezo: null,
  szekcio: '/interface bridge vlan',
  elemek: (sw) => vlanSorok(sw),
  tulajdonsagok: [
    { nev: 'bridge', tipus: 'hid', mezo: 'hid', kotelezo: true, sugo: 'Melyik bridge VLAN-táblájába kerüljön a sor' },
    { nev: 'vlan-ids', tipus: 'vlanLista', mezo: 'vlanok', kotelezo: true, sugo: 'A VLAN-azonosító(k): pl. 10, vagy 10,20, vagy 30-35' },
    { nev: 'tagged', tipus: 'interfeszLista', fajtak: ['ether', 'bridge', 'vlan'], mezo: 'cimkezett', alap: [], sugo: 'Címkézett tagok: ezeken a portokon 802.1Q-címkével megy a VLAN (trunk)' },
    { nev: 'untagged', tipus: 'interfeszLista', fajtak: ['ether', 'bridge', 'vlan'], mezo: 'cimkezetlen', alap: [], sugo: 'Címkézetlen tagok: ezeken címke nélkül megy ki a VLAN forgalma (access)' },
    KOMMENT,
    LETILTVA,
  ],
  zaszlok: [
    { betu: 'X', nev: 'DISABLED', fn: (e) => e.letiltva, csakHaVan: true },
    { betu: 'D', nev: 'DYNAMIC', fn: (e) => !!e._dinamikus },
  ],
  oszlopok: [
    { cim: 'BRIDGE', ertek: (e) => e.hid },
    { cim: 'VLAN-IDS', ertek: (e) => e.vlanok, jobbra: true },
    { cim: 'CURRENT-TAGGED', ertek: (e, sw) => aktualisTagok(sw, e).cimkezett },
    { cim: 'CURRENT-UNTAGGED', ertek: (e, sw) => aktualisTagok(sw, e).cimkezetlen },
  ],
  hozzaad(sw, ertekek) {
    const s = { hid: ertekek.bridge, vlanok: ertekek['vlan-ids'], cimkezett: [], cimkezetlen: [], komment: '', letiltva: false };
    sw.hidVlanok.push(s);
    return { elem: s };
  },
  torol(sw, e) {
    sw.hidVlanok = sw.hidVlanok.filter((x) => x !== e);
  },
  utana: (sw) => { sw.macTabla = []; },
  reszletek(sw, e) {
    const a = aktualisTagok(sw, e);
    return [
      ['bridge', e.hid], ['vlan-ids', e.vlanok], ['tagged', e.cimkezett.join(',')], ['untagged', e.cimkezetlen.join(',')],
      ['current-tagged', a.cimkezett.join(',')], ['current-untagged', a.cimkezetlen.join(',')],
    ];
  },
};

/** /interface bridge host – a MAC-tábla (csak listázni lehet) */
const bridgeHostLista = {
  lista: true,
  csakOlvas: true,
  nevMezo: null,
  szekcio: null,
  elemek: (sw) => {
    const sajat = sw.hidak.filter((h) => !h.letiltva).map((h) => ({ mac: h.mac, vlan: 0, port: h.nev, hid: h.nev, _helyi: true }));
    return [...sajat, ...hidMacTabla(sw)];
  },
  tulajdonsagok: [],
  zaszlok: [
    { betu: 'D', nev: 'DYNAMIC', fn: (e) => !e._helyi },
    { betu: 'L', nev: 'LOCAL', fn: (e) => !!e._helyi },
  ],
  oszlopok: [
    { cim: 'MAC-ADDRESS', ertek: (e) => macSzoveg(e.mac) },
    { cim: 'VID', ertek: (e) => (e.vlan ? String(e.vlan) : ''), jobbra: true },
    { cim: 'ON-INTERFACE', ertek: (e) => e.port },
    { cim: 'BRIDGE', ertek: (e) => e.hid },
  ],
};

/** /interface vlan */
const vlanLista = {
  lista: true,
  nevMezo: 'name',
  szekcio: '/interface vlan',
  elemek: (sw) => sw.vlanIfek,
  tulajdonsagok: [
    { nev: 'name', tipus: 'nev', mezo: 'nev', sugo: 'A VLAN-interfész neve' },
    { nev: 'vlan-id', tipus: 'szam', min: 1, max: 4094, mezo: 'vlanId', kotelezo: true, sugo: 'A VLAN azonosítója (ezt a címkét kapják a keretei)' },
    { nev: 'interface', tipus: 'interfesz', fajtak: ['ether', 'bridge', 'vlan'], mezo: 'interfesz', kotelezo: true, sugo: 'Melyik interfészen (pl. a bridge-en) legyen ez a VLAN' },
    KOMMENT,
    LETILTVA,
  ],
  zaszlok: [
    { betu: 'X', nev: 'DISABLED', fn: (e) => e.letiltva, csakHaVan: true },
    { betu: 'R', nev: 'RUNNING', fn: (e, sw) => fut(sw, e.nev) },
  ],
  oszlopok: [
    { cim: 'NAME', ertek: (e) => e.nev },
    { cim: 'MTU', ertek: () => '1500', jobbra: true },
    { cim: 'ARP', ertek: () => 'enabled' },
    { cim: 'VLAN-ID', ertek: (e) => String(e.vlanId), jobbra: true },
    { cim: 'INTERFACE', ertek: (e) => e.interfesz },
  ],
  hozzaad(sw, ertekek) {
    let nev = ertekek.name;
    if (!nev) for (let i = 1; !nev || interfeszKeres(sw, nev); i++) nev = `vlan${i}`;
    if (interfeszKeres(sw, nev)) return 'failure: already have interface with such name';
    const v = { nev, vlanId: ertekek['vlan-id'], interfesz: ertekek.interface, komment: '', letiltva: false };
    sw.vlanIfek.push(v);
    return { elem: v };
  },
  modosit(sw, e, ertekek) {
    if (ertekek.name !== undefined && ertekek.name !== e.nev && interfeszKeres(sw, ertekek.name)) return 'failure: already have interface with such name';
    return null;
  },
  torol(sw, e) {
    sw.vlanIfek = sw.vlanIfek.filter((x) => x !== e);
  },
  utana: (sw) => { sw.macTabla = []; },
};

/** Az IP-cím hálózata szövegként. */
function halozatSz(e) {
  return ipSzoveg(halozatSzam(ipSzam(e.cim), e.hossz));
}

/** /ip address */
const ipAddressLista = {
  lista: true,
  nevMezo: null,
  szekcio: '/ip address',
  elemek: (sw) => sw.ipCimek,
  tulajdonsagok: [
    {
      nev: 'address', tipus: 'cim', kotelezo: true, sugo: 'Az IP-cím előtaghosszal, pl. 192.168.99.2/24',
      olvas: (e) => `${e.cim}/${e.hossz}`,
      ir: (e, v) => { e.cim = v.cim; e.hossz = v.hossz; },
    },
    { nev: 'network', tipus: 'nev', olvas: (e) => halozatSz(e), csakOlvas: true, sugo: 'A hálózat címe (a címből számolja ki)' },
    { nev: 'interface', tipus: 'interfesz', fajtak: ['ether', 'bridge', 'vlan'], mezo: 'interfesz', kotelezo: true, sugo: 'Melyik interfészen legyen a cím' },
    KOMMENT,
    LETILTVA,
  ],
  zaszlok: [
    { betu: 'X', nev: 'DISABLED', fn: (e) => e.letiltva, csakHaVan: true },
    { betu: 'I', nev: 'INVALID', fn: (e, sw) => !e.letiltva && !l3Kapcsolat(sw, e.interfesz) && !interfeszKeres(sw, e.interfesz), csakHaVan: true },
    { betu: 'D', nev: 'DYNAMIC', fn: () => false },
  ],
  oszlopok: [
    { cim: 'ADDRESS', ertek: (e) => `${e.cim}/${e.hossz}` },
    { cim: 'NETWORK', ertek: (e) => halozatSz(e) },
    { cim: 'INTERFACE', ertek: (e) => e.interfesz },
  ],
  hozzaad(sw, ertekek) {
    const c = { cim: ertekek.address.cim, hossz: ertekek.address.hossz, interfesz: ertekek.interface, komment: '', letiltva: false };
    sw.ipCimek.push(c);
    return { elem: c };
  },
  torol(sw, e) {
    sw.ipCimek = sw.ipCimek.filter((x) => x !== e);
  },
  exportExtra: (e) => [['network', halozatSz(e)]],
};

/** /system identity – egyetlen beállítás (nem lista) */
const identityBeall = {
  lista: false,
  szekcio: '/system identity',
  tulajdonsagok: [
    { nev: 'name', tipus: 'nev', sugo: 'Az eszköz neve (ez látszik a promptban is)', olvas: (sw) => sw.hostname, ir: (sw, v) => { sw.hostname = v; }, alap: 'MikroTik' },
  ],
};

/**
 * A menüfa. Minden csomópont: { nev, sugo, almenuk, adat? (a fenti leírások egyike), parancsok? }
 * A gyökérmenü parancsai (ping, export) a parancssor.js-ben vannak.
 */
export const MENUFA = {
  nev: '',
  sugo: 'A főmenü',
  almenuk: [
    {
      nev: 'interface',
      sugo: 'Interfészek: portok, bridge-ek, VLAN-interfészek',
      adat: interfaceLista,
      almenuk: [
        {
          nev: 'bridge',
          sugo: 'Bridge-ek: a portokat összekapcsoló „szoftveres switch” és beállításai',
          adat: bridgeLista,
          almenuk: [
            { nev: 'host', sugo: 'A bridge MAC-táblája: melyik MAC-cím melyik porton (és VLAN-ban) van', adat: bridgeHostLista, almenuk: [] },
            { nev: 'port', sugo: 'A bridge portjai és VLAN-beállításaik (PVID, kerettípus, bemeneti szűrés)', adat: bridgePortLista, almenuk: [] },
            { nev: 'vlan', sugo: 'A bridge VLAN-táblája: VLAN-onként a címkézett és címkézetlen tagok', adat: bridgeVlanLista, almenuk: [] },
          ],
        },
        { nev: 'vlan', sugo: 'VLAN-interfészek: a switch saját „lába” egy VLAN-ban (pl. a kezelő IP-címhez)', adat: vlanLista, almenuk: [] },
      ],
    },
    {
      nev: 'ip',
      sugo: 'IP-beállítások',
      almenuk: [
        { nev: 'address', sugo: 'Az eszköz saját IP-címei', adat: ipAddressLista, almenuk: [] },
      ],
    },
    {
      nev: 'system',
      sugo: 'Rendszerbeállítások',
      almenuk: [
        { nev: 'identity', sugo: 'Az eszköz neve (identity)', adat: identityBeall, almenuk: [] },
      ],
    },
  ],
};

// A szülő-hivatkozások és az útvonalak (a ? súgóhoz és a prompthoz).
(function szulok(cs, szulo, ut) {
  cs.szulo = szulo;
  cs.ut = ut;
  for (const a of cs.almenuk) szulok(a, cs, [...ut, a.nev]);
})(MENUFA, null, []);

/** Egy menü az útvonala szerint (pl. ['interface', 'bridge']). */
export function menuUtbol(ut) {
  let cs = MENUFA;
  for (const n of ut) {
    cs = cs.almenuk.find((a) => a.nev === n);
    if (!cs) return null;
  }
  return cs;
}

/** Az export szekcióinak sorrendje (ahogy a valódi eszköz is írja). */
export const EXPORT_SORREND = [
  ['interface', 'bridge'],
  ['interface', 'ethernet'],
  ['interface', 'vlan'],
  ['interface', 'bridge', 'port'],
  ['interface', 'bridge', 'vlan'],
  ['ip', 'address'],
  ['system', 'identity'],
];

export { aktualisTagok, vlanSorok };
