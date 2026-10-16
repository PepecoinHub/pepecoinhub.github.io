import { showLoginPrompt } from '@devvit/web/client';
import type { AnswerResponse, ArchiveView, BoardRow, GuessResponse, GuessView, State, SuggestResponse } from '../shared/api.js';
import { shareText } from '../shared/api.js';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

let state: State | undefined;
let tab: 'standings' | 'board' | 'how' = 'standings';
let busy = false;
let introDismissed = false;
let lastShare: string | undefined;
const draft = { answers: ['', '', ''], guesses: ['', '', ''] };
let lastSig = '';

const STEPS: [string, string][] = [
  ['One question a day', 'Everyone in the sub answers it. Name something you\'d bring to a picnic: type up to 3 answers.'],
  ['Next day, guess the board', 'Yesterday\'s answers are hidden. Type 3 guesses and see what the sub said.'],
  ['Score what the crowd scored', 'If 41% of people said "sandwiches" and you guessed it, you get 41 points. Popular answers are worth more.'],
];

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, body === undefined ? undefined : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return (await res.json()) as T;
}

async function refresh(force = false) {
  try {
    const s = await api<State>('/api/state');
    // Do not rebuild the page under someone who is typing.
    const typing = document.activeElement instanceof HTMLInputElement;
    const sig = JSON.stringify({ ...s, nextRoundAt: 0 });
    if (!force && (typing || sig === lastSig)) {
      state = s;
      return;
    }
    lastSig = sig;
    state = s;
    render();
  } catch (e) {
    say('Could not load the game. Try again in a moment.', true);
    console.error(e);
  }
}

function say(text: string, bad = false) {
  const el = $('msg');
  el.textContent = text;
  el.className = 'msg' + (bad ? ' bad' : '');
}

function until(ms: number): string {
  const left = Math.max(0, ms - Date.now());
  const h = Math.floor(left / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
const cd = (ms: number) => `<span class="cd" data-until="${ms}">${until(ms)}</span>`;

// ---------- rendering ----------

function render() {
  if (!state) return;
  const s = state;
  document.body.className = `theme-${s.theme}`;
  $('sub').textContent = `r/${s.subreddit} · week ends in ${until(s.weekEndsAt)}`;
  const streak = $('streak');
  streak.hidden = s.me.streak < 1;
  streak.textContent = `🔥 ${s.me.streak} day${s.me.streak === 1 ? '' : 's'}`;

  const showIntro = !introDismissed && !s.me.seenIntro;
  $('intro').hidden = !showIntro;
  if (showIntro) $('introcards').innerHTML = stepCards();

  renderGuess(s.guess);
  renderCollect(s);
  const nothing = $('nothing');
  nothing.hidden = !!s.guess || !!s.collect;
  if (!nothing.hidden) {
    nothing.innerHTML = `<h2>No round is running</h2><p class="hint">The next question appears automatically. Meanwhile, check the last board below.</p>`;
  }

  for (const t of ['standings', 'board', 'how'] as const) {
    $(`tab-${t}`).hidden = tab !== t;
  }
  document.querySelectorAll<HTMLElement>('.tab').forEach((b) => b.classList.toggle('on', b.dataset['tab'] === tab));
  $('tab-standings').innerHTML = standings(s);
  $('tab-board').innerHTML = archive(s.archive);
  $('tab-how').innerHTML = `<div class="cards">${stepCards()}</div><p class="fine">An answer reaches the board only when at least 3 different people gave it. Spelling variants and typos are merged. Standings reset every Monday (UTC).</p>`;
  $('note').textContent = s.sponsorNote;
}

const stepCards = () => STEPS.map(([t, d], i) => `<div class="card"><div class="no">${i + 1}</div><div><b>${t}</b><span>${d}</span></div></div>`).join('');

function rows(board: BoardRow[], hits: Set<string>, hiddenCount = 0): string {
  const max = Math.max(1, ...board.map((b) => b.pct));
  const shown = board.map((b, i) => `<div class="row reveal ${hits.has(b.text) ? 'hit' : ''} ${i === 0 ? 'top' : ''}" style="animation-delay:${i * 90}ms"><div class="bar" style="width:${Math.round((100 * b.pct) / max)}%"></div><div class="no">${i + 1}</div><div class="t">${esc(b.text)}</div><div class="p">${b.pct}</div></div>`);
  const hidden = Array.from({ length: hiddenCount }, (_, i) => `<div class="row hidden"><div class="no">${i + 1}</div><div class="t">· · · · ·</div><div class="p">??</div></div>`);
  return `<div class="rows">${shown.join('')}${hidden.join('')}</div>`;
}

function renderGuess(g: GuessView | undefined) {
  const el = $('guess');
  el.hidden = !g;
  if (!g || !state) return;
  if (g.status === 'void') {
    el.innerHTML = `<h2>Yesterday's question</h2><p class="q">${esc(g.question)}</p><p class="hint">${esc(g.voidReason ?? 'There is no board for this round.')} Try today's question!</p>`;
    return;
  }
  if (g.mine && g.board) {
    const matched = new Set(g.mine.guesses.map((x) => x.matched).filter((m): m is string => !!m));
    const marks = g.mine.guesses.map((x) => x.mark);
    const share = shareText(state.subreddit, g.n, g.mine.points, marks);
    lastShare = share;
    el.innerHTML = `<h2>Sub Says #${g.n} · your result</h2><p class="q">${esc(g.question)}</p>
      <div class="score">${g.mine.points} pts</div>
      ${g.mine.guesses.map((x) => `<div class="guessline"><span>${esc(x.text)}${x.matched ? ` → ${esc(x.matched)}` : ''}</span><span class="m ${x.mark === 'top' ? 'top' : x.mark === 'board' ? 'ok' : 'no'}">${x.mark === 'miss' ? 'X' : '+' + x.points}</span></div>`).join('')}
      <h3>The board</h3>${rows(g.board, matched)}
      <div class="share"><pre id="sharetext">${esc(share)}</pre><button id="copy">Copy my score</button></div>`;
    return;
  }
  const inputs = [0, 1, 2].map((i) => `<input data-g="${i}" type="text" maxlength="40" autocomplete="off" placeholder="Guess #${i + 1}" value="${esc(draft.guesses[i] ?? '')}">`).join('');
  el.innerHTML = `<h2>Guess what r/${esc(state.subreddit)} said · #${g.n}</h2><p class="q">${esc(g.question)}</p>
    <p class="hint">${g.respondents} people answered. The board has ${g.boardSize} answers. Closes in ${cd(g.closesAt)}.</p>
    ${rows([], new Set(), g.boardSize)}
    <div class="inputs">${inputs}</div>
    <button id="sendguess" class="primary" ${busy ? 'disabled' : ''}>Reveal the board</button>`;
}

function renderCollect(s: State) {
  const el = $('collect');
  const c = s.collect;
  el.hidden = !c;
  if (!c) return;
  if (c.answered) {
    el.innerHTML = `<h2>Today's question · #${c.n}</h2><p class="q">${esc(c.question)}</p>
      <p class="hint">✅ Your answers are in. ${c.respondents} ${c.respondents === 1 ? 'person has' : 'people have'} answered so far. Come back in ${cd(c.closesAt)} to guess the board.</p>`;
    return;
  }
  const inputs = [0, 1, 2].map((i) => `<input data-a="${i}" list="sugg" type="text" maxlength="40" autocomplete="off" placeholder="${i === 0 ? 'Your answer' : 'Another answer (optional)'}" value="${esc(draft.answers[i] ?? '')}">`).join('');
  el.innerHTML = `<h2>Today's question · #${c.n}</h2><p class="q">${esc(c.question)}</p>
    <p class="hint">Answer in a word or two, up to 3 answers. One try, no edits. ${c.respondents} answered so far.</p>
    <div class="inputs">${inputs}</div>
    <button id="sendanswer" class="primary" ${busy ? 'disabled' : ''}>${s.me.loggedIn ? 'Send my answers' : 'Log in to answer'}</button>`;
}

function standings(s: State): string {
  if (!s.weekly.length) return '<p class="empty">Nobody has scored yet this week. Be the first!</p>';
  const mine = s.me.name;
  const table = `<table><thead><tr><th>#</th><th>Player</th><th class="n">Points</th></tr></thead><tbody>${s.weekly
    .map((r, i) => `<tr class="${r.name === mine ? 'me' : ''}"><td>${i + 1}</td><td>u/${esc(r.name)}</td><td class="n">${r.points}</td></tr>`)
    .join('')}</tbody></table>`;
  const you = s.me.loggedIn && s.me.weekRank && s.me.weekRank > s.weekly.length ? `<p class="hint">You: #${s.me.weekRank} with ${s.me.weekPoints} points.</p>` : '';
  return `<p class="hint">Answering earns 5 points. Guessing earns the % of people who gave that answer.</p>${table}${you}`;
}

function archive(a: ArchiveView | undefined): string {
  if (!a) return '<p class="empty">The first board appears one day after the first question.</p>';
  if (a.status === 'void') return `<h3>#${a.n} · ${esc(a.question)}</h3><p class="empty">Not enough answers for a board that time.</p>`;
  return `<h3>#${a.n} · ${esc(a.question)}</h3><p class="hint">${a.respondents} people answered.</p>${rows(a.board, new Set())}`;
}

// ---------- actions ----------

async function sendAnswers() {
  if (!state?.collect || busy) return;
  if (!state.me.loggedIn) return showLoginPrompt();
  const answers = draft.answers.map((a) => a.trim()).filter(Boolean);
  if (!answers.length) return say('Type at least one answer.', true);
  busy = true;
  render();
  try {
    const r = await api<AnswerResponse>('/api/answer', { n: state.collect.n, answers });
    if (r.ok) {
      draft.answers = ['', '', ''];
      say(`Thanks! +${r.points} points.`);
    } else {
      say(errorText(r.error, 'answer'), true);
    }
  } catch (e) {
    console.error(e);
    say('Network hiccup. Nothing was sent.', true);
  } finally {
    busy = false;
    await refresh(true);
  }
}

async function sendGuesses() {
  if (!state?.guess || busy) return;
  if (!state.me.loggedIn) return showLoginPrompt();
  const guesses = draft.guesses.map((a) => a.trim()).filter(Boolean);
  if (!guesses.length) return say('Type at least one guess.', true);
  busy = true;
  render();
  try {
    const r = await api<GuessResponse>('/api/guess', { n: state.guess.n, guesses });
    if (r.ok) {
      draft.guesses = ['', '', ''];
      say(r.result.points > 0 ? `You scored ${r.result.points}!` : 'No luck this time. Come back tomorrow!');
    } else {
      say(errorText(r.error, 'guess'), true);
    }
  } catch (e) {
    console.error(e);
    say('Network hiccup. Nothing was sent.', true);
  } finally {
    busy = false;
    await refresh(true);
  }
}

function errorText(e: string, kind: 'answer' | 'guess'): string {
  const t: Record<string, string> = {
    login: 'Log in to Reddit to play.',
    closed: 'This round has just closed.',
    already: kind === 'answer' ? 'You already answered this one.' : 'You already guessed this round.',
    invalid: 'Those answers cannot be used. Use 2 to 40 characters, no links or bad words.',
    void: 'There is no board for this round.',
    busy: 'Easy there. Try again.',
  };
  return t[e] ?? 'Something went wrong.';
}

async function copyShare() {
  if (!lastShare) return;
  try {
    await navigator.clipboard.writeText(lastShare);
    say('Copied! Paste it in the comments.');
  } catch {
    const pre = document.getElementById('sharetext');
    if (pre) {
      const range = document.createRange();
      range.selectNodeContents(pre);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    say('Select the text above and copy it.');
  }
}

// ---------- autocomplete (spelling only: no counts, no ranking) ----------

const suggestCache = new Map<string, string[]>();
let suggestTimer: number | undefined;

function onType(input: HTMLInputElement) {
  const q = input.value.trim().toLowerCase();
  window.clearTimeout(suggestTimer);
  if (q.length < 2) return void ($('sugg').innerHTML = '');
  suggestTimer = window.setTimeout(async () => {
    let list = suggestCache.get(q);
    if (!list) {
      try {
        list = (await api<SuggestResponse>(`/api/suggest?q=${encodeURIComponent(q)}`)).suggestions;
      } catch {
        list = [];
      }
      suggestCache.set(q, list);
    }
    $('sugg').innerHTML = list.map((s) => `<option value="${esc(s)}"></option>`).join('');
  }, 300);
}

// ---------- wiring ----------

document.addEventListener('input', (e) => {
  const t = e.target as HTMLInputElement;
  if (t.dataset['a'] !== undefined) {
    draft.answers[Number(t.dataset['a'])] = t.value;
    onType(t);
  } else if (t.dataset['g'] !== undefined) {
    draft.guesses[Number(t.dataset['g'])] = t.value;
  }
});

document.addEventListener('click', (e) => {
  const el = e.target as HTMLElement;
  const tabBtn = el.closest<HTMLElement>('.tab');
  if (tabBtn) {
    tab = tabBtn.dataset['tab'] as typeof tab;
    return render();
  }
  if (el.closest('#help')) {
    tab = 'how';
    render();
    return $('tab-how').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  if (el.closest('#introgo')) {
    introDismissed = true;
    $('intro').hidden = true;
    void api('/api/intro', {}).catch(() => undefined);
    return;
  }
  if (el.closest('#sendanswer')) return void sendAnswers();
  if (el.closest('#sendguess')) return void sendGuesses();
  if (el.closest('#copy')) return void copyShare();
});

// Enter moves to the next field, and sends from the last one.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const t = e.target as HTMLInputElement;
  const group = t.dataset['a'] !== undefined ? 'a' : t.dataset['g'] !== undefined ? 'g' : undefined;
  if (!group) return;
  e.preventDefault();
  const i = Number(t.dataset[group]);
  const next = document.querySelector<HTMLInputElement>(`[data-${group}="${i + 1}"]`);
  if (next) next.focus();
  else void (group === 'a' ? sendAnswers() : sendGuesses());
});

setInterval(() => {
  document.querySelectorAll<HTMLElement>('.cd').forEach((c) => (c.textContent = until(Number(c.dataset['until']))));
}, 30_000);

void refresh(true);
const pollMs = Number(new URLSearchParams(location.search).get('poll')) || 45_000;
setInterval(() => {
  if (!document.hidden && !busy) void refresh();
}, pollMs);
