// Rules engines in JS — a 1:1 copy of the server rules (supabase/parts/tables_engine.sql), same position strings and move notation.
// Used by the vs-bot games (they run only in the browser) and by the bots' search. tests/bots.test.mjs checks that these
// functions give exactly the same legal moves and results as the server on thousands of positions.

// ---------------- CHESS ----------------
// board: 64 chars, index = rank*8 + file (a1 = 0); pos = board|w/b|castling|ep index (-1)|halfmove|fullmove; moves in UCI
const KN = [1, 2, 2, 1, 2, -1, 1, -2, -1, -2, -2, -1, -2, 1, -1, 2];
const KG = [1, 0, 1, 1, 0, 1, -1, 1, -1, 0, -1, -1, 0, -1, 1, -1];
export const sqName = (i) => String.fromCharCode(97 + (i % 8)) + (((i / 8) | 0) + 1);
export const sqIdx = (s) => (s.charCodeAt(0) - 97) + (+s[1] - 1) * 8;
const isUp = (p) => p >= 'A' && p <= 'Z';

export function chAttacked(b, sq, byWhite) {
  const f = sq % 8, r = (sq / 8) | 0;
  if (byWhite) {
    if (r > 0) { if (f > 0 && b[sq - 9] === 'P') return true; if (f < 7 && b[sq - 7] === 'P') return true; }
  } else if (r < 7) { if (f > 0 && b[sq + 7] === 'p') return true; if (f < 7 && b[sq + 9] === 'p') return true; }
  const N = byWhite ? 'N' : 'n', K = byWhite ? 'K' : 'k', B = byWhite ? 'B' : 'b', R = byWhite ? 'R' : 'r', Q = byWhite ? 'Q' : 'q';
  for (let i = 0; i < 8; i++) {
    let nf = f + KN[2 * i], nr = r + KN[2 * i + 1];
    if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8 && b[nr * 8 + nf] === N) return true;
    nf = f + KG[2 * i]; nr = r + KG[2 * i + 1];
    if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8 && b[nr * 8 + nf] === K) return true;
  }
  for (let i = 0; i < 8; i++) {
    let nf = f, nr = r;
    for (;;) {
      nf += KG[2 * i]; nr += KG[2 * i + 1];
      if (nf < 0 || nf > 7 || nr < 0 || nr > 7) break;
      const p = b[nr * 8 + nf];
      if (p !== '.') { if (p === Q || (i % 2 === 0 && p === R) || (i % 2 === 1 && p === B)) return true; break; }
    }
  }
  return false;
}
function chPseudo(b, w, c, ep) {
  const mv = [], dir = w ? 8 : -8, startR = w ? 1 : 6, lastR = w ? 7 : 0;
  for (let sq = 0; sq < 64; sq++) {
    const p = b[sq];
    if (p === '.' || isUp(p) !== w) continue;
    const up = p.toUpperCase(), f = sq % 8, r = (sq / 8) | 0, fs = sqName(sq);
    if (up === 'P') {
      let t = sq + dir;
      if (b[t] === '.') {
        if (((t / 8) | 0) === lastR) for (const pr of 'qrbn') mv.push(fs + sqName(t) + pr);
        else { mv.push(fs + sqName(t)); if (r === startR && b[t + dir] === '.') mv.push(fs + sqName(t + dir)); }
      }
      for (const d of [-1, 1]) {
        const nf = f + d; if (nf < 0 || nf > 7) continue;
        t = sq + dir + d; const tp = b[t];
        if ((tp !== '.' && isUp(tp) !== w) || t === ep) {
          if (((t / 8) | 0) === lastR) for (const pr of 'qrbn') mv.push(fs + sqName(t) + pr); else mv.push(fs + sqName(t));
        }
      }
    } else if (up === 'N' || up === 'K') {
      const T = up === 'N' ? KN : KG;
      for (let i = 0; i < 8; i++) {
        const nf = f + T[2 * i], nr = r + T[2 * i + 1];
        if (nf < 0 || nf > 7 || nr < 0 || nr > 7) continue;
        const tp = b[nr * 8 + nf];
        if (tp === '.' || isUp(tp) !== w) mv.push(fs + sqName(nr * 8 + nf));
      }
      if (up === 'K') {
        if (w && sq === 4) {
          if (c.includes('K') && b[5] === '.' && b[6] === '.' && b[7] === 'R' && !chAttacked(b, 4, false) && !chAttacked(b, 5, false) && !chAttacked(b, 6, false)) mv.push('e1g1');
          if (c.includes('Q') && b[1] === '.' && b[2] === '.' && b[3] === '.' && b[0] === 'R' && !chAttacked(b, 4, false) && !chAttacked(b, 3, false) && !chAttacked(b, 2, false)) mv.push('e1c1');
        } else if (!w && sq === 60) {
          if (c.includes('k') && b[61] === '.' && b[62] === '.' && b[63] === 'r' && !chAttacked(b, 60, true) && !chAttacked(b, 61, true) && !chAttacked(b, 62, true)) mv.push('e8g8');
          if (c.includes('q') && b[57] === '.' && b[58] === '.' && b[59] === '.' && b[56] === 'r' && !chAttacked(b, 60, true) && !chAttacked(b, 59, true) && !chAttacked(b, 58, true)) mv.push('e8c8');
        }
      }
    } else {
      for (let i = 0; i < 8; i++) {
        if ((up === 'R' && i % 2 === 1) || (up === 'B' && i % 2 === 0)) continue;
        let nf = f, nr = r;
        for (;;) {
          nf += KG[2 * i]; nr += KG[2 * i + 1];
          if (nf < 0 || nf > 7 || nr < 0 || nr > 7) break;
          const tp = b[nr * 8 + nf];
          if (tp === '.') mv.push(fs + sqName(nr * 8 + nf));
          else { if (isUp(tp) !== w) mv.push(fs + sqName(nr * 8 + nf)); break; }
        }
      }
    }
  }
  return mv;
}
export function chMake(b, m) {   // b: array (copied)
  const fr = sqIdx(m.slice(0, 2)), tt = sqIdx(m.slice(2, 4)), pr = m[4] || '';
  const nb = b.slice(); let p = nb[fr]; const tp = nb[tt];
  nb[fr] = '.';
  if ((p === 'P' || p === 'p') && fr % 8 !== tt % 8 && tp === '.') nb[p === 'P' ? tt - 8 : tt + 8] = '.';
  if ((p === 'K' || p === 'k') && Math.abs(tt - fr) === 2) {
    if (tt === 6) { nb[7] = '.'; nb[5] = 'R'; } else if (tt === 2) { nb[0] = '.'; nb[3] = 'R'; }
    else if (tt === 62) { nb[63] = '.'; nb[61] = 'r'; } else if (tt === 58) { nb[56] = '.'; nb[59] = 'r'; }
  }
  if (pr) p = p === 'P' ? pr.toUpperCase() : pr.toLowerCase();
  nb[tt] = p;
  return nb;
}
// parsed position: { b: array(64), w, c, ep, h, fm }
export const chParse = (pos) => { const x = pos.split('|'); return { b: [...x[0]], w: x[1] === 'w', c: x[2], ep: +x[3], h: +x[4], fm: +x[5] }; };
export const chStr = (s) => s.b.join('') + '|' + (s.w ? 'w' : 'b') + '|' + s.c + '|' + s.ep + '|' + s.h + '|' + s.fm;
export function chLegalP(s) {
  const res = [], K = s.w ? 'K' : 'k';
  for (const m of chPseudo(s.b, s.w, s.c, s.ep)) {
    const nb = chMake(s.b, m), k = nb.indexOf(K);
    if (k >= 0 && !chAttacked(nb, k, !s.w)) res.push(m);
  }
  return res;
}
export function chPlayP(s, m) {
  const b = s.b, fr = sqIdx(m.slice(0, 2)), tt = sqIdx(m.slice(2, 4)), p = b[fr];
  let c = s.c.replace('-', '');
  const cap = b[tt] !== '.' || ((p === 'P' || p === 'p') && fr % 8 !== tt % 8);
  if (p === 'K') c = c.replace(/[KQ]/g, ''); else if (p === 'k') c = c.replace(/[kq]/g, '');
  if (fr === 0 || tt === 0) c = c.replace('Q', '');
  if (fr === 7 || tt === 7) c = c.replace('K', '');
  if (fr === 56 || tt === 56) c = c.replace('q', '');
  if (fr === 63 || tt === 63) c = c.replace('k', '');
  const ep = (p === 'P' || p === 'p') && Math.abs(tt - fr) === 16 ? (fr + tt) / 2 : -1;
  return { b: chMake(b, m), w: !s.w, c: c || '-', ep, h: p === 'P' || p === 'p' || cap ? 0 : s.h + 1, fm: s.w ? s.fm : s.fm + 1 };
}
export const chLegal = (pos) => chLegalP(chParse(pos));
export const chPlay = (pos, m) => chStr(chPlayP(chParse(pos), m));
export function chFromFen(fen) {
  const [pl, side, cast = '-', ep = '-', h = '0', fm = '1'] = fen.trim().split(/\s+/);
  const b = pl.split('/').reverse().map((rk) => rk.replace(/[1-8]/g, (d) => '.'.repeat(+d))).join('');
  return `${b}|${side}|${cast}|${ep === '-' ? -1 : sqIdx(ep)}|${h}|${fm}`;
}
export function chPerft(s, d) {
  const ms = chLegalP(s); if (d <= 1) return ms.length;
  let n = 0; for (const m of ms) n += chPerft(chPlayP(s, m), d - 1); return n;
}
export function chInsufficient(b) {
  const rest = b.filter((p) => p !== '.' && p !== 'K' && p !== 'k').join('');
  if (rest === '' || ['N', 'n', 'B', 'b'].includes(rest)) return true;
  if (!/^[Bb]+$/.test(rest)) return false;
  let colors = 0;
  for (let i = 0; i < 64; i++) if (b[i] === 'B' || b[i] === 'b') colors |= 1 << ((i % 8 + ((i / 8) | 0)) % 2);
  return colors !== 3;
}
export function chKey(pos, legal) {
  const x = pos.split('|'), ep = +x[3];
  const real = ep >= 0 && legal.some((m) => m.slice(2, 4) === sqName(ep) && x[0][sqIdx(m.slice(0, 2))].toUpperCase() === 'P');
  return x.slice(0, 3).join('|') + '|' + (real ? String(ep) : '-');
}
export function chInCheck(pos) {
  const b = pos.split('|')[0], w = pos.split('|')[1] === 'w', k = b.indexOf(w ? 'K' : 'k');
  return k >= 0 && chAttacked(b, k, !w);
}

// ---------------- CHECKERS (English draughts) ----------------
// board like chess (a1 = 0), dark squares (rank+file even); b/B black (moves first, up), w/W white; pos = board|b/w|quiet plies
function ckJumps(b, sq, pc, path, res) {
  const f = sq % 8, r = (sq / 8) | 0, black = pc.toLowerCase() === 'b', king = pc === pc.toUpperCase();
  let found = false;
  for (const dr of [-1, 1]) {
    if (!king && ((black && dr < 0) || (!black && dr > 0))) continue;
    for (const df of [-1, 1]) {
      if (f + 2 * df < 0 || f + 2 * df > 7 || r + 2 * dr < 0 || r + 2 * dr > 7) continue;
      const midI = (r + dr) * 8 + f + df, mid = b[midI], dst = (r + 2 * dr) * 8 + f + 2 * df;
      if (b[dst] !== '.') continue;
      if (!(black ? mid === 'w' || mid === 'W' : mid === 'b' || mid === 'B')) continue;
      found = true;
      const nb = b.slice(); nb[midI] = 'x'; nb[sq] = '.'; nb[dst] = pc;
      const np = path + 'x' + sqName(dst);
      if (!king && ((dst / 8) | 0) === (black ? 7 : 0)) res.push(np);
      else { const before = res.length; if (!ckJumps(nb, dst, pc, np, res) && res.length === before) res.push(np); }
    }
  }
  return found;
}
export function ckLegal(pos) {
  const [bs, side] = pos.split('|'), b = [...bs], black = side === 'b', caps = [], simple = [];
  for (let sq = 0; sq < 64; sq++) {
    const p = b[sq];
    if (!(black ? p === 'b' || p === 'B' : p === 'w' || p === 'W')) continue;
    ckJumps(b, sq, p, sqName(sq), caps);
    const king = p === p.toUpperCase(), f = sq % 8, r = (sq / 8) | 0;
    for (const dr of [-1, 1]) {
      if (!king && ((black && dr < 0) || (!black && dr > 0))) continue;
      for (const df of [-1, 1]) {
        if (f + df < 0 || f + df > 7 || r + dr < 0 || r + dr > 7) continue;
        const t = (r + dr) * 8 + f + df;
        if (b[t] === '.') simple.push(sqName(sq) + '-' + sqName(t));
      }
    }
  }
  return caps.length ? caps : simple;
}
export function ckPlay(pos, m) {
  const [bs, s, qs] = pos.split('|'), b = [...bs], sqs = m.split(/[-x]/), cap = m.includes('x');
  let a = sqIdx(sqs[0]), p = b[a];
  const man = p === p.toLowerCase();
  for (let i = 1; i < sqs.length; i++) {
    const z = sqIdx(sqs[i]);
    if (Math.abs(((z / 8) | 0) - ((a / 8) | 0)) === 2) b[(a + z) / 2] = '.';
    a = z;
  }
  b[sqIdx(sqs[0])] = '.';
  if (man && ((a / 8) | 0) === (p === 'b' ? 7 : 0)) p = p.toUpperCase();
  b[a] = p;
  return b.join('') + '|' + (s === 'b' ? 'w' : 'b') + '|' + (cap || man ? 0 : +qs + 1);
}

// ---------------- CONNECT FOUR 7x6 ----------------
// board: 42 chars, index = row*7 + col (row 0 = bottom); pos = board|r/y|last index (-1); move = column 1..7
export function c4Legal(pos) { const b = pos.split('|')[0], out = []; for (let c = 1; c <= 7; c++) if (b[34 + c] === '.') out.push(String(c)); return out; }
export function c4Play(pos, m) {
  const [b, s] = pos.split('|'), c = +m - 1;
  for (let rw = 0; rw < 6; rw++) if (b[rw * 7 + c] === '.') return b.slice(0, rw * 7 + c) + s + b.slice(rw * 7 + c + 1) + '|' + (s === 'r' ? 'y' : 'r') + '|' + (rw * 7 + c);
  throw new Error('Illegal move');
}
export function c4Win(pos) {
  const [b, , li] = pos.split('|'), i = +li;
  if (i < 0) return null;
  const ch = b[i], c = i % 7, rw = (i / 7) | 0, dc = [1, 0, 1, 1], dr = [0, 1, 1, -1];
  for (let d = 0; d < 4; d++) {
    const line = [i];
    for (const sgn of [1, -1]) for (let k = 1; k <= 3; k++) {
      const nc = c + sgn * k * dc[d], nr = rw + sgn * k * dr[d];
      if (nc < 0 || nc > 6 || nr < 0 || nr > 5 || b[nr * 7 + nc] !== ch) break;
      line.push(nr * 7 + nc);
    }
    if (line.length >= 4) return line;
  }
  return null;
}

// ---------------- SEA BATTLE (10x10, fleet 5,4,3,3,2) ----------------
// cell index = row*10 + col, name = column letter a–j + row 1–10 ("a1" top-left). Fleet input: "a1h5,c3v4,…" (start, h/v, length).
// Fleet board: 100 chars, '.' water, '1'..'5' ship number. Public pos = phase(place/fire)|shots of seat 1|shots of seat 2|ready bits;
// shots: '.' unknown, 'o' miss, 'x' hit, '#' sunk ship.
export const FLEET = [5, 4, 3, 3, 2];
export const seaName = (i) => String.fromCharCode(97 + (i % 10)) + (((i / 10) | 0) + 1);
export const seaIdx = (s) => (+s.slice(1) - 1) * 10 + (s.charCodeAt(0) - 97);
export function seaParse(ships, noTouch = false) {   // → fleet board, or throws (same messages as the server)
  const parts = String(ships || '').trim().toLowerCase().split(',');
  if (parts.length !== 5) throw new Error('Place all 5 ships');
  const b = Array(100).fill('.'), lens = [];
  parts.forEach((s, n) => {
    const m = /^([a-j])(10|[1-9])([hv])([2-5])$/.exec(s);
    if (!m) throw new Error('Bad ship placement');
    const c = m[1].charCodeAt(0) - 97, r = +m[2] - 1, o = m[3], len = +m[4]; lens.push(len);
    for (let k = 0; k < len; k++) {
      const nr = r + (o === 'v' ? k : 0), nc = c + (o === 'h' ? k : 0);
      if (nr > 9 || nc > 9) throw new Error('A ship sticks out of the board');
      if (b[nr * 10 + nc] !== '.') throw new Error('Ships overlap');
      b[nr * 10 + nc] = String(n + 1);
    }
  });
  if (lens.sort().join() !== '2,3,3,4,5') throw new Error('The fleet is 5, 4, 3, 3 and 2');
  if (noTouch) for (let i = 0; i < 100; i++) {
    if (b[i] === '.') continue;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const nr = ((i / 10) | 0) + dr, nc = (i % 10) + dc;
      if (nr < 0 || nr > 9 || nc < 0 || nc > 9) continue;
      const q = b[nr * 10 + nc]; if (q !== '.' && q !== b[i]) throw new Error('Ships may not touch (no-touch rule)');
    }
  }
  return b.join('');
}
export function seaRandomFleet(noTouch = false, rnd = Math.random) {
  for (;;) {
    const parts = [];
    let ok = true;
    for (const len of FLEET) {
      let placed = false;
      for (let tries = 0; tries < 200 && !placed; tries++) {
        const o = rnd() < 0.5 ? 'h' : 'v', c = Math.floor(rnd() * (o === 'h' ? 11 - len : 10)), r = Math.floor(rnd() * (o === 'v' ? 11 - len : 10));
        const cand = [...parts, String.fromCharCode(97 + c) + (r + 1) + o + len];
        try { seaParse(cand.concat(Array(5 - cand.length).fill('')).join(','), false); } catch (e) { if (!/Bad ship placement|fleet is/.test(e.message)) continue; }
        if (noTouch && !seaPartialOk(cand)) continue;
        parts.push(cand[cand.length - 1]); placed = true;
      }
      if (!placed) { ok = false; break; }
    }
    if (ok) { try { seaParse(parts.join(','), noTouch); return parts.join(','); } catch {} }
  }
}
function seaPartialOk(parts) {   // no-touch check for a partial fleet
  const b = Array(100).fill('.');
  for (const [n, s] of parts.entries()) {
    const m = /^([a-j])(10|[1-9])([hv])([2-5])$/.exec(s), c = m[1].charCodeAt(0) - 97, r = +m[2] - 1;
    for (let k = 0; k < +m[4]; k++) b[(r + (m[3] === 'v' ? k : 0)) * 10 + c + (m[3] === 'h' ? k : 0)] = String(n + 1);
  }
  for (let i = 0; i < 100; i++) if (b[i] !== '.') for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const nr = ((i / 10) | 0) + dr, nc = (i % 10) + dc;
    if (nr >= 0 && nr <= 9 && nc >= 0 && nc <= 9 && b[nr * 10 + nc] !== '.' && b[nr * 10 + nc] !== b[i]) return false;
  }
  return true;
}
export const seaStart = () => 'place|' + '.'.repeat(100) + '|' + '.'.repeat(100) + '|0';
export function seaLegal(pos, seat) { const sh = pos.split('|')[seat], out = []; for (let i = 0; i < 100; i++) if (sh[i] === '.') out.push(seaName(i)); return out; }
export function seaShot(pos, fleet, seat, mv) {   // → { pos, mark: o|x|#, won }
  const x = pos.split('|'); let sh = [...x[seat]];
  const idx = seaIdx(mv), ship = fleet[idx];
  let mark;
  if (ship === '.') { sh[idx] = 'o'; mark = 'o'; }
  else {
    sh[idx] = 'x';
    let sunk = true; for (let i = 0; i < 100; i++) if (fleet[i] === ship && sh[i] === '.') sunk = false;
    if (sunk) { for (let i = 0; i < 100; i++) if (fleet[i] === ship) sh[i] = '#'; mark = '#'; } else mark = 'x';
  }
  sh = sh.join(''); x[seat] = sh;
  return { pos: x.join('|'), mark, won: sh.split('#').length - 1 === 17 };
}

// ---------------- common: start / legal / play / evaluation (same as games.tg_*) ----------------
export function tgStart(g) {
  if (g === 'chess') return 'RNBQKBNRPPPPPPPP' + '.'.repeat(32) + 'pppppppprnbqkbnr|w|KQkq|-1|0|1';
  if (g === 'checkers') { let s = ''; for (let i = 0; i < 64; i++) s += ((i >> 3) + (i & 7)) % 2 === 0 && (i >> 3) <= 2 ? 'b' : ((i >> 3) + (i & 7)) % 2 === 0 && (i >> 3) >= 5 ? 'w' : '.'; return s + '|b|0'; }
  if (g === 'battleship') return seaStart();
  return '.'.repeat(42) + '|r|-1';
}
export const tgLegal = (g, pos) => g === 'chess' ? chLegal(pos) : g === 'checkers' ? ckLegal(pos) : c4Legal(pos);
export const tgPlay = (g, pos, m) => g === 'chess' ? chPlay(pos, m) : g === 'checkers' ? ckPlay(pos, m) : c4Play(pos, m);
export const tgSeat = (g, pos) => { const s = pos.split('|')[1]; return (g === 'checkers' ? s === 'b' : s === 'w' || s === 'r') ? 1 : 2; };
export function tgEval(g, pos, reps = []) {
  const lg = tgLegal(g, pos), seat = tgSeat(g, pos), other = seat === 1 ? 'p2' : 'p1', b = pos.split('|')[0];
  if (g === 'connect4') {
    if (c4Win(pos)) return { legal: [], result: other, reason: 'four in a row' };
    if (!lg.length) return { legal: lg, result: 'draw', reason: 'the board is full' };
    return { legal: lg, result: null };
  }
  if (g === 'checkers') {
    if (!lg.length) return { legal: lg, result: other, reason: !(seat === 1 ? /[bB]/ : /[wW]/).test(b) ? 'all pieces captured' : 'no moves left' };
    if (+pos.split('|')[2] >= 80) return { legal: [], result: 'draw', reason: '40 moves each without a capture or a man moving' };
    return { legal: lg, result: null };
  }
  const chk = chInCheck(pos);
  if (!lg.length) return { legal: lg, check: chk, result: chk ? other : 'draw', reason: chk ? 'checkmate' : 'stalemate' };
  if (chInsufficient([...b])) return { legal: [], check: chk, result: 'draw', reason: 'insufficient material' };
  if (+pos.split('|')[4] >= 100) return { legal: [], check: chk, result: 'draw', reason: '50-move rule' };
  const key = chKey(pos, lg);
  if (reps.filter((x) => x === key).length >= 3) return { legal: [], check: chk, result: 'draw', reason: 'threefold repetition' };
  return { legal: lg, check: chk, result: null };
}
