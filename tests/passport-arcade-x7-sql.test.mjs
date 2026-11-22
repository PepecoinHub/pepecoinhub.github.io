// Fren Passport expansion 7 (games/supabase/update_passport_arcade_x7.sql): Lord of the Lilies, Master Tactician,
// Gold Digger and Gold Rush, plus static checks for the seven new stamps (catalog, atlas, Pond Sweeper / General Fren).
// The PostgreSQL part is optional:
//   PASSPORT_PG_URL=postgres://postgres@localhost:5432/postgres \
//   PASSPORT_PG_MODULE=/abs/path/node_modules/pg/lib/index.js \
//   node --test tests/passport-arcade-x7-sql.test.mjs
// It creates and drops its own database. Never point it at Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SKIP, pondDb, caller, addUser } from './pond-sql-setup.mjs';
import { newRun, levelDef, modsFor, finishLevel, submission, canBuy, buy } from '../docs/games/js/gold-hook-campaign.mjs';
import { botLevel } from './gold-hook-bot.mjs';

const file = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const X7 = ['lord_of_the_lilies', 'master_tactician', 'gold_digger', 'gold_rush', 'pond_sweeper', 'general_fren', 'super_parent'];

test('expansion 7: seven planned catalog entries, seven new atlas tiles at the end, no award for unvalidated games', () => {
  const catalog = JSON.parse(file('docs/meme/passport-catalog.json'));
  const ids = catalog.achievements.map(x => x.id);
  assert.equal(new Set(ids).size, ids.length, 'distinct ids');
  assert.equal(ids.length, 73, '57 earlier + 7 new + the two Haze stamps + Crown Breaker + 6 PepeGochi A12');
  // owner, 2026-11-17: the two Three Lilies stamps are live; the rest wait (Gold Hook is still in beta)
  for (const id of X7) assert.equal(catalog.achievements.find(x => x.id === id).status, id === 'lord_of_the_lilies' || id === 'master_tactician' ? 'live' : 'planned', id);
  const v3 = file('docs/meme/meme.js').match(/var PP_V3 = \[([^\]]*)\]/)[1].match(/'([a-z_0-9]+)'/g).map(s => s.slice(1, -1));
  assert.deepEqual(v3.slice(55), X7, 'appended after the 55 earlier tiles, which keep their places');
  assert.equal(v3.indexOf('share_fren'), 46, 'the unused Share Fren tile stays');
  for (const css of ['docs/meme/passport.css', 'docs/meme/meme.css']) assert.match(file(css), /6200% 100%/, css);
  // Pepe Sweeper keeps its records in the browser and online FROGAGEDDON does not exist: nothing may award them
  const sql = file('games/supabase/update_passport_arcade_x7.sql') + file('games/supabase/update_passport_awards.sql');
  for (const id of ['pond_sweeper', 'general_fren']) assert.doesNotMatch(sql.replace(/^--.*$/gm, ''), new RegExp("'" + id + "'"), id);
  // Three Lilies is live (owner, 2026-11-17); Gold Hook's two stay out of the allowlist until its launch
  const allow = file('games/supabase/update_passport_awards.sql').match(/b not in \(([^)]*)\)/)[1];
  for (const id of X7.slice(0, 2)) assert.match(allow, new RegExp("'" + id + "'"), id);
  for (const id of X7.slice(2, 4)) assert.doesNotMatch(allow, new RegExp("'" + id + "'"), id);
  assert.match(allow, /'super_parent'/);
});

// a bot campaign: the full 20 levels, or the first n levels won and the next one lost
const policy = r => { for (const item of ['strength', 'reel', 'clock', 'dynamite', 'dynamite']) if (canBuy(r, item)) buy(r, item); };
function botRun(stopAfter = 20) {
  const r = newRun();
  while (!r.over && !r.finished) {
    if (r.level > stopAfter) {   // lose this level: nothing caught, the whole clock played
      const def = levelDef(r.level);
      finishLevel(r, { won: false, score: 0, target: def.target, played: def.durationSec + (modsFor(r).extraSec || 0), run: { catches: [], dynamiteUsed: 0 } });
      break;
    }
    finishLevel(r, botLevel(levelDef(r.level), modsFor(r)));
    if (!r.over && !r.finished) policy(r);
  }
  return submission(r);
}

test('expansion 7 on PostgreSQL: valid duels only, streaks, once per stamp, completed Gold Hook levels',
  { skip: SKIP, timeout: 300000 }, async () => {
  const { db, drop } = await pondDb('passport_x7_test', ['update_pond_bulletin.sql', 'update_lilies.sql']);
  const call = caller(db);
  try {
    // the arcade table and Gold Hook, then a stand-in Passport: Discord only, once per stamp, and the four arcade
    // stamps "unknown" until the test activates them (as the real allowlist does)
    await db.query(`create table games.arcade_scores (id bigint generated always as identity primary key, game text not null,
      nick text not null, score int not null, verified boolean not null default false, user_id uuid, duration_ms int not null,
      ip_hash text, created_at timestamptz not null default now());`);
    await db.query(file('games/supabase/update_gold_hook_campaign.sql'));
    await db.query(`create table games.test_awards (user_id uuid, badge text, primary key (user_id, badge));
      create table games.test_allowed (badge text primary key);
      create function games.passport_award(u uuid, b text, at timestamptz default null) returns boolean language plpgsql security definer set search_path = '' as $$
      begin
        if not exists (select 1 from games.test_allowed where badge = b) then raise exception 'Unknown passport stamp %', b; end if;
        if games.discord_identity(u) is null then return false; end if;
        insert into games.test_awards values (u, b) on conflict do nothing; return found;
      end $$;`);
    const x7 = file('games/supabase/update_passport_arcade_x7.sql');
    await db.query(x7);
    await db.query(x7);   // safe to run again
    const awards = async u => (await db.query('select badge from games.test_awards where user_id = $1 order by badge', [u])).rows.map(r => r.badge);
    const prog = async u => (await db.query('select * from games.passport_x7_progress where user_id = $1', [u])).rows[0];

    const A = { user: await addUser(db, 1, 'LilyLord'), ip: '1.1.1.1' };
    const B = { user: await addUser(db, 2, 'Sparring'), ip: '2.2.2.2' };
    const G = { user: await addUser(db, 3), ip: '3.3.3.3' };                 // a guest
    const T = { user: await addUser(db, 4, 'SameRoom'), ip: '1.1.1.1' };     // Discord, but A's network
    let seq = 0;
    // one settled duel: A creates, the opponent accepts; A wins 3:0, loses 0:3 or draws 0:0
    const duel = async (opp, outcome) => {
      const a = { win: [4, 3, 3], lose: [0, 0, 10], draw: [10, 0, 0] }[outcome];
      const o = { win: [0, 0, 10], lose: [4, 3, 3], draw: [0, 10, 0] }[outcome];
      // a fresh network for A each time keeps the per-network daily limit away; T shares it on purpose
      const ip = opp === T ? '9.0.0.' + (++seq) : '8.0.0.' + (++seq);
      const c = await call({ user: A.user, ip }, 'select public.gry_lily_create($1, $2, $3, $4) as v', [...a, 'LilyLord']);
      assert.ok(c.ok, JSON.stringify(c));
      const r = await call({ user: opp.user, ip: opp === T ? ip : opp.ip }, 'select public.gry_lily_accept($1, $2, $3, $4, $5) as v', [c.challenge.id, ...o, opp === G ? 'GuestFrog' : 'Fren' + opp.user.slice(-1)]);
      assert.ok(r.ok, JSON.stringify(r));
      await db.query("update games.lily_challenges set created_at = created_at - interval '2 days'");   // daily limits
      return c.challenge.id;
    };

    // wins against a guest or from the same network neither count nor break a streak
    await duel(G, 'win'); await duel(T, 'win');
    assert.equal(await prog(A.user), undefined);
    // 4 wins, a DRAW (breaks the streak), 5 wins in a row: 9 wins, streak 5
    for (let i = 0; i < 4; i++) await duel(B, 'win');
    await duel(B, 'draw');
    assert.equal((await prog(A.user)).lily_streak, 0, 'a draw breaks the streak');
    for (let i = 0; i < 4; i++) await duel(B, 'win');
    assert.equal((await prog(A.user)).lily_best_streak, 4);
    const last = await duel(B, 'win');
    let p = await prog(A.user);
    assert.deepEqual([p.lily_wins, p.lily_streak, p.lily_best_streak], [9, 5, 5]);
    assert.deepEqual(await awards(A.user), [], 'nothing before activation');
    // B's side: losses and a draw, no wins
    assert.deepEqual([(await prog(B.user)).lily_wins, (await prog(B.user)).lily_streak], [0, 0]);
    // the trigger fires once per settlement; replaying it (a second "completed" write) counts nothing
    await db.query("update games.lily_challenges set status = 'completed' where id = $1", [last]);
    assert.equal((await prog(A.user)).lily_wins, 9);
    // a cancelled or expired challenge never counts
    const c = await call({ user: A.user, ip: '7.7.7.7' }, "select public.gry_lily_create(4, 3, 3, 'LilyLord') as v");
    await call({ user: A.user, ip: '7.7.7.7' }, 'select public.gry_lily_cancel($1) as v', [c.challenge.id]);
    assert.equal((await prog(A.user)).lily_wins, 9);
    // a loss resets the streak, then the 10th valid win
    await duel(B, 'lose'); await duel(B, 'win');
    p = await prog(A.user);
    assert.deepEqual([p.lily_wins, p.lily_streak, p.lily_best_streak], [10, 1, 5]);

    // activation: the stamps go into the allowlist, the backfill delivers what progress already reached
    await db.query("insert into games.test_allowed values ('lord_of_the_lilies'), ('master_tactician'), ('gold_digger'), ('gold_rush')");
    await db.query('select games.passport_x7_sync(user_id) from games.passport_x7_progress');
    assert.deepEqual(await awards(A.user), ['lord_of_the_lilies', 'master_tactician']);
    await duel(B, 'win');
    assert.equal((await db.query('select count(*)::int n from games.test_awards where user_id = $1', [A.user])).rows[0].n, 2, 'once each');
    // the stamp tables stay closed to the browser
    await assert.rejects(call(A, 'select * from games.passport_x7_progress'), /permission denied/);
    await assert.rejects(call(A, "select games.passport_goldhook_run($1, 20)", [A.user]), /permission denied/);

    // Gold Hook: levels COMPLETED in a validated run. Won 9, lost the 10th: 9 completed, no stamp.
    const M = { user: await addUser(db, 5, 'Miner'), ip: '5.5.5.5' };
    const submit = (who, run) => call(who, 'select public.gry_goldhook_submit_run($1, $2) as v', ['Miner', run]);
    const r9 = await submit(M, botRun(9));
    assert.deepEqual([r9.level, r9.finished], [10, false]);
    assert.equal((await prog(M.user)).goldhook_completed, 9, 'the level reached is not a level completed');
    assert.deepEqual(await awards(M.user), []);
    await db.query('delete from games.arcade_scores');   // rate limits
    await submit(M, botRun(10));
    assert.deepEqual(await awards(M.user), ['gold_digger']);
    await db.query('delete from games.arcade_scores');
    const full = await submit(M, botRun(20));
    assert.deepEqual([full.level, full.finished], [20, true]);
    assert.deepEqual(await awards(M.user), ['gold_digger', 'gold_rush']);
    // a run that does not add up is refused before anything is counted
    const bad = botRun(20); bad.levels[3].catches.push({ id: 99, t: 1 });
    await db.query('delete from games.arcade_scores');
    await assert.rejects(submit(M, bad), /does not add up/);
    // a guest's validated run counts for nothing
    const H = { user: await addUser(db, 6), ip: '6.6.6.6' };
    await submit(H, botRun(20));
    assert.equal(await prog(H.user), undefined);
    // a failing Passport never loses the score
    await db.query("create or replace function games.passport_goldhook_run(u uuid, p_completed integer) returns void language plpgsql as $$ begin raise exception 'boom'; end $$");
    await db.query('delete from games.arcade_scores');
    assert.equal((await submit(M, botRun(3))).level, 4);
  } finally {
    await drop();
  }
});

test('EXPANSION7.sql is built from the current files', async () => {
  const { execFileSync } = await import('node:child_process');
  execFileSync('python3', ['scripts/build_expansion7_sql.py', '--check'], { cwd: new URL('..', import.meta.url) });
  const sql = file('games/supabase/deploy/EXPANSION7.sql');
  assert.equal(sql.match(/^begin;$/gm).length, 1);
  assert.equal(sql.match(/^commit;$/gm).length, 1);
  assert.doesNotMatch(sql.split('/* Check')[0].replace(/^\/\*[\s\S]*?\*\//m, ''), /--/, 'no line comments in the paste file');
});

test('EXPANSION7.sql runs twice on a production-like database; Gold Hook pasted afterwards keeps the real hook',
  { skip: SKIP, timeout: 120000 }, async () => {
  const { db, drop } = await pondDb('passport_x7_paste', ['update_pond_bulletin.sql', 'update_lilies.sql']);
  try {
    const sql = file('games/supabase/deploy/EXPANSION7.sql');
    await db.query(sql); await db.query(sql);
    await db.query(`create table games.arcade_scores (id bigint generated always as identity primary key, game text not null,
      nick text not null, score int not null, verified boolean not null default false, user_id uuid, duration_ms int not null,
      ip_hash text, created_at timestamptz not null default now());`);
    await db.query(file('games/supabase/update_gold_hook_campaign.sql'));
    const check = sql.split('/* Check (optional, run on its own afterwards): every column should say true.\n')[1].split('*/')[0];
    assert.deepEqual(Object.values((await db.query(check)).rows[0]), [true, true, true, true]);
    // the switch-on file, with the real passport_award: the season is open, A reached both thresholds, B did not
    await db.query(`create table games.passport_badges (user_id uuid, badge_id text, earned_at timestamptz, primary key (user_id, badge_id));
      create function games.passport_open() returns boolean language sql as $$ select true $$;
      create function games.passport_start() returns timestamptz language sql as $$ select '2026-11-15 23:00+00'::timestamptz $$;`);
    const A = await addUser(db, 1, 'LilyLord'), B = await addUser(db, 2, 'Sparring');
    await db.query(`insert into games.passport_x7_progress (user_id, lily_wins, lily_best_streak, goldhook_completed)
      values ($1, 10, 5, 20), ($2, 9, 4, 0)`, [A, B]);
    const on = file('games/supabase/deploy/EXPANSION7_LILIES_ON.sql');
    await db.query(on); await db.query(on);
    const got = (await db.query('select user_id, badge_id from games.passport_badges order by badge_id')).rows;
    assert.deepEqual(got, [{ user_id: A, badge_id: 'lord_of_the_lilies' }, { user_id: A, badge_id: 'master_tactician' }],
      'only the two Lilies stamps, only for A, once; Gold Hook stays off');
  } finally {
    await drop();
  }
});
