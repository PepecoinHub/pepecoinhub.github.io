// The trips SQL draft (games/supabase/update_pepegochi_trips.sql) on a throwaway database. Never Supabase.
//   PEPEGOCHI_PGLITE_MODULE=/abs/path/node_modules/@electric-sql/pglite/dist/index.js node --test tests/pepegochi-trips-sql.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepare, setRules, addPlayer, callRpc, asDb, uid } from '../scripts/pepegochi_sim.mjs';
import { PLACES, SOUVENIRS } from '../docs/meme/pepegochi-trips.mjs';

const PGLITE = process.env.PEPEGOCHI_PGLITE_MODULE;
const HOUR = 3600e3;
const T = Date.parse('2026-11-21T12:00:00Z');

test('trips: start, hidden loot, claim, rules', { skip: !PGLITE && 'set PEPEGOCHI_PGLITE_MODULE', timeout: 300000 }, async () => {
  const { PGlite } = await import(PGLITE);
  const lite = new PGlite(); const db = asDb(lite);
  const { base } = await prepare(db);
  await db.exec(await readFile(new URL('../games/supabase/update_pepegochi_trips.sql', import.meta.url), 'utf8'));
  // running it again is safe
  await db.exec(await readFile(new URL('../games/supabase/update_pepegochi_trips.sql', import.meta.url), 'utf8'));
  const as = (user, now) => (fn, args = []) => callRpc(db, { user, now }, fn, args);

  await addPlayer(db, 1); await addPlayer(db, 2, { provider: null });
  assert.equal((await as(2, T)('public.gry_pepegochi_trip_state()')).code, '42501', 'Discord only');

  // an egg cannot travel
  assert.equal((await as(1, T - HOUR)('public.gry_pepegochi_adopt($1)', ['Fren'])).ok, true);
  let r = await as(1, T)('public.gry_pepegochi_trip_start($1, $2)', ['short', 'snack']);
  assert.equal(r.ok, false); assert.match(r.error, /healthy froglet or adult/);

  // grow it to an adult with full needs (test shortcut on the throwaway DB)
  await db.exec(`update games.pepegochi_lives set care_days = 8, needs_at = '${new Date(T).toISOString()}',
    hunger = 100, hygiene = 100, mood = 100, energy = 100 where user_id = '${uid(1)}'`);
  const state = await as(1, T)('public.gry_pepegochi_state()');
  assert.equal(state.value.pet.stage, 'adult', JSON.stringify(state.value.pet));

  assert.match((await as(1, T)('public.gry_pepegochi_trip_start($1, $2)', ['weird', null])).error, /Unknown trip/);
  assert.match((await as(1, T)('public.gry_pepegochi_trip_start($1, $2)', ['short', 'sword'])).error, /Unknown trip/);
  assert.match((await as(1, T)('public.gry_pepegochi_trip_start($1, $2)', ['grand', null])).error, /not open yet/);

  r = await as(1, T)('public.gry_pepegochi_trip_start($1, $2)', ['short', 'snack']);
  assert.equal(r.ok, true, r.error);
  assert.equal(r.value.trip.place, null, 'the place stays hidden until the return');
  assert.equal(r.value.trip.souvenir, null);
  assert.equal(Date.parse(r.value.trip.return_at) - T, 4 * HOUR);
  assert.match((await as(1, T + HOUR)('public.gry_pepegochi_trip_start($1, $2)', ['short', null])).error, /already on a trip/);

  // too early: nothing to claim, still hidden
  r = await as(1, T + HOUR)('public.gry_pepegochi_trip_claim()');
  assert.equal(r.value.claimed, null); assert.equal(r.value.trip.place, null);
  // back: the state shows the place, the claim keeps the souvenir
  r = await as(1, T + 4 * HOUR)('public.gry_pepegochi_trip_state()');
  const place = r.value.trip.place;
  assert.ok(PLACES.some(p => p.id === place && p.w[0] > 0), place);
  r = await as(1, T + 4 * HOUR)('public.gry_pepegochi_trip_claim()');
  assert.equal(r.value.claimed.place, place); assert.equal(r.value.trip, null);
  const again = await as(1, T + 4 * HOUR)('public.gry_pepegochi_trip_claim()');
  assert.equal(again.value.claimed, null, 'claim is idempotent');
  const souv = (await as(1, T + 4 * HOUR)('public.gry_pepegochi_trip_state()')).value.souvenirs;
  assert.equal(souv.length, r.value.claimed.souvenir ? 1 : 0);

  // grand expedition: once a week when the owner switches it on
  await setRules(db, base, {});
  const rules = { ...(await db.query('select games.pepegochi_rules() as r')).rows[0].r, trips_grand_enabled: true };
  await db.exec(`create or replace function games.pepegochi_rules() returns jsonb language sql stable set search_path = '' as $$ select '${JSON.stringify(rules)}'::jsonb $$;`);
  const t2 = T + 5 * HOUR;
  await db.exec(`update games.pepegochi_lives set needs_at = '${new Date(t2).toISOString()}', hunger = 100, hygiene = 100, mood = 100, energy = 100 where user_id = '${uid(1)}'`);
  r = await as(1, t2)('public.gry_pepegochi_trip_start($1, $2)', ['grand', 'map']);
  assert.equal(r.ok, true, r.error);
  await as(1, t2 + 48 * HOUR)('public.gry_pepegochi_trip_claim()');
  const t3 = t2 + 49 * HOUR;
  // (the frog was not cared for during 48 h away: see OPEN in the SQL; the test refreshes it by hand)
  const fresh = new Date(t3).toISOString();
  await db.exec(`update games.pepegochi_lives set needs_at = '${fresh}', hunger = 100, hygiene = 100, mood = 100, energy = 100,
    hunger_due_at = '${fresh}', hygiene_due_at = '${fresh}', mood_due_at = '${fresh}', energy_due_at = '${fresh}' where user_id = '${uid(1)}'`);
  assert.equal((await as(1, t3)('public.gry_pepegochi_state()')).value.pet.status, 'healthy');
  assert.match((await as(1, t3)('public.gry_pepegochi_trip_start($1, $2)', ['grand', null])).error, /One grand expedition a week/);

  // low needs: no trip
  await db.exec(`update games.pepegochi_lives set hunger = 40 where user_id = '${uid(1)}'`);
  assert.match((await as(1, t3)('public.gry_pepegochi_trip_start($1, $2)', ['short', null])).error, /fed, clean and rested/);

  // the roll itself: legal places and souvenirs only, place-bound souvenirs from their place, no legendary on short trips
  const rows = (await db.query(`select (games.pepegochi_trip_roll(l, p)).*, l from
    (select unnest(array['short','long','grand']) l) a, (select unnest(array['snack','map','lantern', null]) p) b,
    generate_series(1, 150)`)).rows;
  for (const { place_id, souvenir_id, l } of rows) {
    const p = PLACES.find(x => x.id === place_id);
    assert.ok(p && p.w[{ short: 0, long: 1, grand: 2 }[l]] > 0, l + ' ' + place_id);
    if (place_id === 'unknown') assert.equal(souvenir_id, null);
    if (souvenir_id) {
      const s = SOUVENIRS.find(x => x.id === souvenir_id);
      assert.ok(s, souvenir_id);
      assert.ok(!s.from || s.from.includes(place_id), souvenir_id + ' from ' + place_id);
      if (l === 'short') assert.notEqual(s.rarity, 'legendary');
    }
  }
  // the browser roles cannot touch the tables
  const peek = await callRpc(db, { user: 1, now: T }, '(select count(*) from games.pepegochi_trips)');
  assert.equal(peek.ok, false);
  await lite.close();
});
