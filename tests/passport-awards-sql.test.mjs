// Optional PostgreSQL integration test for games/supabase/update_passport_awards.sql.
// It loads the real game migrations (schema.sql, YEET, Pepe Guesser, lobby chat, mentions, letters,
// miner) and the Passport files, then plays through the real game RPCs and checks which stamps appear.
// Needs a disposable PostgreSQL server (15+) and node-postgres, like tests/passport-avatar-sql.test.mjs:
//   PASSPORT_PG_URL=postgres://postgres:pw@localhost:5432/postgres \
//   PASSPORT_PG_MODULE=/abs/path/node_modules/pg/lib/index.js \
//   node --test tests/passport-awards-sql.test.mjs
// It creates and drops its own database. Never point it at Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const URL_ENV = process.env.PASSPORT_PG_URL;
const MOD_ENV = process.env.PASSPORT_PG_MODULE;
const read = p => readFile(new URL('../' + p, import.meta.url), 'utf8');

const SUPABASE_STUB = `
-- roles are shared by the whole server and the SQL tests run in parallel, so a race is not an error
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
const GAMES = ['schema.sql', 'update_yeet.sql', 'update_wheres_pepe.sql', 'update_wheres_pepe_guests.sql',
  'update_lobby_chat.sql', 'update_open_chat.sql', 'update_lobby_mentions.sql', 'update_frog_letters.sql',
  'update_letters_community.sql', 'update_miner_cloud.sql', 'update_fren_passport.sql', 'update_fren_avatar.sql'];

test('Passport awards SQL: stamps come only from real game records, once, for Discord players',
  { skip: !(URL_ENV && MOD_ENV) && 'set PASSPORT_PG_URL and PASSPORT_PG_MODULE', timeout: 180000 }, async () => {
  const pg = (await import(MOD_ENV)).default;
  const admin = new pg.Client({ connectionString: URL_ENV });
  await admin.connect();
  const dbName = 'passport_awards_test_' + process.pid + '_' + Date.now();
  await admin.query('create database ' + dbName);
  const url = new URL(URL_ENV); url.pathname = '/' + dbName;
  const db = new pg.Client({ connectionString: url.toString() });
  await db.connect();
  // every hook failure is logged as a warning; the only expected one is the deliberately blocked stamp below
  const warnings = [];
  db.on('notice', n => { if (/^passport .* hook/.test(n.message)) warnings.push(n.message); });
  try {
    await db.query(SUPABASE_STUB);
    for (const f of GAMES) await db.query(await read('games/supabase/' + f));

    const uid = i => '00000000-0000-4000-8000-' + String(i).padStart(12, '0');
    const addUser = async (i, provider = 'discord', name = 'Fren' + i) => {
      await db.query("insert into auth.users(id, created_at) values ($1, now() - interval '30 days')", [uid(i)]);
      if (provider) await db.query('insert into auth.identities values ($1, $2, $3, $4)', [uid(i), provider, 'p' + i, JSON.stringify({ full_name: name })]);
    };
    // one PostgREST-like request: a transaction with the role and JWT subject set locally
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
    const stamps = async user => (await db.query('select badge_id from games.passport_badges where user_id = $1 order by badge_id', [uid(user)])).rows.map(r => r.badge_id);
    const has = async (user, id) => (await stamps(user)).includes(id);
    const one = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];

    // --- history from before the launch: users 1-3 have Discord, 4 is a guest, 5 has e-mail only
    await addUser(1); await addUser(2); await addUser(3); await addUser(4, null); await addUser(5, 'email');
    // user 1 flew 6000 m long ago; user 2 wrote six letters; user 1 played Pepe Guesser on 15 past days
    await db.query("insert into games.yeet_records(user_id, nick, best, achieved_at) values ($1, 'Fren1', 60000, now() - interval '9 days')", [uid(1)]);
    for (let k = 0; k < 6; k++) await db.query("insert into games.letters(user_id, name, discord, body, created_at) values ($1, 'Fren2', true, 'hello editor', now() - make_interval(days => 10 - $2::int))", [uid(2), k]);
    await db.query("insert into games.letters(user_id, name, discord, body) values ($1, 'guest', false, 'guest letter')", [uid(4)]);
    const puzzle = async (day, i) => one(`insert into games.wp_puzzles(qid, status, day, num, title, lat, lon, country, country_code, continent, credit, license, source_url)
      values ($1, 'approved', $2, $3, 'Place', 52.2297, 21.0122, 'Poland', 'PL', 'Europe', 'c', 'cc0', 'https://example.org') returning id`, ['Q' + i, day, i]);
    const today = await one("select (now() at time zone 'utc')::date::text as d");
    const dayOf = back => one("select ((now() at time zone 'utc')::date - $1::int)::text as d", [back]);
    const pids = {};
    for (let back = 1; back <= 40; back++) pids[back] = await puzzle(await dayOf(back), back);
    // user 1: a pin on days 20..6 back (15 days in a row), 5000 on four of them; one timeout without a pin on day 30
    for (let back = 20; back >= 6; back--) {
      const pts = back <= 9 ? 5000 : 3100;
      await db.query(`insert into games.wp_plays(puzzle_id, user_id, nick, verified, started_at, guessed_at, g_lat, g_lon, km, points)
        values ($1, $2, 'Fren1', true, now() - make_interval(days => $3::int), now() - make_interval(days => $3::int) + interval '30 seconds', 52, 21, 25, $4)`, [pids[back], uid(1), back, pts]);
    }
    await db.query(`insert into games.wp_plays(puzzle_id, user_id, nick, verified, started_at, guessed_at, points)
      values ($1, $2, 'Fren2', true, now() - interval '30 days', now() - interval '30 days', 0)`, [pids[30], uid(2)]);
    // user 1 before the run: a timeout without a pin (day 30) and a perfect play from before Discord was linked (day 35)
    await db.query(`insert into games.wp_plays(puzzle_id, user_id, nick, verified, started_at, guessed_at, points)
      values ($1, $2, 'Fren1', true, now() - interval '30 days', now() - interval '30 days', 0)`, [pids[30], uid(1)]);
    await db.query(`insert into games.wp_plays(puzzle_id, user_id, nick, verified, started_at, guessed_at, g_lat, g_lon, km, points)
      values ($1, $2, 'guest', false, now() - interval '35 days', now() - interval '35 days', 52, 21, 1, 5000)`, [pids[35], uid(1)]);
    // user 8 had Discord and records, then unlinked it: no stamps for an account without Discord now
    await addUser(8);
    await db.query(`insert into games.wp_plays(puzzle_id, user_id, nick, verified, started_at, guessed_at, g_lat, g_lon, km, points)
      values ($1, $2, 'Fren8', true, now() - interval '12 days', now() - interval '12 days', 52, 21, 1, 5000)`, [pids[12], uid(8)]);
    await db.query("insert into games.letters(user_id, name, discord, body) values ($1, 'Fren8', true, 'bye')", [uid(8)]);
    await db.query("insert into games.yeet_records(user_id, nick, best) values ($1, 'Fren8', 60000)", [uid(8)]);
    await db.query('delete from auth.identities where user_id = $1', [uid(8)]);
    // a guest's play (not verified) never counts
    await db.query(`insert into games.wp_plays(puzzle_id, user_id, nick, verified, started_at, guessed_at, g_lat, g_lon, km, points)
      values ($1, $2, 'guest', false, now() - interval '20 days', now() - interval '20 days', 52, 21, 1, 5000)`, [pids[20], uid(4)]);

    // --- the migration, on launch day, twice
    const awards = await read('games/supabase/update_passport_awards.sql');
    await db.query(awards);
    const launch = await one("select at from games.passport_meta where k = 'pioneer_snapshot'");
    await addUser(6);                       // joins after launch: never a Pioneer, even when the file runs again
    await db.query(awards);
    assert.equal(+(await one("select at from games.passport_meta where k = 'pioneer_snapshot'")), +launch);

    assert.ok(await has(1, 'pond_pioneer')); assert.ok(await has(2, 'pond_pioneer')); assert.ok(await has(3, 'pond_pioneer'));
    assert.ok(!(await has(4, 'pond_pioneer')), 'guest'); assert.ok(!(await has(5, 'pond_pioneer')), 'e-mail account');
    assert.ok(!(await has(6, 'pond_pioneer')), 'joined after launch');
    // backfills, dated from the real records
    assert.ok(await has(1, 'moonwalker'));
    assert.equal(+(await one("select earned_at from games.passport_badges where user_id = $1 and badge_id = 'moonwalker'", [uid(1)])),
      +(await one('select achieved_at from games.yeet_records where user_id = $1', [uid(1)])));
    assert.deepEqual((await stamps(1)).filter(s => !['pond_pioneer', 'moonwalker'].includes(s)),
      ['pepe_guesser', 'scout_fren', 'sharp_eye', 'week_scout'], 'four perfect days are not five');
    assert.deepEqual(await stamps(2), ['dear_editor', 'junior_editor', 'pond_pioneer'], 'a timeout without a pin is not a guess');
    assert.equal(await one('select letters from games.passport_progress where user_id = $1', [uid(2)]), 6);
    assert.deepEqual(await stamps(4), [], 'guests get nothing');
    assert.deepEqual(await stamps(8), [], 'Discord unlinked: nothing, even with old records');
    const kth = (u, b) => one('select earned_at from games.passport_badges where user_id = $1 and badge_id = $2', [uid(u), b]);
    const playAt = (u, back) => one('select guessed_at from games.wp_plays where user_id = $1 and puzzle_id = $2', [uid(u), pids[back]]);
    assert.equal(+(await kth(1, 'pepe_guesser')), +(await playAt(1, 20)));
    assert.equal(+(await kth(1, 'week_scout')), +(await playAt(1, 14)), '7th day of the run');
    assert.equal(+(await kth(1, 'scout_fren')), +(await playAt(1, 7)), '14th day of the run');
    assert.equal(+(await kth(1, 'sharp_eye')), +(await playAt(1, 9)));

    // --- access: tables closed, helpers not callable, only the checkin RPC is new for the browser
    const priv = (await db.query(`select
      has_table_privilege('authenticated', 'games.passport_progress', 'SELECT') as t1,
      has_table_privilege('authenticated', 'games.passport_yeet_5k', 'INSERT') as t2,
      has_table_privilege('authenticated', 'games.passport_days', 'INSERT') as t3,
      has_table_privilege('authenticated', 'games.passport_chat_days', 'INSERT') as t4,
      has_table_privilege('authenticated', 'games.passport_meta', 'DELETE') as t5,
      has_function_privilege('authenticated', 'games.passport_award(uuid,text,timestamptz)', 'EXECUTE') as f1,
      has_function_privilege('authenticated', 'games.passport_wp_check(uuid)', 'EXECUTE') as f2,
      has_function_privilege('authenticated', 'games.passport_yeet_flight(uuid,integer)', 'EXECUTE') as f3,
      has_function_privilege('anon', 'public.gry_passport_checkin()', 'EXECUTE') as anon_checkin,
      has_function_privilege('authenticated', 'public.gry_passport_checkin()', 'EXECUTE') as checkin,
      has_function_privilege('authenticated', 'public.gry_yeet_submit(integer,integer,integer)', 'EXECUTE') as yeet,
      (select bool_and(relrowsecurity) from pg_class where oid in ('games.passport_progress'::regclass, 'games.passport_yeet_5k'::regclass,
        'games.passport_days'::regclass, 'games.passport_chat_days'::regclass, 'games.passport_meta'::regclass)) as rls`)).rows[0];
    assert.deepEqual(priv, { t1: false, t2: false, t3: false, t4: false, t5: false, f1: false, f2: false, f3: false,
      anon_checkin: false, checkin: true, yeet: true, rls: true });
    await assert.rejects(call(1, "select games.passport_award($1, 'moonwalker') as v", [uid(3)]), /permission denied/);
    await assert.rejects(db.query("select games.passport_award($1, 'bali')", [uid(3)]), /Unknown passport stamp/);

    // --- YEET: three accepted flights over 5000 m; 5000.0 exactly does not count; rate-limited ones do not count
    const cool = u => db.query("update games.yeet_records set last_attempt_at = now() - interval '20 seconds' where user_id = $1", [uid(u)]);
    const fly = (u, score) => call(u, 'select public.gry_yeet_submit($1, $2, 1) as v', [score, score + 50]);
    assert.equal((await fly(3, 50000)).saved, true); await cool(3);
    await fly(3, 50001);
    assert.equal((await fly(3, 52000)).rate_limited, true, 'too soon');
    await cool(3); await fly(3, 51000);
    assert.ok(!(await has(3, 'nasa_is_hiring')));
    await cool(3); await fly(3, 50500);   // a lower flight than the best still counts as its own flight
    assert.ok(await has(3, 'nasa_is_hiring'));
    await cool(3); await fly(3, 59000);
    assert.equal(await one('select count(*)::int from games.passport_yeet_5k where user_id = $1', [uid(3)]), 3, 'only the first three are kept');
    assert.deepEqual((await db.query('select distance from games.passport_yeet_5k where user_id = $1 order by n', [uid(3)])).rows.map(r => r.distance), [50001, 51000, 50500]);
    assert.ok(!(await has(3, 'moonwalker')));
    await cool(3); await fly(3, 60000);
    assert.ok(await has(3, 'moonwalker'));
    await assert.rejects(fly(4, 55000), /Log in with Discord/);
    assert.equal(await one('select count(*)::int from games.passport_yeet_5k where user_id = $1', [uid(4)]), 0);

    // --- Pepe Guesser today, through the real RPCs: a far pin first (user 3), then a perfect one (user 6)
    const todayId = await puzzle(today, 99);
    await call(3, 'select public.gry_wp_start() as v');
    const far = await call(3, 'select public.gry_wp_guess(-33.86, 151.2) as v');
    assert.ok(far.points < 5000);
    assert.ok(await has(3, 'pepe_guesser')); assert.ok(!(await has(3, 'sharp_eye')));
    await call(6, 'select public.gry_wp_start() as v');
    const near = await call(6, 'select public.gry_wp_guess(52.23, 21.01) as v');
    assert.equal(near.points, 5000);
    assert.ok(await has(6, 'pepe_guesser')); assert.ok(await has(6, 'sharp_eye'));
    // a guest playing today gets nothing
    await db.query("update auth.users set is_anonymous = true where id = $1", [uid(4)]);
    await call(4, "select public.gry_wp_start('Guesty') as v"); await call(4, 'select public.gry_wp_guess(52.23, 21.01) as v');
    assert.deepEqual(await stamps(4), []);
    // a failing stamp never breaks the game: block one stamp, the guess still saves
    await addUser(7);
    await db.query("alter table games.passport_badges add constraint test_block check (badge_id <> 'pepe_guesser') not valid");
    await call(7, 'select public.gry_wp_start() as v');
    const blocked = await call(7, 'select public.gry_wp_guess(52.23, 21.01) as v');
    assert.equal(blocked.points, 5000);
    assert.ok(await one('select guessed_at is not null from games.wp_plays where user_id = $1 and puzzle_id = $2', [uid(7), todayId]));
    await db.query('alter table games.passport_badges drop constraint test_block');
    assert.ok(!(await has(7, 'pepe_guesser')), 'the blocked award was skipped, nothing else changed');
    assert.equal(warnings.length, 1); assert.match(warnings[0], /passport wp hook: .*test_block/);
    warnings.length = 0;
    // detective: user 1 gets a fifth perfect day today
    await call(1, 'select public.gry_wp_start() as v'); await call(1, 'select public.gry_wp_guess(52.23, 21.01) as v');
    assert.ok(await has(1, 'detective_fren'));

    // --- lobby chat and @mentions, through gry_lobby_say
    const say = (u, text, nick) => call(u, 'select public.gry_lobby_say($1, $2) as v', [text, nick || null]);
    const backdateChat = u => db.query("update games.lobby_chat set created_at = created_at - interval '1 minute' where user_id = $1", [uid(u)]);
    await say(3, 'gm pond', 'Fren3');
    assert.ok(await has(3, 'first_words')); assert.ok(!(await has(3, 'hey_fren')));
    await backdateChat(3);
    await say(3, 'hi @Fren9', 'Fren3');                 // nobody has that nickname: no mention, no stamp
    assert.ok(!(await has(3, 'hey_fren')));
    await say(6, 'hello', 'Fren6');
    await backdateChat(3);
    await say(3, '@Fren6 welcome!', 'Fren3');
    assert.ok(await has(3, 'hey_fren')); assert.ok(!(await has(6, 'hey_fren')), 'being mentioned is not mentioning');
    // community: five different UTC days
    // (today's row is removed before each message, so that message is the first of "its" day again)
    const notToday = () => db.query("delete from games.passport_chat_days where user_id = $1 and day = (now() at time zone 'utc')::date", [uid(3)]);
    for (let back = 1; back <= 3; back++) await db.query("insert into games.passport_chat_days values ($1, (now() at time zone 'utc')::date - $2::int)", [uid(3), back]);
    await notToday(); await backdateChat(3); await say(3, 'still here', 'Fren3');
    assert.equal(await one('select count(*)::int from games.passport_chat_days where user_id = $1', [uid(3)]), 4);
    assert.ok(!(await has(3, 'community_fren')), 'four days');
    await db.query("insert into games.passport_chat_days values ($1, (now() at time zone 'utc')::date - 4)", [uid(3)]);
    await notToday(); await backdateChat(3); await say(3, 'fifth day', 'Fren3');
    assert.ok(await has(3, 'community_fren'));
    // a no-session visitor's message has no account and earns nothing
    await call(null, "select public.gry_lobby_say('anon hi', 'Visitor') as v", [], 'anon').catch(() => {});
    assert.equal(await one("select count(*)::int from games.passport_chat_days where user_id is null"), 0);

    // --- letters through gry_letter_send: Discord only
    await call(3, "select public.gry_letter_send('Dear editor, more frogs please', '', '/meme/', true) as v");
    assert.ok(await has(3, 'dear_editor'));
    await call(4, "select public.gry_letter_send('guest here', 'Guesty', '/meme/', false) as v");
    assert.ok(!(await has(4, 'dear_editor')));
    for (let k = 0; k < 4; k++) {
      await db.query("update games.letters set created_at = created_at - interval '25 hours' where user_id = $1", [uid(3)]);
      await call(3, "select public.gry_letter_send('Another letter', '', '/meme/', false) as v");
    }
    assert.ok(await has(3, 'junior_editor')); assert.ok(!(await has(3, 'senior_editor')));
    for (let k = 0; k < 5; k++) {
      await db.query("update games.letters set created_at = created_at - interval '25 hours' where user_id = $1", [uid(3)]);
      await call(3, "select public.gry_letter_send('Letter again', '', '/meme/', false) as v");
      if (k === 3) assert.ok(!(await has(3, 'senior_editor')), 'nine letters');
    }
    assert.ok(await has(3, 'senior_editor'));
    assert.equal(await one('select letters from games.passport_progress where user_id = $1', [uid(3)]), 10);

    // --- Pepe Miner: the server's own clock between saves at most 120 s apart
    const mine = u => call(u, "select public.gry_miner_save('{\"allTime\":1}'::jsonb, 1) as v");
    const gap = (u, s) => db.query("update games.miner_saves set updated_at = now() - make_interval(secs => $2::int) where user_id = $1; ", [uid(u), s])
      .then(() => db.query('update games.passport_progress set miner_last_at = clock_timestamp() - make_interval(secs => $2::int) where user_id = $1', [uid(u), s]));
    await mine(3);
    assert.equal(await one('select miner_seconds from games.passport_progress where user_id = $1', [uid(3)]), 0);
    assert.equal((await mine(3)).saved, false, 'the miner RPC itself refuses saves within 20 s');
    for (let k = 0; k < 9; k++) { await gap(3, 60); await mine(3); }
    assert.ok(!(await has(3, 'rookie_miner')), '9 minutes');
    await gap(3, 300); await mine(3);                  // a five-minute break is not play time
    assert.ok(!(await has(3, 'rookie_miner')));
    await gap(3, 61); await mine(3);
    assert.ok(await has(3, 'rookie_miner'));
    await db.query('update games.passport_progress set miner_seconds = 3590 where user_id = $1', [uid(3)]);
    await gap(3, 30); await mine(3);
    assert.ok(await has(3, 'miner_fren'));
    await assert.rejects(call(4, "select public.gry_miner_save('{}'::jsonb, 1) as v"), /Sign in with Discord/);

    // --- Welcome Back!, Guess You Like It Here (30 days in a row) and the one-time notices
    assert.deepEqual(await call(4, 'select public.gry_passport_checkin() as v'), { signed_in: false });
    const first = await call(2, 'select public.gry_passport_checkin() as v');
    assert.deepEqual(first.new_badges.map(b => b.id).sort(), ['dear_editor', 'junior_editor', 'pond_pioneer']);
    assert.deepEqual((await call(2, 'select public.gry_passport_checkin() as v')).new_badges, [], 'each notice once');
    const visit = (u, back) => db.query("insert into games.passport_days values ($1, (now() at time zone 'utc')::date - $2::int)", [uid(u), back]);
    const notTodayVisit = u => db.query("delete from games.passport_days where user_id = $1 and day = (now() at time zone 'utc')::date", [uid(u)]);
    for (let back = 1; back <= 28; back++) await visit(6, back);
    await call(6, 'select public.gry_passport_checkin() as v');
    assert.ok(!(await has(6, 'like_it_here')), '29 days');
    assert.ok(await has(6, 'streak_14'), '14 days in a row are inside the 29');
    // 14-Day Streak: 13 days are not enough, the 14th day is
    await addUser(12);
    for (let back = 1; back <= 12; back++) await visit(12, back);
    await call(12, 'select public.gry_passport_checkin() as v');
    assert.ok(!(await has(12, 'streak_14')), '13 days');
    await notTodayVisit(12); await visit(12, 13);
    await call(12, 'select public.gry_passport_checkin() as v');
    assert.ok(await has(12, 'streak_14'));
    await notTodayVisit(6); await visit(6, 29);
    const month = await call(6, 'select public.gry_passport_checkin() as v');
    assert.ok(await has(6, 'like_it_here'));
    assert.ok(month.new_badges.some(b => b.id === 'like_it_here'));
    assert.ok(!(await has(6, 'welcome_back')), 'an old regular is not "back on day two"');
    // a gap breaks the run
    for (let back = 1; back <= 30; back++) if (back !== 5) await visit(7, back);   // 30 days, one missing
    await call(7, 'select public.gry_passport_checkin() as v');
    assert.ok(!(await has(7, 'like_it_here')));
    // Welcome Back!: first visit yesterday, second today. Not on the first day, not after a gap, not on a third day.
    await addUser(9); await addUser(10); await addUser(11);
    await call(9, 'select public.gry_passport_checkin() as v');
    assert.ok(!(await has(9, 'welcome_back')), 'first visit');
    await notTodayVisit(9); await visit(9, 1);
    await call(9, 'select public.gry_passport_checkin() as v');
    assert.ok(await has(9, 'welcome_back'));
    await visit(10, 3); await call(10, 'select public.gry_passport_checkin() as v');
    assert.ok(!(await has(10, 'welcome_back')), 'came back after a gap');
    await visit(11, 2); await visit(11, 1); await call(11, 'select public.gry_passport_checkin() as v');
    assert.ok(!(await has(11, 'welcome_back')), 'third day');

    // --- the Passport read path: stored stamps once each, plus the server's own counters
    const st = await call(3, 'select public.gry_passport_state() as v');
    const ids = st.achievements.filter(a => a.earned_at).map(a => a.id);
    assert.equal(new Set(ids).size, ids.length, 'no duplicates');
    for (const id of ['first_fren', 'pond_pioneer', 'moonwalker', 'nasa_is_hiring', 'pepe_guesser', 'first_words', 'hey_fren',
      'community_fren', 'dear_editor', 'junior_editor', 'senior_editor', 'rookie_miner', 'miner_fren']) assert.ok(ids.includes(id), id);
    assert.deepEqual(st.progress, { yeet_5k_flights: 3, yeet_5k_total: 5, letters: 10, miner_minutes: 60, chat_days: 5, login_streak: 0,
      login_days: 0, wp_days: 1, wp_perfect_days: 0, wp_streak: 1 });
    // every accepted flight is counted for later stamps (the rate-limited one is not)
    assert.equal(await one('select yeet_flights from games.passport_progress where user_id = $1', [uid(3)]), 6);
    const s1 = await call(1, 'select public.gry_passport_state() as v');
    assert.equal(s1.progress.wp_days, 16); assert.equal(s1.progress.wp_perfect_days, 5);
    assert.equal(s1.progress.wp_streak, 1, 'today only: days 5..1 back were not played');
    assert.equal(s1.achievements.filter(a => a.id === 'moonwalker').length, 1);
    const s6 = await call(6, 'select public.gry_passport_state() as v');
    assert.equal(s6.progress.login_streak, 30); assert.equal(s6.progress.login_days, 30);

    // --- reward parts in the Avatar Maker: locked without the stamp, saveable with it
    const SAVE = 'select public.gry_passport_avatar_save($1, $2, $3, $4, $5, $6) as v';
    const look = (bg, c, h, a) => [bg, c, 'mouth_smile', 'eyes_classic', h, a];
    await assert.rejects(call(6, SAVE, look('bg_sky', 'clothing_suit', 'hat_none', 'accessory_none')), /That part is locked/);
    await assert.rejects(call(6, SAVE, look('bg_sky', 'clothing_blue', 'hat_hardhat', 'accessory_none')), /That part is locked/);
    await assert.rejects(call(1, SAVE, look('bg_sunset', 'clothing_blue', 'hat_none', 'accessory_none')), /That part is locked/, 'Adept is not earnable yet');
    await assert.rejects(call(1, SAVE, look('bg_sky', 'clothing_blue', 'hat_none', 'accessory_headphones')), /That part is locked/);
    assert.equal(await one('select count(*)::int from games.passport_avatars where user_id = $1', [uid(6)]), 0);
    // user 1: Detective Fren (suit + detective hat) and Scout Fren (explorer hat)
    const dressed = await call(1, SAVE, look('bg_sky', 'clothing_suit', 'hat_detective', 'accessory_none'));
    assert.equal(dressed.avatar.hat, 'hat_detective'); assert.equal(dressed.badge.new, true);
    assert.equal(dressed.avatar.special, 'special_none');
    // Scout Fren also opens Lily's special avatar Explorer Pepe; it is saved with the parts under it
    const SAVE7 = 'select public.gry_passport_avatar_save($1, $2, $3, $4, $5, $6, $7) as v';
    await assert.rejects(call(6, SAVE7, [...look('bg_sky', 'clothing_blue', 'hat_none', 'accessory_none'), 'special_explorer']), /That part is locked/);
    await db.query("update games.passport_avatars set updated_at = now() - interval '5 seconds' where user_id = $1", [uid(1)]);
    const explorer = await call(1, SAVE7, [...look('bg_forest', 'clothing_suit', 'hat_explorer', 'accessory_none'), 'special_explorer']);
    assert.equal(explorer.avatar.special, 'special_explorer'); assert.equal(explorer.avatar.hat, 'hat_explorer');
    assert.equal((await call(1, 'select public.gry_passport_state() as v')).avatar.special, 'special_explorer');
    // user 3: Miner Fren opens the hard hat
    assert.equal((await call(3, SAVE, look('bg_sky', 'clothing_blue', 'hat_hardhat', 'accessory_none'))).avatar.hat, 'hat_hardhat');
    // a reward part in the wrong slot is still an unknown option
    await assert.rejects(call(1, SAVE, look('hat_detective', 'clothing_blue', 'hat_none', 'accessory_none')), /Unknown avatar option/);

    // --- account deletion removes the new rows too
    await db.query('delete from auth.users where id = $1', [uid(3)]);
    for (const t of ['passport_progress', 'passport_yeet_5k', 'passport_chat_days', 'passport_days', 'passport_badges'])
      assert.equal(await one(`select count(*)::int from games.${t} where user_id = $1`, [uid(3)]), 0, t);
    assert.deepEqual(warnings, [], 'no hook failed');
  } finally {
    await db.end().catch(() => {});
    await admin.query('drop database if exists ' + dbName + ' with (force)').catch(() => {});
    await admin.end();
  }
});
