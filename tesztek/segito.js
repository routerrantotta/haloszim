/**
 * Közös segédfüggvények a tesztekhez: egy friss switch + munkamenet, és parancsfuttatás.
 */
import { Munkamenet } from '../src/cli/terminal-munkamenet.js';
import { ios } from '../src/gyartok/ios/index.js';
import { ujSwitch2960 } from '../src/modell/switch.js';
import { Ora } from '../src/mag/ido.js';

/** Új, gyári állapotú switch és munkamenet (felhasználói módban). */
export function ujMunkamenet() {
  const eszkoz = ujSwitch2960();
  const ora = new Ora();
  return new Munkamenet({ szemelyiseg: ios, eszkoz, ora });
}

/**
 * Lefuttat egy vagy több parancsot, és visszaadja az UTOLSÓ kimenetét szövegsorokként
 * (a várakozásokat kihagyva).
 */
export function fut(mm, ...sorok) {
  let kimenet = [];
  for (const s of sorok) kimenet = mm.bevitel(s).kimenet;
  return kimenet.filter((e) => typeof e === 'string');
}

/** Ugyanaz, de privilegizált módból indul. */
export function privbol(...sorok) {
  const mm = ujMunkamenet();
  fut(mm, 'enable');
  return { mm, kimenet: fut(mm, ...sorok) };
}

/** Konfigurációs módból indul. */
export function konfigbol(...sorok) {
  const mm = ujMunkamenet();
  fut(mm, 'enable', 'configure terminal');
  return { mm, kimenet: sorok.length ? fut(mm, ...sorok) : [] };
}

// ---------------------------------------------------------------------------
// Hálózatos tesztekhez: a vlan-1 feladat betöltve, minden switchhez egy munkamenet.
// ---------------------------------------------------------------------------
import '../feladatok/vlan-1.js';
import '../feladatok/vtp-1.js';
import { feladatKeres, feladatBetolt } from '../src/feladat/betolto.js';
import { feladatValtozat } from '../src/feladat/veletlen.js';
import { ipBeallit } from '../src/mag/vegpont.js';

/** A vlan-1 feladat hálózata; f.mm('SW1') a switch konzolja (privilegizált módban). */
export function vlanFeladat() {
  return feladatTeszt('vlan-1');
}

/**
 * Bármelyik feladat hálózata a tesztekhez (ugyanazokkal a segédekkel).
 * mag: a véletlen változat száma (null = alapadatok, mint oktató módban); f.e = a változók értékei.
 */
export function feladatTeszt(azon, mag = null) {
  const f = feladatBetolt(feladatValtozat(feladatKeres(azon), mag), { kesleltetes: 1 });
  f.e = f.feladat.ertekek;
  const munkamenetek = new Map();
  f.mm = (nev) => {
    if (!munkamenetek.has(nev)) {
      const mm = new Munkamenet({ szemelyiseg: ios, eszkoz: f.eszkoz(nev), ora: f.halozat.ora });
      fut(mm, 'enable');
      munkamenetek.set(nev, mm);
    }
    return munkamenetek.get(nev);
  };
  /** Parancsok egy switchen (az utolsó kimenetét adja vissza). */
  f.sw = (nev, ...sorok) => fut(f.mm(nev), ...sorok);
  /** A PC-k IP-címe a címterv szerint. */
  f.ipk = () => {
    for (const s of f.feladat.cimterv) ipBeallit(f.eszkoz(s.eszkoz), { ip: s.ip, maszk: s.maszk });
  };
  f.lep = (ms = 20000) => f.halozat.ora.lep(ms);
  return f;
}

/** A teljes, helyes megoldás egy switchen (rövidítve vagy kiírva). */
export function megold(f, nev, roviden = false) {
  if (roviden) {
    f.sw(nev, 'conf t', 'vl 10', 'na IRODA', 'vl 20', 'na RAKTAR', 'int f0/1', 'sw mo acc', 'sw acc vl 10',
      'int fa0/2', 'sw mo acc', 'sw acc vl 20', 'int g0/1', 'sw mo tr', 'end');
  } else {
    f.sw(nev, 'configure terminal', 'vlan 10', 'name IRODA', 'exit', 'vlan 20', 'name RAKTAR', 'exit',
      'interface FastEthernet0/1', 'switchport mode access', 'switchport access vlan 10', 'exit',
      'interface FastEthernet0/2', 'switchport mode access', 'switchport access vlan 20', 'exit',
      'interface GigabitEthernet0/1', 'switchport mode trunk', 'end');
  }
}
