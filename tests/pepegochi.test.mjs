// PepeGochi v2 static checks (run in CI, no database). tests/pepegochi-sql.test.mjs runs the SQL for real.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const sql = read('games/supabase/update_pepegochi_v2.sql');
const sim = read('scripts/pepegochi_sim.mjs');
const api = read('games/PEPEGOCHI_API.md');
const code = sql.replace(/--[^\n]*/g, '');   // SQL without comments
const fnBody = name => {
  const start = code.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' missing');
  const open = code.indexOf('$$', start);
  return code.slice(open + 2, code.indexOf('$$', open + 2));
};
const PUBLIC = [...code.matchAll(/create or replace function public\.(gry_pepegochi_[a-z_]+)\(([^)]*)\)/g)].map(m => [m[1], m[2].trim()]);
const INTERNAL = [...new Set([...code.matchAll(/create (?:or replace )?function games\.(pepegochi_[a-z_]+)\(/g)].map(m => m[1]))];

test('four browser RPCs, arguments limited to a name or an action', () => {
  assert.deepEqual(PUBLIC.map(x => x[0]).sort(),
    ['gry_pepegochi_action', 'gry_pepegochi_adopt', 'gry_pepegochi_letter_read', 'gry_pepegochi_state']);
  for (const [name, args] of PUBLIC) assert.ok(['', 'p_name text', 'p_action text'].includes(args), name + '(' + args + ')');
  assert.match(fnBody('public.gry_pepegochi_action'), /p_action not in \('feed', 'clean', 'play', 'rest'\)/);
});

test('every browser RPC: Discord check, security definer, empty search_path, execute for authenticated only', () => {
  for (const [name, args] of PUBLIC) {
    const head = code.slice(code.indexOf('function public.' + name + '('), code.indexOf('$$', code.indexOf('function public.' + name + '(')));
    assert.match(head, /security definer set search_path = ''/, name);
    assert.match(fnBody('public.' + name), /if u is null or games\.discord_identity\(u\) is null then\s+raise exception 'Discord sign-in required' using errcode = '42501'/, name);
    const sig = args ? args.split(' ')[1] : '';
    assert.match(code, new RegExp(`revoke all on function public\\.${name}\\(${sig}\\) from public, anon, authenticated;\\ngrant execute on function public\\.${name}\\(${sig}\\) to authenticated;`), name);
  }
});

test('internal functions and tables are closed to the browser', () => {
  const revoke = code.slice(code.indexOf('revoke all on function games.pepegochi_clock()'));
  for (const f of INTERNAL) assert.match(revoke.slice(0, revoke.indexOf(';')), new RegExp('games\\.' + f + '\\('), f + ' not revoked');
  for (const t of ['pepegochi_owners', 'pepegochi_lives', 'pepegochi_milestones'])
    assert.match(code, new RegExp('alter table games\\.' + t + ' enable row level security'), t);
  assert.match(code, /revoke all on games\.pepegochi_owners, games\.pepegochi_lives, games\.pepegochi_milestones\s+from public, anon, authenticated/);
  assert.doesNotMatch(code, /grant [a-z, ]+ on (table )?games\./i);
  // internal helpers run with the caller's rights (always one of the four RPCs)
  for (const f of INTERNAL) {
    const at = code.indexOf('function games.' + f + '(');
    assert.doesNotMatch(code.slice(at, code.indexOf('$', at)), /security definer/, f);
  }
});

test('one active frog per account, enforced by the database', () => {
  assert.match(code, /create unique index if not exists pepegochi_one_active_life\s+on games\.pepegochi_lives \(user_id\) where status = 'active'/);
  assert.match(code, /unique \(user_id, generation\)/);
  for (const f of ['public.gry_pepegochi_adopt', 'public.gry_pepegochi_action', 'public.gry_pepegochi_letter_read']) {
    const b = fnBody(f);
    const lockOwner = b.indexOf('from games.pepegochi_owners o where o.user_id = u for update');
    const lockLife = b.indexOf('order by x.generation desc limit 1 for update');
    const clock = b.indexOf('t := games.pepegochi_clock();   -- after the locks') >= 0
      ? b.indexOf('t := games.pepegochi_clock();   -- after the locks') : b.lastIndexOf('t := games.pepegochi_clock();');
    assert.ok(lockOwner >= 0 && lockLife > lockOwner && clock > lockLife, f + ': owner lock, then life lock, then server time');
  }
});

test('time arithmetic is exact and never uses day-sized intervals', () => {
  // day intervals move by an hour across daylight saving time in a non-UTC session
  assert.doesNotMatch(code, /interval '\d* ?days?'/);
  // decay: one multiplication, then one division
  for (const need of ['hunger', 'hygiene', 'mood', 'energy'])
    assert.match(fnBody('games.pepegochi_eval'), new RegExp(`l\\.${need}\\s+- secs \\* \\(r#>>'\\{decay_per_day,${need}\\}'\\)::numeric / 86400`));
  assert.match(fnBody('games.pepegochi_due'), /round\(\(v - threshold\) \* 86400000000 \/ per_day\)::bigint \* interval '1 microsecond'/);
});

test('the production clock is the server clock; only tests and the simulator replace it', () => {
  assert.equal(fnBody('games.pepegochi_clock').trim(), 'select clock_timestamp()');
  assert.doesNotMatch(code, /pepegochi\.sim_now|current_setting/);
  // every other rule reads time through games.pepegochi_clock()
  assert.equal(code.match(/clock_timestamp\(\)/g).length, 1);
  assert.doesNotMatch(code, /\bnow\(\)|current_timestamp|localtimestamp/i);
  assert.match(sim, /set_config\('pepegochi\.sim_now'/);
});

test('reading never writes; moving out never deletes', () => {
  assert.doesNotMatch(fnBody('public.gry_pepegochi_state'), /\b(insert|update|delete)\b/i);
  assert.doesNotMatch(fnBody('games.pepegochi_view'), /\b(insert|update|delete)\b/i);
  assert.doesNotMatch(fnBody('games.pepegochi_eval'), /\b(insert|update|delete)\b/i);
  assert.doesNotMatch(code, /\bdelete\s+from\b/i);
  assert.doesNotMatch(code, /\btruncate\b|\bdrop\s+table\b/i);
  // the move-out is written once and keeps the computed moment
  assert.match(fnBody('games.pepegochi_settle'), /departed_at = e\.departs_at/);
  assert.match(fnBody('games.pepegochi_settle'), /where life_id = l\.life_id and status = 'active'/);
});

test('no stamps or Passport writes here; milestones wait for an isolated hook', () => {
  assert.doesNotMatch(code, /passport_badges|passport_items|passport_secrets|passport_avatars|passport_award|certified_fren/);
  assert.match(code, /if to_regprocedure\('games\.pepegochi_passport_sync\(uuid\)'\) is null then\s+create function games\.pepegochi_passport_sync/);
  assert.match(fnBody('games.pepegochi_sync'), /begin\s+perform games\.pepegochi_passport_sync\(u\);\s+exception when others then\s+raise warning/);
  assert.match(fnBody('games.pepegochi_milestone'), /on conflict \(user_id, milestone\) do nothing/);
  assert.match(code, /synced_at\s+timestamptz/);
});

test('no money: no payouts, wallets or multipliers', () => {
  for (const [name, text] of [['SQL', code], ['simulator', sim]])
    assert.doesNotMatch(text, /payout|wallet|multiplier|withdraw|airdrop|reward_pep|\bpep_amount/i, name);
});

test('v2 starts from a clean schema and refuses to run over v1', () => {
  assert.match(code, /if to_regclass\('games\.pepegochi_pets'\) is not null then\s+raise exception/);
});

test('playtest rules are marked as such and documented with the same numbers', () => {
  const rules = fnBody('games.pepegochi_rules');
  assert.match(rules, /'playtest', true/);
  // recovery_days = 1 is the owner's decision (2026-11-07): Saturday + Sunday players keep their frog
  const want = { meaningful_below: 90, neglected_h: 48, packing_h: 120, departs_h: 168, rescue_from_h: 120,
    recovery_days: 1, recovery_departs_h: 72, recovery_min_gap_h: 0, max_actions_per_utc_day: 12, min_gap_s: 2 };
  for (const [k, v] of Object.entries(want)) {
    assert.match(rules, new RegExp(`'${k}', ${v}\\b`), k);
    assert.match(api, new RegExp('`' + k + '`\\s*\\|\\s*' + v + '\\b'), 'API doc: ' + k);
  }
});

test('the contract names every RPC and the testing rules', () => {
  for (const [name] of PUBLIC) assert.match(api, new RegExp(name));
  assert.match(api, /NOT installed/);
  assert.match(api, /scripts\/pepegochi_sim\.mjs/);
  assert.match(api, /tests\/pepegochi-sql\.test\.mjs/);
  assert.match(api, /hidden beta/i);
});
