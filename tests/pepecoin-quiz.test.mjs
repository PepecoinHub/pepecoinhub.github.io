// docs/data/pepecoin-quiz.json: the Pepecoin quiz questions for PondOS (PepeGochi taskbar facts, later a quiz).
// Every question has four different answers, one right one, and a PepecoinHub page that has the answer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const data = JSON.parse(readFileSync(new URL('../docs/data/pepecoin-quiz.json', import.meta.url), 'utf8'));
const qs = data.questions;

test('the bank: 99 Three Facts questions plus the extra ones, unique ids and questions', () => {
  assert.equal(qs.filter(q => q.set === 'three_facts').length, 99);
  assert.ok(qs.filter(q => q.set === 'quiz_extra').length > 0);
  assert.equal(new Set(qs.map(q => q.id)).size, qs.length);
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  assert.equal(new Set(qs.map(q => norm(q.question))).size, qs.length, 'no question twice');
});

test('every question: four different answers, a valid right answer, difficulty 1-3', () => {
  for (const q of qs) {
    assert.ok(q.question.trim().length > 8, q.id);
    assert.equal(q.answers.length, 4, q.id);
    assert.equal(new Set(q.answers.map(a => a.trim().toLowerCase())).size, 4, q.id + ': answers differ');
    assert.ok(Number.isInteger(q.correct) && q.correct >= 0 && q.correct < 4, q.id);
    assert.ok([1, 2, 3].includes(q.difficulty), q.id);
    assert.equal(typeof q.dated, 'boolean', q.id);
  }
});

test('sources: a page of this site that exists (only the Tangem sales question has none yet)', () => {
  const missing = qs.filter(q => !q.source).map(q => q.id);
  assert.deepEqual(missing, ['tf97']);
  for (const q of qs.filter(q => q.source)) {
    const m = /^https:\/\/pepecoinhub\.com\/([a-z-]*\.html)?$/.exec(q.source);
    assert.ok(m, q.id + ': ' + q.source);
    assert.ok(existsSync(new URL('../docs/' + (m[1] || 'index.html'), import.meta.url)), q.id + ': ' + q.source);
  }
});
