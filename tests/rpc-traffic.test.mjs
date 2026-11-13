// PondOS desktop online counter and Pepe Miner cloud saves.
// The LAN Party window and the /games/ lobby keep their own polling; these tests pin that.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const meme = read('docs/meme/meme.js');
const miner = read('docs/games/js/miner.js');
const lobbyChat = read('docs/games/js/lobbychat.js');
const lobby = read('docs/games/js/lobby.js');

function sliceFn(src, name) {
  const at = src.indexOf('function ' + name + '(');
  assert.ok(at >= 0, name);
  return src.slice(at, src.indexOf('\n  function ', at + 1));
}

test('desktop online count asks every 90s only while the LAN window is closed', () => {
  const ping = meme.slice(meme.indexOf('var pingOnline'), meme.indexOf('var trayEl2'));
  assert.match(ping, /chatRpc\('gry_lobby_chat', \{ p_after: 2147483647, p_visitor: visitorId\(\) \}\)/);
  assert.match(ping, /setTimeout\(pingOnline, 1500\)/);
  assert.match(ping, /setInterval\(function \(\) \{ if \(!document\.hidden && !apps\.lan\) pingOnline\(\); \}, 90000\)/);
  assert.equal(ping.includes('45000'), false);
});

test('the LAN Party window still polls on its own intervals, including while minimized', () => {
  const lan = sliceFn(meme, 'lanParty');
  assert.match(lan, /timer = setTimeout\(poll, live \? 60000 : document\.hidden \? 25000 : 4000\)/);
  assert.match(lan, /whoT = setTimeout\(loadWho, 30000\)/);
  assert.match(lan, /A\.stop = function \(\) \{ alive = false; clearTimeout\(timer\); clearTimeout\(ringT\); clearTimeout\(whoT\); stopBell\(\); \}/);
  // minimized or not, the window's own poll is not gated on is-min
  const pollLine = lan.split('\n').find((l) => l.includes('setTimeout(poll,'));
  assert.ok(pollLine && !pollLine.includes('is-min'));
});

test('PEP Games lobby chat and lobby are unchanged at the polling calls', () => {
  assert.match(lobbyChat, /timer = setTimeout\(poll, live \? 60000 : watching\(\) \? 4000 : 25000\)/);
  assert.match(lobbyChat, /document\.addEventListener\('visibilitychange', \(\) => \{ if \(!document\.hidden\) \{ poll\(\); markSeen\(\); \} \}\)/);
  assert.match(lobby, /setInterval\(loadTopboard, 60000\)/);
  assert.equal(lobby.includes('gry_miner_save'), false);
});

test('miner cloud save is every 5 minutes, plus hide, pagehide, and a PondOS close handoff', () => {
  assert.match(miner, /setInterval\(push, 300000\)/);
  assert.equal(miner.includes('setInterval(push, 60000)'), false);
  assert.match(miner, /setInterval\(save, 5000\)/);
  assert.match(miner, /document\.addEventListener\('visibilitychange', \(\) => \{ if \(document\.hidden\) save\(\); \}\)/);
  assert.match(miner, /window\.addEventListener\('pagehide', save\)/);
  assert.match(miner, /document\.addEventListener\('visibilitychange', \(\) => \{ if \(document\.hidden\) leave\(\); \}\)/);
  assert.match(miner, /window\.addEventListener\('pagehide', leave\)/);
  assert.match(miner, /const leave = \(\) => push\(true\)/);
  assert.match(miner, /window\.pepeMinerLeaveRequest = beginLeave/);
  assert.match(miner, /window\.pepeMinerFlush = \(\) => push\(true\)/);
  assert.match(miner, /keepalive: true/);
  // periodic saves still go through the client; only leave/close uses the keepalive POST
  assert.match(miner, /if \(leave\) \{ postLeave\(beginLeave\(\)\); return; \}/);
  assert.match(miner, /cloud\.rpc\('gry_miner_save', \{ p_data: S, p_all: all \}\)/);
  // load / merge is the same fork: a better online mine replaces this browser and reloads once
  assert.match(miner, /if \(!once\) \{ S = Object\.assign\(fresh\(\), theirs\); S\.st = Object\.assign\(fresh\(\)\.st, theirs\.st \|\| \{\}\); save\(\); location\.reload\(\); return; \}/);
  const app = sliceFn(meme, 'minerApp');
  assert.match(app, /w\.pepeMinerLeaveRequest\(\)/);
  assert.match(app, /fetch\(req\.url, \{ method: 'POST', keepalive: true, headers: req\.headers, body: req\.body \}\)/);
  assert.equal(app.includes('A.pause'), false);
  assert.equal(app.includes('is-min'), false);
});

test('the server still refuses a second miner write within 20 seconds', () => {
  const sql = read('games/supabase/update_miner_cloud.sql');
  assert.match(sql, /prev > now\(\) - interval '20 seconds'/);
  assert.match(sql, /on conflict \(user_id\) do update/);
});

test('changed scripts are cache-busted, and every PondOS page agrees', () => {
  assert.match(read('docs/games/miner.html'), /js\/miner\.js\?v=20261113save/);
  const versions = new Set(readdirSync(new URL('../docs/meme/', import.meta.url)).filter((f) => f.endsWith('.html'))
    .map((f) => (read('docs/meme/' + f).match(/meme\.js\?v=([a-z0-9]+)/) || [])[1]).filter(Boolean));
  assert.deepEqual([...versions], ['20261113rpc']);
});
