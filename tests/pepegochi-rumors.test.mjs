import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TRAILS, rumorProgress, createRumorReader } from '../docs/meme/pepegochi-rumors.mjs';

const at = Date.UTC(2026, 10, 18), date = new Date(at).toISOString();
const found = id => ({ id, discovered_at: date });
const state = (...secrets) => ({ signed_in: true, secrets });
const auth = id => ({ discord: true, userId: id });

test('all and only public live secret trails have two distinct clues', () => {
  const catalog = JSON.parse(readFileSync(new URL('../docs/meme/passport-catalog.json', import.meta.url), 'utf8'));
  assert.deepEqual(TRAILS.map(([id, title]) => [id, title]), catalog.secrets.filter(x => x.status === 'live').map(x => [x.id, x.title]));
  for (const [, , hint, detail] of TRAILS) { assert.ok(hint.length > 20 && detail.length > 20); assert.notEqual(hint, detail); }
});

test('next rumor is stable on the same UTC day and never points to a saved find', () => {
  const p = rumorProgress(state(), at);
  assert.equal(p.total, 12); assert.deepEqual(p.found, []);
  assert.deepEqual(rumorProgress(state(), at + 1000), p);
  assert.notEqual(rumorProgress(state(), at + 86400000).hint, p.hint);
  const trail = TRAILS.find(t => t[2] === p.hint);
  const next = rumorProgress(state(found(trail[0]), { id: 'pond_map_1', discovered_at: date }), at);
  assert.deepEqual(next.found, [trail[1]]); assert.notEqual(next.hint, p.hint);
});

test('only genuine-looking saved dates count and completed journals have no pending hint', () => {
  const a = TRAILS[0];
  assert.deepEqual(rumorProgress(state({ id: a[0] }, { id: a[0], discovered_at: 'bad' }), at).found, []);
  assert.deepEqual(rumorProgress(state(found(a[0]), found(a[0])), at).found, [a[1]]);
  assert.deepEqual(rumorProgress(state(...TRAILS.map(t => found(t[0]))), at), { found: TRAILS.map(t => t[1]), total: 12, hint: null, detail: null });
  assert.equal(rumorProgress({ ...state(), preview: true }, at), null);
  assert.equal(rumorProgress({ signed_in: false, secrets: [] }, at), null);
  assert.equal(rumorProgress({ signed_in: true }, at), null);
});

test('reader makes no background calls, deduplicates clicks, expires cache, invalidates on discovery', async () => {
  let clock = at, calls = 0, resolve;
  const reader = createRumorReader({ session: () => auth('a'), now: () => clock, rpc: (name, args) => {
    assert.equal(name, 'gry_passport_state'); assert.deepEqual(args, {}); calls++;
    return new Promise(r => { resolve = r; });
  }});
  assert.equal(calls, 0);
  const a = reader.read(), b = reader.read(); await Promise.resolve(); assert.equal(calls, 1);
  resolve(state()); assert.deepEqual(await a, await b);
  await reader.read(); assert.equal(calls, 1);
  reader.invalidate(); const c = reader.read(); await Promise.resolve(); resolve(state(found(TRAILS[0][0])));
  assert.deepEqual((await c).progress.found, [TRAILS[0][1]]); assert.equal(calls, 2);
  clock += 15001; const d = reader.read(); await Promise.resolve(); resolve(state()); await d; assert.equal(calls, 3);
});

test('account changes and explicit invalidation discard late responses', async () => {
  let user = 'a'; const resolvers = [];
  const reader = createRumorReader({ session: () => user ? auth(user) : null, rpc: () => new Promise(r => resolvers.push(r)) });
  const a = reader.read(); await Promise.resolve(); user = 'b'; const b = reader.read(); await Promise.resolve();
  resolvers[0](state(found(TRAILS[0][0]))); assert.equal((await a).status, 'stale');
  resolvers[1](state()); assert.deepEqual((await b).progress.found, []);
  reader.invalidate(); const c = reader.read(); await Promise.resolve(); reader.invalidate(); resolvers[2](state()); assert.equal((await c).status, 'stale');
  user = null; assert.equal((await reader.read()).status, 'signed-out'); assert.equal(resolvers.length, 3);
});

test('offline and malformed responses never look like an empty successful journal; retry works', async () => {
  let i = 0;
  const reader = createRumorReader({ session: () => auth('a'), rpc: () => { if (++i === 1) throw Error('offline'); return i === 2 ? {} : state(); } });
  assert.equal((await reader.read()).status, 'unavailable');
  assert.equal((await reader.read()).status, 'unavailable');
  assert.equal((await reader.read()).status, 'ok');
});
