"""Two local browser tabs, delayed Doge replay and mid-flight reconnect; no Supabase."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
SOURCE=(ROOT/'docs/games/js/pondwars-beta.mjs').read_text()
HOOK='\nwindow.__qa={get game(){return g},get net(){return net},get held(){return held},freeze(){paused=true;pending=[];}};'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 c=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
 errors=[]
 def open_tab(role):
  page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/pondwars-beta.mjs?*',lambda r:r.fulfill(body=SOURCE+HOOK,content_type='text/javascript'))
  page.goto('http://127.0.0.1:8000/games/pondwars-beta.html?art=pixel-v06&packs=all&maps=all&net='+role+'&room=polish-doge-reconnect',wait_until='networkidle')
  page.locator('#title').click();page.wait_for_timeout(200)
  page.evaluate("async()=>window.__netlib=await import('/games/js/pondwars-beta-net.mjs?v=20261112v13')")
  return page
 host=open_tab('host');guest=open_tab('join');host.locator('#go').click()
 host.wait_for_function('window.__qa.game');guest.wait_for_function('window.__qa.game')
 host.evaluate('window.__qa.freeze()');guest.evaluate('window.__qa.freeze()')
 # Catch up all setup frames before the delayed block, then a reproducible new shot.
 host.evaluate('window.__qa.net.flush()');guest.wait_for_timeout(100);guest.evaluate('window.__qa.net.pump(9999)')
 host.evaluate('''()=>{const n=window.__qa.net;n.advance({m:0,a:[{t:'weapon',w:'doge'},{t:'fire',a:-Math.PI/2,p:1}]});for(let i=0;i<12;i++)n.advance({m:0,a:[]});n.flush();}''')
 guest.wait_for_timeout(100);queued=guest.evaluate('window.__qa.net.backlog()');assert queued>=12
 guest.evaluate('window.__qa.net.pump(9999)')
 gethash='window.__netlib.stateHash(window.__qa.game)'
 assert host.evaluate(gethash)==guest.evaluate(gethash)
 assert host.evaluate('window.__qa.game.phase')=='guide'
 t=host.evaluate('window.__qa.game.shots[0].t');timer=host.evaluate('window.__qa.game.timer')
 guest.close();guest=open_tab('join');guest.wait_for_function('window.__qa.game?.phase === "guide"');guest.evaluate('window.__qa.freeze()')
 assert host.evaluate(gethash)==guest.evaluate(gethash)
 assert guest.evaluate('window.__qa.game.shots[0].t')==t
 assert guest.evaluate('window.__qa.game.ammo[0].doge')==0
 assert guest.evaluate('window.__qa.held.pitch===0 && window.__qa.held.r===0')
 host.evaluate("window.__qa.net.advance({m:0,a:[{t:'detonate'}]});window.__qa.net.flush()")
 guest.wait_for_timeout(100);guest.evaluate('window.__qa.net.pump(9999)')
 assert host.evaluate(gethash)==guest.evaluate(gethash)
 assert guest.evaluate('window.__qa.game.shots.length')==0
 assert guest.evaluate('window.__qa.game.timer')==timer
 assert not errors,errors
 result={'queuedSteps':queued,'midFlightReconnect':True,'equalHashes':True,'ammoAfterReconnect':0,'flightTimeRestored':t,'physicalDeviceApproved':False,'pageErrors':errors}
 Path('/tmp/frogageddon-polish/network-results.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
 c.close();b.close()
