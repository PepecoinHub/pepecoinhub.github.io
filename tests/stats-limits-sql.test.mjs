// Optional PostgreSQL integration test for games/supabase/update_stats_limits.sql (page counter without a browser ID,
// daily limits per network) and update_applied_sql.sql.
//   PASSPORT_PG_URL=postgres://postgres:pw@localhost:5432/postgres \
//   PASSPORT_PG_MODULE=/abs/path/node_modules/pg/lib/index.js \
//   node --test tests/stats-limits-sql.test.mjs
// It creates and drops its own database. Never point it at Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const URL_ENV = process.env.PASSPORT_PG_URL, MOD_ENV = process.env.PASSPORT_PG_MODULE;
const read = p => readFile(new URL('../' + p, import.meta.url), 'utf8');

test('page and window counters: daily visitor code from the IP, limits, applied_sql list',
  { skip: !(URL_ENV && MOD_ENV) && 'set PASSPORT_PG_URL and PASSPORT_PG_MODULE', timeout: 120000 }, async () => {
  const pg = (await import(MOD_ENV)).default;
  const admin = new pg.Client({ connectionString: URL_ENV }); await admin.connect();
  const dbName = 'stats_limits_test_' + process.pid + '_' + Date.now();
  await admin.query('create database ' + dbName);
  const url = new URL(URL_ENV); url.pathname = '/' + dbName;
  const db = new pg.Client({ connectionString: url.toString() }); await db.connect();
  try {
    const schema = await read('games/supabase/schema.sql');
    const ipFn = schema.slice(schema.indexOf('create or replace function games.client_ip_hash()'));
    await db.query(`
      do $$ begin create role anon nologin; exception when duplicate_object or unique_violation then null; end $$;
      do $$ begin create role authenticated nologin; exception when duplicate_object or unique_violation then null; end $$;
      create schema auth; create schema games;
      create table auth.users(id uuid primary key);
      create table auth.identities(user_id uuid references auth.users(id) on delete cascade, provider text not null, provider_id text not null);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth, games to anon, authenticated;
      create table games.config (id int primary key, host_code_salt text not null default 'salt'); insert into games.config values (1);
      create table games.host_discord (discord_id text primary key);
      ${ipFn.slice(0, ipFn.indexOf('end $$;') + 7)}`);
    await db.query(await read('games/supabase/update_applied_sql.sql'));
    await db.query(await read('games/supabase/update_page_stats.sql'));
    await db.query(await read('games/supabase/update_app_opens.sql'));
    const sql = await read('games/supabase/update_stats_limits.sql');
    await db.query(sql);
    await db.query(sql);   // safe to run again

    const call = async (ip, q, args = []) => {
      await db.query('begin');
      try {
        await db.query('set local role anon');
        await db.query("select set_config('request.headers', $1, true)", [ip ? JSON.stringify({ 'x-forwarded-for': ip + ', 10.0.0.1' }) : '']);
        const r = await db.query(q, args); await db.query('commit'); return r.rows[0];
      } catch (e) { await db.query('rollback'); throw e; }
    };
    const pv = (ip, path, visitor) => call(ip, visitor === undefined ? 'select public.gry_pv(p_path => $1)' : 'select public.gry_pv($1, $2)',
      visitor === undefined ? [path] : [path, visitor]);
    const open = (ip, app) => call(ip, 'select public.gry_open($1)', [app]);
    const daily = async path => (await db.query("select views, people from games.page_daily where path = $1", [path])).rows[0];

    // people = different networks; the old browser number is ignored
    await pv('1.1.1.1', '/index.html');
    await pv('1.1.1.1', '/', 'old-browser-number-123');
    await pv('1.1.1.1', '/price.html');
    await pv('2.2.2.2', '/');
    assert.deepEqual(await daily('*'), { views: 4, people: 2 });
    assert.deepEqual(await daily('/'), { views: 3, people: 2 });
    assert.deepEqual(await daily('/price.html'), { views: 1, people: 1 });

    // no raw IP and no static hash is stored: codes are 32 hex chars made with today's salt
    const codes = (await db.query('select distinct visitor from games.page_seen')).rows.map(r => r.visitor);
    assert.equal(codes.length, 2);
    for (const c of codes) assert.match(c, /^[0-9a-f]{32}$/);
    const staticHash = (await db.query("select set_config('request.headers', '{\"x-real-ip\":\"1.1.1.1\"}', false), games.client_ip_hash() h")).rows[0].h;
    assert.ok(!codes.includes(staticHash) && !codes.includes(staticHash.slice(0, 32)));

    // a new day = a new salt = a different code for the same network
    const before = (await db.query("select stat_salt from games.config")).rows[0].stat_salt;
    await db.query("update games.config set stat_salt_day = stat_salt_day - 1");
    await pv('3.3.3.3', '/');
    assert.notEqual((await db.query("select stat_salt from games.config")).rows[0].stat_salt, before);

    // limit: 300 views per network per day, others still count
    for (let i = 0; i < 310; i++) await pv('4.4.4.4', '/mining.html');
    assert.equal((await daily('/mining.html')).views, 300);
    await pv('5.5.5.5', '/mining.html');
    assert.equal((await daily('/mining.html')).views, 301);

    // limit: 600 window opens per network per day
    for (let i = 0; i < 605; i++) await open('6.6.6.6', 'desktop');
    await open('7.7.7.7', 'desktop');
    assert.equal((await db.query("select opens from games.app_daily where app = 'desktop'")).rows[0].opens, 601);

    // at most 400 different paths per day; the rest only in the total
    const totalBefore = (await daily('*')).views;
    for (let i = 0; i < 410; i++) await pv('8.8.8.' + (i % 200), '/spam-' + i);
    assert.equal(+(await db.query("select count(*) c from games.page_daily where path <> '*'")).rows[0].c, 400);
    assert.equal((await daily('*')).views, totalBefore + 410);

    // junk paths do nothing; nobody reads the tables directly
    await pv('1.1.1.1', '<script>');
    await assert.rejects(call('1.1.1.1', 'select count(*) from games.stat_hits'), /permission denied/);
    await assert.rejects(call('1.1.1.1', 'select count(*) from games.applied_sql'), /permission denied/);
    await assert.rejects(call('1.1.1.1', "select games.mark_applied('x.sql')"), /permission denied/);

    // applied_sql: the files marked themselves (stats file twice, because it ran twice)
    const files = (await db.query('select file, count(*)::int n from games.applied_sql group by file order by file')).rows;
    assert.deepEqual(files, [{ file: 'update_applied_sql.sql', n: 1 }, { file: 'update_stats_limits.sql', n: 2 }]);
  } finally {
    await db.end();
    await admin.query('drop database if exists ' + dbName);
    await admin.end();
  }
});
