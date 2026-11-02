// Optional PostgreSQL integration test: set YEET_PGLITE_MODULE to an installed
// @electric-sql/pglite ESM entry point. No external database or credentials.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('YEET PostgreSQL migration: access control, monotonic records, cooldown and top ten',
  { skip: !process.env.YEET_PGLITE_MODULE }, async () => {
  const { PGlite } = await import(process.env.YEET_PGLITE_MODULE);
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated;
      create schema auth; create schema games;
      create table auth.users(id uuid primary key);
      create table auth.identities(user_id uuid, name text);
      create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create function games.discord_identity(u uuid) returns jsonb language sql stable as
      $$ select jsonb_build_object('name', name) from auth.identities where user_id=u $$;`);
    const migration = await readFile(new URL('../games/supabase/update_yeet.sql', import.meta.url), 'utf8');
    await db.exec(migration); await db.exec(migration); // idempotent, including grants
    const uid = i => `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`;
    const scalar = async (sql, args = []) => (await db.query(sql, args)).rows[0].value;
    const asUser = async i => { await db.query("select set_config('request.jwt.claim.sub', $1, false)", [i ? uid(i) : '']); };
    const submit = (s, ms = 20000) => scalar('select public.gry_yeet_submit($1, $2, 1) as value', [s, ms]);
    assert.deepEqual(await scalar('select public.gry_yeet_state() as value'), { top: [], best: 0 });
    await assert.rejects(submit(1000), /Log in with Discord/);
    for (let i = 1; i <= 13; i++) {
      await db.query('insert into auth.users values ($1)', [uid(i)]);
      if (i < 13) await db.query('insert into auth.identities values ($1, $2)', [uid(i), `Pilot ${i}`]);
    }
    await asUser(13); await assert.rejects(submit(1000), /Log in with Discord/);
    await asUser(1);
    const first = await submit(1000); assert.equal(first.best, 1000); assert.equal(first.top[0].score, 1000);
    assert.equal((await submit(1200)).rate_limited, true);
    const resetCooldown = () => db.exec("update games.yeet_records set last_attempt_at = now() - interval '20 seconds'");
    await resetCooldown(); assert.equal((await submit(900)).best, 1000);
    await resetCooldown(); assert.equal((await submit(1500)).best, 1500);
    await assert.rejects(submit(60001), /Invalid flight/);
    await assert.rejects(submit(50000, 1000), /does not match/);
    await assert.rejects(scalar('select public.gry_yeet_submit(2000, 20000, 2) as value'), /Refresh/);
    for (let i = 2; i <= 12; i++) { await asUser(i); await submit(2000 + i); }
    await asUser(1);
    const state = await scalar('select public.gry_yeet_state() as value');
    assert.equal(state.best, 1500, 'a player outside top ten retains their record');
    assert.equal(state.top.length, 10); assert.equal(state.top[0].nick, 'Pilot 12');
    assert.equal((await db.query('select count(*)::int as n from games.yeet_records')).rows[0].n, 12);
    await asUser(null); assert.equal((await scalar('select public.gry_yeet_state() as value')).best, 0);
    const permissions = (await db.query(`select
      has_table_privilege('authenticated', 'games.yeet_records', 'SELECT') as can_read,
      has_table_privilege('authenticated', 'games.yeet_records', 'INSERT') as can_insert,
      has_function_privilege('anon','public.gry_yeet_submit(integer,integer,integer)','EXECUTE') as guest_submit,
      has_function_privilege('anon','public.gry_yeet_state()','EXECUTE') as public_top`)).rows[0];
    assert.deepEqual(permissions, { can_read: false, can_insert: false, guest_submit: false, public_top: true });
  } finally { await db.close(); }
});
