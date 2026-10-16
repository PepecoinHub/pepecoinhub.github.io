import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanAnswer, distance, keyOf, sameAnswer, singular } from '../src/shared/text.js';
import { dayKey, weekEnd, weekKey } from '../src/shared/time.js';
import { pickQuestion, QUESTIONS, CATEGORIES } from '../src/shared/questions.js';

test('answers that cannot be used', () => {
  for (const bad of ['', 'a', 'x'.repeat(41), 'see http://x.io', 'visit www.example.com', 'mail me@x.com', 'call 5551234567', 'fucking pizza', 'Big SHIT', 'a b c d e f g', 5, null, undefined, {}]) {
    assert.equal(cleanAnswer(bad), undefined, String(bad));
  }
  assert.equal(cleanAnswer('  pizza   party ')?.text, 'Pizza party');
  assert.equal(cleanAnswer('Mushrooms')?.text, 'Mushrooms');
});

test('different spellings share one key', () => {
  const same = [['Sandwiches', 'a sandwich'], ['French fries', 'fries, french'], ['Fried chicken', 'chicken fried'], ['Café', 'cafe'], ['The beach', 'beach'], ["Mom's cooking", 'moms cooking']];
  for (const [a, b] of same) assert.equal(keyOf(a!), keyOf(b!), `${a} / ${b}`);
  assert.notEqual(keyOf('ice cream'), keyOf('ice'));
});

test('plurals', () => {
  const t: [string, string][] = [['sandwiches', 'sandwich'], ['boxes', 'box'], ['cities', 'city'], ['glasses', 'glass'], ['lemons', 'lemon'], ['bus', 'bus'], ['gas', 'gas'], ['chess', 'chess'], ['analysis', 'analysis'], ['cactus', 'cactus']];
  for (const [a, b] of t) assert.equal(singular(a), b, a);
});

test('only typos merge', () => {
  assert.ok(sameAnswer('tennis', 'tenis'));
  assert.ok(sameAnswer('lemonade', 'lemonde'));
  assert.ok(!sameAnswer('lemonade', 'lemonaid'), 'two edits on a short word is a different word');
  assert.ok(sameAnswer('pepperoni', 'peperoni'));
  assert.ok(sameAnswer('mushroom', 'mushroon'));
  assert.ok(!sameAnswer('mouse', 'house'), 'short words must match exactly');
  assert.ok(!sameAnswer('plane', 'plate'));
  assert.ok(!sameAnswer('bike', 'bite'));
  assert.ok(!sameAnswer('dragon', 'wagon'), 'first letter differs');
  assert.ok(!sameAnswer('hammer', 'hanger'));
  assert.equal(distance('ab', 'ba'), 1, 'a swap is one edit');
  assert.equal(distance('kitten', 'sitting', 5), 3);
});

test('weeks and days are UTC', () => {
  const t = (s: string) => Date.parse(s);
  assert.equal(weekKey(t('2026-10-15T12:00:00Z')), '2026-W42');
  assert.equal(weekKey(t('2026-10-11T23:59:59Z')), '2026-W41');
  assert.equal(weekKey(t('2027-01-01T00:00:00Z')), '2026-W53');
  assert.equal(weekEnd(t('2026-10-15T12:00:00Z')), t('2026-10-19T00:00:00Z'));
  assert.equal(dayKey(t('2026-10-15T23:59:59Z')), '2026-10-15');
});

test('question library', () => {
  const all = CATEGORIES.flatMap((c) => QUESTIONS[c]);
  assert.ok(all.length >= 150, `library has ${all.length} questions`);
  assert.equal(new Set(all).size, all.length, 'no duplicates');
  assert.ok(all.every((q) => q.startsWith('Name ') && q.endsWith('.')), 'every question has the same shape');
  assert.ok(all.every((q) => q.length < 90));
  const used = new Map<string, number>();
  assert.deepEqual(pickQuestion({ custom: ['Name a custom thing.'], category: 'food', used }), { q: 'Name a custom thing.', custom: true });
  used.set('Name a custom thing.', 1);
  assert.equal(pickQuestion({ custom: ['Name a custom thing.'], category: 'food', used }).q, QUESTIONS.food[0]);
  QUESTIONS.food.forEach((q, i) => used.set(q, 2 + i));
  assert.equal(pickQuestion({ custom: [], category: 'food', used }).q, QUESTIONS.general[0], 'falls back to general');
  QUESTIONS.general.forEach((q, i) => used.set(q, 100 + i));
  assert.equal(pickQuestion({ custom: [], category: 'food', used }).q, QUESTIONS.food[0], 'when everything was used, the longest unused comes back first');
});
