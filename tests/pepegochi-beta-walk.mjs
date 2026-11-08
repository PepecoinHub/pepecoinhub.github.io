// The PepeGochi beta checklist, played through the window's own logic (docs/games/js/pepegochi-beta-view.mjs).
// Used by tests/pepegochi-beta.test.mjs (CI) and tests/pepegochi-parity.test.mjs (the same calls on the SQL).
// Not a test file itself.
const H = 36e5, D = 24 * H;

// moves the game's clock to `day` days after the start, at hh:mm UTC
const at = (g, day, hh, mm = 0) => {
  const t = new Date(g.start + day * D); t.setUTCHours(hh, mm, 0, 0);
  if (t.getTime() < g.now) throw new Error('walk: that moment is in the past');
  g.advance(t.getTime() - g.now);
};

export function walk(g) {
  const v = {};
  v.start = g.view();
  g.adopt('Fren'); v.adopted = g.view();
  g.careAll(); v.cared = g.view();
  for (let d = 1; d <= 3; d++) { at(g, d, 18); g.careAll(); }
  at(g, 6, 12); v.neglected = g.view();
  at(g, 9, 20); v.packing = g.view();
  g.act('feed'); v.fedOnly = g.view();
  g.advance(2 * 6e4); g.careAll(); v.rescued = g.view();
  g.advance(5 * H); g.careAll(); v.early = g.view();
  at(g, 10, 6); g.careAll(); v.recovered = g.view();
  g.advance(9 * D); v.departed = g.view();
  g.adopt('Fren II'); v.adoptTooSoon = g.view();
  g.readLetter(); v.letter = g.view();
  g.adopt('Fren II'); v.readopted = g.view();
  g.careAll(); v.end = g.view();
  return v;
}
