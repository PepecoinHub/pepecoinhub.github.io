import test from 'node:test';
import assert from 'node:assert/strict';
import { roomTargets, roomResponse, createRoomInteractions } from '../docs/games/js/pepegochi-room-interactions.mjs';
import { STARTER_ROOM, fixedPlacements, ITEMS, PROP_BOUNDS, SPRITE_BOUNDS, roomScene, ROOM_W, ROOM_H, FROG_PX } from '../docs/games/js/pepegochi-room.mjs';

const view = (pet = {}) => ({ mode: 'pet', pet: { stage: 'adult', status: 'healthy', needs: [], actions: [
  { kind:'rest', enabled:true }, { kind:'play', enabled:true }], ...pet } });

test('only owned, visible room props get hit targets; no interactions for guest/departed', () => {
  for (const mode of ['adopt','departed','signin','loading']) assert.deepEqual(roomTargets({mode}, true), []);
  assert.deepEqual(roomTargets({mode:'pet'}, false).map(t => t.id), ['bed','frog']);
  const targets=roomTargets({mode:'pet',placements:fixedPlacements(['moon_rock','crt_tv'])}, true);
  assert.deepEqual(targets.map(t=>t.id), ['moon_rock','crt_tv','bed','frog']);
  for(const t of roomTargets({mode:'pet',placements:STARTER_ROOM},true)) {
    assert.ok(t.x>=0 && t.y>=0 && t.x+t.w<=100 && t.y+t.h<=100, t.id);
  }
});

test('HD clickable rectangles follow the visible art in logical room coordinates for every age and prop',()=>{
  for(const stage of ['egg','tadpole','froglet','adult']){
    const opts={mode:'pet',stage,placements:fixedPlacements(Object.keys(ITEMS))};
    const sc=roomScene(opts), targets=roomTargets(opts,true);
    for(const item of sc.items){
      const t=targets.find(t=>t.id===item.itemId), [l,y,r,b]=PROP_BOUNDS[item.itemId], h=item.width*ROOM_W/ROOM_H;
      assert.ok(t.x>=0&&t.y>=0&&t.x+t.w<=100&&t.y+t.h<=100,item.itemId);
      assert.equal(t.x,item.left-item.width/2+item.width*l/128);
      assert.equal(t.y,item.top-(item.wall?h/2:h)+h*y/128);
      assert.equal(t.w,item.width*(r-l)/128);
      assert.equal(t.h,h*(b-y)/128);
    }
    const frog=targets.find(t=>t.id==='frog'), [l,y,r,b]=SPRITE_BOUNDS[sc.frog.sprite];
    assert.equal(frog.x,sc.frog.left+(l-FROG_PX/2)/ROOM_W*100);
    assert.equal(frog.w,(r-l)/ROOM_W*100);
    assert.equal(frog.h,(b-y)/ROOM_H*100);
  }
});

test('pet reaction respects current needs, life stage and recovery', () => {
  assert.match(roomResponse('frog',view({stage:'egg'})).text,/Tap tap/);
  assert.match(roomResponse('frog',view({stage:'tadpole'})).text,/Blub/);
  assert.match(roomResponse('frog',view({status:'packing'})).text,/real care/);
  assert.match(roomResponse('frog',view({status:'neglected'})).text,/care/);
  assert.match(roomResponse('frog',view({status:'recovering'})).text,/staying/);
  assert.equal(roomResponse('frog',view({needs:[{label:'Hunger',value:10}]})).effect,undefined);
  assert.equal(roomResponse('frog',view()).effect,'pet');
  assert.notEqual(roomResponse('frog',view(),{patIndex:1}).text,roomResponse('frog',view()).text);
  assert.match(roomResponse('frog',view(),{patBurst:3}).text,/personal pond space/);
  assert.equal(roomResponse('frog',view(),{patBurst:3}).effect,undefined);
  assert.match(roomResponse('frog',view({status:'packing'}),{patBurst:3}).text,/real care/);
  assert.equal(roomResponse('frog',view({stage:'egg'})).effect,'egg');
  assert.equal(roomResponse('frog',{mode:'departed'}),null);
  assert.equal(roomResponse('frog',view(),{busy:true}),null);
});

test('bed and duck use only the existing allowed care actions; disabled actions never call care', () => {
  assert.equal(roomResponse('bed',view()).care,'rest');
  assert.equal(roomResponse('rubber_duck',view()).care,'play');
  const blocked=view({actions:[{kind:'rest',enabled:false,reason:'daily limit reached'},{kind:'play',enabled:false,reason:'ready in 2h'}]});
  assert.equal(roomResponse('bed',blocked).care,undefined);
  assert.match(roomResponse('bed',blocked).text,/daily limit reached/);
  assert.equal(roomResponse('rubber_duck',blocked).care,undefined);
  assert.equal(roomResponse('rubber_duck',blocked).effect,'duck','cosmetic squeak does not imply an accepted care action');
  assert.equal(roomResponse('bed',view({actions:[]})).care,undefined);
});

test('props are cosmetic except an explicit TV request and the two care shortcuts', () => {
  for (const id of ['mug','p_poster','potted_plant','moon_rock','golden_fly','floppy_disk','paper_crown','lava_lamp']) {
    const r=roomResponse(id,view()); assert.ok(r.text); assert.equal(r.care,undefined); assert.equal(r.tv,undefined);
  }
  assert.equal(roomResponse('lava_lamp',view(),{lampOn:true}).lamp,false);
  assert.equal(roomResponse('lava_lamp',view(),{lampOn:false}).lamp,true);
  assert.equal(roomResponse('crt_tv',view(),{embedded:true}).tv,true);
  assert.equal(roomResponse('crt_tv',view(),{embedded:false}).tv,undefined);
  assert.equal(roomResponse('not_owned_item',view()),null);
});

test('room objects rotate ten distinct contextual replies without changing their actions',()=>{
  for(const id of ['mug','p_poster','potted_plant','moon_rock','golden_fly','floppy_disk','paper_crown','rubber_duck','crt_tv','bed','lava_lamp']) {
    const results=Array.from({length:10},(_,propIndex)=>roomResponse(id,view(),{embedded:true,propIndex,lampOn:propIndex%2===0}));
    assert.equal(new Set(results.map(r=>r.text)).size,10,id);
    assert.ok(results.every(r=>r.care===(id==='bed'?'rest':id==='rubber_duck'?'play':undefined)),id);
  }
});

test('attached controls use fresh view, respect busy/throttle and reset lamp for a different life', () => {
  class Node {
    constructor(doc) { this.ownerDocument=doc; this.children=[];this.style={};this.dataset={};this.attrs={};this.isConnected=true;
      const classes=new Set();this.classList={add:k=>classes.add(k),remove:(...ks)=>ks.forEach(k=>classes.delete(k)),toggle:(k,v)=>v?classes.add(k):classes.delete(k),contains:k=>classes.has(k)};
    }
    append(n){this.children.push(n);n.parent=this;}
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.isConnected=false;}
    setAttribute(k,v){this.attrs[k]=v;}
    addEventListener(k,f){this[k]=f;}
    querySelector(s){return this.children.find(n=>s.startsWith('[data-item')?s===`[data-item="${n.dataset.item}"]`:s==='.'+n.className)||this.children.map(n=>n.querySelector(s)).find(Boolean)||null;}
  }
  const doc={createElement:()=>new Node(doc)};
  const make=()=>{const f=new Node(doc),s=new Node(doc);s.className='pgr';f.append(s);for(const id of ['lava_lamp','crt_tv','rubber_duck']){const n=new Node(doc);n.dataset.item=id;s.append(n);}return f;};
  let current=view(), now=0,busy=false;const actions=[];let tv=0;
  const controller=createRoomInteractions({getView:()=>current,isBusy:()=>busy,care:k=>actions.push(k),openTV:()=>tv++,reduced:()=>true,now:()=>now});
  const opts={mode:'pet'};let frame=make();
  const activate=id=>{now+=400;frame.querySelector('.pgr').children.find(n=>n.dataset.roomAction===id).click();};
  controller.attach(frame,opts,{owned:true,lifeId:'first',embedded:true});
  activate('lava_lamp');assert.equal(frame.querySelector('.pgr').classList.contains('pgr-room-lights-off'),true);
  activate('crt_tv');assert.equal(tv,1);
  activate('bed');assert.deepEqual(actions,['rest']);
  current=view({actions:[{kind:'play',enabled:true}]});activate('bed');assert.deepEqual(actions,['rest']);
  activate('rubber_duck');assert.deepEqual(actions,['rest','play']);
  busy=true;activate('rubber_duck');assert.deepEqual(actions,['rest','play']);busy=false;
  const old=frame;frame=make();controller.attach(frame,opts,{owned:true,lifeId:'first',embedded:true});
  assert.equal(frame.querySelector('.pgr').classList.contains('pgr-room-lights-off'),true);
  assert.equal(old.querySelector('.pgr').children.some(n=>n.dataset.roomAction),false);
  frame=make();controller.attach(frame,opts,{owned:true,lifeId:'next',embedded:true});
  assert.equal(frame.querySelector('.pgr').classList.contains('pgr-room-lights-off'),false);
  controller.dispose();assert.equal(frame.querySelector('.pgr').children.some(n=>n.dataset.roomAction),false);
});
