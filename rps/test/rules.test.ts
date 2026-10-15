import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dayKey, invert, normalizeTeam, outcome, pairOf, seasonEnd, seasonKey, type Move } from '../src/shared/rules.js';

test('rock paper scissors table', () => {
  const t: [Move, Move, string][] = [['r', 's', 'w'], ['s', 'p', 'w'], ['p', 'r', 'w'], ['s', 'r', 'l'], ['p', 's', 'l'], ['r', 'p', 'l'], ['r', 'r', 'd'], ['p', 'p', 'd'], ['s', 's', 'd']];
  for (const [a, b, r] of t) assert.equal(outcome(a, b), r, `${a} vs ${b}`);
  assert.equal(invert('w'), 'l');
  assert.equal(invert('d'), 'd');
});

test('team names', () => {
  assert.equal(normalizeTeam('r/Gaming'), 'gaming');
  assert.equal(normalizeTeam(' /r/PepeCoin '), 'pepecoin');
  assert.equal(normalizeTeam('AskReddit'), 'askreddit');
  for (const bad of ['', 'ab', 'a b c', 'r/', 'x'.repeat(22), 'bad-name', '../etc', '<script>', 5, null, undefined]) {
    assert.equal(normalizeTeam(bad), undefined, String(bad));
  }
  assert.deepEqual(pairOf('b', 'a'), ['a', 'b']);
});

test('seasons are ISO weeks in UTC', () => {
  const t = (s: string) => Date.parse(s);
  assert.equal(seasonKey(t('2026-10-15T12:00:00Z')), '2026-W42');
  assert.equal(seasonKey(t('2026-10-12T00:00:00Z')), '2026-W42', 'Monday 00:00 starts the week');
  assert.equal(seasonKey(t('2026-10-11T23:59:59Z')), '2026-W41', 'Sunday night is still last week');
  assert.equal(seasonKey(t('2026-01-01T00:00:00Z')), '2026-W01');
  assert.equal(seasonKey(t('2027-01-01T00:00:00Z')), '2026-W53', 'ISO year boundary');
  assert.equal(seasonEnd(t('2026-10-15T12:00:00Z')), t('2026-10-19T00:00:00Z'));
  assert.equal(seasonEnd(t('2026-10-12T00:00:00Z')), t('2026-10-19T00:00:00Z'));
  assert.equal(seasonEnd(t('2026-10-18T23:59:59Z')), t('2026-10-19T00:00:00Z'));
  assert.equal(dayKey(t('2026-10-15T23:59:59Z')), '2026-10-15');
});
