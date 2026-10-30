/**
 * Interfész-kimenetek: „show interfaces trunk” és „show interfaces status”.
 * A forma leírása és forrásai: docs/forrasok.md.
 */

import { uzemmod, vlanAktiv } from '../../../mag/kapcsolas.js';

/** VLAN-számok tömör listája: [1,2,3,10,20] → "1-3,10,20" */
export function vlanListaTomor(szamok) {
  const s = [...szamok].sort((a, b) => a - b);
  const reszek = [];
  for (let i = 0; i < s.length; i++) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    reszek.push(j > i ? `${s[i]}-${s[j]}` : String(s[i]));
    i = j;
  }
  return reszek.join(',');
}

/** A trunk módja a kimenetben: on (trunk), auto, desirable. */
const MOD_NEV = { trunk: 'on', 'dinamikus-auto': 'auto', 'dinamikus-kezdemenyezo': 'desirable' };

/**
 * show interfaces trunk
 * Megjelenik minden „switchport mode trunk” port (ha nincs link: status „other”), és minden
 * dinamikus port, amelyik éppen trunkként működik. Ha nincs ilyen, a kimenet üres.
 */
export function showInterfacesTrunk(sw) {
  const portok = sw.portok.filter((p) => p.mod === 'trunk' || (p.mod !== 'access' && uzemmod(sw, p) === 'trunk'));
  if (portok.length === 0) return [];
  const aktivak = Object.keys(sw.vlanok).map(Number).filter((n) => n < 1002 || n > 1005).filter((n) => vlanAktiv(sw, n));
  const sor = (port, szoveg) => `${port.padEnd(12)}${szoveg}`;
  const s = ['', 'Port        Mode             Encapsulation  Status        Native vlan'];
  for (const p of portok) {
    s.push(sor(p.rovid, `${MOD_NEV[p.mod].padEnd(17)}${'802.1q'.padEnd(15)}${(p.fent ? 'trunking' : 'other').padEnd(14)}${p.nativVlan}`));
  }
  const szakasz = (cim, ertek) => {
    s.push('', sor('Port', cim));
    for (const p of portok) s.push(sor(p.rovid, p.fent ? ertek : 'none'));
  };
  szakasz('Vlans allowed on trunk', '1-4094');
  szakasz('Vlans allowed and active in management domain', vlanListaTomor(aktivak));
  // Feszítőfa (STP) még nincs a szimulátorban: minden aktív VLAN továbbító állapotú.
  szakasz('Vlans in spanning tree forwarding state and not pruned', vlanListaTomor(aktivak));
  return s;
}

/**
 * show interfaces status
 * Oszlopok: Port, Name, Status, Vlan, Duplex, Speed, Type.
 */
export function showInterfacesStatus(sw) {
  const s = ['', 'Port      Name               Status       Vlan       Duplex  Speed Type'];
  for (const p of sw.portok) {
    let allapot;
    if (p.leallitva) allapot = 'disabled';
    else if (p.fent) allapot = 'connected';
    else allapot = 'notconnect';
    const vlan = p.fent && uzemmod(sw, p) === 'trunk' ? 'trunk' : String(p.accessVlan);
    const giga = p.tipus === 'GigabitEthernet';
    const duplex = p.fent ? 'a-full' : 'auto';
    const sebesseg = p.fent ? (giga ? 'a-1000' : 'a-100') : 'auto';
    const tipus = giga ? '10/100/1000BaseTX' : '10/100BaseTX';
    s.push(`${p.rovid.padEnd(9)} ${''.padEnd(18)} ${allapot.padEnd(12)} ${vlan.padEnd(10)} ${duplex.padStart(6)} ${sebesseg.padStart(6)} ${tipus}`);
  }
  return s;
}
