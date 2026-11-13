// PepeGochi room scene for the PEPEGOCHI.EXE window.
// Art (candidates, not final):
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
export const BACKGROUND = IMG + 'room_clean_base.png';

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

// ---------- the frog ----------
// Every frog sprite is 128x128 (art pack v2). It is drawn at 1 sprite pixel = 1 room pixel, the same
// scale for every stage: the art itself shows the size, nothing is resized at runtime.
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
export const SPRITES = {
  egg_idle: [42, 124], tadpole_idle: [50, 124], froglet_idle: [30, 124],
  adult_idle: [9, 124], adult_hungry: [8, 124], adult_dirty: [8, 124], adult_moody: [9, 124], adult_tired: [9, 124],
  adult_neglected: [9, 124], adult_recovering: [8, 124], adult_packing: [9, 124],
  hatch_01: [42, 124], hatch_02: [42, 124], hatch_03: [20, 124], hatch_04: [50, 124],
};
// the moving-out frames (sprite pack 2026-11-09) stand on the same floor line as the frog
export const DEPART_FOOT = [124, 124, 124, 124, 124, 124];
export const spriteSrc = id => IMG + 'pepegochi_' + id + '.png';
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
export const LETTER = { x: 332, y: 346, px: 64, envelope: IMG + 'goodbye_envelope.png', open: IMG + 'goodbye_letter.png' };
// GOODBYE.TXT says "P.S. I took the TV.", so the TV is not drawn while the frog is away. It is only
// hidden in the picture: the item stays owned and placed, and it is back when a new frog moves in.
// (Room-4 will let the server pick the item and the matching P.S. line.)
export const TAKEN_BY_LETTER = 'crt_tv';

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
export const WALK = {};
export function departTimeline(stage = 'adult', walk = WALK[stage]) {
  const edge = ROOM_W - FROG_PX / 2;           // a 128 px frame touching the right edge
  if (walk) {
    const out = walk.turn.map(src => ({ src: IMG + src, x: HOME.x, foot: FOOT_Y, suitcase: false }));
    for (let x = HOME.x + 24, i = 0; x < ROOM_W + FROG_PX / 2; x += 24, i++)
      out.push({ src: IMG + walk.walk[i % walk.walk.length], x, foot: FOOT_Y, suitcase: false });
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
export const DEPART_FRAMES = [1, 2, 3, 4, 5, 6].map(n => IMG + 'depart_0' + n + '.png');

// ---------- short frame animations on the frog: hatching, and care once the art exists ----------
// The egg hatches: three cracking frames and the tadpole out of its shell (art pack A1, 2026-11-13), then the tadpole.
export const HATCH_MS = 450;
export const HATCH_FRAMES = ['hatch_01', 'hatch_02', 'hatch_03', 'hatch_04'].map(spriteSrc);
// Care animations (backlog A6/A6b): 'stage_kind' -> sprite ids, e.g. adult_feed: ['care_feed_01', ...].
// Empty until the art is in: then an accepted care action plays nothing, exactly as today.
export const CARE_MS = 200;
export const CARE = {};
export const careFrames = (stage, kind) => (CARE[stage + '_' + kind] || []).map(id => IMG + id + '.png');

// Shows frames one after another on the frog's <img>, then puts its own sprite back. Returns a stop function.
export function playFrames(img, frames, ms, { setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  if (!img || !frames.length) return null;
  const final = img.getAttribute('src');
  let i = 0, timer = null;
  const next = () => {
    if (i >= frames.length) { img.setAttribute('src', final); timer = null; return; }
    img.setAttribute('src', frames[i++]); timer = setTimer(next, ms);
  };
  next();
  return () => { if (timer) clearTimer(timer); img.setAttribute('src', final); };
}

// ---------- one description of what the scene shows, so it can be tested without a browser ----------
// mode: 'adopt' (an egg waits for a name), 'pet' or 'departed'
export function roomScene({ mode = 'pet', status = 'healthy', stage = 'adult', needs = [], placements = STARTER_ROOM, letterSeen = false } = {}) {
  const departed = mode === 'departed';
  const items = [];
  for (const [slotId, itemId] of Object.entries(placements)) {
    const s = SLOTS[slotId], it = ITEMS[itemId];
    if (!s || !it) continue;
    if (departed && itemId === TAKEN_BY_LETTER) continue;
    items.push({ slotId, itemId, src: IMG + itemId + '.png', wall: !!s.wall, z: s.z,
      left: s.x / ROOM_W * 100, top: (s.y + it.dy) / ROOM_H * 100, width: it.size });
  }
  const pct = (v, of) => v / of * 100;
  let frog = null, label;
  if (departed) {
    label = 'Your room. The frog moved out' + (Object.values(placements).includes(TAKEN_BY_LETTER) ? ' and the TV is gone too' : '') + '. A letter lies on the rug.';
  } else {
    const st = mode === 'adopt' ? 'healthy' : status;
    const lk = frogLook({ status: st, stage: mode === 'adopt' ? 'egg' : stage, needs });
    const bubble = mode === 'adopt' ? '' : BUBBLE[st] || '';
    frog = { ...lk, src: spriteSrc(lk.sprite), left: pct(HOME.x, ROOM_W), top: pct(HOME.y, ROOM_H), width: pct(FROG_PX, ROOM_W),
      foot: SPRITES[lk.sprite][1], bubble, bubbleTop: pct(HOME.y - (SPRITES[lk.sprite][1] - SPRITES[lk.sprite][0]) - 6, ROOM_H) };
    label = mode === 'adopt' ? 'Your room. An egg waits on the rug for a name.'
      : `Your room. Your ${stage} Fren is ${status}${lk.look ? ' and ' + LOOK_WORD[lk.look] : ''}${lk.suitcase ? ', with a suitcase' : ''}.`;
  }
  return {
    mode, status: departed ? 'departed' : mode === 'adopt' ? 'adopt' : status, label, items, frog,
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
  for (const it of sc.items) {
    const im = mk('img', 'pgr-item' + (it.wall ? ' pgr-wall' : ''));
    im.src = it.src; im.alt = ''; im.dataset.slot = it.slotId; im.dataset.item = it.itemId;
    pos(im, it.left, it.top, it.width); im.style.zIndex = String(it.z);
    art.append(im);
  }
  if (sc.frog) {
    const f = mk('img', 'pgr-pet'); f.src = sc.frog.src; f.alt = ''; f.dataset.sprite = sc.frog.sprite;
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

// Plays the moving-out frames once on a room drawn with mode 'departed'. The letter appears when the
// frog has left. Returns a function that stops it (the window draws again on every click).
export function playDeparture(frame, stage = 'adult', { setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  const doc = frame.ownerDocument, art = frame.querySelector('.pgr-art'), letter = frame.querySelector('.pgr-letter');
  const steps = departTimeline(stage);
  const actor = doc.createElement('div'); actor.className = 'pgr-actor' + (stage === 'adult' ? '' : ' pgr-young');
  const im = doc.createElement('img'); im.alt = ''; actor.append(im);
  // a young frog's suitcase walks with it: placed inside the 128 px actor, in actor percent
  if (steps[0].suitcase) { const s = suitcaseEl(doc); pos(s, 50 + SUITCASE.dx / FROG_PX * 100, steps[0].foot / FROG_PX * 100, SUITCASE.px / FROG_PX * 100); actor.append(s); }
  actor.style.top = HOME.y / ROOM_H * 100 + '%'; actor.style.width = FROG_PX / ROOM_W * 100 + '%';
  if (letter) letter.hidden = true;
  art.append(actor);
  let i = 0, timer = null;
  const show = () => {
    if (i >= steps.length) { actor.remove(); if (letter) letter.hidden = false; return; }
    im.src = steps[i].src; im.dataset.frame = String(i + 1);
    actor.style.left = steps[i].x / ROOM_W * 100 + '%'; setFoot(actor, steps[i].foot);
    i++; timer = setTimer(show, DEPART_MS);
  };
  show();
  return () => { clearTimer(timer); actor.remove(); if (letter) letter.hidden = false; };
}
