/* PondOS: runs in <head>, before the page is drawn. Without it a phone could paint the plain HTML (the old meme
   layout) for a split second before meme.js turns it into the desktop. The wallpaper shows at once; the page
   itself stays hidden until meme.js has built the windows (it removes 'pond-boot'), at most 4 seconds. */
(function () {
  var r = document.documentElement;
  r.classList.add('pondos', 'pond-boot');
  setTimeout(function () { r.classList.remove('pond-boot'); }, 4000);
})();
