// Owner-reviewed rollout switch. No Haze network requests or UI when disabled.
export const HAZE_TIPS_ENABLED = false;
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
export function submissionMatches(event,flight) {
  const data=event?.data;
  return !!flight&&event.origin===HAZE_ORIGIN&&event.source===flight.popup&&data?.type==='haze:tip-submitted'&&
    data.version===1&&data.intent===flight.intent.id&&typeof data.txid==='string'&&HASH.test(data.txid);
}

export function createHazeTips({rpc,invoke,session,login,enabled=HAZE_TIPS_ENABLED,document:doc=globalThis.document,window:win=globalThis.window}={}) {
  if(!enabled)return null;
  const node=(tag,attrs={},...children)=>{
    const value=doc.createElement(tag);
    for(const [key,content]of Object.entries(attrs)){if(key.startsWith('on'))value.addEventListener(key.slice(2),content);else if(content!=null)value.setAttribute(key,String(content));}
    for(const child of children.flat())if(child!=null)value.append(typeof child==='string'?doc.createTextNode(child):child);
    return value;
  };
  if(!doc.querySelector('[data-haze-tip-style]'))doc.head.append(node('link',{rel:'stylesheet',href:new URL('../haze-tips.css',import.meta.url).href,'data-haze-tip-style':'1'}));
  let destroyed=false,dialog=null,wallet=null,owner=null,syncAt=0,syncing=false,initial=true,linkButton=null;
  const messages=new Map(),flights=new Map(),rendered=new Map(),seenReceipts=new Set(),timers=new Set();
  const currentUser=()=>{const user=session()?.user;return user&&!user.is_anonymous?user.id:null;};
  const signed=()=>{if(!currentUser()){login?.();throw Error('Sign in with Discord first.');}};
  function modal(title) {
    dialog?.close();
    const oldFocus=doc.activeElement,d=node('dialog',{class:'haze-tip-dialog','aria-label':title}),controller=new AbortController();
    const close=node('button',{type:'button',class:'haze-tip-close','aria-label':'Close Haze dialog',onclick:()=>d.close()},'×');
    const body=node('div',{class:'haze-tip-body'}),status=node('p',{role:'status',class:'haze-tip-status'});
    d.append(node('header',{},node('strong',{},'◇ Haze Wallet'),close),node('h2',{},title),body,status);
    d.addEventListener('close',()=>{controller.abort();d.remove();if(dialog===d)dialog=null;if(oldFocus?.isConnected)oldFocus.focus();});
    doc.body.append(d);d.showModal();dialog=d;return {d,body,status,signal:controller.signal};
  }
  function paintButton(){if(linkButton)linkButton.textContent=wallet?.address?'◇ Haze linked ✓':'◇ Link Haze for tips';}
  async function refresh() {
    const user=currentUser();owner=user;wallet=null;paintButton();
    if(!user||destroyed)return;
    try{const value=await rpc('gry_haze_status',{});if(owner===user&&!destroyed){wallet=value;paintButton();}}catch{}
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
  async function connect() {
    try{signed();}catch{return;}
    const user=currentUser(),view=modal(wallet?.address?'Your linked Haze wallet':'Link Haze Wallet');
    view.body.append(node('p',{},'Link your public native PEP address so frens can tip you. PepecoinHub never receives your password or private keys. Linking cannot spend your funds.'));
    if(wallet?.address){
      view.body.append(node('code',{class:'haze-tip-address'},wallet.address),node('p',{},'Haze Linked ✓ · Your public address is available for message tips.'),
        node('button',{type:'button',class:'haze-tip-secondary',onclick:async()=>{try{await rpc('gry_haze_unlink',{});await refresh();view.d.close();}catch(error){view.status.textContent=error.message;}}},'Unlink wallet'));
    }
    const approve=node('button',{type:'button',class:'haze-tip-primary'},wallet?.address?'Link a different wallet':'Continue with Haze Wallet');
    view.body.append(approve);
    approve.onclick=async()=>{
      approve.disabled=true;
      const frame=node('iframe',{src:HAZE_ORIGIN+'/widget.html',title:'Secure Haze Wallet connection',class:'haze-tip-frame',referrerpolicy:'no-referrer',allow:'clipboard-write'});
      view.body.append(frame);view.status.textContent='Open Haze and approve the public-address connection inside the wallet.';
      try{
        await new Promise((resolve,reject)=>{frame.onload=resolve;frame.onerror=()=>reject(Error('Haze could not be loaded.'));});
        let ready=false;
        for(let i=0;i<12&&view.d.isConnected&&!ready;i++){try{const caps=await frameRequest(frame,'capabilities',{},1500,view.signal);ready=caps?.authentication==='haze-auth-v1';}catch{}}
        if(!ready)throw Error('Haze connection support is not ready. Please try again later.');
        if(currentUser()!==user||!view.d.isConnected)return;
        const challenge=await rpc('gry_haze_link_begin',{});
        const result=await frameRequest(frame,'authenticate',{challenge},300000,view.signal);
        if(currentUser()!==user||!view.d.isConnected)return;
        const linked=await invoke({action:'link',proof:result.proof});
        if(currentUser()!==user||!view.d.isConnected)return;
        wallet={address:linked.address};paintButton();frame.remove();approve.remove();
        view.status.textContent='Haze Linked ✓ Your receiving address was verified. Your passport has a Haze Linked stamp.';
        view.body.append(node('code',{class:'haze-tip-address'},linked.address));invalidate();void sync();
      }catch(error){if(view.d.isConnected){frame.remove();view.status.textContent=error.message;approve.disabled=false;}}
    };
  }
  function mount(parent){linkButton=node('button',{type:'button',class:'haze-wallet-link',onclick:connect},'◇ Link Haze for tips');parent.append(linkButton);void refresh();}
  function bindMessage(row,message) {
    if(!message.verified||!UUID.test(message.user_id||'')||!Number.isSafeInteger(Number(message.id)))return;
    const id=String(message.id);if(messages.get(id)?.row===row)return;
    const badge=node('span',{class:'haze-linked-badge',title:'Receiving wallet linked with Haze',hidden:''},'◇');
    const action=node('button',{type:'button',class:'haze-message-tip','aria-label':'Tip '+message.nick+' with Haze',onclick:()=>void openTip(message)},'💚 Tip');
    row.append(badge);if(message.user_id!==currentUser())row.append(action);
    messages.set(id,{row,message,badge});
  }
  async function openTip(message) {
    try{signed();}catch{return;}
    if(owner!==currentUser()||!wallet?.address)await refresh();
    if(!wallet?.address){await connect();return;}
    const user=currentUser(),view=modal('Make '+message.nick+'’s day');
    const form=node('form'),amount=node('input',{type:'text',inputmode:'decimal',value:'10','aria-label':'Tip amount in native PEP',maxlength:'15'});
    const presets=node('div',{class:'haze-tip-presets'});
    for(const value of ['1','10','100','1000'])presets.append(node('button',{type:'button',onclick:()=>{amount.value=value;}},value+' PEP'));
    const reactions=node('select',{'aria-label':'Tip reaction'});
    for(const [value,label]of Object.entries(REACTIONS))reactions.append(node('option',{value},label+' '+({heart:'Much love',applause:'Well played',rocket:'Let’s go'})[value]));
    const note=node('input',{type:'text',maxlength:'160',placeholder:'Thanks for the help!','aria-label':'Optional tip note'});
    const submit=node('button',{type:'submit',class:'haze-tip-primary'},'Review in Haze Wallet ↗');
    form.append(node('p',{},'A direct tip from your linked Haze wallet. You approve the payment and network fee in Haze.'),presets,
      node('label',{},'Native Pepecoin (PEP)',amount),node('label',{},'Make it a moment',reactions),node('label',{},'A little note (optional)',note),submit);
    view.body.append(form,node('small',{},'Powered by Haze Wallet · No site balance or deposit.'));
    form.onsubmit=async event=>{
      event.preventDefault();view.status.textContent='';let popup,registered=false;
      try{
        if(currentUser()!==user)throw Error('Your account changed. Start this tip again.');
        if(flights.size>=20)throw Error('Too many open tip checks. Finish your pending tips first.');
        const atomic=amountAtomic(amount.value);submit.disabled=true;
        popup=win.open('about:blank','haze_tip_'+win.crypto.randomUUID(),'popup,width=480,height=820');
        if(!popup)throw Error('Allow the Haze payment window, then try again.');
        const intent=await rpc('gry_haze_tip_begin',{p_message:message.id,p_amount:atomic,p_reaction:reactions.value,p_note:note.value});
        if(currentUser()!==user||!view.d.isConnected){popup.close();return;}
        const url=tipURL(intent),flight={popup,intent,user,view,txid:null,attempts:0,checking:false};
        flights.set(intent.id,flight);registered=true;popup.location.href=url;form.remove();
        view.body.prepend(node('p',{},'Your '+formatAtomic(intent.amount_atomic)+' PEP tip to '+intent.recipient+' is ready in Haze. Nothing is credited here until the payment is checked.'));
        const id=node('input',{type:'text',maxlength:'64','aria-label':'Transaction ID',placeholder:'Transaction ID from Haze (if needed)'});
        const check=node('button',{type:'button',class:'haze-tip-secondary',onclick:()=>{const value=id.value.trim();if(!HASH.test(value)){view.status.textContent='Enter the complete 64-character transaction ID from Haze.';return;}flight.txid=value;void checkFlight(flight);}},'Check this transaction');
        flight.input=id;view.body.append(id,check);view.status.textContent='Waiting for Haze. Do not send the payment a second time while a transaction is pending.';
      }catch(error){if(popup&&!registered)popup.close();if(view.d.isConnected){view.status.textContent=error.message;submit.disabled=false;}}
    };
  }
  async function checkFlight(flight) {
    if(destroyed||flight.checking||currentUser()!==flight.user||!flight.view.d.isConnected||!flight.txid)return;
    flight.checking=true;flight.attempts++;
    flight.view.status.textContent='Checking the submitted payment. A transaction ID alone is not a confirmed tip.';
    try{
      const result=await invoke({action:'check',intent:flight.intent.id,txid:flight.txid});
      if(currentUser()!==flight.user||!flight.view.d.isConnected)return;
      if(result.state==='confirmed'){
        flight.view.status.textContent='💚 Tip confirmed! Your appreciation is in the pond. First Tip passport stamp earned.';
        flight.view.body.classList.add('haze-tip-celebrate');invalidate();void sync();flights.delete(flight.intent.id);
      }else{
        flight.view.status.textContent='Payment found · waiting for two network confirmations. Do not send it again.';
        if(flight.attempts<6){const timer=setTimeout(()=>{timers.delete(timer);if(!doc.hidden)void checkFlight(flight);},20000);timers.add(timer);}
      }
    }catch(error){if(flight.view.d.isConnected)flight.view.status.textContent=error.message+' Keep your transaction ID; do not send again.';}
    finally{flight.checking=false;}
  }
  const receive=event=>{for(const flight of flights.values())if(submissionMatches(event,flight)){flight.txid=event.data.txid;if(flight.input)flight.input.value=flight.txid;void checkFlight(flight);}};
  win.addEventListener('message',receive);
  function invalidate(){syncAt=0;}
  async function sync() {
    if(destroyed||syncing||doc.hidden||Date.now()-syncAt<60000)return;
    for(const [id,value]of messages)if(!value.row.isConnected)messages.delete(id);
    const ids=[...messages.keys()].slice(-120);if(!ids.length)return;
    syncing=true;syncAt=Date.now();
    try{
      const result=await rpc('gry_haze_chat',{p_messages:ids});if(destroyed)return;
      const linked=new Set(result.linked_users||[]);
      for(const value of messages.values())value.badge.hidden=!linked.has(value.message.user_id);
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
    }catch{/* Missing migration or temporary failure must not break ordinary chat. */}
    finally{syncing=false;}
  }
  return {mount,bindMessage,refresh,invalidate,sync,connect,destroy(){destroyed=true;dialog?.close();win.removeEventListener('message',receive);for(const timer of timers)clearTimeout(timer);timers.clear();messages.clear();flights.clear();linkButton?.remove();}};
}
