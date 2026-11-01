(function () {
  // Languages with translated pages. A page lists its own translations as
  // <link rel="alternate" hreflang="…">; any other language links to its homepage.
  var LANGS = [
    { key: 'en', tag: 'en', name: 'English', short: 'EN', home: '/' },
    { key: 'pl', tag: 'pl', name: 'Polski', short: 'PL', home: '/pl/' },
    { key: 'es', tag: 'es', name: 'Español', short: 'ES', home: '/es/' },
    { key: 'de', tag: 'de', name: 'Deutsch', short: 'DE', home: '/de/' },
    { key: 'fr', tag: 'fr', name: 'Français', short: 'FR', home: '/fr/' },
    { key: 'tr', tag: 'tr', name: 'Türkçe', short: 'TR', home: '/tr/' },
    { key: 'it', tag: 'it', name: 'Italiano', short: 'IT', home: '/it/' },
    { key: 'zh', tag: 'zh-Hans', name: '简体中文', short: '中文', home: '/zh/' }
  ];
  var UI = {
    en: { copy: 'Copy', copied: 'Copied', theme: 'Theme', auto: 'Auto', light: 'Light', dark: 'Dark', sep: ': ', language: 'Language',
      start: 'Start here', startShort: 'Start', mine: 'Mining', data: 'Data & charts', games: 'Games', menu: 'Menu', top: 'Back to top', more: 'More', market: 'Market today', links: 'Links' },
    pl: { copy: 'Kopiuj', copied: 'Skopiowano', theme: 'Motyw', auto: 'Auto', light: 'Jasny', dark: 'Ciemny', sep: ': ', language: 'Język',
      start: 'Na start', startShort: 'Start', mine: 'Kopanie', data: 'Dane i wykresy', games: 'Gry', menu: 'Menu', top: 'Do góry', more: 'Więcej', market: 'Rynek dziś', links: 'Linki',
      hint: 'Ta strona jest dostępna także po polsku.', go: 'Czytaj po polsku', close: 'Zamknij' },
    es: { copy: 'Copiar', copied: 'Copiado', theme: 'Tema', auto: 'Auto', light: 'Claro', dark: 'Oscuro', sep: ': ', language: 'Idioma',
      start: 'Para empezar', startShort: 'Empezar', mine: 'Minería', data: 'Datos y gráficos', games: 'Juegos', menu: 'Menú', top: 'Volver arriba', more: 'Más', market: 'Mercado hoy', links: 'Enlaces',
      hint: 'Esta página también está en español.', go: 'Leer en español', close: 'Cerrar' },
    de: { copy: 'Kopieren', copied: 'Kopiert', theme: 'Design', auto: 'Auto', light: 'Hell', dark: 'Dunkel', sep: ': ', language: 'Sprache',
      start: 'Für den Einstieg', startShort: 'Start', mine: 'Mining', data: 'Daten & Charts', games: 'Spiele', menu: 'Menü', top: 'Nach oben', more: 'Mehr', market: 'Markt heute', links: 'Links',
      hint: 'Diese Seite gibt es auch auf Deutsch.', go: 'Auf Deutsch lesen', close: 'Schließen' },
    fr: { copy: 'Copier', copied: 'Copié', theme: 'Thème', auto: 'Auto', light: 'Clair', dark: 'Sombre', sep: ' : ', language: 'Langue',
      start: 'Pour commencer', startShort: 'Débuter', mine: 'Minage', data: 'Données et graphiques', games: 'Jeux', menu: 'Menu', top: 'Haut de page', more: 'Plus', market: 'Marché du jour', links: 'Liens',
      hint: 'Cette page existe aussi en français.', go: 'Lire en français', close: 'Fermer' },
    tr: { copy: 'Kopyala', copied: 'Kopyalandı', theme: 'Tema', auto: 'Otomatik', light: 'Açık', dark: 'Koyu', sep: ': ', language: 'Dil',
      start: 'Başlangıç', startShort: 'Başla', mine: 'Madencilik', data: 'Veriler ve grafikler', games: 'Oyunlar', menu: 'Menü', top: 'Başa dön', more: 'Daha fazla', market: 'Bugün piyasa', links: 'Bağlantılar',
      hint: 'Bu sayfa Türkçe olarak da mevcut.', go: 'Türkçe sürüme geç', close: 'Kapat' },
    it: { copy: 'Copia', copied: 'Copiato', theme: 'Tema', auto: 'Auto', light: 'Chiaro', dark: 'Scuro', sep: ': ', language: 'Lingua',
      start: 'Per iniziare', startShort: 'Inizia', mine: 'Mining', data: 'Dati e grafici', games: 'Giochi', menu: 'Menu', top: 'Torna su', more: 'Altro', market: 'Mercato oggi', links: 'Link',
      hint: 'Questa pagina è disponibile anche in italiano.', go: 'Leggi in italiano', close: 'Chiudi' },
    zh: { copy: '复制', copied: '已复制', theme: '主题', auto: '自动', light: '浅色', dark: '深色', sep: '：', language: '语言',
      start: '入门', startShort: '入门', mine: '挖矿', data: '数据与图表', games: '游戏', menu: '菜单', top: '返回顶部', more: '更多', market: '今日行情', links: '链接',
      hint: '本页面也有简体中文版。', go: '阅读中文版', close: '关闭' }
  };
  // Data strip under the header: today's figures from data/ticker.json (baked by scripts/prebake.mjs: price hourly,
  // the rest daily). Change STRIP_ID when the strip changes, so it comes back for readers who hid it.
  var STRIP_ID = '2026-10-21b';
  var STRIP_T = {
    en: { label: 'PEP today', price: 'PEP price', d24: '24h', hash: 'Hashrate', yday: 'vs yesterday', tops: 'Top 10 / 50 / 400 addresses hold', supply: 'of supply',
      fresh: 'New addresses in the top 2000', since: 'since yesterday', pause: 'Pause', play: 'Play', hide: 'Hide this strip', src: 'Sources', snap: 'snapshot' },
    pl: { label: 'PEP dziś', price: 'Cena PEP', d24: '24h', hash: 'Hashrate', yday: 'od wczoraj', tops: 'Top 10 / 50 / 400 adresów trzyma', supply: 'podaży',
      fresh: 'Nowe adresy w top 2000', since: 'od wczoraj', pause: 'Zatrzymaj', play: 'Wznów', hide: 'Ukryj pasek', src: 'Źródła', snap: 'snapshot' },
    es: { label: 'PEP hoy', price: 'Precio de PEP', d24: '24h', hash: 'Hashrate', yday: 'vs. ayer', tops: 'Las 10 / 50 / 400 mayores direcciones tienen', supply: 'del suministro',
      fresh: 'Direcciones nuevas en el top 2000', since: 'desde ayer', pause: 'Pausar', play: 'Reanudar', hide: 'Ocultar esta barra', src: 'Fuentes', snap: 'instantánea' },
    de: { label: 'PEP heute', price: 'PEP-Kurs', d24: '24h', hash: 'Hashrate', yday: 'ggü. gestern', tops: 'Top 10 / 50 / 400 Adressen halten', supply: 'der Coinmenge',
      fresh: 'Neue Adressen in den Top 2000', since: 'seit gestern', pause: 'Anhalten', play: 'Fortsetzen', hide: 'Leiste ausblenden', src: 'Quellen', snap: 'Snapshot' },
    fr: { label: 'PEP aujourd’hui', price: 'Prix du PEP', d24: '24 h', hash: 'Hashrate', yday: 'vs hier', tops: 'Les 10 / 50 / 400 plus grosses adresses détiennent', supply: 'de l’offre',
      fresh: 'Nouvelles adresses dans le top 2000', since: 'depuis hier', pause: 'Pause', play: 'Lecture', hide: 'Masquer ce bandeau', src: 'Sources', snap: 'instantané' },
    tr: { label: 'Bugün PEP', price: 'PEP fiyatı', d24: '24s', hash: 'Hashrate', yday: 'düne göre', tops: 'İlk 10 / 50 / 400 adresin arzdaki payı', supply: '',
      fresh: 'İlk 2000’e giren yeni adresler', since: 'dünden beri', pause: 'Durdur', play: 'Oynat', hide: 'Şeridi gizle', src: 'Kaynaklar', snap: 'anlık görüntü' },
    it: { label: 'PEP oggi', price: 'Prezzo di PEP', d24: '24h', hash: 'Hashrate', yday: 'rispetto a ieri', tops: 'I primi 10 / 50 / 400 indirizzi detengono', supply: 'dell’offerta',
      fresh: 'Nuovi indirizzi nella top 2000', since: 'da ieri', pause: 'Pausa', play: 'Riprendi', hide: 'Nascondi questa barra', src: 'Fonti', snap: 'snapshot' },
    zh: { label: 'PEP 今日', price: 'PEP 价格', d24: '24 小时', hash: '算力', yday: '较昨日', tops: '前 10 / 50 / 400 个地址持有', supply: '的供应',
      fresh: '新进前 2000 的地址', since: '较昨日', pause: '暂停', play: '继续', hide: '隐藏', src: '数据来源', snap: '快照' }
  };
  // the site root (where chrome.js lives), for links and data from any folder
  var ROOT = (function () {
    var s = document.currentScript || document.querySelector('script[src*="chrome.js"]');
    try { return new URL('./', s.src).href; } catch (e) { return '/'; }
  })();
  function keyOf(tag) {
    tag = (tag || 'en').toLowerCase();
    return tag.indexOf('zh') === 0 ? 'zh' : tag.split('-')[0];
  }
  var pageKey = UI[keyOf(document.documentElement.lang)] ? keyOf(document.documentElement.lang) : 'en';
  var t = UI[pageKey];

  function alternates() {
    var alt = {};
    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(function (l) {
      var h = l.getAttribute('hreflang');
      if (h === 'x-default') return;
      try { alt[keyOf(h)] = new URL(l.href).pathname; } catch (e) {}
    });
    return alt;
  }

  function themeNow() {
    return document.documentElement.getAttribute('data-theme') || 'auto';
  }

  function langMenu(alt) {
    var menu = document.createElement('details');
    menu.className = 'langmenu';
    var sum = document.createElement('summary');
    sum.className = 'iconbtn';
    sum.setAttribute('aria-label', t.language);
    sum.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4">' +
      '<circle cx="8" cy="8" r="6.3"/><path d="M1.9 8h12.2M8 1.7c-3.4 3.6-3.4 9 0 12.6M8 1.7c3.4 3.6 3.4 9 0 12.6"/></svg>';
    var cur = LANGS.filter(function (l) { return l.key === pageKey; })[0];
    sum.appendChild(document.createTextNode(cur.short));
    menu.appendChild(sum);
    var list = document.createElement('ul');
    LANGS.forEach(function (l) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = alt[l.key] || (l.key === pageKey ? location.pathname : l.home);
      a.lang = l.tag;
      a.hreflang = l.tag;
      a.textContent = l.name;
      if (l.key === pageKey) a.setAttribute('aria-current', 'true');
      li.appendChild(a);
      list.appendChild(li);
    });
    menu.appendChild(list);
    document.addEventListener('click', function (e) {
      if (menu.open && !menu.contains(e.target)) menu.open = false;
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.open) { menu.open = false; sum.focus(); }
    });
    return menu;
  }

  // On an English page, offer the visitor's own language once, if this page has it.
  function langHint(alt) {
    if (pageKey !== 'en') return;
    try { if (localStorage.getItem('phw-lang-hint') === 'off') return; } catch (e) {}
    var prefs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
    var target = null;
    for (var i = 0; i < prefs.length && !target; i++) {
      var p = (prefs[i] || '').toLowerCase();
      var k = keyOf(p);
      if (k === 'en') return;
      if (k === 'zh' && /^zh-(tw|hk|mo|hant)/.test(p)) continue;
      if (UI[k] && UI[k].hint && alt[k]) target = k;
    }
    var head = document.querySelector('.site-head, .pf-head');
    if (!target || !head) return;
    var h = UI[target];
    var bar = document.createElement('div');
    bar.className = 'lang-hint';
    bar.lang = LANGS.filter(function (l) { return l.key === target; })[0].tag;
    var msg = document.createElement('span');
    msg.textContent = h.hint;
    var go = document.createElement('a');
    go.href = alt[target];
    go.hreflang = bar.lang;
    go.textContent = h.go;
    var x = document.createElement('button');
    x.type = 'button';
    x.className = 'lang-hint-x';
    x.setAttribute('aria-label', h.close);
    x.textContent = '×';
    x.addEventListener('click', function () {
      bar.remove();
      try { localStorage.setItem('phw-lang-hint', 'off'); } catch (e) {}
    });
    bar.appendChild(msg);
    bar.appendChild(go);
    bar.appendChild(x);
    head.insertAdjacentElement('afterend', bar);
  }

  // Home page only, once: red pill for the meme edition, blue pill to stay here. Remembered after a choice.
  var PILL = {
    en: ['Choose your frog.', 'Same facts either way.', 'Meme mode', 'Serious'],
    pl: ['Wybierz swoją żabę.', 'Te same fakty w obu wersjach.', 'Wersja meme', 'Poważna'],
    es: ['Elige tu rana.', 'Los mismos datos en ambas.', 'Modo meme', 'En serio'],
    de: ['Wähle deinen Frosch.', 'Dieselben Fakten in beiden.', 'Meme-Modus', 'Seriös'],
    fr: ['Choisis ta grenouille.', 'Les mêmes faits des deux côtés.', 'Mode meme', 'Sérieux'],
    tr: ['Kurbağanı seç.', 'İkisinde de aynı bilgiler.', 'Meme modu', 'Ciddi'],
    it: ['Scegli la tua rana.', 'Gli stessi fatti in entrambe.', 'Modalità meme', 'Seria'],
    zh: ['选择你的青蛙。', '两种版本，事实相同。', '表情包版', '正经版']
  };
  function pillBar() {
    var head = document.querySelector('.site-head');
    if (!head || !document.querySelector('.home-hero')) return;
    try { if (localStorage.getItem('hub-pill')) return; } catch (e) {}
    var L = PILL[pageKey] || PILL.en;
    var bar = document.createElement('div');
    bar.className = 'pill-bar';
    bar.innerHTML = '<p><b></b> <span></span></p><div class="pill-bar-btns"><a class="pb-red" href="' + ROOT + 'meme/"><i aria-hidden="true"></i><span></span></a><button type="button" class="pb-blue"><i aria-hidden="true"></i><span></span></button></div>';
    bar.querySelector('p b').textContent = L[0];
    bar.querySelector('p span').textContent = L[1];
    bar.querySelector('.pb-red span').textContent = L[2] + (pageKey === 'en' ? '' : ' (EN)');
    bar.querySelector('.pb-blue span').textContent = L[3];
    function pick(v) { try { localStorage.setItem('hub-pill', v); localStorage.setItem('hub-mode', v); } catch (e) {} }
    bar.querySelector('.pb-red').addEventListener('click', function () { pick('meme'); });
    bar.querySelector('.pb-blue').addEventListener('click', function () { pick('serious'); bar.remove(); });
    head.insertAdjacentElement('afterend', bar);
  }

  function mount() {
    var nav = document.querySelector('.site-nav, .pf-nav');
    if (!nav || nav.querySelector('[data-chrome]')) return;
    var alt = alternates();
    var head = nav.closest('.site-head');
    if (head) buildHead(head, nav, alt);
    else {
      var box = document.createElement('span');
      box.className = 'head-controls';
      box.setAttribute('data-chrome', '1');
      box.appendChild(themeButton());
      box.appendChild(langMenu(alt));
      nav.appendChild(box);
    }
    footNav();
    linkHosts();
    linkFold();
    backToTop();
    bgLayer();
    langHint(alt);
    pillBar();
    dataStrip();
    supportCopy();
    pageCopy();
  }

  // Day / night: one emoji button. It shows the moon by day and the sun at night; the choice is remembered.
  function darkNow() {
    var th = themeNow();
    return th === 'dark' || (th === 'auto' && !!window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function themeButton() {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'theme-emoji';
    b.setAttribute('data-chrome', 'theme');
    function paint() {
      var dark = darkNow();
      b.textContent = dark ? '☀️' : '🌙';
      b.title = t.theme + t.sep + (dark ? t.light : t.dark);
      b.setAttribute('aria-label', b.title);
    }
    b.addEventListener('click', function () {
      var next = darkNow() ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('phw-theme', next); } catch (e) {}
      b.classList.remove('spin'); void b.offsetWidth; b.classList.add('spin');
      paint();
    });
    if (window.matchMedia) {
      var mq = matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) mq.addEventListener('change', paint);
    }
    paint();
    return b;
  }

  // Every page of the site, in four groups: understand PEP, get it, its numbers, the community.
  // The header menu and the footer are both built from this list. [file, icon, label, short line] per language.
  var MENU_H = {
    en: ['Understand PEP', 'Buy, store, mine', 'Numbers & charts', 'Community'],
    pl: ['Poznaj PEP', 'Kup, przechowuj, kop', 'Liczby i wykresy', 'Społeczność'],
    es: ['Conoce PEP', 'Comprar, guardar, minar', 'Datos y gráficos', 'Comunidad'],
    de: ['PEP verstehen', 'Kaufen, aufbewahren, minen', 'Daten & Charts', 'Community'],
    fr: ['Comprendre PEP', 'Acheter, garder, miner', 'Données et graphiques', 'Communauté'],
    tr: ['PEP’i tanı', 'Al, sakla, kaz', 'Veriler ve grafikler', 'Topluluk'],
    it: ['Conosci PEP', 'Compra, custodisci, mina', 'Dati e grafici', 'Community'],
    zh: ['了解 PEP', '购买、存放、挖矿', '数据与图表', '社区']
  };
  var MENU = [
    [ // understand
      ['which-pepecoin', { en: ['PEP vs PEPE', 'Which frog is which'], pl: ['PEP vs PEPE', 'Która żaba jest która'], es: ['PEP vs PEPE', 'Qué rana es cuál'],
        de: ['PEP vs PEPE', 'Welcher Frosch welcher ist'], fr: ['PEP vs PEPE', 'Quelle grenouille est laquelle'], tr: ['PEP vs PEPE', 'Hangi kurbağa hangisi'],
        it: ['PEP vs PEPE', 'Quale rana è quale'], zh: ['PEP vs PEPE', '分清是哪只青蛙'] }],
      ['compare', { en: ['PEP and DOGE', 'Side by side with Dogecoin'], pl: ['PEP i DOGE', 'Obok Dogecoina, punkt po punkcie'], es: ['PEP y DOGE', 'Frente a Dogecoin, punto por punto'],
        de: ['PEP und DOGE', 'Neben Dogecoin, Punkt für Punkt'], fr: ['PEP et DOGE', 'Face à Dogecoin, point par point'], tr: ['PEP ve DOGE', 'Dogecoin ile yan yana'],
        it: ['PEP e DOGE', 'Accanto a Dogecoin, punto per punto'], zh: ['PEP 与 DOGE', '与狗狗币逐项对比'] }],
      ['scrypt-family', { en: ['Scrypt family', 'Merged mining with LTC and DOGE'], pl: ['Rodzina Scrypt', 'Merged mining z LTC i DOGE'], es: ['Familia Scrypt', 'Merged mining con LTC y DOGE'],
        de: ['Scrypt-Familie', 'Merged Mining mit LTC und DOGE'], fr: ['Famille Scrypt', 'Merged mining avec LTC et DOGE'], tr: ['Scrypt ailesi', 'LTC ve DOGE ile merged mining'],
        it: ['Famiglia Scrypt', 'Merged mining con LTC e DOGE'], zh: ['Scrypt 家族', '与 LTC、DOGE 合并挖矿'] }],
      ['mica', { en: ['MiCA whitepaper', 'The EU document, explained'], pl: ['Whitepaper MiCA', 'Dokument UE po ludzku'], es: ['Whitepaper MiCA', 'El documento de la UE, explicado'],
        de: ['MiCA-Whitepaper', 'Das EU-Dokument erklärt'], fr: ['Whitepaper MiCA', 'Le document de l’UE expliqué'], tr: ['MiCA whitepaper', 'AB belgesi, açıklamalı'],
        it: ['Whitepaper MiCA', 'Il documento UE spiegato'], zh: ['MiCA whitepaper', '欧盟文件解读'] }],
      ['glossary', { en: ['Glossary', 'AuxPoW, UTXO, halving in plain words'], pl: ['Słowniczek', 'AuxPoW, UTXO, halving prostymi słowami'], es: ['Glosario', 'AuxPoW, UTXO, halving en palabras simples'],
        de: ['Glossar', 'AuxPoW, UTXO, Halving einfach erklärt'], fr: ['Glossaire', 'AuxPoW, UTXO, halving en mots simples'], tr: ['Sözlük', 'AuxPoW, UTXO, halving sade dille'],
        it: ['Glossario', 'AuxPoW, UTXO, halving in parole semplici'], zh: ['术语表', '用大白话讲 AuxPoW、UTXO、减半'] }]
    ],
    [ // get it
      ['buy', { en: ['How to buy PEP', 'Exchanges and withdrawing'], pl: ['Jak kupić PEP', 'Giełdy i wypłata na portfel'], es: ['Cómo comprar PEP', 'Exchanges y retiro a tu billetera'],
        de: ['PEP kaufen', 'Börsen und Auszahlung'], fr: ['Acheter du PEP', 'Plateformes et retrait'], tr: ['PEP nasıl alınır', 'Borsalar ve çekim'],
        it: ['Come comprare PEP', 'Exchange e prelievo'], zh: ['如何购买 PEP', '交易所与提币'] }],
      ['wallets', { en: ['Wallets', 'Core, Tangem, paper'], pl: ['Portfele', 'Core, Tangem, papierowy'], es: ['Billeteras', 'Core, Tangem, de papel'],
        de: ['Wallets', 'Core, Tangem, Paper Wallet'], fr: ['Portefeuilles', 'Core, Tangem, papier'], tr: ['Cüzdanlar', 'Core, Tangem, kâğıt'],
        it: ['Wallet', 'Core, Tangem, di carta'], zh: ['钱包', 'Core、Tangem、纸钱包'] }],
      ['mining', { en: ['Mining', 'Pools, Antminer, unMineable'], pl: ['Kopanie', 'Poole, Antminer, unMineable'], es: ['Minería', 'Pools, Antminer, unMineable'],
        de: ['Mining', 'Pools, Antminer, unMineable'], fr: ['Minage', 'Pools, Antminer, unMineable'], tr: ['Madencilik', 'Havuzlar, Antminer, unMineable'],
        it: ['Mining', 'Pool, Antminer, unMineable'], zh: ['挖矿', '矿池、Antminer、unMineable'] }],
      ['guides', { en: ['Guides', 'All guides in one place'], pl: ['Poradniki', 'Wszystkie poradniki w jednym miejscu'], es: ['Guías', 'Todas las guías en un lugar'],
        de: ['Ratgeber', 'Alle Ratgeber auf einen Blick'], fr: ['Guides', 'Tous les guides au même endroit'], tr: ['Rehberler', 'Tüm rehberler tek yerde'],
        it: ['Guide', 'Tutte le guide in un posto'], zh: ['指南', '所有指南一览'] }]
    ],
    [ // numbers
      ['price', { en: ['Price', 'Live chart, Pepe overlay, ×100'], pl: ['Cena', 'Wykres na żywo, nakładka Pepe, ×100'], es: ['Precio', 'Gráfico en vivo, Pepe superpuesto, ×100'],
        de: ['Kurs', 'Live-Chart, Pepe-Overlay, ×100'], fr: ['Prix', 'Graphique en direct, Pepe superposé, ×100'], tr: ['Fiyat', 'Canlı grafik, Pepe katmanı, ×100'],
        it: ['Prezzo', 'Grafico live, Pepe sovrapposto, ×100'], zh: ['价格', '实时图表、Pepe 叠加、×100'] }],
      ['market', { en: ['Market today', 'BTC, LTC, DOGE and PEP today'], pl: ['Rynek dziś', 'BTC, LTC, DOGE i PEP dziś'], es: ['Mercado hoy', 'BTC, LTC, DOGE y PEP hoy'],
        de: ['Markt heute', 'BTC, LTC, DOGE und PEP heute'], fr: ['Marché du jour', 'BTC, LTC, DOGE et PEP aujourd’hui'], tr: ['Bugün piyasa', 'Bugün BTC, LTC, DOGE ve PEP'],
        it: ['Mercato oggi', 'BTC, LTC, DOGE e PEP oggi'], zh: ['今日行情', '今日 BTC、LTC、DOGE 与 PEP'] }],
      ['network', { en: ['Network', 'Hashrate, blocks, explorers'], pl: ['Sieć', 'Hashrate, bloki, eksploratory'], es: ['Red', 'Hashrate, bloques, exploradores'],
        de: ['Netzwerk', 'Hashrate, Blöcke, Explorer'], fr: ['Réseau', 'Hashrate, blocs, explorateurs'], tr: ['Ağ', 'Hashrate, bloklar, explorer’lar'],
        it: ['Rete', 'Hashrate, blocchi, explorer'], zh: ['网络', '算力、区块、区块浏览器'] }],
      ['supply', { en: ['Supply', 'No max supply, falling inflation'], pl: ['Podaż', 'Bez limitu, malejąca inflacja'], es: ['Suministro', 'Sin límite, inflación decreciente'],
        de: ['Coinmenge', 'Keine Obergrenze, sinkende Inflation'], fr: ['Offre', 'Pas de plafond, inflation en baisse'], tr: ['Arz', 'Üst sınır yok, düşen enflasyon'],
        it: ['Offerta', 'Nessun tetto, inflazione in calo'], zh: ['供应量', '无上限，通胀递减'] }],
      ['rich-list', { en: ['Rich list', 'Biggest holders and their share'], pl: ['Najbogatsze adresy', 'Najwięksi posiadacze i ich udział'], es: ['Mayores tenedores', 'Quién tiene más y qué porcentaje'],
        de: ['Rich List', 'Größte Holder und ihr Anteil'], fr: ['Plus grosses adresses', 'Plus gros détenteurs et leur part'], tr: ['Zenginler listesi', 'En büyük sahipler ve payları'],
        it: ['Rich list', 'Maggiori holder e la loro quota'], zh: ['富豪榜', '最大持有者及其占比'] }],
      ['calculator', { en: ['Calculator', 'Your PEP at DOGE’s market cap'], pl: ['Kalkulator', 'Twój PEP przy kapitalizacji DOGE'], es: ['Calculadora', 'Tus PEP con la capitalización de DOGE'],
        de: ['Rechner', 'Deine PEP bei DOGEs Marktkapitalisierung'], fr: ['Calculateur', 'Tes PEP à la capitalisation de DOGE'], tr: ['Hesaplayıcı', 'PEP’lerin DOGE piyasa değerinde'],
        it: ['Calcolatore', 'I tuoi PEP alla capitalizzazione di DOGE'], zh: ['计算器', '按 DOGE 市值算你的 PEP'] }]
    ],
    [ // community
      ['links', { en: ['Links', 'Official and community sites'], pl: ['Linki', 'Oficjalne i od społeczności'], es: ['Enlaces', 'Oficiales y de la comunidad'],
        de: ['Links', 'Offizielle und Community-Seiten'], fr: ['Liens', 'Officiels et communautaires'], tr: ['Bağlantılar', 'Resmî ve topluluk siteleri'],
        it: ['Link', 'Ufficiali e della community'], zh: ['链接', '官方与社区网站'] }],
      ['press', { en: ['For media', 'Facts, sources, logo'], pl: ['Dla mediów', 'Fakty, źródła, logo'], es: ['Para medios', 'Datos, fuentes, logo'],
        de: ['Für Medien', 'Fakten, Quellen, Logo'], fr: ['Pour les médias', 'Faits, sources, logo'], tr: ['Basın için', 'Bilgiler, kaynaklar, logo'],
        it: ['Per i media', 'Fatti, fonti, logo'], zh: ['媒体资料', '事实、来源、标志'] }],
      ['meme/', { en: ['Meme edition', 'Same facts, with memes'], pl: ['Wersja meme', 'Te same fakty z memami (EN)'], es: ['Versión meme', 'Los mismos datos con memes (EN)'],
        de: ['Meme-Version', 'Dieselben Fakten mit Memes (EN)'], fr: ['Version meme', 'Les mêmes faits avec des memes (EN)'], tr: ['Meme sürümü', 'Aynı bilgiler, memelerle (EN)'],
        it: ['Versione meme', 'Gli stessi fatti con i meme (EN)'], zh: ['表情包版', '同样的事实，配上表情包（英文）'] }]
    ]
  ];
  // menu link for a page: games and the meme edition are in English at the site root, the rest in this page's language
  function menuLinks() {
    var base = ROOT + (pageKey === 'en' ? '' : pageKey + '/'), here = location.pathname.replace(/index\.html$/, '');
    return MENU.map(function (group) {
      return group.map(function (it) {
        var key = it[0].replace(/\/$/, ''), words = it[1][pageKey] || it[1].en;
        var href = /\/$/.test(it[0]) ? ROOT + it[0] : base + it[0] + '.html';
        var path = new URL(href, location.href).pathname, cur = /\/$/.test(it[0]) ? here.indexOf(path) === 0 : here === path;
        return { key: key, href: href, label: words[0], line: words[1], current: cur };
      });
    });
  }

  // Header: the logo, the Serious | Meme switch, then day / night, language and one Menu button.
  // The menu opens a single panel with every page in four groups; on a phone it fills the screen below the header.
  function buildHead(head, nav, alt) {
    var H = MENU_H[pageKey] || MENU_H.en, groups = menuLinks(), uid = 'site-menu';
    head.classList.add('head-v2');
    var logo = head.querySelector('.brand-hub-link, .brand');
    var mode = memeLink();
    if (logo) logo.insertAdjacentElement('afterend', mode); else head.insertBefore(mode, head.firstChild);
    nav.setAttribute('data-chrome', '1');
    nav.classList.add('built');
    var keep = Array.prototype.slice.call(nav.children);
    keep.forEach(function (el) { el.remove(); });

    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'menu-btn';
    btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', uid);
    btn.innerHTML = '<span class="menu-bars" aria-hidden="true"><i></i><i></i><i></i></span><b></b>';
    btn.querySelector('b').textContent = t.menu;

    var panel = document.createElement('div');
    panel.className = 'mega'; panel.id = uid; panel.hidden = true;
    var cols = document.createElement('div'); cols.className = 'mega-cols';
    groups.forEach(function (links, gi) {
      var col = document.createElement('section'); col.className = 'mega-col';
      var h = document.createElement('p'); h.className = 'mega-h';
      h.innerHTML = '<span class="mega-n"></span><span></span>';
      h.firstChild.textContent = '0' + (gi + 1); h.lastChild.textContent = H[gi];
      col.appendChild(h);
      links.forEach(function (l) {
        var a = document.createElement('a');
        a.className = 'mega-a'; a.href = l.href; a.setAttribute('data-p', l.key);
        if (l.key === 'games' || l.key === 'meme') a.hreflang = 'en';
        if (l.current) a.setAttribute('aria-current', 'page');
        a.innerHTML = '<i class="mega-i" aria-hidden="true"></i><span><b></b><small></small></span>';
        a.querySelector('b').textContent = l.label; a.querySelector('small').textContent = l.line;
        col.appendChild(a);
      });
      if (gi === groups.length - 1) {
        var soc = document.createElement('p'); soc.className = 'mega-social';
        SOCIAL.slice(0, 4).forEach(function (x) { var s = document.createElement('a'); s.href = x[1]; s.rel = 'noopener'; s.textContent = x[0]; soc.appendChild(s); });
        col.appendChild(soc);
      }
      cols.appendChild(col);
    });
    panel.appendChild(cols);
    // phone: the languages as one row at the bottom of the menu
    var langs = document.createElement('p'); langs.className = 'mega-langs';
    var lh = document.createElement('span'); lh.textContent = t.language; langs.appendChild(lh);
    LANGS.forEach(function (l) {
      var a = document.createElement('a');
      a.href = alt[l.key] || (l.key === pageKey ? location.pathname : l.home);
      a.lang = l.tag; a.hreflang = l.tag; a.textContent = l.short; a.title = l.name;
      if (l.key === pageKey) a.setAttribute('aria-current', 'true');
      langs.appendChild(a);
    });
    panel.appendChild(langs);

    nav.appendChild(themeButton());
    nav.appendChild(langMenu(alt));
    nav.appendChild(btn);
    head.appendChild(panel);

    function set(open) {
      panel.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      head.classList.toggle('menu-open', open);
      document.documentElement.classList.toggle('menu-lock', open);
    }
    btn.addEventListener('click', function (e) { e.stopPropagation(); set(panel.hidden); });
    document.addEventListener('click', function (e) { if (!panel.hidden && !head.contains(e.target)) set(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) { set(false); btn.focus(); } });

    // no bar at the top of the page; once the page scrolls, a soft frosted strip behind the header
    var stuck = false;
    function onScroll() { var s = window.scrollY > 8; if (s !== stuck) { stuck = s; head.classList.toggle('stuck', s); } }
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }

  // The meme edition (English only, /meme/): the same page there when it has one, else its home page.
  var MEME = ['index', 'which-pepecoin', 'compare', 'scrypt-family', 'mica', 'calculator', 'price', 'supply', 'network', 'rich-list', 'mining', 'buy', 'wallets', 'glossary'];
  var MODE = { en: ['Serious', 'Meme', 'Switch to the meme edition (English)'], pl: ['Serio', 'Meme', 'Przełącz na wersję meme (po angielsku)'],
    es: ['Serio', 'Meme', 'Cambiar a la versión meme (en inglés)'], de: ['Seriös', 'Meme', 'Zur Meme-Version wechseln (Englisch)'],
    fr: ['Sérieux', 'Meme', 'Passer à la version meme (en anglais)'], tr: ['Ciddi', 'Meme', 'Meme sürümüne geç (İngilizce)'],
    it: ['Serio', 'Meme', 'Passa alla versione meme (in inglese)'], zh: ['正经', '表情包', '切换到表情包版（英文）'] };
  // A two-sided switch: the knob sits on "Serious" here; a click slides it to "Meme" and opens the meme edition.
  function memeLink() {
    var m = location.pathname.match(/([a-z-]+)\.html$/), page = m ? m[1] : 'index', L = MODE[pageKey] || MODE.en;
    var a = document.createElement('a');
    a.className = 'mode-toggle';
    a.href = ROOT + 'meme/' + (page !== 'index' && MEME.indexOf(page) >= 0 ? page + '.html' : '');
    a.title = L[2];
    a.setAttribute('aria-label', L[2]);
    a.innerHTML = '<span class="mt-a"></span><span class="mt-b"></span>';
    a.firstChild.textContent = L[0]; a.lastChild.textContent = L[1];
    a.addEventListener('click', function (e) {
      try { localStorage.setItem('hub-mode', 'meme'); } catch (err) {}
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
      e.preventDefault(); a.classList.add('to-b');
      setTimeout(function () { location.href = a.href; }, 220);
    });
    return a;
  }


  // Footer: the logo with the "community fact pages" line and the community links, then every page of the site
  // in the same four groups as the header menu, then the small print.
  var SOCIAL = [['Reddit', 'https://reddit.com/r/pepecoin'], ['Discord', 'https://pepecoin.com/discord'], ['Telegram', 'https://t.me/PepecoinGroup'],
    ['X', 'https://x.com/PepecoinNetwork'], ['GitHub', 'https://github.com/PepecoinHub/pepecoinhub.github.io']];
  function footNav() {
    var foot = document.querySelector('footer.site-foot');
    if (!foot || foot.querySelector('.foot-top') || !document.querySelector('.site-head.head-v2')) return;
    var top = document.createElement('div'); top.className = 'foot-top';
    var brand = document.createElement('div'); brand.className = 'foot-brand';
    var logo = document.querySelector('.site-head .brand-hub-link');
    if (logo) { logo = logo.cloneNode(true); logo.classList.add('foot-logo'); brand.appendChild(logo); }
    var intro = foot.querySelector(':scope > p');
    if (intro) brand.appendChild(intro);
    var soc = document.createElement('p'); soc.className = 'foot-social';
    SOCIAL.forEach(function (x) { var a = document.createElement('a'); a.href = x[1]; a.textContent = x[0]; a.rel = 'noopener'; soc.appendChild(a); });
    brand.appendChild(soc);
    top.appendChild(brand);
    var box = document.createElement('nav'); box.className = 'foot-nav'; box.setAttribute('aria-label', t.menu);
    var H = MENU_H[pageKey] || MENU_H.en;
    menuLinks().forEach(function (links, gi) {
      var d = document.createElement('div'), h = document.createElement('p'); h.className = 'foot-h'; h.textContent = H[gi]; d.appendChild(h);
      links.forEach(function (l) {
        var c = document.createElement('a'); c.href = l.href; c.textContent = l.label;
        if (l.current) c.setAttribute('aria-current', 'page');
        d.appendChild(c);
      });
      box.appendChild(d);
    });
    top.appendChild(box);
    var fine = document.createElement('div'); fine.className = 'foot-fine';
    while (foot.firstChild) fine.appendChild(foot.firstChild);
    foot.appendChild(top); foot.appendChild(fine);
  }

  // Link lists: show the real domain each link opens, so it can be checked before clicking.
  function linkHosts() {
    document.querySelectorAll('.linkgroup li > a[href^="http"]').forEach(function (a) {
      if (a.parentNode.querySelector('.lg-host')) return;
      var h = document.createElement('span'); h.className = 'lg-host'; h.textContent = a.hostname.replace(/^www\./, '');
      a.insertAdjacentElement('afterend', h);
    });
  }

  // Home page links: on a phone each group folds to its heading (with the number of links), except "Official".
  function linkFold() {
    var groups = Array.prototype.slice.call(document.querySelectorAll('#links ~ .linkgroups .linkgroup'));
    if (!groups.length || !window.matchMedia) return;
    var mq = matchMedia('(max-width: 640px)'), items = [];
    groups.forEach(function (g, i) {
      var h = g.querySelector('h3'), ul = g.querySelector('ul');
      if (!h || !ul) return;
      var b = document.createElement('button'); b.type = 'button'; b.className = 'lg-toggle';
      while (h.firstChild) b.appendChild(h.firstChild);
      var n = document.createElement('span'); n.className = 'lg-count'; n.textContent = ul.children.length; b.appendChild(n);
      h.appendChild(b);
      ul.id = ul.id || 'lg-list-' + i; b.setAttribute('aria-controls', ul.id);
      b.addEventListener('click', function () { if (mq.matches) set(g, b, g.classList.contains('lg-closed')); });
      items.push([g, b, i]);
    });
    function set(g, b, open) { g.classList.toggle('lg-closed', !open); b.setAttribute('aria-expanded', String(open)); }
    function apply() {
      items.forEach(function (it) {
        if (mq.matches) { it[1].disabled = false; set(it[0], it[1], it[2] === 0); }
        else { it[1].disabled = true; it[0].classList.remove('lg-closed'); it[1].removeAttribute('aria-expanded'); }
      });
    }
    apply();
    if (mq.addEventListener) mq.addEventListener('change', apply); else if (mq.addListener) mq.addListener(apply);
  }

  // A round "back to top" button once the reader has scrolled down a bit.
  function backToTop() {
    if (document.querySelector('.mn')) return; // Pepe Miner has its own corner toasts
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'totop'; b.setAttribute('aria-label', t.top); b.title = t.top;
    b.innerHTML = '<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    b.addEventListener('click', function () {
      var smooth = !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
      window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
    });
    document.body.appendChild(b);
    var shown = false;
    function check() { var s = window.scrollY > 600; if (s !== shown) { shown = s; b.classList.toggle('on', s); } }
    window.addEventListener('scroll', check, { passive: true }); check();
  }

  // Background: soft drifting light everywhere (CSS), plus faint P coins drifting across the whole page on the
  // home and games pages that dodge the mouse pointer. Only with a mouse (a phone has no pointer to dodge)
  // and never with reduced motion. The loop pauses by itself in a background tab (requestAnimationFrame).
  function bgLayer() {
    if (!window.matchMedia || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (!document.querySelector('.home-hero') && !/\/games\//.test(location.pathname)) return;
    if (document.querySelector('.mn')) return;
    var l = document.createElement('div'); l.className = 'bg-coins'; l.setAttribute('aria-hidden', 'true');
    var W = window.innerWidth, H = window.innerHeight, coins = [];
    var n = Math.max(8, Math.min(16, Math.round(W * H / 90000)));
    for (var i = 0; i < n; i++) {
      var c = { el: document.createElement('i'), s: Math.round(18 + Math.random() * 18), x: Math.random() * W, y: Math.random() * H,
        vx: 0, vy: 0, rise: 8 + Math.random() * 12, sway: 10 + Math.random() * 16, w: 0.25 + Math.random() * 0.3, ph: Math.random() * 6.3 };
      c.el.style.cssText = 'width:' + c.s + 'px;height:' + c.s + 'px;opacity:' + (0.09 + Math.random() * 0.07).toFixed(2);
      l.appendChild(c.el); coins.push(c);
    }
    document.body.insertBefore(l, document.body.firstChild);

    var mx = -1e4, my = -1e4, R = 150, last = 0;
    window.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse') { mx = e.clientX; my = e.clientY; } }, { passive: true });
    document.addEventListener('mouseout', function (e) { if (!e.relatedTarget) { mx = my = -1e4; } });
    window.addEventListener('resize', function () { W = window.innerWidth; H = window.innerHeight; });
    function frame(t) {
      var dt = Math.min(0.05, last ? (t - last) / 1000 : 0), sec = t / 1000, damp = Math.exp(-2.2 * dt);
      last = t;
      coins.forEach(function (c) {
        var r = c.s / 2, dx = c.x + r - mx, dy = c.y + r - my, d2 = dx * dx + dy * dy;
        if (d2 < R * R) {   // the closer the pointer, the harder the push away from it
          var d = Math.sqrt(d2) || 1, f = (1 - d / R) * 2600 * dt;
          c.vx += dx / d * f; c.vy += dy / d * f;
        }
        c.vx *= damp; c.vy *= damp;
        c.x += (c.vx + Math.cos(sec * c.w + c.ph) * c.sway * c.w) * dt;
        c.y += (c.vy - c.rise) * dt;
        if (c.y < -c.s - 10) { c.y = H + 10; c.x = Math.random() * (W - c.s); }
        else if (c.y > H + 10) c.y = -c.s - 10;
        if (c.x < -c.s - 10) c.x = W + 10; else if (c.x > W + 10) c.x = -c.s - 10;
        var tilt = Math.sin(sec * c.w + c.ph) * 12 + Math.max(-30, Math.min(30, c.vx * 0.08));
        c.el.style.transform = 'translate3d(' + c.x.toFixed(1) + 'px,' + c.y.toFixed(1) + 'px,0) rotate(' + tilt.toFixed(1) + 'deg)';
      });
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // Data strip right under the header: a slow, endless line of today's figures, each a link to its page. It stops
  // while the pointer or keyboard focus is on it and has its own pause button; with reduced motion it stands still
  // and scrolls sideways by hand. Hidden on the game screens; a reader can hide it until STRIP_ID changes.
  function dataStrip() {
    var head = document.querySelector('.site-head');
    if (!head || document.querySelector('.news') || document.querySelector('.mn')) return;
    if (/\/games\/(room|table|host|miner)\.html$/.test(location.pathname)) return;
    try { if (localStorage.getItem('phw-strip-off') === STRIP_ID) return; } catch (e) {}
    var n = STRIP_T[pageKey] || STRIP_T.en, lang = pageKey === 'en' ? '' : pageKey + '/';
    var loc = (LANGS.filter(function (l) { return l.key === pageKey; })[0] || LANGS[0]).tag;
    var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var bar = document.createElement('aside');
    bar.className = 'news'; bar.setAttribute('aria-label', n.label);
    bar.innerHTML = '<span class="news-label"><i aria-hidden="true"></i></span><div class="news-view"><div class="news-track"></div></div>';
    bar.querySelector('.news-label').appendChild(document.createTextNode(n.label));
    var track = bar.querySelector('.news-track');
    head.insertAdjacentElement('afterend', bar);

    function pct(v, d) { return new Intl.NumberFormat(loc, { style: 'percent', maximumFractionDigits: d == null ? 1 : d, signDisplay: d == null ? 'auto' : 'exceptZero' }).format(v / 100); }
    function usd(v) { return new Intl.NumberFormat(loc, { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol', maximumSignificantDigits: 3 }).format(v); }
    function hashrate(hs) {
      var u = [[1e18, 'EH/s'], [1e15, 'PH/s'], [1e12, 'TH/s']].filter(function (x) { return hs >= x[0]; })[0] || [1e9, 'GH/s'];
      return (hs / u[0]).toLocaleString(loc, { maximumFractionDigits: 2 }) + ' ' + u[1];
    }
    // one item: name, value, then an optional change (▲ green / ▼ warm) and a small note
    function item(href, key, value, change, note) {
      var li = document.createElement('li'), a = document.createElement('a');
      a.href = ROOT + lang + href;
      var k = document.createElement('span'); k.className = 'news-k'; k.textContent = key;
      var v = document.createElement('b'); v.className = 'news-v'; v.textContent = value;
      a.appendChild(k); a.appendChild(v);
      if (change != null && isFinite(change)) {
        var c = document.createElement('span'); c.className = 'news-chg ' + (change > 0 ? 'up' : change < 0 ? 'down' : 'flat');
        c.textContent = (change > 0 ? '▲ ' : change < 0 ? '▼ ' : '') + pct(Math.abs(change), 2).replace(/^[+-]/, '');
        a.appendChild(c);
      }
      if (note) { var s = document.createElement('span'); s.className = 'news-note'; s.textContent = note; a.appendChild(s); }
      li.appendChild(a);
      return li;
    }
    function build(d) {
      var ul = document.createElement('ul'); ul.className = 'news-list';
      if (d.price && d.price.usd > 0) {
        var priceItem = item('price.html', n.price, usd(d.price.usd), d.price.change_24h, n.d24);
        priceItem.setAttribute('data-ticker-price', '');
        var stamp = document.createElement('small');
        stamp.textContent = ' · ' + window.PepPrices.describe(d.price, loc);
        priceItem.appendChild(stamp); ul.appendChild(priceItem);
      }
      if (d.hashrate && d.hashrate.hs > 0) ul.appendChild(item('mining.html', n.hash, hashrate(d.hashrate.hs), d.hashrate.change_24h, d.hashrate.change_24h != null ? n.yday : ''));
      if (d.tops && d.tops[10] != null) ul.appendChild(item('rich-list.html', n.tops, [10, 50, 400].map(function (k) { return pct(d.tops[k]); }).join(' / '), null, n.supply));
      if (d.new_top2000 != null) ul.appendChild(item('rich-list.html', n.fresh, d.new_top2000.toLocaleString(loc), null, n.since));
      // where the figures come from, and the day of the snapshot behind the hashrate and rich list numbers
      if (ul.children.length) {
        var day = d.snapshot ? new Date(d.snapshot + 'T00:00:00Z').toLocaleDateString(loc, { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '';
        ul.appendChild(item('press.html#today', n.src, 'CoinGecko · PepeBlocks', null, day ? n.snap + ' ' + day : ''));
      }
      return ul;
    }
    window.PepPrices.subscribe(function () {
      window.PepPrices.quote().then(function (q) {
        track.querySelectorAll('[data-ticker-price]').forEach(function (old) {
          var next = item('price.html', n.price, usd(q.usd), q.change_24h, n.d24);
          next.setAttribute('data-ticker-price', '');
          var stamp = document.createElement('small'); stamp.textContent = ' · ' + window.PepPrices.describe(q, loc);
          next.appendChild(stamp); old.replaceWith(next);
        });
      }).catch(function () {});
    });
    fetch(ROOT + 'data/ticker.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (d) {
      return window.PepPrices.quote().then(function (q) { d.price = q; return d; }, function () { d.price = null; return d; });
    }).then(function (d) {
      var ul = build(d || {});
      if (!ul.children.length) throw new Error('no figures');
      track.appendChild(ul);
      if (still) { bar.classList.add('still'); return; }
      // a second copy follows the first, so the loop has no seam; screen readers and Tab skip it
      var copy = build(d); copy.setAttribute('aria-hidden', 'true');
      copy.querySelectorAll('a').forEach(function (a) { a.tabIndex = -1; });
      track.appendChild(copy);
      track.style.animationDuration = Math.max(18, Math.round(ul.getBoundingClientRect().width / 38)) + 's';
      var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'news-btn news-pause';
      function paint() {
        var p = bar.classList.contains('paused');
        btn.setAttribute('aria-label', p ? n.play : n.pause); btn.title = btn.getAttribute('aria-label');
        btn.innerHTML = p ? '<svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M3 1.8v8.4L10 6z" fill="currentColor"/></svg>'
          : '<svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M3.2 2v8M8.8 2v8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
      }
      btn.addEventListener('click', function () { bar.classList.toggle('paused'); paint(); });
      paint();
      bar.insertBefore(btn, x);
      bar.classList.add('run');
    }).catch(function () { bar.remove(); });
    var x = document.createElement('button'); x.type = 'button'; x.className = 'news-btn news-x';
    x.setAttribute('aria-label', n.hide); x.title = n.hide;
    x.innerHTML = '<svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    x.addEventListener('click', function () {
      bar.remove();
      try { localStorage.setItem('phw-strip-off', STRIP_ID); } catch (e) {}
    });
    bar.appendChild(x);
  }

  // Copy buttons in the page (data-copy="id of the text to copy"), e.g. the descriptions on the media page.
  function pageCopy() {
    document.querySelectorAll('button[data-copy]').forEach(function (btn) {
      var el = document.getElementById(btn.getAttribute('data-copy'));
      if (!el) return;
      btn.addEventListener('click', function () {
        var done = function () { btn.textContent = t.copied; setTimeout(function () { btn.textContent = t.copy; }, 1600); };
        var pick = function () { var r = document.createRange(); r.selectNodeContents(el); var sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(el.textContent.trim()).then(done, pick);
        else pick();
      });
    });
  }

  // Copy buttons for the donation addresses in the footer.
  function supportCopy() {
    document.querySelectorAll('.support dd').forEach(function (dd) {
      var code = dd.querySelector('code');
      if (!code || dd.querySelector('button')) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'copy';
      btn.textContent = t.copy;
      btn.addEventListener('click', function () {
        var done = function () { btn.textContent = t.copied; setTimeout(function () { btn.textContent = t.copy; }, 1600); };
        var pick = function () { var r = document.createRange(); r.selectNodeContents(code); var sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code.textContent).then(done, pick);
        else pick();
      });
      dd.appendChild(btn);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();

// Our own page-view counter (games/supabase/update_page_stats.sql): the page and a random number that changes
// every day, so one person counts once a day. No IP address, no cookie. Only on the live site.
(function () {
  if (location.hostname !== 'pepecoinhub.com' && location.hostname !== 'www.pepecoinhub.com') return;
  var day = new Date().toISOString().slice(0, 10), id = '';
  try {
    var saved = JSON.parse(localStorage.getItem('phw-day-id') || 'null');
    if (saved && saved.day === day) id = saved.id;
    else { id = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()); localStorage.setItem('phw-day-id', JSON.stringify({ day: day, id: id })); }
  } catch (e) { id = String(Math.random()).slice(2) + Date.now(); }
  try {
    fetch('https://azbwciqfbsdpwubznncg.supabase.co/rest/v1/rpc/gry_pv', {
      method: 'POST', keepalive: true,
      headers: { 'Content-Type': 'application/json', apikey: 'sb_publishable_GRByiqlX6v67phR8xcM6VA_6eXXwTKX' },
      body: JSON.stringify({ p_path: location.pathname, p_visitor: id })
    }).catch(function () {});
  } catch (e) {}
})();

// "Report a correction" links: prefill the issue form with the page the reader is on.
(function () {
  document.querySelectorAll('a[data-correction]').forEach(function (a) {
    a.href += '&page=' + encodeURIComponent(location.href.split('#')[0]);
  });
})();
