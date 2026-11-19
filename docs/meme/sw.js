// PondOS 98 service worker: ONLY notifications. It caches nothing and never touches page loads
// (there is no fetch handler), so the site always comes fresh from GitHub Pages.
//   push               -> show the note, add 1 to the number on the app icon (where the phone supports it)
//   notificationclick  -> open PondOS (or bring it forward) at the right window: #lan, #gazette=11, #lilies=<id>, #king
//   message 'clear'    -> PondOS was opened: the icon number goes back to 0
'use strict';
var COUNT = 0;   // a worker can be stopped between notes; then the number restarts from the notes still shown

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

function badge(n) {
  try {
    if (n > 0 && self.navigator.setAppBadge) return self.navigator.setAppBadge(n).catch(function () {});
    if (n <= 0 && self.navigator.clearAppBadge) return self.navigator.clearAppBadge().catch(function () {});
  } catch (e) {}
  return Promise.resolve();
}

// only our own pages: a note can never send the fren somewhere else
function safeUrl(u) {
  var url = new URL(typeof u === 'string' ? u : '/meme/', self.location.origin);
  if (url.origin !== self.location.origin || url.pathname.indexOf('/meme/') !== 0) url = new URL('/meme/', self.location.origin);
  return url.href;
}

self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: 'PondOS 98', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.getNotifications().then(function (shown) {
    COUNT = Math.max(COUNT, shown.length) + 1;
    return Promise.all([
      self.registration.showNotification(String(d.title || 'PondOS 98').slice(0, 80), {
        body: String(d.body || '').slice(0, 160),
        icon: '/meme/img/pondos-192.png',
        badge: '/meme/img/pondos-badge-96.png',
        tag: String(d.tag || 'pondos').slice(0, 64),
        renotify: d.kind === 'mention',
        data: { url: safeUrl(d.url), kind: d.kind || '' }
      }),
      badge(COUNT)
    ]);
  }));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || safeUrl('/meme/');
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (new URL(c.url).pathname.indexOf('/meme/') === 0 && 'focus' in c) {
        c.postMessage({ type: 'pondos-open', url: url });
        return c.focus();
      }
    }
    return self.clients.openWindow(url);
  }).then(function () {
    return self.registration.getNotifications().then(function (left) { COUNT = left.length; return badge(COUNT); });
  }));
});

self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'clear') {
    COUNT = 0;
    e.waitUntil(Promise.all([badge(0), self.registration.getNotifications().then(function (list) { list.forEach(function (n) { n.close(); }); })]));
  }
});
