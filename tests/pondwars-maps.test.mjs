import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, MAPS, W, H, WATER, solid } from '../docs/games/js/pondwars-beta-engine.mjs';

function hash(mask) {
  let h = 2166136261;
  for (let i = 0; i < mask.length; i += 17) h = Math.imul(h ^ mask[i], 16777619);
  return h >>> 0;
}

const CLASSIC = {
  island: {
    1: [3074456714, '226,285 526,140 826,439 676,320 976,326 376,293'],
    2: [1204142147, '226,422 376,231 526,145 826,313 976,422 676,339'],
    7: [450390030, '826,314 676,359 226,379 526,341 376,113 976,388'],
    99: [617418681, '976,349 226,329 676,321 526,175 376,432 826,328'],
  },
  twin: {
    1: [1954527877, '208,271 796,341 304,330 892,290 400,334 994,254'],
    2: [1401766661, '208,288 796,332 304,341 892,273 400,320 994,261'],
    7: [3675250988, '208,297 796,274 304,254 892,333 400,288 994,329'],
    99: [882416027, '208,260 796,317 304,270 892,342 400,329 994,288'],
  },
  peaks: {
    1: [573555376, '226,264 526,140 826,139 676,312 976,249 376,139'],
    2: [3984622365, '226,264 376,139 526,145 826,139 976,249 676,312'],
    7: [2659474127, '826,139 676,312 226,264 526,300 376,113 976,249'],
    99: [3088794327, '976,249 226,264 676,312 526,175 376,139 826,139'],
  },
  small: {
    1: [2813772655, '658,358 544,304 772,348 430,364'],
    2: [953392180, '430,364 772,348 544,304 658,358'],
    7: [1847101402, '430,364 658,358 544,304 772,348'],
    99: [659023076, '430,364 772,348 544,304 658,358'],
  },
};

test('classic maps keep their terrain and spawn spots', () => {
  for (const [map, seeds] of Object.entries(CLASSIC)) {
    for (const [seed, [wantHash, wantSpawns]] of Object.entries(seeds)) {
      const g = newGame({ seed: Number(seed), map, perTeam: map === 'small' ? 2 : 3, cpu: [false, false] });
      assert.equal(hash(g.mask), wantHash, map + ' ' + seed);
      assert.equal(g.frogs.map(f => Math.round(f.x) + ',' + Math.round(f.y)).join(' '), wantSpawns, map + ' ' + seed);
    }
  }
  assert.equal(newGame({ map: 'nope' }).map, 'island');
});

test('map pack 1 spawns every frog on safe ground above the water', () => {
  for (const map of ['moon', 'doom', 'farm', 'quarry', 'tower']) {
    assert.ok(MAPS[map].pack === 'maps1' || MAPS[map].pack === 'maps2');
    for (let seed = 1; seed <= 25; seed++) {
      const g = newGame({ seed, map, perTeam: MAPS[map].max, cpu: [false, false] });
      assert.equal(g.frogs.length, MAPS[map].max * 2, map);
      for (const f of g.frogs) {
        assert.ok(f.y > 80 && f.y < 470, map + ' y ' + f.y);
        assert.ok(f.y < WATER - 20, map);
        assert.equal(solid(g.mask, f.x, f.y + 1), true, map + ' footing');
        assert.equal(solid(g.mask, f.x, f.y), false, map + ' headroom');
      }
      for (let i = 0; i < g.frogs.length; i++) {
        for (let j = i + 1; j < g.frogs.length; j++) {
          assert.ok(Math.abs(g.frogs[i].x - g.frogs[j].x) >= 58, map + ' spacing');
        }
      }
    }
  }
});

test('Moon Base keeps a floating pad and a central bowl', () => {
  const g = newGame({ seed: 1, map: 'moon', perTeam: 2, cpu: [false, false] });
  assert.equal(solid(g.mask, 600, 190), true);
  assert.equal(solid(g.mask, 600, 250), false);
  assert.equal(solid(g.mask, 600, 520), true);
  assert.equal(solid(g.mask, 440, 400), false);
});

test('Pond of Doom is three islands and Doge Farm has a center gap', () => {
  const doom = newGame({ seed: 4, map: 'doom', perTeam: 2, cpu: [false, false] });
  assert.equal(solid(doom.mask, 200, 400), true);
  assert.equal(solid(doom.mask, 400, 400), false);
  assert.equal(solid(doom.mask, 600, 430), true);
  assert.equal(solid(doom.mask, 990, 380), true);
  const farm = newGame({ seed: 4, map: 'farm', perTeam: 2, cpu: [false, false] });
  assert.equal(solid(farm.mask, 200, 420), true);
  assert.equal(solid(farm.mask, 600, 420), false);
  assert.equal(solid(farm.mask, 900, 420), true);
  assert.ok(farm.frogs.filter(f => f.team === 0).every(f => f.x < 560));
  assert.ok(farm.frogs.filter(f => f.team === 1).every(f => f.x > 640));
  assert.ok(W > 0 && H > WATER);
});

test('Lite Quarry is terraced and Bell Tower is a column between islands', () => {
  const quarry = newGame({ seed: 1, map: 'quarry', perTeam: 2, cpu: [false, false] });
  const top = x => { let y = 0; while (y < H && !solid(quarry.mask, x, y)) y++; return y; };
  const a = top(200), b = top(480), c = top(750);
  assert.ok(b - a > 40 && c - b > 40, 'terrace steps ' + [a, b, c]);
  assert.equal(solid(quarry.mask, 920, 300), false);
  const tower = newGame({ seed: 1, map: 'tower', perTeam: 2, cpu: [false, false] });
  assert.equal(solid(tower.mask, 600, 250), true);
  assert.equal(solid(tower.mask, 600, 160), false);
  assert.equal(solid(tower.mask, 180, 430), true);
  assert.equal(solid(tower.mask, 400, 400), false);
  assert.equal(solid(tower.mask, 1020, 430), true);
  assert.equal(solid(tower.mask, 800, 400), false);
  assert.equal(MAPS.quarry.pack, 'maps2');
  assert.equal(MAPS.tower.pack, 'maps2');
});
