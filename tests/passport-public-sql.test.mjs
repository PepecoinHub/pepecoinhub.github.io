// Optional PostgreSQL integration test for games/supabase/update_passport_public.sql (looking at another
// fren's passport). It loads the real game migrations and the Passport files, fills one fren's passport
// through the real RPCs and checks what another fren can see.
// Needs a disposable PostgreSQL server (15+) and node-postgres, like tests/passport-awards-sql.test.mjs:
//   PASSPORT_PG_URL=postgres://postgres:pw@localhost:5432/postgres \
//   PASSPORT_PG_MODULE=/abs/path/node_modules/pg/lib/index.js \
//   node --test tests/passport-public-sql.test.mjs
// It creates and drops its own database. Never point it at Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const URL_ENV = process.env.PASSPORT_PG_URL;
const MOD_ENV = process.env.PASSPORT_PG_MODULE;
const read = p => readFile(new URL('../' + p, import.meta.url), 'utf8');

const SUPABASE_STUB = `
-- roles are shared by the whole server and the SQL tests run in parallel, so a race is not an error
do $$ begin create role anon nologin; exception when duplicate_object or unique_violation then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object or unique_violation then null; end $$;
create schema auth;
create table auth.users(id uuid primary key, created_at timestamptz not null default now(), is_anonymous boolean not null default false);
create table auth.identities(user_id uuid references auth.users(id) on delete cascade, provider text not null,
  provider_id text not null, identity_data jsonb not null default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated;
`;
const GAMES = ['schema.sql', 'update_yeet.sql', 'update_wheres_pepe.sql', 'update_wheres_pepe_guests.sql',
  'update_lobby_chat.sql', 'update_open_chat.sql', 'update_lobby_mentions.sql', 'update_frog_letters.sql',
  'update_letters_community.sql', 'update_miner_cloud.sql', 'update_fren_passport.sql', 'update_fren_avatar.sql'];
// what another fren may see; the owner's progress counters and the Discord id are not in it
const KEYS = ['achievements', 'achievements_earned', 'avatar', 'found', 'items', 'member_since', 'nick', 'nickname',
  'secrets', 'signed_in', 'user_id', 'yeet_best'];

test('Fren Passport public view: Discord frens only, read only, the owner\'s stamps without the private counters',
  { skip: !(URL_ENV && MOD_ENV) && 'set PASSPORT_PG_URL and PASSPORT_PG_MODULE', timeout: 180000 }, async () => {
  const pg = (await import(MOD_ENV)).default;
  const admin = new pg.Client({ connectionString: URL_ENV });
  await admin.connect();
  const dbName = 'passport_public_test_' + process.pid + '_' + Date.now();
  await admin.query('create database ' + dbName);
  const url = new URL(URL_ENV); url.pathname = '/' + dbName;
  const db = new pg.Client({ connectionString: url.toString() });
  await db.connect();
  try {
    await db.query(SUPABASE_STUB);
    for (const f of GAMES) await db.query(await read('games/supabase/' + f));
    const pub = await read('games/supabase/update_passport_public.sql');
    await db.query(pub);
    await db.query(pub);   // safe to run twice

    const uid = i => '00000000-0000-4000-8000-' + String(i).padStart(12, '0');
    const addUser = async (i, provider = 'discord', name = 'Fren' + i) => {
      await db.query("insert into auth.users(id, created_at) values ($1, now() - interval '30 days')", [uid(i)]);
      if (provider) await db.query('insert into auth.identities values ($1, $2, $3, $4)', [uid(i), provider, 'discord-secret-id-' + i, JSON.stringify({ full_name: name })]);
    };
    // one PostgREST-like request: a transaction with the role and JWT subject set locally
    const call = async (user, sql, args = [], role = 'authenticated') => {
      await db.query('begin');
      try {
        await db.query('set local role ' + role);
        await db.query("select set_config('request.jwt.claim.sub', $1, true)", [user ? uid(user) : '']);
        const r = await db.query(sql, args);
        await db.query('commit');
        return r.rows[0] && r.rows[0].v;
      } catch (e) { await db.query('rollback'); throw e; }
    };
    const look = (viewer, target) => call(viewer, 'select public.gry_passport_public($1::uuid) as v', [target]);
    const own = user => call(user, 'select public.gry_passport_state() as v');
    const earned = s => s.achievements.filter(a => a.earned_at).map(a => a.id + '@' + new Date(a.earned_at).toISOString()).sort();
    const count = async t => Number((await db.query('select count(*) as n from ' + t)).rows[0].n);
    const TABLES = ['games.passport_badges', 'games.passport_secrets', 'games.passport_items', 'games.passport_avatars', 'games.yeet_records'];
    const rows = async () => { const n = []; for (const t of TABLES) n.push(await count(t)); return n; };

    // 1 and 2 have Discord, 3 is an anonymous guest, 4 has e-mail only
    await addUser(1); await addUser(2); await addUser(3, null); await addUser(4, 'email');
    await db.query("insert into games.profiles(user_id, nick, nick_key) values ($1, 'PondNick2', 'pondnick2')", [uid(2)]);

    // --- access: browsers call only the RPC; anon cannot; it is read only
    const priv = (await db.query(`select
      has_function_privilege('anon', 'public.gry_passport_public(uuid)', 'EXECUTE') as anon_exec,
      has_function_privilege('authenticated', 'public.gry_passport_public(uuid)', 'EXECUTE') as user_exec,
      exists (select 1 from information_schema.routine_privileges where routine_name = 'gry_passport_public' and grantee = 'PUBLIC') as public_exec,
      (select prosecdef from pg_proc where oid = 'public.gry_passport_public(uuid)'::regprocedure) as definer,
      (select provolatile from pg_proc where oid = 'public.gry_passport_public(uuid)'::regprocedure) as volatility,
      (select proconfig from pg_proc where oid = 'public.gry_passport_public(uuid)'::regprocedure) as config,
      (select count(*)::int from pg_proc where proname = 'gry_passport_public') as overloads`)).rows[0];
    assert.deepEqual(priv, { anon_exec: false, user_exec: true, public_exec: false, definer: true, volatility: 's',
      config: ['search_path=""'], overloads: 1 });
    await assert.rejects(call(1, 'select public.gry_passport_public($1::uuid) as v', [uid(2)], 'anon'), /permission denied for function/);
    await assert.rejects(call(1, 'select count(*) as v from games.passport_badges'), /permission denied/);

    // --- who may look: Discord only
    assert.deepEqual(await look(null, uid(2)), { signed_in: false }, 'no session');
    assert.deepEqual(await look(3, uid(2)), { signed_in: false }, 'anonymous guest');
    assert.deepEqual(await look(4, uid(2)), { signed_in: false }, 'e-mail account');
    // --- who has a passport: Discord players only; unknown ids say nothing more
    assert.deepEqual(await look(1, uid(3)), { signed_in: true, found: false }, 'guest');
    assert.deepEqual(await look(1, uid(4)), { signed_in: true, found: false }, 'e-mail account');
    assert.deepEqual(await look(1, uid(99)), { signed_in: true, found: false }, 'no such user');
    assert.deepEqual(await look(1, null), { signed_in: true, found: false }, 'no id');

    // --- an empty passport: First Fren only
    const empty = await look(2, uid(1));
    assert.deepEqual(Object.keys(empty).sort(), KEYS);
    assert.equal(empty.user_id, uid(1)); assert.equal(empty.nickname, 'Fren1'); assert.equal(empty.nick, null);
    assert.equal(empty.avatar, null); assert.equal(empty.yeet_best, 0);
    assert.deepEqual(empty.secrets, []); assert.deepEqual(empty.items, []);
    assert.deepEqual(empty.achievements.map(a => a.id), ['first_fren']); assert.equal(empty.achievements_earned, 1);
    assert.deepEqual(earned(empty), earned(await own(1)), 'the same stamps the owner sees');

    // --- fren 2 fills the passport through the real game RPCs (before the awards migration)
    await call(2, "select public.gry_passport_avatar_save('bg_forest', 'clothing_camo', 'mouth_smirk', 'eyes_side', 'hat_bucket', 'accessory_round') as v");
    await call(2, 'select public.gry_yeet_submit(60000, 61000, 1) as v');
    await call(2, "select public.gry_passport_discover('wrong_frog') as v");
    await db.query("insert into games.passport_items(user_id, item_id, quantity) values ($1, 'moon_rock', 2)", [uid(2)]);
    const before = await rows();
    const v1 = await look(1, uid(2));
    assert.deepEqual(await rows(), before, 'looking writes nothing');
    assert.deepEqual(Object.keys(v1).sort(), KEYS);
    assert.equal(v1.nickname, 'Fren2', 'the same name as in the owner\'s own passport');
    assert.equal(v1.nick, 'PondNick2', 'the reserved chat nickname');
    assert.equal(v1.yeet_best, 60000);
    const mine1 = await own(2);
    assert.deepEqual(v1.avatar, mine1.avatar);
    assert.equal(v1.avatar.hat, 'hat_bucket');
    assert.equal(new Date(v1.member_since).getTime(), new Date(mine1.member_since).getTime());
    assert.deepEqual(v1.secrets.map(s => s.id), ['wrong_frog']); assert.ok(v1.secrets[0].discovered_at);
    assert.deepEqual(v1.items.map(i => [i.id, i.quantity]), [['moon_rock', 2]]);
    assert.deepEqual(v1.achievements.map(a => a.id).sort(), ['first_avatar', 'first_fren', 'moonwalker'], 'Moonwalker from the YEET record');
    assert.deepEqual(earned(v1), earned(mine1), 'the same stamps and dates the owner sees');
    assert.equal(v1.achievements.find(a => a.id === 'first_avatar').title, 'Fresh Fren');
    // nothing private: no counters, no Discord account id
    const text = JSON.stringify(v1);
    assert.doesNotMatch(text, /discord-secret-id|progress|login|streak|letters|chat_days|miner|notified/);

    // --- after the awards migration: stored stamps, Moonwalker once, and a chat stamp shows up
    await db.query(await read('games/supabase/update_passport_awards.sql'));
    await db.query(pub);   // order does not matter
    await db.query("insert into games.lobby_chat(user_id, nick, verified, body) values ($1, 'PondNick2', true, 'gm frens')", [uid(2)]);
    await call(2, 'select public.gry_passport_checkin() as v');
    const v2 = await look(1, uid(2));
    const ids = v2.achievements.map(a => a.id);
    assert.equal(ids.filter(x => x === 'moonwalker').length, 1, 'Moonwalker once');
    for (const x of ['first_fren', 'first_avatar', 'moonwalker', 'pond_pioneer', 'first_words']) assert.ok(ids.includes(x), x);
    const mine2 = await own(2);
    assert.deepEqual(earned(v2), earned(mine2), 'still the same as the owner sees');
    assert.ok(mine2.progress && mine2.progress.chat_days === 1, 'the owner keeps the counters');
    assert.equal(v2.progress, undefined, 'other frens do not get them');
    assert.equal(v2.achievements_earned, ids.length);

    // --- repeatable stamps (a 'times' column, as planned for Frog of the Week) are passed on
    await db.query('alter table games.passport_badges add column if not exists times integer not null default 1');
    await db.query("update games.passport_badges set times = 3 where user_id = $1 and badge_id = 'first_words'", [uid(2)]);
    const v3 = await look(1, uid(2));
    assert.equal(v3.achievements.find(a => a.id === 'first_words').times, 3);
    assert.equal(v3.achievements.find(a => a.id === 'first_fren').times, undefined);

    // --- looking at yourself works too; Discord unlinked means no passport any more
    assert.deepEqual(earned(await look(2, uid(2))), earned(mine2));
    await db.query('delete from auth.identities where user_id = $1', [uid(2)]);
    assert.deepEqual(await look(1, uid(2)), { signed_in: true, found: false });
  } finally {
    await db.end().catch(() => {});
    await admin.query('drop database if exists ' + dbName + ' with (force)').catch(() => {});
    await admin.end();
  }
});
