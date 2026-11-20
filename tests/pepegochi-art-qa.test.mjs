// PepeGochi art QA (scripts/pepegochi_art_qa.mjs): the checks every new picture from ChatGPT must pass before it goes
// into the game (games/pepegochi/CHATGPT_ART_BACKLOG.md), and the pictures the game already draws.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { decodePng, bbox, checkImage, checkFile, compareWith, formatFor, FORMATS } from '../scripts/pepegochi_art_qa.mjs';
import { SPRITES, SPRITE_BOUNDS, PROP_BOUNDS, ROOM_LAMP, spriteSrc, propSrc, DEPART_FRAMES, DEPART_DX, HATCH_FRAMES, CARE, careFrames, WALK, IMG, HD_IMG, ITEMS, SUITCASE, LETTER, BACKGROUND } from '../docs/games/js/pepegochi-room.mjs';

const path = src => new URL('../docs/games/' + src, import.meta.url);
const png = src => decodePng(readFileSync(path(src)));

// a tiny RGBA PNG made here, so the checks are tested on known pixels
function makePng(w, h, pixel) {
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set(pixel(x, y), y * (w * 4 + 1) + 1 + x * 4);
  const chunk = (type, data) => { const b = Buffer.alloc(12 + data.length); b.writeUInt32BE(data.length, 0); b.write(type, 4, 'latin1'); data.copy(b, 8); return b; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

test('the decoder reads the game PNGs: same boxes as the art manifest', () => {
  assert.deepEqual(bbox(png(IMG + 'pepegochi_adult_idle.png')), [27, 9, 100, 124]);
  assert.deepEqual(bbox(png(IMG + 'pepegochi_egg_idle.png')), [31, 42, 96, 124]);
  assert.deepEqual(bbox(png(IMG + 'room_clean_base.png')), [0, 0, 640, 400]);
  for (const [id, [top, foot]] of Object.entries(SPRITES)) {
    const b = bbox(png(spriteSrc(id)),77).map(v=>v/2);
    assert.deepEqual(b, SPRITE_BOUNDS[id], id);
    assert.deepEqual([b[1], b[3]], [top, foot], id + ': the top and foot line in SPRITES are logical coordinates');
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
  assert.equal(formatFor('pepegochi_adult_hungry.png'), 'FINE');
  assert.equal(formatFor('pepegochi_froglet_idle.png'), 'FINE');
  assert.equal(formatFor('pepegochi_tadpole_hungry.png'), 'FINE');
  assert.equal(formatFor('pepegochi_tadpole_idle.png'), 'A');
  assert.equal(formatFor('pepegochi_adult_idle.png'), 'A');
  assert.equal(formatFor('lava_lamp.png'), 'A');
  assert.equal(formatFor('care_froglet_feed_01.png'), 'FINE');
  assert.equal(formatFor('care_froglet_feed_04.png'), 'FINE');
  assert.equal(formatFor('care_froglet_clean_01.png'), 'FINE');
  assert.equal(formatFor('care_froglet_clean_03.png'), 'FINE');
  assert.equal(formatFor('care_froglet_play_01.png'), 'FINE');
  assert.equal(formatFor('care_froglet_play_03.png'), 'FINE');
  assert.equal(formatFor('care_froglet_rest_04.png'), 'FINE');
  assert.equal(formatFor('care_tadpole_play_01.png'), 'FINE');
  assert.equal(formatFor('care_clean_04.png'), 'FINE');
  assert.equal(formatFor('care_tadpole_rest_03.png'), 'FINE');
  assert.equal(formatFor('froglet_depart_walk_02.png'), 'FINE');
  assert.equal(formatFor('tadpole_depart_01.png'), 'FINE');
  assert.deepEqual(FORMATS.FINE, { size: 128, grid: 1, maxColours: 4096, foot: 124 });
  // A single-pixel colour is valid for fine pixel art only, not for the original coarse profile.
  const fine = decodePng(makePng(128, 128, (x, y) => (x === 41 && y === 21 ? [200, 0, 0, 255] : frog(x, y))));
  assert.equal(checkImage(fine, { format: 'FINE' }).ok, true);
  assert.equal(checkImage(fine, { format: 'A' }).ok, false);
  // a tb_ file is format B even when the command line passes format: undefined
  assert.equal(checkFile(new URL('../games/pepegochi/a2-review/candidates/tb_egg.png', import.meta.url).pathname, { format: undefined }).ok, true);
  assert.deepEqual(FORMATS.B, { size: 48, grid: 1, maxColours: 32, foot: 47 });
  assert.equal(formatFor('docs/games/img/pepegochi/hd/pepegochi_adult_idle.png'), 'HD');
  assert.equal(formatFor('docs/games/img/pepegochi/hd/crt_tv.png'), 'HD');
  assert.equal(formatFor('docs/games/img/pepegochi/taskbar/tb_adult_sit.png'), 'B');
  const hd = decodePng(makePng(256,256,(x,y)=>x>=60&&x<190&&y>=18&&y<248?[20,100,30,253]:none));
  assert.equal(checkImage(hd,{format:'HD'}).ok,true);
  assert.match(why(decodePng(makePng(256,256,()=>[20,100,30,128])),{format:'HD'}), /transparent background|alpha fringe/);
  // a replacement stands where the old picture stood
  assert.equal(compareWith([26, 8, 100, 124], [27, 9, 100, 124]).ok, true);
  assert.match(compareWith([40, 8, 114, 124], [26, 8, 100, 124]).problems.join(), /centre moved right by 14/);
  assert.match(compareWith([26, 30, 100, 124], [26, 8, 100, 124]).problems.join(), /22 px shorter/);
  assert.match(compareWith([26, 8, 100, 120], [26, 8, 100, 124]).problems.join(), /stands on y = 120/);
});

test('every approved HD frog and room prop pass QA; classic letter, suitcase and painting remain unchanged', () => {
  for (const id of Object.keys(SPRITES)) {
    const r = checkFile(path(spriteSrc(id)).pathname);
    assert.deepEqual(r.problems, [], id);
  }
  for (const f of [SUITCASE.src, LETTER.envelope, LETTER.open, ...Object.keys(ITEMS).map(propSrc)])
    assert.deepEqual(checkFile(path(f).pathname, { prop: true }).problems, [], f);
  assert.deepEqual(checkFile(path(ROOM_LAMP.src.split('?')[0]).pathname,{prop:true}).problems,[]);
  assert.equal(propSrc('p_poster'), IMG+'p_poster.png');
  for (const id of Object.keys(ITEMS)) {
    assert.deepEqual(bbox(png(propSrc(id)),77).map(v=>id==='p_poster'?v:v/2), PROP_BOUNDS[id], id);
  }
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
  for (const w of Object.values(WALK)) files.push(...[...w.turn, ...w.walk].map(f => HD_IMG + f));
  for (const f of files) {
    assert.ok(existsSync(path(f)), f);
    const r = checkFile(path(f).pathname);
    assert.deepEqual(r.problems, [], f);
    assert.equal(r.bbox[3],248,f+': logical floor is unchanged');
  }
});

test('the runtime uses the exact approved review artwork, with no accidental legacy fallback',()=>{
  const frames = new Set([...Object.keys(SPRITES).map(spriteSrc),...DEPART_FRAMES,...Object.keys(CARE).flatMap(k=>careFrames(...k.split('_')))]);
  assert.equal(frames.size,91);
  for(const src of frames) {
    assert.ok(src.startsWith(HD_IMG));
    assert.deepEqual(readFileSync(path(src)),readFileSync(new URL('../games/pepegochi/hd-review/frames/'+src.split('/').pop(),import.meta.url)),src);
  }
  for(const src of [BACKGROUND,...Object.keys(ITEMS).filter(i=>i!=='p_poster').map(propSrc)]) {
    assert.ok(src.startsWith(HD_IMG));
    assert.deepEqual(readFileSync(path(src)),readFileSync(new URL('../games/pepegochi/hd-review/room/'+src.split('/').pop(),import.meta.url)),src);
  }
});
