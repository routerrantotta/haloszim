/**
 * Az állapot-célok MikroTik-switchen (a bridge-modell szerint). Ugyanazok a céltípusok, mint a
 * Cisco-switchen (vlan, access-port, trunk) – így egy feladat céljai gyártótól függetlenek,
 * csak a portnevek mások. Az ellenorzo.js hívja, ha az eszköz MikroTik.
 *
 *   vlan:        van-e a VLAN-tábla egy (nem dinamikus) sorában; a „név” a sor megjegyzése (comment)
 *   access-port: a port a bridge-ben van, PVID = a VLAN, csak címke nélküli keretet fogad, nem
 *                címkézett tagja semmilyen VLAN-nak, és a bridge-en be van kapcsolva a VLAN-szűrés
 *   trunk:       mindkét vég címkézett (tagged) tagja a megadott VLAN-oknak (vlanok), VLAN-szűréssel
 *   kezelo-ip:   a switch kezelő IP-címe egy VLAN-interfészen van, a megadott VLAN-ban
 *                ({ eszkoz, ip: '192.168.99.2/24', vlan: 99 })
 *
 * A bemutató lépéseihez (a VLAN-szűrés bekapcsolása előtti állapotok is):
 *   hid-port:    { eszkoz, port, pvid?, kerettipus? } – a bridge-port beállítása
 *   hid-vlan:    { eszkoz, vlan, tagged?: [], untagged?: [] } – a VLAN-tábla tagjai (legalább ezek)
 *   vlan-szures: { eszkoz, be: true|false } – a bridge VLAN-szűrése
 */

import { hidPortja, l3Kapcsolat } from '../mag/hid.js';
import { hidKeres, sorVlanjai } from '../modell/mikrotik.js';
import { esRag, nevelo } from '../magyar.js';

const aVlan = (n) => `${nevelo(n)} ${esRag(n)}`;
const AVlan = (n) => { const t = aVlan(n); return t[0].toUpperCase() + t.slice(1); };

/** A VLAN-tábla statikus sorai, amelyekben a VLAN szerepel. */
function sorok(sw, vlan) {
  return sw.hidVlanok.filter((s) => !s.letiltva && sorVlanjai(s).includes(vlan));
}

/** A port bridge-beállítása (vagy a hiba szövege). */
function portHid(sw, portNev) {
  const p = sw.portok.find((x) => x.nev === portNev);
  const hp = hidPortja(sw, portNev);
  if (!hp) return { hiba: `${portNev} nincs a bridge-ben` };
  const hid = hidKeres(sw, hp.hid);
  if (!hid) return { hiba: `${portNev} egy nem létező bridge-hez (${hp.hid}) tartozik` };
  return { p, hp, hid };
}

/** A VLAN-ok, amelyeknek a port címkézett tagja. */
function cimkezettVlanok(sw, hid, portNev) {
  const v = [];
  for (const s of sw.hidVlanok) {
    if (s.letiltva || s.hid !== hid.nev || !s.cimkezett.includes(portNev)) continue;
    for (const n of sorVlanjai(s)) if (!v.includes(n)) v.push(n);
  }
  return v.sort((a, b) => a - b);
}

export const MT_CELOK = {
  'hid-port'(f, c) {
    const sw = f.eszkoz(c.eszkoz);
    const hp = hidPortja(sw, c.port);
    if (!hp) return { ok: false, megjegyzes: `${c.port} nincs a bridge-ben.` };
    const hibak = [];
    if (c.pvid !== undefined && hp.pvid !== c.pvid) hibak.push(`a PVID most ${hp.pvid} (${c.pvid} kellene)`);
    if (c.kerettipus && hp.kerettipus !== c.kerettipus) hibak.push(`frame-types most ${hp.kerettipus} (${c.kerettipus} kellene)`);
    if (hibak.length) return { ok: false, megjegyzes: hibak.join('; ') + '.' };
    return { ok: true, megjegyzes: `${c.port}: PVID ${hp.pvid}, ${hp.kerettipus}.` };
  },

  'hid-vlan'(f, c) {
    const sw = f.eszkoz(c.eszkoz);
    const s = sorok(sw, c.vlan);
    const cimkes = new Set(s.flatMap((x) => x.cimkezett));
    const cimke = new Set(s.flatMap((x) => x.cimkezetlen));
    const hiany = [...(c.tagged || []).filter((n) => !cimkes.has(n)).map((n) => `${n} (tagged)`),
      ...(c.untagged || []).filter((n) => !cimke.has(n)).map((n) => `${n} (untagged)`)];
    if (!s.length) return { ok: false, megjegyzes: `${AVlan(c.vlan)} VLAN nincs a VLAN-táblában.` };
    if (hiany.length) return { ok: false, megjegyzes: `${AVlan(c.vlan)} VLAN-ból hiányzik: ${hiany.join(', ')}.` };
    return { ok: true, megjegyzes: `${c.vlan}: tagged ${[...cimkes].join(',') || '–'}, untagged ${[...cimke].join(',') || '–'}.` };
  },

  'vlan-szures'(f, c) {
    const sw = f.eszkoz(c.eszkoz);
    const be = sw.hidak.some((h) => h.vlanSzures && !h.letiltva);
    const kell = c.be !== false;
    return be === kell
      ? { ok: true, megjegyzes: `A VLAN-szűrés ${be ? 'be' : 'ki'} van kapcsolva.` }
      : { ok: false, megjegyzes: `A VLAN-szűrés most ${be ? 'be' : 'ki'} van kapcsolva (${kell ? 'be' : 'ki'} kellene).` };
  },

  'kezelo-ip'(f, c) {
    const sw = f.eszkoz(c.eszkoz);
    const [cim, hossz] = c.ip.split('/');
    const ip = sw.ipCimek.find((x) => x.cim === cim && !x.letiltva);
    if (!ip) return { ok: false, megjegyzes: `${c.eszkoz}-nek nincs ${cim} címe.` };
    const hibak = [];
    if (String(ip.hossz) !== hossz) hibak.push(`az előtaghossz most /${ip.hossz} (/${hossz} kellene)`);
    const v = sw.vlanIfek.find((x) => x.nev === ip.interfesz);
    if (!v) hibak.push(`a cím a(z) ${ip.interfesz} interfészen van, nem egy VLAN-interfészen`);
    else {
      if (v.vlanId !== c.vlan) hibak.push(`a(z) ${v.nev} VLAN-interfész most a ${v.vlanId}-es VLAN-ban van (${c.vlan} kellene)`);
      if (!l3Kapcsolat(sw, v.nev)) hibak.push(`a(z) ${v.nev} nem egy működő bridge-en van (vagy le van tiltva)`);
    }
    if (hibak.length) return { ok: false, megjegyzes: hibak.join('; ') + '.' };
    return { ok: true, megjegyzes: `${c.ip} a(z) ${v.nev} interfészen (VLAN ${v.vlanId}).` };
  },

  vlan(f, c) {
    const sw = f.eszkoz(c.eszkoz);
    const s = sorok(sw, c.vlan);
    if (!s.length) return { ok: false, megjegyzes: `${AVlan(c.vlan)} VLAN nincs a bridge VLAN-táblájában (${c.eszkoz}).` };
    if (c.nev && !s.some((x) => x.komment === c.nev)) {
      const most = s.map((x) => x.komment || '(nincs)').join(', ');
      return { ok: false, megjegyzes: `A VLAN-tábla sorának megjegyzése (comment) most: ${most} (${c.nev} kellene; kis- és nagybetű számít).` };
    }
    return { ok: true, megjegyzes: `Megvan: ${c.vlan}${c.nev ? ` (${c.nev})` : ''}` };
  },

  'access-port'(f, c) {
    const sw = f.eszkoz(c.eszkoz);
    const ph = portHid(sw, c.port);
    if (ph.hiba) return { ok: false, megjegyzes: `${ph.hiba}.` };
    const { p, hp, hid } = ph;
    const hibak = [];
    if (hp.pvid !== c.vlan) hibak.push(`a PVID most ${hp.pvid} (${c.vlan} kellene)`);
    if (hp.kerettipus !== 'admit-only-untagged-and-priority-tagged') hibak.push(`a port most ${hp.kerettipus === 'admit-all' ? 'címkés keretet is fogad' : 'csak címkés keretet fogad'} (frame-types=${hp.kerettipus})`);
    const cimkes = cimkezettVlanok(sw, hid, c.port);
    if (cimkes.length) hibak.push(`a port címkézett (tagged) tag is ebben: ${cimkes.join(', ')}`);
    if (!hid.vlanSzures) hibak.push(`a ${hid.nev} bridge-en nincs bekapcsolva a VLAN-szűrés (vlan-filtering), így a PVID még nem számít`);
    if (p.leallitva) hibak.push('a port le van tiltva (disabled)');
    if (hibak.length) return { ok: false, megjegyzes: hibak.join('; ') + '.' };
    return { ok: true, megjegyzes: `access, PVID ${c.vlan}` };
  },

  trunk(f, c) {
    const sw = f.eszkoz(c.eszkoz);
    const p = sw.portok.find((x) => x.nev === c.port);
    if (!p.fent) return { ok: false, megjegyzes: `Nincs link a(z) ${p.nev} porton (le van tiltva?).` };
    const tul = sw.halozat.szomszed(sw, p);
    const vegek = [[sw, p], [tul.eszkoz, tul.port]];
    const hibak = [];
    const leirasok = [];
    for (const [e, pp] of vegek) {
      if (e.gyarto !== 'mikrotik') continue;
      const ph = portHid(e, pp.nev);
      if (ph.hiba) {
        hibak.push(`${e.hostname}: ${ph.hiba}`);
        continue;
      }
      const cimkes = cimkezettVlanok(e, ph.hid, pp.nev);
      const kell = (c.vlanok || []).map(Number);
      const hiany = kell.filter((v) => !cimkes.includes(v));
      if (!ph.hid.vlanSzures) hibak.push(`${e.hostname}: nincs bekapcsolva a VLAN-szűrés`);
      if (hiany.length) hibak.push(`${e.hostname} ${pp.nev}: nem címkézett tagja ennek: ${hiany.join(', ')}`);
      else if (!cimkes.length) hibak.push(`${e.hostname} ${pp.nev}: egyetlen VLAN-nak sem címkézett tagja`);
      leirasok.push(`${e.hostname}: ${cimkes.join(', ') || '–'}`);
    }
    if (hibak.length) return { ok: false, megjegyzes: `Nem működik trunkként (${hibak.join('; ')}).` };
    return { ok: true, megjegyzes: `Mindkét vég címkézett tagja (${leirasok.join('; ')}).` };
  },
};
