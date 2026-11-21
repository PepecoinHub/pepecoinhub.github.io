import test from 'node:test';
import assert from 'node:assert/strict';
import { roomEffectPlan, mountRoomEffects } from '../docs/games/js/pepegochi-room-fx.mjs';
import { roomTargets } from '../docs/games/js/pepegochi-room-interactions.mjs';

const target={x:25,y:40,w:10,h:20};
test('each particle effect follows its real target, with bounded count, duration and positions',()=>{
  for (const [kind,art] of [['pet','heart'],['egg','spark'],['water','drop'],['duck','squeak'],['spark','spark'],['mug','steam']]) {
    const p=roomEffectPlan(kind,target);assert.equal(p.art,art);assert.ok(p.ms<=1000);assert.ok(p.points.length<=4);
    for(const point of p.points){assert.ok(point.x>=25&&point.x<=35&&point.y>=40&&point.y<=60);assert.ok(point.delay<p.ms);}
  }
  assert.equal(roomEffectPlan('toString',target),null);assert.equal(roomEffectPlan('pet',null),null);
  const opts={mode:'pet',placements:{floor_left:'potted_plant',rug_left:'rubber_duck'}};
  const plant=roomTargets(opts,true).find(t=>t.id==='potted_plant');assert.equal(roomEffectPlan('water',plant).points.length,4);
  assert.equal(roomEffectPlan('water',{...target,w:0}),null);
});

function fixture(){
  const listeners=new Map();let time=0,id=0;const jobs=new Map();
  class Node {
    constructor(doc){this.ownerDocument=doc;this.children=[];this.style={};this.isConnected=true;this.attributes={};const classes=new Set();this.classList={add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)};}
    append(n){this.children.push(n);n.parent=this;}
    remove(){this.parent.children=this.parent.children.filter(n=>n!==this);this.isConnected=false;}
    setAttribute(k,v){this.attributes[k]=v;}
  }
  const doc={visibilityState:'visible',createElement:()=>new Node(doc),addEventListener:(k,f)=>listeners.set(k,f),removeEventListener:k=>listeners.delete(k)};
  const stage=new Node(doc),sprite=new Node(doc);stage.append(sprite);
  const timers={setTimer:(f,ms)=>{jobs.set(++id,{at:time+ms,f});return id;},clearTimer:i=>jobs.delete(i)};
  const advance=ms=>{time+=ms;for(const [i,j] of jobs)if(j.at<=time){jobs.delete(i);j.f();}};
  const visibility=s=>{doc.visibilityState=s;listeners.get('visibilitychange')?.();};
  return {stage,sprite,timers,advance,visibility,listeners,jobs};
}

test('one bounded overlay, decorative and inaccessible, cleans up on timeout, replacing and hiding',()=>{
 const f=fixture(), c=mountRoomEffects(f.stage,f.timers);
 assert.equal(c.play('pet',target,f.sprite),true);
 assert.equal(f.sprite.classList.contains('pgr-petted'),true);
 assert.equal(f.stage.children.length,2);
 const layer=f.stage.children[1];assert.equal(layer.attributes['aria-hidden'],'true');assert.equal(layer.children.length,3);
 c.play('water',target,f.sprite);assert.equal(layer.isConnected,false);assert.equal(f.sprite.classList.contains('pgr-petted'),false);assert.equal(f.sprite.classList.contains('pgr-watered'),true);
 f.advance(1000);assert.equal(f.stage.children.length,1);assert.equal(f.sprite.classList.contains('pgr-watered'),false);assert.equal(f.jobs.size,0);
 c.play('duck',target,f.sprite);f.visibility('hidden');assert.equal(f.stage.children.length,1);assert.equal(f.sprite.classList.contains('pgr-duck-bounce'),false);
 assert.equal(c.play('pet',target,f.sprite),false);f.visibility('visible');c.play('egg',target,f.sprite);
 c.dispose();assert.equal(f.jobs.size,0);assert.equal(f.listeners.size,0);assert.equal(c.play('spark',target,f.sprite),false);
});

test('reduced motion skips effects and does not leave timers or classes',()=>{
 const f=fixture(), c=mountRoomEffects(f.stage,{...f.timers,reduced:()=>true});
 assert.equal(c.play('pet',target,f.sprite),false);assert.equal(f.stage.children.length,1);assert.equal(f.jobs.size,0);c.dispose();
});

test('lemon tree makes three temporary copies of the existing lemon after watering',()=>{
  const p=roomEffectPlan('lemon',target);
  assert.equal(p.points.length,4); assert.equal(p.fruits.length,3);
  assert.ok(p.fruits.every(f=>f.delay>=350&&f.delay<p.ms&&f.x>=25&&f.x<=35&&f.y>=40&&f.y<=60));
  const f=fixture(), c=mountRoomEffects(f.stage,f.timers);
  assert.equal(c.play('lemon',target,f.sprite),true);
  const layer=f.stage.children[1];
  assert.equal(layer.children.filter(n=>n.className==='pgr-fx pgr-fx-lemon').length,3);
  assert.equal(layer.children.filter(n=>n.className==='pgr-fx pgr-fx-drop').length,4);
  f.advance(2900); assert.equal(layer.isConnected,false); assert.equal(f.jobs.size,0);
  assert.equal(f.sprite.classList.contains('pgr-watered'),false); c.dispose();
});
