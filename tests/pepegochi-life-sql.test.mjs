// PepeGochi A12 on the server (games/supabase/update_pepegochi_life.sql): trips, golden lemon, night signal, diary,
// stamps. On a disposable local PostgreSQL, never Supabase.
//   PASSPORT_PG_URL=postgres://postgres:pw@localhost:5432/postgres PASSPORT_PG_MODULE=/abs/pg/lib/index.js \
//   node --test tests/pepegochi-life-sql.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepare, setRules, addPlayer, callRpc, asDb, uid, START } from '../scripts/pepegochi_sim.mjs';
import { PLACES } from '../docs/meme/pepegochi-trips.mjs';

const URI = process.env.PASSPORT_PG_URL, MOD = process.env.PASSPORT_PG_MODULE;
const read = p => readFile(new URL('../games/supabase/' + p, import.meta.url), 'utf8');
const PASSPORT = ['update_yeet.sql', 'update_wheres_pepe.sql', 'update_wheres_pepe_guests.sql', 'update_lobby_chat.sql',
  'update_open_chat.sql', 'update_lobby_mentions.sql', 'update_frog_letters.sql', 'update_letters_community.sql',
  'update_miner_cloud.sql', 'update_fren_passport.sql', 'update_fren_avatar.sql', 'update_passport_awards.sql'];
const HOUR = 36e5, DAY = 24 * HOUR;
const T = Date.parse(START);
const at = ms => new Date(ms);

test('PepeGochi A12 server: trips, lemon, signal, diary, stamps',
  { skip: !(URI && MOD) && 'set PASSPORT_PG_URL and PASSPORT_PG_MODULE', timeout: 300000 }, async t => {
  const pg = (await import(MOD)).default;
  const admin = new pg.Client({ connectionString: URI });
  await admin.connect();
  const name = 'pepegochi_life_test_' + process.pid + '_' + Date.now();
  await admin.query('create database ' + name);
  const url = new URL(URI); url.pathname = '/' + name;
  const raw = new pg.Client({ connectionString: url.toString() });
  await raw.connect();
  const db = asDb(raw);
  const rows = async (q, a = []) => (await db.query(q, a)).rows;
  const as = (user, now) => (fn, args = []) => callRpc(db, { user, now: at(now) }, 'public.' + fn, args);
  const ok = async (user, now, fn, args = []) => { const r = await as(user, now)(fn, args); assert.ok(r.ok, r.error); return r.value; };
  const stamps = async u => (await rows(`select badge_id from games.passport_badges where user_id = $1
    and badge_id in ('tourist','globetrotter','moon_frog','golden_harvest','dear_diary','snoop') order by badge_id`, [uid(u)])).map(r => r.badge_id);
  const fill = async (u, now) => db.exec(`update games.pepegochi_lives set needs_at = '${at(now).toISOString()}', hunger = 100, hygiene = 100,
    mood = 100, energy = 100, hunger_due_at = '${at(now).toISOString()}', hygiene_due_at = '${at(now).toISOString()}',
    mood_due_at = '${at(now).toISOString()}', energy_due_at = '${at(now).toISOString()}' where user_id = '${uid(u)}'`);
  try {
    const { base } = await prepare(db, { extra: PASSPORT });
    const life = await read('update_pepegochi_life.sql');
    await db.exec(life); await db.exec(life);   // safe to run twice
    await addPlayer(db, 1); await addPlayer(db, 2, { provider: null }); await addPlayer(db, 3);

    await t.test('Discord only; one answer for the whole room', async () => {
      assert.equal((await as(2, T)('gry_pepegochi_life()')).code, '42501');
      const v = await ok(1, T, 'gry_pepegochi_life()');
      assert.equal(v.trip, null); assert.deepEqual(v.souvenirs, []); assert.deepEqual(v.postcards, []);
      assert.equal(v.grand_open, false); assert.equal(v.golden_at, null); assert.equal(v.diary, null);
    });

    await t.test('trips: start, hidden loot, claim, rules', async () => {
      await ok(1, T - HOUR, "gry_pepegochi_adopt('Fren')");
      assert.match((await as(1, T)('gry_pepegochi_trip_start($1, $2)', ['short', 'snack'])).error, /healthy froglet or adult/);
      await db.exec(`update games.pepegochi_lives set care_days = 8 where user_id = '${uid(1)}'`); await fill(1, T);
      assert.equal((await ok(1, T, 'gry_pepegochi_state()')).pet.stage, 'adult');
      assert.match((await as(1, T)('gry_pepegochi_trip_start($1, $2)', ['weird', null])).error, /Unknown trip/);
      assert.match((await as(1, T)('gry_pepegochi_trip_start($1, $2)', ['short', 'sword'])).error, /Unknown trip/);
      assert.match((await as(1, T)('gry_pepegochi_trip_start($1, $2)', ['grand', null])).error, /not open yet/);
      let v = await ok(1, T, 'gry_pepegochi_trip_start($1, $2)', ['short', 'snack']);
      assert.equal(v.trip.place, null, 'the place stays hidden until the return'); assert.equal(v.trip.souvenir, null);
      assert.equal(Date.parse(v.trip.return_at) - T, 4 * HOUR);
      assert.match((await as(1, T + HOUR)('gry_pepegochi_trip_start($1, $2)', ['short', null])).error, /already on a trip/);
      v = await ok(1, T + HOUR, 'gry_pepegochi_trip_claim()');
      assert.equal(v.claimed, null); assert.equal(v.trip.place, null);
      v = await ok(1, T + 4 * HOUR, 'gry_pepegochi_life()');
      const place = v.trip.place;
      assert.ok(PLACES.some(p => p.id === place && p.w[0] > 0), place);
      v = await ok(1, T + 4 * HOUR, 'gry_pepegochi_trip_claim()');
      assert.equal(v.claimed.place, place); assert.equal(v.claimed.new_place, true); assert.equal(v.trip, null);
      assert.deepEqual(v.postcards.map(p => p.place), [place]);
      assert.equal(v.souvenirs.length, v.claimed.souvenir ? 1 : 0);
      assert.equal((await ok(1, T + 4 * HOUR, 'gry_pepegochi_trip_claim()')).claimed, null, 'claim is idempotent');
      assert.deepEqual(await stamps(1), ['tourist'], 'first postcard: Tourist');
      // low needs: no trip
      await db.exec(`update games.pepegochi_lives set hunger = 40 where user_id = '${uid(1)}'`);
      assert.match((await as(1, T + 5 * HOUR)('gry_pepegochi_trip_start($1, $2)', ['short', null])).error, /fed, clean and rested/);
    });

    await t.test('grand expedition only when the owner opens it, once a week', async () => {
      await setRules(db, base, {});
      const rules = { ...(await rows('select games.pepegochi_rules() as r'))[0].r, trips_grand_enabled: true };
      await db.exec(`create or replace function games.pepegochi_rules() returns jsonb language sql stable set search_path = '' as $$ select '${JSON.stringify(rules)}'::jsonb $$;`);
      const t2 = T + 6 * HOUR; await fill(1, t2);
      assert.equal((await ok(1, t2, 'gry_pepegochi_life()')).grand_open, true);
      await ok(1, t2, 'gry_pepegochi_trip_start($1, $2)', ['grand', 'map']);
      await ok(1, t2 + 48 * HOUR, 'gry_pepegochi_trip_claim()');
      await fill(1, t2 + 49 * HOUR);
      assert.match((await as(1, t2 + 49 * HOUR)('gry_pepegochi_trip_start($1, $2)', ['grand', null])).error, /One grand expedition a week/);
      await setRules(db, base, {});
    });

    await t.test('Globetrotter and Moon Frog come from the claimed postcards, with their dates', async () => {
      const normal = PLACES.filter(p => !p.secret).map(p => p.id);
      let when = T + 10 * DAY;
      for (const p of normal) {
        await db.query(`insert into games.pepegochi_trips (user_id, life_id, length, place_id, started_at, return_at, claimed_at)
          select $1, life_id, 'long', $2, $3, $3, $3 from games.pepegochi_lives where user_id = $1 order by adopted_at desc limit 1`, [uid(1), p, at(when)]);
        when += DAY;
      }
      await db.query('select games.pepegochi_life_stamps($1)', [uid(1)]);
      assert.deepEqual(await stamps(1), ['globetrotter', 'moon_frog', 'tourist']);
      const g = await rows(`select earned_at from games.passport_badges where user_id = $1 and badge_id = 'globetrotter'`, [uid(1)]);
      assert.equal(+g[0].earned_at, when - DAY, 'dated by the last new place');
    });

    await t.test('the golden lemon: 14 UTC days in a row, once, for good', async () => {
      const day0 = Date.parse('2026-12-01T10:00:00Z');
      let v;
      for (let i = 0; i < 13; i++) {
        v = await ok(1, day0 + i * DAY, 'gry_pepegochi_water()');
        await ok(1, day0 + i * DAY + HOUR, 'gry_pepegochi_water()');   // twice a day counts once
      }
      assert.equal(v.golden_at, null); assert.equal(v.watered_today, true); assert.equal(v.shine, 2);
      // a missed day starts again
      v = await ok(1, day0 + 14 * DAY, 'gry_pepegochi_water()');
      assert.equal(v.golden_new, false); assert.equal(v.shine, 0);
      for (let i = 15; i < 28; i++) v = await ok(1, day0 + i * DAY, 'gry_pepegochi_water()');
      assert.equal(v.golden_new, true); assert.ok(v.golden_at);
      assert.equal((await ok(1, day0 + 28 * DAY, 'gry_pepegochi_water()')).golden_new, false);
      assert.ok((await stamps(1)).includes('golden_harvest'));
    });

    await t.test('the night signal: only at 3 AM local time, real offsets only, a secret once', async () => {
      const utc3 = Date.parse('2026-12-10T03:20:00Z');
      assert.deepEqual(await ok(1, utc3, 'gry_pepegochi_tv_signal($1)', [60]), { signal: null, new: false }, '4:20 in Warsaw');
      assert.deepEqual(await ok(1, utc3, 'gry_pepegochi_tv_signal($1)', [7]), { signal: null, new: false }, 'not a real offset');
      assert.deepEqual(await ok(1, utc3 - HOUR, 'gry_pepegochi_tv_signal($1)', [60]), { signal: '0098', new: true });
      assert.deepEqual(await ok(1, utc3 - HOUR, 'gry_pepegochi_tv_signal($1)', [60]), { signal: '0098', new: false });
      assert.equal((await rows(`select 1 from games.passport_secrets where user_id = $1 and secret_id = 'night_signal'`, [uid(1)])).length, 1);
      assert.deepEqual(await ok(3, utc3, 'gry_pepegochi_tv_signal($1)', [0]), { signal: null, new: false }, 'no frog, no TV');
    });

    await t.test('diary: saved per frog life, merged between devices, Dear Diary and Snoop', async () => {
      const t0 = T + 7 * HOUR;   // the frog is still at home
      const page = (id, ms, text = 'hi') => ({ id, day: 3, at: ms, text });
      let d = await ok(1, t0, 'gry_pepegochi_diary_save($1)', [{ seen: 5, read: 1, pages: [page('miss_1', 100), page('duck_2', 200)] }]);
      assert.deepEqual(d.pages.map(p => p.id), ['miss_1', 'duck_2']);
      // the phone saves its own pages: both are kept, seen and read take the larger value
      d = await ok(1, t0, 'gry_pepegochi_diary_save($1)', [{ seen: 3, read: 2, pages: [page('miss_1', 100), page('daily_1', 150)] }]);
      assert.deepEqual(d.pages.map(p => p.id), ['miss_1', 'daily_1', 'duck_2']); assert.equal(d.seen, 5); assert.equal(d.read, 2);
      assert.deepEqual((await ok(1, t0, 'gry_pepegochi_life()')).diary.pages.length, 3);
      for (const bad of [null, [], { pages: 'x' }, { pages: [{ id: 'X Y', day: 1, at: 1, text: '' }] },
        { pages: [page('a1', 1, 'x'.repeat(281))] }, { pages: Array.from({ length: 366 }, (_, i) => page('p' + i, i)) }])
        assert.equal((await as(1, t0)('gry_pepegochi_diary_save($1::jsonb)', [JSON.stringify(bad)])).ok, false, JSON.stringify(bad).slice(0, 60));
      // the newest 365 pages are kept
      await ok(1, t0, 'gry_pepegochi_diary_save($1)', [{ pages: Array.from({ length: 365 }, (_, i) => page('n' + i, 1000 + i)) }]);
      d = (await ok(1, t0, 'gry_pepegochi_life()')).diary;
      assert.equal(d.pages.length, 365); assert.equal(d.pages[0].id, 'n0');
      // Dear Diary: opened on 7 different UTC days (the diary belongs to the account: no frog needed to open it)
      for (let i = 0; i < 6; i++) await ok(1, t0 + i * DAY, 'gry_pepegochi_diary_open($1)', [60]);
      assert.equal((await stamps(1)).includes('dear_diary'), false);
      assert.equal((await ok(1, t0 + 6 * DAY, 'gry_pepegochi_diary_open($1)', [60])).days, 7);
      assert.ok((await stamps(1)).includes('dear_diary'));
      // Snoop: at 3 AM local time
      assert.equal((await ok(1, Date.parse('2026-12-28T02:10:00Z'), 'gry_pepegochi_diary_open($1)', [60])).snoop, true);
      assert.ok((await stamps(1)).includes('snoop'));
      // a new frog has a new, empty diary
      assert.equal((await as(3, t0)('gry_pepegochi_diary_save($1)', [{ pages: [] }])).ok, false, 'no frog yet');
    });

    await t.test('stamps wait for passport_award() and arrive later with their dates', async () => {
      await addPlayer(db, 4);
      await ok(4, T, "gry_pepegochi_adopt('Fren')");
      const fn = (await rows(`select pg_get_functiondef('games.passport_award(uuid,text,timestamptz)'::regprocedure) d`))[0].d;
      // the beta: passport_award() without the new stamps
      await db.exec(fn.replace(/'snoop', /, '').replace(/'tourist', /, ''));
      await db.query(`insert into games.pepegochi_trips (user_id, life_id, length, place_id, started_at, return_at, claimed_at)
        select $1, life_id, 'short', 'big_pond', $2, $2, $2 from games.pepegochi_lives where user_id = $1`, [uid(4), at(T + DAY)]);
      await db.query('select games.pepegochi_life_stamps($1)', [uid(4)]);
      assert.deepEqual(await stamps(4), []);
      await db.exec(fn);
      await db.exec(life);
      assert.deepEqual(await stamps(4), ['tourist']);
      const e = await rows(`select earned_at from games.passport_badges where user_id = $1 and badge_id = 'tourist'`, [uid(4)]);
      assert.equal(+e[0].earned_at, T + DAY);
    });

    await t.test('browser roles cannot touch the tables or helpers', async () => {
      for (const tbl of ['pepegochi_trips', 'pepegochi_souvenirs', 'pepegochi_watering', 'pepegochi_marks', 'pepegochi_diary'])
        assert.equal((await rows(`select has_table_privilege('authenticated', 'games.${tbl}', 'select') p`))[0].p, false, tbl);
      for (const f of ['games.pepegochi_life_stamps(uuid)', 'games.pepegochi_trip_roll(text,text)', 'games.pepegochi_life_view(uuid,timestamptz)'])
        assert.equal((await rows(`select has_function_privilege('authenticated', '${f}', 'execute') p`))[0].p, false, f);
    });
  } finally {
    await raw.end();
    await admin.query('drop database if exists ' + name + ' with (force)');
    await admin.end();
  }
});
