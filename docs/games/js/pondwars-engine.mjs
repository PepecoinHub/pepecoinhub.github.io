// POND WARS engine: turn-based frog artillery on a destructible island. No DOM here (tests run it in Node).
// Units are pixels and seconds; the world is W x H; the pond starts at WATER (anything below it drowns).
export const W = 1200, H = 600, WATER = 560, STEP = 1 / 60, G = 520;
export const WEAPONS = {
  grenade: { name: 'Lily Grenade', short: 'Grenade', radius: 30, damage: 46, fuse: 3, wind: false, ammo: Infinity, power: 520 },
  rocket: { name: 'Hopium Rocket', short: 'Rocket', radius: 27, damage: 42, wind: true, ammo: Infinity, power: 620 },
  candles: { name: 'Red Candle Drop', short: 'Candles', radius: 21, damage: 26, wind: false, ammo: 1 },
};
const NAMES = [['Hopper', 'Lily', 'Ribbit', 'Pad'], ['Croak', 'Bog', 'Toady', 'Murk']];

export function rng(seed) {   // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------- terrain: 1 = ground ----------
export function makeTerrain(seed) {
  const r = rng(seed), mask = new Uint8Array(W * H), top = new Float32Array(W);
  const waves = Array.from({ length: 4 }, (_, i) => ({ a: (60 - i * 12) * (.6 + r() * .8), f: (i + 1) * (.004 + r() * .004), p: r() * 7 }));
  const base = 330 + r() * 50;
  for (let x = 0; x < W; x++) {
    let h = base;
    for (const w of waves) h += Math.sin(x * w.f + w.p) * w.a;
    const edge = Math.min(x, W - 1 - x);   // the island sinks into the pond at both ends
    if (edge < 120) h += (120 - edge) * (120 - edge) / 60;
    top[x] = Math.max(140, h);
  }
  for (let x = 0; x < W; x++) for (let y = Math.floor(top[x]); y < H; y++) mask[y * W + x] = 1;
  // a few caves and a floating rock make it less flat
  const caves = 2 + Math.floor(r() * 3);
  for (let i = 0; i < caves; i++) { const cx = 200 + r() * 800; carve(mask, cx, top[Math.floor(cx)] + 50 + r() * 70, 18 + r() * 22); }
  const fx = 300 + r() * 600, fy = 120 + r() * 60;
  for (let y = -16; y <= 16; y++) for (let x = -70; x <= 70; x++) if ((x * x) / 4900 + (y * y) / 256 <= 1) { const X = Math.round(fx + x), Y = Math.round(fy + y); if (X >= 0 && X < W && Y >= 0 && Y < H) mask[Y * W + X] = 1; }
  return mask;
}
export function solid(mask, x, y) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || x >= W || y < 0) return false;
  if (y >= H) return true;
  return mask[y * W + x] === 1;
}
export function carve(mask, cx, cy, r) {
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r)), y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) mask[y * W + x] = 0;
  return [x0, y0, x1, y1];
}
function surfaceBelow(mask, x, y) { for (let yy = Math.max(0, Math.floor(y)); yy < H; yy++) if (solid(mask, x, yy)) return yy; return H; }

// ---------- a new match ----------
export function newGame({ seed = 1, perTeam = 3, cpu = [false, true], level = 1 } = {}) {
  const mask = makeTerrain(seed), r = rng(seed ^ 0x9e3779b9), frogs = [];
  const slots = [];
  for (let i = 0; i < perTeam * 2; i++) slots.push(150 + (i + .5) * (900 / (perTeam * 2)));
  for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]]; }
  for (let i = 0; i < perTeam * 2; i++) {
    const team = i % 2, x = Math.round(slots[i] + (r() - .5) * 40);
    const y = surfaceBelow(mask, x, 0) - 1;
    frogs.push({ id: i, team, name: NAMES[team][Math.floor(i / 2)], x, y, vx: 0, vy: 0, hp: 100, alive: true, ground: true, face: x < W / 2 ? 1 : -1, fallFrom: y, gone: '' });
  }
  return { seed, mask, frogs, shots: [], booms: [], texts: [], dirty: [], cpu, level, turn: 0, team: 0, next: [0, 0], current: 0,
    wind: 0, weapon: 'grenade', ammo: [{ candles: 1 }, { candles: 1 }], phase: 'aim', timer: 30, settle: 0, winner: null, rand: r, events: [] };
}
export function aliveOf(g, team) { return g.frogs.filter(f => f.alive && f.team === team); }
export function startTurn(g) {
  const team = g.turn % 2, list = aliveOf(g, team);
  g.team = team; g.current = list[g.next[team] % list.length].id; g.next[team]++;
  g.wind = Math.round((g.rand() * 2 - 1) * 10) / 10; g.phase = 'aim'; g.timer = 30; g.weapon = 'grenade'; g.settle = 0;
  g.events.push({ type: 'turn' });
}
export const me = g => g.frogs[g.current];

// ---------- actions of the frog whose turn it is ----------
export function walk(g, dir) {
  const f = me(g); if (g.phase !== 'aim' || !f.ground) return false;
  f.face = dir;
  const nx = f.x + dir;
  if (nx < 2 || nx > W - 3) return false;
  for (let up = 0; up <= 3; up++) if (!solid(g.mask, nx, f.y - up) && !solid(g.mask, nx, f.y - up - 10)) { f.x = nx; f.y -= up; if (!solid(g.mask, f.x, f.y + 1)) { f.ground = false; f.fallFrom = f.y; } return true; }
  return false;
}
export function hop(g) {
  const f = me(g); if (g.phase !== 'aim' || !f.ground) return false;
  f.vx = f.face * 95; f.vy = -235; f.ground = false; f.fallFrom = f.y - 40; g.events.push({ type: 'hop' }); return true;
}
// angle in radians (0 = right, -PI/2 = up), power 0..1; for candles, tx is the x where they fall
export function fire(g, angle, power, tx) {
  const f = me(g), w = WEAPONS[g.weapon];
  if (g.phase !== 'aim' || !f.alive) return false;
  if (g.weapon === 'candles') {
    if (!(g.ammo[g.team].candles > 0)) return false;
    g.ammo[g.team].candles--;
    const x = Math.max(30, Math.min(W - 30, tx ?? f.x));
    for (let i = -1; i <= 1; i++) g.shots.push({ type: 'candles', x: x + i * 34, y: -30 - Math.abs(i) * 40, vx: 0, vy: 60, t: 0 });
  } else {
    const p = Math.max(.08, Math.min(1, power)) * w.power;
    g.shots.push({ type: g.weapon, x: f.x + Math.cos(angle) * 12, y: f.y - 8 + Math.sin(angle) * 12, vx: Math.cos(angle) * p, vy: Math.sin(angle) * p, t: 0 });
    f.face = Math.cos(angle) >= 0 ? 1 : -1;
  }
  g.phase = 'fire'; g.events.push({ type: 'fire', weapon: g.weapon }); return true;
}
export function skip(g) { if (g.phase === 'aim') { g.phase = 'settle'; g.settle = .4; } }

// ---------- simulation ----------
export function stepShot(g, s, mask = g.mask, frogs = g.frogs) {
  const w = WEAPONS[s.type];
  s.t += STEP;
  s.vy += G * STEP;
  if (w.wind) s.vx += g.wind * 140 * STEP;
  const nx = s.x + s.vx * STEP, ny = s.y + s.vy * STEP;
  if (s.type === 'grenade') {
    if (solid(mask, nx, ny)) {
      const hitX = solid(mask, nx, s.y), hitY = solid(mask, s.x, ny);
      if (hitX || !hitY) s.vx = -s.vx * .5;
      if (hitY || !hitX) s.vy = -s.vy * .42;
      s.vx *= .9;
      if (Math.abs(s.vy) < 25 && solid(mask, s.x, s.y + 2)) s.vy = 0;
    } else { s.x = nx; s.y = ny; }
    if (s.t >= w.fuse) return 'boom';
  } else {
    // rockets and candles go off on ground or on a frog
    const n = Math.max(1, Math.ceil(Math.hypot(nx - s.x, ny - s.y) / 3));
    for (let i = 1; i <= n; i++) {
      const x = s.x + (nx - s.x) * i / n, y = s.y + (ny - s.y) * i / n;
      if (solid(mask, x, y) || (s.t > .12 && frogs.some(f => f.alive && Math.abs(f.x - x) < 10 && y > f.y - 24 && y < f.y + 2))) { s.x = x; s.y = y; return 'boom'; }
    }
    s.x = nx; s.y = ny;
  }
  if (s.y > WATER + 6) return 'splash';
  if (s.x < -200 || s.x > W + 200 || s.y > H + 50) return 'gone';
  return '';
}
export function explode(g, x, y, type) {
  const w = WEAPONS[type];
  g.dirty.push(carve(g.mask, x, y, w.radius));
  g.booms.push({ x, y, r: w.radius, t: 0 });
  g.events.push({ type: 'boom' });
  for (const f of g.frogs) {
    if (!f.alive) continue;
    const dx = f.x - x, dy = (f.y - 11) - y, d = Math.hypot(dx, dy), reach = w.radius * 1.7;
    if (d > reach) continue;
    const k = 1 - d / reach, dmg = Math.round(w.damage * (.35 + .65 * k));
    hurt(g, f, dmg);
    const push = 260 * k + 60, nx = d ? dx / d : 0;
    f.vx += nx * push; f.vy -= 150 * k + 90; f.ground = false; f.fallFrom = f.y;
  }
}
function hurt(g, f, dmg) {
  if (dmg <= 0 || !f.alive) return;
  f.hp = Math.max(0, f.hp - dmg); g.texts.push({ x: f.x, y: f.y - 30, text: '-' + dmg, t: 0, team: f.team });
}
function stepFrog(g, f) {
  if (!f.alive) return;
  if (f.ground) { if (!solid(g.mask, f.x, f.y + 1)) { f.ground = false; f.fallFrom = f.y; } else return; }
  f.vy += G * STEP; f.vx *= .995;
  const nx = f.x + f.vx * STEP, ny = f.y + f.vy * STEP;
  if (f.vy > 0 && solid(g.mask, nx, ny)) {
    // land on top of the ground
    let y = Math.floor(ny); while (y > 0 && solid(g.mask, nx, y)) y--;
    f.x = nx; f.y = y; f.ground = true;
    const drop = f.y - f.fallFrom;
    if (drop > 90) hurt(g, f, Math.min(40, Math.round((drop - 90) / 4)));
    f.vx = 0; f.vy = 0;
  } else if (solid(g.mask, nx, ny - 10) || solid(g.mask, nx, ny)) {
    f.vx = -f.vx * .3; if (f.vy < 0) f.vy = 0;
  } else { f.x = nx; f.y = ny; }
  if (f.y > WATER) { f.alive = false; f.hp = 0; f.gone = 'splash'; g.events.push({ type: 'splash', x: f.x }); g.texts.push({ x: f.x, y: WATER - 20, text: 'SPLASH!', t: 0, team: f.team }); }
  else if (f.x < -40 || f.x > W + 40) { f.alive = false; f.hp = 0; f.gone = 'away'; }
}
// one fixed step of the whole game
export function step(g) {
  if (g.winner !== null) return;
  for (const s of g.shots.slice()) {
    const r = stepShot(g, s);
    if (r === 'boom') { explode(g, s.x, s.y, s.type); g.shots.splice(g.shots.indexOf(s), 1); }
    else if (r) { g.shots.splice(g.shots.indexOf(s), 1); if (r === 'splash') g.events.push({ type: 'plop', x: s.x }); }
  }
  for (const f of g.frogs) stepFrog(g, f);
  for (const f of g.frogs) if (f.alive && f.hp <= 0 && f.ground) { f.alive = false; f.gone = 'ko'; g.events.push({ type: 'ko', name: f.name }); }
  g.booms = g.booms.filter(b => (b.t += STEP) < .5);
  g.texts = g.texts.filter(t => (t.t += STEP) < 1.4);
  if (g.phase === 'aim') {
    g.timer -= STEP;
    if (!me(g).alive) { g.phase = 'settle'; g.settle = .6; }
    else if (g.timer <= 0) { g.phase = 'settle'; g.settle = .3; g.events.push({ type: 'timeout' }); }
  } else if (g.phase === 'fire') {
    if (!g.shots.length) { g.phase = 'settle'; g.settle = .9; }
  } else if (g.phase === 'settle') {
    const still = g.frogs.every(f => !f.alive || f.ground);
    if (still && !g.shots.length) g.settle -= STEP;
    if (g.settle <= 0) {
      const a = aliveOf(g, 0).length, b = aliveOf(g, 1).length;
      if (!a || !b) { g.winner = a ? 0 : b ? 1 : -1; g.phase = 'over'; g.events.push({ type: 'over' }); return; }
      g.turn++; startTurn(g);
    }
  }
}

// ---------- the CPU player: tries many throws in its head and picks a good one ----------
function simulate(g, type, angle, power, target) {
  const f = me(g), w = WEAPONS[type], p = power * w.power;
  const s = { type, x: f.x + Math.cos(angle) * 12, y: f.y - 8 + Math.sin(angle) * 12, vx: Math.cos(angle) * p, vy: Math.sin(angle) * p, t: 0 };
  const others = g.frogs.filter(o => o.alive && o.id !== f.id);
  for (let i = 0; i < 600; i++) {
    const r = stepShot(g, s, g.mask, others);
    if (r === 'boom') break;
    if (r) return { score: -1e9 };
  }
  const reach = w.radius * 1.7;
  let score = 0;
  for (const o of g.frogs) {
    if (!o.alive) continue;
    const d = Math.hypot(o.x - s.x, o.y - 11 - s.y);
    if (d < reach) score += (o.team === f.team ? -1.6 : 1) * (1 - d / reach) * 100;
  }
  if (score === 0) score = -Math.hypot(target.x - s.x, target.y - s.y) / 10;
  return { score, x: s.x, y: s.y };
}
export function cpuPlan(g) {
  const f = me(g), enemies = aliveOf(g, 1 - f.team);
  let best = { score: -1e9, weapon: 'grenade', angle: -Math.PI / 2, power: .5 };
  for (const t of enemies) {
    for (const type of ['rocket', 'grenade']) {
      for (let a = -175; a <= -5; a += 5) {
        for (let p = .25; p <= 1.001; p += .05) {
          const r = simulate(g, type, a * Math.PI / 180, p, t);
          if (r.score > best.score) best = { score: r.score, weapon: type, angle: a * Math.PI / 180, power: p };
        }
      }
    }
  }
  if (g.ammo[f.team].candles > 0 && best.score < 20 && enemies.length) {
    const t = enemies[Math.floor(g.rand() * enemies.length)];
    return { weapon: 'candles', angle: -Math.PI / 2, power: 1, tx: t.x + (g.rand() - .5) * 40 };
  }
  // levels: 0 = easy (big misses), 1 = normal, 2 = hard
  const wobble = [.3, .12, .04][g.level] ?? .12, pw = [.2, .08, .03][g.level] ?? .08;
  best.angle += (g.rand() * 2 - 1) * wobble; best.power = Math.max(.1, Math.min(1, best.power + (g.rand() * 2 - 1) * pw));
  return best;
}
