'use strict';
// PondOS chat (messageTips:false): no 💚 Tip on messages, the fren card asks tipFor() instead; /airdrop starts a
// long airdrop; a tip to me throws a small party; the Haze window uses the PondOS 98 look.
// Simulated services only: no Haze page, Supabase, chain or payment is contacted.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.join(__dirname,'..','docs');let server,browser;
(async()=>{
  const html=`<!doctype html><html class="pondos"><meta charset="utf-8"><link rel="stylesheet" href="/meme/meme.css"><body style="padding:20px"><div id="wallet"></div><div id="log" style="height:300px;overflow:auto"></div><form><input id="chatin"></form><script type="module">
  import {createHazeTips} from '/games/js/haze-tips.mjs';
  const me='00000000-0000-4000-8000-000000000001',jules='00000000-0000-4000-8000-000000000002',mika='00000000-0000-4000-8000-000000000003';
  const notes=[],calls=[];let receipts=[];
  const rpc=async(name,args)=>{calls.push([name,args]);
    if(name==='gry_haze_status')return {enabled:true,address:'PAvt4R4pWiqwStNNSb4ZjUQXJN3mZCLqtX',pending:[]};
    if(name==='gry_haze_chat')return {linked_users:[jules],receipts};
    if(name==='gry_haze_groups')return {now:new Date().toISOString(),member_count:3,members:[],drops:[]};
    if(name==='gry_haze_group_create')return {id:'00000000-0000-4000-8000-0000000000aa',state:'open'};
    return {};};
  const api=createHazeTips({rpc,invoke:async()=>({}),session:()=>({user:{id:me,is_anonymous:false}}),login:()=>{},notify:(t,ok)=>notes.push([t,!!ok]),chatLog:document.getElementById('log'),chatInput:document.getElementById('chatin'),messageTips:false,enabled:true});
  api.mount(document.getElementById('wallet'));
  const add=(id,user_id,nick)=>{const row=document.createElement('p');row.textContent=nick+': gm';document.getElementById('log').append(row);api.bindMessage(row,{id,user_id,nick,verified:true});};
  add(1,jules,'Jules');add(2,me,'Byl');add(3,mika,'Mika');
  window.t={api,notes,calls,me,jules,mika,setReceipts:r=>{receipts=r;}};
  </script>`;
  server=http.createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html'});res.end(html);return;}
    const file=path.join(root,url.pathname);
    if(!file.startsWith(root)||!/\.(mjs|css|svg)$/.test(file)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/javascript'});res.end(fs.readFileSync(file));
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:process.env.HAZE_CHROMIUM});
  const page=await browser.newPage({viewport:{width:420,height:820}}),errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===base)return route.continue();external.push(u.href);return route.abort();});
  await page.goto(base+'/');await page.waitForFunction(()=>window.t);
  await page.evaluate(async()=>{window.t.api.invalidate();await window.t.api.sync();});
  assert.equal(await page.locator('.haze-message-tip').count(),0,'no Tip button on messages');
  assert.deepEqual(await page.evaluate(()=>[window.t.jules,window.t.me,window.t.mika,'00000000-0000-4000-8000-000000000009'].map(u=>window.t.api.tipFor(u).state)),['linked','self','unlinked','none']);
  await page.evaluate(()=>window.t.api.tipFor(window.t.jules).open());
  await page.getByRole('heading',{name:/Jules/}).waitFor();
  await page.screenshot({path:'/tmp/haze-fren-tip-dialog.png'});
  await page.getByRole('button',{name:'Close Haze dialog'}).click();
  // /tip with "pepe" at the end, and /airdrop for 600 minutes
  assert.equal(await page.evaluate(()=>window.t.api.command('/tip jules 500 pepe')),'opened');
  assert.equal(await page.getByLabel('Tip amount in native PEP').inputValue(),'500');
  await page.getByRole('button',{name:'Close Haze dialog'}).click();
  assert.equal(await page.evaluate(()=>window.t.api.command('/airdrop 500 pepe 600m')),'opened');
  await page.waitForFunction(()=>window.t.calls.some(c=>c[0]==='gry_haze_group_create'));
  assert.deepEqual(await page.evaluate(()=>window.t.calls.find(c=>c[0]==='gry_haze_group_create')[1].p_options),{mode:'airdrop',audience:'all',total_atomic:'50000000000',seconds:36000,title:'',note:''});
  await page.waitForFunction(()=>window.t.notes.some(n=>/Airdrop live: 500 PEP for 10 hours/.test(n[0])&&n[1]));
  assert.equal(await page.evaluate(()=>window.t.api.command('/airdrop 500 pepe 700m')),'error');
  // Group tips window: airdrop lengths 15–600 minutes
  await page.getByRole('button',{name:/Group tips/}).click();
  await page.getByLabel('Group tip mode').selectOption('airdrop');
  assert.deepEqual(await page.getByLabel('Round duration').evaluate(s=>[...s.options].map(o=>o.value)),['900','1800','3600','10800','21600','36000']);
  await page.screenshot({path:'/tmp/haze-group-dialog.png'});
  await page.getByLabel('Group tip mode').selectOption('trivia');
  assert.deepEqual(await page.getByLabel('Round duration').evaluate(s=>[...s.options].map(o=>o.value)),['15','60','300']);
  await page.getByRole('button',{name:'Close Haze dialog'}).click();
  // a confirmed tip to me: banner and coins, once
  await page.evaluate(async()=>{window.t.setReceipts([{id:'00000000-0000-4000-8000-0000000000bb',state:'confirmed',txid:'ab'.repeat(32),reaction:'heart',message_id:2,sender:'Jules',recipient:'Byl',amount_atomic:'50000000000'}]);window.t.api.invalidate();await window.t.api.sync();});
  await page.locator('.haze-party-banner').waitFor();
  assert.match(await page.locator('.haze-party-banner').innerText(),/\+500 PEP[\s\S]*from Jules/);
  assert.ok(await page.locator('.haze-party-coin').count()>0);
  assert.match(await page.locator('.haze-party-coin').first().evaluate(el=>getComputedStyle(el).backgroundImage),/coin-p\.svg/);
  await page.waitForTimeout(700);await page.screenshot({path:'/tmp/haze-party.png'});
  await page.locator('.haze-party').waitFor({state:'detached',timeout:6000});
  await page.evaluate(async()=>{document.querySelector('.haze-chat-receipt').remove();window.t.api.invalidate();await window.t.api.sync();});
  assert.equal(await page.locator('.haze-party').count(),0,'one party per tip');
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  console.log('PASS: fren card tipping (no message buttons), /tip … pepe, /airdrop 600m, airdrop lengths, recipient party. Simulated services only.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server?.close();});
