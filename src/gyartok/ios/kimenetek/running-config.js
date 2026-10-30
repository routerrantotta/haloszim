/**
 * A „show running-config” kimenete egy 2960 jellegű switchen (IOS 15.0 jellegű forma).
 *
 * A konfiguráció MINDIG az eszköz állapotából készül, teljes parancsalakkal – mindegy,
 * hogy a tanuló rövidítve vagy kiírva gépelte be a parancsokat (mint a valódi eszközön).
 *
 * Fontos valódi viselkedés: VTP server módban (ez a gyári) a VLAN-ok NEM a running-configban
 * vannak, hanem a VLAN-adatbázisban (vlan.dat), ezért itt nem jelennek meg. Transparent
 * módban viszont igen. Források és a forma leírása: docs/forrasok.md.
 */

/**
 * A konfiguráció törzse (a „!”-től az „end”-ig).
 * @param {import('../../../modell/switch.js').SwitchAllapot} sw
 * @returns {string[]}
 */
export function konfiguracioTorzs(sw) {
  const s = [];
  s.push('!', 'version 15.0', 'no service pad',
    'service timestamps debug datetime msec', 'service timestamps log datetime msec',
    'no service password-encryption', '!');
  s.push(`hostname ${sw.hostname}`, '!');
  s.push('boot-start-marker', 'boot-end-marker', '!', '!');
  s.push('no aaa new-model', 'system mtu routing 1500');
  if (sw.vtpMod !== 'server') s.push(`vtp mode ${sw.vtpMod}`);
  s.push('!', '!', '!', '!', '!', '!');
  s.push('spanning-tree mode pvst', 'spanning-tree extend system-id', '!');
  s.push('vlan internal allocation policy ascending', '!');

  if (sw.vtpMod === 'transparent') {
    const szamok = Object.keys(sw.vlanok).map(Number).filter((n) => !sw.vlanok[n].gyari).sort((a, b) => a - b);
    for (const n of szamok) {
      s.push(`vlan ${n}`);
      const v = sw.vlanok[n];
      if (v.nev !== 'VLAN' + String(n).padStart(4, '0')) s.push(` name ${v.nev}`);
      s.push('!');
    }
  }
  s.push('!', '!', '!', '!', '!');

  for (const p of sw.portok) {
    s.push(`interface ${p.nev}`);
    if (p.accessVlan !== 1) s.push(` switchport access vlan ${p.accessVlan}`);
    if (p.mod === 'access') s.push(' switchport mode access');
    else if (p.mod === 'trunk') s.push(' switchport mode trunk');
    else if (p.mod === 'dinamikus-kezdemenyezo') s.push(' switchport mode dynamic desirable');
    if (p.leallitva) s.push(' shutdown');
    s.push('!');
  }
  s.push('interface Vlan1', ' no ip address', ' shutdown', '!');
  s.push('ip http server', 'ip http secure-server', '!', '!', '!');
  s.push('line con 0', 'line vty 0 4', ' login', 'line vty 5 15', ' login', '!', 'end');
  return s;
}

/**
 * A teljes kimenet, a fejléccel együtt.
 * @param {import('../../../modell/switch.js').SwitchAllapot} sw
 * @returns {string[]}
 */
export function showRunningConfig(sw) {
  const torzs = konfiguracioTorzs(sw);
  // A bájtszám a konfiguráció szövegének hossza (soronként egy sorvége-jellel).
  const bajt = torzs.reduce((osszeg, sor) => osszeg + sor.length + 1, 0);
  return ['Building configuration...', '', `Current configuration : ${bajt} bytes`, ...torzs, ''];
}
