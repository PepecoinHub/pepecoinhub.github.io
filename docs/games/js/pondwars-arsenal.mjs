// FROGAGEDDON expansion arsenal. Numbers for the new weapons live here.
// Classic weapons stay in pondwars-beta-engine.mjs and are not retuned by this file.
// Packs are opt-in: a normal match passes no packs and never grants this ammo.

export const PACKS = ['simple', 'pepecoin', 'advanced'];

// Shared scales. Explosion weapons read `crater` and `knock`. Melee weapons use
// an explicit shove (knockVx / knockVy) so a kick and a hammer do not feel alike.
export const SCALE = {
  crater: { none: 0, verySmall: 8, small: 16, medium: 34, mediumLarge: 46, large: 62, veryLarge: 86 },
  knock: { medium: 1, high: 1.7, veryHigh: 2.4, extreme: 3.2 },
};

// Guided flyer. Inertia (lag) is low on purpose: heading changes faster than velocity.
export const GUIDE = {
  lifetime: 4.5,
  turnRate: 2.1,
  pitchRate: 1.6,
  cruise: 250,
  lag: 2.4,
  gravity: 0.12,
  launchSpeed: 180,
};

// --- simple pack: melee kick, timed bell, proximity trap ---
const simple = {
  goldv2: {
    pack: 'simple', ready: false, expansion: true, role: 'melee', tap: true,
    name: 'Golden Foot v2', short: 'Gold Foot', key: 'G', code: 'KeyG',
    hud: 'ONE PER MATCH · DIRECT HIT · VERY HIGH KNOCKBACK · TINY SCUFF',
    fireLabel: 'KICK', cry: 'KICK!',
    damage: 58, radius: 0, crater: SCALE.crater.verySmall, range: 78,
    knock: SCALE.knock.veryHigh, knockVx: 640, knockVy: -260,
    ammo: 1, power: 1, wind: false,
  },
  bell: {
    pack: 'simple', ready: false, expansion: true, role: 'throw', bell: true,
    name: 'Bell Bomb', short: 'Bell', key: 'B', code: 'KeyB',
    hud: '3.0s FUSE · BOUNCES · MEDIUM BLAST',
    fireLabel: 'HOLD TO THROW',
    damage: 44, radius: SCALE.crater.medium, crater: SCALE.crater.medium,
    fuse: 3, ammo: Infinity, power: 520, wind: false,
  },
  frogmine: {
    pack: 'simple', ready: false, expansion: true, role: 'mine', tap: true,
    name: 'Frog Mine', short: 'Frog Mine', key: 'M', code: 'KeyM',
    hud: 'ARMS AFTER 1.0s · PROXIMITY · SMALL CRATER · MEDIUM KNOCKBACK',
    fireLabel: 'PLACE MINE',
    damage: 34, radius: 28, crater: SCALE.crater.small, knock: SCALE.knock.medium,
    arm: 1, prox: 34, ammo: 3, power: 1, wind: false,
  },
};

// --- pepecoin pack: wind rocket, short hammer, falling pep drops ---
const pepecoin = {
  moon: {
    pack: 'pepecoin', ready: false, expansion: true, role: 'rocket',
    name: 'Moon Rocket', short: 'Moon', key: 'N', code: 'KeyN',
    hud: 'WIND AFFECTED · MEDIUM-LARGE BLAST · HIGH KNOCKBACK',
    fireLabel: 'HOLD TO FIRE',
    damage: 52, radius: SCALE.crater.mediumLarge, crater: SCALE.crater.mediumLarge,
    knock: SCALE.knock.high, ammo: 2, power: 600, wind: true,
  },
  ban: {
    pack: 'pepecoin', ready: false, expansion: true, role: 'melee', tap: true,
    name: 'Ban Hammer', short: 'Ban Hammer', key: 'H', code: 'KeyH',
    hud: 'SHORT RANGE · DIRECT HIT · EXTREME KNOCKBACK · NO CRATER',
    fireLabel: 'SWING', cry: 'BANNED!',
    damage: 42, radius: 0, crater: SCALE.crater.none, range: 48,
    knock: SCALE.knock.extreme, knockVx: 700, knockVy: -70,
    ammo: 2, power: 1, wind: false,
  },
  rain: {
    pack: 'pepecoin', ready: false, expansion: true, role: 'salvo', tap: true,
    name: 'Pep Rain', short: 'Pep Rain', key: 'P', code: 'KeyP',
    hud: 'TARGET THE MAP · 6 DROPS · ABOUT 8 EACH · UP TO 48',
    fireLabel: 'CALL PEP RAIN',
    damage: 48, pellet: 8, count: 6, spread: 14, childType: 'pep',
    radius: 0, crater: SCALE.crater.none, ammo: 1, power: 1, wind: false,
  },
};

// Falling sub-projectile. Not a selectable weapon.
const pep = {
  pack: 'pepecoin', ready: true, expansion: true, child: true, role: 'drop',
  name: 'Pep Drop', damage: 8, radius: 20, crater: 12, power: 90, wind: false,
};

// --- advanced pack: steered flyer and a warned heavy strike ---
const advanced = {
  doge: {
    pack: 'advanced', ready: false, expansion: true, role: 'guide', tap: true,
    name: 'Doge Flyer', short: 'Doge', key: 'F', code: 'KeyF',
    hud: 'STEER AFTER LAUNCH · 4.5s · ENTER OR SPACE DETONATES',
    fireLabel: 'LAUNCH FLYER',
    damage: 46, radius: SCALE.crater.medium, crater: SCALE.crater.medium,
    ammo: 1, power: GUIDE.launchSpeed, wind: false,
    lifetime: GUIDE.lifetime, turnRate: GUIDE.turnRate, pitchRate: GUIDE.pitchRate,
    cruise: GUIDE.cruise, lag: GUIDE.lag, guideGravity: GUIDE.gravity,
  },
  donkey: {
    pack: 'advanced', ready: false, expansion: true, role: 'strike', tap: true,
    name: 'Silver Donkey', short: 'Donkey', key: 'Y', code: 'KeyY',
    hud: 'TARGET THE MAP · 1.15s WARNING · HUGE IMPACT',
    fireLabel: 'CALL THE DONKEY',
    damage: 78, radius: SCALE.crater.large, crater: SCALE.crater.veryLarge,
    knock: SCALE.knock.high, warn: 1.15, drop: 320, strikeGravity: 2.4,
    ammo: 1, power: 1, wind: false,
  },
};

export const EXPANSION = { ...simple, ...pepecoin, pep, ...advanced };

export const CLASSIC_AMMO = {
  candles: 1, cluster: 4, gold: 1, mine: 3, dynamite: 2, drill: 2, rope: 5, jetpack: 2, teleport: 2,
};

export function normalizePacks(input) {
  const on = {};
  let names = [];
  if (input === 'all' || input === true) names = PACKS;
  else if (typeof input === 'string') names = input.split(/[,\s]+/);
  else if (input && typeof input === 'object') names = PACKS.filter(name => input[name]);
  for (const name of names) if (PACKS.includes(name)) on[name] = true;
  return on;
}

export function hudWeapons(packs) {
  const on = normalizePacks(packs);
  return Object.entries(EXPANSION)
    .filter(([, w]) => !w.child && on[w.pack])
    .map(([id, w]) => ({ ...w, id }));
}

// Finite ammo is stored on the team bag. Unlimited weapons stay off the bag, same as the bazooka.
export function starterAmmo(packs) {
  const ammo = { ...CLASSIC_AMMO };
  for (const w of hudWeapons(packs)) if (Number.isFinite(w.ammo)) ammo[w.id] = w.ammo;
  return ammo;
}

export function packEnabled(packs, id) {
  const w = EXPANSION[id];
  if (!w || w.child) return false;
  return !!normalizePacks(packs)[w.pack];
}
