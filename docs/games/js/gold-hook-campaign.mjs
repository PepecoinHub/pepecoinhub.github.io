// Pepe Gold Hook campaign: 20 levels, the money you earn, and the shop between levels.
// Pure logic (no DOM). Every level layout is a fixed function of its number, so the server
// (games/supabase/update_gold_hook_campaign.sql) can check a whole run against the same tables.
import { HOOK, LAYOUT, OBJECT_TYPES, ROUNDS } from './gold-hook-config.mjs';

export const MAX_LEVEL = 20;
export const CAMPAIGN_VERSION = 4;

// Less time every level (down to 40 s), heavier loot (down to 70 % speed) and more rocks.
export const durationFor = (L) => Math.max(40, 60 - 2 * (L - 1));
export const weightFor = (L) => Math.max(0.7, Math.round((1 - 0.0175 * (L - 1)) * 1000) / 1000);

// Goals, tuned with a perfect-aim bot that shops for every level with the money an average player
// would have (65 % of the bot's): every goal is at most 80 % of what that bot digs up, and goals never
// go down. Late levels keep the goal and get harder by time, weight and rocks. Index = level.
export const TARGETS = [0,
  650, 680, 710, 760, 800, 850, 900, 950, 980, 980,
  980, 980, 980, 980, 980, 980, 980, 980, 980, 1000];

const COUNTS = (L) => ({
  'nugget-large': 1 + Math.floor((L - 1) / 3),
  'nugget-medium': 2 + Math.floor((L - 1) / 5),
  'nugget-small': 3,
  'coin-pep': 2 + Math.floor(L / 10),
  crate: 1 + Math.floor(L / 12),
  rock: 2 + Math.floor((L - 1) / 2),
});

// Where each kind may lie: distance of the cargo point from the winch, per level progress t∈[0,1].
// Gold sinks deeper as the levels go on; rocks stay shallow, in the way.
const DEPTH = {
  'nugget-large': (t) => [170 + 50 * t, 275],
  'nugget-medium': (t) => [130 + 40 * t, 265],
  'nugget-small': () => [95, 250],
  'coin-pep': () => [95, 265],
  crate: () => [130, 260],
  rock: () => [90, 235],
};

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HALF = { 'nugget-small': 12, 'nugget-medium': 16, 'nugget-large': 24, 'coin-pep': 12, rock: 16, crate: 20 };

function generateLayout(L) {
  const rand = mulberry32(0x60D1 + L * 7919);
  const t = (L - 2) / (MAX_LEVEL - 2);
  const m = LAYOUT.mine, W = LAYOUT.winch;
  const restCargoY = W.y + HOOK.restLength + HOOK.cargoOffset;
  const placed = [];
  const order = ['nugget-large', 'nugget-medium', 'crate', 'coin-pep', 'nugget-small', 'rock'];
  for (const type of order) {
    const n = COUNTS(L)[type];
    for (let k = 0; k < n; k++) {
      const r = OBJECT_TYPES[type].radius, h = HALF[type];
      const [dMin, dMax] = DEPTH[type](t);
      let ok = false;
      for (let tries = 0; tries < 2000 && !ok; tries++) {
        const a = (rand() * 2 - 1) * 62 * Math.PI / 180;
        const d = dMin + rand() * (dMax - dMin);
        const x = Math.round(W.x + Math.sin(a) * d), y = Math.round(W.y + Math.cos(a) * d);
        if (x - h < m.x0 || x + h > m.x1 || y - h < m.y0 || y + h > m.y1) continue;
        if (y - r <= restCargoY + HOOK.grabRadius + 4) continue;
        if (Math.hypot(x - W.x, y - W.y) - HOOK.cargoOffset > HOOK.maxLength) continue;
        if (placed.some((p) => Math.hypot(p.x - x, p.y - y) <= OBJECT_TYPES[p.type].radius + r + 4)) continue;
        placed.push({ type, x, y });
        ok = true;
      }
      if (!ok) throw new Error(`level ${L}: no room for ${type}`);
    }
  }
  return placed;
}

const layoutCache = new Map();
export function levelDef(L) {
  if (!Number.isInteger(L) || L < 1 || L > MAX_LEVEL) throw new Error(`no level ${L}`);
  if (!layoutCache.has(L)) layoutCache.set(L, L === 1 ? ROUNDS[0].objects.map((o) => ({ ...o })) : generateLayout(L));
  return { level: L, durationSec: durationFor(L), target: TARGETS[L], weight: weightFor(L), objects: layoutCache.get(L) };
}

// ---------- shop ----------
// Everything bought in the shop works for the NEXT LEVEL ONLY: nothing carries over, unused dynamite
// is lost. Prices grow 5 % per level, so late in the game you cannot afford everything at once.
// strength: loot comes up 50 % faster; reel: the hook flies out and comes back empty 30 % faster;
// dynamite: blow up whatever is on the hook (up to 3 sticks); clock: +10 s.
export const SHOP = {
  strength: { max: 1, base: 200, boost: 0.5 },
  reel: { max: 1, base: 160, boost: 0.3 },
  dynamite: { max: 3, base: 60 },
  clock: { max: 1, base: 160, seconds: 10 },
};
export const SHOP_ITEMS = ['strength', 'reel', 'dynamite', 'clock'];

// Price of an item for level L: base × (1 + 0.05 × (L − 1)). Bases are multiples of 20, so this is
// always a whole number (the SQL uses the same integer formula).
export const priceFor = (item, L) => (SHOP[item].base * (19 + L)) / 20;

// Hook speeds for the upgrades bought for this level.
export function speedsFor({ strength = 0, reel = 0 } = {}) {
  const r = 1 + SHOP.reel.boost * reel;
  return {
    extend: HOOK.extendSpeed * r,
    empty: HOOK.returnEmptySpeed * r,
    loaded: HOOK.returnLoadedSpeed * (1 + SHOP.strength.boost * strength),
  };
}

// run.strength / reel / dynamite / clock = what is bought for the next level (cleared after it).
export function newRun() {
  return { version: CAMPAIGN_VERSION, level: 1, money: 0, total: 0, strength: 0, reel: 0, dynamite: 0, clock: 0,
    over: false, finished: false, log: [] };
}

// What the next level is played with.
export function modsFor(run) {
  return { strength: run.strength, reel: run.reel, dynamite: run.dynamite, extraSec: run.clock ? SHOP.clock.seconds : 0 };
}

// Price of the next unit of an item for the coming level, or null when the limit is reached.
export function priceOf(run, item) {
  return run[item] < SHOP[item].max ? priceFor(item, run.level) : null;
}

export function canBuy(run, item) {
  const p = priceOf(run, item);
  return !run.over && !run.finished && p !== null && run.money >= p;
}

export function buy(run, item) {
  if (!canBuy(run, item)) return false;
  run.money -= priceOf(run, item);
  run[item] += 1;
  run.log[run.log.length - 1].bought.push(item);
  return true;
}

// Record a finished level (the result of the game logic) and move the run on.
export function finishLevel(run, result) {
  const entry = { level: run.level, catches: result.run.catches.map((c) => ({ id: c.id, t: c.t })),
    seconds: Math.round(result.played * 1000) / 1000, dynamite: result.run.dynamiteUsed, bought: [] };
  run.log.push(entry);
  run.money += result.score;
  run.total += result.score;
  // the upgrades were for this level only; unused dynamite is lost
  run.strength = 0; run.reel = 0; run.dynamite = 0; run.clock = 0;
  if (!result.won) run.over = true;
  else if (run.level >= MAX_LEVEL) run.finished = true;
  else run.level += 1;
  return entry;
}

// What goes to the server: the levels played, never a point total or money.
export function submission(run) {
  return { gameId: 'goldhook', version: run.version, levels: run.log.map((e) => ({ ...e, catches: e.catches.slice(), bought: e.bought.slice() })) };
}
