// Shared plumbing for the pond duels (POND KING, BATTLE OF THREE LILIES, POND BULLETIN).
// The sign-in is the one PEP Games and PondOS already use: a Supabase session (Discord or guest) kept in this
// browser's storage. This file only reads it (and refreshes an expired one); it never signs anybody in.
// Inside a PondOS window the pages ask PondOS to open other windows (a Fren Passport, Log On, a game).
(function () {
  'use strict';
  var CFG = window.PEP_GRY || {};
  var STORE = CFG.supabaseUrl ? 'sb-' + new URL(CFG.supabaseUrl).hostname.split('.')[0] + '-auth-token' : '';
  var framed = false; try { framed = window.self !== window.top; } catch (e) { framed = true; }
  var embedded = framed || /[?&]embed=1(&|$)/.test(location.search);
  if (embedded) document.documentElement.classList.add('embed');

  function raw() { try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { return null; } }
  function valid(s) { return s && s.access_token && s.expires_at * 1000 > Date.now() + 30000 ? s : null; }
  var refreshing = null;
  // a signed-in session that is still valid; an expired one is refreshed once (PondOS does the same)
  function session() {
    var s = valid(raw()); if (s) return Promise.resolve(s);
    var r = raw(); if (!r || !r.refresh_token || !CFG.supabaseUrl) return Promise.resolve(null);
    if (!refreshing) refreshing = fetch(CFG.supabaseUrl + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', headers: { apikey: CFG.supabaseKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: r.refresh_token })
    }).then(function (x) { return x.ok ? x.json() : null; }).then(function (j) {
      refreshing = null;
      if (!j || !j.access_token) return null;
      var s2 = Object.assign({}, r, j); if (j.expires_in) s2.expires_at = Math.floor(Date.now() / 1000) + j.expires_in;
      try { localStorage.setItem(STORE, JSON.stringify(s2)); } catch (e) {}
      return s2;
    }, function () { refreshing = null; return null; });
    return refreshing;
  }
  // who is signed in: { id, discord, name } or null
  function me(s) {
    if (!s || !s.user) return null;
    var u = s.user, ids = u.identities || [], d = null;
    for (var i = 0; i < ids.length; i++) if (ids[i] && ids[i].provider === 'discord') { d = ids[i]; break; }
    var providers = (u.app_metadata && u.app_metadata.providers) || [];
    var discord = !!d || providers.indexOf('discord') >= 0;
    var idd = (d && d.identity_data) || {}, cl = idd.custom_claims || {}, m = u.user_metadata || {};
    var nick = ''; try { nick = localStorage.getItem('pepgry-nick') || ''; } catch (e) {}
    return { id: u.id, discord: discord, name: (discord && (cl.global_name || idd.full_name || idd.name || idd.user_name || m.full_name || m.name)) || nick || '' };
  }
  function rpc(name, args, opt) {
    if (!CFG.supabaseUrl || !CFG.supabaseKey) return Promise.reject(Object.assign(new Error('offline'), { status: 0 }));
    return (opt && opt.anon ? Promise.resolve(null) : session()).then(function (s) {
      var h = { apikey: CFG.supabaseKey, 'Content-Type': 'application/json' };
      if (s) h.Authorization = 'Bearer ' + s.access_token;
      return fetch(CFG.supabaseUrl + '/rest/v1/rpc/' + name, { method: 'POST', headers: h, body: JSON.stringify(args || {}) });
    }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (j) {
        if (!r.ok) { var e = new Error((j && j.message) || 'The pond did not answer'); e.status = r.status; throw e; }
        return j;
      });
    });
  }
  // ask PondOS for a window; outside PondOS go to a page instead
  var FALLBACK = {
    passport: function (m) { return '../meme/?fren=' + encodeURIComponent(m.id); },
    logon: function () { return './?login=1&back=' + encodeURIComponent(location.pathname + location.search.replace(/[?&]embed=1/, '')); },
    lilies: function (m) { return 'lilies.html' + (m.id === 'new' ? '?tab=create' : m.id ? '?c=' + encodeURIComponent(m.id) : ''); },
    king: function () { return 'pond-king.html'; },
    bulletin: function () { return 'bulletin.html'; }
  };
  function open(what, id) {
    var m = { type: 'pondos-open', open: what, id: id || null };
    if (framed) { try { window.parent.postMessage(m, location.origin); return; } catch (e) {} }
    location.href = FALLBACK[what](m);
  }
  function ago(iso) {
    var s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    var d = Math.floor(s / 86400); return d + (d === 1 ? ' day ago' : ' days ago');
  }
  function left(iso) {
    var s = (new Date(iso).getTime() - Date.now()) / 1000;
    if (s <= 0) return 'expired';
    if (s < 3600) return Math.max(1, Math.floor(s / 60)) + ' min left';
    return Math.floor(s / 3600) + ' h left';
  }
  function mk(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  window.PondNet = { session: session, me: me, rpc: rpc, open: open, framed: framed, embedded: embedded, ago: ago, left: left, mk: mk };
})();

// ---------- pixel art (PondOS is Windows 98: everything a little pixelated) ----------
// A sprite is rows of characters; each character is one pixel of a colour from the palette ('.' = clear).
// Drawn as crisp SVG rectangles, so it stays sharp at any size. PLACEHOLDER ART until the final images arrive.
(function () {
  'use strict';
  var PAL = { k: '#142016', w: '#ffffff', g: '#9a9a9a', G: '#d8d8d8', d: '#6b6b6b', l: '#7fa7d6', s: '#cfd6dc', S: '#8a959e',
              f: '#4f9f45', F: '#2e6b2a', L: '#9fd36b', y: '#f2b544', Y: '#ffe08a', o: '#b07a1a', r: '#e0403a', b: '#2c5ac4',
              x: '#8a2a1b', e: '#ffd34d', p: '#f2a28f', c: '#1d2420' };
  var SPRITES = {
    rock: ['............', '....kkkk....', '..kkGGggkk..', '.kgGGggggdk.', '.kgGgggggddk', 'kggggggggddk',
           'kgggggggdddk', 'kggggggdddk.', '.kggggdddk..', '..kkdddkk...', '....kkk.....', '............'],
    paper: ['.kkkkkkk....', '.kwwwwwkk...', '.kwwwwwkwk..', '.kwllllkkkk.', '.kwwwwwwwwk.', '.kwlllllwwk.',
            '.kwwwwwwwwk.', '.kwlllllwwk.', '.kwwwwwwwwk.', '.kwllllwwwk.', '.kwwwwwwwwk.', '.kkkkkkkkkk.'],
    scissors: ['k..........k', 'ksk......ksk', '.ksk....ksk.', '..ksk..ksk..', '...kskksk...', '....kSSk....',
               '.....kk.....', '....kkkk....', '..kkfk.kfkk.', '.kf.fk.kf.fk', '.kf.fk.kf.fk', '..kkk...kkk.'],
    fly: ['w.k.w', 'wkckw', '.rcr.', '.ccc.', '..c..'],
    flyTheirs: ['w.k.w', 'wkxkw', '.exe.', '.xxx.', '..x..']
  };
  function rects(rows, pal, ox, oy, px) {
    var out = '';
    rows.forEach(function (row, y) {
      for (var x = 0; x < row.length;) {
        var ch = row[x], n = 1; while (row[x + n] === ch) n++;
        if (ch !== '.' && ch !== ' ') out += '<rect x="' + (ox + x * px) + '" y="' + (oy + y * px) + '" width="' + (n * px) + '" height="' + px + '" fill="' + (pal[ch] || PAL[ch]) + '"/>';
        x += n;
      }
    });
    return out;
  }
  // a whole <svg> for one sprite
  function sprite(name, cls) {
    var rows = SPRITES[name], w = rows[0].length, h = rows.length;
    return '<svg class="px ' + (cls || '') + '" viewBox="0 0 ' + w + ' ' + h + '" shape-rendering="crispEdges" aria-hidden="true">' + rects(rows, PAL, 0, 0, 1) + '</svg>';
  }
  window.PondNet = window.PondNet || {};
  window.PondNet.px = { PAL: PAL, SPRITES: SPRITES, rects: rects, sprite: sprite };
})();

// ---------- Fren avatars (the same layers and rules as the PondOS Avatar Maker, docs/meme/meme.js) ----------
(function () {
  'use strict';
  var BASE = '../meme/', opts = null, SLOTS = ['bg', 'clothing', 'mouth', 'eyes', 'hat', 'accessory', 'special'];
  function options() {
    if (!opts) { opts = fetch(BASE + 'avatar-options.json?v=20261111launch').then(function (r) { if (!r.ok) throw new Error('avatar'); return r.json(); }); opts.catch(function () { opts = null; }); }
    return opts;
  }
  function pick(o, k, id) { return (o.options[k] || []).filter(function (p) { return p.id === id; })[0]; }
  // a stack of layer pictures for a saved look, or null when the look is not a known one
  function avatar(look, label) {
    return options().then(function (o) {
      if (!look || SLOTS.some(function (k) { return !pick(o, k, k === 'special' && !look.special ? 'special_none' : look[k]); })) return null;
      var special = look.special && look.special !== 'special_none';
      var s = document.createElement('span'); s.className = 'fa-stack' + (special ? ' is-special' : '');
      if (label) { s.setAttribute('role', 'img'); s.setAttribute('aria-label', label); } else s.setAttribute('aria-hidden', 'true');
      o.layers_order.forEach(function (layer) {
        var im = document.createElement('img'); im.alt = ''; im.draggable = false; im.dataset.layer = layer;
        im.src = BASE + (layer === 'base' ? (o.paths.base || o.paths.layer_template.replace('{id}', o.defaults.base)) : o.paths.layer_template.replace('{id}', look[layer] || 'special_none'));
        s.appendChild(im);
      });
      // a cigarette or a pipe sits in the corner of the chosen mouth, under the mouth layer (as in the Maker)
      var acc = s.querySelector('img[data-layer="accessory"]'), mouth = s.querySelector('img[data-layer="mouth"]');
      var a = (pick(o, 'accessory', look.accessory) || {}).in_mouth, c = (pick(o, 'mouth', look.mouth) || {}).corner;
      if (acc && mouth && a && c) { acc.style.translate = ((c[0] - a[0]) / 5.12) + '% ' + ((c[1] - a[1]) / 5.12) + '%'; s.insertBefore(acc, mouth); }
      return s;
    }).catch(function () { return null; });
  }
  window.PondNet.avatar = avatar;
})();
