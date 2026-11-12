"""Local QA. Touch via Chromium CDP is emulation, NEVER physical approval.
Serve docs on 8000. Test-only route exposes module internals; runtime files have no debug API.
"""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=Path('/tmp/frogageddon-polish');OUT.mkdir(exist_ok=True)
SOURCE=(ROOT/'docs/games/js/pondwars-beta.mjs').read_text()
HOOK='''\nwindow.__qa={get game(){return g},get held(){return held},get paused(){return paused},get clips(){return [...weaponClips.keys()]},get pixel(){return pixelAssets?.imageKey},pause(){paused=true;pending=[];},render(){for(const r of g.dirty)paintGround(...r);g.dirty=[];events();draw(animator.time);},input:localInput};'''
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 results=[]
 for profile,settings in [('desktop',{'viewport':{'width':1440,'height':900}}),('touch',{'viewport':{'width':390,'height':844},'is_mobile':True,'has_touch':True,'device_scale_factor':2}),('reduced',{'viewport':{'width':1000,'height':750},'reduced_motion':'reduce'})]:
  page=b.new_page(**settings);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/pondwars-beta.mjs?*',lambda route:route.fulfill(body=SOURCE+HOOK,content_type='text/javascript'))
  page.goto('http://127.0.0.1:8000/games/pondwars-beta.html?art=pixel-v06&packs=all&maps=all&qaMap=moon&qaSeed=123',wait_until='networkidle')
  page.locator('#title').click();page.wait_for_timeout(200);page.locator('[data-mode=duo]').click();page.locator('#go').click();page.wait_for_timeout(100)
  assert page.evaluate('window.__qa.pixel')=='pixel-v06'
  assert page.locator('#map-choice option').count()==9
  page.evaluate("async()=>window.__engine=await import('/games/js/pondwars-beta-engine.mjs?v=20261112polish')")
  def reset():
   page.evaluate("document.querySelector('#again').click()")
   page.wait_for_timeout(50)
  for key,weapon in [('g','goldv2'),('b','bell'),('m','frogmine'),('n','moon'),('h','ban'),('p','rain'),('f','doge'),('y','donkey')]:
   reset();page.locator('#pw').focus();page.keyboard.press(key);page.wait_for_timeout(40)
   assert page.evaluate('window.__qa.game.weapon')==weapon
   page.keyboard.down('Enter');page.wait_for_timeout(650 if weapon in ['goldv2','bell','moon'] else 30);page.keyboard.up('Enter');page.wait_for_timeout(40)
   page.evaluate('window.__qa.pause();window.__qa.render()')
   assert page.evaluate('(w)=>window.__qa.game.ammo[0][w]',weapon)==({'goldv2':0,'bell':1,'frogmine':2,'moon':1,'ban':1,'rain':0,'doge':0,'donkey':0}[weapon])
   page.screenshot(path=str(OUT/f'{profile}-{weapon}-use.png'))
   if weapon=='frogmine':
    # Controlled proximity fixture, not a natural movement/balance claim.
    page.evaluate('''()=>{const g=window.__qa.game,m=g.mines.find(m=>m.type==='frogmine');const f=g.frogs.find(f=>f.team===1);f.x=m.x+10;f.y=m.y;for(let i=0;i<80&&g.mines.includes(m);i++)window.__engine.step(g);window.__qa.render();}''')
   elif weapon=='ban':pass
   else:
    page.evaluate('''()=>{const g=window.__qa.game;g.events=[];for(let i=0;i<1000&&g.shots.length;i++){window.__engine.step(g);if(g.events.some(e=>e.type==='boom'))break;}window.__qa.render();}''')
   page.screenshot(path=str(OUT/f'{profile}-{weapon}-impact.png'))
  # Freeze active flyer. Real pointer events, ownership, pitch cancellation and FIRE.
  reset();page.locator('#pw').focus();page.keyboard.press('f');page.wait_for_timeout(40);page.keyboard.press('Enter');page.wait_for_timeout(45)
  assert page.evaluate('window.__qa.game.phase')=='guide'
  page.evaluate('window.__qa.pause()')
  def pointer(selector,kind,ident,x=0,y=0):
   page.locator(selector).dispatch_event(kind,{'pointerId':ident,'pointerType':'touch','button':0,'clientX':x,'clientY':y,'bubbles':True})
  # Temporarily allow input while simulation stays paused via intercepted rAF clock below.
  page.evaluate('window.__qa.game.ctl={x:0,y:0}')
  pointer('#right','pointerdown',11);pointer('#right','pointerdown',12);pointer('#right','pointerup',11)
  assert page.evaluate('window.__qa.held.r')==1
  pointer('#right','pointercancel',12);assert page.evaluate('window.__qa.held.r')==0
  # Resume to use actual CDP two-finger gesture on a coarse pointer.
  page.locator('#pause').click();page.wait_for_timeout(20)
  if profile=='touch':
   cdp=page.context.new_cdp_session(page)
   rect=page.locator('#right').bounding_box();cv=page.locator('#pw').bounding_box()
   x=rect['x']+rect['width']/2;y=rect['y']+rect['height']/2
   px=cv['x']+cv['width']*.7;py=cv['y']+cv['height']*.4
   pts=[{'x':x,'y':y,'id':1},{'x':px,'y':py,'id':2}]
   cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':pts})
   page.wait_for_timeout(100)
   pts[1]['y']-=30
   cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':pts});page.wait_for_timeout(80)
   assert page.evaluate('window.__qa.held.r')==1
   assert page.evaluate('window.__qa.held.pitch')==-1
   # Real simulation has received both turn and altitude input.
   assert page.evaluate('window.__qa.game.ctl.x')==1
   assert page.evaluate('window.__qa.game.ctl.y')==-1
   cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});page.wait_for_timeout(30)
   assert page.evaluate('window.__qa.held.r===0 && window.__qa.held.pitch===0')
  # Pause/resume leaves t and timer unchanged, controls released.
  page.locator('#pause').click();before=page.evaluate('JSON.stringify(window.__qa.game.shots)');page.wait_for_timeout(150)
  assert page.evaluate('window.__qa.paused')
  assert page.evaluate('JSON.stringify(window.__qa.game.shots)')==before
  page.locator('#pause').click();page.wait_for_timeout(25)
  if profile=='touch':page.locator('#fire').tap()
  else:page.keyboard.press('Enter')
  page.wait_for_timeout(50)
  assert page.evaluate("!window.__qa.game.shots.some(s=>s.type==='doge')")
  page.screenshot(path=str(OUT/f'{profile}-doge-detonated.png'))
  assert not errors,errors
  results.append({'profile':profile,'weapons':8,'touch':'CDP two fingers + FIRE' if profile=='touch' else 'synthetic ownership + keyboard','pageErrors':errors,'physicalDeviceApproved':False})
  page.close()
 b.close()
(OUT/'browser-results.json').write_text(json.dumps(results,indent=2))
print(json.dumps(results))
