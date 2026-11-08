/*
 * Haloszim feladat: Menedzsment-VLAN és Safe Mode – MikroTik switchen (mgmt-1)
 *
 * A switchet nem a konzolról, hanem hálózaton át (SSH-val, az ADMIN gépről) kezeljük – ez a
 * „kezeles” mező. Ha a VLAN-beállítás elvágja az ADMIN gép útját a switch címéhez, a kapcsolat
 * megszakad (src/gyartok/routeros/munkamenet.js). A Safe Mode (Ctrl+X) ilyenkor visszavonja a
 * változtatásokat.
 *
 * A mezők leírása: feladatok/vlan-1.js. Itt még:
 *   gyarto: 'mikrotik' – a feladat eszközei MikroTik-switchek (csak ez a gyártói változat van)
 *   kezeles: { SW1: { honnan: 'ADMIN', ip: '192.168.88.1' } } – SW1 terminálja SSH az ADMIN gépről
 *   bemutató: a „be” listában a „^X” a Ctrl+X billentyű (Safe Mode be/ki)
 */
(function (g) {
  (g.HaloszimFeladatok = g.HaloszimFeladatok || []).push({
    azon: 'mgmt-1',
    tipus: 'VLAN',
    cim: 'Menedzsment-VLAN és Safe Mode (MikroTik)',
    szint: 'haladó',
    gyarto: 'mikrotik',
    kezeles: { SW1: { honnan: 'ADMIN', ip: '192.168.88.1' } },
    valtozok: {
      M: { tipus: 'szam', alap: 99, min: 90, max: 250 },
      V1: { tipus: 'szam', alap: 10, min: 10, max: 49 },
      V2: { tipus: 'szam', alap: 20, min: 10, max: 49, kulonbozik: ['V1'] },
    },
    leiras: [
      'Egy MikroTik switchet (SW1) az ADMIN gépről, hálózaton át (SSH-val) kezelsz – most még a gyári címén '
        + '(192.168.88.1), az 1-es VLAN-ban, ugyanott, ahol a felhasználók gépei is vannak.',
      'A feladat: a switch kezelése kerüljön külön, kezelő (management) VLAN-ba (VLAN {M}, 192.168.{M}.0/24), a '
        + 'felhasználók gépei pedig a saját VLAN-jukba (PC1: VLAN {V1}, PC2: VLAN {V2}). A végén az ADMIN gép a kezelő '
        + 'VLAN-ból éri el a switchet, a felhasználók pedig ne érjék el a kezelő címét.',
      'Vigyázz: ha rossz sorrendben állítod be a VLAN-okat, megszakad a kapcsolat a switch-csel, és kizárod magad. '
        + 'Ez ellen véd a Safe Mode.',
    ],
    lepesek: [
      {
        cel: 'Mielőtt bármit módosítasz, kapcsold be a Safe Mode-ot: ha kizárnád magad, a switch visszavonja a változtatásokat.',
        parancsok: 'Ctrl+X (vagy a terminál alatti Ctrl+X gomb) – a prompt végén `<SAFE>` jelenik meg.',
        tippek: [
          'Ez nem parancs, hanem egy billentyűkombináció a parancssorban.',
          'Ugyanaz a kombináció, amellyel szövegszerkesztőben kivágni szoktál.',
        ],
      },
      {
        cel: 'Legyen a switchnek VLAN-interfésze a {M}-es VLAN-ban (a bridge-en), rajta a 192.168.{M}.2/24 kezelő cím.',
        parancsok: '`/interface vlan add name=MGMT vlan-id={M} interface=bridge`, `/ip address add address=192.168.{M}.2/24 interface=MGMT`',
        tippek: [
          'A switch saját „lába” egy VLAN-ban a VLAN-interfész; az IP-cím erre kerül.',
          'VLAN-interfész: az interfészek menüjében, a vlan almenüben. IP-cím: az ip menü address almenüjében.',
        ],
      },
      {
        cel: 'A bridge VLAN-táblájában legyen a {M}-es VLAN (MGMT megjegyzéssel), és ebben a bridge maga (a switch processzora) '
          + 'címkézett tag legyen. Legyen sor a {V1}-es (IRODA) és a {V2}-es (VENDEG) VLAN-nak is.',
        parancsok: '`/interface bridge vlan add bridge=bridge vlan-ids={M} tagged=bridge comment=MGMT`, '
          + '`/interface bridge vlan add bridge=bridge vlan-ids={V1} comment=IRODA`, `/interface bridge vlan add bridge=bridge vlan-ids={V2} comment=VENDEG`',
        tippek: [
          'Ez a leggyakrabban kihagyott lépés: a VLAN-interfész csak akkor kap forgalmat, ha a bridge is tagja a VLAN-nak.',
          'A processzor felé címkével megy a forgalom: a bridge neve a tagged listába kerül.',
        ],
      },
      {
        cel: 'A felhasználói portok: az ether2 (PC1) a {V1|es}, az ether9 (PC2) a {V2|es} VLAN access portja legyen. '
          + 'Az ADMIN gép portja (ether1) egyelőre maradjon a régi helyén.',
        parancsok: '`/interface bridge port set [find interface=ether2] pvid={V1} frame-types=admit-only-untagged-and-priority-tagged`, '
          + 'ugyanígy az ether9 a {V2} PVID-del',
        tippek: [
          'Access port MikroTiken: PVID + csak címke nélküli keretek (frame-types).',
          'A bridge-portok menüjében a `set [find interface=…]` választja ki a portot.',
        ],
      },
      {
        cel: 'Kapcsold be a VLAN-szűrést – úgy, hogy közben ne szakadjon meg a kapcsolatod; ha minden jó, engedd el a Safe Mode-ot.',
        parancsok: '`/interface bridge set bridge vlan-filtering=yes`, majd Ctrl+X (`[Safe Mode released]`)',
        tippek: [
          'Az ether1 PVID-je még 1, és a bridge régi címe is az 1-es VLAN-ban van – így az ADMIN gép útja megmarad.',
          'A Safe Mode-ot ugyanazzal a billentyűvel engeded el, amellyel bekapcsoltad; a változtatások ilyenkor maradnak.',
        ],
      },
      {
        cel: 'Az átállás: az ether1 (ADMIN) legyen a {M}-es VLAN access portja. (Ekkor a kapcsolat megszakad – ez várható.)',
        parancsok: '`/interface bridge port set [find interface=ether1] pvid={M} frame-types=admit-only-untagged-and-priority-tagged`',
        tippek: [
          'Ugyanúgy, mint a felhasználói portoknál, csak a kezelő VLAN számával.',
          'Safe Mode-ban ezt ne csináld: a kapcsolat megszakadása miatt a switch visszavonná.',
        ],
      },
      {
        cel: 'Az ADMIN gép kapjon címet a kezelő hálózatból (192.168.{M}.10/24), és lépj be újra a switch új címére.',
        parancsok: 'ADMIN: IP 192.168.{M}.10, maszk 255.255.255.0, Mentés; SW1 termináljában: `ssh admin@192.168.{M}.2`',
        tippek: [
          'A PC-k beállítása nem parancssorból megy: kattints a rajzon az ADMIN gépre.',
          'A megszakadt kapcsolat után a terminál az ADMIN gép parancssora: innen az ssh paranccsal lépsz be.',
        ],
      },
      {
        cel: 'Győződj meg róla, hogy a switch kezelő címe csak a kezelő VLAN-ból érhető el.',
        parancsok: '`/interface bridge vlan print`, `/export`; ADMIN-on: `ping 192.168.{M}.2`. Végül: Ellenőrzés.',
        tippek: ['A switch teljes beállítását az `/export` mutatja meg, parancsok formájában.'],
      },
    ],
    bemutato: [
      {
        hol: 'eszkoz', eszkoz: 'SW1',
        szoveg: 'Kattints SW1-re. Most nem a konzolon vagy, hanem hálózaton át: az ADMIN gépről SSH-val (lásd a terminál fejlécét).',
        miert: 'A valóságban a switcheket többnyire így kezelik. A veszély: ha rosszul állítod a VLAN-okat, az ADMIN gép '
          + 'elveszítheti az utat a switchhez – és kizárod magad. Ezt most ki is próbáljuk, biztonsági hálóval.',
        kesz: { tipus: 'kivalasztva', eszkoz: 'SW1' },
      },
      {
        hol: 'terminal', eszkoz: 'SW1',
        szoveg: 'Először kapcsold be a Safe Mode-ot: nyomd meg a Ctrl+X-et (vagy a terminál alatti Ctrl+X gombot).',
        miert: 'A prompt végén `<SAFE>` lesz. Safe Mode-ban a switch megjegyzi a változtatásaidat, és ha a kapcsolat megszakad, '
          + 'visszavonja őket.',
        be: ['^X'],
        kesz: { tipus: 'safe-mode', eszkoz: 'SW1', be: true },
      },
      {
        hol: 'terminal', eszkoz: 'SW1',
        szoveg: 'Most szándékosan elkövetjük a leggyakoribb hibát. Tedd az ADMIN portját (ether1) a {M}-es VLAN-ba: '
          + '`/interface bridge port set [find interface=ether1] pvid={M}`, majd kapcsold be a VLAN-szűrést: '
          + '`/interface bridge set bridge vlan-filtering=yes`. Figyeld a terminált!',
        miert: 'Az ADMIN gép címe még a régi (192.168.88.10), a switch régi címe a bridge-en van, az 1-es VLAN-ban. A szűrés '
          + 'bekapcsolásával az ether1 forgalma a {M}-es VLAN-ba kerül – ott viszont senki nem válaszol. Az út megszakad.',
        be: ['/interface bridge port set [find interface=ether1] pvid={M}', '/interface bridge set bridge vlan-filtering=yes'],
        kesz: { tipus: 'kapcsolat', eszkoz: 'SW1', allapot: 'megszakadt' },
      },
      {
        hol: 'terminal', eszkoz: 'SW1',
        szoveg: 'Megszakadt a kapcsolat; a terminál most az ADMIN gép parancssora. Várd meg, amíg a switch visszavonja a '
          + 'változtatásokat (a terminálban szól), aztán lépj be újra: `ssh admin@192.168.88.1`.',
        miert: 'Safe Mode nélkül most kizártad volna magad: a switchhez csak a konzolkábellel férnél hozzá. A valódi eszköz a '
          + 'TCP időtúllépése után (kb. 9 perc) vonja vissza a változtatásokat; a szimulátor ennél gyorsabb.',
        be: ['ssh admin@192.168.88.1'],
        kesz: { tipus: 'kapcsolat', eszkoz: 'SW1', allapot: 'el', ip: '192.168.88.1', ujra: true },
      },
      {
        hol: 'terminal', eszkoz: 'SW1',
        szoveg: 'Most csináljuk jól! Kapcsold be újra a Safe Mode-ot: Ctrl+X.',
        miert: 'A kapcsolat megszakadásával a Safe Mode is véget ért; minden munkamenetben külön kell bekapcsolni.',
        be: ['^X'],
        kesz: { tipus: 'safe-mode', eszkoz: 'SW1', be: true },
      },
      {
        hol: 'terminal', eszkoz: 'SW1',
        szoveg: 'Az új kezelő cím: VLAN-interfész a bridge-en, rajta a cím. `/interface vlan add name=MGMT vlan-id={M} interface=bridge`, '
          + 'majd `/ip address add address=192.168.{M}.2/24 interface=MGMT`.',
        miert: 'A VLAN-interfész a switch saját „lába” a {M}-es VLAN-ban: a bridge felől {M}-es címkével érkező keretek ide jutnak. '
          + 'Az IP-cím erre kerül, nem a bridge-re.',
        be: ['/interface vlan add name=MGMT vlan-id={M} interface=bridge', '/ip address add address=192.168.{M}.2/24 interface=MGMT'],
        kesz: { tipus: 'kezelo-ip', eszkoz: 'SW1', ip: '192.168.{M}.2/24', vlan: '{M}' },
      },
      {
        hol: 'terminal', eszkoz: 'SW1',
        szoveg: 'A VLAN-tábla: a {M}-es VLAN-ban a bridge maga legyen címkézett tag. `/interface bridge vlan add bridge=bridge vlan-ids={M} tagged=bridge comment=MGMT`',
        miert: 'Ez a leggyakrabban kihagyott lépés! A bridge – vagyis a switch processzora – is tagja kell legyen a VLAN-nak, '
          + 'különben a VLAN-interfész semmit nem kap meg. A processzor felé címkével megy a forgalom (tagged=bridge): ebből '
          + 'tudja, melyik VLAN-interfészé.',
        be: ['/interface bridge vlan add bridge=bridge vlan-ids={M} tagged=bridge comment=MGMT'],
        kesz: [
          { tipus: 'vlan', eszkoz: 'SW1', vlan: '{M}', nev: 'MGMT' },
          { tipus: 'hid-vlan', eszkoz: 'SW1', vlan: '{M}', tagged: ['bridge'] },
        ],
      },
      {
        hol: 'terminal', eszkoz: 'SW1',
        szoveg: 'A felhasználók VLAN-jai: `/interface bridge vlan add bridge=bridge vlan-ids={V1} comment=IRODA`, és '
          + '`/interface bridge vlan add bridge=bridge vlan-ids={V2} comment=VENDEG`.',
        miert: 'Ezek a sorok a PVID miatt dinamikusan is létrejönnének, de a megjegyzéssel (comment) a lista érthetőbb, '
          + 'és később ide kerülhetnek a trunk portok is.',
        be: ['/interface bridge vlan add bridge=bridge vlan-ids={V1} comment=IRODA', '/interface bridge vlan add bridge=bridge vlan-ids={V2} comment=VENDEG'],
        kesz: [
          { tipus: 'vlan', eszkoz: 'SW1', vlan: '{V1}', nev: 'IRODA' },
          { tipus: 'vlan', eszkoz: 'SW1', vlan: '{V2}', nev: 'VENDEG' },
        ],
      },
      {
        hol: 'terminal', eszkoz: 'SW1',
        szoveg: 'A felhasználói portok: `/interface bridge port set [find interface=ether2] pvid={V1} frame-types=admit-only-untagged-and-priority-tagged`, '
          + 'és ugyanígy az ether9 a {V2} PVID-del.',
        miert: 'Az ether1-hez (ADMIN) most még NEM nyúlunk: ha a kezelő VLAN-ba tennénk, a kapcsolat megszakadna – Safe Mode-ban '
          + 'pedig a switch az egészet visszavonná.',
        be: [
          '/interface bridge port set [find interface=ether2] pvid={V1} frame-types=admit-only-untagged-and-priority-tagged',
          '/interface bridge port set [find interface=ether9] pvid={V2} frame-types=admit-only-untagged-and-priority-tagged',
        ],
        kesz: [
          { tipus: 'hid-port', eszkoz: 'SW1', port: 'ether2', pvid: '{V1}', kerettipus: 'admit-only-untagged-and-priority-tagged' },
          { tipus: 'hid-port', eszkoz: 'SW1', port: 'ether9', pvid: '{V2}', kerettipus: 'admit-only-untagged-and-priority-tagged' },
        ],
      },
      {
        hol: 'terminal', eszkoz: 'SW1',
        szoveg: 'Most kapcsold be a VLAN-szűrést: `/interface bridge set bridge vlan-filtering=yes`.',
        miert: 'Az ether1 PVID-je még 1, és a bridge a régi címével szintén az 1-es VLAN tagja – ezért a kapcsolatod most '
          + 'megmarad. PC1 és PC2 viszont már a saját VLAN-jában van.',
        be: ['/interface bridge set bridge vlan-filtering=yes'],
        kesz: [
          { tipus: 'vlan-szures', eszkoz: 'SW1', be: true },
          { tipus: 'kapcsolat', eszkoz: 'SW1', allapot: 'el' },
        ],
      },
      {
        hol: 'terminal', eszkoz: 'SW1',
        szoveg: 'Nézd át a VLAN-táblát: `/interface bridge vlan print`. Ha minden jó, engedd el a Safe Mode-ot: Ctrl+X.',
        miert: 'A „[Safe Mode released]” után a változtatások maradnak. Erre most szükség van: a következő lépésben szándékosan '
          + 'megszakad a kapcsolat, és nem akarjuk, hogy a switch visszavonja a beállításokat.',
        be: ['/interface bridge vlan print', '^X'],
        kesz: [
          { tipus: 'parancs', eszkoz: 'SW1', szavak: ['/interface', 'bridge', 'vlan', 'print'] },
          { tipus: 'safe-mode', eszkoz: 'SW1', be: false },
        ],
      },
      {
        hol: 'terminal', eszkoz: 'SW1',
        szoveg: 'Az átállás: az ether1 legyen a {M}-es VLAN access portja: '
          + '`/interface bridge port set [find interface=ether1] pvid={M} frame-types=admit-only-untagged-and-priority-tagged`.',
        miert: 'Ettől a pillanattól az ADMIN gép a {M}-es VLAN-ban van – de még a régi címével, ezért a kapcsolat megszakad. '
          + 'Ez most várható, és rendben van: a beállítás megmarad.',
        be: ['/interface bridge port set [find interface=ether1] pvid={M} frame-types=admit-only-untagged-and-priority-tagged'],
        kesz: [
          { tipus: 'hid-port', eszkoz: 'SW1', port: 'ether1', pvid: '{M}', kerettipus: 'admit-only-untagged-and-priority-tagged' },
          { tipus: 'kapcsolat', eszkoz: 'SW1', allapot: 'megszakadt' },
        ],
      },
      {
        hol: 'eszkoz', eszkoz: 'ADMIN',
        szoveg: 'Kattints az ADMIN gépre: új címet kap a kezelő hálózatból.',
        miert: 'Az ADMIN gép portja már a {M}-es VLAN-ban van; ott a 192.168.{M}.0/24 hálózat a kezelő hálózat.',
        kesz: { tipus: 'kivalasztva', eszkoz: 'ADMIN' },
      },
      {
        hol: 'pc', eszkoz: 'ADMIN',
        szoveg: 'IP-cím: 192.168.{M}.10, maszk: 255.255.255.0, majd Mentés.',
        miert: 'Átjáró nem kell: a switch kezelő címe (192.168.{M}.2) ugyanebben a hálózatban van.',
        kesz: { tipus: 'pc-ip', eszkoz: 'ADMIN', ip: '192.168.{M}.10', maszk: '255.255.255.0' },
      },
      {
        hol: 'terminal', eszkoz: 'SW1',
        szoveg: 'Vissza SW1 termináljához (a fülére kattintva), és lépj be az új címre: `ssh admin@192.168.{M}.2`.',
        miert: 'Ha a bridge nem lenne tagja a {M}-es VLAN-nak, vagy a cím rossz interfészen lenne, itt „Connection timed out” jönne – '
          + 'és csak a konzolkábel segítene.',
        be: ['ssh admin@192.168.{M}.2'],
        kesz: { tipus: 'kapcsolat', eszkoz: 'SW1', allapot: 'el', ip: '192.168.{M}.2' },
      },
      {
        hol: 'terminal', eszkoz: 'SW1',
        szoveg: 'Nézd meg az egész beállítást: `/export`.',
        miert: 'Az export a switch teljes beállítását parancsok formájában írja ki (csak ami eltér a gyáritól) – mint Ciscón a '
          + 'show running-config. Ebből egy másik switch is beállítható.',
        be: ['/export'],
        kesz: { tipus: 'parancs', eszkoz: 'SW1', szavak: ['/export'] },
      },
      {
        hol: 'ellenorzes',
        szoveg: 'Kész! Nyomd meg az Ellenőrzés gombot.',
        miert: 'Az ellenőrzés pingekkel nézi meg, hogy az ADMIN gép eléri-e a switch kezelő címét – és az ellenpróbák azt is, '
          + 'hogy a felhasználói portokról NEM érhető el.',
        kesz: { tipus: 'ellenorzes' },
      },
    ],
    cimterv: [
      { eszkoz: 'SW1', interfesz: 'MGMT (VLAN-interfész)', ip: '192.168.{M}.2', maszk: '255.255.255.0', vlan: '{M}' },
      { eszkoz: 'ADMIN', ip: '192.168.{M}.10', maszk: '255.255.255.0', vlan: '{M}', hova: 'SW1 ether1' },
      { eszkoz: 'PC1', ip: '192.168.{M}.50', maszk: '255.255.255.0', vlan: '{V1}', hova: 'SW1 ether2' },
      { eszkoz: 'PC2', ip: '192.168.88.50', maszk: '255.255.255.0', vlan: '{V2}', hova: 'SW1 ether9' },
    ],
    topologia: {
      meret: { szel: 800, mag: 400 },
      eszkozok: [
        { nev: 'SW1', tipus: 'switch', x: 150, y: 70 },
        { nev: 'ADMIN', tipus: 'pc', x: 60, y: 270 },
        { nev: 'PC1', tipus: 'pc', x: 330, y: 270 },
        { nev: 'PC2', tipus: 'pc', x: 560, y: 270 },
      ],
      kabelek: [
        ['SW1', 'ether1', 'ADMIN', 'FastEthernet0'],
        ['SW1', 'ether2', 'PC1', 'FastEthernet0'],
        ['SW1', 'ether9', 'PC2', 'FastEthernet0'],
      ],
    },
    kiindulo: {
      ADMIN: { ip: '192.168.88.10', maszk: '255.255.255.0' },
      PC1: { ip: '192.168.{M}.50', maszk: '255.255.255.0' },
      PC2: { ip: '192.168.88.50', maszk: '255.255.255.0' },
    },
    celok: [
      { tipus: 'kezelo-ip', eszkoz: 'SW1', ip: '192.168.{M}.2/24', vlan: '{M}', szoveg: 'SW1 kezelő címe: 192.168.{M}.2/24 egy VLAN-interfészen, a {M}-es VLAN-ban' },
      { tipus: 'vlan', eszkoz: 'SW1', vlan: '{M}', nev: 'MGMT', szoveg: 'SW1: van {M|es} VLAN, a megjegyzése MGMT' },
      { tipus: 'vlan', eszkoz: 'SW1', vlan: '{V1}', nev: 'IRODA', szoveg: 'SW1: van {V1|es} VLAN, a megjegyzése IRODA' },
      { tipus: 'vlan', eszkoz: 'SW1', vlan: '{V2}', nev: 'VENDEG', szoveg: 'SW1: van {V2|es} VLAN, a megjegyzése VENDEG' },
      { tipus: 'access-port', eszkoz: 'SW1', port: 'ether1', vlan: '{M}', szoveg: 'SW1 ether1 (ADMIN): access port, VLAN {M}' },
      { tipus: 'access-port', eszkoz: 'SW1', port: 'ether2', vlan: '{V1}', szoveg: 'SW1 ether2 (PC1): access port, VLAN {V1}' },
      { tipus: 'access-port', eszkoz: 'SW1', port: 'ether9', vlan: '{V2}', szoveg: 'SW1 ether9 (PC2): access port, VLAN {V2}' },
      { tipus: 'pc-ip', eszkoz: 'ADMIN', ip: '192.168.{M}.10', maszk: '255.255.255.0', szoveg: 'ADMIN IP-címe: 192.168.{M}.10 /24' },
      { tipus: 'ping', honnan: 'ADMIN', ip: '192.168.{M}.2', vart: true, szoveg: 'Ping ADMIN → SW1 (192.168.{M}.2) megy' },
      {
        tipus: 'ping', honnan: 'PC1', ip: '192.168.{M}.2', vart: false, ellenproba: true,
        szoveg: 'Ellenpróba: PC1 (a {V1|es} VLAN-ban, kezelő hálózatbeli címmel) NEM éri el a switch kezelő címét',
      },
      {
        tipus: 'ping', honnan: 'PC2', ip: '192.168.88.1', vart: false, ellenproba: true,
        szoveg: 'Ellenpróba: a felhasználói portokról a switch régi címe (192.168.88.1) sem érhető el',
      },
      {
        tipus: 'szoras', honnan: 'PC1', elerje: [], neErje: ['ADMIN', 'PC2'], ellenproba: true,
        szoveg: 'Ellenpróba: PC1 szórása nem jut el sem az ADMIN géphez, sem PC2-höz',
      },
    ],
    magyarazat: [
      {
        cim: 'Miért kell külön kezelő VLAN?',
        szoveg: [
          'Gyárilag a switch címe (192.168.88.1) ugyanabban a VLAN-ban van, mint a felhasználók gépei: bárki megpróbálhat '
            + 'belépni. Ha a kezelés külön VLAN-ban van, a switch címét csak azok érik el, akiknek a portja ebben a VLAN-ban '
            + 'van – a felhasználói portokról nem, akkor sem, ha valaki „kitalálja” a kezelő hálózat címét (ezt mutatja '
            + 'az első ellenpróba).',
        ],
      },
      {
        cim: 'A switch saját címe: bridge vagy VLAN-interfész',
        szoveg: [
          'A switch processzora a bridge-en át kapcsolódik a portokhoz; a bridge-nek is van PVID-je (gyárilag 1). Ha az IP-cím '
            + 'magán a bridge-en van, a címke nélküli, PVID szerinti VLAN-ban érhető el. A VLAN-interfész (/interface vlan … '
            + 'interface=bridge) egy másik VLAN-ba ad „lábat” a processzornak: a bridge a VLAN forgalmát címkével adja neki.',
          'Ehhez a bridge-nek a VLAN címkézett tagjának kell lennie (tagged=bridge). Ha ez kimarad, a VLAN-interfész semmit '
            + 'nem kap – a cím be van állítva, mégsem érhető el. Ez a leggyakoribb oka a kizárásnak.',
        ],
      },
      {
        cim: 'Hogyan zárja ki magát az ember?',
        szoveg: [
          'A bemutató első kísérletében az ADMIN port a {M}-es VLAN-ba került, a VLAN-szűrés bekapcsolt – de az ADMIN gép '
            + 'még a régi címével próbálta elérni a switch régi címét, amely az 1-es VLAN-ban maradt. A két VLAN között nincs '
            + 'átjárás, az út megszakadt. Ilyenkor a változtatás már megtörtént, de te már nem éred el a switchet, hogy '
            + 'visszacsináld.',
        ],
      },
      {
        cim: 'Safe Mode – a biztonsági háló',
        szoveg: [[
          'Ctrl+X: a Safe Mode be (a prompt végén <SAFE>); a switch megjegyzi a változtatásokat.',
          'Ha a kapcsolat megszakad, a switch visszavonja a Safe Mode óta tett változtatásokat. A valódi eszközön ez a TCP '
            + 'időtúllépése után történik (kb. 9 perc); a szimulátorban hamarabb.',
          'Újabb Ctrl+X: a Safe Mode vége, a változtatások maradnak („[Safe Mode released]”).',
          'A valódi eszköz legfeljebb 100 változtatást jegyez meg Safe Mode-ban; ha több lenne, kilép belőle, és nem von vissza '
            + 'semmit – ezért érdemes kis lépésekben dolgozni.',
        ]],
      },
      {
        cim: 'A helyes sorrend',
        szoveg: [[
          'Safe Mode be.',
          'Kezelő VLAN-interfész és cím, a VLAN-táblában tagged=bridge.',
          'A felhasználói VLAN-ok és portok; a kezelő gép portja egyelőre marad.',
          'VLAN-szűrés be – a kapcsolat megmarad; ellenőrzés; Safe Mode el.',
          'Átállás: a kezelő gép portja a kezelő VLAN-ba, a gép új címet kap, belépés az új címre.',
        ], 'A valóságban az utolsó lépést gyakran egy másik úton (pl. egy második porton vagy a konzolon át) végzik, hogy '
          + 'egy pillanatra se maradjanak kapcsolat nélkül.'],
      },
      {
        cim: 'Ha mégis kizártad magad',
        szoveg: [
          'Safe Mode nélkül a switch nem vonja vissza a változtatásokat. Ekkor oda kell menni hozzá: a soros konzolport '
            + '(a szimulátorban: konzol) mindig működik, mert nem a hálózaton át kapcsolódik. Végső esetben a gyári állapot '
            + 'visszaállítása (reset) segít – de akkor minden beállítás elvész.',
        ],
      },
      {
        cim: 'Próbáld ki!',
        szoveg: [[
          '`/interface bridge vlan print detail` – a beállított és a ténylegesen működő tagok (a bridge is!).',
          '`/ping 192.168.{M}.10` – a switch is tud pingelni, a cél hálózatában lévő saját címéről.',
          '`/ip address print` – a régi (192.168.88.1) cím még megvan: törölheted (`/ip address remove 0`).',
          'Zárd ki magad Safe Mode NÉLKÜL (pl. `/interface bridge vlan set [find vlan-ids={M}] tagged=""`), majd lépj be a `konzol` paranccsal, és javítsd ki.',
        ]],
      },
    ],
  });
})(typeof window !== 'undefined' ? window : globalThis);
