# Haloszim

Böngészőben futó, feladat-alapú hálózati szimulátor a [routerrantotta.hu](https://routerrantotta.hu)-hoz.

**Kipróbálás:** https://routerrantotta.github.io/haloszim/ (fejlesztői kipróbáló oldal)

Jelenleg (v0.1) a váz van kész: egy 2960 jellegű switch, IOS-szerű parancssorral – módok, rövidítés,
`?` súgó, Tab-kiegészítés, előzmények, a valódi eszközre jellemző hibaüzenetek, és néhány parancs
(`hostname`, `vlan` / `name`, `interface` / `interface range`, `shutdown`, `show vlan brief`,
`show running-config`). A változások listája: [VALTOZASOK.md](VALTOZASOK.md).

## Jogi megjegyzés

IOS-szerű parancssor: a parancsok és a kimenetek **formáját** utánozza. Gyártói szoftvert, dokumentációszöveget,
ábrát vagy ikont nem tartalmaz; a súgószövegek és a magyarázatok saját megfogalmazások, az eszközrajzok saját
készítésűek. A kimenetek formájának forrásai: [docs/forrasok.md](docs/forrasok.md).
Minden jog fenntartva – Horváth Gábor EV.

## Fejlesztés

A futtatáshoz semmit nem kell telepíteni: az `index.html` közvetlenül (akár fájlként is) megnyitható,
mert a kész szimulátor a `dist/` mappában van.

Fejlesztéshez (Node.js 20+):

```sh
npm install      # az esbuild telepítése
npm run build    # src/ → dist/szimulator.js, css/ → dist/szimulator.css
npm test         # automatikus tesztek (node --test)
```

## Felépítés

```
src/mag/          gyártófüggetlen motor (szimulált óra, később Ethernet, ARP, IP …)
src/modell/       az eszközök állapota adatként (switch.js)
src/cli/          gyártófüggetlen parancssor-értelmező, interfésznevek, munkamenet
src/gyartok/ios/  az IOS-szerű parancssor: módok, parancsok (adatként), hibaüzenetek, kimenetek
src/nezet/        terminál és SVG-topológia
css/              a szimulátor stílusa (csak .hsz- osztályok)
dist/             a kész, beépíthető fájlok
docs/             forrásjegyzék
tesztek/          automatikus tesztek
```
