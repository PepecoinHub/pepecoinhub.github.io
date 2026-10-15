import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_CHARGES, cellLabel, configFor, placeFleet, regen } from '../src/shared/game.js';

test('board grows with the community', () => {
  assert.equal(configFor(300).size, 8);
  assert.equal(configFor(20_000).size, 10);
  assert.equal(configFor(200_000).size, 12);
  assert.equal(configFor(5_000_000).size, 16);
  assert.equal(configFor(300, 12).size, 12, 'mod override wins');
  assert.equal(configFor(300, 7).size, 8, 'unknown override is ignored');
});

test('fleet placement is valid and deterministic', () => {
  for (const subs of [100, 10_000, 100_000, 10_000_000]) {
    const cfg = configFor(subs);
    for (let seed = 1; seed <= 200; seed++) {
      const ships = placeFleet(cfg, seed);
      assert.equal(ships.length, cfg.ships.length);
      const all = ships.flatMap((s) => s.cells);
      assert.equal(new Set(all).size, all.length, 'no overlap');
      for (const s of ships) {
        assert.equal(s.cells.length, s.len);
        assert.ok(s.cells.every((c) => c >= 0 && c < cfg.size ** 2));
        const xs = s.cells.map((c) => c % cfg.size);
        const ys = s.cells.map((c) => Math.floor(c / cfg.size));
        const straight = new Set(xs).size === 1 || new Set(ys).size === 1;
        assert.ok(straight, 'ship is a straight line');
        // contiguous and not wrapping around a row end
        const span = Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys) + 1;
        assert.equal(span, s.len);
      }
    }
  }
  assert.deepEqual(placeFleet(configFor(100), 42), placeFleet(configFor(100), 42));
});

test('cell labels', () => {
  assert.equal(cellLabel(0, 10), 'A1');
  assert.equal(cellLabel(9, 10), 'J1');
  assert.equal(cellLabel(10, 10), 'A2');
});

test('shots come back one per interval, capped', () => {
  const cfg = configFor(100); // 60 s
  assert.deepEqual(regen(undefined, 5000, cfg), { c: MAX_CHARGES, t: 5000, nextAt: null });
  const spent = { c: 0, t: 1_000_000 };
  assert.equal(regen(spent, 1_000_000 + 30_000, cfg).c, 0);
  assert.equal(regen(spent, 1_000_000 + 30_000, cfg).nextAt, 1_000_000 + 60_000);
  assert.equal(regen(spent, 1_000_000 + 60_000, cfg).c, 1);
  assert.equal(regen(spent, 1_000_000 + 150_000, cfg).c, 2);
  assert.equal(regen(spent, 1_000_000 + 150_000, cfg).nextAt, 1_000_000 + 180_000);
  const full = regen(spent, 1_000_000 + 10 * 60_000, cfg);
  assert.equal(full.c, MAX_CHARGES);
  assert.equal(full.nextAt, null);
});
