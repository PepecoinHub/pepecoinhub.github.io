// Reproducible audit of PR #266's preview, not a replacement for game prediction.
import * as beta from '../docs/games/js/pondwars-beta-engine.mjs';
import * as classic from '../docs/games/js/pondwars-engine.mjs';
import { pathToFileURL } from 'node:url';
export function preview(g, f, type, angle, power, e = beta) {
  const w = e.WEAPONS[type], origin = e.projectileOrigin(f, angle);
  const speed = (type === 'revolver' ? 1 : Math.max(.08, Math.min(1, power))) * w.power;
  let {x,y} = origin, vx = Math.cos(angle)*speed, vy = Math.sin(angle)*speed;
  const points = [{x,y}]; let reason = 'horizon';
  for (let i=0;i<220;i++) {
    vy += e.G*(w.gravity??1)*e.STEP;
    if(w.wind)vx+=g.wind*e.WIND_ACC*e.STEP;
    x+=vx*e.STEP;y+=vy*e.STEP;
    if(x< -20||x>e.W+20||y>e.WATER+30||y< -80){reason='bounds';break;}
    if(e.solid(g.mask,x,y)){reason='terrain';break;}
    points.push({x,y});
  }
  return {points,reason};
}
export function compare(g, f, type, angle, power, e = beta) {
  const predicted=preview(g,f,type,angle,power,e);
  const s=e.makeProjectile(f,type,angle,power);
  // Drill is allowed to carve only this private copy. No effects/explosions or RNG are run.
  const mask=g.mask.slice(), sandbox={...g,mask,dirty:[]};
  const actual=[{x:s.x,y:s.y}];let end='';
  for(let i=0;i<721;i++) {end=e.stepShot(sandbox,s,mask,g.frogs);actual.push({x:s.x,y:s.y});if(end)break;}
  let sharedError=0;
  for(let i=0;i<Math.min(predicted.points.length,actual.length);i++)sharedError=Math.max(sharedError,Math.hypot(predicted.points[i].x-actual[i].x,predicted.points[i].y-actual[i].y));
  const p=predicted.points.at(-1),a=actual.at(-1);
  return {previewStop:predicted.reason,actualStop:end,previewSteps:predicted.points.length-1,actualSteps:actual.length-1,sharedError,endpointError:Math.hypot(p.x-a.x,p.y-a.y)};
}
export function audit(e = beta) {
  const rows=[];
  for(const type of ['rocket','grenade','cluster','gold','revolver','bow','drill'])for(const terrain of ['air','floor','thin-wall','slope','island','twin','peaks','small']) {
    const result=[];
    for(const power of [.08,.25,.55,1])for(const wind of [-1,-.35,0,.35,1])for(const angle of [-2.7,-Math.PI/4,-.15])for(const distance of [40,200,600]) {
      const mask = ['island','twin','peaks','small'].includes(terrain) ? e.makeTerrain(123,terrain) : new Uint8Array(e.W*e.H);
      if(terrain==='floor')mask.fill(1,450*e.W);
      if(terrain==='thin-wall')for(let y=0;y<e.H;y++)mask[y*e.W+510]=1;
      if(terrain==='slope')for(let x=0;x<e.W;x++)for(let y=Math.max(0,Math.round(520-x*.2));y<e.H;y++)mask[y*e.W+x]=1;
      const f={id:0,x:480,y:260,alive:true};
      const g={mask,wind,frogs:[f,{id:1,x:480+Math.cos(angle)*distance,y:260+Math.sin(angle)*distance,alive:true}]};
      result.push(compare(g,f,type,angle,power,e));
    }
    rows.push({weapon:type,terrain,cases:result.length,diverged:result.filter(r=>r.sharedError>1e-6).length,maxSharedError:+Math.max(...result.map(r=>r.sharedError)).toFixed(2),maxEndpointError:+Math.max(...result.map(r=>r.endpointError)).toFixed(2),earlyEnd:result.filter(r=>r.actualSteps<r.previewSteps).length,previewShorter:result.filter(r=>r.actualSteps>r.previewSteps).length});
  }
  return rows;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const selected=process.argv.includes('--classic')?classic:beta;
  console.log(JSON.stringify(audit(selected),null,2));
}
