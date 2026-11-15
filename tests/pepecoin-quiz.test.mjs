// Pond Quiz questions: the real questions and answers are NOT in this public repo (they live only in Supabase).
// These tests check the generator and its checks on a made-up sample (tests/fixtures/pond-quiz-sample.json),
// and that no questions file is published with the site.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { validate, buildSql, isActive, OUT } from '../scripts/build_pond_quiz_sql.mjs';

const sample = JSON.parse(readFileSync(new URL('./fixtures/pond-quiz-sample.json', import.meta.url), 'utf8')).questions;

test('no questions file in the repo or on the site; the private output folder is git-ignored', () => {
  assert.equal(existsSync(new URL('../docs/data/pepecoin-quiz.json', import.meta.url)), false);
  for (const f of readdirSync(new URL('../docs/data/', import.meta.url))) assert.doesNotMatch(f, /quiz/i, f);
  const ignore = readFileSync(new URL('../.gitignore', import.meta.url), 'utf8');
  assert.match(ignore, /^games\/supabase\/private\/$/m);
  assert.match(OUT, /^games\/supabase\/private\//);
});

test('the checks: the sample passes, every kind of mistake is named', () => {
  assert.deepEqual(validate(sample), []);
  const one = (change) => validate([{ ...sample[0], ...change }]).join(' | ');
  assert.match(one({ id: 'Bad Id' }), /id must be/);
  assert.match(one({ answers: ['a', 'b', 'c'] }), /needs 4 answers/);
  assert.match(one({ answers: ['a', 'b', 'c', 'A'] }), /two answers are the same/);
  assert.match(one({ correct: 4 }), /correct must be 0-3/);
  assert.match(one({ source: 'https://example.com/' }), /source must be a pepecoinhub\.com page/);
  assert.match(one({ dated: 'no' }), /dated must be true or false/);
  assert.match(validate([sample[0], sample[0]]).join(), /the same id twice/);
  assert.deepEqual(validate([]), ['no questions']);
});

test('the SQL: quotes escaped, only questions with a source and no date are asked, removed ones switched off', () => {
  const sql = buildSql(sample);
  assert.match(sql, /'Sample question four, with a ''quote''\?'/);
  assert.deepEqual(sample.filter(isActive).map(q => q.id), ['s01', 's02', 's03', 's04']);
  assert.match(sql, /\('s05', [^\n]*, false\)/);
  assert.match(sql, /\('s06', [^\n]*null, false\)/);
  assert.match(sql, /update games\.quiz_questions set active = false\n  where id not in \('s01', 's02', 's03', 's04', 's05', 's06'\)/);
  assert.match(sql, /PRIVATE/);
});
