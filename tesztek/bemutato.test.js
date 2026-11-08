/**
 * Bemutató (oktató mód): a lépéseket végigjátszva minden lépés teljesül, a végén az
 * ellenőrzés hibátlan – alapadatokkal és véletlen változatokkal is.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { feladatTeszt } from './segito.js';
import { Vezeto, parancsIllik } from '../src/feladat/vezetett.js';
import { ellenoriz } from '../src/feladat/ellenorzo.js';
import { Munkamenet } from '../src/cli/terminal-munkamenet.js';
import { PcMunkamenet } from '../src/cli/pc-munkamenet.js';
import { ios } from '../src/gyartok/ios/index.js';
import { munkamenetKeszit } from '../src/gyartok/index.js';
import { ipBeallit } from '../src/mag/vegpont.js';

test('parancsIllik: rövidítés és do', () => {
  assert.ok(parancsIllik('sh vl br', ['show', 'vlan', 'brief']));
  assert.ok(parancsIllik('do show vlan brief', ['show', 'vlan', 'brief']));
  assert.ok(!parancsIllik('show vlan', ['show', 'vlan', 'brief']));
  assert.ok(!parancsIllik('show vtp status', ['show', 'vlan', 'brief']));
  assert.ok(parancsIllik('ping 10.0.0.1', ['ping']));
});

/** A bemutató végigjátszása: minden lépésnél a „be” parancsok, kattintás, IP, ellenőrzés. */
function vegigjatszik(azon, mag, gyarto = 'cisco') {
  const f = feladatTeszt(azon, mag, gyarto);
  const mmek = new Map();
  const utolso = new Map();
  let valasztott = null;
  let ellenorzesOk = false;
  const munkamenet = (nev) => {
    if (!mmek.has(nev)) {
      const e = f.eszkoz(nev);
      const kez = f.feladat.kezeles && f.feladat.kezeles[nev];
      mmek.set(nev, e.tipus === 'pc'
        ? new PcMunkamenet({ eszkoz: e, halozat: f.halozat })
        : munkamenetKeszit(e, f.halozat.ora, kez ? { mod: 'ssh', honnan: f.eszkoz(kez.honnan), ip: kez.ip } : undefined));
    }
    return mmek.get(nev);
  };
  const v = new Vezeto(f.feladat.bemutato, {
    f,
    valasztott: () => valasztott,
    munkamenet,
    utolsoParancs: (nev) => utolso.get(nev) || '',
    ellenorzesKesz: () => ellenorzesOk,
  });
  const vanRouter = f.elemek.some((x) => x.tipus === 'router');
  v.frissit();
  assert.equal(v.index, 0, 'az elején semmi nem teljesül');
  let lepesSzam = 0;
  while (!v.vege()) {
    const l = v.aktualis();
    const elotte = v.index;
    if (l.be) {
      valasztott = l.eszkoz;
      for (const sor of l.be) {
        const mm = munkamenet(l.eszkoz);
        // „^X” = Ctrl+X (RouterOS: Safe Mode be/ki)
        if (sor === '^X') {
          mm.ctrlX();
          continue;
        }
        const r = mm.bevitel(sor);
        for (const e of r.kimenet) if (e && e.folyamat) e.folyamat(() => {}, () => {});
        utolso.set(l.eszkoz, mm.utolsoKanonikus || sor);
        // A PC IP-címének átírása (a hálózati kezelés lépéseihez) az ipBeallit-tal megy, nem itt.
      }
      // Routereknél a RIP 30 másodperces frissítését, OSPF-nél a 40 másodperces Wait- és Dead-időt is ki kell várni.
      f.lep(!vanRouter ? (gyarto === 'mikrotik' || f.feladat.gyarto === 'mikrotik' ? 20000 : 10000) : azon.startsWith('ospf') ? 60000 : 40000);
    } else if (l.hol === 'eszkoz') {
      valasztott = l.eszkoz;
    } else if (l.hol === 'ellenorzes') {
      let eredmeny = null;
      ellenoriz(f, { kesz: (e) => { eredmeny = e; } });
      f.lep(300000);
      const hibak = (eredmeny || []).map((e, i) => (e && !e.ok ? `${f.feladat.celok[i].szoveg}: ${e.megjegyzes}` : null)).filter(Boolean);
      assert.deepEqual(hibak, [], `${azon} #${mag}: az ellenőrzés hibátlan`);
      ellenorzesOk = true;
    } else {
      // PC-űrlap: az IP-címek a lépés feltételeiből
      const kesz = Array.isArray(l.kesz) ? l.kesz : [l.kesz];
      for (const c of kesz) if (c.tipus === 'pc-ip') ipBeallit(f.eszkoz(c.eszkoz), { ip: c.ip, maszk: c.maszk });
      f.lep(5000);
    }
    v.frissit();
    assert.ok(v.index > elotte, `${azon} #${mag}: a(z) ${elotte + 1}. lépés teljesült („${l.szoveg}”)`);
    // Nincs „ugrás”: egy lépés teljesülése nem viszi át a következő(ke)t is (különben a tanuló nem látná őket).
    assert.equal(v.index, elotte + 1, `${azon} #${mag}: a(z) ${elotte + 1}. lépés után nem ugrott át lépést`);
    lepesSzam++;
  }
  return lepesSzam;
}

for (const azon of ['vlan-1', 'vtp-1', 'rip-1', 'ospf-1', 'ospf-2', 'mgmt-1']) {
  test(`${azon}: a bemutató végigjátszható (alapadatok és véletlen változatok)`, () => {
    for (const mag of [null, 5, 777, 31337]) assert.ok(vegigjatszik(azon, mag) > 10);
  });
}

test('vlan-1 (MikroTik): a bemutató végigjátszható (alapadatok és véletlen változatok)', () => {
  for (const mag of [null, 5, 777, 31337]) assert.ok(vegigjatszik('vlan-1', mag, 'mikrotik') > 10);
});

test('előreszaladás: ha a tanuló már túl van a lépéseken, a bemutató átugorja őket', () => {
  const f = feladatTeszt('vlan-1');
  const mm = new Munkamenet({ szemelyiseg: ios, eszkoz: f.eszkoz('SW1'), ora: f.halozat.ora });
  for (const s of ['en', 'conf t', 'vlan 10', 'name IRODA']) mm.bevitel(s);
  const v = new Vezeto(f.feladat.bemutato, {
    f, valasztott: () => 'SW1', munkamenet: () => mm, utolsoParancs: () => '', ellenorzesKesz: () => false,
  });
  v.frissit();
  assert.equal(v.aktualis().szoveg.startsWith('A második VLAN'), true);
});
