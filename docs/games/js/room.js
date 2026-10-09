import { $, h, toast, getBackend, identityCard, badge, nickStore, backendBanner, paintMe } from './common.js';

const code = (new URLSearchParams(location.search).get('r') || '').toUpperCase();
if (!/^[A-Z0-9]{5}$/.test(code)) location.replace('./');
const be = await getBackend();
backendBanner($('#main')); paintMe(be);
document.title = `Room ${code} · PEP Games`;

// ---------- stan ----------
let S = null, offset = 0, roomCh = null, turnCh = null, turnTopic = null, curTurn = null;
let fetching = null, refetch = false, lastTick = 0, hintMarks = new Set(), localNotes = [], seenVersion = -1, overlaySig = '';
const cv = $('#cv'), ctx = cv.getContext('2d');
const W = 1000, H = 700;
const now = () => Date.now() + offset;
const meId = () => S?.me?.user_id;
const isRoomHost = () => S && meId() === S.room.host_id;
const isDrawer = () => S && S.room.mode === 'kalambury' && S.room.phase === 'turn' && S.room.drawer_id === meId();
const isImgHost = () => S && S.room.mode === 'obrazek' && isRoomHost();
const modName = () => S?.room.mode === 'kalambury' ? 'room moderator' : 'host';

function blank() { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
blank();

// ---------- wejście do pokoju ----------
async function enter(nick) {
  try {
    const s = await be.rpc('gry_join', { p_code: code, p_nick: nick });
    $('#joinbox').classList.add('hidden');
    $('#room').classList.remove('hidden');
    subscribeRoom();
    if (!$('#leave')) $('.players h3').append(h('button', { class: 'btn sm', id: 'leave', title: 'Leave this room', onclick: async () => {
      try { await be.rpc('gry_leave', { p_code: code }); } catch {}
      location.href = './';
    } }, 'Leave'));
    apply(s);
    setInterval(() => fetchState(), 10000);
    setInterval(loop, 250);
  } catch (e) {
    toast(e.message, 'bad');
    if (/removed you|does not exist|closed/.test(e.message)) message(e.message);
  }
}
function message(text, sub = '') {
  $('#room').classList.add('hidden'); $('#joinbox').classList.add('hidden');
  const b = $('#msgbox'); b.classList.remove('hidden'); b.textContent = '';
  b.append(h('h2', {}, text), sub ? h('p', { class: 'muted' }, sub) : null, h('a', { class: 'btn primary', href: './' }, 'Back to lobby'));
  roomCh?.close(); turnCh?.close();
}

(async () => {
  if (be.session()) {
    try {
      const s = await be.rpc('gry_state', { p_code: code });
      if (s.me.kicked) return message('You were removed from this room.');
      if (s.room.status !== 'open') return message('This room is closed.');
      if (s.me.joined) return enter(s.me.nick);
    } catch (e) { return message(e.message); }
  }
  const jb = $('#joinbox'); jb.classList.remove('hidden');
  const inner = h('div'); jb.append(inner, h('p', { class: 'small muted', style: 'margin-bottom:0' }, 'Room ', h('b', { class: 'mono' }, code)));
  identityCard(inner, { cta: 'Join game', onReady: (nick) => enter(nick) });
})();

// ---------- realtime ----------
function subscribeRoom() {
  roomCh = be.channel('room:' + code, (event, p) => {
    if (event === 'msg') { if (p.msg) addMsg(p.msg); else fetchState(); return; }
    if (event === 'kicked' && p.user_id === meId()) return message('You were removed from this room.');
    if (event === 'closed') return message('This room was closed.', 'Thanks for playing! 🐸');
    if (event === 'joined' && p.user_id !== meId()) resendForLateJoiner();
    if (p.v == null || p.v > seenVersion) fetchState();
  });
}
async function fetchState() {
  if (fetching) { refetch = true; return fetching; }
  fetching = be.rpc('gry_state', { p_code: code }).then(apply).catch((e) => console.warn(e)).finally(() => {
    fetching = null; if (refetch) { refetch = false; fetchState(); }
  });
  return fetching;
}
async function tick() {
  if (Date.now() - lastTick < 1200) return;
  lastTick = Date.now();
  try { await be.rpc('gry_tick', { p_code: code }); } catch {}
  fetchState();
}

// ---------- stan → widok ----------
function apply(s) {
  if (!s) return;
  if (s.me.kicked) return message('You were removed from this room.');
  if (s.room.status !== 'open') return message('This room was closed.', 'Thanks for playing! 🐸');
  offset = Date.parse(s.now) - Date.now();
  const prev = S; S = s; seenVersion = s.room.version;
  syncCooldownFromState();
  if (prev && prev.room.host_id !== s.room.host_id && s.room.host_id === meId() && s.room.mode === 'kalambury')
    toast('You are now the room moderator 🛡️ You can start, restart and kick.', 'good');
  if (s.room.turn_id !== curTurn) onNewTurn(s.room.turn_id);
  if (s.room.phase === 'finished' && prev?.room.phase !== 'finished') blank();
  if (s.room.mode === 'kalambury' && prev?.room.phase !== 'turn' && s.room.phase === 'turn' && isDrawer()) toast('Your turn! Draw: ' + s.secret, 'good');
  if (prev && prev.room.phase === 'turn' && s.room.phase === 'reveal' && isImgHost()) sendFinalImage();
  renderPlayers(); renderTop(); renderOverlay(); renderTools(); renderHostbar(); renderImgPanel(); renderMsgs(s.messages);
  $('#cwrap').classList.toggle('can-draw', isDrawer());
  $('#cwrap').classList.toggle('pixel', s.room.mode === 'obrazek');
  const ci = $('#chatin');
  ci.placeholder = isDrawer() ? 'Chat (no spoilers!)' : s.room.phase !== 'turn' ? 'Chat' : (s.me.guessed ? 'Chat with players who got it 🤫' : (isImgHost() ? 'Chat (you are the host)' : 'Type your guess…'));
}

function onNewTurn(turnId) {
  curTurn = turnId; hintMarks = new Set(); strokes.clear();
  turnCh?.close(); turnCh = null; turnTopic = null;
  blank();
  if (!turnId) return;
  turnTopic = (S.room.mode === 'kalambury' ? 'draw:' : 'img:') + code + ':' + turnId;
  turnCh = be.channel(turnTopic, onTurnMsg);
  if (isImgHost()) startImageStages();
}

const PLACE = { 1: '🥇 1st', 2: '🥈 2nd', 3: '🥉 3rd' };
function spotsLine() {
  const r = S.room; if (r.mode !== 'obrazek' || !['turn', 'reveal'].includes(r.phase) || !S.spots) return null;
  const pod = S.podium || [], left = Math.max(0, S.spots - pod.length);
  return h('div', { class: 'small', id: 'spots', style: 'margin-top:4px;font-weight:600' },
    pod.map((g) => h('span', { class: 'badge host', style: 'margin-right:6px' }, `${PLACE[g.place]} guessed it! ${g.nick}`)),
    r.phase === 'turn' ? (left ? `${left} spot${left === 1 ? '' : 's'} left` : 'All spots taken') : null);
}
function renderPlayers() {
  const ul = $('#plist'); ul.textContent = '';
  $('#pcount').textContent = S.players.length;
  for (const p of S.players) {
    const drawing = S.room.mode === 'kalambury' && S.room.phase === 'turn' && p.user_id === S.room.drawer_id;
    ul.append(h('li', { class: [drawing && 'drawing', p.guessed && 'got', p.user_id === meId() && 'me'].filter(Boolean).join(' '), title: p.active ? '' : 'away' },
      h('span', { 'aria-hidden': 'true' }, drawing ? '✏️' : p.guessed ? '✅' : p.is_host ? '👑' : p.active ? '🐸' : '💤'),
      h('span', { class: 'nick' }, p.nick, ' ', badge(p.verified, p.is_host, true, S.room.mode === 'kalambury' ? 'mod' : 'host'),
        p.place ? h('span', { class: 'badge host podium', title: PLACE[p.place] + ' guessed it!' }, PLACE[p.place] + ' guessed it!') : null),
      h('span', { class: 'row', style: 'gap:4px;flex-wrap:nowrap' }, h('span', { class: 'score' }, p.score),
        isRoomHost() && p.user_id !== meId() ? h('button', { class: 'kick', title: 'Kick ' + p.nick, 'aria-label': 'Kick ' + p.nick, onclick: async () => {
          if (!confirm(`Kick ${p.nick} from the room?`)) return;
          try { await be.rpc('gry_kick', { p_code: code, p_user: p.user_id }); } catch (e) { toast(e.message, 'bad'); }
        } }, '✕') : null)));
  }
}
function renderTop() {
  const r = S.room, w = $('#word');
  $('#roundinfo').textContent = '';
  $('#roundinfo').append(...(r.mode === 'kalambury'
    ? [h('b', {}, `Round ${Math.max(1, r.round_no)}/${r.rounds}`), h('br'), `${r.title} · casual`]
    : [h('b', {}, r.round_no ? `Picture #${r.round_no}` : 'Pictures'), h('br'), r.title + (r.match_id ? (r.ranked ? ' · ranked' : ' · unranked') : '')]));
  w.className = 'word'; w.textContent = ''; w.removeAttribute('data-secret');
  const nLetters = (S.mask || '').replace(/[^_A-ZĄĆĘŁŃÓŚŹŻ0-9]/g, '').length;
  if (r.phase === 'turn' && S.secret) { w.classList.add('secret'); w.dataset.secret = '1'; w.append(h('small', {}, r.mode === 'kalambury' ? 'Your word to draw' : 'Answer (only you can see it)'), S.secret); }
  else if (r.phase === 'turn' && inCountdown()) { w.classList.add('plain'); w.append(h('small', {}, 'Get ready'), 'Picture incoming… 👀'); }
  else if (r.phase === 'turn') w.append(h('small', {}, S.me.guessed ? (r.mode === 'obrazek' ? `You got it! (+${4 - ((S.podium || []).find((g) => g.user_id === meId())?.place || 3)})` : 'You got it! Waiting for the others') : `Guess the word (${nLetters} letter${nLetters === 1 ? '' : 's'})`), S.mask || '');
  else if (r.phase === 'reveal') { w.classList.add('secret'); w.append(h('small', {}, r.mode === 'kalambury' ? 'The word was' : 'The answer was'), r.last_answer || ''); }
  else if (r.phase === 'waiting') { w.classList.add('plain'); w.append(h('small', {}, r.last_answer ? 'Last answer: ' + r.last_answer : ''), isImgHost() ? 'Pick a picture ↓' : 'Host is picking a picture…'); }
  else if (r.phase === 'finished') { w.classList.add('plain'); w.append('Game over 🏁'); }
  else { w.classList.add('secret'); w.append(h('small', {}, 'Room code'), code); }
  const sl = spotsLine(); if (sl) w.append(sl);
}
// ---------- nakładka: lobby / odliczanie 3-2-1 / odsłonięcie / przerywnik „Next round” / koniec ----------
const COUNTDOWN_MS = 3000;     // odliczanie przed obrazkiem (czas ustala serwer: turn_started_at = moment pokazania)
const INTERMISSION_MS = 4000;  // ostatnie 4 s fazy „reveal” w kalamburach = karta „Next round”
const inCountdown = () => S && S.room.mode === 'obrazek' && S.room.phase === 'turn' && S.room.turn_started_at && now() < Date.parse(S.room.turn_started_at);
function overlayView() {
  const r = S.room;
  if (r.phase === 'turn' && inCountdown()) return 'cd' + Math.min(3, Math.max(1, Math.ceil((Date.parse(r.turn_started_at) - now()) / 1000)));
  if (r.phase === 'reveal' && r.mode === 'kalambury' && r.next_at && Date.parse(r.next_at) - now() <= INTERMISSION_MS) return 'intermission';
  return r.phase;
}
// Przerywnik: żabka Byla (pepecoin.com, ze znakiem wodnym). Lekkie wideo (WebM/MP4, bez dźwięku, w pętli) zamiast GIF-a.
// Jeden element tworzony od razu przy wejściu do pokoju (preload), potem tylko podpinany do karty — pokazuje się od razu.
// prefers-reduced-motion: statyczna pierwsza klatka.
const FROG_IMG = new URL('../img/', import.meta.url).href;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let frogVideo = null, frogStill = null;
function preloadFrog() {
  frogStill = h('img', { class: 'inter-media', src: FROG_IMG + 'frog-break-poster.webp', alt: '', width: 400, height: 282, decoding: 'async', 'aria-hidden': 'true' });
  if (reducedMotion.matches) return;
  frogVideo = h('video', { class: 'inter-media', muted: true, loop: true, playsinline: true, autoplay: true, preload: 'auto',
    poster: FROG_IMG + 'frog-break-poster.webp', width: 400, height: 282, disablepictureinpicture: true, 'aria-hidden': 'true', tabindex: '-1' },
    h('source', { src: FROG_IMG + 'frog-break.webm', type: 'video/webm' }),
    h('source', { src: FROG_IMG + 'frog-break.mp4', type: 'video/mp4' }));
  frogVideo.muted = true; frogVideo.defaultMuted = true; frogVideo.playsInline = true;
  frogVideo.load();
}
preloadFrog();
let frogWasOn = false;
function frogMedia() {
  if (!frogVideo || reducedMotion.matches) return frogStill;
  if (!frogWasOn) { try { frogVideo.currentTime = 0; } catch {} }   // nowy przerywnik: od początku; odświeżenie karty: bez skoku
  queueMicrotask(() => frogVideo.play().catch(() => {}));   // autoplay zablokowany → zostaje plakat (pierwsza klatka)
  return frogVideo;
}
function renderOverlay(force) {
  const o = $('#overlay'), r = S.room, view = overlayView();
  const sig = [view, r.turn_id, r.phase === 'lobby' ? S.players.length : '', r.phase === 'finished' ? JSON.stringify(S.results) : '',
    JSON.stringify(S.next || null), r.last_answer, isRoomHost()].join('|');
  if (!force && sig === overlaySig) return;
  frogWasOn = !!frogVideo?.isConnected;
  overlaySig = sig; o.textContent = ''; o.className = 'overlay';
  frogVideo?.pause();
  let show = true;
  if (view === 'lobby') {
    o.append(h('div', {}, h('div', { class: 'big' }, `Waiting for the ${modName()} to start`),
      h('p', {}, `${S.players.length} in the room · invite friends: `, h('b', { class: 'mono' }, location.href.split('#')[0])),
      isRoomHost() ? h('button', { class: 'btn primary big', onclick: start }, '▶ Start game') : h('p', { class: 'small', style: 'opacity:.85' }, `The ${modName()} starts the game.`)));
  } else if (view.startsWith('cd')) {
    o.classList.add('countdown-ov');
    o.append(h('div', { class: 'cd-wrap' }, h('div', { class: 'cd-label' }, `Picture #${r.round_no} · get ready`),
      h('div', { class: 'cd-num', role: 'timer', 'aria-live': 'assertive' }, view.slice(2)),
      h('div', { class: 'small', style: 'opacity:.85' }, 'Type your guess as soon as it shows up')));
  } else if (view === 'intermission') {
    const nx = S.next || {};
    o.classList.add('intermission-ov');
    o.append(h('div', { class: 'inter-card' }, frogMedia(),
      h('div', { class: 'inter-title' }, nx.final ? 'That\'s a wrap!' : (nx.round_no && nx.round_no !== r.round_no ? `Round ${nx.round_no} of ${nx.rounds}` : 'Next round')),
      h('div', { class: 'inter-sub' }, nx.final ? 'Final scores coming up…' : nx.user_id === meId() ? 'You\'re drawing next! ✏️' : nx.nick ? `${nx.nick} is drawing next` : 'Get ready…'),
      h('div', { class: 'small', style: 'opacity:.8;margin-top:6px' }, 'The word was ', h('b', {}, r.last_answer || '?'), ' · ', h('span', { id: 'nextin' }, ''))));
  } else if (view === 'reveal') {
    o.append(h('div', {}, h('div', {}, r.mode === 'kalambury' ? 'The word was:' : 'The answer was:'), h('div', { class: 'ans' }, r.last_answer || '?')));
    if (r.mode === 'obrazek') { o.classList.add('reveal-bar'); }
  } else if (view === 'waiting' && !isImgHost()) {
    o.classList.add('intermission-ov');
    o.append(h('div', { class: 'inter-card' }, frogMedia(), h('div', { class: 'inter-title' }, 'Next picture coming up'),
      h('div', { class: 'inter-sub' }, 'The host is picking one…'),
      r.last_answer ? h('div', { class: 'small', style: 'opacity:.8;margin-top:6px' }, 'Last answer: ', h('b', {}, r.last_answer)) : null));
  } else if (view === 'waiting' && isImgHost()) {
    o.append(h('div', {}, h('div', { class: 'big' }, 'Pick a picture and an answer below ↓')));
  } else if (view === 'finished') {
    o.append(h('div', {}, h('img', { class: 'frog-s', src: 'img/frog-winner.svg', alt: '', width: 84, height: 109 }), h('div', { class: 'big' }, '🏁 Game over!'),
      h('table', {}, h('tbody', {}, (S.results || []).slice(0, 8).map((x) => h('tr', {}, h('td', {}, ({ 1: '🥇', 2: '🥈', 3: '🥉' })[x.place] || x.place + '.'), h('td', {}, x.nick, x.verified ? ' ✓' : ''), h('td', {}, x.points))))),
      h('div', { class: 'row', style: 'justify-content:center;margin-top:14px' }, r.mode === 'kalambury' ? h('span', { class: 'small', style: 'opacity:.85;align-self:center' }, 'Just for fun: scores reset with the next game') : h('a', { class: 'btn', href: 'ranking.html' }, '🏆 Leaderboard'),
        isRoomHost() ? h('button', { class: 'btn primary', onclick: start }, '↻ Play again') : null)));
  } else show = false;
  o.classList.toggle('hidden', !show);
  updateNextIn();
}
function updateNextIn() {
  const ni = $('#nextin'); if (!ni || !S?.room.next_at) return;
  const sec = Math.max(0, Math.ceil((Date.parse(S.room.next_at) - now()) / 1000));
  ni.textContent = S.next?.final ? `results in ${sec}s` : `starting in ${sec}s`;
}
// płynne przejścia zależne od czasu serwera (odliczanie, przerywnik) — sprawdzane co klatkę, renderowane tylko przy zmianie widoku
function frame() {
  if (S) {
    const v = overlayView();
    if (!overlaySig.startsWith(v + '|')) { renderOverlay(); if (!v.startsWith('cd')) renderTop(); }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
async function start() { try { await be.rpc('gry_start', { p_code: code }); fetchState(); } catch (e) { toast(e.message, 'bad'); } }

function renderHostbar() {
  const b = $('#hostbar'); b.textContent = '';
  const r = S.room, host = isRoomHost();
  b.classList.toggle('hidden', !host);
  if (!host) return;
  const act = (label, fn, cls = 'btn sm') => h('button', { class: cls, onclick: async () => { try { await fn(); fetchState(); } catch (e) { toast(e.message, 'bad'); } } }, label);
  b.append(h('span', { class: 'lbl' }, r.mode === 'kalambury' ? 'Moderator' : 'Host'));
  if (['lobby', 'finished'].includes(r.phase)) b.append(act('▶ Start', () => be.rpc('gry_start', { p_code: code }), 'btn sm primary'));
  if (r.phase === 'turn') b.append(act(r.mode === 'kalambury' ? '⏭ Skip turn' : '⏭ Reveal now', () => be.rpc('gry_skip', { p_code: code })));
  if (!['lobby', 'finished'].includes(r.phase)) b.append(act('🏁 End game', () => be.rpc('gry_finish', { p_code: code })));
  b.append(act('🔗 Copy link', async () => { await navigator.clipboard?.writeText(location.href.split('#')[0]); toast('Link copied'); }));
  b.append(act('Close room', async () => { if (confirm('Close the room for everyone?')) await be.rpc('gry_close_room', { p_code: code }); }, 'btn sm danger'));
}

// ---------- czat ----------
function addMsg(m) {
  if (!S) return;
  if (S.messages.some((x) => x.id === m.id)) return;
  S.messages.push(m); renderMsgs(S.messages);
}
function renderMsgs(list) {
  const box = $('#msgs'), stick = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
  box.textContent = '';
  const notesAfter = (id) => localNotes.filter((n) => n.after === id);
  for (const n of notesAfter(0)) box.append(h('p', { class: 'close' }, n.text));
  for (const m of list) {
    if (m.kind === 'system') box.append(h('p', { class: 'sys' }, m.body));
    else if (m.kind === 'correct') box.append(h('p', { class: 'sys ok' }, '🎉 ' + m.body));
    else box.append(h('p', { class: m.scope === 'guessed' ? 'priv' : '' }, h('b', {}, m.nick + ': '), m.body));
    for (const n of notesAfter(m.id)) box.append(h('p', { class: 'close' }, n.text));
  }
  if (stick) box.scrollTop = box.scrollHeight;
}
// Draw & Guess anti-spam: po każdej wiadomości przycisk wyłączony z odliczaniem „Send (3)”; serwer i tak pilnuje limitu
let sendReadyAt = 0, cdTimer = null;
function cooldownSecs() { return S?.room?.mode === 'kalambury' ? Number(S.cooldown || 0) : 0; }
function startCooldown(secs) {
  if (!(secs > 0)) return;
  sendReadyAt = Math.max(sendReadyAt, Date.now() + secs * 1000);
  renderSend();
}
function renderSend() {
  const btn = $('#chatsend'); if (!btn) return;
  const left = Math.ceil((sendReadyAt - Date.now()) / 1000);
  clearTimeout(cdTimer);
  if (left > 0) {
    btn.disabled = true; btn.textContent = `Send (${left})`;
    btn.title = `Slow down — wait ${left}s`;
    cdTimer = setTimeout(renderSend, Math.min(1000, sendReadyAt - Date.now() - (left - 1) * 1000 + 20));
  } else { btn.disabled = false; btn.textContent = 'Send'; btn.title = ''; }
}
function syncCooldownFromState() {
  const left = Number(S?.me?.cooldown_left || 0);
  if (cooldownSecs() > 0 && left > 0 && Date.now() + left * 1000 > sendReadyAt + 300) startCooldown(left);
}
$('#chatform').addEventListener('submit', async (e) => {
  e.preventDefault();
  const inp = $('#chatin'), text = inp.value.trim();
  if (!text) return;
  if (Date.now() < sendReadyAt) { renderSend(); return; }   // Enter też respektuje odliczanie; tekst zostaje w polu
  inp.value = '';
  const btn = $('#chatsend'); if (btn) btn.disabled = true;
  try {
    const r = await be.rpc('gry_guess', { p_code: code, p_text: text });
    startCooldown(cooldownSecs());   // liczone od odpowiedzi serwera, więc nie wyprzedzi limitu po stronie serwera
    if (r?.correct) toast(`Nice! +${r.points} pts`, 'good');
    else if (r?.close) { localNotes.push({ after: S.messages.at(-1)?.id || 0, text: `"${text}" is close! 🔥` }); renderMsgs(S.messages); }
  } catch (err) {
    const w = /wait (\d+)s/.exec(err.message || '');
    if (w) startCooldown(Number(w[1]));
    toast(err.message, 'bad'); inp.value = text;
  } finally { renderSend(); }
});

// ---------- pętla czasu ----------
function loop() {
  if (!S) return;
  const r = S.room, n = now();
  let left = null, total = r.turn_seconds;
  if (r.phase === 'turn' && r.turn_ends_at) left = (Date.parse(r.turn_ends_at) - n) / 1000;
  const t = $('#timer'), arc = $('#timer-arc');
  if (left == null) { $('#timer-n').textContent = '–'; arc.style.strokeDashoffset = 0; t.classList.remove('low'); }
  else {
    left = Math.min(left, total);   // w trakcie odliczania 3-2-1 zegar stoi na pełnym czasie
    $('#timer-n').textContent = Math.max(0, Math.ceil(left));
    arc.style.strokeDashoffset = String(138.2 * (1 - Math.max(0, left) / total));
    t.classList.toggle('low', left < 10);
    const frac = 1 - left / total;
    for (const m of [0.4, 0.6, 0.8]) if (frac >= m && !hintMarks.has(m)) { hintMarks.add(m); if (frac < m + 0.1) fetchState(); }
  }
  const master = isDrawer() || isRoomHost();
  if (r.phase === 'turn' && n > Date.parse(r.turn_ends_at) + (master ? 150 : 1500)) tick();
  if (r.phase === 'reveal' && r.next_at) {
    updateNextIn();
    if (n > Date.parse(r.next_at) + (master ? 150 : 1500)) tick();
  }
  if (isImgHost()) imageHostLoop();
  if (isDrawer()) flushStrokes();
}

// ---------- rysowanie (kalambury) ----------
const COLORS = ['#15201b', '#ffffff', '#269B4D', '#16532A', '#d23c2f', '#f2a33a', '#f5d90a', '#2f6fd2', '#79559f', '#8a5a2b', '#f19ac2', '#9aa3a0'];
const SIZES = [4, 9, 18, 36];
let color = COLORS[0], size = SIZES[1], strokeId = 0, cur = null, buf = [];
const strokes = new Map(); // id -> last point (u odbiorców)
function renderTools() {
  const t = $('#tools'); const show = isDrawer();
  t.classList.toggle('hidden', !show);
  if (!show || t.dataset.ready) return;
  t.dataset.ready = '1'; t.textContent = '';
  for (const c of COLORS) t.append(h('button', { class: 'swatch', style: `background:${c}`, 'aria-label': c === '#ffffff' ? 'Eraser (white)' : 'Color ' + c, 'aria-pressed': String(c === color),
    onclick: (e) => { color = c; t.querySelectorAll('.swatch').forEach((x) => x.setAttribute('aria-pressed', String(x === e.currentTarget))); } }));
  t.append(h('span', { class: 'sep' }));
  for (const s of SIZES) t.append(h('button', { class: 'size', 'aria-label': 'Brush size ' + s, 'aria-pressed': String(s === size),
    onclick: (e) => { size = s; t.querySelectorAll('.size').forEach((x) => x.setAttribute('aria-pressed', String(x === e.currentTarget))); } },
    h('i', { style: `width:${Math.max(4, s / 2)}px;height:${Math.max(4, s / 2)}px` })));
  t.append(h('span', { class: 'sep' }),
    h('button', { class: 'btn sm', onclick: () => { blank(); turnCh?.send('clear', {}); } }, '🗑 Clear'),
    h('button', { class: 'btn sm', onclick: async () => { try { await be.rpc('gry_skip', { p_code: code }); } catch (e) { toast(e.message, 'bad'); } } }, '⏭ Skip'));
}
new MutationObserver(() => { if ($('#tools').classList.contains('hidden')) delete $('#tools').dataset.ready; }).observe($('#tools'), { attributes: true, attributeFilter: ['class'] });

function pos(e) { const r = cv.getBoundingClientRect(); return [Math.round((e.clientX - r.left) / r.width * W), Math.round((e.clientY - r.top) / r.height * H)]; }
function seg(c, w, a, b) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
cv.addEventListener('pointerdown', (e) => {
  if (!isDrawer()) return;
  cv.setPointerCapture(e.pointerId); e.preventDefault();
  const p = pos(e); cur = { id: ++strokeId, c: color, w: size, last: p };
  seg(color, size, p, p); buf.push({ id: cur.id, c: color, w: size, p: [p[0], p[1]] });
});
cv.addEventListener('pointermove', (e) => {
  if (!cur || !isDrawer()) return;
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for (const ev of evs) {
    const p = pos(ev);
    if (Math.abs(p[0] - cur.last[0]) + Math.abs(p[1] - cur.last[1]) < 3) continue;
    seg(cur.c, cur.w, cur.last, p); cur.last = p;
    let b = buf.at(-1);
    if (!b || b.id !== cur.id) { b = { id: cur.id, c: cur.c, w: cur.w, p: [] }; buf.push(b); }
    b.p.push(p[0], p[1]);
  }
});
const endStroke = () => { cur = null; };
cv.addEventListener('pointerup', endStroke); cv.addEventListener('pointercancel', endStroke);
// paczkowanie: limit wiadomości Supabase Free = 100/s na projekt → im więcej graczy, tym rzadziej wysyłamy
let lastFlush = 0;
function flushStrokes(force) {
  const every = Math.max(120, (S?.players.length || 1) * 20);   // ≈50 doręczeń/s niezależnie od liczby graczy
  if (!buf.length || (!force && Date.now() - lastFlush < every)) return;
  lastFlush = Date.now();
  turnCh?.send('d', { s: buf.splice(0) });
}
function onTurnMsg(event, p) {
  if (S?.room.mode === 'kalambury') {
    if (isDrawer()) return;
    if (event === 'd') for (const s of p.s) {
      let last = strokes.get(s.id);
      for (let i = 0; i < s.p.length; i += 2) {
        const pt = [s.p[i], s.p[i + 1]];
        seg(s.c, s.w, last || pt, pt); last = pt;
      }
      strokes.set(s.id, last);
    }
    else if (event === 'clear') { blank(); strokes.clear(); }
    else if (event === 'snap') { const im = new Image(); im.onload = () => ctx.drawImage(im, 0, 0, W, H); im.src = p.data; }
  } else if (event === 'stage' && !isImgHost()) drawStage(p);
}
function resendForLateJoiner() {
  if (isDrawer()) { flushStrokes(true); setTimeout(() => turnCh?.send('snap', { data: cv.toDataURL('image/jpeg', 0.6) }), 300); }
  if (isImgHost() && img.sent >= 0) setTimeout(() => sendStage(img.sent, true), 300);
}

// ---------- Zgadnij obrazek ----------
const PRESETS = [
  { src: 'img/preset-frog-circle.jpg', answer: 'frog / pepe' }, { src: 'img/preset-pickaxe.png', answer: 'pickaxe / pick' },
  { src: 'img/preset-triple-mine.jpg', answer: 'mine / mining / miner' }, { src: 'img/preset-rocket.png', answer: 'rocket' },
  { src: 'img/preset-candles.png', answer: 'candles / chart / candlestick' }, { src: 'img/preset-moon.png', answer: 'moon' },
];
const LEVELS = [6, 9, 14, 22, 34, 56, 90];
const img = { el: null, answer: '', stages: [], sent: -1, turn: null };
let pickIdx = 0, uploaded = null;
function renderImgPanel() {
  const p = $('#imgpanel'), show = isImgHost() && ['waiting', 'reveal'].includes(S.room.phase);
  p.classList.toggle('hidden', !show);
  if (!show) { delete p.dataset.ready; return; }
  if (p.dataset.ready) return;
  p.dataset.ready = '1'; p.textContent = '';
  const ans = h('input', { type: 'text', id: 'imgans', maxlength: 60, value: PRESETS[pickIdx]?.answer || '', placeholder: 'e.g. frog / pepe' });
  const secs = h('select', { id: 'imgsecs' }, [30, 45, 60, 90, 120].map((s) => h('option', { value: s, selected: s === 120 }, s === 120 ? '2 min (max)' : s + ' s')));
  const grid = h('div', { class: 'imgpick' });
  const mark = () => grid.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String(i === pickIdx)));
  PRESETS.forEach((pr, i) => grid.append(h('button', { type: 'button', 'aria-label': 'Picture: ' + pr.answer, onclick: () => { pickIdx = i; uploaded = null; ans.value = pr.answer; mark(); } }, h('img', { src: pr.src, alt: '' }))));
  const file = h('input', { type: 'file', accept: 'image/*', id: 'imgfile', class: 'small', onchange: (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 8e6) return toast('File too big (max 8 MB)', 'bad');
    uploaded = URL.createObjectURL(f); pickIdx = -1; ans.value = ''; mark(); ans.focus(); toast('Picture loaded. Now type the answer');
  } });
  mark();
  p.append(h('h3', {}, '🖼️ Next picture'), grid,
    h('div', { class: 'row', style: 'margin-top:10px' }, h('label', { for: 'imgfile', style: 'margin:0' }, 'or upload your own:'), file),
    h('div', { class: 'row', style: 'margin-top:10px;align-items:end' },
      h('div', { style: 'flex:1;min-width:200px' }, h('label', { for: 'imgans' }, 'Answer (separate alternatives with "/")'), ans),
      h('div', {}, h('label', { for: 'imgsecs' }, 'Time'), secs),
      h('button', { class: 'btn primary', id: 'imgstart', onclick: async () => {
        const src = uploaded || PRESETS[pickIdx]?.src;
        if (!src) return toast('Pick a picture', 'bad');
        try {
          await prepareImage(src, ans.value);
          await be.rpc('gry_image_start', { p_code: code, p_answer: ans.value, p_seconds: +secs.value });
          pickIdx = (pickIdx + 1) % PRESETS.length; uploaded = null;
          fetchState();
        } catch (e) { toast(e.message, 'bad'); }
      } }, '▶ Show (3-2-1)')),
    h('p', { class: 'small muted', style: 'margin:8px 0 0' }, 'First 3 correct guesses score 3 / 2 / 1 points; the round ends after the 3rd correct guess or when time runs out (max 2 minutes). Everyone sees a 3-2-1 countdown first, then the picture appears for all players at the same moment. Players only receive pixelated versions (no peeking at the original in the browser). The full picture is sent after it is guessed or time runs out.'));
}
function loadImg(src) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('Could not load the picture')); im.src = src; }); }
async function prepareImage(src, answer) {
  const im = await loadImg(src);
  const ratio = im.naturalHeight / im.naturalWidth;
  const mk = (w, type, q) => { const c = document.createElement('canvas'); c.width = w; c.height = Math.max(1, Math.round(w * ratio));
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, c.width, c.height); return c.toDataURL(type, q); };
  img.stages = LEVELS.map((w) => mk(w, 'image/png')).concat(mk(Math.min(900, im.naturalWidth), 'image/jpeg', 0.82));
  img.el = im; img.answer = answer; img.sent = -1; img.turn = null;
}
function startImageStages() { if (img.stages.length) { img.turn = curTurn; img.sent = -1; } }
function stageNow() {
  const r = S.room; if (r.phase !== 'turn') return img.stages.length - 1;
  const frac = (now() - Date.parse(r.turn_started_at)) / (r.turn_seconds * 1000);
  return Math.min(LEVELS.length - 1, Math.max(0, Math.floor(frac / 0.85 * LEVELS.length)));
}
function imageHostLoop() {
  if (!img.stages.length || img.turn !== curTurn || S.room.phase !== 'turn') return;
  const i = stageNow();
  if (i !== img.sent) sendStage(i);
}
function sendStage(i, resend) {
  if (!img.stages[i]) return;
  if (!resend) img.sent = i;
  const p = { i, n: img.stages.length, data: img.stages[i] };
  turnCh?.send('stage', p); drawStage(p);
}
function sendFinalImage() { if (img.stages.length && img.turn === curTurn) sendStage(img.stages.length - 1); }
function drawStage(p) {
  loadImg(p.data).then((im) => {
    blank();
    const sc = Math.min(W / im.naturalWidth, H / im.naturalHeight), w = im.naturalWidth * sc, hh = im.naturalHeight * sc;
    ctx.imageSmoothingEnabled = p.i === p.n - 1;
    ctx.drawImage(im, (W - w) / 2, (H - hh) / 2, w, hh);
    ctx.imageSmoothingEnabled = true;
  });
}
window.addEventListener('pagehide', () => { roomCh?.close(); turnCh?.close(); });
