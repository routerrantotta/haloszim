# Változások

A legújabb van felül.

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
