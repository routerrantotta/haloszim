# Változások

A legújabb van felül.

## v0.10 – 2026-11-08 – MikroTik: RouterOS-szerű parancssor, gyártóváltó, menedzsment-VLAN és Safe Mode

- **Új gyártó: MikroTik.** CRS326-24G-2S+ jellegű switch (ether1–ether24, sfp-sfpplus1–2, saját rajz), RouterOS 7
  jellegű parancssorral, gyári (defconf) állapotból: minden port a `bridge`-ben, a bridge-en 192.168.88.1/24.
- **Gyártóváltó:** a feladatválasztóban új „Gyártó” lista (csak ha a feladatnak több változata van). A **VLAN-ok két
  switchen, trunkkel** feladat MikroTik eszközökkel is megoldható: saját teendők, 18 lépéses bemutató (VLAN-tábla,
  PVID és frame-types, tagged = trunk, `vlan-filtering`, rövidítések), MikroTik-magyarázat (Cisco–MikroTik
  összevetéssel); a célok ugyanazok. Az URL-ben: `?gyarto=mikrotik`.
- **Új feladat: Menedzsment-VLAN és Safe Mode (MikroTik).** A switchet az ADMIN gépről, hálózaton át (SSH-val) kezeled.
  Ha a VLAN-beállítás elvágja az utat, a kapcsolat megszakad (a terminál az ADMIN gép parancssorára vált: `ssh admin@…`
  vagy `konzol`). A bemutatóban előbb szándékosan kizárod magad – a **Safe Mode (Ctrl+X)** visszavonja a változtatásokat –,
  aztán helyes sorrendben átállítod a kezelést a saját VLAN-jába (VLAN-interfész, `tagged=bridge`, felhasználói
  VLAN-ok, szűrés, átállás, új cím). 16 lépéses bemutató, 12 cél, köztük ellenpróbák (a felhasználói portokról a
  kezelő cím és a régi cím sem érhető el). Véletlen VLAN-számok.
- **RouterOS-szerű parancssor (src/gyartok/routeros):** menük (`/interface`, `/interface bridge`, `… bridge port`,
  `… bridge vlan`, `… bridge host`, `/interface vlan`, `/ip address`, `/system identity`), parancsok `add`, `set`,
  `remove`, `print` (és `print detail`), `enable`, `disable`, `export`, `/ping`; menüváltás (útvonal, `..`, `/`,
  perjeles alak), rövidítés (menü, parancs, paraméter), `név=érték`, `[find …]`, sorszám és név szerinti
  hivatkozás, kérdések (`numbers:`, a hiányzó kötelező paraméter), `?` és F1 súgó (magyarul), Tab, előzmények;
  hibaüzenetek a valódi eszköz formájában (`bad command name …`, `expected end of command …`, `input does not match
  any value of …`, `failure: …`). Kimenetek a v7-es formában (`Flags:`/`Columns:` fejléc, `;;;` megjegyzés,
  dinamikus sorok), export (csak a gyáritól eltérő értékek). Safe Mode: Ctrl+X (és gomb a terminál alatt),
  `<SAFE>` a promptban.
- **Bridge a magban (src/mag/hid.js):** VLAN-szűrés (vlan-filtering) be/ki, PVID, frame-types, ingress-filtering,
  VLAN-tábla tagged/untagged tagokkal és a PVID szerinti dinamikus untagged tagsággal; MAC-tanulás VLAN-onként; a
  switch saját IP-címei (bridge vagy VLAN-interfész) válaszolnak az ARP-ra és a pingre; elérhetőség-vizsgálat a hálózati
  kezeléshez. A MikroTik nem beszél DTP-t és VTP-t.
- **Ellenőrzés:** a `vlan`, `access-port` és `trunk` cél MikroTiken a bridge-beállításokat nézi (a feladat céljai
  gyártófüggetlenek maradnak); új cél: `kezelo-ip`; a bemutatóhoz `hid-port`, `hid-vlan`, `vlan-szures`, `safe-mode`,
  `kapcsolat` feltétel.
- **Javítás (rip-1):** a bemutató két „nézd meg” lépése (`show ip route` R2-n és R3-on) a RIP-frissítés után
  észrevétlenül átugródott; most a parancs beírását is megvárja. A bemutató-tesztek mostantól minden feladatnál
  ellenőrzik, hogy egyetlen lépés sem ugrik át.
- Forrásjegyzék: új MikroTik-szakasz (F27–F36), az „ellenőrizendő” formákkal. Tesztek: 179 (új: routeros.test.js,
  hid.test.js; a bemutató-teszt a vlan-1 MikroTik-változatát és az mgmt-1-et is végigjátssza 4 változattal).

## v0.9 – 2026-11-07 – OSPF (IPv4 és IPv6): két új feladat a Dinamikus routing csoportban

- **Új feladat: OSPF (IPv4, OSPFv2).** A routerrantotta.hu „OSPF – egyterületű” leckéinek háromszög-topológiája
  (R1, R2, R3, három LAN, Area 0), R1 mögött internetszolgáltató; a portnevek ISR 4331 jellegűek (G0/0/0 …). Nyolc rész:
  kiinduló állapot; `router ospf`, router ID, `network` + wildcard; **hibakeresés** (R3-on egy beépített, eltérő
  Hello-idő – `debug ip ospf hello`); passzív LAN és referencia-sávszélesség; alapértelmezett útvonal hirdetése
  (O*E2); pont-pont hálózattípus és DR-választás prioritással (a választás nem preemptív, `clear ip ospf process`);
  költség és útvonalváltás (`tracert`); MD5-hitelesítés. Oktató módban 29 lépéses bemutató; véletlen LAN-címek és
  MD5-jelszó. 25 cél, köztük ellenpróbák (az ISP felé nem fut OSPF, az ISP-link nem szivárog be), valódi pingek.
- **Új feladat: OSPFv3 (IPv6).** Ugyanaz a háromszög csak IPv6-tal: `ipv6 unicast-routing`, `ipv6 router ospf 1`
  (IPv4-cím híján NORTRID-üzenet: kézi router ID kell), `ipv6 ospf 1 area 0` interfészenként; **hibakeresés**
  (beépített MTU-eltérés: a szomszédság EXSTART / EXCHANGE állapotban ragad – `debug ipv6 ospf adj`); passzív LAN,
  referencia-sávszélesség, ::/0 hirdetése (OE2), pont-pont link, DR-választás, költség. 25 lépéses bemutató, 22 cél.
- **OSPF-motor a magban (src/mag/ospf.js), OSPFv2-re és OSPFv3-ra:** Hello és Dead időzítő, a Hello-adatok
  ellenőrzése (terület, időzítők, maszk, hitelesítés, azonos router ID); szomszédsági állapotok DOWN-tól FULL-ig valódi
  DBD-, LSR-, LSU- és LSAck-csomagokkal; DR/BDR-választás (Wait-időzítő, nem preemptív, 0-s prioritás), pont-pont és
  loopback hálózattípus; Router, Network, AS External LSA (OSPFv3-ban Link és Intra-Area-Prefix is), elárasztás
  (DROTHER → 224.0.0.6, DR → 224.0.0.5), SPF (Dijkstra) egyenlő költségű utakkal; költség a referencia-sávszélességből
  vagy kézzel; passzív interfész; default-information originate [always]; MD5- és egyszerű jelszavas hitelesítés;
  MTU-ellenőrzés az adatbázis-cserénél. A routing táblában O és O*E2 (IPv6-ban O és OE2) sorok, AD 110.
- **Új parancsok (router):** `router ospf`, `ipv6 router ospf` és almódjuk (`router-id`, `network … area …`,
  `passive-interface [default]`, `auto-cost reference-bandwidth`, `default-information originate [always]`,
  `maximum-paths`); interfészen `ip ospf <N> area <A>`, `ip ospf cost / priority / network / hello-interval /
  dead-interval / authentication [message-digest|null] / message-digest-key / authentication-key`, `ipv6 ospf …`
  ugyanezekkel, `ip mtu`, `ipv6 mtu`, `description`; exec: `show ip ospf [neighbor | interface [brief | <if>] | database]`,
  ugyanez `ipv6`-tal, `show ip route ospf`, `show ipv6 route ospf`, `clear ip|ipv6 ospf process` (megerősítéssel),
  `debug ip|ipv6 ospf hello|adj`, `ping … source <if|cím>`, `write [memory]`. A `show ip protocols`,
  `show ipv6 protocols` és `show running-config` az OSPF-et is mutatja.
- **Ellenőrzés:** új céltípusok – `ospf` (folyamat: router ID, interfészek és terület, passzív, referencia, default
  route), `ospf-szomszed` (állapot és szerep), `ospf-interfesz` (hálózattípus, DR, költség, prioritás, időzítők, MD5).
- **Rajz:** az OSPF-csomagok kékek, buborékuk megmondja a típusukat (Hello, DBD, LSR, LSU, LSAck); a jelmagyarázatban
  csak az a protokoll látszik, amelyik forgalmaz. Csak IPv6-os PC alatt az IPv6-cím látszik.
- Az értelmező új paramétertípusai: terület (szám vagy A.B.C.D) és „a sor maradéka” (description).
- Tesztek: mindkét OSPF-bemutató alap- és 3 véletlen változattal végigjátszva (lépésátugrás nélkül), teljes megoldások
  ellenőrzése, kimenetek formája a lecke szerint, Hello- és MTU-hiba, DR-választás és nem preemptív viselkedés,
  router ID-váltás, interfész-módszer, eltérő hálózattípus, MD5-eltérés, NORTRID; 151 teszt.

## v0.8 – 2026-11-05 – Routerek, RIPv2 és RIPng (új feladatcsoport: Dinamikus routing)

- **Új feladat: RIPv2 és RIPng** a **Dinamikus routing** csoportban (a csoport később bővül). Három router háromszögben
  (R1–R3 között lassú soros vonal), R1 mögött internetszolgáltató, három LAN, IPv4 és IPv6. Hat rész: a kiinduló állapot,
  RIPv2-alapbeállítás, az automatikus összegzés csapdája (nem összefüggő 172.16-os hálózat), alapértelmezett útvonal
  terjesztése, RIPng, végül metrika és konvergencia (a soros vonal ki- és bekapcsolása `debug ip rip` mellett).
  Oktató módban 29 lépéses bemutató, gyakorló és vizsga módban véletlen LAN-címek; részletes magyarázat (a Packet
  Tracertől való eltérésekkel együtt). 27 cél, köztük ellenpróbák (nincs összevont /16, az ISP-link nem szivárog be,
  az ISP felé nem fut RIPng), és valódi pingek IPv4-en és IPv6-on.
- **Router (ISR 4331 jellegű):** GigabitEthernet0/0/0–2, Serial0/1/0–1, létrehozható Loopback. Saját rajz a topológián,
  egyenes kábelek, szaggatott soros vonal, hálózatfeliratok a rajzon.
- **A magban:** IP-továbbítás (leghosszabb előtag, TTL, egyenlő költségű utak), ARP és IPv6-szomszédfelderítés (ND),
  ICMP „Time exceeded” és „Destination unreachable”, routing tábla (C, L, S, R; adminisztratív távolság), statikus
  útvonalak, **RIP** (v1/v2, 30 s-os frissítés, triggered update, kérés, split horizon, poisoning, invalid / holddown /
  flush, auto-summary, passzív interfész, default-information originate) és **RIPng** (link-local következő ugrás,
  interfészenkénti bekapcsolás, ::/0 hirdetése). A soros vonal késleltetése a ping- és tracert-időkben is látszik.
- **Új parancsok (router):** `ip address`, `ipv6 address` (link-local is), `ipv6 enable`, `ip route`, `ipv6 route`,
  `ipv6 unicast-routing`, `router rip` (version, network, passive-interface, auto-summary, default-information originate,
  timers basic), `ipv6 router rip`, `ipv6 rip … enable / default-information originate|only`, `clock rate`, `bandwidth`,
  `show ip interface brief`, `show ipv6 interface brief`, `show ip route [rip|connected|static]`, `show ipv6 route […]`,
  `show ip protocols`, `show ipv6 protocols`, `show ip rip database`, `show ipv6 rip [database]`, `show ip arp`,
  `show running-config`, `ping`, `traceroute`, `debug ip rip`, `debug ipv6 rip`, `undebug all`, `clear ip route *`.
- **PC:** IPv6-cím és -átjáró az űrlapon (IPv6-os feladatban), IPv6-ping, `tracert`, `ipconfig` IPv6-sorokkal,
  „Destination net unreachable” és magyarázat, ha az első csomagok az ARP miatt vesznek el.
- **Ellenőrzés:** új céltípusok (`rip`, `ripng`, `ipv6-routing`, `utvonal` – „nincs” változattal ellenpróbának);
  a ping-próba IPv6-címre és több pingre is (`db`), routerek esetén „bemelegítő” pingekkel.
- A címterv-táblázat oszlopai a feladathoz igazodnak (eszköz, interfész, IPv4, IPv6, átjáró).
- Telefonon a hosszú parancsok is törnek a panelen (nincs vízszintes görgetés).
- Tesztek: a RIP-feladat bemutatója alap- és 3 véletlen változattal végigjátszva, teljes megoldás ellenőrzése,
  kimenetek formája, auto-summary hiba, poisoning a debugban, verzióeltérés, passzív interfész; 130 teszt.

## v0.7 – 2026-10-30 – Beépíthető a weboldalba

- **Védőréteg a stílusban:** a befogadó oldal általános szabályai (`button`, `form`, `label`, `input`, `.light h2`,
  `button:hover`) nem torzítják el a szimulátort. A `:where()` miatt a védőréteg csak egy osztálynyi erős, így a
  szimulátor saját `.hsz-…` szabályai továbbra is felülírják. A routerrantotta.hu stílusával ellenőrizve: a gombok,
  fülek, címek, űrlapok mérete, betűje, színe pontosan ugyanaz, mint a kipróbáló oldalon.
- **`hibajelento` beállítás** az `indit`-ban: a „Hibás a kimenet? Jelezd!” link célja megadható (a weboldalon
  `../otlet.html`, így a helyi tesztváltozatban is a helyi ötletküldőre visz). A link mindig tartalmaz `parancs=`
  paramétert (üresen is) – ebből tudja az ötletküldő, hogy a szimulátorból jöttek.
- README: „Beépítés egy weboldalba” rész.
- A weboldal tesztváltozatába (teszt/v0.11/szimulator) beépítve – a weboldal repójába nem került fel.

## v0.6 – 2026-10-30 – Bemutató buborékokkal, állítható sebesség

- **Bemutató (oktató mód):** buborékok vezetnek végig a feladaton lépésről lépésre: a rajzon az eszközre, a terminál
  beviteli sorára, a PC-űrlapra vagy az Ellenőrzés gombra mutatnak, és megmondják, **mit** írj be és **miért**.
  - A lépés az **állapot** alapján teljesül (rövidítve is, más sorrendben is): pl. ha a VLAN megvan a jó névvel.
    Ha a tanuló előreszaladt, a bemutató átugorja a már elvégzett lépéseket.
  - Ha a lépés másik eszközön van, a buborék előbb az eszköz fülére mutat. Amíg a terminál ír (pl. fut a ping) és
    amíg az Ellenőrzés fut, a buborék nem takar.
  - „Kihagyom ezt a lépést”, „Bemutató bezárása”, és a panelen „Bemutató (buborékok)” gomb az újraindításhoz.
  - Mindkét feladathoz: VLAN-feladat 19 lépés, VTP-feladat 17 lépés (a revíziócsapda nullázásával kezdve).
- **Csomagok sebessége** a rajz alatt: Nagyon lassú (0,2×), Lassú (0,4×), Normál, Gyors (2×). Az egész szimulált idő
  lassul (a csomagok, a ping, a link feljövetele), így lassítva is ugyanúgy működik a hálózat – csak jól követhető.
  Feladatváltáskor megmarad (a böngészőben nem tároljuk el).
- A kipróbáló oldalról lekerült a „fejlesztői kipróbáló oldal” felirat.
- Új modulok: `src/feladat/vezetett.js` (a lépések logikája, rajz nélkül – tesztelhető), `src/nezet/buborek.js`.
  Feladatfájl: új `bemutato` mező (lépések: hol, eszköz, szöveg, miért, be, kesz).
- Tesztek: a bemutató végigjátszása mindkét feladatra alapadatokkal és 3–3 véletlen változattal (minden lépés
  teljesül, a végén hibátlan az ellenőrzés), előreszaladás; 119 teszt.

## v0.5 – 2026-10-30 – Véletlen adatok, megosztható változatok

- **Gyakorló és Vizsga módban minden indításkor más adatok:** VLAN-számok (2–254), VLAN-nevek, IP-címek
  (a harmadik bájt a VLAN száma, a gépek száma is véletlen), és a VTP-feladatban a tartománynév, a jelszó, a
  helyi és a „régi” VLAN, valamint a csapda revíziószáma. A szövegek, a címterv, a teendők, a tippek, a magyarázat
  és az ellenőrzés is ehhez igazodik. **Oktató módban** maradnak az alapadatok (VLAN 10 IRODA …).
- **Változatszám és link:** a panelen „Véletlen adatok – változat: #12345”, és **Link másolása** gomb. A link
  (`?feladat=…&mod=…&mag=12345`) mindenkinek pontosan ugyanazt a változatot adja – pl. a tanár így adhat ki
  egy vizsgát az osztálynak. (Ha a böngésző nem engedi a vágólapot, a link kijelölve megjelenik.)
- **Új változat** gomb (gyakorló és vizsga módban): ugyanaz a feladat más adatokkal. Az **Újrakezdés** ugyanazt a
  változatot indítja újra.
- **Feladatfájl:** új `valtozok` mező (szabályok: szám tartománnyal, lista, jelszó; „különbözzön ettől”), a
  szövegekben helyőrzők: `{VLAN1}`, `{VLAN1|es}` → „10-es”, `{VLAN1|aes}` → „a 10-es” (helyes magyar raggal és
  névelővel: 20-as, az 5-ös, 140-es …). Új modulok: `src/feladat/veletlen.js`, `src/magyar.js`.
- Javítva: a magyarázó üzenetekben a VLAN-szám ragja („a 20-as VLAN” a korábbi „20-es” helyett).
- Tesztek: 300 változat feladatonként (nincs maradék helyőrző, különböző VLAN-ok), 8–8 véletlen változat teljes
  megoldása és ellenőrzése, a VTP-csapda véletlen adatokkal is; 115 teszt.

## v0.4 – 2026-10-30 – Három mód: Oktató, Gyakorló, Vizsga

- **Módválasztó** a feladatválasztó mellett: **Oktató | Gyakorló | Vizsga**. A mód az URL-be is bekerül
  (`?feladat=vtp-1&mod=vizsga`). Ha a tanuló már dolgozott, feladat- vagy módváltás és Újrakezdés előtt rákérdez.
- **Oktató mód:** mint eddig – a teendők mellett a parancsok, Ellenőrzés bármikor, a magyarázat lenyitható.
- **Gyakorló mód:** a teendők csak a célt mondják ki (parancs nélkül). Teendőnként **Tipp** gomb, amely fokozatosan
  segít; az utolsó tipp a megoldás. Sikeres ellenőrzéskor kiírja, hány tipp kellett.
- **Vizsga mód:** csak a forgatókönyv és a követelmények; nincs parancs, nincs tipp, a magyarázat zárva.
  Az idő mérődik. **Beadás** többször is lehet: ilyenkor csak a ✔/✘ látszik, a részletes okok nem.
  Ha minden cél teljesül: „Sikeres vizsga!” idővel és a beadások számával, és megnyílik minden.
  A **Feladom** gomb is megnyitja a parancsokat, a részletes okokat és a magyarázatot.
- **Feladatfájl:** a teendők új alakja `{ cel, parancsok, tippek }` (a régi, szöveges alak is működik); mindkét
  feladat átírva. A leírások parancs nélküliek, hogy a vizsga módban se áruljanak el semmit.
- Új teszt a feladatfájlokra (a célok tényleg parancs nélküliek, minden teendőnek van parancsa és tippje); 109 teszt.

## v0.3 – 2026-10-30 – Feladatválasztó, VTP-feladat, magyarázatok

- **Főoldal:** rövid bemutatás a szimulátorról; a „Mit próbálj ki?” lista helyett minden feladat saját magyarázatot kapott.
- **Feladatválasztó:** két legördülő lista (feladattípus → feladat) és Újrakezdés gomb. Váltáskor a feladat
  azonnal betöltődik, az URL-be is bekerül (`?feladat=vtp-1`), így a link megosztható.
- **Új feladat: „VTP: server, transparent, client”** (`feladatok/vtp-1.js`): három switch sorban, SW3 egy régi
  laborból jön 15-ös revízióval (a klasszikus revíziócsapda), VTP-tartomány, jelszó, version 2, a transparent switch
  helyi VLAN-ja. 22 cél, köztük ellenpróbák (a régi VLAN-ok és a helyi VLAN nem terjedhet el).
- **Magyarázat minden feladat végén** (lenyitható): mit, miért és miért úgy állítunk be, plusz „Próbáld ki!” ötletek.
  A szövegekben a parancsok egyenközű betűvel jelennek meg.
- **VTP a szimulátorban** (`src/mag/vtp.js`): server / client / transparent, tartománynév (a NULL tartományú switch
  átveszi az elsőt, amit hall), jelszó (eltérésnél MD5-hibasor), 1-es és 2-es verzió (a transparent továbbengedés
  különbsége), revíziószám (a nagyobb nyer, kliensé is), nullázás transparent móddal vagy tartományváltással.
  A DTP eltérő tartománynévnél nem egyeztet trunkot. A rajzon a VTP-hirdetés szaggatott szélű fehér pötty.
- **Új parancsok:** `vtp mode server | client | transparent`, `vtp domain`, `vtp password`, `no vtp password`,
  `vtp version`, `show vtp status`, `show vtp password`. Kliensen a VLAN-módosítás tiltva, transparent módban a
  VTP-beállítás és a VLAN-ok a running-configban is látszanak, és kiterjesztett VLAN (1006–4094) is létrehozható.
- 103 automatikus teszt (10 új a VTP-re).

## v0.2 – 2026-10-30 – Az első feladat: VLAN-ok két switchen, trunkkel

- **Első feladat** (`feladatok/vlan-1.js`): 2 switch, 4 PC, 2 VLAN (10 IRODA, 20 RAKTAR), trunk a két switch között.
  A feladatpanelen leírás, teendők, címterv és **Ellenőrzés** gomb.
- **A hálózat magja** (`src/mag/`): kábelek, Ethernet-keretek, 802.1Q-címke (access / trunk, natív VLAN),
  MAC-tábla tanulása és öregedése (300 s), elárasztás, egyszerűsített DTP (dynamic auto / desirable), ARP, IPv4, ping.
  Minden egy közös szimulált órán fut.
- **Eredményalapú ellenőrzés ellenpróbával:** állapot (VLAN-ok, portok, trunk, IP-címek), valódi ping-próbák,
  és ellenpróbák: a szórás (broadcast) nem juthat át másik VLAN-ba, a különböző VLAN-ú gépek nem érik el egymást.
  Minden cél mellett rövid magyarázat, mi a gond.
- **Ping-animáció:** a csomagok végigcsúsznak a kábeleken (ARP = narancs, ping = fekete-sárga), a trunkon a
  VLAN-címke is látszik, az eldobott keret helyén ✕ jel.
- **Topológia:** két switch és négy PC saját rajzzal, kábelek portcímkékkel, link-LED-ek, a trunk kiemelve;
  kattintásra (vagy a fülekkel) választható, melyik eszközt kezeled.
- **PC-ablak:** IP-cím, maszk, átjáró beállítása (ellenőrzéssel), és parancssor: `ping` (`-n`), `ipconfig` (`/all`),
  `arp -a`, `arp -d`, `hostname`, `cls`, `help`.
- **Új IOS-szerű parancsok:** `switchport mode access | trunk | dynamic auto | dynamic desirable`, `no switchport mode`,
  `switchport access vlan` (nem létező VLAN-t létrehoz), `no switchport access vlan`, `show interfaces trunk`,
  `show interfaces status`, `show mac address-table` (`dynamic`).
- **Valódi viselkedés:** a `show vlan brief` nem mutatja a trunk portokat; `shutdown` / `no shutdown` után
  `%LINK-3-UPDOWN` és `%LINEPROTO-5-UPDOWN` üzenetek mindkét switch konzolján; a túloldali VLAN hiányában a
  trunk eldobja a keretet.
- 93 automatikus teszt (29 új a hálózatra, a switchport-parancsokra, a PC-re és az ellenőrzésre).

## v0.1 – 2026-10-29 – A váz

Az első kipróbálható változat: egy switch és egy IOS-szerű parancssor.

- **Repó előkészítése:** `.gitignore`, `package.json` (esbuild az építéshez), automatikus tesztek (`node --test`),
  javított README, forrásjegyzék (`docs/forrasok.md`).
- **Kipróbáló oldal** (`index.html`) a weboldal színeivel, telefonon is (vízszintes görgetés nélkül).
- **Topológianézet:** saját rajzú, 24+2 portos switch SVG-ben; a gépnév élőben frissül, a lekapcsolt portok jelölve.
- **Terminál:** fekete háttér, sárga prompt; Enter, `?`, Tab, ↑/↓ (Ctrl+P/N), Ctrl+A/E, Ctrl+Z,
  `--More--` lapozás; érintőképernyőn gombok (`?`, Tab, ↑, ↓, Ctrl+Z, Tovább, Kilépés).
- **Módok:** `Switch>`, `Switch#`, `(config)#`, `(config-if)#`, `(config-if-range)#`, `(config-vlan)#`;
  `enable`, `disable`, `configure terminal` (és csak `configure` kérdéssel), `exit`, `logout`, `end`, `do`.
  Almódban a globális parancsok is működnek (mint a valódi eszközön).
- **Rövidítés** szavanként (`conf t`, `sh vl br`, `int ra fa0/1 - 4`), kis-/nagybetű mindegy.
- **Hibaüzenetek:** kétértelmű, hiányos, érvénytelen (`^` a hiba helyén), névfeloldás exec módban
  („Translating …”), `% Unrecognized command` a súgóban.
- **Parancsok:** `hostname`, `no hostname`, `vlan`, `no vlan`, `name`, `no name`, `interface`,
  `interface range`, `shutdown`, `no shutdown`, `show vlan brief`, `show running-config`.
- **Valódi viselkedés:** a VLAN-ok VTP server módban nem látszanak a running-configban; a kiterjesztett
  VLAN-ok (1006–4094) nem hozhatók létre; a gyári VLAN-ok nem törölhetők; naplóüzenetek időbélyeggel.
- A még meg nem írt, de létező parancsokra (pl. `copy`, `ping`, `switchport`) a szimulátor megjegyzést ír
  hibaüzenet helyett – és így a rövidítés is úgy viselkedik, mint a valódi eszközön (pl. `dis` kétértelmű).
- „Hibás a kimenet? Jelezd!” link a weboldal ötletküldőjéhez.
