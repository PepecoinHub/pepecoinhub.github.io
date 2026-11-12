# Local art review checks. Serve docs on port 8000; requires Playwright + Chromium.
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

out = Path('/tmp/pondwars-helmet-artifacts')
out.mkdir(parents=True, exist_ok=True)
profiles = [
    ('desktop', {'viewport': {'width': 1440, 'height': 900}}),
    ('phone', {'viewport': {'width': 390, 'height': 844}, 'is_mobile': True, 'has_touch': True, 'device_scale_factor': 2}),
    ('reduced', {'viewport': {'width': 1000, 'height': 750}, 'reduced_motion': 'reduce'}),
]
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    for name, options in profiles:
        page = browser.new_page(**options)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        # Observe canvas layers without adding a gameplay/debug API to production code.
        canvas_probe = '''
          window.__artCalls = [];
          const fill = CanvasRenderingContext2D.prototype.fillRect;
          CanvasRenderingContext2D.prototype.fillRect = function(...args) {
            if (this.canvas.id === 'pw' && args[1] === 0 && args[3] === 600) window.__artCalls = [];
            return fill.apply(this, args);
          };
          const draw = CanvasRenderingContext2D.prototype.drawImage;
          CanvasRenderingContext2D.prototype.drawImage = function(image, ...args) {
            if (this.canvas.id === 'pw' && image.src) window.__artCalls.push(image.src.split('/').pop());
            return draw.call(this, image, ...args);
          };
        '''
        page.add_init_script(canvas_probe)
        page.goto('http://127.0.0.1:8000/games/pondwars-beta.html?art=standard-v02', wait_until='networkidle')
        page.evaluate('''async () => {
          const {CharacterAnimator} = await import('/games/js/pondwars-animation.mjs?v=20261112pixel');
          const observe = CharacterAnimator.prototype.observe;
          CharacterAnimator.prototype.observe = function(g, ...args) { window.__game = g; return observe.call(this, g, ...args); };
        }''')
        page.locator('#title').click()
        page.wait_for_timeout(500)
        assert page.locator('#art-prototype').is_visible()
        assert page.locator('#players0 select').count() == 0
        page.locator('[data-mode=duo]').click()
        page.locator('#go').click()
        page.wait_for_timeout(200)
        def count(file):
            return page.evaluate('(file) => window.__artCalls.filter(x => x === file).length', file)
        body = 'standard_frog_no_helmet.png'
        overlay = 'helmet_overlay_on_512_canvas.png'
        cutout = 'helmet_cutout.png'
        assert count(body) == 6
        assert count(overlay) == 6
        page.screenshot(path=str(out / (name + '-start.png')))
        page.evaluate('window.__game.frogs[0].hp -= 1')
        page.wait_for_timeout(60)
        assert count(overlay) == 5
        assert count(cutout) == (0 if name == 'reduced' else 1)
        page.screenshot(path=str(out / (name + '-first-damage.png')))
        page.locator('#pause').click()
        page.wait_for_timeout(50)
        before = page.locator('#pw').screenshot()
        page.wait_for_timeout(300)
        assert page.locator('#pw').screenshot() == before
        page.locator('#pause').click()
        page.evaluate('window.__game.frogs[0].hp -= 1')
        page.wait_for_timeout(50)
        assert count(cutout) == (0 if name == 'reduced' else 1), 'second hit replayed effect'
        if name == 'desktop':
            page.emulate_media(reduced_motion='reduce')
            page.wait_for_timeout(50)
            assert count(cutout) == 0
            page.emulate_media(reduced_motion='no-preference')
            page.wait_for_timeout(50)
            assert count(cutout) == 0
        page.wait_for_timeout(1600)
        assert count(cutout) == 0 and count(overlay) == 5
        page.screenshot(path=str(out / (name + '-after.png')))
        page.locator('#restart').click()
        page.locator('#go').click()
        page.wait_for_timeout(150)
        assert count(overlay) == 6, 'new match failed to reset helmets'
        # Same sprites and separate weapon layer while mirroring/aiming left.
        page.locator('#pw').focus()
        page.keyboard.press('ArrowLeft')
        page.keyboard.press('Space')
        page.wait_for_timeout(70)
        page.keyboard.press('Space')
        page.wait_for_timeout(140)
        page.screenshot(path=str(out / (name + '-left-backflip.png')))
        assert not errors, errors
        print(json.dumps({'profile': name, 'pageErrors': errors, 'layers': '6 bodies + 6/5 helmets; one cutout', 'pause': 'frozen', 'reset': '6 helmets'}), flush=True)
        page.close()
    # Existing beta mode continues to expose the eight legacy skins.
    legacy = browser.new_page()
    legacy.goto('http://127.0.0.1:8000/games/pondwars-beta.html', wait_until='networkidle')
    assert legacy.locator('#players0 select').first.locator('option').count() == 8
    legacy.close()
    # Exercise the actual network onrestore and reconnect/onstart callbacks, locally.
    context = browser.new_context()
    network_pages = [context.new_page(), context.new_page()]
    for page, role in zip(network_pages, ['host', 'join']):
        page.add_init_script(canvas_probe)
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto('http://127.0.0.1:8000/games/pondwars-beta.html?art=standard-v02&net=' + role + '&room=helmet-review', wait_until='networkidle')
        page.evaluate('''async () => {
          const {NetMatch} = await import('/games/js/pondwars-beta-net.mjs?v=20261112v13');
          for (const method of ['advance', 'pump']) {
            const original = NetMatch.prototype[method];
            NetMatch.prototype[method] = function(...args) { window.__net = this; return original.apply(this, args); };
          }
        }''')
        page.locator('#title').click()
        page.wait_for_timeout(500)
    host, guest = network_pages
    host.locator('#go').click()
    guest.wait_for_function('window.__net?.g?.phase === "aim"')
    guest.evaluate('''async () => {
      const {snapshot} = await import('/games/js/pondwars-beta-net.mjs?v=20261112v13');
      const net = window.__net, snap = snapshot(net.g);
      snap.frogs[0].hp = 99;
      net.handover({snap, tick:net.tick}); // Calls the page's real net.onrestore.
      window.__damaged = snap;
    }''')
    guest.wait_for_timeout(100)
    layers = guest.evaluate('window.__artCalls')
    assert layers.count(overlay) == 5 and layers.count(cutout) == 0
    guest.evaluate('window.__net.start(window.__net.setup, window.__damaged)') # Reconnect calls real onstart/launch.
    guest.wait_for_timeout(100)
    layers = guest.evaluate('window.__artCalls')
    assert layers.count(overlay) == 5 and layers.count(cutout) == 0
    assert not errors, errors
    print(json.dumps({'network': 'snapshot resync + reconnect preserve missing helmet without replay'}), flush=True)
    context.close()
    browser.close()
