# Haloszim

Böngészőben futó, feladat-alapú hálózati szimulátor a [routerrantotta.hu](https://routerrantotta.hu)-hoz.

**Kipróbálás:** https://routerrantotta.github.io/haloszim/ (fejlesztői kipróbáló oldal)

Jelenleg (v0.3) két feladat van, legördülő listából választhatók: **VLAN-ok két switchen, trunkkel**
(2 switch, 4 PC) és **VTP: server, transparent, client** (3 switch, 4 PC). Minden feladat három módban
játszható: **Oktató** (parancsokkal és lépésről lépésre vezető buborékokkal), **Gyakorló** (csak a cél, tippekkel), **Vizsga** (önellenőrzés, időméréssel,
Beadás gombbal); gyakorló és vizsga módban minden indításkor más adatokkal, megosztható változatlinkkel.
Minden feladat végén magyarázat van. A switchek
IOS-szerű parancssorral kezelhetők (módok, rövidítés, `?` súgó, Tab, előzmények, valódi hibaüzenetek), a PC-k egy
ablakban (IP-beállítás, `ping`, `ipconfig`, `arp -a`). A csomagok mozgása látszik a rajzon, az Ellenőrzés gomb
pedig eredményalapon – valódi ping- és szórásos próbákkal, ellenpróbával – nézi meg a megoldást.
A változások listája: [VALTOZASOK.md](VALTOZASOK.md).

## Jogi megjegyzés

IOS-szerű parancssor: a parancsok és a kimenetek **formáját** utánozza. Gyártói szoftvert, dokumentációszöveget,
ábrát vagy ikont nem tartalmaz; a súgószövegek és a magyarázatok saját megfogalmazások, az eszközrajzok saját
készítésűek. A kimenetek formájának forrásai: [docs/forrasok.md](docs/forrasok.md).
Minden jog fenntartva – Horváth Gábor EV.

## Fejlesztés

A futtatáshoz semmit nem kell telepíteni: az `index.html` közvetlenül (akár fájlként, dupla kattintással is)
megnyitható, mert a kész szimulátor a `dist/` mappában van, a feladatok a `feladatok/` mappában.
Feladat, mód és változat az URL-ben is választható: `index.html?feladat=vtp-1&mod=vizsga&mag=4242`
(mod: oktato, gyakorlo, vizsga; mag: a véletlen változat száma – ugyanaz a mag mindig ugyanazt adja).

Fejlesztéshez (Node.js 20+):

```sh
npm install      # az esbuild telepítése
npm run build    # src/ → dist/szimulator.js, css/ → dist/szimulator.css
npm test         # automatikus tesztek (node --test)
```

## Felépítés

```
src/mag/          gyártófüggetlen motor: szimulált óra, hálózat és kábelek, switch-továbbítás
                  (VLAN, 802.1Q, MAC-tábla, DTP), VTP, végpontok (ARP, IP, ping)
src/modell/       az eszközök állapota adatként (switch.js, pc.js)
src/cli/          parancssor-értelmező, interfésznevek, switch- és PC-munkamenet
src/gyartok/ios/  az IOS-szerű parancssor: módok, parancsok (adatként), hibaüzenetek, kimenetek
src/feladat/      feladat betöltése, eredményalapú ellenőrzés, véletlen adatok, bemutató (vezetett.js)
src/nezet/        terminál, SVG-topológia animációval, PC-ablak, feladatpanel, bemutató-buborék
feladatok/        egy feladat = egy fájl (vlan-1.js, vtp-1.js); az index.html-ben a betöltés sorrendje
                  a választó sorrendje
css/              a szimulátor stílusa (csak .hsz- osztályok)
dist/             a kész, beépíthető fájlok
docs/             forrásjegyzék
tesztek/          automatikus tesztek
```
