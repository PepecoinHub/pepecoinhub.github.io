// "Play vs bot": the same table page, but the game runs only in this browser (no server, no account, nothing saved online).
// It answers the same calls as the server (gry_table_*) with the same state shape, using engines.js (= the server rules).
import * as E from './engines.js';
import { botMove, botFleet, LEVELS } from './bots.js';

const NAMES = { chess: ['White', 'Black'], checkers: ['Black', 'White'], connect4: ['Red', 'Yellow'], battleship: ['Blue', 'Orange'] };
const TITLE = { chess: 'Chess', checkers: 'Checkers', connect4: 'Connect Four', battleship: 'Sea Battle' };

export function localTable({ game, level, nick, noTouch = false }) {
  if (!TITLE[game]) throw new Error('Unknown game');
  if (!LEVELS[level]) level = 'medium';
  const KEY = `pep-bot-${game}-${level}`;
  const botNick = `Bot (${LEVELS[level]})`;
  let T, listener = null, thinking = false, worker = null, reqId = 0;
  const pending = new Map();

  function fresh(humanSeat = 1, gameNo = 1, msgs = []) {
    const pos = E.tgStart(game);
    T = { game, level, noTouch, human: humanSeat, status: 'playing', pos, turn: 1, legal: game === 'battleship' ? [] : E.tgLegal(game, pos),
      history: [], reps: game === 'chess' ? [E.chKey(pos, E.tgLegal(game, pos))] : [], last_move: null, result: null, reason: null,
      game_no: gameNo, version: 1, move_at: new Date().toISOString(), fleets: {}, msgs, msgId: msgs.length ? msgs[msgs.length - 1].id : 0, nick: nick || 'You' };
    if (game === 'battleship') T.fleets[3 - humanSeat] = E.seaParse(botFleet(noTouch), noTouch);
    sys(`New game vs ${botNick}. You play ${NAMES[game][humanSeat - 1]}.` + (game === 'battleship' ? ' Place your ships.' : ''));
  }
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(T)); } catch {} };
  function sys(body) { T.msgs.push({ id: ++T.msgId, kind: 'system', nick: null, body, at: new Date().toISOString() }); if (T.msgs.length > 50) T.msgs.shift(); }
  const notify = () => { T.version++; save(); listener?.('state', { v: T.version }); };
  const seatNick = (seat) => (seat === T.human ? T.nick : botNick);

  function finish(result, reason) {
    T.status = 'finished'; T.result = result; T.reason = reason; T.legal = [];
    sys(result === 'draw' ? `Draw (${reason})` : `${seatNick(result === 'p1' ? 1 : 2)} wins (${reason})`);
  }
  function state() {
    const t = T, hs = t.human, joined = true;
    const seaPhase = game === 'battleship' ? t.pos.split('|')[0] : null;
    return {
      now: new Date().toISOString(), bot: { level, name: botNick, thinking },
      table: { code: 'BOT', game, private: true, spectators: false, status: t.status, turn: t.turn, last_move: t.last_move, result: t.result,
        reason: t.reason, draw_offer: null, rematch: 0, game_no: t.game_no, version: t.version, creator_id: 'you', move_at: t.move_at,
        pos: t.pos, moves: t.history, legal: t.status === 'playing' && (game !== 'battleship' || seaPhase === 'fire') ? t.legal : null,
        check: game === 'chess' ? E.chInCheck(t.pos) : null,
        win_line: game === 'connect4' && (t.result === 'p1' || t.result === 'p2') ? E.c4Win(t.pos) : null,
        tc: { base: 0, inc: 0, move: 0, label: botNick }, no_touch: noTouch },
      fleet: game === 'battleship' ? t.fleets[hs] || null : null,
      fleets: game === 'battleship' && t.status === 'finished' ? { 1: t.fleets[1] || null, 2: t.fleets[2] || null } : null,
      clock: null,
      players: [1, 2].map((seat) => ({ seat, color: NAMES[game][seat - 1], user_id: seat === hs ? 'you' : 'bot', nick: seatNick(seat), verified: false, left: false, active: true, away_for: 0 })),
      spectators: [],
      me: { user_id: 'you', joined, seat: hs, nick: t.nick, cooldown_left: 0 },
      forfeit_seconds: 180, cooldown: 0, messages: t.msgs.slice(),
    };
  }
  // ---- one move (human or bot), same order of checks as the server ----
  function apply(seat, mv) {
    if (T.status !== 'playing') throw new Error('The game is not running');
    if (T.turn !== seat) throw new Error('Not your turn');
    mv = String(mv || '').trim().toLowerCase();
    if (game === 'battleship') {
      if (T.pos.split('|')[0] !== 'fire') throw new Error('Place your ships first');
      if (!T.legal.includes(mv)) throw new Error('Illegal move');
      const r = E.seaShot(T.pos, T.fleets[3 - seat], seat, mv);
      T.pos = r.pos; T.last_move = mv + r.mark; T.history.push(mv + r.mark); T.turn = 3 - seat; T.legal = E.seaLegal(T.pos, T.turn);
      T.move_at = new Date().toISOString();
      if (r.won) finish(seat === 1 ? 'p1' : 'p2', 'whole fleet sunk');
      return;
    }
    if (!T.legal.includes(mv)) throw new Error('Illegal move');
    const np = E.tgPlay(game, T.pos, mv);
    if (game === 'chess') { if (+np.split('|')[4] === 0) T.reps = []; T.reps.push(E.chKey(np, E.chLegal(np))); }
    const ev = E.tgEval(game, np, T.reps);
    T.pos = np; T.turn = 3 - seat; T.last_move = mv; T.history.push(mv); T.legal = ev.legal; T.move_at = new Date().toISOString();
    if (ev.result) finish(ev.result, ev.reason);
  }
  // ---- the bot thinks in a Web Worker (falls back to the page if workers are not available) ----
  function think(st) {
    if (!worker && typeof Worker !== 'undefined') {
      try {
        worker = new Worker(new URL('./bot-worker.js', import.meta.url), { type: 'module' });
        worker.onmessage = (e) => { const p = pending.get(e.data.id); pending.delete(e.data.id); p?.(e.data); };
        worker.onerror = () => { worker = false; for (const [, p] of pending) p({ error: 'worker' }); pending.clear(); };
      } catch { worker = false; }
    }
    if (!worker) return Promise.resolve({ move: botMove(game, st, level) });
    return new Promise((res) => { const id = ++reqId; pending.set(id, res); worker.postMessage({ id, game, st, level }); });
  }
  async function botTurn() {
    if (thinking || T.status !== 'playing' || T.turn === T.human) return;
    if (game === 'battleship' && T.pos.split('|')[0] !== 'fire') return;
    thinking = true; listener?.('state', { v: T.version + 0.5 });
    const gameNo = T.game_no, t0 = Date.now();
    const st = game === 'battleship' ? { shots: T.pos.split('|')[3 - T.human], noTouch } : { pos: T.pos, reps: T.reps };
    let r = await think(st);
    if (r.error) r = { move: botMove(game, st, level) };
    const wait = (game === 'battleship' ? 650 : 450) - (Date.now() - t0);
    if (wait > 0) await new Promise((res) => setTimeout(res, wait));
    thinking = false;
    if (T.game_no !== gameNo || T.status !== 'playing') return;
    try { apply(3 - T.human, r.move); }
    catch {   // should never happen (tests check it); never leave the game stuck: play any legal move
      const leg = T.legal; if (!leg?.length) return;
      apply(3 - T.human, leg[Math.floor(Math.random() * leg.length)]);
    }
    notify();
  }

  // restore an unfinished game after a reload (same tab)
  try { const s = JSON.parse(sessionStorage.getItem(KEY) || 'null'); if (s && s.game === game && s.level === level && s.noTouch === noTouch && typeof s.pos === 'string' && Array.isArray(s.history) && Array.isArray(s.msgs) && Array.isArray(s.legal)) T = s; } catch {}
  if (!T) fresh();
  if (nick) T.nick = nick;

  const api = {
    local: true, level, botNick,
    async rpc(fn, args = {}) {
      switch (fn) {
        case 'gry_table_join': case 'gry_table_state': case 'gry_table_flag':
          setTimeout(botTurn, 0); return state();
        case 'gry_table_move': apply(T.human, args.p_move); notify(); setTimeout(botTurn, 0); return state();
        case 'gry_table_fleet': {
          if (game !== 'battleship' || T.pos.split('|')[0] !== 'place') throw new Error('Ships are already placed');
          T.fleets[T.human] = E.seaParse(args.p_ships, noTouch);
          const x = T.pos.split('|'); x[0] = 'fire'; x[3] = '3'; T.pos = x.join('|');
          T.turn = 1; T.legal = E.seaLegal(T.pos, 1); T.move_at = new Date().toISOString();
          sys(`All ships placed — ${seatNick(1)} fires first.`);
          notify(); setTimeout(botTurn, 0); return state();
        }
        case 'gry_table_resign':
          if (T.status !== 'playing') throw new Error('The game is not running');
          finish(T.human === 1 ? 'p2' : 'p1', `${T.nick} resigned`); notify(); return state();
        case 'gry_table_rematch':
          fresh(3 - T.human, T.game_no + 1, T.msgs); notify(); setTimeout(botTurn, 0); return state();
        case 'gry_table_leave': try { sessionStorage.removeItem(KEY); } catch {} worker?.terminate?.(); return null;
        case 'gry_table_draw': throw new Error('The bot does not take draw offers');
        case 'gry_table_chat': throw new Error('No chat in bot games');
        default: throw new Error('Not available in bot games');
      }
    },
    channel(topic, onMsg, onJoin) { listener = onMsg; setTimeout(() => onJoin?.(), 0); return { close() { listener = null; } }; },
  };
  return api;
}
