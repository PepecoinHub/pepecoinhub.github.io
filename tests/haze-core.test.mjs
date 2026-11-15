import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyWalletProof,verifyTipTransaction,pepScript} from '../games/supabase/functions/haze-wallet/core.mjs';
import {handleHaze} from '../games/supabase/functions/haze-wallet/handler.mjs';
import {amountAtomic,formatAtomic,tipURL,submissionMatches,createHazeTips} from '../docs/games/js/haze-tips.mjs';

const fixture=JSON.parse(readFileSync(new URL('fixtures/haze-proof.json',import.meta.url)));
const {proof,challenge,recipient}=fixture,now=Date.parse(challenge.issuedAt)+1000;
const txid='ab'.repeat(32),parentid='cd'.repeat(32),block='ef'.repeat(32);
const intent={id:'00000000-0000-4000-8000-000000000001',sender:proof.address,address:recipient,amount_atomic:'1000000000',
  txid,created_at:challenge.issuedAt,expires_at:new Date(now+1800000).toISOString()};
const transaction=()=>({txid,confirmations:2,blockHash:block,blockTime:Math.floor(now/1000)+10,
  vin:[{txid:parentid,vout:0}],vout:[{n:0,value:'1000000000',hex:pepScript(recipient)},{n:1,value:'990000000',hex:pepScript(proof.address)}]});
const readTx=async id=>({txid:id,vout:[{n:0,value:'2000000000',hex:pepScript(proof.address)}]});

test('actual Haze signer fixture verifies with independent server cryptography; substitutions and replay contexts fail',()=>{
  assert.equal(verifyWalletProof(proof,challenge,now),proof.address);
  for(const patch of [{signature:'00'.repeat(64)},{address:recipient},{audience:'https://evil.example'},{nonce:'0'.repeat(64)},
    {purpose:'Sign in to TokenPrinter Lagoon'},{network:'ethereum'},{autoApprove:true}])assert.throws(()=>verifyWalletProof({...proof,...patch},challenge,now));
  assert.throws(()=>verifyWalletProof(proof,challenge,Date.parse(challenge.expiresAt)));
  assert.throws(()=>pepScript(proof.address.slice(0,-1)+'1'));
});

test('exact native payment, every funding prevout and two confirmations are required',async()=>{
  assert.deepEqual(await verifyTipTransaction(intent,transaction(),readTx),{state:'confirmed',vout:0,block,time:transaction().blockTime});
  for(const confirmations of [0,1])assert.equal((await verifyTipTransaction(intent,{...transaction(),confirmations},readTx)).state,'pending');
  for(const patch of [
    {txid:'00'.repeat(32)},{confirmations:-1},{blockHash:'bad'},{blockTime:Math.floor(now/1000)-1000},
    {vin:[{txid:parentid,vout:1}]},{vin:[{txid:parentid,vout:0},{txid:parentid,vout:0}]},
    {vout:[{n:0,value:'999999999',hex:pepScript(recipient)}]},
    {vout:[{n:0,value:1000000000,hex:pepScript(recipient)}]},
    {vout:[{n:0,value:'1000000000',hex:pepScript(proof.address)}]},
    {vout:[{n:0,value:'1000000000',hex:pepScript(recipient)},{n:0,value:'1',hex:pepScript(proof.address)}]},
  ])await assert.rejects(verifyTipTransaction(intent,{...transaction(),...patch},readTx));
  await assert.rejects(verifyTipTransaction(intent,transaction(),async()=>({txid:parentid,vout:[{n:0,value:'2000000000',hex:pepScript(recipient)}]})));
  await assert.rejects(verifyTipTransaction(intent,transaction(),async()=>({txid:'0'.repeat(64),vout:[]})));
  await assert.rejects(verifyTipTransaction(intent,transaction(),async()=>({txid:parentid,vout:[{n:0,value:'1000000000',hex:pepScript(proof.address)}]})));
});

test('native amount precision, URL binding and popup source/origin are enforced; disabled client is inert',()=>{
  assert.equal(amountAtomic('1.00000001'),'100000001');assert.equal(formatAtomic('100000001'),'1.00000001');
  for(const input of ['0','0.01','1e3','-1',' 10','1.000000001','100001'])assert.throws(()=>amountAtomic(input));
  const record={...intent,recipient:'<script>fren</script>',reaction:'heart',note:'Thanks!'};
  const url=new URL(tipURL(record)),params=new URLSearchParams(url.hash.slice(1));
  assert.equal(url.origin,'https://hazewallet.com');assert.equal(url.search,'');assert.equal(params.get('intent'),intent.id);assert.equal(params.get('sender'),proof.address);
  assert.equal(params.get('asset'),'PEP');assert.equal(params.get('recipient'),record.recipient);
  const popup={},flight={popup,intent};
  const event={origin:'https://hazewallet.com',source:popup,data:{type:'haze:tip-submitted',version:1,intent:intent.id,txid}};
  assert.equal(submissionMatches(event,flight),true);
  for(const patch of [{origin:'https://evil.example'},{source:{}},{data:{...event.data,intent:'different'}},{data:{...event.data,txid:'bad'}}])assert.equal(submissionMatches({...event,...patch},flight),false);
  assert.equal(createHazeTips({enabled:false}),null);
});

test('edge rejects unauthenticated, anonymous and wrong-origin requests before privileged calls',async()=>{
  const calls=[],deps={authenticate:async()=>null,rpc:async(...args)=>calls.push(args)};
  const request=(body={},headers={})=>new Request('https://fixture.invalid',{method:'POST',headers:{origin:'https://pepecoinhub.com',...headers},body:JSON.stringify(body)});
  assert.equal((await handleHaze(request(),deps)).status,401);
  assert.equal((await handleHaze(request({}, {origin:'https://evil.example'}),deps)).status,403);
  assert.equal((await handleHaze(request({}, {authorization:'Bearer fixture-token-123456'}),deps)).status,403);
  const guest={...deps,authenticate:async()=>({id:'someone',is_anonymous:true,identities:[{provider:'discord'}]})};
  assert.equal((await handleHaze(request({}, {authorization:'Bearer fixture-token-123456'}),guest)).status,403);
  assert.deepEqual(calls,[]);
});

test('edge pins mainnet and never commits pending payments or forged ownership proofs',async()=>{
  const calls=[],user={id:'owner',is_anonymous:false,identities:[{provider:'discord'}]};
  const req=body=>new Request('https://fixture.invalid',{method:'POST',headers:{origin:'https://pepecoinhub.com',authorization:'Bearer fixture-token-123456'},body:JSON.stringify(body)});
  const deps={authenticate:async()=>user,now:()=>now,rpc:async(name,args)=>{calls.push(name);if(name==='haze_link_context')return challenge;if(name==='haze_tip_context')return intent;return {state:'confirmed'};},
    readGenesis:async()=> 'wrong-chain',readTx};
  assert.equal((await handleHaze(req({action:'check',intent:intent.id,txid}),deps)).status,400);
  assert.equal(calls.includes('haze_tip_confirm'),false);calls.length=0;
  await handleHaze(req({action:'link',proof:{...proof,signature:'00'.repeat(64)}}),deps);
  assert.deepEqual(calls,['haze_link_context']);calls.length=0;
  const pending={...deps,readGenesis:async()=> '37981c0c48b8d48965376c8a42ece9a0838daadb93ff975cb091f57f8c2a5faa',readTx:async()=>({...transaction(),confirmations:1})};
  const response=await handleHaze(req({action:'check',intent:intent.id,txid}),pending);
  assert.equal((await response.json()).state,'pending');assert.equal(calls.includes('haze_tip_confirm'),false);
});
