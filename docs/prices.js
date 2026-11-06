// One published snapshot for both editions, calculators and the market page.
// Do not fetch independent current quotes in the browser.
(function () {
  'use strict';
  var base = new URL('.', document.currentScript.src).href;
  var TTL = 5 * 60000, pending, requested = 0, listeners = [], version;
  function json(url) {
    return fetch(url, { cache: 'no-cache', signal: AbortSignal.timeout(15000) }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  // the chart file (about 40 KB) is only fetched when a chart asks for it (PepPrices.file), not on every page
  var fileP = null;
  function chartFile() {
    if (!fileP) fileP = json(base + 'data/price-live.json').then(function (f) {
      return f && Date.now() - Date.parse(f.generated_at) < 3 * 3600000 ? f : null;
    }).catch(function () { return null; }); // charts only
    return fileP;
  }
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
      var measured = Date.parse(pep.last_updated || f.generated_at), saved = Date.now() - measured > 3 * 3600000;
      return { d: Object.keys(by).map(function (id) { return by[id]; }), t: measured,
        version: f.generated_at + ':' + (pep.supply_time || '') + ':' + saved, saved: saved };
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
  // PEP alone (price, 24h change, on-chain supply, top caps for the rank) for widgets that show nothing else,
  // like the PondOS tray and ticker: data/price.json (about 4 KB) is written by scripts/fetch_quotes.py together
  // with market-prices.json (about 80 KB), so it has the same quote and time. A page that already loaded the
  // full list reuses it; if price.json fails, the full list is used as before.
  var pepPending, pepRequested = 0, pepListeners = [], pepVersion;
  function pepQuote() {
    if (pending && Date.now() - requested < TTL) return quote();
    if (pepPending && Date.now() - pepRequested < TTL) return pepPending;
    pepRequested = Date.now();
    pepPending = json(base + 'data/price.json').then(function (p) {
      var t = Date.parse(p.updated_at || p.date);
      if (!(p.price_usd > 0) || !(p.supply > 0) || !isFinite(t)) throw new Error('no PEP quote');
      return { usd: p.price_usd, change_24h: p.change_24h, supply: p.supply, mcap: p.price_usd * p.supply,
        supply_time: p.supply_time, time: new Date(t).toISOString(), saved: Date.now() - t > 3 * 3600000,
        caps: (Array.isArray(p.top_caps) ? p.top_caps : []).filter(function (c) { return c > 0; }).sort(function (a, b) { return b - a; }) };
    }).catch(function () { pepPending = null; return quote(); });
    return pepPending;
  }
  function subscribeQuote(fn) {
    pepListeners.push(fn);
    pepQuote().then(function (q) { pepVersion = q.time + ':' + (q.supply_time || '') + ':' + q.saved; fn(q); }).catch(function () { /* The dated page fallback remains. */ });
  }
  function refreshQuote() {
    if (document.hidden || !pepListeners.length) return;
    pepQuote().then(function (q) {
      var v = q.time + ':' + (q.supply_time || '') + ':' + q.saved;
      if (v === pepVersion) return;
      pepVersion = v;
      pepListeners.forEach(function (fn) { fn(q); });
    }).catch(function () { /* Retry at the next poll. */ });
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
  setInterval(function () { refresh(); refreshQuote(); }, TTL);
  document.addEventListener('visibilitychange', function () { refresh(); refreshQuote(); });
  window.PepPrices = { markets: markets, quote: quote, describe: describe, subscribe: subscribe, pepQuote: pepQuote, subscribeQuote: subscribeQuote };
  Object.defineProperty(window.PepPrices, 'file', { get: chartFile, enumerable: true });
})();
