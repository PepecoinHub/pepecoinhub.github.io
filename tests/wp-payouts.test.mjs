import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// the host panel's payout lines for a Discord tip bot (docs/meme/meme.js)
const src = readFileSync(new URL('../docs/meme/meme.js', import.meta.url), 'utf8');
const start = src.indexOf("var WP_PAYOUT_TEMPLATE");
const end = src.indexOf("function wpRpc(", start);
const wpPayoutLines = new Function(src.slice(start, end) + '; return wpPayoutLines;')();

test('one line per address with the amount and address filled in', () => {
  assert.deepEqual(wpPayoutLines({ PAAA: 12.5, PBBB: '5.00' }, 'send {amount} PEPE to {address}'),
    ['send 12.5 PEPE to PAAA', 'send 5 PEPE to PBBB']);
});
test('a pattern without both placeholders falls back to the default', () => {
  assert.deepEqual(wpPayoutLines({ PX: 3 }, 'send to'), ['send 3 PEP to PX']);
  assert.deepEqual(wpPayoutLines({ PX: 0.1 }, ''), ['send 0.1 PEP to PX']);
});
test('the weekly robot uses the same default pattern', () => {
  const py = readFileSync(new URL('../scripts/wp_payouts.py', import.meta.url), 'utf8');
  assert.match(py, /DEFAULT_TEMPLATE = "send \{amount\} PEP to \{address\}"/);
  assert.match(src, /var WP_PAYOUT_TEMPLATE = 'send \{amount\} PEP to \{address\}'/);
});
