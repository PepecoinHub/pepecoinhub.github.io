// Static checks for the PepeGochi v2 → Fren Passport bridge (games/supabase/update_pepegochi_passport.sql).
// tests/pepegochi-passport-sql.test.mjs runs it for real on PostgreSQL.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const bridge = file('games/supabase/update_pepegochi_passport.sql');
const v2 = file('games/supabase/update_pepegochi_v2.sql');
const awards = file('games/supabase/update_passport_awards.sql');
const catalog = JSON.parse(file('docs/meme/passport-catalog.json'));
const code = bridge.replace(/--[^\n]*/g, '');
const fnBody = (src, name) => (src.split('create or replace function ' + name)[1] || '').split(/\n\$\$;/)[0];

// milestone -> stamp, read from the bridge itself
const MAP = Object.fromEntries([...fnBody(code, 'games.pepegochi_passport_stamp').matchAll(/when '([a-z_]+)' then '([a-z_]+)'/g)].map(m => [m[1], m[2]]));
const allowlist = [...fnBody(awards, 'games.passport_award').match(/b not in \(([^)]*)\)/)[1].matchAll(/'([a-z0-9_]+)'/g)].map(x => x[1]);

test('the four life-cycle stamps, from the milestones PepeGochi records', () => {
  // the first care hatches the egg (owner, 2026-11-09); first_adoption is not a stamp
  assert.deepEqual(MAP, { hatched: 'first_hatch', froglet: 'little_fren', adult: 'grown_fren', good_parent: 'good_parent' });
  const known = v2.match(/if m not in \(([^)]*)\)/)[1];
  for (const m of Object.keys(MAP)) assert.match(known, new RegExp("'" + m + "'"), m + ' is a v2 milestone');
  // certified_fren is never PepeGochi's; no 100-day stamp for now (owner, 2026-11-09)
  assert.doesNotMatch(code, /certified_fren|best_fren_forever|perfect_parent/);
  // all four are live and in the Passport allowlist
  for (const s of Object.values(MAP)) assert.ok(allowlist.includes(s), s + ' is awardable');
});

test('every stamp goes through games.passport_award(), dated at the milestone', () => {
  assert.match(fnBody(code, 'games.pepegochi_passport_sync'), /perform games\.passport_award\(u, s, m\.reached_at\);/);
  assert.doesNotMatch(code, /insert into games\.passport_|update games\.passport_|delete from games\.passport_/);
  assert.doesNotMatch(code, /create or replace function (games\.passport_award|public\.gry_passport)/, 'no Passport function is replaced');
  // a stamp counts as delivered only when its row exists (false = "had it" or "no Discord")
  assert.match(fnBody(code, 'games.pepegochi_passport_sync'), /exists \(select 1 from games\.passport_badges b where b\.user_id = u and b\.badge_id = s\)/);
});

test('the hook replaces the A1 no-op exactly, and stays closed to the browser', () => {
  const sig = /create or replace function games\.pepegochi_passport_sync\(u uuid\)\nreturns void language plpgsql volatile set search_path = ''/;
  assert.match(code, sig);
  assert.match(v2, /create function games\.pepegochi_passport_sync\(u uuid\)\s+returns void language plpgsql volatile set search_path = ''/);
  assert.match(code, /games\.pepegochi_passport_stamp\(m text\)\nreturns text language sql immutable set search_path = ''/);
  assert.match(code, /revoke all on function games\.pepegochi_passport_stamp\(text\), games\.pepegochi_passport_sync\(uuid\)\s+from public, anon, authenticated;/);
  assert.doesNotMatch(code, /security definer|grant /i, 'runs inside the PepeGochi RPCs, as their owner');
  // only "not in the allowlist yet" is swallowed; every other error reaches pepegochi_sync's warning
  assert.match(code, /exception when raise_exception then[\s\S]*?if sqlerrm not like 'Unknown passport stamp %' then raise; end if;/);
  assert.doesNotMatch(code, /when others/);
  // order guard and backfill
  assert.match(code, /to_regclass\('games\.pepegochi_milestones'\) is null/);
  assert.match(code, /to_regprocedure\('games\.passport_award\(uuid, text, timestamp with time zone\)'\) is null/);
  assert.match(code, /select games\.pepegochi_passport_sync\(x\.user_id\)\s+from \(select distinct user_id from games\.pepegochi_milestones where synced_at is null\) x;/);
});

test('the Passport rule holds: a planned stamp is never awardable, a live one always is', () => {
  for (const s of Object.values(MAP)) {
    const c = catalog.achievements.find(x => x.id === s);
    assert.ok(c, s + ' is in the Passport catalog');
    assert.equal(c.category, 'pepegachi');
    if (c.status === 'live') assert.ok(allowlist.includes(s), s + ' is live: passport_award() must accept it (release PR)');
    else assert.ok(!allowlist.includes(s), s + ' is planned: passport_award() must refuse it until the release PR');
  }
});
