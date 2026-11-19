'use strict';
// /tip in the chat box opens the ordinary tip dialog, prefilled; unknown, shared or own nicks only show a note.
// Simulated services only: no Haze page, Supabase, chain or payment is contacted.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.join(__dirname,'..');let server,browser;
(async()=>{
  const html=`<!doctype html><meta charset="utf-8"><body><div id="wallet"></div><div id="log"></div><input id="chatin"><script type="module">
  import {createHazeTips} from '/games/js/haze-tips.mjs';
  const me='00000000-0000-4000-8000-000000000001',jules='00000000-0000-4000-8000-000000000002',twin='00000000-0000-4000-8000-000000000003';
  const notes=[],calls=[];
  const rpc=async name=>{if(name==='gry_haze_status')return {enabled:true,address:'PAvt4R4pWiqwStNNSb4ZjUQXJN3mZCLqtX',pending:[]};if(name==='gry_haze_chat')return {linked_users:[],receipts:[]};return {};};
  const api=createHazeTips({rpc,invoke:async b=>{calls.push(b);return b.action==='preflight'?{genesis_ok:true,txid:'ab'.repeat(32),outputs:2,confirmations:3,block_ok:true,prevout:{value:'200000000'}}:{};},session:()=>({user:{id:me,is_anonymous:false}}),login:()=>{},notify:t=>notes.push(t),chatLog:document.getElementById('log'),chatInput:document.getElementById('chatin'),enabled:true});
  api.mount(document.getElementById('wallet'));
  const add=(id,user_id,nick)=>{const row=document.createElement('p');row.textContent=nick+': gm';document.getElementById('log').append(row);api.bindMessage(row,{id,user_id,nick,verified:true});};
  add(1,jules,'Jules');add(2,me,'Byl');add(3,jules,'Jules');add(4,twin,'Mika');add(5,'00000000-0000-4000-8000-000000000004','mika');
  window.t={api,notes,calls};
  </script>`;
  server=http.createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost');
    const files={'/games/js/haze-tips.mjs':'docs/games/js/haze-tips.mjs','/games/js/haze-groups.mjs':'docs/games/js/haze-groups.mjs','/games/haze-tips.css':'docs/games/haze-tips.css'};
    if(url.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html'});res.end(html);return;}
    if(files[url.pathname]){res.writeHead(200,{'Content-Type':url.pathname.endsWith('.css')?'text/css':'text/javascript'});res.end(fs.readFileSync(path.join(root,files[url.pathname])));return;}
    res.writeHead(404);res.end();
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:process.env.HAZE_CHROMIUM});
  const page=await browser.newPage(),errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===base)return route.continue();external.push(u.href);return route.abort();});
  await page.goto(base+'/?haze=check');await page.waitForFunction(()=>window.t);
  const r=await page.evaluate(()=>['gm','/answer 42','/tip','/tip Nobody 5','/tip byl 5','/tip mika 5','/tip Jules 0.5'].map(x=>window.t.api.command(x)));
  assert.deepEqual(r,[false,false,'error','error','error','error','error']);
  const notes=await page.evaluate(()=>window.t.notes);
  assert.match(notes[1],/No recent verified message from Nobody/);assert.match(notes[2],/cannot tip yourself/);assert.match(notes[3],/Several frens use the name mika/);
  assert.equal(await page.evaluate(()=>window.t.api.command('/tip @jules 2,5 pep great guide')),'opened');
  await page.getByLabel('Tip amount in native PEP').waitFor();
  assert.equal(await page.getByLabel('Tip amount in native PEP').inputValue(),'2.5');
  assert.equal(await page.getByLabel('Optional tip note').inputValue(),'great guide');
  await page.getByRole('heading',{name:/Jules/}).waitFor();
  await page.getByRole('button',{name:'Close Haze dialog'}).click().catch(()=>{});
  // ?haze=check adds the phone-friendly server check (visibility only; the server decides access)
  await page.getByRole('button',{name:'◇ Server check'}).click();
  await page.getByLabel('Transaction ID for the server check').fill('xyz');await page.getByRole('button',{name:'Run check'}).click();
  await page.getByText(/exactly 64 characters/).waitFor();
  await page.getByLabel('Transaction ID for the server check').fill('AB'.repeat(32));await page.getByRole('button',{name:'Run check'}).click();
  await page.getByText(/Indexer OK/).waitFor();
  assert.deepEqual(await page.evaluate(()=>window.t.calls.at(-1)),{action:'preflight',txid:'ab'.repeat(32)});
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  console.log('PASS: /tip opens the prefilled tip dialog for the newest message by that nick; /answer, unknown, own and shared nicks are not tipped. With ?haze=check the Server check reports the indexer. Simulated services only.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server?.close();});
