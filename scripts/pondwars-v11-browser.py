"""Local v11 art QA; test-only source route, no debug API in production files.
Requires docs on port 8000. Touch profile is emulation, never physical approval.
"""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=Path('/tmp/frogageddon-v11');OUT.mkdir(exist_ok=True)
SOURCE=(ROOT/'docs/games/js/pondwars-beta.mjs').read_text()
HOOK='''
window.__qa={get game(){return g},get fx(){return weaponFX},get time(){return animator.time},get clips(){return [...weaponClips.entries()].map(([key,c])=>({key,...c,image:undefined,loaded:!!c.image.naturalWidth}))},
 pause(){paused=true;pending=[];},render(){for(const r of g.dirty)paintGround(...r);g.dirty=[];events();draw(animator.time);},
 tick(n=1,until=''){let hit=null;for(let i=0;i<n;i++){for(const o of [...g.frogs,...g.shots])previousPose.set(o,{x:o.x,y:o.y});applyInput(g,{m:0,a:[]});animator.advance(STEP);acc=STEP;hit=g.events.find(e=>e.type==='boom'&&e.weapon===until)||null;this.render();if(hit)break;}return hit;},
 detonate(){applyInput(g,{m:0,a:[{t:'detonate'}]});this.render();},clip:drawWeaponClip,shot,authored:authoredExplosionAt};
'''
PROBE='''
window.__pngDraws=[];
const draw=CanvasRenderingContext2D.prototype.drawImage;
CanvasRenderingContext2D.prototype.drawImage=function(im,...args){if(this.canvas.id==='pw'&&im.src?.includes('/v11/')){const t=this.getTransform();window.__pngDraws.push({file:im.src.split('/').pop(),args,matrix:[t.a,t.b,t.c,t.d,t.e,t.f],smoothing:this.imageSmoothingEnabled});}return draw.call(this,im,...args);};
'''
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 results=[]
 for name,settings in [('desktop',{'viewport':{'width':1440,'height':900}}),('touch',{'viewport':{'width':390,'height':844},'is_mobile':True,'has_touch':True,'device_scale_factor':2}),('reduced',{'viewport':{'width':1000,'height':750},'reduced_motion':'reduce'})]:
  page=browser.new_page(**settings);errors=[];requests=[]
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url));page.add_init_script(PROBE)
  page.route('**/pondwars-beta.mjs?*',lambda r:r.fulfill(body=SOURCE+HOOK,content_type='text/javascript'))
  page.goto('http://127.0.0.1:8000/games/pondwars-beta.html?art=pixel-v06&packs=all&maps=all&qaMap=moon&qaSeed=123',wait_until='networkidle')
  page.wait_for_function("window.__qa.clips.filter(c=>c.src.includes('/v11/')).length===6&&window.__qa.clips.every(c=>c.loaded)")
  page.locator('#title').click();page.wait_for_timeout(150);page.locator('[data-mode=duo]').click();page.locator('#go').click();page.wait_for_timeout(70)
  samples=page.evaluate('''()=>{window.__qa.pause();let count=0;for(const c of window.__qa.clips.filter(c=>c.src.includes('/v11/'))){const [id,role]=c.key.split('/');for(let n=0;n<c.frames;n++){window.__pngDraws=[];const ok=window.__qa.clip(id,role,(n+.1)/c.fps,600,160);const d=window.__pngDraws[0];if(!ok||!d||d.smoothing||d.args[0]!==((matchMedia('(prefers-reduced-motion: reduce)').matches?(c.reducedFrame||0):n)*128)||d.args[6]!==c.size[0]||d.args[7]!==c.size[1])throw Error('wrong frame '+c.key+'/'+n);count++;}}return count;}''')
  assert samples==44
  def aim_point(x,y):
   pos=page.locator('#pw').evaluate('(c,p)=>{const r=c.getBoundingClientRect(),scale=Math.min(r.width/c.width,r.height/600);return {x:r.left+(r.width-c.width*scale)/2+(p.x+(c.width-1200)/2)*scale,y:r.top+(r.height-600*scale)/2+p.y*scale}}',{'x':x,'y':y})
   page.mouse.move(pos['x'],pos['y'])
  # Authored axes: Doge points right, Moon's source nose is 45 degrees up-right.
  page.evaluate('''()=>{for(const id of ['doge','moon'])for(const a of [0,Math.PI/2,Math.PI,-Math.PI/2]){window.__pngDraws=[];window.__qa.shot({type:id,x:600,y:200,vx:Math.cos(a)*100,vy:Math.sin(a)*100,t:.15});const d=window.__pngDraws[0],expected=a+(id==='moon'?Math.PI/4:0);if(Math.abs(d.matrix[0]-Math.cos(expected))>1e-8||Math.abs(d.matrix[1]-Math.sin(expected))>1e-8)throw Error('wrong rotation '+id);}}''')
  def reset():
   page.evaluate("document.querySelector('#again').click()")
   page.wait_for_timeout(60)
  pauses=0
  for key,weapon in [('f','doge'),('y','donkey'),('n','moon'),('p','rain')]:
   reset();page.locator('#pw').focus();page.keyboard.press(key);page.wait_for_timeout(30)
   if weapon in ['donkey','rain']:aim_point(1000,300) # Unobstructed real column; the spawn under the floating island can collide immediately.
   page.keyboard.down('Enter');page.wait_for_timeout(600 if weapon=='moon' else 30);page.keyboard.up('Enter');page.wait_for_timeout(35)
   page.locator('#pause').click()
   if weapon=='donkey':
    page.screenshot(path=str(OUT/f'{name}-donkey-warning.png'))
    page.evaluate("()=>{let n=0;while(window.__qa.game.shots.find(s=>s.type==='donkey')?.warning&&n++<80)window.__qa.tick();}")
    page.evaluate('window.__qa.tick(5)')
   else:page.evaluate('(n)=>window.__qa.tick(n)',16 if weapon=='rain' else 8)
   page.evaluate('window.__pngDraws=[];window.__qa.render()')
   file={'doge':'doge_flyer_atlas.png','donkey':'silver_donkey_atlas.png','moon':'moon_rocket_atlas.png','rain':'pep_rain_atlas.png'}[weapon]
   calls=page.evaluate('(file)=>window.__pngDraws.filter(d=>d.file===file)',file)
   assert calls, (name,weapon,'PNG flight absent')
   if weapon=='rain':assert len(calls)==6,(name,len(calls),page.evaluate('window.__qa.game.shots.map(s=>[s.type,s.t,s.y])'))
   if name=='reduced':assert all(c['args'][0]==0 for c in calls)
   if weapon=='donkey':assert all(c['args'][0]<3*128 for c in calls),'warning age leaked into flight animation'
   page.screenshot(path=str(OUT/f'{name}-{weapon}-flight.png'))
   before=page.evaluate('JSON.stringify({shots:window.__qa.game.shots,time:window.__qa.time,fx:window.__qa.fx})');canvas=page.locator('#pw').evaluate('(c)=>c.toDataURL()');page.wait_for_timeout(180)
   assert page.evaluate('JSON.stringify({shots:window.__qa.game.shots,time:window.__qa.time,fx:window.__qa.fx})')==before
   assert page.locator('#pw').evaluate('(c)=>c.toDataURL()')==canvas;pauses+=1
   if weapon=='doge':
    # Use actual UI FIRE/Enter while flight resumes.
    page.locator('#pause').click()
    if name=='touch':page.locator('#fire').tap()
    else:page.keyboard.press('Enter')
    page.wait_for_timeout(35);page.locator('#pause').click()
   else:
    hit=page.evaluate('(type)=>window.__qa.tick(1200,type)','pep' if weapon=='rain' else weapon)
    assert hit,(name,weapon,'no real impact')
   if weapon in ['doge','donkey']:
    assert page.evaluate('(type)=>window.__qa.fx.some(e=>e.weapon===type&&e.authored)',weapon)
    # Capture visible middle of the authored burst while preserving real impact coordinates.
    page.evaluate('window.__qa.tick(10);window.__pngDraws=[];window.__qa.render()')
    blastfile='doge_blast_atlas.png' if weapon=='doge' else 'donkey_impact_atlas.png'
    burst=page.evaluate('(file)=>window.__pngDraws.filter(d=>d.file===file)',blastfile)
    assert burst,(name,weapon,'PNG burst absent')
    if name=='reduced':assert burst[0]['args'][0]==4*128
    assert page.evaluate('window.__qa.game.booms.every(b=>window.__qa.authored(b))')
    before=page.evaluate('window.__qa.time');page.wait_for_timeout(120);assert page.evaluate('window.__qa.time')==before
   page.screenshot(path=str(OUT/f'{name}-{weapon}-impact.png'))
   reset();page.evaluate('window.__qa.pause()')
   assert page.evaluate('window.__qa.fx.length===0 && window.__qa.game.shots.length===0')
  assert not any('ban_hammer_atlas.png' in r for r in requests),'Ban concept was auto-loaded'
  assert not errors,errors
  results.append({'profile':name,'sampledFrames':44,'rotationAngles':8,'pausedFlights':pauses,'restartClearsFX':True,'manualDogeDetonation':True,'sixPEPDrops':True,'pageErrors':errors,'physicalDeviceApproved':False})
  page.close()
 browser.close()
(OUT/'browser-results.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results))
