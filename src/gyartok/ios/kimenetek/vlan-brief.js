/**
 * A „show vlan brief” kimenete.
 *
 * Forma (lásd docs/forrasok.md): négy oszlop – VLAN (4), Name (32), Status (9), Ports.
 * A portok vesszővel elválasztva, egy sorba annyi fér, amennyi 31 karakterbe belefér
 * (a 2960-on ez soronként 4 port), a folytatósorok a Ports oszlop alá kerülnek.
 * A 1002–1005-ös gyári VLAN-ok állapota „act/unsup”.
 */

const PORT_OSZLOP_SZELESSEG = 31;
const BEHUZAS = ' '.repeat(4 + 1 + 32 + 1 + 9 + 1);

/**
 * A portlistát sorokra tördeli.
 * @param {string[]} portok – rövid nevek, pl. ["Fa0/1", "Fa0/2"]
 * @returns {string[]}
 */
export function portSorok(portok) {
  const sorok = [];
  let aktualis = '';
  for (const p of portok) {
    const jelolt = aktualis === '' ? p : `${aktualis}, ${p}`;
    if (aktualis !== '' && jelolt.length > PORT_OSZLOP_SZELESSEG) {
      sorok.push(aktualis);
      aktualis = p;
    } else {
      aktualis = jelolt;
    }
  }
  if (aktualis !== '') sorok.push(aktualis);
  return sorok;
}

/**
 * @param {import('../../../modell/switch.js').SwitchAllapot} sw
 * @returns {string[]}
 */
export function showVlanBrief(sw) {
  const sorok = [
    '',
    'VLAN Name                             Status    Ports',
    '---- -------------------------------- --------- -------------------------------',
  ];
  const szamok = Object.keys(sw.vlanok).map(Number).sort((a, b) => a - b);
  for (const szam of szamok) {
    const vlan = sw.vlanok[szam];
    const allapot = vlan.tamogatott === false ? 'act/unsup' : 'active';
    // Később: a trunk portok nem jelennek meg itt (csak az access/dinamikus portok).
    const portok = sw.portok.filter((p) => p.accessVlan === szam).map((p) => p.rovid);
    const elso = `${String(szam).padEnd(4)} ${vlan.nev.padEnd(32)} ${allapot.padEnd(9)} `;
    const ps = portSorok(portok);
    sorok.push((elso + (ps[0] || '')).trimEnd());
    for (const folytatas of ps.slice(1)) sorok.push(BEHUZAS + folytatas);
  }
  return sorok;
}
