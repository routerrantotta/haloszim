/**
 * Végpont (PC) működése: ARP, IPv4 és ICMP (ping).
 *
 *   - ARP: a gép szórással (broadcast) kérdezi meg, kié egy IP-cím; a gazdája válaszol.
 *     A válaszokat az ARP-gyorstár (pc.arpTabla) megjegyzi.
 *   - Kinek küld? Ha a cél a saját hálózatában van, közvetlenül neki; ha nem, az
 *     alapértelmezett átjárónak. Ha nincs átjáró, a csomag el sem indul.
 *   - ping: ICMP echo request → echo reply.
 *
 * A várakozó kérések (függő ARP, ping) egy belső táblában vannak, nem a modellben.
 */

import { SZORAS, ujKeretAzon } from './ethernet.js';
import { egyHalozat } from './ip.js';

/** Ennyi ideig vár ARP-válaszra (ms). */
export const ARP_VARAKOZAS = 3000;
/** Ennyi ideig vár a ping válaszára (ms; a PC-k alapértéke 4 s). */
export const PING_VARAKOZAS = 4000;
/** A PC által küldött csomagok TTL-je. */
export const ALAP_TTL = 128;

/** @type {WeakMap<Object, {arpVarok: Map, pingVarok: Map, kovetkezoSorszam: number}>} */
const belso = new WeakMap();
function allapot(pc) {
  let a = belso.get(pc);
  if (!a) belso.set(pc, (a = { arpVarok: new Map(), pingVarok: new Map(), kovetkezoSorszam: 1 }));
  return a;
}

function nic(pc) {
  return pc.portok[0];
}

function kuld(h, pc, keret) {
  h.kuld(pc, nic(pc), { azon: ujKeretAzon(), forrasMac: pc.mac, ...keret });
}

/** Van-e használható IP-beállítás. */
export function vanIp(pc) {
  return !!pc.ip && !!pc.maszk;
}

/**
 * Kinek kell elküldeni egy csomagot a célhoz (következő ugrás)?
 * @returns {string|null} – IP-cím, vagy null, ha nincs út (nincs átjáró)
 */
export function kovetkezoUgras(pc, celIp) {
  if (egyHalozat(pc.ip, celIp, pc.maszk)) return celIp;
  if (pc.atjaro && egyHalozat(pc.ip, pc.atjaro, pc.maszk)) return pc.atjaro;
  return null;
}

/**
 * Egy IP-címhez tartozó MAC kiderítése (ARP-gyorstárból vagy ARP-kérdéssel).
 * @param {(mac: string|null) => void} cb – null, ha nem jött válasz
 */
export function arpFelold(h, pc, ip, cb) {
  const b = pc.arpTabla[ip];
  if (b) return cb(b.mac);
  const a = allapot(pc);
  const var_ = a.arpVarok.get(ip);
  if (var_) {
    var_.cbk.push(cb);
    return;
  }
  const uj = { cbk: [cb], idozito: null };
  a.arpVarok.set(ip, uj);
  uj.idozito = h.ora.utemez(ARP_VARAKOZAS, () => {
    a.arpVarok.delete(ip);
    for (const f of uj.cbk) f(null);
  });
  kuld(h, pc, {
    celMac: SZORAS,
    tipus: 'arp',
    adat: { muvelet: 'keres', kuldoMac: pc.mac, kuldoIp: pc.ip, celMac: '000000000000', celIp: ip },
  });
}

/** Az ARP-gyorstár bővítése; a rá várakozók megkapják a választ. */
function arpTanul(h, pc, ip, mac) {
  pc.arpTabla[ip] = { mac, ido: h.ora.ido };
  const a = allapot(pc);
  const var_ = a.arpVarok.get(ip);
  if (var_) {
    a.arpVarok.delete(ip);
    h.ora.lemond(var_.idozito);
    for (const f of var_.cbk) f(mac);
  }
}

/** IP-csomag küldése (a következő ugrás MAC-címének kiderítése után). */
function ipKuld(h, pc, celIp, adat, hibaCb) {
  const ugras = kovetkezoUgras(pc, celIp);
  if (!ugras) return hibaCb && hibaCb('nincs-ut');
  arpFelold(h, pc, ugras, (mac) => {
    if (!mac) return hibaCb && hibaCb('arp');
    kuld(h, pc, { celMac: mac, tipus: 'ipv4', adat: { forrasIp: pc.ip, celIp, ttl: ALAP_TTL, ...adat } });
  });
}

/**
 * Egyetlen ping (echo request), és a végeredménye:
 *   { fajta: 'valasz', ttl }   – megjött a válasz
 *   { fajta: 'idotullepes' }   – nem jött válasz időben (Request timed out)
 *   { fajta: 'elerhetetlen' }  – nem jött ARP-válasz (Destination host unreachable)
 *   { fajta: 'hiba' }          – el sem tudta küldeni (nincs IP, nincs link, nincs átjáró)
 * @param {import('./halozat.js').Halozat} h
 * @param {Object} pc
 * @param {string} celIp
 * @param {(eredmeny: Object) => void} cb
 */
export function egyPing(h, pc, celIp, cb) {
  if (!vanIp(pc) || !nic(pc).fent) return cb({ fajta: 'hiba' });
  if (celIp === pc.ip) return cb({ fajta: 'valasz', ttl: ALAP_TTL });
  const a = allapot(pc);
  const sorszam = a.kovetkezoSorszam++;
  let kesz = false;
  const vege = (e) => {
    if (kesz) return;
    kesz = true;
    a.pingVarok.delete(sorszam);
    cb(e);
  };
  const ugras = kovetkezoUgras(pc, celIp);
  if (!ugras) return vege({ fajta: 'hiba' });
  arpFelold(h, pc, ugras, (mac) => {
    if (!mac) return vege({ fajta: 'elerhetetlen' });
    const idozito = h.ora.utemez(PING_VARAKOZAS, () => vege({ fajta: 'idotullepes' }));
    a.pingVarok.set(sorszam, (ttl) => {
      h.ora.lemond(idozito);
      vege({ fajta: 'valasz', ttl });
    });
    kuld(h, pc, {
      celMac: mac,
      tipus: 'ipv4',
      adat: { forrasIp: pc.ip, celIp, ttl: ALAP_TTL, protokoll: 'icmp', icmp: { tipus: 'echo-keres', sorszam } },
    });
  });
}

/**
 * Szórásos próba: a PC egy „ARP-próbát” küld szórással (feladó IP-je 0.0.0.0, ezért
 * senki nem válaszol rá, és senki ARP-gyorstárát sem módosítja). Akik megkapják, azok
 * a PC-vel egy szórási tartományban (egy VLAN-ban) vannak.
 * @param {(kik: Object[]) => void} cb – az eszközök, amelyekhez eljutott
 */
export function szorasProba(h, pc, cb) {
  const azon = ujKeretAzon();
  const kik = [];
  const leiratkozas = h.figyel((e) => {
    if (e.tipus === 'fogadva' && e.keret.azon === azon && !kik.includes(e.eszkoz)) kik.push(e.eszkoz);
  });
  h.kuld(pc, nic(pc), {
    azon,
    forrasMac: pc.mac,
    celMac: SZORAS,
    tipus: 'arp',
    adat: { muvelet: 'keres', kuldoMac: pc.mac, kuldoIp: '0.0.0.0', celMac: '000000000000', celIp: pc.ip || '0.0.0.0' },
  });
  // Elég idő, hogy a keret a legtávolabbi gépig is elérjen.
  h.ora.utemez(h.kesleltetes * 12 + 50, () => {
    leiratkozas();
    cb(kik);
  });
}

/** Egy keret megérkezett a PC hálózati kártyájára. */
export function vegpontFogad(h, pc, port, keret) {
  if (keret.vlan !== undefined) return h.eldob(pc, port, keret, 'A PC nem ismeri a 802.1Q-címkés keretet.');
  if (keret.celMac !== pc.mac && keret.celMac !== SZORAS) return; // nem neki szól: a kártya eldobja
  h.esemeny({ tipus: 'fogadva', eszkoz: pc, port, keret });

  if (keret.tipus === 'arp') {
    const arp = keret.adat;
    if (!vanIp(pc) || arp.kuldoIp === '0.0.0.0') return;
    if (arp.celIp !== pc.ip) return;
    arpTanul(h, pc, arp.kuldoIp, arp.kuldoMac);
    if (arp.muvelet === 'keres') {
      kuld(h, pc, {
        celMac: arp.kuldoMac,
        tipus: 'arp',
        adat: { muvelet: 'valasz', kuldoMac: pc.mac, kuldoIp: pc.ip, celMac: arp.kuldoMac, celIp: arp.kuldoIp },
      });
    }
    return;
  }

  if (keret.tipus === 'ipv4') {
    const ip = keret.adat;
    if (!vanIp(pc) || ip.celIp !== pc.ip) return;
    if (ip.protokoll === 'icmp' && ip.icmp.tipus === 'echo-keres') {
      ipKuld(h, pc, ip.forrasIp, { protokoll: 'icmp', icmp: { tipus: 'echo-valasz', sorszam: ip.icmp.sorszam } });
    } else if (ip.protokoll === 'icmp' && ip.icmp.tipus === 'echo-valasz') {
      const v = allapot(pc).pingVarok.get(ip.icmp.sorszam);
      if (v) v(ip.ttl);
    }
  }
}

/** A PC IP-beállításának módosítása (közben az ARP-gyorstár ürül). */
export function ipBeallit(pc, { ip, maszk, atjaro }) {
  if (ip !== undefined) pc.ip = ip;
  if (maszk !== undefined) pc.maszk = maszk;
  if (atjaro !== undefined) pc.atjaro = atjaro;
  pc.arpTabla = {};
}
