// BATTLE OF THREE LILIES (games/supabase/update_lilies.sql). The page never holds anybody else's secret
// allocation: the server returns the other spread only when the duel is settled, and only to its players.
(function () {
  'use strict';
  var N = window.PondNet, mk = N.mk, $ = function (id) { return document.getElementById(id); };
  var LILIES = ['Lily A', 'Lily B', 'Lily C'];
  var me = null, flies = [0, 0, 0], mode = { kind: 'create' }, busy = false, lastOpen = [];

  var ERR = {
    signin: 'Log on first, fren.', sum: 'Exactly 10 flies, no more, no less.', flies: 'Whole flies only, 0 to 10 on a lily.',
    open_limit: 'You already have 3 open challenges. Wait for a taker, or cancel one in My Matches.',
    day_limit: 'That is 5 new challenges today. The flies need to rest. Back tomorrow (UTC).',
    busy: 'The pond is busy. Try again in a few minutes.', expired: 'Too late: this challenge expired. No win, no loss.',
    taken: 'Somebody else got there first. The flies are already settled.', self: 'You cannot accept your own challenge.',
    invite: 'This rematch is for somebody else.', missing: 'That challenge is gone.', rematch: 'That rematch is not possible.'
  };
  function errText(r) { return (r && r.error === 'nick' && r.message) || ERR[r && r.error] || 'Something went wrong. Try again.'; }
  function status(t) { $('status').textContent = t; }

  // ---------- tabs ----------
  var TABS = ['open', 'create', 'mine', 'help', 'result'];
  function show(tab) {
    TABS.forEach(function (t) { $('tab-' + t).hidden = t !== tab; });
    document.querySelectorAll('.menubar [data-tab]').forEach(function (b) {
      var on = b.dataset.tab === tab || (tab === 'result' && b.dataset.tab === 'mine'); b.setAttribute('aria-pressed', String(on));
    });
    $('signin').hidden = !!me || !(tab === 'create' || tab === 'mine');
    if (tab === 'open') loadOpen();
    if (tab === 'mine') loadMine();
  }
  document.querySelectorAll('.menubar [data-tab]').forEach(function (b) {
    b.addEventListener('click', function () { if (b.dataset.tab === 'create') startCreate(); else show(b.dataset.tab); });
  });
  $('to-bulletin').addEventListener('click', function () { N.open('bulletin'); });
  $('logon').addEventListener('click', function () { N.open('logon'); });

  // ---------- the allocator ----------
  // ---------- the pond: pixel-art lily pads and flies ----------
  // PLACEHOLDER ART (games/POND_ART_GPT_PROMPT.md): a 32x32 pixel lily pad with a notch, drawn as crisp
  // SVG rectangles, and 5x5 pixel flies from pond-net.js. Swapped for the final images later.
  var PX = N.px, G = 32, CX = 16, CY = 16.5, R = 14.6;
  var LEAF = (function () {   // the pad as rows of palette letters: k outline, g leaf, h light, v vein
    function inside(x, y) {
      var dx = x + .5 - CX, dy = y + .5 - CY, d = Math.sqrt(dx * dx + dy * dy);
      if (d > R) return false;
      var ang = Math.atan2(dx, -dy) * 180 / Math.PI;   // 0 = straight up
      return !(Math.abs(ang) < 17 && d > 1.5);          // the notch
    }
    var rows = [];
    for (var y = 0; y < G; y++) {
      var row = '';
      for (var x = 0; x < G; x++) {
        if (!inside(x, y)) { row += '.'; continue; }
        var edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
        var dx = x + .5 - CX, dy = y + .5 - CY, ang = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360, d = Math.sqrt(dx * dx + dy * dy);
        var vein = d > 3 && d < R - 2 && [30, 80, 140, 200, 330, 270].some(function (v) { return Math.abs(ang - v) < 3.2; });
        var light = dx < -3 && dy < -3 && d > 5 && d < 10;
        row += edge ? 'k' : vein ? 'v' : light ? 'h' : (d > R - 3 ? 'm' : 'g');
      }
      rows.push(row);
    }
    return rows;
  })();
  var LEAF_PAL = { k: '#142016', g: '#5cb84f', m: '#4aa23f', h: '#9fd36b', v: '#3c8a35' };
  var DIM_PAL = { k: '#142016', g: '#7a9a72', m: '#6c8c65', h: '#9fb596', v: '#5d7a57' };
  // n flies on an arc (degrees, 0 = right, clockwise) in two rings, each fly a 5x5 sprite
  function ring(n, a0, a1, name) {
    var out = '';
    for (var i = 0; i < n; i++) {
      var t = n === 1 ? .5 : i / (n - 1), a = (a0 + (a1 - a0) * t) * Math.PI / 180, r = i % 2 ? 11 : 8;
      out += PX.rects(PX.SPRITES[name], PX.PAL, Math.round(CX + r * Math.cos(a) - 2.5), Math.round(CY + r * Math.sin(a) - 2.5), 1);
    }
    return out;
  }
  // the lily pad itself is the drawn art (img/pond/lily-pad-a/b/c.png, 32x32); flies and the number go on top
  function padSvg(mine, theirs, badge, dim, n) {
    var flies = theirs == null ? ring(mine, -70, 250, 'fly') : ring(mine, 110, 250, 'fly') + ring(theirs, -70, 70, 'flyTheirs');
    return '<svg viewBox="0 0 32 32" class="leaf px' + (dim ? ' dim' : '') + '" shape-rendering="crispEdges" aria-hidden="true">' +
      '<image href="img/pond/lily-pad-' + 'abc'.charAt(n || 0) + '.png" x="0" y="0" width="32" height="32"/>' + flies +
      '<rect x="12" y="13" width="8" height="7" fill="#142016"/><rect x="13" y="14" width="6" height="5" fill="#ffffff"/>' +
      '<text class="badge-t" x="16" y="18.6" text-anchor="middle">' + badge + '</text></svg>';
  }
  var padsEl = $('pads');
  LILIES.forEach(function (name, i) {
    var pad = mk('div', 'pad'); pad.setAttribute('role', 'group'); pad.setAttribute('aria-label', name);
    pad.appendChild(mk('h3', null, name));
    var art = mk('div', 'art'); pad.appendChild(art);
    var st = mk('div', 'steps');
    var minus = mk('button', null, '−'), plus = mk('button', null, '+');
    minus.type = plus.type = 'button';
    minus.setAttribute('aria-label', 'One fly fewer on ' + name); plus.setAttribute('aria-label', 'One more fly on ' + name);
    minus.addEventListener('click', function () { if (flies[i] > 0) { flies[i]--; paint(); } });
    plus.addEventListener('click', function () { if (sum() < 10) { flies[i]++; paint(); } });
    st.appendChild(minus); st.appendChild(plus); pad.appendChild(st);
    pad._art = art; pad._minus = minus; pad._plus = plus;
    padsEl.appendChild(pad);
  });
  var jar = $('jar');
  for (var j = 0; j < 10; j++) jar.appendChild(mk('span', 'dot'));
  function sum() { return flies[0] + flies[1] + flies[2]; }
  function paint() {
    var s = sum();
    Array.prototype.forEach.call(padsEl.children, function (pad, i) {
      pad._art.innerHTML = padSvg(flies[i], null, String(flies[i]), false, i);
      pad.classList.toggle('empty', flies[i] === 0);
      pad.setAttribute('aria-label', LILIES[i] + ': ' + flies[i] + (flies[i] === 1 ? ' fly' : ' flies'));
      pad._minus.disabled = flies[i] === 0; pad._plus.disabled = s >= 10;
    });
    Array.prototype.forEach.call(jar.children, function (d, i) { d.classList.toggle('used', i < s); });
    var left = 10 - s; $('flies-left').textContent = left; $('flies-word').textContent = left === 1 ? 'fly' : 'flies';
    $('left-line').className = 'left' + (left === 0 ? ' done' : '');
    $('left-line').lastChild.textContent = left === 0 ? ' left. All 10 flies in position!' : ' still buzzing around';
    document.querySelectorAll('.presets [data-spread]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.spread === flies.join(','))); });
    $('submit').disabled = busy || s !== 10 || !me || !nickOk();
  }
  $('spread').addEventListener('click', function () {
    var a = Math.floor(Math.random() * 11), b = Math.floor(Math.random() * (11 - a)); flies = [a, b, 10 - a - b];
    flies.sort(function () { return Math.random() - .5; }); paint();
  });
  document.querySelectorAll('.presets [data-spread]').forEach(function (b) {
    b.addEventListener('click', function () { flies = b.dataset.spread.split(',').map(Number); paint(); });
  });
  var nick = $('nick');
  function nickOk() { var v = nick.value.trim(); return v.length >= 2 && v.length <= 20; }
  nick.addEventListener('input', paint);

  function startCreate(rematch) {
    mode = rematch ? { kind: 'create', rematch: rematch } : { kind: 'create' };
    flies = [0, 0, 0]; $('alloc-msg').textContent = '';
    $('alloc-title').textContent = rematch ? 'Rematch with ' + rematch.nick : 'Create a challenge';
    $('alloc-sub').textContent = rematch ? 'A brand-new spread of 10 flies, offered only to ' + rematch.nick + '. Your old spread is not reused.'
      : 'Spread exactly 10 flies over three lily pads. Nobody sees them until somebody accepts. Win two pads, win the duel.';
    $('submit').textContent = 'Create Challenge';
    show('create'); paint(); status(me ? 'Place 10 flies.' : 'Log on to post a challenge.');
  }
  function startAccept(ch) {
    mode = { kind: 'accept', ch: ch }; flies = [0, 0, 0]; $('alloc-msg').textContent = '';
    $('alloc-title').textContent = 'Challenge from ' + ch.creator;
    $('alloc-sub').textContent = ch.creator + ' deployed 10 highly trained flies. You cannot see where. Place your own 10: the result comes at once.';
    $('submit').textContent = 'Submit Strategy';
    show('create'); paint(); status('Place 10 flies. The result comes at once.');
  }

  $('submit').addEventListener('click', function () {
    if (busy || sum() !== 10 || !me) return;
    busy = true; paint(); $('alloc-msg').textContent = ''; status('The flies take off…');
    var name = nick.value.trim(); try { localStorage.setItem('pepgry-nick', name); } catch (e) {}
    var req = mode.kind === 'accept'
      ? N.rpc('gry_lily_accept', { p_id: mode.ch.id, p_a: flies[0], p_b: flies[1], p_c: flies[2], p_nick: name })
      : N.rpc('gry_lily_create', { p_a: flies[0], p_b: flies[1], p_c: flies[2], p_nick: name, p_rematch_of: mode.rematch ? mode.rematch.id : null });
    req.then(function (r) {
      busy = false;
      if (!r || !r.ok) { $('alloc-msg').textContent = errText(r); status('Not sent.'); paint(); if (r && /expired|taken|missing/.test(r.error)) loadOpen(); return; }
      if (mode.kind === 'accept') { showResult(r.match); return; }
      status('Challenge posted. 48 hours on the clock.');
      show('mine');
    }, function (e) {
      busy = false; paint();
      $('alloc-msg').textContent = e.status === 401 ? 'Your log-on ran out. Log on again.' : 'The pond did not answer. Try again.';
    });
  });

  // ---------- the result ----------
  function showResult(m) {
    show('result');
    var mine = m.you, theirs = m.them, other = m.mine ? m.opponent : m.creator;
    var otherPass = m.mine ? m.opponent_passport : m.creator_passport;
    $('res-title').textContent = (m.mine ? m.creator : m.opponent) + ' vs ' + other;
    var box = $('res-pads'); box.textContent = '';
    $('tab-result').className = 'panel ' + (m.outcome === 'win' ? 'won' : m.outcome === 'lose' ? 'lost' : 'drawn');
    $('res-kicker').textContent = 'Duel report · ' + N.ago(m.completed_at);
    LILIES.forEach(function (name, i) {
      var y = mine[i], t = theirs[i], cls = y > t ? 'won' : y < t ? 'lost' : 'tie';
      var pad = mk('div', 'pad ' + cls); pad.appendChild(mk('h3', null, name));
      var art = mk('div', 'art'); art.innerHTML = padSvg(y, t, cls === 'won' ? '+' : cls === 'lost' ? '-' : '=', cls === 'lost', i); pad.appendChild(art);
      var row = mk('div', 'vsrow');
      var a = mk('span', 'me'); a.appendChild(mk('b', null, String(y))); a.appendChild(mk('small', null, 'you'));
      var b = mk('span', 'them'); b.appendChild(mk('b', null, String(t))); b.appendChild(mk('small', null, other));
      row.appendChild(a); row.appendChild(mk('span', 'vs', 'vs')); row.appendChild(b); pad.appendChild(row);
      pad.appendChild(mk('span', 'verdict', cls === 'won' ? 'YOURS' : cls === 'lost' ? 'THEIRS' : 'UNDECIDED'));
      pad.setAttribute('aria-label', name + ': you ' + y + ', ' + other + ' ' + t + ', ' + (cls === 'won' ? 'yours' : cls === 'lost' ? 'theirs' : 'undecided'));
      box.appendChild(pad);
    });
    var won = mine.reduce(function (n, y, i) { return n + (y > theirs[i] ? 1 : 0); }, 0);
    var lost = mine.reduce(function (n, y, i) { return n + (y < theirs[i] ? 1 : 0); }, 0);
    var line = $('res-line');
    line.textContent = m.outcome === 'win' ? 'You win ' + won + ':' + lost + '!' : m.outcome === 'lose' ? 'You lose ' + won + ':' + lost + '.' : 'Draw ' + won + ':' + lost + '.';
    line.className = 'big ' + (m.outcome === 'win' ? 'w' : m.outcome === 'lose' ? 'l' : '');
    var old = $('tab-result').querySelector('.anim'); if (old) old.remove();
    var anim = mk('div', 'anim ' + (m.outcome === 'win' ? 'win' : m.outcome === 'lose' ? 'lose' : 'draw')); anim.setAttribute('aria-hidden', 'true');
    line.parentNode.insertBefore(anim, line);
    $('res-sub').textContent = m.outcome === 'win' ? 'The flies have spoken. ' + other + ' will be hearing about this.'
      : m.outcome === 'lose' ? other + ' read the pond better this time. The flies are already asking for a rematch.'
        : 'Nobody took two lilies. The pond remains divided.';
    var acts = $('res-actions'); acts.textContent = '';
    var bt = function (label, cls, fn) { var b = mk('button', cls, label); b.type = 'button'; b.addEventListener('click', fn); acts.appendChild(b); };
    bt('Rematch', 'go', function () { startRematch(m.id, other); });
    if (otherPass) bt('View Passport', '', function () { N.open('passport', otherPass); });
    bt('Back to Pond Bulletin', '', function () { N.open('bulletin'); });
    status(m.outcome === 'win' ? 'Victory. The flies are buzzing.' : m.outcome === 'lose' ? 'Defeat. Regroup the flies.' : 'A draw.');
  }
  // somebody else's duel: names, lilies won and the verdict; the spreads stay with the two players
  function showPublic(m) {
    show('result');
    $('res-title').textContent = m.creator + ' vs ' + m.opponent;
    $('res-pads').textContent = '';
    $('tab-result').className = 'panel drawn';
    $('res-kicker').textContent = 'Duel report · ' + N.ago(m.completed_at);
    var p = m.pads || [0, 0], line = $('res-line');
    line.className = 'big';
    line.textContent = m.result === 'draw' ? 'Draw ' + p[0] + ':' + p[1] + '. The pond remains divided.'
      : (m.result === 'creator_win' ? m.creator + ' beat ' + m.opponent + ' ' + p[0] + ':' + p[1] : m.opponent + ' beat ' + m.creator + ' ' + p[1] + ':' + p[0]) + '. The flies have spoken.';
    $('res-sub').textContent = 'Only the two frogs see where the flies sat. Want a story of your own? Create a challenge.';
    var acts = $('res-actions'); acts.textContent = '';
    var bt = function (label, cls, fn) { var b = mk('button', cls, label); b.type = 'button'; b.addEventListener('click', fn); acts.appendChild(b); };
    bt('Create Challenge', 'go', function () { startCreate(); });
    [[m.creator, m.creator_passport], [m.opponent, m.opponent_passport]].forEach(function (x) { if (x[1]) bt(x[0] + '’s Passport', '', function () { N.open('passport', x[1]); }); });
    bt('Back to Pond Bulletin', '', function () { N.open('bulletin'); });
  }
  // a rematch is a new challenge; the old secret spread is never reused
  function startRematch(id, nick) { startCreate({ id: id, nick: nick }); }

  // ---------- lists ----------
  function loadOpen() {
    return N.rpc('gry_bulletin', { p_limit: 30 }).then(function (b) {
      lastOpen = b.open || [];
      var ul = $('open-list'); ul.textContent = '';
      lastOpen.forEach(function (c) {
        var li = mk('li', 'card' + (c.mine ? ' mine' : '')); var ic = mk('img', 'ic'); ic.src = 'img/pond/lilies.png'; ic.alt = ''; li.appendChild(ic);
        var t = mk('div');
        var p = mk('p'); p.appendChild(mk('b', null, c.creator));
        p.appendChild(document.createTextNode(c.invitee ? ' wants a rematch with ' + c.invitee + '.' : ' is looking for a brave fren. 10 flies. 3 lily pads. Zero excuses.'));
        t.appendChild(p); t.appendChild(mk('small', null, N.ago(c.created_at) + ' · ' + N.left(c.expires_at))); li.appendChild(t);
        var acts = mk('div', 'acts');
        if (c.mine) {
          var cx = mk('button', null, 'Cancel'); cx.type = 'button'; cx.addEventListener('click', function () { cancel(c.id); }); acts.appendChild(cx);
        } else if (!c.invitee || c.for_me) {
          var ac = mk('button', 'go', 'Accept Challenge'); ac.type = 'button';
          ac.addEventListener('click', function () { if (!me) { show('create'); $('signin').hidden = false; return; } startAccept(c); });
          acts.appendChild(ac);
        }
        if (c.creator_passport) { var pp = mk('button', null, 'Passport'); pp.type = 'button'; pp.addEventListener('click', function () { N.open('passport', c.creator_passport); }); acts.appendChild(pp); }
        li.appendChild(acts); ul.appendChild(li);
      });
      if (!lastOpen.length) {
        var e = mk('li', 'muted', 'No open challenges. The pond is suspiciously quiet. ');
        var go = mk('button', 'linkish', 'Create one'); go.type = 'button'; go.addEventListener('click', function () { startCreate(); }); e.appendChild(go);
        ul.appendChild(e);
      }
      status(lastOpen.length + (lastOpen.length === 1 ? ' open challenge' : ' open challenges'));
    }, offline);
  }
  function cancel(id) {
    N.rpc('gry_lily_cancel', { p_id: id }).then(function (r) { status(r && r.ok ? 'Challenge cancelled. The flies go home.' : errText(r)); loadOpen(); loadMine(); });
  }
  function loadMine() {
    var ul = $('mine-list');
    if (!me) { ul.textContent = ''; ul.appendChild(mk('li', 'muted', 'Log on to see your matches.')); return; }
    N.rpc('gry_lily_my', {}).then(function (r) {
      ul.textContent = '';
      (r.matches || []).forEach(function (m) {
        var li = mk('li'), other = m.mine ? (m.opponent || m.invitee) : m.creator;
        var tag = m.status === 'completed' ? m.outcome : m.status;
        li.appendChild(mk('span', 'tag ' + tag, tag.toUpperCase()));
        li.appendChild(document.createTextNode(m.status === 'open' ? 'Your challenge' + (m.invitee ? ' (rematch for ' + m.invitee + ')' : '') + ': ' + spread(m.you) + ' · ' + N.left(m.expires_at)
          : m.status === 'completed' ? (m.mine ? 'Your challenge vs ' : 'Accepted from ') + other + ' · ' + spread(m.you) + ' vs ' + spread(m.them) + ' · ' + N.ago(m.completed_at)
            : 'Your challenge ' + spread(m.you) + ' · ' + (m.status === 'expired' ? 'nobody came, no win, no loss' : 'cancelled')));
        var acts = mk('span', 'acts');
        if (m.status === 'completed') { var v = mk('button', null, 'View'); v.type = 'button'; v.addEventListener('click', function () { showResult(m); }); acts.appendChild(v); }
        if (m.status === 'open') { var c = mk('button', null, 'Cancel'); c.type = 'button'; c.addEventListener('click', function () { cancel(m.id); }); acts.appendChild(c); }
        li.appendChild(acts); ul.appendChild(li);
      });
      if (!ul.children.length) ul.appendChild(mk('li', 'muted', 'No matches yet. Create a challenge or accept one.'));
    }, offline);
  }
  function spread(a) { return a ? a.join('/') : '?'; }
  function offline(e) {
    status(e && e.status === 404 ? 'BATTLE OF THREE LILIES opens soon. The lily pads are still growing.' : 'The pond did not answer. Try again in a minute.');
    $('open-list').textContent = ''; $('open-list').appendChild(mk('li', 'muted', e && e.status === 404 ? 'Opens soon.' : 'Offline.'));
  }

  // ---------- start ----------
  N.session().then(function (s) {
    me = N.me(s);
    $('who').textContent = me ? (me.name || 'guest') + (me.discord ? ' ✓' : ' (guest)') : 'not logged on';
    if (me && me.name) nick.value = me.name;
    var q = new URLSearchParams(location.search), cid = q.get('c');
    if (cid && /^[0-9a-f-]{36}$/i.test(cid)) {
      N.rpc('gry_lily_result', { p_id: cid }).then(function (r) {
        var m = r && r.match; if (!m) return show('open');
        if (m.status === 'open' && !m.mine && me && (!m.invitee || m.for_me)) startAccept(m);
        else if (m.status === 'completed' && m.you) showResult(m);
        else if (m.status === 'completed') showPublic(m);
        else show('open');
      }, function () { show('open'); });
    } else show(q.get('tab') === 'create' ? 'create' : 'open');
    if (q.get('tab') === 'create') startCreate();
  });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && !$('tab-open').hidden) loadOpen(); });
})();
