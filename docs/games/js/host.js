import { $, h, toast, getBackend, identityCard, meInfo, backendBanner, paintMe } from './common.js';
const be = await getBackend();
backendBanner($('#main')); paintMe(be);

async function refresh() {
  const me = await meInfo(be);
  $('#hostlogin').classList.toggle('hidden', !me?.user_id || me.can_host);
  $('#hostpanel').classList.toggle('hidden', !me?.can_host);
  if (me?.user_id && !me.can_host) renderLogin();
  if (me?.can_host) renderPanel();
}
function renderLogin() {
  const box = $('#hostlogin'); box.textContent = '';
  const code = h('input', { type: 'password', id: 'hostcode', autocomplete: 'off', placeholder: 'Host code' });
  box.append(h('h2', {}, 'Host login'),
    h('p', { class: 'small muted' }, 'Enter the host code, or log in with a Discord account that is on the host list.'),
    h('form', { class: 'row', onsubmit: async (e) => {
      e.preventDefault();
      try { if (await be.rpc('gry_host_login', { p_code: code.value })) { toast('You are a host for the next 12 hours', 'good'); refresh(); } else toast('Wrong code', 'bad'); }
      catch (err) { toast(err.message, 'bad'); }
    } }, h('div', { style: 'flex:1;min-width:200px' }, code), h('button', { class: 'btn primary' }, 'Log in')));
}
async function renderPanel() {
  const box = $('#hostpanel'); box.textContent = '';
  const mode = h('select', { id: 'mode' }, h('option', { value: 'obrazek', selected: true }, '🖼️ Guess the Picture (ranked)'), h('option', { value: 'kalambury' }, '✏️ Draw & Guess (casual)'));
  const title = h('input', { type: 'text', id: 'title', value: 'Guess the Picture · Game Night', maxlength: 40 });
  const rounds = h('input', { type: 'number', id: 'rounds', value: 3, min: 1, max: 10, disabled: true });
  const secs = h('input', { type: 'number', id: 'secs', value: 120, min: 15, max: 120 });
  mode.addEventListener('change', () => { title.value = mode.value === 'kalambury' ? 'PEP Draw & Guess' : 'Guess the Picture · Game Night'; secs.value = mode.value === 'kalambury' ? 80 : 120; secs.max = mode.value === 'kalambury' ? 180 : 120; rounds.disabled = mode.value !== 'kalambury'; });
  const evTitle = h('input', { type: 'text', id: 'evtitle', value: 'Friday Game Night · Guess the Picture', maxlength: 80 });
  const evAt = h('input', { type: 'datetime-local', id: 'evat' });
  const evRoom = h('input', { type: 'text', id: 'evroom', maxlength: 5, placeholder: 'optional' });
  const lobby = await be.rpc('gry_lobby');
  box.append(
    h('div', { class: 'card', style: 'margin-top:16px' }, h('h2', {}, 'New room'),
      h('p', { class: 'small muted', style: 'margin-top:0' }, 'Guess the Picture rooms count for the season leaderboard during the season weeks. Draw & Guess rooms can also be opened by anyone from the lobby (casual).'),
      h('div', { class: 'grid2' }, h('div', {}, h('label', { for: 'mode' }, 'Mode'), mode), h('div', {}, h('label', { for: 'title' }, 'Name'), title),
        h('div', {}, h('label', { for: 'rounds' }, 'Rounds (Draw & Guess: everyone draws once per round)'), rounds), h('div', {}, h('label', { for: 'secs' }, 'Seconds per turn / picture (pictures: max 120)'), secs)),
      h('div', { class: 'row', style: 'margin-top:14px' }, h('button', { class: 'btn primary', id: 'create', onclick: async () => {
        try {
          const c = await be.rpc('gry_create_room', { p_mode: mode.value, p_title: title.value, p_rounds: +rounds.value, p_seconds: +secs.value });
          toast('Room ' + c + ' is ready', 'good'); location.href = 'room.html?r=' + c;
        } catch (e) { toast(e.message, 'bad'); }
      } }, 'Create room and join'))),
    h('div', { class: 'card', style: 'margin-top:16px' }, h('h2', {}, 'Schedule (card on the games page)'),
      h('div', { class: 'grid2' }, h('div', {}, h('label', { for: 'evtitle' }, 'Title'), evTitle), h('div', {}, h('label', { for: 'evat' }, 'When (your local time)'), evAt),
        h('div', {}, h('label', { for: 'evroom' }, 'Room code'), evRoom)),
      h('p', { class: 'small muted' }, lobby.event ? 'Currently set: ' + lobby.event.title + ' · ' + new Date(lobby.event.starts_at).toLocaleString('en-US') : 'Nothing set. The page shows the next Friday 8:00 PM (Poland) by default.'),
      h('button', { class: 'btn', onclick: async () => {
        if (!evAt.value) return toast('Pick a date', 'bad');
        try { await be.rpc('gry_set_event', { p_title: evTitle.value, p_mode: 'obrazek', p_starts_at: new Date(evAt.value).toISOString(), p_room_code: evRoom.value }); toast('Saved', 'good'); renderPanel(); }
        catch (e) { toast(e.message, 'bad'); }
      } }, 'Save date')),
    h('div', { class: 'card', style: 'margin-top:16px' }, h('h2', {}, 'Open rooms'),
      lobby.rooms.length ? lobby.rooms.map((r) => h('div', { class: 'room-item', style: 'margin-bottom:8px' },
        h('div', { class: 'meta' }, h('b', {}, r.title + ' · ' + r.code), h('span', { class: 'small muted' }, r.players + ' player' + (r.players === 1 ? '' : 's'))),
        h('a', { class: 'btn sm', href: 'room.html?r=' + r.code }, 'Join'),
        h('button', { class: 'btn sm danger', onclick: async () => { try { await be.rpc('gry_close_room', { p_code: r.code }); renderPanel(); } catch (e) { toast(e.message, 'bad'); } } }, 'Close'))) : h('p', { class: 'muted' }, 'None.')));
}
await identityCard($('#identity'), { cta: 'Continue', onReady: refresh });
refresh();
