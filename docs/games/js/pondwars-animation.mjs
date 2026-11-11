// Presentation only: never writes to frogs, simulation events, terrain or RNG.
export const STATES = Object.freeze(['idle', 'aim', 'charge', 'fire', 'jump', 'backflip', 'falling', 'landing', 'hit', 'victory', 'ko']);
const DURATION = { fire: .28, landing: .22, hit: .32 };

export class CharacterAnimator {
  constructor() { this.reset(); }
  reset() { this.time = 0; this.actors = new Map(); }
  advance(dt, paused = false) {
    if (!paused && Number.isFinite(dt) && dt > 0) this.time += dt;
  }
  observe(g, events = [], { charging = false, onHealthDrop } = {}) {
    for (const f of g.frogs) {
      let a = this.actors.get(f.id);
      if (!a) { a = { state: 'idle', since: this.time, hp: f.hp, ground: f.ground }; this.actors.set(f.id, a); }
      // Optional presentation observer. Initial/restored actors never synthesize damage.
      if (a.hp - f.hp >= 1) onHealthDrop?.(f, a.hp, this.time);
      let pulse = null;
      if (!a.ground && f.ground) pulse = 'landing';
      if (events.some(e => e.type === 'fire') && f.id === g.current) pulse = 'fire';
      if (f.hp < a.hp) pulse = 'hit';
      if (pulse && f.alive) { a.pulse = pulse; a.until = this.time + DURATION[pulse]; a.since = this.time; }
      let state;
      if (!f.alive || f.hp <= 0) state = 'ko';
      else if (a.pulse && this.time < a.until) state = a.pulse;
      else if (g.phase === 'over' && g.winner === f.team) state = 'victory';
      else if (!f.ground && f.flipT != null) state = 'backflip';
      else if (!f.ground) state = f.vy < 0 ? 'jump' : 'falling';
      else if (g.phase === 'aim' && f.id === g.current) state = charging ? 'charge' : 'aim';
      else state = 'idle';
      if (state !== a.state) { a.state = state; a.since = this.time; }
      a.hp = f.hp; a.ground = f.ground;
    }
  }
  sample(f, reduced = false) {
    const a = this.actors.get(f.id) || { state: 'idle', since: this.time };
    const age = Math.max(0, this.time - a.since), state = a.state;
    const p = { state, age, dx: 0, dy: 0, rotation: 0, sx: 1, sy: 1, alpha: 1 };
    // Static alternatives: no shaking, spinning, flashing or animated frames.
    if (reduced) { if (state === 'ko') p.alpha = .45; return p; }
    const wave = Math.sin(age * 6), kick = Math.sin(Math.min(1, age / (DURATION[state] || 1)) * Math.PI);
    if (state === 'idle' || state === 'aim') { p.sy = 1 + wave * .012; p.dy = -Math.abs(wave) * .5; }
    if (state === 'aim') p.rotation = f.face * -.025;
    if (state === 'charge') { p.sx = 1.04; p.sy = .96; p.rotation = f.face * (-.04 + Math.sin(age * 18) * .012); }
    if (state === 'fire') { p.dx = -f.face * 4 * kick; p.rotation = f.face * -.12 * kick; }
    if (state === 'jump') { p.sx = .94; p.sy = 1.06; p.rotation = f.face * .06; }
    if (state === 'backflip') p.rotation = -(f.hopFace || f.face) * Math.PI * 2 * Math.min(1, (f.flipT || 0) / .7);
    if (state === 'falling') { p.sx = 1.04; p.sy = .96; }
    if (state === 'landing') { p.sx = 1 + .12 * kick; p.sy = 1 - .12 * kick; p.dy = 3 * kick; }
    if (state === 'hit') { p.rotation = f.face * .16 * kick; p.dx = -f.face * 3 * kick; }
    if (state === 'victory') { p.dy = -Math.abs(wave) * 4; p.rotation = Math.sin(age * 4) * .06; }
    if (state === 'ko') { p.rotation = f.face * Math.min(1, age / .55) * Math.PI / 2; p.alpha = Math.max(0, 1 - age / .55); }
    return p;
  }
}

// Same transform for sprite and grip; projectileOrigin deliberately stays in physics space.
export function characterPoint(f, pose, point = { x: 0, y: -32 }) {
  const x = point.x * f.face * pose.sx, y = (point.y + 29) * pose.sy;
  const c = Math.cos(pose.rotation), s = Math.sin(pose.rotation);
  return { x: f.x + pose.dx + x * c - y * s, y: f.y - 29 + pose.dy + x * s + y * c };
}

// Optional v1 sprite manifest. Coordinates use the source frame's own pixels.
// Missing clips/images fall back to the owner's existing static skin.
export function spriteFrame(manifest, state, age, reduced = false) {
  const clip = manifest?.version === 1 && manifest.clips?.[state];
  if (!clip?.frames?.length || !(clip.fps > 0)) return null;
  const i = reduced ? 0 : Math.floor(Math.max(0, age) * clip.fps);
  return clip.frames[clip.loop ? i % clip.frames.length : Math.min(i, clip.frames.length - 1)];
}
export function validateManifest(manifest) {
  const pair = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
  if (manifest?.version !== 1 || manifest.facing !== 'right' || !pair(manifest.frameSize) ||
      !manifest.frameSize.every(n => Number.isInteger(n) && n > 0) || !manifest.clips || typeof manifest.clips !== 'object') return false;
  return Object.entries(manifest.clips).every(([state, clip]) => STATES.includes(state) &&
    Number.isFinite(clip.fps) && clip.fps > 0 && typeof clip.loop === 'boolean' && Array.isArray(clip.frames) && clip.frames.length > 0 &&
    clip.frames.every(f => Array.isArray(f.rect) && f.rect.length === 4 && f.rect.every(Number.isFinite) &&
      f.rect[0] >= 0 && f.rect[1] >= 0 && f.rect[2] === manifest.frameSize[0] && f.rect[3] === manifest.frameSize[1] &&
      pair(f.foot) && pair(f.hand)));
}
export function frameGeometry(frame, height = 64) {
  const [sx, sy, sw, sh] = frame.rect, scale = height / sh;
  return { sx, sy, sw, sh, x: -frame.foot[0] * scale, y: -frame.foot[1] * scale,
    width: sw * scale, height, hand: { x: (frame.hand[0] - frame.foot[0]) * scale, y: (frame.hand[1] - frame.foot[1]) * scale } };
}
