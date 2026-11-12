// Deterministic single-turn weapon assessment, not a claim of full-match win balance.
import {newGame,startTurn,cpuPlan,fire,step,walk,retreatDirection,canMove,me,W,H,WATER,STEP,MAPS} from '../docs/games/js/pondwars-beta-engine.mjs';
import {stateHash} from '../docs/games/js/pondwars-beta-net.mjs';
const rounds=Number(process.argv.find(a=>a.startsWith('--rounds='))?.split('=')[1]??300);
if(!Number.isInteger(rounds)||rounds<1)throw Error('invalid round count');
function run(weapon,map,index,qa=true){
 const allowed=MAPS[map].max-1,side=index%2,level=Math.floor(index/2)%3,n=2+Math.floor(index/6)%allowed;
 const g=newGame({seed:1000+index,perTeam:n,map,level,cpu:[true,true],arsenal:qa?'exp-v1':null});g.turn=side;startTurn(g);
 const actor=me(g),actorId=actor.id;
 if(weapon==='frog_mine'){
  const enemy=g.frogs.filter(f=>f.team!==side).sort((a,b)=>Math.abs(a.x-actor.x)-Math.abs(b.x-actor.x))[0];
  const dir=actor.x<W/2?1:-1,x=Math.max(25,Math.min(W-25,actor.x+dir*(58+(index%3)*8)));
  let y=0;while(y<H&&!g.mask[y*W+Math.round(x)])y++;
  if(y<WATER-10&&y>80){enemy.x=x;enemy.y=y-1;enemy.fallFrom=y-1;actor.face=dir;}
 }
 const before=g.frogs.map(f=>({hp:f.hp,alive:f.alive})),plan=cpuPlan(g,{weapon});g.weapon=weapon;
 const fired=fire(g,plan.angle,plan.power,plan.tx);let ticks=0,toes=0;
 while(fired&&g.turn===side&&g.winner===null&&ticks<1800){
  if(g.retreat>0&&canMove(g)){const dir=retreatDirection(g);if(dir)walk(g,dir);}
  step(g);ticks++;toes+=g.events.filter(e=>e.type==='boom'&&e.weapon==='toe').length;g.events=[];g.dirty=[];
 }
 let enemyDamage=0,friendlyDamage=0,selfDamage=0,kills=0,waterKills=0,maxSingle=0;
 for(const f of g.frogs){const damage=before[f.id].hp-f.hp;if(f.team!==side){enemyDamage+=damage;maxSingle=Math.max(maxSingle,damage);if(before[f.id].alive&&!f.alive){kills++;if(f.gone==='splash')waterKills++;}}else if(f.id===actorId)selfDamage+=damage;else friendlyDamage+=damage;}
 return {fired,enemyDamage,friendlyDamage,selfDamage,kills,waterKills,maxSingle,seconds:ticks*STEP,toeExplosions:toes,
   pendingTraps:g.mines.filter(m=>m.type==='frog_mine').length,timeLimit:ticks>=1800,hash:stateHash(g),side,level,n};
}
const only=process.argv.find(a=>a.startsWith('--weapon='))?.split('=')[1];
const rows=[];
for(const [weapon,qa] of [['gold',true],['bell_bomb',true],['frog_mine',true],['gold',false]])for(const map of Object.keys(MAPS)){
 if(only && weapon!==only)continue;
 const records=[];for(let i=0;i<rounds;i++)records.push(run(weapon,map,i,qa));
 const repeat=run(weapon,map,0,qa);if(repeat.hash!==records[0].hash)throw Error('nondeterministic '+weapon+'/'+map);
 const mean=key=>+(records.reduce((n,r)=>n+Number(r[key]),0)/rounds).toFixed(3);
 const row={weapon,mode:qa?'QA-B':'legacy',map,rounds,sides:[...new Set(records.map(r=>r.side))],levels:[...new Set(records.map(r=>r.level))],frogsPerTeam:[...new Set(records.map(r=>r.n))],
  meanEnemyDamage:mean('enemyDamage'),meanFriendlyDamage:mean('friendlyDamage'),meanSelfDamage:mean('selfDamage'),meanEnemyKills:mean('kills'),meanWaterKills:mean('waterKills'),
  maxEnemyDamage:Math.max(...records.map(r=>r.enemyDamage)),maxSingleEnemyDamage:Math.max(...records.map(r=>r.maxSingle)),meanTurnSeconds:mean('seconds'),meanUses:mean('fired'),meanToeExplosions:mean('toeExplosions'),pendingTrapRate:mean('pendingTraps'),timeLimits:records.filter(r=>r.timeLimit).length,deterministicProbe:repeat.hash};
 rows.push(row);process.stderr.write(JSON.stringify(row)+'\n');
}
console.log(JSON.stringify({method:'actual cpuPlan per-weapon filter + fixed-step turn + existing CPU retreat; forced trap proximity fixtures; not complete matches',roundsPerWeaponMap:rounds,totalRounds:rows.reduce((n,r)=>n+r.rounds,0),directGoldPlusFiveToesBound:118,legacyDirectBound:248,rows},null,2));
