// In-memory Postgres (PGlite), never a hosted project.
// npm install --prefix /tmp/pepaint-test @electric-sql/pglite@0.5.17
// PEPAINT_PGLITE_MODULE=/tmp/pepaint-test/node_modules/@electric-sql/pglite/dist/index.js node --test tests/pepaint-viral-capacity-sql.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const mod = process.env.PEPAINT_PGLITE_MODULE;
const read = p => readFile(new URL('../games/supabase/' + p, import.meta.url), 'utf8');
const uid = i => '00000000-0000-4000-8000-' + String(i).padStart(12,'0');
const packet = JSON.stringify({ s: [{ id: 1, c: '#000000', w: 9, p: [1,2,3,4] }] });
const STUB = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth; create schema realtime; create schema extensions;
  create table auth.users(id uuid primary key, is_anonymous boolean default false, raw_user_meta_data jsonb default '{}', created_at timestamptz default now());
  create table auth.identities(user_id uuid, provider text, provider_id text, identity_data jsonb, id uuid default gen_random_uuid());
  create function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
  create function auth.jwt() returns jsonb language sql stable as $f$ select '{}'::jsonb $f$;
  create table realtime.messages(id bigserial, topic text, extension text, payload jsonb, event text, private boolean);
  grant usage on schema realtime to authenticated;
  grant insert on realtime.messages to authenticated;
  grant usage on sequence realtime.messages_id_seq to authenticated;
  alter table realtime.messages enable row level security;
  create function realtime.topic() returns text language sql stable as $f$ select current_setting('test.topic', true) $f$;
  create function realtime.send(payload jsonb, event text, topic text, private boolean default true) returns void language sql as $f$
    insert into realtime.messages(topic,extension,payload,event,private) values (topic,'broadcast',payload,event,private)
  $f$;
  create extension pgcrypto with schema extensions;
`;
test('PEPaint server surge limits, auth, and weighted draw budget for 25/50/100 players', {skip: !mod && 'set PEPAINT_PGLITE_MODULE', timeout: 120000}, async t => {
  const url = pathToFileURL(mod);
  const { PGlite } = await import(url.href);
  const { pgcrypto } = await import(new URL('./contrib/pgcrypto.js', url).href);
  const db = await PGlite.create({ extensions: { pgcrypto } });
  const q = async (sql, params=[]) => (await db.query(sql,params)).rows;
  const scalar = async (sql, params=[]) => (await q(sql,params))[0].v;
  const as = async (user, sql, params=[]) => {
    await db.exec('begin; set local role authenticated;');
    try {
      await q("select set_config('request.jwt.claim.sub',$1,true)", [user]);
      const r = await scalar(sql,params);
      await db.exec('commit'); return r;
    } catch(e) { await db.exec('rollback'); throw e; }
  };
  try {
    await db.exec(STUB);
    for (const f of ['schema.sql','update_picture_plan.sql','update_pepaint_first_wins.sql','update_limits_cleanup.sql','update_pepaint_volunteers.sql','update_pepaint_viral_capacity.sql','update_pepaint_viral_capacity.sql','realtime_policies.sql','enforce_pepaint_draw_rpc.sql']) await db.exec(await read(f));
    assert.equal(await scalar("select has_function_privilege('anon','public.gry_pepaint_draw(text,uuid,text,jsonb)','execute') as v"), false);
    assert.equal(await scalar("select has_table_privilege('authenticated','games.pepaint_draw_window','select') as v"), false);
    assert.equal(await scalar("select count(*)::int as v from pg_policies where policyname='PEPaint: drawing through RPC only' and permissive='RESTRICTIVE'"), 1);
    const draw = (user, code, turn, payload=packet) => as(user, "select public.gry_pepaint_draw($1,$2,'d',$3::jsonb) as v", [code,turn,payload]);
    for (const n of [25,50,100]) await t.test(n+' arrivals', async () => {
      await db.exec("truncate games.rooms cascade; truncate games.pepaint_draw_window;");
      const roomCount = Math.ceil(n/12);
      let active=0, refused=0;
      for (let room=0;room<roomCount;room++) {
        const code='T'+String(room).padStart(4,'0'), host=uid(room*12+1), turn=uid(1000+room);
        await q("insert into games.rooms(code,mode,title,host_id,turn_id,drawer_id) values ($1,'kalambury','Test',$2,$3,$2)",[code,host,turn]);
        for (let i=room*12+1; i<=Math.min(n,room*12+12);i++) {
          await q("insert into games.players(room_code,user_id,nick,nick_key) values ($1,$2,$3,$3)",[code,uid(i),'Fren'+i]);
        }
        try { await q("update games.rooms set phase='turn' where code=$1",[code]); active++; }
        catch(e) { assert.match(e.message,/all live game slots/); refused++; }
      }
      assert.equal(active,Math.min(roomCount,8));
      assert.equal(refused,Math.max(roomCount-8,0));
      assert.equal(await scalar('select count(*)::int as v from games.players'),n);
      if(n===100) {
        await assert.rejects(q("insert into games.players(room_code,user_id,nick,nick_key) values ('T0008',$1,'Extra','extra')",[uid(101)]), /player capacity/);
        await assert.rejects(q("insert into games.players(room_code,user_id,nick,nick_key) values ('T0000',$1,'Extra','extra')",[uid(102)]), /room is full/);
        await q("update games.players set left_at=now() where user_id=$1",[uid(100)]);
        await q("insert into games.players(room_code,user_id,nick,nick_key) values ('T0008',$1,'Extra','extra')",[uid(101)]);
        await q("update games.rooms set phase='finished' where code='T0000'");
        await q("update games.rooms set phase='turn' where code='T0008'");
        await q("update games.rooms set phase='finished' where code='T0008'");
        await q("update games.rooms set phase='turn' where code='T0000'");
      }
      assert.deepEqual(await draw(uid(2),'T0000',uid(1000)),{ok:false,closed:true});
      assert.deepEqual(await draw(uid(1),'T0000',uid(9999)),{ok:false,closed:true});
      await q("select set_config('test.topic',$1,false)",['draw:T0000:'+uid(1000)]);
      await assert.rejects(as(uid(1), "insert into realtime.messages(topic,extension,payload,event,private) values ('x','broadcast','{}','d',true)"), /row-level security/);
      await assert.rejects(draw(uid(1),'T0000',uid(1000),JSON.stringify({s:[{id:1,c:'red'}]})),/Invalid stroke/);
      const results=[];
      // All rooms attempt a packet in rapid succession. The real RPC counts
      // weighted deliveries, rather than testing a client-side approximation.
      for(let room=0;room<active;room++) results.push(await draw(uid(room*12+1),'T'+String(room).padStart(4,'0'),uid(1000+room)));
      assert.ok(results.some(r=>r.ok));
      assert.ok((await scalar("select coalesce(sum(delivery_cost),0)::int as v from games.pepaint_draw_window where sent_at>clock_timestamp()-interval '1 second'"))<=48);
      if(n>=50) assert.ok(results.some(r=>!r.ok));
      const rapid=await draw(uid(1),'T0000',uid(1000));
      assert.equal(rapid.ok,false,'a room must wait its fair interval');
      t.diagnostic(n+' arrivals: '+active+' live rooms, '+refused+' waiting, '+results.filter(r=>r.ok).length+' immediate drawing packets');
      if(n===100) {
        const sent=new Set(results.flatMap((r,i)=>r.ok?[i]:[]));
        const deadline=Date.now()+5000;
        while(sent.size<active && Date.now()<deadline) {
          await new Promise(r=>setTimeout(r,275));
          for(let room=0;room<active;room++) {
            const result=await draw(uid(room*12+1),'T'+String(room).padStart(4,'0'),uid(1000+room));
            if(result.ok) sent.add(room);
          }
          assert.ok((await scalar("select coalesce(sum(delivery_cost),0)::int as v from games.pepaint_draw_window where sent_at>clock_timestamp()-interval '1 second'"))<=48);
        }
        assert.equal(sent.size,active,'every live room eventually got drawing credit');
      }
    });
  } finally { await db.close(); }
});
