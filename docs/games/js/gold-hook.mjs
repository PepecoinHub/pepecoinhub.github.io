// Pepe Gold Hook: glue between the game logic, drawing, input, DOM dialogs and high scores.
// Runs fully in the browser; the only network call besides loading files is the optional
// "Submit score" / top 10 (see gold-hook-scores.mjs). Game PEP are points, not real coins.
import { ROUNDS } from './gold-hook-config.mjs';
import { APP, createGame, startRound, update, fire, pause, resume, toTitle, drainEvents } from './gold-hook-state.mjs';
import { loadAssets, reactionDurations } from './gold-hook-assets.mjs';
import { createRenderer } from './gold-hook-render.mjs';
import { attachInput } from './gold-hook-input.mjs';
import { T } from './gold-hook-text.mjs';
import { validateRun } from './gold-hook-validation.mjs';
import { createScores, fetchRpc, readSession, isNotDeployed } from './gold-hook-scores.mjs';

const $ = (id) => document.getElementById(id);

// Inside PondOS (?embed=1): no site header, report the size so the window fits the game,
// and pause when the window is minimized (PondOS posts 'pause' to every game frame).
if (new URLSearchParams(location.search).has('embed')) document.body.classList.add('embed');
const embedded = document.body.classList.contains('embed') && parent !== window;
function postSize() {
  if (!embedded) return;
  const box = document.querySelector('.gh-app');
  parent.postMessage({ type: 'gold-hook-size', w: 660, h: Math.ceil(box.getBoundingClientRect().height) }, location.origin);
}

const canvas = $('game');
const overlays = {
  loading: $('ov-loading'), error: $('ov-error'),
  [APP.TITLE]: $('ov-title'), [APP.PAUSED]: $('ov-pause'), [APP.RESULT]: $('ov-result'),
};
const btnFire = $('btn-fire');
const btnPause = $('btn-pause');
const controls = $('controls');

function fillStaticText() {
  canvas.setAttribute('aria-label', T.canvasLabel);
  const r = ROUNDS[0];
  $('title-intro').textContent = T.titleIntro;
  $('title-goal').textContent = T.titleGoal(r.target, r.durationSec);
  $('title-keys').textContent = T.titleKeys;
  $('btn-play').textContent = T.play;
  btnFire.textContent = T.fire;
  btnPause.textContent = T.pause;
  $('pause-title').textContent = T.pausedTitle;
  $('pause-text').textContent = T.pausedText;
  $('btn-resume').textContent = T.resume;
  $('btn-restart').textContent = T.restart;
  $('btn-exit').textContent = T.exit;
  $('btn-again').textContent = T.again;
  $('btn-menu').textContent = T.menu;
  $('btn-top').textContent = T.top10;
  $('hs-nick-label').textContent = T.nickLabel;
  $('hs-nick').placeholder = T.nickPlaceholder;
  $('hs-submit').textContent = T.submit;
  $('loading-text').textContent = T.loading;
}

function showOnly(name) {
  for (const [key, el] of Object.entries(overlays)) el.hidden = key !== name;
  const modal = name !== null;
  canvas.inert = modal;
  controls.inert = modal;
  if (modal) {
    const first = overlays[name].querySelector('button');
    (first || overlays[name]).focus({ preventScroll: true });
  } else {
    canvas.focus({ preventScroll: true });
  }
}

function showError(result) {
  $('error-title').textContent = T.errorTitle;
  $('error-hint').textContent = result.fatalManifest ? T.errorManifestHint : T.errorAssetsHint;
  $('error-list').replaceChildren(...result.errors.map((e) => Object.assign(document.createElement('li'), { textContent: e })));
  showOnly('error');
}

// Best score in this browser only. The key carries the layout version, so a re-balance never
// compares scores across versions.
function updateLocalBest(result) {
  const key = `${result.run.gameId}-best-v${result.run.layoutVersion}`;
  let prev = 0;
  try { prev = Number(localStorage.getItem(key)) || 0; } catch { /* storage blocked */ }
  const v = validateRun(result.run);
  if (!v.ok || v.score <= prev) return { score: prev, isNew: false };
  try { localStorage.setItem(key, String(v.score)); } catch { /* ignore */ }
  return { score: v.score, isNew: true };
}

// Screen reader announcements: merged, at most one every 1.5 s.
function createAnnouncer(el) {
  let pending = [];
  let lastFlush = 0;
  let timer = null;
  function flush() {
    timer = null;
    if (!pending.length) return;
    el.textContent = pending.join(' ');
    pending = [];
    lastFlush = performance.now();
  }
  return {
    say(msg, { replaceKey } = {}) {
      if (replaceKey) pending = pending.filter((p) => !p.startsWith(replaceKey));
      pending.push(msg);
      const wait = Math.max(0, 1500 - (performance.now() - lastFlush));
      if (!timer) timer = setTimeout(flush, wait);
    },
  };
}

// ---------- high scores: submit form and top 10 inside the result dialog ----------
function setupScores(scores, cfg) {
  const form = $('hs-form'), status = $('hs-status'), note = $('hs-note');
  const nickRow = $('hs-nick-row'), nick = $('hs-nick'), discord = $('hs-discord'), submitBtn = $('hs-submit');
  const topBtn = $('btn-top'), topBox = $('hs-top-box'), topList = $('hs-top');
  let current = null;
  try { nick.value = localStorage.getItem('pondos-nick') || ''; } catch { /* ignore */ }

  if (!scores.enabled) { topBtn.hidden = true; return { show() { form.hidden = true; } }; }

  function renderTop(rows) {
    if (!rows.length) { topList.replaceChildren(Object.assign(document.createElement('li'), { textContent: T.emptyTop })); return; }
    topList.replaceChildren(...rows.map((r) => {
      const li = document.createElement('li');
      const name = document.createElement(r.verified ? 'b' : 'span');
      name.textContent = r.nick + (r.verified ? ' ✓' : '');
      const sc = document.createElement('small');
      sc.textContent = Number(r.score).toLocaleString('en-US');
      li.append(name, ' ', sc);
      return li;
    }));
  }

  async function loadTop(force = false) {
    topBox.hidden = false;
    topList.replaceChildren(Object.assign(document.createElement('li'), { textContent: T.loadingTop }));
    try { renderTop(await scores.top({ force })); }
    catch (err) { topList.replaceChildren(Object.assign(document.createElement('li'), { textContent: isNotDeployed(err) ? T.soon : err.message })); }
    postSize();
  }
  topBtn.addEventListener('click', () => loadTop(false));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!current) return;
    const session = readSession(cfg);
    const n = nick.value.trim();
    if (!(session && session.discord)) {
      if (n.length < 2) { nick.focus(); return; }
      try { localStorage.setItem('pondos-nick', n); } catch { /* ignore */ }
    }
    submitBtn.disabled = true;
    submitBtn.textContent = T.sending;
    status.textContent = '';
    try {
      const r = await scores.submit(current, n);
      status.textContent = T.saved(r.nick, r.verified, r.place);
      nickRow.hidden = true; discord.hidden = true; submitBtn.hidden = true; note.hidden = true;
      current = null;
      loadTop(true);
    } catch (err) {
      status.textContent = isNotDeployed(err) ? T.soon : err.message;
      submitBtn.disabled = false;
      submitBtn.textContent = T.submit;
    }
    postSize();
  });

  return {
    // Called for every finished round: offer the submit form when there is something to send.
    show(result) {
      current = result;
      const v = validateRun(result.run);
      const session = readSession(cfg);
      const verified = !!(session && session.discord);
      form.hidden = !(v.ok && v.score > 0);
      discord.hidden = !verified;
      discord.textContent = verified ? T.submitAsDiscord(v.score) : '';
      nickRow.hidden = verified;
      note.hidden = verified;
      note.textContent = verified ? '' : T.discordNote;
      submitBtn.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = T.submit;
      status.textContent = '';
      topBox.hidden = true;
    },
  };
}

async function boot() {
  fillStaticText();
  showOnly('loading');
  if (embedded && 'ResizeObserver' in window) new ResizeObserver(postSize).observe(document.querySelector('.gh-app'));
  const assets = await loadAssets('img/gold-hook/manifest.json');
  if (!assets.ok) { showError(assets); return; }

  const game = createGame({ reactionMs: reactionDurations(assets.manifest) });
  const renderer = createRenderer(canvas, assets);
  new ResizeObserver(() => renderer.resize()).observe(canvas);
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const announcer = createAnnouncer($('live'));
  const cfg = window.PEP_GRY || {};
  const scoresUi = setupScores(createScores(fetchRpc(cfg)), cfg);
  const stats = $('stats');
  let lastStats = '';
  let shownApp = null;
  let shownResult = null;
  let last = null;

  function syncApp() {
    if (game.app === shownApp && game.result === shownResult) return;
    shownApp = game.app;
    shownResult = game.result;
    btnFire.disabled = game.app !== APP.PLAYING;
    btnPause.disabled = game.app !== APP.PLAYING;
    if (game.app === APP.RESULT) {
      const r = game.result;
      $('result-title').textContent = r.won ? T.winTitle : T.loseTitle;
      $('result-line').textContent = T.resultLine(r.score, r.target);
      $('result-text').textContent = r.won ? T.winText : T.loseText;
      const best = updateLocalBest(r);
      $('result-best').textContent = best.isNew ? T.newBest(best.score) : best.score > 0 ? T.best(best.score) : '';
      scoresUi.show(r);
    }
    showOnly(game.app === APP.PLAYING ? null : game.app);
  }

  function handleEvents() {
    for (const e of drainEvents(game)) {
      if (e.type === 'score') announcer.say(T.srScore(e.points, e.total), { replaceKey: 'Plus' });
      else if (e.type === 'empty') announcer.say(T.srEmpty, { replaceKey: T.srEmpty });
      else if (e.type === 'time') announcer.say(T.srTime(e.seconds));
      else if (e.type === 'end') announcer.say(T.srEnd(e.won, e.score, e.target));
    }
  }

  function updateStats() {
    const s = T.srStats(game.score, game.target, Math.ceil(game.timeLeft));
    if (s !== lastStats) { stats.textContent = s; lastStats = s; }
  }

  const actions = {
    play() { startRound(game); announcer.say(T.srStart(game.target, game.round.durationSec)); syncApp(); },
    pause() { if (pause(game)) { announcer.say(T.srPaused); syncApp(); } },
    resume() { if (resume(game)) { last = null; announcer.say(T.srResumed); syncApp(); } },
    restart() { actions.play(); },
    menu() { toTitle(game); syncApp(); },
  };

  $('btn-play').addEventListener('click', actions.play);
  $('btn-resume').addEventListener('click', actions.resume);
  $('btn-restart').addEventListener('click', actions.restart);
  $('btn-exit').addEventListener('click', actions.menu);
  $('btn-again').addEventListener('click', actions.restart);
  $('btn-menu').addEventListener('click', actions.menu);
  btnPause.addEventListener('click', actions.pause);
  btnFire.addEventListener('click', () => fire(game));

  attachInput(canvas, {
    onFire: () => fire(game),
    onPauseKey: () => {
      if (game.app === APP.PLAYING) { actions.pause(); return true; }
      if (game.app === APP.PAUSED) { actions.resume(); return true; }
      return false;
    },
  });

  // A hidden tab, or a minimized PondOS window, pauses the game.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) actions.pause();
    else last = null;
  });
  window.addEventListener('message', (e) => {
    if (e.origin === location.origin && e.source === parent && (e.data === 'pause' || e.data === 'gold-hook-pause')) actions.pause();
  });

  function frame(now) {
    const dt = last === null ? 0 : (now - last) / 1000;
    last = now;
    update(game, dt);             // the logic caps time jumps and only runs in PLAYING
    handleEvents();
    syncApp();
    updateStats();
    renderer.draw(game, { reducedMotion: motionQuery.matches });
    requestAnimationFrame(frame);
  }

  syncApp();
  postSize();
  requestAnimationFrame(frame);
}

boot().catch((err) => {
  console.error(err);
  showError({ errors: [String((err && err.message) || err)] });
});
