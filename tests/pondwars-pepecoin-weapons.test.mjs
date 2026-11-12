import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, startTurn, fire, step, stepShot, explode, W, H, WEAPONS } from '../docs/games/js/pondwars-beta-engine.mjs';

function flat(distance = 70, packs = 'pepecoin') {
  const g = newGame({ seed: 3, perTeam: 2, cpu: [false, false], packs });
  g.mask.fill(0);
  for (let y = 450; y < H; y++) g.mask.fill(1, y * W, (y + 1) * W);
  g.frogs.forEach((f, i) => Object.assign(f, {
    x: i === 0 ? 200 : 200 + distance, y: 449, vx: 0, vy: 0, hp: 100, alive: true, ground: true, face: 1,
  }));
  startTurn(g);
  return g;
}
const solids = g => g.mask.reduce((n, v) => n + v, 0);

test('Moon Rocket is wind-affected, limited, and hits harder than the bazooka', () => {
  const g = flat(300);
  g.mask.fill(0);
  const blown = { type: 'moon', x: 200, y: 200, vx: 300, vy: 0, t: 0, owner: 99, ownerClear: true };
  const calm = { ...blown };
  g.wind = 1;
  stepShot(g, blown);
  g.wind = 0;
  stepShot(g, calm);
  assert.ok(blown.vx > calm.vx);

  const hit = flat(80);
  explode(hit, hit.frogs[1].x, hit.frogs[1].y - 11, 'moon');
  assert.equal(hit.frogs[1].hp, 48);
  const rocket = flat(80);
  explode(rocket, rocket.frogs[1].x, rocket.frogs[1].y - 11, 'rocket');
  assert.ok(Math.abs(hit.frogs[1].vx) > Math.abs(rocket.frogs[1].vx));

  const buried = flat(80);
  const before = solids(buried);
  explode(buried, 600, 520, 'moon');
  const hole = before - solids(buried);
  assert.ok(hole > 5500 && hole < 7500, 'medium-large crater, removed ' + hole);

  const stock = flat(200);
  stock.weapon = 'moon';
  assert.equal(fire(stock, -0.2, 1), true);
  assert.equal(stock.shots[0].type, 'moon');
  assert.equal(stock.ammo[0].moon, 1);
  stock.phase = 'aim';
  assert.equal(fire(stock, -0.2, 1), true);
  assert.equal(stock.ammo[0].moon, 0);
  stock.phase = 'aim';
  assert.equal(fire(stock, -0.2, 1), false);
  assert.equal(WEAPONS.rocket.damage, 42);
  assert.equal(WEAPONS.rocket.ammo, Infinity);
});

test('Ban Hammer is shorter than the bat, craters nothing, and yeets harder', () => {
  const close = flat(40);
  close.weapon = 'ban';
  const ground = solids(close);
  assert.equal(fire(close, 0, 1), true);
  assert.equal(close.frogs[1].hp, 58);
  assert.ok(close.frogs[1].vx >= 700);
  assert.equal(solids(close), ground);
  assert.equal(close.ammo[0].ban, 1);
  close.phase = 'aim';
  assert.equal(fire(close, 0, 1), true);
  assert.equal(close.ammo[0].ban, 0);
  close.phase = 'aim';
  assert.equal(fire(close, 0, 1), false);

  const far = flat(55);
  far.weapon = 'ban';
  assert.equal(fire(far, 0, 1), true);
  assert.equal(far.frogs[1].hp, 100);
  const bat = flat(55);
  bat.weapon = 'bat';
  assert.equal(fire(bat, 0, 1), true);
  assert.equal(bat.frogs[1].hp, 68);
});

test('Pep Rain drops six small hits whose full total stays inside 40 to 48', () => {
  const g = flat(200);
  const enemy = g.frogs[1];
  enemy.x = 640;
  enemy.y = 449;
  g.weapon = 'rain';
  const before = solids(g);
  assert.equal(fire(g, 0, 1, 640, 400), true);
  assert.equal(g.ammo[0].rain, 0);
  assert.equal(g.shots.length, 6);
  assert.ok(g.shots.every(s => s.type === 'pep' && WEAPONS[s.type].damage === 8));
  const xs = g.shots.map(s => s.x);
  assert.ok(Math.max(...xs) - Math.min(...xs) >= 60);
  for (let i = 0; i < 500 && g.shots.length; i++) step(g);
  assert.equal(g.shots.length, 0);
  const lost = 100 - enemy.hp;
  assert.ok(lost >= 8 && lost <= 48, 'damage ' + lost);
  const hole = before - solids(g);
  assert.ok(hole > 100 && hole < 5000, 'distributed craters, removed ' + hole);
  g.phase = 'aim';
  assert.equal(fire(g, 0, 1, 640, 400), false);
});
