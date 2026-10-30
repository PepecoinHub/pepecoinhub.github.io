import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = (name) => fs.readFileSync(new URL('../docs/' + name, import.meta.url), 'utf8');
function node(value = '') {
  return { value, textContent: '', attrs: {}, handlers: {},
    setAttribute(k, v) { this.attrs[k] = v; },
    addEventListener(k, fn) { this.handlers[k] = fn; },
    getAttribute() { return '1440'; } };
}

test('typed target prices above and below the slider range remain exact', () => {
  const els = Object.fromEntries(['x-range', 'x-target', 'x-target-hint', 'x-mult'].map(id => [id, node()]));
  const state = { pep: { price: 0.0001, mcap: 1e7, supply: 1e11 } };
  const ctx = { state, Math, Number, String, isFinite, parseFloat,
    $: id => els[id], document: { querySelectorAll: () => [] },
    t: { priceBad: 'invalid', priceHint: '{m}/{v}' }, times: String, usd: String,
    fill: (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k]), renderLadder() {} };
  const js = source('price.js');
  vm.runInNewContext(js.slice(js.indexOf('  function setMult('), js.indexOf('  // ---------- chart')), ctx);
  ctx.wireLadder();
  for (const price of ['10', '0.00001', '0,01']) {
    els['x-target'].handlers.input({ target: { value: price } });
    assert.equal(state.mult * state.pep.price, Number(price.replace(',', '.')));
    assert.ok(Number(els['x-range'].value) >= 0 && Number(els['x-range'].value) <= 400);
  }
  for (const price of ['1abc', '-1', 'Infinity', '1e309']) {
    els['x-target'].handlers.input({ target: { value: price } });
    assert.equal(els['x-target-hint'].textContent, 'invalid');
  }
});

test('invalid pool fees never silently become zero fees', () => {
  const els = Object.fromEntries(['mc-bpd','mc-hash','mc-hash-u','mc-net','mc-net-u','mc-fee','mc-day','mc-week','mc-month'].map(id => [id, node()]));
  Object.assign(els['mc-hash'], { value: '1' });
  els['mc-hash-u'].value = els['mc-net-u'].value = '1e9';
  els['mc-net'].value = '100'; els['mc-fee'].value = '2';
  const box = { querySelectorAll: () => [] };
  vm.runInNewContext(source('mining-calc.js'), {
    document: { querySelector: () => box, getElementById: id => els[id], documentElement: { lang: 'en' } },
    Intl, URL, location: { href: 'https://example.com/mining.html' },
    fetch: () => new Promise(() => {})
  });
  // Invoke the actual input handler through a second DOM with registered controls.
  const controls = [els['mc-fee']];
  box.querySelectorAll = selector => selector === 'input, select' ? controls : [];
  vm.runInNewContext(source('mining-calc.js'), {
    document: { querySelector: () => box, getElementById: id => els[id], documentElement: { lang: 'en' } },
    Intl, URL, location: { href: 'https://example.com/mining.html' }, fetch: () => new Promise(() => {})
  });
  for (const fee of ['100', '-2', '', 'NaN']) {
    els['mc-fee'].value = fee; els['mc-fee'].handlers.input();
    assert.equal(els['mc-day'].textContent, '—');
    assert.equal(els['mc-fee'].attrs['aria-invalid'], 'true');
  }
  els['mc-fee'].value = '2'; els['mc-fee'].handlers.input();
  assert.equal(els['mc-day'].textContent, '141,120 PEP');
});
