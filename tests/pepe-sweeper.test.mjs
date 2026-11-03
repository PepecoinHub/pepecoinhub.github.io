import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, newGame, neighbors, placeMines, reveal, toggleFlag, chord } from '../docs/games/js/pepe-sweeper-engine.mjs';

test('all three difficulties fit the requested mine counts and protect first click plus neighbors', () => {
  for (const level of Object.keys(LEVELS)) {
    const g = newGame(level), first = Math.floor(g.cells.length / 2);
    assert.equal(reveal(g, first, () => .32), true);
    assert.equal(g.cells.filter(c => c.mine).length, g.mines);
    assert.equal(g.cells[first].open, true);
    for (const i of [first, ...neighbors(g, first)]) assert.equal(g.cells[i].mine, false);
  }
});

test('a seeded layout has valid adjacent counts even at edges', () => {
  const g = newGame('easy'); placeMines(g, 0, () => .5);
  for (let i = 0; i < g.cells.length; i++) {
    assert.equal(g.cells[i].nearby, neighbors(g, i).filter(n => g.cells[n].mine).length);
  }
});

test('flags block opening, can be removed, and do not use mine count as a cap', () => {
  const g = newGame('easy');
  assert.equal(toggleFlag(g, 0), true);
  assert.equal(reveal(g, 0), false);
  assert.equal(g.flags, 1);
  toggleFlag(g, 0);
  assert.equal(reveal(g, 0, () => .1), true);
  assert.equal(g.flags, 0);
  assert.equal(toggleFlag(g, 0), false);
});

test('zero flood opens neighbors; opening every safe cell wins and flags remaining mines', () => {
  const g = newGame('easy'); reveal(g, 40, () => .999);
  assert.ok(g.opened > 1);
  for (let i = 0; i < g.cells.length; i++) if (!g.cells[i].mine) reveal(g, i);
  assert.equal(g.status, 'won');
  assert.equal(g.flags, g.mines);
  assert.equal(g.opened, g.cells.length - g.mines);
  assert.equal(toggleFlag(g, 0), false);
});

test('a wrong guess loses and marks the exploded Pepe', () => {
  const g = newGame('medium'); reveal(g, 0, () => .5);
  const i = g.cells.findIndex(c => c.mine);
  assert.equal(reveal(g, i), true);
  assert.equal(g.status, 'lost');
  assert.equal(g.cells[i].exploded, true);
  assert.equal(reveal(g, 1), false);
});

test('chording requires the exact number of flags and reveals adjacent safe cells', () => {
  const g = newGame('easy'); placeMines(g, 40, () => .5);
  const target = g.cells.findIndex((c, i) => !c.mine && c.nearby && neighbors(g, i).some(n => !g.cells[n].mine));
  assert.ok(target >= 0);
  reveal(g, target);
  assert.equal(chord(g, target), false);
  for (const n of neighbors(g, target)) if (g.cells[n].mine) toggleFlag(g, n);
  const before = g.opened;
  assert.equal(chord(g, target), true);
  assert.ok(g.opened > before);
});
