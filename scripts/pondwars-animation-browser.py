# Requires Python Playwright and Chromium. Run a local docs server on port 8000 first.
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path('/tmp/pondwars-animation-artifacts');out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for name,options in [('desktop',{'viewport':{'width':1440,'height':900}}),('phone',{'viewport':{'width':390,'height':844},'is_mobile':True,'has_touch':True,'device_scale_factor':2}),('reduced',{'viewport':{'width':1000,'height':750},'reduced_motion':'reduce'})]:
  page=browser.new_page(**options);errors=[]
  page.on('pageerror',lambda error:errors.append(str(error)))
  page.goto('http://127.0.0.1:8000/games/pondwars-beta.html',wait_until='networkidle')
  page.wait_for_timeout(1000)
  print(name, page.locator('#go').is_enabled(),page.locator('#go').inner_text())
  page.locator('#title').click();page.wait_for_timeout(600)
  page.locator('[data-mode=duo]').click()
  page.locator('[data-n="4"]').click()
  for team in range(2):
   for slot in range(4): page.locator('#players'+str(team)+' select').nth(slot).select_option(str(team*4+slot))
  page.locator('#go').click();page.wait_for_timeout(600)
  page.screenshot(path=str(out/(name+'-aim.png')))
  page.locator('#pw').focus();page.keyboard.press('Space');page.wait_for_timeout(70);page.keyboard.press('Space');page.wait_for_timeout(140)
  page.screenshot(path=str(out/(name+'-backflip.png')))
  page.wait_for_timeout(1000)
  if name!='phone':
   page.locator('#pw').focus();page.keyboard.down('Enter');page.wait_for_timeout(600);page.keyboard.up('Enter')
  else:
   fire=page.locator('#fire');box=fire.bounding_box()
   page.dispatch_event('#fire','pointerdown',{'pointerId':2,'pointerType':'touch','button':0,'clientX':box['x']+10,'clientY':box['y']+10});page.wait_for_timeout(600)
   page.dispatch_event('#fire','pointerup',{'pointerId':2,'pointerType':'touch','button':0})
  page.wait_for_timeout(50);page.screenshot(path=str(out/(name+'-fire.png')))
  page.locator('#pause').click();page.wait_for_timeout(100)
  first=page.locator('#pw').screenshot();page.wait_for_timeout(300);second=page.locator('#pw').screenshot()
  assert not errors, errors
  assert first == second, 'Paused canvas changed'
  print(json.dumps({'profile':name,'errors':errors,'pausedCanvasEqual':first==second,'pauseButton':page.locator('#pause').inner_text()}))
  page.close()
 browser.close()
