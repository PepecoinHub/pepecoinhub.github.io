// Click-to-play YouTube video (privacy-friendly "nocookie" player). The iframe is created only after a click.
document.querySelectorAll('.video-card[data-yt]').forEach(function (card) {
  var btn = card.querySelector('.video-play');
  if (!btn) return;
  btn.addEventListener('click', function () {
    var f = document.createElement('iframe');
    f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(card.dataset.yt) + '?autoplay=1&rel=0';
    f.title = card.dataset.title || 'Video';
    f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture';
    f.allowFullscreen = true;
    f.referrerPolicy = 'strict-origin-when-cross-origin';
    card.textContent = '';
    card.appendChild(f);
    f.focus();
  });
});
