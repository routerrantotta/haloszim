/**
 * A MikroTik-bridge a hálózatban: VLAN-szűrés, trunk, a switch saját címe (VLAN-interfész),
 * a hálózati kezelés megszakadása és a Safe Mode visszavonása; a vlan-1 MikroTik-változata.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { feladatTeszt } from './segito.js';
import { egyPing, szorasProba, ipBeallit } from '../src/mag/vegpont.js';
import { ellenoriz } from '../src/feladat/ellenorzo.js';
import { kezelhetoE } from '../src/mag/hid.js';

/** Egy ping eredménye (a hálózat idejét lépteti). */
function ping(f, honnan, ip) {
  let e = null;
  egyPing(f.halozat, f.eszkoz(honnan), ip, (x) => { e = x.fajta; });
  f.lep(10000);
  return e;
}
function szoras(f, honnan) {
  let k = null;
  szorasProba(f.halozat, f.eszkoz(honnan), (x) => { k = x.map((e) => e.hostname).sort(); });
  f.lep(2000);
  return k;
}
/** Az ellenőrzés eredménye: a hibás célok szövege. */
function hibak(f) {
  let r = null;
  ellenoriz(f, { kesz: (e) => { r = e; } });
  f.lep(300000);
  return r.map((e, i) => (e.ok ? null : `${f.feladat.celok[i].szoveg}: ${e.megjegyzes}`)).filter(Boolean);
}

/** A vlan-1 MikroTik-megoldása egy switchen. */
function megoldMt(f, nev) {
  f.sw(nev,
    '/interface bridge vlan add bridge=bridge vlan-ids=10 tagged=ether24 comment=IRODA',
    '/interface bridge vlan add bridge=bridge vlan-ids=20 tagged=ether24 comment=RAKTAR',
    '/interface bridge port set [find interface=ether1] pvid=10 frame-types=admit-only-untagged-and-priority-tagged',
    '/interface bridge port set [find interface=ether2] pvid=20 frame-types=admit-only-untagged-and-priority-tagged',
    '/interface bridge set bridge vlan-filtering=yes');
}

test('vlan-1 MikroTik: gyárilag minden gép egy szórási tartományban van', () => {
  const f = feladatTeszt('vlan-1', null, 'mikrotik');
  f.ipk();
  f.lep();
  assert.deepEqual(szoras(f, 'PC1'), ['PC2', 'PC3', 'PC4', 'SW1', 'SW2'].filter((n) => !n.startsWith('SW')).concat(['SW1', 'SW2']).sort());
});

test('vlan-1 MikroTik: a helyes megoldás minden célt teljesít', () => {
  const f = feladatTeszt('vlan-1', null, 'mikrotik');
  f.ipk();
  f.lep();
  megoldMt(f, 'SW1');
  megoldMt(f, 'SW2');
  assert.equal(ping(f, 'PC1', '192.168.10.13'), 'valasz');
  assert.equal(ping(f, 'PC1', '192.168.20.12'), 'hiba');
  assert.deepEqual(szoras(f, 'PC1'), ['PC3']);
  assert.deepEqual(hibak(f), []);
});

test('vlan-1 MikroTik: VLAN-szűrés nélkül az ellenőrzés jelzi a hiányt (a szórás átjut)', () => {
  const f = feladatTeszt('vlan-1', null, 'mikrotik');
  f.ipk();
  f.lep();
  for (const n of ['SW1', 'SW2']) {
    megoldMt(f, n);
    f.sw(n, '/interface bridge set bridge vlan-filtering=no');
  }
  const h = hibak(f);
  assert.ok(h.some((x) => x.includes('VLAN-szűrés')), h.join('\n'));
  assert.ok(h.some((x) => x.startsWith('Ellenpróba: PC1 szórása')), h.join('\n'));
});

test('vlan-1 MikroTik: ha a trunk egyik VLAN-ból kimarad, az a VLAN nem jut át', () => {
  const f = feladatTeszt('vlan-1', null, 'mikrotik');
  f.ipk();
  f.lep();
  megoldMt(f, 'SW1');
  megoldMt(f, 'SW2');
  f.sw('SW2', '/interface bridge vlan set [find vlan-ids=20] tagged=""');
  assert.equal(ping(f, 'PC1', '192.168.10.13'), 'valasz');
  assert.notEqual(ping(f, 'PC2', '192.168.20.14'), 'valasz');
  assert.ok(hibak(f).some((x) => x.includes('nem címkézett tagja ennek: 20')));
});

test('a switch saját címe VLAN-interfészen: csak tagged=bridge mellett érhető el', () => {
  const f = feladatTeszt('mgmt-1');
  f.sw('SW1',
    '/interface vlan add name=MGMT vlan-id=99 interface=bridge',
    '/ip address add address=192.168.99.2/24 interface=MGMT',
    '/interface bridge port set ether1 pvid=99',
    '/interface bridge set bridge vlan-filtering=yes');
  ipBeallit(f.eszkoz('ADMIN'), { ip: '192.168.99.10', maszk: '255.255.255.0' });
  assert.equal(ping(f, 'ADMIN', '192.168.99.2'), 'elerhetetlen');
  assert.equal(kezelhetoE(f.halozat, f.eszkoz('ADMIN'), f.eszkoz('SW1'), '192.168.99.2'), false);
  // Az SSH-kapcsolat (192.168.88.1 felé) közben megszakadt: a javítás a konzolról megy.
  assert.equal(f.mm('SW1').allapot, 'megszakadt');
  f.sw('SW1', 'konzol', '/interface bridge vlan add bridge=bridge vlan-ids=99 tagged=bridge');
  assert.equal(ping(f, 'ADMIN', '192.168.99.2'), 'valasz');
  assert.equal(kezelhetoE(f.halozat, f.eszkoz('ADMIN'), f.eszkoz('SW1'), '192.168.99.2'), true);
});

test('hálózati kezelés: kizárás Safe Mode nélkül → csak a konzol segít', () => {
  const f = feladatTeszt('mgmt-1');
  const mm = f.mm('SW1');
  assert.match(mm.fejlec(), /SSH \(ADMIN → 192\.168\.88\.1\)/);
  f.sw('SW1', '/interface bridge port set ether1 pvid=99', '/interface bridge set bridge vlan-filtering=yes');
  f.lep(5000);
  assert.equal(mm.allapot, 'megszakadt');
  assert.equal(mm.prompt(), 'C:\\>');
  f.lep(30000);
  assert.equal(f.eszkoz('SW1').hidak[0].vlanSzures, true, 'Safe Mode nélkül nincs visszavonás');
  assert.deepEqual(f.sw('SW1', 'ssh admin@192.168.88.1'), ['ssh: connect to host 192.168.88.1 port 22: Connection timed out']);
  f.sw('SW1', 'konzol');
  assert.equal(mm.allapot, 'el');
  assert.match(mm.fejlec(), /konzol/);
});

test('Safe Mode: megszakadáskor a switch visszavonja a változtatásokat, utána újra be lehet lépni', () => {
  const f = feladatTeszt('mgmt-1');
  const mm = f.mm('SW1');
  mm.ctrlX();
  f.sw('SW1', '/interface vlan add name=MGMT vlan-id=99 interface=bridge', '/interface bridge port set ether1 pvid=99',
    '/interface bridge set bridge vlan-filtering=yes');
  f.lep(5000);
  assert.equal(mm.allapot, 'megszakadt');
  assert.equal(mm.safeMode, false);
  f.lep(15000);
  const sw = f.eszkoz('SW1');
  assert.equal(sw.hidak[0].vlanSzures, false);
  assert.equal(sw.hidPortok[0].pvid, 1);
  assert.equal(sw.vlanIfek.length, 0);
  f.sw('SW1', 'ssh admin@192.168.88.1');
  assert.equal(mm.allapot, 'el');
  assert.equal(mm.ujraBelepesek, 1);
});

test('Safe Mode elengedése után a változtatások maradnak (a megszakadás sem vonja vissza)', () => {
  const f = feladatTeszt('mgmt-1');
  const mm = f.mm('SW1');
  mm.ctrlX();
  f.sw('SW1', '/interface bridge port set ether2 pvid=10');
  mm.ctrlX();
  f.sw('SW1', '/interface bridge port set ether1 pvid=99', '/interface bridge set bridge vlan-filtering=yes');
  f.lep(30000);
  assert.equal(mm.allapot, 'megszakadt');
  assert.equal(f.eszkoz('SW1').hidPortok[1].pvid, 10);
  assert.equal(f.eszkoz('SW1').hidak[0].vlanSzures, true);
});

test('mgmt-1: a helyes végállapot minden célt teljesít; a régi címen maradva az ellenőrzés hibát jelez', () => {
  const f = feladatTeszt('mgmt-1');
  assert.ok(hibak(f).length > 5);
  f.sw('SW1',
    '/interface vlan add name=MGMT vlan-id=99 interface=bridge',
    '/ip address add address=192.168.99.2/24 interface=MGMT',
    '/interface bridge vlan add bridge=bridge vlan-ids=99 tagged=bridge comment=MGMT',
    '/interface bridge vlan add bridge=bridge vlan-ids=10 comment=IRODA',
    '/interface bridge vlan add bridge=bridge vlan-ids=20 comment=VENDEG',
    '/interface bridge port set [find interface=ether1] pvid=99 frame-types=admit-only-untagged-and-priority-tagged',
    '/interface bridge port set [find interface=ether2] pvid=10 frame-types=admit-only-untagged-and-priority-tagged',
    '/interface bridge port set [find interface=ether9] pvid=20 frame-types=admit-only-untagged-and-priority-tagged',
    '/interface bridge set bridge vlan-filtering=yes');
  ipBeallit(f.eszkoz('ADMIN'), { ip: '192.168.99.10', maszk: '255.255.255.0' });
  assert.deepEqual(hibak(f), []);
});

test('a switch pingje: a cél hálózatában lévő saját címéről, RouterOS-formában', () => {
  const f = feladatTeszt('mgmt-1');
  const r = f.mm('SW1').bevitel('/ping 192.168.88.10 count=2');
  const sorok = [];
  let kesz = false;
  r.kimenet[0].folyamat((s) => sorok.push(s), () => { kesz = true; });
  f.lep(20000);
  assert.ok(kesz);
  assert.equal(sorok[0], '  SEQ HOST                                     SIZE TTL TIME       STATUS');
  assert.match(sorok[1], /^ {4}0 192\.168\.88\.10\s+56 128 \d+ms$/);
  assert.match(sorok[3], /^ {4}sent=2 received=2 packet-loss=0%/);
});
