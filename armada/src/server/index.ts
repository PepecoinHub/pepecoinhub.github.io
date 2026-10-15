import express from 'express';
import { context, createServer, getServerPort, realtime, reddit, redis, settings } from '@devvit/web/server';
import type { FireRequest, FireResponse, GameState, LiveMsg } from '../shared/api.js';
import { liveChannel } from '../shared/api.js';
import { type KV, ensureGame, fire, getState } from './armada.js';

const kv: KV = redis;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text());

// ---------- settings ----------

// Select settings come back as string[] in some SDK versions and string in others.
function first(v: unknown, fallback: string): string {
  if (Array.isArray(v)) return typeof v[0] === 'string' ? v[0] : fallback;
  return typeof v === 'string' && v ? v : fallback;
}

async function readSettings() {
  const [autoPost, theme, boardSize, sponsorNote, minAccountDays] = await Promise.all([
    settings.get<boolean>('autoPost'),
    settings.get('theme'),
    settings.get('boardSize'),
    settings.get<string>('sponsorNote'),
    settings.get<number>('minAccountDays'),
  ]);
  const size = Number(first(boardSize, 'auto'));
  return {
    autoPost: autoPost !== false,
    theme: first(theme, 'classic') === 'pepe' ? ('pepe' as const) : ('classic' as const),
    sizeOverride: Number.isFinite(size) && size > 0 ? size : undefined,
    sponsorNote: (sponsorNote ?? '').slice(0, 280),
    minAccountDays: Math.max(0, Number(minAccountDays ?? 0) || 0),
  };
}

// ---------- posts ----------

async function createGamePost() {
  const s = await readSettings();
  const subreddit = context.subredditName;
  const info = await reddit.getSubredditInfoByName(subreddit);
  const subscribers = info.subscribersCount ?? 0;
  const n = await redis.incrBy('gameCount', 1);
  const title =
    s.theme === 'pepe'
      ? `🐸 Armada #${n}: a hidden frog fleet. One shot each. Can r/${subreddit} sink it together?`
      : `🚢 Armada #${n}: a hidden fleet. One shot each. Can r/${subreddit} sink it together?`;
  const post = await reddit.submitCustomPost({
    subredditName: subreddit,
    title,
    textFallback: { text: 'Armada is a community game. Open this post in the Reddit app or on new Reddit to play.' },
  });
  await ensureGame(kv, post.id, { subscribers, sizeOverride: s.sizeOverride });
  return post;
}

// ---------- public API (called by the web view) ----------

async function me() {
  const uid = context.userId;
  const name = context.username ?? (uid ? await reddit.getCurrentUsername() : undefined);
  return { uid, name };
}

app.get<object, GameState | { error: string }>('/api/state', async (_req, res) => {
  const postId = context.postId;
  if (!postId) return res.status(400).json({ error: 'no post' });
  try {
    const [{ uid, name }, s] = await Promise.all([me(), readSettings()]);
    // Posts made by older installs (or by hand) get a fleet on first view.
    const info = await reddit.getSubredditInfoByName(context.subredditName);
    await ensureGame(kv, postId, { subscribers: info.subscribersCount ?? 0, sizeOverride: s.sizeOverride });
    const state = await getState(kv, postId, {
      uid,
      name,
      now: Date.now(),
      theme: s.theme,
      sponsorNote: s.sponsorNote,
      subreddit: context.subredditName,
    });
    if (!state) return res.status(404).json({ error: 'no game' });
    return res.json(state);
  } catch (e) {
    console.error('state failed', e);
    return res.status(500).json({ error: 'state failed' });
  }
});

app.post<object, FireResponse | { error: string }, FireRequest>('/api/fire', async (req, res) => {
  const postId = context.postId;
  if (!postId) return res.status(400).json({ error: 'no post' });
  try {
    const { uid, name } = await me();
    const s = await readSettings();
    if (uid && s.minAccountDays > 0 && !(await accountOldEnough(uid, s.minAccountDays))) {
      // Shown as a normal refusal so the client needs no special case.
      return res.json({ ok: false, error: 'login' });
    }
    const outcome = await fire(kv, { postId, uid, name, cell: Number(req.body?.cell), now: Date.now() });
    const r = outcome.response;
    if (r.ok && name) {
      const total = Number((await redis.hGet(`a:${postId}:meta`, 'shots')) ?? 0);
      await broadcast(postId, { t: 'shot', cell: r.cell, result: r.result, by: name, sunk: r.sunk, totalShots: total });
      if (outcome.finish) {
        await broadcast(postId, { t: 'win', by: name, shots: outcome.finish.shots, players: outcome.finish.players });
        await announceWin(postId, s.theme);
      }
    }
    return res.json(r);
  } catch (e) {
    console.error('fire failed', e);
    return res.status(500).json({ error: 'fire failed' });
  }
});

async function broadcast(postId: string, msg: LiveMsg) {
  try {
    await realtime.send(liveChannel(postId), msg);
  } catch (e) {
    console.error('realtime send failed', e); // never fail a shot because of the live feed
  }
}

async function accountOldEnough(uid: `t2_${string}`, days: number): Promise<boolean> {
  const key = `acct:${uid}:${days}`;
  const cached = await redis.get(key);
  if (cached) return cached === '1';
  const user = await reddit.getUserById(uid);
  const ok = !!user && Date.now() - user.createdAt.getTime() >= days * 86_400_000;
  await redis.set(key, ok ? '1' : '0', { expiration: new Date(Date.now() + (ok ? 7 : 1) * 86_400_000) });
  return ok;
}

async function announceWin(postId: string, theme: 'classic' | 'pepe') {
  try {
    const s = await readSettings();
    const state = await getState(kv, postId, {
      now: Date.now(),
      theme,
      sponsorNote: s.sponsorNote,
      subreddit: context.subredditName,
    });
    if (!state?.finish) return;
    const board = state.leaders.map((l, i) => `${i + 1}. u/${l.name}: ${l.score} pts`).join('\n');
    const text = [
      theme === 'pepe' ? '**🐸 The whole fleet is sunk!**' : '**🚢 The whole fleet is sunk!**',
      '',
      `r/${context.subredditName} did it in **${state.finish.shots} shots** with **${state.finish.players} players**. The final blow came from u/${state.finish.finisher}.`,
      '',
      '**Top captains**',
      board,
      '',
      'A new game starts soon. Turn on notifications for this community so you do not miss it.',
    ].join('\n');
    await reddit.submitComment({ id: postId as `t3_${string}`, text });
  } catch (e) {
    console.error('win comment failed', e);
  }
}

// ---------- internal endpoints (menu, triggers, scheduler) ----------

app.post('/internal/menu/new-game', async (_req, res) => {
  try {
    const post = await createGamePost();
    res.json({ navigateTo: post.url, showToast: { text: 'New Armada game is live', appearance: 'success' } });
  } catch (e) {
    console.error('menu new-game failed', e);
    res.json({ showToast: 'Could not create the game. Check the app logs.' });
  }
});

app.post('/internal/on-app-install', async (_req, res) => {
  try {
    await createGamePost();
  } catch (e) {
    console.error('install post failed', e);
  }
  res.json({});
});

app.post('/internal/cron/daily', async (_req, res) => {
  try {
    if ((await readSettings()).autoPost) await createGamePost();
  } catch (e) {
    console.error('daily post failed', e);
  }
  res.json({});
});

const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(getServerPort());
