import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSiteEventObserver } from '../docs/meme/pepegochi-events.mjs';
import { createBond } from '../docs/meme/pepegochi-bond.mjs';
import { companionReply } from '../docs/meme/pepegochi-interactions.mjs';
import { expressionFor } from '../docs/meme/pepegochi-expressions.mjs';

const context = { owner: 'a', life: 'one', hasPet: true };
const event = (kind, ids, owner = 'a') => ({ kind, ids, owner });
test('new stamps and secrets react once per owner and life; batch notifications collapse', () => {
  const observer = createSiteEventObserver();
  assert.equal(observer.accept(event('stamp', ['one', 'two', 'two']), context), 'stampBatch');
  assert.equal(observer.accept(event('stamp', ['one', 'two']), context), null);
  assert.equal(observer.accept(event('stamp', ['two', 'three']), context), 'stamp');
  assert.equal(observer.accept(event('secret', ['one']), context), 'secret');
  assert.equal(observer.accept(event('secret', ['one']), context), null);
  assert.equal(observer.accept(event('stamp', ['one']), { ...context, life: 'two' }), 'stamp');
});
test('guests, wrong owners, absent pets and malformed events do nothing', () => {
  const observer = createSiteEventObserver();
  for (const c of [{}, { ...context, owner: null }, { ...context, life: null }, { ...context, hasPet: false }])
    assert.equal(observer.accept(event('stamp', ['one']), c), null);
  for (const e of [null, event('stamp', ['one'], 'b'), event('payout', ['one']), event('stamp', 'one'), event('stamp', [null, {}, 'bad id', 'x'.repeat(65)])])
    assert.equal(observer.accept(e, context), null);
  assert.equal(observer.accept(event('stamp', ['one']), context), 'stamp');
  observer.reset();
  assert.equal(observer.accept(event('stamp', ['one']), context), 'stamp');
});
test('achievement conversation survives incidental remarks and cannot cross accounts or lives', () => {
  const bond = createBond();
  const pet = { life_id: 'one', status: 'healthy', stage: 'adult', needs: {} };
  bond.observe('a', pet);
  bond.remember('stamp'); bond.remember('desktopTV');
  assert.equal(bond.take(), 'stamp'); assert.equal(bond.take(), 'desktopTV');
  bond.remember('secret'); bond.observe('b', pet);
  assert.equal(bond.take(), null);
  bond.remember('stampBatch'); bond.observe('b', { ...pet, life_id: 'two' });
  assert.equal(bond.take(), null);
});
test('healthy adult celebrates, secret is curious; warnings and young stages retain their poses', () => {
  const adult = { hasPet: true, adult: true, motion: 'adult', sprite: 'taskbar/tb_adult_sit.png' };
  for (const action of ['stamp', 'stampBatch', 'secret']) {
    assert.notEqual(companionReply(adult, action).text, companionReply(adult).text);
    assert.equal(expressionFor(adult, action), action === 'secret' ? 'curious' : 'welcome');
    assert.equal(companionReply({ ...adult, warning: true }, action).pose, null);
    assert.equal(expressionFor({ ...adult, warning: true }, action), null);
    assert.equal(companionReply({ ...adult, adult: false }, action).pose, null);
  }
});
test('site bridge is private and beta/identity gated, not tied to the public reward test button', () => {
  const shell = readFileSync(new URL('../docs/meme/meme.js', import.meta.url), 'utf8');
  assert.match(shell, /if \(!GOCHI \|\| FREN_TEST \|\| !gochiReceive/);
  assert.match(shell, /current\.userId !== owner/);
  assert.match(shell, /frenRpc\('gry_passport_checkin'/);
  assert.match(shell, /notifyGochi\('stamp', s\.userId, fresh\.map/);
  assert.match(shell, /result\.new === true\) notifyGochi\('secret'/);
  assert.match(shell, /r\['new'\] === true && !r\.beta\) notifyGochi/);
  assert.match(shell, /preview: true, avatar: L\.avatar, badge:/);
  assert.match(shell, /!r\.preview && r\.badge\.new === true && awardOwner/);
  assert.doesNotMatch(shell.slice(shell.indexOf('function rewardNotice(r)'), shell.indexOf('window.PONDOS_REWARD')), /notifyGochi/);
});
