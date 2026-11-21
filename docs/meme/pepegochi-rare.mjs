// PepeGochi rare events (A12, owner spec 2026-11-21). Most are only for laughs; the diary always tells about
// them (pepegochi-diary.mjs, category "rare:<id>"), so a player who missed the moment still finds out.
// Cosmetic only. Anything that ever opens a secret or a stamp (golden lemon, the TV numbers) must be decided by the
// server like the other secrets; this file only rolls the funny, harmless ones and never awards anything.
import { hash32, rng } from './pepegochi-diary.mjs';

export const DAY = 86400000;

// id, chance per day (0..1), when it may happen, what it shows (art from the A12b pack)
export const RARE = [
  { id: 'birthday', chance: 1, when: c => c.month === 1 && c.day === 30, art: 'event_cake.png' },
  { id: 'fly_rain', chance: 1, when: c => c.ath === true, art: null },
  { id: 'ufo', chance: .008, when: c => c.night, art: 'event_ufo_01.png' },
  { id: 'duck_moved', chance: .01, when: () => true, art: 'duck_outline.png' },
  { id: 'tinfoil', chance: .005, when: () => true, art: 'pepegochi_adult_tinfoil.png' },
  { id: 'spy_duck', chance: .004, when: () => true, art: 'event_spy_duck.png' },
  { id: 'sleepwalk', chance: .004, when: c => c.night, art: null },
  { id: 'phone', chance: .004, when: () => true, art: null },
  { id: 'truce', chance: .002, when: () => true, art: null },
];
// For the server later (secrets, not rolled here): the golden lemon (watered 14 days in a row) and the 3 AM TV numbers.
export const SERVER_RARE = ['golden_lemon', 'tv_signal'];

export const isNight = hour => hour >= 21 || hour < 5;

// The rare event of this owner's local calendar day, or null. Same owner + same day -> same answer.
// ctx: { owner, lifeId, dayKey: 'YYYY-MM-DD' (local), month, day, hour, ath }
export function rareOfDay(ctx) {
  if (!ctx?.owner || !ctx.lifeId || !ctx.dayKey) return null;
  const c = { ...ctx, night: isNight(ctx.hour) };
  for (const e of RARE) {
    if (!e.when(c)) continue;
    const roll = rng(hash32([ctx.owner, ctx.lifeId, ctx.dayKey, e.id].join('|')))();
    if (roll < e.chance) return e.id;
  }
  return null;
}

// Local calendar parts for a timestamp (the browser's time zone).
export function localDay(t = Date.now()) {
  const d = new Date(t);
  const month = d.getMonth() + 1, day = d.getDate();
  return { dayKey: d.getFullYear() + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0'),
    month, day, hour: d.getHours(), weekday: d.getDay() };
}

// Expected share of days with a random (non-calendar, non-market) rare event, for the spec check (~4%).
export function dailyOdds(night = true) {
  let none = 1;
  for (const e of RARE) if (e.chance < 1 && (night || e.when({ night: false }))) none *= 1 - e.chance;
  return 1 - none;
}
