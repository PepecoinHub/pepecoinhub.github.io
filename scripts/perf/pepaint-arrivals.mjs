// PEPaint admission at 25/50/100/250 arrivals on in-memory Postgres (PGlite), never a hosted project.
// PEPAINT_PGLITE_MODULE=/abs/node_modules/@electric-sql/pglite/dist/index.js node scripts/perf/pepaint-arrivals.mjs
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const mod = process.env.PEPAINT_PGLITE_MODULE;
const read = p => readFile(new URL('../../games/supabase/' + p, import.meta.url), 'utf8');
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
const url = pathToFileURL(mod);
const { PGlite } = await import(url.href);
const { pgcrypto } = await import(new URL('./contrib/pgcrypto.js', url).href);
const db = await PGlite.create({ extensions: { pgcrypto } });
const q = async (sql, params=[]) => (await db.query(sql,params)).rows;
const as = async (user, sql, params=[]) => { await db.exec('begin; set local role authenticated;'); try { await q("select set_config('request.jwt.claim.sub',$1,true)", [user]); const r = (await q(sql,params))[0].v; await db.exec('commit'); return r; } catch(e) { await db.exec('rollback'); throw e; } };
await db.exec(STUB);
for (const f of ['schema.sql','update_picture_plan.sql','update_pepaint_first_wins.sql','update_limits_cleanup.sql','update_pepaint_volunteers.sql','update_pepaint_viral_capacity.sql','realtime_policies.sql']) await db.exec(await read(f));
const rows = [];
for (const n of [25, 50, 100, 250]) {
  await db.exec("truncate games.rooms cascade; truncate games.pepaint_draw_window;");
  const roomCount = Math.ceil(n / 12); let admitted = 0, refusedPlayers = 0, live = 0, waiting = 0;
  for (let room = 0; room < roomCount; room++) {
    const code = 'T' + String(room).padStart(4, '0'), host = uid(room * 12 + 1);
    await q("insert into games.rooms(code,mode,title,host_id,turn_id,drawer_id) values ($1,'kalambury','Test',$2,$3,$2)", [code, host, uid(5000 + room)]);
    for (let i = room * 12 + 1; i <= Math.min(n, room * 12 + 12); i++) {
      try { await q("insert into games.players(room_code,user_id,nick,nick_key) values ($1,$2,$3,$3)", [code, uid(i), 'Fren' + i]); admitted++; }
      catch (e) { if (!/capacity|full/.test(e.message)) throw e; refusedPlayers++; }
    }
    try { await q("update games.rooms set phase='turn' where code=$1", [code]); live++; } catch (e) { if (!/live game slots/.test(e.message)) throw e; waiting++; }
  }
  // one second of every live room trying to draw as fast as the client allows (4 tries each)
  let ok = 0, denied = 0;
  for (let k = 0; k < 4; k++) for (let room = 0; room < roomCount; room++) {
    const r = await as(uid(room * 12 + 1), "select public.gry_pepaint_draw($1,$2,'d',$3::jsonb) as v", ['T' + String(room).padStart(4, '0'), uid(5000 + room), packet]);
    if (r.ok) ok++; else if (!r.closed) denied++;
  }
  const deliveries = (await q("select coalesce(sum(delivery_cost),0)::int v from games.pepaint_draw_window where sent_at>clock_timestamp()-interval '1 second'"))[0].v;
  rows.push({ arrivals: n, admitted, refused_players: refusedPlayers, live_rooms: live, waiting_rooms: waiting, draw_ok: ok, draw_deferred: denied, deliveries_last_second: deliveries });
}
console.log(JSON.stringify(rows, null, 1));
await db.close();
