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
 *   valtozok – véletlen adatok szabályai (gyakorló és vizsga mód); helyőrzők: {VLAN1}, {VLAN1|es} → „10-es”,
 *               {VLAN1|aes} → „a 10-es” (src/feladat/veletlen.js)
 *   bemutato  – az oktató mód buborékjai lépésenként (src/feladat/vezetett.js)
 *   magyarazat – a feladat végén lenyitható magyarázat: [{ cim, szoveg: [bekezdés | [listaelemek]] }]
 */
(function (g) {
  /** VLAN-nevek a véletlen változatokhoz (ékezet és szóköz nélkül, ahogy a switchen szokás). */
  var NEVEK = ['IRODA', 'RAKTAR', 'PENZUGY', 'MARKETING', 'FEJLESZTES', 'VEZETOSEG', 'ERTEKESITES', 'HR',
    'VENDEG', 'LABOR', 'SZERVIZ', 'GYARTAS', 'LOGISZTIKA', 'OKTATAS', 'UGYFELSZOLGALAT'];
  (g.HaloszimFeladatok = g.HaloszimFeladatok || []).push({
    azon: 'vlan-1',
    tipus: 'VLAN',
    cim: 'VLAN-ok két switchen, trunkkel',
    szint: 'kezdő',
    // Véletlen adatok (gyakorló és vizsga mód): a szövegekben {VLAN1}, {NEV1} … helyőrzők állnak,
    // oktató módban az „alap” értékek érvényesek. Leírás: src/feladat/veletlen.js.
    valtozok: {
      VLAN1: { tipus: 'szam', alap: 10, min: 2, max: 254 },
      VLAN2: { tipus: 'szam', alap: 20, min: 2, max: 254, kulonbozik: ['VLAN1'] },
      NEV1: { tipus: 'lista', alap: 'IRODA', lista: NEVEK },
      NEV2: { tipus: 'lista', alap: 'RAKTAR', lista: NEVEK, kulonbozik: ['NEV1'] },
      H1: { tipus: 'szam', alap: 11, min: 2, max: 250 },
      H2: { tipus: 'szam', alap: 12, min: 2, max: 250 },
      H3: { tipus: 'szam', alap: 13, min: 2, max: 250, kulonbozik: ['H1'] },
      H4: { tipus: 'szam', alap: 14, min: 2, max: 250, kulonbozik: ['H2'] },
    },
    leiras: [
      'Egy kis cég két szintjén egy-egy switch van (SW1, SW2). Két csoport gépei vannak mindkét szinten: '
        + 'PC1 és PC3 {VLAN1|aes} VLAN-ba ({NEV1}), PC2 és PC4 {VLAN2|aes} VLAN-ba ({NEV2}) kerüljön.',
      'Az azonos VLAN-ban lévő gépek a két switchen át is érjék el egymást, a különböző VLAN-ban lévők ne. '
        + 'Ehhez a két switch közötti kábelnek trunknak kell lennie: az viszi át mindkét VLAN forgalmát, '
        + '802.1Q-címkével megjelölve.',
    ],
    // Teendők: cel = mit kell elérni (parancs nélkül – a gyakorló és a vizsga mód csak ezt mutatja),
    // parancsok = hogyan (az oktató mód mutatja), tippek = fokozatos segítség a gyakorló módban.
    lepesek: [
      {
        cel: 'Mindkét switchen legyen {VLAN1|es} VLAN {NEV1} néven, és {VLAN2|es} VLAN {NEV2} néven.',
        parancsok: '`enable`, `configure terminal`, `vlan {VLAN1}`, `name {NEV1}`, `exit`, `vlan {VLAN2}`, `name {NEV2}`',
        tippek: [
          'A VLAN-t globális konfigurációs módban hozod létre; a nevét a VLAN saját almódjában adod meg.',
          'A parancs neve maga a `vlan`, utána a szám; a név megadása: `name`.',
        ],
      },
      {
        cel: 'Mindkét switchen: a PC1/PC3 felé néző Fa0/1 port biztosan access port legyen {VLAN1|aes} VLAN-ban, '
          + 'a PC2/PC4 felé néző Fa0/2 port {VLAN2|aes} VLAN-ban.',
        parancsok: '`interface fa0/1`, `switchport mode access`, `switchport access vlan {VLAN1}`; '
          + '`interface fa0/2`, `switchport mode access`, `switchport access vlan {VLAN2}`',
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
        parancsok: 'PC1-en: `ping 192.168.{VLAN1}.{H3}`; PC2-n: `ping 192.168.{VLAN2}.{H4}`; switchen: `show vlan brief`, '
          + '`show interfaces trunk`. Végül: Ellenőrzés.',
        tippek: ['A PC parancssorában a `ping` paranccsal próbálhatod ki; a switchen a `show` parancsok mutatják az állapotot.'],
      },
    ],
    // Bemutató (oktató mód): buborékok lépésenként – mire mutat (hol), mit és miért, mikor teljesül (kesz).
    // A leírás: src/feladat/vezetett.js. A „be” a beírandó parancsok (a tesztek ezzel játsszák végig).
    bemutato: [
      {
        hol: 'eszkoz', eszkoz: 'SW1',
        szoveg: 'Kezdjük SW1-gyel: kattints rá a rajzon (vagy fent az SW1 fülre).',
        miert: 'Minden eszköznek saját parancssora van: amelyiket kiválasztod, annak a konzolja jelenik meg lent.',
        kesz: { tipus: 'kivalasztva', eszkoz: 'SW1' },
      },
      {
        hol: 'terminal', eszkoz: 'SW1',
        szoveg: 'Írd be: `enable` (röviden: `en`), és nyomj Entert.',
        miert: 'A switch felhasználói módban indul (`SW1>`), itt csak nézelődni lehet. Az `enable` után a prompt '
          + '`SW1#` lesz: ez a privilegizált mód, innen lehet beállítani.',
        be: ['enable'],
        kesz: { tipus: 'mod', eszkoz: 'SW1', mod: 'priv' },
      },
      {
        hol: 'terminal', eszkoz: 'SW1',
        szoveg: 'Lépj be a konfigurációs módba: `configure terminal` (röviden: `conf t`).',
        miert: 'Beállítani a globális konfigurációs módban lehet – a prompt `SW1(config)#` lesz.',
        be: ['configure terminal'],
        kesz: { tipus: 'mod', eszkoz: 'SW1', mod: 'konfig' },
      },
      {
        hol: 'terminal', eszkoz: 'SW1',
        szoveg: 'Hozd létre az első VLAN-t: `vlan {VLAN1}`, majd adj neki nevet: `name {NEV1}`.',
        miert: 'A `vlan` létrehozza a VLAN-t, és belép a beállításaiba (`config-vlan`); a `name` nevet ad neki. '
          + 'A név nem kötelező, de a hibakeresésnél sokat segít.',
        be: ['vlan {VLAN1}', 'name {NEV1}'],
        kesz: { tipus: 'vlan', eszkoz: 'SW1', vlan: '{VLAN1}', nev: '{NEV1}' },
      },
      {
        hol: 'terminal', eszkoz: 'SW1',
        szoveg: 'A második VLAN: `vlan {VLAN2}`, majd `name {NEV2}`.',
        miert: 'Almódból is kiadhatsz globális parancsot (pl. egy újabb `vlan`-t): a switch magától kilép az almódból.',
        be: ['vlan {VLAN2}', 'name {NEV2}'],
        kesz: { tipus: 'vlan', eszkoz: 'SW1', vlan: '{VLAN2}', nev: '{NEV2}' },
      },
      {
        hol: 'terminal', eszkoz: 'SW1',
        szoveg: 'Jöhet a PC1 felé néző port: `interface fa0/1`.',
        miert: 'Az `interface` paranccsal egy port beállításaiba lépsz – a prompt `SW1(config-if)#` lesz. '
          + 'A portnév rövidíthető: f0/1, fa0/1, FastEthernet0/1 – mind ugyanaz.',
        be: ['interface fa0/1'],
        kesz: { tipus: 'mod', eszkoz: 'SW1', mod: 'konfig-if', port: 'FastEthernet0/1' },
      },
      {
        hol: 'terminal', eszkoz: 'SW1',
        szoveg: 'Tedd access porttá a {VLAN1|es} VLAN-ban: `switchport mode access`, majd `switchport access vlan {VLAN1}`.',
        miert: 'Az első parancs biztosan access porttá teszi (nem egyezkedik trunkról), a második megmondja, melyik VLAN-hoz tartozzon.',
        be: ['switchport mode access', 'switchport access vlan {VLAN1}'],
        kesz: { tipus: 'access-port', eszkoz: 'SW1', port: 'FastEthernet0/1', vlan: '{VLAN1}' },
      },
      {
        hol: 'terminal', eszkoz: 'SW1',
        szoveg: 'Ugyanez a PC2 felé néző porttal: `interface fa0/2`, `switchport mode access`, `switchport access vlan {VLAN2}`.',
        miert: 'Minden portot külön kell a megfelelő VLAN-ba tenni. (Sok portnál jól jön az `interface range` parancs.)',
        be: ['interface fa0/2', 'switchport mode access', 'switchport access vlan {VLAN2}'],
        kesz: { tipus: 'access-port', eszkoz: 'SW1', port: 'FastEthernet0/2', vlan: '{VLAN2}' },
      },
      {
        hol: 'terminal', eszkoz: 'SW1',
        szoveg: 'A két switch közötti port legyen trunk: `interface gi0/1`, majd `switchport mode trunk`.',
        miert: 'A trunk viszi át mindkét VLAN forgalmát egyetlen kábelen: minden keretre ráteszi a 802.1Q-címkét (a VLAN számát).',
        be: ['interface gi0/1', 'switchport mode trunk'],
        kesz: { tipus: 'trunk', eszkoz: 'SW1', port: 'GigabitEthernet0/1' },
      },
      {
        hol: 'terminal', eszkoz: 'SW1',
        szoveg: 'Nézd meg, mit csináltál: `end`, majd `show vlan brief` (röviden: `sh vl br`).',
        miert: 'Itt látszik minden VLAN a portjaival. A trunk port (Gi0/1) nem szerepel a listában – ez így helyes.',
        be: ['end', 'show vlan brief'],
        kesz: { tipus: 'parancs', eszkoz: 'SW1', szavak: ['show', 'vlan', 'brief'] },
      },
      {
        hol: 'eszkoz', eszkoz: 'SW2',
        szoveg: 'Most SW2 következik: kattints rá.',
        miert: 'A VLAN-ok switchenként külön léteznek: SW2-n is létre kell hozni őket.',
        kesz: { tipus: 'kivalasztva', eszkoz: 'SW2' },
      },
      {
        hol: 'terminal', eszkoz: 'SW2',
        szoveg: 'Ugyanaz, mint SW1-en – most rövidítve: `en`, `conf t`, `vl {VLAN1}`, `na {NEV1}`, `vl {VLAN2}`, `na {NEV2}`.',
        miert: 'Minden szó rövidíthető, amíg egyértelmű. A switch ugyanazt az állapotot állítja be, mintha kiírtad volna.',
        be: ['en', 'conf t', 'vl {VLAN1}', 'na {NEV1}', 'vl {VLAN2}', 'na {NEV2}'],
        kesz: [
          { tipus: 'vlan', eszkoz: 'SW2', vlan: '{VLAN1}', nev: '{NEV1}' },
          { tipus: 'vlan', eszkoz: 'SW2', vlan: '{VLAN2}', nev: '{NEV2}' },
        ],
      },
      {
        hol: 'terminal', eszkoz: 'SW2',
        szoveg: 'A portok: `int f0/1`, `sw mo acc`, `sw acc vl {VLAN1}`, majd `int f0/2`, `sw mo acc`, `sw acc vl {VLAN2}`.',
        miert: 'PC3 {VLAN1|aes}, PC4 {VLAN2|aes} VLAN-ba kerül – ugyanúgy, mint a párjuk SW1-en.',
        be: ['int f0/1', 'sw mo acc', 'sw acc vl {VLAN1}', 'int f0/2', 'sw mo acc', 'sw acc vl {VLAN2}'],
        kesz: [
          { tipus: 'access-port', eszkoz: 'SW2', port: 'FastEthernet0/1', vlan: '{VLAN1}' },
          { tipus: 'access-port', eszkoz: 'SW2', port: 'FastEthernet0/2', vlan: '{VLAN2}' },
        ],
      },
      {
        hol: 'terminal', eszkoz: 'SW2',
        szoveg: 'A trunk ezen az oldalon is: `int g0/1`, `sw mo tr`, majd `do sh int trunk`.',
        miert: 'SW2 magától is trunk lett volna (DTP), de érdemes kifejezetten beállítani. A `do` előtaggal '
          + 'konfigurációs módból is futtathatsz show parancsot.',
        be: ['int g0/1', 'sw mo tr', 'do sh int trunk'],
        kesz: { tipus: 'parancs', eszkoz: 'SW2', szavak: ['show', 'interfaces', 'trunk'] },
      },
      {
        hol: 'eszkoz', eszkoz: 'PC1',
        szoveg: 'Jöhetnek a PC-k: kattints PC1-re.',
        miert: 'A PC-ken egy űrlapon adod meg az IP-címet, alatta pedig a gép parancssora van.',
        kesz: { tipus: 'kivalasztva', eszkoz: 'PC1' },
      },
      {
        hol: 'pc', eszkoz: 'PC1',
        szoveg: 'IP-cím: 192.168.{VLAN1}.{H1}, maszk: 255.255.255.0 (vagy /24), majd Mentés.',
        miert: 'A maszk mondja meg, mekkora a gép hálózata: /24 esetén az első három szám a hálózat. '
          + 'Átjáró most nem kell – a két VLAN között nem lesz forgalom.',
        kesz: { tipus: 'pc-ip', eszkoz: 'PC1', ip: '192.168.{VLAN1}.{H1}', maszk: '255.255.255.0' },
      },
      {
        hol: 'panel',
        szoveg: 'A többi PC-t (PC2, PC3, PC4) is állítsd be a címterv szerint – a táblázat a feladatpanelen van.',
        miert: 'Az azonos VLAN-ú gépek (PC1–PC3, PC2–PC4) egy IP-hálózatban vannak, a két VLAN két külön hálózat.',
        kesz: [
          { tipus: 'pc-ip', eszkoz: 'PC2', ip: '192.168.{VLAN2}.{H2}', maszk: '255.255.255.0' },
          { tipus: 'pc-ip', eszkoz: 'PC3', ip: '192.168.{VLAN1}.{H3}', maszk: '255.255.255.0' },
          { tipus: 'pc-ip', eszkoz: 'PC4', ip: '192.168.{VLAN2}.{H4}', maszk: '255.255.255.0' },
        ],
      },
      {
        hol: 'terminal', eszkoz: 'PC1',
        szoveg: 'Próbáld ki PC1 parancssorában: `ping 192.168.{VLAN1}.{H3}` (ez PC3), és figyeld a rajzot!',
        miert: 'Előbb egy ARP-kérdés megy szórással (narancs pötty), a trunkon a {VLAN1|es} címkével – SW2 ebből tudja, '
          + 'melyik VLAN-ba tegye. Utána jönnek a pingek (fekete-sárga pötty). Ha túl gyors, lassítsd le a rajz alatt!',
        be: ['ping 192.168.{VLAN1}.{H3}'],
        kesz: { tipus: 'parancs', eszkoz: 'PC1', szavak: ['ping'] },
      },
      {
        hol: 'ellenorzes',
        szoveg: 'Kész a hálózat! Nyomd meg az Ellenőrzés gombot.',
        miert: 'Az ellenőrzés valódi pingekkel és szórásos próbával nézi meg a hálózatot – az ellenpróbák azt is, hogy '
          + 'a két VLAN valóban el van-e választva.',
        kesz: { tipus: 'ellenorzes' },
      },
    ],
    cimterv: [
      { eszkoz: 'PC1', ip: '192.168.{VLAN1}.{H1}', maszk: '255.255.255.0', vlan: '{VLAN1}', hova: 'SW1 Fa0/1' },
      { eszkoz: 'PC2', ip: '192.168.{VLAN2}.{H2}', maszk: '255.255.255.0', vlan: '{VLAN2}', hova: 'SW1 Fa0/2' },
      { eszkoz: 'PC3', ip: '192.168.{VLAN1}.{H3}', maszk: '255.255.255.0', vlan: '{VLAN1}', hova: 'SW2 Fa0/1' },
      { eszkoz: 'PC4', ip: '192.168.{VLAN2}.{H4}', maszk: '255.255.255.0', vlan: '{VLAN2}', hova: 'SW2 Fa0/2' },
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
      { tipus: 'vlan', eszkoz: 'SW1', vlan: '{VLAN1}', nev: '{NEV1}', szoveg: 'SW1: van {VLAN1|es} VLAN, a neve {NEV1}' },
      { tipus: 'vlan', eszkoz: 'SW1', vlan: '{VLAN2}', nev: '{NEV2}', szoveg: 'SW1: van {VLAN2|es} VLAN, a neve {NEV2}' },
      { tipus: 'vlan', eszkoz: 'SW2', vlan: '{VLAN1}', nev: '{NEV1}', szoveg: 'SW2: van {VLAN1|es} VLAN, a neve {NEV1}' },
      { tipus: 'vlan', eszkoz: 'SW2', vlan: '{VLAN2}', nev: '{NEV2}', szoveg: 'SW2: van {VLAN2|es} VLAN, a neve {NEV2}' },
      { tipus: 'access-port', eszkoz: 'SW1', port: 'FastEthernet0/1', vlan: '{VLAN1}', szoveg: 'SW1 Fa0/1 (PC1): access port, VLAN {VLAN1}' },
      { tipus: 'access-port', eszkoz: 'SW1', port: 'FastEthernet0/2', vlan: '{VLAN2}', szoveg: 'SW1 Fa0/2 (PC2): access port, VLAN {VLAN2}' },
      { tipus: 'access-port', eszkoz: 'SW2', port: 'FastEthernet0/1', vlan: '{VLAN1}', szoveg: 'SW2 Fa0/1 (PC3): access port, VLAN {VLAN1}' },
      { tipus: 'access-port', eszkoz: 'SW2', port: 'FastEthernet0/2', vlan: '{VLAN2}', szoveg: 'SW2 Fa0/2 (PC4): access port, VLAN {VLAN2}' },
      { tipus: 'trunk', eszkoz: 'SW1', port: 'GigabitEthernet0/1', szoveg: 'SW1 Gi0/1 – SW2 Gi0/1: működő trunk' },
      { tipus: 'pc-ip', eszkoz: 'PC1', ip: '192.168.{VLAN1}.{H1}', maszk: '255.255.255.0', szoveg: 'PC1 IP-címe: 192.168.{VLAN1}.{H1} /24' },
      { tipus: 'pc-ip', eszkoz: 'PC2', ip: '192.168.{VLAN2}.{H2}', maszk: '255.255.255.0', szoveg: 'PC2 IP-címe: 192.168.{VLAN2}.{H2} /24' },
      { tipus: 'pc-ip', eszkoz: 'PC3', ip: '192.168.{VLAN1}.{H3}', maszk: '255.255.255.0', szoveg: 'PC3 IP-címe: 192.168.{VLAN1}.{H3} /24' },
      { tipus: 'pc-ip', eszkoz: 'PC4', ip: '192.168.{VLAN2}.{H4}', maszk: '255.255.255.0', szoveg: 'PC4 IP-címe: 192.168.{VLAN2}.{H4} /24' },
      { tipus: 'ping', honnan: 'PC1', cel: 'PC3', vart: true, szoveg: 'Ping PC1 → PC3 megy (VLAN {VLAN1}, a trunkon át)' },
      { tipus: 'ping', honnan: 'PC2', cel: 'PC4', vart: true, szoveg: 'Ping PC2 → PC4 megy (VLAN {VLAN2}, a trunkon át)' },
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
          'A VLAN egy switchen belüli „virtuális switch”: {VLAN1|aes} VLAN portjai csak egymással beszélgetnek, {VLAN2|aes} '
            + 'VLAN portjai csak egymással – mintha két külön switch lenne. Így a két csoport gépei egy '
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
            + 'A `switchport access vlan {VLAN1}` mondja meg, melyik VLAN-hoz tartozzon.',
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
          'A switch csak olyan VLAN forgalmát továbbítja, amelyik nála létezik. Ha SW2-n nincs {VLAN1|es} VLAN, a trunkon '
            + 'érkező {VLAN1|es} címkéjű keretet eldobja (a rajzon ✕). A VLAN-okat a VTP is szétoszthatná a switchek '
            + 'között – erről szól a „VTP: server, transparent, client” feladat.',
        ],
      },
      {
        cim: 'Miért nem éri el PC1 a PC2-t?',
        szoveg: [
          'Két okból sem: más VLAN-ban vannak (más szórási tartomány, az ARP-kérdés el sem jut), és más IP-hálózatban '
            + '(192.168.{VLAN1}.0/24 és 192.168.{VLAN2}.0/24). Két VLAN között csak egy router (vagy 3. rétegbeli switch) tud '
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
