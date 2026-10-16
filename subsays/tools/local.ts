// Local playground: the real game logic and the real client, an in-memory store, fake Reddit
// users, and a clock you can move forward. No Reddit account needed.
//   npm run local       then open http://localhost:5175/as/alice
//   SEED=1 npm run local    starts with bots, one round to guess and one to answer
//   http://localhost:5175/dev/advance?h=24   moves the clock and runs the daily job
//   http://localhost:5175/post/1   views the game as an older post would show it
import express from 'express';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { HOUR } from '../src/shared/time.js';
import { pickQuestion } from '../src/shared/questions.js';
import { dailyTick, finalBoard, getState, markIntroSeen, openRound, setPost, submitAnswers, submitGuess, suggest, usedQuestions } from '../src/server/rounds.js';
import { FakeKV } from '../test/fake-kv.js';

const kv = new FakeKV();
let offset = 0;
const now = () => Date.now() + offset;
const settings = {
  theme: process.env['THEME'] === 'pepe' ? ('pepe' as const) : ('classic' as const),
  sponsorNote: process.env['NOTE'] ?? '',
  category: (process.env['CATEGORY'] ?? 'food') as 'food',
  min: Number(process.env['MIN'] ?? 5),
  hours: Number(process.env['HOURS'] ?? 24),
};
const SUB = process.env['SUB'] ?? 'localsub';

async function startRound(lastFinished?: number) {
  const pick = pickQuestion({ custom: [], category: settings.category, used: await usedQuestions(kv) });
  const n = await openRound(kv, { q: pick.q, now: now(), intervalMs: settings.hours * HOUR, minPlayers: settings.min, cap: 'auto' });
  await setPost(kv, n, `t3_local${n}`);
  if (lastFinished) await finalBoard(kv, lastFinished, now());
  return n;
}

async function bots(n: number, count: number, at: number, pool: string[]) {
  for (let i = 0; i < count; i++) {
    // A skewed crowd: the first answers are much more popular.
    const pick = () => pool[Math.min(pool.length - 1, Math.floor(Math.pow(Math.random(), 2.2) * pool.length))]!;
    const answers = [...new Set([pick(), pick(), pick()])];
    while (answers.length < 3) answers.push(`z${Math.floor(Math.random() * 1e4)}x`); // the game needs 3 different answers
    await submitAnswers(kv, { uid: `t2_bot${n}_${i}`, name: `bot${i}`, n, answers, now: at + i * 1000 });
  }
}

if (process.env['SEED']) {
  const t1 = now() - 26 * HOUR;
  const n1 = await openRound(kv, { q: 'Name a pizza topping.', now: t1, intervalMs: settings.hours * HOUR, minPlayers: settings.min, cap: 'auto' });
  await setPost(kv, n1, `t3_local${n1}`);
  await bots(n1, 60, t1 + 1000, ['Pepperoni', 'Mushrooms', 'Cheese', 'Pineapple', 'Olives', 'Sausage', 'Onions', 'Bacon', 'Peppers', 'Anchovies', 'Spinach']);
  const t2 = now() - 2 * HOUR;
  const n2 = await openRound(kv, { q: 'Name something you grill at a barbecue.', now: t2, intervalMs: settings.hours * HOUR, minPlayers: settings.min, cap: 'auto' });
  await setPost(kv, n2, `t3_local${n2}`);
  await bots(n2, 14, t2 + 1000, ['Burgers', 'Hot dogs', 'Steak', 'Corn', 'Sausages', 'Chicken', 'Ribs', 'Vegetables']);
}

const app = express();
app.use(express.json());
const cookie = (req: express.Request, k: string) => new RegExp(`(?:^|;\\s*)${k}=([A-Za-z0-9_-]+)`).exec(req.headers.cookie ?? '')?.[1];
const user = (req: express.Request) => {
  const u = cookie(req, 'u');
  return u ? { uid: `t2_${u}`, name: u } : { uid: undefined, name: undefined };
};

app.get('/as/:name', (req, res) => {
  res.setHeader('set-cookie', [`u=${req.params['name']!.replace(/[^A-Za-z0-9_-]/g, '')}; Path=/`, 'p=; Path=/; Max-Age=0']);
  res.redirect('/?poll=3000');
});
app.get('/post/:n', (req, res) => {
  res.setHeader('set-cookie', `p=t3_local${Number(req.params['n'])}; Path=/`);
  res.redirect('/?poll=3000');
});
app.get('/dev/advance', async (req, res) => {
  offset += Number(req.query['h'] ?? 24) * HOUR;
  const tick = await dailyTick(kv, now(), settings.hours * HOUR);
  let opened: number | undefined;
  if (tick.due) opened = await startRound(tick.finished[tick.finished.length - 1]);
  res.json({ clock: new Date(now()).toISOString(), finished: tick.finished, opened });
});

app.get('/api/state', async (req, res) => {
  const { uid, name } = user(req);
  res.json(await getState(kv, { uid, name, postId: cookie(req, 'p') ?? `t3_local${await latest()}`, now: now(), sub: SUB, theme: settings.theme, sponsorNote: settings.sponsorNote }));
});
const latest = async () => Number((await kv.hGet('ss:meta', 'count')) ?? 1);
app.get('/api/suggest', async (req, res) => res.json({ suggestions: await suggest(kv, String(req.query['q'] ?? ''), now()) }));
app.post('/api/answer', async (req, res) => {
  const { uid, name } = user(req);
  res.json(await submitAnswers(kv, { uid, name, n: req.body?.n, answers: req.body?.answers, now: now() }));
});
app.post('/api/guess', async (req, res) => {
  const { uid, name } = user(req);
  res.json(await submitGuess(kv, { uid, name, n: req.body?.n, guess: req.body?.guess, now: now(), sub: SUB }));
});
app.post('/api/intro', async (req, res) => {
  const { uid } = user(req);
  if (uid) await markIntroSeen(kv, uid);
  res.json({ ok: true });
});

app.get(['/', '/index.html'], (_req, res) => {
  const html = readFileSync(resolve('dist/client/index.html'), 'utf8').replace('<head>', '<head><script>window.devvit={}</script>');
  res.type('html').send(html);
});
app.use(express.static(resolve('dist/client')));

const port = Number(process.env['PORT'] ?? 5175);
app.listen(port, () => console.log(`Sub Says local: http://localhost:${port}/as/alice   (advance the clock: /dev/advance?h=24)`));
