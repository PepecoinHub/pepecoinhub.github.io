// Price page: live PEP stats and chart (CoinGecko, in the visitor's browser), an optional PEPE overlay,
// and the "what would ×N mean" market cap ladder. Words for each language are in T; the page's <html lang> picks one.
(function () {
  'use strict';
  var PEP = 'pepecoin-network', PEPE = 'pepe';
  var API = 'https://api.coingecko.com/api/v3/';
  var TTL = 10 * 60 * 1000;

  var T = {
    en: { loc: 'en-US',
      powRank: 'Pepecoin is #{n} on this list right now.',
      live: 'Live from CoinGecko, updated {t}.',
      saved: 'Live prices could not be loaded just now. Showing saved figures from October 18, 2026 (CoinMarketCap).',
      loading: 'Loading the chart…',
      chartFail: 'The chart could not be loaded right now (CoinGecko limits free requests). Try again in a minute.',
      corr: 'How closely PEP and PEPE moved together in this period: {r} (1 = in step, 0 = no link, −1 = opposite).',
      pepNow: 'Pepecoin today', pepX: 'Pepecoin ×{m}', pepeNow: 'Pepe today', pepeX: 'Pepe ×{m}',
      per: 'per PEP', perPepe: 'per PEPE',
      rank: '#{r} among all cryptos', rankOut: 'outside the top 250 cryptos',
      small: 'Even at ×{m}, still smaller than Pepe is today ({v}).', big: '{x} times the size of Pepe today.',
      above: 'Bigger than {list}.', like: 'About the size of {firm}.', and: ' and ',
      priceHint: 'That is ×{m} from today\'s price and a market cap of {v}.',
      priceBad: 'Type a price in US dollars, for example 0.01.',
      change: 'change' },
    pl: { loc: 'pl-PL',
      powRank: 'Pepecoin jest teraz na {n}. miejscu tej listy.',
      live: 'Na żywo z CoinGecko, aktualizacja {t}.',
      saved: 'Nie udało się teraz pobrać cen na żywo. Pokazuję zapisane dane z 18 października 2026 (CoinMarketCap).',
      loading: 'Wczytuję wykres…',
      chartFail: 'Nie udało się teraz wczytać wykresu (CoinGecko ogranicza darmowe zapytania). Spróbuj za minutę.',
      corr: 'Jak mocno PEP i PEPE ruszały się razem w tym okresie: {r} (1 = razem, 0 = bez związku, −1 = odwrotnie).',
      pepNow: 'Pepecoin dziś', pepX: 'Pepecoin ×{m}', pepeNow: 'Pepe dziś', pepeX: 'Pepe ×{m}',
      per: 'za PEP', perPepe: 'za PEPE',
      rank: '#{r} wśród wszystkich kryptowalut', rankOut: 'poza top 250 kryptowalut',
      small: 'Nawet przy ×{m} nadal mniej niż Pepe ma dziś ({v}).', big: '{x} razy więcej niż Pepe dziś.',
      above: 'Więcej niż {list}.', like: 'Mniej więcej tyle co {firm}.', and: ' i ',
      priceHint: 'To ×{m} od dzisiejszej ceny i kapitalizacja {v}.',
      priceBad: 'Wpisz cenę w dolarach, np. 0,01.',
      change: 'zmiana' },
    es: { loc: 'es-ES',
      powRank: 'Pepecoin ocupa ahora el puesto {n} de esta lista.',
      live: 'En directo desde CoinGecko, actualizado a las {t}.',
      saved: 'No se pudieron cargar los precios en directo. Se muestran datos guardados del 18 de octubre de 2026 (CoinMarketCap).',
      loading: 'Cargando el gráfico…',
      chartFail: 'No se pudo cargar el gráfico ahora (CoinGecko limita las consultas gratuitas). Inténtalo de nuevo en un minuto.',
      corr: 'Cuánto se movieron juntos PEP y PEPE en este periodo: {r} (1 = a la par, 0 = sin relación, −1 = al revés).',
      pepNow: 'Pepecoin hoy', pepX: 'Pepecoin ×{m}', pepeNow: 'Pepe hoy', pepeX: 'Pepe ×{m}',
      per: 'por PEP', perPepe: 'por PEPE',
      rank: 'n.º {r} entre todas las criptomonedas', rankOut: 'fuera del top 250 de criptomonedas',
      small: 'Incluso con ×{m}, aún menos que Pepe hoy ({v}).', big: '{x} veces el tamaño de Pepe hoy.',
      above: 'Más que {list}.', like: 'Más o menos como {firm}.', and: ' y ',
      priceHint: 'Son ×{m} desde el precio de hoy y una capitalización de {v}.',
      priceBad: 'Escribe un precio en dólares, por ejemplo 0,01.',
      change: 'cambio' },
    de: { loc: 'de-DE',
      powRank: 'Pepecoin steht gerade auf Platz {n} dieser Liste.',
      live: 'Live von CoinGecko, aktualisiert um {t}.',
      saved: 'Live-Kurse konnten gerade nicht geladen werden. Angezeigt werden gespeicherte Werte vom 18. Oktober 2026 (CoinMarketCap).',
      loading: 'Chart wird geladen…',
      chartFail: 'Der Chart konnte gerade nicht geladen werden (CoinGecko begrenzt kostenlose Abfragen). Bitte in einer Minute erneut versuchen.',
      corr: 'Wie stark sich PEP und PEPE in diesem Zeitraum gemeinsam bewegt haben: {r} (1 = im Gleichschritt, 0 = kein Zusammenhang, −1 = gegenläufig).',
      pepNow: 'Pepecoin heute', pepX: 'Pepecoin ×{m}', pepeNow: 'Pepe heute', pepeX: 'Pepe ×{m}',
      per: 'pro PEP', perPepe: 'pro PEPE',
      rank: 'Platz {r} unter allen Kryptowährungen', rankOut: 'außerhalb der Top 250 Kryptowährungen',
      small: 'Selbst bei ×{m} noch kleiner als Pepe heute ({v}).', big: '{x}-mal so groß wie Pepe heute.',
      above: 'Größer als {list}.', like: 'Etwa so groß wie {firm}.', and: ' und ',
      priceHint: 'Das ist ×{m} vom heutigen Kurs und eine Marktkapitalisierung von {v}.',
      priceBad: 'Gib einen Preis in US-Dollar ein, zum Beispiel 0,01.',
      change: 'Veränderung' },
    fr: { loc: 'fr-FR',
      powRank: 'Pepecoin est actuellement n° {n} de cette liste.',
      live: 'En direct depuis CoinGecko, mis à jour à {t}.',
      saved: 'Les prix en direct n’ont pas pu être chargés. Affichage des chiffres enregistrés le 18 octobre 2026 (CoinMarketCap).',
      loading: 'Chargement du graphique…',
      chartFail: 'Le graphique n’a pas pu être chargé (CoinGecko limite les requêtes gratuites). Réessayez dans une minute.',
      corr: 'À quel point PEP et PEPE ont bougé ensemble sur cette période : {r} (1 = ensemble, 0 = aucun lien, −1 = à l’opposé).',
      pepNow: 'Pepecoin aujourd’hui', pepX: 'Pepecoin ×{m}', pepeNow: 'Pepe aujourd’hui', pepeX: 'Pepe ×{m}',
      per: 'par PEP', perPepe: 'par PEPE',
      rank: 'n° {r} parmi toutes les cryptos', rankOut: 'hors du top 250 des cryptos',
      small: 'Même à ×{m}, toujours plus petit que Pepe aujourd’hui ({v}).', big: '{x} fois la taille de Pepe aujourd’hui.',
      above: 'Plus gros que {list}.', like: 'À peu près la taille de {firm}.', and: ' et ',
      priceHint: 'Cela fait ×{m} par rapport au prix du jour et une capitalisation de {v}.',
      priceBad: 'Saisissez un prix en dollars, par exemple 0,01.',
      change: 'variation' },
    it: { loc: 'it-IT',
      powRank: 'Pepecoin è ora al {n}° posto di questa lista.',
      live: 'In diretta da CoinGecko, aggiornato alle {t}.',
      saved: 'Non è stato possibile caricare i prezzi in diretta. Mostro i dati salvati del 18 ottobre 2026 (CoinMarketCap).',
      loading: 'Caricamento del grafico…',
      chartFail: 'Al momento il grafico non si carica (CoinGecko limita le richieste gratuite). Riprova tra un minuto.',
      corr: 'Quanto PEP e PEPE si sono mossi insieme in questo periodo: {r} (1 = insieme, 0 = nessun legame, −1 = al contrario).',
      pepNow: 'Pepecoin oggi', pepX: 'Pepecoin ×{m}', pepeNow: 'Pepe oggi', pepeX: 'Pepe ×{m}',
      per: 'per PEP', perPepe: 'per PEPE',
      rank: 'n. {r} tra tutte le cripto', rankOut: 'fuori dalla top 250 delle cripto',
      small: 'Anche a ×{m}, ancora meno di Pepe oggi ({v}).', big: '{x} volte Pepe di oggi.',
      above: 'Più grande di {list}.', like: 'Più o meno come {firm}.', and: ' e ',
      priceHint: 'Sono ×{m} rispetto al prezzo di oggi e una capitalizzazione di {v}.',
      priceBad: 'Scrivi un prezzo in dollari, per esempio 0,01.',
      change: 'variazione' },
    tr: { loc: 'tr-TR',
      powRank: 'Pepecoin şu anda bu listede {n}. sırada.',
      live: 'CoinGecko\'dan canlı, güncelleme {t}.',
      saved: 'Canlı fiyatlar şu an yüklenemedi. 18 Ekim 2026 tarihli kayıtlı veriler gösteriliyor (CoinMarketCap).',
      loading: 'Grafik yükleniyor…',
      chartFail: 'Grafik şu an yüklenemedi (CoinGecko ücretsiz istekleri sınırlıyor). Bir dakika sonra tekrar deneyin.',
      corr: 'Bu dönemde PEP ve PEPE ne kadar birlikte hareket etti: {r} (1 = birlikte, 0 = ilişkisiz, −1 = ters yönde).',
      pepNow: 'Pepecoin bugün', pepX: 'Pepecoin ×{m}', pepeNow: 'Pepe bugün', pepeX: 'Pepe ×{m}',
      per: 'PEP başına', perPepe: 'PEPE başına',
      rank: 'tüm kripto paralar arasında #{r}', rankOut: 'ilk 250 kripto paranın dışında',
      small: '×{m} ile bile bugünkü Pepe\'den küçük ({v}).', big: 'Bugünkü Pepe\'nin {x} katı.',
      above: '{list} değerinden büyük.', like: 'Kabaca {firm} büyüklüğünde.', and: ' ve ',
      priceHint: 'Bu, bugünkü fiyattan ×{m} ve {v} piyasa değeri demek.',
      priceBad: 'Dolar cinsinden bir fiyat yazın, örneğin 0,01.',
      change: 'değişim' },
    zh: { loc: 'zh-CN',
      powRank: 'Pepecoin 目前在此列表中排第 {n} 名。',
      live: '来自 CoinGecko 的实时数据，更新于 {t}。',
      saved: '暂时无法加载实时价格。显示 2026 年 10 月 18 日保存的数据（CoinMarketCap）。',
      loading: '正在加载图表…',
      chartFail: '暂时无法加载图表（CoinGecko 限制免费请求）。请一分钟后再试。',
      corr: '这段时间内 PEP 与 PEPE 同步波动的程度：{r}（1 = 同步，0 = 无关，−1 = 相反）。',
      pepNow: 'Pepecoin 当前', pepX: 'Pepecoin ×{m}', pepeNow: 'Pepe 当前', pepeX: 'Pepe ×{m}',
      per: '每枚 PEP', perPepe: '每枚 PEPE',
      rank: '在所有加密货币中排第 {r} 名', rankOut: '排在前 250 名加密货币之外',
      small: '即使 ×{m}，仍小于 Pepe 当前市值（{v}）。', big: '是 Pepe 当前市值的 {x} 倍。',
      above: '超过 {list}。', like: '大致相当于 {firm}。', and: '、',
      priceHint: '这相当于当前价格的 ×{m}，市值 {v}。',
      priceBad: '请输入以美元计的价格，例如 0.01。',
      change: '涨跌' }
  };
  var lang = (document.documentElement.lang || 'en').toLowerCase();
  lang = lang.indexOf('zh') === 0 ? 'zh' : lang.split('-')[0];
  var t = T[lang] || T.en, LOC = t.loc;

  // Saved figures (CoinMarketCap, October 18, 2026), shown until live data arrives or if it never does.
  var SNAP = {
    pep: { price: 0.00008947, mcap: 9208350, change: 0.51, ath: 0.001824, athDate: null, supply: 102921550000 },
    pepe: { price: 0.000003864, mcap: 1598623686, change: -1.05 },
    coins: { bitcoin: 1627.6e9, ethereum: 288.21e9, binancecoin: 94.68e9, ripple: 80.30e9, solana: 60.02e9, tron: 31.57e9,
      dogecoin: 13.33e9, chainlink: 8.78e9, cardano: 7.92e9, litecoin: 4.51e9, 'shiba-inu': 2.87e9, bonk: 252.2e6, floki: 217.5e6 }
  };
  var NAMES = { bitcoin: 'Bitcoin', ethereum: 'Ethereum', binancecoin: 'BNB', ripple: 'XRP', solana: 'Solana', tron: 'TRON',
    dogecoin: 'Dogecoin', chainlink: 'Chainlink', cardano: 'Cardano', litecoin: 'Litecoin', 'shiba-inu': 'Shiba Inu', bonk: 'Bonk', floki: 'FLOKI' };
  // Coins drawn next to Pepecoin ×N (memecoins and older coins) and next to Pepe ×N (the biggest coins).
  var NEAR_PEP = ['dogecoin', 'cardano', 'litecoin', 'shiba-inu', 'bonk', 'floki'];
  var NEAR_PEPE = ['ethereum', 'binancecoin', 'ripple', 'solana', 'dogecoin'];
  // Companies: market caps from TickerLeague's top-100 list, as of April 29 – May 1, 2026. Fixed reference points, not live.
  var FIRMS = [['Intel', 424.38e9], ['Netflix', 388.53e9], ['McDonald\'s', 207.84e9], ['Disney', 179.77e9], ['Uber', 152.53e9]];

  var state = { pep: SNAP.pep, pepe: SNAP.pepe, coins: SNAP.coins, top: null, mult: 100, days: 30, overlay: false, series: {} };
  function $(id) { return document.getElementById(id); }
  function fill(s, o) { return s.replace(/\{(\w+)\}/g, function (_, k) { return o[k]; }); }
  function num(v) { return typeof v === 'number' && isFinite(v) ? v : null; }

  function usd(v) {
    if (v === null) return '–';
    var o = { style: 'currency', currency: 'USD' };
    if (v >= 1e5) { o.notation = 'compact'; o.maximumSignificantDigits = 3; }
    else if (v >= 1) { o.maximumFractionDigits = 2; }
    else { o.maximumSignificantDigits = 4; }
    return new Intl.NumberFormat(LOC, o).format(v);
  }
  function pct(v, sign) {
    var s = new Intl.NumberFormat(LOC, { maximumFractionDigits: Math.abs(v) < 10 ? 2 : 1, signDisplay: sign ? 'exceptZero' : 'auto' }).format(v);
    return s + '%';
  }
  function times(m) { return new Intl.NumberFormat(LOC, { maximumFractionDigits: m < 10 ? 1 : 0 }).format(m); }
  function day(d) { return new Date(d).toLocaleDateString(LOC, { year: 'numeric', month: 'short', day: 'numeric' }); }

  // ---------- stats ----------
  function renderStats() {
    var p = state.pep;
    $('s-price').textContent = usd(p.price);
    var ch = $('s-24h');
    ch.textContent = p.change === null ? '–' : pct(p.change, true);
    ch.className = 'value ' + (p.change > 0 ? 'up' : p.change < 0 ? 'down' : '');
    $('s-mcap').textContent = usd(p.mcap);
    $('s-ath').textContent = usd(p.ath);
    $('s-ath-sub').textContent = p.athDate ? day(p.athDate) : '';
    $('s-pepe').textContent = usd(state.pepe.price);
    $('s-pepe-sub').textContent = usd(state.pepe.mcap) + ' · ' + (state.pepe.change === null ? '' : pct(state.pepe.change, true) + ' 24h');
  }

  // ---------- ×N: Pepecoin among coins, Pepe among coins and companies ----------
  // Rank among CoinGecko's top 250 by market cap, leaving out the coin itself. Only with live data.
  function rank(v, self) {
    if (!state.top) return '';
    var caps = state.top.filter(function (c) { return c.id !== self; }).map(function (c) { return c.cap; });
    if (v < Math.min.apply(null, caps)) return t.rankOut;
    return fill(t.rank, { r: 1 + caps.filter(function (c) { return c > v; }).length });
  }
  function ladder(id, rows) {
    var list = $(id), max = Math.max.apply(null, rows.map(function (r) { return r.v; }));
    list.textContent = '';
    rows.sort(function (a, b) { return b.v - a.v; }).forEach(function (r) {
      var li = document.createElement('li');
      li.className = 'rung ' + r.kind;
      var name = document.createElement('span');
      name.className = 'rung-name';
      name.textContent = r.name;
      var bar = document.createElement('span');
      bar.className = 'rung-bar';
      var fillEl = document.createElement('i');
      fillEl.style.width = Math.max(0.6, r.v / max * 100) + '%';
      bar.appendChild(fillEl);
      var val = document.createElement('span');
      val.className = 'rung-val';
      val.textContent = usd(r.v);
      li.appendChild(name); li.appendChild(bar); li.appendChild(val);
      list.appendChild(li);
    });
  }
  function coinRows(ids) {
    return ids.filter(function (id) { return state.coins[id]; }).map(function (id) { return { name: NAMES[id], v: state.coins[id], kind: 'coin' }; });
  }
  function joinList(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + t.and + a[a.length - 1]; }
  function renderLadder() {
    var m = state.mult, p = state.pep, e = state.pepe, pv = p.mcap * m, ev = e.mcap * m;
    $('x-mult').textContent = '×' + times(m);
    $('x-pep-price').textContent = usd(p.price * m);
    $('x-pep-cap').textContent = usd(pv);
    $('x-pep-rank').textContent = rank(pv, PEP);
    $('x-pep-note').textContent = pv < e.mcap ? fill(t.small, { m: times(m), v: usd(e.mcap) })
      : fill(t.big, { x: new Intl.NumberFormat(LOC, { maximumFractionDigits: 1 }).format(pv / e.mcap) });
    $('x-pepe-price').textContent = usd(e.price * m);
    $('x-pepe-cap').textContent = usd(ev);
    $('x-pepe-rank').textContent = rank(ev, PEPE);
    var below = NEAR_PEPE.concat(['tron', 'cardano']).filter(function (id) { return state.coins[id] && state.coins[id] < ev; })
      .sort(function (a, b) { return state.coins[b] - state.coins[a]; }).slice(0, 3).map(function (id) { return NAMES[id]; });
    var firm = FIRMS.reduce(function (best, f) { return Math.abs(Math.log(f[1] / ev)) < Math.abs(Math.log(best[1] / ev)) ? f : best; });
    var close = Math.abs(Math.log(firm[1] / ev)) < Math.log(1.6);
    $('x-pepe-note').textContent = (below.length ? fill(t.above, { list: joinList(below) }) + ' ' : '') + (close ? fill(t.like, { firm: firm[0] + ' (' + usd(firm[1]) + ')' }) : '');
    ladder('ladder-pep', coinRows(NEAR_PEP).concat(
      [{ name: fill(t.pepX, { m: times(m) }), v: pv, kind: 'pep x' }, { name: t.pepNow, v: p.mcap, kind: 'pep' }, { name: t.pepeNow, v: e.mcap, kind: 'pepe' }]));
    ladder('ladder-pepe', coinRows(NEAR_PEPE).concat(FIRMS.map(function (f) { return { name: f[0], v: f[1], kind: 'firm' }; }),
      [{ name: fill(t.pepeX, { m: times(m) }), v: ev, kind: 'pepe x' }, { name: t.pepeNow, v: e.mcap, kind: 'pepe' }]));
  }
  // The slider runs on a log scale: 0 → ×1, 100 → ×10, 200 → ×100, 300 → ×1000, 400 → ×10,000.
  function setMult(m, fromSlider) {
    state.mult = m;
    // The slider has a fixed range; typed target prices may go beyond it.
    if (!fromSlider) $('x-range').value = String(Math.max(0, Math.min(400, Math.round(Math.log10(state.mult) * 100))));
    document.querySelectorAll('[data-mult]').forEach(function (b) { b.setAttribute('aria-pressed', String(Number(b.dataset.mult) === state.mult)); });
    renderLadder();
    // the section title follows the slider: "Pepecoin ×200 vs Pepe ×200"
    document.querySelectorAll('.x-h').forEach(function (el) { el.textContent = $('x-mult').textContent; });
  }
  function nice(m) {
    var p = Math.pow(10, Math.floor(Math.log10(m))), steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10];
    var best = steps[0];
    steps.forEach(function (s) { if (Math.abs(s * p - m) < Math.abs(best * p - m)) best = s; });
    return best * p;
  }
  function wireLadder() {
    $('x-range').addEventListener('input', function (ev) { setMult(nice(Math.pow(10, Number(ev.target.value) / 100)), true); $('x-target').value = ''; $('x-target-hint').textContent = ''; });
    document.querySelectorAll('[data-mult]').forEach(function (b) {
      b.addEventListener('click', function () { setMult(Number(b.dataset.mult)); $('x-target').value = ''; $('x-target-hint').textContent = ''; });
    });
    $('x-target').addEventListener('input', function (ev) {
      var v = Number(String(ev.target.value).replace(/[$\s]/g, '').replace(',', '.'));
      var hint = $('x-target-hint');
      if (!ev.target.value) { hint.textContent = ''; return; }
      if (!(v > 0) || !isFinite(v) || !isFinite(v / state.pep.price) || !isFinite(v * state.pep.supply)) { hint.textContent = t.priceBad; return; }
      var m = v / state.pep.price;
      hint.textContent = fill(t.priceHint, { m: times(m), v: usd(v * (state.pep.mcap / state.pep.price)) });
      setMult(m);
    });
  }

  // ---------- chart ----------
  var NS = 'http://www.w3.org/2000/svg';
  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function near(arr, x) { // index of the point in arr ([[ms, v]…], sorted) closest to x
    var a = 0, b = arr.length - 1;
    while (b - a > 1) { var mid = (a + b) >> 1; if (arr[mid][0] < x) a = mid; else b = mid; }
    return Math.abs(arr[a][0] - x) <= Math.abs(arr[b][0] - x) ? a : b;
  }
  function correlation(pep, pepe) {
    var xs = [], ys = [], step = Math.max(1, Math.floor(pep.length / 120));
    for (var i = step; i < pep.length; i += step) {
      var a = pepe[near(pepe, pep[i - step][0])][1], b = pepe[near(pepe, pep[i][0])][1];
      xs.push(Math.log(pep[i][1] / pep[i - step][1])); ys.push(Math.log(b / a));
    }
    var n = xs.length;
    if (n < 5) return null;
    var mx = xs.reduce(function (s, v) { return s + v; }, 0) / n, my = ys.reduce(function (s, v) { return s + v; }, 0) / n;
    var sxy = 0, sxx = 0, syy = 0;
    for (var j = 0; j < n; j++) { sxy += (xs[j] - mx) * (ys[j] - my); sxx += (xs[j] - mx) * (xs[j] - mx); syy += (ys[j] - my) * (ys[j] - my); }
    return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
  }
  function drawChart() {
    var box = $('chart'), pep = state.series[PEP + state.days], pepe = state.series[PEPE + state.days];
    if (!pep || pep.length < 2) return;
    var overlay = state.overlay && pepe && pepe.length > 1;
    var W = Math.max(300, box.clientWidth), H = W < 560 ? 260 : 340, L = 8, R = W < 560 ? 58 : 72, Tp = 14, B = 26;
    box.textContent = '';
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', 'aria-labelledby': 'chart-title' }, box);
    var x0 = pep[0][0], x1 = pep[pep.length - 1][0];
    var base = pep[0][1], baseE = overlay ? pepe[near(pepe, x0)][1] : 0;
    function yv(p) { return overlay ? (p / base - 1) * 100 : p; }
    function ye(p) { return (p / baseE - 1) * 100; }
    var vals = pep.map(function (d) { return yv(d[1]); });
    var pepeIn = overlay ? pepe.filter(function (d) { return d[0] >= x0 && d[0] <= x1; }) : [];
    if (overlay) pepeIn.forEach(function (d) { vals.push(ye(d[1])); });
    var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals), pad = (mx - mn) * 0.08 || Math.abs(mx) * 0.05 || 1;
    mn -= pad; mx += pad;
    function X(ms) { return L + (ms - x0) / (x1 - x0) * (W - L - R); }
    function Y(v) { return Tp + (mx - v) / (mx - mn) * (H - Tp - B); }
    // grid + y labels
    for (var g = 0; g <= 4; g++) {
      var v = mn + (mx - mn) * g / 4, y = Y(v);
      el('line', { x1: L, x2: W - R, y1: y, y2: y, class: 'grid' }, svg);
      var lab = el('text', { x: W - R + 6, y: y + 4, class: 'axis' }, svg);
      lab.textContent = overlay ? pct(v, true) : usd(v);
    }
    if (overlay && mn < 0 && mx > 0) el('line', { x1: L, x2: W - R, y1: Y(0), y2: Y(0), class: 'zero' }, svg);
    // x labels
    var nx = W < 560 ? 2 : 3;
    for (var k = 0; k <= nx; k++) {
      var ms = x0 + (x1 - x0) * k / nx, xl = el('text', { x: X(ms), y: H - 6, class: 'axis', 'text-anchor': k === 0 ? 'start' : k === nx ? 'end' : 'middle' }, svg);
      xl.textContent = state.days <= 1 ? new Date(ms).toLocaleTimeString(LOC, { hour: '2-digit', minute: '2-digit' })
        : new Date(ms).toLocaleDateString(LOC, state.days > 90 ? { year: 'numeric', month: 'short' } : { month: 'short', day: 'numeric' });
    }
    function path(arr, f) { return arr.map(function (d, i) { return (i ? 'L' : 'M') + X(d[0]).toFixed(1) + ' ' + Y(f(d[1])).toFixed(1); }).join(''); }
    var defs = el('defs', {}, svg), grad = el('linearGradient', { id: 'pep-fill', x1: 0, x2: 0, y1: 0, y2: 1 }, defs);
    el('stop', { offset: '0%', class: 'fill-top' }, grad); el('stop', { offset: '100%', class: 'fill-bottom' }, grad);
    var line = path(pep, yv);
    if (!overlay) el('path', { d: line + 'L' + X(x1) + ' ' + (H - B) + 'L' + X(x0) + ' ' + (H - B) + 'Z', fill: 'url(#pep-fill)' }, svg);
    if (overlay) el('path', { d: path(pepeIn, ye), class: 'line pepe' }, svg);
    el('path', { d: line, class: 'line pep' }, svg);
    // hover
    var cross = el('line', { y1: Tp, y2: H - B, class: 'cross', visibility: 'hidden' }, svg);
    var dot = el('circle', { r: 4.5, class: 'dot pep', visibility: 'hidden' }, svg);
    var dotE = el('circle', { r: 4.5, class: 'dot pepe', visibility: 'hidden' }, svg);
    var tip = $('chart-tip');
    function move(ev) {
      var r = svg.getBoundingClientRect(), mxp = (ev.clientX - r.left) * W / r.width;
      var ms = x0 + (mxp - L) / (W - L - R) * (x1 - x0), i = near(pep, ms), d = pep[i], cx = X(d[0]);
      cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
      dot.setAttribute('cx', cx); dot.setAttribute('cy', Y(yv(d[1]))); dot.setAttribute('visibility', 'visible');
      var when = state.days <= 1 ? new Date(d[0]).toLocaleString(LOC, { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : day(d[0]);
      var html = '<b>' + when + '</b><span class="k pep">PEP ' + usd(d[1]) + (overlay ? ' · ' + pct(yv(d[1]), true) : '') + '</span>';
      if (overlay) {
        var e = pepe[near(pepe, d[0])];
        dotE.setAttribute('cx', cx); dotE.setAttribute('cy', Y(ye(e[1]))); dotE.setAttribute('visibility', 'visible');
        html += '<span class="k pepe">PEPE ' + usd(e[1]) + ' · ' + pct(ye(e[1]), true) + '</span>';
      }
      tip.innerHTML = html;
      tip.hidden = false;
      var left = cx / W * r.width;
      tip.style.left = Math.min(r.width - tip.offsetWidth - 4, Math.max(4, left + 12)) + 'px';
      if (left + 12 + tip.offsetWidth > r.width - 4) tip.style.left = Math.max(4, left - tip.offsetWidth - 12) + 'px';
    }
    function leave() { cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); dotE.setAttribute('visibility', 'hidden'); tip.hidden = true; }
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerdown', move);
    svg.addEventListener('pointerleave', leave);
    // range change and correlation line
    var first = pep[0][1], last = pep[pep.length - 1][1];
    var rc = $('chart-change');
    rc.textContent = 'PEP ' + pct((last / first - 1) * 100, true) + (pepe && pepe.length > 1 ? ' · PEPE ' + pct((pepe[pepe.length - 1][1] / pepe[near(pepe, x0)][1] - 1) * 100, true) : '');
    var c = pepe && pepe.length > 1 ? correlation(pep, pepe) : null;
    $('chart-corr').textContent = c === null ? '' : fill(t.corr, { r: new Intl.NumberFormat(LOC, { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(c) });
    $('legend-pepe').hidden = !overlay;
  }

  // stale: also return an expired copy (used when CoinGecko refuses a request)
  function cacheGet(key, stale) {
    try { var o = JSON.parse(localStorage.getItem(key) || 'null'); return o && (stale || Date.now() - o.t < TTL) ? o : null; } catch (e) { return null; }
  }
  function cacheSet(key, data) { try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), d: data })); } catch (e) { /* storage unavailable */ } }
  // data/price-live.json: the same CoinGecko data, fetched by the site's robot every hour (scripts/fetch_prices.py).
  // Read it first, so a visitor normally sends no request to CoinGecko at all.
  var fileP = window.PepPrices.file;
  function getJSON(url) { return fetch(url).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }); }
  // CoinGecko's free API allows only a few requests a minute, so one download serves several ranges:
  // 7 days is cut from the 30-day series (hourly points), 90 days from the 1-year series (daily points).
  var SOURCE = { 1: 1, 7: 30, 30: 30, 90: 365, 365: 365 };
  function cut(d, days) {
    if (!d.length) return d;
    var from = d[d.length - 1][0] - days * 864e5;
    return d.filter(function (p) { return p[0] >= from; });
  }
  function download(id, src) {
    if (state.series['src' + id + src]) return Promise.resolve(state.series['src' + id + src]);
    return fileP.then(function (f) {
      var d = f && f.series && f.series[id] && f.series[id][String(src)];
      if (d && d.length) { state.series['src' + id + src] = d; return d; }
      return live(id, src);
    });
  }
  function live(id, src) {
    var key = 'pf-chart-' + id + '-' + src, hit = cacheGet(key);
    if (hit) { state.series['src' + id + src] = hit.d; return Promise.resolve(hit.d); }
    return getJSON(API + 'coins/' + id + '/market_chart?vs_currency=usd&days=' + src).then(function (j) {
      var d = (j.prices || []).filter(function (p) { return p && p[1] > 0; });
      if (d.length > 400) { var s = Math.ceil(d.length / 400); d = d.filter(function (_, i) { return i % s === 0 || i === d.length - 1; }); }
      state.series['src' + id + src] = d; cacheSet(key, d);
      return d;
    }, function (err) {
      var old = cacheGet(key, true);   // refused: an older copy is better than no chart
      if (old) { state.series['src' + id + src] = old.d; return old.d; }
      throw err;
    });
  }
  function series(id, days) {
    if (state.series[id + days]) return Promise.resolve(state.series[id + days]);
    var src = SOURCE[days] || days;
    return download(id, src).then(function (d) { var c = src === days ? d : cut(d, days); state.series[id + days] = c; return c; });
  }
  var retryTimer = null;
  function loadChart(tries) {
    tries = tries || 0;
    clearTimeout(retryTimer);
    var msg = $('chart-msg');
    msg.textContent = t.loading; msg.hidden = false;
    document.querySelectorAll('[data-days]').forEach(function (b) { b.setAttribute('aria-pressed', String(Number(b.dataset.days) === state.days)); });
    var want = state.days;
    series(PEP, want).then(function () {
      if (want !== state.days) return;
      msg.hidden = true; drawChart();
      return series(PEPE, want).then(function () { if (want === state.days) drawChart(); });
    }).catch(function () {
      if (want !== state.days) return;
      if (state.series[PEP + want]) { msg.hidden = true; drawChart(); return; }
      $('chart').textContent = '';
      // the free limit resets within a minute: try again by itself, twice, before giving up
      if (tries < 2) { msg.textContent = t.loading; retryTimer = setTimeout(function () { if (want === state.days) loadChart(tries + 1); }, 20000); }
      else msg.textContent = t.chartFail;
    });
  }

  // Proof-of-work memecoins, biggest first. Rows start from the saved figures in the HTML (data-cap).
  function renderPow(by) {
    var list = $('pow-list');
    if (!list) return;
    var rows = Array.prototype.slice.call(list.children);
    rows.forEach(function (li) {
      var id = li.getAttribute('data-id'), c = by[id];
      if (id === PEP) li.setAttribute('data-cap', state.pep.mcap);
      else if (c && num(c.market_cap)) li.setAttribute('data-cap', c.market_cap);
    });
    rows.sort(function (a, b) { return b.getAttribute('data-cap') - a.getAttribute('data-cap'); });
    var n = 0;
    rows.forEach(function (li, i) {
      var v = Number(li.getAttribute('data-cap'));
      li.querySelector('.pow-n').textContent = String(i + 1);
      li.querySelector('.pow-bar i').style.width = Math.max(1, Math.min(100, (Math.log10(v) - 5) / 6 * 100)) + '%';
      li.querySelector('.pow-cap').textContent = usd(v);
      if (li.getAttribute('data-id') === PEP) n = i + 1;
      list.appendChild(li);
    });
    if (n && n !== 2) $('pow-lead').textContent = fill(t.powRank, { n: n });
  }

  function loadMarkets() {
    var hit;
    var p = window.PepPrices.markets().then(function (result) { hit = result; return result.d; });
    p.then(function (list) {
      var by = {};
      list.forEach(function (c) { by[c.id] = c; });
      var a = by[PEP];
      if (!a || num(a.current_price) === null) throw new Error('no PEP');
      var supply = num(a.total_supply) || num(a.circulating_supply) || SNAP.pep.supply;
      state.pep = { price: a.current_price, mcap: a.current_price * supply, change: num(a.price_change_percentage_24h), ath: num(a.ath), athDate: a.ath_date || SNAP.pep.athDate, supply: supply };
      var e = by[PEPE];
      if (e && num(e.current_price) !== null) state.pepe = { price: e.current_price, mcap: num(e.market_cap) || e.current_price * (num(e.circulating_supply) || 0), change: num(e.price_change_percentage_24h) };
      var coins = {};
      Object.keys(SNAP.coins).forEach(function (id) { coins[id] = by[id] && num(by[id].market_cap) ? by[id].market_cap : SNAP.coins[id]; });
      state.coins = coins;
      var top = list.filter(function (c) { return c.top; }).filter(function (c) { return num(c.market_cap); }).map(function (c) { return { id: c.id, cap: c.market_cap }; });
      state.top = top.length > 100 ? top : null;
      renderStats(); renderLadder(); renderPow(by);
      if ($('x-target').value) $('x-target').dispatchEvent(new Event('input'));
      $('status').textContent = window.PepPrices.describe(hit, LOC);
    }).catch(function () {
      return window.PepPrices.quote().then(function (q) {
        state.pep.price = q.usd; state.pep.change = q.change_24h;
        if (q.supply > 0) { state.pep.supply = q.supply; state.pep.mcap = q.usd * q.supply; }
        renderStats(); renderLadder(); renderPow({});
        if ($('x-target').value) $('x-target').dispatchEvent(new Event('input'));
        $('status').textContent = window.PepPrices.describe(q, LOC);
      }, function () { $('status').textContent = t.saved; });
    });
  }

  document.querySelectorAll('[data-days]').forEach(function (b) {
    b.addEventListener('click', function () { state.days = Number(b.dataset.days); loadChart(0); });
  });
  $('overlay').addEventListener('change', function (ev) { state.overlay = ev.target.checked; drawChart(); });
  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(drawChart, 150); });

  renderStats();
  renderPow({});
  wireLadder();
  setMult(100);
  window.PepPrices.subscribe(loadMarkets);
  loadChart();
})();
