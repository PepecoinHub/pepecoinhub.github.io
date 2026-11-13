// PepeGochi art QA (scripts/pepegochi_art_qa.mjs): the checks every new picture from ChatGPT must pass before it goes
// into the game (games/pepegochi/CHATGPT_ART_BACKLOG.md), and the pictures the game already draws.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { decodePng, bbox, checkImage, checkFile, compareWith, formatFor, FORMATS } from '../scripts/pepegochi_art_qa.mjs';
import { SPRITES, spriteSrc, DEPART_FRAMES, DEPART_DX, HATCH_FRAMES, CARE, careFrames, WALK, IMG, ITEMS, SUITCASE, LETTER } from '../docs/games/js/pepegochi-room.mjs';

const path = src => new URL('../docs/games/' + src, import.meta.url);
const png = src => decodePng(readFileSync(path(src)));

// the accepted master sprites (owner, 2026-11-09): kept as they are although they are not on the 2 x 2 grid
// (audit 2026-11-13). Everything else, and everything new, must pass the full check.
const LEGACY = new Set(['adult_idle', 'adult_moody', 'adult_tired', 'adult_neglected', 'adult_packing', 'egg_idle', 'tadpole_idle']);

// a tiny RGBA PNG made here, so the checks are tested on known pixels
function makePng(w, h, pixel) {
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set(pixel(x, y), y * (w * 4 + 1) + 1 + x * 4);
  const chunk = (type, data) => { const b = Buffer.alloc(12 + data.length); b.writeUInt32BE(data.length, 0); b.write(type, 4, 'latin1'); data.copy(b, 8); return b; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

test('the decoder reads the game PNGs: same boxes as the art manifest', () => {
  assert.deepEqual(bbox(png(spriteSrc('adult_idle'))), [27, 9, 100, 124]);
  assert.deepEqual(bbox(png(spriteSrc('egg_idle'))), [31, 42, 96, 124]);
  assert.deepEqual(bbox(png(IMG + 'room_clean_base.png')), [0, 0, 640, 400]);
  for (const [id, [top, foot]] of Object.entries(SPRITES)) {
    const b = bbox(png(spriteSrc(id)));
    assert.deepEqual([b[1], b[3]], [top, foot], id + ': the top and foot line in SPRITES are the picture\'s own');
  }
});

test('the checks: a good sprite passes, every kind of mistake is named', () => {
  const opaque = [10, 120, 40, 255], none = [0, 0, 0, 0];
  const frog = (x, y) => (x >= 40 && x < 88 && y >= 20 && y < 124 ? opaque : none);
  const good = decodePng(makePng(128, 128, frog));
  assert.deepEqual(checkImage(good).problems, []);
  const why = (img, o) => checkImage(img, o).problems.join(' | ');
  assert.match(why(decodePng(makePng(120, 128, frog))), /size 120 x 128, must be 128 x 128/);
  assert.match(why(decodePng(makePng(128, 128, (x, y) => (x === 50 && y === 50 ? [1, 2, 3, 128] : frog(x, y))))), /half-transparent/);
  assert.match(why(decodePng(makePng(128, 128, (x, y) => (x === 41 && y === 21 ? [200, 0, 0, 255] : frog(x, y))))), /not on the 2 x 2 pixel grid/);
  assert.match(why(decodePng(makePng(128, 128, (x, y) => (frog(x, y)[3] ? [x, y, 7, 255] : none)))), /colours, at most 64/);
  assert.match(why(decodePng(makePng(128, 128, (x, y) => (y < 120 ? frog(x, y) : none)))), /feet must end on the line y = 124/);
  assert.match(why(decodePng(makePng(128, 128, (x, y) => (x < 30 && y > 60 && y < 124 ? opaque : none)))), /touches the left/);
  assert.match(why(decodePng(makePng(128, 128, () => none))), /empty/);
  assert.equal(checkImage(decodePng(makePng(128, 128, (x, y) => (y < 100 ? frog(x, y) : none))), { prop: true }).ok, true, 'props skip the foot line');
  // format B: the taskbar companion, 48 x 48 on a 1 x 1 grid, standing on y = 47
  const tb = decodePng(makePng(48, 48, (x, y) => (x >= 15 && x < 33 && y >= 7 && y < 47 ? opaque : none)));
  assert.equal(checkImage(tb, { format: 'B' }).ok, true);
  assert.equal(formatFor('docs/games/img/pepegochi/taskbar/tb_adult_sit.png'), 'B');
  assert.equal(formatFor('pepegochi_adult_hungry.png'), 'A');
  // a tb_ file is format B even when the command line passes format: undefined
  assert.equal(checkFile(new URL('../games/pepegochi/a2-review/candidates/tb_egg.png', import.meta.url).pathname, { format: undefined }).ok, true);
  assert.deepEqual(FORMATS.B, { size: 48, grid: 1, maxColours: 32, foot: 47 });
  // a replacement stands where the old picture stood
  assert.equal(compareWith([26, 8, 100, 124], [27, 9, 100, 124]).ok, true);
  assert.match(compareWith([40, 8, 114, 124], [26, 8, 100, 124]).problems.join(), /centre moved right by 14/);
  assert.match(compareWith([26, 30, 100, 124], [26, 8, 100, 124]).problems.join(), /22 px shorter/);
  assert.match(compareWith([26, 8, 100, 120], [26, 8, 100, 124]).problems.join(), /stands on y = 120/);
});

test('every frog sprite the game draws: the full check, except the accepted masters (size and feet only)', () => {
  for (const id of Object.keys(SPRITES)) {
    const r = checkFile(path(spriteSrc(id)).pathname);
    if (LEGACY.has(id)) {
      assert.ok(!r.problems.some(p => /size|feet|half-transparent|empty/.test(p)), id + ': ' + r.problems.join(' | '));
    } else assert.deepEqual(r.problems, [], id);
  }
  for (const f of [SUITCASE.src, LETTER.envelope, ...Object.keys(ITEMS).map(i => IMG + i + '.png')])
    assert.deepEqual(checkFile(path(f).pathname, { prop: true }).problems, [], f);
});

test('moving-out frames: on the grid and the feet line; DEPART_DX is where each frame draws the body', () => {
  // the older frames (art pack v2): still in the repo, played only when a stage has no walk cycle
  const OLD = [1, 2, 3, 4, 5, 6].map(n => IMG + 'depart_0' + n + '.png');
  const left = OLD.map(f => bbox(png(f))[0]);
  assert.deepEqual(left.map(l => l - left[0]), DEPART_DX);
  for (const f of OLD) assert.deepEqual(checkFile(path(f).pathname, { allowEdge: true }).problems, [], f);
});

test('frames that a later art pack adds are real files that pass the check', () => {
  const files = [...HATCH_FRAMES, ...Object.keys(CARE).flatMap(k => careFrames(...k.split('_')))];
  for (const w of Object.values(WALK)) files.push(...[...w.turn, ...w.walk].map(f => IMG + f));
  for (const f of files) {
    assert.ok(existsSync(path(f)), f);
    // walk frames 02 and 04 bounce 2 px up on purpose: their feet line is checked separately
    const moves = /depart|walk|play_03/.test(f);   // walk bounce and the play jump leave the floor on purpose
    const r = checkFile(path(f).pathname, { allowEdge: moves || /care_/.test(f), prop: moves });
    assert.deepEqual(r.problems, [], f);
    if (/depart|walk/.test(f)) assert.ok([122, 124].includes(r.bbox[3]), f + ': on the floor or 2 px above it');
    if (/play_03/.test(f)) assert.ok(r.bbox[3] >= 118 && r.bbox[3] < 124, f + ': a small jump');
  }
});
