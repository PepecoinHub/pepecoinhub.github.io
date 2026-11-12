"""Paired v11/v12 Donkey flight on the same actual terrain, using normal engine inputs.
Only the old-variant manifest and test accessors are routed; production JS is unchanged.
"""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=Path('/tmp/frogageddon-v12');OUT.mkdir(exist_ok=True)
SOURCE=(ROOT/'docs/games/js/pondwars-beta.mjs').read_text()
CURRENT=json.loads((ROOT/'docs/games/art/arsenal-polish/manifest.json').read_text())
OLD=json.loads((ROOT/'docs/games/art/arsenal-polish/v11/handoff/manifest_patch.json').read_text())['donkey']['flight']
HOOK='''
window.__qa={get game(){return g},get fx(){return weaponFX},get clips(){return [...weaponClips.values()].every(c=>c.image.naturalWidth)},
 render(){for(const r of g.dirty)paintGround(...r);g.dirty=[];events();draw(animator.time);},
 launch(){paused=true;pending=[];g=newGame({seed:123,map:'moon',perTeam:3,cpu:[false,false],packs:'all'});startTurn(g);animator.reset();helmets.restore(g);parts=[];splashes=[];shake=0;weaponFX=[];acc=STEP;paintGround();applyInput(g,{m:0,a:[{t:'weapon',w:'donkey'},{t:'fire',a:0,p:1,x:1000,y:300}]});this.render();},
 tick(){for(const o of [...g.frogs,...g.shots])previousPose.set(o,{x:o.x,y:o.y});applyInput(g,{m:0,a:[]});animator.advance(STEP);acc=STEP;this.render();},
 restore(snap){window.__netlib.restoreInto(g,snap);animator.reset();helmets.restore(g);parts=[];weaponFX=[];acc=STEP;this.render();},shot};
'''
PROBE='''window.__draws=[];const draw=CanvasRenderingContext2D.prototype.drawImage;
CanvasRenderingContext2D.prototype.drawImage=function(im,...args){if(this.canvas.id==='pw'&&im.src?.includes('silver_donkey_atlas.png')){const t=this.getTransform();window.__draws.push({src:im.src,args,m:[t.a,t.b,t.c,t.d,t.e,t.f],smoothing:this.imageSmoothingEnabled});}return draw.call(this,im,...args);};'''
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);results=[]
 for profile,opts in [('desktop',{'viewport':{'width':1440,'height':900}}),('touch',{'viewport':{'width':390,'height':844},'has_touch':True,'is_mobile':True,'device_scale_factor':2}),('reduced',{'viewport':{'width':1000,'height':750},'reduced_motion':'reduce'})]:
  pair=[]
  for version in ['v11','v12']:
   page=b.new_page(**opts);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.add_init_script(PROBE)
   manifest=json.loads(json.dumps(CURRENT))
   if version=='v11':manifest['weapons']['donkey']['flight']=OLD
   page.route('**/art/arsenal-polish/manifest.json?*',lambda r:r.fulfill(body=json.dumps(manifest),content_type='application/json'))
   page.route('**/pondwars-beta.mjs?*',lambda r:r.fulfill(body=SOURCE+HOOK,content_type='text/javascript'))
   page.goto('http://127.0.0.1:8000/games/pondwars-beta.html?art=pixel-v06&packs=all&maps=all&qaMap=moon&qaSeed=123',wait_until='networkidle')
   page.wait_for_function('window.__qa.clips');page.locator('#title').click();page.wait_for_timeout(100);page.locator('[data-mode=duo]').click();page.locator('#go').click();page.wait_for_timeout(60)
   page.evaluate("async()=>window.__netlib=await import('/games/js/pondwars-beta-net.mjs?v=20261112polish')")
   page.evaluate('window.__qa.launch()')
   frames={};steps=0;paused=False
   while page.evaluate("window.__qa.game.shots.some(s=>s.type==='donkey')") and steps<180:
    s=page.evaluate("window.__qa.game.shots.find(s=>s.type==='donkey')")
    if not s['warning']:
     n=page.evaluate("Math.floor(Math.max(0,window.__qa.game.shots[0].t-1.15)*12)%8")
     if n not in frames:
      page.evaluate('window.__draws=[];window.__qa.render()')
      d=page.evaluate('window.__draws[0]');assert d and not d['smoothing']
      assert d['args'][0]==(0 if profile=='reduced' else n)*128
      assert d['args'][6:]==[52,52]
      assert d['m'][:4]==[1,0,0,1],'Donkey unexpectedly rotated during vertical fall'
      expected=-26 if version=='v11' else -52*52/128
      assert d['args'][4]==expected
      bodyx=d['m'][4]+d['args'][4]+(64 if version=='v11' else 52)*52/128
      frames[n]={'x':s['x'],'y':s['y'],'t':s['t'],'bodyWorldCanvasX':bodyx,'matrix':d['m'],'hash':page.evaluate('window.__netlib.stateHash(window.__qa.game)')}
      page.screenshot(path=str(OUT/f'{profile}-{version}-frame-{n}.png'))
      if n==3:
       before=page.evaluate('window.__netlib.stateHash(window.__qa.game)');image=page.locator('#pw').evaluate('(c)=>c.toDataURL()');page.wait_for_timeout(140)
       assert page.evaluate('window.__netlib.stateHash(window.__qa.game)')==before
       assert page.locator('#pw').evaluate('(c)=>c.toDataURL()')==image;paused=True
    page.evaluate('window.__qa.tick()');steps+=1
   assert set(frames)==set(range(8)),(profile,version,list(frames))
   page.screenshot(path=str(OUT/f'{profile}-{version}-impact.png'))
   finalhash=page.evaluate('window.__netlib.stateHash(window.__qa.game)')
   # Restore an actual mid-flight snapshot, then continue to exactly the same final tick.
   page.evaluate('window.__qa.launch()')
   for i in range(85):page.evaluate('window.__qa.tick()')
   snap=page.evaluate('window.__netlib.snapshot(window.__qa.game)');assert snap['shots'] and not snap['shots'][0]['warning']
   for i in range(3):page.evaluate('window.__qa.tick()')
   page.evaluate('(snap)=>window.__qa.restore(snap)',snap)
   for i in range(steps-85):page.evaluate('window.__qa.tick()')
   assert page.evaluate('window.__netlib.stateHash(window.__qa.game)')==finalhash
   # Directional velocity is a rendering probe only; Donkey keeps the existing upright art.
   page.evaluate("()=>{for(const vx of [-200,0,200]){window.__draws=[];window.__qa.shot({type:'donkey',x:1000,y:200,vx,vy:100,t:1.3,warning:false});if(JSON.stringify(window.__draws[0].m.slice(0,4))!=='[1,0,0,1]')throw Error('rotation changed');}}")
   page.evaluate("document.querySelector('#again').click()")
   assert page.evaluate('window.__qa.fx.length===0&&window.__qa.game.shots.length===0')
   assert not errors,errors
   pair.append({'version':version,'frames':frames,'steps':steps,'hash':finalhash,'pause':paused,'restore':True,'restart':True,'pageErrors':errors})
   page.close()
  assert pair[0]['frames']==pair[1]['frames'],'variant changed physical state, anchor or rotation'
  assert pair[0]['hash']==pair[1]['hash']
  results.append({'profile':profile,'variants':pair,'identicalPhysicsAndBodyPosition':True,'physicalDeviceApproved':False})
 b.close()
(OUT/'browser-results.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps([{'profile':r['profile'],'framesPerVariant':8,'identicalPhysicsAndBodyPosition':True,'physicalDeviceApproved':False} for r in results]))
