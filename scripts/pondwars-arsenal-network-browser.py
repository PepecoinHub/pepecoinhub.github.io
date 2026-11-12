# Local BroadcastChannel QA, no Supabase and no audio.
import json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 context=browser.new_context();host,guest=context.new_page(),context.new_page();errors=[]
 for page,role in [(host,'host'),(guest,'join')]:
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:8000/games/pondwars-beta.html?arsenal=exp-v1&art=pixel-v06&net='+role+'&room=arsenal-B-qa',wait_until='networkidle')
  page.evaluate('''async()=>{const {NetMatch}=await import('/games/js/pondwars-beta-net.mjs?v=20261112arsenalB');for(const name of ['advance','pump']){const old=NetMatch.prototype[name];NetMatch.prototype[name]=function(...args){window.__net=this;if((name==='advance'&&window.__stop)||(name==='pump'&&window.__lag))return 0;return old.apply(this,args);};}}''')
  page.locator('#title').click();page.wait_for_timeout(500)
 host.locator('#go').click();guest.wait_for_function('() => window.__net?.g?.arsenalStage === "B"')
 guest.evaluate('window.__lag=true')
 host.locator('#arsenal-open').click();host.locator('.qa-arsenal').get_by_role('button',name='Special',exact=True).click();host.locator('.qa-arsenal [data-w=bell_bomb]').click()
 host.locator('#pw').focus();host.keyboard.down('Enter');host.wait_for_timeout(350);host.keyboard.up('Enter')
 host.wait_for_function('() => window.__net.g.shots.some(s=>s.type==="bell_bomb")');host.wait_for_timeout(250)
 host.evaluate('window.__stop=true;window.__net.flush()')
 guest.wait_for_function('() => window.__net.backlog()>0');queued=guest.evaluate('window.__net.backlog()');guest.evaluate('window.__lag=false')
 guest.wait_for_function('() => window.__net.backlog()===0');guest.wait_for_timeout(50)
 expression="async()=>{const {stateHash}=await import('/games/js/pondwars-beta-net.mjs?v=20261112arsenalB');return stateHash(window.__net.g);}"
 assert host.evaluate(expression)==guest.evaluate(expression),'replay diverged'
 assert guest.evaluate('window.__net.g.ammo[0].bell_bomb')==1
 host.evaluate('window.__net.g.frogs[0].hp=99')
 snap=host.evaluate("async()=>{const {snapshot}=await import('/games/js/pondwars-beta-net.mjs?v=20261112arsenalB');return snapshot(window.__net.g);}")
 guest.evaluate('snap=>window.__net.handover({snap,tick:window.__net.tick})',snap)
 guest.wait_for_timeout(60);assert guest.evaluate('window.__net.g.frogs[0].hp')==99
 assert host.evaluate(expression)==guest.evaluate(expression)
 guest.evaluate('snap=>window.__net.start(window.__net.setup,snap)',snap);guest.wait_for_timeout(80)
 assert guest.evaluate('window.__net.g.arsenalStage')=='B';assert guest.evaluate('window.__net.g.ammo[0].bell_bomb')==1
 assert not errors,errors
 print(json.dumps({'stage':'B','queuedSteps':queued,'replayHash':'equal','snapshot':'equal','reconnectAmmo':1,'pageErrors':errors}),flush=True)
 context.close();browser.close()
