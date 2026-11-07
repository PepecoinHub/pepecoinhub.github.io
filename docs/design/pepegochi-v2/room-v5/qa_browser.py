from playwright.sync_api import sync_playwright
from pathlib import Path
import json
root=Path(__file__).resolve().parent
(root/'screenshots').mkdir(exist_ok=True)
results=[]
with sync_playwright() as p:
  browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width,height in [(1280,900),(390,844),(360,780)]:
    page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
    errors=[];requests=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.on('request',lambda r: requests.append(r.url))
    page.set_content((root/'room_v5_standalone.html').read_text(encoding='utf8'),wait_until='load')
    page.wait_for_timeout(120)
    assert page.locator('.stage-btn').count()==11, page.locator('.stage-btn').count()
    assert page.locator('.inv').count()==10
    assert page.locator('.stage-btn img').count()==6
    assert page.locator('#roomBg').evaluate('el=>el.naturalWidth')==640
    # 10 separate visual sources without HTML canvas drawing
    pngs=page.locator('.stage-btn img').evaluate_all('els=>els.map(e=>e.naturalWidth)'); assert all(x==128 for x in pngs),pngs
    # Store poster by clicking occupied slot then move it to other wall.
    page.get_by_role('button',name='Lewa ściana. Plakat P').click()
    assert 'Schowano' in page.locator('#log').inner_text()
    page.get_by_role('button',name='Plakat P').click()
    page.get_by_role('button',name='Prawa ściana; puste miejsce').click()
    assert 'Ustawiono' in page.locator('#log').inner_text()
    # Reward is in-memory only, no server.
    page.locator('#giftFloppy').click();assert page.locator('#giftFloppy').is_disabled()
    page.get_by_role('button',name='Dyskietka (test)').click()
    page.get_by_role('button',name='Półka A; puste miejsce').click()
    assert 'Ustawiono' in page.locator('#log').inner_text()
    # Important: no bogus real award and no request.
    assert page.get_by_role('button',name='Księżycowa skała (plan), niedostępny').is_disabled()
    screen_base=root/'screenshots'/f'room_v5_{width}_base.png'
    page.screenshot(path=str(screen_base),full_page=True)
    page.locator('#depart').click()
    assert page.locator('#pet').is_hidden();assert page.locator('#adopt').is_disabled()
    assert page.locator('.stage-btn.missing').count()==1
    assert page.locator('.stage-btn img').count()==6 # poster moved + floppy plus other five, minus taken
    assert page.locator('#envelope').is_visible()
    page.locator('#envelope').click()
    assert 'Dear Fren' in page.locator('#letterText').inner_text()
    page.locator('#close').click()
    assert page.locator('#adopt').is_enabled()
    page.locator('#adopt').click()
    assert page.locator('#pet').is_visible()
    assert page.locator('.stage-btn.missing').count()==0
    assert page.locator('.stage-btn img').count()==7
    assert 'Fren #1' in page.locator('#history').inner_text()
    overflow=page.evaluate('document.documentElement.scrollWidth > window.innerWidth')
    assert not overflow, f'overflow at {width}'
    assert not errors,errors
    assert not requests,requests
    shot=root/'screenshots'/f'room_v5_{width}_after_adoption.png'
    page.screenshot(path=str(shot),full_page=True)
    results.append({'viewport':f'{width}x{height}','slots':11,'art_objects':8,'initial_props':6,'gift_demo':'pass','reposition':'pass','departure':'pass','letter_gate':'pass','restore':'pass','no_overflow':True,'no_external_requests':True,'js_errors':[]})
    page.close()
  browser.close()
(root/'browser_qa_v5.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print(json.dumps(results,ensure_ascii=False,indent=2))