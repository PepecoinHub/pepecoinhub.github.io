// Pepe Gold Hook: glue between the game logic, the campaign (levels, shop), drawing, input, DOM screens
// and high scores. Runs fully in the browser; the only network calls besides loading files are the
// optional "Submit score", top 10 and "My stats" (see gold-hook-scores.mjs). Game PEP are points.
import {
  APP, createGame, setLevel, startRound, update, fire, pause, resume, useDynamite, drainEvents,
} from './gold-hook-state.mjs';
import {
  MAX_LEVEL, levelDef, newRun, modsFor, priceOf, canBuy, buy, finishLevel, SHOP_ITEMS, CAMPAIGN_VERSION, submission,
} from './gold-hook-campaign.mjs';
import { loadAssets, reactionDurations } from './gold-hook-assets.mjs';
import { createRenderer } from './gold-hook-render.mjs';
import { attachInput } from './gold-hook-input.mjs';
import { T } from './gold-hook-text.mjs';
import { validateCampaign } from './gold-hook-validation.mjs';
import { createScores, fetchRpc, readSession, isNotDeployed } from './gold-hook-scores.mjs';

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
const RUN_KEY = 'goldhook-run-v3';
const STATS_KEY = 'goldhook-stats-v3';
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

// Inside PondOS (?embed=1): no site header, report the size so the window fits the game,
// and pause when the window is minimized (PondOS posts 'pause' to every game frame).
if (new URLSearchParams(location.search).has('embed')) document.body.classList.add('embed');
const embedded = document.body.classList.contains('embed') && parent !== window;
function postSize() {
  if (!embedded) return;
  const box = document.querySelector('.gh-app');
  parent.postMessage({ type: 'gold-hook-size', w: 980, h: Math.ceil(box.getBoundingClientRect().height) }, location.origin);
}

const canvas = $('game');
const controls = $('controls');
const SCREENS = ['loading', 'error', 'menu', 'level', 'pause', 'cleared', 'shop', 'end'];
const overlays = Object.fromEntries(SCREENS.map((s) => [s, $(`ov-${s}`)]));
let screen = 'loading';

function show(name) {
  screen = name;
  for (const [key, ov] of Object.entries(overlays)) ov.hidden = key !== name;
  const modal = name !== null;
  canvas.inert = modal;
  controls.inert = modal;
  if (modal) {
    const first = overlays[name].querySelector('button:not([hidden]):not(:disabled)');
    (first || overlays[name]).focus({ preventScroll: true });
  } else {
    canvas.focus({ preventScroll: true });
  }
  postSize();
}

function showError(result) {
  $('error-title').textContent = T.errorTitle;
  $('error-hint').textContent = result.fatalManifest ? T.errorManifestHint : T.errorAssetsHint;
  $('error-list').replaceChildren(...result.errors.map((e) => el('li', { textContent: e })));
  show('error');
}

// Screen reader announcements: merged, at most one every 1.5 s.
function createAnnouncer(node) {
  let pending = [], lastFlush = 0, timer = null;
  const flush = () => { timer = null; if (!pending.length) return; node.textContent = pending.join(' '); pending = []; lastFlush = performance.now(); };
  return {
    say(msg, { replaceKey } = {}) {
      if (replaceKey) pending = pending.filter((p) => !p.startsWith(replaceKey));
      pending.push(msg);
      if (!timer) timer = setTimeout(flush, Math.max(0, 1500 - (performance.now() - lastFlush)));
    },
  };
}

function fillStaticText() {
  canvas.setAttribute('aria-label', T.canvasLabel);
  $('loading-text').textContent = T.loading;
  $('menu-tagline').textContent = T.tagline;
  $('btn-new').textContent = T.newGame;
  $('btn-howto').textContent = T.howTo;
  $('btn-menu-top').textContent = T.highScores;
  $('btn-stats').textContent = T.myStats;
  $('menu-howto').replaceChildren(...T.howToText.map((t) => el('p', { textContent: t })));
  $('btn-go').textContent = T.go;
  $('pause-title').textContent = T.pausedTitle;
  $('pause-text').textContent = T.pausedText;
  $('btn-resume').textContent = T.resume;
  $('btn-exit').textContent = T.exit;
  $('btn-to-shop').textContent = T.toShop;
  $('btn-shop-menu').textContent = T.saveAndMenu;
  $('btn-share').textContent = T.share;
  $('btn-again').textContent = T.again;
  $('btn-end-menu').textContent = T.menu;
  $('btn-top').textContent = T.top10;
  $('hs-nick-label').textContent = T.nickLabel;
  $('hs-nick').placeholder = T.nickPlaceholder;
  $('hs-submit').textContent = T.submit;
  $('btn-fire').textContent = T.fire;
  $('btn-pause').textContent = T.pause;
}

// A saved run is a plain object; anything odd in it (or an old version) is dropped.
function loadRun() {
  const r = store.get(RUN_KEY);
  if (!r || r.version !== CAMPAIGN_VERSION || r.over || r.finished || !Array.isArray(r.log) || r.level < 2 || r.level > MAX_LEVEL) return null;
  return r;
}

async function boot() {
  fillStaticText();
  show('loading');
  if (embedded && 'ResizeObserver' in window) new ResizeObserver(postSize).observe(document.querySelector('.gh-app'));
  // the canvas draws numbers in VT323: wait for the font (never longer than the asset load)
  const fontReady = document.fonts ? document.fonts.load('34px VT323').catch(() => null) : null;
  const assets = await loadAssets('img/gold-hook/manifest.json');
  await fontReady;
  if (!assets.ok) { showError(assets); return; }

  const game = createGame({ reactionMs: reactionDurations(assets.manifest) });
  const renderer = createRenderer(canvas, assets);
  new ResizeObserver(() => renderer.resize()).observe(canvas);
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const announcer = createAnnouncer($('live'));
  const cfg = window.PEP_GRY || {};
  const scores = createScores(fetchRpc(cfg));
  const btnFire = $('btn-fire'), btnDyn = $('btn-dynamite'), btnPause = $('btn-pause');
  let run = null;
  let handledResult = null;
  let last = null;
  let lastStats = '';

  // ---------- top 10 (menu and end screen) ----------
  async function loadTop(box, list, force = false) {
    box.hidden = false;
    list.replaceChildren(el('li', { textContent: T.loadingTop }));
    try {
      const rows = await scores.top({ force });
      list.replaceChildren(...(rows.length ? rows.map((r) => el('li', {},
        el(r.verified ? 'b' : 'span', { textContent: r.nick + (r.verified ? ' ✓' : '') }), ' ',
        el('small', { textContent: Number(r.score).toLocaleString('en-US') }))) : [el('li', { textContent: T.emptyTop })]));
    } catch (err) {
      list.replaceChildren(el('li', { textContent: isNotDeployed(err) ? T.soon : err.message }));
    }
    postSize();
  }

  // ---------- main menu ----------
  function toggle(btn, box) {
    const open = box.hidden;
    for (const [b, x] of [['btn-howto', 'menu-howto'], ['btn-menu-top', 'menu-top-box'], ['btn-stats', 'menu-stats']]) {
      $(b).setAttribute('aria-expanded', 'false'); $(x).hidden = true;
    }
    btn.setAttribute('aria-expanded', String(open));
    box.hidden = !open;
    postSize();
    return open;
  }
  function showMenu() {
    pause(game);
    game.app = APP.TITLE;
    const saved = loadRun();
    const cont = $('btn-continue');
    cont.hidden = !saved;
    if (saved) cont.textContent = T.continueRun(saved.level, saved.money);
    for (const id of ['menu-howto', 'menu-top-box', 'menu-stats']) $(id).hidden = true;
    show('menu');
  }
  $('btn-continue').addEventListener('click', () => { const saved = loadRun(); if (saved) { run = saved; showShop(); } });
  $('btn-new').addEventListener('click', () => { run = newRun(); store.del(RUN_KEY); showLevel(); });
  $('btn-howto').addEventListener('click', (e) => toggle(e.currentTarget, $('menu-howto')));
  $('btn-menu-top').addEventListener('click', (e) => { if (toggle(e.currentTarget, $('menu-top-box'))) loadTop($('menu-top-box'), $('menu-top')); });
  $('btn-menu-top').hidden = !scores.enabled;
  $('btn-stats').addEventListener('click', async (e) => {
    const box = $('menu-stats');
    if (!toggle(e.currentTarget, box)) return;
    const local = store.get(STATS_KEY) || { best: 0, level: 0, runs: 0 };
    const lines = [el('p', { textContent: T.statsLocal(local) })];
    const session = readSession(cfg);
    const account = el('p', { textContent: session && session.discord ? T.statsLoading : T.statsGuest });
    lines.push(account);
    box.replaceChildren(...lines);
    if (session && session.discord && scores.enabled) {
      try {
        const me = await scores.me();
        account.textContent = me ? T.statsAccount(me) : T.statsAccountEmpty;
      } catch (err) {
        account.textContent = isNotDeployed(err) ? T.soon : err.message;
      }
      postSize();
    }
  });

  // ---------- a level ----------
  function showLevel() {
    const def = levelDef(run.level);
    const mods = modsFor(run);
    setLevel(game, def, mods);
    game.app = APP.TITLE;
    handledResult = null;
    $('level-title').textContent = T.levelTitle(run.level, MAX_LEVEL);
    $('level-goal').textContent = T.levelGoal(def.target, def.durationSec + mods.extraSec);
    $('level-notes').textContent = T.levelNotes(mods, def.weight < 1);
    show('level');
  }
  $('btn-go').addEventListener('click', () => {
    startRound(game);
    last = null;
    announcer.say(T.srLevel(game.level, game.target, Math.round(game.duration)));
    show(null);
  });

  function onLevelEnd(result) {
    finishLevel(run, result);
    if (run.over || run.finished) { store.del(RUN_KEY); showEnd(result); return; }
    store.set(RUN_KEY, run);
    announcer.say(T.srCleared(result.level));
    $('cleared-title').textContent = T.clearedTitle(result.level);
    $('cleared-line').textContent = T.clearedLine(result.score, result.target);
    $('cleared-wallet').textContent = T.clearedWallet(run.money);
    show('cleared');
  }

  // ---------- shop ----------
  function renderShop() {
    $('shop-title').textContent = T.shopTitle(run.level);
    $('shop-wallet').textContent = T.shopWallet(run.money);
    $('shop-note').textContent = T.shopNote;
    $('btn-next-level').textContent = T.nextLevel(run.level);
    $('shop-list').replaceChildren(...SHOP_ITEMS.map((item) => {
      const info = T.items[item];
      const price = priceOf(run, item);
      const icon = el('img', { className: 'shop-icon', src: `img/gold-hook/ui/pm-shop-${item}.png`, width: 32, height: 32, alt: '' });
      const btn = el('button', { type: 'button', className: 'pm-btn shop-buy', disabled: !canBuy(run, item) });
      if (price === null) btn.textContent = T.maxed;
      else btn.append(T.buyLabel, el('span', { className: 'price', textContent: Number(price).toLocaleString('en-US') }), ' PEP');
      btn.setAttribute('aria-label', price === null ? `${info.name}: ${T.maxed}` : `${T.buyLabel} ${info.name}, ${price} PEP`);
      btn.addEventListener('click', () => {
        if (!buy(run, item)) return;
        store.set(RUN_KEY, run);
        announcer.say(T.srBought(info.name, run.money));
        renderShop();
        const again = $('shop-list').querySelectorAll('.shop-buy')[SHOP_ITEMS.indexOf(item)];
        (again.disabled ? $('btn-next-level') : again).focus({ preventScroll: true });
      });
      const owned = T.owned(item, run);
      return el('li', { className: `shop-item${owned ? ' owned' : ''}` }, icon,
        el('div', { className: 'shop-name' }, info.name, owned ? el('span', { className: 'owned-tag', textContent: owned }) : ''),
        el('div', { className: 'shop-text', textContent: info.text }),
        btn);
    }));
    postSize();
  }
  function showShop() { renderShop(); show('shop'); }
  $('btn-to-shop').addEventListener('click', showShop);
  $('btn-next-level').addEventListener('click', showLevel);
  $('btn-shop-menu').addEventListener('click', showMenu);

  // ---------- end of the run ----------
  const form = $('hs-form');
  try { $('hs-nick').value = localStorage.getItem('pondos-nick') || ''; } catch { /* ignore */ }
  function showEnd(result) {
    const finished = run.finished;
    const level = run.log.length;
    announcer.say(T.srOver(run.total, level));
    $('end-title').textContent = finished ? T.winAllTitle : T.overTitle;
    $('end-line').textContent = T.endLine(run.total, level);
    $('end-text').textContent = finished ? T.winAllText : T.overText(result.score, result.target);
    // stats on this device
    const s = store.get(STATS_KEY) || { best: 0, level: 0, runs: 0 };
    const isNew = run.total > s.best;
    store.set(STATS_KEY, { best: Math.max(s.best, run.total), level: Math.max(s.level, level), runs: s.runs + 1 });
    $('end-best').textContent = isNew ? T.newBest(run.total) : T.best(s.best);
    $('end-trophy').hidden = !(finished || isNew);
    // submit form
    const session = readSession(cfg);
    const verified = !!(session && session.discord);
    const v = validateCampaign(submission(run));
    form.hidden = !(scores.enabled && v.ok && v.score > 0);
    $('hs-discord').hidden = !verified;
    $('hs-discord').textContent = verified ? T.submitAsDiscord(run.total) : '';
    $('hs-nick-row').hidden = verified;
    $('hs-note').hidden = verified;
    $('hs-note').textContent = verified ? '' : T.discordNote;
    const sb = $('hs-submit');
    sb.hidden = false; sb.disabled = false; sb.textContent = T.submit;
    $('hs-status').textContent = '';
    $('share-status').textContent = '';
    $('hs-top-box').hidden = true;
    $('btn-top').hidden = !scores.enabled;
    show('end');
  }
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const session = readSession(cfg);
    const nick = $('hs-nick').value.trim();
    if (!(session && session.discord)) {
      if (nick.length < 2) { $('hs-nick').focus(); return; }
      try { localStorage.setItem('pondos-nick', nick); } catch { /* ignore */ }
    }
    const sb = $('hs-submit');
    sb.disabled = true; sb.textContent = T.sending;
    $('hs-status').textContent = '';
    try {
      const r = await scores.submit(run, nick);
      $('hs-status').textContent = T.saved(r.nick, r.verified, r.place);
      for (const id of ['hs-nick-row', 'hs-discord', 'hs-submit', 'hs-note']) $(id).hidden = true;
      loadTop($('hs-top-box'), $('hs-top'), true);
    } catch (err) {
      $('hs-status').textContent = isNotDeployed(err) ? T.soon : err.message;
      sb.disabled = false; sb.textContent = T.submit;
    }
    postSize();
  });
  $('btn-share').addEventListener('click', async () => {
    const text = T.shareText(run.total, run.log.length, run.finished);
    const url = 'https://pepecoinhub.com/games/gold-hook.html';
    const status = $('share-status');
    try {
      if (navigator.share) { await navigator.share({ title: 'Pepe Gold Hook', text, url }); status.textContent = T.shared; return; }
      await navigator.clipboard.writeText(`${text} ${url}`);
      status.textContent = T.copied;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      try { await navigator.clipboard.writeText(`${text} ${url}`); status.textContent = T.copied; } catch { status.textContent = T.shareFailed; }
    }
  });
  $('btn-again').addEventListener('click', () => { run = newRun(); showLevel(); });
  $('btn-end-menu').addEventListener('click', showMenu);
  $('btn-top').addEventListener('click', () => loadTop($('hs-top-box'), $('hs-top')));

  // ---------- playing ----------
  const actions = {
    pause() { if (pause(game)) { announcer.say(T.srPaused); show('pause'); } },
    resume() { if (resume(game)) { last = null; announcer.say(T.srResumed); show(null); } },
    dynamite() { useDynamite(game); },
  };
  $('btn-resume').addEventListener('click', actions.resume);
  $('btn-exit').addEventListener('click', showMenu);
  btnPause.addEventListener('click', actions.pause);
  btnFire.addEventListener('click', () => fire(game));
  btnDyn.addEventListener('click', actions.dynamite);
  attachInput(canvas, {
    onFire: () => fire(game),
    onDynamite: () => screen === null && actions.dynamite(),
    onPauseKey: () => {
      if (screen === null && game.app === APP.PLAYING) { actions.pause(); return true; }
      if (screen === 'pause') { actions.resume(); return true; }
      return false;
    },
  });

  // A hidden tab, or a minimized PondOS window, pauses the game.
  document.addEventListener('visibilitychange', () => { if (document.hidden && game.app === APP.PLAYING) actions.pause(); else last = null; });
  window.addEventListener('message', (e) => {
    if (e.origin === location.origin && e.source === parent && (e.data === 'pause' || e.data === 'gold-hook-pause') && game.app === APP.PLAYING) actions.pause();
  });

  function syncControls() {
    const playing = game.app === APP.PLAYING && screen === null;
    btnFire.disabled = !playing;
    btnPause.disabled = !playing;
    btnDyn.disabled = !(playing && game.dynamite > 0 && game.hook.cargo);
    const label = T.dynamite(game.dynamite);
    if ($('dyn-label').textContent !== label) { $('dyn-label').textContent = label; btnDyn.setAttribute('aria-label', T.dynamiteLabel(game.dynamite)); }
  }

  function handleEvents() {
    for (const e of drainEvents(game)) {
      if (e.type === 'score') announcer.say(T.srScore(e.points, e.total), { replaceKey: 'Plus' });
      else if (e.type === 'empty') announcer.say(T.srEmpty, { replaceKey: T.srEmpty });
      else if (e.type === 'dynamite') announcer.say(T.srDynamite(e.left));
      else if (e.type === 'barrel') announcer.say(T.srBarrel);
      else if (e.type === 'time') announcer.say(T.srTime(e.seconds));
    }
  }

  function frame(now) {
    const dt = last === null ? 0 : (now - last) / 1000;
    last = now;
    update(game, dt);             // the logic caps time jumps and only runs in PLAYING
    handleEvents();
    if (game.app === APP.RESULT && game.result !== handledResult) { handledResult = game.result; onLevelEnd(game.result); }
    syncControls();
    const s = T.srStats(game.score, game.target, Math.ceil(game.timeLeft));
    if (s !== lastStats) { $('stats').textContent = s; lastStats = s; }
    renderer.draw(game, { reducedMotion: motionQuery.matches });
    requestAnimationFrame(frame);
  }

  showMenu();
  requestAnimationFrame(frame);
}

boot().catch((err) => {
  console.error(err);
  showError({ errors: [String((err && err.message) || err)] });
});
