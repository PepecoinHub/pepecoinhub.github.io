'use strict';
// Separate headless developer browser; loopback synthetic funds only.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const port=Number(process.env.HAZE_PREVIEW_BASE_PORT||18950),base='http://127.0.0.1:'+port,wallet='http://127.0.0.1:'+(port+1),password='HazePreview!2026';
const root=process.env.HAZE_WALLET_ROOT||path.resolve(__dirname,'../../../..'),out=process.env.HAZE_PH_QA_OUTPUT||path.resolve(__dirname,'../../playground/groups-qa');
let browser,page;const errors=[],external=[],submissions=[],recheckedConfirmed=[],confirmed=new Set();let lastCreated=0;
const negativeOnly=process.env.HAZE_PREVIEW_SCENARIO==='groups-negative',expectedPayments=negativeOnly?0:4;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 fs.mkdirSync(out,{recursive:true});browser=await chromium.launch({headless:true,executablePath:process.env.HAZE_CHROMIUM});
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await context.route('**/*',r=>{if([base,wallet].includes(new URL(r.request().url()).origin))return r.continue();external.push(r.request().url());return r.abort();});
 context.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(r.url().endsWith('/transaction/broadcast'))submissions.push(r.url());if(r.url().endsWith('/__preview/haze')){const body=r.postDataJSON();if(body?.action==='group-check'&&confirmed.has(body.intent))recheckedConfirmed.push(body.intent);}});p.on('response',async r=>{if(r.url().endsWith('/__preview/haze'))try{const body=await r.json();if(r.request().postDataJSON()?.action==='group-check'&&body.state==='confirmed')confirmed.add(body.id);}catch{}});});
 page=await context.newPage();page.setDefaultTimeout(25000);for(let i=0;i<60;i++){try{if((await page.request.get(base)).ok())break;}catch{}await sleep(500);}await page.goto(base);const reset=await page.request.post(base+'/__preview/reset',{headers:{Origin:base}});assert.equal(reset.ok(),true,await reset.text());
 await page.getByRole('link',{name:'Prepare test wallet →',exact:true}).click();await page.getByRole('button',{name:'Prepare wallet & open chat →',exact:true}).click();
 await page.waitForURL(wallet+'/widget.html?standalone=1&preview-setup=1');await page.getByRole('region',{name:'Self-custody agreement'}).waitFor();await require(path.join(root,'tests/terms-browser-helper.cjs'))(page);
 await page.goto(base+'/games/#chat');await page.getByRole('button',{name:'◇ Link Haze for tips',exact:true}).click();await page.getByRole('button',{name:'Continue with Haze Wallet',exact:true}).click();
 const frame=()=>page.frameLocator('iframe.haze-tip-frame');await frame().getByLabel('Your Haze wallet password',{exact:true}).fill(password);await frame().getByRole('button',{name:'Unlock and connect',exact:true}).click();
 await page.getByRole('button',{name:'◇ Haze linked ✓',exact:true}).waitFor();await page.locator('dialog[open]').waitFor({state:'hidden'});
 const state=async()=>await(await page.request.get(base+'/__preview/state')).json();
 const responseTo=(fn)=>page.waitForResponse(r=>r.url()===base+'/__preview/rpc'&&r.request().postDataJSON()?.fn===fn);
 const card=id=>page.locator('.haze-drop-card[data-group-id="'+id+'"]');
 async function create(mode,options={}){
   await sleep(Math.max(0,10500-(Date.now()-lastCreated)));await page.getByRole('button',{name:/🎉 Group tips/}).click();
   await page.getByLabel('Group tip mode',{exact:true}).selectOption(mode);await page.getByLabel('Group PEP total',{exact:true}).fill(options.total||'10');
   for(const [key,label]of [['audience','Recipient audience'],['seconds','Round duration']])if(options[key])await page.getByLabel(label,{exact:true}).selectOption(options[key]);
   for(const [key,label]of [['count','Random recipient count'],['title','Round question or title'],['answer','Round answer or word'],['winners','Maximum winners']])if(options[key])await page.getByLabel(label,{exact:true}).fill(options[key]);
   for(const nick of options.selected||[])await page.locator('.haze-group-selection label').filter({hasText:nick+' ·'}).getByRole('checkbox').check();
   const response=responseTo('gry_haze_group_create');await page.getByRole('button',{name:['airdrop','trivia','word'].includes(mode)?'Start the round':'Preview recipients',exact:true}).click();
   const result=await(await response).json();assert.ok(result.data?.id,JSON.stringify(result));lastCreated=Date.now();
   if(result.data.state==='ready')await page.getByRole('button',{name:'Review group in Haze',exact:true}).waitFor();else await card(result.data.id).waitFor();
   return result.data.id;
 }
 async function cancel(id){if(await page.locator('dialog[open]').count())await page.getByRole('button',{name:'Close Haze dialog',exact:true}).click();await card(id).getByRole('button',{name:'Cancel event',exact:true}).click();await card(id).waitFor({state:'hidden'});}
 const previewNames=async()=>{await page.getByRole('button',{name:'Review group in Haze',exact:true}).waitFor();return await page.locator('.haze-group-preview strong').allTextContents();};
 async function approve(id,{wrong=false}={}){
   await page.getByRole('button',{name:'Review group in Haze',exact:true}).click();
   const unlock=frame().getByRole('button',{name:'Unlock wallet',exact:true}),approve=frame().getByRole('button',{name:'Approve group tip',exact:true});
   await Promise.race([unlock.waitFor(),approve.waitFor()]);if(await unlock.isVisible()){await frame().getByLabel('Wallet password',{exact:true}).fill(password);await unlock.click();}
   await approve.waitFor();await page.waitForFunction(()=>{const f=document.querySelector('iframe.haze-tip-frame');return !!f;});
   await approve.click({trial:true});const before=submissions.length;
   assert.equal(context.pages().length,1);assert.equal(await page.getByLabel('Transaction ID',{exact:true}).count(),0);assert.equal(submissions.length,before);
   if(wrong){await frame().getByLabel('Wallet password',{exact:true}).fill('wrong-password');await approve.click();await frame().getByRole('alert').filter({hasText:/password|unlock|decrypt/i}).waitFor();assert.equal(submissions.length,before);}
   await page.screenshot({path:path.join(out,'group-approval-'+id+'.png'),fullPage:false});
   await frame().getByLabel('Wallet password',{exact:true}).fill(password);await approve.click();
   await page.locator('dialog[open]').waitFor({state:'hidden'});await card(id).getByText(/On its way/).waitFor();assert.equal(submissions.length,before+1);
 }
 const switchTo=async actor=>{await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),page.getByLabel('Demo member',{exact:true}).selectOption(String(actor))]);await page.getByRole('button',{name:/🎉 Group tips/}).waitFor();};
 const say=async text=>{const r=responseTo('gry_lobby_say');await page.getByLabel('Message',{exact:true}).fill(text);await page.getByRole('button',{name:'Send',exact:true}).click();assert.ok((await(await r).json()).data);};
 if(!negativeOnly){
 const all=await create('all',{total:'10.00000003'});assert.deepEqual(await previewNames(),['Byl · 2.00000001 PEP','Jules · 2.00000001 PEP','Pip · 2.00000001 PEP','Nova · 2 PEP','Zeph · 2 PEP']);
 await approve(all,{wrong:true});await page.evaluate(()=>localStorage.removeItem('ph-haze-group-submitted-v1'));await page.reload();await card(all).getByText(/On its way/).waitFor();
 await card(all).getByText('Confirmed · 5 frens received PEP',{exact:true}).waitFor({timeout:45000});assert.equal((await state()).submissions,1);
 console.log('PASS: whole pond, exact smallest-unit split, real wallet multi-output signing, explicit approval, wrong-password rejection, automatic callback, cache-cleared reload recovery and two-confirmation receipt.');
 for(const [mode,expected,options]of [['online',['Byl','Jules'],{}],['offline',['Pip','Nova','Zeph'],{}],['random',null,{count:'2'}],['selected',['Byl','Pip'],{selected:['Byl','Pip']}]]){
   const id=await create(mode,options),names=(await previewNames()).map(t=>t.split(' · ')[0]);if(expected)assert.deepEqual(names,expected);else assert.equal(new Set(names).size,2);await cancel(id);
 }
 console.log('PASS: online, offline, random without repeats and chosen-member audiences in the actual UI; cancellation never broadcasts.');
 // Account switching reloads the real wallet/module graph; allow a full round
 // minute on slower CI machines while the empty-round case checks 15 seconds.
 const air=await create('airdrop',{title:'Join the pond party',total:'12',seconds:'60'});assert.equal((await state()).submissions,1);
 await switchTo(3);assert.equal(await card(air).getByRole('button',{name:/Not eligible/}).isDisabled(),true);
 await switchTo(2);await card(air).getByRole('button',{name:'🎁 Join airdrop',exact:true}).click();await card(air).getByRole('button',{name:'✓ You’re in',exact:true}).waitFor();assert.equal(await card(air).getByRole('button',{name:'✓ You’re in',exact:true}).isDisabled(),true);
 await switchTo(4);await card(air).getByRole('button',{name:'🎁 Join airdrop',exact:true}).click();await card(air).getByRole('button',{name:'✓ You’re in',exact:true}).waitFor();
 await switchTo(1);await card(air).getByRole('button',{name:'Review payout',exact:true}).waitFor({timeout:75000});assert.equal((await state()).submissions,1,'Round close does not pay automatically');
 await card(air).getByRole('button',{name:'Review payout',exact:true}).click();assert.deepEqual(await previewNames(),['Byl · 6 PEP','Jules · 6 PEP']);await approve(air);
 await card(air).getByText('Confirmed · 2 frens received PEP',{exact:true}).waitFor({timeout:45000});console.log('PASS: timed free-entry airdrop, unlinked excluded, join once, no automatic payment at deadline, host review then one group payout.');
 const trivia=await create('trivia',{title:'What is the native ticker?',answer:'PEP',winners:'1',seconds:'60'});
 await switchTo(2);await card(trivia).getByRole('button',{name:'Answer in chat',exact:true}).click();assert.equal(await page.getByLabel('Message',{exact:true}).inputValue(),'/answer ');await say('/answer DOGE');await say('/answer PEP');
 await switchTo(4);await say('/answer   pep ');await switchTo(1);await card(trivia).getByRole('button',{name:'Review payout',exact:true}).waitFor();await card(trivia).getByRole('button',{name:'Review payout',exact:true}).click();assert.deepEqual(await previewNames(),['Jules · 10 PEP']);await approve(trivia);await card(trivia).getByText('Confirmed · 1 fren received PEP',{exact:true}).waitFor({timeout:45000});
 console.log('PASS: trivia uses normal chat, one attempt per member, normalization, correct winner, host-controlled verified payout.');
 const word=await create('word',{answer:'gm',winners:'2',seconds:'60'});await switchTo(5);await card(word).getByRole('button',{name:'Say the word in chat',exact:true}).click();assert.equal(await page.getByLabel('Message',{exact:true}).inputValue(),'gm');await say('GM');await say('gm');await switchTo(6);await say(' gm ');
 await switchTo(1);await card(word).getByRole('button',{name:'Review payout',exact:true}).waitFor();await card(word).getByRole('button',{name:'Review payout',exact:true}).click();assert.deepEqual(await previewNames(),['Pip · 5 PEP','Nova · 5 PEP']);await approve(word);await card(word).getByText('Confirmed · 2 frens received PEP',{exact:true}).waitFor({timeout:45000});
 console.log('PASS: say-the-word chat, two distinct winners, repeated replies do not win twice, one signed payout.');
 const empty=await create('airdrop',{title:'An empty round',seconds:'15'});await card(empty).getByText('No eligible winners · no payment made',{exact:true}).waitFor({timeout:30000});assert.equal((await state()).submissions,4);await cancel(empty);
 }
 await switchTo(2);const wrongWallet=await create('all');await page.getByRole('button',{name:'Review group in Haze',exact:true}).click();await frame().getByLabel('Wallet password',{exact:true}).fill(password);await frame().getByRole('button',{name:'Unlock wallet',exact:true}).click();await frame().getByRole('heading',{name:'Use your linked Haze wallet',exact:true}).waitFor();assert.equal(await frame().getByRole('button',{name:'Approve group tip',exact:true}).count(),0);assert.equal((await state()).submissions,expectedPayments);
 await page.screenshot({path:path.join(out,'wrong-sender.png'),fullPage:false});await page.getByRole('button',{name:'Close Haze dialog',exact:true}).click();
 await card(wrongWallet).getByRole('button',{name:'Review payout',exact:true}).waitFor();
 await context.route('**/haze-bridge.js*',async route=>{const response=await route.fetch(),original=await response.text(),body=original.replace('chatGroupTips:chatGroupTips===1?1:0','chatGroupTips:0');assert.notEqual(body,original);await route.fulfill({response,body});});
 await page.reload();await card(wrongWallet).getByRole('button',{name:'Review payout',exact:true}).click();await page.getByRole('button',{name:'Review group in Haze',exact:true}).click();await page.getByText('Update Haze Wallet to a build that supports group tips.',{exact:true}).waitFor();assert.equal((await state()).submissions,expectedPayments);await page.screenshot({path:path.join(out,'unsupported-build.png'),fullPage:false});await cancel(wrongWallet);await context.unroute('**/haze-bridge.js*');await switchTo(1);
 console.log('PASS: another member cannot pay from Lew’s unlocked wallet; an older group-incapable Haze build has a clear recovery message; closing and reopening an unpaid review remains possible.');
 for(const width of [1440,390,320]){
   await page.setViewportSize({width,height:width>900?1000:844});if(width<900&&!await page.locator('#chat').isVisible())await page.locator('.g-chat').first().click();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No page overflow at '+width);
   await page.getByRole('button',{name:/🎉 Group tips/}).click();await page.getByLabel('Group tip mode',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>{const d=document.querySelector('dialog[open]');return d.scrollWidth>d.clientWidth;}),false,'No dialog overflow at '+width);
   await page.screenshot({path:path.join(out,'group-form-'+width+'.png'),fullPage:false});await page.getByRole('button',{name:'Close Haze dialog',exact:true}).click();
 }
 assert.equal(context.pages().length,1);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(recheckedConfirmed,[],'Confirmed payouts cannot restart checks');assert.deepEqual((await state()).badges.sort(),negativeOnly?['haze_linked']:['haze_first_tip','haze_linked']);
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({pass:true,submissions:submissions.length,errors,external,groups:(await state()).groups},null,2));console.log('PASS: no winners means no payout; desktop/390/320 layouts; one window, no manual transaction ID, no external requests, no JS errors, stamps credited once.');
})().catch(async error=>{console.error(error);process.exitCode=1;await page?.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});console.error(await page?.locator('body').innerText().catch(()=>''));for(const f of page?.frames()||[])if(f.parentFrame())console.error('FRAME',await f.locator('body').innerText().catch(()=>''));console.error({errors,external,submissions});}).finally(async()=>{await browser?.close();});
