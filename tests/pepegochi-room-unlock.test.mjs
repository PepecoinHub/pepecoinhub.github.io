// The room grows with the frog (owner, 2026-11-28): four items unlock on life days 5, 10, 15 and 20.
import test from 'node:test';
import assert from 'node:assert/strict';
import { roomScene, UNLOCK_DAY, isLocked } from '../docs/games/js/pepegochi-room.mjs';
import { roomTargets, lockedLine } from '../docs/games/js/pepegochi-room-interactions.mjs';

const locked = sc => [...sc.items.filter(i => i.unlockDay).map(i => i.itemId), ...Object.entries(sc.fixed).filter(([, d]) => d).map(([id]) => id)].sort();

test('the unlock days are 5, 10, 15 and 20', () => {
  assert.deepEqual(Object.values(UNLOCK_DAY).sort((a, b) => a - b), [5, 10, 15, 20]);
});

test('items lock until their day, in a living frog room only', () => {
  assert.deepEqual(locked(roomScene({ mode: 'pet', day: 1 })), Object.keys(UNLOCK_DAY).sort());
  assert.deepEqual(locked(roomScene({ mode: 'pet', day: 5 })), ['chrome_rocking_horse', 'pepe_table_lamp', 'rubber_duck']);
  assert.deepEqual(locked(roomScene({ mode: 'pet', day: 14 })), ['chrome_rocking_horse', 'pepe_table_lamp']);
  assert.deepEqual(locked(roomScene({ mode: 'pet', day: 20 })), []);
  assert.deepEqual(locked(roomScene({ mode: 'pet' })), [], 'no day: nothing locked (local test page)');
  assert.deepEqual(locked(roomScene({ mode: 'departed', day: 1 })), []);
  assert.deepEqual(locked(roomScene({ mode: 'adopt', day: 1 })), []);
});

test('a golden lemon or a running watering streak keeps the lemon tree open', () => {
  assert.equal(locked(roomScene({ mode: 'pet', day: 2, golden: true })).includes('potted_plant'), false);
  assert.equal(locked(roomScene({ mode: 'pet', day: 2, keep: ['potted_plant'] })).includes('potted_plant'), false);
  assert.equal(isLocked('mug', 1), false);
});

test('locked items are still clickable and say when they open', () => {
  const t = roomTargets({ mode: 'pet', day: 8 }, true);
  assert.equal(t.find(x => x.id === 'rubber_duck').unlockDay, 10);
  assert.equal(t.find(x => x.id === 'chrome_rocking_horse').unlockDay, 20);
  assert.equal(t.find(x => x.id === 'potted_plant').unlockDay, undefined);
  assert.match(lockedLine('rubber_duck', 10, 8), /Unlocks on day 10 \(2 days to go\)\.$/);
  assert.match(lockedLine('pepe_table_lamp', 15, 14), /\(1 day to go\)\.$/);
});
