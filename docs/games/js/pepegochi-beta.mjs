// PEPEGOCHI.EXE hidden-beta window (PR B2): draws BetaGame (pepegochi-beta-view.mjs) into
// docs/games/pepegochi.html, which PondOS opens in a window for ?beta=gochi testers.
// LOCAL TEST ONLY: the page CSP has connect-src 'none', so no request can leave it. No Supabase,
// no Passport, no stamps. The test frog is kept in this tab's sessionStorage only.
import { BetaGame, TIME_STEPS } from './pepegochi-beta-view.mjs';
import { renderRoom, playDeparture, DEPART_FRAMES } from './pepegochi-room.mjs';

const $ = id => document.getElementById(id);
const el = (tag, attrs = {}, text = null) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) n.setAttribute(k, v === true ? '' : v);
  if (text != null) n.textContent = text;
  return n;
};
const tabStorage = (() => { try { return window.sessionStorage; } catch (e) { return null; } })();
const game = new BetaGame({ storage: tabStorage });

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
    const b = el('button', { type: 'button', class: 'btn', 'data-act': a.kind, disabled: !a.enabled, title: a.reason || a.label },
      a.label + (a.reason ? ` (${a.reason})` : ''));
    acts.append(b);
  }
  const all = el('button', { type: 'button', class: 'btn', 'data-all': '1' }, 'Everything it needs (test shortcut)');
  acts.append(all);
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
    const close = el('button', { type: 'button', class: 'btn', 'data-close-letter': '1' }, 'Close');
    pad.append(close);
    box.append(pad);
  }
  box.append(adoptForm(d.canAdopt ? 'Adopt a New Fren' : 'Adopt a New Fren (read the letter first)', 'Fren II'));
  const past = el('button', { type: 'button', class: 'btn', 'data-past': '1' }, 'View Past Frens');
  box.append(past);
}

function adoptForm(label, value) {
  const f = el('form', { class: 'pgb-row pgb-adopt', 'data-adopt': '1' });
  f.append(el('label', { for: 'pgb-name' }, 'Name'), el('input', { type: 'text', id: 'pgb-name', value, maxlength: 64, autocomplete: 'off' }),
    el('button', { type: 'submit', class: 'btn primary' }, label));
  return f;
}

// the room (pepegochi-room.mjs). The moving-out frames play once, when a frog that was on screen moves
// out (after a time jump or an action); a frog that had already left is simply gone.
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let shown = null, stopAnim = null, preloaded = false;
function renderScene(v) {
  if (stopAnim) { stopAnim(); stopAnim = null; }
  const scene = $('pgb-scene'), title = $('pgb-scene-title');
  let room;
  if (v.mode === 'adopt') { title.textContent = 'Your room'; room = renderRoom(document, { mode: 'adopt' }); }
  else if (v.mode === 'departed') {
    title.textContent = `${v.departed.name} · moved out`;
    room = renderRoom(document, { mode: 'departed', letterSeen: v.departed.letterSeen });
  } else {
    title.textContent = v.pet.title;
    room = renderRoom(document, { mode: 'pet', status: v.pet.status, stage: v.pet.stage, needs: v.pet.needs });
    if (!preloaded) { preloaded = true; DEPART_FRAMES.forEach(src => { const i = new Image(); i.src = src; }); }
  }
  scene.replaceChildren(room);
  if (v.mode === 'departed' && shown && shown.mode === 'pet' && !reduceMotion()) stopAnim = playDeparture(room, shown.stage);
  shown = { mode: v.mode, stage: v.pet?.stage };
}

function render() {
  const v = game.view();
  renderScene(v);
  $('pgb-clock').textContent = v.clock.text;
  $('pgb-day').textContent = `(test day ${v.clock.day})`;
  $('pgb-msg').textContent = v.message;
  const box = $('pgb-body');
  box.replaceChildren();
  if (v.mode === 'adopt') {
    box.append(el('p', { class: 'pgb-title' }, v.adopt.title), el('p', {}, v.adopt.text), adoptForm('Adopt Fren', 'Fren'));
  } else if (v.mode === 'departed') renderDeparted(box, v);
  else renderPet(box, v.pet);
  const rules = $('pgb-rules'); rules.replaceChildren(); v.rules.forEach(x => rules.append(el('li', {}, x)));
  const past = $('pgb-past'); past.replaceChildren();
  if (!v.history.length) past.append(el('p', { class: 'muted' }, 'None yet.'));
  else { const ul = el('ul', { class: 'pgb-list' }); v.history.forEach(h => ul.append(el('li', {}, h.text))); past.append(ul); }
  past.append(el('p', { class: 'small' }, `Former frens: ${v.summary.former_frens}. Longest friendship: ${v.summary.longest_friendship_days} days.`));
  const log = $('pgb-log'); log.replaceChildren(); v.log.forEach(x => log.append(el('li', {}, x)));
}

// time machine
const steps = $('pgb-steps');
for (const [label, ms] of TIME_STEPS) steps.append(el('button', { type: 'button', class: 'btn', 'data-ms': ms }, label));
steps.addEventListener('click', e => { const b = e.target.closest('[data-ms]'); if (b) { game.advance(Number(b.dataset.ms)); render(); } });
$('pgb-hours').addEventListener('submit', e => {
  e.preventDefault();
  const h = Number($('pgb-h').value);
  if (h > 0 && h <= 400) { game.advance(h * 36e5); render(); }
});
$('pgb-sat').addEventListener('click', () => { game.nextWeekday(6, 18); render(); });
$('pgb-sun').addEventListener('click', () => { game.nextWeekday(0, 18); render(); });
$('pgb-reset').addEventListener('click', () => { game.reset(); render(); });

function openLetter() {
  game.readLetter();
  render();
  const pad = $('pgb-notepad');   // the letter opens below the room: show its first line, also on a phone
  if (pad) { pad.scrollIntoView({ block: 'start' }); pad.focus({ preventScroll: true }); }
}

// the frog
$('pgb-scene').addEventListener('click', e => { if (e.target.closest('[data-letter]')) openLetter(); });
$('pgb-body').addEventListener('click', e => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.act) game.act(t.dataset.act);
  else if (t.dataset.all) game.careAll();
  else if (t.dataset.letter) { openLetter(); return; }
  else if (t.dataset.closeLetter) game.closeLetter();
  else if (t.dataset.past) { $('pgb-past-h').scrollIntoView({ block: 'start' }); return; }
  else return;
  render();
});
$('pgb-body').addEventListener('submit', e => {
  if (!e.target.closest('[data-adopt]')) return;
  e.preventDefault();
  game.adopt($('pgb-name').value);
  render();
});

render();
