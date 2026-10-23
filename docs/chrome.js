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
      start: 'Start here', startShort: 'Start', mine: 'Mining', data: 'Data & charts', games: 'Games', menu: 'Menu', top: 'Back to top', more: 'More' },
    pl: { copy: 'Kopiuj', copied: 'Skopiowano', theme: 'Motyw', auto: 'Auto', light: 'Jasny', dark: 'Ciemny', sep: ': ', language: 'Język',
      start: 'Na start', startShort: 'Start', mine: 'Kopanie', data: 'Dane i wykresy', games: 'Gry', menu: 'Menu', top: 'Do góry', more: 'Więcej',
      hint: 'Ta strona jest dostępna także po polsku.', go: 'Czytaj po polsku', close: 'Zamknij' },
    es: { copy: 'Copiar', copied: 'Copiado', theme: 'Tema', auto: 'Auto', light: 'Claro', dark: 'Oscuro', sep: ': ', language: 'Idioma',
      start: 'Para empezar', startShort: 'Empezar', mine: 'Minería', data: 'Datos y gráficos', games: 'Juegos', menu: 'Menú', top: 'Volver arriba', more: 'Más',
      hint: 'Esta página también está en español.', go: 'Leer en español', close: 'Cerrar' },
    de: { copy: 'Kopieren', copied: 'Kopiert', theme: 'Design', auto: 'Auto', light: 'Hell', dark: 'Dunkel', sep: ': ', language: 'Sprache',
      start: 'Für den Einstieg', startShort: 'Start', mine: 'Mining', data: 'Daten & Charts', games: 'Spiele', menu: 'Menü', top: 'Nach oben', more: 'Mehr',
      hint: 'Diese Seite gibt es auch auf Deutsch.', go: 'Auf Deutsch lesen', close: 'Schließen' },
    fr: { copy: 'Copier', copied: 'Copié', theme: 'Thème', auto: 'Auto', light: 'Clair', dark: 'Sombre', sep: ' : ', language: 'Langue',
      start: 'Pour commencer', startShort: 'Débuter', mine: 'Minage', data: 'Données et graphiques', games: 'Jeux', menu: 'Menu', top: 'Haut de page', more: 'Plus',
      hint: 'Cette page existe aussi en français.', go: 'Lire en français', close: 'Fermer' },
    tr: { copy: 'Kopyala', copied: 'Kopyalandı', theme: 'Tema', auto: 'Otomatik', light: 'Açık', dark: 'Koyu', sep: ': ', language: 'Dil',
      start: 'Başlangıç', startShort: 'Başla', mine: 'Madencilik', data: 'Veriler ve grafikler', games: 'Oyunlar', menu: 'Menü', top: 'Başa dön', more: 'Daha fazla',
      hint: 'Bu sayfa Türkçe olarak da mevcut.', go: 'Türkçe sürüme geç', close: 'Kapat' },
    it: { copy: 'Copia', copied: 'Copiato', theme: 'Tema', auto: 'Auto', light: 'Chiaro', dark: 'Scuro', sep: ': ', language: 'Lingua',
      start: 'Per iniziare', startShort: 'Inizia', mine: 'Mining', data: 'Dati e grafici', games: 'Giochi', menu: 'Menu', top: 'Torna su', more: 'Altro',
      hint: 'Questa pagina è disponibile anche in italiano.', go: 'Leggi in italiano', close: 'Chiudi' },
    zh: { copy: '复制', copied: '已复制', theme: '主题', auto: '自动', light: '浅色', dark: '深色', sep: '：', language: '语言',
      start: '入门', startShort: '入门', mine: '挖矿', data: '数据与图表', games: '游戏', menu: '菜单', top: '返回顶部', more: '更多',
      hint: '本页面也有简体中文版。', go: '阅读中文版', close: '关闭' }
  };
  // Data strip under the header: today's figures from data/ticker.json (baked by scripts/prebake.mjs: price hourly,
  // the rest daily). Change STRIP_ID when the strip changes, so it comes back for readers who hid it.
  var STRIP_ID = '2026-10-21b';
  var STRIP_T = {
    en: { label: 'PEP today', price: 'PEP price', d24: '24h', hash: 'Hashrate', yday: 'vs yesterday', tops: 'Top 10 / 50 / 400 addresses hold', supply: 'of supply',
      fresh: 'New addresses in the top 2000', since: 'since yesterday', pause: 'Pause', play: 'Play', hide: 'Hide this strip' },
    pl: { label: 'PEP dziś', price: 'Cena PEP', d24: '24h', hash: 'Hashrate', yday: 'od wczoraj', tops: 'Top 10 / 50 / 400 adresów trzyma', supply: 'podaży',
      fresh: 'Nowe adresy w top 2000', since: 'od wczoraj', pause: 'Zatrzymaj', play: 'Wznów', hide: 'Ukryj pasek' },
    es: { label: 'PEP hoy', price: 'Precio de PEP', d24: '24h', hash: 'Hashrate', yday: 'vs. ayer', tops: 'Las 10 / 50 / 400 mayores direcciones tienen', supply: 'del suministro',
      fresh: 'Direcciones nuevas en el top 2000', since: 'desde ayer', pause: 'Pausar', play: 'Reanudar', hide: 'Ocultar esta barra' },
    de: { label: 'PEP heute', price: 'PEP-Kurs', d24: '24h', hash: 'Hashrate', yday: 'ggü. gestern', tops: 'Top 10 / 50 / 400 Adressen halten', supply: 'der Coinmenge',
      fresh: 'Neue Adressen in den Top 2000', since: 'seit gestern', pause: 'Anhalten', play: 'Fortsetzen', hide: 'Leiste ausblenden' },
    fr: { label: 'PEP aujourd’hui', price: 'Prix du PEP', d24: '24 h', hash: 'Hashrate', yday: 'vs hier', tops: 'Les 10 / 50 / 400 plus grosses adresses détiennent', supply: 'de l’offre',
      fresh: 'Nouvelles adresses dans le top 2000', since: 'depuis hier', pause: 'Pause', play: 'Lecture', hide: 'Masquer ce bandeau' },
    tr: { label: 'Bugün PEP', price: 'PEP fiyatı', d24: '24s', hash: 'Hashrate', yday: 'düne göre', tops: 'İlk 10 / 50 / 400 adresin arzdaki payı', supply: '',
      fresh: 'İlk 2000’e giren yeni adresler', since: 'dünden beri', pause: 'Durdur', play: 'Oynat', hide: 'Şeridi gizle' },
    it: { label: 'PEP oggi', price: 'Prezzo di PEP', d24: '24h', hash: 'Hashrate', yday: 'rispetto a ieri', tops: 'I primi 10 / 50 / 400 indirizzi detengono', supply: 'dell’offerta',
      fresh: 'Nuovi indirizzi nella top 2000', since: 'da ieri', pause: 'Pausa', play: 'Riprendi', hide: 'Nascondi questa barra' },
    zh: { label: 'PEP 今日', price: 'PEP 价格', d24: '24 小时', hash: '算力', yday: '较昨日', tops: '前 10 / 50 / 400 个地址持有', supply: '的供应',
      fresh: '新进前 2000 的地址', since: '较昨日', pause: '暂停', play: '继续', hide: '隐藏' }
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
    var box = document.createElement('span');
    box.className = 'head-controls';
    box.setAttribute('data-chrome', '1');
    var themeBtn = document.createElement('button');
    themeBtn.type = 'button';
    themeBtn.className = 'iconbtn';
    themeBtn.setAttribute('data-chrome', 'theme');
    function paintTheme() {
      themeBtn.textContent = t.theme + t.sep + t[themeNow()];
      themeBtn.title = t.theme;
    }
    themeBtn.addEventListener('click', function () {
      var th = themeNow();
      var next = th === 'auto' ? 'light' : th === 'light' ? 'dark' : 'auto';
      if (next === 'auto') document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', next);
      try { if (next === 'auto') localStorage.removeItem('phw-theme'); else localStorage.setItem('phw-theme', next); } catch (e) {}
      paintTheme();
    });
    paintTheme();
    box.appendChild(themeBtn);
    box.appendChild(langMenu(alt));
    nav.appendChild(box);
    groupNav(nav);
    footNav(nav);
    linkHosts();
    linkFold();
    backToTop();
    bgLayer();
    langHint(alt);
    pillBar();
    dataStrip();
    supportCopy();
  }

  // Header menu: the page links are grouped into "Start here" and "Data & charts" drop-downs,
  // with Guides and a highlighted Games button next to them. On a phone the menu opens from a ☰ button.
  var GROUPS = { 'which-pepecoin': ['start', '🐸'], 'compare': ['start', '🐕'], 'scrypt-family': ['start', '⛓️'], 'mining': ['start', '⛏️'],
    'network': ['data', '📈'], 'rich-list': ['data', '🏆'], 'supply': ['data', '🪙'], 'calculator': ['data', '🧮'], 'price': ['data', '💹'], 'guides': ['', '📚'] };
  function groupNav(nav) {
    var head = nav.closest('.site-head');
    if (!head || nav.classList.contains('grouped')) return;
    var links = Array.prototype.slice.call(nav.children).filter(function (el) { return el.tagName === 'A'; });
    var games = null, base = null, panels = {}, order = [];
    links.forEach(function (a) {
      var href = a.getAttribute('href') || '', m = href.match(/([a-z-]+)\.html$/), key = m ? m[1] : '';
      if (key === 'guides' && base === null) base = href.replace(/guides\.html$/, '');
      if (/games\/?$|^\.\/$/.test(href)) { games = a; return; }
      var g = GROUPS[key];
      if (g) a.insertAdjacentHTML('afterbegin', '<span class="nav-ico" aria-hidden="true">' + g[1] + '</span>');
      if (!g || !g[0]) { order.push(a); return; }
      if (!panels[g[0]]) { panels[g[0]] = []; order.push(g[0]); }
      panels[g[0]].push(a);
    });
    // Mining is not in the page HTML; it joins "Start here" as the fourth link.
    if (panels.start && !panels.start.some(function (a) { return /mining\.html$/.test(a.getAttribute('href') || ''); })) {
      var mine = document.createElement('a');
      mine.href = (base || '') + 'mining.html';
      mine.innerHTML = '<span class="nav-ico" aria-hidden="true">⛏️</span>';
      mine.appendChild(document.createTextNode(t.mine));
      if (/\/mining\.html$/.test(location.pathname)) mine.setAttribute('aria-current', 'page');
      panels.start.push(mine);
    }
    if (!games) {
      games = document.createElement('a');
      games.href = (base || '') + 'games/';
      games.textContent = t.games;
    }
    games.classList.add('nav-games');
    games.insertAdjacentHTML('afterbegin', '<span aria-hidden="true">🎮 </span>');
    var frag = document.createDocumentFragment(), groups = [];
    order.forEach(function (item) {
      if (typeof item !== 'string') { frag.appendChild(item); return; }
      var wrap = document.createElement('div'); wrap.className = 'navgroup navgroup-' + item;
      var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'navbtn'; btn.setAttribute('aria-expanded', 'false');
      btn.innerHTML = '<span></span><svg viewBox="0 0 10 6" width="10" height="6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
      btn.firstChild.textContent = t[item];
      var panel = document.createElement('div'); panel.className = 'navpanel';
      panels[item].forEach(function (a) { panel.appendChild(a); if (a.getAttribute('aria-current') === 'page') wrap.classList.add('current'); });
      btn.addEventListener('click', function (e) { e.stopPropagation(); var open = btn.getAttribute('aria-expanded') !== 'true'; closeAll(); btn.setAttribute('aria-expanded', String(open)); });
      wrap.appendChild(btn); wrap.appendChild(panel); frag.appendChild(wrap); groups.push(btn);
    });
    function closeAll() { groups.forEach(function (b) { b.setAttribute('aria-expanded', 'false'); }); }
    document.addEventListener('click', function (e) { if (!nav.contains(e.target)) closeAll(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeAll(); setMenu(false); } });
    frag.appendChild(games);
    frag.appendChild(memeLink());
    nav.insertBefore(frag, nav.firstChild);
    nav.classList.add('grouped');
    // phone: "Start" and Games in the header bar; Start opens the whole menu below it, "Start here" group first
    var quick = games.cloneNode(true); quick.className = 'nav-games head-games'; quick.removeAttribute('aria-current');
    var tools = document.createElement('span'); tools.className = 'head-phone';
    var qs = document.createElement('button'); qs.type = 'button'; qs.className = 'head-start';
    qs.setAttribute('aria-expanded', 'false'); qs.setAttribute('aria-label', t.menu);
    qs.innerHTML = '<span aria-hidden="true">🚀</span> <b></b><svg viewBox="0 0 10 6" width="10" height="6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
    qs.querySelector('b').textContent = t.startShort || t.start;
    function setMenu(open) { head.classList.toggle('menu-open', open); qs.setAttribute('aria-expanded', String(open)); }
    qs.addEventListener('click', function () { setMenu(!head.classList.contains('menu-open')); });
    tools.appendChild(qs); tools.appendChild(quick);
    head.insertBefore(tools, nav);
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
  // in three short columns (the same links as the header menu), then the small print.
  var SOCIAL = [['Reddit', 'https://reddit.com/r/pepecoin'], ['Discord', 'https://pepecoin.com/discord'], ['Telegram', 'https://t.me/PepecoinGroup'],
    ['X', 'https://x.com/PepecoinNetwork'], ['GitHub', 'https://github.com/PepecoinHub/pepecoinhub.github.io']];
  function footNav(nav) {
    var foot = document.querySelector('footer.site-foot');
    if (!foot || foot.querySelector('.foot-top') || !nav.classList.contains('grouped')) return;
    function label(a) {
      var c = a.cloneNode(true);
      c.querySelectorAll('.nav-ico, [aria-hidden="true"]').forEach(function (el) { el.remove(); });
      return c.textContent.trim();
    }
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
    function col(title, links) {
      if (!links.length) return;
      var d = document.createElement('div'), h = document.createElement('p'); h.className = 'foot-h'; h.textContent = title; d.appendChild(h);
      links.forEach(function (a) {
        var c = document.createElement('a'); c.href = a.getAttribute('href'); c.textContent = label(a);
        if (a.getAttribute('aria-current') === 'page') c.setAttribute('aria-current', 'page');
        d.appendChild(c);
      });
      box.appendChild(d);
    }
    var q = function (sel) { return Array.prototype.slice.call(nav.querySelectorAll(sel)); };
    col(t.start, q('.navgroup-start .navpanel a'));
    col(t.data, q('.navgroup-data .navpanel a'));
    col(t.more, q(':scope > a'));
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
      if (d.price && d.price.usd > 0) ul.appendChild(item('price.html', n.price, usd(d.price.usd), d.price.change_24h, n.d24));
      if (d.hashrate && d.hashrate.hs > 0) ul.appendChild(item('mining.html', n.hash, hashrate(d.hashrate.hs), d.hashrate.change_24h, d.hashrate.change_24h != null ? n.yday : ''));
      if (d.tops && d.tops[10] != null) ul.appendChild(item('rich-list.html', n.tops, [10, 50, 400].map(function (k) { return pct(d.tops[k]); }).join(' / '), null, n.supply));
      if (d.new_top2000 != null) ul.appendChild(item('rich-list.html', n.fresh, d.new_top2000.toLocaleString(loc), null, n.since));
      return ul;
    }
    fetch(ROOT + 'data/ticker.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (d) {
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
