// PEPEGOCHI.EXE, the real game (docs/games/pepegochi-live.html): draws LiveGame (pepegochi-live-view.mjs).
// The frog lives on the server (games/supabase/update_pepegochi_v2.sql), one per Discord account.
// PondOS opens this page in a window; it also works on its own.
import { getBackend } from './backend.js?v=20261113link';
import { LiveGame } from './pepegochi-live-view.mjs?v=20261122life';
import { renderRoom, playDeparture, playRareVisitor, playFrames, playTvStatic, frogLook, careFrames, animationFramesForStage, HATCH_FRAMES, HATCH_MS, CARE_MS, versionSprite } from './pepegochi-room.mjs?v=20261122life';
import { createRoomInteractions } from './pepegochi-room-interactions.mjs?v=20261122life';
import { notesFor } from '../../meme/pepegochi-notes.mjs?v=20261121map';
import { openPondMap, noteLines } from './pond-map.mjs?v=20261121map';
// A12: the frog's diary (written by the taskbar frog or here) and the day's rare event in the room
import { diaryFor, createDiary, browserStorage, isSnoopHour, SNOOP_LINE } from '../../meme/pepegochi-diary.mjs?v=20261122life';
// A12 on the server (update_pepegochi_life.sql): trips, postcards, souvenirs, the golden lemon, the night signal
import { LENGTHS, PACKS, PLACES, SOUVENIRS, SOUVENIR, PLACE, tripState, formatLeft, tripForDiary } from '../../meme/pepegochi-trips.mjs?v=20261122life';
import { drawPostcard, drawDiaryPage, saveCanvas, postcardSrc, souvenirSrc } from './pepegochi-cards.mjs?v=20261122life';
import { rareOfDay, localDay } from '../../meme/pepegochi-rare.mjs?v=20261121a12';
import { renderCarePanel } from './pepegochi-care-ui.mjs?v=20261121compact';

const $ = id => document.getElementById(id);
const el = (tag, attrs = {}, text = null) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) n.setAttribute(k, v === true ? '' : v);
  if (text != null) n.textContent = text;
  return n;
};

let backend = null;
const game = new LiveGame({ rpc: (fn, args) => backend.rpc(fn, args) });


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

// ---------- A12 on the server: trips, postcards, souvenirs, golden lemon, night signal, diary copy ----------
let life = null, lifeSkew = 0, tripBusy = false, postcard = null, stopTv = null;
const tz = () => -new Date().getTimezoneOffset();
const lifeNow = () => Date.now() + lifeSkew;
// the diary's copy in this browser goes through pepegochi-diary.mjs (the room page itself touches no storage)
const diaryBook = createDiary({ storage: browserStorage() });
function takeLife(v) {
  if (!v || typeof v !== 'object') return;
  life = v; const s = Date.parse(v.server_now); lifeSkew = Number.isFinite(s) ? s - Date.now() : 0;
  // the diary another device saved joins this browser's copy
  const p = livingPet(), id = owner();
  if (p && id) diaryBook.adopt(id, p.life_id, v.diary && v.diary.life_id === p.life_id ? v.diary : null);
}
async function loadLife() {
  if (!backend?.rpc || !owner() || !game.last?.pet) { life = null; return; }
  try { takeLife(await backend.rpc('gry_pepegochi_life')); } catch { life = null; }   // not installed yet: the room works without it
}
function saveDiary() {
  const p = livingPet(), id = owner();
  if (!life || !p || !id) return;
  diaryBook.open(id, p.life_id);
  const book = diaryBook.snapshot();
  if (!book || !book.pages.length) return;
  backend.rpc('gry_pepegochi_diary_save', { p_book: book }).then(d => { if (life && d) life.diary = d; }).catch(() => {});
}
// A page about something that just happened in the room (a trip, the golden lemon, the TV signal)
function writePage(ctx) {
  const p = livingPet(), id = owner();
  if (!p || !id) return;
  const d = localDay();
  diaryBook.visit(id, p.life_id, { adoptedAt: Date.parse(p.adopted_at), fren: 'fren', needs: p.needs || {},
    date: { month: d.month, day: d.day, weekday: d.weekday }, ...ctx });
  saveDiary();
}
const tripNow = () => (life ? tripState(life.trip, lifeNow()) : { status: 'home' });
const notifyParent = () => { if (window.parent !== window) window.parent.postMessage({ type: 'pondos:pepegochi-changed' }, location.origin); };
async function startTrip(length, pack) {
  if (tripBusy || !backend) return;
  tripBusy = true; render();
  try {
    takeLife(await backend.rpc('gry_pepegochi_trip_start', { p_length: length, p_pack: pack || null }));
    game.message = `${game.last?.pet?.name || 'Your Fren'} packed ${pack ? PACKS[pack].label.toLowerCase() : 'nothing'} and left. Back in ${LENGTHS[length].hours} hours.`;
    notifyParent();
  } catch (e) { game.message = (e && e.message) || 'The trip could not start. Try again.'; }
  tripBusy = false; render();
}
async function claimTrip() {
  if (tripBusy || !backend) return;
  tripBusy = true; render();
  try {
    const v = await backend.rpc('gry_pepegochi_trip_claim');
    takeLife(v);
    if (v?.claimed) {
      postcard = { place: v.claimed.place, souvenir: v.claimed.souvenir, fresh: true, newPlace: !!v.claimed.new_place };
      writePage({ trip: tripForDiary(v.claimed.place, v.claimed.souvenir) });
      game.message = 'Your Fren is back with a postcard' + (v.claimed.souvenir ? ' and ' + SOUVENIR[v.claimed.souvenir].name : '') + '.';
      notifyParent();
    }
  } catch (e) { game.message = (e && e.message) || 'The postcard could not be opened. Try again.'; }
  tripBusy = false; render();
  $('pgb-postcard')?.scrollIntoView({ block: 'start' });
}
// the lemon tree in the room: one watering a UTC day counts (14 in a row grow the golden lemon)
function waterLemon(say) {
  if (!life || life.watered_today || !backend || !owner()) return;
  life.watered_today = true;
  backend.rpc('gry_pepegochi_water').then(v => {
    takeLife(v);
    if (v?.golden_new) {
      say('THE LEMON TREE GREW A GOLDEN LEMON. Your Fren is not touching it. It is too powerful.');
      writePage({ rare: 'golden_lemon' }); render();
    } else if (v?.shine === 2) say('Watered. One lemon looks... shinier than the others?');
    else if (v?.shine === 1) say('Watered. The lemon tree seems to love the routine.');
  }).catch(() => { if (life) life.watered_today = false; });
}
// the TV at 3 AM local time: static, then the numbers (the server decides and keeps the Night Signal secret)
function nightTv(say, frame) {
  if (new Date().getHours() !== 3 || !backend || !owner()) return false;
  say('The TV crackles. Something is coming through…');
  backend.rpc('gry_pepegochi_tv_signal', { p_tz_min: tz() }).then(r => {
    if (!r?.signal) { if (window.parent !== window) window.parent.postMessage({ type: 'pondos:pepegochi-room-tv' }, location.origin); return; }
    if (stopTv) stopTv();
    if (!reduceMotion()) stopTv = playTvStatic(frame);
    say('Static… and then numbers: ' + r.signal + '. Your Fren writes them down.');
    if (r.new) writePage({ rare: 'tv_signal' });
  }).catch(() => say('Only static tonight.'));
  return true;
}

function renderPostcard(box) {
  if (!postcard) return;
  const pad = el('div', { class: 'pgb-notepad pgb-postcard', role: 'document', 'aria-label': 'POSTCARD', id: 'pgb-postcard', tabindex: '-1' });
  const pl = PLACE[postcard.place], sv = postcard.souvenir ? SOUVENIR[postcard.souvenir] : null;
  pad.append(el('div', { class: 'pgb-notepad-bar' }, 'POSTCARD - ' + (pl?.secret ? '???' : 'from ' + (pl?.name || 'somewhere'))));
  const holder = el('div', { class: 'pgb-postcard-art' });
  const img = el('img', { src: postcardSrc(postcard.place), alt: 'A postcard from ' + (pl?.secret ? 'an unknown place' : pl?.name || 'a trip'), width: 1200, height: 675 });
  holder.append(img); pad.append(holder);
  // the real card with the frog's handwriting replaces the blank art once drawn
  drawPostcard(document, { place: postcard.place, souvenir: postcard.souvenir, name: game.last?.pet?.name || '' })
    .then(c => { c.className = 'pgb-postcard-canvas'; c.setAttribute('role', 'img'); c.setAttribute('aria-label', img.alt); holder.replaceChildren(c); pad._canvas = c; })
    .catch(() => {});
  if (postcard.fresh && postcard.newPlace) pad.append(el('p', { class: 'small' }, 'A new place for the postcard album.'));
  if (sv) pad.append(el('p', {}, `Souvenir: ${sv.name} (${sv.rarity}). "${sv.text}"`));
  const row = el('div', { class: 'pgb-row' });
  row.append(el('button', { type: 'button', class: 'btn', 'data-save-postcard': '1' }, 'Save as picture'),
    el('button', { type: 'button', class: 'btn', 'data-close-postcard': '1' }, 'Close'));
  pad.append(row);
  box.append(pad);
}

function renderTrip(box, p) {
  if (!life) return false;
  const t = tripNow(), name = game.last?.pet?.name || 'Your Fren';
  if (t.status === 'away') {
    box.append(el('p', { class: 'pgb-status' }, `${name} is on a trip. Back in ${formatLeft(t.leftMs)}.`),
      el('p', { class: 'small muted' }, 'Care waits until it is home. A note lies in the room.'));
    return true;
  }
  if (t.status === 'back') {
    const row = el('div', { class: 'pgb-row' });
    row.append(el('button', { type: 'button', class: 'btn primary', 'data-claim': '1', disabled: tripBusy }, 'Open the postcard'));
    box.append(el('p', { class: 'pgb-status' }, `${name} is back from a trip!`), row);
    return true;
  }
  return false;
}
function tripForm(p) {
  if (!life || !['froglet', 'adult'].includes(p.stage) || p.status !== 'healthy') return null;
  const n = p.needs || {}, ready = ['hunger', 'hygiene', 'mood', 'energy'].every(k => Number(n[k]) >= 75);
  const f = el('form', { class: 'pgb-trip', 'data-trip': '1' });
  f.append(el('p', { class: 'pgb-title' }, 'Send your Fren on a trip'));
  const len = el('select', { id: 'pgb-trip-len', 'aria-label': 'Trip length' });
  for (const [id, l] of Object.entries(LENGTHS)) if (id !== 'grand' || life.grand_open) len.append(el('option', { value: id }, `${l.label} (${l.hours} h)`));
  const pack = el('select', { id: 'pgb-trip-pack', 'aria-label': 'What to pack' });
  pack.append(el('option', { value: '' }, 'Nothing'));
  for (const [id, k] of Object.entries(PACKS)) pack.append(el('option', { value: id }, `${k.label}: ${k.note}`));
  f.append(el('label', { for: 'pgb-trip-len' }, 'Length'), len, el('label', { for: 'pgb-trip-pack' }, 'Backpack'), pack,
    el('button', { type: 'submit', class: 'btn', disabled: tripBusy || game.busy || !ready }, 'Send on a trip'));
  f.append(el('p', { class: 'small muted' }, ready ? 'It comes back with a postcard, sometimes a souvenir, and always a diary page.'
    : 'Your Fren wants to be fed, clean and rested (every need 75 or more) before a trip.'));
  return f;
}

// the postcard album and the souvenir box (Trips card under the room)
function renderAlbum(v) {
  const card = $('pgb-trips-card'), box = $('pgb-trips');
  if (!card || !box) return;
  card.hidden = !life || v.mode !== 'pet';
  if (card.hidden) return;
  const got = new Map((life.postcards || []).map(x => [x.place, x])), have = new Map((life.souvenirs || []).map(x => [x.id, x]));
  const normal = PLACES.filter(x => !x.secret);
  box.replaceChildren(el('p', {}, `Postcards: ${normal.filter(x => got.has(x.id)).length} of ${normal.length} places` + (got.has('unknown') ? ' and one from somewhere strange.' : '.')));
  const grid = el('div', { class: 'pgb-album' });
  for (const pl of PLACES) {
    if (pl.secret && !got.has(pl.id)) continue;
    const g = got.get(pl.id);
    const b = el('button', { type: 'button', class: 'pgb-album-card' + (g ? '' : ' is-locked'), 'data-postcard': g ? pl.id : null, disabled: !g,
      title: g ? (pl.secret ? '???' : pl.name) + (g.times > 1 ? ' (' + g.times + ' times)' : '') : 'Not visited yet' });
    if (g) b.append(el('img', { src: postcardSrc(pl.id), alt: pl.secret ? '???' : pl.name, loading: 'lazy', width: 120, height: 68 }));
    else b.append(el('span', {}, '?'));
    grid.append(b);
  }
  box.append(grid, el('p', {}, `Souvenirs: ${have.size} of ${SOUVENIRS.length}.`));
  const shelf = el('div', { class: 'pgb-souvenirs' });
  for (const s of SOUVENIRS) {
    const h = have.get(s.id);
    const cell = el('div', { class: 'pgb-souvenir' + (h ? ' is-' + s.rarity : ' is-locked'), title: h ? `${s.name} (${s.rarity}): "${s.text}"` : 'Not found yet' });
    if (h) cell.append(el('img', { src: souvenirSrc(s.id), alt: s.name, width: 32, height: 32 }));
    else cell.append(el('span', {}, '?'));
    shelf.append(cell);
  }
  box.append(shelf);
}

// ---------- A12 diary + rare event ----------
// The diary is written by the taskbar frog in PondOS; this window only reads it (pepegochi-diary.mjs diaryFor).
let diaryOpen = false;
const owner = () => { const u = backend?.session?.()?.user; return u && !u.is_anonymous ? u.id : null; };
const livingPet = () => { const p = game.last?.pet; return p && p.status !== 'departed' && p.stage && p.stage !== 'egg' ? p : null; };
function todayRare() {
  const p = livingPet(), id = owner();
  if (!p || !id) return null;
  const d = localDay();
  return rareOfDay({ owner: id, lifeId: p.life_id, dayKey: d.dayKey, month: d.month, day: d.day, hour: d.hour });
}
const myDiary = () => { const p = livingPet(), id = owner(); return p && id ? diaryFor(id, p.life_id) : { pages: [], fresh: 0 }; };
// what the room's DIARY button shows: hidden with no pages, a red count with the latest visit's pages
function diaryState() { const d = myDiary(); return d.pages.length ? (diaryOpen ? 0 : d.fresh) : -1; }
function renderDiary(box) {
  const p = livingPet(), id = owner();
  if (!diaryOpen || !p || !id) { diaryOpen = false; return; }
  const pages = myDiary().pages.slice().reverse();
  const pad = el('div', { class: 'pgb-notepad pgb-diary', role: 'document', 'aria-label': 'DIARY.TXT', id: 'pgb-diary', tabindex: '-1' });
  const ol = el('ol', { reversed: true });
  if (isSnoopHour(new Date().getHours())) ol.append(el('li', {}, SNOOP_LINE));
  if (!pages.length) ol.append(el('li', {}, 'Nothing yet. Come back later, the frog writes while you are away.'));
  pages.slice(0, 60).forEach((pg, i) => {
    const li = el('li', {}, pg.text); li.append(el('small', {}, 'Day ' + pg.day));
    if (i < 10) li.append(el('button', { type: 'button', class: 'pgb-diary-save', 'data-save-page': String(i), title: 'Save this page as a picture', 'aria-label': 'Save the page of day ' + pg.day + ' as a picture' }, 'Save'));
    ol.append(li);
  });
  pad.append(el('div', { class: 'pgb-notepad-bar' }, 'DIARY.TXT - written by your Fren'), ol,
    el('button', { type: 'button', class: 'btn', 'data-close-diary': '1' }, 'Close'));
  box.append(pad);
}

function renderPet(box, p) {
  renderPostcard(box);
  renderDiary(box);
  renderNotes(box);
  if (renderTrip(box, p)) return;   // away or back: no care from here until the postcard is opened
  box.append(el('p', { class: 'pgb-status' }, p.statusText));
  for (const w of p.warnings) box.append(el('p', { class: 'pgb-warn' }, w));
  if (p.recovery) box.append(el('p', { class: 'pgb-warn pgb-recovery' }, p.recovery));
  box.append(...renderCarePanel(document, p, { busy: game.busy }));
  const trip = tripForm(game.last?.pet || {});
  if (trip) box.append(trip);
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
  },
  isAway: () => tripNow().status !== 'home',
  onProp: (id, say, frame) => {
    if (id === 'potted_plant') { waterLemon(say); return false; }
    if (id === 'crt_tv') return nightTv(say, frame);
    return false;
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
    opts = { mode: 'pet', status: v.pet.status, stage: v.pet.stage, needs: v.pet.needs, notes: myNotes().length,
      rare: todayRare(), diary: diaryState(), away: tripNow().status !== 'home', golden: !!life?.golden_at, ...at };
  } else if (v.mode === 'departed') {
    title.textContent = `${v.departed.name} · moved out`;
    opts = { mode: 'departed', letterSeen: v.departed.letterSeen, taken: v.departed.taken, ...at };
  } else { title.textContent = 'Your room'; opts = { mode: 'adopt' }; }
  const lifeId = v.mode === 'pet' ? game.last?.pet?.life_id : null;
  const key = JSON.stringify([opts.mode, opts.status, opts.stage, opts.letterSeen, opts.taken, opts.notes, opts.rare, opts.diary, opts.away, opts.golden, placements, lifeId,
    v.mode === 'pet' ? frogLook(opts).sprite : null]);
  const care = careDone; careDone = null;
  if (key !== sceneKey || !scene.firstChild) {
    if (stopAnim) { stopAnim(); stopAnim = null; }
    if (stopTv) { stopTv = null; }
    sceneKey = key;
    const room = renderRoom(document, opts);
    scene.replaceChildren(room);
    roomInteractions.attach(room, opts, { owned: placements !== null, lifeId, embedded: window.parent !== window });
    if (opts.rare === 'ufo' && !reduceMotion()) stopAnim = playRareVisitor(room);
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
  renderAlbum(v);
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
function openDiary() {
  diaryOpen = true;
  // Dear Diary (7 different days) and Snoop (3 AM) are counted by the server
  if (life && backend) backend.rpc('gry_pepegochi_diary_open', { p_tz_min: tz() }).catch(() => {});
  render();
  const pad = $('pgb-diary');
  if (pad) { pad.scrollIntoView({ block: 'start' }); pad.focus({ preventScroll: true }); }
}
async function savePage(i) {
  const pg = myDiary().pages.slice().reverse()[i];
  if (!pg) return;
  try { saveCanvas(document, await drawDiaryPage(document, pg), 'pepegochi-diary-day-' + pg.day + '.png'); } catch { game.message = 'The picture could not be made.'; render(); }
}
async function savePostcard() {
  if (!postcard) return;
  try { saveCanvas(document, await drawPostcard(document, { place: postcard.place, souvenir: postcard.souvenir, name: game.last?.pet?.name || '' }), 'pepegochi-postcard-' + postcard.place + '.png'); }
  catch { game.message = 'The picture could not be made.'; render(); }
}
$('pgb-trips')?.addEventListener('click', e => {
  const b = e.target.closest('[data-postcard]');
  if (!b) return;
  postcard = { place: b.dataset.postcard, souvenir: null, fresh: false }; render();
  $('pgb-postcard')?.scrollIntoView({ block: 'start' });
});
$('pgb-scene').addEventListener('click', e => { if (e.target.closest('[data-letter]')) openLetter(); else if (e.target.closest('[data-notes]')) openNotes(); else if (e.target.closest('[data-diary]')) openDiary(); });
// a new note written by the frog on the taskbar (another document of this site) shows up on the table at once
window.addEventListener('storage', e => { if (e.key && /^pepegochi:(notes|diary):/.test(e.key) && game.last && !game.busy) render(); });
$('pgb-body').addEventListener('click', e => {
  const t = e.target.closest('button');
  if (!t || game.busy) return;
  if (t.dataset.claim) { claimTrip(); return; }
  if (t.dataset.closePostcard) { postcard = null; render(); return; }
  if (t.dataset.savePostcard) { savePostcard(); return; }
  if (t.dataset.savePage) { savePage(Number(t.dataset.savePage)); return; }
  if (t.dataset.act) runCare(t.dataset.act);
  else if (t.dataset.letter) openLetter();
  else if (t.dataset.closeLetter) { game.closeLetter(); render(); }
  else if (t.dataset.closeNotes) { notesOpen = false; render(); }
  else if (t.dataset.closeDiary) { diaryOpen = false; render(); }
  else if (t.dataset.signin) backend.discord().catch(err => { game.message = err.message; render(); });
});
$('pgb-body').addEventListener('submit', e => {
  if (e.target.closest('[data-trip]')) { e.preventDefault(); startTrip($('pgb-trip-len').value, $('pgb-trip-pack').value); return; }
  if (!e.target.closest('[data-adopt]')) return;
  e.preventDefault();
  if (!game.busy) run(game.adopt($('pgb-name').value));
});
// the needs move on by themselves: redraw every minute, and read the server again after a long break
setInterval(() => { if (game.last && !game.busy) render(); }, 6e4);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && game.stale && !game.busy) run(game.refresh()).then(loadLife).then(render); });
// A care action can also start from the taskbar conversation. The parent sends no pet data; this authenticated
// iframe re-reads its own full state once so an already-open room never shows stale needs or growth.
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== window.parent || event.data?.type !== 'pondos:pepegochi-refresh') return;
  if (backend && !game.busy) run(game.refresh()).then(loadLife).then(render);
});

(async () => {
  render();
  try { backend = await getBackend(); } catch (e) { game.error = e.message; render(); return; }
  if (!backend.session || !backend.session() || backend.session().user.is_anonymous) { game.signin = true; render(); return; }
  await run(game.refresh());
  await loadLife(); render();
  loadMapNotes();
})();
