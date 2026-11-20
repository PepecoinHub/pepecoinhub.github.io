// Actual taskbar controller, local fixture services only. No account or production requests.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../docs');
const capture = async (page, name) => {if(process.env.PEPEGOCHI_QA_SCREENSHOTS) await page.screenshot({path:path.join(process.env.PEPEGOCHI_QA_SCREENSHOTS,`companion-${name}.png`)});};
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/meme/meme.css">
<body class="pondos"><input id="work" aria-label="Work"><header style="position:fixed;bottom:0;width:100%"><div class="bar"><button class="start">Start</button></div></header>
<script type="module">
import { mountTaskbarFrog } from '/meme/pepegochi-taskbar.mjs';
window.t = { time: Date.now(), owner: 'owner-a', opened: 0, apps: [], passportOpened: 0, calls: [], passport: {signed_in:true,secrets:[]}, pet: { life_id:'frog-a', name:'Pickle', stage:'adult', status:'healthy', care_days:12, needs:{hunger:90,hygiene:90,mood:90,energy:90} } };
t.refresh = () => window.dispatchEvent(new Event('pondos:auth-changed'));
// today's "not yet" roll is already used: the secret talk has its own tests (pepegochi-notes); these scenarios cover the rest
for (const o of ['owner-a','owner-b','owner-c']) { const k='pepegochi:notes:v1:'+o+':frog-a'; if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify({ teaseDay: Math.floor(t.time/86400000) })); }
t.dispose = mountTaskbarFrog({bar:document.querySelector('.bar'),base:'/',open:()=>t.opened++,openPassport:()=>t.passportOpened++,commands:Object.fromEntries(['games','news','passport','tv'].map(name=>[name,()=>t.apps.push(name)])),session:()=>({discord:true,userId:t.owner}),now:()=>t.time,random:()=>0,getQuote:()=>({time:new Date(t.time).toISOString(),change_24h:6}),rpc:async (name,args)=>{t.calls.push(name);if(name==='gry_passport_state'){if(t.deferPassport)return new Promise(r=>t.passportResolve=r);return structuredClone(t.passport)}if(name==='gry_quiz_answer')return new Promise(r=>t.answer=r);if(name==='gry_pepegochi_action'){const need={feed:'hunger',clean:'hygiene',play:'mood',rest:'energy'}[args.p_action];t.pet.needs[need]=Math.min(100,t.pet.needs[need]+35);return {pet:structuredClone(t.pet),action_result:'accepted'};}return name==='gry_pepegochi_state'?{pet:structuredClone(t.pet)}:{day:new Date().toISOString().slice(0,10),question:'Pond question?',answers:['Yes','No'],answered:false};}});
</script>`;
const categories={Feed:'care',Clean:'care',Play:'care',Rest:'care','Our memories':'talk','How is PEP?':'talk','Tell me a joke':'talk',"Let's play!":'play','Pet me':'play','Watch Pond TV':'play','Pond Quiz':'play','Roll the ball':'play','Squeak the duck':'play','Toss the bottle cap':'play','Your favourite toy?':'play',"What's new?":'more','Open Fren Passport':'more','Secret Journal':'more','Reactions: on':'more','Reactions: quiet':'more'};
async function selectMenu(page,id,method='click') {
 const panel=page.locator('.pg-conversation');await panel.waitFor();
 if(await panel.locator('.pg-menu-'+id+'-group').isVisible())return;
 const back=panel.locator('.pg-menu-back');if(await back.isVisible())await back[method]();
 await panel.locator('.pg-menu-'+id)[method]();
}
async function menuAction(page,label,method='click') {
 await selectMenu(page,categories[label],method);await page.getByRole('button',{name:label,exact:true})[method]();
}
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
 await menuAction(page,'Our memories');
 assert.match(await page.locator('.pg-conversation').textContent(),/12 care days/);
 await menuAction(page,"Let's play!");
 assert.deepEqual(await page.evaluate(()=>t.apps),['games']);assert.equal(await page.locator('.pg-conversation').count(),0);
 await frog.focus();await page.keyboard.press('Enter');await menuAction(page,"What's new?");
 await frog.focus();await page.keyboard.press('Enter');await menuAction(page,'Open Fren Passport');
 await frog.focus();await page.keyboard.press('Enter');await menuAction(page,'Watch Pond TV');
 assert.deepEqual(await page.evaluate(()=>t.apps),['games','news','passport','tv']);
 await frog.focus();await page.keyboard.press('Enter');
 await page.keyboard.press('Escape');assert.equal(await page.locator('.pg-conversation').count(),0);
 await page.evaluate(()=>{t.pet.needs.hunger=60;t.refresh();});
 await page.waitForFunction(()=>document.querySelector('.pg-companion-button img').src.includes('hungry'));
 await frog.focus();await page.keyboard.press('Enter');await menuAction(page,'Feed');
 await page.waitForFunction(()=>document.querySelector('.pg-conversation .pg-fact-q')?.textContent.includes('hit the spot'));
 assert.equal(await page.evaluate(()=>t.pet.needs.hunger),95);
 assert.equal(await page.evaluate(()=>t.calls.filter(x=>x==='gry_pepegochi_action').length),1);
 await page.keyboard.press('Escape');
 // Actual expression frames play once and restore state; no CSS-only stand-ins.
 const frame = name => page.waitForFunction(n=>document.querySelector('.pg-companion-button img').src.includes('/tb_'+n+'_'),name);
 await frog.focus();await page.keyboard.press('Enter');await frame('curious');
 await menuAction(page,'Pet me');await frame('nuzzle');
 await page.evaluate(()=>{t.time+=31_000;t.pet.needs.mood=60;t.refresh()});
 await page.waitForFunction(()=>document.querySelector('.pg-companion-button img').src.includes('moody'));
 await frog.focus();await page.keyboard.press('Enter');await menuAction(page,'Play');await frame('welcome');
 for(let i=0;i<4;i++)await menuAction(page,'Pet me');await frame('sulk');
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
 await frog.focus();await page.keyboard.press('Enter');await menuAction(page,'Pet me');
 assert.ok(!(await frog.locator('img').getAttribute('src')).includes('/anim/'));
 await page.keyboard.press('Escape');await page.emulateMedia({reducedMotion:'no-preference'});
 await page.evaluate(()=>t.time+=31000);
 // Familiar pats require separated interactions, not rapid button farming.
 for(let i=0;i<4;i++) {await frog.focus();await page.keyboard.press('Enter');await menuAction(page,'Pet me');await page.evaluate(()=>t.time+=31000);await page.keyboard.press('Escape');}
 await frog.focus();await page.keyboard.press('Enter');await menuAction(page,'Pet me');
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
 await frog.focus();await page.keyboard.press('Enter');await menuAction(page,'Reactions: on');await page.keyboard.press('Escape');
 await page.evaluate(()=>{t.time+=46000;window.dispatchEvent(new Event('online'));});
 assert.equal(await page.locator('.pg-companion-reaction').count(),0);
 await page.reload();await page.waitForFunction(()=>document.querySelector('.pg-companion-button')?.title.startsWith('Pickle'));
 await page.evaluate(()=>{t.time+=31*60000;t.refresh();});
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('pepegochi:bond:v1:owner-a:frog-a')).seen===t.time);
 await frog.focus();await page.keyboard.press('Enter');await selectMenu(page,'more');assert.equal(await page.getByRole('button',{name:'Reactions: quiet',exact:true}).count(),1);
 assert.match(await page.locator('.pg-conversation .pg-fact-q').textContent(),/back|There you are/);
 // Switching owners closes dialogue and does not inherit local familiarity/mute.
 await page.evaluate(()=>{t.owner='owner-b';t.refresh();});await page.waitForFunction(()=>!document.querySelector('.pg-conversation'));
 await frog.focus();await page.keyboard.press('Enter');await selectMenu(page,'more');assert.equal(await page.getByRole('button',{name:'Reactions: on',exact:true}).count(),1);
 await page.keyboard.press('Escape');await frog.dblclick();assert.equal(await page.evaluate(()=>t.opened),1);
 for(const width of [320,390,1440]) {
  await page.setViewportSize({width,height:720});await frog.focus();await page.keyboard.press('Enter');
  const box=await page.locator('.pg-conversation').boundingBox();assert.ok(box.x>=0 && box.x+box.width<=width && box.y>=0);
  const room=await page.getByRole('button',{name:'Go to your room',exact:true}).boundingBox();assert.ok(room.y>=box.y && room.y+room.height<=box.y+box.height,'room shortcut visible without scrolling');
  const bubbles=await page.locator('.pg-menu-root button').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));
  assert.equal(bubbles.length,5);assert.ok(bubbles.every(b=>b.x>=0&&b.x+b.w<=width&&b.h>=44));
  for(let i=0;i<bubbles.length;i++)for(let j=i+1;j<bubbles.length;j++){const a=bubbles[i],b=bubbles[j];assert.ok(a.x+a.w<=b.x+.1||b.x+b.w<=a.x+.1||a.y+a.h<=b.y+.1||b.y+b.h<=a.y+.1,'no overlapping touch targets');}
  if(width<=390){assert.ok(bubbles.every(b=>b.h>=48));assert.ok(room.width>240);}
  else{assert.ok(bubbles[0].y>bubbles[1].y,'desktop care bubble sits on the lower arc');}
  if(width===320){const panel=page.locator('.pg-conversation');await panel.evaluate(e=>e.scrollTop=e.scrollHeight);const bar=await panel.locator('.pg-fact-bar').boundingBox();assert.ok(bar.y>=box.y && bar.y+bar.height<=box.y+box.height,'close button stays visible');await panel.evaluate(e=>e.scrollTop=0);}
  await capture(page,`dialog-${width}`);
  await selectMenu(page,'care');assert.equal(await page.getByRole('button',{name:'Feed',exact:true}).isVisible(),true);assert.equal(await page.locator('.pg-menu-root').isVisible(),false);
  await capture(page,`care-${width}`);
  await page.getByRole('button',{name:'Back to interactions',exact:true}).click();assert.equal(await page.locator('.pg-menu-root').isVisible(),true);
  await page.keyboard.press('Escape');
 }
 // The screenshot regression: dark chrome, young frog and manual buttons still work.
 await page.setViewportSize({width:390,height:720});
 await page.evaluate(()=>{document.documentElement.setAttribute('data-theme','dark');t.pet.stage='froglet';t.refresh()});
 await page.waitForFunction(()=>document.querySelector('.pg-companion-button img').src.includes('froglet'));
 await frog.focus();await page.keyboard.press('Enter');
 const reply=page.locator('.pg-conversation .pg-fact-q');
 await menuAction(page,'Tell me a joke');const joke=await reply.textContent();
 await menuAction(page,'Pet me');assert.notEqual(await reply.textContent(),joke);
 await menuAction(page,'Roll the ball');assert.ok(await page.locator('.pg-companion-toy').isVisible());
 await selectMenu(page,'talk');await page.mouse.move(0,0);assert.equal(await page.getByRole('button',{name:'Tell me a joke',exact:true}).evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(229, 234, 217)');
 await capture(page,'froglet-dark');
 await page.keyboard.press('Escape');
 await page.evaluate(()=>{t.pet.stage='adult';t.refresh()});await page.waitForFunction(()=>document.querySelector('.pg-companion-button img').src.includes('adult_sit'));
 await frog.focus();await page.keyboard.press('Enter');await menuAction(page,'Pond Quiz');
 const answer=page.getByRole('button',{name:'Yes',exact:true});
 // the pointer may still rest on this spot from the previous click: measure the resting colour, not the hover one
 await page.mouse.move(0,0);
 assert.equal(await answer.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(229, 229, 223)');
 await answer.click();assert.match(await page.locator('.pg-fact-out').textContent(),/Saving/);
 await page.evaluate(()=>t.answer(null));await page.waitForFunction(()=>!document.querySelector('.pg-fact-answers button').disabled);
 assert.match(await page.locator('.pg-fact-out').textContent(),/Try again/);await page.keyboard.press('Escape');
 // A late quiz response from the previous owner cannot change the new owner's frog.
 await frog.focus();await page.keyboard.press('Enter');await menuAction(page,'Pond Quiz');
 await page.getByRole('button',{name:'Yes',exact:true}).click();
 await page.evaluate(()=>{t.owner='owner-c';t.refresh();});
 await page.waitForFunction(()=>!document.querySelector('.pg-fact'));
 await page.evaluate(()=>t.answer({answered:true,right:true,correct:0,picked:0,points:1,answers:['Yes','No']}));
 await frog.focus();await page.keyboard.press('Enter');
 assert.doesNotMatch(await page.locator('.pg-conversation .pg-fact-q').textContent(),/quiz team/);
 await page.keyboard.press('Escape');
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.evaluate(()=>t.dispose());assert.equal(await page.locator('.pg-companion').count(),0);
 const touch=await browser.newPage({hasTouch:true,isMobile:true,viewport:{width:390,height:720}});
 await touch.goto(base);await touch.waitForFunction(()=>document.querySelector('.pg-companion-button')?.title.startsWith('Pickle'));
 await touch.locator('.pg-companion-button').tap();await touch.waitForSelector('.pg-conversation');
 assert.equal(await touch.evaluate(()=>document.documentElement.clientWidth),390);
 assert.ok((await touch.locator('.pg-menu-room').boundingBox()).width>240);
 await menuAction(touch,'Pet me','tap');
 assert.match(await touch.locator('.pg-conversation .pg-fact-q').textContent(),/Hehe|acceptable|useful mouse/);
 await touch.close();
 // Toy interaction and actual Sweeper loss feed the real parent controller.
 const personality=await browser.newPage();personality.on('pageerror',e=>errors.push(e.message));
 await personality.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 await personality.goto(base);await personality.waitForFunction(()=>document.querySelector('.pg-companion-button')?.title.startsWith('Pickle'));
 const buddy=personality.locator('.pg-companion-button');await buddy.focus();await personality.keyboard.press('Enter');
 for(const label of ['Roll the ball','Squeak the duck','Toss the bottle cap']) {
  await menuAction(personality,label);
  assert.equal(await personality.locator('.pg-companion-toy').isVisible(),true);
  await personality.evaluate(()=>t.time+=31000);
 }
 await menuAction(personality,'Your favourite toy?');
 assert.match(await personality.locator('.pg-conversation .pg-fact-q').textContent(),/unpaid throwing assistant/);
 await personality.keyboard.press('Escape');
 await personality.evaluate(()=>{
  const f=document.createElement('iframe');f.src='/games/pepe-sweeper.html?embed=1';f.id='arcade';
  t.arcadeMessages=[];
  window.addEventListener('message',event=>{
   if(event.origin===location.origin&&event.source===f.contentWindow&&event.data?.type==='pondos:arcade-round')t.arcadeMessages.push(event.data);
  });
  document.body.append(f);
 });
 const sweeper=personality.frameLocator('#arcade');await sweeper.locator('.tile').first().waitFor();
 let lost=false;
 for(let i=0;i<81;i++){
  await sweeper.locator('.tile').nth(i).click();
  if((await sweeper.locator('#result-title').textContent())==='WRONG PEPE!'){lost=true;break;}
 }
 assert.ok(lost,'real Sweeper reaches its loss handler');
 // The rendered result and the parent postMessage are asynchronous; wait for the
 // authentic matching round to reach the parent before opening the conversation.
 await personality.waitForFunction(()=>t.arcadeMessages.some(finish=>finish.phase==='finish'&&finish.outcome==='loss'&&t.arcadeMessages.some(start=>start.phase==='start'&&start.run===finish.run)));
 await buddy.focus();await personality.keyboard.press('Enter');
 assert.match(await personality.locator('.pg-conversation .pg-fact-q').textContent(),/losing part|pond saw nothing/);
 await personality.close();
 // Pond Rumors uses only the signed-in Passport state, even in quiet mode and on a narrow touch viewport.
 const rumors=await browser.newPage({viewport:{width:320,height:640},hasTouch:true});rumors.on('pageerror',e=>errors.push(e.message));
 await rumors.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 await rumors.goto(base);await rumors.waitForFunction(()=>document.querySelector('.pg-companion-button')?.title.startsWith('Pickle'));
 assert.equal(await rumors.evaluate(()=>t.calls.filter(x=>x==='gry_passport_state').length),0);
 await rumors.locator('.pg-companion-button').tap();await menuAction(rumors,'Reactions: on','tap');
 assert.equal(await rumors.getByRole('button',{name:'Pond Rumors',exact:true}).count(),0);
 const rumorText=rumors.locator('.pg-conversation .pg-fact-q');
 await menuAction(rumors,'How is PEP?','tap');assert.match(await rumorText.textContent(),/green/i);
 assert.equal(await rumors.evaluate(()=>t.calls.filter(x=>x==='gry_passport_state').length),0);
 await menuAction(rumors,'Secret Journal','tap');await rumors.waitForFunction(()=>document.querySelector('.pg-fact-q')?.textContent.includes('0 / 12'));
 await capture(rumors,'rumors-320');
 assert.match(await rumorText.textContent(),/No discoveries recorded/);
 assert.equal(await rumors.evaluate(()=>t.calls.filter(x=>x==='gry_passport_state').length),1);
 await rumors.getByRole('button',{name:'Close conversation',exact:true}).tap();
 // good care day 50 (owner rule 2026-11-20): a fresh greeting brings the trust note and the first clue, both kept for the table
 await rumors.evaluate(()=>{t.time+=16000;t.pet.care_days=60;t.pet.good_days=50;t.refresh()});
 await rumors.waitForFunction(()=>JSON.parse(localStorage.getItem('pepegochi:bond:v1:owner-a:frog-a')||'{}').seen===t.time);
 await rumors.locator('.pg-companion-button').tap();await rumors.waitForFunction(()=>document.querySelector('.pg-fact-q')?.textContent.includes('I trust you now'));
 assert.equal(await rumors.getByRole('button',{name:'See the note on my table',exact:true}).count(),1);
 assert.deepEqual(await rumors.evaluate(()=>JSON.parse(localStorage.getItem('pepegochi:notes:v1:owner-a:frog-a')).notes.map(n=>n.kind)),['trust','clue']);
 await rumors.getByRole('button',{name:'Close conversation',exact:true}).tap();await rumors.locator('.pg-companion-button').tap();
 assert.doesNotMatch(await rumorText.textContent(),/I trust you now|Just between us/);
 await rumors.evaluate(()=>{t.passport.secrets=[{id:'wrong_frog',discovered_at:new Date().toISOString()}];window.dispatchEvent(new CustomEvent('pondos:secret-found',{detail:{owner:t.owner}}))});
 await menuAction(rumors,'Secret Journal','tap');await rumors.waitForFunction(()=>document.querySelector('.pg-fact-q')?.textContent.includes('The Wrong Frog'));
 assert.match(await rumorText.textContent(),/1 \/ 12/);
 const rumorBox=await rumors.locator('.pg-conversation').boundingBox();assert.ok(rumorBox.x>=0&&rumorBox.x+rumorBox.width<=320&&rumorBox.y>=0);
 await rumors.getByRole('button',{name:'View journal in Fren Passport',exact:true}).tap();assert.equal(await rumors.evaluate(()=>t.passportOpened),1);
 await rumors.locator('.pg-companion-button').tap();await rumors.evaluate(()=>{t.time+=16000;t.deferPassport=true});
 await menuAction(rumors,'Secret Journal','tap');await rumors.waitForFunction(()=>!!t.passportResolve);
 await rumors.evaluate(()=>{t.owner='owner-b';t.refresh();t.passportResolve(t.passport);t.deferPassport=false;t.passport={signed_in:true,secrets:[]}});
 await rumors.waitForFunction(()=>!document.querySelector('.pg-conversation'));
 await rumors.locator('.pg-companion-button').tap();await menuAction(rumors,'Secret Journal','tap');
 await rumors.waitForFunction(()=>document.querySelector('.pg-fact-q')?.textContent.includes('No discoveries recorded'));
 await rumors.close();
 assert.deepEqual(errors,[]);console.log('PASS: toys, favourite discovery, real Sweeper result, five expression sequences, state restoration, interruption, reduced motion, keyboard, memories, familiar pats, care, focus, throttle, mute/reload, account isolation, double-click, 320/390/1440px, reduced motion and disposal');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
