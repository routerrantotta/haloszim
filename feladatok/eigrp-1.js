/*
 * Haloszim feladat: Dinamikus forgalomirányítás – EIGRP IPv4-en és IPv6-on (eigrp-1)
 *
 * A „Szakmai szerda · 005 · EIGRP” feladatlap (AS 100, PT 9.0-ban mérve) alapján: három router
 * háromszögben, mindegyik mögött egy LAN és egy loopback. Két „gyors” soros vonal (bandwidth 1544)
 * és egy „lassú” (bandwidth 64) – így ugyanahhoz a célhoz két különböző sebességű út vezet.
 * Ezen látszik a successor és a feasible successor fogalma, és az is, miért nem minden tartalék út
 * feasible successor (AD = FD esetén nem teljesül a feltétel).
 *
 * A címek, a sávszélességek és az órajelek ki vannak osztva; a tanuló dolga az EIGRP:
 * router eigrp + network wildcard maszkkal, eigrp router-id, no auto-summary, passive-interface,
 * a metrika kiértékelése, a hibatűrés kipróbálása (shutdown), és az EIGRP for IPv6.
 *
 * Újdonság a feladatfájlban: céltípusok eigrp, eigrp-szomszed, eigrp-topologia (src/feladat/ellenorzo.js),
 * és a kiindulo.<router>.portok.<port>.savszel / .orajel (bandwidth, clock rate).
 *
 * A feladatlap 2911-es portnevei (G0/0, S0/0/0, S0/0/1) itt ISR 4331 jellegűek:
 * G0/0 → G0/0/0, S0/0/0 → S0/1/0, S0/0/1 → S0/1/1.
 * Véletlen változatban a LAN-ok harmadik bájtja és az AS-szám változik (az IPv6-címek nem).
 */
(function (g) {
  (g.HaloszimFeladatok = g.HaloszimFeladatok || []).push({
    azon: 'eigrp-1',
    tipus: 'Dinamikus routing',
    cim: 'EIGRP (IPv4 és IPv6)',
    szint: 'haladó',
    ipv6: true,
    valtozok: {
      AS: { tipus: 'szam', alap: 100, min: 10, max: 650 },
      L1: { tipus: 'szam', alap: 1, min: 20, max: 199 },
      L2: { tipus: 'szam', alap: 2, min: 20, max: 199 },
      L3: { tipus: 'szam', alap: 3, min: 20, max: 199, kulonbozik: ['L1'] },
    },
    leiras: [
      'Három router (R1, R2, R3) háromszögben, soros vonalakkal; mindegyik mögött egy LAN és egy loopback. '
        + 'Az R1–R2 és az R2–R3 vonal gyors (sávszélesség 1544), az R1–R3 vonal viszont lassú (sávszélesség 64). '
        + 'Így ugyanahhoz a célhoz két különböző sebességű út vezet.',
      'A címek (IPv4 és IPv6), a sávszélességek és az órajelek már be vannak állítva, a PC-k is készen vannak. '
        + 'A feladat az EIGRP beállítása a {AS}-es AS-számmal, IPv4-en és IPv6-on, majd a DUAL algoritmus '
        + 'megfigyelése: melyik út lesz a successor, hol van feasible successor, és mi történik, ha kiesik egy vonal.',
      'Figyelem: a LAN-ok címzése nem összefüggő (diszkontiguóz) – a 172.16-os hálózat két külön helyen van, '
        + 'köztük egy 10.0.0.0-s WAN. Emiatt az automatikus összevonás (auto-summary) komoly galibát okoz.',
    ],
    lepesek: [
      {
        cel: 'Vizsgáld meg a kiinduló állapotot: az interfészek címeit, sávszélességét és késleltetését, a routing táblát, '
          + 'és győződj meg róla, hogy a LAN-ok még nem érik el egymást.',
        parancsok: 'Mindhárom routeren: `show ip interface brief`, `show ip route`; R1-en: `show interfaces s0/1/0` és '
          + '`show interfaces s0/1/1` (BW és DLY!); PC1-en: `ping 172.16.{L3}.10`',
        tippek: [
          'A show parancsok privilegizált módban (`enable` után) futnak.',
          'A show interfaces kimenetében a BW a sávszélesség (kbit/s), a DLY a késleltetés (µs) – az EIGRP ezekből számol metrikát.',
          'A routing táblában most csak C és L kódú sorok vannak: a router csak a közvetlenül kapcsolt hálózatait ismeri.',
        ],
      },
      {
        cel: 'Indítsd el az EIGRP-t mindhárom routeren a {AS}-es AS-számmal, és hirdesd meg a router saját, közvetlenül '
          + 'csatlakozó hálózatait: a LAN-t, a soros vonalakat és a loopbacket is. Használj wildcard maszkot, és állítsd be '
          + 'kézzel a router ID-t is (R1 = 1.1.1.1, R2 = 2.2.2.2, R3 = 3.3.3.3).',
        parancsok: '`router eigrp {AS}`, `eigrp router-id 1.1.1.1`, majd R1-en: `network 172.16.{L1}.0 0.0.0.255`, '
          + '`network 10.0.12.0 0.0.0.3`, `network 10.0.13.0 0.0.0.3`, `network 1.1.1.1 0.0.0.0`; R2 és R3 a saját '
          + 'hálózataival; ellenőrzés: `show ip eigrp neighbors` (mindenkinek két szomszédja legyen)',
        tippek: [
          'Az EIGRP-t globális konfigurációs módban indítod az AS-számmal; a beállításai a saját almódjában vannak.',
          'A wildcard maszk „fordított maszk”: 255.255.255.255 mínusz az alhálózati maszk (/24 → 0.0.0.255, /30 → 0.0.0.3, /32 → 0.0.0.0).',
          'Az AS-számnak a szomszédos routereken azonosnak kell lennie, különben nem lesz szomszédság.',
        ],
      },
      {
        cel: 'Kapcsold ki az automatikus összevonást mindhárom routeren, és ellenőrizd a show ip protocols kimenetében '
          + 'az Automatic Summarization sort. Előtte nézd meg a routing táblában, mit csinált az összevonás!',
        parancsok: 'R1-en: `show ip route` (D 172.16.0.0/16 is a summary … Null0), majd mindhárom routeren: '
          + '`router eigrp {AS}`, `no auto-summary`; utána `show ip protocols` és PC1-ről `ping 172.16.{L3}.10`',
        tippek: [
          'A két 172.16-os LAN között egy 10.0.0.0-s WAN van: összevonva mindkét router ugyanazt a 172.16.0.0/16-ot hirdeti.',
          'Az összevont útvonalat a router magának a Null0 interfészre teszi – ami oda kerül, azt eldobja.',
          'Az összevonás ki- és bekapcsolása az EIGRP almódjában történik.',
        ],
      },
      {
        cel: 'A LAN felé felesleges Hello csomagokat küldeni: ott nincs másik router. Állítsd passzívvá mindhárom router '
          + 'LAN-interfészét, majd ellenőrizd, hogy a LAN hálózata ettől még hirdetve van.',
        parancsok: '`router eigrp {AS}`, `passive-interface g0/0/0`; ellenőrzés: `show ip protocols` (Passive Interface(s)) '
          + 'és `show ip eigrp interfaces` (a passzív interfész nincs benne)',
        tippek: [
          'A passzív interfészen nincs Hello, így szomszéd sem lehet – a hálózatát viszont a többi routernek továbbra is hirdeti.',
          'A show ip eigrp interfaces csak azokat az interfészeket mutatja, amelyeken EIGRP-forgalom megy.',
        ],
      },
      {
        cel: 'Értékeld ki a metrikát: számold ki kézzel, mennyi R1-ről a LAN3 (172.16.{L3}.0/24) metrikája a két lehetséges '
          + 'úton, és ellenőrizd, hogy a router a gyorsabb, két ugrásos utat választja-e a lassú, egy ugrásos helyett.',
        parancsok: 'R1-en: `show interfaces s0/1/0`, `show interfaces s0/1/1`, `show ip route eigrp`, `show ip eigrp topology`',
        tippek: [
          'A metrika az alapértelmezett K-értékekkel: 256 × (10 000 000 / legkisebb sávszélesség + összes késleltetés / 10).',
          'A gigabites interfész sávszélessége 1 000 000 kbit/s, késleltetése 10 µs; a soros vonalé 20 000 µs.',
          'Nem a hopszám dönt, hanem a sávszélesség: a 2 ugrásos, gyors út jobb lehet, mint az 1 ugrásos, lassú.',
        ],
      },
      {
        cel: 'Keresd meg R3-on, melyik célhálózathoz tartozik két útvonalblokk (Routing Descriptor Block) és melyikhez csak egy, '
          + 'és értsd meg, miért: a feltételezhetőségi feltétel szerint egy szomszéd csak akkor lehet feasible successor, '
          + 'ha a hirdetett távolsága (AD) szigorúan kisebb a saját feasible distance-ünknél (FD).',
        parancsok: 'R3-on: `show ip eigrp topology 172.16.{L1}.0 255.255.255.0` (két blokk) és '
          + '`show ip eigrp topology 192.168.{L2}.0 255.255.255.0` (egy blokk); érdemes megnézni a 2.2.2.2 /32-t és az 1.1.1.1 /32-t is',
        tippek: [
          'A zárójeles számpár jelentése: (FD / AD) – az első a mi távolságunk, a második a szomszéd hirdetett távolsága.',
          'Ha AD = FD, a feltétel megbukik: a szimmetrikus úton lévő szomszéd nem lehet feasible successor.',
          'A sima show ip eigrp topology csak a successort és a feasible successorokat írja ki.',
        ],
      },
      {
        cel: 'Próbáld ki a hibatűrést: jegyezd fel R3-on a routing tábla uptime értékeit, kapcsold le a gyors vonalat, '
          + 'várj kb. 20 másodpercet, és hasonlítsd össze az uptime-okat. Végül kapcsold vissza a vonalat.',
        parancsok: 'R3-on: `show ip route eigrp`, majd `interface s0/1/0`, `shutdown`; várakozás után újra `show ip route eigrp`; '
          + 'végül `no shutdown`',
        tippek: [
          'Ahol van feasible successor, ott az útvonal nem is tűnik el: az uptime tovább nő.',
          'Ahol nincs, ott az útvonal Active állapotba megy, a router Query-t küld, és csak a Reply után épül újra – az uptime nulláról indul.',
          'A rajz alatti sebességállítóval gyorsítható a várakozás.',
        ],
      },
      {
        cel: 'Állítsd be az EIGRP-t IPv6-ra is: engedélyezd az IPv6-továbbítást, indítsd el az IPv6-os folyamatot ugyanazzal '
          + 'az AS-számmal (ne feledd elindítani a folyamatot!), add meg a router ID-t, és kapcsold be az EIGRP-t minden '
          + 'résztvevő interfészen – network parancs itt nincs.',
        parancsok: '`ipv6 unicast-routing`, `ipv6 router eigrp {AS}`, `eigrp router-id 1.1.1.1`, `no shutdown`, majd az '
          + 'interfészeken: `ipv6 eigrp {AS}`; ellenőrzés: `show ipv6 eigrp neighbors`, `show ipv6 route`',
        tippek: [
          'IPv6-továbbítás nélkül semmi nem fog működni – ez a leggyakrabban elfelejtett első lépés.',
          'Az IPv6-os EIGRP-folyamat leállított (shutdown) állapotban jön létre: ki kell adni rá a `no shutdown`-t.',
          'A szomszédokat a link-local címükkel azonosítja; a D betűs sorok a show ipv6 route kimenetében az EIGRP-től tanultak.',
        ],
      },
      {
        cel: 'Végső ellenőrzés: minden PC érje el a másik kettőt IPv4-en és IPv6-on is.',
        parancsok: 'PC1-en: `ping 192.168.{L2}.10`, `ping 172.16.{L3}.10`, `ping 2001:DB8:ACAD:3::10`',
        tippek: [
          'Az első ping gyakran elveszik az ARP / szomszédfelderítés miatt – ismételd meg, mielőtt hibát keresnél.',
          'Ha valami nem megy, a show ip eigrp neighbors és a show ip route eigrp a két legfontosabb parancs.',
        ],
      },
    ],
    cimterv: [
      { eszkoz: 'R1', interfesz: 'G0/0/0', ip: '172.16.{L1}.1/24', ipv6: '2001:DB8:ACAD:1::1/64', hova: 'LAN1' },
      { eszkoz: 'R1', interfesz: 'S0/1/0', ip: '10.0.12.1/30', ipv6: '2001:DB8:ACAD:12::1/64', hova: 'R2 (BW 1544)' },
      { eszkoz: 'R1', interfesz: 'S0/1/1', ip: '10.0.13.1/30', ipv6: '2001:DB8:ACAD:13::1/64', hova: 'R3 (BW 64)' },
      { eszkoz: 'R1', interfesz: 'Lo0', ip: '1.1.1.1/32', ipv6: '2001:DB8:ACAD:FF::1/128', hova: '–' },
      { eszkoz: 'R2', interfesz: 'G0/0/0', ip: '192.168.{L2}.1/24', ipv6: '2001:DB8:ACAD:2::2/64', hova: 'LAN2' },
      { eszkoz: 'R2', interfesz: 'S0/1/0', ip: '10.0.12.2/30', ipv6: '2001:DB8:ACAD:12::2/64', hova: 'R1 (BW 1544)' },
      { eszkoz: 'R2', interfesz: 'S0/1/1', ip: '10.0.23.1/30', ipv6: '2001:DB8:ACAD:23::2/64', hova: 'R3 (BW 1544)' },
      { eszkoz: 'R2', interfesz: 'Lo0', ip: '2.2.2.2/32', ipv6: '2001:DB8:ACAD:FF::2/128', hova: '–' },
      { eszkoz: 'R3', interfesz: 'G0/0/0', ip: '172.16.{L3}.1/24', ipv6: '2001:DB8:ACAD:3::3/64', hova: 'LAN3' },
      { eszkoz: 'R3', interfesz: 'S0/1/0', ip: '10.0.23.2/30', ipv6: '2001:DB8:ACAD:23::3/64', hova: 'R2 (BW 1544)' },
      { eszkoz: 'R3', interfesz: 'S0/1/1', ip: '10.0.13.2/30', ipv6: '2001:DB8:ACAD:13::3/64', hova: 'R1 (BW 64)' },
      { eszkoz: 'R3', interfesz: 'Lo0', ip: '3.3.3.3/32', ipv6: '2001:DB8:ACAD:FF::3/128', hova: '–' },
      { eszkoz: 'PC1', interfesz: 'Fa0', ip: '172.16.{L1}.10/24', ipv6: '2001:DB8:ACAD:1::10/64', atjaro: '172.16.{L1}.1 / FE80::1', hova: 'LAN1' },
      { eszkoz: 'PC2', interfesz: 'Fa0', ip: '192.168.{L2}.10/24', ipv6: '2001:DB8:ACAD:2::10/64', atjaro: '192.168.{L2}.1 / FE80::2', hova: 'LAN2' },
      { eszkoz: 'PC3', interfesz: 'Fa0', ip: '172.16.{L3}.10/24', ipv6: '2001:DB8:ACAD:3::10/64', atjaro: '172.16.{L3}.1 / FE80::3', hova: 'LAN3' },
    ],
    topologia: {
      meret: { szel: 760, mag: 540 },
      eszkozok: [
        { nev: 'R1', tipus: 'router', x: 385, y: 180, felirat: 'jobbra' },
        { nev: 'R2', tipus: 'router', x: 215, y: 350, felirat: 'balra' },
        { nev: 'R3', tipus: 'router', x: 555, y: 350, felirat: 'jobbra' },
        { nev: 'PC1', tipus: 'pc', x: 300, y: 52 },
        { nev: 'PC2', tipus: 'pc', x: 160, y: 420 },
        { nev: 'PC3', tipus: 'pc', x: 600, y: 420 },
      ],
      kabelek: [
        ['R1', 'GigabitEthernet0/0/0', 'PC1', 'FastEthernet0'],
        ['R1', 'Serial0/1/0', 'R2', 'Serial0/1/0', { soros: true }],
        ['R1', 'Serial0/1/1', 'R3', 'Serial0/1/1', { soros: true }],
        ['R2', 'Serial0/1/1', 'R3', 'Serial0/1/0', { soros: true }],
        ['R2', 'GigabitEthernet0/0/0', 'PC2', 'FastEthernet0'],
        ['R3', 'GigabitEthernet0/0/0', 'PC3', 'FastEthernet0'],
      ],
      feliratok: [
        { x: 372, y: 36, igazit: 'start', szoveg: 'LAN1\n172.16.{L1}.0/24', halvany: true },
        { x: 268, y: 246, igazit: 'end', szoveg: '10.0.12.0/30\nBW 1544' },
        { x: 492, y: 246, igazit: 'start', szoveg: '10.0.13.0/30\nBW 64 (lassú)' },
        { x: 385, y: 342, szoveg: '10.0.23.0/30 · BW 1544' },
        { x: 385, y: 374, szoveg: 'EIGRP AS {AS}', halvany: true },
        { x: 150, y: 470, igazit: 'end', szoveg: 'LAN2\n192.168.{L2}.0/24', halvany: true },
        { x: 752, y: 470, igazit: 'end', szoveg: 'LAN3\n172.16.{L3}.0/24', halvany: true },
      ],
    },
    kiindulo: {
      R1: {
        portok: {
          'GigabitEthernet0/0/0': {
            ip: '172.16.{L1}.1', maszk: '255.255.255.0', ipv6: ['2001:DB8:ACAD:1::1/64'], linkLocal: 'FE80::1', leiras: 'LAN1',
          },
          'Serial0/1/0': {
            ip: '10.0.12.1', maszk: '255.255.255.252', ipv6: ['2001:DB8:ACAD:12::1/64'], linkLocal: 'FE80::1',
            savszel: 1544, orajel: 2000000, leiras: 'R2 fele (DCE)',
          },
          'Serial0/1/1': {
            ip: '10.0.13.1', maszk: '255.255.255.252', ipv6: ['2001:DB8:ACAD:13::1/64'], linkLocal: 'FE80::1',
            savszel: 64, orajel: 64000, leiras: 'R3 fele (DCE, lassu)',
          },
          Loopback0: { ip: '1.1.1.1', maszk: '255.255.255.255', ipv6: ['2001:DB8:ACAD:FF::1/128'] },
        },
      },
      R2: {
        portok: {
          'GigabitEthernet0/0/0': {
            ip: '192.168.{L2}.1', maszk: '255.255.255.0', ipv6: ['2001:DB8:ACAD:2::2/64'], linkLocal: 'FE80::2', leiras: 'LAN2',
          },
          'Serial0/1/0': {
            ip: '10.0.12.2', maszk: '255.255.255.252', ipv6: ['2001:DB8:ACAD:12::2/64'], linkLocal: 'FE80::2',
            savszel: 1544, leiras: 'R1 fele',
          },
          'Serial0/1/1': {
            ip: '10.0.23.1', maszk: '255.255.255.252', ipv6: ['2001:DB8:ACAD:23::2/64'], linkLocal: 'FE80::2',
            savszel: 1544, orajel: 2000000, leiras: 'R3 fele (DCE)',
          },
          Loopback0: { ip: '2.2.2.2', maszk: '255.255.255.255', ipv6: ['2001:DB8:ACAD:FF::2/128'] },
        },
      },
      R3: {
        portok: {
          'GigabitEthernet0/0/0': {
            ip: '172.16.{L3}.1', maszk: '255.255.255.0', ipv6: ['2001:DB8:ACAD:3::3/64'], linkLocal: 'FE80::3', leiras: 'LAN3',
          },
          'Serial0/1/0': {
            ip: '10.0.23.2', maszk: '255.255.255.252', ipv6: ['2001:DB8:ACAD:23::3/64'], linkLocal: 'FE80::3',
            savszel: 1544, leiras: 'R2 fele',
          },
          'Serial0/1/1': {
            ip: '10.0.13.2', maszk: '255.255.255.252', ipv6: ['2001:DB8:ACAD:13::3/64'], linkLocal: 'FE80::3',
            savszel: 64, leiras: 'R1 fele (lassu)',
          },
          Loopback0: { ip: '3.3.3.3', maszk: '255.255.255.255', ipv6: ['2001:DB8:ACAD:FF::3/128'] },
        },
      },
      PC1: {
        ip: '172.16.{L1}.10', maszk: '255.255.255.0', atjaro: '172.16.{L1}.1',
        ipv6: '2001:DB8:ACAD:1::10', ipv6Hossz: 64, ipv6Atjaro: 'FE80::1',
      },
      PC2: {
        ip: '192.168.{L2}.10', maszk: '255.255.255.0', atjaro: '192.168.{L2}.1',
        ipv6: '2001:DB8:ACAD:2::10', ipv6Hossz: 64, ipv6Atjaro: 'FE80::2',
      },
      PC3: {
        ip: '172.16.{L3}.10', maszk: '255.255.255.0', atjaro: '172.16.{L3}.1',
        ipv6: '2001:DB8:ACAD:3::10', ipv6Hossz: 64, ipv6Atjaro: 'FE80::3',
      },
    },
    celok: [
      // --- az EIGRP-folyamatok (IPv4) ---
      { tipus: 'eigrp', eszkoz: 'R1', as: '{AS}', routerId: '1.1.1.1', autoSummary: false,
        interfeszek: ['GigabitEthernet0/0/0', 'Serial0/1/0', 'Serial0/1/1', 'Loopback0'], passziv: ['GigabitEthernet0/0/0'],
        szoveg: 'R1: EIGRP a(z) {AS}-es AS-ben, router ID 1.1.1.1, mind a négy hálózat benne, passzív LAN, auto-summary kikapcsolva' },
      { tipus: 'eigrp', eszkoz: 'R2', as: '{AS}', routerId: '2.2.2.2', autoSummary: false,
        interfeszek: ['GigabitEthernet0/0/0', 'Serial0/1/0', 'Serial0/1/1', 'Loopback0'], passziv: ['GigabitEthernet0/0/0'],
        szoveg: 'R2: EIGRP router ID 2.2.2.2, passzív LAN, auto-summary kikapcsolva' },
      { tipus: 'eigrp', eszkoz: 'R3', as: '{AS}', routerId: '3.3.3.3', autoSummary: false,
        interfeszek: ['GigabitEthernet0/0/0', 'Serial0/1/0', 'Serial0/1/1', 'Loopback0'], passziv: ['GigabitEthernet0/0/0'],
        szoveg: 'R3: EIGRP router ID 3.3.3.3, passzív LAN, auto-summary kikapcsolva' },
      // --- szomszédságok ---
      { tipus: 'eigrp-szomszed', eszkoz: 'R1', cim: '10.0.12.2', port: 'Serial0/1/0', szoveg: 'R1 szomszédja R2 (10.0.12.2) a gyors vonalon' },
      { tipus: 'eigrp-szomszed', eszkoz: 'R1', cim: '10.0.13.2', port: 'Serial0/1/1', szoveg: 'R1 szomszédja R3 (10.0.13.2) a lassú vonalon' },
      { tipus: 'eigrp-szomszed', eszkoz: 'R2', cim: '10.0.23.2', port: 'Serial0/1/1', szoveg: 'R2 szomszédja R3 (10.0.23.2)' },
      // --- a metrika döntése: a gyors, két ugrásos út nyer ---
      { tipus: 'utvonal', eszkoz: 'R1', halozat: '172.16.{L3}.0/24', kod: 'D', port: 'Serial0/1/0',
        szoveg: 'R1 a LAN3-at R2-n át (a gyors vonalon) éri el, nem a közvetlen lassú vonalon' },
      { tipus: 'utvonal', eszkoz: 'R3', halozat: '172.16.{L1}.0/24', kod: 'D', port: 'Serial0/1/0',
        szoveg: 'R3 a LAN1-et R2-n át éri el' },
      { tipus: 'utvonal', eszkoz: 'R1', halozat: '192.168.{L2}.0/24', kod: 'D', port: 'Serial0/1/0',
        szoveg: 'R1 a LAN2-t EIGRP-ből tanulta meg' },
      { tipus: 'utvonal', eszkoz: 'R2', halozat: '1.1.1.1/32', kod: 'D', szoveg: 'R2 ismeri R1 loopback címét (1.1.1.1/32)' },
      { tipus: 'utvonal', eszkoz: 'R1', halozat: '172.16.0.0/16', nincs: true, ellenproba: true,
        szoveg: 'R1 táblájában NINCS összevont 172.16.0.0/16 útvonal (az auto-summary ki van kapcsolva)' },
      // --- successor és feasible successor (a feladat lényege) ---
      { tipus: 'eigrp-topologia', eszkoz: 'R3', halozat: '172.16.{L1}.0/24', successor: '10.0.23.1', fs: true,
        szoveg: 'R3: a LAN1-hez VAN feasible successor (R1 hirdetett távolsága kisebb az FD-nél)' },
      { tipus: 'eigrp-topologia', eszkoz: 'R3', halozat: '192.168.{L2}.0/24', successor: '10.0.23.1', fs: false,
        szoveg: 'R3: a LAN2-hez NINCS feasible successor (AD = FD, a feltétel megbukik)' },
      { tipus: 'eigrp-topologia', eszkoz: 'R3', halozat: '2.2.2.2/32', fs: false,
        szoveg: 'R3: a 2.2.2.2/32-hez sincs feasible successor (ugyanaz a szimmetria)' },
      { tipus: 'eigrp-topologia', eszkoz: 'R3', halozat: '1.1.1.1/32', fs: true,
        szoveg: 'R3: az 1.1.1.1/32-hez van feasible successor' },
      { tipus: 'eigrp-topologia', eszkoz: 'R3', halozat: '10.0.12.0/30', fs: true,
        szoveg: 'R3: a 10.0.12.0/30-hoz is van feasible successor' },
      // --- EIGRP for IPv6 ---
      { tipus: 'eigrp', eszkoz: 'R1', csalad: 6, as: '{AS}', routerId: '1.1.1.1', leallitva: false,
        interfeszek: ['GigabitEthernet0/0/0', 'Serial0/1/0', 'Serial0/1/1', 'Loopback0'],
        szoveg: 'R1: az IPv6-os EIGRP-folyamat fut (no shutdown), és minden interfészen be van kapcsolva' },
      { tipus: 'eigrp', eszkoz: 'R2', csalad: 6, as: '{AS}', routerId: '2.2.2.2', leallitva: false,
        interfeszek: ['GigabitEthernet0/0/0', 'Serial0/1/0', 'Serial0/1/1', 'Loopback0'],
        szoveg: 'R2: az IPv6-os EIGRP-folyamat fut, minden interfészen bekapcsolva' },
      { tipus: 'eigrp', eszkoz: 'R3', csalad: 6, as: '{AS}', routerId: '3.3.3.3', leallitva: false,
        interfeszek: ['GigabitEthernet0/0/0', 'Serial0/1/0', 'Serial0/1/1', 'Loopback0'],
        szoveg: 'R3: az IPv6-os EIGRP-folyamat fut, minden interfészen bekapcsolva' },
      { tipus: 'eigrp-szomszed', eszkoz: 'R1', csalad: 6, cim: 'FE80::2', port: 'Serial0/1/0',
        szoveg: 'R1 IPv6-szomszédja R2 (FE80::2) – a link-local címével azonosítva' },
      { tipus: 'utvonal', eszkoz: 'R1', halozat: '2001:DB8:ACAD:3::/64', kod: 'D', szoveg: 'R1 EIGRP-ből tanulta meg a LAN3 IPv6-hálózatát' },
      { tipus: 'utvonal', eszkoz: 'R3', halozat: '2001:DB8:ACAD:1::/64', kod: 'D', szoveg: 'R3 EIGRP-ből tanulta meg a LAN1 IPv6-hálózatát' },
      { tipus: 'utvonal', eszkoz: 'R2', halozat: '2001:DB8:ACAD:FF::1/128', kod: 'D', szoveg: 'R2 ismeri R1 IPv6-loopback címét' },
      // --- próbák ---
      { tipus: 'ping', honnan: 'PC1', ip: '192.168.{L2}.10', szoveg: 'PC1 → PC2 ping (IPv4)' },
      { tipus: 'ping', honnan: 'PC1', ip: '172.16.{L3}.10', db: 3, szoveg: 'PC1 → PC3 ping (IPv4), többször egymás után is' },
      { tipus: 'ping', honnan: 'PC3', ip: '192.168.{L2}.10', szoveg: 'PC3 → PC2 ping (IPv4)' },
      { tipus: 'ping', honnan: 'PC2', ip: '1.1.1.1', szoveg: 'PC2 → R1 loopback (1.1.1.1) ping' },
      { tipus: 'ping', honnan: 'PC1', ip: '2001:DB8:ACAD:3::10', szoveg: 'PC1 → PC3 IPv6-ping' },
      { tipus: 'ping', honnan: 'PC3', ip: '2001:DB8:ACAD:1::10', szoveg: 'PC3 → PC1 IPv6-ping' },
      { tipus: 'ping', honnan: 'PC2', ip: '2001:DB8:ACAD:3::10', szoveg: 'PC2 → PC3 IPv6-ping' },
    ],
    bemutato: [
      {
        hol: 'eszkoz', eszkoz: 'R1',
        szoveg: 'Kezdjük R1-gyel: kattints rá a rajzon (vagy fent az R1 fülre).',
        miert: 'R1-en fut össze a két soros vonal: egy gyors (R2 felé) és egy lassú (R3 felé). Ez a topológia lelke.',
        kesz: { tipus: 'kivalasztva', eszkoz: 'R1' },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'Nézd meg a kiinduló állapotot: `enable`, majd `show ip interface brief` és `show ip route`.',
        miert: 'Minden interfész up/up, a címek megvannak. A routing táblában viszont csak C (connected) és L (local) sorok '
          + 'vannak: R1 a 192.168.{L2}.0 és a 172.16.{L3}.0 hálózatról nem tud.',
        be: ['enable', 'show ip interface brief', 'show ip route'],
        kesz: { tipus: 'parancs', eszkoz: 'R1', szavak: ['show', 'ip', 'route'] },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'Nézd meg a két soros vonal adatait: `show interfaces s0/1/0`, majd `show interfaces s0/1/1`.',
        miert: 'A „BW 1544 Kbit/sec, DLY 20000 usec” sor a lényeg: a sávszélesség és a késleltetés. Az S0/1/1-en BW 64 – '
          + 'ez a lassú vonal. Az EIGRP ezekből számol metrikát, nem a tényleges sebességből.',
        be: ['show interfaces s0/1/0', 'show interfaces s0/1/1'],
        kesz: { tipus: 'parancs', eszkoz: 'R1', szavak: ['show', 'interfaces'] },
      },
      {
        hol: 'terminal', eszkoz: 'PC1',
        szoveg: 'Próbáld ki PC1-ről: `ping 172.16.{L3}.10`.',
        miert: 'Nem megy: R1 visszaszól, hogy nem ismeri a célhálózatot (Destination net unreachable). Még nincs forgalomirányítás.',
        be: ['ping 172.16.{L3}.10'],
        kesz: { tipus: 'parancs', eszkoz: 'PC1', szavak: ['ping'] },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'Indítsd el az EIGRP-t R1-en: `configure terminal`, `router eigrp {AS}`, `eigrp router-id 1.1.1.1`, majd '
          + '`network 172.16.{L1}.0 0.0.0.255`, `network 10.0.12.0 0.0.0.3`, `network 10.0.13.0 0.0.0.3`, `network 1.1.1.1 0.0.0.0`.',
        miert: 'Az AS-szám ({AS}) a szomszédokon is ugyanennyi lesz – különben nincs szomszédság. A network parancs itt is '
          + 'csak kiválasztja az interfészeket (a wildcard maszkkal), a hirdetett maszk mindig az interfészé. A loopbacket a '
          + '0.0.0.0-s wildcard maszk fogja meg: pontosan egy cím.',
        be: ['configure terminal', 'router eigrp {AS}', 'eigrp router-id 1.1.1.1', 'network 172.16.{L1}.0 0.0.0.255',
          'network 10.0.12.0 0.0.0.3', 'network 10.0.13.0 0.0.0.3', 'network 1.1.1.1 0.0.0.0'],
        kesz: { tipus: 'eigrp', eszkoz: 'R1', routerId: '1.1.1.1',
          interfeszek: ['GigabitEthernet0/0/0', 'Serial0/1/0', 'Serial0/1/1', 'Loopback0'] },
      },
      {
        hol: 'terminal', eszkoz: 'R2',
        szoveg: 'R2-n ugyanez: `en`, `conf t`, `router eigrp {AS}`, `eigrp router-id 2.2.2.2`, `network 192.168.{L2}.0 0.0.0.255`, '
          + '`network 10.0.12.0 0.0.0.3`, `network 10.0.23.0 0.0.0.3`, `network 2.2.2.2 0.0.0.0`.',
        miert: 'Néhány másodperc múlva megjelenik a konzolon a `%DUAL-5-NBRCHANGE … is up: new adjacency` üzenet: kész az '
          + 'R1–R2 szomszédság. A rajzon közben látod a Hello (lila) csomagokat és utána az Update csomagokat.',
        be: ['en', 'conf t', 'router eigrp {AS}', 'eigrp router-id 2.2.2.2', 'network 192.168.{L2}.0 0.0.0.255',
          'network 10.0.12.0 0.0.0.3', 'network 10.0.23.0 0.0.0.3', 'network 2.2.2.2 0.0.0.0'],
        kesz: { tipus: 'eigrp-szomszed', eszkoz: 'R2', cim: '10.0.12.1' },
      },
      {
        hol: 'terminal', eszkoz: 'R3',
        szoveg: 'R3-on is: `en`, `conf t`, `router eigrp {AS}`, `eigrp router-id 3.3.3.3`, `network 172.16.{L3}.0 0.0.0.255`, '
          + '`network 10.0.23.0 0.0.0.3`, `network 10.0.13.0 0.0.0.3`, `network 3.3.3.3 0.0.0.0`.',
        miert: 'R3-nak két szomszédja lesz: R2 a gyors vonalon (10.0.23.1) és R1 a lassún (10.0.13.1). Ezzel mindhárom '
          + 'routernek két-két szomszédja van – pont ezt kéri a feladatlap ellenőrzésként.',
        be: ['en', 'conf t', 'router eigrp {AS}', 'eigrp router-id 3.3.3.3', 'network 172.16.{L3}.0 0.0.0.255',
          'network 10.0.23.0 0.0.0.3', 'network 10.0.13.0 0.0.0.3', 'network 3.3.3.3 0.0.0.0'],
        kesz: [
          { tipus: 'eigrp-szomszed', eszkoz: 'R3', cim: '10.0.23.1' },
          { tipus: 'eigrp-szomszed', eszkoz: 'R3', cim: '10.0.13.1' },
        ],
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'Nézd meg R1 szomszédait: `do show ip eigrp neighbors`.',
        miert: 'A H oszlop a szomszéd sorszáma, a Hold a visszaszámláló (gyárilag 15 másodpercről, a Hello 5 másodpercenként '
          + 'megy), az Uptime pedig azt mutatja, mióta él a szomszédság.',
        be: ['do show ip eigrp neighbors'],
        kesz: { tipus: 'parancs', eszkoz: 'R1', szavak: ['show', 'ip', 'eigrp', 'neighbors'] },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'Most nézd meg a routing táblát: `do show ip route`.',
        miert: 'Itt a galiba: `D 172.16.0.0/16 is a summary … Null0`. Az automatikus összevonás (auto-summary) gyárilag be van '
          + 'kapcsolva, és R1 a saját 172.16-os LAN-ját a 10.0.0.0-s vonalak felé osztályos hálózatként (172.16.0.0/16) hirdeti – '
          + 'ráadásul magának is felvesz egy ilyen útvonalat a Null0-ra, ami minden oda kerülő csomagot eldob.',
        be: ['do show ip route'],
        kesz: { tipus: 'parancs', eszkoz: 'R1', szavak: ['show', 'ip', 'route'] },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'Próbáld ki magáról R1-ről is: `do ping 172.16.{L3}.10`.',
        miert: 'Öt pont (`.....`), 0 százalék – pedig a szomszédságok megvannak! A csomag R1-en a 172.16.0.0/16-os összevont '
          + 'útvonalra illik, az pedig a Null0-ra visz. Ez a diszkontiguóz címzés klasszikus csapdája.',
        be: ['do ping 172.16.{L3}.10'],
        kesz: { tipus: 'parancs', eszkoz: 'R1', szavak: ['ping'] },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'Kapcsold ki az összevonást R1-en: `router eigrp {AS}`, `no auto-summary`.',
        miert: 'Mostantól R1 az alhálózatot (172.16.{L1}.0/24) hirdeti a maszkjával együtt, és a Null0-s összefoglaló is eltűnik '
          + 'a táblájából. A másik két routeren is ki kell kapcsolni.',
        be: ['router eigrp {AS}', 'no auto-summary'],
        kesz: { tipus: 'eigrp', eszkoz: 'R1', autoSummary: false },
      },
      {
        hol: 'terminal', eszkoz: 'R2',
        szoveg: 'R2-n is: `router eigrp {AS}`, `no auto-summary`.',
        miert: 'R2-nek a 192.168-as LAN-ja C osztályú, ott az összevonásnak nincs látható hatása – de a 10.0.0.0-s vonalait '
          + 'is ő hirdeti, ezért itt is ki kell kapcsolni, hogy mindenki ugyanúgy számoljon.',
        be: ['router eigrp {AS}', 'no auto-summary'],
        kesz: { tipus: 'eigrp', eszkoz: 'R2', autoSummary: false },
      },
      {
        hol: 'terminal', eszkoz: 'R3',
        szoveg: 'R3-on is: `router eigrp {AS}`, `no auto-summary`.',
        miert: 'R3 ugyanúgy 172.16-os LAN-t rejt, mint R1 – ezért nála is összevonás volt. Most mindhárom router a tényleges '
          + 'alhálózatokat hirdeti.',
        be: ['router eigrp {AS}', 'no auto-summary'],
        kesz: { tipus: 'eigrp', eszkoz: 'R3', autoSummary: false },
      },
      {
        hol: 'terminal', eszkoz: 'PC1',
        szoveg: 'És most PC1-ről: `tracert 172.16.{L3}.10`.',
        miert: 'Megy! A nyomkövetés mutatja az utat is: első ugrás R1 (172.16.{L1}.1), második R2 (10.0.12.2), harmadik R3 – '
          + 'vagyis a gyors vonalon, nem a közvetlen lassún. R1 táblájában már a konkrét 172.16.{L3}.0/24 útvonal van, '
          + 'az összevont 172.16.0.0/16 helyett.',
        be: ['tracert 172.16.{L3}.10'],
        kesz: [
          { tipus: 'utvonal', eszkoz: 'R1', halozat: '172.16.{L3}.0/24', kod: 'D' },
          { tipus: 'parancs', eszkoz: 'PC1', szavak: ['tracert'] },
        ],
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'A LAN felé nem kell Hello: `router eigrp {AS}`, `passive-interface g0/0/0`.',
        miert: 'A LAN-on nincs másik router, a Hello csak terheli a hálózatot (és biztonsági kockázat is). A passzív '
          + 'interfész hálózatát az EIGRP ettől még hirdeti a többieknek – ezt mindjárt ellenőrizzük is.',
        be: ['router eigrp {AS}', 'passive-interface g0/0/0'],
        kesz: { tipus: 'eigrp', eszkoz: 'R1', passziv: ['GigabitEthernet0/0/0'] },
      },
      {
        hol: 'terminal', eszkoz: 'R2',
        szoveg: 'R2-n is: `router eigrp {AS}`, `passive-interface g0/0/0`.',
        miert: 'Ugyanaz a megfontolás. A szomszédságok a soros vonalakon vannak, azokat nem bántjuk.',
        be: ['router eigrp {AS}', 'passive-interface g0/0/0'],
        kesz: { tipus: 'eigrp', eszkoz: 'R2', passziv: ['GigabitEthernet0/0/0'] },
      },
      {
        hol: 'terminal', eszkoz: 'R3',
        szoveg: 'R3-on is: `router eigrp {AS}`, `passive-interface g0/0/0`.',
        miert: 'R3 most az EIGRP almódjában van; a `passive-interface` innen megy. (Ha interfész módban lennél, a '
          + '`router eigrp {AS}` innen is működik: a router előbb kilép.)',
        be: ['router eigrp {AS}', 'passive-interface g0/0/0'],
        kesz: { tipus: 'eigrp', eszkoz: 'R3', passziv: ['GigabitEthernet0/0/0'] },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'Ellenőrizd: `do show ip protocols`.',
        miert: 'Itt egyben látod a router ID-t, az `Automatic Summarization: disabled` sort, a „Routing for Networks” listát '
          + '(a network parancsokat) és a „Passive Interface(s)” alatt a LAN-interfészt. Lentebb a Routing Information '
          + 'Sources: kiktől tanul útvonalat (90-es adminisztratív távolsággal).',
        be: ['do show ip protocols'],
        kesz: { tipus: 'parancs', eszkoz: 'R1', szavak: ['show', 'ip', 'protocols'] },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'Nézd meg: `do show ip eigrp interfaces`.',
        miert: 'Csak a két soros interfész szerepel benne: a passzív LAN-interfész nincs a listában, mert ott nem megy '
          + 'EIGRP-forgalom. A Peers oszlopban 1-1 szomszéd.',
        be: ['do show ip eigrp interfaces'],
        kesz: { tipus: 'parancs', eszkoz: 'R1', szavak: ['show', 'ip', 'eigrp', 'interfaces'] },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'És a metrika: `do show ip route eigrp`.',
        miert: 'A LAN3 (172.16.{L3}.0/24) sorban [90/2682112]: a 90 az EIGRP adminisztratív távolsága, a 2 682 112 a metrika. '
          + 'Kézzel: 256 × (10 000 000/1544 + 40 010/10) = 256 × (6476 + 4001). A kimenő interfész S0/1/0, vagyis R2 felé – '
          + 'pedig R3 közvetlenül is ott van! A lassú vonalon a metrika 256 × (10 000 000/64 + 20 010/10) ≈ 40,5 millió. '
          + 'Nem a hopszám dönt, hanem a sávszélesség.',
        be: ['do show ip route eigrp'],
        kesz: [
          { tipus: 'utvonal', eszkoz: 'R1', halozat: '172.16.{L3}.0/24', kod: 'D', port: 'Serial0/1/0' },
          { tipus: 'parancs', eszkoz: 'R1', szavak: ['show', 'ip', 'route', 'eigrp'] },
        ],
      },
      {
        hol: 'terminal', eszkoz: 'R3',
        szoveg: 'Most R3 a főszereplő: `do show ip eigrp topology`.',
        miert: 'A topológiatáblában minden célhálózat előtt P (Passive) áll – ez a jó állapot. A „via …” sorokban a zárójeles '
          + 'számpár: (a mi metrikánk / a szomszéd hirdetett távolsága), azaz (FD/AD). A sima kimenet csak a successort és a '
          + 'feasible successorokat írja ki.',
        be: ['do show ip eigrp topology'],
        kesz: { tipus: 'parancs', eszkoz: 'R3', szavak: ['show', 'ip', 'eigrp', 'topology'] },
      },
      {
        hol: 'terminal', eszkoz: 'R3',
        szoveg: 'Az első eset: `do show ip eigrp topology 172.16.{L1}.0 255.255.255.0`.',
        miert: 'KÉT útvonalblokk (Routing Descriptor Block) van. Az FD 2 682 112 (R2-n át), a tartalék R1 közvetlenül: az ő '
          + 'hirdetett távolsága mindössze 2816 – ennyibe kerül R1-nek a saját gigabites LAN-ja: 256 × (10 + 1). '
          + 'Mivel 2816 < 2 682 112, a feltételezhetőségi feltétel teljesül: R1 feasible successor.',
        be: ['do show ip eigrp topology 172.16.{L1}.0 255.255.255.0'],
        kesz: { tipus: 'parancs', eszkoz: 'R3', szavak: ['show', 'ip', 'eigrp', 'topology', '172.16.{L1}.0'] },
      },
      {
        hol: 'terminal', eszkoz: 'R3',
        szoveg: 'A másik eset: `do show ip eigrp topology 192.168.{L2}.0 255.255.255.0`.',
        miert: 'Csak EGY blokk. Az FD 2 170 112 (egy soros vonal + egy gigabites LAN R2-ig). R1 hirdetett távolsága ugyanehhez '
          + 'a hálózathoz szintén 2 170 112 – mert R1 is pontosan egy ugyanilyen soros vonalon át éri el. AD = FD, és a '
          + 'feltételben SZIGORÚ kisebb kell: R1 nem lehet feasible successor. Ugyanez a helyzet a 2.2.2.2/32-vel is.',
        be: ['do show ip eigrp topology 192.168.{L2}.0 255.255.255.0'],
        kesz: { tipus: 'parancs', eszkoz: 'R3', szavak: ['show', 'ip', 'eigrp', 'topology', '192.168.{L2}.0'] },
      },
      {
        hol: 'terminal', eszkoz: 'R3',
        szoveg: 'Jegyezd fel az uptime-okat (`do show ip route eigrp`), majd kapcsold le a gyors vonalat: `conf t`, '
          + '`interface s0/1/0`, `shutdown`.',
        miert: 'Mindkét útvonal successora R2 volt – de csak az egyikhez van feasible successor. A 172.16.{L1}.0/24 azonnal '
          + 'átvált a lassú vonalra (R1 lép be), a 192.168.{L2}.0/24 viszont Active állapotba megy: R3 Query-t küld R1-nek, '
          + 'és csak a Reply után épül újra az útvonal.',
        be: ['do show ip route eigrp', 'conf t', 'interface s0/1/0', 'shutdown'],
        kesz: { tipus: 'utvonal', eszkoz: 'R3', halozat: '192.168.{L2}.0/24', kod: 'D', port: 'Serial0/1/1' },
      },
      {
        hol: 'terminal', eszkoz: 'R3',
        szoveg: 'Nézd meg újra: `do show ip route eigrp`.',
        miert: 'A lényeg az uptime oszlopban van: a 172.16.{L1}.0/24 uptime-ja folyamatosan nőtt tovább (az útvonal soha nem '
          + 'tűnt el, a feasible successor azonnal belépett), a 192.168.{L2}.0/24 viszont nulláról indult újra (az útvonal '
          + 'törlődött, a DUAL Active állapotba ment, kérdezett, és csak a válasz után épült újra).',
        be: ['do show ip route eigrp'],
        kesz: { tipus: 'parancs', eszkoz: 'R3', szavak: ['show', 'ip', 'route', 'eigrp'] },
      },
      {
        hol: 'terminal', eszkoz: 'R3',
        szoveg: 'Kapcsold vissza a vonalat: `interface s0/1/0`, `no shutdown`.',
        miert: 'A szomszédság néhány másodperc múlva újraépül, és minden útvonal visszatér a gyors vonalra. Figyeld meg, '
          + 'milyen gyorsan: az EIGRP nem vár periodikus frissítésre, hanem azonnal küld Update-et.',
        be: ['interface s0/1/0', 'no shutdown'],
        kesz: { tipus: 'utvonal', eszkoz: 'R3', halozat: '192.168.{L2}.0/24', kod: 'D', port: 'Serial0/1/0' },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'Jöhet az IPv6. R1-en: `conf t`, `ipv6 unicast-routing`, `ipv6 router eigrp {AS}`, `eigrp router-id 1.1.1.1`, `no shutdown`.',
        miert: 'Három dolog kell az IPv6-os EIGRP-hez: az IPv6-továbbítás engedélyezése, a folyamat elindítása – és a '
          + 'leggyakrabban elfelejtett `no shutdown`, mert az IPv6-os folyamat leállított állapotban jön létre. A router ID '
          + 'itt is IPv4-es alakú.',
        be: ['conf t', 'ipv6 unicast-routing', 'ipv6 router eigrp {AS}', 'eigrp router-id 1.1.1.1', 'no shutdown'],
        kesz: { tipus: 'eigrp', eszkoz: 'R1', csalad: 6, routerId: '1.1.1.1', leallitva: false },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'Kapcsold be az interfészeken: `interface range g0/0/0, s0/1/0 - 1`, `ipv6 eigrp {AS}`, majd `interface lo0`, `ipv6 eigrp {AS}`.',
        miert: 'Itt nincs network parancs: minden résztvevő interfészen külön be kell kapcsolni. (Az interface range egyszerre '
          + 'több interfészt állít.) A loopbacket is érdemes bevenni, hogy az IPv6-loopback is hirdetve legyen.',
        be: ['interface range g0/0/0, s0/1/0 - 1', 'ipv6 eigrp {AS}', 'interface lo0', 'ipv6 eigrp {AS}'],
        kesz: { tipus: 'eigrp', eszkoz: 'R1', csalad: 6,
          interfeszek: ['GigabitEthernet0/0/0', 'Serial0/1/0', 'Serial0/1/1', 'Loopback0'] },
      },
      {
        hol: 'terminal', eszkoz: 'R2',
        szoveg: 'R2-n ugyanez: `conf t`, `ipv6 unicast-routing`, `ipv6 router eigrp {AS}`, `eigrp router-id 2.2.2.2`, '
          + '`no shutdown`, `interface range g0/0/0, s0/1/0 - 1`, `ipv6 eigrp {AS}`, `interface lo0`, `ipv6 eigrp {AS}`.',
        miert: 'Amint mindkét oldalon megvan, megjelenik a `%DUAL-5-NBRCHANGE: EIGRP-IPv6 … Neighbor FE80::1 … is up` üzenet. '
          + 'Az IPv6-os EIGRP a szomszédokat a link-local címükkel azonosítja.',
        be: ['conf t', 'ipv6 unicast-routing', 'ipv6 router eigrp {AS}', 'eigrp router-id 2.2.2.2', 'no shutdown',
          'interface range g0/0/0, s0/1/0 - 1', 'ipv6 eigrp {AS}', 'interface lo0', 'ipv6 eigrp {AS}'],
        kesz: { tipus: 'eigrp-szomszed', eszkoz: 'R2', csalad: 6, cim: 'FE80::1' },
      },
      {
        hol: 'terminal', eszkoz: 'R3',
        szoveg: 'R3-on is: `conf t`, `ipv6 unicast-routing`, `ipv6 router eigrp {AS}`, `eigrp router-id 3.3.3.3`, '
          + '`no shutdown`, `interface range g0/0/0, s0/1/0 - 1`, `ipv6 eigrp {AS}`, `interface lo0`, `ipv6 eigrp {AS}`.',
        miert: 'Ezzel az IPv6-os háromszög is kész. Az IPv4-es és az IPv6-os EIGRP két külön folyamat: külön szomszédság, '
          + 'külön topológiatábla – a metrikát viszont ugyanúgy számolja.',
        be: ['conf t', 'ipv6 unicast-routing', 'ipv6 router eigrp {AS}', 'eigrp router-id 3.3.3.3', 'no shutdown',
          'interface range g0/0/0, s0/1/0 - 1', 'ipv6 eigrp {AS}', 'interface lo0', 'ipv6 eigrp {AS}'],
        kesz: { tipus: 'eigrp-szomszed', eszkoz: 'R3', csalad: 6, cim: 'FE80::2' },
      },
      {
        hol: 'terminal', eszkoz: 'R1',
        szoveg: 'R1-en: `do show ipv6 eigrp neighbors`, majd `do show ipv6 route`.',
        miert: 'A szomszédok a link-local címükkel szerepelnek („Link-local address:” után a következő sorban). A show ipv6 '
          + 'route kimenetében a D betűs sorok az EIGRP-től tanultak – a Packet Tracer a `show ipv6 route eigrp` szűkített '
          + 'alakot nem ismeri, ezért is érdemes a D betűket keresni.',
        be: ['do show ipv6 eigrp neighbors', 'do show ipv6 route'],
        kesz: [
          { tipus: 'utvonal', eszkoz: 'R1', halozat: '2001:DB8:ACAD:3::/64', kod: 'D' },
          { tipus: 'parancs', eszkoz: 'R1', szavak: ['show', 'ipv6', 'route'] },
        ],
      },
      {
        hol: 'terminal', eszkoz: 'PC1',
        szoveg: 'Végül PC1-ről: `ping 2001:DB8:ACAD:3::10`.',
        miert: 'Ugyanaz az út, csak IPv6-on. Az első csomag itt is elveszhet a szomszédfelderítés (ND) miatt.',
        be: ['ping 2001:DB8:ACAD:3::10'],
        kesz: { tipus: 'parancs', eszkoz: 'PC1', szavak: ['ping', '2001:DB8:ACAD:3::10'] },
      },
      {
        hol: 'ellenorzes',
        szoveg: 'Kész vagy! Nyomd meg az Ellenőrzés gombot.',
        miert: 'A szimulátor megnézi a beállításokat, a szomszédságokat, a topológiatáblát (van-e feasible successor, ahol '
          + 'lennie kell) és a routing táblákat, majd valódi pingeket küld a LAN-ok között IPv4-en és IPv6-on.',
        kesz: { tipus: 'ellenorzes' },
      },
    ],
    magyarazat: [
      {
        cim: 'Mit csinál az EIGRP?',
        szoveg: [
          'Az EIGRP fejlett távolságvektor-alapú (más szóval hibrid) protokoll: a szomszédoktól tanul útvonalakat, mint a RIP, '
            + 'de a DUAL algoritmussal előre kiszámolja a tartalék utat is, ezért kiesésnél szinte azonnal átvált.',
          [
            'Metrika az alapértelmezett K-értékekkel (K1 = K3 = 1): 256 × (10 000 000 / legkisebb sávszélesség[kbit/s] + összes késleltetés[µs] / 10).',
            'Adminisztratív távolság: 90 (belső), 170 (külső, redistribute-olt). A statikus útvonal 1, az OSPF 110, a RIP 120.',
            'Nincs periodikus frissítés: csak változáskor küld Update-et, egyébként 5 másodpercenként Hellót (Hold 15 mp).',
            'A szomszédsághoz azonos AS-szám és azonos K-értékek kellenek (a router ID-nek nem kell egyeznie – sőt, eltérőnek kell lennie).',
          ],
        ],
      },
      {
        cim: 'Successor, feasible successor, FD és AD',
        szoveg: [
          'A topológiatáblában minden célhálózathoz annyi bejegyzés van, ahány szomszédtól hallottunk róla. Kettő szám tartozik '
            + 'mindegyikhez: az FD (feasible distance) a mi saját távolságunk az adott szomszédon át, az AD (advertised distance, '
            + 'más néven reported distance) pedig az, amennyibe a szomszédnak kerül. A kimenetben: (FD/AD).',
          'A successor a legkisebb metrikájú szomszéd – ő kerül a routing táblába. Egy másik szomszéd akkor lehet feasible '
            + 'successor (azonnal bevethető tartalék), ha az ő AD-je SZIGORÚAN kisebb a jelenlegi FD-nknél. Ez a '
            + 'feltételezhetőségi feltétel (feasibility condition), és ez biztosítja, hogy a tartalék út ne vezessen vissza '
            + 'rajtunk keresztül (ne legyen hurok).',
          'Ebben a topológiában a 172.16.{L1}.0/24-hez R3 szemszögéből van feasible successor (R1 AD-je 2816, az FD 2 682 112), '
            + 'a 192.168.{L2}.0/24-hez viszont nincs: R1 ugyanolyan paraméterű soros vonalon át éri el, ezért az AD pontosan '
            + 'annyi, mint az FD (2 170 112). Egyenlőségnél a feltétel megbukik – és pont ettől lesz tanulságos a feladat.',
        ],
      },
      {
        cim: 'DUAL: Passive és Active állapot',
        szoveg: [
          'Ha a successor kiesik és van feasible successor, a router azonnal átvált rá: az útvonal nem is tűnik el a táblából, '
            + 'ezért az uptime tovább nő. Ez a „Passive” (nyugalmi) állapot – ez a jó.',
          'Ha nincs feasible successor, az útvonal Active állapotba megy: a router Query-t küld a szomszédoknak („tudja valaki az '
            + 'utat?”), és csak a Reply-ok megérkezése után épül újra az útvonal. Ilyenkor az uptime nulláról indul. Az Active '
            + 'állapot rosszabb, mert tart egy ideig (a hálózat mérete szerint akár másodpercekig), és terheli a routereket; '
            + 'ha a válasz elmarad, a router „stuck in active” (SIA) állapotba kerülhet.',
          'A szimulátorban a Query-t fogadó router a saját táblájából válaszol, és nem megy maga is Active állapotba (egy '
            + 'háromszögben ez nem is szükséges) – a valódi eszköz tovább kérdezhet.',
        ],
      },
      {
        cim: 'Az auto-summary és a diszkontiguóz címzés',
        szoveg: [
          'Az automatikus összevonás az osztályhatáron (172.16.0.0/16, 10.0.0.0/8 …) összevonja az alhálózatokat, ha a hirdetés '
            + 'másik osztályos hálózat felé megy. Itt R1 és R3 is 172.16-os LAN-t rejt, köztük 10.0.0.0-s WAN: mindkettő ugyanazt '
            + 'a 172.16.0.0/16-ot hirdeti, és mindkettő felvesz magának egy 172.16.0.0/16 → Null0 útvonalat. Ami a Null0-ra megy, '
            + 'az eldobódik – a két LAN nem éri el egymást.',
          'Megoldás: `no auto-summary` (így az alhálózatok a maszkjukkal mennek ki). A valódi IOS 15 / IOS XE verziókban ez már '
            + 'az alapértelmezés; a Packet Tracerben (és a régebbi IOS-ekben) viszont be van kapcsolva – a szimulátor itt '
            + 'szándékosan a Packet Tracert követi, hogy a feladat kísérlete (bekapcsolás, majd visszakapcsolás) elvégezhető legyen.',
          'Érdekesség: a loopbackek (1.1.1.1/32, 2.2.2.2/32, 3.3.3.3/32) mind más osztályos hálózatban vannak, ezért rájuk az '
            + 'összevonás nem okoz gondot – ott az összevont útvonal és a cél ugyanazon a routeren van.',
        ],
      },
      {
        cim: 'A network parancs, a wildcard maszk és a passzív interfész',
        szoveg: [
          'A `network <cím> <wildcard>` nem a hirdetett maszkot adja meg, hanem azt választja ki, mely interfészeken fusson az '
            + 'EIGRP – a hirdetett maszk mindig az interfészé. Wildcard maszk nélkül a cím osztályos hálózatként értendő '
            + '(`network 172.16.0.0` = minden 172.16-os interfész).',
          'A `passive-interface` kikapcsolja a Hellót, így ott nem lehet szomszéd – a hálózat viszont továbbra is hirdetve van, '
            + 'mert az a router saját, kapcsolt hálózata. Ezért érdemes a LAN-interfészeket passzívvá tenni: kevesebb forgalom, '
            + 'kisebb támadási felület.',
          'Az EIGRP a split horizon elvet is alkalmazza: amit egy interfészen tanult, azt ott nem hirdeti vissza.',
        ],
      },
      {
        cim: 'Ellenőrző kérdések (a feladatlapról)',
        szoveg: [[
          'Miért kell azonos AS-szám a szomszédos routereken? (Eltérő AS-nél a Hello csomagot a router eldobja, szomszédság sem lesz.)',
          'Mi a különbség az FD és az AD között? (Az FD a mi távolságunk, az AD a szomszéd távolsága ugyanahhoz a célhoz.)',
          'Miért szigorúan kisebb a feltétel? (Egyenlőségnél a tartalék út átvezethetne rajtunk – hurok keletkezhetne.)',
          'Megváltoztatja a `bandwidth` a vonal tényleges sebességét? (Nem, csak a metrikát; a `clock rate` viszont a valódi órajelet állítja.)',
          'Miért nincs network parancs az EIGRP for IPv6-ban? (Nincsenek osztályok, és a folyamatot interfészenként kapcsoljuk be.)',
          'Melyik AD-vel kerül be egy belső EIGRP-útvonal? (90; a külső, redistribute-olt 170-nel.)',
        ]],
      },
      {
        cim: 'A szimulátor és a Packet Tracer',
        szoveg: [
          'A routerek itt ISR 4331 jellegűek, ezért a portnevek háromrészesek: a feladatlap G0/0 → G0/0/0, S0/0/0 → S0/1/0, '
            + 'S0/0/1 → S0/1/1 néven szerepel.',
          'A `clock rate 1544000` a Packet Tracerben nem létezik (csak egy rögzített lista fogadható el), ezért a gyors vonalakon '
            + 'ott `clock rate 2000000` van, miközben a `bandwidth 1544` maradt – a metrikát a bandwidth adja. A szimulátorban az '
            + 'órajel csak eltárolódik, a vonal sebességét nem befolyásolja.',
          'A szimulátorban nincs csomagvesztés és nincs újraküldés (az Update, Query és Reply után nyugta megy, de nincs RTO-mérés), '
            + 'ezért az SRTT, RTO és Q Cnt oszlopok állandó értékeket mutatnak. A `show interfaces` forgalomszámlálói nullák, '
            + 'a BW és a DLY viszont valódi – ebből számol az EIGRP.',
        ],
      },
      {
        cim: 'Próbáld ki!',
        szoveg: [[
          'R3-on `show ip eigrp topology 10.0.12.0 255.255.255.252`: itt is van feasible successor – miért?',
          'Állíts be R1 S0/1/1-en `bandwidth 1544`-et: megváltozik-e, melyik út a successor? (A feladat „varázslata” elromlik – érdemes visszaállítani.)',
          'Kapcsolj be R1-en `debug eigrp packets`-et, majd R3-on `clear ip eigrp neighbors`: kövesd a Hello, Update, Query és Reply csomagokat.',
          'Kapcsold vissza az auto-summary-t R1-en és R3-on, és nézd meg a 172.16.0.0/16-os Null0-s útvonalat a show ip route kimenetében.',
          'R2-n `show ip eigrp topology 2.2.2.2 255.255.255.255`: a saját loopback metrikája 128 256 – miből jön ez a szám?',
        ]],
      },
    ],
  });
}(typeof window !== 'undefined' ? window : globalThis));
