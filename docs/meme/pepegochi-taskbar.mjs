import { TOYS } from './pepegochi-personality.mjs?v=20261116sass1';
import { createArcadeObserver } from './pepegochi-arcade.mjs?v=20261116sass1';
// PepeGochi taskbar companion for PondOS. Read-only: the server remains the only source of pet state.
// Loaded only behind the existing ?beta=gochi gate. Local conversations are cosmetic; no polling, rewards or fake pet.
// Based on PR #299; adds the Pond Quiz (one server question a day once the frog has hatched; update_pond_quiz.sql)
// and the hop out of the PEPEGOCHI.EXE window.
import { frogLook, LOOK_BELOW } from '../games/js/pepegochi-room.mjs?v=20261116room1';
import { dayNumber, remark } from './pepegochi-facts.mjs';
import { mountFrogInteractions } from './pepegochi-interactions.mjs?v=20261118case1';
import { createCaseClient } from './pepegochi-case-files.mjs?v=20261118case1';
import { createRumorReader } from './pepegochi-rumors.mjs?v=20261118rumors1';
import { mountDesktopCompanion } from './pepegochi-desktop.mjs?v=20261118dialog1';

import { createBond } from './pepegochi-bond.mjs?v=20261116sass1';

import { EXPRESSIONS, expressionFrames, expressionFor } from './pepegochi-expressions.mjs?v=20261118desktop1';

const VALID_STAGE = new Set(['egg', 'tadpole', 'froglet', 'adult']);
const NEEDS = new Set(['hunger', 'hygiene', 'mood', 'energy']);
const STATUS = new Set(['healthy', 'neglected', 'packing', 'recovering']);

// The 16 taskbar poses (48 x 48, drawn for the bar; approved by the owner 2026-11-13), in img/pepegochi/taskbar/.
export const POSES = ['tb_egg', 'tb_tadpole', 'tb_froglet', 'tb_adult_sit', 'tb_adult_hungry', 'tb_adult_dirty',
  'tb_adult_moody', 'tb_adult_sleepy', 'tb_adult_neglected', 'tb_adult_packing', 'tb_adult_recovering',
  'tb_adult_talk', 'tb_adult_think', 'tb_adult_laugh', 'tb_adult_wave', 'tb_letter'];
export const pose = id => 'taskbar/' + id + '.png';
// bumped when a pose file is redrawn under the same name, so browsers do not keep the old picture
export const POSE_VERSION = '20261113stand';
// The 9 short animations (A3, 33 frames in img/pepegochi/taskbar/anim/, approved 2026-11-13). Each one is drawn from
// one pose and is played only while the frog shows that pose; otherwise the old whole-pixel CSS move is used.
export const ANIMS = {
  wobble: { base: 'tb_egg', frames: 4, ms: 150 },
  bob: { base: 'tb_adult_sit', frames: 2, ms: 400 },
  peek: { base: 'tb_adult_sit', frames: 4, ms: 250 },
  hop: { base: 'tb_adult_sit', frames: 5, ms: 110 },
  shuffle: { base: 'tb_adult_sit', frames: 4, ms: 160 },
  greet: { base: 'tb_adult_sit', frames: 4, ms: 180 },
  nod: { base: 'tb_adult_sleepy', frames: 4, ms: 300 },
  slouch: { base: 'tb_adult_neglected', frames: 3, ms: 300 },
  tremble: { base: 'tb_adult_packing', frames: 3, ms: 90 },
};
export const animFrames = name => Array.from({ length: ANIMS[name].frames },
  (_, i) => 'taskbar/anim/tb_' + name + '_0' + (i + 1) + '.png');
// the room's sprite for the frog's state (frogLook) -> the taskbar pose that shows the same state
const POSE_OF = { egg_idle: 'tb_egg', tadpole_idle: 'tb_tadpole', froglet_idle: 'tb_froglet', adult_idle: 'tb_adult_sit',
  adult_hungry: 'tb_adult_hungry', adult_dirty: 'tb_adult_dirty', adult_moody: 'tb_adult_moody', adult_tired: 'tb_adult_sleepy',
  adult_neglected: 'tb_adult_neglected', adult_packing: 'tb_adult_packing', adult_recovering: 'tb_adult_recovering' };
// a young frog has no state poses: its stage pose
export const poseFor = roomSprite => POSE_OF[roomSprite] || POSE_OF[roomSprite.split('_')[0] + '_idle'] || 'tb_adult_sit';

export function describeTaskbarFrog(state) {
  const p = state && state.pet;
  if (!p) return {
    sprite: pose('tb_egg'), label: 'Adopt me?',
    title: 'No PepeGochi yet. Click to adopt your egg.', warning: false, hasPet: false, motion: 'egg',
  };
  if (p.status === 'departed') return {
    sprite: pose('tb_letter'), label: 'GOODBYE.TXT',
    title: 'Your Fren moved out. Open PEPEGOCHI.EXE to read the letter.',
    warning: true, hasPet: false, motion: 'letter',
  };
  const stage = VALID_STAGE.has(p.stage) ? p.stage : 'adult';
  const status = STATUS.has(p.status) ? p.status : 'healthy';
  const needs = Object.entries(p.needs || {})
    .filter(([need, val]) => NEEDS.has(need) && Number.isFinite(Number(val)))
    .map(([need, val]) => ({ need, value: Number(val) }));
  const sprite = frogLook({ stage, status, needs }).sprite;
  const low = needs.filter(n => n.value < LOOK_BELOW).sort((a,b) => a.value-b.value)[0];
  const name = String(p.name || 'Your Fren').slice(0, 18);
  const remarks = {
    healthy: 'Your Fren is here.',
    neglected: 'Your Fren misses you.',
    packing: 'Your Fren is packing a suitcase!',
    recovering: 'Your Fren is recovering.',
  };
  return {
    careDays: Math.max(0, Math.trunc(Number(p.care_days) || 0)),
    sprite: pose(poseFor(sprite)), label: name, adult: stage === 'adult',
    playReady: stage !== 'egg' && status === 'healthy' && needs.length === NEEDS.size && !low,
    needAttention: low?.need || null,
    title: name + ' · ' + remarks[status] + ' Click to talk, double-click to visit.',
    warning: status === 'packing' || status === 'neglected', hasPet: true,
    motion: status !== 'healthy' ? status : (sprite === 'adult_tired' ? 'sleepy' : stage),
  };
}
// shown when the state cannot be read (no SQL yet, offline): the egg, no claim about a frog
export const UNAVAILABLE = { sprite: pose('tb_egg'), label: 'PepeGochi',
  title: 'PepeGochi is unavailable right now. Click to open the game.', warning: false, hasPet: false, motion: 'egg' };

// The flight path of the hop from the game window to the taskbar: whole pixels, an arc, ending on the slot.
export function hopPath(from, to, steps = 36) {
  const pts = [];
  const lift = Math.min(120, Math.max(40, Math.abs(to.y - from.y) / 3));
  for (let i = 0; i <= steps; i++) {
    const k = i / steps;
    pts.push({ x: Math.round(from.x + (to.x - from.x) * k), y: Math.round(from.y + (to.y - from.y) * k - lift * 4 * k * (1 - k)) });
  }
  return pts;
}

// One state read on entry, then only when the tab returns after a break, auth changes,
// or the PEPEGOCHI.EXE iframe signals that a player action succeeded.
export function mountTaskbarFrog({ bar, open, session, rpc, base = '../', now = () => Date.now(), rumorsEnabled = true, openPassport, onCaseComplete = () => {} }) {
  const start = bar && bar.querySelector('.start');
  if (!start) return () => {};
  let storage;
  try { storage = window.localStorage; } catch {}
  const bond = createBond({ storage, now });
  const arcade = createArcadeObserver();
  const rumors = createRumorReader({ session, rpc, now });
  const caseClient = createCaseClient({ session, rpc });
  let disposed = false, lastLife = null;
  let desktop = null;
  const img_base = base + 'games/img/pepegochi/';

  const slot = document.createElement('span');
  slot.className = 'pg-companion';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pg-companion-button';
  const img = document.createElement('img');
  img.alt = '';
  img.width = 48;
  img.height = 48;
  img.draggable = false;
  const notice = document.createElement('span');
  notice.className = 'pg-companion-alert';
  notice.setAttribute('aria-hidden', 'true');
  const sleep = document.createElement('span');
  sleep.className = 'pg-companion-sleep';
  sleep.textContent = 'z';
  sleep.setAttribute('aria-hidden', 'true');
  sleep.hidden = true;
  const hint = document.createElement('span');
  hint.className = 'pg-companion-hint';
  hint.setAttribute('aria-hidden', 'true');
  button.append(img, notice, sleep, hint);
  // the fact of the day: a small "?" next to the frog, only while today's fact is unanswered. It never opens by itself.
  const factBtn = document.createElement('button');
  factBtn.type = 'button';
  factBtn.className = 'pg-companion-fact';
  factBtn.textContent = '?';
  factBtn.title = 'Did you know? A Pepecoin fact from your frog';
  factBtn.setAttribute('aria-label', 'Fact of the day from your PepeGochi');
  factBtn.hidden = true;
  slot.append(button, factBtn);
  start.after(slot);
  let toyTimer = null;
  const toy = document.createElement('span'); toy.className = 'pg-companion-toy';
  toy.setAttribute('aria-hidden', 'true'); toy.hidden = true; slot.append(toy);
  function clearToy() { clearTimeout(toyTimer); toyTimer = null; toy.hidden = true; toy.classList.remove('is-tossed'); }
  function showToy(id) {
    if (!Object.hasOwn(TOYS, id)) return;
    clearToy(); toy.replaceChildren(); toy.dataset.toy = id;
    if (id === 'duck') {
      const duck = document.createElement('img'); duck.src = img_base + 'rubber_duck.png'; duck.alt = ''; duck.width = duck.height = 28; toy.append(duck);
    }
    toy.hidden = false;
    void toy.offsetWidth; toy.classList.add('is-tossed');
    toyTimer = setTimeout(clearToy, 1800);
  }
  // the frog sits ON the taskbar: measure how far the button is below the bar's top edge (CSS --pg-lift)
  const edgeOf = bar.closest('header') || bar;
  function place() {
    const lift = Math.max(0, Math.round(button.getBoundingClientRect().top - edgeOf.getBoundingClientRect().top));
    slot.style.setProperty('--pg-lift', lift + 'px');
  }
  place();
  requestAnimationFrame(place);
  window.addEventListener('resize', place);
  let lastCurious = -Infinity;
  button.addEventListener('pointerenter', () => {
    if (desktop?.active) return;
    if (!act && !EXPRESSIONS[movement] && now() - lastCurious > 12000 && expressionFor(shownView, 'hover')) {
      lastCurious = now(); if (animateExpression('hover')) return;
    }
    if (!act && shownView?.sprite === pose('tb_adult_sit')) { cancelMotion(); setAct('tb_adult_wave'); }
  });
  button.addEventListener('pointerleave', () => { if (act === 'tb_adult_wave') { setAct(null); queueMotion(); } });

  // Very short motions, not an endlessly looping animation. Only one is active at a time,
  // and no animation or running timer is needed when the browser is hidden / reduced motion is set.
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const motions = {
    egg: ['wobble', 'bob'], tadpole: ['bob', 'peek'], froglet: ['hop', 'peek', 'shuffle'],
    adult: ['hop', 'peek', 'shuffle', 'greet', 'bob'], sleepy: ['nod', 'yawn', 'bob'],
    neglected: ['slouch', 'peek'], packing: ['tremble', 'shuffle'],
    recovering: ['nod', 'bob'], letter: [],
  };
  let currentMood = 'egg', movement = null, motionTimer = null, restoreTimer = null;
  let frameTimer = null;
  function cancelMotion() {
    expressionTicket++;
    if (motionTimer) clearTimeout(motionTimer);
    if (restoreTimer) clearTimeout(restoreTimer);
    if (frameTimer) clearTimeout(frameTimer);
    motionTimer = restoreTimer = frameTimer = null;
    if (movement) button.classList.remove('pg-motion-' + movement);
    if (movement && shownView) paint(shownView);   // back to the state pose after a frame animation
    movement = null;
  }
  // the frog shows exactly this pose right now (no talking/waving pose over it)
  const showing = id => !act && shownView && shownView.sprite === pose(id);
  function playMotion(name) {
    if (movement) button.classList.remove('pg-motion-' + movement);
    movement = name;
    const a = ANIMS[name] || EXPRESSIONS[name];
    if (name === 'welcome') button.classList.add('pg-motion-welcome');
    if (a && showing(a.base)) {
      // the drawn frames, then the state pose again
      const frames = EXPRESSIONS[name] ? expressionFrames(name) : animFrames(name);
      let i = 0;
      const step = () => {
        if (reduced.matches || document.visibilityState !== 'visible' || !slot.isConnected || !showing(a.base)) { cancelMotion(); return; }
        if (i < frames.length) { img.setAttribute('src', img_base + frames[i++] + '?v=' + POSE_VERSION); frameTimer = setTimeout(step, a.ms); }
        else { frameTimer = null; paint(shownView); restoreTimer = setTimeout(queueMotion, 50); }
      };
      step();
      return;
    }
    button.classList.add('pg-motion-' + movement);
    restoreTimer = setTimeout(queueMotion, 1050);
  }
  // load the frames of the next animation while waiting, so it never flickers
  const preloaded = new Set();
  function preload(name) {
    if ((!ANIMS[name] && !EXPRESSIONS[name]) || preloaded.has(name)) return;
    preloaded.add(name);
    for (const f of (EXPRESSIONS[name] ? expressionFrames(name) : animFrames(name))) { const i = new Image(); i.src = img_base + f + '?v=' + POSE_VERSION; }
  }
  let expressionTicket = 0;
  function animateExpression(action) {
    const name = expressionFor(shownView, action);
    if (!name || reduced.matches || document.visibilityState !== 'visible' || !slot.isConnected) return false;
    cancelMotion(); setAct(null);
    const ticket = ++expressionTicket;
    const life = lastLife;
    Promise.all([...new Set(expressionFrames(name))].map(f => new Promise(resolve => {
      const frame = new Image(); frame.onload = () => resolve(true); frame.onerror = () => resolve(false);
      frame.src = img_base + f + '?v=' + POSE_VERSION;
    }))).then(loaded => {
      if (ticket !== expressionTicket || disposed || life !== lastLife || reduced.matches ||
          document.visibilityState !== 'visible' || !slot.isConnected || expressionFor(shownView, action) !== name) return;
      if (loaded.every(Boolean)) playMotion(name); else queueMotion();
    });
    return true;
  }
  function queueMotion() {
    cancelMotion();
    if (act || desktop?.active || reduced.matches || document.visibilityState !== 'visible' || !slot.isConnected || disposed) return;
    const choices = motions[currentMood] || motions.adult;
    if (!choices.length) return;
    const next = choices[Math.floor(Math.random() * choices.length)];
    const nextAnim = ANIMS[next] || EXPRESSIONS[next];
    if (shownView && nextAnim && showing(nextAnim.base)) preload(next);
    motionTimer = setTimeout(() => {
      motionTimer = null;
      if (reduced.matches || document.visibilityState !== 'visible' || !slot.isConnected) return;
      if (conversation?.invite()) return;
      if (desktop?.ambient()) return;
      playMotion(next);
    }, 13000 + Math.floor(Math.random() * 20000));
  }
  const motionPreferenceChanged = () => queueMotion();
  if (reduced.addEventListener) reduced.addEventListener('change', motionPreferenceChanged);

  let shownView = null;
  // a short pose over the state pose: talking, thinking, laughing, waving (adults only; null = the state pose)
  let act = null;
  function setAct(a) { act = a; if (shownView) paint(shownView); }
  function paint(view) {
    shownView = view;
    // A new server state must immediately displace a stale laugh/talk pose.
    const expressive = view.adult && view.sprite === pose('tb_adult_sit');
    const path = img_base + (act && expressive ? pose(act) : view.sprite) + '?v=' + POSE_VERSION;
    if (img.getAttribute('src') !== path) img.setAttribute('src', path);
    button.setAttribute('aria-label', view.title);
    button.title = view.title;
    hint.textContent = view.label;
    notice.hidden = !view.warning;
    slot.classList.toggle('pg-companion-empty', !view.hasPet);
    sleep.hidden = view.motion !== 'sleepy';
    if (currentMood !== view.motion) { currentMood = view.motion; queueMotion(); }
  }
  paint(describeTaskbarFrog(null));

  // ---------- Pond Quiz: the frog's question of the day ----------
  // Only from the server (update_pond_quiz.sql): the questions and answers are not in the site's files. The server
  // picks the question from the account's own pool and keeps the points; it answers only for a Discord account whose
  // PepeGochi has hatched, so the browser does not even ask before that.
  let balloon = null, server = null, hatched = false, conversation = null, quizIntent = 0;
  const today = () => dayNumber(now());
  const signedIn = () => { const a = session(); return !!(a && a.discord && a.userId); };
  let serverAt = 0, serverUser = null;
  const todayText = () => new Date(today() * 864e5).toISOString().slice(0, 10);
  async function loadServer(force = false) {
    if (!signedIn() || !hatched) { server = null; serverUser = null; return null; }
    const who = session().userId;
    // at most one read in 5 minutes, unless the day or the account changed (the same budget as the pet state)
    if (!force && who === serverUser && Date.now() - serverAt < 5 * 60 * 1000 && (!server || server.day === todayText())) return server;
    serverAt = Date.now(); serverUser = who;
    let got = null;
    try { got = await rpc('gry_quiz_today', {}); } catch (e) { got = null; }
    // an answer that arrives after the account changed belongs to the old account: drop it
    const now = session();
    if (!now || !now.discord || now.userId !== who) return null;
    if (disposed) return null;
    // the day is the server's UTC day: a wrong clock on this computer does not hide the question
    server = got;
    return server;
  }
  const current = () => (server && server.question ? server : null);
  function updateFactButton() {
    const f = current();
    factBtn.hidden = !f || f.answered;
  }
  function refreshFacts(force = false) { return loadServer(force).then(updateFactButton); }
  function closeBalloon() {
    if (!balloon) return;
    balloon.remove(); balloon = null;
    setAct(null);
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('pointerdown', onOutside, true);
    window.removeEventListener('resize', positionQuiz);
  }
  function onKey(e) { if (e.key === 'Escape') { closeBalloon(); factBtn.focus(); } }
  function onOutside(e) { if (balloon && !balloon.contains(e.target) && e.target !== factBtn) closeBalloon(); }
  function positionQuiz() {
    if (!balloon) return;
    const r = slot.getBoundingClientRect(), top = Math.min(r.top, img.getBoundingClientRect().top);
    balloon.style.bottom = Math.max(8, window.innerHeight - top + 6) + 'px';
    balloon.style.left = Math.max(8, Math.min(r.left, window.innerWidth - balloon.offsetWidth - 8)) + 'px';
    balloon.style.maxHeight = Math.max(80, top - 12) + 'px';
    balloon.style.overflowY = 'auto';
  }
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  async function showBoard(box) {
    box.replaceChildren(el('p', 'pg-fact-note', 'Loading the ranking…'));
    let b = null;
    try { b = await rpc('gry_quiz_board', {}); } catch (e) { b = null; }
    box.replaceChildren();
    if (!b) { box.append(el('p', 'pg-fact-note', 'The ranking cannot be read right now.')); return; }
    const ol = el('ol', 'pg-fact-board');
    for (const r of b.top) { const li = el('li'); li.append(el('span', null, r.rank + '. ' + r.nick), el('b', null, String(r.points))); ol.append(li); }
    box.append(b.top.length ? ol : el('p', 'pg-fact-note', 'No points yet. Be the first!'));
    if (b.me) box.append(el('p', 'pg-fact-note', b.me.rank ? `You: #${b.me.rank} with ${b.me.points}.` : 'You have no points yet.'));
  }
  function openBalloon() {
    if (balloon) { closeBalloon(); return; }
    let f = current();
    if (!f) return;
    balloon = el('div', 'pg-fact');
    balloon.setAttribute('role', 'dialog');
    balloon.setAttribute('aria-label', 'Did you know?');
    const head = el('div', 'pg-fact-bar');
    const x = el('button', 'pg-fact-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close');
    x.addEventListener('click', closeBalloon);
    head.append(el('b', null, 'Pond Quiz'), x);
    const list = el('div', 'pg-fact-answers');
    const out = el('p', 'pg-fact-out'); out.setAttribute('aria-live', 'polite');
    const extra = el('div', 'pg-fact-extra');
    const show = () => {
      setAct(f.right ? 'tb_adult_laugh' : 'tb_adult_think');
      [...list.children].forEach((b, i) => {
        b.disabled = true;
        b.classList.toggle('is-right', i === f.correct);
        b.classList.toggle('is-wrong', i === f.picked && !f.right);
      });
      const text = (f.right ? '' : 'The answer: ' + f.answers[f.correct] + '. ')
        + (f.right ? `+1 point. You have ${f.points}. ` : 'No point today: this one comes back another day. ');
      out.textContent = text + remark(!!f.right, today());
      if (f.source) {
        const a = el('a', null, 'Read more'); a.href = f.source; a.target = '_blank'; a.rel = 'noopener';
        out.append(' ', a);
      }
      const rk = el('button', 'pg-fact-a pg-fact-rank', 'Ranking'); rk.type = 'button';
      rk.addEventListener('click', () => showBoard(extra));
      extra.replaceChildren(rk);
    };
    let submitting = false;
    f.answers.forEach((ans, i) => {
      const b = el('button', 'pg-fact-a', ans); b.type = 'button';
      b.addEventListener('click', async () => {
        if (submitting || f.answered || b.disabled) return;
        submitting = true;
        [...list.children].forEach(x => { x.disabled = true; });
        b.classList.add('is-selected');
        out.textContent = 'Saving your answer…';
        const who = session()?.userId, ticket = quizIntent, target = balloon;
        try {
          const answer = await rpc('gry_quiz_answer', { p_choice: i });
          if (disposed || who !== session()?.userId || ticket !== quizIntent || target !== balloon) return;
          if (!answer || !answer.answered || !Array.isArray(answer.answers) || !Number.isInteger(answer.correct)) throw new Error('Invalid quiz result');
          server = answer; f = server;
          bond.remember(f.right ? 'quizWin' : 'quizMiss');
        }
        catch (e) { if (disposed || who !== session()?.userId || ticket !== quizIntent || target !== balloon) return; submitting = false; b.classList.remove('is-selected'); out.textContent = 'The answer could not be saved. Try again.'; [...list.children].forEach(x => { x.disabled = false; }); return; }
        b.classList.remove('is-selected');
        show(); updateFactButton();
      });
      list.append(b);
    });
    balloon.append(head, el('p', 'pg-fact-q', f.question), list, out, extra);
    setAct('tb_adult_talk');
    if (f.answered) show();
    document.body.append(balloon);
    // above the frog, inside the screen (also on a phone, where the taskbar has two rows)
    // the frog stands on the taskbar's edge: the balloon goes above its head, so the frog stays visible
    positionQuiz();
    window.addEventListener('resize', positionQuiz);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onOutside, true);
    (list.querySelector('button:not(:disabled)') || x).focus();
    if (!reduced.matches) { cancelMotion(); playMotion(shownView && shownView.hasPet ? 'greet' : 'wobble'); }
  }
  function cancelQuiz() { quizIntent++; closeBalloon(); }
  function requestQuiz() {
    conversation?.close();
    const ticket = ++quizIntent;
    refreshFacts().then(() => { if (ticket === quizIntent) openBalloon(); });
  }
  factBtn.addEventListener('click', requestQuiz);
  refreshFacts();

  // ---------- the frog hops out of the PEPEGOCHI.EXE window onto the taskbar ----------
  function onLeftWindow(e) {
    desktop?.stop();
    const r = e.detail;
    if (!r || reduced.matches || document.visibilityState !== 'visible' || !slot.isConnected) return;
    const to = img.getBoundingClientRect();
    const from = { x: r.left + r.width / 2 - to.width / 2, y: r.top + r.height / 2 - to.height / 2 };
    const pts = hopPath(from, { x: to.left, y: to.top });
    const fly = img.cloneNode();
    fly.className = 'pg-companion-fly';
    fly.style.width = to.width + 'px'; fly.style.height = to.height + 'px';
    document.body.append(fly);
    img.style.visibility = 'hidden';
    const done = () => { fly.remove(); img.style.visibility = ''; cancelMotion(); playMotion('hop'); };
    if (!fly.animate) { done(); return; }
    // many whole-pixel points, one after another: smooth to the eye, never blurred between two pixels (owner, 2026-11-15)
    const anim = fly.animate(pts.map(p => ({ transform: `translate(${p.x}px, ${p.y}px)` })), { duration: 760, easing: 'steps(' + (pts.length - 1) + ', end)' });
    anim.onfinish = done; anim.oncancel = done;
  }

  let lastAt = 0;
  let lastUser = null;
  let generation = 0;
  async function refresh(force = false) {
    const auth = session();
    const id = auth && auth.discord && auth.userId ? auth.userId : null;
    if (id !== lastUser) {
      desktop?.reset();
      lastUser = id;
      lastAt = 0;
      generation++;
      cancelQuiz();               // the old account's question or ranking must not stay on screen
      rumors.invalidate();
      caseClient.invalidate();
      conversation?.close({ reset: true });
      bond.reset(); arcade.reset(); clearToy(); lastLife = null;
      paint(describeTaskbarFrog(null));
      hatched = false; server = null; updateFactButton();
    }
    if (!id) return;
    if (!force && lastAt && Date.now() - lastAt < 5 * 60 * 1000) return;
    lastAt = Date.now();
    const requestGeneration = ++generation;
    try {
      const state = await rpc('gry_pepegochi_state', {});
      const cur = session();
      if (disposed || requestGeneration !== generation || !cur || !cur.discord || cur.userId !== id) return;
      if (lastLife !== state?.pet?.life_id) {
        desktop?.reset();
        conversation?.close({ reset: true }); rumors.invalidate(); caseClient.invalidate(); arcade.reset(); clearToy(); lastLife = state?.pet?.life_id || null;
      }
      const view = describeTaskbarFrog(state);
    if (shownView?.sprite !== view.sprite || shownView?.label !== view.label || shownView?.playReady !== view.playReady || shownView?.needAttention !== view.needAttention) { desktop?.stop(); conversation?.close(); clearToy(); }
      paint(view);
      const event = bond.observe(id, state?.pet);
      if (event) conversation?.react(event);
      // the quiz opens once the frog has hatched (the server checks it again)
      const was = hatched;
      hatched = !!(state && state.pet && state.pet.stage && state.pet.stage !== 'egg');
      if (hatched !== was) refreshFacts(true);
    } catch (_) {
      const cur = session();
      if (disposed || requestGeneration !== generation || !cur || cur.userId !== id) return;
      // If the release SQL is not installed, avoid claiming to know the current frog.
      conversation?.close();
      desktop?.stop();
      paint(UNAVAILABLE);
      hatched = false; server = null; updateFactButton();
    }
  }

  function onVisible() {
    if (document.visibilityState === 'visible') {
      refresh(); queueMotion(); refreshFacts();
    } else { bond.touch(); desktop?.stop(); conversation?.close(); clearToy(); cancelMotion(); }
  }
  function onMessage(event) {
    const reaction = arcade.accept(event, { origin: location.origin, frames: [...document.querySelectorAll('iframe')], owner: session()?.discord ? session()?.userId : null, life: lastLife });
    if (reaction) { if (reaction.memory) bond.keep(reaction.memory); conversation?.react(reaction.action); return; }
    if (event.origin !== location.origin || !event.data ||
        event.data.type !== 'pondos:pepegochi-changed') return;
    const frame = [...document.querySelectorAll('iframe[src*="pepegochi-live.html"]')]
      .some(node => node.contentWindow === event.source);
    if (frame) refresh(true);
  }
  const onAuth = () => { refresh(true); refreshFacts(true); };
  // Cosmetic reaction only. The next explicit journal read always gets the current server state.
  const onSecret = event => {
    if (!rumorsEnabled || !event.detail?.owner || event.detail.owner !== session()?.userId || !signedIn()) return;
    rumors.invalidate();
    conversation?.invalidateRumors();
    conversation?.react('secretFound');
  };
  const onStorage = event => {
    if (event.key && event.key.startsWith('sb-azbwciqfbsdpwubznncg-auth-token')) onAuth();
  };
  window.addEventListener('message', onMessage);
  window.addEventListener('focus', onVisible);
  window.addEventListener('storage', onStorage);
  window.addEventListener('pondos:auth-changed', onAuth);
  window.addEventListener('pondos:secret-found', onSecret);
  window.addEventListener('pondos:pepegochi-left', onLeftWindow);
  document.addEventListener('visibilitychange', onVisible);
  conversation = mountFrogInteractions({ button, img, slot, getView: () => shownView,
    setPose: p => { desktop?.stop(); cancelMotion(); setAct(p); if (!p) queueMotion(); }, animate: animateExpression, showToy, openRoom: open,
    closeQuiz: cancelQuiz, quizAvailable: () => !factBtn.hidden,
    openQuiz: requestQuiz, bond, fireflyAvailable: () => desktop?.fireflyAvailable(), catchFirefly: () => desktop?.catchNearby(),
    readRumors: rumorsEnabled ? rumors.read : null, openPassport, caseClient: rumorsEnabled ? caseClient : null,
    onCaseComplete: () => { rumors.invalidate(); onCaseComplete(); },
    canReact: () => !balloon && !desktop?.active && document.activeElement?.tagName !== 'IFRAME', now });
  desktop = mountDesktopCompanion({ slot, img, getView: () => shownView, base, now,
    eligible: manual => !disposed && !balloon && (manual || !bond.muted) && !!lastLife && document.activeElement?.tagName !== 'IFRAME' && !document.fullscreenElement,
    mayStart: () => !act && !conversation.busy && !document.querySelector('.pg-companion-fly'),
    react: action => conversation.react(action), onStart: cancelMotion, onEnd: queueMotion });
  const onOffline = () => conversation?.react('offline');
  const onOnline = () => conversation?.react('online');
  window.addEventListener('offline', onOffline);
  window.addEventListener('online', onOnline);
  refresh(true);
  queueMotion();
  return () => {
    disposed = true; generation++; quizIntent++; rumors.invalidate(); caseClient.invalidate(); bond.touch(); arcade.reset(); clearToy();
    desktop?.dispose();
    window.removeEventListener('offline', onOffline);
    window.removeEventListener('online', onOnline);
    conversation?.dispose();
    cancelMotion();
    cancelQuiz();
    if (reduced.removeEventListener) reduced.removeEventListener('change', motionPreferenceChanged);
    window.removeEventListener('message', onMessage);
    window.removeEventListener('focus', onVisible);
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('pondos:secret-found', onSecret);
    window.removeEventListener('pondos:auth-changed', onAuth);
    window.removeEventListener('pondos:pepegochi-left', onLeftWindow);
    window.removeEventListener('resize', place);
    document.removeEventListener('visibilitychange', onVisible);
    slot.remove();
  };
}
