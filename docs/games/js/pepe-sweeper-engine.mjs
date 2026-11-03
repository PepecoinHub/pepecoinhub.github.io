export const LEVELS = Object.freeze({
  easy: { name: 'New Frog', cols: 9, rows: 9, mines: 10 },
  medium: { name: 'Pond Regular', cols: 16, rows: 16, mines: 40 },
  hard: { name: 'Diamond Hands', cols: 30, rows: 16, mines: 99 }
});

export function neighbors(g, index) {
  const x = index % g.cols, y = Math.floor(index / g.cols), result = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < g.cols && ny < g.rows) result.push(ny * g.cols + nx);
  }
  return result;
}

export function newGame(level = 'easy') {
  if (!LEVELS[level]) throw new RangeError('Unknown difficulty');
  const { cols, rows, mines } = LEVELS[level];
  return { level, cols, rows, mines, cells: Array.from({ length: cols * rows }, () => ({ mine: false, nearby: 0, open: false, flag: false, exploded: false })),
    status: 'ready', flags: 0, opened: 0, seeded: false };
}

export function placeMines(g, first, random = Math.random) {
  if (g.seeded || first < 0 || first >= g.cells.length) return;
  const safe = new Set([first, ...neighbors(g, first)]);
  const choices = g.cells.map((_, i) => i).filter(i => !safe.has(i));
  if (choices.length < g.mines) throw new RangeError('Board cannot fit mines');
  for (let i = 0; i < g.mines; i++) {
    const value = random(), n = i + Math.min(choices.length - i - 1, Math.floor(Math.max(0, Math.min(.999999999, value)) * (choices.length - i)));
    [choices[i], choices[n]] = [choices[n], choices[i]];
    g.cells[choices[i]].mine = true;
  }
  for (let i = 0; i < g.cells.length; i++) if (g.cells[i].mine) {
    for (const n of neighbors(g, i)) g.cells[n].nearby++;
  }
  g.seeded = true;
  g.status = 'playing';
}

function finishIfWon(g) {
  if (g.opened !== g.cells.length - g.mines) return;
  g.status = 'won';
  for (const cell of g.cells) if (cell.mine && !cell.flag) { cell.flag = true; g.flags++; }
}

export function reveal(g, index, random = Math.random) {
  if (index < 0 || index >= g.cells.length || g.status === 'won' || g.status === 'lost') return false;
  const first = g.cells[index];
  if (first.open || first.flag) return false;
  if (!g.seeded) placeMines(g, index, random);
  if (first.mine) {
    first.open = true; first.exploded = true; g.status = 'lost';
    return true;
  }
  const queue = [index];
  for (let at = 0; at < queue.length; at++) {
    const i = queue[at], cell = g.cells[i];
    if (cell.open || cell.flag || cell.mine) continue;
    cell.open = true; g.opened++;
    if (cell.nearby === 0) for (const n of neighbors(g, i)) if (!g.cells[n].open && !g.cells[n].flag && !g.cells[n].mine) queue.push(n);
  }
  finishIfWon(g);
  return true;
}

export function toggleFlag(g, index) {
  if (index < 0 || index >= g.cells.length || g.status === 'won' || g.status === 'lost') return false;
  const cell = g.cells[index];
  if (cell.open) return false;
  cell.flag = !cell.flag; g.flags += cell.flag ? 1 : -1;
  return true;
}

export function chord(g, index, random = Math.random) {
  if (g.status !== 'playing' || index < 0 || index >= g.cells.length) return false;
  const cell = g.cells[index];
  if (!cell.open || !cell.nearby) return false;
  const around = neighbors(g, index);
  if (around.filter(i => g.cells[i].flag).length !== cell.nearby) return false;
  let changed = false;
  for (const i of around) {
    if (g.status === 'lost') break;
    if (reveal(g, i, random)) changed = true;
  }
  return changed;
}
