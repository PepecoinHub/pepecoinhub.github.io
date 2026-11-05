// Fixed-step, browser-independent simulation. Distances are metres; scores are decimetres.
// The track (75 spots) is the same every round, but what stands on each spot changes:
// every round has a seed, and the seed decides the layout. Same seed, same layout, same flight.
export const VERSION = 1;
export const STEP = 1 / 120;
// A safety limit, applied only after ground contact. Never end a flight mid-air.
export const MAX_TIME = 300;
export const MAX_DISTANCE = 6000;
export const DEFAULT_SEED = 1;
const SPOTS = 75;
// what can stand on a spot, and how often (out of 100)
const KINDS = [['trampoline', 21], ['fan', 13], ['mud', 13], ['cart', 11], ['sellwall', 17], ['pump', 13], ['', 12]];

function rng(seed) {   // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const layouts = new Map();
export function layout(seed = DEFAULT_SEED) {
  seed = (Number(seed) >>> 0) || DEFAULT_SEED;
  if (layouts.has(seed)) return layouts.get(seed);
  const r = rng(seed), out = [];
  let lastWall = -9;
  for (let i = 0; i < SPOTS; i++) {
    const x = 72 + i * 79 + ((i * 37) % 23);
    let roll = r() * 100, type = '';
    for (const [k, w] of KINDS) { if (roll < w) { type = k; break; } roll -= w; }
    // never two sell walls in a row, and the first spot is always friendly
    if (type === 'sellwall' && (i === 0 || i - lastWall < 2)) type = 'trampoline';
    if (type === 'sellwall') lastWall = i;
    const h = 7 + Math.floor(r() * 10);   // sell wall height in metres (7 to 16)
    if (type) out.push(type === 'sellwall' ? { id: i, x, type, h } : { id: i, x, type });
  }
  if (layouts.size > 20) layouts.clear();
  layouts.set(seed, out);
  return out;
}
export function obstacles(start = 0, end = MAX_DISTANCE, seed = DEFAULT_SEED) {
  return layout(seed).filter(o => o.x >= start && o.x <= end);
}
export function newSeed() { return (Math.floor(Math.random() * 4294967295) >>> 0) || DEFAULT_SEED; }
export function launch(power, angle, seed = DEFAULT_SEED) {
  const p = Math.max(0, Math.min(1, Number(power) || 0));
  const a = Math.max(20, Math.min(65, Number(angle) || 40)) * Math.PI / 180;
  const speed = 36 + p * 28;
  return { x: 0, y: 12, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, seed: (Number(seed) >>> 0) || DEFAULT_SEED,
    time: 0, flaps: 3, lastFlap: -1, bounces: 0, ended: false, endReason: '', used: new Set(), event: 'launch', eventAt: 0 };
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
  for (const o of obstacles(oldX - 8, s.x + 8, s.seed)) {
    if (o.type === 'sellwall') {
      // a red candle: anything lower than its top hits it and slides down. Flap over it, or fly high.
      const face = o.x - 1.5;
      if (oldX <= face + .01 && s.x > face && Math.min(s.y, oldY) < o.h) {
        s.x = face; s.vx = 0; s.vy = Math.min(s.vy, 0);
        if (s.event !== 'sellwall' || s.time - s.eventAt > .6) { s.bounces++; event(s, 'sellwall'); }
      }
      continue;
    }
    if (s.used.has(o.id)) continue;
    if (o.type === 'trampoline' && s.vy < 0 && s.y <= 2 && oldY >= 0 && Math.abs(s.x - o.x) < 6) {
      s.used.add(o.id); s.y = 2; s.vy = Math.min(48, Math.max(28, -s.vy * 1.12)); s.vx = Math.min(100, s.vx + 9); s.bounces++; event(s, 'trampoline');
    } else if (o.type === 'pump' && s.vy <= 0 && s.y <= 3 && Math.abs(s.x - o.x) < 7) {
      // a green candle pad: a big launch, and one panic flap back
      s.used.add(o.id); s.y = 3; s.vy = 40; s.vx = Math.min(100, Math.max(s.vx, 20) + 12); s.flaps = Math.min(3, s.flaps + 1); s.bounces++; event(s, 'pump');
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
  if (s.x >= MAX_DISTANCE) {
    s.x = MAX_DISTANCE; s.ended = true; s.endReason = 'course';
  } else if (s.y <= .02 && (s.vx < 1.5 || s.time >= MAX_TIME)) {
    s.ended = true; s.endReason = s.time >= MAX_TIME ? 'time' : 'landed';
  }
  return s;
}
export const score = s => Math.round(Math.max(0, Math.min(MAX_DISTANCE, s?.x || 0)) * 10);
