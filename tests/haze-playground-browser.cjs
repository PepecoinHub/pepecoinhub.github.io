'use strict';
// End-to-end against scripts/haze-preview.mjs: actual chat, encrypted Haze vault,
// wallet signatures, independent Edge verifier, and actual PostgreSQL migration.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base='http://127.0.0.1:18920',wallet='http://127.0.0.1:18921',password='HazePreview!2026';
const output=process.env.HAZE_PH_QA_OUTPUT||path.resolve(__dirname,'../../playground/preview');
const walletRoot=process.env.HAZE_WALLET_ROOT||path.resolve(__dirname,'../../../..');
const scenario=process.env.HAZE_PREVIEW_SCENARIO||'complete';
let browser,page,popup;const errors=[],external=[],submissions=[];
(async()=>{
  fs.mkdirSync(output,{recursive:true});
  browser=await chromium.launch({headless:true,executablePath:process.env.HAZE_CHROMIUM});
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  await context.route('**/*',route=>{
    const origin=new URL(route.request().url()).origin;
    if([base,wallet].includes(origin))return route.continue();external.push(route.request().url());return route.abort();
  });
  if(scenario==='unsupported')await context.route('**/haze-bridge.js*',async route=>{
    const response=await route.fetch(),original=await response.text();
    const body=original.replace(/chatTipProtocol:\s*chatTipProtocol\s*===\s*1\s*\?\s*1\s*:\s*0/,'chatTipProtocol:0');
    assert.notEqual(body,original);await route.fulfill({response,body});
  });
  context.on('page',p=>{
    p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(r.url().endsWith('/transaction/broadcast'))submissions.push(r.url());});
  });
  page=await context.newPage();page.setDefaultTimeout(25000);
  for(let i=0;i<30;i++){try{if((await page.request.get(base)).ok())break;}catch{}await new Promise(r=>setTimeout(r,500));}
  await page.goto(base);
  if(process.env.HAZE_PREVIEW_RESET==='1'){
    await page.evaluate(()=>fetch('/__preview/reset',{method:'POST'}));
  }
  await page.getByRole('link',{name:'Prepare test wallet →',exact:true}).click();
  await page.getByRole('button',{name:'Prepare wallet & open chat →',exact:true}).click();
  await page.waitForURL(wallet+'/widget.html?standalone=1&preview-setup=1');
  await page.getByRole('region',{name:'Self-custody agreement'}).waitFor();
  if(scenario!=='terms')await require(path.join(walletRoot,'tests/terms-browser-helper.cjs'))(page);
  await page.goto(base+'/games/#chat');
  await page.waitForURL(base+'/games/#chat');
  await page.getByRole('button',{name:'◇ Link Haze for tips',exact:true}).waitFor();
  await page.getByRole('button',{name:'Tip Byl with Haze',exact:true}).waitFor();
  await page.screenshot({path:path.join(output,'01-games-chat.png'),fullPage:true});
  await page.getByRole('button',{name:'◇ Link Haze for tips',exact:true}).click();
  await page.getByRole('button',{name:'Continue with Haze Wallet',exact:true}).click();
  if(scenario==='unsupported'){
    await page.getByText(/This Haze build does not support chat tips yet/).waitFor();
    const state=await(await page.request.get(base+'/__preview/state')).json();
    assert.deepEqual(state.badges,[]);assert.equal(state.submissions,0);assert.deepEqual(errors,[]);
    console.log('PASS: an older Haze capability is rejected before wallet linking or any payment.');return;
  }
  const frame=page.frameLocator('iframe.haze-tip-frame');
  await frame.getByRole('button',{name:'Unlock and connect',exact:true}).waitFor();
  await frame.getByLabel('Your Haze wallet password', {exact:true}).fill(password);
  await page.screenshot({path:path.join(output,'02-wallet-link-consent.png'),fullPage:true});
  assert.equal(submissions.length,0,'Linking cannot broadcast');
  await frame.getByRole('button',{name:'Unlock and connect',exact:true}).click();
  if(scenario==='terms'){
    await page.getByText(/Open Haze Wallet and review the self-custody terms, then return here and connect again/).waitFor();
    const state=await(await page.request.get(base+'/__preview/state')).json();
    assert.deepEqual(state.badges,[]);assert.equal(state.submissions,0);assert.deepEqual(errors,[]);
    console.log('PASS: skipped self-custody terms fail closed with actionable recovery text and no stamp or payment.');return;
  }
  await page.getByText(/Your receiving address was verified/).waitFor();
  await page.getByRole('button',{name:'Close Haze dialog',exact:true}).click();
  assert.deepEqual((await(await page.request.get(base+'/__preview/state')).json()).badges,['haze_linked']);
  await page.getByRole('button',{name:'Tip Byl with Haze',exact:true}).click();
  await page.getByRole('button',{name:'100 PEP',exact:true}).click();
  await page.getByLabel('Tip reaction',{exact:true}).selectOption('rocket');
  await page.getByLabel('Optional tip note',{exact:true}).fill('The pond just got a little more fun 🚀');
  await page.screenshot({path:path.join(output,'03-tip-picker.png'),fullPage:true});
  const opening=page.waitForEvent('popup');await page.getByRole('button',{name:'Review in Haze Wallet ↗',exact:true}).click();popup=await opening;
  await popup.waitForURL(wallet+'/assets/tip.html#*');
  const fragment=new URLSearchParams(new URL(popup.url()).hash.slice(1));
  assert.equal(fragment.get('amount'),'100');assert.equal(fragment.get('reaction'),'rocket');
  await popup.locator('#tip-continue').click();
  await popup.waitForURL(wallet+'/widget.html?standalone=1#*');
  await require(path.join(walletRoot,'tests/terms-browser-helper.cjs'))(popup);
  await popup.getByLabel('Wallet password',{exact:true}).fill(password);
  await popup.getByRole('button',{name:'Unlock wallet',exact:true}).click();
  await popup.getByRole('textbox',{name:'Recipient address',exact:true}).waitFor();
  assert.equal(await popup.getByRole('textbox',{name:'Amount in PEP',exact:true}).inputValue(),'100');
  assert.equal(await popup.getByRole('textbox',{name:'Amount in PEP',exact:true}).getAttribute('readonly'),'');
  assert.equal(submissions.length,0,'Opening and unlocking do not broadcast');
  await popup.getByRole('button',{name:/Review send/}).click();
  await popup.getByRole('button',{name:'Confirm & send PEP',exact:true}).waitFor();
  await popup.screenshot({path:path.join(output,'04-haze-fee-review.png'),fullPage:true});
  assert.equal(submissions.length,0,'Review does not broadcast');
  await popup.getByLabel('Wallet password',{exact:true}).fill(password);
  await popup.getByRole('button',{name:'Confirm & send PEP',exact:true}).click();
  await popup.getByRole('heading',{name:'On its way.',exact:true}).waitFor();
  await page.getByText(/waiting for two network confirmations/).waitFor();
  assert.equal(await page.locator('.haze-chat-receipt').count(),0,'No confirmed receipt while pending');
  assert.deepEqual((await(await page.request.get(base+'/__preview/state')).json()).badges,['haze_linked']);
  await page.getByText(/Tip confirmed!/).waitFor({timeout:45000});
  await page.getByRole('button',{name:'Close Haze dialog',exact:true}).click();
  await page.locator('.haze-chat-receipt').waitFor();
  assert.equal(await page.locator('.haze-chat-receipt').count(),1);
  const state=await(await page.request.get(base+'/__preview/state')).json();
  assert.equal(state.submissions,1);assert.equal(state.tips[0].confirmed,true);
  assert.deepEqual(state.badges.sort(),['haze_first_tip','haze_linked']);
  for(const width of [1440,390,320]){
    await page.setViewportSize({width,height:width>900?1000:844});
    if(width<900&&!await page.locator('#chat').isVisible())await page.locator('.g-chat').first().click();
    await page.locator('.haze-chat-receipt').waitFor({state:'visible'});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No horizontal overflow at '+width);
    await page.screenshot({path:path.join(output,'05-confirmed-'+width+'.png'),fullPage:false});
    if(width===1440)await page.locator('#chat').screenshot({path:path.join(output,'confirmed-chat.png')});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(external,[],'Browser must not contact production services');
  console.log('PASS: actual Games chat → Haze ownership approval → real proof verifier and SQL link → immutable tip → encrypted-wallet signing and fee approval → synthetic relay signature check → pending → two confirmations → single verified receipt and two SQL-earned stamps. No production requests.');
})().catch(async error=>{
  console.error(error);process.exitCode=1;
  for(const [name,p]of [['page',page],['popup',popup]])if(p){await p.screenshot({path:path.join(output,'failure-'+name+'.png'),fullPage:true}).catch(()=>{});console.error(name,await p.locator('body').innerText().catch(()=>''));}
  console.error({errors,external,submissions});
}).finally(async()=>{await browser?.close();});
