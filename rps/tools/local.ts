// Local playground: the real game logic and the real client, with an in-memory store and
// fake Reddit users. No Reddit account needed.
//   npm run local     then open http://localhost:5174/as/alice and /as/bob in two tabs
//   SEED=1 npm run local   starts with some fake fights so the boards are not empty
import express from 'express';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { acceptDuel, ack, getState, openDuel, setTeam, throwMove } from '../src/server/arena.js';
import { normalizeTeam } from '../src/shared/rules.js';
import { FakeKV } from '../test/fake-kv.js';

const kv = new FakeKV();
const settings = {
  dailyLimit: Number(process.env['LIMIT'] ?? 5),
  theme: process.env['THEME'] === 'pepe' ? ('pepe' as const) : ('classic' as const),
  sponsorNote: process.env['NOTE'] ?? '',
  featured: ['pepecoin', 'gaming', 'memes', 'pcmasterrace', 'askreddit', 'dogecoin'],
};

if (process.env['SEED']) {
  const teams = ['gaming', 'memes', 'pcmasterrace', 'askreddit', 'dogecoin', 'pepecoin'];
  const moves = ['r', 'p', 's'] as const;
  const t0 = Date.now() - 3 * 3600_000;
  for (let i = 0; i < 36; i++) {
    const uid = `t2_bot${i}`;
    await setTeam(kv, { uid, team: teams[i % 6]!, display: teams[i % 6]!, now: t0 });
    await throwMove(kv, { uid, move: moves[(i * 5 + (i >> 2)) % 3], now: t0 + i * 60_000, dailyLimit: 5 });
  }
  const o = await openDuel(kv, { uid: 't2_botDuel', name: 'frog_fan', move: 'r', now: Date.now() - 60_000, dailyLimit: 5 });
  await openDuel(kv, { uid: 't2_botDuel2', name: 'night_owl', move: 'p', now: Date.now() - 30_000, dailyLimit: 5 });
  if (o.response.ok) await acceptDuel(kv, { uid: 't2_botDuel3', name: 'lucky_7', id: o.response.id, move: 'p', now: Date.now() - 20_000, dailyLimit: 5 });
}

const app = express();
app.use(express.json());

const user = (req: express.Request) => {
  const m = /(?:^|;\s*)u=([A-Za-z0-9_-]+)/.exec(req.headers.cookie ?? '');
  return m ? { uid: `t2_${m[1]}`, name: m[1]! } : { uid: undefined, name: undefined };
};

app.get('/as/:name', (req, res) => {
  res.setHeader('set-cookie', `u=${req.params['name']!.replace(/[^A-Za-z0-9_-]/g, '')}; Path=/`);
  res.redirect('/?poll=2000');
});
app.get('/api/state', async (req, res) => res.json(await getState(kv, { uid: user(req).uid, now: Date.now(), ...settings })));
app.post('/api/team', async (req, res) => {
  const { uid } = user(req);
  const key = normalizeTeam(req.body?.team);
  if (!uid) return res.json({ ok: false, error: 'login' });
  if (!key) return res.json({ ok: false, error: 'invalid' });
  if (key === 'nsfwtest') return res.json({ ok: false, error: 'nsfw' });
  const r = await setTeam(kv, { uid, team: key, display: key, now: Date.now() });
  return res.json(r.ok ? { ok: true, team: key } : { ok: false, error: r.error });
});
app.post('/api/throw', async (req, res) => res.json((await throwMove(kv, { uid: user(req).uid, move: req.body?.move, now: Date.now(), dailyLimit: settings.dailyLimit })).response));
app.post('/api/duel/open', async (req, res) => {
  const { uid, name } = user(req);
  res.json((await openDuel(kv, { uid, name, move: req.body?.move, now: Date.now(), dailyLimit: settings.dailyLimit })).response);
});
app.post('/api/duel/accept', async (req, res) => {
  const { uid, name } = user(req);
  res.json((await acceptDuel(kv, { uid, name, id: req.body?.id, move: req.body?.move, now: Date.now(), dailyLimit: settings.dailyLimit })).response);
});
app.post('/api/ack', async (req, res) => {
  const { uid } = user(req);
  if (uid) await ack(kv, uid, Date.now());
  res.json({ ok: true });
});
app.post('/api/optin', (_req, res) => res.json({ ok: false, message: 'Notifications only work on Reddit.' }));

// Reddit injects a global `devvit` object into the web view; give the page an empty one.
app.get(['/', '/index.html'], (_req, res) => {
  const html = readFileSync(resolve('dist/client/index.html'), 'utf8').replace('<head>', '<head><script>window.devvit={}</script>');
  res.type('html').send(html);
});
app.use(express.static(resolve('dist/client')));

const port = Number(process.env['PORT'] ?? 5174);
app.listen(port, () => console.log(`Subreddit Wars local: http://localhost:${port}/as/alice  (and /as/bob)`));
