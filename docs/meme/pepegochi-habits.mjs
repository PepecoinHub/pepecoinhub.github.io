// A12 (owner spec 2026-11-21): the frog does small things on its own, now and then, on the taskbar.
// Cosmetic only. The taskbar plays these instead of an ordinary idle story, about one time in six (roughly every two minutes).
// The livelier cadence still keeps one bounded activity at a time and only uses the healthy sitting pose.
// Art: pack A12a (docs/games/img/pepegochi/taskbar/anim/tb_<name>_0N.png).

export const HABITS = {
  paint: { frames: 4, ms: 320, say: 'habitPaint' },
  knock: { frames: 4, ms: 170 },
  climb: { frames: 5, ms: 230, say: 'habitClimb' },
  bin: { frames: 3, ms: 260, repeat: 2 },
  argue: { frames: 4, ms: 260, say: 'habitDuck' },
  shades: { frames: 3, ms: 300, say: 'habitShades' },
  caught: { frames: 2, ms: 600 },
  dance: { frames: 4, ms: 200, repeat: 2, say: 'habitDance' },
  yawn_clock: { frames: 2, ms: 700, say: 'habitLate' },
  sign: { frames: 3, ms: 350, hold: 2200, say: 'habitGrass' },
};
export const HABIT_CHANCE = 1 / 6;
export const GRASS_AFTER_MS = 45 * 60000;     // "TOUCH GRASS" after 45 minutes of PondOS in one go, once a visit

// Which habit, if any, replaces the next idle move. ctx: { hour, change24h, sessionMs, grassShown, random }
export function pickHabit({ hour = 12, change24h = null, sessionMs = 0, grassShown = false, random = Math.random } = {}) {
  if (!grassShown && sessionMs >= GRASS_AFTER_MS) return 'sign';
  if (random() >= HABIT_CHANCE) return null;
  const pool = [['paint', 3], ['knock', 2], ['climb', 2], ['bin', 2], ['argue', 3], ['caught', 1]];
  const ch = Number(change24h);
  if (change24h !== null && Number.isFinite(ch) && ch >= 5) pool.push(['dance', 6]);
  if (change24h !== null && Number.isFinite(ch) && ch <= -5) pool.push(['shades', 6]);
  if (hour >= 23 || hour < 5) pool.push(['yawn_clock', 6]);
  const total = pool.reduce((s, [, w]) => s + w, 0);
  let r = random() * total;
  for (const [name, w] of pool) { r -= w; if (r < 0) return name; }
  return pool[pool.length - 1][0];
}

// The frames to show, with repeats and a held last frame spelled out as a list of [file, ms].
export function habitSequence(name) {
  const h = HABITS[name];
  if (!h) return [];
  const one = Array.from({ length: h.frames }, (_, i) => 'taskbar/anim/tb_' + name + '_0' + (i + 1) + '.png');
  const all = Array.from({ length: h.repeat || 1 }, () => one).flat().map(f => [f, h.ms]);
  if (h.hold) all[all.length - 1] = [all[all.length - 1][0], h.hold];
  return all;
}

// What the frog says with a habit (pepegochi-interactions.mjs lines; the taskbar's 45 s chat throttle still applies).
export const HABIT_LINES = {
  habitPaint: ['I painted you a masterpiece. It is a circle. A very good circle.', 'Art. Do not ask what it means. I also do not know.'],
  habitClimb: ['I almost reached the Start button. Next time.', 'The Start menu is higher than it looks.'],
  habitDuck: ['The duck started it.', 'I will not be lectured by a duck.'],
  habitShades: ['Red candles? I cannot see any. Sunglasses on.', 'Cool frogs do not look at the chart.'],
  habitDance: ['PEP is green today. I had to dance. Rules are rules.', 'Little green candle, little green dance.'],
  habitLate: ['It is late, fren. Even the modem went to sleep.', 'Look at the clock. Then look at me. Bed?'],
  habitGrass: ['TOUCH GRASS, fren. I mean it with love.', 'You have been here a while. TOUCH GRASS. I will guard the pond.'],
};
