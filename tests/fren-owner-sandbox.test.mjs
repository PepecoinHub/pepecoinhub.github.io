import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext, Script } from 'node:vm';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const source = read('docs/meme/meme.js');
const catalog = JSON.parse(read('docs/meme/passport-catalog.json'));
const opts = JSON.parse(read('docs/meme/avatar-options.json'));

const start = source.indexOf("  var FREN_LOCAL = 'pondos-fren-preview';");
const end = source.indexOf('  // one read: the server snapshot', start);
assert.ok(start > 0 && end > start, 'preview engine extraction anchors exist');
const engine = source.slice(start, end);

function harness({ owner = true, discord = true } = {}) {
  let session = discord ? { userId: 'owner-123', discord: true } : null;
  const storage = new Map();
  const calls = [];
  const state = { catalog, opts, state: null };
  let renders = 0;
  const ctx = {
    FREN_TEST: true, FREN: true, FREN_BETA: true,
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, val) => storage.set(key, val),
      removeItem: key => storage.delete(key)
    },
    sbSession: () => session,
    rpc: async (name, args) => {
      calls.push({ name, args });
      if (name !== 'gry_letters') throw new Error('A real Passport RPC was called in sandbox mode');
      if (!owner) throw new Error('access denied');
      return { letters: [] }; // the existing owner endpoint verifies account ownership
    },
    whoAmI: () => ({ name: 'QA Owner' }),
    passportMine: () => state,
    passportLoad: async () => {
      state.state = ctx.frenPreview('gry_passport_state', {});
      return state.state;
    },
    apps: { passport: { render: () => { renders++; } } },
    Date, Promise
  };
  createContext(ctx);
  runInContext(engine, ctx);
  return { ctx, calls, storage, state, get renders() { return renders; },
    setSession: x => { session = x; },
    setOwner: x => { owner = x; }
  };
}

test('Meme JS parses and test mode is not persistent or a real passport endpoint', () => {
  assert.doesNotThrow(() => new Script(source));
  assert.match(source, /get\('beta'\) === 'fren-test'/);
  assert.match(source, /return FREN_TEST \|\| localStorage\.getItem\('pondos-fren-beta'\)/);
  assert.match(source, /if \(FREN_TEST\) return frenTestAuthorize\(\)\.then/);
  assert.match(source, /FREN_TEST_LOCAL \+ \(s && s\.discord && s\.userId/);
  assert.match(source, /if \(!FREN_TEST\) \{ try \{ localStorage\.setItem\(k,'1'\)/);
});

test('without real owner authentication, test awards and look saves are rejected', async () => {
  const guest = harness({ discord: false });
  await assert.rejects(guest.ctx.frenRpc('gry_passport_state', {}), /Log on with the owner Discord/);
  assert.equal(guest.calls.length, 0);
  const intruder = harness({ owner: false });
  await assert.rejects(intruder.ctx.frenRpc('gry_passport_avatar_save', {}), /Owner verification failed/);
  await assert.rejects(intruder.ctx.frenTestChange('all', ''), /Owner verification failed/);
  assert.deepEqual([...intruder.storage.keys()], []);
  assert.deepEqual(intruder.calls.map(x => x.name), ['gry_letters', 'gry_letters']);
});

test('owner can simulate avatars from a badge or secret, and persist isolated browser state', async () => {
  const h = harness();
  const k = 'pondos-fren-owner-sandbox-v1:owner-123';
  await h.ctx.frenTestChange('avatar', 'special_nerd');
  assert.ok(h.state.state.secrets.some(x => x.id === 'nerd_alert'));
  await h.ctx.frenTestChange('avatar', 'special_knight');
  assert.ok(h.state.state.achievements.some(x => x.id === 'good_game'));
  await h.ctx.frenTestChange('stamp', 'moonwalker');
  await h.ctx.frenTestChange('secret', 'wrong_frog');
  await h.ctx.frenTestChange('stamp', 'moonwalker'); // one simulated row per award
  assert.equal(h.state.state.achievements.filter(x => x.id === 'moonwalker').length, 1);
  assert.equal(h.state.state.secrets.filter(x => x.id === 'wrong_frog').length, 1);
  await h.ctx.frenTestChange('all', '');
  assert.equal(h.state.state.test_all_unlocked, true);
  const look = { p_bg:'bg_sky', p_clothing:'clothing_blue', p_mouth:'mouth_flat',
    p_eyes:'eyes_sleepy', p_hat:'hat_none', p_accessory:'accessory_none', p_special:'special_nerd' };
  const saved = await h.ctx.frenRpc('gry_passport_avatar_save', look);
  assert.equal(saved.badge.id, 'first_avatar');
  assert.equal((await h.ctx.frenRpc('gry_passport_state', {})).avatar.special, 'special_nerd');
  assert.ok(h.storage.has(k));
  assert.ok(!h.storage.has('pondos-fren-preview'));
  assert.ok(h.calls.every(x => x.name === 'gry_letters'), 'no writes to production Passport');
  assert.ok(h.renders >= 5);
});

test('real secret actions in sandbox are idempotent and never set production suppression keys', async () => {
  const h = harness();
  const first = await h.ctx.frenRpc('gry_passport_discover', { p_secret:'find_fren' });
  const again = await h.ctx.frenRpc('gry_passport_discover', { p_secret:'find_fren' });
  assert.equal(first.new, true);
  assert.equal(again.new, false);
  assert.equal(h.ctx.frenPreview('gry_passport_state', {}).secrets.length, 1);
  assert.ok([...h.storage.keys()].every(x => x.startsWith('pondos-fren-owner-sandbox-v1:')));
  assert.match(source, /if \(!FREN_TEST\) \{/);
});

test('reset touches only sandbox key, not normal beta or real discovery markers', async () => {
  const h = harness();
  h.storage.set('pondos-fren-preview', '{"avatar":"old beta"}');
  h.storage.set('pondos-passport-secret-v1:owner-123:find_fren', '1');
  await h.ctx.frenTestChange('avatar', 'special_vampire');
  await h.ctx.frenTestChange('reset', '');
  assert.equal(h.state.state.secrets.length, 0);
  assert.equal(h.state.state.achievements.length, 0);
  assert.equal(h.state.state.avatar, null);
  assert.equal(h.storage.get('pondos-fren-preview'), '{"avatar":"old beta"}');
  assert.equal(h.storage.get('pondos-passport-secret-v1:owner-123:find_fren'), '1');
  assert.ok(h.calls.every(x => x.name === 'gry_letters'));
});

test('the owner gate is checked again after switching accounts or logging out', async () => {
  const h = harness();
  await h.ctx.frenTestChange('avatar', 'special_nerd');
  h.setSession({ userId: 'other-user', discord: true });
  h.setOwner(false);
  await assert.rejects(h.ctx.frenTestChange('all', ''), /Owner verification failed/);
  assert.ok(h.storage.has('pondos-fren-owner-sandbox-v1:owner-123'));
  assert.ok(!h.storage.has('pondos-fren-owner-sandbox-v1:other-user'));
  h.setSession(null);
  await assert.rejects(h.ctx.frenTestChange('reset', ''), /Log on with the owner Discord/);
});

test('QA unlock control is visible in the Maker, not only the Passport window', () => {
  const maker = source.split('function avatarMaker() {')[1].split('// Only cosmetic, low-stakes discoveries')[0];
  assert.ok(maker, 'Maker source is available');
  assert.match(maker, /if \(FREN_TEST && d && d\.preview\)/);
  assert.match(maker, /OWNER SANDBOX · Local test only/);
  assert.match(maker, /Unlock all \(test only\)/);
  assert.match(maker, /frenTestChange\('all', ''\)\.then/);
  assert.match(maker, /A\.close\(\);\s*avatarMaker\(\);/);
  assert.match(maker, /Saved locally in owner sandbox \(not a real reward\)/);
  assert.ok(!maker.includes("localStorage.setItem('pondos-passport-secret-v1:"));
});

test('the home page busts stale JS and the maker reloads fresh approved V3 CSS', () => {
  const home = read('docs/meme/index.html');
  assert.match(home, /<script src="meme\.js\?v=20261112boot"><\/script>/);
  assert.match(source, /passport\.css\?v=20261112big/);
});
