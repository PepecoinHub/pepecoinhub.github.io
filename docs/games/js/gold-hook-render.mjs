// Canvas 2D drawing in a logical 640×480 screen. No image smoothing.
// Layers: background → mine objects → rope → cargo → hook → surface/winch
// → frog → HUD → messages. Dialogs are DOM.
import { VIEW, LAYOUT, TIMING } from './gold-hook-config.mjs';
import { hookGeometry, currentAnim, APP } from './gold-hook-state.mjs';
import { T } from './gold-hook-text.mjs';

// Earth tiles down to this row, stone tiles below (the mine gets harder the deeper you go).
const STONE_FROM_Y = 344;

const C = {
  outline: '#202020',
  windowBg: '#C0C0C0', windowDark: '#808080', windowLight: '#FFFFFF',
  titleBar: '#000080', titleText: '#FFFFFF',
  sky: '#163534',         // night sky, as in the art pack preview
  dirtDark: '#4F311B', bedrock: '#3A2414',
  rope: '#202020',
  hudText: '#FFF0A5', hudWarn: '#FF9C8F',
  popup: '#FFF0A5',
};

export function createRenderer(canvas, assets) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let scale = 1;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    // Whole-number buffer scale → sharp pixels and readable text.
    scale = Math.max(1, Math.ceil((rect.width * dpr) / VIEW.width));
    if (canvas.width !== VIEW.width * scale) {
      canvas.width = VIEW.width * scale;
      canvas.height = VIEW.height * scale;
    }
  }

  function img(id) { return assets.images.get(id); }

  function drawAnchored(id, x, y) {
    const a = img(id);
    ctx.drawImage(a.img, Math.round(x - a.meta.anchor[0]), Math.round(y - a.meta.anchor[1]));
  }

  function bevel(x, y, w, h, raised = true) {
    ctx.fillStyle = C.windowBg; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = raised ? C.windowLight : C.windowDark;
    ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y, 1, h);
    ctx.fillStyle = raised ? C.windowDark : C.windowLight;
    ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x + w - 1, y, 1, h);
  }

  function drawBackground() {
    const L = LAYOUT;
    ctx.fillStyle = C.windowBg; ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    // PondOS-style title bar (text drawn by code).
    ctx.fillStyle = C.titleBar; ctx.fillRect(0, 0, VIEW.width, 24);
    ctx.fillStyle = C.titleText;
    ctx.font = 'bold 13px "Segoe UI", Tahoma, sans-serif';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillText(T.windowTitle, 8, 12);
    // Surface strip from the art pack: its ground row (y=88 in the file) sits on y=200.
    // Drawn in the background layer, so the rope is always above it.
    ctx.fillStyle = C.sky; ctx.fillRect(0, L.surface.y0, VIEW.width, L.surface.y1 - L.surface.y0 + 1);
    const surface = img('pm-surface');
    ctx.drawImage(surface.img, 0, L.surface.groundY - surface.meta.anchor[1]);
    ctx.fillStyle = C.dirtDark; ctx.fillRect(0, L.surface.y1 + 1, VIEW.width, L.hintBar.y0 - L.surface.y1 - 1);
    // Mine: earth tiles on top, stone tiles deeper, clipped to the mine.
    const m = L.mine, earth = img('pm-earth-tile').img, stone = img('pm-stone-tile').img;
    ctx.save();
    ctx.beginPath(); ctx.rect(m.x0, m.y0, m.x1 - m.x0, m.y1 - m.y0); ctx.clip();
    for (let y = m.y0; y < m.y1; y += 32) {
      const tile = y < STONE_FROM_Y ? earth : stone;
      for (let x = m.x0; x < m.x1; x += 32) ctx.drawImage(tile, x, y);
    }
    ctx.restore();
    ctx.fillStyle = C.bedrock; ctx.fillRect(0, m.y1, VIEW.width, L.hintBar.y0 - m.y1);
  }

  function drawObjects(g) {
    for (const o of g.objects) if (!o.caught) drawAnchored(o.asset, o.x, o.y);
  }

  function drawHookAndCargo(g) {
    const geo = hookGeometry(g.hook);
    // 2 px rope from the winch to the hook mount, under the hook and cargo.
    ctx.strokeStyle = C.rope; ctx.lineWidth = 2; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(LAYOUT.winch.x, LAYOUT.winch.y); ctx.lineTo(geo.ax, geo.ay); ctx.stroke();
    const cargo = g.hook.cargo;
    if (cargo) {
      const off = cargo.r * 0.4;
      drawAnchored(cargo.asset, geo.cx + geo.dir.x * off, geo.cy + geo.dir.y * off);
    }
    // Closed claw while it carries something; both share the mount (16,3) and cargo point (16,35).
    const hook = img(cargo ? 'pm-hook-closed' : 'pm-hook-basic');
    ctx.save();
    ctx.translate(geo.ax, geo.ay);
    ctx.rotate(-g.hook.angle * Math.PI / 180);
    ctx.drawImage(hook.img, -hook.meta.anchor[0], -hook.meta.anchor[1]);
    ctx.restore();
  }

  function drawWinch() {
    // The art pack winch: its rope exit (24,40) is the winch point, and the rows under it are
    // empty, so it never hides the rope at any angle.
    drawAnchored('pm-winch', LAYOUT.winch.x, LAYOUT.winch.y);
  }

  // Sparkle on a delivered find, dust when the hook hits a rock: 4 atlas frames, 80 ms each, once.
  function drawEffects(g, manifest) {
    for (const e of g.effects) {
      const def = manifest.animations[e.kind];
      const sheet = img(def.atlas.id);
      let t = e.t * 1000, i = 0;
      while (i < def.durationsMs.length - 1 && t >= def.durationsMs[i]) { t -= def.durationsMs[i]; i++; }
      const [fx, fy, fw, fh] = def.atlas.rects[i];
      ctx.drawImage(sheet.img, fx, fy, fw, fh, Math.round(e.x - fw / 2), Math.round(e.y - fh / 2), fw, fh);
    }
  }

  function drawMiner(g, manifest) {
    const anim = currentAnim(g);
    const def = manifest.animations[anim.name];
    let t = anim.t;
    const total = def.durationsMs.reduce((s, d) => s + d, 0);
    if (anim.loop) t %= total; else t = Math.min(t, total - 1);
    let i = 0;
    while (i < def.durationsMs.length - 1 && t >= def.durationsMs[i]) { t -= def.durationsMs[i]; i++; }
    const frame = manifest.atlas.frames[def.frames[i]];
    const atlas = img('pm-miner-atlas');
    const [ax, ay] = atlas.meta.anchor;
    // Shared foot anchor: the top-left of the frame = the layout position.
    const fx = LAYOUT.miner.x, fy = LAYOUT.miner.y;
    ctx.drawImage(atlas.img, frame.x, frame.y, frame.w, frame.h, fx, fy, frame.w, frame.h);
    return { footX: fx + ax, footY: fy + ay };
  }

  function drawHud(g, manifest) {
    const { x, y } = LAYOUT.hud;
    ctx.drawImage(img('pm-hud').img, x, y);
    const secs = Math.ceil(g.timeLeft);
    const low = g.app === APP.PLAYING && g.timeLeft <= TIMING.lowTimeSec;
    const values = { score: g.score, target: g.target, seconds: low ? `${secs}!` : secs, level: g.level };
    ctx.font = 'bold 22px "Courier New", Consolas, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    manifest.hud.fields.forEach((field, i) => {
      const [rx, ry, rw, rh] = manifest.hud.valueRects[i];
      ctx.fillStyle = field === 'seconds' && low ? C.hudWarn : C.hudText;
      ctx.fillText(String(values[field]), x + rx + rw / 2, y + ry + rh / 2 + 1, rw - 6);
    });
  }

  function drawPopups(g, reducedMotion) {
    ctx.font = 'bold 18px "Courier New", Consolas, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const p of g.popups) {
      const rise = reducedMotion ? 0 : p.t * 30;
      ctx.fillStyle = C.outline; ctx.fillText(p.text, p.x + 1, p.y - rise + 1);
      ctx.fillStyle = C.popup; ctx.fillText(p.text, p.x, p.y - rise);
    }
  }

  function drawHintBar() {
    const L = LAYOUT.hintBar;
    bevel(0, L.y0, VIEW.width, L.y1 - L.y0 + 1, true);
    ctx.fillStyle = '#000';
    ctx.font = '13px "Segoe UI", Tahoma, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(T.hintBar, VIEW.width / 2, (L.y0 + L.y1) / 2);
  }

  function draw(g, { reducedMotion = false } = {}) {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const manifest = assets.manifest;
    drawBackground();
    drawObjects(g);
    drawHookAndCargo(g);
    drawWinch();
    drawMiner(g, manifest);
    if (!reducedMotion) drawEffects(g, manifest);
    drawHud(g, manifest);
    drawPopups(g, reducedMotion);
    drawHintBar();
  }

  resize();
  return { draw, resize, get scale() { return scale; } };
}
