// Pepe Gold Hook: game logic, the 20-level campaign and its shop, frame-rate independence, the run
// check and its SQL twin (games/supabase/update_gold_hook_campaign.sql), the high score client on a
// fake server, and the art pack files.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HOOK, LAYOUT, OBJECT_TYPES, GAME_ID } from '../docs/games/js/gold-hook-config.mjs';
import {
  APP, HOOK_MODE, createGame, startRound, update, fire, pause, resume, toTitle,
  hookGeometry, hookDir, currentAnim, drainEvents, useDynamite, segmentCircleEntry,
} from '../docs/games/js/gold-hook-state.mjs';
import {
  MAX_LEVEL, TARGETS, levelDef, durationFor, weightFor, SHOP, newRun, modsFor, priceOf, priceFor, canBuy, buy,
  finishLevel, submission, speedsFor,
} from '../docs/games/js/gold-hook-campaign.mjs';
import { validateCampaign, levelTable } from '../docs/games/js/gold-hook-validation.mjs';
import { createScores, buildSubmission, readSession, isNotDeployed } from '../docs/games/js/gold-hook-scores.mjs';

const W = LAYOUT.winch;
const angleTo = (o) => Math.atan2(o.x - W.x, o.y - W.y) * 180 / Math.PI;
const run = (g, sec, dt = 1 / 60) => { for (let t = 0; t < sec - 1e-9; t += dt) update(g, dt); };
function shootAt(g, angle) { g.hook.angle = angle; assert.ok(fire(g), 'fire() works in READY'); g.hook.angle = angle; }
function stepUntil(g, pred, dt = 1 / 60, maxSec = 60) {
  for (let t = 0; t < maxSec; t += dt) { if (pred(g)) return t; update(g, dt); }
  throw new Error('stepUntil: timed out');
}
const HALF = { 'nugget-small': 12, 'nugget-medium': 16, 'nugget-large': 24, 'coin-pep': 12, rock: 16, crate: 20 };

// ---------- a perfect-aim bot (waits for the swing like a player) ----------
function firstHit(g, ang) {
  const d = hookDir(ang), s = HOOK.restLength + HOOK.cargoOffset;
  let best = null, bestT = Infinity;
  for (const o of g.objects) {
    if (o.caught) continue;
    const t = segmentCircleEntry(W.x + d.x * s, W.y + d.y * s, W.x + d.x * 400, W.y + d.y * 400, o.x, o.y, o.r + HOOK.grabRadius);
    if (t !== null && t < bestT) { bestT = t; best = o; }
  }
  return best;
}
function botLevel(def, mods, dt = 1 / 60) {
  const g = createGame({ level: def, mods }); startRound(g);
  let target = null;
  for (let i = 0; i < Math.round(80 / dt) && g.app === APP.PLAYING; i++) {
    const prev = g.hook.angle;
    update(g, dt);
    if (g.hook.mode === HOOK_MODE.RETURNING_LOADED && g.hook.cargo.type === 'rock' && g.dynamite > 0) useDynamite(g);
    if (g.hook.mode !== HOOK_MODE.READY) { target = null; continue; }
    if (!target || target.caught) {
      let bestRate = -1; target = null;
      for (const o of g.objects) {
        if (o.caught || firstHit(g, angleTo(o)) !== o) continue;
        const dist = Math.hypot(o.x - W.x, o.y - W.y);
        const rate = o.points / (dist / g.speeds.extend + dist / (g.speeds.loaded * o.speedMul) + 1.2);
        if (rate > bestRate) { bestRate = rate; target = o; }
      }
      if (!target) break;
    }
    const a = angleTo(target);
    if (i > 0 && (prev - a) * (g.hook.angle - a) <= 0) fire(g);
  }
  while (g.app === APP.PLAYING) update(g, dt);
  return g.result;
}
// every shop: the upgrades for the next level, most useful first, while the money lasts
const policy = (r) => { for (const item of ['strength', 'reel', 'clock', 'dynamite', 'dynamite']) if (canBuy(r, item)) buy(r, item); };
function botCampaign(dt = 1 / 60) {
  const r = newRun();
  while (!r.over && !r.finished) {
    finishLevel(r, botLevel(levelDef(r.level), modsFor(r), dt));
    if (!r.over && !r.finished) policy(r);
  }
  return r;
}
const fullRun = botCampaign();
const lostLevel = { won: false, score: 0, played: 10, run: { catches: [], dynamiteUsed: 0 } };

// ---------- levels ----------
test('20 levels: less time, heavier loot, more rocks, goals never go down', () => {
  const rocks = (d) => d.objects.filter((o) => o.type === 'rock').length;
  for (let L = 2; L <= MAX_LEVEL; L++) {
    const a = levelDef(L - 1), b = levelDef(L);
    assert.ok(b.durationSec <= a.durationSec && b.weight <= a.weight && b.target >= a.target, `level ${L}`);
    assert.ok(rocks(b) >= rocks(a), `level ${L} rocks`);
  }
  assert.equal(durationFor(1), 60); assert.equal(durationFor(20), 40);
  assert.equal(weightFor(1), 1); assert.equal(weightFor(20), 0.7);
  assert.equal(levelDef(1).target, 650);
});

test('every level layout: no overlaps, inside the mine, within reach, clear of the resting hook', () => {
  const m = LAYOUT.mine, restCargoY = W.y + HOOK.restLength + HOOK.cargoOffset;
  for (let L = 1; L <= MAX_LEVEL; L++) {
    const objs = levelDef(L).objects.map((o) => ({ ...o, r: OBJECT_TYPES[o.type].radius }));
    for (let i = 0; i < objs.length; i++) {
      const o = objs[i], h = HALF[o.type];
      assert.ok(o.x - h >= m.x0 && o.x + h <= m.x1 && o.y - h >= m.y0 && o.y + h <= m.y1, `L${L} ${o.type} inside`);
      assert.ok(o.y - o.r > restCargoY + HOOK.grabRadius + 4, `L${L} ${o.type} clear of the hook`);
      assert.ok(Math.abs(angleTo(o)) <= HOOK.maxAngleDeg && Math.hypot(o.x - W.x, o.y - W.y) - HOOK.cargoOffset <= HOOK.maxLength, `L${L} reach`);
      for (let j = i + 1; j < objs.length; j++) assert.ok(Math.hypot(o.x - objs[j].x, o.y - objs[j].y) > o.r + objs[j].r + 4, `L${L} overlap`);
    }
  }
});

test('level 1 keeps the hand-made layout: 910 points, every object can be the first catch', () => {
  const def = levelDef(1);
  assert.equal(def.objects.reduce((s, o) => s + OBJECT_TYPES[o.type].points, 0), 910);
  def.objects.forEach((o, i) => {
    const g = createGame(); startRound(g);
    shootAt(g, angleTo(o));
    stepUntil(g, (x) => x.hook.mode !== HOOK_MODE.EXTENDING);
    assert.equal(g.hook.cargo && g.hook.cargo.id, i);
  });
});

test('a perfect-aim bot that shops sensibly finishes all 20 levels', () => {
  assert.equal(fullRun.finished, true, `stopped at level ${fullRun.level}`);
  assert.equal(fullRun.log.length, MAX_LEVEL);
});

test("every goal leaves room for mistakes: the bot gets >= 1.25x the goal with an average player's upgrades", () => {
  // an average player earns about 65 % of what the bot does, so buys upgrades later
  const r = newRun();
  for (let L = 1; L <= MAX_LEVEL; L++) {
    r.level = L;
    const res = botLevel(levelDef(L), modsFor(r));
    assert.ok(res.score >= 1.25 * TARGETS[L], `level ${L}: bot ${res.score}, goal ${TARGETS[L]}`);
    r.money += Math.floor(res.score * 0.65); r.log.push({ bought: [] });
    r.strength = 0; r.reel = 0; r.dynamite = 0; r.clock = 0;
    if (L < MAX_LEVEL) { r.level = L + 1; policy(r); }
  }
});

test('from level 9 on, a perfect bot without upgrades often falls short: the shop matters', () => {
  let short = 0;
  for (let L = 9; L <= MAX_LEVEL; L++) if (botLevel(levelDef(L), {}).score < TARGETS[L]) short++;
  assert.ok(short >= 4, `only ${short} of 12 late levels need upgrades`);
});

// ---------- hook, scoring, upgrades ----------
test('points arrive only on delivery, and each object is caught once', () => {
  const g = createGame(); startRound(g);
  const large = g.objects.find((o) => o.type === 'nugget-large');
  shootAt(g, angleTo(large));
  stepUntil(g, (x) => x.hook.mode === HOOK_MODE.RETURNING_LOADED);
  assert.equal(g.score, 0);
  stepUntil(g, (x) => x.hook.mode === HOOK_MODE.READY);
  assert.equal(g.score, 250);
  assert.equal(drainEvents(g).filter((e) => e.type === 'score').length, 1);
  shootAt(g, angleTo(large));
  stepUntil(g, (x) => x.hook.mode !== HOOK_MODE.EXTENDING);
  assert.ok(!g.hook.cargo || g.hook.cargo.id !== large.id);
});

test('fire() only works in PLAYING + READY; the angle stays fixed while out', () => {
  const g = createGame();
  assert.equal(fire(g), false);
  startRound(g); run(g, 0.7);
  const a = g.hook.angle;
  assert.equal(fire(g), true);
  assert.equal(fire(g), false);
  run(g, 0.3);
  assert.equal(g.hook.angle, a);
  pause(g);
  assert.equal(fire(g), false);
});

function perPx(type, L = 1) {
  const h = createGame({ level: levelDef(L) }); startRound(h);
  shootAt(h, angleTo(h.objects.find((x) => x.type === type)));
  stepUntil(h, (x) => x.hook.mode === HOOK_MODE.RETURNING_LOADED);
  const len = h.hook.length - HOOK.restLength;
  return stepUntil(h, (x) => x.hook.mode === HOOK_MODE.READY, 1 / 240) / len;
}

test('heavier loot comes up slower, and later levels make everything heavier', () => {
  assert.ok(perPx('nugget-large') > perPx('nugget-medium') && perPx('nugget-medium') > perPx('nugget-small'));
  assert.ok(perPx('rock') > perPx('nugget-large'));
  const late = createGame({ level: levelDef(20) });
  assert.ok(late.objects.every((o) => Math.abs(o.speedMul - OBJECT_TYPES[o.type].speedMul * 0.7) < 1e-9));
});

test('strong arms reel loot in 50 % faster, the fast reel shoots the hook out 30 % faster', () => {
  const t = (mods) => {
    const g = createGame({ mods }); startRound(g);
    shootAt(g, angleTo(g.objects.find((o) => o.type === 'nugget-large')));
    stepUntil(g, (x) => x.hook.mode === HOOK_MODE.RETURNING_LOADED, 1 / 240);
    return stepUntil(g, (x) => x.hook.mode === HOOK_MODE.READY, 1 / 240);
  };
  assert.ok(Math.abs(t({}) / t({ strength: 1 }) - 1.5) < 0.05);
  const s = speedsFor({ reel: 1 });
  assert.equal(s.extend, HOOK.extendSpeed * 1.3);
  assert.equal(s.empty, HOOK.returnEmptySpeed * 1.3);
  assert.equal(s.loaded, HOOK.returnLoadedSpeed);
});

test('the clock adds 10 s to that level only', () => {
  const r = newRun();
  finishLevel(r, botLevel(levelDef(1), modsFor(r)));
  r.money = 1000;
  assert.ok(buy(r, 'clock'));
  assert.equal(createGame({ level: levelDef(2), mods: modsFor(r) }).timeLeft, durationFor(2) + 10);
  finishLevel(r, botLevel(levelDef(2), modsFor(r)));
  assert.equal(modsFor(r).extraSec, 0);
});

test('dynamite blows up the load: no points, a fast empty hook, one stick used', () => {
  const g = createGame({ mods: { dynamite: 1 } }); startRound(g);
  assert.equal(useDynamite(g), false, 'nothing on the hook yet');
  shootAt(g, angleTo(g.objects.find((o) => o.type === 'rock')));
  stepUntil(g, (x) => x.hook.mode === HOOK_MODE.RETURNING_LOADED);
  assert.equal(useDynamite(g), true);
  assert.ok(g.effects.some((e) => e.kind === 'explosion'), 'the explosion plays');
  assert.equal(g.hook.mode, HOOK_MODE.RETURNING_EMPTY);
  assert.equal(g.dynamite, 0);
  assert.equal(currentAnim(g).name, 'hurt');
  stepUntil(g, (x) => x.hook.mode === HOOK_MODE.READY);
  assert.equal(g.score, 0);
  shootAt(g, angleTo(g.objects.find((o) => o.type === 'nugget-small')));
  stepUntil(g, (x) => x.hook.mode === HOOK_MODE.RETURNING_LOADED);
  assert.equal(useDynamite(g), false, 'no sticks left');
  g.timeLeft = 0.01; run(g, 0.1);
  assert.equal(g.result.run.dynamiteUsed, 1);
});

test('an empty hook comes back from the edge with the fail pose; pull only with cargo', () => {
  const g = createGame(); startRound(g);
  shootAt(g, -65);
  stepUntil(g, (x) => x.hook.mode !== HOOK_MODE.EXTENDING);
  assert.equal(g.hook.mode, HOOK_MODE.RETURNING_EMPTY);
  stepUntil(g, (x) => x.hook.mode === HOOK_MODE.READY);
  assert.equal(currentAnim(g).name, 'fail');
  const g2 = createGame(); startRound(g2);
  shootAt(g2, 0);
  stepUntil(g2, (x) => x.hook.mode === HOOK_MODE.RETURNING_LOADED);
  update(g2, 1 / 60);
  assert.equal(currentAnim(g2).name, 'pull');
});

test('the hook turns back at the mine floor', () => {
  const g = createGame(); startRound(g);
  g.objects.find((o) => o.type === 'nugget-large').caught = true;
  shootAt(g, 0);
  stepUntil(g, (x) => x.hook.mode !== HOOK_MODE.EXTENDING);
  assert.equal(g.hook.mode, HOOK_MODE.RETURNING_EMPTY);
  assert.ok(hookGeometry(g.hook).cy <= LAYOUT.mine.y1 + HOOK.extendSpeed / 120 + 1e-6);
});

// ---------- time, pause, end of level ----------
test('the clock stops while paused; big time jumps are capped', () => {
  const g = createGame(); startRound(g);
  run(g, 5);
  const t = g.timeLeft;
  pause(g); run(g, 10);
  assert.equal(g.timeLeft, t);
  resume(g); run(g, 1);
  assert.ok(Math.abs(g.timeLeft - (t - 1)) < 1e-6);
  update(g, 30);
  assert.ok(g.timeLeft > t - 1.1);
});

test('at 0 s the level ends; loot still on the rope scores nothing; restart resets', () => {
  const g = createGame(); startRound(g);
  g.timeLeft = 0.5; shootAt(g, 0); run(g, 2);
  assert.equal(g.app, APP.RESULT);
  assert.equal(g.score, 0);
  assert.equal(g.result.won, false);
  startRound(g);
  assert.equal(g.timeLeft, 60);
  assert.ok(g.objects.every((o) => !o.caught));
  assert.equal(g.effects.length, 0);
  toTitle(g);
  assert.equal(g.app, APP.TITLE);
});

test('the same shot takes the same time at 30, 60 and 120 FPS; the bot scores alike', () => {
  const times = [30, 60, 120].map((fps) => {
    const g = createGame(); startRound(g); shootAt(g, 0);
    return stepUntil(g, (x) => x.hook.mode === HOOK_MODE.READY && x.score > 0, 1 / fps);
  });
  assert.ok(Math.max(...times) - Math.min(...times) <= 1 / 30 + 1e-6);
  const scores = [30, 60, 120].map((fps) => botLevel(levelDef(5), { strength: 1 }, 1 / fps).score);
  assert.ok(Math.max(...scores) - Math.min(...scores) <= 200, scores.join(', '));
});

// ---------- the run: shop and economy ----------
test('shop: prices grow with the level, limits, money; a loss ends the run', () => {
  assert.deepEqual(['strength', 'reel', 'dynamite', 'clock'].map((i) => priceFor(i, 1)), [200, 160, 60, 160]);
  assert.deepEqual(['strength', 'reel', 'dynamite', 'clock'].map((i) => priceFor(i, 20)), [390, 312, 117, 312]);
  const r = newRun();
  assert.equal(priceOf(r, 'strength'), 200);
  assert.equal(canBuy(r, 'strength'), false, 'no money yet');
  finishLevel(r, botLevel(levelDef(1), modsFor(r)));
  assert.equal(r.level, 2);
  const before = r.money;
  assert.ok(buy(r, 'strength'));
  assert.equal(r.money, before - priceFor('strength', 2));
  assert.deepEqual(r.log[0].bought, ['strength']);
  r.money = 1e6;
  while (buy(r, 'dynamite')); assert.equal(r.dynamite, SHOP.dynamite.max);
  assert.equal(buy(r, 'strength'), false, 'one per level');
  while (buy(r, 'reel')); assert.equal(r.reel, SHOP.reel.max);
  assert.equal(priceOf(r, 'reel'), null);
  finishLevel(r, lostLevel);
  assert.equal(r.over, true);
  assert.equal(canBuy(r, 'clock'), false, 'no shop after game over');
});

test('upgrades last one level: nothing carries over, unused dynamite is lost', () => {
  const r = newRun();
  finishLevel(r, botLevel(levelDef(1), modsFor(r)));
  r.money = 5000;
  for (const item of ['strength', 'reel', 'clock', 'dynamite', 'dynamite']) assert.ok(buy(r, item), item);
  assert.deepEqual(modsFor(r), { strength: 1, reel: 1, dynamite: 2, extraSec: 10 });
  finishLevel(r, botLevel(levelDef(2), modsFor(r)));
  assert.deepEqual(modsFor(r), { strength: 0, reel: 0, dynamite: 0, extraSec: 0 });
});

// ---------- run check (browser and SQL) ----------
test('a finished bot run passes the check, with the right total', () => {
  const v = validateCampaign(submission(fullRun));
  assert.ok(v.ok, `${v.reason} at ${v.at}`);
  assert.equal(v.score, fullRun.total);
  assert.equal(v.finished, true);
  assert.equal(v.level, 20);
});

test('a run that ended in a loss passes too', () => {
  const r = newRun();
  finishLevel(r, botLevel(levelDef(1), modsFor(r)));
  finishLevel(r, lostLevel);
  const v = validateCampaign(submission(r));
  assert.ok(v.ok, v.reason);
  assert.equal(v.over, true);
  assert.equal(v.level, 2);
  assert.equal(v.score, r.total);
});

test('forged runs are rejected', () => {
  const good = submission(fullRun);
  const cases = {
    'extra catch': (s) => { s.levels[0].catches.push({ ...s.levels[0].catches[0], t: 59 }); },
    'too fast': (s) => { s.levels[3].catches[2].t = s.levels[3].catches[1].t + 0.05; },
    'unknown object': (s) => { s.levels[0].catches[0].id = 99; },
    'after the clock': (s) => { s.levels[1].catches.at(-1).t = 80; },
    'skipped level': (s) => { s.levels.splice(3, 1); },
    'free upgrade': (s) => { s.levels[0].bought.push('strength', 'strength', 'strength'); },
    'unowned dynamite': (s) => { s.levels[0].dynamite = 2; },
    'more time': (s) => { s.levels[0].seconds = 75; },
    'unfinished run': (s) => { s.levels.length = 5; },
    'shop after the end': (s) => { s.levels[19].bought.push('dynamite'); },
    'wrong game': (s) => { s.gameId = 'fud'; },
  };
  for (const [name, mutate] of Object.entries(cases)) {
    const s = JSON.parse(JSON.stringify(good)); mutate(s);
    assert.equal(validateCampaign(s).ok, false, name);
  }
  assert.ok(!('score' in good) && !('total' in good) && !('money' in good), 'the browser never sends totals');
});

test('the SQL level tables match the game', () => {
  const sql = readFileSync(new URL('../games/supabase/update_gold_hook_campaign.sql', import.meta.url), 'utf8');
  for (let L = 1; L <= MAX_LEVEL; L++) {
    const d = levelDef(L);
    assert.ok(sql.includes(`(${L}, ${d.durationSec}, ${d.weight}, ${d.target})`), `level row ${L}`);
    for (const row of levelTable(L)) {
      const needle = `(${L}, ${row.id}, ${row.points}, ${row.speedMul}, ${row.travel})`;
      assert.ok(sql.includes(needle), `missing ${needle}`);
    }
  }
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

test('submit sends the levels played, never a total, and only for a finished run', async () => {
  const f = fakeRpc({ gry_goldhook_submit_run: { nick: 'Fren', verified: false, place: 1, score: fullRun.total } });
  const scores = createScores(f.rpc);
  await assert.rejects(scores.submit(newRun(), 'Fren'), /Finish/);
  const res = await scores.submit(fullRun, 'Fren');
  assert.equal(res.place, 1);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].fn, 'gry_goldhook_submit_run');
  assert.deepEqual(Object.keys(f.calls[0].args).sort(), ['p_nick', 'p_run']);
  assert.equal(f.calls[0].args.p_run.levels.length, 20);
  assert.deepEqual(buildSubmission(fullRun, 'Fren'), f.calls[0].args);
});

test('forged runs never reach the server', async () => {
  const f = fakeRpc({});
  const r = JSON.parse(JSON.stringify(fullRun));
  r.log[0].bought.push('strength', 'strength', 'strength');
  await assert.rejects(createScores(f.rpc).submit(r, 'Fren'));
  assert.equal(f.calls.length, 0);
});

test('the top 10 is fetched at most once a minute; my stats call the account function', async () => {
  let t = 0;
  const f = fakeRpc({ gry_arcade_top: [{ nick: 'a', score: 900, verified: true }], gry_goldhook_me: { best_score: 1 } });
  const scores = createScores(f.rpc, { now: () => t });
  await scores.top(); t = 30_000; await scores.top();
  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.calls[0], { fn: 'gry_arcade_top', args: { p_game: GAME_ID } });
  t = 61_000; await scores.top();
  assert.equal(f.calls.length, 2);
  assert.deepEqual(await scores.me(), { best_score: 1 });
});

test('a missing server function reads as "coming soon"; sign-in session is read like PondOS', () => {
  assert.equal(isNotDeployed(new Error('Could not find the function public.gry_goldhook_submit_run in the schema cache')), true);
  assert.equal(isNotDeployed(new Error('Slow down a little, fren')), false);
  const cfg = { supabaseUrl: 'https://abc123.supabase.co' };
  const store = (v) => ({ getItem: (k) => (k === 'sb-abc123-auth-token' ? JSON.stringify(v) : null) });
  const future = Date.now() / 1000 + 3600;
  assert.deepEqual(readSession(cfg, store({ access_token: 't', expires_at: future, user: { identities: [{ provider: 'discord' }] } })), { token: 't', discord: true });
  assert.equal(readSession(cfg, store({ access_token: 't', expires_at: future, user: { is_anonymous: true } })), null);
  assert.equal(readSession(cfg, { getItem: () => '{bad json' }), null);
});

// ---------- art pack P1: effects and files ----------
test('a rock hit makes dust, a delivered find makes a sparkle; pause freezes them', () => {
  const g = createGame(); startRound(g);
  const rock = g.objects.find((o) => o.type === 'rock');
  shootAt(g, angleTo(rock));
  stepUntil(g, (x) => x.hook.mode === HOOK_MODE.RETURNING_LOADED);
  assert.deepEqual(g.effects.map((e) => [e.kind, e.x, e.y]), [['dust', rock.x, rock.y]]);
  pause(g); run(g, 2); resume(g);
  assert.equal(g.effects.length, 1);
  run(g, 0.4);
  assert.equal(g.effects.length, 0);
  const g2 = createGame(); startRound(g2);
  shootAt(g2, angleTo(g2.objects.find((o) => o.type === 'nugget-large')));
  stepUntil(g2, (x) => x.hook.mode === HOOK_MODE.READY);
  assert.deepEqual(g2.effects.map((e) => e.kind), ['sparkle']);
});

test('every picture the game loads is in the manifest and has the stated size', async () => {
  const { REQUIRED_ASSETS } = await import('../docs/games/js/gold-hook-assets.mjs');
  const base = new URL('../docs/games/img/gold-hook/', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', base), 'utf8'));
  const byId = new Map(manifest.assets.map((a) => [a.id, a]));
  const pngSize = (buf) => [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  for (const id of [...REQUIRED_ASSETS, 'pm-logo-goldhook', 'pm-icon-goldhook', 'pm-icon-goldhook-16', 'pm-button-normal', 'pm-button-pressed', 'pm-button-disabled', 'pm-dynamite',
    'pm-shop-strength', 'pm-shop-reel', 'pm-shop-clock', 'pm-shop-dynamite', 'pm-trophy']) {
    const a = byId.get(id);
    assert.ok(a, `${id} missing from manifest.json`);
    assert.deepEqual(pngSize(readFileSync(new URL(a.path, base))), [a.width, a.height], id);
  }
  for (const kind of ['sparkle', 'dust', 'explosion']) {
    const an = manifest.animations[kind], sheet = byId.get(an.atlas.id);
    assert.equal(an.atlas.rects.length, an.durationsMs.length, kind);
    for (const [x, y, w, h] of an.atlas.rects) assert.ok(x + w <= sheet.width && y + h <= sheet.height, kind);
  }
});
