// POND KING: rock, paper, scissors for the throne (games/supabase/update_pond_king.sql).
// No sign-in: the player is a random token kept in this browser. The king's moves never reach this page,
// except the king's own (with their token) and the shuffled rounds of a duel that has just been played.
(function () {
  'use strict';
  var N = window.PondNet, framed = N.framed, me = null;
  var MOVES = { r: ['🪨', 'Rock'], p: ['📄', 'Paper'], s: ['✂️', 'Scissors'] };
  var $ = function (id) { return document.getElementById(id); };
  var mk = function (tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  // the player's random token (only its salted hash is stored on the server)
  var token = store.get('pk-token');
  if (!token || !/^[A-Za-z0-9-]{20,64}$/.test(token)) {
    token = (crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''));
    store.set('pk-token', token);
  }

  var state = null, busy = false, lastKingId = null;
  var pick = ['', '', ''], def = ['', '', ''];

  var rpc = N.rpc;   // with the pond log-on (Discord or guest) when there is one, otherwise as a visitor

  function ago(iso) {
    var s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    var d = Math.floor(s / 86400); return d + (d === 1 ? ' day ago' : ' days ago');
  }
  // "in 7 h 12 min (00:00 UTC)": when the next day's duel opens
  function untilText(iso) {
    var ms = new Date(iso).getTime() - Date.now(); if (!(ms > 0)) return 'now';
    var h = Math.floor(ms / 3600e3), m = Math.max(1, Math.ceil((ms % 3600e3) / 60e3));
    if (m === 60) { h++; m = 0; }
    return 'in ' + (h ? h + ' h ' : '') + (m ? m + ' min' : '') + ' (00:00 UTC)';
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function status(t) { $('status').textContent = t; }

  // three rows of rock / paper / scissors buttons
  function picker(root, arr, onChange) {
    root.textContent = '';
    for (var i = 0; i < 3; i++) (function (i) {
      var row = mk('div', 'rnd'); row.setAttribute('role', 'group'); row.setAttribute('aria-label', 'Round ' + (i + 1));
      row.appendChild(mk('span', null, 'Round ' + (i + 1)));
      Object.keys(MOVES).forEach(function (m) {
        var b = mk('button', 'mv'); b.type = 'button'; b.dataset.m = m;
        b.setAttribute('aria-pressed', String(arr[i] === m));
        b.appendChild(mk('i', null, MOVES[m][0])); b.appendChild(mk('span', null, MOVES[m][1]));
        b.addEventListener('click', function () { arr[i] = m; paint(); onChange(); });
        row.appendChild(b);
      });
      root.appendChild(row);
    })(i);
    function paint() {
      root.querySelectorAll('.rnd').forEach(function (row, i) {
        row.querySelectorAll('.mv').forEach(function (b) { b.setAttribute('aria-pressed', String(arr[i] === b.dataset.m)); });
      });
    }
    root.paint = paint;
  }

  var nick = $('nick');
  nick.value = store.get('pk-nick') || ('Frog' + Math.floor(1000 + Math.random() * 9000));
  function nickOk() { var v = nick.value.trim().replace(/\s+/g, ' '); return v.length >= 2 && v.length <= 20 && /^[A-Za-z0-9 _.\-]+$/.test(v); }
  function canFight() { $('fight').disabled = busy || !nickOk() || pick.some(function (m) { return !m; }); }
  picker($('pick'), pick, canFight);
  nick.addEventListener('input', canFight);
  $('dice').addEventListener('click', function () {
    for (var i = 0; i < 3; i++) pick[i] = 'rps'[Math.floor(Math.random() * 3)];
    $('pick').paint(); canFight();
  });
  picker($('def'), def, function () { $('save-def').disabled = def.join('') === ((state && state.king && state.king.moves) || ''); $('def-msg').textContent = ''; });

  function render(s, opts) {
    state = s; opts = opts || {};
    var k = s.king;
    if (!k) { $('king-name').textContent = 'The throne is empty'; status('The pond is getting ready.'); return; }
    var throne = $('throne');
    if (lastKingId !== null && lastKingId !== k.id) { throne.classList.remove('changed'); void throne.offsetWidth; throne.classList.add('changed'); }
    lastKingId = k.id;
    $('king-name').textContent = (k.you ? '👑 You, ' : '') + k.nick;
    $('king-line').textContent = (k.house ? 'The house frog keeps the seat warm. Somebody take it. ' : '') + 'On the throne since ' + ago(k.since) + '.';
    $('king-def').textContent = k.defenses;
    $('who').textContent = k.you ? 'you are the king' : me ? (me.name || 'guest') + (me.discord ? ' ✓' : ' (guest)') : (store.get('pk-nick') || 'visitor');
    $('king-pass').hidden = !k.passport;
    $('king-pass').onclick = function () { N.open('passport', k.passport); };

    // which panel: king, challenge, or wait for a new king
    var showResult = !!opts.keepResult;
    $('result').hidden = !showResult;
    $('kingpanel').hidden = !k.you;
    $('duel').hidden = !s.can_challenge || showResult;
    $('waitpanel').hidden = k.you || s.can_challenge || showResult;
    if (k.you) {
      if (!opts.keepDef) { for (var i = 0; i < 3; i++) def[i] = k.moves.charAt(i); $('def').paint(); $('save-def').disabled = true; }
      var ch = $('challengers'); ch.textContent = '';
      (s.challengers || []).forEach(function (d) {
        var li = mk('li'); li.appendChild(mk('b', null, d.nick)); li.appendChild(document.createTextNode(' played ' + moveStr(d.moves) + ' vs your ' + moveStr(d.order) + ' · '));
        li.appendChild(mk('span', 'w', 'you held')); li.appendChild(document.createTextNode(' · ')); li.appendChild(mk('time', null, ago(d.at)));
        ch.appendChild(li);
      });
      if (!ch.children.length) ch.appendChild(mk('li', 'muted', 'Nobody yet. Enjoy the quiet, your majesty.'));
    } else if (!s.can_challenge) {
      if (s.today) {
        $('wait-title').textContent = s.today.network ? 'Your network already fought today' : 'That was today’s duel';
        $('wait-line').textContent = (s.today.network ? 'One duel a day per network, and somebody here got in first. '
          : 'One duel a day, fren. ' + (s.today.won ? 'You took the throne, then.' : 'The king held this time.') + ' ') + 'The next one opens ' + untilText(s.next_at) + '.';
      } else if (s.tried && s.tried.network) {
        $('wait-title').textContent = 'Someone on your network got here first';
        $('wait-line').textContent = 'Each king can be challenged once per network. When a new frog takes the throne, you get a fresh shot.';
      } else {
        $('wait-title').textContent = s.tried && s.tried.won ? 'You beat this king once' : 'You already met this king';
        $('wait-line').textContent = 'One duel per king. When somebody else knocks ' + k.nick + ' off the throne, come back and try the new king.';
      }
    }

    var top = $('top'); top.textContent = '';
    (s.top || []).forEach(function (t, i) {
      var li = mk('li', (t.reigning ? 'now' : '') + (t.you ? ' me' : ''));
      li.appendChild(mk('b', null, (i + 1) + '.')); li.appendChild(mk('span', null, (t.reigning ? '👑 ' : '') + t.nick)); li.appendChild(mk('b', null, String(t.defenses)));
      li.title = t.reigning ? 'reigning now' : 'reigned ' + ago(t.since);
      top.appendChild(li);
    });
    if (!top.children.length) top.appendChild(mk('li', 'muted', 'No reigns yet.'));

    var rec = $('recent'); rec.textContent = '';
    (s.recent || []).forEach(function (d) {
      var li = mk('li'); li.appendChild(mk('b', null, d.nick));
      li.appendChild(document.createTextNode(' vs ' + d.king + ': '));
      li.appendChild(mk('span', d.won ? 'w' : 'l', d.won ? 'took the throne' : 'the king held'));
      li.appendChild(document.createTextNode(' · ')); li.appendChild(mk('time', null, ago(d.at)));
      rec.appendChild(li);
    });
    if (!rec.children.length) rec.appendChild(mk('li', 'muted', 'No duels yet. Be the first.'));
    $('today').textContent = s.duels_today ? '· ' + plural(s.duels_today, 'duel', 'duels') + ' in 24 h' : '';

    status(k.you ? 'Long live the king. Your moves defend you while you are away.' : s.can_challenge ? 'The king is waiting. Pick three moves.' : s.today ? 'Next duel ' + untilText(s.next_at) + '.' : 'Waiting for a new king.');
    canFight();
  }
  function moveStr(m) { return (m || '').split('').map(function (c) { return MOVES[c] ? MOVES[c][0] : '?'; }).join(''); }

  function load(opts) {
    return rpc('gry_pk_state', { p_token: token }).then(function (s) { render(s, opts); }, function (e) {
      $('king-name').textContent = 'The pond is closed';
      $('king-line').textContent = e.status === 404 ? 'POND KING opens soon. The frogs are still building the throne.' : 'The pond did not answer. Try again in a minute.';
      status('Offline'); $('duel').hidden = true;
    });
  }

  var ERR = {
    changed: 'While you were choosing, a new king took the throne. Have a look at them first.',
    tried: 'You already challenged this king.', network: 'Someone on your network already challenged this king.',
    self: 'You cannot challenge yourself, your majesty.', nick: 'Name: 2 to 20 letters, digits, spaces, _ . -',
    nick_bad: 'Pick a different name.', moves: 'Pick a move for every round.', busy: 'The pond is busy. Try again in a few minutes.',
    slow: 'Slow down a little, fren. Try again in a few minutes.', daily: 'One duel a day, fren. Come back after midnight (UTC).', token: 'Your browser blocked the game’s storage. Reload and try again.'
  };
  function errText(r) { return (r && r.error === 'nick' && r.message) || ERR[r && r.error] || 'Something went wrong.'; }

  $('duel').addEventListener('submit', function (e) {
    e.preventDefault();
    if (busy || !state || !state.king) return;
    busy = true; canFight(); $('duel-msg').textContent = ''; status('The frogs face each other…');
    var name = nick.value.trim().replace(/\s+/g, ' ');
    store.set('pk-nick', name);
    var kingNick = state.king.nick;
    rpc('gry_pk_challenge', { p_token: token, p_king_id: state.king.id, p_nick: name, p_moves: pick.join('') }).then(function (r) {
      if (!r || !r.ok) {
        busy = false; $('duel-msg').textContent = errText(r);
        if (r && (r.error === 'changed' || r.error === 'tried' || r.error === 'network')) load();
        canFight(); return;
      }
      showDuel(r, kingNick, name);
    }, function () { busy = false; $('duel-msg').textContent = 'The pond did not answer. Try again.'; canFight(); });
  });

  function showDuel(r, kingNick, name) {
    $('duel').hidden = true; $('waitpanel').hidden = true; $('result').hidden = false;
    $('res-title').textContent = name + ' vs ' + kingNick;
    var ol = $('res-rounds'); ol.textContent = '';
    $('res-line').textContent = ''; $('res-line').className = 'big'; $('res-after').textContent = '';
    r.rounds.forEach(function (x, i) {
      var li = mk('li');
      li.appendChild(mk('span', 'n', 'ROUND ' + (i + 1)));
      var a = mk('span', 'side'); a.appendChild(mk('i', null, MOVES[x.you][0])); a.appendChild(mk('small', null, 'you')); li.appendChild(a);
      li.appendChild(mk('span', 'vs', 'vs'));
      var b = mk('span', 'side k'); b.appendChild(mk('small', null, 'king')); b.appendChild(mk('i', null, MOVES[x.king][0])); li.appendChild(b);
      li.appendChild(mk('span', 'out ' + (x.result > 0 ? 'w' : x.result < 0 ? 'l' : 'd'), x.result > 0 ? 'YOU WIN' : x.result < 0 ? 'KING WINS' : 'DRAW'));
      li.setAttribute('aria-label', 'Round ' + (i + 1) + ': you ' + MOVES[x.you][1] + ', king ' + MOVES[x.king][1] + ', ' + (x.result > 0 ? 'you win' : x.result < 0 ? 'king wins' : 'draw'));
      ol.appendChild(li);
    });
    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, step = reduce ? 0 : 650;
    ol.querySelectorAll('li').forEach(function (li, i) { setTimeout(function () { li.classList.add('on'); }, step * (i + 1)); });
    setTimeout(function () {
      var line = $('res-line'), after = $('res-after');
      line.textContent = (r.won ? '👑 You took the throne! ' : 'The king holds. ') + r.score[0] + ' : ' + r.score[1];
      line.classList.add(r.won ? 'w' : 'l');
      var p = mk('p', 'muted', r.won
        ? 'Your three moves now defend the pond. The next challenger meets them in a shuffled order. You can change them below at any time.'
        : r.score[0] === r.score[1] ? 'A tie keeps the king on the throne. ' + kingNick + ' has now held it ' + plural(r.king.defenses, 'time', 'times') + '. Your next duel opens tomorrow.'
          : kingNick + ' has now held the throne ' + plural(r.king.defenses, 'time', 'times') + '. Your next duel opens tomorrow (00:00 UTC). Or tell a fren: you know which moves the king holds now.');
      after.appendChild(p);
      var row = mk('div', 'row'), ok = mk('button', r.won ? 'go' : '', r.won ? 'To my throne →' : 'OK'); ok.type = 'button';
      ok.addEventListener('click', function () { $('result').hidden = true; load(); });
      row.appendChild(ok);
      if (navigator.share && !r.won) {
        var sh = mk('button', '', 'Send a fren'); sh.type = 'button';
        sh.addEventListener('click', function () { navigator.share({ title: 'POND KING', text: kingNick + ' rules the pond. Can you take the throne?', url: 'https://pepecoinhub.com/meme/#king' }).catch(function () {}); });
        row.appendChild(sh);
      }
      after.appendChild(row);
      busy = false;
      status(r.won ? 'Long live the king!' : 'The king holds.');
      try { if (framed) window.parent.postMessage({ type: 'pond-king', won: !!r.won }, location.origin); } catch (e) {}
      load({ keepResult: true });
    }, step * 3 + (reduce ? 0 : 500));
  }

  $('save-def').addEventListener('click', function () {
    if (def.some(function (m) { return !m; })) return;
    $('save-def').disabled = true;
    rpc('gry_pk_set_moves', { p_token: token, p_moves: def.join('') }).then(function (r) {
      if (r && r.ok) { $('def-msg').textContent = 'Saved. ' + moveStr(r.moves) + ' guards the throne.'; state.king.moves = r.moves; }
      else { $('def-msg').textContent = r && r.error === 'not_king' ? 'Someone took your throne in the meantime.' : 'Not saved. Try again.'; load(); }
    }, function () { $('def-msg').textContent = 'The pond did not answer. Try again.'; $('save-def').disabled = false; });
  });
  $('recheck').addEventListener('click', function () { status('Checking the throne…'); load(); });
  $('to-bulletin').addEventListener('click', function () { N.open('bulletin'); });
  $('to-lilies').addEventListener('click', function () { N.open('lilies'); });

  // a fresh look whenever the window comes back, and every minute while it is open
  document.addEventListener('visibilitychange', function () { if (!document.hidden && !busy && $('result').hidden) load({ keepDef: true }); });
  setInterval(function () { if (!document.hidden && !busy && $('result').hidden) load({ keepDef: true }); }, 60000);
  N.session().then(function (s) {
    me = N.me(s);
    if (me && me.name) nick.value = me.name;
    $('acct').textContent = me ? 'Logged on as ' + (me.name || 'guest') + (me.discord ? ' ✓' : '') + ': your throne follows you.' : '';
    canFight(); load();
  });
})();
