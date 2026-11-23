// Local Chromium test for the PEPaint word choice (update_pepaint_word_choice.sql): real room UI, simulated backend,
// no external requests, no Supabase.
//   PLAYWRIGHT_MODULE=/abs/node_modules/playwright-core HAZE_CHROMIUM=/usr/bin/google-chrome node tests/pepaint-word-choice-browser.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.join(__dirname, '../docs');
const fixture = `
export const MODE='supabase', TEST_BUILD=false, DISCORD_ENABLED=true, REDDIT_ENABLED=false;
const drawer='00000000-0000-4000-8000-000000000001', guesser='00000000-0000-4000-8000-000000000002';
const q=new URLSearchParams(location.search), id=q.has('viewer')?guesser:drawer, quick=q.has('quick');
const turn='00000000-0000-4000-8000-000000000099';
window.calls=[];
let picked=null, pickUntil=Date.now()+(quick?1500:12000);
const words=[{tier:1,word:'frog',mult:1},{tier:2,word:'frog astronaut',mult:1.5},{tier:3,word:'diamond hands',mult:2}];
const players=[drawer,guesser].map((user_id,i)=>({user_id,nick:'Fren'+i,active:true,score:0,is_host:i===0,verified:true,guessed:false}));
const state=()=>({now:new Date().toISOString(),room:{code:'TEST1',mode:'kalambury',title:'Test',status:'open',phase:'turn',round_no:1,rounds:1,turn_no:1,
  turn_id:turn,drawer_id:drawer,host_id:drawer,version:1,turn_seconds:80,draw_mode:'turns',
  turn_started_at:new Date(picked?Date.now()-1000:pickUntil).toISOString(),turn_ends_at:new Date((picked?Date.now()-1000:pickUntil)+80000).toISOString()},
  me:{user_id:id,joined:true,kicked:false,is_host:id===drawer,nick:'Fren',guessed:false,cooldown_left:0},
  players,messages:[],mask:picked?picked.word.replace(/[a-z]/g,'_'):'',secret:id===drawer?(picked?picked.word:''):null,cooldown:2});
export async function getBackend(){return {kind:'supabase',session:()=>({user:{id}}),
  channel:()=>({send(){},close(){}}),
  rpc:async(fn,args)=>{window.calls.push([fn,args]);
    if(fn==='gry_state'||fn==='gry_join')return state();
    if(fn==='gry_me')return {user_id:id,nick:'Fren',verified:true};
    if(fn==='gry_word_choices')return id===drawer&&!picked?{until:new Date(pickUntil).toISOString(),choices:words}:null;
    if(fn==='gry_pick_word'){const t=args.p_tier&&id===drawer?args.p_tier:(Date.now()>=pickUntil?1:null);if(!t)return {ok:false,error:'wait'};picked=words[t-1];return {ok:true,tier:t};}
    return null;}
};}`;
const mime = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.webm': 'video/webm', '.mp4': 'video/mp4' };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname === '/games/js/backend.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(fixture); }
  const file = path.resolve(root, '.' + u.pathname);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.statusCode = 404; return res.end(); }
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  return res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ headless: true, executablePath: process.env.HAZE_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const errors = [];
  try {
    const open = async q => {
      const p = await browser.newPage({ viewport: { width: 1400, height: 900 } });
      p.on('pageerror', e => errors.push(e.message));
      await p.route('**/*', r => r.request().url().startsWith(base + '/') ? r.continue() : r.abort());
      await p.goto(base + '/games/room.html?r=TEST1' + q); await p.locator('#room:not(.hidden)').waitFor();
      return p;
    };
    // the artist sees three words with their bonus; no drawing yet
    const artist = await open('');
    await artist.locator('.pick-btn').first().waitFor();
    const cards = await artist.locator('.pick-btn').allInnerTexts();
    assert.equal(cards.length, 3);
    assert.match(cards[0], /Easy[\s\S]*frog/); assert.match(cards[1], /Medium · points ×1\.5[\s\S]*frog astronaut/); assert.match(cards[2], /Hard · points ×2[\s\S]*diamond hands/);
    assert.equal(await artist.locator('#cwrap.can-draw').count(), 0, 'no drawing while picking');
    await artist.waitForFunction(() => /\d+ s to pick/.test(document.querySelector('#pickin')?.textContent || ''));
    if (process.env.SHOT_DIR) await artist.screenshot({ path: path.join(process.env.SHOT_DIR, 'pepaint-pick-artist.png') });
    // the viewer waits
    const viewer = await open('&viewer=1');
    await viewer.locator('.inter-title').waitFor();
    assert.match(await viewer.locator('.inter-title').innerText(), /Fren0 is picking a word/);
    assert.equal(await viewer.locator('.pick-btn').count(), 0);
    assert.match(await viewer.locator('#chatin').getAttribute('placeholder'), /picking a word/);
    // pick the hard word: overlay goes, drawing opens, the word shows
    await artist.locator('.pick-btn[data-tier="3"]').click();
    await artist.locator('#cwrap.can-draw').waitFor();
    assert.equal(await artist.locator('#overlay.hidden').count(), 1);
    assert.match(await artist.locator('.word').innerText(), /diamond hands/);
    const picks = await artist.evaluate(() => window.calls.filter(([f]) => f === 'gry_pick_word').map(([, a]) => a.p_tier));
    assert.deepEqual(picks, [3]);
    // nobody picks in time: the artist's page settles it with the easy word
    const late = await open('&quick=1');
    await late.waitForFunction(() => window.calls.some(([f, a]) => f === 'gry_pick_word' && a.p_tier === null), null, { timeout: 8000 });
    await late.locator('#cwrap.can-draw').waitFor();
    assert.match(await late.locator('.word').innerText(), /frog/);
    assert.deepEqual(errors, []);
    console.log('PEPaint word choice browser test OK');
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
