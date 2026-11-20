import { TOYS, healthyCompanion, playableCompanion } from './pepegochi-personality.mjs?v=20261118dialog1';
import { trustedForRumors } from './pepegochi-bond.mjs?v=20261120dialog2';
// Cosmetic conversations; actual needs and care history come from the server view.
const lines = {
  stamp: ["New stamp! Your Passport is becoming dangerously official.", "Another stamp, fren. I supervised from the taskbar."],
  stampBatch: ["Multiple stamps? Leave some room for my autograph.", "Look at that Passport. Very productive human behaviour."],
  secret: ["You found a secret? I saw nothing. Absolutely nothing.", "Hush, fren. The pond has ears. And probably flies."],
  fireflyUnavailable: ['That little light moved away. Try again when a firefly is nearby.'],
  desktopFirefly: ["A tiny lamp with wings. Don't worry, fren, I let it go.", "Did you see that? The pond has its own screensaver."],
  desktopTV: ["Pond TV? Hold on. I need my popcorn.", "The tiny frog demands a front-row seat."],
  desktopBin: ["I inspected the recycling. No flies. Absolute scandal."],
  desktopGames: ["Arcade department, reporting for extremely important frog business."],
  desktopFind: ["Looking for something? I am excellent at looking busy."],
  desktopGuesser: ["I have the geographical instincts of a pond. Trust me at your own risk."],
  desktopNotes: ["Notepad. The finest technology of 1998."],
  desktopNerds: ["Nerds only? Finally, my people."],
  invite: ["I brought a toy. This meeting could have been a nap, but here we are.", "Human. Recreation department needs you. Bring your one functional mouse."],
  toyFavourite: ["This one stays. Touch my snacks if you must. Not my toy.", "Excellent choice. Obviously I trained you well."],
  toyOkay: ["Decent throw. For a creature with thumbs.", "I meant to miss that. Advanced frog technique."],
  toyAgain: ["Fren. Let the toy land first. This isn't a benchmark.", "One frog. Two hands. Zero overtime."],
  gameWin: ["We won. I provided moral superiority.", "Clean win. I'll allow a tiny victory dance."],
  gameLoss: ["Bold strategy. The losing part needs work. Rematch?", "We saw nothing. The pond saw nothing. Queue another one."],
  gameRecord: ["New personal best. Fine, that was actually sick.", "New record. My coaching is clearly working. Invoice pending."],
  gameMoon: ["TO THE MOON. And you brought back a rock. Peak human behaviour."],
  gameDone: ["Solid landing. By which I mean the ground remains undefeated.", "Flight complete. Dignity still in transit."],
  hello: ["I'm supervising the pond. Very important frog business.", "Oh hey, fren. I was just thinking about flies.", "PondOS looks better with me on the taskbar.", "Welcome to my extremely small office.", "I'm busy doing nothing. It's a full-time job.", "I checked the floppy drive. Still no flies.", "The modem screamed. I screamed back.", "My screen saver is called staring at the ceiling."],
  joke: ["Why did the frog cross the road? The pond was on the other side. I never said it was a good joke.", "I tried to mine PEP with a potato. It was a chip.", "I have a great joke about flies. It went over my head.", "A frog walks into a bar. It was the taskbar.", "What does a frog call a broken keyboard? A croak-board.", "My computer has 64 MB of RAM and zero patience.", "I opened a new window. A mosquito flew in.", "I asked the printer for a lily pad. It gave me a paper jam."],
  pet: ["Hehe. More of that, fren. Tell nobody.", "This is acceptable human behaviour. Rare, but acceptable.", "Finally, a useful mouse."],
  annoyed: ["Fren. That's my face.", "I am not a touchscreen.", "The frog requests a little personal space."],
  play: ["Fancy a game? I believe in you. Mostly.", "Let's visit the pond arcade. Do not blame me if you lose."],
  return: ["You're back! I saved your spot beside me.", "There you are, fren. The taskbar is better with you here.", "Welcome back. The flies missed your supervision."],
  returnLong: ["You're back! I saved your seat. And most of the snacks.", "Welcome back, fren. I kept the modem warm.", "There you are. The pond felt a little quiet without you."],
  fed: ["That hit the spot. You remembered my favourite thing: food.", "That hit the spot. Five-star fly cuisine.", "That hit the spot. My compliments to the chef."],
  clean: ["Fresh frog, fresh start. Thanks for the bath, fren.", "Clean enough for a Windows 98 install.", "All shiny. No frog-shaped fingerprints, please."],
  played: ["That was fun. Same team again next time?", "Recreation department: mission complete.", "A very professional play session. I demand a replay."],
  rested: ["Much better. Thanks for letting a little frog recharge.", "A proper recharge. My dreams had dial-up sound effects.", "Recharge complete. No reboot required."],
  grown: ["Look at me! A little bigger, still your fren."],
  quizWin: ["We make a pretty good pond quiz team. You think, I ribbit."],
  quizMiss: ["We learned something together. That's still a good day."],
  offline: ["The pond went quiet. I'll keep you company while the connection is away."],
  online: ["The pond is back! I kept your seat warm."],
  familiar: ["I know that gentle pat. That's my human. Unfortunately for you, I am keeping you.", "Right behind the eyes. You know me well, fren. Do not get smug.", "That's my human. Highly trained in frog maintenance.", "You know me well, fren. This is officially our patch of pond."],
  space: ["Tiny frog break. Let's just sit together for a moment."],
  news: ["PondOS has games, stamps and a whole pond of frens. Go explore!", "Check the Pond Quiz, your Fren Passport or the arcade."],
};
const greetings = {
  morning: ["Morning, fren. The modem is awake before I am.", "Good morning. One fly coffee, please."],
  afternoon: ["Afternoon shift. Frog supervision continues.", "The pond is sunny. My screen is not."],
  evening: ["Evening, fren. Time for CRT glow and comfy socks.", "Prime time on Pond TV. I have the remote."],
  night: ["Still up, fren? The screensaver has been working overtime.", "Night shift. Please don't feed me after bedtime."],
};
const friendship = ["Fourteen good care days? You're practically family, fren.", "This taskbar feels like home with you here.", "After all this time, I still trust you with the remote." ];
const rareLines = ['FROG.EXE has performed an extremely legal operation.', 'My Y2K survival kit contains exactly one emergency fly.', 'Press any key to continue. I am not the any key.'];
export function pepMood(quote, time) {
  const at = Date.parse(quote?.time || '');
  if (!quote || quote.saved || !Number.isFinite(quote.change_24h) || !Number.isFinite(at) || !Number.isFinite(time) || time-at<0 || time-at>3*3600000) return 'unknown';
  return quote.change_24h>=5?'up':quote.change_24h<=-5?'down':'quiet';
}
const marketLines = {up:['PEP had a green day. Even my lava lamp looks jealous.', 'Green candles on the CRT. Still the same frog.'],down:['PEP had a red day. My mug of copium is vintage.', 'Red candles. The pond remains a pond, fren.'],quiet:['Quiet day on the PEP chart. My aquarium is more exciting.', 'The chart is taking a nap. I respect that.'],unknown:['The price screen is off-air. No guesses from this frog.']};
const moods = {
  'tb_adult_hungry': "My stomach is making modem noises. Can we visit my room?",
  'tb_adult_dirty': "I smell like a very authentic pond. A bath would be nice.",
  'tb_adult_moody': "Not my finest day, fren. Let's play in my room.",
  'tb_adult_sleepy': "Five more minutes. Please.",
  'tb_adult_neglected': "I missed you, fren. Can we go to my room?",
  'tb_adult_packing': "I've been waiting for you. Please come visit me.",
  'tb_adult_recovering': "I'm getting better. Thank you for looking after me.",
};
const youngLines = {
  hello: ['*ribbit!* Hi, fren. Still growing!'], how: ['Small frog. Big plans. I am growing every day.'],
  joke: ['What do baby frogs eat? Tiny bugs. My comedy career is also tiny.'], pet: ['*happy wiggle* That tickles!'],
  familiar: ['I recognise that pat, fren!'], space: ['Tiny frog needs a tiny break.'], annoyed: ['*squeak* Easy, fren!'],
  play: ['Let us play! I am practising my first big hops.'], news: ['I am exploring the pond one little hop at a time.'],
  toyFavourite: ['My favourite! *excited wiggle*'], toyOkay: ['Again! That was fun.'], toyAgain: ['Give me a moment to catch up!'],
  desktopFirefly: ['A flying little light! *ribbit!*'], desktopTV: ['Movie time!'],
  market: ['I am too little for charts. Can we look at pond bugs instead?'],
};
const youngNeeds = {hunger:'I am hungry.',hygiene:'I need a bath.',mood:'I could use some playtime.',energy:'I need a rest.'};
function pick(a, n) { return a[Math.abs(Math.trunc(n || 0)) % a.length]; }
export function companionReply(view, action = 'hello', n = 0, context = {}) {
  if (!view?.hasPet) return { text: '', pose: null, openRoom: true };
  const sprite = String(view.sprite || '').split('/').pop().replace('.png', '');
  const important = moods[sprite];
  // A gesture must never visually hide hunger, exhaustion or other authoritative warning states.
  if (view.warning || ['recovering', 'sleepy', 'neglected', 'packing'].includes(view.motion) || important) {
    const message = important || (view.warning ? "I need you, fren. Let's visit my room." : "I'm taking it easy, fren.");
    const extra = action === 'memories' ? ` We have spent ${view.careDays || 0} care days together.` :
      action === 'joke' ? ' A frog walks into a pond. The end.' :
      action === 'pet' || action === 'familiar' ? ' Thank you for checking on me.' :
      action === 'favourite' ? ' My toys can wait until I feel better.' :
      action === 'news' ? ' There is plenty to explore in PondOS.' : '';
    return { text: message + extra, pose: null, openRoom: false };
  }
  if (!view.adult) {
    const small = view.motion === 'egg' ? 'My little egg is still warming up. ' : '';
    let message;
    if (action === 'memories') message = context.journal?.length ? context.journal.join('\n\n') : `We have spent ${view.careDays || 0} care days together.`;
    else if (action === 'favourite') message = context.discovered && TOYS[context.favourite] ? `I really like my ${TOYS[context.favourite].name}!` : 'I am still discovering my favourite toy.';
    else if (action === 'how' && youngNeeds[view.needAttention]) message = youngNeeds[view.needAttention] + ' Let us go to my room.';
    else if (['play','toyFavourite','toyOkay'].includes(action) && !playableCompanion(view)) message = youngNeeds[view.needAttention] ? youngNeeds[view.needAttention] + ' We can play after care.' : 'I need to grow a little more before I can play with desk toys.';
    else message = small + pick(youngLines[action] || lines[action] || youngLines.hello, n);
    return { text: message, pose: null, openRoom: false };
  }
  if (action === 'how') return { text: "Feeling pretty good, fren. Thanks for asking.", pose: 'tb_adult_talk', openRoom: false };
  if (action === 'market') return { text: pick(marketLines[pepMood(context.quote,context.time)],n), pose:'tb_adult_think', openRoom:false };
  if (action === 'memories' && context.journal?.length) return { text: context.journal.join('\n\n'), pose: 'tb_adult_think', openRoom: false };
  if (action === 'favourite') return { text: context.discovered && TOYS[context.favourite]
    ? `The ${TOYS[context.favourite].name}. Mine. You may be its unpaid throwing assistant.`
    : "Offer me a few toys. I'll judge your taste. Silently. Mostly.", pose: 'tb_adult_think', openRoom: false };
  if (action === 'memories') return { text: view.careDays > 0
    ? `You have looked after me on ${view.careDays} care days. Those little visits mean a lot, fren.`
    : "Our story is just starting. A little food, a little play, a little time together.", pose: 'tb_adult_think', openRoom: false };
  let group = lines[action] || lines.hello;
  if(action==='hello' && Number.isFinite(context.time)) {
    const hour=new Date(context.time).getHours();
    if(n>0&&n%23===0) group=rareLines;
    else if(view.careDays>=14&&n%5===0) group=friendship;
    else if(n%3===0) group=greetings[hour<5?'night':hour<12?'morning':hour<18?'afternoon':hour<23?'evening':'night'];
  }
  return { text: pick(group, n), pose: ['pet', 'familiar', 'joke', 'quizWin', 'grown', 'stamp', 'stampBatch'].includes(action) ? 'tb_adult_laugh' : action === 'secret' ? 'tb_adult_think' : action === 'annoyed' ? 'tb_adult_moody' : 'tb_adult_talk', openRoom: false };
}

// Only one user-initiated balloon at a time. Touch and keyboard users get the same menu.
// No polling. Optional care delegates to the host's existing validated server action; bond memories stay cosmetic.
export function mountFrogInteractions({ button, img, slot, getView, setPose, animate = () => {}, showToy = () => {}, openRoom, closeQuiz, quizAvailable, openQuiz, commands = {}, care, bond, getQuote = () => null, canReact = () => true, fireflyAvailable = () => false, catchFirefly = () => {}, readRumors, openPassport, now = () => Date.now() }) {
  let panel = null, reply = null, clickTimer = null, recent = [], sequence = 0, gesture = null, suppressClick = false;
  let careTicket = 0;
  let notice = null, noticeTimer = null, lastReaction = -Infinity, lastPet = -Infinity, pats = [];
  let lastActivity = now(), bornAt = now();
  let rumorTicket = 0, rumorActions = null, rumorOpen = false;
  const doc = button.ownerDocument;
  const context = () => ({...bond,time:now(),quote:getQuote()});
  const win = doc.defaultView;
  const el = (tag, cls, text) => {
    const e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e;
  };
  function clearNotice() {
    if (noticeTimer !== null) win.clearTimeout(noticeTimer);
    noticeTimer = null; notice?.remove(); notice = null;
  }
  function react(action) {
    bond?.remember(action);
    if (panel || bond?.muted || !canReact() || doc.visibilityState === 'hidden' || now() - lastReaction < 45000 || !getView()?.hasPet) return;
    const r = companionReply(getView(), action, sequence++, context());
    clearNotice(); lastReaction = now();
    notice = el('div', 'pg-fact pg-companion-reaction');
    notice.setAttribute('role', 'status');
    notice.style.pointerEvents = 'none';
    notice.append(el('p', 'pg-fact-q', r.text));
    const rect = slot.getBoundingClientRect();
    notice.style.bottom = Math.max(8, win.innerHeight - Math.min(rect.top, img.getBoundingClientRect().top) + 6) + 'px';
    notice.style.left = Math.max(8, Math.min(rect.left, win.innerWidth - 376)) + 'px';
    doc.body.append(notice);
    noticeTimer = win.setTimeout(clearNotice, 6000);
    animate(action);
    return true;
  }
  function invite() {
    if (panel || bond?.muted || !canReact() || doc.visibilityState === 'hidden' ||
        !healthyCompanion(getView()) || now() - bornAt < 90000 || now() - lastActivity < 45000 || now() - lastReaction < 45000) return false;
    if (!bond?.invite()) return false;
    const shown = react('invite');
    if (shown) showToy(bond.favourite);
    return !!shown;
  }
  function activity() { lastActivity = now(); }
  function cancelClick() { if (clickTimer !== null) { win.clearTimeout(clickTimer); clickTimer = null; } }
  function reposition() {
    if (!panel) return;
    const r = slot.getBoundingClientRect(), top = Math.min(r.top, img.getBoundingClientRect().top);
    const frog = img.getBoundingClientRect(), center = frog.left + (frog.width || 48) / 2;
    const left = Math.max(8, Math.min(center - panel.offsetWidth / 2, win.innerWidth - panel.offsetWidth - 8));
    panel.style.bottom = Math.max(8, win.innerHeight - top + 6) + 'px';
    panel.style.left = left + 'px';
    panel.style.setProperty?.('--pg-anchor', Math.max(18,Math.min(panel.offsetWidth-18,center-left))+'px');
    panel.style.maxHeight = Math.max(80, top - 12) + 'px';
    panel.style.overflowY = 'auto';
  }
  function close({ focus = false, reset = false } = {}) {
    careTicket++;
    cancelClick(); clearNotice(); clearRumors();
    if (reset) { lastReaction = lastPet = -Infinity; pats = []; bornAt = now(); }
    if (reset) { recent = []; sequence = 0; gesture = null; suppressClick = false; }
    if (!panel) { setPose(null); return; }
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
  function runCommand(name) {
    const command = commands && commands[name];
    if (typeof command !== 'function') return false;
    close({ reset: true });
    command();
    return true;
  }
  function clearRumors() {
    rumorTicket++; rumorActions?.remove(); rumorActions = null; rumorOpen = false;
  }
  function invalidateRumors() {
    if (!rumorOpen || !panel) return;
    clearRumors();
    reply.textContent = 'A new discovery! Check your Secret Journal for the updated list.';
  }
  async function showRumors(journal = false) {
    clearRumors(); rumorOpen = true;
    const target = panel, ticket = rumorTicket;
    reply.textContent = 'Let me check our Fren Passport...';
    reply.style.whiteSpace = 'pre-line';
    setPose(null);
    let result;
    try { result = await readRumors(); } catch { result = null; }
    if (!panel || panel !== target || ticket !== rumorTicket) return;
    const p = result?.progress;
    if (!journal && !trustedForRumors(getView())) { reply.textContent = 'Let us look after each other first, fren.'; return; }
    if (result?.status !== 'ok' || !p) {
      reply.textContent = result?.status === 'signed-out' ? 'Log in with Discord to read your own secret journal.' : 'The pond is quiet. I could not check your Passport. Try again in a moment.';
      return;
    }
    const summary = `${p.found.length} / ${p.total} rumored secrets found.`;
    const message = journal ? `Secret Journal\n${summary}\n${p.found.length ? p.found.map(title => '• ' + title).join('\n') : 'No discoveries recorded yet. Every detective starts somewhere.'}` :
      `Just between us, fren…\n\n${p.hint || 'I have no more rumors for now. Let us enjoy the pond.'}`;
    reply.textContent = message;
    rumorActions = el('div', 'pg-fact-answers pg-rumor-actions');
    function extra(label, action) {
      const b = el('button', 'pg-fact-a', label); b.type = 'button'; b.addEventListener('click', action); rumorActions.append(b); return b;
    }
    if (openPassport) extra('View journal in Fren Passport', () => { close(); openPassport(); });
    if (rumorActions.childElementCount) reply.after(rumorActions);
    reposition(); panel.scrollTop = 0;
  }
  function say(action = 'hello') {
    clearNotice(); clearRumors();
    const spontaneousRumor = action === 'hello' && !panel;
    if (action === 'hello') action = bond?.take() || action;
    if (action === 'pet') {
      pats = pats.filter(t => now() - t < 10000); pats.push(now());
      if (pats.length > 3) action = 'space';
      else {
        if (bond?.familiar) action = 'familiar';
        if (now() - lastPet > 30000) { bond?.pet(); lastPet = now(); }
      }
    }
    const r = companionReply(getView(), action, sequence++, context());
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
      head.append(el('b', null, getView()?.label || 'PepeGochi'), x);
      reply = el('p', 'pg-fact-q');
      reply.setAttribute('aria-live', 'polite');
      const root = el('div', 'pg-menu-root');
      root.setAttribute('role','group'); root.setAttribute('aria-label','PepeGochi interactions');
      const groups = Object.fromEntries(['care','talk','play','more'].map(id=>{
        const group=el('div','pg-fact-answers pg-menu-group pg-menu-'+id+'-group');
        group.hidden=true; group.setAttribute('role','group'); group.setAttribute('aria-label',id+' interactions');
        return [id,group];
      }));
      const categoryButtons = {};
      const back = el('button','pg-fact-a pg-menu-back','‹ Back'); back.type='button'; back.hidden=true;
      back.setAttribute('aria-label','Back to interactions');
      const category = el('b','pg-menu-heading'); category.hidden=true;
      const nav=el('div','pg-menu-nav');nav.hidden=true;nav.append(back,category);
      let lastCategory=null;
      function navigate(id,focus=true) {
        careTicket++; clearRumors();
        root.hidden=!!id; nav.hidden=!id; back.hidden=!id; category.hidden=!id;
        category.textContent=id ? ({care:'Care',talk:'Talk',play:'Play',more:'More'}[id]) : '';
        for(const [name,group] of Object.entries(groups)) group.hidden=name!==id;
        for(const [name,b] of Object.entries(categoryButtons)) if(name!=='room') b.setAttribute('aria-expanded',String(name===id));
        if(panel) { panel.scrollTop=0; reposition(); }
        if(id) lastCategory=id;
        if(focus) (id ? back : categoryButtons[lastCategory] || categoryButtons.talk)?.focus();
      }
      back.addEventListener('click',()=>navigate(null));
      let lastHover=-Infinity;
      function menu(id,label,fn) {
        const b=el('button','pg-fact-a pg-menu-bubble pg-menu-'+id,label); b.type='button';
        b.addEventListener('click',fn || (()=>navigate(id)));
        if (!fn) b.setAttribute('aria-expanded','false');
        b.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse' && healthyCompanion(getView()) && now()-lastHover>1200){lastHover=now();animate('hover');}});
        root.append(b); categoryButtons[id]=b; return b;
      }
      if(typeof care==='function') {
        const careMenu=menu('care','Care…');
        if(getView()?.needAttention || getView()?.warning){careMenu.className+=' pg-menu-needs-care';careMenu.setAttribute('aria-label','Care… Needs attention');}
      }
      menu('talk','Talk…'); menu('play','Play…');
      const roomMenu=menu('room','My room',visit); roomMenu.setAttribute('aria-label','Go to your room');
      menu('more','More…');
      const buttons = [];
      function add(label, fn, parent = groups.talk) { const b = el('button', 'pg-fact-a', label); b.type = 'button'; b.addEventListener('click', () => {
        careTicket++;
        clearRumors();
        for (const child of buttons) child.classList?.toggle('is-selected', child === b);
        fn();
        if (panel) panel.scrollTop = 0;
      }); buttons.push(b); parent.append(b); return b; }
      if (typeof care === 'function') {
        const careBox = el('div', 'pg-care-actions');
        const careButtons = [];
        const requestCare = async (kind, label) => {
          const ticket = ++careTicket;
          careButtons.forEach(b => { b.disabled = true; });
          reply.textContent = `${label}…`;
          setPose('tb_adult_think');
          let result;
          try { result = await care(kind); }
          catch (_) { result = { ok: false, text: 'Care could not be saved. Try again in a moment.' }; }
          careButtons.forEach(b => { b.disabled = false; });
          if (ticket !== careTicket || !panel) return;
          if (result?.openRoom) { visit(); return; }
          const response = result?.action ? companionReply(getView(), result.action, sequence++, context()) : null;
          reply.textContent = result?.text || (result?.ok ? `${label} saved. ${response?.text || ''}`.trim() : response?.text) || 'Care could not be saved. Try again in a moment.';
          setPose(response?.pose || null);
          if (result?.ok && result.action) animate(result.action);
          reposition();
        };
        for (const [kind, label] of [['feed', 'Feed'], ['clean', 'Clean'], ['play', 'Play'], ['rest', 'Rest']])
          careButtons.push(add(label, () => requestCare(kind, label), careBox));
        groups.care.append(careBox);
      }
      if (readRumors) {
        add('Secret Journal', () => showRumors(true),groups.more);
      }
      add('Our memories', () => say('memories'));
      if (bond && (getView()?.adult || getView()?.motion === 'froglet' || String(getView()?.sprite||'').includes('froglet'))) {
        add('Your favourite toy?', () => say('favourite'),groups.play);
        for (const [id, toy] of Object.entries(TOYS)) add(toy.label, () => {
          if (!playableCompanion(getView())) { reply.textContent = youngNeeds[getView()?.needAttention] ? youngNeeds[getView().needAttention] + ' Visit my room first.' : 'Desk toys unlock when I am a healthy froglet or adult.'; return; }
          const reaction = bond.play(id);
          if (!reaction) { reply.textContent = 'My toy box is not ready yet. Try again in a moment.'; return; }
          say(reaction); if (reaction !== 'toyAgain') showToy(id);
        },groups.play);
      }
      if (bond) {
        const mute = el('button', 'pg-fact-a'); mute.type = 'button';
        const label = () => { mute.textContent = bond.muted ? 'Reactions: quiet' : 'Reactions: on'; mute.setAttribute('aria-pressed', String(bond.muted)); };
        label(); mute.addEventListener('click', () => { careTicket++; clearRumors(); bond.toggleMute(); clearNotice(); label(); reply.textContent = bond.muted ? 'Automatic reactions are off. You can still talk and play with me.' : 'Automatic reactions are on. Watch for little surprises!'; panel.scrollTop = 0; }); groups.more.append(mute);
      }
      add('How are you?', () => say('how'));
      if (getView()?.adult) add('How is PEP?', () => say('market'));
      add('Tell me a joke', () => say('joke'));
      add("Let's play!", () => { if (!runCommand('games')) say('play'); },groups.play);
      add('Pet me', () => say('pet'),groups.play);
      add("What's new?", () => { if (!runCommand('news')) say('news'); },groups.more);
      if (typeof commands?.passport === 'function') add('Open Fren Passport', () => runCommand('passport'),groups.more);
      if (typeof commands?.tv === 'function') add('Watch Pond TV', () => runCommand('tv'),groups.play);
      if (fireflyAvailable()) add('Catch a firefly', () => { close({ focus: true }); if (!catchFirefly()) say('fireflyUnavailable'); },groups.play);
      if (quizAvailable()) add('Pond Quiz', () => { close(); openQuiz(); },groups.play);
      panel.append(head,nav,root,...Object.values(groups),reply);
      doc.body.append(panel);
      button.setAttribute('aria-expanded', 'true');
      doc.addEventListener('keydown', key, true);
      win.addEventListener('resize', reposition);
    }
    reply.textContent = r.text;
    setPose(r.pose);
    animate(action);
    // Rare clue comes only from a fresh voluntary greeting, never from a repeatable menu action.
    if(spontaneousRumor && action==='hello' && readRumors && trustedForRumors(getView()) && bond?.tryRumor?.(getView())) showRumors();
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
  doc.addEventListener('pointerdown', activity, true);
  doc.addEventListener('keydown', activity, true);
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
  return { close, react, invite, invalidateRumors, get busy() { return !!(panel || notice || clickTimer !== null); }, dispose() {
    close({ reset: true });
    doc.removeEventListener('pointerdown', activity, true);
    doc.removeEventListener('keydown', activity, true);
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
