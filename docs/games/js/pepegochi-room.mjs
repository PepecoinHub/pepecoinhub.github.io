// PepeGochi room scene for the PEPEGOCHI.EXE window.
// Room A11: richer pond den background; existing independent items and anchors retained.
// Original art:
//   - the layered room v5 from the design PR #222: one clean 640x400 background and one 128x128 RGBA
//     sprite per item;
//   - the frog, its states, the 6 moving-out frames, the suitcase and the letter from the pixel art
//     pack v2 in PR #227 (copied unchanged into docs/games/img/pepegochi/).
// Slot and item IDs are the same as in games/supabase/update_pepegochi_room_v1.sql
// (tests/pepegochi-room-window.test.mjs checks this), so the window can later draw the room the server
// returns without renaming anything.
// This file only draws. It owns nothing, saves nothing and talks to no server.

export const ROOM_W = 640;
export const ROOM_H = 400;
export const IMG = 'img/pepegochi/';
// The approved 1999 room artwork is separate from legacy and taskbar assets.
export const HD_IMG = IMG + 'hd/';
export const SPRITE_VERSION = '20261120dialog2';
export const versionSprite = src => src.startsWith(IMG) ? src + '?v=' + SPRITE_VERSION : src;
export const BACKGROUND = HD_IMG + 'room_pond_den_v1.png';
// A fixed architectural decoration, like the house sign, not a Passport reward or inventory item.
// The shade and base sit to the left of the existing lava lamp on the dresser.
export const ROOM_LAMP = { src: versionSprite(HD_IMG + 'pepe_table_lamp.png'), left: 47 / ROOM_W * 100, top: 227 / ROOM_H * 100, width: 80 / ROOM_W * 100, bounds: [75,12,180,236].map(n=>n/2) };
// Chrom's little ride: fixed decor, sized slightly smaller than the duck, on the free foreground floor.
export const ROOM_HORSE = { src: versionSprite(HD_IMG + 'chrome_rocking_horse.png'), left: 590 / ROOM_W * 100, top: 386 / ROOM_H * 100, width: 72 / ROOM_W * 100, bounds: [48,52,208,236].map(n=>n/2) };
// bumped when a room prop is redrawn under the same file name (A10: mug, duck, painting, 2026-11-15)
export const PROP_V = SPRITE_VERSION;
export const propSrc = id => (id === 'p_poster' ? IMG : HD_IMG) + id + '.png';

// Visible bounds in logical room pixels, measured at 30% alpha. The HD images are 2x logical size.
const logical = box => box.map(n => n / 2);
export const PROP_BOUNDS = { p_poster: [18,14,112,114], ...Object.fromEntries(Object.entries({
  crt_tv:[26,32,235,236], lava_lamp:[68,32,201,228], potted_plant:[41,32,220,228], rubber_duck:[68,36,185,220],
  mug:[52,64,244,220], moon_rock:[42,72,214,248], paper_crown:[36,52,221,248], golden_fly:[49,72,212,248], floppy_disk:[48,58,204,248],
}).map(([id,box])=>[id,logical(box)])) };

// slot_id -> anchor on the 640x400 background (same numbers as the room SQL)
export const SLOTS = {
  wall_left: { x: 169, y: 96, z: 30, wall: true },
  wall_right: { x: 414, y: 112, z: 30, wall: true },
  shelf_a: { x: 252, y: 140, z: 40 },
  shelf_b: { x: 318, y: 140, z: 40 },
  dresser_top: { x: 90, y: 215, z: 50 },
  tv_stand: { x: 546, y: 240, z: 50 },
  table_top: { x: 453, y: 258, z: 50 },
  floor_left: { x: 170, y: 345, z: 50 },
  floor_right: { x: 559, y: 331, z: 50 },
  rug_left: { x: 246, y: 341, z: 70 },
  rug_right: { x: 398, y: 341, z: 70 },
};

// item_id -> how big it looks (percent of the room width) and dy onto its furniture (from #222)
export const ITEMS = {
  p_poster: { size: 15, dy: 0 },
  crt_tv: { size: 20, dy: 28 },
  lava_lamp: { size: 15, dy: 16 },
  potted_plant: { size: 19, dy: 4 },
  rubber_duck: { size: 14, dy: 0 },
  mug: { size: 13, dy: 20 },
  // earned decorations (update_pepegochi_rewards.sql; sprite pack 2026-11-09)
  moon_rock: { size: 11, dy: 6 },
  paper_crown: { size: 11, dy: 6 },
  golden_fly: { size: 11, dy: 6 },
  floppy_disk: { size: 11, dy: 6 },
};

// the six starter props and where they stand (starter_slot_id in the room SQL)
export const STARTER_ROOM = {
  wall_left: 'p_poster', tv_stand: 'crt_tv', dresser_top: 'lava_lamp',
  floor_left: 'potted_plant', rug_left: 'rubber_duck', table_top: 'mug',
};

// Every item always stands in the same place (owner, 2026-11-15): no moving things around. The four decorations
// earned with Passport stamps have their own places, empty until they are found; floor_right stays free.
export const HOME_SLOT = {
  ...Object.fromEntries(Object.entries(STARTER_ROOM).map(([slot, item]) => [item, slot])),
  moon_rock: 'shelf_a', paper_crown: 'shelf_b', golden_fly: 'wall_right', floppy_disk: 'rug_right',
};
export const DECORATIONS = ['moon_rock', 'paper_crown', 'golden_fly', 'floppy_disk'];
// slot -> item for the items an account owns, each in its own place
export function fixedPlacements(owned) {
  const out = {};
  for (const item of owned) if (HOME_SLOT[item] && ITEMS[item]) out[HOME_SLOT[item]] = item;
  return out;
}

// ---------- the frog ----------
// Every HD frog sprite is 256x256, drawn on the original 128x128 logical canvas.
// All stages keep the same scale and floor anchor; taskbar art is independent.
export const FROG_PX = 128;
export const FOOT_Y = 124;         // the art pack's foot line
// where the frog stands: on the rug, in front of the bed (room pixels, its feet)
export const HOME = { x: 320, y: 372 };
// sprite -> [top, bottom] of its visible pixels (the bounding boxes in the art manifest). The top puts the
// bubble above the head. The bottom is where it touches the floor: 124 for every sprite since the
// sprite pack of 2026-11-09 (#227). Only moved, never resized.
// This is also the list of frog sprites the game HAS. A state sprite that is not listed here is not drawn yet
// (games/pepegochi/CHATGPT_ART_BACKLOG.md): the frog falls back to its stage's idle sprite (frogLook). A new
// art pack goes in by adding its rows here, after scripts/pepegochi_art_qa.mjs passes; nothing else changes.
export const SPRITE_BOUNDS = Object.fromEntries(Object.entries({
  egg_idle:[62,84,188,248], tadpole_idle:[13,100,242,248], froglet_idle:[72,60,202,248],
  adult_idle:[47,18,207,248], adult_hungry:[49,17,225,248], adult_dirty:[24,17,208,248], adult_moody:[49,17,207,248], adult_tired:[47,17,220,248],
  adult_neglected:[39,17,209,248], adult_recovering:[49,17,207,248], adult_packing:[22,13,211,248],
  hatch_01:[62,84,188,248], hatch_02:[64,84,185,248], hatch_03:[55,40,218,248], hatch_04:[2,100,244,248],
  tadpole_hungry:[15,96,243,248], tadpole_dirty:[7,99,249,248], tadpole_moody:[17,99,239,248], tadpole_tired:[17,97,240,248],
  tadpole_neglected:[16,100,237,248], tadpole_packing:[17,97,251,248], tadpole_recovering:[18,100,239,248],
  froglet_hungry:[70,58,217,248], froglet_dirty:[70,59,215,248], froglet_moody:[70,59,202,248], froglet_tired:[69,58,218,248],
  froglet_neglected:[71,61,200,248], froglet_packing:[69,56,218,248], froglet_recovering:[71,61,200,248],
}).map(([id,box])=>[id,logical(box)]));
export const SPRITES = Object.fromEntries(Object.entries(SPRITE_BOUNDS).map(([id,[,top,,foot]])=>[id,[top,foot]]));
// the moving-out frames (sprite pack 2026-11-09) stand on the same floor line as the frog
export const DEPART_FOOT = [124, 124, 124, 124, 124, 124];
export const spriteSrc = id => HD_IMG + 'pepegochi_' + id + '.png';
export const FROG = spriteSrc('adult_idle');

// A healthy adult shows the need it wants most once that need is below LOOK_BELOW (the lowest one; a tie
// goes to the first). This is only the picture: it changes no rule. Why 75: a need starts waiting below
// 90, and 48 h later the frog counts as neglected and shows that sprite instead. Energy, the slowest need
// (10 a day), is at 70 by then, so at 70 or lower "tired" could never be seen; at 75 it shows for 12 h.
export const LOOK_BELOW = 75;
export const NEED_LOOK = { hunger: 'hungry', hygiene: 'dirty', mood: 'moody', energy: 'tired' };
const LOOK_WORD = { hungry: 'hungry', dirty: 'dirty', moody: 'in a bad mood', tired: 'tired' };

// Which sprite to draw: the status first (packing, recovering, neglected), then the need it wants most.
// Every stage asks for the same states (stage_status or stage_look). A sprite the game does not have yet
// (not in SPRITES) falls back to the stage's idle sprite with fallback: true: the window greys it while the
// frog is neglected or packing, and a packing frog gets the separate suitcase next to it. Today only the adult
// has state sprites; the egg always shows egg_idle. needs: [{ need, value }] as in the window's view.
export function frogLook({ status = 'healthy', stage = 'adult', needs = [] } = {}) {
  if (stage === 'egg') return { sprite: 'egg_idle', look: null, suitcase: false, fallback: status === 'neglected' || status === 'packing' };
  let want = null, look = null;
  if (status === 'packing' || status === 'neglected' || status === 'recovering') want = stage + '_' + status;
  else {
    const low = needs.filter(n => n.value < LOOK_BELOW).sort((a, b) => a.value - b.value)[0];
    if (low) { look = NEED_LOOK[low.need]; want = stage + '_' + look; }
  }
  if (!want) return { sprite: stage + '_idle', look: null, suitcase: false, fallback: false };
  if (SPRITES[want]) return { sprite: want, look, suitcase: false, fallback: false };
  return { sprite: stage + '_idle', look: null, suitcase: status === 'packing', fallback: true };
}

export const BUBBLE = { neglected: 'I miss you…', packing: 'Packing my things…', recovering: 'Thanks for coming back', healthy: '' };

// the separate suitcase (art pack v2 props/suitcase.png, 2x2 pixel art): half size, so its pixels match
// the room's and it is as big as the suitcase in the adult packing sprite; it stands right of the frog
export const SUITCASE = { src: IMG + 'suitcase.png', px: 64, dx: 60, foot: 58 };

// ---------- after moving out ----------
// The letter lies where the frog stood, at the spot of props/room_departed_overlay.png (its envelope
// covers x 309-354, y 331-361). Half size, like the suitcase. Unread: the envelope; read: the open letter.
export const LETTER = { x: 332, y: 346, px: 64, envelope: IMG + 'goodbye_envelope.png', open: IMG + 'goodbye_letter_v2.png' };
// The frog takes ONE item when it moves out: the server picks it from the borrowable items placed in the room and
// stores it on the life as letter_variant 'took_<item_id>' ('took_nothing' for an empty room; Room-4,
// update_pepegochi_room_departure.sql). The older 'classic' letter took the TV. The item is only hidden in the
// picture: it stays owned and placed, and it is back when a new frog moves in.
// The frog's notes for you (clues, "I trust you now"): an envelope on the side table, left of the mug,
// standing on the table top like the mug (pepegochi-notes.mjs, owner 2026-11-20).
export const NOTES = { x: 410, y: 278, px: 40, src: IMG + 'goodbye_envelope.png' };
export const TAKEN_BY_LETTER = 'crt_tv';
export const takenItem = variant => (!variant || variant === 'classic' ? TAKEN_BY_LETTER
  : variant === 'took_nothing' ? null : variant.startsWith('took_') ? variant.slice(5) : TAKEN_BY_LETTER);
export const TAKEN_NAME = { crt_tv: 'the TV', lava_lamp: 'the lava lamp', potted_plant: 'the plant', p_poster: 'the Golden Foot painting',
  rubber_duck: 'the rubber duck', mug: 'the Comfy mug' };
export const takenName = item => TAKEN_NAME[item] || 'the ' + String(item).replace(/_/g, ' ');

// The moving-out animation (art pack v2, animations/depart_01..06, 250 ms a frame, no loop).
// Frames 1-2: the frog turns with its suitcase where it stood. Frames 3 and 4 are its steps: they take
// turns while it walks to the right edge. Frames 5-6 are drawn leaving their own 128 px frame, so they
// play with that frame's right edge on the room's right edge: the frog walks out of the room.
// The art moves the frog inside its frame too: DEPART_DX is how far right each frame draws the body,
// compared with frame 1 (the left edge of its visible pixels, tests/pepegochi-art-qa.test.mjs measures it).
// The frames are placed so the body itself moves by the same step every frame, instead of jumping back and
// forth between frames 3 and 4.
export const DEPART_MS = 250;
export const DEPART_DX = [0, 12, 24, 38, 54, 66];
// In-place walk cycles from a later art pack (backlog A4/A5): stage -> { turn: [files], walk: [files] }, every
// frame with the body in the middle of its 128 px frame. A stage listed here walks with them; the code moves it.
const steps4 = pre => [1, 2, 3, 4].map(n => pre + n + '.png');
export const WALK = {
  // art pack A4 (2026-11-13): turn with the suitcase, then four steps in place
  adult: { turn: ['depart_turn_01.png', 'depart_turn_02.png'], walk: steps4('depart_walk_0') },
  // art pack A5: the young frogs walk out with their own small suitcase
  froglet: { turn: [], walk: steps4('froglet_depart_walk_0') },
  tadpole: { turn: [], walk: steps4('tadpole_depart_0') },
};
export function departTimeline(stage = 'adult', walk = WALK[stage]) {
  const edge = ROOM_W - FROG_PX / 2;           // a 128 px frame touching the right edge
  if (walk) {
    const out = walk.turn.map(src => ({ src: HD_IMG + src, x: HOME.x, foot: FOOT_Y, suitcase: false }));
    // with no turn frames the first step starts where the frog stood (no jump)
    for (let x = HOME.x + (walk.turn.length ? 24 : 0), i = 0; x < ROOM_W + FROG_PX / 2; x += 24, i++)
      out.push({ src: HD_IMG + walk.walk[i % walk.walk.length], x, foot: FOOT_Y, suitcase: false });
    return out;
  }
  if (stage !== 'adult') {
    // no moving-out frames for the young stages yet: the frog and its suitcase slide out
    const src = spriteSrc(stage + '_idle');
    const steps = [HOME.x, HOME.x];
    for (let x = HOME.x + 48; x < ROOM_W + FROG_PX; x += 48) steps.push(x);
    return steps.map(x => ({ src, x, foot: SPRITES[stage + '_idle'][1], suitcase: true }));
  }
  // frame 1's body is where the idle frog's body is (both hoodies centred at x=60 of 128), so it starts at HOME;
  // frame 6 ends with its 128 px frame on the room's right edge. The body moves evenly in between.
  const seq = [1, 2, 3, 4, 3, 4, 3, 4, 5, 6], from = HOME.x, to = edge + DEPART_DX[5];
  return seq.map((n, i) => ({ src: IMG + 'depart_0' + n + '.png', foot: DEPART_FOOT[n - 1], suitcase: false,
    x: Math.round(from + (to - from) * i / (seq.length - 1)) - DEPART_DX[n - 1] }));
}
// every moving-out frame the window may play (preloaded when a frog is home)
export const DEPART_FRAMES = Object.values(WALK).flatMap(w => [...w.turn, ...w.walk]).map(f => HD_IMG + f);

// ---------- short frame animations on the frog: hatching, and care once the art exists ----------
// The egg hatches: three cracking frames and the tadpole out of its shell (art pack A1, 2026-11-13), then the tadpole.
export const HATCH_MS = 450;
export const HATCH_FRAMES = ['hatch_01', 'hatch_02', 'hatch_03', 'hatch_04'].map(spriteSrc);
// Care animations (backlog A6/A6b): 'stage_kind' -> sprite ids, e.g. adult_feed: ['care_feed_01', ...].
export const CARE_MS = 200;
const careSet = pre => Object.fromEntries(['feed', 'clean', 'play', 'rest']
  .map(k => [k, [1, 2, 3, 4].map(n => pre + k + '_0' + n)]));
// art pack A6 (2026-11-13): 4 frames per care action for the adult, the froglet and the tadpole
export const CARE = Object.fromEntries([['adult', 'care_'], ['froglet', 'care_froglet_'], ['tadpole', 'care_tadpole_']]
  .flatMap(([stage, pre]) => Object.entries(careSet(pre)).map(([k, ids]) => [stage + '_' + k, ids])));
export const careFrames = (stage, kind) => (CARE[stage + '_' + kind] || []).map(id => HD_IMG + id + '.png');

// Only preload the current life stage's animation frames, not the whole 5 MB room pack.
export function animationFramesForStage(stage) {
  if (stage === 'egg') return HATCH_FRAMES;
  const w = WALK[stage];
  return [...(w ? [...w.turn,...w.walk].map(id=>HD_IMG+id) : []), ...['feed','clean','play','rest'].flatMap(k=>careFrames(stage,k))];
}

// Shows frames one after another on the frog's <img>, then puts its own sprite back. Returns a stop function.
export function playFrames(img, frames, ms, { setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  if (!img || !frames.length) return null;
  const final = img.getAttribute('src');
  let i = 0, timer = null;
  const next = () => {
    if (i >= frames.length) { img.setAttribute('src', final); timer = null; return; }
    img.setAttribute('src', versionSprite(frames[i++])); timer = setTimer(next, ms);
  };
  next();
  return () => { if (timer) clearTimer(timer); img.setAttribute('src', final); };
}

// ---------- A12 rare events in the room (owner spec 2026-11-21; art pack A12b; pepegochi-rare.mjs picks the day) ----
// Only for laughs and only for one day; nothing here is saved or awarded. The window glass is x 465-570, y 40-160.
export const WINDOW_GLASS = { x: 465, y: 40, w: 105, h: 120 };
export const RARE_ROOM = {
  ufo: { window: true, src: 'event_ufo_0', frames: 4, ms: 180 },
  spy_duck: { window: true, src: 'event_spy_duck.png' },
  duck_moved: { duck: true },
  tinfoil: { frog: 'adult_tinfoil' },
  birthday: { prop: 'event_cake.png', slot: 'floor_right', size: 14 },
};
export const rareSrc = f => versionSprite(HD_IMG + f);

// ---------- one description of what the scene shows, so it can be tested without a browser ----------
// mode: 'adopt' (an egg waits for a name), 'pet' or 'departed'
export function roomScene({ mode = 'pet', status = 'healthy', stage = 'adult', needs = [], placements = STARTER_ROOM, letterSeen = false, taken = TAKEN_BY_LETTER, notes = 0, rare = null, diary = -1 } = {}) {
  const departed = mode === 'departed';
  const ev = mode === 'pet' && status !== 'departed' && Object.hasOwn(RARE_ROOM, rare) ? RARE_ROOM[rare] : null;
  const items = [];
  for (const [slotId, itemId] of Object.entries(placements)) {
    const s = SLOTS[slotId], it = ITEMS[itemId];
    if (!s || !it) continue;
    if (departed && itemId === taken) continue;
    const item = { slotId, itemId, src: propSrc(itemId) + '?v=' + PROP_V, wall: !!s.wall, z: s.z,
      left: s.x / ROOM_W * 100, top: (s.y + it.dy) / ROOM_H * 100, width: it.size };
    // the duck moved in the night: a chalk outline where it stood, the duck a little to the left, pretending nothing happened
    if (ev?.duck && itemId === 'rubber_duck') {
      items.push({ ...item, itemId: 'duck_outline', src: rareSrc('duck_outline.png'), rare: true });
      item.left -= 34 / ROOM_W * 100;
    }
    items.push(item);
  }
  if (ev?.prop && SLOTS[ev.slot] && !Object.keys(placements).includes(ev.slot)) {
    const s = SLOTS[ev.slot];
    items.push({ slotId: ev.slot, itemId: 'rare_' + rare, src: rareSrc(ev.prop), wall: false, z: s.z, rare: true,
      left: s.x / ROOM_W * 100, top: s.y / ROOM_H * 100, width: ev.size });
  }
  const pct = (v, of) => v / of * 100;
  let frog = null, label;
  if (departed) {
    label = 'Your room. The frog moved out' + (taken && Object.values(placements).includes(taken) ? ' and ' + takenName(taken) + ' is gone too' : '') + '. A letter lies on the rug.';
  } else {
    const st = mode === 'adopt' ? 'healthy' : status;
    const lk = frogLook({ status: st, stage: mode === 'adopt' ? 'egg' : stage, needs });
    const bubble = mode === 'adopt' ? '' : BUBBLE[st] || '';
    const tinfoil = ev?.frog && lk.sprite === 'adult_idle';
    frog = { ...lk, src: tinfoil ? spriteSrc(ev.frog) : spriteSrc(lk.sprite), left: pct(HOME.x, ROOM_W), top: pct(HOME.y, ROOM_H), width: pct(FROG_PX, ROOM_W),
      foot: SPRITES[lk.sprite][1], bubble, bubbleTop: pct(HOME.y - (SPRITES[lk.sprite][1] - SPRITES[lk.sprite][0]) - 6, ROOM_H) };
    label = mode === 'adopt' ? 'Your room. An egg waits on the rug for a name.'
      : `Your room. Your ${stage} Fren is ${status}${lk.look ? ' and ' + LOOK_WORD[lk.look] : ''}${lk.suitcase ? ', with a suitcase' : ''}.`;
  }
  return {
    mode, status: departed ? 'departed' : mode === 'adopt' ? 'adopt' : status, label, items, frog,
    rare: ev ? { id: rare, ...ev } : null,
    // diary: -1 = no pages yet (no button), 0 = pages all read, n = unread pages
    diary: mode === 'pet' && Number.isInteger(diary) && diary >= 0 ? { unread: diary } : null,
    notes: mode === 'pet' && notes > 0 ? { count: notes, src: NOTES.src, left: pct(NOTES.x, ROOM_W), top: pct(NOTES.y, ROOM_H), width: pct(NOTES.px, ROOM_W) } : null,
    letter: departed ? { src: letterSeen ? LETTER.open : LETTER.envelope, read: letterSeen,
      left: pct(LETTER.x, ROOM_W), top: pct(LETTER.y, ROOM_H), width: pct(LETTER.px, ROOM_W) } : null,
  };
}

// ---------- DOM ----------
const pos = (n, left, top, width) => { n.style.left = left + '%'; n.style.top = top + '%'; n.style.width = width + '%'; };
// the CSS moves a sprite up by its foot line (custom property, so the idle animation keeps it)
const setFoot = (n, foot) => n.style.setProperty('--foot', foot / FROG_PX * 100 + '%');

const suitcaseEl = doc => { const s = doc.createElement('img'); s.className = 'pgr-suitcase'; s.src = SUITCASE.src; s.alt = ''; return s; };

// opts as roomScene. The letter is a button with data-letter="1", so the window's click handler opens GOODBYE.TXT.
export function renderRoom(doc, opts = {}) {
  const sc = roomScene(opts);
  const mk = (tag, cls) => { const n = doc.createElement(tag); if (cls) n.className = cls; return n; };
  const frame = mk('div', 'pgr-frame');
  const st = mk('div', 'pgr pgr-' + sc.status);
  const art = mk('div', 'pgr-art');
  art.setAttribute('role', 'img');
  art.setAttribute('aria-label', sc.label);
  const bg = mk('img', 'pgr-bg'); bg.src = BACKGROUND; bg.alt = ''; art.append(bg);
  const sign = mk('div', 'pgr-house-sign'); sign.setAttribute('aria-hidden', 'true');
  sign.textContent = 'NO FUD\nAFTER BEDTIME'; art.append(sign);
  const lamp = mk('img', 'pgr-fixed-lamp'); lamp.src = ROOM_LAMP.src; lamp.alt = '';
  pos(lamp, ROOM_LAMP.left, ROOM_LAMP.top, ROOM_LAMP.width); art.append(lamp);
  const horse = mk('img', 'pgr-fixed-horse'); horse.src = ROOM_HORSE.src; horse.alt = ''; horse.dataset.item = 'chrome_rocking_horse';
  pos(horse, ROOM_HORSE.left, ROOM_HORSE.top, ROOM_HORSE.width); art.append(horse);
  for (const it of sc.items) {
    const im = mk('img', 'pgr-item' + (it.wall ? ' pgr-wall' : ''));
    im.src = it.src; im.alt = ''; im.dataset.slot = it.slotId; im.dataset.item = it.itemId;
    pos(im, it.left, it.top, it.width); im.style.zIndex = String(it.z);
    if (it.rare) im.classList.add('pgr-rare-item');
    art.append(im);
  }
  // a rare visitor at the window: drawn inside the glass only (the curtains and frame stay in front of nothing)
  if (sc.rare?.window) {
    const glass = mk('div', 'pgr-window pgr-window-' + sc.rare.id); glass.setAttribute('aria-hidden', 'true');
    glass.style.left = WINDOW_GLASS.x / ROOM_W * 100 + '%'; glass.style.top = WINDOW_GLASS.y / ROOM_H * 100 + '%';
    glass.style.width = WINDOW_GLASS.w / ROOM_W * 100 + '%'; glass.style.height = WINDOW_GLASS.h / ROOM_H * 100 + '%';
    const v = mk('img', 'pgr-visitor'); v.alt = '';
    v.src = rareSrc(sc.rare.frames ? sc.rare.src + '1.png' : sc.rare.src);
    if (sc.rare.frames) v.dataset.frames = String(sc.rare.frames);
    glass.append(v); art.append(glass);
  }
  if (sc.frog) {
    const f = mk('img', 'pgr-pet'); f.src = versionSprite(sc.frog.src); f.alt = ''; f.dataset.sprite = sc.frog.sprite;
    if (sc.frog.fallback) f.dataset.fallback = '1';
    pos(f, sc.frog.left, sc.frog.top, sc.frog.width); setFoot(f, sc.frog.foot); art.append(f);
    if (sc.frog.suitcase) {
      const s = suitcaseEl(doc);
      pos(s, sc.frog.left + SUITCASE.dx / ROOM_W * 100, sc.frog.top, SUITCASE.px / ROOM_W * 100);
      art.append(s);
    }
    if (sc.frog.bubble) { const b = mk('div', 'pgr-bubble'); b.textContent = sc.frog.bubble; b.style.top = sc.frog.bubbleTop + '%'; art.append(b); }
  }
  st.append(art);
  if (sc.diary) {
    const b = mk('button', 'pgr-diary'), u = sc.diary.unread;
    b.type = 'button'; b.dataset.diary = '1';
    b.setAttribute('aria-label', 'DIARY.TXT' + (u ? ', ' + u + (u === 1 ? ' new page' : ' new pages') : '') + '. Read it');
    b.title = 'DIARY.TXT';
    b.textContent = 'DIARY';
    if (u) { const n = mk('span', 'pgr-notes-n'); n.textContent = String(u); n.setAttribute('aria-hidden', 'true'); b.append(n); }
    st.append(b);
  }
  if (sc.notes) {
    const b = mk('button', 'pgr-notes');
    b.type = 'button'; b.dataset.notes = '1';
    const label = sc.notes.count === 1 ? '1 note from your Fren' : sc.notes.count + ' notes from your Fren';
    b.setAttribute('aria-label', label + '. Read them'); b.title = label;
    pos(b, sc.notes.left, sc.notes.top, sc.notes.width);
    const im = mk('img'); im.src = sc.notes.src; im.alt = ''; b.append(im);
    const n = mk('span', 'pgr-notes-n'); n.textContent = String(sc.notes.count); n.setAttribute('aria-hidden', 'true'); b.append(n);
    st.append(b);
  }
  if (sc.letter) {
    const b = mk('button', 'pgr-letter');
    b.type = 'button'; b.dataset.letter = '1';
    b.setAttribute('aria-label', sc.letter.read ? 'GOODBYE.TXT (read). Open it again' : 'Open GOODBYE.TXT');
    b.title = 'GOODBYE.TXT';
    pos(b, sc.letter.left, sc.letter.top, sc.letter.width);
    const im = mk('img'); im.src = sc.letter.src; im.alt = ''; b.append(im);
    st.append(b);
  }
  frame.append(st);
  return frame;
}

// The UFO's blinking lights (4 frames). Returns a stop function; nothing to do for other rooms or reduced motion.
export function playRareVisitor(frame, { setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  const v = frame.querySelector('.pgr-visitor[data-frames]');
  if (!v) return null;
  const n = Number(v.dataset.frames), base = v.getAttribute('src').replace(/1\.png(\?.*)?$/, '');
  let i = 0, timer = null;
  const tick = () => { i = (i + 1) % n; v.setAttribute('src', versionSprite(base.replace(/\?.*$/, '') + (i + 1) + '.png')); timer = setTimer(tick, RARE_ROOM.ufo.ms); };
  timer = setTimer(tick, RARE_ROOM.ufo.ms);
  return () => clearTimer(timer);
}

// Plays the moving-out frames once on a room drawn with mode 'departed'. The letter appears when the
// frog has left. Returns a function that stops it (the window draws again on every click).
export function playDeparture(frame, stage = 'adult', { setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  const doc = frame.ownerDocument, art = frame.querySelector('.pgr-art'), letter = frame.querySelector('.pgr-letter');
  const steps = departTimeline(stage);
  const actor = doc.createElement('div'); actor.className = 'pgr-actor' + (stage === 'adult' || WALK[stage] ? '' : ' pgr-young');
  const im = doc.createElement('img'); im.alt = ''; actor.append(im);
  // a young frog's suitcase walks with it: placed inside the 128 px actor, in actor percent
  if (steps[0].suitcase) { const s = suitcaseEl(doc); pos(s, 50 + SUITCASE.dx / FROG_PX * 100, steps[0].foot / FROG_PX * 100, SUITCASE.px / FROG_PX * 100); actor.append(s); }
  actor.style.top = HOME.y / ROOM_H * 100 + '%'; actor.style.width = FROG_PX / ROOM_W * 100 + '%';
  if (letter) letter.hidden = true;
  art.append(actor);
  let i = 0, timer = null;
  const show = () => {
    if (i >= steps.length) { actor.remove(); if (letter) letter.hidden = false; return; }
    im.src = versionSprite(steps[i].src); im.dataset.frame = String(i + 1);
    actor.style.left = steps[i].x / ROOM_W * 100 + '%'; setFoot(actor, steps[i].foot);
    i++; timer = setTimer(show, DEPART_MS);
  };
  show();
  return () => { clearTimer(timer); actor.remove(); if (letter) letter.hidden = false; };
}
