export const HAZE_GROUPS_ENABLED=true;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,HASH=/^[a-f0-9]{64}$/;
const MODES={all:'Whole pond',online:'Online frens',offline:'Away / offline frens',random:'Random frens',selected:'Choose frens',airdrop:'Timed airdrop',trivia:'Trivia round',word:'Say the word'};
export function groupVisible(drop, now=Date.now()){
  if(drop.state==='open')return true;
  const end=Date.parse(drop.ended_at||'');
  return !Number.isFinite(end)||now<end+30*60*1000;
}
export function createHazeGroups(ctx,{enabled=HAZE_GROUPS_ENABLED}={}){
  if(!enabled)return null;
  const {node:n,doc,win,rpc,invoke,modal,ensureWallet,currentUser,formatAtomic,amountAtomic,origin}=ctx;
  const cacheKey='ph-haze-group-submitted-v1',flights=new Map(),completed=new Set();let stopped=false,data=null,feed=null,panel=null,help=null,button=null,timer=null,expiryTimer=null,clockOffset=0,busy=null;
  const signed=()=>{if(!currentUser()){ctx.login?.();throw Error('Sign in with Discord first.');}};
  const save=()=>{try{win.localStorage.setItem(cacheKey,JSON.stringify([...flights.values()].map(({id,txid,user})=>({id,txid,user})).slice(-20)));}catch{}};
  function resume(){
    for(const drop of data?.drops||[])if(['confirmed','cancelled','empty'].includes(drop.state)){completed.add(drop.id);flights.delete(drop.id);}
    try{const raw=win.localStorage.getItem(cacheKey);if(raw&&raw.length<10000)for(const f of JSON.parse(raw).slice(-20))if(f.user===currentUser()&&UUID.test(f.id)&&HASH.test(f.txid)&&!completed.has(f.id)&&!flights.has(f.id))flights.set(f.id,{...f,attempts:0,next:0});}catch{}
    for(const drop of data?.drops||[])if(drop.state==='ready'&&drop.owner===currentUser()&&HASH.test(drop.submitted_txid||'')&&!completed.has(drop.id)&&!flights.has(drop.id))flights.set(drop.id,{id:drop.id,txid:drop.submitted_txid,user:currentUser(),attempts:0,next:0});
    save();
    for(const flight of flights.values())void check(flight);
  }
  async function check(flight){
    if(stopped||doc.hidden||!HASH.test(flight.txid||'')||flight.checking||flight.user!==currentUser()||Date.now()<(flight.next||0)||flight.attempts>=120)return;
    flight.checking=true;flight.attempts++;flight.next=Date.now()+20000;
    try{const result=await invoke({action:'group-check',intent:flight.id,txid:flight.txid});if(result.state==='confirmed'){completed.add(flight.id);flights.delete(flight.id);save();void sync(true);}}
    catch{/* A submitted payment is checked again, never sent again. */}
    finally{flight.checking=false;}
  }
  function sync(force=false){
    if(stopped||doc.hidden||!currentUser())return Promise.resolve();if(busy)return busy;
    busy=(async()=>{
      try{data=await rpc('gry_haze_groups',{});const serverNow=Date.parse(data?.now);clockOffset=Number.isFinite(serverNow)?serverNow-Date.now():0;if(!stopped){render();resume();}}catch{}
      finally{busy=null;clearTimeout(timer);if(!stopped)timer=setTimeout(()=>void sync(),data?.drops?.some(d=>d.state==='open')?5000:20000);}
    })();return busy;
  }
  function render(){
    if(!data)return;
    const log=ctx.chatLog?.()||doc.getElementById('lchat');
    if(log){if(!feed)feed=n('section',{class:'haze-group-feed','aria-label':'Community tips and rounds'});if(!panel){panel=n('details',{class:'haze-drop-panel',open:true},n('summary',{},'Community drops'),feed);}if(!panel.isConnected){const anchor=log.closest('.lan-main')||log;anchor.before(panel);}feed.replaceChildren();}
    const now=Date.now()+clockOffset;
    const drops=(data.drops||[]).filter(d=>groupVisible(d,now)).slice(0,30);
    clearTimeout(expiryTimer);
    const deadlines=drops.map(d=>Date.parse(d.ended_at||'')+30*60*1000).filter(t=>Number.isFinite(t)&&t>now);
    if(deadlines.length)expiryTimer=setTimeout(()=>{if(!stopped)render();},Math.min(...deadlines)-now);
    if(button)button.textContent='🎉 Group tips'+(drops.some(d=>d.state==='open')?' · round live':'');
    if(!feed)return;panel.hidden=!drops.length;panel.querySelector('summary').textContent='Community drops ('+drops.length+')';
    for(const drop of drops){
      const card=n('article',{class:'haze-drop-card '+(drop.state==='confirmed'?'is-confirmed':drop.state==='open'?'is-open':''),'data-group-id':drop.id});
      card.append(n('strong',{},drop.title),n('span',{class:'haze-drop-meta'},drop.creator+' · '+formatAtomic(drop.total_atomic)+' PEP · '+(MODES[drop.mode]||drop.mode)));
      const status=n('p',{role:'status'});card.append(status);
      if(drop.state==='open'){
        const left=Math.max(0,Math.ceil((Date.parse(drop.closes_at)-Date.now())/1000));status.textContent=drop.entries+' entered · '+left+'s left · max '+drop.max_winners+' winners';
        if(drop.owner!==currentUser()){
          if(drop.mode==='airdrop'){
            const join=n('button',{type:'button',class:'haze-tip-secondary'},drop.joined?'Joined ✓':!drop.eligible?'Not eligible for this round':'Join airdrop');join.disabled=drop.joined||!drop.eligible||!ctx.wallet()?.address;
            join.onclick=async()=>{join.disabled=true;try{await rpc('gry_haze_group_join',{p_id:drop.id});await sync(true);}catch(e){status.textContent=e.message;join.disabled=false;}};card.append(join);
          }else{
            const answer=n('button',{type:'button',class:'haze-tip-secondary'},drop.joined?'Answer received ✓':drop.mode==='trivia'?'Answer in chat':'Say the word in chat');
            answer.disabled=drop.joined||!drop.eligible||!ctx.wallet()?.address;
            answer.onclick=()=>{const input=ctx.chatInput?.()||doc.getElementById('chatin');if(input){input.value=drop.mode==='trivia'?'/answer ':drop.title.slice(5,-1);input.focus();}};card.append(answer);
            card.append(n('small',{},drop.mode==='trivia'?'Use /answer followed by your answer. One attempt per person.':'Type the displayed word in chat. Each person can win once.'));
          }
          if(!ctx.wallet()?.address)card.append(n('small',{},'Link your receiving wallet to join.'));
        }
      }else if(drop.state==='ready'){
        const pending=HASH.test(flights.get(drop.id)?.txid||'')||!!drop.submitted_txid||drop.payment_pending===true,expired=Date.parse(drop.expires_at)<=Date.now();
        status.textContent=pending?'Payment sent · confirming…':expired?'Review expired · no payment':drop.count+' selected · '+(drop.owner===currentUser()?'Review payout':'Awaiting host approval');
        if(drop.owner===currentUser()&&!pending&&!expired){const review=n('button',{type:'button',class:'haze-tip-primary'},'Review payout');review.onclick=()=>void reviewPayout(drop.id);card.append(review);}
      }else if(drop.state==='confirmed'){
        status.textContent='Confirmed · '+drop.count+(drop.count===1?' fren paid':' frens paid');
        if(HASH.test(drop.txid||''))card.append(n('a',{href:'https://pepeblocks.com/tx/'+drop.txid,target:'_blank',rel:'noopener noreferrer'},'View group transaction ↗'));
      }else status.textContent=drop.state==='cancelled'?'Cancelled · no payment':'No eligible winners · no payment made';
      if(drop.recipients?.length){
        const names=drop.recipients.map(r=>r.nick+' '+formatAtomic(r.amount)+' PEP').join(' · ')+(drop.count>12?' · +'+(drop.count-12)+' more':'');
        if(drop.recipients.length>3)card.append(n('details',{class:'haze-group-details'},n('summary',{},'Recipients ('+drop.count+')'),n('p',{class:'haze-group-names'},names)));
        else card.append(n('p',{class:'haze-group-names'},names));
      }
      if(drop.owner===currentUser()&&['open','ready','empty'].includes(drop.state)&&!drop.submitted_txid&&!flights.has(drop.id)){const cancel=n('button',{type:'button',class:'haze-group-cancel'},'Cancel event');cancel.onclick=async()=>{try{await rpc('gry_haze_group_cancel',{p_id:drop.id});await sync(true);}catch(e){status.textContent=e.message;}};card.append(cancel);}
      card.append(n('small',{class:'haze-drop-foot'},'Haze Wallet · no entry fee'));feed.append(card);
    }
  }
  async function reviewPayout(id,previous){
    const view=previous?.active()?previous:modal('Review the group payout');
    try{
      const request=await rpc('gry_haze_group_review',{p_id:id});if(!view.active())return;
      view.d.querySelector('h2').textContent='Review the group payout';
      const normalized={...request,created_at:new Date(request.created_at).toISOString(),expires_at:new Date(request.expires_at).toISOString()};
      view.body.replaceChildren(n('strong',{},request.title),n('p',{},request.recipients.length+' recipients · '+formatAtomic(request.total_atomic)+' PEP total'));
      const list=n('div',{class:'haze-group-preview'});request.recipients.forEach(r=>list.append(n('div',{},n('strong',{},r.nick+' · '+formatAtomic(r.amount)+' PEP'),n('code',{},r.address))));view.body.append(list);
      const approve=n('button',{type:'button',class:'haze-tip-primary'},'Review group in Haze');view.body.append(approve,n('small',{},'This recipient list is fixed. Review the network fee and approve inside Haze.'));
      approve.onclick=async()=>{
        approve.disabled=true;view.status.textContent='Opening the secure group review…';
        try{
          const frame=await ensureWallet(view);if(!view.active())return;
          if(ctx.capabilities()?.chatGroupTips!==1)throw Error('Update Haze Wallet to a build that supports group tips.');
          flights.set(id,{id,user:currentUser(),source:frame.contentWindow,view,attempts:0,next:0});
          view.signal.addEventListener('abort',()=>render(),{once:true});
          frame.contentWindow.postMessage({type:'haze:group-tip-review',version:1,request:normalized},origin);
          view.body.replaceChildren();view.status.textContent='Check every recipient and the network fee in Haze. Nothing is sent until you approve.';
        }catch(e){view.status.textContent=e.message;approve.disabled=false;ctx.hideWallet();}
      };
    }catch(e){if(view.active())view.status.textContent=e.message;}
  }
  async function open(){
    try{signed();}catch{return;}
    if(!ctx.wallet()?.address)await ctx.refreshWallet();
    if(!ctx.wallet()?.address){await ctx.connect(()=>open());return;}
    const view=modal('Share PEP with the pond');view.status.textContent='Loading eligible members…';
    await sync(true);if(!view.active())return;if(!data){view.status.textContent='Community tips could not be loaded. Close this dialog and try again.';return;}view.status.textContent='';
    const form=n('form'),mode=n('select',{'aria-label':'Group tip mode'}),audience=n('select',{'aria-label':'Recipient audience'});
    for(const [key,label]of Object.entries(MODES))mode.append(n('option',{value:key},label));
    for(const [key,label]of [['all','All linked members'],['online','Online here'],['offline','Away / offline']])audience.append(n('option',{value:key},label));
    const total=n('input',{type:'text',inputmode:'decimal',value:'100','aria-label':'Group PEP total'}),count=n('input',{type:'number',min:'1',max:'200',value:'2','aria-label':'Random recipient count'});
    const title=n('input',{type:'text',maxlength:'120','aria-label':'Round question or title',placeholder:'What makes this round special?'}),answer=n('input',{type:'text',maxlength:'120','aria-label':'Round answer or word',autocomplete:'off'});
    const seconds=n('select',{'aria-label':'Round duration'});for(const [value,label]of [['15','15 seconds'],['60','1 minute'],['300','5 minutes']])seconds.append(n('option',{value},label));seconds.value='60';
    const winners=n('input',{type:'number',min:'1',max:'200',value:'1','aria-label':'Maximum winners'}),note=n('input',{type:'text',maxlength:'160','aria-label':'Group tip note',placeholder:'A little appreciation for the pond 💚'});
    const selected=n('div',{class:'haze-group-selection'});for(const member of data?.members||[])selected.append(n('label',{},n('input',{type:'checkbox',value:member.id}),member.nick+' · '+(member.online?'online':'away')));
    const fields={audience:n('label',{},'Eligible audience',audience),count:n('label',{},'How many random frens?',count),title:n('label',{},'Question / title',title),answer:n('label',{},'Answer / word',answer),seconds:n('label',{},'Round duration',seconds),winners:n('label',{},'Maximum winners',winners),selected};
    function update(){const timed=['airdrop','trivia','word'].includes(mode.value),game=['trivia','word'].includes(mode.value);
      fields.audience.hidden=!['random','airdrop','trivia','word'].includes(mode.value);fields.count.hidden=mode.value!=='random';fields.title.hidden=mode.value==='word';fields.answer.hidden=!game;fields.seconds.hidden=!timed;fields.winners.hidden=!game;selected.hidden=mode.value!=='selected';
      for(const field of Object.values(fields))for(const input of field.querySelectorAll('input,select'))input.disabled=field.hidden;
      submit.textContent=timed?'Start the round':'Preview recipients';hint.textContent=mode.value==='trivia'?'People answer in chat with /answer. One attempt each; first correct answers win. You approve the payout after the round.':mode.value==='word'?'The word is announced to chat. First matching replies win; each person can win once.':mode.value==='airdrop'?'Linked frens join freely during the window, then you review the payout. The pool is split evenly.':'The total is split evenly, with exact smallest-unit rounding. Offline frens can receive PEP without coming online.';
    }
    const hint=n('p',{class:'haze-group-hint'}),submit=n('button',{type:'submit',class:'haze-tip-primary'},'Preview recipients');
    form.append(n('p',{},(data?.member_count||0)+' eligible linked frens · yourself excluded · max 200 per transaction'),n('label',{},'Make it a moment',mode),n('label',{},'Total native PEP to share',total),fields.audience,fields.count,fields.title,fields.answer,fields.seconds,fields.winners,selected,n('label',{},'A little note',note),hint,submit);
    mode.onchange=update;update();view.body.append(form);
    form.onsubmit=async event=>{
      event.preventDefault();if(submit.disabled)return;submit.disabled=true;view.status.textContent='Preparing the event…';
      try{
        const options={mode:mode.value,total_atomic:amountAtomic(total.value),title:mode.value==='word'?'':title.value,note:note.value};
        if(['random','airdrop','trivia','word'].includes(mode.value))options.audience=audience.value;
        if(mode.value==='random')options.count=Number(count.value);
        if(['airdrop','trivia','word'].includes(mode.value))options.seconds=Number(seconds.value);
        if(['trivia','word'].includes(mode.value)){options.winners=Number(winners.value);options.answer=answer.value;}
        if(mode.value==='selected')options.selected=[...selected.querySelectorAll('input:checked')].map(input=>input.value);
        const result=await rpc('gry_haze_group_create',{p_options:options});
        if(!view.active())return;
        if(result.state==='open'){view.close();await sync(true);}else{view.status.textContent='';await reviewPayout(result.id,view);await sync(true);}
      }catch(e){if(view.active()){view.status.textContent=e.message;submit.disabled=false;}}
    };
  }
  const receive=event=>{
    if(event.origin!==origin)return;const body=event.data,flight=flights.get(body?.intent);
    if(!flight||event.source!==flight.source||body?.version!==1)return;
    if(body.type==='haze:tip-review-closed'&&!flight.txid){flights.delete(flight.id);render();return;}
    if(body.type==='haze:group-tip-error'){if(flight.view?.active())flight.view.status.textContent=body.message;return;}
    if(body.type!=='haze:tip-submitted'||!HASH.test(body.txid||'')||flight.txid)return;
    flight.txid=body.txid;save();if(flight.view?.active())flight.view.close();render();void check(flight);void sync(true);
  };
  win.addEventListener('message',receive);const visible=()=>{if(!doc.hidden)void sync(true);};doc.addEventListener('visibilitychange',visible);
  return {setWalletLoading(value){if(button)button.disabled=value;},mount(parent){button=n('button',{type:'button',class:'haze-wallet-link',onclick:()=>void open()},'🎉 Group tips');button.disabled=!!currentUser();parent.append(' ',button);
      help=n('button',{type:'button',class:'haze-wallet-link','aria-label':'Chat help',title:'Commands, drops and bug reports'},'?');
      help.onclick=()=>{const view=modal('Chat help');view.body.append(
        n('p',{},'Link your receiving wallet through Haze to receive PEP. Use Tip beside a message to tip that fren.'),
        n('p',{},'/tip nick amount [pep] [note] opens a tip review. /answer your answer enters a trivia round. For Say the word, type the displayed word.'),
        n('p',{},'Timed airdrop: press Join airdrop before the timer ends. Other group tips use the audience chosen by the host. Entry is free; eligibility and winner limits apply.'),
        n('p',{},'The host approves payment in Haze after the round. Joining does not guarantee payment. Finished drops disappear from this panel after 30 minutes.'),
        n('a',{href:'https://github.com/PepecoinHub/pepecoinhub.github.io/issues/new?template=correction.yml',target:'_blank',rel:'noopener noreferrer'},'Report a bug'),
        n('small',{},'Include what happened, your browser and a screenshot. Never include wallet passwords, seed phrases or private keys.'));
      };
      const log=ctx.chatLog?.();(log?.closest('.lan-win')?.querySelector('.lan-top')||parent).append(help);void sync(true);},sync,open,destroy(){stopped=true;save();clearTimeout(timer);clearTimeout(expiryTimer);win.removeEventListener('message',receive);doc.removeEventListener('visibilitychange',visible);panel?.remove();help?.remove();button?.remove();}};
}
