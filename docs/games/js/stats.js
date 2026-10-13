// Site statistics for the owner only (games.owners). The server refuses everyone else, hosts included.
import { $, h, getBackend, paintMe, discordIcon } from './common.js';

const be = await getBackend();
paintMe(be);
const box = $('#st-body');
const fmt = (n) => Number(n || 0).toLocaleString('en-US');
const dayLabel = (d) => new Date(d + 'T12:00:00').toLocaleDateString([], { day: 'numeric', month: 'short' });

function loginBox(msg) {
  box.textContent = '';
  box.append(h('div', { class: 'card st-login' }, h('p', {}, msg),
    h('button', { class: 'btn discord', onclick: async () => { try { await be.discord(); } catch (e) { alert(e.message); } } }, discordIcon(), 'Log in with Discord')));
}

async function load(days = 30) {
  if (be.kind === 'none') { box.textContent = 'No server connected.'; return; }
  if (!be.session()) return loginBox('Log in with the owner\'s Discord account to see the statistics.');
  let d;
  try { d = await be.rpc('gry_stats', { p_days: days }); }
  catch (e) { return loginBox(/owner/i.test(e.message) ? 'This account is not the site owner. Only the owner can see the statistics.' : e.message); }
  const rows = d.days || [], today = d.today;
  const byDay = Object.fromEntries(rows.map((r) => [r.day, r]));
  const sum = (n, key) => { let t = 0; for (let i = 0; i < n; i++) { const k = new Date(Date.parse(today + 'T12:00:00Z') - i * 864e5).toISOString().slice(0, 10); t += byDay[k]?.[key] || 0; } return t; };
  const yday = new Date(Date.parse(today + 'T12:00:00Z') - 864e5).toISOString().slice(0, 10);
  const tiles = [
    ['Today', byDay[today]?.views, byDay[today]?.people],
    ['Yesterday', byDay[yday]?.views, byDay[yday]?.people],
    ['Last 7 days', sum(7, 'views'), sum(7, 'people')],
    ['Last 30 days', sum(30, 'views'), sum(30, 'people')],
  ];
  const max = Math.max(1, ...rows.map((r) => r.views));
  box.textContent = '';
  box.append(
    h('div', { class: 'st-tiles' }, tiles.map(([l, v, p]) => h('div', { class: 'card st-tile' }, h('span', { class: 'st-l' }, l), h('b', {}, fmt(v)), h('span', { class: 'small muted' }, 'page views'), h('b', { class: 'st-p' }, fmt(p)), h('span', { class: 'small muted' }, 'people')))),
    h('section', { class: 'card' }, h('h2', {}, 'Day by day'),
      h('div', { class: 'st-chart', role: 'img', 'aria-label': 'Page views per day' },
        rows.map((r) => h('div', { class: 'st-bar', title: `${dayLabel(r.day)}: ${fmt(r.views)} views, ${fmt(r.people)} people` },
          h('i', { style: `height:${(r.views / max * 100).toFixed(1)}%` }), h('i', { class: 'pp', style: `height:${(r.people / max * 100).toFixed(1)}%` }),
          h('span', {}, dayLabel(r.day))))),
      h('p', { class: 'small muted' }, 'Green: page views. Dark: people. Hover or tap a bar for the numbers.')),
    h('section', { class: 'card' }, h('h2', {}, 'Pages, last 30 days'),
      h('div', { class: 'tscroll' }, h('table', { class: 'gtable' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Page'), h('th', { class: 'num' }, 'Views'), h('th', { class: 'num' }, 'People'))),
        h('tbody', {}, (d.pages || []).map((p) => h('tr', {}, h('td', {}, h('a', { href: p.path, class: 'mono' }, p.path)), h('td', { class: 'num' }, fmt(p.views)), h('td', { class: 'num' }, fmt(p.people))))))),
      h('p', { class: 'small muted' }, '"People" counts each person once per day. Over several days the same person is counted again on every day they come back, and a phone and a laptop count as two.')));
}
load();
