// PepeGochi taskbar companion for PondOS. Read-only: the server remains the only source of pet state.
// Loaded only behind the existing ?beta=gochi gate. No polling, rewards, chat or local fake pet.
import { frogLook } from '../games/js/pepegochi-room.mjs';

const VALID_STAGE = new Set(['egg', 'tadpole', 'froglet', 'adult']);
const NEEDS = new Set(['hunger', 'hygiene', 'mood', 'energy']);
const STATUS = new Set(['healthy', 'neglected', 'packing', 'recovering']);
const SPRITES = '../games/img/pepegochi/';

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

// One state read on entry, then only when the tab returns after a break, auth changes,
// or the PEPEGOCHI.EXE iframe signals that a player action succeeded.
export function mountTaskbarFrog({ bar, open, session, rpc, base = '../' }) {
  const start = bar && bar.querySelector('.start');
  if (!start) return () => {};

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
  slot.append(button);
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
  function queueMotion() {
    cancelMotion();
    if (reduced.matches || document.visibilityState !== 'visible' || !slot.isConnected) return;
    const choices = motions[currentMood] || motions.adult;
    if (!choices.length) return;
    motionTimer = setTimeout(() => {
      motionTimer = null;
      if (reduced.matches || document.visibilityState !== 'visible' || !slot.isConnected) return;
      movement = choices[Math.floor(Math.random() * choices.length)];
      button.classList.add('pg-motion-' + movement);
      restoreTimer = setTimeout(queueMotion, 1050);
    }, 13000 + Math.floor(Math.random() * 20000));
  }
  const motionPreferenceChanged = () => queueMotion();
  if (reduced.addEventListener) reduced.addEventListener('change', motionPreferenceChanged);

  function paint(view) {
    const path = base + 'games/img/pepegochi/' + view.sprite;
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
      const now = session();
      if (requestGeneration !== generation || !now || !now.discord || now.userId !== id) return;
      paint(describeTaskbarFrog(state));
    } catch (_) {
      const now = session();
      if (requestGeneration !== generation || !now || now.userId !== id) return;
      // If the release SQL is not installed, avoid claiming to know the current frog.
      paint({ sprite: 'pepegochi_egg_idle.png', label: 'PepeGochi',
        title: 'PepeGochi is unavailable right now. Click to open the game.',
        warning: false, hasPet: false });
    }
  }

  function onVisible() { if (document.visibilityState === 'visible') { refresh(); queueMotion(); } else cancelMotion(); }
  function onMessage(event) {
    if (event.origin !== location.origin || !event.data ||
        event.data.type !== 'pondos:pepegochi-changed') return;
    const frame = [...document.querySelectorAll('iframe[src*="pepegochi-live.html"]')]
      .some(node => node.contentWindow === event.source);
    if (frame) refresh(true);
  }
  const onAuth = () => refresh(true);
  window.addEventListener('message', onMessage);
  window.addEventListener('focus', onVisible);
  window.addEventListener('storage', event => {
    if (event.key && event.key.startsWith('sb-azbwciqfbsdpwubznncg-auth-token')) onAuth();
  });
  window.addEventListener('pondos:auth-changed', onAuth);
  document.addEventListener('visibilitychange', onVisible);
  refresh(true);
  queueMotion();
  return () => {
    cancelMotion();
    if (reduced.removeEventListener) reduced.removeEventListener('change', motionPreferenceChanged);
    window.removeEventListener('message', onMessage);
    window.removeEventListener('focus', onVisible);
    window.removeEventListener('pondos:auth-changed', onAuth);
    document.removeEventListener('visibilitychange', onVisible);
    slot.remove();
  };
}
