import test from 'node:test';
import assert from 'node:assert/strict';
import { BetaGame } from '../docs/games/js/pepegochi-beta-view.mjs';
import { renderCarePanel } from '../docs/games/js/pepegochi-care-ui.mjs';

// Small DOM double: verify the renderer's semantic structure without a browser.
class Node {
  constructor(tag) { this.tag = tag; this.attrs = {}; this.children = []; this.textContent = ''; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  append(...nodes) { this.children.push(...nodes); }
  get text() { return this.textContent + this.children.map(n => n.text).join(' '); }
  find(tag) { return this.tag === tag ? this : this.children.map(n => n.find(tag)).find(Boolean); }
}
const doc = { createElement: tag => new Node(tag) };

test('compact care tiles pair each action with its real meter, even when needs are reordered', () => {
  const game = new BetaGame({ storage: null }); game.adopt('Fren');
  const pet = game.view().pet; pet.needs.reverse();
  const [panel, good] = renderCarePanel(doc, pet);
  assert.equal(panel.children.length, 4);
  for (const [i, tile] of panel.children.entries()) {
    const a = pet.actions[i], n = pet.needs.find(n => n.kind === a.kind);
    assert.equal(tile.attrs.class, 'pgb-care-tile');
    assert.equal(tile.find('meter').value, n.value);
    assert.equal(tile.find('meter').attrs['aria-label'], n.label);
    assert.equal(tile.find('button').attrs['data-act'], a.kind);
    assert.equal(tile.find('button').attrs.disabled, undefined);
  }
  assert.equal(good.find('progress').value, pet.goodDays.count);
  assert.match(good.text, /Streak: 0 · Best: 0/);
  assert.match(good.text, /Still missing for a good care day/);
});

test('busy, cooldown, and beta-only shortcut remain distinguishable', () => {
  const game = new BetaGame({ storage: null }); game.adopt('Fren'); game.act('clean');
  const pet = game.view().pet;
  const [panel] = renderCarePanel(doc, pet, { busy: true, testShortcut: true });
  assert.equal(panel.children.length, 5);
  assert.equal(panel.children[4].attrs['data-all'], '1');
  for (const tile of panel.children.slice(0, 4)) assert.equal(tile.find('button').attrs.disabled, '');
  assert.match(panel.text, /ready in/);
  assert.match(panel.text, /Please wait/);
  const [live] = renderCarePanel(doc, pet);
  assert.equal(live.children.length, 4);
  assert.equal(live.children[1].find('button').attrs.disabled, '');
  assert.equal(live.children[0].find('button').attrs.disabled, undefined);
});
