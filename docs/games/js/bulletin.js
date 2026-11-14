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
      kl.textContent = '';
      kl.appendChild(mk('b', null, k.nick));
      kl.appendChild(document.createTextNode(k.house ? ' keeps the throne warm. Somebody take it.' : ' rules the pond: ' + k.defenses + (k.defenses === 1 ? ' defence' : ' defences') + ' so far.'));
    } else $('king').hidden = true;

    var ul = $('open'); ul.textContent = '';
    (b.open || []).slice(0, 9).forEach(function (c) {
      var li = mk('li', 'note' + (c.mine ? ' mine' : ''));
      var bar = mk('div', 'note-bar'), ic = mk('img'); ic.src = 'img/lilies.svg'; ic.alt = ''; bar.appendChild(ic);
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
    (b.events || []).forEach(function (e) {
      var li = mk('li', 'clip'), parts = story(e);
      var ic = mk('img'); ic.src = e.game === 'pond_king' ? 'img/pond-king.svg' : 'img/lilies.svg'; ic.alt = ''; li.appendChild(ic);
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
    $('status').textContent = (b.open || []).length + ' open · ' + (b.events || []).length + ' notes on the board';
  }
  function load() {
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
