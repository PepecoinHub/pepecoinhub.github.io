import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {verifyGroupTransaction,pepScript,PEP_GENESIS} from '../games/supabase/functions/haze-wallet/core.mjs';
import {handleHaze} from '../games/supabase/functions/haze-wallet/handler.mjs';
const root=process.env.HAZE_WALLET_ROOT||path.resolve(fileURLToPath(new URL('../../../..',import.meta.url)));
const candidate=path.join(root,'outputs/pepecoinhub-groups-20261115/candidate');
if(fs.existsSync(path.join(candidate,'wallet-core.js'))){
const source=fs.readFileSync(path.join(candidate,'wallet-core.js'),'utf8').replace(/(\bfrom\s*|\bimport\s*\(\s*)(['"])(\.[^'"]+)\2/g,(_,prefix,quote,spec)=>prefix+quote+pathToFileURL(path.resolve(root,spec)).href+quote);
const coreURL='data:text/javascript;base64,'+Buffer.from(source).toString('base64'),wallet=await import(coreURL);
const protocolSource=fs.readFileSync(path.join(candidate,'assets/haze-group-tips.js'),'utf8').replace("'../wallet-core.js'",JSON.stringify(coreURL)).replace("'../haze-auth-protocol.js'",JSON.stringify(pathToFileURL(path.join(root,'haze-auth-protocol.js')).href));
const {readGroupTip,notifyGroupSubmission}=await import('data:text/javascript;base64,'+Buffer.from(protocolSource).toString('base64'));
const {walletLibraries}=await import(pathToFileURL(path.join(root,'vendor/wallet/_loader.js'))),libs=await walletLibraries(),B=libs.Buffer;
const sender=await wallet.createKey('PEP'),people=await Promise.all(Array.from({length:4},()=>wallet.createKey('PEP')));
const parent=new libs.Transaction();parent.addInput(B.alloc(32,12),0);parent.addOutput(B.from(await wallet.addressScript(sender.address,'PEP')),100000000000n);
const utxos=[{txid:parent.getId(),vout:0,amount:'100000000000',confirmations:6,rawHex:parent.toHex()}];
const payments=people.slice(0,3).map((p,n)=>({address:p.address,amount:String((n+1)*100000000)}));
const built=await wallet.buildSignedGroupSend({payments,utxos,wif:sender.wif,fromAddress:sender.address,feeRate:'1002'});
const decoded=libs.Transaction.fromHex(built.rawHex),now=Date.now(),block='cd'.repeat(32);
const intent={id:'00000000-0000-4000-8000-000000000001',sender:sender.address,total_atomic:'600000000',recipients:payments,created_at:new Date(now-1000).toISOString(),expires_at:new Date(now+1800000).toISOString(),txid:built.txid};
const tx={txid:built.txid,confirmations:2,blockHash:block,blockTime:Math.floor(now/1000),vin:decoded.ins.map(input=>({txid:B.from(input.hash).reverse().toString('hex'),vout:input.index})),vout:decoded.outs.map((out,n)=>({n,hex:B.from(out.script).toString('hex'),value:BigInt(out.value).toString()}))};
const readTx=async id=>({txid:id,vout:[{n:0,hex:pepScript(sender.address),value:'100000000000'}]});
test('the actual native group signer makes all exact outputs and only sender change; independent verifier accepts it',async()=>{
  assert.equal(built.amount,'600000000');assert.equal(built.outputs.length,4);assert.equal(built.changeAddress,sender.address);
  assert.deepEqual(built.outputs.filter(out=>!out.change).map(({address,amount})=>({address,amount})),payments);
  assert.ok(BigInt(built.fee)>=BigInt(built.rawHex.length/2)*1002n);
  const chunks=libs.script.decompile(decoded.ins[0].script),signature=libs.script.signature.decode(chunks[0]);
  assert.equal(libs.ECPair.fromPublicKey(B.from(chunks[1])).verify(decoded.hashForSignature(0,B.from(pepScript(sender.address),'hex'),signature.hashType),signature.signature),true);
  assert.deepEqual(await verifyGroupTransaction(intent,tx,readTx),{state:'confirmed',block,time:tx.blockTime});
  assert.equal((await verifyGroupTransaction(intent,{...tx,confirmations:1},readTx)).state,'pending');
});
test('missing, repeated, redirected and changed recipients, extra outputs, mixed funding and stale blocks are rejected',async()=>{
  const copies=[tx.vout.slice(1),[...tx.vout,{n:4,hex:'6a01ff',value:'0'}],tx.vout.map((o,n)=>n===0?{...o,value:'99999999'}:o),tx.vout.map((o,n)=>n===0?{...o,hex:pepScript(people[3].address)}:o),[...tx.vout,{n:4,hex:pepScript(sender.address),value:'1'}]];
  for(const vout of copies)await assert.rejects(verifyGroupTransaction(intent,{...tx,vout},readTx));
  await assert.rejects(verifyGroupTransaction(intent,{...tx,blockTime:0},readTx));
  await assert.rejects(verifyGroupTransaction(intent,tx,async id=>({txid:id,vout:[{n:0,hex:pepScript(people[0].address),value:'100000000000'}]})));
  await assert.rejects(wallet.planGroupSend({payments:[payments[0],payments[0]],utxos}));
  await assert.rejects(wallet.planGroupSend({payments:[{address:people[0].address,amount:'1'}],utxos}));
  await assert.rejects(wallet.buildSignedGroupSend({payments:[{address:sender.address,amount:'100000000'}],utxos,wif:sender.wif,fromAddress:sender.address}));
  await assert.rejects(wallet.buildSignedGroupSend({payments,utxos,wif:people[0].wif,fromAddress:sender.address}));
});

test('Haze group review binds exact public fields, sender, recipients and expiry; callback discloses only the submission',async()=>{
  const raw={id:intent.id,sender:intent.sender,title:'Party in the pond',mode:'all',note:'Thanks frens',total_atomic:intent.total_atomic,created_at:intent.created_at,expires_at:intent.expires_at,recipients:payments.map((p,n)=>({...p,nick:'Fren'+n}))};
  const checked=await readGroupTip(raw);assert.equal(Object.isFrozen(checked),true);assert.equal(Object.isFrozen(checked.recipients[0]),true);
  for(const patch of [{approve:true},{total_atomic:'600000001'},{sender:payments[0].address},{expires_at:new Date(now-1).toISOString()},{expires_at:new Date(now+3600000).toISOString()},{title:'misleading\u202Etitle'},{recipients:[raw.recipients[0],raw.recipients[0]]},{recipients:[{...raw.recipients[0],amount:'1'}]},{recipients:[{...raw.recipients[0],address:raw.recipients[0].address.slice(0,-1)+'0'}]}])await assert.rejects(readGroupTip({...raw,...patch}));
  const sent=[],parent={postMessage:(...args)=>sent.push(args)};assert.equal(notifyGroupSubmission(checked,built,{parent}),true);
  assert.deepEqual(sent,[[{type:'haze:tip-submitted',version:1,intent:intent.id,txid:built.txid},'https://pepecoinhub.com']]);
  assert.equal(notifyGroupSubmission(checked,{...built,outputs:built.outputs.slice(1)},{parent}),false);assert.equal(sent.length,1);
});

test('maximum 200-recipient transaction is signed, precisely funded, verified and bounded',async()=>{
  const many=await Promise.all(Array.from({length:200},()=>wallet.createKey('PEP'))),batch=many.map(p=>({address:p.address,amount:'100000000'}));
  const signed=await wallet.buildSignedGroupSend({payments:batch,utxos,wif:sender.wif,fromAddress:sender.address,feeRate:'1002'}),raw=libs.Transaction.fromHex(signed.rawHex);
  assert.equal(raw.outs.length,201);assert.equal(signed.amount,'20000000000');assert.ok(BigInt(signed.fee)>=BigInt(signed.rawHex.length/2)*1002n);
  const candidate={...tx,txid:signed.txid,vout:raw.outs.map((o,n)=>({n,hex:B.from(o.script).toString('hex'),value:BigInt(o.value).toString()}))};
  assert.equal((await verifyGroupTransaction({...intent,txid:signed.txid,total_atomic:signed.amount,recipients:batch},candidate,readTx)).state,'confirmed');
  await assert.rejects(wallet.planGroupSend({payments:[...batch,payments[0]],utxos}));
});
}else test('actual Haze group signer (requires the separate Haze checkout)',{skip:true},()=>{});

const fixture=JSON.parse(fs.readFileSync(new URL('fixtures/haze-proof.json',import.meta.url),'utf8'));
const now=Date.parse(fixture.challenge.issuedAt)+1000,txid='ab'.repeat(32),parent='cd'.repeat(32),block='ef'.repeat(32);
const payments=[{address:fixture.recipient,amount:'600000000'}];
const intent={id:'00000000-0000-4000-8000-000000000001',sender:fixture.proof.address,total_atomic:'600000000',recipients:payments,created_at:fixture.challenge.issuedAt,expires_at:new Date(now+1800000).toISOString(),txid};
const tx={txid,confirmations:2,blockHash:block,blockTime:Math.floor(now/1000),vin:[{txid:parent,vout:0}],vout:[{n:0,hex:pepScript(fixture.recipient),value:'600000000'},{n:1,hex:pepScript(fixture.proof.address),value:'300000000'}]};
const readTx=async id=>({txid:id,vout:[{n:0,hex:pepScript(fixture.proof.address),value:'1000000000'}]});

test('portable group verifier enforces exact splits, recipients, funding and limits',async()=>{
  assert.equal((await verifyGroupTransaction(intent,tx,readTx)).state,'confirmed');
  for(const recipients of [[],[...payments,...payments],[{...payments[0],amount:'1'}],[{...payments[0],address:intent.sender}],Array(201).fill(payments[0])])await assert.rejects(verifyGroupTransaction({...intent,recipients},tx,readTx));
  await assert.rejects(verifyGroupTransaction({...intent,total_atomic:'700000000'},tx,readTx));
  await assert.rejects(verifyGroupTransaction(intent,{...tx,vout:[...tx.vout,{n:2,hex:'6a',value:'0'}]},readTx));
  await assert.rejects(verifyGroupTransaction(intent,tx,async id=>({txid:id,vout:[{n:0,hex:pepScript(fixture.recipient),value:'1000000000'}]})));
});

test('group Edge checks use the private manifest and never credit pending, wrong-chain, anonymous or caller-supplied recipients',async()=>{
  const calls=[],request=body=>new Request('https://fixture.invalid',{method:'POST',headers:{Origin:'https://pepecoinhub.com',Authorization:'Bearer synthetic-group-test-token'},body:JSON.stringify(body)});
  const deps={authenticate:async()=>({id:'sender',is_anonymous:false,identities:[{provider:'discord'}]}),rpc:async(name,args)=>{calls.push(name);return name==='haze_group_context'?intent:{state:'confirmed'};},readGenesis:async()=>PEP_GENESIS,readTx:async id=>id===tx.txid?{...tx,confirmations:0}:readTx(id)};
  const body={action:'group-check',intent:intent.id,txid:tx.txid};
  assert.equal((await(await handleHaze(request(body),deps)).json()).state,'pending');assert.deepEqual(calls,['haze_group_context']);calls.length=0;
  assert.equal((await handleHaze(request({...body,recipients:payments}),deps)).status,400);assert.deepEqual(calls,[]);
  assert.equal((await handleHaze(request(body),{...deps,readGenesis:async()=>'00'.repeat(32)})).status,400);assert.equal(calls.includes('haze_group_confirm'),false);
  assert.equal((await handleHaze(request(body),{...deps,authenticate:async()=>({is_anonymous:true})})).status,403);
});
