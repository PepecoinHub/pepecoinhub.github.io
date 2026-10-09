// Table games (Chess / Checkers / Connect Four). The server (Postgres) validates every move and sends the list of legal moves;
// this page only draws the board, highlights what the server allows and sends the chosen move.
import { $, h, toast, getBackend, identityCard, paintMe, backendBanner, nickStore, badge } from './common.js';
import { localTable } from './localtable.js';
import * as E from './engines.js';

const be = await getBackend();
backendBanner($('#main'));
paintMe(be);
const QS = new URLSearchParams(location.search);
// ?bot=chess|checkers|connect4|battleship&level=easy|medium|hard → game vs the bot, only in this browser (localtable.js)
const BOT = ['chess', 'checkers', 'connect4', 'battleship'].includes(QS.get('bot')) ? QS.get('bot') : null;
const code = BOT ? 'BOT' : (QS.get('t') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const api = BOT ? localTable({ game: BOT, level: QS.get('level'), nick: nickStore.get() || 'You', noTouch: QS.get('notouch') === '1' })
  : { rpc: (fn, args) => be.rpc(fn, args), channel: (...a) => be.channel(...a) };
const GAME = { chess: 'Chess', checkers: 'Checkers', connect4: 'Connect Four', battleship: 'Sea Battle' };
const COLORS = { chess: ['White', 'Black'], checkers: ['Black', 'White'], connect4: ['Red', 'Yellow'], battleship: ['Blue', 'Orange'] };
const SHIPS = [[5, 'Carrier'], [4, 'Battleship'], [3, 'Cruiser'], [3, 'Submarine'], [2, 'Destroyer']];
const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const PNAME = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
const RULES = {
  chess: 'Standard chess. White moves first. Castling, en passant and promotion (pick the piece) are supported. The game ends with checkmate, stalemate (draw), resignation or an agreed draw. Automatic draws: threefold repetition, 50 moves without a capture or pawn move, or not enough material to mate.',
  checkers: 'English draughts (checkers) on 8×8, played on the dark squares. Black moves first. Men move one square diagonally forward; capturing is mandatory, and a capture must be continued while more jumps are possible (you may choose which sequence, not necessarily the longest). Tap each landing square of a multi-jump. A man that reaches the far row becomes a king (the move ends there); kings move and capture one square diagonally in all four directions. You lose when you have no pieces or no legal move. Automatic draw after 40 moves each without a capture or a man moving.',
  connect4: 'Connect Four on a 7×6 grid. Red moves first. Tap a column to drop a disc. Four in a row horizontally, vertically or diagonally wins; a full board is a draw.',
  battleship: 'Sea Battle on a 10×10 grid. Each player hides a fleet of 5 ships (lengths 5, 4, 3, 3 and 2) in straight lines, horizontally or vertically; ships may not overlap (with the no-touch rule they may not touch, not even at the corners). Place them by hand (tap a ship, then a square; Rotate turns it) or use Random, then press Ready — you have 2 minutes. Blue shoots first. Classic rules: one shot per turn, also after a hit. Every shot is answered with miss, hit or sunk; a sunk ship is shown. Sink the whole fleet to win. The server keeps both fleets secret — nobody else (not even spectators) sees your ships until the game ends.',
};
const CLOCK_RULES = {
  clock: 'Clock: each player has the base time for the whole game, plus the increment after every move (Fischer). As usual online, the clock starts after each side\'s first move (White\'s clock starts when Black has made the first move); each side must make its first move within 60 s or the game is aborted. The server keeps the time: whoever runs out of time loses, unless the opponent has no way to checkmate (bare king, king + one knight vs bare king, or bishops on one color only) — then it is a draw.',
  move: 'Move timer: each move must be made within the time limit, or the player to move loses on time. The server keeps the time.',
};
let prevDrop = null;
// zegar: stan z serwera (pozostały czas w chwili odpowiedzi) + upływ lokalny; t0/t1 = wysłanie/odbiór (połowa RTT = opóźnienie)
let CK = null, flagAt = 0, clockTimer = null;
let S = null, srvOffset = 0, chan = null, sel = null, fetchedAt = 0, refreshT = null, sendReadyAt = 0, cdTimer = null, busy = false;

const meSeat = () => S?.me?.seat || null;
const myTurn = () => S?.table.status === 'playing' && meSeat() === S.table.turn && !(S.table.game === 'battleship' && (S.table.pos || '').startsWith('place'));
const playerBySeat = (n) => S?.players.find((p) => p.seat === n);
const sqName = (i) => String.fromCharCode(97 + (i % 8)) + (Math.floor(i / 8) + 1);
const sqIdx = (s) => (s.charCodeAt(0) - 97) + (+s[1] - 1) * 8;
const boardStr = () => (S?.table.pos || '').split('|')[0];

function adopt(s, t0) {
  const t1 = performance.now();
  S = s; fetchedAt = Date.now();
  const mid = t0 != null ? (t0 + t1) / 2 : t1;
  if (s.now) srvOffset = Date.parse(s.now) - (Date.now() - (t1 - mid));   // przesunięcie zegara serwera względem lokalnego (informacyjnie / debug)
  CK = s.clock ? { ...s.clock, at: mid } : null;
}
async function call(fn, args = {}) { const t0 = performance.now(); const s = await api.rpc(fn, { p_code: code, ...args }); adopt(s, t0); return s; }

function message(title, body) {
  $('#room').classList.add('hidden'); $('#joinbox').classList.add('hidden');
  const m = $('#msgbox'); m.classList.remove('hidden'); m.textContent = '';
  m.append(h('img', { class: 'frog-s', src: 'img/frog-sad.svg', alt: '', width: 84, height: 109 }), h('h2', {}, title), h('p', { class: 'muted' }, body), h('a', { class: 'btn primary', href: './#tables' }, 'Back to the lobby'));
}

// ---------- wejście do stołu ----------
async function join(nick) {
  try {
    await call('gry_table_join', { p_nick: nick || nickStore.get() });
  } catch (e) {
    if (/nickname|Nickname|filter|reserved/.test(e.message)) { toast(e.message, 'bad'); return showJoin(); }
    return message('Can\'t join this table', e.message);
  }
  $('#joinbox').classList.add('hidden'); $('#room').classList.remove('hidden');
  if (!chan) chan = api.channel('table:' + code, (ev, p) => {
    if (ev === 'msg' && p?.msg) addMsg(p.msg);
    else if (!S || !p?.v || p.v > S.table.version) refreshSoon(80);
  }, () => refreshSoon(50));   // po (ponownym) połączeniu z kanałem: świeży stan (nic nie umknie między wejściem a subskrypcją)
  render();
}
async function showJoin() {
  const box = $('#joinbox'); box.classList.remove('hidden'); box.textContent = '';
  const inner = h('div');
  box.append(h('p', { class: 'pill', style: 'display:inline-block' }, 'Table ' + code), inner);
  await identityCard(inner, { cta: 'Join table', onReady: (nick) => join(nick) });
}
async function refresh() {
  try {
    const t0 = performance.now();
    const s = await api.rpc('gry_table_state', { p_code: code });
    if (!s.me.joined) return message('You left this table', 'Open the invite link again to come back.');
    const turnChanged = !S || s.table.version !== S.table.version;
    adopt(s, t0);
    if (turnChanged && !myTurn()) sel = null;
    render();
  } catch (e) { if (/does not exist|closed/.test(e.message)) message('This table is closed', 'Tables close by themselves when nobody plays for a while.'); }
}
function refreshSoon(ms = 150) { clearTimeout(refreshT); refreshT = setTimeout(refresh, ms); }

// ---------- rysowanie ----------
function render() {
  if (!S) return;
  const t = S.table;
  document.title = `${GAME[t.game]} · table ${t.code} · PEP Games`;
  $('#tgame').textContent = GAME[t.game] + ' · ' + t.tc.label + (BOT ? '' : t.private ? ' · private' : '') + (t.no_touch ? ' · no-touch' : '');
  $('#rules-body').textContent = RULES[t.game] + (CK ? ' ' + CLOCK_RULES[CK.kind] : '');
  renderPlayers(); renderStatus(); renderBoard(); renderActions(); renderMoves(); renderSend(); renderClocks();
  for (const m of S.messages) addMsg(m);
}
function renderPlayers() {
  const ul = $('#plist'); ul.textContent = '';
  const t = S.table;
  for (const seat of [1, 2]) {
    const p = playerBySeat(seat);
    const color = COLORS[t.game][seat - 1];
    const away = p && !p.active && t.status === 'playing'
      ? Math.max(0, S.forfeit_seconds - p.away_for - Math.floor((Date.now() - fetchedAt) / 1000)) : null;
    ul.append(h('li', { class: [t.status === 'playing' && t.turn === seat ? 'drawing' : '', p?.user_id === S.me.user_id ? 'me' : ''].join(' ') },
      h('span', { class: `seat-dot ${t.game} s${seat}`, 'aria-hidden': 'true' }),
      h('span', { class: 'nick' }, p ? p.nick : 'waiting…', ' ', p && !BOT ? badge(p.verified, false, true) : p?.user_id === 'bot' ? '🤖' : null,
        h('span', { class: 'small muted' }, ' ' + color),
        away != null ? h('span', { class: 'small away' }, ` · away, forfeit in ${Math.floor(away / 60)}:${String(away % 60).padStart(2, '0')}`) : null,
        p?.left ? h('span', { class: 'small muted' }, ' · left') : null),
      h('span', { class: 'score' }, t.status === 'finished' && t.result ? (t.result === 'draw' ? '½' : t.result === 'p' + seat ? '1' : '0') : '')));
  }
  const w = S.spectators.map((x) => x.nick);
  $('#watchers').textContent = BOT ? (S.bot?.thinking ? '🤖 The bot is thinking…' : '🤖 Bot game: only in this browser, nothing is saved online.') : !S.table.spectators ? 'No spectators at this table.' : w.length ? `👀 Watching (${w.length}): ${w.join(', ')}` : '👀 Nobody watching yet. Spectators can follow the game and chat.';
}
function resultText() {
  const t = S.table;
  if (!t.result) return `Game aborted (${t.reason})`;
  if (t.result === 'draw') return `Draw (${t.reason})`;
  const win = playerBySeat(t.result === 'p1' ? 1 : 2);
  const mine = meSeat() && t.result === 'p' + meSeat();
  return (mine ? 'You win! 🎉 ' : '') + `${win?.nick || 'Winner'} wins (${t.reason})`;
}
function renderStatus() {
  const t = S.table, el = $('#status'); el.textContent = '';
  let txt;
  if (t.status === 'waiting') txt = meSeat() ? 'Waiting for an opponent… Send them the invite link.' : 'Waiting for a second player…';
  else if (t.status === 'finished') txt = resultText();
  else if (t.game === 'battleship') txt = seaStatus();
  else if (myTurn()) {
    txt = 'Your move';
    if (t.check) txt += ' · Check!';
    if (t.game === 'checkers' && (t.legal || []).some((m) => m.includes('x'))) txt += ' · You must capture';
  } else {
    const p = playerBySeat(t.turn);
    txt = meSeat() ? `${p?.nick || 'Opponent'} is thinking…` : `${p?.nick || '?'} to move`;
    if (t.check) txt += ' · Check!';
  }
  el.append(txt, h('small', {}, (meSeat() ? `You play ${playerBySeat(meSeat())?.color || ''}` : 'You are watching (read-only)') + (BOT ? ' · 🤖 vs ' : ' · ⏱ ') + t.tc.label));
  el.classList.toggle('mine', myTurn());
}

// chess / checkers: 8x8; widok od strony gracza (miejsce 2 = plansza obrócona)
function renderBoard() {
  const t = S.table, el = $('#board'); el.textContent = '';
  el.className = 'board ' + t.game;
  if (t.game === 'connect4') return renderC4(el);
  if (t.game === 'battleship') return renderSea(el);
  const b = boardStr(), flip = meSeat() === 2, legal = myTurn() ? (t.legal || []) : [];
  const last = lastSquares();
  let targets = new Set(), from = null, caps = new Set();
  if (t.game === 'chess' && sel) { from = sel; for (const m of legal) if (m.slice(0, 2) === sel) targets.add(m.slice(2, 4)); }
  if (t.game === 'checkers' && sel) {
    from = sel[sel.length - 1];
    for (const m of legal) { const p = m.split(/[-x]/); if (sel.every((s, i) => p[i] === s) && p.length > sel.length) targets.add(p[sel.length]); }
    for (let i = 1; i < sel.length; i++) caps.add(sqName((sqIdx(sel[i - 1]) + sqIdx(sel[i])) / 2));
  }
  const movable = new Set(legal.map((m) => m.slice(0, 2)));
  let kingInCheck = null;
  if (t.game === 'chess' && t.check) kingInCheck = sqName(b.indexOf(t.turn === 1 ? 'K' : 'k'));
  for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
    const r = flip ? row : 7 - row, f = flip ? 7 - col : col, i = r * 8 + f, name = sqName(i), pc = b[i] || '.';
    const dark = (r + f) % 2 === 0;
    const cls = ['sq', dark ? 'dk' : 'lt'];
    if (last.has(name)) cls.push('last');
    if (from === name || (t.game === 'checkers' && sel?.includes(name))) cls.push('sel');
    if (targets.has(name)) cls.push(pc !== '.' ? 'tcap' : 'tgt');
    if (caps.has(name)) cls.push('gone');
    if (kingInCheck === name) cls.push('incheck');
    if (movable.has(name) && !sel) cls.push('can');
    const label = name + (pc === '.' ? '' : ', ' + pieceLabel(t.game, pc));
    const cell = h('button', { type: 'button', class: cls.join(' '), 'data-sq': name, 'aria-label': label, role: 'gridcell', onclick: () => clickSq(name) });
    if (pc !== '.') cell.append(pieceEl(t.game, pc));
    if (col === 0) cell.append(h('i', { class: 'crd rk' }, String(r + 1)));
    if (row === 7) cell.append(h('i', { class: 'crd fl' }, String.fromCharCode(97 + f)));
    el.append(cell);
  }
}
function pieceLabel(g, pc) {
  if (g === 'chess') return (pc === pc.toUpperCase() ? 'white ' : 'black ') + PNAME[pc.toLowerCase()];
  return (pc.toLowerCase() === 'b' ? 'black ' : 'white ') + (pc === pc.toUpperCase() ? 'king' : 'man');
}
function pieceEl(g, pc) {
  if (g === 'chess') return h('span', { class: 'pc ' + (pc === pc.toUpperCase() ? 'w' : 'b'), 'aria-hidden': 'true' }, GLYPH[pc.toLowerCase()] + '\uFE0E');
  return h('span', { class: 'man ' + (pc.toLowerCase() === 'b' ? 'b' : 'w') + (pc === pc.toUpperCase() ? ' king' : ''), 'aria-hidden': 'true' }, pc === pc.toUpperCase() ? '♛\uFE0E' : '');
}
function lastSquares() {
  const t = S.table, s = new Set();
  if (!t.last_move || t.game === 'connect4') return s;
  if (t.game === 'chess') { s.add(t.last_move.slice(0, 2)); s.add(t.last_move.slice(2, 4)); }
  else for (const x of t.last_move.split(/[-x]/)) s.add(x);
  return s;
}
function renderC4(el) {
  const t = S.table, b = boardStr(), lastI = +(t.pos || '').split('|')[2], win = new Set(t.win_line || []);
  const legal = new Set(myTurn() ? (t.legal || []) : []);
  for (let row = 5; row >= 0; row--) for (let c = 0; c < 7; c++) {
    const i = row * 7 + c, v = b[i];
    const cls = ['cell']; if (legal.has(String(c + 1))) cls.push('can'); if (i === lastI) cls.push('last'); if (win.has(i)) cls.push('win');
    el.append(h('button', { type: 'button', class: cls.join(' '), 'data-col': c + 1, role: 'gridcell',
      'aria-label': `column ${c + 1}, row ${row + 1}` + (v === 'r' ? ', red' : v === 'y' ? ', yellow' : ''), onclick: () => clickCol(c + 1) },
      v !== '.' ? h('span', { class: 'disc ' + v + (i === lastI && prevDrop !== t.game_no + ':' + lastI ? ' drop' : ''), 'aria-hidden': 'true' }) : null));
  }
  prevDrop = t.game_no + ':' + lastI;   // animacja spadania tylko dla nowego krążka, nie przy każdym odświeżeniu
}

// ---------- Sea Battle ----------
let draft = null, draftGame = null, draftSel = 0, draftOrient = 'h';
const seaParts = () => (S.table.pos || '').split('|');
function seaStatus() {
  const t = S.table, [phase, , , rd] = seaParts(), seat = meSeat(), ready = +rd;
  const lastTxt = t.last_move ? ` · last shot ${t.last_move.slice(0, -1).toUpperCase()}: ${({ o: 'miss', x: 'hit!', '#': 'sunk!' })[t.last_move.slice(-1)]}` : '';
  if (phase === 'place') {
    const left = h('span', { id: 'place-left', class: 'mono' }, '');
    if (!seat) return h('span', {}, 'Players are placing their ships… ', left);
    if (ready & seat) return h('span', {}, `Waiting for ${playerBySeat(3 - seat)?.nick || 'the opponent'} to place the ships… `, left);
    if (BOT) return 'Place your fleet';
    return h('span', {}, 'Place your fleet · ', left, ' left');
  }
  if (myTurn()) return 'Your shot — tap a square in the enemy waters' + lastTxt;
  const p = playerBySeat(t.turn);
  return (seat ? `${p?.nick || 'Opponent'} is aiming…` : `${p?.nick || '?'} to shoot`) + lastTxt;
}
// draft placement: [{ len, name, cell: index | null, o: 'h' | 'v' }]
function draftCells(sh) { const out = []; if (sh.cell == null) return out; for (let k = 0; k < sh.len; k++) out.push(sh.cell + (sh.o === 'h' ? k : 10 * k)); return out; }
const draftStr = () => draft.map((sh) => E.seaName(sh.cell) + sh.o + sh.len).join(',');
function draftBoard() { const b = Array(100).fill('.'); draft.forEach((sh, n) => draftCells(sh).forEach((i) => { b[i] = String(n + 1); })); return b; }
function canPlace(n, cell, o) {
  const len = draft[n].len, r = (cell / 10) | 0, c = cell % 10;
  if ((o === 'h' && c + len > 10) || (o === 'v' && r + len > 10)) return 'A ship sticks out of the board';
  const others = Array(100).fill('.'); draft.forEach((sh, k) => { if (k !== n) draftCells(sh).forEach((i) => { others[i] = String(k + 1); }); });
  for (let k = 0; k < len; k++) {
    const i = cell + (o === 'h' ? k : 10 * k);
    if (others[i] !== '.') return 'Ships overlap';
    if (S.table.no_touch) for (const d of [-11, -10, -9, -1, 1, 9, 10, 11]) {
      const j = i + d; if (j < 0 || j > 99 || Math.abs((j % 10) - (i % 10)) > 1) continue;
      if (others[j] !== '.') return 'Ships may not touch (no-touch rule)';
    }
  }
  return null;
}
function seaClickOwn(i) {
  const [phase, , , rd] = seaParts(), seat = meSeat();
  if (phase !== 'place' || !seat || (+rd & seat) || S.table.status !== 'playing') return;
  const b = draftBoard();
  if (b[i] !== '.') {   // tap on a placed ship = pick it up again
    draftSel = +b[i] - 1; draft[draftSel].cell = null; return renderBoard();
  }
  if (draftSel == null) return;
  const err = canPlace(draftSel, i, draftOrient);
  if (err) { toast(err, 'bad'); return; }
  draft[draftSel].cell = i; draft[draftSel].o = draftOrient;
  const next = draft.findIndex((sh) => sh.cell == null); draftSel = next >= 0 ? next : null;
  renderBoard();
}
function seaGrid(owner, { label, ships, shots, click, can, lastCell }) {
  const g = h('div', { class: 'sea-grid' + (can ? ' armed' : ''), 'data-owner': owner, role: 'grid', 'aria-label': label });
  g.append(h('span', { class: 'sg-corner' }));
  for (let c = 0; c < 10; c++) g.append(h('span', { class: 'sg-lbl' }, String.fromCharCode(65 + c)));
  for (let r = 0; r < 10; r++) {
    g.append(h('span', { class: 'sg-lbl' }, String(r + 1)));
    for (let c = 0; c < 10; c++) {
      const i = r * 10 + c, sh = shots ? shots[i] : '.', ship = ships ? ships[i] : '.';
      const cls = ['sc'];
      if (ship && ship !== '.') cls.push('ship');
      if (sh === 'o') cls.push('miss'); else if (sh === 'x') cls.push('hit'); else if (sh === '#') cls.push('sunk');
      if (lastCell === i) cls.push('last');
      if (can && sh === '.') cls.push('can');
      const name = E.seaName(i);
      g.append(h('button', { type: 'button', class: cls.join(' '), 'data-cell': name, role: 'gridcell',
        'aria-label': name.toUpperCase() + ({ o: ', miss', x: ', hit', '#': ', sunk' }[sh] || '') + (ship && ship !== '.' ? ', ship' : ''),
        onclick: click ? () => click(i) : null }));
    }
  }
  return h('div', { class: 'sea-side' }, h('div', { class: 'sea-title' }, label), g);
}
function renderSea(el) {
  const t = S.table, [phase, s1, s2, rd] = seaParts(), seat = meSeat(), shots = { 1: s1, 2: s2 }, fin = t.status === 'finished';
  const lastCell = t.last_move ? E.seaIdx(t.last_move.slice(0, -1)) : null, lastShooter = 3 - t.turn;
  const nick = (n) => playerBySeat(n)?.nick || COLORS.battleship[n - 1];
  if (seat && draftGame !== t.game_no) { draft = SHIPS.map(([len, name]) => ({ len, name, cell: null, o: 'h' })); draftGame = t.game_no; draftSel = 0; }
  const placing = seat && phase === 'place' && !(+rd & seat) && t.status === 'playing';
  const reveal = (n) => (fin && S.fleets ? S.fleets[n] : null);
  if (seat) {
    const opp = 3 - seat;
    const myShips = placing ? draftBoard() : (S.fleet || reveal(seat));
    el.append(h('div', { class: 'sea' },
      seaGrid(seat, { label: placing ? 'Your fleet — place your ships' : 'Your waters', ships: myShips, shots: shots[opp], click: placing ? seaClickOwn : null,
        lastCell: lastShooter === opp ? lastCell : null }),
      phase === 'place' && !fin ? null : seaGrid(opp, { label: `Enemy waters — ${nick(opp)}`, ships: reveal(opp), shots: shots[seat],
        click: (i) => { if (myTurn() && !busy && shots[seat][i] === '.') send(E.seaName(i)); }, can: myTurn(), lastCell: lastShooter === seat ? lastCell : null })));
    if (placing) el.append(seaTools());
  } else {
    el.append(h('div', { class: 'sea' },
      seaGrid(1, { label: `${nick(1)}'s waters`, ships: reveal(1), shots: shots[2], lastCell: lastShooter === 2 ? lastCell : null }),
      seaGrid(2, { label: `${nick(2)}'s waters`, ships: reveal(2), shots: shots[1], lastCell: lastShooter === 1 ? lastCell : null })));
  }
}
function seaTools() {
  const all = draft.every((sh) => sh.cell != null);
  return h('div', { class: 'sea-tools' },
    h('div', { class: 'sea-ships' }, draft.map((sh, n) => h('button', { type: 'button', class: 'btn sm ship-chip' + (draftSel === n ? ' on' : '') + (sh.cell != null ? ' placed' : ''),
      'data-ship': n, onclick: () => { if (sh.cell != null) sh.cell = null; draftSel = n; renderBoard(); } }, `${sh.name} ${'■'.repeat(sh.len)}`))),
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn sm', id: 'sea-rotate', onclick: () => { draftOrient = draftOrient === 'h' ? 'v' : 'h'; renderBoard(); } },
        draftOrient === 'h' ? '↔ Horizontal (tap to rotate)' : '↕ Vertical (tap to rotate)'),
      h('button', { type: 'button', class: 'btn sm', id: 'sea-random', onclick: () => {
        const f = E.seaRandomFleet(!!S.table.no_touch).split(',');
        f.forEach((x, n) => { const m = /^([a-j])(\d+)([hv])(\d)$/.exec(x); draft[n] = { ...draft[n], len: +m[4], cell: E.seaIdx(m[1] + m[2]), o: m[3] }; });
        draftSel = null; renderBoard(); } }, '🎲 Random'),
      h('button', { type: 'button', class: 'btn sm', id: 'sea-clear', onclick: () => { draft.forEach((sh) => { sh.cell = null; }); draftSel = 0; renderBoard(); } }, 'Clear'),
      h('button', { type: 'button', class: 'btn sm primary', id: 'sea-ready', disabled: !all || busy, onclick: async () => {
        busy = true;
        try { await call('gry_table_fleet', { p_ships: draftStr() }); } catch (e) { toast(e.message, 'bad'); } finally { busy = false; render(); }
      } }, '✅ Ready')),
    h('p', { class: 'small muted' }, draftSel != null ? `Tap a square to place the ${draft[draftSel].name} (${draft[draftSel].len}). Tap a placed ship to move it.` : all ? 'All ships placed. Press Ready.' : 'Pick a ship.'));
}

// ---------- zegary ----------
const fmtClock = (ms) => {
  ms = Math.max(0, ms);
  if (ms < 10000) return '0:0' + (Math.floor(ms / 100) / 10).toFixed(1);   // < 10 s: dziesiąte części sekundy
  const sec = Math.ceil(ms / 1000);
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
};
function clockNow() {
  if (!CK) return null;
  const el = performance.now() - CK.at, run = CK.running;
  if (CK.kind === 'clock') {
    const left = CK.left.map((v, i) => (run === i + 1 ? v - el : v));
    return { left, run, first: CK.first_move_left != null ? CK.first_move_left - el : null };
  }
  return { run, move: CK.left != null ? CK.left - el : null };
}
function renderClocks() {
  const top = $('#clock-top'), bot = $('#clock-bottom');
  let c = clockNow(); const t = S?.table;
  clearTimeout(clockTimer);
  if (c && CK.kind === 'place') {   // Sea Battle: time to place the ships (shown in the status line)
    const left = CK.left != null ? CK.left - (performance.now() - CK.at) : null;
    const el = $('#place-left'); if (el && left != null) el.textContent = fmtClock(left);
    top.classList.add('hidden'); bot.classList.add('hidden');
    if (left == null || t.status !== 'playing') return;
    if (left <= 0 && Date.now() - flagAt > 1000) { flagAt = Date.now(); call('gry_table_flag').then(() => render()).catch(() => {}); }
    clockTimer = setTimeout(renderClocks, 250); return;
  }
  top.classList.toggle('hidden', !c); bot.classList.toggle('hidden', !c);
  if (!c) return;
  const bottomSeat = meSeat() === 2 ? 2 : 1;
  for (const [el, seat] of [[top, 3 - bottomSeat], [bot, bottomSeat]]) {
    const p = playerBySeat(seat), running = c.run === seat && t.status === 'playing';
    let main, sub = '', ms;
    if (c.left) {   // szachy: zegar partii
      ms = c.left[seat - 1]; main = fmtClock(ms);
      if (t.status === 'playing' && c.first != null && t.turn === seat) sub = `first move: ${Math.max(0, Math.ceil(c.first / 1000))}s`;
      else if (t.tc.inc) sub = `+${t.tc.inc}s / move`;
    } else {         // warcaby / C4: limit na ruch
      ms = running ? c.move : t.tc.move * 1000; main = running ? fmtClock(ms) : '–';
      sub = `${t.tc.move}s per move`;
    }
    const firstRun = t.status === 'playing' && c.first != null && t.turn === seat;
    el.className = 'tclock' + (running || firstRun ? ' run' : '') + ((running && ms < 10000) || (firstRun && c.first < 10000) ? ' low' : '') + (ms <= 0 && c.left ? ' flag' : '') + (seat === meSeat() ? ' mine' : '');
    el.dataset.seat = seat;
    el.textContent = '';
    el.append(h('span', { class: `seat-dot ${t.game} s${seat}`, 'aria-hidden': 'true' }),
      h('span', { class: 'tc-name' }, p ? p.nick : 'waiting…', h('small', {}, sub)),
      h('span', { class: 'tc-time', 'aria-label': (p?.nick || '') + ' time left' }, main));
  }
  if (t.status !== 'playing') return;
  // czas minął na zegarze lokalnym → prośba do serwera o sprawdzenie (serwer decyduje wg własnego czasu)
  const out = (c.left && c.run && c.left[c.run - 1] <= 0) || (c.first != null && c.first <= 0) || (c.move != null && c.move <= 0);
  if (out && Date.now() - flagAt > 1000) {
    flagAt = Date.now();
    call('gry_table_flag').then(() => { sel = null; render(); }).catch(() => {});
  }
  const urgent = (c.left && c.run && c.left[c.run - 1] < 10000) || (c.move != null && c.move < 10000) || (c.first != null && c.first < 10000);
  clockTimer = setTimeout(renderClocks, urgent ? 100 : 250);
}

// ---------- ruchy ----------
function clickSq(name) {
  const t = S.table;
  if (!myTurn() || busy) return;
  const legal = t.legal || [];
  if (t.game === 'chess') {
    if (sel) {
      const cands = legal.filter((m) => m.slice(0, 2) === sel && m.slice(2, 4) === name);
      if (cands.length === 1) return send(cands[0]);
      if (cands.length > 1) return choosePromotion(cands);
    }
    sel = legal.some((m) => m.slice(0, 2) === name) && sel !== name ? name : null;
    return renderBoard();
  }
  // checkers: kolejne pola ścieżki (wielokrotne bicie = kilka stuknięć)
  if (sel) {
    const next = sel.concat(name);
    const ext = legal.map((m) => [m, m.split(/[-x]/)]).filter(([, p]) => next.every((s, i) => p[i] === s));
    if (ext.length) {
      const done = ext.find(([, p]) => p.length === next.length);
      if (done && ext.length === 1) return send(done[0]);
      sel = next; return renderBoard();
    }
  }
  sel = legal.some((m) => m.startsWith(name)) && !(sel && sel.length === 1 && sel[0] === name) ? [name] : null;
  renderBoard();
}
function clickCol(c) { if (myTurn() && !busy && (S.table.legal || []).includes(String(c))) send(String(c)); }
function choosePromotion(cands) {
  const ov = $('#overlay'); ov.textContent = ''; ov.classList.remove('hidden');
  const white = meSeat() === 1;
  ov.append(h('div', { class: 'promo' }, h('div', { class: 'big' }, 'Promote to'),
    h('div', { class: 'row', style: 'justify-content:center;margin-top:10px' }, ['q', 'r', 'b', 'n'].map((p) => {
      const m = cands.find((x) => x.endsWith(p));
      return m ? h('button', { type: 'button', class: 'btn promo-btn', 'data-piece': p, 'aria-label': PNAME[p], onclick: () => { ov.classList.add('hidden'); send(m); } },
        h('span', { class: 'pc ' + (white ? 'w' : 'b') }, GLYPH[p] + '\uFE0E')) : null;
    })),
    h('button', { type: 'button', class: 'btn sm', style: 'margin-top:12px', onclick: () => { ov.classList.add('hidden'); sel = null; renderBoard(); } }, 'Cancel')));
}
async function send(m) {
  busy = true;
  try { await call('gry_table_move', { p_move: m }); }
  catch (e) { toast(e.message, 'bad'); refreshSoon(0); }
  finally { busy = false; sel = null; render(); }
}

// ---------- przyciski ----------
function renderActions() {
  const t = S.table, bar = $('#actions'); bar.textContent = '';
  const seat = meSeat(), opp = seat ? playerBySeat(3 - seat) : null;
  const act = (fn, args = {}) => async () => {
    try { await call(fn, args); render(); } catch (e) { toast(e.message, 'bad'); }
  };
  if (!BOT) bar.append(h('button', { type: 'button', class: 'btn sm', id: 'copylink', onclick: copyInvite }, '🔗 Copy invite link'));
  if (seat && t.status === 'playing') {
    if (BOT || t.game === 'battleship') { /* no draw offers vs the bot or in Sea Battle */ }
    else if (t.draw_offer === 3 - seat) {
      bar.append(h('span', { class: 'small', id: 'drawoffer' }, `${opp?.nick || 'Opponent'} offers a draw`),
        h('button', { type: 'button', class: 'btn sm primary', id: 'draw-accept', onclick: act('gry_table_draw', { p_action: 'accept' }) }, 'Accept draw'),
        h('button', { type: 'button', class: 'btn sm', id: 'draw-decline', onclick: act('gry_table_draw', { p_action: 'decline' }) }, 'Decline'));
    } else {
      bar.append(h('button', { type: 'button', class: 'btn sm', id: 'draw-offer', disabled: t.draw_offer === seat, onclick: act('gry_table_draw', { p_action: 'offer' }) },
        t.draw_offer === seat ? 'Draw offered…' : '½ Offer draw'));
    }
    bar.append(h('button', { type: 'button', class: 'btn sm', id: 'resign', onclick: () => { if (confirm('Resign this game?')) act('gry_table_resign')(); } }, '🏳️ Resign'));
  }
  if (seat && t.status === 'finished') {
    const mine = t.rematch & (seat === 1 ? 1 : 2), theirs = t.rematch & (seat === 1 ? 2 : 1);
    if (theirs && !mine) bar.append(h('span', { class: 'small', id: 'rematch-note' }, `${opp?.nick || 'Opponent'} wants a rematch!`));
    bar.append(h('button', { type: 'button', class: 'btn sm primary', id: 'rematch', disabled: !!mine || opp?.left, onclick: act('gry_table_rematch') },
      mine ? 'Rematch asked… waiting' : BOT ? '🔁 New game (swap colors)' : '🔁 Rematch (swap colors)'));
  }
  bar.append(h('button', { type: 'button', class: 'btn sm', id: 'leave', style: 'margin-left:auto', onclick: async () => {
    if (seat && t.status === 'playing' && !BOT && !confirm('Leaving now counts as a loss. Leave the table?')) return;
    try { await api.rpc('gry_table_leave', { p_code: code }); } catch {}
    chan?.close(); location.href = './#tables';
  } }, 'Leave table'));
}
async function copyInvite() {
  const url = location.origin + location.pathname + '?t=' + code;
  try { await navigator.clipboard.writeText(url); toast('Invite link copied: ' + url, 'good'); }
  catch { prompt('Copy this invite link:', url); }
}
function renderMoves() {
  const t = S.table, el = $('#moves'); el.textContent = '';
  const mv = t.moves || [];
  if (!mv.length) { el.append(h('span', { class: 'muted' }, t.status === 'waiting' ? '' : 'No moves yet.')); return; }
  const fmt = (m) => t.game === 'chess' ? m.slice(0, 2) + '-' + m.slice(2, 4) + (m[4] ? '=' + m[4].toUpperCase() : '') : t.game === 'connect4' ? 'col ' + m
    : t.game === 'battleship' ? m.slice(0, -1).toUpperCase() + ({ o: ' miss', x: ' hit', '#': ' sunk' })[m.slice(-1)] : m;
  for (let i = 0; i < mv.length; i += 2) el.append(h('span', { class: 'mv' }, h('b', {}, (i / 2 + 1) + '. '), fmt(mv[i]), mv[i + 1] ? ' ' + fmt(mv[i + 1]) : ''));
  el.scrollLeft = el.scrollWidth;
}

// ---------- czat (limit: 1 wiadomość / 2 s, liczony na serwerze) ----------
function addMsg(m) {
  const box = $('#msgs');
  if (box.querySelector(`[data-id="${m.id}"]`)) return;
  const stick = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
  const el = m.kind === 'system' ? h('p', { class: 'sys', 'data-id': m.id }, m.body) : h('p', { 'data-id': m.id }, h('b', {}, m.nick + ': '), m.body);
  const after = [...box.children].find((x) => +x.dataset.id > m.id);   // kolejność wg id (realtime może wyprzedzić odświeżenie)
  after ? box.insertBefore(el, after) : box.append(el);
  if (stick) box.scrollTop = box.scrollHeight;
}
function renderSend() {
  const btn = $('#chatsend'); const left = Math.ceil((sendReadyAt - Date.now()) / 1000);
  clearTimeout(cdTimer);
  if (left > 0) { btn.disabled = true; btn.textContent = `Send (${left})`; cdTimer = setTimeout(renderSend, 250); }
  else { btn.disabled = false; btn.textContent = 'Send'; }
}
$('#chatform').addEventListener('submit', async (e) => {
  e.preventDefault();
  const inp = $('#chatin'), text = inp.value.trim();
  if (!text || Date.now() < sendReadyAt) return renderSend();
  inp.value = '';
  try {
    const r = await api.rpc('gry_table_chat', { p_code: code, p_text: text });
    if (r?.msg) addMsg(r.msg);
    sendReadyAt = Date.now() + (S?.cooldown || 0) * 1000;
  } catch (err) {
    const w = /wait (\d+)s/.exec(err.message || ''); if (w) sendReadyAt = Date.now() + +w[1] * 1000;
    toast(err.message, 'bad'); inp.value = text;
  } finally { renderSend(); }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sel) { sel = null; renderBoard(); } });

// ---------- start ----------
if (BOT) {
  $('#chatform').classList.add('hidden'); $('.table-room .chat h3').textContent = 'Game log';
  await join(nickStore.get() || 'You');
} else if (!code) message('No table code', 'Open a table from the lobby or use an invite link.');
else if (be.session() && nickStore.get()) await join(nickStore.get());
else await showJoin();
// obecność + walkower: stan co 10 s (serwer liczy 3 min nieobecności); powrót do karty = od razu świeży stan
setInterval(() => { if (S && !document.hidden) refresh(); }, 10000);
setInterval(() => { if (S?.table.status === 'playing' && S.players.some((p) => !p.active)) renderPlayers(); }, 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && S) refresh(); });
addEventListener('online', () => S && refresh());
