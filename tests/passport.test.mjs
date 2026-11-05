import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const catalog = JSON.parse(file('docs/meme/passport-catalog.json'));
const sql = file('games/supabase/update_fren_passport.sql');
const pond = file('docs/meme/meme.js');

test('Fren Passport has unique and well-formed public catalog IDs', () => {
  const kinds = ['achievements', 'secrets', 'items', 'titles'];
  const entries = kinds.flatMap(key => catalog[key]);
  assert.equal(catalog.version, 1);
  assert.deepEqual(kinds.map(key => catalog[key].length), [24, 12, 8, 4]);
  const ids = entries.map(x => x.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const item of entries) {
    assert.match(item.id, /^[a-z0-9_]{3,48}$/);
    assert.ok(item.title);
    assert.ok(['live', 'planned'].includes(item.status));
  }
});

test('every live casual secret is server allowlisted and discoverable', () => {
  const live = catalog.secrets.filter(x => x.status === 'live').map(x => x.id).sort();
  const block = sql.match(/p_secret\s+not\s+in\s*\(([^)]*)\)/i);
  assert.ok(block, 'SQL casual-secret whitelist missing');
  const allowed = [...block[1].matchAll(/'([a-z0-9_]+)'/g)].map(x => x[1]).sort();
  assert.deepEqual(live, allowed);
  for (const id of live) assert.ok(pond.includes("discoverSecret('" + id + "')"), id);
});

test('secret RPC requires Discord and cannot issue premium or gameplay rewards', () => {
  const fn = sql.split('create or replace function public.gry_passport_discover')[1];
  assert.ok(fn, 'discovery RPC absent');
  assert.match(fn, /games\.discord_identity\(u\)/);
  assert.match(fn, /on conflict\s*\(user_id, secret_id\) do nothing/);
  assert.doesNotMatch(fn, /insert into games\.passport_items/i);
  assert.doesNotMatch(fn, /insert into games\.passport_badges/i);
  assert.match(sql, /revoke all on function public\.gry_passport_discover\(text\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.gry_passport_discover\(text\) to authenticated/);
});

test('all badge and secret catalog items use distinct statuses', () => {
  const reserved = new Set(['moon_rock','certified_fren','pond_pioneer']);
  for (const item of [...catalog.achievements,...catalog.items]) {
    if (reserved.has(item.id)) assert.equal(item.status, 'planned');
  }
  assert.match(pond, /passport-catalog\.json/);
});

test('both Passport RPCs have balanced dollar-quoted SQL bodies', () => {
  const starts = [...sql.matchAll(/\bas \$\$/g)];
  const ends = [...sql.matchAll(/^\$\$;/gm)];
  assert.equal(starts.length, 2, 'expected two properly delimited RPC definitions');
  assert.equal(ends.length, 2, 'expected two closing $$ delimiters');
  assert.doesNotMatch(sql, /\bas \$\n/);
  assert.doesNotMatch(sql, /^\$;/m);
});

test('Certified Fren earned record appears once instead of a locked duplicate', () => {
  assert.match(sql, /b\.badge_id <> 'certified_fren'/);
  assert.match(sql, /where b\.user_id = u and b\.badge_id = 'certified_fren'/);
  assert.doesNotMatch(sql, /'certified_fren'[\s\S]{0,200}'earned_at', null/);
});
