import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, startTurn, fire, step, stepShot, explode, me, W, H, WEAPONS } from '../docs/games/js/pondwars-beta-engine.mjs';

function flat(distance = 70) {
  const g = newGame({ seed: 3, perTeam: 2, cpu: [false, false], packs: 'simple' });
  g.mask.fill(0);
  for (let y = 450; y < H; y++) g.mask.fill(1, y * W, (y + 1) * W);
  g.frogs.forEach((f, i) => Object.assign(f, {
    x: i === 0 ? 200 : 200 + distance, y: 449, vx: 0, vy: 0, hp: 100, alive: true, ground: true, face: 1,
  }));
  startTurn(g);
  return g;
}
const solids = g => g.mask.reduce((n, v) => n + v, 0);

test('Golden Foot v2 is a one-use kick, distinct from the baseball bat', () => {
  const hit = flat(60);
  hit.weapon = 'goldv2';
  const ground = solids(hit);
  assert.equal(fire(hit, 0, 1), true);
  assert.equal(hit.frogs[1].hp, 42);
  assert.ok(hit.frogs[1].vx >= 640);
  assert.ok(hit.frogs[1].vy <= -260);
  assert.equal(hit.shots.length, 0);
  assert.equal(hit.ammo[0].goldv2, 0);
  assert.equal(hit.ammo[0].gold, 1);
  const carved = ground - solids(hit);
  assert.ok(carved > 20 && carved < 250, 'scuff crater only, carved ' + carved);
  hit.phase = 'aim';
  assert.equal(fire(hit, 0, 1), false);

  const miss = flat(100);
  miss.weapon = 'goldv2';
  assert.equal(fire(miss, 0, 1), true);
  assert.equal(miss.frogs[1].hp, 100);
  assert.equal(miss.ammo[0].goldv2, 0);

  const bat = flat(60);
  bat.weapon = 'bat';
  assert.equal(fire(bat, 0, 1), true);
  assert.equal(bat.frogs[1].hp, 68);
  assert.ok(Math.abs(bat.frogs[1].vx) < 500);
  assert.equal(bat.ammo[0].goldv2, 1);
  assert.equal(me(bat).hp, 100);
});

test('Bell Bomb bounces, dings, and explodes once without fragments', () => {
  const g = flat(400);
  g.mask.fill(0);
  for (let y = 0; y < H; y++) g.mask[y * W + 400] = 1;
  const s = { type: 'bell', x: 390, y: 200, vx: 2000, vy: 0, t: 0, owner: 99, ownerClear: true };
  stepShot(g, s);
  assert.ok(s.x < 400);
  assert.ok(s.vx < 0);
  assert.equal(s.ding, true);
  g.shots.push(s);
  step(g);
  assert.ok(g.events.some(e => e.type === 'bell'));
  assert.ok(g.texts.some(t => t.text === 'DING'));

  const boom = flat(80);
  boom.mask.fill(0);
  boom.shots.push({ type: 'bell', x: 300, y: 200, vx: 0, vy: 0, t: WEAPONS.bell.fuse - 0.01, owner: 99, ownerClear: true });
  step(boom);
  assert.equal(boom.shots.length, 0);
  assert.ok(boom.events.some(e => e.type === 'boom'));
  assert.equal(boom.shots.filter(p => p.type === 'shard' || p.type === 'toe').length, 0);

  const blast = flat(80);
  const enemy = blast.frogs[1];
  explode(blast, enemy.x, enemy.y - 11, 'bell');
  assert.equal(enemy.hp, 56);
  const buried = flat(80);
  const before = solids(buried);
  explode(buried, 600, 520, 'bell');
  const hole = before - solids(buried);
  assert.ok(hole > 3000 && hole < 4200, 'medium crater, removed ' + hole);

  const stock = flat(200);
  stock.weapon = 'bell';
  assert.equal(fire(stock, -0.4, 0.7), true);
  assert.equal(stock.shots[0].type, 'bell');
  stock.phase = 'aim';
  assert.equal(fire(stock, -0.4, 0.7), true);
});

test('Frog Mine arms after one second, then a small blast with medium knockback', () => {
  const g = flat(200);
  g.weapon = 'frogmine';
  assert.equal(fire(g, 0, 1), true);
  assert.equal(g.ammo[0].frogmine, 2);
  assert.equal(g.mines.length, 1);
  assert.equal(g.mines[0].type, 'frogmine');
  const enemy = g.frogs[1];
  const before = solids(g);
  for (let i = 0; i < 50; i++) { enemy.x = g.mines[0].x; enemy.y = g.mines[0].y; step(g); }
  assert.equal(g.mines.length, 1);
  assert.equal(enemy.hp, 100);
  for (let i = 0; i < 20 && g.mines.length; i++) { enemy.x = g.mines[0].x; enemy.y = g.mines[0].y; step(g); }
  assert.equal(g.mines.length, 0);
  assert.ok(enemy.hp < 100 && enemy.hp >= 66, 'hp ' + enemy.hp);
  assert.ok(Math.abs(enemy.vx) > 30);
  const hole = before - solids(g);
  assert.ok(hole > 80 && hole < 1200, 'small crater, removed ' + hole);

  const bag = flat(200);
  for (let left = 3; left >= 1; left--) {
    bag.phase = 'aim';
    bag.weapon = 'frogmine';
    assert.equal(fire(bag, 0, 1), true);
    assert.equal(bag.ammo[0].frogmine, left - 1);
  }
  bag.phase = 'aim';
  assert.equal(fire(bag, 0, 1), false);
  assert.equal(bag.ammo[0].mine, 3);
});

test('the classic land mine still arms on its own timer and blast', () => {
  const g = flat(200);
  g.weapon = 'mine';
  assert.equal(fire(g, 0, 1), true);
  assert.equal(g.ammo[0].mine, 2);
  const enemy = g.frogs[1];
  for (let i = 0; i < 50; i++) { enemy.x = g.mines[0].x + 10; enemy.y = g.mines[0].y; step(g); }
  assert.equal(enemy.hp, 100);
  for (let i = 0; i < 20 && g.mines.length; i++) { enemy.x = g.mines[0].x + 10; enemy.y = g.mines[0].y; step(g); }
  assert.ok(enemy.hp < 70, 'hp ' + enemy.hp);
  assert.equal(g.mines.length, 0);
});
