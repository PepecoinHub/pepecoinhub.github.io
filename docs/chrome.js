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
      start: 'Start here', data: 'Data & charts', games: 'Games', menu: 'Menu', top: 'Back to top' },
    pl: { copy: 'Kopiuj', copied: 'Skopiowano', theme: 'Motyw', auto: 'Auto', light: 'Jasny', dark: 'Ciemny', sep: ': ', language: 'Język',
      start: 'Na start', data: 'Dane i wykresy', games: 'Gry', menu: 'Menu', top: 'Do góry',
      hint: 'Ta strona jest dostępna także po polsku.', go: 'Czytaj po polsku', close: 'Zamknij' },
    es: { copy: 'Copiar', copied: 'Copiado', theme: 'Tema', auto: 'Auto', light: 'Claro', dark: 'Oscuro', sep: ': ', language: 'Idioma',
      start: 'Para empezar', data: 'Datos y gráficos', games: 'Juegos', menu: 'Menú', top: 'Volver arriba',
      hint: 'Esta página también está en español.', go: 'Leer en español', close: 'Cerrar' },
    de: { copy: 'Kopieren', copied: 'Kopiert', theme: 'Design', auto: 'Auto', light: 'Hell', dark: 'Dunkel', sep: ': ', language: 'Sprache',
      start: 'Für den Einstieg', data: 'Daten & Charts', games: 'Spiele', menu: 'Menü', top: 'Nach oben',
      hint: 'Diese Seite gibt es auch auf Deutsch.', go: 'Auf Deutsch lesen', close: 'Schließen' },
    fr: { copy: 'Copier', copied: 'Copié', theme: 'Thème', auto: 'Auto', light: 'Clair', dark: 'Sombre', sep: ' : ', language: 'Langue',
      start: 'Pour commencer', data: 'Données et graphiques', games: 'Jeux', menu: 'Menu', top: 'Haut de page',
      hint: 'Cette page existe aussi en français.', go: 'Lire en français', close: 'Fermer' },
    tr: { copy: 'Kopyala', copied: 'Kopyalandı', theme: 'Tema', auto: 'Otomatik', light: 'Açık', dark: 'Koyu', sep: ': ', language: 'Dil',
      start: 'Başlangıç', data: 'Veriler ve grafikler', games: 'Oyunlar', menu: 'Menü', top: 'Başa dön',
      hint: 'Bu sayfa Türkçe olarak da mevcut.', go: 'Türkçe sürüme geç', close: 'Kapat' },
    it: { copy: 'Copia', copied: 'Copiato', theme: 'Tema', auto: 'Auto', light: 'Chiaro', dark: 'Scuro', sep: ': ', language: 'Lingua',
      start: 'Per iniziare', data: 'Dati e grafici', games: 'Giochi', menu: 'Menu', top: 'Torna su',
      hint: 'Questa pagina è disponibile anche in italiano.', go: 'Leggi in italiano', close: 'Chiudi' },
    zh: { copy: '复制', copied: '已复制', theme: '主题', auto: '自动', light: '浅色', dark: '深色', sep: '：', language: '语言',
      start: '入门', data: '数据与图表', games: '游戏', menu: '菜单', top: '返回顶部',
      hint: '本页面也有简体中文版。', go: '阅读中文版', close: '关闭' }
  };
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
    backToTop();
    bgLayer();
    langHint(alt);
    supportCopy();
  }

  // Header menu: the page links are grouped into "Start here" and "Data & charts" drop-downs,
  // with Guides and a highlighted Games button next to them. On a phone the menu opens from a ☰ button.
  var GROUPS = { 'which-pepecoin': ['start', '🐸'], 'compare': ['start', '🐕'], 'scrypt-family': ['start', '⛓️'],
    'network': ['data', '📈'], 'rich-list': ['data', '🏆'], 'supply': ['data', '🪙'], 'calculator': ['data', '🧮'], 'guides': ['', '📚'] };
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
      var wrap = document.createElement('div'); wrap.className = 'navgroup';
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
    // phone: Games button and ☰ in the header bar, the menu opens below it
    var quick = games.cloneNode(true); quick.className = 'nav-games head-games'; quick.removeAttribute('aria-current');
    var burger = document.createElement('button'); burger.type = 'button'; burger.className = 'navburger';
    burger.setAttribute('aria-label', t.menu); burger.setAttribute('aria-expanded', 'false');
    burger.innerHTML = '<svg viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><path d="M1 1h18M1 7h18M1 13h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    function setMenu(open) { head.classList.toggle('menu-open', open); burger.setAttribute('aria-expanded', String(open)); }
    burger.addEventListener('click', function () { setMenu(!head.classList.contains('menu-open')); });
    var tools = document.createElement('span'); tools.className = 'head-phone';
    tools.appendChild(quick); tools.appendChild(burger);
    head.insertBefore(tools, nav);
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

  // Background: soft drifting light everywhere (CSS), plus a few faint rising P coins on the home and games pages.
  function bgLayer() {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!document.querySelector('.home-hero') && !/\/games\//.test(location.pathname)) return;
    if (document.querySelector('.mn')) return;
    var l = document.createElement('div'); l.className = 'bg-coins'; l.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 12; i++) {
      var c = document.createElement('i'), s = 14 + Math.random() * 18;
      c.textContent = 'P';
      c.style.cssText = 'left:' + (Math.random() * 100).toFixed(1) + '%;width:' + s.toFixed(0) + 'px;height:' + s.toFixed(0) + 'px;font-size:' + (s * 0.6).toFixed(0) + 'px;'
        + 'animation-duration:' + (28 + Math.random() * 24).toFixed(0) + 's;animation-delay:-' + (Math.random() * 50).toFixed(0) + 's';
      l.appendChild(c);
    }
    document.body.insertBefore(l, document.body.firstChild);
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

// "Report a correction" links: prefill the issue form with the page the reader is on.
(function () {
  document.querySelectorAll('a[data-correction]').forEach(function (a) {
    a.href += '&page=' + encodeURIComponent(location.href.split('#')[0]);
  });
})();
