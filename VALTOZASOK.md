# Változások

A legújabb van felül.

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
