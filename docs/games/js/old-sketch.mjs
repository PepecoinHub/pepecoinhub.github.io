// PEPaint: File > Open old_sketch.bmp. An old connect-the-dots page: tap the dots in order, a star means
// "lift the pencil and start a new line here". The drawing is the whole puzzle: nothing here says what it shows,
// and the server checks the word later (games.map_words). Works with a finger, a pen or a mouse.
import { h } from './common.js';
import { dialog } from './paintchrome.js';

const W = 600, H = 200, HIT = 18;
// strokes of the old sketch, left to right; each inner list is one pencil line
const STROKES = [
  [[20, 160], [20, 40], [65, 40], [82, 52], [85, 70], [82, 88], [65, 100], [20, 100]], [[48, 100], [88, 160]],
  [[120, 40], [160, 40]], [[140, 40], [140, 160]], [[120, 160], [160, 160]],
  [[195, 160], [195, 40], [240, 40], [257, 52], [258, 72], [242, 98], [195, 100]], [[242, 100], [262, 115], [264, 140], [248, 158], [205, 160]],
  [[295, 160], [295, 40], [340, 40], [357, 52], [358, 72], [342, 98], [295, 100]], [[342, 100], [362, 115], [364, 140], [348, 158], [305, 160]],
  [[400, 40], [440, 40]], [[420, 40], [420, 160]], [[400, 160], [440, 160]],
  [[495, 40], [585, 40]], [[540, 40], [540, 160]],
];
const DOTS = STROKES.flatMap(s => s.map((p, i) => ({ x: p[0], y: p[1], start: i === 0 })));

export function openOldSketch({ onStatus } = {}) {
  const cv = h('canvas', { class: 'pt-sketch', width: W * 2, height: H * 2, 'aria-label': 'An old connect-the-dots sketch' });
  const say = h('p', { class: 'pt-sketch-say', 'aria-live': 'polite' }, 'Start at 1. ★ = lift the pencil and start a new line there.');
  const body = h('div', { class: 'pt-sketch-wrap' },
    h('p', { class: 'pt-sketch-file' }, 'old_sketch.bmp · 600 × 200 · last saved by nobody you know'), h('div', { class: 'pt-sketch-scroll' }, cv), say);
  const c = cv.getContext('2d');
  let next = 0;
  const draw = () => {
    c.setTransform(2, 0, 0, 2, 0, 0);
    c.fillStyle = '#fbf6e6'; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#111'; c.lineWidth = 2.4; c.lineCap = c.lineJoin = 'round';
    c.beginPath();
    for (let i = 1; i < next; i++) if (!DOTS[i].start) { c.moveTo(DOTS[i - 1].x, DOTS[i - 1].y); c.lineTo(DOTS[i].x, DOTS[i].y); }
    c.stroke();
    c.font = '11px Tahoma, Verdana, sans-serif'; c.textBaseline = 'middle';
    DOTS.forEach((d, i) => {
      const done = i < next;
      c.fillStyle = done ? '#269B4D' : i === next ? '#d23c2f' : '#333';
      c.beginPath(); c.arc(d.x, d.y, i === next ? 3.6 : 2.4, 0, 6.283); c.fill();
      c.fillStyle = done ? '#7a8a7a' : '#333';
      // labels sit up-left of the dot, like a children's puzzle book; nudged so neighbours stay readable
      c.fillText((d.start ? '★' : '') + (i + 1), d.x + 4 - (i % 2 ? 0 : 14), d.y - 8 + (i % 3 ? 0 : 16));
    });
  };
  const at = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; };
  cv.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (next >= DOTS.length) return;
    const [x, y] = at(e), d = DOTS[next];
    if (Math.hypot(d.x - x, d.y - y) <= HIT) {
      next++; draw();
      say.textContent = next >= DOTS.length ? 'Done. The old sketch is complete. Read it.' : 'Next: ' + (DOTS[next].start ? '★' : '') + (next + 1) + '.';
    } else say.textContent = 'Not that one. Next: ' + (d.start ? '★' : '') + (next + 1) + '.';
  });
  draw();
  onStatus?.('old_sketch.bmp: connect the dots in order.');
  return dialog('old_sketch.bmp - PEPaint', body, [['Start over', () => { next = 0; draw(); say.textContent = 'Start at 1.'; }], ['Close', null, { primary: true }]], { wide: true });
}
