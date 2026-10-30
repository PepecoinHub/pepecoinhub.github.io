// Shared quote source for the home tiles, ticker and price page.
(function () {
  'use strict';
  var base = new URL('.', document.currentScript.src).href;
  var API = 'https://api.coingecko.com/api/v3/';
  var TTL = 10 * 60 * 1000, pending, requested = 0;
  function json(url) {
    return fetch(url, { cache: 'no-cache', signal: AbortSignal.timeout(15000) }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  function recent(t, age) { return isFinite(t) && Date.now() - t >= -60000 && Date.now() - t < age; }
  var file = json(base + 'data/price-live.json').then(function (f) {
    return f && recent(Date.parse(f.generated_at), 3 * 3600000) ? f : null;
  }).catch(function () { return null; });
  function markets() {
    if (pending && recent(requested, TTL)) return pending;
    requested = Date.now();
    pending = file.then(function (f) {
      if (f && recent(Date.parse(f.generated_at), 3 * 3600000) && f.markets && f.markets.some(function (c) { return c.id === 'pepecoin-network' && c.current_price > 0; })) {
        return { d: f.markets, t: Date.parse(f.generated_at) };
      }
      try {
        var cached = JSON.parse(localStorage.getItem('pf-price-markets-v3'));
        if (cached && recent(cached.t, TTL)) return cached;
      } catch (e) { /* storage unavailable */ }
      return Promise.all([
        json(API + 'coins/markets?vs_currency=usd&ids=pepecoin-network,dogecoin,monacoin,bellscoin,dingocoin,luckycoin,junkcoin'),
        json(API + 'coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1')
      ]).then(function (r) {
        var result = { t: Date.now(), d: r[0].concat(r[1].map(function (c) { return Object.assign({}, c, { top: true }); })) };
        if (!result.d.some(function (c) { return c.id === 'pepecoin-network' && c.current_price > 0; })) throw new Error('no PEP quote');
        try { localStorage.setItem('pf-price-markets-v3', JSON.stringify(result)); } catch (e) {}
        return result;
      });
    });
    pending.catch(function () { pending = null; });
    return pending;
  }
  function quote() {
    return markets().then(function (result) {
      var a = result.d.filter(function (c) { return c.id === 'pepecoin-network' && !c.top; })[0];
      if (!a || !(a.current_price > 0)) throw new Error('no PEP quote');
      return { usd: a.current_price, change_24h: a.price_change_percentage_24h,
        supply: a.total_supply || a.circulating_supply, time: new Date(result.t).toISOString(),
        caps: result.d.filter(function (c) { return c.top && c.id !== 'pepecoin-network' && c.market_cap > 0; }).map(function (c) { return c.market_cap; }).sort(function (a, b) { return b - a; }) };
    }).catch(function () {
      return json(base + 'data/price.json').then(function (p) {
        if (!(p.price_usd > 0)) throw new Error('no saved PEP quote');
        return { usd: p.price_usd, change_24h: p.change_24h, supply: p.supply,
          time: p.updated_at || p.date, caps: p.top_caps, saved: true };
      });
    });
  }
  function describe(q, locale) {
    var key = locale.slice(0, 2), labels = {
      en: ['Updated', 'Saved quote'], pl: ['Aktualizacja', 'Zapisana cena'],
      es: ['Actualizado', 'Precio guardado'], de: ['Aktualisiert', 'Gespeicherter Kurs'],
      fr: ['Mis à jour', 'Cours enregistré'], tr: ['Güncellendi', 'Kayıtlı fiyat'],
      it: ['Aggiornato', 'Prezzo salvato'], zh: ['更新于', '已保存价格']
    };
    return (labels[key] || labels.en)[q.saved ? 1 : 0] + ': ' + new Date(q.time).toLocaleString(locale);
  }
  window.PepPrices = { file: file, markets: markets, quote: quote, describe: describe };
})();
