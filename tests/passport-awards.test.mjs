// Static checks for games/supabase/update_passport_awards.sql and its PondOS client.
// tests/passport-awards-sql.test.mjs runs the SQL for real against PostgreSQL.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const sql = file('games/supabase/update_passport_awards.sql');
const yeetSql = file('games/supabase/update_yeet.sql');
const catalog = JSON.parse(file('docs/meme/passport-catalog.json'));
const manifest = JSON.parse(file('docs/meme/avatar-options.json'));
const pond = file('docs/meme/meme.js');
const fnBody = (src, name) => (src.split('create or replace function ' + name)[1] || '').split(/\n\$\$;|\nend \$\$;/)[0];

test('every live stamp has a server award path, and only live stamps do', () => {
  const award = fnBody(sql, 'games.passport_award');
  const allowed = [...award.match(/b not in \(([^)]*)\)/)[1].matchAll(/'([a-z0-9_]+)'/g)].map(x => x[1]).sort();
  // first_fren comes from the account itself, first_avatar from the Avatar Maker's first save
  const live = catalog.achievements.filter(x => x.status === 'live').map(x => x.id);
  assert.deepEqual(allowed, live.filter(id => !['first_fren', 'first_avatar'].includes(id)).sort());
  for (const x of catalog.achievements.filter(x => x.status !== 'live')) {
    assert.ok(!allowed.includes(x.id), x.id + ' is planned and must not be awardable');
    assert.doesNotMatch(sql, new RegExp("insert into games\\.passport_badges[^;]*'" + x.id + "'"), x.id);
  }
  // each allowed stamp is really awarded somewhere besides the allowlist
  const rest = sql.replace(award, '');
  for (const id of allowed) assert.match(rest, new RegExp("'" + id + "'"), id + ' has no award');
  for (const gone of ['seven_day_fren', 'ten_day_fren', 'frog_detective'])
    assert.ok(!catalog.achievements.some(x => x.id === gone), gone + ' was removed');
});

test('awards come from game records, never from browser arguments', () => {
  // the only new browser RPC takes no arguments
  const rpcs = [...sql.matchAll(/create or replace function public\.([a-z_]+)\(([^)]*)\)/g)].map(x => [x[1], x[2].trim()]);
  assert.deepEqual(rpcs.map(x => x[0]).sort(), ['gry_letter_bug_hunter', 'gry_letter_printed', 'gry_letters', 'gry_passport_bali',
    'gry_passport_checkin', 'gry_passport_state', 'gry_yeet_submit']);
  assert.equal(rpcs.find(x => x[0] === 'gry_passport_checkin')[1], '');
  // the owner tools (Printed, Bug Hunter, BALI, the mailbox) refuse everyone but the site owner, first thing
  for (const f of ['public.gry_letter_printed', 'public.gry_letter_bug_hunter', 'public.gry_passport_bali'])
    assert.match(fnBody(sql, f), / as \$\$\n(declare[^\n]*\n)?begin\n\s+if not games\.is_owner\(auth\.uid\(\)\) then raise exception/, f);
  assert.match(fnBody(sql, 'public.gry_letters'), /if not games\.is_owner\(auth\.uid\(\)\) then\s+return null;/);
  // a letter can be marked printed only when its writer ticked "OK to print"
  assert.match(fnBody(sql, 'public.gry_letter_printed'), /if not l\.print_ok then raise exception/);
  assert.match(sql, /revoke all on function public\.gry_passport_checkin\(\) from public, anon, authenticated;\ngrant execute on function public\.gry_passport_checkin\(\) to authenticated;/);
  // Discord only, at the single award path
  assert.match(fnBody(sql, 'games.passport_award'), /games\.discord_identity\(u\) is null then return false/);
  assert.match(fnBody(sql, 'games.passport_award'), /on conflict \(user_id, badge_id\) do nothing/);
  // internal helpers are closed to the browser
  assert.match(sql, /revoke all on function games\.passport_award\(uuid, text, timestamptz\)/);
  for (const t of ['passport_meta', 'passport_yeet_5k', 'passport_days', 'passport_chat_days', 'passport_progress', 'passport_printed'])
    assert.match(sql, new RegExp('alter table games\\.' + t + ' enable row level security'), t);
  // Pepe Guesser counts only Discord-verified plays with a pin
  assert.match(fnBody(sql, 'games.passport_wp_check'), /x\.verified and x\.g_lat is not null/);
  // every hook swallows its own errors, so a stamp bug cannot break a game
  for (const f of ['games.passport_wp_after', 'games.passport_chat_after', 'games.passport_mention_after',
    'games.passport_letter_after', 'games.passport_miner_after'])
    assert.match(fnBody(sql, f), /exception when others then\s+raise warning/, f);
});

test('gry_yeet_submit keeps the update_yeet.sql body, plus only the passport hook', () => {
  const norm = s => s.replace(/\s+/g, ' ').trim();
  const orig = fnBody(yeetSql, 'public.gry_yeet_submit');
  const hooked = fnBody(sql, 'public.gry_yeet_submit');
  const hook = hooked.match(/ *-- Fren Passport \(update_passport_awards\.sql\)[\s\S]*?end;\n/);
  assert.ok(hook, 'hook block');
  assert.match(hook[0], /perform games\.passport_yeet_flight\(u, p_score\);\s+exception when others then/);
  assert.equal(norm(hooked.replace(hook[0], '')), norm(orig));
  // the hook sits after the accepted update, so rate-limited submissions return before it
  assert.ok(hooked.indexOf('rate_limited\', true') < hooked.indexOf('passport_yeet_flight'));
  assert.match(sql, /grant execute on function public\.gry_yeet_submit\(integer, integer, integer\) to authenticated;/);
});

test('Pond Pioneer: the beta snapshot plus beta check-ins, closed at the season start', () => {
  const p = catalog.achievements.find(x => x.id === 'pond_pioneer');
  assert.equal(p.status, 'live'); assert.equal(p.limited, true);
  assert.match(sql, /insert into games\.passport_meta \(k\) values \('pioneer_snapshot'\) on conflict \(k\) do nothing returning at into launch;\s+if launch is not null and not games\.passport_open\(\) then/);
  // the award path refuses it once the season is open; only the beta check-in gives it later
  assert.match(sql, /if b = 'pond_pioneer' then\s+if games\.passport_open\(\) then return false; end if;/);
  assert.match(sql, /if not games\.passport_open\(\) then\s+-- public beta[^\n]*\n\s+perform games\.passport_award\(u, 'pond_pioneer'\);/);
  // allowlist, gate, beta check-in, snapshot, beta cleanup
  assert.equal([...sql.matchAll(/'pond_pioneer'/g)].length, 5);
});

test('reward parts open with stamps that exist in the catalog', () => {
  // an unlock is a stamp, or (for most special avatars) a live secret
  const ids = new Set([...catalog.achievements.map(x => x.id), ...catalog.secrets.filter(x => x.status === 'live').map(x => x.id)]);
  for (const o of Object.values(manifest.options).flat().filter(o => o.unlock)) assert.ok(ids.has(o.unlock), o.id + ' -> ' + o.unlock);
  // the Maker names only stamps that can be earned today
  const named = pond.match(/var FA_UNLOCK = \{([^}]*)\}/)[1];
  for (const id of [...named.matchAll(/([a-z_]+):/g)].map(x => x[1]))
    assert.equal(catalog.achievements.find(x => x.id === id).status, 'live', id);
});

test('PondOS client: one argument-free check-in, planned stamps stay ???', () => {
  const calls = [...pond.matchAll(/(?:frenRpc|rpc)\('gry_passport_checkin', ([^)]*)\)/g)].map(x => x[1]);
  assert.deepEqual(calls, ['{}']);
  assert.match(pond, /function nameOf\(x, e\) \{ return shown\(x, e\) \? \(x\.title\|\|x\.id\) : '\?\?\?'; \}/);
  assert.match(pond, /var PP_CATALOG = 'passport-catalog\.json\?v=/);
  // the stamp ad exists and opens the Passport
  assert.match(pond, /file: 'pond_stamps\.mpg'[\s\S]*?ad-passbtn/);
});
