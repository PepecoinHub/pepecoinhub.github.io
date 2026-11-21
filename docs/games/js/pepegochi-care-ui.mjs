// Presentation only. Each server-provided action stays paired with its actual need.
export function renderCarePanel(doc, pet, { busy = false, testShortcut = false } = {}) {
  const el = (tag, attrs = {}, text = null) => {
    const n = doc.createElement(tag);
    for (const [k,v] of Object.entries(attrs)) if (v != null && v !== false) n.setAttribute(k, v === true ? '' : v);
    if (text != null) n.textContent = text;
    return n;
  };
  const panel = el('div', { class: 'pgb-actions', role: 'group', 'aria-label': 'Needs and care actions' });
  for (const a of pet.actions) {
    const n = pet.needs.find(n => n.kind === a.kind);
    const tile = el('div', { class: 'pgb-care-tile' });
    if (n) {
      const stats = el('div', { class: 'pgb-need' + (n.overdue ? ' is-overdue' : '') + (n.low ? ' is-low' : '') });
      const bar = el('meter', { min: 0, max: 100, low: 40, high: 90, optimum: 100, 'aria-label': n.label });
      bar.value = n.value;
      stats.append(el('span', { class: 'pgb-need-name' }, n.label), el('b', {}, String(n.value)), bar);
      if (n.note) stats.append(el('small', { class: 'pgb-need-note' }, n.note));
      tile.append(stats);
    }
    const btn = el('button', { type: 'button', class: 'btn', 'data-act': a.kind, disabled: busy || !a.enabled,
      title: a.reason || a.label });
    btn.append(el('span', { class: 'pgb-action-label' }, a.label),
      el('span', { class: 'pgb-action-detail' }, a.reason || (busy ? 'Please wait…' : 'Ready')));
    tile.append(btn); panel.append(tile);
  }
  if (testShortcut) panel.append(el('button', { type: 'button', class: 'btn', 'data-all': '1' }, 'Everything it needs (test shortcut)'));
  const g = pet.goodDays;
  const good = el('div', { class: 'pgb-good' });
  const count = el('div', { class: 'pgb-good-header' });
  count.append(el('b', {}, `Good care days: ${g.count} / ${g.goal}`), el('span', {}, 'Good Parent'));
  const progress = el('progress', { max: g.goal, 'aria-label': 'Good care days' });
  progress.value = Math.min(g.count, g.goal);
  const today = el('div', { class: 'pgb-good-footer' });
  today.append(el('span', { class: 'pgb-good-today' + (g.today ? ' is-good' : '') }, g.text),
    el('span', { class: 'pgb-streak' }, `Streak: ${g.streak} · Best: ${g.best}`));
  good.append(count, progress, today);
  if (g.blockers.length) {
    const list = el('ul', { class: 'pgb-list' });
    g.blockers.forEach(x => list.append(el('li', {}, x)));
    good.append(el('p', { class: 'small' }, 'Still missing for a good care day:'), list);
  }
  return [panel, good];
}
