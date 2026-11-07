// Opt-in integration suite: run with @electric-sql/pglite available locally.
// Does not touch the production Supabase project.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const file = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
let PGlite;
try { ({ PGlite } = await import('@electric-sql/pglite')); } catch {}

test('live Postgres: migration, fractional needs, isolation and 100-day Passport', {
  skip: PGlite ? false : 'Install @electric-sql/pglite to enable PostgreSQL integration tests',
}, async () => {
  const db = new PGlite();
  const alice = '11111111-1111-4111-8111-111111111111';
  const bob = '22222222-2222-4222-8222-222222222222';
  const exec = s => db.exec(s);
  const one = async s => (await db.query(s)).rows[0];
  const identity = u => exec("set app.test_user_id = '" + u + "';");
  try {
    await exec([
      'create role anon;',
      'create role authenticated;',
      'create schema auth;',
      'create schema games;',
      'create table auth.users(id uuid primary key, created_at timestamptz not null default now());',
      'create table games.test_discord(user_id uuid primary key, name text);',
      'create table games.yeet_records(user_id uuid primary key,best integer default 0,achieved_at timestamptz);',
      "create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.test_user_id',true),'')::uuid $$;",
      "create function games.discord_identity(u uuid) returns jsonb language sql stable as $$ select jsonb_build_object('name',d.name) from games.test_discord d where d.user_id=u limit 1 $$;",
      "insert into auth.users(id) values ('"+alice+"'),('"+bob+"');",
      "insert into games.test_discord(user_id,name) values ('"+alice+"','Alice');"
    ].join('\n'));

    const petSQL = file('games/supabase/update_pepegochi_v1.sql');
    await exec(petSQL);
    await exec(petSQL); // repeatable migration
    // Passport lives in PR #184. Test the bridge only in a checkout
    // containing BOTH PR branches, not in this standalone backend branch.
    const passportPresent = existsSync(new URL('../games/supabase/update_fren_passport.sql', import.meta.url));
    if (passportPresent) {
      await exec(file('games/supabase/update_fren_passport.sql'));
      await exec(file('games/supabase/update_pepegochi_passport_bridge.sql'));
    }

    await identity(bob);
    await assert.rejects(() => db.query('select public.gry_pepegochi_state()'), /Discord/);
    await identity(alice);
    const adopted = (await one("select public.gry_pepegochi_adopt('Fren') as s")).s;
    assert.equal(adopted.name,'Fren');
    const repeated = (await one("select public.gry_pepegochi_adopt('Other') as s")).s;
    assert.equal(repeated.name,'Fren');
    await assert.rejects(() => db.query("select public.gry_pepegochi_action('cheat')"));

    // Regression: 2 h used to subtract floor(0.83)=0 energy per action.
    await exec("update games.pepegochi_pets set updated_at=clock_timestamp()-interval '2 hours' where user_id='"+alice+"'");
    const first = (await one("select public.gry_pepegochi_action('clean') as s")).s;
    assert.equal(first.care_days,1);
    assert.equal(first.needs.energy,74);
    const energy2 = Number((await one("select energy as x from games.pepegochi_pets where user_id='"+alice+"'")).x);
    assert.ok(energy2>74.1 && energy2<75,'energy fraction survived first action');

    await exec("update games.pepegochi_pets set updated_at=clock_timestamp()-interval '2 hours',last_action_at=clock_timestamp()-interval '2 hours' where user_id='"+alice+"'");
    const second = (await one("select public.gry_pepegochi_action('feed') as s")).s;
    assert.equal(second.care_days,1);
    assert.equal(second.needs.energy,73);
    const energy4 = Number((await one("select energy as x from games.pepegochi_pets where user_id='"+alice+"'")).x);
    assert.ok(energy4>73.1 && energy4<73.5,'fraction accumulated across actions');

    // No one outside an internal server-side function may mutate the pet table.
    const grant = await one("select has_table_privilege('authenticated','games.pepegochi_pets','UPDATE') as allowed");
    assert.equal(grant.allowed,false);

    // Controlled SQL fixture simulates a real 99-day pet without 100 days of waiting.
    await exec("update games.pepegochi_pets set care_days=99,last_care_day_utc=(now() at time zone 'utc')::date-1,last_action_at=now()-interval '2 hours',actions_today=0 where user_id='"+alice+"'");
    const hundred = (await one("select public.gry_pepegochi_action('play') as s")).s;
    assert.equal(hundred.care_days,100);
    if (passportPresent) {
      const passport = (await one("select public.gry_passport_state() as s")).s;
      const certified = passport.achievements.filter(x=>x.id==='certified_fren');
      assert.equal(certified.length,1);
      assert.ok(certified[0].earned_at);
      await exec(file('games/supabase/update_pepegochi_passport_bridge.sql'));
      const count = (await one("select count(*)::int as n from games.passport_badges where user_id='"+alice+"' and badge_id='certified_fren'")).n;
      assert.equal(count,1);
    }
  } finally { await db.close(); }
});
