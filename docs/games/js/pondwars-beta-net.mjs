// FROGAGEDDON online groundwork. No DOM here (Node can run it).
//
// How a match stays the same on two devices:
// - Both clients build the game from the same setup (seed, map, frogs per team).
// - Every simulation step is driven by one small input: held keys + discrete actions (jump, fire, weapon, skip).
// - The team whose turn it is drives the clock: its client steps the game and streams its inputs in small batches.
//   The other client replays exactly those inputs, step by step.
// - At every turn change the client that just played sends a full snapshot. The other client compares it with its own
//   state and adopts it on a mismatch before it takes control. Small floating-point differences between browsers
//   therefore cannot grow into two different ponds.
//
// The transport is anything with send(message) and an onmessage callback. tabTransport() links two tabs of the
// same browser (for testing without a server); a Supabase Realtime channel can implement the same two members.
import { W, H, WEAPONS, rng, newGame, startTurn, step, walk, hop, backflip, fire, skip, canMove, me } from './pondwars-beta-engine.mjs?v=20261106a';

export const PROTOCOL = 1;
export const KEY = { L: 1, R: 2, U: 4, D: 8 };   // bits of input.m
const FLUSH_EVERY = 6;       // steps per batch: 10 messages a second at 60 steps a second
const MAX_ACTS = 8, MAX_BATCH = 120;

// ---------- one step of input ----------
const num = v => typeof v === 'number' && Number.isFinite(v);
const selectable = w => typeof w === 'string' && Object.hasOwn(WEAPONS, w) && 'ammo' in WEAPONS[w];
function cleanAct(a) {
  if (!a || typeof a !== 'object') return null;
  if (a.t === 'jump' || a.t === 'skip') return { t: a.t };
  if (a.t === 'face') return a.d === 1 || a.d === -1 ? { t: 'face', d: a.d } : null;
  if (a.t === 'weapon') return selectable(a.w) ? { t: 'weapon', w: a.w } : null;
  if (a.t === 'fire' && num(a.a) && num(a.p)) {
    const out = { t: 'fire', a: a.a, p: Math.max(0, Math.min(1, a.p)) };
    if (num(a.x)) out.x = a.x;
    if (num(a.y)) out.y = a.y;
    return out;
  }
  return null;
}
// Inputs that came over the network are checked before they touch the game. 0 is an idle step.
export function cleanInput(raw) {
  if (!raw) return { m: 0, a: [] };
  const [m, acts] = Array.isArray(raw) ? raw : [raw.m, raw.a];
  const out = { m: (Number(m) >>> 0) & 15, a: [] };
  if (Array.isArray(acts)) for (const a of acts.slice(0, MAX_ACTS)) { const c = cleanAct(a); if (c) out.a.push(c); }
  return out;
}

// Actions: {t:'jump'} {t:'skip'} {t:'face', d:±1} {t:'weapon', w} {t:'fire', a:angle, p:power 0..1, x, y: target spot}
// Space on the keyboard, ↑ on a phone: let go of the rope, jump, or backflip while in the air.
export function jump(g) {
  if (!canMove(g)) return false;
  const f = me(g);
  if (f.rope) { f.rope = null; g.events.push({ type: 'unrope' }); return true; }
  if (f.jet) return false;
  return f.ground ? hop(g) : backflip(g);
}
export function act(g, a) {
  if (a.t === 'jump') return jump(g);
  if (a.t === 'face') { if (g.phase !== 'aim') return false; me(g).face = a.d; return true; }   // aiming turns the frog
  if (a.t === 'skip') { const was = g.phase; skip(g); return was !== g.phase; }
  if (a.t === 'weapon') {
    if (g.phase !== 'aim' || g.pistolShots || g.ammo[g.team][a.w] === 0) return false;
    g.weapon = a.w; return true;
  }
  if (a.t === 'fire') return fire(g, a.a, a.p, a.x, a.y);
  return false;
}
// Actions first, then walking, then rope/jetpack steering, then one fixed step of the world.
export function applyInput(g, input) {
  for (const a of input.a) act(g, a);
  const m = input.m;
  if (m & KEY.L) walk(g, -1);
  if (m & KEY.R) walk(g, 1);
  const f = me(g);
  g.ctl = canMove(g) && (f.rope || f.jet)
    ? { x: (m & KEY.R ? 1 : 0) - (m & KEY.L ? 1 : 0), y: (m & KEY.D ? 1 : 0) - (m & KEY.U ? 1 : 0) }
    : { x: 0, y: 0 };
  step(g);
}

// ---------- saving the whole match ----------
// Terrain as run lengths: zeros, ones, zeros, … A full map is a few thousand numbers instead of 720 000 bytes.
export function packMask(mask) {
  const runs = []; let v = 0, n = 0;
  for (let i = 0; i < mask.length; i++) { if (mask[i] !== v) { runs.push(n); v = mask[i]; n = 0; } n++; }
  runs.push(n); return runs;
}
export function unpackMask(runs) {
  const m = new Uint8Array(W * H); let i = 0, v = 0;
  if (!Array.isArray(runs)) throw new Error('bad terrain');
  for (const n of runs) {
    if (!Number.isInteger(n) || n < 0 || i + n > m.length) throw new Error('bad terrain');
    if (v) m.fill(1, i, i + n);
    i += n; v ^= 1;
  }
  if (i !== m.length) throw new Error('bad terrain');
  return m;
}
const LOCAL = new Set(['mask', 'rand', 'events', 'dirty']);
// JSON has no Infinity (frogs use it for "not hopping"), so it travels as a marker string.
const out = (k, v) => v === Infinity ? '+inf' : v === -Infinity ? '-inf' : v;
const back = (k, v) => v === '+inf' ? Infinity : v === '-inf' ? -Infinity : v;
export function snapshot(g) {
  const s = {};
  for (const k of Object.keys(g)) if (!LOCAL.has(k)) s[k] = g[k];
  s.mask = packMask(g.mask); s.rand = g.rand.state();
  return JSON.parse(JSON.stringify(s, out));
}
// Same keys in the same order on both sides, so two equal states give the same text.
function canonical(v) {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v, out);
}
function fnv(text) { let h = 0x811c9dc5; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return (h >>> 0).toString(16).padStart(8, '0'); }
export const snapshotHash = snap => fnv(canonical(snap));
export const stateHash = g => snapshotHash(snapshot(g));
// Overwrite g with a snapshot. Only keys the game already has are copied (a peer cannot add or replace others).
export function restoreInto(g, snap) {
  if (!snap || typeof snap !== 'object' || !Array.isArray(snap.frogs) || snap.frogs.length !== g.frogs.length || !Number.isInteger(snap.rand)) throw new Error('bad snapshot');
  const mask = unpackMask(snap.mask), copy = JSON.parse(JSON.stringify(snap), back);
  for (const k of Object.keys(g)) if (!LOCAL.has(k) && Object.hasOwn(copy, k)) g[k] = copy[k];
  g.mask = mask; g.rand = rng(snap.rand >>> 0); g.events = []; g.dirty = [[0, 0, W - 1, H - 1]];
  return g;
}

// ---------- the match between two clients ----------
// Host = team 0 and picks the setup. Guest = team 1.
// Messages: join, hello {setup, snap}, frames {from, f, v}, turn {tick, turn, snap}.
export class NetMatch {
  constructor(transport, { host }) {
    this.t = transport; this.host = !!host; this.team = host ? 0 : 1;
    this.g = null; this.setup = null; this.peer = false; this.waiting = null;
    this.tick = 0; this.recv = 0; this.outbox = []; this.inbox = []; this.awaitSnap = false;
    this.view = null; this.desyncs = 0;
    this.onstart = null; this.onrestore = null; this.onview = null; this.onpeer = null; this.onproblem = null;
    transport.onmessage = m => { try { this.receive(m); } catch (e) { this.onproblem?.(e.message); } };
  }
  join() { if (!this.host && !this.g) this.t.send({ type: 'join', protocol: PROTOCOL }); }
  // Host: start as soon as a guest is there.
  begin(setup) {
    if (!this.host) return;
    if (!this.peer) { this.waiting = setup; return; }
    this.waiting = null; this.start(setup);
    this.t.send({ type: 'hello', protocol: PROTOCOL, setup, snap: snapshot(this.g) });
  }
  start(setup, snap) {
    this.setup = setup;
    this.g = newGame({ seed: setup.seed, map: setup.map, perTeam: setup.perTeam, cpu: [false, false] });
    startTurn(this.g);
    if (snap && snapshotHash(snap) !== stateHash(this.g)) { restoreInto(this.g, snap); this.desyncs++; }
    this.tick = this.recv = 0; this.outbox = []; this.inbox = []; this.awaitSnap = false;
    this.onstart?.(this.g, setup);
  }
  // True while this client steps the game: its own turn, nothing left to replay, and the turn handover is done.
  drives() { const g = this.g; return !!g && g.team === this.team && g.phase !== 'over' && !this.inbox.length && !this.awaitSnap; }
  advance(input) {
    const g = this.g, turn = g.turn, a = input.a || [];
    applyInput(g, { m: input.m | 0, a }); this.recv = ++this.tick;   // the other side continues from this step
    this.outbox.push(input.m || a.length ? [input.m | 0, a] : 0);
    if (g.turn !== turn || g.phase === 'over') {
      this.flush();
      this.t.send({ type: 'turn', tick: this.tick, turn: g.turn, snap: snapshot(g) });
    } else if (a.length || this.outbox.length >= FLUSH_EVERY) this.flush();
  }
  flush() {
    if (!this.outbox.length) return;
    this.t.send({ type: 'frames', from: this.tick - this.outbox.length, f: this.outbox, v: this.view });
    this.outbox = [];
  }
  // Replay up to n of the other client's steps. Returns how many were applied.
  pump(n) {
    let done = 0;
    while (this.inbox.length) {
      const head = this.inbox[0];
      if (head.type === 'turn') { this.inbox.shift(); this.handover(head); continue; }
      if (done >= n) break;
      this.inbox.shift();
      const turn = this.g.turn;
      applyInput(this.g, cleanInput(head.f)); this.tick++; done++;
      if (this.g.turn !== turn && this.g.team === this.team) this.awaitSnap = true;
    }
    return done;
  }
  backlog() { return this.inbox.reduce((n, m) => n + (m.type === 'turn' ? 0 : 1), 0); }
  handover(m) {
    if (snapshotHash(m.snap) !== stateHash(this.g)) {
      restoreInto(this.g, m.snap); this.desyncs++;
      this.onrestore?.(this.g);
    }
    this.tick = m.tick; this.awaitSnap = false;
  }
  receive(m) {
    if (!m || typeof m !== 'object' || typeof m.type !== 'string') return;
    if (m.type === 'join' && this.host) {
      if (m.protocol !== PROTOCOL) return this.onproblem?.('The other tab runs a different game version.');
      this.peer = true; this.onpeer?.();
      if (this.waiting) this.begin(this.waiting);
      else if (this.g) this.flush(), this.t.send({ type: 'hello', protocol: PROTOCOL, setup: this.setup, snap: snapshot(this.g), tick: this.tick });
      return;
    }
    if (m.type === 'hello' && !this.host) {
      if (m.protocol !== PROTOCOL) return this.onproblem?.('The host runs a different game version.');
      this.peer = true; this.start(m.setup, m.snap); this.tick = this.recv = m.tick | 0;
      return;
    }
    if (!this.g) return;
    if (m.type === 'frames') {
      if (!Array.isArray(m.f) || m.f.length > MAX_BATCH || m.from !== this.recv) return this.onproblem?.('Missed part of the other player\'s turn.');
      this.recv += m.f.length;
      for (const f of m.f) this.inbox.push({ type: 'frame', f });
      if (Array.isArray(m.v)) this.onview?.(m.v);
    } else if (m.type === 'turn') {
      if (!Number.isInteger(m.tick) || m.tick !== this.recv) return this.onproblem?.('Turn change out of order.');
      this.inbox.push(m);
    }
  }
}

// Two tabs of the same browser, linked by a room name. For testing the protocol; it never leaves the device.
export function tabTransport(room) {
  const ch = new BroadcastChannel('frogageddon:' + room);
  const t = { send: m => ch.postMessage(m), onmessage: null, close: () => ch.close() };
  ch.onmessage = e => t.onmessage?.(e.data);
  return t;
}
// A connected pair in memory (Node tests). Messages are copied like a real network would.
export function loopback() {
  const a = { onmessage: null }, b = { onmessage: null };
  a.send = m => b.onmessage?.(JSON.parse(JSON.stringify(m)));
  b.send = m => a.onmessage?.(JSON.parse(JSON.stringify(m)));
  return [a, b];
}
