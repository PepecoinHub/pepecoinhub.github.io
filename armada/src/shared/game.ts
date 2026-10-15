// Pure game rules shared by the server (authoritative) and the client (display only).
// No Devvit imports here, so the file can be unit-tested with plain Node.

export type Ship = { len: number; cells: number[] };

export type GameConfig = {
  size: number; // board is size x size
  ships: number[]; // ship lengths
  regenSec: number; // seconds to earn one shot back
  maxCharges: number; // shots a player can bank
};

export type Charge = { c: number; t: number }; // c shots banked as of time t (ms)

export const MAX_CHARGES = 3;

// The board grows with the community so a small sub still finishes the game
// in a day and a huge sub cannot clear it in two minutes.
const TIERS: { upTo: number; size: number; ships: number[]; regenSec: number }[] = [
  { upTo: 2_000, size: 8, ships: [4, 3, 3, 2], regenSec: 60 },
  { upTo: 50_000, size: 10, ships: [5, 4, 3, 3, 2], regenSec: 120 },
  { upTo: 500_000, size: 12, ships: [5, 4, 4, 3, 3, 2, 2], regenSec: 180 },
  { upTo: Infinity, size: 16, ships: [6, 5, 5, 4, 4, 3, 3, 2, 2], regenSec: 300 },
];

export const BOARD_SIZES = [8, 10, 12, 16] as const;

export function configFor(subscribers: number, sizeOverride?: number): GameConfig {
  const tier = TIERS.find((t) => subscribers < t.upTo) ?? TIERS[TIERS.length - 1]!;
  const forced = sizeOverride ? TIERS.find((t) => t.size === sizeOverride) : undefined;
  const t = forced ?? tier;
  return { size: t.size, ships: [...t.ships], regenSec: t.regenSec, maxCharges: MAX_CHARGES };
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function placeFleet(cfg: GameConfig, seed: number): Ship[] {
  const rand = mulberry32(seed);
  const { size } = cfg;
  const taken = new Set<number>();
  const ships: Ship[] = [];
  // Longest ships first: they are the hardest to fit.
  for (const len of [...cfg.ships].sort((a, b) => b - a)) {
    let placed = false;
    for (let attempt = 0; attempt < 500 && !placed; attempt++) {
      const horizontal = rand() < 0.5;
      const x = Math.floor(rand() * (horizontal ? size - len + 1 : size));
      const y = Math.floor(rand() * (horizontal ? size : size - len + 1));
      const cells: number[] = [];
      for (let i = 0; i < len; i++) cells.push((y + (horizontal ? 0 : i)) * size + x + (horizontal ? i : 0));
      if (cells.some((c) => taken.has(c))) continue;
      cells.forEach((c) => taken.add(c));
      ships.push({ len, cells });
      placed = true;
    }
    if (!placed) throw new Error('could not place fleet');
  }
  return ships;
}

export function cellLabel(cell: number, size: number): string {
  const x = cell % size;
  const y = Math.floor(cell / size);
  return String.fromCharCode(65 + x) + String(y + 1);
}

/** Banked shots at `now`, and when the next one arrives (null when full). */
export function regen(state: Charge | undefined, now: number, cfg: GameConfig): { c: number; t: number; nextAt: number | null } {
  const regenMs = cfg.regenSec * 1000;
  if (!state) return { c: cfg.maxCharges, t: now, nextAt: null };
  const gained = Math.max(0, Math.floor((now - state.t) / regenMs));
  const c = Math.min(cfg.maxCharges, state.c + gained);
  if (c >= cfg.maxCharges) return { c, t: now, nextAt: null };
  const t = state.t + gained * regenMs;
  return { c, t, nextAt: t + regenMs };
}

export const POINTS = { hit: 1, sink: 2, finish: 3 } as const;
