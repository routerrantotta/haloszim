/**
 * Valódi parancsok, amelyek a szimulátorban MÉG NINCSENEK meg.
 *
 * Miért kellenek? Két okból:
 *  1. A rövidítés így ugyanúgy viselkedik, mint a valódi eszközön: pl. „dis” a valódi
 *     switchen kétértelmű (disable, disconnect), itt is az.
 *  2. Ha a tanuló egy létező parancsot ír be, nem „hibás parancs” üzenetet kap (ami
 *     megtévesztő lenne), hanem azt, hogy ez a szimulátorban még nincs meg.
 *
 * Csak a parancsok NEVEI szerepelnek itt; a magyarázat saját szöveg.
 * Ha egy parancs elkészül, innen törölni kell, és a saját fájljába kerül.
 */

const MEG_NINCS = '(a szimulátorban még nincs meg)';

/** Mód → a még hiányzó parancsok nevei (több szóból is állhat, pl. „switchport trunk”). */
const LISTA = {
  felhasznalo: ['connect', 'disconnect', 'ping', 'ssh', 'telnet', 'terminal', 'traceroute', 'show interfaces', 'show vtp counters'],
  priv: ['clear', 'clock', 'connect', 'copy', 'debug', 'delete', 'dir', 'disconnect', 'erase', 'more',
    'ping', 'reload', 'setup', 'ssh', 'telnet', 'terminal', 'traceroute', 'undebug', 'write', 'show interfaces', 'show vtp counters'],
  konfig: ['aaa', 'access-list', 'banner', 'boot', 'cdp', 'clock', 'crypto', 'default', 'enable', 'ip',
    'line', 'logging', 'mac', 'ntp', 'service', 'snmp-server', 'spanning-tree', 'username',
    'vtp pruning', 'vtp interface', 'vtp file'],
  'konfig-if': ['cdp', 'channel-group', 'description', 'duplex', 'ip', 'spanning-tree', 'speed',
    'switchport trunk', 'switchport nonegotiate', 'switchport port-security', 'switchport voice'],
  'konfig-if-tartomany': ['cdp', 'channel-group', 'description', 'duplex', 'spanning-tree', 'speed',
    'switchport trunk', 'switchport nonegotiate', 'switchport port-security', 'switchport voice'],
};

/** A „még nincs meg” parancsok egy listából (mód → nevek). */
export function megNincsBol(lista) {
  return Object.entries(lista).flatMap(([mod, nevek]) =>
  nevek.map((nev) => ({
    modok: [mod],
    // Csak az utolsó szó új; az előtte lévők (pl. switchport) már meglévő parancsok szavai.
    szavak: nev.split(' ').map((szo) => ({ szo, sugo: MEG_NINCS })),
    nincsMeg: true,
    vegrehajt(ctx) {
      ctx.kiir(`[Szimulátor] A(z) „${nev}” parancs a valódi eszközön létezik, de a szimulátorban még nincs meg.`, '');
    },
  })),
  );
}

export const megNincsParancsok = megNincsBol(LISTA);

/** A router még hiányzó parancsai. */
export const routerMegNincsParancsok = megNincsBol({
  felhasznalo: ['connect', 'disconnect', 'ssh', 'telnet', 'terminal', 'show interfaces', 'show version', 'show clock', 'show cdp',
    'show ipv6 neighbors', 'show ip ospf', 'show ip eigrp'],
  priv: ['clock', 'connect', 'copy', 'delete', 'dir', 'disconnect', 'erase', 'more', 'reload', 'setup', 'ssh', 'telnet', 'terminal',
    'write', 'show interfaces', 'show version', 'show clock', 'show cdp', 'show startup-config', 'show ipv6 neighbors',
    'show ip ospf', 'show ip eigrp', 'debug ip ospf', 'debug ip icmp', 'clear arp-cache', 'clear ipv6'],
  konfig: ['aaa', 'access-list', 'banner', 'boot', 'cdp', 'clock', 'crypto', 'enable', 'line', 'logging', 'ntp', 'service',
    'snmp-server', 'username', 'ip dhcp', 'ip domain-name', 'ip nat', 'ip ssh', 'ip access-list', 'ip name-server',
    'router ospf', 'router eigrp', 'ipv6 dhcp', 'ipv6 access-list'],
  'konfig-if': ['cdp', 'description', 'duplex', 'speed', 'encapsulation', 'ip nat', 'ip ospf', 'ip helper-address',
    'ip access-group', 'ip summary-address', 'ipv6 ospf', 'ipv6 nd'],
  'konfig-router': ['distance', 'distribute-list', 'maximum-paths', 'neighbor', 'offset-list', 'redistribute'],
  'konfig-rtr': ['distance', 'maximum-paths', 'redistribute', 'split-horizon', 'poison-reverse', 'timers'],
});
