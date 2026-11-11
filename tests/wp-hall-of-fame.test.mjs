// Static checks for the Pepe Guesser Hall of Fame (games/supabase/update_wheres_pepe_hall_of_fame.sql and PondOS).
// tests/wp-hall-of-fame-sql.test.mjs runs the SQL for real against PostgreSQL.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const sql = file('games/supabase/update_wheres_pepe_hall_of_fame.sql');
const awards = file('games/supabase/update_passport_awards.sql');
const pond = file('docs/meme/meme.js');
const css = file('docs/meme/meme.css');
const catalog = JSON.parse(file('docs/meme/passport-catalog.json'));
const fnBody = (src, name) => (src.split('create or replace function ' + name)[1] || '').split(/\n\$\$;/)[0];

test('settlement is server-side, keyed by day and week, and pays once', () => {
  assert.match(sql, /create table if not exists games\.wp_days \(\n\s+day\s+date primary key/);
  assert.match(sql, /create table if not exists games\.wp_weeks \(\n\s+week_start\s+date primary key/);
  for (const t of ['wp_days', 'wp_weeks']) assert.match(sql, new RegExp('alter table games\\.' + t + ' enable row level security'));
  assert.match(sql, /revoke all on games\.wp_days, games\.wp_weeks from public, anon, authenticated;/);
  const settle = fnBody(sql, 'games.wp_settle');
  assert.match(settle, /on conflict \(day\) do nothing/);
  assert.match(settle, /on conflict \(week_start\) do nothing\s+returning week_start into got;\s+if got is null then continue; end if;/);
  assert.match(settle, /pg_advisory_xact_lock/);
  // a tie gives nobody the day or the week; no time-based tie-breaker anywhere
  assert.match(settle, /if coalesce\(top, 0\) > 0 and n_top = 1 then/);
  assert.doesNotMatch(settle, /best_time|started_at|created_at/);
  // only official plays: Discord-verified, finished, not the host, at most 5000 a day
  const st = fnBody(sql, 'games.wp_standings');
  assert.match(st, /x\.verified and x\.guessed_at is not null/);
  assert.match(st, /not games\.is_host_user\(x\.user_id\)/);
  assert.match(st, /least\(greatest\(x\.points, 0\), 5000\)/);
  // the browser gets two read RPCs; the settlement itself is closed
  const rpcs = [...sql.matchAll(/create or replace function public\.([a-z_]+)\(/g)].map(x => x[1]).sort();
  assert.deepEqual(rpcs, ['gry_wp_hof', 'gry_wp_stats', 'gry_wp_top']);
  assert.match(sql, /revoke all on function games\.wp_monday\(date\), games\.wp_standings\(date, date\), games\.wp_settle\(\), games\.wp_dominator_stamps\(\)/);
  // the start follows the Passport launch (first Monday on or after the Pond Pioneer snapshot); no history rebuilt
  assert.match(fnBody(sql, 'games.wp_hof_begin'), /where m\.k = 'pioneer_snapshot'/);
  assert.match(fnBody(sql, 'games.wp_hof_begin'), /st := launch \+ \(\(8 - extract\(isodow from launch\)::int\) % 7\);/);
});

test('Pond Dominator and Frog of the Week go through the existing Passport paths', () => {
  const p = catalog.achievements.find(x => x.id === 'pond_dominator');
  assert.ok(p); assert.equal(p.status, 'live'); assert.equal(p.title, 'Pond Dominator'); assert.ok(!p.repeatable);
  assert.match(fnBody(awards, 'games.passport_award'), /'bali', 'pond_dominator'\) then/);
  assert.match(fnBody(sql, 'games.wp_dominator_stamps'), /games\.passport_award\(w\.winner_id, 'pond_dominator', w\.at\)/);
  // Frog of the Week stays the one Weekly Champion stamp: no new champion stamp
  assert.ok(!catalog.achievements.some(x => /champion/.test(x.id) && x.id !== 'season_champion'));
  // passport_daily hands Hall of Fame weeks to wp_settle and keeps the old rule only before wp_hof_start
  const daily = fnBody(awards, 'games.passport_daily');
  assert.match(daily, /perform games\.wp_settle\(\);\s+exception when others then\s+raise warning/);
  assert.match(daily, /if hof is null or wk < hof then/);
  // no Perfect Week, no Lily art for the new stamp
  assert.ok(!catalog.achievements.some(x => x.id === 'perfect_week'));
  assert.match(pond, /x\.id === 'pond_dominator'\) return el\('span', \{ class: 'pp-art pp-art-stamp is-dominator'/);
  assert.match(file('docs/meme/passport.css'), /\.pp-art-stamp\.is-dominator \{ background-image: url\(passport-assets\/pond-dominator\.webp/);
});

test('PondOS: three icons in the Pepe Guesser folder, the Hall of Fame window and the Passport stats', () => {
  assert.match(pond, /var F = \[\['PepeGuesser\.exe', 'wheres-pepe', wheresPepe\], \['README\.TXT', 'wp-folder', wpReadme\], \['Hall of Fame', 'hall-of-fame', wpHallOfFame\]\];/);
  const hof = pond.split('function wpHallOfFame()')[1].split('\n  }\n')[0];
  assert.match(hof, /wpRpc\('gry_wp_hof'/);
  assert.match(hof, /'No Winner - Tie'/);
  assert.match(hof, /frenPassport\(false, \{ id: c\.id\.toLowerCase\(\), nick: c\.nick \}\)/);   // the read-only view
  assert.match(hof, /var canOpen = function \(c\) \{ return FREN && c && c\.id && FREN_ID\.test\(c\.id\); \};/);
  // the categories stay separate
  assert.match(pond, /var HOF_CATS = \[\['weeks', 'Weeks won'[\s\S]*\['days', 'Days at #1'[\s\S]*\['streak', 'Longest streak'/);
  // names go in with textContent, never as HTML
  assert.doesNotMatch(hof, /innerHTML[^;]*nick/);
  // the Passport: Journey panel and Stats tab
  assert.match(pond, /\['trophy', 'Days at #1:', fmt\.int\(num\(WPS\.days_at_1\)\)\]/);
  assert.match(pond, /\['calendar', 'Longest Guessing Streak:', wpDays\(WPS\.longest_streak\)\]/);
  assert.match(pond, /rpc\('gry_wp_stats', \{ p_user: id \|\| null \}\)/);
  // the week board is Monday-Sunday now
  assert.match(pond, /data-s="week">This week<\/button>/);
  assert.match(fnBody(sql, 'public.gry_wp_top'), /q\.day between games\.wp_monday\(d\.today\) and d\.today/);
  // phones: the week rows fold to two lines
  assert.match(css, /@media \(max-width: 520px\) \{\n  \.hof-weeks \.hof-row \{ grid-template-columns: minmax\(0, 1fr\) auto; \}/);
});
