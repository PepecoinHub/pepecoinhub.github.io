// PEP Games opened from the meme edition (PondOS) wears Windows-98-style chrome.
// 1. Inside a PondOS app window (an iframe, or ?embed=1): the site header, game navigation and footer
//    are hidden, so the page looks like an app. ?only=dg or ?only=tables shows just that part of the lobby.
// 2. As a full page (phones, the Discord sign-in, a shared room link): the same 98 look on the PondOS
//    wallpaper, with a title bar and a taskbar button that lead back to PondOS. ?back=/meme/... sets where
//    "back" goes; it is kept for this tab and dropped on the way back (default: the PondOS desktop).
(function () {
  var r = document.documentElement, q = location.search, K = 'pondos-back';
  var framed = false; try { framed = window.self !== window.top; } catch (e) { framed = true; }
  var okPath = function (p) { return typeof p === 'string' && /^\/meme\/[A-Za-z0-9/_.\-]*(\?[A-Za-z0-9=&_.\-%]*)?(#[A-Za-z0-9_\-]*)?$/.test(p) ? p : null; };
  var ss = function (fn) { try { return fn(window.sessionStorage); } catch (e) { return null; } };
  if (framed || /[?&]embed=1(&|$)/.test(q)) {
    r.classList.add('embed');
    var m = /[?&]only=(dg|tables)(&|$)/.exec(q); if (m) r.classList.add('only-' + m[1]);
    return;
  }
  // PEP Games is reached only through PondOS now, so every full page wears the 98 look
  var p = new URLSearchParams(q), back = okPath(p.get('back'));
  if (back) ss(function (s) { s.setItem(K, back); });
  else back = okPath(ss(function (s) { return s.getItem(K); })) || '/meme/';
  r.classList.add('embed', 'os98');
  if (p.get('login') === '1') r.classList.add('os-login');
  var leave = function () { ss(function (s) { s.removeItem(K); }); };
  window.PondOS = { back: back, leave: leave };
  document.addEventListener('DOMContentLoaded', function () {
    var bar = document.createElement('div'); bar.className = 'os-bar';
    var title = r.classList.contains('os-login') ? 'Log On to PondOS' : (document.title.split('|')[0].trim() || 'PEP Games');
    bar.innerHTML = '<img src="/games/img/icon.svg" alt="" width="16" height="16"><span class="os-t"></span><a class="os-x" aria-label="Close and go back to PondOS" title="Back to PondOS">×</a>';
    bar.querySelector('.os-t').textContent = title;
    var x = bar.querySelector('.os-x'); x.href = back; x.addEventListener('click', leave);
    if (r.classList.contains('os-login')) {
      var dlg = document.querySelector('.g-login');
      if (dlg) { dlg.prepend(bar); return; }
    }
    document.body.prepend(bar);
    var task = document.createElement('div'); task.className = 'os-task';
    task.innerHTML = '<a class="os-start"><img src="/games/img/icon.svg" alt="" width="16" height="16"><b>Back to PondOS</b></a>';
    var s = task.querySelector('a'); s.href = back; s.addEventListener('click', leave);
    document.body.append(task);
  });
})();
