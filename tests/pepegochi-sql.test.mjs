// PepeGochi v2 on a real PostgreSQL (15+): games/supabase/update_pepegochi_v2.sql through its four browser RPCs.
// Needs a disposable PostgreSQL server and node-postgres, like the other SQL tests:
//   PASSPORT_PG_URL=postgres://postgres:pw@localhost:5432/postgres \
//   PASSPORT_PG_MODULE=/abs/path/node_modules/pg/lib/index.js \
//   node --test tests/pepegochi-sql.test.mjs
// It creates and drops its own database. Never point it at Supabase.
// Time is virtual: the test database replaces games.pepegochi_clock() (scripts/pepegochi_sim.mjs).
// Test ids (A1, C2, R3 ...) match docs/design/pepegochi-v2/TECH_PLAN.md, section 13.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepare, setRules, addPlayer, callRpc, asDb, uid, Sim, SCENARIOS, START, DAY_MS, KINDS } from '../scripts/pepegochi_sim.mjs';

const URL_ENV = process.env.PASSPORT_PG_URL;
const MOD_ENV = process.env.PASSPORT_PG_MODULE;
const H = 36e5;
const RPCS = ['gry_pepegochi_state()', "gry_pepegochi_adopt('Fren')", "gry_pepegochi_action('feed')", 'gry_pepegochi_letter_read()'];

test('PepeGochi v2 SQL: lives, moving out, rescue, letter, re-adoption and milestones',
  { skip: !(URL_ENV && MOD_ENV) && 'set PASSPORT_PG_URL and PASSPORT_PG_MODULE', timeout: 600000 }, async t => {
  const pg = (await import(MOD_ENV)).default;
  const admin = new pg.Client({ connectionString: URL_ENV });
  await admin.connect();
  const dbName = 'pepegochi_test_' + process.pid + '_' + Date.now();
  await admin.query('create database ' + dbName);
  const url = new URL(URL_ENV); url.pathname = '/' + dbName;
  const clients = [];
  const connect = async () => {
    const c = new pg.Client({ connectionString: url.toString() });
    await c.connect();
    c.on('notice', n => warnings.push(n.message));
    clients.push(c);
    return c;
  };
  const warnings = [];
  const raw = await connect();
  const db = asDb(raw);
  try {
    // the Passport tables exist too, to prove that moving out never touches them (E1)
    const { base } = await prepare(db, { extra: ['update_yeet.sql', 'update_fren_passport.sql', 'update_fren_avatar.sql'] });
    let next = 1;
    const player = async (opts) => { const n = next++; await addPlayer(db, n, opts); return n; };
    const at = (h = 0) => new Date(+new Date(START) + h * H);
    const rpc = (user, fn, now = at(), extra = {}) => callRpc(db, { user, now, ...extra }, 'public.' + fn);
    const ok = async (...a) => { const r = await rpc(...a); assert.ok(r.ok, r.error); return r.value; };
    const one = async (sql, args = []) => (await db.query(sql, args)).rows[0];
    const life = async (user, gen) => one('select * from games.pepegochi_lives where user_id = $1 and generation = $2', [uid(user), gen]);
    const rowText = async user => (await db.query(
      `select coalesce(string_agg(x::text, '|' order by x::text), '') as v from (
         select l::text as x from games.pepegochi_lives l where l.user_id = $1
         union all select o::text from games.pepegochi_owners o where o.user_id = $1
         union all select m::text from games.pepegochi_milestones m where m.user_id = $1) q`, [uid(user)])).rows[0].v;
    // a full short visit at hour h: every action the frog needs, 3 s apart
    const careAt = async (user, h) => {
      const s = new Sim(db, { user, start: at(h) });
      await s.care();
      return s.last;
    };
    const parallel = async (n, user, fn, now) => {
      const cs = await Promise.all(Array.from({ length: n }, connect));
      const res = await Promise.all(cs.map(c => callRpc(asDb(c), { user, now }, 'public.' + fn)));
      await Promise.all(cs.map(c => c.end()));
      clients.splice(clients.length - n, n);
      return res;
    };

    // ---------- A: sign-in and ownership ----------
    await t.test('A1 anon role cannot run any PepeGochi RPC', async () => {
      const p = await player();
      for (const f of RPCS) {
        const r = await rpc(p, f, at(), { role: 'anon' });
        assert.equal(r.ok, false); assert.match(r.error, /permission denied/, f);
      }
    });

    await t.test('A2 anonymous guests and e-mail-only accounts are refused and write nothing', async () => {
      const guest = await player({ provider: null });
      const mail = await player({ provider: 'email' });
      for (const u of [guest, mail]) for (const f of RPCS) {
        const r = await rpc(u, f);
        assert.equal(r.ok, false); assert.match(r.error, /Discord sign-in required/);
        assert.equal(r.code, '42501');
      }
      const none = await rpc(null, 'gry_pepegochi_state()');
      assert.match(none.error, /Discord sign-in required/);
      assert.equal((await one('select count(*)::int n from games.pepegochi_owners where user_id = any($1)', [[uid(guest), uid(mail)]])).n, 0);
    });

    await t.test('A3 browser RPCs take no user id, stat, time, count or stamp argument', async () => {
      const rows = (await db.query(`select p.proname, pg_get_function_identity_arguments(p.oid) a from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'gry_pepegochi%' order by 1`)).rows;
      assert.deepEqual(rows.map(r => [r.proname, r.a]), [
        ['gry_pepegochi_action', 'p_action text'], ['gry_pepegochi_adopt', 'p_name text'],
        ['gry_pepegochi_letter_read', ''], ['gry_pepegochi_state', '']]);
    });

    await t.test('A4 one player never reads or changes another player\'s frog', async () => {
      const a = await player(); const b = await player();
      await ok(b, "gry_pepegochi_adopt('Bobs Frog')");
      const before = await rowText(b);
      await ok(a, "gry_pepegochi_adopt('Alice Frog')");
      await careAt(a, 1);
      await ok(a, 'gry_pepegochi_state()', at(200));
      await ok(a, 'gry_pepegochi_letter_read()', at(200));
      await ok(a, "gry_pepegochi_adopt('Alice Two')", at(201));
      assert.equal(await rowText(b), before);
      const s = await ok(a, 'gry_pepegochi_state()', at(202));
      assert.ok(!JSON.stringify(s).includes('Bobs Frog'));
      assert.equal(s.history.length, 1);
    });

    await t.test('A5 an account whose Discord was unlinked is refused everywhere; the frog waits, unchanged', async () => {
      const p = await player();
      await ok(p, "gry_pepegochi_adopt('Fren')");
      await careAt(p, 1);
      await db.query('update auth.identities set provider = $2 where user_id = $1', [uid(p), 'email']);
      const before = await rowText(p);
      for (const f of RPCS) {
        const r = await rpc(p, f, at(10));
        assert.equal(r.ok, false, f); assert.match(r.error, /Discord sign-in required/);
      }
      assert.equal(await rowText(p), before);
      await db.query('update auth.identities set provider = $2 where user_id = $1', [uid(p), 'discord']);
      assert.equal((await ok(p, 'gry_pepegochi_state()', at(12))).pet.name, 'Fren');
      // relinked after more than a week: the clock kept running, so the frog has moved out
      assert.equal((await ok(p, 'gry_pepegochi_state()', at(1 + 200))).pet.status, 'departed');
    });

    // ---------- B: grants and function hygiene ----------
    await t.test('B1 no table privilege for browser roles', async () => {
      for (const role of ['anon', 'authenticated']) for (const tbl of ['pepegochi_owners', 'pepegochi_lives', 'pepegochi_milestones'])
        for (const priv of ['SELECT', 'INSERT', 'UPDATE', 'DELETE'])
          assert.equal((await one('select has_table_privilege($1, $2, $3) v', [role, 'games.' + tbl, priv])).v, false, role + ' ' + priv + ' ' + tbl);
    });

    await t.test('B2 internal functions are not callable by browser roles; the four RPCs only by authenticated', async () => {
      const rows = (await db.query(`select p.oid::regprocedure::text f, n.nspname s from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where p.proname like 'pepegochi%' or p.proname like 'gry_pepegochi%'`)).rows;
      assert.ok(rows.length >= 13, 'functions found: ' + rows.length);
      for (const { f, s } of rows) {
        assert.equal((await one('select has_function_privilege($1, $2, $3) v', ['anon', f, 'EXECUTE'])).v, false, 'anon ' + f);
        assert.equal((await one('select has_function_privilege($1, $2, $3) v', ['authenticated', f, 'EXECUTE'])).v, s === 'public', 'authenticated ' + f);
      }
    });

    await t.test('B3 browser RPCs are security definer with an empty search_path', async () => {
      const rows = (await db.query(`select p.proname, p.prosecdef, p.proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname like 'gry_pepegochi%'`)).rows;
      assert.equal(rows.length, 4);
      for (const r of rows) { assert.equal(r.prosecdef, true, r.proname); assert.deepEqual(r.proconfig, ['search_path=""'], r.proname); }
      const internal = (await db.query(`select p.proname, p.proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'games' and p.proname like 'pepegochi%'`)).rows;
      for (const r of internal) assert.deepEqual(r.proconfig, ['search_path=""'], r.proname);
    });

    await t.test('B4 state is read-only, also when the frog is due to move out', async () => {
      const p = await player();
      await ok(p, "gry_pepegochi_adopt('Fren')");
      for (const h of [1, 300]) {
        await raw.query('begin read only');
        await raw.query('set local role authenticated');
        await raw.query("select set_config('request.jwt.claim.sub', $1, true), set_config('pepegochi.sim_now', $2, true)", [uid(p), at(h).toISOString()]);
        const s = (await raw.query('select public.gry_pepegochi_state() v')).rows[0].v;
        await raw.query('rollback');
        assert.equal(s.pet.status, h === 1 ? 'healthy' : 'departed');
      }
      assert.equal((await life(p, 1)).status, 'active', 'reading never writes the move-out');
    });

    await t.test('B5 names and actions are validated before anything is written', async () => {
      const p = await player();
      for (const name of [null, '', 'a', ' a ', 'x'.repeat(19), 'Fren\u200b', 'Fren\u202e', 'Fren\n', '<b>x</b>', 'x'.repeat(10240), "Fren'; drop table x;--"]) {
        const r = await callRpc(db, { user: p, now: at() }, 'public.gry_pepegochi_adopt($1)', [name]);
        assert.equal(r.ok, false, JSON.stringify(name)); assert.equal(r.code, '22023');
      }
      assert.equal((await one('select count(*)::int n from games.pepegochi_owners where user_id = $1', [uid(p)])).n, 0);
      const s = await ok(p, "gry_pepegochi_adopt('  Mr. Frog_2-B  ')");
      assert.equal(s.pet.name, 'Mr. Frog_2-B');
      for (const a of [null, '', 'FEED', 'feed ', 'cheat', 'feed; select 1', 'x'.repeat(5000)]) {
        const r = await callRpc(db, { user: p, now: at(1) }, 'public.gry_pepegochi_action($1)', [a]);
        assert.equal(r.ok, false); assert.equal(r.code, '22023', String(a).slice(0, 20));
      }
    });

    // ---------- C: concurrency and repeats ----------
    await t.test('C1 twelve adoptions at once make one owner and one frog', async () => {
      const p = await player();
      const res = await parallel(12, p, "gry_pepegochi_adopt('Fren')", at());
      assert.ok(res.every(r => r.ok), res.find(r => !r.ok)?.error);
      assert.equal(res.filter(r => r.value.adopt_result === 'adopted').length, 1);
      assert.equal((await one('select count(*)::int n from games.pepegochi_lives where user_id = $1', [uid(p)])).n, 1);
    });

    await t.test('C2 twelve feeds at once: one accepted, one care day', async () => {
      const p = await player();
      await ok(p, "gry_pepegochi_adopt('Fren')");
      const res = await parallel(12, p, "gry_pepegochi_action('feed')", at(1));
      assert.equal(res.filter(r => r.ok).length, 1);
      const l = await life(p, 1);
      assert.equal(l.actions_today, 1); assert.equal(l.care_days, 1); assert.equal(l.feeds, 1);
    });

    await t.test('C3 twelve letter reads at once after the frog left: written once', async () => {
      const p = await player();
      await ok(p, "gry_pepegochi_adopt('Fren')");
      const res = await parallel(12, p, 'gry_pepegochi_letter_read()', at(200));
      assert.ok(res.every(r => r.ok));
      const l = await life(p, 1);
      assert.equal(l.status, 'departed');
      assert.equal(+l.departed_at, +at(168));
      assert.equal(+l.letter_seen_at, +at(200));
      assert.ok(res.every(r => r.value.can_adopt === true));
    });

    await t.test('C4 letter and adoption from two tabs at once make at most one new frog', async () => {
      const p = await player();
      await ok(p, "gry_pepegochi_adopt('Fren')");
      const cs = await Promise.all(Array.from({ length: 8 }, connect));
      const res = await Promise.all(cs.map((c, i) => callRpc(asDb(c), { user: p, now: at(200) },
        i % 2 ? 'public.gry_pepegochi_letter_read()' : "public.gry_pepegochi_adopt('Fren II')")));
      await Promise.all(cs.map(c => c.end())); clients.splice(clients.length - 8, 8);
      assert.ok(res.every(r => r.ok));
      const n = (await one('select count(*)::int n from games.pepegochi_lives where user_id = $1', [uid(p)])).n;
      assert.ok(n <= 2, 'lives: ' + n);
      assert.equal((await one("select count(*)::int n from games.pepegochi_lives where user_id = $1 and status = 'active'", [uid(p)])).n, n - 1);
    });

    await t.test('C5 an action after the deadline, racing a read, never brings the frog back', async () => {
      const p = await player();
      await ok(p, "gry_pepegochi_adopt('Fren')");
      const cs = await Promise.all(Array.from({ length: 6 }, connect));
      const res = await Promise.all(cs.map((c, i) => callRpc(asDb(c), { user: p, now: at(168 + 1 / 3600) },
        i % 2 ? 'public.gry_pepegochi_state()' : "public.gry_pepegochi_action('feed')")));
      await Promise.all(cs.map(c => c.end())); clients.splice(clients.length - 6, 6);
      assert.ok(res.every(r => r.ok && r.value.pet.status === 'departed'));
      assert.ok(res.filter((r, i) => i % 2 === 0).every(r => r.value.action_result === 'moved_out'));
      const l = await life(p, 1);
      assert.equal(l.status, 'departed'); assert.equal(l.feeds, 0); assert.equal(l.care_days, 0);
    });

    await t.test('C6 retried letter reads and adoptions give the same result', async () => {
      const p = await player();
      await ok(p, "gry_pepegochi_adopt('Fren')");
      const a = await ok(p, 'gry_pepegochi_letter_read()', at(170));
      const b = await ok(p, 'gry_pepegochi_letter_read()', at(171));
      assert.equal(a.pet.departed_at, b.pet.departed_at);
      assert.equal(+(await life(p, 1)).letter_seen_at, +at(170));
      const x = await ok(p, "gry_pepegochi_adopt('Fren II')", at(172));
      const y = await ok(p, "gry_pepegochi_adopt('Fren II')", at(172.01));
      assert.equal(x.adopt_result, 'adopted'); assert.equal(y.adopt_result, 'already_have_fren');
      assert.equal(x.pet.life_id, y.pet.life_id);
    });

    // ---------- D: time ----------
    await t.test('D1 needs keep their fractions between actions (v1 regression)', async () => {
      const p = await player();
      await ok(p, "gry_pepegochi_adopt('Fren')");
      await ok(p, "gry_pepegochi_action('clean')", at(2));
      const e2 = Number((await life(p, 1)).energy);
      assert.ok(e2 > 74.1 && e2 < 75, String(e2));
      await ok(p, "gry_pepegochi_action('feed')", at(4));
      const e4 = Number((await life(p, 1)).energy);
      assert.ok(e4 > 73.1 && e4 < 73.5, String(e4));
      assert.equal((await ok(p, 'gry_pepegochi_state()', at(28))).pet.needs.energy, 63);
      // hygiene: 100 after the clean at 2 h, 98.75 saved at 4 h, then 72 h at 15 per day
      assert.equal((await ok(p, 'gry_pepegochi_state()', at(4 + 72))).pet.needs.hygiene, Math.floor(98.75 - 72 * 15 / 24));
    });

    await t.test('D2 one care day per UTC day, a new one right after midnight', async () => {
      const p = await player();
      const midnight = new Date('2026-11-10T00:00:00Z');
      await ok(p, "gry_pepegochi_adopt('Fren')", new Date(+midnight - 2 * H));
      await ok(p, "gry_pepegochi_action('feed')", new Date(+midnight - 2000));
      await ok(p, "gry_pepegochi_action('clean')", new Date(+midnight + 1000));
      await ok(p, "gry_pepegochi_action('play')", new Date(+midnight + 5000));
      const l = await one('select care_days, last_care_day_utc::text d from games.pepegochi_lives where user_id = $1', [uid(p)]);
      assert.equal(l.care_days, 2);
      assert.equal(l.d, '2026-11-10');
    });

    await t.test('D3 status boundaries of a frog left alone after its first visit', async () => {
      const p = await player();
      await ok(p, "gry_pepegochi_adopt('Fren')");
      await careAt(p, 0);
      const s0 = await ok(p, 'gry_pepegochi_state()', at(0.01));
      const since = new Date(s0.pet.most_neglected_since);
      const h = x => new Date(+since + x * H);
      const status = async x => (await ok(p, 'gry_pepegochi_state()', h(x))).pet.status;
      assert.equal(await status(47.99), 'healthy');
      assert.equal(await status(48.01), 'neglected');
      assert.equal(await status(119.99), 'neglected');
      assert.equal(await status(120.01), 'packing');
      assert.equal(await status(167.99), 'packing');
      assert.equal(await status(168.01), 'departed');
      assert.equal(+new Date(s0.pet.departs_at), +h(168));
      // a visit just before the deadline still rescues the frog
      const late = new Sim(db, { user: p, start: h(167.99) });
      await late.care();
      assert.equal(late.last.pet.status, 'recovering');
      assert.equal((await life(p, 1)).status, 'active');
    });

    await t.test('D4 the move-out time does not depend on when it is written', async () => {
      const a = await player(); const b = await player();
      for (const u of [a, b]) { await ok(u, "gry_pepegochi_adopt('Fren')"); await careAt(u, 0); }
      await ok(a, 'gry_pepegochi_letter_read()', at(8 * 24));
      await ok(b, 'gry_pepegochi_letter_read()', at(60 * 24));
      const la = await life(a, 1), lb = await life(b, 1);
      assert.equal(+la.departed_at, +lb.departed_at);
      assert.equal(la.departure_reason, lb.departure_reason);
    });

    await t.test('D5 the session time zone changes nothing', async () => {
      const results = [];
      for (const tz of ['UTC', 'Pacific/Kiritimati', 'America/Adak']) {
        const p = await player();
        const steps = [['adopt', new Date('2026-11-09T23:59:00Z')], ['feed', new Date('2026-11-09T23:59:30Z')],
          ['clean', new Date('2026-11-10T00:00:30Z')], ['play', new Date('2026-11-10T10:00:00Z')]];
        let s;
        for (const [k, now] of steps) {
          const r = await callRpc(db, { user: p, now, tz }, k === 'adopt' ? "public.gry_pepegochi_adopt('Fren')" : `public.gry_pepegochi_action('${k}')`);
          assert.ok(r.ok, r.error); s = r.value;
        }
        results.push([s.pet.care_days, s.pet.last_care_day_utc, +new Date(s.pet.departs_at), s.pet.action_budget.accepted_today]);
      }
      assert.deepEqual(results[1], results[0]); assert.deepEqual(results[2], results[0]);
      assert.equal(results[0][0], 2);
    });

    await t.test('D6 every rejection writes nothing', async () => {
      const p = await player();
      await ok(p, "gry_pepegochi_adopt('Fren')");
      await ok(p, "gry_pepegochi_action('feed')", at(1));
      const before = await rowText(p);
      const tries = [["gry_pepegochi_action('clean')", at(1 + 1 / 3600)],   // 1 s gap
        ["gry_pepegochi_action('feed')", at(1.2)],                           // cooldown
        ["gry_pepegochi_action('feed')", at(2)],                             // hunger is 100: not needed
        ["gry_pepegochi_action('cheat')", at(2)]];
      for (const [f, now] of tries) { const r = await rpc(p, f, now); assert.equal(r.ok, false, f); }
      assert.equal(await rowText(p), before);
    });

    // ---------- E: life, letter, history ----------
    await t.test('E1 moving out leaves stamps, items, secrets and the avatar exactly as they were', async () => {
      const p = await player();
      await db.query("insert into games.passport_badges(user_id, badge_id) values ($1, 'first_fren'), ($1, 'moonwalker')", [uid(p)]);
      await db.query("insert into games.passport_items(user_id, item_id) values ($1, 'frog_tv')", [uid(p)]);
      await db.query("insert into games.passport_secrets(user_id, secret_id) values ($1, 'lost_floppy')", [uid(p)]);
      await db.query(`insert into games.passport_avatars(user_id, bg, clothing, mouth, eyes, hat, accessory)
        values ($1, 'bg_pond', 'clothing_none', 'mouth_smile', 'eyes_happy', 'hat_none', 'accessory_none')`, [uid(p)]);
      const snap = async () => (await db.query(`select (select string_agg(b::text, '|' order by b::text) from games.passport_badges b where b.user_id = $1)
        || (select string_agg(i::text, '|') from games.passport_items i where i.user_id = $1)
        || (select string_agg(s::text, '|') from games.passport_secrets s where s.user_id = $1)
        || (select string_agg(a::text, '|') from games.passport_avatars a where a.user_id = $1) v`, [uid(p)])).rows[0].v;
      const before = await snap();
      await ok(p, "gry_pepegochi_adopt('Fren')");
      await ok(p, 'gry_pepegochi_letter_read()', at(200));
      await ok(p, "gry_pepegochi_adopt('Fren II')", at(201));
      assert.equal(await snap(), before);
    });

    await t.test('E2 a frog that moved out stays gone; a new one is a new life', async () => {
      const p = await player();
      const first = await ok(p, "gry_pepegochi_adopt('Fren')");
      await ok(p, 'gry_pepegochi_letter_read()', at(200));
      const gone = await life(p, 1);
      for (const k of KINDS) {
        const r = await ok(p, `gry_pepegochi_action('${k}')`, at(201));
        assert.equal(r.action_result, 'moved_out');
      }
      const second = await ok(p, "gry_pepegochi_adopt('Fren II')", at(202));
      assert.notEqual(second.pet.life_id, first.pet.life_id);
      assert.equal(second.pet.generation, 2);
      await careAt(p, 203);
      assert.deepEqual(await life(p, 1), gone);
    });

    await t.test('E3 adopting with a frog at home keeps it; after a move-out the letter comes first', async () => {
      const p = await player();
      await ok(p, "gry_pepegochi_adopt('Fren')");
      const again = await ok(p, "gry_pepegochi_adopt('Other')", at(1));
      assert.equal(again.adopt_result, 'already_have_fren'); assert.equal(again.pet.name, 'Fren');
      const due = await ok(p, "gry_pepegochi_adopt('Other')", at(200));
      assert.equal(due.adopt_result, 'read_the_letter_first');
      assert.equal(due.can_adopt, false);
      assert.equal((await life(p, 1)).status, 'departed', 'the move-out itself is written');
      assert.equal((await one('select count(*)::int n from games.pepegochi_lives where user_id = $1', [uid(p)])).n, 1);
      const letter = await ok(p, 'gry_pepegochi_letter_read()', at(201));
      assert.equal(letter.can_adopt, true); assert.equal(letter.pet.letter.seen, true);
      assert.equal((await ok(p, "gry_pepegochi_adopt('Other')", at(202))).adopt_result, 'adopted');
    });

    await t.test('E4 history lists the 10 newest former frens with real numbers', async () => {
      const p = await player();
      let h = 0;
      for (let g = 1; g <= 12; g++) {
        await ok(p, `gry_pepegochi_adopt('Fren ${g}')`, at(h));
        await careAt(p, h + 1);
        h += 200;
        await ok(p, 'gry_pepegochi_letter_read()', at(h));
      }
      const s = await ok(p, "gry_pepegochi_adopt('Fren 13')", at(h + 1));
      assert.equal(s.history.length, 10);
      assert.deepEqual(s.history.map(x => x.generation), [12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
      assert.ok(s.history.every(x => x.care_days === 1 && x.days_together === 7 && x.departure_reason));
      assert.equal(s.summary.former_frens, 12); assert.equal(s.summary.frens_adopted, 13);
      assert.equal(s.summary.longest_friendship_days, 7);
    });

    await t.test('E5 a second move-out counts as two; the first one keeps its date', async () => {
      const p = await player();
      await ok(p, "gry_pepegochi_adopt('Fren')");
      const one1 = await ok(p, 'gry_pepegochi_letter_read()', at(170));
      await ok(p, "gry_pepegochi_adopt('Fren II')", at(171));
      const two = await ok(p, 'gry_pepegochi_letter_read()', at(400));
      assert.equal(two.summary.former_frens, 2);
      assert.equal(two.summary.first_departed_at, one1.summary.first_departed_at);
    });

    // ---------- F: what counts as care ----------
    await t.test('F1 an action the frog does not need is refused and moves no clock', async () => {
      const p = await player();
      await ok(p, "gry_pepegochi_adopt('Fren')");
      await ok(p, "gry_pepegochi_action('feed')", at(1));
      const before = await life(p, 1);
      const r = await rpc(p, "gry_pepegochi_action('feed')", at(2));
      assert.match(r.error, /does not need that/);
      assert.deepEqual(await life(p, 1), before);
    });

    await t.test('F5 cooldowns and 12 accepted actions per UTC day still apply (v1 rules)', async () => {
      const p = await player();
      await ok(p, "gry_pepegochi_adopt('Fren')", at(-18));      // Monday 00:00 UTC
      await setRules(db, base, { meaningful_below: 101 });     // allow repeated actions for this check
      try {
        let accepted = 0;
        for (let i = 0; i < 16; i++) {                            // all on the same UTC day
          const r = await rpc(p, `gry_pepegochi_action('${KINDS[i % 4]}')`, at(-17 + i * 1.01));
          if (r.ok) accepted++;
          else assert.match(r.error, /limit reached|cooling down/);
        }
        assert.equal(accepted, 12);
        const cd = await rpc(p, "gry_pepegochi_action('rest')", at(30));
        assert.ok(cd.ok, 'a new UTC day resets the count');
      } finally { await setRules(db, base); }
    });

    // ---------- R: rescue and recovery (the scenarios of scripts/pepegochi_sim.mjs) ----------
    const scenario = async (name, overrides = {}) => {
      const p = await player();
      if (Object.keys(overrides).length) await setRules(db, base, overrides);
      try {
        const s = new Sim(db, { user: p });
        await SCENARIOS[name].run(s);
        const st = s.last;
        const left = [...st.history].reverse().map(h => [s.day(h.departed_at), h.departure_reason]);
        if (st.pet?.status === 'departed') left.push([s.day(st.pet.departed_at), st.pet.departure_reason]);
        return { s, st, left, seen: new Set(s.events.map(e => e.status)) };
      } finally { if (Object.keys(overrides).length) await setRules(db, base); }
    };

    await t.test('R1 one feed every 6 days: the frog moves out on day 7', async () => {
      const { left } = await scenario('feed-every-6-days');
      assert.deepEqual(left.map(x => x[0]), [7]);
      assert.ok(['clean', 'play', 'rest'].includes(left[0][1]));
    });

    await t.test('R2 feeding every day but nothing else: moves out on day 7', async () => {
      const { left } = await scenario('feed-only-daily');
      assert.deepEqual(left.map(x => x[0]), [7]);
    });

    await t.test('R3 a full visit every 6 days: rescue starts recovery, which is then missed (day 9)', async () => {
      const { left, seen } = await scenario('checkup-every-6-days');
      assert.deepEqual(left, [[9, 'recovery']]);
      assert.ok(seen.has('recovering'));
    });

    await t.test('R4 a visit every 4 days keeps the frog (neglected, never packing)', async () => {
      const { st, left, seen } = await scenario('every-4-days');
      assert.deepEqual(left, []); assert.equal(st.pet.status, 'healthy');
      assert.ok(seen.has('neglected')); assert.ok(!seen.has('packing'));
    });

    await t.test('R5 Friday-to-Sunday visits keep the frog: packing and recovery every week', async () => {
      const { left, seen } = await scenario('weekend-fri-sun');
      assert.deepEqual(left, []);
      assert.ok(seen.has('packing') && seen.has('recovering'));
    });

    await t.test('R6 Saturday+Sunday only: stays with 1 recovery day (owner decision), would move out with 2', async () => {
      const one1 = await scenario('weekend-sat-sun');
      assert.deepEqual(one1.left, []);
      assert.ok(one1.seen.has('recovering'), 'the weekend frog still goes through rescue and recovery');
      const two = await scenario('weekend-sat-sun', { recovery_days: 2 });
      assert.equal(two.left.length, 1); assert.equal(two.left[0][1], 'recovery');
    });

    // ---------- W: weekend players (owner decision 2026-11-07: they can keep their frog) ----------
    await t.test('W1 weekends at different hours keep the frog: morning/evening, evening/morning, random', async () => {
      for (const name of ['weekend-morning-evening', 'weekend-evening-morning', 'weekend-random-hours']) {
        const { st, left, seen } = await scenario(name);
        assert.deepEqual(left, [], name);
        assert.equal(st.pet.status, 'healthy', name);
        assert.ok(seen.has('recovering'), name + ': the rescue still happens every week');
      }
      // one late session split by UTC midnight is one visit (8 h rule): that pattern loses the frog
      const split = await scenario('weekend-across-midnight');
      assert.equal(split.left.length, 1);
      assert.equal(split.left[0][1], 'recovery');
    });

    await t.test('W2 weekends with feeding only: moves out on day 7', async () => {
      const { left } = await scenario('weekend-feed-only');
      assert.deepEqual(left.map(x => x[0]), [7]);
    });

    await t.test('W3 a missed Saturday: rescued on Sunday, then 72 h to come back', async () => {
      const gone = await scenario('weekend-missed-saturday');
      assert.deepEqual(gone.left, [[22, 'recovery']], 'no weekday visit: moves out on Wednesday');
      const monday = await scenario('weekend-missed-saturday-monday');
      assert.deepEqual(monday.left, [], 'a Monday visit finishes the recovery');
      const late = await scenario('weekend-missed-saturday-late');
      assert.deepEqual(late.left.map(x => x[0]), [20], 'Sunday after more than 7 days: already moved out');
      assert.notEqual(late.left[0][1], 'recovery');
    });

    await t.test('W4 a check-up across UTC midnight: two care days; the follow-up must be on a later UTC day', async () => {
      const p = await player();
      await ok(p, "gry_pepegochi_adopt('Fren')");             // Monday 18:00, never cared for since
      const sat = new Date('2026-11-14T23:59:52Z');         // 126 hours later: packing
      assert.equal((await ok(p, 'gry_pepegochi_state()', sat)).pet.status, 'packing');
      await ok(p, "gry_pepegochi_action('feed')", sat);
      await ok(p, "gry_pepegochi_action('clean')", new Date(+sat + 3000));
      await ok(p, "gry_pepegochi_action('play')", new Date(+sat + 6000));    // 23:59:58
      const done = await ok(p, "gry_pepegochi_action('rest')", new Date(+sat + 9000)); // 00:00:01 Sunday
      assert.equal(done.pet.status, 'recovering');
      assert.equal(done.pet.care_days, 2, 'Saturday and Sunday are two care days');
      assert.equal(done.pet.recovery.last_day_utc, '2026-11-15', 'the check-up finished on Sunday');
      assert.equal(+new Date(done.pet.recovery.counts_from), +new Date('2026-11-16T00:00:00Z'));
      // more care on Sunday does not finish the recovery; Monday does
      const sunday = await careAt(p, (+new Date('2026-11-15T20:00:00Z') - +at()) / H);
      assert.equal(sunday.pet.status, 'recovering');
      const monday = await careAt(p, (+new Date('2026-11-16T00:05:00Z') - +at()) / H);
      assert.equal(monday.pet.status, 'healthy');
    });

    await t.test('W5 recovery needs a later UTC day and 8 h after the rescue; an earlier visit still helps but does not count', async () => {
      const p = await player();
      await ok(p, "gry_pepegochi_adopt('Fren')");             // Monday 18:00, then nothing: packing by Saturday
      const s = new Sim(db, { user: p, start: new Date('2026-11-14T23:30:00Z') });
      await s.care();
      assert.equal(s.last.pet.status, 'recovering');
      const rescuedAt = +new Date(s.last.server_now);
      const countsFrom = +new Date(s.last.pet.recovery.counts_from);
      assert.equal(countsFrom, rescuedAt + 8 * H, 'the earliest finish is shown: 8 h after the rescue (later than midnight)');
      // 00:30: a later UTC day, but too soon. The care is accepted and helps; recovery is not finished.
      const before = s.last.pet.needs.hunger;
      s.now = new Date('2026-11-15T00:30:00Z');
      await s.care();
      assert.equal(s.last.action_result, 'accepted');
      assert.ok(s.last.pet.needs.hunger > before, 'needs improved by the early visit');
      assert.equal(s.last.pet.status, 'recovering');
      assert.equal(s.last.pet.recovery.days_left, 1);
      assert.equal(+new Date(s.last.pet.recovery.counts_from), countsFrom, 'an early visit does not move the finish');
      // 1 ms before the finish: still recovering; at the finish: healthy
      const early = await callRpc(db, { user: p, now: new Date(countsFrom - 1) }, "public.gry_pepegochi_action('feed')");
      assert.ok(early.ok, early.error);
      assert.equal(early.value.pet.status, 'recovering');
      const done = await callRpc(db, { user: p, now: new Date(countsFrom + 3000) }, "public.gry_pepegochi_action('play')");
      assert.ok(done.ok, done.error);
      assert.equal(done.value.pet.status, 'healthy');
      // with the gap switched off (playtest value 0), 00:30 would have counted
      await setRules(db, base, { recovery_min_gap_h: 0 });
      try {
        const q = await player();
        await ok(q, "gry_pepegochi_adopt('Fren')");
        const s0 = new Sim(db, { user: q, start: new Date('2026-11-14T23:30:00Z') });
        await s0.care();
        s0.now = new Date('2026-11-15T00:30:00Z');
        await s0.care();
        assert.equal(s0.last.pet.status, 'healthy');
      } finally { await setRules(db, base); }
      const normal = await scenario('weekend-evening-morning');
      assert.deepEqual(normal.left, [], 'Saturday 21:00 / Sunday 08:00 (11 h) still keeps the frog');
    });

    await t.test('R7 rescue: half a visit does not stop the deadline, a full one starts recovery, the next day ends it', async () => {
      const p = await player();
      await ok(p, "gry_pepegochi_adopt('Fren')");
      await careAt(p, 0);
      const packing = await ok(p, 'gry_pepegochi_state()', at(130));
      assert.equal(packing.pet.status, 'packing'); assert.equal(packing.pet.rescue_starts_recovery, true);
      const deadline = packing.pet.departs_at;
      const fed = await ok(p, "gry_pepegochi_action('feed')", at(130));
      assert.equal(fed.pet.recovery, null);
      // status follows the most neglected need that is left (waiting about 117 h), and the rescue is still owed
      assert.equal(fed.pet.status, 'neglected');
      assert.equal(fed.pet.rescue_starts_recovery, true);
      // the deadline only moves to the next overdue need, it does not start a new week
      assert.ok(+new Date(fed.pet.departs_at) >= +new Date(deadline));
      assert.ok(+new Date(fed.pet.departs_at) < +at(130 + 72), fed.pet.departs_at);
      assert.deepEqual(fed.pet.overdue, ['clean', 'play', 'rest']);
      const s = new Sim(db, { user: p, start: at(130.01) });
      await s.care();
      assert.equal(s.last.pet.status, 'recovering'); assert.equal(s.last.pet.recovery.days_left, 1);
      // while recovering: 72 h from the last care
      assert.equal(+new Date(s.last.pet.departs_at), +new Date(s.last.server_now) + 72 * H);
      // same UTC day: no progress
      await careAt(p, 131);
      assert.equal((await ok(p, 'gry_pepegochi_state()', at(131.1))).pet.recovery.days_left, 1);
      const d1 = await careAt(p, 130 + 24);
      assert.equal(d1.pet.status, 'healthy'); assert.equal(d1.pet.recovery, null);
      // two recovery days, if a playtest wants them
      const q = await player();
      await setRules(db, base, { recovery_days: 2 });
      try {
        await ok(q, "gry_pepegochi_adopt('Fren')");
        await careAt(q, 0);
        assert.equal((await careAt(q, 130)).pet.recovery.days_left, 2);
        assert.equal((await careAt(q, 154)).pet.recovery.days_left, 1);
        assert.equal((await careAt(q, 178)).pet.status, 'healthy');
      } finally { await setRules(db, base); }
    });

    await t.test('R8 while recovering, 72 hours without care is enough to move out', async () => {
      const { left } = await scenario('rescue-then-vanish');
      assert.deepEqual(left, [[13, 'recovery']]);
    });

    await t.test('R9 daily visits: always healthy, one care day per day', async () => {
      const { st, left, seen } = await scenario('daily');
      assert.deepEqual(left, []); assert.deepEqual([...seen], ['healthy']);
      assert.equal(st.pet.care_days, 61); assert.equal(st.pet.stage, 'adult');
    });

    await t.test('R10 an 8-day trip: moved out, letter, new egg, history', async () => {
      const { st, left } = await scenario('trip-8-days');
      assert.equal(left.length, 1);
      assert.equal(st.pet.name, 'Fren II'); assert.equal(st.history[0].name, 'Fren');
      assert.equal(st.history[0].care_days, 10);
    });

    // ---------- M: milestones survive a broken Passport ----------
    await t.test('M1 first adoption, froglet and adult are recorded once per account', async () => {
      const p = await player();
      await ok(p, "gry_pepegochi_adopt('Fren')");
      for (let d = 0; d < 8; d++) await careAt(p, d * 24);
      await ok(p, 'gry_pepegochi_letter_read()', at(8 * 24 + 200));
      await ok(p, "gry_pepegochi_adopt('Fren II')", at(8 * 24 + 201));
      for (let d = 0; d < 8; d++) await careAt(p, 8 * 24 + 202 + d * 24);
      const rows = (await db.query('select milestone, life_id from games.pepegochi_milestones where user_id = $1 order by reached_at', [uid(p)])).rows;
      assert.deepEqual(rows.map(r => r.milestone), ['first_adoption', 'froglet', 'adult']);
      assert.equal(new Set(rows.map(r => r.life_id)).size, 1, 'all from the first life');
    });

    await t.test('M2-M4 a failing Passport hook keeps the care; the milestone waits and is delivered later', async () => {
      const p = await player();
      await db.exec(`create table if not exists games.test_hook_calls(user_id uuid, at timestamptz default clock_timestamp());
        create or replace function games.pepegochi_passport_sync(u uuid) returns void language plpgsql volatile set search_path = '' as $$
        begin
          insert into games.test_hook_calls(user_id) values (u);
          raise exception 'stamp storage is broken';
        end $$;`);
      try {
        warnings.length = 0;
        const s = await ok(p, "gry_pepegochi_adopt('Fren')");
        assert.equal(s.adopt_result, 'adopted');
        await careAt(p, 1);
        const c = await careAt(p, 25);
        assert.equal(c.pet.care_days, 2, 'care kept although the hook failed');
        assert.ok(warnings.some(w => /pepegochi passport sync: stamp storage is broken/.test(w)));
        assert.equal((await one('select count(*)::int n from games.test_hook_calls')).n, 0, 'the failed hook\'s own writes were undone');
        const pending = (await db.query('select milestone from games.pepegochi_milestones where user_id = $1 and synced_at is null order by 1', [uid(p)])).rows;
        assert.deepEqual(pending.map(r => r.milestone), ['first_adoption', 'froglet']);
        // M4: running the migration again does not switch off a hook installed later
        await db.exec(await readFile(new URL('../games/supabase/update_pepegochi_v2.sql', import.meta.url), 'utf8'));
        await db.exec((await import('../scripts/pepegochi_sim.mjs')).VIRTUAL_CLOCK);
        assert.match((await one("select prosrc from pg_proc where proname = 'pepegochi_passport_sync'")).prosrc, /stamp storage is broken/);
        // M3: the hook is fixed (as PR C will do): the next accepted action delivers everything pending
        await db.exec(`create or replace function games.pepegochi_passport_sync(u uuid) returns void language plpgsql volatile set search_path = '' as $$
          begin
            insert into games.test_hook_calls(user_id) values (u);
            update games.pepegochi_milestones set synced_at = games.pepegochi_clock() where user_id = u and synced_at is null;
          end $$;`);
        const next = await careAt(p, 49);
        assert.equal(next.action_result, 'accepted');
        assert.equal((await one('select count(*)::int n from games.pepegochi_milestones where user_id = $1 and synced_at is null', [uid(p)])).n, 0);
        const calls = (await one('select count(*)::int n from games.test_hook_calls where user_id = $1', [uid(p)])).n;
        assert.equal(calls, 1);
        await careAt(p, 73);
        assert.equal((await one('select count(*)::int n from games.test_hook_calls where user_id = $1', [uid(p)])).n, calls,
          'nothing pending: the hook is not called');
      } finally {
        await db.exec(`create or replace function games.pepegochi_passport_sync(u uuid) returns void language plpgsql volatile set search_path = '' as $$
          begin return; end $$;`);
      }
    });

    // ---------- G: good care days and the Good Parent foundation (PR A2) ----------
    const goodOf = async name => {
      const { s, st, left } = await scenario(name);
      const reached = s.events.find(e => e.good != null && e.goal != null && e.good >= e.goal);
      return { good: st.pet?.good_days ?? 0, goalDay: reached ? reached.day : null, left, st, s };
    };

    await t.test('G1 the rule: 2 different kinds, every need >= 50 after the action, at most one per UTC day', async () => {
      const p = await player();
      await ok(p, "gry_pepegochi_adopt('Fren')");                    // needs 75/80/80/75
      const feed = await ok(p, "gry_pepegochi_action('feed')", at(0));
      assert.equal(feed.pet.good_days, 0, 'one kind is not enough');
      assert.deepEqual(feed.pet.good_day, { today: false, kinds_today: 1, needs_low: [] });
      const clean = await ok(p, "gry_pepegochi_action('clean')", at(0.001));
      assert.equal(clean.pet.good_days, 1); assert.equal(clean.pet.good_day.today, true);
      assert.equal(clean.pet.good_streak, 1);
      await ok(p, "gry_pepegochi_action('play')", at(0.002));
      assert.equal((await ok(p, "gry_pepegochi_action('rest')", at(0.003))).pet.good_days, 1, 'one per UTC day');
      // next UTC day: streak 2; a skipped day resets the streak but keeps the best
      const d1 = await careAt(p, 24); assert.equal(d1.pet.good_days, 2); assert.equal(d1.pet.good_streak, 2);
      const d3 = await careAt(p, 72); assert.equal(d3.pet.good_days, 3); assert.equal(d3.pet.good_streak, 1);
      assert.equal(d3.pet.best_good_streak, 2);
      assert.equal((await ok(p, 'gry_pepegochi_state()', at(24 * 5))).pet.good_streak, 0, 'no good day yesterday: current streak 0');
    });

    await t.test('G2 a need below 50 blocks the day; the state says which one', async () => {
      const p = await player();
      await ok(p, "gry_pepegochi_adopt('Fren')");
      const s = await ok(p, 'gry_pepegochi_state()', at(48));       // hunger 75 - 40 = 35, mood 80 - 36 = 44
      assert.deepEqual(s.pet.good_day.needs_low, ['feed', 'play']);
      await ok(p, "gry_pepegochi_action('clean')", at(48));
      const b = await ok(p, "gry_pepegochi_action('rest')", at(48.001));
      assert.equal(b.pet.good_days, 0, '2 kinds, but hunger and mood are still below 50');
      assert.equal(b.pet.good_day.kinds_today, 2);
      const c = await ok(p, "gry_pepegochi_action('feed')", at(48.002));
      assert.equal(c.pet.good_days, 0, 'mood still below 50');
      const d = await ok(p, "gry_pepegochi_action('play')", at(48.003));
      assert.equal(d.pet.good_days, 1, 'every need is 50 or more now');
    });

    await t.test('G3 daily short visits: a good day every day; Good Parent goal on day 29 (the 30th good day)', async () => {
      const { good, goalDay, st } = await goodOf('daily');
      assert.equal(good, 61); assert.equal(goalDay, 29);
      assert.equal(st.pet.best_good_streak, 61);
    });

    await t.test('G4 weekends only, 20 weeks: short visits earn almost nothing at >= 50; an hour or two visits a day earn 2 a week', async () => {
      const quick = await goodOf('weekend-quick-20w');
      assert.deepEqual(quick.left, []); assert.equal(quick.good, 1); assert.equal(quick.goalDay, null);
      for (const name of ['weekend-long-20w', 'weekend-two-visits-20w', 'weekend-random-long-20w']) {
        const r = await goodOf(name);
        assert.deepEqual(r.left, [], name);
        assert.equal(r.good, 41, name);
        assert.ok(r.goalDay >= 102 && r.goalDay <= 103, name + ' goal day ' + r.goalDay);
      }
    });

    await t.test('G5 care split by UTC midnight: still at most one good day per UTC day', async () => {
      const { good, goalDay, s } = await goodOf('daily-midnight-split');
      assert.equal(good, 41, '41 UTC days, 41 good days');
      assert.equal(goalDay, 28);
      const perDay = new Map();
      for (const e of s.events) if (e.good != null) perDay.set(e.at.slice(0, 10), Math.max(perDay.get(e.at.slice(0, 10)) ?? 0, e.good));
      const days = [...perDay.values()];
      for (let i = 1; i < days.length; i++) assert.ok(days[i] - days[i - 1] <= 1, 'never two good days on one UTC day');
    });

    await t.test('G6 rescue and a visit less than 8 h later: the visit helps, no recovery and no free good day', async () => {
      const r = await goodOf('weekend-midnight-then-noon');
      assert.deepEqual(r.left, [], 'the Sunday noon visit finishes the recovery');
      assert.equal(r.good, 21, 'one good day a weekend (Sunday noon), as short visits at >= 50 allow');
      const gone = await goodOf('weekend-across-midnight');
      assert.equal(gone.left[0][1], 'recovery', 'without the noon visit, the frog moves out');
    });

    await t.test('G7 neglect, then better care: good days stop, then come back after 2 days of care', async () => {
      const { s, good, goalDay } = await goodOf('neglect-then-daily');
      const at = d => Math.max(0, ...s.events.filter(e => e.day <= d && e.good != null).map(e => e.good));
      assert.equal(at(13), 14, 'every day while cared for');
      assert.equal(at(19), 14, 'none while away');
      assert.equal(at(20), 14, 'the rescue day is not a good day');
      assert.equal(at(21), 14, 'nor the day after: hunger is still below 50');
      assert.equal(at(22), 15, 'the second day of care is');
      assert.equal(good, 43); assert.equal(goalDay, 37);
    });

    await t.test('G8 sparse care earns no prestige: every 4 days, or a check-up every 6 days', async () => {
      assert.ok((await goodOf('every-4-days')).good <= 1);
      assert.ok((await goodOf('checkup-every-6-days')).good <= 1);
    });

    await t.test('G9 the proposals, on the same scenarios (playtest values only)', async () => {
      const run = async (overrides, name) => {
        await setRules(db, base, overrides);
        try { return await goodOf(name); } finally { await setRules(db, base); }
      };
      assert.equal((await run({ good_day_min_need: 40 }, 'weekend-quick-20w')).good, 21, '>= 40: Sundays count');
      assert.ok((await run({ good_day_min_need: 40 }, 'every-4-days')).good <= 2, '>= 40: sparse care still ~0');
      assert.equal((await run({ good_day_min_need: 30 }, 'weekend-quick-20w')).good, 41);
      assert.equal((await run({ good_day_min_need: 30 }, 'every-4-days')).good, 16, '>= 30: one per visit, even every 4 days');
      assert.equal((await run({ good_day_cared_counts: true }, 'weekend-quick-20w')).good, 41);
      assert.equal((await run({ good_day_cared_counts: true }, 'every-4-days')).good, 16);
    });

    await t.test('G10 Good Parent: one milestone per account, good days stay with their life in the history', async () => {
      const p = await player();
      await setRules(db, base, { good_parent_days: 3 });
      try {
        await ok(p, "gry_pepegochi_adopt('Fren')");
        for (let d = 0; d < 4; d++) await careAt(p, d * 24);
        const rows = async () => (await db.query("select life_id from games.pepegochi_milestones where user_id = $1 and milestone = 'good_parent'", [uid(p)])).rows;
        assert.equal((await rows()).length, 1);
        const first = (await rows())[0].life_id;
        const gone = await ok(p, 'gry_pepegochi_letter_read()', at(4 * 24 + 200));
        assert.equal(gone.pet.good_days, 4); assert.equal(gone.pet.best_good_streak, 4);
        await ok(p, "gry_pepegochi_adopt('Fren II')", at(4 * 24 + 201));
        for (let d = 0; d < 4; d++) await careAt(p, 4 * 24 + 202 + d * 24);
        const after = await ok(p, 'gry_pepegochi_state()', at(4 * 24 + 202 + 4 * 24));
        assert.equal(after.pet.good_days, 4, 'a new life starts from 0 and earns its own');
        assert.equal(after.history[0].good_days, 4);
        assert.equal((await rows()).length, 1, 'still one milestone');
        assert.equal((await rows())[0].life_id, first);
      } finally { await setRules(db, base); }
    });

    // ---------- H: migration ----------
    await t.test('H1 running the migration again changes no data', async () => {
      const before = (await one(`select md5(string_agg(l::text, '|' order by l.life_id)) v from games.pepegochi_lives l`)).v;
      await db.exec(await readFile(new URL('../games/supabase/update_pepegochi_v2.sql', import.meta.url), 'utf8'));
      await db.exec((await import('../scripts/pepegochi_sim.mjs')).VIRTUAL_CLOCK);
      assert.equal((await one(`select md5(string_agg(l::text, '|' order by l.life_id)) v from games.pepegochi_lives l`)).v, before);
    });

    await t.test('H2 the migration refuses to run on top of a v1 table', async () => {
      await db.exec('create table games.pepegochi_pets(user_id uuid primary key)');
      await assert.rejects(db.exec(await readFile(new URL('../games/supabase/update_pepegochi_v2.sql', import.meta.url), 'utf8')), /PepeGochi v1/);
      await db.exec('rollback');   // the file opened a transaction before the guard stopped it
      await db.exec('drop table games.pepegochi_pets');
    });

    await t.test('H4 a test database from A1 (no good-day columns) is upgraded by running the file again', async () => {
      const p = await player();
      await ok(p, "gry_pepegochi_adopt('Fren')");
      await db.exec(`alter table games.pepegochi_lives drop column day_kinds, drop column good_days,
        drop column last_good_day_utc, drop column good_streak, drop column best_good_streak`);
      await db.exec(await readFile(new URL('../games/supabase/update_pepegochi_v2.sql', import.meta.url), 'utf8'));
      await db.exec((await import('../scripts/pepegochi_sim.mjs')).VIRTUAL_CLOCK);
      const s = await careAt(p, 1);
      assert.equal(s.pet.good_days, 1);
    });

    await t.test('H3 deleting an account removes its frogs and milestones', async () => {
      const p = await player();
      await ok(p, "gry_pepegochi_adopt('Fren')");
      await careAt(p, 1);
      await db.query('delete from auth.users where id = $1', [uid(p)]);
      assert.equal(await rowText(p), '');
    });
  } finally {
    for (const c of clients) await c.end().catch(() => {});
    await admin.query('drop database ' + dbName + ' with (force)');
    await admin.end();
  }
});
