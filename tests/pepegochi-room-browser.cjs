// Actual renderer with fixture inventory; no backend, rewards or account requests.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../docs'),output=process.env.PEPEGOCHI_QA_SCREENSHOTS||path.resolve(__dirname,'../games/pepegochi/room-a11');
const html=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/games/pepegochi.css"><style>body{margin:0;padding:12px;background:#16342e;font:14px system-ui;color:#e4e4cb}main{max-width:646px;margin:auto}h1{font-size:18px}.pgr-frame{width:100%;box-sizing:border-box}button{padding:8px;margin:8px 8px 8px 0}</style><main><h1>PepeGochi · Private Pond</h1><div id="scene"></div><button id="normal">Home</button><button id="empty">Empty inventory</button><button id="departed">Moved out</button><button id="young">Tadpole</button></main><script type="module">
import {renderRoom,STARTER_ROOM,fixedPlacements,DECORATIONS} from '/games/js/pepegochi-room.mjs';
const all=fixedPlacements([...Object.values(STARTER_ROOM),...DECORATIONS]);
const show=(opts={})=>{document.querySelector('#scene').replaceChildren(renderRoom(document,{placements:all,...opts}));document.querySelectorAll('#scene img').forEach(i=>{i.src='/games/'+i.getAttribute('src')})};
normal.onclick=()=>show();empty.onclick=()=>show({placements:{}});departed.onclick=()=>show({mode:'departed',taken:'crt_tv'});young.onclick=()=>show({stage:'tadpole'});window.show=show;show();
</script>`;
let browser;const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');if(u.pathname==='/'){res.setHeader('Content-Type','text/html');res.end(html);return}
 const file=path.resolve(root,'.'+u.pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return}
 res.setHeader('Content-Type',file.endsWith('.mjs')?'text/javascript':file.endsWith('.css')?'text/css':'image/png');res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:process.env.HAZE_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:900,height:650},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 await page.goto(origin);await page.waitForFunction(()=>window.show && [...document.images].every(i=>i.complete&&i.naturalWidth>0));
 assert.equal(await page.locator('.pgr-item').count(),10);
 await page.locator('.pgr-frame').screenshot({path:path.join(output,'room-after.png')});
 await page.evaluate(()=>document.querySelector('.pgr-bg').src='/games/img/pepegochi/room_clean_base.png');
 await page.waitForFunction(()=>document.querySelector('.pgr-bg').complete);
 await page.locator('.pgr-frame').screenshot({path:path.join(output,'room-before.png')});
 await page.locator('#empty').click();assert.equal(await page.locator('.pgr-item').count(),0);
 await page.locator('.pgr-frame').screenshot({path:path.join(output,'room-empty.png')});
 await page.locator('#departed').click();assert.equal(await page.locator('.pgr-pet').count(),0);assert.equal(await page.locator('[data-item="crt_tv"]').count(),0);assert.equal(await page.locator('.pgr-item').count(),9);
 await page.locator('.pgr-letter').focus();assert.ok(await page.locator('.pgr-letter').evaluate(e=>e===document.activeElement));
 await page.locator('.pgr-frame').screenshot({path:path.join(output,'room-departed.png')});
 await page.locator('#young').click();assert.equal(await page.locator('.pgr-pet').getAttribute('data-sprite'),'tadpole_idle');
 for(const width of [320,390,900]){
  await page.setViewportSize({width,height:650});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const b=await page.locator('.pgr-frame').boundingBox();assert.ok(b.width<=width && b.x>=0);
 }
 await page.locator('#normal').click();await page.setViewportSize({width:390,height:650});
 await page.screenshot({path:path.join(output,'room-mobile.png')});assert.deepEqual(errors,[]);
 console.log('PASS: real layered room; full/empty inventory, departure hides TV only, letter keyboard focus, young frog, 320/390/900px, all assets load, no external requests');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server.close()});
