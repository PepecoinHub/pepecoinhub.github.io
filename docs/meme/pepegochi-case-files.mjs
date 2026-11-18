// Public client for the private quest. Only current step text comes from the authenticated RPC.
const integer = (n, low, high) => Number.isInteger(n) && n >= low && n <= high;
const content = (s, max) => typeof s === 'string' && s.trim().length > 0 && s.length <= max;
export function caseView(raw) {
  if (raw?.status === 'closed') return { status: 'closed' };
  if (!raw || !content(raw.title, 120) || !integer(raw.total, 3, 12) || !integer(raw.completed, 0, raw.total)) return null;
  const common = { status: raw.status, title: raw.title, completed: raw.completed, total: raw.total };
  if (raw.status === 'complete' && raw.completed === raw.total && content(raw.message, 16000) && content(raw.credit, 120))
    return { ...common, message: raw.message, credit: raw.credit };
  if (raw.status !== 'active' || raw.completed === raw.total || raw.step !== raw.completed + 1 || !content(raw.intro, 2000) ||
      !content(raw.step_title, 120) || !content(raw.clue, 4000) || !integer(raw.retry_after, 0, 900)) return null;
  return { ...common, step: raw.step, intro: raw.intro, stepTitle: raw.step_title, clue: raw.clue,
    hint: content(raw.hint, 2000) ? raw.hint : null, retryAfter: raw.retry_after };
}
export function validCaseAnswer(answer) {
  return typeof answer === 'string' && answer.length <= 80 && /^[A-Za-z0-9\s.,:;!?_\-/'()+]+$/.test(answer) &&
    answer.replace(/[^A-Za-z0-9]/g, '').length >= 3;
}
const OUTCOMES = new Set(['correct','wrong','rate_limited','stale','invalid','closed']);

export function createCaseClient({ session, rpc }) {
  let generation = 0;
  const owner = () => { const s = session(); return s?.discord && s.userId ? s.userId : null; };
  const invalidate = () => { generation++; };
  async function request(name, args, answer = false) {
    const id = owner(), ticket = generation;
    if (!id) return { status: 'signed-out' };
    try {
      const data = await rpc(name, args);
      if (owner() !== id || ticket !== generation) return { status: 'stale' };
      const view = caseView(answer ? data?.state : data);
      if (!view || (answer && !OUTCOMES.has(data?.outcome))) return { status: 'unavailable' };
      return { status: 'ok', view, outcome: answer ? data.outcome : null };
    } catch { return { status: owner() === id && ticket === generation ? 'unavailable' : 'stale' }; }
  }
  return {
    invalidate,
    read: (hint = false) => request('gry_pond_case_state', { p_hint: hint === true }),
    answer: (step, answer, id) => validCaseAnswer(answer) && integer(step, 1, 12) && typeof id === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)
      ? request('gry_pond_case_answer', { p_step: step, p_answer: answer, p_request: id }, true) : Promise.resolve({ status: 'invalid' }),
  };
}
