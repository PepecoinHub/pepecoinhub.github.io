// PepeGochi read cache (docs/meme/pepegochi-rpc.mjs): dedupe, short per-account cache, invalidation on writes,
// seeding from write answers and the missing-function gate. The server stays authoritative: writes always go out.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cachedRpc, MISSING_MS } from '../docs/meme/pepegochi-rpc.mjs';

function setup({ who = 'u1', missing = new Set() } = {}) {
  let t = 1_000_000, user = who;
  const calls = [];
  const storage = new Map();
  const ls = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) };
  const win = {};               // a private store (no window.top)
  const rpc = async (fn, args) => {
    calls.push(fn);
    await new Promise(r => setTimeout(r, 5));
    if (missing.has(fn)) { const e = new Error('Could not find the function public.' + fn + ' without parameters in the schema cache'); e.status = 404; e.code = 'PGRST202'; throw e; }
    if (fn === 'gry_pepegochi_action') return { action_result: 'accepted', server_now: 'x', pet: { stage: 'adult', n: calls.length } };
    if (fn === 'gry_pepegochi_trip_start') return { trip: { place: 'pond' } };
    return { fn, user, n: calls.length, pet: { stage: 'adult' } };
  };
  const stats = {};
  const make = () => cachedRpc(rpc, () => user, { win, now: () => t, storage: ls, stats });
  return { make, calls, stats, ls, tick: ms => { t += ms; }, setUser: u => { user = u; } };
}

test('identical reads in flight become one request; answers are copies', async () => {
  const s = setup(), rpc = s.make();
  const [a, b, c] = await Promise.all([rpc('gry_pepegochi_state'), rpc('gry_pepegochi_state'), rpc('gry_pepegochi_state')]);
  assert.equal(s.calls.length, 1);
  assert.deepEqual(a, b); assert.notEqual(a, b, 'each caller gets its own object');
  a.pet.stage = 'egg';
  assert.equal(c.pet.stage, 'adult');
});

test('a fresh read is reused for its TTL, then read again', async () => {
  const s = setup(), rpc = s.make();
  await rpc('gry_pepegochi_state'); s.tick(10_000); await rpc('gry_pepegochi_state');
  assert.equal(s.calls.length, 1);
  s.tick(6_000); await rpc('gry_pepegochi_state');
  assert.equal(s.calls.length, 2);
});

test('the cache never crosses accounts', async () => {
  const s = setup(), rpc = s.make();
  await rpc('gry_pepegochi_state'); s.setUser('u2');
  const v = await rpc('gry_pepegochi_state');
  assert.equal(v.user, 'u2'); assert.equal(s.calls.length, 2);
});

test('a write always goes out, drops the reads and seeds the state with its own full answer', async () => {
  const s = setup(), rpc = s.make();
  await rpc('gry_pepegochi_state'); await rpc('gry_pepegochi_life');
  await rpc('gry_pepegochi_action', { p_action: 'feed' });
  await rpc('gry_pepegochi_action', { p_action: 'feed' });
  assert.equal(s.calls.filter(c => c === 'gry_pepegochi_action').length, 2, 'writes are never deduplicated');
  const st = await rpc('gry_pepegochi_state');
  assert.equal(st.action_result, 'accepted', 'state comes from the write answer');
  assert.equal(s.calls.filter(c => c === 'gry_pepegochi_state').length, 1);
  await rpc('gry_pepegochi_life');
  assert.equal(s.calls.filter(c => c === 'gry_pepegochi_life').length, 2, 'life was dropped by the write');
  await rpc('gry_pepegochi_trip_start', { p_length: 'short' });
  assert.deepEqual(await rpc('gry_pepegochi_life'), { trip: { place: 'pond' } });
});

test('a read that started before a write does not overwrite the newer state', async () => {
  const s = setup(), rpc = s.make();
  const old = rpc('gry_pepegochi_state');
  await rpc('gry_pepegochi_action', { p_action: 'feed' });
  await old;
  assert.equal((await rpc('gry_pepegochi_state')).action_result, 'accepted');
});

test('other functions pass straight through and do not drop the cache', async () => {
  const s = setup(), rpc = s.make();
  await rpc('gry_pepegochi_state'); await rpc('gry_passport_state'); await rpc('gry_passport_state');
  await rpc('gry_pepegochi_state');
  assert.deepEqual(s.calls, ['gry_pepegochi_state', 'gry_passport_state', 'gry_passport_state']);
});

test('missing functions (404 / PGRST202) are gated for hours and the flag survives a reload', async () => {
  const s = setup({ missing: new Set(['gry_pepegochi_life', 'gry_pepegochi_diary_save']) });
  let rpc = s.make();
  await assert.rejects(rpc('gry_pepegochi_life'));
  for (let i = 0; i < 20; i++) await assert.rejects(rpc('gry_pepegochi_life'), e => e.missing === true);
  assert.equal(s.calls.length, 1);
  rpc = s.make();               // a new page in the same browser
  await assert.rejects(rpc('gry_pepegochi_life'));
  assert.equal(s.calls.length, 1);
  s.tick(MISSING_MS + 1);
  await assert.rejects(rpc('gry_pepegochi_life'));
  assert.equal(s.calls.length, 2, 'asked again after the gate expired');
});

test('ordinary errors are not gated', async () => {
  let n = 0;
  const rpc = cachedRpc(async () => { n++; throw new Error('Wait a moment before the next care action'); }, () => 'u', { win: {}, storage: null });
  await assert.rejects(rpc('gry_pepegochi_action', { p_action: 'feed' }));
  await assert.rejects(rpc('gry_pepegochi_action', { p_action: 'feed' }));
  assert.equal(n, 2);
});

test('the store is shared through a same-origin top window (taskbar + room iframe)', async () => {
  const top = { location: { origin: 'https://x' }, Map };
  top.top = top;
  const frame = { top, location: { origin: 'https://x' } };
  let n = 0;
  const raw = async () => { n++; await new Promise(r => setTimeout(r, 5)); return { pet: {} }; };
  const a = cachedRpc(raw, () => 'u', { win: top, storage: null });
  const b = cachedRpc(raw, () => 'u', { win: frame, storage: null });
  await Promise.all([a('gry_pepegochi_state'), b('gry_pepegochi_state')]);
  assert.equal(n, 1);
  assert.ok(top.__pepegochiRpc);
});

test('a shared request that never settles (closed iframe) is abandoned after 15 s', async () => {
  let t = 0;
  const top = { location: { origin: 'https://x' }, Map }; top.top = top;
  const hang = cachedRpc(() => new Promise(() => {}), () => 'u', { win: top, storage: null, now: () => t });
  hang('gry_pepegochi_state');
  let n = 0;
  const ok = cachedRpc(async () => { n++; return { pet: {} }; }, () => 'u', { win: top, storage: null, now: () => t });
  t = 16_000;
  await ok('gry_pepegochi_state');
  assert.equal(n, 1);
});
