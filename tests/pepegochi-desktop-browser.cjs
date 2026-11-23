// Browser check for the taskbar companion: desk events never move the frog or toy onto the desktop.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../docs');
const html = `<!doctype html><html class="pondos sky-night"><meta charset="utf-8"><link rel="stylesheet" href="/meme/meme.css">
<body><header class="top"><div class="bar"><button class="start">Start</button></div></header>
<script type="module">
import { mountTaskbarFrog } from '/meme/pepegochi-taskbar.mjs';
window.t = { time: Date.now(), owner: 'owner-a', calls: [], pet: { life_id:'frog-a', name:'Pickle', stage:'adult', status:'healthy', care_days:12, needs:{hunger:90,hygiene:90,mood:90,energy:90} } };
t.refresh = () => window.dispatchEvent(new Event('pondos:auth-changed'));
t.app = id => { const host=document.createElement('div'); host.className='app-win'; document.body.append(host); window.dispatchEvent(new CustomEvent('pondos:app-opened',{detail:{id,host}})); return host; };
t.dispose = mountTaskbarFrog({bar:document.querySelector('.bar'),base:'/',open:()=>{},session:()=>({discord:true,userId:t.owner}),now:()=>t.time,rpc:async name=>{t.calls.push(name);return name==='gry_pepegochi_state'?{pet:structuredClone(t.pet)}:null;}});
</script></html>`;
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'); if(url.pathname==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}
 const file=path.resolve(root,'.'+url.pathname); if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',/\.m?js$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':'image/png');res.end(fs.readFileSync(file));
});
let browser;
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({headless:true,executablePath:process.env.HAZE_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:900,height:600}}), errors=[];page.on('pageerror',e=>errors.push(e.message));
 const origin='http://127.0.0.1:'+server.address().port;
 await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 await page.goto(origin);await page.waitForFunction(()=>document.querySelector('.pg-companion-button')?.title.startsWith('Pickle'));
 const frog=page.locator('.pg-companion-button'), toy=page.locator('.pg-companion-toy:not([hidden])');
 for(const name of ['Roll the ball','Squeak the duck','Toss the bottle cap']) {
   const action=page.getByRole('button',{name,exact:true});
   if(!await action.isVisible()) {
     if(!await page.locator('.pg-menu-play').isVisible()) { await frog.focus();await page.keyboard.press('Enter'); }
     await page.locator('.pg-menu-play').click();
   }
   await action.click();
   await toy.waitFor();
   const f=await frog.boundingBox(), t=await toy.boundingBox();
   assert.ok(Math.abs((t.x+t.width/2)-(f.x+f.width/2))<90, `${name} stays beside the frog`);
   assert.ok(t.y+t.height<=f.y+6 && t.y+t.height>=f.y-24, `${name} rests on the taskbar edge`);
   assert.equal(await page.locator('.pg-desktop-frog-frame,.pg-desktop-play-toy,.pg-desktop-firefly').count(),0);
   if(name==='Squeak the duck' && process.env.PEPEGOCHI_QA_SCREENSHOTS)
     await page.screenshot({path:path.join(process.env.PEPEGOCHI_QA_SCREENSHOTS,'taskbar-duck-desktop.png')});
   await page.evaluate(()=>t.time+=31000);
 }
 await page.keyboard.press('Escape');await page.evaluate(()=>{t.time+=46000;t.app('games')});
 assert.equal(await page.locator('.pg-desktop-away,.pg-desktop-frog-frame').count(),0);
 await page.setViewportSize({width:390,height:600});if(!await page.locator('.pg-menu-play').isVisible()) { await frog.focus();await page.keyboard.press('Enter'); }
 await page.locator('.pg-menu-play').click();await page.getByRole('button',{name:'Squeak the duck'}).click();await toy.waitFor();
 const f=await frog.boundingBox(), t=await toy.boundingBox();assert.ok(Math.abs(t.x-f.x)<90 && Math.abs(t.y-f.y)<90);
 if(process.env.PEPEGOCHI_QA_SCREENSHOTS)
   await page.screenshot({path:path.join(process.env.PEPEGOCHI_QA_SCREENSHOTS,'taskbar-duck-phone.png')});
 await page.evaluate(()=>t.dispose());assert.equal(await page.locator('.pg-companion').count(),0);
 assert.deepEqual(errors,[]);console.log('PepeGochi toys stay at the taskbar on desktop and phone.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
