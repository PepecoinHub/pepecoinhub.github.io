// Pepe Miner — an idle "click the frog coin" game. Runs only in the browser; progress lives in localStorage.
// Game PEP are points, not real coins.
(() => {
  'use strict';
  const KEY = 'pepminer-v1';
  const BLOCK = 10000;                 // real Pepecoin block reward
  const NET_HS = 2.9e15;               // real network, about 2.9 PH/s (compare.html, Oct 5, 2026)
  const HS_PER_PEP = 1e6;              // 1 game PEP/s shown as 1 MH/s
  const OFFLINE_MAX = 8 * 3600e3;
  const E = (n) => `img/emotes/${n}.webp`;

  const MACHINES = [
    { id: 'laptop', ico: '💻', name: 'Old laptop', cost: 15, rate: 0.1, tip: 'In the first days you could still mine on an ordinary computer.' },
    { id: 'pc', ico: '🖥️', name: 'Gaming PC', cost: 100, rate: 1, tip: 'A graphics card does many small hashes at once.' },
    { id: 'rig', ico: '🎛️', name: 'GPU rig', cost: 1100, rate: 8, tip: 'Six cards on an open frame, fans on full.' },
    { id: 'asic', ico: '⚙️', name: 'Scrypt ASIC', cost: 12000, rate: 47, tip: 'Today PEP is mined by machines built only for the Scrypt algorithm.' },
    { id: 'garage', ico: '🏚️', name: 'Garage mine', cost: 130000, rate: 260, tip: 'Ten machines, one very loud garage.' },
    { id: 'farm', ico: '🏭', name: 'Mining farm', cost: 1.4e6, rate: 1400, tip: 'Rows of miners where power is cheap.' },
    { id: 'plant', ico: '⚡', name: 'Frog power plant', cost: 2e7, rate: 7800, tip: 'Own power, own rules.' },
    { id: 'dc', ico: '🏢', name: 'Swamp data center', cost: 3.3e8, rate: 44000, tip: 'Hashrate on an industrial scale.' },
    { id: 'hydro', ico: '🌊', name: 'Waterfall hydro mine', cost: 5.1e9, rate: 2.6e5, tip: 'Power from a mountain river. Cheap, quiet and very green.' },
    { id: 'moon', ico: '🌙', name: 'Moon base', cost: 7.5e10, rate: 1.6e6, tip: 'Cold nights, no neighbours, zero noise complaints.' },
    { id: 'pond', ico: '🐸', name: 'Pond-wide mining grid', cost: 1e12, rate: 1e7, tip: 'Every frog in the pond runs a miner.' },
    { id: 'mars', ico: '🪐', name: 'Interplanetary pool', cost: 1.4e13, rate: 6.5e7, tip: 'Shares from Mars arrive 3 to 22 minutes late. Light is slow.' },
  ];
  const UPGRADES = [
    { id: 'pick', ico: '⛏️', name: 'Better pickaxe', cost: 100, need: (s) => s.total >= 50, desc: 'Clicks mine ×2.' },
    { id: 'pool', ico: '🤝', name: 'Join a mining pool', cost: 25000, need: (s) => (s.own.asic || 0) >= 1, desc: 'Steadier payouts: miners ×1.5.', link: '../mining.html' },
    { id: 'merged', ico: '🐕', name: 'Merged mining LTC + DOGE', cost: 5e6, need: (s) => (s.own.farm || 0) >= 1, desc: 'The same hashes secure LTC, DOGE and PEP: miners ×2, DOGE blocks drop in.', link: '../scrypt-family.html' },
    { id: 'newlaptop', ico: '💻', name: 'New Laptop', cost: 4e7, egg: true, need: (s) => s.total >= 1e7, desc: 'A legend once traded 40 million PEP for a new laptop. Days later, a three-month run to the ATH began.' },
    { id: 'printer', ico: '🖨️', name: 'Tokenprinter.fun', cost: 5e8, need: (s) => s.up.merged && (s.own.plant || 0) >= 1, desc: 'Start printing PRC-20 tokens. Every 3 minutes a launch: most rug, some pump, a few moon.' },
  ];
  const ACH = [
    { id: 'gm', name: 'GM', img: 'peek', how: 'Pressed Start' },
    { id: 'block1', name: 'First block', img: 'pep', how: 'Mine your first block' },
    { id: 'foot', name: 'Zord Feet', img: 'hurry', how: 'Catch the golden foot' },
    { id: 'pool', name: 'Team player', img: 'hug', how: 'Join a mining pool' },
    { id: 'merged', name: 'Merge miner', img: 'crowd', how: 'Turn on merged mining' },
    { id: 'laptop', name: 'Bought the laptop', img: 'cheer', how: 'Buy the New Laptop' },
    { id: 'lewis', name: 'Lewis approved', img: 'news', how: 'Buy Tokenprinter.fun' },
    { id: 'hands', name: 'Diamond hands', img: 'serious', how: 'Play for 1 hour' },
    { id: 'balls', name: 'Diamond balls', img: 'smoke', how: 'Play for 3 hours' },
    { id: 'net1', name: '1% of the network', img: 'torch', how: 'Reach 1% of the real hashrate' },
    { id: 'net100', name: 'Bigger than the network', img: 'crayon', how: 'Out-hash the real Pepecoin network' },
  ];
  const TICKERS = ['FROGWIFHAT', 'KEKINU', 'ZORDFEET', 'RIBBIT', 'SWAMPCAT', 'LILYPAD', 'HOPIUM', 'TADPOLE', 'GREENCANDLE', 'FEELSGOOD', 'SMUGFROG', 'BOGLORD'];

  // ---------- state ----------
  const fresh = () => ({ v: 1, pep: 0, total: 0, clicks: 0, own: {}, up: {}, ach: {}, started: false, playMs: 0, lastSeen: Date.now(), buffs: [], nextFoot: 0, nextEvent: 0, nextLaunch: 0 });
  let S = fresh();
  try { const raw = localStorage.getItem(KEY); if (raw) S = Object.assign(fresh(), JSON.parse(raw)); } catch (e) { /* private mode: play without saving */ }
  const save = () => { S.lastSeen = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

  // ---------- numbers ----------
  const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx'];
  function fmt(n) {
    if (!isFinite(n)) return '∞';
    if (n < 1000) return n < 10 && n % 1 ? n.toFixed(1) : Math.floor(n).toLocaleString('en-US');
    if (n < 1e6) return Math.floor(n).toLocaleString('en-US');
    let i = 0; while (n >= 1000 && i < UNITS.length - 1) { n /= 1000; i++; }
    return n.toFixed(2) + ' ' + UNITS[i];
  }
  function fmtHash(hs) {
    const u = ['H/s', 'kH/s', 'MH/s', 'GH/s', 'TH/s', 'PH/s', 'EH/s']; let i = 0;
    while (hs >= 1000 && i < u.length - 1) { hs /= 1000; i++; }
    return (hs < 10 ? hs.toFixed(2) : hs < 100 ? hs.toFixed(1) : Math.round(hs)) + ' ' + u[i];
  }
  const costOf = (m) => Math.ceil(m.cost * Math.pow(1.15, S.own[m.id] || 0));

  // ---------- buffs ----------
  const now = () => Date.now();
  const active = (id) => S.buffs.find((b) => b.id === id && b.until > now());
  function addBuff(id, label, mult, secs, kind = '', clickMult = 1) {
    S.buffs = S.buffs.filter((b) => b.id !== id && b.until > now());
    S.buffs.push({ id, label, mult, clickMult, until: now() + secs * 1000, kind });
  }
  function baseRate() {
    let r = 0; for (const m of MACHINES) r += (S.own[m.id] || 0) * m.rate;
    if (S.up.pool) r *= 1.5;
    if (S.up.merged) r *= 2;
    if (S.up.newlaptop) r *= 1.05;
    return r;
  }
  const buffMult = () => S.buffs.filter((b) => b.until > now()).reduce((m, b) => m * b.mult, 1);
  const rate = () => baseRate() * buffMult();
  const clickValue = () => (1 + baseRate() * 0.02) * (S.up.pick ? 2 : 1) * S.buffs.filter((b) => b.until > now()).reduce((m, b) => m * b.clickMult, 1);
  const earn = (n) => { S.pep += n; S.total += n; };

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const main = $('main');
  function toast(title, text, img, cls = '') {
    const t = document.createElement('div'); t.className = 'mn-toast ' + cls;
    t.innerHTML = (img ? `<img src="${img}" alt="">` : '') + `<div><b></b><span></span></div>`;
    t.querySelector('b').textContent = title; t.querySelector('span').textContent = text;
    $('toasts').append(t); setTimeout(() => t.remove(), 6000);
    while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
  }
  function unlock(id) {
    if (S.ach[id]) return; S.ach[id] = Date.now();
    const a = ACH.find((x) => x.id === id); toast('Achievement: ' + a.name, a.how, E(a.img), 'ach'); renderAch(); save();
  }

  function renderShop() {
    const ups = $('upgrades'); ups.textContent = '';
    for (const u of UPGRADES) {
      if (S.up[u.id] || !u.need(S)) continue;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'mn-up' + (u.egg ? ' egg' : ''); b.dataset.id = u.id;
      b.innerHTML = `<b></b><span class="d"></span><span class="cost"><img src="../assets/brand/icon-p.svg" alt=""> </span>`;
      b.querySelector('b').textContent = u.ico + ' ' + u.name; b.querySelector('.d').textContent = u.desc;
      b.querySelector('.cost').append(fmt(u.cost)); b.disabled = S.pep < u.cost;
      b.onclick = () => buyUp(u); ups.append(b);
    }
    if (!ups.children.length) ups.innerHTML = '<span class="mn-small">New upgrades appear as your mine grows.</span>';
    const box = $('machines'); box.textContent = '';
    let shownLocked = false;
    for (const m of MACHINES) {
      const owned = S.own[m.id] || 0, seen = owned > 0 || S.total >= m.cost * 0.4;
      if (!seen && shownLocked) break;
      const row = document.createElement('div'); row.className = 'mn-row' + (seen ? '' : ' locked');
      if (!seen) { shownLocked = true; row.innerHTML = '<div class="mn-buy" aria-disabled="true"><span class="mn-ico">❔</span><span><b>???</b><span class="sub">Keep mining to reveal</span></span><span></span></div>'; box.append(row); continue; }
      const c = costOf(m);
      row.innerHTML = '<button type="button" class="mn-buy"><span class="mn-ico"></span><span><b></b><span class="sub"></span><span class="cost"><img src="../assets/brand/icon-p.svg" alt=""> </span></span><span class="own"></span></button>'
        + '<button type="button" class="mn-info" aria-expanded="false">i</button><p class="mn-tip" hidden></p>';
      const bb = row.querySelector('.mn-buy'), info = row.querySelector('.mn-info'), tip = row.querySelector('.mn-tip');
      bb.dataset.id = m.id; bb.querySelector('.mn-ico').textContent = m.ico; bb.querySelector('b').textContent = m.name;
      bb.querySelector('.sub').textContent = `+${fmt(m.rate)} game PEP/s each`;
      bb.querySelector('.cost').append(fmt(c)); bb.querySelector('.own').textContent = owned || '';
      bb.setAttribute('aria-label', `Buy ${m.name} for ${fmt(c)} game PEP. You have ${owned}.`);
      bb.disabled = S.pep < c; bb.onclick = () => buy(m);
      tip.textContent = m.tip; info.setAttribute('aria-label', 'About ' + m.name);
      info.onclick = () => { tip.hidden = !tip.hidden; info.setAttribute('aria-expanded', String(!tip.hidden)); openTips[m.id] = !tip.hidden; };
      if (openTips[m.id]) { tip.hidden = false; info.setAttribute('aria-expanded', 'true'); }
      box.append(row);
    }
  }
  const openTips = {};
  function refreshAfford() {
    document.querySelectorAll('.mn-buy[data-id]').forEach((b) => { const m = MACHINES.find((x) => x.id === b.dataset.id); if (m) b.disabled = S.pep < costOf(m); });
    document.querySelectorAll('.mn-up[data-id]').forEach((b) => { const u = UPGRADES.find((x) => x.id === b.dataset.id); b.disabled = S.pep < u.cost; });
  }
  function renderAch() {
    const box = $('achs'); box.textContent = '';
    for (const a of ACH) {
      const d = document.createElement('div'); d.className = 'mn-a' + (S.ach[a.id] ? ' on' : '');
      d.innerHTML = `<img src="${E(a.img)}" alt=""><span><b></b></span>`; d.querySelector('b').textContent = a.name;
      d.querySelector('span').append(S.ach[a.id] ? '' : a.how); box.append(d);
    }
    $('achcount').textContent = `${Object.keys(S.ach).length} / ${ACH.length}`;
  }
  let lastShopKey = '';
  function shopKey() { return MACHINES.map((m) => (S.own[m.id] || 0) + (S.total >= m.cost * 0.4 ? 's' : '')).join(',') + '|' + UPGRADES.map((u) => (S.up[u.id] ? 1 : u.need(S) ? 2 : 0)).join(''); }

  function paint() {
    const r = rate();
    $('pep').textContent = fmt(S.pep);
    $('rate').textContent = fmt(r);
    $('hash').textContent = fmtHash(r * HS_PER_PEP);
    const blocks = Math.floor(S.total / BLOCK);
    $('blockno').textContent = '#' + (blocks + 1).toLocaleString('en-US');
    const perSec = r / BLOCK;
    $('blockpct').textContent = perSec >= 1 ? `≈ ${fmt(perSec)} blocks / s` : Math.floor((S.total % BLOCK) / BLOCK * 100) + '%';
    $('blockbar').style.width = (perSec >= 1 ? 100 : (S.total % BLOCK) / BLOCK * 100) + '%';
    const net = r * HS_PER_PEP / NET_HS * 100;
    $('netpct').textContent = net >= 100 ? 'More than the whole network!' : (net < 0.01 && net > 0 ? '<0.01' : net.toFixed(net < 1 ? 2 : 1)) + '%';
    $('netbar').style.width = Math.min(100, net) + '%';
    const bf = $('buffs'); bf.textContent = '';
    for (const b of S.buffs) {
      const left = Math.ceil((b.until - now()) / 1000); if (left <= 0) continue;
      const s = document.createElement('span'); s.className = 'mn-buff ' + b.kind;
      s.textContent = `${b.label} · ${left >= 60 ? Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0') : left + 's'}`; bf.append(s);
    }
    main.classList.toggle('rally', !!active('rally'));
    const k = shopKey(); if (k !== lastShopKey) { lastShopKey = k; renderShop(); } else refreshAfford();
  }

  // ---------- actions ----------
  function buy(m) {
    const c = costOf(m); if (S.pep < c) return;
    S.pep -= c; S.own[m.id] = (S.own[m.id] || 0) + 1; renderShop(); save();
  }
  function buyUp(u) {
    if (S.pep < u.cost || S.up[u.id]) return;
    S.pep -= u.cost; S.up[u.id] = Date.now();
    if (u.id === 'pool') unlock('pool');
    if (u.id === 'merged') unlock('merged');
    if (u.id === 'newlaptop') { unlock('laptop'); addBuff('rally', '📈 ATH rally ×3', 3, 180, 'gold'); toast('ATH RALLY!', 'Three months of green candles, squeezed into three minutes. Everything mines ×3.', E('cheer')); }
    if (u.id === 'printer') { unlock('lewis'); S.nextLaunch = now() + 20e3; toast('Tokenprinter.fun is live', 'First PRC-20 launch in 20 seconds. Most rug. Some don\'t.', E('news')); }
    renderShop(); save();
  }
  $('coin').addEventListener('click', (ev) => {
    if (!S.started) return;
    const v = clickValue(); earn(v); S.clicks++;
    const r = $('coin').getBoundingClientRect(), p = document.createElement('span');
    p.className = 'mn-pop'; p.textContent = '+' + fmt(v);
    p.style.left = ((ev.clientX || r.left + r.width / 2) - r.left) + 'px'; p.style.top = ((ev.clientY || r.top + r.height / 2) - r.top - 10) + 'px';
    $('coin').append(p); setTimeout(() => p.remove(), 900);
    paint();
  });
  $('startbtn').addEventListener('click', () => { S.started = true; $('start').hidden = true; unlock('gm'); schedule(); save(); });
  $('share').addEventListener('click', async () => {
    const text = `I mine ${fmtHash(rate() * HS_PER_PEP)} in Pepe Miner 🐸⛏️ ${Math.floor(S.total / BLOCK).toLocaleString('en-US')} blocks so far. Can you beat it?`;
    const url = 'https://pepecoinhub.com/games/miner.html';
    try { if (navigator.share) { await navigator.share({ text, url }); return; } await navigator.clipboard.writeText(text + ' ' + url); toast('Copied', 'Paste it on X, Reddit or Discord.', E('pep')); }
    catch (e) { toast('Share', text + ' ' + url, E('pep')); }
  });

  // ---------- golden foot, random events, token launches ----------
  const rnd = (a, b) => a + Math.random() * (b - a);
  function schedule() {
    if (!S.nextFoot || S.nextFoot < now()) S.nextFoot = now() + rnd(90e3, 240e3);
    if (!S.nextEvent || S.nextEvent < now()) S.nextEvent = now() + rnd(120e3, 300e3);
  }
  function spawnFoot() {
    const f = $('foot'); f.hidden = false;
    f.style.left = rnd(8, 82) + 'vw'; f.style.top = rnd(18, 78) + 'vh';
    const t = setTimeout(() => { f.hidden = true; }, 13000);
    f.querySelector('button').onclick = () => {
      clearTimeout(t); f.hidden = true; unlock('foot');
      if (Math.random() < 0.6) { addBuff('frenzy', '🦶 Golden foot ×7', 7, 30, 'gold'); toast('Golden foot!', 'Everything mines ×7 for 30 seconds.', E('hurry')); }
      else { const g = Math.min(S.pep * 0.15, baseRate() * 900) + 13; earn(g); toast('Lucky step!', `+${fmt(g)} game PEP`, E('hurry')); }
      paint();
    };
  }
  const EVENTS = [
    { id: 'whale', ok: () => true, run: () => { addBuff('whale', '🐋 Whale buys ×2', 2, 45); return ['A whale bought the dip', 'Everyone is excited. Miners ×2 for 45 seconds.', 'crowd']; } },
    { id: 'candle', ok: () => true, run: () => { addBuff('candle', '🟢 Green candle: clicks ×10', 1, 20, '', 10); return ['Green candle', 'Clicks mine ×10 for 20 seconds. Go!', 'cheer']; } },
    { id: 'cat', ok: () => baseRate() > 0, run: () => { addBuff('cat', '🐈 Cable unplugged ×0.5', 0.5, 15, 'bad'); return ['The cat unplugged the garage', 'Half your miners are offline for 15 seconds.', 'scream']; } },
    { id: 'doge', ok: () => !!S.up.merged, run: () => { const g = baseRate() * 120; earn(g); return ['Your pool found a DOGE block', `Merged mining pays twice: +${fmt(g)} game PEP.`, 'hug']; } },
    { id: 'reddit', ok: () => true, run: () => { addBuff('reddit', '🔥 Front page ×1.5', 1.5, 60); return ['Your post hit the front page of r/pepecoin', 'New miners join the pool. ×1.5 for 60 seconds.', 'news']; } },
    { id: 'fud', ok: () => baseRate() > 0, run: () => { fud(); return null; } },
    { id: 'pepelord', ok: () => baseRate() > 0, run: () => { addBuff('pepelord', '👑 Pepelord in chat ×5', 5, 60, 'gold'); return ['Pepelord joined the chat', 'The whole pond wakes up. Miners ×5 for 1 minute.', 'peek']; } },
    { id: 'zomboid', ok: () => baseRate() > 0, run: () => { addBuff('zomboid', '🧟 Zomboid news ×0.7', 0.7, 20, 'bad'); return ['Project Zomboid announcement', 'Everyone stopped mining to read it. Miners ×0.7 for 20 seconds.', 'loading']; } },
  ];
  function showEvent(title, text, img, button) {
    const ev = $('event'); ev.innerHTML = `<img src="${E(img)}" alt=""><div><b></b><p></p></div>`;
    ev.querySelector('b').textContent = title; ev.querySelector('p').textContent = text;
    if (button) ev.append(button);
    ev.hidden = false; clearTimeout(ev._t); ev._t = setTimeout(() => { ev.hidden = true; }, button ? 10000 : 6000);
  }
  function fud() {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn primary sm'; b.textContent = '💎 Hold';
    b.onclick = () => { $('event').hidden = true; addBuff('hold', '💎 Held through FUD ×3', 3, 20, 'gold'); toast('You held', 'FUD faded. Miners ×3 for 20 seconds.', E('serious')); };
    showEvent('FUD on X: "PEP is dead"', 'Hold within 10 seconds and the panic pays you back.', 'serious', b);
  }
  function launchToken() {
    const t = '$' + TICKERS[Math.floor(Math.random() * TICKERS.length)], roll = Math.random(), base = baseRate();
    if (roll < 0.70) toast(`${t} launched on Tokenprinter.fun`, `Rugged in ${Math.ceil(rnd(1, 9))} minutes. Classic.`, E('scream'));
    else if (roll < 0.95) { const g = base * 60; earn(g); toast(`${t} pumped ×10`, `You sold the top: +${fmt(g)} game PEP.`, E('cheer')); }
    else { const g = base * 600; earn(g); toast(`${t} MOONED 🚀`, `+${fmt(g)} game PEP. Lewis approves.`, E('torch')); }
  }

  // ---------- TEST ONLY: cheat code "klapaucius" (×100 for 1 minute). Remove before the game is announced. ----------
  const CHEAT = 'klapaucius';
  function cheat(word) {
    if (String(word).trim().toLowerCase() !== CHEAT || !S.started) return false;
    addBuff('cheat', '🧪 klapaucius ×100', 100, 60, 'gold', 100); toast('Cheat on', 'Everything mines ×100 for 1 minute.', E('crayon')); paint(); return true;
  }
  let typed = '';
  document.addEventListener('keydown', (ev) => {
    if (ev.target.closest && ev.target.closest('input, textarea') || ev.key.length !== 1) return;
    typed = (typed + ev.key.toLowerCase()).slice(-CHEAT.length);
    if (typed === CHEAT) { typed = ''; cheat(CHEAT); }
  });
  let taps = [];
  document.querySelector('.mn-pep img').addEventListener('click', () => {
    taps = taps.filter((t) => now() - t < 2000).concat(now());
    if (taps.length < 5) return; taps = [];
    if (document.querySelector('.mn-cheat')) return;
    const f = document.createElement('form'); f.className = 'mn-cheat';
    f.innerHTML = '<input type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Code"><button class="btn sm" type="submit">OK</button>';
    f.onsubmit = (e) => { e.preventDefault(); if (!cheat(f.querySelector('input').value)) toast('Nope', 'That is not the code.', E('serious')); f.remove(); };
    document.querySelector('.mn-bank').append(f); f.querySelector('input').focus();
  });

  // ---------- loop ----------
  let last = performance.now();
  function loop() {
    const t = performance.now(), dt = Math.min(1, (t - last) / 1000); last = t;
    if (S.started) {
      earn(rate() * dt);
      if (!document.hidden) S.playMs += dt * 1000;
      if (S.total >= BLOCK) unlock('block1');
      if (S.playMs >= 3600e3) unlock('hands');
      if (S.playMs >= 3 * 3600e3) unlock('balls');
      if (baseRate() * HS_PER_PEP >= NET_HS * 0.01) unlock('net1');
      if (baseRate() * HS_PER_PEP >= NET_HS) unlock('net100');
      if (now() > S.nextFoot && $('foot').hidden) { spawnFoot(); S.nextFoot = now() + rnd(90e3, 240e3); }
      if (now() > S.nextEvent && $('event').hidden) {
        const pool = EVENTS.filter((e) => e.ok()), e = pool[Math.floor(Math.random() * pool.length)], r = e.run();
        if (r) showEvent(r[0], r[1], r[2]);
        S.nextEvent = now() + rnd(120e3, 300e3);
      }
      if (S.up.printer && now() > S.nextLaunch) { launchToken(); S.nextLaunch = now() + 180e3; }
    }
    S.buffs = S.buffs.filter((b) => b.until > now());
    paint();
  }
  function spawnCandle() {
    if (!active('rally')) return;
    const c = document.createElement('i'); c.className = 'mn-candle';
    c.style.left = rnd(0, 100) + 'vw'; c.style.height = rnd(40, 140) + 'px'; c.style.animationDuration = rnd(3, 7) + 's';
    document.querySelector('.mn-candles').append(c); setTimeout(() => c.remove(), 7000);
  }
  setInterval(() => { if (active('rally')) for (let i = 0; i < 2; i++) spawnCandle(); }, 400);

  // ---------- start ----------
  if (S.started) {
    $('start').hidden = true;
    const away = Math.min(OFFLINE_MAX, Date.now() - (S.lastSeen || Date.now()));
    const g = baseRate() * away / 1000;
    if (away > 60e3 && g > 0) { earn(g); setTimeout(() => toast('While you were away', `Your miners dug ${fmt(g)} game PEP.`, E('smoke')), 400); }
    schedule();
  }
  renderShop(); renderAch(); paint();
  setInterval(loop, 100);
  setInterval(save, 5000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  window.addEventListener('pagehide', save);
  if (/[?&]debug=1/.test(location.search)) window.__mn = { S: () => S, set: (o) => { Object.assign(S, o); lastShopKey = ''; renderShop(); renderAch(); paint(); }, spawnFoot, showEvent, fud, launchToken, buyUp: (id) => buyUp(UPGRADES.find((u) => u.id === id)), toast, E };
})();
