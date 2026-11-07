/*
 * Haloszim feladat: Dinamikus forgalomirányítás – OSPFv3 IPv6-on (ospf-2)
 *
 * Ugyanaz a háromszög-topológia, mint az ospf-1-ben, de csak IPv6-címekkel. A routereknek nincs
 * IPv4-címük, ezért az OSPFv3 nem tud magától router ID-t választani – kézzel kell megadni.
 * A klasszikus parancsformát használjuk (ipv6 router ospf 1, az interfészen ipv6 ospf 1 area 0).
 * A beépített hiba: R3 R2 felé néző interfészén kisebb az IPv6 MTU, ezért a szomszédság
 * beragad (EXSTART / EXCHANGE).
 *
 * A feladatfájl felépítése: lásd feladatok/ospf-1.js. A céltípusokban „csalad: 6” jelzi az OSPFv3-at.
 * Véletlen változatban a LAN-ok IPv6-alhálózatának száma változik.
 */
(function (g) {
  (g.HaloszimFeladatok = g.HaloszimFeladatok || []).push({
    azon: 'ospf-2',
    tipus: 'Dinamikus routing',
    cim: 'OSPFv3 (IPv6)',
    szint: 'haladó',
    ipv6: true,
    valtozok: {
      L1: { tipus: 'szam', alap: 1, min: 30, max: 99 },
      L2: { tipus: 'szam', alap: 2, min: 30, max: 99, kulonbozik: ['L1'] },
      L3: { tipus: 'szam', alap: 3, min: 30, max: 99, kulonbozik: ['L1', 'L2'] },
    },
    leiras: [
      'Ugyanaz a cég, ugyanaz a három telephely, mint az OSPF (IPv4) feladatban – de ez a hálózat már csak IPv6-ot használ. '
        + 'A routereknek és a gépeknek nincs IPv4-címük.',
      'A címek ki vannak osztva (a link-local címek kézzel: R1 = FE80::1, R2 = FE80::2, R3 = FE80::3), de a routerek még nem is '
        + 'továbbítanak IPv6-csomagokat. A feladat: OSPFv3 az Area 0-ban mindhárom routeren, kézi router ID-vel (R1 = 1.1.1.1, '
        + 'R2 = 2.2.2.2, R3 = 3.3.3.3), hogy minden LAN elérje a többit és az internetet (2001:DB8:FFFF::1).',
      'Ha valamelyik szomszédság nem jut el a FULL állapotig, derítsd ki, miért!',
    ],
    lepesek: [
      {
        cel: 'Vizsgáld meg a kiinduló állapotot: a routerek IPv6-címeit és IPv6-os routing tábláját, és győződj meg róla, hogy a LAN-ok még nem érik el egymást.',
        parancsok: 'Mindhárom routeren: `show ipv6 interface brief`, `show ipv6 route`; PC1-en: `ping 2001:DB8:ACAD:{L2}::10`',
        tippek: [
          'A show parancsok privilegizált módban (`enable` után) futnak.',
          'A router gyárilag nem továbbít IPv6-csomagokat – ezt a routing tábla még nem mutatja, de a ping igen.',
        ],
      },
      {
        cel: 'Kapcsold be az IPv6-továbbítást, és indítsd el az OSPFv3-at mindhárom routeren a megadott router ID-vel. A router mindhárom belső interfésze (a két routerek közötti link és a LAN) kerüljön az Area 0-ba; az ISP felé néző interfész ne.',
        parancsok: '`ipv6 unicast-routing`, `ipv6 router ospf 1` (NORTRID-üzenet!), `router-id 1.1.1.1` (R2: 2.2.2.2, R3: 3.3.3.3); '
          + 'interfészenként: `interface range g0/0/0 - 2`, `ipv6 ospf 1 area 0`',
        tippek: [
          'Az IPv6-továbbítás gyárilag ki van kapcsolva, és enélkül OSPFv3 sem indítható.',
          'A router ID az OSPFv3-ban is 32 bites, IPv4-cím alakú szám. IPv4-cím híján a router nem tud magának választani.',
          'Az OSPFv3-ban nincs network parancs: interfészenként kell bekapcsolni (több interfésznél jól jön az `interface range`).',
        ],
      },
      {
        cel: 'Hibakeresés: R2 és R3 szomszédsága nem jut el a FULL állapotig. Derítsd ki, mi az oka, és javítsd ki.',
        parancsok: 'R2 és R3: `show ipv6 ospf neighbor` (EXCHANGE / EXSTART), R3: `debug ipv6 ospf adj` („has larger interface MTU”), '
          + '`undebug all`, `show running-config` (`ipv6 mtu 1400`), javítás: `interface g0/0/1`, `no ipv6 mtu`',
        tippek: [
          'Nézd meg a szomszédság állapotát mindkét routeren: melyik állapotban ragadt?',
          'Ha a Hellók rendben vannak, de az adatbázis-csere nem fejeződik be, a két interfész valamelyik beállítása eltér – a szomszédság felépülésének hibakeresése (debug) a megfelelő oldalon megmutatja, melyik.',
          'Az interfész IPv6-beállításait a futó konfigurációban is megtalálod. A „no” alak visszaállítja az alapértéket.',
        ],
      },
      {
        cel: 'Mindhárom routeren: a LAN felé ne menjen Hello, és a referencia-sávszélesség 10 000 Mbit/s legyen.',
        parancsok: '`ipv6 router ospf 1`, `passive-interface g0/0/2`, `auto-cost reference-bandwidth 10000`; ellenőrzés: `show ipv6 ospf interface brief`',
        tippek: [
          'A passzív interfész az OSPFv3 beállításai között van, ugyanúgy, mint az IPv4-es OSPF-nél.',
          'A referencia-sávszélességet minden routeren ugyanarra kell állítani.',
        ],
      },
      {
        cel: 'R1 vegye fel az IPv6 alapértelmezett útvonalat az ISP felé, és az OSPFv3 hirdesse a többi routernek.',
        parancsok: 'R1-en: `ipv6 route ::/0 2001:DB8:FEED:1::1`, `ipv6 router ospf 1`, `default-information originate`; R2-n: `show ipv6 route` (OE2 ::/0)',
        tippek: [
          'Az ISP felé egy statikus ::/0 útvonal kell.',
          'Az OSPFv3-nak is külön meg kell mondani, hogy ezt hirdesse.',
        ],
      },
      {
        cel: 'Az R1–R3 linken ne legyen DR/BDR-választás (pont-pont, mindkét végén). Az R2–R3 szegmensen R3 legyen a DR.',
        parancsok: 'R1 G0/0/1 és R3 G0/0/0: `ipv6 ospf network point-to-point`; R3 G0/0/1: `ipv6 ospf priority 100`; R2-n: `clear ipv6 ospf process`, `yes`',
        tippek: [
          'A hálózattípus interfész-beállítás, a link mindkét végén meg kell adni.',
          'A DR-választás nem preemptív: a nagyobb prioritás csak akkor számít, ha új választás van.',
          'Új választást az indít, ha a jelenlegi DR-en újraindul az OSPF-folyamat.',
        ],
      },
      {
        cel: 'R1 a LAN2-t (2001:DB8:ACAD:{L2}::/64) ne a közvetlen R1–R2 linken, hanem R3-on keresztül érje el (az R1–R2 link költsége R1 felől legyen 50).',
        parancsok: 'R1: `interface g0/0/0`, `ipv6 ospf cost 50`, `do show ipv6 route ospf`; PC1-en: `tracert 2001:DB8:ACAD:{L2}::10`',
        tippek: [
          'Az OSPFv3 is a legkisebb összköltségű utat választja; a költség interfészenként kézzel is megadható.',
          'A költség csak a kimenő irányra hat.',
        ],
      },
    ],
    cimterv: [
      { eszkoz: 'R1', interfesz: 'G0/0/0', ipv6: '2001:DB8:ACAD:12::1/64', hova: 'R2 G0/0/0' },
      { eszkoz: 'R1', interfesz: 'G0/0/1', ipv6: '2001:DB8:ACAD:13::1/64', hova: 'R3 G0/0/0' },
      { eszkoz: 'R1', interfesz: 'G0/0/2', ipv6: '2001:DB8:ACAD:{L1}::1/64', hova: 'LAN1' },
      { eszkoz: 'R1', interfesz: 'S0/1/0', ipv6: '2001:DB8:FEED:1::2/64', hova: 'ISP' },
      { eszkoz: 'R2', interfesz: 'G0/0/0', ipv6: '2001:DB8:ACAD:12::2/64', hova: 'R1 G0/0/0' },
      { eszkoz: 'R2', interfesz: 'G0/0/1', ipv6: '2001:DB8:ACAD:23::1/64', hova: 'R3 G0/0/1' },
      { eszkoz: 'R2', interfesz: 'G0/0/2', ipv6: '2001:DB8:ACAD:{L2}::1/64', hova: 'LAN2' },
      { eszkoz: 'R3', interfesz: 'G0/0/0', ipv6: '2001:DB8:ACAD:13::2/64', hova: 'R1 G0/0/1' },
      { eszkoz: 'R3', interfesz: 'G0/0/1', ipv6: '2001:DB8:ACAD:23::2/64', hova: 'R2 G0/0/1' },
      { eszkoz: 'R3', interfesz: 'G0/0/2', ipv6: '2001:DB8:ACAD:{L3}::1/64', hova: 'LAN3' },
      { eszkoz: 'ISP', interfesz: 'S0/1/0', ipv6: '2001:DB8:FEED:1::1/64', hova: 'R1 S0/1/0' },
      { eszkoz: 'ISP', interfesz: 'Lo0', ipv6: '2001:DB8:FFFF::1/64', hova: '„internet”' },
      { eszkoz: 'PC1', interfesz: 'Fa0', ipv6: '2001:DB8:ACAD:{L1}::10/64', atjaro: 'FE80::1', hova: 'LAN1' },
      { eszkoz: 'PC2', interfesz: 'Fa0', ipv6: '2001:DB8:ACAD:{L2}::10/64', atjaro: 'FE80::2', hova: 'LAN2' },
      { eszkoz: 'PC3', interfesz: 'Fa0', ipv6: '2001:DB8:ACAD:{L3}::10/64', atjaro: 'FE80::3', hova: 'LAN3' },
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
        ['ISP', 'Serial0/1/0', 'R1', 'Serial0/1/0', { soros: true }],
        ['R1', 'GigabitEthernet0/0/2', 'PC1', 'FastEthernet0'],
        ['R1', 'GigabitEthernet0/0/0', 'R2', 'GigabitEthernet0/0/0'],
        ['R1', 'GigabitEthernet0/0/1', 'R3', 'GigabitEthernet0/0/0'],
        ['R2', 'GigabitEthernet0/0/1', 'R3', 'GigabitEthernet0/0/1'],
        ['R2', 'GigabitEthernet0/0/2', 'PC2', 'FastEthernet0'],
        ['R3', 'GigabitEthernet0/0/2', 'PC3', 'FastEthernet0'],
      ],
      feliratok: [
        { x: 412, y: 116, igazit: 'start', szoveg: '2001:DB8:FEED:1::/64' },
        { x: 470, y: 30, igazit: 'start', szoveg: 'Lo0: 2001:DB8:FFFF::1/64', halvany: true },
        { x: 268, y: 260, igazit: 'end', szoveg: '2001:DB8:ACAD:12::/64' },
        { x: 492, y: 260, igazit: 'start', szoveg: '2001:DB8:ACAD:13::/64' },
        { x: 380, y: 340, szoveg: '2001:DB8:ACAD:23::/64' },
        { x: 380, y: 372, szoveg: 'Area 0', halvany: true },
        { x: 100, y: 128, szoveg: 'LAN1: 2001:DB8:ACAD:{L1}::/64', halvany: true },
        { x: 150, y: 480, igazit: 'end', szoveg: 'LAN2\n2001:DB8:ACAD:{L2}::/64', halvany: true },
        { x: 610, y: 480, igazit: 'start', szoveg: 'LAN3\n2001:DB8:ACAD:{L3}::/64', halvany: true },
      ],
    },
    kiindulo: {
      ISP: {
        portok: {
          'Serial0/1/0': { ipv6: ['2001:DB8:FEED:1::1/64'], linkLocal: 'FE80::9' },
          Loopback0: { ipv6: ['2001:DB8:FFFF::1/64'] },
        },
        // A szolgáltató a cég címtartományát (2001:DB8:ACAD::/48) R1 felé küldi vissza.
        statikus6: [{ prefix: '2001:DB8:ACAD::/48', kovetkezo: '2001:DB8:FEED:1::2' }],
        ipv6Routing: true,
      },
      R1: {
        portok: {
          'GigabitEthernet0/0/0': { ipv6: ['2001:DB8:ACAD:12::1/64'], linkLocal: 'FE80::1', leiras: 'R2 fele' },
          'GigabitEthernet0/0/1': { ipv6: ['2001:DB8:ACAD:13::1/64'], linkLocal: 'FE80::1', leiras: 'R3 fele' },
          'GigabitEthernet0/0/2': { ipv6: ['2001:DB8:ACAD:{L1}::1/64'], linkLocal: 'FE80::1', leiras: 'LAN1' },
          'Serial0/1/0': { ipv6: ['2001:DB8:FEED:1::2/64'], linkLocal: 'FE80::1', leiras: 'ISP fele' },
        },
      },
      R2: {
        portok: {
          'GigabitEthernet0/0/0': { ipv6: ['2001:DB8:ACAD:12::2/64'], linkLocal: 'FE80::2', leiras: 'R1 fele' },
          'GigabitEthernet0/0/1': { ipv6: ['2001:DB8:ACAD:23::1/64'], linkLocal: 'FE80::2', leiras: 'R3 fele' },
          'GigabitEthernet0/0/2': { ipv6: ['2001:DB8:ACAD:{L2}::1/64'], linkLocal: 'FE80::2', leiras: 'LAN2' },
        },
      },
      R3: {
        portok: {
          'GigabitEthernet0/0/0': { ipv6: ['2001:DB8:ACAD:13::2/64'], linkLocal: 'FE80::3', leiras: 'R1 fele' },
          // A beépített hiba: kisebb IPv6 MTU (1400 bájt) ezen az interfészen.
          'GigabitEthernet0/0/1': { ipv6: ['2001:DB8:ACAD:23::2/64'], linkLocal: 'FE80::3', leiras: 'R2 fele', mtu6: 1400 },
          'GigabitEthernet0/0/2': { ipv6: ['2001:DB8:ACAD:{L3}::1/64'], linkLocal: 'FE80::3', leiras: 'LAN3' },
        },
      },
      PC1: { ipv6: '2001:DB8:ACAD:{L1}::10', ipv6Atjaro: 'FE80::1' },
      PC2: { ipv6: '2001:DB8:ACAD:{L2}::10', ipv6Atjaro: 'FE80::2' },
      PC3: { ipv6: '2001:DB8:ACAD:{L3}::10', ipv6Atjaro: 'FE80::3' },
    },
    celok: [
      // --- az OSPFv3-folyamatok ---
      { tipus: 'ipv6-routing', eszkoz: 'R1', szoveg: 'R1 továbbítja az IPv6-csomagokat' },
      { tipus: 'ospf', csalad: 6, eszkoz: 'R1', routerId: '1.1.1.1', interfeszek: ['GigabitEthernet0/0/0', 'GigabitEthernet0/0/1', 'GigabitEthernet0/0/2'], terulet: 0,
        passziv: ['GigabitEthernet0/0/2'], referencia: 10000, alapUtvonal: true,
        szoveg: 'R1: OSPFv3 1.1.1.1-es router ID-vel a három belső interfészen (Area 0), passzív LAN, referencia 10 000, ::/0 hirdetése' },
      { tipus: 'ospf', csalad: 6, eszkoz: 'R1', nemInterfeszek: ['Serial0/1/0'], ellenproba: true,
        szoveg: 'R1 az ISP felé néző interfészen nem futtat OSPFv3-at' },
      { tipus: 'ospf', csalad: 6, eszkoz: 'R2', routerId: '2.2.2.2', interfeszek: ['GigabitEthernet0/0/0', 'GigabitEthernet0/0/1', 'GigabitEthernet0/0/2'], terulet: 0,
        passziv: ['GigabitEthernet0/0/2'], referencia: 10000,
        szoveg: 'R2: OSPFv3 2.2.2.2-es router ID-vel, passzív LAN, referencia 10 000' },
      { tipus: 'ospf', csalad: 6, eszkoz: 'R3', routerId: '3.3.3.3', interfeszek: ['GigabitEthernet0/0/0', 'GigabitEthernet0/0/1', 'GigabitEthernet0/0/2'], terulet: 0,
        passziv: ['GigabitEthernet0/0/2'], referencia: 10000,
        szoveg: 'R3: OSPFv3 3.3.3.3-as router ID-vel, passzív LAN, referencia 10 000' },
      // --- szomszédságok ---
      { tipus: 'ospf-szomszed', csalad: 6, eszkoz: 'R1', szomszed: '2.2.2.2', port: 'GigabitEthernet0/0/0', allapot: 'FULL', szoveg: 'R1 és R2 szomszédsága FULL' },
      { tipus: 'ospf-szomszed', csalad: 6, eszkoz: 'R1', szomszed: '3.3.3.3', port: 'GigabitEthernet0/0/1', allapot: 'FULL', szerep: '-',
        szoveg: 'R1 és R3 szomszédsága FULL, pont-pont linken' },
      { tipus: 'ospf-szomszed', csalad: 6, eszkoz: 'R2', szomszed: '3.3.3.3', port: 'GigabitEthernet0/0/1', allapot: 'FULL', szerep: 'DR',
        szoveg: 'R2 és R3 szomszédsága FULL – a hiba javítva –, és R3 a DR' },
      { tipus: 'ospf-interfesz', csalad: 6, eszkoz: 'R1', port: 'GigabitEthernet0/0/1', halozatTipus: 'POINT_TO_POINT', szoveg: 'R1 G0/0/1: pont-pont hálózattípus' },
      { tipus: 'ospf-interfesz', csalad: 6, eszkoz: 'R3', port: 'GigabitEthernet0/0/0', halozatTipus: 'POINT_TO_POINT', szoveg: 'R3 G0/0/0: pont-pont hálózattípus' },
      { tipus: 'ospf-interfesz', csalad: 6, eszkoz: 'R3', port: 'GigabitEthernet0/0/1', prioritas: 100, allapot: 'DR', szoveg: 'R3 G0/0/1: prioritás 100, ő a DR' },
      { tipus: 'ospf-interfesz', csalad: 6, eszkoz: 'R1', port: 'GigabitEthernet0/0/0', koltseg: 50, szoveg: 'R1 G0/0/0 költsége 50' },
      // --- routing táblák ---
      { tipus: 'utvonal', eszkoz: 'R1', halozat: '2001:DB8:ACAD:{L2}::/64', kod: 'O', port: 'GigabitEthernet0/0/1',
        szoveg: 'R1 a LAN2-t R3-on át éri el (a drágább közvetlen link helyett)' },
      { tipus: 'utvonal', eszkoz: 'R2', halozat: '::/0', kod: 'O', szoveg: 'R2 OSPFv3-ból kapta meg a ::/0 útvonalat (OE2)' },
      { tipus: 'utvonal', eszkoz: 'R3', halozat: '::/0', kod: 'O', szoveg: 'R3 OSPFv3-ból kapta meg a ::/0 útvonalat (OE2)' },
      { tipus: 'utvonal', eszkoz: 'R2', halozat: '2001:DB8:FEED:1::/64', nincs: true, ellenproba: true,
        szoveg: 'Az internet felé néző hálózat nem szivárgott be R2 táblájába' },
      // --- próbák ---
      { tipus: 'ping', honnan: 'PC1', ip: '2001:DB8:ACAD:{L2}::10', szoveg: 'PC1 → PC2 IPv6-ping' },
      { tipus: 'ping', honnan: 'PC1', ip: '2001:DB8:ACAD:{L3}::10', szoveg: 'PC1 → PC3 IPv6-ping' },
      { tipus: 'ping', honnan: 'PC2', ip: '2001:DB8:ACAD:{L3}::10', db: 3, szoveg: 'PC2 → PC3 IPv6-ping, többször egymás után is' },
      { tipus: 'ping', honnan: 'PC1', ip: '2001:DB8:FFFF::1', szoveg: 'PC1 → internet (2001:DB8:FFFF::1) IPv6-ping' },
      { tipus: 'ping', honnan: 'PC2', ip: '2001:DB8:FFFF::1', szoveg: 'PC2 → internet IPv6-ping' },
      { tipus: 'ping', honnan: 'PC3', ip: '2001:DB8:FFFF::1', szoveg: 'PC3 → internet IPv6-ping' },
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
        szoveg: 'Nézd meg a kiinduló állapotot: `enable`, majd `show ipv6 interface brief` és `show ipv6 route`.',
        miert: 'Minden interfésznek van link-local (FE80::1) és globális címe. A routing táblában csak C (connected) és L (local) sorok vannak. '
          + 'IPv4-címe nincs a routernek: a `show ip interface brief` mindenhol „unassigned”-et mutatna.',
        be: ['enable', 'show ipv6 interface brief', 'show ipv6 route'],
        kesz: { tipus: 'parancs', eszkoz: 'R1', szavak: ['show', 'ipv6', 'route'] },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'Indítsd el az OSPFv3-at: `configure terminal`, `ipv6 router ospf 1`.',
        miert: 'Hibát kapsz („IPv6 routing not enabled”): a router gyárilag nem továbbít IPv6-csomagokat, és addig OSPFv3 sem indulhat.',
        be: ['configure terminal', 'ipv6 router ospf 1'],
        kesz: { tipus: 'parancs', eszkoz: 'R1', szavak: ['ipv6', 'router', 'ospf'] },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'Kapcsold be az IPv6-továbbítást, és próbáld újra: `ipv6 unicast-routing`, `ipv6 router ospf 1`.',
        miert: 'A prompt `R1(config-rtr)#` lett – de a konzolon megjelenik a `%OSPFv3-4-NORTRID` üzenet: a router nem tud router ID-t '
          + 'választani. A router ID az OSPFv3-ban is IPv4-cím alakú, és magától egy IPv4-címből választaná – ennek a routernek viszont nincs ilyenje.',
        be: ['ipv6 unicast-routing', 'ipv6 router ospf 1'],
        kesz: { tipus: 'ipv6-routing', eszkoz: 'R1' },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'Add meg kézzel: `router-id 1.1.1.1`.',
        miert: 'Ez csak egy 32 bites azonosító, nem kell létező címnek lennie. IPv6-only hálózatban kötelező kézzel megadni.',
        be: ['router-id 1.1.1.1'],
        kesz: { tipus: 'ospf', csalad: 6, eszkoz: 'R1', routerId: '1.1.1.1' },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'Az OSPFv3-ban nincs network parancs: interfészenként kapcsold be. `interface range g0/0/0 - 2`, `ipv6 ospf 1 area 0`.',
        miert: 'Pontosan azok az interfészek kerülnek az OSPFv3-ba, amelyeken bekapcsolod – az ISP felé néző S0/1/0 kimarad.',
        be: ['interface range g0/0/0 - 2', 'ipv6 ospf 1 area 0'],
        kesz: { tipus: 'ospf', csalad: 6, eszkoz: 'R1', interfeszek: ['GigabitEthernet0/0/0', 'GigabitEthernet0/0/1', 'GigabitEthernet0/0/2'] },
      },
      {
        hol: 'terminal', eszkoz: 'R2',
        szoveg: 'R2-n ugyanez: `en`, `conf t`, `ipv6 unicast-routing`, `ipv6 router ospf 1`, `router-id 2.2.2.2`, `interface range g0/0/0 - 2`, `ipv6 ospf 1 area 0`.',
        miert: 'Pár másodperc múlva R2 konzolján: `%OSPFv3-5-ADJCHG … Nbr 1.1.1.1 … from LOADING to FULL` – kész az R1–R2 szomszédság.',
        be: ['en', 'conf t', 'ipv6 unicast-routing', 'ipv6 router ospf 1', 'router-id 2.2.2.2', 'interface range g0/0/0 - 2', 'ipv6 ospf 1 area 0'],
        kesz: { tipus: 'ospf-szomszed', csalad: 6, eszkoz: 'R2', szomszed: '1.1.1.1', allapot: 'FULL' },
      },
      {
        hol: 'terminal', eszkoz: 'R3',
        szoveg: 'R3-on is: `en`, `conf t`, `ipv6 unicast-routing`, `ipv6 router ospf 1`, `router-id 3.3.3.3`, `interface range g0/0/0 - 2`, `ipv6 ospf 1 area 0`.',
        miert: 'R3 és R1 szomszédsága felépül (FULL) – R2-vel viszont nem jön a FULL üzenet.',
        be: ['en', 'conf t', 'ipv6 unicast-routing', 'ipv6 router ospf 1', 'router-id 3.3.3.3', 'interface range g0/0/0 - 2', 'ipv6 ospf 1 area 0'],
        kesz: { tipus: 'ospf-szomszed', csalad: 6, eszkoz: 'R3', szomszed: '1.1.1.1', allapot: 'FULL' },
      },
      {
        hol: 'terminal', eszkoz: 'R2',
        szoveg: 'Nézd meg R2 szomszédait: `do show ipv6 ospf neighbor`.',
        miert: 'R1 (1.1.1.1) FULL, de R3 (3.3.3.3) EXCHANGE állapotban ragadt: a Hellók rendben vannak (ezért látják egymást), de az '
          + 'adatbázis-csere nem fejeződik be. A szomszéd címe helyett itt az Interface ID látszik – az OSPFv3 link-local címekkel dolgozik.',
        be: ['do show ipv6 ospf neighbor'],
        kesz: { tipus: 'parancs', eszkoz: 'R2', szavak: ['show', 'ipv6', 'ospf', 'neighbor'] },
      },
      {
        hol: 'terminal', eszkoz: 'R3',
        szoveg: 'Nézd meg a másik oldalt, R3-at is: `do show ipv6 ospf neighbor`, majd kapcsold be a szomszédság hibakeresését: '
          + '`do debug ipv6 ospf adj`, és várj néhány másodpercet.',
        miert: 'R3 szerint R2 EXSTART állapotban van, és a debug ezt írja: „Nbr 2.2.2.2 has larger interface MTU”. Az adatbázis-leíró '
          + '(DBD) csomagban benne van az interfész MTU-ja; ha a szomszédé nagyobb, a router eldobja a csomagot. Az MTU-eltérés klasszikus '
          + 'tünete az EXSTART / EXCHANGE állapotban ragadás – és itt R3 MTU-ja a kisebb.',
        be: ['do show ipv6 ospf neighbor', 'do debug ipv6 ospf adj'],
        kesz: { tipus: 'parancs', eszkoz: 'R3', szavak: ['debug', 'ipv6', 'ospf', 'adj'] },
      },
      {
        hol: 'terminal', eszkoz: 'R3',
        szoveg: 'Kapcsold ki a debugot: `do undebug all`.',
        miert: 'Valódi eszközön (főleg éles hálózatban) mindig kapcsold ki a debugot, ha már nem kell.',
        be: ['do undebug all'],
        kesz: { tipus: 'parancs', eszkoz: 'R3', szavak: ['undebug', 'all'] },
      },
      {
        hol: 'terminal', eszkoz: 'R3',
        szoveg: 'Keresd meg R3-on: `do show running-config`, és javítsd: `interface g0/0/1`, `no ipv6 mtu`.',
        miert: 'A G0/0/1 alatt ott a hiba: `ipv6 mtu 1400`. Visszaállítva (1500) a két oldal egyezik, és pár másodperc múlva megjön a FULL üzenet.',
        be: ['do show running-config', 'interface g0/0/1', 'no ipv6 mtu'],
        kesz: { tipus: 'ospf-szomszed', csalad: 6, eszkoz: 'R3', szomszed: '2.2.2.2', allapot: 'FULL' },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'Nézd meg R1 IPv6-os OSPF-útvonalait: `do show ipv6 route ospf`.',
        miert: 'O = OSPF (területen belüli) útvonal. A következő ugrás link-local cím (FE80::2, FE80::3): az OSPFv3 a szomszédokat link-local címükön ismeri.',
        be: ['do show ipv6 route ospf'],
        kesz: [
          { tipus: 'utvonal', eszkoz: 'R1', halozat: '2001:DB8:ACAD:{L3}::/64', kod: 'O' },
          { tipus: 'parancs', eszkoz: 'R1', szavak: ['show', 'ipv6', 'route', 'ospf'] },
        ],
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'Passzív LAN és referencia-sávszélesség: `ipv6 router ospf 1`, `passive-interface g0/0/2`, `auto-cost reference-bandwidth 10000`.',
        miert: 'Ugyanaz, mint az IPv4-es OSPF-nél: a LAN felé nincs Hello, a gigabites linkek költsége 10 lesz.',
        be: ['ipv6 router ospf 1', 'passive-interface g0/0/2', 'auto-cost reference-bandwidth 10000'],
        kesz: { tipus: 'ospf', csalad: 6, eszkoz: 'R1', passziv: ['GigabitEthernet0/0/2'], referencia: 10000 },
      },
      {
        hol: 'terminal', eszkoz: 'R2',
        szoveg: 'R2-n is: `ipv6 router ospf 1`, `passive-interface g0/0/2`, `auto-cost reference-bandwidth 10000`.',
        miert: 'A referencia minden routeren ugyanannyi legyen.',
        be: ['ipv6 router ospf 1', 'passive-interface g0/0/2', 'auto-cost reference-bandwidth 10000'],
        kesz: { tipus: 'ospf', csalad: 6, eszkoz: 'R2', passziv: ['GigabitEthernet0/0/2'], referencia: 10000 },
      },
      {
        hol: 'terminal', eszkoz: 'R3',
        szoveg: 'R3-on is: `ipv6 router ospf 1`, `passive-interface g0/0/2`, `auto-cost reference-bandwidth 10000`.',
        miert: 'Ellenőrizd utána: `do show ipv6 ospf interface brief` – a Cost oszlopban 10.',
        be: ['ipv6 router ospf 1', 'passive-interface g0/0/2', 'auto-cost reference-bandwidth 10000'],
        kesz: { tipus: 'ospf', csalad: 6, eszkoz: 'R3', passziv: ['GigabitEthernet0/0/2'], referencia: 10000 },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'IPv6 alapértelmezett útvonal az ISP felé, és hirdessük: `ipv6 route ::/0 2001:DB8:FEED:1::1`, `ipv6 router ospf 1`, `default-information originate`.',
        miert: 'Az OSPFv3 is csak akkor hirdeti a ::/0-t, ha a routernek van ilyen útvonala (vagy ha az `always` szót is megadod).',
        be: ['ipv6 route ::/0 2001:DB8:FEED:1::1', 'ipv6 router ospf 1', 'default-information originate'],
        kesz: [
          { tipus: 'utvonal', eszkoz: 'R1', halozat: '::/0', kod: 'S' },
          { tipus: 'ospf', csalad: 6, eszkoz: 'R1', alapUtvonal: true },
        ],
      },
      {
        hol: 'terminal', eszkoz: 'R2',
        szoveg: 'Nézd meg R2 IPv6-os routing tábláját: `do show ipv6 route`.',
        miert: 'OE2 ::/0 [110/1], tag 1: OSPF-ből tanult, 2-es típusú külső útvonal – R2 IPv6-os internetforgalma R1 felé megy.',
        be: ['do show ipv6 route'],
        kesz: [
          { tipus: 'utvonal', eszkoz: 'R2', halozat: '::/0', kod: 'O' },
          { tipus: 'parancs', eszkoz: 'R2', szavak: ['show', 'ipv6', 'route'] },
        ],
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'Az R1–R3 link legyen pont-pont: `interface g0/0/1`, `ipv6 ospf network point-to-point`.',
        miert: 'A szomszédság leesik és újraépül. Amíg a másik végén nem állítod be, a két router másképp írja le a linket.',
        be: ['interface g0/0/1', 'ipv6 ospf network point-to-point'],
        kesz: { tipus: 'ospf-interfesz', csalad: 6, eszkoz: 'R1', port: 'GigabitEthernet0/0/1', halozatTipus: 'POINT_TO_POINT' },
      },
      {
        hol: 'terminal', eszkoz: 'R3',
        szoveg: 'R3-on is: `interface g0/0/0`, `ipv6 ospf network point-to-point`.',
        miert: 'Most már mindkét vég pont-pont: R1 szomszédlistájában 3.3.3.3 FULL/  - (nincs DR/BDR).',
        be: ['interface g0/0/0', 'ipv6 ospf network point-to-point'],
        kesz: [
          { tipus: 'ospf-interfesz', csalad: 6, eszkoz: 'R3', port: 'GigabitEthernet0/0/0', halozatTipus: 'POINT_TO_POINT' },
          { tipus: 'ospf-szomszed', csalad: 6, eszkoz: 'R1', szomszed: '3.3.3.3', allapot: 'FULL', szerep: '-' },
        ],
      },
      {
        hol: 'terminal', eszkoz: 'R3',
        szoveg: 'Az R2–R3 szegmensen R3 legyen a DR: `interface g0/0/1`, `ipv6 ospf priority 100`, majd `do show ipv6 ospf neighbor`.',
        miert: 'R2 továbbra is FULL/DR: ő kapcsolta be előbb az OSPFv3-at ezen a linken, és a választás nem preemptív.',
        be: ['interface g0/0/1', 'ipv6 ospf priority 100', 'do show ipv6 ospf neighbor'],
        kesz: { tipus: 'ospf-interfesz', csalad: 6, eszkoz: 'R3', port: 'GigabitEthernet0/0/1', prioritas: 100 },
      },
      {
        hol: 'terminal', eszkoz: 'R2',
        szoveg: 'Indítsd újra R2-n az OSPFv3-folyamatot: `end`, `clear ipv6 ospf process`, a kérdésre: `yes`.',
        miert: 'R2 szomszédságai leesnek és újraépülnek. Az R2–R3 szegmensen R3 egyedül marad, ezért ő lesz a DR; amikor R2 visszajön, '
          + 'már R3-at találja DR-ként.',
        be: ['end', 'clear ipv6 ospf process', 'yes'],
        kesz: { tipus: 'ospf-interfesz', csalad: 6, eszkoz: 'R3', port: 'GigabitEthernet0/0/1', allapot: 'DR' },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'Tegyük R1 felől drágábbá a közvetlen R2-es linket: `interface g0/0/0`, `ipv6 ospf cost 50`, majd `do show ipv6 route ospf`.',
        miert: 'A LAN2 (2001:DB8:ACAD:{L2}::/64) felé a közvetlen út most 50 + 10 = 60, R3-on át 10 + 10 + 10 = 30 – a következő ugrás FE80::3 lesz.',
        be: ['interface g0/0/0', 'ipv6 ospf cost 50', 'do show ipv6 route ospf'],
        kesz: { tipus: 'utvonal', eszkoz: 'R1', halozat: '2001:DB8:ACAD:{L2}::/64', kod: 'O', port: 'GigabitEthernet0/0/1' },
      },
      {
        hol: 'terminal', eszkoz: 'PC1',
        szoveg: 'Nézd meg, merre megy a PC1 → PC2 forgalom: `tracert 2001:DB8:ACAD:{L2}::10`.',
        miert: 'R1 után R3 következik (2001:DB8:ACAD:13::2), csak utána R2 – a drágább közvetlen link helyett.',
        be: ['tracert 2001:DB8:ACAD:{L2}::10'],
        kesz: { tipus: 'parancs', eszkoz: 'PC1', szavak: ['tracert'] },
      },
      {
        hol: 'ellenorzes',
        szoveg: 'Kész vagy! Nyomd meg az Ellenőrzés gombot.',
        miert: 'A szimulátor megnézi a beállításokat, a szomszédságokat és a routing táblákat, és valódi IPv6-pingeket küld.',
        kesz: { tipus: 'ellenorzes' },
      },
    ],
    magyarazat: [
      {
        cim: 'OSPFv3: ugyanaz az elv, IPv6-ra',
        szoveg: [
          'Az OSPFv3 ugyanúgy működik, mint az IPv4-es OSPF (OSPFv2): Hello és szomszédság, link-state adatbázis, SPF, költség, DR/BDR, AD 110. Ami más:',
          [
            'Interfészenként kapcsolod be (`ipv6 ospf 1 area 0`) – nincs network parancs és wildcard maszk.',
            'Előfeltétel az `ipv6 unicast-routing`.',
            'A Hellók és a szomszédok link-local címekről mennek (FF02::5, FF02::6), ezért a routing táblában a következő ugrás FE80:: cím.',
            'A router ID továbbra is 32 bites, IPv4-cím alakú. Ha a routernek nincs IPv4-címe, kötelező kézzel megadni (NORTRID-üzenet).',
            'A szomszédtáblában a szomszéd címe helyett az interfész-azonosító (Interface ID) látszik.',
          ],
        ],
      },
      {
        cim: 'Az LSA-k OSPFv3-ban',
        szoveg: [
          'Az OSPFv3-ban a Router és a Network LSA már csak a „térképet” írja le (ki kivel szomszéd, mennyi a költség); a címeket (előtagokat) '
            + 'külön LSA-k viszik: a Link LSA (a link-local cím, csak az adott linken terjed) és az Intra-Area-Prefix LSA. Nézd meg: `show ipv6 ospf database`.',
        ],
      },
      {
        cim: 'Az MTU-hiba',
        szoveg: [
          'Az MTU (Maximum Transmission Unit) a legnagyobb csomagméret, ami egy interfészen kimehet. Az OSPF az adatbázis-csere csomagjaiban (DBD) elküldi az '
            + 'interfész MTU-ját; ha a szomszédé nagyobb, a router eldobja a csomagot. A tünet: a Hellók rendben vannak (a routerek látják egymást), de a '
            + 'szomszédság EXSTART vagy EXCHANGE állapotban ragad.',
          'A javítás: a link két végén azonos MTU. (IPv4-en ugyanez az `ip mtu` paranccsal fordulhat elő.)',
        ],
      },
      {
        cim: 'DR/BDR, pont-pont, költség',
        szoveg: [
          'Ugyanaz, mint IPv4-en: a DR-választást a prioritás, majd a router ID dönti el, és nem preemptív. A két router közötti linket érdemes '
            + 'pont-ponttá tenni (`ipv6 ospf network point-to-point`, mindkét végén). A költséget az `ipv6 ospf cost` adja meg kézzel; csak kifelé számít.',
          'Hitelesítés: az OSPFv3-nak nincs saját jelszavas hitelesítése (mint az OSPFv2 MD5-je), helyette IPsec-et használ – ez a szimulátorban még nincs meg.',
        ],
      },
      {
        cim: 'A szimulátor és a Packet Tracer',
        szoveg: [
          'A routerek itt ISR 4331 jellegűek (G0/0/0 alakú portnevek). A klasszikus OSPFv3-parancsokat használjuk; az újabb, címcsaládos '
            + 'forma (`router ospfv3 1`, `address-family ipv6 unicast`) a szimulátorban még nincs meg.',
          'Az idő valós: a 40 másodperces várakozások (Wait, Dead) a rajz alatti sebességállítóval gyorsíthatók.',
        ],
      },
      {
        cim: 'Próbáld ki!',
        szoveg: [[
          'R2-n `show ipv6 ospf database`: melyik router küld Network LSA-t, és miért éppen az?',
          'R3-on `show ipv6 ospf interface g0/0/1`: ki a DR és ki a BDR, és melyik link-local címen?',
          'Állíts be R1-en `ipv6 ospf hello-interval 5`-öt a G0/0/0-n, és nézd meg, mi történik a szomszédsággal (majd állítsd vissza).',
        ]],
      },
    ],
  });
}(typeof window !== 'undefined' ? window : globalThis));
