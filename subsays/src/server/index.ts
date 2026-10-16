import express from 'express';
import { context, createServer, getServerPort, reddit, redis, settings } from '@devvit/web/server';
import type { AnswerResponse, GuessResponse, State, SuggestResponse } from '../shared/api.js';
import { type Category, CATEGORIES, pickQuestion } from '../shared/questions.js';
import { HOUR, weekKey } from '../shared/time.js';
import {
  type BoardCap,
  type KV,
  dailyTick,
  finalBoard,
  getState,
  hideAnswer,
  lastOpenAt,
  latestPostId,
  loadRound,
  markIntroSeen,
  openRound,
  setPost,
  submitAnswers,
  submitGuess,
  suggest,
  usedQuestions,
  weeklyTop,
} from './rounds.js';

const kv: KV = redis;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text());

// ---------- settings ----------

function first(v: unknown, fallback: string): string {
  if (Array.isArray(v)) return typeof v[0] === 'string' ? v[0] : fallback;
  return typeof v === 'string' && v ? v : fallback;
}

async function readSettings() {
  const [autoPost, category, roundHours, minPlayers, boardSize, custom, theme, note] = await Promise.all([
    settings.get<boolean>('autoPost'),
    settings.get('category'),
    settings.get('roundHours'),
    settings.get<number>('minPlayers'),
    settings.get('boardSize'),
    settings.get<string>('customQuestions'),
    settings.get('theme'),
    settings.get<string>('sponsorNote'),
  ]);
  const cat = first(category, 'general');
  const hours = Number(first(roundHours, '24'));
  const min = Number(minPlayers);
  const cap = first(boardSize, 'auto');
  return {
    autoPost: autoPost !== false,
    category: ((CATEGORIES as readonly string[]).includes(cat) ? cat : 'general') as Category,
    roundHours: [24, 48, 72].includes(hours) ? hours : 24,
    minPlayers: Number.isFinite(min) && min >= 3 ? Math.min(500, Math.floor(min)) : 20,
    cap: (cap === '5' || cap === '8' ? cap : 'auto') as BoardCap,
    custom: (custom ?? '').split('\n').map((l) => l.trim()).filter((l) => l.length >= 8 && l.length <= 140).slice(0, 200),
    theme: first(theme, 'classic') === 'pepe' ? ('pepe' as const) : ('classic' as const),
    sponsorNote: (note ?? '').slice(0, 280),
  };
}

// ---------- public API (called by the web view) ----------

async function me() {
  const uid = context.userId;
  const name = context.username ?? (uid ? await reddit.getCurrentUsername() : undefined);
  return { uid, name };
}

app.get<object, State | { error: string }>('/api/state', async (_req, res) => {
  try {
    const [{ uid, name }, s] = await Promise.all([me(), readSettings()]);
    res.json(await getState(kv, { uid, name, postId: context.postId, now: Date.now(), sub: context.subredditName, theme: s.theme, sponsorNote: s.sponsorNote }));
  } catch (e) {
    console.error('state failed', e);
    res.status(500).json({ error: 'state failed' });
  }
});

app.get<object, SuggestResponse | { error: string }>('/api/suggest', async (req, res) => {
  try {
    res.json({ suggestions: await suggest(kv, String(req.query['q'] ?? ''), Date.now()) });
  } catch (e) {
    console.error('suggest failed', e);
    res.json({ suggestions: [] });
  }
});

app.post<object, AnswerResponse | { error: string }, { n?: number; answers?: string[] }>('/api/answer', async (req, res) => {
  try {
    const { uid, name } = await me();
    res.json(await submitAnswers(kv, { uid, name, n: req.body?.n, answers: req.body?.answers, now: Date.now() }));
  } catch (e) {
    console.error('answer failed', e);
    res.status(500).json({ error: 'answer failed' });
  }
});

app.post<object, GuessResponse | { error: string }, { n?: number; guess?: string }>('/api/guess', async (req, res) => {
  try {
    const { uid, name } = await me();
    res.json(await submitGuess(kv, { uid, name, n: req.body?.n, guess: req.body?.guess, now: Date.now(), sub: context.subredditName }));
  } catch (e) {
    console.error('guess failed', e);
    res.status(500).json({ error: 'guess failed' });
  }
});

app.post('/api/intro', async (_req, res) => {
  if (context.userId) await markIntroSeen(kv, context.userId);
  res.json({ ok: true });
});

// ---------- posts and comments ----------

const sentence = (q: string) => q.replace(/\.$/, '');

function howToText(n: number, sub: string, last?: { n: number; q: string; board: { text: string; pct: number }[] }) {
  const lines = [
    `**Sub Says #${n}: how to play**`,
    '',
    `1. **Answer today's question** with 3 different answers. It takes 10 seconds.`,
    `2. **Come back tomorrow** and guess what r/${sub} said, one guess at a time. Three tries.`,
    `3. **Score what the crowd scored.** If 41% of people said "sandwiches" and you guessed it, you get 41 points. Answers need at least 3 people to make the board.`,
    '',
    'Weekly standings are posted every Monday. Share your result below: 🟩 top answer, 🟨 on the board, ⬜ miss.',
  ];
  if (last) {
    lines.push('', `**Yesterday's board (#${last.n}): ${sentence(last.q)}**`, '', ...last.board.map((b, i) => `${i + 1}. ${b.text} (${b.pct})`));
  }
  return lines.join('\n');
}

function finalText(n: number, q: string, respondents: number, board: { text: string; pct: number }[]) {
  return [
    `**Sub Says #${n}: final board**`,
    '',
    `*${sentence(q)}* (${respondents} people answered)`,
    '',
    ...board.map((b, i) => `${i + 1}. **${b.text}** (${b.pct})`),
    '',
    'Guessing is closed for this round. Today\'s post has the new question.',
  ].join('\n');
}

async function postComment(postId: string, text: string, sticky: boolean) {
  try {
    const c = await reddit.submitComment({ id: postId as `t3_${string}`, text });
    if (sticky) await c.distinguish(true).catch(() => undefined); // only works if the app is a moderator
  } catch (e) {
    console.error('comment failed', e);
  }
}

async function startRound(lastFinished?: number) {
  const s = await readSettings();
  const now = Date.now();
  const pick = pickQuestion({ custom: s.custom, category: s.category, used: await usedQuestions(kv) });
  const n = await openRound(kv, { q: pick.q, now, intervalMs: s.roundHours * HOUR, minPlayers: s.minPlayers, cap: s.cap });
  const sub = context.subredditName;
  const post = await reddit.submitCustomPost({
    subredditName: sub,
    title: `Sub Says #${n}: ${pick.q} Answer now, guess what r/${sub} said tomorrow.`,
    textFallback: { text: `Sub Says is a daily community game. Open this post in the Reddit app or on new Reddit to play. Today's question: ${pick.q}` },
  });
  await setPost(kv, n, post.id);
  const prev = lastFinished ? await finalBoard(kv, lastFinished, now) : undefined;
  await postComment(post.id, howToText(n, sub, prev && { n: lastFinished!, q: prev.q, board: prev.board }), true);
  return { n, post };
}

async function announceFinished(ns: number[]) {
  const now = Date.now();
  for (const n of ns) {
    const r = await loadRound(kv, n);
    const fb = await finalBoard(kv, n, now);
    if (r?.postId && fb) await postComment(r.postId, finalText(n, fb.q, fb.respondents, fb.board), false);
  }
}

// ---------- internal endpoints (menu, forms, install, scheduler) ----------

app.post('/internal/menu/new-round', async (_req, res) => {
  try {
    const opened = await lastOpenAt(kv);
    if (opened && Date.now() - opened < 6 * HOUR) {
      return res.json({ showToast: 'A round started less than 6 hours ago. Give people time to play it.' });
    }
    const { post } = await startRound();
    return res.json({ navigateTo: post.url, showToast: { text: 'New Sub Says round is live', appearance: 'success' } });
  } catch (e) {
    console.error('menu new-round failed', e);
    return res.json({ showToast: 'Could not create the round. Check the app logs.' });
  }
});

app.post('/internal/menu/hide', (_req, res) => {
  res.json({
    showForm: {
      name: 'hideForm',
      form: {
        title: 'Hide an answer',
        description: 'Removes this answer (and its spelling variants) from the running rounds: suggestions, the board and scoring.',
        acceptLabel: 'Hide',
        fields: [{ type: 'string', name: 'text', label: 'Answer to hide', required: true }],
      },
    },
  });
});

app.post<object, object, { text?: string; values?: { text?: string } }>('/internal/form/hide', async (req, res) => {
  try {
    const text = req.body?.text ?? req.body?.values?.text ?? '';
    const r = await hideAnswer(kv, String(text), Date.now());
    res.json({ showToast: r.ok ? `Hidden in ${r.hidden} round(s).` : 'No running round has that answer.' });
  } catch (e) {
    console.error('hide failed', e);
    res.json({ showToast: 'Could not hide that answer.' });
  }
});

app.post('/internal/on-app-install', async (_req, res) => {
  try {
    await startRound();
  } catch (e) {
    console.error('install round failed', e);
  }
  res.json({});
});

// 15:00 UTC every day: announce rounds that just ended, open the next one when it is due.
app.post('/internal/cron/daily', async (_req, res) => {
  try {
    const s = await readSettings();
    const tick = await dailyTick(kv, Date.now(), s.roundHours * HOUR);
    await announceFinished(tick.finished);
    if (tick.due && s.autoPost) await startRound(tick.finished[tick.finished.length - 1]);
  } catch (e) {
    console.error('daily failed', e);
  }
  res.json({});
});

// Monday 00:05 UTC: last week's podium under the newest post.
app.post('/internal/cron/weekly-recap', async (_req, res) => {
  try {
    const postId = await latestPostId(kv);
    const week = weekKey(Date.now() - HOUR); // an hour ago is still the week that just ended
    const top = await weeklyTop(kv, week, 5);
    if (postId && top.length) {
      const medals = ['🥇', '🥈', '🥉', '4.', '5.'];
      const text = [`**Sub Says, week ${week}: final standings**`, '', ...top.map((t, i) => `${medals[i]} **u/${t.name}**: ${t.points} pts`), '', 'A new week starts now. Everybody is at zero again. Good luck!'].join('\n');
      await postComment(postId, text, false);
    }
  } catch (e) {
    console.error('recap failed', e);
  }
  res.json({});
});

const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(getServerPort());
