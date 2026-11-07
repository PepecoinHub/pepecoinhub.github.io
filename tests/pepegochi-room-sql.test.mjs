// Room-2 integration tests. Runs only against disposable LOCAL PostgreSQL, never PH-games.
//   PASSPORT_PG_URL=postgres://postgres:pw@127.0.0.1:5432/postgres \
//   PASSPORT_PG_MODULE=/absolute/path/to/pg/lib/index.js node --test tests/pepegochi-room-sql.test.mjs
// Uses the existing A2 migration + games/supabase/update_pepegochi_room_v1.sql.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepare, addPlayer, callRpc, asDb, uid, START } from '../scripts/pepegochi_sim.mjs';

const URI=process.env.PASSPORT_PG_URL;
const MOD=process.env.PASSPORT_PG_MODULE;
const hasConfig=Boolean(URI&&MOD);
const localHost=hasConfig && ['localhost','127.0.0.1','::1','[::1]'].includes(new URL(URI).hostname);
const skipReason=!hasConfig?'Set PASSPORT_PG_URL and PASSPORT_PG_MODULE to disposable local PG'
  :!localHost?'Refusing non-local database for Room-2 tests':false;

const migrate=()=>readFile(new URL('../games/supabase/update_pepegochi_room_v1.sql',import.meta.url),'utf8');
const T=new Date(START);
const t=(h=0)=>new Date(+T+h*3600000);

// This suite does not execute on production (even if someone supplies a remote URL).
test('PepeGochi Room-2: account inventory, slots, grants, move, concurrency and departure',
  { skip:skipReason, timeout:600000 },async sub=>{
    const pg=(await import(MOD)).default;
    const admin=new pg.Client({connectionString:URI});
    await admin.connect();
    const name='pepegochi_room_test_'+process.pid+'_'+Date.now();
    await admin.query('create database '+name);
    const url=new URL(URI);url.pathname='/'+name;
    const clients=[];
    const connect=async()=>{const c=new pg.Client({connectionString:url.toString()});await c.connect();clients.push(c);return c;};
    const raw=await connect();const db=asDb(raw);
    const sql=async(q,args=[])=> (await db.query(q,args)).rows;
    const rpc=async(user,fn,args=[],now=t(0),extra={})=>callRpc(db,{user,now,...extra},'public.'+fn,args);
    const ok=async(...args)=>{const r=await rpc(...args);assert.equal(r.ok,true,r.error);return r.value;};
    const user=async(id,provider='discord')=>{await addPlayer(db,id,{provider});return id;};
    try{
      await prepare(db);
      await db.exec(await migrate());
      await user(1);await user(2);await user(3,'email');

      await sub.test('Deny anon, non-Discord and unowned read/write',async()=>{
        for(const f of ['gry_pepegochi_room_state()','gry_pepegochi_room_initialize()',
          "gry_pepegochi_room_place(null,null,1)","gry_pepegochi_room_unplace(null,1)"]){
          const a=await rpc(1,f,[],t(),{role:'anon'});
          assert.equal(a.ok,false,f);assert.match(a.error,/permission denied/i);
          const e=await rpc(3,f);
          assert.equal(e.ok,false,f);assert.match(e.error,/Discord sign-in required/);
        }
        assert.equal((await rpc(1,'gry_pepegochi_room_initialize()')).ok,false);
      });

      await sub.test('No private table access and internal helpers uncallable',async()=>{
        const tables=['catalog','slots','revisions','inventory','placements'];
        for(const role of ['anon','authenticated']){
          for(const tbl of tables)for(const priv of ['SELECT','INSERT','UPDATE','DELETE']){
            const rows=await sql('select has_table_privilege($1,$2,$3) v',[role,'games.pepegochi_room_'+tbl,priv]);
            assert.equal(rows[0].v,false,role+' '+priv+' '+tbl);
          }
          for(const fn of ['games.pepegochi_room_view(uuid)','games.pepegochi_room_can_edit(uuid)']){
            const rows=await sql('select has_function_privilege($1,$2,$3) v',[role,fn,'EXECUTE']);
            assert.equal(rows[0].v,false,role+' '+fn);
          }
        }
      });

      await sub.test('Only 4 public methods with no grant, item ID or user ID',async()=>{
        const rows=await sql(`select p.proname,pg_get_function_identity_arguments(p.oid) args,p.prosecdef,p.proconfig
          from pg_proc p join pg_namespace n on n.oid=p.pronamespace
          where n.nspname='public' and p.proname like 'gry_pepegochi_room_%' order by p.proname`);
        assert.deepEqual(rows.map(x=>[x.proname,x.args]),[
          ['gry_pepegochi_room_initialize',''],
          ['gry_pepegochi_room_place','p_item_instance_id uuid, p_slot_id text, p_expected_revision bigint'],
          ['gry_pepegochi_room_state',''],
          ['gry_pepegochi_room_unplace','p_slot_id text, p_expected_revision bigint']]);
        for(const x of rows){assert.equal(x.prosecdef,true);assert.deepEqual(x.proconfig,['search_path=""']);}
      });

      await sub.test('Read only does not seed inventory',async()=>{
        const s=await ok(1,'gry_pepegochi_room_state()');
        assert.equal(s.initialized,false);assert.equal(s.slots.length,11);
        assert.equal(s.inventory.length,0);
        const rows=await sql('select count(*)::int n from games.pepegochi_room_inventory where user_id=$1',[uid(1)]);
        assert.equal(rows[0].n,0);
      });

      await sub.test('First adoption and init grant precisely 6 starters once',async()=>{
        await ok(1,"gry_pepegochi_adopt($1)",['Room Fren']);
        await ok(2,"gry_pepegochi_adopt($1)",['Other Fren']);
        let s=await ok(1,'gry_pepegochi_room_initialize()');
        assert.equal(s.initialized,true);assert.equal(s.revision,1);
        assert.equal(s.inventory.length,6);assert.equal(s.placements.length,6);
        const ids=s.inventory.map(x=>x.item_id).sort();
        assert.deepEqual(ids,['crt_tv','lava_lamp','mug','p_poster','potted_plant','rubber_duck']);
        const again=await ok(1,'gry_pepegochi_room_initialize()');
        assert.deepEqual(again,s,'initialize does not reset a room');
        const s2=await ok(2,'gry_pepegochi_room_initialize()');
        assert.equal(s2.inventory.length,6);
        const e=await sql('select count(*)::int n from games.pepegochi_room_inventory where item_id=$1',['moon_rock']);
        assert.equal(e[0].n,0,'Moon Rock never automatically granted');
      });

      await sub.test('Ownership and category validation reject forged item or slot',async()=>{
        let s=await ok(1,'gry_pepegochi_room_state()');
        const tv=s.inventory.find(x=>x.item_id==='crt_tv');
        const other=(await ok(2,'gry_pepegochi_room_state()')).inventory.find(x=>x.item_id==='crt_tv');
        const wrongOwner=await rpc(1,'gry_pepegochi_room_place($1,$2,$3)',[other.item_instance_id,'tv_stand',s.revision]);
        assert.equal(wrongOwner.ok,false);assert.equal(wrongOwner.code,'42501');
        const invalid=await rpc(1,'gry_pepegochi_room_place($1,$2,$3)',[tv.item_instance_id,'shelf_a',s.revision]);
        assert.equal(invalid.ok,false);assert.equal(invalid.code,'22023');
        const bogus=await rpc(1,'gry_pepegochi_room_place($1,$2,$3)',[tv.item_instance_id,'arbitrary_1',s.revision]);
        assert.equal(bogus.ok,false);
        s=await ok(1,'gry_pepegochi_room_state()');assert.equal(s.revision,1);
      });

      await sub.test('Move and unplace update room, never inventory; stale revision blocked',async()=>{
        const orig=await ok(1,'gry_pepegochi_room_state()');
        const mug=orig.inventory.find(x=>x.item_id==='mug');
        const next=await ok(1,'gry_pepegochi_room_place($1,$2,$3)',[mug.item_instance_id,'shelf_a',orig.revision]);
        assert.equal(next.revision,2);
        assert.equal(next.placements.find(x=>x.item_instance_id===mug.item_instance_id).slot_id,'shelf_a');
        assert.equal(next.placements.some(x=>x.slot_id==='table_top'),false);
        const stale=await rpc(1,'gry_pepegochi_room_unplace($1,$2)',['shelf_a',orig.revision]);
        assert.equal(stale.ok,false);assert.match(stale.error,/ROOM_REVISION_CONFLICT/);
        const cleared=await ok(1,'gry_pepegochi_room_unplace($1,$2)',['shelf_a',next.revision]);
        assert.equal(cleared.revision,3);assert.equal(cleared.inventory.length,6);
        assert.equal(cleared.placements.some(x=>x.item_instance_id===mug.item_instance_id),false);
        const noop=await ok(1,'gry_pepegochi_room_unplace($1,$2)',['shelf_a',cleared.revision]);
        assert.equal(noop.revision,3,'no revision increment on empty slot');
      });

      await sub.test('Two accounts stay independent, saved room survives departure/adoption',async()=>{
        const before=await ok(1,'gry_pepegochi_room_state()');
        const bob=await ok(2,'gry_pepegochi_room_state()');
        await ok(1,'gry_pepegochi_letter_read()',[],t(200));
        const departed=await ok(1,'gry_pepegochi_room_state()',[],t(200));
        assert.deepEqual(departed,before,'room inventory survives departure');
        const locked=await rpc(1,'gry_pepegochi_room_unplace($1,$2)',['tv_stand',before.revision],t(200));
        assert.equal(locked.ok,false,'cannot edit when frog has left');
        await ok(1,'gry_pepegochi_adopt($1)',['New Room Fren'],t(201));
        const after=await ok(1,'gry_pepegochi_room_state()',[],t(201));
        assert.deepEqual(after,before,'new life sees same objects and placements');
        assert.deepEqual(await ok(2,'gry_pepegochi_room_state()',[],t(201)),bob,'other account unchanged');
      });

      await sub.test('Migration is safe to re-run (does not reseed deleted placement)',async()=>{
        const before=await ok(1,'gry_pepegochi_room_state()');
        await db.exec(await migrate());
        const after=await ok(1,'gry_pepegochi_room_state()');
        assert.deepEqual(after,before);
      });

      await sub.test('Concurrent init creates exactly one set of starter instances',async()=>{
        await user(4);await ok(4,"gry_pepegochi_adopt($1)",['Concurrent']);
        const cs=await Promise.all(Array.from({length:8},connect));
        try{
          const results=await Promise.all(cs.map(c=>callRpc(asDb(c),{user:4,now:t()},'public.gry_pepegochi_room_initialize()')));
          assert.ok(results.every(x=>x.ok),results.map(x=>x.error).filter(Boolean).join(','));
          const rows=await sql('select count(*)::int n from games.pepegochi_room_inventory where user_id=$1',[uid(4)]);
          assert.equal(rows[0].n,6);
          const state=await ok(4,'gry_pepegochi_room_state()');
          assert.equal(state.placements.length,6);assert.equal(state.revision,1);
        }finally{await Promise.all(cs.map(c=>c.end()));for(const c of cs){clients.splice(clients.indexOf(c),1)}}
      });
    }finally{
      for(const c of clients)await c.end().catch(()=>{});
      await admin.query('drop database '+name+' with (force)');
      await admin.end();
    }
});