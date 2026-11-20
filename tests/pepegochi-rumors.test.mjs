import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TRAILS, rumorProgress, createRumorReader } from '../docs/meme/pepegochi-rumors.mjs';

const at = Date.UTC(2026, 10, 18), date = new Date(at).toISOString();
const found = id => ({ id, discovered_at: date });
const state = (...secrets) => ({ signed_in: true, secrets });
const auth = id => ({ discord: true, userId: id });

test('every live secret has exactly one clue, in catalog order, that never names the secret', () => {
  const catalog = JSON.parse(readFileSync(new URL('../docs/meme/passport-catalog.json', import.meta.url), 'utf8'));
  assert.deepEqual(TRAILS.map(([id, title]) => [id, title]), catalog.secrets.filter(x => x.status === 'live').map(x => [x.id, x.title]));
  for (const [, title, clue] of TRAILS) {
    assert.ok(clue.length > 40, title);
    assert.ok(!clue.toLowerCase().includes(title.toLowerCase()), title + ' clue gives its own name away');
  }
  // no trigger is spelled out (owner: gentle, not obvious)
  assert.doesNotMatch(TRAILS.map(t => t[2]).join(' '), /format c|:\)|PEPE_not_PEP|README|23:30|notes\.txt/i);
});

test('the journal counts only genuine-looking saved dates of live secrets', () => {
  const a = TRAILS[0];
  assert.deepEqual(rumorProgress(state(), at), { found: [], foundIds: [], allFoundIds: [], lastFoundAt: null, total: 12 });
  assert.deepEqual(rumorProgress(state({ id: a[0] }, { id: a[0], discovered_at: 'bad' })).found, []);
  assert.deepEqual(rumorProgress(state(found(a[0]), found(a[0]), { id: 'pond_map_1', discovered_at: date })), { found: [a[1]], foundIds: [a[0]], allFoundIds: [a[0], 'pond_map_1'], lastFoundAt: at, total: 12 });
  assert.equal(rumorProgress(state(...TRAILS.map(t => found(t[0])))).foundIds.length, 12);
  assert.equal(rumorProgress({ ...state(), preview: true }), null);
  assert.equal(rumorProgress({ signed_in: false, secrets: [] }), null);
  assert.equal(rumorProgress({ signed_in: true }), null);
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
