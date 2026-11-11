// Optional PostgreSQL integration test for games/supabase/update_wheres_pepe_hall_of_fame.sql.
// Loads the real game and Passport migrations, writes Pepe Guesser plays for three finished weeks (and some of
// this week), and checks the daily and weekly settlement: Days at #1, Weekly Champion (Frog of the Week),
// Pond Dominator, Longest Guessing Streak, the Hall of Fame and the access rules.
// Needs a disposable PostgreSQL server (15+) and node-postgres, like tests/passport-awards-sql.test.mjs:
//   PASSPORT_PG_URL=postgres://postgres:pw@localhost:5432/postgres \
//   PASSPORT_PG_MODULE=/abs/path/node_modules/pg/lib/index.js \
//   node --test tests/wp-hall-of-fame-sql.test.mjs
// It creates and drops its own database. Never point it at Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const URL_ENV = process.env.PASSPORT_PG_URL;
const MOD_ENV = process.env.PASSPORT_PG_MODULE;
const read = p => readFile(new URL('../' + p, import.meta.url), 'utf8');

const SUPABASE_STUB = `
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
const FILES = ['schema.sql', 'update_yeet.sql', 'update_wheres_pepe.sql', 'update_wheres_pepe_guests.sql', 'update_wheres_pepe_top_all.sql',
  'update_wheres_pepe_monday_reset.sql', 'update_lobby_chat.sql', 'update_open_chat.sql', 'update_lobby_mentions.sql', 'update_frog_letters.sql',
  'update_letters_community.sql', 'update_miner_cloud.sql', 'update_polls.sql', 'update_arcade.sql', 'update_fren_passport.sql',
  'update_fren_avatar.sql', 'update_passport_awards.sql', 'update_passport_public.sql'];

test('Pepe Guesser Hall of Fame SQL: days, weeks, ties, Pond Dominator, streaks, history and access',
  { skip: !(URL_ENV && MOD_ENV) && 'set PASSPORT_PG_URL and PASSPORT_PG_MODULE', timeout: 180000 }, async () => {
  const pg = (await import(MOD_ENV)).default;
  const admin = new pg.Client({ connectionString: URL_ENV });
  await admin.connect();
  const dbName = 'wp_hof_test_' + process.pid + '_' + Date.now();
  await admin.query('create database ' + dbName);
  const url = new URL(URL_ENV); url.pathname = '/' + dbName;
  const db = new pg.Client({ connectionString: url.toString() });
  await db.connect();
  try {
    await db.query(SUPABASE_STUB);
    for (const f of FILES) await db.query(await read('games/supabase/' + f));
    const hofSql = await read('games/supabase/update_wheres_pepe_hall_of_fame.sql');
    await db.query(hofSql);

    const uid = i => '00000000-0000-4000-8000-' + String(i).padStart(12, '0');
    const addUser = async (i, provider = 'discord') => {
      await db.query("insert into auth.users(id, created_at) values ($1, now() - interval '90 days')", [uid(i)]);
      if (provider) await db.query('insert into auth.identities values ($1, $2, $3, $4)', [uid(i), provider, 'p' + i, JSON.stringify({ full_name: 'Fren' + i })]);
    };
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
    const one = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];

    // 1-3 Discord players, 4 a guest, 5 the host (Discord, in host_discord), 6 the streak player, 7 a viewer
    for (const i of [1, 2, 3, 6, 7]) await addUser(i);
    await addUser(4, null); await addUser(5);
    await db.query("insert into games.host_discord(discord_id) values ('p5')");

    // dates: three finished weeks A, B, C from the Hall of Fame start, then this week (mon0 .. today)
    const today = await one("select (now() at time zone 'utc')::date::text");
    const mon0 = await one('select games.wp_monday($1::date)::text', [today]);
    const st = await one("select ($1::date - 21)::text", [mon0]);
    // the start follows the Passport launch (update_passport_awards.sql ran just now): the first Monday on or after today
    assert.equal(await one("select wp_hof_start::text from games.config where id = 1"),
      await one("select ($1::date + ((8 - extract(isodow from $1::date)::int) % 7))::text", [today]));
    assert.deepEqual(await one('select games.wp_settle()'), { days: 0, weeks: 0 }, 'nothing before the launch week');
    await db.query('update games.config set wp_hof_start = $1 where id = 1', [st]);
    const dayAt = k => one('select ($1::date + $2::int)::text', [st, k]);   // k: days from the start (may be < 0)
    const pid = {};
    let n = 0;
    const puzzle = async k => {
      if (pid[k]) return pid[k];
      n++;
      pid[k] = await one(`insert into games.wp_puzzles(qid, status, day, num, title, lat, lon, country, country_code, continent, credit, license, source_url)
        values ($1, 'approved', $2::date, $3, 'Place', 52.2, 21.0, 'Poland', 'PL', 'Europe', 'c', 'cc0', 'https://example.org') returning id`, ['Q' + n, await dayAt(k), n]);
      return pid[k];
    };
    const play = async (user, k, points, { verified = true, pin = true } = {}) => {
      const p = await puzzle(k);
      await db.query(`insert into games.wp_plays(puzzle_id, user_id, nick, verified, started_at, guessed_at, g_lat, g_lon, km, points)
        values ($1, $2, $3, $4, $5::date + time '12:00', $5::date + time '12:01', $6, $6, 1, $7)`,
        [p, uid(user), 'Fren' + user, verified, await dayAt(k), pin ? 52 : null, points]);
    };
    // a week before the start: nothing there may ever be settled (no history is rebuilt)
    for (let k = -7; k < 0; k++) await play(2, k, 5000);
    // week A: user 1 leads alone every day -> champion + Pond Dominator; the guest and the host score more but never count
    for (let k = 0; k < 7; k++) { await play(1, k, 3000); await play(2, k, 1000); await play(4, k, 5000, { verified: false }); await play(5, k, 5000); }
    // week B: Mon u1 2000/u2 1000 (u1); Tue u1 1000/u2 2000 -> 3000:3000 tie (nobody); Wed-Sun u1 1000 each -> champion, no Dominator
    await play(1, 7, 2000); await play(2, 7, 1000); await play(1, 8, 1000); await play(2, 8, 2000);
    for (let k = 9; k < 14; k++) await play(1, k, 1000);
    // week C: Mon-Fri u2 1000 each; Sat u1 3000 (u2 still leads); Sun u1 2000 -> 5000:5000 tie, no winner
    for (let k = 14; k < 19; k++) await play(2, k, 1000);
    await play(1, 19, 3000); await play(1, 20, 2000);
    // user 6: a pin on 5 days in a row, a timeout without a pin, then 2 more days -> longest 5 (0 points)
    for (const k of [0, 1, 2, 3, 4, 6, 7]) await play(6, k, 0);
    await play(6, 5, 0, { pin: false });
    // this week: user 3 scores on Monday; the big totals of older weeks do not carry over
    const daysThisWeek = await one('select $1::date - $2::date', [today, mon0]);
    if (daysThisWeek > 0) await play(3, 21, 100);

    // --- settlement, run twice and by the migration a second time: identical results
    const s1 = await one('select games.wp_settle()');
    assert.equal(s1.weeks, 3);
    assert.equal(s1.days, 21 + daysThisWeek);
    await db.query(hofSql);
    assert.deepEqual(await one('select games.wp_settle()'), { days: 0, weeks: 0 });

    const days = (await db.query('select day::text, leader_id, points, tied from games.wp_days order by day')).rows;
    assert.equal(days.length, 21 + daysThisWeek);
    assert.equal(days[0].day, st, 'nothing before wp_hof_start is rebuilt');
    const leadersOf = u => days.filter(d => d.leader_id === uid(u)).length;
    // 1. one leader at the end of the day gets +1;  2. a tie at the top gives nobody a point
    assert.equal(leadersOf(1), 7 + 6, 'u1: 7 days in A, 6 in B (Tuesday was a tie)');
    assert.equal(leadersOf(2), 6, 'u2: Mon-Sat of week C');
    assert.equal(leadersOf(3), daysThisWeek, 'u3 leads this week: a new week resets the ranking');
    assert.equal(leadersOf(4) + leadersOf(5), 0, 'guests and the host never lead');
    const tue = days.find(d => d.day === days[8].day);
    assert.equal(tue.tied, true); assert.equal(tue.leader_id, null); assert.equal(tue.points, 3000);

    const weeks = (await db.query('select week_start::text, winner_id, points, tied, dominator from games.wp_weeks order by week_start')).rows;
    assert.equal(weeks.length, 3, 'only finished weeks; this week is still open');
    assert.deepEqual(weeks.map(w => [w.winner_id, w.points, w.tied, w.dominator]), [
      [uid(1), 21000, false, true],      // 3. seven days alone at the top: Pond Dominator
      [uid(1), 8000, false, false],      // 4. one tied day blocks Pond Dominator
      [null, 5000, true, false]]);       // 5. a tie on Sunday: no Weekly Champion
    const badge = (u, b) => one('select count(*)::int from games.passport_badges where user_id = $1 and badge_id = $2', [uid(u), b]);
    assert.equal(await one("select times from games.passport_badges where user_id = $1 and badge_id = 'frog_of_the_week'", [uid(1)]), 2);
    assert.equal(await badge(2, 'frog_of_the_week'), 0, 'a tie gives nobody the Weekly Champion stamp');
    assert.equal(await badge(1, 'pond_dominator'), 1);
    assert.equal(await badge(2, 'pond_dominator') + await badge(5, 'pond_dominator'), 0);
    // 8. a repeated settlement (and the Passport check-in, which runs it too) pays nothing twice
    await call(2, 'select public.gry_passport_checkin() as v');
    await call(1, 'select public.gry_passport_checkin() as v');
    await db.query("select games.wp_settle(), games.wp_dominator_stamps()");
    assert.equal(await one("select times from games.passport_badges where user_id = $1 and badge_id = 'frog_of_the_week'", [uid(1)]), 2);
    assert.equal(await badge(2, 'frog_of_the_week'), 0, 'the older passport_daily rule leaves Hall of Fame weeks alone');
    assert.equal(await one('select count(*)::int from games.wp_days'), 21 + daysThisWeek);
    // a week settled under an older passport_award() (no 'pond_dominator' yet) gets its stamp on a later run
    await db.query("delete from games.passport_badges where badge_id = 'pond_dominator'");
    await db.query('select games.wp_settle()');
    assert.equal(await badge(1, 'pond_dominator'), 1);
    // 6. history stays: the reset of the live board does not touch settled weeks
    const top = await call(null, "select public.gry_wp_top('week') as v", [], 'anon');
    assert.deepEqual(top.map(r => r.nick), daysThisWeek > 0 ? ['Fren3'] : [], 'the week board counts only this Monday-Sunday');

    // --- stats and streaks (7. a broken streak keeps the record)
    const stats = await call(7, 'select public.gry_wp_stats($1) as v', [uid(1)]);
    assert.equal(stats.days_at_1, 13); assert.equal(stats.weeks_won, 2);
    assert.equal(stats.longest_streak, 14, 'weeks A and B in a row; week C Mon-Fri had no play');
    assert.equal((await call(6, 'select public.gry_wp_stats() as v')).longest_streak, 5, 'a timeout without a pin breaks the run');
    assert.equal(await one('select games.wp_longest_streak($1)', [uid(2)]), 16, 'streaks use all recorded plays, also before the Hall of Fame start');
    assert.equal((await call(4, 'select public.gry_wp_stats($1) as v', [uid(1)])).signed_in, false, 'guests cannot look');
    assert.equal((await call(7, 'select public.gry_wp_stats($1) as v', [uid(4)])).found, false, 'guests have no record');

    // --- Hall of Fame: weeks newest first, three separate boards, ids only for Discord frens
    const hofAnon = await call(null, 'select public.gry_wp_hof() as v', [], 'anon');
    assert.equal(hofAnon.since, st);
    assert.deepEqual(hofAnon.weeks.map(w => [w.tied, w.dominator, w.winner && w.winner.nick]), [[true, false, null], [false, false, 'Fren1'], [false, true, 'Fren1']]);
    assert.ok(!JSON.stringify(hofAnon).includes(uid(1)), 'no user ids for visitors without Discord');
    assert.deepEqual(hofAnon.legends.weeks.map(r => [r.nick, r.value, r.rank]), [['Fren1', 2, 1]]);
    assert.deepEqual(hofAnon.legends.days.slice(0, 2).map(r => [r.nick, r.value]), [['Fren1', 13], ['Fren2', 6]]);
    assert.deepEqual(hofAnon.legends.streak.slice(0, 3).map(r => [r.nick, r.value]), [['Fren2', 16], ['Fren1', 14], ['Fren6', 5]]);
    assert.ok(!hofAnon.legends.streak.some(r => r.nick === 'Fren4'), 'guest plays never count');
    const hofFren = await call(7, 'select public.gry_wp_hof() as v');
    assert.equal(hofFren.weeks[1].winner.id, uid(1), 'a Discord fren gets the id that opens the Passport');
    for (const k of ['address', 'discord', 'email', 'token', 'progress']) assert.ok(!JSON.stringify(hofFren).includes('"' + k), k);

    // --- access: tables closed, settlement not callable from the browser, the stamp only through the server
    const priv = (await db.query(`select
      has_table_privilege('authenticated', 'games.wp_days', 'SELECT') a, has_table_privilege('authenticated', 'games.wp_weeks', 'INSERT') b,
      has_table_privilege('anon', 'games.wp_days', 'UPDATE') c, has_function_privilege('authenticated', 'games.wp_settle()', 'EXECUTE') d,
      has_function_privilege('anon', 'games.wp_settle()', 'EXECUTE') e, has_function_privilege('anon', 'public.gry_wp_stats(uuid)', 'EXECUTE') f,
      has_function_privilege('anon', 'public.gry_wp_hof(integer)', 'EXECUTE') g, has_table_privilege('authenticated', 'games.passport_badges', 'INSERT') h,
      has_function_privilege('authenticated', 'games.passport_award(uuid, text, timestamptz)', 'EXECUTE') i`)).rows[0];
    assert.deepEqual(priv, { a: false, b: false, c: false, d: false, e: false, f: false, g: true, h: false, i: false });
    await assert.rejects(call(3, "select games.wp_settle() as v"), /permission denied/);
    await assert.rejects(call(3, "insert into games.wp_days(day, week_start, leader_id) values (current_date, games.wp_monday(current_date), auth.uid()) returning 1 as v"), /permission denied/);
    await assert.rejects(call(3, "select games.passport_award(auth.uid(), 'pond_dominator') as v"), /permission denied/);
    assert.equal(await badge(3, 'pond_dominator'), 0);
    // 9. another fren's passport: read-only and shows the stored Pond Dominator
    const pub = await call(7, 'select public.gry_passport_public($1) as v', [uid(1)]);
    assert.ok(pub.achievements.some(a => a.id === 'pond_dominator'));
    assert.ok(!('progress' in pub));
  } finally {
    await db.end();
    await admin.query('drop database if exists ' + dbName + ' with (force)');
    await admin.end();
  }
});
