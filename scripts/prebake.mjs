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
// press.html (and */press.html): today's figures for journalists (data-v="press-…"), each with its date.
// data/ticker.json: the figures for the data strip under the header (chrome.js).
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
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  const row = net.rows[net.rows.length - 1];
  saved.supply = row[net.columns.indexOf('supply_pep')];
  saved.supply_source = 'https://pepeblocks.com/';
  saved.supply_time = new Date(row[net.columns.indexOf('time')] * 1000).toISOString();
  saved.market_cap = saved.price_usd * saved.supply;
  fs.writeFileSync(file, JSON.stringify(saved) + '\n');
  const quotesFile = path.join(DOCS, 'data', 'market-prices.json');
  if (fs.existsSync(quotesFile)) {
    const quotes = JSON.parse(fs.readFileSync(quotesFile, 'utf8'));
    quotes.pep_supply = { value: saved.supply, time: saved.supply_time, source: saved.supply_source };
    fs.writeFileSync(quotesFile, JSON.stringify(quotes) + '\n');
  }
  return saved;
}

function home(file, S, mining, price) {
  let html = fs.readFileSync(file, 'utf8');
  const loc = LOCALE[langOf(html)] || 'en-US';
  const day = (d, month) => new Date(d + 'T00:00:00Z').toLocaleDateString(loc, { month, day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const v = { 'home-date': day(S.latest.date, 'long') };
  if (S.latest.supply > 0) v['home-supply'] = bigPep(S.latest.supply, loc);
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

// 105158190000 -> "105.16B" / "105,16 mld" (the locale's own short form)
const bigPep = (v, loc) => new Intl.NumberFormat(loc, { notation: 'compact', maximumFractionDigits: 2 }).format(v);

function press(file, S, N, mining, price) {
  let html = fs.readFileSync(file, 'utf8');
  const loc = LOCALE[langOf(html)] || 'en-US';
  const day = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString(loc, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const last = N.rows[N.rows.length - 1], col = (k) => last[N.columns.indexOf(k)];
  const v = { 'press-snap-date': day(S.latest.date) };
  if (S.latest.supply > 0) v['press-supply'] = bigPep(S.latest.supply, loc);
  if (S.latest.height) v['press-height'] = Number(S.latest.height).toLocaleString(loc);
  if (col('addresses_with_balance')) v['press-addr'] = Number(col('addresses_with_balance')).toLocaleString(loc);
  const i10 = S.tops.indexOf(10);
  if (i10 >= 0 && S.views.all.shares[i10] != null) v['press-top10'] = S.views.all.shares[i10].toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
  if (mining && mining.hashrate_hs > 0) { v['press-hash'] = hashrate(mining.hashrate_hs, loc); v['press-hash-date'] = day(mining.date); }
  if (price && price.price_usd > 0) {
    v['press-price'] = usd(price.price_usd, loc);
    v['press-price-date'] = day(price.date);
    if (price.supply > 0) v['press-mcap'] = usd(price.price_usd * price.supply, loc);
  }
  let n = 0;
  html = html.replace(/(<span\b[^>]*\bdata-v="(press-[a-z0-9-]+)"[^>]*>)[^<]*(<\/span>)/g, (m, open, k, close) => (k in v ? (n++, open + esc(v[k]) + close) : m));
  if (!n) throw new Error('no press-… spans found');
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

// Update text fallbacks everywhere, not just the home page. Historical examples without
// data-live/data-m remain historical. No network requests are made by this generator.
let markets = [];
try { markets = JSON.parse(fs.readFileSync(path.join(DOCS, 'data/market-prices.json'), 'utf8')).markets; } catch (e) { /* first run */ }
function bakeFacts(file) {
  let html = fs.readFileSync(file, 'utf8');
  const lang = langOf(html), loc = LOCALE[lang] || 'en-US', row = net.rows[net.rows.length - 1];
  const col = (key) => row[net.columns.indexOf(key)];
  const fmt = (v, digits) => new Intl.NumberFormat(loc, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
  const values = { 'supply-b': fmt(col('supply_pep') / 1e9, 1), 'supply-m': fmt(Math.round(col('supply_pep') / 1e8) * 100, 0),
    'supply-yi': String(Math.round(col('supply_pep') / 1e8)), inflation: fmt(Math.round(5256000000 / col('supply_pep') * 100), 0),
    addresses: fmt(col('addresses_with_balance'), 0), height: fmt(col('height'), 0), year: String(new Date(col('time') * 1000).getUTCFullYear()) };
  html = html.replace(/(<span\b[^>]*\bdata-live="([a-z-]+)"[^>]*>)[^<]*(<\/span>)/g, (m, open, key, close) => key in values ? open + esc(values[key]) + close : m);
  if (file.includes(path.sep + 'meme' + path.sep)) {
    const m = { supply: bigPep(col('supply_pep'), 'en-US'), 'supply-b': values['supply-b'], height: values.height,
      addrs: fmt(col('addresses_with_balance'), 0), price: usd(price.price_usd, loc), chg: pct(price.change_24h || 0, loc),
      mcap: usd(price.price_usd * price.supply, loc), x100: usd(price.price_usd * price.supply * 100, loc),
      rank: String(1 + (price.top_caps || []).filter((c) => c > price.price_usd * price.supply * 100).length),
      tdate: new Date(price.updated_at || price.date).toLocaleString(loc),
      hash: mining && hashrate(mining.hashrate_hs, loc), hdate: mining && mining.date };
    html = html.replace(/(<span\b[^>]*\bdata-m="([a-z0-9-]+)"[^>]*>)[^<]*(<\/span>)/g, (match, open, key, close) => m[key] != null ? open + esc(m[key]) + close : match);
    html = html.replace(/(<div\b[^>]*\bdata-m="(price|mcap|x100|hash)"[^>]*>)[^<]*(<\/div>)/g, (match, open, key, close) => m[key] != null ? open + esc(m[key]) + close : match);
  }
  if (['calculator.html', 'compare.html'].includes(path.basename(file)) && markets.length) {
    const snapshot = markets.filter((c) => ['pepecoin-network', 'dogecoin', 'bitcoin', 'litecoin', 'pepe'].includes(c.id)).map((c) => c.id === 'pepecoin-network' ? { ...c, total_supply: price.supply, market_cap: price.price_usd * price.supply } : c);
    html = html.replace(/var SNAP = \[[\s\S]*?\n  \];/, 'var SNAP = ' + JSON.stringify(snapshot) + ';');
    const status = new Date(price.updated_at || price.date).toLocaleString(loc) + ' · CoinGecko';
    html = html.replace(/(<p\b[^>]*\bid="status"[^>]*>)[^<]*(<\/p>)/, '$1' + esc(status) + '$2');
  }
  fs.writeFileSync(file, html);
}
for (const file of fs.readdirSync(DOCS, { recursive: true }).filter((f) => f.endsWith('.html'))) {
  try { bakeFacts(path.join(DOCS, file)); } catch (e) { failed++; console.error(file + ': ' + e.message); }
}
for (const f of pages('index.html')) {
  try { home(f, sum, mining, price); console.log('numbers baked into', path.relative(DOCS, f)); }
  catch (e) { failed++; console.error(`${path.relative(DOCS, f)} skipped: ${e.message}`); }
}
for (const f of pages('press.html')) {
  try { press(f, sum, net, mining, price); console.log('numbers baked into', path.relative(DOCS, f)); }
  catch (e) { failed++; console.error(`${path.relative(DOCS, f)} skipped: ${e.message}`); }
}
// Data strip under the header (chrome.js): price and its 24h change, hashrate against a day ago, the top 10/50/400
// shares and how many addresses are new in the top 2000 since the previous snapshot. Kept in data/ticker.json,
// with the hashrate readings of the last two days (the change compares the average of the last 24 hours with the day before).
try {
  const file = path.join(DOCS, 'data', 'ticker.json');
  let old = {};
  try { old = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { /* first run */ }
  const t = { schema: 2, updated: new Date().toISOString().slice(0, 16) + 'Z' };
  if (price && price.price_usd > 0) t.price = { usd: price.price_usd, change_24h: price.change_24h, time: price.updated_at || price.date };
  const H = 3600e3, now = Date.now();
  let samples = (old.hash_samples || []).filter((x) => now - Date.parse(x[0]) < 50 * H);
  if (mining && mining.hashrate_hs > 0) {
    const lastS = samples[samples.length - 1];
    if (!lastS || lastS[1] !== mining.hashrate_hs) samples.push([mining.updated_at || mining.date + 'T00:00:00Z', mining.hashrate_hs]);
    // single readings swing by ±10% within hours, so compare the average of the last 24 hours with the 24 hours before
    const avg = (from, to) => {
      const v = samples.filter((x) => { const age = now - Date.parse(x[0]); return age >= from && age < to; }).map((x) => x[1]);
      return v.length >= 2 ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };
    const day = avg(0, 24 * H), before = avg(24 * H, 48 * H);
    t.hashrate = { hs: mining.hashrate_hs, time: mining.updated_at || mining.date, change_24h: day && before ? Math.round((day / before - 1) * 10000) / 100 : null };
  }
  t.hash_samples = samples;
  const share = (n) => { const i = sum.tops.indexOf(n); return i < 0 ? null : sum.views.all.shares[i]; };
  t.tops = { 10: share(10), 50: share(50), 400: share(400) };
  t.snapshot = sum.latest.date;
  const dir = path.join(DOCS, 'data', 'snapshots');
  const [prev, last] = fs.readdirSync(dir).filter((f) => /^\d{4}-\d\d-\d\d\.json$/.test(f)).sort().slice(-2);
  if (prev && last) {
    const rows = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).rows.map((r) => r[0]);
    const before = new Set(rows(prev));
    t.new_top2000 = rows(last).filter((a) => !before.has(a)).length;
  }
  fs.writeFileSync(file, JSON.stringify(t) + '\n');
  console.log('data strip:', JSON.stringify({ ...t, hash_samples: samples.length }));
} catch (e) { failed++; console.error('ticker.json not updated:', e.message); }
// A broken generator must be visible in Actions, not silently publish mixed snapshots.
process.exitCode = failed ? 1 : 0;
