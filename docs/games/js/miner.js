// Pepe Miner — an idle "click the frog coin" game. Runs only in the browser; progress lives in localStorage.
// Game PEP are points, not real coins.
(() => {
  'use strict';
  const ART = window.MINER_ART;
  const KEY = 'pepminer-v1';
  const BLOCK = 10000;                 // real Pepecoin block reward
  const NET_HS = 2.9e15;               // real network, about 2.9 PH/s (compare.html, Oct 5, 2026)
  const HS_PER_PEP = 1e6;              // 1 game PEP/s shown as 1 MH/s
  const FORK_DIV = 1e9;                // fork level = cube root of all-time game PEP / 1B
  const LEVEL_BONUS = 0.05;            // +5% production and clicks per fork point
  const E = (n) => `img/emotes/${n}.webp`;

  // Pictures from the site owner (originals in img/miner-*.*, small copies in img/miner/).
  const PICS = { hardfork: 'hardfork', block1: '1stblock', candle: 'greencandle', ads: 'ads', oneday: 'oneday', pray: 'pray', laptop: 'laptop',
    trap: 'trap', wrongpep: 'wrongpep', h1: '1h', b1: '1b', h3: '3h', zord: 'zordfeet', k5: '5k' };
  const picUrl = Object.fromEntries(Object.entries(PICS).map(([k, f]) => [k, `img/miner/${f}.webp`]));
  const P = (key, emote) => picUrl[key] || E(emote);

  const MACHINES = [
    { id: 'laptop', name: 'Old laptop', plural: 'Old laptops', cost: 15, rate: 0.1, tip: 'In the first days you could still mine on an ordinary computer.',
      tiers: ['Fresh thermal paste', 'Laptop cooling pad', 'Undervolted CPU', 'Linux, finally', 'Lid closed, still mining', 'The laptop that refused to die'] },
    { id: 'pc', name: 'Gaming PC', plural: 'Gaming PCs', cost: 100, rate: 1, tip: 'A graphics card does many small hashes at once.',
      tiers: ['RGB adds hashrate', 'Overclocked GPU', 'Second graphics card', 'Water cooling loop', "Mom's electricity bill", 'Gaming? What gaming?'] },
    { id: 'rig', name: 'GPU rig', plural: 'GPU rigs', cost: 1100, rate: 8, tip: 'Six cards on an open frame, fans on full.',
      tiers: ['Riser cables', 'Open-air frame', 'Custom BIOS', 'Rig whisperer', 'Six-card symphony', 'Rig of Theseus'] },
    { id: 'asic', name: 'Scrypt ASIC', plural: 'Scrypt ASICs', cost: 12000, rate: 47, tip: 'Today PEP is mined by machines built only for the Scrypt algorithm.',
      tiers: ['Firmware update', 'Immersion cooling', 'Scrypt-tuned chips', 'Hashboard repair kit', 'Silent fan mod', 'ASIC of the year'] },
    { id: 'garage', name: 'Garage mine', plural: 'Garage mines', cost: 130000, rate: 260, tip: 'Ten machines, one very loud garage.',
      tiers: ['Extension cord to the neighbour', 'Garage door vents', 'Second circuit breaker', 'Noise-cancelling headphones', 'The car moved out', 'Garage of legends'] },
    { id: 'farm', name: 'Mining farm', plural: 'Mining farms', cost: 1.4e6, rate: 1400, tip: 'Rows of miners where power is cheap.',
      tiers: ['Bulk power deal', 'Night shift frogs', 'Hot aisle, cold aisle', 'Farm dashboard', 'Spare parts warehouse', 'Farm-to-block'] },
    { id: 'plant', name: 'Frog power plant', plural: 'Frog power plants', cost: 2e7, rate: 7800, tip: 'Own power, own rules.',
      tiers: ['Lily-pad solar panels', 'Frog-powered turbines', 'Smart grid', 'Swamp gas generator', 'Turbine overclock', 'Kek-watt hours'] },
    { id: 'dc', name: 'Swamp data center', plural: 'Swamp data centers', cost: 3.3e8, rate: 44000, tip: 'Hashrate on an industrial scale.',
      tiers: ['Raised floor', 'Fibre to the swamp', 'Redundant cooling', '24/7 frog ops', 'Tier IV swamp', 'The cloud, but wetter'] },
    { id: 'hydro', name: 'Waterfall hydro mine', plural: 'Waterfall hydro mines', cost: 5.1e9, rate: 2.6e5, tip: 'Power from a mountain river. Cheap, quiet and very green.',
      tiers: ['Bigger waterfall', 'Fish-safe turbines', 'Spring flood season', 'Dam upgrade', 'River-cooled racks', 'Endless stream'] },
    { id: 'moon', name: 'Moon base', plural: 'Moon bases', cost: 7.5e10, rate: 1.6e6, tip: 'Cold nights, no neighbours, zero noise complaints.',
      tiers: ['Low-gravity racks', 'Regolith heat sinks', 'Earthrise uptime', 'Lunar solar farm', 'Crater expansion', 'Dark side of the hash'] },
    { id: 'pond', name: 'Pond-wide mining grid', plural: 'Pond-wide mining grids', cost: 1e12, rate: 1e7, tip: 'Every frog in the pond runs a miner.',
      tiers: ['Lily-pad mesh network', 'Frog union contract', 'Tadpole apprentices', 'Pond-wide firmware', 'Every frog a node', 'Kingdom of the pond'] },
    { id: 'mars', name: 'Interplanetary pool', plural: 'Interplanetary pools', cost: 1.4e13, rate: 6.5e7, tip: 'Shares from Mars arrive 3 to 22 minutes late. Light is slow.',
      tiers: ['Faster relay satellites', 'Dust-storm filters', 'Olympus Mons cooling', 'Red planet power', 'Interplanetary payouts', 'Hashrate across the void'] },
  ];
  const TIERS = [1, 5, 25, 50, 100, 150], TIER_COST = [10, 50, 500, 5e4, 5e6, 5e8], ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
  const own = (id) => S.own[id] || 0;
  const totalOwned = () => MACHINES.reduce((n, m) => n + own(m.id), 0);

  const SPECIAL = [
    { id: 'pick', ico: '⛏️', name: 'Better pickaxe', cost: 100, need: () => S.total >= 50, desc: 'Clicks mine ×2.' },
    { id: 'pool', ico: '🤝', name: 'Join a mining pool', cost: 25000, need: () => own('asic') >= 1, desc: 'Steadier payouts: miners ×1.5.' },
    { id: 'pick2', ico: '🪙', name: 'Golden pickaxe', cost: 5e5, need: () => S.st.clicks >= 1000, desc: 'Clicks mine ×2. For true clickers.' },
    { id: 'merged', ico: '🐕', name: 'Merged mining LTC + DOGE', cost: 5e6, need: () => own('farm') >= 1, desc: 'The same hashes secure LTC, DOGE and PEP: miners ×2, DOGE blocks drop in.' },
    { id: 'hw', ico: '🔐', name: 'Hardware wallet', cost: 1e7, need: () => S.st.muddy >= 1, desc: 'Muddy feet can no longer rug you. Not your keys, not your coins.' },
    { id: 'ads', ico: '📣', pic: 'ads', name: 'Ads', cost: 1e6, need: () => S.total >= 2e5, desc: 'Your mine advertises everywhere. Miners ×1.1, with no time limit.' },
    { id: 'newlaptop', ico: '💻', pic: 'laptop', name: 'New Laptop', cost: 4e7, egg: true, need: () => S.total >= 1e7, desc: 'A legend once traded 40 million PEP for a new laptop. Days later, a three-month run to the ATH began.' },
    { id: 'printer', ico: '🖨️', name: 'Tokenprinter.fun', cost: 5e8, need: () => S.up.merged && own('plant') >= 1, desc: 'Start printing PRC-20 tokens. Every 3 minutes a launch: most rug, some pump, a few moon.' },
    { id: 'pick3', ico: '💎', name: 'Diamond pickaxe', cost: 5e8, need: () => S.st.clicks >= 5000, desc: 'Clicks mine ×2 again. Your finger is legendary.' },
  ];
  const TIER_UPS = [];
  MACHINES.forEach((m) => TIERS.forEach((n, i) => TIER_UPS.push({
    id: `${m.id}-${i}`, machine: m.id, tier: i, name: m.tiers[i], cost: m.cost * TIER_COST[i], need: () => own(m.id) >= n, desc: `${m.plural} mine ×2.`,
  })));
  const UPGRADES = SPECIAL.concat(TIER_UPS);

  const RELICS = [
    { id: 'genesis', ico: '🧱', name: 'Genesis block', cost: 1, desc: 'Every new fork starts with 10 Old laptops and 5 Gaming PCs.' },
    { id: 'power', ico: '🔌', name: 'Cheap power contract', cost: 3, desc: 'Miners cost 10% less.' },
    { id: 'feet', ico: '🦶', name: 'Lucky feet', cost: 5, desc: 'The golden foot shows up twice as often and stays longer.' },
    { id: 'memory', ico: '🧠', name: 'Long memory', cost: 8, desc: 'Offline earnings for up to 24 hours instead of 8.' },
    { id: 'friends', ico: '🤝', name: 'Old pool friends', cost: 12, desc: 'Every new fork starts with the Better pickaxe and the mining pool.' },
    { id: 'whitelist', ico: '📜', name: 'Tokenprinter whitelist', cost: 20, desc: 'Only half of your token launches rug.' },
    { id: 'paws', ico: '🐾', name: 'Diamond paws', cost: 30, desc: 'Clicks mine ×3.' },
    { id: 'blessing', ico: '📈', name: "The laptop guy's blessing", cost: 50, desc: 'The ATH rally after the New Laptop is ×5 and lasts 6 minutes.' },
    { id: 'rolodex', ico: '📇', name: "Lewis' rolodex", cost: 100, desc: 'A token launch every 90 seconds instead of 3 minutes.' },
  ];

  const TICKERS = ['FROGWIFHAT', 'KEKINU', 'ZORDFEET', 'RIBBIT', 'SWAMPCAT', 'LILYPAD', 'HOPIUM', 'TADPOLE', 'GREENCANDLE', 'FEELSGOOD', 'SMUGFROG', 'BOGLORD'];

  // ---------- state ----------
  const fresh = () => ({ v: 2, pep: 0, total: 0, allTime: 0, own: {}, up: {}, ach: {}, relics: {}, prestige: 0, chips: 0, forks: 0,
    started: false, playMs: 0, buyPlayMs: 0, lastSeen: Date.now(), buffs: [], nextFoot: 0, nextEvent: 0, nextLaunch: 0, nextTrap: 0, prayAt: 0,
    st: { clicks: 0, foot: 0, muddy: 0, held: 0, launches: 0, moons: 0, pepelord: 0, best: 0, fast: 0, candles: 0, returns: 0, traps: 0, prays: 0 } });
  let S = fresh();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const old = JSON.parse(raw);
      S = Object.assign(fresh(), old);
      S.st = Object.assign(fresh().st, old.st || {});
      if (!old.v || old.v < 2) { S.v = 2; S.allTime = old.total || 0; S.buyPlayMs = old.playMs || 0; S.st.clicks = old.clicks || 0; S.st.foot = old.ach && old.ach.foot ? 1 : 0; }
    }
  } catch (e) { /* private mode: play without saving */ }
  const save = () => { S.lastSeen = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

  // ---------- numbers ----------
  const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
  function fmt(n) {
    if (!isFinite(n)) return '∞';
    if (n < 1000) return n < 10 && n % 1 ? n.toFixed(1) : Math.floor(n).toLocaleString('en-US');
    if (n < 1e6) return Math.floor(n).toLocaleString('en-US');
    let i = 0; while (n >= 1000 && i < UNITS.length - 1) { n /= 1000; i++; }
    return n.toFixed(2) + ' ' + UNITS[i];
  }
  function fmtHash(hs) {
    const u = ['H/s', 'kH/s', 'MH/s', 'GH/s', 'TH/s', 'PH/s', 'EH/s', 'ZH/s', 'YH/s']; let i = 0;
    while (hs >= 1000 && i < u.length - 1) { hs /= 1000; i++; }
    return (hs < 10 ? hs.toFixed(2) : hs < 100 ? hs.toFixed(1) : Math.round(hs)) + ' ' + u[i];
  }
  const fmtTime = (ms) => { const m = Math.floor(ms / 60000); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };
  const costOf = (m) => Math.ceil(m.cost * Math.pow(1.15, own(m.id)) * (S.relics.power ? 0.9 : 1));

  // ---------- production ----------
  const now = () => Date.now();
  const live = () => S.buffs.filter((b) => b.until > now());
  const active = (id) => live().find((b) => b.id === id);
  function addBuff(id, label, mult, secs, kind = '', clickMult = 1) {
    S.buffs = S.buffs.filter((b) => b.id !== id && b.until > now());
    S.buffs.push({ id, label, mult, clickMult, until: now() + secs * 1000, kind });
  }
  function machineRate(m) { let r = m.rate; for (let i = 0; i < TIERS.length; i++) if (S.up[`${m.id}-${i}`]) r *= 2; return r; }
  function globalMult() {
    let g = 1 + LEVEL_BONUS * S.prestige;
    if (S.up.pool) g *= 1.5;
    if (S.up.merged) g *= 2;
    if (S.up.ads) g *= 1.1;
    if (S.up.newlaptop) g *= 1.05;
    return g;
  }
  function baseRate() { let r = 0; for (const m of MACHINES) r += own(m.id) * machineRate(m); return r * globalMult(); }
  const buffMult = () => live().reduce((m, b) => m * b.mult, 1);
  const rate = () => baseRate() * buffMult();
  function clickValue() {
    let v = (1 + baseRate() * 0.02) * (1 + LEVEL_BONUS * S.prestige);
    for (const id of ['pick', 'pick2', 'pick3']) if (S.up[id]) v *= 2;
    if (S.relics.paws) v *= 3;
    return v * live().reduce((m, b) => m * b.clickMult, 1);
  }
  const earn = (n) => { S.pep += n; S.total += n; S.allTime += n; };
  const forkLevel = () => Math.floor(Math.cbrt(S.allTime / FORK_DIV));
  const pendingPts = () => Math.max(0, forkLevel() - S.prestige);

  // ---------- DOM helpers ----------
  const $ = (id) => document.getElementById(id);
  const main = $('main');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pIcon = '<img src="../assets/brand/icon-p.svg" alt="">';
  function toast(title, text, img, cls = '') {
    const t = document.createElement('div'); t.className = 'mn-toast ' + cls;
    t.innerHTML = (img ? `<img src="${img}" alt="">` : '') + '<div><b></b><span></span></div>';
    t.querySelector('b').textContent = title; t.querySelector('span').textContent = text;
    $('toasts').append(t); setTimeout(() => t.remove(), 6000);
    while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
  }

  // ---------- achievements ----------
  const net = () => baseRate() * HS_PER_PEP / NET_HS;
  const tiersBought = () => TIER_UPS.filter((u) => S.up[u.id]).length;
  const ACH = [
    { id: 'gm', name: 'GM', img: 'peek', how: 'Press Start', test: () => S.started },
    { id: 'click100', name: 'Finger warm-up', img: 'hurry', how: 'Click the coin 100 times', test: () => S.st.clicks >= 100 },
    { id: 'click1k', name: 'Click addict', img: 'scream', how: 'Click the coin 1,000 times', test: () => S.st.clicks >= 1000 },
    { id: 'click5k', name: 'Five thousand clicks', img: 'hurry', pic: 'k5', how: 'Click the coin 5,000 times', test: () => S.st.clicks >= 5000 },
    { id: 'click10k', name: 'Carpal tunnel', img: 'smoke', how: 'Click the coin 10,000 times', test: () => S.st.clicks >= 10000 },
    { id: 'block1', name: 'First block', img: 'pep', pic: 'block1', how: 'Mine your first block', test: () => S.allTime >= BLOCK },
    { id: 'block100', name: 'Hundred blocks', img: 'cheer', how: 'Mine 100 blocks', test: () => S.allTime >= 100 * BLOCK },
    { id: 'block10k', name: 'Ten thousand blocks', img: 'crowd', how: 'Mine 10,000 blocks', test: () => S.allTime >= 1e4 * BLOCK },
    { id: 'b1', name: 'Billion PEP club', img: 'cheer', pic: 'b1', how: 'Mine 1 billion game PEP in total', test: () => S.allTime >= 1e9 },
    { id: 'block1m', name: 'A million blocks', img: 'torch', how: 'Mine 1,000,000 blocks', test: () => S.allTime >= 1e6 * BLOCK },
    { id: 'rate1k', name: 'Kilo-frog', img: 'ready', how: 'Mine 1,000 game PEP per second', test: () => baseRate() >= 1e3 },
    { id: 'rate1m', name: 'Mega-frog', img: 'torch', how: 'Mine 1 million game PEP per second', test: () => baseRate() >= 1e6 },
    { id: 'rate1b', name: 'Giga-frog', img: 'crayon', how: 'Mine 1 billion game PEP per second', test: () => baseRate() >= 1e9 },
    { id: 'own10', name: 'Laptop hoarder', img: 'chair', how: 'Own 10 Old laptops', test: () => own('laptop') >= 10 },
    { id: 'own100', name: 'Hundred machines', img: 'crowd', how: 'Own 100 machines', test: () => totalOwned() >= 100 },
    { id: 'own500', name: 'Machine park', img: 'news', how: 'Own 500 machines', test: () => totalOwned() >= 500 },
    { id: 'own1000', name: 'Industrial frog', img: 'serious', how: 'Own 1,000 machines', test: () => totalOwned() >= 1000 },
    { id: 'collector', name: 'Collector', img: 'hug', how: 'Own at least one of every machine', test: () => MACHINES.every((m) => own(m.id) > 0) },
    { id: 'tier10', name: 'Tinkerer', img: 'crayon', how: 'Buy 10 machine upgrades', test: () => tiersBought() >= 10 },
    { id: 'tier30', name: 'Engineer', img: 'ready', how: 'Buy 30 machine upgrades', test: () => tiersBought() >= 30 },
    { id: 'tierAll', name: 'Fully upgraded', img: 'torch', how: 'Buy every machine upgrade', test: () => tiersBought() >= TIER_UPS.length },
    { id: 'foot', name: 'Zord Feet', img: 'hurry', pic: 'zord', how: 'Catch the golden foot', test: () => S.st.foot >= 1 },
    { id: 'foot10', name: 'Foot chaser', img: 'hurry', how: 'Catch 10 golden feet', test: () => S.st.foot >= 10 },
    { id: 'foot50', name: 'Sole collector', img: 'cheer', how: 'Catch 50 golden feet', test: () => S.st.foot >= 50 },
    { id: 'muddy', name: 'Muddy feet', img: 'scream', how: 'Click a muddy foot', test: () => S.st.muddy >= 1 },
    { id: 'candle', name: 'Green candle', img: 'cheer', pic: 'candle', how: 'Catch a green candle', test: () => S.st.candles >= 1 },
    { id: 'wrongpep', name: 'Wrong Pepe fren', img: 'scream', pic: 'wrongpep', how: 'Click the wrong Pepe', test: () => S.st.traps >= 1 },
    { id: 'hold', name: 'Paper? Never.', img: 'serious', how: 'Hold through FUD', test: () => S.st.held >= 1 },
    { id: 'hold5', name: 'FUD-proof', img: 'serious', how: 'Hold through FUD 5 times', test: () => S.st.held >= 5 },
    { id: 'pepelord', name: 'Pepelord was here', img: 'peek', how: 'See Pepelord join the chat', test: () => S.st.pepelord >= 1 },
    { id: 'pool', name: 'Team player', img: 'hug', how: 'Join a mining pool', test: () => !!S.up.pool },
    { id: 'merged', name: 'Merge miner', img: 'crowd', how: 'Turn on merged mining', test: () => !!S.up.merged },
    { id: 'laptop', name: 'Bought the laptop', img: 'cheer', pic: 'laptop', how: 'Buy the New Laptop', test: () => !!S.up.newlaptop },
    { id: 'lewis', name: 'Lewis approved', img: 'news', how: 'Buy Tokenprinter.fun', test: () => !!S.up.printer },
    { id: 'launch10', name: 'Serial launcher', img: 'news', how: 'Launch 10 tokens', test: () => S.st.launches >= 10 },
    { id: 'moon', name: 'To the moon', img: 'torch', how: 'Have one of your tokens moon', test: () => S.st.moons >= 1 },
    { id: 'hw', name: 'Not your keys...', img: 'serious', how: 'Buy the hardware wallet', test: () => !!S.up.hw },
    { id: 'pick3', name: 'Diamond pickaxe', img: 'cheer', how: 'Buy the Diamond pickaxe', test: () => !!S.up.pick3 },
    { id: 'hands', name: 'Diamond hands', img: 'serious', pic: 'h1', how: 'Play for 1 hour', test: () => S.playMs >= 3600e3 },
    { id: 'balls', name: 'Diamond balls', img: 'smoke', pic: 'h3', how: 'Play for 3 hours', test: () => S.playMs >= 3 * 3600e3 },
    { id: 'day', name: 'Frog of the day', img: 'smoke', how: 'Play for 24 hours in total', test: () => S.playMs >= 24 * 3600e3 },
    { id: 'oneday', name: 'One day later', img: 'smoke', pic: 'oneday', how: 'Come back to the game after closing it', test: () => S.st.returns >= 1 },
    { id: 'net1', name: '1% of the network', img: 'torch', how: 'Reach 1% of the real hashrate', test: () => net() >= 0.01 },
    { id: 'net10', name: '10% of the network', img: 'cheer', how: 'Reach 10% of the real hashrate', test: () => net() >= 0.1 },
    { id: 'net100', name: 'Bigger than the network', img: 'crayon', how: 'Out-hash the real Pepecoin network', test: () => net() >= 1 },
    { id: 'fork1', name: 'Hard fork', img: 'waiting', pic: 'hardfork', how: 'Do your first hard fork', test: () => S.forks >= 1 },
    { id: 'fork5', name: 'Fork collector', img: 'loading', how: 'Hard fork 5 times', test: () => S.forks >= 5 },
    { id: 'relic3', name: 'Relic hunter', img: 'chair', how: 'Own 3 relics', test: () => Object.keys(S.relics).length >= 3 },
    { id: 'relicAll', name: 'Keeper of relics', img: 'torch', how: 'Own every relic', test: () => Object.keys(S.relics).length >= RELICS.length },
    { id: 'patience', name: 'Patience', img: 'waiting', how: "Don't buy anything for 10 minutes while your miners run", secret: true, test: () => baseRate() > 0 && S.playMs - S.buyPlayMs >= 600e3 },
    { id: 'speed', name: 'Speed demon', img: 'hurry', how: 'Click 15 times in 2 seconds', secret: true, test: () => S.st.fast >= 1 },
    { id: 'owl', name: 'Night owl', img: 'smoke', how: 'Mine between 2 and 5 in the morning', secret: true, test: () => { const h = new Date().getHours(); return h >= 2 && h < 5; } },
  ];
  function checkAch() {
    if (!S.started) return;
    for (const a of ACH) if (!S.ach[a.id] && a.test()) {
      S.ach[a.id] = now(); toast('Achievement: ' + a.name, a.how, achImg(a), 'ach');
      if (tab === 'ach') renderAch(); else achCount();
    }
  }
  const achImg = (a) => (a.pic ? P(a.pic, a.img) : E(a.img));
  const achCount = () => { $('achcount').textContent = `${ACH.filter((a) => S.ach[a.id]).length}/${ACH.length}`; };
  function renderAch() {
    const box = $('achs'); box.textContent = '';
    for (const a of ACH) {
      const got = !!S.ach[a.id], hide = a.secret && !got;
      const d = document.createElement('div'); d.className = 'mn-a' + (got ? ' on' : '');
      d.innerHTML = '<img alt=""><span><b></b><small></small></span>';
      d.querySelector('img').src = hide ? E('loading') : achImg(a);
      d.querySelector('b').textContent = hide ? '???' : a.name;
      d.querySelector('small').textContent = hide ? 'Hidden achievement' : a.how;
      box.append(d);
    }
    achCount();
  }

  // ---------- shop ----------
  const openTips = {};
  let showAllUps = false;
  function upTile(u) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'mn-up' + (u.egg ? ' egg' : '') + (u.machine ? ' tier' : ''); b.dataset.id = u.id;
    b.innerHTML = '<span class="ui"></span><span class="ut"><b></b><span class="d"></span><span class="cost">' + pIcon + ' </span></span>';
    if (u.machine) b.querySelector('.ui').innerHTML = ART.icon(u.machine, 34) + `<i>${ROMAN[u.tier]}</i>`;
    else if (u.pic && picUrl[u.pic]) b.querySelector('.ui').innerHTML = `<img src="${picUrl[u.pic]}" alt="">`;
    else b.querySelector('.ui').textContent = u.ico;
    b.querySelector('b').textContent = u.name; b.querySelector('.d').textContent = u.desc;
    b.querySelector('.cost').append(fmt(u.cost)); b.disabled = S.pep < u.cost;
    b.onclick = () => buyUp(u);
    return b;
  }
  function renderShop() {
    const ups = $('upgrades'); ups.textContent = '';
    const avail = UPGRADES.filter((u) => !S.up[u.id] && u.need()).sort((a, b) => a.cost - b.cost);
    const shown = showAllUps ? avail : avail.slice(0, 6);
    shown.forEach((u) => ups.append(upTile(u)));
    if (!avail.length) ups.innerHTML = '<span class="mn-small">New upgrades appear as your mine grows.</span>';
    if (avail.length > 6) {
      const more = document.createElement('button'); more.type = 'button'; more.className = 'btn sm mn-more';
      more.textContent = showAllUps ? 'Show fewer' : `Show all ${avail.length} upgrades`;
      more.onclick = () => { showAllUps = !showAllUps; renderShop(); }; ups.append(more);
    }
    const box = $('machines'); box.textContent = '';
    let shownLocked = false;
    for (const m of MACHINES) {
      const owned = own(m.id), seen = owned > 0 || S.total >= m.cost * 0.4;
      if (!seen && shownLocked) break;
      const row = document.createElement('div'); row.className = 'mn-row' + (seen ? '' : ' locked');
      if (!seen) { shownLocked = true; row.innerHTML = '<div class="mn-buy" aria-disabled="true"><span class="mn-ico">❔</span><span><b>???</b><span class="sub">Keep mining to reveal</span></span><span></span></div>'; box.append(row); continue; }
      const c = costOf(m), each = machineRate(m) * globalMult();
      row.innerHTML = '<button type="button" class="mn-buy"><span class="mn-ico"></span><span><b></b><span class="sub"></span><span class="cost">' + pIcon + ' </span></span><span class="own"></span></button>'
        + '<button type="button" class="mn-info" aria-expanded="false">i</button><p class="mn-tip" hidden></p>';
      const bb = row.querySelector('.mn-buy'), info = row.querySelector('.mn-info'), tip = row.querySelector('.mn-tip');
      bb.dataset.id = m.id; bb.querySelector('.mn-ico').innerHTML = ART.icon(m.id, 40); bb.querySelector('b').textContent = m.name;
      bb.querySelector('.sub').textContent = `+${fmt(each)} game PEP/s each`;
      bb.querySelector('.cost').append(fmt(c)); bb.querySelector('.own').textContent = owned || '';
      bb.setAttribute('aria-label', `Buy ${m.name} for ${fmt(c)} game PEP. You have ${owned}.`);
      bb.disabled = S.pep < c; bb.onclick = () => buy(m);
      const nUp = TIER_UPS.filter((u) => u.machine === m.id && S.up[u.id]).length;
      tip.textContent = m.tip + (owned ? ` Your ${owned} make ${fmt(owned * each)} game PEP/s.` : '') + (nUp ? ` Upgrades bought: ${nUp} of ${TIERS.length}.` : '');
      info.setAttribute('aria-label', 'About ' + m.name);
      info.onclick = () => { tip.hidden = !tip.hidden; info.setAttribute('aria-expanded', String(!tip.hidden)); openTips[m.id] = !tip.hidden; };
      if (openTips[m.id]) { tip.hidden = false; info.setAttribute('aria-expanded', 'true'); }
      box.append(row);
    }
  }
  function refreshAfford() {
    document.querySelectorAll('.mn-buy[data-id]').forEach((b) => { const m = MACHINES.find((x) => x.id === b.dataset.id); if (m) b.disabled = S.pep < costOf(m); });
    document.querySelectorAll('.mn-up[data-id]').forEach((b) => { const u = UPGRADES.find((x) => x.id === b.dataset.id); if (u) b.disabled = S.pep < u.cost; });
    document.querySelectorAll('.mn-relic[data-id]').forEach((b) => { const r = RELICS.find((x) => x.id === b.dataset.id); if (r && !S.relics[r.id]) b.disabled = S.chips < r.cost; });
  }

  // ---------- your mine ----------
  let sceneId = '';
  function renderMine() {
    const box = $('mine'), n = totalOwned();
    $('minecount').textContent = n ? `${n.toLocaleString('en-US')} machines` : '';
    if (!n) { box.innerHTML = '<p class="mn-small">Buy your first miner in the shop. It will show up here.</p>'; }
    else {
      box.textContent = '';
      for (const m of MACHINES) {
        const k = own(m.id); if (!k) continue;
        const row = document.createElement('div'); row.className = 'mn-mrow';
        row.innerHTML = `<span class="mn-mname"><b></b><span>×${k.toLocaleString('en-US')}</span></span><span class="mn-strip">${ART.icon(m.id, 28).repeat(Math.min(k, 40))}</span>`;
        row.querySelector('b').textContent = m.name;
        box.append(row);
      }
    }
    let best = 'laptop'; for (const m of MACHINES) if (own(m.id)) best = m.id;
    const sc = ART.SCENE_FOR[best];
    if (sc !== sceneId) {
      const el = $('scene'), first = !sceneId; sceneId = sc; $('stage').dataset.scene = sc;
      el.classList.add('swap');
      setTimeout(() => { el.innerHTML = ART.scene(sc); el.classList.remove('swap'); }, first ? 0 : 350);
    }
  }

  // ---------- hard fork ----------
  let forkArm = 0;
  function renderFork() {
    const box = $('p-fork'), pts = pendingPts(), lvl = S.prestige;
    const nextAt = Math.pow(forkLevel() + 1, 3) * FORK_DIV;
    let html = '<p class="mn-small">A hard fork restarts your mine from zero. You keep achievements, relics, fork points and play time. Every fork point adds +5% to production and clicks, forever.</p>';
    if (S.allTime < FORK_DIV && !lvl) {
      html += `<p><b>Unlocks at 1 B game PEP mined in total.</b> You have mined ${fmt(S.allTime)}.</p><div class="mn-bar thin"><i style="width:${(S.allTime / FORK_DIV * 100).toFixed(1)}%"></i></div>`;
    } else {
      html += `<div class="mn-forkbox"><div><span class="mn-label">Fork level</span><b class="big">${lvl}</b><span class="mn-small">+${Math.round(lvl * LEVEL_BONUS * 100)}% production and clicks</span></div>`
        + `<div><span class="mn-label">Fork now for</span><b class="big">+${pts}</b><span class="mn-small">next point at ${fmt(nextAt)} mined in total</span></div>`
        + `<div><span class="mn-label">Relic points</span><b class="big">${S.chips}</b><span class="mn-small">spend them below</span></div></div>`
        + `<button class="btn primary" id="forkbtn" type="button"${pts < 1 ? ' disabled' : ''}>${forkArm > now() ? '⚠️ Sure? Click again to fork' : '🍴 Hard fork now'}</button>`;
    }
    html += '<h2>Relics</h2><div class="mn-relics" id="relics"></div>';
    box.innerHTML = html;
    const fb = $('forkbtn');
    if (fb) fb.onclick = () => { if (forkArm > now()) { forkArm = 0; hardFork(); } else { forkArm = now() + 5000; renderFork(); setTimeout(renderFork, 5100); } };
    const rb = $('relics');
    for (const r of RELICS) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'mn-up mn-relic' + (S.relics[r.id] ? ' owned' : ''); b.dataset.id = r.id;
      b.innerHTML = '<span class="ui"></span><span class="ut"><b></b><span class="d"></span><span class="cost"></span></span>';
      b.querySelector('.ui').textContent = r.ico; b.querySelector('b').textContent = r.name; b.querySelector('.d').textContent = r.desc;
      b.querySelector('.cost').textContent = S.relics[r.id] ? '✓ Owned' : `${r.cost} relic point${r.cost > 1 ? 's' : ''}`;
      b.disabled = !!S.relics[r.id] || S.chips < r.cost;
      b.onclick = () => { if (S.relics[r.id] || S.chips < r.cost) return; S.chips -= r.cost; S.relics[r.id] = now(); toast('Relic: ' + r.name, r.desc, E('torch')); renderFork(); renderShop(); save(); };
      rb.append(b);
    }
  }
  function hardFork() {
    const pts = pendingPts(); if (pts < 1) return;
    S.prestige += pts; S.chips += pts; S.forks += 1;
    Object.assign(S, { pep: 0, total: 0, own: {}, up: {}, buffs: [], nextLaunch: 0, buyPlayMs: S.playMs });
    if (S.relics.genesis) S.own = { laptop: 10, pc: 5 };
    if (S.relics.friends) S.up = { pick: now(), pool: now() };
    main.classList.remove('rally');
    toast(`Hard fork #${S.forks}`, `+${pts} fork points. Your new chain mines ${Math.round(S.prestige * LEVEL_BONUS * 100)}% faster.`, E('waiting'));
    lastShopKey = ''; sceneId = ''; renderAll(); save();
  }

  // ---------- stats ----------
  function renderStats() {
    const rows = [
      ['Game PEP mined, this fork', fmt(S.total)], ['Game PEP mined, all time', fmt(S.allTime)], ['Blocks mined, all time', fmt(Math.floor(S.allTime / BLOCK))],
      ['Production now', `${fmt(rate())} game PEP/s`], ['Best production', `${fmt(S.st.best)} game PEP/s`], ['One click', `${fmt(clickValue())} game PEP`],
      ['Machines', totalOwned().toLocaleString('en-US')], ['Upgrades bought', `${Object.keys(S.up).length} of ${UPGRADES.length}`],
      ['Coin clicks', S.st.clicks.toLocaleString('en-US')], ['Golden feet caught', String(S.st.foot)], ['Muddy feet clicked', String(S.st.muddy)], ['Wrong Pepes clicked', String(S.st.traps)], ['Prayers', String(S.st.prays)],
      ['Tokens launched', String(S.st.launches)], ['Hard forks', String(S.forks)], ['Fork level', `${S.prestige} (+${Math.round(S.prestige * LEVEL_BONUS * 100)}%)`],
      ['Play time', fmtTime(S.playMs)],
    ];
    const dl = $('stats'); dl.textContent = '';
    for (const [k, v] of rows) { const d = document.createElement('div'); d.innerHTML = '<dt></dt><dd></dd>'; d.firstChild.textContent = k; d.lastChild.textContent = v; dl.append(d); }
  }

  // ---------- tabs ----------
  let tab = 'shop';
  const TABS = ['shop', 'ach', 'fork', 'stats'];
  function setTab(t, focus) {
    tab = t;
    for (const x of TABS) {
      const b = $('tab-' + x), on = x === t;
      b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; $('p-' + x).hidden = !on;
      if (on && focus) b.focus();
    }
    if (t === 'ach') renderAch(); if (t === 'fork') renderFork(); if (t === 'stats') renderStats();
  }
  TABS.forEach((x, i) => {
    const b = $('tab-' + x);
    b.onclick = () => setTab(x);
    b.onkeydown = (e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); setTab(TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length], true); } };
  });

  // ---------- painting ----------
  let lastShopKey = '';
  function shopKey() {
    return MACHINES.map((m) => own(m.id) + (S.total >= m.cost * 0.4 ? 's' : '')).join(',') + '|' + UPGRADES.map((u) => (S.up[u.id] ? 1 : u.need() ? 2 : 0)).join('')
      + '|' + Object.keys(S.relics).length + '|' + S.prestige;
  }
  let lastBlocks = -1;
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
    if (lastBlocks >= 0 && blocks > lastBlocks && perSec < 0.3) blockFound(blocks);
    lastBlocks = blocks;
    const nt = r * HS_PER_PEP / NET_HS * 100;
    $('netpct').textContent = nt >= 100 ? 'More than the whole network!' : (nt < 0.01 && nt > 0 ? '<0.01' : nt.toFixed(nt < 1 ? 2 : 1)) + '%';
    $('netbar').style.width = Math.min(100, nt) + '%';
    const bf = $('buffs'); bf.textContent = '';
    for (const b of live()) {
      const left = Math.ceil((b.until - now()) / 1000);
      const s = document.createElement('span'); s.className = 'mn-buff ' + b.kind;
      s.textContent = `${b.label} · ${left >= 60 ? Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0') : left + 's'}`; bf.append(s);
    }
    main.classList.toggle('rally', !!active('rally'));
    const k = shopKey();
    if (k !== lastShopKey) { lastShopKey = k; renderShop(); renderMine(); if (tab === 'fork') renderFork(); } else refreshAfford();
  }
  function renderAll() { lastShopKey = ''; paint(); renderAch(); if (tab === 'fork') renderFork(); if (tab === 'stats') renderStats(); }

  // ---------- effects ----------
  function blockFound(n) {
    if (reduced) return;
    const f = $('found'); f.textContent = `⛏️ Block #${n.toLocaleString('en-US')} found!`; f.hidden = false;
    f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
    clearTimeout(f._t); f._t = setTimeout(() => { f.hidden = true; }, 1600);
  }
  let dropAcc = 0;
  function rain(dt) {
    if (reduced || document.hidden || !S.started) return;
    const r = rate(); if (r <= 0) return;
    dropAcc += dt * Math.min(9, 0.6 + Math.log10(r + 1) * 0.9);
    const layer = $('rain');
    while (dropAcc >= 1) {
      dropAcc -= 1;
      if (layer.childElementCount > 36) continue;
      const d = document.createElement('i'); d.className = 'mn-drop'; d.textContent = 'P';
      const sz = 12 + Math.random() * 10;
      d.style.cssText = `left:${(Math.random() * 96).toFixed(1)}%;width:${sz}px;height:${sz}px;font-size:${(sz * 0.62).toFixed(1)}px;animation-duration:${(2.2 + Math.random() * 1.6).toFixed(2)}s`;
      layer.append(d); setTimeout(() => d.remove(), 4000);
    }
  }
  function sparks(x, y) {
    if (reduced) return;
    const layer = $('stage');
    for (let i = 0; i < 7; i++) {
      const s = document.createElement('i'); s.className = 'mn-spark';
      const a = Math.random() * Math.PI * 2, d = 30 + Math.random() * 40;
      s.style.cssText = `left:${x}px;top:${y}px;--dx:${(Math.cos(a) * d).toFixed(0)}px;--dy:${(Math.sin(a) * d).toFixed(0)}px`;
      layer.append(s); setTimeout(() => s.remove(), 650);
    }
  }

  // ---------- actions ----------
  function bought() { S.buyPlayMs = S.playMs; }
  function buy(m) {
    const c = costOf(m); if (S.pep < c) return;
    S.pep -= c; S.own[m.id] = own(m.id) + 1; bought(); paint(); save();
  }
  function buyUp(u) {
    if (!u || S.pep < u.cost || S.up[u.id]) return;
    S.pep -= u.cost; S.up[u.id] = now(); bought();
    if (u.id === 'newlaptop') {
      const big = !!S.relics.blessing;
      addBuff('rally', `📈 ATH rally ×${big ? 5 : 3}`, big ? 5 : 3, big ? 360 : 180, 'gold');
      toast('ATH RALLY!', 'Three months of green candles, squeezed into a few minutes.', E('cheer'));
    }
    if (u.id === 'printer') { S.nextLaunch = now() + 20e3; toast('Tokenprinter.fun is live', "First PRC-20 launch in 20 seconds. Most rug. Some don't.", E('news')); }
    paint(); save();
  }
  let clickTimes = [];
  $('coin').addEventListener('click', (ev) => {
    if (!S.started) return;
    const v = clickValue(); earn(v); S.st.clicks++;
    clickTimes = clickTimes.filter((t) => now() - t < 2000).concat(now());
    if (clickTimes.length >= 15) S.st.fast = 1;
    const st = $('stage').getBoundingClientRect(), x = (ev.clientX || st.left + st.width / 2) - st.left, y = (ev.clientY || st.top + st.height / 2) - st.top;
    const p = document.createElement('span'); p.className = 'mn-pop'; p.textContent = '+' + fmt(v);
    p.style.left = x + 'px'; p.style.top = (y - 10) + 'px';
    $('stage').append(p); setTimeout(() => p.remove(), 900);
    sparks(x, y);
    const c = $('coin'); c.classList.remove('hit'); void c.offsetWidth; c.classList.add('hit');
    paint();
  });
  $('startbtn').addEventListener('click', () => { S.started = true; $('start').hidden = true; schedule(); checkAch(); renderPray(); save(); });
  $('share').addEventListener('click', async () => {
    const text = `I mine ${fmtHash(rate() * HS_PER_PEP)} in Pepe Miner 🐸⛏️ ${Math.floor(S.allTime / BLOCK).toLocaleString('en-US')} blocks${S.forks ? `, ${S.forks} hard forks` : ''} so far. Can you beat it?`;
    const url = 'https://pepecoinhub.com/games/miner.html';
    try { if (navigator.share) { await navigator.share({ text, url }); return; } await navigator.clipboard.writeText(text + ' ' + url); toast('Copied', 'Paste it on X, Reddit or Discord.', E('pep')); }
    catch (e) { toast('Share', text + ' ' + url, E('pep')); }
  });

  // ---------- golden foot ----------
  const rnd = (a, b) => a + Math.random() * (b - a);
  const footGap = () => rnd(90e3, 240e3) / (S.relics.feet ? 2 : 1);
  function schedule() {
    if (!S.nextFoot || S.nextFoot < now()) S.nextFoot = now() + footGap();
    if (!S.nextEvent || S.nextEvent < now()) S.nextEvent = now() + rnd(120e3, 300e3);
  }
  const pick = (list) => { let t = list.reduce((s, x) => s + x.w, 0) * Math.random(); for (const x of list) if ((t -= x.w) < 0) return x; return list[0]; };
  const GOLD = [
    { w: 40, run: () => { addBuff('frenzy', '🦶 Golden foot ×7', 7, 30, 'gold'); return ['Golden foot!', 'Everything mines ×7 for 30 seconds.']; } },
    { w: 30, run: () => { const g = Math.min(S.pep * 0.15, baseRate() * 900) + 13; earn(g); return ['Lucky step!', `+${fmt(g)} game PEP`]; } },
    { w: 12, run: () => { const m = 1 + 0.1 * totalOwned(); addBuff('boom', `🏗️ Machine boom ×${fmt(m)}`, m, 30, 'gold'); return ['Machine boom!', `+10% for each of your ${totalOwned()} machines, for 30 seconds.`]; } },
    { w: 8, run: () => { addBuff('clickfrenzy', '👆 Click frenzy ×777', 1, 13, 'gold', 777); return ['Click frenzy!', 'Clicks mine ×777 for 13 seconds. Click, click, click!']; } },
    { w: 6, run: () => { addBuff('steady', '🦶 Steady steps ×2', 2, 180, 'gold'); return ['Steady steps', 'Everything mines ×2 for 3 minutes.']; } },
    { w: 4, run: () => { const seen = MACHINES.filter((m) => own(m.id) > 0); const m = seen[seen.length - 1] || MACHINES[0]; S.own[m.id] = own(m.id) + 1; return ['Free miner!', `Someone left a ${m.name} on your doorstep.`]; } },
  ];
  const MUD = [
    { w: 45, run: () => { if (S.up.hw) return ['Rug blocked', 'A muddy foot tried to rug you. Your hardware wallet said no.']; const g = Math.min(S.pep * 0.05, baseRate() * 900); S.pep -= g; return ['Rug pull!', `A muddy foot ran off with ${fmt(g)} game PEP.`]; } },
    { w: 35, run: () => { addBuff('mud', '🟤 Stuck in mud ×0.5', 0.5, 30, 'bad'); return ['Stuck in the mud', 'Everything mines ×0.5 for 30 seconds.']; } },
    { w: 20, run: () => { addBuff('elder', '🟤 Swamp frenzy ×66', 66, 6, 'gold'); return ['Swamp frenzy!', 'Muddy, but lucky: everything mines ×66 for 6 seconds.']; } },
  ];
  function spawnFoot(forceMuddy) {
    const f = $('foot'), btn = f.querySelector('button');
    const muddy = forceMuddy !== undefined ? forceMuddy : (totalOwned() >= 50 && Math.random() < 0.12);
    f.hidden = false; f.classList.toggle('muddy', muddy);
    btn.setAttribute('aria-label', muddy ? 'Muddy foot: risky, click if you dare' : 'Golden foot: click for a bonus');
    f.style.left = rnd(6, 82) + 'vw'; f.style.top = rnd(18, 76) + 'vh';
    clearTimeout(f._t); f._t = setTimeout(() => { f.hidden = true; }, S.relics.feet ? 20000 : 13000);
    btn.onclick = () => {
      clearTimeout(f._t); f.hidden = true;
      if (muddy) S.st.muddy++; else S.st.foot++;
      const [t, msg] = pick(muddy ? MUD : GOLD).run();
      toast(t, msg, E(muddy ? 'scream' : 'hurry'), muddy ? 'bad' : '');
      checkAch(); paint();
    };
  }

  // ---------- random events ----------
  const EVENTS = [
    { id: 'whale', ok: () => true, run: () => { addBuff('whale', '🐋 Whale buys ×2', 2, 45); return ['A whale bought the dip', 'Everyone is excited. Miners ×2 for 45 seconds.', 'crowd']; } },
    { id: 'candle', ok: () => true, run: () => { S.st.candles++; addBuff('candle', '🟢 Green candle: clicks ×10', 1, 20, '', 10); return ['Green candle', 'Clicks mine ×10 for 20 seconds. Go!', P('candle', 'cheer')]; } },
    { id: 'cat', ok: () => baseRate() > 0, run: () => { addBuff('cat', '🐈 Cable unplugged ×0.5', 0.5, 15, 'bad'); return ['The cat unplugged the garage', 'Half your miners are offline for 15 seconds.', 'scream']; } },
    { id: 'doge', ok: () => !!S.up.merged, run: () => { const g = baseRate() * 120; earn(g); return ['Your pool found a DOGE block', `Merged mining pays twice: +${fmt(g)} game PEP.`, 'hug']; } },
    { id: 'reddit', ok: () => true, run: () => { addBuff('reddit', '🔥 Front page ×1.5', 1.5, 60); return ['Your post hit the front page of r/pepecoin', 'New miners join the pool. ×1.5 for 60 seconds.', 'news']; } },
    { id: 'fud', ok: () => baseRate() > 0, run: () => { fud(); return null; } },
    { id: 'pepelord', ok: () => baseRate() > 0, run: () => { S.st.pepelord++; addBuff('pepelord', '👑 Pepelord in chat ×5', 5, 60, 'gold'); return ['Pepelord joined the chat', 'The whole pond wakes up. Miners ×5 for 1 minute.', 'peek']; } },
    { id: 'zomboid', ok: () => baseRate() > 0, run: () => { addBuff('zomboid', '🧟 Zomboid news ×0.7', 0.7, 20, 'bad'); return ['Project Zomboid announcement', 'Everyone stopped mining to read it. Miners ×0.7 for 20 seconds.', 'loading']; } },
  ];
  let lastEvent = '';
  function runEvent(id) {
    const pool = EVENTS.filter((e) => e.ok() && e.id !== lastEvent), e = id ? EVENTS.find((x) => x.id === id) : pool[Math.floor(Math.random() * pool.length)];
    if (!e) return; lastEvent = e.id;
    const r = e.run(); if (r) showEvent(r[0], r[1], r[2]);
    checkAch();
  }
  function showEvent(title, text, img, button) {
    const ev = $('event'); ev.innerHTML = '<img alt=""><div><b></b><p></p></div>';
    ev.querySelector('img').src = img.includes('/') ? img : E(img); ev.querySelector('b').textContent = title; ev.querySelector('p').textContent = text;
    if (button) ev.append(button);
    ev.hidden = false; clearTimeout(ev._t); ev._t = setTimeout(() => { ev.hidden = true; }, button ? 10000 : 6000);
  }
  function fud() {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn primary sm'; b.textContent = '💎 Hold';
    b.onclick = () => { $('event').hidden = true; S.st.held++; addBuff('hold', '💎 Held through FUD ×3', 3, 20, 'gold'); toast('You held', 'FUD faded. Miners ×3 for 20 seconds.', E('serious')); checkAch(); };
    showEvent('FUD on X: "PEP is dead"', 'Hold within 10 seconds and the panic pays you back.', 'serious', b);
  }
  function launchToken() {
    const t = '$' + TICKERS[Math.floor(Math.random() * TICKERS.length)], roll = Math.random(), base = baseRate(), rug = S.relics.whitelist ? 0.5 : 0.7;
    S.st.launches++;
    if (roll < rug) toast(`${t} launched on Tokenprinter.fun`, `Rugged in ${Math.ceil(rnd(1, 9))} minutes. Classic.`, E('scream'));
    else if (roll < 0.95) { const g = base * 60; earn(g); toast(`${t} pumped ×10`, `You sold the top: +${fmt(g)} game PEP.`, E('cheer')); }
    else { const g = base * 600; earn(g); S.st.moons++; toast(`${t} MOONED 🚀`, `+${fmt(g)} game PEP. Lewis approves.`, E('torch')); }
    checkAch();
  }

  // ---------- the wrong Pepe: flies across the screen, clicking it costs 25% of your game PEP ----------
  function spawnTrap() {
    const t = $('trap'), btn = t.querySelector('button');
    t.querySelector('img').src = P('trap', 'smoke');
    t.classList.toggle('rtl', Math.random() < 0.5);
    t.style.top = rnd(16, 70) + 'vh';
    t.hidden = false; t.classList.remove('fly');
    if (reduced) t.style.left = rnd(8, 80) + 'vw'; else { t.style.left = ''; void t.offsetWidth; t.classList.add('fly'); }
    clearTimeout(t._t); t._t = setTimeout(() => { t.hidden = true; }, 8000);
    btn.onclick = () => {
      clearTimeout(t._t); t.hidden = true;
      const loss = S.pep * 0.25; S.pep -= loss; S.st.traps++;
      toast('Wrong Pepe, fren!', `That one was a trap: −${fmt(loss)} game PEP (25% of your bank).`, P('wrongpep', 'scream'), 'bad');
      checkAch(); paint(); save();
    };
  }

  // ---------- prayer: ×4 for 45 seconds, once every 15 minutes ----------
  const PRAY_CD = 15 * 60e3;
  function renderPray() {
    const b = $('pray'), img = $('prayimg'), left = (S.prayAt || 0) + PRAY_CD - now(), src = P('pray', 'peek');
    if (img.getAttribute('src') !== src) img.src = src;
    b.disabled = !S.started || left > 0;
    $('praytxt').textContent = left > 0 ? `Again in ${Math.floor(left / 60000)}:${String(Math.floor(left % 60000 / 1000)).padStart(2, '0')}` : '×4 for 45 seconds';
  }
  $('pray').addEventListener('click', () => {
    if (!S.started || (S.prayAt || 0) + PRAY_CD > now()) return;
    S.prayAt = now(); S.st.prays++; addBuff('pray', '🙏 Prayer ×4', 4, 45, 'gold');
    toast('Prayer heard', 'Everything mines ×4 for 45 seconds.', P('pray', 'peek')); renderPray(); paint(); save();
  });

  // the golden foot uses the owner's "Zord feet" picture once it is uploaded
  function footPic() {
    if (!picUrl.zord) return;
    const btn = $('foot').querySelector('button');
    btn.classList.add('pic'); btn.innerHTML = `<img src="${picUrl.zord}" alt="">`;
  }

  // ---------- news ticker ----------
  const has = (id) => own(id) > 0;
  const NEWS = [
    ['Local frog opens an old laptop and hears the fan for the first time.', () => totalOwned() < 5],
    ['Neighbours ask why the laptop is so warm.', () => has('laptop') && !has('rig')],
    ['Frog discovers that graphics cards can do more than games.', () => has('pc') && !has('asic')],
    ['Rig frog spotted buying riser cables in bulk.', () => has('rig')],
    ['Scrypt ASIC arrives. The old laptop retires with honours.', () => has('asic') && !has('farm')],
    ['Neighbours complain about a humming garage. Frog blames the fridge.', () => has('garage')],
    ['Farm frogs demand a night-shift bonus. Management offers flies.', () => has('farm')],
    ['Power company sends frog a thank-you card. And a very large bill.', () => has('plant')],
    ['Swamp data center wins "Wettest Cloud" award.', () => has('dc')],
    ['Fish file a complaint about the waterfall mine. Turbines now fish-safe.', () => has('hydro')],
    ['Moon base reports zero noise complaints for the 30th day in a row.', () => has('moon')],
    ['Every frog in the pond now runs a node. Tadpoles want in too.', () => has('pond')],
    ['Martian shares arrive 22 minutes late. Nobody minds.', () => has('mars')],
    ['Tokenprinter.fun prints its 1,000th token. Most of them already rugged.', () => !!S.up.printer],
    ['Frog explains merged mining at dinner. Family leaves the table.', () => !!S.up.merged],
    ['Mysterious buyer trades 40 million PEP for a laptop. Analysts confused.', () => S.total >= 1e7 && !S.up.newlaptop],
    ['Green candles everywhere. Experts urge everyone to stay calm.', () => !!active('rally')],
    ['Hard fork complete. The old chain sends its regards.', () => S.forks > 0],
    ['Your mine is now bigger than the real Pepecoin network. Somehow.', () => net() >= 1],
    ['Fact: a new Pepecoin block is found about every 60 seconds.', () => true],
    ['Fact: Pepecoin is merged-mined with Litecoin and Dogecoin, so the same miners secure all three.', () => true],
    ['Fact: every Pepecoin block pays the miner 10,000 PEP.', () => true],
    ['Reminder: never share your seed phrase. Not even with a frog.', () => true],
    ['Reminder: game PEP are points, not coins. The real ones are mined by real machines.', () => true],
    ['Survey: 9 out of 10 frogs prefer Scrypt.', () => true],
    ['Cat union demands more cables to unplug.', () => true],
    ['Analysts agree: number goes up, unless it goes down.', () => true],
    ['Breaking: frog buys the dip. The dip buys the frog.', () => true],
    ['Local man still waiting for his pickaxe upgrade.', () => !S.up.pick],
    ['Study finds clicking a coin is good for your mood. Peer review pending.', () => S.st.clicks > 200],
    ['Golden foot spotted near the swamp. Witnesses describe it as "very shiny".', () => S.st.foot > 0],
    ['Muddy footprints found near the vault. Police baffled.', () => S.st.muddy > 0],
    ['Pepelord seen in chat again. Productivity soars.', () => S.st.pepelord > 0],
    ['Someone clicked the wrong Pepe again. Check twice, fren.', () => S.st.traps > 0],
    ['Frogs report that prayer works. Sample size: one frog.', () => S.st.prays > 0],
  ];
  const recentNews = [];
  function nextNews() {
    const pool = NEWS.filter(([t, ok]) => ok() && !recentNews.includes(t));
    if (!pool.length) return;
    const [t] = pool[Math.floor(Math.random() * pool.length)];
    recentNews.push(t); if (recentNews.length > 8) recentNews.shift();
    const el = $('news'); el.classList.remove('in'); void el.offsetWidth; el.textContent = t; el.classList.add('in');
  }

  // ---------- loop ----------
  let last = performance.now(), slow = 0;
  function loop() {
    const t = performance.now(), dt = Math.min(1, (t - last) / 1000); last = t;
    if (S.started) {
      earn(rate() * dt);
      if (!document.hidden) S.playMs += dt * 1000;
      if (now() > S.nextFoot && $('foot').hidden) { spawnFoot(); S.nextFoot = now() + footGap(); }
      if (now() > S.nextEvent && $('event').hidden) { runEvent(); S.nextEvent = now() + rnd(120e3, 300e3); }
      if (now() > S.nextTrap && $('trap').hidden && baseRate() > 0) { if (S.nextTrap) spawnTrap(); S.nextTrap = now() + rnd(240e3, 540e3); }
      if (S.up.printer && now() > S.nextLaunch) { launchToken(); S.nextLaunch = now() + (S.relics.rolodex ? 90e3 : 180e3); }
      rain(dt);
      if ((slow += dt) >= 1) { slow = 0; S.st.best = Math.max(S.st.best, rate()); renderPray(); checkAch(); if (tab === 'stats') renderStats(); if (tab === 'fork') updateForkNumbers(); }
    }
    S.buffs = live();
    paint();
  }
  let lastForkKey = '';
  function updateForkNumbers() { const k = pendingPts() + '|' + forkLevel() + '|' + (S.allTime < FORK_DIV ? Math.floor(S.allTime / FORK_DIV * 100) : ''); if (k !== lastForkKey) { lastForkKey = k; renderFork(); } }
  function spawnCandle() {
    const c = document.createElement('i'); c.className = 'mn-candle';
    c.style.left = rnd(0, 100) + 'vw'; c.style.height = rnd(40, 140) + 'px'; c.style.animationDuration = rnd(3, 7) + 's';
    document.querySelector('.mn-candles').append(c); setTimeout(() => c.remove(), 7000);
  }
  setInterval(() => { if (active('rally') && !reduced) for (let i = 0; i < 2; i++) spawnCandle(); }, 400);

  // ---------- Easter egg: cheat code "klapaucius" (×100 for 1 minute). Type it, or tap the coin 5 times quickly. Kept on purpose. ----------
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

  // ---------- start ----------
  if (S.started) {
    $('start').hidden = true;
    const away = Math.min((S.relics.memory ? 24 : 8) * 3600e3, Date.now() - (S.lastSeen || Date.now()));
    const g = baseRate() * away / 1000;
    if (away > 60e3) S.st.returns++;
    if (away > 60e3 && g > 0) { earn(g); setTimeout(() => toast('While you were away', `Your miners dug ${fmt(g)} game PEP.`, E('smoke')), 400); }
    schedule();
  }
  lastBlocks = Math.floor(S.total / BLOCK);
  renderAll(); renderPray(); nextNews();
  footPic();
  setInterval(loop, 100);
  setInterval(nextNews, 9000);
  setInterval(save, 5000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  window.addEventListener('pagehide', save);
  if (/[?&]debug=1/.test(location.search)) window.__mn = {
    S: () => S, set: (o) => { Object.assign(S, o); renderAll(); }, spawnFoot, spawnTrap, runEvent, showEvent, fud, launchToken, hardFork, nextNews, setTab,
    buyUp: (id) => buyUp(UPGRADES.find((u) => u.id === id)), toast, E,
  };
})();
