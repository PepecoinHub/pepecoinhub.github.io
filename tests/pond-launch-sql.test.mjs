// The paste-ready POND duels SQL (games/supabase/deploy/POND_DUELS_ALL.sql) is up to date with its source files,
// and (with PostgreSQL, see tests/pond-sql-setup.mjs) it runs on a fresh database, twice, as one transaction.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { SKIP, pondDb, caller } from './pond-sql-setup.mjs';

const ROOT = new URL('../', import.meta.url);

test('POND_DUELS_ALL.sql is built from the current files', () => {
  execFileSync('python3', ['scripts/build_pond_sql.py', '--check'], { cwd: ROOT });
});

test('POND_DUELS_ALL.sql runs twice on a fresh database', { skip: SKIP, timeout: 120000 }, async () => {
  const { db, drop } = await pondDb('pond_launch_test', []);
  try {
    const sql = await readFile(new URL('games/supabase/deploy/POND_DUELS_ALL.sql', ROOT), 'utf8');
    await db.query(sql);
    await db.query(sql);
    const call = caller(db);
    const st = await call({ ip: '9.9.9.9' }, "select public.gry_pk_state('player-token-0000000001') as v");
    assert.equal(st.king.nick, 'Pepe');
    assert.deepEqual(await call(null, 'select public.gry_lily_leaders() as v'), { streaks: [], wins: [] });
    const def = (await db.query("select pg_get_functiondef('games.passport_award(uuid,text,timestamptz)'::regprocedure) d")).rows[0].d;
    assert.match(def, /long_live_the_king/);
  } finally {
    await drop();
  }
});
