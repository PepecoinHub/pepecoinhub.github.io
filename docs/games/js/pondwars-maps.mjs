// FROGAGEDDON expansion maps. Classic island, twin, peaks and small stay in the engine.
// These shapes are opt-in from the beta menu. A few pixels of height follow the seed
// so "New terrain" still changes the field without moving the safe ground.

const W = 1200, H = 600;

function wobble(seed) { return ((seed >>> 0) % 17) - 8; }

function fillDown(mask, x0, x1, y0) {
  x0 = Math.max(0, x0); x1 = Math.min(W - 1, x1); y0 = Math.max(0, Math.round(y0));
  for (let x = x0; x <= x1; x++) for (let y = y0; y < H; y++) mask[y * W + x] = 1;
}

function ellipse(mask, cx, cy, rx, ry) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) mask[y * W + x] = 1;
    }
  }
}

function moon(seed) {
  const mask = new Uint8Array(W * H), w = wobble(seed);
  fillDown(mask, 70, 420, 392 + w);
  fillDown(mask, 780, 1130, 392 - w);
  for (let x = 460; x <= 740; x++) {
    const t = (x - 600) / 140;
    fillDown(mask, x, x, 468 + w + (1 - t * t) * 42);
  }
  ellipse(mask, 600, 190 + Math.round(w / 2), 100, 16);
  return mask;
}

function doom(seed) {
  const mask = new Uint8Array(W * H), w = wobble(seed);
  fillDown(mask, 100, 320, 360 + w);
  fillDown(mask, 490, 710, 408 - Math.round(w / 2));
  fillDown(mask, 880, 1100, 338 + Math.round(w / 2));
  return mask;
}

function farm(seed) {
  const mask = new Uint8Array(W * H), w = wobble(seed);
  fillDown(mask, 40, 540, 400 + w);
  fillDown(mask, 660, 1160, 400 - w);
  return mask;
}

function quarry(seed) {
  const mask = new Uint8Array(W * H), w = wobble(seed);
  fillDown(mask, 60, 340, 280 + w);
  fillDown(mask, 341, 620, 370 - Math.round(w / 2));
  fillDown(mask, 621, 900, 450 + Math.round(w / 2));
  fillDown(mask, 940, 1140, 320 - w);
  return mask;
}

function tower(seed) {
  const mask = new Uint8Array(W * H), w = wobble(seed);
  fillDown(mask, 80, 280, 400 + w);
  fillDown(mask, 520, 680, 210 - Math.round(w / 2));
  fillDown(mask, 920, 1120, 400 - w);
  return mask;
}

export const EXPANSION_MAPS = {
  moon: { name: 'Moon Base', max: 4, recommended: 3, pack: 'maps1' },
  doom: { name: 'Pond of Doom', max: 3, recommended: 2, pack: 'maps1', split: true },
  farm: { name: 'Doge Farm', max: 4, recommended: 3, pack: 'maps1', split: true },
  quarry: { name: 'Lite Quarry', max: 4, recommended: 3, pack: 'maps2' },
  tower: { name: 'Bell Tower', max: 3, recommended: 2, pack: 'maps2' },
};

const BUILDERS = { moon, doom, farm, quarry, tower };

export function buildExpansionMap(map, seed) {
  const build = BUILDERS[map];
  return build ? build(seed >>> 0) : null;
}
