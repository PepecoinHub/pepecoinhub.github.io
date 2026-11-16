// Owner-reviewed rollout switch. No Haze network requests or UI when disabled.
import {createHazeGroups,HAZE_GROUPS_ENABLED} from './haze-groups.mjs';
export const HAZE_TIPS_ENABLED = false;
// Closed beta (2026-11-16): a browser that opened any page with ?beta=haze shows the Haze UI (?beta=off hides it).
// This is visibility only. Access is enforced on the server: games.haze_testers + beta_only in SQL and
// HAZE_ACCESS in the haze-wallet Edge Function. Everyone else gets "not enabled" even with the flag.
export function hazeBeta(win=globalThis.window) {
  try{
    const q=new URLSearchParams(win.location.search).get('beta');
    if(q==='haze')win.localStorage.setItem('pondos-beta-haze','1');
    if(q==='off')win.localStorage.removeItem('pondos-beta-haze');
    return win.localStorage.getItem('pondos-beta-haze')==='1';
  }catch{return false;}
}
export const HAZE_ORIGIN = 'https://hazewallet.com';
const REACTIONS = Object.freeze({heart:'💚',applause:'👏',rocket:'🚀'});
const HASH=/^[a-f0-9]{64}$/, UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

export function amountAtomic(text) {
  if(typeof text!=='string'||!/^(0|[1-9][0-9]{0,5})(\.[0-9]{1,8})?$/.test(text))throw Error('Enter a native PEP amount with up to 8 decimal places.');
  const [whole,fraction='']=text.split('.'), value=BigInt(whole)*100000000n+BigInt(fraction.padEnd(8,'0'));
  if(value<100000000n||value>10000000000000n)throw Error('Choose between 1 and 100000 PEP, plus the network fee.');
  return value.toString();
}
export function formatAtomic(value) {
  if(typeof value!=='string'||!/^[1-9][0-9]{0,19}$/.test(value))throw Error('Invalid tip amount.');
  const n=BigInt(value),fraction=(n%100000000n).toString().padStart(8,'0').replace(/0+$/,'');
  return String(n/100000000n)+(fraction?'.'+fraction:'');
}
export function tipURL(intent) {
  if(!intent||!UUID.test(intent.id)||!/^P[1-9A-HJ-NP-Za-km-z]{33}$/.test(intent.sender)||
      !/^P[1-9A-HJ-NP-Za-km-z]{33}$/.test(intent.address)||intent.sender===intent.address||!Object.hasOwn(REACTIONS,intent.reaction))throw Error('The tip details are incomplete.');
  const amount=formatAtomic(intent.amount_atomic);amountAtomic(amount);
  const url=new URL('/assets/tip.html',HAZE_ORIGIN);
  url.hash=new URLSearchParams({'haze-tip':'1',asset:'PEP',address:intent.address,amount,
    recipient:String(intent.recipient||'Fren').slice(0,60),platform:'PepecoinHub',note:String(intent.note||'').slice(0,160),
    reaction:intent.reaction,intent:intent.id,sender:intent.sender,expires:new Date(intent.expires_at).toISOString()}).toString();
  return url.href;
}
// "/tip Jurek 20", "/tip @Jurek 2,5 pep thanks!" -> {nick, amount, note}. null when the text is not a /tip command.
export const TIP_USAGE='Usage: /tip nick amount [pep] [note], e.g. /tip Jurek 20';
export function parseTipCommand(text) {
  const match=/^\/tip(?:\s+([\s\S]*))?$/i.exec(String(text||'').trim());
  if(!match)return null;
  const parts=(match[1]||'').trim().split(/\s+/).filter(Boolean);
  if(parts.length<2)throw Error(TIP_USAGE);
  const nick=parts[0].replace(/^@/,''),amountText=parts[1].replace(/pep$/i,'').replace(',','.');
  let rest=parts.slice(2);if(rest[0]&&/^pep$/i.test(rest[0]))rest=rest.slice(1);
  if(!nick||!amountText)throw Error(TIP_USAGE);
  return {nick,amount:formatAtomic(amountAtomic(amountText)),note:rest.join(' ').slice(0,160)};
}
export function submissionMatches(event,flight) {
  const data=event?.data;
  return !!flight&&event.origin===HAZE_ORIGIN&&event.source===(flight.source||flight.popup)&&data?.type==='haze:tip-submitted'&&
    data.version===1&&data.intent===flight.intent.id&&typeof data.txid==='string'&&HASH.test(data.txid);
}

export function createHazeTips({rpc,invoke,session,login,notify,chatLog=null,chatInput=null,enabled=HAZE_TIPS_ENABLED||hazeBeta(),document:doc=globalThis.document,window:win=globalThis.window}={}) {
  if(!enabled)return null;
  const node=(tag,attrs={},...children)=>{
    const value=doc.createElement(tag);
    for(const [key,content]of Object.entries(attrs)){if(key.startsWith('on'))value.addEventListener(key.slice(2),content);else if(content!=null)value.setAttribute(key,String(content));}
    for(const child of children.flat())if(child!=null)value.append(typeof child==='string'?doc.createTextNode(child):child);
    return value;
  };
  if(!doc.querySelector('[data-haze-tip-style]'))doc.head.append(node('link',{rel:'stylesheet',href:new URL('../haze-tips.css',import.meta.url).href,'data-haze-tip-style':'1'}));
  let destroyed=false,dialog=null,wallet=null,owner=null,syncAt=0,syncing=false,initial=true,linkButton=null;
  let activeView=null,walletHost=null,walletFrame=null,walletLoaded=null,walletCaps=null;
  const walletBase=HAZE_ORIGIN+'/widget.html?haze-chat=1',queueKey='ph-haze-submitted-v1';
  const messages=new Map(),receivers=new Map(),flights=new Map(),rendered=new Map(),seenReceipts=new Set(),timers=new Set();
  const currentUser=()=>{const user=session()?.user;return user&&!user.is_anonymous?user.id:null;};
  const signed=()=>{if(!currentUser()){login?.();throw Error('Sign in with Discord first.');}};
  const groups=createHazeGroups({node,doc,win,rpc,invoke,modal,ensureWallet,currentUser,formatAtomic,amountAtomic,chatLog:()=>chatLog,chatInput:()=>chatInput,origin:HAZE_ORIGIN,wallet:()=>wallet,refreshWallet:refresh,capabilities:()=>walletCaps,hideWallet:()=>{if(walletHost)walletHost.hidden=true;},login,connect},{enabled:HAZE_GROUPS_ENABLED||hazeBeta(win)});
  function endView(){
    const view=activeView;activeView=null;view?.controller.abort();if(walletHost)walletHost.hidden=true;
    if(walletFrame){walletFrame.contentWindow.postMessage({type:'haze:tip-cancel',version:1},HAZE_ORIGIN);walletFrame.contentWindow.postMessage({type:'haze:hidden'},HAZE_ORIGIN);}
    if(view?.oldFocus?.isConnected)view.oldFocus.focus();
  }
  function modal(title) {
    activeView?.controller.abort();activeView=null;
    if(!dialog){
      dialog=node('dialog',{class:'haze-tip-dialog'});
      const close=node('button',{type:'button',class:'haze-tip-close','aria-label':'Close Haze dialog',onclick:()=>{endView();dialog.close();}},'×');
      walletHost=node('div',{class:'haze-tip-wallet',hidden:''});
      dialog.append(node('header',{},node('strong',{},'◇ Haze Wallet'),close),node('h2'),node('div',{class:'haze-tip-body'}),walletHost,node('p',{role:'status',class:'haze-tip-status'}));
      // Keep the wallet's browsing context alive, respecting its normal lock
      // policy. A later tip can reuse the wallet; no key reaches this page.
      dialog.addEventListener('close',()=>{if(!dialog.open)endView();});doc.body.append(dialog);
    }
    const controller=new AbortController(),d=dialog,body=d.querySelector('.haze-tip-body'),status=d.querySelector('.haze-tip-status');
    body.replaceChildren();status.textContent='';d.querySelector('h2').textContent=title;d.setAttribute('aria-label',title);walletHost.hidden=true;
    const view={d,body,status,controller,signal:controller.signal,oldFocus:doc.activeElement,active:()=>activeView===view&&!controller.signal.aborted};
    view.close=()=>{if(view.active()){endView();d.close();}};
    activeView=view;if(!d.open)d.showModal();return view;
  }
  async function ensureWallet(view){
    if(!walletFrame){
      walletFrame=node('iframe',{title:'Secure Haze Wallet',class:'haze-tip-frame',referrerpolicy:'no-referrer',allow:'clipboard-write'});
      walletLoaded=new Promise((resolve,reject)=>{walletFrame.onload=resolve;walletFrame.onerror=()=>reject(Error('Haze could not be loaded.'));});
      walletFrame.src=walletBase;walletHost.append(walletFrame);
    }
    walletHost.hidden=false;walletFrame.contentWindow.postMessage({type:'haze:open'},HAZE_ORIGIN);
    await walletLoaded;
    if(!view.active())throw Error('Wallet review canceled.');
    if(!walletCaps){
      for(let i=0;i<12&&view.active();i++){
        try{walletCaps=await frameRequest(walletFrame,'capabilities',{},1500,view.signal);break;}catch{}
      }
    }
    if(walletCaps?.authentication!=='haze-auth-v1'||walletCaps.chatTipProtocol!==1||walletCaps.chatTipInline!==1)throw Error('This Haze build does not support chat tips yet. Open the updated Haze web wallet and try again.');
    return walletFrame;
  }
  function paintButton(){if(linkButton)linkButton.textContent=wallet?.address?'◇ Haze linked ✓':'◇ Link Haze for tips';}
  async function refresh() {
    const user=currentUser();owner=user;wallet=null;paintButton();groups?.setWalletLoading(!!user);
    if(!user||destroyed)return;
    try{const value=await rpc('gry_haze_status',{});if(owner===user&&!destroyed){wallet=value;paintButton();restoreQueue();void groups?.sync(true);}}catch{}finally{groups?.setWalletLoading(false);}
  }
  async function frameRequest(frame,method,params,timeout=10000,signal) {
    return new Promise((resolve,reject)=>{
      const id=win.crypto.randomUUID().replaceAll('-','');
      const cleanup=()=>{clearTimeout(timer);win.removeEventListener('message',receive);signal?.removeEventListener('abort',abort);};
      const abort=()=>{cleanup();reject(Error('Wallet connection canceled.'));};
      const receive=event=>{
        if(event.origin!==HAZE_ORIGIN||event.source!==frame.contentWindow||event.data?.type!=='haze:response'||event.data.version!==1||event.data.id!==id)return;
        cleanup();event.data.error?reject(Error(event.data.error.message||'Haze declined the request.')):resolve(event.data.result);
      };
      const timer=setTimeout(()=>{cleanup();reject(Error('Haze did not answer in time. Please try again.'));},timeout);
      win.addEventListener('message',receive);
      if(signal?.aborted){abort();return;}signal?.addEventListener('abort',abort,{once:true});
      frame.contentWindow.postMessage({type:'haze:request',version:1,id,method,params},HAZE_ORIGIN);
    });
  }
  async function connect(afterLinked) {
    try{signed();}catch{return;}
    const user=currentUser(),view=modal(wallet?.address?'Your linked Haze wallet':'Link Haze Wallet');
    view.body.append(node('p',{},'Link your public native PEP address so frens can tip you. PepecoinHub never receives your password or private keys. Linking cannot spend your funds.'));
    if(wallet?.address){
      view.body.append(node('code',{class:'haze-tip-address'},wallet.address),node('p',{},'Haze Linked ✓ · Your public address is available for message tips.'),
        node('button',{type:'button',class:'haze-tip-secondary',onclick:async()=>{try{await rpc('gry_haze_unlink',{});await refresh();view.close();}catch(error){view.status.textContent=error.message;}}},'Unlink wallet'));
    }
    const approve=node('button',{type:'button',class:'haze-tip-primary'},wallet?.address?'Link a different wallet':'Continue with Haze Wallet');
    view.body.append(approve,node('a',{href:HAZE_ORIGIN+'/widget.html?standalone=1',target:'_blank',rel:'noopener noreferrer',class:'haze-tip-secondary'},'Open Haze Wallet ↗'));
    approve.onclick=async()=>{
      approve.disabled=true;
      view.status.textContent='Approve the public-address connection inside Haze.';
      try{
        const frame=await ensureWallet(view);
        if(currentUser()!==user||!view.active())return;
        const challenge=await rpc('gry_haze_link_begin',{});
        const result=await frameRequest(frame,'authenticate',{challenge},300000,view.signal);
        if(currentUser()!==user||!view.active())return;
        const linked=await invoke({action:'link',proof:result.proof});
        if(currentUser()!==user||!view.active())return;
        wallet={address:linked.address};paintButton();invalidate();void sync();
        if(typeof afterLinked==='function')void afterLinked();else view.close();
      }catch(error){if(view.active()){walletHost.hidden=true;view.status.textContent=error.message;approve.disabled=false;}}
    };
  }
  function mount(parent){linkButton=node('button',{type:'button',class:'haze-wallet-link',onclick:connect},'◇ Link Haze for tips');parent.append(linkButton);groups?.mount(parent);void refresh();}
  function paintReceiver(value){
    const available=receivers.get(value.message.user_id);
    value.badge.hidden=available!==true;value.action.disabled=available!==true;
    value.action.textContent=available===true?'💚 Tip':available===false?'Wallet not linked':'Checking wallet…';
    value.action.setAttribute('aria-label',available===true?'Tip '+value.message.nick+' with Haze':available===false?value.message.nick+' has not linked a receiving wallet':'Checking '+value.message.nick+'’s receiving wallet');
    value.action.title=available===false?value.message.nick+' needs to link a receiving wallet before they can receive tips.':available===true?'Send a native PEP tip with Haze':'Checking whether this fren can receive tips.';
  }
  function bindMessage(row,message) {
    if(!message.verified||!UUID.test(message.user_id||'')||!Number.isSafeInteger(Number(message.id)))return;
    const id=String(message.id);if(messages.get(id)?.row===row)return;
    const badge=node('span',{class:'haze-linked-badge',title:'Receiving wallet linked with Haze',hidden:''},'◇');
    const action=node('button',{type:'button',class:'haze-message-tip','aria-label':'Tip '+message.nick+' with Haze',onclick:()=>void openTip(message)},'💚 Tip');
    row.append(badge);if(message.user_id!==currentUser())row.append(action);
    const value={row,message,badge,action};messages.set(id,value);paintReceiver(value);
    if(!receivers.has(message.user_id))invalidate();
  }
  // /tip in the chat box: the recipient is the newest visible message by that nick, so the server checks it
  // exactly like the Tip button. Returns false (not /tip), 'opened' or 'error' (the text stays in the box).
  function command(text) {
    let parsed;
    try{parsed=parseTipCommand(text);}catch(error){notify?.(error.message);return 'error';}
    if(!parsed)return false;
    const key=parsed.nick.toLowerCase(),found=[];
    for(const value of messages.values())if(value.row.isConnected&&String(value.message.nick||'').toLowerCase()===key)found.push(value.message);
    const people=new Set(found.map(message=>message.user_id));
    if(!found.length){notify?.('No recent verified message from '+parsed.nick+' here. Tip them after they write, or use 💚 Tip on their message.');return 'error';}
    if(people.size>1){notify?.('Several frens use the name '+parsed.nick+'. Use 💚 Tip on the right message.');return 'error';}
    if(found[0].user_id===currentUser()){notify?.('You cannot tip yourself.');return 'error';}
    void openTip(found.reduce((a,b)=>Number(b.id)>Number(a.id)?b:a),parsed);
    return 'opened';
  }
  async function openTip(message,preset={}) {
    try{signed();}catch{return;}
    if(owner!==currentUser()||!wallet?.address)await refresh();
    if(!wallet?.address){await connect(()=>openTip(message,preset));return;}
    const user=currentUser(),view=modal('Make '+message.nick+'’s day');
    const form=node('form'),amount=node('input',{type:'text',inputmode:'decimal',value:preset.amount||'10','aria-label':'Tip amount in native PEP',maxlength:'15'});
    const presets=node('div',{class:'haze-tip-presets'});
    for(const value of ['1','10','100','1000'])presets.append(node('button',{type:'button',onclick:()=>{amount.value=value;}},value+' PEP'));
    const reactions=node('select',{'aria-label':'Tip reaction'});
    for(const [value,label]of Object.entries(REACTIONS))reactions.append(node('option',{value},label+' '+({heart:'Much love',applause:'Well played',rocket:'Let’s go'})[value]));
    const note=node('input',{type:'text',maxlength:'160',placeholder:'Thanks for the help!','aria-label':'Optional tip note',value:preset.note||''});
    const submit=node('button',{type:'submit',class:'haze-tip-primary'},'Review tip in Haze');
    form.append(node('p',{},'A direct tip from your linked Haze wallet. You approve the payment and network fee in Haze.'),presets,
      node('label',{},'Native Pepecoin (PEP)',amount),node('label',{},'Make it a moment',reactions),node('label',{},'A little note (optional)',note),submit);
    view.body.append(form,node('small',{},'Powered by Haze Wallet · No site balance or deposit.'));
    form.onsubmit=async event=>{
      event.preventDefault();if(submit.disabled)return;view.status.textContent='';
      try{
        if(currentUser()!==user)throw Error('Your account changed. Start this tip again.');
        if(flights.size>=20)throw Error('Too many open tip checks. Finish your pending tips first.');
        const atomic=amountAtomic(amount.value);submit.disabled=true;
        view.status.textContent='Checking the tip details…';
        const intent=await rpc('gry_haze_tip_begin',{p_message:message.id,p_amount:atomic,p_reaction:reactions.value,p_note:note.value});
        if(currentUser()!==user||!view.active())return;
        const url=new URL(tipURL(intent));
        view.status.textContent='Opening your secure Haze review…';
        const frame=await ensureWallet(view);
        if(currentUser()!==user||!view.active())return;
        const flight={source:frame.contentWindow,intent:{...intent,message_id:message.id},user,view,txid:null,attempts:0,checking:false};
        flights.set(intent.id,flight);frame.contentWindow.postMessage({type:'haze:tip-review',version:1,fragment:url.hash},HAZE_ORIGIN);form.remove();
        view.d.querySelector('h2').textContent='Review '+formatAtomic(intent.amount_atomic)+' PEP for '+intent.recipient;
        view.status.textContent='Review the recipient and network fee in Haze. Chat will follow confirmation automatically.';
      }catch(error){if(view.active()){walletHost.hidden=true;view.status.textContent=error.message;submit.disabled=false;}}
    };
  }
  async function checkFlight(flight) {
    if(destroyed||flight.checking||currentUser()!==flight.user||!flight.txid||doc.hidden)return;
    if(flight.timer){clearTimeout(flight.timer);timers.delete(flight.timer);flight.timer=null;}
    if(Date.now()>Date.parse(flight.intent.expires_at)+7200000||flight.attempts>=120)return;
    flight.checking=true;flight.attempts++;
    paintPending(flight,'Submitted · checking the network…');
    try{
      const result=await invoke({action:'check',intent:flight.intent.id,txid:flight.txid});
      if(currentUser()!==flight.user)return;
      if(result.state==='confirmed'){
        flight.card?.remove();flights.delete(flight.intent.id);saveQueue();invalidate();void sync();
      }else{
        paintPending(flight,'On its way · confirming on the Pepecoin network…');
      }
    }catch{paintPending(flight,'Submitted · reconnecting to confirmation checks. No need to send again.');}
    finally{
      flight.checking=false;
      if(flights.has(flight.intent.id)&&!destroyed){const timer=setTimeout(()=>{timers.delete(timer);flight.timer=null;void checkFlight(flight);},flight.attempts<6?20000:60000);flight.timer=timer;timers.add(timer);}
    }
  }
  function paintPending(flight,text){
    const row=messages.get(String(flight.intent.message_id))?.row;if(!row)return;
    if(!flight.card?.isConnected){flight.card=node('div',{class:'haze-pending-tip',role:'status'},'');row.append(flight.card);}
    flight.card.textContent=REACTIONS[flight.intent.reaction]+' '+formatAtomic(flight.intent.amount_atomic)+' PEP to '+flight.intent.recipient+' · '+text;
  }
  function saveQueue(){
    try{win.localStorage.setItem(queueKey,JSON.stringify([...flights.values()].filter(f=>f.txid).map(({user,intent,txid,attempts})=>({user,intent,txid,attempts})).slice(-20)));}catch{}
  }
  function restoreQueue(){
    try{
      let cached=[];try{const raw=win.localStorage.getItem(queueKey);if(raw&&raw.length<=65536){const parsed=JSON.parse(raw);if(Array.isArray(parsed))cached=parsed.slice(-20);}}catch{}
      const server=Array.isArray(wallet?.pending)?wallet.pending.slice(-20).map(({txid,...intent})=>({user:currentUser(),intent,txid})):[];
      for(const entry of [...cached,...server]){
        if(entry.user!==currentUser()||!HASH.test(entry.txid)||!entry.intent||flights.has(entry.intent.id)||Date.now()>Date.parse(entry.intent.expires_at)+7200000)continue;
        tipURL({...entry.intent,expires_at:new Date(Math.max(Date.now()+1,Date.parse(entry.intent.expires_at))).toISOString()});
        const flight={...entry,attempts:Number.isSafeInteger(entry.attempts)?entry.attempts:0,checking:false};flights.set(entry.intent.id,flight);void checkFlight(flight);
      }
    }catch{}
  }
  const receive=event=>{for(const flight of flights.values())if(submissionMatches(event,flight)&&!flight.txid){
    flight.txid=event.data.txid;saveQueue();paintPending(flight,'Submitted · checking the network…');
    if(flight.view?.active())flight.view.close();void checkFlight(flight);
  }};
  win.addEventListener('message',receive);
  const resume=()=>{if(!doc.hidden)for(const flight of flights.values())if(flight.txid&&!flight.checking)void checkFlight(flight);};
  doc.addEventListener('visibilitychange',resume);
  function invalidate(){syncAt=0;void groups?.sync(true);}
  async function sync() {
    if(destroyed||syncing||doc.hidden||Date.now()-syncAt<60000)return;
    for(const [id,value]of messages)if(!value.row.isConnected)messages.delete(id);
    const ids=[...messages.keys()].slice(-120);if(!ids.length)return;
    syncing=true;syncAt=Date.now();
    try{
      const result=await rpc('gry_haze_chat',{p_messages:ids});if(destroyed)return;
      const linked=new Set(result.linked_users||[]);
      for(const id of ids){const value=messages.get(id);if(value)receivers.set(value.message.user_id,linked.has(value.message.user_id));}
      for(const value of messages.values())paintReceiver(value);
      if(receivers.size>500){const visible=new Set([...messages.values()].map(value=>value.message.user_id));for(const id of receivers.keys())if(!visible.has(id))receivers.delete(id);}
      for(const receipt of result.receipts||[]){
        if(receipt.state!=='confirmed'||!UUID.test(receipt.id)||!HASH.test(receipt.txid)||!Object.hasOwn(REACTIONS,receipt.reaction)||rendered.get(receipt.id)?.isConnected)continue;
        const message=messages.get(String(receipt.message_id));if(!message)continue;
        const card=node('div',{class:'haze-chat-receipt'+(initial||seenReceipts.has(receipt.id)?'':' haze-tip-celebrate'),'data-tip-id':receipt.id},
          node('strong',{},REACTIONS[receipt.reaction]+' '+receipt.sender+' tipped '+receipt.recipient+' '+formatAtomic(receipt.amount_atomic)+' PEP'),
          receipt.note?node('span',{},receipt.note):null,
          node('a',{href:'https://pepeblocks.com/tx/'+receipt.txid,target:'_blank',rel:'noopener noreferrer'},'Confirmed · View transaction ↗'),node('small',{},'Powered by Haze Wallet'));
        message.row.append(card);rendered.set(receipt.id,card);seenReceipts.add(receipt.id);
      }
      for(const [id,card]of rendered)if(!card.isConnected)rendered.delete(id);
      while(seenReceipts.size>500)seenReceipts.delete(seenReceipts.values().next().value);
      initial=false;
      for(const flight of flights.values())if(flight.txid)paintPending(flight,'On its way · checking confirmation automatically…');
    }catch{/* Missing migration or temporary failure must not break ordinary chat. */}
    finally{syncing=false;}
  }
  return {mount,bindMessage,command,refresh,invalidate,sync,connect,destroy(){destroyed=true;groups?.destroy();saveQueue();dialog?.close();dialog?.remove();win.removeEventListener('message',receive);doc.removeEventListener('visibilitychange',resume);for(const timer of timers)clearTimeout(timer);timers.clear();messages.clear();receivers.clear();flights.clear();linkButton?.remove();}};
}
