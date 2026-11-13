// Pepe Gold Hook: game logic, round layout, frame-rate independence, the score check and its
// SQL twin (games/supabase/update_gold_hook.sql), and the high score client on a fake server.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HOOK, LAYOUT, OBJECT_TYPES, ROUNDS, GAME_ID } from '../docs/games/js/gold-hook-config.mjs';
import {
  APP, HOOK_MODE, createGame, startRound, update, fire, pause, resume, toTitle,
  hookGeometry, currentAnim, drainEvents,
} from '../docs/games/js/gold-hook-state.mjs';
import { validateRun, layoutTable } from '../docs/games/js/gold-hook-validation.mjs';
import { createScores, buildSubmission, readSession, isNotDeployed } from '../docs/games/js/gold-hook-scores.mjs';

const round = ROUNDS[0];
const W = LAYOUT.winch;
const angleTo = (o) => Math.atan2(o.x - W.x, o.y - W.y) * 180 / Math.PI;
const run = (g, sec, dt = 1 / 60) => { for (let t = 0; t < sec - 1e-9; t += dt) update(g, dt); };
// Sets the hook angle directly (no waiting for the swing) and fires.
function shootAt(g, angle) { g.hook.angle = angle; assert.ok(fire(g), 'fire() works in READY'); g.hook.angle = angle; }
function stepUntil(g, pred, dt = 1 / 60, maxSec = 30) {
  for (let t = 0; t < maxSec; t += dt) { if (pred(g)) return t; update(g, dt); }
  throw new Error('stepUntil: timed out');
}
const HALF = { 'nugget-small': 12, 'nugget-medium': 16, 'nugget-large': 24, 'coin-pep': 12, rock: 16, crate: 20 };

// ---------- round 1 layout ----------
test('round 1: 910 points in total, goal 650, 3/2/1/2/2/1 objects', () => {
  assert.equal(round.objects.reduce((s, o) => s + OBJECT_TYPES[o.type].points, 0), 910);
  assert.equal(round.target, 650);
  const count = (t) => round.objects.filter((o) => o.type === t).length;
  assert.deepEqual(['nugget-small', 'nugget-medium', 'nugget-large', 'coin-pep', 'rock', 'crate'].map(count), [3, 2, 1, 2, 2, 1]);
});

test('objects never overlap (4 px margin)', () => {
  const objs = round.objects.map((o) => ({ ...o, r: OBJECT_TYPES[o.type].radius }));
  for (let i = 0; i < objs.length; i++) for (let j = i + 1; j < objs.length; j++) {
    const a = objs[i], b = objs[j];
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > a.r + b.r + 4, `${a.type}@${a.x},${a.y} vs ${b.type}@${b.x},${b.y}`);
  }
});

test('whole sprites sit inside the mine, clear of the surface and the resting hook', () => {
  const m = LAYOUT.mine, restCargoY = W.y + HOOK.restLength + HOOK.cargoOffset;
  for (const o of round.objects) {
    const h = HALF[o.type], r = OBJECT_TYPES[o.type].radius;
    assert.ok(o.x - h >= m.x0 && o.x + h <= m.x1 && o.y - h >= m.y0 && o.y + h <= m.y1, o.type);
    assert.ok(o.y - r > restCargoY + HOOK.grabRadius + 4, `${o.type} too close to the resting hook`);
  }
});

test('every object is within reach (≤65°, ≤ max rope)', () => {
  for (const o of round.objects) {
    assert.ok(Math.abs(angleTo(o)) <= HOOK.maxAngleDeg, o.type);
    assert.ok(Math.hypot(o.x - W.x, o.y - W.y) - HOOK.cargoOffset <= HOOK.maxLength, o.type);
  }
});

test('every object can be the first catch on a full board', () => {
  round.objects.forEach((o, i) => {
    const g = createGame(); startRound(g);
    shootAt(g, angleTo(o));
    stepUntil(g, (x) => x.hook.mode !== HOOK_MODE.EXTENDING);
    assert.equal(g.hook.mode, HOOK_MODE.RETURNING_LOADED, `object ${i} not caught`);
    assert.equal(g.hook.cargo.id, i, `object ${i}: caught ${g.hook.cargo.id} instead`);
  });
});

// ---------- hook and scoring ----------
test('points arrive only on delivery, and each object is caught once', () => {
  const g = createGame(); startRound(g);
  const large = g.objects.find((o) => o.type === 'nugget-large');
  shootAt(g, angleTo(large));
  stepUntil(g, (x) => x.hook.mode === HOOK_MODE.RETURNING_LOADED);
  assert.equal(g.score, 0);
  assert.ok(large.caught);
  stepUntil(g, (x) => x.hook.mode === HOOK_MODE.READY);
  assert.equal(g.score, 250);
  assert.equal(drainEvents(g).filter((e) => e.type === 'score').length, 1);
  shootAt(g, angleTo(large));
  stepUntil(g, (x) => x.hook.mode !== HOOK_MODE.EXTENDING);
  assert.ok(!g.hook.cargo || g.hook.cargo.id !== large.id);
});

test('fire() only works in PLAYING + READY', () => {
  const g = createGame();
  assert.equal(fire(g), false);
  startRound(g);
  assert.equal(fire(g), true);
  assert.equal(fire(g), false);
  pause(g);
  assert.equal(fire(g), false);
});

test('the angle stays fixed while the hook is out', () => {
  const g = createGame(); startRound(g);
  run(g, 0.7);
  const a = g.hook.angle;
  fire(g); run(g, 0.3);
  assert.equal(g.hook.angle, a);
});

test('heavier loot comes up slower: large > medium > small, rock slowest', () => {
  const perPx = (type) => {
    const g = createGame(); startRound(g);
    shootAt(g, angleTo(g.objects.find((x) => x.type === type)));
    stepUntil(g, (x) => x.hook.mode === HOOK_MODE.RETURNING_LOADED);
    const len = g.hook.length - HOOK.restLength;
    return stepUntil(g, (x) => x.hook.mode === HOOK_MODE.READY, 1 / 240) / len;
  };
  const small = perPx('nugget-small'), medium = perPx('nugget-medium'), large = perPx('nugget-large'), rock = perPx('rock');
  assert.ok(large > medium && medium > small && rock > large);
  assert.ok(Math.abs(small - 1 / HOOK.returnLoadedSpeed) < 0.0003);
});

test('an empty hook comes back from the edge with the fail pose; pull only with cargo', () => {
  const g = createGame(); startRound(g);
  shootAt(g, -65);
  stepUntil(g, (x) => x.hook.mode !== HOOK_MODE.EXTENDING);
  assert.equal(g.hook.mode, HOOK_MODE.RETURNING_EMPTY);
  assert.equal(currentAnim(g).name, 'idle');
  stepUntil(g, (x) => x.hook.mode === HOOK_MODE.READY);
  assert.equal(currentAnim(g).name, 'fail');
  const g2 = createGame(); startRound(g2);
  shootAt(g2, 0);
  stepUntil(g2, (x) => x.hook.mode === HOOK_MODE.RETURNING_LOADED);
  update(g2, 1 / 60);
  assert.equal(currentAnim(g2).name, 'pull');
  stepUntil(g2, (x) => x.hook.mode === HOOK_MODE.READY);
  assert.equal(currentAnim(g2).name, 'success');
});

test('the hook turns back at the mine floor', () => {
  const g = createGame(); startRound(g);
  g.objects.find((o) => o.type === 'nugget-large').caught = true;
  shootAt(g, 0);
  stepUntil(g, (x) => x.hook.mode !== HOOK_MODE.EXTENDING);
  assert.equal(g.hook.mode, HOOK_MODE.RETURNING_EMPTY);
  assert.ok(hookGeometry(g.hook).cy <= LAYOUT.mine.y1 + HOOK.extendSpeed / 120 + 1e-6);
});

// ---------- time, pause, end of round ----------
test('the clock stops while paused and goes on after resume', () => {
  const g = createGame(); startRound(g);
  run(g, 5);
  const t = g.timeLeft, hook = JSON.stringify(g.hook);
  pause(g); run(g, 10);
  assert.equal(g.timeLeft, t);
  assert.equal(JSON.stringify(g.hook), hook);
  resume(g); run(g, 1);
  assert.ok(Math.abs(g.timeLeft - (t - 1)) < 1e-6);
});

test('a big time jump (coming back to the tab) is capped', () => {
  const g = createGame(); startRound(g);
  update(g, 30);
  assert.ok(g.timeLeft > 59.9);
});

test('at 0 s the round ends; loot still on the rope scores nothing', () => {
  const g = createGame(); startRound(g);
  g.timeLeft = 0.5;
  shootAt(g, 0);
  run(g, 2);
  assert.equal(g.app, APP.RESULT);
  assert.equal(g.score, 0);
  assert.equal(g.result.won, false);
  const frozen = JSON.stringify(g.hook);
  run(g, 2);
  assert.equal(JSON.stringify(g.hook), frozen);
});

test('a win needs score >= goal; restart resets everything', () => {
  const g = createGame(); startRound(g);
  g.score = g.target; g.timeLeft = 0.01; run(g, 0.1);
  assert.equal(g.result.won, true);
  startRound(g);
  assert.equal(g.score, 0);
  assert.equal(g.timeLeft, 60);
  assert.ok(g.objects.every((o) => !o.caught));
  assert.equal(g.hook.mode, HOOK_MODE.READY);
  assert.equal(g.reaction, null);
  toTitle(g);
  assert.equal(g.app, APP.TITLE);
});

// ---------- frame-rate independence ----------
// A bot that waits for the swing like a player would.
function bot(dt) {
  const g = createGame(); startRound(g);
  const order = ['nugget-large', 'nugget-medium', 'nugget-medium', 'coin-pep', 'coin-pep', 'nugget-small', 'nugget-small', 'nugget-small', 'crate'];
  const used = new Set();
  const queue = order.map((t) => { const o = g.objects.find((x) => x.type === t && !used.has(x.id)); used.add(o.id); return o; });
  let target = queue.shift(), reachedAt = null;
  for (let i = 0; i < Math.round(60 / dt) + 5 && g.app === APP.PLAYING; i++) {
    const prev = g.hook.angle;
    update(g, dt);
    if (reachedAt === null && g.score >= g.target) reachedAt = 60 - g.timeLeft;
    if (target && g.hook.mode === HOOK_MODE.READY) {
      if (target.caught) { target = queue.shift(); continue; }
      const a = angleTo(target);
      if (i > 0 && (prev - a) * (g.hook.angle - a) <= 0) fire(g);
    }
  }
  return { score: g.score, reachedAt, result: g.result };
}

test('the goal is reachable in time at 30, 60 and 120 FPS', () => {
  for (const fps of [30, 60, 120]) {
    const r = bot(1 / fps);
    assert.ok(r.score >= round.target, `${fps} FPS: ${r.score}`);
    assert.ok(r.reachedAt !== null && r.reachedAt < 58, `${fps} FPS: goal at ${r.reachedAt}s`);
  }
});

test('the same shot takes the same time at 30, 60 and 120 FPS', () => {
  const times = [30, 60, 120].map((fps) => {
    const g = createGame(); startRound(g); shootAt(g, 0);
    return stepUntil(g, (x) => x.hook.mode === HOOK_MODE.READY && x.score > 0, 1 / fps);
  });
  assert.ok(Math.max(...times) - Math.min(...times) <= 1 / 30 + 1e-6, times.join(', '));
});

test('swing and clock agree at 30, 60 and 120 FPS', () => {
  const res = [30, 60, 120].map((fps) => { const g = createGame(); startRound(g); run(g, 2, 1 / fps); return g; });
  for (const g of res) {
    assert.ok(Math.abs(g.timeLeft - res[0].timeLeft) < 1e-6);
    assert.ok(Math.abs(g.hook.angle - res[0].hook.angle) < 0.05);
  }
});

// ---------- score check (browser and SQL) ----------
// The fastest possible game: fire as soon as the hook is home, straight at each object.
function fastestRun() {
  const g = createGame(); startRound(g);
  for (const o of [...g.objects]) {
    if (g.app !== APP.PLAYING) break;
    shootAt(g, angleTo(o));
    stepUntil(g, (x) => x.hook.mode === HOOK_MODE.READY || x.app !== APP.PLAYING, 1 / 120);
  }
  run(g, 0.1);
  return g;
}

test('the fastest physically possible game passes the check (no false rejects)', () => {
  const g = fastestRun();
  assert.equal(g.app, APP.RESULT);
  const v = validateRun(g.result.run);
  assert.ok(v.ok, v.reason);
  assert.equal(v.score, 910);
});

test('normal games pass the check at 30, 60 and 120 FPS', () => {
  for (const fps of [30, 60, 120]) {
    const r = bot(1 / fps);
    const v = validateRun(r.result.run);
    assert.ok(v.ok, `${fps} FPS: ${v.reason}`);
    assert.equal(v.score, r.score);
  }
});

test('forged rounds are rejected', () => {
  const good = fastestRun().result.run;
  const cases = {
    duplicate: (r) => { r.catches.push({ ...r.catches[0], t: 59 }); },
    'too-fast': (r) => { r.catches[3].t = r.catches[2].t + 0.05; },
    id: (r) => { r.catches[0].id = 99; },
    time: (r) => { r.catches[r.catches.length - 1].t = 75; },
    order: (r) => { [r.catches[1].t, r.catches[2].t] = [r.catches[2].t, r.catches[1].t]; },
    gameId: (r) => { r.gameId = 'other'; },
    layoutVersion: (r) => { r.layoutVersion = 1; },
  };
  for (const [name, mutate] of Object.entries(cases)) {
    const r = JSON.parse(JSON.stringify(good)); mutate(r);
    assert.equal(validateRun(r).ok, false, name);
  }
  assert.ok(!('score' in good), 'the browser never sends a point total');
});

test('the SQL object table matches the game settings', () => {
  const sql = readFileSync(new URL('../games/supabase/update_gold_hook.sql', import.meta.url), 'utf8');
  for (const row of layoutTable()) {
    const needle = `(${row.id}, ${row.points}, ${row.minCycle.toFixed(3)})`;
    assert.ok(sql.includes(needle), `missing ${needle}`);
  }
  assert.ok(sql.includes(`layoutVersion ${round.layoutVersion}`));
  assert.ok(sql.includes(`'${GAME_ID}'`));
  assert.ok(!/gry_arcade_submit\s*\(/.test(sql.replace(/--.*$/gm, '')), 'the SQL must not change gry_arcade_submit');
});

// ---------- high score client (fake server, no network) ----------
function fakeRpc(responses) {
  const calls = [];
  const rpc = async (fn, args) => {
    calls.push({ fn, args });
    const r = responses[fn];
    if (r instanceof Error) throw r;
    return r;
  };
  return { rpc, calls };
}

test('submit sends the caught objects and the time, never a point total', async () => {
  const f = fakeRpc({ gry_goldhook_submit: { nick: 'Fren', verified: false, place: 1 } });
  const res = await createScores(f.rpc).submit(fastestRun().result, 'Fren');
  assert.equal(res.place, 1);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].fn, 'gry_goldhook_submit');
  assert.deepEqual(Object.keys(f.calls[0].args).sort(), ['p_catches', 'p_ms', 'p_nick']);
  const { p_ms, p_catches } = f.calls[0].args;
  assert.equal(p_catches.length, 11);
  assert.ok(p_ms >= 5000 && p_ms <= 60500 && p_ms >= p_catches.at(-1).t * 1000 - 1);
});

test('empty or forged rounds never reach the server', async () => {
  const f = fakeRpc({});
  const scores = createScores(f.rpc);
  const g = createGame(); startRound(g); run(g, 61);
  await assert.rejects(scores.submit(g.result, 'Fren'));
  const bad = fastestRun().result;
  bad.run.catches[3].t = bad.run.catches[2].t + 0.01;
  await assert.rejects(scores.submit(bad, 'Fren'));
  assert.equal(f.calls.length, 0);
});

test('the top 10 is fetched at most once a minute', async () => {
  let t = 0;
  const f = fakeRpc({ gry_arcade_top: [{ nick: 'a', score: 900, verified: true }] });
  const scores = createScores(f.rpc, { now: () => t });
  await scores.top(); t = 30_000; await scores.top(); await scores.top();
  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.calls[0], { fn: 'gry_arcade_top', args: { p_game: GAME_ID } });
  t = 61_000; await scores.top();
  assert.equal(f.calls.length, 2);
});

test('a missing server function reads as "coming soon"; other errors pass through', async () => {
  assert.equal(isNotDeployed(new Error('Could not find the function public.gry_goldhook_submit in the schema cache')), true);
  assert.equal(isNotDeployed(new Error('Slow down a little, fren')), false);
  const f = fakeRpc({ gry_goldhook_submit: new Error('Slow down a little, fren') });
  await assert.rejects(createScores(f.rpc).submit(fastestRun().result, 'Fren'), /Slow down/);
});

test('sign-in session is read like PondOS: valid, not anonymous, Discord flag', () => {
  const cfg = { supabaseUrl: 'https://abc123.supabase.co' };
  const store = (v) => ({ getItem: (k) => (k === 'sb-abc123-auth-token' ? JSON.stringify(v) : null) });
  const future = Date.now() / 1000 + 3600;
  assert.deepEqual(readSession(cfg, store({ access_token: 't', expires_at: future, user: { identities: [{ provider: 'discord' }] } })), { token: 't', discord: true });
  assert.equal(readSession(cfg, store({ access_token: 't', expires_at: future, user: { is_anonymous: true } })), null);
  assert.equal(readSession(cfg, store({ access_token: 't', expires_at: Date.now() / 1000 - 10 })), null);
  assert.equal(readSession(cfg, { getItem: () => '{bad json' }), null);
});

test('buildSubmission uses the played time, rounded to ms', () => {
  const result = { durationSec: 60, timeLeft: 12.3456, run: { catches: [{ id: 5, t: 4.075, extra: 1 }] } };
  assert.deepEqual(buildSubmission(result, 'Fren'), { p_nick: 'Fren', p_catches: [{ id: 5, t: 4.075 }], p_ms: 47654 });
});
