// The Pond Map behind the Golden Foot painting (PepeGochi room). Six torn pieces, one word each, and at 6 of 6
// the founder's message. This file holds NO answers: every word goes to the server (gry_map_try), which decides.
// The words and the message live only in Supabase (games.map_words, games.map_config).
const IMG = 'img/pond-map/';
// The frog's gentle clues (PepeGochi only, from 50 good care days; pepegochi-notes.mjs). Never shown in the map window
// by themselves: on purpose there are no hints at the start, only what your Fren tells you.
export const MAP_HINTS = {
  1: 'I love old newspapers. The tiny ads at the back are my favourite. Funny how each one starts.',
  2: 'Someone threw away a locked file. I wonder how long we have all been holding…',
  3: 'We party on 30 January, but grandpa says the very first block is older. Ask the search box about that day.',
  4: 'The painter left an old sketch in his files. I like connecting dots. Do you?',
  5: 'A tip from me: go touch grass. And do not come back too fast. Nice.',
  6: 'Sometimes I watch old frog ads from the archive. One of them is… strange.',
};
const OPENERS = ['secret', 'secrets', 'sekret', 'sekrety', 'treasure', 'map', 'clue', 'hint'];
export const INTRO = 'An old map of the pond was torn into 6 pieces. Find them. Every piece hides one word: type the words here, in any order.';
const el = (doc, tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

let open = null;
// What the notes on the table say. word_N comes only from the server, after the player really did the step.
export function noteLines(notes) {
  const out = [];
  for (const n of notes || []) {
    const m = /^(intro|clue|word)_?([1-6])?$/.exec(n?.key || '');
    if (!m) continue;
    if (m[1] === 'intro') out.push(INTRO);
    else if (m[1] === 'clue' && MAP_HINTS[m[2]]) out.push('Your Fren once said: ' + MAP_HINTS[m[2]]);
    else if (m[1] === 'word' && n.word) out.push('A word you found (piece ' + m[2] + '): ' + n.word);
  }
  return out;
}
export async function openPondMap(backend, { doc = document, say = () => {} } = {}) {
  if (open) { open.focus(); return true; }
  let st;
  try { st = await backend.rpc('gry_map_state'); } catch { return false; }
  if (!st?.allowed) {
    if (st?.reason === 'locked') say('The frame feels loose, but it will not move. Not yet. Maybe after more PondOS secrets.');
    return false;
  }
  // notes on the table live on the server (gry_map_notes), so they survive a new browser or phone
  let notes = [];
  try { notes = await backend.rpc('gry_map_notes') || []; } catch {}

  const back = el(doc, 'div', 'pm-back');
  const win = el(doc, 'div', 'pm-win'); win.setAttribute('role', 'dialog'); win.setAttribute('aria-modal', 'true'); win.setAttribute('aria-label', 'Behind the Golden Foot');
  const bar = el(doc, 'div', 'pm-bar'); bar.append(el(doc, 'span', '', 'Behind the Golden Foot'));
  const x = el(doc, 'button', 'pm-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); bar.append(x);
  const body = el(doc, 'div', 'pm-body');
  const lead = el(doc, 'p', 'pm-lead', 'Behind the painting there is a narrow slot in the wall. Someone scratched next to it: "Looking for something? Say what you are looking for."');
  const grid = el(doc, 'div', 'pm-grid'); grid.setAttribute('aria-label', 'Map pieces');
  const tip = el(doc, 'p', 'pm-tip'); tip.setAttribute('aria-live', 'polite');
  const form = el(doc, 'form', 'pm-form');
  const input = el(doc, 'input', 'pm-in'); input.type = 'text'; input.maxLength = 40; input.autocomplete = 'off'; input.spellcheck = false;
  input.placeholder = 'Type a word…'; input.setAttribute('aria-label', 'A word for the slot');
  const go = el(doc, 'button', 'pm-btn primary', 'Say it'); go.type = 'submit';
  form.append(input, go);
  const frog = el(doc, 'img', 'pm-no'); frog.src = '../meme/img/stop.webp'; frog.alt = ''; frog.hidden = true;
  const end = el(doc, 'div', 'pm-end');
  const pad = el(doc, 'section', 'pm-notes');
  body.append(lead, grid, frog, tip, form, pad, end);
  win.append(bar, body); back.append(win); doc.body.append(back);

  const close = () => { back.remove(); doc.removeEventListener('keydown', esc); open = null; };
  const esc = e => { if (e.key === 'Escape') close(); };
  x.addEventListener('click', close); back.addEventListener('click', e => { if (e.target === back) close(); });
  doc.addEventListener('keydown', esc);
  open = { focus: () => input.focus() };

  const paint = () => {
    const found = new Set(st.found || []);
    grid.textContent = '';
    for (let i = 1; i <= 6; i++) {
      const slot = el(doc, 'figure', 'pm-slot' + (found.has(i) ? ' got' : ''));
      if (found.has(i)) {
        const im = el(doc, 'img'); im.src = IMG + 'piece-' + i + '.webp'; im.alt = 'Map piece ' + i;
        im.addEventListener('error', () => { im.remove(); slot.classList.add('noimg'); }, { once: true });
        slot.append(im, el(doc, 'figcaption', '', 'Piece ' + i));
      } else {
        slot.append(el(doc, 'b', 'pm-q', '?'), el(doc, 'figcaption', '', 'Piece ' + i));
      }
      grid.append(slot);
    }
    pad.textContent = '';
    const lines = noteLines(notes);
    if (lines.length) {
      pad.append(el(doc, 'h4', '', 'NOTES.TXT'));
      const ol = el(doc, 'ol'); lines.forEach(t => ol.append(el(doc, 'li', '', t))); pad.append(ol);
    }
    tip.textContent = st.done ? 'The map is whole.' : (st.count || 0) + ' of 6 pieces.' + (st.test ? ' (Test mode: nothing counts in the Passport yet.)' : '');
    end.textContent = '';
    if (st.done) {
      const b = el(doc, 'button', 'pm-btn primary pm-read', 'Unfold the map'); b.type = 'button';
      b.addEventListener('click', () => finale(backend, doc, end, b));
      end.append(b);
    }
  };
  const no = (text) => {
    frog.hidden = false; frog.classList.remove('shake'); void frog.offsetWidth; frog.classList.add('shake');
    tip.textContent = text;
  };
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const raw = input.value.trim(); if (!raw) return;
    const low = raw.toLowerCase();
    if (OPENERS.includes(low)) {
      input.value = ''; frog.hidden = true; lead.textContent = INTRO;
      if (!notes.some(n => n.key === 'intro')) { notes.push({ key: 'intro' }); backend.rpc('gry_map_note', { p_key: 'intro' }).catch(() => {}); }
      paint(); return;
    }
    go.disabled = true;
    let r = null;
    try { r = await backend.rpc('gry_map_try', { p_word: raw }); } catch { tip.textContent = 'The wall did not answer. Try again in a moment.'; }
    go.disabled = false;
    if (!r) return;
    if (r.wait) { no('No. The frog is tired of guessing. Come back in 10 minutes.'); return; }
    if (!r.ok) { no('No.'); input.select(); return; }
    frog.hidden = true; input.value = '';
    st.found = [...new Set([...(st.found || []), r.piece])].sort(); st.count = r.count; st.done = r.done;
    paint();
    tip.textContent = r.new ? 'A piece slides out of the slot: piece ' + r.piece + ' of 6!' : 'You already have piece ' + r.piece + '.';
    if (r.done && r.new) finale(backend, doc, end, end.querySelector('.pm-read'));
  });
  if (st.count > 0) lead.textContent = INTRO;
  paint(); setTimeout(() => input.focus(), 30);
  return true;
}

async function finale(backend, doc, end, btn) {
  if (btn) btn.disabled = true;
  let f = null;
  try { f = await backend.rpc('gry_map_finale'); } catch {}
  if (!f?.ok) { if (btn) btn.disabled = false; return; }
  end.textContent = '';
  const box = el(doc, 'article', 'pm-letter');
  box.append(el(doc, 'p', 'pm-kick', 'POND_MAP.DAT · restored'));
  const map = el(doc, 'img', 'pm-map'); map.src = IMG + 'map-full.webp'; map.alt = 'The old pond map, whole again'; box.append(map);
  if (f.title) box.append(el(doc, 'h3', '', f.title));
  const pic = el(doc, 'div', 'pm-pic'); box.append(pic);
  if (f.text) for (const para of String(f.text).split(/\n{2,}/)) box.append(el(doc, 'p', 'pm-text', para));
  if (f.signature) box.append(el(doc, 'p', 'pm-sign', '— ' + f.signature));
  const prize = el(doc, 'div', 'pm-prize');
  const stamp = el(doc, 'img'); stamp.src = IMG + 'archivist.webp'; stamp.alt = 'The gold Pond Archivist stamp';
  prize.append(stamp, el(doc, 'p', 'pm-rank', 'You are fren #' + f.rank + ' to read this. The gold Pond Archivist stamp is yours.'));
  box.append(prize);
  end.append(box);
  // the screenshot sits in a private bucket: the storage policy lets only 6-of-6 players read it
  if (f.image && backend.sb?.storage) {
    try {
      const { data } = await backend.sb.storage.from('pond-finale').download(f.image);
      if (data) {
        const url = await new Promise((ok, bad) => { const rd = new FileReader(); rd.onload = () => ok(rd.result); rd.onerror = bad; rd.readAsDataURL(data); });
        const im = el(doc, 'img'); im.src = url; im.alt = 'The original message'; pic.append(im);
      }
    } catch {}
  }
  try {
    const wall = await backend.rpc('gry_map_wall');
    if (Array.isArray(wall) && wall.length) {
      const w = el(doc, 'section', 'pm-wall'); w.append(el(doc, 'h4', '', 'Wall of the pond'));
      const ol = el(doc, 'ol');
      for (const r of wall) ol.append(el(doc, 'li', '', r.name));
      w.append(ol); end.append(w);
    }
  } catch {}
}
