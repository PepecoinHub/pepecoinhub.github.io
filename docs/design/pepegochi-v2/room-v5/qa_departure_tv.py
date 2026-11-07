from playwright.sync_api import sync_playwright
from pathlib import Path
root=Path('/mnt/data/pepegochi_room_v5')
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=b.new_page(viewport={'width':390,'height':844})
    # seeded RNG for controlled scenario
    page.set_content((root/'room_v5_standalone.html').read_text(),wait_until='load')
    page.evaluate('Math.random=()=>0')
    tv=page.get_by_role('button',name='Stolik RTV. Telewizor CRT')
    assert tv.locator('img').count()==1
    page.locator('#depart').click()
    assert page.locator('.stage-btn.missing').count()==1
    assert page.get_by_role('button',name='Stolik RTV. Telewizor CRT').locator('img').count()==0
    assert 'Telewizor' in page.locator('#status').inner_text()
    page.screenshot(path=str(root/'screenshots'/'room_v5_tv_departed_390.png'),full_page=True)
    page.locator('#envelope').click()
    assert 'TV' in page.locator('#letterText').inner_text()
    page.screenshot(path=str(root/'screenshots'/'room_v5_goodbye_390.png'),full_page=True)
    page.locator('#close').click()
    page.locator('#adopt').click()
    assert page.get_by_role('button',name='Stolik RTV. Telewizor CRT').locator('img').count()==1
    b.close()
print('TV departure / missing PNG / goodbye text / return after adoption: PASS')