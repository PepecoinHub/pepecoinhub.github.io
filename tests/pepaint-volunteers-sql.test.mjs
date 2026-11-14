// Optional PostgreSQL test for games/supabase/update_pepaint_volunteers.sql (PEPaint "who draws": volunteers).
// Loads the whole games schema (schema.sql and the live updates it builds on) into a fresh database, with small
// stand-ins for Supabase's auth and realtime. Never point it at Supabase.
//   PASSPORT_PG_URL=postgres://postgres@localhost:5432/postgres \
//   PASSPORT_PG_MODULE=/abs/path/node_modules/pg/lib/index.js \
//   node --test tests/pepaint-volunteers-sql.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const URL_ENV = process.env.PASSPORT_PG_URL, MOD_ENV = process.env.PASSPORT_PG_MODULE;
const read = p => readFile(new URL('../games/supabase/' + p, import.meta.url), 'utf8');
const STUBS = `
  do $$ begin create role anon nologin; exception when others then null; end $$;
  do $$ begin create role authenticated nologin; exception when others then null; end $$;
  do $$ begin create role service_role nologin; exception when others then null; end $$;
  create schema if not exists auth; create schema if not exists extensions; create schema if not exists realtime;
  create table if not exists auth.users(id uuid primary key, is_anonymous boolean default false, raw_user_meta_data jsonb default '{}', created_at timestamptz default now());
  create table if not exists auth.identities(user_id uuid, provider text, provider_id text, identity_data jsonb, id uuid default gen_random_uuid());
  create or replace function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
  create or replace function auth.jwt() returns jsonb language sql stable as $f$ select '{}'::jsonb $f$;
  create table if not exists realtime.messages(id bigserial, topic text, extension text, payload jsonb, event text, private boolean);
  create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true) returns void language sql as $f$ select null::void $f$;
  create or replace function realtime.topic() returns text language sql as $f$ select ''::text $f$;
  create extension if not exists pgcrypto with schema extensions;`;

test('PEPaint: volunteers draw next, otherwise the next in line', { skip: !(URL_ENV && MOD_ENV) && 'set PASSPORT_PG_URL and PASSPORT_PG_MODULE', timeout: 120000 }, async () => {
  const pg = (await import(MOD_ENV)).default;
  const admin = new pg.Client({ connectionString: URL_ENV }); await admin.connect();
  const name = 'pepaint_vol_' + process.pid + '_' + Date.now();
  await admin.query('create database ' + name);
  const url = new URL(URL_ENV); url.pathname = '/' + name;
  const db = new pg.Client({ connectionString: url.toString() }); await db.connect();
  try {
    await db.query(STUBS);
    for (const f of ['schema.sql', 'update_picture_plan.sql', 'update_pepaint_first_wins.sql', 'update_limits_cleanup.sql', 'update_pepaint_volunteers.sql']) await db.query(await read(f));
    await db.query(await read('update_pepaint_volunteers.sql'));   // safe to run again
    await db.query("insert into games.words(word) values ('frog'), ('lily pad'), ('moon'), ('crown'), ('fly'), ('pond') on conflict do nothing");
    const ids = [1, 2, 3].map(i => '00000000-0000-4000-8000-00000000000' + i);
    for (const id of ids) await db.query('insert into auth.users(id) values ($1)', [id]);
    const as = async (u, q, args = []) => {
      await db.query('begin');
      try {
        await db.query('set local role authenticated');
        await db.query("select set_config('request.jwt.claim.sub', $1, true)", [u]);
        await db.query("select set_config('request.headers', '{\"cf-connecting-ip\":\"1.2.3.4\"}', true)");
        const r = await db.query(q, args); await db.query('commit'); return r.rows[0] && r.rows[0].v;
      } catch (e) { await db.query('rollback'); throw e; }
    };
    const [A, B, C] = ids;
    const code = await as(A, "select public.gry_create_room('kalambury', 'Test room', 1, 60) as v");
    for (const [u, n] of [[A, 'Alpha'], [B, 'Bravo'], [C, 'Charlie']]) await as(u, 'select public.gry_join($1, $2) as v', [code, n]);
    const state = u => as(u, 'select public.gry_state($1) as v', [code]);
    // only the moderator, and only between games
    await assert.rejects(as(B, "select public.gry_draw_mode($1, 'volunteers') as v", [code]), /moderator/);
    assert.equal((await as(A, "select public.gry_draw_mode($1, 'volunteers') as v", [code])).ok, true);
    assert.equal((await state(B)).room.draw_mode, 'volunteers');
    await as(A, 'select public.gry_start($1) as v', [code]);
    let s = await state(A);
    assert.equal(s.room.phase, 'turn'); assert.equal(s.room.drawer_id, A);   // the first turn: first in line
    await assert.rejects(as(A, "select public.gry_draw_mode($1, 'turns') as v", [code]), /before the game/);
    // no volunteering during a turn
    assert.equal((await as(C, 'select public.gry_volunteer($1) as v', [code])).error, 'closed');
    await as(A, 'select public.gry_skip($1) as v', [code]);
    s = await state(B);
    assert.equal(s.room.phase, 'reveal'); assert.equal(s.next.volunteers, true); assert.equal(s.next.final, false);
    const left = (Date.parse(s.room.next_at) - Date.parse(s.now)) / 1000;
    assert.ok(left > 9 && left <= 10, 'a 10-second window, got ' + left);
    // the one who just drew cannot volunteer; the first other fren wins the spot
    assert.equal((await as(A, 'select public.gry_volunteer($1) as v', [code])).error, 'just_drew');
    assert.equal((await as(C, 'select public.gry_volunteer($1) as v', [code])).ok, true);
    assert.equal((await as(B, 'select public.gry_volunteer($1) as v', [code])).error, 'taken');
    s = await state(B); assert.equal(s.room.volunteer_id, C); assert.equal(s.next.nick, 'Charlie');
    // the break ends: Charlie draws (not Bravo, who would be next in line)
    await db.query('update games.rooms set next_at = now() - interval \'1 second\' where code = $1', [code]);
    await as(B, 'select public.gry_tick($1) as v', [code]);
    s = await state(B); assert.equal(s.room.phase, 'turn'); assert.equal(s.room.drawer_id, C); assert.equal(s.room.volunteer_id, null);
    // nobody volunteers: the next in line after Charlie (back to Alpha)
    await as(A, 'select public.gry_skip($1) as v', [code]);
    await db.query('update games.rooms set next_at = now() - interval \'1 second\' where code = $1', [code]);
    await as(B, 'select public.gry_tick($1) as v', [code]);
    s = await state(B); assert.equal(s.room.drawer_id, A); assert.equal(s.room.turn_no, 3);
    // 1 round x 3 players = 3 turns: after the third, the game ends
    await as(A, 'select public.gry_skip($1) as v', [code]);
    s = await state(B); assert.equal(s.next.final, true);
    await db.query('update games.rooms set next_at = now() - interval \'1 second\' where code = $1', [code]);
    await as(B, 'select public.gry_tick($1) as v', [code]);
    assert.equal((await state(B)).room.phase, 'finished');
    // 'turns' still works as before
    assert.equal((await as(A, "select public.gry_draw_mode($1, 'turns') as v", [code])).ok, true);
    await as(A, 'select public.gry_start($1) as v', [code]);
    await as(A, 'select public.gry_skip($1) as v', [code]);
    s = await state(B); assert.equal(s.next.volunteers, undefined); assert.equal(s.next.nick, 'Bravo');
    const left2 = (Date.parse(s.room.next_at) - Date.parse(s.now)) / 1000;
    assert.ok(left2 > 6 && left2 <= 6.5, 'the usual 6.5 s break, got ' + left2);
  } finally {
    await db.end(); await admin.query('drop database ' + name + ' with (force)'); await admin.end();
  }
});
