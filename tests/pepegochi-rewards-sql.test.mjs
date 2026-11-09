// PepeGochi room rewards + Pond Decorator (games/supabase/update_pepegochi_rewards.sql) on a disposable local
// PostgreSQL, installed in the launch order on top of the Passport, PepeGochi v2, its Passport bridge and Room-2.
//   PASSPORT_PG_URL=postgres://postgres:pw@localhost:5432/postgres PASSPORT_PG_MODULE=/abs/pg/lib/index.js \
//   node --test tests/pepegochi-rewards-sql.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepare, addPlayer, callRpc, asDb, uid, START } from '../scripts/pepegochi_sim.mjs';

const URI = process.env.PASSPORT_PG_URL, MOD = process.env.PASSPORT_PG_MODULE;
const read = p => readFile(new URL('../games/supabase/' + p, import.meta.url), 'utf8');
const PASSPORT = ['update_yeet.sql', 'update_wheres_pepe.sql', 'update_wheres_pepe_guests.sql', 'update_lobby_chat.sql',
  'update_open_chat.sql', 'update_lobby_mentions.sql', 'update_frog_letters.sql', 'update_letters_community.sql',
  'update_miner_cloud.sql', 'update_fren_passport.sql', 'update_fren_avatar.sql', 'update_passport_awards.sql'];
const at = (h = 0) => new Date(+new Date(START) + h * 36e5);

test('PepeGochi room rewards: decorations from stamps, Pond Decorator for 3 placed',
  { skip: !(URI && MOD) && 'set PASSPORT_PG_URL and PASSPORT_PG_MODULE', timeout: 300000 }, async t => {
  const pg = (await import(MOD)).default;
  const admin = new pg.Client({ connectionString: URI });
  await admin.connect();
  const name = 'pepegochi_rewards_test_' + process.pid + '_' + Date.now();
  await admin.query('create database ' + name);
  const url = new URL(URI); url.pathname = '/' + name;
  const raw = new pg.Client({ connectionString: url.toString() });
  await raw.connect();
  const db = asDb(raw);
  const rows = async (q, a = []) => (await db.query(q, a)).rows;
  const ok = async (user, fn, now = at()) => { const r = await callRpc(db, { user, now }, 'public.' + fn); assert.ok(r.ok, r.error); return r.value; };
  const award = (u, b) => db.query('select games.passport_award($1, $2)', [uid(u), b]);
  const items = async u => (await rows('select item_id from games.pepegochi_room_inventory where user_id = $1 order by item_id', [uid(u)])).map(r => r.item_id);
  const has = async (u, b) => (await rows('select 1 from games.passport_badges where user_id = $1 and badge_id = $2', [uid(u), b])).length > 0;
  try {
    await prepare(db, { extra: PASSPORT });
    for (const f of ['update_pepegochi_passport.sql', 'update_pepegochi_room_v1.sql', 'update_pepegochi_rewards.sql']) await db.exec(await read(f));
    await addPlayer(db, 1); await addPlayer(db, 2);

    await t.test('a stamp earned before the first frog: the decoration arrives with the adoption', async () => {
      await award(1, 'moonwalker');
      assert.deepEqual(await items(1), [], 'no PepeGochi account yet');
      await ok(1, "gry_pepegochi_adopt('Fren')");
      assert.deepEqual(await items(1), ['moon_rock']);
      const src = await rows('select source_key from games.pepegochi_room_inventory where user_id = $1', [uid(1)]);
      assert.deepEqual(src.map(r => r.source_key), ['stamp:moonwalker']);
    });

    await t.test('a stamp earned later: the decoration arrives with it, once', async () => {
      await award(1, 'secret_starter'); await award(1, 'frog_of_the_week'); await award(1, 'secret_starter');
      await award(1, 'treasure_hunter'); await award(1, 'good_game');
      assert.deepEqual(await items(1), ['floppy_disk', 'golden_fly', 'moon_rock', 'paper_crown']);
      await db.exec(await read('update_pepegochi_rewards.sql'));
      assert.equal((await items(1)).length, 4, 'running the file again changes nothing');
    });

    await t.test('Pond Decorator: 3 different earned decorations placed, starters do not count', async () => {
      let room = await ok(1, 'gry_pepegochi_room_initialize()');
      const inst = id => room.inventory.find(i => i.item_id === id).item_instance_id;
      const place = async (id, slot) => { room = await ok(1, `gry_pepegochi_room_place('${inst(id)}', '${slot}', ${room.revision})`); };
      await place('moon_rock', 'shelf_a');
      await place('paper_crown', 'shelf_b');
      assert.equal(await has(1, 'interior_designer'), false, 'two are not enough');
      await place('floppy_disk', 'rug_right');
      assert.equal(await has(1, 'interior_designer'), true);
    });

    await t.test('the room alone gives nothing; the inactive Lost Pond artifact is never handed out', async () => {
      await ok(2, "gry_pepegochi_adopt('Fren')");
      await ok(2, 'gry_pepegochi_room_initialize()');
      assert.equal(await has(2, 'interior_designer'), false);
      assert.deepEqual((await rows("select active from games.pepegochi_room_catalog where item_id = 'lost_pond_artifact'")).map(r => r.active), [false]);
    });

    await t.test('the helpers are closed to the browser', async () => {
      for (const f of ['games.pepegochi_reward_sync(uuid)', 'games.pepegochi_decorator_check(uuid)', 'games.pepegochi_reward_item(text)'])
        for (const role of ['anon', 'authenticated'])
          assert.equal((await rows('select has_function_privilege($1, $2, \'execute\') as v', [role, f]))[0].v, false, role + ' ' + f);
    });
  } finally {
    await raw.end();
    await admin.query('drop database if exists ' + name + ' with (force)');
    await admin.end();
  }
});
