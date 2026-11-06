// Optional PostgreSQL integration test for the Fren Avatar Maker migration.
// Needs a disposable PostgreSQL server (15+) where the user may create databases
// and roles, plus the node-postgres package:
//   PASSPORT_PG_URL=postgres://postgres:pw@localhost:5432/postgres \
//   PASSPORT_PG_MODULE=/abs/path/node_modules/pg/lib/index.js \
//   node --test tests/passport-avatar-sql.test.mjs
// It creates and drops its own database. Never point it at Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const URL_ENV = process.env.PASSPORT_PG_URL;
const MOD_ENV = process.env.PASSPORT_PG_MODULE;
const read = p => readFile(new URL('../' + p, import.meta.url), 'utf8');

// Supabase pieces the migrations rely on: roles, auth.users/identities, auth.uid().
const SUPABASE_STUB = `
-- roles are shared by the whole server and the SQL tests run in parallel, so a race is not an error
do $$ begin create role anon nologin; exception when duplicate_object or unique_violation then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object or unique_violation then null; end $$;
create schema auth; create schema games;
create table auth.users(id uuid primary key, created_at timestamptz not null default now(), is_anonymous boolean not null default false);
create table auth.identities(user_id uuid references auth.users(id) on delete cascade, provider text not null,
  provider_id text not null, identity_data jsonb not null default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
$$;
grant usage on schema public, auth to anon, authenticated;
-- Worst case: pretend the private schema is exposed, so only table grants protect it.
grant usage on schema games to anon, authenticated;
`;

test('Fren Avatar SQL: Discord-only saves, exact allowlists, one Fresh Fren, isolation, limits',
  { skip: !(URL_ENV && MOD_ENV) && 'set PASSPORT_PG_URL and PASSPORT_PG_MODULE', timeout: 120000 }, async () => {
  const pg = (await import(MOD_ENV)).default;
  const admin = new pg.Client({ connectionString: URL_ENV });
  await admin.connect();
  const dbName = 'fren_avatar_test_' + process.pid + '_' + Date.now();
  await admin.query('create database ' + dbName);
  const url = new URL(URL_ENV); url.pathname = '/' + dbName;
  const clients = [];
  const connect = async () => { const c = new pg.Client({ connectionString: url.toString() }); await c.connect(); clients.push(c); return c; };
  try {
    const db = await connect();
    const schema = await read('games/supabase/schema.sql');
    const identityFn = schema.match(/create or replace function games\.discord_identity\(u uuid\)[\s\S]*?\n\$\$;/);
    assert.ok(identityFn, 'games.discord_identity not found in schema.sql');
    await db.query(SUPABASE_STUB);
    await db.query(identityFn[0]);
    await db.query(await read('games/supabase/update_yeet.sql'));
    await db.query(await read('games/supabase/update_fren_passport.sql'));
    const migration = await read('games/supabase/update_fren_avatar.sql');
    await db.query(migration);
    await db.query(migration); // idempotent, grants included

    const uid = i => '00000000-0000-4000-8000-' + String(i).padStart(12, '0');
    const addUser = async (i, provider = 'discord', name = 'Fren ' + i) => {
      await db.query('insert into auth.users(id) values ($1)', [uid(i)]);
      if (provider) await db.query('insert into auth.identities values ($1, $2, $3, $4)',
        [uid(i), provider, 'p' + i, JSON.stringify({ full_name: name })]);
    };
    // Same shape as a PostgREST request: one transaction, role and JWT claim set locally.
    const call = async (conn, user, sql, args = [], role = 'authenticated') => {
      await conn.query('begin');
      try {
        await conn.query('set local role ' + role);
        await conn.query("select set_config('request.jwt.claim.sub', $1, true)", [user ? uid(user) : '']);
        const r = await conn.query(sql, args);
        await conn.query('commit');
        return r.rows[0] && r.rows[0].v;
      } catch (e) { await conn.query('rollback'); throw e; }
    };
    const SAVE = 'select public.gry_passport_avatar_save($1, $2, $3, $4, $5, $6) as v';
    const STATE = 'select public.gry_passport_state() as v';
    // v2 order matches the save RPC: bg, clothing, mouth, eyes, hat, accessory
    const look = (bg, c, m, e, h, a) => [bg, c, m, e, h, a];
    const DEFAULT = look('bg_sky', 'clothing_blue', 'mouth_smile', 'eyes_classic', 'hat_none', 'accessory_none');
    const save = (user, args = DEFAULT, conn = db) => call(conn, user, SAVE, args);
    const state = (user, conn = db) => call(conn, user, STATE);
    const count = async (sql, args = []) => (await db.query(sql, args)).rows[0].n;
    const badges = user => count("select count(*)::int as n from games.passport_badges where user_id = $1 and badge_id = 'first_avatar'", [uid(user)]);
    const avatars = user => count('select count(*)::int as n from games.passport_avatars where user_id = $1', [uid(user)]);
    const pastCooldown = user => db.query("update games.passport_avatars set updated_at = now() - interval '5 seconds' where user_id = $1", [uid(user)]);

    await addUser(1); await addUser(2); await addUser(3);
    await addUser(4, 'email');   // signed in, but not with Discord
    await addUser(5, null);      // anonymous Supabase user, no identity

    // --- grants: no anon/PUBLIC execute, no direct table access for anyone
    const SIG = 'text,text,text,text,text,text';
    const priv = (await db.query(`select
      has_function_privilege('anon', 'public.gry_passport_avatar_save(${SIG})', 'EXECUTE') as anon_save,
      has_function_privilege('authenticated', 'public.gry_passport_avatar_save(${SIG})', 'EXECUTE') as user_save,
      has_function_privilege('anon', 'public.gry_passport_state()', 'EXECUTE') as anon_state,
      exists (select 1 from information_schema.routine_privileges where routine_name = 'gry_passport_avatar_save' and grantee = 'PUBLIC') as public_save,
      has_table_privilege('authenticated', 'games.passport_avatars', 'SELECT') as t_sel,
      has_table_privilege('authenticated', 'games.passport_avatars', 'INSERT') as t_ins,
      has_table_privilege('authenticated', 'games.passport_avatars', 'UPDATE') as t_upd,
      has_table_privilege('authenticated', 'games.passport_avatars', 'DELETE') as t_del,
      has_table_privilege('anon', 'games.passport_avatars', 'SELECT') as anon_sel,
      has_table_privilege('authenticated', 'games.passport_badges', 'INSERT') as badge_ins,
      (select relrowsecurity from pg_class where oid = 'games.passport_avatars'::regclass) as rls,
      (select prosecdef from pg_proc where oid = 'public.gry_passport_avatar_save(${SIG})'::regprocedure) as definer,
      (select proconfig from pg_proc where oid = 'public.gry_passport_avatar_save(${SIG})'::regprocedure) as config,
      (select count(*)::int from pg_proc where proname = 'gry_passport_avatar_save') as overloads`)).rows[0];
    assert.deepEqual(priv, { anon_save: false, user_save: true, anon_state: false, public_save: false,
      t_sel: false, t_ins: false, t_upd: false, t_del: false, anon_sel: false, badge_ins: false,
      rls: true, definer: true, config: ['search_path=""'], overloads: 1 });
    await assert.rejects(call(db, 1, SAVE, DEFAULT, 'anon'), /permission denied for function/);
    await assert.rejects(call(db, 1, 'select count(*) as v from games.passport_avatars'), /permission denied for table/);
    await assert.rejects(call(db, 1, "insert into games.passport_badges values ($1, 'first_avatar') returning 1 as v", [uid(1)]), /permission denied for table/);
    // No way to pass a user or badge: the only signature is six text options.
    await assert.rejects(call(db, 1, 'select public.gry_passport_avatar_save(p_bg => $1, p_clothing => $2, p_mouth => $3, p_eyes => $4, p_hat => $5, p_accessory => $6, p_user_id => $7) as v', [...DEFAULT, uid(2)]), /does not exist/);

    // --- identity: no JWT, non-Discord and anonymous users are rejected and write nothing
    await assert.rejects(save(null), /Log on with Discord/);
    await assert.rejects(save(4), /Log on with Discord/);
    await assert.rejects(save(5), /Log on with Discord/);
    assert.equal(await count('select count(*)::int as n from games.passport_avatars'), 0);
    assert.deepEqual(await state(4), { signed_in: false });

    // --- ID injection: exact allowlist per slot, nothing written
    const bad = [
      look('bg_sky', 'clothing_blue', 'mouth_smile', 'eyes_classic', 'hat_none', null),
      look('bg_sky', 'clothing_blue', 'eyes_3d', 'eyes_classic', 'hat_none', 'accessory_none'),      // right ID, wrong slot
      look('bg_sky', 'clothing_blue', 'MOUTH_SMILE', 'eyes_classic', 'hat_none', 'accessory_none'),
      look('bg_sky', 'clothing_blue', 'mouth_smile ', 'eyes_classic', 'hat_none', 'accessory_none'),
      look('bg_sky', 'clothing_blue', 'mouth_smile', 'eyes_classic', 'hat_gold_crown', 'accessory_none'), // looks valid, not in v2
      look('outfit_blue', 'clothing_blue', 'mouth_smile', 'eyes_classic', 'hat_none', 'accessory_none'),   // legacy v1 slot id, gone in v2
      look('bg_sky', 'clothing_blue', "mouth_smile'); delete from games.passport_badges; --", 'eyes_classic', 'hat_none', 'accessory_none'),
      look('bg_sky', '../../etc/passwd', 'mouth_smile', 'eyes_classic', 'hat_none', 'accessory_none'),
      look('bg_sky', 'clothing_blue', 'mouth_smile', 'eyes_classic', 'hat_none', '<img src=x onerror=alert(1)>')
    ];
    for (const args of bad) await assert.rejects(save(1, args), /Unknown avatar option/, JSON.stringify(args));
    assert.equal(await avatars(1), 0); assert.equal(await badges(1), 0);

    // --- reward parts: valid manifest ids, saveable only with their stamp (tests/passport-awards-sql.test.mjs
    //     covers the unlocked case). Without it each is rejected and writes nothing (no avatar row, no Fresh Fren).
    const reserved = [
      look('bg_sunset', 'clothing_blue', 'mouth_smile', 'eyes_classic', 'hat_none', 'accessory_none'),            // bg_sunset -> yeet_adept
      look('bg_sky', 'clothing_suit', 'mouth_smile', 'eyes_classic', 'hat_none', 'accessory_none'),              // clothing_suit -> detective_fren
      look('bg_sky', 'clothing_blue', 'mouth_smile', 'eyes_classic', 'hat_hardhat', 'accessory_none'),           // hat_hardhat -> miner_fren
      look('bg_sky', 'clothing_blue', 'mouth_smile', 'eyes_classic', 'hat_detective', 'accessory_none'),         // hat_detective -> detective_fren
      look('bg_sky', 'clothing_blue', 'mouth_smile', 'eyes_classic', 'hat_none', 'accessory_pin'),               // accessory_pin -> scout_fren
      look('bg_sky', 'clothing_blue', 'mouth_smile', 'eyes_classic', 'hat_none', 'accessory_headphones')         // accessory_headphones -> gamer_fren
    ];
    for (const args of reserved) await assert.rejects(save(1, args), /That part is locked/, 'reserved ' + JSON.stringify(args));
    assert.equal(await avatars(1), 0); assert.equal(await badges(1), 0);

    // --- state before any save: avatar is null, Fresh Fren not earned
    const s0 = await state(1);
    assert.equal(s0.signed_in, true); assert.equal(s0.avatar, null);
    assert.ok(!s0.achievements.some(a => a.id === 'first_avatar'));

    // --- first save awards Fresh Fren once
    const first = await save(1, look('bg_forest', 'clothing_purple_hoodie', 'mouth_teeth', 'eyes_3d', 'hat_crown', 'accessory_shades'));
    assert.deepEqual(first.avatar, { schema_version: 2, bg: 'bg_forest', clothing: 'clothing_purple_hoodie', mouth: 'mouth_teeth', eyes: 'eyes_3d', hat: 'hat_crown', accessory: 'accessory_shades' });
    assert.equal(first.first_save, true); assert.equal(first.changed, true);
    assert.equal(first.badge.id, 'first_avatar'); assert.equal(first.badge.new, true); assert.ok(first.badge.earned_at);
    assert.equal(await badges(1), 1);
    const s1 = await state(1);
    assert.deepEqual(s1.avatar, first.avatar);
    const earned = s1.achievements.filter(a => a.id === 'first_avatar');
    assert.equal(earned.length, 1); assert.equal(earned[0].title, 'Fresh Fren');
    assert.equal(new Date(earned[0].earned_at).getTime(), new Date(first.badge.earned_at).getTime());

    // --- repeat of the same look: success, no write, no new badge
    const same = await save(1, look('bg_forest', 'clothing_purple_hoodie', 'mouth_teeth', 'eyes_3d', 'hat_crown', 'accessory_shades'));
    assert.equal(same.first_save, false); assert.equal(same.changed, false); assert.equal(same.badge.new, false);
    assert.equal(same.updated_at, first.updated_at);

    // --- cooldown: a different look right away is an error and changes nothing
    await assert.rejects(save(1, look('bg_forest', 'clothing_purple_hoodie', 'mouth_open', 'eyes_3d', 'hat_crown', 'accessory_shades')), /Saving too fast/);
    assert.equal((await state(1)).avatar.mouth, 'mouth_teeth');

    // --- edit after cooldown: saved, never re-awarded
    await pastCooldown(1);
    const edit = await save(1, look('bg_night', 'clothing_shirt_tie', 'mouth_tongue', 'eyes_hypno', 'hat_pep_cap', 'accessory_pipe'));
    assert.equal(edit.first_save, false); assert.equal(edit.changed, true);
    assert.equal(edit.badge.new, false);
    assert.equal(new Date(edit.badge.earned_at).getTime(), new Date(first.badge.earned_at).getTime());
    assert.equal(await badges(1), 1); assert.equal(await avatars(1), 1);

    // --- daily budget: rejected at the limit, resets on a new UTC day
    await db.query("update games.passport_avatars set budget_used = 40, updated_at = now() - interval '1 minute' where user_id = $1", [uid(1)]);
    await assert.rejects(save(1, DEFAULT), /Daily save limit/);
    await db.query("update games.passport_avatars set budget_day = budget_day - 1 where user_id = $1", [uid(1)]);
    const nextDay = await save(1, DEFAULT);
    assert.equal(nextDay.avatar.mouth, 'mouth_smile');
    assert.equal((await db.query('select budget_used from games.passport_avatars where user_id = $1', [uid(1)])).rows[0].budget_used, 1);

    // --- second user isolation
    const other = await save(2, look('bg_forest', 'clothing_camo', 'mouth_open', 'eyes_bloodshot', 'hat_bucket', 'accessory_none'));
    assert.equal(other.first_save, true); assert.equal(other.badge.new, true);
    assert.deepEqual((await state(1)).avatar, nextDay.avatar);
    assert.equal((await state(2)).avatar.hat, 'hat_bucket');
    assert.equal(await badges(1), 1); assert.equal(await badges(2), 1);
    assert.equal(await avatars(3), 0); assert.equal((await state(3)).avatar, null);

    // --- error rollback: if the badge insert fails, the first avatar row is not kept either
    await db.query("alter table games.passport_badges add constraint test_block_first_avatar check (badge_id <> 'first_avatar') not valid");
    await assert.rejects(save(3), /test_block_first_avatar/);
    assert.equal(await avatars(3), 0); assert.equal(await badges(3), 0);
    await db.query('alter table games.passport_badges drop constraint test_block_first_avatar');

    // --- concurrency 1: a first save waits for another in-flight first save, then cannot mint again
    const a = await connect(), b = await connect();
    await a.query('begin'); await a.query('set local role authenticated');
    await a.query("select set_config('request.jwt.claim.sub', $1, true)", [uid(3)]);
    const fa = (await a.query(SAVE, look('bg_sky', 'clothing_black_hoodie', 'mouth_open', 'eyes_angry', 'hat_beanie', 'accessory_none'))).rows[0].v;
    let bDone = false;
    const pb = save(3, look('bg_sky', 'clothing_black_hoodie', 'mouth_open', 'eyes_angry', 'hat_beanie', 'accessory_none'), b).then(v => { bDone = true; return v; });
    await new Promise(r => setTimeout(r, 300));
    assert.equal(bDone, false, 'second first-save must wait for the first transaction');
    await a.query('commit');
    const fb = await pb;
    assert.equal(fa.first_save, true); assert.equal(fa.badge.new, true);
    assert.equal(fb.first_save, false); assert.equal(fb.badge.new, false); assert.equal(fb.changed, false);
    assert.equal(await badges(3), 1); assert.equal(await avatars(3), 1);

    // --- concurrency 2: a burst of different first saves on separate connections
    await addUser(6);
    const pool = await Promise.all(Array.from({ length: 8 }, () => connect()));
    const looks = [
      look('bg_sky', 'clothing_blue', 'mouth_smile', 'eyes_classic', 'hat_none', 'accessory_none'), look('bg_forest', 'clothing_purple_hoodie', 'mouth_teeth', 'eyes_sleepy', 'hat_pep_cap', 'accessory_shades'),
      look('bg_night', 'clothing_black_hoodie', 'mouth_open', 'eyes_angry', 'hat_beanie', 'accessory_pipe'), look('bg_sky', 'clothing_shirt_tie', 'mouth_tongue', 'eyes_hypno', 'hat_bucket', 'accessory_none'),
      look('bg_forest', 'clothing_camo', 'mouth_smile', 'eyes_bloodshot', 'hat_crown', 'accessory_shades'), look('bg_night', 'clothing_blue', 'mouth_teeth', 'eyes_3d', 'hat_none', 'accessory_pipe'),
      look('bg_sky', 'clothing_purple_hoodie', 'mouth_open', 'eyes_classic', 'hat_pep_cap', 'accessory_none'), look('bg_forest', 'clothing_black_hoodie', 'mouth_tongue', 'eyes_sleepy', 'hat_beanie', 'accessory_shades')
    ];
    const burst = await Promise.allSettled(pool.map((c, i) => save(6, looks[i], c)));
    const ok = burst.filter(r => r.status === 'fulfilled').map(r => r.value);
    const failed = burst.filter(r => r.status === 'rejected');
    assert.equal(ok.filter(r => r.first_save).length, 1, 'exactly one first save');
    assert.equal(ok.filter(r => r.badge && r.badge.new).length, 1, 'exactly one Fresh Fren mint');
    for (const f of failed) assert.match(f.reason.message, /Saving too fast/);
    assert.equal(await badges(6), 1); assert.equal(await avatars(6), 1);
    const winner = ok.find(r => r.first_save).avatar;
    assert.deepEqual((await state(6)).avatar, winner, 'the stored look is the one the first save confirmed');

    // --- account deletion removes the look and the badge
    await db.query('delete from auth.users where id = $1', [uid(2)]);
    assert.equal(await avatars(2), 0); assert.equal(await badges(2), 0);

    // --- the server allowlists match the public manifest ids exactly, and every reward part is
    //     tied to the same stamp as its manifest 'unlock' key
    const manifest = JSON.parse(await read('docs/meme/avatar-options.json'));
    const allIds = slot => manifest.options[slot].map(o => o.id);
    const src = (await db.query("select prosrc from pg_proc where proname = 'gry_passport_avatar_save'")).rows[0].prosrc;
    for (const slot of ['bg', 'clothing', 'mouth', 'eyes', 'hat', 'accessory']) {
      const list = src.match(new RegExp('p_' + slot + ' is null or p_' + slot + ' not in \\(([^)]*)\\)'));
      assert.ok(list, slot + ' allowlist');
      assert.deepEqual([...list[1].matchAll(/'([a-z0-9_]+)'/g)].map(x => x[1]), allIds(slot), slot);
    }
    const rewards = [...src.matchAll(/\('([a-z0-9_]+)', '([a-z0-9_]+)'\)/g)].map(x => x[1] + '>' + x[2]).sort();
    const wanted = Object.values(manifest.options).flat().filter(o => o.unlock).map(o => o.id + '>' + o.unlock).sort();
    assert.deepEqual(rewards, wanted, 'reward parts and their stamps');
  } finally {
    for (const c of clients) await c.end().catch(() => {});
    await admin.query('drop database if exists ' + dbName + ' with (force)').catch(() => {});
    await admin.end();
  }
});
