// Cosmetic reactions to the desktop. The frog and its toys always stay in the taskbar slot.
import { playableCompanion } from './pepegochi-personality.mjs?v=20261118dialog1';

export const APP_REACTIONS = Object.freeze({
  tv: 'desktopTV', bin: 'desktopBin', games: 'desktopGames', find: 'desktopFind',
  'wp-folder': 'desktopGuesser', 'wp-hof': 'desktopGuesser', notes: 'desktopNotes',
  'wp-readme': 'desktopNotes', nerds: 'desktopNerds', ads: 'desktopTV', about: 'desktopNotes',
});
export const AUTO_PLAY_AFTER_MS = 300000;
const TOYS = ['ball', 'duck', 'cap'];
const ACTION = { ball: 'toyBall', duck: 'toyDuck', cap: 'toyCap' };

export function mountDesktopCompanion({ slot, getView, eligible, mayStart, react, showToy, onAutoToy, now = Date.now }) {
  const doc = slot.ownerDocument, win = doc.defaultView;
  const reduce = win.matchMedia('(prefers-reduced-motion: reduce)');
  let lastApp = -Infinity, lastRomp = now(), disposed = false;
  const allowed = (manual = false) => !disposed && slot.isConnected && !doc.hidden &&
    playableCompanion(getView()) && eligible(manual);
  const fireflyAvailable = () => allowed(true) && !reduce.matches &&
    doc.documentElement.classList.contains('sky-night') &&
    !!doc.querySelector('.sky:not([hidden]) .scene-night.ready .sky-fly');

  function playToy(kind, manual = true) {
    if (!TOYS.includes(kind) || !allowed(manual) || (reduce.matches && !manual)) return false;
    if (!manual && !mayStart(false)) return false;
    showToy(kind);
    if (!manual) onAutoToy(ACTION[kind]);
    return true;
  }
  function ambient() {
    if (!allowed() || !mayStart(false) || reduce.matches || now() - lastRomp < AUTO_PLAY_AFTER_MS) return false;
    const kind = TOYS[Math.abs(Math.floor(now() / AUTO_PLAY_AFTER_MS)) % TOYS.length];
    if (!playToy(kind, false)) return false;
    lastRomp = now();
    return true;
  }
  function onApp(event) {
    const { id, host } = event.detail || {};
    if (!Object.hasOwn(APP_REACTIONS, id) || !host?.isConnected || !host.matches('.app-win') ||
        !allowed() || !mayStart(false) || now() - lastApp < 45000) return;
    lastApp = now();
    react(APP_REACTIONS[id]);
  }
  win.addEventListener('pondos:app-opened', onApp);
  return {
    ambient, playToy,
    // Kept for the taskbar controller's lifecycle. No full-screen animation exists to stop.
    stop() {}, get active() { return false; },
    fireflyAvailable,
    catchNearby() {
      if (!fireflyAvailable()) return false;
      showToy('firefly', 1600);
      react('desktopFirefly');
      return true;
    },
    reset() { lastApp = -Infinity; lastRomp = now(); },
    dispose() { disposed = true; win.removeEventListener('pondos:app-opened', onApp); },
  };
}
