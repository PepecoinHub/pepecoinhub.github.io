// PondOS traffic & performance harness (2026-11-22). Runs the real PondOS desktop (docs/) in headless Chrome
// against a FAKE Supabase (no network, no production, no credentials) with a fast-forwarded clock, and counts
// what the browser would send: RPCs by function, Edge Function calls, response bytes, HTTP errors, page errors,
// CPU time (CDP TaskDuration) and JS heap.
//
//   PLAYWRIGHT_MODULE=/abs/node_modules/playwright-core CHROME=/usr/bin/google-chrome \
//     node scripts/perf/pondos-traffic.cjs <docs-root> <label> [scenario,...] > result.json
//
// The fake answers are shaped like the real ones closely enough for the clients to keep running; they are not a
// model of server behaviour. gry_pepegochi_life / gry_pepegochi_diary_save answer 404 PGRST202, like production on
// 22 Nov 2026. Realtime is either accepted (a minimal Phoenix server: joins and heartbeats) or refused ("lost").
'use strict';
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');

const ROOT = path.resolve(process.argv[2] || 'docs'), LABEL = process.argv[3] || 'run';
const ONLY = (process.argv[4] || '').split(',').filter(Boolean);
const SB = 'https://azbwciqfbsdpwubznncg.supabase.co';
const START = Date.parse('2026-11-23T10:00:00Z');
const USER = '00000000-0000-4000-8000-0000000000b1';
const MINUTES = Number(process.env.MINUTES || 60);

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: USER, role: 'authenticated', exp: 1999999999, aud: 'authenticated' }) + '.sig';
const user = { id: USER, aud: 'authenticated', role: 'authenticated', is_anonymous: false, email: 'byl@example.invalid',
  app_metadata: { provider: 'discord', providers: ['discord'] }, user_metadata: { full_name: 'Byl' },
  identities: [{ provider: 'discord', identity_data: { full_name: 'Byl', global_name: 'Byl' } }] };
// the stored sign-in expires 15 minutes into the run; a refresh answers with one more hour (fake clock), so the
// hourly token refresh of the games' Supabase client happens as in production
const session = { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(START / 1000) + 900, user };

const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
function serve() {
  return new Promise(res => {
    const s = http.createServer((req, out) => {
      const u = new URL(req.url, 'http://x');
      let f = path.resolve(ROOT, '.' + decodeURIComponent(u.pathname));
      if (f.endsWith(path.sep)) f += 'index.html';
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { out.statusCode = 404; return out.end(); }
      out.setHeader('Content-Type', mime[path.extname(f)] || 'application/octet-stream');
      out.end(fs.readFileSync(f));
    });
    s.listen(0, '127.0.0.1', () => res(s));
  });
}

function makeFake(state) {
  const day = () => new Date(state.now()).toISOString().slice(0, 10);
  const pet = () => ({ server_now: new Date(state.now()).toISOString(), pet: { life_id: '11111111-1111-4111-8111-111111111111', name: 'Fren', stage: 'adult', status: 'healthy',
    needs: { hunger: 82, hygiene: 80, mood: 85, energy: 78 }, adopted_at: new Date(START - 6 * 864e5).toISOString(), care_days: 6, good_days: 6, generation: 1,
    departure_saved: false, actions: [], history: [] }, history: [], summary: { former_frens: 0, longest_friendship_days: 0 } });
  const ans = {
    gry_pepegochi_state: pet, gry_pepegochi_action: () => ({ ...pet(), action_result: 'accepted' }),
    gry_pepegochi_room_state: () => ({ initialized: true, revision: 1, slots: [], inventory: [], placements: [] }),
    gry_quiz_today: () => ({ day: day(), question: 'Which algorithm does PEP use?', answers: ['Scrypt', 'SHA-256', 'X11'], answered: false }),
    gry_lobby_chat: () => ({ online: 4, messages: [], hidden: [], can_mod: false }),
    gry_lobby_who: () => ({ frens: [{ user_id: USER, nick: 'Byl', me: true }], guests: [], lurkers: 2 }),
    gry_my_mentions: () => ({ verified: true, nick: 'Byl', optout: false, items: [] }),
    gry_haze_groups: () => ({ now: new Date(state.now()).toISOString(), drops: [], members: [] }),
    gry_haze_groups_public: () => ({ now: new Date(state.now()).toISOString(), drops: [] }),
    gry_haze_chat: () => ({ linked_users: [], receipts: [] }),
    gry_map_notes: () => [], gry_wp_top: () => [], gry_reports_new: () => 0, gry_passport_state: () => ({ badges: [], avatars: [] }),
  };
  const missing = new Set(['gry_pepegochi_life', 'gry_pepegochi_diary_save']);
  return async route => {
    const req = route.request(), u = new URL(req.url());
    const rec = (k, status, body) => {
      state.calls[k] = (state.calls[k] || 0) + 1; state.bytes += body.length;
      if (status >= 400) state.errors[k + ' ' + status] = (state.errors[k + ' ' + status] || 0) + 1;
      return route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, body });
    };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    let m;
    if ((m = /^\/rest\/v1\/rpc\/(\w+)/.exec(u.pathname))) {
      const fn = m[1];
      if (missing.has(fn)) return rec('rpc:' + fn, 404, JSON.stringify({ code: 'PGRST202', message: 'Could not find the function public.' + fn + ' without parameters in the schema cache' }));
      const f = ans[fn];
      return rec('rpc:' + fn, 200, JSON.stringify(f ? f() : {}));
    }
    if ((m = /^\/functions\/v1\/([\w-]+)/.exec(u.pathname))) return rec('edge:' + m[1], 200, '{}');
    if (u.pathname.startsWith('/auth/v1/user')) return rec('auth:user', 200, JSON.stringify(user));
    if (u.pathname.startsWith('/auth/v1/token')) return rec('auth:token', 200, JSON.stringify({ ...session, expires_at: Math.floor(state.now() / 1000) + 3600 }));
    return rec('other:' + u.pathname, 404, '{}');
  };
}

// minimal Phoenix Realtime: accept joins and heartbeats (live), or refuse the socket (lost)
function realtime(state, live) {
  return ws => {
    state.calls['realtime:connect'] = (state.calls['realtime:connect'] || 0) + 1;
    if (!live) { ws.close({ code: 1011, reason: 'down' }); return; }
    ws.onMessage(raw => {
      let msg; try { msg = JSON.parse(String(raw)); } catch { return; }
      const arr = Array.isArray(msg);
      const [join_ref, ref, topic, event] = arr ? msg : [msg.join_ref, msg.ref, msg.topic, msg.event];
      state.calls['realtime:' + event] = (state.calls['realtime:' + event] || 0) + 1;
      if (['phx_join', 'heartbeat', 'access_token', 'phx_leave'].includes(event)) {
        const payload = { status: 'ok', response: event === 'phx_join' ? { postgres_changes: [] } : {} };
        ws.send(JSON.stringify(arr ? [join_ref, ref, topic, 'phx_reply', payload] : { join_ref, ref, topic, event: 'phx_reply', payload }));
      }
    });
  };
}

const SCENARIOS = {
  'desktop-idle': { gochi: false, steps: [] },
  'desktop-idle-2tabs': { gochi: false, tabs: 2, steps: [] },
  // an active player: comes back to the tab (focus + visibilitychange) every 6 minutes
  'gochi-no-room': { gochi: true, pulse: 6, steps: [] },
  'gochi-room-open': { gochi: true, pulse: 6, steps: ['room'] },
  'games-minimized': { gochi: false, steps: ['miner', 'minimize'] },
  'lan-live': { gochi: false, live: true, steps: ['lan'] },
  'lan-lost': { gochi: false, live: false, steps: ['lan'] },
  'lan-lost-minimized': { gochi: false, live: false, steps: ['lan', 'minimize'] },
};

// open apps the way a player does: the desktop's right-click menu (Pepe Miner), the Start menu (PEPEGOCHI.EXE,
// LAN Party); the minimize button of every open app window
async function clickText(page, re) {
  return page.evaluate(src => {
    const re = new RegExp(src, 'i');
    const el = [...document.querySelectorAll('.ctx button, .sm a, .sm button, [role=menuitem], a[role=button], .icons a, .tray button')]
      .find(x => re.test((x.textContent || '').trim()) && x.offsetParent !== null) ||
      [...document.querySelectorAll('.ctx button, .sm a, a[role=button], .icons a')].find(x => re.test((x.textContent || '').trim()));
    if (!el) return false; el.click(); return true;
  }, re.source);
}
async function openApp(page, step) {
  if (step === 'room') { await page.evaluate(() => document.querySelector('.start')?.click()); return clickText(page, /^PEPEGOCHI\.EXE/); }
  if (step === 'miner') { await page.evaluate(() => { const d = document.querySelector('main') || document.body; d.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 600, clientY: 300 })); }); return clickText(page, /^Pepe Miner$/); }
  if (step === 'lan') return page.evaluate(() => { const b = document.querySelector('.tray-lan'); if (!b) return false; b.click(); return true; });
  if (step === 'minimize') return page.evaluate(() => { document.querySelectorAll('.app-win:not(.is-min) .w-min').forEach(b => b.click()); return true; });
}

async function run(browser, base, name, sc) {
  const state = { calls: {}, errors: {}, bytes: 0, t: START, now() { return this.t; } };
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 }, serviceWorkers: 'block' });
  await ctx.clock.install({ time: START });
  await ctx.addInitScript(([s, gochi]) => {
    try {
      if (!localStorage.getItem('perf-seeded')) {
        localStorage.setItem('sb-azbwciqfbsdpwubznncg-auth-token', s);
        localStorage.setItem('pondos-booted', '1'); localStorage.setItem('perf-seeded', '1');
        if (gochi) localStorage.setItem('pondos-gochi-beta', '1');
      }
    } catch (e) {}
  }, [JSON.stringify(session), !!sc.gochi]);
  await ctx.route(u => !u.href.startsWith(base) && !u.href.startsWith(SB), r => { state.calls['blocked:' + new URL(r.request().url()).host] = (state.calls['blocked:' + new URL(r.request().url()).host] || 0) + 1; return r.abort(); });
  await ctx.route(SB + '/**', makeFake(state));
  await ctx.routeWebSocket(/supabase\.co\/realtime/, realtime(state, !!sc.live));
  const pages = [], pageErrors = [];
  for (let i = 0; i < (sc.tabs || 1); i++) {
    const p = await ctx.newPage(); p.on('pageerror', e => pageErrors.push(String(e.message).slice(0, 160)));
    await p.goto(base + '/meme/index.html', { waitUntil: 'load' }); pages.push(p);
  }
  const page = pages[0];
  const cdp = await ctx.newCDPSession(page); await cdp.send('Performance.enable');
  const metric = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
  for (let i = 0; i < 30; i++) { await page.clock.runFor(200); state.t += 200; await new Promise(r => setTimeout(r, 20)); }
  const opened = [];
  for (const s of sc.steps) { opened.push(s + ':' + await openApp(page, s)); for (let i = 0; i < 15; i++) { await page.clock.runFor(200); state.t += 200; await new Promise(r => setTimeout(r, 20)); } }
  // measurement window starts here
  for (const k of Object.keys(state.calls)) delete state.calls[k]; for (const k of Object.keys(state.errors)) delete state.errors[k]; state.bytes = 0;
  const m0 = await metric();
  const STEP = 2000;
  for (let ms = 0; ms < MINUTES * 60000; ms += STEP) {
    if (sc.pulse && ms > 0 && ms % (sc.pulse * 60000) === 0)
      await page.evaluate(() => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); });
    await page.clock.runFor(STEP); state.t += STEP; await new Promise(r => setTimeout(r, 8));
  }
  await new Promise(r => setTimeout(r, 300));
  const m1 = await metric();
  const rpc = Object.entries(state.calls).filter(([k]) => k.startsWith('rpc:')).reduce((a, [, v]) => a + v, 0);
  const edge = Object.entries(state.calls).filter(([k]) => k.startsWith('edge:')).reduce((a, [, v]) => a + v, 0);
  const out = { scenario: name, label: LABEL, minutes: MINUTES, opened, windows: await page.evaluate(() => [...document.querySelectorAll('.app-win')].map(w => (w.getAttribute('aria-label') && {textContent: w.getAttribute('aria-label')}?.textContent || '?').trim().slice(0, 30) + (w.classList.contains('is-min') ? ' (min)' : ''))), rpc_total: rpc, edge_total: edge, response_kb: +(state.bytes / 1024).toFixed(1),
    errors: state.errors, calls: state.calls, cpu_task_ms: Math.round((m1.TaskDuration - m0.TaskDuration) * 1000), script_ms: Math.round((m1.ScriptDuration - m0.ScriptDuration) * 1000),
    heap_mb: +(m1.JSHeapUsedSize / 1048576).toFixed(1), dom_nodes: m1.Nodes, page_errors: [...new Set(pageErrors)].slice(0, 6) };
  await ctx.close();
  return out;
}

// frames per second on a visible desktop (real clock, 5 s), with and without a minimized miner
async function fps(browser, base) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 }, serviceWorkers: 'block' });
  await ctx.addInitScript(s => { try { localStorage.setItem('sb-azbwciqfbsdpwubznncg-auth-token', s); localStorage.setItem('pondos-booted', '1'); } catch (e) {} }, JSON.stringify(session));
  await ctx.route(u => !u.href.startsWith(base) && !u.href.startsWith(SB), r => r.abort());
  const st = { calls: {}, errors: {}, bytes: 0, now: () => Date.now() };
  await ctx.route(SB + '/**', makeFake(st));
  await ctx.routeWebSocket(/supabase\.co\/realtime/, realtime(st, false));
  const page = await ctx.newPage(); await page.goto(base + '/meme/index.html'); await page.waitForTimeout(3000);
  const measure = () => page.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 5000) requestAnimationFrame(f); else res(Math.round(n / ((performance.now() - t0) / 1000))); }; requestAnimationFrame(f); }));
  const desk = await measure();
  await openApp(page, 'miner'); await page.waitForTimeout(2500); await openApp(page, 'minimize'); await page.waitForTimeout(1000);
  const cdp = await ctx.newCDPSession(page); await cdp.send('Performance.enable');
  const g = async () => (await cdp.send('Performance.getMetrics')).metrics.find(m => m.name === 'TaskDuration').value;
  const a = await g(); const withMiner = await measure(); const b = await g();
  await ctx.close();
  return { fps_desktop: desk, fps_with_minimized_miner: withMiner, cpu_ms_per_5s_minimized_miner: Math.round((b - a) * 1000) };
}

(async () => {
  const server = await serve(), base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME, args: ['--no-sandbox'] });
  const results = [];
  try {
    for (const [name, sc] of Object.entries(SCENARIOS)) {
      if (ONLY.length && !ONLY.includes(name)) continue;
      const r = await run(browser, base, name, sc); results.push(r);
      process.stderr.write(`${LABEL} ${name}: rpc ${r.rpc_total}, edge ${r.edge_total}, ${r.response_kb} KB, cpu ${r.cpu_task_ms} ms\n`);
    }
    if (!ONLY.length || ONLY.includes('fps')) results.push({ scenario: 'fps', label: LABEL, ...(await fps(browser, base)) });
  } finally { await browser.close(); server.close(); }
  console.log(JSON.stringify(results, null, 1));
})().catch(e => { console.error(e); process.exitCode = 1; });
