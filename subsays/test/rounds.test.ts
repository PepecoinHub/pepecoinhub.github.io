import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dailyTick, finalBoard, getState, hideAnswer, openRound, setPost, submitAnswers, submitGuesses, suggest } from '../src/server/rounds.js';
import { FakeKV } from './fake-kv.js';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 15, 15, 0, 0);
const opts = { sub: 'test', theme: 'classic' as const, sponsorNote: '' };

const newRound = (kv: FakeKV, now = T0, extra: Partial<Parameters<typeof openRound>[1]> = {}) =>
  openRound(kv, { q: 'Name a pizza topping.', now, intervalMs: DAY, minPlayers: 5, cap: 'auto', ...extra });
const ans = (kv: FakeKV, uid: string | undefined, answers: unknown, n = 1, now = T0 + 1000) => submitAnswers(kv, { uid, name: uid ? `name_${uid}` : undefined, n, answers, now });
const gs = (kv: FakeKV, uid: string | undefined, guesses: unknown, n = 1, now = T0 + DAY + 1000) =>
  submitGuesses(kv, { uid, name: uid ? `name_${uid}` : undefined, n, guesses, now, sub: 'test' });
const state = (kv: FakeKV, uid?: string, now = T0 + DAY + 1000, postId?: string) => getState(kv, { ...opts, uid, name: uid ? `name_${uid}` : undefined, now, postId });

/** 20 players: pepperoni 10, mushrooms 8, cheese 6, pineapple 4, olives 3, anchovies 2, plus three one-offs. */
async function survey(kv: FakeKV) {
  const per: string[][] = Array.from({ length: 20 }, () => []);
  const give = (word: string, users: number[]) => users.forEach((u) => per[u]!.push(word));
  give('Pepperoni', [0, 1, 2, 3, 4, 5]);
  give('peperoni', [6, 7]); // typo
  give('Pepperonis', [8]); // plural
  give('pepperoni', [9]);
  give('Mushrooms', [0, 1, 2, 3]);
  give('mushroom', [4, 5, 6, 7]);
  give('cheese', [2, 3, 4, 5, 6, 7]);
  give('pineapple', [8, 9, 10, 11]);
  give('olives', [12, 13, 14]);
  give('anchovies', [15, 16]);
  give('Spinach', [17]);
  give('Basil', [18]);
  give('Corn', [19]);
  for (let u = 0; u < 20; u++) assert.ok((await ans(kv, `u${u}`, per[u]!.slice(0, 3))).ok, `u${u}`);
}

test('a round from first answer to final board', async () => {
  const kv = new FakeKV();
  assert.equal(await newRound(kv), 1);
  await survey(kv);

  // While collecting there is nothing to guess yet.
  assert.deepEqual(await gs(kv, 'g1', ['pepperoni'], 1, T0 + 5000), { ok: false, error: 'closed' });
  assert.deepEqual(await ans(kv, 'u0', ['Anything']), { ok: false, error: 'already' });
  assert.deepEqual(await ans(kv, 'late', ['Pepperoni'], 1, T0 + DAY + 1), { ok: false, error: 'closed' }, 'collection ends after the interval');
  assert.deepEqual(await ans(kv, 'x', ['fucking pizza']), { ok: false, error: 'invalid' });
  assert.deepEqual(await ans(kv, undefined, ['pizza']), { ok: false, error: 'login' });

  const archive = await finalBoard(kv, 1, T0 + 2 * DAY + 1);
  assert.deepEqual(archive?.board.map((b) => [b.text, b.count, b.pct]), [['Pepperoni', 10, 50], ['Mushrooms', 8, 40], ['Cheese', 6, 30], ['Pineapple', 4, 20], ['Olives', 3, 15]], 'anchovies (2 people) and one-offs stay off the board');
  assert.equal(archive?.respondents, 20);

  // The board stays hidden until a player has guessed.
  const before = await state(kv, 'g1');
  assert.equal(before.guess?.status, 'open');
  assert.equal(before.guess?.boardSize, 5);
  assert.equal(before.guess?.board, undefined);
  assert.equal(before.collect, undefined, 'nothing is collecting once the only round moved on');

  const r1 = await gs(kv, 'g1', ['pepperoni', 'Mushroom', 'pineapples']);
  assert.ok(r1.ok);
  if (r1.ok) {
    assert.deepEqual(r1.result.guesses.map((g) => [g.mark, g.points]), [['top', 50], ['board', 40], ['board', 20]]);
    assert.equal(r1.result.points, 110);
    assert.equal(r1.board.length, 5);
    assert.equal(r1.shareText, 'Sub Says #1 · r/test\n🟩🟨🟨 110 pts');
  }
  assert.deepEqual(await gs(kv, 'g1', ['olives']), { ok: false, error: 'already' });

  const r2 = await gs(kv, 'g2', ['anchovies', 'pepperoni', 'peperoni']);
  assert.ok(r2.ok && r2.result.points === 50);
  if (r2.ok) assert.deepEqual(r2.result.guesses.map((g) => g.mark), ['miss', 'top', 'miss'], 'two spellings of one answer score once');
  const r3 = await gs(kv, 'g3', ['olive', 'Tenis', 'Cheeses']);
  assert.ok(r3.ok && r3.result.points === 15 + 30);

  const after = await state(kv, 'g1');
  assert.equal(after.guess?.mine?.points, 110);
  assert.equal(after.guess?.board?.length, 5, 'the board shows once you have guessed');
  assert.equal((await state(kv, 'g9')).guess?.board, undefined);

  // Weekly points: guesses plus 5 for answering.
  assert.deepEqual(after.weekly[0], { name: 'name_g1', points: 110 });
  assert.equal(after.me.weekPoints, 110);
  assert.equal(after.me.weekRank, 1);
  assert.equal((await state(kv, 'u0')).me.weekPoints, 5);

  assert.deepEqual(await gs(kv, 'late', ['pepperoni'], 1, T0 + 2 * DAY + 1), { ok: false, error: 'closed' }, 'guessing ends after a second interval');
});

test('too few people: no board, and the player is told', async () => {
  const kv = new FakeKV();
  await newRound(kv);
  for (let u = 0; u < 4; u++) await ans(kv, `u${u}`, ['pizza', 'tacos', 'sushi']);
  const s = await state(kv, 'g1');
  assert.equal(s.guess?.status, 'void');
  assert.match(s.guess?.voidReason ?? '', /Not enough people/);
  assert.deepEqual(await gs(kv, 'g1', ['pizza']), { ok: false, error: 'void' });
  assert.equal(s.archive, undefined);
  assert.equal((await state(kv, 'g1', T0 + 2 * DAY + 5)).archive?.status, 'void');
});

test('scattered answers: no board either', async () => {
  const kv = new FakeKV();
  await newRound(kv);
  for (let u = 0; u < 10; u++) await ans(kv, `u${u}`, [`thing${'abcdefghij'[u]}one`, `item${'klmnopqrst'[u]}two`]);
  const s = await state(kv, 'g1');
  assert.equal(s.guess?.status, 'void');
  assert.match(s.guess?.voidReason ?? '', /too scattered/);
});

test('board size follows the number of people, not the size of the sub', async () => {
  const words = ['apple', 'banana', 'cherry', 'dragonfruit', 'elderberry', 'fig', 'grape', 'honeydew', 'kiwi', 'lemon'];
  for (const [people, expected] of [[199, 5], [200, 8]] as const) {
    const kv = new FakeKV();
    await newRound(kv);
    await Promise.all(Array.from({ length: people }, (_, i) => ans(kv, `u${i}`, [words[i % 10], words[(i + 3) % 10], words[(i + 7) % 10]])));
    const board = await finalBoard(kv, 1, T0 + DAY + 1);
    assert.equal(board?.board.length, expected, `${people} people`);
  }
  const kv = new FakeKV();
  await newRound(kv, T0, { cap: '5' });
  await Promise.all(Array.from({ length: 200 }, (_, i) => ans(kv, `u${i}`, [words[i % 10], words[(i + 3) % 10], words[(i + 7) % 10]])));
  assert.equal((await finalBoard(kv, 1, T0 + DAY + 1))?.board.length, 5, 'a moderator can force 5');
});

test('thirty people typing the same new answer at once make one cluster', async () => {
  const kv = new FakeKV();
  await newRound(kv);
  await Promise.all(Array.from({ length: 30 }, (_, i) => ans(kv, `u${i}`, ['Pizza', 'Burgers', 'Tacos'])));
  const board = await finalBoard(kv, 1, T0 + DAY + 1);
  assert.deepEqual(board?.board.map((b) => [b.text, b.count, b.pct]), [['Burgers', 30, 100], ['Pizza', 30, 100], ['Tacos', 30, 100]]);
  const clusters = new Set(kv.hashes.get('ss:r:1:ck')?.values());
  assert.equal(clusters.size, 3);
});

test('streaks count days in a row', async () => {
  const kv = new FakeKV();
  await newRound(kv, T0);
  await newRound(kv, T0 + DAY);
  await newRound(kv, T0 + 3 * DAY);
  const a = await ans(kv, 'u', ['pizza'], 1, T0 + 1000);
  assert.ok(a.ok && a.streak === 1);
  const b = await ans(kv, 'u', ['pizza'], 2, T0 + DAY + 1000);
  assert.ok(b.ok && b.streak === 2);
  assert.equal((await state(kv, 'u', T0 + DAY + 2000)).me.streak, 2);
  assert.equal((await state(kv, 'u', T0 + 2 * DAY + 2000)).me.streak, 2, 'still alive the day after');
  assert.equal((await state(kv, 'u', T0 + 3 * DAY + 2000)).me.streak, 0, 'missed a day');
  const c = await ans(kv, 'u', ['pizza'], 3, T0 + 3 * DAY + 1000);
  assert.ok(c.ok && c.streak === 1);
});

test('a moderator can hide an answer before or after the board is made', async () => {
  const kv = new FakeKV();
  await newRound(kv);
  await survey(kv);
  assert.deepEqual(await hideAnswer(kv, 'mushrooms', T0 + 5000), { ok: true, hidden: 1 });
  assert.deepEqual((await finalBoard(kv, 1, T0 + DAY + 1))?.board.map((b) => b.text), ['Pepperoni', 'Cheese', 'Pineapple', 'Olives']);
  assert.deepEqual(await hideAnswer(kv, 'cheez', T0 + DAY + 100), { ok: false, hidden: 0 }, 'short words do not fuzzy match');
  assert.deepEqual(await hideAnswer(kv, 'cheese', T0 + DAY + 100), { ok: true, hidden: 1 });
  assert.deepEqual((await finalBoard(kv, 1, T0 + DAY + 200))?.board.map((b) => b.text), ['Pepperoni', 'Pineapple', 'Olives']);
  assert.deepEqual(await hideAnswer(kv, 'nonsense nobody said', T0 + DAY + 100), { ok: false, hidden: 0 });
});

test('suggestions never reveal counts and respect hidden answers', async () => {
  const kv = new FakeKV();
  await newRound(kv);
  await survey(kv);
  assert.deepEqual(await suggest(kv, 'pep', T0 + 5000), ['Pepperoni']);
  assert.deepEqual(await suggest(kv, 'm', T0 + 5000), [], 'one letter is not enough');
  assert.deepEqual(await suggest(kv, 'PINE', T0 + 5000), ['Pineapple']);
  await hideAnswer(kv, 'pineapple', T0 + 6000);
  assert.deepEqual(await suggest(kv, 'pine', T0 + 7000), []);
  assert.deepEqual(await suggest(kv, 'pep', T0 + DAY + 5), [], 'nothing to suggest once collection is over');
});

test('the daily tick says when a round is due and announces each ending once', async () => {
  const kv = new FakeKV();
  assert.deepEqual(await dailyTick(kv, T0, DAY), { due: true, finished: [] });
  await newRound(kv);
  assert.equal((await dailyTick(kv, T0 + 3_600_000, DAY)).due, false);
  assert.equal((await dailyTick(kv, T0 + 23 * 3_600_000, DAY)).due, true, 'a late job still opens the next round');
  await survey(kv);
  assert.deepEqual((await dailyTick(kv, T0 + 2 * DAY + 5, DAY)).finished, [1]);
  assert.deepEqual((await dailyTick(kv, T0 + 2 * DAY + 6, DAY)).finished, [], 'no duplicate announcement');
});

test('an old post shows its own finished round', async () => {
  const kv = new FakeKV();
  await newRound(kv, T0);
  await setPost(kv, 1, 't3_one');
  await survey(kv);
  await newRound(kv, T0 + DAY, { q: 'Name a color.' });
  await setPost(kv, 2, 't3_two');
  await newRound(kv, T0 + 2 * DAY, { q: 'Name a pet.' });
  const now = T0 + 2 * DAY + 5000;
  const s = await state(kv, 'u0', now, 't3_one');
  assert.equal(s.archive?.n, 1);
  assert.equal(s.archive?.question, 'Name a pizza topping.');
  assert.equal(s.collect?.n, 3);
  assert.equal(s.collect?.question, 'Name a pet.');
  assert.equal(s.guess?.n, 2);
});

test('a player who is not logged in can look but not play', async () => {
  const kv = new FakeKV();
  await newRound(kv);
  const s = await state(kv, undefined, T0 + 1000);
  assert.equal(s.me.loggedIn, false);
  assert.equal(s.collect?.answered, false);
  assert.deepEqual(await ans(kv, undefined, ['pizza']), { ok: false, error: 'login' });
});
