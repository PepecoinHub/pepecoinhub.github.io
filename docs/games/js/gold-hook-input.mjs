// Input. The hook fires only from the play area of the canvas (not the HUD, the hint bar
// or DOM buttons). Space is taken only while the canvas has focus.
import { VIEW, LAYOUT } from './gold-hook-config.mjs';

export function attachInput(canvas, { onFire, onPauseKey }) {
  function toLogical(ev) {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((ev.clientX - r.left) / r.width) * VIEW.width,
      y: ((ev.clientY - r.top) / r.height) * VIEW.height,
    };
  }

  canvas.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    canvas.focus({ preventScroll: true });
    const p = toLogical(ev);
    if (p.y >= LAYOUT.playArea.y0 && p.y < LAYOUT.playArea.y1) {
      ev.preventDefault();
      onFire();
    }
  });

  canvas.addEventListener('keydown', (ev) => {
    if (ev.code === 'Space' || ev.key === ' ') {
      ev.preventDefault();           // no page scroll, only while the game has focus
      if (!ev.repeat) onFire();
    }
  });

  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      if (onPauseKey()) ev.preventDefault();
    }
  });
}
