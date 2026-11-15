// PepeGochi Room-4 (games/supabase/update_pepegochi_room_departure.sql) on a disposable local PostgreSQL:
// the frog takes one random placed starter item when it moves out, chosen and stored by the server.
//   PASSPORT_PG_URL=postgres://postgres:pw@localhost:5432/postgres PASSPORT_PG_MODULE=/abs/pg/lib/index.js \
//   node --test tests/pepegochi-room-departure-sql.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepare, addPlayer, callRpc, asDb, uid, START } from '../scripts/pepegochi_sim.mjs';

const URI = process.env.PASSPORT_PG_URL, MOD = process.env.PASSPORT_PG_MODULE;
const read = p => readFile(new URL('../games/supabase/' + p, import.meta.url), 'utf8');
const at = h => new Date(+new Date(START) + h * 36e5);
const STARTERS = ['crt_tv', 'lava_lamp', 'mug', 'p_poster', 'potted_plant', 'rubber_duck'];

test('Room-4: one random placed starter item leaves with the frog; stored once, nothing deleted',
  { skip: !(URI && MOD) && 'set PASSPORT_PG_URL and PASSPORT_PG_MODULE', timeout: 300000 }, async t => {
  const pg = (await import(MOD)).default;
  const admin = new pg.Client({ connectionString: URI });
  await admin.connect();
  const name = 'pepegochi_room4_test_' + process.pid + '_' + Date.now();
  await admin.query('create database ' + name);
  const url = new URL(URI); url.pathname = '/' + name;
  const raw = new pg.Client({ connectionString: url.toString() });
  await raw.connect();
  const db = asDb(raw);
  const rows = async (q, a = []) => (await db.query(q, a)).rows;
  const call = (user, fn, h, role) => callRpc(db, { user, now: at(h), role }, 'public.' + fn);
  const ok = async (...a) => { const r = await call(...a); assert.ok(r.ok, r.error); return r.value; };
  const variant = async n => (await rows('select letter_variant v from games.pepegochi_lives where user_id = $1 order by generation desc limit 1', [uid(n)]))[0].v;
  const owned = async n => (await rows(`select c.item_id, p.slot_id from games.pepegochi_room_inventory i
      join games.pepegochi_room_catalog c on c.item_id = i.item_id
      left join games.pepegochi_room_placements p on p.item_instance_id = i.item_instance_id
      where i.user_id = $1 order by 1`, [uid(n)])).map(r => r.item_id + '@' + (r.slot_id || '-'));
  // adopt at 0 h, hatch with a first care at 1 h, open the room; nobody cares after that, so the frog leaves at 168 h
  const life = async (n, { room = true } = {}) => {
    await addPlayer(db, n);
    await ok(n, "gry_pepegochi_adopt('Fren')", 0);
    await ok(n, "gry_pepegochi_action('feed')", 1);
    if (room) await ok(n, 'gry_pepegochi_room_initialize()', 1);
  };
  try {
    await prepare(db);
    for (const f of ['update_pepegochi_room_v1.sql', 'update_pepegochi_room_departure.sql']) await db.exec(await read(f));

    await t.test('the move-out is written once, with a placed starter item; later calls never change it', async () => {
      await life(1);
      const before = await owned(1);
      const s = await ok(1, 'gry_pepegochi_state()', 200);
      assert.equal(s.pet.status, 'departed');
      assert.equal(s.pet.departure_saved, false, 'the read-only state writes nothing');
      assert.equal(await variant(1), null);
      const v = await ok(1, 'gry_pepegochi_settle()', 200);
      assert.equal(v.pet.departure_saved, true);
      const took = await variant(1);
      assert.match(took, /^took_(crt_tv|lava_lamp|mug|p_poster|potted_plant|rubber_duck)$/);
      assert.equal(v.pet.letter.variant, took, 'the browser sees the same item');
      await ok(1, 'gry_pepegochi_settle()', 201);
      await ok(1, 'gry_pepegochi_letter_read()', 202);
      await ok(1, 'gry_pepegochi_state()', 203);
      assert.equal(await variant(1), took, 'the same on every call');
      assert.deepEqual(await owned(1), before, 'nothing deleted, nothing moved');
    });

    await t.test('reading the letter, or adopting, also writes the pick when the window did not settle first', async () => {
      await life(2);
      await ok(2, 'gry_pepegochi_letter_read()', 200);
      assert.match(await variant(2), /^took_/);
      await life(3);
      const a = await ok(3, "gry_pepegochi_adopt('Fren II')", 200);
      assert.equal(a.adopt_result, 'read_the_letter_first');
      assert.match(await variant(3), /^took_/);
    });

    await t.test('random: different frogs take different things', async () => {
      const seen = new Set();
      for (let n = 10; n < 26; n++) { await life(n); await ok(n, 'gry_pepegochi_settle()', 200); seen.add(await variant(n)); }
      assert.ok(seen.size >= 3, 'picked: ' + [...seen].join(', '));
    });

    await t.test('earned decorations are never taken; an empty or unopened room: took_nothing', async () => {
      await life(4);
      // put every starter away and place an earned decoration (as the rewards file would grant it)
      await db.query(`delete from games.pepegochi_room_placements where user_id = $1`, [uid(4)]);
      const inst = (await rows(`insert into games.pepegochi_room_inventory (user_id, item_id, source_key)
        values ($1, 'moon_rock', 'stamp:moonwalker') returning item_instance_id`, [uid(4)]))[0].item_instance_id;
      await db.query(`insert into games.pepegochi_room_placements (user_id, slot_id, item_instance_id) values ($1, 'shelf_a', $2)`, [uid(4), inst]);
      await ok(4, 'gry_pepegochi_settle()', 200);
      assert.equal(await variant(4), 'took_nothing');
      await life(5, { room: false });
      await ok(5, 'gry_pepegochi_settle()', 200);
      assert.equal(await variant(5), 'took_nothing');
    });

    await t.test('a frog still at home: settle changes nothing', async () => {
      await life(6);
      const v = await ok(6, 'gry_pepegochi_settle()', 10);
      assert.notEqual(v.pet.status, 'departed');
      assert.equal(await variant(6), null);
    });

    await t.test('Discord only; the helpers are closed to the browser', async () => {
      assert.ok(!(await call(null, 'gry_pepegochi_settle()', 1, 'anon')).ok);
      await addPlayer(db, 9, { provider: 'email' });
      assert.match((await call(9, 'gry_pepegochi_settle()', 1)).error, /Discord sign-in required/);
      for (const f of ['games.pepegochi_pick_taken(uuid)', 'games.pepegochi_departure_pick()'])
        for (const role of ['anon', 'authenticated'])
          assert.equal((await rows('select has_function_privilege($1, $2, \'execute\') v', [role, f]))[0].v, false, role + ' ' + f);
      await db.exec(await read('update_pepegochi_room_departure.sql'));   // safe to run again
      assert.match(await variant(1), /^took_/);
    });
  } finally {
    await raw.end();
    await admin.query('drop database if exists ' + name + ' with (force)');
    await admin.end();
  }
});
