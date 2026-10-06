(function () {
  function themeNow() {
    return document.documentElement.getAttribute('data-theme') || 'auto';
  }
  function label(t) {
    var lang = document.documentElement.lang || 'en';
    if (lang === 'pl') {
      return { auto: 'Auto', light: 'Jasny', dark: 'Ciemny', theme: 'Motyw', lang: 'EN' }[t] || t;
    }
    return { auto: 'Auto', light: 'Light', dark: 'Dark', theme: 'Theme', lang: 'PL' }[t] || t;
  }
  function mount() {
    var nav = document.querySelector('.site-nav, .pf-nav');
    if (!nav || nav.querySelector('[data-chrome]')) return;
    var box = document.createElement('span');
    box.className = 'head-controls';
    box.setAttribute('data-chrome', '1');
    var themeBtn = document.createElement('button');
    themeBtn.type = 'button';
    themeBtn.className = 'iconbtn';
    themeBtn.setAttribute('data-chrome', 'theme');
    function paintTheme() {
      var th = themeNow();
      themeBtn.textContent = label('theme') + ': ' + label(th);
      themeBtn.title = label('theme');
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

    if (document.body.dataset.i18n === 'which') {
      var langBtn = document.createElement('button');
      langBtn.type = 'button';
      langBtn.className = 'iconbtn';
      langBtn.setAttribute('data-chrome', 'lang');
      function paintLang() {
        var lang = document.documentElement.lang === 'pl' ? 'pl' : 'en';
        langBtn.textContent = label('lang');
        document.querySelectorAll('[data-lang]').forEach(function (el) {
          el.hidden = el.getAttribute('data-lang') !== lang;
        });
      }
      langBtn.addEventListener('click', function () {
        var next = document.documentElement.lang === 'pl' ? 'en' : 'pl';
        document.documentElement.lang = next;
        try { localStorage.setItem('phw-lang', next); } catch (e) {}
        paintLang();
        paintTheme();
      });
      try {
        var stored = localStorage.getItem('phw-lang');
        if (stored === 'pl' || stored === 'en') document.documentElement.lang = stored;
        else if ((navigator.language || '').toLowerCase().startsWith('pl')) document.documentElement.lang = 'pl';
      } catch (e) {}
      paintLang();
      box.appendChild(langBtn);
    }
    nav.appendChild(box);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
