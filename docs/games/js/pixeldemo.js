// Small looping demo for the Pepe Pictures card: a picture that starts as a few giant pixels and gets sharper.
// Uses a picture that is already part of the games (no new artwork). Paused when the tab is hidden; static when the visitor prefers reduced motion.
const LEVELS = [6, 9, 14, 22, 34, 56, 90];
export function pixelDemo(canvas, label, src = 'img/preset-frog-circle.jpg', answer = 'frog') {
  const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const im = new Image();
  im.onload = () => {
    const full = document.createElement('canvas'); full.width = W; full.height = H;
    const f = full.getContext('2d'); f.fillStyle = '#fff'; f.fillRect(0, 0, W, H);
    const k = Math.min(W / im.naturalWidth, H / im.naturalHeight), w = im.naturalWidth * k, h = im.naturalHeight * k;
    f.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
    const small = document.createElement('canvas'), sc = small.getContext('2d');
    const draw = (lv) => {
      if (!lv) { ctx.imageSmoothingEnabled = true; ctx.drawImage(full, 0, 0); return; }
      small.width = lv; small.height = Math.max(1, Math.round(lv * H / W));
      sc.imageSmoothingEnabled = true; sc.drawImage(full, 0, 0, small.width, small.height);
      ctx.imageSmoothingEnabled = false; ctx.drawImage(small, 0, 0, W, H);
    };
    if (reduce) { draw(34); label.textContent = '?'; return; }
    let i = 0;
    const step = () => {
      if (document.hidden) return setTimeout(step, 1000);
      const done = i >= LEVELS.length;
      draw(done ? 0 : LEVELS[i]);
      label.textContent = done ? answer + '!' : '?';
      label.classList.toggle('ok', done);
      const wait = done ? 2200 : 800;
      i = done ? 0 : i + 1;
      setTimeout(step, wait);
    };
    step();
  };
  im.src = src;
}
