# Változások

A legújabb van felül.

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
