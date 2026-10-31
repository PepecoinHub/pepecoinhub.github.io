// One published snapshot for both editions, calculators and the market page.
// Do not fetch independent current quotes in the browser.
(function () {
  'use strict';
  var base = new URL('.', document.currentScript.src).href;
  var TTL = 60000, pending, requested = 0, listeners = [], version;
  function json(url) {
    return fetch(url, { cache: 'no-cache', signal: AbortSignal.timeout(15000) }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  var file = json(base + 'data/price-live.json').then(function (f) {
    return f && Date.now() - Date.parse(f.generated_at) < 3 * 3600000 ? f : null;
  }).catch(function () { return null; }); // charts only
  function markets() {
    if (pending && Date.now() - requested < TTL) return pending;
    requested = Date.now();
    pending = json(base + 'data/market-prices.json').then(function (f) {
      if (!f || !Array.isArray(f.markets) || !isFinite(Date.parse(f.generated_at))) throw new Error('no market snapshot');
      var by = {};
      f.markets.forEach(function (c) { if (c && c.id && c.current_price > 0 && (!by[c.id] || !c.top)) by[c.id] = Object.assign({}, c); });
      var pep = by['pepecoin-network'];
      if (!pep) throw new Error('no PEP quote');
      // Issued on-chain supply differs from the aggregator's reported supply.
      if (f.pep_supply) {
        var supply = f.pep_supply.value;
        if (supply > 0) {
          pep.reported_market_cap = pep.market_cap; pep.reported_supply = pep.total_supply || pep.circulating_supply;
          pep.total_supply = supply; pep.market_cap = pep.current_price * supply;
          pep.supply_time = f.pep_supply.time;
        }
      }
      pep.top = false;
      return { d: Object.keys(by).map(function (id) { return by[id]; }), t: Date.parse(pep.last_updated || f.generated_at), version: f.generated_at + ':' + (pep.supply_time || ''),
        saved: Date.now() - Date.parse(pep.last_updated || f.generated_at) > 3 * 3600000 };
    }).catch(function () {
      return json(base + 'data/price.json').then(function (p) {
        if (!(p.price_usd > 0)) throw new Error('no saved PEP quote');
        return { t: Date.parse(p.updated_at || p.date), version: (p.updated_at || p.date) + ':saved', saved: true, d: [{ id: 'pepecoin-network', symbol: 'pep', name: 'Pepecoin',
          current_price: p.price_usd, price_change_percentage_24h: p.change_24h, total_supply: p.supply,
          market_cap: p.price_usd * p.supply, supply_time: p.supply_time, top: false }] };
      });
    });
    pending.catch(function () { pending = null; });
    return pending;
  }
  function quote() {
    return markets().then(function (result) {
      var a = result.d.filter(function (c) { return c.id === 'pepecoin-network'; })[0];
      return { usd: a.current_price, change_24h: a.price_change_percentage_24h, supply: a.total_supply || a.circulating_supply,
        mcap: a.market_cap, supply_time: a.supply_time, time: new Date(result.t).toISOString(), saved: result.saved,
        caps: result.d.filter(function (c) { return c.top && c.market_cap > 0; }).map(function (c) { return c.market_cap; }).sort(function (a, b) { return b - a; }) };
    });
  }
  function describe(q, locale) {
    var labels = {
      en: ['Updated', 'Saved quote'], pl: ['Aktualizacja', 'Zapisana cena'], es: ['Actualizado', 'Precio guardado'],
      de: ['Aktualisiert', 'Gespeicherter Kurs'], fr: ['Mis à jour', 'Cours enregistré'], tr: ['Güncellendi', 'Kayıtlı fiyat'],
      it: ['Aggiornato', 'Prezzo salvato'], zh: ['更新于', '已保存价格']
    };
    return (labels[locale.slice(0, 2)] || labels.en)[q.saved ? 1 : 0] + ': ' + new Date(q.time || q.t).toLocaleString(locale);
  }
  function subscribe(fn) {
    listeners.push(fn);
    markets().then(fn).catch(function () { /* The dated page fallback remains. */ });
  }
  function refresh() {
    if (document.hidden || !listeners.length) return;
    markets().then(function (result) {
      if (result.version === version) return;
      version = result.version;
      listeners.forEach(function (fn) { fn(result); });
    }).catch(function () { /* Retry at the next poll without inventing a fresh timestamp. */ });
  }
  setInterval(refresh, TTL);
  document.addEventListener('visibilitychange', refresh);
  window.PepPrices = { file: file, markets: markets, quote: quote, describe: describe, subscribe: subscribe };
})();
