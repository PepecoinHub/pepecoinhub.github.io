import assert from 'node:assert/strict';
import { test } from 'node:test';
import { acceptDuel, ack, getState, openDuel, setTeam, throwMove } from '../src/server/arena.js';
import type { Move } from '../src/shared/rules.js';
import { FakeKV } from './fake-kv.js';

const NOW = Date.parse('2026-10-15T12:00:00Z');
const opts = { dailyLimit: 5, theme: 'classic' as const, sponsorNote: '', featured: [] as string[] };
const state = (kv: FakeKV, uid?: string, now = NOW) => getState(kv, { uid, now, ...opts });

async function player(kv: FakeKV, uid: string, team: string) {
  await setTeam(kv, { uid, team, display: team, now: NOW });
}
const toss = (kv: FakeKV, uid: string | undefined, move: unknown, now = NOW, dailyLimit = 5) => throwMove(kv, { uid, move, now, dailyLimit });

test('refusals: not logged in, no team, bad move', async () => {
  const kv = new FakeKV();
  assert.deepEqual((await toss(kv, undefined, 'r')).response, { ok: false, error: 'login' });
  assert.deepEqual((await toss(kv, 'a', 'r')).response, { ok: false, error: 'noteam' });
  await player(kv, 'a', 'gaming');
  for (const bad of ['x', '', 1, null, undefined, 'rock']) assert.deepEqual((await toss(kv, 'a', bad)).response, { ok: false, error: 'invalid' });
});

test('a lone throw waits; a throw from another team settles it', async () => {
  const kv = new FakeKV();
  await player(kv, 'a', 'gaming');
  await player(kv, 'b', 'memes');
  const first = (await toss(kv, 'a', 'r')).response;
  assert.ok(first.ok && first.status === 'waiting');
  const second = await toss(kv, 'b', 's');
  assert.equal((await state(kv, 'b')).me.news.length, 0, 'the player who triggered the match already saw the result');
  assert.ok(second.response.ok && second.response.status === 'matched');
  if (second.response.ok && second.response.status === 'matched') {
    assert.equal(second.response.result, 'l', 'scissors lose to rock');
    assert.equal(second.response.oppTeam, 'gaming');
    assert.equal(second.response.oppMove, 'r');
  }
  assert.deepEqual(second.notify && { uid: second.notify.uid, result: second.notify.result, oppTeam: second.notify.oppTeam }, { uid: 'a', result: 'w', oppTeam: 'memes' });

  const a = await state(kv, 'a');
  assert.equal(a.me.pending, 0);
  assert.equal(a.me.record.w, 1);
  assert.equal(a.me.recent[0]!.status, 'done');
  assert.equal(a.me.recent[0]!.oppTeam, 'memes');
  assert.equal(a.me.news.length, 1, 'the waiting player sees the news');
  await ack(kv, 'a', NOW + 1000);
  assert.equal((await state(kv, 'a', NOW + 2000)).me.news.length, 0, 'seen once acknowledged');

  assert.deepEqual(a.teams.map((t) => [t.name, t.points, t.w, t.l, t.d, t.players]), [['gaming', 3, 1, 0, 0, 1], ['memes', 0, 0, 1, 0, 1]]);
  assert.deepEqual(a.rivalries.map((r) => [r.a, r.b, r.aw, r.bw, r.d]), [['gaming', 'memes', 1, 0, 0]]);
  assert.equal(a.ticker.length, 1);
});

test('draw gives a point each', async () => {
  const kv = new FakeKV();
  await player(kv, 'a', 'gaming');
  await player(kv, 'b', 'memes');
  await toss(kv, 'a', 'p');
  await toss(kv, 'b', 'p');
  const s = await state(kv);
  assert.deepEqual(s.teams.map((t) => [t.name, t.points, t.d]).sort(), [['gaming', 1, 1], ['memes', 1, 1]]);
});

test('same team never fights itself; oldest waiting throw from another team is taken first', async () => {
  const kv = new FakeKV();
  await player(kv, 'a', 'gaming');
  await player(kv, 'a2', 'gaming');
  await player(kv, 'b', 'memes');
  await player(kv, 'c', 'pepecoin');
  await toss(kv, 'a', 'r', NOW);
  const same = (await toss(kv, 'a2', 'p', NOW + 1)).response;
  assert.ok(same.ok && same.status === 'waiting', 'same team stays in the pool');
  const b = (await toss(kv, 'b', 'p', NOW + 2)).response; // oldest gaming throw is a's rock
  assert.ok(b.ok && b.status === 'matched' && b.oppMove === 'r' && b.result === 'w');
  const c = (await toss(kv, 'c', 's', NOW + 3)).response; // a2's paper is next
  assert.ok(c.ok && c.status === 'matched' && c.oppMove === 'p' && c.result === 'w');
});

test('the daily limit and the pending cap', async () => {
  const kv = new FakeKV();
  await player(kv, 'a', 'gaming');
  for (let i = 0; i < 3; i++) assert.ok((await toss(kv, 'a', 'r', NOW + i)).response.ok);
  assert.deepEqual((await toss(kv, 'a', 'r', NOW + 9)).response, { ok: false, error: 'pending' }, 'three waiting is the cap');
  await player(kv, 'b', 'memes');
  await toss(kv, 'b', 'r', NOW + 10);
  assert.ok((await toss(kv, 'a', 'r', NOW + 11)).response.ok, 'one settled, room again');
  const s = await state(kv, 'a', NOW + 12);
  assert.equal(s.me.throwsLeft, 1);
  const kv2 = new FakeKV();
  await player(kv2, 'x', 'gaming');
  await player(kv2, 'y', 'memes');
  for (let i = 0; i < 2; i++) { await toss(kv2, 'x', 'r', NOW + i, 2); await toss(kv2, 'y', 'r', NOW + i, 2); }
  assert.deepEqual((await toss(kv2, 'x', 'r', NOW + 5, 2)).response, { ok: false, error: 'limit' });
  assert.ok((await toss(kv2, 'x', 'r', NOW + 86_400_000, 2)).response.ok, 'resets the next UTC day');
});

test('the team is locked after the first throw of a season, free again next week', async () => {
  const kv = new FakeKV();
  await player(kv, 'a', 'gaming');
  assert.deepEqual(await setTeam(kv, { uid: 'a', team: 'memes', display: 'memes', now: NOW }), { ok: true }, 'free before the first throw');
  await toss(kv, 'a', 'r');
  assert.deepEqual(await setTeam(kv, { uid: 'a', team: 'memes', display: 'memes', now: NOW }), { ok: true }, 'same team is fine');
  assert.deepEqual(await setTeam(kv, { uid: 'a', team: 'pepecoin', display: 'pepecoin', now: NOW }), { ok: false, error: 'locked' });
  assert.equal((await state(kv, 'a')).me.canChangeTeam, false);
  const nextWeek = NOW + 7 * 86_400_000;
  assert.equal((await state(kv, 'a', nextWeek)).me.canChangeTeam, true);
  assert.deepEqual(await setTeam(kv, { uid: 'a', team: 'pepecoin', display: 'pepecoin', now: nextWeek }), { ok: true });
});

test('seasons keep separate boards', async () => {
  const kv = new FakeKV();
  await player(kv, 'a', 'gaming');
  await player(kv, 'b', 'memes');
  await toss(kv, 'a', 'r');
  await toss(kv, 'b', 's');
  assert.equal((await state(kv, 'a')).teams.length, 2);
  assert.equal((await state(kv, 'a', NOW + 7 * 86_400_000)).teams.length, 0, 'a fresh week starts empty');
});

test('waiting throws are never shown to anyone else', async () => {
  const kv = new FakeKV();
  await player(kv, 'a', 'gaming');
  await player(kv, 'b', 'memes');
  await toss(kv, 'a', 'r');
  const b = JSON.stringify(await state(kv, 'b'));
  assert.ok(!b.includes('"move"'), 'no move of a waiting throw reaches another player');
  const a = (await state(kv, 'a')).me.recent[0]!;
  assert.equal(a.status, 'waiting');
  assert.equal(a.oppMove, undefined);
});

test('many players at once: every throw is settled exactly once or still waiting', async () => {
  for (let round = 0; round < 5; round++) {
    const kv = new FakeKV();
    const teams = ['gaming', 'memes', 'pepecoin'];
    const users = Array.from({ length: 30 }, (_, i) => ({ uid: `u${i}`, team: teams[i % 3]! }));
    for (const u of users) await player(kv, u.uid, u.team);
    const moves: Move[] = ['r', 'p', 's'];
    const out = await Promise.all(users.map((u, i) => toss(kv, u.uid, moves[(i * 7 + round) % 3], NOW + i)));
    assert.ok(out.every((o) => o.response.ok));

    const resolved = new Map<string, string>();
    let matches = 0;
    for (const [key, h] of kv.hashes) {
      if (!key.startsWith('rps:t:') || !h.get('res')) continue;
      resolved.set(key, h.get('res')!);
    }
    matches = resolved.size / 2;
    assert.equal(Number.isInteger(matches), true, 'results come in pairs');
    const waiting = kv.zsetSize('rps:pool');
    assert.equal(resolved.size + waiting, users.length, 'no throw lost or doubled');
    // Every resolved throw has a mirror result.
    const w = [...resolved.values()].filter((r) => r === 'w').length;
    const l = [...resolved.values()].filter((r) => r === 'l').length;
    assert.equal(w, l, 'wins mirror losses');
    // Team points add up: 3 per decided match, 2 per draw.
    const s = await state(kv);
    const total = s.teams.reduce((n, t) => n + t.points, 0);
    const d = [...resolved.values()].filter((r) => r === 'd').length;
    assert.equal(total, w * 3 + d, 'points consistent with results');
    // Nobody is left waiting while a different-team throw also waits (except in the rare simultaneous case).
    const poolTeams = new Set<string>();
    for (const id of kv.zsets.get('rps:pool')?.keys() ?? []) poolTeams.add(kv.hashes.get(`rps:t:${id}`)!.get('team')!);
    assert.ok(poolTeams.size <= 2, 'pool has leftovers from at most a couple of teams');
  }
});

test('duels: open, accept, settle, notify, board', async () => {
  const kv = new FakeKV();
  const o = await openDuel(kv, { uid: 'a', name: 'alice', move: 'r', now: NOW, dailyLimit: 5 });
  assert.ok(o.response.ok);
  const id = o.response.ok ? o.response.id : '';
  const listed = await state(kv, 'b');
  assert.deepEqual(listed.duels.map((d) => [d.name, d.mine]), [['alice', false]]);
  assert.ok(!JSON.stringify(listed).includes('"move":"r"'), 'the challenger move stays hidden');
  assert.deepEqual((await state(kv, 'a')).duels.map((d) => d.mine), [true]);

  assert.deepEqual((await acceptDuel(kv, { uid: 'a', name: 'alice', id, move: 'p', now: NOW, dailyLimit: 5 })).response, { ok: false, error: 'self' });
  const r = await acceptDuel(kv, { uid: 'b', name: 'bob', id, move: 'p', now: NOW + 1, dailyLimit: 5 });
  assert.deepEqual(r.response, { ok: true, result: 'w', oppName: 'alice', oppMove: 'r', throwsLeft: 4 });
  assert.deepEqual(r.notify && { uid: r.notify.uid, result: r.notify.result, duel: r.notify.duel }, { uid: 'a', result: 'l', duel: true });

  const s = await state(kv, 'a', NOW + 2);
  assert.equal(s.duels.length, 0);
  assert.deepEqual(s.duelists.map((d) => [d.name, d.points, d.w, d.l]), [['bob', 3, 1, 0], ['alice', 0, 0, 1]]);
  assert.equal(s.me.recent[0]!.oppName, 'bob');
  assert.equal(s.me.recent[0]!.kind, 'duel');
  assert.equal(s.me.news.length, 1);
  assert.equal(s.teams.length, 0, 'duels do not touch team standings');
  assert.deepEqual((await acceptDuel(kv, { uid: 'c', name: 'carol', id, move: 'r', now: NOW + 3, dailyLimit: 5 })).response, { ok: false, error: 'gone' });
});

test('duel race: two players take the same duel, one wins and the other keeps their shot', async () => {
  const kv = new FakeKV();
  const o = await openDuel(kv, { uid: 'a', name: 'alice', move: 's', now: NOW, dailyLimit: 5 });
  const id = o.response.ok ? o.response.id : '';
  const out = await Promise.all(['b', 'c', 'd', 'e'].map((u) => acceptDuel(kv, { uid: u, name: u, id, move: 'r', now: NOW + 1, dailyLimit: 5 })));
  assert.equal(out.filter((x) => x.response.ok).length, 1);
  assert.equal(out.filter((x) => !x.response.ok && x.response.error === 'gone').length, 3);
  for (const u of ['b', 'c', 'd', 'e']) {
    const left = (await state(kv, u, NOW + 2)).me.throwsLeft;
    const won = out.find((x, i) => x.response.ok && ['b', 'c', 'd', 'e'][i] === u);
    assert.equal(left, won ? 4 : 5, `${u} only pays for a duel they actually played`);
  }
});
