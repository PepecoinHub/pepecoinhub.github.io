/* PondOS: runs in <head>, before the page is drawn. Without it a phone could paint the plain HTML (the old meme
   layout) for a split second before meme.js turns it into the desktop. The wallpaper shows at once; the page
   itself stays hidden until meme.js has built the windows (it removes 'pond-boot'), at most 4 seconds.
   It also picks the day or the night wallpaper from the visitor's clock (sky-day / sky-night), so the first
   picture already matches the living sky that meme.js lays over it. */
(function () {
  var r = document.documentElement;
  r.classList.add('pondos', 'pond-boot');
  var mode = 'auto';
  try { mode = localStorage.getItem('pondos-sky') || 'auto'; } catch (e) {}
  var d = new Date(), m = d.getHours() * 60 + d.getMinutes();
  // night from the middle of the evening fade (19:45) to the middle of the morning one (06:20); same as meme.js SKY
  var night = mode === 'night' || (mode !== 'day' && (m >= 1185 || m < 380));
  r.classList.add(night ? 'sky-night' : 'sky-day');
  setTimeout(function () { r.classList.remove('pond-boot'); }, 4000);
})();
