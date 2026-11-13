// PEPEGOCHI.EXE, the real game (docs/games/pepegochi-live.html): draws LiveGame (pepegochi-live-view.mjs).
// The frog lives on the server (games/supabase/update_pepegochi_v2.sql), one per Discord account.
// PondOS opens this page in a window; it also works on its own.
import { getBackend } from './backend.js?v=20261113link';
import { LiveGame } from './pepegochi-live-view.mjs';
import { renderRoom, playDeparture, DEPART_FRAMES } from './pepegochi-room.mjs';

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

function renderPet(box, p) {
  box.append(el('p', { class: 'pgb-status' }, p.statusText));
  for (const w of p.warnings) box.append(el('p', { class: 'pgb-warn' }, w));
  if (p.recovery) box.append(el('p', { class: 'pgb-warn pgb-recovery' }, p.recovery));
  const needs = el('div', { class: 'pgb-needs' });
  p.needs.forEach(n => needs.append(meter(n)));
  box.append(needs);
  const acts = el('div', { class: 'pgb-row pgb-actions' });
  for (const a of p.actions) {
    acts.append(el('button', { type: 'button', class: 'btn', 'data-act': a.kind, disabled: !a.enabled || game.busy, title: a.reason || a.label },
      a.label + (a.reason ? ` (${a.reason})` : '')));
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
const HATCH = [1, 2, 3].map(n => 'img/pepegochi/pepegochi_hatch_0' + n + '.png');
function playHatch(room) {
  const img = [...room.querySelectorAll('img')].find(i => /pepegochi_tadpole_idle/.test(i.getAttribute('src') || ''));
  if (!img) return null;
  const final = img.getAttribute('src'), timers = [];
  HATCH.forEach((src, k) => timers.push(setTimeout(() => img.setAttribute('src', src), k * 450)));
  timers.push(setTimeout(() => img.setAttribute('src', final), HATCH.length * 450));
  img.setAttribute('src', HATCH[0]);
  return () => { timers.forEach(clearTimeout); img.setAttribute('src', final); };
}
let shown = null, stopAnim = null, preloaded = false;
function renderScene(v) {
  if (stopAnim) { stopAnim(); stopAnim = null; }
  const scene = $('pgb-scene'), title = $('pgb-scene-title');
  let room;
  if (v.mode === 'pet') {
    title.textContent = v.pet.title;
    room = renderRoom(document, { mode: 'pet', status: v.pet.status, stage: v.pet.stage, needs: v.pet.needs, ...(game.placements() ? { placements: game.placements() } : {}) });
    if (!preloaded) { preloaded = true; DEPART_FRAMES.forEach(src => { const i = new Image(); i.src = src; }); }
  } else if (v.mode === 'departed') {
    title.textContent = `${v.departed.name} · moved out`;
    room = renderRoom(document, { mode: 'departed', letterSeen: v.departed.letterSeen, ...(game.placements() ? { placements: game.placements() } : {}) });
  } else { title.textContent = 'Your room'; room = renderRoom(document, { mode: 'adopt' }); }
  scene.replaceChildren(room);
  if (v.mode === 'departed' && shown && shown.mode === 'pet' && !reduceMotion()) stopAnim = playDeparture(room, shown.stage);
  // the egg hatches: three cracking frames, then the tadpole (sprite pack 2026-11-09)
  if (v.mode === 'pet' && v.pet.stage === 'tadpole' && shown && shown.stage === 'egg' && !reduceMotion()) stopAnim = playHatch(room);
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

// Decorate: every decoration the account owns, where it stands, and the places it fits (only with a frog at home)
function renderDecor(v) {
  const box = $('pgb-decor'), card = $('pgb-decor-card');
  const list = v.mode === 'pet' ? game.decor() : null;
  card.hidden = !list;
  if (!list) return;
  box.replaceChildren();
  if (game.roomError) box.append(el('p', { class: 'pgb-warn' }, game.roomError));
  const ul = el('ul', { class: 'pgb-decor' });
  for (const it of list) {
    const li = el('li', { class: 'pgb-decor-item' });
    li.append(el('img', { src: 'img/pepegochi/' + it.item + '.png', alt: '', width: 48, height: 48 }),
      el('b', {}, it.name), el('small', { class: 'muted' }, it.slotLabel));
    const sel = el('select', { 'aria-label': 'Where to put ' + it.name, 'data-item': it.id });
    sel.append(el('option', { value: '' }, it.slot ? 'Move to…' : 'Put on…'));
    it.fits.filter(f => f.id !== it.slot).forEach(f => sel.append(el('option', { value: f.id }, f.label)));
    li.append(sel);
    if (it.slot) li.append(el('button', { type: 'button', class: 'btn', 'data-unplace': it.slot }, 'Put away'));
    ul.append(li);
  }
  box.append(ul, el('p', { class: 'small muted' }, 'Decorations you earn with Passport stamps show up here. Three earned decorations in the room at once: Pond Decorator.'));
}

async function run(p) { render(); await p; if (game.last && game.last.pet && !game.room) await game.loadRoom(); render(); }

async function openLetter() {
  await run(game.readLetter());
  const pad = $('pgb-notepad');
  if (pad) { pad.scrollIntoView({ block: 'start' }); pad.focus({ preventScroll: true }); }
}

$('pgb-scene').addEventListener('click', e => { if (e.target.closest('[data-letter]')) openLetter(); });
$('pgb-body').addEventListener('click', e => {
  const t = e.target.closest('button');
  if (!t || game.busy) return;
  if (t.dataset.act) run(game.act(t.dataset.act));
  else if (t.dataset.letter) openLetter();
  else if (t.dataset.closeLetter) { game.closeLetter(); render(); }
  else if (t.dataset.signin) backend.discord().catch(err => { game.message = err.message; render(); });
});
$('pgb-decor').addEventListener('change', e => {
  const s = e.target.closest('select[data-item]');
  if (s && s.value && !game.busy) run(game.place(s.dataset.item, s.value));
});
$('pgb-decor').addEventListener('click', e => {
  const b = e.target.closest('[data-unplace]');
  if (b && !game.busy) run(game.unplace(b.dataset.unplace));
});
$('pgb-body').addEventListener('submit', e => {
  if (!e.target.closest('[data-adopt]')) return;
  e.preventDefault();
  if (!game.busy) run(game.adopt($('pgb-name').value));
});
// the needs move on by themselves: redraw every minute, and read the server again after a long break
setInterval(() => { if (game.last && !game.busy) render(); }, 6e4);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && game.stale && !game.busy) run(game.refresh()); });

(async () => {
  render();
  try { backend = await getBackend(); } catch (e) { game.error = e.message; render(); return; }
  if (!backend.session || !backend.session() || backend.session().user.is_anonymous) { game.signin = true; render(); return; }
  await run(game.refresh());
})();
