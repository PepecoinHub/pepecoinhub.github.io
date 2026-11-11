/* Pepecoin Hub, meme edition: shared header, ticker, footer, theme and small helpers.
   Every number comes from the same data files as the serious site (../data/*.json),
   so the two editions never disagree. Pages call Meme.json() and Meme.fmt for their own parts. */
(function () {
  'use strict';
  var root = document.documentElement;
  var BASE = root.getAttribute('data-base') || '../';          // the serious site
  var DATA = root.getAttribute('data-data') || BASE + 'data/'; // its data files
  var PAGE = document.body.getAttribute('data-page') || 'index';
  // Games in testing: hidden for everyone except a browser that opened /meme/?beta=pondwars once
  // (?beta=off hides them again). The game page itself is not linked anywhere and not indexed.
  var BETA = (function () {
    try {
      var q = new URLSearchParams(location.search).get('beta');
      if (q === 'pondwars') localStorage.setItem('pondos-beta', 'pondwars');
      if (q === 'off') localStorage.removeItem('pondos-beta');
      return localStorage.getItem('pondos-beta') === 'pondwars';
    } catch (e) { return false; }
  })();
  // Owner sandbox activates for this visit only. The URL does not grant owner permissions.
  var FREN_TEST = (function () {
    try { return new URLSearchParams(location.search).get('beta') === 'fren-test'; } catch (e) { return false; }
  })();
  // Fren Passport + Create Your Fren (avatar maker) in testing: hidden for everyone except a browser that
  // opened /meme/?beta=fren once (?beta=off hides it again). Until the Supabase migrations
  // (update_fren_passport.sql, update_fren_avatar.sql, update_passport_awards.sql) are run, the tester gets a
  // local preview: the look is kept in this browser only and nothing is sent to the server.
  var FREN = (function () {
    try {
      var q = new URLSearchParams(location.search).get('beta');
      if (q === 'fren') localStorage.setItem('pondos-fren-beta', '1');
      if (q === 'off') localStorage.removeItem('pondos-fren-beta');
      return FREN_TEST || localStorage.getItem('pondos-fren-beta') === '1';
    } catch (e) { return false; }
  })();
  // PepeGochi in testing: hidden for everyone except a browser that opened /meme/?beta=gochi once
  // (?beta=off hides it again). Testers get the real game (games/pepegochi-live.html: the frog on the server,
  // Discord only; it needs the PepeGochi SQL) and the LOCAL rules simulator (games/pepegochi.html, no network).
  // Launch day: the gate comes off together with the Passport's.
  var GOCHI = (function () {
    try {
      var q = new URLSearchParams(location.search).get('beta');
      if (q === 'gochi') localStorage.setItem('pondos-gochi-beta', '1');
      if (q === 'off') localStorage.removeItem('pondos-gochi-beta');
      return localStorage.getItem('pondos-gochi-beta') === '1';
    } catch (e) { return false; }
  })();


  /* ------------------------------------------------------------------ pages */
  // the same four groups as the serious site's menu (chrome.js MENU); community pages live on the serious site
  var NAV = [
    ['Understand PEP', [
      ['which-pepecoin', 'Which frog is which?', 'PEP vs PEPE vs PEPECOIN', 'glasses'],
      ['compare', 'PEP & DOGE', 'Same rules, ten years apart', 'pepe-doge'],
      ['scrypt-family', 'Scrypt family', 'One miner, three coins', 'peaky'],
      ['mica', 'MiCA whitepaper', 'The EU paperwork', 'serious'],
      ['glossary', 'Glossary', 'Fren-to-English', 'brain']
    ]],
    ['Buy, store, mine', [
      ['buy', 'How to buy PEP', 'Without buying the wrong frog', 'wrongpep'],
      ['wallets', 'Wallets', 'Where your PEP lives', 'zipper'],
      ['mining', 'Mining', 'Dig PEP with a Scrypt rig', 'pickaxe']
    ]],
    ['Numbers & charts', [
      ['price', 'Price', 'Live chart and the ×N machine', 'charts'],
      ['calculator', 'What-if machine', 'Your PEP at DOGE’s size', 'p-eyes-still'],
      ['rich-list', 'Whale watch', 'Who holds the PEP', 'detective'],
      ['network', 'Network', 'Blocks, supply, addresses', 'night-shift'],
      ['supply', 'Supply', 'No cap, falling inflation', 'farmer']
    ]],
    ['Community', [
      ['@links.html', 'Links', 'Official and community sites', 'fren-chain'],
      ['@press.html', 'For media', 'Facts, sources, logo', 'newspaper-still'],
      ['@', 'Serious edition', 'Same facts, no memes', 'serious']
    ]]
  ];
  // PondOS "app" name and icon for each meme page
  var APP = {
    index: ['Internet', 'internet'], 'which-pepecoin': ['WhichFrog.exe', 'glasses'], compare: ['PepVsDoge.exe', 'pepe-doge'],
    'scrypt-family': ['ScryptFamily.exe', 'peaky'], mica: ['MiCA.pdf', 'serious'], glossary: ['Glossary.hlp', 'brain'],
    buy: ['BuyPEP.exe', 'wrongpep'], wallets: ['Wallets.exe', 'zipper'], mining: ['Miner.exe', 'pickaxe'],
    price: ['Price.exe', 'charts'], calculator: ['WhatIf.exe', 'p-eyes-still'], 'rich-list': ['WhaleWatch.exe', 'detective'],
    network: ['Network.exe', 'night-shift'], supply: ['Supply.exe', 'farmer']
  };

  // '@page' is a page of the serious site, the rest are meme pages
  var href = function (p) { return p.charAt(0) === '@' ? (p === '@' ? serious : p === '@games/' ? osPage('') : BASE + p.slice(1)) : p === 'index' ? './' : p + '.html'; };
  var serious = BASE + (PAGE === 'index' ? '' : PAGE + '.html');

  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (html != null) e.innerHTML = html;
    return e;
  }
  var chev = '<svg viewBox="0 0 10 6" width="10" height="6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';

  /* ---------------------------------------------------------------- helpers */
  var cache = {};
  // icons (desktop, Start menu, title bars, taskbar, folders, balloons) use small still copies in img/ico/,
  // made by scripts/make_meme_icons.py, instead of the full animated pictures
  function ico(n) { if (n === 'reddit' || n === 'twitter-bird') return 'img/ico/' + n + '.svg'; if (n === 'pondwars') return '../games/img/pondwars/gold.svg'; if (n === 'pepesweeper') return '../games/img/sweeper-flag.svg'; if (n === 'fresh-fren') return 'avatar-assets/first-avatar-badge.svg'; if (n === 'stamp-new') return 'passport-assets/stamp-new.webp'; return 'img/ico/' + n + '.webp'; }
  function icoFrom(src) { var m = /^img\/([\w-]+)\.webp$/.exec(src || ''); return m ? ico(m[1]) : src; }
  function json(name) {
    if (!cache[name]) cache[name] = fetch(DATA + name, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(name + ' ' + r.status); return r.json(); });
    return cache[name];
  }
  var nf = function (o) { return new Intl.NumberFormat('en-US', o); };
  // Pepe Miner block counts get huge (it is an idle game): the same short units as in the game (K, M, B … Dc),
  // and past Dc a plain exponent, so a top-10 line never turns into a 30-digit number
  var MINER_UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
  function minerBlocks(n) {
    n = Number(n);
    if (!isFinite(n)) return '—';
    if (n < 1e6) return Math.floor(n).toLocaleString('en-US');
    if (n >= 1e36) return n.toExponential(2).replace('e+', 'e');
    var i = Math.min(MINER_UNITS.length - 1, Math.floor(Math.log10(n * (1 + 1e-12)) / 3));
    return (n / Math.pow(10, 3 * i)).toFixed(2) + ' ' + MINER_UNITS[i];
  }
  var fmt = {
    int: function (v) { return v == null ? '—' : nf({ maximumFractionDigits: 0 }).format(v); },
    dec: function (v, d) { return v == null ? '—' : nf({ minimumFractionDigits: d, maximumFractionDigits: d }).format(v); },
    pct: function (v, d) { return v == null ? '—' : nf({ minimumFractionDigits: d == null ? 2 : d, maximumFractionDigits: d == null ? 2 : d }).format(v) + '%'; },
    compact: function (v) { return v == null ? '—' : nf({ notation: 'compact', maximumFractionDigits: 2 }).format(v); },
    usd: function (x) {
      if (x == null || !isFinite(x)) return '—';
      if (x >= 1e12) return '$' + (x / 1e12).toFixed(2) + 'T';
      if (x >= 1e9) return '$' + (x / 1e9).toFixed(2) + 'B';
      if (x >= 1e6) return '$' + (x / 1e6).toFixed(2) + 'M';
      if (x >= 1e4) return '$' + Math.round(x).toLocaleString('en-US');
      if (x >= 1) return '$' + x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumSignificantDigits: 3 }).format(x);
    },
    hash: function (hs) {
      if (hs == null) return '—';
      var u = [['EH/s', 1e18], ['PH/s', 1e15], ['TH/s', 1e12], ['GH/s', 1e9]];
      for (var i = 0; i < u.length; i++) if (hs >= u[i][1]) return (hs / u[i][1]).toFixed(2) + ' ' + u[i][0];
      return fmt.int(hs) + ' H/s';
    },
    date: function (d) {
      var x = typeof d === 'string' ? new Date(d.length <= 10 ? d + 'T12:00:00Z' : d) : new Date(d);
      return x.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    }
  };
  // small numbers like 0.0000852 stay readable, never "8.52e-5"
  fmt.usd = (function (base) {
    return function (x) {
      if (x != null && isFinite(x) && x > 0 && x < 1) {
        var d = Math.min(12, Math.max(2, 3 - Math.floor(Math.log10(x))));
        return '$' + x.toFixed(d).replace(/(\.\d*?[1-9])0+$/, '$1');
      }
      return base(x);
    };
  })(fmt.usd);

  /* ---------------------------------------------------------------- ticker */
  var ticker = document.querySelector('.ticker');
  if (ticker) {
    ticker.setAttribute('aria-label', 'Key numbers');
    function refreshTicker() { return Promise.all([json('ticker.json'), json('network.json').catch(function () { return null; }), window.PepPrices.pepQuote().catch(function () { return null; })]).then(function (r) {
      var t = r[0], n = r[1], last = n && n.rows && n.rows[n.rows.length - 1];
      var items = [];
      t.price = r[2];
      if (t.price) items.push(['PEP', fmt.usd(t.price.usd) + ' <span class="' + (t.price.change_24h < 0 ? 'dn">▼ ' : 'up">▲ ') + fmt.pct(Math.abs(t.price.change_24h)) + '</span><small> ' + window.PepPrices.describe(t.price, 'en-US') + '</small>']);
      if (t.hashrate) items.push(['HASHRATE', fmt.hash(t.hashrate.hs)]);
      if (last) {
        items.push(['BLOCK', fmt.int(last[1])]);
        items.push(['SUPPLY', fmt.compact(last[2]) + ' PEP']);
        items.push(['HOLDERS', fmt.int(last[3]) + ' addresses']);
      }
      if (t.tops) items.push(['TOP 10', fmt.pct(t.tops['10'])]);
      items.push(['PREMINE', '0%'], ['REWARD', '10,000 PEP / block'], ['WEN MOON', 'NFA, fren']);
      var ul = items.map(function (i) { return '<li><b>' + i[0] + '</b>' + i[1] + '</li>'; }).join('');
      ticker.innerHTML = '<div class="ticker-track"><ul>' + ul + '</ul><ul aria-hidden="true">' + ul + '</ul></div>';
    }).catch(function () { ticker.hidden = true; }); }
    window.PepPrices.subscribeQuote(refreshTicker);
  }

  /* ---------------------------------------------------------------- taskbar */
  // PondOS: the header is a taskbar at the bottom of the screen. Start opens every page,
  // the middle shows one button per window on this page, the tray holds price, mode, theme and clock.
  var top = document.querySelector('header.top');
  var setOpen = function () {}, themeBtn = null;
  if (top) {
    var bar = el('div', { class: 'bar' });
    bar.innerHTML = '<button type="button" class="start" aria-expanded="false" aria-controls="nav"><img src="img/pep-logo.webp" alt="" width="22" height="22"><span>Start</span></button><div class="tasks" role="group" aria-label="Windows on this page"></div>';
    var nav = el('nav', { class: 'nav startmenu', id: 'nav', 'aria-label': 'Start menu', hidden: '' });
    // Start shows a short list; each group opens to the side (or below, on a phone)
    var GICON = ['glasses', 'pickaxe', 'charts', 'pond-playground'];
    var smMain = el('div', { class: 'sm-main' });
    var arrow = '<i class="sm-arr" aria-hidden="true">▸</i>';
    var subGroup = function (label, icon, inner, cls) {
      var g = el('div', { class: 'sm-group' + (cls ? ' ' + cls : '') });
      var b = el('button', { type: 'button', class: 'sm-item', 'aria-expanded': 'false' }, '<img src="' + ico(icon) + '" alt="" width="28" height="28"><span>' + label + '</span>' + arrow);
      var sub = el('div', { class: 'sm-sub', hidden: '' }); sub.appendChild(inner);
      var open = function (o) {
        if (o) smMain.querySelectorAll('.sm-group').forEach(function (x) { if (x !== g) { x.querySelector('.sm-sub').hidden = true; x.querySelector('.sm-item').setAttribute('aria-expanded', 'false'); } });
        sub.hidden = !o; b.setAttribute('aria-expanded', String(o));
        // computer: the list opens DOWN from its row; only if it would run under the taskbar is it lifted just enough
        sub.style.top = ''; sub.style.bottom = '';
        if (o && matchMedia('(min-width: 761px)').matches) {
          sub.style.top = '-4px'; sub.style.bottom = 'auto';
          var r = sub.getBoundingClientRect(), room = innerHeight - 46 - r.bottom;
          if (room < 0) sub.style.top = Math.max(-4 + room, 8 - b.getBoundingClientRect().top) + 'px';
        }
      };
      b.addEventListener('click', function (e) { e.stopPropagation(); open(sub.hidden); });
      g.addEventListener('mouseenter', function () { if (matchMedia('(hover: hover) and (min-width: 761px)').matches) open(true); });
      g.appendChild(b); g.appendChild(sub);
      return g;
    };
    var meItem = el('button', { type: 'button', class: 'sm-item sm-me' }, '<img src="' + ico('pep-logo') + '" alt="" width="28" height="28" loading="lazy"><span><b class="logon-name">Log on…</b> <span class="hs-ok logon-ok" hidden title="Verified with Discord">✓</span></span>');
    meItem.addEventListener('click', function () { setOpen(false); logOn(); });
    smMain.appendChild(meItem);
    var passportItem = el('button', { type: 'button', class: 'sm-item' }, '<img src="' + ico('passport') + '" alt="" width="28" height="28"><span><b>Fren Passport</b> <small>My Fren, achievements and secrets</small></span>');
    passportItem.addEventListener('click', function () { setOpen(false); frenPassport(); });
    if (FREN) smMain.appendChild(passportItem);
    var findItem = el('button', { type: 'button', class: 'sm-item' }, '<img src="' + ico('search') + '" alt="" width="28" height="28"><span><b>Find…</b> <small>games, pages, tools</small></span>');
    findItem.addEventListener('click', function () { setOpen(false); finder(); });
    smMain.appendChild(el('hr'));
    NAV.forEach(function (g, gi) {
      var list = el('div', { class: 'sm-list' });
      g[1].forEach(function (p) {
        var a = el('a', { href: href(p[0]) }, '<img src="' + ico(p[3]) + '" alt="" width="24" height="24" loading="lazy"><span><b>' + p[1] + '</b><small>' + p[2] + '</small></span>');
        if (p[0] === PAGE) a.setAttribute('aria-current', 'page');
        list.appendChild(a);
      });
      smMain.appendChild(subGroup(g[0], GICON[gi], list));
    });
    var gl = el('div', { class: 'sm-list' });
    [['FUD Invaders', 'Shoot receipts at the FUD', 'gif-008-still', function () { invaders(); }],
      ['PEP Snake', 'Eat blocks, not your tail', 'gif-027-still', function () { snake(); }],
      ['YEET THE PEP', 'A frog, a catapult, no flight plan', 'yeet', function () { yeetApp(); }],
      ['PEPE SWEEPER', 'Flag the wrong Pepe', 'pepesweeper', function () { pepeSweeperApp(); }],
      ['LEADERS', 'Every top 10 in one place', 'leaders', function () { highScores(); }],
      ["Pepe Guesser", 'A new photo every day: find Pepe on the map', 'wheres-pepe', function () { wheresPepe(); }],
      ['PEPaint', 'The party room: draw and guess with frens', 'pepaint', function () { drawGuess(); }],
      ['All games…', 'Chess, Checkers, Sea Battle, Pepe Miner and more', 'pond-playground', function () { gamesFolder(); }]].concat([['FROGAGEDDON (beta)', 'New physics, compact controls · field test', 'pondwars', function () { pondWarsApp(); }]]).concat(GOCHI ? [['PEPEGOCHI.EXE', 'Your frog: feed it, clean it, keep it happy', 'pep-logo', function () { pepegochiApp(); }],
        ['PEPEGOCHI (local test)', 'Rules simulator with a time machine · nothing is saved', 'pep-logo', function () { pepegochiTestApp(); }]] : []).forEach(function (g) {
      var b = el('a', { href: '#', role: 'button' }, '<img src="' + ico(g[2]) + '" alt="" width="24" height="24" loading="lazy"><span><b>' + g[0] + '</b><small>' + g[1] + '</small></span>');
      b.addEventListener('click', function (e) { e.preventDefault(); setOpen(false); g[3](); });
      gl.appendChild(b);
    });
    smMain.appendChild(subGroup('Games', 'gif-061-still', gl));
    var winsUl = el('ul', { class: 'sm-wins' });
    var winsGroup = subGroup('Windows on this page', 'gif-045-still', winsUl, 'sm-windows');
    var arrange = el('button', { type: 'button', class: 'sm-item' }, '<span class="sm-ico" aria-hidden="true">▦</span><span>Arrange windows</span>');
    var sd = el('button', { type: 'button', class: 'sm-item' }, '<span class="sm-ico" aria-hidden="true">⏻</span><span>Shut down…</span>');
    arrange.addEventListener('click', function () { setOpen(false); arrangeAll(); });
    sd.addEventListener('click', function () { setOpen(false); shutDown(); });
    [['Frog Mail', 'frog-mail', function () { frogMail(); }], ['AddressCheck.exe', 'pepe-search', function () { addressCheck(); }]].forEach(function (x) {
      var it = el('button', { type: 'button', class: 'sm-item' }, '<img src="' + ico(x[1]) + '" alt="" width="28" height="28"><span>' + x[0] + (x[0] === 'Frog Mail' ? ' <b class="mail-new sm-new" hidden>1 new</b>' : '') + '</span>');
      it.addEventListener('click', function () { setOpen(false); x[2](); });
      smMain.appendChild(it);
    });
    smMain.appendChild(el('hr'));
    smMain.appendChild(winsGroup);
    var themeItem = el('button', { type: 'button', class: 'sm-item' }, '<span class="sm-ico" aria-hidden="true">🌓</span><span>Day / night mode</span>');
    themeItem.addEventListener('click', function () { setOpen(false); if (themeBtn) themeBtn.click(); });
    smMain.appendChild(themeItem);
    smMain.appendChild(arrange);
    smMain.appendChild(el('hr'));
    var aboutItem = el('button', { type: 'button', class: 'sm-item' }, '<img src="' + ico('night-shift') + '" alt="" width="28" height="28"><span>About me</span>');
    aboutItem.addEventListener('click', function () { setOpen(false); aboutMe(); });
    smMain.appendChild(aboutItem);
    smMain.appendChild(findItem);
    smMain.appendChild(sd);
    nav.appendChild(el('div', { class: 'sm-band', 'aria-hidden': 'true' }, '<span>Pond<b>OS</b> 1.0</span>'));
    nav.appendChild(smMain);

    var tb = el('button', { type: 'button', class: 'themebtn', id: 'themebtn', 'aria-label': 'Switch light or dark' });
    themeBtn = tb;
    // Serious | Meme switch: the knob sits on Meme here and slides to Serious on click
    var ml = el('a', { class: 'mode-link', href: serious, title: 'Switch to serious mode: same facts, no memes', 'aria-label': 'Switch to serious mode' }, '<span class="mt-a">Serious</span><span class="mt-b">Meme</span>');
    ml.addEventListener('click', function (e) {
      try { localStorage.setItem('hub-mode', 'serious'); } catch (err) {}
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      e.preventDefault(); ml.classList.add('to-a');
      setTimeout(function () { location.href = ml.href; }, 220);
    });
    var tray = el('div', { class: 'tray' }, '<span class="tray-price" hidden></span><span class="tray-hash" hidden></span><span class="tray-moon">WEN MOON: NFA</span>');
    tray.appendChild(ml);
    tray.appendChild(tb);
    tray.appendChild(el('time', { class: 'tray-clock' }));
    bar.appendChild(tray);
    var mb = bar.querySelector('.start');
    setOpen = function (o) {
      if (!o) nav.querySelectorAll('.sm-sub').forEach(function (x) { x.hidden = true; x.previousSibling.setAttribute('aria-expanded', 'false'); });
      nav.hidden = !o; top.classList.toggle('open', o); mb.setAttribute('aria-expanded', String(o));
      root.classList.toggle('menu-lock', o);
    };
    mb.addEventListener('click', function (e) { e.stopPropagation(); setOpen(nav.hidden); });
    bar.appendChild(nav);
    top.appendChild(bar);
    document.addEventListener('click', function (e) { if (!nav.hidden && !top.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !nav.hidden) { setOpen(false); mb.focus(); } });

    // theme: system by default, the same choice as the serious site
    var isDark = function () { var t = root.getAttribute('data-theme'); return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; };
    var paint = function () { tb.innerHTML = (isDark() ? '☀️' : '🌙') + '<span class="tl"> ' + (isDark() ? 'Light mode' : 'Dark mode') + '</span>'; };
    tb.addEventListener('click', function () { var t = isDark() ? 'light' : 'dark'; root.setAttribute('data-theme', t); try { localStorage.setItem('phw-theme', t); } catch (e) {} paint(); });
    paint();
  }

  /* ---------------------------------------------------------------- footer */
  var foot = document.querySelector('footer.foot');
  if (foot) {
    var cols = NAV.map(function (g) {
      return '<div><p class="h">' + g[0] + '</p><ul>' + g[1].map(function (p) { return '<li><a href="' + href(p[0]) + '">' + p[1] + '</a></li>'; }).join('') + '</ul></div>';
    }).join('');
    foot.innerHTML = '<div class="in">' +
      '<div class="footmeme"><img src="img/how-to-be-rich.webp" alt="Pepe reading How to be rich. The page says: buy $PEP" width="120" height="120" loading="lazy"><div>' +
      '<p class="hand">Not financial advice. The frog is not a financial advisor.</p>' +
      '<p>Pepecoin Hub is a community project by a regular fren from r/pepecoin. It never holds anyone’s coins and never asks for a seed phrase or a password. Anyone who does is a scammer, fren. Every number links to a public source.</p>' +
      '<p><a href="' + serious + '">Same page, serious mode</a> · <a href="https://github.com/PepecoinHub/pepecoinhub.github.io/issues/new?template=correction.yml">Report a mistake</a></p></div></div>' +
      '<div class="footcols">' + cols + '</div>' +
      '<div class="footfine"><span>Memes are the community’s. Facts are everyone’s. The compiler holds PEP.</span><a class="exit" href="#top"><img src="img/exit.webp" alt="" width="46" height="52" loading="lazy">Back to the top</a></div>' +
      '</div>';
  }

  // Same voluntary support section and receiving addresses as the serious footer.
  if (foot) foot.querySelector('.footfine').insertAdjacentHTML('beforebegin', "<details class=\"support\"><summary>Like this site? You can support its further development.</summary><p>Any amount, however small, helps. Thank you!</p><dl><div><dt>Pepecoin (PEP)</dt><dd><code>PiwzfZU1t37hCvKboCNN49YT8CPN2nXa3t</code></dd></div><div><dt>Litecoin (LTC)</dt><dd><code>ltc1qs05pfynke7ekd66cywkh235rvnykdqrnn4r58j</code></dd></div><div><dt>Dogecoin (DOGE)</dt><dd><code>DHLfH7Zk4nRLc41KpuDQNazY3qyNnjnT9v</code></dd></div><div><dt>Bitcoin (BTC)</dt><dd><code>bc1q4uxmuqrpg4znmmj3ccnt0ezf9mx6augrxuet5p</code></dd></div></dl></details>");

  // fill <span data-m="key"> with values, shared by pages
  function fill(map) {
    document.querySelectorAll('[data-m]').forEach(function (e) {
      var k = e.getAttribute('data-m');
      if (map[k] != null) e.textContent = map[k];
    });
  }

  /* A simple line chart: points [[x, y], ...], x as time (ms). Draws into an <svg> inside box,
     with a faint grid, an area, the end point and a hover/tap readout. */
  function lineChart(box, series, opt) {
    opt = opt || {};
    var W = Math.round(Math.min(900, Math.max(340, box.clientWidth || 900))), H = Math.round((opt.height || 300) * (W < 600 ? 0.62 + 0.38 * W / 600 : 1)), L = opt.left || 58, R = 16, T = 16, B = 34;
    var all = [];
    series.forEach(function (s) { all = all.concat(s.points); });
    if (!all.length) return;
    var x0 = Math.min.apply(null, all.map(function (p) { return p[0]; })), x1 = Math.max.apply(null, all.map(function (p) { return p[0]; }));
    var ys = all.map(function (p) { return p[1]; });
    var lo = opt.min != null ? opt.min : Math.min.apply(null, ys), hi = opt.max != null ? opt.max : Math.max.apply(null, ys);
    if (opt.log) { lo = Math.log10(lo); hi = Math.log10(hi); }
    var pad = (hi - lo) * 0.06 || 1; if (opt.min == null) lo -= pad; if (opt.max == null) hi += pad;
    var X = function (v) { return L + (v - x0) * (W - L - R) / ((x1 - x0) || 1); };
    var Y = function (v) { var y = opt.log ? Math.log10(v) : v; return T + (hi - y) * (H - T - B) / ((hi - lo) || 1); };
    var g = '';
    var ticks = opt.yTicks || 4;
    for (var i = 0; i <= ticks; i++) {
      var tv = lo + (hi - lo) * i / ticks, real = opt.log ? Math.pow(10, tv) : tv, yy = T + (hi - tv) * (H - T - B) / ((hi - lo) || 1);
      g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '" stroke="var(--line)" stroke-opacity=".16" stroke-dasharray="4 5"/>';
      g += '<text x="' + (L - 8) + '" y="' + (yy + 4) + '" text-anchor="end">' + (opt.yfmt ? opt.yfmt(real) : real.toFixed(1)) + '</text>';
    }
    var nX = opt.xTicks || 5;
    for (var j = 0; j <= nX; j++) {
      var xv = x0 + (x1 - x0) * j / nX;
      g += '<text x="' + X(xv) + '" y="' + (H - 10) + '" text-anchor="' + (j === 0 ? 'start' : j === nX ? 'end' : 'middle') + '">' + (opt.xfmt ? opt.xfmt(xv) : fmt.date(xv)) + '</text>';
    }
    series.forEach(function (s, si) {
      var d = s.points.map(function (p, k) { return (k ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1); }).join(' ');
      if (si === 0 && !opt.noArea) g += '<path d="' + d + ' L' + X(s.points[s.points.length - 1][0]) + ' ' + (H - B) + ' L' + X(s.points[0][0]) + ' ' + (H - B) + ' Z" fill="' + (s.color || 'var(--frog)') + '" fill-opacity=".16"/>';
      g += '<path d="' + d + '" fill="none" stroke="' + (s.color || 'var(--frog-deep)') + '" stroke-width="' + (s.width || 3) + '" stroke-linejoin="round"' + (s.dash ? ' stroke-dasharray="6 5"' : '') + '/>';
      var e = s.points[s.points.length - 1];
      if (!s.noDot) g += '<circle cx="' + X(e[0]) + '" cy="' + Y(e[1]) + '" r="6" fill="var(--gold)" stroke="var(--line)" stroke-width="3"/>';
    });
    g += '<line class="cur" x1="0" x2="0" y1="' + T + '" y2="' + (H - B) + '" stroke="var(--line)" stroke-width="1.5" visibility="hidden"/>';
    var svg = box.querySelector('svg') || box.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'svg'));
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    if (opt.label) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', opt.label); }
    svg.innerHTML = g;
    var tip = box.querySelector('.lc-tip') || box.appendChild(el('div', { class: 'tip lc-tip', hidden: '' }));
    var cur = svg.querySelector('.cur'), main = series[0].points;
    function move(ev) {
      var r = svg.getBoundingClientRect(), px = (ev.clientX - r.left) / r.width * W;
      var xv = x0 + (px - L) / (W - L - R) * (x1 - x0), best = 0;
      for (var k = 1; k < main.length; k++) if (Math.abs(main[k][0] - xv) < Math.abs(main[best][0] - xv)) best = k;
      var p = main[best], sx = X(p[0]);
      cur.setAttribute('x1', sx); cur.setAttribute('x2', sx); cur.setAttribute('visibility', 'visible');
      tip.hidden = false;
      tip.innerHTML = (opt.tipfmt ? opt.tipfmt(p, best) : fmt.date(p[0]) + '<br>' + p[1]);
      tip.style.left = Math.min(Math.max(sx / W * r.width, 70), r.width - 70) + 'px';
      tip.style.top = (Y(p[1]) / H * r.height + 14) + 'px';
    }
    svg.onpointermove = move; svg.onpointerdown = move;
    svg.onpointerleave = function () { cur.setAttribute('visibility', 'hidden'); tip.hidden = true; };
  }

  /* ================================================================ PondOS
     The meme edition as the frog's own desktop. Every block of a page is a window: drag it by its
     title bar, click to bring it to the front, minimize it to the taskbar, maximize or close it
     (Start ▸ Windows on this page brings it back). The content and numbers stay exactly as written. */
  var REDUCE = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ICO = {
    min: '<svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><path d="M1 8.5h6" stroke="currentColor" stroke-width="2"/></svg>',
    max: '<svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><path d="M1 1h8v8H1z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M1 1.8h8" stroke="currentColor" stroke-width="2"/></svg>',
    x: '<svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" stroke-width="1.9"/></svg>'
  };
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // a modal dialog in the same window chrome; buttons: [{label, go, href, fn}]
  function osDialog(title, html, buttons, icon) {
    var d = el('dialog', { class: 'os-dlg', 'aria-label': title });
    d.innerHTML = '<div class="win active"><div class="win-bar"><img src="' + ico(icon || 'pep-logo') + '" alt="" width="16" height="16"><span class="win-t">' + esc(title) + '</span><span class="win-ctl"><button type="button" class="w-x" title="Close">' + ICO.x + '<span class="sr">Close</span></button></span></div><div class="dlg-body">' + html + '</div><div class="dlg-btns"></div></div>';
    var row = d.querySelector('.dlg-btns');
    buttons.forEach(function (b) {
      var x = b.href ? el('a', { class: 'btn' + (b.go ? ' go' : ''), href: b.href }, b.label) : el('button', { type: 'button', class: 'btn' + (b.go ? ' go' : '') }, b.label);
      x.addEventListener('click', function () { if (b.fn) b.fn(); if (!b.href) d.close(); });
      row.appendChild(x);
    });
    d.querySelector('.w-x').addEventListener('click', function () { d.close(); });
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
    d.addEventListener('close', function () { d.remove(); });
    document.body.appendChild(d);
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
    var first = row.querySelector('.go') || row.firstChild; if (first) first.focus();
    return d;
  }
  function aboutOS() {
    osDialog('About PondOS', '<div class="dlg-row"><img src="img/gif-045.webp" alt="" width="96" height="48"><div><h3>PondOS 98 Second Frog Edition</h3><p>The meme edition of Pepecoin Hub. Drag windows by their title bars, double-click a title to maximize. Memory: 100% memes, 100% receipts.</p><p class="src">Animated Pepes by <a href="https://klipy.com/profile/lilyinpyjamas/">Lily in Pyjamas</a>. Not financial advice.</p></div></div>', [{ label: 'OK', go: true }]);
  }

  // ---------- window titles ----------
  function slug(t) {
    return t.toLowerCase().replace(/[’'"“”?!.,:()]/g, '').replace(/&/g, 'and').replace(/×/g, 'x').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').split('_').slice(0, 4).join('_') || 'untitled';
  }
  var HOME = {
    'wf-h': 'Properties: Which frog?', 'rc-h': 'Pond Task Manager - Performance', 'mn-h': 'Copying work to 3 chains…',
    'buy-h': 'Get PEP Setup Wizard', 'rl-h': 'frogs_four_rules.txt - PondPad', 'ex-h': 'Exploring - C:\\Pond\\Dig deeper',
    'pond-h': 'Pond Messenger - #frens', 'lk-h': 'Address Book - Official links, wallets and markets', 'gif-h': 'Image Viewer - GIFs by Lily in Pyjamas'
  };
  function winTitle(host, body) {
    var app = (APP[PAGE] || ['PEP.exe'])[0], lab = host.getAttribute('aria-labelledby') || '';
    if (body.classList.contains('hero')) return 'Internet - Pepecoin Hub, meme edition';
    if (body.classList.contains('pagehead')) { var h1 = body.querySelector('h1'); return app + ' - ' + (h1 ? h1.textContent.replace(/\s+/g, ' ').trim().split(/[.?:!]/)[0] : 'Pepecoin'); }
    if (body.classList.contains('chooser')) return 'Choose your frog';
    if (body.classList.contains('loading')) return 'Loading…';
    if (body.classList.contains('pond-break')) return 'touch_grass.bat';
    if (PAGE === 'index' && HOME[lab]) return HOME[lab];
    var h = body.querySelector('h2, h3'), t = h ? h.textContent.replace(/\s+/g, ' ').trim() : (host.getAttribute('aria-label') || 'Untitled');
    if (body.querySelector('.gifs')) return 'Image Viewer - gallery';
    if (lab === 'sources' || host.id === 'sources' || /^(sources|receipts)/i.test(t)) return 'receipts.log - PondPad';
    if (body.querySelector('.links')) return 'Address Book - ' + t;
    if (body.querySelector('.explore')) return 'Exploring - C:\\Pond\\' + t;
    if (lab === 'faq' || /questions|faq/i.test(t)) return 'Help - ' + t;
    if (body.querySelector('table')) return slug(t) + '.csv - FrogSheets';
    if (body.querySelector('.chart, .pchart, .plot, .nchart, .chart-card, .scfig')) return 'Pond Task Manager - ' + t;
    return slug(t) + '.txt - PondPad';
  }
  var WIDE = 'table, .tablebox, .chart, .pchart, .plot, .nchart, .chart-card, .scfig, .explore, .links, .receipts, .cardrow, .tiles, .calc, .combo, .ranksbox, .cmp, .gifs, .choose, .xctl, .nowrow, .notpepe, .family, .fam';

  // ---------- windows ----------
  var wins = [], zTop = 20, activeW = null, maxW = null, closedHint = false;
  var tasks = document.querySelector('.tasks');
  var winList = document.querySelector('.sm-wins');
  function inView(W) { var r = W.host.getBoundingClientRect(); return r.bottom > 40 && r.top < window.innerHeight - 60; }
  function focusW(W) {
    if (!W) return;
    zTop += 1; W.host.style.zIndex = zTop;
    if (activeW && activeW !== W) { activeW.win.classList.remove('active'); activeW.task.setAttribute('aria-pressed', 'false'); }
    activeW = W; W.win.classList.add('active'); W.task.setAttribute('aria-pressed', 'true');
  }
  function reveal(W) { if (!inView(W) && !W.host.classList.contains('is-max')) W.host.scrollIntoView({ block: 'start', behavior: REDUCE ? 'auto' : 'smooth' }); }
  function nextActive() { var n = null; wins.forEach(function (w) { if (w.state === 'open' && !w.host.closest('[hidden]') && (!n || (+w.host.style.zIndex || 0) > (+n.host.style.zIndex || 0))) n = w; }); if (n) focusW(n); else activeW = null; }
  function setState(W, s) {
    if (s !== 'open' && W.host.classList.contains('is-max')) toggleMax(W);
    W.state = s;
    W.host.classList.toggle('is-min', s === 'min');
    W.host.classList.toggle('is-closed', s === 'closed');
    sync(W);
    deskEmpty(W);
    if (s === 'open') { focusW(W); reveal(W); } else if (W === activeW) { W.win.classList.remove('active'); W.task.setAttribute('aria-pressed', 'false'); activeW = null; nextActive(); }
  }
  // with every window minimized or closed the desktop icons show, on every page and on a phone too
  function deskEmpty(W) {
    // the "About Pepecoin Hub" window at the bottom: when a phone closes the page's own windows, it is tucked
    // into the taskbar as well, so the icons are not stuck behind it (opened again by hand, it stays open)
    var main = false, foot = null;
    wins.forEach(function (w) { if (w.host.closest('footer')) foot = w; else if (w.state === 'open' && !w.host.closest('[hidden]')) main = true; });
    if (!main && W && W !== foot && foot && foot.state === 'open' && window.innerWidth < 760) { setState(foot, 'min'); return; }
    var any = main || !!(foot && foot.state === 'open');
    if (!any && !root.classList.contains('desk-empty') && window.innerWidth < 760) window.scrollTo(0, 0);
    root.classList.toggle('desk-empty', !any);
  }
  function toggleMax(W) {
    var m = !W.host.classList.contains('is-max');
    if (m && maxW && maxW !== W) toggleMax(maxW);
    W.host.classList.toggle('is-max', m);
    root.classList.toggle('has-max', m);
    W.maxBtn.setAttribute('aria-pressed', String(m));
    maxW = m ? W : null;
    if (m) focusW(W);
  }
  function sync(W) {
    var hidden = !!W.host.closest('[hidden]'), th = hidden || W.state === 'closed';
    if (W.task.hidden !== th) W.task.hidden = th;
    W.task.classList.toggle('is-min', W.state === 'min');
    if (W.li) { if (W.li.hidden !== hidden) W.li.hidden = hidden; W.li.querySelector('button').setAttribute('data-state', W.state); }
  }
  function arrangeAll() {
    try { sessionStorage.removeItem('pondos-pos-' + PAGE); } catch (e) {}
    wins.forEach(function (W) { W.x = W.y = 0; W.host.style.transform = ''; if (W.state !== 'open') { W.state = 'open'; W.host.classList.remove('is-min', 'is-closed'); } sync(W); });
    if (maxW) toggleMax(maxW);
    window.scrollTo({ top: 0, behavior: REDUCE ? 'auto' : 'smooth' });
    if (wins[0]) focusW(wins[0]);
  }
  function menuBar(W) {
    // File / View / Receipts / Help, each a small drop-down
    var mb = el('div', { class: 'win-menu', role: 'menubar' });
    var receipts = function () { var r = null; wins.forEach(function (w) { if (!r && (/^receipts\.log/.test(w.title) || w.host.id === 'receipts' || w.host.getAttribute('aria-labelledby') === 'sources')) r = w; }); return r; };
    var MENUS = [
      ['File', [['Minimize', function () { setState(W, 'min'); }], ['Close', function () { setState(W, 'closed'); }]]],
      ['View', [['Maximize / restore', function () { toggleMax(W); }], ['Arrange all windows', arrangeAll], ['Light or dark mode', function () { if (themeBtn) themeBtn.click(); }]]],
      ['Receipts', [['Open the sources', function () { if (book && (book.reveal('#sources') || book.reveal('#src'))) return; var r = receipts(); if (r) setState(r, 'open'); }], ['Report a mistake', 'https://github.com/PepecoinHub/pepecoinhub.github.io/issues/new?template=correction.yml']]],
      ['Help', [['Which frog is which?', 'which-pepecoin.html'], ['Glossary (Fren-to-English)', 'glossary.html'], ['About PondOS', aboutOS]]]
    ];
    MENUS.forEach(function (m) {
      var wrap = el('div', { class: 'wm' });
      var b = el('button', { type: 'button', 'aria-haspopup': 'true', 'aria-expanded': 'false' }, '<u>' + m[0].charAt(0) + '</u>' + m[0].slice(1));
      var ul = el('div', { class: 'wm-list', role: 'menu', hidden: '' });
      m[1].forEach(function (it) {
        var x = typeof it[1] === 'string' ? el('a', { href: it[1], role: 'menuitem' }, it[0]) : el('button', { type: 'button', role: 'menuitem' }, it[0]);
        if (typeof it[1] === 'function') x.addEventListener('click', function () { closeMenus(); it[1](); });
        ul.appendChild(x);
      });
      b.addEventListener('click', function (e) { e.stopPropagation(); var o = ul.hidden; closeMenus(); ul.hidden = !o; b.setAttribute('aria-expanded', String(o)); });
      wrap.appendChild(b); wrap.appendChild(ul); mb.appendChild(wrap);
    });
    return mb;
  }
  function closeMenus() { document.querySelectorAll('.wm-list:not([hidden])').forEach(function (u) { u.hidden = true; u.previousSibling.setAttribute('aria-expanded', 'false'); }); }
  document.addEventListener('click', closeMenus);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeMenus(); if (maxW) toggleMax(maxW); } });

  function windowize(host, opts) {
    opts = opts || {};
    var body = el('div', { class: 'win-body' });
    Array.prototype.slice.call(host.classList).forEach(function (c) { if (c !== 'in') body.classList.add(c); });
    while (host.firstChild) body.appendChild(host.firstChild);
    host.className = 'win-host';
    host.removeAttribute('style');
    var title = opts.title || winTitle(host, body);
    // the window's icon is its first picture, so the taskbar buttons are told apart at a glance
    var pic = body.querySelector('img:not([src$=".svg"])');
    var iconSrc = opts.icon ? ico(opts.icon) : body.classList.contains('hero') ? ico('internet') : pic ? icoFrom(pic.getAttribute('src')) : ico((APP[PAGE] || ['', 'pep-logo'])[1]);
    host.classList.add('wide'); // every window takes the full width: the pages' inner layouts need it
    var win = el('div', { class: 'win' });
    var bar = el('div', { class: 'win-bar' }, '<img src="' + iconSrc + '" alt="" width="16" height="16" loading="lazy"><span class="win-t">' + esc(title) + '</span>' +
      '<span class="win-ctl"><button type="button" class="w-min" title="Minimize">' + ICO.min + '<span class="sr">Minimize ' + esc(title) + '</span></button>' +
      '<button type="button" class="w-max" aria-pressed="false" title="Maximize">' + ICO.max + '<span class="sr">Maximize ' + esc(title) + '</span></button>' +
      '<button type="button" class="w-x" title="Close">' + ICO.x + '<span class="sr">Close ' + esc(title) + '</span></button></span>');
    win.appendChild(bar);
    var W = { host: host, win: win, bar: bar, body: body, title: title, x: 0, y: 0, state: 'open' };
    if (opts.menu) win.appendChild(menuBar(W));
    win.appendChild(body);
    if (opts.status != null) { W.status = el('div', { class: 'win-status' }, '<span>' + opts.status + '</span><span class="st-r"></span>'); win.appendChild(W.status); }
    host.appendChild(win);
    W.maxBtn = bar.querySelector('.w-max');
    var short = title.split(' - ')[0];
    W.task = el('button', { type: 'button', class: 'task', 'aria-pressed': 'false', title: title }, '<img src="' + iconSrc + '" alt="" width="16" height="16" loading="lazy"><span>' + esc(short) + '</span>');
    W.task.addEventListener('click', function () {
      if (W.state !== 'open') setState(W, 'open');
      else if (W === activeW && inView(W)) setState(W, 'min');
      else { focusW(W); reveal(W); }
    });
    if (tasks) tasks.appendChild(W.task);
    if (winList) {
      W.li = el('li', null, '<button type="button" data-state="open"><img src="' + iconSrc + '" alt="" width="16" height="16" loading="lazy"><span>' + esc(title) + '</span></button>');
      W.li.querySelector('button').addEventListener('click', function () { setOpen(false); setState(W, 'open'); });
      winList.appendChild(W.li);
    }
    bar.querySelector('.w-min').addEventListener('click', function () { setState(W, 'min'); });
    W.maxBtn.addEventListener('click', function () { toggleMax(W); });
    bar.querySelector('.w-x').addEventListener('click', function () {
      setState(W, 'closed');
      if (!closedHint) { closedHint = true; balloon('Window closed', 'Closed windows wait in Start ▸ Windows on this page. Nothing on the chain was harmed.', 'gif-040'); }
    });
    bar.addEventListener('dblclick', function (e) { if (!e.target.closest('button')) toggleMax(W); });
    win.addEventListener('pointerdown', function () { if (activeW !== W) focusW(W); });
    drag(W);
    W.idx = wins.length;
    try { var pos = JSON.parse(sessionStorage.getItem('pondos-pos-' + PAGE) || '{}')[W.idx]; if (pos && window.innerWidth >= 760) { W.x = pos[0]; W.y = pos[1]; host.style.transform = 'translate(' + pos[0] + 'px,' + pos[1] + 'px)'; } } catch (err) {}
    wins.push(W);
    return W;
  }

  // drag a window by its title bar; it leaves its place in the layout and floats where it is dropped
  function drag(W) {
    W.bar.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || e.target.closest('button') || W.host.classList.contains('is-max') || window.innerWidth < 760) return;
      e.preventDefault();
      var sx = e.clientX, sy = e.clientY, ox = W.x, oy = W.y, r = W.host.getBoundingClientRect();
      var baseL = r.left - ox, baseT = r.top + window.scrollY - oy;
      W.bar.setPointerCapture(e.pointerId);
      W.host.classList.add('dragging');
      var mv = function (ev) {
        var nx = ox + ev.clientX - sx, ny = oy + ev.clientY - sy;
        nx = Math.min(Math.max(nx, 90 - r.width - baseL), window.innerWidth - 90 - baseL);
        ny = Math.max(ny, -baseT);
        W.x = nx; W.y = ny;
        W.host.style.transform = 'translate(' + Math.round(nx) + 'px,' + Math.round(ny) + 'px)';
      };
      var up = function () {
        W.host.classList.remove('dragging');
        try { var all = JSON.parse(sessionStorage.getItem('pondos-pos-' + PAGE) || '{}'); all[W.idx] = [Math.round(W.x), Math.round(W.y)]; sessionStorage.setItem('pondos-pos-' + PAGE, JSON.stringify(all)); } catch (err) {}
        W.bar.removeEventListener('pointermove', mv); W.bar.removeEventListener('pointerup', up); W.bar.removeEventListener('pointercancel', up);
      };
      W.bar.addEventListener('pointermove', mv); W.bar.addEventListener('pointerup', up); W.bar.addEventListener('pointercancel', up);
    });
  }

  // ---------- content pages as one "book" window ----------
  var book = null;
  function secName(panel, i) {
    if (panel.classList.contains('pagehead')) return 'Overview';
    if (panel.classList.contains('pond-break')) return 'Touch grass';
    if (panel.querySelector('.gifs')) return 'Gallery';
    var lb = panel.getAttribute('aria-labelledby'), le = lb && document.getElementById(lb);
    var h = le && le.textContent.trim() ? le : panel.querySelector('h2, h3');
    var t = h ? h.textContent.replace(/\s+/g, ' ').trim() : (panel.getAttribute('aria-label') || 'Section ' + (i + 1));
    return t.length > 42 ? t.slice(0, 40) + '…' : t;
  }
  function buildBook(blocks) {
    var host = el('section', { class: 'in book' });
    mainEl.insertBefore(host, blocks[0]);
    var toc = el('nav', { class: 'toc', 'aria-label': 'Sections of this page' }), pane = el('div', { class: 'pane' });
    var pager = el('div', { class: 'pager' }, '<button type="button" class="btn pg-prev"></button><span class="pg-n"></span><button type="button" class="btn pg-next"></button>');
    var appIcon = ico((APP[PAGE] || ['', 'pep-logo'])[1]);
    var W = null;
    var secs = blocks.map(function (n, i) {
      var panel = el('div', { class: 'sec' });
      Array.prototype.slice.call(n.classList).forEach(function (c) { if (c !== 'in') panel.classList.add(c); });
      ['id', 'aria-labelledby', 'aria-label'].forEach(function (a) { if (n.getAttribute(a)) panel.setAttribute(a, n.getAttribute(a)); });
      panel.setAttribute('role', 'region');
      while (n.firstChild) panel.appendChild(n.firstChild);
      n.remove();
      pane.appendChild(panel);
      var pic = panel.querySelector('img:not([src$=".svg"])');
      var name = secName(panel, i);
      var b = el('button', { type: 'button', class: 'toc-i', 'aria-current': 'false' }, '<img src="' + (i === 0 || !pic ? appIcon : pic.getAttribute('src')) + '" alt="" width="20" height="20" loading="lazy"><span>' + esc(name) + '</span>');
      b.addEventListener('click', function () { show(i, true); });
      toc.appendChild(b);
      return { panel: panel, b: b, name: name };
    });
    host.appendChild(toc); host.appendChild(pane); host.appendChild(pager);
    var cur = -1;
    function show(i, user) {
      if (i < 0 || i >= secs.length) return;
      cur = i;
      secs.forEach(function (s, k) {
        var on = k === i;
        s.panel.classList.toggle('off', !on);
        if (on) s.panel.removeAttribute('inert'); else s.panel.setAttribute('inert', '');
        s.b.setAttribute('aria-current', on ? 'true' : 'false');
      });
      var prev = pager.querySelector('.pg-prev'), next = pager.querySelector('.pg-next');
      prev.disabled = i === 0; next.disabled = i === secs.length - 1;
      prev.textContent = i > 0 ? '◀ ' + secs[i - 1].name : '◀ Back';
      next.textContent = i < secs.length - 1 ? secs[i + 1].name + ' ▶' : 'Next ▶';
      pager.querySelector('.pg-n').textContent = (i + 1) + ' / ' + secs.length;
      if (W && W.status) W.status.querySelector('span').textContent = secs[i].name + ' (' + (i + 1) + ' of ' + secs.length + ')';
      if (user) {
        var id = secs[i].panel.id;
        try { history.replaceState(null, '', id ? '#' + id : location.pathname + location.search); } catch (e) {}
        var r = host.getBoundingClientRect();
        if (r.top < 0 || r.top > window.innerHeight * 0.5) host.scrollIntoView({ block: 'start', behavior: REDUCE ? 'auto' : 'smooth' });
      }
    }
    pager.querySelector('.pg-prev').addEventListener('click', function () { show(cur - 1, true); });
    pager.querySelector('.pg-next').addEventListener('click', function () { show(cur + 1, true); });
    // links to #something inside a hidden section open that section first
    var reveal = function (hash) {
      var t = hash && hash.length > 1 && document.getElementById(decodeURIComponent(hash.slice(1)));
      if (!t) return false;
      for (var k = 0; k < secs.length; k++) if (secs[k].panel.contains(t)) { show(k, false); setTimeout(function () { t.scrollIntoView({ block: 'start' }); }, 30); return true; }
      return false;
    };
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (a && a.getAttribute('href').length > 1 && reveal(a.getAttribute('href'))) e.preventDefault();
    });
    window.addEventListener('hashchange', function () { reveal(location.hash); });
    var h1 = secs[0].panel.querySelector('h1');
    W = windowize(host, { menu: true, status: '', wide: true, title: (APP[PAGE] || ['PEP.exe'])[0] + ' - ' + (h1 ? h1.textContent.replace(/\s+/g, ' ').trim().split(/[.?:!]/)[0] : 'Pepecoin'), icon: (APP[PAGE] || ['', 'pep-logo'])[1] });
    book = { show: show, reveal: reveal, secs: secs };
    if (!reveal(location.hash)) show(0, false);
  }

  var mainEl = document.querySelector('main');
  if (mainEl) {
    root.classList.add('pondos');
    // blocks are direct children of <main>, or one level down inside a wrapper such as the rich list's #app
    var blocks = Array.prototype.slice.call(mainEl.querySelectorAll(':scope > section.in, :scope > div.in, :scope > aside.in, :scope > div:not(.in) > section.in'));
    if (PAGE !== 'index' && blocks.length > 2) {
      // a content page is one program window: a contents list on the left, one section at a time on the right
      buildBook(blocks.filter(function (n) { return !n.classList.contains('loading'); }));
    } else blocks.forEach(function (n) {
      var lead = n.classList.contains('hero') || n.classList.contains('pagehead');
      windowize(n, lead ? { menu: true, status: 'Every number keeps its receipt.' } : null);
    });
    var fin = document.querySelector('footer.foot > div');
    if (fin) windowize(fin, { title: 'About Pepecoin Hub', icon: 'pep-logo', wide: true });
    // one program opens one window: the "About Pepecoin Hub" window waits on the taskbar until it is clicked
    wins.forEach(function (w) { if (w.host.closest('footer') && w.state === 'open') { w.state = 'min'; w.host.classList.add('is-min'); } });
    // a hidden wrapper (the rich list before its data arrives, the frog chooser) hides its taskbar buttons too
    new MutationObserver(function () { wins.forEach(sync); }).observe(mainEl, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
    wins.forEach(sync);
    // the README status bar shows the latest block from the daily snapshot
    json('network.json').then(function (n) {
      var b = 'Block ' + fmt.int(n.rows[n.rows.length - 1][1]);
      wins.forEach(function (W) { if (W.status) W.status.querySelector('.st-r').textContent = b; });
    }).catch(function () {});
    // the meme home starts like a fresh desktop: only the welcome window is open; the rest are closed
    // (no taskbar clutter) and wait in the "Explore the pond" row inside the welcome window
    if (PAGE === 'index') {
      var hero = null;
      wins.forEach(function (w) { if (w.body.classList.contains('hero')) hero = w; });
      if (hero) {
        var row = el('div', { class: 'win-launch' }, '<p>Looking for facts? Open a window:</p>');
        wins.forEach(function (w) {
          if (w === hero || w.body.classList.contains('chooser')) return;
          w.host.classList.remove('is-min'); w.state = 'closed'; w.host.classList.add('is-closed'); sync(w);
          var b = el('button', { type: 'button', class: 'btn' }, '<img src="' + w.task.querySelector('img').getAttribute('src') + '" alt="" width="16" height="16"> ' + esc(w.title.split(' - ')[0]));
          b.addEventListener('click', function () { setState(w, 'open'); });
          row.appendChild(b);
        });
        var ctas = hero.body.querySelector('.pond-do') || hero.body.querySelector('.ctas');
        if (ctas) ctas.parentNode.insertBefore(row, ctas.nextSibling); else hero.win.insertBefore(row, hero.status || null);
      }
    }
    var first = null; wins.forEach(function (w) { if (!first && w.state === 'open' && !w.host.closest('[hidden]')) first = w; });
    focusW(first);
    // "Show desktop" at the end of the tray: minimizes every window to see the wallpaper, a second click brings them back
    var trayEl = document.querySelector('.tray');
    if (trayEl) {
      var peek = el('button', { type: 'button', class: 'show-desk', title: 'Show desktop', 'aria-pressed': 'false' }, '<span class="sr">Show desktop</span>');
      var hiddenByPeek = [];
      peek.addEventListener('click', function () {
        if (hiddenByPeek.length) { hiddenByPeek.forEach(function (w) { if (w.state === 'min') setState(w, 'open'); }); hiddenByPeek = []; peek.setAttribute('aria-pressed', 'false'); root.classList.remove('desk-view'); return; }
        wins.forEach(function (w) { if (w.state === 'open' && !w.host.closest('[hidden]')) { hiddenByPeek.push(w); setState(w, 'min'); } });
        peek.setAttribute('aria-pressed', 'true');
        root.classList.add('desk-view');   // the desktop icons show on every page, also on a phone
        window.scrollTo(0, 0);
        if (window.innerWidth < 760) balloon('Desktop', 'Your windows are minimized. Tap the green bar again to bring them back.', 'pep-logo');
      });
      trayEl.parentNode.appendChild(peek);
    }
  }

  var DESK_ACT = {};   // the desktop icon actions, also used by Find
  // ---------- desktop icons ----------
  // with a mouse: click selects, double-click opens, drag moves (remembered); on touch a tap opens
  if (mainEl) {
    // two groups, one column each on a wide screen (anchored at the bottom, by the Start button);
    // the numbers and tools live in the "Nerds only" folder, and the Recycle Bin sits in the bottom-right corner
    var NERDS = [['price.html', 'Price.exe', 'charts'], ['rich-list.html', 'Whale watch', 'detective'], ['calculator.html', 'What-if machine', 'p-eyes-still'],
      ['wallets.html', 'Wallets', 'zipper'], ['mining.html', 'Mining', 'pickaxe'], ['#addr', 'AddressCheck.exe', 'pepe-search'], ['#notpep', 'Not PEP (0x)', 'wrongpep'], ['#nerdreadme', 'README_NERD.txt', 'news']];
    // wide screens: from the top-left corner, Log On alone, a gap, then the games in two columns;
    // the rest of the pond in a small group lower down, NERDS ONLY on its own by the Start button, the bin far right
    var DESKTOP = [
      ['logon', [['#logon', 'Log On', 'pep-logo'], ['#find', 'Find', 'search']]],
      ['play', [['#wp', "Pepe Guesser", 'wp-folder'], ['#frog', 'FROGAGEDDON', 'pondwars'], ['#lan', 'LAN Party', 'gif-080-still'], ['#games', 'Games', 'games-folder'],
        ['#tv', 'Pond TV', 'pond-tv'], ['#ads', 'PEP-TV Ads', 'pep-tv-ads']]],
      ['pond', [['./', 'Internet', 'internet'], ['#shop', 'Shop', 'shop-bag'], ['#mail', 'Write a letter', 'frog-mail']]],
      // the community: our subreddit and the official Pepecoin account (the classic bird), next to NERDS ONLY above the taskbar
      ['nerds', [['#nerds', 'NERDS ONLY', 'nerds-folder'], ['#reddit', 'r/pepecoin', 'reddit'], ['#twitter', 'Twitter', 'twitter-bird']]],
      ['bin', [['#bin', 'Recycle Bin', 'recycle-bin']]]
    ];
    var ACT = { '#wp': wpFolder, '#frog': function () { pondWarsApp(); }, '#addr': addressCheck, '#ads': adsFolder, '#shop': function () { window.open(SHOP, '_blank', 'noopener'); }, '#reddit': function () { window.open('https://www.reddit.com/r/pepecoin/', '_blank', 'noopener'); }, '#twitter': function () { window.open('https://x.com/PepecoinNetwork', '_blank', 'noopener'); }, '#logon': logOn, '#tv': pondTV, '#lan': lanParty, '#paint': function () { drawGuess(); }, '#games': gamesFolder, '#tip': aboutMe, '#mail': function () { frogMail('write'); }, '#fud': invaders, '#snake': snake, '#bin': paperHands, '#notpep': function () {
      osDialog('Not PEP (0x) - Properties', '<div class="dlg-row"><img src="img/gif-029.webp" alt="" width="96" height="96"><div><h3>Same name, different frogs.</h3><p>These assets share the name. None of them is PEP:</p><ul class="dlg-list"><li><b>PEPE</b>: an ERC-20 token on Ethereum since April 2023. Address starts with 0x.</li><li><b>PEPECOIN</b> (PepeCoin / Memetic): from March 2016, a token on Ethereum since 2023. Address starts with 0x.</li></ul><p><b>PEP</b> has its own blockchain, and its addresses start with P.</p></div></div>',
        [{ label: 'Full side-by-side…', go: true, href: 'which-pepecoin.html#compare' }, { label: 'OK' }], 'wrongpep');
    } };
    ACT['#nerds'] = function () {
      openApp('nerds', 'C:\\Pond\\NERDS ONLY', 'nerds-folder', function (A) {
        A.body.innerHTML = '<ul class="folder">' + NERDS.map(function (d, i) { return '<li><button type="button" data-i="' + i + '"><img src="' + ico(d[2]) + '" alt="" width="40" height="40"><span>' + d[1] + '</span></button></li>'; }).join('') + '</ul>' +
          '<p class="bin-tip">Charts, whales, math and receipts. Glasses recommended, pocket protector optional.</p>';
        A.body.querySelectorAll('.folder button').forEach(function (b) {
          var d = NERDS[+b.getAttribute('data-i')], go = function () { if (ACT[d[0]]) ACT[d[0]](); else location.href = d[0]; };
          b.addEventListener('dblclick', go);
          b.addEventListener('click', function () { if (!matchMedia('(hover: hover) and (pointer: fine)').matches) go(); else { A.body.querySelectorAll('.folder .sel').forEach(function (x) { x.classList.remove('sel'); }); b.classList.add('sel'); } });
          b.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } });
        });
      }, 520);
    };
    // README_NERD.txt: reading the fine print in NERDS ONLY finds the secret "Nerds Only" (the Nerd avatar)
    ACT['#nerdreadme'] = function () {
      openApp('nerdreadme', 'README_NERD.txt - Notepad', 'nerds-folder', function (A) {
        A.body.innerHTML = '<div class="win-menu notepad-menu"><span>File</span><span>Edit</span><span>Search</span><span>Help</span></div><pre class="notepad"></pre>';
        A.body.querySelector('.notepad').textContent = ['README_NERD.TXT', '', 'You opened the folder AND the readme.', 'Respect, fren. Nobody reads the readme.', '',
          'Facts for the road:', '  PEP is its own proof-of-work chain (Scrypt, merge-mined with LTC and DOGE).', '  The supply schedule is in the code, not in a promise.',
          '  Every number in this folder comes from the chain or a public API.', '', 'Glasses on. Pocket protector optional.'].join('\n');
      }, 440);
      discoverSecret('nerd_alert');
    };
    ACT['#find'] = function () { finder(); };
    DESK_ACT = ACT;
    var desk = el('nav', { class: 'desk', 'aria-label': 'Desktop' });
    desk.innerHTML = '<div class="icon-groups">' + DESKTOP.map(function (g) {
      return '<div class="icon-group g-' + g[0] + '"><ul class="icons">' + g[1].map(function (d) { return '<li' + (d[0] === '#bin' ? ' class="bin-li"' : '') + '><a href="' + d[0] + '" data-id="' + esc(d[1]) + '"><img src="' + ico(d[2]) + '" alt="" width="40" height="40"><span>' + d[1] + '</span></a></li>'; }).join('') + '</ul></div>';
    }).join('') + '</div>';
    document.body.insertBefore(desk, mainEl);
    // on a wide screen the Recycle Bin leaves its group for the bottom-right corner, above the clock
    if (window.innerWidth > 1100) { var binLi = desk.querySelector('.bin-li'); if (binLi) { var corner = el('ul', { class: 'icons desk-corner', 'aria-label': 'Recycle Bin' }); corner.appendChild(binLi); document.body.appendChild(corner); } }
    var lanIcon = desk.querySelector('a[href="#lan"]');
    if (lanIcon) lanIcon.insertAdjacentHTML('beforeend', '<span class="lan-badge icon-badge" hidden><span class="lan-dot" aria-hidden="true"></span><span class="lan-n"></span></span>');
    var FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
    var iconPos = {}; try { iconPos = JSON.parse(localStorage.getItem('pondos-icons4') || '{}'); } catch (e) {}
    var openIcon = function (a) { var h = a.getAttribute('href'); if (ACT[h]) ACT[h](); else location.href = a.href; };
    document.querySelectorAll('.desk .icons a, .desk-corner a').forEach(function (a) {
      var id = a.getAttribute('data-id'), p = iconPos[id];
      if (p && (Math.abs(p[0]) > 300 || Math.abs(p[1]) > 1200)) { delete iconPos[id]; p = null; }
      if (p && FINE && window.innerWidth > 1100) a.style.transform = 'translate(' + p[0] + 'px,' + p[1] + 'px)';
      var moved = false;
      a.addEventListener('click', function (e) {
        e.preventDefault();
        if (moved) { moved = false; return; }
        if (!FINE) { openIcon(a); return; }
        document.querySelectorAll('.desk .sel, .desk-corner .sel').forEach(function (x) { x.classList.remove('sel'); }); a.classList.add('sel');
      });
      a.addEventListener('dblclick', function (e) { e.preventDefault(); openIcon(a); });
      a.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); openIcon(a); } });
      if (!FINE) return;
      // no native link/image dragging: it would steal the pointer (a ghost picture, then the icon stops following)
      a.setAttribute('draggable', 'false'); a.querySelector('img').setAttribute('draggable', 'false');
      a.addEventListener('dragstart', function (e) { e.preventDefault(); });
      a.addEventListener('pointerdown', function (e) {
        if (e.button !== 0 || window.innerWidth <= 1100 || a.parentNode.classList.contains('bin-li')) return;
        e.preventDefault();   // no text selection while dragging
        var sx = e.clientX, sy = e.clientY, base = iconPos[id] || [0, 0], cur = base;
        // icons stay on the desktop strip: the big window covers the rest, and an icon under it could not be grabbed again
        var r0 = a.getBoundingClientRect(), x0 = r0.left - base[0], y0 = r0.top - base[1], dr = desk.getBoundingClientRect();
        var left = dr.left, right = Math.max(dr.left, dr.right - r0.width), top = Math.max(0, dr.top);
        var bottom = Math.min(window.innerHeight - 44, dr.bottom) - r0.height;   // and above the taskbar
        try { a.setPointerCapture(e.pointerId); } catch (err) {}
        var mv = function (ev) {
          var dx = ev.clientX - sx, dy = ev.clientY - sy;
          if (!moved && Math.abs(dx) + Math.abs(dy) < 6) return;
          moved = true; a.classList.add('dragging');
          cur = [Math.round(Math.max(left - x0, Math.min(base[0] + dx, right - x0))),
            Math.round(Math.max(top - y0, Math.min(base[1] + dy, bottom - y0)))];
          a.style.transform = 'translate(' + cur[0] + 'px,' + cur[1] + 'px)';
        };
        var up = function () {
          a.removeEventListener('pointermove', mv); a.removeEventListener('pointerup', up); a.removeEventListener('pointercancel', up);
          a.classList.remove('dragging');
          if (moved) { iconPos[id] = cur; try { localStorage.setItem('pondos-icons4', JSON.stringify(iconPos)); } catch (err) {} a.focus({ preventScroll: true }); }
        };
        a.addEventListener('pointermove', mv); a.addEventListener('pointerup', up); a.addEventListener('pointercancel', up);
      });
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('.desk, .desk-corner')) document.querySelectorAll('.desk .sel, .desk-corner .sel').forEach(function (x) { x.classList.remove('sel'); }); });
  }

  // ---------- tray: price, hashrate, clock ----------
  var clock = document.querySelector('.tray-clock');
  if (clock) {
    var tick = function () { var d = new Date(); clock.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); clock.setAttribute('datetime', d.toISOString()); };
    tick(); setInterval(tick, 20000);
  }
  var trayPrice = document.querySelector('.tray-price'), trayHash = document.querySelector('.tray-hash');
  if (trayPrice && window.PepPrices) window.PepPrices.subscribeQuote(function () {
    return window.PepPrices.pepQuote().then(function (q) {
      if (!q || q.usd == null) return;
      trayPrice.innerHTML = 'PEP ' + fmt.usd(q.usd) + (q.change_24h == null ? '' : ' <span class="' + (q.change_24h < 0 ? 'dn">▼' : 'up">▲') + fmt.pct(Math.abs(q.change_24h)) + '</span>');
      trayPrice.title = 'PEP price, ' + window.PepPrices.describe(q, 'en-US') + '. Click for the Laptop Index.';
      trayPrice.hidden = false;
    }).catch(function () {});
  });
  if (trayPrice) { trayPrice.setAttribute('role', 'button'); trayPrice.setAttribute('tabindex', '0'); trayPrice.addEventListener('click', function () { laptop(); }); trayPrice.addEventListener('keydown', function (e) { if (e.key === 'Enter') laptop(); }); }
  if (trayHash) json('ticker.json').then(function (t) { if (t.hashrate) { trayHash.textContent = fmt.hash(t.hashrate.hs); trayHash.title = 'Network hashrate'; trayHash.hidden = false; } }).catch(function () {});

  // ---------- right-click on the desktop ----------
  // only on the wallpaper itself; inside windows the browser's own menu stays
  var ctx = null;
  function closeCtx() { if (ctx) { ctx.remove(); ctx = null; } }
  // a click on the empty wallpaper minimizes the open windows (with a mouse; on a touch screen a tap
  // next to a window while scrolling would hide it by accident). The taskbar brings them back.
  var wallTipShown = false;
  document.addEventListener('click', function (e) {
    if (!mainEl || e.button || !matchMedia('(hover: hover) and (pointer: fine)').matches || window.innerWidth < 761) return;
    if (e.target.closest('.win, .desk, header.top, dialog, a, button, input, select, textarea, label, .ctx, .balloon, .boot, .os-dlg, .saver, .safe-off, [role=menu]')) return;
    var sel = window.getSelection && String(window.getSelection()); if (sel) return;
    var open = wins.filter(function (w) { return w.state === 'open' && !w.host.closest('[hidden]'); });
    if (!open.length) return;
    open.forEach(function (w) { setState(w, 'min'); });
    if (!wallTipShown) { wallTipShown = true; balloon('Windows minimized', 'You clicked the wallpaper. Your windows wait on the taskbar: click one to bring it back.', 'pep-logo'); }
  });
  document.addEventListener('contextmenu', function (e) {
    if (!mainEl || e.target.closest('.win, .desk a, .desk button, header.top, dialog, a, button, input')) return;
    e.preventDefault(); closeCtx(); closeMenus();
    var dark = root.getAttribute('data-theme') ? root.getAttribute('data-theme') === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    ctx = el('div', { class: 'ctx', role: 'menu' });
    [['Arrange windows', arrangeAll], ['Refresh', function () { location.reload(); }], null,
      [dark ? 'Wallpaper: day hills' : 'Wallpaper: night mountains', function () { if (themeBtn) themeBtn.click(); }],
      ['Screensaver preview', function () { saver(true); }], ['Line up icons', function () { try { localStorage.removeItem('pondos-icons4'); } catch (e) {} document.querySelectorAll('.icons a').forEach(function (a) { a.style.transform = ''; }); }],
      null, ["Pepe Guesser (today's photo)", function () { wheresPepe(); }], ['FROGAGEDDON (beta)', function () { pondWarsApp(); }], ['YEET THE PEP', function () { yeetApp(); }], ['Pepe Miner', function () { minerApp(); }], null, ['LEADERS', function () { highScores(); }], ['Properties…', aboutOS]].forEach(function (it) {
      if (!it) { ctx.appendChild(el('hr')); return; }
      var b = el('button', { type: 'button', role: 'menuitem' }, it[0]);
      b.addEventListener('click', function () { closeCtx(); it[1](); });
      ctx.appendChild(b);
    });
    document.body.appendChild(ctx);
    var w = ctx.offsetWidth, h = ctx.offsetHeight;
    ctx.style.left = Math.min(e.clientX, window.innerWidth - w - 4) + 'px';
    ctx.style.top = Math.min(e.clientY, window.innerHeight - h - 50) + 'px';
    ctx.querySelector('button').focus();
  });
  document.addEventListener('click', closeCtx);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeCtx(); });
  window.addEventListener('scroll', closeCtx, { passive: true });

  // ---------- the clock opens a small date window with chain facts ----------
  if (clock) {
    clock.setAttribute('tabindex', '0'); clock.setAttribute('role', 'button'); clock.setAttribute('title', 'Date and time');
    var openClock = function () {
      var now = new Date(), born = Date.UTC(2024, 0, 30), days = Math.floor((now - born) / 86400000);
      osDialog('Date and Time Properties', '<div class="dlg-row"><img src="img/gif-075.webp" alt="" width="96" height="68"><div><h3>' + now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + '</h3>' +
        '<p>Your clock says ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '. The Pepecoin chain keeps its own time: it aims for one block every 60 seconds.</p>' +
        '<p>Pepecoin launched on January 30, 2024, <b>' + fmt.int(days) + ' days</b> ago.</p><p class="src">Launch date: <a href="https://pepecoin.com/mica-whitepaper.xhtml">MiCA whitepaper</a></p></div></div>', [{ label: 'OK', go: true }]);
    };
    clock.addEventListener('click', openClock);
    clock.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openClock(); } });
  }

  // ---------- screensaver: after two idle minutes a PEP coin bounces around ----------
  var saverEl = null, idleT = null;
  function saver(force) {
    if (saverEl || (!force && (REDUCE || document.hidden || maxW || document.querySelector('dialog[open]')))) return;
    // a random frog from the meme collection bounces around, like the old DVD logo
    var FROGS = ['big-eyes', 'believe', 'chonk', 'cowboy', 'detective', 'diamond', 'gibup', 'farmer', 'born-to-fren', 'brain', 'gif-034-still', 'gif-071-still', 'gif-045-still', 'gif-085-still',
      'chars/balloons', 'chars/juicebox', 'chars/brb', 'chars/chonky', 'chars/comfy', 'chars/explorer', 'chars/backpack'];
    var pick = FROGS[Math.floor(Math.random() * FROGS.length)];
    // around local midnight (23:30-00:30) the screensaver finds the secret "Midnight Fren" (the Vampire avatar)
    var now = new Date(), mins = now.getHours() * 60 + now.getMinutes();
    if (mins >= 23 * 60 + 30 || mins <= 30) discoverSecret('midnight_fren');
    saverEl = el('div', { class: 'saver', 'aria-hidden': 'true' }, '<img class="sv-frog' + (pick.indexOf('chars/') === 0 ? ' cut' : '') + '" src="img/' + pick + '.webp" alt=""><p>PondOS is resting. Move the mouse, fren.</p>');
    document.body.appendChild(saverEl);
    var coin = saverEl.querySelector('.sv-frog'), x = 40, y = 40, dx = 2.2, dy = 1.7, raf;
    var step = function () {
      var W = window.innerWidth - coin.offsetWidth, H = window.innerHeight - coin.offsetHeight;
      x += dx; y += dy;
      if (x < 0 || x > W) { dx = -dx; x = Math.max(0, Math.min(x, W)); }
      if (y < 0 || y > H) { dy = -dy; y = Math.max(0, Math.min(y, H)); }
      coin.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    var wake = function () { cancelAnimationFrame(raf); if (saverEl) { saverEl.remove(); saverEl = null; } ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (t) { window.removeEventListener(t, wake, true); }); };
    setTimeout(function () { ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (t) { window.addEventListener(t, wake, true); }); }, 400);
  }
  if (mainEl && !REDUCE && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    var poke = function () { clearTimeout(idleT); idleT = setTimeout(saver, 120000); };
    ['pointermove', 'pointerdown', 'keydown', 'wheel', 'scroll'].forEach(function (t) { window.addEventListener(t, poke, { passive: true }); });
    poke();
  }

  /* ================================================================ PondOS 98 apps
     Floating windows for the mini games and the Paper hands bin, plus the easter eggs. */
  var apps = {}, appZ = 200, activeApp = null;
  function openApp(id, title, icon, build, width) {
    if (apps[id]) { if (apps[id].host.classList.contains('is-min')) apps[id].restore(); else focusApp(apps[id]); return apps[id]; }
    var host = el('div', { class: 'app-win', role: 'dialog', 'aria-label': title });
    if (width) host.style.width = 'min(' + width + 'px, calc(100vw - 16px))';
    host.innerHTML = '<div class="win active"><div class="win-bar"><img src="' + ico(icon) + '" alt="" width="16" height="16"><span class="win-t">' + esc(title) + '</span><span class="win-ctl"><button type="button" class="w-min" title="Minimize">' + ICO.min + '<span class="sr">Minimize ' + esc(title) + '</span></button><button type="button" class="w-full" title="Full screen">' + ICO.max + '<span class="sr">Full screen ' + esc(title) + '</span></button><button type="button" class="w-x" title="Close">' + ICO.x + '<span class="sr">Close ' + esc(title) + '</span></button></span></div><div class="app-body"></div></div>';
    document.body.appendChild(host);
    var A = { id: id, host: host, body: host.querySelector('.app-body'), stop: null };
    var n = Object.keys(apps).length;
    host.style.top = (50 + n * 28) + 'px'; host.style.setProperty('--app-top', (50 + n * 28) + 'px');
    if (window.innerWidth > 760) { host.style.left = Math.max(8, (window.innerWidth - host.offsetWidth) / 2 + n * 28) + 'px'; host.style.transform = 'none'; }
    A.close = function () { if (A.stop) A.stop(); if (A.taskBtn) A.taskBtn.remove(); host.remove(); delete apps[id]; if (activeApp === A) activeApp = null; };
    host.querySelector('.w-x').addEventListener('click', A.close);
    // full screen: a small window grows to fill the desktop (above the taskbar); a window that is already that big
    // (Pepe Miner, YEET THE PEP) goes to the browser's real full screen. The same button, or a double click
    // on the title bar, brings it back.
    A.full = function () {
      var fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      if (fsEl === host) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
      if (host.classList.contains('is-max')) { host.classList.remove('is-max'); window.dispatchEvent(new Event('resize')); return; }
      if (!host.classList.contains('app-full')) { host.classList.add('is-max'); window.dispatchEvent(new Event('resize')); focusApp(A); return; }
      var go = host.requestFullscreen || host.webkitRequestFullscreen;
      if (go) { try { var pr = go.call(host); if (pr && pr.catch) pr.catch(function () {}); } catch (e) {} }
    };
    host.querySelector('.w-full').addEventListener('click', A.full);
    // dragging the corner (CSS resize) gives the window a fixed height: then its content fills it
    if (window.ResizeObserver) new ResizeObserver(function () { host.classList.toggle('is-sized', !!host.style.height && !host.classList.contains('is-max')); }).observe(host);
    // minimize: the window hides and waits as a button on the taskbar (also on a phone); the game keeps its state
    // games: a minimized window (however it got minimized) pauses; it goes on when it comes back.
    // An app sets A.pause / A.resume; iframes get a 'pause' message (see pauseFrames).
    new MutationObserver(function () {
      var min = host.classList.contains('is-min');
      if (min === !!A._minPaused) return;
      A._minPaused = min;
      if (min) { if (A.pause) A.pause(); pauseFrames(host); } else if (A.resume && !document.hidden) A.resume();
    }).observe(host, { attributes: true, attributeFilter: ['class'] });
    A.restore = function () { host.classList.remove('is-min'); if (A.taskBtn) { A.taskBtn.remove(); A.taskBtn = null; } focusApp(A); };
    host.querySelector('.w-min').addEventListener('click', function () {
      host.classList.add('is-min'); if (activeApp === A) activeApp = null;
      if (tasks && !A.taskBtn) {
        A.taskBtn = el('button', { type: 'button', class: 'task app-task', title: title }, '<img src="' + ico(icon) + '" alt="" width="16" height="16"><span>' + esc(title) + '</span>');
        A.taskBtn.addEventListener('click', A.restore);
        tasks.appendChild(A.taskBtn);
      }
    });
    host.addEventListener('pointerdown', function () { focusApp(A); });
    // drag by the title bar
    var bar = host.querySelector('.win-bar');
    bar.addEventListener('dblclick', function (e) { if (!e.target.closest('button')) A.full(); });
    bar.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || e.target.closest('button') || host.classList.contains('is-max') || host.classList.contains('app-full')) return;
      e.preventDefault();
      var r = host.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
      host.style.transform = 'none'; host.style.left = r.left + 'px';
      bar.setPointerCapture(e.pointerId);
      var mv = function (ev) {
        host.style.left = Math.min(Math.max(ev.clientX - sx, 60 - r.width), window.innerWidth - 60) + 'px';
        host.style.top = Math.min(Math.max(ev.clientY - sy, 0), window.innerHeight - 70) + 'px';
      };
      var up = function () { bar.removeEventListener('pointermove', mv); bar.removeEventListener('pointerup', up); };
      bar.addEventListener('pointermove', mv); bar.addEventListener('pointerup', up);
    });
    apps[id] = A;
    build(A);
    focusApp(A);
    return A;
  }
  function focusApp(A) { appZ += 1; A.host.style.zIndex = appZ; activeApp = A; }
  function gameKeys(A, map) {
    var on = function (down) { return function (e) { if (activeApp !== A || !(e.key in map)) return; if (e.target.closest && e.target.closest('input, textarea')) return; e.preventDefault(); map[e.key](down); }; };
    var kd = on(true), ku = on(false);
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    return function () { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }
  function hiScore(key, v) { try { var o = +localStorage.getItem(key) || 0; if (v != null && v > o) { localStorage.setItem(key, v); return v; } return o; } catch (e) { return v || 0; } }
  function drawCoin(c, x, y, r) {
    c.fillStyle = '#2f9a4c'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    c.strokeStyle = '#0d3b1c'; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#fff'; c.font = 'bold ' + Math.round(r * 1.3) + 'px Tahoma, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('P', x, y + 1);
  }

  // ---------- FUD Invaders: receipts versus FUD ----------
  // an embedded game (Miner, YEET, Sweeper, POND WARS…) is told to pause; each one already listens for its own message
  function pauseFrames(host) {
    host.querySelectorAll('iframe').forEach(function (f) {
      try { ['pondwars-pause', 'pepe-sweeper-pause', 'pause'].forEach(function (m) { f.contentWindow.postMessage(m, location.origin); }); } catch (e) {}
    });
  }
  // a hidden tab pauses every game; when the tab comes back, the ones that are not minimized go on
  document.addEventListener('visibilitychange', function () {
    Object.keys(apps).forEach(function (k) {
      var A = apps[k]; if (!A) return;
      if (document.hidden) { if (A.pause) A.pause(); }
      else if (A.resume && !A.host.classList.contains('is-min')) A.resume();
    });
  });
  // ---------- "Today in the pond": the daily Pepe Guesser right on the first screen (home page only) ----------
  if (mainEl && PAGE === 'index') (function () {
    var ctas = document.querySelector('.ctas'); if (!ctas) return;
    var card = el('div', { class: 'today-pond', role: 'region', 'aria-label': 'Today in the pond' },
      '<img src="img/wp-pepe.webp" alt="" width="64" height="60"><div><b>Today in the pond: Pepe Guesser</b>' +
      '<span class="tp-line">A new photo every day. Find Pepe on the map in 2 minutes and get some free PEP.</span><span class="tp-stats"></span></div>' +
      '<button type="button" class="btn go tp-play">Play today\u2019s photo \u2192</button>');
    ctas.parentNode.insertBefore(card, ctas.nextSibling);
    card.querySelector('.tp-play').addEventListener('click', function () { wheresPepe(); });
    // "Click around": the pond is more than one page. Five big doors right under today's game.
    var doors = el('div', { class: 'pond-do', role: 'group', 'aria-label': 'Things to do in the pond' }, '<p>Click, check, search. It is a whole pond in here:</p>');
    [['newspaper-still', 'Read the Gazette', 'The pond\u2019s own newspaper', function () { frogMail('gz'); }],
      ['gif-080-still', 'Drop by the LAN Party', 'Say gm in the chat', function () { lanParty(); }],
      ['games-folder', 'Play something', 'Snake, Chess, YEET and more', function () { gamesFolder(); }],
      ['pepe-search', 'Check an address', 'PEP or the wrong frog?', function () { addressCheck(); }],
      ['leaders', 'See the LEADERS', 'Every top 10 in one place', function () { highScores(); }],
      ['search', 'Find anything', 'Games, pages, tools', function () { finder(); }]].forEach(function (d) {
      var b = el('button', { type: 'button', class: 'pd-door' }, '<img src="' + ico(d[0]) + '" alt="" width="36" height="36" loading="lazy"><span><b>' + d[1] + '</b><small>' + d[2] + '</small></span>');
      b.addEventListener('click', d[3]);
      doors.appendChild(b);
    });
    card.parentNode.insertBefore(doors, card.nextSibling);
    var stats = card.querySelector('.tp-stats'), bits = [];
    var paint = function () { stats.textContent = bits.filter(Boolean).join(' \u00b7 '); };
    setTimeout(function () {   // after the rest of this file has set up the Supabase address
      rpc('gry_wp_count').then(function (c) { if (c && c.players) { bits[0] = '\ud83d\udc38 ' + c.players + (c.players === 1 ? ' player' : ' players') + ' today'; paint(); } }, function () {});
      rpc('gry_wp_top', { p_scope: 'day' }).then(function (rows) { var lead = (rows || []).filter(function (x) { return !x.hidden; })[0]; if (lead) { bits[1] = '\ud83c\udfc6 ' + lead.nick + ' leads with ' + Number(lead.points).toLocaleString('en-US'); paint(); } }, function () {});
    }, 0);
  })();
  function invaders() {
    openApp('fud', 'FUD Invaders - receipts vs FUD', 'gif-008-still', function (A) {
      A.body.innerHTML = '<canvas width="480" height="360" aria-label="FUD Invaders. Move with the arrow keys and fire receipts with Space."></canvas>' +
        '<div class="app-row"><span class="grow fd-msg">Arrows or A/D to move, Space to fire receipts. Click to start.</span><button type="button" class="app-btn fd-again" hidden>▶ Play again</button><span class="fd-hi"></span></div>' +
        '<div class="app-row touch-pad"><button type="button" class="app-btn" data-k="left">◀</button><button type="button" class="app-btn" data-k="right">▶</button><button type="button" class="app-btn" data-k="fire">Fire receipt</button></div>';
      var cv = A.body.querySelector('canvas'), c = cv.getContext('2d'), msg = A.body.querySelector('.fd-msg'), hiEl = A.body.querySelector('.fd-hi');
      var W = 480, H = 360, WORDS = ['FUD', 'SCAM', 'RUG', 'DM ME', 'SEED?', '100x!!', 'FAKE', 'PUMP'];
      var ship = new Image(); ship.src = 'img/pep-logo.webp';
      var st, keys = { left: 0, right: 0 }, raf, running = false, overAt = 0, againB = A.body.querySelector('.fd-again');
      // after a game over a stray tap or a held Space must not wipe the score form: only Space (after a moment) or Play again restarts
      var canRestart = function (how) { return !overAt || (how === 'again') || (how === 'space' && Date.now() - overAt > 900); };
      var showHi = function () { hiEl.textContent = 'High score: ' + hiScore('pondos-fud'); };
      showHi();
      var wave = function (n) {
        var al = [];
        for (var r = 0; r < 4; r++) for (var k = 0; k < 6; k++) al.push({ x: 40 + k * 66, y: 34 + r * 34, w: 56, h: 22, t: WORDS[(r * 6 + k + n) % WORDS.length], alive: true });
        return { al: al, dir: 1, speed: 0.45 + n * 0.18, shots: [], bombs: [], cool: 0 };
      };
      var t0 = 0;
      var reset = function () { overAt = 0; againB.hidden = true; st = { x: W / 2, lives: 3, score: 0, n: 0 }; Object.assign(st, wave(0)); running = true; t0 = Date.now(); var o = A.body.querySelector('.hs-submit'); if (o) o.remove(); msg.textContent = 'Wave 1. Receipts beat FUD.'; };
      var fire = function (how) { if (!running) { if (canRestart(how)) reset(); return; } if (st.cool > 0 || st.shots.length > 2) return; st.shots.push({ x: st.x, y: H - 40 }); st.cool = 16; };
      cv.addEventListener('pointerdown', function (e) { if (!running) { if (canRestart('tap')) reset(); return; } fire(); });
      againB.addEventListener('click', function () { reset(); });
      cv.addEventListener('pointermove', function (e) { if (!running || e.pointerType === 'mouse' && !e.buttons) { if (running && e.pointerType === 'mouse') { var r0 = cv.getBoundingClientRect(); st.x = Math.min(Math.max((e.clientX - r0.left) / r0.width * W, 20), W - 20); } return; } var r = cv.getBoundingClientRect(); st.x = Math.min(Math.max((e.clientX - r.left) / r.width * W, 20), W - 20); });
      A.body.querySelectorAll('[data-k]').forEach(function (b) {
        var k = b.getAttribute('data-k');
        if (k === 'fire') b.addEventListener('pointerdown', function () { fire('tap'); });
        else { b.addEventListener('pointerdown', function () { keys[k] = 1; }); ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (t) { b.addEventListener(t, function () { keys[k] = 0; }); }); }
      });
      var unkey = gameKeys(A, { ArrowLeft: function (d) { keys.left = d; }, ArrowRight: function (d) { keys.right = d; }, a: function (d) { keys.left = d; }, d: function (d) { keys.right = d; }, ' ': function (d) { if (d) fire('space'); } });
      var end = function (text) { running = false; overAt = Date.now(); againB.hidden = false; hiScore('pondos-fud', st.score); showHi(); msg.textContent = text + ' Score ' + st.score + '. Space or Play again for a new game.'; offerSubmit(A, 'fud', st.score, Date.now() - t0); };
      var frame = function () {
        c.fillStyle = '#071009'; c.fillRect(0, 0, W, H);
        for (var i = 0; i < 40; i++) { c.fillStyle = 'rgba(180,230,190,' + (0.15 + (i % 3) * 0.1) + ')'; c.fillRect((i * 97) % W, (i * 53) % (H - 60), 2, 2); }
        if (running) {
          if (keys.left) st.x = Math.max(20, st.x - 4); if (keys.right) st.x = Math.min(W - 20, st.x + 4);
          if (st.cool > 0) st.cool--;
          var minX = W, maxX = 0, low = 0, alive = 0;
          st.al.forEach(function (a) { if (!a.alive) return; alive++; a.x += st.dir * st.speed; minX = Math.min(minX, a.x); maxX = Math.max(maxX, a.x + a.w); low = Math.max(low, a.y + a.h); });
          if (maxX > W - 6 || minX < 6) { st.dir = -st.dir; st.al.forEach(function (a) { a.y += 12; }); }
          if (Math.random() < 0.012 + st.n * 0.004) { var live = st.al.filter(function (a) { return a.alive; }); var sh = live[Math.floor(Math.random() * live.length)]; if (sh) st.bombs.push({ x: sh.x + sh.w / 2, y: sh.y + sh.h }); }
          st.shots.forEach(function (s) { s.y -= 7; st.al.forEach(function (a) { if (a.alive && s.y > a.y && s.y < a.y + a.h && s.x > a.x && s.x < a.x + a.w) { a.alive = false; s.y = -99; st.score += 10; } }); });
          st.shots = st.shots.filter(function (s) { return s.y > -10; });
          st.bombs.forEach(function (b) { b.y += 3 + st.n * 0.4; if (b.y > H - 44 && b.y < H - 20 && Math.abs(b.x - st.x) < 18) { b.y = H + 99; st.lives--; msg.textContent = st.lives > 0 ? 'Hit by FUD. ' + st.lives + ' lives left. Breathe, check the source.' : ''; } });
          st.bombs = st.bombs.filter(function (b) { return b.y < H; });
          if (st.lives <= 0) end('The FUD got through. DYOR and try again.');
          else if (low > H - 50) end('FUD reached the pond.');
          else if (!alive) { st.n++; var keep = { x: st.x, lives: st.lives, score: st.score, n: st.n }; st = Object.assign(keep, wave(st.n)); msg.textContent = 'Wave ' + (st.n + 1) + '. Receipts > FUD. The FUD gets faster, as FUD does.'; }
        }
        if (st) {
          st.al.forEach(function (a) { if (!a.alive) return; c.fillStyle = '#5a1f1a'; c.fillRect(a.x, a.y, a.w, a.h); c.strokeStyle = '#e9726a'; c.lineWidth = 1.5; c.strokeRect(a.x + 0.5, a.y + 0.5, a.w - 1, a.h - 1); c.fillStyle = '#ffd5cf'; c.font = 'bold 11px Tahoma, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(a.t, a.x + a.w / 2, a.y + a.h / 2 + 1); });
          c.fillStyle = '#fffbe0'; st.shots.forEach(function (s) { c.fillRect(s.x - 3, s.y, 6, 10); c.fillStyle = '#8a8'; c.fillRect(s.x - 2, s.y + 3, 4, 1); c.fillStyle = '#fffbe0'; });
          c.fillStyle = '#ff7a6a'; st.bombs.forEach(function (b) { c.fillRect(b.x - 2, b.y, 4, 9); });
          if (ship.complete) c.drawImage(ship, st.x - 18, H - 46, 36, 36); else drawCoin(c, st.x, H - 28, 16);
          c.fillStyle = '#7fd196'; c.font = '12px Tahoma, sans-serif'; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText('Score ' + st.score + '   Lives ' + '♥'.repeat(Math.max(0, st.lives)) + '   Wave ' + (st.n + 1), 8, 8);
        } else {
          c.fillStyle = '#7fd196'; c.font = 'bold 22px Tahoma, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText('FUD INVADERS', W / 2, H / 2 - 24); c.font = '13px Tahoma, sans-serif'; c.fillStyle = '#cfe8d4';
          c.fillText('Shoot receipts at the FUD before it reaches the pond.', W / 2, H / 2 + 6); c.fillText('Click to start', W / 2, H / 2 + 30);
        }
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
      A.stop = function () { cancelAnimationFrame(raf); raf = 0; unkey(); };
      A.pause = function () { cancelAnimationFrame(raf); raf = 0; keys.left = keys.right = 0; };
      A.resume = function () { if (!raf) raf = requestAnimationFrame(frame); };
    }, 520);
  }

  // ---------- PEP Snake: eat blocks, grow, don't fork yourself ----------
  function snake() {
    openApp('snake', 'PEP Snake - eat blocks, not your tail', 'pep-logo', function (A) {
      A.body.innerHTML = '<canvas width="480" height="360" aria-label="PEP Snake. Steer with the arrow keys or by swiping."></canvas>' +
        '<div class="app-row"><span class="grow sn-msg">Arrows, WASD or swipe to steer. Click to start.</span><button type="button" class="app-btn sn-again" hidden>▶ Play again</button><span class="sn-hi"></span></div>' +
        '<div class="app-row touch-pad"><button type="button" class="app-btn" data-k="left">◀</button><button type="button" class="app-btn" data-k="up">▲</button><button type="button" class="app-btn" data-k="down">▼</button><button type="button" class="app-btn" data-k="right">▶</button></div>';
      var cv = A.body.querySelector('canvas'), c = cv.getContext('2d'), msg = A.body.querySelector('.sn-msg'), hiEl = A.body.querySelector('.sn-hi');
      var CS = 24, CW = 20, CH = 15, face = new Image(); face.src = 'img/pep-logo.webp';
      var s = null, dir, next, food, timer = null, tickMs, overAt = 0, againB = A.body.querySelector('.sn-again');
      // after a game over only Space (after a moment) or Play again starts a new game, so the score form stays put
      var mayStart = function (how) { return !overAt || how === 'again' || (how === 'space' && Date.now() - overAt > 900); };
      var DIRS = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
      var EAT = ['Block found. +10,000 PEP (on paper).', 'Another block. The chain grows, so do you.', 'Mined. Not minted.', 'One block every ~60 seconds. You are faster.'];
      var showHi = function () { hiEl.textContent = 'Best: ' + hiScore('pondos-snake') + ' blocks'; };
      showHi();
      var place = function () { do { food = [Math.floor(Math.random() * CW), Math.floor(Math.random() * CH)]; } while (s.some(function (p) { return p[0] === food[0] && p[1] === food[1]; })); };
      var turn = function (k) { var d = DIRS[k]; if (!d || !s) return; if (d[0] === -dir[0] && d[1] === -dir[1]) return; next = d; };
      var draw = function () {
        c.fillStyle = '#071009'; c.fillRect(0, 0, 480, 360);
        c.strokeStyle = 'rgba(120,200,140,0.06)';
        for (var x = 0; x <= CW; x++) { c.beginPath(); c.moveTo(x * CS, 0); c.lineTo(x * CS, 360); c.stroke(); }
        for (var y = 0; y <= CH; y++) { c.beginPath(); c.moveTo(0, y * CS); c.lineTo(480, y * CS); c.stroke(); }
        if (!s) {
          c.fillStyle = '#7fd196'; c.font = 'bold 22px Tahoma, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText('PEP SNAKE', 240, 150); c.font = '13px Tahoma, sans-serif'; c.fillStyle = '#cfe8d4';
          c.fillText('Eat blocks. Each one is worth 10,000 PEP, on paper.', 240, 182); c.fillText('Click to start', 240, 206); return;
        }
        drawCoin(c, food[0] * CS + CS / 2, food[1] * CS + CS / 2, 9);
        for (var i = s.length - 1; i > 0; i--) { c.fillStyle = i % 2 ? '#3f9c5c' : '#4fb36d'; c.fillRect(s[i][0] * CS + 2, s[i][1] * CS + 2, CS - 4, CS - 4); }
        var h = s[0];
        if (face.complete && face.naturalWidth) c.drawImage(face, h[0] * CS - 2, h[1] * CS - 2, CS + 4, CS + 4); else drawCoin(c, h[0] * CS + CS / 2, h[1] * CS + CS / 2, 11);
        c.fillStyle = '#7fd196'; c.font = '12px Tahoma, sans-serif'; c.textAlign = 'left'; c.textBaseline = 'top';
        c.fillText('Blocks ' + (s.length - 3) + '   PEP on paper ' + fmt.int((s.length - 3) * 10000), 6, 4);
      };
      var over = function (why) {
        clearInterval(timer); timer = null;
        var blocks = s.length - 3; hiScore('pondos-snake', blocks); showHi(); offerSubmit(A, 'snake', blocks, Date.now() - t0);
        overAt = Date.now(); againB.hidden = false;
        msg.textContent = why + ' Blocks mined: ' + blocks + ' (' + fmt.int(blocks * 10000) + ' PEP, on paper). Space or Play again for a new game.';
        s = null; setTimeout(draw, 900);
      };
      var tick = function () {
        dir = next;
        var h = [s[0][0] + dir[0], s[0][1] + dir[1]];
        if (h[0] < 0 || h[1] < 0 || h[0] >= CW || h[1] >= CH) return over('Hit the edge of the pond.');
        if (s.some(function (p) { return p[0] === h[0] && p[1] === h[1]; })) return over('Ate your own tail. That is a fork.');
        s.unshift(h);
        if (h[0] === food[0] && h[1] === food[1]) {
          place(); msg.textContent = EAT[Math.floor(Math.random() * EAT.length)];
          if (tickMs > 70) { tickMs -= 4; clearInterval(timer); timer = setInterval(tick, tickMs); }
        } else s.pop();
        draw();
      };
      var t0 = 0;
      var start = function (how) { if (timer || !mayStart(how)) return false; overAt = 0; againB.hidden = true; t0 = Date.now(); var o = A.body.querySelector('.hs-submit'); if (o) o.remove(); s = [[8, 7], [7, 7], [6, 7]]; dir = next = [1, 0]; place(); tickMs = 140; msg.textContent = 'Go, fren. Blocks are coins.'; draw(); timer = setInterval(tick, tickMs); return true; };
      againB.addEventListener('click', function () { start('again'); });
      cv.addEventListener('pointerdown', function (e) {
        if (!timer) { start('tap'); return; }
        var sx = e.clientX, sy = e.clientY;
        var up = function (ev) { cv.removeEventListener('pointerup', up); var dx = ev.clientX - sx, dy = ev.clientY - sy; if (Math.abs(dx) + Math.abs(dy) < 18) return; turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); };
        cv.addEventListener('pointerup', up);
      });
      A.body.querySelectorAll('[data-k]').forEach(function (b) { b.addEventListener('pointerdown', function () { if (!timer && !start('tap')) return; turn(b.getAttribute('data-k')); }); });
      var K = function (k) { return function (d) { if (d) { if (!timer && !start('key')) return; turn(k); } }; };
      var unkey = gameKeys(A, { ArrowLeft: K('left'), ArrowRight: K('right'), ArrowUp: K('up'), ArrowDown: K('down'), a: K('left'), d: K('right'), w: K('up'), s: K('down'), ' ': function (d) { if (d && !timer) start('space'); } });
      face.onload = draw; draw();
      A.stop = function () { clearInterval(timer); unkey(); };
      var held = false;
      A.pause = function () { if (timer) { clearInterval(timer); timer = null; held = true; msg.textContent = 'Paused. The snake waits for you.'; } };
      A.resume = function () { if (held && s) { held = false; timer = setInterval(tick, tickMs); msg.textContent = 'Back in the pond!'; } };
    }, 520);
  }

  // ---------- the Legendary Laptop ----------
  // A community legend: 40 million PEP once bought a laptop, shortly before PEP's all-time high.
  // The window prices that laptop with today's PEP price and with the all-time high (CoinGecko).
  function laptop() {
    openApp('laptop', 'LaptopIndex.exe - the Legendary Laptop', 'gif-012-still', function (A) {
      var LAP = 40000000;
      A.body.innerHTML = '<div class="lap"><div class="lap-art" aria-hidden="true">💻</div><div><p class="lap-k">1 Legendary Laptop = 40,000,000 PEP</p>' +
        '<table class="lap-t"><tr><th>Today</th><td class="lap-now">…</td></tr><tr><th>At the all-time high <small class="lap-athd"></small></th><td class="lap-ath">…</td></tr><tr><th>Laptop’s best day vs today</th><td class="lap-x">…</td></tr></table>' +
        '<p class="lap-story">As the pond tells it: a fren once paid 40 million PEP for a laptop. Not long after, PEP climbed to its all-time high, and that laptop became the most expensive laptop in the pond. The legend ends with paper hands and a lot of feelings. We hope the laptop is doing fine.</p>' +
        '<p class="lap-src">Prices: CoinGecko, hourly snapshot and all-time high. A legend, not financial advice. Laptops are not an investment either.</p></div></div>';
      var q = window.PepPrices ? window.PepPrices.quote() : Promise.reject();
      Promise.all([q.catch(function () { return null; }), json('market-prices.json').catch(function () { return null; })]).then(function (r) {
        var now = r[0] && r[0].usd, mk = r[1] && (r[1].markets || []).filter(function (m) { return m.id === 'pepecoin-network'; })[0];
        var ath = mk && mk.ath;
        A.body.querySelector('.lap-now').textContent = now ? fmt.usd(now * LAP) : '—';
        A.body.querySelector('.lap-ath').textContent = ath ? fmt.usd(ath * LAP) : '—';
        if (mk && mk.ath_date) A.body.querySelector('.lap-athd').textContent = '(' + fmt.date(mk.ath_date) + ')';
        A.body.querySelector('.lap-x').textContent = now && ath ? (ath / now).toFixed(1) + '× pricier' : '—';
      });
    }, 460);
  }

  // ---------- High scores (Supabase, the same project as PEP Games) ----------
  // Public URL and publishable key, the same ones PEP Games uses in games/js/config.js. The data is
  // protected by the database functions (rate limits, plausibility checks), not by hiding these.
  var SB_URL = 'https://azbwciqfbsdpwubznncg.supabase.co', SB_KEY = 'sb_publishable_GRByiqlX6v67phR8xcM6VA_6eXXwTKX';
  var SB_STORE = 'sb-azbwciqfbsdpwubznncg-auth-token';   // where the PEP Games sign-in keeps its session
  // 2 Nov 2026: Pepe Guesser briefly saved an automatic "Frog1234" as the chat nickname, so the chat stopped asking for one
  try { var autoNick = localStorage.getItem('pepgry-nick') || ''; if (/^Frog\d{4}$/.test(autoNick)) { localStorage.setItem('pondos-wp-nick', autoNick); localStorage.removeItem('pepgry-nick'); } } catch (e) {}
  var GAME_NAME = { fud: 'FUD Invaders', snake: 'PEP Snake' };
  // a PEP Games sign-in (Discord) lives in this browser's storage; a valid one makes the score "verified"
  function sbSession() {
    try {
      var s = JSON.parse(localStorage.getItem(SB_STORE) || 'null');
      if (s && s.access_token && s.expires_at * 1000 > Date.now() + 30000 && !(s.user && s.user.is_anonymous)) {
        var ids = (s.user && s.user.identities) || [];
        return { token: s.access_token, userId: s.user && s.user.id, discord: ids.some(function (i) { return i.provider === 'discord'; }) };
      }
    } catch (e) {}
    return null;
  }
  function rpc(name, args) {
    var s = sbSession(), h = { apikey: SB_KEY, 'Content-Type': 'application/json' };
    if (s) h.Authorization = 'Bearer ' + s.token;
    return fetch(SB_URL + '/rest/v1/rpc/' + name, { method: 'POST', headers: h, body: JSON.stringify(args) }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error((j && j.message) || 'The high score server did not answer'); return j; });
    });
  }
  function offerSubmit(A, game, score, ms) {
    var old = A.body.querySelector('.hs-submit'); if (old) old.remove();
    if (!(score > 0)) return;
    var s = sbSession(), nick = ''; try { nick = localStorage.getItem('pondos-nick') || ''; } catch (e) {}
    var box = el('form', { class: 'app-row hs-submit' });
    box.innerHTML = (s && s.discord ? '<span class="grow">Send <b>' + fmt.int(score) + '</b> to the High Scores as your Discord name <span class="hs-ok" title="Verified with Discord">✓</span></span>'
      : '<label class="grow">Nickname <input name="nick" maxlength="20" autocomplete="nickname" value="' + esc(nick) + '" placeholder="2-20 letters"></label>') +
      '<button type="submit" class="app-btn">Submit score</button><button type="button" class="app-btn hs-see">🏆 LEADERS</button>' +
      (s && s.discord ? '' : '<span class="hs-note"><a href="#" class="hs-logon">Log on with Discord</a> to get a ✓ next to your name.</span>');
    A.body.appendChild(box);
    box.querySelector('.hs-see').addEventListener('click', function () { highScores(game); });
    var hl = box.querySelector('.hs-logon'); if (hl) hl.addEventListener('click', function (e) { e.preventDefault(); logOn(); });
    box.addEventListener('submit', function (e) {
      e.preventDefault();
      var inp = box.querySelector('input[name=nick]'), n = inp ? inp.value.trim() : '';
      if (inp) { if (n.length < 2) { inp.focus(); return; } try { localStorage.setItem('pondos-nick', n); } catch (err) {} }
      var btn = box.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Sending…';
      rpc('gry_arcade_submit', { p_game: game, p_nick: n, p_score: score, p_ms: Math.round(ms) }).then(function (r) {
        box.innerHTML = '<span class="grow">Saved as <b>' + esc(r.nick) + '</b>' + (r.verified ? ' <span class="hs-ok">✓</span>' : '') + '. Place #' + r.place + ' in ' + GAME_NAME[game] + '.</span><button type="button" class="app-btn hs-see">🏆 LEADERS</button>';
        box.querySelector('.hs-see').addEventListener('click', function () { highScores(game); });
        if (apps.hs) apps.hs.load(game);
      }, function (err) { btn.disabled = false; btn.textContent = 'Submit score'; box.querySelector('.hs-err') ? box.querySelector('.hs-err').textContent = err.message : box.appendChild(el('span', { class: 'hs-err' }, esc(err.message))); });
    });
  }
  // names in score tables: Discord players in bold with a small frog, guests in grey (to make logging on worth it)
  // Pepe Guesser: the host's own row comes back only to the host (marked hidden); others never get it
  function hostHidden(x) { return x && x.hidden ? ' <small class="wp-hidden" title="You are the host, so other players do not see your score">(hidden, only you see this)</small>' : ''; }
  function who(nick, verified) {
    return verified ? '<b class="who who-ok" title="Discord player"><img src="img/pep-logo.webp" alt="" width="14" height="14">' + esc(nick) + '</b>'
      : '<span class="who who-guest" title="Guest">' + esc(nick) + '</span>';
  }
  function whoLegend() { return '<p class="who-legend"><b class="who who-ok"><img src="img/pep-logo.webp" alt="" width="14" height="14">Bold</b> = Discord player · <span class="who-guest">grey</span> = guest. <a href="#" class="who-logon">Log on with Discord</a> to get the frog.</p>'; }
  function wireLegend(box) { var a = box.querySelector('.who-logon'); if (a) a.addEventListener('click', function (e) { e.preventDefault(); logOn(); }); }
  // LEADERS: every top 10 in one window (FUD Invaders, PEP Snake, YEET THE PEP, Pepe Guesser today and 7 days, Pepe Miner)
  var LEAD = [['fud', 'FUD Invaders'], ['snake', 'PEP Snake'], ['yeet', 'YEET THE PEP'], ['wp', "Pepe Guesser"], ['miner', 'Pepe Miner']];
  var LEAD_TIP = {
    fud: 'Best score per player. Scores run in your browser, so the server checks them for plausibility and rate.',
    snake: 'Best score per player, in blocks. The server checks every score against the length of the game.',
    yeet: 'Best flight per pilot. Guests add a flight with a nickname after landing.',
    wp: 'Points from the daily photo hunts. Guests count once per network.',
    miner: 'Blocks mined (10,000 game PEP each), from the cloud saves of Discord players. A guest’s mine stays in their browser.'
  };
  function highScores(game) {
    var A = openApp('hs', 'LEADERS - top 10', 'leaders', function (A) {
      A.body.innerHTML = '<div class="lead-head"><img src="' + ico('leaders') + '" alt="" width="40" height="40"><div><b>LEADERS</b><span>The best frogs in the pond</span></div></div>' +
        '<div class="app-row hs-tabs" role="tablist">' + LEAD.map(function (g) { return '<button type="button" class="app-btn" data-g="' + g[0] + '" role="tab">' + g[1] + '</button>'; }).join('') + '</div>' +
        '<div class="lead-lists"></div>' + whoLegend() + '<p class="bin-tip lead-tip"></p>';
      wireLegend(A.body);
      var row = function (r, i, sc) { return '<li><span>' + (i + 1) + '.</span><span>' + who(r.nick, r.verified !== false) + '</span><small>' + sc + '</small></li>'; };
      var empty = '<li><span></span><span>No scores yet. Be the first frog.</span><small></small></li>';
      var fail = function (ol) { return function (err) { ol.innerHTML = '<li><span></span><span>' + (/function|PGRST/.test(err.message) ? 'Coming soon.' : esc(err.message)) + '</span><small></small></li>'; }; };
      var list = function (title) { return (title ? '<p class="lead-sub">' + title + '</p>' : '') + '<ol class="bin-list hs-list"><li>Loading…</li></ol>'; };
      A.load = function (g) {
        A.game = g;
        A.body.querySelectorAll('[data-g]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-g') === g)); });
        A.body.querySelector('.lead-tip').textContent = LEAD_TIP[g];
        var box = A.body.querySelector('.lead-lists');
        box.className = 'lead-lists' + (g === 'wp' ? ' two' : '');
        box.innerHTML = g === 'wp' ? '<div>' + list('Today') + '</div><div>' + list('Last 7 days') + '</div>' : list('');
        var ols = box.querySelectorAll('ol');
        if (g === 'fud' || g === 'snake') rpc('gry_arcade_top', { p_game: g }).then(function (rows) {
          ols[0].innerHTML = rows && rows.length ? rows.map(function (r, i) { return row(r, i, fmt.int(r.score) + (g === 'snake' ? ' blocks' : '')); }).join('') : empty;
        }, fail(ols[0]));
        else if (g === 'yeet') rpc('gry_yeet_state', {}).then(function (r) {
          var rows = (r && r.top) || [];
          ols[0].innerHTML = rows.length ? rows.map(function (x, i) { return row(x, i, (x.score / 10).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' m'); }).join('') : empty;
        }, fail(ols[0]));
        else if (g === 'wp') ['day', 'week'].forEach(function (sc, k) {
          rpc('gry_wp_top', { p_scope: sc }).then(function (rows) {
            ols[k].innerHTML = rows && rows.length ? rows.map(function (x, i) { return row(x, i, Number(x.points).toLocaleString('en-US') + ' pts' + hostHidden(x)); }).join('') : empty;
          }, fail(ols[k]));
        });
        else rpc('gry_miner_top', {}).then(function (rows) {
          ols[0].innerHTML = rows && rows.length ? rows.map(function (x, i) { return row(x, i, minerBlocks(x.score) + ' blocks'); }).join('') : empty;
        }, fail(ols[0]));
      };
      A.body.querySelectorAll('[data-g]').forEach(function (b) { b.addEventListener('click', function () { A.load(b.getAttribute('data-g')); }); });
    }, 560);
    A.load(game || A.game || 'fud');
  }

  // ---------- board games and Pepe Miner from PEP Games, as app windows ----------
  // a game window with two tabs: play the bot here, or "LAN Party" (open a table and invite a fren, or join one)
  function tabbedGame(id, title, icon, tabs, width) {
    var A = openApp(id, title, icon, function (A) {
      A.body.innerHTML = '<div class="tabs98" role="tablist">' + tabs.map(function (t, i) { return '<button type="button" role="tab" data-t="' + i + '" aria-selected="' + (i === 0) + '">' + t[0] + '</button>'; }).join('') + '</div>' +
        '<div class="tabpane"><div class="app-row tab-extra"></div><iframe class="app-frame" title="' + esc(title) + '"></iframe></div>';
      var fr = A.body.querySelector('iframe'), extra = A.body.querySelector('.tab-extra');
      var pick = function (i) {
        A.body.querySelectorAll('[role=tab]').forEach(function (b) { b.setAttribute('aria-selected', String(+b.getAttribute('data-t') === i)); });
        var t = tabs[i]; extra.innerHTML = ''; extra.hidden = !t[2];
        if (t[2]) t[2](extra, function (u) { fr.src = u; });
        fr.src = typeof t[1] === 'function' ? t[1]() : t[1];
      };
      A.body.querySelectorAll('[role=tab]').forEach(function (b) { b.addEventListener('click', function () { pick(+b.getAttribute('data-t')); }); });
      pick(0);
    }, width || 860);
    A.host.style.top = '12px'; A.host.style.setProperty('--app-top', '12px');
    return A;
  }
  // a PEP Games page opened as a full page (phones, new tab): it keeps the 98 look and leads back here
  function osPage(path) {
    var h = path.indexOf('#'), hash = h >= 0 ? path.slice(h) : ''; path = h >= 0 ? path.slice(0, h) : path;
    return BASE + 'games/' + path + (path.indexOf('?') >= 0 ? '&' : '?') + 'os=98&back=' + encodeURIComponent(location.pathname) + hash;
  }
  // Chess, Checkers, Connect Four, Sea Battle: first "vs the bot" or "with a fren".
  // Bot: difficulty, Start, then the board. Fren: one click makes a private table and shows the invite link to copy;
  // the board (with its chat) waits below until the fren opens the link.
  function boardGame(key, name) {
    var G = BASE + 'games/', phone = window.innerWidth < 760;
    var A = openApp('bg-' + key, name, 'pond-playground', function (A) {
      var big = function (on) { A.host.classList.toggle('app-full', !!on); };
      var choose = function () {
        big(false);
        A.body.innerHTML = '<div class="bg-pick"><p>How do you want to play ' + esc(name) + '?</p>' +
          '<button type="button" class="bg-big" data-m="bot"><span aria-hidden="true">🤖</span><b>vs the bot</b><small>Right now, no account</small></button>' +
          '<button type="button" class="bg-big" data-m="fren"><span aria-hidden="true">👥</span><b>with a fren</b><small>Get a link to send them</small></button></div>';
        A.body.querySelector('[data-m=bot]').addEventListener('click', bot);
        A.body.querySelector('[data-m=fren]').addEventListener('click', fren);
      };
      var back = '<button type="button" class="app-btn bg-back">◀ Back</button>';
      var frame = function (url) { return phone ? '' : '<iframe class="app-frame bg-frame" src="' + url + '" title="' + esc(name) + '"></iframe>'; };
      var bot = function () {
        A.body.innerHTML = '<div class="app-row bg-row">' + back + '<span class="grow">Difficulty</span>' + ['easy', 'medium', 'hard'].map(function (l) { return '<button type="button" class="app-btn" data-l="' + l + '" aria-pressed="' + (l === 'medium') + '">' + l.charAt(0).toUpperCase() + l.slice(1) + '</button>'; }).join('') +
          '<button type="button" class="app-btn go bg-start">▶ Start</button></div><div class="bg-stage"><p class="bin-tip">Pick a difficulty and press Start.</p></div>';
        var lv = 'medium';
        A.body.querySelector('.bg-back').addEventListener('click', choose);
        A.body.querySelectorAll('[data-l]').forEach(function (b) { b.addEventListener('click', function () { lv = b.getAttribute('data-l'); A.body.querySelectorAll('[data-l]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); }); });
        A.body.querySelector('.bg-start').addEventListener('click', function () {
          if (phone) { location.href = osPage('table.html?bot=' + key + '&level=' + lv); return; }
          big(true); A.body.querySelector('.bg-stage').innerHTML = frame(G + 'table.html?bot=' + key + '&level=' + lv + '&embed=1');
        });
      };
      var fren = function () {
        if (!anySession()) {
          A.body.innerHTML = '<div class="app-row bg-row">' + back + '</div><div class="bg-pick"><p>To play with a fren, log on first: as a guest (one click) or with Discord.</p><button type="button" class="app-btn go bg-logon">Log on</button></div>';
          A.body.querySelector('.bg-back').addEventListener('click', choose);
          A.body.querySelector('.bg-logon').addEventListener('click', function () { logOn(); });
          return;
        }
        A.body.innerHTML = '<div class="app-row bg-row">' + back + '<span class="grow bg-msg">Making your table…</span></div><div class="bg-stage"></div>';
        A.body.querySelector('.bg-back').addEventListener('click', choose);
        // no nickname first: a Discord player keeps the name on their profile (sending a nickname would rename it);
        // only a guest, whom the server asks for one, gets the nickname saved in this browser
        var nick = ''; try { nick = localStorage.getItem('pepgry-nick') || localStorage.getItem('pondos-wp-nick') || ''; } catch (e) {}
        var make = function (n) { return wpRpc('gry_table_create', { p_game: key, p_nick: n, p_private: true, p_spectators: true }); };
        make('').catch(function (err) { if (/nickname/i.test(err.message || '')) return make(nick || 'Frog'); throw err; }).then(function (code) {
          var link = 'https://pepecoinhub.com/games/table.html?t=' + encodeURIComponent(code);
          if (!phone) big(true);
          A.body.querySelector('.bg-msg').innerHTML = '<b>Send this link to your fren:</b>';
          A.body.querySelector('.bg-stage').innerHTML = '<div class="app-row bg-link"><input class="ac-in" readonly value="' + esc(link) + '" aria-label="Invite link"><button type="button" class="app-btn go bg-copy">Copy link</button></div>' +
            '<p class="bin-tip">The game starts when your fren opens the link. The board and the chat are below.</p>' + (phone ? '<a class="app-btn" href="' + osPage('table.html?t=' + encodeURIComponent(code)) + '">Open the table</a>' : frame(G + 'table.html?t=' + encodeURIComponent(code) + '&embed=1'));
          var inp = A.body.querySelector('.bg-link input');
          A.body.querySelector('.bg-copy').addEventListener('click', function () {
            inp.select();
            var ok = function () { A.body.querySelector('.bg-copy').textContent = 'Copied ✓'; };
            if (navigator.clipboard) navigator.clipboard.writeText(link).then(ok, function () { try { document.execCommand('copy'); ok(); } catch (e) {} }); else { try { document.execCommand('copy'); ok(); } catch (e) {} }
          });
        }, function (err) { A.body.querySelector('.bg-msg').textContent = err.message || 'Could not make a table. Try again.'; });
      };
      choose();
    }, 500);
  }
  // PEPaint.exe: the party room (Draw & Guess) in a paint-program window. It opens straight on its main menu
  // (new party room, quick join, join with a code, the open rooms); the rooms open in the same window.
  // The page inside tells the title bar where it is ("Room ABCDE - PEPaint") and File > Exit closes the window.
  function drawGuess(join) {
    join = typeof join === 'string' ? join : '';
    var G = BASE + 'games/', q = join ? '&join=' + encodeURIComponent(join) : '';
    if (window.innerWidth < 760) { location.href = osPage('pepaint.html' + (join ? '?join=' + encodeURIComponent(join) : '')); return; }
    var A = openApp('dg', 'Main menu - PEPaint', 'pepaint', function (A) {
      A.body.innerHTML = '<iframe class="app-frame pepaint-frame" src="' + G + 'pepaint.html?embed=1' + q + '" title="PEPaint" allow="clipboard-write"></iframe>';
      A.body.style.padding = '0';
      var fr = A.body.querySelector('iframe'), t = A.host.querySelector('.win-t');
      var onMsg = function (e) {
        if (e.source !== fr.contentWindow || e.origin !== location.origin || !e.data) return;
        if (e.data.type === 'pepaint-title' && typeof e.data.title === 'string') { t.textContent = e.data.title.slice(0, 60); A.host.setAttribute('aria-label', t.textContent); }
        else if (e.data.type === 'pepaint-close') A.close();
      };
      window.addEventListener('message', onMsg);
      A.stop = function () { window.removeEventListener('message', onMsg); };
    }, 1180);
    A.host.classList.add('pepaint-window');
    A.host.style.top = '12px'; A.host.style.setProperty('--app-top', '12px');
    return A;
  }
  function yeetApp() {
    var A = openApp('yeet', 'YEET THE PEP', 'yeet', function (A) {
      A.body.innerHTML = '<iframe class="app-frame" src="' + BASE + 'games/yeet.html?embed=1" title="YEET THE PEP" allow="web-share; clipboard-write; fullscreen"></iframe>';
    }, 1000);
    A.host.classList.add('app-full');
  }
  // PEPEGOCHI.EXE: your frog on the server (one per Discord account)
  function pepegochiApp() {
    var A = openApp('pepegochi', 'PEPEGOCHI.EXE', 'pep-logo', function (A) {
      A.body.innerHTML = '<iframe class="app-frame" src="' + BASE + 'games/pepegochi-live.html?embed=1" title="PEPEGOCHI.EXE"></iframe>';
    }, 760);
    return A;
  }
  // the rules simulator for testers: a local copy of the rules with a time machine, no server, no stamps
  function pepegochiTestApp() {
    var A = openApp('pepegochi-test', 'PEPEGOCHI · LOCAL TEST', 'pep-logo', function (A) {
      A.body.innerHTML = '<iframe class="app-frame" src="' + BASE + 'games/pepegochi.html?embed=1" title="PEPEGOCHI.EXE (local test)"></iframe>';
    }, 760);
    return A;
  }
  function pondWarsApp() {
    var A = openApp('pondwars', 'FROGAGEDDON · BETA', 'pondwars', function (A) {
      A.body.innerHTML = '<iframe class="app-frame" src="' + BASE + 'games/pondwars-beta.html?embed=1" title="FROGAGEDDON"></iframe>';
      A.host.querySelector('.w-min').addEventListener('click', function () {
        A.body.querySelector('iframe').contentWindow.postMessage('pondwars-pause', location.origin);
      });
    }, 1200);
    A.host.classList.add('app-full', 'pondwars-window');
  }
  function pepeSweeperApp() {
    // a normal window that fits the board (the game reports its size), not a full-screen one
    var A = openApp('pepesweeper', 'PEPE SWEEPER', 'pepesweeper', function (A) {
      A.body.innerHTML = '<iframe class="app-frame sweep-frame" src="' + BASE + 'games/pepe-sweeper.html?embed=1" title="PEPE SWEEPER"></iframe>';
      A.body.style.padding = '0';
      var fr = A.body.querySelector('iframe'), lastW = 0;
      var onSize = function (e) {
        if (e.source !== fr.contentWindow || !e.data || e.data.type !== 'pepe-sweeper-size') return;
        fr.style.height = Math.max(200, e.data.h) + 'px';
        if (e.data.w !== lastW) {
          lastW = e.data.w;
          A.host.style.width = 'min(' + (e.data.w + 10) + 'px, calc(100vw - 16px))';
          if (window.innerWidth > 760) { A.host.style.left = Math.max(8, (window.innerWidth - A.host.offsetWidth) / 2) + 'px'; A.host.style.transform = 'none'; }
        }
      };
      window.addEventListener('message', onSize);
      A.stop = function () { window.removeEventListener('message', onSize); };
      A.host.querySelector('.w-min').addEventListener('click', function () {
        fr.contentWindow.postMessage('pepe-sweeper-pause', location.origin);
      });
    }, 590);
    return A;
  }
  function minerApp() {
    var A = openApp('miner', 'Pepe Miner', 'pickaxe', function (A) {
      A.body.innerHTML = '<iframe class="app-frame" src="' + BASE + 'games/miner.html?embed=1" title="Pepe Miner"></iframe>';
    }, 1000);
    // the miner opens full screen (above the taskbar). Its progress is saved in this browser every few seconds
    // and when the window closes, so closing or minimizing never resets it.
    A.host.classList.add('app-full');
  }

  // ---------- Games folder ----------
  // ---------- Find: type a word, get the games, pages and tools that match ----------
  function findIndex() {
    var act = function (k) { return function () { if (DESK_ACT[k]) DESK_ACT[k](); }; };
    var page = function (p) { return function () { location.href = href(p); }; };
    var L = [
      ["Pepe Guesser", 'Daily photo hunt on the map', 'wheres-pepe', 'game geo guess guesser where map photo travel daily faucet free pep reward points', function () { wheresPepe(); }],
      ['LEADERS', 'Every top 10 in one place', 'leaders', 'scores high score top ranking leaderboard best winners', function () { highScores(); }],
      ['YEET THE PEP', 'Catapult a frog, three panic flaps', 'yeet', 'game catapult launch fly distance arcade', function () { yeetApp(); }],
      ['PEPE SWEEPER', 'Flag the wrong Pepe', 'pepesweeper', 'game minesweeper saper flags lily pads wrong pepe eth arcade', function () { pepeSweeperApp(); }],
      ['FUD Invaders', 'Shoot receipts at the FUD', 'gif-008-still', 'game arcade shooter invaders fud', invaders],
      ['PEP Snake', 'Eat blocks, not your tail', 'gif-027-still', 'game arcade snake blocks', snake],
      ['Pepe Miner', 'Click, mine, upgrade', 'pickaxe', 'game miner idle clicker mine blocks', minerApp],
      ['Chess', 'vs the bot or with a fren', 'pond-playground', 'game board chess bot friend multiplayer', function () { boardGame('chess', 'Chess'); }],
      ['Checkers', 'vs the bot or with a fren', 'pond-playground', 'game board checkers draughts warcaby bot friend', function () { boardGame('checkers', 'Checkers'); }],
      ['Connect Four', 'vs the bot or with a fren', 'pond-playground', 'game board connect four 4 bot friend', function () { boardGame('connect4', 'Connect Four'); }],
      ['Sea Battle', 'vs the bot or with a fren', 'pond-playground', 'game board battleship ships sea bot friend statki', function () { boardGame('battleship', 'Sea Battle'); }],
      ['PEPaint.exe', 'The party room: draw and guess with frens', 'pepaint', 'game draw guess charades kalambury paint party multiplayer room pepaint', drawGuess],
      ['Pepe Pictures', 'Weekly quiz night: host wanted', 'unclesam', 'game quiz pictures host night', pepePictures],
      ['Games folder', 'All the games', 'games-folder', 'games play folder', gamesFolder],
      ['LAN Party', 'The lobby chat', 'gif-080-still', 'chat talk frens online lobby messages', lanParty],
      ['Pond TV', 'Videos from the Pepecoin channel', 'pond-tv', 'tv video youtube channel watch', pondTV],
      ['PEP-TV Ads', 'Fake late-night infomercials', 'pep-tv-ads', 'ads tv commercials videos funny', adsFolder],
      ['NERDS ONLY', 'Charts, whales, math and receipts', 'nerds-folder', 'nerds folder tools data facts', act('#nerds')],
      ['AddressCheck.exe', 'Is this a real PEP address?', 'pepe-search', 'address check scam verify checksum wallet', addressCheck],
      ['Not PEP (0x)', 'PEPE and PEPECOIN are not PEP', 'wrongpep', 'pepe pepecoin ethereum erc20 token wrong scam', act('#notpep')],
      ['Frog Mail', 'The Pond Gazette', 'frog-mail', 'mail news gazette newsletter', frogMail],
      ['Shop', 'Official Pepecoin shop', 'shop-bag', 'shop merch buy store', act('#shop')],
      ['About me', 'Who builds this pond (and how to support it)', 'night-shift', 'about me byl author tip donate support', aboutMe],
      ['Write a letter', 'Send an idea, a wish or a bug to the builder', 'frog-mail', 'write letter feedback contact message bug idea mail', function () { frogMail('write'); }],
      ['Log On', 'Guest or Discord', 'pep-logo', 'log on login sign in account discord guest', logOn],
      ['LaptopIndex.exe', 'The Legendary Laptop', 'gif-012-still', 'laptop legend 40 million ath', laptop],
      ['Recycle Bin', 'Paper hands and a strange note', 'recycle-bin', 'bin trash recycle paper hands', paperHands]
    ].concat(FREN ? [
      ['Fren Passport', 'Your Fren, achievements and secrets', 'pep-logo', 'passport profile achievements badges secrets items account', function () { frenPassport(); }],
      ['Create Your Fren', 'Avatar Maker for your Fren Passport', 'fresh-fren', 'avatar maker profile picture face hat outfit glasses look character fresh fren', function () { avatarMaker(); }]
    ] : []).concat(GOCHI ? [
      ['PEPEGOCHI.EXE', 'Your frog: feed it, clean it, keep it happy', 'pep-logo', 'pepegochi tamagotchi pet frog care feed egg hatch', function () { pepegochiApp(); }],
      ['PEPEGOCHI (local test)', 'Rules simulator for the PepeGochi beta', 'pep-logo', 'pepegochi test beta simulator time machine', function () { pepegochiTestApp(); }]
    ] : []).map(function (x) { return { name: x[0], desc: x[1], icon: x[2], kw: x[3], go: x[4] }; });
    NAV.forEach(function (g) { g[1].forEach(function (p) { L.push({ name: p[1], desc: p[2], icon: p[3], kw: 'page ' + g[0] + ' ' + p[0].replace(/[@\/-]/g, ' '), go: page(p[0]) }); }); });
    ADS.forEach(function (ad, i) { L.push({ name: ad.file, desc: 'PEP-TV ad: ' + ad.title, icon: ad.icon, kw: 'ad ads tv video ' + ad.title, go: function () { adPlayer(i); } }); });
    return L;
  }
  function finder(q0) {
    var A = openApp('find', 'Find: games, pages and tools', 'search', function (A) {
      A.body.innerHTML = '<form class="app-row find-form" role="search"><img src="' + ico('search') + '" alt="" width="28" height="28"><input class="ac-in find-in" type="search" placeholder="Type a word: chess, price, faucet, whales…" aria-label="Find" autocomplete="off" spellcheck="false"><button type="submit" class="app-btn">Find</button></form>' +
        '<ul class="find-list" role="listbox" aria-label="Results"></ul><p class="bin-tip find-tip"></p>';
      var IDX = findIndex(), inp = A.body.querySelector('.find-in'), ul = A.body.querySelector('.find-list'), tip = A.body.querySelector('.find-tip'), hits = [];
      var norm = function (t) { return String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
      var run = function () {
        var words = norm(inp.value).split(/\s+/).filter(Boolean);
        hits = words.length ? IDX.filter(function (x) { var hay = norm(x.name + ' ' + x.desc + ' ' + x.kw); return words.every(function (w) { return hay.indexOf(w) >= 0; }); })
          .sort(function (a, b) { var w = words[0]; return (norm(b.name).indexOf(w) === 0) - (norm(a.name).indexOf(w) === 0); }).slice(0, 14)
          : IDX.slice(0, 8);
        ul.innerHTML = hits.map(function (x, i) { return '<li><button type="button" data-i="' + i + '"><img src="' + ico(x.icon) + '" alt="" width="28" height="28"><span><b>' + esc(x.name) + '</b><small>' + esc(x.desc) + '</small></span></button></li>'; }).join('');
        tip.textContent = words.length ? (hits.length ? hits.length + (hits.length === 1 ? ' match' : ' matches') + '. Enter opens the first one.' : 'Nothing found. Try another word: game, chat, price, mining, wallet…') : 'Popular right now. Type to find anything in the pond.';
      };
      var open = function (x) { if (x) { discoverSecret('find_fren'); x.go(); } };
      ul.addEventListener('click', function (e) { var b = e.target.closest('[data-i]'); if (b) open(hits[+b.getAttribute('data-i')]); });
      A.body.querySelector('.find-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var q = norm(inp.value).trim();
        if (/^format\s*c:?$/.test(q)) { bsod(); return; }
        if (magicWord(q)) return;
        open(hits[0]);
      });
      inp.addEventListener('input', run);
      A.run = function (q) { if (q != null) inp.value = q; run(); setTimeout(function () { inp.focus(); }, 30); };
    }, 460);
    A.run(q0);
  }

  // Pepe Pictures (the weekly quiz night) has no host yet: its icon plays the "host wanted" ad
  function pepePictures() { for (var k = 0; k < ADS.length; k++) if (ADS[k].file === 'host_wanted.mpg') { adPlayer(k); return; } }
  function gamesFolder() {
    openApp('games', 'C:\\Pond\\Games', 'games-folder', function (A) {
      var G = [['🏆 LEADERS', 'leaders', function () { highScores(); }], ['FUD Invaders', 'gif-008-still', invaders], ['PEP Snake', 'gif-027-still', snake],
        ['YEET THE PEP', 'yeet', function () { yeetApp(); }],
        ['PEPE SWEEPER', 'pepesweeper', function () { pepeSweeperApp(); }],
        ['Chess', '♟️', function () { boardGame('chess', 'Chess'); }], ['Checkers', '⚫', function () { boardGame('checkers', 'Checkers'); }],
        ['Connect Four', '🔴', function () { boardGame('connect4', 'Connect Four'); }], ['Sea Battle', '🚢', function () { boardGame('battleship', 'Sea Battle'); }],
        ['PEPaint.exe', 'pepaint', drawGuess], ['Pepe Pictures', 'unclesam', pepePictures], ['Pepe Miner', 'pickaxe', minerApp]];
      A.body.innerHTML = '<ul class="folder">' + G.map(function (g, i) { var ic = /^[a-z]/.test(g[1]) ? '<img src="' + ico(g[1]) + '" alt="" width="40" height="40">' : '<i class="emo" aria-hidden="true">' + g[1] + '</i>'; return '<li><button type="button" data-i="' + i + '">' + ic + '<span>' + g[0] + '</span></button></li>'; }).join('') + '</ul>' +
        '<p class="bin-tip">Double-click a game. Chess, Checkers, Connect Four and Sea Battle: play the bot, or get a link for a fren. PEPaint: the party room, draw and guess with frens. 🏆 LEADERS has every top 10.</p>';
      A.body.querySelectorAll('.folder button').forEach(function (b) {
        var go = function () { G[+b.getAttribute('data-i')][2](); };
        b.addEventListener('dblclick', go);
        b.addEventListener('click', function () { if (!matchMedia('(hover: hover) and (pointer: fine)').matches) go(); else { A.body.querySelectorAll('.folder .sel').forEach(function (x) { x.classList.remove('sel'); }); b.classList.add('sel'); } });
        b.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } });
      });
    }, 520);
  }

  // ---------- Pond TV: a small video player window (YouTube, no-cookie embed, loads only when opened) ----------
  // Pond TV: a CRT set with channel buttons. CH 1 is the Pepecoin film; the next channels are the latest videos of the
  // official channel youtube.com/@pepecoin (data/youtube.json, refreshed by the hourly build); the last one is PEP-TV Ads.
  var TV_FIRST = { id: 'HnfR7KgQqRA', title: 'Pepecoin' };
  function pondTV() {
    var A = openApp('tv', 'Pond TV', 'pond-tv', function (A) {
      A.body.innerHTML = '<div class="crt"><div class="crt-face"><div class="crt-glass"><div class="crt-pic"></div><div class="crt-snow" hidden></div><div class="crt-osd" aria-hidden="true"></div></div>' +
        '<div class="crt-panel"><div class="crt-led" aria-live="polite">CH 01</div>' +
        '<button type="button" class="crt-btn crt-up" aria-label="Next channel">CH ▲</button><button type="button" class="crt-btn crt-dn" aria-label="Previous channel">CH ▼</button>' +
        '<div class="crt-grill" aria-hidden="true"></div><span class="crt-brand" aria-hidden="true">FROGTRON</span></div></div>' +
        '<div class="crt-feet" aria-hidden="true"><i></i><i></i></div></div>' +
        '<div class="app-row"><span class="grow crt-now">Now playing: Pepecoin</span><a class="app-btn crt-yt" target="_blank" rel="noopener">Open on YouTube</a><a class="app-btn" href="https://www.youtube.com/@pepecoin" target="_blank" rel="noopener">@pepecoin</a></div>';
      var pic = A.body.querySelector('.crt-pic'), snow = A.body.querySelector('.crt-snow'), osd = A.body.querySelector('.crt-osd'), led = A.body.querySelector('.crt-led'),
        now = A.body.querySelector('.crt-now'), yt = A.body.querySelector('.crt-yt'), cur = 0, t = 0;
      var CH = [TV_FIRST], ADS_CH = { ads: true, title: 'PEP-TV Ads' };
      var list = function () { return CH.concat([ADS_CH]); };
      var tune = function (k) {
        var L = list(); cur = (k + L.length) % L.length; var c = L[cur], n = ('0' + (cur + 1)).slice(-2);
        led.textContent = 'CH ' + n; osd.textContent = 'CH ' + n;
        clearTimeout(t); snow.hidden = REDUCE; pic.innerHTML = '';
        t = setTimeout(function () {
          snow.hidden = true;
          if (c.ads) {
            pic.innerHTML = '<div class="crt-card"><b>PEP-TV Ads</b><span>Late-night infomercials, recovered from an old VHS.</span><button type="button" class="app-btn">Open the tape folder</button></div>';
            pic.querySelector('button').addEventListener('click', adsFolder);
            now.textContent = 'CH ' + n + ' · PEP-TV Ads'; yt.hidden = true;
          } else {
            pic.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + c.id + '?rel=0&modestbranding=1" title="' + esc(c.title) + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>';
            now.textContent = 'CH ' + n + ' · ' + c.title + (c.published ? ' (' + c.published + ')' : '');
            yt.hidden = false; yt.href = 'https://youtu.be/' + c.id;
          }
          osd.classList.remove('show'); void osd.offsetWidth; osd.classList.add('show');
        }, REDUCE ? 0 : 450);
      };
      A.body.querySelector('.crt-up').addEventListener('click', function () { tune(cur + 1); });
      A.body.querySelector('.crt-dn').addEventListener('click', function () { tune(cur - 1); });
      tune(0);
      fetch(DATA + 'youtube.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        var v = d && d.videos || [];
        CH = [TV_FIRST].concat(v.filter(function (x) { return x && /^[A-Za-z0-9_-]{11}$/.test(x.id) && x.id !== TV_FIRST.id; }).map(function (x) { return { id: x.id, title: String(x.title || 'Pepecoin'), published: x.published }; }));
      }).catch(function () {});
      A.stop = function () { clearTimeout(t); };
    }, 760);
    return A;
  }

  // ---------- Log On: the PEP Games sign-in (Discord or a guest nickname), shared by chat and high scores ----------
  // Discord does not allow its login page inside a frame, so signing in happens on the PEP Games page,
  // which sends the visitor straight back here afterwards.
  function whoAmI() {
    var s = anySession(); if (!s || !s.user) return null;
    var ids = s.user.identities || [], d = ids.filter(function (i) { return i.provider === 'discord'; })[0], m = s.user.user_metadata || {};
    var name = d ? ((d.identity_data && (d.identity_data.custom_claims && d.identity_data.custom_claims.global_name || d.identity_data.full_name || d.identity_data.name)) || m.full_name || m.name) : null;
    var nick = ''; try { nick = localStorage.getItem('pepgry-nick') || ''; } catch (e) {}
    return { discord: !!d, name: name || nick || 'guest' };
  }
  function signInHref() { return BASE + 'games/?login=1&back=' + encodeURIComponent(location.pathname + location.search.replace(/[?&]signedin=1/, '')); }
  // Fren Passport: all durable player data comes from the server. The catalog
  // contains labels and hints only; it never awards anything.
  // The last snapshot stays in memory for the same Discord user, so the Avatar Maker can show the saved
  // look and refresh the Passport after a save without asking the server again.
  var passportCache = null; // { userId, state, catalog, opts }
  var PP_CATALOG = 'passport-catalog.json?v=20261111launch';
  function passportCss() {
    if (!document.getElementById('fren-passport-css')) {
      document.head.appendChild(el('link', {id:'fren-passport-css',rel:'stylesheet',href:'passport.css?v=20261111launch'}));
    }
  }
  // ?beta=fren test preview: while the passport functions are not on the server yet (or the tester is not
  // signed in with Discord), the Passport and the Avatar Maker run on a local copy kept in this browser only.
  // Nothing is sent to the server and no stamp is real; the Passport says so at the top.
  var FREN_LOCAL = 'pondos-fren-preview';
  var FREN_TEST_LOCAL = 'pondos-fren-owner-sandbox-v1:';
  var frenMissing = function (err) { return /PGRST202|could not find the function|does not exist/i.test((err && err.message) || ''); };
  function frenTestKey() {
    var s = sbSession();
    return FREN_TEST_LOCAL + (s && s.discord && s.userId ? s.userId : 'no-owner');
  }
  // The existing Frog Mail owner RPC checks games.owners on the server.
  // Never infer ownership from a URL, localStorage, or a client-supplied Discord ID.
  function frenTestAuthorize() {
    var s = sbSession();
    if (!s || !s.discord || !s.userId)
      return Promise.reject(new Error('Log on with the owner Discord account to use the test sandbox.'));
    return rpc('gry_letters', { p_limit: 1 }).then(function (j) {
      if (!j || !Array.isArray(j.letters)) throw new Error('Only the verified PondOS owner can use this sandbox.');
      return s;
    }, function () { throw new Error('Owner verification failed. Check your Discord login and try again.'); });
  }
  function frenLocal(v) {
    var key = FREN_TEST ? frenTestKey() : FREN_LOCAL;
    try {
      if (v) localStorage.setItem(key, JSON.stringify(v));
      return JSON.parse(localStorage.getItem(key) || 'null') || {};
    } catch (e) { return v || {}; }
  }
  function frenPreview(name, args) {
    var L = frenLocal(), now = new Date().toISOString();
    if (!L.since) { L.since = now; frenLocal(L); }
    if (name === 'gry_passport_avatar_save') {
      var first = !L.first_avatar;
      L.avatar = { schema_version: 2, bg: args.p_bg, clothing: args.p_clothing, mouth: args.p_mouth, eyes: args.p_eyes, hat: args.p_hat, accessory: args.p_accessory, special: args.p_special };
      if (first) L.first_avatar = now;
      frenLocal(L);
      return { avatar: L.avatar, badge: { id: 'first_avatar', earned_at: L.first_avatar, new: first } };
    }
    if (name === 'gry_passport_discover' && FREN_TEST) {
      var id = String(args.p_secret || '');
      var allowed = ['wrong_frog','why_tho','magic_word','bsod_fren','midnight_fren','nerd_alert','bali_dreamer',
        'happy_fren','born_to_fren','find_fren','address_check'];
      if (allowed.indexOf(id) < 0) return {};
      L.secrets = Array.isArray(L.secrets) ? L.secrets : [];
      var old = L.secrets.some(function (x) { return x.id === id; });
      if (!old) L.secrets.push({ id: id, discovered_at: now });
      frenLocal(L);
      return { id: id, new: !old, discovered_at: now };
    }
    if (name === 'gry_passport_state') {
      var me = whoAmI(), badges = FREN_TEST && Array.isArray(L.achievements) ? L.achievements.slice() : [];
      if (L.first_avatar && !badges.some(function (x) { return x.id === 'first_avatar'; }))
        badges.push({ id: 'first_avatar', title: 'Fresh Fren', earned_at: L.first_avatar });
      return { signed_in: true, preview: true, nickname: (me && me.name) || 'Test fren', member_since: L.since, yeet_best: null,
        achievements: badges, secrets: FREN_TEST && Array.isArray(L.secrets) ? L.secrets.slice() : [],
        items: [], progress: {}, avatar: L.avatar || null, test_all_unlocked: FREN_TEST && !!L.all_unlocked };
    }
    return {};
  }
  // In owner test mode passport calls are ALWAYS local: no server award/save/discover RPC is reachable.
  // In ordinary beta mode preserve the existing fallback until migrations launch.
  function frenRpc(name, args) {
    var s = sbSession();
    if (!FREN) return rpc(name, args);
    if (FREN_TEST) return frenTestAuthorize().then(function () { return frenPreview(name, args || {}); });
    if (!s || !s.discord) return Promise.resolve(frenPreview(name, args));
    return rpc(name, args).catch(function (err) { if (frenMissing(err)) return frenPreview(name, args); throw err; });
  }
  function frenTestChange(action, id) {
    return frenTestAuthorize().then(function () {
      var d = passportMine();
      if (!d || !d.catalog || !d.opts) throw new Error('Open the Passport again to load the test catalog.');
      var L = frenLocal(), now = new Date().toISOString();
      var badges = d.catalog.achievements || [], secrets = d.catalog.secrets || [];
      var badge = badges.find(function (x) { return x.id === id && x.id !== 'bali'; });
      var secret = secrets.find(function (x) { return x.id === id; });
      if (action === 'reset') {
        localStorage.removeItem(frenTestKey());
      } else if (action === 'all') {
        L.all_unlocked = !L.all_unlocked;
        frenLocal(L);
      } else {
        if (action === 'avatar') {
          var av = (d.opts.options.special || []).find(function (x) { return x.id === id && x.unlock; });
          if (!av) throw new Error('Choose a special avatar.');
          id = av.unlock;
          badge = badges.find(function (x) { return x.id === id && x.id !== 'bali'; });
          secret = secrets.find(function (x) { return x.id === id; });
          action = badge ? 'stamp' : 'secret';
        }
        if (action === 'stamp' && badge) {
          L.achievements = Array.isArray(L.achievements) ? L.achievements : [];
          if (!L.achievements.some(function (x) { return x.id === id; }))
            L.achievements.push({ id: id, title: badge.title || id, earned_at: now });
          frenLocal(L);
        } else if (action === 'secret' && secret) {
          L.secrets = Array.isArray(L.secrets) ? L.secrets : [];
          if (!L.secrets.some(function (x) { return x.id === id; }))
            L.secrets.push({ id: id, discovered_at: now });
          frenLocal(L);
        } else throw new Error('Unknown test reward.');
      }
      return passportLoad(sbSession()).then(function () {
        if (apps.passport && apps.passport.render) apps.passport.render();
      });
    });
  }
  // one read: the server snapshot, plus two static files from this site (labels and avatar parts)
  function passportLoad(session) {
    return Promise.all([
      frenRpc('gry_passport_state', {}),
      fetch(PP_CATALOG).then(function (r) { if (!r.ok) throw new Error('catalog'); return r.json(); }).catch(function () { return null; }),
      avatarOptions().catch(function () { return null; })
    ]).then(function (r) {
      if (r[0] && r[0].signed_in) passportCache = { userId: session ? session.userId : 'preview', preview: !!r[0].preview, state: r[0], catalog: r[1], opts: r[2] };
      return r[0];
    });
  }
  function passportMine() {
    var s = sbSession();
    if (FREN_TEST) return s && s.discord && passportCache && passportCache.preview && passportCache.userId === s.userId ? passportCache : null;
    if (FREN && passportCache && passportCache.preview) return passportCache;
    return s && s.discord && passportCache && passportCache.userId === s.userId ? passportCache : null;
  }
  // another fren's passport, read only (games/supabase/update_passport_public.sql): the server answers only
  // a fren logged on with Discord, and never sends the owner's progress counters. No local preview here:
  // what you see of somebody else is always what the server has.
  var FREN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function passportOf(id) {
    return Promise.all([
      rpc('gry_passport_public', { p_user: id }),
      fetch(PP_CATALOG).then(function (r) { if (!r.ok) throw new Error('catalog'); return r.json(); }).catch(function () { return null; }),
      avatarOptions().catch(function () { return null; })
    ]).then(function (r) { return { userId: id, state: r[0] || {}, catalog: r[1], opts: r[2] }; });
  }

  // ---------- Fren Passport art (hand-drawn, cut by scripts/build_passport_art.py) ----------
  // passport-assets/stamps.webp is one row of 16 stamp tiles (15 drawn stamps, then the '?' slot);
  // passport-assets/icons.webp is one row of 12 small Win98-style icons. The art is pure decoration:
  // which stamps are earned comes from the server state alone (see A.render).
  var PP_ART = 'passport-assets/', PP_ART_V = '?v=20261106pp1';
  var PP_STAMPS = ['calendar', 'gamepad', 'pickaxe', 'duck', 'magnifier', 'folders', 'computer', 'people',
    'sprout', 'handshake', 'rocket', 'binoculars', 'deerstalker', 'moon', 'joystick', 'locked'];
  var PP_ICONS = ['plane', 'calendar', 'trophy', 'box', 'gamepad', 'star', 'gift', 'tab_home', 'tab_trophy', 'tab_stamp', 'tab_box', 'tab_stats'];
  // The legacy atlas is used only for the uniform locked stamp icon.
  // All earned stamp art must come from the approved V3 atlas or the neutral placeholder.
  function ppSprite(cls, names, name, label) {
    var i = Math.max(0, names.indexOf(name));
    var n = el('span', label ? { class: cls, role: 'img', 'aria-label': label } : { class: cls, 'aria-hidden': 'true' });
    n.style.backgroundPositionX = (i * 100 / (names.length - 1)) + '%';
    return n;
  }
  // Pond Pioneer is its own exclusive v3 asset; no fallback to the former Lily sprite.
  // Keep the former Share Fren tile in this sprite index to preserve every later tile position;
  // Share Fren is now a secret rather than a stamp.
  // the owner-approved v3 stamps (passport-assets/stamps-v3.webp, scripts/build_v3_stamps.py): same order as the script
  var PP_V3 = ['frog_of_the_week', 'moonwalker', 'vox_populi', 'certified_fren', 'old_frog', 'good_parent', 'first_avatar',
    'detective_fren', 'good_game', 'yeet_adept', 'fud_buster', 'long_snake', 'arcade_hopper', 'secret_starter',
    'i_voted', 'checkmate', 'picasso_fren',
    'first_fren', 'sharp_eye', 'community_fren', 'like_it_here', 'nasa_is_hiring', 'rookie_miner',
    'season_champion', 'bug_hunter', 'podium', 'game_night', 'quiz_master', 'frogmas',
    'treasure_hunter', 'interior_designer', 'pep_birthday', 'thanksgiving_fren',
    'welcome_back', 'first_words', 'hey_fren', 'dear_editor', 'junior_editor', 'senior_editor', 'streak_14', 'pepe_guesser', 'week_scout',
    'scout_fren', 'first_hatch', 'little_fren', 'grown_fren', 'share_fren', 'valentine_fren'];
  // the 20 places on the Passport's front page, in order: gold row, silver row, then the first steps
  var PP_FRONT = ['moonwalker', 'season_champion', 'frog_of_the_week', 'certified_fren', 'treasure_hunter',
    'old_frog', 'vox_populi', 'checkmate', 'detective_fren', 'like_it_here',
    'first_fren', 'first_avatar', 'welcome_back', 'pepe_guesser', 'sharp_eye',
    'good_game', 'rookie_miner', 'dear_editor', 'i_voted', 'secret_starter'];
  // Only owner-approved art (#257): missing art gets a neutral placeholder, never Lily or another stamp's drawing.
  function ppStamp(x, earned) {
    if (earned && x.id === 'pond_pioneer') return el('span', {class:'pp-art pp-art-stamp is-pioneer',role:'img','aria-label':'Pond Pioneer'});
    if (earned && PP_V3.indexOf(x.id) >= 0) return ppSprite('pp-art pp-art-stamp is-v3', PP_V3, x.id);
    if (!earned) return ppSprite('pp-art pp-art-stamp', PP_STAMPS, 'locked');
    var pending = el('span', { class: 'pp-art pp-art-stamp is-pending', 'aria-hidden': 'true' });
    pending.textContent = '?';
    return pending;
  }
  function ppIcon(name) { return ppSprite('pp-art pp-art-icon', PP_ICONS, name); }

  // other: { id, nick } opens another fren's passport, read only (one window per fren); without it, your own
  function frenPassport(fromCache, other) {
    var mine = sbSession();
    if (other && (!FREN_ID.test(other.id || '') || (mine && mine.userId === other.id))) other = null;   // your own name opens your own
    var who = other ? other.nick || 'this fren' : '';
    var A = openApp(other ? 'passport:' + other.id.toLowerCase() : 'passport', other ? (other.nick ? 'Fren Passport - ' + other.nick : 'Fren Passport') : 'Fren Passport - Properties', 'pep-logo', function (A) {
      passportCss();
      A.host.classList.add('fren-win');
      A.body.innerHTML = '<div class="passport"><p class="passport-muted" role="status">' + (other ? 'Loading the Fren Passport of ' + esc(who) + '…' : 'Loading your Fren Passport…') + '</p></div>';
      function notice(message, needsLogin) {
        var box = A.body.querySelector('.passport');
        if (!box) return;
        box.replaceChildren();
        var p = el('p', {class:'passport-note',role:'status'}); p.textContent = message; box.appendChild(p);
        if (needsLogin) {
          var row = el('div', {class:'app-row'});
          var b = el('button', {type:'button',class:'app-btn'}); b.textContent = 'Log on with Discord';
          b.addEventListener('click', logOn); row.appendChild(b);
          var t = el('button', {type:'button',class:'app-btn'}); t.textContent = 'Try the Avatar Maker';
          t.addEventListener('click', function () { avatarMaker(); }); row.appendChild(t);
          box.appendChild(row);
        }
      }
      // The Passport is the hand-drawn open booklet inside the PondOS window chrome. The page art has
      // every sample value erased; the live layer on top fills in only real server data:
      //  - left page: the saved avatar shows through the photo window; Fren ID / nickname / member since / status
      //  - right page: the earned stamps (server earned_at only), then '?' slots; the BALI stamp is printed
      //    on the page and stays locked (future server-verified $0.01 condition, never awarded or priced here)
      //  - My Fren Journey and Next Milestone: factual counters only; no XP, levels or invented ranks
      // Tabs (Overview, Stamps, Collection, Stats) show the same data in list form.
      var tab = 0;
      A.render = function () {
        var d = other ? A.view : passportMine(), box = A.body.querySelector('.passport');
        if (!d || !box) return;
        var state=d.state, catalog=d.catalog;
        var earnedBadges = Array.isArray(state.achievements) ? state.achievements : [];
        var discovered = Array.isArray(state.secrets) ? state.secrets : [];
        var owned = Array.isArray(state.items) ? state.items : [];
        var find = function(list,id) { return list.find(function(x){return x.id===id;}); };
        var badges = catalog && Array.isArray(catalog.achievements) ? catalog.achievements : earnedBadges;
        var secrets = catalog && Array.isArray(catalog.secrets) ? catalog.secrets : discovered;
        var items = catalog && Array.isArray(catalog.items) ? catalog.items : owned;
        // honest earned test: present in server state with a real earned_at timestamp
        var earnedOf = function(id){ var e=find(earnedBadges,id); return e && e.earned_at ? e : null; };
        var MYTHIC_ID = 'bali';
        // Only what can be earned today is listed, plus the few catalog 'teaser' entries shown as '???' so
        // players know more is coming. Everything else that is planned stays out of sight until it goes live.
        var listed = function(x, got){ return x.status==='live' || x.teaser || !!got; };
        var regular = badges.filter(function(x){ return x.id!==MYTHIC_ID && (x.tier!=='mythic') && listed(x, earnedOf(x.id)); });
        var goal = regular.filter(function(x){ return x.status==='live' || !!earnedOf(x.id); }).length;
        secrets = secrets.filter(function(x){ var s = find(discovered, x.id); return listed(x, s && s.discovered_at); });
        items = items.filter(function(x){ return listed(x, find(owned, x.id)); });
        var secretsGoal = secrets.filter(function(x){ return x.status==='live'; }).length;
        var itemsGoal = items.filter(function(x){ return x.status==='live'; }).length;
        var earnedList = regular.filter(function(x){ return !!earnedOf(x.id); })
          .sort(function(a,b){ return String(earnedOf(b.id).earned_at).localeCompare(String(earnedOf(a.id).earned_at)); });
        var earnedCount = earnedList.length;
        var secretsCount = discovered.filter(function(s){ return !!s.discovered_at; }).length;
        var itemsCount = owned.length;
        // account age in whole days. This is NOT an activity counter (see the badge decisions doc).
        var days = state.member_since ? Math.max(0, Math.floor((Date.now() - new Date(state.member_since).getTime()) / 86400000)) : null;
        // games.yeet_records.best is stored in tenths of a metre (0..60000 = 0..6000 m), like the YEET high scores
        var yeetBest = typeof state.yeet_best === 'number' && isFinite(state.yeet_best) && state.yeet_best > 0 ? state.yeet_best / 10 : null;
        var metres = function(v){ return fmt.dec(v, 1) + ' m'; };
        function piece(tag,cls,value) { var n=el(tag,{class:cls}); n.textContent=value; return n; }
        function stampTitle(x, e) { return (x.title||x.id) + (e ? ' - earned ' + fmt.date(e.earned_at) : ' - locked'); }
        // stamps that cannot be earned yet keep their name to themselves: '???' and "Coming soon"
        function shown(x, e) { return e || x.status==='live' || x.id===MYTHIC_ID; }
        function nameOf(x, e) { return shown(x, e) ? (x.title||x.id) : '???'; }
        function stateOf(x) { return x.status!=='live' ? 'Coming soon' : x.limited ? 'Closed' : 'Locked'; }
        // the server's own counters (gry_passport_state.progress) for the stamps that have a count:
        // [now, goal, what is still missing]. Letters and chat have no counter on purpose, so nobody is
        // nudged to spam the editor or the lobby; those stamps can still be earned.
        var P = state.progress || {};
        var num = function(v){ return typeof v === 'number' && isFinite(v) ? v : 0; };
        var more = function(n, one, many){ return fmt.int(n) + ' more ' + (n === 1 ? one : many); };
        var PROG = {
          moonwalker: [yeetBest || 0, 6000, function(n){ return fmt.int(Math.ceil(n)) + ' m to go'; }],
          nasa_is_hiring: [num(P.yeet_5k_flights), 3, function(n){ return more(n, 'flight over 5000 m', 'flights over 5000 m'); }],
          detective_fren: [num(P.wp_perfect_days), 5, function(n){ return more(n, 'perfect 5000', 'perfect 5000s'); }],
          week_scout: [num(P.wp_streak), 7, function(n){ return more(n, 'day in a row', 'days in a row'); }],
          scout_fren: [num(P.wp_streak), 14, function(n){ return more(n, 'day in a row', 'days in a row'); }],
          streak_14: [num(P.login_streak), 14, function(n){ return more(n, 'day in a row', 'days in a row'); }],
          like_it_here: [num(P.login_streak), 30, function(n){ return more(n, 'day in a row', 'days in a row'); }]
        };
        // never suggested as the next goal: closed stamps, one-day chances, and anything that could invite spam
        var NOT_NEXT = { pond_pioneer: 1, welcome_back: 1, first_words: 1, hey_fren: 1, community_fren: 1, dear_editor: 1, junior_editor: 1, senior_editor: 1 };
        function openMaker() { avatarMaker(); }
        box.replaceChildren();

        // ---------- the booklet ----------
        var book = el('div', {class:'pp-book'});
        var left = el('section', {class:'pp-page pp-left','aria-label':'Fren identity'});
        var look = d.opts && avatarLook(d.opts, state.avatar);
        var photo = el('button', {type:'button',class:'pp-photo',title: other ? 'The Fren of ' + who : d.opts ? (look ? 'Edit your Fren' : 'Create your Fren') : 'Your Fren'});
        if (look) photo.appendChild(avatarStack(d.opts, look, (other ? 'The Fren of ' + who + ': ' : 'Your Fren: ') + avatarSay(d.opts, look)));
        else photo.appendChild(el('img',{src:'img/pep-logo.webp',alt:'PepecoinHub frog emblem',width:'64',height:'64'}));
        if (d.opts && !other) photo.addEventListener('click', openMaker); else photo.disabled = true;
        left.appendChild(photo);
        left.appendChild(el('img', {class:'pp-page-art',src:PP_ART+'page-left.webp'+PP_ART_V,alt:'',width:'360',height:'528',draggable:'false'}));
        var idcard = el('dl', {class:'pp-idcard'});
        function idrow(k,v,cls){ var r=el('div',{class:'pp-idrow'+(cls?' '+cls:'')}); r.appendChild(piece('dt','',k)); r.appendChild(piece('dd','',v)); idcard.appendChild(r); }
        idrow('Fren ID:', d.userId ? ('#'+String(d.userId).replace(/-/g,'').slice(0,8).toUpperCase()) : '—', 'is-id');
        idrow('Nickname:', state.nickname || 'Discord fren', 'is-nick');
        idrow('Member since:', state.member_since ? fmt.date(state.member_since) : 'unknown');
        idrow('Status:', state.preview ? 'Test preview' : 'Discord verified', 'is-status');
        left.appendChild(idcard);
        book.appendChild(left);

        var right = el('section', {class:'pp-page pp-right','aria-label':'Achievement stamps'});
        right.appendChild(el('img', {class:'pp-page-art',src:PP_ART+'page-right.webp'+PP_ART_V,alt:'',width:'360',height:'528',draggable:'false'}));
        right.appendChild(piece('p','sr','Achievement stamps: ' + earnedCount + ' of ' + goal + ' collected.'));
        // the front page is a showcase with a fixed place for each of the 20 key stamps (owner, 2026-11-09):
        // row 1 gold, row 2 silver, rows 3-4 first steps. Every other stamp lives in the Stamps tab.
        var grid = el('div', {class:'pp-grid'});
        PP_FRONT.forEach(function (fid, gi) {
          var gx = find(badges, fid) || { id: fid, title: fid };
          var ge = earnedOf(fid), tier = gi < 5 ? 'gold' : gi < 10 ? 'silver' : 'plain';
          var tip = ge ? stampTitle(gx, ge) : gx.title + ' (' + (tier === 'plain' ? '' : tier + ', ') + 'not yet): ' + (gx.description || '');
          var gc = el('div', {class:'pp-slot is-' + tier + (ge ? ' is-earned' : ' is-locked'), title: tip});
          gc.appendChild(ppStamp(gx, !!ge));
          gc.appendChild(piece('span','sr', tip));
          grid.appendChild(gc);
        });
        right.appendChild(grid);
        var baliE = earnedOf(MYTHIC_ID);
        var baliBtn = baliE
          ? el('button', {type:'button',class:'pp-bali is-earned','aria-label':'BALI: $0.01 - BALI. Mythic stamp, earned ' + fmt.date(baliE.earned_at) + '.',
              title:'BALI - earned ' + fmt.date(baliE.earned_at)})
          : el('button', {type:'button',class:'pp-bali','aria-label':'BALI: $0.01 - BALI. Reserved mythic stamp for every fren when Pepecoin reaches $0.01 USD. Locked.',
              title:'Reserved mythic stamp - every fren gets it when Pepecoin reaches $0.01 USD'});
        if (baliE) baliBtn.appendChild(baliMark(baliE));
        baliBtn.addEventListener('click', function(){ baliTouch(!!baliE, other); });
        right.appendChild(baliBtn);
        book.appendChild(right);

        // ---------- side panels: My Fren Journey + Next Milestone ----------
        var side = el('aside', {class:'pp-side'});
        var journey = el('section', {class:'pp-panel'});
        var jh = el('h3', {class:'pp-panel-h'}); jh.appendChild(ppIcon('plane')); jh.appendChild(document.createTextNode(other ? 'Fren Journey' : 'My Fren Journey')); journey.appendChild(jh);
        var jl = el('dl', {class:'pp-jlist'});
        [
          ['calendar', 'Days registered:', days==null?'—':fmt.int(days)],
          ['trophy', 'Stamps:', earnedCount+' / '+goal],
          ['box', 'Items collected:', itemsGoal ? itemsCount+' / '+itemsGoal : fmt.int(itemsCount)],
          ['star', 'Secrets found:', secretsCount+' / '+secretsGoal],
          ['gamepad', 'YEET best:', yeetBest==null?'—':metres(yeetBest)]
        ].forEach(function(v){
          var r = el('div', {class:'pp-jrow'}); r.appendChild(ppIcon(v[0])); r.appendChild(piece('dt','',v[1])); r.appendChild(piece('dd','',v[2])); jl.appendChild(r);
        });
        journey.appendChild(jl);
        side.appendChild(journey);

        // Next Milestone: the unearned LIVE stamp the player is closest to (catalog order breaks ties);
        // a progress bar only where the server state gives a true measure (PROG above).
        var near = function(x){ var p = PROG[x.id]; return p ? Math.min(p[0] / p[1], 0.999) : 0; };
        var next = regular.filter(function(x){ return x.status==='live' && !x.limited && !NOT_NEXT[x.id] && !earnedOf(x.id); })
          .reduce(function(best, x){ return !best || near(x) > near(best) ? x : best; }, null);
        var soon = !next;
        var mile = el('section', {class:'pp-panel pp-mile'});
        mile.appendChild(piece('h3','pp-panel-h is-blue','Next Milestone'));
        var mb = el('div', {class:'pp-mile-body'});
        if (next) {
          mb.appendChild(ppIcon('gift'));
          var mt = el('div', {class:'pp-mile-text'});
          var head = el('p', {class:'pp-mile-title'}); head.appendChild(piece('strong','',next.title||next.id));
          var pg = PROG[next.id], prog = pg && pg[1] > 1 ? [Math.min(pg[0], pg[1]), pg[1], pg[2]] : null;
          if (prog) head.appendChild(piece('span','pp-mile-n', prog[2](prog[1] - prog[0])));
          mt.appendChild(head);
          mt.appendChild(piece('p','pp-mile-desc', next.description || 'A server-verified stamp.'));
          mb.appendChild(mt);
          mile.appendChild(mb);
          if (prog) {
            var bar = el('div', {class:'pp-bar',role:'progressbar','aria-valuemin':'0','aria-valuemax':String(prog[1]),'aria-valuenow':String(prog[0]),'aria-label':(next.title||next.id)+' progress'});
            var fill = el('span'); fill.style.width = (prog[0] / prog[1] * 100).toFixed(1) + '%'; bar.appendChild(fill); mile.appendChild(bar);
          }
        } else {
          mb.appendChild(piece('p','pp-mile-desc', soon && regular.some(function(x){ return x.status!=='live'; })
            ? 'Every stamp you can earn today is yours. More are coming soon.' : 'Every stamp collected. Legend.'));
          mile.appendChild(mb);
        }
        // another fren's passport: no Next Milestone (the server does not send their counters) and no editing
        if (!other) side.appendChild(mile);
        if (d.opts && !other) {
          var make = el('button', {type:'button',class:'app-btn pp-make'});
          make.textContent = look ? 'Edit your Fren' : 'Create your Fren';
          make.addEventListener('click', openMaker);
          side.appendChild(make);
        }

        // ---------- tabs ----------
        var TABS = [['Overview','tab_home'],['Stamps','tab_stamp'],['Avatars','tab_trophy'],['Collection','tab_box'],['Stats','tab_stats']];
        var bar98 = el('div', {class:'tabs98 pp-tabs',role:'tablist','aria-label':'Passport sections'});
        var panes = [];
        TABS.forEach(function(t, i){
          var b = el('button', {type:'button',role:'tab',id:'pp-tab-'+i,'aria-controls':'pp-pane-'+i,'aria-selected':String(i===tab),tabindex:i===tab?'0':'-1'});
          b.appendChild(ppIcon(t[1])); b.appendChild(piece('span','',t[0]));
          b.addEventListener('click', function(){ pick(i); });
          b.addEventListener('keydown', function(ev){
            var k = ev.key==='ArrowRight' ? 1 : ev.key==='ArrowLeft' ? -1 : 0; if (!k) return;
            ev.preventDefault(); var j = (i + k + TABS.length) % TABS.length; pick(j); bar98.children[j].focus();
          });
          bar98.appendChild(b);
          panes.push(el('div', {class:'tabpane pp-pane',role:'tabpanel',id:'pp-pane-'+i,'aria-labelledby':'pp-tab-'+i}));
        });
        function pick(i) {
          tab = i;
          [].forEach.call(bar98.children, function(b, j){ b.setAttribute('aria-selected', String(j===i)); b.tabIndex = j===i ? 0 : -1; });
          panes.forEach(function(p, j){ p.hidden = j!==i; });
        }

        // Overview: the booklet, the side panels, and the most recent real stamps
        var over = el('div', {class:'pp-over'}); over.appendChild(book); over.appendChild(side);
        panes[0].appendChild(over);
        var recent = el('section', {class:'pp-panel pp-recent'});
        recent.appendChild(piece('h3','pp-panel-h','Recent Stamps'));
        var rl = el('ul', {class:'pp-recent-list'});
        for (var ri = 0; ri < 7; ri++) {
          var rx = earnedList[ri], li = el('li', {class: rx ? 'is-earned' : 'is-locked'});
          li.appendChild(ppStamp(rx || {}, !!rx));
          li.appendChild(piece('b','', rx ? (rx.title||rx.id) : '???'));
          if (rx) li.appendChild(piece('small','', fmt.date(earnedOf(rx.id).earned_at)));
          rl.appendChild(li);
        }
        recent.appendChild(rl);
        panes[0].appendChild(recent);

        // PepeGochi: the frog's card (read-only gry_pepegochi_state, once per Passport window)
        if (GOCHI) {
          var gc = el('section', {class:'pp-panel pp-gochi'});
          gc.appendChild(piece('h3','pp-panel-h','PepeGochi'));
          var gs = A.gochi;
          if (gs === undefined) {
            A.gochi = null;
            rpc('gry_pepegochi_state', {}).then(function (r) { A.gochi = r || false; if (A.render) A.render(); },
              function () { A.gochi = false; if (A.render) A.render(); });
            gc.appendChild(piece('p','pp-muted','Looking for your frog…'));
          } else if (!gs) {
            gc.appendChild(piece('p','pp-muted','Your frog could not be loaded right now.'));
          } else {
            var gp = gs.pet, gsum = gs.summary || {};
            if (!gp) gc.appendChild(piece('p','', 'No frog yet. Adopt an egg in PEPEGOCHI.EXE: its first care hatches it (First Hatch).'));
            else if (gp.status === 'departed') gc.appendChild(piece('p','', gp.name + ' moved out. GOODBYE.TXT is waiting for you in PEPEGOCHI.EXE.'));
            else {
              gc.appendChild(piece('p','pp-gochi-name', gp.name + ' · ' + gp.stage + ' · day ' + gp.life_day + (gp.generation > 1 ? ' · fren #' + gp.generation : '')));
              var gmood = { healthy:'Doing fine.', neglected:'Misses you: something is overdue.', packing:'Packing a tiny suitcase. Go now!', recovering:'Still upset. Come back on another day.' };
              gc.appendChild(piece('p', gp.status === 'packing' ? 'pp-gochi-warn' : '', gmood[gp.status] || gp.status));
              gc.appendChild(piece('p','pp-muted','Care days: ' + gp.care_days + ' · Good care days: ' + gp.good_days + ' / ' + (gp.good_days_goal || 30) + ' for Good Parent'));
            }
            if (gsum.former_frens) gc.appendChild(piece('p','pp-muted','Former frens: ' + gsum.former_frens + ' · Longest friendship: ' + gsum.longest_friendship_days + ' days'));
          }
          var go = el('button', {type:'button',class:'app-btn'}); go.textContent = 'Open PEPEGOCHI.EXE';
          go.addEventListener('click', function () { pepegochiApp(); });
          gc.appendChild(go);
          panes[0].appendChild(gc);
        } else {
          // PepeGochi comes after the Passport (owner, 2026-11-09): its place in the Passport is kept
          var gw = el('section', {class:'pp-panel pp-gochi is-soon'});
          gw.appendChild(piece('h3','pp-panel-h','PepeGochi'));
          var gr = el('div', {class:'pp-gochi-soon'});
          gr.appendChild(el('img', {src: BASE + 'games/img/pepegochi/pepegochi_egg_idle.png', alt: '', width: '48', height: '48'}));
          gr.appendChild(piece('p','', 'Coming soon: your own frog to hatch and look after. Its stamps will be in this Passport.'));
          gw.appendChild(gr);
          panes[0].appendChild(gw);
        }

        // Stamps: the album on passport paper. Tap a stamp to read how it is earned (no hover on phones).
        var sheet = el('div', {class:'pp-sheet'});
        sheet.appendChild(piece('h3','pp-sheet-h','Achievement Stamps'));
        sheet.appendChild(piece('p','pp-sheet-count', earnedCount+' of '+goal+' stamps earned'));
        var album = el('div', {class:'pp-album'});
        var info = el('p', {class:'pp-sheet-info','aria-live':'polite'});
        info.textContent = 'Tap a stamp to see how to earn it.';
        regular.forEach(function(x){
          var e = earnedOf(x.id);
          var c = el('button', {type:'button',class:'pp-stamp'+(e?' is-earned':' is-locked'), title: shown(x, e) ? x.description || '' : 'Coming soon'});
          c.appendChild(ppStamp(x, !!e));
          c.appendChild(piece('b','pp-stamp-name', nameOf(x, e)));
          // Frog of the Week can be won again: the server counts the wins (times)
          c.appendChild(piece('small','pp-stamp-sub', e ? (e.times > 1 ? '×' + e.times + ' · ' : '') + fmt.date(e.earned_at) : stateOf(x)));
          c.addEventListener('click', function(){
            [].forEach.call(album.children, function(n){ n.classList.toggle('is-picked', n===c); });
            info.textContent = nameOf(x, e) + ': ' + (shown(x, e) ? x.description || '' : 'A new stamp is on its way.');
          });
          album.appendChild(c);
        });
        sheet.appendChild(album);
        sheet.appendChild(info);
        var mythic = el('div', {class:'pp-mythic ' + (baliE ? 'is-earned' : 'is-locked'), role:'button', tabindex:'0',
          title: baliE ? 'BALI - earned ' + fmt.date(baliE.earned_at) : 'Reserved mythic stamp - every fren gets it when Pepecoin reaches $0.01 USD'});
        mythic.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); baliTouch(!!baliE); } });
        var ticket = el('div', {class:'pp-mythic-ticket'});
        ticket.appendChild(el('img', {src:PP_ART+'bali-ticket.webp'+PP_ART_V, alt: baliE ? 'BALI, $0.01 - BALI. Earned.' : 'BALI, $0.01 - BALI. Locked.', width:'310', height:'114', draggable:'false'}));
        if (baliE) ticket.appendChild(baliMark(baliE));
        mythic.appendChild(ticket);
        mythic.appendChild(piece('small','', baliE ? 'Pepecoin reached $0.01. Welcome to Bali, fren. Stamped ' + fmt.date(baliE.earned_at) + '.'
          : 'Reserved for every fren when Pepecoin reaches $0.01 USD. Locked until then.'));
        mythic.addEventListener('click', function(){ baliTouch(!!baliE); });
        sheet.appendChild(mythic);
        panes[1].appendChild(sheet);

        // Avatars: the special avatars of Create Your Fren, and what opens each one
        if (d.opts) {
          var ownsAv = function (u) { return !!(FREN_TEST && state.test_all_unlocked) || !!earnedOf(u) || discovered.some(function (x) { return x.id === u && x.discovered_at; }); };
          var avs = (d.opts.options.special || []).filter(function (p) { return p.id !== AV_PLAIN; });
          var avOpen = avs.filter(function (p) { return !p.unlock || ownsAv(p.unlock); }).length;
          var avSec = el('section', {class:'pp-panel pp-avatars'});
          avSec.appendChild(piece('h3','pp-panel-h','Special Avatars  ' + avOpen + ' / ' + avs.length));
          var avGrid = el('ul', {class:'pp-av-grid'});
          avs.forEach(function (p) {
            var open = !p.unlock || ownsAv(p.unlock), worn = look && look.special === p.id;
            var li = el('li', {class:'pp-av' + (open ? ' is-open' : ' is-locked') + (worn ? ' is-worn' : '')});
            var pic = el('span', {class:'pp-av-pic'});
            pic.appendChild(el('img', {src: d.opts.paths.layer_template.replace('{id}', p.id), alt:'', loading:'lazy', width:'96', height:'96', draggable:'false'}));
            if (!open) pic.appendChild(piece('i','pp-av-lock','🔒'));
            li.appendChild(pic);
            li.appendChild(piece('b','', avName(p)));
            li.appendChild(piece('small','', open ? (worn ? 'Wearing it now' : 'Unlocked') : avHow(p.unlock)));
            if (open && !other) {   // another fren's passport: look only, the buttons would open your own maker
              var wear = el('button', {type:'button',class:'app-btn pp-av-btn'});
              wear.textContent = worn ? 'Edit your Fren' : 'Wear it';
              wear.addEventListener('click', function () { avatarMaker(); });
              li.appendChild(wear);
            }
            avGrid.appendChild(li);
          });
          avSec.appendChild(avGrid);
          avSec.appendChild(piece('p','pp-muted', other ? 'The special avatars ' + who + ' has opened. Each fren picks theirs in Create Your Fren.'
            : 'A special avatar covers your Fren\'s parts (not the background). Pick one in Create Your Fren, under Special.'));
          panes[2].appendChild(avSec);
        } else {
          panes[2].appendChild(piece('p','pp-muted','The avatar list did not load. Close the Passport and open it again.'));
        }

        // Collection: items and secrets, as the server lists them
        function collect(title, list, has, sub) {
          var sec = el('section', {class:'pp-panel'});
          sec.appendChild(piece('h3','pp-panel-h', title));
          var ul = el('ul', {class:'pp-list'});
          list.forEach(function(x){
            var got = has(x), li = el('li', {class:'pp-row'+(got?' is-earned':'')});
            li.appendChild(ppIcon(got ? 'box' : 'gift'));
            var tx = el('div'); tx.appendChild(piece('b','', got || x.status==='live' && x.hint ? (x.title||x.id) : '???'));
            tx.appendChild(piece('small','', got ? (x.description||'') : (x.hint || x.description || '')));
            li.appendChild(tx);
            li.appendChild(piece('span','pp-tag'+(got?' is-on':''), got ? sub(got) : (x.status==='live' ? 'Not found yet' : 'Coming soon')));
            ul.appendChild(li);
          });
          sec.appendChild(ul);
          return sec;
        }
        var cgrid = el('div', {class:'pp-cols'});
        cgrid.appendChild(collect('Items  ' + (itemsGoal ? itemsCount + ' / ' + itemsGoal : itemsCount), items, function(x){ return find(owned, x.id); }, function(){ return 'Owned'; }));
        cgrid.appendChild(collect('Secrets  ' + secretsCount + ' / ' + secretsGoal, secrets,
          function(x){ var s = find(discovered, x.id); return s && s.discovered_at ? s : null; }, function(s){ return 'Found ' + fmt.date(s.discovered_at); }));
        panes[3].appendChild(cgrid);

        // Stats: factual numbers from the server snapshot
        var stSec = el('section', {class:'pp-panel pp-statsheet'});
        stSec.appendChild(piece('h3','pp-panel-h','Fren Stats'));
        var st = el('dl', {class:'pp-stats'});
        [
          ['Member since', state.member_since ? fmt.date(state.member_since) : 'unknown'],
          ['Days registered (account age)', days==null?'—':fmt.int(days)],
          ['Stamps earned', earnedCount+' / '+goal],
          ['Secrets found', secretsCount+' / '+secretsGoal],
          ['Items collected', itemsGoal ? itemsCount+' / '+itemsGoal : fmt.int(itemsCount)],
          ['Best YEET flight', yeetBest==null?'—':metres(yeetBest)],
          ['Avatar saved', look ? 'Yes' : 'Not yet']
        ].forEach(function(v){ var r=el('div'); r.appendChild(piece('dt','',v[0])); r.appendChild(piece('dd','',v[1])); st.appendChild(r); });
        stSec.appendChild(st);
        stSec.appendChild(piece('p','pp-muted','Days registered counts calendar days since ' + (other ? 'this fren' : 'you') + ' joined; it is not an activity counter.'));
        panes[4].appendChild(stSec);

        box.appendChild(bar98);
        panes.forEach(function(p){ box.appendChild(p); });
        pick(tab);
        if (state.preview) {
          var pv = el('p', { class: 'passport-note fren-preview', role: 'note' });
          pv.textContent = FREN_TEST
            ? 'OWNER SANDBOX (?beta=fren-test): simulated stamps, secrets and avatar looks exist only in this browser. No real rewards are awarded.'
            : 'TEST PREVIEW (?beta=fren): kept in this browser only. Nothing is saved on the server and no stamp here is real.';
          box.insertBefore(pv, box.firstChild);
        }
        if (FREN_TEST && !other && state.preview && d.opts && catalog) {
          var sandbox = el('section', { class: 'pp-test-tools', 'aria-label': 'Owner test sandbox' });
          sandbox.appendChild(piece('h3', 'pp-test-heading', 'Owner test sandbox'));
          sandbox.appendChild(piece('p', 'pp-test-info', 'Simulate unlocks to inspect every avatar and stamp. Stored in this browser only; no Supabase writes.'));
          var status = piece('p', 'pp-test-status', '');
          function runTest(action, id, button) {
            button.disabled = true;
            frenTestChange(action, id).catch(function (err) {
              if (status.isConnected) status.textContent = (err && err.message) || 'Could not update the local test sandbox.';
            }).then(function () { button.disabled = false; });
          }
          function testRow(title, values, buttonText, action) {
            var row = el('div', { class: 'pp-test-row' });
            var sel = el('select', { class: 'pp-test-select', 'aria-label': title });
            values.forEach(function (v) {
              var option = el('option', { value: v.id });
              option.textContent = v.label || v.title || v.id;
              sel.appendChild(option);
            });
            var button = el('button', { type: 'button', class: 'app-btn' });
            button.textContent = buttonText;
            button.disabled = !values.length;
            button.addEventListener('click', function () { runTest(action, sel.value, button); });
            row.appendChild(sel); row.appendChild(button); sandbox.appendChild(row);
          }
          testRow('Special avatar', (d.opts.options.special || []).filter(function (x) { return x.unlock; }),
            'Unlock avatar', 'avatar');
          testRow('Stamp', (catalog.achievements || []).filter(function (x) { return x.id !== 'bali'; }),
            'Simulate stamp', 'stamp');
          testRow('Secret or event', catalog.secrets || [], 'Simulate secret', 'secret');
          var actions = el('div', { class: 'pp-test-row' });
          var all = el('button', { type: 'button', class: 'app-btn' });
          all.textContent = state.test_all_unlocked ? 'Disable all-unlocked preview' : 'Preview all avatars unlocked';
          all.addEventListener('click', function () { runTest('all', '', all); });
          var reset = el('button', { type: 'button', class: 'app-btn' });
          reset.textContent = 'Reset sandbox';
          reset.addEventListener('click', function () {
            if (window.confirm('Reset only the local owner test sandbox? Real achievements will not change.'))
              runTest('reset', '', reset);
          });
          actions.appendChild(all); actions.appendChild(reset);
          sandbox.appendChild(actions); sandbox.appendChild(status);
          box.insertBefore(sandbox, box.firstChild);
        }
        if (other) {
          var ro = el('p', { class: 'passport-note pp-other', role: 'note' });
          ro.textContent = 'The Fren Passport of ' + who + ', as the server has it. Only they can change it.';
          box.insertBefore(ro, box.firstChild);
        }
      };
      var session = sbSession();
      if (other) {
        if (!session || !session.discord) { notice('Log on with Discord to look at the Fren Passports of other frens.', true); return; }
        passportOf(other.id).then(function (v) {
          if (!v.state.signed_in) { notice('Your Discord session expired. Please log on again.', true); return; }
          if (!v.state.found) { notice(who + ' has no Fren Passport. Only frens logged on with Discord have one.', false); return; }
          if (!other.nick && (v.state.nick || v.state.nickname)) {   // opened from a link: the name comes from the server
            who = v.state.nick || v.state.nickname;
            var wt = A.host.querySelector('.win-t'); if (wt) wt.textContent = 'Fren Passport - ' + who;
            A.host.setAttribute('aria-label', 'Fren Passport - ' + who);
          }
          A.view = v; A.render();
        }).catch(function (err) {
          notice(frenMissing(err) ? 'Looking at the Fren Passports of other frens is waiting for its database update.'
            : 'Could not load this Fren Passport. Please try again later.', false);
        });
        return;
      }
      if (!FREN && (!session || !session.discord)) {
        notice('Log on with Discord to see your private passport. Guest scores do not create a permanent collection.', true);
        return;
      }
      // back from the Avatar Maker: the snapshot it just updated is enough
      if (fromCache === true && passportMine()) { A.render(); return; }
      passportLoad(session).then(function (state) {
        if (!state || !state.signed_in) { notice('Your Discord session expired. Please log on again.', true); return; }
        A.render();
      }).catch(function(err){
        notice(/PGRST202|could not find the function|does not exist/i.test(err.message||'')
          ? 'Fren Passport is waiting for its database update.'
          : FREN_TEST ? (err.message || 'Owner sandbox access denied.') : 'Could not load your profile. Please try again later.',false);
      });
    }, 1000);
    return A;
  }

  // ---------- Create Your Fren: the Avatar Maker of the Fren Passport ----------
  // The player's own hand-drawn Fren, stacked from aligned 512×512 hand-drawn WebP layers in avatar-assets/layers/
  // (listed in avatar-options.json, schema_version 2). Every layer shares one 0 0 512 512 canvas with the
  // same head/eye/mouth/shoulder geometry, so the parts stack with no per-part offsets. The editable slots
  // are bg, clothing, mouth, eyes, hat and accessory; base (defaults.base) is an implied constant layer that
  // is always painted between bg and clothing and is never a choice. Options carrying an 'unlock' key are
  // reward parts: they open once the server state holds that stamp; until then the maker shows them with a lock
  // (not pickable), and the save RPC checks the stamp again on its own.
  // Picking parts and Randomize only change this preview, with no server traffic. Save Look is the one write
  // (gry_passport_avatar_save, six ids bg/clothing/mouth/eyes/hat/accessory): only its answer counts as saved,
  // and the server alone awards Fresh Fren (first_avatar) for the first look it saves.
  var AV_SLOTS = [['bg', 'Background'], ['clothing', 'Clothing'], ['mouth', 'Mouth'], ['eyes', 'Eyes'], ['hat', 'Hat'], ['accessory', 'Accessory'], ['special', 'Special']];
  // Special avatars: a whole character drawn by Lily for a big milestone. When one is picked it covers every
  // part layer except the background; the parts stay saved underneath.
  var AV_PLAIN = 'special_none';
  function avatarSpecial(look) { return !!look && !!look.special && look.special !== AV_PLAIN; }
  var avOpts = null;
  function avatarOptions() {
    if (!avOpts) {
      avOpts = fetch('avatar-options.json?v=20261111launch').then(function (r) { if (!r.ok) throw new Error('avatar options'); return r.json(); });
      avOpts.catch(function () { avOpts = null; });
    }
    return avOpts;
  }
  // the offerable (selectable) options for a slot: the free parts, plus reward parts whose stamp the player has
  // (owns(stampId) reads the server state). The save RPC rejects a reward part without its stamp anyway.
  function avatarPicks(o, k, owns) { return (o.options[k] || []).filter(function (p) { return !p.unlock || (owns && owns(p.unlock)); }); }
  // a clean copy of a look, or null unless every slot holds a known part
  function avatarLook(o, x) {
    if (!o || !o.options || !x || typeof x !== 'object') return null;
    var look = {};
    for (var i = 0; i < AV_SLOTS.length; i++) {
      var k = AV_SLOTS[i][0], id = x[k];
      if (k === 'special' && id == null) id = AV_PLAIN;   // looks saved before special avatars existed
      if (!(o.options[k] || []).some(function (p) { return p.id === id; })) return null;
      look[k] = id;
    }
    return look;
  }
  function avatarSame(a, b) { return !!a && !!b && AV_SLOTS.every(function (s) { return a[s[0]] === b[s[0]]; }); }
  // base is the one constant layer (defaults.base); every editable layer resolves to its chosen id
  function avatarSrc(o, layer, look) {
    if (layer === 'base') return o.paths.base || o.paths.layer_template.replace('{id}', o.defaults.base);
    return o.paths.layer_template.replace('{id}', look[layer]);
  }
  function avatarStack(o, look, label) {
    var cls = 'fa-stack' + (avatarSpecial(look) ? ' is-special' : '');
    var s = el('span', label ? { class: cls, role: 'img', 'aria-label': label } : { class: cls, 'aria-hidden': 'true' });
    o.layers_order.forEach(function (layer) { s.appendChild(el('img', { src: avatarSrc(o, layer, look), alt: '', 'data-layer': layer, draggable: 'false' })); });
    avatarFit(o, s, look);
    return s;
  }
  // a cigarette or pipe (option with in_mouth) goes under the mouth layer and moves to that mouth's corner,
  // so every mouth holds it; any other accessory stays on top at its own place
  function avatarFit(o, stack, look) {
    var pick = function (k) { return (o.options[k] || []).filter(function (p) { return p.id === look[k]; })[0] || {}; };
    var acc = stack.querySelector('img[data-layer="accessory"]'), mouth = stack.querySelector('img[data-layer="mouth"]');
    if (!acc || !mouth) return;
    var a = pick('accessory').in_mouth, c = pick('mouth').corner;
    if (a && c) {
      acc.style.translate = ((c[0] - a[0]) / 5.12) + '% ' + ((c[1] - a[1]) / 5.12) + '%';   // 'translate', not 'transform': the maker frame already centres its layers with a transform
      if (acc.nextSibling !== mouth) stack.insertBefore(acc, mouth);
    } else {
      acc.style.translate = '';
      var after = stack.querySelector('img[data-layer="hat"]');
      if (after && after.nextSibling !== acc) stack.insertBefore(acc, after.nextSibling);
    }
  }
  function avatarSay(o, look) {
    var name = function (k) { var p = o.options[k].filter(function (x) { return x.id === look[k]; })[0]; return p ? p.label : look[k]; };
    if (avatarSpecial(look)) return name('special') + ', ' + name('bg');
    return AV_SLOTS.filter(function (s) { return s[0] !== 'special'; }).map(function (s) { var p = o.options[s[0]].filter(function (x) { return x.id === look[s[0]]; })[0]; return p ? p.label : look[s[0]]; }).join(', ');
  }
  // the maker window art (scripts/build_maker_art.py) and its icon row: one 48px cell per icon
  var FA_V = '?v=20261106mk1';
  var FA_ICONS = ['mouth', 'eyes', 'hat', 'clothing', 'accessory', 'dice', 'floppy', 'check', 'passport'];
  function faIcon(name) {
    var n = el('span', { class: 'fa-ico', 'aria-hidden': 'true' });
    n.style.backgroundPositionX = (Math.max(0, FA_ICONS.indexOf(name)) * 100 / (FA_ICONS.length - 1)) + '%';
    return n;
  }
  // rows in the mockup's order (slot, label, icon); the background row comes last
  var FA_ROWS = [['mouth', 'Mouth', 'mouth'], ['eyes', 'Eyes', 'eyes'], ['hat', 'Hat', 'hat'], ['clothing', 'Clothing', 'clothing'],
    ['accessory', 'Accessory', 'accessory'], ['bg', 'Background', null], ['special', 'Special', null]];
  // which stamp opens a reserved part (catalog titles)
  // (only stamps that can be earned today are named; the others stay "a future stamp", like '???' in the Passport)
  var FA_UNLOCK = { detective_fren: 'Detective Fren', rookie_miner: 'Happy Mining!', scout_fren: 'Scout Fren', good_game: 'Good Game',
    yeet_adept: 'Adept', arcade_hopper: 'Arcade Hopper', secret_starter: 'Secret Starter', dear_editor: 'Dear Editor',
    senior_editor: 'Senior Editor', frogmas: 'Frogmas', old_frog: 'Old Frog', welcome_back: 'Welcome Back',
    streak_14: '14-day streak', like_it_here: 'I Like It Here', certified_fren: 'Certified Fren', nasa_is_hiring: 'NASA Is Hiring', fud_buster: 'FUD Buster' };
  // event days: open to every fren who visits PondOS on that day (the check-in gives them)
  var FA_EVENT = { pep_birthday: 'visit PondOS on 30 January, Pepecoin\'s birthday', thanksgiving_fren: 'visit PondOS on Thanksgiving weekend',
    valentine_fren: 'visit PondOS on 14 February, Valentine\'s Day' };
  // how a locked special avatar opens, in a few words (secrets keep their hiding place to themselves)
  function avHow(u) {
    if (FA_EVENT[u]) return 'Opens when you ' + FA_EVENT[u] + '.';
    if (FA_SECRET[u]) return 'Hidden behind a secret somewhere in PondOS.';
    if (u === 'frogmas') return 'Earn the Frogmas stamp: visit PondOS on 24–26 December.';
    return 'Earn the ' + (FA_UNLOCK[u] || 'matching') + ' stamp.';
  }
  function avName(p) { return String(p.label || p.id).replace(/\s*\([^)]*\)\s*$/, ''); }
  // special avatars hidden behind a secret: the lock says only that (no hint where)
  var FA_SECRET = { why_tho: 1, midnight_fren: 1, happy_fren: 1, nerd_alert: 1, born_to_fren: 1, bali_dreamer: 1, find_fren: 1, address_check: 1, share_fren: 1 };
  function avatarMaker() {
    return openApp('avatar', 'Create Your Fren - Avatar Maker', 'pep-logo', function (A) {
      passportCss();
      A.host.classList.add('fren-win');
      A.body.innerHTML = '<div class="fa-load"><p class="passport-muted" role="status">Loading the Avatar Maker…</p></div>';
      var session = sbSession(), signed = FREN || !!(session && session.discord && session.userId);
      // opened from the Passport: its snapshot already has the saved look; otherwise read it once
      var loading = FREN_TEST
        ? frenTestAuthorize().then(function () { return Promise.all([avatarOptions(), passportLoad(session)]); })
        : Promise.all([avatarOptions(), signed && !passportMine() ? passportLoad(session).catch(function () { return null; }) : null]);
      loading.then(function (r) {
        if (signed && r[1] && !r[1].signed_in) signed = false;
        build(r[0], signed);
      }, function (err) {
        var box = A.body.querySelector('.fa-load');
        if (box) box.replaceChildren(piece('p', 'passport-note', FREN_TEST ? (err.message || 'Owner verification failed.') : 'Could not load the Fren parts. Please try again later.'));
      });
      function build(o, signed) {
        var d = signed ? passportMine() : null;
        // a stamp the server says this player has earned (reward parts open with it)
        var owns = function (id) {
          var l = d && Array.isArray(d.state.achievements) ? d.state.achievements : [], s = d && Array.isArray(d.state.secrets) ? d.state.secrets : [];
          return !!(FREN_TEST && d && d.state.test_all_unlocked) ||
            l.some(function (b) { return b.id === id && !!b.earned_at; }) || s.some(function (x) { return x.id === id && !!x.discovered_at; });
        };
        var saved = d ? avatarLook(o, d.state.avatar) : null;
        var start = saved || avatarLook(o, o.defaults);
        var look = Object.assign({}, start), pending = false, msg = '', strips = [];
        // Layout of the owner's mockup: title band, the Fren in a taped photo frame on the left, one row
        // per part on the right (arrows scroll the row), then Randomize / Save Look / Use in Passport.
        // Each row shows the part itself; the player picks every part on their own.
        var wrap = el('div', { class: 'fa' });
        var head = el('img', { class: 'fa-head', src: 'avatar-assets/maker/header.webp' + FA_V, width: '880', height: '104',
          alt: 'Fren Passport, PepecoinHub. Avatar Maker: create your custom Pepe for your Fren Passport.' });
        var main = el('div', { class: 'fa-main' }), side = el('div', { class: 'fa-side' }), frame = el('div', { class: 'fa-frame' });
        var big = avatarStack(o, look, 'Preview');
        frame.appendChild(big);
        frame.appendChild(el('img', { class: 'fa-frame-art', src: 'avatar-assets/maker/frame.webp' + FA_V, alt: '', width: '296', height: '364', draggable: 'false' }));
        side.appendChild(frame);
        var who = el('p', { class: 'fa-who' }); who.textContent = d && d.state.nickname ? d.state.nickname : signed ? 'Discord fren' : 'Guest preview';
        var said = el('p', { class: 'fa-state', role: 'status' });
        side.appendChild(who); side.appendChild(said);
        if (FREN_TEST && d && d.preview) {
          // Put the test unlock on the Maker itself; on phones the Passport may be minimized behind it.
          // Owner authorization and all test awards remain in the existing isolated QA engine.
          var qaTag = el('p', { class: 'fa-owner-tag' });
          qaTag.textContent = 'OWNER SANDBOX · Local test only';
          side.appendChild(qaTag);
          var qaUnlock = el('button', { type: 'button', class: 'app-btn fa-owner-unlock' });
          qaUnlock.textContent = d.state.test_all_unlocked ? 'Relock test rewards' : 'Unlock all (test only)';
          qaUnlock.addEventListener('click', function () {
            if (pending) return;
            qaUnlock.disabled = true;
            frenTestChange('all', '').then(function () {
              // Rebuild the radio options: each option's locked state and change handler
              // is created once. Reopening uses the saved local avatar and fresh QA flags.
              A.close();
              avatarMaker();
            }, function (err) {
              msg = (err && err.message) || 'Could not change test unlocks.';
              qaUnlock.disabled = false;
              status();
            });
          });
          side.appendChild(qaUnlock);
        }
        main.appendChild(side);
        var parts = el('div', { class: 'fa-parts' });
        FA_ROWS.forEach(function (row) {
          var k = row[0];
          var fs = el('fieldset', { class: 'fa-group' }), lg = el('legend', { class: 'fa-legend' }), strip = el('div', { class: 'fa-opts' });
          lg.appendChild(!row[2] ? el('img', { class: 'fa-rowicon is-bg', src: o.paths.thumb_template.replace('{id}', k === 'bg' ? o.defaults.bg : 'special_explorer'), alt: '' }) : faIcon(row[2]));
          lg.appendChild(document.createTextNode(row[1] + ':'));
          fs.appendChild(lg);
          // the arrows are a mouse/touch shortcut; keyboard users move through a row with the arrow keys
          // (the focused part scrolls into view), and Tab goes to the next row
          var prev = el('button', { type: 'button', class: 'fa-arr is-prev', tabindex: '-1', 'aria-hidden': 'true' });
          var next = el('button', { type: 'button', class: 'fa-arr is-next', tabindex: '-1', 'aria-hidden': 'true' });
          (o.options[k] || []).forEach(function (p) {
            var locked = !!p.unlock && !owns(p.unlock), stamp = locked && FA_UNLOCK[p.unlock] || 'a future stamp';
            var lab = el('label', { class: 'fa-opt' + (locked ? ' is-locked' : ''), title: locked ? (FA_SECRET[p.unlock] || FA_EVENT[p.unlock] ? p.label + ' - locked: ' + avHow(p.unlock) : p.label + ' - locked: earn the ' + stamp + ' stamp') : p.label });
            var inp = el('input', { type: 'radio', name: 'fa-' + k, value: p.id });
            // reserved parts are shown with a lock and cannot be picked; the save RPC rejects them too
            if (locked) inp.disabled = true;
            inp.checked = look[k] === p.id;
            inp.addEventListener('change', function () {
              if (!inp.checked || locked) return;
              look[k] = p.id;
              // picking a part shows the parts again (a special avatar would hide it)
              if (k !== 'bg' && k !== 'special') look.special = AV_PLAIN;
              msg = ''; paint();
            });
            var t = el('span', { class: 'fa-thumb' + (k === 'bg' ? ' is-bg' : '') });
            t.appendChild(el('img', { src: o.paths.thumb_template.replace('{id}', p.id), alt: '', draggable: 'false', loading: 'lazy' }));
            var name = el('span', { class: 'fa-lab' }); name.textContent = p.label + (locked ? ' (locked: ' + stamp + ' stamp)' : '');
            lab.appendChild(inp); lab.appendChild(t); lab.appendChild(name); strip.appendChild(lab);
          });
          var ends = function () {
            prev.disabled = strip.scrollLeft <= 1;
            next.disabled = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 1;
          };
          prev.addEventListener('click', function () { strip.scrollBy({ left: -strip.clientWidth * 0.8, behavior: 'smooth' }); });
          next.addEventListener('click', function () { strip.scrollBy({ left: strip.clientWidth * 0.8, behavior: 'smooth' }); });
          strip.addEventListener('scroll', ends, { passive: true });
          fs.appendChild(prev); fs.appendChild(strip); fs.appendChild(next);
          parts.appendChild(fs);
          setTimeout(ends, 0);
          strips.push({ strip: strip, ends: ends, k: k });
        });
        main.appendChild(parts);
        var foot = el('div', { class: 'fa-foot' });
        var note = el('p', { class: 'fa-note' });
        note.appendChild(faIcon('passport'));
        note.appendChild(el('span', {}, signed ? 'This avatar is used in your <b>Fren Passport</b>. Every part is free; changes stay here until you press Save Look.'
          : 'Every part is free. Try any look as a guest; log on with Discord to save it to your <b>Fren Passport</b>.'));
        var bar = el('div', { class: 'app-row fa-actions' });
        var btn = function (cls, icon, text) {
          var b = el('button', { type: 'button', class: 'app-btn ' + cls }); b.appendChild(faIcon(icon));
          var tx = el('span', { class: 'fa-btn-t' }); tx.textContent = text; b.appendChild(tx); return b;
        };
        var rnd = btn('fa-random', 'dice', 'Randomize');
        var saveB = btn('fa-save', 'floppy', signed ? 'Save Look' : 'Log on to save');
        var useB = btn('fa-use', 'check', 'Use in Passport');
        var setBtn = function (b, text) { b.querySelector('.fa-btn-t').textContent = text; };
        bar.appendChild(rnd); bar.appendChild(saveB); bar.appendChild(useB);
        foot.appendChild(note); foot.appendChild(bar);
        wrap.appendChild(head); wrap.appendChild(main); wrap.appendChild(foot);
        A.body.replaceChildren(wrap);
        // keep the chosen part in view in its row
        function showPicked() {
          strips.forEach(function (s) {
            var on = s.strip.querySelector('input:checked');
            if (on) { var l = on.parentNode, r = l.offsetLeft - s.strip.offsetLeft; if (r < s.strip.scrollLeft || r + l.offsetWidth > s.strip.scrollLeft + s.strip.clientWidth) s.strip.scrollLeft = r - 8; }
            s.ends();
          });
        }
        var setSrc = function (img, src) { if (img.getAttribute('src') !== src) img.setAttribute('src', src); };
        function paint() {
          big.querySelectorAll('img').forEach(function (img) { setSrc(img, avatarSrc(o, img.getAttribute('data-layer'), look)); });
          avatarFit(o, big, look);
          big.setAttribute('aria-label', 'Preview: ' + avatarSay(o, look));
          big.classList.toggle('is-special', avatarSpecial(look));
          parts.querySelectorAll('input').forEach(function (inp) { inp.checked = look[inp.name.slice(3)] === inp.value; });
          status();
        }
        function status() {
          var dirty = !avatarSame(look, saved);
          said.textContent = pending ? 'Saving…' : msg ? msg : !signed ? 'Preview only. Log on with Discord to save.'
            : !saved ? (avatarSame(look, start) ? 'Not saved yet.' : 'Unsaved changes') : dirty ? 'Unsaved changes'
              : FREN_TEST ? 'Saved locally in owner sandbox (not a real reward).' : d && d.preview ? 'Saved in this browser (test preview).' : 'Saved in your Fren Passport.';
          said.classList.toggle('is-dirty', !pending && (!!msg || said.textContent === 'Unsaved changes'));
          saveB.disabled = pending || (signed && !!saved && !dirty);
          useB.disabled = !signed || pending;
          rnd.disabled = pending;
        }
        function failText(err) {
          var m = (err && err.message) || '';
          if (/PGRST202|could not find the function|does not exist/i.test(m)) return 'Saving is waiting for its database update. Your look was not saved.';
          if (/Log on with Discord|JWT/i.test(m)) return 'Your Discord session expired. Log on again to save.';
          if (/^(Saving too fast|Daily save limit)/.test(m)) return m;
          if (/Unknown avatar option/.test(m)) return 'One of those parts is not available. Reload the page and try again.';
          if (/That part is locked/.test(m)) return 'One of those parts is still locked: earn its stamp first. Your look was not saved.';
          return 'Could not save. Check your connection and try again. Your look was not saved.';
        }
        // Save Look: one RPC; the look counts as saved only when the server confirms it
        function save() {
          if (pending || !signed) return Promise.reject(new Error('not now'));
          var sent = Object.assign({}, look);
          pending = true; msg = ''; setBtn(saveB, 'Saving…'); status();
          return frenRpc('gry_passport_avatar_save', { p_bg: sent.bg, p_clothing: sent.clothing, p_mouth: sent.mouth, p_eyes: sent.eyes, p_hat: sent.hat, p_accessory: sent.accessory, p_special: sent.special }).then(function (r) {
            var conf = r && avatarLook(o, r.avatar);
            if (!conf) throw new Error('The server did not confirm the save.');
            pending = false; setBtn(saveB, 'Save Look');
            saved = conf;
            if (avatarSame(look, sent)) look = Object.assign({}, conf);
            var pc = passportMine();
            if (pc) {
              pc.state.avatar = Object.assign({ schema_version: r.avatar.schema_version }, conf);
              if (r.badge && r.badge.earned_at) {
                var list = Array.isArray(pc.state.achievements) ? pc.state.achievements : (pc.state.achievements = []);
                var hit = list.filter(function (b) { return b.id === 'first_avatar'; })[0];
                if (hit) hit.earned_at = r.badge.earned_at; else list.push({ id: 'first_avatar', title: 'Fresh Fren', earned_at: r.badge.earned_at });
              }
              if (apps.passport && apps.passport.render) apps.passport.render();
            }
            paint();
            // the Save button is disabled now; keep keyboard users in the window
            if (!document.activeElement || document.activeElement === document.body) useB.focus();
            if (r.badge && r.badge.new) balloon('Fresh Fren unlocked!', 'You saved your first Fren. The achievement is in your Fren Passport now.', 'fresh-fren');
            return conf;
          }, function (err) {
            pending = false; setBtn(saveB, 'Save Look');
            msg = failText(err); status();
            throw err;
          });
        }
        function toPassport() { A.close(); frenPassport(true); }
        rnd.addEventListener('click', function () {
          var next;
          do {
            next = {};
            AV_SLOTS.forEach(function (s) { var l = avatarPicks(o, s[0], owns); next[s[0]] = l[Math.floor(Math.random() * l.length)].id; });
            next.special = AV_PLAIN;   // Randomize mixes parts; a special avatar is picked on purpose
          } while (avatarSame(next, look));
          look = next; msg = ''; paint(); showPicked();
        });
        saveB.addEventListener('click', function () { if (!signed) logOn(); else save().catch(function () {}); });
        useB.addEventListener('click', function () {
          if (!signed || pending) return;
          if (saved && avatarSame(look, saved)) { toPassport(); return; }
          osDialog('Create Your Fren', '<div class="dlg-row"><div class="fa-dlg-face">' + avatarStack(o, look).outerHTML + '</div><div><h3>Save this look first?</h3><p>' +
            (saved ? 'Your Fren Passport shows the last look you saved.' : 'You have not saved a Fren yet, so your Passport still shows the logo.') + '</p></div></div>', [
            { label: 'Save', go: true, fn: function () { save().then(toPassport, function () {}); } },
            { label: 'Discard', fn: function () { look = Object.assign({}, saved || start); msg = ''; paint(); toPassport(); } },
            { label: 'Cancel' }
          ], 'pep-logo');
        });
        paint();
        setTimeout(showPicked, 0);
      }
    }, 900);
  }

  // Only cosmetic, low-stakes discoveries are claimable by a browser.
  // This is intentionally NOT the pathway for YEET Moon Rock or care-day badges.
  // touching the locked BALI stamp: not yet, but it finds the secret "Bali Dreamer" (the straw-hat avatar)
  function baliTouch(earned, other) {
    if (earned) balloon('BALI!', other ? 'Pepecoin reached $0.01 and this fren was here for it.' : 'Pepecoin reached $0.01 and you were here for it. Straw hat on, fren.', 'gif-045-still');
    else balloon('Not yet, fren', 'BALI opens when Pepecoin reaches $0.01. Pack the straw hat anyway.', 'gif-045-still');
    discoverSecret('bali_dreamer');
  }
  // the postmark over the BALI ticket once it is earned
  function baliMark(e) {
    var m = el('span', {class:'pp-bali-mark','aria-hidden':'true'});
    m.appendChild(el('b')).textContent = 'ARRIVED';
    m.appendChild(el('i')).textContent = 'BALI';
    m.appendChild(el('small')).textContent = new Date(e.earned_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
    return m;
  }
  function discoverSecret(id) {
    if (!FREN) return;
    var session=sbSession();
    if(!session||!session.discord||!session.userId) return;
    var k='pondos-passport-secret-v1:'+session.userId+':'+id;
    // Test mode does not read or write the production discovery suppression marker.
    if (!FREN_TEST) {
      try { if(localStorage.getItem(k)==='1') return; } catch(e) {}
    }
    frenRpc('gry_passport_discover',{p_secret:id}).then(function(result){
      if(!result||result.id!==id) return;
      if (!FREN_TEST) { try { localStorage.setItem(k,'1'); } catch(e) {} }
      if (FREN_TEST) passportLoad(sbSession()).then(function () {
        if (apps.passport && apps.passport.render) apps.passport.render();
      }).catch(function () {});
      if(result.new) {
        var names={wrong_frog:'The Wrong Frog',why_tho:'Why Do You Need This?',magic_word:'The Magic Word',bsod_fren:'Blue Screen of Fren',midnight_fren:'Midnight Fren',nerd_alert:'Nerds Only',bali_dreamer:'Bali Dreamer',find_fren:'Looking Glass',address_check:'Trust, But Verify'};
        var av={why_tho:1,midnight_fren:1,nerd_alert:1,bali_dreamer:1,find_fren:1,address_check:1};
        rewardNotice({ bar: 'Fren Passport - Secret Found', title: 'Secret discovered: ' + (names[id] || 'A mysterious find'),
          text: 'It is in your Fren Passport now.' + (av[id] ? ' A special avatar is waiting for you in Create Your Fren.' : ''),
          img: ico('gif-045-still'), go: av[id] ? 'Open Create Your Fren' : 'Open Fren Passport', open: av[id] ? avatarMaker : frenPassport });
      }
    },function(){ /* Migration may not be installed yet; retry on next discovery. */ });
  }

  // Share Fren is a small secret, not a stamp or proof of posting on X.
  // The server checks the player's own finished Pepe Guesser round.
  function passportShare() {
    if (!FREN) return;
    var session = sbSession();
    if (!session || !session.discord || !session.userId) return;
    var k = 'pondos-passport-share-v2:' + session.userId;
    try { if (localStorage.getItem(k) === '1') return; } catch (e) {}
    frenRpc('gry_passport_share', {}).then(function (r) {
      if (!r || !r.found) return;
      try { localStorage.setItem(k, '1'); } catch (e) {}
      if (passportCache && passportCache.userId === session.userId) passportCache = null;
      if (!r['new']) return;
      rewardNotice({ bar: 'Fren Passport - Secret Found', title: 'Secret discovered: Share Fren',
        text: 'You found a little PondOS secret by sharing a Pepe Guesser result. It is in your collection now.',
        img: ico('gif-045-still'), go: 'Open Fren Passport', open: frenPassport });
    }, function () { /* the migration may not be installed yet */ });
  }

  function logOn() {
    openApp('logon', 'Log On to the Pond', 'pep-logo', function (A) {
      var paint = function () {
        var me = whoAmI();
        A.body.innerHTML = '<div class="tip"><img src="img/' + (me ? 'gif-045' : 'gif-085') + '.webp" alt="" width="96" height="96"><div>' +
          (me ? '<b>Signed in as ' + esc(me.name) + (me.discord ? ' <span class="hs-ok" title="Verified with Discord">✓</span>' : ' (guest)') + '</b><p>' + (me.discord ? 'Your Discord name shows with a ✓ in LAN Party and on the High Scores.' : 'Guests can chat and submit scores. Log in with Discord to get the ✓ verified badge.') + '</p>'
            : '<b>Who goes there, fren?</b><p>Sign in once and use it everywhere: LAN Party chat, High Scores, PEPaint and the other PEP Games.</p>') +
          '</div></div>' +
          '<div class="app-row">' + (me && me.discord ? '' : '<a class="app-btn logon-discord" href="' + signInHref() + '">' + (me ? 'Log in with Discord' : 'Log in with Discord or as a guest') + '</a>') +
          (me ? '<button type="button" class="app-btn logon-out">Log off</button>' : '') + '</div>' +
          '<p class="hs-note">You sign in on the PEP Games page and come straight back here. Discord shares your username and email with our login service (Supabase); the site does not show or use the email. PondOS never asks for a seed phrase or a password.</p>';
        var out = A.body.querySelector('.logon-out');
        if (out) out.addEventListener('click', function () {
          try { Object.keys(localStorage).forEach(function (k) { if (/^sb-azbwciqfbsdpwubznncg-auth-token/.test(k)) localStorage.removeItem(k); }); } catch (e) {}
          paintLogon(); paint();
        });
      };
      paint();
    }, 440);
  }
  function paintLogon() {
    var me = whoAmI();
    document.querySelectorAll('.logon-name').forEach(function (e) { e.textContent = me ? me.name : 'Log on…'; });
    document.querySelectorAll('.logon-ok').forEach(function (e) { e.hidden = !(me && me.discord); });
  }
  if (mainEl) {
    var tLog = el('button', { type: 'button', class: 'tray-logon', title: 'Log On to the Pond' }, '<span aria-hidden="true">👤</span><span class="sr">Log on</span>');
    tLog.addEventListener('click', logOn);
    var trayEl3 = document.querySelector('.tray'); if (trayEl3) trayEl3.insertBefore(tLog, trayEl3.firstChild);
    paintLogon();
    if (/[?&]signedin=1/.test(location.search)) {
      try { history.replaceState(null, '', location.pathname + location.search.replace(/[?&]signedin=1/, '').replace(/^&/, '?') + location.hash); } catch (e) {}
      var me0 = whoAmI();
      if (me0) setTimeout(function () { balloon('Welcome to the pond, ' + me0.name, me0.discord ? 'Signed in with Discord ✓. LAN Party and High Scores now use your name.' : 'Signed in as a guest. You can chat and submit scores.', 'gif-045-still'); }, 900);
    }
  }

  // ---------- Fren Passport check-in (games/supabase/update_passport_awards.sql) ----------
  // A Discord player's PondOS page asks once (at most every 5 minutes per tab). The server notes the UTC day
  // for Welcome Back! and the 14- and 30-day runs, and returns the stamps it has not announced yet; each one is announced only once.
  // The browser sends nothing but the request itself.
  if (mainEl) (function () {
    var s = sbSession();
    if (!FREN || !s || !s.discord || !s.userId) return;
    var k = 'pondos-checkin:' + s.userId, now = Date.now();
    try { if (now - (+sessionStorage.getItem(k) || 0) < 300000) return; sessionStorage.setItem(k, String(now)); } catch (e) {}
    setTimeout(function () {
      frenRpc('gry_passport_checkin', {}).then(function (r) {
        var fresh = r && Array.isArray(r.new_badges) ? r.new_badges : [];
        if (!fresh.length) return;
        if (passportCache && passportCache.userId === s.userId) passportCache = null;   // the next Passport opens fresh
        return fetch(PP_CATALOG).then(function (x) { return x.ok ? x.json() : null; }).catch(function () { return null; }).then(function (c) {
          var stamps = fresh.map(function (b) {
            return c && Array.isArray(c.achievements) ? c.achievements.filter(function (a) { return a.id === b.id; })[0] : null;
          }).filter(Boolean);
          stamps.forEach(function (x) {
            rewardNotice({ bar: 'Fren Passport - New Stamp', stamp: x, title: x.title, text: x.description || 'It is in your Fren Passport now.' });
          });
        });
      }, function () { /* the migration may not be installed yet; nothing to show */ });
    }, 2500);
  })();
  // ?fren=<user id> opens that fren's passport (a verified name in the PEP Games lobby chat links here). Beta only.
  if (mainEl && FREN) (function () {
    var id = ''; try { id = new URLSearchParams(location.search).get('fren') || ''; } catch (e) {}
    if (!FREN_ID.test(id)) return;
    try { history.replaceState(null, '', location.pathname + location.search.replace(/[?&]fren=[^&]*/, '').replace(/^&/, '?') + location.hash); } catch (e) {}
    setTimeout(function () { frenPassport(false, { id: id.toLowerCase() }); }, 600);
  })();

  // ---------- counter.exe: a tiny 90s visitor counter. One number from the server (people counted once a day,
  // no cookie, no IP; the same data as the owner's statistics). Hidden if the server does not answer.
  if (mainEl) (function () {
    fetch(SB_URL + '/rest/v1/rpc/gry_counter', { method: 'POST', headers: { apikey: SB_KEY, 'Content-Type': 'application/json' }, body: '{}' })
      .then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        if (!j || !(j.frogs > 0)) return;
        var n = String(j.frogs); while (n.length < 6) n = '0' + n;
        var since = j.since ? new Date(j.since + 'T12:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
        var b = el('button', { type: 'button', class: 'hitc', title: 'Visitor counter: ' + j.frogs + ' frogs so far' },
          '<span class="hitc-d">' + n.split('').map(function (c) { return '<i>' + c + '</i>'; }).join('') + '</span><span class="hitc-l">frogs visited</span>');
        b.addEventListener('click', function () {
          osDialog('counter.exe', '<div class="dlg-row"><img src="img/peek.webp" alt="" width="96" height="96"><div><h3>' + fmt.int(j.frogs) + ' frogs and counting</h3>' +
            '<p>Every visitor counts once a day' + (since ? ', since ' + esc(since) : '') + '. No cookies, no IP address, no tracking pixels: just a frog with a tally sheet.</p>' +
            '<p>Best viewed in 800×600. Sign the guestbook in <b>Frog Mail</b>.</p></div></div>', [{ label: 'Write a letter', fn: function () { frogMail('write'); } }, { label: 'OK' }], 'pep-logo');
        });
        // on a computer it sits in the taskbar tray (instead of WEN MOON), so it never covers a window's buttons;
        // on a phone a copy stays at the top of the page, under the windows
        var tr = document.querySelector('.tray'), mo = tr && tr.querySelector('.tray-moon');
        if (tr) { b.classList.add('hitc-tray'); if (mo) tr.insertBefore(b, mo); else tr.appendChild(b); }
        var b2 = b.cloneNode(true); b2.classList.remove('hitc-tray'); b2.classList.add('hitc-page');
        b2.addEventListener('click', function () { b.click(); });
        document.body.appendChild(b2);
      }, function () {});
  })();

  // ---------- About me: who builds the pond, the support addresses (same as the footer) and a small task ----------
  var SHARE_TEXT = 'Pepecoin $PEP: a frog with its own proof-of-work blockchain. No premine, no token on someone else\'s chain. 🐸 #Pepecoin';
  function aboutMe() {
    openApp('about', 'About me.txt', 'night-shift', function (A) {
      var ADDR = [['Pepecoin (PEP)', 'PiwzfZU1t37hCvKboCNN49YT8CPN2nXa3t'], ['Litecoin (LTC)', 'ltc1qs05pfynke7ekd66cywkh235rvnykdqrnn4r58j'], ['Dogecoin (DOGE)', 'DHLfH7Zk4nRLc41KpuDQNazY3qyNnjnT9v'], ['Bitcoin (BTC)', 'bc1q4uxmuqrpg4znmmj3ccnt0ezf9mx6augrxuet5p']];
      var url = 'https://pepecoinhub.com/meme/';
      A.body.innerHTML = '<div class="tip about"><img src="img/night-shift.webp" alt="Pepe at the computer late at night" width="120" height="84"><div><b>Byl.</b>' +
        '<p>Just a regular anon from the internet with way too much free time and years of shitposting experience.</p><p>That\'s the whole bio. Nothing interesting here…</p></div></div>' +
        '<p class="about-q">Like what you see? The site, the work, the effort? Got too much money and no idea what to do with it? <b>Good lord.</b> Then you can support me:</p>' +
        '<ul class="tip-list">' + ADDR.map(function (a) { return '<li><span>' + a[0] + '</span><code>' + a[1] + '</code><button type="button" class="app-btn" data-a="' + a[1] + '">Copy</button></li>'; }).join('') + '</ul>' +
        '<p class="bin-tip tip-msg">Tips go one way only. This site never asks for a seed phrase or a password.</p>' +
        '<div class="tip about-task"><img src="img/unclesam.webp" alt="Pepe pointing at you" width="96" height="96"><div>' +
        '<p>Answered <b>"no"</b> to any of those? Then you have a task: post about Pepecoin on X or Reddit, or tell a friend. <b>Today. Now.</b></p>' +
        '<div class="app-row"><a class="app-btn" target="_blank" rel="noopener" href="https://x.com/intent/post?text=' + encodeURIComponent(SHARE_TEXT + '\n' + url) + '">Post on X</a>' +
        '<a class="app-btn" target="_blank" rel="noopener" href="https://www.reddit.com/submit?url=' + encodeURIComponent(url) + '&title=' + encodeURIComponent('Pepecoin $PEP: a frog with its own PoW chain') + '">Reddit</a>' +
        '<button type="button" class="app-btn about-mail">✏️ Write to me</button></div></div></div>';
      var m = A.body.querySelector('.tip-msg');
      A.body.querySelector('.about-mail').addEventListener('click', function () { frogMail('write'); });
      A.body.querySelectorAll('[data-a]').forEach(function (b) {
        b.addEventListener('click', function () {
          var t = b.getAttribute('data-a');
          var ok = function () { m.textContent = 'Copied. The frog thanks you. Double-check the first and last characters after pasting.'; discoverSecret('why_tho'); };
          if (navigator.clipboard) navigator.clipboard.writeText(t).then(ok, function () { m.textContent = 'Copy blocked by the browser. Select the address and copy it by hand.'; });
          else m.textContent = 'Select the address and copy it by hand.';
        });
      });
    }, 580);
  }
  var tipJar = aboutMe;   // old links and the "tip" easter egg open About me now

  // ---------- AddressCheck.exe: is this really a PEP address? Format and checksum only, in this browser ----------
  // PEP: version byte 56 (starts with P) for normal addresses, 22 (starts with 9 or A) for script/multisig addresses.
  // Checked against the addresses of the daily rich list snapshot.
  var B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  function b58decode(s) {
    var n = BigInt(0), i;
    for (i = 0; i < s.length; i++) { var k = B58.indexOf(s[i]); if (k < 0) return null; n = n * BigInt(58) + BigInt(k); }
    var bytes = [];
    while (n > BigInt(0)) { bytes.unshift(Number(n % BigInt(256))); n = n / BigInt(256); }
    for (i = 0; i < s.length && s[i] === '1'; i++) bytes.unshift(0);
    return new Uint8Array(bytes);
  }
  function addrVerdict(a) {
    if (!a) return Promise.resolve(null);
    if (/^0x[0-9a-fA-F]{40}$/.test(a)) return Promise.resolve(['bad', 'This is an Ethereum-style 0x address. Not PEP.', 'PEPE and other ERC-20 tokens use these. Sending PEP here is impossible, and sending an Ethereum token to a PEP address loses it.']);
    if (/^(bc1|ltc1|tb1)[0-9a-z]{8,87}$/i.test(a)) return Promise.resolve(['bad', 'This is a ' + (/^ltc1/i.test(a) ? 'Litecoin' : 'Bitcoin') + ' SegWit address. Not PEP.', 'PEP addresses start with P.']);
    if (a.length < 26 || a.length > 36) return Promise.resolve(['bad', 'Wrong length for a PEP address.', 'A PEP address is 34 characters long and starts with P. Check that you copied all of it.']);
    var b = b58decode(a);
    if (!b) return Promise.resolve(['bad', 'This contains characters a PEP address never has.', 'Addresses use no 0 (zero), O, I or l. Copy and paste the address instead of typing it.']);
    if (b.length !== 25 || !(window.crypto && crypto.subtle)) return Promise.resolve(['bad', 'This is not a valid address.', 'The length after decoding is wrong. Check that you copied all of it.']);
    var body = b.slice(0, 21);
    return crypto.subtle.digest('SHA-256', body).then(function (h) { return crypto.subtle.digest('SHA-256', h); }).then(function (h2) {
      var c = new Uint8Array(h2), ok = c[0] === b[21] && c[1] === b[22] && c[2] === b[23] && c[3] === b[24];
      if (!ok) return ['bad', 'Checksum failed: one or more characters are wrong.', 'This is how a typo or a changed character shows up. Do not send anything to it. Copy the address again from the wallet.'];
      var v = b[0];
      if (v === 56) return ['ok', 'Valid PEP address.', 'Format and checksum are correct (version 56, starts with P). This says nothing about who owns it: check the first and last characters with the person you are paying.'];
      if (v === 22) return ['warn', 'Valid script (multisig) address format.', 'PEP uses this format (starting with 9 or A) for script addresses, and so does Dogecoin. Make sure the person meant PEP.'];
      if (v === 30) return ['bad', 'This is a Dogecoin address (starts with D). Not PEP.', 'Same family of coins, different chain. Send DOGE here, not PEP.'];
      if (v === 48 || v === 50) return ['bad', 'This is a Litecoin address. Not PEP.', 'PEP addresses start with P.'];
      if (v === 0 || v === 5) return ['bad', 'This is a Bitcoin address. Not PEP.', 'PEP addresses start with P.'];
      return ['bad', 'Valid checksum, but not a PEP address (version ' + v + ').', 'PEP addresses start with P.'];
    });
  }
  function addressCheck() {
    openApp('addr', 'AddressCheck.exe', 'pepe-search', function (A) {
      A.body.innerHTML = '<p class="bin-tip">Paste an address before you send PEP to it. AddressCheck checks the format and the checksum, right here in your browser.</p>' +
        '<form class="app-row ac-form"><input class="ac-in" name="a" type="text" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Address to check" placeholder="P…"><button type="submit" class="app-btn">Check</button></form>' +
        '<div class="ac-out" role="status" aria-live="polite"></div>' +
        '<p class="bin-tip">It cannot see balances or owners. Big amount? Send a small test first.</p>';
      var f = A.body.querySelector('.ac-form'), inp = f.querySelector('.ac-in'), out = A.body.querySelector('.ac-out');
      var run = function () {
        var a = inp.value.replace(/\s+/g, '');
        addrVerdict(a).then(function (r) {
          if (!r) { out.innerHTML = ''; return; }
          if (r[0] === 'ok') discoverSecret('address_check');   // checked a real PEP address before using it
          out.innerHTML = '<div class="sc-verdict sc-' + r[0] + '"><b>' + (r[0] === 'ok' ? '✓ ' : r[0] === 'warn' ? '! ' : '✗ ') + r[1] + '</b><p>' + r[2] + '</p>' +
            (r[0] === 'ok' ? '<p class="ac-more"><a href="' + BASE + 'rich-list.html#addr=' + a + '">Is it on the rich list? Check its rank →</a></p>' : '') + '</div>';
        });
      };
      f.addEventListener('submit', function (e) { e.preventDefault(); run(); });
      inp.addEventListener('input', function () { if (inp.value.replace(/\s+/g, '').length >= 26) run(); else out.innerHTML = ''; });
    }, 520);
  }

  // ---------- Pepe Guesser: a daily guess-the-place game (games/supabase/update_wheres_pepe.sql) ----------
  // The server holds the answers, starts the clock, hands out the picture and the hints, and scores the guess.
  // The page only shows them. The map is Leaflet (games/vendor) with OpenStreetMap tiles.
  var WP_README = [
    "PEPE GUESSER - README.TXT",
    '',
    'A daily guessing game. Pepe is travelling the world and',
    'every day he sends ONE photo from somewhere. Your job:',
    'find the place on the map. Fast and close = more points.',
    '',
    '== HOW TO PLAY ==',
    '1. Open PepeGuesser.exe and press Start.',
    '   No account needed: a quick bot check, and you play',
    '   as a guest (or log on with Discord first).',
    '2. The photo shows up and the 2-minute clock starts.',
    '3. Click the map where you think Pepe is.',
    '4. Press GUESS!  One guess a day, so think first.',
    '5. See how far you were, where Pepe really was,',
    '   your points, and the ranking.',
    '',
    '== TIME: 2 MINUTES ==',
    '0:00 - 1:00   photo only            max 5000 points',
    '1:00 - 1:30   + continent           max 4000 points',
    '1:30 - 2:00   + country flag        max 3000 points',
    '2:00          time is up (no pin = 0 points)',
    'The clock runs on the server: closing the window',
    'does not stop it.',
    '',
    '== POINTS ==',
    'Within 1 km: full points (from 10 Nov;',
    'it used to be 10 km).',
    'Further away: fewer points.',
    'Left the tab? 1st time a warning, then -1000 each time.',
    '',
    '== NEW PEPE ==',
    'Every day at 00:00 UTC.',
    'Play every day to grow your streak (the fire badge).',
    '',
    '== RANKING ==',
    'Today and the last 7 days, everyone. Discord players: bold with a frog.',
    'Guests: grey, one per network.',
    'Under it: how many frens played today.',
    '',
    '== PEP FAUCET (free PEP) ==',
    'After your guess, the yellow PEP Faucet box tells you',
    'what you can claim. Leave a PEP address, that is all.',
    '1 PEP for every 50 points.',
    '',
    '             a day     a week    starts',
    'Discord      100 PEP   500 PEP   day 1',
    'Guest         50 PEP   200 PEP   day 2 of your streak',
    '',
    '- Guests: one reward per internet connection a day.',
    '- Guest streaks live in your browser: play on the same',
    '  phone or computer to keep them.',
    '- One PEP address per player.',
    '- The game has a weekly PEP budget. When it is gone,',
    '  rewards come back next week.',
    '- Paid once a week by the host, from the host\'s own wallet.',
    '- Super fast top scores (over 4700 in under 5 seconds)',
    '  are checked by hand before they are paid.',
    '- Cheating (extra accounts, shared answers) = no reward.',
    '',
    'We never ask for a seed phrase or a password.',
    'You only ever leave an address.',
    '',
    '== PHOTOS ==',
    'Free photos from Wikimedia Commons, with Pepe added.',
    'You see the author and the licence after your guess.',
    'Map: OpenStreetMap.',
    '',
    'gl hf, fren'
  ];
  function wpReadme() {
    openApp('wp-readme', 'README.TXT - Notepad', 'wp-folder', function (A) {
      A.body.innerHTML = '<div class="win-menu notepad-menu"><span>File</span><span>Edit</span><span>Search</span><span>Help</span></div><pre class="notepad"></pre>';
      A.body.querySelector('.notepad').textContent = WP_README.join('\n');
    }, 560);
  }
  function wpFolder() {
    openApp('wp-folder', "C:\\Pond\\Pepe Guesser", 'wp-folder', function (A) {
      var F = [['PepeGuesser.exe', 'wheres-pepe', wheresPepe], ['README.TXT', 'wp-folder', wpReadme]];
      A.body.innerHTML = '<ul class="folder">' + F.map(function (f, i) { return '<li><button type="button" data-i="' + i + '"><img src="' + ico(f[1]) + '" alt="" width="40" height="40"><span>' + f[0] + '</span></button></li>'; }).join('') + '</ul>' +
        '<p class="bin-tip">A new photo from Pepe\'s travels every day. Read the README first, then double-click PepeGuesser.exe.</p>';
      A.body.querySelectorAll('.folder button').forEach(function (b) {
        var go = function () { F[+b.getAttribute('data-i')][2](); };
        b.addEventListener('dblclick', go);
        b.addEventListener('click', function () { if (!matchMedia('(hover: hover) and (pointer: fine)').matches) go(); else { A.body.querySelectorAll('.folder .sel').forEach(function (x) { x.classList.remove('sel'); }); b.classList.add('sel'); } });
        b.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } });
      });
    }, 440);
  }
  // a signed-in session that is still valid; an expired one is refreshed once (the PEP Games pages do the same)
  var wpRefreshing = null;
  function freshSession() {
    var s = anySession(); if (s) return Promise.resolve(s);
    var raw = null; try { raw = JSON.parse(localStorage.getItem(SB_STORE) || 'null'); } catch (e) {}
    if (!raw || !raw.refresh_token) return Promise.resolve(null);
    if (!wpRefreshing) wpRefreshing = fetch(SB_URL + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: SB_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: raw.refresh_token }) })
      .then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        wpRefreshing = null;
        if (!j || !j.access_token) return null;
        var s2 = Object.assign({}, raw, j); if (!s2.expires_at && j.expires_in) s2.expires_at = Math.floor(Date.now() / 1000) + j.expires_in;
        try { localStorage.setItem(SB_STORE, JSON.stringify(s2)); } catch (e) {}
        return s2;
      }, function () { wpRefreshing = null; return null; });
    return wpRefreshing;
  }
  // a guest player made right here (the same Supabase guest sign-in as PEP Games, with the same bot check)
  var TS_KEY = '0x4AAAAAAFUZHXoXT2P6KI_s';   // the public Turnstile site key from games/js/config.js
  function guestSignIn() {
    return import(new URL(BASE + 'games/js/human.js', location.href).href).then(function (m) { return m.humanToken(TS_KEY); }).then(function (tok) {
      return fetch(SB_URL + '/auth/v1/signup', { method: 'POST', headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: {}, gotrue_meta_security: { captcha_token: tok } }) });
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok || !j.access_token) throw new Error((j && (j.msg || j.message || j.error_description)) || 'Could not make a guest player. Try again, or log on with Discord.');
        if (!j.expires_at && j.expires_in) j.expires_at = Math.floor(Date.now() / 1000) + j.expires_in;
        try {
          localStorage.setItem(SB_STORE, JSON.stringify(j));
          // a name for Pepe Guesser only; the chat keeps asking guests to pick their own nickname
          if (!(localStorage.getItem('pondos-wp-nick') || '').trim()) localStorage.setItem('pondos-wp-nick', 'Frog' + (1000 + Math.floor(Math.random() * 9000)));
        } catch (e) {}
        paintLogon();
        return j;
      });
    });
  }
  // payout lines for a Discord tip bot, e.g. "send 12.5 PEPE to P..." for Filippy
  var WP_PAYOUT_TEMPLATE = 'send {amount} PEPE to {address}';   // Filippy's word for PEP
  function wpTpl() { var t = ''; try { t = localStorage.getItem('wp-payout-template') || ''; } catch (e) {} return t || WP_PAYOUT_TEMPLATE; }
  function wpPayoutLines(sum, tpl) {
    tpl = tpl && tpl.indexOf('{address}') >= 0 && tpl.indexOf('{amount}') >= 0 ? tpl : WP_PAYOUT_TEMPLATE;
    return Object.keys(sum).map(function (a) {
      var amt = String(Math.round(Number(sum[a]) * 100) / 100);
      return tpl.split('{amount}').join(amt).split('{address}').join(a);
    });
  }
  function wpRpc(name, args) { return freshSession().then(function () { return chatRpc(name, args || {}); }); }
  var leafletReady = null;
  function loadLeaflet() {
    if (window.L && window.L.map) return Promise.resolve();
    if (!leafletReady) leafletReady = new Promise(function (res, rej) {
      var dir = BASE + 'games/vendor/leaflet-1.9.4/';
      var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = dir + 'leaflet.css'; document.head.appendChild(css);
      var sc = document.createElement('script'); sc.src = dir + 'leaflet.js'; sc.onload = res; sc.onerror = function () { leafletReady = null; rej(new Error('The map could not be loaded')); }; document.head.appendChild(sc);
    });
    return leafletReady;
  }
  function flagOf(cc) { return /^[A-Z]{2}$/.test(cc || '') ? String.fromCodePoint(127397 + cc.charCodeAt(0), 127397 + cc.charCodeAt(1)) : ''; }
  function fmtKm(k) { return k == null ? '–' : k < 10 ? k.toFixed(1) + ' km' : Math.round(k).toLocaleString('en-US') + ' km'; }
  function wheresPepe() {
    var A = openApp('wp', "Pepe Guesser", 'wheres-pepe', function (A) {
      A.body.innerHTML = '<div class="wp"><div class="wp-top"><b class="wp-title">Pepe Guesser</b><span class="wp-streak" hidden></span><span class="grow"></span><span class="wp-clock" aria-live="polite"></span></div>' +
        '<div class="wp-main"><p class="bin-tip">Packing the backpack…</p></div><p class="wp-msg" role="status" aria-live="polite"></p></div>';
      var main = A.body.querySelector('.wp-main'), msg = A.body.querySelector('.wp-msg'), clock = A.body.querySelector('.wp-clock'), streakEl = A.body.querySelector('.wp-streak');
      var T = null, play = null, map = null, pin = null, tick = 0, offset = 0, hintAt = {}, leaveT = 0, warned = false, alive = true, sending = false;
      var say = function (t, bad) { msg.textContent = t || ''; msg.classList.toggle('bad', !!bad); };
      var nextIn = function () { if (!T) return ''; var ms = Date.parse(T.next_at) - (Date.now() + offset); if (ms < 0) ms = 0; var h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60; return h + ':' + ('0' + m).slice(-2) + ':' + ('0' + s).slice(-2); };
      var stopTick = function () { clearInterval(tick); tick = 0; };
      var countdownOnly = function () { stopTick(); clock.textContent = 'Next Pepe in ' + nextIn(); tick = setInterval(function () { clock.textContent = 'Next Pepe in ' + nextIn(); }, 1000); };
      var paintStreak = function () { if (T && T.streak > 0) { streakEl.hidden = false; streakEl.textContent = '🔥 Streak: ' + T.streak + (T.streak === 1 ? ' day' : ' days'); } else streakEl.hidden = true; };

      var load = function () {
        say('');
        return wpRpc('gry_wp_today').then(function (t) {
          T = t; offset = Date.parse(t.now) - Date.now(); paintStreak();
          if (!t.live) return closed();
          if (t.mine && t.mine.done) return result(t.mine);
          if (t.mine && !t.mine.done) return start();      // came back to a running guess: the clock kept going
          intro();
        }, function (e) { main.innerHTML = '<p class="bin-tip">' + esc(e.message) + '</p>'; });
      };
      var hostBtn = function () { return T && T.is_host ? '<button type="button" class="app-btn wp-host">Host tools</button>' : ''; };
      var wireHost = function () { var b = main.querySelector('.wp-host'); if (b) b.addEventListener('click', hostTools); };
      var closed = function () {
        countdownOnly();
        main.innerHTML = '<div class="wp-intro"><img src="img/wp-pepe.webp" alt="Pepe the explorer with binoculars" width="180" height="169"><div><h3>Pepe is still packing.</h3><p>No photo today yet. Come back soon!</p>' +
          '<div class="app-row"><button type="button" class="app-btn wp-readme">README.TXT</button>' + hostBtn() + '</div><div class="wp-board"></div></div></div>';
        main.querySelector('.wp-readme').addEventListener('click', wpReadme); wireHost(); board(main.querySelector('.wp-board'));
      };
      var intro = function () {
        countdownOnly();
        var me = whoAmI();
        main.innerHTML = '<div class="wp-intro"><img src="img/wp-pepe.webp" alt="Pepe the explorer with binoculars" width="180" height="169"><div><h3>Pepe Guesser #' + T.num + '</h3>' +
          '<p>Pepe sent a new photo. Where is he? You have <b>2 minutes</b> and <b>one guess</b>. The faster, the more points: 5000 in the first minute, then the continent and the flag show up and the maximum drops.</p>' +
          '<p class="wp-small">Leaving the tab during the guess: one warning, then −1000 each time.</p>' +
          (T.signed_in ? '<div class="app-row"><button type="button" class="app-btn wp-start go">▶ Start</button><button type="button" class="app-btn wp-readme">README.TXT</button>' + hostBtn() + '</div>' +
              (T.verified ? '' : '<p class="wp-small">Playing as a guest (' + esc(me ? me.name : 'guest') + '). <a href="#" class="wp-logon">Log on with Discord</a> for a bold name with a frog in the ranking and bigger PEP rewards.</p>')
            : '<div class="app-row"><button type="button" class="app-btn wp-start go">▶ Start</button><button type="button" class="app-btn wp-readme">README.TXT</button></div><p class="wp-small">No account needed: Start makes a guest player for you (after a quick bot check). Or <a href="#" class="wp-logon">log on with Discord</a> for the ranking and bigger PEP rewards.</p>') +
          '<div class="wp-board"></div></div></div>';
        var s = main.querySelector('.wp-start'); if (s) s.addEventListener('click', start);
        main.querySelectorAll('.wp-logon').forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); logOn(); }); });
        main.querySelector('.wp-readme').addEventListener('click', wpReadme); wireHost();
        board(main.querySelector('.wp-board'));
      };
      var start = function () {
        say('Opening the photo…');
        var myNick = function () { try { return localStorage.getItem('pepgry-nick') || localStorage.getItem('pondos-wp-nick') || ''; } catch (e) { return ''; } };
        var nick = myNick();
        freshSession().then(function (sess) {
          if (sess) return sess;
          say('Making you a guest player…');
          return guestSignIn().then(function (s2) { nick = myNick(); return s2; });
        }).then(function () { return Promise.all([wpRpc('gry_wp_start', { p_nick: nick }), loadLeaflet()]); }).then(function (r) {
          play = r[0]; offset = Date.parse(play.now) - Date.now();
          if (play.done) return result(play);
          say(''); playing();
        }, function (e) { say(e.message, true); });
      };
      var elapsed = function () { return (Date.now() + offset - Date.parse(play.started_at)) / 1000; };
      var makeMap = function (box) {
        if (map) { map.remove(); map = null; }
        map = L.map(box, { worldCopyJump: true, minZoom: 1, zoomControl: true, attributionControl: true }).setView([25, 10], 1);
        // Esri World Street Map: place names in English, no key (note the {y}/{x} order). If its tiles fail to load
        // (several errors before any tile arrives, or nothing after 8 s), the map switches to OpenStreetMap's own
        // tiles (local place names). CARTO's free tiles needed an API key, so they are gone.
        var loaded = 0, failed = 0, switched = false, m0 = map;
        // If BOTH tile providers fail (zero tiles ever load, only errors), the
        // tiles are almost certainly blocked by the player's network — a VPN,
        // ad/tracker blocker or a restricted network often block arcgisonline.com
        // and tile.openstreetmap.org. Show a plain note on the map box instead of
        // a silent grey square. It clears the moment any tile loads.
        var noteShown = false;
        var mapBlockedNote = function () {
          if (noteShown || loaded || !map || map !== m0) return; noteShown = true;
          var n = el('div', { class: 'wp-map-blocked', role: 'status' },
            '<b>The map could not load.</b><span>A VPN, ad/tracker blocker or your network is probably blocking the map tile servers (OpenStreetMap / Esri). Turn the VPN or blocker off for this page, then reopen the game. You can still place your pin on the grey map.</span>');
          box.appendChild(n);
        };
        var clearNote = function () { var n = box.querySelector('.wp-map-blocked'); if (n) n.remove(); };
        var tileOk = function () { loaded++; clearNote(); };
        var osm = function () {
          var o = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' });
          var oErr = 0;
          o.on('tileload', tileOk);
          // OSM is the fallback; if it ALSO only errors, the network is blocking tiles.
          o.on('tileerror', function () { oErr++; if (!loaded && oErr >= 3) mapBlockedNote(); });
          setTimeout(function () { if (!loaded) mapBlockedNote(); }, 8000);
          return o;
        };
        var esri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 18, attribution: 'Tiles © <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a> · Sources: Esri, HERE, Garmin, USGS, © OpenStreetMap contributors and the GIS user community' });
        var fallback = function () {
          if (switched || map !== m0) return; switched = true;
          m0.removeLayer(esri); osm().addTo(m0);
        };
        esri.on('tileload', tileOk);
        esri.on('tileerror', function () { failed++; if (!loaded && failed >= 3) fallback(); });
        setTimeout(function () { if (!loaded) fallback(); }, 8000);
        esri.addTo(map);
        setTimeout(function () { if (map) map.invalidateSize(); }, 60);
        return map;
      };
      var playing = function () {
        stopTick();
        main.innerHTML = '<div class="wp-play"><div class="wp-photo"><img alt="Today\'s photo: Pepe somewhere in the world" src="' + play.image + '"><button type="button" class="wp-zoom" aria-label="Show the photo bigger">⤢</button></div>' +
          '<div class="wp-side"><div class="wp-hints"><span class="wp-max"></span><span class="wp-h1">🌍 Continent at 1:00</span><span class="wp-h2">🏳️ Flag at 1:30</span></div>' +
          '<div class="wp-map" aria-label="World map: click to put your pin"></div>' +
          '<div class="app-row"><span class="grow wp-pinmsg">Click the map to put your pin.</span><button type="button" class="app-btn wp-guess go" disabled>GUESS!</button></div></div></div>';
        var m = makeMap(main.querySelector('.wp-map')), gb = main.querySelector('.wp-guess'), pm = main.querySelector('.wp-pinmsg');
        pin = null;
        m.on('click', function (e) {
          var ll = e.latlng.wrap();
          if (!pin) pin = L.marker(ll).addTo(m); else pin.setLatLng(ll);
          gb.disabled = false; pm.textContent = 'Pin at ' + ll.lat.toFixed(2) + ', ' + ll.lng.toFixed(2) + '. Move it, or guess.';
        });
        gb.addEventListener('click', function () { guess(false); });
        var ph = main.querySelector('.wp-photo');
        main.querySelector('.wp-zoom').addEventListener('click', function () { ph.classList.toggle('big'); setTimeout(function () { m.invalidateSize(); }, 60); });
        main.querySelector('.wp-photo img').addEventListener('click', function () { ph.classList.toggle('big'); setTimeout(function () { m.invalidateSize(); }, 60); });
        hintAt = {}; paintHints(play);
        var maxEl = main.querySelector('.wp-max');
        var step = function () {
          var el = elapsed(), left = Math.max(0, 120 - el);
          clock.textContent = '⏱ ' + Math.floor(left / 60) + ':' + ('0' + Math.floor(left % 60)).slice(-2);
          clock.classList.toggle('low', left <= 15);
          maxEl.textContent = 'Max ' + (el < 60 ? 5000 : el < 90 ? 4000 : 3000) + ' pts';
          if (el >= 60 && !hintAt[60]) { hintAt[60] = 1; wpRpc('gry_wp_hint').then(paintHints, function () {}); }
          if (el >= 90 && !hintAt[90]) { hintAt[90] = 1; wpRpc('gry_wp_hint').then(paintHints, function () {}); }
          if (left <= 0) { stopTick(); guess(true); }
        };
        step(); tick = setInterval(step, 250);
      };
      var paintHints = function (h) {
        if (!main.querySelector('.wp-hints')) return;
        if (h.continent) main.querySelector('.wp-h1').innerHTML = '🌍 <b>' + esc(h.continent) + '</b>';
        if (h.country_code) main.querySelector('.wp-h2').innerHTML = '<span class="wp-flag">' + flagOf(h.country_code) + '</span> <b>flag</b>';
      };
      var guess = function (timeUp) {
        if (sending || !play) return; sending = true; stopTick();
        var ll = pin ? pin.getLatLng() : null;
        say(timeUp ? 'Time is up!' : 'Checking…');
        wpRpc('gry_wp_guess', ll ? { p_lat: ll.lat, p_lon: ll.lng } : { p_lat: null, p_lon: null }).then(function (r) {
          sending = false; play = null; r.image = r.image || (main.querySelector('.wp-photo img') || {}).src; say('');
          return wpRpc('gry_wp_today').then(function (t) { T = t; paintStreak(); result(r); }, function () { result(r); });
        }, function (e) { sending = false; say(e.message, true); if (timeUp) setTimeout(load, 12000); });
      };
      var shareText = function (r) {
        // the last line says, without the word "faucet", that good guesses pay a little PEP
        var pts = r.points || 0;
        return "🐸 Pepe Guesser #" + r.num + '\n' + (r.g_lat == null ? '📍 no guess' : '📍 ' + fmtKm(r.km)) + ' · ' + pts.toLocaleString('en-US') + '/5000' +
          (T && T.streak > 1 ? ' · 🔥' + T.streak : '') + '\n🎁 Find the frog, get some free PEP in your pocket\nhttps://pepecoinhub.com/meme/';
      };
      var result = function (r) {
        countdownOnly();
        var a = r.answer || {};
        var img = r.image ? '<div class="wp-photo"><img alt="" src="' + r.image + '"></div>' : '';
        main.innerHTML = '<div class="wp-play wp-done">' + (img || '<div class="wp-photo wp-nophoto"></div>') +
          '<div class="wp-side"><div class="wp-score"><b class="wp-pts">' + (r.points || 0).toLocaleString('en-US') + '</b><span>/ 5000 points</span><span class="wp-km">' + (r.g_lat == null ? 'No guess' : fmtKm(r.km) + ' away') + '</span></div>' +
          '<p class="wp-place">Pepe was at <b>' + esc(a.title || '?') + '</b>, ' + esc(a.country || '') + ' ' + flagOf(a.country_code) + (a.wiki_url ? ' · <a href="' + esc(a.wiki_url) + '" target="_blank" rel="noopener">Wikipedia</a>' : '') + '</p>' +
          '<div class="wp-map"></div>' +
          '<p class="wp-small">Photo: ' + esc(a.credit || '') + ', <a href="' + esc(a.source_url || '#') + '" target="_blank" rel="noopener">' + esc(a.license || 'licence') + '</a>, cropped, Pepe added.' + (r.leaves ? ' Tab left ' + r.leaves + '×.' : '') + '</p>' +
          '<div class="app-row">' + (navigator.share ? '<button type="button" class="app-btn go wp-share">Share…</button>' : '') + '<button type="button" class="app-btn wp-copy">Copy result</button><a class="app-btn wp-x" target="_blank" rel="noopener">Post on X</a><span class="grow"></span><button type="button" class="app-btn wp-readme">README.TXT</button>' + hostBtn() + '</div>' +
          '<div class="wp-reward"></div></div><div class="wp-board"></div></div>';
        main.querySelector('.wp-readme').addEventListener('click', wpReadme); wireHost();
        var txt = shareText(r);
        main.querySelector('.wp-x').href = 'https://x.com/intent/post?text=' + encodeURIComponent(txt);
        main.querySelector('.wp-x').addEventListener('click', function () { passportShare(); });
        var shb = main.querySelector('.wp-share');
        if (shb) shb.addEventListener('click', function () { navigator.share({ text: txt }).then(passportShare, function () {}); });
        main.querySelector('.wp-copy').addEventListener('click', function () {
          var ok = function () { say('Copied. Paste it on Discord or X.'); passportShare(); };
          if (navigator.clipboard) navigator.clipboard.writeText(txt).then(ok, function () { say('Copy blocked by the browser.', true); }); else say('Copy blocked by the browser.', true);
        });
        loadLeaflet().then(function () {
          var m = makeMap(main.querySelector('.wp-map'));
          if (a.lat == null) return;
          var real = L.latLng(a.lat, a.lon);
          L.marker(real, { title: 'Pepe was here' }).addTo(m).bindTooltip('🐸 Pepe was here', { permanent: true, direction: 'top', offset: [0, -30] });
          if (r.g_lat != null) {
            var g = L.latLng(r.g_lat, r.g_lon);
            L.circleMarker(g, { radius: 7, color: '#b3261e', fillColor: '#ff5a4e', fillOpacity: 1 }).addTo(m).bindTooltip('Your pin', { direction: 'bottom' });
            L.polyline([g, real], { color: '#b3261e', weight: 2, dashArray: '6 6' }).addTo(m);
            m.fitBounds(L.latLngBounds([g, real]).pad(0.3), { maxZoom: 9 });
          } else m.setView(real, 5);
        }, function (e) { say(e.message, true); });
        reward(main.querySelector('.wp-reward'), r);
        board(main.querySelector('.wp-board'));
      };
      var reward = function (box, r) {
        if (r.claim) return rewardBox(box, r, null);
        // the reward rules for this player (Discord or guest), then the form
        wpRpc('gry_wp_rewards').then(function (rw) { rewardBox(box, r, rw); }, function () {
          var rw = T && T.rewards; if (rw) rewardBox(box, r, Object.assign({ verified: T.verified, streak: T.streak, guest_streak: 3, discord_max_day: rw.max_day, budget_left: 1 }, rw));
        });
      };
      var rewardBox = function (box, r, rw) {
        box.className = 'wp-reward wp-faucet';
        var title = '<p class="wp-ftitle">🎁 PEP Faucet <a href="#" class="wp-frules">rules</a></p>';
        var inner = document.createElement('div'); inner.className = 'wp-fbody';
        box.innerHTML = title; box.appendChild(inner);
        box.querySelector('.wp-frules').addEventListener('click', function (e) { e.preventDefault(); wpReadme(); });
        rewardInner(inner, r, rw, box);
      };
      var rewardInner = function (box, r, rw, outer) {
        if (r.claim) {
          box.innerHTML = '<div class="wp-claim"><b>🎁 ' + r.claim.pep + ' PEP</b> ' + (r.claim.status === 'paid' ? 'paid ✓ <a href="https://pepeblocks.com/tx/' + esc(r.claim.txid) + '" target="_blank" rel="noopener">see the transaction</a>' : r.claim.status === 'held' ? 'on hold: the host is checking it' : 'waiting for the weekly payout') + '</div>';
          return;
        }
        if (!rw.open) { box.innerHTML = '<p class="wp-small">PEP rewards are paused right now.</p>'; return; }
        var pep = Math.min(rw.max_day, Math.floor((r.points || 0) / 50) * rw.per_50);
        if (pep <= 0) { box.innerHTML = '<p class="wp-small">No PEP reward this time: it starts at 50 points.</p>'; return; }
        if (rw.budget_left <= 0) { box.innerHTML = '<p class="wp-small">🎁 This week\'s PEP budget is used up. More next week!</p>'; return; }
        var discordLink = ' <a href="#" class="wp-logon">Log on with Discord</a>';
        var wire = function () { var l = box.querySelector('.wp-logon'); if (l) l.addEventListener('click', function (e) { e.preventDefault(); logOn(); }); };
        if (!rw.verified && rw.streak < rw.guest_streak) {
          box.innerHTML = '<p class="wp-small" style="margin:0">Guest rewards start on <b>day ' + rw.guest_streak + ' of your streak</b> (you are on day ' + rw.streak + '). Come back tomorrow! Or' + discordLink + ' for up to ' + rw.discord_max_day + ' PEP from day one.</p>';
          wire(); return;
        }
        box.innerHTML = '<form class="wp-claim"><b>🎁 Your reward: up to ' + pep + ' PEP</b><span class="wp-small">' + (rw.verified ? '' : 'Guest reward: one per network a day.' + discordLink + ' for up to ' + rw.discord_max_day + ' PEP. ') +
          'Paid once a week by the host from the host\'s own wallet. Leave only an address: never a seed phrase or a password.' +
          (rw.budget_left > 0 ? ' Left in this week\'s budget: ' + Math.floor(rw.budget_left).toLocaleString('en-US') + ' PEP.' : '') + '</span>' +
          '<span class="app-row"><input class="ac-in wp-addr" type="text" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Your PEP address" placeholder="Your PEP address (P…)"><button type="submit" class="app-btn">Claim</button></span></form>';
        var f = box.querySelector('form'), inp = f.querySelector('.wp-addr');
        try { inp.value = localStorage.getItem('pondos-wp-addr') || ''; } catch (e) {}
        f.addEventListener('submit', function (e) {
          e.preventDefault();
          var ad = inp.value.replace(/\s+/g, '');
          addrVerdict(ad).then(function (v) {
            if (!v || v[0] !== 'ok') { say(v ? v[1] : 'Paste your PEP address first.', true); return; }
            try { localStorage.setItem('pondos-wp-addr', ad); } catch (err) {}
            wpRpc('gry_wp_claim', { p_address: ad }).then(function (c) {
              r.claim = { pep: c.pep, status: 'open' }; reward(outer, r); say('Claimed. It goes out with the weekly payout.');
            }, function (err) { say(err.message, true); });
          });
        });
      };
      var board = function (box) {
        if (!box) return;
        box.innerHTML = '<div class="tabs98 wp-tabs" role="tablist"><button type="button" role="tab" aria-selected="true" data-s="day">Today</button><button type="button" role="tab" aria-selected="false" data-s="week">7 days</button></div><ol class="wp-top10"><li class="wp-small">Loading…</li></ol>' + whoLegend();
        wireLegend(box);
        var ol = box.querySelector('ol');
        var show = function (s) {
          box.querySelectorAll('[data-s]').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-s') === s)); });
          wpRpc('gry_wp_top', { p_scope: s }).then(function (rows) {
            ol.innerHTML = rows.length ? rows.map(function (x) { return '<li><span>' + who(x.nick, x.verified !== false) + hostHidden(x) + '</span><b>' + Number(x.points).toLocaleString('en-US') + '</b></li>'; }).join('')
              : '<li class="wp-small">Nobody yet. Be the first!</li>';
          }, function () { ol.innerHTML = '<li class="wp-small">The ranking could not be loaded.</li>'; });
        };
        box.querySelectorAll('[data-s]').forEach(function (b) { b.addEventListener('click', function () { show(b.getAttribute('data-s')); }); });
        show('day');
        var cnt = document.createElement('p'); cnt.className = 'wp-small wp-count'; box.appendChild(cnt);
        wpRpc('gry_wp_count').then(function (c) {
          if (c && c.players) cnt.textContent = '🐸 ' + c.players + (c.players === 1 ? ' player' : ' players') + ' today (' + c.discord + ' on Discord)';
        }, function () {});
      };
      // leaving the tab during a guess (a short blink under 2 s, like a notification, does not count)
      var onVis = function () {
        if (!play || play.done) return;
        if (document.hidden) { clearTimeout(leaveT); leaveT = setTimeout(function () { leaveT = -1; wpRpc('gry_wp_leave').then(function (x) { play.leaves = x.leaves; }, function () {}); }, 2000); }
        else {
          if (leaveT === -1) { say(play.leaves <= 1 && !warned ? '👀 Pepe saw you leave! Next time it costs 1000 points.' : '👀 You left the tab: −1000 points.', true); warned = true; }
          clearTimeout(leaveT); leaveT = 0;
        }
      };
      document.addEventListener('visibilitychange', onVis);
      A.stop = function () { alive = false; stopTick(); clearTimeout(leaveT); document.removeEventListener('visibilitychange', onVis); if (map) { map.remove(); map = null; } };
      load();
    }, 1100);
    if (window.innerWidth > 760) { A.host.style.top = '12px'; A.host.style.setProperty('--app-top', '12px'); }
    return A;
  }
  // Host tools: approve the robot's puzzles before they go live, and pay the PEP rewards
  function hostTools() {
    openApp('wp-host', "Pepe Guesser - Host tools", 'wheres-pepe', function (A) {
      A.body.innerHTML = '<div class="tabs98" role="tablist"><button type="button" role="tab" aria-selected="true" data-t="q">Photo queue</button><button type="button" role="tab" aria-selected="false" data-t="p">Payouts</button></div><div class="wp-hostbody"></div><p class="wp-msg" role="status"></p>';
      var body = A.body.querySelector('.wp-hostbody'), msg = A.body.querySelector('.wp-msg');
      var say = function (t, bad) { msg.textContent = t || ''; msg.classList.toggle('bad', !!bad); };
      var queue = function () {
        body.innerHTML = '<p class="wp-small">Loading…</p>';
        wpRpc('gry_wp_host_queue').then(function (rows) {
          if (!rows.length) { body.innerHTML = '<p class="wp-small">The queue is empty. The robot adds new photos every morning (05:23 UTC).</p>'; return; }
          body.innerHTML = '<p class="wp-small">Approved photos go live one per day, oldest approval first. Only you can see this list.</p><ul class="wp-queue">' + rows.map(function (q) {
            return '<li data-id="' + q.id + '"><button type="button" class="wp-thumb" aria-label="Show the photo">🖼️ Show photo</button><div><b>' + esc(q.title) + '</b>, ' + esc(q.country) + ' · ' + esc(q.continent) +
              '<br><span class="wp-small">' + (q.status === 'pending' ? '⏳ waiting for you' : q.day ? '📅 live on ' + q.day : '✓ approved, waiting for its day') + ' · <a href="https://www.openstreetmap.org/?mlat=' + q.lat + '&mlon=' + q.lon + '#map=12/' + q.lat + '/' + q.lon + '" target="_blank" rel="noopener">map</a>' +
              (q.wiki_url ? ' · <a href="' + esc(q.wiki_url) + '" target="_blank" rel="noopener">wiki</a>' : '') + ' · <a href="' + esc(q.source_url) + '" target="_blank" rel="noopener">' + esc(q.license) + '</a></span></div>' +
              (q.day ? '' : '<span class="wp-dec">' + (q.status === 'pending' ? '<button type="button" class="app-btn" data-ok="1">✓ Approve</button>' : '') + '<button type="button" class="app-btn" data-ok="0">✗ Reject</button></span>') + '<div class="wp-qimg"></div></li>';
          }).join('') + '</ul>';
          body.querySelectorAll('.wp-queue li').forEach(function (li) {
            var id = +li.getAttribute('data-id');
            li.querySelector('.wp-thumb').addEventListener('click', function () {
              var box = li.querySelector('.wp-qimg'); if (box.innerHTML) { box.innerHTML = ''; return; }
              box.textContent = 'Loading…';
              wpRpc('gry_wp_host_image', { p_id: id }).then(function (src) { box.innerHTML = src ? '<img alt="" src="' + src + '">' : 'No picture.'; }, function (e) { box.textContent = e.message; });
            });
            li.querySelectorAll('[data-ok]').forEach(function (b) {
              b.addEventListener('click', function () {
                wpRpc('gry_wp_host_decide', { p_id: id, p_ok: b.getAttribute('data-ok') === '1' }).then(function () { say(b.getAttribute('data-ok') === '1' ? 'Approved.' : 'Rejected: the robot will find another one.'); queue(); }, function (e) { say(e.message, true); });
              });
            });
          });
        }, function (e) { body.innerHTML = '<p class="wp-small">' + esc(e.message) + '</p>'; });
      };
      var payouts = function () {
        body.innerHTML = '<p class="wp-small">Loading…</p>';
        wpRpc('gry_wp_host_claims').then(function (d) {
          var open = d.claims.filter(function (c) { return c.status === 'open'; }), sum = {};
          open.forEach(function (c) { sum[c.address] = Math.round(((sum[c.address] || 0) + Number(c.pep)) * 100) / 100; });
          var total = Object.keys(sum).reduce(function (t, k) { return t + sum[k]; }, 0);
          var st = d.settings;
          body.innerHTML = '<h4 class="wp-h">Open rewards: ' + open.length + ' claims, ' + Object.keys(sum).length + ' addresses, ' + total.toLocaleString('en-US') + ' PEP</h4>' +
            '<p class="wp-small">Budget left this week: <b>' + Number(d.budget_left).toLocaleString('en-US') + ' PEP</b>. ⚠ marks are worth a look before you pay; Hold keeps a reward out of the payout.</p>' +
            (open.length ? '<h4 class="wp-h">Pay with the tip bot</h4><p class="wp-small">Tap <b>Copy</b>, paste it to the bot (e.g. Filippy in a DM), then tap <b>Paid</b>. One line per address.</p>' +
              '<ol class="wp-bot">' + wpPayoutLines(sum, wpTpl()).map(function (l, i) { var a = Object.keys(sum)[i]; return '<li data-a="' + esc(a) + '"><code>' + esc(l) + '</code><button type="button" class="app-btn" data-copy>Copy</button><button type="button" class="app-btn" data-paid>Paid</button></li>'; }).join('') + '</ol>' +
              '<details class="wp-tplbox"><summary class="wp-small">Bot command pattern</summary><div class="app-row"><input class="ac-in wp-tpl" type="text" spellcheck="false" aria-label="Bot command pattern"><button type="button" class="app-btn wp-tplsave">Save</button></div><p class="wp-small">{amount} and {address} are filled in.</p></details>' +
              '<h4 class="wp-h">All open rewards</h4>' : '') +
            '<ol class="wp-claims">' + d.claims.map(function (c) {
              var fl = [];
              if (!c.verified) fl.push('guest');
              if (c.other_players_on_address) fl.push('⚠ address used by ' + c.other_players_on_address + ' other player(s)');
              if (c.accounts_on_network > 1) fl.push('⚠ ' + c.accounts_on_network + ' accounts on one network');
              if (c.secs != null && c.secs < 5 && c.points > 4700) fl.push('⚠ ' + c.points + ' pts in ' + c.secs + ' s');
              return '<li data-id="' + c.id + '"><span>' + esc(c.nick) + (c.verified ? ' ✓' : '') + ' · #' + c.num + ' · ' + c.points + ' pts · <b>' + c.pep + ' PEP</b><br><code>' + esc(c.address) + '</code>' + (fl.length ? '<br><b class="bad">' + fl.join(' · ') + '</b>' : '') + '</span><button type="button" class="app-btn" data-hold="' + (c.status === 'held' ? 0 : 1) + '">' + (c.status === 'held' ? 'Release' : 'Hold') + '</button></li>'; }).join('') + '</ol>' +
            (open.length ? '<p class="wp-small">1. Send from your own wallet: in Pepecoin Core, the Send tab, one recipient per address (Add Recipient), the amounts from the list. Or in the console: <code>sendmany ""</code> followed by the list. 2. Check the total before you confirm. 3. Paste the transaction id here and mark the rewards as paid.</p>' +
              '<h4 class="wp-h">Or all at once from Pepecoin Core (sendmany)</h4>' +
              '<textarea class="sc-in wp-many" rows="3" readonly></textarea><div class="app-row"><button type="button" class="app-btn wp-copymany">Copy the list</button><input class="ac-in wp-txid" type="text" spellcheck="false" placeholder="Transaction id (64 characters)" aria-label="Transaction id"><button type="button" class="app-btn wp-paid">Mark as paid</button></div>' : '<p class="wp-small">Nothing to pay right now.</p>') +
            '<h4 class="wp-h">Settings</h4><form class="app-row wp-set"><label>PEP per 50 pts <input class="ac-in" name="a" type="number" step="0.01" min="0" value="' + st.per_50 + '"></label>' +
              '<label>Discord: max a day <input class="ac-in" name="b" type="number" min="0" value="' + st.max_day + '"></label><label>a week <input class="ac-in" name="c" type="number" min="0" value="' + st.max_week + '"></label>' +
              '<label>Guests: max a day <input class="ac-in" name="e" type="number" min="0" value="' + st.guest_max_day + '"></label><label>a week <input class="ac-in" name="f" type="number" min="0" value="' + st.guest_max_week + '"></label>' +
              '<label>from streak day <input class="ac-in" name="g" type="number" min="1" max="30" value="' + st.guest_streak + '"></label>' +
              '<label>Budget for all, a week <input class="ac-in" name="h" type="number" min="0" value="' + st.week_budget + '"></label>' +
              '<label><input type="checkbox" name="d"' + (st.open ? ' checked' : '') + '> Rewards on</label><button type="submit" class="app-btn">Save</button></form>' +
            (d.paid.length ? '<h4 class="wp-h">Last payouts</h4><ul class="wp-paidlist">' + d.paid.map(function (p) { return '<li>' + new Date(p.at).toLocaleDateString() + ' · ' + p.n + ' claims · ' + p.pep + ' PEP · ' + (p.txid ? '<a href="https://pepeblocks.com/tx/' + esc(p.txid) + '" target="_blank" rel="noopener">' + esc(p.txid.slice(0, 12)) + '…</a>' : 'tip bot, all so far') + '</li>'; }).join('') + '</ul>' : '');
          var many = body.querySelector('.wp-many');
          if (many) {
            many.value = JSON.stringify(sum);
            var copyBox = function (box) { box.select(); if (navigator.clipboard) navigator.clipboard.writeText(box.value).then(function () { say('Copied.'); }, function () { say('Select the text and copy it.', true); }); };
            body.querySelector('.wp-copymany').addEventListener('click', function () { copyBox(many); });
            var tpl = body.querySelector('.wp-tpl');
            tpl.value = wpTpl();
            body.querySelector('.wp-tplsave').addEventListener('click', function () { try { localStorage.setItem('wp-payout-template', tpl.value); } catch (e) {} payouts(); });
            body.querySelectorAll('.wp-bot li').forEach(function (li) {
              var line = li.querySelector('code').textContent, a = li.getAttribute('data-a');
              li.querySelector('[data-copy]').addEventListener('click', function (ev) {
                var b = ev.currentTarget, done = function () { b.textContent = 'Copied ✓'; li.classList.add('is-copied'); };
                if (navigator.clipboard) navigator.clipboard.writeText(line).then(done, function () { say('Hold the line and copy it by hand.', true); });
                else say('Hold the line and copy it by hand.', true);
              });
              li.querySelector('[data-paid]').addEventListener('click', function () {
                var ids = open.filter(function (c) { return c.address === a; }).map(function (c) { return c.id; });
                wpRpc('gry_wp_host_paid', { p_ids: ids, p_txid: '' }).then(function (n) { say(n + ' reward(s) marked as paid.'); payouts(); }, function (e) { say(e.message, true); });
              });
            });
            body.querySelector('.wp-paid').addEventListener('click', function () {
              var tx = body.querySelector('.wp-txid').value.trim();
              wpRpc('gry_wp_host_paid', { p_ids: open.map(function (c) { return c.id; }), p_txid: tx }).then(function (n) { say(n + ' claims marked as paid.'); payouts(); }, function (e) { say(e.message, true); });
            });
          }
          body.querySelectorAll('[data-hold]').forEach(function (b) {
            b.addEventListener('click', function () { wpRpc('gry_wp_host_hold', { p_id: +b.closest('li').getAttribute('data-id'), p_hold: b.getAttribute('data-hold') === '1' }).then(payouts, function (e) { say(e.message, true); }); });
          });
          body.querySelector('.wp-set').addEventListener('submit', function (e) {
            e.preventDefault(); var f = e.target;
            wpRpc('gry_wp_host_settings2', { p: { per_50: +f.a.value, max_day: +f.b.value, max_week: +f.c.value, open: f.d.checked, guest_max_day: +f.e.value, guest_max_week: +f.f.value, guest_streak: +f.g.value, week_budget: +f.h.value } }).then(function () { say('Saved.'); }, function (err) { say(err.message, true); });
          });
        }, function (e) { body.innerHTML = '<p class="wp-small">' + esc(e.message) + '</p>'; });
      };
      A.body.querySelectorAll('[data-t]').forEach(function (b) {
        b.addEventListener('click', function () { A.body.querySelectorAll('[data-t]').forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); }); say(''); if (b.getAttribute('data-t') === 'q') queue(); else payouts(); });
      });
      queue();
    }, 820);
  }

  // ---------- Frog Mail: the Pond Gazette, a weekly paper in a mailbox in the tray ----------
  var MAIL_ISSUE = 6, MAIL_KEY = 'pondos-mail-read';
  var WP_LAUNCH = Date.parse('2026-11-03T00:00:00Z');   // Pepe Guesser opens for everyone (the Gazette and the PEP-TV ad count down to it)
  function launchText() {
    var ms = WP_LAUNCH - Date.now();
    if (ms <= 0) return '🟢 <b>It\'s live!</b> A new Pepe every day at 00:00 UTC.';
    var d = Math.floor(ms / 86400000), h = Math.floor(ms / 3600000) % 24, m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60;
    var at = new Date(WP_LAUNCH).toLocaleString('en-US', { weekday: 'long', hour: '2-digit', minute: '2-digit' });
    return '⏳ Starts in <b class="gz-clock">' + (d ? d + 'd ' : '') + h + 'h ' + ('0' + m).slice(-2) + 'm ' + ('0' + sec).slice(-2) + 's</b> (' + at + ' your time)';
  }
  function mailRead() { try { return +(localStorage.getItem(MAIL_KEY) || -1) >= MAIL_ISSUE; } catch (e) { return false; } }
  function paintMail() {
    var gz = !mailRead() ? 1 : 0, lt = (letterBox && letterBox.unread) || 0, n = gz + lt;
    var t = lt ? 'Frog Mail: ' + lt + (lt === 1 ? ' new letter' : ' new letters') + ' for you' : gz ? 'Frog Mail: 1 unread, a new Pond Gazette' : 'Frog Mail';
    document.querySelectorAll('.tray-mail').forEach(function (b) { b.classList.toggle('has-mail', n > 0); b.title = t; b.setAttribute('aria-label', b.title); });
    document.querySelectorAll('.mail-new').forEach(function (e) { e.hidden = !n; e.textContent = n + ' new'; });
  }
  // Letters from visitors to the site owner. Anyone can write (guests after one quick bot check),
  // only the owner's Discord account can read them (games.owners on the server).
  var letterBox = null;   // the owner's last inbox answer, or null for everyone else
  function checkLetters() {
    var s = sbSession(); if (!s || !s.discord) { letterBox = null; return Promise.resolve(null); }
    return rpc('gry_letters', { p_limit: 200 }).then(function (j) { letterBox = j && j.letters ? j : null; paintMail(); return letterBox; }, function () { return null; });
  }
  if (mainEl) setTimeout(checkLetters, 1500);
  // Issue #4 (5 Nov 2026): the third issue this week, hence "Almost weekly"
  function gazette4() {
    return '<article class="gazette"><header><p class="gz-top"><span>Issue #4</span><span>Price: 0 PEP</span><span>Almost weekly*</span></p><h3>The Pond Gazette</h3><p class="gz-sub">All the news that fits in a pond</p></header>' +
      '<section class="gz-breaking"><p class="gz-flash">🚨 Breaking news 🚨</p><h4>LEAKED: the right answer to Pepe Guesser!</h4>' +
      '<figure class="gz-reddit"><p class="gz-rd-top"><b>r/pepecoin</b> · u/drivingyou17</p><p class="gz-rd-title">I like this game! 🐸👍</p>' +
      '<p class="gz-rd-shot">Pepe was at <b>Statue of Liberty</b>, United States 🇺🇸<br><span>4,539</span> / 5000 points · 155 km away</p>' +
      '<figcaption>“Nice daily challenge before going to sleep 😴💤”</figcaption></figure>' +
      '<p>A player posted their result on r/pepecoin, answer and all. The pond did what ponds do: everybody came to look. The result is a new record, <b>32 players in one day</b>, and the count can still go up.</p>' +
      '<p class="gz-count gz-live"></p>' +
      '<p>Our investigative desk has looked into the leak and calls it harmless: at 00:00 UTC Pepe packs his backpack and goes somewhere new. Keep posting your scores, we love it.</p>' +
      '<p><b>PS: the game has a new name.</b> Where\'s Pepe? is now <b>Pepe Guesser</b>. Same photo, same map, same free PEP.</p>' +
      '<div class="app-row"><button type="button" class="app-btn go gz-wpgo">Play today\'s Pepe Guesser →</button></div></section>' +
      '<section class="gz-letters"><p class="gz-kick">Letters to the Editor</p><h4>The first honest confessions</h4>' +
      '<p>The mailbox has started to fill with letters from poor, addicted players. We print the first one with permission and without edits:</p>' +
      '<blockquote class="gz-quote"><p>“Im a lemom and I have a pepeminer addiction”</p><cite>Lemon 🍋 Ᵽ <span class="hs-ok" title="Verified with Discord">✓</span>, 4 Nov</cite></blockquote>' +
      '<p><i>The Editor replies:</i> Dear Lemon, the first step is admitting it. The second step is the next pickaxe upgrade. Stay strong.</p>' +
      '<p>Hooked too? Write in, tick <b>“OK to print”</b> and your confession could be in the next issue.</p>' +
      '<div class="app-row"><button type="button" class="app-btn go gz-write">✏️ Confess to the Editor</button><button type="button" class="app-btn gz-miner">Open Pepe Miner (no cure included)</button></div></section>' +
      '<section class="gz-market"><p class="gz-kick">Markets</p><h4>The price dips as CoinEx sells. Good.</h4>' +
      '<p>PEP slipped after CoinEx started selling. The editor\'s view: let them sell. Once they are done, it gets easier for us to grow.</p>' +
      '<p class="gz-count gz-price"></p>' +
      '<p class="gz-fine">Not financial advice. The frog does not know wen moon.</p></section>' +
      '<section class="gz-cover"><p class="gz-kick">Cover story</p><h4>FROGAGEDDON: Zord\'s foot, explosions and plot twists</h4>' +
      '<img class="gz-hero" src="../games/img/pondwars/title.jpg" alt="FROGAGEDDON title screen" loading="lazy">' +
      '<p>Turn-based frog artillery on a pond you can blow to pieces. Four maps (Pond Island, Split Decision, Croak Canyon and Last Lily), nine weapons and one very famous foot.</p>' +
      '<p>The star of the show is Zord\'s <b>Golden Foot</b>: throw it, wait three seconds and it bursts into five exploding golden toes. Add bazookas, land mines, a grapple rope, a jetpack and a teleport, and no match ends the way it started.</p>' +
      '<p>Play the CPU or a fren on one device, with a mouse or the new touch controls.</p>' +
      '<p class="gz-ask"><b>Test it and tell us: do you want online mode?</b> Write to the Editor or say it in LAN Party. Your answers decide what we build next.</p>' +
      '<div class="app-row"><button type="button" class="app-btn go gz-frog">Play FROGAGEDDON →</button><button type="button" class="app-btn gz-online">✉️ I want online mode!</button><button type="button" class="app-btn gz-lan">Tell LAN Party</button><button type="button" class="app-btn gz-frogad">Watch the PEP-TV ad</button></div></section>' +
      '<section class="gz-soon"><p class="gz-kick">Coming up</p><h4>More big changes are on the way</h4>' +
      '<p>This was just the warm-up. Big changes are coming to the pond soon. Keep an eye on the flag on the mailbox.</p></section>' +
      '<p class="gz-foot">*Almost weekly: this is the third issue this week. We are still working on the “weekly” part.</p></article>';
  }
  // Issue #5 (Friday 6 Nov 2026): the outage confession, CoinEx, and the first Pond Poll
  function gazette5() {
    return '<article class="gazette"><header><p class="gz-top"><span>Issue #5</span><span>Price: 0 PEP</span><span>Almost weekend*</span></p><h3>The Pond Gazette</h3><p class="gz-sub">All the news that fits in a pond</p></header>' +
      '<section class="gz-breaking"><p class="gz-flash">🚨 Disaster 🚨</p><h4>A frog tried to improve the site and locked the games out</h4>' +
      '<div class="gz-wpbox"><img src="img/gz5-oops.webp" alt="Pepe crying at his computer" width="110" height="110"><div>' +
      '<p>This week the editor fitted the pond with a shiny new security lock. Great idea, bad aim. First the Pepe Guesser map went blank, then Pond TV and the guest log-on, and in the end every game window opened empty: YEET THE PEP, PEPE SWEEPER, Pepe Miner, FROGAGEDDON and Draw &amp; Guess.</p>' +
      '<p><b>It is all fixed now</b> and everything should work again. If something still looks broken, write to the Editor and it gets fixed.</p></div></div>' +
      '<p>Sorry for the beta bumps. We will make it up to you somehow. Chill. 🐸</p>' +
      '<p class="gz-ask">New house rule, pinned above the editor\'s desk: <b>if it works, don\'t touch it.</b></p>' +
      '<div class="app-row"><button type="button" class="app-btn go gz-wpgo">Play Pepe Guesser →</button><button type="button" class="app-btn gz-yeet">YEET THE PEP</button><button type="button" class="app-btn gz-write">🐛 Something still broken?</button></div></section>' +
      '<section class="gz-market"><p class="gz-kick">Markets</p><h4>Did CoinEx just dump everything it had?</h4>' +
      '<figure class="gz-reddit gz-discord"><p class="gz-rd-top"><b>Pepecoin Discord</b> · Zordiak ✓</p><p class="gz-rd-title">Wow we\'re recovering nicely</p>' +
      '<p class="gz-rd-title">I spoke to Coinex, they\'re done selling on Kraken</p><figcaption>🔥 10 · 💚 6 · 🧢 5 · 🗑️ 4</figcaption></figure>' +
      '<p>Word in the pond: CoinEx has finished selling its PEP on Kraken. A lot of fear, not much pain? We will see.</p>' +
      '<p class="gz-count gz-price"></p>' +
      '<p class="gz-fine">Heard on Discord, not confirmed by CoinEx. Not financial advice. The frog still does not know wen moon.</p></section>' +
      '<section class="gz-pollsec"><p class="gz-flash gz-new">New! Pond Poll</p><h4>Do you like polls?</h4>' +
      '<div class="gz-poll" data-poll="like_polls" aria-live="polite"><p class="gz-poll-msg">Opening the ballot box…</p></div>' +
      '<p class="gz-fine">Yes, this is a test poll. It is open for 2 days. Everyone can vote, Discord players and guests: one vote each, and a vote is final. You see the results after you vote; everyone sees them when the poll closes.</p></section>' +
      '<p class="gz-foot">*Almost weekend: issue #5 lands on a Friday. The next one comes when it is ready.</p></article>';
  }
  // Issue #6 (Monday 9 Nov 2026): X unblocks the site, the first faucet payout, 1 km from tomorrow, the poll result
  function gazette6() {
    var xText = '🐸 Pepe Guesser: one photo a day, 2 minutes, one pin. Find the frog, get some free PEP.\nhttps://pepecoinhub.com/meme/';
    return '<article class="gazette"><header><p class="gz-top"><span>Issue #6</span><span>Price: 0 PEP</span><span>Almost weekly*</span></p><h3>The Pond Gazette</h3><p class="gz-sub">All the news that fits in a pond</p></header>' +
      '<section class="gz-breaking"><p class="gz-flash">Breaking</p><h4>Twitter unblocked PepecoinHub!</h4>' +
      '<div class="gz-wpbox"><img src="img/wow.webp" alt="Pepe with his mouth wide open" width="110" height="110"><div>' +
      '<p>For weeks X would not take a single link to this site. Today the wall came down: links to pepecoinhub.com go through again.</p>' +
      '<p><b>So the button works now.</b> Finish today\'s Pepe Guesser and hit <b>Post on X</b>: your distance, your points and your streak, ready to post. Show the timeline who knows their geography.</p></div></div>' +
      '<div class="app-row"><button type="button" class="app-btn go gz-wpgo">Play today\'s photo →</button><a class="app-btn" target="_blank" rel="noopener" href="https://x.com/intent/post?text=' + encodeURIComponent(xText) + '">Post on X</a></div></section>' +
      '<section class="gz-wp"><p class="gz-kick">The pond faucet</p><h4>The first weekly payout is done</h4>' +
      '<div class="gz-wpbox"><img src="img/rich.webp" alt="Pepe reading How to be rich" width="110" height="110"><div>' +
      '<p>Today the host paid out the first full week of Pepe Guesser rewards: <b>4,704 PEP to 24 addresses</b>, for 76 good guesses. Real coins, sent straight to your wallets. Check yours.</p>' +
      '<p>The weekly pot is fresh again: it now resets every Monday, so a new week means a new 5,000 PEP to play for.</p></div></div></section>' +
      '<section class="gz-market"><p class="gz-kick">Heads up 👀</p><h4>From tomorrow, the frog hides better</h4>' +
      '<p>Up to now, a pin within 10 km of Pepe got the full 5,000 points. <b>From tomorrow\'s photo it has to be within 1 km.</b> Close is no longer close enough: zoom in, read the street signs, find the exact spot.</p>' +
      '<p class="gz-fine">Points still fall off gently further away, so a good guess still pays almost as much. The perfect 5,000 is what gets hard.</p></section>' +
      '<section class="gz-soon"><p class="gz-kick">From the editor</p><h4>Big changes are on the horizon</h4>' +
      '<div class="gz-wpbox"><img src="img/hardhat.webp" alt="Pepe in a hard hat with a hammer" width="110" height="110"><div>' +
      '<p>PepecoinHub is at the very start of the road, and you can help build it: post your scores on X, bring a fren to the pond, and write to the Editor when something breaks or when you have an idea. Every letter is read.</p></div></div>' +
      '<div class="app-row"><button type="button" class="app-btn go gz-write">✏️ Write to the Editor</button></div></section>' +
      '<section class="gz-pollsec"><p class="gz-kick">Pond Poll results</p><h4>Do you like polls?</h4>' +
      '<p>Thank you to all <b>5 of you</b> (yes, five) who voted. Now we know at least someone reads the Gazette to the very end.</p>' +
      '<div class="gz-poll" data-poll="like_polls" aria-live="polite"><p class="gz-poll-msg">Opening the ballot box…</p></div></section>' +
      '<section class="gz-letters"><p class="gz-kick">Fact of the day, from a loyal reader</p>' +
      '<figure class="gz-letter"><p class="gz-letter-from"><b>Smolpepewithaquestion</b> (guest) <span class="gz-letter-ok">🖨️ OK to print</span></p>' +
      '<blockquote>Hello have you heard of Pepecoin? Is gud.</blockquote><figcaption>Sent from /meme/.</figcaption></figure>' +
      '<p class="gz-fine">The editor checked. It is gud.</p></section>' +
      '<p class="gz-foot">*Almost weekly: three days after issue #5. Close enough.</p></article>';
  }
  // Pond Poll in the Gazette (games/supabase/update_polls.sql): the server counts; the page only shows its answer
  function paintPoll(box) {
    var id = box.getAttribute('data-poll');
    var say = function (t) { box.innerHTML = '<p class="gz-poll-msg">' + t + '</p>'; };
    var left = function (iso) {
      var ms = Date.parse(iso) - Date.now(); if (!(ms > 0)) return 'Closed';
      var h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60;
      return 'Closes in ' + (h >= 24 ? Math.floor(h / 24) + 'd ' + (h % 24) + 'h' : h + 'h ' + m + 'm');
    };
    var show = function (p) {
      if (!p || !Array.isArray(p.options)) return say('The ballot box opens soon. Come back in a bit.');
      var html = '<p class="gz-poll-when">' + (p.open ? left(p.closes_at) : 'Closed') + (p.total != null ? ' · ' + fmt.int(p.total) + (p.total === 1 ? ' vote' : ' votes') : '') + '</p>';
      if (p.show_results) {
        var max = Math.max(1, p.total || 0);
        var top = Math.max.apply(null, p.options.map(function (o) { return o.votes || 0; }));
        // the bigger the result, the bigger the row: --s (0…1) is the option's share and scales the label, bar and number
        html += '<ul class="gz-bars">' + p.options.map(function (o) {
          var n = o.votes || 0, pc = Math.round(n * 100 / max);
          var cls = (o.id === p.my_choice ? 'mine' : '') + (top > 0 && n === top ? ' lead' : '');
          return '<li style="--s:' + (n / max).toFixed(3) + '"' + (cls.trim() ? ' class="' + cls.trim() + '"' : '') + '><b>' + esc(o.label) + (o.id === p.my_choice ? ' ✓' : '') + '</b><span class="gz-bar"><i style="width:' + pc + '%"></i></span><span>' + pc + '% (' + fmt.int(n) + ')</span></li>';
        }).join('') + '</ul>';
        if (p.my_choice) html += '<p class="gz-poll-msg">Thanks for voting, fren.</p>';
      } else if (p.open) {
        // everyone votes: with no session yet, a click makes a guest player first (one quick bot check)
        html += '<div class="app-row gz-votes">' + p.options.map(function (o) { return '<button type="button" class="app-btn go gz-vote" data-c="' + esc(o.id) + '">' + esc(o.label) + '</button>'; }).join('') + '</div>';
        if (!anySession()) html += '<p class="gz-poll-msg">No account needed: your vote starts a guest log-on with a quick bot check.</p>';
      }
      box.innerHTML = html;
      box.querySelectorAll('.gz-vote').forEach(function (b) {
        b.addEventListener('click', function () {
          box.querySelectorAll('.gz-vote').forEach(function (x) { x.disabled = true; });
          var c = b.getAttribute('data-c');
          freshSession().then(function (s) { if (s) return s; say('Quick bot check…'); return guestSignIn(); })
            .then(function () { return chatRpc('gry_poll_vote', { p_poll: id, p_choice: c }); }).then(show, function (e) {
              var m = (e && e.message) || '';
              say(/closed/i.test(m) ? 'This poll is closed.' : /network has already voted/.test(m) ? esc(m) : /guest player|captcha|bot/i.test(m) ? 'The bot check did not pass. Try again, or log on with Discord.' : 'Your vote did not go through. Try again in a moment.');
            });
        });
      });
    };
    wpRpc('gry_poll', { p_poll: id }).then(show, function () { say('The ballot box opens soon. Come back in a bit.'); });
  }
  function frogMail(view) {
    try { localStorage.setItem(MAIL_KEY, String(MAIL_ISSUE)); } catch (e) {}
    paintMail();
    var A = openApp('mail', 'Frog Mail - Inbox', 'frog-mail', function (A) {
      A.body.innerHTML = '<div class="mail"><ul class="mail-list">' +
        // one compact row of tabs: the letter form, then the Gazette issues by number (newest first)
        '<li><button type="button" data-v="write" title="Ideas, bugs, wishes, notices">✏️ Letter to the Editor</button></li>' +
        '<li><button type="button" data-v="gz" title="The Pond Gazette #6: X unblocked us, the first faucet payout, 1 km from tomorrow" aria-label="The Pond Gazette #6">📰 #6</button></li>' +
        '<li><button type="button" data-v="gz5" title="The Pond Gazette #5 (archive): the lockout, CoinEx and the first Pond Poll" aria-label="The Pond Gazette #5">#5</button></li>' +
        '<li><button type="button" data-v="gz4" title="The Pond Gazette #4 (archive): the Pepe Guesser leak" aria-label="The Pond Gazette #4">#4</button></li>' +
        '<li><button type="button" data-v="gz3" title="The Pond Gazette #3 (archive): an internet in your internet" aria-label="The Pond Gazette #3">#3</button></li>' +
        '<li><button type="button" data-v="gz2" title="The Pond Gazette #2 (archive): Pepe Guesser is coming" aria-label="The Pond Gazette #2">#2</button></li>' +
        '<li class="ml-owner" hidden><button type="button" data-v="box" title="Editor\'s desk: only you can see these" aria-label="Editor\'s desk">📥 <span class="ml-n"></span></button></li>' +
        '</ul><div class="mail-pane"></div></div>';
      var pane = A.body.querySelector('.mail-pane'), ct = 0;
      var stopClock = function () { clearInterval(ct); ct = 0; };
      A.stop = stopClock;
      var paintOwner = function () {
        var li = A.body.querySelector('.ml-owner'); li.hidden = !letterBox;
        if (letterBox) A.body.querySelector('.ml-n').textContent = letterBox.unread ? letterBox.unread + ' new' : '';
      };
      var show = function (v) {
        stopClock();
        A.body.querySelectorAll('.mail-list button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-v') === v); });
        if (v === 'write') return writeLetter(pane);
        if (v === 'box') return letterInbox(pane, paintOwner);
        var issue = v === 'gz2' ? 2 : v === 'gz3' ? 3 : v === 'gz4' ? 4 : v === 'gz5' ? 5 : 6;
        pane.innerHTML = issue === 6 ? gazette6() : issue === 5 ? gazette5() : issue === 4 ? gazette4() : issue === 2 ? '<article class="gazette"><header><p class="gz-top"><span>Issue #2</span><span>Price: 0 PEP</span><span>Weekly, soon</span></p><h3>The Pond Gazette</h3><p class="gz-sub">All the news that fits in a pond</p></header>' +
        '<p class="gz-stop">🚧 Under construction. The presses are still warming up.</p>' +
        '<section><p class="gz-kick">Front page</p><h4>Hello world!</h4>' +
        '<p>Welcome to the very first Pond Gazette. This pond is being built while you read this: new apps, games and pages land almost every day, and we are just getting started.</p>' +
        '<p><b>Got an idea, a wish or a bug?</b> Write a letter right here in Frog Mail. It goes straight to the editor, every letter is read, and the best ideas get built.</p>' +
        '<div class="app-row"><button type="button" class="app-btn go gz-write">✏️ Write a letter</button><button type="button" class="app-btn gz-lan">Or say it in LAN Party →</button></div></section>' +
        '<section class="gz-wp"><p class="gz-kick">Extra! Extra!</p><h4>Pepe packs his backpack: Pepe Guesser starts soon</h4>' +
        '<div class="gz-wpbox"><img src="img/wp-pepe.webp" alt="Pepe the explorer with binoculars" width="110" height="104"><div>' +
        '<p>Every day Pepe sends one photo from somewhere in the world. You get 2 minutes and one pin on the map. The closer you get, the more points: up to 5000 a day.</p>' +
        '<p><b>And free PEP for everyone!</b> 1 PEP for every 50 points, paid by the host every week. Discord players get up to 100 PEP a day, guests up to 50.</p>' +
        '<p class="gz-count"></p></div></div>' +
        '<div class="app-row"><button type="button" class="app-btn gz-wpgo">Open Pepe Guesser →</button><button type="button" class="app-btn gz-wpad">Watch the PEP-TV ad</button></div></section>' +
        '<section class="gz-lead"><p class="gz-kick">Classifieds</p><h4>HELP WANTED: a frog to run game night</h4>' +
        '<div class="gz-frame ptv"><div class="ptv-top"><span class="ptv-live">LIVE</span><b>PEP-TV</b><span class="ptv-ch">CH 1 · PEPE PICTURES PRIME TIME</span></div><div class="ptv-stage"><div class="ptv-scene on"><h3 class="ad-big">WANTED:<br>a frog to run<br><em>game night!</em></h3></div></div></div>' +
        '<p>Pepe Pictures, the weekly quiz night, needs a host: set the date, pick the pictures, start the rounds and crown the winner. All in the chat.</p>' +
        '<button type="button" class="app-btn gz-tv">More on PEP-TV →</button></section>' +
        '<section class="gz-soon"><p class="gz-kick">Coming in the weekly issues</p><ul><li><b>The week in numbers:</b> price, hashrate, new blocks and supply, with sources.</li><li><b>Pond Picks:</b> the best posts and memes, picked by the community.</li><li><b>Game night winners</b> and the best Pepe Miner runs.</li></ul></section>' +
        '<p class="gz-foot">When a new issue lands, the flag on the mailbox goes up.</p></article>' : '<article class="gazette"><header><p class="gz-top"><span>Issue #3</span><span>Price: 0 PEP</span><span>Weekly</span></p><h3>The Pond Gazette</h3><p class="gz-sub">All the news that fits in a pond</p></header>' +
          '<section><p class="gz-kick">Front page</p><h4>Yo dawg, we put an internet in your internet</h4>' +
          '<div class="gz-wpbox"><img src="img/laptop.webp" alt="Pepe at a laptop" width="120" height="96"><div>' +
          '<p>The pond is growing up. Not one more crypto dashboard you check once and forget: a small internet inside the internet, a place you actually want to come back to.</p>' +
          '<p><b>Every day:</b> a new Pepe Guesser photo and free PEP for good guesses, games with a Leaders board, the LAN Party chat. <b>Every week:</b> a fresh Gazette with your letters and notices. <b>Every time:</b> weird facts and PEP-TV.</p></div></div>' +
          '<p>You read it, you play it, and from now on you shape it.</p></section>' +
          '<section class="gz-wp"><p class="gz-kick">Extra! Extra!</p><h4>Pepe Guesser is open for everyone</h4>' +
          '<div class="gz-wpbox"><img src="img/wp-pepe.webp" alt="Pepe the explorer with binoculars" width="110" height="104"><div>' +
          '<p>One photo a day, 2 minutes, one pin on the map. Up to 5000 points, and 1 PEP for every 50 points, paid weekly. Call it the pond faucet: you just have to know your geography.</p>' +
          '<p class="gz-count"></p></div></div>' +
          '<div class="app-row"><button type="button" class="app-btn go gz-wpgo">Play today\'s photo →</button></div></section>' +
          '<section class="gz-letters"><p class="gz-kick">New column</p><h4>Letters to the Editor</h4>' +
          '<p>Our editor-in-chief is fully licensed (the licence is a sticky note on the monitor) and reads every single letter. Ideas, bugs, wishes, complaints about the frogs: send it in.</p>' +
          '<p>Tick <b>“OK to print”</b> and the best letters land right here in the next issue.</p>' +
          '<button type="button" class="app-btn go gz-write">✏️ Write to the Editor</button></section>' +
          '<section class="gz-board"><p class="gz-kick">Notice board</p><ul class="gz-notes">' +
          '<li><b>📌 The editor is listening.</b> Frog Mail → Letters to the Editor. Up to 3 letters a day.</li>' +
          '<li class="gz-tvnote"></li>' +
          '<li><b>📌 HELP WANTED:</b> a frog to run game night (Pepe Pictures). <a href="#" class="gz-tv">Details on PEP-TV</a></li>' +
          '<li><b>📌 Your notice here.</b> Selling a meme, looking for a chess rival, starting a Pepe club? Send it as a letter, tick “OK to print”.</li>' +
          '</ul></section>' +
          '<section class="gz-facts"><p class="gz-kick">Did you know?</p><ul>' +
          '<li>PEP has its own blockchain. There was no premine: every coin in existence came from mining.</li>' +
          '<li>Since block 600,000 every block pays a fixed 10,000 PEP. No more halvings.</li>' +
          '<li>The Pond Gazette has exactly one editor and zero fact-checkers. The facts above came with receipts anyway.</li></ul></section>' +
          '<p class="gz-foot">When a new issue lands, the flag on the mailbox goes up.</p></article>';
        var on = function (sel, fn) { var x = pane.querySelector(sel); if (x) x.addEventListener('click', function (e) { e.preventDefault(); fn(); }); };
        on('.gz-write', function () { show('write'); });
        on('.gz-lan', function () { lanParty(); });
        on('.gz-wpgo', wheresPepe);
        on('.gz-wpad', function () { adPlayer(Math.max(0, adByFile('pepe_guesser.mpg'))); });
        on('.gz-tv', function () { adPlayer(Math.max(0, adByFile('host_wanted.mpg'))); });
        var tvn = pane.querySelector('.gz-tvnote');
        if (tvn) {
          var ai = adByFile('internet_in_your_internet.mpg');
          tvn.innerHTML = ai >= 0 ? '<b>📌 New on PEP-TV:</b> “An internet in your internet”. <a href="#" class="gz-newad">Watch the ad</a>' : '<b>📌 ' + (function () { var at = new Date(Date.parse('2026-11-04T20:00:00+01:00')); return (at.toDateString() === new Date().toDateString() ? 'Today' : 'Tomorrow') + ' at ' + at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); })() + ' on PEP-TV:</b> a new ad about where the pond is heading. Stay tuned.';
          on('.gz-newad', function () { adPlayer(ai); });
        }
        on('.gz-frog', pondWarsApp);
        on('.gz-frogad', function () { adPlayer(Math.max(0, adByFile('frogageddon.mpg'))); });
        on('.gz-miner', minerApp);
        on('.gz-yeet', function () { yeetApp(); });
        var pollBox = pane.querySelector('.gz-poll'); if (pollBox) paintPoll(pollBox);
        on('.gz-online', function () {
          show('write');
          var lb = pane.querySelector('.lt-body'); if (lb) { lb.value = 'Dear Editor, I want FROGAGEDDON online! '; lb.dispatchEvent(new Event('input')); lb.focus(); }
        });
        var live = pane.querySelector('.gz-live');   // today's real Pepe Guesser count, next to the record
        if (live) rpc('gry_wp_count').then(function (c) { if (c && c.players) live.innerHTML = 'Today so far: <b>' + fmt.int(c.players) + (c.players === 1 ? ' player' : ' players') + '</b> 🐸'; else live.remove(); }, function () { live.remove(); });
        var gp = pane.querySelector('.gz-price');   // the live PEP price, same source as the tray
        if (gp) {
          if (!window.PepPrices) gp.remove();
          else window.PepPrices.pepQuote().then(function (q) {
            if (!q || q.usd == null) { gp.remove(); return; }
            gp.innerHTML = 'PEP now: <b>' + fmt.usd(q.usd) + '</b>' + (q.change_24h == null ? '' : ' (' + (q.change_24h < 0 ? '▼ ' : '▲ ') + fmt.pct(Math.abs(q.change_24h)) + ' in 24 h)');
          }, function () { gp.remove(); });
        }
        var cnt = pane.querySelector('.gz-count:not(.gz-live):not(.gz-price)');
        if (cnt) { var paintCount = function () { cnt.innerHTML = launchText(); }; paintCount(); ct = setInterval(paintCount, 1000); }
      };
      A.body.querySelectorAll('.mail-list button').forEach(function (b) { b.addEventListener('click', function () { show(b.getAttribute('data-v')); }); });
      A.show = show;
      paintOwner();
      checkLetters().then(paintOwner);
      show('gz');
    }, 760);
    if (view && A && A.show) A.show(view);
  }
  function writeLetter(pane) {
    var me = whoAmI(), nick = ''; try { nick = localStorage.getItem('pepgry-nick') || ''; } catch (e) {}
    pane.innerHTML = '<form class="letter"><p class="lt-head"><b>To:</b> The Editor-in-chief, The Pond Gazette<br><b>From:</b> ' +
      (me && me.discord ? esc(me.name) + ' <span class="hs-ok" title="Verified with Discord">✓</span>'
        : '<input class="ac-in lt-name" maxlength="40" placeholder="Your nickname (optional)" value="' + esc(nick) + '">') + '</p>' +
      '<textarea class="ac-in lt-body" rows="7" maxlength="1500" placeholder="Dear Editor, … An idea, a bug, a game you want, a notice for the board, anything."></textarea>' +
      '<label class="lt-print"><input type="checkbox" class="lt-ok"> OK to print my letter (and name) in the Gazette</label>' +
      '<div class="app-row"><button type="submit" class="app-btn go lt-send">✉️ Send</button><span class="lt-left hs-note"></span></div>' +
      '<p class="hs-note lt-msg">' + (me ? 'Only the editor reads letters. Up to 3 a day.' : 'Sending takes a quick log on: one click as a guest (after a short bot check) or with Discord. Only the editor reads letters. Up to 3 a day.') + '</p></form>';
    var f = pane.querySelector('form'), body = f.querySelector('.lt-body'), left = f.querySelector('.lt-left'), msg = f.querySelector('.lt-msg'), btn = f.querySelector('.lt-send');
    var count = function () { left.textContent = (1500 - body.value.length) + ' left'; };
    var hint = msg.textContent;
    body.addEventListener('input', function () { count(); if (msg.classList.contains('err')) { msg.classList.remove('err'); msg.textContent = hint; } }); count();
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var text = body.value.trim(), nm = f.querySelector('.lt-name');
      if (text.length < 2) { msg.textContent = 'Write a few words first.'; msg.classList.add('err'); body.focus(); return; }
      btn.disabled = true; msg.classList.remove('err'); msg.textContent = 'Sending…';
      freshSession().then(function (s) { return s || (msg.textContent = 'Quick bot check…', guestSignIn()); })
        .then(function () { return chatRpc('gry_letter_send', { p_body: text, p_name: nm ? nm.value.trim() : '', p_page: location.pathname, p_print: !!f.querySelector('.lt-ok').checked }); })
        .then(function () {
          pane.innerHTML = '<div class="tip lt-done"><img src="img/gif-045.webp" alt="" width="96" height="96"><div><b>Letter sent! 🐸</b><p>It landed on the editor\'s desk. If you ticked “OK to print”, watch the next issue of the Gazette.</p><button type="button" class="app-btn lt-again">Write another</button></div></div>';
          pane.querySelector('.lt-again').addEventListener('click', function () { writeLetter(pane); });
        }, function (err) { btn.disabled = false; msg.textContent = err.message || 'The mailbox cannot be reached right now. Try again in a minute.'; msg.classList.add('err'); });
    });
    setTimeout(function () { body.focus(); }, 50);
  }
  function letterInbox(pane, after) {
    pane.innerHTML = '<p class="hs-note">Opening the mailbox…</p>';
    checkLetters().then(function (box) {
      if (after) after();
      if (!box) { pane.innerHTML = '<p class="hs-note">Only the site owner can open this mailbox.</p>'; return; }
      if (!box.letters.length) { pane.innerHTML = '<div class="letters"><p class="hs-note">No letters yet. When someone writes, the flag on the mailbox goes up.</p></div>'; return; }
      // Passport owner tools (only with the Passport beta on, until its migrations run on launch day):
      // the "Printed" mark (Junior Editor 1, Senior Editor 5, Vox Populi 10) and BALI.
      var tools = function (l) {
        if (!FREN) return '';
        var t = '';
        if (l.print) t += '<button type="button" class="app-btn lt-printed" aria-pressed="' + !!l.printed + '" title="Printed in The Pond Gazette. Counts for Junior Editor (1), Senior Editor (5) and Vox Populi (10).">' +
          (l.printed ? '✅ Printed' : '🖨 Mark printed') + '</button>';
        return t;
      };
      var printedNote = function (l) { return l.discord && l.printed_count ? 'Printed letters from this fren: ' + l.printed_count + '. ' : ''; };
      pane.innerHTML = '<div class="letters">' + (FREN ? '<div class="app-row lt-bali"><span class="grow">BALI mythic stamp: <b>' + (box.bali_open ? 'open' : 'closed') + '</b></span>' +
          '<button type="button" class="app-btn lt-bali-btn">' + (box.bali_open ? 'Close BALI' : '🏝 PEP hit $0.01? Open BALI…') + '</button></div>' : '') + box.letters.map(function (l) {
        return '<details class="lt-item' + (l.read ? '' : ' new') + '" data-id="' + l.id + '"><summary><b>' + (l.discord ? esc(l.name) + ' <span class="hs-ok" title="Discord">✓</span>' : esc(l.name) + ' <small>(guest)</small>') + '</b>' +
          '<small>' + esc(new Date(l.at).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })) + '</small>' +
          (l.print ? '<span class="lt-tag">' + (l.printed ? '✅ Printed' : '🖨 OK to print') + '</span>' : '') + '<span class="lt-peek">' + esc(l.body.slice(0, 70)) + '</span></summary>' +
          '<p class="lt-text">' + esc(l.body) + '</p><p class="hs-note lt-note">' + (l.page ? 'Sent from ' + esc(l.page) + '. ' : '') + esc(printedNote(l)) + '</p>' +
          '<div class="app-row">' + tools(l) + '<button type="button" class="app-btn lt-del">🗑 Delete</button></div></details>';
      }).join('') + '</div>';
      var baliBtn = pane.querySelector('.lt-bali-btn');
      if (baliBtn) baliBtn.addEventListener('click', function () {
        var opening = !box.bali_open;
        // opening hands the mythic stamp to every fren who visits, so it takes a second click
        if (opening && !baliBtn.classList.contains('armed')) {
          baliBtn.classList.add('armed');
          baliBtn.textContent = 'Only if PEP is really at $0.01: click again to give BALI to every fren';
          setTimeout(function () { if (baliBtn.classList.contains('armed')) { baliBtn.classList.remove('armed'); baliBtn.textContent = '🏝 PEP hit $0.01? Open BALI…'; } }, 6000);
          return;
        }
        baliBtn.classList.remove('armed');
        baliBtn.disabled = true;
        rpc('gry_passport_bali', { p_open: opening }).then(function (r) {
          box.bali_open = !!(r && r.bali_open);
          baliBtn.disabled = false;
          baliBtn.textContent = box.bali_open ? 'Close BALI' : '🏝 PEP hit $0.01? Open BALI…';
          baliBtn.previousSibling.innerHTML = 'BALI mythic stamp: <b>' + (box.bali_open ? 'open' : 'closed') + '</b>' + (box.bali_open ? ' · every fren gets it on their next visit' : '');
        }, function (e) { baliBtn.disabled = false; alert(e.message); });
      });
      pane.querySelectorAll('.lt-item').forEach(function (d) {
        var id = +d.getAttribute('data-id');
        d.addEventListener('toggle', function () {
          if (!d.open || !d.classList.contains('new')) return;
          d.classList.remove('new');
          rpc('gry_letter_mark', { p_id: id }).then(function () { if (letterBox && letterBox.unread) letterBox.unread--; paintMail(); if (after) after(); }, function () {});
        });
        var l = box.letters.find(function (x) { return x.id === id; }) || {};
        var pr = d.querySelector('.lt-printed');
        if (pr) pr.addEventListener('click', function () {
          pr.disabled = true;
          rpc('gry_letter_printed', { p_id: id, p_printed: !l.printed }).then(function (r) {
            l.printed = !!(r && r.printed);
            if (r && typeof r.printed_count === 'number') {
              l.printed_count = r.printed_count;
            }
            pr.disabled = false;
            pr.setAttribute('aria-pressed', String(l.printed));
            pr.textContent = l.printed ? '✅ Printed' : '🖨 Mark printed';
            var tag = d.querySelector('.lt-tag'); if (tag) tag.textContent = l.printed ? '✅ Printed' : '🖨 OK to print';
            d.querySelector('.lt-note').textContent = (l.page ? 'Sent from ' + l.page + '. ' : '') + printedNote(l);
          }, function (e) { pr.disabled = false; alert(e.message); });
        });
        d.querySelector('.lt-del').addEventListener('click', function () {
          if (!confirm('Delete this letter for good?')) return;
          rpc('gry_letter_mark', { p_id: id, p_delete: true }).then(function () { d.remove(); }, function (e) { alert(e.message); });
        });
      });
    });
  }

  // ---------- Recycle Bin: the paper-hands files and a note with the easter egg codes ----------
  function paperHands() {
    openApp('bin', 'Recycle Bin', 'recycle-bin', function (A) {
      var FILES = [
        ['📄', 'sold_at_the_bottom.txt', '2 KB', 'Opened 400 times. Still says the same thing.'],
        ['🔑', 'seed_phrase_for_support.txt', '0 KB', 'Empty. Good. Nobody legit asks for a seed phrase, so you never wrote one here.'],
        ['📈', 'wen_moon_prediction.xls', '1 KB', 'Corrupted. The frog does not do price predictions.'],
        ['🐸', 'PEPE_not_PEP.lnk', '1 KB', 'Shortcut to the wrong frog. PEP has its own chain; PEPE is an ERC-20 token.', function () { discoverSecret('wrong_frog'); }],
        ['📸', 'screenshot_of_someone_elses_gains.png', '3 MB', 'Not your keys, not your coins, not your screenshot.'],
        ['💻', 'legendary_laptop_receipt.pdf', '40M PEP', 'Receipt for one laptop, paid in PEP. Double-click to see what it costs today.'],
        ['🧻', 'paper_hands.exe', '∞ KB', 'Runs automatically during every dip.'],
        ['📝', 'notes.txt', '1 KB', 'A crumpled note. Somebody wrote down secrets. Double-click (or tap) to read it.', notes]
      ];
      A.body.innerHTML = '<ul class="bin-list">' + FILES.map(function (f, i) { return '<li data-i="' + i + '"><span aria-hidden="true">' + f[0] + '</span><span>' + f[1] + '</span><small>' + f[2] + '</small></li>'; }).join('') + '</ul>' +
        '<p class="bin-tip">Click a file to see what is inside.</p><div class="app-row"><span class="grow">' + FILES.length + ' object(s)</span><button type="button" class="app-btn bin-empty">Empty Recycle Bin</button></div>';
      var tip = A.body.querySelector('.bin-tip');
      A.body.querySelectorAll('.bin-list li').forEach(function (li) {
        var f = FILES[+li.getAttribute('data-i')];
        li.addEventListener('click', function () { var was = li.classList.contains('sel'); A.body.querySelectorAll('.bin-list li').forEach(function (x) { x.classList.toggle('sel', x === li); }); tip.textContent = f[3]; if (f[4] && (was || !matchMedia('(hover: hover) and (pointer: fine)').matches)) f[4](); });
        li.addEventListener('dblclick', function () { if (f[4]) f[4](); });
      });
      A.body.querySelector('.bin-empty').addEventListener('click', function () { tip.textContent = 'Cannot empty the Recycle Bin: the paper hands already sold themselves. Diamond hands are in another folder.'; });
    }, 420);
  }

  // notes.txt in the Recycle Bin: every easter egg, written down by a frog who keeps forgetting them
  function notes() {
    var L = [
      'NOTES.TXT - do NOT share (ok maybe with frens)',
      '',
      'keyboard, anywhere on the desktop:',
      '  type  wen      -> ask the eternal question',
      '  type  seed     -> security lesson',
      '  type  moon     -> look for the moon',
      '  type  laptop   -> the legendary 40M PEP laptop',
      '  type  tip      -> about me (and the tip addresses)',
      '  up up down down left right left right B A',
      '',
      'mouse / finger:',
      '  click Start 7 times, fast',
      '  click the PEP price in the tray (bottom right)',
      '  click the clock',
      '  right-click the wallpaper',
      '  Start > Shut down > Touch grass',
      '  do nothing for 2 minutes',
      '  green bar at the very right = show desktop',
      '',
      'games folder: FUD Invaders, PEP Snake, YEET THE PEP,',
      '  PEPE SWEEPER, Pepe Miner, chess and frens.',
      'Pepe Guesser = a new photo every day (and free PEP).',
      'LEADERS = every top 10 in one place.',
      'high score or it did not happen.',
      '',
      'P.S. nobody legit ever asks for your seed phrase.'
    ];
    var A = openApp('notes', 'notes.txt - Notepad', 'recycle-bin', function (A) {
      A.body.innerHTML = '<div class="win-menu notepad-menu"><span>File</span><span>Edit</span><span>Search</span><span>Help</span></div><pre class="notepad"></pre>';
      A.body.querySelector('.notepad').textContent = L.join('\n');
    }, 460);
    return A;
  }


  // ---------- Shop: the official Pepecoin shop, in a new tab ----------
  var SHOP = 'https://shop.pepecoin.com/';

  // ---------- live numbers, for the PEP-TV crawl ----------
  function liveFacts() {
    var items = [];
    var q = window.PepPrices ? window.PepPrices.pepQuote().catch(function () { return null; }) : Promise.resolve(null);
    return Promise.all([q, json('ticker.json').catch(function () { return null; }), json('network.json').catch(function () { return null; })]).then(function (r) {
      var pq = r[0], t = r[1], n = r[2];
      var price = pq && pq.usd != null ? pq : (t && t.price);
      if (price && price.usd != null) items.push(['PEP', fmt.usd(price.usd) + (price.change_24h == null ? '' : ' ' + (price.change_24h < 0 ? '▼' : '▲') + fmt.pct(Math.abs(price.change_24h)))]);
      if (t && t.hashrate) items.push(['HASHRATE', fmt.hash(t.hashrate.hs)]);
      var last = n && n.rows && n.rows[n.rows.length - 1];
      if (last) { items.push(['BLOCK', fmt.int(last[1])]); items.push(['SUPPLY', fmt.compact(last[2]) + ' PEP']); }
      if (t && t.tops && t.tops['10'] != null) items.push(['TOP 10', fmt.pct(t.tops['10']) + ' of supply']);
      items.push(['NFA', 'the frog is not a financial advisor']);
      return items;
    });
  }

  // ---------- PEP-TV Ads: a folder of fake late-night infomercials, played in a TV window ----------
  // Every claim in them is a fact from this site; the "offers" are jokes, and every ad says so.
  // New ads: give them "added" (YYYY-MM-DD). For 21 days an ad nobody has played here yet gets a red dot,
  // on the PEP-TV Ads desktop icon and on the ad in the folder (like a Win98 "new" mark). Playing it clears the dot.
  // a Fren from the Avatar Maker's own layers, for the ads (same paint order as avatar-options.json:
  // layers_order [bg, base, clothing, mouth, eyes, hat, accessory]). Reward parts appear only to show what a stamp opens.
  function adFren(c, m, e, h, a) {
    return '<span class="ad-fren" aria-hidden="true">' + ['bg_forest', 'base_frog', c, m, e, h, a].map(function (id) { return '<img src="avatar-assets/layers/' + id + '.webp" alt="">'; }).join('') + '</span>';
  }
  var ADS = [
    { file: 'whose_passport.mpg', fren: true, added: '2026-11-08', title: 'Whose Passport Is That?', ch: 'CH 7 · POND GOSSIP HOUR', icon: 'pep-logo', scenes: [
      '<p class="ad-kick">Your fren says they flew the full 6000 m in YEET THE PEP…</p><h3 class="ad-big">…but can they<br><em>prove it?</em></h3>',
      '<div class="ad-frens">' + adFren('clothing_camo', 'mouth_smirk', 'eyes_side', 'hat_bucket', 'accessory_round') + '</div><p class="ad-kick">Click a name with a ✓ in the LAN Party chat.</p><h3 class="ad-big">Open their<br><em>Fren Passport!</em></h3><p class="ad-sub">Their Fren, their stamps with the dates, the secrets they found and their best YEET flight. Read only: nobody can change it but them.</p>',
      '<p class="ad-kick">Who gets to look?</p><h3 class="ad-big">Frens with<br>a <em>✓</em>.</h3><p class="ad-sub">Log on with Discord to open other frens\' passports. Guests have no passport, so their names stay plain. Streaks, letters and chat counts stay off the page.</p>',
      '<p class="ad-kick">But wait, there\'s more!</p><h3 class="ad-big">They can see<br><em>yours</em> too!</h3><p class="ad-sub">Every Fren Passport is open to every fren logged on with Discord. Better collect some stamps.</p><p class="ad-fine">Not a real offer. Stamps are cosmetic: no PEP, no points, no ranking, nothing to sell. Only what the server records counts.</p><button type="button" class="ad-cta ad-lanbtn">Open the LAN Party →</button>'
    ] },
    { file: 'pond_stamps.mpg', fren: true, added: '2026-11-06', title: 'Stamps That Check Out', ch: 'CH 19 · POND POST OFFICE', icon: 'pep-logo', scenes: [
      '<p class="ad-kick">Did your frog do anything today? Can you prove it?</p><h3 class="ad-big">Stamps that<br><em>check out!</em></h3><p class="ad-sub">Your Fren Passport now collects 21 stamps, each one from something the pond\'s own server saw you do.</p>',
      '<p class="ad-kick">Guess where Pepe is. Chat in the lobby. Write to the editor. Mine for an hour.</p><h3 class="ad-big">The games <em>stamp</em><br>your passport!</h3><p class="ad-sub">Pepe Guesser, the LAN Party chat, letters to the editor, Pepe Miner, YEET THE PEP and 14 or 30 days in a row on PondOS. Your old Pepe Guesser games and letters count too.</p>',
      '<div class="ad-frens">' + adFren('clothing_suit', 'mouth_smirk', 'eyes_classic', 'hat_detective', 'accessory_none') + '</div><p class="ad-kick">Five perfect 5000s in Pepe Guesser?</p><h3 class="ad-big">Dress like a<br><em>detective!</em></h3><p class="ad-sub">Detective Fren opens the detective hat and the suit. Miner Fren opens the hard hat. 14 days in a row of Pepe Guesser opens Lily\'s Explorer Pepe.</p>',
      '<p class="ad-kick">But wait, there\'s more!</p><h3 class="ad-big">Here early?<br><em>Pond Pioneer!</em></h3><p class="ad-sub">Every account with Discord linked on launch day gets it. After that, the door closes.</p><p class="ad-fine">Not a real offer. Stamps are cosmetic: no PEP, no points, nothing to sell. Only what the server records counts. Log on with Discord to collect.</p><button type="button" class="ad-cta ad-passbtn">Open my Fren Passport →</button>'
    ] },
    { file: 'fren_passport.mpg', fren: true, added: '2026-11-06', title: 'The Fren Passport', ch: 'CH 98 · POND TRAVEL AGENCY', icon: 'pep-logo', scenes: [
      '<p class="ad-kick">Tired of profiles that look like a spreadsheet?</p><h3 class="ad-big">Get a real<br><em>passport!</em></h3><p class="ad-sub">A hand-drawn paper booklet, with your Fren clipped in as the photo.</p>',
      '<img class="ad-pic" src="passport-assets/page-left.webp?v=20261106pp1" alt=""><p class="ad-kick">Fren ID. Nickname. Member since. All filled in from your Discord log-on.</p><h3 class="ad-big">No fake numbers.<br><em>Just you.</em></h3>',
      '<img class="ad-pic" src="passport-assets/page-right.webp?v=20261106pp1" alt=""><p class="ad-kick">48 stamps to collect. The pond checks every one on its own server.</p><h3 class="ad-big">Collect <em>stamps!</em></h3><p class="ad-sub">21 of them can be earned today, from what the games record. The rest say "coming soon" until they really work.</p>',
      '<p class="ad-kick">But wait, there\'s more!</p><h3 class="ad-big">One stamp says<br><em>$0.01 - BALI</em></h3><p class="ad-sub">It stays locked for every fren until Pepecoin reaches one cent. Then everybody gets it. Same day, same stamp.</p><p class="ad-fine">Not a real offer. No trip, no prize, no price prediction, no financial advice. Stamps are cosmetic: no PEP, no points, nothing to sell. Log on with Discord to open yours.</p><button type="button" class="ad-cta ad-passbtn">Open my Fren Passport →</button>'
    ] },
    { file: 'create_your_fren.mpg', fren: true, added: '2026-11-05', title: 'Create Your Fren', ch: 'CH 64 · POND MAKEOVER HOUR', icon: 'fresh-fren', scenes: [
      '<p class="ad-kick">Is your Fren Passport photo just a logo?</p><h3 class="ad-big">Your pond needs<br>a <em>face!</em></h3>',
      '<div class="ad-ba"><figure class="ad-before"><b>Before</b><img src="img/pep-logo.webp" alt=""><figcaption>“My Passport photo was a logo.”</figcaption></figure><figure class="ad-after"><b>After</b>' + adFren('clothing_purple_hoodie', 'mouth_teeth', 'eyes_hypno', 'hat_crown', 'accessory_shades') + '<figcaption>A Fren in a crown!</figcaption></figure></div>',
      '<p class="ad-kick">5 backgrounds. 5 outfits. 6 mouths. 6 eyes. 6 hats. 6 extras.</p><h3 class="ad-big"><em>32,400</em> looks.<br>Zero PEP.</h3><div class="ad-frens">' + adFren('clothing_shirt_tie', 'mouth_tongue', 'eyes_3d', 'hat_pep_cap', 'accessory_pipe') + adFren('clothing_camo', 'mouth_open', 'eyes_bloodshot', 'hat_bucket', 'accessory_none') + adFren('clothing_black_hoodie', 'mouth_smile', 'eyes_sleepy', 'hat_beanie', 'accessory_shades') + '</div><p class="ad-sub">Every part is free. Hit Randomize until it feels like you.</p>',
      '<p class="ad-kick">But wait, there\'s more!</p><h3 class="ad-big">Save it once.<br>Get <em>Fresh Fren!</em></h3><p class="ad-sub">Your first saved look unlocks the Fresh Fren achievement in your Fren Passport. One per frog.</p><p class="ad-fine">Log on with Discord to save; guests can try every look. No NFTs, no rarity, no purchase, no spendable points. It\'s just a hat.</p><button type="button" class="ad-cta ad-frenbtn">Create Your Fren →</button>'
    ] },
    { file: 'frogageddon.mpg', added: '2026-11-05', title: 'FROGAGEDDON: frog artillery', ch: 'CH 2000 · FREN SOFTWARE LATE NIGHT', icon: 'pondwars', scenes: [
      '<img class="ad-hero" src="../games/img/pondwars/title.jpg" alt=""><p class="ad-kick">Small frogs. Big grudges. Questionable footwear.</p><h3 class="ad-big">FROG<em>AGEDDON</em><br>is here!</h3>',
      '<p class="ad-kick">Turn-based frog artillery on a destructible pond.</p><h3 class="ad-big">Nine weapons.<br><em>Exploding toes.</em></h3><p class="ad-sub">Bazooka, grenades, land mines, a grapple rope and a jetpack. Pick your team, pick your map, then flatten the other frogs.</p>',
      '<p class="ad-kick">Now even better on your phone.</p><h3 class="ad-big">Tap to aim.<br><em>Hold to fire.</em></h3><p class="ad-sub">Fresh touch controls, a bigger power meter and frogs that pop when they lose. Play the CPU or a fren on one device.</p>',
      '<p class="ad-kick">But wait, there\'s more!</p><h3 class="ad-big">We need<br><em>testers!</em></h3><p class="ad-sub">Online play is coming. Help us field-test the beta so we can switch it on: play a few matches, then tell us what broke in the LAN Party chat or on the Pepecoin Discord.</p><p class="ad-fine">Beta field test. Local and vs-CPU play work now; online multiplayer is being built. No PEP prizes, just pond glory and our thanks.</p><button type="button" class="ad-cta ad-frogbtn">Play FROGAGEDDON →</button>'
    ] },
    { file: 'internet_in_your_internet.mpg', added: '2026-11-04', from: '2026-11-04T20:00:00+01:00', title: 'An internet in your internet', ch: 'CH 1 · POND PRIME TIME', icon: 'laptop', scenes: [
      '<p class="ad-kick">47 tabs open. 46 of them are bad news.</p><h3 class="ad-big">What if the pond<br>was <em>the internet?</em></h3>',
      '<img class="ad-pic" src="img/laptop.webp" alt=""><h3 class="ad-big">Yo dawg, we put an <em>internet</em><br>in your internet.</h3>',
      '<p class="ad-kick">Games. Weird facts. A daily faucet. A chat. A notice board.</p><h3 class="ad-big">One pond.<br>Come back <em>every day.</em></h3><p class="ad-sub">A new Pepe Guesser photo at 00:00 UTC, free PEP for good guesses, the Gazette every week.</p>',
      '<p class="ad-fine">Got an idea for the pond? Write to the editor. The best letters get printed.</p><button type="button" class="ad-cta ad-mailbtn">Write to the Editor →</button>'
    ] },
    { file: 'at_mention.mpg', added: '2026-11-03', title: '@mentions in the chat', ch: 'CH 2 · POND TALK RADIO', icon: 'gif-080-still', scenes: [
      '<p class="ad-kick">Your fren is in the LAN Party chat…</p><h3 class="ad-big">…but you are<br><em>not looking!</em></h3>',
      '<h3 class="ad-big">Now they can<br><em>@mention</em> you.</h3><p class="ad-sub">Type @ and pick a verified fren. They get a highlight, a ping and a pop-up if they allowed it.</p>',
      '<p class="ad-kick">Away from the pond?</p><h3 class="ad-big">The mention <em>waits</em><br>for you.</h3><p class="ad-sub">For 24 hours. Too many pings? One click turns them off.</p>',
      '<p class="ad-fine">Verified (Discord) players only. Guests can still read and say gm.</p><button type="button" class="ad-cta ad-lanbtn">Open the LAN Party →</button>'
    ] },
    { file: 'pepe_sweeper.mpg', added: '2026-11-03', title: 'PEPE SWEEPER', ch: 'CH 9 · POND SAFETY HOUR', icon: 'pepesweeper', scenes: [
      '<p class="ad-kick">Are you sure that frog is the right frog?</p><h3 class="ad-big">The <em>WRONG PEPE</em><br>is hiding in the pond!</h3>',
      '<img class="ad-pic" src="../assets/coins/pepe.png" alt=""><p class="ad-sub">PEPE on Ethereum sneaked under the lily pads. The numbers tell you how many are close.</p>',
      '<h3 class="ad-big">Plant a <em>flag</em>.<br>Clear the pond.</h3><p class="ad-sub">Three levels: Tadpole, Pond Regular, Diamond Hands. Beat your best time.</p>',
      '<p class="ad-fine">No PEP prizes. Just you, the lily pads and your nerves.</p><button type="button" class="ad-cta ad-sweepbtn">Play PEPE SWEEPER →</button>'
    ] },
    { file: 'yeet_the_pep.mpg', added: '2026-11-02', title: 'YEET THE PEP', ch: 'CH 404 · THE UNOFFICIAL SPACE PROGRAM', icon: 'yeet', scenes: [
      '<p class="ad-kick">Pepe wanted to go to the moon.</p><h3 class="ad-big">Nobody gave him<br>a <em>rocket.</em></h3>',
      '<h3 class="ad-big">So we gave him<br>a <em>catapult!</em></h3><img class="ad-pic" src="../games/img/yeet/pilot.webp" alt="">',
      '<p class="ad-kick">Hold to charge. Release to yeet. Three panic flaps.</p><h3 class="ad-big"><em>PUMP</em> candles launch you.<br>The <em>SELL WALL</em> stops you.</h3><p class="ad-sub">The track changes every round.</p>',
      '<p class="ad-fine">Helmet included. Aerospace qualifications not included. No PEP prizes: just the Hall of Fren top 10.</p><button type="button" class="ad-cta ad-yeetbtn">Play YEET THE PEP →</button>'
    ] },
    { file: 'pepe_guesser.mpg', title: "Pepe Guesser: a new photo every day", ch: 'CH 5000 · THE POND TRAVEL CHANNEL', icon: 'wheres-pepe', scenes: [
      '<p class="ad-kick">Pepe packed a backpack, a map and a camera…</p><h3 class="ad-big">…and now he is<br><em>LOST!</em></h3>',
      '<img class="ad-pic" src="img/wp-pepe.webp" alt=""><p class="ad-sub">Every day he sends one photo from somewhere in the world. Find him on the map!</p>',
      '<h3 class="ad-big">2 minutes.<br>1 pin.<br><em>5000 points!</em></h3><p class="ad-sub">The faster and the closer, the better. Hints show up as the clock runs down.</p>',
      '<p class="ad-kick">But wait, there\'s more!</p><h3 class="ad-big"><em>FREE PEP!*</em></h3><p class="ad-sub ad-launch"></p>',
      '<p class="ad-fine">*1 PEP per 50 points: up to 100 PEP a day with Discord, up to 50 as a guest (from day 2 of a streak). Weekly budget, paid weekly by the host. No purchase, no seed phrase, no catch.</p><button type="button" class="ad-cta ad-wpbtn">Open Pepe Guesser →</button>'
    ] },
    { file: 'host_wanted.mpg', title: 'Wanted: a frog to run game night', ch: 'CH 1 · PEPE PICTURES PRIME TIME', icon: 'unclesam', scenes: [
      '<p class="ad-kick">Always the one who organises the group chat?</p><h3 class="ad-big">WANTED:<br>a frog to run<br><em>game night!</em></h3>',
      '<img class="ad-pic" src="../games/img/host-wanted.webp" alt=""><p class="ad-sub">Pepe Pictures is our weekly quiz night. A picture starts as a few giant pixels and gets sharper. The first three correct guesses score 3, 2 and 1 points.</p>',
      '<p class="ad-kick">The job, in full:</p><p class="ad-sub">• set the date of the night<br>• pick the pictures<br>• start the rounds<br>• keep the chat friendly<br>• crown the winner of the night</p><h3 class="ad-big">Eternal <em>pond fame!</em></h3>',
      '<p class="ad-fine">Volunteer job. Pay: zero PEP and a lot of “gg”. All in the chat: no voice, no camera. Real frogs only, no bots.</p><a class="ad-cta" href="https://discord.gg/pepecoin" target="_blank" rel="noopener">Apply on the Pepecoin Discord →</a>'
    ] },
    { file: 'better_frog.mpg', title: 'There has to be a better frog!', ch: 'CH 42 · THE FROG SHOPPING HOUR', icon: 'wrongpep', scenes: [
      '<p class="ad-kick">Are you tired of frogs that turn out to be tokens?</p><h3 class="ad-big">There has to be<br>a <em>better frog!</em></h3>',
      '<div class="ad-ba"><figure class="ad-before"><b>Before</b><img src="img/wrongpep.webp" alt=""><figcaption>“I bought a frog on Ethereum by mistake.”</figcaption></figure><figure class="ad-after"><b>After</b><img src="img/pep-logo.webp" alt=""><figcaption>Pepecoin (PEP). The frog with its own blockchain!</figcaption></figure></div>',
      '<p class="ad-kick">Not a token. Not on Ethereum.</p><h3 class="ad-big">Its own chain.<br><em>0% premine!</em></h3><p class="ad-sub">Proof-of-work. Mined, not minted. Merge-mined with Litecoin and Dogecoin.</p>',
      '<h3 class="ad-big">Operators are<br><em>NOT</em> standing by.</h3><p class="ad-sub">Read the guide. Check the ticker. Then decide for yourself.</p><a class="ad-cta" href="buy.html">How to get PEP →</a>'
    ] },
    { file: 'but_wait_theres_more.mpg', title: 'But wait, there’s more!', ch: 'CH 7 · MINER’S MIDNIGHT MARKET', icon: 'pickaxe', scenes: [
      '<p class="ad-kick">Already mining Litecoin or Dogecoin?</p><h3 class="ad-big">Your Scrypt rig<br>is <em>bored.</em></h3>',
      '<h3 class="ad-big">But wait,<br><em>there’s more!</em></h3><p class="ad-sub">Pepecoin uses the same Scrypt algorithm and can be merge-mined alongside them.</p>',
      '<h3 class="ad-big">One hash.<br><em>Three chains.*</em></h3><img class="ad-pic" src="img/triple-mine.png" alt="">',
      '<p class="ad-fine">*Only on pools that merge-mine PEP. Electricity, hardware and patience not included.</p><a class="ad-cta" href="mining.html">See the mining guide →</a>'
    ] },
    { file: 'seed_phrase_hotline.mpg', title: 'The Seed Phrase Hotline', ch: 'CH 911 · PUBLIC SERVICE FROG', icon: 'gif-085-still', scenes: [
      '<p class="ad-kick">Got a seed phrase?</p><h3 class="ad-big">Call now!<br><em>0-800-NOBODY</em></h3>',
      '<h3 class="ad-big"><em>Just kidding.</em></h3><p class="ad-sub">Nobody legit will ever ask for it. Not support, not admins, not frogs.</p>',
      '<img class="ad-pic" src="img/gif-085.webp" alt=""><p class="ad-sub">“Support” in your DMs? That is a scammer, fren.</p>',
      '<h3 class="ad-big">Keep it <em>offline.</em></h3><p class="ad-sub">This has been a public service frog.</p><a class="ad-cta" href="wallets.html">Wallet safety →</a>'
    ] },
    { file: 'legendary_laptop.mpg', title: 'The Legendary Laptop', ch: 'CH 40M · LEGENDS AT LATE NIGHT', icon: 'laptop', scenes: [
      '<p class="ad-kick">As the pond tells it…</p><h3 class="ad-big">The Legendary<br><em>Laptop!</em></h3><img class="ad-pic" src="img/laptop.webp" alt="">',
      '<h3 class="ad-big">Only<br><em>40,000,000 PEP!</em></h3><p class="ad-sub">A fren once paid that for one laptop. The pond has never forgotten.</p>',
      '<p class="ad-kick">What would it cost today?</p><h3 class="ad-big"><em class="ad-lap">…</em></h3><p class="ad-sub">40M PEP × today’s hourly price snapshot.</p>',
      '<p class="ad-fine">Laptop not included. Not an offer. Not financial advice.</p><button type="button" class="ad-cta ad-lapbtn">Open the Laptop Index →</button>'
    ] },
    { file: 'frog_doctor.mpg', title: 'Ask the Frog Doctor', ch: 'CH 0x · THE TICKER CLINIC', icon: 'pepe-search', scenes: [
      '<p class="ad-kick">Does your wallet say PEPE when you meant PEP?</p><h3 class="ad-big">You may suffer from<br><em>Ticker Confusion!</em></h3>',
      '<p class="ad-kick">Symptoms include:</p><p class="ad-sub">• an address that starts with 0x<br>• a frog that lives on Ethereum<br>• “it said Pepe, so I clicked buy”</p><img class="ad-pic" src="img/pepe-search.webp" alt="">',
      '<h3 class="ad-big">Ask the<br><em>Frog Doctor!</em></h3><p class="ad-sub">PEP has its own chain, and its addresses start with a capital P. PEPE is an ERC-20 token. PEPECOIN (2016) is another project again.</p>',
      '<p class="ad-fine">Side effects of reading the comparison may include checking the ticker twice. Not medical advice. Not financial advice either.</p><a class="ad-cta" href="which-pepecoin.html">See the side-by-side →</a>'
    ] },
    { file: 'sixty_second_frog.mpg', title: 'The 60-Second Frog', ch: 'CH 60 · BLOCKS AROUND THE CLOCK', icon: 'alarm-still', scenes: [
      '<p class="ad-kick">Tired of waiting ten minutes for the next block?</p><h3 class="ad-big">Meet the<br><em>60-Second Frog!</em></h3>',
      '<img class="ad-pic" src="img/alarm.webp" alt=""><p class="ad-sub">Pepecoin aims for one new block about every 60 seconds. Bitcoin aims for one every ten minutes.</p>',
      '<h3 class="ad-big">Same pace<br>as <em>Dogecoin!</em></h3><p class="ad-sub">Both chains target a 60-second block, and both can be merge-mined with Litecoin.</p>',
      '<p class="ad-fine">Block times vary: “about 60 seconds” is the target, not a promise. Frog not included.</p><a class="ad-cta" href="network.html">Watch the live network →</a>'
    ] }
  ];
  var adSeen = function () { try { return JSON.parse(localStorage.getItem('pondos-ads-seen') || '[]'); } catch (e) { return []; } };
  ADS = ADS.filter(function (ad) { return (!ad.from || Date.now() >= Date.parse(ad.from)) && (FREN || !ad.fren); });
  function adByFile(f) { for (var k = 0; k < ADS.length; k++) if (ADS[k].file === f) return k; return -1; }
  var adNew = function (ad) { return !!ad.added && Date.now() - Date.parse(ad.added + 'T00:00:00Z') < 21 * 864e5 && adSeen().indexOf(ad.file) < 0; };
  function adBadges() {
    var n = ADS.filter(adNew).length;
    document.querySelectorAll('.icons a[href="#ads"]').forEach(function (a) {
      var b = a.querySelector('.ads-new');
      if (!b) { b = el('span', { class: 'ads-new mail-badge', title: 'New ads' }); a.appendChild(b); }
      b.textContent = n; b.hidden = !n;
    });
    document.querySelectorAll('.ads-folder button[data-i]').forEach(function (b) { b.classList.toggle('is-new', adNew(ADS[+b.getAttribute('data-i')])); });
  }
  setTimeout(adBadges, 0);
  function adPlayer(i) {
    var ad = ADS[i];
    if (adNew(ad)) { try { localStorage.setItem('pondos-ads-seen', JSON.stringify(adSeen().concat(ad.file).slice(-50))); } catch (e) {} adBadges(); }
    var A = openApp('ad-' + i, ad.file + ' - Pond Media Player', 'pond-tv', function (A) {
      A.body.innerHTML = '<div class="ptv"><div class="ptv-top"><span class="ptv-live">LIVE</span><b>PEP-TV</b><span class="ptv-ch">' + ad.ch + '</span></div>' +
        '<div class="ptv-stage">' + ad.scenes.map(function (h, k) { return '<div class="ptv-scene' + (k ? '' : ' on') + '">' + h + '</div>'; }).join('') + '</div>' +
        '<div class="ptv-crawl"><b>PEP NOW</b><span class="ptv-run"></span></div></div>' +
        '<div class="app-row"><button type="button" class="app-btn ptv-prev">◀◀</button><button type="button" class="app-btn ptv-play" aria-pressed="true">❚❚</button><button type="button" class="app-btn ptv-next">▶▶</button><span class="grow ptv-pos"></span><span class="ptv-nfa">Not a real offer. Not financial advice.</span></div>' +
        '<div class="app-row ptv-ads"><button type="button" class="app-btn ptv-ad-prev" title="Previous ad">⏮ Previous ad</button><span class="grow ptv-adpos">Ad ' + (i + 1) + ' of ' + ADS.length + '</span><button type="button" class="app-btn ptv-ad-next" title="Next ad">Next ad ⏭</button></div>';
      var sc = A.body.querySelectorAll('.ptv-scene'), cur = 0, playing = true, t = null, pos = A.body.querySelector('.ptv-pos');
      var show = function (k) { cur = (k + sc.length) % sc.length; sc.forEach(function (x, j) { x.classList.toggle('on', j === cur); }); pos.textContent = 'Scene ' + (cur + 1) + ' of ' + sc.length; };
      var loop = function () { clearTimeout(t); if (playing && document.body.contains(A.host)) t = setTimeout(function () { show(cur + 1); loop(); }, REDUCE ? 6000 : 3800); };
      show(0); loop();
      A.body.querySelector('.ptv-next').addEventListener('click', function () { show(cur + 1); loop(); });
      A.body.querySelector('.ptv-prev').addEventListener('click', function () { show(cur - 1); loop(); });
      // another ad: this window closes and the other one opens in the same spot (and stays full screen if this one was)
      var swap = function (d) {
        var j = (i + d + ADS.length) % ADS.length, st = A.host.style, max = A.host.classList.contains('is-max');
        var keep = { top: st.top, left: st.left, transform: st.transform, at: st.getPropertyValue('--app-top') };
        A.close();
        var B = adPlayer(j);
        if (B && B.host) { B.host.style.top = keep.top; B.host.style.left = keep.left; B.host.style.transform = keep.transform; if (keep.at) B.host.style.setProperty('--app-top', keep.at); if (max) B.host.classList.add('is-max'); }
      };
      A.body.querySelector('.ptv-ad-prev').addEventListener('click', function () { swap(-1); });
      A.body.querySelector('.ptv-ad-next').addEventListener('click', function () { swap(1); });
      var pb = A.body.querySelector('.ptv-play');
      pb.addEventListener('click', function () { playing = !playing; pb.setAttribute('aria-pressed', String(playing)); pb.textContent = playing ? '❚❚' : '▶'; loop(); });
      var lap = A.body.querySelector('.ad-lap');
      if (lap && window.PepPrices) window.PepPrices.pepQuote().then(function (q) { if (q && q.usd != null) lap.textContent = fmt.usd(40e6 * q.usd); }).catch(function () {});
      var lb = A.body.querySelector('.ad-lapbtn'); if (lb) lb.addEventListener('click', function () { laptop(); });
      var wb = A.body.querySelector('.ad-wpbtn'); if (wb) wb.addEventListener('click', function () { wheresPepe(); });
      var yb = A.body.querySelector('.ad-yeetbtn'); if (yb) yb.addEventListener('click', function () { yeetApp(); });
      var lnb = A.body.querySelector('.ad-lanbtn'); if (lnb) lnb.addEventListener('click', function () { lanParty(); });
      var mlb = A.body.querySelector('.ad-mailbtn'); if (mlb) mlb.addEventListener('click', function () { frogMail('write'); });
      var sb = A.body.querySelector('.ad-sweepbtn'); if (sb) sb.addEventListener('click', function () { pepeSweeperApp(); });
      var fb2 = A.body.querySelector('.ad-frogbtn'); if (fb2) fb2.addEventListener('click', function () { pondWarsApp(); });
      var frb = A.body.querySelector('.ad-frenbtn'); if (frb) frb.addEventListener('click', function () { avatarMaker(); });
      var ppb = A.body.querySelector('.ad-passbtn'); if (ppb) ppb.addEventListener('click', function () { frenPassport(); });
      var wl = A.body.querySelector('.ad-launch'); if (wl) { wl.innerHTML = launchText(); var wlt = setInterval(function () { if (!document.body.contains(wl)) clearInterval(wlt); else wl.innerHTML = launchText(); }, 1000); }
      liveFacts().then(function (items) { var txt = items.map(function (x) { return x[0] + ' ' + x[1]; }).join('  •  ') + '  •  '; A.body.querySelector('.ptv-run').textContent = txt + txt; });
    }, 720);
    return A;
  }
  function adsFolder() {
    openApp('ads', 'C:\\Pond\\PEP-TV Ads', 'pep-tv-ads', function (A) {
      A.body.innerHTML = '<ul class="folder ads-folder">' + ADS.map(function (ad, i) { return '<li><button type="button" data-i="' + i + '"><img src="' + ico(ad.icon) + '" alt="" width="40" height="40"><span>' + ad.file + '</span></button></li>'; }).join('') + '</ul>' +
        '<p class="bin-tip">Late-night PEP-TV infomercials, recovered from an old VHS. Double-click one to play. The facts are real; the offers are not. A red dot marks a new one.</p>';
      adBadges();
      A.body.querySelectorAll('.folder button').forEach(function (b) {
        var go = function () { adPlayer(+b.getAttribute('data-i')); };
        b.addEventListener('dblclick', go);
        b.addEventListener('click', function () { if (!matchMedia('(hover: hover) and (pointer: fine)').matches) go(); else { A.body.querySelectorAll('.folder .sel').forEach(function (x) { x.classList.remove('sel'); }); b.classList.add('sel'); } });
        b.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } });
      });
    }, 520);
  }

  // ---------- easter eggs ----------
  function coinRain(n) {
    if (REDUCE) return;
    for (var i = 0; i < (n || 24); i++) (function (i) {
      setTimeout(function () { var im = el('img', { class: 'coin-rain', src: 'img/pep-logo.webp', alt: '' }); im.style.left = Math.random() * 96 + 'vw'; im.style.animationDuration = (1.8 + Math.random() * 1.6) + 's'; document.body.appendChild(im); setTimeout(function () { im.remove(); }, 3800); }, i * 70);
    })(i);
  }
  // The desktop words from notes.txt. Typing one while signed in with Discord finds the secret "The Magic Word".
  // Find runs them too, so phones (no desktop keyboard) can use them.
  var MAGIC = {
    wen: function () { osDialog('wen.exe', '<div class="dlg-row"><img src="img/gif-064.webp" alt="" width="96" height="70"><div><h3>wen.exe has performed a legal operation.</h3><p>No price predictions are installed on this system. For arithmetic, open WhatIf.exe.</p></div></div>', [{ label: 'OK', go: true }, { label: 'Open WhatIf.exe', href: 'calculator.html' }], 'gif-064-still'); },
    seed: function () { osDialog('Security Center', '<div class="dlg-row"><img src="img/gif-085.webp" alt="" width="96" height="96"><div><h3>Seed phrase? Never here.</h3><p>PondOS will never ask for it. Not support, not admins, not frogs. If anything asks you to type it, close it.</p></div></div>', [{ label: 'Understood', go: true }], 'gif-085-still'); },
    tip: function () { aboutMe(); },
    laptop: function () { laptop(); },
    moon: function () { coinRain(8); balloon('Moon not found', 'The frog checked. There is no moon in chainparams.cpp.', 'gif-084-still'); }
  };
  function magicWord(w) { if (!MAGIC[w]) return false; MAGIC[w](); discoverSecret('magic_word'); return true; }
  // Blue Screen of Fren: "format c:" in Find (or typed on the desktop). Any key or click brings PondOS back.
  function bsod() {
    if (document.querySelector('.bsod')) return;
    var d = document.createElement('div');
    d.className = 'bsod'; d.setAttribute('role', 'alertdialog'); d.setAttribute('aria-label', 'Blue Screen of Fren'); d.tabIndex = -1;
    d.innerHTML = '<div class="bsod-in"><p class="bsod-h">&nbsp;PondOS&nbsp;</p>' +
      '<p>A fatal exception 0E has occurred at 0028:C0FFEE69 in VXD FROG(01) + 00000420. The current application will be terminated.</p>' +
      '<p>The frog tried to format drive C: and found only memes, one lily pad and a wallet backup it refuses to touch.</p>' +
      '<p>*&nbsp; Never type commands a stranger sends you. Not in PondOS, not in your wallet.<br>*&nbsp; Press any key (or tap) to return to the pond.</p>' +
      '<p class="bsod-c">Press any key to continue <span class="bsod-cur">_</span></p></div>';
    var close = function () { document.removeEventListener('keydown', close, true); d.remove(); };
    d.addEventListener('click', close);
    document.addEventListener('keydown', close, true);
    document.body.appendChild(d); d.focus();
    discoverSecret('bsod_fren');
  }
  var typed = '', KONAMI = 'ArrowUp ArrowUp ArrowDown ArrowDown ArrowLeft ArrowRight ArrowLeft ArrowRight b a', kseq = [];
  document.addEventListener('keydown', function (e) {
    if (!mainEl || (e.target.closest && e.target.closest('input, textarea, select'))) return;
    kseq.push(e.key); kseq = kseq.slice(-10);
    if (kseq.join(' ') === KONAMI) { coinRain(30); balloon('Cheat code accepted', '+0 PEP. Nice try, fren. Coins come from mining, not from cheat codes.', 'pep-logo'); kseq = []; return; }
    if (e.key.length !== 1) return;
    typed = (typed + e.key.toLowerCase()).slice(-12);
    var hit = /(wen|seed|tip|laptop|moon)$/.exec(typed);
    if (/format c:$/.test(typed)) { typed = ''; bsod(); }
    else if (hit) { typed = ''; magicWord(hit[1]); }
  });
  var startClicks = 0, startT = null, startBtn = document.querySelector('.start');
  if (startBtn) startBtn.addEventListener('click', function () {
    startClicks++; clearTimeout(startT); startT = setTimeout(function () { startClicks = 0; }, 1500);
    if (startClicks === 7) { startClicks = 0; balloon('Start harder?', 'No need. A new block starts itself about every 60 seconds.', 'gif-047-still'); }
  });
  function touchGrass() {
    var s = el('div', { class: 'safe-off', role: 'button', tabindex: '0' }, '<div>It’s now safe to touch grass.<small>click anywhere to come back</small></div>');
    document.body.appendChild(s); s.focus();
    var back = function () { s.remove(); };
    s.addEventListener('click', back); s.addEventListener('keydown', back);
  }
  function shutDown() {
    osDialog('Shut Down PondOS', '<div class="dlg-row"><img src="img/gif-071.webp" alt="" width="96" height="79"><div><h3>What do you want the frog to do?</h3><p>Note: the Pepecoin network does not shut down. It keeps aiming for one block every 60 seconds, with or without you.</p></div></div>',
      [{ label: 'Touch grass', go: true, fn: function () { setTimeout(touchGrass, 50); } }, { label: 'Restart', fn: function () { try { sessionStorage.removeItem('pondos-boot'); } catch (e) {} location.reload(); } }, { label: 'Cancel' }]);
  }

  // ---------- LAN Party: the PEP Games lobby chat in a window ----------
  // Same chat as PEP Games (Supabase gry_lobby_chat / gry_lobby_say). Reading is open to everyone; writing
  // needs a PEP Games sign-in (Discord, or a guest nickname), which lives in this browser's storage.
  var EMO = ' gmfren heart shh wen facts hmm sleepy bigbrain balloons juicebox brb chonky comfy explorer backpack peek ready waiting pep cheer torch hug chair crayon smoke scream serious hurry news loading crowd ';
  function anySession() {
    try { var s = JSON.parse(localStorage.getItem(SB_STORE) || 'null'); if (s && s.access_token && s.expires_at * 1000 > Date.now() + 30000) return s; } catch (e) {}
    return null;
  }
  function visitorId() {
    var v = ''; try { v = localStorage.getItem('pepgry-visitor') || ''; if (!v && window.crypto && crypto.randomUUID) { v = crypto.randomUUID(); localStorage.setItem('pepgry-visitor', v); } } catch (e) {}
    return v;
  }
  function chatRpc(name, args) {
    var s = anySession(), h = { apikey: SB_KEY, 'Content-Type': 'application/json' };
    if (s) h.Authorization = 'Bearer ' + s.access_token;
    return fetch(SB_URL + '/rest/v1/rpc/' + name, { method: 'POST', headers: h, body: JSON.stringify(args) }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error((j && j.message) || 'The chat cannot be reached right now'); return j; });
    });
  }
  // The chat doorbell (Supabase Realtime, private channel "lobby-chat"): the database rings it when a message is
  // written or hidden, so an open LAN Party asks once instead of every 4 seconds. Listening only, as an anonymous
  // visitor; the Supabase script is loaded the first time the chat opens. If anything fails, the chat keeps polling.
  var bellSb = null;
  function lobbyBell(onRing, onState) {
    var ch = null, gone = false;
    var load = window.supabase ? Promise.resolve() : new Promise(function (res, rej) {
      var sc = document.createElement('script'); sc.src = BASE + 'games/vendor/supabase-2.117.3.js'; sc.onload = res; sc.onerror = rej; document.head.appendChild(sc);
    });
    load.then(function () {
      if (gone) return;
      if (!bellSb) bellSb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'pondos-bell' } });
      ch = bellSb.channel('lobby-chat', { config: { private: true } });
      ch.on('broadcast', { event: '*' }, function (m) { onRing(m.event, m.payload); });
      ch.subscribe(function (st) { onState(st === 'SUBSCRIBED'); });
    }).catch(function () { onState(false); });
    return function () { gone = true; onState(false); if (ch && bellSb) bellSb.removeChannel(ch); ch = null; };
  }
  // the Pepe emotes from Pepecoin.com's "Pepe Emojis for Reddit" set (scripts/build_chat_emotes.py), self-hosted as webp.
  // The old frog-crew codes above still draw (old messages, PEP Games); the picker offers the Pepes.
  var PEPE_EMO = null, pepeEmoP = null, EMO_DIR = BASE + 'meme/emotes/', EMO_V = '?v=20261109pe';
  var EMO_FAM = [['pepe', 'Pepe'], ['apu', 'Apu'], ['peepo', 'Peepo'], ['pepega', 'Pepega']];
  function loadPepeEmotes() {
    if (!pepeEmoP) pepeEmoP = fetch(EMO_DIR + 'emotes.json' + EMO_V).then(function (r) { if (!r.ok) throw new Error('emotes'); return r.json(); })
      .then(function (j) { var by = {}; (j.emotes || []).forEach(function (e) { by[e.c] = e; }); PEPE_EMO = { list: j.emotes || [], by: by }; return PEPE_EMO; })
      .catch(function () { pepeEmoP = null; return null; });
    return pepeEmoP;
  }
  function emoKnown(c) { return !!(PEPE_EMO && PEPE_EMO.by[c]) || EMO.indexOf(' ' + c + ' ') >= 0; }
  function chatBody(t) {
    return esc(t).replace(/:([a-z0-9_]{2,32}):/g, function (m, c) {
      if (PEPE_EMO && PEPE_EMO.by[c]) return '<img class="emo-img" src="' + EMO_DIR + c + '.webp' + EMO_V + '" alt=":' + c + ':" title=":' + c + ':" width="28" height="28">';
      return EMO.indexOf(' ' + c + ' ') >= 0 ? '<img class="emo-img" src="' + BASE + 'games/img/emotes/' + c + '.webp" alt=":' + c + ':" width="24" height="24">' : m;
    });
  }
  // a message of one to three emotes and nothing else is drawn big, like in the old messengers
  function emoOnly(t) {
    var codes = String(t).match(/:([a-z0-9_]{2,32}):/g);
    return !!codes && codes.length <= 3 && !String(t).replace(/:([a-z0-9_]{2,32}):/g, '').trim() && codes.every(function (x) { return emoKnown(x.slice(1, -1)); });
  }
  // @mentions (games/js/mentions.js, loaded when needed): verified (Discord) players only, the server decides
  var mentionsJs = null;
  function loadMentions() {
    if (window.PepMentions) return Promise.resolve(window.PepMentions);
    if (!mentionsJs) mentionsJs = new Promise(function (res, rej) {
      var sc = document.createElement('script'); sc.src = BASE + 'games/js/mentions.js?v=20261103m'; sc.onload = function () { res(window.PepMentions); }; sc.onerror = rej; document.head.appendChild(sc);
    });
    return mentionsJs;
  }
  function verifiedHere() { var me = whoAmI(); return !!(me && me.discord); }
  // the name in front of a message. Fren Passport beta: a verified (Discord) name opens that fren's passport;
  // guests have no passport, so their names stay plain text. Without the beta every name is plain text.
  function lanWho(m) {
    var b = '<b>' + esc(m.nick) + '</b>';
    return FREN && m.verified && FREN_ID.test(m.user_id || '') ? '<button type="button" class="lan-who" title="Open the Fren Passport of ' + esc(m.nick) + '">' + b + '</button>' : b;
  }
  var onlineN = null;
  function paintOnline(n) {
    onlineN = n;
    document.querySelectorAll('.lan-n').forEach(function (e) { e.textContent = n; });
    document.querySelectorAll('.lan-badge').forEach(function (e) { e.hidden = n == null; });
  }
  function lanParty() {
    var A = openApp('lan', 'LAN Party - #pond chat', 'gif-080-still', function (A) {
      A.body.innerHTML = '<div class="app-row"><span class="grow"><span class="lan-dot" aria-hidden="true"></span> <b class="lan-n">' + (onlineN == null ? '…' : onlineN) + '</b> online in the pond</span></div>' +
        '<div class="lan-log" role="log" aria-live="polite"><p class="bin-tip">Connecting to the pond…</p></div>' +
        '<div class="emo-pop" hidden role="group" aria-label="Pepe emotes"><div class="emo-head"><input type="search" class="emo-q" placeholder="Search Pepes… (laugh, pray, apu)" aria-label="Search emotes" autocomplete="off">' +
        '<div class="emo-tabs" role="tablist"><button type="button" data-t="recent" title="Recently used">⏱</button>' + EMO_FAM.map(function (f) { return '<button type="button" data-t="' + f[0] + '">' + f[1] + '</button>'; }).join('') + '<button type="button" data-t="gif">GIFs</button></div></div>' +
        '<div class="emo-grid" role="group" aria-label="Emotes"></div></div>' +
        '<form class="app-row lan-form"><button type="button" class="app-btn emo-btn" aria-expanded="false" aria-label="Emotes" title="Emotes"><img src="' + EMO_DIR + 'peepo_happy.webp' + EMO_V + '" alt="" width="22" height="22"></button><input name="n" class="lan-nick" maxlength="20" autocomplete="nickname" placeholder="Nickname" aria-label="Nickname" hidden><input name="t" maxlength="300" autocomplete="off" placeholder="Say gm…" aria-label="Message"><button type="submit" class="app-btn">Send</button></form>' +
        '<p class="hs-note lan-note"></p><p class="hs-note lan-ment" hidden><button type="button" class="app-btn lan-ment-btn"></button> <span></span></p>';
      var log = A.body.querySelector('.lan-log'), form = A.body.querySelector('.lan-form'), inp = form.querySelector('input[name=t]'), note = A.body.querySelector('.lan-note');
      if (FREN) log.addEventListener('click', function (e) {
        var b = e.target.closest('.lan-who'), row = b && b.closest('.lan-msg');
        if (row && row._m) frenPassport(false, { id: row._m.user_id, nick: row._m.nick });
      });
      var last = 0, seen = {}, timer = 0, alive = true, first = true, live = false, ringT = 0, want = 0, force = false, canMod = false;
      var pop = A.body.querySelector('.emo-pop'), eb = A.body.querySelector('.emo-btn');
      // the picker: tabs by family (static), GIFs, recently used (this browser), and a search over the names
      var grid = pop.querySelector('.emo-grid'), q = pop.querySelector('.emo-q'), tab = '';
      var recent = function () { try { return JSON.parse(localStorage.getItem('pondos-emo-recent') || '[]').filter(function (c) { return PEPE_EMO && PEPE_EMO.by[c]; }); } catch (e) { return []; } };
      var paintEmo = function () {
        if (!PEPE_EMO) { grid.innerHTML = '<p class="bin-tip">Loading Pepes…</p>'; return; }
        var s = q.value.trim().toLowerCase(), list;
        if (s) list = PEPE_EMO.list.filter(function (e) { return e.n.toLowerCase().indexOf(s) >= 0 || e.c.indexOf(s.replace(/\s+/g, '_')) >= 0; });
        else if (tab === 'recent') list = recent().map(function (c) { return PEPE_EMO.by[c]; });
        else if (tab === 'gif') list = PEPE_EMO.list.filter(function (e) { return e.a; });
        else list = PEPE_EMO.list.filter(function (e) { return !e.a && e.f === tab; });
        pop.querySelectorAll('.emo-tabs [data-t]').forEach(function (b) { b.setAttribute('aria-pressed', String(!s && b.getAttribute('data-t') === tab)); });
        grid.innerHTML = list.length ? list.map(function (e) { return '<button type="button" data-e="' + e.c + '" title=":' + e.c + ':"><img src="' + EMO_DIR + e.c + '.webp' + EMO_V + '" alt=":' + e.c + ':" width="40" height="40" loading="lazy"></button>'; }).join('')
          : '<p class="bin-tip">' + (s ? 'No Pepe called “' + esc(s) + '”.' : 'Nothing here yet. Pick a Pepe from the other tabs.') + '</p>';
        grid.scrollTop = 0;
      };
      pop.querySelector('.emo-tabs').addEventListener('click', function (e) { var b = e.target.closest('[data-t]'); if (!b) return; tab = b.getAttribute('data-t'); q.value = ''; paintEmo(); });
      q.addEventListener('input', paintEmo);
      q.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); var f = grid.querySelector('[data-e]'); if (f) f.click(); } });
      eb.addEventListener('click', function () {
        pop.hidden = !pop.hidden; eb.setAttribute('aria-expanded', String(!pop.hidden));
        if (!pop.hidden) loadPepeEmotes().then(function () { if (!tab) tab = recent().length ? 'recent' : 'pepe'; paintEmo(); });
      });
      pop.addEventListener('click', function (e) {
        var b = e.target.closest('[data-e]'); if (!b || inp.disabled) return;
        try { var rc = JSON.parse(localStorage.getItem('pondos-emo-recent') || '[]').filter(function (c) { return c !== b.getAttribute('data-e'); }); rc.unshift(b.getAttribute('data-e')); localStorage.setItem('pondos-emo-recent', JSON.stringify(rc.slice(0, 24))); } catch (err) {}
        var v = inp.value, at = inp.selectionStart == null ? v.length : inp.selectionStart, code = ':' + b.getAttribute('data-e') + ':';
        var pre = v.slice(0, at), post = v.slice(at);
        inp.value = (pre && !/\s$/.test(pre) ? pre + ' ' : pre) + code + ' ' + post.replace(/^\s+/, '');
        pop.hidden = true; eb.setAttribute('aria-expanded', 'false'); inp.focus();
      });
      var nickIn = form.querySelector('.lan-nick');
      try { nickIn.value = localStorage.getItem('pepgry-nick') || ''; } catch (e) {}
      // @mentions: highlight messages for me, suggest names after "@", ring on new ones, a switch to turn them off
      var PM = null, me = { verified: false }, mrow = A.body.querySelector('.lan-ment'), mbtn = mrow.querySelector('button');
      var forMe = function (m) { var s = anySession(); return !!(PM && me.verified && !me.optout && !(s && s.user && s.user.id === m.user_id) && PM.mentionsMe(m.body, me.nick)); };
      var seenMentions = function () { if (alive && !document.hidden) chatRpc('gry_mentions_seen', { p_upto: null }).catch(function () {}); };
      var paintMent = function () {
        mrow.hidden = !me.verified;
        mbtn.textContent = me.optout ? '🔕 Mentions off' : '🔔 Mentions on';
        mrow.querySelector('span').textContent = me.optout ? 'Nobody can @mention you.' : 'Type @ to mention a verified fren. You get a ping when someone mentions you.';
        Object.keys(seen).forEach(function (id) { if (seen[id]._m) seen[id].classList.toggle('lan-me', forMe(seen[id]._m)); });
      };
      mbtn.addEventListener('click', function () {
        chatRpc('gry_mention_optout', { p_off: !me.optout }).then(function (v) { me.optout = !!v; if (!v && PM) PM.askNotify(); paintMent(); }, function (err) { note.textContent = err.message; });
      });
      if (verifiedHere()) loadMentions().then(function (pm) {
        PM = pm;
        PM.attach(inp, function (q) { return me.verified ? chatRpc('gry_mention_names', { p_q: q }) : []; });
        return chatRpc('gry_my_mentions');
      }).then(function (r) {
        if (!alive || !r) return;
        me = r; paintMent();
        if (r.items && r.items.length) seenMentions();
      }).catch(function () {});
      var paintNote = function () {
        var s = anySession();
        // no sign-in needed to write: without one, a nickname goes with each message (limits are per network)
        // signed in but no nickname saved in this browser (e.g. a Discord sign-in on a new phone): ask for one too;
        // a verified player's reserved name still wins on the server
        var saved = ''; try { saved = localStorage.getItem('pepgry-nick') || ''; } catch (e) {}
        if (s && saved.length < 2) {   // a Discord sign-in: start from the Discord name, without emoji and symbols the chat does not take
          var me = whoAmI(), dn = me && me.discord ? String(me.name || '').replace(/[^A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż _.\-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20).trim() : '';
          if (dn.length >= 2) { saved = dn; nickIn.value = dn; try { localStorage.setItem('pepgry-nick', dn); } catch (e) {} }
        }
        nickIn.hidden = !!s && saved.length >= 2;
        note.innerHTML = s ? 'Signed in on PEP Games. Text and our emotes only, no links. Be nice, frens.' : 'Pick a nickname and say gm, no sign-in needed. <a href="#" class="lan-login">Log on with Discord</a> to keep your name and get the ✓. No links, be nice.';
        var l = note.querySelector('.lan-login'); if (l) l.addEventListener('click', function (e) { e.preventDefault(); logOn(); });
      };
      // Hosts can hide individual messages in the PondOS LAN Party chat.
      // The server supplies can_mod and verifies games.is_host_user again inside gry_lobby_hide.
      // Never infer host privileges from a saved nickname or client-side Discord metadata.
      var syncDeleteButton = function (row) {
        var btn = row.querySelector('.lan-del');
        row.classList.toggle('lan-moderatable', canMod);
        if (!canMod && btn) btn.remove();
        if (canMod && !btn) row.appendChild(el('button', {
          type: 'button', class: 'lan-del', title: 'Delete message (host)',
          'aria-label': 'Delete message (host)'
        }, '&#215;'));
      };
      log.addEventListener('click', function (e) {
        var btn = e.target.closest('.lan-del');
        if (!btn || !canMod || btn.disabled) return;
        var row = btn.closest('.lan-msg'), m = row && row._m;
        if (!m || !window.confirm('Delete the message from ' + m.nick + '?')) return;
        btn.disabled = true;
        freshSession().then(function (s) {
          if (!s) throw new Error('Log in with your host Discord account to delete messages.');
          return chatRpc('gry_lobby_hide', { p_id: m.id });
        }).then(function () {
          if (!alive) return;
          row.remove(); delete seen[m.id];
          poll(); // refresh the list; Realtime notifies everyone else about the hidden message
        }).catch(function (err) {
          if (!alive) return;
          btn.disabled = false;
          note.textContent = err.message || 'Could not delete the message.';
        });
      });
      var poll = function () {
        clearTimeout(timer);
        chatRpc('gry_lobby_chat', { p_after: last, p_visitor: visitorId() }).then(function (r) {
          if (!alive) return;
          paintOnline(r.online);
          if (canMod !== !!r.can_mod) {
            canMod = !!r.can_mod;
            Object.keys(seen).forEach(function (id) { syncDeleteButton(seen[id]); });
          }
          var initial = first;
          if (first) { log.innerHTML = ''; first = false; }
          (r.hidden || []).forEach(function (id) { if (seen[id]) { seen[id].remove(); delete seen[id]; } });
          var atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
          (r.messages || []).forEach(function (m) {
            if (seen[m.id]) return;
            var row = el('div', { class: 'lan-msg' + (emoOnly(m.body) ? ' lan-big' : '') }, '<span class="lan-t">' + new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '</span> ' + lanWho(m) + (m.verified ? ' <span class="hs-ok" title="Verified with Discord">✓</span>' : '') + ': ' + chatBody(m.body));
            var tipEl = log.querySelector('.bin-tip'); if (tipEl) tipEl.remove();
            row._m = m; if (forMe(m)) { row.classList.add('lan-me'); if (!initial) { PM.ring(m.nick, m.body, function () { A.restore ? A.restore() : null; }); seenMentions(); } }
            syncDeleteButton(row);
            seen[m.id] = row; log.appendChild(row); last = Math.max(last, m.id);
          });
          if (!log.children.length) log.innerHTML = '<p class="bin-tip">No messages in the last 24 hours. Say gm!</p>';
          if (atBottom || r.messages && r.messages.length) log.scrollTop = log.scrollHeight;
        }, function (err) { if (first) log.innerHTML = '<p class="bin-tip">' + esc(err.message) + '. Trying again…</p>'; })
          .then(function () { if (alive) timer = setTimeout(poll, live ? 60000 : document.hidden ? 25000 : 4000); });
      };
      // a burst of rings makes one call, spread over a second so not every open chat asks at the same moment
      var ring = function (id) {
        if (id) want = Math.max(want, id); else force = true;
        if (!ringT) ringT = setTimeout(function () { ringT = 0; if (alive && (force || want > last)) { force = false; poll(); } }, 300 + Math.random() * 700);
      };
      var stopBell = lobbyBell(function (ev, p) { ring(ev === 'new' ? Number(p && p.id) || 0 : 0); },
        function (ok) { var was = live; live = ok; if (ok && !was) ring(); else if (!ok && was && alive) poll(); });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var t = inp.value.trim(); if (!t) return;
        var nick = ''; try { nick = localStorage.getItem('pepgry-nick') || ''; } catch (err) {}
        if (!nickIn.hidden) {
          nick = nickIn.value.trim();
          if (nick.length < 2) { note.textContent = 'Pick a nickname first (2 to 20 letters or digits).'; nickIn.focus(); return; }
          try { localStorage.setItem('pepgry-nick', nick); } catch (err) {}
        }
        var b = form.querySelector('[type=submit]'); b.disabled = true;
        chatRpc('gry_lobby_say', { p_text: t, p_nick: nick }).then(function (r) {
          if (r && r.error) note.textContent = r.error; else { inp.value = ''; paintNote(); }
          if (r && r.error && /nickname/i.test(r.error)) { nickIn.hidden = false; nickIn.focus(); }
          poll();
        }, function (err) { note.textContent = err.message; if (/nickname/i.test(err.message)) { nickIn.hidden = false; nickIn.focus(); } }).then(function () { setTimeout(function () { b.disabled = false; }, 3000); });
      });
      paintNote(); loadPepeEmotes().then(poll);
      A.stop = function () { alive = false; clearTimeout(timer); clearTimeout(ringT); stopBell(); };
    }, 480);
    return A;
  }
  // the green online counter on the desktop icon and in the tray, refreshed every 45 seconds
  if (mainEl) {
    var pingOnline = function () { chatRpc('gry_lobby_chat', { p_after: 2147483647, p_visitor: visitorId() }).then(function (r) { paintOnline(r.online); }, function () {}); };
    setTimeout(pingOnline, 1500);
    // mentions waiting for me (verified players): a balloon that opens the LAN Party
    setTimeout(function () {
      if (!verifiedHere() || apps.lan) return;
      chatRpc('gry_my_mentions').then(function (r) {
        var it = (r && r.items) || []; if (!it.length || apps.lan) return;
        var lastM = it[it.length - 1];
        var b = balloon(it.length === 1 ? esc(lastM.from) + ' mentioned you' : 'You were mentioned ' + it.length + '\u00d7',
          esc(String(lastM.body).slice(0, 90)) + '<br><u>Open the LAN Party chat</u>', 'gif-080-still');
        b.style.cursor = 'pointer';
        b.addEventListener('click', function (e) { if (!e.target.closest('button')) { lanParty(); b.remove(); } });
      }, function () {});
    }, 6000);
    setInterval(function () { if (!document.hidden && !apps.lan) pingOnline(); }, 45000);
    var trayEl2 = document.querySelector('.tray');
    if (trayEl2) {
      var tl = el('button', { type: 'button', class: 'tray-lan lan-badge', hidden: '', title: 'LAN Party chat' }, '<span class="lan-dot" aria-hidden="true"></span><span class="lan-n"></span><span class="sr"> online, open the chat</span>');
      tl.addEventListener('click', lanParty);
      trayEl2.insertBefore(tl, trayEl2.firstChild);
      var mb = el('button', { type: 'button', class: 'tray-mail', title: 'Frog Mail', 'aria-label': 'Frog Mail' },
        '<svg viewBox="0 0 24 20" width="22" height="18" aria-hidden="true"><path class="mb-post" d="M11 13h2v7h-2z"/><path class="mb-box" d="M3 6a5 5 0 0 1 10 0v7H3zM8 1h8a5 5 0 0 1 5 5v7H13V6a5 5 0 0 0-5-5z"/><path class="mb-flag" d="M18 3h1v7h-1zM19 3h4l-1.5 1.5L23 6h-4z"/></svg><span class="mail-new mail-badge" hidden>1</span>');
      mb.addEventListener('click', frogMail);
      trayEl2.insertBefore(mb, trayEl2.firstChild);
      paintMail();
      if (!mailRead()) setTimeout(function () { if (!mailRead()) balloon('You\u2019ve got frog mail!', 'The Pond Gazette #5 is in your mailbox, with the first Pond Poll. Click the mailbox in the corner.', 'frog-mail'); }, 17000);
    }
  }

  // ---------- balloon notices ----------
  function balloon(title, text, icon) {
    var t = el('div', { class: 'balloon', role: 'status' }, '<img src="' + ico(icon) + '" alt="" width="40" height="40"><div><b>' + title + '</b><span>' + text + '</span></div><button type="button" aria-label="Dismiss">' + ICO.x + '</button>');
    document.body.appendChild(t);
    var bye = function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 300); };
    t.querySelector('button').addEventListener('click', bye);
    setTimeout(bye, 12000);
    return t;
  }
  // A new stamp, secret or avatar: a Windows 98 dialog that rises from the tray with the stamp being "thumped" in.
  // It stays until it is closed (a balloon fades out and is easy to miss). Several rewards at once queue up.
  var rewardQueue = [], rewardOpen = false;
  function rewardNotice(r) {
    rewardQueue.push(r);
    if (!rewardOpen) nextReward();
  }
  function nextReward() {
    var r = rewardQueue.shift();
    if (!r) { rewardOpen = false; return; }
    rewardOpen = true;
    passportCss();
    var w = el('div', { class: 'reward98', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'reward98-t' });
    w.innerHTML = '<div class="reward98-bar"><img src="' + ico('pep-logo') + '" alt="" width="16" height="16"><b id="reward98-t"></b>' +
      '<button type="button" class="reward98-x" aria-label="Close">' + ICO.x + '</button></div>' +
      '<div class="reward98-body"><div class="reward98-art"></div><div class="reward98-txt"><b></b><span></span></div></div>' +
      '<div class="reward98-row"><button type="button" class="app-btn reward98-go"></button><button type="button" class="app-btn reward98-ok">OK</button></div>';
    w.querySelector('#reward98-t').textContent = r.bar;
    w.querySelector('.reward98-txt b').textContent = r.title;
    w.querySelector('.reward98-txt span').textContent = r.text;
    var art = w.querySelector('.reward98-art');
    if (r.stamp) art.appendChild(ppStamp(r.stamp, true));
    else { var im = el('img', { src: r.img || ico('gif-045-still'), alt: '', width: '64', height: '64' }); art.appendChild(im); }
    var go = w.querySelector('.reward98-go'); go.textContent = r.go || 'Open Fren Passport';
    document.body.appendChild(w);
    var bye = function () { w.classList.add('out'); setTimeout(function () { w.remove(); nextReward(); }, REDUCE ? 0 : 250); };
    w.querySelector('.reward98-x').addEventListener('click', bye);
    w.querySelector('.reward98-ok').addEventListener('click', bye);
    go.addEventListener('click', function () { bye(); (r.open || frenPassport)(); });
    setTimeout(function () { try { w.querySelector('.reward98-ok').focus({ preventScroll: true }); } catch (e) {} }, 50);
  }
  window.PONDOS_REWARD = rewardNotice;   // lets the browser console test it: PONDOS_REWARD({ bar: '…', title: '…', text: '…' })

  var noticed = '1';
  try { noticed = sessionStorage.getItem('pondos-notice'); sessionStorage.setItem('pondos-notice', '1'); } catch (e) {}
  if (!noticed && mainEl) setTimeout(function () { balloon('PondOS Security Center', 'Nobody legit will ask for your seed phrase. Not support, not admins, not frogs.', 'gif-085-still'); }, 4500);

  // ---------- boot screen, once per visit ----------
  var booted = '1';
  try { booted = sessionStorage.getItem('pondos-boot'); sessionStorage.setItem('pondos-boot', '1'); } catch (e) {}
  // search engine crawlers get the page straight away, without the boot screen in front of it
  var BOT = /bot|crawl|spider|slurp|lighthouse|inspectiontool/i.test(navigator.userAgent || '');
  if (!booted && !REDUCE && !BOT && mainEl) {
    var boot = el('div', { class: 'boot', 'aria-hidden': 'true' });
    boot.innerHTML = '<div class="boot-in"><img class="boot-coin" src="img/pep-loading.webp" alt="" width="180" height="180"><p class="boot-name">Pond<b>OS</b> <span>98 Second Frog Edition</span></p>' +
      '<ol class="boot-log"></ol><div class="boot-bar"><i></i></div><p class="boot-skip">click or press any key to skip</p></div>';
    document.body.appendChild(boot);
    root.classList.add('booting');
    var log = boot.querySelector('.boot-log'), timers = [], done = false;
    var finish = function () {
      if (done) return; done = true;
      timers.forEach(clearTimeout);
      boot.classList.add('out'); root.classList.remove('booting');
      setTimeout(function () { boot.remove(); }, 400);
      document.removeEventListener('keydown', finish); boot.removeEventListener('pointerdown', finish);
    };
    document.addEventListener('keydown', finish); boot.addEventListener('pointerdown', finish);
    var lines = [
      ['Mounting C:\\Pond', 'ok'],
      ['Loading memes', 'ok'],
      ['Loading receipts', 'ok, one per number'],
      ['Checking ticker: PEP ≠ PEPE', 'ok'],
      ['Scrypt engine, shared with LTC + DOGE', 'ok'],
      ['Price, hourly snapshot', function () { return window.PepPrices ? window.PepPrices.pepQuote().then(function (q) { return fmt.usd(q.usd); }) : Promise.reject(); }],
      ['Blocks, daily snapshot', function () { return json('network.json').then(function (n) { return '#' + fmt.int(n.rows[n.rows.length - 1][1]); }); }],
      ['Seed phrase requests', 'never. Whoever asks is a scammer'],
      ['Starting desktop', '…']
    ];
    boot.querySelector('.boot-bar i').style.transitionDuration = (lines.length * 0.23 + 0.2) + 's';
    requestAnimationFrame(function () { requestAnimationFrame(function () { boot.classList.add('go'); }); });
    lines.forEach(function (l, i) {
      timers.push(setTimeout(function () {
        var li = el('li', null, '<span class="k">' + l[0] + '</span><span class="dots"></span><span class="v">' + (typeof l[1] === 'string' ? l[1] : '…') + '</span>');
        log.appendChild(li);
        if (typeof l[1] === 'function') {
          var v = li.querySelector('.v');
          Promise.race([l[1](), new Promise(function (r, j) { setTimeout(j, 700); })]).then(function (t) { v.textContent = t; }, function () { v.textContent = 'later'; });
        }
      }, 120 + i * 230));
    });
    timers.push(setTimeout(finish, 120 + lines.length * 230 + 650));
  }

  // links to PEP Games in the page text open the Games folder (a phone gets the 98-style games page)
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href="../games/"]');
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
    e.preventDefault();
    if (window.innerWidth < 760) location.href = osPage(''); else gamesFolder();
  });
  window.Meme = { json: json, fmt: fmt, fill: fill, lineChart: lineChart, base: BASE, data: DATA, page: PAGE };
})();
