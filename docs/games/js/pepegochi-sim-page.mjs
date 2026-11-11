// PepeGochi test simulator page (docs/games/pepegochi-sim.html). LOCAL ONLY: it drives the in-memory
// model from pepegochi-model.mjs with a virtual clock. No network (the page CSP has connect-src 'none'),
// no storage, no Supabase, no Passport. Nothing here is saved or reaches a player's account.
// Temporary layout for testing the rules; the game's real look comes later.
import { LocalPepegochi, KINDS, DEFAULT_RULES, parseTimestampUs } from './pepegochi-model.mjs';

const START = Date.UTC(2026, 10, 9, 18);   // Monday 18:00 UTC
const NEED_OF = { feed: 'hunger', clean: 'hygiene', play: 'mood', rest: 'energy' };
const SAY = {   // working copy from docs/design/pepegochi-v2/STORY_CONTENT.md
  healthy: 'Your Fren is doing fine.',
  neglected: 'Not impressed. The food bowl is empty. Your Fren has started judging you.',
  packing: 'Packing... Your Fren packed a tiny suitcase. This is not a drill. Your Fren is thinking of leaving.',
  recovering: 'Your Fren is still upset. Come back on another day to make up.',
  departed: 'PEPEGOCHI.EXE: your fren has left the pond.',
};
const GOODBYE = `Dear Fren,

I waited.
I got hungry.
I ate the furniture.

Then I realized I deserve better.

So I packed my stuff and left.

Don't worry about me. I'll be fine.

You should probably get yourself another frog.

P.S. I took the TV.

- Your former PepeGochi`;
const RULE_KEYS = ['meaningful_below', 'neglected_h', 'packing_h', 'departs_h', 'rescue_from_h', 'recovery_days',
  'recovery_departs_h', 'recovery_min_gap_h', 'max_actions_per_utc_day', 'good_day_min_kinds', 'good_day_min_need',
  'good_parent_days'];

const $ = id => document.getElementById(id);
const el = (tag, text, cls) => { const n = document.createElement(tag); if (text != null) n.textContent = text; if (cls) n.className = cls; return n; };
const W = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fmt = ms => { const d = new Date(ms); return `${W[d.getUTCDay()]} ${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`; };
const msOf = iso => (iso == null ? null : parseTimestampUs(iso) / 1000);
const span = ms => {
  const a = Math.abs(ms), d = Math.floor(a / 864e5), h = Math.floor(a % 864e5 / 36e5), m = Math.floor(a % 36e5 / 6e4);
  return (d ? d + ' d ' : '') + (d || h ? h + ' h ' : '') + m + ' min';
};

const sim = new LocalPepegochi({ start: START });
let last = null;
const nowMs = () => sim.now / 1000;

function log(what, r) {
  const li = el('li', `${fmt(nowMs())}  ${what}: ` + (r.ok ? (r.value.action_result || r.value.adopt_result || 'ok') : r.error), r.ok ? '' : 'err');
  $('pgs-log').prepend(li);
}
function call(name, args, what) {
  const r = sim.rpc(name, args);
  if (r.ok) last = r.value;
  log(what, r);
  render();
  return r;
}
const look = () => call('gry_pepegochi_state', {}, 'look');

function dl(pairs) {
  const d = el('dl');
  for (const [k, v] of pairs) { if (v == null || v === '') continue; d.append(el('dt', k), el('dd', String(v))); }
  return d;
}

function render() {
  $('pgs-now').textContent = fmt(nowMs());
  $('pgs-day').textContent = `(day ${Math.floor((nowMs() - START) / 864e5)} since the start)`;
  const box = $('pgs-pet');
  box.replaceChildren();
  const s = last, p = s?.pet;
  if (!p) box.append(el('p', 'No fren yet. A new fren has arrived! Give it a name and adopt it.'));
  else if (p.status === 'departed') {
    box.append(el('p', SAY.departed), dl([
      ['Name', p.name], ['Moved out', fmt(msOf(p.departed_at))], ['Because of', p.departure_reason],
      ['Days together', p.days_together], ['Care days', p.care_days],
      ['Letter', p.letter.seen ? 'read' : 'not read yet (open GOODBYE.TXT)'],
      ['Saved on the server', p.departure_saved ? 'yes (simulated)' : 'not yet: the next write call saves it'],
    ]));
  } else {
    box.append(el('p', SAY[p.status] || p.status));
    const needs = el('div', null, 'pgs-needs');
    for (const k of KINDS) {
      const n = NEED_OF[k], v = p.needs[n];
      const m = el('meter'); m.min = 0; m.max = 100; m.value = v; m.setAttribute('aria-label', n);
      needs.append(el('span', n), m, el('span', String(v), 'mono'));
    }
    box.append(needs, dl([
      ['Name', `${p.name} (fren #${p.generation})`], ['Stage', p.stage], ['Status', p.status], ['Life day', p.life_day],
      ['Care days', p.care_days + (p.next_growth_care_days ? ` (grows at ${p.next_growth_care_days})` : '')],
      ['Most neglected', `${p.most_neglected}, waiting since ${fmt(msOf(p.most_neglected_since))}`],
      ['Overdue', p.overdue.join(', ')],
      ['Rescue starts recovery', p.rescue_starts_recovery ? 'yes: care for every overdue need' : ''],
      ['Recovery', p.recovery ? (msOf(p.recovery.counts_from) > nowMs()
        ? `can be finished from ${fmt(msOf(p.recovery.counts_from))} (in ${span(msOf(p.recovery.counts_from) - nowMs())}). A visit before that still helps, but does not finish it.`
        : `${p.recovery.days_left} day(s) left: care now finishes it`) : ''],
      ['Moves out', `${fmt(msOf(p.departs_at))} (in ${span(msOf(p.departs_at) - nowMs())}) unless ${p.departure_reason === 'recovery' ? 'you visit again' : p.departure_reason + ' is cared for'}`],
      ['Accepted actions today', `${p.action_budget.accepted_today} / ${p.action_budget.max_per_utc_day}`],
      ['Good care days', `${p.good_days} / ${p.good_days_goal} for Good Parent (in a row now: ${p.good_streak}, best ${p.best_good_streak})`],
      ['Good day today', p.good_day.today ? 'yes'
        : 'not yet: ' + [
          p.good_day.kinds_today < s.rules.good_day_min_kinds
            ? `${p.good_day.kinds_today} of ${s.rules.good_day_min_kinds} kinds of care` : '',
          p.good_day.needs_low.length ? `still below ${s.rules.good_day_min_need}: ${p.good_day.needs_low.join(', ')}` : '',
        ].filter(Boolean).join('; ')],
    ]));
  }
  for (const b of $('pgs-actions').querySelectorAll('[data-act]')) {
    const k = b.dataset.act, cd = p?.cooldowns?.[k];
    const cooling = cd && msOf(cd) > nowMs();
    const full = p && p.status !== 'departed' && p.needs[NEED_OF[k]] >= s.rules.meaningful_below;
    b.textContent = k[0].toUpperCase() + k.slice(1) + (cooling ? ` (${span(msOf(cd) - nowMs())})` : full ? ' (not needed)' : '');
  }
  const hist = $('pgs-history');
  hist.replaceChildren();
  if (!s?.history?.length) hist.append(el('p', 'None yet.', 'muted'));
  else {
    const ul = el('ul');
    for (const h of s.history) ul.append(el('li', `#${h.generation} ${h.name}: ${h.days_together} days together, ${h.care_days} care days, left because of ${h.departure_reason}. Left for a different pond.`));
    hist.append(ul);
  }
  if (s?.summary) hist.append(el('p', `Former frens: ${s.summary.former_frens}. Longest friendship: ${s.summary.longest_friendship_days} days.`, 'small'));
  $('pgs-json').textContent = JSON.stringify(s, null, 2);
}

function careAll() {
  if (!last) look();
  for (const k of KINDS) {
    const p = last?.pet;
    if (!p || p.status === 'departed') break;
    if (p.needs[NEED_OF[k]] >= last.rules.meaningful_below) continue;
    if (p.cooldowns[k] && msOf(p.cooldowns[k]) > nowMs()) continue;
    call('gry_pepegochi_action', { p_action: k }, k);
    sim.advance(3000);
  }
  render();
}

function rulesForm() {
  const f = $('pgs-rules');
  f.replaceChildren();
  for (const k of RULE_KEYS) {
    const label = el('label', k);
    const input = el('input'); input.type = 'number'; input.step = 'any'; input.name = k; input.value = sim.rules[k];
    label.append(input); f.append(label);
  }
  const apply = el('button', 'Apply', 'btn'); apply.type = 'submit';
  const reset = el('button', 'Back to the server values', 'btn'); reset.type = 'button';
  reset.addEventListener('click', () => { sim.setRules({}); rulesForm(); look(); });
  f.append(apply, reset);
}

$('pgs-time').addEventListener('click', e => {
  const b = e.target.closest('[data-ms]');
  if (!b) return;
  sim.advance(Number(b.dataset.ms));
  look();
});
$('pgs-next-sat').addEventListener('click', () => {
  const d = new Date(nowMs()); d.setUTCHours(18, 0, 0, 0);
  do d.setUTCDate(d.getUTCDate() + 1); while (d.getUTCDay() !== 6);
  sim.advance(d.getTime() - nowMs());
  look();
});
$('pgs-adopt').addEventListener('submit', e => { e.preventDefault(); call('gry_pepegochi_adopt', { p_name: $('pgs-name').value }, 'adopt'); });
$('pgs-actions').addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  call('gry_pepegochi_action', { p_action: b.dataset.act }, b.dataset.act);
  sim.advance(3000);   // each action moves the clock 3 seconds, past the 2 s gap between actions
  render();
});
$('pgs-care').addEventListener('click', careAll);
$('pgs-look').addEventListener('click', look);
$('pgs-letter').addEventListener('click', () => {
  const r = call('gry_pepegochi_letter_read', {}, 'open GOODBYE.TXT');
  const g = $('pgs-goodbye');
  g.hidden = !(r.ok && r.value.pet?.status === 'departed');
  g.textContent = 'GOODBYE.TXT\n\n' + GOODBYE + '\n\n(The TV is a joke: nothing is ever taken from the inventory.)';
});
$('pgs-rules').addEventListener('submit', e => {
  e.preventDefault();
  const o = {};
  // every value that differs from the server's, so applying twice keeps earlier changes
  for (const k of RULE_KEYS) { const v = Number(new FormData(e.target).get(k)); if (v !== DEFAULT_RULES[k]) o[k] = v; }
  sim.setRules(o);
  log('playtest values ' + JSON.stringify(o), { ok: true, value: {} });
  look();
});
rulesForm();
look();
