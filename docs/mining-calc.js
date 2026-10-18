// Mining calculator on mining.html: your share of the network hashrate x blocks per day x 10,000 PEP, minus the pool fee.
// Blocks per day come from the daily snapshot (data/network.json, last 30 days); the number in the HTML is the fallback.
(function () {
  var box = document.querySelector('.mcalc');
  if (!box) return;
  var REWARD = 10000;
  var lang = (document.documentElement.lang || 'en').toLowerCase().split('-')[0];
  var GROUP = { pl: ' ', es: ' ', fr: ' ' };
  var $ = function (id) { return document.getElementById(id); };
  var bpdEl = $('mc-bpd');
  var bpd = parseFloat(bpdEl.getAttribute('data-bpd')) || 1379;

  function fmt(v, digits) {
    var s = new Intl.NumberFormat(lang, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
    if (GROUP[lang]) s = s.replace(/[\s.  ](?=\d{3}(\D|$))/g, GROUP[lang]);
    return s;
  }
  function num(id) { var v = parseFloat(String($(id).value).replace(',', '.')); return isFinite(v) ? v : NaN; }

  function calc() {
    var mine = num('mc-hash') * parseFloat($('mc-hash-u').value);
    var net = num('mc-net') * parseFloat($('mc-net-u').value);
    var fee = num('mc-fee'); if (!(fee >= 0 && fee < 100)) fee = 0;
    var ok = mine > 0 && net > 0 && mine < net;
    var day = ok ? mine / net * bpd * REWARD * (1 - fee / 100) : NaN;
    [['mc-day', 1], ['mc-week', 7], ['mc-month', 30]].forEach(function (r) {
      var v = day * r[1];
      $(r[0]).textContent = ok ? fmt(v, v < 100 ? 1 : 0) + ' PEP' : '—';
    });
  }

  box.querySelectorAll('[data-gh]').forEach(function (b) {
    b.addEventListener('click', function () {
      $('mc-hash').value = b.getAttribute('data-gh');
      $('mc-hash-u').value = '1e9';
      calc();
    });
  });
  box.querySelectorAll('input, select').forEach(function (el) { el.addEventListener('input', calc); el.addEventListener('change', calc); });
  calc();

  var base = (document.currentScript && document.currentScript.src) || location.href;
  // Network hashrate from the daily file (PepeBlocks getnetworkhashps); the visitor can still type their own.
  fetch(new URL('data/mining.json', base).href)
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (m) {
      var th = m.hashrate_hs / 1e12;
      if (!(th > 0)) return;
      if (!$('mc-net').value) { $('mc-net').value = String(Math.round(th * 10) / 10); $('mc-net-u').value = '1e12'; calc(); }
      $('mc-src').textContent = ' · PepeBlocks, ' + m.date + ': ' + fmt(th / 1000, 2) + ' PH/s';
    })
    .catch(function () { /* the visitor types the hashrate in */ });
  fetch(new URL('data/network.json', base).href)
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) {
      var c = d.columns, rows = d.rows, h = c.indexOf('height'), t = c.indexOf('time');
      var a = rows[Math.max(0, rows.length - 31)], b = rows[rows.length - 1];
      var days = (b[t] - a[t]) / 86400, blocks = b[h] - a[h];
      if (days > 1 && blocks > 0) {
        bpd = blocks / days;
        bpdEl.textContent = fmt(Math.round(bpd), 0);
        calc();
      }
    })
    .catch(function () { /* keep the fallback in the page */ });
})();
