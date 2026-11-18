import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { caseView, validCaseAnswer, createCaseClient } from '../docs/meme/pepegochi-case-files.mjs';
import { buildCaseSql, normalizeAnswer, validateCase } from '../scripts/build_pond_case_sql.mjs';
const ACTIVE = {status:'active',title:'Fixture case',intro:'Test intro',completed:0,total:3,step:1,step_title:'Fixture stage',clue:'Fake clue',hint:null,retry_after:0};
const COMPLETE = {status:'complete',title:'Fixture case',completed:3,total:3,message:'Fixture message',credit:'Fixture author'};
const ID = '00000000-0000-4000-8000-000000000002';
const SAMPLE = {title:'Test dossier',intro:"Fake intro with 'quotes' and \\slash",final_message:null,final_credit:null,steps:[1,2,3].map(i=>({title:`Fake stage ${i}`,clue:`Fake clue ${i}`,hint:`Fake hint ${i}`,answer:`fixturekey${i}`}))};
test('strict case projection never exposes extra fields or the final message before completion',()=>{
  assert.deepEqual(caseView({...ACTIVE,answer_hash:'private',message:'private',steps:['private']}),{status:'active',title:'Fixture case',intro:'Test intro',completed:0,total:3,step:1,stepTitle:'Fixture stage',clue:'Fake clue',hint:null,retryAfter:0});
  assert.deepEqual(caseView({...COMPLETE,answer_hash:'private'}),COMPLETE);
  assert.equal(caseView({...COMPLETE,completed:2}),null);
  assert.equal(caseView({...ACTIVE,step:2}),null);
  assert.equal(caseView({...ACTIVE,retry_after:901}),null);
  assert.deepEqual(caseView({status:'closed',message:'private'}),{status:'closed'});
});
test('answer format is forgiving but bounded and shared with seed normalization',()=>{
  assert.equal(normalizeAnswer(' FiXture-KEY, 123 '),'fixturekey123');
  assert.ok(validCaseAnswer(' FiXture-KEY, 123 '));
  for(const bad of ['','a','12','漢字abc','a'.repeat(81),'!@#$%^&*']) assert.equal(validCaseAnswer(bad),false);
});
test('client uses only authenticated case RPCs, no account parameter and no calls until requested',async()=>{
  const calls=[]; let user='a';
  const client=createCaseClient({session:()=>user?{discord:true,userId:user}:null,rpc:async(name,args)=>{calls.push([name,args]);return name.endsWith('_answer')?{outcome:'correct',state:{...ACTIVE,completed:1,step:2}}:ACTIVE}});
  assert.deepEqual(calls,[]); assert.equal((await client.read(true)).status,'ok');
  assert.equal((await client.answer(1,'fixturekey1',ID)).view.step,2);
  assert.deepEqual(calls,[['gry_pond_case_state',{p_hint:true}],['gry_pond_case_answer',{p_step:1,p_answer:'fixturekey1',p_request:ID}]]);
  assert.equal((await client.answer(1,'?',ID)).status,'invalid');user=null;assert.equal((await client.read()).status,'signed-out');assert.equal(calls.length,2);
});
test('closed, failed and late responses are distinct; account/life switch discards the response',async()=>{
  let user='a', resolve;
  const client=createCaseClient({session:()=>({discord:true,userId:user}),rpc:()=>new Promise(r=>resolve=r)});
  const a=client.read();user='b';resolve(ACTIVE);assert.equal((await a).status,'stale');
  const b=client.answer(1,'fixturekey1',ID);client.invalidate();resolve({outcome:'correct',state:COMPLETE});assert.equal((await b).status,'stale');
  const c=client.read();resolve({status:'closed'});assert.deepEqual((await c).view,{status:'closed'});
});
test('seed is always disabled, salted, safely quoted and refuses replacing an active or played case',()=>{
  assert.deepEqual(validateCase(SAMPLE),[]);assert.ok(validateCase({...SAMPLE,final_message:'message without credit'}).length);
  const salt='a'.repeat(64), sql=buildCaseSql(SAMPLE,()=>salt);
  assert.match(sql,/values \(1,false,/);assert.doesNotMatch(sql,/fixturekey[123]/);assert.ok(sql.includes(createHash('sha256').update(salt+':fixturekey1').digest('hex')));
  assert.ok(sql.includes("''quotes''"));assert.match(sql,/lock table pond_case_private\.campaign in access exclusive mode/i);
  assert.match(sql,/Case already enabled or played/);assert.throws(()=>buildCaseSql({...SAMPLE,steps:[]}),/3–12/);
});
test('public schema is empty and has only owner-bound wrappers; final reward is transactional',()=>{
  const sql=readFileSync(new URL('../games/supabase/update_pond_case_files.sql',import.meta.url),'utf8');
  const catalog=JSON.parse(readFileSync(new URL('../docs/meme/passport-catalog.json',import.meta.url),'utf8'));
  assert.equal(catalog.secrets.find(s=>s.id==='founders_letter').status,'planned');
  assert.doesNotMatch(sql,/insert into pond_case_private\.(campaign|steps)/i);assert.match(sql,/revoke all on all tables in schema pond_case_private from public, anon, authenticated/);
  for(const name of ['campaign','steps','progress'])assert.match(sql,new RegExp('alter table pond_case_private\\.'+name+' enable row level security'));
  assert.equal((sql.match(/u uuid := auth\.uid\(\)/g)||[]).length,2);assert.match(sql,/where user_id = u for update/);
  assert.match(sql,/p_step <> p\.completed \+ 1/);assert.match(sql,/p\.wrong_count >= 5/);assert.match(sql,/interval '15 minutes'/);assert.match(sql,/on conflict \(user_id, secret_id\) do nothing/);
  assert.match(sql,/if correct and p\.completed = c\.stage_count then/);
  assert.match(sql,/function public\.gry_pond_case_state\(p_hint boolean default false\)\s+returns jsonb language sql volatile security invoker/);
  assert.doesNotMatch(sql,/function public\.gry_pond_case[^\n]*p_user/);
  const legacy=readFileSync(new URL('../games/supabase/update_fren_passport.sql',import.meta.url),'utf8');assert.doesNotMatch(legacy,/founders_letter/);
});
