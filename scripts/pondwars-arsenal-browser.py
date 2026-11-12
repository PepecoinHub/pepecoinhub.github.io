# Serve docs on port 8000. Playwright + Chromium; never enables audio.
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path('/tmp/frog-arsenal-qa');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for profile,options in [('desktop',{'viewport':{'width':1440,'height':900}}),('phone',{'viewport':{'width':390,'height':844},'has_touch':True,'is_mobile':True,'device_scale_factor':2}),('reduced',{'viewport':{'width':1000,'height':750},'reduced_motion':'reduce'})]:
  page=browser.new_page(**options);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/hud_64/bell_bomb.png',lambda route:route.abort()) # exercise image fallback
  page.goto('http://127.0.0.1:8000/games/pondwars-beta.html?art=pixel-v06&arsenal=exp-v1',wait_until='networkidle')
  page.evaluate('''async()=>{const {CharacterAnimator}=await import('/games/js/pondwars-animation.mjs?v=20261112pixel');const old=CharacterAnimator.prototype.observe;CharacterAnimator.prototype.observe=function(g,...args){window.__game=g;return old.call(this,g,...args);};}''')
  page.locator('#title').click();page.wait_for_timeout(500)
  assert page.locator('#arsenal-prototype').is_visible()
  page.locator('[data-mode=duo]').click();page.locator('#go').click();page.wait_for_timeout(120)
  stage=page.evaluate('window.__game.arsenalStage')
  page.locator('#arsenal-open').click()
  dialog=page.locator('.qa-arsenal')
  assert dialog.locator('[data-w]').count()==21
  assert dialog.locator('[data-w]:visible').count()==8
  dialog.get_by_role('button',name='Next',exact=True).click();assert dialog.locator('[data-w]:visible').count()==8
  dialog.get_by_role('button',name='Next',exact=True).click();assert dialog.locator('[data-w]:visible').count()==5
  dialog.get_by_role('button',name='PEP',exact=True).click();assert dialog.locator('[data-w]:visible').count()==3
  assert dialog.locator('[data-w]:visible:disabled').count()==3
  dialog.get_by_role('button',name='Special',exact=True).click()
  assert dialog.locator('[data-w=bell_bomb]').is_disabled()==(stage=='A')
  assert dialog.locator('[data-w=bell_bomb] img').get_attribute('src').endswith('grenade.svg')
  for size in [24,36,48]:
   dialog.locator('img').evaluate_all('(imgs,n)=>imgs.forEach(img=>{img.style.width=n+"px";img.style.height=n+"px";})',size)
   dialog.screenshot(path=str(out/(stage+'-'+profile+'-icons-'+str(size)+'.png')))
  box=dialog.bounding_box();assert box['x']>=0 and box['x']+box['width']<=options['viewport']['width']+1
  assert page.locator('#sound').inner_text()=='Sound: off'
  dialog.get_by_role('button',name='Close weapon selection').click()
  page.locator('#pause').click();page.wait_for_timeout(50);before=page.locator('#pw').screenshot();page.wait_for_timeout(200);assert page.locator('#pw').screenshot()==before
  page.locator('#pause').click()
  if stage=='B':
   page.locator('#arsenal-open').click();dialog.get_by_role('button',name='Special',exact=True).click();dialog.locator('[data-w=bell_bomb]').click()
   page.locator('#pw').focus();page.keyboard.down('Enter');page.wait_for_timeout(350);page.keyboard.up('Enter');page.wait_for_timeout(80)
   assert page.evaluate('window.__game.shots.some(s=>s.type==="bell_bomb")')
   assert page.evaluate('window.__game.ammo[0].bell_bomb')==1
   page.locator('#pause').click();page.wait_for_timeout(40);fuse=page.evaluate('window.__game.shots.find(s=>s.type==="bell_bomb").t');frozen=page.locator('#pw').screenshot();page.wait_for_timeout(200)
   assert page.evaluate('window.__game.shots.find(s=>s.type==="bell_bomb").t')==fuse and page.locator('#pw').screenshot()==frozen
   page.locator('#pause').click()
   page.screenshot(path=str(out/(stage+'-'+profile+'-bell.png')))
   page.wait_for_timeout(3200);assert page.evaluate('!window.__game.shots.some(s=>s.type==="bell_bomb")')
   page.locator('#restart').click();page.locator('#go').click();page.wait_for_timeout(100)
   page.locator('#arsenal-open').click();dialog.get_by_role('button',name='Special',exact=True).click();dialog.locator('[data-w=gold]').click()
   page.locator('#pw').focus();page.keyboard.down('Enter');page.wait_for_timeout(350);page.keyboard.up('Enter')
   page.wait_for_function('() => window.__game.shots.filter(s=>s.type==="toe").length===5')
   assert page.evaluate('window.__game.ammo[0].gold')==0
   page.screenshot(path=str(out/(stage+'-'+profile+'-mega-foot.png')))
   page.locator('#restart').click();page.locator('#go').click();page.wait_for_timeout(100)
   page.locator('#arsenal-open').click();dialog.get_by_role('button',name='Traps',exact=True).click();dialog.locator('[data-w=frog_mine]').click()
   page.locator('#pw').focus();page.keyboard.down('Enter');page.wait_for_timeout(200);page.keyboard.up('Enter');page.wait_for_timeout(100)
   assert page.evaluate('window.__game.mines.some(s=>s.type==="frog_mine")')
   page.wait_for_timeout(1100)
   page.evaluate('''()=>{const g=window.__game,m=g.mines.find(s=>s.type==='frog_mine'),e=g.frogs.find(f=>f.team!==m.team);Object.assign(e,{x:m.x+32,y:m.y,ground:true});}''')
   page.wait_for_timeout(60);page.screenshot(path=str(out/(stage+'-'+profile+'-mine-jump.png')))
   page.wait_for_timeout(450);assert page.evaluate('!window.__game.mines.some(s=>s.type==="frog_mine")')
   assert page.evaluate('window.__game.ammo[0].frog_mine')==1
  assert not errors,errors
  print(json.dumps({'stage':stage,'profile':profile,'items':21,'paging':'8/8/5','future':'locked','fallback':'OK','pause':'frozen','sound':'off','pageErrors':errors}),flush=True)
  page.close()
 legacy=browser.new_page();legacy.goto('http://127.0.0.1:8000/games/pondwars-beta.html',wait_until='networkidle')
 assert legacy.locator('.qa-arsenal').count()==0 and legacy.locator('.pw-arsenal [data-w]').count()==14
 legacy.close();browser.close()
