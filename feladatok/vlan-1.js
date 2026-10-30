/*
 * Haloszim feladat: VLAN-ok két switchen, trunkkel (vlan-1)
 *
 * Egy feladat = egy fájl. Sima <script>-ként töltődik be a dist/szimulator.js UTÁN,
 * és hozzáadja magát a HaloszimFeladatok listához. A szimulátort nem kell újraépíteni hozzá.
 *
 * Felépítés:
 *   azon, tipus, cim, szint – azonosító, feladattípus (a választó első listája), cím, nehézség
 *   leiras – a feladatpanel bevezetője (parancs nélkül: a vizsga mód is mutatja)
 *   lepesek – teendők: { cel (parancs nélkül), parancsok (oktató mód), tippek: [] (gyakorló mód) };
 *             a szövegekben a `…` közötti rész parancsként (egyenközű betűvel) jelenik meg
 *   cimterv   – a PC-k tervezett címei (a panel táblázata és a ping-próbák célcímei)
 *   topologia – eszközök (típus, hely a rajzon: x, y) és kábelek [eszköz, port, eszköz, port]
 *   kiindulo  – kiinduló beállítások (itt nincs: a PC-k üresek, a switchek gyáriak)
 *   celok     – az ellenőrzés céljai: állapot (vlan, access-port, trunk, pc-ip) és próbák
 *               (ping, szoras); az „ellenproba: true” jelöli, aminek NEM szabad működnie
 *   magyarazat – a feladat végén lenyitható magyarázat: [{ cim, szoveg: [bekezdés | [listaelemek]] }]
 */
(function (g) {
  (g.HaloszimFeladatok = g.HaloszimFeladatok || []).push({
    azon: 'vlan-1',
    tipus: 'VLAN',
    cim: 'VLAN-ok két switchen, trunkkel',
    szint: 'kezdő',
    leiras: [
      'Egy kis cég két szintjén egy-egy switch van (SW1, SW2). Az irodai gépek (PC1, PC3) a 10-es, '
        + 'a raktári gépek (PC2, PC4) a 20-as VLAN-ba kerüljenek.',
      'Az azonos VLAN-ban lévő gépek a két switchen át is érjék el egymást, a különböző VLAN-ban lévők ne. '
        + 'Ehhez a két switch közötti kábelnek trunknak kell lennie: az viszi át mindkét VLAN forgalmát, '
        + '802.1Q-címkével megjelölve.',
    ],
    // Teendők: cel = mit kell elérni (parancs nélkül – a gyakorló és a vizsga mód csak ezt mutatja),
    // parancsok = hogyan (az oktató mód mutatja), tippek = fokozatos segítség a gyakorló módban.
    lepesek: [
      {
        cel: 'Mindkét switchen legyen 10-es VLAN IRODA néven, és 20-as VLAN RAKTAR néven.',
        parancsok: '`enable`, `configure terminal`, `vlan 10`, `name IRODA`, `exit`, `vlan 20`, `name RAKTAR`',
        tippek: [
          'A VLAN-t globális konfigurációs módban hozod létre; a nevét a VLAN saját almódjában adod meg.',
          'A parancs neve maga a `vlan`, utána a szám; a név megadása: `name`.',
        ],
      },
      {
        cel: 'Mindkét switchen: a PC1/PC3 felé néző Fa0/1 port biztosan access port legyen a 10-es VLAN-ban, '
          + 'a PC2/PC4 felé néző Fa0/2 port a 20-as VLAN-ban.',
        parancsok: '`interface fa0/1`, `switchport mode access`, `switchport access vlan 10`; '
          + '`interface fa0/2`, `switchport mode access`, `switchport access vlan 20`',
        tippek: [
          'Ez interfész-beállítás: előbb lépj be a port beállításaiba.',
          'Két dolgot kell megadni a porton: az üzemmódot (access) és azt, hogy melyik VLAN-hoz tartozik. '
            + 'Mindkettő a `switchport` paranccsal kezdődik.',
        ],
      },
      {
        cel: 'A két switch közötti kapcsolat (Gi0/1) vigye át mindkét VLAN forgalmát.',
        parancsok: 'Mindkét switchen: `interface gi0/1`, `switchport mode trunk`',
        tippek: [
          'Egy kábelen több VLAN forgalma csak 802.1Q-címkével mehet át – az ilyen port neve trunk.',
          'A port üzemmódját kell átállítani, ugyanazzal a paranccsal, mint az access portoknál.',
        ],
      },
      {
        cel: 'Minden PC kapja meg a címterv szerinti IP-címet és maszkot.',
        parancsok: 'Kattints a PC-re, írd be az IP-címet és a maszkot (pl. 255.255.255.0 vagy /24), majd Mentés.',
        tippek: ['A PC-k beállítása nem parancssorból megy: kattints a rajzon a gépre.'],
      },
      {
        cel: 'Győződj meg róla, hogy az azonos VLAN-ú gépek elérik egymást a két switchen át, a különbözők nem.',
        parancsok: 'PC1-en: `ping 192.168.10.13`; PC2-n: `ping 192.168.20.14`; switchen: `show vlan brief`, '
          + '`show interfaces trunk`. Végül: Ellenőrzés.',
        tippek: ['A PC parancssorában a `ping` paranccsal próbálhatod ki; a switchen a `show` parancsok mutatják az állapotot.'],
      },
    ],
    cimterv: [
      { eszkoz: 'PC1', ip: '192.168.10.11', maszk: '255.255.255.0', vlan: 10, hova: 'SW1 Fa0/1' },
      { eszkoz: 'PC2', ip: '192.168.20.12', maszk: '255.255.255.0', vlan: 20, hova: 'SW1 Fa0/2' },
      { eszkoz: 'PC3', ip: '192.168.10.13', maszk: '255.255.255.0', vlan: 10, hova: 'SW2 Fa0/1' },
      { eszkoz: 'PC4', ip: '192.168.20.14', maszk: '255.255.255.0', vlan: 20, hova: 'SW2 Fa0/2' },
    ],
    topologia: {
      meret: { szel: 800, mag: 400 },
      eszkozok: [
        { nev: 'SW1', tipus: 'switch', x: 40, y: 70 },
        { nev: 'SW2', tipus: 'switch', x: 448, y: 70 },
        { nev: 'PC1', tipus: 'pc', x: 40, y: 270 },
        { nev: 'PC2', tipus: 'pc', x: 210, y: 270 },
        { nev: 'PC3', tipus: 'pc', x: 448, y: 270 },
        { nev: 'PC4', tipus: 'pc', x: 618, y: 270 },
      ],
      kabelek: [
        ['SW1', 'FastEthernet0/1', 'PC1', 'FastEthernet0'],
        ['SW1', 'FastEthernet0/2', 'PC2', 'FastEthernet0'],
        ['SW2', 'FastEthernet0/1', 'PC3', 'FastEthernet0'],
        ['SW2', 'FastEthernet0/2', 'PC4', 'FastEthernet0'],
        ['SW1', 'GigabitEthernet0/1', 'SW2', 'GigabitEthernet0/1'],
      ],
    },
    kiindulo: {},
    celok: [
      { tipus: 'vlan', eszkoz: 'SW1', vlan: 10, nev: 'IRODA', szoveg: 'SW1: van 10-es VLAN, a neve IRODA' },
      { tipus: 'vlan', eszkoz: 'SW1', vlan: 20, nev: 'RAKTAR', szoveg: 'SW1: van 20-as VLAN, a neve RAKTAR' },
      { tipus: 'vlan', eszkoz: 'SW2', vlan: 10, nev: 'IRODA', szoveg: 'SW2: van 10-es VLAN, a neve IRODA' },
      { tipus: 'vlan', eszkoz: 'SW2', vlan: 20, nev: 'RAKTAR', szoveg: 'SW2: van 20-as VLAN, a neve RAKTAR' },
      { tipus: 'access-port', eszkoz: 'SW1', port: 'FastEthernet0/1', vlan: 10, szoveg: 'SW1 Fa0/1 (PC1): access port, VLAN 10' },
      { tipus: 'access-port', eszkoz: 'SW1', port: 'FastEthernet0/2', vlan: 20, szoveg: 'SW1 Fa0/2 (PC2): access port, VLAN 20' },
      { tipus: 'access-port', eszkoz: 'SW2', port: 'FastEthernet0/1', vlan: 10, szoveg: 'SW2 Fa0/1 (PC3): access port, VLAN 10' },
      { tipus: 'access-port', eszkoz: 'SW2', port: 'FastEthernet0/2', vlan: 20, szoveg: 'SW2 Fa0/2 (PC4): access port, VLAN 20' },
      { tipus: 'trunk', eszkoz: 'SW1', port: 'GigabitEthernet0/1', szoveg: 'SW1 Gi0/1 – SW2 Gi0/1: működő trunk' },
      { tipus: 'pc-ip', eszkoz: 'PC1', ip: '192.168.10.11', maszk: '255.255.255.0', szoveg: 'PC1 IP-címe: 192.168.10.11 /24' },
      { tipus: 'pc-ip', eszkoz: 'PC2', ip: '192.168.20.12', maszk: '255.255.255.0', szoveg: 'PC2 IP-címe: 192.168.20.12 /24' },
      { tipus: 'pc-ip', eszkoz: 'PC3', ip: '192.168.10.13', maszk: '255.255.255.0', szoveg: 'PC3 IP-címe: 192.168.10.13 /24' },
      { tipus: 'pc-ip', eszkoz: 'PC4', ip: '192.168.20.14', maszk: '255.255.255.0', szoveg: 'PC4 IP-címe: 192.168.20.14 /24' },
      { tipus: 'ping', honnan: 'PC1', cel: 'PC3', vart: true, szoveg: 'Ping PC1 → PC3 megy (VLAN 10, a trunkon át)' },
      { tipus: 'ping', honnan: 'PC2', cel: 'PC4', vart: true, szoveg: 'Ping PC2 → PC4 megy (VLAN 20, a trunkon át)' },
      {
        tipus: 'szoras', honnan: 'PC1', elerje: ['PC3'], neErje: ['PC2', 'PC4'], ellenproba: true,
        szoveg: 'Ellenpróba: PC1 szórása (broadcast) csak PC3-hoz jut el, PC2-höz és PC4-hez nem',
      },
      {
        tipus: 'szoras', honnan: 'PC2', elerje: ['PC4'], neErje: ['PC1', 'PC3'], ellenproba: true,
        szoveg: 'Ellenpróba: PC2 szórása csak PC4-hez jut el, PC1-hez és PC3-hoz nem',
      },
      { tipus: 'ping', honnan: 'PC1', cel: 'PC2', vart: false, ellenproba: true, szoveg: 'Ellenpróba: ping PC1 → PC2 NEM megy (különböző VLAN)' },
    ],
    magyarazat: [
      {
        cim: 'Mi a VLAN, és miért kell?',
        szoveg: [
          'A VLAN egy switchen belüli „virtuális switch”: a 10-es VLAN portjai csak egymással beszélgetnek, a 20-as '
            + 'VLAN portjai csak egymással – mintha két külön switch lenne. Így az irodai és a raktári gépek egy '
            + 'eszközön osztoznak, mégis elkülönülnek: a szórásaik (broadcast) sem jutnak át a másik csoporthoz. '
            + 'Ez biztonság és rend is: kisebb szórási tartomány, kevesebb fölösleges forgalom.',
        ],
      },
      {
        cim: 'Miért `switchport mode access`, ha a port magától is működne?',
        szoveg: [
          'A 2960 portja gyárilag „dynamic auto”: ha a túloldal trunkot kezdeményez, trunk lesz belőle. Egy PC-nek '
            + 'szánt portnál ez kockázat (egy rosszindulatú eszköz trunkot nyithatna, és minden VLAN-hoz hozzáférne). '
            + 'A `switchport mode access` kikapcsolja ezt az egyeztetést: a port biztosan access marad. '
            + 'A `switchport access vlan 10` mondja meg, melyik VLAN-hoz tartozzon.',
        ],
      },
      {
        cim: 'Mit csinál a trunk és a 802.1Q-címke?',
        szoveg: [
          'A két switch között egyetlen kábel van, de mindkét VLAN forgalmának át kell rajta mennie. A trunk minden '
            + 'keretre ráteszi a 802.1Q-címkét (a VLAN számát), így a túloldali switch tudja, melyik VLAN-ba tegye. '
            + 'A rajzon ezt a pötty fölötti szám mutatja. A natív VLAN (gyárilag az 1-es) keretei címke nélkül mennek.',
          'Ha csak az egyik oldalon kapcsolod be (`switchport mode trunk`), a másik, „dynamic auto” oldal a DTP '
            + 'segítségével szintén trunk lesz – ezért fogadja el az ellenőrzés. A gyakorlatban mégis mindkét oldalon '
            + 'érdemes kifejezetten beállítani: így nem függ az egyeztetéstől.',
        ],
      },
      {
        cim: 'Miért kellett mindkét switchen létrehozni a VLAN-okat?',
        szoveg: [
          'A switch csak olyan VLAN forgalmát továbbítja, amelyik nála létezik. Ha SW2-n nincs 10-es VLAN, a trunkon '
            + 'érkező 10-es címkéjű keretet eldobja (a rajzon ✕). A VLAN-okat a VTP is szétoszthatná a switchek '
            + 'között – erről szól a „VTP: server, transparent, client” feladat.',
        ],
      },
      {
        cim: 'Miért nem éri el PC1 a PC2-t?',
        szoveg: [
          'Két okból sem: más VLAN-ban vannak (más szórási tartomány, az ARP-kérdés el sem jut), és más IP-hálózatban '
            + '(192.168.10.0/24 és 192.168.20.0/24). Két VLAN között csak egy router (vagy 3. rétegbeli switch) tud '
            + 'forgalmat átvinni – ez egy későbbi feladat témája lesz (router-on-a-stick).',
          'Ezért van két ellenpróba: a ping PC1 → PC2 nem mehet át, és a szórás sem juthat át a másik VLAN-ba. '
            + 'Ha minden gép az 1-es VLAN-ban maradt volna, a ping PC1 → PC3 akkor is működne – de az ellenpróba megbukna.',
        ],
      },
      {
        cim: 'Próbáld ki!',
        szoveg: [[
          '`show vlan brief` – a trunk port nem szerepel benne, csak az access portok.',
          '`show interfaces trunk` – mindkét switchen; ha az egyik oldal csak „auto”, az is látszik.',
          'Ping után: `show mac address-table` – melyik MAC-cím melyik porton és VLAN-ban van.',
          'PC-n: `arp -a` a ping előtt és után.',
          '`shutdown` a trunk porton: figyeld a naplóüzeneteket mindkét switchen, és próbáld a pinget. Utána `no shutdown`.',
        ]],
      },
    ],
  });
})(typeof window !== 'undefined' ? window : globalThis);
