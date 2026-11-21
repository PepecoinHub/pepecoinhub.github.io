// Local Chromium integration test. Uses the real live page and room controller, but an isolated fixture backend.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {assertCareLayout}=require('./pepegochi-care-layout.cjs');
const root = path.join(__dirname,'../docs');
const fixtureBackend = `import { LocalPepegochi } from './pepegochi-model.mjs';
const sim=new LocalPepegochi({start:Date.now()});
sim.rpc('gry_pepegochi_adopt',{p_name:'Test Fren'});
sim.world.lives[0].care_days=40;
const q=new URLSearchParams(location.search);
const ids=q.has('empty')?[]:['p_poster','crt_tv','lava_lamp','potted_plant','rubber_duck','mug','moon_rock','paper_crown'];
window.fixtureCalls=[];
// ?notes=1: a signed-in owner whose frog left two notes on the table (pepegochi-notes.mjs)
if(q.has('notes'))localStorage.setItem('pepegochi:notes:v1:u1:'+sim.world.lives[0].life_id,JSON.stringify({notes:[
  {kind:'trust',text:'I trust you now, fren.',day:50,at:1},{kind:'clue',secret:'nerd_alert',title:'Nerds Only',text:'A gentle clue.',day:50,at:2}]}));
export async function getBackend(){return {session:()=>({user:{id:'u1',is_anonymous:q.has('guest')}}),rpc:async(name,args)=>{
  window.fixtureCalls.push([name,args]);
  if(name==='gry_pepegochi_room_state')return {initialized:true,inventory:ids.map(item_id=>({item_id}))};
  const r=sim.rpc(name,args||{}); if(!r.ok)throw new Error(r.error);return r.value;
}};}`;
// Exercise the actual parent window handler in isolation from the rest of the desktop.
const desktop=fs.readFileSync(path.join(root,'meme/meme.js'),'utf8');
const start=desktop.indexOf('  function pepegochiApp() {'), end=desktop.indexOf('  // the rules simulator for testers',start);
assert.ok(start>=0&&end>start);
const shell=`<!doctype html><meta charset="utf-8"><style>body{margin:0}iframe{width:100%;height:900px;border:0}</style><script>
let GOCHI=true,BASE='/',tvOpens=0,app;function pondTV(){tvOpens++}
function openApp(id,title,icon,build){if(app)return app;const host=document.createElement('div'),body=document.createElement('div');host.append(body);document.body.append(host);app={host,body};build(app);return app;}
${desktop.slice(start,end)}
window.addEventListener('DOMContentLoaded',()=>{pepegochiApp();window.closeRoom=()=>{app.stop();app.host.remove();app=null};window.tvCount=()=>tvOpens;});</script>`;
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');
 if(u.pathname==='/'){res.setHeader('Content-Type','text/html');return res.end(shell);}
 if(u.pathname==='/games/js/backend.js'){res.setHeader('Content-Type','text/javascript');return res.end(fixtureBackend);}
 const file=path.resolve(root,'.'+u.pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.statusCode=404;return res.end();}
 res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 let browser;
 try {
  browser=await chromium.launch({headless:true,executablePath:process.env.HAZE_CHROMIUM||undefined,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:900,height:900},reducedMotion:'reduce'});
  const errors=[],external=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>{if(r.request().url().startsWith(base+'/'))return r.continue();external.push(r.request().url());return r.abort();});
  await page.goto(base+'/');
  const frame=page.frameLocator('iframe');const button=id=>frame.locator(`[data-room-action="${id}"]`);
  await button('lava_lamp').waitFor();assert.equal(await frame.locator('.pgr-hotspot').count(),12);
  await frame.locator('.pgr-pet').evaluate(i=>i.decode());
  assert.equal(await frame.locator('.pgr-pet').evaluate(i=>i.naturalWidth),256);
  await frame.locator('[data-item="crt_tv"]').evaluate(i=>i.decode());
  assert.equal(await frame.locator('[data-item="crt_tv"]').evaluate(i=>i.naturalWidth),256);
  await frame.locator('[data-room-action="frog"]').click();assert.match(await frame.locator('.pgr-response').textContent(),/Pat accepted/);
  await page.waitForTimeout(310);await button('lava_lamp').click();assert.equal(await frame.locator('.pgr-lamp-off').count(),1);
  await page.waitForTimeout(310);await button('lava_lamp').focus();await page.keyboard.press('Enter');assert.equal(await frame.locator('.pgr-lamp-off').count(),0);
  await page.waitForTimeout(310);await button('pepe_table_lamp').click();assert.match(await frame.locator('.pgr-joke-bubble').textContent(),/Leave my lamp alone/);
  assert.equal(await frame.locator('.pgr-lamp-off').count(),0);
  if(process.env.PEPEGOCHI_QA_SCREENSHOTS) await frame.locator('.pgr-frame').screenshot({path:path.join(process.env.PEPEGOCHI_QA_SCREENSHOTS,'room-joke-lamp.png')});
  await page.waitForTimeout(310);await button('potted_plant').click();assert.match(await frame.locator('.pgr-response').textContent(),/My Lemon Tree!/);
  assert.equal(await frame.locator('.pgr-fx-layer').count(),0,'reduced motion disables particles');
  await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(310);await button('potted_plant').click();
  assert.equal(await frame.locator('.pgr-fx-drop').count(),4);assert.equal(await frame.locator('.pgr-fx-lemon').count(),3);
  if(process.env.PEPEGOCHI_QA_SCREENSHOTS) { await page.waitForTimeout(1250); await frame.locator('.pgr-frame').screenshot({path:path.join(process.env.PEPEGOCHI_QA_SCREENSHOTS,'room-joke-lemons.png')}); }
  await frame.locator('.pgr-fx-layer').waitFor({state:'detached'});
  await button('chrome_rocking_horse').click();
  assert.match(await frame.locator('.pgr-joke-bubble').textContent(),/One horsepower/);
  assert.equal(await frame.locator('.pgr-fixed-horse.pgr-horse-rock').count(),1);
  assert.equal(await frame.locator('.pgr-fx-chrome').count(),2);
  await frame.locator('.pgr-fx-layer').waitFor({state:'detached'});
  await page.waitForTimeout(310);await button('frog').click();assert.equal(await frame.locator('.pgr-fx-heart').count(),3);
  await page.waitForTimeout(310);await button('mug').click();assert.equal(await frame.locator('.pgr-fx-heart').count(),0);assert.equal(await frame.locator('.pgr-fx-steam').count(),2);
  await frame.locator('.pgr-fx-layer').waitFor({state:'detached'});await page.emulateMedia({reducedMotion:'reduce'});
  const f=page.frames().find(f=>f.url().includes('pepegochi-live.html'));
  const actions=()=>f.evaluate(()=>window.fixtureCalls.filter(c=>c[0]==='gry_pepegochi_action').map(c=>c[1].p_action));
  assert.deepEqual(await actions(),[]);
  await page.waitForTimeout(310);await button('crt_tv').click();await page.waitForFunction(()=>tvCount()===1);
  await page.evaluate(()=>window.postMessage({type:'pondos:pepegochi-room-tv'},location.origin));await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>tvCount()),1);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await f.evaluate(()=>{window.hdRestFrames=[];new MutationObserver(records=>{for(const rec of records){const src=rec.target.getAttribute?.('src');if(src?.includes('/hd/care_rest_'))window.hdRestFrames.push(src.split('?')[0].split('/').pop())}}).observe(document.querySelector('#pgb-scene'),{subtree:true,attributes:true,attributeFilter:['src']});});
  await page.waitForTimeout(310);await button('bed').focus();await page.keyboard.press('Enter');await f.waitForFunction(()=>window.fixtureCalls.some(c=>c[1]?.p_action==='rest'));
  await f.waitForFunction(()=>new Set(window.hdRestFrames).size===4);
  await f.waitForFunction(()=>!document.querySelector('.pgr-pet').src.includes('/care_'));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForTimeout(310);await button('bed').focus();await page.keyboard.press('Enter');assert.deepEqual(await actions(),['rest']);
  // User can still reach the normal care buttons and the existing server rules own the actual result.
  const play=frame.locator('[data-act="play"]');assert.equal(await play.count(),1);
  await page.waitForTimeout(310);await button('rubber_duck').click();assert.match(await frame.locator('.pgr-response').textContent(),/I'm lost in PEP!/);
  assert.match(await frame.locator('.pgr-joke-bubble').textContent(),/I'm lost in PEP!/);
  if(process.env.PEPEGOCHI_QA_SCREENSHOTS) await frame.locator('.pgr-frame').screenshot({path:path.join(process.env.PEPEGOCHI_QA_SCREENSHOTS,'room-joke-duck.png')});
  for(const width of [900,390,320]){
   await page.setViewportSize({width,height:900});await button('frog').scrollIntoViewIfNeeded();const b=await frame.locator('.pgr-frame').boundingBox();assert.ok(b.width<=width);
   const care=await assertCareLayout(frame,width,{desktop:width>=680});assert.match(care[3].detail,/ready in/);assert.equal(care[3].disabled,true);
   if(width<680){
    await frame.locator('.pgr-shortcuts summary').click();
    const targets=await frame.locator('.pgr-shortcut').evaluateAll(nodes=>nodes.map(n=>({h:n.getBoundingClientRect().height,w:n.getBoundingClientRect().width})));
    assert.ok(targets.every(t=>t.h>=44&&t.w>=44),'room shortcuts have mobile touch targets');
    await frame.locator('.pgr-shortcuts summary').click();
   }
   await page.waitForTimeout(310);await button('frog').click();if(process.env.PEPEGOCHI_QA_SCREENSHOTS) await page.screenshot({path:require('node:path').join(process.env.PEPEGOCHI_QA_SCREENSHOTS,`room-live-${width}.png`)});
  }
  await page.evaluate(()=>closeRoom());assert.equal(await page.locator('iframe').count(),0);
  await page.goto(base+'/games/pepegochi-live.html?empty=1&embed=1');await page.locator('[data-room-action="frog"]').waitFor();
  assert.deepEqual(await page.locator('.pgr-hotspot').evaluateAll(nodes=>nodes.map(n=>n.dataset.roomAction).sort()),['bed','chrome_rocking_horse','frog','pepe_table_lamp']);
  await page.locator('[data-room-action="pepe_table_lamp"]').click();assert.match(await page.locator('.pgr-response').textContent(),/Leave my lamp alone/);
  // the frog's notes lie on the side table; a click opens NOTES.TXT with both, keyboard reachable
  await page.goto(base+'/games/pepegochi-live.html?empty=1&notes=1&embed=1');await page.locator('[data-notes]').waitFor();
  assert.equal(await page.locator('[data-notes]').getAttribute('aria-label'),'2 notes from your Fren. Read them');
  await page.locator('[data-notes]').click();await page.locator('#pgb-notes').waitFor();
  assert.match(await page.locator('#pgb-notes').textContent(),/I trust you now[\s\S]*A gentle clue[\s\S]*Good care day 50/);
  assert.ok(await page.locator('#pgb-notes').evaluate(e=>e===document.activeElement));
  await page.locator('[data-close-notes]').click();assert.equal(await page.locator('#pgb-notes').count(),0);
  await page.goto(base+'/games/pepegochi-live.html?guest=1&embed=1');await page.locator('[data-signin]').waitFor();assert.equal(await page.locator('[data-notes]').count(),0,'a guest sees no notes');assert.equal(await page.locator('.pgr-hotspot').count(),0);
  await page.goto(base+'/games/pepegochi.html?embed=1');await page.locator('[data-adopt] button').click();
  await page.locator('[data-room-action="frog"]').waitFor();
  await page.locator('[data-room-action="frog"]').click();assert.match(await page.locator('.pgr-response').textContent(),/Tap tap/);
  await page.waitForTimeout(310);await page.locator('[data-room-action="lava_lamp"]').click();assert.equal(await page.locator('.pgr-lamp-off').count(),1);
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  console.log('PASS: real live page with fixture backend, owned/empty/guest room, cosmetic actions, validated rest, TV source check, keyboard and 320/390/900px. No external calls.');
 } finally {await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
