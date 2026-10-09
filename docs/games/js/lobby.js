import { $, h, toast, getBackend, identityCard, paintMe, nextFriday20, fmtLocal, fmtPoland, backendBanner, seasonLine, nickStore } from './common.js';

const be = await getBackend();
backendBanner($('#main'));
if (be.kind === 'none') {   // no game server yet: only the offline "Play vs bot" part works
  document.body.classList.add('no-server');
  $('.hero .lead').textContent = 'Play Chess, Checkers, Connect Four and Sea Battle against a bot, right in your browser. Live rooms with friends, Draw & Guess and weekly game nights are coming soon.';
  const play = $('.hero a.primary'); if (play) { play.textContent = 'Play vs bot'; play.href = '#tables'; }
}
paintMe(be);
let lobby = null, offset = 0;
const MODE_LABEL = { kalambury: 'Draw & Guess', obrazek: 'Guess the Picture' };
const TGAME = { chess: ['♟️', 'Chess'], checkers: ['⚫', 'Checkers'], connect4: ['🔴', 'Connect Four'], battleship: ['🚢', 'Sea Battle'] };
const PHASE_LABEL = { lobby: 'waiting to start', turn: 'in progress', reveal: 'in progress', waiting: 'in progress', finished: 'finished' };

async function load() {
  try { lobby = await be.rpc('gry_lobby'); offset = Date.parse(lobby.now) - Date.now(); }
  catch (e) { lobby = { rooms: [], event: null, error: e.message }; }
  renderRooms(); tick();
}
function eventInfo() {
  if (lobby?.event) return { at: new Date(lobby.event.starts_at), title: lobby.event.title, room: lobby.event.room_code };
  return { at: nextFriday20(new Date(Date.now() + offset)), title: 'Guess the Picture · Game Night', room: null, fallback: true };
}
function tick() {
  const ev = eventInfo(); if (!ev.at) return;
  const now = Date.now() + offset, diff = ev.at - now;
  $('#sched-title').textContent = ev.title;
  $('#sched-season').textContent = seasonLine(lobby?.season, Date.now() + offset);
  const cd = $('#countdown'); cd.textContent = '';
  const cta = $('#sched-cta'); cta.textContent = '';
  if (diff > 0) {
    $('#sched-when').textContent = 'Next game · ' + fmtLocal(ev.at, { month: undefined, day: undefined, hour: undefined, minute: undefined });
    const s = Math.floor(diff / 1000);
    [[Math.floor(s / 86400), 'days'], [Math.floor(s / 3600) % 24, 'hrs'], [Math.floor(s / 60) % 60, 'min'], [s % 60, 'sec']]
      .forEach(([v, l]) => cd.append(h('div', {}, h('b', {}, String(v).padStart(2, '0')), h('span', {}, l))));
    $('#sched-note').textContent = fmtLocal(ev.at) + ' your time (' + fmtPoland(ev.at) + ' in Poland). We announce it on Reddit and Discord.';
  } else {
    $('#sched-when').textContent = 'Live now!';
    $('#sched-note').textContent = 'Jump in, the game is on.';
    const code = ev.room || lobby?.rooms?.[0]?.code;
    if (code) cta.append(h('a', { class: 'btn big', href: 'room.html?r=' + code, style: 'background:#f7f5ef;color:#16532A;border:0' }, 'Join room ' + code));
  }
}
function renderRooms() {
  const box = $('#rooms'); box.textContent = '';
  if (lobby?.error) { box.append(h('p', { class: 'muted' }, lobby.error)); return; }
  if (!lobby?.rooms?.length) { box.append(h('div', { class: 'empty' }, h('img', { class: 'empty-pic', src: 'img/empty-playground.webp', alt: 'Three Pepe frogs playing in a sandbox', width: 640, height: 365, loading: 'lazy' }), h('p', { class: 'muted' }, 'No open rooms right now. Start your own Draw & Guess room below, or come back for the weekly Guess the Picture night.'))); return; }
  for (const r of lobby.rooms) box.append(h('div', { class: 'room-item' },
    h('div', { class: 'ico', 'aria-hidden': 'true' }, r.mode === 'kalambury' ? '✏️' : '🖼️'),
    h('div', { class: 'meta' }, h('b', {}, r.title), h('span', { class: 'small muted' }, `${MODE_LABEL[r.mode]} (${r.ranked ? 'ranked' : 'casual'}) · ${r.players}/${r.max_players} players · ${PHASE_LABEL[r.phase]} · code `, h('span', { class: 'mono' }, r.code))),
    h('a', { class: 'btn primary sm', href: 'room.html?r=' + r.code }, 'Join')));
}
$('#codeform').addEventListener('submit', (e) => {
  e.preventDefault();
  const c = $('#code').value.trim().toUpperCase();
  if (!/^[A-Z0-9]{5}$/.test(c)) return toast('Room codes have 5 characters', 'bad');
  location.href = 'room.html?r=' + c;
});
// ---------- nowy pokój Draw & Guess (każdy, bez kodu hosta) ----------
function renderNewRoom() {
  const box = $('#newroom'); box.textContent = '';
  const logged = !!be.session();
  const title = h('input', { type: 'text', id: 'nr-title', maxlength: 40, placeholder: (nickStore.get() || 'Frog') + "'s room" });
  const rounds = h('select', { id: 'nr-rounds' }, [1, 2, 3, 4, 5].map((n) => h('option', { value: n, selected: n === 2 }, n + (n === 1 ? ' round' : ' rounds'))));
  const secs = h('select', { id: 'nr-secs' }, [[60, '60 s'], [80, '80 s'], [100, '100 s'], [120, '120 s']].map(([v, l]) => h('option', { value: v, selected: v === 80 }, l + ' per drawing')));
  box.append(h('h2', {}, '✏️ Start a Draw & Guess room'),
    h('p', { class: 'small muted', style: 'margin-top:0' }, 'Free for everyone, no host code needed. You become the room moderator (start, restart, kick). If you leave, the next player takes over. Up to 12 players; empty rooms close by themselves. Just for fun: scores last only for the current game and are not saved to any leaderboard.'),
    h('div', { class: 'grid2', style: 'gap:12px' }, h('div', {}, h('label', { for: 'nr-title' }, 'Room name (optional)'), title),
      h('div', { class: 'row', style: 'gap:12px;align-items:end' }, h('div', {}, h('label', { for: 'nr-rounds' }, 'Rounds'), rounds), h('div', {}, h('label', { for: 'nr-secs' }, 'Time'), secs))),
    h('div', { class: 'row', style: 'margin-top:12px' },
      h('button', { class: 'btn primary', id: 'nr-create', disabled: !logged, onclick: async (e) => {
        e.target.disabled = true;
        try {
          const c = await be.rpc('gry_create_room', { p_mode: 'kalambury', p_title: title.value.trim() || title.placeholder, p_rounds: +rounds.value, p_seconds: +secs.value });
          location.href = 'room.html?r=' + c;
        } catch (err) { toast(err.message, 'bad'); e.target.disabled = false; }
      } }, 'Create room'),
      logged ? null : h('span', { class: 'small muted' }, 'Pick a nickname above first.')));
}
renderNewRoom(); renderNewTable();
await identityCard($('#identity'), { cta: 'Play', onReady: () => { renderNewRoom(); renderNewTable(); toast('All set! Join a room or start your own 👉', 'good'); $('#rooms').scrollIntoView({ behavior: 'smooth', block: 'center' }); } });
renderNewRoom(); renderNewTable();
await Promise.all([load(), loadTables()]);
setInterval(tick, 1000);
setInterval(load, 15000);
setInterval(loadTables, 15000);

// ---------- Table games (Chess / Checkers / Connect Four) ----------
async function loadTables() {
  const box = $('#tlist');
  let list;
  try { list = await be.rpc('gry_tables_lobby'); } catch (e) { box.textContent = ''; box.append(h('p', { class: 'muted' }, e.message)); return; }
  box.textContent = '';
  if (!list.length) { box.append(h('div', { class: 'empty' }, h('img', { class: 'empty-pic', src: 'img/empty-swing.webp', alt: 'A sad Pepe sitting alone on a swing', width: 640, height: 445, loading: 'lazy' }), h('p', { class: 'muted' }, 'No open tables right now. Open one below and send the invite link to a friend.'))); return; }
  for (const t of list) {
    const [ico, name] = TGAME[t.game];
    const players = t.players || [];
    const state = t.status === 'waiting' ? 'waiting for an opponent' : t.status === 'playing' ? `playing: ${players.join(' vs ')}` : `game over: ${players.join(' vs ')}`;
    const spec = t.spectators ? `spectators welcome${t.watching ? ` · ${t.watching} watching` : ''}` : 'no spectators';
    const canWatch = t.status !== 'waiting' && t.spectators;
    box.append(h('div', { class: 'room-item table-item', 'data-code': t.code },
      h('div', { class: 'ico', 'aria-hidden': 'true' }, ico),
      h('div', { class: 'meta' }, h('b', {}, `${name} · ${t.creator || '?'}`, ' ', h('span', { class: 'pill tc-pill' + (t.timed ? ' timed' : '') }, '⏱ ' + (t.tc || 'No clock') + (t.no_touch ? ' · no-touch' : ''))), h('span', { class: 'small muted' }, `${state} · ${spec} · table `, h('span', { class: 'mono' }, t.code))),
      t.status === 'waiting' ? h('a', { class: 'btn primary sm', href: 'table.html?t=' + t.code }, 'Sit down')
        : canWatch ? h('a', { class: 'btn sm', href: 'table.html?t=' + t.code }, 'Watch') : h('span', { class: 'small muted' }, 'full')));
  }
}
function renderNewTable() {
  const box = $('#tcreate'); if (!box) return; box.textContent = '';
  const logged = !!be.session();
  const pick = h('div', { class: 'tgame-pick', role: 'radiogroup', 'aria-label': 'Game' }, Object.entries(TGAME).map(([k, [ico, name]], i) =>
    h('label', {}, h('input', { type: 'radio', name: 'tgame', value: k, checked: i === 0 }), ico + ' ' + name)));
  // tempo: szachy = zegar partii (presety + własny), warcaby / C4 = limit na ruch
  const TC = [['none', 'No clock'], ['1+0', 'Bullet 1+0'], ['2+1', 'Bullet 2+1'], ['3+2', 'Blitz 3+2'], ['5+0', 'Blitz 5+0'],
              ['10+0', 'Rapid 10+0'], ['15+10', 'Rapid 15+10'], ['custom', 'Custom']];
  const MV = [['0', 'No limit'], ['30', '30s per move'], ['60', '60s per move']];
  const tcBox = h('div', { class: 'tgame-tc', id: 'nt-tc', role: 'radiogroup', 'aria-label': 'Time control' });
  const cMin = h('input', { type: 'number', id: 'tc-min', min: 1, max: 60, value: 7, 'aria-label': 'Minutes per player' });
  const cInc = h('input', { type: 'number', id: 'tc-inc', min: 0, max: 30, value: 3, 'aria-label': 'Increment in seconds' });
  const custom = h('span', { class: 'tc-custom hidden', id: 'tc-custom' }, cMin, 'min +', cInc, 's');
  const renderTc = () => {
    const game = box.querySelector('input[name=tgame]:checked')?.value || 'chess';
    tcBox.textContent = '';
    const opts = game === 'chess' ? TC : MV;
    tcBox.append(h('span', { class: 'small muted' }, game === 'chess' ? 'Clock:' : 'Move timer:'),
      ...opts.map(([v, label], i) => h('label', { class: 'tc-opt' }, h('input', { type: 'radio', name: 'tc', value: v, checked: i === 0,
        onchange: () => custom.classList.toggle('hidden', v !== 'custom') }), label)));
    if (game === 'chess') tcBox.append(custom);
    custom.classList.add('hidden');
    noTouchL.classList.toggle('hidden', game !== 'battleship');
  };
  const tcArgs = () => {
    const v = tcBox.querySelector('input[name=tc]:checked')?.value || 'none';
    const game = box.querySelector('input[name=tgame]:checked').value;
    if (game !== 'chess') return { p_move_seconds: +v };
    if (v === 'none') return {};
    if (v === 'custom') return { p_minutes: Math.round(+cMin.value || 0), p_increment: Math.round(+cInc.value || 0) };
    const [m, i] = v.split('+'); return { p_minutes: +m, p_increment: +i };
  };
  const noTouch = h('input', { type: 'checkbox', id: 'nt-notouch' });
  const noTouchL = h('label', { class: 'hidden' }, noTouch, 'No-touch rule (ships may not touch)');
  pick.addEventListener('change', renderTc);
  const priv = h('input', { type: 'checkbox', id: 'nt-private' });
  const spec = h('input', { type: 'checkbox', id: 'nt-spec', checked: true });
  box.append(h('h3', {}, 'Open a table'), pick, tcBox,
    h('div', { class: 'topts' }, h('label', {}, priv, 'Private: invite link only (not listed here)'), h('label', {}, spec, 'Allow spectators'), noTouchL),
    h('div', { class: 'row', style: 'margin-top:12px' },
      h('button', { class: 'btn primary', id: 'nt-create', disabled: !logged, onclick: async (e) => {
        e.target.disabled = true;
        try {
          const game = box.querySelector('input[name=tgame]:checked').value;
          const c = await be.rpc('gry_table_create', { p_game: game, p_nick: nickStore.get(), p_private: priv.checked, p_spectators: spec.checked, ...tcArgs(),
            ...(game === 'battleship' ? { p_no_touch: noTouch.checked } : {}) });
          location.href = 'table.html?t=' + c;
        } catch (err) { toast(err.message, 'bad'); e.target.disabled = false; }
      } }, 'Create table'),
      logged ? null : h('span', { class: 'small muted' }, 'Pick a nickname above first.')),
    // vs bot: runs only in this browser (Web Worker), no account needed, nothing saved online
    h('div', { class: 'botrow', id: 'botrow' },
      h('b', {}, '🤖 Play vs bot'),
      h('span', { class: 'tgame-tc', role: 'radiogroup', 'aria-label': 'Bot difficulty' },
        [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']].map(([v, l]) => h('label', { class: 'tc-opt' }, h('input', { type: 'radio', name: 'blevel', value: v, checked: v === 'medium' }), l))),
      h('button', { class: 'btn', id: 'bot-play', onclick: () => {
        const game = box.querySelector('input[name=tgame]:checked').value, lv = box.querySelector('input[name=blevel]:checked').value;
        location.href = `table.html?bot=${game}&level=${lv}` + (game === 'battleship' && noTouch.checked ? '&notouch=1' : '');
      } }, 'Play vs bot'),
      h('span', { class: 'small muted' }, 'Uses the game picked above. The bot plays in your browser: no account, no ranking, nothing saved online.')));
  renderTc();
}
