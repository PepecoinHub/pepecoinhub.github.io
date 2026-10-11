// Emotes: typed in chat as :code: and drawn as small pictures. The server stores plain text, so this works
// without any database change. "host" emotes are offered only to the host/moderator in the picker.
import { h } from './common.js';

export const EMOTES = [
  { code: 'peek', label: 'Peeking' },
  { code: 'ready', label: 'Ready!' },
  { code: 'waiting', label: 'Waiting…' },
  { code: 'pep', label: 'PEP' },
  { code: 'cheer', label: 'Hooray!' },
  { code: 'torch', label: 'Torch' },
  { code: 'hug', label: 'Hello!' },
  { code: 'chair', label: 'Sitting' },
  { code: 'crayon', label: 'Drawing' },
  { code: 'smoke', label: 'Chillin\'' },
  { code: 'scream', label: 'Aaaah!' },
  { code: 'serious', label: 'Time to be serious' },
  { code: 'hurry', label: 'Hurry up!' },
  { code: 'news', label: 'Breaking news' },
  { code: 'loading', label: 'Loading…' },
  { code: 'crowd', label: 'Everybody!' },
];
const BY = Object.fromEntries(EMOTES.map((e) => [e.code, e]));
const src = (c) => `img/emotes/${c}.webp`;

export function emoteImg(code, cls = 'emote') {
  return h('img', { class: cls, src: src(code), alt: ':' + code + ':', title: BY[code]?.label || code, width: 40, height: 40, loading: 'lazy' });
}
// Turns "gg :peek: wow" into text + <img> nodes. Unknown :words: stay as text.
export function renderBody(text) {
  const out = []; let i = 0; const re = /:([a-z]{3,10}):/g; let m;
  while ((m = re.exec(text))) {
    if (!BY[m[1]]) continue;
    if (m.index > i) out.push(text.slice(i, m.index));
    out.push(emoteImg(m[1])); i = m.index + m[0].length;
  }
  if (i < text.length) out.push(text.slice(i));
  return out;
}
// Adds a 😀 button next to the chat box. isHost() is asked each time the picker opens.
export function attachPicker(form, input, isHost = () => false) {
  const btn = h('button', { type: 'button', class: 'btn emote-btn', 'aria-label': 'Emotes', 'aria-expanded': 'false', title: 'Emotes' }, '😀');
  const pop = h('div', { class: 'emote-pop hidden', role: 'group', 'aria-label': 'Emotes' });
  const fill = () => {
    pop.textContent = '';
    for (const e of EMOTES) {
      pop.append(h('button', { type: 'button', class: 'emote-pick', title: e.label, 'aria-label': e.label,
        onclick: () => { input.value = (input.value + ' :' + e.code + ':').trim(); input.focus(); close(); } }, emoteImg(e.code, 'emote-big')));
    }
  };
  const close = () => { pop.classList.add('hidden'); btn.setAttribute('aria-expanded', 'false'); };
  btn.addEventListener('click', () => {
    const open = pop.classList.contains('hidden');
    if (open) { fill(); pop.classList.remove('hidden'); } else pop.classList.add('hidden');
    btn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') close(); });
  document.addEventListener('click', (ev) => { if (!form.contains(ev.target)) close(); });
  form.style.position = 'relative';
  form.insertBefore(btn, form.querySelector('#chatsend'));
  form.append(pop);
}
