// ?embed=1: the page runs as an app window inside the meme edition (PondOS), so the site header,
// game navigation and footer are hidden and only the game itself shows.
if (/[?&]embed=1(&|$)/.test(location.search)) document.documentElement.classList.add('embed');
