// Actual taskbar controller and existing wallpaper classes; local fixture services only.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../docs');
const html = `<!doctype html><html class="pondos sky-night"><meta charset="utf-8"><link rel="stylesheet" href="/meme/meme.css">
<style>.sky .scene-night {width:100%;height:100%;left:0;top:0;opacity:1}.sky .sky-fly{animation:none;opacity:1;width:6px;left:160px;top:460px}.fixture-app{position:fixed;left:350px;top:140px;width:340px;height:180px;transform:none}.fixture-app button{position:absolute;right:4px;top:4px}.fixture-game{position:fixed;right:100px;top:120px;width:200px;height:100px}</style>
<body><div class="sky"><div class="scene-night ready"><i class="sky-fly"></i></div></div><header class="top"><div class="bar"><button class="start">Start</button></div></header>
<script type="module">
import { mountTaskbarFrog } from '/meme/pepegochi-taskbar.mjs';
window.t = { time: Date.now(), owner: 'owner-a', calls: [], pet: { life_id:'frog-a', name:'Pickle', stage:'adult', status:'healthy', care_days:12, needs:{hunger:90,hygiene:90,mood:90,energy:90} } };
t.refresh = () => window.dispatchEvent(new Event('pondos:auth-changed'));
// today's "not yet" roll is already used: the secret talk has its own tests (pepegochi-notes); these scenarios cover the rest
for (const o of ['owner-a','owner-b','owner-c']) { const k='pepegochi:notes:v1:'+o+':frog-a'; if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify({ teaseDay: Math.floor(t.time/86400000) })); }
t.app = id => { document.querySelector('.fixture-app')?.remove(); const host=document.createElement('div');host.className='app-win fixture-app';host.innerHTML='<button type="button">Close</button>';host.querySelector('button').onclick=()=>host.remove();document.body.append(host);window.dispatchEvent(new CustomEvent('pondos:app-opened',{detail:{id,host}}));return host; };
t.dispose = mountTaskbarFrog({bar:document.querySelector('.bar'),base:'/',open:()=>{},session:()=>({discord:true,userId:t.owner}),now:()=>t.time,rpc:async name=>{t.calls.push(name);return name==='gry_pepegochi_state'?{pet:structuredClone(t.pet)}:null;}});
</script></html>`;
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');if(url.pathname==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}
 const file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
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
 const frog=page.locator('.pg-companion-button'), glow=page.locator('.pg-desktop-firefly'), away=page.locator('.pg-desktop-away'), reaction=page.locator('.pg-companion-reaction');
 await page.mouse.click(163,463);await glow.waitFor();assert.equal(await away.count(),1);
 assert.equal(await page.locator('.sky-fly.pg-fly-borrowed').count(),1);
 if(process.env.PEPEGOCHI_QA_SCREENSHOTS) await page.screenshot({path:require('node:path').join(process.env.PEPEGOCHI_QA_SCREENSHOTS,'desktop-firefly.png')});
 await glow.waitFor({state:'detached'});await reaction.waitFor();assert.match(await reaction.textContent(),/tiny lamp|screensaver/);
 assert.equal(await away.count(),0);assert.equal(await page.locator('.sky-fly.pg-fly-borrowed').count(),0);
 // Keyboard menu offers the same real-night action, without making the wallpaper focusable.
 await page.evaluate(()=>t.time+=46000);await frog.focus();await page.keyboard.press('Enter');
 await page.locator('.pg-menu-play').click();await page.getByRole('button',{name:'Catch a firefly'}).click();await glow.waitFor();
 await page.keyboard.press('Escape');await glow.waitFor({state:'detached'});assert.equal(await away.count(),0);
 // Perch is nonblocking and returns immediately on input, a moved window or a changed pet state.
 await page.evaluate(()=>{t.time+=46000;t.app('games')});await away.waitFor();
 assert.equal(await page.locator('.pg-desktop-frog-frame').evaluate(e=>getComputedStyle(e).pointerEvents),'none');
 await page.evaluate(()=>document.querySelector('.fixture-app').style.top='200px');await away.waitFor({state:'detached'});
 await page.evaluate(()=>{t.time+=46000;t.app('find')});await away.waitFor();
 await page.evaluate(()=>{t.pet.needs.hunger=15;t.refresh()});await away.waitFor({state:'detached'});
 await page.waitForFunction(()=>document.querySelector('.pg-companion-button img').src.includes('hungry'));
 await page.evaluate(()=>{t.pet.needs.hunger=90;t.time+=46000;t.refresh()});await page.waitForFunction(()=>document.querySelector('.pg-companion-button img').src.includes('sit'));
 await page.mouse.click(800,80);await page.evaluate(()=>{t.time+=46000;t.app('tv')});await page.locator('.pg-desktop-popcorn').waitFor();
 if(process.env.PEPEGOCHI_QA_SCREENSHOTS) await page.screenshot({path:require('node:path').join(process.env.PEPEGOCHI_QA_SCREENSHOTS,'desktop-tv.png')});
 await page.getByRole('button',{name:'Close',exact:true}).click();await page.locator('.pg-desktop-popcorn').waitFor({state:'detached'});
 // Day/still, muted automatic reactions, reduced motion, small screen and game focus.
 await page.evaluate(()=>{t.time+=46000;document.documentElement.classList.replace('sky-night','sky-day')});await page.mouse.click(163,463);assert.equal(await glow.count(),0);
 await page.evaluate(()=>{document.documentElement.classList.replace('sky-day','sky-night');document.querySelector('.sky').hidden=true});await page.mouse.click(163,463);assert.equal(await glow.count(),0);
 await page.evaluate(()=>document.querySelector('.sky').hidden=false);await frog.focus();await page.keyboard.press('Enter');await page.locator('.pg-menu-more').click();await page.getByRole('button',{name:'Reactions: on'}).click();await page.keyboard.press('Escape');
 await page.evaluate(()=>{t.time+=46000;t.app('games')});assert.equal(await away.count(),0);
 await page.mouse.click(163,463);await glow.waitFor();await page.keyboard.press('Escape');await glow.waitFor({state:'detached'});
 await frog.focus();await page.keyboard.press('Enter');await page.locator('.pg-menu-more').click();await page.getByRole('button',{name:'Reactions: quiet'}).click();await page.keyboard.press('Escape');
 await page.emulateMedia({reducedMotion:'reduce'});await page.mouse.click(163,463);assert.equal(await glow.count(),0);
 await page.emulateMedia({reducedMotion:'no-preference'});await page.setViewportSize({width:390,height:600});await page.evaluate(()=>{t.time+=46000;t.app('games')});assert.equal(await away.count(),0);
 await page.mouse.click(300,80);await page.evaluate(()=>{t.time+=46000;const game=document.createElement('iframe');game.className='fixture-game';document.body.append(game);game.focus();t.app('find')});assert.equal(await away.count(),0);
 await page.evaluate(()=>t.dispose());assert.equal(await page.locator('.pg-companion').count(),0);assert.equal(await page.locator('.pg-desktop-frog-frame,.pg-desktop-firefly,.pg-desktop-tongue,.pg-desktop-popcorn').count(),0);
 assert.ok((await page.evaluate(()=>t.calls)).every(x=>['gry_pepegochi_state','gry_quiz_today'].includes(x)));
 assert.deepEqual(errors,[]);console.log('Desktop companion: real wallpaper selection, keyboard catch, perch, popcorn, guardrails and cleanup passed.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
