/* PondOS 98 visual upgrade v1.0: enhancement-only. No Supabase access, no game logic.
   Works against current #open-list/#open/#news DOM renderers; safe across refresh/re-render.
   Text, player names, stats and action buttons continue to be owned by existing JS.
*/
(function () {
  'use strict';
  var ASSET = 'img/pond/visual-v1/';
  function el(tag, className) { var e = document.createElement(tag); if (className) e.className = className; return e; }
  function badge(kind, description) {
    var s = el('span', 'vu-badge vu-' + kind);
    s.setAttribute('role', 'img');
    s.setAttribute('aria-label', description);
    return s;
  }
  function observe(id, decorate) {
    var target = document.getElementById(id);
    if (!target) return;
    function paint() { Array.prototype.forEach.call(target.children, decorate); }
    paint();
    // Only direct list changes, not decoration itself: no recursion.
    new MutationObserver(paint).observe(target, {childList:true});
  }
  function init() {
    document.documentElement.classList.add('pond-vu');
    // Public duel reports use the CSS class 'drawn' for *every* outcome. Never
    // display a DRAW stamp on somebody else's actual win or loss.
    var lilyResult = document.getElementById('tab-result');
    if (lilyResult) {
      function syncResultBadge() {
        var line = lilyResult.querySelector('#res-line');
        var isDraw = !!(line && /^Draw(?:\s|$)/.test(line.textContent || ''));
        if (lilyResult.classList.contains('vu-is-draw') !== isDraw) {
          lilyResult.classList.toggle('vu-is-draw', isDraw);
        }
      }
      new MutationObserver(syncResultBadge).observe(lilyResult, {attributes:true, attributeFilter:['class']});
      syncResultBadge();
    }
    // A user can be locked out by the 4-h cooldown; show a small actual illustration.
    var wait = document.getElementById('waitpanel');
    if (wait && !wait.querySelector('.vu-state')) {
      var image = el('img', 'vu-state vu-native');
      image.src = ASSET + 'state-waiting.png';
      image.alt = '';
      image.width = 160;
      image.height = 96;
      image.loading = 'lazy';
      // before the row that holds "Check the throne again" (the button sits in a .row with the share buttons)
      var button = wait.querySelector('#recheck'), anchor = button;
      while (anchor && anchor.parentNode !== wait) anchor = anchor.parentNode;
      if (anchor) wait.insertBefore(image, anchor); else wait.appendChild(image);
    }
    // In Lilies, the server-rendered list contains only open challenges.
    observe('open-list', function (li) {
      if (!li.matches || !li.matches('li.card.duel')) return;
      var mid = li.querySelector('.duel-mid');
      if (!mid || mid.querySelector('.vu-badge')) return;
      var txt = mid.textContent || '';
      var isRematch = txt.indexOf('wants a rematch') >= 0;
      mid.insertBefore(badge(isRematch ? 'rematch' : 'open', isRematch ? 'Rematch challenge' : 'Open challenge'), mid.firstChild);
    });
    // Bulletin cork notes are created by existing bulletin.js and contain actual names/links.
    observe('open', function (li) {
      if (!li.matches || !li.matches('li.note') || li.matches('.empty')) return;
      var heading = li.querySelector('.note-bar');
      li.classList.toggle('vu-rematch-note', !!heading && heading.textContent.indexOf('REMATCH') >= 0);
    });
    observe('news', function (li) {
      if (!li.matches || !li.matches('li.clip')) return;
      var head = li.querySelector('.head');
      var text = head ? head.textContent : '';
      li.classList.toggle('vu-king', text.indexOf('Pond King') >= 0);
      li.classList.toggle('vu-lilies', text.indexOf('Three Lilies') >= 0);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
