import { getBackend, MODE, TEST_BUILD, DISCORD_ENABLED, REDDIT_ENABLED } from './backend.js';
export { MODE, TEST_BUILD, DISCORD_ENABLED };

try { const th = localStorage.getItem('phw-theme'); if (th === 'light' || th === 'dark') document.documentElement.setAttribute('data-theme', th); } catch {}

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
let toastT;
export function toast(msg, kind = '') {
  $('.toast')?.remove(); clearTimeout(toastT);
  const t = h('div', { class: 'toast ' + kind, role: 'status' }, msg); document.body.append(t);
  toastT = setTimeout(() => t.remove(), 3200);
}
export const badge = (verified, isHost, short = false, hostLabel = 'host') => [
  verified ? h('span', { class: 'badge ver', title: 'Verified via Discord' }, short ? '✓' : '✓ verified') : h('span', { class: 'badge guest', title: 'Guest: nickname is not reserved' }, 'guest'),
  isHost ? h('span', { class: 'badge host', title: hostLabel === 'mod' ? 'Room moderator: can start, restart and kick' : 'Event host' }, hostLabel) : null,
];
export const nickStore = { get: () => localStorage.getItem('pepgry-nick') || '', set: (n) => localStorage.setItem('pepgry-nick', n) };

// Daty po angielsku w czasie lokalnym gracza (gracze są z różnych stref); fmtPoland = czas polski (Europe/Warsaw)
export function fmtLocal(d, opts = {}) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', ...opts }).format(d);
}
export function fmtPoland(d, opts = {}) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Warsaw', hour: 'numeric', minute: '2-digit', ...opts }).format(d);
}
function warsawOffsetMin(date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Warsaw', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(date).map((x) => [x.type, x.value]));
  return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - date.getTime()) / 60000;
}
// najbliższy piątek 20:00 czasu polskiego (domyślny termin, gdy host nic nie ustawił)
export function nextFriday20(now = new Date()) {
  for (let i = 0; i < 8; i++) {
    const d = new Date(now.getTime() + i * 86400000);
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(d).map((x) => [x.type, x.value]));
    if (p.weekday !== 'Fri') continue;
    const guess = new Date(Date.UTC(+p.year, +p.month - 1, +p.day, 20, 0));
    const t = new Date(guess.getTime() - warsawOffsetMin(guess) * 60000);
    if (t.getTime() + 3 * 3600000 > now.getTime()) return t;
  }
  return null;
}

export function backendBanner(el) {
  if (MODE === 'supabase' && TEST_BUILD) el.prepend(h('div', { class: 'card small', style: 'margin:14px 0 0;padding:10px 14px;border-style:dashed' },
    '🧪 Private test build. Scores here are test data and will be wiped. Discord login coming soon, play as a guest.'));
  if (MODE === 'local') el.prepend(h('div', { class: 'card small', style: 'margin:14px 0 0;padding:10px 14px;border-style:dashed' },
    '🧪 Private test build. Scores here are test data and don\'t count. Discord login is simulated.'));
  if (MODE === 'none') el.prepend(h('div', { class: 'card small', style: 'margin:14px 0 0;padding:10px 14px;background:var(--warn-bg);color:var(--warn-ink)' },
    'Live rooms are coming soon. You can already play against the bot below.'));
}

export async function meInfo(be) {
  if (!be.session()) return null;
  try { return await be.rpc('gry_me'); } catch { return null; }
}

export async function paintMe(be) {
  const el = $('.g-me'); if (!el) return;
  const me = await meInfo(be);
  el.textContent = '';
  el.classList.toggle('in', !!me?.user_id);
  if (me?.user_id) el.append('Playing as ', h('b', {}, (me.verified ? '✓ ' : '') + (me.nick || me.discord_name || nickStore.get() || '—')), me.verified ? '' : ' (guest)');
  else el.append('Not signed in · pick a nickname');
}

// Modal „Discord” w emulatorze (w produkcji jest prawdziwe przekierowanie do Discorda)
function mockDiscordModal() {
  return new Promise((resolve) => {
    const dlg = h('dialog', { class: 'card', style: 'max-width:420px;border:0' },
      h('form', { method: 'dialog', class: 'stack' },
        h('h2', {}, 'Discord (simulated)'),
        h('p', { class: 'small muted' }, 'This test build has no real Discord login. On the live site this button opens the real Discord login. Just type a name.'),
        h('div', {}, h('label', { for: 'md-name' }, 'Discord name'), h('input', { type: 'text', id: 'md-name', required: true, maxlength: 20 })),
        h('div', {}, h('label', { for: 'md-id' }, 'Discord ID (optional)'), h('input', { type: 'text', id: 'md-id', inputmode: 'numeric' })),
        h('div', { class: 'row' }, h('button', { class: 'btn discord', value: 'ok' }, 'Log in'), h('button', { class: 'btn', value: 'cancel', formnovalidate: true }, 'Cancel'))));
    document.body.append(dlg);
    dlg.addEventListener('close', () => {
      const v = dlg.returnValue === 'ok' ? { name: $('#md-name', dlg).value.trim(), discord_id: $('#md-id', dlg).value.trim() } : null;
      dlg.remove(); resolve(v);
    });
    dlg.showModal();
  });
}

// Karta „Kim grasz?” — gość z nickiem albo Discord (zweryfikowany). onReady(nick) wywołane, gdy jest sesja.
export async function identityCard(container, { onReady, cta = 'Play' } = {}) {
  const be = await getBackend();
  const render = async () => {
    container.textContent = '';
    const me = await meInfo(be);
    container.classList.add('identity'); container.classList.toggle('is-in', !!me?.user_id);
    const nickIn = h('input', { type: 'text', id: 'nick', maxlength: 20, placeholder: 'e.g. GreenFrog', autocomplete: 'nickname',
      value: (me?.verified && me?.nick) || nickStore.get() || (me?.discord_name ?? '') });
    const go = async (fn) => {
      const nick = nickIn.value.trim();
      if (!nick && !(me?.verified)) { nickIn.focus(); return toast('Enter a nickname', 'bad'); }
      try { await fn(); nickStore.set(nick); await paintMe(be); await render(); onReady?.(nick); }
      catch (e) { toast(e.message, 'bad'); }
    };
    if (!me?.user_id) {
      container.append(
        h('span', { class: 'id-step' }, 'Step 1'), h('h2', {}, 'Who are you?'),
        h('div', {}, h('label', { for: 'nick' }, 'Your nickname'), nickIn),
        h('div', { class: 'row', style: 'margin-top:12px' },
          h('button', { class: 'btn primary', id: 'btn-guest', onclick: () => go(() => be.guest()) }, `${cta} as guest`),
          DISCORD_ENABLED ? h('button', { class: 'btn discord', id: 'btn-discord', onclick: async () => {
            try {
              if (be.kind === 'local') { const v = await mockDiscordModal(); if (!v) return; await be.discord(v); if (!nickIn.value.trim()) nickIn.value = v.name; }
              else { nickStore.set(nickIn.value.trim()); await be.discord(); return; }   // przekierowanie do Discorda
              nickStore.set(nickIn.value.trim()); await paintMe(be); onReady?.(nickIn.value.trim()); render();
            } catch (e) { toast(e.message, 'bad'); }
          } }, discordIcon(), 'Log in with Discord')
          : h('button', { class: 'btn discord', id: 'btn-discord', disabled: true, title: 'Discord login coming soon', 'aria-describedby': 'discord-soon' }, discordIcon(), 'Discord login coming soon'),
          REDDIT_ENABLED ? h('button', { class: 'btn reddit', id: 'btn-reddit', onclick: async () => {
            try { nickStore.set(nickIn.value.trim()); await be.reddit?.(); } catch (e) { toast(e.message, 'bad'); }
          } }, redditIcon(), 'Log in with Reddit')
          : h('button', { class: 'btn reddit', id: 'btn-reddit', disabled: true, title: 'Reddit login coming soon', 'aria-describedby': 'discord-soon' }, redditIcon(), 'Reddit login coming soon')),
        DISCORD_ENABLED ? h('p', { class: 'small muted', style: 'margin:12px 0 0' },
          h('b', {}, 'Guest:'), ' no sign-up, pick a nickname and play. ',
          h('b', {}, 'Discord:'), ' your nickname is reserved for you and you get the ', h('span', { class: 'badge ver' }, '✓ verified'), ' badge on the leaderboard. We never ask for your email or wallet.')
        : h('p', { class: 'small muted', id: 'discord-soon', style: 'margin:12px 0 0' },
          h('b', {}, 'Guest:'), ' no sign-up, pick a nickname and play. ',
          h('b', {}, 'Discord & Reddit login coming soon.'), ' We never ask for your email or wallet.'));
    } else {
      container.append(
        h('span', { class: 'id-step ok' }, '✓ Signed in'), h('h2', {}, 'Playing as ', h('span', { class: 'id-name' }, me.nick || me.discord_name || nickStore.get() || 'guest')),
        h('div', {}, h('label', { for: 'nick' }, me.verified ? 'Nickname (reserved for your Discord)' : 'Nickname'), nickIn),
        h('div', { class: 'row', style: 'margin:10px 0' }, badge(me.verified)),
        h('div', { class: 'row' },
          h('button', { class: 'btn primary', id: 'btn-play', onclick: () => go(async () => {}) }, cta),
          h('button', { class: 'btn sm', onclick: async () => { await be.logout(); await paintMe(be); render(); } }, 'Log out / switch')));
    }
  };
  await render();
  return render;
}
export function redditIcon() {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '18'); s.setAttribute('height', '18'); s.setAttribute('aria-hidden', 'true');
  s.innerHTML = '<path fill="currentColor" d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm6.7 12.1a1.6 1.6 0 0 1 .9 1.4c0 .3-.1.6-.2.8.1.2.1.4.1.6 0 2.7-3.100 4.800-7 4.800s-7-2.100-7-4.800c0-.2 0-.4.1-.6a1.600 1.600 0 0 1 1.700-2.700 7.700 7.700 0 0 1 4.200-1.300l.8-3.800 2.700.6a1.200 1.200 0 1 1-.1.600l-2.100-.5-.6 3a7.700 7.700 0 0 1 4.100 1.300 1.600 1.600 0 0 1 1.400-.4ZM8.500 13.200a1.200 1.200 0 1 0 0 2.400 1.200 1.200 0 0 0 0-2.400Zm7 0a1.200 1.200 0 1 0 0 2.400 1.200 1.200 0 0 0 0-2.400Zm-.3 3.500a.4.4 0 0 0-.6 0 3.600 3.600 0 0 1-2.600.8 3.600 3.600 0 0 1-2.600-.8.400.4 0 0 0-.6.600 4.300 4.300 0 0 0 3.200 1.100 4.300 4.300 0 0 0 3.200-1.100.4.400 0 0 0 0-.6Z"/>';
  return s;
}
export function discordIcon() {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '18'); s.setAttribute('height', '18'); s.setAttribute('aria-hidden', 'true');
  s.innerHTML = '<path fill="currentColor" d="M20.3 4.4A19.6 19.6 0 0 0 15.4 3l-.6 1.3a18 18 0 0 0-5.6 0L8.6 3a19.6 19.6 0 0 0-4.9 1.5C.6 9.1-.3 13.6.1 18a19.8 19.8 0 0 0 6 3l1.3-2a12.7 12.7 0 0 1-2-1l.5-.4a14 14 0 0 0 12.2 0l.5.4-2 1 1.3 2a19.7 19.7 0 0 0 6-3c.5-5.1-.8-9.6-3.7-13.6ZM8 15.3c-1.2 0-2.2-1.1-2.2-2.4S6.8 10.5 8 10.5s2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z"/>';
  return s;
}
// ---------- sezon (dane z gry_season / gry_lobby) ----------
export function fmtLeft(ms) {
  const s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400), hh = Math.floor(s / 3600) % 24, m = Math.floor(s / 60) % 60;
  return d ? `${d}d ${hh}h` : hh ? `${hh}h ${m}m` : `${m}m ${s % 60}s`;
}
export function seasonLine(se, nowMs = Date.now()) {
  if (!se) return '';
  if (se.phase === 'pre') return `${se.next_name} starts in ${fmtLeft(Date.parse(se.next_starts_at) - nowMs)}`;
  if (se.phase === 'break') return `${se.break_name} · no ranked games · ${se.next_name} starts in ${fmtLeft(Date.parse(se.next_starts_at) - nowMs)}`;
  return `${se.name} · week ${se.week}/${se.weeks} · ${se.break_name.toLowerCase()} in ${fmtLeft(Date.parse(se.ends_at) - nowMs)}`;
}
export { getBackend };
