import { $, h, toast, errorNote, getBackend, identityCard, paintMe, meInfo, badge, nextWeekday20, fmtLocal, fmtPoland, backendBanner, seasonLine, nickStore } from './common.js';
import { pixelDemo } from './pixeldemo.js';
import { lobbyChat } from './lobbychat.js';

const be = await getBackend();
backendBanner($('#main'));
if (be.kind === 'none') {   // no game server yet: only the offline "Play vs bot" part works
  document.body.classList.add('no-server');
  $('.lobby-head .lead').textContent = 'Play Chess, Checkers, Connect Four and Sea Battle against a bot, right in your browser. Live rooms with friends, Draw & Guess and weekly Pepe Pictures nights are coming soon.';
}
paintMe(be);
let lobby = null, offset = 0;
const MODE_LABEL = { kalambury: 'Draw & Guess', obrazek: 'Pepe Pictures' };
const TGAME = { chess: ['♟️', 'Chess'], checkers: ['⚫', 'Checkers'], connect4: ['🔴', 'Connect Four'], battleship: ['🚢', 'Sea Battle'] };
const TDESC = {
  chess: ['Classic chess with castling, en passant and promotion.', 'Optional game clock'],
  checkers: ['English draughts on 8×8. Captures are mandatory.', 'Optional move timer'],
  connect4: ['Drop discs on a 7×6 grid and line up four.', 'Optional move timer'],
  battleship: ['Hide 5 ships on a 10×10 grid and sink the other fleet.', 'Optional no-touch rule'],
};
// small static previews of each board, drawn with the same colours as the real game boards
function boardPreview(game) {
  const g = h('span', { class: 'gprev gprev-' + game, 'aria-hidden': 'true' });
  const cell = (cls) => g.append(h('span', { class: cls }));
  if (game === 'chess') {
    // full 8x8 board after 1.e4 e5 2.Nf3 Nc6 3.Bb5 (lower case = black, upper case = white)
    const ROWS = ['r.bqkbnr', 'pppp.ppp', '..n.....', '.B..p...', '....P...', '.....N..', 'PPPP.PPP', 'RNBQK..R'];
    const GLYPH = { k: '\u265A', q: '\u265B', r: '\u265C', b: '\u265D', n: '\u265E', p: '\u265F' };
    ROWS.forEach((row, r) => [...row].forEach((c, f) => g.append(h('span', { class: (r + f) % 2 ? 'dk' : 'lt' },
      c === '.' ? '' : h('i', { class: c === c.toUpperCase() ? 'pw' : 'pb' }, GLYPH[c.toLowerCase()] + '\uFE0E')))));
  } else if (game === 'checkers') {
    // full 8x8 board, starting position: 12 pieces each on the dark squares of the first three rows
    for (let i = 0; i < 64; i++) {
      const r = Math.floor(i / 8), dk = ((i % 8) + r) % 2;
      g.append(h('span', { class: dk ? 'dk' : 'lt' }, dk && r < 3 ? h('i', { class: 'pb' }) : dk && r > 4 ? h('i', { class: 'pw' }) : ''));
    }
  } else if (game === 'connect4') {
    const D = { 35: 'r', 36: 'y', 37: 'r', 38: 'y', 29: 'y', 30: 'r', 31: 'r', 23: 'r', 24: 'y', 17: 'r' };
    for (let i = 0; i < 42; i++) g.append(h('span', { class: 'hole' }, D[i] ? h('i', { class: 'disc ' + D[i] }) : ''));
  } else {
    const SHIP = [8, 9, 10, 27, 33], HIT = [9, 33], MISS = [2, 15, 22, 31];
    for (let i = 0; i < 36; i++) cell('sea' + (SHIP.includes(i) ? ' ship' : '') + (HIT.includes(i) ? ' hit' : '') + (MISS.includes(i) ? ' miss' : ''));
  }
  return g;
}
const PHASE_LABEL = { lobby: 'waiting to start', turn: 'in progress', reveal: 'in progress', waiting: 'in progress', finished: 'finished' };

async function load() {
  try { lobby = await be.rpc('gry_lobby'); offset = Date.parse(lobby.now) - Date.now(); }
  catch (e) { lobby = { rooms: [], event: null, error: e }; }
  renderRooms(); tick();
}
function eventInfo() {
  if (lobby?.event) return { at: new Date(lobby.event.starts_at), title: lobby.event.title, room: lobby.event.room_code };
  return { at: nextWeekday20('Fri', new Date(Date.now() + offset)), title: 'Pepe Pictures · Game Night', room: null, fallback: true };
}
function tick() {
  const ev = eventInfo(); if (!ev.at) return;
  const now = Date.now() + offset, diff = ev.at - now;
  $('#sched-title').textContent = ev.title;
  $('#sched-season').textContent = seasonLine(lobby?.season, Date.now() + offset);
  const cd = $('#countdown'); cd.textContent = '';
  const cta = $('#sched-cta'); cta.textContent = '';
  $('#hostwanted').hidden = !ev.fallback; $('#sched').hidden = ev.fallback;
  if (ev.fallback) {   // no night is scheduled yet: no countdown to a made-up date
    $('#sched-when').textContent = 'Next game · coming soon';
    $('#sched-note').textContent = 'The first nights are being planned. We announce every night on Reddit and Discord.';
    return;
  }
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
function roomRow(r) {
  return h('div', { class: 'room-item' },
    h('div', { class: 'ico', 'aria-hidden': 'true' }, r.mode === 'kalambury' ? '✏️' : '🖼️'),
    h('div', { class: 'meta' }, h('b', {}, r.title), h('span', { class: 'small muted' }, `${r.players}/${r.max_players} players · ${PHASE_LABEL[r.phase]} · code `, h('span', { class: 'mono' }, r.code))),
    h('a', { class: 'btn primary sm', href: 'room.html?r=' + r.code }, 'Join'));
}
function renderRooms() {
  const dg = $('#rooms'), pp = $('#rooms-pp'); dg.textContent = ''; pp.textContent = '';
  if (lobby?.error) { dg.append(errorNote(lobby.error)); return; }
  const rooms = lobby?.rooms || [];
  const d = rooms.filter((r) => r.mode === 'kalambury'), p = rooms.filter((r) => r.mode === 'obrazek');
  $('#chip-rooms').textContent = d.length;
  if (!d.length) dg.append(h('div', { class: 'empty' }, h('img', { class: 'empty-pic', src: 'img/empty-playground.webp', alt: 'Three Pepe frogs playing in a sandbox', width: 640, height: 365, loading: 'lazy' }), h('p', { class: 'muted' }, 'No open rooms right now. Start your own below.')));
  else d.forEach((r) => dg.append(roomRow(r)));
  if (!p.length) pp.append(h('div', { class: 'empty small-empty' }, h('img', { class: 'emote-big', src: 'img/emotes/waiting.webp', alt: '', width: 56, height: 56, loading: 'lazy' }), h('p', { class: 'muted' }, 'No live night right now.')));
  else p.forEach((r) => pp.append(roomRow(r)));
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
  box.append(h('h4', {}, 'Start a room'),
    h('div', {}, h('label', { for: 'nr-title' }, 'Room name (optional)'), title),
    h('div', { class: 'row', style: 'gap:12px;align-items:end;margin-top:10px' }, h('div', {}, h('label', { for: 'nr-rounds' }, 'Rounds'), rounds), h('div', {}, h('label', { for: 'nr-secs' }, 'Time'), secs)),
    h('div', { class: 'row', style: 'margin-top:12px' },
      h('button', { class: 'btn primary', id: 'nr-create', disabled: !logged, onclick: async (e) => {
        e.target.disabled = true;
        try {
          const c = await be.rpc('gry_create_room', { p_mode: 'kalambury', p_title: title.value.trim() || title.placeholder, p_rounds: +rounds.value, p_seconds: +secs.value });
          location.href = 'room.html?r=' + c;
        } catch (err) { toast(err.message, 'bad'); e.target.disabled = false; }
      } }, 'Create room'),
      logged ? null : loginHint()));
}
// ---------- login box: the small "Not signed in · Log in" button at the top right opens it ----------
function setLogin(open) {
  $('#identity').hidden = !open; $('#gme').setAttribute('aria-expanded', String(open));
  if (open) setTimeout(() => $('#identity #nick')?.focus(), 30);
}
function openLogin() { setLogin(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }
function loginHint() { return h('button', { type: 'button', class: 'linkbtn small', onclick: openLogin }, 'Log in or pick a nickname first'); }
$('#gme').addEventListener('click', (e) => { e.stopPropagation(); setLogin($('#identity').hidden); });
document.addEventListener('click', (e) => { if (!$('#identity').hidden && !e.target.closest('.g-login')) setLogin(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#identity').hidden) { setLogin(false); $('#gme').focus(); } });
const chat = lobbyChat(be, { openLogin });
minerYou();

renderNewRoom(); renderNewTable();
await identityCard($('#identity'), { cta: 'Play', onReady: () => { setLogin(false); renderNewRoom(); renderNewTable(); renderSchedHost(); chat.refresh(); toast('All set! Pick a game below', 'good'); } });
renderNewRoom(); renderNewTable();
await Promise.all([load(), loadTables(), loadTopboard()]);
renderSchedHost();
if (!$('#sched-host').children.length) $('#sched-host').dataset.ready = '';
pixelDemo($('#pixdemo'), $('#pixlabel'));
setInterval(tick, 1000);
setInterval(load, 15000);
setInterval(loadTopboard, 60000);
setInterval(loadTables, 15000);

// ---------- leaderboard (top 5) ----------
async function loadTopboard() {
  const box = $('#topboard-body'); if (be.kind === 'none') return;
  let d;
  try { d = await be.rpc('gry_ranking', { p_period: 'season' }); } catch (e) { box.textContent = ''; box.append(errorNote(e)); return; }
  box.textContent = '';
  const medal = (p) => ({ 1: '🥇', 2: '🥈', 3: '🥉' })[p] || p + '.';
  const rows = (d.rows || []).slice(0, 5);
  box.append(h('p', { class: 'small muted', style: 'margin:-6px 0 10px' }, (d.season?.name || 'Season') + ' · Pepe Pictures nights'));
  if (!rows.length) box.append(h('p', { class: 'muted' }, 'Nobody has scored yet. Join the next Pepe Pictures night and grab first place!'));
  else box.append(h('table', { class: 'gtable top5' }, h('tbody', {}, rows.map((r) => h('tr', {},
    h('td', { class: 'medal' }, medal(r.place)), h('td', {}, h('b', {}, r.nick), ' ', badge(r.verified)), h('td', { class: 'num mono' }, r.points + ' pts'))))));
  box.append(h('p', { style: 'margin:12px 0 0' }, h('a', { href: 'ranking.html' }, 'Full leaderboard & Hall of Fame →')));
}

// ---------- host: set the date of the next night right here ----------
async function renderSchedHost() {
  const box = $('#sched-host'); box.textContent = '';
  let me = null; try { me = await meInfo(be); } catch {}
  if (!me?.can_host) return;
  const ev = eventInfo();
  const local = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const title = h('input', { type: 'text', id: 'sh-title', maxlength: 80, value: ev.fallback ? 'Pepe Pictures · Game Night' : ev.title, 'aria-label': 'Title' });
  const at = h('input', { type: 'datetime-local', id: 'sh-at', value: ev.at ? local(ev.at) : '', 'aria-label': 'Date and time' });
  const quick = h('div', { class: 'row', style: 'gap:6px' }, h('span', { class: 'small' }, 'Quick pick (20:00 Poland time):'),
    [['Fri', 'Friday'], ['Sat', 'Saturday'], ['Sun', 'Sunday']].map(([wd, name]) => h('button', { type: 'button', class: 'btn sm', onclick: () => { const d = nextWeekday20(wd, new Date(Date.now() + offset)); if (d) at.value = local(d); } }, name)));
  const form = h('div', { class: 'sched-form hidden', id: 'sh-form' },
    h('div', { class: 'grid2', style: 'gap:10px' }, h('div', {}, h('label', { for: 'sh-title' }, 'Title'), title), h('div', {}, h('label', { for: 'sh-at' }, 'Date and time (your local time)'), at)),
    quick,
    h('div', { class: 'row', style: 'margin-top:10px' }, h('button', { class: 'btn primary sm', id: 'sh-save', onclick: async () => {
      if (!at.value) return toast('Pick a date and time', 'bad');
      try { await be.rpc('gry_set_event', { p_title: title.value, p_mode: 'obrazek', p_starts_at: new Date(at.value).toISOString(), p_room_code: null }); toast('Countdown saved', 'good'); form.classList.add('hidden'); await load(); renderSchedHost(); }
      catch (e) { toast(e.message, 'bad'); } } }, 'Save countdown'),
      h('span', { class: 'small' }, 'Everyone sees it in their own time zone, plus Poland time.')));
  box.append(h('button', { class: 'btn sm', id: 'sh-open', 'aria-expanded': 'false', onclick: (e) => { const open = form.classList.toggle('hidden'); e.target.setAttribute('aria-expanded', String(!open)); } }, '✏️ Set date of the next night (host)'), form);
}

// ---------- Mini games (Chess / Checkers / Connect Four / Sea Battle) ----------
async function loadTables() {
  const box = $('#tlist');
  let list;
  try { list = await be.rpc('gry_tables_lobby'); } catch (e) { box.textContent = ''; box.append(errorNote(e)); return; }
  box.textContent = '';
  $('#chip-tables').textContent = list.filter((t) => t.status !== 'finished').length;
  if (!list.length) { box.append(h('div', { class: 'empty' }, h('img', { class: 'empty-pic', src: 'img/empty-swing.webp', alt: 'A sad Pepe sitting alone on a swing', width: 640, height: 445, loading: 'lazy' }), h('p', { class: 'muted' }, 'No open tables right now. Open one below and send the invite link to a friend.'))); return; }
  box.append(h('div', { class: 'tscroll' }, h('table', { class: 'gtable tables' },
    h('thead', {}, h('tr', {}, ['Game', 'Host', 'Clock', 'Status', ''].map((x) => h('th', { scope: 'col' }, x)))),
    h('tbody', {}, list.map((t) => {
      const [ico, name] = TGAME[t.game];
      const players = t.players || [];
      const state = t.status === 'waiting' ? 'Waiting for an opponent' : t.status === 'playing' ? `Playing: ${players.join(' vs ')}` : `Game over: ${players.join(' vs ')}`;
      const watching = t.spectators ? (t.watching ? `${t.watching} watching` : 'spectators welcome') : 'no spectators';
      const canWatch = t.status !== 'waiting' && t.spectators;
      return h('tr', { class: 'table-item', 'data-code': t.code },
        h('td', { 'data-label': 'Game' }, h('span', { 'aria-hidden': 'true' }, ico + ' '), h('b', {}, name)),
        h('td', { 'data-label': 'Host' }, t.creator || '?'),
        h('td', { 'data-label': 'Clock' }, h('span', { class: 'pill tc-pill' + (t.timed ? ' timed' : '') }, '⏱ ' + (t.tc || 'No clock') + (t.no_touch ? ' · no-touch' : ''))),
        h('td', { 'data-label': 'Status' }, state, h('br'), h('span', { class: 'small muted' }, watching + ' · table '), h('span', { class: 'small mono' }, t.code)),
        h('td', { class: 'act' }, t.status === 'waiting' ? h('a', { class: 'btn primary sm', href: 'table.html?t=' + t.code }, 'Sit down')
          : canWatch ? h('a', { class: 'btn sm', href: 'table.html?t=' + t.code }, 'Watch') : h('span', { class: 'small muted' }, 'full')));
    })))));
}
function renderNewTable() {
  const box = $('#tcreate'); if (!box) return; box.textContent = '';
  const logged = !!be.session();
  const pick = h('div', { class: 'gcards', role: 'radiogroup', 'aria-label': 'Game' }, Object.entries(TGAME).map(([k, [, name]], i) =>
    h('label', { class: 'gcard' }, h('input', { type: 'radio', name: 'tgame', value: k, checked: i === 0 }),
      h('span', { class: 'gcard-check', 'aria-hidden': 'true' }, '✓'),
      boardPreview(k),
      h('b', { class: 'gcard-name' }, name), h('span', { class: 'gcard-desc' }, TDESC[k][0]), h('span', { class: 'gcard-opt' }, TDESC[k][1]))));
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
  const createBtn = h('button', { class: 'btn primary', id: 'nt-create', disabled: !logged, onclick: async (e) => {
    e.target.disabled = true;
    try {
      const game = box.querySelector('input[name=tgame]:checked').value;
      const c = await be.rpc('gry_table_create', { p_game: game, p_nick: nickStore.get(), p_private: priv.checked, p_spectators: spec.checked, ...tcArgs(),
        ...(game === 'battleship' ? { p_no_touch: noTouch.checked } : {}) });
      location.href = 'table.html?t=' + c;
    } catch (err) { toast(err.message, 'bad'); e.target.disabled = false; }
  } }, 'Create table');
  box.append(h('h3', {}, 'Start a game'), h('p', { class: 'small muted', style: 'margin:0 0 8px' }, '1. Pick a game'), pick,
    h('p', { class: 'small muted', style: 'margin:14px 0 0' }, '2. Choose options'), tcBox,
    h('div', { class: 'topts' }, h('label', {}, priv, 'Private: invite link only (not listed here)'), h('label', {}, spec, 'Allow spectators'), noTouchL),
    h('p', { class: 'small muted', style: 'margin:14px 0 8px' }, '3. Play'),
    h('div', { class: 'tplay' },
      h('div', { class: 'tplay-col' }, h('b', {}, '👥 With a friend or the community'),
        h('div', { class: 'row', style: 'margin-top:8px' }, createBtn, logged ? null : loginHint()),
        h('p', { class: 'small muted', style: 'margin:8px 0 0' }, 'You get an invite link to send. Public tables also show up in the list above.')),
      // vs bot: runs only in this browser (Web Worker), no account needed, nothing saved online
      h('div', { class: 'tplay-col botrow', id: 'botrow' }, h('b', {}, '🤖 Against a bot'),
        h('span', { class: 'tgame-tc', role: 'radiogroup', 'aria-label': 'Bot difficulty' },
          [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']].map(([v, l]) => h('label', { class: 'tc-opt' }, h('input', { type: 'radio', name: 'blevel', value: v, checked: v === 'medium' }), l))),
        h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { class: 'btn', id: 'bot-play', onclick: () => {
          const game = box.querySelector('input[name=tgame]:checked').value, lv = box.querySelector('input[name=blevel]:checked').value;
          location.href = `table.html?bot=${game}&level=${lv}` + (game === 'battleship' && noTouch.checked ? '&notouch=1' : '');
        } }, 'Play vs bot')),
        h('p', { class: 'small muted', style: 'margin:8px 0 0' }, 'The bot plays in your browser: no account, nothing saved online.'))));
  renderTc();
}

// ---------- Pepe Miner card: show the player's own mine if this browser has a save ----------
function minerYou() {
  let st = null; try { st = JSON.parse(localStorage.getItem('pepminer-v1') || 'null'); } catch {}
  if (!st?.started) return;
  const all = st.allTime || st.total || 0, blocks = Math.floor(all / 10000);
  const el = $('#miner-you');
  el.textContent = `Your mine: ${blocks.toLocaleString('en-US')} blocks so far` + (st.forks ? `, ${st.forks} hard fork${st.forks > 1 ? 's' : ''}` : '') + '. Keep going!';
  el.hidden = false;
  $('#game-miner .btn').textContent = 'Continue mining';
}
