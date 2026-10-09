import { $, $$, h, getBackend, badge, backendBanner, paintMe, fmtLocal, fmtLeft } from './common.js';
const be = await getBackend();
backendBanner($('#main')); paintMe(be);
let showGuests = true, tab = new URLSearchParams(location.search).get('tab') || 'season';
if (!['season', 'hof', 'recent'].includes(tab)) tab = 'season';
const medal = (p) => ({ 1: '🥇', 2: '🥈', 3: '🥉' })[p] || p;

function table(rows) {
  const list = rows.filter((r) => showGuests || r.verified);
  if (!list.length) return h('p', { class: 'muted' }, 'Nobody has scored in this period yet. Play the first game and grab first place!');
  return h('table', { class: 'rank' },
    h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'Player'), h('th', { class: 'num' }, 'Points'), h('th', { class: 'num', title: '1st-place guesses (tie-break)' }, '🥇 1st'), h('th', { class: 'num', title: '2nd-place guesses (tie-break)' }, '🥈 2nd'), h('th', { class: 'num' }, 'Games'))),
    h('tbody', {}, list.map((r) => h('tr', { class: r.place === 1 ? 'top1' : '' },
      h('td', { class: 'medal' }, medal(r.place)), h('td', {}, h('b', {}, r.nick), ' ', badge(r.verified)),
      h('td', { class: 'num' }, r.points), h('td', { class: 'num' }, r.firsts ?? ''), h('td', { class: 'num' }, r.seconds ?? ''), h('td', { class: 'num' }, r.games ?? '')))));
}
let season = null, offset = 0, cdTimer = null;
function prizesPanel(se) {
  const list = Array.isArray(se?.prizes) ? se.prizes : [];
  return h('div', { class: 'card prizes', id: 'prizes', style: 'margin:12px 0;padding:12px 16px;background:var(--accent-wash)' },
    h('h3', { style: 'margin:0 0 6px' }, '🎁 Season prizes'),
    list.length ? h('ul', { style: 'margin:0;padding-left:18px' }, list.map((x) => h('li', {}, h('b', {}, x.place ? x.place + ': ' : ''), x.prize || '')))
      : h('p', { class: 'muted', style: 'margin:0' }, 'Prizes to be announced.'),
    se?.prize_note ? h('p', { class: 'small muted', style: 'margin:6px 0 0' }, se.prize_note) : null);
}
function seasonHead(se, d) {
  const cd = h('span', { id: 'season-cd', class: 'mono' });
  const upd = () => {
    const now = Date.now() + offset;
    if (!se) { cd.textContent = ''; return; }
    if (se.phase === 'season') cd.textContent = `${se.break_name} in ${fmtLeft(Date.parse(se.ends_at) - now)}`;
    else cd.textContent = `${se.next_name} starts in ${fmtLeft(Date.parse(se.next_starts_at) - now)}`;
  };
  upd(); clearInterval(cdTimer); cdTimer = setInterval(upd, 1000);
  const viewingCurrent = !d || d.season_no === se?.no;
  return h('div', { id: 'season-head' },
    h('h2', { style: 'margin:0' }, d?.label || se?.name || 'Season'),
    h('p', { class: 'small', style: 'margin:4px 0 0' },
      se?.phase === 'season' && viewingCurrent ? [h('b', { id: 'season-week' }, `Week ${se.week} of ${se.weeks}`), ' · ', cd]
        : se?.phase === 'break' ? [h('b', { id: 'season-week' }, `${se.break_name}: no ranked games`), ' · ', cd]
        : se?.phase === 'pre' ? [h('b', {}, 'Coming soon'), ' · ', cd] : null),
    h('p', { class: 'small muted', style: 'margin:4px 0 0' }, `Ranked: weekly Guess the Picture nights (${se?.weeks || 10} per season). First 3 correct guesses score 3 / 2 / 1 points. After the season, the top 3 go to the Hall of Fame and the board starts again from zero.`));
}
async function render() {
  $$('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  const p = $('#panel'); p.textContent = ''; clearInterval(cdTimer);
  const guestsToggle = () => h('label', { class: 'row small', style: 'margin:0;gap:6px' }, h('input', { type: 'checkbox', id: 'guests', checked: showGuests, onchange: (e) => { showGuests = e.target.checked; render(); } }), 'show guests');
  try {
    if (tab === 'season') {
      const d = await be.rpc('gry_ranking', { p_period: 'season' });
      season = d.season; offset = 0;
      p.append(h('div', { class: 'row', style: 'justify-content:space-between;align-items:flex-start' }, seasonHead(season, d), guestsToggle()),
        prizesPanel(season), table(d.rows));
    } else if (tab === 'hof') {
      const d = await be.rpc('gry_hall_of_fame');
      p.append(h('h2', {}, '🏆 Hall of Fame'));
      if (!d.length) p.append(h('p', { class: 'muted' }, 'The first season is still running. Its top 3 will show up here when it ends.'));
      else p.append(h('div', { class: 'hof' }, d.map((s) => h('div', { class: 'card' }, h('h3', {}, s.season || 'Season ' + s.season_no),
        (s.top || []).map((t) => h('div', { class: 'row', style: 'justify-content:space-between' }, h('span', {}, medal(t.place), ' ', h('b', {}, t.nick), ' ', badge(t.verified)), h('span', { class: 'mono' }, t.points)))))));
    } else {
      const d = await be.rpc('gry_recent_games', { p_limit: 12 });
      p.append(h('h2', {}, 'Recent games'), h('p', { class: 'small muted', style: 'margin-top:0' }, 'Guess the Picture nights only. Draw & Guess scores are not saved.'));
      if (!d.length) p.append(h('div', { class: 'empty' }, h('img', { class: 'frog-s', src: 'img/frog-thinker.svg', alt: '', width: 96, height: 124 }), h('p', { class: 'muted' }, 'No games played yet.')));
      for (const g of d) p.append(h('div', { style: 'border-top:1px solid var(--grid);padding:10px 0' },
        h('b', {}, g.title), h('span', { class: 'small muted' }, ' · ' + 'Guess the Picture' + (g.ranked ? ' (ranked' + (g.season ? ', ' + g.season : '') + ')' : ' (unranked)') + ' · ' + fmtLocal(new Date(g.finished_at))),
        h('div', { class: 'small', style: 'margin-top:4px' }, (g.results || []).map((r) => h('span', { style: 'margin-right:14px;white-space:nowrap' }, medal(r.place), ' ', r.nick, r.verified ? ' ✓' : ' (guest)', ' ', h('span', { class: 'mono muted' }, r.points))))));
    }
  } catch (e) { p.append(h('p', { class: 'muted' }, e.message)); }
}
$$('.tabs button').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; render(); }));
render();
