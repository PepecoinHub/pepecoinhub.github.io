import express from 'express';
import { context, createServer, getServerPort, notifications, realtime, reddit, redis, settings } from '@devvit/web/server';
import { type DuelAcceptResponse, type DuelOpenResponse, LIVE_CHANNEL, type LiveMsg, type State, type TeamResponse, type ThrowResponse } from '../shared/api.js';
import { normalizeTeam, seasonKey } from '../shared/rules.js';
import { type KV, ack, acceptDuel, getState, openDuel, setTeam, throwMove, topTeams } from './arena.js';

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
  const [featured, note, daily, theme] = await Promise.all([
    settings.get<string>('featuredTeams'),
    settings.get<string>('sponsorNote'),
    settings.get<number>('dailyThrows'),
    settings.get('theme'),
  ]);
  const teams = (featured ?? 'pepecoin, gaming, memes, pcmasterrace, AskReddit, dogecoin')
    .split(/[,\s]+/)
    .map((t) => normalizeTeam(t))
    .filter((t): t is string => !!t)
    .slice(0, 12);
  const limit = Number(daily);
  return {
    featured: teams,
    sponsorNote: (note ?? '').slice(0, 280),
    dailyLimit: Number.isFinite(limit) && limit >= 1 ? Math.min(50, Math.floor(limit)) : 5,
    theme: first(theme, 'classic') === 'pepe' ? ('pepe' as const) : ('classic' as const),
  };
}

// ---------- team validation (Reddit API, cached) ----------

type TeamCheck = { ok: true; key: string; display: string } | { ok: false; error: 'invalid' | 'notfound' | 'nsfw' };

async function checkTeam(raw: unknown): Promise<TeamCheck> {
  const key = normalizeTeam(raw);
  if (!key) return { ok: false, error: 'invalid' };
  const cached = await redis.hGet('rps:tv', key);
  if (cached) return JSON.parse(cached) as TeamCheck;
  let result: TeamCheck;
  try {
    const info = await reddit.getSubredditInfoByName(key);
    if (info.isNsfw || info.isQuarantined) result = { ok: false, error: 'nsfw' };
    else if (info.type === 'private' || info.type === 'user') result = { ok: false, error: 'notfound' };
    else result = { ok: true, key, display: info.name ?? key };
  } catch {
    result = { ok: false, error: 'notfound' };
  }
  await redis.hSet('rps:tv', { [key]: JSON.stringify(result) });
  return result;
}

// ---------- public API ----------

app.get<object, State | { error: string }>('/api/state', async (_req, res) => {
  try {
    const s = await readSettings();
    res.json(await getState(kv, { uid: context.userId, now: Date.now(), ...s }));
  } catch (e) {
    console.error('state failed', e);
    res.status(500).json({ error: 'state failed' });
  }
});

app.post<object, TeamResponse | { error: string }, { team?: string }>('/api/team', async (req, res) => {
  try {
    const uid = context.userId;
    if (!uid) return res.json({ ok: false, error: 'login' });
    const check = await checkTeam(req.body?.team);
    if (!check.ok) return res.json({ ok: false, error: check.error });
    const r = await setTeam(kv, { uid, team: check.key, display: check.display, now: Date.now() });
    return res.json(r.ok ? { ok: true, team: check.display } : { ok: false, error: r.error });
  } catch (e) {
    console.error('team failed', e);
    return res.status(500).json({ error: 'team failed' });
  }
});

app.post<object, ThrowResponse | { error: string }, { move?: string }>('/api/throw', async (req, res) => {
  try {
    const s = await readSettings();
    const out = await throwMove(kv, { uid: context.userId, move: req.body?.move, now: Date.now(), dailyLimit: s.dailyLimit });
    if (out.tick) await broadcast({ t: 'match', a: out.tick.a, b: out.tick.b, r: out.tick.r, at: out.tick.at });
    if (out.notify) await notifyWaiting(out.notify.uid, out.notify.result, out.notify.oppTeam);
    return res.json(out.response);
  } catch (e) {
    console.error('throw failed', e);
    return res.status(500).json({ error: 'throw failed' });
  }
});

async function me() {
  const uid = context.userId;
  const name = context.username ?? (uid ? await reddit.getCurrentUsername() : undefined);
  return { uid, name };
}

app.post<object, DuelOpenResponse | { error: string }, { move?: string }>('/api/duel/open', async (req, res) => {
  try {
    const [{ uid, name }, s] = await Promise.all([me(), readSettings()]);
    const out = await openDuel(kv, { uid, name, move: req.body?.move, now: Date.now(), dailyLimit: s.dailyLimit });
    return res.json(out.response);
  } catch (e) {
    console.error('duel open failed', e);
    return res.status(500).json({ error: 'duel open failed' });
  }
});

app.post<object, DuelAcceptResponse | { error: string }, { id?: string; move?: string }>('/api/duel/accept', async (req, res) => {
  try {
    const [{ uid, name }, s] = await Promise.all([me(), readSettings()]);
    const out = await acceptDuel(kv, { uid, name, id: req.body?.id, move: req.body?.move, now: Date.now(), dailyLimit: s.dailyLimit });
    if (out.tick) await broadcast({ t: 'match', a: out.tick.a, b: out.tick.b, r: out.tick.r, at: out.tick.at, duel: true });
    if (out.notify) await notifyWaiting(out.notify.uid, out.notify.result, out.notify.oppTeam, true);
    return res.json(out.response);
  } catch (e) {
    console.error('duel accept failed', e);
    return res.status(500).json({ error: 'duel accept failed' });
  }
});

app.post('/api/ack', async (_req, res) => {
  if (context.userId) await ack(kv, context.userId, Date.now());
  res.json({ ok: true });
});

// Push notifications are experimental and opt-in, so every call is allowed to fail quietly.
app.post('/api/optin', async (_req, res) => {
  try {
    const r = await notifications.optInCurrentUser();
    res.json({ ok: r.success, message: r.message ?? '' });
  } catch (e) {
    console.error('opt-in failed', e);
    res.json({ ok: false, message: 'Notifications are not available right now.' });
  }
});

async function broadcast(msg: LiveMsg) {
  try {
    await realtime.send(LIVE_CHANNEL, msg);
  } catch (e) {
    console.error('realtime send failed', e); // never fail a throw because of the live feed
  }
}

async function notifyWaiting(uid: string, result: 'w' | 'l' | 'd', opp: string, duel = false) {
  try {
    const userId = uid as `t2_${string}`;
    if (!context.postId || !(await notifications.isOptedIn(userId))) return;
    const verb = result === 'w' ? 'beat' : result === 'l' ? 'lost to' : 'drew with';
    await notifications.enqueue({
      title: duel ? 'Your duel was accepted' : 'Your throw was settled',
      body: `You ${verb} ${duel ? 'u/' : 'r/'}${opp}. Open the arena to see it.`,
      recipients: [{ userId, link: context.postId, data: {} }],
    });
  } catch (e) {
    console.error('notify failed', e);
  }
}

// ---------- internal endpoints (menu, install, scheduler) ----------

async function createArenaPost() {
  const post = await reddit.submitCustomPost({
    subredditName: context.subredditName,
    title: '✊✋✌️ Subreddit Wars: pick your sub, throw, and fight for it. Which community wins the week?',
    textFallback: { text: 'Subreddit Wars is a community game. Open this post in the Reddit app or on new Reddit to play.' },
  });
  await redis.set('rps:arena', post.id);
  return post;
}

app.post('/internal/menu/new-arena', async (_req, res) => {
  try {
    const post = await createArenaPost();
    res.json({ navigateTo: post.url, showToast: { text: 'Arena is live', appearance: 'success' } });
  } catch (e) {
    console.error('menu new-arena failed', e);
    res.json({ showToast: 'Could not create the post. Check the app logs.' });
  }
});

app.post('/internal/on-app-install', async (_req, res) => {
  try {
    await createArenaPost();
  } catch (e) {
    console.error('install post failed', e);
  }
  res.json({});
});

// Monday 00:05 UTC: announce last week's podium under the arena post.
app.post('/internal/cron/weekly-recap', async (_req, res) => {
  try {
    const arena = await redis.get('rps:arena');
    const last = seasonKey(Date.now() - 3_600_000); // one hour ago still belongs to the week that just ended
    const top = await topTeams(kv, last, 5);
    if (arena && top.length) {
      const medals = ['🥇', '🥈', '🥉', '4.', '5.'];
      const lines = top.map((t, i) => `${medals[i]} **r/${t.name}**: ${t.points} pts (${t.w}W ${t.d}D ${t.l}L, ${t.players} players)`);
      const text = [`**Subreddit Wars, season ${last}: final standings**`, '', ...lines, '', 'A new season starts now. Every point is zero again. Pick your team and throw!'].join('\n');
      await reddit.submitComment({ id: arena as `t3_${string}`, text });
    }
  } catch (e) {
    console.error('recap failed', e);
  }
  res.json({});
});

const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(getServerPort());
