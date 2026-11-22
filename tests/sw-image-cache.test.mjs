// docs/meme/sw.js picture cache (2026-11-22): pictures only, versioned files from the cache, unversioned ones
// refreshed after 6 h, pages/scripts/data never intercepted. Runs the worker in a fake context.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function worker({ online = true } = {}) {
  const src = await readFile(new URL('../docs/meme/sw.js', import.meta.url), 'utf8');
  const on = {}, store = new Map(), fetched = [];
  let clock = 1_000_000;
  const cache = {
    match: async req => store.get(req.url),
    put: async (req, res) => { store.set(req.url, res); },
    keys: async () => [...store.keys()].map(url => ({ url })),
    delete: async k => store.delete(k.url),
  };
  const self = {
    location: new URL('https://pepecoinhub.com/meme/sw.js'),
    registration: { getNotifications: async () => [] }, navigator: {},
    clients: { claim: async () => {} },
    caches: { open: async () => cache, keys: async () => ['pondos-img-v0', 'pondos-img-v1', 'other'], delete: async () => true },
    addEventListener: (t, f) => { on[t] = f; }, skipWaiting() {},
  };
  const fetch = async req => {
    fetched.push(req.url);
    if (!online) throw new TypeError('Failed to fetch');
    return new Response('img:' + req.url, { status: 200, headers: { 'content-type': 'image/webp' } });
  };
  // Response.type is 'default' in node; the worker only stores 'basic' (same-origin) answers
  const RealResponse = Response;
  class R extends RealResponse { get type() { return 'basic'; } clone() { const c = super.clone(); Object.defineProperty(c, 'type', { value: 'basic' }); return c; } }
  const fakeDate = { now: () => clock };
  vm.runInNewContext(src, { self, URL, Promise, String, Math, Number, Headers, Response: R, fetch: req => fetch(req).then(r => new R(r.body, r)), Date: fakeDate });
  const request = (url, method = 'GET') => ({ url, method });
  const get = async url => {
    let p = null;
    on.fetch({ request: request(url), respondWith: x => { p = x; } });
    if (!p) return null;
    return (await p).text();
  };
  return { get, fetched, store, tick: ms => { clock += ms; }, setOnline: v => { online = v; } };
}

test('pages, scripts and data are never intercepted', async () => {
  const w = await worker();
  for (const u of ['https://pepecoinhub.com/meme/', 'https://pepecoinhub.com/meme/meme.js?v=1', 'https://pepecoinhub.com/data/price-live.json',
    'https://pepecoinhub.com/meme/sw.js', 'https://azbwciqfbsdpwubznncg.supabase.co/rest/v1/rpc/x', 'https://evil.example/meme/img/a.png',
    'https://pepecoinhub.com/meme/other/a.png'])
    assert.equal(await w.get(u), null, u);
  assert.equal(w.fetched.length, 0);
});

test('a versioned picture is fetched once, then served from the cache', async () => {
  const w = await worker();
  const u = 'https://pepecoinhub.com/games/img/pepegochi/taskbar/tb_egg.webp?v=3';
  assert.match(await w.get(u), /img:/);
  w.tick(30 * 864e5);
  assert.match(await w.get(u), /img:/);
  assert.equal(w.fetched.length, 1);
});

test('an unversioned picture is reused for 6 h, then fetched again; offline falls back to the cache', async () => {
  const w = await worker();
  const u = 'https://pepecoinhub.com/meme/img/gif-045.webp';
  await w.get(u); w.tick(5 * 3600e3); await w.get(u);
  assert.equal(w.fetched.length, 1);
  w.tick(2 * 3600e3); await w.get(u);
  assert.equal(w.fetched.length, 2);
  w.tick(7 * 3600e3); w.setOnline(false);
  assert.match(await w.get(u), /img:/, 'offline: the stored copy');
});
