// Market page: Bitcoin, Litecoin, Dogecoin and Pepecoin side by side, a chart with an optional second coin,
// and the backdrop of the whole market (Fear & Greed, Bitcoin DVOL, stablecoin supply, total market cap).
// Reads data/market-live.json (scripts/fetch_market.py, every hour) and asks the APIs itself only for what is missing.
// Words for each language are in T; the page's <html lang> picks one.
(function () {
  'use strict';
  var COINS = ['bitcoin', 'litecoin', 'dogecoin', 'pepecoin-network'];
  var TICK = { bitcoin: 'BTC', litecoin: 'LTC', dogecoin: 'DOGE', 'pepecoin-network': 'PEP' };
  var CG = 'https://api.coingecko.com/api/v3/';

  var T = {
    en: { loc: 'en-US', names: { bitcoin: 'Bitcoin', litecoin: 'Litecoin', dogecoin: 'Dogecoin', 'pepecoin-network': 'Pepecoin' },
      sBtc: 'Bitcoin season', sAlt: 'Altcoin season', sNone: 'Neither season', sBeat: '{n} of {of} beat Bitcoin',
      allUp: 'All 4 up today', allDown: 'All 4 down today', some: '{n} of 4 up today', avg: 'on average',
      d7: '7d', d30: '30d', today: 'today', none: 'Nothing', vs: 'vs {c}',
      change: 'Change', high: 'High', low: 'Low', loading: 'Loading the chart…',
      fail: 'The chart could not be loaded right now (CoinGecko limits free requests). Try again in a minute.',
      nodata: 'No data right now', live: 'Prices from CoinGecko, updated {t}.',
      fng: ['Extreme fear', 'Fear', 'Neutral', 'Greed', 'Extreme greed'],
      dvol: ['Calm', 'Normal', 'High', 'Very high'], vol: 'Volume 24h {v}', dom: 'BTC' },
    pl: { loc: 'pl-PL', names: { bitcoin: 'Bitcoin', litecoin: 'Litecoin', dogecoin: 'Dogecoin', 'pepecoin-network': 'Pepecoin' },
      sBtc: 'Sezon Bitcoina', sAlt: 'Sezon altcoinów', sNone: 'Żaden sezon', sBeat: '{n} z {of} lepiej niż Bitcoin',
      allUp: 'Dziś wszystkie 4 w górę', allDown: 'Dziś wszystkie 4 w dół', some: 'Dziś {n} z 4 w górę', avg: 'średnio',
      d7: '7 dni', d30: '30 dni', today: 'dziś', none: 'Nic', vs: 'vs {c}',
      change: 'Zmiana', high: 'Najwyżej', low: 'Najniżej', loading: 'Wczytuję wykres…',
      fail: 'Nie udało się teraz wczytać wykresu (CoinGecko ogranicza darmowe zapytania). Spróbuj za minutę.',
      nodata: 'Brak danych w tej chwili', live: 'Ceny z CoinGecko, aktualizacja {t}.',
      fng: ['Skrajny strach', 'Strach', 'Neutralnie', 'Chciwość', 'Skrajna chciwość'],
      dvol: ['Spokojnie', 'Normalnie', 'Wysoka', 'Bardzo wysoka'], vol: 'Obrót 24 h {v}', dom: 'BTC' },
    es: { loc: 'es-ES', names: { bitcoin: 'Bitcoin', litecoin: 'Litecoin', dogecoin: 'Dogecoin', 'pepecoin-network': 'Pepecoin' },
      sBtc: 'Temporada de Bitcoin', sAlt: 'Temporada de altcoins', sNone: 'Ninguna temporada', sBeat: '{n} de {of} superan a Bitcoin',
      allUp: 'Las 4 suben hoy', allDown: 'Las 4 bajan hoy', some: 'Hoy suben {n} de 4', avg: 'de media',
      d7: '7 d', d30: '30 d', today: 'hoy', none: 'Nada', vs: 'vs {c}',
      change: 'Cambio', high: 'Máximo', low: 'Mínimo', loading: 'Cargando el gráfico…',
      fail: 'No se pudo cargar el gráfico ahora (CoinGecko limita las consultas gratuitas). Inténtalo de nuevo en un minuto.',
      nodata: 'Sin datos ahora mismo', live: 'Precios de CoinGecko, actualizado a las {t}.',
      fng: ['Miedo extremo', 'Miedo', 'Neutral', 'Codicia', 'Codicia extrema'],
      dvol: ['Calma', 'Normal', 'Alta', 'Muy alta'], vol: 'Volumen 24 h {v}', dom: 'BTC' },
    de: { loc: 'de-DE', names: { bitcoin: 'Bitcoin', litecoin: 'Litecoin', dogecoin: 'Dogecoin', 'pepecoin-network': 'Pepecoin' },
      sBtc: 'Bitcoin-Saison', sAlt: 'Altcoin-Saison', sNone: 'Keine Saison', sBeat: '{n} von {of} besser als Bitcoin',
      allUp: 'Heute alle 4 im Plus', allDown: 'Heute alle 4 im Minus', some: 'Heute {n} von 4 im Plus', avg: 'im Schnitt',
      d7: '7 T', d30: '30 T', today: 'heute', none: 'Nichts', vs: 'vs {c}',
      change: 'Veränderung', high: 'Hoch', low: 'Tief', loading: 'Chart wird geladen…',
      fail: 'Der Chart konnte gerade nicht geladen werden (CoinGecko begrenzt kostenlose Abfragen). Bitte in einer Minute erneut versuchen.',
      nodata: 'Gerade keine Daten', live: 'Kurse von CoinGecko, aktualisiert um {t}.',
      fng: ['Extreme Angst', 'Angst', 'Neutral', 'Gier', 'Extreme Gier'],
      dvol: ['Ruhig', 'Normal', 'Hoch', 'Sehr hoch'], vol: 'Volumen 24 h {v}', dom: 'BTC' },
    fr: { loc: 'fr-FR', names: { bitcoin: 'Bitcoin', litecoin: 'Litecoin', dogecoin: 'Dogecoin', 'pepecoin-network': 'Pepecoin' },
      sBtc: 'Saison du Bitcoin', sAlt: 'Saison des altcoins', sNone: 'Aucune saison', sBeat: '{n} sur {of} font mieux que le Bitcoin',
      allUp: 'Les 4 en hausse aujourd’hui', allDown: 'Les 4 en baisse aujourd’hui', some: '{n} sur 4 en hausse aujourd’hui', avg: 'en moyenne',
      d7: '7 j', d30: '30 j', today: 'aujourd’hui', none: 'Rien', vs: 'vs {c}',
      change: 'Variation', high: 'Plus haut', low: 'Plus bas', loading: 'Chargement du graphique…',
      fail: 'Le graphique n’a pas pu être chargé (CoinGecko limite les requêtes gratuites). Réessayez dans une minute.',
      nodata: 'Pas de données pour l’instant', live: 'Prix de CoinGecko, mis à jour à {t}.',
      fng: ['Peur extrême', 'Peur', 'Neutre', 'Avidité', 'Avidité extrême'],
      dvol: ['Calme', 'Normale', 'Élevée', 'Très élevée'], vol: 'Volume 24 h {v}', dom: 'BTC' },
    tr: { loc: 'tr-TR', names: { bitcoin: 'Bitcoin', litecoin: 'Litecoin', dogecoin: 'Dogecoin', 'pepecoin-network': 'Pepecoin' },
      sBtc: 'Bitcoin sezonu', sAlt: 'Altcoin sezonu', sNone: 'Sezon yok', sBeat: '{of} coinden {n} tanesi Bitcoin’i geçti',
      allUp: 'Bugün 4’ü de yükselişte', allDown: 'Bugün 4’ü de düşüşte', some: 'Bugün 4 coinden {n} tanesi yükselişte', avg: 'ortalama',
      d7: '7 g', d30: '30 g', today: 'bugün', none: 'Hiçbiri', vs: 'vs {c}',
      change: 'Değişim', high: 'En yüksek', low: 'En düşük', loading: 'Grafik yükleniyor…',
      fail: 'Grafik şu anda yüklenemedi (CoinGecko ücretsiz istekleri sınırlıyor). Bir dakika sonra tekrar deneyin.',
      nodata: 'Şu anda veri yok', live: 'Fiyatlar CoinGecko’dan, güncelleme {t}.',
      fng: ['Aşırı korku', 'Korku', 'Nötr', 'Açgözlülük', 'Aşırı açgözlülük'],
      dvol: ['Sakin', 'Normal', 'Yüksek', 'Çok yüksek'], vol: '24 saatlik hacim {v}', dom: 'BTC' },
    it: { loc: 'it-IT', names: { bitcoin: 'Bitcoin', litecoin: 'Litecoin', dogecoin: 'Dogecoin', 'pepecoin-network': 'Pepecoin' },
      sBtc: 'Stagione di Bitcoin', sAlt: 'Stagione delle altcoin', sNone: 'Nessuna stagione', sBeat: '{n} su {of} meglio di Bitcoin',
      allUp: 'Oggi tutte e 4 in rialzo', allDown: 'Oggi tutte e 4 in calo', some: 'Oggi {n} su 4 in rialzo', avg: 'in media',
      d7: '7 g', d30: '30 g', today: 'oggi', none: 'Nessuna', vs: 'vs {c}',
      change: 'Variazione', high: 'Massimo', low: 'Minimo', loading: 'Caricamento del grafico…',
      fail: 'Non è stato possibile caricare il grafico (CoinGecko limita le richieste gratuite). Riprova tra un minuto.',
      nodata: 'Nessun dato al momento', live: 'Prezzi da CoinGecko, aggiornati alle {t}.',
      fng: ['Paura estrema', 'Paura', 'Neutrale', 'Avidità', 'Avidità estrema'],
      dvol: ['Calma', 'Normale', 'Alta', 'Molto alta'], vol: 'Volume 24 h {v}', dom: 'BTC' },
    zh: { loc: 'zh-CN', names: { bitcoin: '比特币', litecoin: '莱特币', dogecoin: '狗狗币', 'pepecoin-network': 'Pepecoin' },
      sBtc: '比特币季节', sAlt: '山寨币季节', sNone: '两者皆非', sBeat: '{of} 个中有 {n} 个跑赢比特币',
      allUp: '今天 4 个全部上涨', allDown: '今天 4 个全部下跌', some: '今天 4 个中有 {n} 个上涨', avg: '平均',
      d7: '7 天', d30: '30 天', today: '今天', none: '不比较', vs: '对比 {c}',
      change: '涨跌', high: '最高', low: '最低', loading: '正在加载图表…',
      fail: '暂时无法加载图表（CoinGecko 限制免费请求）。请一分钟后再试。',
      nodata: '暂无数据', live: '价格来自 CoinGecko，更新于 {t}。',
      fng: ['极度恐惧', '恐惧', '中性', '贪婪', '极度贪婪'],
      dvol: ['平静', '正常', '偏高', '很高'], vol: '24 小时成交额 {v}', dom: 'BTC' }
  };
  var lang = (document.documentElement.lang || 'en').slice(0, 2).toLowerCase();
  var t = T[lang] || T.en;
  var L = t.loc;
  function fill(s, o) { return s.replace(/\{(\w+)\}/g, function (m, k) { return o[k] != null ? o[k] : m; }); }
  function $(id) { return document.getElementById(id); }

  // ---- number formats ----
  function usd(v) {
    if (v == null || !isFinite(v)) return '—';
    var o = v >= 1 ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumSignificantDigits: 4, minimumSignificantDigits: 4 };
    o.style = 'currency'; o.currency = 'USD';
    return new Intl.NumberFormat(L, o).format(v);
  }
  function big(v) {
    if (v == null || !isFinite(v)) return '—';
    return new Intl.NumberFormat(L, { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 }).format(v);
  }
  function pct(v, digits) {
    if (v == null || !isFinite(v)) return '—';
    var s = new Intl.NumberFormat(L, { minimumFractionDigits: digits == null ? 2 : digits, maximumFractionDigits: digits == null ? 2 : digits }).format(Math.abs(v));
    return (v > 0 ? '+' : v < 0 ? '−' : '') + s + '%';
  }
  function dir(v) { return v > 0 ? 'up' : v < 0 ? 'down' : 'flat'; }
  function arrow(v) { return v > 0 ? '▲ ' : v < 0 ? '▼ ' : ''; }

  // ---- data: the robot's file first, the APIs in the browser for anything it lacks ----
  var FILE_MAX_AGE = 3 * 60 * 60 * 1000;
  var BASE = (function () { var s = document.currentScript && document.currentScript.src; try { return new URL('.', s || location.href).href; } catch (e) { return ''; } })();
  function getJSON(url) { return fetch(url).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }); }
  var fileP = fetch(BASE + 'data/market-live.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (f) {
    if (!f || !f.generated_at) return null;
    f.t = Date.parse(f.generated_at);
    return Date.now() - f.t < FILE_MAX_AGE ? f : null;
  }).catch(function () { return null; });


  function liveGlobal() {
    return getJSON(CG + 'global').then(function (j) {
      var d = j.data;
      return { mcap: d.total_market_cap.usd, vol: d.total_volume.usd, ch24: d.market_cap_change_percentage_24h_usd, btc: d.market_cap_percentage.btc };
    });
  }
  function liveFng() {
    return getJSON('https://api.alternative.me/fng/?limit=31').then(function (j) {
      var rows = (j.data || []).slice().reverse();
      return { value: +rows[rows.length - 1].value, series: rows.map(function (x) { return [x.timestamp * 1000, +x.value]; }) };
    });
  }
  function liveStable() {
    return getJSON('https://stablecoins.llama.fi/stablecoincharts/all').then(function (j) {
      var rows = j.slice(-31).filter(function (x) { return x.totalCirculatingUSD && x.totalCirculatingUSD.peggedUSD; });
      var s = rows.map(function (x) { return [x.date * 1000, x.totalCirculatingUSD.peggedUSD]; });
      return { value: s[s.length - 1][1], series: s };
    });
  }
  function liveDvol() {
    var end = Date.now();
    return getJSON('https://www.deribit.com/api/v2/public/get_volatility_index_data?currency=BTC&resolution=1D&start_timestamp=' + (end - 31 * 864e5) + '&end_timestamp=' + end).then(function (j) {
      var s = (j.result.data || []).sort(function (a, b) { return a[0] - b[0]; }).map(function (x) { return [x[0], x[4]]; });
      return { value: s[s.length - 1][1], series: s };
    });
  }
  function part(key, live) {
    return fileP.then(function (f) { return f && f[key] ? f[key] : live(); }).catch(function () { return null; });
  }

  // ---- small SVG helpers ----
  var NS = 'http://www.w3.org/2000/svg';
  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  // a sparkline with a soft fill, values only (no axes)
  function spark(box, vals, cls) {
    box.textContent = '';
    vals = (vals || []).map(function (p) { return Array.isArray(p) ? p[1] : p; }).filter(function (v) { return v != null && isFinite(v); });
    if (vals.length < 2) return;
    var w = 200, h = 48, min = Math.min.apply(null, vals), max = Math.max.apply(null, vals), span = max - min || 1;
    var pts = vals.map(function (v, i) { return [(i / (vals.length - 1)) * w, h - 3 - ((v - min) / span) * (h - 8)]; });
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('');
    var svg = el('svg', { viewBox: '0 0 ' + w + ' ' + h, preserveAspectRatio: 'none', 'aria-hidden': 'true', class: 'mk-spark ' + (cls || '') }, box);
    el('path', { d: d + 'L' + w + ' ' + h + 'L0 ' + h + 'Z', class: 'sp-fill' }, svg);
    el('path', { d: d, class: 'sp-line', 'vector-effect': 'non-scaling-stroke' }, svg);
  }

  // ---- the four coin cards ----
  var state = { coin: 'pepecoin-network', days: 7, cmp: '', coins: null, series: {} };
  function renderCards(coins) {
    var up = 0, n = 0, sum = 0;
    COINS.forEach(function (id) {
      var c = coins[id], card = document.querySelector('.mk-card[data-coin="' + id + '"]');
      if (!c || !card) return;
      card.querySelector('.mk-price').textContent = usd(c.price);
      var ch = card.querySelector('.mk-ch');
      ch.textContent = arrow(c.ch24) + pct(c.ch24);
      ch.className = 'mk-ch ' + dir(c.ch24);
      card.querySelector('.mk-7d').textContent = t.d7 + ' ' + pct(c.ch7);
      spark(card.querySelector('.mk-sp'), (c.spark || []), dir(c.ch7));
      if (c.ch24 != null) { n++; sum += c.ch24; if (c.ch24 > 0) up++; }
    });
    if (!n) return;
    var avg = sum / n, mood = $('mk-mood');
    mood.querySelector('.mk-mood-text').textContent = up === n && n === 4 ? t.allUp : up === 0 && n === 4 ? t.allDown : fill(t.some, { n: up });
    var p = mood.querySelector('.mk-mood-avg');
    p.textContent = arrow(avg) + pct(avg) + ' ' + t.avg;
    p.className = 'mk-mood-avg ' + dir(avg);
    mood.querySelector('.mk-dots').innerHTML = COINS.map(function (id) { return '<i class="' + dir(coins[id] && coins[id].ch24) + '"></i>'; }).join('');
    mood.hidden = false;
  }

  // ---- chart ----
  function cut(d, days) {
    if (!d || !d.length) return d;
    var from = d[d.length - 1][0] - days * 864e5;
    return d.filter(function (p) { return p[0] >= from; });
  }
  // CoinGecko gives 5-minute points for 1 day and hourly points for 90 days, so 7 and 30 days are cut from 90
  function seriesFor(id, days) {
    var src = days === 1 ? 1 : 90, key = id + src;
    if (state.series[key]) return Promise.resolve(cut(state.series[key], days));
    return fileP.then(function (f) {
      var d = f && f.series && f.series[id] && f.series[id][String(src)];
      if (d && d.length) return d;
      return getJSON(CG + 'coins/' + id + '/market_chart?vs_currency=usd&days=' + src).then(function (j) { return j.prices; });
    }).then(function (d) { state.series[key] = d; return cut(d, days); });
  }
  function fmtX(ms, days) {
    var o = days === 1 ? { hour: '2-digit', minute: '2-digit' } : { month: 'short', day: 'numeric' };
    return new Intl.DateTimeFormat(L, o).format(new Date(ms));
  }
  function drawChart(main, other) {
    var box = $('mk-chart');
    box.textContent = '';
    // draw at the box's own width, so the axis text keeps its size on a phone
    var W = Math.max(320, Math.min(760, Math.round(box.clientWidth) || 760)), H = W < 500 ? 240 : 300, padL = 8, padR = 104, padT = 14, padB = 30;
    var pctMode = !!other;
    function norm(d) { var b = d[0][1]; return d.map(function (p) { return [p[0], (p[1] / b - 1) * 100]; }); }
    var a = pctMode ? norm(main) : main, b = pctMode ? norm(other) : null;
    var all = a.concat(b || []), t0 = a[0][0], t1 = a[a.length - 1][0];
    var ys = all.map(function (p) { return p[1]; }), min = Math.min.apply(null, ys), max = Math.max.apply(null, ys);
    if (min === max) { min -= 1; max += 1; }
    var span = max - min; min -= span * 0.06; max += span * 0.06;
    function X(tm) { return padL + (tm - t0) / (t1 - t0 || 1) * (W - padL - padR); }
    function Y(v) { return padT + (1 - (v - min) / (max - min)) * (H - padT - padB); }
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': $('mk-chart-title').textContent }, box);
    var defs = el('defs', {}, svg), g = el('linearGradient', { id: 'mkfill', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: '0', class: 'fill-top' }, g); el('stop', { offset: '1', class: 'fill-bot' }, g);
    for (var i = 0; i <= 4; i++) {
      var v = min + (max - min) * i / 4, y = Y(v);
      el('line', { x1: padL, x2: W - padR, y1: y, y2: y, class: 'grid' }, svg);
      el('text', { x: W - padR + 8, y: y + 4, class: 'axis' }, svg).textContent = pctMode ? pct(v, 1) : usd(v);
    }
    if (pctMode && min < 0 && max > 0) el('line', { x1: padL, x2: W - padR, y1: Y(0), y2: Y(0), class: 'zero' }, svg);
    var nx = W < 500 ? 2 : 4;
    for (var k = 0; k <= nx; k++) {
      var tm = t0 + (t1 - t0) * k / nx;
      el('text', { x: X(tm), y: H - 8, class: 'axis', 'text-anchor': k === 0 ? 'start' : k === nx ? 'end' : 'middle' }, svg).textContent = fmtX(tm, state.days);
    }
    function path(d) { return d.map(function (p, i) { return (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1); }).join(''); }
    if (!pctMode) el('path', { d: path(a) + 'L' + X(t1) + ' ' + (H - padB) + 'L' + X(t0) + ' ' + (H - padB) + 'Z', fill: 'url(#mkfill)' }, svg);
    if (b) el('path', { d: path(b.filter(function (p) { return p[0] >= t0 && p[0] <= t1; })), class: 'line cmp' }, svg);
    el('path', { d: path(a), class: 'line main' }, svg);
    // hover / touch readout
    var cross = el('line', { y1: padT, y2: H - padB, class: 'cross', visibility: 'hidden' }, svg);
    var dot = el('circle', { r: 4.5, class: 'dot', visibility: 'hidden' }, svg);
    var tip = $('mk-tip');
    function near(d, tm) { var lo = 0, hi = d.length - 1; while (hi - lo > 1) { var m = (lo + hi) >> 1; if (d[m][0] < tm) lo = m; else hi = m; } return Math.abs(d[lo][0] - tm) < Math.abs(d[hi][0] - tm) ? d[lo] : d[hi]; }
    function move(ev) {
      var r = svg.getBoundingClientRect(), cx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
      var tm = t0 + ((cx / r.width * W) - padL) / (W - padL - padR) * (t1 - t0);
      tm = Math.max(t0, Math.min(t1, tm));
      var p = near(a, tm), raw = near(main, tm), x = X(p[0]);
      cross.setAttribute('x1', x); cross.setAttribute('x2', x); cross.setAttribute('visibility', 'visible');
      dot.setAttribute('cx', x); dot.setAttribute('cy', Y(p[1])); dot.setAttribute('visibility', 'visible');
      var when = new Intl.DateTimeFormat(L, state.days === 1 ? { hour: '2-digit', minute: '2-digit' } : { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(p[0]));
      var txt = when + ' · ' + usd(raw[1]);
      if (b) { var q = near(b, tm); txt += ' · ' + TICK[state.coin] + ' ' + pct(p[1]) + ' / ' + TICK[state.cmp] + ' ' + pct(q[1]); }
      tip.textContent = txt; tip.hidden = false;
      tip.style.left = Math.min(Math.max(x / W * r.width, 70), r.width - 70) + 'px';
    }
    function leave() { cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); tip.hidden = true; }
    svg.addEventListener('mousemove', move); svg.addEventListener('touchmove', move, { passive: true }); svg.addEventListener('touchstart', move, { passive: true });
    svg.addEventListener('mouseleave', leave); svg.addEventListener('touchend', leave);
    // stats under the chart
    var prices = main.map(function (p) { return p[1]; }), ch = (prices[prices.length - 1] / prices[0] - 1) * 100;
    var c = $('mk-stat-ch');
    c.textContent = arrow(ch) + pct(ch); c.className = 'num ' + dir(ch);
    $('mk-stat-hi').textContent = usd(Math.max.apply(null, prices));
    $('mk-stat-lo').textContent = usd(Math.min.apply(null, prices));
    $('mk-legend').innerHTML = '<span class="k main">' + t.names[state.coin] + '</span>' + (b ? '<span class="k cmp">' + t.names[state.cmp] + '</span>' : '');
  }
  var lastDraw = null;
  window.addEventListener('resize', function () {
    clearTimeout(lastDraw && lastDraw.timer);
    if (lastDraw) lastDraw.timer = setTimeout(function () { drawChart(lastDraw.a, lastDraw.b); }, 150);
  });
  function chart() {
    var msg = $('mk-chart-msg'), want = state.coin + state.days + state.cmp;
    $('mk-chart-title').textContent = t.names[state.coin];
    msg.textContent = t.loading; msg.hidden = false;
    Promise.all([seriesFor(state.coin, state.days), state.cmp ? seriesFor(state.cmp, state.days) : null]).then(function (r) {
      if (want !== state.coin + state.days + state.cmp) return;
      if (!r[0] || r[0].length < 2) throw new Error('empty');
      msg.hidden = true;
      lastDraw = { a: r[0], b: r[1] && r[1].length > 1 ? r[1] : null };
      drawChart(lastDraw.a, lastDraw.b);
    }).catch(function () { if (want === state.coin + state.days + state.cmp) msg.textContent = t.fail; });
  }
  function fillCompare() {
    var sel = $('mk-cmp');
    sel.innerHTML = '<option value="">' + t.none + '</option>' + COINS.filter(function (id) { return id !== state.coin; }).map(function (id) {
      return '<option value="' + id + '"' + (id === state.cmp ? ' selected' : '') + '>' + t.names[id] + ' (' + TICK[id] + ')</option>';
    }).join('');
  }

  // ---- the backdrop tiles ----
  function change30(s) { return s && s.length > 1 ? s[s.length - 1][1] - s[0][1] : null; }
  function delta(elm, v, txt) {
    elm.textContent = v == null ? '' : arrow(v) + txt + ' · ' + t.d30;
    elm.className = 'mk-delta ' + dir(v);
  }
  function renderFng(f) {
    var tile = $('mk-fng');
    if (!f) { tile.querySelector('.mk-big').textContent = '—'; tile.querySelector('.mk-tag').textContent = t.nodata; return; }
    var v = f.value, band = v < 25 ? 0 : v < 45 ? 1 : v <= 55 ? 2 : v <= 75 ? 3 : 4;
    tile.querySelector('.mk-big').textContent = v;
    tile.querySelector('.mk-tag').textContent = t.fng[band];
    tile.querySelector('.mk-tag').className = 'mk-tag f' + band;
    var ch = change30(f.series);
    delta(tile.querySelector('.mk-delta'), ch, ch == null ? '' : new Intl.NumberFormat(L).format(Math.abs(ch)));
    // gauge: a half ring from fear (left) to greed (right)
    var g = tile.querySelector('.mk-gauge'); g.textContent = '';
    var svg = el('svg', { viewBox: '0 0 120 66', 'aria-hidden': 'true' }, g);
    el('path', { d: 'M10 60 A50 50 0 0 1 110 60', class: 'g-track' }, svg);
    el('path', { d: 'M10 60 A50 50 0 0 1 110 60', class: 'g-val', pathLength: 100, 'stroke-dasharray': v + ' 100' }, svg);
    var ang = Math.PI * (1 - v / 100);
    el('circle', { cx: 60 + 50 * Math.cos(ang), cy: 60 - 50 * Math.sin(ang), r: 5, class: 'g-dot' }, svg);
  }
  function renderDvol(d) {
    var tile = $('mk-dvol');
    if (!d) { tile.querySelector('.mk-big').textContent = '—'; tile.querySelector('.mk-tag').textContent = t.nodata; return; }
    var v = d.value, band = v < 35 ? 0 : v < 60 ? 1 : v < 80 ? 2 : 3;
    tile.querySelector('.mk-big').textContent = new Intl.NumberFormat(L, { maximumFractionDigits: 0 }).format(v);
    tile.querySelector('.mk-tag').textContent = t.dvol[band];
    tile.querySelector('.mk-tag').className = 'mk-tag v' + band;
    var s = d.series, ch = s && s.length > 1 ? (s[s.length - 1][1] / s[0][1] - 1) * 100 : null;
    delta(tile.querySelector('.mk-delta'), ch, pct(ch).replace(/^[+−]/, ''));
    spark(tile.querySelector('.mk-sp'), s, 'gold');
  }
  function renderStable(d) {
    var tile = $('mk-stable');
    if (!d) { tile.querySelector('.mk-big').textContent = '—'; return; }
    tile.querySelector('.mk-big').textContent = big(d.value);
    var s = d.series, ch = s && s.length > 1 ? (s[s.length - 1][1] / s[0][1] - 1) * 100 : null;
    delta(tile.querySelector('.mk-delta'), ch, pct(ch).replace(/^[+−]/, ''));
    spark(tile.querySelector('.mk-sp'), s, 'gold');
  }
  function renderGlobal(d) {
    var tile = $('mk-global');
    if (!d) { tile.querySelector('.mk-big').textContent = '—'; return; }
    tile.querySelector('.mk-big').textContent = big(d.mcap);
    var c = tile.querySelector('.mk-delta');
    c.textContent = arrow(d.ch24) + pct(d.ch24).replace(/^[+−]/, '') + ' · ' + t.today;
    c.className = 'mk-delta ' + dir(d.ch24);
    tile.querySelector('.mk-vol').textContent = fill(t.vol, { v: big(d.vol) });
    var ring = tile.querySelector('.mk-ring'), old = ring.querySelector('svg');
    if (old) old.remove();
    var svg = el('svg', { viewBox: '0 0 64 64', 'aria-hidden': 'true' });
    ring.insertBefore(svg, ring.firstChild);
    el('circle', { cx: 32, cy: 32, r: 26, class: 'r-track' }, svg);
    el('circle', { cx: 32, cy: 32, r: 26, class: 'r-val', pathLength: 100, 'stroke-dasharray': d.btc.toFixed(1) + ' 100', transform: 'rotate(-90 32 32)' }, svg);
    tile.querySelector('.mk-dom').innerHTML = '<small>' + t.dom + '</small>' + new Intl.NumberFormat(L, { maximumFractionDigits: 0 }).format(d.btc) + '%';
  }

  // ---- Altcoin Season Index (scripts/fetch_market.py counts it; no browser fallback, it needs 100 coins) ----
  function renderSeason(d) {
    var box = $('mk-season');
    if (!d || d.value == null) return;
    var v = d.value, label = v >= 75 ? t.sAlt : v <= 25 ? t.sBtc : t.sNone;
    box.querySelector('.mk-season-val').textContent = v + ' · ' + label;
    box.querySelector('.mk-season-val').className = 'mk-season-val ' + (v >= 75 ? 'alt' : v <= 25 ? 'btc' : '');
    box.querySelector('.mk-season-knob').style.left = v + '%';
    box.querySelector('.mk-season-bar').title = fill(t.sBeat, { n: d.beat, of: d.of });
    box.hidden = false;
  }

  // ---- wiring ----
  document.querySelectorAll('.mk-card').forEach(function (card) {
    card.addEventListener('click', function () {
      state.coin = card.getAttribute('data-coin');
      if (state.cmp === state.coin) state.cmp = '';
      document.querySelectorAll('.mk-card').forEach(function (c) { c.setAttribute('aria-pressed', String(c === card)); });
      fillCompare(); chart();
    });
  });
  document.querySelectorAll('#mk-range button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.days = +btn.getAttribute('data-days');
      document.querySelectorAll('#mk-range button').forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
      chart();
    });
  });
  $('mk-cmp').addEventListener('change', function () { state.cmp = this.value; chart(); });
  fillCompare();

  function refreshQuotes() { return Promise.all([part('coins', function () { return Promise.resolve({}); }), window.PepPrices.markets()]).then(function (r) {
    var c = r[0] || {}, snapshot = r[1];
    snapshot.d.forEach(function (x) {
      if (COINS.indexOf(x.id) < 0) return;
      c[x.id] = Object.assign({}, c[x.id] || {}, { price: x.current_price, ch24: x.price_change_percentage_24h });
    });
    state.coins = c; renderCards(c);
    $('mk-updated').textContent = window.PepPrices.describe(snapshot, L);
  }).catch(function () { /* The generated snapshot stays visible. */ }); }
  window.PepPrices.subscribe(refreshQuotes);

  chart();
  fileP.then(function (f) { renderSeason(f && f.season); });
  part('fng', liveFng).then(renderFng);
  part('dvol', liveDvol).then(renderDvol);
  part('stable', liveStable).then(renderStable);
  part('global', liveGlobal).then(renderGlobal);
})();
