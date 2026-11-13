// PepeGochi taskbar companion for PondOS. Read-only: the server remains the only source of pet state.
// Loaded only behind the existing ?beta=gochi gate. No polling, rewards, chat or local fake pet.
// Based on PR #299; adds the fact of the day (pepegochi-facts.mjs) and the hop out of the PEPEGOCHI.EXE window.
import { frogLook } from '../games/js/pepegochi-room.mjs';
import { factOfDay, dayNumber, loadAnswer, saveAnswer, remark } from './pepegochi-facts.mjs';

const VALID_STAGE = new Set(['egg', 'tadpole', 'froglet', 'adult']);
const NEEDS = new Set(['hunger', 'hygiene', 'mood', 'energy']);
const STATUS = new Set(['healthy', 'neglected', 'packing', 'recovering']);

export function describeTaskbarFrog(state) {
  const p = state && state.pet;
  if (!p) return {
    sprite: 'pepegochi_egg_idle.png', label: 'Adopt me?',
    title: 'No PepeGochi yet. Click to adopt your egg.', warning: false, hasPet: false, motion: 'egg',
  };
  if (p.status === 'departed') return {
    sprite: 'goodbye_envelope.png', label: 'GOODBYE.TXT',
    title: 'Your Fren moved out. Open PEPEGOCHI.EXE to read the letter.',
    warning: true, hasPet: false, motion: 'letter',
  };
  const stage = VALID_STAGE.has(p.stage) ? p.stage : 'adult';
  const status = STATUS.has(p.status) ? p.status : 'healthy';
  const needs = Object.entries(p.needs || {})
    .filter(([need, val]) => NEEDS.has(need) && Number.isFinite(Number(val)))
    .map(([need, val]) => ({ need, value: Number(val) }));
  const sprite = frogLook({ stage, status, needs }).sprite;
  const name = String(p.name || 'Your Fren').slice(0, 18);
  const remarks = {
    healthy: 'Your Fren is here.',
    neglected: 'Your Fren misses you.',
    packing: 'Your Fren is packing a suitcase!',
    recovering: 'Your Fren is recovering.',
  };
  return {
    sprite: 'pepegochi_' + sprite + '.png', label: name,
    title: name + ' · ' + remarks[status] + ' Click to visit.',
    warning: status === 'packing' || status === 'neglected', hasPet: true,
    motion: status !== 'healthy' ? status : (sprite === 'adult_tired' ? 'sleepy' : stage),
  };
}
// shown when the state cannot be read (no SQL yet, offline): the egg, no claim about a frog
export const UNAVAILABLE = { sprite: 'pepegochi_egg_idle.png', label: 'PepeGochi',
  title: 'PepeGochi is unavailable right now. Click to open the game.', warning: false, hasPet: false, motion: 'egg' };

// The flight path of the hop from the game window to the taskbar: whole pixels, an arc, ending on the slot.
export function hopPath(from, to, steps = 8) {
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
export function mountTaskbarFrog({ bar, open, session, rpc, base = '../', storage = safeStorage(), now = () => Date.now() }) {
  const start = bar && bar.querySelector('.start');
  if (!start) return () => {};
  const img_base = base + 'games/img/pepegochi/';

  const slot = document.createElement('span');
  slot.className = 'pg-companion';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pg-companion-button';
  const img = document.createElement('img');
  img.alt = '';
  img.width = 42;
  img.height = 42;
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
  button.addEventListener('click', () => open());

  // Very short motions, not an endlessly looping animation. Only one is active at a time,
  // and no animation or running timer is needed when the browser is hidden / reduced motion is set.
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const motions = {
    egg: ['wobble', 'bob'], tadpole: ['bob', 'peek'], froglet: ['hop', 'peek', 'shuffle'],
    adult: ['hop', 'peek', 'shuffle', 'greet', 'bob'], sleepy: ['nod', 'bob'],
    neglected: ['slouch', 'peek'], packing: ['tremble', 'shuffle'],
    recovering: ['nod', 'bob'], letter: [],
  };
  let currentMood = 'egg', movement = null, motionTimer = null, restoreTimer = null;
  function cancelMotion() {
    if (motionTimer) clearTimeout(motionTimer);
    if (restoreTimer) clearTimeout(restoreTimer);
    motionTimer = restoreTimer = null;
    if (movement) button.classList.remove('pg-motion-' + movement);
    movement = null;
  }
  function playMotion(name) {
    if (movement) button.classList.remove('pg-motion-' + movement);
    movement = name;
    button.classList.add('pg-motion-' + movement);
    restoreTimer = setTimeout(queueMotion, 1050);
  }
  function queueMotion() {
    cancelMotion();
    if (reduced.matches || document.visibilityState !== 'visible' || !slot.isConnected) return;
    const choices = motions[currentMood] || motions.adult;
    if (!choices.length) return;
    motionTimer = setTimeout(() => {
      motionTimer = null;
      if (reduced.matches || document.visibilityState !== 'visible' || !slot.isConnected) return;
      playMotion(choices[Math.floor(Math.random() * choices.length)]);
    }, 13000 + Math.floor(Math.random() * 20000));
  }
  const motionPreferenceChanged = () => queueMotion();
  if (reduced.addEventListener) reduced.addEventListener('change', motionPreferenceChanged);

  let shownView = null;
  function paint(view) {
    shownView = view;
    const path = img_base + view.sprite;
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

  // ---------- fact of the day ----------
  let facts = null, factsLoading = null, balloon = null;
  const today = () => dayNumber(now());
  function loadFacts() {
    if (!factsLoading) {
      factsLoading = fetch(base + 'data/pepecoin-quiz.json', { cache: 'force-cache' })
        .then(r => (r.ok ? r.json() : null))
        .then(d => { facts = (d && d.questions) || []; return facts; })
        .catch(() => { facts = []; return facts; });
    }
    return factsLoading;
  }
  function updateFactButton() {
    const has = facts && factOfDay(facts, today());
    factBtn.hidden = !has || !!loadAnswer(storage, today());
  }
  function closeBalloon() {
    if (!balloon) return;
    balloon.remove(); balloon = null;
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('pointerdown', onOutside, true);
  }
  function onKey(e) { if (e.key === 'Escape') { closeBalloon(); factBtn.focus(); } }
  function onOutside(e) { if (balloon && !balloon.contains(e.target) && e.target !== factBtn) closeBalloon(); }
  function openBalloon() {
    if (balloon) { closeBalloon(); return; }
    const f = facts && factOfDay(facts, today());
    if (!f) return;
    balloon = document.createElement('div');
    balloon.className = 'pg-fact';
    balloon.setAttribute('role', 'dialog');
    balloon.setAttribute('aria-label', 'Did you know?');
    const head = document.createElement('div');
    head.className = 'pg-fact-bar';
    const t = document.createElement('b'); t.textContent = 'Did you know?';
    const x = document.createElement('button'); x.type = 'button'; x.className = 'pg-fact-x'; x.textContent = '×';
    x.setAttribute('aria-label', 'Close');
    x.addEventListener('click', closeBalloon);
    head.append(t, x);
    const q = document.createElement('p'); q.className = 'pg-fact-q'; q.textContent = f.question;
    const list = document.createElement('div'); list.className = 'pg-fact-answers';
    const out = document.createElement('p'); out.className = 'pg-fact-out'; out.setAttribute('aria-live', 'polite');
    const show = picked => {
      [...list.children].forEach((b, i) => {
        b.disabled = true;
        b.classList.toggle('is-right', i === f.correct);
        b.classList.toggle('is-wrong', i === picked && picked !== f.correct);
      });
      const right = picked === f.correct;
      out.textContent = (right ? '' : 'The answer: ' + f.answers[f.correct] + '. ') + remark(right, f.day);
      const a = document.createElement('a');
      a.href = f.source; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Read more';
      out.append(' ', a);
    };
    f.answers.forEach((ans, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'pg-fact-a'; b.textContent = ans;
      b.addEventListener('click', () => { saveAnswer(storage, i, f.day); show(i); updateFactButton(); });
      list.append(b);
    });
    balloon.append(head, q, list, out);
    const saved = loadAnswer(storage, f.day);
    if (saved) show(saved.picked);
    document.body.append(balloon);
    // above the frog, inside the screen (also on a phone, where the taskbar has two rows)
    const r = slot.getBoundingClientRect();
    balloon.style.bottom = Math.max(8, window.innerHeight - r.top + 6) + 'px';
    balloon.style.left = Math.max(8, Math.min(r.left, window.innerWidth - balloon.offsetWidth - 8)) + 'px';
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onOutside, true);
    (list.querySelector('button:not(:disabled)') || x).focus();
    if (!reduced.matches) { cancelMotion(); playMotion(shownView && shownView.hasPet ? 'greet' : 'wobble'); }
  }
  factBtn.addEventListener('click', () => { loadFacts().then(openBalloon); });
  loadFacts().then(updateFactButton);

  // ---------- the frog hops out of the PEPEGOCHI.EXE window onto the taskbar ----------
  function onLeftWindow(e) {
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
    const anim = fly.animate(pts.map(p => ({ transform: `translate(${p.x}px, ${p.y}px)` })), { duration: 560, easing: 'steps(' + (pts.length - 1) + ', end)' });
    anim.onfinish = done; anim.oncancel = done;
  }

  let lastAt = 0;
  let lastUser = null;
  let generation = 0;
  async function refresh(force = false) {
    const auth = session();
    const id = auth && auth.discord && auth.userId ? auth.userId : null;
    if (id !== lastUser) {
      lastUser = id;
      lastAt = 0;
      generation++;
      paint(describeTaskbarFrog(null));
    }
    if (!id) return;
    if (!force && lastAt && Date.now() - lastAt < 5 * 60 * 1000) return;
    lastAt = Date.now();
    const requestGeneration = ++generation;
    try {
      const state = await rpc('gry_pepegochi_state', {});
      const cur = session();
      if (requestGeneration !== generation || !cur || !cur.discord || cur.userId !== id) return;
      paint(describeTaskbarFrog(state));
    } catch (_) {
      const cur = session();
      if (requestGeneration !== generation || !cur || cur.userId !== id) return;
      // If the release SQL is not installed, avoid claiming to know the current frog.
      paint(UNAVAILABLE);
    }
  }

  function onVisible() {
    if (document.visibilityState === 'visible') { refresh(); queueMotion(); updateFactButton(); } else cancelMotion();
  }
  function onMessage(event) {
    if (event.origin !== location.origin || !event.data ||
        event.data.type !== 'pondos:pepegochi-changed') return;
    const frame = [...document.querySelectorAll('iframe[src*="pepegochi-live.html"]')]
      .some(node => node.contentWindow === event.source);
    if (frame) refresh(true);
  }
  const onAuth = () => refresh(true);
  const onStorage = event => {
    if (event.key && event.key.startsWith('sb-azbwciqfbsdpwubznncg-auth-token')) onAuth();
    if (event.key === null || event.key === 'pondos-gochi-fact') updateFactButton();
  };
  window.addEventListener('message', onMessage);
  window.addEventListener('focus', onVisible);
  window.addEventListener('storage', onStorage);
  window.addEventListener('pondos:auth-changed', onAuth);
  window.addEventListener('pondos:pepegochi-left', onLeftWindow);
  document.addEventListener('visibilitychange', onVisible);
  refresh(true);
  queueMotion();
  return () => {
    cancelMotion();
    closeBalloon();
    if (reduced.removeEventListener) reduced.removeEventListener('change', motionPreferenceChanged);
    window.removeEventListener('message', onMessage);
    window.removeEventListener('focus', onVisible);
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('pondos:auth-changed', onAuth);
    window.removeEventListener('pondos:pepegochi-left', onLeftWindow);
    document.removeEventListener('visibilitychange', onVisible);
    slot.remove();
  };
}

function safeStorage() {
  try { return window.localStorage; } catch (e) { return { getItem: () => null, setItem: () => {} }; }
}
