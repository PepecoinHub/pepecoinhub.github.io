/* Pepecoin Hub, meme edition: shared header, ticker, footer, theme and small helpers.
   Every number comes from the same data files as the serious site (../data/*.json),
   so the two editions never disagree. Pages call Meme.json() and Meme.fmt for their own parts. */
(function () {
  'use strict';
  var root = document.documentElement;
  var BASE = root.getAttribute('data-base') || '../';          // the serious site
  var DATA = root.getAttribute('data-data') || BASE + 'data/'; // its data files
  var PAGE = document.body.getAttribute('data-page') || 'index';


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
      ['@games/', 'PEP Games', 'Charades, Pepe Miner, chat', 'pond-playground'],
      ['@links.html', 'Links', 'Official and community sites', 'fren-chain'],
      ['@press.html', 'For media', 'Facts, sources, logo', 'newspaper-still'],
      ['@', 'Serious edition', 'Same facts, no memes', 'serious']
    ]]
  ];
  // PondOS "app" name and icon for each meme page
  var APP = {
    index: ['PEP.exe', 'pep-logo'], 'which-pepecoin': ['WhichFrog.exe', 'glasses'], compare: ['PepVsDoge.exe', 'pepe-doge'],
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
  function ico(n) { return 'img/ico/' + n + '.webp'; }
  function icoFrom(src) { var m = /^img\/([\w-]+)\.webp$/.exec(src || ''); return m ? ico(m[1]) : src; }
  function json(name) {
    if (!cache[name]) cache[name] = fetch(DATA + name, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(name + ' ' + r.status); return r.json(); });
    return cache[name];
  }
  var nf = function (o) { return new Intl.NumberFormat('en-US', o); };
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
    function refreshTicker() { return Promise.all([json('ticker.json'), json('network.json').catch(function () { return null; }), window.PepPrices.quote().catch(function () { return null; })]).then(function (r) {
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
    window.PepPrices.subscribe(refreshTicker);
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
      };
      b.addEventListener('click', function (e) { e.stopPropagation(); open(sub.hidden); });
      g.addEventListener('mouseenter', function () { if (matchMedia('(hover: hover) and (min-width: 761px)').matches) open(true); });
      g.appendChild(b); g.appendChild(sub);
      return g;
    };
    smMain.appendChild(el('a', { class: 'sm-item', href: './' }, '<img src="img/pep-logo.webp" alt="" width="28" height="28"><span><b>My Pond</b></span>'));
    var meItem = el('button', { type: 'button', class: 'sm-item sm-me' }, '<img src="img/gif-085-still.webp" alt="" width="28" height="28"><span><b class="logon-name">Log on…</b> <span class="hs-ok logon-ok" hidden title="Verified with Discord">✓</span></span>');
    meItem.addEventListener('click', function () { setOpen(false); logOn(); });
    smMain.appendChild(meItem);
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
    [['PEP Pong', 'PEP vs PEPE, first to 7', 'pep-logo', function () { pong(); }], ['FUD Invaders', 'Shoot receipts at the FUD', 'gif-008-still', function () { invaders(); }],
      ['PEP Snake', 'Eat blocks, not your tail', 'gif-027-still', function () { snake(); }],
      ['High Scores', 'FUD Invaders and PEP Snake, top 10', 'gif-061-still', function () { highScores(); }],
      ['Draw & Guess', 'Charades with other frens', 'gif-061-still', function () { drawGuess(); }],
      ['All games…', 'Chess, Checkers, Connect Four, Sea Battle, Pepe Miner', 'pond-playground', function () { gamesFolder(); }],
      ['Recycle Bin', 'Paper hands and a strange note', 'recycle-bin', function () { paperHands(); }]].forEach(function (g) {
      var b = el('a', { href: '#', role: 'button' }, '<img src="' + ico(g[2]) + '" alt="" width="24" height="24" loading="lazy"><span><b>' + g[0] + '</b><small>' + g[1] + '</small></span>');
      b.addEventListener('click', function (e) { e.preventDefault(); setOpen(false); g[3](); });
      gl.appendChild(b);
    });
    var onl = el('a', { href: osPage('') }, '<img src="img/pond-playground.webp" alt="" width="24" height="24" loading="lazy"><span><b>PEP Games online</b><small>Charades, Pepe Miner, lobby chat</small></span>');
    onl.addEventListener('click', function (e) { if (window.innerWidth >= 760) { e.preventDefault(); setOpen(false); pepGamesOnline(); } });
    gl.appendChild(onl);
    smMain.appendChild(subGroup('Games', 'gif-061-still', gl));
    smMain.appendChild(el('hr'));
    var winsUl = el('ul', { class: 'sm-wins' });
    smMain.appendChild(subGroup('Windows on this page', 'gif-045-still', winsUl, 'sm-windows'));
    var arrange = el('button', { type: 'button', class: 'sm-item' }, '<span class="sm-ico" aria-hidden="true">▦</span><span>Arrange windows</span>');
    var sd = el('button', { type: 'button', class: 'sm-item' }, '<span class="sm-ico" aria-hidden="true">⏻</span><span>Shut down…</span>');
    arrange.addEventListener('click', function () { setOpen(false); arrangeAll(); });
    sd.addEventListener('click', function () { setOpen(false); shutDown(); });
    smMain.appendChild(el('a', { class: 'sm-item', href: serious }, '<img src="img/serious.webp" alt="" width="28" height="28"><span>Serious mode</span>'));
    var tipItem = el('button', { type: 'button', class: 'sm-item' }, '<img src="img/gif-045-still.webp" alt="" width="28" height="28"><span>Tip jar</span>');
    tipItem.addEventListener('click', function () { setOpen(false); tipJar(); });
    smMain.appendChild(tipItem);
    var lanItem = el('button', { type: 'button', class: 'sm-item' }, '<img src="img/gif-080-still.webp" alt="" width="28" height="28"><span>LAN Party chat</span>');
    lanItem.addEventListener('click', function () { setOpen(false); lanParty(); });
    smMain.appendChild(lanItem);
    [['Frog Mail', 'frog-mail', function () { frogMail(); }], ['ScamCheck.exe', 'stop', function () { scamCheck(); }], ['AddressCheck.exe', 'pepe-search', function () { addressCheck(); }]].forEach(function (x) {
      var it = el('button', { type: 'button', class: 'sm-item' }, '<img src="' + ico(x[1]) + '" alt="" width="28" height="28"><span>' + x[0] + '</span>');
      it.addEventListener('click', function () { setOpen(false); x[2](); });
      smMain.appendChild(it);
    });
    var themeItem = el('button', { type: 'button', class: 'sm-item' }, '<span class="sm-ico" aria-hidden="true">🌓</span><span>Day / night mode</span>');
    themeItem.addEventListener('click', function () { setOpen(false); if (themeBtn) themeBtn.click(); });
    smMain.appendChild(themeItem);
    smMain.appendChild(arrange);
    smMain.appendChild(el('hr'));
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
    if (body.classList.contains('hero')) return 'PEP.exe - Pepecoin (PEP), meme edition';
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
    var iconSrc = opts.icon ? ico(opts.icon) : body.classList.contains('hero') ? 'img/pep-logo.webp' : pic ? icoFrom(pic.getAttribute('src')) : ico((APP[PAGE] || ['', 'pep-logo'])[1]);
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
    // the meme home starts like a fresh desktop: only the welcome window is open, the rest wait on the
    // taskbar and in a "Open more" row inside the welcome window, to be explored one by one
    if (PAGE === 'index') {
      var hero = null;
      wins.forEach(function (w) { if (w.body.classList.contains('hero')) hero = w; });
      if (hero) {
        var row = el('div', { class: 'win-launch' }, '<p>Explore the pond, open a window:</p>');
        wins.forEach(function (w) {
          if (w === hero || w.body.classList.contains('chooser')) return;
          w.state = 'min'; w.host.classList.add('is-min'); sync(w);
          var b = el('button', { type: 'button', class: 'btn' }, '<img src="' + w.task.querySelector('img').getAttribute('src') + '" alt="" width="16" height="16"> ' + esc(w.title.split(' - ')[0]));
          b.addEventListener('click', function () { setState(w, 'open'); });
          row.appendChild(b);
        });
        var ctas = hero.body.querySelector('.ctas');
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

  // ---------- desktop icons ----------
  // with a mouse: click selects, double-click opens, drag moves (remembered); on touch a tap opens
  if (mainEl) {
    var DESKTOP = [
      ['./', 'My Pond', 'pep-logo'], ['price.html', 'Price.exe', 'charts'], ['rich-list.html', 'Whale watch', 'detective'],
      ['calculator.html', 'What-if machine', 'p-eyes-still'], ['wallets.html', 'Wallets', 'zipper'], ['mining.html', 'Mining', 'pickaxe'],
      ['#games', 'Games', 'games-folder'], ['#tv', 'Pond TV', 'pond-tv'], ['#scam', 'ScamCheck.exe', 'stop'], ['#addr', 'AddressCheck.exe', 'pepe-search'], ['#logon', 'Log On', 'gif-085-still'], ['#shop', 'Shop', 'shop-bag'], ['#ads', 'PEP-TV Ads', 'pep-tv-ads'], ['#lan', 'LAN Party', 'gif-080-still'], ['#notpep', 'Not PEP (0x)', 'wrongpep'], [serious, 'Serious mode', 'serious'], ['#tip', 'Tip jar.exe', 'gif-045-still'], ['#bin', 'Recycle Bin', 'recycle-bin']
    ];
    var ACT = { '#scam': scamCheck, '#addr': addressCheck, '#ads': adsFolder, '#shop': function () { window.open(SHOP, '_blank', 'noopener'); }, '#logon': logOn, '#tv': pondTV, '#lan': lanParty, '#games': gamesFolder, '#tip': tipJar, '#pong': pong, '#fud': invaders, '#snake': snake, '#bin': paperHands, '#notpep': function () {
      osDialog('Not PEP (0x) - Properties', '<div class="dlg-row"><img src="img/gif-029.webp" alt="" width="96" height="96"><div><h3>Same name, different frogs.</h3><p>These assets share the name. None of them is PEP:</p><ul class="dlg-list"><li><b>PEPE</b>: an ERC-20 token on Ethereum since April 2023. Address starts with 0x.</li><li><b>PEPECOIN</b> (PepeCoin / Memetic): from March 2016, a token on Ethereum since 2023. Address starts with 0x.</li></ul><p><b>PEP</b> has its own blockchain, and its addresses start with P.</p></div></div>',
        [{ label: 'Full side-by-side…', go: true, href: 'which-pepecoin.html' }, { label: 'OK' }], 'wrongpep');
    } };
    var desk = el('nav', { class: 'desk', 'aria-label': 'Desktop' });
    desk.innerHTML = '<ul class="icons">' + DESKTOP.map(function (d) { return '<li><a href="' + d[0] + '" data-id="' + esc(d[1]) + '"><img src="' + ico(d[2]) + '" alt="" width="40" height="40"><span>' + d[1] + '</span></a></li>'; }).join('') + '</ul>';
    document.body.insertBefore(desk, mainEl);
    setTimeout(pager, 0);
    var lanIcon = desk.querySelector('a[href="#lan"]');
    if (lanIcon) lanIcon.insertAdjacentHTML('beforeend', '<span class="lan-badge icon-badge" hidden><span class="lan-dot" aria-hidden="true"></span><span class="lan-n"></span></span>');
    var FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
    var iconPos = {}; try { iconPos = JSON.parse(localStorage.getItem('pondos-icons') || '{}'); } catch (e) {}
    var openIcon = function (a) { var h = a.getAttribute('href'); if (ACT[h]) ACT[h](); else location.href = a.href; };
    desk.querySelectorAll('.icons a').forEach(function (a) {
      var id = a.getAttribute('data-id'), p = iconPos[id];
      if (p && FINE && window.innerWidth > 1100) a.style.transform = 'translate(' + p[0] + 'px,' + p[1] + 'px)';
      var moved = false;
      a.addEventListener('click', function (e) {
        e.preventDefault();
        if (moved) { moved = false; return; }
        if (!FINE) { openIcon(a); return; }
        desk.querySelectorAll('.sel').forEach(function (x) { x.classList.remove('sel'); }); a.classList.add('sel');
      });
      a.addEventListener('dblclick', function (e) { e.preventDefault(); openIcon(a); });
      a.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); openIcon(a); } });
      if (!FINE) return;
      a.addEventListener('pointerdown', function (e) {
        if (e.button !== 0 || window.innerWidth <= 1100) return;
        var sx = e.clientX, sy = e.clientY, base = iconPos[id] || [0, 0], cur = base;
        var mv = function (ev) {
          var dx = ev.clientX - sx, dy = ev.clientY - sy;
          if (!moved && Math.abs(dx) + Math.abs(dy) < 6) return;
          moved = true; a.classList.add('dragging');
          cur = [Math.max(-10, Math.min(base[0] + dx, window.innerWidth - 120)), base[1] + dy];
          a.style.transform = 'translate(' + cur[0] + 'px,' + cur[1] + 'px)';
        };
        var up = function () {
          window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
          a.classList.remove('dragging');
          if (moved) { iconPos[id] = cur; try { localStorage.setItem('pondos-icons', JSON.stringify(iconPos)); } catch (err) {} }
        };
        window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
      });
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('.desk')) desk.querySelectorAll('.sel').forEach(function (x) { x.classList.remove('sel'); }); });
  }

  // ---------- tray: price, hashrate, clock ----------
  var clock = document.querySelector('.tray-clock');
  if (clock) {
    var tick = function () { var d = new Date(); clock.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); clock.setAttribute('datetime', d.toISOString()); };
    tick(); setInterval(tick, 20000);
  }
  var trayPrice = document.querySelector('.tray-price'), trayHash = document.querySelector('.tray-hash');
  if (trayPrice && window.PepPrices) window.PepPrices.subscribe(function () {
    return window.PepPrices.quote().then(function (q) {
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
      ['Screensaver preview', function () { saver(true); }], ['Line up icons', function () { try { localStorage.removeItem('pondos-icons'); } catch (e) {} document.querySelectorAll('.icons a').forEach(function (a) { a.style.transform = ''; }); }],
      null, ['New game: PEP Pong', pong], ['New game: FUD Invaders', invaders], ['New game: PEP Snake', snake], null, ['Properties…', aboutOS]].forEach(function (it) {
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
    saverEl = el('div', { class: 'saver', 'aria-hidden': 'true' }, '<img class="sv-coin" src="img/coin-spin.webp" alt="" width="120" height="120"><p>PondOS is resting. Move the mouse, fren.</p>');
    document.body.appendChild(saverEl);
    var coin = saverEl.querySelector('.sv-coin'), x = 40, y = 40, dx = 2.2, dy = 1.7, raf;
    var step = function () {
      var W = window.innerWidth - 120, H = window.innerHeight - 120;
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
    host.innerHTML = '<div class="win active"><div class="win-bar"><img src="' + ico(icon) + '" alt="" width="16" height="16"><span class="win-t">' + esc(title) + '</span><span class="win-ctl"><button type="button" class="w-min" title="Minimize">' + ICO.min + '<span class="sr">Minimize ' + esc(title) + '</span></button><button type="button" class="w-x" title="Close">' + ICO.x + '<span class="sr">Close ' + esc(title) + '</span></button></span></div><div class="app-body"></div></div>';
    document.body.appendChild(host);
    var A = { id: id, host: host, body: host.querySelector('.app-body'), stop: null };
    var n = Object.keys(apps).length;
    host.style.top = (50 + n * 28) + 'px'; host.style.setProperty('--app-top', (50 + n * 28) + 'px');
    if (window.innerWidth > 760) { host.style.left = Math.max(8, (window.innerWidth - host.offsetWidth) / 2 + n * 28) + 'px'; host.style.transform = 'none'; }
    A.close = function () { if (A.stop) A.stop(); if (A.taskBtn) A.taskBtn.remove(); host.remove(); delete apps[id]; if (activeApp === A) activeApp = null; };
    host.querySelector('.w-x').addEventListener('click', A.close);
    // minimize: the window hides and waits as a button on the taskbar (also on a phone); the game keeps its state
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
    bar.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || e.target.closest('button')) return;
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

  // ---------- PEP Pong: PEP vs PEPE (CPU) ----------
  function pong() {
    openApp('pong', 'PEP Pong - PEP vs PEPE (ERC-20)', 'pep-logo', function (A) {
      A.body.innerHTML = '<canvas width="480" height="300" aria-label="PEP Pong. Move your paddle with the mouse, a finger, or the arrow keys."></canvas>' +
        '<div class="app-row"><span class="grow pg-msg">Click or press Space to serve. First to 7.</span><span class="pg-hi"></span></div>' +
        '<div class="app-row touch-pad"><button type="button" class="app-btn" data-k="up">▲ Up</button><button type="button" class="app-btn" data-k="down">▼ Down</button><button type="button" class="app-btn" data-k="serve">Serve</button></div>';
      var cv = A.body.querySelector('canvas'), c = cv.getContext('2d'), msg = A.body.querySelector('.pg-msg'), hiEl = A.body.querySelector('.pg-hi');
      var W = 480, H = 300, PH = 56, me = { y: H / 2 - PH / 2, s: 0 }, cpu = { y: H / 2 - PH / 2, s: 0 }, ball = null, keys = { up: 0, down: 0 }, over = false, raf;
      var WINS = ['Own chain, own point.', 'Mined, not minted.', 'Merge-mined that one.', 'Receipts say: point PEP.'];
      var LOSE = ['PEPE got lucky. Gas fees not included.', 'Wrong frog scored. Check the ticker.', 'Point PEPE. Still not a blockchain.'];
      var showHi = function () { hiEl.textContent = 'Best win margin: ' + hiScore('pondos-pong'); };
      showHi();
      var serve = function () { if (over) { me.s = cpu.s = 0; over = false; } if (ball) return; var d = Math.random() < 0.5 ? -1 : 1; ball = { x: W / 2, y: H / 2, vx: 3.6 * d, vy: (Math.random() * 2 - 1) * 2.4 }; msg.textContent = 'PEP ' + me.s + ' : ' + cpu.s + ' PEPE'; };
      cv.addEventListener('pointerdown', serve);
      cv.addEventListener('pointermove', function (e) { var r = cv.getBoundingClientRect(); me.y = Math.min(Math.max((e.clientY - r.top) / r.height * H - PH / 2, 0), H - PH); });
      A.body.querySelectorAll('[data-k]').forEach(function (b) {
        var k = b.getAttribute('data-k');
        if (k === 'serve') b.addEventListener('click', serve);
        else { b.addEventListener('pointerdown', function () { keys[k] = 1; }); ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (t) { b.addEventListener(t, function () { keys[k] = 0; }); }); }
      });
      var unkey = gameKeys(A, { ArrowUp: function (d) { keys.up = d; }, ArrowDown: function (d) { keys.down = d; }, w: function (d) { keys.up = d; }, s: function (d) { keys.down = d; }, ' ': function (d) { if (d) serve(); } });
      var point = function (mine) {
        if (mine) me.s++; else cpu.s++;
        ball = null;
        if (me.s >= 7 || cpu.s >= 7) {
          over = true;
          if (me.s > cpu.s) { hiScore('pondos-pong', me.s - cpu.s); showHi(); msg.textContent = 'PEP wins ' + me.s + ':' + cpu.s + '. Merge-mined victory. Space for a rematch.'; }
          else msg.textContent = 'PEPE wins ' + cpu.s + ':' + me.s + '. It is still a token. Space for a rematch.';
        } else msg.textContent = (mine ? WINS : LOSE)[Math.floor(Math.random() * (mine ? WINS : LOSE).length)] + '  PEP ' + me.s + ' : ' + cpu.s + ' PEPE';
      };
      var frame = function () {
        if (keys.up) me.y = Math.max(0, me.y - 5); if (keys.down) me.y = Math.min(H - PH, me.y + 5);
        if (ball) {
          var target = ball.y - PH / 2 + (ball.vx > 0 ? 0 : (H / 2 - ball.y) * 0.5);
          cpu.y += Math.max(-3.3, Math.min(3.3, target - cpu.y)); cpu.y = Math.max(0, Math.min(H - PH, cpu.y));
          ball.x += ball.vx; ball.y += ball.vy;
          if (ball.y < 8 || ball.y > H - 8) { ball.vy = -ball.vy; ball.y = Math.max(8, Math.min(H - 8, ball.y)); }
          if (ball.x < 28 && ball.x > 14 && ball.vx < 0 && ball.y > me.y - 6 && ball.y < me.y + PH + 6) { ball.vx = -ball.vx * 1.06; ball.vy += (ball.y - (me.y + PH / 2)) * 0.09; }
          if (ball.x > W - 28 && ball.x < W - 14 && ball.vx > 0 && ball.y > cpu.y - 6 && ball.y < cpu.y + PH + 6) { ball.vx = -ball.vx * 1.04; ball.vy += (ball.y - (cpu.y + PH / 2)) * 0.07; }
          if (ball.x < -10) point(false); else if (ball && ball.x > W + 10) point(true);
        }
        c.fillStyle = '#071009'; c.fillRect(0, 0, W, H);
        c.strokeStyle = '#1f4a2c'; c.setLineDash([6, 8]); c.beginPath(); c.moveTo(W / 2, 0); c.lineTo(W / 2, H); c.stroke(); c.setLineDash([]);
        c.fillStyle = '#7fd196'; c.font = 'bold 26px Tahoma, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'top';
        c.fillText(me.s, W / 2 - 40, 10); c.fillStyle = '#e9a19a'; c.fillText(cpu.s, W / 2 + 40, 10);
        c.font = '11px Tahoma, sans-serif'; c.fillStyle = '#7fd196'; c.fillText('PEP', 40, H - 18); c.fillStyle = '#e9a19a'; c.fillText('PEPE (CPU)', W - 50, H - 18);
        c.fillStyle = '#4fb36d'; c.fillRect(14, me.y, 9, PH); c.fillStyle = '#d9726a'; c.fillRect(W - 23, cpu.y, 9, PH);
        if (ball) drawCoin(c, ball.x, ball.y, 8);
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
      A.stop = function () { cancelAnimationFrame(raf); unkey(); };
    }, 520);
  }

  // ---------- FUD Invaders: receipts versus FUD ----------
  function invaders() {
    openApp('fud', 'FUD Invaders - receipts vs FUD', 'gif-008-still', function (A) {
      A.body.innerHTML = '<canvas width="480" height="360" aria-label="FUD Invaders. Move with the arrow keys and fire receipts with Space."></canvas>' +
        '<div class="app-row"><span class="grow fd-msg">Arrows or A/D to move, Space to fire receipts. Click to start.</span><span class="fd-hi"></span></div>' +
        '<div class="app-row touch-pad"><button type="button" class="app-btn" data-k="left">◀</button><button type="button" class="app-btn" data-k="right">▶</button><button type="button" class="app-btn" data-k="fire">Fire receipt</button></div>';
      var cv = A.body.querySelector('canvas'), c = cv.getContext('2d'), msg = A.body.querySelector('.fd-msg'), hiEl = A.body.querySelector('.fd-hi');
      var W = 480, H = 360, WORDS = ['FUD', 'SCAM', 'RUG', 'DM ME', 'SEED?', '100x!!', 'FAKE', 'PUMP'];
      var ship = new Image(); ship.src = 'img/pep-logo.webp';
      var st, keys = { left: 0, right: 0 }, raf, running = false;
      var showHi = function () { hiEl.textContent = 'High score: ' + hiScore('pondos-fud'); };
      showHi();
      var wave = function (n) {
        var al = [];
        for (var r = 0; r < 4; r++) for (var k = 0; k < 6; k++) al.push({ x: 40 + k * 66, y: 34 + r * 34, w: 56, h: 22, t: WORDS[(r * 6 + k + n) % WORDS.length], alive: true });
        return { al: al, dir: 1, speed: 0.45 + n * 0.18, shots: [], bombs: [], cool: 0 };
      };
      var t0 = 0;
      var reset = function () { st = { x: W / 2, lives: 3, score: 0, n: 0 }; Object.assign(st, wave(0)); running = true; t0 = Date.now(); var o = A.body.querySelector('.hs-submit'); if (o) o.remove(); msg.textContent = 'Wave 1. Receipts beat FUD.'; };
      var fire = function () { if (!running) { reset(); return; } if (st.cool > 0 || st.shots.length > 2) return; st.shots.push({ x: st.x, y: H - 40 }); st.cool = 16; };
      cv.addEventListener('pointerdown', function (e) { if (!running) { reset(); return; } fire(); });
      cv.addEventListener('pointermove', function (e) { if (!running || e.pointerType === 'mouse' && !e.buttons) { if (running && e.pointerType === 'mouse') { var r0 = cv.getBoundingClientRect(); st.x = Math.min(Math.max((e.clientX - r0.left) / r0.width * W, 20), W - 20); } return; } var r = cv.getBoundingClientRect(); st.x = Math.min(Math.max((e.clientX - r.left) / r.width * W, 20), W - 20); });
      A.body.querySelectorAll('[data-k]').forEach(function (b) {
        var k = b.getAttribute('data-k');
        if (k === 'fire') b.addEventListener('pointerdown', fire);
        else { b.addEventListener('pointerdown', function () { keys[k] = 1; }); ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (t) { b.addEventListener(t, function () { keys[k] = 0; }); }); }
      });
      var unkey = gameKeys(A, { ArrowLeft: function (d) { keys.left = d; }, ArrowRight: function (d) { keys.right = d; }, a: function (d) { keys.left = d; }, d: function (d) { keys.right = d; }, ' ': function (d) { if (d) fire(); } });
      var end = function (text) { running = false; hiScore('pondos-fud', st.score); showHi(); msg.textContent = text + ' Score ' + st.score + '. Click to play again.'; offerSubmit(A, 'fud', st.score, Date.now() - t0); };
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
      A.stop = function () { cancelAnimationFrame(raf); unkey(); };
    }, 520);
  }

  // ---------- PEP Snake: eat blocks, grow, don't fork yourself ----------
  function snake() {
    openApp('snake', 'PEP Snake - eat blocks, not your tail', 'pep-logo', function (A) {
      A.body.innerHTML = '<canvas width="480" height="360" aria-label="PEP Snake. Steer with the arrow keys or by swiping."></canvas>' +
        '<div class="app-row"><span class="grow sn-msg">Arrows, WASD or swipe to steer. Click to start.</span><span class="sn-hi"></span></div>' +
        '<div class="app-row touch-pad"><button type="button" class="app-btn" data-k="left">◀</button><button type="button" class="app-btn" data-k="up">▲</button><button type="button" class="app-btn" data-k="down">▼</button><button type="button" class="app-btn" data-k="right">▶</button></div>';
      var cv = A.body.querySelector('canvas'), c = cv.getContext('2d'), msg = A.body.querySelector('.sn-msg'), hiEl = A.body.querySelector('.sn-hi');
      var CS = 24, CW = 20, CH = 15, face = new Image(); face.src = 'img/pep-logo.webp';
      var s = null, dir, next, food, timer = null, tickMs;
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
        msg.textContent = why + ' Blocks mined: ' + blocks + ' (' + fmt.int(blocks * 10000) + ' PEP, on paper). Click to play again.';
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
      var start = function () { if (timer) return; t0 = Date.now(); var o = A.body.querySelector('.hs-submit'); if (o) o.remove(); s = [[8, 7], [7, 7], [6, 7]]; dir = next = [1, 0]; place(); tickMs = 140; msg.textContent = 'Go, fren. Blocks are coins.'; draw(); timer = setInterval(tick, tickMs); };
      cv.addEventListener('pointerdown', function (e) {
        if (!timer) { start(); return; }
        var sx = e.clientX, sy = e.clientY;
        var up = function (ev) { cv.removeEventListener('pointerup', up); var dx = ev.clientX - sx, dy = ev.clientY - sy; if (Math.abs(dx) + Math.abs(dy) < 18) return; turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); };
        cv.addEventListener('pointerup', up);
      });
      A.body.querySelectorAll('[data-k]').forEach(function (b) { b.addEventListener('pointerdown', function () { if (!timer) start(); turn(b.getAttribute('data-k')); }); });
      var K = function (k) { return function (d) { if (d) { if (!timer) start(); turn(k); } }; };
      var unkey = gameKeys(A, { ArrowLeft: K('left'), ArrowRight: K('right'), ArrowUp: K('up'), ArrowDown: K('down'), a: K('left'), d: K('right'), w: K('up'), s: K('down') });
      face.onload = draw; draw();
      A.stop = function () { clearInterval(timer); unkey(); };
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
  var GAME_NAME = { fud: 'FUD Invaders', snake: 'PEP Snake' };
  // a PEP Games sign-in (Discord) lives in this browser's storage; a valid one makes the score "verified"
  function sbSession() {
    try {
      var s = JSON.parse(localStorage.getItem('sb-azbwciqfbsdpwubznncg-auth-token') || 'null');
      if (s && s.access_token && s.expires_at * 1000 > Date.now() + 30000 && !(s.user && s.user.is_anonymous)) {
        var ids = (s.user && s.user.identities) || [];
        return { token: s.access_token, discord: ids.some(function (i) { return i.provider === 'discord'; }) };
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
      '<button type="submit" class="app-btn">Submit score</button><button type="button" class="app-btn hs-see">High Scores</button>' +
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
        box.innerHTML = '<span class="grow">Saved as <b>' + esc(r.nick) + '</b>' + (r.verified ? ' <span class="hs-ok">✓</span>' : '') + '. Place #' + r.place + ' in ' + GAME_NAME[game] + '.</span><button type="button" class="app-btn hs-see">High Scores</button>';
        box.querySelector('.hs-see').addEventListener('click', function () { highScores(game); });
        if (apps.hs) apps.hs.load(game);
      }, function (err) { btn.disabled = false; btn.textContent = 'Submit score'; box.querySelector('.hs-err') ? box.querySelector('.hs-err').textContent = err.message : box.appendChild(el('span', { class: 'hs-err' }, esc(err.message))); });
    });
  }
  function highScores(game) {
    var A = openApp('hs', 'High Scores', 'gif-061-still', function (A) {
      A.body.innerHTML = '<div class="app-row hs-tabs" role="tablist"><button type="button" class="app-btn" data-g="fud" role="tab">FUD Invaders</button><button type="button" class="app-btn" data-g="snake" role="tab">PEP Snake</button></div>' +
        '<ol class="bin-list hs-list"><li>Loading…</li></ol><p class="bin-tip">Top 10, best score per player. <span class="hs-ok">✓</span> = signed in with Discord on PEP Games. Scores run in your browser, so the server checks them for plausibility and rate.</p>';
      A.load = function (g) {
        A.game = g;
        A.body.querySelectorAll('[data-g]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-g') === g)); });
        var ol = A.body.querySelector('.hs-list'); ol.innerHTML = '<li>Loading…</li>';
        rpc('gry_arcade_top', { p_game: g }).then(function (rows) {
          ol.innerHTML = rows && rows.length ? rows.map(function (r, i) { return '<li><span>' + (i + 1) + '.</span><span>' + esc(r.nick) + (r.verified ? ' <span class="hs-ok" title="Verified with Discord">✓</span>' : '') + '</span><small>' + fmt.int(r.score) + (g === 'snake' ? ' blocks' : '') + '</small></li>'; }).join('')
            : '<li><span></span><span>No scores yet. Be the first frog.</span><small></small></li>';
        }, function (err) { ol.innerHTML = '<li><span></span><span>' + esc(err.message) + '</span><small></small></li>'; });
      };
      A.body.querySelectorAll('[data-g]').forEach(function (b) { b.addEventListener('click', function () { A.load(b.getAttribute('data-g')); }); });
    }, 400);
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
  function boardGame(key, name) {
    var G = BASE + 'games/';
    var bot = function (lv) { return G + 'table.html?bot=' + key + '&level=' + lv + '&embed=1'; };
    if (window.innerWidth < 760) {   // a phone: the same two choices, each opens as a full page
      osDialog(name, '<p>Play the bot right here, or play online with a fren: open a table and send them the invite link, or sit down at an open one (needs a log on, Discord or guest).</p>',
        [{ label: 'Online with frens', go: true, href: osPage('?only=tables&tmode=fren&tgame=' + key + '#tables') },
         { label: 'vs the bot', href: osPage('table.html?bot=' + key + '&level=medium') }, { label: 'Cancel' }], 'pond-playground');
      return;
    }
    tabbedGame('bg-' + key, name, 'pond-playground', [
      ['vs the bot', bot('medium'), function (row, go) {
        row.innerHTML = '<span class="grow">Difficulty</span>' + ['easy', 'medium', 'hard'].map(function (l) { return '<button type="button" class="app-btn" data-l="' + l + '" aria-pressed="' + (l === 'medium') + '">' + l.charAt(0).toUpperCase() + l.slice(1) + '</button>'; }).join('');
        row.querySelectorAll('[data-l]').forEach(function (b) { b.addEventListener('click', function () { row.querySelectorAll('[data-l]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); go(bot(b.getAttribute('data-l'))); }); });
      }],
      ['LAN Party: play with frens', G + '?embed=1&only=tables&tmode=fren&tgame=' + key + '#tables', function (row) {
        row.innerHTML = '<span class="grow">Open a table and send the invite link to a fren, or sit down at an open table. Needs a <a href="#" class="tab-logon">log on</a> (Discord or guest).</span>';
        row.querySelector('.tab-logon').addEventListener('click', function (e) { e.preventDefault(); logOn(); });
      }]
    ], 860);
  }
  // Draw & Guess (charades with other players): the PEP Games lobby opens on its rooms, inside a window
  function drawGuess() {
    var G = BASE + 'games/';
    if (window.innerWidth < 760) { location.href = osPage('#game-dg'); return; }
    tabbedGame('dg', 'Draw & Guess - PEP charades', 'gif-061-still', [
      ['LAN Party: rooms', G + '?embed=1&only=dg#game-dg', function (row) {
        row.innerHTML = '<span class="grow">Start a room and share the link with frens (up to 12 players), join an open room, or type a room code. Needs a <a href="#" class="tab-logon">log on</a> (Discord or guest).</span>';
        row.querySelector('.tab-logon').addEventListener('click', function (e) { e.preventDefault(); logOn(); });
      }],
      ['How to play', G + 'rules.html?embed=1', null]
    ], 980);
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
  function gamesFolder() {
    openApp('games', 'C:\\Pond\\Games', 'games-folder', function (A) {
      var G = [['PEP Pong', 'pep-logo', pong], ['FUD Invaders', 'gif-008-still', invaders], ['PEP Snake', 'gif-027-still', snake],
        ['High Scores', 'gif-061-still', function () { highScores(); }],
        ['Chess', '♟️', function () { boardGame('chess', 'Chess'); }], ['Checkers', '⚫', function () { boardGame('checkers', 'Checkers'); }],
        ['Connect Four', '🔴', function () { boardGame('connect4', 'Connect Four'); }], ['Sea Battle', '🚢', function () { boardGame('battleship', 'Sea Battle'); }],
        ['Draw & Guess', 'gif-061-still', drawGuess], ['Pepe Miner', 'pickaxe', minerApp], ['PEP Games lobby', 'pond-playground', function () { pepGamesOnline(); }]];
      A.body.innerHTML = '<ul class="folder">' + G.map(function (g, i) { var ic = /^[a-z]/.test(g[1]) ? '<img src="' + ico(g[1]) + '" alt="" width="40" height="40">' : '<i class="emo" aria-hidden="true">' + g[1] + '</i>'; return '<li><button type="button" data-i="' + i + '">' + ic + '<span>' + g[0] + '</span></button></li>'; }).join('') + '</ul>' +
        '<p class="bin-tip">Double-click a game. Chess, Checkers, Connect Four and Sea Battle: play the bot, or play online with a fren (send them the invite link). Draw &amp; Guess needs other players: open a room or join one with a code. The PEP Games lobby has it all, plus the chat.</p>';
      A.body.querySelectorAll('.folder button').forEach(function (b) {
        var go = function () { G[+b.getAttribute('data-i')][2](); };
        b.addEventListener('dblclick', go);
        b.addEventListener('click', function () { if (!matchMedia('(hover: hover) and (pointer: fine)').matches) go(); else { A.body.querySelectorAll('.folder .sel').forEach(function (x) { x.classList.remove('sel'); }); b.classList.add('sel'); } });
        b.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } });
      });
    }, 520);
  }
  // the online games site inside a big window; on a phone it simply opens the page
  function pepGamesOnline() {
    if (window.innerWidth < 760) { location.href = osPage(''); return; }
    var A = openApp('online', 'PEP Games online', 'pond-playground', function (A) {
      A.body.innerHTML = '<iframe class="app-frame" src="' + BASE + 'games/" title="PEP Games"></iframe><div class="app-row"><span class="grow">Charades, Pepe Miner and the lobby chat.</span><a class="app-btn" href="' + osPage('') + '" target="_blank" rel="noopener">Open in a new tab</a></div>';
    }, 1100);
    A.host.style.top = '12px'; A.host.style.setProperty('--app-top', '12px');
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
  function logOn() {
    openApp('logon', 'Log On to the Pond', 'gif-085-still', function (A) {
      var paint = function () {
        var me = whoAmI();
        A.body.innerHTML = '<div class="tip"><img src="img/' + (me ? 'gif-045' : 'gif-085') + '.webp" alt="" width="96" height="96"><div>' +
          (me ? '<b>Signed in as ' + esc(me.name) + (me.discord ? ' <span class="hs-ok" title="Verified with Discord">✓</span>' : ' (guest)') + '</b><p>' + (me.discord ? 'Your Discord name shows with a ✓ in LAN Party and on the High Scores.' : 'Guests can chat and submit scores. Log in with Discord to get the ✓ verified badge.') + '</p>'
            : '<b>Who goes there, fren?</b><p>Sign in once and use it everywhere: LAN Party chat, High Scores, Draw &amp; Guess and the other PEP Games.</p>') +
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

  // ---------- Tip jar: the same receiving addresses as the footer ----------
  function tipJar() {
    openApp('tip', 'Tip jar.exe', 'gif-045-still', function (A) {
      var ADDR = [['Pepecoin (PEP)', 'PiwzfZU1t37hCvKboCNN49YT8CPN2nXa3t'], ['Litecoin (LTC)', 'ltc1qs05pfynke7ekd66cywkh235rvnykdqrnn4r58j'], ['Dogecoin (DOGE)', 'DHLfH7Zk4nRLc41KpuDQNazY3qyNnjnT9v'], ['Bitcoin (BTC)', 'bc1q4uxmuqrpg4znmmj3ccnt0ezf9mx6augrxuet5p']];
      A.body.innerHTML = '<div class="tip"><img src="img/gif-045.webp" alt="" width="120" height="60"><div><b>Like this site? You can support its further development.</b><p>Any amount, however small, helps. Thank you!</p></div></div>' +
        '<ul class="tip-list">' + ADDR.map(function (a) { return '<li><span>' + a[0] + '</span><code>' + a[1] + '</code><button type="button" class="app-btn" data-a="' + a[1] + '">Copy</button></li>'; }).join('') + '</ul>' +
        '<p class="bin-tip tip-msg">Tips go one way only. This site never asks for a seed phrase or a password.</p>';
      var m = A.body.querySelector('.tip-msg');
      A.body.querySelectorAll('[data-a]').forEach(function (b) {
        b.addEventListener('click', function () {
          var t = b.getAttribute('data-a');
          var ok = function () { m.textContent = 'Copied. The frog thanks you. Double-check the first and last characters after pasting.'; };
          if (navigator.clipboard) navigator.clipboard.writeText(t).then(ok, function () { m.textContent = 'Copy blocked by the browser. Select the address and copy it by hand.'; });
          else m.textContent = 'Select the address and copy it by hand.';
        });
      });
    }, 560);
  }

  // ---------- ScamCheck.exe: a 90s "antivirus" that scans a pasted message for the usual scam red flags ----------
  // Runs only in this browser: nothing is sent anywhere. It knows patterns, not people, so a clean scan proves nothing.
  var SCAM_RULES = [
    [3, /\b(seed|recovery|secret|backup)[\s-]*(phrase|words?)\b|\bmnemonic\b|\b(12|24)[\s-]*(word|words)\b|\bprivate[\s-]*key\b|\bwallet\.?dat\b/i, 'Asks for a seed phrase, private key or wallet file', 'Nobody legit ever needs these. Whoever has them owns your coins.'],
    [3, /\b(anydesk|teamviewer|rustdesk|screen\s*share|remote\s*(access|desktop|control))\b/i, 'Wants remote access to your device', 'With remote access they can empty a wallet while you watch.'],
    [2, /\b(validate|verify|sync|synchroni[sz]e|rectify|restore|unlock|migrate)\b[^.!?]{0,40}\bwallet\b|\bconnect\s+(your\s+)?wallet\b|\bwallet\s*connect\b/i, 'Asks you to "verify", "sync" or "connect" your wallet', 'A wallet never needs verifying on a website. This is how drainer sites work.'],
    [2, /\b(support|admin|moderator|mod|helpdesk|help\s*desk|customer\s*service|official\s*team|dev\s*team)\b/i, 'Claims to be support, an admin or the team', 'Real admins and support never DM you first.'],
    [2, /\b(double|2x|3x|10x|triple)\b[^.!?]{0,40}\b(send|deposit|pep|coins?|crypto)\b|\bsend\b[^.!?]{0,40}\b(get|receive)\b[^.!?]{0,20}\b(back|double|twice)\b|\bgiveaway\b/i, 'Giveaway or "send some, get double back"', 'Nobody doubles your coins. What you send is gone.'],
    [2, /\b(guaranteed|risk[\s-]*free|passive)\b[^.!?]{0,30}\b(profit|returns?|income|gains?)\b|\b\d{1,3}\s*%\s*(daily|per\s*day|a\s*day|weekly)\b/i, 'Promises guaranteed or daily profit', 'Guaranteed returns are the oldest scam there is.'],
    [2, /\b(fee|tax|deposit|gas)\b[^.!?]{0,40}\b(withdraw|unlock|release|claim|receive)\b|\b(withdraw|unlock|release|claim)\b[^.!?]{0,40}\b(fee|tax|deposit)\b/i, 'Wants a fee before you can withdraw or claim', 'Paying to unlock "your" money only leads to the next fee.'],
    [2, /\b0x[0-9a-f]{40}\b/i, 'Contains a 0x address', 'PEP addresses start with P, never 0x. A 0x address is Ethereum (PEPE and other tokens live there).'],
    [2, /\b(airdrop|claim\s+(your|free)|free\s+(pep|tokens?|coins?|crypto)|presale|pre-sale|whitelist\s+spot)\b/i, 'Free airdrop, claim or presale', 'PEP had no presale and no airdrop. "Claim" links are the classic wallet drainer.'],
    [1, /\b(urgent|immediately|right\s+now|asap|within\s+\d+\s*(minutes?|hours?)|last\s+chance|act\s+fast|limited\s+time|will\s+be\s+(suspended|locked|closed|frozen|deleted))\b/i, 'Pushes you to hurry', 'Hurry is pressure. Real problems can wait for you to check.'],
    [1, /\b(telegram|whatsapp|signal|t\.me\/|wa\.me\/)\b|\bmove\s+(this|the\s+chat)\b|\bdm\s+me\b/i, 'Wants to move the chat elsewhere', 'Moving you to a private app gets you away from moderators.'],
    [1, /https?:\/\/|www\.|bit\.ly|tinyurl|\b[a-z0-9-]+\.(xyz|top|click|live|app|site|online|io|gg|link|cc|vip|pro)\b/i, 'Contains a link', 'Type the address of a site yourself instead of clicking a link from a DM.']
  ];
  var SCAM_DEMO = 'Hello dear, I am from Pepecoin official support team. Your wallet will be suspended within 24 hours! To validate your wallet, please send your 12 word recovery phrase here: pep-wallet-sync.xyz. Also our giveaway is live: send 1,000,000 PEP and get double back!';
  function scamCheck() {
    openApp('scam', 'ScamCheck.exe - Frog Antivirus 98', 'stop', function (A) {
      A.body.innerHTML = '<p class="bin-tip">Paste a message you got in a DM. ScamCheck looks for the usual red flags. It runs only in your browser: nothing you paste leaves this page.</p>' +
        '<textarea class="sc-in" rows="5" maxlength="4000" aria-label="Message to check" placeholder="Paste the message here…"></textarea>' +
        '<div class="app-row"><button type="button" class="app-btn sc-go">Scan now</button><button type="button" class="app-btn sc-demo">Load an example scam</button><button type="button" class="app-btn sc-clr">Clear</button><span class="grow"></span></div>' +
        '<div class="sc-bar" hidden><i></i></div><div class="sc-out" role="status" aria-live="polite"></div>';
      var inp = A.body.querySelector('.sc-in'), out = A.body.querySelector('.sc-out'), bar = A.body.querySelector('.sc-bar'), fill = bar.querySelector('i'), t = 0;
      var scan = function () {
        var txt = inp.value.trim(); clearInterval(t);
        if (!txt) { out.innerHTML = '<p class="bin-tip">Nothing to scan yet. Paste a message first.</p>'; return; }
        var hits = SCAM_RULES.filter(function (r) { return r[1].test(txt); }), score = hits.reduce(function (s, r) { return s + r[0]; }, 0);
        out.innerHTML = ''; bar.hidden = false; var p = 0;
        t = setInterval(function () {
          p += REDUCE ? 100 : 9; fill.style.width = Math.min(100, p) + '%';
          if (p < 100) return;
          clearInterval(t); bar.hidden = true;
          var lvl = score >= 3 ? 'bad' : score > 0 ? 'warn' : 'ok';
          var head = lvl === 'bad' ? 'THREAT DETECTED: this frog is a scammer.' : lvl === 'warn' ? 'SUSPICIOUS: be very careful with this one.' : 'No known red flags found.';
          out.innerHTML = '<div class="sc-verdict sc-' + lvl + '"><b>' + head + '</b>' +
            (hits.length ? '<ul>' + hits.map(function (r) { return '<li><b>' + r[2] + '.</b> ' + r[3] + '</li>'; }).join('') + '</ul>' : '<p>That does not make it safe. Scammers change their words all the time.</p>') +
            '</div><p class="bin-tip">Rule of the pond: never share a seed phrase, never pay to receive, and check everything yourself. <a href="wallets.html">Wallet safety →</a></p>';
        }, 60);
      };
      A.body.querySelector('.sc-go').addEventListener('click', scan);
      A.body.querySelector('.sc-demo').addEventListener('click', function () { inp.value = SCAM_DEMO; scan(); });
      A.body.querySelector('.sc-clr').addEventListener('click', function () { clearInterval(t); inp.value = ''; out.innerHTML = ''; bar.hidden = true; inp.focus(); });
      A.stop = function () { clearInterval(t); };
    }, 560);
  }

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
          out.innerHTML = '<div class="sc-verdict sc-' + r[0] + '"><b>' + (r[0] === 'ok' ? '✓ ' : r[0] === 'warn' ? '! ' : '✗ ') + r[1] + '</b><p>' + r[2] + '</p></div>';
        });
      };
      f.addEventListener('submit', function (e) { e.preventDefault(); run(); });
      inp.addEventListener('input', function () { if (inp.value.replace(/\s+/g, '').length >= 26) run(); else out.innerHTML = ''; });
    }, 520);
  }

  // ---------- Frog Mail: the Pond Gazette, a weekly paper in a mailbox in the tray ----------
  var MAIL_ISSUE = 0, MAIL_KEY = 'pondos-mail-read';
  function mailRead() { try { return +(localStorage.getItem(MAIL_KEY) || -1) >= MAIL_ISSUE; } catch (e) { return false; } }
  function paintMail() { document.querySelectorAll('.tray-mail').forEach(function (b) { b.classList.toggle('has-mail', !mailRead()); b.title = mailRead() ? 'Frog Mail' : 'Frog Mail: new issue of the Pond Gazette'; }); }
  function frogMail() {
    try { localStorage.setItem(MAIL_KEY, String(MAIL_ISSUE)); } catch (e) {}
    paintMail();
    openApp('mail', 'Frog Mail - Inbox', 'frog-mail', function (A) {
      A.body.innerHTML = '<div class="mail"><ul class="mail-list"><li><button type="button" class="on"><b>The Pond Gazette #0</b><small>Preview issue · still printing</small></button></li></ul>' +
        '<article class="gazette"><header><p class="gz-top"><span>Issue #0</span><span>Price: 0 PEP</span><span>Weekly, soon</span></p><h3>The Pond Gazette</h3><p class="gz-sub">All the news that fits in a pond</p></header>' +
        '<p class="gz-stop">🚧 Under construction. The presses are still warming up.</p>' +
        '<section class="gz-lead"><p class="gz-kick">Classifieds</p><h4>HELP WANTED: a frog to run game night</h4>' +
        '<div class="gz-frame ptv"><div class="ptv-top"><span class="ptv-live">LIVE</span><b>PEP-TV</b><span class="ptv-ch">CH 1 · PEPE PICTURES PRIME TIME</span></div><div class="ptv-stage"><div class="ptv-scene on"><h3 class="ad-big">WANTED:<br>a frog to run<br><em>game night!</em></h3></div></div></div>' +
        '<p>Pepe Pictures, the weekly quiz night, needs a host: set the date, pick the pictures, start the rounds and crown the winner. All in the chat.</p>' +
        '<button type="button" class="app-btn gz-tv">More on PEP-TV →</button></section>' +
        '<section class="gz-soon"><p class="gz-kick">Coming in the weekly issues</p><ul><li><b>The week in numbers:</b> price, hashrate, new blocks and supply, with sources.</li><li><b>Pond Picks:</b> the best posts and memes, picked by the community.</li><li><b>Game night winners</b> and the best Pepe Miner runs.</li></ul></section>' +
        '<p class="gz-foot">When a new issue lands, the flag on the mailbox goes up.</p></article></div>';
      A.body.querySelector('.gz-tv').addEventListener('click', function () { adPlayer(0); });
    }, 720);
  }

  // ---------- Recycle Bin: the paper-hands files and a note with the easter egg codes ----------
  function paperHands() {
    openApp('bin', 'Recycle Bin', 'recycle-bin', function (A) {
      var FILES = [
        ['📄', 'sold_at_the_bottom.txt', '2 KB', 'Opened 400 times. Still says the same thing.'],
        ['🔑', 'seed_phrase_for_support.txt', '0 KB', 'Empty. Good. Nobody legit asks for a seed phrase, so you never wrote one here.'],
        ['📈', 'wen_moon_prediction.xls', '1 KB', 'Corrupted. The frog does not do price predictions.'],
        ['🐸', 'PEPE_not_PEP.lnk', '1 KB', 'Shortcut to the wrong frog. PEP has its own chain; PEPE is an ERC-20 token.'],
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
      '  type  tip      -> the tip jar',
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
      'games folder: Pong, FUD Invaders, PEP Snake.',
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

  // ---------- live numbers, shared by the PEP Pager and the PEP-TV crawl ----------
  function liveFacts() {
    var items = [];
    var q = window.PepPrices ? window.PepPrices.quote().catch(function () { return null; }) : Promise.resolve(null);
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

  // ---------- PEP Pager: a 2000s LCD pager pinned to the desktop, scrolling the live numbers ----------
  function pager() {
    var desk = document.querySelector('.desk');
    if (!desk || document.querySelector('.pep-pager')) return;
    var pg = el('a', { class: 'pep-pager', href: 'price.html', title: 'PEP Pager: live numbers. Click for the price page.' },
      '<span class="pager-brand">PEP-PAGER 2000</span><span class="pager-lcd"><span class="pager-run"></span></span><span class="pager-led" aria-hidden="true"></span>');
    desk.insertBefore(pg, desk.firstChild);
    var run = pg.querySelector('.pager-run');
    var paint = function () {
      liveFacts().then(function (items) {
        var txt = items.map(function (i) { return i[0] + ' ' + i[1]; }).join('   ·   ') + '   ·   ';
        run.textContent = txt + txt;
        run.style.animationDuration = Math.max(14, txt.length / 4) + 's';
        pg.setAttribute('aria-label', 'PEP Pager. ' + items.map(function (i) { return i[0] + ' ' + i[1]; }).join('. '));
      });
    };
    paint(); setInterval(paint, 5 * 60000);
  }

  // ---------- PEP-TV Ads: a folder of fake late-night infomercials, played in a TV window ----------
  // Every claim in them is a fact from this site; the "offers" are jokes, and every ad says so.
  var ADS = [
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
  function adPlayer(i) {
    var ad = ADS[i];
    var A = openApp('ad-' + i, ad.file + ' - Pond Media Player', 'pond-tv', function (A) {
      A.body.innerHTML = '<div class="ptv"><div class="ptv-top"><span class="ptv-live">LIVE</span><b>PEP-TV</b><span class="ptv-ch">' + ad.ch + '</span></div>' +
        '<div class="ptv-stage">' + ad.scenes.map(function (h, k) { return '<div class="ptv-scene' + (k ? '' : ' on') + '">' + h + '</div>'; }).join('') + '</div>' +
        '<div class="ptv-crawl"><b>PEP NOW</b><span class="ptv-run"></span></div></div>' +
        '<div class="app-row"><button type="button" class="app-btn ptv-prev">◀◀</button><button type="button" class="app-btn ptv-play" aria-pressed="true">❚❚</button><button type="button" class="app-btn ptv-next">▶▶</button><span class="grow ptv-pos"></span><span class="ptv-nfa">Not a real offer. Not financial advice.</span></div>';
      var sc = A.body.querySelectorAll('.ptv-scene'), cur = 0, playing = true, t = null, pos = A.body.querySelector('.ptv-pos');
      var show = function (k) { cur = (k + sc.length) % sc.length; sc.forEach(function (x, j) { x.classList.toggle('on', j === cur); }); pos.textContent = 'Scene ' + (cur + 1) + ' of ' + sc.length; };
      var loop = function () { clearTimeout(t); if (playing && document.body.contains(A.host)) t = setTimeout(function () { show(cur + 1); loop(); }, REDUCE ? 6000 : 3800); };
      show(0); loop();
      A.body.querySelector('.ptv-next').addEventListener('click', function () { show(cur + 1); loop(); });
      A.body.querySelector('.ptv-prev').addEventListener('click', function () { show(cur - 1); loop(); });
      var pb = A.body.querySelector('.ptv-play');
      pb.addEventListener('click', function () { playing = !playing; pb.setAttribute('aria-pressed', String(playing)); pb.textContent = playing ? '❚❚' : '▶'; loop(); });
      var lap = A.body.querySelector('.ad-lap');
      if (lap && window.PepPrices) window.PepPrices.quote().then(function (q) { if (q && q.usd != null) lap.textContent = fmt.usd(40e6 * q.usd); }).catch(function () {});
      var lb = A.body.querySelector('.ad-lapbtn'); if (lb) lb.addEventListener('click', function () { laptop(); });
      liveFacts().then(function (items) { var txt = items.map(function (x) { return x[0] + ' ' + x[1]; }).join('  •  ') + '  •  '; A.body.querySelector('.ptv-run').textContent = txt + txt; });
    }, 720);
    return A;
  }
  function adsFolder() {
    openApp('ads', 'C:\\Pond\\PEP-TV Ads', 'pep-tv-ads', function (A) {
      A.body.innerHTML = '<ul class="folder">' + ADS.map(function (ad, i) { return '<li><button type="button" data-i="' + i + '"><img src="' + ico(ad.icon) + '" alt="" width="40" height="40"><span>' + ad.file + '</span></button></li>'; }).join('') + '</ul>' +
        '<p class="bin-tip">Late-night PEP-TV infomercials, recovered from an old VHS. Double-click one to play. The facts are real; the offers are not.</p>';
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
  var typed = '', KONAMI = 'ArrowUp ArrowUp ArrowDown ArrowDown ArrowLeft ArrowRight ArrowLeft ArrowRight b a', kseq = [];
  document.addEventListener('keydown', function (e) {
    if (!mainEl || (e.target.closest && e.target.closest('input, textarea, select'))) return;
    kseq.push(e.key); kseq = kseq.slice(-10);
    if (kseq.join(' ') === KONAMI) { coinRain(30); balloon('Cheat code accepted', '+0 PEP. Nice try, fren. Coins come from mining, not from cheat codes.', 'pep-logo'); kseq = []; return; }
    if (e.key.length !== 1) return;
    typed = (typed + e.key.toLowerCase()).slice(-12);
    if (/wen$/.test(typed)) { typed = ''; osDialog('wen.exe', '<div class="dlg-row"><img src="img/gif-064.webp" alt="" width="96" height="70"><div><h3>wen.exe has performed a legal operation.</h3><p>No price predictions are installed on this system. For arithmetic, open WhatIf.exe.</p></div></div>', [{ label: 'OK', go: true }, { label: 'Open WhatIf.exe', href: 'calculator.html' }], 'gif-064-still'); }
    else if (/seed$/.test(typed)) { typed = ''; osDialog('Security Center', '<div class="dlg-row"><img src="img/gif-085.webp" alt="" width="96" height="96"><div><h3>Seed phrase? Never here.</h3><p>PondOS will never ask for it. Not support, not admins, not frogs. If anything asks you to type it, close it.</p></div></div>', [{ label: 'Understood', go: true }], 'gif-085-still'); }
    else if (/tip$/.test(typed)) { typed = ''; tipJar(); }
    else if (/laptop$/.test(typed)) { typed = ''; laptop(); }
    else if (/moon$/.test(typed)) { typed = ''; coinRain(8); balloon('Moon not found', 'The frog checked. There is no moon in chainparams.cpp.', 'gif-084-still'); }
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
  var EMO = ' gmfren heart shh wen facts hmm sleepy bigbrain peek ready waiting pep cheer torch hug chair crayon smoke scream serious hurry news loading crowd ';
  function anySession() {
    try { var s = JSON.parse(localStorage.getItem('sb-azbwciqfbsdpwubznncg-auth-token') || 'null'); if (s && s.access_token && s.expires_at * 1000 > Date.now() + 30000) return s; } catch (e) {}
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
  function chatBody(t) {
    return esc(t).replace(/:([a-z]{3,10}):/g, function (m, c) { return EMO.indexOf(' ' + c + ' ') >= 0 ? '<img class="emo-img" src="' + BASE + 'games/img/emotes/' + c + '.webp" alt=":' + c + ':" width="24" height="24">' : m; });
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
        '<div class="emo-pop" hidden role="group" aria-label="Emotes">' + EMO.trim().split(' ').map(function (c) { return '<button type="button" data-e="' + c + '" title=":' + c + ':"><img src="' + BASE + 'games/img/emotes/' + c + '.webp" alt=":' + c + ':" width="32" height="32" loading="lazy"></button>'; }).join('') + '</div>' +
        '<form class="app-row lan-form"><button type="button" class="app-btn emo-btn" aria-expanded="false" aria-label="Emotes" title="Emotes"><img src="' + BASE + 'games/img/emotes/pep.webp" alt="" width="22" height="22"></button><input name="n" class="lan-nick" maxlength="20" autocomplete="nickname" placeholder="Nickname" aria-label="Nickname" hidden><input name="t" maxlength="300" autocomplete="off" placeholder="Say gm…" aria-label="Message"><button type="submit" class="app-btn">Send</button></form>' +
        '<p class="hs-note lan-note"></p>';
      var log = A.body.querySelector('.lan-log'), form = A.body.querySelector('.lan-form'), inp = form.querySelector('input[name=t]'), note = A.body.querySelector('.lan-note');
      var last = 0, seen = {}, timer = 0, alive = true, first = true, live = false, ringT = 0, want = 0, force = false;
      var pop = A.body.querySelector('.emo-pop'), eb = A.body.querySelector('.emo-btn');
      eb.addEventListener('click', function () { pop.hidden = !pop.hidden; eb.setAttribute('aria-expanded', String(!pop.hidden)); });
      pop.addEventListener('click', function (e) {
        var b = e.target.closest('[data-e]'); if (!b || inp.disabled) return;
        var v = inp.value, at = inp.selectionStart == null ? v.length : inp.selectionStart, code = ':' + b.getAttribute('data-e') + ':';
        var pre = v.slice(0, at), post = v.slice(at);
        inp.value = (pre && !/\s$/.test(pre) ? pre + ' ' : pre) + code + ' ' + post.replace(/^\s+/, '');
        pop.hidden = true; eb.setAttribute('aria-expanded', 'false'); inp.focus();
      });
      var nickIn = form.querySelector('.lan-nick');
      try { nickIn.value = localStorage.getItem('pepgry-nick') || ''; } catch (e) {}
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
      var poll = function () {
        clearTimeout(timer);
        chatRpc('gry_lobby_chat', { p_after: last, p_visitor: visitorId() }).then(function (r) {
          if (!alive) return;
          paintOnline(r.online);
          if (first) { log.innerHTML = ''; first = false; }
          (r.hidden || []).forEach(function (id) { if (seen[id]) { seen[id].remove(); delete seen[id]; } });
          var atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
          (r.messages || []).forEach(function (m) {
            if (seen[m.id]) return;
            var row = el('div', { class: 'lan-msg' }, '<span class="lan-t">' + new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '</span> <b>' + esc(m.nick) + '</b>' + (m.verified ? ' <span class="hs-ok" title="Verified with Discord">✓</span>' : '') + ': ' + chatBody(m.body));
            var tipEl = log.querySelector('.bin-tip'); if (tipEl) tipEl.remove();
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
      paintNote(); poll();
      A.stop = function () { alive = false; clearTimeout(timer); clearTimeout(ringT); stopBell(); };
    }, 480);
    return A;
  }
  // the green online counter on the desktop icon and in the tray, refreshed every 45 seconds
  if (mainEl) {
    var pingOnline = function () { chatRpc('gry_lobby_chat', { p_after: 2147483647, p_visitor: visitorId() }).then(function (r) { paintOnline(r.online); }, function () {}); };
    setTimeout(pingOnline, 1500);
    setInterval(function () { if (!document.hidden && !apps.lan) pingOnline(); }, 45000);
    var trayEl2 = document.querySelector('.tray');
    if (trayEl2) {
      var tl = el('button', { type: 'button', class: 'tray-lan lan-badge', hidden: '', title: 'LAN Party chat' }, '<span class="lan-dot" aria-hidden="true"></span><span class="lan-n"></span><span class="sr"> online, open the chat</span>');
      tl.addEventListener('click', lanParty);
      trayEl2.insertBefore(tl, trayEl2.firstChild);
      var mb = el('button', { type: 'button', class: 'tray-mail', title: 'Frog Mail', 'aria-label': 'Frog Mail' },
        '<svg viewBox="0 0 24 20" width="22" height="18" aria-hidden="true"><path class="mb-post" d="M11 13h2v7h-2z"/><path class="mb-box" d="M3 6a5 5 0 0 1 10 0v7H3zM8 1h8a5 5 0 0 1 5 5v7H13V6a5 5 0 0 0-5-5z"/><path class="mb-flag" d="M18 3h1v7h-1zM19 3h4l-1.5 1.5L23 6h-4z"/></svg>');
      mb.addEventListener('click', frogMail);
      trayEl2.insertBefore(mb, trayEl2.firstChild);
      paintMail();
      if (!mailRead()) setTimeout(function () { if (!mailRead()) balloon('You\u2019ve got frog mail!', 'The Pond Gazette #0 is in your mailbox. Click the mailbox in the corner.', 'frog-mail'); }, 17000);
    }
  }

  // ---------- balloon notices ----------
  function balloon(title, text, icon) {
    var t = el('div', { class: 'balloon', role: 'status' }, '<img src="' + ico(icon) + '" alt="" width="40" height="40"><div><b>' + title + '</b><span>' + text + '</span></div><button type="button" aria-label="Dismiss">' + ICO.x + '</button>');
    document.body.appendChild(t);
    var bye = function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 300); };
    t.querySelector('button').addEventListener('click', bye);
    setTimeout(bye, 12000);
  }
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
      ['Price, hourly snapshot', function () { return window.PepPrices ? window.PepPrices.quote().then(function (q) { return fmt.usd(q.usd); }) : Promise.reject(); }],
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
