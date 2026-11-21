// A12 "life of its own": diary, rare events, trips (owner spec 2026-11-21).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ENTRIES, ENTRY, writeEntries, entryCount, frogDay, createDiary, situation, seasonOf, fill, hash32, rng, diaryKey, DAY } from '../docs/meme/pepegochi-diary.mjs';
import { RARE, rareOfDay, dailyOdds, localDay, isNight } from '../docs/meme/pepegochi-rare.mjs';
import { PLACES, SOUVENIRS, LENGTHS, rollTrip, placeWeights, souvenirFor, postcardText, tripForDiary, tripState, formatLeft } from '../docs/meme/pepegochi-trips.mjs';

const HOUR = 3600000;
const T0 = Date.UTC(2026, 10, 21, 12);
const storage = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m }; };
const base = (extra = {}) => ({ seed: 7, adoptedAt: T0 - 23 * DAY, now: T0, lastSeen: T0 - 5 * HOUR, recent: [],
  market: {}, chain: {}, needs: { hunger: 90, hygiene: 90, mood: 90, energy: 90 }, date: { month: 11, day: 21, weekday: 6 }, ...extra });

test('owner rule: no page under 2 h away, then 1 / 2 / 3', () => {
  assert.deepEqual([0, HOUR, 2 * HOUR - 1, 2 * HOUR, 11 * HOUR, 12 * HOUR, 47 * HOUR, 48 * HOUR, 30 * DAY].map(entryCount), [0, 0, 0, 1, 1, 2, 2, 3, 3]);
  assert.equal(writeEntries(base({ lastSeen: T0 - HOUR })).length, 0);
  assert.equal(writeEntries(base()).length, 1);
  assert.equal(writeEntries(base({ lastSeen: T0 - 20 * HOUR })).length, 2);
  assert.equal(writeEntries(base({ lastSeen: T0 - 5 * DAY })).length, 3);
});

test('a long absence always brings one "missed you" page, and {days} is filled', () => {
  for (let seed = 1; seed < 60; seed++) {
    const pages = writeEntries(base({ seed, lastSeen: T0 - 5 * DAY }));
    assert.equal(pages.filter(p => ENTRY[p.id].cat === 'miss').length >= 1, true);
    for (const p of pages) assert.doesNotMatch(p.text, /\{[a-z]+\}/, p.text);
  }
  const p = writeEntries(base({ seed: 3, lastSeen: T0 - 5 * DAY, recent: ENTRIES.filter(([id, c]) => c === 'miss' && id !== 'miss_2').map(([id]) => ({ id, at: T0 - DAY })) }));
  assert.equal(p[0].id, 'miss_2'); assert.match(p[0].text, /^5 days alone/);
});

test('same input, same page (refresh cannot re-roll); a different seed may differ', () => {
  assert.deepEqual(writeEntries(base({ seed: 42 })), writeEntries(base({ seed: 42 })));
  const ids = new Set(Array.from({ length: 30 }, (_, s) => writeEntries(base({ seed: s }))[0].id));
  assert.ok(ids.size > 5);
});

test('real PEP data picks market pages; numbers formatted like the frog writes them', () => {
  const up = writeEntries(base({ seed: 1, lastSeen: T0 - 20 * HOUR, market: { change24h: 14.26 } }));
  assert.ok(situation(base({ market: { change24h: 14.26 } })).pool.some(([c]) => c === 'marketUp'));
  assert.ok(situation(base({ market: { change24h: -12 } })).pool.some(([c]) => c === 'marketDown'));
  assert.ok(situation(base({ market: { ath: true } })).pool.some(([c]) => c === 'ath'));
  assert.ok(!situation(base({ market: { change24h: 4 } })).pool.some(([c]) => /^market/.test(c)));
  assert.equal(fill('{change} today', { change: '+14%' }), '+14% today');
  let seen = false;
  for (let s = 0; s < 200 && !seen; s++) {
    const pages = writeEntries(base({ seed: s, market: { change24h: 14.26 } }));
    const hit = pages.find(p => p.id === 'up_1');
    if (hit) { seen = true; assert.equal(hit.text, 'price went up +14%. i did a little dance. the duck pretended not to see.'); }
  }
  assert.ok(seen && up.length === 2);
});

test('a page is not repeated within 30 days', () => {
  const recent = ENTRIES.filter(([, c]) => c === 'daily' || c === 'duck').map(([id]) => ({ id, at: T0 - 5 * DAY }));
  const pages = writeEntries(base({ seed: 9, recent }));
  assert.equal(pages.length, 0, 'everything allowed was recent');
  const old = recent.map(r => ({ ...r, at: T0 - 31 * DAY }));
  assert.equal(writeEntries(base({ seed: 9, recent: old })).length, 1);
});

test('rare events and trip returns come first and are always told, even after a short absence', () => {
  const r = writeEntries(base({ lastSeen: T0 - 30 * 60000, rare: 'ufo' }));
  assert.deepEqual(r.map(p => p.id), ['rare_ufo']);
  const t = writeEntries(base({ lastSeen: T0 - 20 * HOUR, rare: 'duck_moved', trip: { place: 'the Moon', item: 'a jar of moon dust' } }));
  assert.equal(t[0].id, 'rare_duck'); assert.equal(ENTRY[t[1].id].cat, 'trip');
  assert.doesNotMatch(t[1].text, /\{/);
  for (const e of RARE) assert.ok(ENTRIES.some(([, c]) => c === 'rare:' + e.id) || e.id === 'birthday', e.id);
});

test('seasons and the first page of a new frog', () => {
  assert.equal(seasonOf({ month: 1, day: 30 }), 'pepBirthday');
  assert.equal(seasonOf({ month: 12, day: 25 }), 'christmas');
  assert.equal(seasonOf({ month: 10, day: 31 }), 'halloween');
  assert.equal(seasonOf({ month: 5, day: 5 }), null);
  assert.equal(writeEntries(base({ date: { month: 1, day: 30 } }))[0].id, 'season_pep');
  const first = writeEntries(base({ first: true, lastSeen: null }));
  assert.deepEqual(first.map(p => p.id), ['first_1']);
});

test('neglect pages are gentle and only appear when a need is low', () => {
  const s = situation(base({ needs: { hunger: 20, hygiene: 90, mood: 90, energy: 90 } }));
  assert.ok(s.pool.some(([c]) => c === 'needHunger')); assert.ok(!s.pool.some(([c]) => c === 'needHygiene'));
  for (const [, c, text] of ENTRIES) if (c.startsWith('need')) assert.doesNotMatch(text, /bad|hate|leave you|your fault/i);
});

test('frog day counts from 1; every entry id unique, short and lower-case like the frog writes', () => {
  assert.equal(frogDay(T0, T0), 1); assert.equal(frogDay(T0 - 23 * DAY, T0), 24);
  assert.equal(new Set(ENTRIES.map(e => e[0])).size, ENTRIES.length);
  for (const [id, , text] of ENTRIES) {
    assert.ok(text.length <= 120, id);
    assert.equal(text.replace(/ATH|PEP|TV|PEPaint|LAN|CD-ROM|MB|UFO|HE DOESN'T BLINK|THE LEMON TREE GREW A GOLDEN LEMON|ALL|\{[a-z]+\}/g, '').toLowerCase(),
      text.replace(/ATH|PEP|TV|PEPaint|LAN|CD-ROM|MB|UFO|HE DOESN'T BLINK|THE LEMON TREE GREW A GOLDEN LEMON|ALL|\{[a-z]+\}/g, ''), id);
  }
});

test('browser diary: first visit writes the first page, a quick return writes nothing, a long one writes more, kept per frog', () => {
  let t = T0; const s = storage();
  const d = createDiary({ storage: s, now: () => t });
  assert.deepEqual(d.visit('u1', 'life-1', { adoptedAt: T0 }).map(p => p.id), ['first_1']);
  t += HOUR; assert.equal(d.visit('u1', 'life-1', { adoptedAt: T0 }).length, 0);
  t += 3 * DAY; const back = d.visit('u1', 'life-1', { adoptedAt: T0 });
  assert.equal(back.length, 3); assert.equal(back[0].day, 4);
  assert.equal(d.unread(), 4); d.markRead(); assert.equal(d.unread(), 0);
  const again = createDiary({ storage: s, now: () => t });
  again.visit('u1', 'life-1', { adoptedAt: T0 });
  assert.equal(again.pages().length, 4, 'loaded from storage, no new page in the same minute');
  const other = createDiary({ storage: s, now: () => t });
  assert.deepEqual(other.visit('u1', 'life-2', {}).map(p => p.id), ['first_1'], 'a new frog starts a new diary');
  assert.equal(diaryKey(null, 'x'), null); assert.deepEqual(createDiary({ storage: s }).visit(null, 'x'), []);
  // touch keeps a long session from counting as time away
  t += 5 * HOUR; again.touch(); t += HOUR; assert.equal(again.visit('u1', 'life-1', {}).length, 0);
  // junk in storage is ignored
  s.setItem(diaryKey('u2', 'l'), JSON.stringify({ seen: 'x', pages: [{ id: 'nope' }, 5] }));
  const junk = createDiary({ storage: s, now: () => t }); junk.visit('u2', 'l', {});
  assert.ok(junk.pages().every(p => ENTRY[p.id]));
});

test('rare events: deterministic per owner and day, about 4% of nights, birthday and fly rain by calendar/market', () => {
  const ctx = { owner: 'u1', lifeId: 'l1', dayKey: '2026-11-21', month: 11, day: 21, hour: 22 };
  assert.equal(rareOfDay(ctx), rareOfDay(ctx));
  assert.equal(rareOfDay({ ...ctx, month: 1, day: 30 }), 'birthday');
  assert.equal(rareOfDay({ ...ctx, ath: true }), 'fly_rain');
  assert.equal(rareOfDay({ ...ctx, owner: null }), null);
  const odds = dailyOdds(true);
  assert.ok(odds > .03 && odds < .05, String(odds));
  let hits = 0; const N = 20000;
  for (let i = 0; i < N; i++) if (rareOfDay({ ...ctx, owner: 'u' + i })) hits++;
  assert.ok(Math.abs(hits / N - odds) < .006, hits / N + ' vs ' + odds);
  assert.equal(isNight(23), true); assert.equal(isNight(12), false);
  const day = localDay(T0); assert.match(day.dayKey, /^\d{4}-\d{2}-\d{2}$/);
});

test('trips: catalog sane, pack doubles its places, short trips never give legendary, unknown gives nothing', () => {
  for (const p of PLACES) assert.equal(p.w.length, 3);
  const w = Object.fromEntries(placeWeights('short', 'snack'));
  assert.equal(w.big_pond, 60); assert.equal(w.scrypt_mine, 25); assert.equal(w.moon, undefined);
  assert.equal(rollTrip('weird', null), null); assert.equal(rollTrip('short', 'sword'), null);
  const r = rng(hash32('trips'));
  const counts = {};
  for (let i = 0; i < 30000; i++) {
    const t = rollTrip('short', null, r);
    assert.ok(t.souvenir === null || SOUVENIRS.find(s => s.id === t.souvenir).rarity !== 'legendary');
    counts[t.place] = (counts[t.place] || 0) + 1;
  }
  assert.equal(counts.moon, undefined); assert.equal(counts.krakow_dragon, undefined);
  for (let i = 0; i < 5000; i++) { const t = rollTrip('grand', null, r); if (t.place === 'unknown') assert.equal(t.souvenir, null); }
  // place-bound souvenirs only from their place; legendary downgrades where none exists
  assert.equal(souvenirFor('big_pond', 'legendary', () => 0), 'souv_photo');
  assert.equal(souvenirFor('moon', 'legendary', () => 0), 'souv_moon_dust');
  assert.equal(LENGTHS.grand.hours, 48);
});

test('postcards and the trip state the browser shows', () => {
  assert.deepEqual(postcardText('moon', 'souv_moon_dust'), { title: 'Greetings from the Moon',
    lines: ['made it to the moon. it was quiet. pep was already here.', 'p.s. i brought a jar of moon dust.'] });
  assert.equal(postcardText('unknown', null).title, '???');
  assert.equal(postcardText('nowhere', null), null);
  assert.deepEqual(tripForDiary('scrypt_mine', null), { place: 'the Scrypt Mine', item: null });
  for (let seed = 0; seed < 80; seed++) for (const p of writeEntries(base({ seed, lastSeen: T0 - 20 * HOUR, trip: { place: 'the Moon', item: null } })))
    assert.doesNotMatch(p.text, /\{|null|undefined/, p.text);
  for (let seed = 0; seed < 80; seed++) for (const p of writeEntries(base({ seed, lastSeen: T0 - 30 * HOUR })))
    assert.doesNotMatch(p.text, /^1 days/, p.text);
  const away = { length: 'short', started_at: new Date(T0).toISOString(), return_at: new Date(T0 + 4 * HOUR).toISOString() };
  assert.deepEqual(tripState(away, T0 + HOUR), { status: 'away', leftMs: 3 * HOUR, length: 'short' });
  assert.deepEqual(tripState({ ...away, place: 'moon', souvenir: null }, T0 + 5 * HOUR), { status: 'back', place: 'moon', souvenir: null });
  assert.deepEqual(tripState({ ...away, claimed_at: 'x' }, T0), { status: 'home' });
  assert.deepEqual(tripState(null), { status: 'home' });
  assert.equal(formatLeft(3 * HOUR + 58 * 60000 + 1), '3 h 59 min'); assert.equal(formatLeft(3 * HOUR + 59 * 60000 + 1), '4 h 0 min'); assert.equal(formatLeft(30 * 1000), '1 min');
});

test('the trips SQL catalog matches the browser catalog', () => {
  const sql = readFileSync(new URL('../games/supabase/update_pepegochi_trips.sql', import.meta.url), 'utf8');
  for (const p of PLACES) {
    const pack = p.pack ? `'${p.pack}'` : 'null';
    assert.ok(sql.includes(`('${p.id}', ${p.w[0]}, ${p.w[1]}, ${p.w[2]}, ${pack}, ${p.secret ? 'true' : 'false'})`), p.id);
  }
  for (const s of SOUVENIRS) {
    const from = s.from ? 'array[' + s.from.map(x => `'${x}'`).join(', ') + ']' : 'null';
    assert.ok(sql.includes(`('${s.id}', '${s.rarity}', ${from})`), s.id);
  }
  assert.match(sql, /DRAFT: not installed anywhere/);
  assert.match(sql, /when 'short' then 0\.4 when 'long' then 0\.7 else 1/);
});
