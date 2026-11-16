import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { EXPRESSIONS, expressionFrames, expressionFor } from '../docs/meme/pepegochi-expressions.mjs';
import { checkFile, decodePng } from '../scripts/pepegochi_art_qa.mjs';
const adult={hasPet:true,adult:true,sprite:'taskbar/tb_adult_sit.png'};
test('actions select real expression sequences; authoritative warnings and young stages win',()=>{
 for(const [action,name] of Object.entries({pet:'nuzzle',familiar:'nuzzle',return:'welcome',hover:'curious',memories:'curious',space:'sulk',annoyed:'sulk'}))assert.equal(expressionFor(adult,action),name);
 for(const sprite of ['hungry','dirty','moody','neglected','packing','recovering'])for(const action of ['pet','return','hover','annoyed'])assert.equal(expressionFor({...adult,sprite:`taskbar/tb_adult_${sprite}.png`},action),null);
 for(const view of [null,{...adult,hasPet:false},{...adult,adult:false},{...adult,warning:true}])assert.equal(expressionFor(view,'pet'),null);
 const sleepy={...adult,sprite:'taskbar/tb_adult_sleepy.png'};
 assert.equal(expressionFor(sleepy,'hello'),'yawn');assert.equal(expressionFor(sleepy,'pet'),null);
});
test('20 new distinct frames meet native art rules and retain the original costume and feet',()=>{
 const dir=new URL('../docs/games/img/pepegochi/',import.meta.url);
 const base=decodePng(readFileSync(new URL('taskbar/tb_adult_sit.png',dir)));
 const hashes=new Set();
 for(const name of Object.keys(EXPRESSIONS)){
  const files=[...new Set(expressionFrames(name))];assert.equal(files.length,4);
  const duration=EXPRESSIONS[name].order.length*EXPRESSIONS[name].ms;assert.ok(duration>=800&&duration<=1500);
  for(const file of files){
   const url=new URL(file,dir);assert.deepEqual(checkFile(url.pathname).problems,[],file);
   const bytes=readFileSync(url),img=decodePng(bytes);hashes.add(createHash('sha256').update(bytes).digest('hex'));
   for(let y=26;y<48;y++)for(let x=0;x<48;x++)if(y>=37||(y>=29&&x>=18&&x<30)||(y>=26&&y<32&&x>=21&&x<29)){
    const i=(y*48+x)*4;assert.deepEqual(img.rgba.slice(i,i+4),base.rgba.slice(i,i+4),`${file}: locked costume ${x},${y}`);
   }
  }
 }
 assert.equal(hashes.size,20,'each new frame is genuine artwork, not a duplicate placeholder');
});
