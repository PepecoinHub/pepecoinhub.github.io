// PepeGochi v2 time simulator.
//
// Runs the real games/supabase/update_pepegochi_v2.sql in a throwaway in-memory database (PGlite) with a
// virtual clock, so a whole frog life (adoption, neglect, rescue, moving out, a new egg) plays out in
// seconds. It never connects to Supabase and needs no server.
//
// Setup, once, outside this repo:
//   mkdir -p /tmp/pepegochi-sim && cd /tmp/pepegochi-sim && npm i @electric-sql/pglite
// Then, from the repo root:
//   export PEPEGOCHI_PGLITE_MODULE=/tmp/pepegochi-sim/node_modules/@electric-sql/pglite/dist/index.js
//   node scripts/pepegochi_sim.mjs --all                       every built-in scenario + a summary
//   node scripts/pepegochi_sim.mjs --scenario weekend-sat-sun --rule recovery_days=1
//   node scripts/pepegochi_sim.mjs --script "adopt Fren; care; wait 6d; feed; wait 1d; state"
//   node scripts/pepegochi_sim.mjs                             interactive prompt (type: help)
//
// --rule key=value replaces one value of games.pepegochi_rules() in the throwaway database only, to try
// other playtest numbers (nested keys use dots: --rule cooldown_min.feed=10).
//
// tests/pepegochi-sql.test.mjs imports this file and checks the same scenarios on a real PostgreSQL.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('../', import.meta.url);
const read = p => readFile(new URL(p, ROOT), 'utf8');
export const DAY_MS = 86400e3;
export const KINDS = ['feed', 'clean', 'play', 'rest'];
export const NEED_OF = { feed: 'hunger', clean: 'hygiene', play: 'mood', rest: 'energy' };
export const START = '2026-11-09T18:00:00Z';   // a Monday, 18:00 UTC

// The parts of Supabase the migrations use: roles, auth.users / auth.identities and auth.uid().
export const SUPABASE_STUB = `
do $$ begin create role anon nologin; exception when duplicate_object or unique_violation then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object or unique_violation then null; end $$;
create schema auth;
create table auth.users(id uuid primary key, created_at timestamptz not null default now(),
  is_anonymous boolean not null default false);
create table auth.identities(user_id uuid references auth.users(id) on delete cascade, provider text not null,
  provider_id text not null, identity_data jsonb not null default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated;
`;

// Test/simulator only: the clock reads a per-transaction setting. Never part of the migration.
export const VIRTUAL_CLOCK = `
create or replace function games.pepegochi_clock() returns timestamptz
language sql volatile set search_path = '' as $$
  select coalesce(nullif(current_setting('pepegochi.sim_now', true), '')::timestamptz, clock_timestamp())
$$;`;

// PGlite has exec() for many statements; node-postgres runs them through query().
export const asDb = x => ({ exec: x.exec ? s => x.exec(s) : s => x.query(s), query: (s, p) => x.query(s, p) });

export const uid = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');

// Loads the stub, schema.sql, any extra migrations and update_pepegochi_v2.sql, then the virtual clock.
export async function prepare(db, { extra = [] } = {}) {
  await db.exec(SUPABASE_STUB);
  await db.exec(await read('games/supabase/schema.sql'));
  for (const f of extra) await db.exec(await read('games/supabase/' + f));
  await db.exec(await read('games/supabase/update_pepegochi_v2.sql'));
  await db.exec(VIRTUAL_CLOCK);
  const base = (await db.query('select games.pepegochi_rules() as r')).rows[0].r;
  return { base };
}

// Replaces the playtest rules in this throwaway database: base values plus overrides ({} restores).
export async function setRules(db, base, overrides = {}) {
  const r = structuredClone(base);
  for (const [k, v] of Object.entries(overrides)) {
    const path = k.split('.'); let o = r;
    while (path.length > 1) { const p = path.shift(); if (typeof o[p] !== 'object') throw new Error('Unknown rule ' + k); o = o[p]; }
    if (!(path[0] in o)) throw new Error('Unknown rule ' + k);
    o[path[0]] = v;
  }
  const lit = JSON.stringify(r).replace(/'/g, "''");
  await db.exec(`create or replace function games.pepegochi_rules() returns jsonb
    language sql stable set search_path = '' as $$ select '${lit}'::jsonb $$;`);
  return r;
}

export async function addPlayer(db, n, { provider = 'discord' } = {}) {
  await db.query('insert into auth.users(id) values ($1)', [uid(n)]);
  if (provider) await db.query('insert into auth.identities values ($1, $2, $3, $4)',
    [uid(n), provider, 'p' + n, JSON.stringify({ full_name: 'Fren ' + n })]);
}

// One PostgREST-like request: a transaction with the role, the JWT subject and the virtual time set locally.
export async function callRpc(db, { user, now, role = 'authenticated', tz } = {}, fn, args = []) {
  await db.exec('begin');
  try {
    await db.exec('set local role ' + (role === 'anon' ? 'anon' : 'authenticated'));
    await db.query("select set_config('request.jwt.claim.sub', $1, true), set_config('pepegochi.sim_now', $2, true)",
      [user ? uid(user) : '', now ? new Date(now).toISOString() : '']);
    if (tz) await db.query("select set_config('TimeZone', $1, true)", [tz]);
    const res = await db.query('select ' + fn + ' as v', args);
    await db.exec('commit');
    return { ok: true, value: res.rows[0].v };
  } catch (e) {
    await db.exec('rollback');
    return { ok: false, error: e.message, code: e.code };
  }
}

const W = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const p2 = n => String(n).padStart(2, '0');
export const fmt = d => { d = new Date(d); return `${W[d.getUTCDay()]} ${p2(d.getUTCDate())} ${M[d.getUTCMonth()]} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`; };

// A player with a virtual clock.
export class Sim {
  constructor(db, { user = 1, start = START, print = () => {}, verbose = false } = {}) {
    this.db = db; this.user = user; this.start = new Date(start); this.now = new Date(start);
    this.print = print; this.verbose = verbose; this.last = null; this.lastShown = '';
    this.events = [];   // { day, at, what, result, status }
  }
  day(t = this.now) { return Math.floor((new Date(t) - this.start) / DAY_MS); }
  async rpc(fn, args = []) {
    const r = await callRpc(this.db, { user: this.user, now: this.now }, fn, args);
    if (r.ok) this.last = r.value;
    return r;
  }
  note(what, r) {
    const s = r.ok ? r.value : this.last;
    const status = s?.pet?.status ?? (s?.has_pet === false ? 'no frog' : '?');
    const result = r.ok ? (r.value.action_result || r.value.adopt_result || 'ok') : 'rejected: ' + r.error;
    this.events.push({ day: this.day(), at: this.now.toISOString(), what, result, status });
    const line = describe(this, what, result, s);
    const key = status + '|' + (s?.pet?.recovery?.days_left ?? '') + '|' + (s?.pet?.generation ?? '');
    const always = !/^(accepted|ok)$/.test(result) || /^(adopt|read)/.test(what);
    if (this.verbose || always || key !== this.lastShown) this.print(line);
    this.lastShown = key;
    return r;
  }
  async state(label = 'look') { return this.note(label, await this.rpc('public.gry_pepegochi_state()')); }
  async adopt(name) { return this.note('adopt ' + name, await this.rpc('public.gry_pepegochi_adopt($1)', [name])); }
  async letter() { return this.note('read GOODBYE.TXT', await this.rpc('public.gry_pepegochi_letter_read()')); }
  async act(kind) {
    const r = await this.note(kind, await this.rpc('public.gry_pepegochi_action($1)', [kind]));
    this.now = new Date(+this.now + 3000);   // past the 2 s gap between actions
    return r;
  }
  // a normal short visit: every action the frog needs right now, one after another
  async care() {
    if (!this.last) await this.state('arrive');
    const s = this.last;
    if (!s?.pet || s.pet.status === 'departed') return;
    const below = s.rules.meaningful_below;
    for (const k of KINDS) {
      const p = this.last.pet;
      if (!p || p.status === 'departed') return;
      if (p.needs[NEED_OF[k]] >= below) continue;
      if (p.cooldowns[k] && new Date(p.cooldowns[k]) > this.now) continue;
      await this.act(k);
    }
  }
  async visit(how = 'care') {
    await this.state('arrive');
    if (this.last?.pet?.status === 'departed') return;
    if (how === 'care') await this.care(); else await this.act(how);
  }
  wait(spec) {
    const m = /^(\d+(?:\.\d+)?)\s*(s|m|h|d)$/.exec(String(spec).trim());
    if (!m) throw new Error('wait: use e.g. 90m, 6h, 2d');
    this.now = new Date(+this.now + Number(m[1]) * { s: 1e3, m: 6e4, h: 36e5, d: DAY_MS }[m[2]]);
  }
  goto(day, hhmm = '18:00') {
    const [h, mi] = hhmm.split(':').map(Number);
    const t = new Date(+this.start + day * DAY_MS);
    t.setUTCHours(h, mi || 0, 0, 0);
    if (t < this.now) throw new Error('goto: that moment is in the past');
    this.now = t;
  }
}

function describe(sim, what, result, s) {
  const p = s?.pet;
  let tail = '';
  if (p && p.status !== 'departed') {
    const n = p.needs;
    tail = `H${n.hunger} C${n.hygiene} M${n.mood} E${n.energy}  care days ${p.care_days}  leaves ${fmt(p.departs_at)}`
      + (p.recovery ? `  recovery: ${p.recovery.days_left} day(s) left` : '')
      + (p.overdue.length ? `  overdue: ${p.overdue.join(', ')}` : '');
  } else if (p) {
    tail = `moved out ${fmt(p.departed_at)} (day ${sim.day(p.departed_at)}, ${p.departure_reason})`
      + `  letter ${p.letter.seen ? 'read' : 'unread'}`;
  }
  return `  day ${String(sim.day()).padStart(2)}  ${fmt(sim.now)}  ${what.padEnd(16)} ${result.padEnd(22)} ${(p?.status ?? 'no frog').padEnd(10)} ${tail}`;
}

// ---------- built-in scenarios (start: Monday 18:00 UTC; day 5 = Saturday, day 6 = Sunday) ----------
const repeatDays = async (s, days, pick, how = 'care') => {
  for (let d = 1; d <= days; d++) {
    if (!pick(d)) continue;
    s.goto(d);
    await s.visit(how);
    if (s.last?.pet?.status === 'departed') return d;
  }
};
const after = async (s, day) => { s.goto(day, '18:30'); await s.state('check'); };

// a small seeded random generator, so "random" scenarios are the same on every run
export const rng = seed => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
};
const hhmm = m => `${p2(Math.floor(m / 60))}:${p2(m % 60)}`;

// Weekly visits for a number of weeks. at(day) returns 'HH:MM' (UTC) or null for no visit that day.
const weekly = async (s, weeks, at, how = 'care') => {
  for (let d = 1; d < weeks * 7; d++) {
    const when = at(d);
    if (!when) continue;
    for (const t of [].concat(when)) {
      s.goto(d, t);
      await s.visit(how);
      if (s.last?.pet?.status === 'departed') return d;
    }
  }
};
const weekendAt = (sat, sun) => d => (d % 7 === 5 ? sat : d % 7 === 6 ? sun : null);

export const SCENARIOS = {
  'daily': {
    about: 'Short visit every day for 60 days.',
    run: async s => { await s.adopt('Fren'); await s.care(); await repeatDays(s, 60, () => true); await after(s, 60); },
  },
  'every-4-days': {
    about: 'Short visit every 4 days. Neglected in between, never packing.',
    run: async s => { await s.adopt('Fren'); await s.care(); await repeatDays(s, 60, d => d % 4 === 0); await after(s, 60); },
  },
  'weekend-fri-sun': {
    about: 'Visits on Friday, Saturday and Sunday every week (18:00 UTC).',
    run: async s => { await s.adopt('Fren'); await s.care(); await repeatDays(s, 56, d => d % 7 >= 4); await after(s, 56); },
  },
  'weekend-sat-sun': {
    about: 'Visits on Saturday and Sunday only (18:00 UTC).',
    run: async s => { await s.adopt('Fren'); await s.care(); await repeatDays(s, 56, d => d % 7 >= 5); await after(s, 56); },
  },
  'weekend-morning-evening': {
    about: 'Weekends only: Saturday 08:00, Sunday 21:00 UTC, 8 weeks.',
    run: async s => { await s.adopt('Fren'); await s.care(); await weekly(s, 8, weekendAt('08:00', '21:00')); await after(s, 56); },
  },
  'weekend-evening-morning': {
    about: 'Weekends only: Saturday 21:00, Sunday 08:00 UTC, 8 weeks.',
    run: async s => { await s.adopt('Fren'); await s.care(); await weekly(s, 8, weekendAt('21:00', '08:00')); await after(s, 56); },
  },
  'weekend-across-midnight': {
    about: 'Weekends only: Saturday 23:30 and Sunday 00:30 UTC (one late session split by midnight: under the 8 h rule it is one visit).',
    run: async s => { await s.adopt('Fren'); await s.care(); await weekly(s, 8, weekendAt('23:30', '00:30')); await after(s, 56); },
  },
  'weekend-random-hours': {
    about: 'Weekends only, a different random time (UTC) every Saturday and Sunday, 12 weeks.',
    run: async s => {
      const r = rng(2026);
      await s.adopt('Fren'); await s.care();
      await weekly(s, 12, d => (d % 7 >= 5 ? hhmm(Math.floor(r() * 1440)) : null));
      await after(s, 84);
    },
  },
  'weekend-feed-only': {
    about: 'Weekends only, but only feeds.',
    run: async s => { await s.adopt('Fren'); await s.care(); await weekly(s, 8, weekendAt('18:00', '18:00'), 'feed'); await after(s, 56); },
  },
  'weekend-missed-saturday': {
    about: 'Weekends at 18:00; in week 3 Saturday is missed and Sunday comes at 12:00. No weekday visit.',
    run: async s => {
      await s.adopt('Fren'); await s.care();
      await weekly(s, 8, d => (d === 19 ? null : d === 20 ? '12:00' : weekendAt('18:00', '18:00')(d)));
      await after(s, 56);
    },
  },
  'weekend-missed-saturday-monday': {
    about: 'Same, but the player also comes back on Monday of week 4 at 18:00.',
    run: async s => {
      await s.adopt('Fren'); await s.care();
      await weekly(s, 8, d => (d === 19 ? null : d === 20 ? '12:00' : d === 21 ? '18:00' : weekendAt('18:00', '18:00')(d)));
      await after(s, 56);
    },
  },
  'weekend-missed-saturday-late': {
    about: 'Same as missed Saturday, but Sunday comes at 19:00: more than 7 days after the last visit.',
    run: async s => {
      await s.adopt('Fren'); await s.care();
      await weekly(s, 8, d => (d === 19 ? null : d === 20 ? '19:00' : weekendAt('18:00', '18:00')(d)));
      await after(s, 56);
    },
  },
  'feed-every-6-days': {
    about: 'One feed every 6 days, nothing else (the owner\'s example).',
    run: async s => { await s.adopt('Fren'); await s.care(); await repeatDays(s, 60, d => d % 6 === 0, 'feed'); await after(s, 60); },
  },
  'feed-only-daily': {
    about: 'Feeds every day but never cleans, plays or rests.',
    run: async s => { await s.adopt('Fren'); await s.care(); await repeatDays(s, 60, () => true, 'feed'); await after(s, 60); },
  },
  'checkup-every-6-days': {
    about: 'Full visit (all four actions) every 6 days.',
    run: async s => { await s.adopt('Fren'); await s.care(); await repeatDays(s, 60, d => d % 6 === 0); await after(s, 60); },
  },
  'trip-6-days': {
    about: 'Daily for 10 days, away 6 days (packing), rescue, then daily again.',
    run: async s => {
      await s.adopt('Fren'); await s.care();
      await repeatDays(s, 9, () => true);
      await repeatDays(s, 30, d => d >= 15);
      await after(s, 30);
    },
  },
  'rescue-then-vanish': {
    about: 'Away 6 days, a full rescue visit, then away again for 4 days.',
    run: async s => {
      await s.adopt('Fren'); await s.care();
      await repeatDays(s, 4, () => true);
      await repeatDays(s, 10, d => d === 10);
      await repeatDays(s, 20, d => d === 14);
      await after(s, 20);
    },
  },
  'trip-8-days': {
    about: 'Daily for 10 days, away 8 days: moved out, letter, new egg.',
    run: async s => {
      await s.adopt('Fren'); await s.care();
      await repeatDays(s, 9, () => true);
      s.goto(17); await s.state('arrive');
      await s.adopt('Fren II');     // refused until the letter is read
      await s.letter();
      await s.adopt('Fren II');
      await s.care();
      await repeatDays(s, 20, d => d >= 18);
      await after(s, 20);
    },
  },
};

export function outcome(s) {
  const st = s.last;
  const left = [...(st?.history ?? [])].reverse()
    .map(h => `${h.name} moved out day ${s.day(h.departed_at)} (${h.departure_reason})`);
  if (st?.pet?.status === 'departed') left.push(`${st.pet.name} moved out day ${s.day(st.pet.departed_at)} (${st.pet.departure_reason})`);
  const seen = [...new Set(s.events.map(e => e.status))].filter(x => x !== '?');
  const now = st?.has_pet ? `has ${st.pet.name}: ${st.pet.status}, ${st.pet.care_days} care days` : 'no frog';
  return { left, seen, now };
}

// ---------- command line ----------
const HELP = `Commands (separate with ";" or new lines):
  adopt <name>       adopt a frog (after a move-out: read the letter first)
  feed | clean | play | rest
  care               every action the frog needs right now
  wait <n><s|m|h|d>  move the clock forward, e.g. wait 36h
  goto <day> [HH:MM] jump to a day counted from the start (default 18:00 UTC)
  state              show the frog
  letter             read GOODBYE.TXT
  history            former frens
  rule <key>=<value> change a playtest value in this throwaway database
  rules              show the playtest values
  help | quit`;

async function runCommand(s, line, ctx) {
  const [cmd, ...rest] = line.trim().split(/\s+/);
  const arg = rest.join(' ');
  if (!cmd) return;
  if (KINDS.includes(cmd)) return s.act(cmd);
  switch (cmd) {
    case 'adopt': return s.adopt(arg || 'Fren');
    case 'care': return s.care();
    case 'wait': s.wait(arg); return s.state('look');
    case 'goto': s.goto(Number(rest[0]), rest[1]); return s.state('look');
    case 'state': await s.state('look'); return ctx.out(JSON.stringify(s.last?.pet ?? null, null, 2));
    case 'letter': return s.letter();
    case 'history': await s.state('look'); return ctx.out(JSON.stringify({ history: s.last.history, summary: s.last.summary }, null, 2));
    case 'rule': {
      const [k, v] = arg.split('='); ctx.overrides[k] = Number(v);
      ctx.rules = await setRules(s.db, ctx.base, ctx.overrides); return ctx.out(`rule ${k} = ${v}`);
    }
    case 'rules': return ctx.out(JSON.stringify(ctx.rules, null, 2));
    case 'help': return ctx.out(HELP);
    case 'quit': case 'exit': ctx.quit = true; return;
    default: return ctx.out(`unknown command "${cmd}" (type help)`);
  }
}

async function main(argv) {
  const opt = { scenarios: [], rules: {}, script: null, all: false, verbose: false, start: START };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--all') opt.all = true;
    else if (a === '--scenario') opt.scenarios.push(argv[++i]);
    else if (a === '--rule') { const [k, v] = argv[++i].split('='); opt.rules[k] = Number(v); }
    else if (a === '--script') opt.script = argv[++i];
    else if (a === '--start') opt.start = argv[++i];
    else if (a === '--verbose') opt.verbose = true;
    else if (a === '--list') { for (const [k, v] of Object.entries(SCENARIOS)) console.log(k.padEnd(22), v.about); return; }
    else { console.log(HELP.replace('Commands', 'Usage: --all | --scenario <name> | --script "<commands>" | --rule k=v | --start ISO | --verbose | --list\n\nCommands')); return; }
  }
  let PGlite;
  try { ({ PGlite } = await import(process.env.PEPEGOCHI_PGLITE_MODULE || '@electric-sql/pglite')); }
  catch { console.error('PGlite not found. Install it outside the repo and set PEPEGOCHI_PGLITE_MODULE (see the top of this file).'); process.exitCode = 1; return; }
  const fresh = async () => {
    const db = asDb(new PGlite());
    const { base } = await prepare(db);
    const rules = await setRules(db, base, opt.rules);
    await addPlayer(db, 1);
    return { db, base, rules };
  };
  const names = opt.all ? Object.keys(SCENARIOS) : opt.scenarios;
  if (Object.keys(opt.rules).length) console.log('Playtest overrides:', JSON.stringify(opt.rules));
  if (names.length) {
    const rows = [];
    for (const name of names) {
      const sc = SCENARIOS[name];
      if (!sc) { console.log('Unknown scenario ' + name + ' (try --list)'); continue; }
      console.log(`\n${name}: ${sc.about}`);
      const { db } = await fresh();
      const s = new Sim(db, { start: opt.start, print: l => console.log(l), verbose: opt.verbose });
      await sc.run(s);
      rows.push([name, outcome(s)]);
    }
    console.log('\nSummary');
    for (const [name, o] of rows) {
      console.log(`  ${name.padEnd(22)} ${(o.left.length ? o.left.join('; ') : 'never moved out').padEnd(44)} end: ${o.now}`);
      console.log(`  ${''.padEnd(22)} statuses seen: ${o.seen.join(', ')}`);
    }
    return;
  }
  const ctx = { ...(await fresh()), overrides: { ...opt.rules }, out: l => console.log(l), quit: false };
  const s = new Sim(ctx.db, { start: opt.start, print: l => console.log(l), verbose: true });
  const run = async text => {
    for (const line of text.split(/[;\n]/)) {
      if (ctx.quit) break;
      try { await runCommand(s, line, ctx); } catch (e) { console.log('  ' + e.message); }
    }
  };
  if (opt.script) return run(opt.script);
  if (!process.stdin.isTTY) { let t = ''; for await (const c of process.stdin) t += c; return run(t); }
  const { createInterface } = await import('node:readline/promises');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log('PepeGochi simulator, virtual clock ' + fmt(s.now) + ' UTC. Type help.');
  while (!ctx.quit) {
    const line = await rl.question(`[day ${s.day()} ${fmt(s.now)}] > `);
    await run(line);
  }
  rl.close();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv.slice(2));
