// Lobby chat + "online" counter. The database rings a doorbell on the Realtime channel "lobby-chat" when a message
// is written or hidden (supabase/update_lobby_realtime.sql); the chat then asks once for what is new. Without the
// doorbell (not connected yet, or the SQL not run) it falls back to asking every few seconds. Works for visitors
// who are not signed in. Reading and writing are open to everyone: without a sign-in a nickname goes
// with each message (the server limits it per network); a guest or Discord sign-in keeps the same name.
// Text and our own emotes only: the server rejects links, and the page never shows pictures from players.
import { $, h, toast, nickStore } from './common.js';
import { renderBody, attachPicker } from './emotes.js';

export function lobbyChat(be, { openLogin }) {
  const panel = $('#chat'), box = $('#lchat'), form = $('#chatform'), input = $('#chatin'), send = $('#chatsend'), fab = $('#chatfab');
  if (be.kind === 'none') {
    panel.hidden = true; fab.hidden = true;
    document.querySelectorAll('.g-chat').forEach((a) => { a.hidden = true; });
    return { refresh() {} };
  }
  let visitor = '';
  try { visitor = localStorage.getItem('pepgry-visitor') || ''; if (!visitor) { visitor = crypto.randomUUID(); localStorage.setItem('pepgry-visitor', visitor); } }
  catch { visitor = crypto.randomUUID(); }
  const msgs = new Map();
  let last = 0, mod = false, timer = 0, busy = false, again = false, first = true, readyAt = 0, mutedUntil = null;
  const phone = matchMedia('(max-width: 900px)');
  const watching = () => !document.hidden && (!phone.matches || panel.classList.contains('open'));
  // the doorbell: while it is connected, the chat only asks every 60 s (the "online" counter needs one call within 90 s)
  let live = false, ringT = 0, want = 0, force = false;
  // a burst of rings makes one call, spread over a second so not every open chat asks at the same moment
  const ring = (id) => {
    if (id) want = Math.max(want, id); else force = true;
    if (!ringT) ringT = setTimeout(() => { ringT = 0; if (force || want > last) { force = false; poll(); } }, 300 + Math.random() * 700);
  };
  if (be.kind === 'supabase') {
    try {
      be.channel('lobby-chat', (ev, p) => {
        if (ev === 'new') ring(Number(p && p.id) || 0);
        else if (ev === 'hidden') ring();   // hidden messages come back in the "hidden" list of the next call
      }, () => { live = true; ring(); }, (st) => { if (st !== 'SUBSCRIBED') live = false; });
    } catch (e) { live = false; }
  }

  const hhmm = (at) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  function line(m) {
    const row = h('div', { class: 'cmsg', 'data-id': m.id },
      h('span', { class: 'ct' }, hhmm(m.at)),
      h('b', { class: 'cn' }, m.nick), m.verified ? h('span', { class: 'cv', title: 'Verified with Discord' }, '✓') : '', ': ',
      h('span', { class: 'cb' }, ...renderBody(m.body)));
    if (mod) row.append(h('span', { class: 'cmod' },
      h('button', { type: 'button', title: 'Hide this message', 'aria-label': 'Hide this message', onclick: () => act('gry_lobby_hide', { p_id: m.id }, 'Message hidden') }, '🗑'),
      h('button', { type: 'button', title: 'Mute this player for 24 hours', 'aria-label': 'Mute ' + m.nick + ' for 24 hours',
        onclick: () => { if (confirm(`Mute ${m.nick} in the lobby chat for 24 hours? Their messages from today are hidden too.`)) act('gry_lobby_mute_msg', { p_id: m.id, p_hours: 24 }, m.nick + ' is muted for 24 hours'); } }, '🔇')));
    return row;
  }
  async function act(fn, args, ok) {
    try { await be.rpc(fn, args); toast(ok, 'good'); reload(); } catch (e) { toast(e.message, 'bad'); }
  }
  function reload() { last = 0; first = true; msgs.clear(); if (busy) again = true; else poll(); }
  function setOnline(n) {
    document.querySelectorAll('.online-n').forEach((el) => { el.textContent = n; });
    document.querySelectorAll('.g-online, .chip-online, .chat-online').forEach((el) => { el.hidden = false; });
  }
  // without a sign-in, a small nickname box sits in front of the message box
  const nickIn = h('input', { type: 'text', class: 'chat-nick', maxlength: 20, placeholder: 'Nickname', 'aria-label': 'Nickname', autocomplete: 'nickname', value: nickStore.get() });
  form.prepend(nickIn);
  function paintInput() {
    const signed = !!be.session(), muted = mutedUntil && Date.parse(mutedUntil) > Date.now();
    nickIn.hidden = signed && (nickStore.get() || '').length >= 2;   // signed in on a new device with no saved nickname: ask for one
    input.readOnly = muted;
    send.disabled = muted || Date.now() < readyAt;
    input.placeholder = muted ? `You are muted until ${hhmm(mutedUntil)}` : 'Say gm…';
    send.textContent = 'Send';
  }
  async function poll() {
    clearTimeout(timer);
    if (busy) { again = true; return; }
    busy = true;
    try {
      const r = await be.rpc('gry_lobby_chat', { p_after: last, p_visitor: visitor });
      setOnline(r.online);
      mutedUntil = r.muted_until;
      if (again) return;   // the answer is out of date (signed in, or a reload was asked for): ask again
      if (!!r.can_mod !== mod) { mod = !!r.can_mod; if (last) { last = 0; first = true; msgs.clear(); again = true; return; } }
      if (first) box.textContent = '';
      (r.hidden || []).forEach((id) => { msgs.get(id)?.remove(); msgs.delete(id); });
      const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
      for (const m of r.messages || []) {
        if (msgs.has(m.id)) continue;
        const el = line(m); msgs.set(m.id, el); box.append(el); last = Math.max(last, m.id);
      }
      while (msgs.size > 120) { const [id, el] = msgs.entries().next().value; el.remove(); msgs.delete(id); }
      if (msgs.size) box.querySelector('.cempty')?.remove();
      else if (!box.querySelector('.cempty')) box.append(h('p', { class: 'muted small cempty' }, 'No messages in the last 24 hours. Say gm!'));
      if (first || atBottom) box.scrollTop = box.scrollHeight;
      first = false;
      paintInput();
    } catch (e) {
      if (first) { box.textContent = ''; box.append(h('p', { class: 'muted small cempty' }, 'The chat can\'t be reached right now. Trying again…')); }
    } finally {
      busy = false;
      if (again) { again = false; poll(); } else timer = setTimeout(poll, live ? 60000 : watching() ? 4000 : 25000);
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || Date.now() < readyAt) return;
    let nick = nickStore.get() || '';
    if (!nickIn.hidden) {
      nick = nickIn.value.trim();
      if (nick.length < 2) { toast('Pick a nickname first (2 to 20 letters or digits)', 'bad'); nickIn.focus(); return; }
      nickStore.set(nick);
    }
    send.disabled = true;
    try {
      const r = await be.rpc('gry_lobby_say', { p_text: text, p_nick: nick });
      if (r?.error) { toast(r.error, 'bad'); input.value = ''; }
      else { input.value = ''; readyAt = Date.now() + 3000; setTimeout(paintInput, 3100); }
      poll();
    } catch (err) {
      const w = /wait (\d+)s/.exec(err.message || '');
      if (w) { readyAt = Date.now() + Number(w[1]) * 1000; setTimeout(paintInput, Number(w[1]) * 1000 + 100); }
      toast(err.message, 'bad');
    } finally { paintInput(); }
  });
  attachPicker(form, input);

  // phone: the chat opens as a panel from the round button (or the "Chat" link in the games menu)
  const setOpen = (open) => {
    panel.classList.toggle('open', open); fab.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('chat-open', open && phone.matches);
    if (open) { box.scrollTop = box.scrollHeight; poll(); }
  };
  fab.addEventListener('click', () => setOpen(!panel.classList.contains('open')));
  panel.querySelector('.chat-x').addEventListener('click', () => setOpen(false));
  document.querySelectorAll('.g-chat').forEach((a) => a.addEventListener('click', (e) => { if (phone.matches) { e.preventDefault(); setOpen(true); } }));
  if (location.hash === '#chat' && phone.matches) setOpen(true);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });

  paintInput();
  poll();
  return { refresh() { paintInput(); reload(); } };
}
