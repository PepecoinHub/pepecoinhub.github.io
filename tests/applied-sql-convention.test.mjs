// Every NEW update_*.sql file in games/supabase must end by marking itself in games.applied_sql
// (see games/supabase/update_applied_sql.sql), so the database keeps a list of what was run and when.
// Files that existed before the list (tests/fixtures/sql-before-applied-list.txt) are exempt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('new games/supabase/update_*.sql files call games.mark_applied with their own name', async () => {
  const old = new Set((await readFile(new URL('tests/fixtures/sql-before-applied-list.txt', root), 'utf8')).split('\n').filter(Boolean));
  const dir = new URL('games/supabase/', root);
  const missing = [];
  for (const name of (await readdir(dir)).filter(n => /^update_.*\.sql$/.test(n)).sort()) {
    if (old.has('games/supabase/' + name)) continue;
    const sql = await readFile(new URL(name, dir), 'utf8');
    if (!sql.includes(`games.mark_applied('${name}'`)) missing.push(name);
  }
  assert.deepEqual(missing, [], `add  select games.mark_applied('<file name>');  at the end of: ${missing.join(', ')}`);
});
