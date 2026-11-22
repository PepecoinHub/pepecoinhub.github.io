// PEPEGOCHI.EXE hidden-beta window (PR B2): draws BetaGame (pepegochi-beta-view.mjs) into
// docs/games/pepegochi.html, which PondOS opens in a window for ?beta=gochi testers.
// LOCAL TEST ONLY: the page CSP has connect-src 'none', so no request can leave it. No Supabase,
// no Passport, no stamps. The test frog is kept in this tab's sessionStorage only.
import { BetaGame, TIME_STEPS } from './pepegochi-beta-view.mjs';
import { renderRoom, playDeparture, playFrames, careFrames, animationFramesForStage, HATCH_FRAMES, HATCH_MS, CARE_MS, versionSprite } from './pepegochi-room.mjs?v=20261122life';
import { createRoomInteractions } from './pepegochi-room-interactions.mjs?v=20261122life';
import { renderCarePanel } from './pepegochi-care-ui.mjs?v=20261121compact';

const $ = id => document.getElementById(id);
const el = (tag, attrs = {}, text = null) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) n.setAttribute(k, v === true ? '' : v);
  if (text != null) n.textContent = text;
  return n;
};
const tabStorage = (() => { try { return window.sessionStorage; } catch (e) { return null; } })();
const game = new BetaGame({ storage: tabStorage });


function renderPet(box, p) {
  box.append(el('p', { class: 'pgb-status' }, p.statusText));
  for (const w of p.warnings) box.append(el('p', { class: 'pgb-warn' }, w));
  if (p.recovery) box.append(el('p', { class: 'pgb-warn pgb-recovery' }, p.recovery));
  box.append(...renderCarePanel(document, p, { testShortcut: true }));
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
let shown = null, stopAnim = null;
const preloaded = new Set();
const interactions = createRoomInteractions({getView:()=>game.view(),isBusy:()=>false,care:kind=>act(kind),openTV:()=>{},reduced:reduceMotion});
function renderScene(v, care) {
  if (stopAnim) { stopAnim(); stopAnim = null; }
  const scene = $('pgb-scene'), title = $('pgb-scene-title');
  let opts;
  if (v.mode === 'adopt') { title.textContent = 'Your room'; opts = { mode: 'adopt' }; }
  else if (v.mode === 'departed') {
    title.textContent = `${v.departed.name} · moved out`;
    opts = { mode: 'departed', letterSeen: v.departed.letterSeen };
  } else {
    title.textContent = v.pet.title;
    opts = { mode: 'pet', status: v.pet.status, stage: v.pet.stage, needs: v.pet.needs };
  }
  const stage=opts.mode==='pet'?opts.stage:opts.mode==='adopt'?'egg':null;
  if(stage&&!preloaded.has(stage)){preloaded.add(stage);animationFramesForStage(stage).forEach(src=>{const i=new Image();i.src=versionSprite(src)});}
  const room=renderRoom(document,opts);
  scene.replaceChildren(room);
  interactions.attach(room,opts,{owned:true,lifeId:game.last?.pet?.life_id,embedded:false});
  if (v.mode === 'departed' && shown && shown.mode === 'pet' && !reduceMotion()) stopAnim = playDeparture(room, shown.stage);
  if (!reduceMotion() && v.mode==='pet') {
    if(shown?.stage==='egg'&&stage==='tadpole') stopAnim=playFrames(room.querySelector('.pgr-pet'),HATCH_FRAMES,HATCH_MS);
    else if(care) stopAnim=playFrames(room.querySelector('.pgr-pet'),careFrames(stage,care),CARE_MS);
  }
  shown = { mode: v.mode, stage: v.pet?.stage };
}

function render(care) {
  const v = game.view();
  renderScene(v,care);
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
$('pgb-reset').addEventListener('click', () => { interactions.dispose(); shown=null; game.reset(); render(); });

function openLetter() {
  game.readLetter();
  render();
  const pad = $('pgb-notepad');   // the letter opens below the room: show its first line, also on a phone
  if (pad) { pad.scrollIntoView({ block: 'start' }); pad.focus({ preventScroll: true }); }
}

// the frog
function act(kind) {
  const r=game.act(kind);
  render(r.ok&&r.value.action_result==='accepted'?kind:null);
}
$('pgb-scene').addEventListener('click', e => { if (e.target.closest('[data-letter]')) openLetter(); });
$('pgb-body').addEventListener('click', e => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.act) { act(t.dataset.act); return; }
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
