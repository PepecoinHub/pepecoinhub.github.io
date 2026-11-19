import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupVisible} from '../docs/games/js/haze-groups.mjs';
const end='2026-11-19T20:00:00Z', t=Date.parse(end);
test('terminal cards disappear exactly thirty minutes after server completion',()=>{
 for(const state of ['confirmed','empty','cancelled','ready']){
  assert.equal(groupVisible({state,ended_at:end},t+1799999),true);
  assert.equal(groupVisible({state,ended_at:end},t+1800000),false);
 }
});
test('active and pending payments remain visible without a terminal deadline',()=>{
 assert.equal(groupVisible({state:'open',ended_at:end},t+86400000),true);
 assert.equal(groupVisible({state:'ready',ended_at:null},t+86400000),true);
});
