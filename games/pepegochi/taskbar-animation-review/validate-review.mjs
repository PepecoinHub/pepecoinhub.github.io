// Read actual review strips, not intermediate exports. Run from any directory.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkImage, decodePng } from '../../../scripts/pepegochi_art_qa.mjs';

const load = path => decodePng(readFileSync(new URL(path, import.meta.url)));
const ref = ['adult_sit', 'tadpole', 'froglet'].map(name =>
  load(`../../../docs/games/img/pepegochi/taskbar/tb_${name}.png`));
const rgb = (data, offset) => data[offset] * 65536 + data[offset + 1] * 256 + data[offset + 2];
const approved = new Set();
for (const image of ref) for (let p = 0; p < image.rgba.length; p += 4) {
  if (image.rgba[p + 3] === 255) approved.add(rgb(image.rgba, p));
}
const counts = { eat:4, wash:4, sleep:3, celebrate:5, search:4, read:4, tadpole_swim:4, froglet_hop:4 };
let total = 0;
for (const [name, count] of Object.entries(counts)) {
  const strip = load(`tb_${name}.png`);
  assert.equal(strip.width, count * 384, `${name}: strip width`);
  assert.equal(strip.height, 384, `${name}: strip height`);
  assert.equal(strip.colourType, 6, `${name}: expected RGBA`);
  for (let frame = 0; frame < count; frame++) {
    const native = new Uint8Array(48 * 48 * 4);
    for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
      const offset = ((y*8)*strip.width + frame*384 + x*8)*4;
      const target = (y*48+x)*4;
      native.set(strip.rgba.subarray(offset, offset+4), target);
      // Every master pixel must be an exact 8 × 8 copy, no interpolation.
      for (let dy = 0; dy < 8; dy++) for (let dx = 0; dx < 8; dx++) {
        const p = offset + (dy*strip.width+dx)*4;
        for (let c = 0; c < 4; c++) assert.equal(strip.rgba[p+c], native[target+c], `${name} ${frame+1}: nonuniform pixel block`);
      }
      if (native[target+3] === 255) assert(approved.has(rgb(native, target)), `${name} ${frame+1}: colour outside approved palettes`);
    }
    const result = checkImage({width:48, height:48, colourType:6, rgba:native}, {format:'B'});
    assert(result.ok, `${name} ${frame+1}: ${result.problems.join('; ')}`);
    if ((name === 'celebrate' || name === 'read') && frame === count-1) {
      for (let y = 7; y < 18; y++) for (let x = 13; x < 36; x++) {
        const p = (y*48+x)*4;
        const a = ref[0].rgba[p+3];
        assert.equal(native[p+3], a, `${name}: approved eye mask`);
        if (a) assert.equal(rgb(native,p),rgb(ref[0].rgba,p),`${name}: approved eye pixel`);
      }
    }
    console.log(`OK tb_${name}_${String(frame+1).padStart(2,'0')}  bbox ${result.bbox}  colours ${result.colours}`);
    total++;
  }
}
assert.equal(total,32);
console.log(`${total}/32 frames passed format B, approved palettes and exact 8×8 master pixels; 0 problems.`);
