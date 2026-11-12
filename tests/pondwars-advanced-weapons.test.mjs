import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, startTurn, fire, step, explode, W, H, WEAPONS } from '../docs/games/js/pondwars-beta-engine.mjs';
import { applyInput, KEY } from '../docs/games/js/pondwars-beta-net.mjs';

function flat(distance = 400) {
  const g = newGame({ seed: 3, perTeam: 2, cpu: [false, false], packs: 'advanced' });
  g.mask.fill(0);
  for (let y = 450; y < H; y++) g.mask.fill(1, y * W, (y + 1) * W);
  g.frogs.forEach((f, i) => Object.assign(f, {
    x: i === 0 ? 200 : 200 + distance, y: 449, vx: 0, vy: 0, hp: 100, alive: true, ground: true, face: 1,
  }));
  startTurn(g);
  return g;
}
const solids = g => g.mask.reduce((n, v) => n + v, 0);

test('Doge Flyer keeps its heading until steered, and its velocity lags the nose', () => {
  const g = flat();
  g.weapon = 'doge';
  const angle = -0.4;
  assert.equal(fire(g, angle, 1), true);
  assert.equal(g.phase, 'guide');
  const s = g.shots[0];
  const launch = s.vx;
  for (let i = 0; i < 8; i++) applyInput(g, { m: 0, a: [] });
  assert.ok(Math.abs(s.heading - angle) < 1e-6, 'heading drifted with no stick');
  assert.ok(Math.abs(s.vx - launch) < 50, 'speed snapped instead of lagging');
  const cruise = Math.cos(s.heading) * WEAPONS.doge.cruise;
  assert.ok(Math.abs(s.vx - cruise) > 20);

  const nose = s.heading;
  for (let i = 0; i < 30; i++) applyInput(g, { m: KEY.R, a: [] });
  assert.ok(s.heading > nose + 0.8, 'right stick should turn the nose, heading ' + s.heading);
  const vel = Math.atan2(s.vy, s.vx);
  assert.ok(Math.abs(vel - s.heading) > 0.12, 'velocity should lag the new heading');

  const enemy = g.frogs[1];
  enemy.x = s.x;
  enemy.y = s.y + 11;
  applyInput(g, { m: 0, a: [{ t: 'detonate' }] });
  assert.equal(g.phase, 'settle');
  assert.equal(g.shots.some(shot => shot.type === 'doge'), false);
  assert.ok(enemy.hp < 70 && enemy.hp > 40, 'detonate damage, hp ' + enemy.hp);
  assert.equal(g.ammo[0].doge, 0);
  g.phase = 'aim';
  assert.equal(fire(g, angle, 1), false);
});

test('Doge Flyer detonates itself when the 4.5 second lifetime runs out', () => {
  const g = flat();
  g.weapon = 'doge';
  fire(g, -0.2, 1);
  const s = g.shots[0];
  s.t = 4.49;
  step(g);
  assert.equal(g.shots.some(shot => shot.type === 'doge'), false);
  assert.equal(g.phase, 'settle');
});

test('Silver Donkey warns, then drops a very large strike and is spent', () => {
  const g = flat(400);
  const enemy = g.frogs[1];
  g.weapon = 'donkey';
  const before = solids(g);
  assert.equal(fire(g, 0, 1, enemy.x, enemy.y), true);
  assert.equal(g.shots[0].warning, true);
  for (let i = 0; i < 40; i++) step(g);
  assert.equal(enemy.hp, 100);
  assert.equal(solids(g), before);
  assert.equal(g.shots[0].warning, true);
  for (let i = 0; i < 200 && g.shots.length; i++) step(g);
  assert.ok(enemy.hp < 40, 'heavy hit, hp ' + enemy.hp);
  const carved = before - solids(g);
  assert.ok(carved > 4000, 'very large crater, removed ' + carved);
  assert.equal(g.ammo[0].donkey, 0);
  g.phase = 'aim';
  assert.equal(fire(g, 0, 1, enemy.x, enemy.y), false);

  const buried = flat();
  const ground = solids(buried);
  explode(buried, 600, 520, 'donkey');
  const hole = ground - solids(buried);
  assert.ok(hole > 18000 && hole < 25000, 'buried very-large crater, removed ' + hole);
  assert.equal(WEAPONS.rocket.damage, 42);
});
