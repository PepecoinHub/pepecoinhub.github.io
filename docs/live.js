// Fills [data-live] numbers from the daily snapshot (data/network.json), so hand-written figures stay current.
// The text in the HTML is the fallback for search engines and for visitors without JavaScript.
(function () {
  var nodes = document.querySelectorAll('[data-live]');
  if (!nodes.length) return;
  var ISSUANCE = 5256000000; // 525,600 blocks a year x 10,000 PEP
  var lang = (document.documentElement.lang || 'en').toLowerCase();
  // Thousands separator used in the page text for each language (Intl's own choice differs for some).
  var GROUP = { pl: ' ', es: ' ', fr: ' ' };

  function fmt(v, digits) {
    var s = new Intl.NumberFormat(lang, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
    if (GROUP[lang.split('-')[0]]) s = s.replace(/[\s.  ](?=\d{3}(\D|$))/g, GROUP[lang.split('-')[0]]);
    return s;
  }
  function render(row) {
    var supply = row.supply, date = new Date(row.time * 1000);
    var values = {
      'supply-b': fmt(supply / 1e9, 1),                // 104.8 (billion)
      'supply-m': fmt(Math.round(supply / 1e8) * 100, 0), // 104 800 (million, Spanish)
      'supply-yi': String(Math.round(supply / 1e8)),     // 1048 (亿)
      'inflation': fmt(Math.round(ISSUANCE / supply * 100), 0),
      'addresses': fmt(row.addresses, 0),
      'height': fmt(row.height, 0),
      'year': String(date.getUTCFullYear())
    };
    nodes.forEach(function (el) {
      var v = values[el.getAttribute('data-live')];
      if (v) el.textContent = v;
    });
  }

  var base = (document.currentScript && document.currentScript.src) || location.href;
  fetch(new URL('data/network.json', base).href)
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) {
      var c = d.columns, last = d.rows[d.rows.length - 1];
      render({
        height: last[c.indexOf('height')],
        supply: last[c.indexOf('supply_pep')],
        addresses: last[c.indexOf('addresses_with_balance')],
        time: last[c.indexOf('time')]
      });
    })
    .catch(function () { /* keep the numbers already in the page */ });
})();
