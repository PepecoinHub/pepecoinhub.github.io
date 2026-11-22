import { TOYS } from './pepegochi-personality.mjs?v=20261118dialog1';
import { createArcadeObserver } from './pepegochi-arcade.mjs?v=20261116sass1';
// PepeGochi taskbar companion for PondOS. The server remains the only source of pet state and validates every care action.
// Loaded only behind the existing ?beta=gochi gate. Local conversations are cosmetic; no polling, rewards or fake pet.
// Based on PR #299; adds the Pond Quiz (one server question a day once the frog has hatched; update_pond_quiz.sql)
// and the hop out of the PEPEGOCHI.EXE window.
import { frogLook, LOOK_BELOW } from '../games/js/pepegochi-room.mjs?v=20261120notes3';
import { dayNumber, remark } from './pepegochi-facts.mjs';
import { mountFrogInteractions } from './pepegochi-interactions.mjs?v=20261121a12';
import { createSiteEventObserver } from './pepegochi-events.mjs?v=20261118events1';
import { createRumorReader } from './pepegochi-rumors.mjs?v=20261120notes3';
import { mountDesktopCompanion } from './pepegochi-desktop.mjs?v=20261118dialog1';

import { createBond } from './pepegochi-bond.mjs?v=20261120notes3';
import { createNotebook } from './pepegochi-notes.mjs?v=20261121map';

import { EXPRESSIONS, expressionFrames, expressionFor } from './pepegochi-expressions.mjs?v=20261120notes3';
// A12 life of its own (owner spec 2026-11-21): habits on the taskbar, the diary, the day's rare event.
import { pickHabit, habitSequence, HABITS } from './pepegochi-habits.mjs?v=20261121a12';
import { createDiary, sameBook } from './pepegochi-diary.mjs?v=20261122life';
import { tripState, formatLeft } from './pepegochi-trips.mjs?v=20261122life';
import { rareOfDay, localDay } from './pepegochi-rare.mjs?v=20261121a12';

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
  // PR #390 (approved 2026-11-21): care, celebration, searching, reading, and the young stages' own idle moves
  eat: { base: 'tb_adult_sit', frames: 4, ms: 170 },
  wash: { base: 'tb_adult_sit', frames: 4, ms: 170 },
  sleep: { base: 'tb_adult_sit', frames: 3, ms: 380 },
  celebrate: { base: 'tb_adult_sit', frames: 5, ms: 140 },
  search: { base: 'tb_adult_sit', frames: 4, ms: 240 },
  read: { base: 'tb_adult_sit', frames: 4, ms: 300 },
  tadpole_swim: { base: 'tb_tadpole', frames: 4, ms: 200 },
  froglet_hop: { base: 'tb_froglet', frames: 4, ms: 140 },
};
// what the frog just did or saw -> its own animation (only over the healthy sitting pose; otherwise the old expressions)
export const ACTION_ANIM = { fed: 'eat', clean: 'wash', rested: 'sleep', stamp: 'celebrate', stampBatch: 'celebrate',
  quizWin: 'celebrate', gameRecord: 'celebrate', gameMoon: 'celebrate', desktopFind: 'search', desktopGuesser: 'search', desktopNotes: 'read' };
export const animFrames = name => Array.from({ length: ANIMS[name].frames },
  (_, i) => 'taskbar/anim/tb_' + name + '_0' + (i + 1) + '.png');
// the room's sprite for the frog's state (frogLook) -> the taskbar pose that shows the same state
const POSE_OF = { egg_idle: 'tb_egg', tadpole_idle: 'tb_tadpole', froglet_idle: 'tb_froglet', adult_idle: 'tb_adult_sit',
  adult_hungry: 'tb_adult_hungry', adult_dirty: 'tb_adult_dirty', adult_moody: 'tb_adult_moody', adult_tired: 'tb_adult_sleepy',
  adult_neglected: 'tb_adult_neglected', adult_packing: 'tb_adult_packing', adult_recovering: 'tb_adult_recovering' };
// a young frog has no state poses: its stage pose
export const poseFor = roomSprite => POSE_OF[roomSprite] || POSE_OF[roomSprite.split('_')[0] + '_idle'] || 'tb_adult_sit';

export function describeTaskbarFrog(state, life = null) {
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
  // A12 trips: while the frog is away a postcard lies on the taskbar; when it is back it waits to be opened
  const trip = tripState(life?.trip, Date.parse(life?.server_now) || Date.now());
  if (trip.status !== 'home') {
    const who = String(p.name || 'Your Fren').slice(0, 18);
    return trip.status === 'away'
      ? { sprite: pose('tb_postcard'), label: who + ' · away', title: who + ' is on a trip, back in ' + formatLeft(trip.leftMs) + '. Click to open the room.',
          warning: false, hasPet: false, motion: 'letter', away: true }
      : { sprite: pose('tb_postcard'), label: 'Postcard!', title: who + ' is back from a trip. Click to open the postcard.',
          warning: true, hasPet: false, motion: 'letter', away: true };
  }
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
    goodDays: Math.max(0, Math.trunc(Number(p.good_days) || 0)),
    stage, healthy: status === 'healthy', needsOk: needs.length === NEEDS.size && !low,
    trustReady: stage === 'adult' && status === 'healthy' && needs.length === NEEDS.size && needs.every(n=>n.value>=90),
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
export function mountTaskbarFrog({ bar, open, session, rpc, commands = {}, base = '../', now = () => Date.now(), random = Math.random, getQuote = () => null, subscribeSiteEvents = () => () => {}, rumorsEnabled = true, openPassport }) {
  const start = bar && bar.querySelector('.start');
  if (!start) return () => {};
  let storage;
  try { storage = window.localStorage; } catch {}
  const bond = createBond({ storage, now, random });
  const notebook = createNotebook({ storage, now, random });
  const arcade = createArcadeObserver();
  const siteEvents = createSiteEventObserver();
  const rumors = createRumorReader({ session, rpc, now });
  const diary = createDiary({ storage, now });
  const sessionStart = now();
  let grassShown = false, rareToday = null, diaryFresh = 0;
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
    egg: ['wobble', 'bob'], tadpole: ['tadpole_swim', 'bob', 'peek'], froglet: ['froglet_hop', 'hop', 'peek', 'shuffle'],
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
    img.classList.remove('pg-hop-up');
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
        // the froglet's hop: the drawn frames bend the legs, a small lift in the middle frames makes it a real hop
        if (name === 'froglet_hop') img.classList.toggle('pg-hop-up', i === 1 || i === 2);
        if (i < frames.length) { img.setAttribute('src', img_base + frames[i++] + '?v=' + POSE_VERSION); frameTimer = setTimeout(step, a.ms); }
        else { frameTimer = null; img.classList.remove('pg-hop-up'); paint(shownView); restoreTimer = setTimeout(queueMotion, 50); }
      };
      step();
      return;
    }
    button.classList.add('pg-motion-' + movement);
    restoreTimer = setTimeout(queueMotion, 1050);
  }
  // A12 habit: its frames over the sitting pose (repeats and a held last frame included), then a line, then the pose again
  function playHabit(name) {
    if (movement) button.classList.remove('pg-motion-' + movement);
    movement = name;
    if (name === 'sign') grassShown = true;
    const seq = habitSequence(name);
    let i = 0;
    const step = () => {
      if (reduced.matches || document.visibilityState !== 'visible' || !slot.isConnected || !showing('tb_adult_sit')) { cancelMotion(); return; }
      if (i < seq.length) { const [f, ms] = seq[i++]; img.setAttribute('src', img_base + f + '?v=' + POSE_VERSION); frameTimer = setTimeout(step, ms); }
      else { frameTimer = null; paint(shownView); restoreTimer = setTimeout(queueMotion, 50); }
    };
    step();
    if (HABITS[name].say) conversation?.react(HABITS[name].say);
  }
  // load the frames of the next animation while waiting, so it never flickers
  const preloaded = new Set();
  function preload(name) {
    if ((!ANIMS[name] && !EXPRESSIONS[name]) || preloaded.has(name)) return;
    preloaded.add(name);
    for (const f of (EXPRESSIONS[name] ? expressionFrames(name) : animFrames(name))) { const i = new Image(); i.src = img_base + f + '?v=' + POSE_VERSION; }
  }
  let expressionTicket = 0;
  const framesOf = name => EXPRESSIONS[name] ? expressionFrames(name) : animFrames(name);
  const animFor = (view, action) => {
    const own = ACTION_ANIM[action];
    if (own && view?.hasPet && view.adult && !view.warning && view.sprite === pose(ANIMS[own].base)) return own;
    return expressionFor(view, action);
  };
  function animateExpression(action) {
    const name = animFor(shownView, action);
    if (!name || reduced.matches || document.visibilityState !== 'visible' || !slot.isConnected) return false;
    cancelMotion(); setAct(null);
    const ticket = ++expressionTicket;
    const life = lastLife;
    Promise.all([...new Set(framesOf(name))].map(f => new Promise(resolve => {
      const frame = new Image(); frame.onload = () => resolve(true); frame.onerror = () => resolve(false);
      frame.src = img_base + f + '?v=' + POSE_VERSION;
    }))).then(loaded => {
      if (ticket !== expressionTicket || disposed || life !== lastLife || reduced.matches ||
          document.visibilityState !== 'visible' || !slot.isConnected || animFor(shownView, action) !== name) return;
      if (loaded.every(Boolean)) playMotion(name); else queueMotion();
    });
    return true;
  }
  function queueMotion() {
    cancelMotion();
    if (act || desktop?.active || reduced.matches || document.visibilityState !== 'visible' || !slot.isConnected || disposed) return;
    const choices = motions[currentMood] || motions.adult;
    if (!choices.length) return;
    // now and then the frog does something of its own instead (A12 habits, healthy sitting adult only)
    const habit = currentMood === 'adult' && showing('tb_adult_sit') ? pickHabit({ hour: new Date(now()).getHours(),
      change24h: getQuote()?.change_24h ?? null, sessionMs: now() - sessionStart, grassShown, random }) : null;
    if (habit) {
      for (const [f] of habitSequence(habit)) { const i = new Image(); i.src = img_base + f + '?v=' + POSE_VERSION; }
      motionTimer = setTimeout(() => {
        motionTimer = null;
        if (reduced.matches || document.visibilityState !== 'visible' || !slot.isConnected) return;
        if (conversation?.invite()) return;
        if (desktop?.ambient()) return;
        if (desktop?.active || act) { queueMotion(); return; }
        playHabit(habit);
      }, habit === 'sign' ? 1500 : 13000 + Math.floor(Math.random() * 20000));
      return;
    }
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
    // the day of the tinfoil hat (A12 rare event): the healthy sitting adult wears it all day
    const sprite = expressive && rareToday === 'tinfoil' ? pose('tb_adult_tinfoil') : view.sprite;
    const path = img_base + (act && expressive ? pose(act) : sprite) + '?v=' + POSE_VERSION;
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
  // After the 99th question (owner, 2026-11-22): the server says done; the frog celebrates once with a star, then the
  // quiz rests. The Keeper of the Pond stamp itself comes from the server (update_pond_quiz.sql, quiz_99).
  const keeperKey = () => 'pepegochi:quiz-keeper:' + (session()?.userId || '');
  const keeperSeen = () => { try { return storage?.getItem(keeperKey()) === '1'; } catch { return true; } };
  const keeperDue = () => !!(server && server.done && !server.question && !keeperSeen());
  function updateFactButton() {
    const f = current(), keeper = keeperDue();
    factBtn.hidden = !(f && !f.answered) && !keeper;
    factBtn.textContent = !f && keeper ? '★' : '?';
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
    // 99 right answers = every question: a Keeper of the Pond
    for (const r of b.top) { const li = el('li'); li.append(el('span', null, r.rank + '. ' + r.nick + (r.points >= 99 ? ' ★' : '')), el('b', null, String(r.points))); if (r.points >= 99) li.title = 'Keeper of the Pond: all 99 questions'; ol.append(li); }
    box.append(b.top.length ? ol : el('p', 'pg-fact-note', 'No points yet. Be the first!'));
    if (b.me) box.append(el('p', 'pg-fact-note', b.me.rank ? `You: #${b.me.rank} with ${b.me.points}.` : 'You have no points yet.'));
  }
  function openKeeper() {
    balloon = el('div', 'pg-fact');
    balloon.setAttribute('role', 'dialog'); balloon.setAttribute('aria-label', 'Pond Quiz');
    const head = el('div', 'pg-fact-bar'), x = el('button', 'pg-fact-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close');
    x.addEventListener('click', closeBalloon); head.append(el('b', null, 'Pond Quiz ★'), x);
    const extra = el('div', 'pg-fact-extra'), rk = el('button', 'pg-fact-a pg-fact-rank', 'Ranking'); rk.type = 'button';
    rk.addEventListener('click', () => showBoard(extra)); extra.append(rk);
    balloon.append(head, el('p', 'pg-fact-q', 'That was all of them, fren. 99 questions, 99 right answers.'),
      el('p', 'pg-fact-out', 'You are a Keeper of the Pond. The stamp waits in your Fren Passport. I have no questions left, only respect.'), extra);
    try { storage?.setItem(keeperKey(), '1'); } catch {}
    setAct('tb_adult_laugh');
    document.body.append(balloon); positionQuiz();
    window.addEventListener('resize', positionQuiz);
    document.addEventListener('keydown', onKey, true); document.addEventListener('pointerdown', onOutside, true);
    x.focus();
    if (!reduced.matches) { cancelMotion(); playMotion('greet'); }
    updateFactButton();
  }
  function openBalloon() {
    if (balloon) { closeBalloon(); return; }
    let f = current();
    if (!f && keeperDue()) { openKeeper(); return; }
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
  let confirmedAt = null;
  let lastUser = null;
  let generation = 0;
  let careBusy = false;
  const CARE_REACTION = { feed: 'fed', clean: 'clean', play: 'played', rest: 'rested' };
  let lifeState = null;   // gry_pepegochi_life(): trip, diary, golden lemon (update_pepegochi_life.sql); null when not installed
  function acceptState(state, { keepConversation = false } = {}) {
    confirmedAt = now();
    const life = state?.pet?.life_id || null;
    if (lastLife !== life) {
      desktop?.reset();
      conversation?.close({ reset: true }); rumors.invalidate(); arcade.reset(); siteEvents.reset(); clearToy(); lastLife = life;
    }
    const view = describeTaskbarFrog(state, lifeState);
    if (shownView?.sprite !== view.sprite || shownView?.label !== view.label || shownView?.playReady !== view.playReady || shownView?.needAttention !== view.needAttention) {
      desktop?.stop(); clearToy();
      if (!keepConversation) conversation?.close();
    }
    paint(view);
    const event = bond.observe(lastUser, state?.pet);
    notebook.observe(lastUser, state?.pet);
    diaryFresh = writeDiary(state?.pet);
    const was = hatched;
    hatched = !!(state?.pet?.stage && state.pet.stage !== 'egg');
    if (hatched !== was) refreshFacts(true);
    return event;
  }
  // The diary (A12): a living, hatched frog writes 0-3 pages about the time the owner was away. Browser-local,
  // read in the room (pepegochi-live.mjs). The day's rare event is decided here too (same owner + day = same event).
  function writeDiary(pet) {
    rareToday = null;
    if (!lastUser || !pet?.life_id || pet.status === 'departed' || !pet.stage || pet.stage === 'egg') return 0;
    const day = localDay(now());
    rareToday = rareOfDay({ owner: lastUser, lifeId: pet.life_id, dayKey: day.dayKey, month: day.month, day: day.day, hour: day.hour });
    const q = getQuote();
    const fresh = diary.visit(lastUser, pet.life_id, {
      adoptedAt: Date.parse(pet.adopted_at), fren: 'fren', rare: rareToday === 'birthday' ? null : rareToday,
      market: { change24h: q?.change_24h ?? null }, needs: pet.needs || {},
      date: { month: day.month, day: day.day, weekday: day.weekday } });
    // the first page of a new diary is not news; pages about the time away are
    return fresh.filter(pg => pg.id !== 'first_1').length;
  }
  // The pages this browser wrote go to the server once (only when the server has the diary and something changed).
  function saveDiary(id, pet) {
    if (!lifeState || !pet?.life_id || pet.status === 'departed') return;
    diary.open(id, pet.life_id);
    const mine = diary.snapshot(), theirs = lifeState.diary && lifeState.diary.life_id === pet.life_id ? lifeState.diary : null;
    if (!mine || !mine.pages.length || (theirs && sameBook(mine, theirs))) return;
    rpc('gry_pepegochi_diary_save', { p_book: mine }).then(saved => { if (lifeState && saved) lifeState.diary = saved; }).catch(() => {});
  }
  function careError(error) {
    const message = String(error?.message || '');
    if (/Wait a moment before the next care action/i.test(message)) return 'Easy, fren. Wait a moment before the next care action.';
    if (/Daily care action limit reached/i.test(message)) return 'That is enough care actions for today. See you tomorrow, fren.';
    if (/cooling down/i.test(message)) return 'That care action is cooling down. Try again later.';
    if (/does not need that right now/i.test(message)) return 'I do not need that right now, fren.';
    if (/Discord sign-in required|not authenticated|JWT|Not signed in|permission denied/i.test(message)) return 'Log on with Discord so the server can care for your Fren.';
    return 'Care could not be saved. Your Fren is unchanged; try again in a moment.';
  }
  function syncOpenRoom() {
    for (const frame of document.querySelectorAll('iframe[src*="pepegochi-live.html"]'))
      frame.contentWindow?.postMessage({ type: 'pondos:pepegochi-refresh' }, location.origin);
  }
  async function taskbarCare(kind) {
    if (!Object.hasOwn(CARE_REACTION, kind)) return { ok: false, text: 'Unknown care action.' };
    if (careBusy) return { ok: false, text: 'One care action is already being saved.' };
    const auth = session(), owner = auth?.discord ? auth.userId : null, life = lastLife;
    if (!owner || !life || !shownView?.hasPet) return { ok: false, openRoom: true };
    careBusy = true;
    const requestGeneration = ++generation;
    try {
      const state = await rpc('gry_pepegochi_action', { p_action: kind });
      const current = session();
      if (disposed || requestGeneration !== generation || !current?.discord || current.userId !== owner || lastLife !== life)
        return { ok: false, text: 'The active account changed. No local result was applied.' };
      lastAt = Date.now();
      const accepted = state?.action_result === 'accepted';
      const event = acceptState(state, { keepConversation: accepted });
      if (accepted || state?.action_result === 'moved_out') syncOpenRoom();
      if (state?.action_result === 'moved_out') return { ok: false, openRoom: true };
      if (!accepted) return { ok: false, text: 'The server did not accept that care action.' };
      if (event) bond.consumeCare(event);
      return { ok: true, action: event || CARE_REACTION[kind] };
    } catch (error) {
      return { ok: false, text: careError(error) };
    } finally { careBusy = false; }
  }
  async function refresh(force = false) {
    const auth = session();
    const id = auth && auth.discord && auth.userId ? auth.userId : null;
    if (id !== lastUser) {
      desktop?.reset();
      lastUser = id;
      lastAt = 0;
      confirmedAt = null;
      generation++;
      cancelQuiz();               // the old account's question or ranking must not stay on screen
      rumors.invalidate();
      conversation?.close({ reset: true });
      bond.reset(); notebook.reset(); arcade.reset(); siteEvents.reset(); clearToy(); lastLife = null; lifeState = null; diary.reset();
      paint(describeTaskbarFrog(null));
      hatched = false; server = null; updateFactButton();
    }
    if (!id) return;
    if (!force && lastAt && Date.now() - lastAt < 5 * 60 * 1000) return;
    lastAt = Date.now();
    const requestGeneration = ++generation;
    try {
      const state = await rpc('gry_pepegochi_state', {});
      let cur = session();
      if (disposed || requestGeneration !== generation || !cur || !cur.discord || cur.userId !== id) return;
      // A12 (update_pepegochi_life.sql): the trip and the diary saved by another device, read before the frog writes
      const pet = state?.pet, living = pet?.life_id && pet.status !== 'departed' && pet.stage && pet.stage !== 'egg';
      lifeState = null;
      if (living) {
        try { lifeState = await rpc('gry_pepegochi_life', {}); } catch (_) { lifeState = null; }
        cur = session();
        if (disposed || requestGeneration !== generation || !cur || !cur.discord || cur.userId !== id) return;
        if (lifeState) diary.adopt(id, pet.life_id, lifeState.diary);
      }
      const event = acceptState(state);
      saveDiary(id, pet);
      if (event) conversation?.react(event);
      else if (diaryFresh) conversation?.react('diaryNew');
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
  // Invalidation only; the private, deduplicated site-event bridge owns cosmetic award reactions.
  const onSecret = event => {
    if (!rumorsEnabled || !event.detail?.owner || event.detail.owner !== session()?.userId || !signedIn()) return;
    rumors.invalidate();
    conversation?.invalidateRumors();
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
  conversation = mountFrogInteractions({ button, img, slot, getView: () => ({ ...shownView, trustReady: shownView?.trustReady && confirmedAt !== null && now()-confirmedAt >= 0 && now()-confirmedAt <= 5*60000 }),
    setPose: p => { desktop?.stop(); cancelMotion(); setAct(p); if (!p) queueMotion(); }, animate: animateExpression, showToy, openRoom: open,
    closeQuiz: cancelQuiz, quizAvailable: () => !factBtn.hidden,
    openQuiz: requestQuiz, commands, care: taskbarCare, bond, fireflyAvailable: () => desktop?.fireflyAvailable(), catchFirefly: () => desktop?.catchNearby(),
    readRumors: rumorsEnabled ? rumors.read : null, notebook: rumorsEnabled ? notebook : null, lifeId: () => lastLife, openPassport, getQuote,
    canReact: () => !balloon && !desktop?.active && !document.querySelector('.reward98') && document.activeElement?.tagName !== 'IFRAME', now });
  const unsubscribeSiteEvents = subscribeSiteEvents(event => {
    const current = session();
    if (disposed || !current?.discord || current.userId !== lastUser) return;
    const action = siteEvents.accept(event, { owner: lastUser, life: lastLife, hasPet: shownView?.hasPet });
    if (action) conversation.react(action);
  });
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
    disposed = true; generation++; quizIntent++; rumors.invalidate(); bond.touch(); arcade.reset(); siteEvents.reset(); unsubscribeSiteEvents(); clearToy();
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
