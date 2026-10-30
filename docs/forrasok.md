# Kimenet-forrásjegyzék

Itt van összegyűjtve, hogy a szimulátor egy-egy parancsának kimenete és hibaüzenete **milyen formát** követ, és
ezt a formát milyen nyilvános forrásokból állítottuk össze. Szöveget nem másolunk: csak a formát jegyezzük fel
(oszlopok, sorrend, szóközök, hibaüzenetek), a súgószövegek és a magyarázatok saját megfogalmazások.

Utánzott eszköz: **2960-24 jellegű switch, IOS 15.0 jellegű kimenetek** (homelab még nincs).
Szabály: parancsonként legalább 2 forrás. Ahol ez még nincs meg, ott **„ellenőrizendő”** a jelölés –
ezeket érdemes elsőként összevetni egy valódi eszközzel vagy újabb forrásokkal.

## Források

| # | Forrás | Mire jó |
|---|--------|---------|
| F1 | [Cisco – Using the Command-Line Interface (ME 3600X/3800X konfigurációs útmutató)](https://cisco.com/en/US/docs/switches/metro/me3600x_3800x/trash/swcli.html) | hibaüzenetek, ? súgó alakjai, rövidítés, előzmények alapmérete (10) |
| F2 | [Cisco Tech Note 46253 – ip domain-lookup](https://cisco.com/c/en/us/support/docs/routers/10000-series-routers/46253-ipdomain-lookup.html) | elgépelt parancs exec módban → „Translating …” |
| F3 | [Cisco Community – show vlan brief vs. show vlan id 1](https://community.cisco.com/t5/switching/different-output-show-vlan-brief-and-show-vlan-id-1/m-p/3754258) | show vlan brief oszlopszélességei; a trunk portok nem látszanak benne |
| F4 | [ITExamAnswers – 3.4.6 Lab: Configure VLANs and Trunking](https://itexamanswers.net/3-4-6-lab-configure-vlans-and-trunking-answers.html) | show vlan brief elrendezése, 1002–1005 act/unsup, port nélküli VLAN sora |
| F5 | [NetworkAcademy.io – VLAN Concept](https://www.networkacademy.io/ccna/ethernet/vlan-concept) | show vlan brief: portok tördelése, VLAN 1 portjai, gyári VLAN-ok |
| F6 | [Aliyun – 2960-24 konfiguráció (éles környezet)](https://developer.aliyun.com/article/519446) | 2960 running-config felépítése, sorrendje (12.2-es példány) |
| F7 | [Cisco Community – VTP server és transparent mód különbsége](https://community.cisco.com/t5/switching/the-difference-between-vtp-server-and-transparent-mode-on/m-p/2490961) | VTP server módban a VLAN-ok nincsenek a running-configban |
| F8 | [Cisco NetAcad tananyag (Tartui Egyetem tükre), 3.2.1.1](https://courses.cs.ut.ee/all/MTAT.08.003/mat/2mrs/course/module3/3.2.1.1/3.2.1.1.html) | a normál VLAN-ok a vlan.dat fájlban vannak |
| F9 | [KSU – Lab 02: Switch Configuration](https://faculty.ksu.edu.sa/sites/default/files/lab02_switchconfig_0.pdf) | promptok, „Enter configuration commands …”, %SYS-5-CONFIG_I, „con0 is now available”, „Press RETURN …” |
| F10 | [Cisco Community – VLAN description, 2960](https://community.cisco.com/t5/switching/vlan-description-switch-2960/m-p/3693786) | alapértelmezett VLAN-név (VLAN0010), a név legfeljebb 32 karakter |
| F11 | [Cisco Community – trunk portok egy Catalyst 2960-on](https://community.cisco.com/t5/switching/create-trunkports-on-catalyst-2960/m-p/2159710) | show interfaces trunk: a négy szakasz; link nélküli trunk port: status „other”, VLAN-listák „none” |
| F12 | [administrator.de – show mac address-table IOS 15-ön](https://administrator.de/forum/cisco-switch-ios-15-show-mac-address-table-249926.html) | show mac address-table: fejléc, STATIC/CPU és DYNAMIC sorok, összesítő sor |
| F13 | [Cisco Community – auto/auto: a-full, a-100](https://community.cisco.com/t5/switching/default-auto-negotiate-shows-a-full-a-100/td-p/4747925) | show interfaces status: valódi eszközön a-full / a-100 (a Packet Tracer itt „auto”-t mutat) |
| E | Saját emlékezet (CCNA-oktatás, Packet Tracer-gyakorlat) | csak kiegészítésként; egyedül nem elég |

## Parancsok és üzenetek

| Mit | Forma a szimulátorban | Források | Állapot |
|-----|------------------------|----------|---------|
| Kétértelmű rövidítés | `% Ambiguous command:  "sor"` (két szóköz a kettőspont után) | F1, E | rendben |
| Hiányos parancs | `% Incomplete command.` + üres sor | F1, E | az üres sor: ellenőrizendő |
| Érvénytelen szó | `^` a hibás karakter alatt (a prompt hosszát is számolva), majd `% Invalid input detected at '^' marker.` + üres sor | F1, E | rendben; az üres sor: ellenőrizendő |
| Ismeretlen szó exec módban (egy szó) | `Translating "x"...domain server (255.255.255.255)`, várakozás, `% Unknown command or computer name, or unable to find computer address` | F2, E | rendben (F2-ben kétszer jelenik meg a Translating sor – egyszerűsítés) |
| Ismeretlen első szó exec módban (több szó) | `^` a MÁSODIK szó alatt (az első szót gépnévnek veszi) | E | ellenőrizendő |
| ? súgó szó közben (`sh?`) | az illő szavak oszlopokban, majd üres sor | F1, E | rendben |
| ? súgó szóköz után (`show ?`) | `  szó  magyarázat` sorok, a végén `  <cr>`, ha Enter is jó; csak `?`-nél fejléc (pl. `Exec commands:`) | F1, E | a `<cr>` és a fejléc: ellenőrizendő |
| ? ismeretlen szóra | `% Unrecognized command` | E | ellenőrizendő |
| Tab | egyértelmű előtag → teljes szó + szóköz; különben nincs változás | F1, E | rendben |
| Előzmények | módcsoportonként (exec / konfig) külön, 10 sor | F1, E | a külön lista: ellenőrizendő |
| `configure terminal` | `Enter configuration commands, one per line.  End with CNTL/Z.` | F9, E | rendben |
| csak `configure` | `Configuring from terminal, memory, or network [terminal]? `; rossz válaszra `?Must be "terminal", "memory" or "network"` | E | ellenőrizendő |
| Kilépés a konfigurációból (`end`, `exit`, Ctrl+Z) | új prompt, majd `*Mar  1 hh:mm:ss.mmm: %SYS-5-CONFIG_I: Configured from console by console` | F9, E | rendben; az időbélyeg (óra beállítása nélkül, `service timestamps … datetime msec`): ellenőrizendő |
| `exit` exec módban | `Switch con0 is now available`, üres sorok, `Press RETURN to get started.` | F9, E | rendben |
| Promptok | `Switch>`, `Switch#`, `(config)#`, `(config-if)#`, `(config-if-range)#`, `(config-vlan)#` | F9, E | rendben |
| `hostname` hibás karakterrel | `% Hostname contains one or more illegal characters.` | E | ellenőrizendő |
| `vlan 1006–4094` VTP server módban | `Extended VLAN(s) not allowed in current VTP mode.` + `%Failed to commit extended VLAN(s) changes.` | E | ellenőrizendő |
| gyári VLAN törlése / átnevezése | `%Default VLAN 1 may not be deleted.` / `%Default VLAN 1002 may not have its name changed.` | E | ellenőrizendő |
| Alap VLAN-név, névhossz | `VLAN0010`, legfeljebb 32 karakter | F10, E | rendben |
| `shutdown` | `*Mar  1 …: %LINK-5-CHANGED: Interface FastEthernet0/1, changed state to administratively down` | E | ellenőrizendő |
| `show vlan brief` | üres sor; fejléc; elválasztó 4-32-9-31 kötőjellel; portok vesszővel, soronként ≤31 karakter (4 port), folytatás a Ports oszlop alatt (48 szóköz); 1002–1005 `act/unsup` | F3, F4, F5 | rendben |
| `show running-config` | `Building configuration...`, üres sor, `Current configuration : N bytes`, majd a konfiguráció `!`-ekkel tagolva, `end`; a sorrend F6 szerint | F6, F7, F8, E | a `version 15.0` és a pontos `!`-számok: ellenőrizendő |
| VLAN-ok a running-configban | VTP server módban NEM látszanak (vlan.dat), transparent módban igen | F7, F8 | rendben |
| `switchport mode access/trunk/dynamic …` | a running-configban: ` switchport access vlan N`, utána ` switchport mode access`; trunknál ` switchport mode trunk`; a gyári dynamic auto nem látszik | E | ellenőrizendő |
| `switchport access vlan` nem létező VLAN-nal | `% Access VLAN does not exist. Creating vlan N`, és a VLAN létrejön (VLAN00NN névvel) | E | ellenőrizendő |
| `show interfaces trunk` | üres sor; 4 szakasz (Mode/Encapsulation/Status/Native vlan; allowed; allowed and active; forwarding), Port oszlop 12 karakter; mód: on / auto / desirable; `802.1q`; ha nincs trunk: üres kimenet | F11, E | az oszlopszélességek: ellenőrizendő |
| `show interfaces status` | Port (9+1), Name (18+1), Status (12+1), Vlan (10+1), Duplex (6, jobbra), Speed (6, jobbra), Type; connected / notconnect / disabled; trunk portnál Vlan = `trunk` | F13, E | az oszlopszélességek: ellenőrizendő |
| `show mac address-table` | cím, 43 kötőjel, üres sor, fejléc; sor: VLAN jobbra 4 karakteren, 4 szóköz, MAC, 4 szóköz, típus 8 karakteren, 4 szóköz, port; előbb a 20 STATIC/CPU sor; végül `Total Mac Addresses for this criterion: N` | F12, E | a dinamikus sor: rendben; a statikus sorok listája: ellenőrizendő |
| `show vlan brief` trunk porttal | a trunkként működő port nem szerepel | F3 | rendben |
| Link le / fel | `%LINK-3-UPDOWN: Interface …, changed state to down/up`, utána `%LINEPROTO-5-UPDOWN: Line protocol on Interface …, changed state to down/up` (a szimulátorban 1 s, illetve 2 s múlva) | E | az időzítés: ellenőrizendő |
| PC: `ping` | üres sor, `Pinging X with 32 bytes of data:`, `Reply from X: bytes=32 time<1ms TTL=128` / `Request timed out.` / `Reply from <saját IP>: Destination host unreachable.` / `PING: transmit failed. General failure.`; statisztika (`Packets: Sent = …, Received = …, Lost = … (…% loss),`) | E | ellenőrizendő (asztali gépek parancssorának formája; gyártónév nélkül) |
| PC: `ipconfig`, `arp -a` | `Ethernet adapter FastEthernet0:`, pontozott címkék; `Interface: IP --- 0x2`, `Internet Address / Physical Address / Type` | E | ellenőrizendő |
| `--More--` | 24 soros terminál: 23 sor, majd ` --More-- `; szóköz = oldal, Enter = sor, más = vége | E | ellenőrizendő |

## Szándékos egyszerűsítések (v0.2-től)

- Feszítőfa (STP) még nincs: a port a link feljötte után azonnal továbbít (a valódi eszközön portfast nélkül kb. 30 s).
- DTP egyszerűsítve: dynamic auto + trunk/desirable → trunk; auto + auto → access. A trunkon minden VLAN átmegy
  (1–4094), a natív VLAN mindig 1 (a `switchport trunk …` parancsok még nincsenek meg).
- VTP-terjesztés nincs (gyári állapotban, üres tartománynévvel a valódi eszközök sem terjesztenek).
- A ping ideje mindig `time<1ms`: az animáció miatti késleltetés nem számít bele.
- Access portra érkező címkés keretet a switch eldob.
- Az üzemmód (access/trunk) váltásakor a link nem „pattan” le és fel.

## Szándékos egyszerűsítések (v0.1)

- A `vlan` parancs a szimulátorban azonnal létrehozza a VLAN-t (a valódi eszköz az almódból kilépéskor menti).
- A kiterjesztett VLAN-hibát rögtön a `vlan` parancsnál írja ki.
- `no shutdown` kábel nélkül nem ír üzenetet.
- A valódi running-configban (15.0) a `ip http secure-server` miatt tanúsítványsorok is lehetnek – ezeket kihagytuk.
