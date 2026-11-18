// Actual taskbar controller, local fixture services only. No account or production requests.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../docs');
const html = `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/meme/meme.css">
<body class="pondos"><input id="work" aria-label="Work"><header style="position:fixed;bottom:0;width:100%"><div class="bar"><button class="start">Start</button></div></header>
<script type="module">
import { mountTaskbarFrog } from '/meme/pepegochi-taskbar.mjs';
window.t = { time: Date.now(), owner: 'owner-a', opened: 0, apps: [], calls: [], pet: { life_id:'frog-a', name:'Pickle', stage:'adult', status:'healthy', care_days:12, needs:{hunger:90,hygiene:90,mood:90,energy:90} } };
t.refresh = () => window.dispatchEvent(new Event('pondos:auth-changed'));
t.dispose = mountTaskbarFrog({bar:document.querySelector('.bar'),base:'/',open:()=>t.opened++,commands:Object.fromEntries(['games','news','passport','tv'].map(name=>[name,()=>t.apps.push(name)])),session:()=>({discord:true,userId:t.owner}),now:()=>t.time,rpc:async name=>{t.calls.push(name);if(name==='gry_quiz_answer')return new Promise(r=>t.answer=r);return name==='gry_pepegochi_state'?{pet:structuredClone(t.pet)}:{day:new Date().toISOString().slice(0,10),question:'Pond question?',answers:['Yes','No'],answered:false};}});
</script>`;
let browser;
const server = http.createServer((req, res) => {
 const u = new URL(req.url, 'http://localhost');
 if(u.pathname==='/') {res.setHeader('Content-Type','text/html');res.end(html);return;}
 const file = path.resolve(root, '.'+u.pathname);
 if(!file.startsWith(root+path.sep) || !fs.existsSync(file)) {res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',file.endsWith('.mjs')||file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'image/png');res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({headless:true,executablePath:process.env.HAZE_CHROMIUM || '/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage(), errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base='http://127.0.0.1:'+server.address().port;
 await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 await page.goto(base);await page.waitForFunction(()=>document.querySelector('.pg-companion-button')?.title.startsWith('Pickle'));
 const frog=page.locator('.pg-companion-button');
 await frog.focus();await page.keyboard.press('Enter');
 await page.getByRole('button',{name:'Our memories',exact:true}).click();
 assert.match(await page.locator('.pg-conversation').textContent(),/12 care days/);
 await page.getByRole('button',{name:"Let's play!",exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>t.apps),['games']);assert.equal(await page.locator('.pg-conversation').count(),0);
 await frog.focus();await page.keyboard.press('Enter');await page.getByRole('button',{name:"What's new?",exact:true}).click();
 await frog.focus();await page.keyboard.press('Enter');await page.getByRole('button',{name:'Open Fren Passport',exact:true}).click();
 await frog.focus();await page.keyboard.press('Enter');await page.getByRole('button',{name:'Watch Pond TV',exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>t.apps),['games','news','passport','tv']);
 await frog.focus();await page.keyboard.press('Enter');
 await page.keyboard.press('Escape');assert.equal(await page.locator('.pg-conversation').count(),0);
 // Actual expression frames play once and restore state; no CSS-only stand-ins.
 const frame = name => page.waitForFunction(n=>document.querySelector('.pg-companion-button img').src.includes('/tb_'+n+'_'),name);
 await frog.focus();await page.keyboard.press('Enter');await frame('curious');
 await page.getByRole('button',{name:'Pet me',exact:true}).click();await frame('nuzzle');
 await page.getByRole('button',{name:"Let's play!",exact:true}).click();await frame('welcome');
 for(let i=0;i<4;i++)await page.getByRole('button',{name:'Pet me',exact:true}).click();await frame('sulk');
 await page.waitForFunction(()=>document.querySelector('.pg-companion-button img').src.includes('/tb_adult_sit.png'));
 await page.keyboard.press('Escape');
 await page.evaluate(()=>{t.time+=46000;t.pet.needs.energy=20;t.refresh();});
 await page.waitForFunction(()=>document.querySelector('.pg-companion-button img').src.includes('/tb_adult_sleepy.png'));
 await frog.focus();await page.keyboard.press('Enter');await frame('yawn');
 await page.evaluate(()=>{t.pet.needs.hunger=10;t.refresh();});
 await page.waitForFunction(()=>document.querySelector('.pg-companion-button img').src.includes('/tb_adult_hungry.png'));
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.evaluate(()=>{t.pet.needs.hunger=90;t.pet.needs.energy=90;t.refresh();});
 await page.waitForFunction(()=>document.querySelector('.pg-companion-button img').src.includes('/tb_adult_sit.png'));
 await frog.focus();await page.keyboard.press('Enter');await page.getByRole('button',{name:'Pet me',exact:true}).click();
 assert.ok(!(await frog.locator('img').getAttribute('src')).includes('/anim/'));
 await page.keyboard.press('Escape');await page.emulateMedia({reducedMotion:'no-preference'});
 await page.evaluate(()=>t.time+=31000);
 // Familiar pats require separated interactions, not rapid button farming.
 for(let i=0;i<4;i++) {await frog.focus();await page.keyboard.press('Enter');await page.getByRole('button',{name:'Pet me',exact:true}).click();await page.evaluate(()=>t.time+=31000);await page.keyboard.press('Escape');}
 await frog.focus();await page.keyboard.press('Enter');await page.getByRole('button',{name:'Pet me',exact:true}).click();
 assert.match(await page.locator('.pg-fact-q').textContent(),/my human|know me well/);
 // Server needs displace an existing happy pose immediately.
 await page.evaluate(()=>{t.pet.needs.hunger=20;t.refresh();});
 await page.waitForFunction(()=>document.querySelector('.pg-companion-button img').src.includes('hungry'));
 await page.locator('#work').focus();
 await page.evaluate(()=>{t.pet.needs.hunger=90;t.time+=46000;t.refresh();});
 await page.waitForSelector('.pg-companion-reaction');
 assert.match(await page.locator('.pg-companion-reaction').textContent(),/hit the spot/);
 assert.equal(await page.locator('#work').evaluate(e=>e===document.activeElement),true);
 // Event bursts are throttled; quiet mode is persisted.
 await page.evaluate(()=>window.dispatchEvent(new Event('offline')));
 assert.match(await page.locator('.pg-companion-reaction').textContent(),/hit the spot/);
 await frog.focus();await page.keyboard.press('Enter');await page.getByRole('button',{name:'Reactions: on',exact:true}).click();await page.keyboard.press('Escape');
 await page.evaluate(()=>{t.time+=46000;window.dispatchEvent(new Event('online'));});
 assert.equal(await page.locator('.pg-companion-reaction').count(),0);
 await page.reload();await page.waitForFunction(()=>document.querySelector('.pg-companion-button')?.title.startsWith('Pickle'));
 await page.evaluate(()=>{t.time+=31*60000;t.refresh();});
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('pepegochi:bond:v1:owner-a:frog-a')).seen===t.time);
 await frog.focus();await page.keyboard.press('Enter');assert.equal(await page.getByRole('button',{name:'Reactions: quiet',exact:true}).count(),1);
 assert.match(await page.locator('.pg-conversation .pg-fact-q').textContent(),/back|There you are/);
 // Switching owners closes dialogue and does not inherit local familiarity/mute.
 await page.evaluate(()=>{t.owner='owner-b';t.refresh();});await page.waitForFunction(()=>!document.querySelector('.pg-conversation'));
 await frog.focus();await page.keyboard.press('Enter');assert.equal(await page.getByRole('button',{name:'Reactions: on',exact:true}).count(),1);
 await page.keyboard.press('Escape');await frog.dblclick();assert.equal(await page.evaluate(()=>t.opened),1);
 for(const width of [320,390,1440]) {
  await page.setViewportSize({width,height:720});await frog.focus();await page.keyboard.press('Enter');
  const box=await page.locator('.pg-conversation').boundingBox();assert.ok(box.x>=0 && box.x+box.width<=width && box.y>=0);
  await page.keyboard.press('Escape');
 }
 // A late quiz response from the previous owner cannot change the new owner's frog.
 await frog.focus();await page.keyboard.press('Enter');await page.getByRole('button',{name:'Pond Quiz',exact:true}).click();
 await page.getByRole('button',{name:'Yes',exact:true}).click();
 await page.evaluate(()=>{t.owner='owner-c';t.refresh();});
 await page.waitForFunction(()=>!document.querySelector('.pg-fact'));
 await page.evaluate(()=>t.answer({right:true,correct:0,picked:0,points:1,answers:['Yes','No']}));
 await frog.focus();await page.keyboard.press('Enter');
 assert.doesNotMatch(await page.locator('.pg-conversation .pg-fact-q').textContent(),/quiz team/);
 await page.keyboard.press('Escape');
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.evaluate(()=>t.dispose());assert.equal(await page.locator('.pg-companion').count(),0);
 const touch=await browser.newPage({hasTouch:true,isMobile:true,viewport:{width:390,height:720}});
 await touch.goto(base);await touch.waitForFunction(()=>document.querySelector('.pg-companion-button')?.title.startsWith('Pickle'));
 await touch.locator('.pg-companion-button').tap();await touch.waitForSelector('.pg-conversation');
 await touch.getByRole('button',{name:'Pet me',exact:true}).tap();
 assert.match(await touch.locator('.pg-conversation .pg-fact-q').textContent(),/Hehe|acceptable|useful mouse/);
 await touch.close();
 // Toy interaction and actual Sweeper loss feed the real parent controller.
 const personality=await browser.newPage();personality.on('pageerror',e=>errors.push(e.message));
 await personality.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 await personality.goto(base);await personality.waitForFunction(()=>document.querySelector('.pg-companion-button')?.title.startsWith('Pickle'));
 const buddy=personality.locator('.pg-companion-button');await buddy.focus();await personality.keyboard.press('Enter');
 for(const label of ['Roll the ball','Squeak the duck','Toss the bottle cap']) {
  await personality.getByRole('button',{name:label,exact:true}).click();
  assert.equal(await personality.locator('.pg-companion-toy').isVisible(),true);
  await personality.evaluate(()=>t.time+=31000);
 }
 await personality.getByRole('button',{name:'Your favourite toy?',exact:true}).click();
 assert.match(await personality.locator('.pg-conversation .pg-fact-q').textContent(),/unpaid throwing assistant/);
 await personality.keyboard.press('Escape');
 await personality.evaluate(()=>{const f=document.createElement('iframe');f.src='/games/pepe-sweeper.html?embed=1';f.id='arcade';document.body.append(f);});
 const sweeper=personality.frameLocator('#arcade');await sweeper.locator('.tile').first().waitFor();
 let lost=false;
 for(let i=0;i<81;i++){
  await sweeper.locator('.tile').nth(i).click();
  if((await sweeper.locator('#result-title').textContent())==='WRONG PEPE!'){lost=true;break;}
 }
 assert.ok(lost,'real Sweeper reaches its loss handler');
 await buddy.focus();await personality.keyboard.press('Enter');
 assert.match(await personality.locator('.pg-conversation .pg-fact-q').textContent(),/losing part|pond saw nothing/);
 await personality.close();
 assert.deepEqual(errors,[]);console.log('PASS: toys, favourite discovery, real Sweeper result, five expression sequences, state restoration, interruption, reduced motion, keyboard, memories, familiar pats, care, focus, throttle, mute/reload, account isolation, double-click, 320/390/1440px, reduced motion and disposal');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
