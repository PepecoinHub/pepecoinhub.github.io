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
  }
  session() { return this.sess ? { user: { id: this.sess.user.id, is_anonymous: !!this.sess.user.is_anonymous } } : null; }
  async guest() {
    const { data, error } = await this.sb.auth.signInAnonymously();
    if (error) throw new Error(error.message);
    this.sess = data.session;
  }
  async discord() { return this.oauth('discord'); }
  async reddit() { return this.oauth('reddit'); }
  async oauth(provider) {
    if (this.sess) await this.sb.auth.signOut();
    const { error } = await this.sb.auth.signInWithOAuth({ provider,
      options: { redirectTo: location.href.split('#')[0] } });
    if (error) throw new Error(error.message);
  }
  async logout() { await this.sb.auth.signOut(); this.sess = null; }
  async rpc(fn, args = {}) {
    const { data, error } = await this.sb.rpc(fn, args);
    if (error) throw new Error(error.message);
    return data;
  }
  channel(topic, onMsg, onJoin) {
    const ch = this.sb.channel(topic, { config: { private: true, broadcast: { self: false } } });
    ch.on('broadcast', { event: '*' }, (m) => onMsg(m.event, m.payload));
    (async () => {
      await this.sb.realtime.setAuth();
      ch.subscribe((status, err) => { if (status === 'CHANNEL_ERROR') console.warn('[rt]', topic, err); if (status === 'SUBSCRIBED') onJoin?.(); });
    })();
    return { send: (event, payload) => ch.send({ type: 'broadcast', event, payload }), close: () => this.sb.removeChannel(ch) };
  }
}
