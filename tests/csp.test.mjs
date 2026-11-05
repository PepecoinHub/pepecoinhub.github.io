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
