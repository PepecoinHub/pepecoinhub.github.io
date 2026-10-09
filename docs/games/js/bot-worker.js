// Web Worker: the bot thinks here, so the page stays smooth.
import { botMove } from './bots.js';
self.onmessage = (e) => {
  const { id, game, st, level } = e.data;
  try { self.postMessage({ id, move: botMove(game, st, level) }); } catch (err) { self.postMessage({ id, error: String(err?.message || err) }); }
};
