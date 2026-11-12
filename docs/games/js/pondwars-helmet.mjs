import { characterPoint } from './pondwars-animation.mjs?v=20261112pixel';

// Art v02 is a review prototype. These constants describe its transparent canvas,
// not physics. All frogs currently start with 100 HP and there is no healing.
export const INITIAL_HP = 100;
export const HELMET_DURATION = 1.5;
export const HELMET_RECT = Object.freeze([112, 20, 320, 120]);
export const HELMET_CENTER = Object.freeze({ x: 2, y: -50.75 }); // (272,80) relative to foot (256,486), scale 64/512
export const PROTOTYPE_WEAPON_HAND = Object.freeze({ x: 0, y: -32 }); // PR266; source hand is provisional

export class HelmetCosmetics {
  constructor() { this.restore({ frogs: [] }); }
  // Both new-match reset and authoritative restore reconstruct visibility, with
  // no replay of historical hits. No flags are added to gameplay snapshots.
  restore(g) {
    this.lost = new Set(g.frogs.filter(f => f.hp < INITIAL_HP).map(f => f.id));
    this.flights = [];
  }
  wearing(f) { return !this.lost.has(f.id); }
  suppressMotion() { this.flights.length = 0; }
  lose(f, previousHP, time, pose, reduced = false, art = {}) {
    if (previousHP - f.hp < 1 || this.lost.has(f.id)) return false;
    this.lost.add(f.id);
    if (!reduced) this.flights.push({ id: f.id, start: time, ...characterPoint(f, pose, art.center ?? HELMET_CENTER),
      imageKey: art.imageKey ?? 'standard-v02', rect: art.rect ?? null, width: art.width ?? 40, height: art.height ?? 15,
      face: f.face, rotation: pose.rotation, sx: pose.sx, sy: pose.sy });
    return true;
  }
  sample(time, reduced = false) {
    if (reduced) { this.suppressMotion(); return []; }
    this.flights = this.flights.filter(p => time - p.start < HELMET_DURATION);
    return this.flights.map(p => {
      const t = Math.max(0, time - p.start);
      return { ...p, x: p.x - p.face * 45 * t, y: p.y - 65 * t + 60 * t * t,
        rotation: p.rotation - p.face * 6 * t, alpha: Math.min(1, (HELMET_DURATION - t) / .4) };
    });
  }
}
