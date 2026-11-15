// A perfect-aim Pepe Gold Hook bot, shared by tests/gold-hook.test.mjs and scripts/pick_gold_hook_seeds.mjs.
// It waits for the swing like a player, aims only at objects the hook reaches first, prefers the most
// points per second, and blows up rocks when it has dynamite. Real players dig up less.
import { HOOK, LAYOUT } from '../docs/games/js/gold-hook-config.mjs';
import { APP, HOOK_MODE, createGame, startRound, update, fire, useDynamite, hookDir, segmentCircleEntry } from '../docs/games/js/gold-hook-state.mjs';

const W = LAYOUT.winch;
export const angleTo = (o) => Math.atan2(o.x - W.x, o.y - W.y) * 180 / Math.PI;

export function firstHit(g, ang) {
  const d = hookDir(ang), s = HOOK.restLength + HOOK.cargoOffset;
  let best = null, bestT = Infinity;
  for (const o of g.objects) {
    if (o.caught) continue;
    const t = segmentCircleEntry(W.x + d.x * s, W.y + d.y * s, W.x + d.x * 600, W.y + d.y * 600, o.x, o.y, o.r + HOOK.grabRadius);
    if (t !== null && t < bestT) { bestT = t; best = o; }
  }
  return best;
}

export function botLevel(def, mods, dt = 1 / 60) {
  const g = createGame({ level: def, mods }); startRound(g);
  let target = null;
  for (let i = 0; i < Math.round(80 / dt) && g.app === APP.PLAYING; i++) {
    const prev = g.hook.angle;
    update(g, dt);
    if (g.hook.mode === HOOK_MODE.RETURNING_LOADED && g.hook.cargo.type === 'rock' && g.dynamite > 0) useDynamite(g);
    if (g.hook.mode !== HOOK_MODE.READY) { target = null; continue; }
    if (!target || target.caught) {
      let bestRate = -1; target = null;
      for (const o of g.objects) {
        if (o.caught || firstHit(g, angleTo(o)) !== o) continue;
        const dist = Math.hypot(o.x - W.x, o.y - W.y);
        const rate = o.points / (dist / g.speeds.extend + dist / (g.speeds.loaded * o.speedMul) + 1.2);
        if (rate > bestRate) { bestRate = rate; target = o; }
      }
      if (!target) break;
    }
    const a = angleTo(target);
    if (i > 0 && (prev - a) * (g.hook.angle - a) <= 0) fire(g);
  }
  while (g.app === APP.PLAYING) update(g, dt);
  return g.result;
}
