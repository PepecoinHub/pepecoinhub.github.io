// Local playground: the real game logic and the real client, with an in-memory store and
// fake Reddit users. No Reddit account needed.
//   npm run local          then open http://localhost:5173/as/alice and /as/bob in two tabs
//   add ?poll=2000 to a tab so it refreshes every 2 s (there is no realtime push locally)
import express from 'express';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ensureGame, fire, getState } from '../src/server/armada.js';
import { FakeKV } from '../test/fake-kv.js';

const POST = 't3_local';
const subscribers = Number(process.env['SUBS'] ?? 300);
const kv = new FakeKV();
await ensureGame(kv, POST, { subscribers });

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
app.get('/api/state', async (req, res) => {
  const { uid, name } = user(req);
  res.json(await getState(kv, POST, { uid, name, now: Date.now(), theme: process.env['THEME'] === 'pepe' ? 'pepe' : 'classic', sponsorNote: process.env['NOTE'] ?? '', subreddit: 'localsub' }));
});
app.post('/api/fire', async (req, res) => {
  const { uid, name } = user(req);
  res.json((await fire(kv, { postId: POST, uid, name, cell: Number(req.body?.cell), now: Date.now() })).response);
});
// Reddit injects a global `devvit` object into the web view; give the page an empty one.
app.get(['/', '/index.html'], (_req, res) => {
  const html = readFileSync(resolve('dist/client/index.html'), 'utf8').replace('<head>', '<head><script>window.devvit={}</script>');
  res.type('html').send(html);
});
app.use(express.static(resolve('dist/client')));

const port = Number(process.env['PORT'] ?? 5173);
app.listen(port, () => console.log(`Armada local: http://localhost:${port}/as/alice  (and /as/bob)`));
