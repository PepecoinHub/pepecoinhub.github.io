// PepeGochi hidden-beta window (PR B2): everything the window shows, without the DOM, so tests can play it.
//
// LOCAL TEST ONLY. It drives the browser copy of the rules (pepegochi-model.mjs) with a virtual clock.
// It has no network access, no Supabase and no Passport: nothing reaches a player's account and no stamp
// is ever awarded. The only thing it keeps is this tab's own copy of the test frog, under STORAGE_KEY in
// sessionStorage (gone when the tab closes; "Reset" clears it).
// Temporary look for testing the mechanics. The game's real art comes later.
import { LocalPepegochi, KINDS, parseTimestampUs } from './pepegochi-model.mjs';

export const STORAGE_KEY = 'pepegochi-local-sim-v1';
export const START = Date.UTC(2026, 10, 9, 18);           // Monday 18:00 UTC
export const NEED_OF = { feed: 'hunger', clean: 'hygiene', play: 'mood', rest: 'energy' };
export const NEED_NAME = { hunger: 'Hunger', hygiene: 'Hygiene', mood: 'Mood', energy: 'Energy' };
export const ACTION_NAME = { feed: 'Feed', clean: 'Clean', play: 'Play', rest: 'Rest' };
export const TIME_STEPS = [['+10 min', 10 * 6e4], ['+1 h', 36e5], ['+3 h', 3 * 36e5], ['+6 h', 6 * 36e5], ['+12 h', 12 * 36e5],
  ['+1 day', 864e5], ['+2 days', 2 * 864e5], ['+7 days', 7 * 864e5]];

// working copy from docs/design/pepegochi-v2/STORY_CONTENT.md
export const COPY = {
  adoptTitle: 'A new fren has arrived!',
  adoptText: "Give your little frog a name. Feed, clean, play and let it rest. But don't disappear forever — frens have feelings too.",
  adopted: 'Nice. You have a roommate now.',
  readopted: 'Welcome home, tiny fren. Try not to eat the sofa.',
  healthy: 'Your Fren is doing fine.',
  neglected: 'Not impressed. The food bowl is empty. Your Fren has started judging you.',
  packing: 'Packing... Your Fren packed a tiny suitcase. This is not a drill.',
  leaving: 'Your Fren is thinking of leaving.',
  recovering: 'Your Fren is still upset. Come back on another day to make up.',
  departed: 'PEPEGOCHI.EXE — Your fren has left the pond.',
  afterLetter: 'Not all frens stay forever.',
  readFirst: 'Read GOODBYE.TXT first. Then you can adopt a new fren.',
};
export const GOODBYE = `Dear Fren,

I waited.
I got hungry.
I ate the furniture.

Then I realized I deserve better.

So I packed my stuff and left.

Don't worry about me. I'll be fine.

You should probably get yourself another frog.

P.S. I took the TV.

- Your former PepeGochi`;

// the rules, written from the values the server uses (rules in every response)
export function rulesText(r) {
  return [
    `Look after every need at least once every ${r.departs_h / 24} days, or your Fren moves out.`,
    `After ${r.neglected_h / 24} days without care a need is overdue and your Fren feels neglected. After ${r.packing_h / 24} days it starts packing.`,
    `If it started packing, care for every overdue need, then come back on another day, at least ${r.recovery_min_gap_h} hours later.`,
    `While it recovers it moves out after ${r.recovery_departs_h} hours without care.`,
    `A good care day: ${r.good_day_min_kinds} different kinds of care and every need ${r.good_day_min_need} or more. ${r.good_parent_days} of them with one Fren: Good Parent.`,
  ];
}

const W = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const p2 = n => String(n).padStart(2, '0');
export const fmt = ms => { const d = new Date(ms); return `${W[d.getUTCDay()]} ${p2(d.getUTCDate())}.${p2(d.getUTCMonth() + 1)}. ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())} UTC`; };
export const msOf = iso => (iso == null ? null : parseTimestampUs(iso) / 1000);
export function span(ms) {
  const a = Math.max(0, ms), d = Math.floor(a / 864e5), h = Math.floor(a % 864e5 / 36e5), m = Math.ceil(a % 36e5 / 6e4);
  if (d) return `${d} d ${h} h`;
  if (h) return `${h} h ${m === 60 ? 59 : m} min`;
  return `${m} min`;
}
const list = a => a.join(', ');

// a JSON copy that keeps Infinity (a need that never decays has no waiting time)
const enc = w => JSON.stringify(w, (k, v) => (v === Infinity ? '__inf__' : v === -Infinity ? '__-inf__' : v));
const dec = s => JSON.parse(s, (k, v) => (v === '__inf__' ? Infinity : v === '__-inf__' ? -Infinity : v));

export class BetaGame {
  // storage: anything with getItem/setItem/removeItem (sessionStorage in the browser), or null
  constructor({ storage = null, start = START } = {}) {
    this.storage = storage;
    this.start = start;
    this.sim = new LocalPepegochi({ start });
    this.last = null;
    this.message = '';
    this.letterOpen = false;
    this.showHistory = false;
    this.log = [];
    this.load();
    this.refresh();
  }
  get now() { return this.sim.now / 1000; }

  // ---------- one call to the local copy of the server ----------
  call(name, args, label) {
    const r = this.sim.rpc(name, args);
    if (r.ok) this.last = r.value;
    const res = r.ok ? (r.value.action_result || r.value.adopt_result || 'ok') : r.error;
    if (label) this.log.unshift({ at: this.now, what: label, result: res, ok: r.ok });
    this.log.length = Math.min(this.log.length, 40);
    this.save();
    return r;
  }
  refresh() { return this.call('gry_pepegochi_state', {}, null); }

  adopt(name) {
    const r = this.call('gry_pepegochi_adopt', { p_name: name }, 'adopt ' + name);
    if (!r.ok) this.message = r.error;
    else if (r.value.adopt_result === 'read_the_letter_first') this.message = COPY.readFirst;
    else if (r.value.adopt_result === 'adopted') { this.message = r.value.pet.generation > 1 ? COPY.readopted : COPY.adopted; this.letterOpen = false; }
    else this.message = '';
    return r;
  }
  act(kind) {
    const r = this.call('gry_pepegochi_action', { p_action: kind }, ACTION_NAME[kind] || kind);
    this.message = r.ok ? (r.value.action_result === 'moved_out' ? COPY.departed : '') : r.error;
    this.sim.advance(3000);   // every action moves the clock 3 s, past the 2 s gap between actions
    this.refresh();
    return r;
  }
  // test shortcut: every action the frog needs and can take right now
  careAll() {
    for (const k of KINDS) {
      const a = this.view().pet?.actions.find(x => x.kind === k);
      if (a && a.enabled) this.act(k);
    }
  }
  readLetter() {
    const r = this.call('gry_pepegochi_letter_read', {}, 'open GOODBYE.TXT');
    this.letterOpen = r.ok && r.value.pet?.status === 'departed';
    this.message = this.letterOpen ? COPY.afterLetter : '';
    return r;
  }
  closeLetter() { this.letterOpen = false; this.save(); }
  advance(ms) { this.sim.advance(ms); this.message = ''; this.refresh(); }
  // the next given weekday (0 = Sunday ... 6 = Saturday) at hh:mm UTC, strictly later than now
  nextWeekday(day, hh = 18, mm = 0) {
    const d = new Date(this.now);
    d.setUTCHours(hh, mm, 0, 0);
    while (d.getTime() <= this.now || d.getUTCDay() !== day) d.setUTCDate(d.getUTCDate() + 1);
    this.advance(d.getTime() - this.now);
  }
  reset() {
    if (this.storage) try { this.storage.removeItem(STORAGE_KEY); } catch (e) { /* storage blocked */ }
    this.sim = new LocalPepegochi({ start: this.start });
    this.log = []; this.message = ''; this.letterOpen = false; this.showHistory = false;
    this.refresh();
  }

  // ---------- this tab's copy ----------
  save() {
    if (!this.storage) return;
    try { this.storage.setItem(STORAGE_KEY, enc({ v: 1, world: this.sim.world, now: this.sim.now, log: this.log, letterOpen: this.letterOpen })); }
    catch (e) { /* storage full or blocked: the game still works */ }
  }
  load() {
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = dec(raw);
      if (s.v !== 1) return;
      this.sim.world = s.world; this.sim.now = s.now; this.log = s.log || []; this.letterOpen = !!s.letterOpen;
    } catch (e) { /* a broken copy: start again */ }
  }

  // ---------- what the window shows ----------
  view() {
    const s = this.last, r = s.rules, now = this.now, p = s.pet;
    const v = {
      clock: { text: fmt(now), day: Math.floor((now - this.start) / 864e5) },
      message: this.message,
      rules: rulesText(r),
      history: s.history.map(h => ({
        text: `#${h.generation} ${h.name}: ${h.days_together} days together, ${h.care_days} care days, ${h.good_days} good days. Left for a different pond (${h.departure_reason === 'recovery' ? 'nobody came back while it recovered' : NEED_NAME[NEED_OF[h.departure_reason]] + ' waited too long'}).`,
      })),
      summary: s.summary,
      showHistory: this.showHistory,
      log: this.log.slice(0, 12).map(x => `${fmt(x.at)}  ${x.what}: ${x.result}`),
    };
    if (!p) {
      v.mode = 'adopt';
      v.adopt = { title: COPY.adoptTitle, text: COPY.adoptText };
      return v;
    }
    if (p.status === 'departed') {
      v.mode = 'departed';
      v.departed = {
        name: p.name, text: COPY.departed,
        facts: [`${p.days_together} days together`, `${p.care_days} care days`, `${p.good_days} good care days`,
          `Moved out ${fmt(msOf(p.departed_at))}`],
        letterSeen: p.letter.seen, canAdopt: s.can_adopt,
      };
      v.letter = { open: this.letterOpen, title: 'GOODBYE.TXT - Notepad', text: GOODBYE,
        note: 'The TV is a joke: nothing ever leaves your inventory. (This is a local test: there is no inventory here.)' };
      return v;
    }
    v.mode = 'pet';
    const overdue = new Set(p.overdue);
    const limitReached = p.action_budget.accepted_today >= p.action_budget.max_per_utc_day;
    v.pet = {
      title: `${p.name} · ${p.stage} · day ${p.life_day}${p.generation > 1 ? ` · fren #${p.generation}` : ''}`,
      status: p.status,
      statusText: COPY[p.status] || p.status,
      needs: KINDS.map(k => {
        const n = NEED_OF[k], val = p.needs[n];
        return { kind: k, need: n, label: NEED_NAME[n], value: val, overdue: overdue.has(k),
          low: val < r.good_day_min_need,
          note: overdue.has(k) ? `waiting since ${fmt(msOf(p.waiting_since[k]))}` : '' };
      }),
      actions: KINDS.map(k => {
        const cd = p.cooldowns[k] ? msOf(p.cooldowns[k]) : null;
        let reason = '';
        if (limitReached) reason = 'daily limit reached';
        else if (cd && cd > now) reason = `ready in ${span(cd - now)}`;
        else if (p.needs[NEED_OF[k]] >= r.meaningful_below) reason = 'not needed now';
        return { kind: k, label: ACTION_NAME[k], enabled: !reason, reason };
      }),
      growth: `Care days: ${p.care_days}` + (p.next_growth_care_days ? ` (grows at ${p.next_growth_care_days})` : ' (grown up)'),
      warnings: [],
      deadline: `If nobody comes: moves out ${fmt(msOf(p.departs_at))} (in ${span(msOf(p.departs_at) - now)}, `
        + (p.departure_reason === 'recovery' ? 'no care while recovering)' : `${NEED_NAME[NEED_OF[p.departure_reason]]} waiting)`),
    };
    if (p.status === 'neglected') v.pet.warnings.push(`Your Fren misses you. Overdue: ${list(p.overdue.map(k => NEED_NAME[NEED_OF[k]]))}.`);
    if (p.status === 'packing') {
      v.pet.warnings.push(`${COPY.leaving} It moves out ${fmt(msOf(p.departs_at))} (in ${span(msOf(p.departs_at) - now)}).`);
      if (p.overdue.length) v.pet.warnings.push(`A full check-up stops it. Still overdue: ${list(p.overdue.map(k => `${ACTION_NAME[k]} (${NEED_NAME[NEED_OF[k]]})`))}.`);
    }
    if (p.rescue_starts_recovery && p.status === 'neglected') v.pet.warnings.push('It started packing earlier: when every overdue need is cared for, it needs one more visit on another day.');
    if (p.recovery) {
      const from = msOf(p.recovery.counts_from);
      v.pet.recovery = from > now
        ? `Recovering. It can be finished from ${fmt(from)} (in ${span(from - now)}): care on a later UTC day, at least ${r.recovery_min_gap_h} h after the rescue. A visit before that still helps, but does not finish it.`
        : 'Recovering. Care now finishes the recovery.';
    }
    const gd = p.good_day, missingKinds = Math.max(0, r.good_day_min_kinds - gd.kinds_today);
    v.pet.goodDays = {
      count: p.good_days, goal: p.good_days_goal, streak: p.good_streak, best: p.best_good_streak, today: gd.today,
      progress: `Good care days: ${p.good_days} / ${p.good_days_goal} for Good Parent (in a row: ${p.good_streak}, best ${p.best_good_streak})`,
      blockers: gd.today ? [] : [
        ...(missingKinds ? [`${missingKinds} more kind${missingKinds > 1 ? 's' : ''} of care today (${gd.kinds_today} of ${r.good_day_min_kinds} so far)`] : []),
        ...p.good_day.needs_low.map(k => `${NEED_NAME[NEED_OF[k]]} is ${p.needs[NEED_OF[k]]}, needs ${r.good_day_min_need}: ${ACTION_NAME[k]}`),
      ],
      text: gd.today ? 'Today is a good care day.' : 'Not a good care day yet.',
    };
    return v;
  }
}
