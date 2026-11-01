// Inside a PondOS app window (the meme edition opens PEP Games in an iframe, or ?embed=1) the site header,
// game navigation and footer are hidden, so only the game shows. Links followed inside the window stay embedded.
(function () {
  var framed = false; try { framed = window.self !== window.top; } catch (e) { framed = true; }
  if (framed || /[?&]embed=1(&|$)/.test(location.search)) document.documentElement.classList.add('embed');
})();
