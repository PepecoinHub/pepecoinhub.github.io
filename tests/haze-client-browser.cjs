'use strict';
// Local demonstration harness. No Supabase requests, real wallet or real funds.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),output=process.env.HAZE_PH_QA_OUTPUT||path.resolve(root,'../preview');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/haze-proof.json'),'utf8'));
let server,browser;
(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PepecoinHub × Haze · simulated preview</title>
  <style>*{box-sizing:border-box}body{margin:0;background:#164d45;color:#15251f;font:14px system-ui}.simulation{background:#ffdb7a;color:#332500;font-weight:bold;padding:9px;text-align:center;font-size:12px}.desktop{max-width:1040px;margin:38px auto;padding:0 16px}.mast{color:#e5fff3;display:flex;justify-content:space-between;gap:18px;align-items:end;margin-bottom:24px}.mast h1{font-size:30px;letter-spacing:-1px;margin:0}.mast p{font-size:12px;margin:5px 0}.window{background:#e5e7dc;border:2px solid #8b9f8c;box-shadow:6px 7px 0 #08372e;border-radius:4px;padding:5px}.bar{background:linear-gradient(90deg,#164f51,#2e8373);color:#fff;padding:9px 12px;display:flex;justify-content:space-between;font-weight:bold}.tools{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:12px;font-size:12px;border-bottom:1px solid #9caf9c}.chat{min-height:320px;padding:20px 14px}.message{margin:0 0 25px;line-height:1.7}.time{font-size:11px;color:#557362;margin-right:8px}.name{font-weight:750;margin-right:5px}.message>p{margin:4px 0 0 48px}.composer{padding:12px;display:flex;gap:8px;border-top:1px solid #9caf9c}.composer input{flex:1;min-width:0;padding:9px;font:inherit;background:#fff;border:1px solid #96a38d}.composer button{padding:8px 17px;background:#d2e5b9;border:1px solid #729361}.foot{color:#d3e9d6;font-size:11px;text-align:center;margin:20px 0}.haze-chat-receipt{margin-left:45px}.haze-wallet-link{white-space:nowrap}@media(max-width:500px){.desktop{margin:18px auto;padding:0 9px}.mast{display:block}.mast h1{font-size:25px}.tools{align-items:start}.chat{padding:15px 8px}.message>p,.haze-chat-receipt{margin-left:0}.bar{font-size:12px}}</style>
  <body><div class="simulation">SIMULATED LOCAL PREVIEW · no real funds or Supabase connection</div><main class="desktop"><div class="mast"><div><h1>PepecoinHub × Haze</h1><p>A little appreciation for your pond frens.</p></div><p>Wallets stay with their owners.</p></div><section class="window"><div class="bar"><span>🐸 LAN Party — #pond</span><span>− □ ×</span></div><div class="tools"><span>● 12 frens online · Native Pepecoin</span><div id="wallet"></div></div><div class="chat" id="log" role="log" aria-label="Pond chat"></div><div class="composer"><input placeholder="Say gm, fren…" aria-label="Message" disabled><button disabled>Send</button></div></section><p class="foot">Review concept for Byl · verified receipts use the server, never a browser claim.</p></main>
  <script type="module">
  import {createHazeTips} from '/games/js/haze-tips.mjs';
  const f=${JSON.stringify(fixture)},calls=[];let confirmed=false,checks=0;
  const user='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
  let intent;
  const receipt=()=>({id:intent.id,message_id:101,sender:'Lew',recipient:'Jules',amount_atomic:intent.amount_atomic,reaction:intent.reaction,note:intent.note,txid:'ab'.repeat(32),state:'confirmed'});
  const rpc=async(name,args)=>{calls.push(name);if(name==='gry_haze_status')return {enabled:true,address:f.proof.address};if(name==='gry_haze_tip_begin'){intent={id:crypto.randomUUID(),sender:f.proof.address,address:f.recipient,recipient:'Jules',amount_atomic:args.p_amount,reaction:args.p_reaction,note:args.p_note,created_at:new Date().toISOString(),expires_at:new Date(Date.now()+1800000).toISOString()};return intent;}if(name==='gry_haze_chat')return {linked_users:[other],receipts:confirmed?[receipt()]:[]};throw Error('Unexpected fixture RPC '+name);};
  const invoke=async(body)=>{if(body.action!=='check')throw Error('Unexpected fixture action');checks++;if(checks<2)return {state:'pending',confirmations:1};confirmed=true;return {state:'confirmed',id:intent.id,txid:body.txid};};
  const api=createHazeTips({rpc,invoke,session:()=>({user:{id:user,is_anonymous:false}}),login:()=>{},enabled:true});api.mount(document.querySelector('#wallet'));
  const add=(id,nick,text)=>{const row=document.createElement('article');row.className='message';const time=document.createElement('span');time.className='time';time.textContent='12:41';const name=document.createElement('span');name.className='name';name.textContent=nick+' ✓';const body=document.createElement('p');body.textContent=text;row.append(time,name,body);document.querySelector('#log').append(row);api.bindMessage(row,{id,user_id:other,nick,verified:true});return row;};
  add(100,'Mika','gm frens! The pond is looking good today 🐸');add(101,'Jules','Wrote a little guide to help new frens keep their PEP safe. Hope it helps! 💚');api.sync();
  window.fixture={api,calls,checks:()=>checks,replace:()=>{document.querySelectorAll('.message')[1].remove();add(101,'Jules','Wrote a little guide to help new frens keep their PEP safe. Hope it helps! 💚');api.invalidate();return api.sync();}};
  </script></body></html>`;
  server=http.createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost');let content,type;
    if(url.pathname==='/'){content=html;type='text/html';}
    else if(url.pathname==='/games/js/haze-tips.mjs'){content=fs.readFileSync(path.join(root,'docs/games/js/haze-tips.mjs'));type='text/javascript';}
    else if(url.pathname==='/games/haze-tips.css'){content=fs.readFileSync(path.join(root,'docs/games/haze-tips.css'));type='text/css';}
    else{res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(content);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:process.env.HAZE_CHROMIUM});
  const context=await browser.newContext({viewport:{width:1100,height:850},reducedMotion:'reduce'});
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());if(url.origin===base)return route.continue();
    if(url.origin==='https://hazewallet.com')return route.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><h1>SIMULATED wallet handoff</h1><p>No real wallet, no real funds.</p><button id="submit">Simulate payment submission</button><script>document.getElementById('submit').onclick=()=>opener.postMessage({type:'haze:tip-submitted',version:1,intent:new URLSearchParams(location.hash.slice(1)).get('intent'),txid:'ab'.repeat(32)},${JSON.stringify(base)});</script>`});
    return route.abort();
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(15000);
  await page.goto(base);await page.getByRole('button',{name:'◇ Haze linked ✓',exact:true}).waitFor();
  await page.getByRole('button',{name:'Tip Jules with Haze',exact:true}).click();
  await page.getByRole('button',{name:'100 PEP',exact:true}).click();await page.getByLabel('Optional tip note').fill('That guide made my day!');
  await page.getByLabel('Tip reaction').selectOption('applause');
  await page.screenshot({path:path.join(output,'pond-tip-picker-desktop.png'),fullPage:true});
  const popupEvent=page.waitForEvent('popup');await page.getByRole('button',{name:'Review in Haze Wallet ↗',exact:true}).click();
  const popup=await popupEvent;await popup.waitForURL('https://hazewallet.com/assets/tip.html#*');
  const parameters=new URLSearchParams(new URL(popup.url()).hash.slice(1));assert.equal(parameters.get('amount'),'100');assert.equal(parameters.get('address'),fixture.recipient);assert.equal(parameters.get('sender'),fixture.proof.address);
  await page.evaluate(()=>window.dispatchEvent(new MessageEvent('message',{origin:'https://hazewallet.com',source:window,data:{type:'haze:tip-submitted',version:1,intent:'wrong',txid:'ab'.repeat(32)}})));
  assert.equal(await page.evaluate(()=>window.fixture.checks()),0,'A forged event cannot trigger a check');
  await popup.getByRole('button',{name:'Simulate payment submission'}).click();
  await page.getByText(/waiting for two network confirmations/).waitFor();assert.equal(await page.locator('.haze-chat-receipt').count(),0,'Pending payments never get a confirmed card');
  await page.getByRole('button',{name:'Check this transaction',exact:true}).click();await page.getByText(/Tip confirmed!/).waitFor();
  await page.getByRole('button',{name:'Close Haze dialog'}).click();await page.locator('.haze-chat-receipt').waitFor();
  assert.equal(await page.locator('.haze-chat-receipt').count(),1);await page.evaluate(()=>window.fixture.replace());assert.equal(await page.locator('.haze-chat-receipt').count(),1,'Reloading chat rows restores a single receipt');
  for(const width of [1100,390,320]){await page.setViewportSize({width,height:850});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No overflow at '+width);await page.screenshot({path:path.join(output,'pond-confirmed-'+width+'.png'),fullPage:true});}
  assert.deepEqual(errors,[]);console.log('PASS: real chat module opens exact Haze intent; spoofed events are ignored; pending never celebrates; confirmed receipt renders once and survives row replacement; 320/390/1100 layouts fit. Simulated services only.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();server?.closeAllConnections();server?.close();});
