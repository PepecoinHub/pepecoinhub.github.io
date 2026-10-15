import { connectRealtime, context, getWebViewMode, requestExpandedMode, showLoginPrompt } from '@devvit/web/client';
import type { FireResponse, GameState, LiveMsg, Mark } from '../shared/api.js';
import { liveChannel } from '../shared/api.js';
import { cellLabel } from '../shared/game.js';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let state: GameState | undefined;
let selected: number | undefined;
let busy = false;
const feed: string[] = [];

// ---------- network ----------

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, body === undefined ? undefined : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return (await res.json()) as T;
}

async function refresh() {
  try {
    state = await api<GameState>('/api/state');
    render();
  } catch (e) {
    say('Could not load the game. Pull down to retry.', 'bad');
    console.error(e);
  }
}

// ---------- state helpers ----------

function markOf(cell: number): 'm' | 'h' | 's' | undefined {
  if (!state) return undefined;
  if (state.sunk.some((s) => s.cells.includes(cell))) return 's';
  return state.shots[String(cell)];
}

function applyShot(cell: number, result: Mark, sunk?: { len: number; cells: number[]; by: string }) {
  if (!state) return;
  const had = state.shots[String(cell)];
  state.shots[String(cell)] = result;
  if (!had) state.totalShots += 1;
  if (sunk && !state.sunk.some((s) => s.cells[0] === sunk.cells[0])) {
    state.sunk.push(sunk);
    const i = state.remaining.indexOf(sunk.len);
    if (i >= 0) state.remaining.splice(i, 1);
  }
}

function pushFeed(html: string) {
  feed.unshift(html);
  feed.length = Math.min(feed.length, 6);
}

// ---------- actions ----------

async function fire() {
  if (!state || selected === undefined || busy) return;
  if (!state.me.loggedIn) return showLoginPrompt();
  const cell = selected;
  busy = true;
  render();
  try {
    const r = await api<FireResponse>('/api/fire', { cell });
    selected = undefined;
    if (r.ok) {
      applyShot(r.cell, r.result, r.sunk);
      state.me.charges = r.charges;
      state.me.nextAt = r.nextAt;
      state.me.shots += 1;
      state.me.score += r.points;
      const where = cellLabel(r.cell, state.size);
      if (r.won) say(`You sank the last ship! The fleet is gone.`, 'good');
      else if (r.sunk) say(`${where}: you sank a ${r.sunk.len}-ship! +${r.points}`, 'good');
      else if (r.result === 'h') say(`${where}: HIT! +${r.points}`, 'good');
      else say(`${where}: splash. Miss.`, 'bad');
      popCell(r.cell);
      if (r.sunk || r.won) void refresh(); // pick up the leaderboard
    } else if (r.error === 'taken') {
      if (r.existing) applyShot(cell, r.existing);
      selected = undefined;
      say('Someone just fired there. No shot was used.', 'bad');
    } else if (r.error === 'cooldown') {
      state.me.charges = 0;
      state.me.nextAt = r.nextAt ?? null;
      say('Out of shots. One comes back soon.', 'bad');
    } else if (r.error === 'finished') {
      say('The fleet is already sunk.', 'bad');
      void refresh();
    } else if (r.error === 'busy') {
      say('Easy, captain. Try again.', 'bad');
    } else {
      say('Log in to Reddit to fire.', 'bad');
      showLoginPrompt();
    }
  } catch (e) {
    console.error(e);
    say('Network hiccup. Your shot was not used.', 'bad');
  } finally {
    busy = false;
    render();
  }
}

function onCell(cell: number) {
  if (!state || state.finish || markOf(cell)) return;
  if (selected === cell) return void fire(); // second tap fires
  selected = cell;
  render();
}

// ---------- live feed ----------

function onLive(m: LiveMsg) {
  if (!state) return;
  if (m.t === 'shot') {
    const label = cellLabel(m.cell, state.size);
    const fresh = state.shots[String(m.cell)] === undefined;
    applyShot(m.cell, m.result, m.sunk);
    state.totalShots = Math.max(state.totalShots, m.totalShots);
    if (fresh) {
      const what = m.sunk ? `sank a ${m.sunk.len}-ship at ${label}` : m.result === 'h' ? `hit ${label}` : `missed ${label}`;
      pushFeed(`<b>${esc(m.by)}</b> ${what}`);
      popCell(m.cell);
    }
    if (selected === m.cell) selected = undefined;
    render();
  } else {
    void refresh();
  }
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

// ---------- rendering ----------

function say(text: string, kind: 'good' | 'bad' | '' = '') {
  const el = $('msg');
  el.textContent = text;
  el.className = 'msg ' + kind;
}

function popCell(cell: number) {
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLElement>(`[data-cell="${cell}"]`);
    el?.classList.add('pop');
  });
}

function glyph(m: 'm' | 'h' | 's' | undefined) {
  const pepe = state?.theme === 'pepe';
  if (m === 'm') return '·';
  if (m === 'h') return pepe ? '🐸' : '✕';
  if (m === 's') return pepe ? '🐸' : '■';
  return '';
}

function render() {
  if (!state) return;
  const s = state;
  document.body.className = `theme-${s.theme}`;
  $('title').textContent = s.theme === 'pepe' ? `🐸 Armada · r/${s.subreddit}` : `🚢 Armada · r/${s.subreddit}`;
  $('st-shots').textContent = String(s.totalShots);
  $('st-players').textContent = String(s.players);
  $('st-left').textContent = String(s.remaining.length);

  const banner = $('banner');
  if (s.finish) {
    banner.hidden = false;
    banner.textContent = `Fleet destroyed in ${s.finish.shots} shots by ${s.finish.players} players. Final blow: u/${s.finish.finisher}.`;
  } else banner.hidden = true;

  // Board with column letters and row numbers.
  const board = $('board');
  board.style.gridTemplateColumns = `1.4em repeat(${s.size}, 1fr)`;
  const parts: string[] = ['<div class="hd"></div>'];
  for (let x = 0; x < s.size; x++) parts.push(`<div class="hd">${String.fromCharCode(65 + x)}</div>`);
  for (let y = 0; y < s.size; y++) {
    parts.push(`<div class="hd">${y + 1}</div>`);
    for (let x = 0; x < s.size; x++) {
      const cell = y * s.size + x;
      const m = markOf(cell);
      const cls = ['cell', m ?? '', selected === cell ? 'sel' : ''].join(' ').trim();
      const label = `${cellLabel(cell, s.size)}, ${m === 'm' ? 'miss' : m === 'h' ? 'hit' : m === 's' ? 'sunk ship' : 'unknown'}`;
      parts.push(`<button class="${cls}" data-cell="${cell}" aria-label="${label}" ${m || s.finish ? 'disabled' : ''}>${glyph(m)}</button>`);
    }
  }
  board.innerHTML = parts.join('');

  // Shots banked.
  $('pips').innerHTML = Array.from({ length: s.maxCharges }, (_, i) => `<span class="pip ${i < s.me.charges ? 'on' : ''}"></span>`).join('');
  const fireBtn = $<HTMLButtonElement>('fire');
  if (s.finish) {
    fireBtn.disabled = true;
    fireBtn.textContent = 'Game over';
  } else if (!s.me.loggedIn) {
    fireBtn.disabled = false;
    fireBtn.textContent = 'Log in to play';
    fireBtn.onclick = () => showLoginPrompt();
  } else if (s.me.charges < 1) {
    fireBtn.disabled = true;
    fireBtn.textContent = 'Reloading…';
  } else if (selected === undefined) {
    fireBtn.disabled = true;
    fireBtn.textContent = 'Pick a square';
  } else {
    fireBtn.disabled = busy;
    fireBtn.textContent = busy ? 'Firing…' : `Fire at ${cellLabel(selected, s.size)}`;
  }
  if (s.me.loggedIn) fireBtn.onclick = () => void fire();
  tickTimer();

  // Fleet chips: afloat ships first, then sunk ones.
  const chip = (len: number, down: boolean) => `<span class="ship ${down ? 'down' : ''}" title="${len}-ship${down ? ' (sunk)' : ''}">${'<i></i>'.repeat(len)}</span>`;
  $('fleet').innerHTML = s.remaining.map((l) => chip(l, false)).join('') + s.sunk.map((x) => chip(x.len, true)).join('');

  $('leaders').innerHTML = s.leaders.length
    ? s.leaders.map((l) => `<li><span>${esc(l.name)}</span><b>${l.score}</b></li>`).join('')
    : '<li><span>No shots yet. Be the first!</span></li>';
  $('feed').innerHTML = feed.length ? feed.map((f) => `<li><span>${f}</span></li>`).join('') : '<li><span>Waiting for shots…</span></li>';
  $('note').textContent = s.sponsorNote;
}

function tickTimer() {
  if (!state) return;
  const me = state.me;
  const el = $('timer');
  if (state.finish) return void (el.textContent = '');
  if (me.nextAt && me.charges < state.maxCharges) {
    const left = me.nextAt - Date.now();
    if (left <= 0) {
      me.charges = Math.min(state.maxCharges, me.charges + 1);
      me.nextAt = me.charges < state.maxCharges ? me.nextAt + state.regenSec * 1000 : null;
      return render();
    }
    const m = Math.floor(left / 60000);
    const sec = Math.floor((left % 60000) / 1000);
    el.textContent = `Next shot in ${m}:${String(sec).padStart(2, '0')}. You can bank up to ${state.maxCharges}.`;
  } else {
    el.textContent = me.loggedIn ? `Shots full. Your tap picks, a second tap fires.` : '';
  }
}

// ---------- boot ----------

$('board').addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-cell]');
  if (btn) onCell(Number(btn.dataset['cell']));
});

const expandBtn = $<HTMLButtonElement>('expand');
if (getWebViewMode() === 'inline') {
  expandBtn.hidden = false;
  expandBtn.addEventListener('click', (e) => requestExpandedMode(e, 'default'));
}

void refresh().then(() => {
  // `context` is undefined outside Reddit (the local dev server), where polling takes over.
  const postId = (context as { postId?: string } | undefined)?.postId;
  if (postId) {
    connectRealtime<LiveMsg>({ channel: liveChannel(postId), onMessage: onLive });
  }
});
setInterval(tickTimer, 1000);
// Safety net in case a realtime message is missed (tab in the background, flaky connection).
const pollMs = Number(new URLSearchParams(location.search).get('poll')) || 30_000;
setInterval(() => {
  if (!document.hidden && !busy) void refresh();
}, pollMs);
