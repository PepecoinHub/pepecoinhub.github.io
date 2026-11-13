// Round check. The same logic is in games/supabase/update_gold_hook.sql, so the server
// counts the score from the list of caught objects instead of trusting a number from the browser.
// It will not stop a perfect bot; it stops typing any score into the console.
import { HOOK, LAYOUT, OBJECT_TYPES, ROUNDS, GAME_ID } from './gold-hook-config.mjs';

export const TOLERANCE = { factor: 0.95, slackSec: 0.02 };

// Shortest possible cycle (out + back) for an object: aiming straight at its centre
// gives the earliest contact, so it is the lower bound between deliveries.
export function layoutTable(round = ROUNDS[0]) {
  return round.objects.map((o, id) => {
    const t = OBJECT_TYPES[o.type];
    const dist = Math.hypot(o.x - LAYOUT.winch.x, o.y - LAYOUT.winch.y);
    const travel = Math.max(0, dist - (t.radius + HOOK.grabRadius) - HOOK.cargoOffset - HOOK.restLength);
    const minCycle = travel / HOOK.extendSpeed + travel / (HOOK.returnLoadedSpeed * t.speedMul);
    return { id, type: o.type, points: t.points, minCycle: Math.floor(minCycle * 1000) / 1000 };
  });
}

export function validateRun(run, round = ROUNDS[0]) {
  const fail = (reason) => ({ ok: false, reason });
  if (!run || run.gameId !== GAME_ID) return fail('gameId');
  if (run.layoutVersion !== round.layoutVersion) return fail('layoutVersion');
  if (!Array.isArray(run.catches) || run.catches.length > round.objects.length) return fail('catches');
  const table = layoutTable(round);
  const seen = new Set();
  let prevT = 0, score = 0;
  for (const c of run.catches) {
    if (!c || !Number.isInteger(c.id) || !table[c.id]) return fail('id');
    if (seen.has(c.id)) return fail('duplicate');
    if (typeof c.t !== 'number' || !Number.isFinite(c.t) || c.t <= 0 || c.t > round.durationSec) return fail('time');
    if (c.t < prevT) return fail('order');
    const gap = c.t - prevT;
    if (gap < table[c.id].minCycle * TOLERANCE.factor - TOLERANCE.slackSec) return fail('too-fast');
    seen.add(c.id);
    prevT = c.t;
    score += table[c.id].points;
  }
  return { ok: true, score, won: score >= round.target, lastT: prevT };
}
