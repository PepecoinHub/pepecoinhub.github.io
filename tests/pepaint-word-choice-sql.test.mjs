// Optional PostgreSQL test for games/supabase/update_pepaint_word_choice.sql (PEPaint: the artist picks 1 of 3 words).
// Loads the whole games schema (schema.sql and the live updates it builds on) into a fresh database, with small
// stand-ins for Supabase's auth and realtime. Never point it at Supabase.
//   PASSPORT_PG_URL=postgres://postgres@localhost:5432/postgres \
//   PASSPORT_PG_MODULE=/abs/path/node_modules/pg/lib/index.js \
//   node --test tests/pepaint-word-choice-sql.test.mjs
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

test('PEPaint: pick one of three words, ×1.5 / ×2 bonus, easy word when time is up', { skip: !(URL_ENV && MOD_ENV) && 'set PASSPORT_PG_URL and PASSPORT_PG_MODULE', timeout: 120000 }, async () => {
  const pg = (await import(MOD_ENV)).default;
  const admin = new pg.Client({ connectionString: URL_ENV }); await admin.connect();
  const name = 'pepaint_wc_' + process.pid + '_' + Date.now();
  await admin.query('create database ' + name);
  const url = new URL(URL_ENV); url.pathname = '/' + name;
  const db = new pg.Client({ connectionString: url.toString() }); await db.connect();
  try {
    await db.query(STUBS);
    for (const f of ['schema.sql', 'update_picture_plan.sql', 'update_pepaint_first_wins.sql', 'update_limits_cleanup.sql', 'update_pepaint_volunteers.sql', 'update_pepaint_top.sql']) await db.query(await read(f));
    await db.query("insert into games.words(word) values ('frog'), ('lily pad'), ('moon'), ('crown'), ('fly'), ('pond') on conflict do nothing");
    await db.query("insert into games.words(word, category) values ('frog on a rocket', 'pepe'), ('hot dog', 'food') on conflict do nothing");
    await db.query(await read('update_pepaint_word_choice.sql'));
    await db.query(await read('update_pepaint_word_choice.sql'));   // safe to run again
    const tiers = (await db.query('select difficulty d, count(*)::int n from games.words group by 1 order by 1')).rows;
    assert.deepEqual(tiers.map(x => x.d), [1, 2, 3]);
    assert.equal((await db.query("select difficulty v from games.words where word = 'frog on a rocket'")).rows[0].v, 2, 'Pepe phrases are medium');
    assert.equal((await db.query("select difficulty v from games.words where word = 'hot dog'")).rows[0].v, 1, 'everyday compound nouns stay easy');
    assert.equal((await db.query("select difficulty v from games.words where word = 'frog'")).rows[0].v, 1);
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
    const code = await as(A, "select public.gry_create_room('kalambury', 'Test room', 2, 60) as v");
    for (const [u, n] of [[A, 'Alpha'], [B, 'Bravo'], [C, 'Charlie']]) await as(u, 'select public.gry_join($1, $2) as v', [code, n]);
    await db.query('update games.config set dg_message_cooldown_seconds = 0');
    const state = u => as(u, 'select public.gry_state($1) as v', [code]);
    const msgs = async () => (await db.query('select body from games.messages where room_code = $1 order by id', [code])).rows.map(x => x.body);
    await as(A, 'select public.gry_start($1) as v', [code]);

    // picking: the artist sees three words (easy, medium, hard), nobody else does, nobody can guess yet
    let s = await state(A);
    assert.equal(s.room.phase, 'turn'); assert.equal(s.room.drawer_id, A); assert.equal(s.secret, ''); assert.equal(s.mask, '');
    const pickLeft = (Date.parse(s.room.turn_started_at) - Date.parse(s.now)) / 1000;
    assert.ok(pickLeft > 11 && pickLeft <= 12, '12 s to pick, got ' + pickLeft);
    assert.equal(Math.round((Date.parse(s.room.turn_ends_at) - Date.parse(s.room.turn_started_at)) / 1000), 60, 'the full drawing time after the pick');
    const ch = await as(A, 'select public.gry_word_choices($1) as v', [code]);
    assert.deepEqual(ch.choices.map(c => [c.tier, c.mult]), [[1, 1], [2, 1.5], [3, 2]]);
    assert.equal(new Set(ch.choices.map(c => c.word)).size, 3);
    assert.equal(await as(B, 'select public.gry_word_choices($1) as v', [code]), null);
    assert.equal((await state(B)).secret, null);
    await assert.rejects(as(B, 'select public.gry_guess($1, $2) as v', [code, ch.choices[2].word]), /Wait/);
    assert.equal((await as(B, 'select public.gry_pick_word($1, 3) as v', [code])).error, 'wait', 'only the artist picks before time is up');
    assert.ok((await msgs()).some(m => /Alpha is picking a word/.test(m)));

    // the artist picks the hard word: the drawing clock starts now, points ×2
    const hard = ch.choices[2].word;
    const pk = await as(A, 'select public.gry_pick_word($1, 3) as v', [code]);
    assert.equal(pk.ok, true); assert.equal(pk.tier, 3); assert.equal(Number(pk.mult), 2);
    assert.equal((await as(A, 'select public.gry_pick_word($1, 1) as v', [code])).error, 'picked', 'one pick per turn');
    s = await state(A); assert.equal(s.secret, hard);
    const drawLeft = (Date.parse(s.room.turn_ends_at) - Date.parse(s.now)) / 1000;
    assert.ok(drawLeft > 59 && drawLeft <= 60, 'drawing time starts at the pick, got ' + drawLeft);
    assert.match((await state(B)).mask, /_/);
    assert.equal(await as(A, 'select public.gry_word_choices($1) as v', [code]), null);
    // the drawer still cannot spoil it
    await assert.rejects(as(A, 'select public.gry_guess($1, $2) as v', [code, 'it is ' + hard]), /give away/);

    // Bravo guesses: normal points + the same again as a hard-word bonus, for the artist too
    const g = await as(B, 'select public.gry_guess($1, $2) as v', [code, hard]);
    assert.equal(g.correct, true);
    const sc = Object.fromEntries((await db.query('select user_id, score from games.players where room_code = $1', [code])).rows.map(x => [x.user_id, x.score]));
    assert.equal(sc[B], g.points * 2, 'guesser ×2');
    assert.ok(sc[A] >= 50 && sc[A] <= 100 && sc[A] % 2 === 0, 'artist ×2, got ' + sc[A]);
    assert.ok((await msgs()).some(m => /Hard word bonus \(×2\): \+\d+ guesser, \+\d+ artist/.test(m)));
    s = await state(C); assert.equal(s.room.phase, 'reveal'); assert.equal(s.room.last_answer, hard);
    assert.equal((await db.query('select word_mult::float v from games.rooms where code = $1', [code])).rows[0].v, 1);

    // next turn (Bravo): nobody picks in time; anyone settles it with the easy word, normal points
    await db.query("update games.rooms set next_at = now() - interval '1 second' where code = $1", [code]);
    await as(C, 'select public.gry_tick($1) as v', [code]);
    s = await state(B); assert.equal(s.room.drawer_id, B); assert.equal(s.secret, '');
    const ch2 = await as(B, 'select public.gry_word_choices($1) as v', [code]);
    assert.ok(!ch2.choices.some(c => c.word === hard), 'a word is not offered twice in a game');
    await db.query("update games.rooms set turn_started_at = now() - interval '1 second' where code = $1", [code]);
    const auto = await as(C, 'select public.gry_pick_word($1, 3) as v', [code]);
    assert.equal(auto.ok, true); assert.equal(auto.auto, true); assert.equal(auto.tier, 1, 'time is up: the easy word, whatever was asked');
    assert.equal((await state(B)).secret, ch2.choices[0].word);
    const before = (await db.query('select score from games.players where room_code = $1 and user_id = $2', [code, C])).rows[0].score;
    const g2 = await as(C, 'select public.gry_guess($1, $2) as v', [code, ch2.choices[0].word]);
    const after = (await db.query('select score from games.players where room_code = $1 and user_id = $2', [code, C])).rows[0].score;
    assert.equal(after - before, g2.points, 'easy word: no bonus');

    // a skipped turn while picking: no word, no bonus, the game goes on
    await db.query("update games.rooms set next_at = now() - interval '1 second' where code = $1", [code]);
    await as(A, 'select public.gry_tick($1) as v', [code]);
    s = await state(C); assert.equal(s.room.drawer_id, C);
    await as(C, 'select public.gry_skip($1) as v', [code]);
    s = await state(A); assert.equal(s.room.phase, 'reveal'); assert.equal(s.room.last_answer, null);
    assert.ok((await msgs()).some(m => /Turn skipped\. No word was picked\./.test(m)));
    // time's up during the pick and nobody settled it: the turn ends normally
    await db.query("update games.rooms set next_at = now() - interval '1 second' where code = $1", [code]);
    await as(A, 'select public.gry_tick($1) as v', [code]);
    await db.query("update games.rooms set turn_ends_at = now() - interval '1 second' where code = $1", [code]);
    await as(B, 'select public.gry_tick($1) as v', [code]);
    assert.equal((await state(A)).room.phase, 'reveal');
    // grants
    const gr = (await db.query("select has_function_privilege('anon','public.gry_pick_word(text,int)','execute') a, has_function_privilege('authenticated','public.gry_pick_word(text,int)','execute') b")).rows[0];
    assert.deepEqual(gr, { a: false, b: true });
  } finally { await db.end(); await admin.query('drop database ' + name); await admin.end(); }
});
