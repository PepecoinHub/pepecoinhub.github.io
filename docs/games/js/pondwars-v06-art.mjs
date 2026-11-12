// Cosmetic grip calibration on the existing weapon SVGs (all viewBox 64x64).
// Coordinates identify the handle/palm contact; no projectile origins change.
const GRIPS = Object.freeze({
  rocket: { w:32, h:32, grip:[23,43], base:Math.PI/4 },
  bow: { w:32, h:28, grip:[41,33], base:0 },
  revolver: { w:30, h:24, grip:[19,46], base:0 },
  grenade: { w:22, h:26, grip:[32,46], base:0 },
});
export function v06WeaponHold(weapon) {
  const p=GRIPS[weapon];
  return p ? { ...p, ox:-p.grip[0]*p.w/64, oy:-p.grip[1]*p.h/64 } : null;
}
export function qaTerrain(search, maps, defaults) {
  const params = new URLSearchParams(search);
  if (!['pixel-v04','pixel-v06'].includes(params.get('art'))) return defaults;
  const raw=params.get('qaSeed'), n=raw?.trim() ? Number(raw) : NaN, map=params.get('qaMap');
  return { ...defaults,
    mapSeed:Number.isInteger(n) && n>=0 && n<=0xffffffff ? n : defaults.mapSeed,
    map: Object.hasOwn(maps,map) ? map : defaults.map };
}
