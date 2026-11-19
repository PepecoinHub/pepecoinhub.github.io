// docs/meme/sw.js (PondOS notifications service worker) in a small fake worker: node --test tests/push-sw.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function worker({ clients = [] } = {}) {
  const src = await readFile(new URL('../docs/meme/sw.js', import.meta.url), 'utf8');
  const on = {}, shown = [], badges = [], posted = [], opened = [];
  const reg = {
    showNotification: async (title, o) => { shown.push({ title, ...o, close() { shown.splice(shown.indexOf(this), 1); } }); },
    getNotifications: async () => shown.slice(),
  };
  const self = {
    location: new URL('https://pepecoinhub.com/meme/sw.js'),
    registration: reg,
    navigator: { setAppBadge: async (n) => badges.push(n), clearAppBadge: async () => badges.push(0) },
    clients: {
      claim: async () => {},
      matchAll: async () => clients.map(u => ({ url: u, postMessage: (m) => posted.push(m), focus: async () => {} })),
      openWindow: async (u) => opened.push(u),
    },
    addEventListener: (t, f) => { on[t] = f; },
    skipWaiting() {},
  };
  vm.runInNewContext(src, { self, URL, Promise, String, Math });
  const fire = async (type, ev) => { let p; on[type]({ ...ev, waitUntil: (x) => { p = x; } }); await p; };
  return { fire, shown, badges, posted, opened };
}
const push = (d) => ({ data: { json: () => d, text: () => JSON.stringify(d) } });

test('a push shows the note, counts on the icon and never links outside PondOS', async () => {
  const w = await worker();
  await w.fire('push', push({ title: 'Byl mentioned you in the pond chat', body: 'gm', url: '/meme/#lan', tag: 'mention', kind: 'mention' }));
  await w.fire('push', push({ title: 'Evil', body: 'x', url: 'https://evil.example/phish' }));
  assert.equal(w.shown.length, 2);
  assert.equal(w.shown[0].title, 'Byl mentioned you in the pond chat');
  assert.equal(w.shown[0].data.url, 'https://pepecoinhub.com/meme/#lan');
  assert.equal(w.shown[0].icon, '/meme/img/pondos-192.png');
  assert.equal(w.shown[1].data.url, 'https://pepecoinhub.com/meme/', 'outside links become PondOS home');
  assert.deepEqual(w.badges, [1, 2]);
});

test('tapping a note opens PondOS at the right window, or brings the open one forward', async () => {
  const w = await worker();
  await w.fire('push', push({ title: 'Gazette', url: '/meme/#gazette=11' }));
  await w.fire('notificationclick', { notification: { close() {}, data: w.shown[0].data } });
  assert.deepEqual(w.opened, ['https://pepecoinhub.com/meme/#gazette=11']);
  const w2 = await worker({ clients: ['https://pepecoinhub.com/meme/'] });
  await w2.fire('notificationclick', { notification: { close() {}, data: { url: 'https://pepecoinhub.com/meme/#lan' } } });
  assert.equal(JSON.stringify(w2.posted), JSON.stringify([{ type: 'pondos-open', url: 'https://pepecoinhub.com/meme/#lan' }]));
  assert.deepEqual(w2.opened, []);
});

test('opening PondOS clears the icon number and the notes', async () => {
  const w = await worker();
  await w.fire('push', push({ title: 'a' }));
  await w.fire('message', { data: { type: 'clear' } });
  assert.equal(w.badges.at(-1), 0);
  assert.equal(w.shown.length, 0);
});
