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
  felhasznalo: ['connect', 'disconnect', 'ping', 'ssh', 'telnet', 'terminal', 'traceroute', 'show interfaces'],
  priv: ['clear', 'clock', 'connect', 'copy', 'debug', 'delete', 'dir', 'disconnect', 'erase', 'more',
    'ping', 'reload', 'setup', 'ssh', 'telnet', 'terminal', 'traceroute', 'undebug', 'write', 'show interfaces'],
  konfig: ['aaa', 'access-list', 'banner', 'boot', 'cdp', 'clock', 'crypto', 'default', 'enable', 'ip',
    'line', 'logging', 'mac', 'ntp', 'service', 'snmp-server', 'spanning-tree', 'username', 'vtp'],
  'konfig-if': ['cdp', 'channel-group', 'description', 'duplex', 'ip', 'spanning-tree', 'speed',
    'switchport trunk', 'switchport nonegotiate', 'switchport port-security', 'switchport voice'],
  'konfig-if-tartomany': ['cdp', 'channel-group', 'description', 'duplex', 'spanning-tree', 'speed',
    'switchport trunk', 'switchport nonegotiate', 'switchport port-security', 'switchport voice'],
};

export const megNincsParancsok = Object.entries(LISTA).flatMap(([mod, nevek]) =>
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
