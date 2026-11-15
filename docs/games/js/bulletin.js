// POND BULLETIN: open duels and pond news (public.gry_bulletin). Only public metadata ever reaches this page.
(function () {
  'use strict';
  var N = window.PondNet, mk = N.mk, $ = function (id) { return document.getElementById(id); };
  function btn(label, cls, fn) { var b = mk('button', cls, label); b.type = 'button'; b.addEventListener('click', fn); return b; }
  function passBtn(nick, id) { return btn(nick + '’s Passport', '', function () { N.open('passport', id); }); }

  // what each kind of event says; names are always set as text, never as HTML
  var HEAD = { lily_win: 'Three Lilies · result', lily_draw: 'Three Lilies · draw', king_crowned: 'Pond King · new king', king_defended: 'Pond King · long reign' };
  function story(e) {
    switch (e.kind) {
      case 'lily_win': return [e.actor, ' defeated ', e.other, ' ' + (e.data && e.data.pads ? e.data.pads.join(':') + ' ' : '') + 'in Battle of Three Lilies. The flies have spoken.'];
      case 'lily_draw': return [e.actor, ' and ', e.other, ' couldn’t settle their fly dispute. The pond remains divided.'];
      case 'king_crowned': return [e.actor, ' took the throne from ', e.other, '. Long live the Pond King.'];
      case 'king_defended': return [e.actor, ' has defended the throne ' + (e.data && e.data.defenses) + ' times. Latest to fall: ', e.other, '.'];
      default: return [e.actor, ' did something in the pond.'];
    }
  }
  function render(b) {
    var k = b.king, kl = $('king-line');
    if (k) {
      // the leader: their Fren avatar and name (Discord players with a saved avatar), otherwise the king frog
      var face = $('king-face');
      if (k.avatar) N.avatar(k.avatar, k.nick + '’s Fren avatar').then(function (av) { if (av) { face.textContent = ''; face.appendChild(av); } });
      kl.textContent = '';
      kl.appendChild(mk('b', null, k.nick));
      kl.appendChild(document.createTextNode(k.house ? ' keeps the throne warm. Somebody take it.' : ' rules the pond: ' + k.defenses + (k.defenses === 1 ? ' defence' : ' defences') + ' so far.'));
    } else $('king').hidden = true;

    var ul = $('open'); ul.textContent = '';
    (b.open || []).slice(0, 9).forEach(function (c) {
      var li = mk('li', 'note' + (c.mine ? ' mine' : ''));
      var bar = mk('div', 'note-bar'), ic = mk('img'); ic.src = 'img/pond/lilies.png'; ic.alt = ''; bar.appendChild(ic);
      bar.appendChild(document.createTextNode(c.invitee ? 'REMATCH.TXT' : 'CHALLENGE.TXT')); li.appendChild(bar);
      li.appendChild(mk('p', 'who', c.creator));
      li.appendChild(mk('p', null, c.invitee ? 'wants a rematch with ' + c.invitee + '. 10 flies each, no excuses.'
        : 'deployed 10 highly trained flies. Three lily pads. One questionable strategy. Dare to challenge?'));
      li.appendChild(mk('small', null, N.left(c.expires_at) + ' · posted ' + N.ago(c.created_at)));
      var acts = mk('div', 'acts');
      if (c.mine) acts.appendChild(btn('Your challenge', '', function () { N.open('lilies'); }));
      else if (!c.invitee || c.for_me) acts.appendChild(btn('Accept Challenge', 'go', function () { N.open('lilies', c.id); }));
      if (c.creator_passport) acts.appendChild(btn('Passport', '', function () { N.open('passport', c.creator_passport); }));
      li.appendChild(acts); ul.appendChild(li);
    });
    if (!ul.children.length) ul.appendChild(mk('li', 'note empty', 'No open challenges right now. The flies are bored. Post the first one!'));

    var news = $('news'); news.textContent = '';
    // the 10 newest notes only; the list scrolls inside its box (lilies.css .news)
    var events = (b.events || []).slice(0, 10);
    events.forEach(function (e) {
      var li = mk('li', 'clip'), parts = story(e);
      var ic = mk('img'); ic.src = e.game === 'pond_king' ? 'img/pond/king-stamp.png' : 'img/pond/lilies.png'; ic.alt = ''; li.appendChild(ic);
      li.appendChild(mk('span', 'head', HEAD[e.kind] || 'Pond news'));
      var p = mk('span');
      parts.forEach(function (x, i) { p.appendChild(i % 2 ? document.createTextNode(x) : mk('b', null, x)); });
      var tx = mk('div'); tx.appendChild(p); tx.appendChild(document.createTextNode(' ')); tx.appendChild(mk('time', null, N.ago(e.at))); li.appendChild(tx);
      var acts = mk('div', 'acts');
      if (e.game === 'lilies' && e.ref) acts.appendChild(btn('View Match', '', function () { N.open('lilies', e.ref); }));
      if (e.game === 'pond_king') acts.appendChild(btn('Throne', '', function () { N.open('king'); }));
      if (e.actor_passport) acts.appendChild(passBtn(e.actor, e.actor_passport));
      else if (e.other_passport) acts.appendChild(passBtn(e.other, e.other_passport));
      li.appendChild(acts); news.appendChild(li);
    });
    if (!news.children.length) news.appendChild(mk('li', 'clip empty', 'No news yet. The pond is waiting for its first legend.'));
    $('status').textContent = (b.open || []).length + ' open · ' + events.length + ' notes on the board';
  }
  // ---------- open tables of every game: PEPaint and Pepe Pictures rooms (gry_lobby), board games (gry_tables_lobby) ----------
  var GAME = { chess: ['Chess', '♟'], checkers: ['Checkers', '⛀'], connect4: ['Connect Four', '🔴'], battleship: ['Sea Battle', '🚢'] };
  function tables(rooms, boards) {
    var ul = $('tables'), rows = [];
    (rooms || []).filter(function (r) { return r.players > 0; }).forEach(function (r) {
      var paint = r.mode === 'kalambury';
      rows.push({ at: r.created_at, icon: paint ? '🎨' : '🖼', name: paint ? 'PEPaint' : 'Pepe Pictures', title: r.title || '',
        line: r.players + (r.players === 1 ? ' player' : ' players') + (r.max_players ? ' of ' + r.max_players : '') + (r.phase && r.phase !== 'lobby' ? ' · playing' : ' · waiting'),
        label: 'Join', go: function () { N.open(paint ? 'pepaint' : 'room', r.code); } });
    });
    (boards || []).filter(function (t) { return t.status === 'waiting' || t.status === 'playing'; }).forEach(function (t) {
      var g = GAME[t.game] || [t.game, '🎲'], who = (t.players || []).join(' vs ') || t.creator || 'a fren';
      var sit = t.status === 'waiting';
      if (!sit && !t.spectators) return;
      rows.push({ at: t.created_at, icon: g[1], name: g[0], title: t.tc || '',
        line: sit ? who + ' is waiting for a player' : who + (t.watching ? ' · ' + t.watching + ' watching' : ''),
        label: sit ? 'Sit down' : 'Watch', go: function () { N.open('table', t.code); }, wait: sit });
    });
    rows.sort(function (a, b) { return (b.wait ? 1 : 0) - (a.wait ? 1 : 0) || (b.at > a.at ? 1 : -1); });
    ul.textContent = '';
    rows.slice(0, 12).forEach(function (x) {
      var li = mk('li', 'tbl' + (x.wait ? ' wait' : ''));
      li.appendChild(mk('span', 'ic', x.icon));
      var t = mk('div'); var p = mk('p'); p.appendChild(mk('b', null, x.name)); if (x.title) p.appendChild(document.createTextNode(' · ' + x.title));
      t.appendChild(p); t.appendChild(mk('small', null, x.line)); li.appendChild(t);
      li.appendChild(btn(x.label, x.wait || x.label === 'Join' ? 'go' : '', x.go));
      ul.appendChild(li);
    });
    if (!ul.children.length) ul.appendChild(mk('li', 'muted', 'No open tables right now. Start one from Games, and it shows up here.'));
  }
  function loadTables() {
    var none = function () { return []; };
    Promise.all([N.rpc('gry_lobby', {}).then(function (l) { return l && l.rooms || []; }, none), N.rpc('gry_tables_lobby', {}).then(function (t) { return t || []; }, none)])
      .then(function (r) { tables(r[0], r[1]); });
  }
  function load() {
    loadTables();
    N.rpc('gry_bulletin', { p_limit: 20 }).then(render, function (e) {
      $('status').textContent = e.status === 404 ? 'The POND BULLETIN opens soon.' : 'The pond did not answer. Try again in a minute.';
      $('open').textContent = ''; $('news').textContent = '';
    });
  }
  $('king-go').addEventListener('click', function () { N.open('king'); });
  $('new').addEventListener('click', function () { N.open('lilies', 'new'); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) load(); });
  setInterval(function () { if (!document.hidden) load(); }, 60000);
  load();
})();
