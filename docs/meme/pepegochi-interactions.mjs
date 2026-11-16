// Local cosmetic conversations only. This module never reads or writes pet state.
const lines = {
  hello: ["I'm supervising the pond. Very important frog business.", "Oh hey, fren. I was just thinking about flies.", "PondOS looks better with me on the taskbar."],
  joke: ["Why did the frog cross the road? The pond was on the other side. I never said it was a good joke.", "I tried to mine PEP with a potato. It was a chip.", "I have a great joke about flies. It went over my head."],
  pet: ["Hehe. More of that, fren.", "This is acceptable human behaviour.", "Finally, a useful mouse."],
  annoyed: ["Fren. That's my face.", "I am not a touchscreen.", "The frog requests a little personal space."],
  play: ["Fancy a game? I believe in you. Mostly.", "Let's visit the pond arcade. Do not blame me if you lose."],
  news: ["PondOS has games, stamps and a whole pond of frens. Go explore!", "Check the Pond Quiz, your Fren Passport or the arcade."],
};
const moods = {
  'tb_adult_hungry': "My stomach is making modem noises. Can we visit my room?",
  'tb_adult_dirty': "I smell like a very authentic pond. A bath would be nice.",
  'tb_adult_moody': "Not my finest day, fren. Let's play in my room.",
  'tb_adult_sleepy': "Five more minutes. Please.",
  'tb_adult_neglected': "I missed you, fren. Can we go to my room?",
  'tb_adult_packing': "I've been waiting for you. Please come visit me.",
  'tb_adult_recovering': "I'm getting better. Thank you for looking after me.",
};
function pick(a, n) { return a[Math.abs(Math.trunc(n || 0)) % a.length]; }
export function companionReply(view, action = 'hello', n = 0) {
  if (!view?.hasPet) return { text: '', pose: null, openRoom: true };
  const sprite = String(view.sprite || '').split('/').pop().replace('.png', '');
  const important = moods[sprite];
  // A gesture must never visually hide hunger, exhaustion or other authoritative warning states.
  if (view.warning || ['recovering', 'sleepy', 'neglected', 'packing'].includes(view.motion) || important) {
    const message = important || (view.warning ? "I need you, fren. Let's visit my room." : "I'm taking it easy, fren.");
    return { text: message, pose: null, openRoom: false };
  }
  if (!view.adult) {
    const message = view.motion === 'egg' ? '... *tiny wobble* ...' : '*ribbit!*';
    return { text: message, pose: null, openRoom: false };
  }
  if (action === 'how') return { text: "Feeling pretty good, fren. Thanks for asking.", pose: 'tb_adult_talk', openRoom: false };
  const group = lines[action] || lines.hello;
  return { text: pick(group, n), pose: action === 'pet' || action === 'joke' ? 'tb_adult_laugh' : action === 'annoyed' ? 'tb_adult_moody' : 'tb_adult_talk', openRoom: false };
}

// Only one user-initiated balloon at a time. Touch and keyboard users get the same menu.
// No polling, storage, rewards, account information or network calls.
export function mountFrogInteractions({ button, img, slot, getView, setPose, openRoom, closeQuiz, quizAvailable, openQuiz, now = () => Date.now() }) {
  let panel = null, reply = null, clickTimer = null, recent = [], sequence = 0, gesture = null, suppressClick = false;
  const doc = button.ownerDocument;
  const win = doc.defaultView;
  const el = (tag, cls, text) => {
    const e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e;
  };
  function cancelClick() { if (clickTimer !== null) { win.clearTimeout(clickTimer); clickTimer = null; } }
  function reposition() {
    if (!panel) return;
    const r = slot.getBoundingClientRect(), top = Math.min(r.top, img.getBoundingClientRect().top);
    panel.style.bottom = Math.max(8, win.innerHeight - top + 6) + 'px';
    panel.style.left = Math.max(8, Math.min(r.left, win.innerWidth - panel.offsetWidth - 8)) + 'px';
    panel.style.maxHeight = Math.max(80, top - 12) + 'px';
    panel.style.overflowY = 'auto';
  }
  function close({ focus = false, reset = false } = {}) {
    cancelClick();
    if (reset) { recent = []; sequence = 0; gesture = null; suppressClick = false; }
    if (!panel) return;
    panel.remove(); panel = null; reply = null;
    setPose(null);
    button.setAttribute('aria-expanded', 'false');
    doc.removeEventListener('keydown', key, true);
    win.removeEventListener('resize', reposition);
    if (focus) button.focus();
  }
  function outside(e) {
    if (!button.contains(e.target) && (!panel || !panel.contains(e.target))) close();
  }
  function key(e) {
    if (e.key === 'Escape' && panel) { e.preventDefault(); close({ focus: true }); }
  }
  function visit() { close({ reset: true }); openRoom(); }
  function say(action = 'hello') {
    const r = companionReply(getView(), action, sequence++);
    if (r.openRoom) { visit(); return; }
    closeQuiz();
    const fresh = !panel;
    if (fresh) {
      panel = el('div', 'pg-fact pg-conversation');
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-label', 'Talk to PepeGochi');
      const head = el('div', 'pg-fact-bar');
      const x = el('button', 'pg-fact-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close conversation');
      x.addEventListener('click', () => close({ focus: true }));
      head.append(el('b', null, 'PepeGochi'), x);
      reply = el('p', 'pg-fact-q');
      reply.setAttribute('aria-live', 'polite');
      const actions = el('div', 'pg-fact-answers');
      function add(label, fn) { const b = el('button', 'pg-fact-a', label); b.type = 'button'; b.addEventListener('click', fn); actions.append(b); }
      add('How are you?', () => say('how'));
      add('Tell me a joke', () => say('joke'));
      add("Let's play!", () => say('play'));
      add('Pet me', () => say('pet'));
      add("What's new?", () => say('news'));
      if (quizAvailable()) add('Pond Quiz', () => { close(); openQuiz(); });
      add('Go to your room', visit);
      panel.append(head, reply, actions);
      doc.body.append(panel);
      button.setAttribute('aria-expanded', 'true');
      doc.addEventListener('keydown', key, true);
      win.addEventListener('resize', reposition);
    }
    reply.textContent = r.text;
    setPose(r.pose);
    reposition();
    if (fresh) panel.querySelector('.pg-fact-x')?.focus();
  }
  function click(e) {
    if (suppressClick) { suppressClick = false; return; }
    if (!getView()?.hasPet) { visit(); return; }
    if (e.detail === 0) { say(); return; } // Enter and Space
    if (e.detail === 2) { cancelClick(); visit(); return; }
    if (clickTimer !== null) return;
    clickTimer = win.setTimeout(() => {
      clickTimer = null;
      const t = now(); recent = recent.filter(v => t - v <= 4000); recent.push(t);
      say(recent.length >= 3 ? 'annoyed' : 'hello');
    }, 275);
  }
  function right(e) { e.preventDefault(); cancelClick(); say(); }
  function start(e) {
    suppressClick = false;
    if (e.pointerType !== 'mouse' || e.button !== 0 || e.target !== img || !getView()?.hasPet) return;
    gesture = { x: e.clientX, y: e.clientY, distance: 0 };
  }
  function move(e) {
    if (!gesture) return;
    if (!(e.buttons & 1)) { gesture = null; return; }
    gesture.distance += Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y);
    gesture.x = e.clientX; gesture.y = e.clientY;
    if (gesture.distance >= 36) {
      gesture = null; suppressClick = true; cancelClick(); say('pet');
    }
  }
  function end() { gesture = null; }
  doc.addEventListener('pointerdown', outside, true);
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-expanded', 'false');
  button.addEventListener('click', click);
  button.addEventListener('contextmenu', right);
  button.addEventListener('pointerdown', start);
  button.addEventListener('pointermove', move);
  button.addEventListener('pointerup', end);
  button.addEventListener('pointercancel', end);
  button.addEventListener('pointerleave', end);
  return { close, dispose() {
    close({ reset: true });
    doc.removeEventListener('pointerdown', outside, true);
    button.removeEventListener('click', click);
    button.removeEventListener('contextmenu', right);
    button.removeEventListener('pointerdown', start);
    button.removeEventListener('pointermove', move);
    button.removeEventListener('pointerup', end);
    button.removeEventListener('pointercancel', end);
    button.removeEventListener('pointerleave', end);
    button.removeAttribute('aria-haspopup'); button.removeAttribute('aria-expanded');
  } };
}
