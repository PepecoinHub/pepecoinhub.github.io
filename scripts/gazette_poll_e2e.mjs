// Browser test for The Pond Gazette #5, its Pond Poll and the desktop community icons (not run in CI).
// Serves docs/ at https://pepecoinhub.github.io and answers gry_poll / gry_poll_vote with the REAL SQL
// (games/supabase/update_polls.sql) in a throwaway PostgreSQL. Every other external request is blocked.
//   FREN_TOOLS=/abs/tools FREN_CHROME=/abs/chrome [FREN_SHOTS=/abs/out] node scripts/gazette_poll_e2e.mjs
// FREN_TOOLS: a folder with `npm i playwright embedded-postgres pg`. As root: unshare --user --map-user=1000 --map-group=1000 node …
import { readFile, mkdir, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import path from 'node:path';

const TOOLS = process.env.FREN_TOOLS, CHROME = process.env.FREN_CHROME;
if (!TOOLS || !CHROME) { console.error('Set FREN_TOOLS and FREN_CHROME (see the header).'); process.exit(2); }
const need = createRequire(path.join(TOOLS, 'package.json'));
const pw = await import(need.resolve('playwright')); const chromium = pw.chromium || pw.default.chromium;
const ep0 = await import(need.resolve('embedded-postgres')); const EmbeddedPostgres = ep0.default.default || ep0.default;
const pg = (await import(need.resolve('pg'))).default;
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), DOCS = REPO + '/docs';
const SHOTS = process.env.FREN_SHOTS || path.join(TOOLS, 'shots-gazette');
const SB = 'https://azbwciqfbsdpwubznncg.supabase.co', ORIGIN = 'https://pepecoinhub.github.io';
const uid = i => '00000000-0000-4000-8000-' + String(i).padStart(12, '0');
const rd = p => readFile(REPO + '/' + p, 'utf8');

const dir = path.join(TOOLS, 'pgdata-gazette'); await rm(dir, { recursive: true, force: true });
const ep = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'pw', port: 54342, persistent: false, onLog: () => {}, onError: () => {} });
await ep.initialise(); await ep.start();
const db = new pg.Client({ host: 'localhost', port: 54342, user: 'postgres', password: 'pw', database: 'postgres' }); await db.connect();
await db.query(`create role anon nologin; create role authenticated nologin; create schema auth; create schema games;
  create table auth.users(id uuid primary key);
  create table auth.identities(user_id uuid references auth.users(id) on delete cascade, provider text not null, provider_id text not null, identity_data jsonb not null default '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated;`);
const schema = await rd('games/supabase/schema.sql');
await db.query(schema.match(/create or replace function games\.discord_identity\(u uuid\)[\s\S]*?\n\$\$;/)[0]);
await db.query("create table games.config (id int primary key, host_code_salt text not null); insert into games.config values (1, 'e2e-salt')");
await db.query(schema.match(/create or replace function games\.client_ip_hash\(\)[\s\S]*?\nend \$\$;/)[0]);
let polls = true;
await db.query(await rd('games/supabase/update_polls.sql'));
await db.query('insert into auth.users values ($1), ($2)', [uid(3), uid(4)]);   // guests (anonymous log-on)
for (const i of [1, 2]) { await db.query('insert into auth.users values ($1)', [uid(i)]); await db.query("insert into auth.identities values ($1, 'discord', $2, $3)", [uid(i), 'd' + i, JSON.stringify({ full_name: 'Fren' + i })]); }
await db.query("insert into games.poll_votes values ('like_polls', $1, 'yes')", [uid(2)]);   // somebody voted before us

const ALLOWED = new Set(['gry_poll', 'gry_poll_vote']);
const calls = [];
async function rpcHandler(route) {
  const req = route.request(), fn = new URL(req.url()).pathname.replace('/rest/v1/rpc/', '');
  const body = req.postData() ? JSON.parse(req.postData()) : {};
  let sub = ''; try { sub = JSON.parse(Buffer.from((req.headers().authorization || '').split('.')[1], 'base64url').toString()).sub || ''; } catch (e) {}
  calls.push(fn);
  const json = (st, o) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
  if (!ALLOWED.has(fn) || !polls) return json(404, { code: 'PGRST202', message: 'Could not find the function public.' + fn });
  const names = Object.keys(body);
  try {
    await db.query('begin'); await db.query('set local role ' + (sub ? 'authenticated' : 'anon'));
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [sub]);
    await db.query("select set_config('request.headers', $1, true)", [JSON.stringify({ 'cf-connecting-ip': '7.7.7.' + (sub ? sub.slice(-1) : '0') })]);
    const r = await db.query('select public.' + fn + '(' + names.map((n, i) => n + ' => $' + (i + 1)).join(', ') + ') as v', names.map(n => body[n]));
    await db.query('commit'); return json(200, r.rows[0].v);
  } catch (e) { await db.query('rollback'); return json(400, { code: e.code, message: e.message }); }
}
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.woff2': 'font/woff2' };
async function staticHandler(route) {
  let p = decodeURIComponent(new URL(route.request().url()).pathname); if (p.endsWith('/')) p += 'index.html';
  try { return route.fulfill({ status: 200, contentType: TYPES[path.extname(p)] || 'application/octet-stream', body: await readFile(path.join(DOCS, path.normalize(p))) }); }
  catch (e) { return route.fulfill({ status: 404, body: 'nf' }); }
}
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
await rm(SHOTS, { recursive: true, force: true }); await mkdir(SHOTS, { recursive: true });
const token = i => 'x.' + Buffer.from(JSON.stringify({ sub: uid(i), role: 'authenticated' })).toString('base64url') + '.sig';
async function newPage(user, mobile, guest) {
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 800 } });
  await ctx.route('**/*', route => { const u = route.request().url(); if (u.startsWith(ORIGIN + '/')) return staticHandler(route); if (u.startsWith(SB + '/rest/v1/rpc/')) return rpcHandler(route); return route.abort('blockedbyclient'); });
  await ctx.addInitScript(s => { try { sessionStorage.setItem('pondos-boot', '1'); sessionStorage.setItem('pondos-notice', '1'); localStorage.removeItem('pondos-mail-read');
    if (s) localStorage.setItem('sb-azbwciqfbsdpwubznncg-auth-token', s); } catch (e) {}
    document.addEventListener('securitypolicyviolation', e => console.error('CSP ' + e.effectiveDirective + ' ' + e.blockedURI)); },
    user ? JSON.stringify({ access_token: token(user), expires_at: Math.floor(Date.now() / 1000) + 3600, user: guest ? { id: uid(user), is_anonymous: true, identities: [], user_metadata: {} }
      : { id: uid(user), is_anonymous: false, identities: [{ provider: 'discord', identity_data: { full_name: 'Fren' + user } }], user_metadata: { full_name: 'Fren' + user } } }) : null);
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_BLOCKED_BY_CLIENT|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(ORIGIN + '/meme/', { waitUntil: 'load' }); await page.waitForSelector('.start');
  return { ctx, page, errors };
}
const shot = async (page, name, opts) => { await page.waitForTimeout(200); await page.screenshot({ path: SHOTS + '/' + name + '.jpg', type: 'jpeg', quality: 84, ...(opts || {}) }); console.log('• screenshot', name); };
const MAIL = '.app-win[aria-label="Frog Mail - Inbox"]';
let failures = 0;
const step = async (name, fn) => { try { await fn(); console.log('• PASS', name); } catch (e) { failures++; console.log('✗ FAIL', name, '\n ', e.message.slice(0, 900)); } };

try {
  await step('Desktop: r/pepecoin and the classic bird sit next to NERDS ONLY, above the taskbar; nothing new in the tray', async () => {
    const { page, errors, ctx } = await newPage(null);
    const names = await page.$$eval('.desk .g-nerds a', l => l.map(a => [a.getAttribute('href'), a.textContent.trim(), a.querySelector('img').getAttribute('src')]));
    assert.deepEqual(names, [['#nerds', 'NERDS ONLY', 'img/ico/nerds-folder.webp'], ['#reddit', 'r/pepecoin', 'img/ico/reddit.svg'], ['#twitter', 'Twitter', 'img/ico/twitter-bird.svg']]);
    assert.equal(await page.locator('.tray a[href*="reddit"], .tray a[href*="x.com"], .tray a[href*="twitter"]').count(), 0, 'no social links in the tray');
    const task = await page.evaluate(() => document.querySelector('.task, .taskbar, .pondos .tray').getBoundingClientRect().top);
    for (const h of ['#reddit', '#twitter']) {
      const r = await page.locator('.desk a[href="' + h + '"]').boundingBox();
      assert.ok(r.y + r.height <= task + 1, h + ' sits above the taskbar');
    }
    const opened = [];
    await page.exposeFunction('noteOpen', u => opened.push(u));
    await page.evaluate(() => { window.open = (u) => { window.noteOpen(u); return null; }; });
    await page.dblclick('.desk a[href="#reddit"]'); await page.dblclick('.desk a[href="#twitter"]');
    await page.waitForTimeout(200);
    assert.deepEqual(opened, ['https://www.reddit.com/r/pepecoin/', 'https://x.com/PepecoinNetwork']);
    await shot(page, '01-desktop-icons', { clip: { x: 0, y: 560, width: 420, height: 240 } });
    assert.deepEqual(errors, []); await ctx.close();
  });
  await step('Gazette #5 opens first; a visitor sees the vote buttons (guest log-on on click); no counts before voting', async () => {
    const { page, errors, ctx } = await newPage(null);
    await page.click('.tray-mail'); await page.waitForSelector(MAIL + ' .gazette');
    assert.match(await page.textContent(MAIL + ' .gz-top'), /Issue #5/);
    assert.match(await page.textContent(MAIL + ' .gazette'), /locked the games out/);
    await page.waitForSelector(MAIL + ' .gz-vote');
    assert.match(await page.textContent(MAIL + ' .gz-poll'), /No account needed/);
    assert.equal(await page.locator(MAIL + ' .gz-bars').count(), 0, 'no results before voting');
    const tabs = await page.$$eval(MAIL + ' .mail-list button', b => b.map(x => x.textContent.trim()));
    assert.match(tabs[0], /Letter to the Editor/); assert.deepEqual(tabs.slice(1, 5), ['📰 #5', '#4', '#3', '#2']);
    await page.click(MAIL + ' .mail-list button[data-v="gz4"]');
    assert.match(await page.textContent(MAIL + ' .gz-top'), /Issue #4/);
    await page.click(MAIL + ' .mail-list button[data-v="gz"]');
    await page.waitForSelector(MAIL + ' .gz-vote');
    await page.evaluate(s => { document.querySelector(s + ' .gz-pollsec').scrollIntoView(); }, MAIL);
    await shot(page, '02-poll-visitor');
    // the bot check host is blocked in this test, so the guest log-on fails: a clear message, no fake success
    await page.click(MAIL + ' .gz-vote[data-c="no"]');
    await page.waitForFunction(s => /bot check did not pass|did not go through/.test(document.querySelector(s + ' .gz-poll').textContent), MAIL);
    assert.equal((await db.query('select count(*)::int n from games.poll_votes')).rows[0].n, 1);
    assert.deepEqual(errors, []); await ctx.close();
  });
  await step('Discord fren votes Yes: one write, bars from the server, vote is final', async () => {
    const { page, errors, ctx } = await newPage(1);
    await page.click('.tray-mail'); await page.waitForSelector(MAIL + ' .gazette');
    await page.evaluate(s => document.querySelector(s + ' .gz-top').scrollIntoView(), MAIL);
    await shot(page, '03-gazette-top');
    await page.waitForSelector(MAIL + ' .gz-vote');
    assert.deepEqual(await page.$$eval(MAIL + ' .gz-vote', b => b.map(x => x.textContent)), ['Yes', 'No']);
    assert.match(await page.textContent(MAIL + ' .gz-poll-when'), /Closes in (1d 23h|2d 0h|47h)/);
    await page.evaluate(s => document.querySelector(s + ' .gz-market').scrollIntoView(), MAIL);
    await shot(page, '04-gazette-market');
    await page.evaluate(s => document.querySelector(s + ' .gz-pollsec').scrollIntoView(), MAIL);
    await shot(page, '05-poll-before');
    const before = calls.filter(c => c === 'gry_poll_vote').length;
    await page.click(MAIL + ' .gz-vote[data-c="yes"]');
    await page.waitForSelector(MAIL + ' .gz-bars');
    assert.equal(calls.filter(c => c === 'gry_poll_vote').length, before + 1);
    assert.deepEqual(await page.$$eval(MAIL + ' .gz-bars li', l => l.map(x => x.textContent)), ['Yes ✓100% (2)', 'No0% (0)']);
    assert.match(await page.textContent(MAIL + ' .gz-poll-when'), /2 votes/);
    assert.equal((await db.query("select choice from games.poll_votes where user_id = $1", [uid(1)])).rows[0].choice, 'yes');
    await shot(page, '06-poll-after');
    assert.deepEqual(errors, []); await ctx.close();
  });
  await step('Guests vote too: one per network', async () => {
    const { page, errors, ctx } = await newPage(3, false, true);
    await page.click('.tray-mail'); await page.waitForSelector(MAIL + ' .gz-vote');
    assert.doesNotMatch(await page.textContent(MAIL + ' .gz-poll'), /No account needed/);
    await page.click(MAIL + ' .gz-vote[data-c="no"]');
    await page.waitForSelector(MAIL + ' .gz-bars');
    assert.deepEqual(await page.$$eval(MAIL + ' .gz-bars li', l => l.map(x => x.textContent)), ['Yes67% (2)', 'No ✓33% (1)']);
    assert.equal((await db.query('select verified from games.poll_votes where user_id = $1', [uid(3)])).rows[0].verified, false);
    await ctx.close();
    // a second guest account from the same network
    await db.query("update auth.users set id = id where id = $1", [uid(4)]);
    const g2 = await newPage(4, false, true);
    // same network as guest 3: the fake PostgREST derives the address from the last digit, so make it match
    await db.query("update games.poll_votes set ip_hash = encode(sha256(convert_to('e2e-salt|ip|7.7.7.4', 'UTF8')), 'hex') where user_id = $1", [uid(3)]);
    await g2.page.click('.tray-mail'); await g2.page.waitForSelector(MAIL + ' .gz-vote');
    await g2.page.click(MAIL + ' .gz-vote[data-c="yes"]');
    await g2.page.waitForFunction(s => /guest on your network has already voted/.test(document.querySelector(s + ' .gz-poll').textContent), MAIL);
    assert.deepEqual(errors.concat(g2.errors), []); await g2.ctx.close();
  });
  await step('Reopened later: results stay, no vote buttons', async () => {
    const { page, errors, ctx } = await newPage(1);
    await page.click('.tray-mail'); await page.waitForSelector(MAIL + ' .gz-bars');
    assert.equal(await page.locator(MAIL + ' .gz-vote').count(), 0);
    assert.deepEqual(errors, []); await ctx.close();
  });
  await step('Closed poll: everyone sees the results', async () => {
    await db.query("update games.polls set opens_at = now() - interval '3 days', closes_at = now() - interval '1 minute'");
    const { page, errors, ctx } = await newPage(null);
    await page.click('.tray-mail'); await page.waitForSelector(MAIL + ' .gz-bars');
    assert.match(await page.textContent(MAIL + ' .gz-poll-when'), /Closed · 3 votes/);
    assert.deepEqual(errors, []); await ctx.close();
    await db.query("update games.polls set opens_at = now(), closes_at = now() + interval '2 days'");
  });
  await step('Before the SQL is run: "The ballot box opens soon", nothing breaks', async () => {
    polls = false;
    const { page, errors, ctx } = await newPage(1);
    await page.click('.tray-mail'); await page.waitForSelector(MAIL + ' .gz-poll-msg');
    await page.waitForFunction(s => /opens soon/.test(document.querySelector(s + ' .gz-poll').textContent), MAIL);
    assert.deepEqual(errors, []); await ctx.close(); polls = true;
  });
  await step('Phone: Gazette and poll fit', async () => {
    const { page, errors, ctx } = await newPage(2, true);
    await page.tap('.tray-mail'); await page.waitForSelector(MAIL + ' .gz-bars, ' + MAIL + ' .gz-vote');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll');
    await page.evaluate(s => document.querySelector(s + ' .gz-pollsec').scrollIntoView(), MAIL);
    await shot(page, '07-phone-poll');
    assert.deepEqual(errors, []); await ctx.close();
  });
} finally {
  await browser.close(); await db.end(); await ep.stop(); await rm(dir, { recursive: true, force: true });
}
console.log(failures ? '\n' + failures + ' step(s) failed' : '\nAll browser steps passed');
process.exitCode = failures ? 1 : 0;
