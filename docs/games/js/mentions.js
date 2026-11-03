// @mentions in the lobby chat (PEP Games lobby and LAN Party in PondOS). Shared, plain script: window.PepMentions.
// The server decides who really gets a mention (verified Discord players only, see supabase/update_lobby_mentions.sql);
// this file only suggests names after "@", spots messages for me, and rings: a highlight, a short sound and,
// if the visitor allowed it, a browser notification while the tab is in the background.
(function () {
  if (window.PepMentions) return;
  var NICK_CH = 'a-z0-9ąćęłńóśźż_.\\-';
  function esc(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // does this message mention me? "@Bob" does not mention "Bobby"
  function mentionsMe(body, nick) {
    if (!nick || !body || body.indexOf('@') < 0) return false;
    return new RegExp('@' + esc(nick.toLowerCase()) + '($|[^' + NICK_CH + '])').test(String(body).toLowerCase());
  }

  var ctx = null;
  function beep() {
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state !== 'running') ctx.resume();
      [660, 880].forEach(function (f, i) {
        var o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + i * 0.12;
        o.type = 'sine'; o.frequency.setValueAtTime(f, t);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.2);
      });
    } catch (e) {}
  }
  function canNotify() { return 'Notification' in window && Notification.permission === 'granted'; }
  function askNotify() {
    if (!('Notification' in window)) return Promise.resolve(false);
    if (Notification.permission !== 'default') return Promise.resolve(Notification.permission === 'granted');
    try { return Promise.resolve(Notification.requestPermission()).then(function (p) { return p === 'granted'; }); } catch (e) { return Promise.resolve(false); }
  }
  // ring for one new mention: sound always, a system notification only while the page is in the background
  function ring(from, body, onClick) {
    beep();
    if (document.hidden && canNotify()) {
      try {
        var n = new Notification(from + ' mentioned you in the pond chat', { body: String(body).slice(0, 140), icon: '/meme/img/pep-logo.webp', tag: 'pep-mention' });
        n.onclick = function () { window.focus(); n.close(); if (onClick) onClick(); };
      } catch (e) {}
    }
  }

  // name suggestions under the message box after "@". getNames(q) returns a Promise of nicknames.
  function attach(input, getNames) {
    var wrap = input.parentNode, box = document.createElement('div'), items = [], sel = 0, timer = 0, token = 0, at = -1;
    box.className = 'mention-pop'; box.hidden = true; box.setAttribute('role', 'listbox'); box.setAttribute('aria-label', 'Players to mention');
    if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
    wrap.appendChild(box);
    function close() { box.hidden = true; items = []; at = -1; }
    function paint() {
      box.textContent = '';
      items.forEach(function (n, i) {
        var b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'option');
        b.className = 'mention-opt' + (i === sel ? ' on' : ''); b.textContent = '@' + n;
        b.addEventListener('mousedown', function (e) { e.preventDefault(); pick(i); });
        box.appendChild(b);
      });
      box.hidden = !items.length;
    }
    function pick(i) {
      var n = items[i]; if (n == null || at < 0) return;
      var v = input.value, caret = input.selectionStart == null ? v.length : input.selectionStart;
      var add = '@' + n + ' ';
      input.value = v.slice(0, at) + add + v.slice(caret).replace(/^\s+/, '');
      var pos = at + add.length; close();
      try { input.setSelectionRange(pos, pos); } catch (e) {}
      input.focus();
    }
    input.addEventListener('input', function () {
      var v = input.value, caret = input.selectionStart == null ? v.length : input.selectionStart;
      var m = /(^|\s)@([^@\s]{0,20})$/.exec(v.slice(0, caret));
      clearTimeout(timer);
      if (!m) { close(); return; }
      at = caret - m[2].length - 1;
      var q = m[2], my = ++token;
      timer = setTimeout(function () {
        Promise.resolve(getNames(q)).then(function (list) {
          if (my !== token) return;
          items = (list || []).slice(0, 8); sel = 0; paint();
        }, close);
      }, 180);
    });
    input.addEventListener('keydown', function (e) {
      if (box.hidden) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length; paint(); }
      else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); pick(sel); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
    input.addEventListener('blur', function () { setTimeout(close, 150); });
  }

  window.PepMentions = { mentionsMe: mentionsMe, ring: ring, attach: attach, askNotify: askNotify, canNotify: canNotify };
})();
