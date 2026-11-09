// PEPaint: the party room of PondOS (Draw & Guess). Opening PEPaint.exe lands here, on the main menu:
// start a party room, quick join, join with a code, or pick an open room. The rooms themselves are room.html.
import { $, h, toast, errorNote, getBackend, identityCard, meInfo, nickStore } from './common.js';
import { menuBar, statusBar, dialog, howToPlay, TOOL_SVG, DECOR_TOOLS, PALETTE, setWinTitle } from './paintchrome.js';

const be = await getBackend();
const app = $('#main');
const framed = (() => { try { return window.self !== window.top; } catch { return true; } })();
let rooms = [], me = null, loadErr = null;
const PHASE = { lobby: 'Waiting to start', turn: 'Drawing now', reveal: 'Drawing now', waiting: 'Drawing now', finished: 'Game over' };
const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { return null; } };

setWinTitle('Main menu - PEPaint');
const go = (url) => { location.href = url; };
const exit = () => {
  if (framed) { try { window.parent.postMessage({ type: 'pepaint-close' }, location.origin); } catch {} return; }
  window.PondOS?.leave?.(); go(window.PondOS?.back || '/meme/');
};

// ---------- the window: menu bar, tool box + canvas (the main menu), colour box, status bar ----------
const status = statusBar(3);
const HINT = 'For Help, click How to play on the Help menu.';
const hint = (t) => status.set(0, t || HINT);
const menu = menuBar([
  ['File', () => [['New party room…', newRoom], ['Quick join', quickJoin], ['Join with a code…', joinCode], '-', ['Refresh the room list', () => load(true)], '-', [framed ? 'Exit' : 'Exit to PondOS', exit]]],
  ['Edit', [['Undo (you can\'t undo a party)', () => {}, { disabled: true }], ['Paste a fren', () => {}, { disabled: true }]]],
  ['View', () => [[(app.classList.contains('no-box') ? 'Show' : 'Hide') + ' the tool box', () => toggle('no-box')], [(app.classList.contains('no-pal') ? 'Show' : 'Hide') + ' the colour box', () => toggle('no-pal')], [(app.classList.contains('no-status') ? 'Show' : 'Hide') + ' the status bar', () => toggle('no-status')]]],
  ['Colors', [['Random title colour', () => paintTitle(PALETTE[Math.floor(Math.random() * PALETTE.length)])], ['Back to frog green', () => paintTitle('#269B4D')]]],
  ['Help', [['How to play', () => dialog('How to play - PEPaint', howToPlay(), [['OK', null, { primary: true }]], { wide: true })], '-', ['About PEPaint', about]]],
]);
function toggle(cls) { app.classList.toggle(cls); ls('pepaint-view', ['no-box', 'no-pal', 'no-status'].filter((c) => app.classList.contains(c)).join(' ')); }
(ls('pepaint-view') || '').split(' ').filter(Boolean).forEach((c) => app.classList.add(c));

const box = h('div', { class: 'pt-box', role: 'toolbar', 'aria-label': 'Tool box' },
  DECOR_TOOLS.map(([k, name]) => {
    const b = h('button', { type: 'button', class: 'pt-tool', title: name, 'aria-label': name, 'aria-pressed': String(k === 'pencil'),
      onclick: () => { box.querySelectorAll('.pt-tool').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); hint(name + ': open a party room to draw with your frens.'); } });
    b.innerHTML = TOOL_SVG[k];
    return b;
  }),
  h('div', { class: 'pt-opts', 'aria-hidden': 'true' }, [1, 2, 3, 4].map((n) => h('i', { style: `height:${n}px` }))));

const titleEl = h('h1', { class: 'pt-title' }, h('span', {}, 'PEP'), 'aint');
const who = h('p', { class: 'pt-who', 'aria-live': 'polite' });
const listBox = h('div', { class: 'pt-list' });
const legend = h('legend', {}, 'Open party rooms');
const bigBtn = (ico, title, sub, fn, cls = '') => {
  const b = h('button', { type: 'button', class: 'pt-big ' + cls, onclick: fn, onmouseenter: () => hint(sub), onmouseleave: () => hint() },
    h('span', { class: 'pt-big-ico', 'aria-hidden': 'true' }), h('b', {}, title), h('small', {}, sub));
  b.querySelector('.pt-big-ico').innerHTML = TOOL_SVG[ico];
  return b;
};
const sheet = h('div', { class: 'pt-sheet' },
  h('div', { class: 'pt-hero' },
    h('img', { class: 'pt-logo', src: 'img/pepaint.svg', alt: '', width: 88, height: 88 }),
    h('div', {}, titleEl, h('p', { class: 'pt-tag' }, 'The party room of PondOS. Draw a word, your frens guess it, everybody laughs.'), who)),
  h('div', { class: 'pt-bigs' },
    bigBtn('pencil', 'New party room', 'Start a room and send the link to your frens', newRoom, 'primary'),
    bigBtn('skip', 'Quick join', 'Jump into the first room with a free spot', quickJoin),
    bigBtn('text', 'Join with a code', 'A fren gave you a 5-letter code', joinCode),
    bigBtn('zoom', 'How to play', 'Rules in 30 seconds', () => dialog('How to play - PEPaint', howToPlay(), [['OK', null, { primary: true }]], { wide: true }))),
  h('fieldset', { class: 'pt-rooms' }, legend, listBox),
  h('p', { class: 'pt-fine' }, 'Up to 12 players a room. Just for fun: scores reset after every game, no leaderboard.'),
  ['n', 'e', 's', 'se'].map((d) => h('i', { class: 'pt-handle ' + d, 'aria-hidden': 'true' })));
const area = h('div', { class: 'pt-area' }, sheet);
const cur = h('span', { class: 'pt-cur', 'aria-hidden': 'true' }, h('i', { class: 'fg' }), h('i', { class: 'bg' }));
const pal = h('div', { class: 'pt-pal', role: 'group', 'aria-label': 'Colour box' }, cur, h('div', { class: 'pt-swatches' },
  PALETTE.map((c) => h('button', { type: 'button', class: 'pt-sw', style: `background:${c}`, 'aria-label': 'Colour ' + c, title: 'Paint the title ' + c,
    onclick: () => paintTitle(c), onmouseenter: () => hint('Pick a colour: it paints the PEPaint title. In a room it paints your brush.'), onmouseleave: () => hint() }))));
app.textContent = '';
app.append(menu, h('div', { class: 'pt-work' }, box, area), pal, status.el);
hint(); status.set(2, '');

function paintTitle(c) { titleEl.style.setProperty('--pt-ink', c); cur.querySelector('.fg').style.background = c; ls('pepaint-title', c); }
paintTitle(ls('pepaint-title') || '#269B4D');
// the classic touch: the pointer position over the canvas, in the status bar
sheet.addEventListener('pointermove', (e) => { const r = sheet.getBoundingClientRect(); status.set(2, Math.round(e.clientX - r.left) + ', ' + Math.round(e.clientY - r.top) + 'px'); });
sheet.addEventListener('pointerleave', () => status.set(2, ''));

// ---------- who is playing ----------
async function paintWho() {
  me = await meInfo(be);
  who.textContent = '';
  if (me?.user_id) who.append('Playing as ', h('b', {}, (me.verified ? '✓ ' : '') + (me.nick || me.discord_name || nickStore.get() || 'guest')), me.verified ? ' ' : ' (guest) ',
    h('button', { type: 'button', class: 'pt-link', onclick: () => logOn() }, 'Change'));
  else who.append('You are not logged on yet. ', h('button', { type: 'button', class: 'pt-link', onclick: () => logOn() }, 'Log on'), ' as a guest (one click) or with Discord.');
}
function logOn(then) {
  const inner = h('div', { class: 'pt-id' });
  const d = dialog('Log On - PEPaint', inner, [], { wide: true });
  identityCard(inner, { cta: then ? 'Continue' : 'Play', onReady: async () => { d.close(); await paintWho(); then?.(); } });
}
const needLogIn = (fn) => (be.session() ? fn() : logOn(fn));

// ---------- the main menu actions ----------
function newRoom() {
  if (be.kind === 'none') return toast('The game server is not connected yet.', 'bad');
  needLogIn(() => {
    const name = h('input', { type: 'text', id: 'pt-name', maxlength: 40, placeholder: (nickStore.get() || me?.nick || 'Frog') + "'s party" });
    const rounds = h('select', { id: 'pt-rounds' }, [1, 2, 3, 4, 5].map((n) => h('option', { value: n, selected: n === 2 }, n + (n === 1 ? ' round' : ' rounds'))));
    const secs = h('select', { id: 'pt-secs' }, [[60, '60 s'], [80, '80 s'], [100, '100 s'], [120, '120 s']].map(([v, l]) => h('option', { value: v, selected: v === 80 }, l)));
    const form = h('div', { class: 'pt-form' },
      h('label', { for: 'pt-name' }, 'Room name'), name,
      h('label', { for: 'pt-rounds' }, 'Rounds'), rounds,
      h('label', { for: 'pt-secs' }, 'Time to draw'), secs,
      h('p', { class: 'pt-note' }, 'Next you get the invite link for your frens. You are the room moderator: you press Start.'));
    dialog('New party room - Attributes', form, [['OK', async () => {
      const c = await be.rpc('gry_create_room', { p_mode: 'kalambury', p_title: name.value.trim() || name.placeholder, p_rounds: +rounds.value, p_seconds: +secs.value })
        .catch((err) => { toast(err.message, 'bad'); throw err; });
      go('room.html?r=' + c);
    }, { primary: true }], ['Cancel', null]]);
  });
}
function joinCode() {
  const inp = h('input', { type: 'text', id: 'pt-code', maxlength: 5, placeholder: 'PEP42', autocomplete: 'off', spellcheck: 'false', style: 'text-transform:uppercase' });
  const ok = () => {
    const c = inp.value.trim().toUpperCase();
    if (!/^[A-Z0-9]{5}$/.test(c)) { toast('Room codes have 5 letters or digits', 'bad'); inp.focus(); return; }
    go('room.html?r=' + c);
  };
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); });
  dialog('Join with a code', h('div', { class: 'pt-form' }, h('label', { for: 'pt-code' }, 'Room code'), inp), [['Join', ok, { primary: true }], ['Cancel', null]]);
}
function quickJoin() {
  const open = rooms.filter((r) => r.players < r.max_players && r.phase !== 'finished')
    .sort((a, b) => (a.phase === 'lobby' ? 0 : 1) - (b.phase === 'lobby' ? 0 : 1) || b.players - a.players);
  if (open.length) return go('room.html?r=' + open[0].code);
  dialog('Quick join', h('div', { class: 'pt-msg' }, h('img', { src: 'img/emotes/waiting.webp', alt: '', width: 56, height: 56 }),
    h('p', {}, h('b', {}, 'No party is on right now.'), h('br'), 'Start one and be the first artist in the pond!')),
    [['New party room…', (close) => { close(); newRoom(); }, { primary: true }], ['Cancel', null]]);
}
function about() {
  dialog('About PEPaint', h('div', { class: 'pt-msg' }, h('img', { src: 'img/pepaint.svg', alt: '', width: 64, height: 64 }),
    h('div', {}, h('p', {}, h('b', {}, 'PEPaint 98'), h('br'), 'The party room of PondOS.'),
      h('p', { class: 'small' }, 'Draw, guess, laugh. Free, no ads, no coins needed. Made by a regular guy from r/pepecoin for the frens.'),
      h('p', { class: 'small' }, 'This program is licensed to: ', h('b', {}, me?.nick || 'a fren')))),
    [['OK', null, { primary: true }]]);
}

// ---------- open rooms ----------
async function load(manual) {
  if (be.kind === 'none') { loadErr = new Error('The game server is not connected yet.'); return render(); }
  try { const l = await be.rpc('gry_lobby'); rooms = (l.rooms || []).filter((r) => r.mode === 'kalambury'); loadErr = null; }
  catch (e) { loadErr = e; }
  render();
  if (manual) toast('Room list refreshed');
}
function render() {
  listBox.textContent = '';
  const people = rooms.reduce((n, r) => n + (r.players || 0), 0);
  legend.textContent = `Open party rooms (${rooms.length})`;
  status.set(1, rooms.length ? `${rooms.length} room${rooms.length === 1 ? '' : 's'} · ${people} fren${people === 1 ? '' : 's'} drawing` : 'No rooms open');
  if (loadErr) { listBox.append(errorNote(loadErr)); return; }
  if (!rooms.length) {
    listBox.append(h('div', { class: 'pt-empty' }, h('img', { src: 'img/empty-playground.webp', alt: 'Three Pepe frogs playing in a sandbox', width: 160, height: 91, loading: 'lazy' }),
      h('p', {}, h('b', {}, 'No party yet.'), h('br'), 'Start the first room and send the link to your frens.')));
    return;
  }
  listBox.append(h('table', { class: 'pt-table' },
    h('thead', {}, h('tr', {}, ['Room', 'Players', 'Status', 'Code', ''].map((x) => h('th', { scope: 'col' }, x)))),
    h('tbody', {}, rooms.map((r) => {
      const full = r.players >= r.max_players;
      return h('tr', { ondblclick: () => !full && go('room.html?r=' + r.code) },
        h('td', {}, h('b', {}, r.title)), h('td', { class: 'num' }, `${r.players}/${r.max_players}`), h('td', {}, PHASE[r.phase] || r.phase),
        h('td', { class: 'mono' }, r.code),
        h('td', { class: 'act' }, full ? h('span', { class: 'small' }, 'full') : h('a', { class: 'pt-btn sm', href: 'room.html?r=' + r.code }, 'Join')));
    }))));
}

paintWho();
await load();
setInterval(load, 15000);
// ?join=CODE from a PondOS link: straight into that room
const q = new URLSearchParams(location.search).get('join');
if (q && /^[A-Za-z0-9]{5}$/.test(q)) go('room.html?r=' + q.toUpperCase());
