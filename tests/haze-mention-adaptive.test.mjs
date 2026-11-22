// Adaptive polling for HazeWallet phone alerts.
//  * the poll hint helper (always runs)
//  * update_haze_mentions.sql + update_haze_mentions_adaptive.sql on a throwaway PostgreSQL (optional):
//      PASSPORT_PG_URL=postgres://postgres:pw@localhost:5432/postgres \
//      PASSPORT_PG_MODULE=/abs/path/node_modules/pg/lib/index.js node --test tests/haze-mention-adaptive.test.mjs
// Never point it at Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pollAfter, IDLE, DRAINING, BURST } from '../games/supabase/functions/haze-mention-delivery/poll.mjs';
import { SKIP, pondDb, uid, addUser } from './pond-sql-setup.mjs';

const read = p => readFile(new URL('../' + p, import.meta.url), 'utf8');

test('poll hint: legacy array replies map to idle / draining / burst', () => {
  assert.deepEqual(pollAfter([]), { body: [], seconds: IDLE });
  assert.deepEqual(pollAfter([{ a: 1 }]).seconds, DRAINING);
  assert.equal(pollAfter(Array(10).fill({})).seconds, BURST);
  assert.deepEqual(pollAfter(null), { body: [], seconds: IDLE });
});

test('poll hint: adaptive SQL replies are unwrapped and clamped to 1..60 s', () => {
  assert.deepEqual(pollAfter({ items: [], poll_after: 60 }), { body: [], seconds: 60 });
  assert.equal(pollAfter({ items: [], poll_after: 7 }).seconds, 7);
  assert.equal(pollAfter({ items: [], poll_after: 9999 }).seconds, 60);
  assert.equal(pollAfter({ items: [], poll_after: 0 }).seconds, 1);
  assert.equal(pollAfter({ items: Array(10).fill({}), poll_after: 5 }).seconds, 1);
  assert.ok(IDLE * 3 <= 180, 'three lost idle polls still fit in the 3-minute registration heartbeat');
});

test('edge function keeps signature checks and the worker-facing body', async () => {
  const src = await read('games/supabase/functions/haze-mention-delivery/index.ts');
  for (const s of ["'Ed25519'", 'x-haze-signature', '45000', '2048', "['take','finish']"]) assert.ok(src.includes(s), s);
  assert.match(src, /X-Haze-Poll-After/);
  assert.match(src, /JSON\.stringify\(body\)/);
});

test('adaptive SQL: same queue semantics, throttled heartbeat, hint only when asked',
  { skip: SKIP, timeout: 120000 }, async () => {
  const { db, drop } = await pondDb('haze_mention_adapt', []);
  try {
    await db.query(`
      do $$ begin create role service_role nologin; exception when duplicate_object or unique_violation then null; end $$;
      create table games.community_settings(id boolean primary key default true, enabled boolean not null default true, beta_only boolean not null default false);
      insert into games.community_settings default values;
      create table games.community_clients(id text primary key, enabled boolean, scopes text[], allowed_users uuid[]);
      insert into games.community_clients values('haze-native', true, array['chat:read'], null);
      create table games.haze_testers(user_id uuid primary key);
      create table games.mention_optout(user_id uuid primary key);
      create table games.community_sessions(id uuid primary key default gen_random_uuid(), user_id uuid, revoked_at timestamptz);
      create table games.push_outbox(id bigint generated always as identity primary key, kind text, to_user uuid, not_user uuid);
      create function games.community_v1_context(a text, b text, c text) returns games.community_sessions language sql as $$ select null::games.community_sessions $$;
      create function games.community_v1_keys(a jsonb, k text[]) returns boolean language sql as $$ select true $$;
      create function games.community_v1_budget(u uuid) returns void language sql as $$ select $$;`);
    await db.query(await read('games/supabase/update_haze_mentions.sql'));
    const take = async extra => (await db.query("select public.haze_mention_delivery($1::jsonb) v",
      [JSON.stringify({ action: 'take', platforms: ['ios', 'android'], ...extra })])).rows[0].v;

    // legacy behaviour on the empty queue
    assert.deepEqual(await take(), []);
    await db.query(await read('games/supabase/update_haze_mentions_adaptive.sql'));
    assert.deepEqual(await take(), [], 'no hint: old reply shape');
    assert.deepEqual(await take({ hint: true }), { items: [], poll_after: 60 });

    // heartbeat rewritten at most every 20 s
    await db.query("update games.haze_mention_sender set seen=now()-interval '10 seconds'");
    await take();
    const s1 = (await db.query("select extract(epoch from now()-seen)::int v from games.haze_mention_sender where platform='ios'")).rows[0].v;
    assert.ok(s1 >= 9, 'fresh heartbeat not rewritten');
    await db.query("update games.haze_mention_sender set seen=now()-interval '90 seconds'");
    await take();
    const s2 = (await db.query("select extract(epoch from now()-seen)::int v from games.haze_mention_sender where platform='ios'")).rows[0].v;
    assert.ok(s2 < 2, 'stale heartbeat refreshed');

    // queue: a device with 12 mentions → burst, then draining, then wait for retry
    await addUser(db, 1);
    await db.query("insert into games.haze_mention_devices values('" + 'a'.repeat(64) + "',$1,gen_random_uuid(),'ios','" + 'f'.repeat(64) + "',now())", [uid(1)]);
    for (let i = 0; i < 12; i++) await db.query("insert into games.push_outbox(kind,to_user) values('mention',$1)", [uid(1)]);
    const r1 = await take({ hint: true });
    assert.equal(r1.items.length, 10); assert.equal(r1.poll_after, 1);
    const r2 = await take({ hint: true });
    assert.equal(r2.items.length, 2); assert.equal(r2.poll_after, 5);
    // finish one as failed → retry back-off unchanged (15 s * 2^attempt)
    const it = r2.items[0];
    await db.query("select public.haze_mention_delivery($1::jsonb)", [JSON.stringify({ action: 'finish', event: it.event, install: it.install, lease: it.lease, result: 'retry' })]);
    const back = (await db.query("select extract(epoch from available-now())::int v from games.haze_mention_queue where event=$1", [it.event])).rows[0].v;
    assert.ok(back >= 29 && back <= 30, 'back-off ' + back);
    const r3 = await take({ hint: true });
    assert.equal(r3.items.length, 0);
    assert.ok(r3.poll_after >= 29 && r3.poll_after <= 30, 'waits for the next due retry, got ' + r3.poll_after);
    // finish all others as sent → queue holds only the retry
    for (const x of [...r1.items, r2.items[1]]) await db.query("select public.haze_mention_delivery($1::jsonb)", [JSON.stringify({ action: 'finish', event: x.event, install: x.install, lease: x.lease, result: 'sent' })]);
    assert.equal((await db.query('select count(*)::int v from games.haze_mention_queue')).rows[0].v, 1);
    // wrong lease is still ignored
    await db.query("select public.haze_mention_delivery($1::jsonb)", [JSON.stringify({ action: 'finish', event: it.event, install: it.install, lease: '00000000-0000-4000-8000-000000000000', result: 'sent' })]);
    assert.equal((await db.query('select count(*)::int v from games.haze_mention_queue')).rows[0].v, 1);
    // grants unchanged: only service_role
    const g = (await db.query("select has_function_privilege('anon','public.haze_mention_delivery(jsonb)','execute') a, has_function_privilege('service_role','public.haze_mention_delivery(jsonb)','execute') s")).rows[0];
    assert.deepEqual(g, { a: false, s: true });
  } finally { await drop(); }
});
