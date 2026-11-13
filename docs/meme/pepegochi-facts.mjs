// PepeGochi's fact of the day: one Pepecoin quiz question a day from docs/data/pepecoin-quiz.json, asked by the
// frog on the PondOS taskbar. Pure logic, no DOM, so tests can run it.
//
// - The same question for everyone on a UTC day, in a fixed shuffled order, so nobody gets a repeat until the whole
//   list has been asked. No server: nothing to cheat and nothing to win, it is a fact, not a contest.
// - Only questions with a PepecoinHub page as their source, and none whose answer depends on a date.
// - The answers are shuffled per day (in the data the right one is often the first).
// - The browser remembers only today's answer, so the "?" goes away until tomorrow.

export const SEED = 20261113;
export const STORE_KEY = 'pondos-gochi-fact';
export const DAY_MS = 86400000;

// small deterministic random numbers (mulberry32)
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(list, seed) {
  const a = list.slice(), r = rng(seed);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export const dayNumber = (t = Date.now()) => Math.floor(t / DAY_MS);   // UTC day

export const usable = questions => (questions || []).filter(q => q && q.source && !q.dated
  && Array.isArray(q.answers) && q.answers.length === 4 && Number.isInteger(q.correct) && q.correct >= 0 && q.correct < 4);

// The question of a UTC day, with its answers in that day's order and the index of the right one.
export function factOfDay(questions, day = dayNumber()) {
  const list = usable(questions);
  if (!list.length) return null;
  const order = shuffle(list.map((_, i) => i), SEED);
  const n = list.length, round = Math.floor(day / n), q = list[order[((day % n) + n) % n]];
  const perm = shuffle([0, 1, 2, 3], SEED ^ (day * 7919) ^ round);
  return {
    day, id: q.id, question: q.question, source: q.source,
    answers: perm.map(i => q.answers[i]), correct: perm.indexOf(q.correct),
  };
}

// a short line from the frog after an answer (owner can edit these)
export const REMARKS = {
  right: ['Big brain frog.', 'Correct! You read the site, fren.', 'Ribbit. That is right.', 'You knew that one.',
    'Nice. Tomorrow I bring a harder one.'],
  wrong: ['Not quite. The frog forgives you.', 'Close. Tomorrow is another fact.', 'Ribbit… no. But now you know.',
    'Wrong, but you learned something.', 'Oops. Even frogs miss sometimes.'],
};
export const remark = (right, day = dayNumber()) => { const l = REMARKS[right ? 'right' : 'wrong']; return l[((day % l.length) + l.length) % l.length]; };

// today's saved answer: { day, picked } or null. Storage may be missing or blocked (private mode): then nothing is saved.
export function loadAnswer(storage, day = dayNumber()) {
  try {
    const v = JSON.parse(storage.getItem(STORE_KEY) || 'null');
    return v && v.day === day && Number.isInteger(v.picked) ? v : null;
  } catch (e) { return null; }
}
export function saveAnswer(storage, picked, day = dayNumber()) {
  try { storage.setItem(STORE_KEY, JSON.stringify({ day, picked })); } catch (e) { /* not saved: asked again on reload */ }
}
