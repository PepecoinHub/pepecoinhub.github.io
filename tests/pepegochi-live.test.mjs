// PEPEGOCHI.EXE live window (docs/games/pepegochi-live.html, js/pepegochi-live*.mjs), played against the browser copy of
// the server rules (pepegochi-model.mjs, kept in parity with the SQL by tests/pepegochi-parity.test.mjs) behind an
// async rpc, the way backend.rpc behaves: a full state, or a thrown Error with the server's message.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LocalPepegochi } from '../docs/games/js/pepegochi-model.mjs';
import { LiveGame, LIVE_COPY } from '../docs/games/js/pepegochi-live-view.mjs';

const file = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const server = () => {
  const sim = new LocalPepegochi();
  const rpc = async (name, args) => { const r = sim.rpc(name, args || {}); if (!r.ok) throw new Error(r.error); return r.value; };
  return { sim, game: new LiveGame({ rpc, clock: () => sim.now / 1000 }) };
};

test('adopt an egg, the first care hatches it, care and needs come from the server', async () => {
  const { sim, game } = server();
  assert.equal(game.view().mode, 'loading');
  await game.refresh();
  assert.equal(game.view().mode, 'adopt');
  const a = await game.adopt('  Fren  ');
  assert.ok(a.ok, a.error);
  let v = game.view();
  assert.equal(v.mode, 'pet');
  assert.equal(v.pet.stage, 'egg');
  assert.match(v.pet.title, /^Fren · egg · day 1$/);
  assert.match(v.pet.statusText, /egg/i);
  sim.advance(8 * 36e5);                                   // needs drop while nobody looks
  const kind = v.pet.actions.find(x => x.enabled)?.kind || 'feed';
  const r = await game.act(kind);
  assert.ok(r.ok, r.error);
  v = game.view();
  assert.equal(v.pet.stage, 'tadpole');
  assert.equal(v.message, LIVE_COPY.hatched);
  // a refused action shows the server's own words and changes nothing
  const again = await game.act(kind);
  assert.equal(again.ok, false);
  assert.equal(game.view().message, again.error);
  assert.equal(game.view().pet.stage, 'tadpole');
});

test('time moves on between responses without asking the server', async () => {
  const { sim, game } = server();
  await game.refresh(); await game.adopt('Fren');
  assert.equal(game.stale, false);
  const before = game.view().pet.deadline;
  sim.advance(6 * 6e4);
  assert.notEqual(game.view().pet.deadline, before, 'the countdown follows the clock');
  assert.equal(game.stale, true, 'after a long break (5 min) the window reads the state again');
  await game.refresh();
  assert.equal(game.stale, false);
});

test('no Discord: the server refuses, the window asks for a Discord log-on', async () => {
  const game = new LiveGame({ rpc: async () => { throw new Error('Discord sign-in required'); } });
  await game.refresh();
  const v = game.view();
  assert.equal(v.mode, 'signin');
  assert.match(v.signin.text, /Discord/);
});

test('the server cannot be reached: a calm message, the frog is not touched', async () => {
  const game = new LiveGame({ rpc: async () => { const e = new Error('offline'); e.offline = true; throw e; } });
  await game.refresh();
  assert.equal(game.view().mode, 'loading');
  assert.equal(game.view().message, LIVE_COPY.offline);
});

test('the live page talks only to the game server, keeps nothing in the browser and has no test tools', () => {
  const html = file('docs/games/pepegochi-live.html');
  const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)[1];
  assert.match(csp, /connect-src 'self' https:\/\/azbwciqfbsdpwubznncg\.supabase\.co wss:\/\/azbwciqfbsdpwubznncg\.supabase\.co;/);
  assert.match(csp, /script-src 'self';/);
  assert.doesNotMatch(html, /Time machine|LOCAL TEST|pgb-reset|pgb-steps/);
  for (const f of ['docs/games/js/pepegochi-live.mjs', 'docs/games/js/pepegochi-live-view.mjs']) {
    const js = file(f);
    assert.doesNotMatch(js, /localStorage|sessionStorage|indexedDB/, f + ' keeps nothing in the browser');
    assert.doesNotMatch(js, /pepegochi-model|LocalPepegochi|advance\(/, f + ' never runs the rules itself');
    assert.doesNotMatch(js, /passport_award|gry_passport/, f + ' never touches stamps (the server bridge does)');
  }
  // the browser sends only a name or one of four action names (games/PEPEGOCHI_API.md)
  const calls = [...file('docs/games/js/pepegochi-live-view.mjs').matchAll(/this\.call\('(\w+)'(?:, (\{[^}]*\}))?\)/g)].map(m => [m[1], m[2] || '']);
  assert.deepEqual(calls.map(c => c[0]).sort(), ['gry_pepegochi_action', 'gry_pepegochi_adopt', 'gry_pepegochi_letter_read', 'gry_pepegochi_state']);
  assert.deepEqual(calls.filter(c => c[1]).map(c => c[1]).sort(), ["{ p_action: kind }", "{ p_name: String(name || '').trim() }"]);
});
