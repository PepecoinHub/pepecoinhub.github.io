// Paired spawn-position scenarios, not natural CPU play or full-match win rates.
import {newGame,startTurn,fire,step,MAPS,WEAPONS,me,STEP} from '../docs/games/js/pondwars-beta-engine.mjs';
import {snapshot,stateHash} from '../docs/games/js/pondwars-beta-net.mjs';
const seeds=Number(process.argv.find(v=>v.startsWith('--seeds='))?.split('=')[1]??150);
const maps=Object.keys(MAPS),weapons=['goldv2','bell','frogmine','moon','ban','rain','doge','donkey','gold'];
function run(map,weapon,seed,side){
 const g=newGame({map,seed,packs:'all',perTeam:Math.min(3,MAPS[map].max),cpu:[false,false]});if(side)g.turn=1;startTurn(g);
 const actor=me(g),target=g.frogs.filter(f=>f.team!==side).sort((a,b)=>Math.abs(a.x-actor.x)-Math.abs(b.x-actor.x))[0];
 const before=g.frogs.map(f=>({hp:f.hp,team:f.team,alive:f.alive}));
 const dx=target.x-actor.x,dir=Math.sign(dx)||1;
 const angle=dir>0?-Math.PI/4:-3*Math.PI/4;
 const power=Math.max(.08,Math.min(1,Math.sqrt(Math.abs(dx)*520)/((WEAPONS[weapon].power||520))));
 g.weapon=weapon;actor.face=dir;fire(g,angle,power,target.x,target.y);
 let ticks=0,guide=0,frozen=0,booms=0,toes=0;
 while(ticks<1800&&g.turn===side&&g.winner===null){
  const s=g.shots.find(s=>s.type==='doge');
  if(s){guide++;const wantHeading=target.x>=s.x?0:Math.PI;let d=wantHeading-s.heading;d=Math.atan2(Math.sin(d),Math.cos(d));
   g.ctl={x:Math.abs(d)>.08?Math.sign(d):0,y:Math.abs(target.y-18-s.y)>8?Math.sign(target.y-18-s.y):0};}
  const timer=g.timer;step(g);if(s&&g.timer===timer)frozen++;
  for(const e of g.events)if(e.type==='boom'){booms++;if(e.weapon==='megatoe')toes++;}
  g.events=[];g.dirty=[];ticks++;
 }
 let enemy=0,self=0,friendly=0,kills=0,water=0;
 g.frogs.forEach((f,i)=>{const loss=before[i].hp-f.hp;if(f.team!==side){enemy+=loss;if(!f.alive)kills++;if(f.gone==='splash')water++;}else if(f.id===actor.id)self+=loss;else friendly+=loss;});
 return {enemy,self,friendly,kills,water,seconds:ticks*STEP,guideSeconds:guide*STEP,frozenSeconds:frozen*STEP,remainingMines:g.mines.length,toes,booms,timeout:ticks===1800?1:0,hash:stateHash(g),snapshot:snapshot(g)};
}
const rows=[];
for(const map of maps)for(const weapon of weapons)for(const side of [0,1]){
 const totals={enemy:0,self:0,friendly:0,kills:0,water:0,seconds:0,guideSeconds:0,frozenSeconds:0,remainingMines:0,toes:0,booms:0,timeout:0};let maxEnemy=0;
 for(let i=0;i<seeds;i++){const r=run(map,weapon,1000+i,side);maxEnemy=Math.max(maxEnemy,r.enemy);for(const k in totals)totals[k]+=r[k];}
 const first=run(map,weapon,1000,side),repeat=run(map,weapon,1000,side);if(first.hash!==repeat.hash)throw Error('nondeterministic');
 rows.push({map,weapon,side,rounds:seeds,mean:Object.fromEntries(Object.entries(totals).map(([k,v])=>[k,+(v/seeds).toFixed(3)])),maxEnemy,hash:first.hash});
 process.stderr.write(`${map} ${weapon} side ${side}: ${seeds} OK\n`);
}
process.stdout.write(JSON.stringify({method:'paired seeds and actual initial spawns; scripted fixed 45-degree range-based throw, nearest enemy target, proportional Doge steering; no walking, no CPU, one turn, no physical devices',seeds,rounds:rows.length*seeds,rows},null,2)+'\n');
