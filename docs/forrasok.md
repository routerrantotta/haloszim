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
| F14 | [Cisco Community – VTP egy 2960XR-en](https://community.cisco.com/t5/switching/vtp-in-switch-2960xr/m-p/3192215) | show vtp status IOS 15-ös formája (VTP Version capable, Feature VLAN szakasz), `*** MD5 digest checksum mismatch on trunk: … ***` |
| F15 | [UCG – Lab 3 (2017), VTP-gyakorlat](https://www.ucg.ac.me/skladiste/blog_2904/objava_20332/fajlovi/lab3_2017.pdf) | a vtp mode / domain / password válaszüzenetei, kliens VLAN-tiltás, régi (12.x) show vtp status |
| F16 | [Cisco fórum – transparent → client váltás](https://supportforums.cisco.com/t5/switching/behavior-when-changing-vtp-transparent-to-vtp-client/m-p/1935598/highlight/true) | `Setting device to VTP CLIENT mode.`; transparentben a revízió 0, kliensként átveszi a server nagyobb revízióját |
| F17 | A felhasználó megoldókulcsa: „Dinamikus forgalomirányítás: RIPv2 és RIPng” (Packet Tracer 9.0-ban mérve, 2026-11-03) | show ip protocols, show ip route (RIP-sorok), show ipv6 route, debug ip rip (poisoning), tracert, `% IPv6 routing not enabled` |
| F18 | [Cisco IOS IP Routing: RIP Command Reference](https://www3-realm.cisco.com/en/US/docs/ios/iproute_rip/command/reference/irr_rip.html) | show ip protocols, show ip rip database, debug ip rip mezői és alakja |
| F19 | [Cisco IOS IPv6 Command Reference – show ipv6 rip](https://cisco.com/en/US/docs/ios/ipv6/command/reference/ipv6_16.html) | show ipv6 rip (folyamat-adatok, időzítők: 30/180/0/120), show ipv6 rip database |
| F20 | [amitsciscozone – Basic RIPng Configuration](https://sites.google.com/site/amitsciscozone/ipv6/basic-ripng-configuration), [RIPng Holddown Timer](https://sites.google.com/site/amitsciscozone/ipv6/ripng-holddown-timer) | valódi RIPng-kimenetek: show ipv6 route (R-sorok, via FE80::…), show ipv6 rip database |
| F21 | [Cisco NetAcad tananyag (Tartui Egyetem tükre), 7.3.1.5](https://courses.cs.ut.ee/all/MTAT.08.003/mat/2mrs/course/module7/7.3.1.5/7.3.1.5.html) | show ip protocols RIP-pel |
| F22 | [Cisco Community – ISR4331](https://community.cisco.com/t5/routing/isr4331-can-t-even-ping-itself/m-p/4735505) | ISR 4331 portnevei (GigabitEthernet0/0/0 …), show ip interface brief IOS XE-n |
| F23 | [basicitnetworking – Troubleshooting RIP v2](https://basicitnetworking.blogspot.com/2012/11/troubleshooting-rip-v2.html?m=1), [NetworkLessons fórum – RIP](https://forum.networklessons.com/t/rip-distance-vector-routing-protocol/876/4) | debug ip rip valódi kimenete (sending/received, build update entries, `in N hops`) |
| F24 | A Routerrántotta saját tananyaga: „OSPF – egyterületű” 1–4. lecke (weboldal, teszt/v0.17/tananyag/ospf-*.html) | show ip ospf neighbor, show ip ospf interface [brief], show ip ospf database, show ip route ospf (O, O*E2), show ip protocols (OSPF), debug ip ospf hello (Mismatched hello parameters, Dead R/C …), %OSPF-5-ADJCHG, `% OSPF: Reload or use …`, `% OSPF: Reference bandwidth is changed.` |
| F25 | [ITExamAnswers – Lab 79: Configuring Single-Area OSPFv3](https://itexamanswers.net/lab-79-configuring-single-area-ospfv3.html) | %OSPFv3-4-NORTRID és %OSPFv3-5-ADJCHG alakja, show ipv6 ospf neighbor fejléce (Interface ID oszlop) |
| F26 | [Cisco Community – OSPFv3 Packet Tracer 7.3-ban](https://community.cisco.com/t5/ipv6/ospfv3/td-p/4089888), [ipSpace – OSPFv3 Router ID](https://blog.ipspace.net/2008/04/ipv4-forever/) | IPv4-cím nélkül az OSPFv3 nem tud router ID-t választani; a PT nem ismeri a `router ospfv3` formát |
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
| `vtp mode …` | `Setting device to VTP SERVER/CLIENT/TRANSPARENT mode.`; ha már az: `Device mode already VTP SERVER.` | F15, F16 | rendben (régebbi IOS-forma; a 15.x a „… mode for VLANS.” alakot is írhatja: ellenőrizendő) |
| `vtp domain …` | `Changing VTP domain name from NULL to X`; azonos névnél `Domain name already set to X.` | F15, E | a második: ellenőrizendő |
| `vtp password …` / `no vtp password` | `Setting device VLAN database password to X` / `Clearing device VLAN database password.` | F15, E | a második: ellenőrizendő |
| `vtp version` kliensen | `Cannot modify version in VTP client mode` | E | ellenőrizendő |
| VLAN létrehozása kliensen | `VTP VLAN configuration not allowed when device is in CLIENT mode.` | F15, E | a % jel nélküli alak: ellenőrizendő |
| `show vtp status` | IOS 15-ös forma: 7 fejsor (címke 32 karakteren, `: `), server esetén `Local updater ID …`, üres sor, `Feature VLAN:`, 14 kötőjel, 5 sor (címke 34 karakteren), MD5 két sorban 8-8 bájt; eltérő jelszónál `*** MD5 digest checksum mismatch on trunk: Gi0/1 ***` | F14, F15 | a pontos szélességek és a `3-1-93` dátumforma: ellenőrizendő |
| `show vtp password` | `VTP Password: X`; ha nincs: `The VTP password is not configured.` | E | ellenőrizendő |
| VTP a running-configban | csak transparent módban: `vtp domain X`, `vtp mode transparent`, és a VLAN-ok | F7, E | rendben |
| `--More--` | 24 soros terminál: 23 sor, majd ` --More-- `; szóköz = oldal, Enter = sor, más = vége | E | ellenőrizendő |

## Router, RIP, RIPng (v0.8-tól)

Utánzott eszköz: **ISR 4331 jellegű router, IOS XE 16 jellegű kimenetek**.

| Mit | Forma a szimulátorban | Források | Állapot |
|-----|------------------------|----------|---------|
| `show ip interface brief` | `Interface` 23, `IP-Address` 16, `OK?` 4, `Method` 7, `Status` 22 karakter, majd `Protocol`; `unassigned` / `YES unset` | F22, F17, E | rendben |
| `show ipv6 interface brief` | `Név [up/up]`, alatta 4 szóközzel a link-local, majd a globális címek; cím nélkül `unassigned` | F17, E | ellenőrizendő |
| `show ip route` | rövidített kódsor (csak a használt kódok), `Gateway of last resort is …`, osztályos csoportok: `… is subnetted, N subnets` (egy maszk: a sorokban nincs /hossz), `… is variably subnetted, N subnets, M masks`; kód 6 (csoportban 9) karakteren; második egyenlő út a `[` alá igazítva; `is possibly down, routing via …` | F17, F18, E | rendben; a kódsor szándékosan rövid |
| `show ipv6 route` | `IPv6 Routing Table - default - N entries`, rövidített kódsor, `R   előtag [120/m]`, alatta `     via FE80::x, interfész`; a végén `L   FF00::/8` `via Null0, receive` | F20, F17 | rendben |
| `show ip protocols` | `*** IP Routing is NSF aware ***`, `Routing Protocol is "rip"`, időzítők, `Default version control: send version 2, receive version 2` (PT-ben „receive 2”), interfésztábla, `Automatic network summarization is (not) in effect`, `Maximum path: 4`, hálózatok, passzív interfészek, `Routing Information Sources`, `Distance: (default is 120)` | F18, F21, F17 | rendben |
| `show ipv6 protocols` | `IPv6 Routing Protocol is "connected"` / `"application"` / `"ND"` / `"rip NÉV"`, `Interfaces:`, `Redistribution:` | F17, E | ellenőrizendő |
| `show ip rip database` | `hálózat/hossz    directly connected, interfész`, tanultnál alatta `    [metrika] via cím, kor, interfész`; `auto-summary` sorok | F18, E | ellenőrizendő |
| `show ipv6 rip` / `database` | `RIP process "NÉV", port 521, multicast-group FF02::9, pid …`, időzítők (30, 180, holddown 0, garbage 120); adatbázis: ` előtag, metric m, installed`, alatta `interfész/FE80::x, expires in N secs` | F19, F20 | rendben |
| `debug ip rip` | `RIP: sending v2 update to 224.0.0.9 via IF (cím)`, `RIP: build update entries`, `cím/hossz via 0.0.0.0, metric m, tag 0`; fogadás: `RIP: received v2 update from cím on IF`, `     cím/hossz via 0.0.0.0 in N hops`; bekapcsolva: `RIP protocol debugging is on` | F23, F17, F18 | rendben |
| `debug ipv6 rip` | `RIPng: Sending multicast update on IF for NÉV`, `src=`, `dst=`, `sport/dport`, `command=2, version=1, mbz=0, #rte=N`, `tag=0, metric=m, prefix=…` | E | ellenőrizendő |
| `undebug all` | `All possible debugging has been turned off` | E | ellenőrizendő |
| router `ping` | `Type escape sequence to abort.`, `Sending 5, 100-byte ICMP Echos to X, timeout is 2 seconds:`, `!!!!!` (`.` időtúllépés, `U` elérhetetlen), `Success rate is N percent (a/5), round-trip min/avg/max = …` | E (közismert) | ellenőrizendő (2. forrás) |
| router `traceroute` | `Tracing the route to X`, `VRF info: (vrf in name/id, vrf out name/id)`, `  1 cím 20 msec 20 msec 20 msec` | E | ellenőrizendő |
| PC `tracert` | `Tracing route to X over a maximum of 30 hops`, `  1    <1 ms    <1 ms    <1 ms  cím`, `Request timed out.`, `Trace complete.` | F17, E | rendben |
| Hibaüzenetek | `% IPv6 routing not enabled`; `%Inconsistent address and mask`; `% X overlaps with IF`; `Bad mask /N for address X`; `% Use the link-local keyword …`; `%No matching route to delete` | F17 (az első), E | a többi ellenőrizendő |
| `show running-config` (router) | IOS XE 16.9 jellegű váz: interfészenként `ip address`/`no ip address`, `shutdown`, `negotiation auto`, IPv6-címek, `ipv6 rip NÉV enable`; `router rip` blokk (version, passive-interface, network, default-information originate, no auto-summary); `ip route`, `ipv6 route`, `ipv6 router rip NÉV` | E | ellenőrizendő |

### OSPF (v0.9)

| Mit | Forma a szimulátorban | Források | Állapot |
|-----|------------------------|----------|---------|
| `show ip ospf neighbor` | üres sor, `Neighbor ID     Pri   State           Dead Time   Address         Interface`, sorok: RID (15), Pri (jobbra, 4), `FULL/DR` (16), `00:00:33` (12), cím (16), interfész; pont-pont linken `FULL/  -` | F24, E | rendben |
| `show ipv6 ospf neighbor` | fejléc: `OSPFv3 Router with ID (…) (Process ID 1)`, oszlopok: … `Dead Time   Interface ID    Interface` | F25, E | rendben |
| `show ip ospf interface brief` | `Interface    PID   Area            IP Address/Mask    Cost  State Nbrs F/C`; állapotok: DR, BDR, DROTH, P2P, LOOP, WAIT, DOWN; OSPFv3-ban `Intf ID` oszlop | F24, E | az IPv6-os változat ellenőrizendő |
| `show ip ospf interface <if>` | a lecke sorai (Internet Address, Process ID / Router ID / Network Type / Cost, Transmit Delay / State / Priority, DR, BDR, Timer intervals, Hello due in, Neighbor Count, Adjacent with) + `Attached via Network Statement / Interface Enable`, `No Hellos (Passive interface)`, MD5-sorok | F24, E | a kiegészítő sorok ellenőrizendők |
| `show ip ospf database` | `Router Link States (Area 0)` (Link ID, ADV Router, Age, Seq#, Checksum, Link count), `Net Link States`, `Type-5 AS External Link States` (Tag) | F24, E | rendben (az ellenőrzőösszeg ál-érték) |
| `show ipv6 ospf database` | Router, Net, Link (Type-8), Intra Area Prefix, Type-5 AS External szakaszok | E | ellenőrizendő |
| `show ip route` OSPF-sorai | `O        10.0.23.0/30 [110/20] via …, 00:04:51, Gi…` (ECMP: második sor behúzva), `O*E2  0.0.0.0/0 [110/1] via …`; IPv6: `O   pfx [110/20]`, `OE2 ::/0 [110/1], tag 1` | F24, E | az IPv6-os sorok ellenőrizendők |
| `show ip protocols` (OSPF) | `Routing Protocol is "ospf 1"`, Router ID, ASBR-sor, `Number of areas …`, `Maximum path: 4`, `Routing for Networks:`, `Routing on Interfaces Configured Explicitly (Area 0):`, `Passive Interface(s):`, `Routing Information Sources:`, `Distance: (default is 110)` | F24, E | rendben |
| `show ipv6 protocols` (OSPF) | `IPv6 Routing Protocol is "ospf 1"`, Router ID, `Number of areas: …`, `Interfaces (Area 0):`, `Redistribution:` | E | ellenőrizendő |
| `show ip ospf` / `show ipv6 ospf` | rövidített összefoglaló (Routing Process, Start time, ASBR, Reference bandwidth unit, Area BACKBONE(0), SPF executed …) | E | ellenőrizendő |
| Naplóüzenetek | `%OSPF-5-ADJCHG: Process 1, Nbr 2.2.2.2 on Gi… from LOADING to FULL, Loading Done` (`EXCHANGE to FULL, Exchange Done`; `FULL to DOWN, Neighbor Down: Dead timer expired / Interface down or detached`); `%OSPFv3-5-ADJCHG: …` ugyanígy; `%OSPFv3-4-NORTRID: OSPFv3 process 1 could not pick a router-id, please configure manually`; `%OSPF-4-DUP_RTRID_NBR …` | F24, F25, E | az IOS XE 16-os OSPFv3-forma („Process 1, IPv6, …”) eltérhet – ellenőrizendő |
| `debug ip ospf hello` | `OSPF-1 HELLO Gi0/0/0: Send hello to 224.0.0.5 area 0 from …`, `Rcv hello from …`, `Mismatched hello parameters from …`, `Dead R 40 C 20, Hello R 10 C 5 Mask R … C …` (IOS XE-forma; a lecke a régi `OSPF: …` formát mutatja) | F24, E | ellenőrizendő |
| `debug ip ospf adj` | `2 Way Communication to …`, `DR/BDR election`, `Elect BDR/DR …`, `Send/Rcv DBD …`, `NBR Negotiation Done. We are the MASTER/SLAVE`, `Nbr … has larger interface MTU`, `Exchange Done with …`, `Synchronized with …, state FULL`, `Mismatched Authentication type/Key …` | E | ellenőrizendő |
| Válaszüzenetek | `% OSPF: Reload or use "clear ip ospf process" command, for this to take effect`; `% OSPF: Reference bandwidth is changed.` + `Please ensure …`; `Reset ALL OSPF processes? [no]:`; `OSPF: Key 1 already exists`; OSPFv3-ban ugyanez `% OSPFv3:` kezdettel, `Reset ALL OSPFv3 processes? [no]:` | F24 (az első kettő), E | a többi ellenőrizendő |

## Szándékos egyszerűsítések (v0.9-től, OSPF)

- Egy routeren címcsaládonként egy OSPF-folyamat lehet (`router ospf 1` és `ipv6 router ospf 1`); másik számnál a
  szimulátor szól. Több terület beállítható, de területek közötti összegzés (ABR, 3-as LSA) nincs.
- A Hello pontosan 10 másodpercenként megy (a valódi eszköz kis eltérést ad hozzá); a DR/BDR-választás a Wait-idő
  (= Dead-idő, 40 s) után vagy egy DR-t/BDR-t valló szomszéd Hellójára (BackupSeen) történik, ahogy a szabvány leírja.
- Az adatbázis-csere egyszerűsített: egy DBD a kezdéshez, egy a fejlécekkel; újraküldés 5 másodpercenként. MTU-eltérésnél
  a szomszédság nem bomlik le magától (a valódi eszköz egy idő után „Too many DBD retransmissions” miatt újrakezdi).
- Az LSA-k nem öregszenek (nincs 30 perces frissítés és 60 perces lejárat); a kor a keletkezés óta eltelt idő.
- Az SPF egy változás után 50 ms-mal fut (a valódi eszközön 5 s-os kezdő késleltetés van, „SPF throttling”).
- Egyenlő költségű utaknál a router csomagonként váltogat (lásd a RIP-nél).
- OSPFv3-ban nincs IPsec-hitelesítés, és a címcsaládos forma (`router ospfv3`, `address-family`) sincs meg.
- A loopback OSPFv2-ben /32-es, OSPFv3-ban /128-as stub; a soros vonal alapból pont-pont.

## Szándékos egyszerűsítések (v0.8-tól, router és RIP)

- A RIP periodikus frissítése pontosan 30 másodpercenként megy (a valódi eszköz kis véletlen eltérést ad hozzá).
- Változáskor (triggered update) 1 másodperc múlva csak a változott bejegyzések mennek ki; a már nem hirdetett
  útvonalakat a router egyszer 16-os metrikával kihirdeti (poisoning). Poison reverse nincs (a Cisco alapból sem).
- Ha egy interfész leesik, az onnan tanult útvonalak azonnal törlődnek (holddown nélkül); holddown akkor van, ha a
  szomszéd 16-os metrikát küld, vagy lejár az útvonal (invalid).
- Egyenlő költségű utaknál a router csomagonként váltogat (a valódi eszköz CEF-fel általában célcímenként osztja el).
- A `default-information originate` (RIP) feltétel nélkül hirdeti a 0.0.0.0/0-t.
- IPv4-ben az ismeretlen MAC-ű következő ugrás felé a router ARP-ot küld, és a csomagot eldobja (mint a valódi);
  IPv6-ban a szomszédfelderítés idejére legfeljebb 3 csomagot sorba tesz.
- A soros vonal 64 kbit/s-os késleltetése irányonként 10 ms (a ping/tracert ideje ebből jön); a gigabites link 0 ms.
- A router traceroute-ja ICMP echóval dolgozik (a valódi UDP-vel), a kimenet formája ugyanaz.
- Nincs `clock rate`-függés (a soros vonal órajel nélkül is működik), nincs CDP, nincs a 4331 GigabitEthernet0 menedzsmentportja.

## Szándékos egyszerűsítések (v0.3-tól, VTP)

- A VTP-hirdetés a szimulátorban egyetlen üzenet (a valódiban summary / subset / request), és a beállításváltozás vagy
  a trunk feljötte után azonnal megy (kérés + válasz); 5 percenként is mindenki hirdet.
- Minden VLAN-módosítás (létrehozás, átnevezés, törlés) külön +1 revízió – a valódi eszköz a vlan-almódból kilépéskor
  ment, így ott kisebb lehet a szám.
- Egyenlő revíziónál nincs átvétel (a valódi eszközön is így van), és nincs külön hibaüzenet.
- VTP 3-as verzió, pruning, `vtp interface`, `vtp file` még nincs.

## Szándékos egyszerűsítések (v0.2-től)

- Feszítőfa (STP) még nincs: a port a link feljötte után azonnal továbbít (a valódi eszközön portfast nélkül kb. 30 s).
- DTP egyszerűsítve: dynamic auto + trunk/desirable → trunk; auto + auto → access. A trunkon minden VLAN átmegy
  (1–4094), a natív VLAN mindig 1 (a `switchport trunk …` parancsok még nincsenek meg).
- VTP-terjesztés nincs (gyári állapotban, üres tartománynévvel a valódi eszközök sem terjesztenek).
- A ping ideje `time<1ms` (v0.8-tól: soros vonalon a vonal késleltetése, pl. `time=20ms`): az animáció miatti késleltetés nem számít bele.
- Access portra érkező címkés keretet a switch eldob.
- Az üzemmód (access/trunk) váltásakor a link nem „pattan” le és fel.

## Szándékos egyszerűsítések (v0.1)

- A `vlan` parancs a szimulátorban azonnal létrehozza a VLAN-t (a valódi eszköz az almódból kilépéskor menti).
- A kiterjesztett VLAN-hibát rögtön a `vlan` parancsnál írja ki.
- `no shutdown` kábel nélkül nem ír üzenetet.
- A valódi running-configban (15.0) a `ip http secure-server` miatt tanúsítványsorok is lehetnek – ezeket kihagytuk.
