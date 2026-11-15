// Pond Quiz (games/supabase/update_pond_quiz.sql) on a disposable local PostgreSQL, with the made-up sample questions
// (tests/fixtures/pond-quiz-sample.json): the real questions are not in this repo.
//   PASSPORT_PG_URL=postgres://postgres:pw@localhost:5432/postgres PASSPORT_PG_MODULE=/abs/pg/lib/index.js \
//   node --test tests/pond-quiz-sql.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { prepare, addPlayer, callRpc, asDb, uid } from '../scripts/pepegochi_sim.mjs';
import { buildSql } from '../scripts/build_pond_quiz_sql.mjs';
const SAMPLE = JSON.parse(readFileSync(new URL('./fixtures/pond-quiz-sample.json', import.meta.url), 'utf8')).questions;
const QUESTIONS_SQL = buildSql(SAMPLE);

const URI = process.env.PASSPORT_PG_URL, MOD = process.env.PASSPORT_PG_MODULE;
const read = p => readFile(new URL('../' + p, import.meta.url), 'utf8');
const CLOCK = `create or replace function games.quiz_clock() returns timestamptz
language sql volatile set search_path = '' as $$
  select coalesce(nullif(current_setting('pepegochi.sim_now', true), '')::timestamptz, clock_timestamp()) $$;`;
const day = (d, h = 12) => new Date(Date.UTC(2026, 10, 13 + d, h));
// the Fren Passport the quiz stamps go through (as in tests/pepegochi-passport-sql.test.mjs)
const PASSPORT = ['update_yeet.sql', 'update_wheres_pepe.sql', 'update_wheres_pepe_guests.sql', 'update_lobby_chat.sql',
  'update_open_chat.sql', 'update_lobby_mentions.sql', 'update_frog_letters.sql', 'update_letters_community.sql',
  'update_miner_cloud.sql', 'update_fren_passport.sql', 'update_fren_avatar.sql', 'update_passport_awards.sql'];
const STAMPS = ['quiz_first', 'quiz_10', 'quiz_25', 'quiz_50', 'quiz_99'];

test('Pond Quiz: one question a day, +1 for a right answer, wrong ones come back, a fair ranking',
  { skip: !(URI && MOD) && 'set PASSPORT_PG_URL and PASSPORT_PG_MODULE', timeout: 300000 }, async t => {
  const pg = (await import(MOD)).default;
  const admin = new pg.Client({ connectionString: URI });
  await admin.connect();
  const name = 'pond_quiz_test_' + process.pid + '_' + Date.now();
  await admin.query('create database ' + name);
  const url = new URL(URI); url.pathname = '/' + name;
  const raw = new pg.Client({ connectionString: url.toString() });
  await raw.connect();
  const db = asDb(raw);
  const rows = async (q, a = []) => (await db.query(q, a)).rows;
  const call = (user, fn, now = day(0), role) => callRpc(db, { user, now, role }, 'public.' + fn);
  const ok = async (...a) => { const r = await call(...a); assert.ok(r.ok, r.error); return r.value; };
  const truth = async id => (await rows('select answers, correct from games.quiz_questions where id = $1', [id]))[0];
  // the shown index of the right (or a wrong) answer, found the way a cheater cannot: from the server's own table
  const shownIndex = async (v, right) => { const q = await truth(v.id); const good = q.answers[q.correct];
    return right ? v.answers.indexOf(good) : v.answers.findIndex(a => a !== good); };
  try {
    await prepare(db, { extra: PASSPORT });              // Supabase stub, schema.sql, Passport, PepeGochi v2, clock
    await db.exec(await read('games/supabase/update_pond_quiz.sql'));
    await db.exec(QUESTIONS_SQL);
    await db.exec(CLOCK);
    for (const n of [1, 2, 3, 4, 5]) await addPlayer(db, n);
    await addPlayer(db, 9, { provider: 'email' });
    const active = Number((await rows('select count(*) n from games.quiz_questions where active'))[0].n);
    assert.equal(active, 4, 'the sample: 4 asked, 1 dated and 1 without a source switched off');

    await t.test('only after the PepeGochi hatched: no frog, an egg, then the first care hatches it', async () => {
      assert.match((await call(5, 'gry_quiz_today()')).error, /Hatch your PepeGochi first/);
      await ok(5, "gry_pepegochi_adopt('Fren')", day(-2));
      assert.match((await call(5, 'gry_quiz_today()')).error, /Hatch your PepeGochi first/, 'an egg is not enough');
      assert.match((await call(5, 'gry_quiz_answer(0)')).error, /Hatch your PepeGochi first/);
      // players 1-5 hatch their frogs the normal way (adopt, then a first care two days later)
      for (const n of [1, 2, 3, 4]) await ok(n, "gry_pepegochi_adopt('Fren')", day(-2));
      for (const n of [1, 2, 3, 4, 5]) await ok(n, "gry_pepegochi_action('feed')", day(-1));
      assert.equal((await ok(5, 'gry_quiz_today()')).answers.length, 4);
    });

    await t.test('Discord only: guests and other log-ins are refused; the board is open to all', async () => {
      assert.match((await call(null, 'gry_quiz_today()', day(0), 'anon')).error, /Discord sign-in required|permission denied/);
      assert.match((await call(9, 'gry_quiz_today()')).error, /Discord sign-in required/);
      assert.match((await call(9, 'gry_quiz_answer(0)')).error, /Discord sign-in required/);
      const b = await ok(null, 'gry_quiz_board()', day(0), 'anon');
      assert.deepEqual(b, { top: [], me: null });
    });

    await t.test("today's question: no right answer and no source before answering; the same all day", async () => {
      const v = await ok(1, 'gry_quiz_today()');
      assert.equal(typeof v.question, 'string');
      assert.equal(v.answers.length, 4);
      assert.equal(v.answered, false);
      assert.equal(v.correct, null); assert.equal(v.source, null); assert.equal(v.right, null);
      assert.equal(v.left, active);
      const again = await ok(1, 'gry_quiz_today()', day(0, 23));
      assert.deepEqual([again.id, again.answers], [v.id, v.answers], 'same question, same order');
      const q = await truth(v.id);
      assert.deepEqual([...v.answers].sort(), [...q.answers].sort());
    });

    await t.test('a right answer: +1, once; the question leaves the pool', async () => {
      const v = await ok(1, 'gry_quiz_today()');
      const r = await ok(1, `gry_quiz_answer(${await shownIndex(v, true)})`);
      assert.equal(r.right, true); assert.equal(r.points, 1); assert.equal(r.answered_total, 1);
      assert.equal(r.answers[r.correct], (await truth(v.id)).answers[(await truth(v.id)).correct]);
      assert.match(r.source, /^https:\/\/pepecoinhub\.com\//);
      assert.equal(r.left, active - 1);
      const twice = await ok(1, `gry_quiz_answer(${await shownIndex(v, false)})`);
      assert.equal(twice.points, 1, 'answering again changes nothing');
      assert.equal(twice.right, true);
      for (let d = 1; d <= 12; d++) assert.notEqual((await ok(1, 'gry_quiz_today()', day(d))).id, v.id, 'never asked again');
    });

    await t.test('a wrong answer: no point, the question comes back on a later day (not the next one)', async () => {
      const v = await ok(2, 'gry_quiz_today()');
      const r = await ok(2, `gry_quiz_answer(${await shownIndex(v, false)})`);
      assert.equal(r.right, false); assert.equal(r.points, 0); assert.equal(r.left, active);
      assert.notEqual((await ok(2, 'gry_quiz_today()', day(1))).id, v.id, 'not again the next day');
      // the pool is only 4 questions: the missed one has to come back
      const seen = new Set();
      for (let d = 2; d < 14; d++) seen.add((await ok(2, 'gry_quiz_today()', day(d))).id);
      assert.ok(seen.has(v.id), 'it comes back');
    });

    await t.test('one question a day: no answer without opening it, a bad number is refused', async () => {
      assert.match((await call(3, 'gry_quiz_answer(1)')).error, /Open today's question first/);
      await ok(3, 'gry_quiz_today()');
      assert.match((await call(3, 'gry_quiz_answer(4)')).error, /Pick one of the four answers/);
      assert.match((await call(3, 'gry_quiz_answer(-1)')).error, /Pick one of the four answers/);
      assert.match((await call(3, 'gry_quiz_answer(0)', day(1))).error, /Open today's question first/, "yesterday's question is closed");
    });

    await t.test('the ranking: points, then who got there first; Discord names; my own place', async () => {
      // player 4: two right answers on days 0 and 1; player 3: one right on day 2; player 1 already has 1 (day 0)
      // (player 5 answered nothing)
      for (const [n, d] of [[4, 0], [4, 1], [3, 2]]) {
        const v = await ok(n, 'gry_quiz_today()', day(d));
        await ok(n, `gry_quiz_answer(${await shownIndex(v, true)})`, day(d));
      }
      const b = await ok(1, 'gry_quiz_board()', day(3));
      assert.deepEqual(b.top.map(r => [r.rank, r.nick, r.points]), [[1, 'Fren 4', 2], [2, 'Fren 1', 1], [3, 'Fren 3', 1]]);
      assert.deepEqual(b.me, { points: 1, rank: 2 });
      assert.deepEqual((await ok(2, 'gry_quiz_board()', day(3))).me, { points: 0, rank: null }, 'no points, no place');
    });

    await t.test('when every question is answered right: done, nothing more to ask', async () => {
      await db.exec(`update games.quiz_questions set active = (id = 's01')`);
      let v = await ok(4, 'gry_quiz_today()', day(20));
      if (v.question) { await ok(4, `gry_quiz_answer(${await shownIndex(v, true)})`, day(20)); }
      v = await ok(4, 'gry_quiz_today()', day(21));
      assert.equal(v.question, null); assert.equal(v.done, true);
      await db.exec(QUESTIONS_SQL);
      const fresh = await ok(4, 'gry_quiz_today()', day(21));
      assert.notEqual(fresh.question, null, 'new questions arrive: asked the same day');
      assert.equal(fresh.done, false);
    });

    await t.test('the browser cannot read the tables or the helpers; the files can run again', async () => {
      for (const tb of ['games.quiz_questions', 'games.quiz_players', 'games.quiz_solved'])
        for (const role of ['anon', 'authenticated'])
          assert.equal((await rows('select has_table_privilege($1, $2, \'select\') v', [role, tb]))[0].v, false, role + ' ' + tb);
      for (const f of ['games.quiz_clock()', 'games.quiz_view(uuid, date)', 'games.quiz_check(uuid)'])
        for (const role of ['anon', 'authenticated'])
          assert.equal((await rows('select has_function_privilege($1, $2, \'execute\') v', [role, f]))[0].v, false, role + ' ' + f);
      assert.equal((await rows("select has_function_privilege('anon', 'public.gry_quiz_answer(integer)', 'execute') v"))[0].v, false);
      const before = (await rows('select points from games.quiz_players where user_id = $1', [uid(4)]))[0].points;
      await db.exec(await read('games/supabase/update_pond_quiz.sql'));
      await db.exec(QUESTIONS_SQL);
      assert.equal((await rows('select points from games.quiz_players where user_id = $1', [uid(4)]))[0].points, before);
    });

    await t.test('stamps for 1, 10, 25, 50 and 99 right answers, dated at the answer that reached each; never lost', async () => {
      await db.exec(CLOCK);
      const stamps = async n => (await rows("select badge_id, earned_at from games.passport_badges where user_id = $1 and badge_id like 'quiz%' order by earned_at, badge_id", [uid(n)]));
      // the first right answers earlier in this test already gave quiz_first
      assert.deepEqual((await stamps(1)).map(b => b.badge_id), ['quiz_first']);
      assert.deepEqual((await stamps(2)).map(b => b.badge_id), [], 'wrong answers only: no stamp');
      // player 6: 97 questions already answered right (made-up questions, switched off), one a day
      await addPlayer(db, 6);
      await ok(6, "gry_pepegochi_adopt('Fren')", day(-2));
      await ok(6, "gry_pepegochi_action('feed')", day(-1));
      await db.query(`insert into games.quiz_questions (id, question, answers, correct, active)
        select 'old' || n, 'old question ' || n, array['a', 'b', 'c', 'd'], 0, false from generate_series(1, 97) n`);
      await db.query(`insert into games.quiz_solved (user_id, question_id, solved_at)
        select $1, 'old' || n, timestamptz '2026-08-01 12:00Z' + n * interval '1 day' from generate_series(1, 97) n`, [uid(6)]);
      await db.query('insert into games.quiz_players (user_id, points, answered) values ($1, 97, 97)', [uid(6)]);
      // the stamps are not in passport_award()'s allowlist yet (today's Passport file without them): they wait
      const awards = await read('games/supabase/update_passport_awards.sql');
      const fn = awards.match(/create or replace function games\.passport_award\([\s\S]*?\n\$\$;/)[0];
      const without = fn.replace(", 'quiz_first', 'quiz_10', 'quiz_25', 'quiz_50', 'quiz_99'", '');
      assert.notEqual(without, fn);
      await db.exec(without);
      let v = await ok(6, 'gry_quiz_today()', day(30));
      v = await ok(6, `gry_quiz_answer(${await shownIndex(v, true)})`, day(30));
      assert.equal(v.right, true, 'the answer counts although the stamps wait');
      assert.deepEqual(await stamps(6), []);
      // release: the allowlist knows them; running the quiz file again delivers every threshold reached (98 here)
      await db.exec(fn);
      await db.exec(await read('games/supabase/update_pond_quiz.sql'));
      await db.exec(CLOCK);
      const got = await stamps(6);
      assert.deepEqual(got.map(b => b.badge_id), ['quiz_first', 'quiz_10', 'quiz_25', 'quiz_50']);
      const nth = n => +new Date(Date.UTC(2026, 7, 1 + n, 12));
      assert.deepEqual(got.map(b => +b.earned_at), [nth(1), nth(10), nth(25), nth(50)], 'dated at the n-th right answer');
      // the 99th right answer: the big one, at once
      v = await ok(6, 'gry_quiz_today()', day(32));
      assert.ok(v.question, 'one sample question is still left for player 6');
      await ok(6, `gry_quiz_answer(${await shownIndex(v, true)})`, day(32));
      const all = await stamps(6);
      assert.deepEqual(all.map(b => b.badge_id), STAMPS);
      assert.equal(+all.at(-1).earned_at, +day(32));
      // once per account: running everything again changes nothing
      await db.exec(await read('games/supabase/update_pond_quiz.sql'));
      await db.exec(CLOCK);
      assert.equal((await stamps(6)).length, 5);
      // the helpers are closed to the browser
      for (const f of ['games.quiz_stamps(uuid)', 'games.quiz_stamp_steps()'])
        for (const role of ['anon', 'authenticated'])
          assert.equal((await rows('select has_function_privilege($1, $2, \'execute\') v', [role, f]))[0].v, false, role + ' ' + f);
    });
  } finally {
    await raw.end();
    await admin.query('drop database if exists ' + name + ' with (force)');
    await admin.end();
  }
});
