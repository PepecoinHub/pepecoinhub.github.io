// Local cosmetic theatre. Toys stay beside the taskbar frog; a real night firefly may be chased.
import { playableCompanion } from './pepegochi-personality.mjs?v=20261118dialog1';

export const APP_REACTIONS = Object.freeze({
  tv: 'desktopTV', bin: 'desktopBin', games: 'desktopGames', find: 'desktopFind',
  'wp-folder': 'desktopGuesser', 'wp-hof': 'desktopGuesser', notes: 'desktopNotes',
  'wp-readme': 'desktopNotes', nerds: 'desktopNerds', ads: 'desktopTV', about: 'desktopNotes',
});
export const AUTO_PLAY_AFTER_MS = 300000;
const TOYS = ['ball', 'duck', 'cap'];
const ACTION = { ball: 'toyBall', duck: 'toyDuck', cap: 'toyCap' };
const BLOCKED = 'a,button,input,select,textarea,label,iframe,header,.win,.app-win,.pg-fact,.desk-corner,.os-dialog,[role="dialog"],[contenteditable]';
const center = r => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
const at = (x, y) => `translate(${Math.round(x)}px,${Math.round(y)}px)`;

export function mountDesktopCompanion({ slot, img, getView, eligible, mayStart, react, showToy, onAutoToy,
  onStart = () => {}, onEnd = () => {}, base = '../', now = Date.now }) {
  const doc = slot.ownerDocument, win = doc.defaultView;
  const reduce = win.matchMedia('(prefers-reduced-motion: reduce)');
  let effect = null, lastFly = -Infinity, lastApp = -Infinity, lastRomp = now(), disposed = false;
  const allowed = (manual = false) => !disposed && slot.isConnected && !doc.hidden &&
    playableCompanion(getView()) && eligible(manual);
  const canMove = (manual = false) => allowed(manual) && mayStart(manual) && !effect && !reduce.matches;
  const night = () => doc.documentElement.classList.contains('sky-night') &&
    !!doc.querySelector('.sky:not([hidden]) .scene-night.ready') && !doc.querySelector('.sky-fast');
  const exposed = (x, y) => {
    const target = doc.elementFromPoint(x, y);
    return !!target && !target.closest(BLOCKED);
  };
  function flies() {
    if (!night() || reduce.matches) return [];
    const scene = doc.querySelector('.sky:not([hidden]) .scene-night.ready');
    if (Number(win.getComputedStyle(scene).opacity) < .65) return [];
    return [...doc.querySelectorAll('.sky:not([hidden]) .scene-night.ready .sky-fly')].flatMap(node => {
      const r = node.getBoundingClientRect(), c = center(r);
      if (!r.width || c.x < 8 || c.y < 8 || c.x > win.innerWidth - 8 || c.y > win.innerHeight - 45 ||
          Number(win.getComputedStyle(node).opacity) < .55 || !exposed(c.x, c.y)) return [];
      return [{ node, ...c }];
    });
  }
  function nearbyFly() {
    const visible = flies();
    if (!visible.length) return null;
    const c = center(img.getBoundingClientRect());
    return visible.sort((a, b) => Math.hypot(a.x-c.x,a.y-c.y) - Math.hypot(b.x-c.x,b.y-c.y))
      .find(f => Math.hypot(f.x-c.x,f.y-c.y) < 400) || null;
  }
  function stop() {
    if (!effect) return;
    const old = effect; effect = null;
    win.clearTimeout(old.timer); win.cancelAnimationFrame(old.watch);
    for (const animation of old.animations) animation.cancel();
    for (const node of old.nodes) node.remove();
    old.fly.classList.remove('pg-fly-borrowed');
    slot.classList.remove('pg-desktop-away');
    onEnd();
  }
  function catchFly(target, manual = false) {
    if (!target || !canMove(manual) || now() - lastFly < 45000 || !img.animate) return false;
    const r = img.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    lastFly = now(); onStart();
    const young = !getView()?.adult;
    const mouth = { x: r.left + r.width * .68, y: r.top + r.height * (young ? .68 : .48) };
    const approach = { x: mouth.x + (mouth.x < win.innerWidth - 65 ? 42 : -42), y: mouth.y - 14 };
    const current = effect = { animations: [], nodes: [], fly: target.node, timer: 0, watch: 0 };
    target.node.classList.add('pg-fly-borrowed');
    const add = (tag, cls) => {
      const node = doc.createElement(tag); node.className = cls; node.setAttribute('aria-hidden', 'true');
      doc.body.append(node); current.nodes.push(node); return node;
    };
    const animate = (node, frames, options) => {
      current.animations.push(node.animate(frames, { fill: 'forwards', ...options }));
    };
    const glow = add('span', 'pg-desktop-firefly');
    animate(glow, [
      { transform: at(target.x, target.y), opacity: 1 },
      { transform: at(approach.x + 18, approach.y - 12), offset: .6 },
      { transform: at(approach.x, approach.y), offset: .8 },
      { transform: at(mouth.x, mouth.y), opacity: 0 },
    ], { duration: 1300, easing: 'linear' });
    const frog = add('img', 'pg-desktop-frog-frame');
    frog.src = young ? img.src : base + 'games/img/pepegochi/taskbar/anim/tb_curious_03.png?v=20261113stand'; frog.alt = '';
    const step = target.x >= mouth.x ? 18 : -18;
    animate(frog, [
      { transform: at(r.left, r.top) },
      { transform: at(r.left + step, r.top - 9), offset: .48 },
      { transform: at(r.left + step, r.top - 9), offset: .72 },
      { transform: at(r.left, r.top) },
    ], { duration: 1450, easing: 'steps(12,end)' });
    slot.classList.add('pg-desktop-away');
    const tongue = add('span', 'pg-desktop-tongue');
    tongue.style.left = Math.round(mouth.x) + 'px'; tongue.style.top = Math.round(mouth.y) + 'px';
    tongue.style.width = Math.round(Math.hypot(approach.x - mouth.x, approach.y - mouth.y)) + 'px';
    const rotation = Math.atan2(approach.y - mouth.y, approach.x - mouth.x);
    animate(tongue, [{ transform: `rotate(${rotation}rad) scaleX(0)` },
      { transform: `rotate(${rotation}rad) scaleX(1)`, offset: .48 },
      { transform: `rotate(${rotation}rad) scaleX(0)` }], { delay: 930, duration: 420 });
    const watch = () => {
      if (effect !== current) return;
      if (!allowed(manual) || reduce.matches || !night()) { stop(); return; }
      current.watch = win.requestAnimationFrame(watch);
    };
    current.watch = win.requestAnimationFrame(watch);
    current.timer = win.setTimeout(() => { stop(); if (allowed(manual)) react('desktopFirefly'); }, 1450);
    return true;
  }
  function playToy(kind, manual = true) {
    if (!TOYS.includes(kind) || !allowed(manual) || (reduce.matches && !manual)) return false;
    if (!manual && !mayStart(false)) return false;
    showToy(kind);
    if (!manual) onAutoToy(ACTION[kind]);
    return true;
  }
  function ambient() {
    if (!canMove()) return false;
    if (now() - lastFly >= 90000 && catchFly(nearbyFly())) return true;
    if (now() - lastRomp < AUTO_PLAY_AFTER_MS) return false;
    const kind = TOYS[Math.abs(Math.floor(now() / AUTO_PLAY_AFTER_MS)) % TOYS.length];
    if (!playToy(kind, false)) return false;
    lastRomp = now();
    return true;
  }
  function onClick(event) {
    if (event.defaultPrevented || event.button !== 0 || event.target.closest?.(BLOCKED) || !canMove(true)) return;
    const target = flies().find(f => Math.hypot(f.x-event.clientX,f.y-event.clientY) <= 16);
    if (target) catchFly(target, true);
  }
  function onApp(event) {
    const { id, host } = event.detail || {};
    if (!Object.hasOwn(APP_REACTIONS, id) || !host?.isConnected || !host.matches('.app-win') ||
        !allowed() || !mayStart(false) || now() - lastApp < 45000) return;
    lastApp = now(); react(APP_REACTIONS[id]);
  }
  const onInput = () => stop();
  const onVisibility = () => { if (doc.hidden) stop(); };
  const onReduce = () => { if (reduce.matches) stop(); };
  win.addEventListener('pondos:app-opened', onApp);
  doc.addEventListener('click', onClick);
  doc.addEventListener('pointerdown', onInput, true);
  doc.addEventListener('keydown', onInput, true);
  doc.addEventListener('visibilitychange', onVisibility);
  win.addEventListener('resize', onInput);
  reduce.addEventListener?.('change', onReduce);
  return {
    ambient, playToy, stop, get active() { return !!effect; },
    fireflyAvailable: () => canMove(true) && now() - lastFly >= 45000 && !!nearbyFly(),
    catchNearby: () => catchFly(nearbyFly(), true),
    reset() { stop(); lastFly = lastApp = -Infinity; lastRomp = now(); },
    dispose() {
      disposed = true; stop(); win.removeEventListener('pondos:app-opened', onApp);
      doc.removeEventListener('click', onClick); doc.removeEventListener('pointerdown', onInput, true);
      doc.removeEventListener('keydown', onInput, true); doc.removeEventListener('visibilitychange', onVisibility);
      win.removeEventListener('resize', onInput); reduce.removeEventListener?.('change', onReduce);
    },
  };
}
