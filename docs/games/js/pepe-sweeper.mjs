import { LEVELS, newGame, reveal, toggleFlag, chord } from './pepe-sweeper-engine.mjs';

const $ = selector => document.querySelector(selector);
const board = $('#board'), counter = $('#left-counter'), clock = $('#time-counter');
const status = $('#status'), mood = $('#mood'), face = $('#reset'), faceImg = $('#face-img');
const FACES = { ready: 'img/emotes/pep.webp', scared: 'img/emotes/peek.webp', won: 'img/emotes/cheer.webp', lost: 'img/emotes/wen.webp' };
const setFace = k => { if (!faceImg.src.endsWith(FACES[k])) faceImg.src = FACES[k]; };
const result = $('#result'), bestEl = $('#best');
const coin = '../assets/coins/pepe.png';
const flagIcon = 'img/sweeper-flag.svg';
let level = 'easy', game, buttons = [], seconds = 0, paused = false, flagMode = false;
let holdTimer = null, longPressed = -1;

if (new URLSearchParams(location.search).has('embed')) document.body.classList.add('embed');
// inside PondOS: tell the window how big the game is, so the window fits the board instead of the whole screen
const embedded = document.body.classList.contains('embed') && parent !== window;
let wantW = 560;
function postSize() {
  if (!embedded) return;
  const pond = document.querySelector('.pond');
  parent.postMessage({ type: 'pepe-sweeper-size', w: wantW + 12, h: Math.ceil(pond.getBoundingClientRect().height) }, location.origin);
}
if (embedded && 'ResizeObserver' in window) new ResizeObserver(postSize).observe(document.querySelector('.pond'));

function bestKey() { return `pep-sweeper-best-${level}`; }
function getBest() {
  try { const value = localStorage.getItem(bestKey()); if (value === null) return null; const n = Number(value); return Number.isInteger(n) && n >= 0 ? n : null; } catch { return null; }
}
function showBest() { const best = getBest(); bestEl.textContent = best === null ? 'BEST: --:--' : `BEST: ${String(Math.floor(best / 60)).padStart(2, '0')}:${String(best % 60).padStart(2, '0')}`; }
function setMode(flag) {
  flagMode = flag;
  $('#dig-mode').setAttribute('aria-pressed', String(!flag));
  $('#flag-mode').setAttribute('aria-pressed', String(flag));
  status.textContent = flag ? 'FLAG MODE. MARK THE WRONG PEPE.' : 'DIG MODE. FIND THE SAFE LILY PADS.';
}
function newRound(next = level) {
  level = next; game = newGame(level); seconds = 0; paused = false; flagMode = false;
  clearTimeout(holdTimer); longPressed = -1;
  $('#dig-mode').setAttribute('aria-pressed', 'true'); $('#flag-mode').setAttribute('aria-pressed', 'false');
  document.querySelectorAll('[data-level]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.level === level)));
  board.style.setProperty('--cols', game.cols); board.style.setProperty('--rows', game.rows);
  wantW = Math.max(560, game.cols * 27 + 56);
  document.querySelector('.game-window').style.setProperty('--window-width', wantW + 'px');
  board.setAttribute('aria-label', `${LEVELS[level].name}: ${game.cols} by ${game.rows}, ${game.mines} wrong Pepes`);
  $('#board-info').textContent = `${game.cols} × ${game.rows} · ${game.mines} wrong Pepes`;
  $('#board-scroll').scrollLeft = 0;
  buttons = game.cells.map((_, i) => {
    const tile = document.createElement('button');
    tile.type = 'button'; tile.className = 'tile'; tile.dataset.index = i;
    tile.setAttribute('aria-label', `Row ${Math.floor(i / game.cols) + 1}, column ${i % game.cols + 1}, covered`);
    return tile;
  });
  board.replaceChildren(...buttons);
  result.hidden = true; mood.textContent = 'GOOD LUCK, FREN'; setFace('ready');
  status.textContent = 'READY. PICK A LILY PAD.'; showBest(); render(); postSize();
}

function render() {
  counter.textContent = String(game.mines - game.flags).padStart(3, '0');
  clock.textContent = String(Math.min(999, seconds)).padStart(3, '0');
  for (let i = 0; i < buttons.length; i++) {
    const tile = buttons[i], cell = game.cells[i], lost = game.status === 'lost';
    const mine = cell.mine && cell.exploded;
    const wrong = lost && cell.flag && !cell.mine;
    tile.className = `tile${cell.open ? ' open' : ''}${cell.flag ? ' flagged' : ''}${mine ? ' mine' : ''}${cell.exploded ? ' exploded' : ''}${wrong ? ' wrong' : ''}${cell.open && !cell.mine && cell.nearby ? ' n' + cell.nearby : ''}`;
    tile.replaceChildren();
    if (mine) {
      const img = document.createElement('img'); img.src = coin; img.alt = ''; tile.append(img);
    } else if (cell.flag) {
      const img = document.createElement('img'); img.src = flagIcon; img.alt = ''; tile.append(img);
    } else if (cell.open && cell.nearby) tile.textContent = String(cell.nearby);
    const state = wrong ? 'wrong flag' : cell.flag ? 'flagged' : mine ? 'wrong Pepe (PEPE on Ethereum)' : cell.open ? (cell.nearby ? `${cell.nearby} nearby traps` : 'empty') : 'covered';
    tile.setAttribute('aria-label', `Row ${Math.floor(i / game.cols) + 1}, column ${i % game.cols + 1}, ${state}`);
    tile.setAttribute('aria-disabled', String(game.status === 'won' || game.status === 'lost'));
  }
}

function afterMove(previous) {
  render();
  if (game.status === 'won' && previous !== 'won') {
    const best = getBest();
    if (best === null || seconds < best) {
      try { localStorage.setItem(bestKey(), String(seconds)); } catch {}
      showBest();
    }
    setFace('won');
    mood.textContent = 'POND LEGEND';
    $('#result-title').textContent = 'THE POND IS SAFE!';
    $('#result-copy').textContent = `${seconds}s. Every wrong Pepe spotted. The frens may sleep tonight.`;
    status.textContent = 'VICTORY. ALL SAFE LILY PADS CLEARED.'; result.hidden = false;
  } else if (game.status === 'lost' && previous !== 'lost') {
    setFace('lost');
    mood.textContent = 'WRONG PEPE!';
    $('#result-title').textContent = 'WRONG PEPE!';
    $('#result-copy').textContent = 'That one was PEPE on Ethereum, not PEP. Try again, fren.';
    status.textContent = 'GAME OVER. WRONG PEPE.'; result.hidden = false;
  }
}

function act(index, flag = false, both = false) {
  if (paused || !Number.isInteger(index)) return;
  const before = game.status;
  const changed = flag ? toggleFlag(game, index) : both ? chord(game, index) : game.cells[index]?.open ? chord(game, index) : reveal(game, index);
  if (changed) {
    if (game.status === 'playing') status.textContent = flag ? 'FLAG PLACED. TRUST YOUR INSTINCTS.' : 'FIELD ACTIVE. WATCH THE NUMBERS.';
    afterMove(before);
  }
}

board.addEventListener('click', event => {
  const tile = event.target.closest('.tile'); if (!tile) return;
  const index = Number(tile.dataset.index);
  if (longPressed === index) { longPressed = -1; return; }
  act(index, flagMode);
});
board.addEventListener('contextmenu', event => {
  const tile = event.target.closest('.tile'); if (!tile) return;
  event.preventDefault(); act(Number(tile.dataset.index), true);
});
board.addEventListener('dblclick', event => {
  const tile = event.target.closest('.tile'); if (tile) act(Number(tile.dataset.index), false, true);
});
board.addEventListener('pointerdown', event => {
  const tile = event.target.closest('.tile'); if (!tile || event.button !== 0) return;
  longPressed = -1;
  if (game.status === 'ready' || game.status === 'playing') setFace('scared');
  if (event.pointerType !== 'touch') return;
  const index = Number(tile.dataset.index);
  clearTimeout(holdTimer);
  holdTimer = setTimeout(() => { longPressed = index; act(index, true); navigator.vibrate?.(12); }, 520);
});
for (const type of ['pointerup', 'pointercancel', 'pointerleave']) board.addEventListener(type, () => { clearTimeout(holdTimer); if (game.status === 'ready' || game.status === 'playing') setFace('ready'); });
board.addEventListener('keydown', event => {
  const tile = event.target.closest('.tile'); if (!tile) return;
  const index = Number(tile.dataset.index);
  if (event.key.toLowerCase() === 'f') { event.preventDefault(); act(index, true); return; }
  const shift = {ArrowLeft:-1,ArrowRight:1,ArrowUp:-game.cols,ArrowDown:game.cols}[event.key];
  if (shift !== undefined) { event.preventDefault(); const next = index + shift; if (next >= 0 && next < buttons.length && (Math.abs(shift) !== 1 || Math.floor(index / game.cols) === Math.floor(next / game.cols))) buttons[next].focus(); }
});
document.querySelectorAll('[data-level]').forEach(button => button.addEventListener('click', () => newRound(button.dataset.level)));
$('#reset').addEventListener('click', () => newRound()); $('#again').addEventListener('click', () => newRound());
$('#menu-help').addEventListener('click', () => { const open = $('#help-box').hidden; $('#help-box').hidden = !open; $('#menu-help').setAttribute('aria-expanded', String(open)); });
$('#dig-mode').addEventListener('click', () => setMode(false)); $('#flag-mode').addEventListener('click', () => setMode(true));
window.addEventListener('keydown', event => { if (event.key === 'F2') { event.preventDefault(); newRound(); } });
window.addEventListener('message', event => { if (event.origin === location.origin && event.source === parent && event.data === 'pepe-sweeper-pause') paused = true; });
window.addEventListener('focus', () => { paused = false; });
document.addEventListener('pointerdown', () => { paused = false; });
document.addEventListener('visibilitychange', () => { paused = document.hidden; });
setInterval(() => { if (game?.status === 'playing' && !paused && seconds < 999) { seconds++; clock.textContent = String(seconds).padStart(3, '0'); } }, 1000);
newRound();
