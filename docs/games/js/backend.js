// Wymienny „transport”: lokalny emulator (localhost) albo Supabase (produkcja). Reszta kodu nie wie, który działa.
const cfg = window.PEP_GRY || {};
const qs = new URLSearchParams(location.search);
const configured = !!(cfg.supabaseUrl && cfg.supabaseKey);
export const TEST_BUILD = !!cfg.testBuild;
export const DISCORD_ENABLED = cfg.discord !== false && !(TEST_BUILD && cfg.discord !== true);
export const REDDIT_ENABLED = cfg.reddit === true;
export const MODE = (cfg.backend === 'supabase' || qs.get('backend') === 'supabase') && configured ? 'supabase'
  : cfg.backend === 'local' || qs.get('backend') === 'local' || ['localhost', '127.0.0.1'].includes(location.hostname) ? 'local'
  : configured ? 'supabase' : 'none';

// Network failures (server down, no internet, blocked) come back as "TypeError: Failed to fetch" and similar.
// They are turned into one plain message; err.offline lets the page show the "Pepe can't find the server" note.
export const OFFLINE_MSG = 'The game server can\'t be reached right now. Check your internet connection and try again in a minute.';
const NET_RE = /failed to fetch|networkerror|load failed|network request failed|fetch failed|err_network|timed? ?out/i;
export function friendlyError(e) {
  const m = (e && (e.message || e.error_description)) || String(e || '');
  if (!NET_RE.test(m)) return e instanceof Error ? e : new Error(m);
  const x = new Error(OFFLINE_MSG); x.offline = true; return x;
}

// How a Discord button should talk to Supabase.
// 'link' keeps an anonymous guest's user id (Pepe Guesser plays are keyed by it).
// 'signin' is a visitor with no session. 'switch' is someone already signed in with Discord.
export function oauthMode(user) {
  if (!user) return 'signin';
  if (user.is_anonymous) return 'link';
  return 'switch';
}

// A linked guest is Discord once is_anonymous is false and either identities or app_metadata.providers says discord.
// The Discord username and avatar live on identities[].identity_data; user_metadata is only a fallback.
export function userHasDiscord(user) {
  if (!user || user.is_anonymous) return false;
  const ids = user.identities || [];
  if (ids.some((i) => i && i.provider === 'discord')) return true;
  const providers = user.app_metadata && user.app_metadata.providers;
  return Array.isArray(providers) && providers.includes('discord');
}

export const LINK_UID_KEY = 'pepgry-link-uid';
export const OAUTH_NOTE_KEY = 'pepgry-oauth-note';

export function linkFailureMessage(err) {
  const why = (err && (err.message || err.error_description)) || String(err || 'unknown error');
  return 'Could not attach Discord to this guest (' + why + '). Signing in with Discord as a separate account instead. Points on this guest stay on the old guest id.';
}

function storageGet(storage, key) {
  try { return storage.getItem(key); } catch { return null; }
}
function storageSet(storage, key, value) {
  try { storage.setItem(key, value); } catch { /* private mode or a full store */ }
}
function storageDel(storage, key) {
  try { storage.removeItem(key); } catch { /* ignore */ }
}

// Anonymous guests link Discord onto the same user. Anyone else uses a normal Discord login.
// If linking is refused (manual linking off, or that Discord account is already on another user),
// fall back to sign-out plus a new login so the button still works.
export async function startOAuth(sb, sess, provider, redirectTo, storage) {
  const user = sess && sess.user;
  if (oauthMode(user) === 'link') {
    storageSet(storage, LINK_UID_KEY, user.id);
    let res;
    try {
      res = await sb.auth.linkIdentity({ provider, options: { redirectTo } });
    } catch (e) {
      return freshOAuth(sb, sess, provider, redirectTo, storage, e);
    }
    if (res && res.error) return freshOAuth(sb, sess, provider, redirectTo, storage, res.error);
    return { linked: true };
  }
  return freshOAuth(sb, sess, provider, redirectTo, storage, null);
}

async function freshOAuth(sb, sess, provider, redirectTo, storage, linkErr) {
  storageDel(storage, LINK_UID_KEY);
  let note = null;
  if (linkErr) {
    note = linkFailureMessage(linkErr);
    console.warn('[pep]', note);
    storageSet(storage, OAUTH_NOTE_KEY, note);
  }
  if (sess) await sb.auth.signOut();
  let res;
  try {
    res = await sb.auth.signInWithOAuth({ provider, options: { redirectTo } });
  } catch (e) {
    const err = friendlyError(e);
    if (note) err.message = note + ' ' + err.message;
    throw err;
  }
  if (res.error) {
    const err = friendlyError(res.error);
    if (note) err.message = note + ' ' + err.message;
    throw err;
  }
  return { linked: false, note };
}

// After the browser comes back from Discord: refresh the user (identities, is_anonymous) and,
// only when this same guest id now has Discord, ask the server to mark that user's old rows verified.
export async function finishDiscordLink(sb, sess, storage, rpc) {
  const uid = storageGet(storage, LINK_UID_KEY);
  if (!uid || !sess || !sess.user) return { adopted: false, session: sess };
  if (sess.user.id !== uid) {
    storageDel(storage, LINK_UID_KEY);
    return { adopted: false, session: sess };
  }
  let session = sess;
  let refreshed = false;
  try {
    const { data, error } = await sb.auth.setSession({
      access_token: sess.access_token,
      refresh_token: sess.refresh_token,
    });
    if (!error && data && data.session && data.session.user) {
      session = data.session;
      refreshed = true;
    }
  } catch (e) {
    console.warn('[pep] Could not refresh the session after Discord linking', e);
  }
  if (!userHasDiscord(session.user)) {
    if (refreshed) storageDel(storage, LINK_UID_KEY);
    return { adopted: false, session };
  }
  try {
    const result = await rpc('gry_adopt_guest_rows');
    storageDel(storage, LINK_UID_KEY);
    console.info('[pep] Guest Pepe Guesser rows now count as Discord', result);
    return { adopted: true, session, result };
  } catch (e) {
    const msg = (e && e.message) || String(e || '');
    console.warn('[pep] Guest Pepe Guesser rows were not marked as Discord yet. Run games/supabase/update_adopt_guest_rows.sql in the Supabase SQL editor.', msg);
    if (!/function|schema cache|PGRST202|does not exist/i.test(msg)) storageDel(storage, LINK_UID_KEY);
    return { adopted: false, session, pending: true };
  }
}

// The fallback note is shown here, except on the PondOS hand-off (login=1&back=) which shows it after returning.
export function showStoredOAuthNote() {
  const note = storageGet(sessionStorage, OAUTH_NOTE_KEY);
  if (!note || typeof document === 'undefined') return;
  const q = new URLSearchParams(location.search);
  if (q.get('login') === '1' && q.get('back')) return;
  storageDel(sessionStorage, OAUTH_NOTE_KEY);
  console.warn('[pep]', note);
  const paint = () => {
    if (!document.body || document.getElementById('pep-oauth-note')) return;
    const p = document.createElement('p');
    p.id = 'pep-oauth-note';
    p.setAttribute('role', 'status');
    p.textContent = note;
    p.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:99999;margin:0;background:#3a2218;color:#fff8ee;padding:12px 14px;border:2px solid #111;font:14px/1.4 Ubuntu,system-ui,sans-serif';
    document.body.append(p);
  };
  if (document.body) paint();
  else document.addEventListener('DOMContentLoaded', paint);
}

let instance;
export async function getBackend() {
  if (instance) return instance;
  if (MODE === 'local') instance = new LocalBackend();
  else if (MODE === 'supabase') { instance = new SupaBackend(); await instance.init(); }
  else instance = new NoBackend();
  return instance;
}

class NoBackend {
  kind = 'none';
  session() { return null; }
  async rpc() { throw new Error('The games are not connected to a server yet.'); }
  async guest() { return this.rpc(); }
  async discord() { return this.rpc(); }
  async logout() {}
  channel() { return { send() {}, close() {} }; }
}

class LocalBackend {
  kind = 'local';
  constructor() {
    this.token = localStorage.getItem('pepgry-local-token');
    this.user = JSON.parse(localStorage.getItem('pepgry-local-user') || 'null');
    this.chans = new Map(); this.queue = []; this.ws = null;
  }
  session() { return this.token ? { user: this.user } : null; }
  _set(r) {
    this.token = r.token; this.user = r.user;
    localStorage.setItem('pepgry-local-token', r.token); localStorage.setItem('pepgry-local-user', JSON.stringify(r.user));
    if (this.ws) this.ws.close();
  }
  async guest() { this._set(await (await fetch('/__local/auth/guest', { method: 'POST' })).json()); }
  // W emulatorze „Discord” to formularz testowy (nazwa + ID). W Supabase jest prawdziwe logowanie OAuth.
  async discord({ name, discord_id } = {}) {
    this._set(await (await fetch('/__local/auth/discord', { method: 'POST', body: JSON.stringify({ name, discord_id }) })).json());
  }
  async logout() {
    this.token = null; this.user = null;
    localStorage.removeItem('pepgry-local-token'); localStorage.removeItem('pepgry-local-user');
  }
  async rpc(fn, args = {}) {
    const r = await fetch('/__local/rpc', { method: 'POST', headers: this.token ? { authorization: 'Bearer ' + this.token } : {},
      body: JSON.stringify({ fn, args }) });
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    return j.data;
  }
  _ws() {
    if (this.ws && this.ws.readyState <= 1) return this.ws;
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/__local/rt`);
    this.ws = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ op: 'auth', token: this.token }));
      for (const t of this.chans.keys()) ws.send(JSON.stringify({ op: 'join', topic: t }));
      for (const m of this.queue.splice(0)) ws.send(m);
    };
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.op === 'bcast') this.chans.get(m.topic)?.forEach((cb) => cb(m.event, m.payload));
      else if (m.op === 'joined') this.joins?.get(m.topic)?.forEach((cb) => cb());
      else if (m.op === 'join_error' || m.op === 'send_error') console.warn('[rt]', m.topic, m.error);
    };
    ws.onclose = () => { if (this.chans.size) setTimeout(() => this._ws(), 1000); };
    return ws;
  }
  _out(obj) { const s = JSON.stringify(obj); const ws = this._ws(); ws.readyState === 1 ? ws.send(s) : this.queue.push(s); }
  // onJoin (opcjonalnie): wołane po każdym (ponownym) dołączeniu do kanału — wtedy klient dociąga stan, nic nie ginie
  channel(topic, onMsg, onJoin) {
    const fresh = !this.chans.has(topic);
    if (fresh) this.chans.set(topic, new Set());
    this.chans.get(topic).add(onMsg);
    if (onJoin) { this.joins ??= new Map(); if (!this.joins.has(topic)) this.joins.set(topic, new Set()); this.joins.get(topic).add(onJoin); }
    const ws = this._ws();
    if (fresh && ws.readyState === 1) ws.send(JSON.stringify({ op: 'join', topic }));
    return {
      send: (event, payload) => this._out({ op: 'send', topic, event, payload }),
      close: () => {
        const s = this.chans.get(topic); s?.delete(onMsg); if (onJoin) this.joins?.get(topic)?.delete(onJoin);
        if (s && !s.size) { this.chans.delete(topic); this._out({ op: 'leave', topic }); }
      },
    };
  }
}

class SupaBackend {
  kind = 'supabase';
  async init() {
    if (!window.supabase) await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = new URL('../vendor/supabase-2.117.3.js', import.meta.url).href; s.onload = res; s.onerror = rej;
      document.head.append(s);
    });
    this.sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    });
    const { data } = await this.sb.auth.getSession();
    this.sess = data.session;
    this.sb.auth.onAuthStateChange((_e, s) => { this.sess = s; if (s) this.sb.realtime.setAuth(s.access_token); });
    // A linked guest is no longer anonymous and has a discord identity. gry_me() then reports verified
    // from games.discord_identity (auth.identities), the same check as a fresh Discord login.
    const done = await finishDiscordLink(this.sb, this.sess, sessionStorage, (fn, args) => this.rpc(fn, args));
    if (done.session) this.sess = done.session;
    showStoredOAuthNote();
  }
  session() { return this.sess ? { user: { id: this.sess.user.id, is_anonymous: !!this.sess.user.is_anonymous } } : null; }
  async guest() {
    const captchaToken = cfg.turnstileSiteKey ? await (await import('./human.js')).humanToken(cfg.turnstileSiteKey) : undefined;
    let res;
    try { res = await this.sb.auth.signInAnonymously(captchaToken ? { options: { captchaToken } } : undefined); } catch (e) { throw friendlyError(e); }
    const { data, error } = res;
    if (error) throw friendlyError(error);
    this.sess = data.session;
  }
  async discord() { return this.oauth('discord'); }
  async reddit() { return this.oauth('reddit'); }
  async oauth(provider) {
    await startOAuth(this.sb, this.sess, provider, location.href.split('#')[0], sessionStorage);
  }
  async logout() { await this.sb.auth.signOut(); this.sess = null; }
  async rpc(fn, args = {}) {
    let res;   // the rpc builder is a thenable without .catch(), so a plain try/await
    try { res = await this.sb.rpc(fn, args); } catch (e) { throw friendlyError(e); }
    if (res.error) throw friendlyError(res.error);
    return res.data;
  }
  channel(topic, onMsg, onJoin, onState) {
    const ch = this.sb.channel(topic, { config: { private: true, broadcast: { self: false } } });
    ch.on('broadcast', { event: '*' }, (m) => onMsg(m.event, m.payload));
    (async () => {
      await this.sb.realtime.setAuth();
      ch.subscribe((status, err) => { if (status === 'CHANNEL_ERROR') console.warn('[rt]', topic, err); if (status === 'SUBSCRIBED') onJoin?.(); onState?.(status); });
    })();
    return { send: (event, payload) => ch.send({ type: 'broadcast', event, payload }), close: () => this.sb.removeChannel(ch) };
  }
}
