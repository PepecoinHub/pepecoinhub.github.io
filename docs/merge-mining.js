// Merge-mining page: what a Scrypt miner adds in PEP on a pool that merge-mines Pepecoin.
// Your share of the PEP network hashrate x blocks per day x 10,000 PEP, minus the pool fee; dollars at the price field.
// Network hashrate: data/mining.json; blocks per day: data/network.json (last 30 days); price: the site's published
// quote (PepPrices from prices.js, else data/price.json). No outside API is called from the browser.
(function () {
  var box = document.querySelector('.mm-calc');
  if (!box) return;
  var REWARD = 10000;
  var lang = (document.documentElement.lang || 'en').toLowerCase().split('-')[0];
  var GROUP = { pl: ' ', es: ' ', fr: ' ' };
  var $ = function (id) { return document.getElementById(id); };
  var bpd = parseFloat($('mm-bpd').getAttribute('data-bpd')) || 1379;
  var netHs = parseFloat($('mm-net').getAttribute('data-hs')) || 2.1e15;
  var priceTouched = false;

  function fmt(v, digits) {
    var s = new Intl.NumberFormat(lang, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
    if (GROUP[lang]) s = s.replace(/[\s.  ](?=\d{3}(\D|$))/g, GROUP[lang]);
    return s;
  }
  function usd(v) {
    var d = v >= 100 ? 0 : v >= 1 ? 2 : v >= 0.01 ? 3 : 4;
    return '$' + fmt(v, d);
  }
  function val(id) { var v = parseFloat(String($(id).value).replace(',', '.')); return isFinite(v) ? v : NaN; }

  function calc() {
    var mine = val('mm-hash') * 1e9 * Math.max(1, Math.round(val('mm-n')) || 1);
    var fee = val('mm-fee'), price = val('mm-price');
    var ok = mine > 0 && mine < netHs && fee >= 0 && fee < 100;
    $('mm-fee').setAttribute('aria-invalid', String(!(fee >= 0 && fee < 100)));
    var day = ok ? mine / netHs * bpd * REWARD * (1 - fee / 100) : NaN;
    [['mm-day', 'mm-usd-d', 1], ['mm-month', 'mm-usd-m', 30], ['mm-year', 'mm-usd-y', 365]].forEach(function (r) {
      var v = day * r[2];
      $(r[0]).textContent = ok ? fmt(v, v < 100 ? 1 : 0) + ' PEP' : '—';
      $(r[1]).textContent = ok && price >= 0 ? '≈ ' + usd(v * price) : '—';
    });
    var hs = String(val('mm-hash'));
    box.querySelectorAll('[data-gh]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-gh') === hs)); });
  }

  box.querySelectorAll('[data-gh]').forEach(function (b) {
    b.addEventListener('click', function () { $('mm-hash').value = b.getAttribute('data-gh'); calc(); });
  });
  box.querySelectorAll('input').forEach(function (el) { el.addEventListener('input', calc); });
  $('mm-price').addEventListener('input', function () { priceTouched = true; });
  calc();

  var base = (document.currentScript && document.currentScript.src) || location.href;
  function get(path) {
    return fetch(new URL(path, base).href).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  get('data/mining.json').then(function (m) {
    if (!(m.hashrate_hs > 0)) return;
    netHs = m.hashrate_hs;
    var ph = fmt(netHs / 1e15, 2);
    $('mm-net').textContent = ph;
    $('mm-net-v').textContent = ph + ' PH/s';
    $('mm-net-d').textContent = m.date;
    calc();
  }).catch(function () { /* keep the figure in the page */ });
  get('data/network.json').then(function (d) {
    var c = d.columns, rows = d.rows, h = c.indexOf('height'), t = c.indexOf('time');
    var a = rows[Math.max(0, rows.length - 31)], b = rows[rows.length - 1];
    var days = (b[t] - a[t]) / 86400, blocks = b[h] - a[h];
    if (days > 1 && blocks > 0) { bpd = blocks / days; $('mm-bpd').textContent = fmt(Math.round(bpd), 0); calc(); }
  }).catch(function () { /* keep the fallback */ });

  function setPrice(p, when) {
    if (!(p > 0)) return;
    if (!priceTouched) { $('mm-price').value = String(p); calc(); }
    $('mm-price-d').textContent = '$' + new Intl.NumberFormat(lang, { maximumSignificantDigits: 4 }).format(p) + ', ' + String(when).slice(0, 10);
  }
  if (window.PepPrices && window.PepPrices.subscribeQuote) {
    window.PepPrices.subscribeQuote(function (q) { setPrice(q.usd, q.time); });
  } else {
    get('data/price.json').then(function (p) { setPrice(p.price_usd, p.updated_at || p.date); }).catch(function () {});
  }
})();
