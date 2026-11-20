import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAirdropCommand,timeLeft,AIRDROP_MINUTES} from '../docs/games/js/haze-groups.mjs';
import {parseTipCommand} from '../docs/games/js/haze-tips.mjs';

test('/airdrop takes an amount, an optional "pepe" and minutes or hours',()=>{
  assert.deepEqual(parseAirdropCommand('/airdrop 500 pepe 600m'),{amount:'500',minutes:600,title:''});
  assert.deepEqual(parseAirdropCommand('/AIRDROP 500pepe 2h gm frens'),{amount:'500',minutes:120,title:'gm frens'});
  assert.deepEqual(parseAirdropCommand('/airdrop 2,5 pep 30min'),{amount:'2.5',minutes:30,title:''});
  assert.deepEqual(parseAirdropCommand('/airdrop 100 pepe'),{amount:'100',minutes:15,title:''});
  assert.deepEqual(parseAirdropCommand('/airdrop 100 45'),{amount:'100',minutes:45,title:''});
  assert.equal(parseAirdropCommand('/tip lemon 5'),null);
  assert.equal(parseAirdropCommand('gm /airdrop 5'),null);
  for(const bad of ['/airdrop','/airdrop pepe','/airdrop 500 pepe 601m','/airdrop 500 pepe 11h','/airdrop 500 pepe 0m'])assert.throws(()=>parseAirdropCommand(bad));
  assert.deepEqual(AIRDROP_MINUTES,[15,30,60,180,360,600]);
});

test('/tip accepts "pepe" at the end of the amount',()=>{
  assert.deepEqual(parseTipCommand('/tip lemon 500 pepe'),{nick:'lemon',amount:'500',note:''});
  assert.deepEqual(parseTipCommand('/tip @Lemon 500pepe thanks fren'),{nick:'Lemon',amount:'500',note:'thanks fren'});
  assert.deepEqual(parseTipCommand('/tip Jurek 2,5 pep great guide'),{nick:'Jurek',amount:'2.5',note:'great guide'});
  assert.deepEqual(parseTipCommand('/tip Jurek 20'),{nick:'Jurek',amount:'20',note:''});
});

test('countdowns read well from seconds to ten hours',()=>{
  assert.equal(timeLeft(84000),'1m 24s left');
  assert.equal(timeLeft(9000),'9s left');
  assert.equal(timeLeft(-5),'0s left');
  assert.equal(timeLeft(600*60000),'10h 00m left');
  assert.equal(timeLeft(95*60000),'1h 35m left');
});
