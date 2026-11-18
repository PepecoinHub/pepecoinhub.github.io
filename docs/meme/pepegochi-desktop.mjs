// Local desktop theatre, not a source of pet state, care, achievements or rewards.
import { healthyCompanion } from './pepegochi-personality.mjs?v=20261116sass1';

export const APP_REACTIONS = Object.freeze({
  tv: 'desktopTV', bin: 'desktopBin', games: 'desktopGames', find: 'desktopFind',
  'wp-folder': 'desktopGuesser', 'wp-hof': 'desktopGuesser', notes: 'desktopNotes',
  'wp-readme': 'desktopNotes', nerds: 'desktopNerds', ads: 'desktopTV', about: 'desktopNotes',
});
const PERCH = new Set(['bin', 'games', 'find', 'wp-folder', 'wp-hof', 'notes', 'wp-readme', 'nerds', 'ads', 'about']);
const BLOCKED = 'a,button,input,select,textarea,label,iframe,header,.win,.app-win,.pg-fact,.desk-corner,.os-dialog,[role="dialog"],[contenteditable]';
const center = r => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
const at = (x, y) => `translate(${Math.round(x)}px,${Math.round(y)}px)`;

export function perchPoint(rect, width, height, frogWidth = 48, frogHeight = 48) {
  if (width < 761 || rect.top < frogHeight || rect.top > height - 60 || rect.width < 120) return null;
  const x = Math.round(Math.min(width - frogWidth - 8, Math.max(8, rect.left + rect.width * .3)));
  if (x + frogWidth > rect.right || x < rect.left) return null;
  return { x, y: Math.round(rect.top - frogHeight + 1) };
}

export function mountDesktopCompanion({ slot, img, getView, eligible, mayStart, react, onStart, onEnd, base, now = Date.now }) {
  const doc = slot.ownerDocument, win = doc.defaultView;
  const reduce = win.matchMedia('(prefers-reduced-motion: reduce)');
  let effect = null, lastFly = -Infinity, lastApp = -Infinity, disposed = false;
  const allowed = () => !disposed && slot.isConnected && healthyCompanion(getView()) && eligible() && !doc.hidden;
  const canStart = () => allowed() && mayStart() && !effect;
  const canMove = () => canStart() && !reduce.matches;
  const night = () => doc.documentElement.classList.contains('sky-night') && !!doc.querySelector('.sky:not([hidden]) .scene-night.ready') && !doc.querySelector('.sky-fast');
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
  function stop() {
    if (!effect) return;
    const old = effect; effect = null;
    win.clearTimeout(old.timer); win.cancelAnimationFrame(old.watch);
    for (const anim of old.animations) anim.cancel();
    for (const node of old.nodes) node.remove();
    old.fly?.classList.remove('pg-fly-borrowed');
    slot.classList.remove('pg-desktop-away');
    onEnd();
  }
  function begin(kind, valid) {
    onStart();
    const current = effect = { kind, valid, animations: [], nodes: [], timer: 0, watch: 0 };
    function watch() {
      if (effect !== current) return;
      if (!allowed() || reduce.matches || !valid()) { stop(); return; }
      current.watch = win.requestAnimationFrame(watch);
    }
    current.watch = win.requestAnimationFrame(watch);
    return current;
  }
  function add(current, tag, cls) {
    const node = doc.createElement(tag); node.className = cls; node.setAttribute('aria-hidden', 'true');
    doc.body.append(node); current.nodes.push(node); return node;
  }
  function animate(current, node, frames, options) {
    const animation = node.animate(frames, { fill: 'forwards', ...options });
    current.animations.push(animation); return animation;
  }
  function catchFly(target) {
    if (!target || !canMove() || now() - lastFly < 45000 || !img.animate) return false;
    const r = img.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    lastFly = now();
    const mouth = { x: r.left + r.width * .68, y: r.top + r.height * .48 };
    const approach = { x: mouth.x + (mouth.x < win.innerWidth - 65 ? 42 : -42), y: mouth.y - 14 };
    const current = begin('firefly', () => night());
    current.fly = target.node; target.node.classList.add('pg-fly-borrowed');
    const glow = add(current, 'span', 'pg-desktop-firefly');
    animate(current, glow, [
      { transform: at(target.x, target.y), opacity: 1 },
      { transform: at(approach.x + 18, approach.y - 12), offset: .6 },
      { transform: at(approach.x, approach.y), offset: .8 },
      { transform: at(mouth.x, mouth.y), opacity: 0 },
    ], { duration: 1300, easing: 'linear' });
    const frog = add(current, 'img', 'pg-desktop-frog-frame');
    frog.src = base + 'games/img/pepegochi/taskbar/anim/tb_curious_03.png?v=20261113stand'; frog.alt = '';
    frog.style.transform = at(r.left, r.top);
    slot.classList.add('pg-desktop-away');
    const tongue = add(current, 'span', 'pg-desktop-tongue');
    tongue.style.left = Math.round(mouth.x) + 'px'; tongue.style.top = Math.round(mouth.y) + 'px';
    tongue.style.width = Math.round(Math.hypot(approach.x - mouth.x, approach.y - mouth.y)) + 'px';
    const rotation = Math.atan2(approach.y - mouth.y, approach.x - mouth.x);
    animate(current, tongue, [{ transform: `rotate(${rotation}rad) scaleX(0)` }, { transform: `rotate(${rotation}rad) scaleX(1)`, offset: .48 }, { transform: `rotate(${rotation}rad) scaleX(0)` }], { delay: 930, duration: 420 });
    current.timer = win.setTimeout(() => { stop(); if (allowed()) react('desktopFirefly'); }, 1450);
    return true;
  }
  function ambient() {
    if (!canMove() || now() - lastFly < 90000) return false;
    const r = img.getBoundingClientRect(), c = center(r);
    const candidates = flies().sort((a, b) => Math.hypot(a.x-c.x,a.y-c.y) - Math.hypot(b.x-c.x,b.y-c.y));
    // Only borrow a genuinely visible nearby light, rather than inventing flies on the day wallpaper.
    return candidates.length > 0 && Math.hypot(candidates[0].x-c.x,candidates[0].y-c.y) < 400 && catchFly(candidates[0]);
  }
  function onClick(event) {
    if (event.defaultPrevented || event.button !== 0 || event.target.closest?.(BLOCKED) || !canMove()) return;
    const target = flies().find(f => Math.hypot(f.x - event.clientX, f.y - event.clientY) <= 16);
    if (target) catchFly(target);
  }
  function perch(host, action) {
    if (!canMove() || !img.animate || !host?.isConnected || host.matches('.is-min,.is-max,.app-full') || host.querySelector('iframe')) return false;
    const rect = host.getBoundingClientRect(), to = perchPoint(rect, win.innerWidth, win.innerHeight);
    const r = img.getBoundingClientRect();
    if (!to || !r.width || !r.height || !exposed(to.x + 24, to.y + 20)) return false;
    const from = { x: r.left, y: r.top };
    const current = begin('perch', () => {
      if (!host.isConnected || host.matches('.is-min,.is-max,.app-full')) return false;
      const next = host.getBoundingClientRect();
      return Math.abs(next.left - rect.left) < 2 && Math.abs(next.top - rect.top) < 2 && Math.abs(next.width - rect.width) < 2;
    });
    const frog = add(current, 'img', 'pg-desktop-frog-frame'); frog.src = img.src; frog.alt = '';
    slot.classList.add('pg-desktop-away');
    const mid = (a, b) => at((a.x + b.x) / 2, (a.y + b.y) / 2 - 55);
    animate(current, frog, [{ transform: at(from.x, from.y) }, { transform: mid(from,to), offset: .11 }, { transform: at(to.x,to.y), offset: .22 }, { transform: at(to.x,to.y), offset: .78 }, { transform: mid(to,from), offset: .89 }, { transform: at(from.x,from.y) }], { duration: 3600, easing: 'steps(20,end)' });
    current.timer = win.setTimeout(() => { stop(); if (allowed()) react(action); }, 3600);
    return true;
  }
  function popcorn(host) {
    if (!canMove() || !host?.isConnected || !img.animate) return false;
    const r = img.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const current = begin('popcorn', () => host.isConnected && !host.matches('.is-min'));
    const snack = add(current, 'span', 'pg-desktop-popcorn');
    const x = Math.min(win.innerWidth - 20, r.right - 8), y = r.bottom - 19;
    animate(current, snack, [{ transform: at(x, y+16), opacity: 0 }, { transform: at(x, y), opacity: 1, offset: .2 }, { transform: at(x, y), opacity: 1, offset: .85 }, { transform: at(x, y+16), opacity: 0 }], { duration: 2600, easing: 'steps(8,end)' });
    current.timer = win.setTimeout(() => { stop(); if (allowed()) react('desktopTV'); }, 2600);
    return true;
  }
  function onApp(event) {
    const { id, host } = event.detail || {};
    if (!Object.hasOwn(APP_REACTIONS, id) || !host?.isConnected || !host.matches('.app-win') || !canStart() || now() - lastApp < 45000) return;
    lastApp = now();
    // Perching is only for harmless non-game utility windows. The existing reaction channel owns dialogue throttling.
    if (id === 'tv' && popcorn(host)) return;
    if (PERCH.has(id) && perch(host, APP_REACTIONS[id])) return;
    react(APP_REACTIONS[id]);
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
  return { ambient, stop, get active() { return !!effect; }, fireflyAvailable: () => allowed() && !effect && now() - lastFly >= 45000 && flies().length > 0,
    catchNearby: () => catchFly(flies()[0]), reset() { stop(); lastFly = lastApp = -Infinity; }, dispose() {
    disposed = true; stop(); win.removeEventListener('pondos:app-opened', onApp); doc.removeEventListener('click', onClick);
    doc.removeEventListener('pointerdown', onInput, true); doc.removeEventListener('keydown', onInput, true);
    doc.removeEventListener('visibilitychange', onVisibility); win.removeEventListener('resize', onInput);
    reduce.removeEventListener?.('change', onReduce);
  } };
}
