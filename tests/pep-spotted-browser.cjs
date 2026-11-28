// Local Chromium check (owner, 2026-11-28): the Pond Bulletin invites to a game when no table is open, and
// PEP SPOTTED.EXE lists frens' finds, pins a new one and hides the form from guests. Fixture RPCs only, no network.
const assert = require('node:assert/strict');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.join(__dirname, '../docs');
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); let f = path.join(root, decodeURIComponent(u.pathname));
  if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  if (f.endsWith('/')) f += 'index.html';
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', TYPES[path.extname(f)] || 'application/octet-stream'); res.end(fs.readFileSync(f));
});
const ago = h => new Date(Date.now() - h * 36e5).toISOString(), ahead = h => new Date(Date.now() + h * 36e5).toISOString();
const items = [
  { id: 2, user_id: '00000000-0000-4000-8000-000000000002', nick: 'dissectionx', url: 'https://changenow.io/blog/pepe-crypto-difference', host: 'changenow.io', kind: 'article',
    note: 'PEP vs PEPE <b>explained</b>', at: ago(3), featured: true, mine: false, chat_id: 41, tip_until: ahead(21), tips: 3 },
  { id: 1, user_id: '00000000-0000-4000-8000-000000000001', nick: 'Byl', url: 'https://x.com/PepecoinHub/status/1', host: 'x.com', kind: 'x',
    note: '', at: ago(30), featured: false, mine: true, chat_id: 39, tip_until: null, tips: 0 }
];
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: process.env.HAZE_CHROMIUM || undefined, args: ['--no-sandbox'] });
  try {
    // 1. the Pond Bulletin with no open table: an invitation, and its buttons ask PondOS for the right window
    for (const width of [360, 900]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } }), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/*', r => {
        const u = r.request().url();
        if (u.includes('/rpc/gry_bulletin')) return r.fulfill({ json: { king: null, open: [], events: [] } });
        if (u.includes('/rpc/gry_lobby')) return r.fulfill({ json: { rooms: [] } });
        if (u.includes('/rpc/gry_tables_lobby')) return r.fulfill({ json: [] });
        return u.startsWith(origin) ? r.continue() : r.fulfill({ json: null });
      });
      await page.goto(origin + '/games/bulletin.html');
      const invite = page.locator('#tables li.invite');
      await invite.waitFor();
      assert.equal(await invite.locator('button').count(), 5, 'one big button and four small ones');
      const box = await page.locator('.tables-panel').boundingBox(), win = await page.locator('.window').boundingBox();
      assert.ok(box.x >= win.x && box.x + box.width <= win.x + win.width + 1, 'the invitation stays inside the window at ' + width + 'px');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no sideways scroll at ' + width + 'px');
      // outside PondOS the buttons go to the game pages: the lobby with "play with a fren" and the game picked
      const sea = invite.locator('button', { hasText: 'Sea Battle' });
      if (await sea.count()) { await sea.click(); await page.waitForURL(/tmode=fren&tgame=battleship#tcreate$/); }
      assert.deepEqual(errors, []);
      await page.close();
    }
    // 2. PEP SPOTTED.EXE in PondOS: the list, a pin, and guests see the log-on note instead of the form
    for (const [width, canPin] of [[1100, true], [390, false]]) {
      const page = await browser.newPage({ viewport: { width, height: 860 } }), calls = [];
      await page.route('**/*', r => {
        const u = r.request().url();
        if (u.includes('/rpc/gry_spotted_list')) return r.fulfill({ json: { can_pin: canPin, mod: false, total: 2, week: 1, items } });
        if (u.includes('/rpc/gry_spotted_pin')) { calls.push(JSON.parse(r.request().postData())); return r.fulfill({ json: items[0] }); }
        if (u.startsWith(origin)) return r.continue();
        return u.includes('/rpc/') ? r.fulfill({ json: null }) : r.abort();
      });
      await page.goto(origin + '/meme/#spotted');
      const win = page.locator('.app-win[aria-label="PEP SPOTTED.EXE"]');
      await win.locator('.sp-item').first().waitFor({ timeout: 20000 });
      assert.equal(await win.locator('.sp-item').count(), 2);
      assert.match(await win.locator('.sp-item').first().textContent(), /In the Gazette/);
      assert.equal(await win.locator('.sp-item b', { hasText: 'explained' }).count(), 0, 'a note is text, never HTML');
      const link = win.locator('.sp-link').first();
      assert.equal(await link.getAttribute('rel'), 'noopener noreferrer nofollow ugc');
      assert.equal(await link.getAttribute('target'), '_blank');
      assert.equal(await win.locator('.sp-item.is-mine').getByRole('button', { name: 'Take down' }).count(), 1);
      assert.equal(await win.locator('.sp-form').isVisible(), canPin);
      assert.equal(await win.locator('.sp-gate').isVisible(), !canPin);
      if (canPin) {
        await win.locator('.sp-url').fill('not a link'); await win.locator('.sp-pin').click();
        assert.match(await win.locator('.sp-msg').textContent(), /https:\/\//);
        assert.equal(calls.length, 0, 'a bad link never reaches the server');
        await win.locator('.sp-url').fill('https://x.com/frog/status/42'); await win.locator('.sp-note').fill('Big frog news');
        await win.locator('.sp-pin').click();
        await page.waitForFunction(() => /Pinned!/.test(document.querySelector('.sp-msg').textContent));
        assert.deepEqual(calls, [{ p_url: 'https://x.com/frog/status/42', p_note: 'Big frog news' }]);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'no sideways scroll at ' + width + 'px');
      await page.close();
    }
    console.log('PASS: Pond Bulletin game invitation (360/900px) and PEP SPOTTED.EXE list, pin, guest note (390/1100px). Fixture RPCs only.');
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exit(1); });
