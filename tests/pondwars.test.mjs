import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, startTurn, step, fire, walk, hop, cpuPlan, me, solid, makeTerrain, aliveOf, W, WATER } from '../docs/games/js/pondwars-engine.mjs';

test('the island is the same for the same seed, and different for another', () => {
  const a = makeTerrain(5), b = makeTerrain(5), c = makeTerrain(6);
  assert.deepEqual(a, b); assert.notDeepEqual(a, c);
});
test('frogs start standing on ground, above the water, apart', () => {
  for (let seed = 1; seed < 30; seed++) {
    const g = newGame({ seed });
    for (const f of g.frogs) { assert.ok(solid(g.mask, f.x, f.y + 1) && !solid(g.mask, f.x, f.y), 'on ground'); assert.ok(f.y < WATER); }
  }
});
test('walking and hopping move the frog; a grenade blows a hole', () => {
  const g = newGame({ seed: 3 }); startTurn(g);
  const f = me(g), x = f.x;
  for (let i = 0; i < 20; i++) walk(g, 1);
  assert.notEqual(f.x, x);
  for (let i = 0; i < 120; i++) step(g);
  assert.ok(hop(g)); for (let i = 0; i < 200; i++) step(g);
  const before = g.mask.reduce((s, v) => s + v, 0);
  assert.ok(fire(g, -Math.PI / 2, .1));
  for (let i = 0; i < 600 && g.phase !== 'aim'; i++) step(g);
  assert.ok(g.mask.reduce((s, v) => s + v, 0) < before, 'the ground has a hole');
});
test('CPU against CPU always finishes with a winner', () => {
  for (const seed of [1, 2, 7]) {
    const g = newGame({ seed, perTeam: 2, cpu: [true, true], level: 2 }); startTurn(g);
    let turns = 0;
    for (let i = 0; i < 60 * 60 * 40 && g.winner === null; i++) {
      if (g.phase === 'aim' && g.timer < 29.5) { const p = cpuPlan(g); g.weapon = p.weapon; fire(g, p.angle, p.power, p.tx); turns++; }
      step(g);
    }
    assert.notEqual(g.winner, null, 'seed ' + seed + ' after ' + turns + ' turns');
    assert.ok(turns < 80);
  }
});
