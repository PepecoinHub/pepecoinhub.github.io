// PEPaint: the Paint-style chrome shared by the party lobby (pepaint.html) and the drawing room (room.html).
// A menu bar with drop-down menus, a tool box, a colour palette, a status bar and small 98-style dialogs.
// Original drawings and layout (no assets from any real paint program).
import { h } from './common.js';

// 16×16 tool pictures, drawn on a pixel grid (crisp edges)
const S = (body) => `<svg viewBox="0 0 16 16" width="16" height="16" shape-rendering="crispEdges" aria-hidden="true">${body}</svg>`;
export const TOOL_SVG = {
  select: S('<path d="M2 2h3v1H3v2H2zM7 2h2v1H7zM11 2h3v3h-1V3h-2zM2 7h1v2H2zM13 7h1v2h-1zM2 11h1v2h2v1H2zM13 11h1v3h-3v-1h2zM7 13h2v1H7z" fill="#111"/>'),
  lasso: S('<path d="M4 3h7v1h2v2h1v3h-1v1h-2v1H8v2H7v1H5v-1h1v-2H4v-1H3V9H2V5h1V4h1zm0 2v4h1v1h5V9h2V5h-1V4H5v1z" fill="#111"/>'),
  eraser: S('<path d="M9 2h2v1h1v1h1v1h1v2h-1v1h-1v1h-1v1h-1v1H9v1H8v1H4v-1H3v-1H2V9h1V8h1V7h1V6h1V5h1V4h1V3h1z" fill="#111"/><path d="M9 3h2v1h1v1h1v2h-1v1h-1v1h-1V8H9V7H8V6H7V5h1V4h1z" fill="#f19ac2"/><path d="M6 6h1v1h1v1h1v1h1v1H9v1H8v1H4v-1H3V9h1V8h1V7h1z" fill="#fff"/>'),
  bucket: S('<path d="M6 2h2v1h1v1h1v1h1v1h1v1h1v2h-1v1h-1v1h-1v1H9v1H8v1H6v-1H5v-1H4v-1H3V9H2V7h1V6h1V5h1V4h1V3h0z" fill="#111"/><path d="M6 4h2v1h1v1h1v1h1v2h-1v1H9v1H8v1H6v-1H5v-1H4V9H3V7h1V6h1V5h1z" fill="#c3c3bd"/><path d="M12 8h2v4h-1v2h-1v-1h-1v-2h1z" fill="#269B4D"/>'),
  picker: S('<path d="M11 1h3v1h1v3h-1v1h-1v1h-1v1h-1V7H9v1H8v1H7v1H6v1H5v1H4v1H3v1H1v-2h1v-1h1v-1h1v-1h1V9h1V8h1V7h1V6H8V5h1V4h1V3h1z" fill="#111"/><path d="M11 2h2v1h1v2h-1v1h-1V5h-1V4h-1V3h1z" fill="#d23c2f"/>'),
  zoom: S('<path d="M5 1h4v1h1v1h1v1h1v4h-1v1h-1v1H9v1H5v-1H4V9H3V8H2V4h1V3h1V2h1z" fill="#111"/><path d="M5 2h4v1h1v1h1v4h-1v1H9v1H5V9H4V8H3V4h1V3h1z" fill="#cde8ff"/><path d="M11 10h1v1h1v1h1v1h1v2h-2v-1h-1v-1h-1v-1h-1v-1h1z" fill="#111"/>'),
  pencil: S('<path d="M11 1h2v1h1v1h1v2h-1v1h-1v1h-1v1h-1v1H9v1H8v1H7v1H6v1H5v1H1v-4h1v-1h1V9h1V8h1V7h1V6h1V5h1V4h1V3h1V2h1z" fill="#111"/><path d="M11 2h2v1h1v2h-1V4h-1V3h-1z" fill="#f19ac2"/><path d="M10 4h1v1h1v1h-1v1h-1v1H9v1H8v1H7v1H6v1H5v-1H4V9h1V8h1V7h1V6h1V5h1V4z" fill="#f5d90a"/><path d="M2 12h1v1h1v1H2z" fill="#111"/>'),
  brush: S('<path d="M12 1h3v3h-1v1h-1v1h-1v1h-1v1h-1v1H9V8H8V7h1V6h1V5h1V4h1V3h0z" fill="#8a5a2b"/><path d="M6 8h2v1h1v2H8v1H7v1H6v1H5v1H1v-1h1v-2h1v-1h1V9h2z" fill="#111"/><path d="M6 9h2v2H7v1H6v1H5v1H3v-1h1v-2h1V9z" fill="#269B4D"/>'),
  spray: S('<path d="M8 4h4v1h1v9H7V5h1z" fill="#111"/><path d="M8 6h4v7H8z" fill="#2f6fd2"/><path d="M9 2h2v2H9zM2 2h1v1H2zM4 1h1v1H4zM5 4h1v1H5zM2 5h1v1H2zM4 7h1v1H4z" fill="#111"/>'),
  text: S('<path d="M3 2h10v4h-1V4h-1v1h0V3H9v9h2v2H5v-2h2V3H5v2H4v1H3z" fill="#111"/>'),
  line: S('<path d="M13 2h1v1h-1v1h-1v1h-1v1h-1v1H9v1H8v1H7v1H6v1H5v1H4v1H3v1H2v-1h1v-1h1v-1h1v-1h1V9h1V8h1V7h1V6h1V5h1V4h1V3h1z" fill="#111"/>'),
  curve: S('<path d="M2 12h1v-2h1V8h1V6h1V5h2v1h1v2h1v2h1v1h1V9h1V6h1v4h-1v2h-1v1h-2v-1H9v-2H8V8H7V7H6v1H5v2H4v2H3v2H2z" fill="#111"/>'),
  rect: S('<path d="M2 3h12v10H2zm1 1v8h10V4z" fill="#111"/>'),
  poly: S('<path d="M4 2h7v1h1v2h1v2h1v1h-2v2h1v3H2v-1h1V9H2V5h1V3h1zm0 2v2H3v2h1v2H3v2h9v-1h-1V8h1V7h-1V5h-1V3H5v1z" fill="#111"/>'),
  ellipse: S('<path d="M5 3h6v1h2v1h1v6h-1v1h-2v1H5v-1H3v-1H2V5h1V4h2zm0 2H4v6h1v1h6v-1h1V5h-1V4H5z" fill="#111"/>'),
  rrect: S('<path d="M4 3h8v1h1v1h1v6h-1v1h-1v1H4v-1H3v-1H2V5h1V4h1zm0 2v6h8V5z" fill="#111"/>'),
  undo: S('<path d="M6 2h1v3h4v1h2v1h1v5h-1v1h-2v1H6v-2h4v-1h1V8h-1V7H7v3H6V9H5V8H4V7H3V6h1V5h1V4h1z" fill="#111"/>'),
  trash: S('<path d="M6 1h4v1h4v2H2V2h4zM3 5h10v10H3zm2 2v6h1V7zm3 0v6h1V7zm3 0v6h1V7z" fill="#111"/>'),
  skip: S('<path d="M2 3h2v1h1v1h1v1h1v1h1v2H7v1H6v1H5v1H4v1H2zm6 0h2v1h1v1h1v1h1v1h1v2h-1v1h-1v1h-1v1h-1v1H8z" fill="#111"/>'),
};
// the decorative tool box of the lobby (2 columns, like the classic layout); every tool says what it would do
export const DECOR_TOOLS = [['lasso', 'Free-form select'], ['select', 'Select'], ['eraser', 'Eraser'], ['bucket', 'Fill with colour'],
  ['picker', 'Pick colour'], ['zoom', 'Magnifier'], ['pencil', 'Pencil'], ['brush', 'Brush'], ['spray', 'Airbrush'], ['text', 'Text'],
  ['line', 'Line'], ['curve', 'Curve'], ['rect', 'Rectangle'], ['poly', 'Polygon'], ['ellipse', 'Ellipse'], ['rrect', 'Rounded rectangle']];
// time to draw one word, in seconds (the server accepts 30 to 120 for everyone)
export const TIMES = [30, 45, 60, 80, 120];
// the 28-colour palette, two rows (the frog greens are ours)
export const PALETTE = ['#000000', '#808080', '#7f1d1d', '#808000', '#16532A', '#0b6b6b', '#1c2f8c', '#6b2a8c', '#7a6a2c', '#0d3b2a', '#1f7ab8', '#203a6b', '#5b2bd6', '#8a5a2b',
  '#ffffff', '#c3c3bd', '#d23c2f', '#f5d90a', '#269B4D', '#3fd0c9', '#2f6fd2', '#f19ac2', '#f2e3a0', '#9ee26b', '#a6dcff', '#9aa3ff', '#ff4fa6', '#f2a33a'];

// Menu bar: [['File', [['New room…', fn, {key:'Ctrl+N'}], '-', ...]], ...]. Alt or F10 is not needed: click or tap.
export function menuBar(spec) {
  const bar = h('div', { class: 'pt-menu', role: 'menubar' });
  let open = null;
  const close = () => { if (!open) return; open.btn.setAttribute('aria-expanded', 'false'); open.list.hidden = true; open = null; };
  for (const [label, items] of spec) {
    const wrap = h('div', { class: 'pt-mi' });
    const btn = h('button', { type: 'button', role: 'menuitem', 'aria-haspopup': 'true', 'aria-expanded': 'false' }, h('u', {}, label[0]), label.slice(1));
    const list = h('div', { class: 'pt-drop', role: 'menu', hidden: true });
    const fill = () => {
      list.textContent = '';
      for (const it of typeof items === 'function' ? items() : items) {
        if (it === '-') { list.append(h('hr')); continue; }
        const [text, fn, o = {}] = it;
        list.append(h('button', { type: 'button', role: 'menuitem', disabled: !!o.disabled, onclick: () => { close(); fn(); } },
          h('span', {}, text), o.key ? h('kbd', {}, o.key) : null));
      }
    };
    const show = () => { close(); fill(); list.hidden = false; btn.setAttribute('aria-expanded', 'true'); open = { btn, list }; list.querySelector('button:not([disabled])')?.focus({ preventScroll: true }); };
    btn.addEventListener('click', (e) => { e.stopPropagation(); if (open?.btn === btn) close(); else show(); });
    btn.addEventListener('mouseenter', () => { if (open && open.btn !== btn) show(); });
    list.addEventListener('keydown', (e) => {
      const all = [...list.querySelectorAll('button:not([disabled])')], i = all.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); all[(i + 1) % all.length]?.focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); all[(i - 1 + all.length) % all.length]?.focus(); }
      else if (e.key === 'Escape') { close(); btn.focus(); }
    });
    wrap.append(btn, list); bar.append(wrap);
  }
  document.addEventListener('click', (e) => { if (!e.target.closest('.pt-menu')) close(); });
  return bar;
}

// Status bar: a hint on the left, then fixed-width panes (like the classic one); set(i, text)
export function statusBar(n = 3) {
  const el = h('div', { class: 'pt-status', role: 'status' });
  const panes = Array.from({ length: n }, (_, i) => h('span', { class: i ? 'pt-pane' : 'pt-hint' }));
  el.append(...panes);
  return { el, set: (i, t) => { panes[i].textContent = t; } };
}

// A small 98 dialog in the middle of the page. body: element(s). buttons: [[label, fn(close) | null, {primary}], ...]
export function dialog(title, body, buttons = [['OK', null, { primary: true }]], { wide = false } = {}) {
  const back = h('div', { class: 'pt-dlg-back' });
  const box = h('div', { class: 'pt-dlg' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
  const close = () => { back.remove(); document.removeEventListener('keydown', esc); };
  const esc = (e) => { if (e.key === 'Escape') close(); };
  box.append(h('div', { class: 'pt-dlg-bar' }, h('span', {}, title), h('button', { type: 'button', class: 'pt-dlg-x', 'aria-label': 'Close', onclick: close }, '×')),
    h('div', { class: 'pt-dlg-body' }, body),
    buttons.length ? h('div', { class: 'pt-dlg-btns' }, buttons.map(([label, fn, o = {}]) => h('button', { type: o.submit ? 'submit' : 'button', class: 'pt-btn' + (o.primary ? ' primary' : ''),
      onclick: async (e) => { if (!fn) return close(); const b = e.currentTarget; b.disabled = true; try { await fn(close); } catch {} b.disabled = false; } }, label))) : null);
  back.append(box); document.body.append(back);
  document.addEventListener('keydown', esc);
  setTimeout(() => (box.querySelector('input, select, .pt-btn.primary') || box).focus?.(), 30);
  return { close, box };
}

// The short rules, shared by the lobby and the room (Help > How to play)
export function howToPlay() {
  return h('div', { class: 'pt-help' },
    h('p', {}, h('b', {}, 'PEPaint is the party room of PondOS: draw a word, the others guess it in the chat.')),
    h('ol', {},
      h('li', {}, 'Start a party (or join one) and press Invite to copy the link for your frens. Up to 12 players.'),
      h('li', {}, 'The room moderator presses Start. Everyone takes turns drawing a secret word.'),
      h('li', {}, 'Guess by typing in the chat. A correct guess is 20 to 100 points: the faster, the more. The first three get a bonus (+15, +8, +4).'),
      h('li', {}, 'The artist gets 10 points for every fren who guesses the word.'),
      h('li', {}, 'Letters of the word appear after 40%, 60% and 80% of the time. The turn ends when everyone got it or the time is up.'),
      h('li', {}, 'No letters or words on the drawing, fren.')),
    h('p', { class: 'small' }, 'Just for fun: scores last only for the current game. ', h('a', { href: 'rules.html', target: '_blank', rel: 'noopener' }, 'Full rules')));
}

// When the window is a PondOS app (an iframe), tell it the title to show on its title bar
export function setWinTitle(t) {
  document.title = t;
  try { if (window.parent !== window) window.parent.postMessage({ type: 'pepaint-title', title: t }, location.origin); } catch {}
}
