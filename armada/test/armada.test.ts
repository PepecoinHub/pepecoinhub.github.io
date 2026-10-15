import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ensureGame, fire, getState } from '../src/server/armada.js';
import type { GameState } from '../src/shared/api.js';
import { placeFleet, configFor } from '../src/shared/game.js';
import { FakeKV } from './fake-kv.js';

const SEED = 7;
const SUBS = 300; // 8x8 board, 60 s per shot
const POST = 't3_test';
const opts = { theme: 'classic' as const, sponsorNote: '', subreddit: 'test' };

async function setup() {
  const kv = new FakeKV();
  await ensureGame(kv, POST, { subscribers: SUBS, seed: SEED });
  const ships = placeFleet(configFor(SUBS), SEED);
  const shipCells = new Set(ships.flatMap((s) => s.cells));
  const water = Array.from({ length: 64 }, (_, i) => i).filter((c) => !shipCells.has(c));
  return { kv, ships, shipCells, water };
}
const shoot = (kv: FakeKV, uid: string | undefined, cell: number, now = 1_000_000) =>
  fire(kv, { postId: POST, uid, name: uid ? `user_${uid}` : undefined, cell, now });

test('ensureGame keeps the first fleet', async () => {
  const { kv, ships } = await setup();
  await ensureGame(kv, POST, { subscribers: SUBS, seed: 999 });
  const s = (await getState(kv, POST, { ...opts, now: 0 }))!;
  assert.equal(s.remaining.length, ships.length);
  const again = await ensureGame(kv, POST, { subscribers: SUBS, seed: 12345 });
  assert.deepEqual(again.ships, ships);
});

test('logged-out and invalid shots are refused', async () => {
  const { kv } = await setup();
  assert.deepEqual((await shoot(kv, undefined, 3)).response, { ok: false, error: 'login' });
  assert.equal((await shoot(kv, 'a', -1)).response.ok, false);
  assert.equal((await shoot(kv, 'a', 64)).response.ok, false);
  assert.equal((await shoot(kv, 'a', 1.5)).response.ok, false);
  assert.equal((await shoot(kv, 'a', Number.NaN)).response.ok, false);
});

test('a miss and a hit score correctly, taken cells cost nothing', async () => {
  const { kv, shipCells, water } = await setup();
  const hitCell = [...shipCells][0]!;
  const miss = (await shoot(kv, 'a', water[0]!)).response;
  assert.ok(miss.ok && miss.result === 'm' && miss.points === 0 && miss.charges === 2);
  const hit = (await shoot(kv, 'a', hitCell)).response;
  assert.ok(hit.ok && hit.result === 'h' && hit.points === 1 && hit.charges === 1);
  const dup = (await shoot(kv, 'b', hitCell)).response;
  assert.deepEqual(dup, { ok: false, error: 'taken', existing: 'h' });
  const b = (await getState(kv, POST, { ...opts, uid: 'b', now: 1_000_000 }))!;
  assert.equal(b.me.charges, 3, 'rejected tap did not spend a shot');
  const a = (await getState(kv, POST, { ...opts, uid: 'a', now: 1_000_000 }))!;
  assert.equal(a.me.score, 1);
  assert.equal(a.me.shots, 2);
  assert.equal(a.totalShots, 2);
  assert.equal(a.players, 1);
});

test('three banked shots, then cooldown, then one shot returns', async () => {
  const { kv, water } = await setup();
  for (let i = 0; i < 3; i++) assert.ok((await shoot(kv, 'a', water[i]!)).response.ok);
  const blocked = (await shoot(kv, 'a', water[3]!)).response;
  assert.ok(!blocked.ok && blocked.error === 'cooldown' && blocked.nextAt === 1_060_000);
  assert.ok(!(await shoot(kv, 'a', water[3]!, 1_059_000)).response.ok);
  assert.ok((await shoot(kv, 'a', water[3]!, 1_060_000)).response.ok);
  assert.ok(!(await shoot(kv, 'a', water[4]!, 1_060_001)).response.ok);
});

test('same cell fired by many players at once: exactly one wins', async () => {
  const { kv, water } = await setup();
  const users = Array.from({ length: 20 }, (_, i) => `u${i}`);
  const out = await Promise.all(users.map((u) => shoot(kv, u, water[0]!)));
  assert.equal(out.filter((o) => o.response.ok).length, 1);
  assert.equal(out.filter((o) => !o.response.ok && (o.response as { error: string }).error === 'taken').length, 19);
  const s = (await getState(kv, POST, { ...opts, now: 1_000_000 }))!;
  assert.equal(s.totalShots, 1);
});

test('double tap by one player does not double spend', async () => {
  const { kv, water } = await setup();
  const out = await Promise.all([shoot(kv, 'a', water[0]!), shoot(kv, 'a', water[1]!)]);
  assert.equal(out.filter((o) => o.response.ok).length, 1, 'second request hit the per-player lock');
  const s = (await getState(kv, POST, { ...opts, uid: 'a', now: 1_000_000 }))!;
  assert.equal(s.me.charges, 2);
});

test('the sinking is credited once, with bonus', async () => {
  const { kv, ships } = await setup();
  const ship = ships[ships.length - 1]!; // shortest
  const users = ship.cells.map((_, i) => `p${i}`);
  const out = await Promise.all(ship.cells.map((c, i) => shoot(kv, users[i], c)));
  const sunk = out.filter((o) => o.response.ok && o.response.sunk);
  assert.equal(sunk.length, 1, 'only one request claims the sinking');
  const claimer = sunk[0]!.response;
  assert.ok(claimer.ok && claimer.points === 1 + 2);
  const s = (await getState(kv, POST, { ...opts, now: 1_000_000 }))!;
  assert.equal(s.sunk.length, 1);
  assert.equal(s.sunk[0]!.len, ship.len);
  assert.equal(s.remaining.length, ships.length - 1);
});

test('whole fleet by a crowd: one winner, final state is consistent', async () => {
  const { kv, ships, shipCells, water } = await setup();
  const targets = [...shipCells, ...water.slice(0, 10)];
  const out = await Promise.all(targets.map((c, i) => shoot(kv, `u${i}`, c)));
  const wins = out.filter((o) => o.finish);
  assert.equal(wins.length, 1);
  const s = (await getState(kv, POST, { ...opts, now: 1_000_000 })) as GameState;
  assert.ok(s.finish);
  assert.equal(s.remaining.length, 0);
  assert.equal(s.sunk.length, ships.length);
  assert.equal(s.finish!.finisher, wins[0]!.finish!.finisher);
  const total = [...(kv.zsets.get(`a:${POST}:lb`) ?? new Map<string, number>()).values()].reduce((n, v) => n + v, 0);
  assert.equal(total, shipCells.size + ships.length * 2 + 3, 'hits + sink bonuses + one finish bonus, all players');
  assert.ok(kv.expired.length > 0, 'keys get a TTL after the game');
  assert.deepEqual((await shoot(kv, 'late', water[20]!)).response, { ok: false, error: 'finished' });
});

test('the client never learns where unsunk ships are', async () => {
  const { kv, shipCells, water } = await setup();
  await shoot(kv, 'a', water[0]!);
  await shoot(kv, 'a', [...shipCells][0]!);
  const raw = JSON.stringify(await getState(kv, POST, { ...opts, now: 1_000_000 }));
  const state = JSON.parse(raw) as GameState;
  assert.equal(Object.keys(state.shots).length, 2, 'only fired cells are present');
  assert.equal(state.sunk.length, 0);
  assert.ok(!('ships' in state) && !('fleet' in state));
});
