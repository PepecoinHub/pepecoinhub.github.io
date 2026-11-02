// Fixed-step, browser-independent simulation. Distances are metres; scores are decimetres.
export const VERSION = 1;
export const STEP = 1 / 120;
export const MAX_TIME = 90;
export const MAX_DISTANCE = 6000;
export function obstacles(start = 0, end = 6000) {
  const out = [];
  for (let i = 0; i < 75; i++) {
    const x = 72 + i * 79 + ((i * 37) % 23);
    if (x >= start && x <= end) out.push({ id: i, x, type: ['trampoline', 'fan', 'mud', 'cart', 'trampoline'][i % 5] });
  }
  return out;
}
export function launch(power, angle) {
  const p = Math.max(0, Math.min(1, Number(power) || 0));
  const a = Math.max(20, Math.min(65, Number(angle) || 40)) * Math.PI / 180;
  const speed = 36 + p * 28;
  return { x: 0, y: 12, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
    time: 0, flaps: 3, lastFlap: -1, bounces: 0, ended: false, used: new Set(), event: 'launch', eventAt: 0 };
}
function event(s, name) { s.event = name; s.eventAt = s.time; }
export function flap(s) {
  if (!s || s.ended || s.flaps < 1 || s.time - s.lastFlap < .35 || s.y < .5) return false;
  s.flaps--; s.lastFlap = s.time; s.vy = Math.min(42, Math.max(0, s.vy) + 13); s.vx = Math.min(100, s.vx + 5);
  event(s, 'flap'); return true;
}
export function step(s) {
  if (!s || s.ended) return s;
  const oldX = s.x, oldY = s.y;
  s.time += STEP;
  s.vy -= 9.8 * STEP;
  s.vx *= 1 - .018 * STEP;
  s.x += s.vx * STEP; s.y += s.vy * STEP;
  for (const o of obstacles(oldX - 8, s.x + 8)) {
    if (s.used.has(o.id)) continue;
    if (o.type === 'trampoline' && s.vy < 0 && s.y <= 2 && oldY >= 0 && Math.abs(s.x - o.x) < 6) {
      s.used.add(o.id); s.y = 2; s.vy = Math.min(48, Math.max(28, -s.vy * 1.12)); s.vx = Math.min(100, s.vx + 9); s.bounces++; event(s, 'trampoline');
    } else if (o.type === 'fan' && oldX <= o.x && s.x >= o.x && s.y < 27) {
      s.used.add(o.id); s.vy = Math.max(s.vy, 26); s.vx = Math.min(100, s.vx + 11); event(s, 'fan');
    } else if (o.type === 'cart' && oldX <= o.x && s.x >= o.x && s.y < 7) {
      s.used.add(o.id); s.vy = 22; s.vx = Math.min(100, s.vx + 14); event(s, 'cart');
    } else if (o.type === 'mud' && s.y <= .7 && Math.abs(s.x - o.x) < 8) {
      s.used.add(o.id); s.vx *= .25; s.vy = 0; event(s, 'mud');
    }
  }
  if (s.y < 0) {
    s.y = 0;
    if (s.vy < -7 && s.vx > 4) { s.vy = -s.vy * .42; s.vx *= .78; s.bounces++; event(s, 'bounce'); }
    else { s.vy = 0; s.vx = Math.max(0, s.vx - 17 * STEP); }
  }
  if ((s.y <= .02 && s.vx < 1.5) || s.time >= MAX_TIME || s.x >= MAX_DISTANCE) {
    s.x = Math.min(s.x, MAX_DISTANCE); s.ended = true;
  }
  return s;
}
export const score = s => Math.round(Math.max(0, Math.min(MAX_DISTANCE, s?.x || 0)) * 10);
