// POND KING: rock, paper, scissors for the throne (games/supabase/update_pond_king.sql).
// No sign-in: the player is a random token kept in this browser. The king's moves never reach this page,
// except the king's own (with their token) and the rounds of a duel that has just been played.
(function () {
  'use strict';
  var N = window.PondNet, framed = N.framed, me = null;
  // ?gadget=1: the small POND KING window that sits on the PondOS desktop (docs/meme/meme.js, pondKingGadget):
  // the same game, laid out compact, telling PondOS its height so the window fits it
  var GADGET = /[?&]gadget=1(&|$)/.test(location.search);
  if (GADGET) {
    document.documentElement.classList.add('gadget');
    var lastH = 0, tell = function () {
      var h = Math.ceil(document.querySelector('.window').getBoundingClientRect().height) + 4;
      if (Math.abs(h - lastH) > 2 && framed) { lastH = h; try { window.parent.postMessage({ type: 'pondos-size', h: h }, location.origin); } catch (e) {} }
    };
    if (window.ResizeObserver) new ResizeObserver(tell).observe(document.body); else setInterval(tell, 1000);
  }
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

  var state = null, busy = false, lastKingId = null, lastFace = null;
  var pick = ['', '', ''], def = ['', '', ''];
  // a move as pixel art (rock / paper / scissors sprites in pond-net.js)
  var SPRITE = { r: 'rock', p: 'paper', s: 'scissors' };
  function moveImg(m) { var im = mk('img', 'px-img'); im.src = 'img/pond/move-' + SPRITE[m] + '.png'; im.alt = ''; return im; }
  function icon(m) { var i = mk('i'); i.appendChild(moveImg(m)); return i; }

  var rpc = N.rpc;   // with the pond log-on (Discord or guest) when there is one, otherwise as a visitor

  function ago(iso) {
    var s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    var d = Math.floor(s / 86400); return d + (d === 1 ? ' day ago' : ' days ago');
  }
  // "in 3 h 12 min (at 18:40)": when the next duel opens, with the local clock time
  function untilText(iso) {
    var t = new Date(iso), ms = t.getTime() - Date.now(); if (!(ms > 0)) return 'now';
    var h = Math.floor(ms / 3600e3), m = Math.max(1, Math.ceil((ms % 3600e3) / 60e3));
    if (m === 60) { h++; m = 0; }
    var clock = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return 'in ' + (h ? h + ' h' + (m ? ' ' : '') : '') + (m ? m + ' min' : '') + ' (at ' + clock + ')';
  }
  // what a frog who just lost hears (one of these at random)
  var BRUISED = [
    'You are bruised and battered, fren. Lick your wounds, ice that eye, and come back in 4 hours.',
    'Ouch. The king left you black and blue. Rest on a soft lily pad and come back in 4 hours.',
    'You got bonked off the lily pad. Dry off, find your crown-stealing courage, and come back in 4 hours.',
    'Your frog limps home with a plaster on its nose. The pond doctor says: no duels for 4 hours.'
  ];
  function bruised() { return BRUISED[Math.floor(Math.random() * BRUISED.length)]; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function status(t) { $('status').textContent = t; }

  // three rows of rock / paper / scissors buttons
  // the hand: three slots (round 1-3) filled in order from three big move tiles; tap a filled slot to clear it
  function picker(root, arr, onChange) {
    root.textContent = '';
    var hand = mk('div', 'hand'), pal = mk('div', 'palette'), hint = mk('p', 'hand-hint');
    var slots = [0, 1, 2].map(function (i) {
      var b = mk('button', 'slot'); b.type = 'button';
      b.appendChild(mk('small', null, 'Round ' + (i + 1))); b.appendChild(mk('i')); b.appendChild(mk('span'));
      b.addEventListener('click', function () { if (arr[i]) { arr[i] = ''; paint(); onChange(); } });
      hand.appendChild(b); return b;
    });
    var tiles = Object.keys(MOVES).map(function (m) {
      var b = mk('button', 'mv'); b.type = 'button'; b.dataset.m = m;
      b.appendChild(icon(m)); b.appendChild(mk('span', null, MOVES[m][1]));
      b.setAttribute('aria-label', 'Add ' + MOVES[m][1]);
      b.addEventListener('click', function () { var i = arr.indexOf(''); if (i < 0) return; arr[i] = m; paint(); onChange(); });
      pal.appendChild(b); return b;
    });
    root.appendChild(hand); root.appendChild(pal); root.appendChild(hint);
    function paint() {
      var next = arr.indexOf('');
      slots.forEach(function (b, i) {
        var m = arr[i];
        b.classList.toggle('filled', !!m); b.classList.toggle('next', i === next);
        var ic = b.querySelector('i'); ic.textContent = ''; if (m) ic.appendChild(moveImg(m)); else ic.textContent = '?';
        b.querySelector('span').textContent = m ? MOVES[m][1] : '';
        b.setAttribute('aria-label', 'Round ' + (i + 1) + ': ' + (m ? MOVES[m][1] + ', click to clear' : 'empty'));
      });
      tiles.forEach(function (b) { b.disabled = next < 0; });
      hint.textContent = next < 0 ? 'Ready. Click a round to change it.' : 'Pick the move for round ' + (next + 1) + '.';
    }
    root.paint = paint; paint();
  }

  var nick = $('nick');
  nick.value = N.cleanNick(store.get('pk-nick')) || ('Frog' + Math.floor(1000 + Math.random() * 9000));
  function nickOk() { return N.nickOk(nick.value); }
  // the button says why it is grey: a name the pond cannot use (emoji, too short) gets a hint under it
  function canFight() {
    $('fight').disabled = busy || !nickOk() || pick.some(function (m) { return !m; });
    var hint = $('nick-hint'); if (hint) hint.hidden = nickOk() || !nick.value.trim();
  }
  picker($('pick'), pick, canFight);
  nick.addEventListener('input', canFight);
  $('dice').addEventListener('click', function () {
    for (var i = 0; i < 3; i++) pick[i] = 'rps'[Math.floor(Math.random() * 3)];
    $('pick').paint(); canFight();
  });
  picker($('def'), def, function () { $('save-def').disabled = def.some(function (m) { return !m; }) || def.join('') === ((state && state.king && state.king.moves) || ''); $('def-msg').textContent = ''; });

  function render(s, opts) {
    state = s; opts = opts || {};
    var k = s.king;
    if (!k) { $('king-name').textContent = 'The throne is empty'; status('The pond is getting ready.'); return; }
    var throne = $('throne');
    if (lastKingId !== null && lastKingId !== k.id) { throne.classList.remove('changed'); void throne.offsetWidth; throne.classList.add('changed'); }
    lastKingId = k.id;
    $('king-name').textContent = (k.you ? 'You, ' : '') + k.nick;
    $('king-line').textContent = (k.house ? 'The house frog keeps the seat warm. Somebody take it. ' : '') + 'On the throne since ' + ago(k.since) + '.';
    $('king-def').textContent = k.defenses;
    $('who').textContent = k.you ? 'you are the king' : me ? (me.name || 'guest') + (me.discord ? ' ✓' : ' (guest)') : (store.get('pk-nick') || 'visitor');
    // the leader's face: their Fren avatar (Discord players who saved one), otherwise the pond's king frog
    var faceKey = k.avatar ? JSON.stringify(k.avatar) : '';
    if (faceKey !== lastFace) {
      lastFace = faceKey; var box = $('king-face'), frog = '<img class="throne-frog" src="img/pond/pond-king.png?v=pepe" alt="" width="96" height="96">';
      if (!k.avatar) box.innerHTML = frog;
      else N.avatar(k.avatar, k.nick + '’s Fren avatar').then(function (av) { if (lastFace !== faceKey) return; box.textContent = ''; if (av) box.appendChild(av); else box.innerHTML = frog; });
    }
    var prog = $('king-progress');
    prog.hidden = !(k.you && k.defenses < 10);
    if (!prog.hidden) { prog.textContent = ''; prog.appendChild(document.createTextNode('Long Live the King stamp: ')); prog.appendChild(mk('b', null, k.defenses + '/10')); prog.appendChild(document.createTextNode(' duels won in a row' + (me && me.discord ? '.' : ' (log on with Discord to get the stamp).'))); }
    $('king-pass').hidden = !k.passport;
    $('king-pass').onclick = function () { N.open('passport', k.passport); };
    // the king's face opens the King's Passport too (only when the king has one)
    var face = $('king-face');
    face.classList.toggle('has-pass', !!k.passport);
    if (k.passport) {
      face.setAttribute('role', 'button'); face.tabIndex = 0; face.title = 'Open ' + k.nick + '’s Passport';
      face.onclick = function () { N.open('passport', k.passport); };
      face.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); N.open('passport', k.passport); } };
    } else {
      face.removeAttribute('role'); face.removeAttribute('tabindex'); face.removeAttribute('title');
      face.onclick = null; face.onkeydown = null;
    }

    // which panel: king, challenge, or wait for a new king
    var showResult = !!opts.keepResult;
    $('result').hidden = !showResult;
    $('kingpanel').hidden = !k.you;
    if (k.you) store.set('pk-my-reign', String(k.id));   // PondOS tells you later if this reign has ended (meme.js pondNews)
    var ks = $('king-share');
    ks.textContent = '';
    if (k.you) ks.appendChild(N.shareRow({ text: 'I rule the pond in POND KING on PondOS 98 (' + plural(k.defenses, 'defence', 'defences') + ' so far). Think you can dethrone me? 🐸👑', url: N.SITE + '#king' }, 'Dare a fren: dethrone me'));
    var ws = $('wait-share');
    ws.textContent = '';
    if (!k.you) ws.appendChild(N.shareRow({ text: k.nick + ' rules the pond in POND KING on PondOS 98. I can’t challenge again: take the throne for me 🐸', url: N.SITE + '#king' }, 'Send a fren'));
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
      var cd = s.cooldown;
      if (cd) {
        $('wait-title').textContent = cd.network ? 'Somebody on your network just fought' : cd.won ? 'You fought not long ago' : '🩹 Still bruised';
        $('wait-line').textContent = (cd.network ? 'One duel every 4 hours per network. ' : cd.won ? 'One duel every 4 hours, fren. '
          : 'The king gave you a proper beating. Your frog needs its rest. ') + 'Next duel ' + untilText(cd.next_at) + '.';
      } else {
        $('wait-title').textContent = 'The throne is busy';
        $('wait-line').textContent = 'Check again in a moment.';
      }
    }

    var top = $('top'); top.textContent = '';
    (s.top || []).forEach(function (t, i) {
      var li = mk('li', (t.reigning ? 'now' : '') + (t.you ? ' me' : ''));
      li.appendChild(mk('b', null, (i + 1) + '.')); li.appendChild(mk('span', null, t.nick + (t.reigning ? ' (reigning)' : ''))); li.appendChild(mk('b', null, String(t.defenses)));
      li.title = t.reigning ? 'reigning now' : 'reigned ' + ago(t.since);
      top.appendChild(li);
    });
    if (!top.children.length) top.appendChild(mk('li', 'muted', 'No reigns yet.'));

    var lg = $('longest'); lg.textContent = '';
    (s.longest || []).forEach(function (t, i) {
      var li = mk('li', (t.reigning ? 'now' : '') + (t.you ? ' me' : ''));
      li.appendChild(mk('b', null, (i + 1) + '.')); li.appendChild(mk('span', null, t.nick + (t.reigning ? ' (reigning)' : ''))); li.appendChild(mk('b', null, N.dur(t.seconds)));
      li.title = plural(t.defenses, 'defence', 'defences');
      lg.appendChild(li);
    });
    if (!lg.children.length) lg.appendChild(mk('li', 'muted', 'Nobody has held the throne yet.'));
    var my = s.stats || {};
    $('st-duels').textContent = String(my.duels || 0); $('st-thrones').textContent = String(my.thrones || 0);
    $('st-losses').textContent = String(my.losses || 0); $('st-def').textContent = String(my.best_defenses || 0);
    $('st-reign').textContent = my.longest_reign_s ? N.dur(my.longest_reign_s) : '–';

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

    status(k.you ? 'Long live the king. Your moves defend you while you are away.' : s.can_challenge ? 'The king is waiting. Pick three moves.' : s.cooldown ? 'Next duel ' + untilText(s.cooldown.next_at) + '.' : 'Waiting for a new king.');
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
    tried: 'Wait for your next duel.', network: 'Wait for your next duel.',
    self: 'You cannot challenge yourself, your majesty.', nick: 'Name: 2 to 20 letters, digits, spaces, _ . -',
    nick_bad: 'Pick a different name.', moves: 'Pick a move for every round.', busy: 'The pond is busy. Try again in a few minutes.',
    slow: 'Slow down a little, fren. Try again in a few minutes.', wait: 'Still bruised from your last duel. One duel every 4 hours, fren.', token: 'Your browser blocked the game’s storage. Reload and try again.'
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
    $('duel').hidden = true; $('waitpanel').hidden = true; $('result').hidden = false; $('result').className = 'panel';
    $('res-title').textContent = name + ' vs ' + kingNick;
    var ol = $('res-rounds'); ol.textContent = '';
    $('res-line').textContent = ''; $('res-line').className = 'big'; $('res-after').textContent = '';
    r.rounds.forEach(function (x, i) {
      var li = mk('li');
      li.appendChild(mk('span', 'n', 'ROUND ' + (i + 1)));
      var a = mk('span', 'side'); a.appendChild(icon(x.you)); a.appendChild(mk('small', null, 'you')); li.appendChild(a);
      li.appendChild(mk('span', 'vs', 'vs'));
      var b = mk('span', 'side k'); b.appendChild(mk('small', null, 'king')); b.appendChild(icon(x.king)); li.appendChild(b);
      li.appendChild(mk('span', 'out ' + (x.result > 0 ? 'w' : x.result < 0 ? 'l' : 'd'), x.result > 0 ? 'YOU WIN' : x.result < 0 ? 'KING WINS' : 'DRAW'));
      li.className = x.result > 0 ? 'rw' : x.result < 0 ? 'rl' : 'rd';
      li.setAttribute('aria-label', 'Round ' + (i + 1) + ': you ' + MOVES[x.you][1] + ', king ' + MOVES[x.king][1] + ', ' + (x.result > 0 ? 'you win' : x.result < 0 ? 'king wins' : 'draw'));
      ol.appendChild(li);
    });
    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, step = reduce ? 0 : 650;
    ol.querySelectorAll('li').forEach(function (li, i) { setTimeout(function () { li.classList.add('on'); }, step * (i + 1)); });
    setTimeout(function () {
      var line = $('res-line'), after = $('res-after');
      line.textContent = (r.won ? 'You took the throne! ' : 'The king holds. ') + r.score[0] + ' : ' + r.score[1];
      line.classList.add(r.won ? 'w' : 'l'); $('result').classList.add(r.won ? 'won' : r.score[0] === r.score[1] ? 'drawn' : 'lost');
      var anim = mk('div', 'anim ' + (r.won ? 'win' : r.score[0] === r.score[1] ? 'draw' : 'lose')); anim.setAttribute('aria-hidden', 'true');
      line.parentNode.insertBefore(anim, line);
      var p = mk('p', 'muted', r.won
        ? 'Your three moves now defend the pond, in this order.'
        : r.score[0] === r.score[1] ? 'A tie keeps the king on the throne. ' + kingNick + ' has now held it ' + plural(r.king.defenses, 'time', 'times') + '. You walk away dizzy: come back in 4 hours.'
          : kingNick + ' has now held the throne ' + plural(r.king.defenses, 'time', 'times') + '. ' + bruised() + ' Or send a fren: you know the king’s pattern now (unless they change it).');
      after.appendChild(p);
      if (r.crown_breaker_new) after.appendChild(mk('p', 'tip', 'Crown Breaker unlocked! You ended a reign of at least 13 defenses. Your stamp is in Fren Passport, and the knight avatar is ready in Create Your Fren.'));
      if (r.won) after.appendChild(mk('p', 'tip', '💡 Tip: set a new pattern now, below. Avoid three of the same: it is the easiest pattern to guess.'));
      var row = mk('div', 'row'), ok = mk('button', r.won ? 'go' : '', r.won ? 'To my throne →' : 'OK'); ok.type = 'button';
      ok.addEventListener('click', function () { $('result').hidden = true; load(); });
      row.appendChild(ok);
      after.appendChild(row);
      // the best moment to tell the pond: a new king brags, a beaten frog sends a fren to avenge it
      var brag = r.won
        ? { label: 'Share your crown 👑', text: 'I just took the POND KING throne from ' + kingNick + ' on PondOS 98. Rock, paper, scissors: come and dethrone me 🐸👑' }
        : { label: 'Send a fren ⚔', text: kingNick + ' just beat me in POND KING on PondOS 98. You know the moves now: avenge me and take the throne 🐸' };
      var share = N.shareRow({ text: brag.text, url: N.SITE + '#king' }, brag.label);
      share.classList.add(r.won ? 'brag' : 'avenge');
      after.appendChild(share);
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
  $('g-full').addEventListener('click', function () { N.open('king'); });
  $('g-board').addEventListener('click', function () { N.open('bulletin'); });
  $('to-lilies').addEventListener('click', function () { N.open('lilies'); });

  // a fresh look whenever the window comes back, and every minute while it is open
  document.addEventListener('visibilitychange', function () { if (!document.hidden && !busy && $('result').hidden) load({ keepDef: true }); });
  setInterval(function () { if (!document.hidden && !busy && $('result').hidden) load({ keepDef: true }); }, 60000);
  N.session().then(function (s) {
    me = N.me(s);
    if (me && me.name) nick.value = me.name;
    $('acct').textContent = me ? 'Logged on as ' + (me.name || 'guest') + (me.discord ? ' ✓' : '') + ': your throne follows you.' : '';
    canFight(); load();
    // Anonymous wins can only be claimed by their original browser token after Discord sign-in.
    if (me && me.discord) rpc('gry_pk_claim_crown_breaker', { p_token: token }).then(function (r) {
      if (r && r.new) $('acct').textContent += ' Crown Breaker unlocked! The stamp and knight avatar are in your Fren Passport.';
    }, function () {});
  });
})();
