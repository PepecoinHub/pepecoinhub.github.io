/* PondOS Notifications.exe: phone / computer notifications even when PondOS is closed.
   Loaded by meme.js only when needed (the fren opens Start > Notifications, or this device already said yes).
   The fren chooses here; the server (games/supabase/update_push.sql) keeps only this device's push address and
   those choices, and the Edge Function push-send (with the PRIVATE key, never on this site) sends the notes.
   "Off" here unsubscribes this device AND deletes it on the server. The phone's own settings can block it too. */
(function () {
  'use strict';
  var LS = 'pondos-push-prefs';
  var KINDS = [
    ['mention', 'Someone @mentions me in LAN Party', 'Needs a Discord log on (only verified frens can be mentioned).'],
    ['everyone', 'Announcements from Byl (@everyone)', 'At most one an hour.'],
    ['gazette', 'A new issue of The Pond Gazette', 'About once a week.'],
    ['challenge_mine', 'My challenges', 'Someone took your Three Lilies challenge; you lost or kept the Pond King crown.'],
    ['challenge_new', 'New challenges on the board', 'Someone threw down a Three Lilies challenge. At most one every 30 minutes.']];
  var DEF = { mention: true, everyone: true, gazette: true, challenge_mine: true, challenge_new: false };

  function local(v) {
    try { if (v === undefined) return JSON.parse(localStorage.getItem(LS) || 'null'); if (v === null) localStorage.removeItem(LS); else localStorage.setItem(LS, JSON.stringify(v)); } catch (e) {}
    return null;
  }
  function keyBytes(k) {
    var t = String(k).replace(/-/g, '+').replace(/_/g, '/'), bin = atob(t + '='.repeat((4 - t.length % 4) % 4)), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function sameKey(sub, key) {
    try {
      var a = new Uint8Array(sub.options.applicationServerKey), b = keyBytes(key);
      if (a.length !== b.length) return false;
      for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
      return true;
    } catch (e) { return true; }   // the browser does not tell: trust the subscription
  }
  function subArgs(sub, prefs) {
    var j = sub.toJSON();
    return { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_prefs: prefs };
  }
  function isIos() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  function standalone() { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
  function supported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
  function reg() { return navigator.serviceWorker.getRegistration('./'); }

  var api = null, lastUser;

  // On every PondOS start for a device that already said yes: keep the server row fresh (signed-in fren, choices),
  // follow a new server key, and forget the fren on this device after a log off.
  function sync(env) {
    api = env || api;
    if (!api || !supported() || Notification.permission !== 'granted') return Promise.resolve(null);
    var user = api.userId();
    return reg().then(function (r) {
      if (!r) return null;
      return r.pushManager.getSubscription().then(function (sub) {
        if (!sub) return null;
        var ep = sub.endpoint;
        if (lastUser !== undefined && lastUser && !user) api.rpc('gry_push_forget_user', { p_endpoint: ep }).catch(function () {});
        lastUser = user;
        return api.rpc('gry_push_info', {}).then(function (info) {
          var key = info && info.key;
          if (!key) return null;
          var prefs = local() || DEF;
          if (!sameKey(sub, key)) {
            return sub.unsubscribe().then(function () { return r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }); })
              .then(function (s2) { return api.rpc('gry_push_save', subArgs(s2, prefs)); });
          }
          return api.rpc('gry_push_get', { p_endpoint: ep }).then(function (srv) {
            return api.rpc('gry_push_save', subArgs(sub, srv || prefs));
          });
        }).then(function (p) { if (p) local(p); return p; });
      });
    }).catch(function () { return null; });
  }

  function open(env) {
    api = env || api;
    var esc = api.esc;
    api.openApp('notify', 'Notifications', 'alarm-still', function (A) {
      var body = A.body, sub = null, prefs = local() || DEF, key = null, busy = false;
      body.innerHTML = '<div class="nt"><div class="tip"><img src="img/ico/alarm-still.webp" alt="" width="96" height="70"><div><b class="nt-state">Checking…</b><p class="nt-why"></p></div></div>' +
        '<div class="app-row nt-main"><button type="button" class="app-btn nt-switch" aria-pressed="false">Turn notifications ON</button><button type="button" class="app-btn nt-test" hidden>Test</button></div>' +
        '<fieldset class="nt-kinds"><legend>Notify me about</legend></fieldset>' +
        '<p class="hs-note nt-foot">Turning them OFF here deletes this device from the pond\'s list at once. You can also block PondOS any time in your phone or browser settings (Notifications). The number on the app icon resets when you open PondOS.</p>' +
        '<p class="nt-msg" role="status"></p></div>';
      var st = body.querySelector('.nt-state'), why = body.querySelector('.nt-why'), sw = body.querySelector('.nt-switch'),
        test = body.querySelector('.nt-test'), fs = body.querySelector('.nt-kinds'), msg = body.querySelector('.nt-msg');
      KINDS.forEach(function (k) {
        var l = document.createElement('label');
        l.className = 'nt-kind';
        l.innerHTML = '<input type="checkbox" data-k="' + k[0] + '"><span><b>' + esc(k[1]) + '</b><small>' + esc(k[2]) + '</small></span>';
        fs.appendChild(l);
      });
      var say = function (t, bad) { msg.textContent = t || ''; msg.classList.toggle('err', !!bad); };
      var paint = function () {
        var on = !!sub;
        sw.textContent = on ? 'Turn notifications OFF' : 'Turn notifications ON';
        sw.setAttribute('aria-pressed', String(on));
        test.hidden = !on;
        fs.disabled = !on || busy;
        sw.disabled = busy;
        fs.querySelectorAll('input').forEach(function (i) { i.checked = !!prefs[i.dataset.k]; });
        if (on) { st.textContent = 'Notifications are ON on this device'; why.textContent = 'Pick what you want below. Changes save at once.'; }
      };
      var blocked = function (title, text) { st.textContent = title; why.textContent = text; sw.hidden = true; fs.hidden = true; test.hidden = true; };

      if (!supported()) {
        if (isIos() && !standalone()) blocked('First add PondOS to your Home Screen',
          'On iPhone and iPad notifications only work in the installed app (iOS 16.4 or newer): tap Share, then "Add to Home Screen", open PondOS from that icon and come back here.');
        else blocked('This browser cannot show notifications', 'Try Chrome, Edge, Firefox or Safari, or install PondOS from the browser menu.');
        return;
      }
      if (isIos() && !standalone()) {
        blocked('First add PondOS to your Home Screen',
          'On iPhone and iPad notifications only work in the installed app (iOS 16.4 or newer): tap Share, then "Add to Home Screen", open PondOS from that icon and come back here.');
        return;
      }
      if (Notification.permission === 'denied') {
        blocked('Notifications are blocked for PondOS',
          'You blocked them earlier. To allow them again: phone Settings > Apps > (your browser or PondOS) > Notifications, or on a computer the padlock next to the address. Then reopen this window.');
        return;
      }
      busy = true; paint();
      Promise.all([api.rpc('gry_push_info', {}).catch(function () { return null; }), reg()]).then(function (r) {
        key = r[0] && r[0].key;
        if (!key) { blocked('Not ready yet', 'Pond notifications are not switched on on the server yet. Check back soon!'); return null; }
        return r[1] ? r[1].pushManager.getSubscription() : null;
      }).then(function (s) {
        sub = s || null;
        if (!sub) { st.textContent = 'Notifications are OFF'; why.textContent = 'Turn them on to hear about mentions, Byl\'s announcements, new Gazette issues and challenges, even when PondOS is closed.'; return; }
        return api.rpc('gry_push_get', { p_endpoint: sub.endpoint }).then(function (p) {
          if (p) { prefs = p; local(p); return; }
          return api.rpc('gry_push_save', subArgs(sub, prefs)).then(function (p2) { prefs = p2; local(p2); });
        });
      }).catch(function (e) { say((e && e.message) || 'The pond cannot be reached right now.', true); })
        .then(function () { busy = false; if (key) paint(); });

      sw.addEventListener('click', function () {
        if (busy) return;
        busy = true; paint(); say('');
        if (sub) {
          var ep = sub.endpoint;
          sub.unsubscribe().catch(function () {}).then(function () {
            return api.rpc('gry_push_delete', { p_endpoint: ep });
          }).then(function () { return reg(); }).then(function (r) { return r && r.unregister(); }).then(function () {
            sub = null; st.textContent = 'Notifications are OFF'; why.textContent = 'Done: this device will not get pond notifications any more.';
          }, function (e) { say((e && e.message) || 'Could not switch off on the server; try again.', true); })
            .then(function () { busy = false; paint(); });
          return;
        }
        // ON: ask the phone first (it must be right after the tap), then subscribe and save
        Promise.resolve(Notification.requestPermission()).then(function (perm) {
          if (perm !== 'granted') throw new Error(perm === 'denied' ? 'Notifications were blocked. You can allow them in your phone or browser settings.' : 'No answer, so nothing changed.');
          return navigator.serviceWorker.register('sw.js?v=20261119', { scope: './' });
        }).then(function () { return navigator.serviceWorker.ready; }).then(function (r) {
          return r.pushManager.getSubscription().then(function (old) {
            return old || r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
          });
        }).then(function (s) {
          sub = s;
          return api.rpc('gry_push_save', subArgs(s, prefs));
        }).then(function (p) {
          prefs = p; local(p); lastUser = api.userId();
          say('All set. Use Test to see how a pond notification looks.');
        }, function (e) {
          if (sub) { sub.unsubscribe().catch(function () {}); sub = null; }
          say((e && e.message) || 'Could not switch on notifications.', true);
          st.textContent = 'Notifications are OFF';
        }).then(function () { busy = false; paint(); });
      });

      fs.addEventListener('change', function (e) {
        var i = e.target; if (!sub || !i.dataset.k) return;
        var next = {}; Object.keys(prefs).forEach(function (k) { next[k] = prefs[k]; });
        next[i.dataset.k] = i.checked;
        busy = true; paint();
        api.rpc('gry_push_save', subArgs(sub, next)).then(function (p) { prefs = p; local(p); say('Saved.'); },
          function (er) { say((er && er.message) || 'Not saved, try again.', true); })
          .then(function () { busy = false; paint(); });
      });

      // a local test: shows a note right here (no server), so the fren sees what it looks like
      test.addEventListener('click', function () {
        reg().then(function (r) {
          if (!r) throw new Error('Turn notifications on first.');
          return r.showNotification('PondOS 98', { body: 'Test from the pond. If you can read this, notifications work! 🐸', icon: '/meme/img/pondos-192.png', badge: '/meme/img/pondos-badge-96.png', tag: 'pondos-test' });
        }).then(function () { say('Sent a test notification to this device.'); }, function (e) { say((e && e.message) || 'The test did not work.', true); });
      });
    }, 460);
  }

  window.PondNotify = { open: open, sync: sync, supported: supported, standalone: standalone, isIos: isIos };
})();
