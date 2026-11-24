// Diary pages carry the frog's real day (counted from the adoption), also pages saved earlier as "Day 1".
import test from 'node:test';
import assert from 'node:assert/strict';
const D = await import('../docs/meme/pepegochi-diary.mjs');

const DAY = 864e5;
const memory = () => { const mem = {}; return { mem, storage: { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } } }; };

test('old pages saved as day 1 get their real day', () => {
  const { mem, storage } = memory();
  const adopted = Date.parse('2026-11-15T20:21:16.282625+00:00');
  mem[D.diaryKey('u', 'L')] = JSON.stringify({ seen: adopted + 3 * DAY, read: 0, pages: [
    { id: 'first_1', day: 1, at: adopted + 1000, text: 'a' }, { id: 'daily_7', day: 1, at: adopted + 3 * DAY, text: 'b' }] });
  globalThis.localStorage = storage;
  try {
    const r = D.diaryFor('u', 'L', adopted + 4 * DAY, adopted);
    assert.deepEqual(r.pages.map(p => p.day), [1, 4]);
  } finally { delete globalThis.localStorage; }
  const t = adopted + 6 * DAY;
  const d = D.createDiary({ storage, now: () => t });
  const fresh = d.visit('u', 'L', { adoptedAt: adopted, needs: {}, date: { month: 11, day: 21, weekday: 6 } });
  assert.ok(fresh.length > 0 && fresh.every(p => p.day === 7));
  assert.deepEqual(JSON.parse(mem[D.diaryKey('u', 'L')]).pages.slice(0, 2).map(p => p.day), [1, 4]);
});

test('a missing adopted_at falls back to life_day, never to day 1', () => {
  const now = Date.parse('2026-11-24T09:00:00Z');
  assert.equal(D.frogDay(D.adoptedMs({ life_day: 9 }, now), now), 9);
  assert.equal(D.frogDay(D.adoptedMs({ adopted_at: '2026-11-15T20:21:16.282625+00:00' }, now), now), 9);
});

test('adopted_at in the Postgres format (microseconds, +00 or a space) is read to the millisecond', () => {
  const want = Date.UTC(2026, 10, 15, 20, 21, 16, 282);
  for (const v of ['2026-11-15T20:21:16.282625+00:00', '2026-11-15 20:21:16.282625+00', '2026-11-15T20:21:16.282Z'])
    assert.equal(D.adoptedMs({ adopted_at: v }), want, v);
});
