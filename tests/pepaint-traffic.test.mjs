import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDrawPump } from '../docs/games/js/pepaint-traffic.mjs';

test('drawing batches respect the server interval and never overlap', async () => {
  let now = 0, pending = ['first', 'second'], sent = [], finish;
  const pump = makeDrawPump({
    now: () => now, take: () => pending.shift(),
    send: p => { sent.push(p); return new Promise(r => { finish = r; }); },
    restore: p => pending.unshift(p),
  });
  const first = pump.tick();
  await pump.tick();
  assert.deepEqual(sent, ['first']);
  finish({ ok: false, retry_ms: 1200 }); await first;
  assert.deepEqual(pending, ['first','second']);
  now = 1199; await pump.tick(); assert.equal(sent.length, 1);
  now = 1200;
  const retry = pump.tick(); finish({ ok: true, interval_ms: 500 }); await retry;
  now = 1699; await pump.tick(); assert.equal(sent.length, 2);
  now = 1700;
  const second = pump.tick(); finish({ ok: true }); await second;
  assert.deepEqual(sent, ['first','first','second']);
});

test('unknown transport result requests canvas resync; a previous turn cannot restore packets', async () => {
  let reject, now = 0, restores = [], packets = ['old', 'new'];
  const pump = makeDrawPump({
    now: () => now, take: () => packets.shift(),
    send: () => new Promise((_r, j) => { reject = j; }),
    restore: (...args) => restores.push(args),
  });
  const old = pump.tick(); const rejectOld = reject;
  pump.reset();
  const current = pump.tick();
  rejectOld(new Error('late reply')); await old;
  assert.deepEqual(restores, []);
  reject(new Error('network')); await current;
  assert.deepEqual(restores, [['new', true]]);
});

test('a closed turn stops sending until reset', async () => {
  let sent = 0, closed = 0;
  const pump = makeDrawPump({ take: () => 'packet', send: async () => ({ ok: false, closed: ++sent > 0 }),
    restore: () => assert.fail('closed packets must not be retried'), closed: () => closed++ });
  await pump.tick(); await pump.tick(); assert.equal(sent, 1); assert.equal(closed, 1);
  pump.reset(); await pump.tick(); assert.equal(sent, 2);
});
