// Chat stickers: pictures from img/stickers/manifest.json. Only the sticker id is sent; the server accepts only ids
// from its own list (games.stickers) and applies the chat rate limit. Unknown ids are shown as plain text.
import { h } from './common.js';

const BASE = 'img/stickers/';
let list = null, loading = null;
export function loadStickers() {
  if (list) return Promise.resolve(list);
  return loading || (loading = fetch(BASE + 'manifest.json', { cache: 'no-cache' }).then((r) => r.ok ? r.json() : { stickers: [] })
    .then((m) => (list = (m.stickers || []).filter((s) => /^[a-z0-9][a-z0-9_-]{1,31}$/.test(s.id) && /^[\w.-]+\.(webp|png|svg|gif|jpe?g)$/i.test(s.file))))
    .catch(() => (list = [])));
}
const byId = (id) => (list || []).find((s) => s.id === id);

// Message body for a sticker message. Draws a placeholder first and swaps in the picture once the manifest is loaded.
export function stickerEl(id) {
  const box = h('span', { class: 'sticker', title: id }, ':' + id + ':');
  loadStickers().then(() => {
    const s = byId(id); if (!s) return;
    box.textContent = ''; box.title = s.label || id;
    box.append(h('img', { src: BASE + s.file, alt: s.label || id, width: 96, height: 96, loading: 'lazy' }));
  });
  return box;
}

// Adds a 🐸 button next to the chat box. send(id) must return a promise (the RPC call).
export function attachStickerPicker(form, send) {
  const btn = h('button', { type: 'button', class: 'btn emote-btn sticker-btn', 'aria-label': 'Stickers', 'aria-expanded': 'false', title: 'Stickers' }, '🐸');
  const pop = h('div', { class: 'emote-pop hidden', role: 'group', 'aria-label': 'Stickers' });
  const close = () => { pop.classList.add('hidden'); btn.setAttribute('aria-expanded', 'false'); };
  const fill = async () => {
    const all = await loadStickers(); pop.textContent = '';
    if (!all.length) return pop.append(h('p', { class: 'small muted' }, 'No stickers yet.'));
    for (const s of all) pop.append(h('button', { type: 'button', class: 'emote-pick', title: s.label || s.id, 'aria-label': 'Send sticker: ' + (s.label || s.id),
      onclick: () => { close(); send(s.id); } }, h('img', { src: BASE + s.file, alt: '' })));
  };
  btn.addEventListener('click', async () => {
    const open = pop.classList.contains('hidden');
    if (open) { await fill(); pop.classList.remove('hidden'); } else pop.classList.add('hidden');
    btn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') close(); });
  document.addEventListener('click', (ev) => { if (!form.contains(ev.target)) close(); });
  form.style.position = 'relative';
  form.insertBefore(btn, form.querySelector('#chatsend'));
  form.append(pop);
}
