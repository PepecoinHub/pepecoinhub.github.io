/* Press kit page: its own small bar (day/night, language), copy buttons and the running frog. */
(function () {
  'use strict';
  var root = document.documentElement;
  var lang = (root.lang || 'en').slice(0, 2);
  var COPIED = { en: 'Copied', pl: 'Skopiowano', es: 'Copiado', de: 'Kopiert', fr: 'Copié', tr: 'Kopyalandı', it: 'Copiato', zh: '已复制' };

  function refreshQuotes() {
    window.PepPrices.quote().then(function (q) {
      var loc = root.lang || 'en', money = function (v) { return new Intl.NumberFormat(loc, {
        style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol',
        notation: v >= 1e5 ? 'compact' : 'standard', maximumSignificantDigits: 3
      }).format(v); };
      var values = { 'press-price': money(q.usd), 'press-mcap': money(q.usd * q.supply),
        'press-price-date': window.PepPrices.describe(q, loc) };
      document.querySelectorAll('[data-v]').forEach(function (el) {
        var key = el.getAttribute('data-v'); if (key in values) el.textContent = values[key];
      });
    }).catch(function () { /* The dated generated snapshot remains visible. */ });
  }
  window.PepPrices.subscribe(refreshQuotes);

  // Day / night: the moon by day, the sun at night; remembered like on the rest of the site.
  function dark() {
    var th = root.getAttribute('data-theme');
    return th === 'dark' || (th !== 'light' && !!window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  }
  var tb = document.querySelector('[data-pk-theme]');
  if (tb) {
    var paint = function () { tb.textContent = dark() ? '☀️' : '🌙'; };
    paint();
    tb.addEventListener('click', function () {
      var next = dark() ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('phw-theme', next); } catch (e) {}
      paint();
    });
  }

  // Language menu: close on a click outside or Escape.
  var lm = document.querySelector('.pk-lang');
  if (lm) {
    document.addEventListener('click', function (e) { if (lm.open && !lm.contains(e.target)) lm.open = false; });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') lm.open = false; });
  }

  document.querySelectorAll('button[data-copy]').forEach(function (btn) {
    var el = document.getElementById(btn.getAttribute('data-copy')), label = btn.textContent;
    if (!el) return;
    btn.addEventListener('click', function () {
      var done = function () { btn.textContent = COPIED[lang] || COPIED.en; setTimeout(function () { btn.textContent = label; }, 1600); };
      var pick = function () { var r = document.createRange(); r.selectNodeContents(el); var s = getSelection(); s.removeAllRanges(); s.addRange(r); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(el.textContent.trim()).then(done, pick);
      else pick();
    });
  });

  // The frog runs down beside the scrollbar as you read; a click opens the meme edition.
  var frog = document.querySelector('.pk-frog');
  if (!frog) return;
  frog.hidden = false;
  frog.addEventListener('click', function () { try { localStorage.setItem('hub-mode', 'meme'); } catch (e) {} });
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var lastY = scrollY, timer = 0, queued = false;
  function place() {
    queued = false;
    var max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    var p = Math.min(1, Math.max(0, scrollY / max));
    frog.style.setProperty('--p', p.toFixed(4));
    // On a phone the bubble only greets at the top, so it does not sit over the text.
    frog.classList.toggle('quiet', scrollY > 60 && innerWidth <= 560);
    if (still) return;
    var dy = scrollY - lastY;
    lastY = scrollY;
    if (!dy) return;
    frog.classList.toggle('up', dy < 0);
    frog.classList.add('run');
    clearTimeout(timer);
    timer = setTimeout(function () { frog.classList.remove('run'); }, 260);
  }
  function onScroll() { if (!queued) { queued = true; requestAnimationFrame(place); } }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  place();
})();
