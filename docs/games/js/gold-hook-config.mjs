// Pepe Gold Hook — settings. A swinging-hook arcade game; game PEP are points, not real coins.
// Changing the layout, points or hook speeds also means regenerating the SQL level tables
// (node scripts/build_gold_hook_sql.mjs; tests/gold-hook.test.mjs checks it).

// A 960×720 screen with the sprites at their native size: a big mine with room for lots of loot.
export const VIEW = { width: 960, height: 720 };

// Game name in games.arcade_scores (next to 'fud' and 'snake'). Separate from Pepe Miner (miner_saves).
export const GAME_ID = 'goldhook';

export const LAYOUT = {
  hud: { x: 180, y: 12, w: 600, h: 80 },
  surface: { y0: 104, y1: 311, groundY: 300 },
  miner: { x: 380, y: 212 },            // top-left of the 80×96 frame → feet at (420, 300)
  winch: { x: 480, y: 280 },
  mine: { x0: 24, x1: 936, y0: 324, y1: 648 },
  // Where a click/tap fires the hook (not the HUD).
  playArea: { y0: 104, y1: 720 },
};

export const HOOK = {
  maxAngleDeg: 65,
  avgSwingDegPerSec: 70,     // average speed of the sine swing
  extendSpeed: 300,          // px/s
  returnEmptySpeed: 340,     // px/s
  returnLoadedSpeed: 220,    // px/s × the object multiplier
  restLength: 12,            // px, from the winch to the hook mount
  maxLength: 420,            // px
  cargoOffset: 32,           // from the mount (16,3) to the cargo point (16,35) in pm-hook-basic
  grabRadius: 6,             // radius of the hook's jaws, added to the object radius
};

// Sine period chosen so the average |dθ/dt| = 4A/T matches avgSwingDegPerSec.
HOOK.swingPeriod = (4 * HOOK.maxAngleDeg) / HOOK.avgSwingDegPerSec;

export const OBJECT_TYPES = {
  'nugget-small':  { asset: 'pm-nugget-small',  points: 50,  speedMul: 1.00, radius: 9 },
  // Bigger / heavier things come up clearly slower.
  'nugget-medium': { asset: 'pm-nugget-medium', points: 120, speedMul: 0.50, radius: 13 },
  'nugget-large':  { asset: 'pm-nugget-large',  points: 250, speedMul: 0.25, radius: 20 },
  'coin-pep':      { asset: 'pm-coin-pep',      points: 75,  speedMul: 1.00, radius: 9 },
  'rock':          { asset: 'pm-rock',          points: 10,  speedMul: 0.20, radius: 13 },
  'crate':         { asset: 'pm-crate',         points: 100, speedMul: 0.40, radius: 16 },
};

export const TIMING = {
  maxFrameDt: 0.05,    // s: cap on a time jump (e.g. coming back to the tab)
  maxSubstep: 1 / 120, // s: simulation step
  popupSec: 0.9,
  effectSec: { sparkle: 0.32, dust: 0.32, explosion: 0.42 },   // art packs P1/P2: frames × ms, once
  lowTimeSec: 10,
};

// Frog reaction priority: hurt > success/fail > pull > idle.
export const ANIM_PRIORITY = { hurt: 3, success: 2, fail: 2, pull: 1, idle: 0 };
