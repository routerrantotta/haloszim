/*
 * Haloszim feladat: Dinamikus forgalomirányítás – OSPF IPv4-en (ospf-1)
 *
 * A Routerrántotta „OSPF – egyterületű” leckéinek (4. lecke: Konfiguráció és ellenőrzés) háromszög-
 * topológiája: három router, mindegyik mögött egy LAN, mind az Area 0-ban; R1 mögött egy internet-
 * szolgáltató (ISP). A címek kiosztva, a tanuló feladata az OSPF: router ID, network + wildcard,
 * egy beépített hiba megkeresése (eltérő Hello-idő), passzív interfész, referencia-sávszélesség,
 * alapértelmezett útvonal hirdetése, DR/BDR és pont-pont hálózattípus, költség, MD5-hitelesítés.
 *
 * A feladatfájl felépítése: lásd feladatok/vlan-1.js és rip-1.js. Itt újdonság:
 *   céltípusok: ospf, ospf-szomszed, ospf-interfesz (src/feladat/ellenorzo.js)
 *   kiindulo.<router>.portok.<port>.ospf – interfész-szintű OSPF-beállítás már az elején (a hiba)
 *
 * A lecke portnevei (2911-es router: G0/0, G0/1, G0/2) itt ISR 4331 jellegűek: G0/0/0, G0/0/1, G0/0/2.
 * Véletlen változatban a LAN-ok harmadik bájtja és az MD5-jelszó változik.
 */
(function (g) {
  (g.HaloszimFeladatok = g.HaloszimFeladatok || []).push({
    azon: 'ospf-1',
    tipus: 'Dinamikus routing',
    cim: 'OSPF (IPv4, OSPFv2)',
    szint: 'haladó',
    valtozok: {
      L1: { tipus: 'szam', alap: 1, min: 30, max: 254 },
      L2: { tipus: 'szam', alap: 2, min: 30, max: 254, kulonbozik: ['L1'] },
      L3: { tipus: 'szam', alap: 3, min: 30, max: 254, kulonbozik: ['L1', 'L2'] },
      KULCS: { tipus: 'jelszo', alap: 'Titok123', lista: ['Titok', 'Rantotta', 'Ospf', 'Kulcs', 'Router'] },
    },
    leiras: [
      'Egy cégnek három telephelye van, mindegyikben egy router (R1, R2, R3) és mögötte egy LAN. A routereket gigabites '
        + 'linkek kötik össze háromszögben, R1 egy soros vonalon az internetszolgáltatóhoz (ISP) is kapcsolódik.',
      'A címek ki vannak osztva, de forgalomirányítás még nincs. A feladat: egyterületű OSPF (Area 0) mindhárom routeren, '
        + 'kézi router ID-vel (R1 = 1.1.1.1, R2 = 2.2.2.2, R3 = 3.3.3.3), hogy minden LAN elérje a többit és az internetet '
        + '(az ISP 198.51.100.1-es címét).',
      'Figyelem: egy korábbi kolléga az egyik routeren már „belenyúlt” egy interfész OSPF-beállításába. Ha valamelyik '
        + 'szomszédság nem jön létre, derítsd ki, miért!',
    ],
    lepesek: [
      {
        cel: 'Vizsgáld meg a kiinduló állapotot: a routerek interfészeit és routing tábláját, és győződj meg róla, hogy a LAN-ok még nem érik el egymást.',
        parancsok: 'Mindhárom routeren: `show ip interface brief`, `show ip route`; PC1-en: `ping 192.168.{L2}.10`',
        tippek: [
          'A show parancsok privilegizált módban (`enable` után) futnak.',
          'A routing táblában most csak C és L kódú sorok vannak: a router csak a közvetlenül kapcsolt hálózatait ismeri.',
        ],
      },
      {
        cel: 'Indítsd el az OSPF-et mindhárom routeren a megadott router ID-vel, és kapcsold be a router mindhárom belső hálózatán (a két routerek közötti linken és a LAN-on), az Area 0-ban. Az ISP felé néző hálózat ne kerüljön bele.',
        parancsok: '`router ospf 1`, `router-id 1.1.1.1` (R2: 2.2.2.2, R3: 3.3.3.3); R1: `network 10.0.12.0 0.0.0.3 area 0`, '
          + '`network 10.0.13.0 0.0.0.3 area 0`, `network 192.168.{L1}.0 0.0.0.255 area 0`; R2 és R3 a saját hálózataival '
          + '(10.0.12.0, 10.0.23.0, 192.168.{L2}.0, ill. 10.0.13.0, 10.0.23.0, 192.168.{L3}.0)',
        tippek: [
          'Az OSPF-et globális konfigurációs módban indítod egy folyamatazonosítóval; a beállításai a saját almódjában vannak.',
          'A network parancs wildcard maszkot vár: 255.255.255.255 mínusz az alhálózati maszk (/30 → 0.0.0.3, /24 → 0.0.0.255).',
          'A szomszédságot a `show ip ospf neighbor` mutatja – a FULL állapot a kész szomszédság.',
        ],
      },
      {
        cel: 'Hibakeresés: R1 és R3 nem lesznek szomszédok. Derítsd ki, mi az oka, és javítsd ki úgy, hogy a szomszédság létrejöjjön.',
        parancsok: 'R1: `show ip ospf neighbor` (3.3.3.3 hiányzik), `debug ip ospf hello` (Mismatched hello parameters), `undebug all`; '
          + 'R3: `show ip ospf interface g0/0/0` (Hello 5, Dead 20); javítás R3-on: `interface g0/0/0`, `no ip ospf hello-interval`',
        tippek: [
          'Nézd meg, kiket lát R1 szomszédként – és melyik interfészén hiányzik valaki.',
          'A Hello csomagok néhány adatának egyeznie kell a két oldalon. A Hello-csomagok hibakeresése (debug) megmutatja, mi nem egyezik.',
          'Egy interfész OSPF-időzítőit a show ip ospf interface mutatja. A „no” alak visszaállítja az alapértéket.',
        ],
      },
      {
        cel: 'Mindhárom routeren: a LAN felé ne menjen Hello (a LAN hálózatát ettől még hirdesse), és a költség számításánál a referencia-sávszélesség 10 000 Mbit/s legyen, hogy a gigabites linkek költsége 10 legyen.',
        parancsok: '`router ospf 1`, `passive-interface g0/0/2`, `auto-cost reference-bandwidth 10000`; ellenőrzés: `show ip ospf interface brief`',
        tippek: [
          'A LAN felé a passzív interfész kapcsolja ki a Hellót – a LAN hálózatát az OSPF továbbra is hirdeti.',
          'A referencia-sávszélesség az OSPF beállításai között van, Mbit/s-ban kell megadni. Mindhárom routeren ugyanaz legyen!',
        ],
      },
      {
        cel: 'R1 küldje az internet felé a nem ismert címekre szóló forgalmat (alapértelmezett útvonal), és ezt az OSPF hirdesse a többi routernek is.',
        parancsok: 'R1-en: `ip route 0.0.0.0 0.0.0.0 203.0.113.1`, `router ospf 1`, `default-information originate`; R2-n: `show ip route` (O*E2)',
        tippek: [
          'Az ISP felé egy statikus alapértelmezett útvonal kell (0.0.0.0/0).',
          'Az OSPF-nek külön meg kell mondani, hogy ezt az útvonalat hirdesse – az OSPF beállításai között.',
        ],
      },
      {
        cel: 'Az R2–R3 linken ne legyen DR/BDR-választás (pont-pont hálózattípus, mindkét végén). Az R1–R2 szegmensen R2 legyen a DR.',
        parancsok: 'R2 és R3 G0/0/1: `ip ospf network point-to-point`; R2 G0/0/0: `ip ospf priority 100`, `show ip ospf neighbor` '
          + '(R1 még DR!); R1-en: `clear ip ospf process`, `yes`',
        tippek: [
          'A hálózattípus interfész-beállítás. Ha csak az egyik végén állítod át, a szomszédság felállhat, de az útvonalak nem lesznek jók.',
          'A DR-választásban a nagyobb prioritás nyer. A választás nem preemptív: a meglévő DR a helyén marad.',
          'Új választás akkor lesz, ha a jelenlegi DR kiesik – vagy ha újraindítod rajta az OSPF-folyamatot.',
        ],
      },
      {
        cel: 'R1 a LAN3-at (192.168.{L3}.0/24) ne a közvetlen R1–R3 linken, hanem R2-n keresztül érje el: tedd az R1–R3 linket R1 felől „drágábbá” (költség: 50).',
        parancsok: 'R1: `interface g0/0/1`, `ip ospf cost 50`, `do show ip route ospf`; PC1-en: `tracert 192.168.{L3}.10`',
        tippek: [
          'Az OSPF a legkisebb összköltségű utat választja; egy interfész költsége kézzel is megadható.',
          'A költség irányfüggő: mindig a kimenő interfészé számít.',
        ],
      },
      {
        cel: 'Az R1–R2 linken csak az lehessen OSPF-szomszéd, aki ismeri a közös jelszót: MD5-hitelesítés mindkét végén, 1-es kulccsal, a jelszó: {KULCS}.',
        parancsok: 'R1 és R2 G0/0/0: `ip ospf authentication message-digest`, `ip ospf message-digest-key 1 md5 {KULCS}`; közben: `show ip ospf neighbor`',
        tippek: [
          'A hitelesítést interfészenként kapcsolod be, a kulcsot (számmal és jelszóval) külön parancs adja meg.',
          'Amíg csak az egyik oldalon van beállítva, a szomszédság a Dead-idő (40 mp) után megszakad.',
        ],
      },
    ],
    cimterv: [
      { eszkoz: 'R1', interfesz: 'G0/0/0', ip: '10.0.12.1/30', hova: 'R2 G0/0/0' },
      { eszkoz: 'R1', interfesz: 'G0/0/1', ip: '10.0.13.1/30', hova: 'R3 G0/0/0' },
      { eszkoz: 'R1', interfesz: 'G0/0/2', ip: '192.168.{L1}.1/24', hova: 'LAN1' },
      { eszkoz: 'R1', interfesz: 'S0/1/0', ip: '203.0.113.2/30', hova: 'ISP' },
      { eszkoz: 'R2', interfesz: 'G0/0/0', ip: '10.0.12.2/30', hova: 'R1 G0/0/0' },
      { eszkoz: 'R2', interfesz: 'G0/0/1', ip: '10.0.23.1/30', hova: 'R3 G0/0/1' },
      { eszkoz: 'R2', interfesz: 'G0/0/2', ip: '192.168.{L2}.1/24', hova: 'LAN2' },
      { eszkoz: 'R3', interfesz: 'G0/0/0', ip: '10.0.13.2/30', hova: 'R1 G0/0/1' },
      { eszkoz: 'R3', interfesz: 'G0/0/1', ip: '10.0.23.2/30', hova: 'R2 G0/0/1' },
      { eszkoz: 'R3', interfesz: 'G0/0/2', ip: '192.168.{L3}.1/24', hova: 'LAN3' },
      { eszkoz: 'ISP', interfesz: 'S0/1/0', ip: '203.0.113.1/30', hova: 'R1 S0/1/0' },
      { eszkoz: 'ISP', interfesz: 'Lo0', ip: '198.51.100.1/24', hova: '„internet”' },
      { eszkoz: 'PC1', interfesz: 'Fa0', ip: '192.168.{L1}.10/24', atjaro: '192.168.{L1}.1', hova: 'LAN1' },
      { eszkoz: 'PC2', interfesz: 'Fa0', ip: '192.168.{L2}.10/24', atjaro: '192.168.{L2}.1', hova: 'LAN2' },
      { eszkoz: 'PC3', interfesz: 'Fa0', ip: '192.168.{L3}.10/24', atjaro: '192.168.{L3}.1', hova: 'LAN3' },
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
        { x: 412, y: 116, igazit: 'start', szoveg: '203.0.113.0/30' },
        { x: 470, y: 30, igazit: 'start', szoveg: 'Lo0: 198.51.100.1/24', halvany: true },
        { x: 268, y: 260, igazit: 'end', szoveg: '10.0.12.0/30' },
        { x: 492, y: 260, igazit: 'start', szoveg: '10.0.13.0/30' },
        { x: 380, y: 340, szoveg: '10.0.23.0/30' },
        { x: 380, y: 372, szoveg: 'Area 0', halvany: true },
        { x: 100, y: 128, szoveg: 'LAN1: 192.168.{L1}.0/24', halvany: true },
        { x: 150, y: 480, igazit: 'end', szoveg: 'LAN2\n192.168.{L2}.0/24', halvany: true },
        { x: 610, y: 480, igazit: 'start', szoveg: 'LAN3\n192.168.{L3}.0/24', halvany: true },
      ],
    },
    kiindulo: {
      ISP: {
        portok: {
          'Serial0/1/0': { ip: '203.0.113.1', maszk: '255.255.255.252' },
          Loopback0: { ip: '198.51.100.1', maszk: '255.255.255.0' },
        },
        // A szolgáltató a cég hálózatait R1 felé küldi vissza (összevont útvonalakkal).
        statikus: [
          { halozat: '10.0.0.0', maszk: '255.0.0.0', kovetkezo: '203.0.113.2' },
          { halozat: '192.168.0.0', maszk: '255.255.0.0', kovetkezo: '203.0.113.2' },
        ],
      },
      R1: {
        portok: {
          'GigabitEthernet0/0/0': { ip: '10.0.12.1', maszk: '255.255.255.252', leiras: 'R2 fele' },
          'GigabitEthernet0/0/1': { ip: '10.0.13.1', maszk: '255.255.255.252', leiras: 'R3 fele' },
          'GigabitEthernet0/0/2': { ip: '192.168.{L1}.1', maszk: '255.255.255.0', leiras: 'LAN1' },
          'Serial0/1/0': { ip: '203.0.113.2', maszk: '255.255.255.252', leiras: 'ISP fele' },
        },
      },
      R2: {
        portok: {
          'GigabitEthernet0/0/0': { ip: '10.0.12.2', maszk: '255.255.255.252', leiras: 'R1 fele' },
          'GigabitEthernet0/0/1': { ip: '10.0.23.1', maszk: '255.255.255.252', leiras: 'R3 fele' },
          'GigabitEthernet0/0/2': { ip: '192.168.{L2}.1', maszk: '255.255.255.0', leiras: 'LAN2' },
        },
      },
      R3: {
        portok: {
          // A beépített hiba: egy korábbi „próbálkozás” – ezen az interfészen 5 mp a Hello-idő (a Dead így 20 mp).
          'GigabitEthernet0/0/0': { ip: '10.0.13.2', maszk: '255.255.255.252', leiras: 'R1 fele', ospf: { hello: 5 } },
          'GigabitEthernet0/0/1': { ip: '10.0.23.2', maszk: '255.255.255.252', leiras: 'R2 fele' },
          'GigabitEthernet0/0/2': { ip: '192.168.{L3}.1', maszk: '255.255.255.0', leiras: 'LAN3' },
        },
      },
      PC1: { ip: '192.168.{L1}.10', maszk: '255.255.255.0', atjaro: '192.168.{L1}.1' },
      PC2: { ip: '192.168.{L2}.10', maszk: '255.255.255.0', atjaro: '192.168.{L2}.1' },
      PC3: { ip: '192.168.{L3}.10', maszk: '255.255.255.0', atjaro: '192.168.{L3}.1' },
    },
    celok: [
      // --- az OSPF-folyamatok ---
      { tipus: 'ospf', eszkoz: 'R1', routerId: '1.1.1.1', interfeszek: ['GigabitEthernet0/0/0', 'GigabitEthernet0/0/1', 'GigabitEthernet0/0/2'], terulet: 0,
        passziv: ['GigabitEthernet0/0/2'], referencia: 10000, alapUtvonal: true,
        szoveg: 'R1: OSPF 1.1.1.1-es router ID-vel a három belső hálózaton (Area 0), passzív LAN, referencia 10 000, default route hirdetése' },
      { tipus: 'ospf', eszkoz: 'R1', nemInterfeszek: ['Serial0/1/0'], ellenproba: true,
        szoveg: 'R1 az ISP felé néző interfészen nem futtat OSPF-et' },
      { tipus: 'ospf', eszkoz: 'R2', routerId: '2.2.2.2', interfeszek: ['GigabitEthernet0/0/0', 'GigabitEthernet0/0/1', 'GigabitEthernet0/0/2'], terulet: 0,
        passziv: ['GigabitEthernet0/0/2'], referencia: 10000,
        szoveg: 'R2: OSPF 2.2.2.2-es router ID-vel, passzív LAN, referencia 10 000' },
      { tipus: 'ospf', eszkoz: 'R3', routerId: '3.3.3.3', interfeszek: ['GigabitEthernet0/0/0', 'GigabitEthernet0/0/1', 'GigabitEthernet0/0/2'], terulet: 0,
        passziv: ['GigabitEthernet0/0/2'], referencia: 10000,
        szoveg: 'R3: OSPF 3.3.3.3-as router ID-vel, passzív LAN, referencia 10 000' },
      // --- szomszédságok ---
      { tipus: 'ospf-szomszed', eszkoz: 'R1', szomszed: '2.2.2.2', port: 'GigabitEthernet0/0/0', allapot: 'FULL', szoveg: 'R1 és R2 szomszédsága FULL' },
      { tipus: 'ospf-szomszed', eszkoz: 'R1', szomszed: '3.3.3.3', port: 'GigabitEthernet0/0/1', allapot: 'FULL', szoveg: 'R1 és R3 szomszédsága FULL – a hiba javítva' },
      { tipus: 'ospf-szomszed', eszkoz: 'R2', szomszed: '3.3.3.3', port: 'GigabitEthernet0/0/1', allapot: 'FULL', szerep: '-',
        szoveg: 'R2 és R3 szomszédsága FULL, pont-pont linken' },
      { tipus: 'ospf-interfesz', eszkoz: 'R3', port: 'GigabitEthernet0/0/0', hello: 10, dead: 40, szoveg: 'R3 G0/0/0: a Hello/Dead idő újra 10/40 mp' },
      // --- hálózattípus, DR, költség, hitelesítés ---
      { tipus: 'ospf-interfesz', eszkoz: 'R2', port: 'GigabitEthernet0/0/1', halozatTipus: 'POINT_TO_POINT', szoveg: 'R2 G0/0/1: pont-pont hálózattípus' },
      { tipus: 'ospf-interfesz', eszkoz: 'R3', port: 'GigabitEthernet0/0/1', halozatTipus: 'POINT_TO_POINT', szoveg: 'R3 G0/0/1: pont-pont hálózattípus' },
      { tipus: 'ospf-interfesz', eszkoz: 'R2', port: 'GigabitEthernet0/0/0', prioritas: 100, allapot: 'DR', szoveg: 'Az R1–R2 szegmensen R2 a DR (prioritás 100)' },
      { tipus: 'ospf-interfesz', eszkoz: 'R1', port: 'GigabitEthernet0/0/1', koltseg: 50, szoveg: 'R1 G0/0/1 költsége 50' },
      { tipus: 'ospf-interfesz', eszkoz: 'R1', port: 'GigabitEthernet0/0/0', hitelesites: 'md5', kulcs: { 1: '{KULCS}' }, szoveg: 'R1 G0/0/0: MD5-hitelesítés, 1-es kulcs' },
      { tipus: 'ospf-interfesz', eszkoz: 'R2', port: 'GigabitEthernet0/0/0', hitelesites: 'md5', kulcs: { 1: '{KULCS}' }, szoveg: 'R2 G0/0/0: MD5-hitelesítés, 1-es kulcs' },
      // --- routing táblák ---
      { tipus: 'utvonal', eszkoz: 'R1', halozat: '192.168.{L3}.0/24', kod: 'O', port: 'GigabitEthernet0/0/0',
        szoveg: 'R1 a LAN3-at R2-n át éri el (a drágább közvetlen link helyett)' },
      { tipus: 'utvonal', eszkoz: 'R2', halozat: '192.168.{L3}.0/24', kod: 'O', port: 'GigabitEthernet0/0/1',
        szoveg: 'R2 a LAN3-at a közvetlen (pont-pont) linken éri el' },
      { tipus: 'utvonal', eszkoz: 'R2', halozat: '0.0.0.0/0', kod: 'O', szoveg: 'R2 OSPF-ből kapta meg az alapértelmezett útvonalat (O*E2)' },
      { tipus: 'utvonal', eszkoz: 'R3', halozat: '0.0.0.0/0', kod: 'O', szoveg: 'R3 OSPF-ből kapta meg az alapértelmezett útvonalat (O*E2)' },
      { tipus: 'utvonal', eszkoz: 'R2', halozat: '203.0.113.0/30', nincs: true, ellenproba: true,
        szoveg: 'Az internet felé néző hálózat nem szivárgott be R2 táblájába' },
      // --- próbák ---
      { tipus: 'ping', honnan: 'PC1', ip: '192.168.{L2}.10', szoveg: 'PC1 → PC2 ping' },
      { tipus: 'ping', honnan: 'PC1', ip: '192.168.{L3}.10', szoveg: 'PC1 → PC3 ping' },
      { tipus: 'ping', honnan: 'PC2', ip: '192.168.{L3}.10', db: 3, szoveg: 'PC2 → PC3 ping, többször egymás után is' },
      { tipus: 'ping', honnan: 'PC1', ip: '198.51.100.1', szoveg: 'PC1 → internet (198.51.100.1) ping' },
      { tipus: 'ping', honnan: 'PC2', ip: '198.51.100.1', szoveg: 'PC2 → internet (198.51.100.1) ping' },
      { tipus: 'ping', honnan: 'PC3', ip: '198.51.100.1', szoveg: 'PC3 → internet (198.51.100.1) ping' },
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
          + 'R1 a 192.168.{L2}.0 és a 192.168.{L3}.0 hálózatról nem tud.',
        be: ['enable', 'show ip interface brief', 'show ip route'],
        kesz: { tipus: 'parancs', eszkoz: 'R1', szavak: ['show', 'ip', 'route'] },
      },
      {
        hol: 'terminal', eszkoz: 'PC1',
        szoveg: 'Próbáld ki PC1-ről: `ping 192.168.{L2}.10`.',
        miert: 'Nem megy: R1 visszaszól, hogy nem ismeri a célhálózatot (Destination net unreachable).',
        be: ['ping 192.168.{L2}.10'],
        kesz: { tipus: 'parancs', eszkoz: 'PC1', szavak: ['ping'] },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'Indítsd el az OSPF-et R1-en: `configure terminal`, `router ospf 1`, `router-id 1.1.1.1`.',
        miert: 'A `router ospf 1` után a prompt `R1(config-router)#`. Az 1 a folyamat azonosítója: csak ezen a routeren számít, '
          + 'a szomszédokon lehetne más is. A router ID-t mindig érdemes kézzel megadni – így előre tudod, melyik router melyik.',
        be: ['configure terminal', 'router ospf 1', 'router-id 1.1.1.1'],
        kesz: { tipus: 'ospf', eszkoz: 'R1', routerId: '1.1.1.1' },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'Add meg R1 hálózatait: `network 10.0.12.0 0.0.0.3 area 0`, `network 10.0.13.0 0.0.0.3 area 0`, `network 192.168.{L1}.0 0.0.0.255 area 0`.',
        miert: 'A network parancs bekapcsolja az OSPF-et azokon az interfészeken, amelyek címe a tartományba esik, és hirdeti a '
          + 'hálózatukat. A wildcard maszk „fordított maszk”: 255.255.255.255 mínusz az alhálózati maszk. A 203.0.113.0 (ISP) kimarad.',
        be: ['network 10.0.12.0 0.0.0.3 area 0', 'network 10.0.13.0 0.0.0.3 area 0', 'network 192.168.{L1}.0 0.0.0.255 area 0'],
        kesz: { tipus: 'ospf', eszkoz: 'R1', interfeszek: ['GigabitEthernet0/0/0', 'GigabitEthernet0/0/1', 'GigabitEthernet0/0/2'] },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'Ellenőrizd: `do show ip protocols`.',
        miert: 'Itt egyben látod a router ID-t, a „Routing for Networks” listát (a network parancsokat), és később azt is, kiktől tanul útvonalakat.',
        be: ['do show ip protocols'],
        kesz: { tipus: 'parancs', eszkoz: 'R1', szavak: ['show', 'ip', 'protocols'] },
      },
      {
        hol: 'terminal', eszkoz: 'R2',
        szoveg: 'R2-n ugyanez: `en`, `conf t`, `router ospf 1`, `router-id 2.2.2.2`, `network 10.0.12.0 0.0.0.3 area 0`, '
          + '`network 10.0.23.0 0.0.0.3 area 0`, `network 192.168.{L2}.0 0.0.0.255 area 0`.',
        miert: 'Figyeld R2 konzolját: pár másodperc múlva megjelenik az `%OSPF-5-ADJCHG … 1.1.1.1 … from LOADING to FULL` üzenet – '
          + 'kész az R1–R2 szomszédság. Közben a rajzon látod a Hello (kék) és az adatbázis-csere csomagjait.',
        be: ['en', 'conf t', 'router ospf 1', 'router-id 2.2.2.2', 'network 10.0.12.0 0.0.0.3 area 0', 'network 10.0.23.0 0.0.0.3 area 0',
          'network 192.168.{L2}.0 0.0.0.255 area 0'],
        kesz: { tipus: 'ospf-szomszed', eszkoz: 'R2', szomszed: '1.1.1.1', allapot: 'FULL' },
      },
      {
        hol: 'terminal', eszkoz: 'R3',
        szoveg: 'R3-on is: `en`, `conf t`, `router ospf 1`, `router-id 3.3.3.3`, `network 10.0.13.0 0.0.0.3 area 0`, '
          + '`network 10.0.23.0 0.0.0.3 area 0`, `network 192.168.{L3}.0 0.0.0.255 area 0`.',
        miert: 'R3 konzolján megjön a FULL üzenet R2-vel (2.2.2.2) – de R1-gyel (1.1.1.1) nem! Valami nincs rendben az R1–R3 linken.',
        be: ['en', 'conf t', 'router ospf 1', 'router-id 3.3.3.3', 'network 10.0.13.0 0.0.0.3 area 0', 'network 10.0.23.0 0.0.0.3 area 0',
          'network 192.168.{L3}.0 0.0.0.255 area 0'],
        kesz: { tipus: 'ospf-szomszed', eszkoz: 'R3', szomszed: '2.2.2.2', allapot: 'FULL' },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'Nézd meg R1 szomszédait: `do show ip ospf neighbor`.',
        miert: 'Csak 2.2.2.2 van a listában (G0/0/0-n). A G0/0/1-en, R3 felé nincs szomszéd – pedig mindkét router OSPF-ezik azon a linken.',
        be: ['do show ip ospf neighbor'],
        kesz: { tipus: 'parancs', eszkoz: 'R1', szavak: ['show', 'ip', 'ospf', 'neighbor'] },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'Kapcsold be a Hello-csomagok hibakeresését: `do debug ip ospf hello`, és várj néhány másodpercet.',
        miert: 'Megjelenik: „Mismatched hello parameters from 10.0.13.2”, alatta: „Dead R 20 C 40, Hello R 5 C 10”. Az R (received) a '
          + 'szomszédtól kapott, a C (configured) a saját érték: R3 5 másodpercenként küld Hellót, R1 10-enként. Ilyenkor nincs szomszédság.',
        be: ['do debug ip ospf hello'],
        kesz: { tipus: 'parancs', eszkoz: 'R1', szavak: ['debug', 'ip', 'ospf', 'hello'] },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'Kapcsold ki a debugot: `do undebug all`.',
        miert: 'A debug sok üzenetet ír; éles routeren a processzort is terheli. Mindig kapcsold ki, amint megvan, amit kerestél.',
        be: ['do undebug all'],
        kesz: { tipus: 'parancs', eszkoz: 'R1', szavak: ['undebug', 'all'] },
      },
      {
        hol: 'terminal', eszkoz: 'R3',
        szoveg: 'Nézd meg R3-on az R1 felé néző interfészt: `do show ip ospf interface g0/0/0`.',
        miert: 'A „Timer intervals configured” sorban: Hello 5, Dead 20. Valaki korábban átállította a Hello-időt (a Dead ilyenkor '
          + 'magától a négyszerese lesz). A `do show running-config` is mutatja: `ip ospf hello-interval 5`.',
        be: ['do show ip ospf interface g0/0/0'],
        kesz: { tipus: 'parancs', eszkoz: 'R3', szavak: ['show', 'ip', 'ospf', 'interface'] },
      },
      {
        hol: 'terminal', eszkoz: 'R3',
        szoveg: 'Javítsd: `interface g0/0/0`, `no ip ospf hello-interval`.',
        miert: 'A „no” alak visszaállítja az alapértéket (10 mp, a Dead pedig 40). Pár másodperc múlva megjön az R1–R3 szomszédság FULL üzenete.',
        be: ['interface g0/0/0', 'no ip ospf hello-interval'],
        kesz: { tipus: 'ospf-szomszed', eszkoz: 'R3', szomszed: '1.1.1.1', allapot: 'FULL' },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'Nézd meg R1 OSPF-útvonalait: `do show ip route ospf`.',
        miert: 'O = OSPF-ből tanult útvonal. A [110/2] az adminisztratív távolság (110) és a költség. A költség most még mindenhol 1 '
          + 'linkenként: a gigabites interfész költsége az alap 100 Mbit/s-os referenciával 1 (100 ÷ 1000, de legalább 1).',
        be: ['do show ip route ospf'],
        kesz: [
          { tipus: 'utvonal', eszkoz: 'R1', halozat: '192.168.{L3}.0/24', kod: 'O' },
          { tipus: 'parancs', eszkoz: 'R1', szavak: ['show', 'ip', 'route', 'ospf'] },
        ],
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'A LAN felé nem kell Hello, és emeljük meg a referencia-sávszélességet: `router ospf 1`, `passive-interface g0/0/2`, '
          + '`auto-cost reference-bandwidth 10000`.',
        miert: 'A passzív interfész nem küld és nem fogad Hellót, de a hálózatát továbbra is hirdeti. A 10 000 Mbit/s-os referenciával a '
          + 'gigabites linkek költsége 10 lesz (10 000 ÷ 1000) – így az OSPF különbséget tud tenni a gyors és a lassú linkek között.',
        be: ['router ospf 1', 'passive-interface g0/0/2', 'auto-cost reference-bandwidth 10000'],
        kesz: { tipus: 'ospf', eszkoz: 'R1', passziv: ['GigabitEthernet0/0/2'], referencia: 10000 },
      },
      {
        hol: 'terminal', eszkoz: 'R2',
        szoveg: 'R2-n is: `router ospf 1`, `passive-interface g0/0/2`, `auto-cost reference-bandwidth 10000`.',
        miert: 'A referencia minden routeren ugyanannyi legyen – különben a routerek eltérő mércével számolnák ugyanazokat a linkeket.',
        be: ['router ospf 1', 'passive-interface g0/0/2', 'auto-cost reference-bandwidth 10000'],
        kesz: { tipus: 'ospf', eszkoz: 'R2', passziv: ['GigabitEthernet0/0/2'], referencia: 10000 },
      },
      {
        hol: 'terminal', eszkoz: 'R3',
        szoveg: 'R3-on is: `router ospf 1`, `passive-interface g0/0/2`, `auto-cost reference-bandwidth 10000`.',
        miert: 'R3 most interfész-módban van; a `router ospf 1` innen is működik (a router előbb kilép az interfész módból).',
        be: ['router ospf 1', 'passive-interface g0/0/2', 'auto-cost reference-bandwidth 10000'],
        kesz: { tipus: 'ospf', eszkoz: 'R3', passziv: ['GigabitEthernet0/0/2'], referencia: 10000 },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'Nézd meg: `do show ip ospf interface brief`.',
        miert: 'A Cost oszlop: 10. A State oszlop az interfész szerepe a szegmensen (DR, BDR); a passzív LAN-interfész egyedül van, '
          + 'ezért ő a DR. A Nbrs F/C: teljes (Full) szomszédok / összes szomszéd.',
        be: ['do show ip ospf interface brief'],
        kesz: { tipus: 'parancs', eszkoz: 'R1', szavak: ['show', 'ip', 'ospf', 'interface', 'brief'] },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'Alapértelmezett útvonal az ISP felé, és hirdessük: `ip route 0.0.0.0 0.0.0.0 203.0.113.1`, `router ospf 1`, `default-information originate`.',
        miert: 'A default-information originate csak akkor hirdet, ha a routernek van alapértelmezett útvonala – ezért kell előbb a statikus útvonal.',
        be: ['ip route 0.0.0.0 0.0.0.0 203.0.113.1', 'router ospf 1', 'default-information originate'],
        kesz: [
          { tipus: 'utvonal', eszkoz: 'R1', halozat: '0.0.0.0/0', kod: 'S' },
          { tipus: 'ospf', eszkoz: 'R1', alapUtvonal: true },
        ],
      },
      {
        hol: 'terminal', eszkoz: 'R2',
        szoveg: 'Nézd meg R2 routing tábláját: `do show ip route`.',
        miert: 'O*E2 0.0.0.0/0 [110/1]: OSPF-ből tanult, külső (E2 = 2-es típusú külső) útvonal, a csillag jelzi, hogy ez az alapértelmezett. '
          + 'Fent: „Gateway of last resort is 10.0.12.1”.',
        be: ['do show ip route'],
        kesz: [
          { tipus: 'utvonal', eszkoz: 'R2', halozat: '0.0.0.0/0', kod: 'O' },
          { tipus: 'parancs', eszkoz: 'R2', szavak: ['show', 'ip', 'route'] },
        ],
      },
      {
        hol: 'terminal', eszkoz: 'R2',
        szoveg: 'Az R2–R3 link két router között van: nem kell rá DR/BDR. `interface g0/0/1`, `ip ospf network point-to-point`.',
        miert: 'R2 konzolján a szomszédság leesik és újraépül. Amíg csak az egyik végén pont-pont a hálózattípus, a szomszédság '
          + 'felállhat, de a két router másképp írja le a linket – az útvonalak nem lesznek jók. Ezért a másik végén is kell.',
        be: ['interface g0/0/1', 'ip ospf network point-to-point'],
        kesz: { tipus: 'ospf-interfesz', eszkoz: 'R2', port: 'GigabitEthernet0/0/1', halozatTipus: 'POINT_TO_POINT' },
      },
      {
        hol: 'terminal', eszkoz: 'R3',
        szoveg: 'R3-on is: `interface g0/0/1`, `ip ospf network point-to-point`, majd `do show ip ospf neighbor`.',
        miert: 'Az R2 sorban a State: FULL/  - . A kötőjel azt jelenti: pont-pont link, nincs DR és BDR. Pont-pont linken a '
          + 'szomszédság gyorsabban is áll fel, mert nincs választás (Wait-időzítő).',
        be: ['interface g0/0/1', 'ip ospf network point-to-point', 'do show ip ospf neighbor'],
        kesz: [
          { tipus: 'ospf-interfesz', eszkoz: 'R3', port: 'GigabitEthernet0/0/1', halozatTipus: 'POINT_TO_POINT' },
          { tipus: 'ospf-szomszed', eszkoz: 'R3', szomszed: '2.2.2.2', allapot: 'FULL', szerep: '-' },
        ],
      },
      {
        hol: 'terminal', eszkoz: 'R2',
        szoveg: 'Az R1–R2 szegmensen R2 legyen a DR: `interface g0/0/0`, `ip ospf priority 100`, majd `do show ip ospf neighbor`.',
        miert: 'Hiába nagyobb most R2 prioritása, R1 (1.1.1.1) továbbra is FULL/DR: a választás nem preemptív, a meglévő DR a helyén '
          + 'marad. (R1 lett a DR, mert ő kapcsolta be elsőként az OSPF-et ezen a linken.)',
        be: ['interface g0/0/0', 'ip ospf priority 100', 'do show ip ospf neighbor'],
        kesz: { tipus: 'ospf-interfesz', eszkoz: 'R2', port: 'GigabitEthernet0/0/0', prioritas: 100 },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'Indítsd újra az OSPF-folyamatot R1-en: `end`, `clear ip ospf process`, a kérdésre: `yes`.',
        miert: 'R1 minden szomszédsága leesik, és újraépül. Az R1–R2 szegmensen R2 nem talál DR-t maga mellett, ezért ő lesz a DR '
          + '(prioritás 100), R1 pedig a BDR. Figyelj: élesben ez egy pillanatra minden OSPF-szomszédságot bont!',
        be: ['end', 'clear ip ospf process', 'yes'],
        kesz: { tipus: 'ospf-interfesz', eszkoz: 'R2', port: 'GigabitEthernet0/0/0', allapot: 'DR' },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'Most R1-ről nézve tegyük drágábbá a közvetlen R3-as linket: `conf t`, `interface g0/0/1`, `ip ospf cost 50`, majd `do show ip route ospf`.',
        miert: 'A 192.168.{L3}.0/24 felé eddig a közvetlen út volt a legolcsóbb (10 + 10 = 20). Most az: 50 + 10 = 60, R2-n át viszont '
          + '10 + 10 + 10 = 30 – ezért R1 a G0/0/0-n, R2 felé küldi a forgalmat. A költség csak kifelé számít: R3 felől a közvetlen link maradt olcsó.',
        be: ['conf t', 'interface g0/0/1', 'ip ospf cost 50', 'do show ip route ospf'],
        kesz: { tipus: 'utvonal', eszkoz: 'R1', halozat: '192.168.{L3}.0/24', kod: 'O', port: 'GigabitEthernet0/0/0' },
      },
      {
        hol: 'terminal', eszkoz: 'PC1',
        szoveg: 'Nézd meg, merre megy a PC1 → PC3 forgalom: `tracert 192.168.{L3}.10`.',
        miert: 'Az első ugrás R1 (192.168.{L1}.1), a második R2 (10.0.12.2), a harmadik R3 (10.0.23.2) – a drágább közvetlen link helyett.',
        be: ['tracert 192.168.{L3}.10'],
        kesz: { tipus: 'parancs', eszkoz: 'PC1', szavak: ['tracert'] },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'MD5-hitelesítés az R1–R2 linken: `interface g0/0/0`, `ip ospf authentication message-digest`, `ip ospf message-digest-key 1 md5 {KULCS}`.',
        miert: 'Mostantól R1 csak hitelesített Hellót fogad el ezen a linken – R2 viszont még hitelesítés nélkül küldi. Kb. 40 másodperc '
          + 'múlva (Dead-idő) a szomszédság leesik: „from FULL to DOWN, Neighbor Down: Dead timer expired”.',
        be: ['interface g0/0/0', 'ip ospf authentication message-digest', 'ip ospf message-digest-key 1 md5 {KULCS}'],
        kesz: { tipus: 'ospf-interfesz', eszkoz: 'R1', port: 'GigabitEthernet0/0/0', hitelesites: 'md5' },
      },
      {
        hol: 'terminal', eszkoz: 'R2',
        szoveg: 'R2-n is: `interface g0/0/0`, `ip ospf authentication message-digest`, `ip ospf message-digest-key 1 md5 {KULCS}`.',
        miert: 'Ugyanaz a kulcsszám és ugyanaz a jelszó kell a link mindkét végén. Pár másodperc múlva a szomszédság újra FULL.',
        be: ['interface g0/0/0', 'ip ospf authentication message-digest', 'ip ospf message-digest-key 1 md5 {KULCS}'],
        kesz: { tipus: 'ospf-szomszed', eszkoz: 'R2', szomszed: '1.1.1.1', allapot: 'FULL' },
      },
      {
        hol: 'ellenorzes',
        szoveg: 'Kész vagy! Nyomd meg az Ellenőrzés gombot.',
        miert: 'A szimulátor megnézi a beállításokat, a szomszédságokat és a routing táblákat, és valódi pingeket küld a LAN-ok között és az internet felé.',
        kesz: { tipus: 'ellenorzes' },
      },
    ],
    magyarazat: [
      {
        cim: 'Mit csinál az OSPF?',
        szoveg: [
          'Az OSPF link-state (kapcsolatállapot-alapú) protokoll: minden router megismeri a teljes terület „térképét”, és abból maga számolja '
            + 'ki a legjobb utakat. A RIP-pel ellentétben nem a szomszédok véleményére hagyatkozik.',
          [
            'Metrika: a költség (cost) = referencia-sávszélesség ÷ az interfész sávszélessége. Egy útvonal költsége a kimenő interfészek költségeinek összege.',
            'Adminisztratív távolság: 110 (a RIP-é 120, a statikus útvonalé 1).',
            'A router ID (RID) a router neve az OSPF-ben: kézi megadás → legnagyobb loopback-cím → legnagyobb aktív interfész-cím.',
            'Változáskor azonnal hirdet (nem vár 30 másodpercet), ezért gyorsabban áll helyre, mint a RIP.',
          ],
        ],
      },
      {
        cim: 'Szomszédság: Hello és állapotok',
        szoveg: [
          'Az OSPF-interfészek 10 másodpercenként Hellót küldenek a 224.0.0.5 címre. Szomszédság csak akkor lesz, ha egyezik: a terület, '
            + 'a Hello- és a Dead-idő, az alhálózat és a maszk, a hitelesítés; a két router ID pedig különböző.',
          'Az állapotok: Down → Init → 2-Way → ExStart → Exchange → Loading → Full. A konzolon a FULL állapotról jön üzenet (%OSPF-5-ADJCHG). '
            + 'Ha 40 másodpercig (Dead-idő) nem jön Hello, a szomszéd „halott”.',
          'A beépített hiba (R3-on 5 másodperces Hello) a leggyakoribb OSPF-hibák egyike: a routerek „látják” egymás Hellóit, de eldobják őket. '
            + 'A `debug ip ospf hello` rögtön megmutatja, mi nem egyezik.',
        ],
      },
      {
        cim: 'A network parancs és a wildcard maszk',
        szoveg: [
          'A `network <cím> <wildcard> area <terület>` két dolgot csinál: bekapcsolja az OSPF-et a tartományba eső interfészeken, és hirdeti '
            + 'azok hálózatát. A wildcard maszk csak az interfészt választja ki – a hirdetett maszk mindig az interfészé.',
          'Wildcard = 255.255.255.255 − alhálózati maszk: /24 → 0.0.0.255, /30 → 0.0.0.3, egyetlen cím → 0.0.0.0.',
          'A másik módszer: az interfészen `ip ospf 1 area 0`. A szimulátor ezt is elfogadja. Egy routeren belül lehetőleg csak az egyiket használd.',
        ],
      },
      {
        cim: 'DR és BDR, pont-pont link',
        szoveg: [
          'Többhozzáférésű (pl. Ethernet) szegmensen a routerek egy kijelölt routert (DR) és egy tartalékot (BDR) választanak: mindenki csak '
            + 'velük épít teljes szomszédságot. A legnagyobb prioritású interfész nyer, egyenlőségnél a nagyobb router ID; a 0-s prioritású sosem lesz DR.',
          'A választás nem preemptív: aki már DR, az marad. Ezért lett a szimulátorban R1 a DR az R1–R2 linken (ő indult el először), és ezért '
            + 'kellett a `clear ip ospf process`. Ha a routerek egyszerre indulnak, a nagyobb router ID nyer – a lecke kimenetei ezt mutatják.',
          'Két router közötti Ethernet-linken nincs értelme a választásnak: az `ip ospf network point-to-point` (a link mindkét végén!) '
            + 'kikapcsolja, és a szomszédság is gyorsabban áll fel. A soros vonal alapból pont-pont.',
        ],
      },
      {
        cim: 'Költség és referencia-sávszélesség',
        szoveg: [
          'Az alap 100 Mbit/s-os referenciával a FastEthernet, a gigabites és a 10 gigabites link költsége is 1 – az OSPF nem tesz különbséget köztük. '
            + 'Az `auto-cost reference-bandwidth 10000` után a gigabites link 10, a FastEthernet 100. Minden routeren ugyanazt kell beállítani.',
          'Az `ip ospf cost` felülírja a számolt értéket. A költség irányfüggő: mindig a kimenő interfészé számít, ezért R3 felől a közvetlen link maradt a legjobb.',
        ],
      },
      {
        cim: 'Alapértelmezett útvonal és hitelesítés',
        szoveg: [
          'A `default-information originate` az OSPF-fel hirdeti a router alapértelmezett útvonalát; a többieknél O*E2 kóddal jelenik meg '
            + '(külső, 2-es típusú útvonal: a költsége nem nő útközben). Az `always` szóval akkor is hirdetné, ha a routernek nincs ilyen útvonala.',
          'MD5-hitelesítéssel csak az lehet szomszéd, aki ismeri a közös kulcsot (ugyanaz a kulcsszám és ugyanaz a jelszó a link mindkét végén).',
        ],
      },
      {
        cim: 'A szimulátor és a Packet Tracer',
        szoveg: [
          'A routerek itt ISR 4331 jellegűek, ezért a portnevek háromrészesek (G0/0/0); a leckében 2911-es routerek G0/0 alakú nevei szerepelnek.',
          'A szimulátor a valódi eszközt követi: a DR/BDR-választáshoz kivárja a Wait-időt (40 mp), és a debug-üzenetek az IOS XE formáját követik.',
          'Az idő valós: a 40 másodperces várakozások a rajz alatti sebességállítóval gyorsíthatók.',
        ],
      },
      {
        cim: 'Próbáld ki!',
        szoveg: [[
          'R2-n `show ip ospf database`: hány Router LSA és hány Net Link (Network LSA) van, és miért?',
          'R1-en `debug ip ospf adj`, majd R3-on `clear ip ospf process`: kövesd a szomszédsági állapotokat.',
          'Kapcsold le R2 G0/0/1 interfészét, és nézd meg PC2-ről a `tracert 192.168.{L3}.10` eredményét.',
          'R2-n `ping 192.168.{L3}.1 source g0/0/2`: a LAN-címről pingelve a visszautat is ellenőrzöd.',
        ]],
      },
    ],
  });
}(typeof window !== 'undefined' ? window : globalThis));
