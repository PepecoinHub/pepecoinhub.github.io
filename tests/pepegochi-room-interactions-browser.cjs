// Local Chromium integration test. Uses the real live page and room controller, but an isolated fixture backend.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.join(__dirname,'../docs');
const fixtureBackend = `import { LocalPepegochi } from './pepegochi-model.mjs';
const sim=new LocalPepegochi({start:Date.now()});
sim.rpc('gry_pepegochi_adopt',{p_name:'Test Fren'});
sim.world.lives[0].care_days=40;
const q=new URLSearchParams(location.search);
const ids=q.has('empty')?[]:['p_poster','crt_tv','lava_lamp','potted_plant','rubber_duck','mug','moon_rock','paper_crown'];
window.fixtureCalls=[];
export async function getBackend(){return {session:()=>({user:{is_anonymous:q.has('guest')}}),rpc:async(name,args)=>{
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
  await button('lava_lamp').waitFor();assert.equal(await frame.locator('.pgr-hotspot').count(),10);
  await frame.locator('[data-room-action="frog"]').click();assert.match(await frame.locator('.pgr-response').textContent(),/Pat accepted/);
  await page.waitForTimeout(310);await button('lava_lamp').click();assert.equal(await frame.locator('.pgr-lamp-off').count(),1);
  await page.waitForTimeout(310);await button('lava_lamp').focus();await page.keyboard.press('Enter');assert.equal(await frame.locator('.pgr-lamp-off').count(),0);
  await page.waitForTimeout(310);await button('potted_plant').click();assert.match(await frame.locator('.pgr-response').textContent(),/Hydrated/);
  const f=page.frames().find(f=>f.url().includes('pepegochi-live.html'));
  const actions=()=>f.evaluate(()=>window.fixtureCalls.filter(c=>c[0]==='gry_pepegochi_action').map(c=>c[1].p_action));
  assert.deepEqual(await actions(),[]);
  await page.waitForTimeout(310);await button('crt_tv').click();await page.waitForFunction(()=>tvCount()===1);
  await page.evaluate(()=>window.postMessage({type:'pondos:pepegochi-room-tv'},location.origin));await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>tvCount()),1);
  await page.waitForTimeout(310);await button('bed').focus();await page.keyboard.press('Enter');await f.waitForFunction(()=>window.fixtureCalls.some(c=>c[1]?.p_action==='rest'));
  await page.waitForTimeout(310);await button('bed').focus();await page.keyboard.press('Enter');assert.deepEqual(await actions(),['rest']);
  // User can still reach the normal care buttons and the existing server rules own the actual result.
  const play=frame.locator('[data-act="play"]');assert.equal(await play.count(),1);
  for(const width of [390,320]){await page.setViewportSize({width,height:900});await button('frog').scrollIntoViewIfNeeded();const b=await frame.locator('.pgr-frame').boundingBox();assert.ok(b.width<=width);await page.waitForTimeout(310);await button('frog').click();}
  await page.evaluate(()=>closeRoom());assert.equal(await page.locator('iframe').count(),0);
  await page.goto(base+'/games/pepegochi-live.html?empty=1&embed=1');await page.locator('[data-room-action="frog"]').waitFor();assert.equal(await page.locator('.pgr-hotspot').count(),2);assert.equal(await page.locator('[data-room-action="crt_tv"]').count(),0);
  await page.goto(base+'/games/pepegochi-live.html?guest=1&embed=1');await page.locator('[data-signin]').waitFor();assert.equal(await page.locator('.pgr-hotspot').count(),0);
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  console.log('PASS: real live page with fixture backend, owned/empty/guest room, cosmetic actions, validated rest, TV source check, keyboard and 320/390/900px. No external calls.');
 } finally {await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
