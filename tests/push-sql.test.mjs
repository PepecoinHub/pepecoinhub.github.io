// Optional PostgreSQL integration test for games/supabase/update_push.sql (PondOS push notifications).
//   PASSPORT_PG_URL=postgres://postgres:pw@localhost:5432/postgres \
//   PASSPORT_PG_MODULE=/abs/path/node_modules/pg/lib/index.js \
//   node --test tests/push-sql.test.mjs
// It creates and drops its own database. Never point it at Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SKIP, pondDb, caller, addUser } from './pond-sql-setup.mjs';

const read = p => readFile(new URL('../' + p, import.meta.url), 'utf8');
const P256 = 'B' + 'A'.repeat(86), AUTH = 'C'.repeat(22);
const ep = i => 'https://fcm.googleapis.com/fcm/send/device-' + i;

test('push: devices choose kinds, events queue one note each, only the service role takes them',
  { skip: SKIP, timeout: 120000 }, async () => {
  const { db, drop } = await pondDb('push_test');
  try {
    // the parts of earlier files this one hooks into: lobby chat + mentions (+ @everyone column), the Gazette
    await db.query(`
      do $$ begin create role service_role nologin; exception when duplicate_object or unique_violation then null; end $$;
      create table games.lobby_chat (id bigint generated always as identity primary key, user_id uuid, nick text not null,
        verified boolean not null default false, body text not null, broadcast boolean not null default false,
        created_at timestamptz not null default now());
      create table games.gazette_issues (num int primary key, title text not null default '', published_at timestamptz);`);
    const ment = await read('games/supabase/update_lobby_mentions.sql');
    await db.query(ment.match(/create table if not exists games\.lobby_mentions[\s\S]*?\n\);/)[0]);
    await db.query(ment.match(/create table if not exists games\.mention_optout[^\n]*/)[0]);
    const sql = await read('games/supabase/update_push.sql');
    await db.query(sql);
    await db.query(sql);   // safe to run twice

    const byl = await addUser(db, 1, 'Byl'), fren = await addUser(db, 2, 'Fren'), quiet = await addUser(db, 3, 'Quiet'), guest = await addUser(db, 4);
    const call = caller(db);
    const save = (who, i, prefs = {}) => call(who, 'select public.gry_push_save($1, $2, $3, $4::jsonb) as v', [ep(i), P256, AUTH, JSON.stringify(prefs)]);
    const take = () => call({ role: 'service_role' }, 'select public.push_take(50) as v');

    // the browser side
    assert.deepEqual(await call({}, 'select public.gry_push_info() as v'), { key: null });
    await db.query("update games.push_config set vapid_public = 'PUBKEY' where id = 1");
    assert.deepEqual(await call({}, 'select public.gry_push_info() as v'), { key: 'PUBKEY' });
    await assert.rejects(call({}, "select public.gry_push_save('https://evil.example/x', $1, $2) as v", [P256, AUTH]), /not supported/);
    await assert.rejects(call({}, "select public.gry_push_save('https://fcm.googleapis.com.evil.example/x', $1, $2) as v", [P256, AUTH]), /not supported/);
    await assert.rejects(call({}, "select public.gry_push_save($1, 'short', $2) as v", [ep(9), AUTH]), /Bad push keys/);
    const def = await save({ user: fren, ip: '1.1.1.1' }, 2, { hack: true, mention: 'yes?' }).catch(e => e);
    assert.ok(def instanceof Error, 'a non-boolean choice is refused');
    const pr = await save({ user: fren, ip: '1.1.1.1' }, 2, { hack: true });
    assert.deepEqual(pr, { mention: true, everyone: true, gazette: true, challenge_mine: true, challenge_new: false });
    await save({ user: byl }, 1, {});
    await save({ user: quiet }, 3, { gazette: false });
    await save({}, 5, { challenge_new: true });                // not signed in at all
    await save({ user: guest }, 4, { everyone: false, mention: false });
    assert.deepEqual(await call({}, 'select public.gry_push_get($1) as v', [ep(3)]), { mention: true, everyone: true, gazette: false, challenge_mine: true, challenge_new: false });
    // saving again without a session keeps the fren on the device
    await save({}, 2, {});
    assert.equal((await db.query('select user_id from games.push_subs where endpoint = $1', [ep(2)])).rows[0].user_id, fren);

    // nobody but the server sees or takes the outbox
    await assert.rejects(call({ user: fren }, 'select public.push_take(5) as v'), /permission denied/);
    await assert.rejects(call({}, 'select count(*) as v from games.push_outbox'), /permission denied/);
    await assert.rejects(call({}, 'select count(*) as v from games.push_subs'), /permission denied/);
    await assert.rejects(call({ user: fren }, "select games.push_enqueue('everyone', null, null, 'x', 'y', '/', 't') as v"), /permission denied/);

    // a mention: only the mentioned fren's devices; "Mentions off" means no push
    await db.query("insert into games.mention_optout values ($1)", [quiet]);
    const m1 = (await db.query("insert into games.lobby_chat(user_id, nick, verified, body) values ($1, 'Byl', true, 'hi @Fren @Quiet') returning id", [byl])).rows[0].id;
    await db.query('insert into games.lobby_mentions(msg_id, to_user, from_user, from_nick) values ($1, $2, $3, $4), ($1, $5, $3, $4)', [m1, fren, byl, 'Byl', quiet]);
    let jobs = await take();
    assert.equal(jobs.length, 2);
    assert.equal(jobs[0].kind, 'mention');
    assert.equal(jobs[0].note.title, 'Byl mentioned you in the pond chat');
    assert.equal(jobs[0].note.url, '/meme/#lan');
    assert.deepEqual(jobs[0].to.map(s => s.endpoint), [ep(2)]);
    assert.deepEqual(jobs[1].to, [], 'Quiet switched mentions off');
    assert.deepEqual(await take(), [], 'each note is taken once');

    // @everyone: one note, not to the sender, not to devices that switched it off, max once per hour
    const ev = async (body) => {
      const id = (await db.query("insert into games.lobby_chat(user_id, nick, verified, body, broadcast) values ($1, 'Byl', true, $2, true) returning id", [byl, body])).rows[0].id;
      await db.query('insert into games.lobby_mentions(msg_id, to_user, from_user, from_nick) values ($1, $2, $3, $4)', [id, fren, byl, 'Byl']);
    };
    await ev('@everyone party at 8');
    jobs = await take();
    assert.equal(jobs.length, 1, 'no extra per-person mention note for @everyone');
    assert.equal(jobs[0].kind, 'everyone');
    assert.deepEqual(jobs[0].to.map(s => s.endpoint).sort(), [ep(2), ep(5)]);
    await ev('@everyone again');
    assert.deepEqual(await take(), [], 'second @everyone within the hour: chat only, no push');

    // a new Gazette issue: a draft says nothing; publishing it does, once
    await db.query("insert into games.gazette_issues values (11, 'Hello pond', null)");
    assert.deepEqual(await take(), []);
    await db.query('update games.gazette_issues set published_at = now() where num = 11');
    await db.query("update games.gazette_issues set title = 'Fixed typo', published_at = published_at where num = 11");
    jobs = await take();
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].note.title, 'The Pond Gazette No. 11 is out');
    assert.equal(jobs[0].note.url, '/meme/#gazette=11');
    assert.deepEqual(jobs[0].to.map(s => s.endpoint).sort(), [ep(1), ep(2), ep(4), ep(5)], 'Quiet said no to the Gazette');

    // THREE LILIES: a new challenge (opt-in, not to its creator), then "your challenge was played" to the creator
    const ch = (await db.query("insert into games.lily_challenges(creator, creator_nick) values ($1, 'Fren') returning id", [fren])).rows[0].id;
    jobs = await take();
    assert.equal(jobs[0].kind, 'challenge_new');
    assert.deepEqual(jobs[0].to.map(s => s.endpoint), [ep(5)]);
    await db.query("insert into games.lily_challenges(creator, creator_nick) values ($1, 'Byl')", [byl]);
    assert.deepEqual(await take(), [], 'one "new challenge" note per 30 minutes');
    await db.query("update games.lily_challenges set status = 'completed', result = 'opponent_win', opponent = $2, opponent_nick = 'Byl' where id = $1", [ch, byl]);
    jobs = await take();
    assert.equal(jobs[0].kind, 'challenge_mine');
    assert.equal(jobs[0].note.title, 'Byl took your challenge');
    assert.deepEqual(jobs[0].to.map(s => s.endpoint), [ep(2)]);

    // POND KING: the old king hears about the lost crown
    await db.query("select games.bulletin_post('pk:crown:x', 'pond_king', 'king_crowned', 'Byl', $1, 'Fren', $2, null, '{}')", [byl, fren]);
    jobs = await take();
    assert.equal(jobs[0].note.title, 'You lost the Pond King crown');
    assert.deepEqual(jobs[0].to.map(s => s.endpoint), [ep(2)]);

    // gone devices are forgotten; Off deletes; logging out unlinks
    await call({ role: 'service_role' }, 'select public.push_report($1, $2) as v', [[ep(5)], [ep(4)]]);
    assert.equal((await db.query('select count(*)::int n from games.push_subs where endpoint = $1', [ep(5)])).rows[0].n, 0);
    assert.equal((await db.query('select fails from games.push_subs where endpoint = $1', [ep(4)])).rows[0].fails, 1);
    assert.equal(await call({}, 'select public.gry_push_forget_user($1) as v', [ep(2)]), true);
    assert.equal((await db.query('select user_id from games.push_subs where endpoint = $1', [ep(2)])).rows[0].user_id, null);
    assert.equal(await call({}, 'select public.gry_push_delete($1) as v', [ep(2)]), true);
    assert.equal(await call({}, 'select public.gry_push_get($1) as v', [ep(2)]), null);

    // one network cannot fill the table
    for (let i = 100; i < 120; i++) await save({ ip: '9.9.9.9' }, i);
    await assert.rejects(save({ ip: '9.9.9.9' }, 200), /Too many devices/);
  } finally { await drop(); }
});
