// LAN Party / Haze group tips traffic changes (2026-11-22): fallback polling, minimized windows, mention reads,
// DOM limit, shared online counter and group-check failure handling.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkFailure } from '../docs/games/js/haze-groups.mjs';

const meme = readFileSync(new URL('../docs/meme/meme.js', import.meta.url), 'utf8');
const groups = readFileSync(new URL('../docs/games/js/haze-groups.mjs', import.meta.url), 'utf8');
const lanPollDelay = new Function(meme.match(/function lanPollDelay\([\s\S]*?\n  \}/)[0] + '; return lanPollDelay;')();

test('LAN fallback polling: Realtime = safety net, quiet windows slow down, minimized stays 30 s', () => {
  assert.equal(lanPollDelay(true, false, false, 0), 60000);
  assert.equal(lanPollDelay(true, true, false, 0), 120000);
  assert.equal(lanPollDelay(true, false, true, 0), 120000);
  assert.equal(lanPollDelay(false, true, false, 0), 60000);
  assert.equal(lanPollDelay(false, false, true, 50), 30000, 'minimized keeps badges and @mention popups');
  assert.equal(lanPollDelay(false, false, false, 0), 4000);
  assert.equal(lanPollDelay(false, false, false, 10), 8000);
  assert.equal(lanPollDelay(false, false, false, 30), 15000);
});

test('one hour of quiet fallback polling in a visible window: about 296 calls instead of 900', () => {
  let t = 0, n = 0, quiet = 0;
  while (t < 3600e3) { n++; t += lanPollDelay(false, false, false, quiet); quiet++; }
  assert.ok(n < 320 && n > 250, String(n));
});

test('mention popups and badges in a minimized window are untouched', () => {
  assert.match(meme, /if \(alertMode !== 'mute'\) PM\.ring\(/);
  assert.match(meme, /\(isMinimized\(\) \|\| document\.hidden\) && !mine &&/);
  assert.match(meme, /var stopBell = lobbyBell\(function \(ev, p\) \{ if \(ev === 'tip' && hazeTips\) hazeTips\.invalidate\(\);/);
});

test('gry_mentions_seen only with a valid signed-in session and a waiting mention', () => {
  const fn = meme.match(/var seenMentions = function \(\) \{[\s\S]*?\n      \};/)[0];
  assert.match(fn, /!mentionsPending/);
  assert.match(fn, /anySession\(\); if \(!s \|\| !s\.user \|\| s\.user\.is_anonymous\) return;/);
  assert.match(fn, /catch\(function \(\) \{ mentionsPending = true; \}\)/);
});

test('the chat keeps at most 300 rows in the DOM', () => {
  assert.match(meme, /LAN_MAX_ROWS = 300/);
  assert.match(meme, /extra = rows\.length - LAN_MAX_ROWS/);
});

test('the online counter is asked by one tab for the whole browser', () => {
  assert.match(meme, /ONLINE_KEY = 'pondos-online-ping'/);
  assert.match(meme, /\}, 60000\);   \/\/ 2026-11-22: was 45 s/);
});

test('group checks: answers that can never confirm stop, "wait" only delays, others retry', () => {
  assert.equal(checkFailure(new Error('Wait at least 15 seconds before checking again.')), 'wait');
  assert.equal(checkFailure(new Error('Daily group check limit reached.')), 'daily');
  assert.equal(checkFailure(new Error('This group payment cannot be checked.')), 'final');
  assert.equal(checkFailure(new Error('Group payment not found or already bound to a transaction.')), 'final');
  assert.equal(checkFailure(new Error('The verified group payment does not match.')), 'final');
  assert.equal(checkFailure(new Error('The game server can\'t be reached right now.')), 'retry');
  assert.equal(checkFailure(new Error('Haze group tips are unavailable.')), 'retry');
});

test('group feed: minimized windows poll slower, tabs share answers, payments are never re-sent', () => {
  assert.match(groups, /soon\(\)\?\(m\?15000:5000\):\(m\?60000:20000\)/);
  assert.match(groups, /BroadcastChannel\('ph-haze-groups'\)/);
  assert.match(groups, /waiting\.has\(f\.id\)/);
  assert.doesNotMatch(groups.match(/async function check\(flight\)\{[\s\S]*?\n  \}/)[0], /broadcast|sendTransaction|submit\(/i);
});

test('the chat doorbell backs off to one reconnect a minute while Realtime is down', () => {
  const f = new Function('return ' + meme.match(/reconnectAfterMs: (function \(tries\) \{[^}]*\})/)[1])();
  assert.deepEqual([1, 2, 3, 4, 5, 6, 50].map(f), [1000, 2000, 5000, 10000, 30000, 60000, 60000]);
});
