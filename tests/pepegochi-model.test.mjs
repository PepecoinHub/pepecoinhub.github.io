// PepeGochi v2 browser model and test simulator page (PR B1). Runs in CI without a database.
// Exact agreement with the SQL is checked call by call by tests/pepegochi-parity.test.mjs (needs a database).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DEFAULT_RULES, LocalPepegochi, makeRules, parseTimestampUs, isoUs, KINDS } from '../docs/games/js/pepegochi-model.mjs';
import { Sim, SCENARIOS, START, modelBackend } from '../scripts/pepegochi_sim.mjs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const sql = read('games/supabase/update_pepegochi_v2.sql');
const H = 36e5;

// the rules jsonb in games.pepegochi_rules(), read from the SQL text
function sqlRules() {
  const body = sql.slice(sql.indexOf('function games.pepegochi_rules()'));
  const src = body.slice(body.indexOf('$$') + 2, body.indexOf('$$', body.indexOf('$$') + 2)).replace(/--[^\n]*/g, '');
  const out = {};
  const nested = /'([a-z_]+)', jsonb_build_object\(([^)]*)\)/g;
  for (const m of src.matchAll(nested)) {
    out[m[1]] = {};
    for (const x of m[2].matchAll(/'([a-z_]+)', (\d+)/g)) out[m[1]][x[1]] = Number(x[2]);
  }
  const flat = src.replace(nested, '');
  for (const m of flat.matchAll(/'([a-z_]+)', (true|false|\d+(?:\.\d+)?)/g)) out[m[1]] = m[2] === 'true' ? true : m[2] === 'false' ? false : Number(m[2]);
  return out;
}

test('the model uses exactly the rules of the SQL file', () => {
  const r = sqlRules();
  assert.ok(Object.keys(r).length >= 17, 'parsed ' + Object.keys(r).length + ' rules');
  assert.deepEqual(JSON.parse(JSON.stringify(DEFAULT_RULES)), r);
  assert.equal(DEFAULT_RULES.recovery_days, 1, 'owner decision 2026-11-07');
});

const runScenario = async (name, rules = {}) => {
  const local = new LocalPepegochi({ start: START, rules });
  const s = new Sim(modelBackend(local), { user: 1 });
  await SCENARIOS[name].run(s);
  const st = s.last;
  const left = [...st.history].reverse().map(h => [s.day(h.departed_at), h.departure_reason]);
  if (st.pet?.status === 'departed') left.push([s.day(st.pet.departed_at), st.pet.departure_reason]);
  return { st, left, seen: new Set(s.events.map(e => e.status)), local };
};

test('model scenarios: the outcomes documented in games/PEPEGOCHI_API.md', async () => {
  const stays = ['daily', 'every-4-days', 'weekend-fri-sun', 'weekend-sat-sun', 'weekend-morning-evening',
    'weekend-evening-morning', 'weekend-random-hours', 'weekend-missed-saturday-monday', 'trip-6-days'];
  for (const name of stays) assert.deepEqual((await runScenario(name)).left, [], name);
  const leaves = { 'feed-every-6-days': 7, 'feed-only-daily': 7, 'weekend-feed-only': 7, 'checkup-every-6-days': 9,
    'rescue-then-vanish': 13, 'weekend-missed-saturday': 22, 'weekend-missed-saturday-late': 20, 'trip-8-days': 16 };
  for (const [name, day] of Object.entries(leaves)) assert.equal((await runScenario(name)).left[0]?.[0], day, name);
  assert.equal((await runScenario('weekend-sat-sun', { recovery_days: 2 })).left[0][0], 16);
  // 8 h rule (owner decision): a session split by UTC midnight is one visit
  assert.equal((await runScenario('weekend-across-midnight')).left[0]?.[1], 'recovery');
  assert.deepEqual((await runScenario('weekend-across-midnight', { recovery_min_gap_h: 0 })).left, []);
  // weekend frogs still go through the rescue every week: keeping a frog is not the same as good care
  assert.ok((await runScenario('weekend-sat-sun')).seen.has('recovering'));
});

test('model good care days: the numbers in games/PEPEGOCHI_API.md', async () => {
  const good = async (name, rules = {}) => {
    const r = await runScenario(name, rules);
    return [r.st.pet?.good_days ?? 0, r.left.length > 0];
  };
  // decided threshold (owner, 2026-11-07): every need >= 40
  assert.deepEqual(await good('daily'), [61, false]);
  assert.deepEqual(await good('weekend-quick-20w'), [21, false], 'short weekend visits: every Sunday');
  assert.deepEqual(await good('weekend-quick-32w'), [33, false], 'Good Parent reachable with short weekend visits');
  assert.deepEqual(await good('weekend-long-20w'), [41, false], 'an hour each weekend day');
  assert.deepEqual(await good('weekend-two-visits-20w'), [41, false]);
  assert.deepEqual(await good('daily-midnight-split'), [41, false]);
  assert.deepEqual(await good('neglect-then-daily'), [44, false]);
  assert.ok((await good('every-4-days'))[0] <= 2, 'care every 4 days: practically no progress');
  assert.deepEqual(await good('weekend-quick-20w', { good_day_min_need: 50 }), [1, false], 'the earlier >= 50');
  assert.deepEqual(await good('every-4-days', { good_day_cared_counts: true }), [16, false]);
  // Good Parent: a milestone in memory only, once
  const sim = new LocalPepegochi({ start: START, rules: { good_parent_days: 2 } });
  sim.rpc('gry_pepegochi_adopt', { p_name: 'Fren' });
  for (let d = 0; d < 3; d++) { for (const k of KINDS) { sim.rpc('gry_pepegochi_action', { p_action: k }); sim.advance(3000); } sim.advance(24 * H); }
  assert.deepEqual(sim.world.milestones.filter(m => m.milestone === 'good_parent').length, 1);
});

test('model statuses at the thresholds', () => {
  const sim = new LocalPepegochi({ start: START });
  const t0 = Date.parse(START);
  assert.equal(sim.rpc('gry_pepegochi_adopt', { p_name: 'Fren' }, t0).value.adopt_result, 'adopted');
  // an egg waits: still healthy, nothing overdue, no deadline, the needs do not fall (owner, 2026-11-13)
  const egg = sim.rpc('gry_pepegochi_state', {}, t0 + 1000 * H).value.pet;
  assert.deepEqual([egg.stage, egg.status, egg.overdue, egg.departs_at, egg.needs], ['egg', 'healthy', [], 'infinity',
    { hunger: 75, hygiene: 80, mood: 80, energy: 75 }]);
  // it hatches with its first care, a long time later: its clocks start then, not at the adoption
  assert.equal(sim.rpc('gry_pepegochi_action', { p_action: 'feed' }, t0 + 1000 * H).value.pet.status, 'healthy');
  const since = Date.parse(sim.rpc('gry_pepegochi_state', {}, t0 + 1000 * H).value.pet.most_neglected_since);
  assert.equal(since, t0 + 1000 * H);
  const st = h => sim.rpc('gry_pepegochi_state', {}, since + h * H).value.pet.status;
  assert.deepEqual([47.99, 48, 119.99, 120, 167.99, 168].map(st), ['healthy', 'neglected', 'neglected', 'packing', 'packing', 'departed']);
  const r = sim.rpc('gry_pepegochi_action', { p_action: 'feed' }, since + 168 * H);
  assert.equal(r.value.action_result, 'moved_out');
  assert.equal(sim.rpc('gry_pepegochi_adopt', { p_name: 'Two' }, since + 169 * H).value.adopt_result, 'read_the_letter_first');
  assert.equal(sim.rpc('gry_pepegochi_letter_read', {}, since + 170 * H).value.can_adopt, true);
  assert.equal(sim.rpc('gry_pepegochi_adopt', { p_name: 'Two' }, since + 171 * H).value.pet.generation, 2);
});

test('model rejects like the server: same messages and codes', () => {
  const sim = new LocalPepegochi({ start: START });
  assert.deepEqual(sim.rpc('gry_pepegochi_action', { p_action: 'feed' }), { ok: false, error: 'Adopt a Fren first', code: 'P0001' });
  for (const n of ['a', 'x'.repeat(19), 'bad<name>', 'Fren\u200b', null]) assert.equal(sim.rpc('gry_pepegochi_adopt', { p_name: n }).code, '22023', String(n));
  sim.rpc('gry_pepegochi_adopt', { p_name: '  Żabka  ' });
  assert.equal(sim.rpc('gry_pepegochi_state').value.pet.name, 'Żabka');
  assert.equal(sim.rpc('gry_pepegochi_action', { p_action: 'cheat' }).code, '22023');
  assert.equal(sim.rpc('gry_pepegochi_action', { p_action: 'feed' }).value.action_result, 'accepted');
  assert.match(sim.rpc('gry_pepegochi_action', { p_action: 'clean' }).error, /Wait a moment/);
  sim.advance(3000);
  assert.match(sim.rpc('gry_pepegochi_action', { p_action: 'feed' }).error, /cooling down/);
  sim.advance(31 * 60e3);
  assert.match(sim.rpc('gry_pepegochi_action', { p_action: 'feed' }).error, /does not need that/);
});

test('times round-trip in microseconds, like PostgreSQL writes them', () => {
  for (const s of ['2026-11-16T18:00:00+00:00', '2026-11-16T07:12:00.432+00:00', '2026-11-16T07:12:00.000001+00:00'])
    assert.equal(isoUs(parseTimestampUs(s)), s);
  assert.equal(parseTimestampUs('2026-11-17T08:00:00+14:00'), parseTimestampUs('2026-11-16T18:00:00+00:00'));
  assert.equal(parseTimestampUs('2026-11-16T08:00:00-10:00'), parseTimestampUs('2026-11-16T18:00:00Z'));
  assert.throws(() => makeRules({ nope: 1 }), /Unknown rule/);
});

test('local only: the model, the page and its script never reach a server, storage or the Passport', () => {
  const files = ['docs/games/js/pepegochi-model.mjs', 'docs/games/js/pepegochi-sim-page.mjs'];
  for (const f of files) {
    const code = read(f).replace(/\/\/[^\n]*/g, '');
    assert.doesNotMatch(code, /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|localStorage|sessionStorage|indexedDB|document\.cookie/, f);
    assert.doesNotMatch(code, /supabase|backend\.js|getBackend|gry_passport|passport_award|\.rpc\(\s*['"]gry_passport/i, f);
    const imports = [...code.matchAll(/\bimport\b[^'"]*['"]([^'"]+)['"]/g)].map(m => m[1]);
    for (const i of imports) assert.ok(i === './pepegochi-model.mjs', f + ' imports ' + i);
  }
  const page = read('docs/games/pepegochi-sim.html');
  const csp = page.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/)[1];
  assert.match(csp, /connect-src 'none'/, 'the browser itself blocks any network request from this page');
  assert.match(csp, /script-src 'self';/);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval|wasm-unsafe-eval|https?:/);
  assert.match(page, /name="robots" content="noindex, nofollow"/);
  assert.match(page, /TEST SIMULATOR, LOCAL ONLY/);
  assert.match(page, /no stamp or achievement is real/);
  assert.doesNotMatch(page, /<script(?![^>]*\bsrc=)/, 'no inline script');
  assert.doesNotMatch(page, /goatcounter|gc\.zgo\.at/);
});

test('local responses are marked and carry no stamps', () => {
  const sim = new LocalPepegochi({ start: START });
  const r = sim.rpc('gry_pepegochi_adopt', { p_name: 'Fren' });
  assert.equal(r.value.local_preview, true);
  for (let d = 0; d < 8; d++) { sim.advance(24 * H); for (const k of KINDS) { sim.rpc('gry_pepegochi_action', { p_action: k }); sim.advance(3000); } }
  const s = sim.rpc('gry_pepegochi_state').value;
  assert.equal(s.pet.stage, 'adult');
  assert.doesNotMatch(JSON.stringify(s), /badge|stamp|first_hatch|little_fren|grown_fren|passport/i);
  assert.deepEqual(sim.world.milestones.map(m => m.milestone), ['first_adoption', 'hatched', 'froglet', 'adult'], 'kept in memory only');
});

test('the test page is not linked from the site', () => {
  const hits = [];
  const walk = dir => {
    for (const e of readdirSync(new URL('../' + dir, import.meta.url), { withFileTypes: true })) {
      const p = dir + '/' + e.name;
      if (e.isDirectory()) { if (!['data', 'assets', 'vendor'].includes(e.name)) walk(p); }
      else if (/\.(html|js|mjs|json)$/.test(e.name) && !/pepegochi-sim(\.html|-page\.mjs)$/.test(p)
               && read(p).includes('pepegochi-sim.html')) hits.push(p);
    }
  };
  walk('docs');
  assert.deepEqual(hits, []);
});
