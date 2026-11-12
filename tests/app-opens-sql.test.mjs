// Optional PostgreSQL integration test for games/supabase/update_app_opens.sql (PondOS window-open counter + usage report).
//   PASSPORT_PG_URL=postgres://postgres:pw@localhost:5432/postgres \
//   PASSPORT_PG_MODULE=/abs/path/node_modules/pg/lib/index.js \
//   node --test tests/app-opens-sql.test.mjs
// It creates and drops its own database. Never point it at Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const URL_ENV = process.env.PASSPORT_PG_URL, MOD_ENV = process.env.PASSPORT_PG_MODULE;
const read = p => readFile(new URL('../' + p, import.meta.url), 'utf8');

test('PondOS app opens: anonymous +1 per app and day, owner-only report',
  { skip: !(URL_ENV && MOD_ENV) && 'set PASSPORT_PG_URL and PASSPORT_PG_MODULE', timeout: 120000 }, async () => {
  const pg = (await import(MOD_ENV)).default;
  const admin = new pg.Client({ connectionString: URL_ENV }); await admin.connect();
  const dbName = 'app_opens_test_' + process.pid + '_' + Date.now();
  await admin.query('create database ' + dbName);
  const url = new URL(URL_ENV); url.pathname = '/' + dbName;
  const db = new pg.Client({ connectionString: url.toString() }); await db.connect();
  try {
    await db.query(`
      do $$ begin create role anon nologin; exception when duplicate_object or unique_violation then null; end $$;
      do $$ begin create role authenticated nologin; exception when duplicate_object or unique_violation then null; end $$;
      create schema auth; create schema games;
      create table auth.users(id uuid primary key);
      create table auth.identities(user_id uuid references auth.users(id) on delete cascade, provider text not null, provider_id text not null);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth, games to anon, authenticated;
      create table games.config (id int primary key); insert into games.config values (1);
      create table games.host_discord (discord_id text primary key); insert into games.host_discord values ('owner1');
      -- a few of the real game tables (only the columns the report reads); the others are missing on purpose
      create table games.wp_plays (puzzle_id bigint, user_id uuid, started_at timestamptz, guessed_at timestamptz);
      create table games.lobby_chat (user_id uuid, created_at timestamptz);
      create table games.tables (code text primary key, game text, p1 uuid, p2 uuid, created_at timestamptz);`);
    await db.query(await read('games/supabase/update_page_stats.sql'));
    const sql = await read('games/supabase/update_app_opens.sql');
    await db.query(sql);
    await db.query(sql);   // safe to run again

    const uid = i => '00000000-0000-4000-8000-' + String(i).padStart(12, '0');
    for (const i of [1, 2, 3]) await db.query('insert into auth.users values ($1)', [uid(i)]);
    await db.query("insert into auth.identities values ($1, 'discord', 'owner1'), ($2, 'discord', 'someone')", [uid(1), uid(2)]);
    const call = async (user, q, args = [], role = 'authenticated') => {
      await db.query('begin');
      try {
        await db.query('set local role ' + role);
        await db.query("select set_config('request.jwt.claim.sub', $1, true)", [user ? uid(user) : '']);
        const r = await db.query(q, args); await db.query('commit'); return r.rows[0] && r.rows[0].v;
      } catch (e) { await db.query('rollback'); throw e; }
    };
    const open = (app, role = 'anon') => call(null, 'select public.gry_open($1) as v', [app], role);

    // guests count; junk names are ignored
    for (const a of ['desktop', 'desktop', 'dg', 'DG', 'wp', 'bg-chess']) await open(a);
    await open('lan', 'authenticated');
    for (const a of ['', null, 'x'.repeat(40), '-dash', 'a b', 'pass:port', '<script>']) await open(a);
    const rows = (await db.query('select app, opens from games.app_daily order by app')).rows;
    assert.deepEqual(rows.map(r => [r.app, r.opens]), [['bg-chess', 1], ['desktop', 2], ['dg', 2], ['lan', 1], ['wp', 1]]);

    // nobody reads or writes the table directly
    await assert.rejects(call(null, 'select count(*) as v from games.app_daily', [], 'anon'), /permission denied/);
    await assert.rejects(call(2, "insert into games.app_daily values (current_date, 'x', 99) returning 1 as v"), /permission denied/);
    await assert.rejects(call(2, 'select count(*) as v from games.usage_report(30)'), /permission denied/);

    // at most 120 different names per day; existing ones still count
    for (let i = 0; i < 130; i++) await open('spam-' + i);
    assert.equal(+(await db.query('select count(*) c from games.app_daily')).rows[0].c, 120);
    await open('dg');
    assert.equal((await db.query("select opens from games.app_daily where app = 'dg'")).rows[0].opens, 3);

    // report from the game tables
    await db.query(`insert into games.wp_plays values (1, $1, now(), now()), (1, $2, now(), null), (2, $1, now() - interval '40 days', now() - interval '40 days')`, [uid(1), uid(2)]);
    await db.query('insert into games.lobby_chat values ($1, now()), ($1, now()), ($2, now())', [uid(1), uid(2)]);
    await db.query("insert into games.tables values ('t1', 'chess', $1, $2, now()), ('t2', 'chess', $1, null, now())", [uid(1), uid(2)]);

    // only the owner gets the statistics
    await assert.rejects(call(2, 'select public.gry_usage(30) as v'), /Only the site owner/);
    await assert.rejects(call(null, 'select public.gry_usage(30) as v', [], 'anon'), /permission denied/);
    const u = await call(1, 'select public.gry_usage(30) as v');
    const f = Object.fromEntries(u.report.map(r => [r.feature, [r.actions, r.people]]));
    assert.deepEqual(f['Pepe Guesser'], [1, 2]);
    assert.deepEqual(f['LAN Party chat'], [3, 2]);
    assert.deepEqual(f['Board games: chess'], [2, 2]);
    assert.equal(Object.keys(f).length, 3, 'missing tables are skipped');
    assert.equal(u.opens.find(o => o.app === 'desktop').opens, 2);
  } finally {
    await db.end();
    await admin.query('drop database if exists ' + dbName);
    await admin.end();
  }
});
