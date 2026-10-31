import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const script = fs.readFileSync(new URL('../docs/prices.js', import.meta.url), 'utf8');
function setup(snapshot, saved) {
  const calls = [], timers = [], window = {};
  let now = Date.now();
  class Clock extends Date { static now() { return now; } }
  vm.runInNewContext(script, { window, URL, AbortSignal, Date: Clock, setInterval(fn) { timers.push(fn); },
    document: { currentScript: { src: 'https://example.com/prices.js' }, addEventListener() {}, hidden: false },
    fetch: async url => {
      calls.push(url);
      if (url.endsWith('price-live.json')) return { ok: false };
      if (url.endsWith('market-prices.json') && snapshot) return { ok: true, json: async () => snapshot };
      if (url.endsWith('price.json') && saved) return { ok: true, json: async () => saved };
      throw Error('offline');
    }
  });
  return { prices: window.PepPrices, calls, tick() { now += 61000; timers[0](); } };
}
function snapshot(time = new Date().toISOString()) {
  return { generated_at: time, pep_supply: { value: 110, time }, markets: [
    { id: 'pepecoin-network', current_price: .001, total_supply: 100, last_updated: time, top: false },
    { id: 'bitcoin', current_price: 90000, market_cap: 1800000000000, top: true }
  ] };
}
test('independent pages and concurrent widgets use the same quote, timestamp and on-chain supply', async () => {
  const f = snapshot(), a = setup(f), b = setup(f);
  const [home, ticker, meme] = await Promise.all([a.prices.quote(), a.prices.quote(), b.prices.quote()]);
  assert.equal(home.usd, ticker.usd); assert.equal(home.usd, meme.usd); assert.equal(home.time, meme.time);
  assert.equal(home.supply, 110); assert.equal(home.mcap, .11);
  assert.equal(a.calls.filter(x => x.endsWith('market-prices.json')).length, 1);
  assert.ok(a.calls.every(x => x.startsWith('https://example.com/')));
});
test('a stale complete snapshot keeps original prices and time instead of querying the provider per page', async () => {
  const {prices,calls} = setup(snapshot('2020-01-01T00:00:00Z'));
  const q = await prices.quote();
  assert.equal(q.usd,.001); assert.equal(q.saved,true); assert.equal(q.time,'2020-01-01T00:00:00.000Z');
  assert.ok(calls.every(x => x.startsWith('https://example.com/')));
});
test('missing market file uses the dated saved PEP quote', async () => {
  const {prices} = setup(null,{price_usd:.002,updated_at:'2026-10-29T04:15:00Z',supply:110});
  const q = await prices.quote();
  assert.equal(q.usd,.002); assert.equal(q.saved,true); assert.equal(q.time,'2026-10-29T04:15:00.000Z');
});
test('duplicate top-list entries cannot overwrite the canonical PEP quote', async () => {
  const f=snapshot();f.markets.push({id:'pepecoin-network',current_price:.009,total_supply:999,top:true});
  const {prices}=setup(f);assert.equal((await prices.quote()).usd,.001);
});
test('subscribers receive the next shared snapshot after refresh', async () => {
  const f=snapshot(), env=setup(f), seen=[];
  env.prices.subscribe(result=>seen.push(result.d.find(x=>x.id==='pepecoin-network').current_price));
  await new Promise(resolve=>setImmediate(resolve));
  f.generated_at=new Date(Date.now()+3600000).toISOString(); f.markets[0].current_price=.002;
  env.tick(); await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(seen,[.001,.002]);
});

test('every current-quote consumer loads the shared helper before its script', () => {
  const docs=fileURLToPath(new URL('../docs/',import.meta.url));
  for (const name of fs.readdirSync(docs,{recursive:true}).filter(x=>x.endsWith('.html'))) {
    const html=fs.readFileSync(path.join(docs,name),'utf8');
    const scripts=[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)].map(x=>path.posix.basename(x[1]).split('?')[0]);
    for (const consumer of ['home.js','press.js','price.js','market.js','chrome.js','meme.js']) {
      if (!scripts.includes(consumer)) continue;
      assert.ok(scripts.indexOf('prices.js')>=0 && scripts.indexOf('prices.js')<scripts.indexOf(consumer),name+': '+consumer);
    }
  }
});
