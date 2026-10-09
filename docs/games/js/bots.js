// Bots for the vs-bot tables (run in the browser, inside a Web Worker). Every move a bot picks comes from the same legal-move
// generators the rules use (engines.js = copy of the server rules), so a bot can never play an illegal move.
import * as E from './engines.js';

class Timeout extends Error {}
const pick = (a, rnd) => a[Math.floor(rnd() * a.length)];

// ================= CHESS: negamax + alpha-beta + quiescence, iterative deepening, piece-square tables =================
const VAL = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };
// own simple piece-square tables (white's view, index a1 = 0): centre, development, pawn advance, king shelter
const center = (i) => { const f = i % 8, r = i >> 3; return 3.5 - Math.max(Math.abs(f - 3.5), Math.abs(r - 3.5)); };   // 0 … 3
const PST = {
  P: Array.from({ length: 64 }, (_, i) => { const f = i % 8, r = i >> 3; return r === 0 || r === 7 ? 0 : (r - 1) * 8 + ((f === 3 || f === 4) ? (r >= 3 ? 12 : 2) : 0) + (r === 6 ? 25 : 0) - ((f === 3 || f === 4) && r === 1 ? 10 : 0); }),
  N: Array.from({ length: 64 }, (_, i) => Math.round(center(i) * 12) - 20),
  B: Array.from({ length: 64 }, (_, i) => Math.round(center(i) * 6) - 6 + ((i >> 3) === 0 ? -6 : 0)),
  R: Array.from({ length: 64 }, (_, i) => ((i >> 3) === 6 ? 12 : 0) + ((i % 8 === 3 || i % 8 === 4) ? 4 : 0)),
  Q: Array.from({ length: 64 }, (_, i) => Math.round(center(i) * 3) - 4),
  K: Array.from({ length: 64 }, (_, i) => { const f = i % 8, r = i >> 3; return r === 0 ? (f === 6 || f === 1 || f === 2 ? 25 : f === 4 || f === 3 ? 0 : 10) : -12 * r; }),
  KE: Array.from({ length: 64 }, (_, i) => Math.round(center(i) * 10) - 15),   // king in the endgame: go to the centre
};
function chEval(s) {   // score from the side to move
  let sc = 0, mat = 0;
  for (let i = 0; i < 64; i++) { const p = s.b[i]; if (p !== '.' && p !== 'K' && p !== 'k' && p !== 'P' && p !== 'p') mat += VAL[p.toUpperCase()]; }
  const endgame = mat <= 2600;
  for (let i = 0; i < 64; i++) {
    const p = s.b[i]; if (p === '.') continue;
    const up = p.toUpperCase(), white = p === up, idx = white ? i : (7 - (i >> 3)) * 8 + (i % 8);
    const v = VAL[up] + (up === 'K' && endgame ? PST.KE[idx] : PST[up][idx]);
    sc += white ? v : -v;
  }
  return s.w ? sc : -sc;
}
const capVal = (s, m) => { const t = s.b[E.sqIdx(m.slice(2, 4))]; return t === '.' ? (m[4] ? 0 : -1) : VAL[t.toUpperCase()] * 10 - VAL[s.b[E.sqIdx(m.slice(0, 2))].toUpperCase()] / 10; };
function order(s, ms, first) {
  const sc = ms.map((m) => [m, (m === first ? 1e9 : 0) + (m[4] === 'q' ? 8000 : 0) + Math.max(0, capVal(s, m) + 1)]);
  return sc.sort((a, b) => b[1] - a[1]).map((x) => x[0]);
}
function chSearch(root, { maxDepth, timeMs, quiesce = true, noise = 0, rnd = Math.random }) {
  const t0 = Date.now(); let nodes = 0;
  const tick = () => { if ((++nodes & 1023) === 0 && Date.now() - t0 > timeMs) throw new Timeout(); };
  const qs = (s, a, b, d) => {
    tick();
    const stand = chEval(s);
    if (!quiesce || d > 6) return stand;
    if (stand >= b) return stand;
    if (stand > a) a = stand;
    const caps = E.chLegalP(s).filter((m) => s.b[E.sqIdx(m.slice(2, 4))] !== '.' || m[4] === 'q');
    for (const m of order(s, caps)) {
      const v = -qs(E.chPlayP(s, m), -b, -a, d + 1);
      if (v >= b) return v;
      if (v > a) a = v;
    }
    return a;
  };
  const neg = (s, d, a, b, ply) => {
    tick();
    const ms = E.chLegalP(s);
    if (!ms.length) { const k = s.b.indexOf(s.w ? 'K' : 'k'); return E.chAttacked(s.b, k, !s.w) ? -100000 + ply : 0; }
    if (s.h >= 100 || E.chInsufficient(s.b)) return 0;
    if (d === 0) return qs(s, a, b, 0);
    let best = -Infinity;
    for (const m of order(s, ms)) {
      const v = -neg(E.chPlayP(s, m), d - 1, -b, -a, ply + 1);
      if (v > best) best = v;
      if (v > a) a = v;
      if (a >= b) break;
    }
    return best;
  };
  const rootMoves = E.chLegalP(root);
  let bestMove = rootMoves[0], prevBest = null;
  for (let depth = 1; depth <= maxDepth; depth++) {
    try {
      let a = -Infinity, cand = null, candV = -Infinity;
      for (const m of order(root, rootMoves, prevBest)) {
        const v = -neg(E.chPlayP(root, m), depth - 1, -Infinity, -a, 1) + (noise ? (rnd() * 2 - 1) * noise : 0);
        if (v > candV) { candV = v; cand = m; }
        if (v > a) a = v;
      }
      bestMove = prevBest = cand;
      if (candV > 90000) break;   // mate found
    } catch (e) { if (e instanceof Timeout) break; throw e; }
    if (Date.now() - t0 > timeMs * 0.55) break;   // next depth would not finish
  }
  return bestMove;
}

// ================= CHECKERS: negamax + alpha-beta =================
function ckEval(pos) {
  const [b, side] = pos.split('|'); let sc = 0;
  for (let i = 0; i < 64; i++) {
    const p = b[i]; if (p === '.') continue;
    const r = i >> 3, f = i % 8, black = p === 'b' || p === 'B', king = p === 'B' || p === 'W';
    let v = king ? 175 : 100 + (black ? r : 7 - r) * 4;
    if (f >= 2 && f <= 5 && r >= 2 && r <= 5) v += 4;
    if (!king && (black ? r === 0 : r === 7)) v += 6;   // back row guards against kings
    sc += black ? v : -v;
  }
  return side === 'b' ? sc : -sc;
}
function ckSearch(root, { maxDepth, timeMs, noise = 0, rnd = Math.random }) {
  const t0 = Date.now(); let nodes = 0;
  const neg = (pos, d, a, b, ply) => {
    if ((++nodes & 1023) === 0 && Date.now() - t0 > timeMs) throw new Timeout();
    const ms = E.ckLegal(pos);
    if (!ms.length) return -100000 + ply;
    if (+pos.split('|')[2] >= 80) return 0;
    if (d <= 0 && !ms[0].includes('x')) return ckEval(pos);   // keep searching while captures are forced
    if (d <= -6) return ckEval(pos);
    let best = -Infinity;
    for (const m of ms) {
      const v = -neg(E.ckPlay(pos, m), d - 1, -b, -a, ply + 1);
      if (v > best) best = v; if (v > a) a = v; if (a >= b) break;
    }
    return best;
  };
  const rootMoves = E.ckLegal(root);
  let bestMove = rootMoves[0];
  if (rootMoves.length === 1) return bestMove;
  for (let depth = 1; depth <= maxDepth; depth++) {
    try {
      let a = -Infinity, cand = null, candV = -Infinity;
      const ordered = bestMove ? [bestMove, ...rootMoves.filter((m) => m !== bestMove)] : rootMoves;
      for (const m of ordered) {
        const v = -neg(E.ckPlay(root, m), depth - 1, -Infinity, -a, 1) + (noise ? (rnd() * 2 - 1) * noise : 0);
        if (v > candV) { candV = v; cand = m; } if (v > a) a = v;
      }
      bestMove = cand;
    } catch (e) { if (e instanceof Timeout) break; throw e; }
    if (Date.now() - t0 > timeMs * 0.5) break;
  }
  return bestMove;
}

// ================= CONNECT FOUR: negamax + alpha-beta + transposition table, iterative deepening =================
const ORDER = [3, 2, 4, 1, 5, 0, 6];
function c4Wins(b, i) {
  const ch = b[i], c = i % 7, r = (i / 7) | 0;
  for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    let n = 1;
    for (const s of [1, -1]) for (let k = 1; k < 4; k++) { const nc = c + s * k * dc, nr = r + s * k * dr; if (nc < 0 || nc > 6 || nr < 0 || nr > 5 || b[nr * 7 + nc] !== ch) break; n++; }
    if (n >= 4) return true;
  }
  return false;
}
const WIN4 = []; for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
  const cells = []; for (let k = 0; k < 4; k++) { const nc = c + k * dc, nr = r + k * dr; if (nc < 0 || nc > 6 || nr < 0 || nr > 5) break; cells.push(nr * 7 + nc); }
  if (cells.length === 4) WIN4.push(cells);
}
function c4Heur(b, me) {
  const op = me === 'r' ? 'y' : 'r'; let sc = 0;
  for (const w of WIN4) {
    let m = 0, o = 0; for (const i of w) { if (b[i] === me) m++; else if (b[i] === op) o++; }
    if (o === 0) sc += m === 3 ? 50 : m === 2 ? 5 : m === 1 ? 1 : 0;
    if (m === 0) sc -= o === 3 ? 50 : o === 2 ? 5 : o === 1 ? 1 : 0;
  }
  for (let r = 0; r < 6; r++) { if (b[r * 7 + 3] === me) sc += 3; else if (b[r * 7 + 3] === op) sc -= 3; }
  return sc;
}
function c4Search(pos, { maxDepth, timeMs }) {
  const [bs, me] = pos.split('|'), b = [...bs], hts = [0, 1, 2, 3, 4, 5, 6].map((c) => { let h = 0; while (h < 6 && b[h * 7 + c] !== '.') h++; return h; });
  let filled = b.filter((x) => x !== '.').length;
  const t0 = Date.now(); let nodes = 0; const tt = new Map();
  const neg = (side, d, a, bb) => {
    if ((++nodes & 2047) === 0 && Date.now() - t0 > timeMs) throw new Timeout();
    const other = side === 'r' ? 'y' : 'r';
    for (const c of ORDER) if (hts[c] < 6) { const i = hts[c] * 7 + c; b[i] = side; const w = c4Wins(b, i); b[i] = '.'; if (w) return 10000 - filled; }
    if (filled >= 41) return 0;
    if (d === 0) return c4Heur(b, side);
    const key = b.join('') + side + d, hit = tt.get(key);
    if (hit !== undefined) return hit;
    let best = -Infinity;
    for (const c of ORDER) {
      if (hts[c] >= 6) continue;
      const i = hts[c] * 7 + c; b[i] = side; hts[c]++; filled++;
      const v = -neg(other, d - 1, -bb, -a);
      b[i] = '.'; hts[c]--; filled--;
      if (v > best) best = v; if (v > a) a = v; if (a >= bb) break;
    }
    if (tt.size < 400000) tt.set(key, best);
    return best;
  };
  const legal = ORDER.filter((c) => hts[c] < 6);
  for (const c of legal) { const i = hts[c] * 7 + c; b[i] = me; const w = c4Wins(b, i); b[i] = '.'; if (w) return String(c + 1); }   // win now
  let bestMove = String(legal[0] + 1);
  for (let depth = 1; depth <= maxDepth; depth++) {
    try {
      let a = -Infinity, cand = null, candV = -Infinity;
      for (const c of legal) {
        const i = hts[c] * 7 + c; b[i] = me; hts[c]++; filled++;
        let v;
        try { v = -neg(me === 'r' ? 'y' : 'r', depth - 1, -Infinity, -a); } finally { b[i] = '.'; hts[c]--; filled--; }
        if (v > candV) { candV = v; cand = c; } if (v > a) a = v;
      }
      bestMove = String(cand + 1); tt.clear();
      if (Math.abs(candV) > 5000 || depth >= 42 - filled) break;   // solved
    } catch (e) { if (e instanceof Timeout) break; throw e; }
  }
  return bestMove;
}
function c4Easy(pos, rnd) {
  const legal = E.c4Legal(pos);
  if (rnd() < 0.5) for (const m of legal) if (E.c4Win(E.c4Play(pos, m))) return m;   // sometimes sees its own win
  const w = legal.map((m) => [m, 4 - Math.abs(+m - 4)]); const tot = w.reduce((s, x) => s + x[1], 0);
  let r = rnd() * tot; for (const [m, x] of w) { r -= x; if (r <= 0) return m; }
  return legal[0];
}

// ================= SEA BATTLE =================
// shots: the bot's own shot board (100 chars: . o x #). Only public information is used.
function seaRemaining(shots) {   // lengths of ships not sunk yet (sunk ships = connected groups of '#')
  const left = [...E.FLEET], seen = new Set();
  for (let i = 0; i < 100; i++) {
    if (shots[i] !== '#' || seen.has(i)) continue;
    const st = [i]; let n = 0; seen.add(i);
    while (st.length) { const j = st.pop(); n++; for (const k of [j - 10, j + 10, j % 10 ? j - 1 : -1, j % 10 < 9 ? j + 1 : -1]) if (k >= 0 && k < 100 && shots[k] === '#' && !seen.has(k)) { seen.add(k); st.push(k); } }
    const ix = left.indexOf(n); if (ix >= 0) left.splice(ix, 1); else if (left.length) left.splice(left.indexOf(Math.max(...left)), 1);
  }
  return left;
}
function seaTargets(shots) {   // unknown cells next to hits that are not sunk yet, preferring the line of 2+ hits
  const hits = []; for (let i = 0; i < 100; i++) if (shots[i] === 'x') hits.push(i);
  if (!hits.length) return [];
  const nb = (i) => [i - 10, i + 10, i % 10 ? i - 1 : -1, i % 10 < 9 ? i + 1 : -1].filter((k) => k >= 0 && k < 100);
  const line = [];
  for (const h of hits) for (const [d, ok] of [[1, h % 10 < 9], [10, true]]) {
    if (ok && shots[h + d] === 'x') {   // two hits in a row → extend the line both ways
      for (const s of [-1, 1]) { let k = h; while (k >= 0 && k < 100 && shots[k] === 'x' && (d === 10 || ((k / 10) | 0) === ((h / 10) | 0))) k += s * d;
        if (k >= 0 && k < 100 && shots[k] === '.' && (d === 10 || ((k / 10) | 0) === ((h / 10) | 0))) line.push(k); }
    }
  }
  if (line.length) return [...new Set(line)];
  return [...new Set(hits.flatMap(nb).filter((k) => shots[k] === '.'))];
}
function seaDensity(shots, noTouch) {
  const dens = Array(100).fill(0), lens = seaRemaining(shots), hits = [];
  for (let i = 0; i < 100; i++) if (shots[i] === 'x') hits.push(i);
  for (const len of lens) for (const o of ['h', 'v']) for (let r = 0; r < (o === 'v' ? 11 - len : 10); r++) for (let c = 0; c < (o === 'h' ? 11 - len : 10); c++) {
    const cells = []; let ok = true, cover = 0;
    for (let k = 0; k < len; k++) { const i = (r + (o === 'v' ? k : 0)) * 10 + c + (o === 'h' ? k : 0); if (shots[i] === 'o' || shots[i] === '#') { ok = false; break; } if (shots[i] === 'x') cover++; cells.push(i); }
    if (!ok) continue;
    if (noTouch && cells.some((i) => [-11, -10, -9, -1, 1, 9, 10, 11].some((d) => { const k = i + d; return k >= 0 && k < 100 && Math.abs((k % 10) - (i % 10)) <= 1 && shots[k] === '#'; }))) continue;
    const w = hits.length ? (cover ? 1 + 30 * cover : 1) : 1;
    for (const i of cells) if (shots[i] === '.') dens[i] += w;
  }
  return dens;
}
function seaMove(shots, level, rnd, noTouch) {
  const free = []; for (let i = 0; i < 100; i++) if (shots[i] === '.') free.push(i);
  if (level === 'easy') return E.seaName(pick(free, rnd));
  if (level === 'medium') {
    const t = seaTargets(shots); if (t.length) return E.seaName(pick(t, rnd));
    const par = free.filter((i) => (((i / 10) | 0) + i) % 2 === 0);
    return E.seaName(pick(par.length ? par : free, rnd));
  }
  const d = seaDensity(shots, noTouch), mx = Math.max(...free.map((i) => d[i]));
  return E.seaName(pick(free.filter((i) => d[i] === mx), rnd));
}

// ================= entry point =================
export const LEVELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
export function botMove(game, st, level = 'medium', rnd = Math.random) {
  if (game === 'battleship') return seaMove(st.shots, level, rnd, !!st.noTouch);
  const pos = st.pos, legal = E.tgLegal(game, pos), tm = (ms) => st.timeMs ?? ms;   // st.timeMs: tests only (shorter thinking)
  if (legal.length <= 1) return legal[0];
  if (game === 'connect4') {
    if (level === 'easy') return c4Easy(pos, rnd);
    return c4Search(pos, level === 'medium' ? { maxDepth: 4, timeMs: tm(800) } : { maxDepth: 42, timeMs: tm(1500) });
  }
  if (game === 'checkers') {
    if (level === 'easy' && rnd() < 0.25) return pick(legal, rnd);
    const [maxDepth, timeMs] = level === 'easy' ? [2, tm(300)] : level === 'medium' ? [4, tm(800)] : [7, tm(1500)];
    return ckSearch(pos, { maxDepth, timeMs, noise: level === 'easy' ? 30 : level === 'medium' ? 4 : 0, rnd });
  }
  const s = E.chParse(pos);
  if (level === 'easy') {
    if (rnd() < 0.3) return pick(legal, rnd);   // blunder
    return chSearch(s, { maxDepth: 1, timeMs: tm(300), quiesce: false, noise: 60, rnd });
  }
  if (level === 'medium') return chSearch(s, { maxDepth: 3, timeMs: tm(900), noise: 12, rnd });
  return chSearch(s, { maxDepth: 5, timeMs: tm(1600) });
}
export const botFleet = (noTouch, rnd) => E.seaRandomFleet(noTouch, rnd);
