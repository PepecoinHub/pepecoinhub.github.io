import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const migration = read('games/supabase/update_passport_crown_breaker.sql');
const fn = (sql, name) => {
  const start = sql.indexOf('create or replace function ' + name + '(');
  assert.ok(start >= 0, name);
  const end = sql.indexOf('$$;', start);
  assert.ok(end > start, name + ' terminator');
  return sql.slice(start, end + 3);
};

test('the standalone migration keeps all three live function bodies and grants in sync', () => {
  for (const [name, path] of [
    ['games.passport_award', 'games/supabase/update_passport_awards.sql'],
    ['public.gry_pk_challenge', 'games/supabase/update_pond_king.sql'],
    ['public.gry_passport_avatar_save', 'games/supabase/update_avatar_crown.sql']
  ]) assert.equal(fn(migration, name), fn(read(path), name), name);
  assert.match(migration, /begin;[\s\S]*commit;/);
  assert.match(migration, /grant execute on function public\.gry_pk_challenge\(text, bigint, text, text\) to anon, authenticated/);
  assert.match(migration, /grant execute on function public\.gry_passport_avatar_save\(text, text, text, text, text, text, text\) to authenticated/);
});

test('award threshold is captured from the previous king before the new reign is created', () => {
  const challenge = fn(migration, 'public.gry_pk_challenge');
  const afterWin = challenge.split('if won then')[1].split('else')[0];
  assert.match(afterWin, /k\.defenses >= 13/);
  assert.match(afterWin, /games\.passport_award\(u, 'crown_breaker'\)/);
  assert.doesNotMatch(challenge, /p_.*defenses/); // the browser cannot submit the threshold
  assert.match(fn(migration, 'games.passport_award'), /'crown_breaker'/);
  assert.match(fn(migration, 'public.gry_passport_avatar_save'), /\('special_crown_breaker', 'crown_breaker'\)/);
});
