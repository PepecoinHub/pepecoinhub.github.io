// Home page: the hero buttons switch the strip below them (PEP vs PEPE, how to buy, how to mine),
// and the price tiles are refreshed live from CoinGecko. Without JavaScript the buttons stay plain
// links and the tiles keep the figures baked in by scripts/prebake.mjs.
(function () {
  'use strict';
  var LOCALE = { en: 'en-US', pl: 'pl-PL', es: 'es-ES', de: 'de-DE', fr: 'fr-FR', tr: 'tr-TR', it: 'it-IT', zh: 'zh-CN' };
  var lang = (document.documentElement.lang || 'en').toLowerCase();
  var LOC = LOCALE[lang.indexOf('zh') === 0 ? 'zh' : lang.split('-')[0]] || 'en-US';

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

  // ---------- live price tiles ----------
  var API = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=pepecoin-network';
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
  function fresh(key) {
    try { var o = JSON.parse(localStorage.getItem(key) || 'null'); return o && Date.now() - o.t < TTL ? o.d : null; } catch (e) { return null; }
  }
  function show(a) {
    if (!a || !(a.current_price > 0)) return;
    var supply = a.total_supply || a.circulating_supply;
    set('home-price', usd(a.current_price));
    if (typeof a.price_change_percentage_24h === 'number') set('home-change', pct(a.price_change_percentage_24h));
    if (supply > 0) { set('home-mcap', usd(a.current_price * supply)); set('home-x100', usd(a.current_price * supply * 100)); }
  }
  if (!document.querySelector('[data-v="home-price"]')) return;
  // the price page keeps a list of coins under this key; reuse it while it is fresh
  var cached = fresh('pf-price-markets-v3');
  cached = cached && cached.filter(function (c) { return c.id === 'pepecoin-network' && !c.top; })[0] || fresh('pf-home-v1');
  if (cached) { show(cached); return; }
  fetch(API).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (list) {
    var a = list && list[0];
    if (!a) return;
    var d = { current_price: a.current_price, total_supply: a.total_supply, circulating_supply: a.circulating_supply, price_change_percentage_24h: a.price_change_percentage_24h };
    try { localStorage.setItem('pf-home-v1', JSON.stringify({ t: Date.now(), d: d })); } catch (e) { /* storage unavailable */ }
    show(d);
  }).catch(function () { /* keep the baked figures */ });
})();
