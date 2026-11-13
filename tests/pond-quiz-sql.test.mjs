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
    await prepare(db);                                   // Supabase stub, schema.sql, PepeGochi v2, virtual clock
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
  } finally {
    await raw.end();
    await admin.query('drop database if exists ' + name + ' with (force)');
    await admin.end();
  }
});
