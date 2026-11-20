// Player journey through the actual offline beta UI. Only the UI controls move the game clock.
// No injected pet states, production authentication, RPC requests, or rewards.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createServer } = require('node:http');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../docs');
const mime = {'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server = createServer((req,res)=>{
  const file = path.resolve(root, '.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
});
let browser;
async function journey(base,{width,height,touch}) {
  const page=await browser.newPage({viewport:{width,height},hasTouch:touch,isMobile:touch,reducedMotion:'no-preference'});
  const errors=[],external=[],missing=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)missing.push(r.url());});
  await page.route('**/*',r=>{if(new URL(r.request().url()).origin===base)return r.continue();external.push(r.request().url());return r.abort();});
  const press=async sel=>{const l=page.locator(sel);assert.equal(await l.isEnabled(),true,sel);await l[touch?'tap':'click']();};
  const stage=async name=>{assert.match(await page.locator('#pgb-scene-title').textContent(),new RegExp(' · '+name+' · '));};
  const status=async name=>{assert.equal(await page.locator('.pgr-'+name).count(),1,name);};
  const settled=async()=>{
    await page.waitForFunction(()=>[...document.querySelectorAll('.pgr img')].every(i=>i.complete&&i.naturalWidth>0));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page has no horizontal overflow');
  };
  const shot=async name=>{await settled();if(process.env.PEPEGOCHI_QA_SCREENSHOTS)await page.locator('.pgb-scene').screenshot({path:path.join(process.env.PEPEGOCHI_QA_SCREENSHOTS,`playtest-${width}-${name}.png`)});};
  const skip=async days=>{await page.locator('#pgb-h').fill(String(days*24));await press('#pgb-hours button[type=submit]');};
  // Count each rendered frame in the actual room, including the very first frame on replacement of the scene.
  const watch=async()=>page.evaluate(()=>{
    window.observedFrames=[];window.frameObserver?.disconnect();
    const read=()=>{const s=document.querySelector('.pgr-pet')?.getAttribute('src');if(s){const f=s.split('?')[0].split('/').pop();if(f!==window.observedFrames.at(-1))window.observedFrames.push(f);}};
    window.frameObserver=new MutationObserver(read);window.frameObserver.observe(document.querySelector('#pgb-scene'),{subtree:true,childList:true,attributes:true,attributeFilter:['src']});
  });
  const care=async (kind,animation=null)=>{
    if(animation)await watch();
    await press(`[data-act="${kind}"]`);
    assert.equal(await page.locator('#pgb-msg').textContent(),'','care was accepted');
    if(animation){
      await page.waitForFunction(prefix=>window.observedFrames.filter(f=>f.startsWith(prefix)).length===4,animation);
      await page.waitForFunction(()=>!document.querySelector('.pgr-pet').getAttribute('src').match(/\/(?:care_|pepegochi_hatch_)/));
      const frames=await page.evaluate(prefix=>window.observedFrames.filter(f=>f.startsWith(prefix)),animation);
      assert.deepEqual(frames,[1,2,3,4].map(n=>animation+'0'+n+'.png'));
    }
  };
  const careFour=async()=>{for(const kind of ['clean','feed','play','rest']){if(await page.locator(`[data-act="${kind}"]`).isEnabled())await care(kind);}};
  try {
    await page.goto(base+'/games/pepegochi.html?embed=1');
    await page.locator('[data-adopt]').waitFor();await page.locator('#pgb-name').fill('Playtest Fren');await press('[data-adopt] button');
    await stage('egg');await shot('01-egg');
    await press('[data-room-action="frog"]');assert.match(await page.locator('.pgr-response').textContent(),/Tap tap/);
    await care('clean','pepegochi_hatch_');await stage('tadpole');await shot('02-tadpole');
    for(const kind of ['feed','play','rest'])await care(kind,'care_tadpole_'+kind+'_');
    assert.equal(await page.locator('[data-act="feed"]').isDisabled(),true,'cooldown displayed after feeding');
    await skip(1);await care('clean','care_froglet_clean_');await stage('froglet');await shot('03-froglet');
    for(const kind of ['feed','play','rest'])await care(kind,'care_froglet_'+kind+'_');
    for(let day=3;day<=6;day++){await skip(1);await careFour();await stage('froglet');}
    await skip(1);await care('clean','care_clean_');await stage('adult');
    for(const kind of ['feed','play','rest'])await care(kind,'care_'+kind+'_');
    await status('healthy');assert.match(await page.locator('.pgb-good').textContent(),/Good care days: 7 \/ 30/);
    await shot('04-adult');
    await press('[data-room-action="lava_lamp"]');assert.equal(await page.locator('.pgr-room-lights-off').count(),1);
    await shot('05-night');await page.waitForTimeout(310);await press('[data-room-action="lava_lamp"]');
    await page.waitForTimeout(310);await press('[data-room-action="potted_plant"]');assert.match(await page.locator('.pgr-response').textContent(),/Hydrated/);
    await page.waitForTimeout(310);await press('[data-room-action="rubber_duck"]');assert.match(await page.locator('.pgr-response').textContent(),/SQUEAK/);
    await page.reload();await stage('adult');assert.match(await page.locator('.pgb-good').textContent(),/Good care days: 7 \/ 30/);
    await skip(3);await status('neglected');await shot('06-neglected');
    await skip(3);await status('packing');await shot('07-packing');
    await care('feed');await status('packing');assert.doesNotMatch(await page.locator('.pgb-warn').allTextContents().then(x=>x.join(' ')),/Feed \(Hunger\)/);
    await careFour();await status('recovering');await shot('08-recovering');
    await skip(1);await careFour();await status('healthy');await shot('09-recovered');
    await skip(9);await status('departed');await page.locator('.pgr-actor').waitFor({state:'detached'});assert.equal(await page.locator('.pgr-pet').count(),0);await shot('10-departed');
    await press('[data-adopt] button');assert.match(await page.locator('#pgb-msg').textContent(),/Read GOODBYE.TXT first/);
    await press('.pgr-letter');assert.match(await page.locator('#pgb-notepad').textContent(),/Dear Fren/);
    assert.equal(await page.locator('#pgb-notepad').evaluate(el=>el===document.activeElement),true);
    if(process.env.PEPEGOCHI_QA_SCREENSHOTS)await page.locator('#pgb-notepad').screenshot({path:path.join(process.env.PEPEGOCHI_QA_SCREENSHOTS,`playtest-${width}-11-letter.png`)});
    await press('[data-close-letter]');await page.locator('#pgb-name').fill('Second Fren');await press('[data-adopt] button');
    await stage('egg');assert.match(await page.locator('#pgb-scene-title').textContent(),/fren #2/);assert.match(await page.locator('#pgb-past').textContent(),/Playtest Fren.*Left for a different pond/);
    await shot('12-new-egg');
    await press('#pgb-reset');await page.locator('[data-adopt]').waitFor();assert.match(await page.locator('#pgb-past').textContent(),/Former frens: 0/);
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(missing,[]);
    console.log(`PASS ${width}x${height} ${touch?'touch':'mouse'}: adoption, hatch, 7 care days, 12 four-frame animations, cooldown, room, refresh, neglect, rescue, departure, letter, second adoption, reset; no external requests or missing assets.`);
  }finally{await page.close();}
}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:process.env.HAZE_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});
  await journey(base,{width:1440,height:900,touch:false});
  await journey(base,{width:390,height:844,touch:true});
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
