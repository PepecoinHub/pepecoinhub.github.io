// The PEPEGOCHI.EXE window draws the room with the same slot and item IDs as the room SQL (Room-2),
// and only with the layered art files that are in the repo. Runs in CI without a database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { SLOTS, ITEMS, STARTER_ROOM, BACKGROUND, FROG, roomScene } from '../docs/games/js/pepegochi-room.mjs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const sql = read('games/supabase/update_pepegochi_room_v1.sql');

test('slots: same IDs and anchors as games.pepegochi_room_slots', () => {
  const rows = [...sql.matchAll(/\('([a-z_]+)','[^']*',(\d+),(\d+),(\d+),array\[/g)].map(m => [m[1], +m[2], +m[3], +m[4]]);
  assert.equal(rows.length, 11);
  assert.deepEqual(Object.keys(SLOTS).sort(), rows.map(r => r[0]).sort());
  for (const [id, x, y, z] of rows) assert.deepEqual([SLOTS[id].x, SLOTS[id].y, SLOTS[id].z], [x, y, z], id);
});

test('starter props: same items in the same slots as the room SQL catalog', () => {
  const starters = [...sql.matchAll(/\('([a-z_]+)','[^']*','[a-z]+','[a-z_]+',(?:true|false),true,'([a-z_]+)'\)/g)];
  assert.equal(starters.length, 6);
  assert.deepEqual(Object.fromEntries(starters.map(m => [m[2], m[1]])), STARTER_ROOM);
  for (const id of Object.values(STARTER_ROOM)) assert.ok(ITEMS[id], id);
});

test('every sprite the window draws exists as a file in docs/games', () => {
  const files = [BACKGROUND, FROG, ...roomScene().items.map(i => i.src)];
  for (const f of files) assert.ok(existsSync(new URL('../docs/games/' + f, import.meta.url)), f);
});

test('scene: frog and bubble by status, smaller young frog, empty room with a letter after moving out', () => {
  const h = roomScene({ status: 'healthy', stage: 'adult' });
  assert.equal(h.items.length, 6); assert.equal(h.frog.bubble, ''); assert.equal(h.letter, false);
  assert.match(roomScene({ status: 'packing' }).frog.bubble, /Packing/);
  assert.match(roomScene({ status: 'neglected' }).frog.bubble, /miss you/);
  assert.ok(roomScene({ stage: 'tadpole' }).frog.width < h.frog.width);
  const d = roomScene({ departed: true });
  assert.equal(d.frog, null); assert.equal(d.letter, true); assert.equal(d.items.length, 6);
});

test('the room module draws only: no network, storage or Supabase', () => {
  const src = read('docs/games/js/pepegochi-room.mjs').replace(/\/\/[^\n]*/g, '');
  for (const bad of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'localStorage', 'sessionStorage', 'supabase', 'passport'])
    assert.ok(!src.toLowerCase().includes(bad.toLowerCase()), bad);
});
