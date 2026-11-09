import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// the host panel's payout lines for a Discord tip bot (docs/meme/meme.js)
const src = readFileSync(new URL('../docs/meme/meme.js', import.meta.url), 'utf8');
const start = src.indexOf("var WP_PAYOUT_TEMPLATE");
const end = src.indexOf("function wpRpc(", start);
const localStorage = { getItem: () => null };
const wpPayoutLines = new Function('localStorage', src.slice(start, end) + '; return wpPayoutLines;')(localStorage);

test('one line per address with the amount and address filled in', () => {
  assert.deepEqual(wpPayoutLines({ PAAA: 12.5, PBBB: '5.00' }, 'send {amount} PEPE to {address}'),
    ['send 12.5 PEPE to PAAA', 'send 5 PEPE to PBBB']);
});
test('a pattern without both placeholders falls back to the Filippy default', () => {
  assert.deepEqual(wpPayoutLines({ PX: 3 }, 'send to'), ['send 3 PEPE to PX']);
  assert.deepEqual(wpPayoutLines({ PX: 0.1 }, ''), ['send 0.1 PEPE to PX']);
});
test('rewards paid through the tip bot may be marked without a txid', () => {
  const sql = readFileSync(new URL('../games/supabase/update_wheres_pepe_paid_by_bot.sql', import.meta.url), 'utf8');
  assert.match(sql, /nullif\(lower\(btrim\(coalesce\(p_txid, ''\)\)\), ''\)/);
  assert.match(sql, /is_host_user\(auth\.uid\(\)\)/);
  assert.match(src, /gry_wp_host_paid', \{ p_ids: ids, p_txid: '' \}/);
});
