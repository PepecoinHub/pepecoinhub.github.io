// PepeGochi hidden-beta window in PondOS (PR B2). Runs in CI without a database.
// tests/pepegochi-parity.test.mjs replays the same window session on the real SQL.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { BetaGame, STORAGE_KEY, TIME_STEPS, GOODBYE, COPY, span } from '../docs/games/js/pepegochi-beta-view.mjs';
import { walk } from './pepegochi-beta-walk.mjs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const memStorage = () => { const m = new Map(); return { m, getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };
const H = 36e5;

test('the whole life cycle in the window: adopt, care, neglect, packing, rescue, recovery, moving out, letter, new egg', () => {
  const v = walk(new BetaGame({ storage: memStorage() }));
  assert.equal(v.start.mode, 'adopt');
  assert.equal(v.start.adopt.title, COPY.adoptTitle);
  assert.equal(v.adopted.message, COPY.adopted);
  assert.deepEqual(v.adopted.pet.needs.map(n => n.value), [75, 80, 80, 75]);
  // the four kinds of care, then their cooldowns
  assert.deepEqual(v.cared.pet.actions.map(a => a.reason), ['ready in 30 min', 'ready in 20 min', 'ready in 45 min', 'ready in 60 min']);
  assert.equal(v.cared.pet.goodDays.count, 1);
  // neglect
  assert.equal(v.neglected.pet.status, 'neglected');
  assert.match(v.neglected.pet.warnings[0], /Your Fren misses you\. Overdue: /);
  assert.ok(v.neglected.pet.needs.some(n => n.overdue && /waiting since/.test(n.note)));
  // packing: the warning says when, and what a rescue needs
  assert.equal(v.packing.pet.status, 'packing');
  assert.match(v.packing.pet.statusText, /tiny suitcase/);
  assert.match(v.packing.pet.warnings.join(' '), /Your Fren is thinking of leaving\. It moves out .* \(in /);
  assert.match(v.packing.pet.warnings.join(' '), /Still overdue: Feed \(Hunger\), Clean \(Hygiene\), Play \(Mood\), Rest \(Energy\)/);
  // feeding alone is not a rescue
  assert.equal(v.fedOnly.pet.status, 'packing');
  assert.doesNotMatch(v.fedOnly.pet.warnings.join(' '), /Feed \(Hunger\)/);
  assert.equal(v.fedOnly.pet.recovery, undefined);
  // the full check-up starts recovery and shows the earliest finish: 8 h after the rescue
  assert.equal(v.rescued.pet.status, 'recovering');
  const finish = v.rescued.pet.recovery.match(/finished from (.*?) \(in/)[1];
  assert.match(v.rescued.pet.recovery, /in 7 h 59 min|in 8 h 0 min|in 8 h/);
  // a visit 5 h later helps but does not finish it, and the finish time stays
  assert.equal(v.early.pet.status, 'recovering');
  assert.equal(v.early.pet.recovery.match(/finished from (.*?) \(in/)[1], finish);
  assert.match(v.early.pet.recovery, /A visit before that still helps, but does not finish it/);
  // the next morning: recovered
  assert.equal(v.recovered.pet.status, 'healthy');
  assert.equal(v.recovered.pet.recovery, undefined);
  // 9 days away: moved out, an empty room and a letter
  assert.equal(v.departed.mode, 'departed');
  assert.equal(v.departed.departed.text, COPY.departed);
  assert.equal(v.departed.departed.letterSeen, false);
  assert.equal(v.adoptTooSoon.message, COPY.readFirst);
  assert.equal(v.adoptTooSoon.mode, 'departed');
  assert.equal(v.letter.letter.open, true);
  assert.equal(v.letter.letter.text, GOODBYE);
  assert.match(v.letter.letter.text, /P\.S\. I took the TV\./);
  assert.equal(v.letter.departed.canAdopt, true);
  // a new egg: generation 2, the old frog in Past Frens
  assert.equal(v.readopted.message, COPY.readopted);
  assert.match(v.readopted.pet.title, /^Fren II · tadpole · day 1 · fren #2$/);
  assert.equal(v.readopted.history.length, 1);
  assert.match(v.readopted.history[0].text, /^#1 Fren: \d+ days together, \d+ care days, \d+ good days\. Left for a different pond/);
  assert.equal(v.end.pet.goodDays.count, 1, 'good days start again with the new frog');
});

test('good care days: progress, and the exact need that blocks today', () => {
  const g = new BetaGame({ storage: null });
  g.adopt('Fren');
  g.advance(59 * H);                 // hunger 25.8, hygiene 43.1, mood 35.75, energy 50.4
  let gd = g.view().pet.goodDays;
  assert.equal(gd.progress, 'Good care days: 0 / 30 for Good Parent (in a row: 0, best 0)');
  assert.deepEqual(gd.blockers, ['2 more kinds of care today (0 of 2 so far)', 'Hunger is 25, needs 40: Feed', 'Mood is 35, needs 40: Play']);
  g.act('clean'); g.act('feed');
  gd = g.view().pet.goodDays;
  assert.deepEqual(gd.blockers, ['Mood is 35, needs 40: Play'], 'two kinds done; only mood is left');
  g.act('play');
  gd = g.view().pet.goodDays;
  assert.equal(gd.today, true); assert.equal(gd.count, 1); assert.deepEqual(gd.blockers, []);
});

test('time machine: minutes, hours, days and the next weekend day', () => {
  assert.deepEqual(TIME_STEPS.map(x => x[0]), ['+10 min', '+1 h', '+3 h', '+6 h', '+12 h', '+1 day', '+2 days', '+7 days']);
  const g = new BetaGame({ storage: null });
  const t0 = g.now;
  g.advance(3 * H); assert.equal(g.now - t0, 3 * H);
  g.nextWeekday(6, 18);
  const sat = new Date(g.now);
  assert.equal(sat.getUTCDay(), 6); assert.equal(sat.getUTCHours(), 18);
  g.nextWeekday(6, 18);
  assert.equal(g.now - sat.getTime(), 7 * 24 * H, 'strictly the next one');
  assert.equal(span(90 * 6e4), '1 h 30 min');
  assert.equal(span(26 * H), '1 d 2 h');
});

test('kept in this tab only: the copy survives a reload, Reset removes it', () => {
  const st = memStorage();
  const g = new BetaGame({ storage: st });
  g.adopt('Fren'); g.careAll(); g.advance(30 * H);
  assert.deepEqual([...st.m.keys()], [STORAGE_KEY]);
  const again = new BetaGame({ storage: st });
  assert.equal(again.now, g.now);
  assert.deepEqual(again.view().pet, g.view().pet);
  again.reset();
  assert.equal(st.m.has(STORAGE_KEY), true, 'a fresh, empty test frog is saved again');
  assert.equal(new BetaGame({ storage: st }).view().mode, 'adopt');
  // a broken copy starts again instead of failing
  st.setItem(STORAGE_KEY, '{not json');
  assert.equal(new BetaGame({ storage: st }).view().mode, 'adopt');
});

test('no stamps, no Passport: what the window shows never mentions them', () => {
  const v = walk(new BetaGame({ storage: null }));
  for (const [k, x] of Object.entries(v)) assert.doesNotMatch(JSON.stringify(x), /stamp|badge|passport|first_hatch|good_parent|supabase/i, k);
});

test('local only: the page cannot reach any server, and its scripts use no network and no other storage', () => {
  const page = read('docs/games/pepegochi.html');
  const csp = page.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/)[1];
  assert.match(csp, /connect-src 'none'/);
  assert.match(csp, /form-action 'none'/);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval|wasm-unsafe-eval|https?:/);
  assert.match(page, /name="robots" content="noindex, nofollow"/);
  assert.match(page, /LOCAL TEST\./);
  assert.match(page, /no stamp is real/);
  assert.doesNotMatch(page, /<script(?![^>]*\bsrc=)/, 'no inline script');
  assert.doesNotMatch(page, /goatcounter|gc\.zgo\.at|supabase/);
  for (const f of ['docs/games/js/pepegochi-beta.mjs', 'docs/games/js/pepegochi-beta-view.mjs', 'docs/games/js/pepegochi-room.mjs']) {
    const code = read(f).replace(/\/\/[^\n]*/g, '');
    assert.doesNotMatch(code, /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|localStorage|indexedDB|document\.cookie|postMessage/, f);
    assert.doesNotMatch(code, /supabase|backend\.js|getBackend|gry_passport|passport_award/i, f);
    for (const i of [...code.matchAll(/\bimport\b[^'"]*['"]([^'"]+)['"]/g)].map(m => m[1]))
      assert.ok(['./pepegochi-model.mjs', './pepegochi-beta-view.mjs', './pepegochi-room.mjs'].includes(i), f + ' imports ' + i);
  }
  const ui = read('docs/games/js/pepegochi-beta.mjs').replace(/\/\/[^\n]*/g, '');
  assert.equal([...ui.matchAll(/sessionStorage/g)].length, 1, 'one tab storage, handed to the game');
  assert.match(read('docs/games/js/pepegochi-beta-view.mjs'), /export const STORAGE_KEY = 'pepegochi-local-sim-v1'/);
});

test('PondOS: the window exists only for ?beta=gochi testers and opens the local page', () => {
  const pond = read('docs/meme/meme.js');
  assert.match(pond, /if \(q === 'gochi'\) localStorage\.setItem\('pondos-gochi-beta', '1'\);/);
  assert.match(pond, /if \(q === 'off'\) localStorage\.removeItem\('pondos-gochi-beta'\);/);
  // every place that can open it is behind the flag
  const uses = [...pond.matchAll(/pepegochiApp\(\)/g)].map(m => m.index);
  assert.equal(uses.length, 3, 'definition + Start menu + Find');
  for (const i of uses) {
    const line = pond.slice(pond.lastIndexOf('\n', i) + 1, pond.indexOf('\n', i));
    if (/function pepegochiApp/.test(line)) continue;
    const before = pond.slice(Math.max(0, i - 400), i);
    assert.match(before, /GOCHI \? \[/, 'not behind the flag: ' + line.trim().slice(0, 80));
  }
  assert.match(pond, /games\/pepegochi\.html\?embed=1" title="PEPEGOCHI\.EXE \(local test\)"/);
  // not linked from anywhere else on the site
  const hits = [];
  const walkDir = dir => {
    for (const e of readdirSync(new URL('../' + dir, import.meta.url), { withFileTypes: true })) {
      const p = dir + '/' + e.name;
      if (e.isDirectory()) { if (!['data', 'assets', 'vendor'].includes(e.name)) walkDir(p); }
      else if (/\.(html|js|mjs|json)$/.test(e.name) && !/pepegochi(\.html|-beta(-view)?\.mjs)$|meme\/meme\.js$/.test(p)
               && /pepegochi\.html/.test(read(p))) hits.push(p);
    }
  };
  walkDir('docs');
  assert.deepEqual(hits, []);
  // the PondOS pages load the new meme.js
  const versions = new Set([...readdirSync(new URL('../docs/meme/', import.meta.url))].filter(f => f.endsWith('.html'))
    .map(f => (read('docs/meme/' + f).match(/meme\.js\?v=([a-z0-9]+)/) || [])[1]).filter(Boolean));
  assert.equal(versions.size, 1, 'every PondOS page loads the same meme.js: ' + [...versions]);
});
