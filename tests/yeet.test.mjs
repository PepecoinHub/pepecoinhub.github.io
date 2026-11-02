import test from 'node:test';
import assert from 'node:assert/strict';
import { launch, step, flap, score, obstacles, layout, STEP } from '../docs/games/js/yeet-engine.mjs';

function run(power, angle, flaps = []) {
  const s = launch(power, angle); let i = 0;
  while (!s.ended && i < 11000) {
    if (flaps.includes(i)) flap(s);
    step(s); i++;
    assert.ok(Number.isFinite(s.x) && Number.isFinite(s.y) && s.y >= 0);
  }
  assert.ok(s.ended, 'a round must end without user intervention');
  assert.ok(score(s) <= 60000 && score(s) <= Math.ceil(s.time * 1000) + 100, 'score fits server bounds');
  return s;
}
test('every launch angle/power finishes with a bounded score', () => {
  for (const angle of [20, 30, 40, 55, 65]) for (const power of [0, .5, 1]) run(power, angle);
});
test('fixed-step replay is deterministic', () => {
  const a = run(.82, 43, [60, 170, 410]), b = run(.82, 43, [60, 170, 410]);
  assert.equal(score(a), score(b)); assert.equal(a.time, b.time); assert.deepEqual(a.used, b.used);
});
test('three flaps, cooldown and no input after finish', () => {
  const s = launch(1, 45);
  assert.equal(flap(s), true); assert.equal(flap(s), false);
  for (let i = 0; i < 45; i++) step(s);
  assert.equal(flap(s), true);
  for (let i = 0; i < 45; i++) step(s);
  assert.equal(flap(s), true);
  for (let i = 0; i < 45; i++) step(s);
  assert.equal(flap(s), false); assert.equal(s.flaps, 0);
  s.ended = true; const x = s.x; step(s); assert.equal(s.x, x); assert.equal(flap(s), false);
});
test('fan and trampoline boost; mud slows', () => {
  const fan = obstacles().find(o => o.type === 'fan');
  const s = launch(.5, 40); s.x = fan.x - .1; s.y = 12; s.vx = 30; s.vy = -10; step(s);
  assert.equal(s.event, 'fan'); assert.ok(s.vy >= 26);
  const trampoline = obstacles().find(o => o.type === 'trampoline');
  const t = launch(.5, 40); t.x = trampoline.x; t.y = 1; t.vy = -20; step(t);
  assert.equal(t.event, 'trampoline'); assert.ok(t.vy >= 28);
  const mud = obstacles().find(o => o.type === 'mud');
  const m = launch(.5, 40); m.x = mud.x; m.y = .1; m.vy = 0; m.vx = 30; step(m);
  assert.equal(m.event, 'mud'); assert.ok(m.vx < 8);
});
test('skill inputs change outcomes and the same obstacle cannot trigger twice', () => {
  assert.notEqual(score(run(1, 40)), score(run(.2, 40)));
  const f = obstacles().find(o => o.type === 'fan'); const s = launch(1, 40);
  s.x = f.x - .1; s.y = 12; s.vx = 30; step(s); const used = s.used.size;
  s.x = f.x - .1; s.y = 12; step(s); assert.equal(s.used.size, used);
});
test('frame budgets can advance the same simulation at different display rates', () => {
  function simulate(fps) { const s = launch(.7, 35); let acc = 0;
    while (!s.ended) { acc += 1 / fps; while (acc >= STEP && !s.ended) { step(s); acc -= STEP; } } return s;
  }
  assert.equal(score(simulate(30)), score(simulate(144)));
});
test('the same spots get different things each round, and a seed always gives the same layout', () => {
  const a = layout(11).map(o => o.type).join(), b = layout(12).map(o => o.type).join();
  assert.notEqual(a, b); assert.equal(layout(11).map(o => o.type).join(), a);
  const xs = new Set(); for (let s = 1; s < 40; s++) for (const o of layout(s)) xs.add(o.x);
  assert.ok(xs.size <= 75, 'only the fixed spots are used');
  for (let s = 1; s < 200; s++) { const L = layout(s); assert.ok(L[0]?.type !== 'sellwall' || L[0].id > 0);
    for (let i = 1; i < L.length; i++) assert.ok(!(L[i].type === 'sellwall' && L[i - 1].type === 'sellwall' && L[i].id - L[i - 1].id < 2)); }
});
function seedWith(type) { for (let s = 1; s < 500; s++) { const o = layout(s).find(o => o.type === type); if (o) return [s, o]; } }
test('a sell wall stops a low frog, and a high frog flies over it', () => {
  const [seed, w] = seedWith('sellwall');
  const low = launch(.5, 40, seed); low.x = w.x - 1.6; low.y = w.h - 3; low.vx = 40; low.vy = 0; step(low);
  assert.equal(low.event, 'sellwall'); assert.equal(low.vx, 0); assert.ok(low.x < w.x);
  for (let i = 0; i < 3000 && !low.ended; i++) step(low);
  assert.ok(low.ended && low.x < w.x, 'it slides down and the round ends at the wall');
  const high = launch(.5, 40, seed); high.x = w.x - 1.6; high.y = w.h + 2; high.vx = 40; high.vy = 0; step(high);
  assert.notEqual(high.event, 'sellwall'); assert.ok(high.x > w.x - 1.5);
});
test('a pump launches the frog and gives one flap back', () => {
  const [seed, p] = seedWith('pump');
  const s = launch(.5, 40, seed); s.x = p.x; s.y = 1; s.vx = 10; s.vy = -5; s.flaps = 1; step(s);
  assert.equal(s.event, 'pump'); assert.ok(s.vy >= 39); assert.equal(s.flaps, 2);
});
test('random seeds still give bounded scores', () => {
  for (let seed = 1; seed < 120; seed++) { const s = launch(1, 42, seed);
    while (!s.ended) { if (s.y < 6 && s.vy < 0) flap(s); step(s); }
    assert.ok(score(s) <= 60000 && score(s) <= Math.ceil(s.time * 1000) + 100); }
});
