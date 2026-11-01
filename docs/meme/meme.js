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
  var href = function (p) { return p.charAt(0) === '@' ? (p === '@' ? serious : BASE + p.slice(1)) : p === 'index' ? './' : p + '.html'; };
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
      var b = el('button', { type: 'button', class: 'sm-item', 'aria-expanded': 'false' }, '<img src="img/' + icon + '.webp" alt="" width="28" height="28"><span>' + label + '</span>' + arrow);
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
    smMain.appendChild(el('hr'));
    NAV.forEach(function (g, gi) {
      var list = el('div', { class: 'sm-list' });
      g[1].forEach(function (p) {
        var a = el('a', { href: href(p[0]) }, '<img src="img/' + p[3] + '.webp" alt="" width="24" height="24" loading="lazy"><span><b>' + p[1] + '</b><small>' + p[2] + '</small></span>');
        if (p[0] === PAGE) a.setAttribute('aria-current', 'page');
        list.appendChild(a);
      });
      smMain.appendChild(subGroup(g[0], GICON[gi], list));
    });
    var gl = el('div', { class: 'sm-list' });
    [['PEP Pong', 'PEP vs PEPE, first to 7', 'pep-logo', function () { pong(); }], ['FUD Invaders', 'Shoot receipts at the FUD', 'gif-008-still', function () { invaders(); }],
      ['PEP Snake', 'Eat blocks, not your tail', 'gif-027-still', function () { snake(); }],
      ['Paper hands', 'The recycle bin, sort of', 'wrongpep', function () { paperHands(); }]].forEach(function (g) {
      var b = el('a', { href: '#', role: 'button' }, '<img src="img/' + g[2] + '.webp" alt="" width="24" height="24" loading="lazy"><span><b>' + g[0] + '</b><small>' + g[1] + '</small></span>');
      b.addEventListener('click', function (e) { e.preventDefault(); setOpen(false); g[3](); });
      gl.appendChild(b);
    });
    var onl = el('a', { href: BASE + 'games/' }, '<img src="img/pond-playground.webp" alt="" width="24" height="24" loading="lazy"><span><b>PEP Games online</b><small>Charades, Pepe Miner, lobby chat</small></span>');
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
    d.innerHTML = '<div class="win active"><div class="win-bar"><img src="img/' + (icon || 'pep-logo') + '.webp" alt="" width="16" height="16"><span class="win-t">' + esc(title) + '</span><span class="win-ctl"><button type="button" class="w-x" title="Close">' + ICO.x + '<span class="sr">Close</span></button></span></div><div class="dlg-body">' + html + '</div><div class="dlg-btns"></div></div>';
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
    if (s === 'open') { focusW(W); reveal(W); } else if (W === activeW) { W.win.classList.remove('active'); W.task.setAttribute('aria-pressed', 'false'); activeW = null; nextActive(); }
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
      ['Receipts', [['Open the sources', function () { var r = receipts(); if (r) setState(r, 'open'); }], ['Report a mistake', 'https://github.com/PepecoinHub/pepecoinhub.github.io/issues/new?template=correction.yml']]],
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
    var iconSrc = opts.icon ? 'img/' + opts.icon + '.webp' : body.classList.contains('hero') ? 'img/pep-logo.webp' : pic ? pic.getAttribute('src') : 'img/' + (APP[PAGE] || ['', 'pep-logo'])[1] + '.webp';
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
    if (opts.status) { W.status = el('div', { class: 'win-status' }, '<span>' + opts.status + '</span><span class="st-r"></span>'); win.appendChild(W.status); }
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

  var mainEl = document.querySelector('main');
  if (mainEl) {
    root.classList.add('pondos');
    // blocks are direct children of <main>, or one level down inside a wrapper such as the rich list's #app
    Array.prototype.slice.call(mainEl.querySelectorAll(':scope > section.in, :scope > div.in, :scope > aside.in, :scope > div:not(.in) > section.in')).forEach(function (n) {
      var lead = n.classList.contains('hero') || n.classList.contains('pagehead');
      windowize(n, lead ? { menu: true, status: 'Every number keeps its receipt.' } : null);
    });
    var fin = document.querySelector('footer.foot > div');
    if (fin) windowize(fin, { title: 'About Pepecoin Hub', icon: 'pep-logo', wide: true });
    // a hidden wrapper (the rich list before its data arrives, the frog chooser) hides its taskbar buttons too
    new MutationObserver(function () { wins.forEach(sync); }).observe(mainEl, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
    wins.forEach(sync);
    // the README status bar shows the latest block from the daily snapshot
    json('network.json').then(function (n) {
      var b = 'Block ' + fmt.int(n.rows[n.rows.length - 1][1]);
      wins.forEach(function (W) { if (W.status) W.status.querySelector('.st-r').textContent = b; });
    }).catch(function () {});
    var first = null; wins.forEach(function (w) { if (!first && !w.host.closest('[hidden]')) first = w; });
    focusW(first);
    // "Show desktop" at the end of the tray: minimizes every window to see the wallpaper, a second click brings them back
    var trayEl = document.querySelector('.tray');
    if (trayEl) {
      var peek = el('button', { type: 'button', class: 'show-desk', title: 'Show desktop', 'aria-pressed': 'false' }, '<span class="sr">Show desktop</span>');
      var hiddenByPeek = [];
      peek.addEventListener('click', function () {
        if (hiddenByPeek.length) { hiddenByPeek.forEach(function (w) { if (w.state === 'min') setState(w, 'open'); }); hiddenByPeek = []; peek.setAttribute('aria-pressed', 'false'); return; }
        wins.forEach(function (w) { if (w.state === 'open' && !w.host.closest('[hidden]')) { hiddenByPeek.push(w); setState(w, 'min'); } });
        peek.setAttribute('aria-pressed', 'true');
        window.scrollTo(0, 0);
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
      ['#games', 'Games', 'gif-061-still'], ['#notpep', 'Not PEP (0x)', 'wrongpep'], [serious, 'Serious mode', 'serious'], ['#tip', 'Tip jar.exe', 'gif-045-still'], ['#bin', 'Paper hands', 'gif-040-still']
    ];
    var ACT = { '#games': gamesFolder, '#tip': tipJar, '#pong': pong, '#fud': invaders, '#snake': snake, '#bin': paperHands, '#notpep': function () {
      osDialog('Not PEP (0x) - Properties', '<div class="dlg-row"><img src="img/gif-029.webp" alt="" width="96" height="96"><div><h3>Same name, different frogs.</h3><p>These assets share the name. None of them is PEP:</p><ul class="dlg-list"><li><b>PEPE</b>: an ERC-20 token on Ethereum since April 2023. Address starts with 0x.</li><li><b>PEPECOIN</b> (PepeCoin / Memetic): from March 2016, a token on Ethereum since 2023. Address starts with 0x.</li></ul><p><b>PEP</b> has its own blockchain, and its addresses start with P.</p></div></div>',
        [{ label: 'Full side-by-side…', go: true, href: 'which-pepecoin.html' }, { label: 'OK' }], 'wrongpep');
    } };
    var desk = el('nav', { class: 'desk', 'aria-label': 'Desktop' });
    desk.innerHTML = '<ul class="icons">' + DESKTOP.map(function (d) { return '<li><a href="' + d[0] + '" data-id="' + esc(d[1]) + '"><img src="img/' + d[2] + '.webp" alt="" width="40" height="40"><span>' + d[1] + '</span></a></li>'; }).join('') + '</ul>';
    document.body.insertBefore(desk, mainEl);
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
    if (apps[id]) { focusApp(apps[id]); return apps[id]; }
    var host = el('div', { class: 'app-win', role: 'dialog', 'aria-label': title });
    if (width) host.style.width = 'min(' + width + 'px, calc(100vw - 16px))';
    host.innerHTML = '<div class="win active"><div class="win-bar"><img src="img/' + icon + '.webp" alt="" width="16" height="16"><span class="win-t">' + esc(title) + '</span><span class="win-ctl"><button type="button" class="w-x" title="Close">' + ICO.x + '<span class="sr">Close ' + esc(title) + '</span></button></span></div><div class="app-body"></div></div>';
    document.body.appendChild(host);
    var A = { id: id, host: host, body: host.querySelector('.app-body'), stop: null };
    var n = Object.keys(apps).length;
    host.style.top = (50 + n * 28) + 'px';
    if (window.innerWidth > 760) { host.style.left = Math.max(8, (window.innerWidth - host.offsetWidth) / 2 + n * 28) + 'px'; host.style.transform = 'none'; }
    A.close = function () { if (A.stop) A.stop(); host.remove(); delete apps[id]; if (activeApp === A) activeApp = null; };
    host.querySelector('.w-x').addEventListener('click', A.close);
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
      var reset = function () { st = { x: W / 2, lives: 3, score: 0, n: 0 }; Object.assign(st, wave(0)); running = true; msg.textContent = 'Wave 1. Receipts beat FUD.'; };
      var fire = function () { if (!running) { reset(); return; } if (st.cool > 0 || st.shots.length > 2) return; st.shots.push({ x: st.x, y: H - 40 }); st.cool = 16; };
      cv.addEventListener('pointerdown', function (e) { if (!running) { reset(); return; } fire(); });
      cv.addEventListener('pointermove', function (e) { if (!running || e.pointerType === 'mouse' && !e.buttons) { if (running && e.pointerType === 'mouse') { var r0 = cv.getBoundingClientRect(); st.x = Math.min(Math.max((e.clientX - r0.left) / r0.width * W, 20), W - 20); } return; } var r = cv.getBoundingClientRect(); st.x = Math.min(Math.max((e.clientX - r.left) / r.width * W, 20), W - 20); });
      A.body.querySelectorAll('[data-k]').forEach(function (b) {
        var k = b.getAttribute('data-k');
        if (k === 'fire') b.addEventListener('pointerdown', fire);
        else { b.addEventListener('pointerdown', function () { keys[k] = 1; }); ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (t) { b.addEventListener(t, function () { keys[k] = 0; }); }); }
      });
      var unkey = gameKeys(A, { ArrowLeft: function (d) { keys.left = d; }, ArrowRight: function (d) { keys.right = d; }, a: function (d) { keys.left = d; }, d: function (d) { keys.right = d; }, ' ': function (d) { if (d) fire(); } });
      var end = function (text) { running = false; hiScore('pondos-fud', st.score); showHi(); msg.textContent = text + ' Score ' + st.score + '. Click to play again.'; };
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
        var blocks = s.length - 3; hiScore('pondos-snake', blocks); showHi();
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
      var start = function () { if (timer) return; s = [[8, 7], [7, 7], [6, 7]]; dir = next = [1, 0]; place(); tickMs = 140; msg.textContent = 'Go, fren. Blocks are coins.'; draw(); timer = setInterval(tick, tickMs); };
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

  // ---------- Games folder ----------
  function gamesFolder() {
    openApp('games', 'C:\\Pond\\Games', 'gif-061-still', function (A) {
      var G = [['PEP Pong', 'pep-logo', pong], ['FUD Invaders', 'gif-008-still', invaders], ['PEP Snake', 'gif-027-still', snake],
        ['PEP Games online', 'pond-playground', function () { pepGamesOnline(); }]];
      A.body.innerHTML = '<ul class="folder">' + G.map(function (g, i) { return '<li><button type="button" data-i="' + i + '"><img src="img/' + g[1] + '.webp" alt="" width="40" height="40"><span>' + g[0] + '</span></button></li>'; }).join('') + '</ul>' +
        '<p class="bin-tip">Double-click a game. PEP Games online (Charades, Pepe Miner, lobby chat) opens in its own window.</p>';
      A.body.querySelectorAll('.folder button').forEach(function (b) {
        var go = function () { G[+b.getAttribute('data-i')][2](); };
        b.addEventListener('dblclick', go);
        b.addEventListener('click', function () { if (!matchMedia('(hover: hover) and (pointer: fine)').matches) go(); else { A.body.querySelectorAll('.folder .sel').forEach(function (x) { x.classList.remove('sel'); }); b.classList.add('sel'); } });
        b.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } });
      });
    }, 460);
  }
  // the online games site inside a big window; on a phone it simply opens the page
  function pepGamesOnline() {
    if (window.innerWidth < 760) { location.href = BASE + 'games/'; return; }
    var A = openApp('online', 'PEP Games online', 'pond-playground', function (A) {
      A.body.innerHTML = '<iframe class="app-frame" src="' + BASE + 'games/" title="PEP Games"></iframe><div class="app-row"><span class="grow">Charades, Pepe Miner and the lobby chat.</span><a class="app-btn" href="' + BASE + 'games/" target="_blank" rel="noopener">Open in a new tab</a></div>';
    }, 1100);
    A.host.style.top = '12px';
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

  // ---------- Paper hands (the recycle bin) ----------
  function paperHands() {
    openApp('bin', 'Paper hands', 'wrongpep', function (A) {
      var FILES = [
        ['📄', 'sold_at_the_bottom.txt', '2 KB', 'Opened 400 times. Still says the same thing.'],
        ['🔑', 'seed_phrase_for_support.txt', '0 KB', 'Empty. Good. Nobody legit asks for a seed phrase, so you never wrote one here.'],
        ['📈', 'wen_moon_prediction.xls', '1 KB', 'Corrupted. The frog does not do price predictions.'],
        ['🐸', 'PEPE_not_PEP.lnk', '1 KB', 'Shortcut to the wrong frog. PEP has its own chain; PEPE is an ERC-20 token.'],
        ['📸', 'screenshot_of_someone_elses_gains.png', '3 MB', 'Not your keys, not your coins, not your screenshot.'],
        ['💻', 'legendary_laptop_receipt.pdf', '40M PEP', 'Receipt for one laptop, paid in PEP. Double-click to see what it costs today.'],
        ['🧻', 'paper_hands.exe', '∞ KB', 'Runs automatically during every dip.']
      ];
      A.body.innerHTML = '<ul class="bin-list">' + FILES.map(function (f, i) { return '<li data-i="' + i + '"><span aria-hidden="true">' + f[0] + '</span><span>' + f[1] + '</span><small>' + f[2] + '</small></li>'; }).join('') + '</ul>' +
        '<p class="bin-tip">Click a file to see what is inside.</p><div class="app-row"><span class="grow">' + FILES.length + ' object(s)</span><button type="button" class="app-btn bin-empty">Empty Paper hands</button></div>';
      var tip = A.body.querySelector('.bin-tip');
      A.body.querySelectorAll('.bin-list li').forEach(function (li) { li.addEventListener('click', function () { A.body.querySelectorAll('.bin-list li').forEach(function (x) { x.classList.toggle('sel', x === li); }); tip.textContent = FILES[+li.getAttribute('data-i')][3]; }); li.addEventListener('dblclick', function () { if (/laptop/.test(li.textContent)) laptop(); }); });
      A.body.querySelector('.bin-empty').addEventListener('click', function () { tip.textContent = 'Cannot empty Paper hands: the files already sold themselves. Diamond hands are in another folder.'; });
    }, 420);
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

  // ---------- balloon notices ----------
  function balloon(title, text, icon) {
    var t = el('div', { class: 'balloon', role: 'status' }, '<img src="img/' + icon + '.webp" alt="" width="40" height="40"><div><b>' + title + '</b><span>' + text + '</span></div><button type="button" aria-label="Dismiss">' + ICO.x + '</button>');
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
  if (!booted && !REDUCE && mainEl) {
    var boot = el('div', { class: 'boot', 'aria-hidden': 'true' });
    boot.innerHTML = '<div class="boot-in"><img class="boot-coin" src="img/coin-spin.webp" alt="" width="120" height="120"><p class="boot-name">Pond<b>OS</b> <span>98 Second Frog Edition</span></p>' +
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

  window.Meme = { json: json, fmt: fmt, fill: fill, lineChart: lineChart, base: BASE, data: DATA, page: PAGE };
})();
