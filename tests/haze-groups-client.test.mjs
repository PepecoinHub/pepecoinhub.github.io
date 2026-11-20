import test from 'node:test';
import assert from 'node:assert/strict';
import {createHazeGroups} from '../docs/games/js/haze-groups.mjs';
const owner='00000000-0000-4000-8000-000000000001',id='00000000-0000-4000-8000-000000000002',hash='ab'.repeat(32),origin='https://hazewallet.com';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
class Element{constructor(tag,attrs={},...children){this.tag=tag;this.attrs=attrs;this.children=[];this.isConnected=false;this.value='';Object.assign(this,attrs);this.append(...children);}append(...children){for(const child of children.flat()){if(child&&typeof child==='object'){child.isConnected=this.isConnected;child.parentElement=this;}this.children.push(child);}}replaceChildren(...children){this.children=[];this.append(...children);}remove(){this.isConnected=false;}focus(){this.focused=true;}closest(){return null;}before(node){node.parentElement=this.parentElement;node.isConnected=this.isConnected;this.parentElement.children.splice(this.parentElement.children.indexOf(this),0,node);}after(node){node.parentElement=this.parentElement;node.isConnected=this.isConnected;this.parentElement.children.splice(this.parentElement.children.indexOf(this)+1,0,node);}querySelector(selector){return this.heading||all(this).find(n=>n.tag===selector)||null;}}
const all=node=>node&&typeof node==='object'?[node,...(node.children||[]).flatMap(all)]:[],button=(node,text)=>all(node).find(n=>n.tag==='button'&&n.children.includes(text));
function fixture({state='ready',submitted=null,invokeState='pending',participant=false,mode='all',guest=false}={}){
 const storage=new Map(),win=new EventTarget(),doc=new EventTarget(),log=new Element('div'),composer=new Element('input'),parent=new Element('div'),calls=[];let joined=false,view;
 const host=new Element('main');host.isConnected=true;host.append(log);parent.isConnected=true;win.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};doc.hidden=false;doc.getElementById=()=>null;
 const drop=()=>({id,owner,creator:'Host',mode,audience:'all',title:mode==='word'?'Say “gm”':'A question for frens',note:'',total_atomic:'200000000',state,created_at:new Date().toISOString(),closes_at:new Date(Date.now()+60000).toISOString(),expires_at:new Date(Date.now()+1800000).toISOString(),entries:0,count:2,max_winners:2,joined,eligible:true,recipients:[],submitted_txid:submitted});
 const frame={contentWindow:{postMessage(){}}};
 const rpc=async(name,args)=>{calls.push(name);if(name==='gry_haze_groups'||name==='gry_haze_groups_public')return {members:[],member_count:2,drops:[drop()]};if(name==='gry_haze_group_review')return {...drop(),sender:'P'.repeat(34),recipients:[{nick:'Fren',address:'Q'.repeat(34),amount:'200000000'}]};if(name==='gry_haze_group_join'){joined=true;return {joined:true};}throw Error(name);};
 const ctx={node:(...args)=>new Element(...args),doc,win,rpc,invoke:async body=>{calls.push(body);return {state:invokeState};},modal(){const controller=new AbortController(),body=new Element('div'),d=new Element('dialog');d.heading={textContent:''};view={body,d,status:{},signal:controller.signal,active:()=>!controller.signal.aborted,close:()=>controller.abort()};return view;},ensureWallet:async()=>frame,login(){calls.push('login');},currentUser:()=>guest?null:participant?'00000000-0000-4000-8000-000000000003':owner,formatAtomic:x=>String(Number(x)/1e8),amountAtomic:x=>String(Number(x)*1e8),origin,wallet:()=>({address:'P'.repeat(34)}),capabilities:()=>({chatGroupTips:1}),hideWallet(){},chatLog:()=>log,chatInput:()=>composer};
 const groups=createHazeGroups(ctx,{enabled:true});groups.mount(parent);
 return {groups,calls,log,host,composer,storage,get view(){return view;},message(){const e=new Event('message');Object.defineProperties(e,{origin:{value:origin},source:{value:frame.contentWindow},data:{value:{type:'haze:tip-submitted',version:1,intent:id,txid:hash}}});win.dispatchEvent(e);}};
}
test('confirmed feed and cached submissions never restart group checks',async()=>{
 const f=fixture({state:'confirmed',submitted:hash,invokeState:'confirmed'});f.storage.set('ph-haze-group-submitted-v1',JSON.stringify([{id,txid:hash,user:owner}]));
 try{await tick();await f.groups.sync(true);await tick();assert.equal(f.calls.filter(x=>typeof x==='object').length,0);assert.ok(f.calls.length<=3);assert.equal(f.storage.get('ph-haze-group-submitted-v1'),'[]');}finally{f.groups.destroy();}
});
test('a successful check is not recovered again from a stale ready feed',async()=>{
 const f=fixture({submitted:hash,invokeState:'confirmed'});try{for(let n=0;n<6;n++)await tick();assert.equal(f.calls.filter(x=>typeof x==='object').length,1);assert.ok(f.calls.filter(x=>x==='gry_haze_groups').length<=3);}finally{f.groups.destroy();}
});
test('closing the review keeps the late broadcast callback and automatic recovery',async()=>{
 const f=fixture();try{await tick();button(f.host,'Review payout').onclick();await tick();await button(f.view.body,'Review group in Haze').onclick();f.view.close();f.message();for(let n=0;n<4;n++)await tick();assert.deepEqual(f.calls.find(x=>typeof x==='object'),{action:'group-check',intent:id,txid:hash});assert.ok(f.storage.get('ph-haze-group-submitted-v1').includes(hash));}finally{f.groups.destroy();}
});
test('LAN-like hosts without Games IDs get round cards and join/answer controls',async()=>{
 for(const mode of ['airdrop','trivia','word']){const f=fixture({state:'open',mode,participant:true});try{await tick();assert.equal(f.log.children.length,0);assert.ok(f.host.children.length>1);const control=button(f.host,mode==='airdrop'?'Join airdrop':mode==='trivia'?'Answer in chat':'Say the word in chat');assert.ok(control);await control.onclick();if(mode==='airdrop')assert.ok(f.calls.includes('gry_haze_group_join'));else assert.equal(f.composer.value,mode==='trivia'?'/answer ':'gm');}finally{f.groups.destroy();}}
});
test('guests watch drops through the public feed and are asked to log on to join',async()=>{
 const f=fixture({state:'open',mode:'airdrop',guest:true});try{await tick();await tick();assert.ok(f.calls.includes('gry_haze_groups_public'));assert.equal(f.calls.includes('gry_haze_groups'),false);
 assert.equal(button(f.host,'Join airdrop'),undefined);const join=button(f.host,'Log on with Discord to join');assert.ok(join);join.onclick();assert.ok(f.calls.includes('login'));}finally{f.groups.destroy();}
});
