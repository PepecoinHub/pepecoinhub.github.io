// Inside a PondOS app window (the meme edition opens PEP Games in an iframe, or ?embed=1) the site header,
// game navigation and footer are hidden and the page wears Windows-98-style chrome, so it looks like an app.
// ?only=dg or ?only=tables shows just that part of the lobby (plus the sign-in box).
(function () {
  var framed = false; try { framed = window.self !== window.top; } catch (e) { framed = true; }
  if (!framed && !/[?&]embed=1(&|$)/.test(location.search)) return;
  var r = document.documentElement; r.classList.add('embed');
  var m = /[?&]only=(dg|tables)(&|$)/.exec(location.search); if (m) r.classList.add('only-' + m[1]);
})();
