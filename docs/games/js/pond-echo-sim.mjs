// POND ECHO: deterministic pond simulation.
// Everything here uses only + - * / sqrt and comparisons on doubles in a fixed
// order, so the same inputs give the same pond in every browser. That is what
// lets an echo (a list of jump inputs) be replayed from a link and push your
// lilies exactly where it pushed them for its author.

export const HZ = 60;                 // simulation ticks per second
export const MAX_TICKS = 60 * HZ;     // a run lasts at most 60 s
export const MAX_JUMP = 210;          // longest jump, world units
export const WAVE_SPEED = 260;        // ring speed, units per second
export const WAVE_RANGE = 250;        // a ring stops pushing past this radius
export const WAVE_PUSH = 60;          // velocity kick at the centre for strength 1
export const SPLASH = 2.6;            // falling in the water
export const LAND = 1;                // landing on a lily
export const SHORE = 0.4;             // landing on a bank
export const DRAG = 0.97;             // lily velocity kept per tick
export const KICK = 30;               // recoil on take-off = push on landing, so hopping in place goes nowhere
export const MAX_CHAIN = 6;           // echoes inside echoes

export const LEVEL = {
  id: 'crossing-1',
  w: 960, h: 540,
  startX: 96, finishX: 864,
  start: { x: 62, y: 300 },
  bounds: { x0: 140, x1: 820, y0: 48, y1: 492 },
  lilies: [
    { x: 236, y: 300, r: 34 },
    { x: 380, y: 214, r: 31 },
    { x: 350, y: 392, r: 30 },
    { x: 548, y: 318, r: 29 },
    { x: 640, y: 196, r: 24 },
    { x: 630, y: 452, r: 30 },   // the last leaf: tempting, too far from the bank on its own
  ],
};

export function jumpTicks(dx, dy) {
  const d = Math.sqrt(dx * dx + dy * dy);
  return 18 + Math.round(24 * d / MAX_JUMP);
}

/** Clamp a wanted jump to the allowed length and round it to whole units (the stored input). */
export function quantizeJump(dx, dy) {
  let d = Math.sqrt(dx * dx + dy * dy);
  if (d > MAX_JUMP) { dx = dx * MAX_JUMP / d; dy = dy * MAX_JUMP / d; }
  dx = Math.round(dx); dy = Math.round(dy);
  d = Math.sqrt(dx * dx + dy * dy);
  if (d > MAX_JUMP) { dx -= Math.sign(dx); dy -= Math.sign(dy); }
  return [dx, dy];
}

export class World {
  /** external: wave events from echoes, [{t,x,y,s,src}] sorted by t. */
  constructor(level = LEVEL, external = []) {
    this.level = level;
    this.tick = 0;
    this.lilies = level.lilies.map((l, i) => ({ i, x: l.x, y: l.y, r: l.r, vx: 0, vy: 0, hitBy: null, hitAt: -1 }));
    this.waves = [];
    this.external = external;
    this.extIdx = 0;
    this.ownWaves = [];          // waves made by the frog in this world (what an echo leaves behind)
    this.ownKicks = [];          // recoil and landing pushes the frog gave its lilies
    this.kicks = [];             // pending velocity kicks {t,i,vx,vy}
    this.frog = { mode: 'bank', x: level.start.x, y: level.start.y, lily: -1, ox: 0, oy: 0, h: 0, air: null };
    this.result = null;          // {res:'win'|'fall'|'timeout', t}
    this.assist = null;          // {src, t} when an echo's wave moved the lily that carried you home
    this.assists = [];
  }

  canJump() { return !this.result && this.frog.mode !== 'air'; }

  jump(dx, dy) {
    if (!this.canJump()) return false;
    [dx, dy] = quantizeJump(dx, dy);
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 4) return false;
    const f = this.frog;
    if (f.mode === 'lily') {                       // recoil: the lily slides back a little
      const k = KICK * d / MAX_JUMP / d;
      this.kick(this.tick, f.lily, -dx * k, -dy * k);
    }
    f.air = { x0: f.x, y0: f.y, dx, dy, t0: this.tick, dur: jumpTicks(dx, dy), from: f.lily };
    f.mode = 'air'; f.lily = -1;
    return true;
  }

  kick(t, i, vx, vy) { const k = { t, i, vx, vy }; this.kicks.push(k); this.ownKicks.push(k); }

  addWave(x, y, s, src, ignore = -1) {
    this.pushWave({ t: this.tick, x, y, s, src, ig: ignore });
    if (src === 'me') this.ownWaves.push({ t: this.tick, x, y, s, ig: ignore });
  }

  pushWave(e) {
    const w = { t: e.t, x: e.x, y: e.y, s: e.s, src: e.src, hit: new Uint8Array(this.lilies.length) };
    if (e.ig >= 0) w.hit[e.ig] = 1;
    this.waves.push(w);
    // canonical order, so an echo's waves add up the same way in every world
    this.waves.sort((a, b) => a.t - b.t || a.x - b.x || a.y - b.y || a.s - b.s);
  }

  step() {
    const t = this.tick;
    // 1. echo waves that start now
    while (this.extIdx < this.external.length && this.external[this.extIdx].t <= t) {
      const e = this.external[this.extIdx++];
      if (e.k) this.kicks.push({ t: e.t, i: e.i, vx: e.vx, vy: e.vy });
      else this.pushWave(e);
    }
    // 1b. recoil and landing pushes due now, in canonical order
    if (this.kicks.length) {
      const due = this.kicks.filter(k => k.t <= t).sort((a, b) => a.i - b.i || a.vx - b.vx || a.vy - b.vy);
      this.kicks = this.kicks.filter(k => k.t > t);
      for (const k of due) { const L = this.lilies[k.i]; L.vx += k.vx; L.vy += k.vy; }
    }
    // 2. rings push the lilies they pass
    for (let wi = 0; wi < this.waves.length; wi++) {
      const w = this.waves[wi];
      const rad = (t - w.t) * WAVE_SPEED / HZ;
      for (const L of this.lilies) {
        if (w.hit[L.i]) continue;
        const dx = L.x - w.x, dy = L.y - w.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d > rad) continue;
        w.hit[L.i] = 1;
        if (d >= WAVE_RANGE || d < 0.001) continue;
        const kick = w.s * WAVE_PUSH * (1 - d / WAVE_RANGE) / d;
        L.vx += dx * kick; L.vy += dy * kick;
        if (w.src !== 'me') { L.hitBy = w.src; L.hitAt = t; }
      }
    }
    this.waves = this.waves.filter(w => (t - w.t) * WAVE_SPEED / HZ < WAVE_RANGE + 40);
    // 3. lilies drift, slow down, stay in the pond and do not overlap
    const B = this.level.bounds;
    for (const L of this.lilies) {
      L.x += L.vx / HZ; L.y += L.vy / HZ;
      L.vx *= DRAG; L.vy *= DRAG;
      if (L.x < B.x0) { L.x = B.x0; L.vx = -L.vx * 0.5; }
      if (L.x > B.x1) { L.x = B.x1; L.vx = -L.vx * 0.5; }
      if (L.y < B.y0) { L.y = B.y0; L.vy = -L.vy * 0.5; }
      if (L.y > B.y1) { L.y = B.y1; L.vy = -L.vy * 0.5; }
    }
    for (let a = 0; a < this.lilies.length; a++) for (let b = a + 1; b < this.lilies.length; b++) {
      const A = this.lilies[a], C = this.lilies[b];
      const dx = C.x - A.x, dy = C.y - A.y, d = Math.sqrt(dx * dx + dy * dy), min = A.r + C.r;
      if (d >= min || d < 0.001) continue;
      const push = (min - d) / 2 / d;
      A.x -= dx * push; A.y -= dy * push; C.x += dx * push; C.y += dy * push;
      const rel = ((C.vx - A.vx) * dx + (C.vy - A.vy) * dy) / (d * d);
      if (rel < 0) { A.vx += rel * dx; A.vy += rel * dy; C.vx -= rel * dx; C.vy -= rel * dy; }
    }
    // 4. the frog
    const f = this.frog;
    if (f.mode === 'lily') {
      const L = this.lilies[f.lily]; f.x = L.x + f.ox; f.y = L.y + f.oy;
    } else if (f.mode === 'air') {
      const a = f.air, p = (t + 1 - a.t0) / a.dur;
      f.x = a.x0 + a.dx * p; f.y = a.y0 + a.dy * p; f.h = 4 * p * (1 - p);
      if (t + 1 - a.t0 >= a.dur) this.land();
    }
    this.tick = t + 1;
    if (!this.result && this.tick >= MAX_TICKS) this.result = { res: 'timeout', t: this.tick };
  }

  land() {
    const f = this.frog, a = f.air; f.h = 0; f.air = null;
    const d = Math.sqrt(a.dx * a.dx + a.dy * a.dy), lv = this.level;
    if (f.x >= lv.finishX) {
      f.mode = 'won'; this.addWave(f.x, f.y, SHORE, 'me');
      this.result = { res: 'win', t: this.tick + 1 };
      return;
    }
    if (f.x <= lv.startX) { f.mode = 'bank'; this.addWave(f.x, f.y, SHORE, 'me'); return; }
    let best = -1, bd = 1e9;
    for (const L of this.lilies) {
      const dx = f.x - L.x, dy = f.y - L.y, dd = Math.sqrt(dx * dx + dy * dy);
      if (dd <= L.r && dd < bd) { bd = dd; best = L.i; }
    }
    if (best < 0) {
      f.mode = 'fell'; this.addWave(f.x, f.y, SPLASH, 'me');
      this.result = { res: 'fall', t: this.tick + 1 };
      return;
    }
    const L = this.lilies[best];
    f.mode = 'lily'; f.lily = best;
    let ox = f.x - L.x, oy = f.y - L.y; const od = Math.sqrt(ox * ox + oy * oy), lim = L.r * 0.7;
    if (od > lim) { ox = ox * lim / od; oy = oy * lim / od; }
    f.ox = ox; f.oy = oy;
    const k = KICK * d / MAX_JUMP / d;                 // momentum: the lily slides on in the jump direction
    this.kick(this.tick + 1, best, a.dx * k, a.dy * k);
    if (L.hitBy) this.assists.push({ src: L.hitBy, t: this.tick, lily: best });
    this.addWave(f.x, f.y, LAND, 'me', best);
  }
}

// ---------------------------------------------------------------- runs & echoes
// A run is {n: nick, j: [[tick, dx, dy], ...], e: endTick, r: result, p: parentRun|null}.

export function chainOf(run) { const out = []; for (let r = run; r && out.length < MAX_CHAIN + 1; r = r.p) out.push(r); return out; }

const cache = new WeakMap();

/** Replays a run in its own world (with all of its parents' waves) and returns what it left behind. */
export function replay(run, level = LEVEL) {
  if (cache.has(run)) return cache.get(run);
  const parents = run.p ? echoWaves(run.p, level, 1) : [];
  const w = new World(level, parents);
  const frames = [];
  let ji = 0;
  const end = Math.min(run.e ?? MAX_TICKS, MAX_TICKS);
  while (w.tick < end && !w.result) {
    while (ji < run.j.length && run.j[ji][0] <= w.tick) { const [, dx, dy] = run.j[ji++]; w.jump(dx, dy); }
    w.step();
    const f = w.frog; frames.push([f.x, f.y, f.h, f.mode]);
  }
  const out = { frames, waves: w.ownWaves, kicks: w.ownKicks, result: w.result, assists: w.assists, end: w.tick };
  cache.set(run, out);
  return out;
}

/** Wave events of a run and all its parents, labelled by depth so the UI can tell echoes apart. */
export function echoWaves(run, level = LEVEL, depth = 1) {
  const out = [];
  let d = depth;
  for (const r of chainOf(run)) {
    const nick = r.n || 'fren';
    const rp = replay(r, level);
    for (const w of rp.waves) out.push({ t: w.t, x: w.x, y: w.y, s: w.s, ig: w.ig, src: 'echo' + d + ':' + nick });
    for (const k of rp.kicks) out.push({ k: 1, t: k.t, i: k.i, vx: k.vx, vy: k.vy });
    d++;
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

// ---------------------------------------------------------------- links
const NICK = /[^\p{L}\p{N} ._-]/gu;
export function cleanNick(s) { return String(s || '').replace(NICK, '').trim().slice(0, 16) || 'fren'; }

function pack(run, depth) {
  return { n: cleanNick(run.n), j: run.j.map(x => [x[0] | 0, x[1] | 0, x[2] | 0]), e: run.e | 0, r: run.r, ...(run.p && depth < MAX_CHAIN ? { p: pack(run.p, depth + 1) } : {}) };
}
function b64url(str) {
  const bytes = new TextEncoder().encode(str); let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}
export function encodeRun(run) { return 'v1.' + LEVEL.id + '.' + b64url(JSON.stringify(pack(run, 0))); }

export function decodeRun(code) {
  const m = /^v1\.([\w-]+)\.([\w-]+)$/.exec(String(code || ''));
  if (!m || m[1] !== LEVEL.id) return null;
  try { return check(JSON.parse(unb64url(m[2])), 0); } catch { return null; }
}
function check(o, depth) {
  if (!o || typeof o !== 'object' || !Array.isArray(o.j) || o.j.length > 400 || depth > MAX_CHAIN) throw 0;
  let last = -1;
  const j = o.j.map(x => {
    if (!Array.isArray(x) || x.length !== 3 || !x.every(Number.isInteger)) throw 0;
    if (x[0] < last || x[0] < 0 || x[0] > MAX_TICKS || Math.abs(x[1]) > MAX_JUMP || Math.abs(x[2]) > MAX_JUMP) throw 0;
    last = x[0]; return [x[0], x[1], x[2]];
  });
  const e = Number.isInteger(o.e) ? Math.max(0, Math.min(MAX_TICKS, o.e)) : MAX_TICKS;
  return { n: cleanNick(o.n), j, e, r: ['win', 'fall', 'timeout'].includes(o.r) ? o.r : 'fall', p: o.p ? check(o.p, depth + 1) : null };
}
