// PepeGochi v2: the browser model (docs/games/js/pepegochi-model.mjs) must answer exactly like the real SQL
// (games/supabase/update_pepegochi_v2.sql). Every call is made on both, at the same virtual time, and the
// full responses are compared, then the stored life rows and the milestones.
//
// Needs a throwaway database, either in-memory PGlite or a disposable PostgreSQL:
//   PEPEGOCHI_PGLITE_MODULE=/abs/path/node_modules/@electric-sql/pglite/dist/index.js node --test tests/pepegochi-parity.test.mjs
//   PASSPORT_PG_URL=postgres://... PASSPORT_PG_MODULE=/abs/path/node_modules/pg/lib/index.js node --test tests/pepegochi-parity.test.mjs
// Never point it at Supabase. tests/pepegochi-model.test.mjs checks the model alone in CI.
import test from 'node:test';
import assert from 'node:assert/strict';
import { prepare, setRules, addPlayer, asDb, uid, Sim, SCENARIOS, START, sqlBackend, modelBackend, rng } from '../scripts/pepegochi_sim.mjs';
import { LocalPepegochi, parseTimestampUs, KINDS } from '../docs/games/js/pepegochi-model.mjs';

const PGLITE = process.env.PEPEGOCHI_PGLITE_MODULE;
const PG_URL = process.env.PASSPORT_PG_URL, PG_MOD = process.env.PASSPORT_PG_MODULE;
const H = 36e5, DAY = 24 * H;
const TS = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?([+-]\d\d(:\d\d)?|Z)$/;

// timestamps -> microseconds (the SQL writes them with the session offset), life ids dropped
const norm = v => {
  if (Array.isArray(v)) return v.map(norm);
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v)) if (k !== 'life_id') o[k] = norm(x);
    return o;
  }
  if (typeof v === 'string' && (TS.test(v) || v === 'infinity')) return parseTimestampUs(v);
  return v;
};
const normResult = r => (r.ok ? { ok: true, value: norm(r.value) } : { ok: false, error: r.error, code: r.code });

test('PepeGochi v2: the browser model gives exactly the SQL answers', {
  skip: !(PGLITE || (PG_URL && PG_MOD)) && 'set PEPEGOCHI_PGLITE_MODULE, or PASSPORT_PG_URL and PASSPORT_PG_MODULE',
  timeout: 900000,
}, async t => {
  let db, close;
  if (PGLITE) {
    const { PGlite } = await import(PGLITE);
    const lite = new PGlite();
    db = asDb(lite); close = () => lite.close();
  } else {
    const pg = (await import(PG_MOD)).default;
    const admin = new pg.Client({ connectionString: PG_URL }); await admin.connect();
    const name = 'pepegochi_parity_' + process.pid + '_' + Date.now();
    await admin.query('create database ' + name);
    const url = new URL(PG_URL); url.pathname = '/' + name;
    const c = new pg.Client({ connectionString: url.toString() }); await c.connect();
    db = asDb(c);
    close = async () => { await c.end(); await admin.query('drop database ' + name + ' with (force)'); await admin.end(); };
  }
  const stats = { calls: 0, compared: 0, errors: 0 };
  try {
    const { base } = await prepare(db);
    let next = 1;

    // the stored state of every life, as the SQL keeps it, in the model's units (needs * 10000, times in us)
    const sqlLives = async user => (await db.query(
      `select generation, (hunger * 10000)::bigint::text h, (hygiene * 10000)::bigint::text c, (mood * 10000)::bigint::text m,
              (energy * 10000)::bigint::text e, needs_at::text, hunger_due_at::text hd, hygiene_due_at::text cd,
              mood_due_at::text md, energy_due_at::text ed, care_days, last_care_day_utc::text lcd, rescue_pending,
              recovery_days_left, recovery_day_utc::text rd, recovery_since::text rs, actions_today, feeds, cleans, plays, rests,
              status, departed_at::text, departure_reason, letter_seen_at::text
         from games.pepegochi_lives where user_id = $1 order by generation`, [uid(user)])).rows;
    const ts = s => (s == null ? null : parseTimestampUs(s.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00')));
    const dayNo = s => (s == null ? null : Date.parse(s + 'T00:00:00Z') / DAY);
    const sameLives = (rows, world, label) => {
      assert.equal(world.lives.length, rows.length, label + ': number of lives');
      rows.forEach((x, i) => {
        const l = world.lives[i];
        const want = [x.generation, +x.h, +x.c, +x.m, +x.e, ts(x.needs_at), ts(x.hd), ts(x.cd), ts(x.md), ts(x.ed), x.care_days,
          dayNo(x.lcd), x.rescue_pending, x.recovery_days_left, dayNo(x.rd), ts(x.rs), x.actions_today, x.feeds, x.cleans,
          x.plays, x.rests, x.status, ts(x.departed_at), x.departure_reason, ts(x.letter_seen_at)];
        const got = [l.generation, l.hunger, l.hygiene, l.mood, l.energy, l.needs_at, l.hunger_due_at, l.hygiene_due_at,
          l.mood_due_at, l.energy_due_at, l.care_days, l.last_care_day_utc, l.rescue_pending, l.recovery_days_left,
          l.recovery_day_utc, l.recovery_since, l.actions_today, l.feeds, l.cleans, l.plays, l.rests, l.status,
          l.departed_at, l.departure_reason, l.letter_seen_at];
        assert.deepEqual(got, want, `${label}: stored life ${x.generation}`);
      });
    };
    const sameMilestones = async (user, world, label) => {
      const rows = (await db.query(`select m.milestone, l.generation, m.reached_at::text r from games.pepegochi_milestones m
        join games.pepegochi_lives l on l.life_id = m.life_id where m.user_id = $1 order by m.reached_at, m.milestone`, [uid(user)])).rows;
      const want = rows.map(x => [x.milestone, x.generation, ts(x.r)]);
      const got = world.milestones.map(x => [x.milestone, x.generation, x.reached_at])
        .sort((a, b) => a[2] - b[2] || a[0].localeCompare(b[0]));
      assert.deepEqual(got, want, label + ': milestones');
    };

    // one fresh player on both sides; calls go to SQL first, then the same call to the model
    const pair = async (overrides = {}) => {
      const user = next++;
      await addPlayer(db, user);
      const local = new LocalPepegochi({ start: START, rules: overrides });
      const sql = sqlBackend(db, user), model = modelBackend(local);
      const call = async (name, args, now, label) => {
        const a = await sql.call(name, args, now), b = await model.call(name, args, now);
        stats.calls++; stats.compared++; if (!a.ok) stats.errors++;
        assert.deepEqual(normResult(b), normResult(a), `${label}: ${name} ${JSON.stringify(args || {})} at ${new Date(now).toISOString()}`);
        return a;
      };
      const finish = async label => { sameLives(await sqlLives(user), local.world, label); await sameMilestones(user, local.world, label); };
      return { user, local, call, finish };
    };
    const withRules = async (overrides, fn) => {
      if (Object.keys(overrides).length) await setRules(db, base, overrides);
      try { return await fn(); } finally { if (Object.keys(overrides).length) await setRules(db, base); }
    };

    // ---------- every simulator scenario, with the decided rules and with playtest variants ----------
    const RULESETS = [
      {},
      { recovery_days: 2 },
      { recovery_min_gap_h: 8 },
      { meaningful_below: 95, neglected_h: 30, packing_h: 70, departs_h: 100, rescue_from_h: 60, recovery_departs_h: 40 },
      // decay rates that do not divide a day evenly, so the rounding of "when does a need start waiting" matters
      { 'decay_per_day.hunger': 7, 'decay_per_day.hygiene': 11, 'decay_per_day.mood': 13, 'decay_per_day.energy': 17 },
    ];
    for (const overrides of RULESETS) {
      await t.test('scenarios, rules ' + JSON.stringify(overrides), async () => {
        await withRules(overrides, async () => {
          for (const [name, sc] of Object.entries(SCENARIOS)) {
            const p = await pair(overrides);
            const s = new Sim({ kind: 'both', call: (n, a, now) => p.call(n, a, now, name) }, { user: p.user });
            await sc.run(s);
            await p.finish(name);
          }
        });
      });
    }

    // ---------- every status boundary, to the millisecond ----------
    await t.test('status and departure boundaries (48 / 120 / 168 h, recovery 72 h), 1 ms either side', async () => {
      const p = await pair();
      const t0 = Date.parse(START);
      await p.call('gry_pepegochi_adopt', { p_name: 'Fren' }, t0, 'boundaries');
      let now = t0;
      for (const k of KINDS) { await p.call('gry_pepegochi_action', { p_action: k }, now, 'boundaries'); now += 3000; }
      const s = await p.call('gry_pepegochi_state', {}, now, 'boundaries');
      const since = Date.parse(s.value.pet.most_neglected_since);
      for (const h of [48, 120, 168]) for (const d of [-1, 0, 1])
        await p.call('gry_pepegochi_state', {}, since + h * H + d, `${h} h ${d} ms`);
      // a rescue at 167 h, then the 72 h recovery deadline to the millisecond
      now = since + 167 * H;
      for (const k of KINDS) { await p.call('gry_pepegochi_action', { p_action: k }, now, 'rescue'); now += 3000; }
      const r = await p.call('gry_pepegochi_state', {}, now, 'rescue');
      assert.equal(r.value.pet.status, 'recovering');
      const until = Date.parse(r.value.pet.departs_at);
      for (const d of [-1, 0, 1]) await p.call('gry_pepegochi_state', {}, until + d, `recovery deadline ${d} ms`);
      await p.call('gry_pepegochi_letter_read', {}, until + 1, 'letter');
      await p.finish('boundaries');
    });

    await t.test('each need crosses 90 exactly when the server says: action 1 ms before, at, and after', async () => {
      for (const k of KINDS) for (const d of [-1, 0, 1]) {
        const p = await pair();
        const t0 = Date.parse(START);
        await p.call('gry_pepegochi_adopt', { p_name: 'Fren' }, t0, 'crossing');
        let now = t0;
        for (const x of KINDS) { await p.call('gry_pepegochi_action', { p_action: x }, now, 'crossing'); now += 3000; }
        const s = await p.call('gry_pepegochi_state', {}, now, 'crossing');
        const at = Date.parse(s.value.pet.waiting_since[k]);
        if (at > now) await p.call('gry_pepegochi_action', { p_action: k }, at + d, `${k} ${d} ms from 90`);
        await p.finish('crossing ' + k);
      }
    });

    // ---------- seeded random play: waits, actions, adoption, letters, bad input ----------
    await t.test('300 random seeded games, 50 calls each', async () => {
      const waits = [1000, 2500, 60e3, 10 * 60e3, 31 * 60e3, H, 3 * H, 7 * H, 13 * H, DAY, 2 * DAY, 3 * DAY, 5 * DAY, 7 * DAY, 9 * DAY];
      const names = ['Fren', 'Żabka', 'Mr. Frog_2', 'x', '  Pad  ', 'bad<name>', 'Frog II'];
      for (let g = 0; g < 300; g++) {
        const r = rng(1000 + g);
        const overrides = [{}, {}, { recovery_days: 2 }, { recovery_min_gap_h: 8 }, { meaningful_below: 95 },
          { 'decay_per_day.hunger': 7, 'decay_per_day.hygiene': 11, 'decay_per_day.mood': 13, 'decay_per_day.energy': 17 }][g % 6];
        await withRules(overrides, async () => {
          const p = await pair(overrides);
          let now = Date.parse(START) + Math.floor(r() * DAY);
          for (let i = 0; i < 50; i++) {
            const x = r();
            if (x < 0.08) await p.call('gry_pepegochi_adopt', { p_name: names[Math.floor(r() * names.length)] }, now, 'game ' + g);
            else if (x < 0.14) await p.call('gry_pepegochi_letter_read', {}, now, 'game ' + g);
            else if (x < 0.22) await p.call('gry_pepegochi_state', {}, now, 'game ' + g);
            else if (x < 0.24) await p.call('gry_pepegochi_action', { p_action: 'cheat' }, now, 'game ' + g);
            else await p.call('gry_pepegochi_action', { p_action: KINDS[Math.floor(r() * 4)] }, now, 'game ' + g);
            now += waits[Math.floor(r() * waits.length)] + Math.floor(r() * 1000);
          }
          await p.finish('game ' + g);
        });
      }
    });

    t.diagnostic(`compared ${stats.compared} calls on SQL and on the model (${stats.errors} of them rejections)`);
  } finally {
    await close();
  }
});
