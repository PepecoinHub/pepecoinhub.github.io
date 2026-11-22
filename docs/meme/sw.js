// PondOS 98 service worker: notifications, plus (2026-11-22) a cache for the desktop's static pictures only.
// Pages, scripts, styles and data are never cached or touched: they always come fresh from GitHub Pages.
// Pictures (GET, same origin, under the folders in IMG_DIRS): a ?v= versioned file is served from the cache once
// stored; an unversioned one is reused for up to IMG_FRESH_MS and then fetched again (the cache is the fallback).
//   push               -> show the note, add 1 to the number on the app icon (where the phone supports it)
//   notificationclick  -> open PondOS (or bring it forward) at the right window: #lan, #gazette=11, #lilies=<id>, #king
//   message 'clear'    -> PondOS was opened: the icon number goes back to 0
'use strict';
var COUNT = 0;   // a worker can be stopped between notes; then the number restarts from the notes still shown

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(Promise.all([self.clients.claim(), dropOldCaches()]));
});

// ---------- static pictures ----------
var IMG_CACHE = 'pondos-img-v1', IMG_MAX = 600, IMG_FRESH_MS = 6 * 3600e3;
var IMG_DIRS = ['/meme/img/', '/meme/emotes/', '/meme/avatar-assets/', '/meme/passport-assets/', '/games/img/'];
var IMG_EXT = /\.(png|webp|gif|jpe?g|svg|ico)$/i;
function dropOldCaches() {
  if (!self.caches) return Promise.resolve();
  return self.caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('pondos-img-') === 0 && k !== IMG_CACHE; }).map(function (k) { return self.caches.delete(k); }));
  }).catch(function () {});
}
function isPicture(req) {
  if (req.method !== 'GET') return false;
  var u = new URL(req.url);
  if (u.origin !== self.location.origin || !IMG_EXT.test(u.pathname)) return false;
  for (var i = 0; i < IMG_DIRS.length; i++) if (u.pathname.indexOf(IMG_DIRS[i]) === 0) return true;
  return false;
}
function trim(cache) {
  return cache.keys().then(function (keys) {
    var extra = keys.length - IMG_MAX;
    return extra > 0 ? Promise.all(keys.slice(0, extra).map(function (k) { return cache.delete(k); })) : null;
  });
}
function store(cache, req, res) {
  if (!res || res.status !== 200 || res.type !== 'basic') return res;
  var copy = res.clone(), h = new Headers(copy.headers);
  h.set('x-pondos-cached', String(Date.now()));
  return copy.blob().then(function (b) {
    return cache.put(req, new Response(b, { status: 200, statusText: 'OK', headers: h })).then(function () { return trim(cache); });
  }).catch(function () {}).then(function () { return res; });
}
function picture(req) {
  var versioned = new URL(req.url).searchParams.has('v');
  return self.caches.open(IMG_CACHE).then(function (cache) {
    return cache.match(req).then(function (hit) {
      var at = hit ? Number(hit.headers.get('x-pondos-cached')) || 0 : 0;
      if (hit && (versioned || Date.now() - at < IMG_FRESH_MS)) return hit;
      return fetch(req).then(function (res) { return store(cache, req, res); }, function (err) { if (hit) return hit; throw err; });
    });
  });
}
self.addEventListener('fetch', function (e) {
  if (!self.caches || !isPicture(e.request)) return;   // everything else: the browser's normal network path
  e.respondWith(picture(e.request).catch(function () { return fetch(e.request); }));
});

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
