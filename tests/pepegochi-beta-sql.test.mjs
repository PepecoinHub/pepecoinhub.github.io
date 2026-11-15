// The paste-ready hidden-beta SQL (games/supabase/deploy/PEPEGOCHI_BETA.sql): up to date with its source files, and on
// a database like production today (schema.sql + the Fren Passport launch, passport_award() WITHOUT the quiz stamps)
// it runs twice as one transaction, the game and the quiz work, and no Passport stamp is awarded during the beta.
// Launch day then delivers everything the beta reached, dated when it happened.
//   PASSPORT_PG_URL=... PASSPORT_PG_MODULE=... node --test tests/pepegochi-beta-sql.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { SUPABASE_STUB, OPEN_SEASON, addPlayer, callRpc, asDb, uid } from '../scripts/pepegochi_sim.mjs';
import { buildSql } from '../scripts/build_pond_quiz_sql.mjs';

const ROOT = new URL('../', import.meta.url);
const read = p => readFile(new URL(p, ROOT), 'utf8');
const URI = process.env.PASSPORT_PG_URL, MOD = process.env.PASSPORT_PG_MODULE;
const PASSPORT = ['update_yeet.sql', 'update_wheres_pepe.sql', 'update_wheres_pepe_guests.sql', 'update_lobby_chat.sql',
  'update_open_chat.sql', 'update_lobby_mentions.sql', 'update_frog_letters.sql', 'update_letters_community.sql',
  'update_miner_cloud.sql', 'update_fren_passport.sql', 'update_fren_avatar.sql', 'update_passport_awards.sql'];
const QUIZ = ['quiz_first', 'quiz_10', 'quiz_25', 'quiz_50', 'quiz_99'];

test('PEPEGOCHI_BETA.sql is built from the current files and awards no stamp', () => {
  execFileSync('python3', ['scripts/build_pepegochi_beta_sql.py', '--check'], { cwd: ROOT });
  const sql = readFileSync(new URL('games/supabase/deploy/PEPEGOCHI_BETA.sql', ROOT), 'utf8');
  assert.doesNotMatch(sql, /create or replace function games\.passport_award|pepegochi_passport_stamp|interior_designer/);
  assert.equal(sql.match(/^begin;$/gm).length, 1);
  assert.equal(sql.match(/^commit;$/gm).length, 1);
});

test('PEPEGOCHI_BETA.sql on a production-like database: twice, game and quiz work, stamps wait for the launch',
  { skip: !(URI && MOD) && 'set PASSPORT_PG_URL and PASSPORT_PG_MODULE', timeout: 300000 }, async t => {
  const pg = (await import(MOD)).default;
  const admin = new pg.Client({ connectionString: URI }); await admin.connect();
  const name = 'pepegochi_beta_test_' + process.pid + '_' + Date.now();
  await admin.query('create database ' + name);
  const url = new URL(URI); url.pathname = '/' + name;
  const raw = new pg.Client({ connectionString: url.toString() }); await raw.connect();
  const db = asDb(raw);
  try {
    await db.exec(SUPABASE_STUB);
    await db.exec(await read('games/supabase/schema.sql'));
    await db.exec(await read('games/supabase/update_passport_season.sql'));
    await db.exec(OPEN_SEASON);
    for (const f of PASSPORT) await db.exec(await read('games/supabase/' + f));
    // production today: passport_award() as launched, without the five quiz stamps
    const awards = await read('games/supabase/update_passport_awards.sql');
    const fn = awards.match(/create or replace function games\.passport_award\([\s\S]*?\n\$\$;/)[0];
    const live = fn.replace(", 'quiz_first', 'quiz_10', 'quiz_25', 'quiz_50', 'quiz_99'", '');
    assert.notEqual(live, fn);
    await db.exec(live);
    const beta = await read('games/supabase/deploy/PEPEGOCHI_BETA.sql');
    await db.exec(beta);
    await db.exec(beta);                                   // safe to run again
    await db.exec(buildSql(JSON.parse(await read('tests/fixtures/pond-quiz-sample.json')).questions));
    await addPlayer(db, 1);
    const ok = async (fnCall, now) => { const r = await callRpc(db, { user: 1, now }, 'public.' + fnCall); assert.ok(r.ok, r.error); return r.value; };
    const badges = async () => (await db.query('select badge_id from games.passport_badges where user_id = $1 order by 1', [uid(1)])).rows.map(r => r.badge_id);

    await t.test('the beta: adopt, hatch, a room, a right quiz answer; no stamp', async () => {
      await ok("gry_pepegochi_adopt('Fren')");
      const s = await ok("gry_pepegochi_action('feed')");
      assert.equal(s.pet.stage, 'tadpole');
      await ok('gry_pepegochi_room_initialize()');
      const q = await ok('gry_quiz_today()');
      const truth = (await db.query('select answers, correct from games.quiz_questions where id = $1', [q.id])).rows[0];
      const r = await ok(`gry_quiz_answer(${q.answers.indexOf(truth.answers[truth.correct])})`);
      assert.equal(r.right, true);
      assert.deepEqual(await badges(), [], 'no Passport stamp during the beta');
      const pending = (await db.query('select milestone from games.pepegochi_milestones where user_id = $1 and synced_at is null order by 1', [uid(1)])).rows.map(r => r.milestone);
      assert.ok(pending.includes('first_adoption'), 'the milestone waits: ' + pending);
    });

    await t.test('launch day: the stamp files deliver what the beta reached', async () => {
      await db.exec(await read('games/supabase/update_pepegochi_passport.sql'));
      await db.exec(await read('games/supabase/update_pepegochi_rewards.sql'));
      await db.exec(fn);                                   // passport_award() with the quiz stamps
      await db.exec(await read('games/supabase/update_pond_quiz.sql'));
      const got = await badges();
      assert.ok(got.includes('first_hatch'), got.join());
      assert.ok(got.includes('quiz_first'), got.join());
      assert.ok(!got.some(b => QUIZ.slice(1).includes(b)));
    });
  } finally {
    await raw.end();
    await admin.query('drop database if exists ' + name + ' with (force)');
    await admin.end();
  }
});
