// PEPaint drawing latency on the real room client with a simulated server (no network, no Supabase).
// Latency of a pointer move = time until the next accepted draw RPC starts + RTT/2 + Realtime delivery.
// RTT (default 120 ms) and REALTIME_MS (default 60 ms) are assumptions; the pacing (interval_ms) uses the same
// formula as gry_pepaint_draw in update_pepaint_viral_capacity.sql with budget 48 and 12 players per room.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.join(__dirname, '../../docs');
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
const SIM=JSON.parse(new URLSearchParams(location.search).get('sim')||'{}');window.sends=[];
export async function getBackend(){return {kind:'supabase',session:()=>({user:{id}}),
  channel:(topic,cb)=>{channels.set(topic,cb);return {send:(event,payload)=>window.direct.push([topic,event,payload]),close:()=>channels.delete(topic)}},
  rpc:async(fn,args)=>{window.calls.push([fn,args]);if(fn==='gry_state'||fn==='gry_join')return state();
    if(fn==='gry_me')return {user_id:id,nick:'Fren',verified:true};
    if(fn==='gry_pepaint_draw'){const sent=performance.now();window.sends.push(sent);await new Promise(r=>setTimeout(r,SIM.rtt/2));
      const cost=SIM.players+1, interval=Math.max(250,Math.ceil(1000*SIM.rooms/Math.max(1,Math.floor(SIM.budget/cost)))+50);
      window.accepted.push({at:sent,ev:args.p_event});await new Promise(r=>setTimeout(r,SIM.rtt/2));return {ok:true,interval_ms:interval};}
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

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,executablePath:process.env.HAZE_CHROMIUM||undefined,args:['--no-sandbox']});
  const rows=[];
  try{
    for(const rooms of [1,2,4,8]){
      const sim={rooms,players:12,budget:48,rtt:Number(process.env.RTT||120)}, RT=Number(process.env.REALTIME_MS||60);
      const p=await browser.newPage({viewport:{width:1400,height:900}});
      await p.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
      await p.goto(base+'/games/room.html?r=TEST1&sim='+encodeURIComponent(JSON.stringify(sim)));
      await p.locator('#cwrap.can-draw').waitFor();
      const b=await p.locator('#cv').boundingBox();
      await p.evaluate(()=>{window.moves=[];document.querySelector('#cv').addEventListener('pointermove',()=>window.moves.push(performance.now()));});
      await p.mouse.move(b.x+20,b.y+20);await p.mouse.down();
      const t0=Date.now();let i=0;
      while(Date.now()-t0<8000){i++;await p.mouse.move(b.x+20+(i*7)%(b.width-40),b.y+20+Math.floor(i/90)*9%(b.height-40));await sleep(16);}
      await p.mouse.up();await sleep(4000);
      const r=await p.evaluate(([rtt,rt])=>{const s=window.sends.slice().sort((a,b)=>a-b),lat=[];
        for(const m of window.moves){const next=s.find(x=>x>=m);if(next!=null)lat.push(next-m+rtt/2+rt);}
        lat.sort((a,b)=>a-b);const q=k=>Math.round(lat[Math.min(lat.length-1,Math.floor(lat.length*k))]);
        const gaps=s.slice(1).map((x,i)=>x-s[i]);return {packets:s.length,median:q(.5),p95:q(.95),max:Math.round(lat[lat.length-1]),gap:Math.round(gaps.reduce((a,b)=>a+b,0)/Math.max(1,gaps.length))};},[sim.rtt,RT]);
      rows.push({live_rooms:rooms,players_per_room:12,...r});await p.close();
    }
    console.log(JSON.stringify(rows,null,1));
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
