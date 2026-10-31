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

  /* ---------------------------------------------------------------- header */
  var top = document.querySelector('header.top');
  if (top) {
    var bar = el('div', { class: 'in bar' });
    bar.innerHTML = '<a class="logo" href="./" aria-label="Pepecoin Hub, meme edition, home"><img class="on-light" src="img/pepecoin-lockup-light.svg" alt="" width="134" height="32"><img class="on-dark" src="img/pepecoin-lockup-dark.svg" alt="" width="134" height="32"><span class="hub">Hub</span></a>';
    // one Menu button opens every page in four columns (a full-width sheet on a phone), as on the serious site
    var nav = el('nav', { class: 'nav', id: 'nav', 'aria-label': 'Pages', hidden: '' });
    var cols = el('div', { class: 'mega' });
    NAV.forEach(function (g, gi) {
      var col = el('section', { class: 'mega-col' }, '<p class="mega-h"><span>0' + (gi + 1) + '</span>' + g[0] + '</p>');
      g[1].forEach(function (p) {
        var a = el('a', { href: href(p[0]) }, '<img src="img/' + p[3] + '.webp" alt="" width="40" height="40" loading="lazy"><span><b>' + p[1] + '</b><small>' + p[2] + '</small></span>');
        if (p[0] === PAGE) a.setAttribute('aria-current', 'page');
        if (p[0] === '@games/') a.className = 'games';
        col.appendChild(a);
      });
      cols.appendChild(col);
    });
    nav.appendChild(cols);
    var tb = el('button', { type: 'button', class: 'themebtn', id: 'themebtn', 'aria-label': 'Switch light or dark' });
    // Serious | Meme switch: the knob sits on Meme here and slides to Serious on click
    var ml = el('a', { class: 'mode-link', href: serious, title: 'Switch to serious mode: same facts, no memes', 'aria-label': 'Switch to serious mode' }, '<span class="mt-a">Serious</span><span class="mt-b">Meme</span>');
    ml.addEventListener('click', function (e) {
      try { localStorage.setItem('hub-mode', 'serious'); } catch (err) {}
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      e.preventDefault(); ml.classList.add('to-a');
      setTimeout(function () { location.href = ml.href; }, 220);
    });
    bar.appendChild(ml);
    bar.appendChild(tb);
    var mb = el('button', { type: 'button', class: 'menubtn', 'aria-expanded': 'false', 'aria-controls': 'nav' }, '<span class="bars" aria-hidden="true"><i></i><i></i><i></i></span>Menu');
    var setOpen = function (o) {
      if (o) nav.style.setProperty('--menu-top', Math.round(top.getBoundingClientRect().bottom + 6) + 'px');
      nav.hidden = !o; top.classList.toggle('open', o); mb.setAttribute('aria-expanded', String(o));
      root.classList.toggle('menu-lock', o);
    };
    mb.addEventListener('click', function (e) { e.stopPropagation(); setOpen(nav.hidden); });
    bar.appendChild(mb);
    bar.appendChild(nav);
    top.appendChild(bar);
    document.addEventListener('click', function (e) { if (!nav.hidden && !top.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !nav.hidden) { setOpen(false); mb.focus(); } });
    // no line under the header at the top of the page; it comes back once the page scrolls
    var stuck = false;
    var onScroll = function () { var s = window.scrollY > 8; if (s !== stuck) { stuck = s; top.classList.toggle('stuck', s); } };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

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

  window.Meme = { json: json, fmt: fmt, fill: fill, lineChart: lineChart, base: BASE, data: DATA, page: PAGE };
})();
