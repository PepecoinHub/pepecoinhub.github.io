// Local Chromium smoke test: real room UI; simulated backend only, no external
// requests, credentials, Supabase project or production traffic.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.join(__dirname, '../docs');
const fixture = `
export const MODE='supabase', TEST_BUILD=false, DISCORD_ENABLED=true, REDDIT_ENABLED=false;
const drawer='00000000-0000-4000-8000-000000000001', guesser='00000000-0000-4000-8000-000000000002';
const id=new URLSearchParams(location.search).has('viewer')?guesser:drawer;
const turn='00000000-0000-4000-8000-000000000099';
const channels=new Map(); window.calls=[]; window.direct=[]; window.accepted=[];
window.deliver=(event,payload)=>channels.get('draw:TEST1:'+turn)?.(event,payload);
const started=Date.now()-10000;
const players=[drawer,guesser].map((user_id,i)=>({user_id,nick:'Fren'+i,active:true,score:0,is_host:i===0,verified:true,guessed:false}));
const state=()=>({now:new Date().toISOString(),room:{code:'TEST1',mode:'kalambury',title:'Test',status:'open',phase:'turn',round_no:1,rounds:1,turn_no:1,turn_id:turn,drawer_id:drawer,host_id:drawer,version:1,turn_seconds:120,turn_started_at:new Date(started).toISOString(),turn_ends_at:new Date(started+120000).toISOString()},players,me:{user_id:id,nick:'Fren',joined:true,is_host:id===drawer},secret:id===drawer?'frog':null,mask:'____',messages:[]});
let rejectFirst=true;
export async function getBackend(){return {kind:'supabase',session:()=>({user:{id}}),
  channel:(topic,cb)=>{channels.set(topic,cb);return {send:(event,payload)=>window.direct.push([topic,event,payload]),close:()=>channels.delete(topic)}},
  rpc:async(fn,args)=>{window.calls.push([fn,args]);if(fn==='gry_state'||fn==='gry_join')return state();
    if(fn==='gry_me')return {user_id:id,nick:'Fren',verified:true};
    if(fn==='gry_pepaint_draw'){if(rejectFirst){rejectFirst=false;return {ok:false,retry_ms:400};}
      window.accepted.push(args);return {ok:true,interval_ms:250};}
    return null;}
};}`;
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'};
const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost');
  if(u.pathname==='/games/js/backend.js'){res.setHeader('Content-Type','text/javascript');return res.end(fixture);}
  const file=path.resolve(root,'.'+u.pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
  return res.end(fs.readFileSync(file));
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port;
  let browser;
  try {
    browser=await chromium.launch({headless:true,executablePath:process.env.HAZE_CHROMIUM||undefined,args:['--no-sandbox']});
    const artist=await browser.newPage({viewport:{width:1400,height:900}}), viewer=await browser.newPage({viewport:{width:1400,height:900}});
    const errors=[];
    for(const p of [artist,viewer]){
      p.on('pageerror',e=>errors.push(e.message));
      await p.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
    }
    await Promise.all([artist.goto(base+'/games/room.html?r=TEST1'),viewer.goto(base+'/games/room.html?r=TEST1&viewer=1')]);
    await artist.locator('#cwrap.can-draw').waitFor(); await viewer.locator('#room:not(.hidden)').waitFor();
    const b=await artist.locator('#cv').boundingBox(); assert.ok(b);
    await artist.mouse.move(b.x+b.width*.2,b.y+b.height*.2); await artist.mouse.down();
    await artist.mouse.move(b.x+b.width*.6,b.y+b.height*.2,{steps:10}); await artist.mouse.up();
    await artist.waitForFunction(()=>window.accepted.some(p=>p.p_event==='d'));
    let calls=await artist.evaluate(()=>window.calls.filter(([name])=>name==='gry_pepaint_draw'));
    assert.ok(calls.length>=2,'server rejected a packet and the client retried');
    const first=await artist.evaluate(()=>window.accepted.find(p=>p.p_event==='d'));
    await viewer.evaluate(p=>window.deliver(p.p_event,p.p_payload),first);
    const pixel=()=>viewer.evaluate(()=>Array.from(document.querySelector('#cv').getContext('2d').getImageData(400,140,1,1).data));
    assert.ok((await pixel())[0]<150,'viewer sees the accepted line');
    await artist.keyboard.press('Control+z');
    await artist.waitForFunction(()=>window.accepted.some(p=>p.p_event==='snap'));
    const snap=await artist.evaluate(()=>window.accepted.find(p=>p.p_event==='snap'));
    await viewer.evaluate(p=>window.deliver(p.p_event,p.p_payload),snap);
    await viewer.waitForFunction(()=>document.querySelector('#cv').getContext('2d').getImageData(400,140,1,1).data[0]>240);
    assert.deepEqual(await artist.evaluate(()=>window.direct),[],'no direct drawing broadcast bypasses the server');
    assert.deepEqual(errors,[]);
    console.log('PEPaint browser smoke: draw, retry, viewer, undo/snapshot, no direct broadcast OK');
  } finally { await browser?.close(); await new Promise(r=>server.close(r)); }
})().catch(e=>{console.error(e);process.exitCode=1;});
