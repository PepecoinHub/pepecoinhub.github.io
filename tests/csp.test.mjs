// Guards the Content-Security-Policy that scripts/add_csp.py injects into the
// static pages (serious site, PondOS meme edition, i18n mirrors). It checks that
// coverage never silently drifts: every such page carries a CSP, and every inline
// <script> on it is allowlisted by a matching sha256 hash. The games/ pages keep
// their own hand-written CSP and are out of scope here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const DOCS = new URL('../docs/', import.meta.url);

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const u = new URL(e.name + (e.isDirectory() ? '/' : ''), dir);
    if (e.isDirectory()) { if (e.name !== 'games') walk(u, out); }
    // Skip search-engine verification stubs (not real HTML pages).
    else if (e.name.endsWith('.html') && !e.name.startsWith('google')) out.push(u);
  }
  return out;
}

const INLINE = /<script(?![^>]*\bsrc=)(?![^>]*type=["']application\/(?:ld\+json|json)["'])[^>]*>([\s\S]*?)<\/script>/gi;
const sha = s => createHash('sha256').update(s, 'utf8').digest('base64');
const pages = walk(DOCS);

test('every managed page ships a CSP meta tag', () => {
  assert.ok(pages.length > 100, 'expected the full page set, got ' + pages.length);
  const missing = pages.filter(u => !readFileSync(u, 'utf8').includes('Content-Security-Policy'));
  assert.deepEqual(missing.map(u => u.pathname), [], 'pages without any CSP');
});

test('every inline script on a page is allowlisted by its sha256 in that page CSP', () => {
  const offenders = [];
  for (const u of pages) {
    const html = readFileSync(u, 'utf8');
    const csp = (html.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/) || [])[1] || '';
    for (const m of html.matchAll(INLINE)) {
      const h = "'sha256-" + sha(m[1]) + "'";
      if (!csp.includes(h)) offenders.push(u.pathname + ' :: ' + h);
    }
  }
  assert.deepEqual(offenders, [], 'inline scripts not covered by their page CSP (run scripts/add_csp.py)');
});

test('CSP is strict: no unsafe-inline/eval in script-src, object-src none, base-uri self', () => {
  for (const u of pages.slice(0, 40)) {
    const csp = (readFileSync(u, 'utf8').match(/http-equiv="Content-Security-Policy" content="([^"]*)"/) || [])[1] || '';
    const scriptSrc = (csp.match(/script-src ([^;]*)/) || [])[1] || '';
    assert.doesNotMatch(scriptSrc, /'unsafe-inline'|'unsafe-eval'/, u.pathname);
    assert.match(csp, /object-src 'none'/, u.pathname);
    assert.match(csp, /base-uri 'self'/, u.pathname);
  }
});

// ---------------------------------------------------------------------------
// Interactive-resource guard. The map / Pond TV / guest bot-check all broke
// because the CSP omitted a host a feature loads only AFTER you open its window.
// A page-load browser test missed them. This runs in plain Node (no browser):
// it reads the shipped meme.js, extracts the external hosts each feature uses,
// and asserts the published meme CSP allows them in the right directive. If the
// code gains a new embed/fetch/tile host that the CSP doesn't cover, this fails.
const meme = readFileSync(new URL('../docs/meme/meme.js', import.meta.url), 'utf8');
const memeCsp = (readFileSync(new URL('../docs/meme/index.html', import.meta.url), 'utf8')
  .match(/http-equiv="Content-Security-Policy" content="([^"]*)"/) || [])[1] || '';
const directive = name => (memeCsp.match(new RegExp(name + ' ([^;]*)')) || [])[1] || '';
const host = u => { try { return new URL(u).origin; } catch { return u; } };

test('CSP allows the map tiles Pepe Guesser loads (img-src)', () => {
  // tile hosts come from L.tileLayer('https://.../{z}/{x}/{y}') calls in meme.js
  const tiles = [...meme.matchAll(/tileLayer\(\s*['"`](https:\/\/[^'"`]+)/g)].map(m => host(m[1]));
  assert.ok(tiles.length >= 1, 'expected at least one tile layer in meme.js');
  const img = directive('img-src');
  for (const h of new Set(tiles)) assert.ok(img.includes(h), 'img-src missing map tile host ' + h);
});

test('CSP allows the Pond TV video embed (frame-src)', () => {
  const frames = [...meme.matchAll(/<iframe[^>]*src=["']?(https:\/\/[^"'?\s]+)/g)].map(m => host(m[1]));
  assert.ok(frames.length >= 1, 'expected a Pond TV iframe in meme.js');
  const fs = directive('frame-src');
  for (const h of new Set(frames)) assert.ok(fs.includes(h), 'frame-src missing embed host ' + h);
});

test('CSP allows the Cloudflare Turnstile guest bot check (script-src, frame-src, connect-src)', () => {
  // human.js loads challenges.cloudflare.com; the meme Avatar/guest flow imports it.
  const human = readFileSync(new URL('../docs/games/js/human.js', import.meta.url), 'utf8');
  const m = human.match(/https:\/\/[a-z0-9.\-]*challenges\.cloudflare\.com/);
  assert.ok(m, 'human.js should load Turnstile from challenges.cloudflare.com');
  const ts = host(m[0]);
  // meme.js uses the guest bot check (guestSignIn -> human.js)
  assert.match(meme, /guestSignIn|human\.js/, 'meme.js should use the guest bot check');
  for (const dir of ['script-src', 'frame-src', 'connect-src'])
    assert.ok(directive(dir).includes(ts), dir + ' missing Turnstile host ' + ts);
});

test('CSP connect-src covers every Supabase + data-API host meme.js fetches', () => {
  // hosts that appear next to fetch( or as SB_URL target; keep this honest to the code
  const fetched = new Set([
    ...[...meme.matchAll(/fetch\(\s*['"`](https:\/\/[^'"`]+)/g)].map(m => host(m[1])),
  ]);
  // Supabase is built from SB_URL; assert it explicitly since it's concatenated
  fetched.add('https://azbwciqfbsdpwubznncg.supabase.co');
  const conn = directive('connect-src');
  for (const h of fetched) assert.ok(conn.includes(h), 'connect-src missing fetched host ' + h);
  // realtime websocket
  assert.ok(conn.includes('wss://azbwciqfbsdpwubznncg.supabase.co'), 'connect-src missing Supabase realtime wss');
});

// PondOS opens every game (YEET, PEPE SWEEPER, Pepe Miner, FROGAGEDDON, ...) as an iframe of this
// site's own games/ pages. Without 'self' in frame-src every game window stays blank (Nov 2026).
test('CSP lets PondOS frame its own game pages (frame-src self)', () => {
  const own = [...meme.matchAll(/<iframe[^>]*src="' \+ BASE \+ '(games\/[a-z0-9_-]+\.html)/g)].map(m => m[1]);
  assert.ok(own.length >= 4, 'expected the game iframes in meme.js, got ' + own.join(', '));
  for (const f of ['games/yeet.html', 'games/pepe-sweeper.html', 'games/miner.html', 'games/pondwars-beta.html'])
    assert.ok(own.includes(f), f + ' is opened as an iframe');
  assert.ok(directive('frame-src').includes("'self'"), "frame-src must include 'self' or the game windows are blocked");
  // every PondOS page carries the same policy
  for (const u of pages.filter(u => u.pathname.includes('/meme/'))) {
    const csp = (readFileSync(u, 'utf8').match(/http-equiv="Content-Security-Policy" content="([^"]*)"/) || [])[1] || '';
    assert.match(csp, /frame-src 'self' /, u.pathname);
  }
});
