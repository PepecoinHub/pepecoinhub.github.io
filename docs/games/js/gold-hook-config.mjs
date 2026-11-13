// Pepe Gold Hook — settings. A swinging-hook arcade game; game PEP are points, not real coins.
// The numbers are a tuning starting point. Changing the layout, points or hook speeds also means
// updating the table in games/supabase/update_gold_hook.sql (tests/gold-hook.test.mjs checks it).

export const VIEW = { width: 640, height: 480 };

// Game name in games.arcade_scores (next to 'fud' and 'snake'). Separate from Pepe Miner (miner_saves).
export const GAME_ID = 'goldhook';

export const LAYOUT = {
  titleBar: { y0: 0, y1: 23 },
  hud: { x: 20, y: 28, w: 600, h: 80 },
  surface: { y0: 112, y1: 207, groundY: 200 },
  miner: { x: 240, y: 112 },            // top-left of the 80×96 frame → feet at (280, 200)
  winch: { x: 340, y: 190 },
  mine: { x0: 16, x1: 624, y0: 216, y1: 432 },
  hintBar: { y0: 440, y1: 479 },
  // Where a click/tap fires the hook (not the HUD or the hint bar).
  playArea: { y0: 112, y1: 440 },
};

export const HOOK = {
  maxAngleDeg: 65,
  avgSwingDegPerSec: 70,     // average speed of the sine swing
  extendSpeed: 220,          // px/s
  returnEmptySpeed: 260,     // px/s
  returnLoadedSpeed: 170,    // px/s × the object multiplier
  restLength: 12,            // px, from the winch to the hook mount
  maxLength: 250,            // px
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

// Round 1: a hand-made, fixed layout. Positions are polar around the winch
// (angle from vertical, distance of the cargo point), so every object sits on its own
// ray within reach. tests/gold-hook.test.mjs checks: no overlaps, reach, every object
// can be the first hit, and the target can be reached in time.
export const ROUNDS = [
  {
    level: 1,
    // Changing the layout, points or speeds = new version (old scores are not comparable).
    layoutVersion: 2,
    durationSec: 60,
    target: 650,
    objects: [
      { type: 'nugget-small',  x: 225, y: 286 },  // θ −50°, d 150
      { type: 'nugget-small',  x: 367, y: 297 },  // θ  14°, d 110
      { type: 'nugget-small',  x: 504, y: 305 },  // θ  55°, d 200
      { type: 'nugget-medium', x: 264, y: 353 },  // θ −25°, d 180
      { type: 'nugget-medium', x: 488, y: 366 },  // θ  40°, d 230
      { type: 'nugget-large',  x: 359, y: 404 },  // θ   5°, d 215
      { type: 'coin-pep',      x: 150, y: 300 },  // θ −60°, d 220
      { type: 'coin-pep',      x: 464, y: 256 },  // θ  62°, d 140
      { type: 'rock',          x: 319, y: 308 },  // θ −10°, d 120
      { type: 'rock',          x: 420, y: 340 },  // θ  28°, d 170
      { type: 'crate',         x: 186, y: 374 },  // θ −40°, d 240
    ],
  },
];

export const TIMING = {
  maxFrameDt: 0.05,    // s: cap on a time jump (e.g. coming back to the tab)
  maxSubstep: 1 / 120, // s: simulation step
  popupSec: 0.9,
  effectSec: 0.32,    // sparkle / dust: 4 frames × 80 ms, once (art pack P1)
  lowTimeSec: 10,
};

// Frog reaction priority: hurt > success/fail > pull > idle.
export const ANIM_PRIORITY = { hurt: 3, success: 2, fail: 2, pull: 1, idle: 0 };
