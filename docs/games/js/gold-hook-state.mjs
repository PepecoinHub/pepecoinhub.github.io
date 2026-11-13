// Pure game logic: no DOM, canvas or system clock. Time comes from outside
// (update(g, dt) in seconds), so results never depend on the device's frame rate.
import { HOOK, LAYOUT, OBJECT_TYPES, TIMING, ANIM_PRIORITY, GAME_ID } from './gold-hook-config.mjs';
import { levelDef, speedsFor } from './gold-hook-campaign.mjs';

export const APP = { TITLE: 'TITLE', PLAYING: 'PLAYING', PAUSED: 'PAUSED', RESULT: 'RESULT' };
export const HOOK_MODE = {
  READY: 'READY',
  EXTENDING: 'EXTENDING',
  RETURNING_EMPTY: 'RETURNING_EMPTY',
  RETURNING_LOADED: 'RETURNING_LOADED',
};

const DEG = Math.PI / 180;

// Default reaction lengths (ms) from the art brief; replaced by the totals in manifest.json.
const DEFAULT_REACTION_MS = { success: 600, fail: 650, hurt: 450 };

// A game plays one level at a time. `mods` are the shop upgrades the level is played with:
// { strength, reel, dynamite, extraSec }.
export function createGame({ level = levelDef(1), mods = {}, reactionMs = DEFAULT_REACTION_MS } = {}) {
  const g = { app: APP.TITLE, reactionMs: { ...DEFAULT_REACTION_MS, ...reactionMs } };
  setLevel(g, level, mods);
  return g;
}

export function setLevel(g, level, mods = {}) {
  g.def = level;
  g.mods = { strength: 0, reel: 0, dynamite: 0, extraSec: 0, ...mods };
  resetRound(g);
}

// Full reset: objects, timer, hook, animations, messages.
export function resetRound(g) {
  const r = g.def;
  g.level = r.level;
  g.target = r.target;
  g.duration = r.durationSec + g.mods.extraSec;
  g.timeLeft = g.duration;
  g.score = 0;
  g.speeds = speedsFor(g.mods);
  g.dynamite = g.mods.dynamite;
  g.dynamiteUsed = 0;
  // Heavier loot on later levels: every object comes up slower by the level weight.
  g.objects = r.objects.map((o, i) => {
    const t = OBJECT_TYPES[o.type];
    return { id: i, type: o.type, asset: t.asset, x: o.x, y: o.y, r: t.radius,
      points: o.points ?? t.points, speedMul: t.speedMul * r.weight, blast: t.blast || 0, caught: false };
  });
  g.hook = { mode: HOOK_MODE.READY, phase: 0, angle: 0, length: HOOK.restLength, cargo: null };
  g.animClock = 0;          // ms of game time, for the idle/pull loops
  g.reaction = null;        // { name, t, total } — success/fail/hurt
  g.popups = [];
  g.effects = [];           // { kind: 'sparkle' | 'dust' | 'explosion', x, y, t } in game time, so pause freezes them
  g.events = [];            // event queue for the UI (announcements, later sounds)
  g.result = null;
  g.lowTimeMarks = new Set();
  // Round log for score checks: object id and game time (s) of each delivery.
  g.catches = [];
  g.blasts = [];            // powder barrels blown up: { id, t }
}

export function startRound(g) {
  resetRound(g);
  g.app = APP.PLAYING;
}

export function pause(g) {
  if (g.app === APP.PLAYING) { g.app = APP.PAUSED; return true; }
  return false;
}

export function resume(g) {
  if (g.app === APP.PAUSED) { g.app = APP.PLAYING; return true; }
  return false;
}

export function toTitle(g) {
  resetRound(g);
  g.app = APP.TITLE;
}

// Fires only in PLAYING + READY.
export function fire(g) {
  if (g.app !== APP.PLAYING || g.hook.mode !== HOOK_MODE.READY) return false;
  g.hook.mode = HOOK_MODE.EXTENDING;
  return true;
}

export function hookDir(angleDeg) {
  return { x: Math.sin(angleDeg * DEG), y: Math.cos(angleDeg * DEG) };
}

// Dynamite: blow up whatever is on the hook (a rock, usually). The load is lost, the empty hook
// comes back fast. Only while reeling something in, and only with a stick left.
export function useDynamite(g) {
  const h = g.hook;
  if (g.app !== APP.PLAYING || h.mode !== HOOK_MODE.RETURNING_LOADED || g.dynamite <= 0) return false;
  const { cx, cy } = hookGeometry(h);
  g.effects.push({ kind: 'explosion', x: cx, y: cy, t: 0 });
  g.dynamite -= 1;
  g.dynamiteUsed += 1;
  h.cargo = null;
  h.mode = HOOK_MODE.RETURNING_EMPTY;
  setReaction(g, 'hurt');
  g.events.push({ type: 'dynamite', left: g.dynamite });
  return true;
}

// Hook mount (end of the rope) and cargo point.
export function hookGeometry(hook) {
  const d = hookDir(hook.angle);
  const w = LAYOUT.winch;
  const ax = w.x + d.x * hook.length;
  const ay = w.y + d.y * hook.length;
  return { ax, ay, cx: ax + d.x * HOOK.cargoOffset, cy: ay + d.y * HOOK.cargoOffset, dir: d };
}

function cargoInMine(cx, cy) {
  const m = LAYOUT.mine;
  return cx >= m.x0 && cx <= m.x1 && cy <= m.y1;
}

// First t∈[0,1] where segment P0→P1 enters the circle; null if never.
export function segmentCircleEntry(x0, y0, x1, y1, cx, cy, r) {
  const dx = x1 - x0, dy = y1 - y0;
  const fx = x0 - cx, fy = y0 - cy;
  const c = fx * fx + fy * fy - r * r;
  if (c <= 0) return 0;                   // already inside
  const a = dx * dx + dy * dy;
  if (a === 0) return null;
  const b = 2 * (fx * dx + fy * dy);
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

function setReaction(g, name) {
  const cur = g.reaction;
  if (cur && ANIM_PRIORITY[cur.name] > ANIM_PRIORITY[name]) return;
  g.reaction = { name, t: 0, total: g.reactionMs[name] };
}

// Current frog animation by priority hurt > success/fail > pull > idle.
export function currentAnim(g) {
  if (g.reaction) return { name: g.reaction.name, t: g.reaction.t, loop: false };
  if (g.hook.mode === HOOK_MODE.RETURNING_LOADED) return { name: 'pull', t: g.animClock, loop: true };
  return { name: 'idle', t: g.animClock, loop: true };
}

function deliver(g) {
  const h = g.hook;
  const cargo = h.cargo;
  h.length = HOOK.restLength;
  h.mode = HOOK_MODE.READY;
  h.cargo = null;
  if (cargo) {
    g.score += cargo.points;               // scored once, on delivery
    g.catches.push({ id: cargo.id, t: Math.round((g.duration - g.timeLeft) * 1000) / 1000 });
    setReaction(g, 'success');
    const { cx, cy } = hookGeometry(h);
    g.popups.push({ text: `+${cargo.points}`, x: cx, y: cy - 24, t: 0 });
    if (cargo.type !== 'rock') g.effects.push({ kind: 'sparkle', x: cx, y: cy - 6, t: 0 });
    g.events.push({ type: 'score', points: cargo.points, objectType: cargo.type, total: g.score });
  } else {
    setReaction(g, 'fail');
    g.events.push({ type: 'empty' });
  }
}

function stepHook(g, dt) {
  const h = g.hook;
  switch (h.mode) {
    case HOOK_MODE.READY: {
      h.phase = (h.phase + dt) % HOOK.swingPeriod;
      h.angle = HOOK.maxAngleDeg * Math.sin((2 * Math.PI * h.phase) / HOOK.swingPeriod);
      break;
    }
    case HOOK_MODE.EXTENDING: {
      const prevLen = h.length;
      const before = hookGeometry(h);
      h.length = Math.min(HOOK.maxLength, h.length + g.speeds.extend * dt);
      const after = hookGeometry(h);
      // Collision along the path of the cargo point: a fast hook cannot skip an object.
      let best = null, bestT = Infinity;
      for (const o of g.objects) {
        if (o.caught) continue;
        const t = segmentCircleEntry(before.cx, before.cy, after.cx, after.cy, o.x, o.y, o.r + HOOK.grabRadius);
        if (t !== null && t < bestT) { bestT = t; best = o; }
      }
      if (best && best.blast) {
        // A powder barrel: it blows up on the hook and destroys everything around it (no points).
        h.length = prevLen + (h.length - prevLen) * bestT;
        best.caught = true;
        const t = Math.round((g.duration - g.timeLeft) * 1000) / 1000;
        g.blasts.push({ id: best.id, t });
        for (const o of g.objects) if (!o.caught && Math.hypot(o.x - best.x, o.y - best.y) <= best.blast) o.caught = true;
        g.effects.push({ kind: 'explosion', x: best.x, y: best.y, t: 0 });
        setReaction(g, 'hurt');
        g.events.push({ type: 'barrel', id: best.id });
        h.mode = HOOK_MODE.RETURNING_EMPTY;
        break;
      }
      if (best) {
        h.length = prevLen + (h.length - prevLen) * bestT;
        best.caught = true;                 // out of the collision pool
        if (best.type === 'rock') g.effects.push({ kind: 'dust', x: best.x, y: best.y, t: 0 });
        h.cargo = best;
        h.mode = HOOK_MODE.RETURNING_LOADED;
        break;
      }
      if (h.length >= HOOK.maxLength || !cargoInMine(after.cx, after.cy)) {
        h.mode = HOOK_MODE.RETURNING_EMPTY;
      }
      break;
    }
    case HOOK_MODE.RETURNING_EMPTY:
    case HOOK_MODE.RETURNING_LOADED: {
      const speed = h.cargo ? g.speeds.loaded * h.cargo.speedMul : g.speeds.empty;
      h.length -= speed * dt;
      if (h.length <= HOOK.restLength) deliver(g);
      break;
    }
  }
}

function endRound(g) {
  g.timeLeft = Math.max(0, g.timeLeft);
  // Anything still on the rope scores nothing; the game freezes as it is.
  g.result = { won: g.score >= g.target, score: g.score, target: g.target, level: g.level,
    timeLeft: g.timeLeft, durationSec: g.duration, played: g.duration - g.timeLeft,
    // Data for a score submission: the server counts the points itself from the object list.
    run: { gameId: GAME_ID, level: g.level, catches: g.catches.slice(), blasts: g.blasts.slice(), dynamiteUsed: g.dynamiteUsed } };
  g.app = APP.RESULT;
  g.events.push({ type: 'end', ...g.result });
}

function stepOnce(g, dt) {
  g.timeLeft -= dt;
  for (const mark of [30, TIMING.lowTimeSec]) {
    if (g.timeLeft <= mark && !g.lowTimeMarks.has(mark)) {
      g.lowTimeMarks.add(mark);
      g.events.push({ type: 'time', seconds: mark });
    }
  }
  if (g.timeLeft <= 0) { g.timeLeft = 0; endRound(g); return; }

  stepHook(g, dt);
  g.animClock += dt * 1000;
  if (g.reaction) {
    g.reaction.t += dt * 1000;
    if (g.reaction.t >= g.reaction.total) g.reaction = null;
  }
  for (const p of g.popups) p.t += dt;
  g.popups = g.popups.filter((p) => p.t < TIMING.popupSec);
  for (const e of g.effects) e.t += dt;
  g.effects = g.effects.filter((e) => e.t < TIMING.effectSec[e.kind]);

  // Everything collected and the hook is home: nothing left to wait for.
  if (g.hook.mode === HOOK_MODE.READY && g.objects.every((o) => o.caught)) endRound(g);
}

// Time runs only in PLAYING. Big time jumps are capped.
export function update(g, dt) {
  if (g.app !== APP.PLAYING) return;
  let remaining = Math.min(Math.max(dt, 0), TIMING.maxFrameDt);
  while (remaining > 1e-9 && g.app === APP.PLAYING) {
    const h = Math.min(remaining, TIMING.maxSubstep);
    stepOnce(g, h);
    remaining -= h;
  }
}

export function drainEvents(g) {
  const e = g.events;
  g.events = [];
  return e;
}
