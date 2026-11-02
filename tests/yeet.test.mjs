import test from 'node:test';
import assert from 'node:assert/strict';
import { launch, step, flap, score, obstacles, STEP } from '../docs/games/js/yeet-engine.mjs';

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
