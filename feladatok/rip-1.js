/*
 * Haloszim feladat: Dinamikus forgalomirányítás – RIPv2 és RIPng (rip-1)
 *
 * Három router háromszögben (R1–R2 és R2–R3 gigabites link, R1–R3 lassú soros vonal), R1 mögött egy
 * internetszolgáltató (ISP). A címek kiosztva, a tanuló feladata a forgalomirányítás: RIPv2, az
 * automatikus összegzés csapdája, alapértelmezett útvonal terjesztése, RIPng, végül a metrika és a
 * konvergencia megfigyelése (a soros link ki- és bekapcsolása).
 *
 * A feladatfájl felépítése: lásd feladatok/vlan-1.js. Itt újdonság:
 *   ipv6: true – a PC-ablakban IPv6-mezők is vannak
 *   topologia.feliratok – szövegek a rajzon (a linkek hálózatai); eszközönként „felirat”: hova kerüljön a neve
 *   kábel 5. eleme: { soros: true } – lassú soros vonal
 *   kiindulo.<router> – interfészcímek, statikus útvonalak (src/feladat/betolto.js: routerBeallit)
 *   céltípusok: rip, ripng, ipv6-routing, utvonal (src/feladat/ellenorzo.js)
 *
 * A címek a „Dinamikus forgalomirányítás: RIPv2 és RIPng” feladatlap címtervét követik; a routerek
 * portnevei ISR 4331 jellegűek (G0/0/0, S0/1/0 …). Véletlen változatban a LAN-ok harmadik bájtja
 * (és az IPv6-alhálózat száma) változik; a két 172.16-os LAN mindig ugyanabban az osztályos
 * hálózatban marad, hogy az auto-summary csapdája megmaradjon.
 */
(function (g) {
  (g.HaloszimFeladatok = g.HaloszimFeladatok || []).push({
    azon: 'rip-1',
    tipus: 'Dinamikus routing',
    cim: 'RIPv2 és RIPng',
    szint: 'haladó',
    ipv6: true,
    valtozok: {
      L1: { tipus: 'szam', alap: 1, min: 30, max: 254 },
      L2: { tipus: 'szam', alap: 2, min: 30, max: 254 },
      L3: { tipus: 'szam', alap: 3, min: 30, max: 254, kulonbozik: ['L1'] },
    },
    leiras: [
      'Egy cégnek három telephelye van, mindegyikben egy router (R1, R2, R3) és mögötte egy LAN. R1 a határrouter: '
        + 'ő kapcsolódik az internetszolgáltatóhoz (ISP). R1 és R3 között csak egy lassú, 64 kbit/s-os soros vonal van, '
        + 'a többi kapcsolat gigabites.',
      'A címek ki vannak osztva (IPv4 és IPv6), de forgalomirányítás még nincs: a routerek csak a saját hálózataikat '
        + 'ismerik. A feladat: a RIP 2-es verziójával (IPv4) és a RIPng-vel (IPv6) minden LAN érje el a többit és az '
        + 'internetet (az ISP 198.51.100.1-es, illetve 2001:DB8:FFFF::1-es címét).',
      'A link-local címek kézzel vannak beállítva: R1 minden interfészén FE80::1, R2-n FE80::2, R3-on FE80::3 – így a '
        + 'routing táblában könnyű felismerni, melyik szomszédtól jött egy útvonal.',
    ],
    lepesek: [
      {
        cel: 'Vizsgáld meg a kiinduló állapotot: a routerek interfészeit és routing tábláját, és győződj meg róla, hogy a LAN-ok még nem érik el egymást.',
        parancsok: 'Mindhárom routeren: `show ip interface brief`, `show ipv6 interface brief`, `show ip route`, `show ipv6 route`; '
          + 'PC1-en: `ping 192.168.{L2}.10`',
        tippek: [
          'A show parancsok privilegizált módban (`enable` után) futnak.',
          'A routing táblában most csak C és L kódú sorok vannak: a router csak a közvetlenül kapcsolt hálózatait ismeri.',
        ],
      },
      {
        cel: 'Mindhárom routeren induljon el a RIP 2-es verziója, és hirdesse a router belső hálózatait. A LAN felé ne menjen frissítés, és R1 az internet felé néző hálózatot ne hirdesse.',
        parancsok: '`router rip`, `version 2`; R1 és R3: `network 172.16.0.0`, `network 10.0.0.0`; R2: `network 192.168.{L2}.0`, '
          + '`network 10.0.0.0`; mindhárom: `passive-interface g0/0/0`',
        tippek: [
          'A RIP-et globális konfigurációs módban indítod; a beállításai a saját almódjában vannak.',
          'A hálózatokat osztályos címmel kell megadni: a 10.1.x.x linkekhez egyetlen sor elég.',
          'A LAN felé a passzív interfész kapcsolja ki a frissítéseket – a LAN hálózatát ettől még hirdeti.',
        ],
      },
      {
        cel: 'Érd el, hogy a két 172.16-os LAN ne összevonva (egyetlen /16-os hálózatként) terjedjen, hanem minden router a pontos /24-es hálózatokat ismerje.',
        parancsok: 'Előbb nézd meg R2-n: `show ip route` (csak 172.16.0.0/16, két úton), PC2-n: `ping 172.16.{L1}.10` (hol megy, hol nem). '
          + 'Javítás mindhárom routeren: `router rip`, `no auto-summary`; végül `clear ip route *`',
        tippek: [
          'Nézd meg R2 routing tábláját: miért van ott 172.16.0.0/16, és miért két irányba?',
          'Az osztályhatáron a RIP magától összevonja az alhálózatokat. Ez nem összefüggő hálózatnál hibát okoz.',
          'Az automatikus összegzést a RIP beállításai között lehet kikapcsolni, mindhárom routeren.',
        ],
      },
      {
        cel: 'R1 küldje az internet felé a nem ismert címekre szóló forgalmat (alapértelmezett útvonal), és ezt hirdesse a többi routernek is.',
        parancsok: 'R1-en: `ip route 0.0.0.0 0.0.0.0 203.0.113.1`, majd `router rip`, `default-information originate`. '
          + 'R2-n és R3-on: `show ip route` (R* 0.0.0.0/0)',
        tippek: [
          'Az ISP felé egy statikus alapértelmezett útvonal kell (0.0.0.0/0).',
          'A RIP-nek külön meg kell mondani, hogy ezt az útvonalat hirdesse – a RIP beállításai között.',
        ],
      },
      {
        cel: 'Indítsd el a RIPng-t mindhárom router minden belső interfészén (az ISP felé nem). R1 vegye fel az IPv6 alapértelmezett útvonalat az ISP felé, és hirdesse a belső routereknek.',
        parancsok: '`ipv6 unicast-routing`, `ipv6 router rip RIPNG`; interfészenként: `ipv6 rip RIPNG enable`; R1 G0/0/1 és S0/1/0 '
          + 'interfészén: `ipv6 rip RIPNG default-information originate`; R1-en: `ipv6 route ::/0 2001:DB8:FEED:1::1`',
        tippek: [
          'A router alapból nem továbbít IPv6-csomagokat: ezt előbb be kell kapcsolni.',
          'A RIPng-ben nincs network parancs: interfészenként kell bekapcsolni (több interfésznél jól jön az `interface range`).',
          'A RIPng-ben az alapértelmezett útvonal hirdetése interfész-beállítás.',
        ],
      },
      {
        cel: 'Vizsgáld meg, merre megy a PC1 → PC3 forgalom, és figyeld meg, mi történik, ha a soros vonal kiesik, majd visszajön. A végén a soros vonal legyen újra bekapcsolva.',
        parancsok: 'R1-en: `show ip route rip`; PC1-en: `tracert 172.16.{L3}.10`; R2-n: `debug ip rip`; R1-en: `interface s0/1/0`, '
          + '`shutdown`, kb. fél perc múlva `do show ip route`, majd `no shutdown`; R2-n: `undebug all`. Végül: Ellenőrzés.',
        tippek: [
          'A RIP csak az ugrásokat számolja: nézd meg, R1 melyik interfészen éri el PC3 hálózatát.',
          'A tracert ugrásonként mutatja az utat; a soros vonalon nagyobb az idő.',
          'A soros interfészt R1-en kapcsold le, majd vissza – közben a `debug ip rip` mutatja a frissítéseket.',
        ],
      },
    ],
    cimterv: [
      { eszkoz: 'R1', interfesz: 'G0/0/0', ip: '172.16.{L1}.1/24', ipv6: '2001:DB8:ACAD:{L1}::1/64' },
      { eszkoz: 'R1', interfesz: 'G0/0/1', ip: '10.1.12.1/30', ipv6: '2001:DB8:ACAD:12::1/64' },
      { eszkoz: 'R1', interfesz: 'S0/1/0', ip: '10.1.13.1/30', ipv6: '2001:DB8:ACAD:13::1/64' },
      { eszkoz: 'R1', interfesz: 'S0/1/1', ip: '203.0.113.2/30', ipv6: '2001:DB8:FEED:1::2/64' },
      { eszkoz: 'R2', interfesz: 'G0/0/0', ip: '192.168.{L2}.1/24', ipv6: '2001:DB8:ACAD:{L2}::1/64' },
      { eszkoz: 'R2', interfesz: 'G0/0/1', ip: '10.1.12.2/30', ipv6: '2001:DB8:ACAD:12::2/64' },
      { eszkoz: 'R2', interfesz: 'G0/0/2', ip: '10.1.23.1/30', ipv6: '2001:DB8:ACAD:23::1/64' },
      { eszkoz: 'R3', interfesz: 'G0/0/0', ip: '172.16.{L3}.1/24', ipv6: '2001:DB8:ACAD:{L3}::1/64' },
      { eszkoz: 'R3', interfesz: 'G0/0/1', ip: '10.1.23.2/30', ipv6: '2001:DB8:ACAD:23::2/64' },
      { eszkoz: 'R3', interfesz: 'S0/1/0', ip: '10.1.13.2/30', ipv6: '2001:DB8:ACAD:13::2/64' },
      { eszkoz: 'ISP', interfesz: 'S0/1/0', ip: '203.0.113.1/30', ipv6: '2001:DB8:FEED:1::1/64' },
      { eszkoz: 'ISP', interfesz: 'Lo0', ip: '198.51.100.1/24', ipv6: '2001:DB8:FFFF::1/64' },
      { eszkoz: 'PC1', interfesz: 'Fa0', ip: '172.16.{L1}.10/24', ipv6: '2001:DB8:ACAD:{L1}::10/64', atjaro: '172.16.{L1}.1, FE80::1' },
      { eszkoz: 'PC2', interfesz: 'Fa0', ip: '192.168.{L2}.10/24', ipv6: '2001:DB8:ACAD:{L2}::10/64', atjaro: '192.168.{L2}.1, FE80::2' },
      { eszkoz: 'PC3', interfesz: 'Fa0', ip: '172.16.{L3}.10/24', ipv6: '2001:DB8:ACAD:{L3}::10/64', atjaro: '172.16.{L3}.1, FE80::3' },
    ],
    topologia: {
      meret: { szel: 760, mag: 540 },
      eszkozok: [
        { nev: 'R1', tipus: 'router', x: 380, y: 200, felirat: 'jobbra' },
        { nev: 'R2', tipus: 'router', x: 200, y: 350, felirat: 'balra' },
        { nev: 'R3', tipus: 'router', x: 560, y: 350, felirat: 'jobbra' },
        { nev: 'ISP', tipus: 'router', x: 380, y: 52, felirat: 'jobbra' },
        { nev: 'PC1', tipus: 'pc', x: 60, y: 168 },
        { nev: 'PC2', tipus: 'pc', x: 160, y: 432 },
        { nev: 'PC3', tipus: 'pc', x: 520, y: 432 },
      ],
      kabelek: [
        ['ISP', 'Serial0/1/0', 'R1', 'Serial0/1/1', { soros: true }],
        ['R1', 'GigabitEthernet0/0/0', 'PC1', 'FastEthernet0'],
        ['R1', 'GigabitEthernet0/0/1', 'R2', 'GigabitEthernet0/0/1'],
        ['R1', 'Serial0/1/0', 'R3', 'Serial0/1/0', { soros: true }],
        ['R2', 'GigabitEthernet0/0/2', 'R3', 'GigabitEthernet0/0/1'],
        ['R2', 'GigabitEthernet0/0/0', 'PC2', 'FastEthernet0'],
        ['R3', 'GigabitEthernet0/0/0', 'PC3', 'FastEthernet0'],
      ],
      feliratok: [
        { x: 412, y: 104, igazit: 'start', szoveg: '203.0.113.0/30\n2001:DB8:FEED:1::/64' },
        { x: 470, y: 30, igazit: 'start', szoveg: 'Lo0: 198.51.100.1/24\n2001:DB8:FFFF::1/64', halvany: true },
        { x: 300, y: 296, igazit: 'start', szoveg: '10.1.12.0/30\n2001:DB8:ACAD:12::/64' },
        { x: 478, y: 232, igazit: 'start', szoveg: '10.1.13.0/30\n2001:DB8:ACAD:13::/64\nsoros, 64 kbit/s' },
        { x: 380, y: 340, szoveg: '10.1.23.0/30' },
        { x: 380, y: 370, szoveg: '2001:DB8:ACAD:23::/64' },
        { x: 100, y: 128, szoveg: 'LAN1: 172.16.{L1}.0/24\n2001:DB8:ACAD:{L1}::/64', halvany: true },
        { x: 150, y: 470, igazit: 'end', szoveg: 'LAN2\n192.168.{L2}.0/24\n2001:DB8:ACAD:{L2}::/64', halvany: true },
        { x: 610, y: 470, igazit: 'start', szoveg: 'LAN3\n172.16.{L3}.0/24\n2001:DB8:ACAD:{L3}::/64', halvany: true },
      ],
    },
    kiindulo: {
      ISP: {
        portok: {
          'Serial0/1/0': { ip: '203.0.113.1', maszk: '255.255.255.252', ipv6: ['2001:DB8:FEED:1::1/64'], linkLocal: 'FE80::9' },
          Loopback0: { ip: '198.51.100.1', maszk: '255.255.255.0', ipv6: ['2001:DB8:FFFF::1/64'] },
        },
        // A szolgáltató a cég hálózatait R1 felé küldi vissza (összevont útvonalakkal).
        statikus: [
          { halozat: '10.0.0.0', maszk: '255.0.0.0', kovetkezo: '203.0.113.2' },
          { halozat: '172.16.0.0', maszk: '255.255.0.0', kovetkezo: '203.0.113.2' },
          { halozat: '192.168.0.0', maszk: '255.255.0.0', kovetkezo: '203.0.113.2' },
        ],
        statikus6: [{ prefix: '2001:DB8:ACAD::/48', kovetkezo: '2001:DB8:FEED:1::2' }],
        ipv6Routing: true,
      },
      R1: {
        portok: {
          'GigabitEthernet0/0/0': { ip: '172.16.{L1}.1', maszk: '255.255.255.0', ipv6: ['2001:DB8:ACAD:{L1}::1/64'], linkLocal: 'FE80::1' },
          'GigabitEthernet0/0/1': { ip: '10.1.12.1', maszk: '255.255.255.252', ipv6: ['2001:DB8:ACAD:12::1/64'], linkLocal: 'FE80::1' },
          'Serial0/1/0': { ip: '10.1.13.1', maszk: '255.255.255.252', ipv6: ['2001:DB8:ACAD:13::1/64'], linkLocal: 'FE80::1' },
          'Serial0/1/1': { ip: '203.0.113.2', maszk: '255.255.255.252', ipv6: ['2001:DB8:FEED:1::2/64'], linkLocal: 'FE80::1' },
        },
      },
      R2: {
        portok: {
          'GigabitEthernet0/0/0': { ip: '192.168.{L2}.1', maszk: '255.255.255.0', ipv6: ['2001:DB8:ACAD:{L2}::1/64'], linkLocal: 'FE80::2' },
          'GigabitEthernet0/0/1': { ip: '10.1.12.2', maszk: '255.255.255.252', ipv6: ['2001:DB8:ACAD:12::2/64'], linkLocal: 'FE80::2' },
          'GigabitEthernet0/0/2': { ip: '10.1.23.1', maszk: '255.255.255.252', ipv6: ['2001:DB8:ACAD:23::1/64'], linkLocal: 'FE80::2' },
        },
      },
      R3: {
        portok: {
          'GigabitEthernet0/0/0': { ip: '172.16.{L3}.1', maszk: '255.255.255.0', ipv6: ['2001:DB8:ACAD:{L3}::1/64'], linkLocal: 'FE80::3' },
          'GigabitEthernet0/0/1': { ip: '10.1.23.2', maszk: '255.255.255.252', ipv6: ['2001:DB8:ACAD:23::2/64'], linkLocal: 'FE80::3' },
          'Serial0/1/0': { ip: '10.1.13.2', maszk: '255.255.255.252', ipv6: ['2001:DB8:ACAD:13::2/64'], linkLocal: 'FE80::3' },
        },
      },
      PC1: { ip: '172.16.{L1}.10', maszk: '255.255.255.0', atjaro: '172.16.{L1}.1', ipv6: '2001:DB8:ACAD:{L1}::10', ipv6Atjaro: 'FE80::1' },
      PC2: { ip: '192.168.{L2}.10', maszk: '255.255.255.0', atjaro: '192.168.{L2}.1', ipv6: '2001:DB8:ACAD:{L2}::10', ipv6Atjaro: 'FE80::2' },
      PC3: { ip: '172.16.{L3}.10', maszk: '255.255.255.0', atjaro: '172.16.{L3}.1', ipv6: '2001:DB8:ACAD:{L3}::10', ipv6Atjaro: 'FE80::3' },
    },
    celok: [
      // --- RIPv2 ---
      { tipus: 'rip', eszkoz: 'R1', verzio: 2, halozatok: ['172.16.0.0', '10.0.0.0'], passziv: ['GigabitEthernet0/0/0'], autoSummary: false, alapUtvonal: true,
        szoveg: 'R1: RIPv2 a belső hálózatokon, passzív LAN-interfész, automatikus összegzés nélkül, default route hirdetésével' },
      { tipus: 'rip', eszkoz: 'R1', nemHalozatok: ['203.0.113.0'], ellenproba: true,
        szoveg: 'R1 nem hirdeti RIP-pel az internet felé néző hálózatot' },
      { tipus: 'rip', eszkoz: 'R2', verzio: 2, halozatok: ['192.168.{L2}.0', '10.0.0.0'], passziv: ['GigabitEthernet0/0/0'], autoSummary: false,
        szoveg: 'R2: RIPv2 a belső hálózatokon, passzív LAN-interfész, automatikus összegzés nélkül' },
      { tipus: 'rip', eszkoz: 'R3', verzio: 2, halozatok: ['172.16.0.0', '10.0.0.0'], passziv: ['GigabitEthernet0/0/0'], autoSummary: false,
        szoveg: 'R3: RIPv2 a belső hálózatokon, passzív LAN-interfész, automatikus összegzés nélkül' },
      { tipus: 'utvonal', eszkoz: 'R2', halozat: '172.16.{L1}.0/24', kod: 'R', szoveg: 'R2 RIP-ből ismeri LAN1-et (172.16.{L1}.0/24)' },
      { tipus: 'utvonal', eszkoz: 'R2', halozat: '172.16.{L3}.0/24', kod: 'R', szoveg: 'R2 RIP-ből ismeri LAN3-at (172.16.{L3}.0/24)' },
      { tipus: 'utvonal', eszkoz: 'R2', halozat: '172.16.0.0/16', nincs: true, ellenproba: true,
        szoveg: 'R2 táblájában nincs összevont 172.16.0.0/16 útvonal' },
      { tipus: 'utvonal', eszkoz: 'R2', halozat: '203.0.113.0/30', nincs: true, ellenproba: true,
        szoveg: 'Az internet felé néző hálózat nem szivárgott be R2 táblájába' },
      // --- alapértelmezett útvonal ---
      { tipus: 'utvonal', eszkoz: 'R1', halozat: '0.0.0.0/0', kod: 'S', szoveg: 'R1: statikus alapértelmezett útvonal az ISP felé' },
      { tipus: 'utvonal', eszkoz: 'R2', halozat: '0.0.0.0/0', kod: 'R', szoveg: 'R2 RIP-ből kapta meg az alapértelmezett útvonalat' },
      { tipus: 'utvonal', eszkoz: 'R3', halozat: '0.0.0.0/0', kod: 'R', szoveg: 'R3 RIP-ből kapta meg az alapértelmezett útvonalat' },
      // --- RIPng ---
      { tipus: 'ripng', eszkoz: 'R1', interfeszek: ['GigabitEthernet0/0/0', 'GigabitEthernet0/0/1', 'Serial0/1/0'],
        alapUtvonal: { 'GigabitEthernet0/0/1': 'originate', 'Serial0/1/0': 'originate' },
        szoveg: 'R1: RIPng a belső interfészeken, a ::/0 hirdetésével R2 és R3 felé' },
      { tipus: 'ripng', eszkoz: 'R1', nemInterfeszek: ['Serial0/1/1'], ellenproba: true, szoveg: 'R1: az ISP felé nem fut RIPng' },
      { tipus: 'ripng', eszkoz: 'R2', interfeszek: ['GigabitEthernet0/0/0', 'GigabitEthernet0/0/1', 'GigabitEthernet0/0/2'],
        szoveg: 'R2: RIPng mindhárom interfészen' },
      { tipus: 'ripng', eszkoz: 'R3', interfeszek: ['GigabitEthernet0/0/0', 'GigabitEthernet0/0/1', 'Serial0/1/0'],
        szoveg: 'R3: RIPng mindhárom interfészen' },
      { tipus: 'utvonal', eszkoz: 'R1', halozat: '::/0', kod: 'S', szoveg: 'R1: statikus IPv6 alapértelmezett útvonal az ISP felé' },
      { tipus: 'utvonal', eszkoz: 'R2', halozat: '::/0', kod: 'R', szoveg: 'R2 RIPng-ből kapta meg a ::/0 útvonalat' },
      { tipus: 'utvonal', eszkoz: 'R2', halozat: '2001:DB8:ACAD:{L3}::/64', kod: 'R', szoveg: 'R2 RIPng-ből ismeri LAN3 IPv6-hálózatát' },
      // --- metrika: a soros vonal újra működik, és a RIP (ugrásszám alapján) azt választja ---
      { tipus: 'utvonal', eszkoz: 'R1', halozat: '172.16.{L3}.0/24', kod: 'R', port: 'Serial0/1/0',
        szoveg: 'R1 a kevesebb ugrásos (soros) úton éri el LAN3-at – a soros vonal újra működik' },
      // --- próbák ---
      { tipus: 'ping', honnan: 'PC1', ip: '192.168.{L2}.10', szoveg: 'PC1 → PC2 ping' },
      { tipus: 'ping', honnan: 'PC2', ip: '172.16.{L1}.10', db: 3, szoveg: 'PC2 → PC1 ping, többször egymás után is' },
      { tipus: 'ping', honnan: 'PC2', ip: '172.16.{L3}.10', db: 3, szoveg: 'PC2 → PC3 ping, többször egymás után is' },
      { tipus: 'ping', honnan: 'PC2', ip: '198.51.100.1', szoveg: 'PC2 → internet (198.51.100.1) ping' },
      { tipus: 'ping', honnan: 'PC3', ip: '198.51.100.1', szoveg: 'PC3 → internet (198.51.100.1) ping' },
      { tipus: 'ping', honnan: 'PC1', ip: '2001:DB8:ACAD:{L3}::10', szoveg: 'PC1 → PC3 IPv6-ping' },
      { tipus: 'ping', honnan: 'PC2', ip: '2001:DB8:FFFF::1', szoveg: 'PC2 → internet (2001:DB8:FFFF::1) IPv6-ping' },
      { tipus: 'ping', honnan: 'PC3', ip: '2001:DB8:FFFF::1', szoveg: 'PC3 → internet (2001:DB8:FFFF::1) IPv6-ping' },
    ],
    bemutato: [
      {
        hol: 'eszkoz', eszkoz: 'R1',
        szoveg: 'Kezdjük R1-gyel: kattints rá a rajzon (vagy fent az R1 fülre).',
        miert: 'R1 a határrouter: a LAN1, a két belső link és az internet felé néző soros vonal mind rajta van.',
        kesz: { tipus: 'kivalasztva', eszkoz: 'R1' },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'Nézd meg a kiinduló állapotot: `enable`, majd `show ip interface brief` és `show ip route`.',
        miert: 'Minden interfész up/up, a címek megvannak. A routing táblában viszont csak C (connected) és L (local) sorok vannak: '
          + 'R1 csak a saját hálózatait ismeri, a 192.168.{L2}.0 és a 172.16.{L3}.0 hálózatról nem tud.',
        be: ['enable', 'show ip interface brief', 'show ip route'],
        kesz: { tipus: 'parancs', eszkoz: 'R1', szavak: ['show', 'ip', 'route'] },
      },
      {
        hol: 'terminal', eszkoz: 'PC1',
        szoveg: 'Próbáld ki PC1-ről: `ping 192.168.{L2}.10`.',
        miert: 'Nem megy: R1 visszaszól, hogy nem ismeri a célhálózatot (Destination net unreachable). Forgalomirányítás nélkül '
          + 'a routerek csak a közvetlenül kapcsolt hálózatokat érik el.',
        be: ['ping 192.168.{L2}.10'],
        kesz: { tipus: 'parancs', eszkoz: 'PC1', szavak: ['ping'] },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'Indítsd el a RIP-et R1-en: `configure terminal`, `router rip`, `version 2`.',
        miert: 'A `router rip` után a prompt `R1(config-router)#` lesz: itt vannak a RIP beállításai. A `version 2` nélkül a router '
          + '1-es verziót küldene (az nem visz alhálózati maszkot).',
        be: ['configure terminal', 'router rip', 'version 2'],
        kesz: { tipus: 'rip', eszkoz: 'R1', verzio: 2 },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'Add meg a hálózatokat: `network 172.16.0.0`, `network 10.0.0.0`, és a LAN felé: `passive-interface g0/0/0`.',
        miert: 'A `network` két dolgot csinál: bekapcsolja a RIP-et az ide tartozó interfészeken, és hirdeti azok hálózatait. '
          + 'Osztályos címet vár, ezért a 10.1.12.0 és a 10.1.13.0 linkhez egyetlen `network 10.0.0.0` elég. A 203.0.113.0 '
          + '(ISP) kimarad. A passzív LAN-interfészen nem megy ki frissítés, de a LAN hálózatát továbbra is hirdeti.',
        be: ['network 172.16.0.0', 'network 10.0.0.0', 'passive-interface g0/0/0'],
        kesz: { tipus: 'rip', eszkoz: 'R1', verzio: 2, halozatok: ['172.16.0.0', '10.0.0.0'], passziv: ['GigabitEthernet0/0/0'] },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'Ellenőrizd: `do show ip protocols`.',
        miert: 'Itt látszik a verzió (send version 2, receive version 2), a „Routing for Networks” lista, a passzív interfész – '
          + 'és hogy az automatikus összegzés be van kapcsolva („in effect”). Ez mindjárt gondot okoz.',
        be: ['do show ip protocols'],
        kesz: { tipus: 'parancs', eszkoz: 'R1', szavak: ['show', 'ip', 'protocols'] },
      },
      {
        hol: 'terminal', eszkoz: 'R2',
        szoveg: 'R2-n ugyanez: `en`, `conf t`, `router rip`, `vers 2`, `net 192.168.{L2}.0`, `net 10.0.0.0`, `pass g0/0/0`.',
        miert: 'R2 LAN-ja a 192.168.{L2}.0, a két belső linkje (10.1.12.0 és 10.1.23.0) a 10.0.0.0 osztályos hálózatba tartozik. '
          + 'A parancsok rövidíthetők, amíg egyértelműek.',
        be: ['en', 'conf t', 'router rip', 'vers 2', 'net 192.168.{L2}.0', 'net 10.0.0.0', 'pass g0/0/0'],
        kesz: { tipus: 'rip', eszkoz: 'R2', verzio: 2, halozatok: ['192.168.{L2}.0', '10.0.0.0'], passziv: ['GigabitEthernet0/0/0'] },
      },
      {
        hol: 'terminal', eszkoz: 'R3',
        szoveg: 'R3-on is: `en`, `conf t`, `router rip`, `vers 2`, `net 172.16.0.0`, `net 10.0.0.0`, `pass g0/0/0`.',
        miert: 'R3 LAN-ja (172.16.{L3}.0) ugyanabba az osztályos hálózatba (172.16.0.0) esik, mint R1-é – ez lesz a csapda.',
        be: ['en', 'conf t', 'router rip', 'vers 2', 'net 172.16.0.0', 'net 10.0.0.0', 'pass g0/0/0'],
        kesz: { tipus: 'rip', eszkoz: 'R3', verzio: 2, halozatok: ['172.16.0.0', '10.0.0.0'], passziv: ['GigabitEthernet0/0/0'] },
      },
      {
        hol: 'terminal', eszkoz: 'R2',
        szoveg: 'Nézd meg R2 routing tábláját: `do show ip route`.',
        miert: 'Nincs benne 172.16.{L1}.0/24 és 172.16.{L3}.0/24, csak egy összevont 172.16.0.0/16 – ráadásul két úton (R1 és R3 felé is), '
          + 'egyenlő költséggel. R1 és R3 is az egész 172.16.0.0/16-ot hirdeti, mert az osztályhatáron (a 10.x linkek felé) összevonják az alhálózataikat.',
        be: ['do show ip route'],
        kesz: { tipus: 'parancs', eszkoz: 'R2', szavak: ['show', 'ip', 'route'] },
      },
      {
        hol: 'terminal', eszkoz: 'PC2',
        szoveg: 'Próbáld ki PC2-ről: `ping 172.16.{L1}.10`.',
        miert: 'Hol megy, hol nem: R2 felváltva küldi a csomagokat a két úton, és a rossz irányba (R3 felé) küldött csomag nem ér célba. '
          + 'A két 172.16-os LAN nem összefüggő (10.x linkek választják el őket), ezért nem szabad összevonni őket.',
        be: ['ping 172.16.{L1}.10'],
        kesz: { tipus: 'parancs', eszkoz: 'PC2', szavak: ['ping'] },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'Kapcsold ki az automatikus összegzést R1-en: `no auto-summary`.',
        miert: 'R1 még a RIP almódjában van. A `no auto-summary` után a pontos alhálózatokat hirdeti, maszkkal együtt '
          + '(a RIPv2 ezt tudja – ezért kellett a 2-es verzió).',
        be: ['no auto-summary'],
        kesz: { tipus: 'rip', eszkoz: 'R1', autoSummary: false },
      },
      {
        hol: 'terminal', eszkoz: 'R2',
        szoveg: 'R2-n is: `no auto-summary`.',
        miert: 'Mindhárom routeren ki kell kapcsolni – R2 ugyan nem határon áll a 172.16 felé, de a saját 192.168-as hálózatát '
          + 'és a 10.x linkeket is összevonná.',
        be: ['no auto-summary'],
        kesz: { tipus: 'rip', eszkoz: 'R2', autoSummary: false },
      },
      {
        hol: 'terminal', eszkoz: 'R3',
        szoveg: 'R3-on is: `no auto-summary`.',
        miert: 'R3 is a 172.16.0.0/16 egészét hirdette a 10.x linkek felé.',
        be: ['no auto-summary'],
        kesz: { tipus: 'rip', eszkoz: 'R3', autoSummary: false },
      },
      {
        hol: 'terminal', eszkoz: 'R2',
        szoveg: 'Töröld R2-n a régi, tanult útvonalakat, és nézd meg újra: `end`, `clear ip route *`, majd `show ip route`.',
        miert: 'A `clear ip route *` után a router azonnal újra megkérdezi a szomszédokat, így nem kell kivárni, hogy a régi /16-os '
          + 'útvonal lejárjon. Most már ott van a 172.16.{L1}.0 (R1 felé) és a 172.16.{L3}.0 (R3 felé), külön-külön.',
        be: ['end', 'clear ip route *', 'show ip route'],
        kesz: [
          { tipus: 'utvonal', eszkoz: 'R2', halozat: '172.16.{L1}.0/24', kod: 'R' },
          { tipus: 'utvonal', eszkoz: 'R2', halozat: '172.16.{L3}.0/24', kod: 'R' },
          { tipus: 'utvonal', eszkoz: 'R2', halozat: '172.16.0.0/16', nincs: true },
          // A „nézd meg” lépés: a RIP magától is frissít, ezért a parancs nélkül ez a lépés észrevétlenül átugródna.
          { tipus: 'parancs', eszkoz: 'R2', szavak: ['show', 'ip', 'route'] },
        ],
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'Alapértelmezett útvonal R1-en az ISP felé: `ip route 0.0.0.0 0.0.0.0 203.0.113.1`, majd terjeszd: `router rip`, `default-information originate`.',
        miert: 'A 0.0.0.0/0 minden címre illik – oda megy, amit a router másképp nem ismer. A `default-information originate` '
          + 'miatt R1 ezt a RIP-pel a többi routernek is elhirdeti; ott R* (RIP-ből tanult, „candidate default”) kóddal jelenik meg.',
        be: ['ip route 0.0.0.0 0.0.0.0 203.0.113.1', 'router rip', 'default-information originate'],
        kesz: [
          { tipus: 'utvonal', eszkoz: 'R1', halozat: '0.0.0.0/0', kod: 'S' },
          { tipus: 'rip', eszkoz: 'R1', alapUtvonal: true },
        ],
      },
      {
        hol: 'terminal', eszkoz: 'R3',
        szoveg: 'Nézd meg R3-on: `do show ip route`.',
        miert: 'R* 0.0.0.0/0 [120/1] a soros vonalon (Serial0/1/0): R3 internetforgalma a lassú vonalon megy, mert az csak 1 ugrás. '
          + 'Fent: „Gateway of last resort is 10.1.13.1”.',
        be: ['do show ip route'],
        kesz: [
          { tipus: 'utvonal', eszkoz: 'R3', halozat: '0.0.0.0/0', kod: 'R' },
          { tipus: 'parancs', eszkoz: 'R3', szavak: ['show', 'ip', 'route'] },
        ],
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'Jöhet az IPv6! Próbáld R1-en: `ipv6 router rip RIPNG`.',
        miert: 'Hibát kapsz („IPv6 routing not enabled”): a router gyárilag nem továbbít IPv6-csomagokat.',
        be: ['ipv6 router rip RIPNG'],
        kesz: { tipus: 'parancs', eszkoz: 'R1', szavak: ['ipv6', 'router', 'rip'] },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'Kapcsold be: `ipv6 unicast-routing`, majd újra: `ipv6 router rip RIPNG`.',
        miert: 'A folyamatnév (RIPNG) csak ezen a routeren számít, a szomszédoknak nem kell egyeznie.',
        be: ['ipv6 unicast-routing', 'ipv6 router rip RIPNG'],
        kesz: { tipus: 'ipv6-routing', eszkoz: 'R1' },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'A RIPng-ben nincs network parancs: interfészenként kapcsold be. `interface g0/0/0`, `ipv6 rip RIPNG enable`, '
          + 'majd ugyanez `interface g0/0/1` és `interface s0/1/0` alatt.',
        miert: 'Pontosan az az interfész kerül a RIPng-be, amelyiken bekapcsolod. Az ISP felé (S0/1/1) nem kapcsoljuk be.',
        be: ['interface g0/0/0', 'ipv6 rip RIPNG enable', 'interface g0/0/1', 'ipv6 rip RIPNG enable', 'interface s0/1/0', 'ipv6 rip RIPNG enable'],
        kesz: { tipus: 'ripng', eszkoz: 'R1', interfeszek: ['GigabitEthernet0/0/0', 'GigabitEthernet0/0/1', 'Serial0/1/0'] },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'A belső routerek felé a ::/0 hirdetése: `interface g0/0/1`, `ipv6 rip RIPNG default-information originate`, '
          + 'ugyanez `interface s0/1/0` alatt; végül `exit` és `ipv6 route ::/0 2001:DB8:FEED:1::1`.',
        miert: 'A RIPng-ben az alapértelmezett útvonal hirdetése interfész-beállítás. A statikus ::/0 az ISP felé viszi az IPv6-forgalmat.',
        be: ['interface g0/0/1', 'ipv6 rip RIPNG default-information originate', 'interface s0/1/0',
          'ipv6 rip RIPNG default-information originate', 'exit', 'ipv6 route ::/0 2001:DB8:FEED:1::1'],
        kesz: [
          { tipus: 'ripng', eszkoz: 'R1', alapUtvonal: { 'GigabitEthernet0/0/1': 'originate', 'Serial0/1/0': 'originate' } },
          { tipus: 'utvonal', eszkoz: 'R1', halozat: '::/0', kod: 'S' },
        ],
      },
      {
        hol: 'terminal', eszkoz: 'R2',
        szoveg: 'R2: `conf t`, `ipv6 unicast-routing`, `ipv6 router rip RIPNG`, majd egyszerre a három interfész: '
          + '`interface range g0/0/0 - 2`, `ipv6 rip RIPNG enable`.',
        miert: 'Az `interface range` több interfészt állít be egyszerre – itt R2 mindhárom portját.',
        be: ['conf t', 'ipv6 unicast-routing', 'ipv6 router rip RIPNG', 'interface range g0/0/0 - 2', 'ipv6 rip RIPNG enable'],
        kesz: { tipus: 'ripng', eszkoz: 'R2', interfeszek: ['GigabitEthernet0/0/0', 'GigabitEthernet0/0/1', 'GigabitEthernet0/0/2'] },
      },
      {
        hol: 'terminal', eszkoz: 'R3',
        szoveg: 'R3: `ipv6 unicast-routing`, `ipv6 router rip RIPNG`, `interface range g0/0/0 - 1`, `ipv6 rip RIPNG enable`, '
          + 'majd `interface s0/1/0`, `ipv6 rip RIPNG enable`.',
        miert: 'R3 még konfigurációs módban van, ezért itt nem kell a `conf t`.',
        be: ['ipv6 unicast-routing', 'ipv6 router rip RIPNG', 'interface range g0/0/0 - 1', 'ipv6 rip RIPNG enable', 'interface s0/1/0', 'ipv6 rip RIPNG enable'],
        kesz: { tipus: 'ripng', eszkoz: 'R3', interfeszek: ['GigabitEthernet0/0/0', 'GigabitEthernet0/0/1', 'Serial0/1/0'] },
      },
      {
        hol: 'terminal', eszkoz: 'R2',
        szoveg: 'Nézd meg R2 IPv6-os routing tábláját: `do show ipv6 route`.',
        miert: 'A következő ugrás itt link-local cím (FE80::1, FE80::3): a RIPng a frissítéseket link-local címről küldi. '
          + 'A szomszédos LAN metrikája 2 (RIPv2-ben 1 volt) – a RIPng a kapott metrikához ad hozzá egyet.',
        be: ['do show ipv6 route'],
        kesz: [
          { tipus: 'utvonal', eszkoz: 'R2', halozat: '::/0', kod: 'R' },
          { tipus: 'utvonal', eszkoz: 'R2', halozat: '2001:DB8:ACAD:{L1}::/64', kod: 'R' },
          { tipus: 'parancs', eszkoz: 'R2', szavak: ['show', 'ipv6', 'route'] },
        ],
      },
      {
        hol: 'terminal', eszkoz: 'PC1',
        szoveg: 'Merre megy a PC1 → PC3 forgalom? `tracert 172.16.{L3}.10`',
        miert: 'A második ugrás 10.1.13.2: a soros vonalon megy (nagyobb idő – a vonal lassú). A RIP csak az ugrásokat számolja: '
          + 'a soros úton R3 1 ugrás, R2-n át 2. A sávszélességet nem nézi.',
        be: ['tracert 172.16.{L3}.10'],
        kesz: { tipus: 'parancs', eszkoz: 'PC1', szavak: ['tracert'] },
      },
      {
        hol: 'terminal', eszkoz: 'R2',
        szoveg: 'Kapcsold be R2-n a RIP üzeneteinek kiírását: `do debug ip rip`.',
        miert: 'Ettől kezdve R2 konzolján megjelenik minden küldött és fogadott RIP-frissítés (30 másodpercenként, és változáskor azonnal).',
        be: ['do debug ip rip'],
        kesz: { tipus: 'parancs', eszkoz: 'R2', szavak: ['debug', 'ip', 'rip'] },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'Most „vágd el” a soros vonalat: `interface s0/1/0`, `shutdown`. Várj kb. fél percet, közben nézd R2 konzolját, majd R1-en: `do show ip route`.',
        miert: 'R1 azonnal szól (triggered update): R2 debugjában a 10.1.13.0/30 és a 172.16.{L3}.0/24 „16 hops” – ez a route poisoning '
          + '(16 = elérhetetlen). R2 következő frissítéséből R1 megtanulja az új utat: 172.16.{L3}.0/24 [120/2] R2 felé.',
        be: ['interface s0/1/0', 'shutdown'],
        kesz: { tipus: 'utvonal', eszkoz: 'R1', halozat: '172.16.{L3}.0/24', kod: 'R', port: 'GigabitEthernet0/0/1' },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'Kapcsold vissza: `no shutdown`, majd pár másodperc múlva `do show ip route`.',
        miert: 'Amikor a vonal feljön, R1 megkéri R3-at, hogy küldje el a tábláját – így gyorsan visszaáll a soros út (1 ugrás).',
        be: ['no shutdown'],
        kesz: { tipus: 'utvonal', eszkoz: 'R1', halozat: '172.16.{L3}.0/24', kod: 'R', port: 'Serial0/1/0' },
      },
      {
        hol: 'terminal', eszkoz: 'R2',
        szoveg: 'Kapcsold ki R2-n a debugot: `do undebug all`.',
        miert: 'A debug sok üzenetet ír; valódi eszközön (főleg éles hálózatban) mindig kapcsold ki, ha már nem kell.',
        be: ['do undebug all'],
        kesz: { tipus: 'parancs', eszkoz: 'R2', szavak: ['undebug', 'all'] },
      },
      {
        hol: 'ellenorzes',
        szoveg: 'Kész vagy! Nyomd meg az Ellenőrzés gombot.',
        miert: 'A szimulátor megnézi a beállításokat és a routing táblákat, és valódi pingeket küld IPv4-en és IPv6-on is.',
        kesz: { tipus: 'ellenorzes' },
      },
    ],
    magyarazat: [
      {
        cim: 'Mit csinál a RIP?',
        szoveg: [
          'A RIP távolságvektor-alapú protokoll: a router nem ismeri a teljes hálózatot, csak azt, amit a szomszédai mondanak neki '
            + '(„ezt a hálózatot ennyi ugrásból érem el”). Ezt hívják „routing by rumor”-nak, pletykán alapuló forgalomirányításnak.',
          [
            'Metrika: az ugrások (hop) száma. A maximum 15, a 16 jelentése „elérhetetlen” – ezért a RIP csak kis hálózatokba való.',
            'Adminisztratív távolság: 120 (az OSPF-é 110, a statikus útvonalé 1 – ezek „erősebbek”).',
            '30 másodpercenként elküldi a teljes tábláját a szomszédoknak, akkor is, ha semmi nem változott.',
            'Egyenlő költségű utak között megosztja a forgalmat (Cisco-n alapból legfeljebb 4 út).',
          ],
        ],
      },
      {
        cim: 'A network parancs és a passzív interfész',
        szoveg: [
          'A `network` osztályos hálózatot vár (A: /8, B: /16, C: /24), és két dolgot csinál: bekapcsolja a RIP-et az ide tartozó '
            + 'interfészeken, és hirdeti azok hálózatait. Ha valaki `network 10.1.12.0`-t ír, a router `network 10.0.0.0`-ként tárolja.',
          'Miért osztályos, ha a RIPv2 osztály nélküli? A `network` csak azt dönti el, melyik interfészen fusson a protokoll – ezt a '
            + 'RIPv1-től örökölte. A frissítésekben a RIPv2 már a valódi maszkot küldi.',
          'A `passive-interface` interfészén nem megy ki frissítés, de a hálózatát a router továbbra is hirdeti. A LAN felé ajánlott: '
            + 'ott nincs másik router, a frissítések csak feleslegesen terhelnék a gépeket, és egy támadó belelátna a hálózat felépítésébe.',
          'R1 a 203.0.113.0-s (ISP felé néző) hálózatot szándékosan nem hirdeti: különben frissítéseket küldene a szolgáltató felé, '
            + 'kiszivárogtatva a belső hálózat felépítését. Az internet elérését nem ez adja, hanem az alapértelmezett útvonal.',
        ],
      },
      {
        cim: 'Miért kell a no auto-summary?',
        szoveg: [
          'Az automatikus összegzés az osztályhatáron összevonja az alhálózatokat: R1 és R3 a 10.x linkek felé nem a 172.16.{L1}.0/24-et '
            + 'és a 172.16.{L3}.0/24-et hirdeti, hanem mindketten a teljes 172.16.0.0/16-ot. R2 így két egyenlő költségű utat kap ugyanarra '
            + 'a /16-ra, és nem tudja, melyik /24 merre van.',
          'A 172.16.0.0 osztályos hálózat két darabja „nem összefüggő” (discontiguous): egy másik hálózat (a 10.x linkek) választja el '
            + 'őket. Ilyenkor a `no auto-summary` kötelező – mindhárom routeren.',
          'A szimulátor a valódi eszközt követi: R2-n két egyenlő költségű 172.16.0.0/16 útvonal jelenik meg, és R2 felváltva használja '
            + 'őket, ezért a ping hol megy, hol nem. (Valódi routeren a forgalommegosztás általában célcímenként történik: ott inkább '
            + 'az látszik, hogy az egyik LAN elérhető, a másik nem.) A Packet Tracer itt mást mutat: ott a /16 metrikája körbe-körbe '
            + 'nő 16-ig (count to infinity), és a forgalom kerülőúton megy.',
        ],
      },
      {
        cim: 'Alapértelmezett útvonal terjesztése',
        szoveg: [
          'R1 statikus alapértelmezett útvonala (`ip route 0.0.0.0 0.0.0.0 203.0.113.1`) csak R1-en érvényes. A `default-information originate` '
            + 'miatt R1 a RIP-pel elhirdeti a többieknek is: náluk R* 0.0.0.0/0 jelenik meg, és „Gateway of last resort” lesz.',
          'R3 internetforgalma a lassú soros vonalon megy, mert az 1 ugrás – a RIP itt sem nézi a sávszélességet.',
        ],
      },
      {
        cim: 'RIPng: ugyanaz IPv6-ra, néhány különbséggel',
        szoveg: [
          'Ugyanaz az elv: ugrásszám, 15-ös maximum, 120-as AD, 30 másodperces frissítés, split horizon. Ami más:',
          [
            'UDP 521-es port, a csoportcím FF02::9 (RIPv2-ben UDP 520 és 224.0.0.9).',
            'A frissítések forrása és a következő ugrás link-local cím (FE80::…) – ezért egyértelmű a kézzel beállított FE80::1/2/3.',
            'Nincs network parancs: interfészenként kell bekapcsolni (`ipv6 rip NÉV enable`). Előfeltétel az `ipv6 unicast-routing`.',
            'Nincs automatikus összegzés (IPv6-ban nincsenek osztályok), és nincs saját hitelesítés.',
            'Cisco-n nincs passzív interfész RIPng-hez: a LAN felé is mennek frissítések.',
            'A metrika: a RIPng a kapott metrikához ad hozzá egyet, ezért a szomszédos LAN 2 (RIPv2-ben 1).',
          ],
        ],
      },
      {
        cim: 'Metrika és konvergencia',
        szoveg: [
          'A RIP csak az ugrásokat számolja: R1-ről a 64 kbit/s-os soros vonalon R3 1 ugrás, a két gigabites linken át 2. '
            + 'Ezért a lassú utat választja. Egy sávszélességet figyelő protokoll (pl. OSPF) a gyorsabb utat választaná.',
          'Amikor a soros vonal kiesik, a RIP több módon védekezik a hurkok és a „végtelen számolás” ellen:',
          [
            'Triggered update: változáskor azonnal küld frissítést, nem várja meg a 30 másodpercet.',
            'Route poisoning: a kiesett hálózatot 16-os metrikával (elérhetetlen) hirdeti – ez látszik R2 debugjában.',
            'Split horizon: amit egy interfészen tanult, azt ott nem hirdeti vissza.',
            'Holddown: egy kiesett útvonalról egy ideig nem fogad el rosszabb hírt (a „possibly down” állapot).',
            'Maximum 15 ugrás: ez vágja el a végtelen számolást.',
          ],
          'A szimulátorban az idő valós: a 30 másodperces frissítést ki kell várni (a rajz alatti sebességállítóval gyorsítható).',
        ],
      },
      {
        cim: 'A szimulátor és a Packet Tracer',
        szoveg: [
          'A routerek itt ISR 4331 jellegűek, ezért a portnevek háromrészesek (G0/0/0, S0/1/0); a Packet Tracer-es feladatlapon G0/0, S0/0/0 alakú nevek szerepelnek.',
          'A `show ipv6 route rip` és a `show ipv6 rip` itt működik (a Packet Tracer nem ismeri őket).',
        ],
      },
      {
        cim: 'Próbáld ki!',
        szoveg: [[
          'Kapcsold vissza R2-n az automatikus összegzést (`auto-summary`), és figyeld a táblákat.',
          'R1-en `debug ip rip`: nézd meg, mit küld a passzív LAN-interfészen (semmit) és a többin.',
          'R3-on `show ipv6 rip database`: melyik útvonal van „installed” állapotban, és miért?',
          'Kapcsold le R2 G0/0/2 interfészét, és nézd meg PC2-ről a `tracert 172.16.{L3}.10` eredményét.',
        ]],
      },
    ],
  });
}(typeof window !== 'undefined' ? window : globalThis));
