# Haloszim

Böngészőben futó, feladat-alapú hálózati szimulátor a [routerrantotta.hu](https://routerrantotta.hu)-hoz.

**Kipróbálás:** https://routerrantotta.github.io/haloszim/ (fejlesztői kipróbáló oldal)

Jelenleg (v0.11) hét feladat van, legördülő listából választhatók: **VLAN-ok két switchen, trunkkel**
(2 switch, 4 PC – Cisco vagy MikroTik eszközökkel, a „Gyártó” választóval), **VTP: server, transparent, client**
(3 switch, 4 PC), **Menedzsment-VLAN és Safe Mode (MikroTik)** (a switch hálózaton át, SSH-val kezelve – ki is
lehet zárni magad), és a **Dinamikus routing** csoportban
**RIPv2 és RIPng** (3 router + ISP, 3 PC, IPv4 és IPv6), **OSPF (IPv4, OSPFv2)** és **OSPFv3 (IPv6)**
(a routerrantotta.hu OSPF-leckéinek háromszög-topológiája, ISP-vel, beépített hibakeresési feladattal), valamint
**EIGRP (IPv4 és IPv6)** (3 router soros vonalakkal – egy gyors és egy lassú úttal –, successor és feasible successor,
DUAL, auto-summary és hibatűrés). Minden feladat három módban
játszható: **Oktató** (parancsokkal és lépésről lépésre vezető buborékokkal), **Gyakorló** (csak a cél, tippekkel), **Vizsga** (önellenőrzés, időméréssel,
Beadás gombbal); gyakorló és vizsga módban minden indításkor más adatokkal, megosztható változatlinkkel.
Minden feladat végén magyarázat van. A Cisco switchek (2960 jellegű) és a routerek (ISR 4331 jellegű)
IOS-szerű parancssorral kezelhetők (módok, rövidítés, `?` súgó, Tab, előzmények, valódi hibaüzenetek), a MikroTik
switchek (CRS326 jellegű) RouterOS-szerű parancssorral (menük, `add`/`set`/`print`/`export`, `[find …]`, rövidítés,
`?`/F1 súgó, Tab, Safe Mode Ctrl+X-szel), a PC-k egy
ablakban (IPv4- és IPv6-beállítás, `ping`, `tracert`, `ipconfig`, `arp -a`). A csomagok mozgása látszik a rajzon, az Ellenőrzés gomb
pedig eredményalapon – valódi ping- és szórásos próbákkal, ellenpróbával – nézi meg a megoldást.
A változások listája: [VALTOZASOK.md](VALTOZASOK.md).

## Jogi megjegyzés

IOS-szerű és RouterOS-szerű parancssor: a parancsok és a kimenetek **formáját** utánozza. A gyártók neve csak
szövegként szerepel (logó, ikon nincs). Gyártói szoftvert, dokumentációszöveget,
ábrát vagy ikont nem tartalmaz; a súgószövegek és a magyarázatok saját megfogalmazások, az eszközrajzok saját
készítésűek. A kimenetek formájának forrásai: [docs/forrasok.md](docs/forrasok.md).
Minden jog fenntartva – Horváth Gábor EV.

## Fejlesztés

A futtatáshoz semmit nem kell telepíteni: az `index.html` közvetlenül (akár fájlként, dupla kattintással is)
megnyitható, mert a kész szimulátor a `dist/` mappában van, a feladatok a `feladatok/` mappában.
Feladat, mód és változat az URL-ben is választható: `index.html?feladat=vtp-1&mod=vizsga&mag=4242`
(mod: oktato, gyakorlo, vizsga; mag: a véletlen változat száma – ugyanaz a mag mindig ugyanazt adja;
gyarto: cisco vagy mikrotik, ha a feladatnak van MikroTik-változata, pl. `?feladat=vlan-1&gyarto=mikrotik`).

Fejlesztéshez (Node.js 20+):

```sh
npm install      # az esbuild telepítése
npm run build    # src/ → dist/szimulator.js, css/ → dist/szimulator.css
npm test         # automatikus tesztek (node --test)
```

## Felépítés

```
src/mag/          gyártófüggetlen motor: szimulált óra, hálózat és kábelek, switch-továbbítás
                  (VLAN, 802.1Q, MAC-tábla, DTP), VTP, végpontok (ARP, ND, IPv4, IPv6, ping, tracert),
                  router (router.js: továbbítás, ICMP; utvonal.js: routing tábla; rip.js: RIPv2 és RIPng;
                  ospf.js: OSPFv2 és OSPFv3 – Hello, szomszédság, DR/BDR, LSDB, SPF;
                  eigrp.js: EIGRP IPv4-re és IPv6-ra – Hello, szomszédság, metrika, topológiatábla, DUAL, auto-summary;
                  hid.js: MikroTik-bridge – VLAN-szűrés, PVID, VLAN-tábla, a switch saját címei)
src/modell/       az eszközök állapota adatként (switch.js, mikrotik.js, router.js, pc.js)
src/cli/          parancssor-értelmező, interfésznevek, switch- és PC-munkamenet
src/gyartok/ios/  az IOS-szerű parancssor: módok, parancsok (adatként), hibaüzenetek, kimenetek
src/gyartok/routeros/  a RouterOS-szerű parancssor: menük (adatként), értelmező, kimenetek, munkamenet
                  (Safe Mode, hálózati kezelés); src/gyartok/index.js választ gyártó szerint
src/feladat/      feladat betöltése, eredményalapú ellenőrzés, véletlen adatok, bemutató (vezetett.js)
src/nezet/        terminál, SVG-topológia animációval, PC-ablak, feladatpanel, bemutató-buborék
feladatok/        egy feladat = egy fájl (vlan-1.js, vtp-1.js, mgmt-1.js, rip-1.js, ospf-1.js, ospf-2.js, eigrp-1.js);
                  az index.html-ben a betöltés sorrendje
                  a választó sorrendje
css/              a szimulátor stílusa (csak .hsz- osztályok)
dist/             a kész, beépíthető fájlok
docs/             forrásjegyzék
tesztek/          automatikus tesztek
```

## Beépítés egy weboldalba

A `dist/szimulator.js`, a `dist/szimulator.css` és a `feladatok/*.js` kell hozzá:

```html
<link rel="stylesheet" href="haloszim/szimulator.css">
<div id="haloszim"></div>
<script src="haloszim/szimulator.js"></script>
<script src="haloszim/feladatok/vlan-1.js"></script>
<script src="haloszim/feladatok/vtp-1.js"></script>
<script src="haloszim/feladatok/mgmt-1.js"></script>
<script src="haloszim/feladatok/rip-1.js"></script>
<script src="haloszim/feladatok/ospf-1.js"></script>
<script src="haloszim/feladatok/ospf-2.js"></script>
<script src="haloszim/feladatok/eigrp-1.js"></script>
<script>Haloszim.indit(document.getElementById('haloszim'), { feladat: 'vlan-1', hibajelento: '../otlet.html' });</script>
```

- Az `indit` beállításai: `feladat`, `mod` (`oktato` / `gyakorlo` / `vizsga`), `mag` (változatszám), `gyarto`
  (`cisco` / `mikrotik`), `sebesseg`,
  `hibajelento` (a „Hibás a kimenet? Jelezd!” link célja; alapból a routerrantotta.hu ötletküldője). A címsor
  `?feladat=…&mod=…&mag=…&gyarto=…` paraméterei felülírják ezeket.
- A színeket és betűket az oldal `:root` változóiból veszi (`--yellow`, `--black`, `--font`, `--display` …).
- A stílus védőréteget tartalmaz: a befogadó oldal általános `button`, `form`, `label`, `input`, `h2` szabályai nem
  torzítják el a szimulátort.
- A jelző link: `…/otlet.html?oldal=szimulator/index.html&parancs=<az utolsó parancs>`.

