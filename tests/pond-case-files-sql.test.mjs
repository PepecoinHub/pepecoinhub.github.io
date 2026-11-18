// Run only against a disposable local PostgreSQL. Never point this fixture at hosted Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pondDb, addUser, caller, SKIP } from './pond-sql-setup.mjs';
import { buildCaseSql } from '../scripts/build_pond_case_sql.mjs';
const sample={title:'Fixture',intro:'Test only',final_message:'Fixture ending',final_credit:'Test author',steps:[1,2,3].map(i=>({title:`Fixture ${i}`,clue:`Fixture clue ${i}`,hint:`Fixture hint ${i}`,answer:`fixture-${i}-key`}))};
test('private quest real SQL: isolation, ordered stages, retries, rate limits and atomic final award', {skip:SKIP,timeout:120000},async()=>{
  const f=await pondDb('pondcase',[]), db=f.db;
  try {
    await db.query(`create function games.passport_open() returns boolean language sql as $$ select true $$;
    create table games.passport_secrets(user_id uuid references auth.users(id),secret_id text,primary key(user_id,secret_id));`);
    const migration=await readFile(new URL('../games/supabase/update_pond_case_files.sql',import.meta.url),'utf8');
    await db.query(migration);await db.query(migration); // idempotent DDL
    const a=await addUser(db,1,'Fren A'), b=await addUser(db,2,'Fren B'), guest=await addUser(db,3,null);
    const call=caller(db), state=(who,hint=false)=>call({user:who},'select public.gry_pond_case_state($1) v',[hint]);
    const answer=(who,step,key,id=randomUUID(),c=call)=>c({user:who},'select public.gry_pond_case_answer($1,$2,$3) v',[step,key,id]);
    assert.deepEqual(await state(a),{status:'closed'});
    await assert.rejects(state(guest),/Discord sign-in required/);await assert.rejects(state(null),/permission denied/);
    await db.query(buildCaseSql(sample));assert.deepEqual(await state(a),{status:'closed'});
    await db.query('update pond_case_private.campaign set enabled=true');
    await assert.rejects(call({user:a},'select answer_hash v from pond_case_private.steps'),/permission denied/);
    await assert.rejects(call({user:a},'select pond_case_private.view_for($1,false) v',[b]),/permission denied/);
    await assert.rejects(call({user:a},'select completed v from pond_case_private.progress'),/permission denied/);
    const initial=await state(a);assert.equal(initial.step,1);assert.equal(initial.hint,null);assert.equal(initial.message,undefined);assert.equal(initial.answer_hash,undefined);assert.equal((await state(a,true)).hint,'Fixture hint 1');
    const skip=await answer(a,2,'fixture-2-key');assert.equal(skip.outcome,'stale');assert.equal(skip.state.step,1);
    const cooldown=async()=>db.query("update pond_case_private.progress set last_attempt_at=clock_timestamp()-interval '3 sec' where user_id=$1",[a]);
    const id=randomUUID();assert.equal((await answer(a,1,'wrong-key',id)).outcome,'wrong');assert.equal((await answer(a,1,'wrong-key',id)).outcome,'wrong');
    assert.equal((await answer(a,1,'fixture-1-key')).outcome,'rate_limited');
    for(let i=0;i<4;i++){await cooldown();assert.equal((await answer(a,1,'wrong-key')).outcome,'wrong');}
    await cooldown();assert.equal((await answer(a,1,'fixture-1-key')).outcome,'rate_limited');assert.equal((await state(b)).step,1);
    await db.query("update pond_case_private.progress set window_started=clock_timestamp()-interval '16 minutes' where user_id=$1",[a]);
    const r1=await answer(a,1,'Fixture 1 Key');assert.equal(r1.outcome,'correct');assert.equal(r1.state.step,2);assert.equal(r1.state.message,undefined);
    await cooldown();assert.equal((await answer(a,2,'fixture-2-key')).state.step,3);
    await cooldown();const other=await f.connect();
    try {
      const results=await Promise.all([answer(a,3,'fixture-3-key'),answer(a,3,'fixture-3-key',randomUUID(),caller(other))]);
      assert.deepEqual(results.map(r=>r.outcome).sort(),['correct','stale']);
      assert.ok(results.every(r=>r.state.status==='complete'&&r.state.message==='Fixture ending'));
    } finally {await other.end();}
    assert.equal((await db.query("select count(*) n from games.passport_secrets where user_id=$1 and secret_id='founders_letter'",[a])).rows[0].n,'1');
    assert.equal((await state(b)).message,undefined);assert.equal((await state(b)).step,1);
    assert.equal((await state(a)).credit,'Test author');
  } finally {await f.drop();}
});
