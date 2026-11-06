// Browser integration test for the Fren Avatar Maker inside the real PondOS pages (not run in CI).
// - Serves docs/ from disk at https://pondos.test (request interception, no web server).
// - Answers the Passport RPCs with the REAL SQL functions (schema.sql identity check, update_yeet.sql,
//   update_fren_passport.sql, update_fren_avatar.sql) in a throwaway local PostgreSQL, as the signed-in
//   user, the way PostgREST does. Every other external request is blocked. Never touches Supabase.
// Needs a folder with `npm i playwright embedded-postgres pg` and a Chromium build:
//   FREN_TOOLS=/abs/tools FREN_CHROME=/abs/chrome [FREN_SHOTS=/abs/out] node scripts/fren_avatar_e2e.mjs
// PostgreSQL refuses to run as root; in a root sandbox wrap it: unshare --user --map-user=1000 --map-group=1000 node …
import { readFile, mkdir, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import path from 'node:path';

const TOOLS = process.env.FREN_TOOLS;
if (!TOOLS || !process.env.FREN_CHROME) { console.error('Set FREN_TOOLS and FREN_CHROME (see the header).'); process.exit(2); }
const need = createRequire(path.join(TOOLS, 'package.json'));
const pw = await import(need.resolve('playwright'));
const chromium = pw.chromium || pw.default.chromium;
const ep0 = await import(need.resolve('embedded-postgres'));
const EmbeddedPostgres = ep0.default.default || ep0.default;
const pg = (await import(need.resolve('pg'))).default;
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = REPO + '/docs';
const SHOTS = process.env.FREN_SHOTS || path.join(TOOLS, 'shots');
const CHROME = process.env.FREN_CHROME;
const SB = 'https://azbwciqfbsdpwubznncg.supabase.co';
const ORIGIN = 'https://pondos.test';
const ALLOWED_RPC = new Set(['gry_passport_state', 'gry_passport_avatar_save', 'gry_passport_discover']);
const uid = i => '00000000-0000-4000-8000-' + String(i).padStart(12, '0');
const log = (...a) => console.log('•', ...a);

// ---------- database ----------
const dir = path.join(TOOLS, 'pgdata-e2e');
await rm(dir, { recursive: true, force: true });
const ep = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'pw', port: 54340, persistent: false, onLog: () => {}, onError: () => {} });
await ep.initialise(); await ep.start();
const db = new pg.Client({ host: 'localhost', port: 54340, user: 'postgres', password: 'pw', database: 'postgres' });
await db.connect();
const rd = p => readFile(REPO + '/' + p, 'utf8');
await db.query(`
create role anon nologin; create role authenticated nologin;
create schema auth; create schema games;
create table auth.users(id uuid primary key, created_at timestamptz not null default now());
create table auth.identities(user_id uuid references auth.users(id) on delete cascade, provider text not null, provider_id text not null, identity_data jsonb not null default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated;`);
await db.query((await rd('games/supabase/schema.sql')).match(/create or replace function games\.discord_identity\(u uuid\)[\s\S]*?\n\$\$;/)[0]);
for (const f of ['update_yeet.sql', 'update_fren_passport.sql', 'update_fren_avatar.sql']) await db.query(await rd('games/supabase/' + f));
await db.query("insert into auth.users(id, created_at) values ($1, '2026-10-12T18:00:00Z'), ($2, '2026-10-20T09:30:00Z')", [uid(1), uid(2)]);
await db.query("insert into auth.identities values ($1, 'discord', '111', $2), ($3, 'discord', '222', $4)",
  [uid(1), JSON.stringify({ custom_claims: { global_name: 'PondTester' } }), uid(2), JSON.stringify({ full_name: 'SecondFren' })]);
await db.query("insert into games.yeet_records(user_id, nick, best, duration_ms, achieved_at) values ($1, 'PondTester', 18420, 30000, '2026-11-02T12:00:00Z')", [uid(1)]);
await db.query("insert into games.passport_secrets(user_id, secret_id) values ($1, 'notes_reader')", [uid(1)]);

// ---------- fake PostgREST in front of the real functions ----------
const calls = [];
let failMode = null; // 'network' | 'missing'
async function rpcHandler(route) {
  const req = route.request(), url = new URL(req.url());
  const fn = url.pathname.replace('/rest/v1/rpc/', '');
  const body = req.postData() ? JSON.parse(req.postData()) : {};
  const auth = req.headers()['authorization'] || '';
  let sub = '';
  try { sub = JSON.parse(Buffer.from(auth.split('.')[1], 'base64url').toString()).sub || ''; } catch (e) {}
  calls.push({ fn, body, sub, t: Date.now() });
  const json = (status, obj) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(obj) });
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
  if (!ALLOWED_RPC.has(fn)) return json(404, { code: 'PGRST202', message: 'Could not find the function public.' + fn + ' (test stub)' });
  if (failMode === 'network') { failMode = null; return route.abort('internetdisconnected'); }
  if (failMode === 'missing') return json(404, { code: 'PGRST202', message: 'Could not find the function public.' + fn });
  const names = Object.keys(body);
  if (!names.every(n => /^p_[a-z]+$/.test(n))) return json(400, { message: 'bad args' });
  const sql = 'select public.' + fn + '(' + names.map((n, i) => n + ' => $' + (i + 1)).join(', ') + ') as v';
  try {
    await db.query('begin');
    await db.query('set local role ' + (sub ? 'authenticated' : 'anon'));
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [sub]);
    const r = await db.query(sql, names.map(n => body[n]));
    await db.query('commit');
    return json(200, r.rows[0].v);
  } catch (e) {
    await db.query('rollback');
    return json(e.code === '42501' ? 403 : 400, { code: e.code, message: e.message });
  }
}
const passportCalls = () => calls.filter(c => ALLOWED_RPC.has(c.fn));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.ico': 'image/x-icon', '.txt': 'text/plain', '.xml': 'application/xml', '.woff2': 'font/woff2' };
async function staticHandler(route) {
  const url = new URL(route.request().url());
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(DOCS, path.normalize(p));
  if (!file.startsWith(DOCS)) return route.fulfill({ status: 403 });
  try { return route.fulfill({ status: 200, contentType: TYPES[path.extname(file)] || 'application/octet-stream', body: await readFile(file) }); }
  catch (e) { return route.fulfill({ status: 404, body: 'not found' }); }
}

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
await rm(SHOTS, { recursive: true, force: true }); await mkdir(SHOTS, { recursive: true });
const token = i => 'x.' + Buffer.from(JSON.stringify({ sub: uid(i), role: 'authenticated' })).toString('base64url') + '.sig';
const session = (i, name) => JSON.stringify({ access_token: token(i), expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: uid(i), is_anonymous: false, identities: [{ provider: 'discord', identity_data: { full_name: name } }], user_metadata: { full_name: name } } });

async function newPage({ user = null, name = '', theme = 'dark', mobile = false, reduced = false } = {}) {
  const ctx = await browser.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: reduced ? 'reduce' : 'no-preference' }
    : { viewport: { width: 1280, height: 800 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await ctx.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith(ORIGIN + '/')) return staticHandler(route);
    if (u.startsWith(SB + '/rest/v1/rpc/')) return rpcHandler(route);
    return route.abort('blockedbyclient');
  });
  await ctx.addInitScript(({ s, theme }) => {
    try {
      sessionStorage.setItem('pondos-boot', '1'); sessionStorage.setItem('pondos-notice', '1');
      localStorage.setItem('phw-theme', theme);
      localStorage.setItem('pondos-mail-read', '999');
      if (s) localStorage.setItem('sb-azbwciqfbsdpwubznncg-auth-token', s); else localStorage.removeItem('sb-azbwciqfbsdpwubznncg-auth-token');
    } catch (e) {}
  }, { s: user ? session(user, name) : null, theme });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_BLOCKED_BY_CLIENT|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(ORIGIN + '/meme/', { waitUntil: 'load' });
  await page.waitForSelector('.start');
  return { ctx, page, errors };
}
const shot = async (page, name, opts = {}) => { await page.waitForTimeout(150); await page.screenshot({ path: SHOTS + '/' + name + '.jpg', type: 'jpeg', quality: 84, ...opts }); log('screenshot', name); };
const closeBalloons = page => page.evaluate(() => document.querySelectorAll('.balloon').forEach(b => b.remove()));
async function openPassport(page) {
  await page.click('.start');
  await page.getByRole('button', { name: /Fren Passport/ }).click();
  await page.waitForSelector('.app-win[aria-label="Fren Passport - Properties"] .pp-book, .app-win[aria-label="Fren Passport - Properties"] .passport-note');
}
const maker = '.app-win[aria-label="Create Your Fren - Avatar Maker"]';
const pick = (page, slot, id) => page.click(`${maker} input[name="fa-${slot}"][value="${id}"] + .fa-thumb`);
const lookOnPage = page => page.evaluate(sel => Object.fromEntries([...document.querySelectorAll(sel + ' input:checked')].map(i => [i.name.slice(3), i.value])), maker);
const previewSrcs = page => page.evaluate(sel => [...document.querySelectorAll(sel + ' .fa-frame img')].map(i => i.getAttribute('src')), maker);
const statusText = page => page.textContent(maker + ' .fa-state');
const dbRow = async i => (await db.query('select bg, clothing, mouth, eyes, hat, accessory from games.passport_avatars where user_id = $1', [uid(i)])).rows[0] || null;
const dbBadges = async i => (await db.query("select count(*)::int n from games.passport_badges where user_id = $1 and badge_id = 'first_avatar'", [uid(i)])).rows[0].n;

let failures = 0;
async function step(name, fn) {
  try { await fn(); log('PASS', name); } catch (e) { failures++; console.log('✗ FAIL', name, '\n ', e.message.slice(0, 1200)); }
}

try {
  // ===== desktop, dark theme, Discord user 1 =====
  const { page, errors, ctx } = await newPage({ user: 1, name: 'PondTester' });
  await step('Passport opens with one read, logo and "Create your Fren"', async () => {
    await openPassport(page);
    const P = '.app-win[aria-label="Fren Passport - Properties"]';
    assert.equal(passportCalls().length, 1); assert.equal(passportCalls()[0].fn, 'gry_passport_state');
    assert.equal(await page.textContent(P + ' .pp-make'), 'Create your Fren');
    assert.equal(await page.getAttribute(P + ' .pp-photo > img', 'src'), 'img/pep-logo.webp');
    assert.match(await page.textContent(P + ' .pp-idrow.is-nick dd'), /PondTester/);
    const fresh = await page.locator(P + ' .pp-stamp', { hasText: 'Fresh Fren' }).textContent();
    assert.match(fresh, /Locked/);
    assert.match(await page.textContent(P + ' .pp-mythic-name'), /BALI/);
    await shot(page, '01-passport-no-avatar-dark');
  });
  await step('Maker opens from the Passport with defaults, no extra request', async () => {
    await page.click('.pp-make');
    await page.waitForSelector(maker + ' .fa');
    assert.equal(passportCalls().length, 1);
    assert.deepEqual(await lookOnPage(page), { bg: 'bg_none', clothing: 'clothing_blue', mouth: 'mouth_smile', eyes: 'eyes_classic', hat: 'hat_none', accessory: 'accessory_none' });
    // non-unlock options offered per slot: bg 3, clothing 5, mouth 6, eyes 6, hat 6, accessory 3 = 29
    assert.equal(await page.locator(maker + ' .fa-opt').count(), 31); // 4 bg + 5 clothing + 6 mouth + 6 eyes + 7 hats + 3 accessories
    assert.equal(await statusText(page), 'Not saved yet.');
    const w = await page.evaluate(sel => document.querySelector(sel).getBoundingClientRect().width, maker);
    assert.ok(w >= 680 && w <= 740, 'window width ' + w);
    const thumbs = await page.$$eval(maker + ' .fa-thumb', t => t.map(x => [Math.round(x.getBoundingClientRect().width), Math.round(x.getBoundingClientRect().height)]));
    assert.ok(thumbs.every(([a, b]) => a === 52 && b === 52), 'thumbnail sizes ' + JSON.stringify(thumbs));
    await shot(page, '02-maker-default-dark');
  });
  await step('Picking parts and Randomize change only the preview (no API traffic)', async () => {
    const before = passportCalls().length;
    await pick(page, 'bg', 'bg_pond'); await pick(page, 'clothing', 'clothing_purple_hoodie');
    await pick(page, 'mouth', 'mouth_grin'); await pick(page, 'eyes', 'eyes_shades');
    await pick(page, 'hat', 'hat_crown'); await pick(page, 'accessory', 'accessory_chain');
    assert.deepEqual((await previewSrcs(page)).map(s => s.split('/').pop()),
      ['bg_pond.webp', 'base_frog.webp', 'clothing_purple_hoodie.webp', 'mouth_grin.webp', 'eyes_shades.webp', 'hat_crown.webp', 'accessory_chain.webp']);
    assert.equal(await statusText(page), 'Unsaved changes');
    for (let i = 0; i < 12; i++) await page.click(maker + ' .fa-random');
    assert.equal(passportCalls().length, before, 'no RPC while choosing');
    await pick(page, 'bg', 'bg_pond'); await pick(page, 'clothing', 'clothing_purple_hoodie');
    await pick(page, 'mouth', 'mouth_grin'); await pick(page, 'eyes', 'eyes_shades');
    await pick(page, 'hat', 'hat_crown'); await pick(page, 'accessory', 'accessory_chain');
    assert.equal(await dbRow(1), null);
    await shot(page, '03-maker-unsaved-dark');
  });
  await step('Keyboard: arrows move within a part group, Tab moves on', async () => {
    await page.focus(`${maker} input[name="fa-hat"]:checked`);
    await page.keyboard.press('ArrowLeft');
    assert.equal((await lookOnPage(page)).hat, 'hat_bucket');
    await page.keyboard.press('ArrowRight');
    assert.equal((await lookOnPage(page)).hat, 'hat_crown');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.name), 'fa-accessory');
    assert.equal(await page.evaluate(() => getComputedStyle(document.activeElement.closest('.fa-opt')).outlineStyle), 'dotted');
  });
  await step('Save Look: one write, server confirms, Fresh Fren once, balloon', async () => {
    const before = passportCalls().length;
    await page.click(maker + ' .fa-save');
    await page.waitForFunction(sel => /Saved in your Fren Passport/.test(document.querySelector(sel + ' .fa-state').textContent), maker);
    const after = passportCalls().slice(before);
    assert.deepEqual(after.map(c => c.fn), ['gry_passport_avatar_save']);
    assert.deepEqual(after[0].body, { p_bg: 'bg_pond', p_clothing: 'clothing_purple_hoodie', p_mouth: 'mouth_grin', p_eyes: 'eyes_shades', p_hat: 'hat_crown', p_accessory: 'accessory_chain' });
    assert.deepEqual(await dbRow(1), { bg: 'bg_pond', clothing: 'clothing_purple_hoodie', mouth: 'mouth_grin', eyes: 'eyes_shades', hat: 'hat_crown', accessory: 'accessory_chain' });
    assert.equal(await dbBadges(1), 1);
    await page.waitForSelector('.balloon:has-text("Fresh Fren")');
    assert.equal(await page.isDisabled(maker + ' .fa-save'), true);
    await shot(page, '04-saved-fresh-fren-dark');
  });
  await step('Use in Passport: portrait and achievement refresh without a new read', async () => {
    const before = passportCalls().length;
    await closeBalloons(page);
    await page.click(maker + ' .fa-use');
    await page.waitForSelector(maker, { state: 'detached' });
    const P = '.app-win[aria-label="Fren Passport - Properties"]';
    assert.equal(passportCalls().length, before, 'no read after the save response');
    assert.deepEqual(await page.evaluate(sel => [...document.querySelectorAll(sel + ' .pp-photo .fa-stack img')].map(i => i.getAttribute('src').split('/').pop()), P),
      ['bg_pond.webp', 'base_frog.webp', 'clothing_purple_hoodie.webp', 'mouth_grin.webp', 'eyes_shades.webp', 'hat_crown.webp', 'accessory_chain.webp']);
    assert.equal(await page.textContent(P + ' .pp-make'), 'Edit your Fren');
    const fresh = await page.locator(P + ' .pp-stamp', { hasText: 'Fresh Fren' }).textContent();
    assert.doesNotMatch(fresh, /Locked/);
    await shot(page, '05-passport-with-avatar-dark');
  });
  await step('Unsaved changes ask Save / Discard / Cancel; too-fast save is an error, not success', async () => {
    await page.click('.pp-make');
    await page.waitForSelector(maker + ' .fa');
    assert.equal(await statusText(page), 'Saved in your Fren Passport.');
    await pick(page, 'eyes', 'eyes_3d');
    await page.click(maker + ' .fa-use');
    await page.waitForSelector('dialog.os-dlg[open]');
    assert.deepEqual(await page.$$eval('dialog.os-dlg .dlg-btns .btn', b => b.map(x => x.textContent)), ['Save', 'Discard', 'Cancel']);
    await shot(page, '06-unsaved-dialog-dark');
    await page.click('dialog.os-dlg .btn:text("Cancel")');
    const before = passportCalls().length;
    await page.click(maker + ' .fa-save');
    await page.waitForFunction(sel => /too fast/i.test(document.querySelector(sel + ' .fa-state').textContent), maker);
    assert.equal(passportCalls().length, before + 1);
    assert.equal((await dbRow(1)).eyes, 'eyes_shades', 'nothing changed on the server');
    assert.equal(await page.locator('.balloon').count(), 0);
    assert.equal(await page.isDisabled(maker + ' .fa-save'), false);
    await shot(page, '07-too-fast-error-dark');
  });
  await step('Network failure never looks like success', async () => {
    await page.waitForTimeout(3200);
    failMode = 'network';
    await page.click(maker + ' .fa-save');
    await page.waitForFunction(sel => /Could not save/.test(document.querySelector(sel + ' .fa-state').textContent), maker);
    assert.equal((await dbRow(1)).eyes, 'eyes_shades');
  });
  await step('Second save after cooldown: saved, no second Fresh Fren', async () => {
    await page.click(maker + ' .fa-save');
    await page.waitForFunction(sel => /Saved in your Fren Passport/.test(document.querySelector(sel + ' .fa-state').textContent), maker);
    assert.equal((await dbRow(1)).eyes, 'eyes_3d');
    assert.equal(await dbBadges(1), 1);
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.balloon').count(), 0, 'no achievement balloon on later saves');
  });
  await step('Discard returns to the saved look', async () => {
    await pick(page, 'hat', 'hat_beanie');
    await page.click(maker + ' .fa-use');
    await page.click('dialog.os-dlg .btn:text("Discard")');
    await page.waitForSelector(maker, { state: 'detached' });
    assert.equal((await dbRow(1)).hat, 'hat_crown');
    const P = '.app-win[aria-label="Fren Passport - Properties"]';
    assert.ok((await page.getAttribute(P + ' .pp-photo .fa-stack img[data-layer="hat"]', 'src')).endsWith('hat_crown.webp'));
  });
  await step('Missing migration: clear message, nothing claimed', async () => {
    await page.click('.pp-make'); await page.waitForSelector(maker + ' .fa');
    await page.waitForTimeout(3200);
    await pick(page, 'mouth', 'mouth_tongue');
    failMode = 'missing';
    await page.click(maker + ' .fa-save');
    await page.waitForFunction(sel => /waiting for its database update/.test(document.querySelector(sel + ' .fa-state').textContent), maker);
    failMode = null;
    assert.equal((await dbRow(1)).mouth, 'mouth_grin');
    await page.click(maker + ' .w-x');
  });
  assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
  await ctx.close();

  // ===== second device, light theme: same look and the earned achievement come back =====
  await step('Second device (light theme) shows the same saved look and Fresh Fren', async () => {
    const { page, errors, ctx } = await newPage({ user: 1, name: 'PondTester', theme: 'light' });
    await openPassport(page);
    const P = '.app-win[aria-label="Fren Passport - Properties"]';
    assert.deepEqual(await page.evaluate(sel => [...document.querySelectorAll(sel + ' .pp-photo .fa-stack img')].map(i => i.getAttribute('src').split('/').pop()), P),
      ['bg_pond.webp', 'base_frog.webp', 'clothing_purple_hoodie.webp', 'mouth_grin.webp', 'eyes_3d.webp', 'hat_crown.webp', 'accessory_chain.webp']);
    assert.doesNotMatch(await page.locator(P + ' .pp-stamp', { hasText: 'Fresh Fren' }).textContent(), /Locked/);
    await shot(page, '08-passport-second-device-light');
    await page.click('.pp-make'); await page.waitForSelector(maker + ' .fa');
    assert.deepEqual(await lookOnPage(page), { bg: 'bg_pond', clothing: 'clothing_purple_hoodie', mouth: 'mouth_grin', eyes: 'eyes_3d', hat: 'hat_crown', accessory: 'accessory_chain' });
    await shot(page, '09-maker-light');
    assert.deepEqual(errors, []);
    await ctx.close();
  });

  // ===== another Discord user is isolated =====
  await step('Second user sees their own empty Passport', async () => {
    const { page, ctx } = await newPage({ user: 2, name: 'SecondFren' });
    await openPassport(page);
    assert.equal(await page.textContent('.pp-make'), 'Create your Fren');
    assert.match(await page.locator('.pp-stamp', { hasText: 'Fresh Fren' }).textContent(), /Locked/);
    await ctx.close();
  });

  // ===== guest: preview only, no Supabase calls =====
  await step('Guest: try every look, "Log on to save", no Passport requests', async () => {
    const before = passportCalls().length;
    const { page, errors, ctx } = await newPage({ user: null });
    await openPassport(page);
    await page.click('.passport-note + .app-row .app-btn:text("Try the Avatar Maker")');
    await page.waitForSelector(maker + ' .fa');
    assert.equal(await page.textContent(maker + ' .fa-save'), 'Log on to save');
    assert.equal(await page.isDisabled(maker + ' .fa-use'), true);
    assert.equal(await statusText(page), 'Preview only. Log on with Discord to save.');
    await pick(page, 'hat', 'hat_pep_cap'); await page.click(maker + ' .fa-random');
    assert.equal(passportCalls().length, before);
    await shot(page, '10-guest-maker-dark');
    await page.click(maker + ' .fa-save');
    await page.waitForSelector('.app-win[aria-label="Log On to the Pond"]');
    assert.equal(passportCalls().length, before);
    assert.deepEqual(errors, []);
    await ctx.close();
  });

  // ===== phone portrait =====
  await step('Phone: stacked layout, no horizontal scroll, 44px targets', async () => {
    const { page, errors, ctx } = await newPage({ user: 1, name: 'PondTester', mobile: true, reduced: true });
    await openPassport(page);
    await shot(page, '11-phone-passport');
    await page.tap('.pp-make'); await page.waitForSelector(maker + ' .fa');
    const m = await page.evaluate(sel => {
      const w = document.querySelector(sel), side = w.querySelector('.fa-side').getBoundingClientRect(), parts = w.querySelector('.fa-parts').getBoundingClientRect();
      const opts = [...w.querySelectorAll('.fa-opt')].map(o => o.getBoundingClientRect());
      const btns = [...w.querySelectorAll('.fa-actions .app-btn')].map(o => o.getBoundingClientRect());
      return { docW: document.documentElement.scrollWidth, vw: innerWidth, winScroll: w.scrollWidth - w.clientWidth,
        stacked: parts.top >= side.bottom - 1, minOpt: Math.min(...opts.map(r => Math.min(r.width, r.height))),
        minBtn: Math.min(...btns.map(r => r.height)), right: Math.max(...opts.map(r => r.right)) };
    }, maker);
    assert.ok(m.docW <= m.vw, 'page scrolls sideways ' + JSON.stringify(m));
    assert.ok(m.winScroll <= 0, 'window scrolls sideways ' + JSON.stringify(m));
    assert.ok(m.stacked, 'preview above choices'); assert.ok(m.minOpt >= 44, 'option size ' + m.minOpt); assert.ok(m.minBtn >= 44, 'button ' + m.minBtn);
    assert.ok(m.right <= m.vw, 'options inside the screen');
    await shot(page, '12-phone-maker-top');
    await page.tap(`${maker} input[name="fa-clothing"][value="clothing_orange_vest"] + .fa-thumb`);
    assert.equal((await lookOnPage(page)).clothing, 'clothing_orange_vest');
    await page.evaluate(sel => { const w = document.querySelector(sel); w.scrollTop = w.scrollHeight; }, maker);
    await shot(page, '13-phone-maker-bottom');
    await page.setViewportSize({ width: 320, height: 640 });
    await page.waitForTimeout(200);
    const s = await page.evaluate(sel => {
      const w = document.querySelector(sel), opts = [...w.querySelectorAll('.fa-opt')].map(o => o.getBoundingClientRect());
      return { docW: document.documentElement.scrollWidth, vw: innerWidth, winScroll: w.scrollWidth - w.clientWidth, minOpt: Math.min(...opts.map(r => Math.min(r.width, r.height))) };
    }, maker);
    assert.ok(s.docW <= s.vw && s.winScroll <= 0 && s.minOpt >= 44, '320px phone ' + JSON.stringify(s));
    assert.deepEqual(errors, []);
    await ctx.close();
  });

  // ===== PEP-TV ad =====
  await step('PEP-TV ad create_your_fren.mpg plays and its button opens the maker', async () => {
    const { page, errors, ctx } = await newPage({ user: 1, name: 'PondTester' });
    await page.click('.start'); await page.getByRole('button', { name: /Find/ }).click();
    await page.fill('.find-in', 'create_your_fren'); await page.press('.find-in', 'Enter');
    const AD = '.app-win[aria-label="create_your_fren.mpg - Pond Media Player"]';
    await page.waitForSelector(AD);
    await page.click(AD + ' .ptv-play');
    for (let i = 1; i <= 4; i++) {
      await page.waitForTimeout(450);
      await shot(page, '14-ad-scene-' + i, { clip: await page.locator(AD).boundingBox() });
      if (i < 4) await page.click(AD + ' .ptv-next');
    }
    await page.click(AD + ' .ad-frenbtn');
    await page.waitForSelector(maker + ' .fa');
    assert.deepEqual(errors, []);
    await ctx.close();
  });
  await step('PEP-TV ad fren_passport.mpg plays and its button opens the Passport booklet', async () => {
    const { page, errors, ctx } = await newPage({ user: 1, name: 'PondTester' });
    await page.click('.start'); await page.getByRole('button', { name: /Find/ }).click();
    await page.fill('.find-in', 'fren_passport'); await page.press('.find-in', 'Enter');
    const AD = '.app-win[aria-label="fren_passport.mpg - Pond Media Player"]';
    await page.waitForSelector(AD);
    await page.click(AD + ' .ptv-play');
    for (let i = 1; i <= 4; i++) {
      await page.waitForTimeout(450);
      await shot(page, '15-pass-ad-scene-' + i, { clip: await page.locator(AD).boundingBox() });
      if (i < 4) await page.click(AD + ' .ptv-next');
    }
    await page.click(AD + ' .ad-passbtn');
    await page.waitForSelector('.app-win[aria-label="Fren Passport - Properties"] .pp-page-art');
    assert.deepEqual(errors, []);
    await ctx.close();
  });
} finally {
  await browser.close();
  await db.end();
  await ep.stop();
  await rm(dir, { recursive: true, force: true });
}
console.log(failures ? `\n${failures} step(s) failed` : '\nAll browser steps passed');
console.log('Passport RPC calls:', passportCalls().map(c => c.fn).join(', '));
process.exitCode = failures ? 1 : 0;
