#!/usr/bin/env node
// Put today's numbers into the plain HTML of the network and rich list pages, in every language,
// so search engines and visitors without JavaScript see the same figures as everyone else.
//
// network.html (and */network.html): the page's own inline script is run here with a tiny fake DOM
// and the real data/network.json, so every number is formatted exactly as the browser formats it.
// rich-list.html (and */rich-list.html): <span data-v="…"> values between the static-summary
// markers are filled from data/summary.json in the page's language. app.js redraws both pages.
// index.html (and */index.html): the "updated" date, the PEP price tiles and the hashrate tile
// (data-v="home-…"). The price is fetched from CoinGecko and kept in data/price.json, so a failed
// fetch falls back to the last saved price; home.js updates the price tiles live in the browser.
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
// optional: node scripts/prebake.mjs pl de   (only these languages; "en" is the root folder)
const ONLY = process.argv.slice(2);
function pages(name) {
  const out = [path.join(DOCS, name)];
  for (const d of fs.readdirSync(DOCS, { withFileTypes: true })) {
    const p = path.join(DOCS, d.name, name);
    if (d.isDirectory() && LOCALE[d.name] && fs.existsSync(p)) out.push(p);
  }
  const lang = (p) => (path.dirname(p) === DOCS ? 'en' : path.basename(path.dirname(p)));
  return out.filter((p) => fs.existsSync(p) && (!ONLY.length || ONLY.includes(lang(p))));
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
  // change of the top 10 / top 100 share over a week, a month and a year, in percentage points
  for (const days of [7, 30, 365]) {
    const d = S.views.all.deltas && S.views.all.deltas[days];
    if (!d) continue;
    [10, 100].forEach((n) => {
      const x = d.pp[S.tops.indexOf(n)];
      if (x != null) v[`d-${days}-${n}`] = x.toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' });
    });
  }
  let block = html.slice(a, b);
  block = block.replace(/(<span data-v="([a-z0-9-]+)">)[^<]*(<\/span>)/g, (m, open, k, close) => (k in v ? open + esc(v[k]) + close : m));
  fs.writeFileSync(file, html.slice(0, a) + block + html.slice(b));
}

// Same formatting as home.js: a plain "$" and three significant digits, so the figures fit the tiles.
function usd(v, loc) {
  const o = { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' };
  if (v >= 1e5) { o.notation = 'compact'; o.maximumSignificantDigits = 3; }
  else if (v >= 1) o.maximumFractionDigits = 2;
  else o.maximumSignificantDigits = 3;
  return new Intl.NumberFormat(loc, o).format(v);
}
const pct = (v, loc) => new Intl.NumberFormat(loc, { maximumFractionDigits: Math.abs(v) < 10 ? 2 : 1, signDisplay: 'exceptZero' }).format(v) + '%';
function hashrate(hs, loc) {
  const u = [[1e18, 'EH/s'], [1e15, 'PH/s'], [1e12, 'TH/s'], [1e9, 'GH/s']].find(([d]) => hs >= d) || [1e6, 'MH/s'];
  return (hs / u[0]).toLocaleString(loc, { maximumFractionDigits: 2 }) + ' ' + u[1];
}

async function priceNow() {
  const file = path.join(DOCS, 'data', 'price.json');
  let saved = null;
  try { saved = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { /* no saved price yet */ }
  const get = async (q) => {
    const r = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&' + q, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  };
  try {
    const a = (await get('ids=pepecoin-network'))[0];
    if (!a || !(a.current_price > 0)) throw new Error('no PEP price');
    // market caps of the top 250 coins, for "×100 would be #N in crypto"; keep yesterday's list if this fails
    let caps = saved && saved.top_caps;
    try {
      const top = (await get('order=market_cap_desc&per_page=250&page=1')).filter((c) => c.id !== 'pepecoin-network' && c.market_cap > 0);
      if (top.length > 100) caps = top.map((c) => Math.round(c.market_cap)).sort((x, y) => y - x);
    } catch (e) { console.error('top 250 not fetched:', e.message); }
    const p = { schema: 1, date: new Date().toISOString().slice(0, 10), price_usd: a.current_price,
      change_24h: typeof a.price_change_percentage_24h === 'number' ? a.price_change_percentage_24h : null,
      supply: a.total_supply || a.circulating_supply || (saved && saved.supply), source: 'https://api.coingecko.com/api/v3/coins/markets' };
    if (caps) p.top_caps = caps;
    fs.writeFileSync(file, JSON.stringify(p) + '\n');
    return p;
  } catch (e) {
    console.error('price not fetched, using the saved one:', e.message);
    return saved;
  }
}

function home(file, S, mining, price) {
  let html = fs.readFileSync(file, 'utf8');
  const loc = LOCALE[langOf(html)] || 'en-US';
  const day = (d, month) => new Date(d + 'T00:00:00Z').toLocaleDateString(loc, { month, day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const v = { 'home-date': day(S.latest.date, 'long') };
  if (mining && mining.hashrate_hs > 0) {
    v['home-hash'] = hashrate(mining.hashrate_hs, loc);
    v['home-hash-date'] = day(mining.date, 'short');
  }
  if (price && price.price_usd > 0) {
    v['home-price'] = usd(price.price_usd, loc);
    if (price.change_24h != null) v['home-change'] = pct(price.change_24h, loc);
    if (price.supply > 0) {
      v['home-mcap'] = usd(price.price_usd * price.supply, loc);
      v['home-x100'] = usd(price.price_usd * price.supply * 100, loc);
      const caps = price.top_caps || [];
      if (caps.length > 100) {
        const x = price.price_usd * price.supply * 100;
        v['home-x100-rank'] = x < caps[caps.length - 1] ? caps.length + '+' : String(1 + caps.filter((c) => c > x).length);
      }
    }
  }
  let n = 0;
  html = html.replace(/(<span\b[^>]*\bdata-v="(home-[a-z0-9-]+)"[^>]*>)[^<]*(<\/span>)/g, (m, open, k, close) => (k in v ? (n++, open + esc(v[k]) + close) : m));
  if (!n) throw new Error('no home-… spans found');
  if ('home-x100-rank' in v) html = html.replace('<span class="x100-rank" hidden>', '<span class="x100-rank">');
  fs.writeFileSync(file, html);
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
let mining = null;
try { mining = JSON.parse(fs.readFileSync(path.join(DOCS, 'data', 'mining.json'), 'utf8')); } catch (e) { console.error('no mining.json:', e.message); }
const price = await priceNow();
for (const f of pages('index.html')) {
  try { home(f, sum, mining, price); console.log('numbers baked into', path.relative(DOCS, f)); }
  catch (e) { failed++; console.error(`${path.relative(DOCS, f)} skipped: ${e.message}`); }
}
// a page that could not be updated keeps yesterday's numbers; never fail the daily job for it
process.exit(0);
