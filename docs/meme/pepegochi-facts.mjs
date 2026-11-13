// Pond Quiz helpers for the PepeGochi taskbar frog (pepegochi-taskbar.mjs). No questions here: they live only in
// Supabase (games/supabase/update_pond_quiz.sql) and the browser gets today's question from the server.

export const DAY_MS = 86400000;
export const dayNumber = (t = Date.now()) => Math.floor(t / DAY_MS);   // UTC day

// a short line from the frog after an answer (owner can edit these)
export const REMARKS = {
  right: ['Big brain frog.', 'Correct! You read the site, fren.', 'Ribbit. That is right.', 'You knew that one.',
    'Nice. Tomorrow I bring a harder one.'],
  wrong: ['Not quite. The frog forgives you.', 'Close. Tomorrow is another fact.', 'Ribbit… no. But now you know.',
    'Wrong, but you learned something.', 'Oops. Even frogs miss sometimes.'],
};
export const remark = (right, day = dayNumber()) => { const l = REMARKS[right ? 'right' : 'wrong']; return l[((day % l.length) + l.length) % l.length]; };
