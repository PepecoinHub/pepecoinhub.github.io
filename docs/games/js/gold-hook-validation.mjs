// Run check for a whole Pepe Gold Hook campaign. The same rules are in
// games/supabase/update_gold_hook_campaign.sql, so the server counts the score itself from the levels
// played instead of trusting a number from the browser. It replays the economy (the wallet gets only
// the surplus over each goal; prices; the one-level upgrades; dynamite) and checks every catch against the fastest possible hook cycle.
// It will not stop a perfect bot; it stops typing any score into the console.
import { HOOK, LAYOUT, OBJECT_TYPES } from './gold-hook-config.mjs';
import { MAX_LEVEL, CAMPAIGN_VERSION, levelDef, speedsFor, SHOP, SHOP_ITEMS, newRun, priceOf } from './gold-hook-campaign.mjs';

export const TOLERANCE = { factor: 0.95, slackSec: 0.02 };

// Hook travel (px of rope) to reach each object of a level, aiming straight at its centre: the
// earliest contact, so the base of the lower bound between two deliveries.
// Also the object's position, its points (a mystery bag's come from the layout) and, for a powder
// barrel, its blast radius.
export function tableFor(def) {
  return def.objects.map((o, id) => {
    const t = OBJECT_TYPES[o.type];
    const dist = Math.hypot(o.x - LAYOUT.winch.x, o.y - LAYOUT.winch.y);
    const travel = Math.max(0, dist - (t.radius + HOOK.grabRadius) - HOOK.cargoOffset - HOOK.restLength);
    return { id, type: o.type, points: o.points ?? t.points, speedMul: t.speedMul, travel: Math.floor(travel * 1000) / 1000,
      x: o.x, y: o.y, blast: t.blast || 0 };
  });
}
export const levelTable = (L) => tableFor(levelDef(L));

export function minCycle(row, weight, speeds) {
  return row.travel / speeds.extend + row.travel / (speeds.loaded * row.speedMul * weight);
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// One level of a run: catches and powder-barrel blasts against the layout. When a barrel blows up the
// hook is empty (it is on its way to the barrel), so nothing in the blast can be delivered after it.
export function checkLevel(def, table, e, speeds) {
  const fail = (reason) => ({ ok: false, reason });
  const blasts = e.blasts === undefined ? [] : e.blasts;
  if (!Array.isArray(blasts) || blasts.length > 10) return fail('blasts');
  const blastAt = [];                         // { x, y, r, t } of each barrel that went off
  const used = new Set();
  for (const b of [...blasts].sort((a, c) => a.t - c.t)) {
    const row = b && Number.isInteger(b.id) ? table[b.id] : null;
    if (!row || !row.blast || used.has(b.id)) return fail('blast-id');
    if (!isNum(b.t) || b.t <= 0 || b.t > e.seconds + 0.001) return fail('blast-time');
    if (blastAt.some((k) => k.t < b.t && Math.hypot(row.x - k.x, row.y - k.y) <= k.r)) return fail('blast-gone');
    used.add(b.id);
    blastAt.push({ x: row.x, y: row.y, r: row.blast, t: b.t });
  }
  const seen = new Set();
  let prevT = 0, earned = 0;
  for (const c of e.catches) {
    if (!c || !Number.isInteger(c.id) || !table[c.id]) return fail('id');
    const row = table[c.id];
    if (row.blast) return fail('barrel');
    if (seen.has(c.id)) return fail('duplicate');
    if (!isNum(c.t) || c.t <= 0 || c.t > e.seconds + 0.001) return fail('time');
    if (c.t < prevT) return fail('order');
    if (c.t - prevT < minCycle(row, def.weight, speeds) * TOLERANCE.factor - TOLERANCE.slackSec) return fail('too-fast');
    if (blastAt.some((k) => c.t > k.t && Math.hypot(row.x - k.x, row.y - k.y) <= k.r)) return fail('blown-up');
    seen.add(c.id);
    prevT = c.t;
    earned += row.points;
  }
  return { ok: true, earned };
}

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
    const lv = checkLevel(def, levelTable(L), e, speeds);
    if (!lv.ok) return fail(lv.reason, L);
    const earned = lv.earned;
    s.total += earned;
    // what was bought for this level is used up; the shop below buys for the next one
    s.strength = 0; s.reel = 0; s.dynamite = 0; s.clock = 0;
    const won = earned >= def.target;
    if (won) s.money += earned - def.target;     // only the surplus over the goal can be spent
    const last = i === sub.levels.length - 1;
    if (!won || L === MAX_LEVEL) {
      if (!last) return fail('after-end', L);
      if (e.bought.length) return fail('shop-after-end', L);
      over = !won; finished = won;
      break;
    }
    if (last) return fail('unfinished', L);       // a run is sent only when it is over
    s.level = L + 1;
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
