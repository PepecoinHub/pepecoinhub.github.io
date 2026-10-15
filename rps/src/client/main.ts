import { connectRealtime, context, showLoginPrompt } from '@devvit/web/client';
import {
  type DuelAcceptResponse,
  type DuelOpenResponse,
  LIVE_CHANNEL,
  type LiveMsg,
  type MyThrow,
  type State,
  type TeamResponse,
  type ThrowResponse,
  type Tick,
} from '../shared/api.js';
import { MOVES, type Move, type Result } from '../shared/rules.js';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const EMOJI: Record<Move, string> = { r: '✊', p: '✋', s: '✌️' };
const NAME: Record<Move, string> = { r: 'Rock', p: 'Paper', s: 'Scissors' };

let state: State | undefined;
let mode: 'team' | 'duel' = 'team';
let tab: 'teams' | 'duels' | 'me' = 'teams';
let busy = false;
let lastResult: { kind: 'matched'; result: Result; mine: Move; opp: string; oppMove: Move } | { kind: 'waiting'; mine: Move; duel: boolean } | undefined;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, body === undefined ? undefined : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return (await res.json()) as T;
}

async function refresh() {
  try {
    state = await api<State>('/api/state');
    render();
  } catch (e) {
    say('Could not load the arena. Try again in a moment.', true);
    console.error(e);
  }
}

function say(text: string, bad = false) {
  const el = $('msg');
  el.textContent = text;
  el.className = 'msg' + (bad ? ' bad' : '');
}

const verdict = (r: Result) => (r === 'w' ? 'You win!' : r === 'l' ? 'You lose.' : 'Draw.');
const word = (r: Result) => (r === 'w' ? 'Won' : r === 'l' ? 'Lost' : 'Draw');

// ---------- actions ----------

async function joinTeam(raw: string) {
  if (!state?.me.loggedIn) return showLoginPrompt();
  const r = await api<TeamResponse>('/api/team', { team: raw });
  if (r.ok) {
    say('');
    picking = false;
    return refresh();
  }
  const text: Record<string, string> = {
    invalid: 'That does not look like a subreddit name.',
    notfound: 'We could not find that subreddit, or it is private.',
    nsfw: 'NSFW and quarantined subreddits cannot join.',
    locked: 'You already threw this week. You can switch when the new week starts.',
    login: 'Log in to Reddit first.',
  };
  say(text[r.error] ?? 'Could not join.', true);
}

async function doMove(m: Move) {
  if (!state || busy) return;
  if (!state.me.loggedIn) return showLoginPrompt();
  busy = true;
  render();
  try {
    if (mode === 'team') {
      const r = await api<ThrowResponse>('/api/throw', { move: m });
      if (r.ok && r.status === 'matched') {
        lastResult = { kind: 'matched', result: r.result, mine: m, opp: `r/${r.oppTeam}`, oppMove: r.oppMove };
        say('');
      } else if (r.ok) {
        lastResult = { kind: 'waiting', mine: m, duel: false };
        say('');
      } else say(throwError(r.error), true);
    } else {
      const r = await api<DuelOpenResponse>('/api/duel/open', { move: m });
      if (r.ok) {
        lastResult = { kind: 'waiting', mine: m, duel: true };
        tab = 'duels';
        say('');
      } else say(throwError(r.error), true);
    }
  } catch (e) {
    console.error(e);
    say('Network hiccup. Your throw was not used.', true);
  } finally {
    busy = false;
    await refresh();
  }
}

async function acceptDuel(id: string, m: Move) {
  if (!state || busy) return;
  if (!state.me.loggedIn) return showLoginPrompt();
  busy = true;
  try {
    const r = await api<DuelAcceptResponse>('/api/duel/accept', { id, move: m });
    if (r.ok) {
      lastResult = { kind: 'matched', result: r.result, mine: m, opp: `u/${r.oppName}`, oppMove: r.oppMove };
      say('');
    } else {
      const text: Record<string, string> = {
        gone: 'Too slow, someone took that duel. No throw was used.',
        self: 'You cannot accept your own duel.',
        limit: 'No throws left today. Come back tomorrow.',
        busy: 'Easy there. Try again.',
        login: 'Log in to Reddit first.',
        invalid: 'Something went wrong.',
      };
      say(text[r.error] ?? 'Could not accept.', true);
    }
  } catch (e) {
    console.error(e);
    say('Network hiccup. Your throw was not used.', true);
  } finally {
    busy = false;
    await refresh();
  }
}

function throwError(e: string) {
  return (
    ({
      noteam: 'Pick a team first.',
      limit: 'No throws left today. Come back tomorrow.',
      pending: 'You already have 3 throws waiting. Wait for one to be settled.',
      busy: 'Easy there. Try again.',
      login: 'Log in to Reddit first.',
      invalid: 'Something went wrong.',
    } as Record<string, string>)[e] ?? 'Could not throw.'
  );
}

// ---------- rendering ----------

function render() {
  if (!state) return;
  const s = state;
  document.body.className = `theme-${s.theme}`;
  $('title').textContent = s.theme === 'pepe' ? '🐸 Subreddit Wars' : '✊✋✌️ Subreddit Wars';
  const left = s.seasonEndsAt - Date.now();
  const d = Math.floor(left / 86_400_000);
  const h = Math.floor((left % 86_400_000) / 3_600_000);
  $('season').textContent = `Week ends in ${d}d ${h}h`;

  renderNews();
  const hasTeam = !!s.me.team;
  const showPick = !hasTeam || (picking && s.me.canChangeTeam);
  $('pick').hidden = !showPick;
  $('play').hidden = !hasTeam || showPick;
  if (showPick) renderPick();
  if (hasTeam) renderPlay();

  document.querySelectorAll<HTMLElement>('.tab').forEach((b) => {
    b.classList.toggle('on', b.dataset['tab'] === tab);
  });
  for (const t of ['teams', 'duels', 'me'] as const) $(`tab-${t}`).hidden = tab !== t;
  renderTeams();
  renderDuels();
  renderMe();
  $('ticker').innerHTML = s.ticker.length
    ? s.ticker.map((t) => `<li>${tickText(t)}</li>`).join('')
    : '<li>Waiting for the first fight…</li>';
  $('note').textContent = s.sponsorNote;
}

let picking = false;

function renderPick() {
  const s = state!;
  $('chips').innerHTML = s.featured.map((t) => `<button class="chip" data-team="${esc(t)}">r/${esc(t)}</button>`).join('');
}

function renderPlay() {
  const s = state!;
  $('myteam').textContent = `Fighting for r/${s.me.team}`;
  $('changeteam').hidden = !s.me.canChangeTeam;
  $('mode-team').classList.toggle('on', mode === 'team');
  $('mode-duel').classList.toggle('on', mode === 'duel');
  $('mode-team').setAttribute('aria-selected', String(mode === 'team'));
  $('mode-duel').setAttribute('aria-selected', String(mode === 'duel'));
  $('modehint').textContent =
    mode === 'team'
      ? 'Your throw is matched with a player from a different subreddit. Wins score for your team.'
      : 'Put a hidden throw on the table under your name. Anyone on this sub can take it on.';
  const off = busy || s.me.throwsLeft < 1;
  $('moves').innerHTML = MOVES.map((m) => `<button class="move" data-move="${m}" ${off ? 'disabled' : ''} aria-label="${NAME[m]}"><span class="e">${EMOJI[m]}</span><span class="t">${NAME[m]}</span></button>`).join('');
  $('left').textContent = s.me.loggedIn
    ? `${s.me.throwsLeft} of ${s.me.dailyLimit} throws left today${s.me.pending ? ` · ${s.me.pending} waiting for an opponent` : ''}`
    : 'Log in to Reddit to play.';
  const res = $('result');
  if (!lastResult) {
    res.hidden = true;
  } else if (lastResult.kind === 'matched') {
    res.hidden = false;
    res.className = `result ${lastResult.result}`;
    res.innerHTML = `<div class="big">${verdict(lastResult.result)}</div><div class="vs">${EMOJI[lastResult.mine]} vs ${EMOJI[lastResult.oppMove]}</div><div>against ${esc(lastResult.opp)}</div>`;
  } else {
    res.hidden = false;
    res.className = 'result';
    res.innerHTML = `<div class="big">${EMOJI[lastResult.mine]} Thrown</div><div>${lastResult.duel ? 'Your duel is on the table. You will see the result when someone takes it.' : 'No opponent from another subreddit was waiting, so your throw is in the pool. The result will be here when you come back.'}</div>`;
  }
}

function renderNews() {
  const el = $('news');
  const news = state!.me.news;
  if (!news.length) return void (el.hidden = true);
  el.hidden = false;
  el.innerHTML =
    `<b>While you were away</b>` +
    news.map((t) => `<p>${EMOJI[t.move]} ${word(t.result!)} against ${esc(t.kind === 'duel' ? `u/${t.oppName}` : `r/${t.oppTeam}`)} (${EMOJI[t.oppMove!]})</p>`).join('') +
    `<button id="ack">Got it</button>`;
}

function renderTeams() {
  const s = state!;
  const teams = s.teams.length
    ? `<table><thead><tr><th>Team</th><th class="n">Pts</th><th class="n">W-D-L</th><th class="n">Players</th></tr></thead><tbody>${s.teams
        .map((t) => `<tr class="${t.name.toLowerCase() === s.me.team?.toLowerCase() ? 'mine' : ''}"><td>r/${esc(t.name)}</td><td class="n">${t.points}</td><td class="n">${t.w}-${t.d}-${t.l}</td><td class="n">${t.players}</td></tr>`)
        .join('')}</tbody></table>`
    : '<p class="empty">No fights yet this week. Be the first to throw!</p>';
  const rivals = s.rivalries.length
    ? `<h3>Top rivalries</h3><table><tbody>${s.rivalries.map((r) => `<tr><td>r/${esc(r.a)} vs r/${esc(r.b)}</td><td class="n">${r.aw} : ${r.bw}${r.d ? ` (${r.d} draws)` : ''}</td></tr>`).join('')}</tbody></table>`
    : '';
  $('tab-teams').innerHTML = `<p class="hint">Points: 3 for a win, 1 for a draw. The week resets on Monday.</p>${teams}${rivals}`;
}

function renderDuels() {
  const s = state!;
  const off = busy || s.me.throwsLeft < 1 || !s.me.loggedIn;
  const open = s.duels.length
    ? s.duels
        .map((d) =>
          d.mine
            ? `<div class="row"><span>u/${esc(d.name)} (you)</span><span class="badge wait">waiting</span></div>`
            : `<div class="row"><span>u/${esc(d.name)} challenges you</span><span class="mini">${MOVES.map((m) => `<button data-duel="${esc(d.id)}" data-move="${m}" ${off ? 'disabled' : ''} aria-label="${NAME[m]}">${EMOJI[m]}</button>`).join('')}</span></div>`,
        )
        .join('')
    : '<p class="empty">No open duels. Switch to “Open a duel” above and throw one.</p>';
  const board = s.duelists.length
    ? `<h3>Top duelists this week</h3><table><thead><tr><th>Player</th><th class="n">Pts</th><th class="n">W-D-L</th></tr></thead><tbody>${s.duelists.map((d) => `<tr><td>u/${esc(d.name)}</td><td class="n">${d.points}</td><td class="n">${d.w}-${d.d}-${d.l}</td></tr>`).join('')}</tbody></table>`
    : '';
  $('tab-duels').innerHTML = `<p class="hint">Pick a move under a name to take that duel on. You see the result at once.</p>${open}${board}`;
}

function renderMe() {
  const s = state!;
  if (!s.me.loggedIn) return void ($('tab-me').innerHTML = '<p class="empty">Log in to Reddit to see your record.</p>');
  const r = s.me.record;
  const recent = s.me.recent.length
    ? s.me.recent.map((t) => throwRow(t)).join('')
    : '<p class="empty">You have not thrown yet.</p>';
  $('tab-me').innerHTML = `<div class="rec"><span>${r.w}<small>wins</small></span><span>${r.d}<small>draws</small></span><span>${r.l}<small>losses</small></span></div>
    <h3>Recent throws</h3>${recent}
    <p class="hint"><button id="optin" class="link">Notify me when a waiting throw is settled</button></p>`;
}

function throwRow(t: MyThrow) {
  const who = t.kind === 'duel' ? 'duel' : 'team war';
  if (t.status === 'waiting') return `<div class="row"><span>${EMOJI[t.move]} ${who}</span><span class="badge wait">waiting</span></div>`;
  const opp = t.kind === 'duel' ? `u/${esc(t.oppName ?? '')}` : `r/${esc(t.oppTeam ?? '')}`;
  return `<div class="row"><span>${EMOJI[t.move]} vs ${EMOJI[t.oppMove!]} ${opp}</span><span class="badge ${t.result}">${word(t.result!)}</span></div>`;
}

function tickText(t: Tick) {
  const [a, b] = t.duel ? [`u/${esc(t.a)}`, `u/${esc(t.b)}`] : [`r/${esc(t.a)}`, `r/${esc(t.b)}`];
  return t.r === 'w' ? `${a} beat ${b}` : t.r === 'l' ? `${b} beat ${a}` : `${a} drew with ${b}`;
}

// ---------- wiring ----------

document.addEventListener('click', (e) => {
  const el = e.target as HTMLElement;
  const chip = el.closest<HTMLElement>('.chip');
  if (chip) return void joinTeam(chip.dataset['team'] ?? '');
  const duelBtn = el.closest<HTMLElement>('[data-duel]');
  if (duelBtn) return void acceptDuel(duelBtn.dataset['duel']!, duelBtn.dataset['move'] as Move);
  const mv = el.closest<HTMLElement>('.move');
  if (mv) return void doMove(mv.dataset['move'] as Move);
  const tabBtn = el.closest<HTMLElement>('.tab');
  if (tabBtn) {
    tab = tabBtn.dataset['tab'] as typeof tab;
    return render();
  }
  if (el.closest('#mode-team')) { mode = 'team'; return render(); }
  if (el.closest('#mode-duel')) { mode = 'duel'; return render(); }
  if (el.closest('#changeteam')) { picking = true; return render(); }
  if (el.closest('#ack')) {
    void api('/api/ack', {}).then(refresh);
    return;
  }
  if (el.closest('#optin')) {
    void api<{ ok: boolean; message: string }>('/api/optin', {}).then((r) => say(r.ok ? 'Done. We will notify you.' : r.message || 'Notifications are not available right now.', !r.ok));
  }
});

$('teamform').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $<HTMLInputElement>('teaminput');
  picking = false;
  void joinTeam(input.value);
});

let refreshTimer: number | undefined;
function onLive(m: LiveMsg) {
  if (!state) return;
  state.ticker = [{ at: m.at, a: m.a, b: m.b, r: m.r, duel: m.duel }, ...state.ticker].slice(0, 8);
  $('ticker').innerHTML = state.ticker.map((t) => `<li>${tickText(t)}</li>`).join('');
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => void refresh(), 1500); // boards move, so reload them (debounced)
}

void refresh().then(() => {
  // `context` is undefined outside Reddit (the local dev server), where polling takes over.
  if ((context as { postId?: string } | undefined)?.postId) connectRealtime<LiveMsg>({ channel: LIVE_CHANNEL, onMessage: onLive });
});
const pollMs = Number(new URLSearchParams(location.search).get('poll')) || 30_000;
setInterval(() => {
  if (!document.hidden && !busy) void refresh();
}, pollMs);
