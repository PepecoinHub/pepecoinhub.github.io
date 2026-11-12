# Local QA only. Serve docs on port 8000; requires Playwright and Chromium.
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

out = Path('/tmp/pondwars-pixel-v06-artifacts')
out.mkdir(parents=True, exist_ok=True)
probe = '''
window.__draws=[];
const fill=CanvasRenderingContext2D.prototype.fillRect;
CanvasRenderingContext2D.prototype.fillRect=function(...args){
  if(this.canvas.id==='pw' && args[1]===0 && args[3]===600)window.__draws=[];
  return fill.apply(this,args);
};
const draw=CanvasRenderingContext2D.prototype.drawImage;
CanvasRenderingContext2D.prototype.drawImage=function(image,...args){
  if(this.canvas.id==='pw' && image.src){if(window.__capture && image.src.endsWith('/atlas.png') && !window.__draws.some(d=>d.file==='atlas.png') && window.__animator?.actors.get(0)?.state==='backflip')window.__timeline.push(args.slice(0,4));const t=this.getTransform();window.__draws.push({file:image.src.split('/').pop(),args,smoothing:this.imageSmoothingEnabled,matrix:[t.a,t.b,t.c,t.d,t.e,t.f]});}
  return draw.call(this,image,...args);
};
'''
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    for name, options in [
        ('desktop',{'viewport':{'width':1440,'height':900}}),
        ('phone',{'viewport':{'width':390,'height':844},'is_mobile':True,'has_touch':True,'device_scale_factor':2}),
        ('reduced',{'viewport':{'width':1000,'height':750},'reduced_motion':'reduce'})]:
        page=browser.new_page(**options)
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.add_init_script(probe)
        page.goto('http://127.0.0.1:8000/games/pondwars-beta.html?art=pixel-v06',wait_until='networkidle')
        page.evaluate('''async()=>{
          const {CharacterAnimator}=await import('/games/js/pondwars-animation.mjs?v=20261112pixel');
          const observe=CharacterAnimator.prototype.observe, sample=CharacterAnimator.prototype.sample;
          CharacterAnimator.prototype.observe=function(g,...args){window.__game=g;window.__animator=this;return observe.call(this,g,...args);};
          CharacterAnimator.prototype.sample=function(f,...args){const pose=sample.call(this,f,...args);return f.id===0 && window.__force ? {...pose,...window.__force,rotation:.8,sx:1.4,sy:.6,dx:5,dy:3}:pose;};
        }''')
        page.locator('#title').click()
        page.wait_for_timeout(500)
        assert page.locator('#art-prototype').is_visible()
        assert page.locator('#players0 select').first.locator('option').count()==8
        page.locator('[data-mode=duo]').click()
        page.locator('#go').click()
        page.wait_for_timeout(150)
        def calls(file):
            return page.evaluate('(file)=>window.__draws.filter(d=>d.file===file)',file)
        assert len(calls('atlas.png'))==6
        assert len(calls('helmet_pose_atlas.png'))==6
        page.screenshot(path=str(out/(name+'-start.png')))
        manifest=page.evaluate("fetch('img/pondwars/players/pixel-v06/manifest.json').then(r=>r.json())")
        page.evaluate('window.__capture=true;window.__timeline=[]')
        page.locator('#pw').focus();page.keyboard.press('Space');page.wait_for_timeout(70);page.keyboard.press('Space')
        page.wait_for_timeout(820)
        timeline=page.evaluate('window.__timeline')
        expected_turn=manifest['clips']['backflip']['frames']
        seen={tuple(rect) for rect in timeline}
        if name=='reduced': assert seen=={tuple(expected_turn[0]['rect'])}
        else: assert all(tuple(frame['rect']) in seen for frame in expected_turn),'real backflip missed authored frame'
        page.screenshot(path=str(out/(name+'-backflip-finish.png')))
        page.evaluate('window.__capture=false')
        page.locator('#restart').click();page.locator('#go').click();page.wait_for_timeout(120)
        checked=0
        for state, clip in manifest['clips'].items():
            for index, frame in enumerate(clip['frames']):
                age=(index+.1)/clip['fps']
                page.evaluate('(pose)=>window.__force=pose',{'state':state,'age':age})
                page.wait_for_timeout(35)
                rendered=calls('atlas.png')[0]
                expected=clip['frames'][0 if name=='reduced' else index]['rect']
                assert rendered['args'][:4]==expected,(name,state,index,rendered)
                a,b,c,d,_,_=rendered['matrix']
                assert abs(a)==1 and b==0 and c==0 and d==1,'procedural deformation doubled authored motion'
                assert rendered['smoothing'] is False
                checked+=1
        # Three weapon layers use the precise measured grip, in both directions.
        for face in [-1,1]:
            target=page.evaluate('''face=>{
              const cv=document.querySelector('#pw'),r=cv.getBoundingClientRect(),g=window.__game,f=g.frogs[0];
              const scale=Math.min(r.width/cv.width,r.height/600),ox=(cv.width-1200)/2;
              return [r.x+(r.width-cv.width*scale)/2+(f.x+face*150+ox)*scale,r.y+(r.height-600*scale)/2+(f.y-80)*scale];
            }''',face)
            page.mouse.move(*target)
            for weapon in ['grenade','rocket','bow','revolver']:
                page.evaluate('weapon=>{window.__game.weapon=weapon;window.__force={state:"aim",age:.01};}',weapon)
                page.wait_for_timeout(50)
                body=calls('atlas.png')[0]
                weapon_draw=calls(weapon+'.svg')[0]
                # First aim frame artist hand [96,60], foot [64,122], scale .5.
                # Canvas body transform translates to (f.x+OX, f.y-29).
                expected_x=body['matrix'][4]+face*(96-64)*.5
                expected_y=body['matrix'][5]+29+(60-122)*.5
                assert abs(weapon_draw['matrix'][4]-expected_x)<1e-6
                assert abs(weapon_draw['matrix'][5]-expected_y)<1e-6
                hold=page.evaluate("async weapon=>(await import('/games/js/pondwars-v06-art.mjs?v=20261112pixel06')).v06WeaponHold(weapon)",weapon)
                assert weapon_draw['args']==[hold['ox'],hold['oy'],hold['w'],hold['h']]
                page.screenshot(path=str(out/(name+'-'+str(face)+'-'+weapon+'.png')))
        page.evaluate('window.__force=null;window.__game.weapon="grenade"')
        page.locator('#pw').focus()
        page.keyboard.down('Enter')
        page.wait_for_timeout(180)
        page.keyboard.up('Enter')
        page.wait_for_timeout(350)
        assert page.evaluate('window.__animator.sample(window.__game.frogs[0]).state')=='fire'
        page.screenshot(path=str(out/(name+'-live-fire.png')))
        # Reset, then check first 1 HP loss, pause and no replay on the next hit.
        page.locator('#restart').click();page.locator('#go').click();page.wait_for_timeout(120)
        page.evaluate('window.__game.frogs[0].hp--')
        page.wait_for_timeout(60)
        assert len(calls('helmet_pose_atlas.png'))==(5 if name=='reduced' else 6)
        page.screenshot(path=str(out/(name+'-damage.png')))
        page.locator('#pause').click();page.wait_for_timeout(40)
        before=page.locator('#pw').screenshot();page.wait_for_timeout(250)
        assert before==page.locator('#pw').screenshot()
        page.locator('#pause').click()
        page.evaluate('window.__game.frogs[0].hp--');page.wait_for_timeout(50)
        assert len(calls('helmet_pose_atlas.png'))==(5 if name=='reduced' else 6)
        page.wait_for_timeout(1600)
        assert len(calls('helmet_pose_atlas.png'))==5
        page.locator('#restart').click()
        page.locator('#players0 select').first.select_option('1') # legacy skin mixed with QA classic
        page.locator('#go').click();page.wait_for_timeout(120)
        assert len(calls('atlas.png'))==5 and len(calls('helmet_pose_atlas.png'))==5
        assert not errors,errors
        print(json.dumps({'profile':name,'sampledFrames':checked,'weapons':'grenade/rocket/bow/revolver both directions; calibrated SVG grips','pause':'frozen','damage':'once','legacyMix':'preserved','pageErrors':errors}),flush=True)
        page.close()
    # Both versions reconstruct exactly the same explicitly selected terrain and spawns.
    boards=[]
    for version in ['pixel-v04','pixel-v06']:
        page=browser.new_page()
        page.goto('http://127.0.0.1:8000/games/pondwars-beta.html?art='+version+'&qaMap=twin&qaSeed=123',wait_until='networkidle')
        page.evaluate('''async()=>{const {CharacterAnimator}=await import('/games/js/pondwars-animation.mjs?v=20261112pixel');const old=CharacterAnimator.prototype.observe;CharacterAnimator.prototype.observe=function(g,...args){window.__game=g;return old.call(this,g,...args);};}''')
        page.locator('#title').click();page.wait_for_timeout(500)
        links=page.locator('#art-prototype a').evaluate_all('(links)=>links.map(a=>a.href)')
        assert all('qaSeed=123' in url and 'qaMap=twin' in url for url in links)
        page.locator('[data-mode=duo]').click();page.locator('#go').click();page.wait_for_timeout(100)
        boards.append(page.evaluate('''()=>{const g=window.__game;let hash=2166136261;for(const x of g.mask)hash=Math.imul(hash^x,16777619);return {seed:g.seed,map:g.map,hash:hash>>>0,spawns:g.frogs.map(f=>[f.x,f.y])};}'''))
        page.close()
    assert boards[0]==boards[1],boards
    print(json.dumps({'comparison':'v04/v06 same twin map, seed 123, mask and spawn positions','board':boards[0]}),flush=True)
    # Delay real replay, then reconcile an authoritative damaged snapshot at turn handover.
    context=browser.new_context()
    host,guest=context.new_page(),context.new_page()
    for page,role in [(host,'host'),(guest,'join')]:
        page.add_init_script(probe)
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://127.0.0.1:8000/games/pondwars-beta.html?art=pixel-v06&net='+role+'&room=pixel-lag-qa',wait_until='networkidle')
        page.evaluate('''async()=>{
          const {NetMatch}=await import('/games/js/pondwars-beta-net.mjs?v=20261112polish');
          for(const name of ['advance','pump']){
            const original=NetMatch.prototype[name];
            NetMatch.prototype[name]=function(...args){window.__net=this;if(name==='pump' && window.__lag)return 0;return original.apply(this,args);};
          }
        }''')
        page.locator('#title').click();page.wait_for_timeout(500)
    guest.evaluate('window.__lag=true')
    host.locator('#go').click()
    host.wait_for_function('() => window.__net?.g')
    host.evaluate('window.__net.g.frogs[0].hp--')
    host.locator('#skip').click()
    host.wait_for_function('() => window.__net.g.turn>=1')
    guest.wait_for_function('() => window.__net?.backlog()>0')
    backlog=guest.evaluate('window.__net.backlog()')
    guest.evaluate('window.__lag=false')
    guest.wait_for_function('() => window.__net.desyncs>=1 && window.__net.g.frogs[0].hp===99')
    guest.wait_for_timeout(100)
    layers=guest.evaluate('window.__draws.map(d=>d.file)')
    assert layers.count('atlas.png')==6 and layers.count('helmet_pose_atlas.png')==5,'resync replayed helmet loss'
    # Reconnect through the same onstart path as a hello snapshot.
    guest.evaluate('''async()=>{
      const {snapshot}=await import('/games/js/pondwars-beta-net.mjs?v=20261112polish');
      const net=window.__net,snap=snapshot(net.g);net.start(net.setup,snap);
    }''')
    guest.wait_for_timeout(100)
    layers=guest.evaluate('window.__draws.map(d=>d.file)')
    assert layers.count('helmet_pose_atlas.png')==5
    assert not errors,errors
    print(json.dumps({'network':'delayed replay + authoritative restore + reconnect; no helmet replay','queuedSteps':backlog}),flush=True)
    context.close()
    browser.close()
