// PepeGochi v2 → Fren Passport bridge (games/supabase/update_pepegochi_passport.sql) on a real PostgreSQL (15+),
// installed on top of the Fren Passport files and update_pepegochi_v2.sql, played through the real RPCs.
//   PASSPORT_PG_URL=postgres://postgres:pw@localhost:5432/postgres \
//   PASSPORT_PG_MODULE=/abs/path/node_modules/pg/lib/index.js \
//   node --test tests/pepegochi-passport-sql.test.mjs
// It creates and drops its own database. Never point it at Supabase. Time is virtual (scripts/pepegochi_sim.mjs).
//
// The launch branch has the four life-cycle stamps in games.passport_award()'s allowlist. "Old" below is that
// function without them (a Passport file from before the release): the milestones must wait and never get lost.
// A new frog is an egg; its first accepted care hatches it (milestone "hatched" -> First Hatch).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepare, setRules, addPlayer, callRpc, asDb, uid, Sim, START, VIRTUAL_CLOCK } from '../scripts/pepegochi_sim.mjs';

const URL_ENV = process.env.PASSPORT_PG_URL;
const MOD_ENV = process.env.PASSPORT_PG_MODULE;
const H = 36e5;
const read = p => readFile(new URL('../' + p, import.meta.url), 'utf8');
// the game migrations update_passport_awards.sql hooks into (tests/passport-awards-sql.test.mjs), then the Passport
const PASSPORT = ['update_yeet.sql', 'update_wheres_pepe.sql', 'update_wheres_pepe_guests.sql', 'update_lobby_chat.sql',
  'update_open_chat.sql', 'update_lobby_mentions.sql', 'update_frog_letters.sql', 'update_letters_community.sql',
  'update_miner_cloud.sql', 'update_fren_passport.sql', 'update_fren_avatar.sql', 'update_passport_awards.sql'];
const STAMPS = ['first_hatch', 'grown_fren', 'little_fren'];

test('PepeGochi v2 → Fren Passport bridge: life-cycle stamps through passport_award(), never lost',
  { skip: !(URL_ENV && MOD_ENV) && 'set PASSPORT_PG_URL and PASSPORT_PG_MODULE', timeout: 300000 }, async t => {
  const pg = (await import(MOD_ENV)).default;
  const admin = new pg.Client({ connectionString: URL_ENV });
  await admin.connect();
  const dbName = 'pepegochi_passport_test_' + process.pid + '_' + Date.now();
  await admin.query('create database ' + dbName);
  const url = new URL(URL_ENV); url.pathname = '/' + dbName;
  const warnings = [];
  const raw = new pg.Client({ connectionString: url.toString() });
  await raw.connect();
  raw.on('notice', n => { if (n.severity === 'WARNING') warnings.push(n.message); });
  const db = asDb(raw);
  try {
    const { base } = await prepare(db, { extra: PASSPORT });
    const bridge = await read('games/supabase/update_pepegochi_passport.sql');
    const awardsFile = await read('games/supabase/update_passport_awards.sql');
    const todayAward = awardsFile.match(/create or replace function games\.passport_award\([\s\S]*?\n\$\$;/)[0];
    const oldAward = todayAward.replace(/,\s*'first_hatch', 'little_fren', 'grown_fren', 'good_parent'/, '');
    assert.notEqual(oldAward, todayAward);
    const release = () => db.exec(todayAward);
    await db.exec(oldAward);

    let next = 1;
    const player = async opts => { const n = next++; await addPlayer(db, n, opts); return n; };
    const at = (h = 0) => new Date(+new Date(START) + h * H);
    const rpc = (user, fn, now = at()) => callRpc(db, { user, now }, 'public.' + fn);
    const ok = async (...a) => { const r = await rpc(...a); assert.ok(r.ok, r.error); return r.value; };
    const one = async (sql, args = []) => (await db.query(sql, args)).rows[0];
    const careAt = async (user, h) => { const s = new Sim(db, { user, start: at(h) }); await s.care(); return s.last; };
    // adoption at hour h, then a full visit on 8 UTC days: froglet on the 2nd care day, adult on the 7th
    const grow = async (p, h = 0, days = 8) => {
      await ok(p, "gry_pepegochi_adopt('Fren')", at(h));
      for (let d = 0; d < days; d++) await careAt(p, h + 1 + d * 24);
    };
    const badges = async p => (await db.query('select badge_id, earned_at from games.passport_badges where user_id = $1 order by badge_id', [uid(p)])).rows;
    const ids = async p => (await badges(p)).map(b => b.badge_id);
    const pending = async p => (await db.query('select milestone from games.pepegochi_milestones where user_id = $1 and synced_at is null order by milestone', [uid(p)])).rows.map(r => r.milestone);
    const reached = async (p, m) => (await one('select reached_at from games.pepegochi_milestones where user_id = $1 and milestone = $2', [uid(p), m])).reached_at;
    const datedAtMilestones = async p => {
      const b = await badges(p);
      for (const [m, s] of [['hatched', 'first_hatch'], ['froglet', 'little_fren'], ['adult', 'grown_fren']])
        assert.equal(+b.find(x => x.badge_id === s).earned_at, +(await reached(p, m)), s + ' is dated at its milestone');
    };
    const ourWarnings = () => warnings.filter(w => /pepegochi|passport/i.test(w));

    // played before the bridge existed: the A1 no-op hook kept their milestones pending
    const early = await player();
    await grow(early);
    const unlinked = await player();
    await grow(unlinked, 2);
    await db.query('delete from auth.identities where user_id = $1', [uid(unlinked)]);

    await t.test('C1 the install order is checked', async () => {
      await db.exec('begin');
      try {
        await db.exec('drop function games.passport_award(uuid, text, timestamptz)');
        await assert.rejects(db.exec(bridge), /Run update_passport_awards\.sql before update_pepegochi_passport\.sql/);
      } finally { await db.exec('rollback'); }
    });

    await t.test('C2 with an old Passport the stamps wait: not awardable yet; nothing is lost, no warning', async () => {
      warnings.length = 0;
      await db.exec(bridge);
      assert.deepEqual(await ids(early), []);
      assert.deepEqual(await pending(early), ['adult', 'froglet', 'hatched'], 'first_adoption is not a stamp: done');
      const p = await player();
      await grow(p, 300);
      const s = await ok(p, 'gry_pepegochi_state()', at(300 + 8 * 24));
      assert.equal(s.pet.stage, 'adult', 'the game itself is unaffected');
      assert.deepEqual(await ids(p), []);
      assert.deepEqual(await pending(p), ['adult', 'froglet', 'hatched']);
      assert.deepEqual(ourWarnings(), [], '"not in the allowlist yet" is silent');
    });

    await t.test('C3 release: running the file again delivers every pending milestone, dated at the milestone', async () => {
      await release();
      await db.exec(bridge);
      assert.deepEqual(await ids(early), STAMPS);
      await datedAtMilestones(early);
      assert.deepEqual(await pending(early), []);
      // an account without Discord gets nothing and keeps its milestones
      assert.deepEqual(await ids(unlinked), []);
      assert.deepEqual(await pending(unlinked), ['adult', 'froglet', 'hatched']);
      // again: no change
      const snap = async () => JSON.stringify([await badges(early), (await db.query('select * from games.pepegochi_milestones order by user_id, milestone')).rows]);
      const before = await snap();
      await db.exec(bridge);
      assert.equal(await snap(), before);
    });

    await t.test('C4 after release each stamp arrives in the same action as its milestone', async () => {
      const p = await player();
      const a = await ok(p, "gry_pepegochi_adopt('Fren')", at(600));
      assert.equal(a.pet.stage, 'egg', 'a new frog is an egg');
      assert.deepEqual(await ids(p), [], 'adopting is not hatching');
      await careAt(p, 601);
      assert.deepEqual(await ids(p), ['first_hatch'], 'the first care hatches it');
      assert.equal((await ok(p, 'gry_pepegochi_state()', at(602))).pet.stage, 'tadpole');
      await careAt(p, 625);
      assert.deepEqual(await ids(p), ['first_hatch', 'little_fren']);
      for (let d = 2; d < 7; d++) await careAt(p, 601 + d * 24);
      assert.deepEqual(await ids(p), STAMPS);
      assert.deepEqual(await pending(p), []);
      await datedAtMilestones(p);
      // the Passport lists them (the window takes names and art from the catalog)
      const st = (await callRpc(db, { user: p, now: at(800) }, 'public.gry_passport_state()')).value;
      for (const s of STAMPS) assert.ok(st.achievements.some(a => a.id === s && a.earned_at), s + ' in gry_passport_state');
    });

    await t.test('C5 once per account: a later frog earns no second copy', async () => {
      const p = await player();
      await grow(p, 900, 8);
      await ok(p, 'gry_pepegochi_state()', at(900 + 24 * 20));                 // moved out by now
      await ok(p, 'gry_pepegochi_letter_read()', at(900 + 24 * 20));
      await grow(p, 900 + 24 * 20 + 1, 8);
      assert.equal((await one("select count(*)::int n from games.pepegochi_lives where user_id = $1", [uid(p)])).n, 2);
      assert.deepEqual(await ids(p), STAMPS);
    });

    await t.test('C6 an account without Discord receives nothing; after relinking, the next accepted action delivers', async () => {
      const r = await rpc(unlinked, "gry_pepegochi_action('feed')", at(400));
      assert.equal(r.ok, false, 'its RPCs are refused (A5)');
      assert.deepEqual(await ids(unlinked), []);
      await db.query("insert into auth.identities values ($1, 'discord', 'p-again', '{}')", [uid(unlinked)]);
      await ok(unlinked, 'gry_pepegochi_letter_read()', at(400));               // moved out long ago
      await ok(unlinked, "gry_pepegochi_adopt('Fren II')", at(400));
      assert.deepEqual(await ids(unlinked), STAMPS, 'the next accepted write delivers the old milestones');
      await datedAtMilestones(unlinked);
    });

    await t.test('C7 a broken Passport keeps the care, logs a warning and keeps the milestone for later', async () => {
      await db.exec(`create function games.test_break_badges() returns trigger language plpgsql as $$ begin perform 1 / 0; return new; end $$;
        create trigger test_break before insert on games.passport_badges for each row execute function games.test_break_badges();`);
      try {
        warnings.length = 0;
        const p = await player();
        const a = await ok(p, "gry_pepegochi_adopt('Fren')", at(1500));
        assert.equal(a.adopt_result, 'adopted');
        const c = await careAt(p, 1501);
        assert.ok(c, 'the care is kept');
        assert.ok(ourWarnings().some(w => /pepegochi passport sync: division by zero/.test(w)), ourWarnings().join(' | '));
        assert.deepEqual(await ids(p), []);
        assert.deepEqual(await pending(p), ['hatched']);
        await db.exec('drop trigger test_break on games.passport_badges');
        await careAt(p, 1525);
        assert.deepEqual(await ids(p), ['first_hatch', 'little_fren']);
        assert.deepEqual(await pending(p), []);
      } finally {
        await db.exec('drop trigger if exists test_break on games.passport_badges; drop function games.test_break_badges();');
      }
    });

    await t.test('C8 Good Parent is a stamp: good care days in one life', async () => {
      await setRules(db, base, { good_parent_days: 2 });
      try {
        const p = await player();
        await grow(p, 2000, 3);
        assert.deepEqual(await pending(p), []);
        assert.deepEqual(await ids(p), ['first_hatch', 'good_parent', 'little_fren']);
        assert.equal((await one("select count(*)::int n from games.passport_badges where badge_id = 'certified_fren'")).n, 0, 'never from PepeGochi');
      } finally { await setRules(db, base); }
    });

    await t.test('C9 running update_pepegochi_v2.sql or update_passport_awards.sql again loses nothing', async () => {
      await db.exec(await read('games/supabase/update_pepegochi_v2.sql'));
      await db.exec(VIRTUAL_CLOCK);
      assert.match((await one("select prosrc from pg_proc where proname = 'pepegochi_passport_sync'")).prosrc, /passport_award/,
        'the bridge hook survives a new run of A1');
      warnings.length = 0;
      await db.exec(awardsFile);
      const p = await player();
      await grow(p, 2500, 2);
      assert.deepEqual(await ids(p), ['first_hatch', 'little_fren']);
      assert.deepEqual(await pending(p), []);
      assert.deepEqual(ourWarnings(), []);
    });

    await t.test('C10 one player\'s action delivers only that player\'s milestones', async () => {
      await db.exec(oldAward);
      const a = await player(), b = await player();
      await grow(a, 3000, 2); await grow(b, 3000, 2);
      await release();
      await careAt(a, 3000 + 1 + 2 * 24);
      assert.deepEqual(await ids(a), ['first_hatch', 'little_fren']);
      assert.deepEqual(await ids(b), []);
      assert.deepEqual(await pending(b), ['froglet', 'hatched']);
    });

    await t.test('C11 the bridge is closed to the browser and keeps the PepeGochi function rules', async () => {
      for (const f of ['games.pepegochi_passport_sync(uuid)', 'games.pepegochi_passport_stamp(text)']) {
        for (const role of ['anon', 'authenticated', 'public'])
          assert.equal((await one('select has_function_privilege($1, $2, \'execute\') as v', [role, f])).v, false, role + ' ' + f);
        const p = await one('select prosecdef, proconfig from pg_proc where oid = $1::regprocedure', [f]);
        assert.equal(p.prosecdef, false, f);
        assert.deepEqual(p.proconfig, ['search_path=""'], f);
      }
      const r = await callRpc(db, { user: early, now: at(4000) }, 'games.pepegochi_passport_sync($1)', [uid(early)]);
      assert.equal(r.ok, false); assert.match(r.error, /permission denied/);
      // the award path itself is still closed too
      assert.equal((await one("select has_function_privilege('authenticated', 'games.passport_award(uuid, text, timestamptz)', 'execute') as v")).v, false);
    });
  } finally {
    await raw.end();
    await admin.query('drop database if exists ' + dbName + ' with (force)');
    await admin.end();
  }
});
