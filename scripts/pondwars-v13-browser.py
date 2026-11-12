"""V13 FX QA and real-time board recordings. No debug API in shipped modules.
Serve docs on :8000; recordings use normal rAF simulation at 1200x800, no zoom.
"""
import json,os,shutil,argparse
import playwright
from pathlib import Path
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser();parser.add_argument('--skip-video',action='store_true');args=parser.parse_args()
ROOT=Path(__file__).resolve().parents[1];OUT=Path('/tmp/frogageddon-v13');OUT.mkdir(exist_ok=True)
# Use the installed system ffmpeg in an isolated writable Playwright runtime.
if shutil.which('ffmpeg'):
 os.environ['PLAYWRIGHT_BROWSERS_PATH']=str(OUT/'playwright-runtime')
 registry=json.loads((Path(playwright.__file__).parent/'driver/package/browsers.json').read_text())
 revision=next(b['revision'] for b in registry['browsers'] if b['name']=='ffmpeg')
 ff=OUT/('playwright-runtime/ffmpeg-'+revision+'/ffmpeg-linux');ff.parent.mkdir(parents=True,exist_ok=True)
 if not ff.exists():ff.symlink_to(shutil.which('ffmpeg'))
SOURCE=(ROOT/'docs/games/js/pondwars-beta.mjs').read_text();PATCH=json.loads((ROOT/'docs/games/art/arsenal-polish/v13/handoff/manifest_patch.json').read_text())
HOOK='''
window.__qa={get game(){return g},get fx(){return weaponFX},get time(){return animator.time},get clips(){return [...weaponClips.entries()].map(([key,c])=>({key,...c,image:undefined,loaded:!!c.image.naturalWidth}))},
 render(){window.__calls=[];for(const r of g.dirty)paintGround(...r);g.dirty=[];events();hud();draw(animator.time);},
 prepare(){paused=true;pending=[];resetSteering();g=newGame({seed:123,map:'farm',perTeam:2,cpu:[false,false],packs:'all'});startTurn(g);animator.reset();helmets.restore(g);parts=[];splashes=[];shake=0;weaponFX=[];acc=STEP;paintGround();this.render();},
 fire(w,face=1,distance=null){if(w==='ban'){const f=me(g),target=g.frogs.find(f=>f.team===1);Object.assign(f,{x:face>0?300:900,y:399,vx:0,vy:0,ground:true});let y=0;while(y<WATER&&!solid(g.mask,f.x,y))y++;f.y=y-1;Object.assign(target,{x:f.x+face*distance,y:f.y,vx:0,vy:0,ground:true});for(const other of g.frogs)if(other!==f&&other!==target){other.x=face>0?900+other.id*40:150+other.id*40;let y=0;while(y<WATER&&!solid(g.mask,other.x,y))y++;other.y=y-1;}}aim=face>0?-.8:-Math.PI+.8;applyInput(g,{m:0,a:[{t:'weapon',w},{t:'fire',a:aim,p:.5,x:1000,y:300}]});this.render();},
 tick(n=1,until=''){let hit=null;for(let i=0;i<n;i++){for(const o of [...g.frogs,...g.shots])previousPose.set(o,{x:o.x,y:o.y});applyInput(g,{m:0,a:[]});animator.advance(STEP);acc=STEP;hit=g.events.find(e=>e.type==='boom'&&e.weapon===until)||null;this.render();if(hit)break;}return hit;},
 detonate(){applyInput(g,{m:0,a:[{t:'detonate'}]});this.render();},
 stress(){this.prepare();this.fire('rain');for(const s of g.shots){let y=0;while(y<WATER&&!solid(g.mask,s.x,y))y++;s.y=y-1;s.vy=100;s.t=0;}this.tick();},
 skin(index){teamPlayers[0][0]=index;},hand(){return weaponHand(g.frogs[0]);},
 resume(){paused=false;last=performance.now();acc=0;},pause(){paused=true;pending=[];},clip:drawWeaponClip};
'''
PROBE='''window.__calls=[];const image=CanvasRenderingContext2D.prototype.drawImage, text=CanvasRenderingContext2D.prototype.fillText;
CanvasRenderingContext2D.prototype.drawImage=function(im,...args){if(this.canvas.id==='pw'&&im.src){const t=this.getTransform();window.__calls.push({kind:'image',src:im.src,args,m:[t.a,t.b,t.c,t.d,t.e,t.f],smoothing:this.imageSmoothingEnabled});}return image.call(this,im,...args);};
CanvasRenderingContext2D.prototype.fillText=function(txt,...args){if(this.canvas.id==='pw')window.__calls.push({kind:'text',text:String(txt)});return text.call(this,txt,...args);};'''

def setup(page):
 page.add_init_script(PROBE)
 page.route('**/pondwars-beta.mjs?*',lambda r:r.fulfill(body=SOURCE+HOOK,content_type='text/javascript'))
 page.goto('http://127.0.0.1:8000/games/pondwars-beta.html?art=pixel-v06&packs=all&maps=all&qaMap=farm&qaSeed=123',wait_until='networkidle')
 for attempt in range(50):
  if page.evaluate("window.__qa?.clips.filter(c=>c.src.includes('/v13/')).length===6&&window.__qa.clips.every(c=>c.loaded)"):break
  page.wait_for_timeout(100)
 else:raise AssertionError(page.evaluate('window.__qa.clips'))
 page.locator('#title').click();page.wait_for_timeout(150);page.locator('[data-mode=duo]').click();page.locator('#go').click();page.wait_for_timeout(70)

def calls(page,filename):return page.evaluate('(name)=>window.__calls.filter(c=>c.src?.endsWith(name))',filename)
def legible(page):
 assert page.evaluate("()=>{const fx=window.__calls.map((c,i)=>c.src?.includes('/v13/')?i:-1).filter(i=>i>=0),labels=window.__calls.map((c,i)=>c.kind==='text'&&/^(Hopper|Lily|Toady|Ribbit|Croak|Bog).*\\d+$/.test(c.text)?i:-1).filter(i=>i>=0);return fx.length&&labels.length&&Math.max(...fx)<Math.min(...labels);}")
def freeze_check(page):
 before=page.evaluate('JSON.stringify({shots:window.__qa.game.shots,fx:window.__qa.fx,time:window.__qa.time})');png=page.locator('#pw').evaluate('(c)=>c.toDataURL()');page.wait_for_timeout(140)
 assert page.evaluate('JSON.stringify({shots:window.__qa.game.shots,fx:window.__qa.fx,time:window.__qa.time})')==before
 assert page.locator('#pw').evaluate('(c)=>c.toDataURL()')==png

with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);results=[]
 for profile,opts in [('desktop',{'viewport':{'width':1440,'height':900}}),('touch',{'viewport':{'width':390,'height':844},'has_touch':True,'is_mobile':True,'device_scale_factor':2}),('reduced',{'viewport':{'width':1000,'height':750},'reduced_motion':'reduce'})]:
  page=browser.new_page(**opts);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));setup(page)
  page.evaluate('window.__qa.prepare()')
  count=page.evaluate("()=>{let count=0;for(const c of window.__qa.clips.filter(c=>c.src.includes('/v13/'))){const [w,role]=c.key.split('/');for(let n=0;n<c.frames;n++){window.__calls=[];if(!window.__qa.clip(w,role,(n+.1)/c.fps,600,160))throw Error('missing clip');const d=window.__calls[0],index=matchMedia('(prefers-reduced-motion: reduce)').matches?c.reducedFrame:n;if(d.args[0]!==index*128||d.smoothing||d.args[6]!==c.size[0]||d.args[7]!==c.size[1])throw Error('bad frame '+c.key);count++;}}return count;}")
  assert count==42
  for weapon in ['doge','donkey','moon','rain']:
   page.evaluate('window.__qa.prepare()');page.evaluate('(w)=>window.__qa.fire(w)',weapon)
   if weapon=='donkey':
    page.evaluate('window.__qa.tick(20)');assert page.evaluate('window.__qa.game.shots[0].warning')
    c=calls(page,'donkey_warning_v13_atlas.png');assert c
    assert abs(c[0]['m'][5]-(page.evaluate('window.__qa.game.shots[0].y')-120))<1e-8
    legible(page);freeze_check(page);page.screenshot(path=str(OUT/f'{profile}-warning.png'))
   if weapon=='doge':page.evaluate('window.__qa.tick(12);window.__qa.detonate()')
   else:assert page.evaluate('(w)=>window.__qa.tick(900,w)', 'pep' if weapon=='rain' else weapon)
   page.evaluate('window.__qa.tick(9)')
   id='pep' if weapon=='rain' else weapon
   descriptor=PATCH['weapons'][id]['explosion'];c=calls(page,Path(descriptor['src']).name);assert c,(profile,weapon)
   if profile=='reduced':assert c[0]['args'][0]==descriptor['reducedFrame']*128
   legible(page);freeze_check(page);page.screenshot(path=str(OUT/f'{profile}-{weapon}-impact.png'))
  # All six normal PEP subprojectiles hit in one fixed step: stress timing fixture only.
  page.evaluate('window.__qa.stress();window.__qa.tick(2)')
  assert page.evaluate("window.__qa.fx.filter(e=>e.weapon==='pep').length")==6
  assert len(calls(page,'pep_impact_v13_atlas.png'))==6
  legible(page);freeze_check(page);page.screenshot(path=str(OUT/f'{profile}-six-pep.png'))
  # Near-side contact, strict boundary and whiff. Both facing directions.
  for face in [-1,1]:
   for distance in [35,47.99,48,55]:
    page.evaluate('window.__qa.prepare()');page.evaluate('([face,d])=>window.__qa.fire("ban",face,d)',[face,distance]);page.evaluate('window.__qa.tick(2)')
    c=calls(page,'ban_impact_v13_atlas.png');assert bool(c)==(distance<48),(profile,face,distance)
    assert page.evaluate('window.__qa.game.frogs[1].hp')==(58 if distance<48 else 100)
    if distance==35:
     page.evaluate('window.__qa.tick(10)');legible(page);freeze_check(page);page.screenshot(path=str(OUT/f'{profile}-ban-{face}.png'))
  # Existing Ban SVG grip pixel lands exactly on the same animated hand as Pepe.
  for skin in range(8):
   page.evaluate('window.__qa.prepare()');page.evaluate('(i)=>window.__qa.skin(i)',skin);page.evaluate('window.__qa.fire("ban",1,35)')
   c=calls(page,'/ban.svg');assert c,(profile,skin)
   grip=c[-1];hand=page.evaluate('window.__qa.hand()');ox=page.locator('#pw').evaluate('(c)=>(c.width-1200)/2')
   assert abs(grip['args'][0]+34*grip['args'][2]/64)<1e-8
   assert abs(grip['args'][1]+46*grip['args'][3]/64)<1e-8
   assert abs(grip['m'][4]-(hand['x']+ox))<1e-8 and abs(grip['m'][5]-hand['y'])<1e-8
  page.evaluate("document.querySelector('#again').click()")
  assert page.evaluate('window.__qa.fx.length===0&&window.__qa.game.shots.length===0')
  assert not errors,errors
  results.append({'profile':profile,'frames':42,'sameTickPEP':6,'banDistances':[35,47.99,48,55],'banDirections':2,'gripSkins':8,'pause':True,'restart':True,'pageErrors':errors,'physicalDeviceApproved':False})
  page.close()
 (OUT/'browser-results.json').write_text(json.dumps(results,indent=2)+'\n')
 # Short independent real-time recordings. These use normal requestAnimationFrame;
 # no fixed-step scrubbing or source-atlas previews stand in for live animation.
 recordings=json.loads((OUT/'recordings.json').read_text()) if args.skip_video else []
 for weapon in ([] if args.skip_video else ['doge','donkey','moon','rain','ban']):
  context=browser.new_context(viewport={'width':1200,'height':800},record_video_dir=str(OUT/'video-source'),record_video_size={'width':1200,'height':800})
  page=context.new_page();setup(page);page.evaluate('window.__qa.prepare()')
  if weapon=='ban':page.evaluate('window.__qa.fire("ban",1,35)')
  else:page.evaluate('(w)=>window.__qa.fire(w)',weapon)
  page.evaluate('window.__qa.resume()')
  if weapon=='doge':page.wait_for_timeout(550);page.keyboard.press('Enter');page.wait_for_timeout(900)
  else:page.wait_for_timeout({'donkey':2600,'moon':1700,'rain':2100,'ban':850}[weapon])
  page.evaluate('window.__qa.pause()');page.wait_for_timeout(200)
  video=page.video;page.close();context.close();path=video.path();recordings.append({'weapon':weapon,'path':str(path)})
 browser.close()
(OUT/'browser-results.json').write_text(json.dumps(results,indent=2)+'\n');(OUT/'recordings.json').write_text(json.dumps(recordings,indent=2)+'\n');print(json.dumps(results))
