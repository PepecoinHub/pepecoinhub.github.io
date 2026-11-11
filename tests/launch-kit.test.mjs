// The launch kit (games/supabase/deploy/): every file in RUN_ORDER.md exists, and 00_check.sql checks the same files,
// in the same order, without changing anything.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const file = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const order = [...file('games/supabase/deploy/RUN_ORDER.md').matchAll(/^\d+\. `([a-z0-9_]+\.sql)`/gm)].map(m => m[1]);
const check = file('games/supabase/deploy/00_check.sql');

test('launch kit: run order and the read-only check agree', () => {
  assert.equal(order.length, 15);
  for (const f of order) assert.ok(existsSync(new URL('../games/supabase/' + f, import.meta.url)), f);
  const checked = [...check.matchAll(/^\s+\((\d+),\s+'([a-z0-9_]+\.sql)/gm)].map(m => [+m[1], m[2]]);
  assert.deepEqual(checked, order.map((f, i) => [i + 1, f]));
  // read only: no DDL or DML outside the quoted probe queries
  const code = check.split('\n').filter(l => !l.trim().startsWith('--')).join('\n').replace(/'[^']*'/g, "''");
  assert.doesNotMatch(code, /\b(create|alter|drop|insert|update|delete|grant|revoke|truncate)\b/i);
  // the Hall of Fame waits for the Passport launch and is installed last
  assert.equal(order.at(-1), 'update_wheres_pepe_hall_of_fame.sql');
  assert.ok(order.indexOf('update_passport_awards.sql') < order.indexOf('update_wheres_pepe_hall_of_fame.sql'));
  assert.match(file('games/supabase/update_wheres_pepe_hall_of_fame.sql'), /where m\.k = 'pioneer_snapshot'/);
});
