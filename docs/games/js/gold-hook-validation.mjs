// Run check for a whole Pepe Gold Hook campaign. The same rules are in
// games/supabase/update_gold_hook_campaign.sql, so the server counts the score itself from the levels
// played instead of trusting a number from the browser. It replays the economy (money, prices,
// upgrades, dynamite) and checks every catch against the fastest possible hook cycle.
// It will not stop a perfect bot; it stops typing any score into the console.
import { HOOK, LAYOUT, OBJECT_TYPES } from './gold-hook-config.mjs';
import { MAX_LEVEL, CAMPAIGN_VERSION, levelDef, speedsFor, SHOP, SHOP_ITEMS, newRun, priceOf } from './gold-hook-campaign.mjs';

export const TOLERANCE = { factor: 0.95, slackSec: 0.02 };

// Hook travel (px of rope) to reach each object of a level, aiming straight at its centre: the
// earliest contact, so the base of the lower bound between two deliveries.
export function levelTable(L) {
  return levelDef(L).objects.map((o, id) => {
    const t = OBJECT_TYPES[o.type];
    const dist = Math.hypot(o.x - LAYOUT.winch.x, o.y - LAYOUT.winch.y);
    const travel = Math.max(0, dist - (t.radius + HOOK.grabRadius) - HOOK.cargoOffset - HOOK.restLength);
    return { id, type: o.type, points: t.points, speedMul: t.speedMul, travel: Math.floor(travel * 1000) / 1000 };
  });
}

export function minCycle(row, weight, speeds) {
  return row.travel / speeds.extend + row.travel / (speeds.loaded * row.speedMul * weight);
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

export function validateCampaign(sub) {
  const fail = (reason, at) => ({ ok: false, reason, at });
  if (!sub || sub.gameId !== 'goldhook') return fail('gameId');
  if (sub.version !== CAMPAIGN_VERSION) return fail('version');
  if (!Array.isArray(sub.levels) || sub.levels.length < 1 || sub.levels.length > MAX_LEVEL) return fail('levels');
  const s = newRun();
  let finished = false, over = false;
  for (let i = 0; i < sub.levels.length; i++) {
    const e = sub.levels[i], L = i + 1;
    if (!e || e.level !== L) return fail('level', L);
    const def = levelDef(L);
    const duration = def.durationSec + (s.clock ? SHOP.clock.seconds : 0);
    const speeds = speedsFor(s);
    if (!isNum(e.seconds) || e.seconds <= 0 || e.seconds > duration + 0.05) return fail('seconds', L);
    if (!Number.isInteger(e.dynamite) || e.dynamite < 0 || e.dynamite > s.dynamite) return fail('dynamite', L);
    if (!Array.isArray(e.catches) || e.catches.length > def.objects.length) return fail('catches', L);
    if (!Array.isArray(e.bought) || e.bought.length > 12) return fail('bought', L);
    const table = levelTable(L);
    const seen = new Set();
    let prevT = 0, earned = 0;
    for (const c of e.catches) {
      if (!c || !Number.isInteger(c.id) || !table[c.id]) return fail('id', L);
      if (seen.has(c.id)) return fail('duplicate', L);
      if (!isNum(c.t) || c.t <= 0 || c.t > e.seconds + 0.001) return fail('time', L);
      if (c.t < prevT) return fail('order', L);
      if (c.t - prevT < minCycle(table[c.id], def.weight, speeds) * TOLERANCE.factor - TOLERANCE.slackSec) return fail('too-fast', L);
      seen.add(c.id);
      prevT = c.t;
      earned += table[c.id].points;
    }
    s.money += earned;
    s.total += earned;
    s.dynamite -= e.dynamite;
    s.clock = 0;
    const won = earned >= def.target;
    const last = i === sub.levels.length - 1;
    if (!won || L === MAX_LEVEL) {
      if (!last) return fail('after-end', L);
      if (e.bought.length) return fail('shop-after-end', L);
      over = !won; finished = won;
      break;
    }
    if (last) return fail('unfinished', L);       // a run is sent only when it is over
    for (const item of e.bought) {
      if (!SHOP_ITEMS.includes(item)) return fail('item', L);
      const price = priceOf(s, item);
      if (price === null || s.money < price) return fail('cannot-afford', L);
      s.money -= price;
      s[item] += 1;
    }
  }
  return { ok: true, score: s.total, level: sub.levels.length, finished, over };
}
