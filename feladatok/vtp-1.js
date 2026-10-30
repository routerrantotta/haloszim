/*
 * Haloszim feladat: VTP – server, transparent, client (vtp-1)
 *
 * Egy feladat = egy fájl (a felépítés leírása: feladatok/vlan-1.js).
 * A szövegekben a `…` közötti rész parancsként (egyenközű betűvel) jelenik meg.
 */
(function (g) {
  (g.HaloszimFeladatok = g.HaloszimFeladatok || []).push({
    azon: 'vtp-1',
    tipus: 'VLAN',
    cim: 'VTP: server, transparent, client',
    szint: 'haladó',
    leiras: [
      'Három switch van sorban: SW1 – SW2 – SW3. A VLAN-okat csak SW1-en szeretnénk karbantartani, a többi '
        + 'switch a VTP (VLAN Trunking Protocol) segítségével kapja meg őket. SW2 középen transparent módban lesz: '
        + 'továbbengedi a hirdetéseket, de a saját VLAN-jait maga kezeli.',
      'Figyelem: SW3 egy régi laborból került ide, és még a régi beállításait őrzi. Nézd meg rajta a '
        + '`show vtp status` kimenetét, mielőtt bármit összekötsz!',
      'A PC-k IP-címe már be van állítva (lásd a címtervet).',
    ],
    lepesek: [
      'SW3: `show vtp status` – a revíziószám 15! Nullázd: `vtp mode transparent`, majd `vtp mode client`.',
      'Mindhárom switchen: `vtp domain ROUTERRANTOTTA` és `vtp password Rantotta2026`.',
      'SW1: server marad (gyári), `vtp version 2`. SW2: `vtp mode transparent`, `vtp version 2`.',
      'SW1-en (a serveren) hozd létre a VLAN-okat: 10 – IRODA, 20 – RAKTAR.',
      'SW2 transparent: itt kézzel kell létrehozni a 10-es és a 20-as VLAN-t, és egy helyi VLAN-t is: 99 – SAJAT.',
      'Trunk minden switchek közötti porton: SW1 Gi0/1, SW2 Gi0/1 és Gi0/2, SW3 Gi0/1 – `switchport mode trunk`.',
      'SW1-en és SW3-on: Fa0/1 → access, VLAN 10; Fa0/2 → access, VLAN 20.',
      'Nézd meg: `show vtp status` és `show vlan brief` mindhárom switchen, majd ping PC1 → PC3. Végül: Ellenőrzés.',
    ],
    cimterv: [
      { eszkoz: 'PC1', ip: '192.168.10.11', maszk: '255.255.255.0', vlan: 10, hova: 'SW1 Fa0/1' },
      { eszkoz: 'PC2', ip: '192.168.20.12', maszk: '255.255.255.0', vlan: 20, hova: 'SW1 Fa0/2' },
      { eszkoz: 'PC3', ip: '192.168.10.13', maszk: '255.255.255.0', vlan: 10, hova: 'SW3 Fa0/1' },
      { eszkoz: 'PC4', ip: '192.168.20.14', maszk: '255.255.255.0', vlan: 20, hova: 'SW3 Fa0/2' },
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
      PC1: { ip: '192.168.10.11', maszk: '255.255.255.0' },
      PC2: { ip: '192.168.20.12', maszk: '255.255.255.0' },
      PC3: { ip: '192.168.10.13', maszk: '255.255.255.0' },
      PC4: { ip: '192.168.20.14', maszk: '255.255.255.0' },
      // A „régi labor” maradványa: ugyanaz a tartomány és jelszó, de 15-ös revízió és régi VLAN-ok.
      SW3: {
        vtp: { mod: 'server', tartomany: 'ROUTERRANTOTTA', jelszo: 'Rantotta2026', verzio: 1, revizio: 15 },
        vlanok: { 10: 'REGI_LABOR', 30: 'TESZT' },
      },
    },
    celok: [
      { tipus: 'vtp', eszkoz: 'SW1', mod: 'server', tartomany: 'ROUTERRANTOTTA', jelszo: 'Rantotta2026', verzio: 2, szoveg: 'SW1: VTP server, ROUTERRANTOTTA, jelszó, version 2' },
      { tipus: 'vtp', eszkoz: 'SW2', mod: 'transparent', tartomany: 'ROUTERRANTOTTA', jelszo: 'Rantotta2026', verzio: 2, szoveg: 'SW2: VTP transparent, ROUTERRANTOTTA, jelszó, version 2' },
      { tipus: 'vtp', eszkoz: 'SW3', mod: 'client', tartomany: 'ROUTERRANTOTTA', jelszo: 'Rantotta2026', verzio: 2, szoveg: 'SW3: VTP client, ROUTERRANTOTTA, jelszó, version 2 (a servertől)' },
      { tipus: 'trunk', eszkoz: 'SW1', port: 'GigabitEthernet0/1', szoveg: 'SW1 Gi0/1 – SW2 Gi0/1: működő trunk' },
      { tipus: 'trunk', eszkoz: 'SW2', port: 'GigabitEthernet0/2', szoveg: 'SW2 Gi0/2 – SW3 Gi0/1: működő trunk' },
      { tipus: 'vlan', eszkoz: 'SW1', vlan: 10, nev: 'IRODA', szoveg: 'SW1: 10-es VLAN, neve IRODA' },
      { tipus: 'vlan', eszkoz: 'SW1', vlan: 20, nev: 'RAKTAR', szoveg: 'SW1: 20-as VLAN, neve RAKTAR' },
      { tipus: 'vtp-szinkron', eszkoz: 'SW3', forras: 'SW1', szoveg: 'SW3 a VTP-n át átvette SW1 VLAN-jait (azonos revízió, azonos VLAN-ok)' },
      { tipus: 'vlan', eszkoz: 'SW2', vlan: 10, szoveg: 'SW2: van 10-es VLAN (transparent: kézzel)' },
      { tipus: 'vlan', eszkoz: 'SW2', vlan: 20, szoveg: 'SW2: van 20-as VLAN (transparent: kézzel)' },
      { tipus: 'vlan', eszkoz: 'SW2', vlan: 99, nev: 'SAJAT', szoveg: 'SW2: helyi VLAN 99 SAJAT' },
      { tipus: 'access-port', eszkoz: 'SW1', port: 'FastEthernet0/1', vlan: 10, szoveg: 'SW1 Fa0/1 (PC1): access, VLAN 10' },
      { tipus: 'access-port', eszkoz: 'SW1', port: 'FastEthernet0/2', vlan: 20, szoveg: 'SW1 Fa0/2 (PC2): access, VLAN 20' },
      { tipus: 'access-port', eszkoz: 'SW3', port: 'FastEthernet0/1', vlan: 10, szoveg: 'SW3 Fa0/1 (PC3): access, VLAN 10' },
      { tipus: 'access-port', eszkoz: 'SW3', port: 'FastEthernet0/2', vlan: 20, szoveg: 'SW3 Fa0/2 (PC4): access, VLAN 20' },
      { tipus: 'ping', honnan: 'PC1', cel: 'PC3', vart: true, szoveg: 'Ping PC1 → PC3 megy (VLAN 10, három switchen át)' },
      { tipus: 'ping', honnan: 'PC2', cel: 'PC4', vart: true, szoveg: 'Ping PC2 → PC4 megy (VLAN 20, három switchen át)' },
      { tipus: 'vlan-nincs', eszkoz: 'SW1', vlan: 30, ellenproba: true, szoveg: 'Ellenpróba: a régi labor VLAN-jai nem írták felül SW1-et (nincs 30-as VLAN)' },
      { tipus: 'vlan-nincs', eszkoz: 'SW3', vlan: 30, ellenproba: true, szoveg: 'Ellenpróba: a régi 30-as VLAN eltűnt SW3-ról is' },
      { tipus: 'vlan-nincs', eszkoz: 'SW1', vlan: 99, ellenproba: true, szoveg: 'Ellenpróba: SW2 helyi VLAN-ja (99) nem került át SW1-re' },
      { tipus: 'vlan-nincs', eszkoz: 'SW3', vlan: 99, ellenproba: true, szoveg: 'Ellenpróba: SW2 helyi VLAN-ja (99) nem került át SW3-ra' },
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
            + 'nagyobb számú switch kliens! SW3 egy régi laborból jött 15-ös revízióval: ha a nullázása nélkül '
            + 'kerül a tartományba, a régi VLAN-jai (10 REGI_LABOR, 30 TESZT) mindenhol felülírják a jókat – '
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
            + 'a trunkon VLAN 10-es címkével – és ha SW2-n nincs 10-es VLAN, eldobja a keretet (a rajzon ✕ jelzi). '
            + 'A helyi 99-es VLAN pedig azért nem jut el SW1-re és SW3-ra, mert a transparent switch a saját VLAN-jait nem hirdeti.',
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
