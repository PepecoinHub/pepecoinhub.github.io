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
  sim.advance(8 * 36e5); await game.act('feed');   // hatched: an egg has no countdown
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
  assert.deepEqual(calls.map(c => c[0]).sort(), ['gry_pepegochi_action', 'gry_pepegochi_adopt', 'gry_pepegochi_letter_read', 'gry_pepegochi_settle', 'gry_pepegochi_state']);
  assert.deepEqual(calls.filter(c => c[1]).map(c => c[1]).sort(), ["{ p_action: kind }", "{ p_name: String(name || '').trim() }"]);
});

test('Decorate: the room picture follows the server room; a conflict re-reads it', async () => {
  const slots = [{ slot_id: 'shelf_a', label: 'Shelf A', allowed_categories: ['small', 'trophy'] },
    { slot_id: 'rug_left', label: 'Rug left', allowed_categories: ['toy', 'small'] }];
  let room = { initialized: false, revision: null, slots, inventory: [], placements: [] }, conflict = false;
  const calls = [];
  const rpc = async (name, args) => {
    calls.push(name);
    if (name === 'gry_pepegochi_state') return { server_now: '2026-11-09T12:00:00.000000+00:00', pet: { status: 'healthy', stage: 'tadpole' } };
    if (name === 'gry_pepegochi_room_state') return room;
    if (name === 'gry_pepegochi_room_initialize') {
      room = { initialized: true, revision: 1, slots,
        inventory: [{ item_instance_id: 'd1', item_id: 'rubber_duck', display_name: 'Rubber duck', category: 'toy' },
                    { item_instance_id: 'm1', item_id: 'moon_rock', display_name: 'Moon Rock', category: 'trophy' }],
        placements: [{ slot_id: 'rug_left', item_instance_id: 'd1' }] };
      return room;
    }
    if (name === 'gry_pepegochi_room_place') {
      if (conflict) { conflict = false; throw new Error('ROOM_REVISION_CONFLICT'); }
      assert.equal(args.p_expected_revision, room.revision);
      room = { ...room, revision: room.revision + 1, placements: [...room.placements, { slot_id: args.p_slot_id, item_instance_id: args.p_item_instance_id }] };
      return room;
    }
    throw new Error('unexpected ' + name);
  };
  const game = new LiveGame({ rpc });
  await game.refresh();
  await game.loadRoom();
  assert.deepEqual(calls, ['gry_pepegochi_state', 'gry_pepegochi_room_state', 'gry_pepegochi_room_initialize'], 'the first visit unpacks the starter room');
  assert.deepEqual(game.placements(), { rug_left: 'rubber_duck' });
  const moon = game.decor().find(x => x.item === 'moon_rock');
  assert.equal(moon.slotLabel, 'In the box');
  assert.deepEqual(moon.fits.map(f => f.id), ['shelf_a'], 'only the places it fits');
  assert.ok(await game.place('m1', 'shelf_a'));
  assert.deepEqual(game.placements(), { rug_left: 'rubber_duck', shelf_a: 'moon_rock' });
  conflict = true;
  assert.equal(await game.place('m1', 'shelf_a'), false);
  assert.match(game.roomError, /another tab/);
});

test('Room-4: a move-out that is not saved yet is written once (gry_pepegochi_settle), then never again', async () => {
  const calls = [];
  let saved = false;
  const pet = () => ({ status: 'departed', departure_saved: saved, name: 'Fren', letter: { variant: saved ? 'took_mug' : 'classic', seen: false },
    days_together: 8, care_days: 1, good_days: 0, departed_at: '2026-11-17T18:00:00+00:00', generation: 1 });
  const rpc = async name => {
    calls.push(name);
    if (name === 'gry_pepegochi_settle') saved = true;
    return { server_now: '2026-11-20T18:00:00+00:00', has_pet: false, can_adopt: false, pet: pet(), history: [], rules: {}, summary: {} };
  };
  const game = new LiveGame({ rpc, clock: () => Date.UTC(2026, 10, 20, 18) });
  await game.refresh();
  assert.deepEqual(calls, ['gry_pepegochi_state', 'gry_pepegochi_settle']);
  assert.equal(game.view().departed.taken, 'mug');
  assert.match(game.view().letter.text, /I took the mug/);
  await game.refresh();
  assert.deepEqual(calls, ['gry_pepegochi_state', 'gry_pepegochi_settle', 'gry_pepegochi_state'], 'once is enough');
  // without the Room-4 SQL the call fails quietly and the classic letter stays
  const old = new LiveGame({ rpc: async n => { if (n === 'gry_pepegochi_settle') throw new Error('Could not find the function'); saved = false; return rpc(n); }, clock: () => Date.UTC(2026, 10, 20, 18) });
  saved = false;
  const r = await old.refresh();
  assert.equal(r.ok, true);
  assert.equal(old.view().departed.taken, 'crt_tv');
});
