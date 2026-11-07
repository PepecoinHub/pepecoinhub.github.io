// PepeGochi room scene for the PEPEGOCHI.EXE window.
// Art: the layered room v5 candidates from the design PR (#222): one clean 640x400 background,
// one 128x128 RGBA sprite per item, and the frog. Slot and item IDs are the same as in
// games/supabase/update_pepegochi_room_v1.sql (tests/pepegochi-room-window.test.mjs checks this),
// so the window can later draw the room the server returns without renaming anything.
// This file only draws. It owns nothing, saves nothing and talks to no server.

export const ROOM_W = 640;
export const ROOM_H = 400;
export const IMG = 'img/pepegochi/';
export const BACKGROUND = IMG + 'room_clean_base.png';
export const FROG = IMG + 'pepegochi_adult_idle.png';

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

// item_id -> sprite and how big it looks (percent of the room width); dy moves the sprite onto its furniture
export const ITEMS = {
  p_poster: { size: 15, dy: 0 },
  crt_tv: { size: 20, dy: 28 },
  lava_lamp: { size: 15, dy: 16 },
  potted_plant: { size: 19, dy: 4 },
  rubber_duck: { size: 14, dy: 0 },
  mug: { size: 13, dy: 20 },
};

// the six starter props and where they stand (starter_slot_id in the room SQL)
export const STARTER_ROOM = {
  wall_left: 'p_poster', tv_stand: 'crt_tv', dresser_top: 'lava_lamp',
  floor_left: 'potted_plant', rug_left: 'rubber_duck', table_top: 'mug',
};

export const BUBBLE = { neglected: 'I miss you…', packing: 'Packing my things…', recovering: 'Thanks for coming back', healthy: '' };
const STAGE_SCALE = { egg: 0.5, tadpole: 0.6, froglet: 0.8 };

// One description of what the scene shows, so it can be tested without a browser.
export function roomScene({ status = 'healthy', stage = 'adult', departed = false, placements = STARTER_ROOM } = {}) {
  const items = [];
  for (const [slotId, itemId] of Object.entries(placements)) {
    const s = SLOTS[slotId], it = ITEMS[itemId];
    if (!s || !it) continue;
    items.push({ slotId, itemId, src: IMG + itemId + '.png', wall: !!s.wall, z: s.z,
      left: s.x / ROOM_W * 100, top: (s.y + it.dy) / ROOM_H * 100, width: it.size });
  }
  return {
    status: departed ? 'departed' : status,
    label: departed ? 'Empty room with a letter on the floor' : `Room. Your Fren is ${status}.`,
    items,
    frog: departed ? null : { src: FROG, width: 22 * (STAGE_SCALE[stage] ?? 1), bubble: BUBBLE[status] || '' },
    letter: departed,
  };
}

export function renderRoom(doc, opts) {
  const sc = roomScene(opts);
  const mk = (tag, cls) => { const n = doc.createElement(tag); if (cls) n.className = cls; return n; };
  const st = mk('div', 'pgr pgr-' + sc.status);
  st.setAttribute('role', 'img');
  st.setAttribute('aria-label', sc.label);
  const bg = mk('img', 'pgr-bg'); bg.src = BACKGROUND; bg.alt = ''; st.append(bg);
  for (const it of sc.items) {
    const im = mk('img', 'pgr-item' + (it.wall ? ' pgr-wall' : ''));
    im.src = it.src; im.alt = ''; im.dataset.slot = it.slotId;
    im.style.left = it.left + '%'; im.style.top = it.top + '%'; im.style.width = it.width + '%'; im.style.zIndex = String(it.z);
    st.append(im);
  }
  if (sc.frog) {
    const f = mk('img', 'pgr-pet'); f.src = sc.frog.src; f.alt = ''; f.style.width = sc.frog.width + '%'; st.append(f);
    if (sc.frog.bubble) { const b = mk('div', 'pgr-bubble'); b.textContent = sc.frog.bubble; st.append(b); }
  }
  if (sc.letter) { const l = mk('div', 'pgr-letter'); l.textContent = '✉ GOODBYE.TXT'; st.append(l); }
  return st;
}
