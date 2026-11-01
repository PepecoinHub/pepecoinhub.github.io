// PEP Games opened from the meme edition (PondOS) wears Windows-98-style chrome.
// 1. Inside a PondOS app window (an iframe, or ?embed=1): the site header, game navigation and footer
//    are hidden, so the page looks like an app. ?only=dg or ?only=tables shows just that part of the lobby.
// 2. Opened as a full page from PondOS (?os=98, or ?login=1&back=/meme/...; phones and the Discord sign-in):
//    the same 98 look on the PondOS wallpaper, with a title bar that leads back to PondOS. The return path
//    is kept for this tab while the visitor moves between PEP Games pages, and dropped on the way back.
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
  var p = new URLSearchParams(q), back = okPath(p.get('back'));
  if (p.get('os') === '98' || back) {
    back = back || '/meme/';
    ss(function (s) { s.setItem(K, back); });
  } else {
    // stay in 98 mode only while moving between PEP Games pages in this tab
    var ref = ''; try { ref = new URL(document.referrer).pathname; } catch (e) {}
    back = /^\/games\//.test(ref) ? okPath(ss(function (s) { return s.getItem(K); })) : null;
    if (!back) { ss(function (s) { s.removeItem(K); }); return; }
  }
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
