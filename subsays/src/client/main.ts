import { showLoginPrompt } from '@devvit/web/client';
import type { AnswerResponse, ArchiveView, BonusNote, BoardRow, GuessResponse, GuessView, LeaderRow, State, SuggestResponse } from '../shared/api.js';
import { shareText } from '../shared/api.js';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

let state: State | undefined;
let tab: 'standings' | 'board' | 'how' = 'standings';
let mode: 'week' | 'all' = 'week';
let busy = false;
let showBoard = false; // the finished guess card is folded away until asked
let retryGuess = false; // testing mode: play the guessing again
let retryAnswer = false; // testing mode: answer again
let lastShare: string | undefined;
let notices: BonusNote[] = [];
const draft = { answers: ['', '', ''], guess: '' };
let lastSig = '';

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, body === undefined ? undefined : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return (await res.json()) as T;
}

async function refresh(force = false) {
  try {
    const s = await api<State>('/api/state');
    if (s.me.bonus.length) notices = [...notices, ...s.me.bonus]; // shown once, then kept until dismissed
    const typing = document.activeElement instanceof HTMLInputElement;
    const sig = JSON.stringify({ ...s, nextRoundAt: 0 });
    if (!force && !s.me.bonus.length && (typing || sig === lastSig)) {
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
  const d = Math.floor(left / 86_400_000);
  const h = Math.floor((left % 86_400_000) / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}
const cd = (ms: number) => `<span class="cd" data-until="${ms}">${until(ms)}</span>`;
const pts = (n: number) => `${n} pt${n === 1 ? '' : 's'}`;

// ---------- rendering ----------

function render() {
  if (!state) return;
  const s = state;
  document.body.className = `theme-${s.theme}`;
  $('sub').textContent = `r/${s.subreddit} · week ends in ${until(s.weekEndsAt)}`;
  $('testbadge').hidden = !s.testMode;
  const streak = $('streak');
  streak.hidden = s.me.streak < 1;
  streak.textContent = `🔥 ${s.me.streak}`;
  streak.title = `${s.me.streak} day${s.me.streak === 1 ? '' : 's'} in a row`;

  renderStats(s);
  renderNotices();
  const hasGuess = !!s.guess;
  renderGuess(s.guess);
  renderCollect(s, hasGuess ? 2 : 1);
  const none = $('none');
  none.hidden = hasGuess || !!s.collect;
  if (!none.hidden) none.innerHTML = `<div class="step"><div class="txt"><h2>No round is running</h2><p>The next question appears automatically. Meanwhile, see the last board below.</p></div></div>`;

  for (const t of ['standings', 'board', 'how'] as const) $(`tab-${t}`).hidden = tab !== t;
  document.querySelectorAll<HTMLElement>('.tab').forEach((b) => b.classList.toggle('on', b.dataset['tab'] === tab));
  $('tab-standings').innerHTML = standings(s);
  $('tab-board').innerHTML = archive(s.archive);
  $('tab-how').innerHTML = howToPlay();
  $('note').textContent = s.sponsorNote;
}

function renderStats(s: State) {
  const el = $('stats');
  el.hidden = !s.me.loggedIn;
  if (!s.me.loggedIn) return;
  el.innerHTML = `<div class="tile"><b>${s.me.weekPoints}</b><span>Points this week</span></div>
    <div class="tile"><b>${s.me.weekRank ? '#' + s.me.weekRank : '–'}</b><span>Your rank</span></div>
    <div class="tile"><b>${s.me.allPoints}</b><span>All time</span></div>`;
}

function renderNotices() {
  $('bonus').innerHTML = notices
    .map(
      (n, i) =>
        `<div class="notice"><div class="t">🎉 <b>Crowd bonus +${n.points}</b> for #${n.n}: ${n.hits.map((h) => `${esc(h.text)} (${h.pct}%)`).join(', ')} made the board.</div><button data-dismiss="${i}" aria-label="Dismiss">×</button></div>`,
    )
    .join('');
}

function boardRows(board: BoardRow[], hits: Set<string>, mineText?: Set<string>): string {
  const max = Math.max(1, ...board.map((b) => b.pct));
  return `<div class="rows">${board
    .map(
      (b, i) =>
        `<div class="row reveal ${hits.has(b.text) ? 'hit' : ''} ${i === 0 && hits.has(b.text) ? 'top' : ''} ${mineText?.has(b.text) ? 'you' : ''}" style="animation-delay:${i * 80}ms"><div class="bar" style="width:${Math.round((100 * b.pct) / max)}%"></div><div class="rk">${i + 1}</div><div class="t">${esc(b.text)}</div><div class="p">${b.pct}</div></div>`,
    )
    .join('')}</div>`;
}

function partialRows(size: number, found: Map<number, { text: string; pct: number }>): string {
  const max = Math.max(1, ...[...found.values()].map((f) => f.pct));
  const out: string[] = [];
  for (let i = 0; i < size; i++) {
    const f = found.get(i);
    out.push(
      f
        ? `<div class="row reveal hit ${i === 0 ? 'top' : ''}"><div class="bar" style="width:${Math.round((100 * f.pct) / max)}%"></div><div class="rk">${i + 1}</div><div class="t">${esc(f.text)}</div><div class="p">${f.pct}</div></div>`
        : `<div class="row hidden"><div class="rk">${i + 1}</div><div class="t">· · · · ·</div><div class="p">??</div></div>`,
    );
  }
  return `<div class="rows">${out.join('')}</div>`;
}

function stepHead(no: number | '✓', title: string, sub: string, pill: string, ok = false) {
  return `<div class="step"><div class="no ${ok ? 'ok' : ''}">${no}</div><div class="txt"><h2>${title}</h2><p>${sub}</p></div><span class="pill">${pill}</span></div>`;
}

function tries(mine: { mark: string }[]): string {
  const cells = [0, 1, 2].map((i) => {
    const g = mine[i];
    if (!g) return `<div class="try"></div>`;
    return g.mark === 'top' ? `<div class="try hit">✓</div>` : g.mark === 'board' ? `<div class="try mid">✓</div>` : `<div class="try miss">✗</div>`;
  });
  return `<div class="tries" aria-label="Your three tries">${cells.join('')}</div>`;
}

function renderGuess(g: GuessView | undefined) {
  const el = $('step1');
  el.hidden = !g;
  if (!g || !state) return;
  const sub = `r/${esc(state.subreddit)} · #${g.n}`;
  if (g.status === 'void') {
    el.innerHTML = `${stepHead(1, 'Yesterday\'s question', sub, 'skipped')}<p class="q">${esc(g.question)}</p><p class="hint">${esc(g.voidReason ?? 'There is no board for this round.')} Try today's question!</p>`;
    return;
  }
  const mine = retryGuess ? [] : (g.mine?.guesses ?? []);
  const finished = g.done && !retryGuess;
  const lines = mine
    .map((x) => `<div class="guessline"><span>${esc(x.text)}${x.matched && x.matched.toLowerCase() !== x.text.toLowerCase() ? ` → ${esc(x.matched)}` : ''}</span><span class="m ${x.mark === 'top' ? 'top' : x.mark === 'board' ? 'ok' : 'no'}">${x.mark === 'miss' ? 'X' : '+' + x.points}</span></div>`)
    .join('');
  if (finished && g.mine && g.board) {
    const matched = new Set(mine.map((x) => x.matched).filter((m): m is string => !!m));
    const share = shareText(state.subreddit, g.n, g.mine.points, mine.map((x) => x.mark));
    lastShare = share;
    const full = `<p class="q">${esc(g.question)}</p>${tries(mine)}${lines}${boardRows(g.board, matched)}<div class="share"><pre id="sharetext">${esc(share)}</pre><button id="copy">Copy my score</button></div>`;
    el.innerHTML = `${stepHead('✓', 'Guess done', sub, `+${g.mine.points} pts`, true)}
      <div class="summary"><div><div class="big">${esc(mine.map((x) => (x.mark === 'top' ? '🟩' : x.mark === 'board' ? '🟨' : '⬜')).join(''))}</div><div class="fine">${esc(g.question)}</div></div><button id="toggleboard" class="ghost">${showBoard ? 'Hide' : 'Show board'}</button></div>
      ${showBoard ? full : ''}${state.testMode ? '<button id="retryguess" class="ghost" style="margin-top:10px;width:100%">Play again (testing)</button>' : ''}`;
    return;
  }
  const found = new Map<number, { text: string; pct: number }>();
  for (const x of mine) if (x.rank !== undefined && x.matched) found.set(x.rank, { text: x.matched, pct: x.points });
  el.innerHTML = `${stepHead(1, 'Guess what the sub said', sub, 'hit = its %')}
    <p class="q">${esc(g.question)}</p>
    <p class="hint">${g.respondents} people answered · ${g.boardSize} answers on the board · closes in ${cd(g.closesAt)}</p>
    ${tries(mine)}${partialRows(g.boardSize, found)}${lines}
    <div class="inputs"><input data-g="0" type="text" maxlength="40" autocomplete="off" placeholder="Guess ${mine.length + 1} of 3" value="${esc(draft.guess)}"></div>
    <button id="sendguess" class="primary" ${busy ? 'disabled' : ''}>${state.me.loggedIn ? 'Check my guess' : 'Log in to play'}</button>`;
}

const answersReady = () => draft.answers.every((a) => a.trim().length >= 2);

function renderCollect(s: State, no: number) {
  const el = $('step2');
  const c = s.collect;
  el.hidden = !c;
  if (!c) return;
  if (c.answered && !retryAnswer) {
    el.innerHTML = `${stepHead('✓', 'Answers sent', `#${c.n} · ${esc(c.question)}`, `+${s.answerPoints} pts`, true)}
      <p class="hint" style="margin:0">${c.respondents} ${c.respondents === 1 ? 'person has' : 'people have'} answered. Come back in ${cd(c.closesAt)} to guess the board.${s.bonusShare > 0 ? ' Answers that reach it earn a crowd bonus.' : ''}</p>${s.testMode ? '<button id="retryanswer" class="ghost" style="margin-top:10px;width:100%">Answer again (testing)</button>' : ''}`;
    return;
  }
  const inputs = [0, 1, 2].map((i) => `<input data-a="${i}" list="sugg" type="text" maxlength="40" autocomplete="off" placeholder="Answer ${i + 1} of 3" value="${esc(draft.answers[i] ?? '')}">`).join('');
  el.innerHTML = `${stepHead(no, 'Answer today\'s question', `r/${esc(s.subreddit)} · #${c.n}`, `+${s.answerPoints} pts${s.bonusShare > 0 ? ' + bonus' : ''}`)}
    <p class="q">${esc(c.question)}</p>
    <p class="hint">Give 3 different answers, a word or two each. One try, no edits. ${c.respondents} answered so far.</p>
    <div class="inputs">${inputs}</div>
    <button id="sendanswer" class="primary" ${busy || (s.me.loggedIn && !answersReady()) ? 'disabled' : ''}>${s.me.loggedIn ? 'Send my 3 answers' : 'Log in to answer'}</button>`;
}

function rowsTable(rows: LeaderRow[], me: { name?: string; rank?: number; points: number }, loggedIn: boolean): string {
  if (!rows.length) return '<p class="empty">Nobody has scored yet. Be the first!</p>';
  const inList = !!me.name && rows.some((r) => r.name === me.name);
  const body = rows.map((r, i) => `<tr class="${r.name === me.name ? 'me' : ''}"><td class="rk">${i + 1}</td><td>u/${esc(r.name)}</td><td class="n">${r.points}</td></tr>`).join('');
  const mine =
    loggedIn && !inList && me.rank
      ? `<tr class="gap"><td colspan="3">⋯</td></tr><tr class="me"><td class="rk">${me.rank}</td><td>u/${esc(me.name ?? 'you')} (you)</td><td class="n">${me.points}</td></tr>`
      : '';
  return `<table><thead><tr><th>#</th><th>Player</th><th class="n">Points</th></tr></thead><tbody>${body}${mine}</tbody></table>`;
}

function standings(s: State): string {
  const week = mode === 'week';
  const seg = `<div class="seg"><button data-mode="week" class="${week ? 'on' : ''}">This week</button><button data-mode="all" class="${week ? '' : 'on'}">All time</button></div>`;
  const table = week
    ? rowsTable(s.weekly, { name: s.me.name, rank: s.me.weekRank, points: s.me.weekPoints }, s.me.loggedIn)
    : rowsTable(s.allTime, { name: s.me.name, rank: s.me.allRank, points: s.me.allPoints }, s.me.loggedIn);
  return `${seg}<p class="hint" style="margin-top:0">Top 20${week ? ` · resets in ${until(s.weekEndsAt)}` : ''}</p>${table}`;
}

function archive(a: ArchiveView | undefined): string {
  if (!a) return '<p class="empty">The first board appears one day after the first question.</p>';
  if (a.status === 'void') return `<p class="q">${esc(a.question)}</p><p class="empty">Not enough answers for a board that time.</p>`;
  return `<p class="fine">#${a.n} · ${a.respondents} people answered</p><p class="q">${esc(a.question)}</p>${boardRows(a.board, new Set())}`;
}

function howToPlay(): string {
  const cards: [string, string][] = [
    ['One question a day', 'Give 3 different answers. A word or two each. One try.'],
    ['Next day, guess the board', 'Guess one answer at a time. You see at once if the sub said it. 3 tries.'],
    ['Score what the crowd scored', 'A hit is worth the % of people who gave that answer.'],
  ];
  const bonus = state && state.bonusShare > 0 ? `<tr><td>Crowd bonus: each of your answers that reaches the board</td><td>${Math.round(state.bonusShare * 100)}% of its %</td></tr>` : '';
  return `<div class="how">${cards.map(([t, d], i) => `<div class="c"><div class="no">${i + 1}</div><div><b>${t}</b><span>${d}</span></div></div>`).join('')}</div>
    <table class="pts"><tbody>
      <tr><td>Send your 3 answers</td><td>+${state?.answerPoints ?? 20}</td></tr>${bonus}
      <tr><td>Each guess that hits the board</td><td>its %</td></tr>
    </tbody></table>
    <p class="fine" style="margin-top:10px">An answer reaches the board only when at least 3 different people gave it. Typos and plurals are merged. Standings reset every Monday (UTC).</p>`;
}

// ---------- actions ----------

async function sendAnswers() {
  if (!state?.collect || busy) return;
  if (!state.me.loggedIn) return showLoginPrompt();
  if (!answersReady()) return say('Give 3 answers, at least 2 letters each.', true);
  busy = true;
  render();
  try {
    const r = await api<AnswerResponse>('/api/answer', { n: state.collect.n, answers: draft.answers.map((a) => a.trim()) });
    if (r.ok) {
      draft.answers = ['', '', ''];
      retryAnswer = false;
      say(state.bonusShare > 0 ? `Thanks! +${r.points} points. Your answers can earn a crowd bonus later.` : `Thanks! +${r.points} points.`);
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

async function sendGuess() {
  if (!state?.guess || busy) return;
  if (!state.me.loggedIn) return showLoginPrompt();
  const guess = draft.guess.trim();
  if (guess.length < 2) return say('Type your guess first.', true);
  busy = true;
  render();
  let keepFocus = true;
  try {
    const r = await api<GuessResponse>('/api/guess', { n: state.guess.n, guess });
    if (r.ok) {
      draft.guess = '';
      retryGuess = false;
      keepFocus = !r.done;
      const g = r.guess;
      if (r.done) {
        showBoard = true;
        say(`${r.result.points} points. Here is the board.`);
      } else {
        say(g.mark === 'top' ? `Top answer! +${g.points}` : g.mark === 'board' ? `On the board! +${g.points}` : 'Not on the board. Try again.', g.mark === 'miss');
      }
    } else {
      say(errorText(r.error, 'guess'), true);
    }
  } catch (e) {
    console.error(e);
    say('Network hiccup. Nothing was sent.', true);
  } finally {
    busy = false;
    await refresh(true);
    if (keepFocus) document.querySelector<HTMLInputElement>('[data-g]')?.focus();
  }
}

function errorText(e: string, kind: 'answer' | 'guess'): string {
  const t: Record<string, string> = {
    login: 'Log in to Reddit to play.',
    closed: 'This round has just closed.',
    already: kind === 'answer' ? 'You already answered this one.' : 'You already guessed this round.',
    invalid: kind === 'answer' ? 'Those answers cannot be used. Use 2 to 40 characters, no links or bad words.' : 'That guess cannot be used. Use 2 to 40 characters.',
    need3: 'Give 3 different answers. Links and bad words do not count.',
    same: 'Two of your answers mean the same thing. Give 3 different ones.',
    repeat: 'You already tried that one. No try was used.',
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
    const send = document.getElementById('sendanswer') as HTMLButtonElement | null;
    if (send && state?.me.loggedIn) send.disabled = busy || !answersReady();
  } else if (t.dataset['g'] !== undefined) {
    draft.guess = t.value;
  }
});

document.addEventListener('click', (e) => {
  const el = e.target as HTMLElement;
  const tabBtn = el.closest<HTMLElement>('.tab');
  if (tabBtn) {
    tab = tabBtn.dataset['tab'] as typeof tab;
    return render();
  }
  if (el.closest('#how')) {
    tab = 'how';
    render();
    return $('tabhow').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  const segBtn = el.closest<HTMLElement>('[data-mode]');
  if (segBtn) {
    mode = segBtn.dataset['mode'] as typeof mode;
    return render();
  }
  const dismiss = el.closest<HTMLElement>('[data-dismiss]');
  if (dismiss) {
    notices.splice(Number(dismiss.dataset['dismiss']), 1);
    return renderNotices();
  }
  if (el.closest('#retryguess')) {
    retryGuess = true;
    return render();
  }
  if (el.closest('#retryanswer')) {
    retryAnswer = true;
    return render();
  }
  if (el.closest('#toggleboard')) {
    showBoard = !showBoard;
    return render();
  }
  if (el.closest('#sendanswer')) return void sendAnswers();
  if (el.closest('#sendguess')) return void sendGuess();
  if (el.closest('#copy')) return void copyShare();
});

// Enter moves to the next answer field, and sends from the last one (or sends the single guess).
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const t = e.target as HTMLInputElement;
  if (t.dataset['g'] !== undefined) {
    e.preventDefault();
    return void sendGuess();
  }
  if (t.dataset['a'] === undefined) return;
  e.preventDefault();
  const next = document.querySelector<HTMLInputElement>(`[data-a="${Number(t.dataset['a']) + 1}"]`);
  if (next) next.focus();
  else void sendAnswers();
});

setInterval(() => {
  document.querySelectorAll<HTMLElement>('.cd').forEach((c) => (c.textContent = until(Number(c.dataset['until']))));
}, 30_000);

void refresh(true);
const pollMs = Number(new URLSearchParams(location.search).get('poll')) || 45_000;
setInterval(() => {
  if (!document.hidden && !busy) void refresh();
}, pollMs);
