/**
 * A PC parancssora: ping, ipconfig, arp.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vlanFeladat, megold } from './segito.js';
import { PcMunkamenet } from '../src/cli/pc-munkamenet.js';

/** Lefuttat egy PC-parancsot; a fokozatos kimenetet is összegyűjti. */
function pc(f, nev, sor) {
  const mm = new PcMunkamenet({ eszkoz: f.eszkoz(nev), halozat: f.halozat });
  const ki = [];
  let kesz = true;
  for (const e of mm.bevitel(sor).kimenet) {
    if (typeof e === 'string') ki.push(e);
    else if (e.folyamat) {
      kesz = false;
      e.folyamat((s) => ki.push(s), () => (kesz = true));
    }
  }
  f.lep(60000);
  assert.ok(kesz, 'a folyamat befejeződött');
  return ki;
}

test('ping a helyes megoldás után: 4 válasz, statisztika', () => {
  const f = vlanFeladat();
  megold(f, 'SW1');
  megold(f, 'SW2');
  f.ipk();
  const k = pc(f, 'PC1', 'ping 192.168.10.13');
  assert.deepEqual(k.slice(0, 6), [
    '',
    'Pinging 192.168.10.13 with 32 bytes of data:',
    'Reply from 192.168.10.13: bytes=32 time<1ms TTL=128',
    'Reply from 192.168.10.13: bytes=32 time<1ms TTL=128',
    'Reply from 192.168.10.13: bytes=32 time<1ms TTL=128',
    'Reply from 192.168.10.13: bytes=32 time<1ms TTL=128',
  ]);
  assert.ok(k.includes('    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),'));
});

test('ping IP-cím nélkül, másik hálózatba, ARP-válasz nélkül, -n kapcsolóval', () => {
  const f = vlanFeladat();
  let k = pc(f, 'PC1', 'ping -n 2 192.168.10.13');
  assert.equal(k[2], 'PING: transmit failed. General failure. ');
  assert.ok(k.includes('    Packets: Sent = 2, Received = 0, Lost = 2 (100% loss),'));
  assert.ok(k.some((s) => /nincs IP-címe/.test(s)));

  f.ipk();
  k = pc(f, 'PC1', 'ping 192.168.20.14');
  assert.ok(k.some((s) => /nincs alapértelmezett átjáró/.test(s)));

  // PC3 portja lekapcsolva: senki nem válaszol az ARP-kérdésre.
  f.sw('SW2', 'conf t', 'int fa0/1', 'shutdown', 'end');
  k = pc(f, 'PC1', 'ping -n 1 192.168.10.13');
  assert.equal(k[2], 'Reply from 192.168.10.11: Destination host unreachable.');
  assert.ok(k.includes('    Packets: Sent = 1, Received = 1, Lost = 0 (0% loss),'));
});

test('ping hibás címre és paraméter nélkül', () => {
  const f = vlanFeladat();
  assert.deepEqual(pc(f, 'PC1', 'ping abc'), ['Ping request could not find host abc. Please check the name and try again.', '']);
  assert.equal(pc(f, 'PC1', 'ping')[1], 'Usage: ping [-n count] target_name');
  assert.equal(pc(f, 'PC1', 'pong')[0], "'pong' is not recognized as an internal or external command,");
});

test('ipconfig és arp -a', () => {
  const f = vlanFeladat();
  f.ipk();
  const k = pc(f, 'PC1', 'ipconfig');
  assert.ok(k.includes('   IPv4 Address. . . . . . . . . . . : 192.168.10.11'));
  assert.ok(k.includes('   Subnet Mask . . . . . . . . . . . : 255.255.255.0'));
  assert.deepEqual(pc(f, 'PC1', 'arp -a'), ['No ARP Entries Found.', '']);
  pc(f, 'PC1', 'ping -n 1 192.168.10.13');
  const a = pc(f, 'PC1', 'arp -a');
  assert.equal(a[1], 'Interface: 192.168.10.11 --- 0x2');
  assert.match(a[3], /^  192\.168\.10\.13\s+02-[0-9a-f]{2}(-[0-9a-f]{2}){4}\s+dynamic$/);
});
