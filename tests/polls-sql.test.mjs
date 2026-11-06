// Optional PostgreSQL integration test for games/supabase/update_polls.sql (the Pond Gazette polls).
//   PASSPORT_PG_URL=postgres://postgres:pw@localhost:5432/postgres \
//   PASSPORT_PG_MODULE=/abs/path/node_modules/pg/lib/index.js \
//   node --test tests/polls-sql.test.mjs
// It creates and drops its own database. Never point it at Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const URL_ENV = process.env.PASSPORT_PG_URL, MOD_ENV = process.env.PASSPORT_PG_MODULE;
const read = p => readFile(new URL('../' + p, import.meta.url), 'utf8');

test('Gazette polls: everyone votes once (guests once per network), counts hidden until you vote or it closes',
  { skip: !(URL_ENV && MOD_ENV) && 'set PASSPORT_PG_URL and PASSPORT_PG_MODULE', timeout: 120000 }, async () => {
  const pg = (await import(MOD_ENV)).default;
  const admin = new pg.Client({ connectionString: URL_ENV }); await admin.connect();
  const dbName = 'polls_test_' + process.pid + '_' + Date.now();
  await admin.query('create database ' + dbName);
  const url = new URL(URL_ENV); url.pathname = '/' + dbName;
  const db = new pg.Client({ connectionString: url.toString() }); await db.connect();
  try {
    await db.query(`
      do $$ begin create role anon nologin; exception when duplicate_object or unique_violation then null; end $$;
      do $$ begin create role authenticated nologin; exception when duplicate_object or unique_violation then null; end $$;
      create schema auth; create schema games;
      create table auth.users(id uuid primary key);
      create table auth.identities(user_id uuid references auth.users(id) on delete cascade, provider text not null, provider_id text not null, identity_data jsonb not null default '{}');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth, games to anon, authenticated;`);
    const schema = await read('games/supabase/schema.sql');
    await db.query(schema.match(/create or replace function games\.discord_identity\(u uuid\)[\s\S]*?\n\$\$;/)[0]);
    await db.query("create table games.config (id int primary key, host_code_salt text not null); insert into games.config values (1, 'test-salt')");
    await db.query(schema.match(/create or replace function games\.client_ip_hash\(\)[\s\S]*?\nend \$\$;/)[0]);
    const sql = await read('games/supabase/update_polls.sql');
    await db.query(sql);
    const closes = (await db.query("select closes_at from games.polls where id = 'like_polls'")).rows[0].closes_at;
    await db.query(sql);   // again: the seed keeps its first closing time
    assert.equal(+(await db.query("select closes_at from games.polls where id = 'like_polls'")).rows[0].closes_at, +closes);
    assert.ok(+closes - Date.now() > 47.9 * 3600e3 && +closes - Date.now() <= 48 * 3600e3, 'closes in 2 days');

    const uid = i => '00000000-0000-4000-8000-' + String(i).padStart(12, '0');
    for (const i of [1, 2, 3, 4, 5, 6, 7]) await db.query('insert into auth.users values ($1)', [uid(i)]);
    for (const i of [1, 2, 3]) await db.query("insert into auth.identities values ($1, 'discord', $2)", [uid(i), 'd' + i]);   // 4-7 are guests
    // the network each request comes from (PostgREST passes the headers to the database)
    const NET = { 1: '1.1.1.1', 2: '2.2.2.2', 3: '9.9.9.9', 4: '9.9.9.9', 5: '9.9.9.9', 6: '6.6.6.6', 7: null };
    const call = async (user, q, args = [], role = 'authenticated') => {
      await db.query('begin');
      try {
        await db.query('set local role ' + role);
        await db.query("select set_config('request.jwt.claim.sub', $1, true)", [user ? uid(user) : '']);
        await db.query("select set_config('request.headers', $1, true)", [user && NET[user] ? JSON.stringify({ 'cf-connecting-ip': NET[user] }) : '{}']);
        const r = await db.query(q, args); await db.query('commit'); return r.rows[0] && r.rows[0].v;
      } catch (e) { await db.query('rollback'); throw e; }
    };
    const view = (u, role) => call(u, "select public.gry_poll('like_polls') as v", [], role);
    const vote = (u, c) => call(u, "select public.gry_poll_vote('like_polls', $1) as v", [c]);

    // before voting: question and options, no counts
    const v0 = await view(1);
    assert.equal(v0.question, 'Do you like polls?'); assert.equal(v0.open, true); assert.equal(v0.can_vote, true);
    assert.deepEqual(v0.options.map(o => [o.id, o.label, o.votes]), [['yes', 'Yes', null], ['no', 'No', null]]);
    assert.equal(v0.total, null); assert.equal(v0.show_results, false);
    assert.equal((await view(null, 'anon')).can_vote, false);
    assert.equal(await call(1, "select public.gry_poll('nope') as v"), null);

    // visitors without any session and bad answers cannot vote
    assert.equal((await view(4)).can_vote, true, 'guests can vote');
    await assert.rejects(call(null, "select public.gry_poll_vote('like_polls', 'yes') as v", [], 'anon'), /permission denied/);
    await assert.rejects(vote(1, 'maybe'), /Unknown answer/);
    await assert.rejects(vote(1, null), /Unknown answer/);
    await assert.rejects(call(1, "select public.gry_poll_vote('nope', 'yes') as v"), /Unknown poll/);
    // no direct table access
    await assert.rejects(call(1, "insert into games.poll_votes values ('like_polls', $1, 'yes') returning 1 as v", [uid(2)]), /permission denied/);
    await assert.rejects(call(1, 'select count(*) as v from games.poll_votes'), /permission denied/);

    // a vote shows the counts to the voter; a second vote changes nothing
    const v1 = await vote(1, 'yes');
    assert.equal(v1.my_choice, 'yes'); assert.equal(v1.can_vote, false); assert.equal(v1.total, 1);
    assert.deepEqual(v1.options.map(o => o.votes), [1, 0]);
    const again = await vote(1, 'no');
    assert.equal(again.my_choice, 'yes'); assert.deepEqual(again.options.map(o => o.votes), [1, 0]);
    await vote(2, 'no'); await vote(3, 'yes');
    assert.equal((await view(4)).show_results, false, 'not voted, still open: no counts');
    assert.deepEqual((await view(2)).options.map(o => o.votes), [2, 1]);
    // guests: one vote each, and one guest vote per network (a Discord player on that network does not count)
    const g = await vote(4, 'no');
    assert.equal(g.my_choice, 'no'); assert.deepEqual(g.options.map(o => o.votes), [2, 2]);
    await assert.rejects(vote(5, 'yes'), /A guest on your network has already voted/);
    assert.equal((await vote(4, 'yes')).my_choice, 'no', 'a guest vote is final too');
    assert.equal((await vote(6, 'yes')).my_choice, 'yes', 'another network');
    await assert.rejects(vote(7, 'yes'), /Log on with Discord/, 'a guest with no known network cannot vote');
    const rows = (await db.query("select user_id, verified, ip_hash is not null as has_ip from games.poll_votes order by user_id")).rows.map(r => [r.verified, r.has_ip]);
    assert.deepEqual(rows, [[true, false], [true, false], [true, false], [false, true], [false, true]], 'Discord votes keep no network hash');

    // closed: no more votes, results for everyone (guests and visitors too)
    await db.query("update games.polls set opens_at = now() - interval '3 days', closes_at = now() - interval '1 minute' where id = 'like_polls'");
    await assert.rejects(vote(5, 'yes'), /closed/);
    const closed = await view(null, 'anon');
    assert.equal(closed.open, false); assert.equal(closed.total, 5); assert.deepEqual(closed.options.map(o => o.votes), [3, 2]);

    // grants and definer settings
    const priv = (await db.query(`select
      has_function_privilege('anon', 'public.gry_poll(text)', 'EXECUTE') as anon_read,
      has_function_privilege('anon', 'public.gry_poll_vote(text,text)', 'EXECUTE') as anon_vote,
      has_function_privilege('authenticated', 'games.poll_view(games.polls,uuid)', 'EXECUTE') as helper,
      (select proconfig from pg_proc where oid = 'public.gry_poll_vote(text,text)'::regprocedure) as cfg`)).rows[0];
    assert.deepEqual(priv, { anon_read: true, anon_vote: false, helper: false, cfg: ['search_path=""'] });
    // deleting an account removes its vote
    await db.query('delete from auth.users where id = $1', [uid(2)]);
    assert.deepEqual((await view(null, 'anon')).options.map(o => o.votes), [3, 1]);
  } finally {
    await db.end().catch(() => {});
    await admin.query('drop database if exists ' + dbName + ' with (force)').catch(() => {});
    await admin.end();
  }
});
