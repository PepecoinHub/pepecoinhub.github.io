// Picks, for every Pepe Gold Hook level, the layout seed whose loot a perfect-aim bot without
// upgrades can dig up closest to AIM. Prints the SEEDS table for docs/games/js/gold-hook-campaign.mjs.
// Slow (a few minutes); run only when the level rules change:  node scripts/pick_gold_hook_seeds.mjs
import { MAX_LEVEL, generateLayout, durationFor, weightFor } from '../docs/games/js/gold-hook-campaign.mjs';
import { botLevel } from '../tests/gold-hook-bot.mjs';

const AIM = 1100, TRIES = 30;
const seeds = [0];
for (let L = 1; L <= MAX_LEVEL; L++) {
  let best = null;
  for (let k = 0; k < TRIES; k++) {
    let objects;
    try { objects = generateLayout(L, k); } catch { continue; }
    const score = botLevel({ level: L, durationSec: durationFor(L), target: 0, weight: weightFor(L), objects }, {}).score;
    if (!best || Math.abs(score - AIM) < Math.abs(best.score - AIM)) best = { k, score };
  }
  seeds.push(best.k);
  console.error(`level ${L}: seed ${best.k}, bot ${best.score}`);
}
console.log(JSON.stringify(seeds));
