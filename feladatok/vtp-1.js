/*
 * Haloszim feladat: VTP – server, transparent, client (vtp-1)
 *
 * Egy feladat = egy fájl (a felépítés leírása: feladatok/vlan-1.js).
 * A szövegekben a `…` közötti rész parancsként (egyenközű betűvel) jelenik meg.
 */
(function (g) {
  var NEVEK = ['IRODA', 'RAKTAR', 'PENZUGY', 'MARKETING', 'FEJLESZTES', 'VEZETOSEG', 'ERTEKESITES', 'HR',
    'VENDEG', 'LABOR', 'SZERVIZ', 'GYARTAS', 'LOGISZTIKA', 'OKTATAS', 'UGYFELSZOLGALAT'];
  (g.HaloszimFeladatok = g.HaloszimFeladatok || []).push({
    azon: 'vtp-1',
    tipus: 'VLAN',
    cim: 'VTP: server, transparent, client',
    szint: 'haladó',
    // Véletlen adatok (gyakorló és vizsga mód) – lásd vlan-1.js és src/feladat/veletlen.js.
    valtozok: {
      VLAN1: { tipus: 'szam', alap: 10, min: 2, max: 254 },
      VLAN2: { tipus: 'szam', alap: 20, min: 2, max: 254, kulonbozik: ['VLAN1'] },
      HELYI: { tipus: 'szam', alap: 99, min: 2, max: 254, kulonbozik: ['VLAN1', 'VLAN2'] },
      REGI: { tipus: 'szam', alap: 30, min: 2, max: 254, kulonbozik: ['VLAN1', 'VLAN2', 'HELYI'] },
      NEV1: { tipus: 'lista', alap: 'IRODA', lista: NEVEK },
      NEV2: { tipus: 'lista', alap: 'RAKTAR', lista: NEVEK, kulonbozik: ['NEV1'] },
      NEVH: { tipus: 'lista', alap: 'SAJAT', lista: ['SAJAT', 'HELYI', 'KAMERA', 'NYOMTATO', 'MGMT', 'BIZTONSAG'] },
      TARTOMANY: { tipus: 'lista', alap: 'ROUTERRANTOTTA', lista: ['ROUTERRANTOTTA', 'KOZPONT', 'TELEPHELY', 'CAMPUS', 'IRODAHAZ', 'LABOR'] },
      JELSZO: { tipus: 'jelszo', alap: 'Rantotta2026', lista: ['Rantotta', 'Titok', 'Vtp', 'Kapcsolo', 'Halozat'] },
      REVIZIO: { tipus: 'szam', alap: 15, min: 6, max: 60 },
      H1: { tipus: 'szam', alap: 11, min: 2, max: 250 },
      H2: { tipus: 'szam', alap: 12, min: 2, max: 250 },
      H3: { tipus: 'szam', alap: 13, min: 2, max: 250, kulonbozik: ['H1'] },
      H4: { tipus: 'szam', alap: 14, min: 2, max: 250, kulonbozik: ['H2'] },
    },
    leiras: [
      'Három switch van sorban: SW1 – SW2 – SW3. A VLAN-okat csak SW1-en szeretnénk karbantartani, a többi '
        + 'switch a VTP (VLAN Trunking Protocol) segítségével kapja meg őket. SW2 középen transparent módban lesz: '
        + 'továbbengedi a hirdetéseket, de a saját VLAN-jait maga kezeli.',
      'Figyelem: SW3 egy régi laborból került ide, és még a régi beállításait őrzi. Mielőtt bármit '
        + 'összekötsz, nézd meg, milyen VTP-állapotban van!',
      'A PC-k IP-címe már be van állítva (lásd a címtervet).',
    ],
    // Teendők: cel (parancs nélkül), parancsok (oktató mód), tippek (gyakorló mód) – lásd vlan-1.js.
    lepesek: [
      {
        cel: 'SW3 régi beállításai ne írhassák felül a hálózatot: SW3 legyen VTP-kliens, nullázott revíziószámmal.',
        parancsok: 'SW3: `show vtp status` (a revízió {REVIZIO}!), majd `vtp mode transparent`, `vtp mode client`',
        tippek: [
          'Nézd meg SW3 VTP-állapotát: mekkora a „Configuration Revision”?',
          'A revíziót egy olyan szerepváltás nullázza, amelyben a switch nem vesz részt a VTP-ben. '
            + 'A server → client váltás NEM nulláz.',
        ],
      },
      {
        cel: 'Mindhárom switch ugyanabban a VTP-tartományban legyen ({TARTOMANY}), ugyanazzal a jelszóval ({JELSZO}).',
        parancsok: 'Mindhárom switchen: `vtp domain {TARTOMANY}`, `vtp password {JELSZO}`',
        tippek: ['Mindkét beállítás globális konfigurációs módban, a `vtp` szóval kezdődik. A tartománynév kis- és nagybetű-érzékeny!'],
      },
      {
        cel: 'SW1 legyen a VTP-server, SW2 transparent; a tartomány a 2-es VTP-verziót használja.',
        parancsok: 'SW1: `vtp version 2` (server gyárilag). SW2: `vtp mode transparent`, `vtp version 2`',
        tippek: [
          'A verziót a serveren elég beállítani, a hirdetés elviszi a kliensekhez – de a transparent switchhez nem.',
          'A szerep: `vtp mode …`, a verzió: `vtp version …`.',
        ],
      },
      {
        cel: 'A hálózatban legyen {VLAN1|es} VLAN {NEV1} és {VLAN2|es} VLAN {NEV2} néven – a VTP-n keresztül eljutva SW3-ra is.',
        parancsok: 'SW1: `vlan {VLAN1}`, `name {NEV1}`, `vlan {VLAN2}`, `name {NEV2}`',
        tippek: [
          'VLAN-t csak a serveren érdemes létrehozni: a kliensen nem is lehet.',
          'A tartomány és a jelszó legyen már beállítva, mielőtt létrehozod a VLAN-okat – a tartománynév megadása nullázza a revíziót.',
        ],
      },
      {
        cel: 'SW2-n a forgalom átmenjen {VLAN1|aes} és {VLAN2|es} VLAN-ban, és legyen egy csak helyben használt VLAN is: {HELYI} {NEVH}.',
        parancsok: 'SW2: `vlan {VLAN1}`, `vlan {VLAN2}`, `vlan {HELYI}`, `name {NEVH}`',
        tippek: [
          'A transparent switch nem veszi át a hirdetett VLAN-okat – amit használni akar, azt magának kell létrehoznia.',
        ],
      },
      {
        cel: 'A switchek közötti kapcsolatok (SW1 Gi0/1 – SW2 Gi0/1, SW2 Gi0/2 – SW3 Gi0/1) vigyék át az összes VLAN forgalmát és a VTP-hirdetéseket.',
        parancsok: 'SW1 és SW3: `interface gi0/1`, `switchport mode trunk`; SW2: `interface range gi0/1 - 2`, `switchport mode trunk`',
        tippek: [
          'A VTP-hirdetés csak trunkon megy át.',
          'Eltérő tartományú switchek között a dinamikus egyeztetés (DTP) nem hoz létre trunkot – kapcsold be kifejezetten.',
        ],
      },
      {
        cel: 'SW1-en és SW3-on a Fa0/1 port access port legyen {VLAN1|aes} VLAN-ban, a Fa0/2 {VLAN2|aes} VLAN-ban.',
        parancsok: '`interface fa0/1`, `switchport mode access`, `switchport access vlan {VLAN1}`; '
          + '`interface fa0/2`, `switchport mode access`, `switchport access vlan {VLAN2}`',
        tippek: ['A VTP csak a VLAN-ok listáját terjeszti; a portok beállítását minden switchen külön kell elvégezni.'],
      },
      {
        cel: 'Győződj meg róla, hogy SW3 átvette a VLAN-okat, a régi VLAN-ok eltűntek, és PC1 eléri PC3-at, PC2 a PC4-et.',
        parancsok: '`show vtp status` és `show vlan brief` mindhárom switchen; PC1-en `ping 192.168.{VLAN1}.{H3}`. Végül: Ellenőrzés.',
        tippek: ['Hasonlítsd össze a revíziószámokat: SW1-nek és SW3-nak egyeznie kell, SW2-é 0.'],
      },
    ],
    cimterv: [
      { eszkoz: 'PC1', ip: '192.168.{VLAN1}.{H1}', maszk: '255.255.255.0', vlan: '{VLAN1}', hova: 'SW1 Fa0/1' },
      { eszkoz: 'PC2', ip: '192.168.{VLAN2}.{H2}', maszk: '255.255.255.0', vlan: '{VLAN2}', hova: 'SW1 Fa0/2' },
      { eszkoz: 'PC3', ip: '192.168.{VLAN1}.{H3}', maszk: '255.255.255.0', vlan: '{VLAN1}', hova: 'SW3 Fa0/1' },
      { eszkoz: 'PC4', ip: '192.168.{VLAN2}.{H4}', maszk: '255.255.255.0', vlan: '{VLAN2}', hova: 'SW3 Fa0/2' },
    ],
    topologia: {
      meret: { szel: 1090, mag: 400 },
      eszkozok: [
        { nev: 'SW1', tipus: 'switch', x: 30, y: 70 },
        { nev: 'SW2', tipus: 'switch', x: 389, y: 70 },
        { nev: 'SW3', tipus: 'switch', x: 748, y: 70 },
        { nev: 'PC1', tipus: 'pc', x: 30, y: 270 },
        { nev: 'PC2', tipus: 'pc', x: 200, y: 270 },
        { nev: 'PC3', tipus: 'pc', x: 748, y: 270 },
        { nev: 'PC4', tipus: 'pc', x: 918, y: 270 },
      ],
      kabelek: [
        ['SW1', 'FastEthernet0/1', 'PC1', 'FastEthernet0'],
        ['SW1', 'FastEthernet0/2', 'PC2', 'FastEthernet0'],
        ['SW3', 'FastEthernet0/1', 'PC3', 'FastEthernet0'],
        ['SW3', 'FastEthernet0/2', 'PC4', 'FastEthernet0'],
        ['SW1', 'GigabitEthernet0/1', 'SW2', 'GigabitEthernet0/1'],
        ['SW2', 'GigabitEthernet0/2', 'SW3', 'GigabitEthernet0/1'],
      ],
    },
    kiindulo: {
      PC1: { ip: '192.168.{VLAN1}.{H1}', maszk: '255.255.255.0' },
      PC2: { ip: '192.168.{VLAN2}.{H2}', maszk: '255.255.255.0' },
      PC3: { ip: '192.168.{VLAN1}.{H3}', maszk: '255.255.255.0' },
      PC4: { ip: '192.168.{VLAN2}.{H4}', maszk: '255.255.255.0' },
      // A „régi labor” maradványa: ugyanaz a tartomány és jelszó, de {REVIZIO|es} revízió és régi VLAN-ok.
      SW3: {
        vtp: { mod: 'server', tartomany: '{TARTOMANY}', jelszo: '{JELSZO}', verzio: 1, revizio: '{REVIZIO}' },
        vlanok: { '{VLAN1}': 'REGI_LABOR', '{REGI}': 'TESZT' },
      },
    },
    celok: [
      { tipus: 'vtp', eszkoz: 'SW1', mod: 'server', tartomany: '{TARTOMANY}', jelszo: '{JELSZO}', verzio: 2, szoveg: 'SW1: VTP server, {TARTOMANY}, jelszó, version 2' },
      { tipus: 'vtp', eszkoz: 'SW2', mod: 'transparent', tartomany: '{TARTOMANY}', jelszo: '{JELSZO}', verzio: 2, szoveg: 'SW2: VTP transparent, {TARTOMANY}, jelszó, version 2' },
      { tipus: 'vtp', eszkoz: 'SW3', mod: 'client', tartomany: '{TARTOMANY}', jelszo: '{JELSZO}', verzio: 2, szoveg: 'SW3: VTP client, {TARTOMANY}, jelszó, version 2 (a servertől)' },
      { tipus: 'trunk', eszkoz: 'SW1', port: 'GigabitEthernet0/1', szoveg: 'SW1 Gi0/1 – SW2 Gi0/1: működő trunk' },
      { tipus: 'trunk', eszkoz: 'SW2', port: 'GigabitEthernet0/2', szoveg: 'SW2 Gi0/2 – SW3 Gi0/1: működő trunk' },
      { tipus: 'vlan', eszkoz: 'SW1', vlan: '{VLAN1}', nev: '{NEV1}', szoveg: 'SW1: {VLAN1|es} VLAN, neve {NEV1}' },
      { tipus: 'vlan', eszkoz: 'SW1', vlan: '{VLAN2}', nev: '{NEV2}', szoveg: 'SW1: {VLAN2|es} VLAN, neve {NEV2}' },
      { tipus: 'vtp-szinkron', eszkoz: 'SW3', forras: 'SW1', szoveg: 'SW3 a VTP-n át átvette SW1 VLAN-jait (azonos revízió, azonos VLAN-ok)' },
      { tipus: 'vlan', eszkoz: 'SW2', vlan: '{VLAN1}', szoveg: 'SW2: van {VLAN1|es} VLAN (transparent: kézzel)' },
      { tipus: 'vlan', eszkoz: 'SW2', vlan: '{VLAN2}', szoveg: 'SW2: van {VLAN2|es} VLAN (transparent: kézzel)' },
      { tipus: 'vlan', eszkoz: 'SW2', vlan: '{HELYI}', nev: '{NEVH}', szoveg: 'SW2: helyi VLAN {HELYI} {NEVH}' },
      { tipus: 'access-port', eszkoz: 'SW1', port: 'FastEthernet0/1', vlan: '{VLAN1}', szoveg: 'SW1 Fa0/1 (PC1): access, VLAN {VLAN1}' },
      { tipus: 'access-port', eszkoz: 'SW1', port: 'FastEthernet0/2', vlan: '{VLAN2}', szoveg: 'SW1 Fa0/2 (PC2): access, VLAN {VLAN2}' },
      { tipus: 'access-port', eszkoz: 'SW3', port: 'FastEthernet0/1', vlan: '{VLAN1}', szoveg: 'SW3 Fa0/1 (PC3): access, VLAN {VLAN1}' },
      { tipus: 'access-port', eszkoz: 'SW3', port: 'FastEthernet0/2', vlan: '{VLAN2}', szoveg: 'SW3 Fa0/2 (PC4): access, VLAN {VLAN2}' },
      { tipus: 'ping', honnan: 'PC1', cel: 'PC3', vart: true, szoveg: 'Ping PC1 → PC3 megy (VLAN {VLAN1}, három switchen át)' },
      { tipus: 'ping', honnan: 'PC2', cel: 'PC4', vart: true, szoveg: 'Ping PC2 → PC4 megy (VLAN {VLAN2}, három switchen át)' },
      { tipus: 'vlan-nincs', eszkoz: 'SW1', vlan: '{REGI}', ellenproba: true, szoveg: 'Ellenpróba: a régi labor VLAN-jai nem írták felül SW1-et (nincs {REGI|es} VLAN)' },
      { tipus: 'vlan-nincs', eszkoz: 'SW3', vlan: '{REGI}', ellenproba: true, szoveg: 'Ellenpróba: a régi {REGI|es} VLAN eltűnt SW3-ról is' },
      { tipus: 'vlan-nincs', eszkoz: 'SW1', vlan: '{HELYI}', ellenproba: true, szoveg: 'Ellenpróba: SW2 helyi VLAN-ja ({HELYI}) nem került át SW1-re' },
      { tipus: 'vlan-nincs', eszkoz: 'SW3', vlan: '{HELYI}', ellenproba: true, szoveg: 'Ellenpróba: SW2 helyi VLAN-ja ({HELYI}) nem került át SW3-ra' },
      {
        tipus: 'szoras', honnan: 'PC1', elerje: ['PC3'], neErje: ['PC2', 'PC4'], ellenproba: true,
        szoveg: 'Ellenpróba: PC1 szórása csak PC3-hoz jut el, PC2-höz és PC4-hez nem',
      },
    ],
    magyarazat: [
      {
        cim: 'Mire jó a VTP?',
        szoveg: [
          'Sok switch esetén fárasztó és hibalehetőség, ha minden VLAN-t minden switchen kézzel kell létrehozni. '
            + 'A VTP ezt automatizálja: a VLAN-okat egy helyen (a serveren) hozod létre, és a switch a trunkokon '
            + 'keresztül hirdeti őket a tartomány többi tagjának.',
          'Fontos: a VTP csak a VLAN-ok LISTÁJÁT (szám + név) terjeszti. Hogy melyik port melyik VLAN-ban van, azt '
            + 'továbbra is minden switchen külön kell beállítani – ezért kellett SW3-on is `switchport access vlan`.',
        ],
      },
      {
        cim: 'A három szerep',
        szoveg: [[
          'server – VLAN-t hozhat létre, törölhet, átnevezhet; minden módosításnál nő a revíziószám, és hirdeti az új állapotot. A switch gyárilag server.',
          'client – nem módosíthat VLAN-t (`VTP VLAN configuration not allowed when device is in CLIENT mode.`), a nagyobb revíziójú hirdetést átveszi és továbbadja.',
          'transparent – nem vesz részt: a saját VLAN-jait helyben kezeli (ezek a running-configban is látszanak), a mások hirdetését csak továbbengedi. A revíziószáma mindig 0.',
        ]],
      },
      {
        cim: 'A revíziószám – és a csapda',
        szoveg: [
          'Minden switch azt az adatbázist tartja meg, amelyiknek NAGYOBB a revíziószáma. Ez akkor is igaz, ha a '
            + 'nagyobb számú switch kliens! SW3 egy régi laborból jött {REVIZIO|es} revízióval: ha a nullázása nélkül '
            + 'kerül a tartományba, a régi VLAN-jai ({VLAN1} REGI_LABOR, {REGI} TESZT) mindenhol felülírják a jókat – '
            + 'és az irodai portok egyszerre rossz VLAN-ba, vagy nem létező VLAN-ba kerülnek.',
          'Nullázni kétféleképpen lehet: transparent módba kapcsolással (`vtp mode transparent`, utána vissza), vagy '
            + 'a tartománynév megváltoztatásával. A server → client váltás NEM nulláz!',
          'Ezért szabály a gyakorlatban: új (vagy máshonnan hozott) switchet mindig nullázott revízióval köss be a hálózatba.',
        ],
      },
      {
        cim: 'Miért kell azonos tartománynév és jelszó?',
        szoveg: [
          'A switch csak a saját tartománya hirdetését fogadja el (a név kis- és nagybetű-érzékeny). A jelszó egy '
            + 'további védelem: eltérő jelszónál a `show vtp status` alján megjelenik a '
            + '`*** MD5 digest checksum mismatch on trunk … ***` sor, és az adatbázis nem frissül.',
          'Egy érdekesség: a tartománynév nélküli (gyári) switch az első hallott hirdetésből átveszi a tartománynevet. '
            + 'Eltérő tartományú switchek között pedig a dinamikus trunk-egyeztetés (DTP) sem sikerül – ezért érdemes a '
            + 'trunkot `switchport mode trunk` paranccsal kifejezetten bekapcsolni.',
        ],
      },
      {
        cim: 'Miért version 2?',
        szoveg: [
          'Az 1-es verzióban a transparent switch csak akkor engedi tovább a hirdetést, ha a tartományneve megegyezik. '
            + 'A 2-es verzióban mindig továbbengedi. A verziót elég a serveren beállítani: a hirdetéssel eljut a kliensekhez '
            + '(a kliensen nem is állítható: `Cannot modify version in VTP client mode`). A transparent switchen viszont kézzel kell.',
        ],
      },
      {
        cim: 'Miért kellett SW2-n kézzel létrehozni a VLAN-okat?',
        szoveg: [
          'A transparent switch nem veszi át a hirdetett VLAN-okat. A PC1 → PC3 forgalom viszont rajta megy át, '
            + 'a trunkon VLAN {VLAN1|es} címkével – és ha SW2-n nincs {VLAN1|es} VLAN, eldobja a keretet (a rajzon ✕ jelzi). '
            + 'A helyi {HELYI|es} VLAN pedig azért nem jut el SW1-re és SW3-ra, mert a transparent switch a saját VLAN-jait nem hirdeti.',
        ],
      },
      {
        cim: 'Próbáld ki!',
        szoveg: [[
          'SW1-en hozz létre egy új VLAN-t (pl. `vlan 40`), és figyeld, ahogy a VTP-hirdetés végigmegy a rajzon; utána `show vlan brief` SW3-on.',
          'SW3-on próbálj VLAN-t létrehozni – mit mond a kliens?',
          'Írd el a jelszót SW3-on, és nézd meg a `show vtp status` alját.',
          'SW2-n állítsd vissza: `vtp version 1`, és módosíts valamit SW1-en: átjut-e a hirdetés?',
          'Az igazi csapda: indítsd újra a feladatot, és SW3-ot nullázás NÉLKÜL kösd be (tartomány, jelszó, trunk). Mi lesz SW1 VLAN-jaival?',
        ]],
      },
    ],
  });
})(typeof window !== 'undefined' ? window : globalThis);
