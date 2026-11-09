// PEPaint: the party room of PondOS (Draw & Guess). Opening PEPaint.exe lands here, on the main menu.
// Everything is one click away, no dialogs in the way: start a party (rounds and time right there), type a code,
// or pick an open room from the list (the whole row is the button). The rooms themselves are room.html.
import { $, h, toast, errorNote, getBackend, identityCard, meInfo, nickStore } from './common.js';
import { menuBar, statusBar, dialog, howToPlay, TOOL_SVG, DECOR_TOOLS, PALETTE, TIMES, setWinTitle } from './paintchrome.js';

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
const help = () => dialog('How to play - PEPaint', howToPlay(), [['OK', null, { primary: true }]], { wide: true });

// ---------- the window: menu bar, tool box + sheet (the main menu), colour box, status bar ----------
const status = statusBar(3);
const HINT = 'Start a party, type a code, or click a room on the list.';
const hint = (t) => status.set(0, t || HINT);
const menu = menuBar([
  ['File', () => [['New party room', () => createRoom()], ['Quick join', quickJoin], '-', ['Refresh the room list', () => load(true)], '-', [framed ? 'Exit' : 'Exit to PondOS', exit]]],
  ['Top', [['Top of the week', () => openTop('week')], ['Last week', () => openTop('last')], ['All time', () => openTop('all')], '-', ['My stats', () => openTop('week')]]],
  ['View', () => [[(app.classList.contains('no-box') ? 'Show' : 'Hide') + ' the tool box', () => toggle('no-box')], [(app.classList.contains('no-pal') ? 'Show' : 'Hide') + ' the colour box', () => toggle('no-pal')], [(app.classList.contains('no-status') ? 'Show' : 'Hide') + ' the status bar', () => toggle('no-status')]]],
  ['Help', [['How to play', help], '-', ['About PEPaint', about]]],
]);
function toggle(cls) { app.classList.toggle(cls); ls('pepaint-view', ['no-box', 'no-pal', 'no-status'].filter((c) => app.classList.contains(c)).join(' ')); }
(ls('pepaint-view') || '').split(' ').filter(Boolean).forEach((c) => app.classList.add(c));

const box = h('div', { class: 'pt-box', role: 'toolbar', 'aria-label': 'Tool box' },
  DECOR_TOOLS.map(([k, name]) => {
    const b = h('button', { type: 'button', class: 'pt-tool', title: name, 'aria-label': name, 'aria-pressed': String(k === 'brush'),
      onclick: () => { box.querySelectorAll('.pt-tool').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); hint(name + ': open a party room to draw with your frens.'); } });
    b.innerHTML = TOOL_SVG[k];
    return b;
  }));

const who = h('p', { class: 'pt-who', 'aria-live': 'polite' });
const listBox = h('div', { class: 'pt-list' });
const count = h('span', { class: 'pt-count' });
const topBox = h('div', { class: 'pt-top' });
// start a party: the two settings that matter, remembered for next time
const saved = (() => { try { return JSON.parse(ls('pepaint-new') || '{}'); } catch { return {}; } })();
const name = h('input', { type: 'text', id: 'pt-name', maxlength: 40, placeholder: 'Party name (optional)', 'aria-label': 'Party name (optional)' });
const rounds = h('select', { id: 'pt-rounds' }, [1, 2, 3, 4, 5].map((n) => h('option', { value: n, selected: n === (+saved.rounds || 2) }, n + (n === 1 ? ' round' : ' rounds'))));
const secs = h('select', { id: 'pt-secs' }, TIMES.map((v) => h('option', { value: v, selected: v === (TIMES.includes(+saved.secs) ? +saved.secs : 60) }, v + ' s')));
const createBtn = h('button', { type: 'button', class: 'pt-go', onclick: () => createRoom() }, 'Start a party');
createBtn.prepend((() => { const s = h('span', { 'aria-hidden': 'true' }); s.innerHTML = TOOL_SVG.brush; return s; })());
const codeIn = h('input', { type: 'text', id: 'pt-code', maxlength: 5, placeholder: 'PEP42', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Room code' });
const codeForm = h('form', { class: 'pt-codeform', onsubmit: (e) => { e.preventDefault(); joinCode(); } }, codeIn, h('button', { class: 'pt-btn' }, 'Join'));

const sheet = h('div', { class: 'pt-sheet' },
  h('div', { class: 'pt-side' },
    h('h1', { class: 'pt-brand' },
      h('img', { class: 'pt-frog', src: 'img/pepaint-frog.webp', alt: '', width: 282, height: 320 }),
      h('img', { class: 'pt-word', src: 'img/pepaint-word.webp', alt: 'PEPaint', width: 720, height: 175 })),
    h('p', { class: 'pt-tag' }, 'The party room of PondOS. Draw a word, your frens guess it.'),
    who,
    h('fieldset', { class: 'pt-group' }, h('legend', {}, 'New party'),
      name,
      h('div', { class: 'pt-two' },
        h('label', {}, h('span', {}, 'Rounds'), rounds),
        h('label', {}, h('span', {}, 'Time to draw'), secs)),
      createBtn),
    h('fieldset', { class: 'pt-group' }, h('legend', {}, 'Got a room code?'), codeForm),
    h('p', { class: 'pt-fine' }, h('button', { type: 'button', class: 'pt-link', onclick: help }, 'How to play'), ' · up to 12 players · games with 3+ frens count for the top of the week')),
  h('div', { class: 'pt-main' },
    h('div', { class: 'pt-main-head' }, h('h2', {}, 'Open party rooms ', count),
      h('button', { type: 'button', class: 'pt-btn', onclick: quickJoin, title: 'Jump into the first room with a free spot' }, 'Quick join'),
      h('button', { type: 'button', class: 'pt-btn pt-refresh', onclick: () => load(true), title: 'Refresh the list', 'aria-label': 'Refresh the list' }, '↻')),
    listBox, topBox));
const area = h('div', { class: 'pt-area' }, sheet);
const cur = h('span', { class: 'pt-cur', 'aria-hidden': 'true' }, h('i', { class: 'fg' }), h('i', { class: 'bg' }));
const pal = h('div', { class: 'pt-pal', role: 'group', 'aria-label': 'Colour box' }, cur, h('div', { class: 'pt-swatches' },
  PALETTE.map((c) => h('button', { type: 'button', class: 'pt-sw', 'data-c': c, style: `background:${c}`, 'aria-label': 'Colour ' + c, title: 'Start drawing with this colour',
    onclick: () => myColor(c), onmouseenter: () => hint('Your brush colour: you start drawing with it in every room.'), onmouseleave: () => hint() }))));
app.textContent = '';
app.append(menu, h('div', { class: 'pt-work' }, box, area), pal, status.el);
hint(); status.set(2, '');

// the colour box picks the colour your brush starts with in a room
function myColor(c) {
  cur.querySelector('.fg').style.background = c; ls('pepaint-color', c);
  pal.querySelectorAll('.pt-sw').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.c === c)));
}
myColor(PALETTE.includes(ls('pepaint-color')) ? ls('pepaint-color') : '#000000');

// ---------- who is playing ----------
async function paintWho() {
  me = await meInfo(be);
  who.textContent = '';
  if (me?.user_id) who.append('Playing as ', h('b', {}, (me.verified ? '✓ ' : '') + (me.nick || me.discord_name || nickStore.get() || 'guest')), me.verified ? ' ' : ' (guest) ',
    h('button', { type: 'button', class: 'pt-link', onclick: () => logOn() }, 'Change'));
  else who.append('Not logged on yet. ', h('button', { type: 'button', class: 'pt-link', onclick: () => logOn() }, 'Log on'), ' as a guest (one click) or with Discord.');
}
function logOn(then) {
  const inner = h('div', { class: 'pt-id' });
  const d = dialog('Log On - PEPaint', inner, [], { wide: true });
  identityCard(inner, { cta: then ? 'Continue' : 'Play', onReady: async () => { d.close(); await paintWho(); then?.(); } });
}
const needLogIn = (fn) => (be.session() ? fn() : logOn(fn));

// ---------- the main menu actions ----------
function createRoom() {
  if (be.kind === 'none') return toast('The game server is not connected yet.', 'bad');
  needLogIn(async () => {
    createBtn.disabled = true;
    ls('pepaint-new', JSON.stringify({ rounds: +rounds.value, secs: +secs.value }));
    try {
      const c = await be.rpc('gry_create_room', { p_mode: 'kalambury', p_title: name.value.trim() || (nickStore.get() || me?.nick || 'Frog') + "'s party", p_rounds: +rounds.value, p_seconds: +secs.value });
      go('room.html?r=' + c);
    } catch (err) { toast(err.message, 'bad'); createBtn.disabled = false; }
  });
}
function joinCode() {
  const c = codeIn.value.trim().toUpperCase();
  if (!/^[A-Z0-9]{5}$/.test(c)) { toast('Room codes have 5 letters or digits', 'bad'); codeIn.focus(); return; }
  go('room.html?r=' + c);
}
function quickJoin() {
  const open = rooms.filter((r) => r.players < r.max_players && r.phase !== 'finished')
    .sort((a, b) => (a.phase === 'lobby' ? 0 : 1) - (b.phase === 'lobby' ? 0 : 1) || b.players - a.players);
  if (open.length) return go('room.html?r=' + open[0].code);
  toast('No party is on right now. Start one and be the first artist in the pond!');
  createBtn.focus();
}
function about() {
  dialog('About PEPaint', h('div', { class: 'pt-msg' }, h('img', { src: 'img/pepaint-frog.webp', alt: '', width: 70, height: 80 }),
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
  count.textContent = `(${rooms.length})`;
  status.set(1, rooms.length ? `${rooms.length} room${rooms.length === 1 ? '' : 's'} · ${people} fren${people === 1 ? '' : 's'} playing` : 'No rooms open');
  if (loadErr) { listBox.append(errorNote(loadErr)); return; }
  if (!rooms.length) {
    listBox.append(h('div', { class: 'pt-empty' }, h('img', { src: 'img/empty-playground.webp', alt: 'Three Pepe frogs playing in a sandbox', width: 240, height: 137, loading: 'lazy' }),
      h('p', {}, h('b', {}, 'No party yet.'), h('br'), 'Start the first one and send the link to your frens.')));
    return;
  }
  // every row is one big button: waiting rooms first, then the fullest
  const sorted = [...rooms].sort((a, b) => (a.players >= a.max_players) - (b.players >= b.max_players) || (a.phase === 'lobby' ? 0 : 1) - (b.phase === 'lobby' ? 0 : 1) || b.players - a.players);
  listBox.append(h('ul', { class: 'pt-roomlist' }, sorted.map((r) => {
    const full = r.players >= r.max_players;
    const inner = [h('span', { class: 'pt-r-name' }, h('b', {}, r.title), h('small', {}, (PHASE[r.phase] || r.phase) + ' · code ', h('span', { class: 'mono' }, r.code))),
      h('span', { class: 'pt-r-n' }, `${r.players}/${r.max_players}`),
      h('span', { class: 'pt-r-go' }, full ? 'Full' : 'Join ▸')];
    return h('li', {}, full ? h('div', { class: 'pt-room full' }, inner) : h('a', { class: 'pt-room', href: 'room.html?r=' + r.code }, inner));
  })));
}

// ---------- top of the week and my stats ----------
// A finished game counts when 3+ frens played and 3+ pictures were guessed. The list shows Discord accounts only.
const MEDAL = ['🥇', '🥈', '🥉'];
let topData = null;
async function loadTop() {
  if (be.kind === 'none') return;
  try { topData = await be.rpc('gry_pp_top', { p_period: 'week' }); } catch { topData = null; }   // old server: no strip, the rest works
  renderTop();
}
function renderTop() {
  topBox.textContent = '';
  if (!topData) return;
  const rows = (topData.rows || []).slice(0, 3);
  topBox.append(h('b', { class: 'pt-top-t' }, '🏆 Top of the week'),
    rows.length ? h('ol', { class: 'pt-top3' }, rows.map((r, i) => h('li', { class: r.me ? 'me' : '' }, MEDAL[i] + ' ', h('b', {}, r.nick), ' ' + r.points)))
      : h('span', { class: 'pt-top-none' }, 'Nobody yet this week. Be the first: play a game with 3+ frens.'),
    h('button', { type: 'button', class: 'pt-btn', onclick: () => openTop('week') }, 'Top list and my stats'));
}
const TABS = [['week', 'This week'], ['last', 'Last week'], ['all', 'All time']];
function openTop(period) {
  const body = h('div', { class: 'pt-topdlg' });
  dialog('Top list - PEPaint', body, [['Close', null, { primary: true }]], { wide: true });
  const show = async (p) => {
    body.textContent = ''; body.append(h('p', { class: 'small' }, 'Loading...'));
    let d; try { d = await be.rpc('gry_pp_top', { p_period: p }); if (p === 'week') { topData = d; renderTop(); } }
    catch (e) { body.textContent = ''; body.append(errorNote(e)); return; }
    const rows = d.rows || [], m = d.mine || {};
    const end = new Date(d.week_end), left = Math.max(0, end - Date.now()), dd = Math.floor(left / 864e5), hh = Math.floor(left % 864e5 / 36e5);
    body.textContent = '';
    body.append(...[
      h('div', { class: 'pt-tabs', role: 'tablist' }, TABS.map(([k, t]) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(k === p), onclick: () => show(k) }, t))),
      h('div', { class: 'pt-toplist' }, rows.length ? h('table', {},
        h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'Fren'), h('th', { title: 'Points from counted games' }, 'Points'), h('th', {}, 'Games'), h('th', { title: 'Games finished in 1st place' }, 'Wins'), h('th', { title: 'Pictures guessed first' }, 'Firsts'))),
        h('tbody', {}, rows.map((r) => h('tr', { class: r.me ? 'me' : '' }, h('td', {}, MEDAL[r.place - 1] || r.place), h('td', {}, r.nick + (r.me ? ' (you)' : '')), h('td', {}, h('b', {}, r.points)), h('td', {}, r.games), h('td', {}, r.wins), h('td', {}, r.firsts)))))
        : h('p', { class: 'pt-top-none' }, p === 'last' ? 'Nobody was on the list last week.' : 'Nobody on the list yet. Play a game with 3+ frens and take the first spot.')),
      d.me && !rows.some((r) => r.me) ? h('p', { class: 'small' }, `You are #${d.me.place} with ${d.me.points} points.`) : null,
      p === 'week' ? h('p', { class: 'small' }, `The week ends in ${dd} d ${hh} h (Monday 00:00 UTC), then everyone starts from zero.`) : null,
      h('fieldset', { class: 'pt-group pt-mine' }, h('legend', {}, 'My stats (all time)'),
        m.games ? h('dl', {}, [['Games', m.games], ['Wins', m.wins], ['First guesses', m.firsts], ['My pictures guessed', m.drawn], ['Best game', m.best + ' pts'], ['All points', m.points]]
          .map(([k, v]) => h('div', {}, h('dt', {}, k), h('dd', {}, String(v)))))
          : h('p', { class: 'small' }, 'No counted games yet. A game counts when 3+ frens play and 3+ pictures are guessed.'),
        d.verified ? '' : h('p', { class: 'small' }, 'Guests keep their stats on this device only. ', h('b', {}, 'Log on with Discord'), ' to get on the list.'))].filter(Boolean));
  };
  show(period);
}

paintWho();
loadTop();
await load();
setInterval(load, 15000);
// ?join=CODE from a PondOS link: straight into that room
const q = new URLSearchParams(location.search).get('join');
if (q && /^[A-Za-z0-9]{5}$/.test(q)) go('room.html?r=' + q.toUpperCase());
