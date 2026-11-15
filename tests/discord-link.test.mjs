// Guest Discord connect: an anonymous session must link, not sign out into a new user.
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { PEP_GRY: {} };
globalThis.location = {
  search: '', href: 'https://pepecoinhub.com/games/?login=1', hostname: 'pepecoinhub.com',
  protocol: 'https:', hash: '', host: 'pepecoinhub.com',
};
globalThis.sessionStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
globalThis.localStorage = globalThis.sessionStorage;

const backend = await import('../docs/games/js/backend.js');

function memory() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

function auth(overrides = {}) {
  const calls = [];
  const sb = {
    auth: {
      async linkIdentity(args) { calls.push(['link', args]); return overrides.link ?? { data: { url: 'https://discord.example/oauth' }, error: null }; },
      async signInWithOAuth(args) { calls.push(['signin', args]); return overrides.signin ?? { data: { url: 'https://discord.example/oauth' }, error: null }; },
      async signOut() { calls.push(['out']); },
      async setSession(args) { calls.push(['refresh', args]); return overrides.refresh ?? { data: { session: null }, error: null }; },
    },
  };
  return { sb, calls };
}

const guest = { id: 'guest-1', is_anonymous: true };
const discordUser = {
  id: 'guest-1', is_anonymous: false,
  identities: [{ provider: 'discord', identity_data: { full_name: 'PepeChad', avatar_url: 'https://cdn.example/a.png' } }],
  app_metadata: { providers: ['discord'] },
  user_metadata: {},
};

test('oauth mode keeps an anonymous guest and still signs in everyone else', () => {
  assert.equal(backend.oauthMode(null), 'signin');
  assert.equal(backend.oauthMode(guest), 'link');
  assert.equal(backend.oauthMode({ id: 'd', is_anonymous: false }), 'switch');
});

test('a linked user counts as Discord from identities or from app_metadata.providers', () => {
  assert.equal(backend.userHasDiscord(guest), false);
  assert.equal(backend.userHasDiscord(discordUser), true);
  assert.equal(backend.userHasDiscord({
    id: 'guest-1', is_anonymous: false, identities: [], app_metadata: { providers: ['discord'] }, user_metadata: { full_name: 'PepeChad' },
  }), true);
  assert.equal(backend.userHasDiscord({ id: 'x', is_anonymous: false, identities: [], app_metadata: { providers: ['email'] } }), false);
});

test('anonymous Connect Discord links and does not sign out', async () => {
  const { sb, calls } = auth();
  const store = memory();
  const out = await backend.startOAuth(sb, { user: guest, access_token: 'a', refresh_token: 'r' }, 'discord', 'https://pepecoinhub.com/games/', store);
  assert.equal(out.linked, true);
  assert.deepEqual(calls.map((c) => c[0]), ['link']);
  assert.equal(calls[0][1].provider, 'discord');
  assert.equal(calls[0][1].options.redirectTo, 'https://pepecoinhub.com/games/');
  assert.equal(store.getItem(backend.LINK_UID_KEY), 'guest-1');
});

test('no session still uses signInWithOAuth and does not sign out', async () => {
  const { sb, calls } = auth();
  const out = await backend.startOAuth(sb, null, 'discord', 'https://pepecoinhub.com/games/', memory());
  assert.equal(out.linked, false);
  assert.deepEqual(calls.map((c) => c[0]), ['signin']);
});

test('an existing Discord session signs out and starts a fresh login', async () => {
  const { sb, calls } = auth();
  await backend.startOAuth(sb, { user: { id: 'discord-9', is_anonymous: false } }, 'discord', 'https://pepecoinhub.com/games/', memory());
  assert.deepEqual(calls.map((c) => c[0]), ['out', 'signin']);
});

test('a failed link falls back to a new login and says the guest points stay behind', async () => {
  const { sb, calls } = auth({ link: { data: null, error: { message: 'Manual linking is disabled' } } });
  const store = memory();
  store.setItem(backend.LINK_UID_KEY, 'guest-1');
  const out = await backend.startOAuth(sb, { user: guest }, 'discord', 'https://pepecoinhub.com/games/', store);
  assert.equal(out.linked, false);
  assert.deepEqual(calls.map((c) => c[0]), ['link', 'out', 'signin']);
  assert.equal(store.getItem(backend.LINK_UID_KEY), null);
  assert.match(store.getItem(backend.OAUTH_NOTE_KEY), /Manual linking is disabled/);
  assert.match(store.getItem(backend.OAUTH_NOTE_KEY), /old guest id/);
});

test('after returning, only the same linked guest adopts rows', async () => {
  const store = memory();
  store.setItem(backend.LINK_UID_KEY, 'guest-1');
  const seen = [];
  const { sb } = auth({ refresh: { data: { session: { user: discordUser, access_token: 'a', refresh_token: 'r' } }, error: null } });
  const out = await backend.finishDiscordLink(sb, { user: guest, access_token: 'a', refresh_token: 'r' }, store, async (fn) => {
    seen.push(fn);
    return { nick: 'PepeChad', plays: 3, claims: 1 };
  });
  assert.equal(out.adopted, true);
  assert.deepEqual(seen, ['gry_adopt_guest_rows']);
  assert.equal(store.getItem(backend.LINK_UID_KEY), null);
  assert.equal(out.session.user.id, 'guest-1');
  assert.equal(out.session.user.is_anonymous, false);
});

test('a different user id after login does not adopt the guest rows', async () => {
  const store = memory();
  store.setItem(backend.LINK_UID_KEY, 'guest-1');
  let called = false;
  const { sb } = auth();
  const out = await backend.finishDiscordLink(sb, { user: { id: 'other', is_anonymous: false }, access_token: 'a', refresh_token: 'r' }, store, async () => { called = true; });
  assert.equal(called, false);
  assert.equal(out.adopted, false);
  assert.equal(store.getItem(backend.LINK_UID_KEY), null);
});

test('a missing adopt function leaves the flag so the next visit can retry', async () => {
  const store = memory();
  store.setItem(backend.LINK_UID_KEY, 'guest-1');
  const { sb } = auth({ refresh: { data: { session: { user: discordUser, access_token: 'a', refresh_token: 'r' } }, error: null } });
  const out = await backend.finishDiscordLink(sb, { user: guest, access_token: 'a', refresh_token: 'r' }, store, async () => {
    throw new Error('Could not find the function public.gry_adopt_guest_rows in the schema cache');
  });
  assert.equal(out.adopted, false);
  assert.equal(out.pending, true);
  assert.equal(store.getItem(backend.LINK_UID_KEY), 'guest-1');
});
