// Loads the managed static pages in headless Chromium WITH the <meta> CSP enforced,
// and fails if the browser blocks any script/style/font/connect the page needs.
// Pages are served from docs/ via request interception (no web server); every
// cross-origin dependency is fulfilled with a benign stub, so this tests the
// policy, not the network. Not part of CI (needs a browser); companion to the
// static tests/csp.test.mjs.
//   FREN_TOOLS=/abs/tools FREN_CHROME=/abs/chrome node scripts/csp_verify.mjs [page.html ...]
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const TOOLS = process.env.FREN_TOOLS;
if (!TOOLS || !process.env.FREN_CHROME) { console.error('Set FREN_TOOLS and FREN_CHROME.'); process.exit(2); }
const need = createRequire(path.join(TOOLS, 'package.json'));
const pw = await import(need.resolve('playwright'));
const chromium = pw.chromium || pw.default.chromium;
const DOCS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs');
const CHROME = process.env.FREN_CHROME;
const ORIGIN = 'https://pondos.test';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.ico': 'image/x-icon', '.txt': 'text/plain', '.xml': 'application/xml', '.woff2': 'font/woff2' };

const pages = process.argv.slice(2).length ? process.argv.slice(2) : ['index.html','meme/index.html','price.html','meme/price.html','market.html','calculator.html','meme/network.html','buy.html','pl/index.html','pl/price.html','404.html'];
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
let violations = 0;
try {
  for (const rel of pages) {
    const ctx = await browser.newContext();
    const hits = [];
    await ctx.route('**/*', async route => {
      const u = new URL(route.request().url());
      if (u.origin === ORIGIN) {
        let p = decodeURIComponent(u.pathname);
        if (p.endsWith('/')) p += 'index.html';
        const file = path.join(DOCS, path.normalize(p));
        if (!file.startsWith(DOCS)) return route.fulfill({ status: 403 });
        try { return route.fulfill({ status: 200, contentType: TYPES[path.extname(file)] || 'application/octet-stream', body: await readFile(file) }); }
        catch { return route.fulfill({ status: 404, body: 'x' }); }
      }
      // allowed cross-origin deps get a benign stub; anything the CSP blocks never reaches here
      const ext = path.extname(u.pathname);
      const ct = TYPES[ext] || (u.hostname.includes('font') ? 'text/css' : 'application/json');
      return route.fulfill({ status: 200, contentType: ct, headers: { 'access-control-allow-origin': '*' }, body: ct.startsWith('image') ? '' : ct === 'text/css' ? '/*stub*/' : ct === 'text/javascript' ? '/*stub*/' : '{}' });
    });
    const page = await ctx.newPage();
    page.on('console', m => { const t = m.text(); if (/content security policy|refused to (load|execute|connect|apply)/i.test(t)) { hits.push(t); } });
    page.on('pageerror', e => { if (/content security policy/i.test(e.message)) hits.push('pageerror: ' + e.message); });
    // Chromium reports CSP violations as console errors; also listen to the DOM event.
    await page.addInitScript(() => { document.addEventListener('securitypolicyviolation', e => { (window.__csp = window.__csp || []).push(e.violatedDirective + ' blocked ' + (e.blockedURI || e.sourceFile || 'inline')); }); });
    await page.goto(ORIGIN + '/' + rel, { waitUntil: 'load' });
    await page.waitForTimeout(400);
    const domHits = await page.evaluate(() => window.__csp || []);
    const all = [...new Set([...hits, ...domHits])];
    if (all.length) { violations += all.length; console.log('✗', rel); all.forEach(h => console.log('   ', h)); }
    else console.log('✓', rel);
    await ctx.close();
  }
} finally { await browser.close(); }
console.log(violations ? `\n${violations} CSP violation(s)` : '\nNo CSP violations on sampled pages');
process.exitCode = violations ? 1 : 0;
