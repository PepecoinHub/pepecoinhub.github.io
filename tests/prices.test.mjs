import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const script = fs.readFileSync(new URL('../docs/prices.js', import.meta.url), 'utf8');
function setup(file, saved) {
  const calls = [], window = {};
  vm.runInNewContext(script, { window, URL, AbortSignal, Date,
    document: { currentScript: { src: 'https://example.com/prices.js' } },
    localStorage: { getItem() { throw Error('blocked'); } },
    fetch: async url => {
      calls.push(url);
      if (url.endsWith('price-live.json')) return { ok: true, json: async () => file };
      if (url.endsWith('price.json')) return { ok: true, json: async () => saved };
      throw Error('offline');
    }
  });
  return { prices: window.PepPrices, calls };
}
test('home and ticker share the published quote without API requests', async () => {
  const { prices, calls } = setup({ generated_at: new Date().toISOString(), markets: [
    { id: 'pepecoin-network', current_price: 0.001, total_supply: 100 }
  ] });
  const [a, b] = await Promise.all([prices.quote(), prices.quote()]);
  assert.equal(a.usd, b.usd); assert.equal(a.time, b.time);
  assert.equal(calls.length, 1);
});
test('offline visitors get saved data with its original date', async () => {
  const { prices } = setup({ generated_at: '2020-01-01', markets: [] },
    { price_usd: 0.002, date: '2026-10-29', supply: 100 });
  const q = await prices.quote();
  assert.equal(q.usd, 0.002); assert.equal(q.saved, true); assert.equal(q.time, '2026-10-29');
});
