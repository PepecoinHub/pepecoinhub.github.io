// PEPEGOCHI.EXE, the real game (docs/games/pepegochi-live.html): draws LiveGame (pepegochi-live-view.mjs).
// The frog lives on the server (games/supabase/update_pepegochi_v2.sql), one per Discord account.
// PondOS opens this page in a window; it also works on its own.
import { getBackend } from './backend.js?v=20261113link';
import { LiveGame } from './pepegochi-live-view.mjs?v=20261120notes3';
import { renderRoom, playDeparture, playFrames, frogLook, careFrames, animationFramesForStage, HATCH_FRAMES, HATCH_MS, CARE_MS, versionSprite } from './pepegochi-room.mjs?v=20261121chrom';
import { createRoomInteractions } from './pepegochi-room-interactions.mjs?v=20261121chrom';
import { notesFor } from '../../meme/pepegochi-notes.mjs?v=20261121map';
import { openPondMap, noteLines } from './pond-map.mjs?v=20261121map';

const $ = id => document.getElementById(id);
const el = (tag, attrs = {}, text = null) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) n.setAttribute(k, v === true ? '' : v);
  if (text != null) n.textContent = text;
  return n;
};

let backend = null;
const game = new LiveGame({ rpc: (fn, args) => backend.rpc(fn, args) });

function meter(n) {
  const row = el('div', { class: 'pgb-need' + (n.overdue ? ' is-overdue' : '') + (n.low ? ' is-low' : '') });
  const m = el('meter', { min: 0, max: 100, low: 40, high: 90, optimum: 100, 'aria-label': n.label });
  m.value = n.value;
  row.append(el('span', { class: 'pgb-need-name' }, n.label), m, el('b', {}, String(n.value)));
  if (n.note) row.append(el('small', { class: 'pgb-need-note' }, n.note));
  return row;
}

// The frog's notes on the table (clues and other important messages), kept in this browser per account and life.
let notesOpen = false;
// Pond Map notes come from the server (gry_map_notes): they stay on the table on every device and for every frog.
let mapNotes = [], mapAsked = false;
const synced = new Set();
function loadMapNotes() {
  if (mapAsked || !backend?.rpc) return;
  mapAsked = true;
  backend.rpc('gry_map_notes').then(list => { mapNotes = Array.isArray(list) ? list : []; if (game.last && !game.busy) render(); }).catch(() => {});
}
const localNotes = () => {
  const pet = game.last?.pet, user = backend?.session?.()?.user;
  if (!pet || pet.status === 'departed' || !user || user.is_anonymous) return [];
  return notesFor(user.id, pet.life_id);
};
const myNotes = () => {
  const local = localNotes();
  // the frog's clues about the map, written in this browser, are copied to the server once so they never get lost
  for (const n of local) {
    const m = n.kind === 'clue' && /^pond_map_([1-6])$/.exec(n.secret || '');
    if (m && !synced.has(m[1]) && backend?.rpc) { synced.add(m[1]); backend.rpc('gry_map_note', { p_key: 'clue_' + m[1] }).then(() => { mapAsked = false; loadMapNotes(); }).catch(() => {}); }
  }
  const serverClues = new Set(mapNotes.filter(n => /^clue_/.test(n.key)).map(n => 'pond_map_' + n.key.slice(5)));
  const shown = local.filter(n => !(n.kind === 'clue' && serverClues.has(n.secret)));
  if (game.last?.pet && game.last.pet.status !== 'departed') noteLines(mapNotes).forEach(text => shown.push({ text, day: null }));
  return shown;
};
function renderNotes(box) {
  const notes = myNotes();
  if (!notesOpen || !notes.length) { notesOpen = false; return; }
  const pad = el('div', { class: 'pgb-notepad pgb-notes', role: 'document', 'aria-label': 'NOTES.TXT', id: 'pgb-notes', tabindex: '-1' });
  const ol = el('ol');
  notes.forEach(n => { const li = el('li', {}, n.text); li.append(el('small', {}, n.day == null ? 'Pond Map' : `Good care day ${n.day}`)); ol.append(li); });
  pad.append(el('div', { class: 'pgb-notepad-bar' }, 'NOTES.TXT - notes from your Fren'), ol,
    el('button', { type: 'button', class: 'btn', 'data-close-notes': '1' }, 'Close'));
  box.append(pad);
}

function renderPet(box, p) {
  renderNotes(box);
  box.append(el('p', { class: 'pgb-status' }, p.statusText));
  for (const w of p.warnings) box.append(el('p', { class: 'pgb-warn' }, w));
  if (p.recovery) box.append(el('p', { class: 'pgb-warn pgb-recovery' }, p.recovery));
  const needs = el('div', { class: 'pgb-needs' });
  p.needs.forEach(n => needs.append(meter(n)));
  box.append(needs);
  const acts = el('div', { class: 'pgb-row pgb-actions' });
  for (const a of p.actions) {
    const b = el('button', { type: 'button', class: 'btn', 'data-act': a.kind, disabled: !a.enabled || game.busy, title: a.reason || a.label });
    b.append(el('span', { class: 'pgb-action-label' }, a.label), el('span', { class: 'pgb-action-detail' }, a.reason || (game.busy ? 'Please wait…' : 'Ready')));
    acts.append(b);
  }
  box.append(acts);
  const g = p.goodDays;
  const gd = el('div', { class: 'pgb-good' });
  const prog = el('progress', { max: g.goal, 'aria-label': 'Good care days' }); prog.value = Math.min(g.count, g.goal);
  gd.append(el('p', {}, g.progress), prog, el('p', { class: 'pgb-good-today' }, g.text));
  if (g.blockers.length) {
    const ul = el('ul', { class: 'pgb-list' });
    g.blockers.forEach(x => ul.append(el('li', {}, x)));
    gd.append(el('p', { class: 'small' }, 'Still missing for a good care day:'), ul);
  }
  box.append(gd);
  box.append(el('p', { class: 'small muted' }, p.growth));
  box.append(el('p', { class: 'small muted' }, p.deadline));
}

function adoptForm(label, value) {
  const f = el('form', { class: 'pgb-row pgb-adopt', 'data-adopt': '1' });
  // owner, 2026-11-15: say up front that good care pays off
  f.append(el('p', { class: 'pgb-adopt-note' }, 'Look after your fren: good care is rewarded with stamps in your Fren Passport.'));
  f.append(el('label', { for: 'pgb-name' }, 'Name'),
    el('input', { type: 'text', id: 'pgb-name', value, maxlength: 18, autocomplete: 'off', pattern: '[A-Za-z0-9 _.\\-]{2,18}', title: '2-18 letters, digits, spaces, _ . -' }),
    el('button', { type: 'submit', class: 'btn primary', disabled: game.busy }, label));
  return f;
}

function renderDeparted(box, v) {
  const d = v.departed;
  box.append(el('p', { class: 'pgb-status' }, d.text));
  const ul = el('ul', { class: 'pgb-list' });
  d.facts.forEach(f => ul.append(el('li', {}, f)));
  box.append(el('p', {}, d.name), ul);
  const row = el('div', { class: 'pgb-row' });
  row.append(el('button', { type: 'button', class: 'btn primary', 'data-letter': '1' }, 'Open GOODBYE.TXT'));
  box.append(row);
  if (v.letter.open) {
    const pad = el('div', { class: 'pgb-notepad', role: 'document', 'aria-label': v.letter.title, id: 'pgb-notepad', tabindex: '-1' });
    pad.append(el('div', { class: 'pgb-notepad-bar' }, v.letter.title), el('pre', {}, v.letter.text), el('p', { class: 'small muted' }, v.letter.note));
    pad.append(el('button', { type: 'button', class: 'btn', 'data-close-letter': '1' }, 'Close'));
    box.append(pad);
  }
  box.append(adoptForm(d.canAdopt ? 'Adopt a New Fren' : 'Adopt a New Fren (read the letter first)', 'Fren II'));
}

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const petImg = () => document.querySelector('#pgb-scene .pgr-pet');
const roomInteractions = createRoomInteractions({ getView: () => game.view(), isBusy: () => game.busy,
  care: runCare, reduced: reduceMotion,
  openPainting: say => { if (backend) openPondMap(backend, { say }); },
  openTV: () => {
    if (window.parent !== window) window.parent.postMessage({ type: 'pondos:pepegochi-room-tv' }, location.origin);
  } });
let shown = null, stopAnim = null, sceneKey = '', careDone = null;
const preloaded = new Set();
// The scene is built again only when what it shows changes (mode, stage, status, sprite, room, letter), not on the
// minute redraw: a new <img> would restart the idle bob and cut a hatching or care animation short.
function renderScene(v) {
  const scene = $('pgb-scene'), title = $('pgb-scene-title');
  const placements = game.placements(), at = placements ? { placements } : {};
  let opts;
  if (v.mode === 'pet') {
    title.textContent = v.pet.title;
    opts = { mode: 'pet', status: v.pet.status, stage: v.pet.stage, needs: v.pet.needs, notes: myNotes().length, ...at };
  } else if (v.mode === 'departed') {
    title.textContent = `${v.departed.name} · moved out`;
    opts = { mode: 'departed', letterSeen: v.departed.letterSeen, taken: v.departed.taken, ...at };
  } else { title.textContent = 'Your room'; opts = { mode: 'adopt' }; }
  const lifeId = v.mode === 'pet' ? game.last?.pet?.life_id : null;
  const key = JSON.stringify([opts.mode, opts.status, opts.stage, opts.letterSeen, opts.taken, opts.notes, placements, lifeId,
    v.mode === 'pet' ? frogLook(opts).sprite : null]);
  const care = careDone; careDone = null;
  if (key !== sceneKey || !scene.firstChild) {
    if (stopAnim) { stopAnim(); stopAnim = null; }
    sceneKey = key;
    const room = renderRoom(document, opts);
    scene.replaceChildren(room);
    roomInteractions.attach(room, opts, { owned: placements !== null, lifeId, embedded: window.parent !== window });
    const stage = v.mode === 'pet' ? v.pet.stage : v.mode === 'adopt' ? 'egg' : null;
    if (stage && !preloaded.has(stage)) { preloaded.add(stage); animationFramesForStage(stage).forEach(src => { const i = new Image(); i.src = versionSprite(src); }); }
    if (v.mode === 'departed' && shown && shown.mode === 'pet' && !reduceMotion()) stopAnim = playDeparture(room, shown.stage);
    // the egg hatches: the cracking frames, then the tadpole
    if (v.mode === 'pet' && v.pet.stage === 'tadpole' && shown && shown.stage === 'egg' && !reduceMotion()) stopAnim = playFrames(petImg(), HATCH_FRAMES, HATCH_MS);
  }
  // An accepted care action plays its stage-specific animation.
  if (care && v.mode === 'pet' && !(shown && shown.stage === 'egg') && !reduceMotion()) {
    const frames = careFrames(v.pet.stage, care);
    if (frames.length) { if (stopAnim) stopAnim(); stopAnim = playFrames(petImg(), frames, CARE_MS); }
  }
  shown = { mode: v.mode, stage: v.pet?.stage };
}

function render() {
  const v = game.view();
  renderScene(v);
  $('pgb-msg').textContent = v.message || '';
  const box = $('pgb-body');
  box.replaceChildren();
  if (v.mode === 'loading') box.append(el('p', { class: 'muted' }, v.message));
  else if (v.mode === 'signin') {
    box.append(el('p', { class: 'pgb-title' }, v.signin.title), el('p', {}, v.signin.text));
    box.append(el('button', { type: 'button', class: 'btn primary', 'data-signin': '1' }, 'Log on with Discord'));
  } else if (v.mode === 'adopt') {
    box.append(el('p', { class: 'pgb-title' }, v.adopt.title), el('p', {}, v.adopt.text), adoptForm('Adopt an egg', 'Fren'));
  } else if (v.mode === 'departed') renderDeparted(box, v);
  else renderPet(box, v.pet);
  const rules = $('pgb-rules'); rules.replaceChildren();
  (v.rules || []).forEach(x => rules.append(el('li', {}, x)));
  const past = $('pgb-past'); past.replaceChildren();
  if (!v.history || !v.history.length) past.append(el('p', { class: 'muted' }, 'None yet.'));
  else { const ul = el('ul', { class: 'pgb-list' }); v.history.forEach(h => ul.append(el('li', {}, h.text))); past.append(ul); }
  renderDecor(v);
  if (v.summary) past.append(el('p', { class: 'small' }, `Former frens: ${v.summary.former_frens}. Longest friendship: ${v.summary.longest_friendship_days} days.`));
}

// Room secrets: every item has its own place; the decorations earned with Passport stamps appear in theirs
function renderDecor(v) {
  const box = $('pgb-decor'), card = $('pgb-decor-card');
  const f = v.mode === 'pet' ? game.found() : null;
  card.hidden = !f;
  if (!f) return;
  box.replaceChildren(el('p', {}, f.found === f.total ? `All ${f.total} room secrets found. Every corner of the room is full.`
    : `Room secrets found: ${f.found} of ${f.total}. A few spots in the room are still empty: some Passport stamps fill them.`));
}

async function run(p) {
  render();
  const result = await p;
  if (game.last && game.last.pet && !game.room) await game.loadRoom();
  render();
  // Same-origin parent re-reads the authenticated state; never send private pet data via postMessage.
  if (result && result.ok && window.parent !== window)
    window.parent.postMessage({ type: 'pondos:pepegochi-changed' }, location.origin);
}

async function openLetter() {
  await run(game.readLetter());
  const pad = $('pgb-notepad');
  if (pad) { pad.scrollIntoView({ block: 'start' }); pad.focus({ preventScroll: true }); }
}

function runCare(kind) {
  const v = game.view();
  if (game.busy || v.mode !== 'pet' || !v.pet.actions.some(a => a.kind === kind && a.enabled)) return;
  return run(game.act(kind).then(r => { if (r.ok && r.value.action_result === 'accepted') careDone = kind; return r; }));
}

function openNotes() {
  notesOpen = true; render();
  const pad = $('pgb-notes');
  if (pad) { pad.scrollIntoView({ block: 'start' }); pad.focus({ preventScroll: true }); }
}
$('pgb-scene').addEventListener('click', e => { if (e.target.closest('[data-letter]')) openLetter(); else if (e.target.closest('[data-notes]')) openNotes(); });
// a new note written by the frog on the taskbar (another document of this site) shows up on the table at once
window.addEventListener('storage', e => { if (e.key && e.key.startsWith('pepegochi:notes:') && game.last && !game.busy) render(); });
$('pgb-body').addEventListener('click', e => {
  const t = e.target.closest('button');
  if (!t || game.busy) return;
  if (t.dataset.act) runCare(t.dataset.act);
  else if (t.dataset.letter) openLetter();
  else if (t.dataset.closeLetter) { game.closeLetter(); render(); }
  else if (t.dataset.closeNotes) { notesOpen = false; render(); }
  else if (t.dataset.signin) backend.discord().catch(err => { game.message = err.message; render(); });
});
$('pgb-body').addEventListener('submit', e => {
  if (!e.target.closest('[data-adopt]')) return;
  e.preventDefault();
  if (!game.busy) run(game.adopt($('pgb-name').value));
});
// the needs move on by themselves: redraw every minute, and read the server again after a long break
setInterval(() => { if (game.last && !game.busy) render(); }, 6e4);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && game.stale && !game.busy) run(game.refresh()); });
// A care action can also start from the taskbar conversation. The parent sends no pet data; this authenticated
// iframe re-reads its own full state once so an already-open room never shows stale needs or growth.
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== window.parent || event.data?.type !== 'pondos:pepegochi-refresh') return;
  if (backend && !game.busy) run(game.refresh());
});

(async () => {
  render();
  try { backend = await getBackend(); } catch (e) { game.error = e.message; render(); return; }
  if (!backend.session || !backend.session() || backend.session().user.is_anonymous) { game.signin = true; render(); return; }
  await run(game.refresh());
  loadMapNotes();
})();
