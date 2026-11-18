// Browser test for the Gazette Newsroom and the issue counter (not run in CI).
// Serves docs/ at https://pepecoinhub.github.io and answers the Supabase calls with the REAL SQL
// (update_gazette_newsroom.sql + update_polls.sql) in a throwaway PostgreSQL database; Storage uploads are kept in memory
// but checked against the real storage.objects policies. Every other external request is blocked.
//   PG_URL=postgres://postgres:pw@localhost:5432/postgres PG_MODULE=/abs/node_modules/pg/lib/index.js \
//   [SHOTS=/abs/out] node scripts/newsroom_e2e.mjs
import { readFile, mkdir, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import path from 'node:path';

const PG_URL = process.env.PG_URL, PG_MODULE = process.env.PG_MODULE;
if (!PG_URL || !PG_MODULE) { console.error('Set PG_URL and PG_MODULE (see the header).'); process.exit(2); }
const { chromium } = createRequire(import.meta.url)('playwright');
const pg = (await import(PG_MODULE)).default;
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), DOCS = REPO + '/docs';
const SHOTS = process.env.SHOTS || path.join(REPO, '.newsroom-shots');
const SB = 'https://azbwciqfbsdpwubznncg.supabase.co', ORIGIN = 'https://pepecoinhub.github.io';
const uid = i => '00000000-0000-4000-8000-' + String(i).padStart(12, '0');
const rd = p => readFile(REPO + '/' + p, 'utf8');

const admin = new pg.Client({ connectionString: PG_URL }); await admin.connect();
const dbName = 'newsroom_e2e_' + process.pid; await admin.query('create database ' + dbName);
const u = new URL(PG_URL); u.pathname = '/' + dbName;
const db = new pg.Client({ connectionString: u.toString() }); await db.connect();
await db.query(`do $$ begin create role anon nologin; exception when others then null; end $$;
  do $$ begin create role authenticated nologin; exception when others then null; end $$;
  create schema auth; create schema games; create schema storage;
  create table auth.users(id uuid primary key);
  create table auth.identities(user_id uuid references auth.users(id) on delete cascade, provider text not null, provider_id text not null, identity_data jsonb not null default '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text, created_at timestamptz default now());
  alter table storage.objects enable row level security;
  grant usage on schema public, auth, storage to anon, authenticated; grant select, insert on storage.objects to anon, authenticated;`);
const schema = await rd('games/supabase/schema.sql');
await db.query(schema.match(/create or replace function games\.discord_identity\(u uuid\)[\s\S]*?\n\$\$;/)[0]);
await db.query("create table games.config (id int primary key, host_code_salt text not null); insert into games.config values (1, 'e2e-salt')");
await db.query(schema.match(/create or replace function games\.client_ip_hash\(\)[\s\S]*?\nend \$\$;/)[0]);
const stats = await rd('games/supabase/update_page_stats.sql');
await db.query(stats.match(/create table if not exists games\.owners[\s\S]*?;/)[0]);
await db.query(stats.match(/create or replace function games\.is_owner\(u uuid\)[\s\S]*?\n\$\$;/)[0]);
await db.query(await rd('games/supabase/update_polls.sql'));
await db.query(await rd('games/supabase/update_gazette_newsroom.sql'));
for (const i of [1, 2]) { await db.query('insert into auth.users values ($1)', [uid(i)]); await db.query("insert into auth.identities values ($1, 'discord', $2, $3)", [uid(i), 'd' + i, JSON.stringify({ full_name: i === 1 ? 'Byl' : 'Fren' })]); }
await db.query("insert into games.owners values ('d1', 'owner')");

const files = new Map();   // uploaded pictures (Storage)
const subOf = req => { try { return JSON.parse(Buffer.from((req.headers().authorization || '').split(' ')[1].split('.')[1], 'base64url').toString()).sub || ''; } catch (e) { return ''; } };
async function asUser(sub, q, args) {
  await db.query('begin');
  try {
    await db.query('set local role ' + (sub ? 'authenticated' : 'anon'));
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [sub]);
    await db.query("select set_config('request.headers', $1, true)", [JSON.stringify({ 'cf-connecting-ip': '7.7.7.' + (sub ? sub.slice(-1) : '0') })]);
    const r = await db.query(q, args); await db.query('commit'); return r;
  } catch (e) { await db.query('rollback'); throw e; }
}
async function sbHandler(route) {
  const req = route.request(), url = new URL(req.url()), sub = subOf(req);
  const json = (st, o) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
  const p = url.pathname;
  if (p.startsWith('/storage/v1/object/public/gazette/')) {
    const f = files.get(p.split('/').pop()); return f ? route.fulfill({ status: 200, contentType: f.type, body: f.body }) : route.fulfill({ status: 404, body: '' });
  }
  if (p === '/storage/v1/object/list/gazette') {
    try { const r = await asUser(sub, "select name, id from storage.objects where bucket_id = 'gazette' order by created_at desc", []); return json(200, r.rows); }
    catch (e) { return json(400, { message: e.message }); }
  }
  if (p.startsWith('/storage/v1/object/gazette/') && req.method() === 'POST') {
    const name = p.split('/').pop();
    try { await asUser(sub, "insert into storage.objects (bucket_id, name) values ('gazette', $1)", [name]); }
    catch (e) { return json(400, { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' }); }
    files.set(name, { type: req.headers()['content-type'], body: req.postDataBuffer() }); return json(200, { Key: 'gazette/' + name });
  }
  if (!p.startsWith('/rest/v1/rpc/')) return json(404, {});
  const fn = p.replace('/rest/v1/rpc/', ''), body = req.postData() ? JSON.parse(req.postData()) : {};
  if (fn === 'gry_letters') return json(200, sub === uid(1) ? { unread: 0, letters: [] } : null);   // the owner's mailbox (only its yes/no matters here)
  if (!/^gry_(gazette|newsroom|poll)/.test(fn)) return json(404, { code: 'PGRST202', message: 'Could not find the function public.' + fn });
  const names = Object.keys(body);
  try {
    const r = await asUser(sub, 'select public.' + fn + '(' + names.map((n, i) => n + ' => $' + (i + 1) + (typeof body[n] === 'object' && body[n] !== null ? '::jsonb' : '')).join(', ') + ') as v',
      names.map(n => typeof body[n] === 'object' && body[n] !== null ? JSON.stringify(body[n]) : body[n]));
    return json(200, r.rows[0] ? r.rows[0].v : null);
  } catch (e) { return json(400, { code: e.code, message: e.message }); }
}
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
async function staticHandler(route) {
  let p = decodeURIComponent(new URL(route.request().url()).pathname); if (p.endsWith('/')) p += 'index.html';
  try { return route.fulfill({ status: 200, contentType: TYPES[path.extname(p)] || 'application/octet-stream', body: await readFile(path.join(DOCS, path.normalize(p))) }); }
  catch (e) { return route.fulfill({ status: 404, body: 'nf' }); }
}
const browser = await chromium.launch();
await rm(SHOTS, { recursive: true, force: true }); await mkdir(SHOTS, { recursive: true });
const token = i => 'x.' + Buffer.from(JSON.stringify({ sub: uid(i), role: 'authenticated' })).toString('base64url') + '.sig';
async function newPage(user, mobile) {
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 });
  await ctx.route('**/*', route => { const x = route.request().url(); if (x.startsWith(ORIGIN + '/')) return staticHandler(route); if (x.startsWith(SB + '/')) return sbHandler(route); return route.abort('blockedbyclient'); });
  await ctx.addInitScript(s => { try { sessionStorage.setItem('pondos-boot', '1'); sessionStorage.setItem('pondos-notice', '1');
    if (s) localStorage.setItem('sb-azbwciqfbsdpwubznncg-auth-token', s); } catch (e) {}
    document.addEventListener('securitypolicyviolation', e => console.error('CSP ' + e.effectiveDirective + ' ' + e.blockedURI)); },
    user ? JSON.stringify({ access_token: token(user), refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: uid(user), is_anonymous: false, identities: [{ provider: 'discord', identity_data: { full_name: user === 1 ? 'Byl' : 'Fren' } }], user_metadata: {} } }) : null);
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_BLOCKED_BY_CLIENT|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('dialog', d => d.accept());
  await page.goto(ORIGIN + '/meme/', { waitUntil: 'load' }); await page.waitForSelector('.start');
  return { ctx, page, errors };
}
const shot = async (page, name, sel) => { await page.waitForTimeout(450); if (sel) await page.locator(sel).first().screenshot({ path: SHOTS + '/' + name + '.png' }); else await page.screenshot({ path: SHOTS + '/' + name + '.png' }); console.log('• screenshot', name); };
const MAIL = '.app-win[aria-label="Frog Mail - Inbox"]', NR = '.app-win[aria-label="Newsroom.exe - The Pond Gazette"]';
const openMail = async page => { await page.locator('.tray-mail').first().click(); await page.waitForSelector(MAIL + ' .gazette'); };
let failures = 0;
const step = async (name, fn) => { try { await fn(); console.log('• PASS', name); } catch (e) { failures++; console.log('✗ FAIL', name, '\n ', e.message.slice(0, 1200)); } };

try {
  await step('Visitor before any Newsroom issue: the counter shows No. 010, ◀ goes back, the archive lists #10…#2', async () => {
    const { page, errors, ctx } = await newPage(null);
    await openMail(page);
    assert.match(await page.textContent(MAIL + ' .gz-top'), /Issue #10/);
    assert.equal(await page.$$eval(MAIL + ' .odo-roll', r => r.map(x => x.style.getPropertyValue('--d')).join('')), '010');
    assert.equal(await page.locator(MAIL + ' .gz-newer').isDisabled(), true);
    assert.equal(await page.locator(MAIL + ' .ml-news').isVisible(), false, 'no Newsroom for visitors');
    await page.click(MAIL + ' .gz-older');
    assert.match(await page.textContent(MAIL + ' .gz-top'), /Issue #9/);
    await page.click(MAIL + ' .gz-odo');
    assert.deepEqual(await page.$$eval(MAIL + ' .gz-arch b', b => b.map(x => x.textContent)), ['#10', '#9', '#8', '#7', '#6', '#5', '#4', '#3', '#2']);
    await shot(page, '01-licznik-archiwum-komputer', MAIL);
    await page.click(MAIL + ' .gz-arch button[data-n="3"]');
    assert.match(await page.textContent(MAIL + ' .gz-top'), /Issue #3/);
    assert.equal(await page.locator(MAIL + ' .gz-arch').isHidden(), true);
    assert.deepEqual(errors, []); await ctx.close();
  });

  await step('Owner: Newsroom → new issue #11 from pasted text, picture, button, poll → draft → preview → publish', async () => {
    const { page, errors, ctx } = await newPage(1);
    await openMail(page);
    await page.waitForSelector(MAIL + ' .ml-news', { state: 'visible' });
    await page.click(MAIL + ' .ml-news');
    await page.waitForSelector(NR + ' .nr-new');
    await shot(page, '02-newsroom-lista', NR);
    assert.match(await page.textContent(NR + ' .nr-new'), /New issue #11/);
    await page.click(NR + ' .nr-new');
    await page.fill(NR + ' [data-k="title"]', 'The Newsroom is open');
    await page.click(NR + ' .nr-paste summary');
    await page.fill(NR + ' .nr-paste-in', '## Breaking news | The editor got a desk!\nFrom today the Gazette is written **right here in PondOS**.\n\nNo more waiting.\n\n## Games desk | Three things to try\n- Pepe Guesser every day\n- PEPaint on Friday\n> Best game ever. (a fren)\n\nRead the [mining guide](mining.html).');
    await page.click(NR + ' .nr-paste-go');
    assert.equal(await page.locator(NR + ' .nr-block').count(), 2);
    assert.equal(await page.inputValue(NR + ' .nr-block >> nth=0 >> [data-f="heading"]'), 'The editor got a desk!');
    // a picture from the site, next to the text
    await page.click(NR + ' .nr-block >> nth=0 >> .nr-pick');
    await page.click(NR + ' .nr-grid [data-src="happy.webp"]');
    assert.equal(await page.getAttribute(NR + ' .nr-block >> nth=0 >> .nr-pic img', 'src'), 'img/happy.webp');
    // a button that opens Pepe Guesser
    await page.fill(NR + ' .nr-block >> nth=1 >> [data-b="0"] [data-bf="label"]', 'Play today\'s photo →');
    await page.selectOption(NR + ' .nr-block >> nth=1 >> [data-b="0"] [data-bf="go"]', 'wpgo');
    // a Pond Poll
    await page.click(NR + ' [data-add="poll"]');
    await page.fill(NR + ' .nr-block >> nth=2 >> [data-f="heading"]', 'Do you like the new Newsroom?');
    await page.fill(NR + ' .nr-block >> nth=2 >> [data-pf="question"]', 'Do you like the new Newsroom?');
    await page.fill(NR + ' .nr-block >> nth=2 >> [data-pf="options"]', 'Yes 🐸\nNo\nWhat newsroom?');
    await shot(page, '03-newsroom-edytor', NR);
    await page.click(NR + ' .nr-save');
    await page.waitForFunction(s => /Saved at/.test(document.querySelector(s + ' .nr-foot .nr-msg').textContent), NR);
    assert.equal((await db.query('select count(*)::int n from games.gazette_issues where published_at is null')).rows[0].n, 1);
    assert.equal((await db.query("select count(*)::int n from games.polls where id like 'gz11_%'")).rows[0].n, 1);
    await page.click(NR + ' .nr-prev');
    await page.waitForSelector(NR + ' .nr-over .gazette');
    const pv = await page.textContent(NR + ' .nr-over .gazette');
    assert.match(pv, /Issue #11/); assert.match(pv, /DRAFT/); assert.match(pv, /right here in PondOS/);
    assert.equal(await page.locator(NR + ' .nr-over .gazette a[href="mining.html"]').count(), 1);
    assert.equal(await page.locator(NR + ' .nr-over .gazette .gz-quote').count(), 1);
    await shot(page, '04-podglad', NR);
    await page.click(NR + ' .nr-over .nr-over-bar button');
    await page.click(NR + ' .nr-pub');
    await page.waitForFunction(s => /Published!/.test(document.querySelector(s + ' .nr-foot .nr-msg').textContent), NR);
    assert.equal((await db.query('select count(*)::int n from games.gazette_issues where published_at is not null')).rows[0].n, 1);
    assert.deepEqual(errors, []); await ctx.close();
  });

  await step('Owner: upload a phone photo (shrunk, stored in the gazette bucket) and use it wide in a story', async () => {
    const { page, errors, ctx } = await newPage(1);
    await openMail(page);
    await page.waitForSelector(MAIL + ' .ml-news', { state: 'visible' }); await page.click(MAIL + ' .ml-news');
    await page.click(NR + ' [data-issue="11"]');
    await page.click(NR + ' .nr-block >> nth=1 >> .nr-pick');
    // a 2400×1600 "photo" made in the page, uploaded through the file input
    const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 2400; c.height = 1600; const g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 2400, 1600); gr.addColorStop(0, '#2e7d32'); gr.addColorStop(1, '#f2c200'); g.fillStyle = gr; g.fillRect(0, 0, 2400, 1600);
      g.fillStyle = '#fff'; g.font = 'bold 260px sans-serif'; g.fillText('POND PHOTO', 200, 900); return c.toDataURL('image/png').split(',')[1]; });
    await page.setInputFiles(NR + ' .nr-over input[type=file]', { name: 'IMG_0001.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    await page.waitForSelector(NR + ' .nr-over', { state: 'detached' });
    const src = await page.getAttribute(NR + ' .nr-block >> nth=1 >> .nr-pic img', 'src');
    assert.ok(src.startsWith(SB + '/storage/v1/object/public/gazette/'), src);
    const f = files.get(src.split('/').pop()); assert.ok(f && f.body.length < 1048576, 'stored under 1 MB'); assert.equal(f.type, 'image/webp');
    await page.selectOption(NR + ' .nr-block >> nth=1 >> [data-f="imgSize"]', 'wide');
    await page.click(NR + ' .nr-save');
    await page.waitForFunction(s => /Saved at/.test(document.querySelector(s + ' .nr-foot .nr-msg').textContent), NR);
    // the picker's "My uploads" lists it
    await page.click(NR + ' .nr-block >> nth=0 >> .nr-pick'); await page.click(NR + ' [data-pt="mine"]');
    await page.waitForSelector(NR + ' .nr-over .nr-grid [data-src^="https://"]');
    await page.click(NR + ' .nr-over .nr-x');
    assert.deepEqual(errors, []); await ctx.close();
  });

  await step('Owner: a PEP-TV ad from the Newsroom plays and sits in the PEP-TV folder', async () => {
    const { page, errors, ctx } = await newPage(1);
    await openMail(page);
    await page.waitForSelector(MAIL + ' .ml-news', { state: 'visible' }); await page.click(MAIL + ' .ml-news');
    await page.click(NR + ' [data-tab="ads"]'); await page.click(NR + ' .nr-new');
    await page.fill(NR + ' [data-k="title"]', 'The Newsroom Hotline');
    assert.equal(await page.inputValue(NR + ' [data-k="id"]'), 'the_newsroom_hotline.mpg');
    await page.selectOption(NR + ' [data-k="look"]', 'news');
    await page.fill(NR + ' .nr-block >> nth=0 >> [data-f="kick"]', 'Got news for the pond?');
    await page.fill(NR + ' .nr-block >> nth=0 >> [data-f="big"]', 'Call the *Newsroom!*');
    await page.fill(NR + ' .nr-block >> nth=1 >> [data-f="big"]', 'Just kidding. *Write a letter.*');
    await page.fill(NR + ' .nr-block >> nth=1 >> [data-f="fine"]', 'Not a real hotline.');
    await page.fill(NR + ' .nr-block >> nth=1 >> [data-bf="label"]', 'Write to the Editor →');
    await page.selectOption(NR + ' .nr-block >> nth=1 >> [data-bf="go"]', 'write');
    await page.click(NR + ' .nr-iconrow .nr-pick'); await page.click(NR + ' .nr-grid [data-src="phone.webp"]');
    await page.click(NR + ' .nr-pub');
    await page.waitForFunction(s => /Published!/.test(document.querySelector(s + ' .nr-foot .nr-msg').textContent), NR);
    await shot(page, '05-newsroom-reklama', NR);
    await page.click(NR + ' .nr-prev');
    await page.waitForSelector('.app-win .ptv-scene.on .ad-big');
    assert.match(await page.textContent('.app-win .ptv-scene.on'), /Call the Newsroom!/);
    await shot(page, '06-reklama-gra');
    assert.deepEqual(errors, []); await ctx.close();
  });

  await step('Owner on a phone: the Newsroom list and editor fit a 390 px screen', async () => {
    const { page, errors, ctx } = await newPage(1, true);
    await openMail(page);
    await page.waitForSelector(MAIL + ' .ml-news', { state: 'visible' }); await page.click(MAIL + ' .ml-news');
    await page.waitForSelector(NR + ' [data-issue="11"]');
    await shot(page, '10-telefon-newsroom-lista');
    await page.click(NR + ' [data-issue="11"]');
    await page.waitForSelector(NR + ' .nr-block');
    const over = await page.evaluate(s => { const w = document.querySelector(s); return w.scrollWidth - w.clientWidth; }, NR);
    assert.ok(over <= 1, 'no sideways scrolling, got ' + over);
    await shot(page, '11-telefon-newsroom-edytor');
    await page.click(NR + ' .nr-block >> nth=0 >> .nr-pick');
    await shot(page, '12-telefon-wybor-obrazka');
    await page.click(NR + ' .nr-over .nr-x');
    assert.deepEqual(errors, []); await ctx.close();
  });
  await step('Visitor on a phone: #11 from the Newsroom opens first, counter 011, picture, poll, button; PEP-TV has the new ad', async () => {
    const { page, errors, ctx } = await newPage(null, true);
    await page.waitForFunction(() => document.querySelector('.tray-mail.has-mail'), null, { timeout: 8000 });
    await openMail(page);
    await page.waitForFunction(s => /Issue #11/.test(document.querySelector(s + ' .gz-top') ? document.querySelector(s + ' .gz-top').textContent : ''), MAIL);
    assert.equal(await page.$$eval(MAIL + ' .odo-roll', r => r.map(x => x.style.getPropertyValue('--d')).join('')), '011');
    assert.match(await page.textContent(MAIL + ' .gz-odo-t'), /The Newsroom is open · latest/);
    assert.equal(await page.locator(MAIL + ' .gazette script').count(), 0);
    assert.equal(await page.locator(MAIL + ' .gz-hero').count(), 1, 'the wide photo');
    await page.waitForSelector(MAIL + ' .gz-vote');
    assert.deepEqual(await page.$$eval(MAIL + ' .gz-vote', b => b.map(x => x.textContent)), ['Yes 🐸', 'No', 'What newsroom?']);
    await shot(page, '07-telefon-wydanie-11');
    await page.evaluate(s => document.querySelector(s + ' .gz-hero').scrollIntoView(), MAIL);
    await shot(page, '08-telefon-zdjecie-i-ankieta');
    await page.click(MAIL + ' .gz-odo');
    await shot(page, '09-telefon-archiwum');
    await page.click(MAIL + ' .gz-arch button[data-n="11"]');
    await page.click(MAIL + ' [data-go="wpgo"]');
    await page.waitForSelector('.app-win[aria-label*="Pepe Guesser"], .app-win[aria-label*="PepeGuesser"]', { timeout: 5000 });
    assert.ok(await page.evaluate(() => { try { return +localStorage.getItem('pondos-mail-read') === 11; } catch (e) { return false; } }));
    assert.deepEqual(errors, []); await ctx.close();
  });
} finally {
  await browser.close(); await db.end(); await admin.query('drop database ' + dbName + ' with (force)'); await admin.end();
}
console.log(failures ? failures + ' step(s) failed' : 'all steps passed', '· shots in', SHOTS);
process.exit(failures ? 1 : 0);
