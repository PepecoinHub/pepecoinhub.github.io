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
  // News strip under the header: one line per item, the newest first. {pct} is the top 500 share from data/ticker.json
  // (baked daily by scripts/prebake.mjs). Paths are relative to the language folder, or to the site root with '/'.
  // Change NEWS_ID when an item is added, so the strip comes back for readers who hid it.
  var NEWS_ID = '2026-10-21';
  var NEWS = [
    { tag: 'new', href: '/games/', key: 'games' },
    { tag: 'data', href: 'rich-list.html', key: 'top' },
    { tag: 'new', href: 'mining.html', key: 'mining' },
    { tag: 'new', href: 'price.html', key: 'price' },
    { tag: 'community', href: 'https://pepmarket.de/?lang=en', key: 'market' }
  ];
  var NEWS_T = {
    en: { label: 'News', new: 'New', data: 'Data', community: 'Community', pause: 'Pause the news', play: 'Play the news', hide: 'Hide the news',
      games: 'PEP Games: Draw & Guess, Pepe Miner and a lobby chat', top: 'The top 500 addresses hold {pct} of all PEP',
      mining: 'Mining guide: pools, Antminer L7/L9 and merged mining', price: 'Live PEP price, and what a ×100 would take',
      market: 'PEP Market: a place for artists from the PEP community' },
    pl: { label: 'Nowości', new: 'Nowe', data: 'Dane', community: 'Społeczność', pause: 'Zatrzymaj pasek', play: 'Wznów pasek', hide: 'Ukryj pasek',
      games: 'PEP Games: kalambury, Pepe Miner i czat dla społeczności', top: 'Top 500 adresów trzyma {pct} wszystkich PEP',
      mining: 'Wszystko o miningu: poole, Antminer L7/L9 i merged mining', price: 'Cena PEP na żywo i co oznaczałoby ×100',
      market: 'PEP Market: miejsce dla artystów ze społeczności PEP' },
    es: { label: 'Novedades', new: 'Nuevo', data: 'Datos', community: 'Comunidad', pause: 'Pausar las novedades', play: 'Reanudar las novedades', hide: 'Ocultar las novedades',
      games: 'PEP Games: Draw & Guess, Pepe Miner y un chat para la comunidad', top: 'Las 500 mayores direcciones tienen el {pct} de todos los PEP',
      mining: 'Guía de minería: pools, Antminer L7/L9 y merged mining', price: 'Precio de PEP en directo y qué haría falta para un ×100',
      market: 'PEP Market: un espacio para artistas de la comunidad PEP' },
    de: { label: 'Neu', new: 'Neu', data: 'Daten', community: 'Community', pause: 'Laufband anhalten', play: 'Laufband fortsetzen', hide: 'Laufband ausblenden',
      games: 'PEP Games: Draw & Guess, Pepe Miner und ein Chat für die Community', top: 'Die Top 500 Adressen halten {pct} aller PEP',
      mining: 'Mining-Guide: Pools, Antminer L7/L9 und Merged Mining', price: 'PEP-Kurs live und was ein ×100 bräuchte',
      market: 'PEP Market: ein Ort für Künstler aus der PEP-Community' },
    fr: { label: 'Nouveautés', new: 'Nouveau', data: 'Données', community: 'Communauté', pause: 'Mettre le bandeau en pause', play: 'Relancer le bandeau', hide: 'Masquer le bandeau',
      games: 'PEP Games : Draw & Guess, Pepe Miner et un chat pour la communauté', top: 'Les 500 plus grosses adresses détiennent {pct} de tous les PEP',
      mining: 'Guide du minage : pools, Antminer L7/L9 et merged mining', price: 'Prix du PEP en direct, et ce qu’il faudrait pour un ×100',
      market: 'PEP Market : un lieu pour les artistes de la communauté PEP' },
    tr: { label: 'Yenilikler', new: 'Yeni', data: 'Veri', community: 'Topluluk', pause: 'Şeridi durdur', play: 'Şeridi oynat', hide: 'Şeridi gizle',
      games: 'PEP Games: Draw & Guess, Pepe Miner ve topluluk sohbeti', top: 'İlk 500 adres tüm PEP’in {pct} kadarını tutuyor',
      mining: 'Madencilik rehberi: havuzlar, Antminer L7/L9 ve merged mining', price: 'Canlı PEP fiyatı ve ×100 için ne gerekir',
      market: 'PEP Market: PEP topluluğundan sanatçılar için bir yer' },
    it: { label: 'Novità', new: 'Nuovo', data: 'Dati', community: 'Community', pause: 'Metti in pausa le novità', play: 'Riprendi le novità', hide: 'Nascondi le novità',
      games: 'PEP Games: Draw & Guess, Pepe Miner e una chat per la community', top: 'I primi 500 indirizzi detengono il {pct} di tutti i PEP',
      mining: 'Guida al mining: pool, Antminer L7/L9 e merged mining', price: 'Prezzo di PEP in diretta e cosa servirebbe per un ×100',
      market: 'PEP Market: uno spazio per gli artisti della community PEP' },
    zh: { label: '最新', new: '新', data: '数据', community: '社区', pause: '暂停滚动', play: '继续滚动', hide: '隐藏',
      games: 'PEP Games：你画我猜、Pepe Miner 和社区聊天室', top: '前 500 个地址持有全部 PEP 的 {pct}',
      mining: '挖矿指南：矿池、Antminer L7/L9 与合并挖矿', price: 'PEP 实时价格，以及 ×100 需要多大市值',
      market: 'PEP Market：PEP 社区艺术家的空间' }
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
    newsStrip();
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

  // News strip right under the header: a slow, endless line of links. It stops while the pointer or keyboard
  // focus is on it, has its own pause button, and with reduced motion it stands still and scrolls by hand.
  // Hidden on the game screens themselves; a reader can hide it until the next item is added (NEWS_ID).
  function newsStrip() {
    var head = document.querySelector('.site-head');
    if (!head || document.querySelector('.news') || document.querySelector('.mn')) return;
    if (/\/games\/(room|table|host|miner)\.html$/.test(location.pathname)) return;
    try { if (localStorage.getItem('phw-news-off') === NEWS_ID) return; } catch (e) {}
    var n = NEWS_T[pageKey] || NEWS_T.en, lang = pageKey === 'en' ? '' : pageKey + '/';
    var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var bar = document.createElement('aside');
    bar.className = 'news'; bar.setAttribute('aria-label', n.label);
    bar.innerHTML = '<span class="news-label"><i aria-hidden="true"></i></span><div class="news-view"><div class="news-track"></div></div>';
    bar.querySelector('.news-label').appendChild(document.createTextNode(n.label));
    var track = bar.querySelector('.news-track');
    function group() {
      var ul = document.createElement('ul'); ul.className = 'news-list';
      NEWS.forEach(function (it) {
        var li = document.createElement('li'), a = document.createElement('a'), ext = /^https?:/.test(it.href);
        a.href = ext ? it.href : ROOT + (it.href.charAt(0) === '/' ? it.href.slice(1) : lang + it.href);
        if (ext) a.rel = 'noopener';
        a.setAttribute('data-news', it.key);
        var tag = document.createElement('span'); tag.className = 'news-tag news-tag-' + it.tag; tag.textContent = n[it.tag];
        var txt = document.createElement('span'); txt.className = 'news-text';
        var parts = n[it.key].split('{pct}');
        txt.appendChild(document.createTextNode(parts[0]));
        if (parts.length > 1) { var b = document.createElement('b'); b.className = 'news-pct'; b.textContent = '…'; txt.appendChild(b); txt.appendChild(document.createTextNode(parts[1])); }
        a.appendChild(tag); a.appendChild(txt);
        if (ext) { var h = document.createElement('span'); h.className = 'news-host'; h.textContent = a.hostname.replace(/^www\./, '') + ' ↗'; a.appendChild(h); }
        li.appendChild(a); ul.appendChild(li);
      });
      return ul;
    }
    track.appendChild(group());
    var btn = null;
    if (!still) {   // a second copy follows the first, so the loop has no seam; screen readers and Tab skip it
      var copy = group(); copy.setAttribute('aria-hidden', 'true');
      copy.querySelectorAll('a').forEach(function (a) { a.tabIndex = -1; });
      track.appendChild(copy);
      btn = document.createElement('button'); btn.type = 'button'; btn.className = 'news-btn news-pause';
      function paint() {
        var p = bar.classList.contains('paused');
        btn.setAttribute('aria-label', p ? n.play : n.pause); btn.title = btn.getAttribute('aria-label');
        btn.innerHTML = p ? '<svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M3 1.8v8.4L10 6z" fill="currentColor"/></svg>'
          : '<svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M3.2 2v8M8.8 2v8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
      }
      btn.addEventListener('click', function () { bar.classList.toggle('paused'); paint(); });
      paint();
      bar.appendChild(btn);
    } else bar.classList.add('still');
    var x = document.createElement('button'); x.type = 'button'; x.className = 'news-btn news-x';
    x.setAttribute('aria-label', n.hide); x.title = n.hide;
    x.innerHTML = '<svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    x.addEventListener('click', function () {
      bar.remove();
      try { localStorage.setItem('phw-news-off', NEWS_ID); } catch (e) {}
    });
    bar.appendChild(x);
    head.insertAdjacentElement('afterend', bar);

    // Start moving once the number is in (or not coming), at an even reading speed whatever the width.
    var started = false;
    function start() {
      if (started || still) return; started = true;
      var w = track.firstChild.getBoundingClientRect().width;
      track.style.animationDuration = Math.max(20, Math.round(w / 38)) + 's';
      bar.classList.add('run');
    }
    function dropTop() { track.querySelectorAll('[data-news="top"]').forEach(function (a) { a.parentNode.remove(); }); }
    var timer = setTimeout(start, 2500);
    fetch(ROOT + 'data/ticker.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (d) {
      if (!(d && d.top500_pct > 0)) throw new Error('no share');
      var loc = (LANGS.filter(function (l) { return l.key === pageKey; })[0] || LANGS[0]).tag;
      var v = new Intl.NumberFormat(loc, { style: 'percent', maximumFractionDigits: 1 }).format(d.top500_pct / 100);
      track.querySelectorAll('.news-pct').forEach(function (b) { b.textContent = v; });
    }).catch(dropTop).then(function () { clearTimeout(timer); start(); });
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
