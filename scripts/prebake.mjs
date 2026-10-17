#!/usr/bin/env node
// Put today's numbers into the plain HTML of the network and rich list pages, in every language,
// so search engines and visitors without JavaScript see the same figures as everyone else.
//
// network.html (and */network.html): the page's own inline script is run here with a tiny fake DOM
// and the real data/network.json, so every number is formatted exactly as the browser formats it.
// rich-list.html (and */rich-list.html): <span data-v="…"> values between the static-summary
// markers are filled from data/summary.json in the page's language. app.js redraws both pages.
//
// Run after build_summary.py: node scripts/prebake.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const DOCS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs');
const LOCALE = { en: 'en-US', pl: 'pl-PL', es: 'es-ES', de: 'de-DE', fr: 'fr-FR', tr: 'tr-TR', it: 'it-IT', zh: 'zh-CN' };
const NETWORK_IDS = ['s-date', 's-height', 's-supply', 's-addr', 's-bt', 's-day',
  't-note', 't-blocks', 't-blocks-sub', 't-pep', 't-pep-sub', 't-addr', 't-addr-sub', 't-bt'];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const langOf = (html) => {
  const m = html.match(/<html[^>]*\blang="([^"]+)"/i);
  const tag = (m ? m[1] : 'en').toLowerCase();
  return tag.startsWith('zh') ? 'zh' : tag.split('-')[0];
};
function pages(name) {
  const out = [path.join(DOCS, name)];
  for (const d of fs.readdirSync(DOCS, { withFileTypes: true })) {
    const p = path.join(DOCS, d.name, name);
    if (d.isDirectory() && LOCALE[d.name] && fs.existsSync(p)) out.push(p);
  }
  return out.filter((p) => fs.existsSync(p));
}

// ------------------------------------------------------------------ fake DOM, just enough for fill()
class El {
  constructor(tag) { this.tagName = tag; this.children = []; this.attrs = {}; this.style = {}; this.className = ''; this.scope = ''; this.hidden = false; this._text = ''; this.clientWidth = 800; }
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v); this.children = []; }
  set innerHTML(v) { this.children = []; }
  get innerHTML() { return ''; }
  appendChild(c) { this.children.push(c); return c; }
  append(...c) { this.children.push(...c); }
  setAttribute(k, v) { this.attrs[k] = v; }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener() {}
  insertAdjacentHTML() {}
  remove() {}
  querySelector() { return new El('div'); }
  querySelectorAll() { return []; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 400 }; }
}
const cell = (c) => {
  const tag = c.tagName.toLowerCase();
  const attrs = (c.scope ? ` scope="${c.scope}"` : '') + (c.className ? ` class="${c.className}"` : '');
  return `<${tag}${attrs}>${esc(c.textContent)}</${tag}>`;
};

async function network(file, data) {
  let html = fs.readFileSync(file, 'utf8');
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((s) => s.includes('network.json'));
  if (!script) throw new Error('no network script');
  const els = {};
  const document = {
    getElementById: (id) => (els[id] ||= new El('span')),
    createElement: (t) => new El(t),
    createElementNS: (_, t) => new El(t),
    querySelector: () => new El('div'),
    querySelectorAll: () => [],
    documentElement: new El('html'),
  };
  const sandbox = {
    document, console, Math, Date, Intl, JSON, Number, String, Array, Object, Promise,
    setTimeout: () => 0, clearTimeout: () => {},
    fetch: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) }),
  };
  sandbox.window = { addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }), devicePixelRatio: 1 };
  vm.runInNewContext(script, sandbox, { filename: file, timeout: 5000 });
  for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));   // let fetch().then() run

  if (!els['s-height'] || !/\d/.test(els['s-height'].textContent)) throw new Error('fill() did not run');
  for (const id of NETWORK_IDS) {
    if (!els[id]) continue;
    const re = new RegExp(`(<[a-z]+\\b[^>]*\\bid="${id}"[^>]*>)[^<]*(</)`);
    if (!re.test(html)) throw new Error(`#${id} not found`);
    html = html.replace(re, (_, a, b) => a + esc(els[id].textContent) + b);
  }
  const body = els.days;
  if (body && body.children.length) {
    const rows = body.children.map((tr) => '<tr>' + tr.children.map(cell).join('') + '</tr>').join('');
    html = html.replace(/(<tbody id="days">)[\s\S]*?(<\/tbody>)/, (_, a, b) => a + rows + b);
  }
  fs.writeFileSync(file, html);
}

function richList(file, S) {
  let html = fs.readFileSync(file, 'utf8');
  const a = html.indexOf('<!-- static-summary:start -->'), b = html.indexOf('<!-- static-summary:end -->');
  if (a < 0 || b < a) throw new Error('static-summary markers not found');
  const loc = LOCALE[langOf(html)] || 'en-US';
  const L = S.latest;
  const v = {
    date: new Date(L.date + 'T00:00:00Z').toLocaleDateString(loc, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }),
    height: L.height == null ? '' : Number(L.height).toLocaleString(loc),
  };
  S.tops.forEach((n, i) => {
    const x = S.views.all.shares[i];
    if (x != null) v['top-' + n] = x.toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  });
  let block = html.slice(a, b);
  block = block.replace(/(<span data-v="([a-z0-9-]+)">)[^<]*(<\/span>)/g, (m, open, k, close) => (k in v ? open + esc(v[k]) + close : m));
  fs.writeFileSync(file, html.slice(0, a) + block + html.slice(b));
}

const net = JSON.parse(fs.readFileSync(path.join(DOCS, 'data', 'network.json'), 'utf8'));
const sum = JSON.parse(fs.readFileSync(path.join(DOCS, 'data', 'summary.json'), 'utf8'));
let failed = 0;
for (const f of pages('network.html')) {
  try { await network(f, net); console.log('numbers baked into', path.relative(DOCS, f)); }
  catch (e) { failed++; console.error(`${path.relative(DOCS, f)} skipped: ${e.message}`); }
}
for (const f of pages('rich-list.html')) {
  try { richList(f, sum); console.log('numbers baked into', path.relative(DOCS, f)); }
  catch (e) { failed++; console.error(`${path.relative(DOCS, f)} skipped: ${e.message}`); }
}
// a page that could not be updated keeps yesterday's numbers; never fail the daily job for it
process.exit(0);
