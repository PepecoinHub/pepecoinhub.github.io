// Optional PostgreSQL test for games/supabase/update_leaders_passports.sql: the LEADERS top 10s carry a player's id
// (to open their Fren Passport) only for Discord players, and only when the one asking is logged on with Discord.
//   PASSPORT_PG_URL=postgres://postgres@localhost:5432/postgres \
//   PASSPORT_PG_MODULE=/abs/path/node_modules/pg/lib/index.js \
//   node --test tests/leaders-passports-sql.test.mjs
// It creates and drops its own database. Never point it at Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SKIP, pondDb, caller, addUser } from './pond-sql-setup.mjs';

test('LEADERS: ids for Discord frens only', { skip: SKIP, timeout: 120000 }, async () => {
  const { db, drop } = await pondDb('leaders', ['update_arcade.sql', 'update_miner_cloud.sql', 'update_miner_top.sql',
    'update_yeet.sql', 'update_yeet_guests.sql']);
  try {
    // gry_wp_top needs the whole Pepe Guesser schema: here it is only created (bodies checked on Supabase)
    await db.query('set check_function_bodies = off');
    await db.query(await readFile(new URL('../games/supabase/update_leaders_passports.sql', import.meta.url), 'utf8'));
    await db.query('set check_function_bodies = on');
    const call = caller(db);
    const fren = await addUser(db, 1, 'FrogKing'), other = await addUser(db, 2, 'MinerFren'), guest = await addUser(db, 3);
    await db.query("insert into games.arcade_scores (game, user_id, nick, score, verified, duration_ms) values ('fud', $1, 'MinerFren', 900, true, 60000), ('fud', null, 'GuestFrog', 800, false, 60000)", [other]);
    await db.query("insert into games.miner_saves (user_id, data, all_time, updated_at) values ($1, '{}', 50000, now())", [other]);
    await db.query("insert into games.yeet_records (user_id, nick, best, duration_ms, achieved_at) values ($1, 'MinerFren', 4000, 5000, now())", [other]);

    const arcade = who => call(who, "select public.gry_arcade_top('fud') as v");
    const miner = who => call(who, 'select public.gry_miner_top() as v');
    const yeet = who => call(who, 'select public.gry_yeet_state() as v');

    // a Discord fren sees the Discord player's id, never one for a guest row
    const a = await arcade({ user: fren });
    assert.equal(a[0].nick, 'MinerFren'); assert.equal(a[0].id, other);
    assert.equal(a[1].nick, 'GuestFrog'); assert.equal(a[1].id, undefined);
    assert.equal((await miner({ user: fren }))[0].id, other);
    assert.equal((await yeet({ user: fren })).top[0].id, other);
    // anonymous visitors and signed-in guests (no Discord) get no ids at all
    for (const w of [null, { user: guest }]) {
      assert.ok((await arcade(w)).every(r => !('id' in r)));
      assert.ok((await miner(w)).every(r => !('id' in r)));
      assert.ok((await yeet(w)).top.every(r => !('id' in r)));
    }
    // the rest of the row is as before
    assert.deepEqual(Object.keys((await arcade(null))[0]).sort(), ['at', 'nick', 'score', 'verified']);
  } finally { await drop(); }
});
