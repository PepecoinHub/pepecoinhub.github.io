// Cosmetic observations only. Never awards, verified records or account state.
export function createCompanionReporter(game, win = window) {
  let run = null;
  const send = phase => {
    if (win.parent === win || !run) return;
    win.parent.postMessage({ type: 'pondos:arcade-round', game, run: run.id, ...phase }, win.location.origin);
  };
  return {
    start() { run = { id: win.crypto.randomUUID() }; send({ phase: 'start' }); },
    finish(outcome, record = false) { if (!run) return; send({ phase: 'finish', outcome, record: record === true }); run = null; },
  };
}
