// PepeGochi taskbar companion for PondOS. Read-only: the server remains the only source of pet state.
// Loaded only behind the existing ?beta=gochi gate. No polling, rewards, chat or local fake pet.
// Based on PR #299; adds the Pond Quiz (one server question a day once the frog has hatched; update_pond_quiz.sql)
// and the hop out of the PEPEGOCHI.EXE window.
import { frogLook } from '../games/js/pepegochi-room.mjs';
import { dayNumber, remark } from './pepegochi-facts.mjs';

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
export function mountTaskbarFrog({ bar, open, session, rpc, base = '../', now = () => Date.now() }) {
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

  // ---------- Pond Quiz: the frog's question of the day ----------
  // Only from the server (update_pond_quiz.sql): the questions and answers are not in the site's files. The server
  // picks the question from the account's own pool and keeps the points; it answers only for a Discord account whose
  // PepeGochi has hatched, so the browser does not even ask before that.
  let balloon = null, server = null, hatched = false;
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
    try { server = await rpc('gry_quiz_today', {}); } catch (e) { server = null; }
    if (server && server.day && server.day !== todayText()) server = null;
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
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('pointerdown', onOutside, true);
  }
  function onKey(e) { if (e.key === 'Escape') { closeBalloon(); factBtn.focus(); } }
  function onOutside(e) { if (balloon && !balloon.contains(e.target) && e.target !== factBtn) closeBalloon(); }
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
    f.answers.forEach((ans, i) => {
      const b = el('button', 'pg-fact-a', ans); b.type = 'button';
      b.addEventListener('click', async () => {
        [...list.children].forEach(x => { x.disabled = true; });
        try { server = await rpc('gry_quiz_answer', { p_choice: i }); f = server; }
        catch (e) { out.textContent = 'The answer could not be saved. Try again later.'; [...list.children].forEach(x => { x.disabled = false; }); return; }
        show(); updateFactButton();
      });
      list.append(b);
    });
    balloon.append(head, el('p', 'pg-fact-q', f.question), list, out, extra);
    if (f.answered) show();
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
  factBtn.addEventListener('click', () => { refreshFacts().then(openBalloon); });
  refreshFacts();

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
      hatched = false; server = null; updateFactButton();
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
      // the quiz opens once the frog has hatched (the server checks it again)
      const was = hatched;
      hatched = !!(state && state.pet && state.pet.stage && state.pet.stage !== 'egg');
      if (hatched !== was) refreshFacts(true);
    } catch (_) {
      const cur = session();
      if (requestGeneration !== generation || !cur || cur.userId !== id) return;
      // If the release SQL is not installed, avoid claiming to know the current frog.
      paint(UNAVAILABLE);
      hatched = false; server = null; updateFactButton();
    }
  }

  function onVisible() {
    if (document.visibilityState === 'visible') { refresh(); queueMotion(); refreshFacts(); } else cancelMotion();
  }
  function onMessage(event) {
    if (event.origin !== location.origin || !event.data ||
        event.data.type !== 'pondos:pepegochi-changed') return;
    const frame = [...document.querySelectorAll('iframe[src*="pepegochi-live.html"]')]
      .some(node => node.contentWindow === event.source);
    if (frame) refresh(true);
  }
  const onAuth = () => { refresh(true); refreshFacts(true); };
  const onStorage = event => {
    if (event.key && event.key.startsWith('sb-azbwciqfbsdpwubznncg-auth-token')) onAuth();
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
