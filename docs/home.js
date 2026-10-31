// Home page: the hero buttons switch the strip below them (PEP vs PEPE, how to buy, how to mine),
// and the price tiles are refreshed live from CoinGecko. Without JavaScript the buttons stay plain
// links and the tiles keep the figures baked in by scripts/prebake.mjs.
(function () {
  'use strict';
  var LOCALE = { en: 'en-US', pl: 'pl-PL', es: 'es-ES', de: 'de-DE', fr: 'fr-FR', tr: 'tr-TR', it: 'it-IT', zh: 'zh-CN' };
  var lang = (document.documentElement.lang || 'en').toLowerCase();
  var LOC = LOCALE[lang.indexOf('zh') === 0 ? 'zh' : lang.split('-')[0]] || 'en-US';

  var me = document.currentScript && document.currentScript.src;

  // ---------- hero coin ----------
  // The frog coin turns over to its P side now and then (CSS in facts.css); a still frog with reduced motion.
  var frog = document.querySelector('.home-hero-frog');
  if (frog && me && window.matchMedia && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var coin = document.createElement('div'), spin = document.createElement('div'), back = document.createElement('img');
    coin.className = 'hero-coin'; spin.className = 'hero-coin-spin';
    back.className = 'hero-coin-back'; back.alt = ''; back.src = new URL('assets/brand/coin-p.svg', me).href;
    frog.parentNode.insertBefore(coin, frog);
    coin.appendChild(spin);
    spin.appendChild(frog); spin.appendChild(back);
  }

  // ---------- tabs ----------
  var bar = document.querySelector('.hero-tabs');
  var tabs = bar ? Array.prototype.slice.call(bar.querySelectorAll('a[data-panel]')) : [];
  function select(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab, panel = document.getElementById(t.getAttribute('data-panel'));
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      t.classList.toggle('main', on);
      t.classList.toggle('soft', !on);
      if (panel) panel.hidden = !on;
    });
    if (focus) tab.focus();
  }
  if (tabs.length) {
    bar.setAttribute('role', 'tablist');
    tabs.forEach(function (t, i) {
      var panel = document.getElementById(t.getAttribute('data-panel'));
      t.setAttribute('role', 'tab');
      t.setAttribute('aria-controls', panel.id);
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', t.id);
      t.addEventListener('click', function (e) {
        e.preventDefault();
        select(t);
        // on a phone the strip can sit below the fold: bring its top into view
        var r = panel.getBoundingClientRect();
        if (r.top > window.innerHeight - 120) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      t.addEventListener('keydown', function (e) {
        var k = e.key, n = tabs.length;
        var j = k === 'ArrowRight' ? (i + 1) % n : k === 'ArrowLeft' ? (i + n - 1) % n : k === 'Home' ? 0 : k === 'End' ? n - 1 : -1;
        if (j < 0) return;
        e.preventDefault();
        select(tabs[j], true);
      });
    });
    select(tabs[0]);
  }

  // ---------- news next to the frog ----------
  // The note in the hero shows one piece of news at a time and moves on to the next every few seconds: the active dot
  // fills up like a progress bar and its end turns the page. It stops while the pointer or focus is on it; the dots
  // switch by hand. With reduced motion nothing moves by itself. Without JavaScript only the first item shows.
  var rot = document.querySelector('.news-rot');
  var items = rot ? Array.prototype.slice.call(rot.querySelectorAll('.rot-item')) : [];
  if (items.length > 1) {
    var cur = 0, auto = !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    var dots = document.createElement('span'), frogImg = rot.querySelector('img');
    dots.className = 'rot-dots';
    items.forEach(function (it, i) {
      it.hidden = false;
      it.classList.toggle('is-on', i === 0);
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'rot-dot'; b.setAttribute('aria-label', (i + 1) + ' / ' + items.length);
      b.innerHTML = '<i></i>';
      b.addEventListener('click', function () { rot.setAttribute('data-dir', i > cur ? 'next' : 'prev'); go(i); });
      dots.appendChild(b);
    });
    rot.querySelector('.rot-items').appendChild(dots);
    rot.classList.add('rot-ready');
    if (auto) rot.classList.add('rot-auto');
    function paint() {
      Array.prototype.forEach.call(dots.children, function (b, i) {
        b.classList.toggle('on', i === cur);
        if (i === cur) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
      });
    }
    function go(i) {
      if (i === cur) return;
      var out = items[cur];
      out.classList.remove('is-on'); out.classList.add('is-out');
      setTimeout(function () { out.classList.remove('is-out'); }, 600);
      cur = i;
      items[cur].classList.add('is-on');
      if (frogImg && auto) { frogImg.classList.remove('hop'); void frogImg.offsetWidth; frogImg.classList.add('hop'); }
      paint();
    }
    // the fill animation of the active dot runs for the reading time; when it ends, the next item comes in
    dots.addEventListener('animationend', function (e) {
      if (e.target.parentNode === dots.children[cur]) { rot.removeAttribute('data-dir'); go((cur + 1) % items.length); }
    });
    // the whole note is a link to wherever the news shown leads (the dots and the link itself keep their own click)
    // a sideways swipe (phones) or drag (mouse) and the left/right arrow keys step to the next or previous news
    var sx = null, sy = 0, swiped = false;
    function step(d) { rot.setAttribute('data-dir', d > 0 ? 'next' : 'prev'); go((cur + d + items.length) % items.length); }
    function start(x, y) { sx = x; sy = y; swiped = false; }
    function end(x, y) {
      if (sx === null) return;
      var dx = x - sx, dy = y - sy; sx = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) { swiped = true; step(dx < 0 ? 1 : -1); }
    }
    rot.addEventListener('touchstart', function (e) { var t = e.changedTouches[0]; start(t.clientX, t.clientY); }, { passive: true });
    rot.addEventListener('touchend', function (e) { var t = e.changedTouches[0]; end(t.clientX, t.clientY); });
    rot.addEventListener('touchcancel', function () { sx = null; });
    rot.addEventListener('mousedown', function (e) { if (!e.button) start(e.clientX, e.clientY); });
    rot.addEventListener('mouseup', function (e) { end(e.clientX, e.clientY); });
    // a swipe that ends on a link must not open it
    rot.addEventListener('click', function (e) { if (swiped) { swiped = false; e.preventDefault(); e.stopPropagation(); } }, true);
    rot.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); step(e.key === 'ArrowRight' ? 1 : -1); }
    });
    rot.addEventListener('click', function (e) {
      if (e.target.closest('a, button')) return;
      var a = items[cur].querySelector('a[href]');
      if (a) a.click();
    });
    paint();
  }

  // ---------- live price tiles ----------
  // Refreshed on load and every 10 minutes while the tab is open (CoinGecko's free API asks for no more).
  var TTL = 10 * 60 * 1000;
  function usd(v) {
    var o = { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' };   // a plain "$" keeps the tiles narrow
    if (v >= 1e5) { o.notation = 'compact'; o.maximumSignificantDigits = 3; }
    else if (v >= 1) { o.maximumFractionDigits = 2; }
    else { o.maximumSignificantDigits = 3; }
    return new Intl.NumberFormat(LOC, o).format(v);
  }
  function pct(v) { return new Intl.NumberFormat(LOC, { maximumFractionDigits: Math.abs(v) < 10 ? 2 : 1, signDisplay: 'exceptZero' }).format(v) + '%'; }
  function set(k, s) { var el = document.querySelector('[data-v="' + k + '"]'); if (el) el.textContent = s; }
  var caps = null;
  function show(a) {
    if (!a || !(a.current_price > 0)) return;
    var supply = a.total_supply || a.circulating_supply;
    set('home-price', usd(a.current_price));
    if (typeof a.price_change_percentage_24h === 'number') set('home-change', pct(a.price_change_percentage_24h));
    if (!(supply > 0)) return;
    var x = a.current_price * supply * 100;
    set('home-mcap', usd(a.current_price * supply)); set('home-x100', usd(x));
    // where ×100 would rank among the top 250 coins (their market caps are saved daily in data/price.json)
    var box = document.querySelector('.x100-rank');
    if (box && caps && caps.length > 100) {
      set('home-x100-rank', x < caps[caps.length - 1] ? caps.length + '+' : String(1 + caps.filter(function (c) { return c > x; }).length));
      box.hidden = false;
    }
  }
  var stamp = document.createElement('small');
  function load() {
    window.PepPrices.quote().then(function (q) {
      caps = q.caps;
      show({ current_price: q.usd, total_supply: q.supply, price_change_percentage_24h: q.change_24h });
      stamp.textContent = window.PepPrices.describe(q, LOC);
    }).catch(function () { stamp.textContent = window.PepPrices.describe({ saved: true, time: 0 }, LOC).split(': ')[0];  });
  }
  var priceEl = document.querySelector('[data-v="home-price"]');
  if (!priceEl) return;
  stamp.style.display = 'block';
  priceEl.parentNode.appendChild(stamp);
  window.PepPrices.subscribe(load);
})();
