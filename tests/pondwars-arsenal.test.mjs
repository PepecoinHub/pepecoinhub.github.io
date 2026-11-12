import test from 'node:test';
import assert from 'node:assert/strict';
import { EXPANSION, SCALE, GUIDE, CLASSIC_AMMO, PACKS, hudWeapons, normalizePacks, starterAmmo, packEnabled } from '../docs/games/js/pondwars-arsenal.mjs';
import { WEAPONS, newGame, startTurn, fire, cpuPlan, me } from '../docs/games/js/pondwars-beta-engine.mjs';
import { act } from '../docs/games/js/pondwars-beta-net.mjs';

const CLASSIC = {
  grenade: { damage: 46, radius: 30, fuse: 3, ammo: Infinity },
  rocket: { damage: 42, radius: 27, ammo: Infinity },
  cluster: { damage: 28, ammo: 4, children: 5 },
  gold: { damage: 68, radius: 58, ammo: 1, children: 5 },
  bat: { damage: 32, radius: 0, ammo: Infinity },
  mine: { damage: 50, radius: 40, ammo: 3 },
  dynamite: { damage: 70, radius: 48, ammo: 2 },
  revolver: { damage: 25, ammo: Infinity },
  bow: { damage: 35, ammo: Infinity },
  candles: { damage: 26, ammo: 1 },
  drill: { damage: 44, ammo: 2 },
  rope: { ammo: 5, utility: true },
  jetpack: { ammo: 2, utility: true },
  teleport: { ammo: 2, utility: true },
};

test('expansion weapons are registered with the approved balance', () => {
  assert.deepEqual(Object.keys(EXPANSION), ['goldv2', 'bell', 'frogmine', 'moon', 'ban', 'rain', 'pep', 'doge', 'donkey']);
  assert.equal(EXPANSION.goldv2.damage, 58);
  assert.equal(EXPANSION.goldv2.ammo, 1);
  assert.equal(EXPANSION.goldv2.crater, SCALE.crater.verySmall);
  assert.equal(EXPANSION.goldv2.knock, SCALE.knock.veryHigh);
  assert.equal(EXPANSION.goldv2.children, undefined);
  assert.ok(EXPANSION.goldv2.knockVx > 440, 'the kick shoves harder than the baseball bat');
  assert.ok(EXPANSION.goldv2.range > 48 && EXPANSION.goldv2.range < 90);

  assert.equal(EXPANSION.bell.damage, 44);
  assert.equal(EXPANSION.bell.fuse, 3);
  assert.equal(EXPANSION.bell.radius, SCALE.crater.medium);
  assert.equal(EXPANSION.bell.crater, SCALE.crater.medium);
  assert.equal(EXPANSION.bell.ammo, Infinity);
  assert.equal(EXPANSION.bell.children, undefined);
  assert.equal(EXPANSION.bell.bell, true);

  assert.equal(EXPANSION.frogmine.damage, 34);
  assert.equal(EXPANSION.frogmine.arm, 1);
  assert.equal(EXPANSION.frogmine.crater, SCALE.crater.small);
  assert.equal(EXPANSION.frogmine.knock, SCALE.knock.medium);
  assert.equal(EXPANSION.frogmine.ammo, 3);

  assert.equal(EXPANSION.moon.damage, 52);
  assert.equal(EXPANSION.moon.wind, true);
  assert.equal(EXPANSION.moon.radius, SCALE.crater.mediumLarge);
  assert.equal(EXPANSION.moon.knock, SCALE.knock.high);
  assert.equal(EXPANSION.moon.ammo, 2);

  assert.equal(EXPANSION.ban.damage, 42);
  assert.equal(EXPANSION.ban.range, 48);
  assert.equal(EXPANSION.ban.crater, SCALE.crater.none);
  assert.equal(EXPANSION.ban.knock, SCALE.knock.extreme);
  assert.ok(EXPANSION.ban.knockVx > EXPANSION.goldv2.knockVx);
  assert.equal(EXPANSION.ban.ammo, 2);

  assert.equal(EXPANSION.rain.ammo, 1);
  assert.equal(EXPANSION.rain.count, 6);
  assert.ok(EXPANSION.rain.count >= 5 && EXPANSION.rain.count <= 7);
  assert.equal(EXPANSION.rain.pellet, 8);
  assert.equal(EXPANSION.pep.damage, 8);
  assert.ok(EXPANSION.rain.damage >= 40 && EXPANSION.rain.damage <= 48);
  assert.equal(EXPANSION.rain.count * EXPANSION.pep.damage, 48);
  assert.equal(EXPANSION.pep.child, true);

  assert.equal(EXPANSION.doge.damage, 46);
  assert.equal(EXPANSION.doge.radius, SCALE.crater.medium);
  assert.equal(EXPANSION.doge.lifetime, GUIDE.lifetime);
  assert.equal(GUIDE.lifetime, 4.5);
  assert.ok(GUIDE.lag < 4, 'velocity lags the heading');
  assert.equal(EXPANSION.doge.ammo, 1);

  assert.equal(EXPANSION.donkey.damage, 78);
  assert.equal(EXPANSION.donkey.radius, SCALE.crater.large);
  assert.equal(EXPANSION.donkey.crater, SCALE.crater.veryLarge);
  assert.ok(EXPANSION.donkey.crater > EXPANSION.donkey.radius);
  assert.equal(EXPANSION.donkey.knock, SCALE.knock.high);
  assert.equal(EXPANSION.donkey.ammo, 1);
  assert.ok(EXPANSION.donkey.warn >= 0.8 && EXPANSION.donkey.warn <= 1.5);
});

test('every expansion weapon has a HUD name, blurb and a unique hotkey', () => {
  const keys = new Set();
  for (const [id, w] of Object.entries(EXPANSION)) {
    assert.equal(WEAPONS[id], w);
    assert.ok(w.name && w.hud || w.child);
    if (w.child) continue;
    assert.ok(w.short && w.key && w.code && w.fireLabel);
    assert.ok(!keys.has(w.code), w.code);
    keys.add(w.code);
    assert.equal(w.ready, w.pack === 'simple', id + (w.pack === 'simple' ? ' is playable' : ' stays scaffolded'));
  }
  assert.equal(keys.size, 8);
});

test('a normal match keeps the classic loadout and refuses expansion weapons', () => {
  const g = newGame({ seed: 4, perTeam: 2, cpu: [false, false] });
  assert.deepEqual(g.packs, {});
  assert.deepEqual(g.ammo[0], CLASSIC_AMMO);
  assert.deepEqual(g.ammo[1], CLASSIC_AMMO);
  assert.equal(packEnabled(g.packs, 'goldv2'), false);
  startTurn(g);
  g.weapon = 'goldv2';
  assert.equal(fire(g, 0, 1), false);
  assert.equal(g.phase, 'aim');
  assert.equal(g.shots.length, 0);
  assert.equal(act(g, { t: 'weapon', w: 'bell' }), false);
  assert.equal(g.weapon, 'goldv2');
});

test('enabling a pack grants its ammo and still does not fire scaffold weapons', () => {
  assert.deepEqual(normalizePacks('simple,nope'), { simple: true });
  assert.deepEqual(normalizePacks('all'), { simple: true, pepecoin: true, advanced: true });
  const g = newGame({ seed: 4, perTeam: 2, cpu: [false, false], packs: 'simple' });
  assert.equal(g.ammo[0].goldv2, 1);
  assert.equal(g.ammo[0].frogmine, 3);
  assert.equal('bell' in g.ammo[0], false);
  assert.equal(g.ammo[0].moon, undefined);
  assert.deepEqual(hudWeapons('simple').map(w => w.id), ['goldv2', 'bell', 'frogmine']);
  assert.deepEqual(hudWeapons({ pepecoin: true, advanced: 1 }).map(w => w.id), ['moon', 'ban', 'rain', 'doge', 'donkey']);
  startTurn(g);
  assert.equal(act(g, { t: 'weapon', w: 'bell' }), true);
  assert.equal(g.weapon, 'bell');
  assert.equal(act(g, { t: 'weapon', w: 'moon' }), false);
  assert.equal(g.weapon, 'bell');
  g.weapon = 'grenade';
  assert.equal(act(g, { t: 'weapon', w: 'grenade' }), true);
});

test('classic weapon stats and the CPU shortlist stay put when every pack is on', () => {
  for (const [id, expect] of Object.entries(CLASSIC)) {
    for (const [key, value] of Object.entries(expect)) assert.equal(WEAPONS[id][key], value, id + '.' + key);
    assert.equal(WEAPONS[id].expansion, undefined);
  }
  const g = newGame({ seed: 3, perTeam: 2, cpu: [false, false], packs: 'all' });
  startTurn(g);
  const plan = cpuPlan(g);
  assert.ok(['rocket', 'grenade', 'cluster', 'gold', 'bow', 'revolver', 'bat', 'dynamite'].includes(plan.weapon));
  assert.equal(PACKS.length, 3);
  const f = me(g);
  g.weapon = 'grenade';
  assert.equal(fire(g, -0.8, 0.6), true);
  assert.equal(g.shots[0].type, 'grenade');
  assert.equal(g.shots[0].owner, f.id);
  assert.equal(g.ammo[0].gold, 1);
  assert.equal(g.ammo[0].goldv2, 1);
  assert.equal(g.ammo[0].moon, 2);
  assert.equal(g.ammo[0].ban, 2);
  assert.equal(g.ammo[0].rain, 1);
  assert.equal(g.ammo[0].doge, 1);
  assert.equal(g.ammo[0].donkey, 1);
});
