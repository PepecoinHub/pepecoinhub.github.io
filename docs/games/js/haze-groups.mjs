export const HAZE_GROUPS_ENABLED=true;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,HASH=/^[a-f0-9]{64}$/;
const MODES={all:'Whole pond',online:'Online frens',offline:'Away / offline frens',random:'Random frens',selected:'Choose frens',airdrop:'Timed airdrop',trivia:'Trivia round',word:'Say the word'};
// Airdrop lengths in the Group tips window (minutes). /airdrop takes any whole number of minutes up to 600.
export const AIRDROP_MINUTES=[15,30,60,180,360,600];
export const AIRDROP_USAGE='Usage: /airdrop amount pepe minutes [title], e.g. /airdrop 500 pepe 600m';
// "/airdrop 500 pepe 600m", "/airdrop 500pepe 2h gm frens" -> {amount:'500',minutes:600,title:''}. null when not /airdrop.
export function parseAirdropCommand(text){
  const match=/^\/airdrop(?:\s+([\s\S]*))?$/i.exec(String(text||'').trim());
  if(!match)return null;
  let parts=(match[1]||'').trim().split(/\s+/).filter(Boolean);
  if(!parts.length)throw Error(AIRDROP_USAGE);
  const amount=parts[0].replace(/pepe?$/i,'').replace(',','.');parts=parts.slice(1);
  if(parts[0]&&/^pepe?$/i.test(parts[0]))parts=parts.slice(1);
  if(!/^[0-9]+(\.[0-9]+)?$/.test(amount))throw Error(AIRDROP_USAGE);
  let minutes=15;
  const time=parts[0]&&/^([0-9]{1,4})(m|min|mins|minutes?|h|hr|hrs|hours?)?$/i.exec(parts[0]);
  if(time){minutes=Number(time[1])*(/^h/i.test(time[2]||'')?60:1);parts=parts.slice(1);}
  if(!Number.isInteger(minutes)||minutes<1||minutes>600)throw Error('Airdrops last 1 to 600 minutes. '+AIRDROP_USAGE);
  return {amount,minutes,title:parts.join(' ').slice(0,120)};
}
// Say-the-word lengths in the Group tips window (seconds); /word takes 10 s to 6 h (owner, 2026-11-22).
export const WORD_SECONDS=[60,300,900,1800,3600,10800,21600];
export const WORD_USAGE='Usage: /word word amount pepe [time] [winners], e.g. /word ribbit 500 pepe 2h 5';
// "/word ribbit 500 pepe 2h 5" -> {word:'ribbit',amount:'500',seconds:7200,winners:5}. null when not /word.
export function parseWordCommand(text){
  const match=/^\/word(?:\s+([\s\S]*))?$/i.exec(String(text||'').trim());
  if(!match)return null;
  let parts=(match[1]||'').trim().split(/\s+/).filter(Boolean);
  if(parts.length<2)throw Error(WORD_USAGE);
  const word=parts[0];parts=parts.slice(1);
  if(word.length>40)throw Error('Choose a word of up to 40 characters. '+WORD_USAGE);
  const amount=parts[0].replace(/pepe?$/i,'').replace(',','.');parts=parts.slice(1);
  if(parts[0]&&/^pepe?$/i.test(parts[0]))parts=parts.slice(1);
  if(!/^[0-9]+(\.[0-9]+)?$/.test(amount))throw Error(WORD_USAGE);
  let seconds=900,winners=1;
  const time=parts[0]&&/^([0-9]{1,5})(s|sec|secs|seconds?|m|min|mins|minutes?|h|hr|hrs|hours?)?$/i.exec(parts[0]);
  if(time&&(time[2]||parts.length>1)){const unit=(time[2]||'m').toLowerCase();seconds=Number(time[1])*(unit[0]==='h'?3600:unit[0]==='s'?1:60);parts=parts.slice(1);}
  if(parts[0]){if(!/^[0-9]{1,3}$/.test(parts[0])||parts.length>1)throw Error(WORD_USAGE);winners=Number(parts[0]);}
  if(!Number.isInteger(seconds)||seconds<10||seconds>21600)throw Error('Say-the-word rounds last 10 seconds to 6 hours. '+WORD_USAGE);
  if(winners<1||winners>200)throw Error('Choose 1 to 200 winners. '+WORD_USAGE);
  return {word,amount,seconds,winners};
}
const lengthLabel=s=>s<60?s+' seconds':s<3600?(s/60)+(s===60?' minute':' minutes'):(s/3600)+(s===3600?' hour':' hours');
export function timeLeft(ms){
  const s=Math.max(0,Math.ceil(ms/1000));
  if(s<60)return s+'s left';
  if(s<3600)return Math.floor(s/60)+'m '+String(s%60).padStart(2,'0')+'s left';
  return Math.floor(s/3600)+'h '+String(Math.floor(s%3600/60)).padStart(2,'0')+'m left';
}
// Open rounds you can still act on come first, then other live rounds, payouts in progress, finished cards.
const rank=(drop,me)=>drop.state==='open'?(!drop.joined&&drop.owner!==me&&drop.eligible?0:1):drop.state==='ready'?2:3;
export function groupVisible(drop, now=Date.now()){
  if(drop.state==='open')return true;
  const end=Date.parse(drop.ended_at||'');
  return !Number.isFinite(end)||now<end+30*60*1000;
}
export function createHazeGroups(ctx,{enabled=HAZE_GROUPS_ENABLED}={}){
  if(!enabled)return null;
  const {node:n,doc,win,rpc,invoke,modal,ensureWallet,currentUser,formatAtomic,amountAtomic,origin}=ctx;
  const cacheKey='ph-haze-group-submitted-v1',flights=new Map(),completed=new Set(),clocks=[],seenOpen=new Set();let stopped=false,chip=null,firstRender=true,data=null,feed=null,panel=null,help=null,button=null,timer=null,expiryTimer=null,ticker=null,clockOffset=0,busy=null;
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
    if(stopped||doc.hidden)return Promise.resolve();if(busy)return busy;
    // Guests (and frens without Haze) watch the same drops through a read-only public feed (owner, 2026-11-20).
    const me=currentUser();
    busy=(async()=>{
      try{const value=await rpc(me?'gry_haze_groups':'gry_haze_groups_public',{});if(currentUser()!==me)return;data=value;const serverNow=Date.parse(data?.now);clockOffset=Number.isFinite(serverNow)?serverNow-Date.now():0;if(!stopped){render();if(me)resume();}}catch{}
      finally{busy=null;clearTimeout(timer);if(!stopped)timer=setTimeout(()=>void sync(),soon()?5000:20000);}
    })();return busy;
  }
  // Ask every 5 s only while a round ends within 90 s; a 10-hour airdrop is checked every 20 s.
  const soon=()=>data?.drops?.some(d=>d.state==='open'&&Date.parse(d.closes_at)-(Date.now()+clockOffset)<90000);
  // The last 5 minutes turn the card orange: "ending soon".
  function paintClock(clock,now){
    const ms=Date.parse(clock.drop.closes_at)-now,ending=ms>0&&ms<=300000;
    clock.el.textContent=clock.drop.entries+' entered · '+timeLeft(ms)+(ending?' · ending soon':'')+' · max '+clock.drop.max_winners+' winners';
    clock.card?.classList?.toggle('is-ending',ending);return ms;
  }
  function tick(){
    const now=Date.now()+clockOffset;let ended=false;
    for(const clock of clocks)if(paintClock(clock,now)<=0)ended=true;
    if(ended){clocks.length=0;void sync(true);}
    if(!clocks.length){clearInterval(ticker);ticker=null;}
  }
  // One card fits in the panel (plus a peek of the next one); the rest scroll, so drops never cover the chat (Lemon, phone).
  function fit(){
    const first=feed?.firstElementChild;if(!feed?.style||!first)return;
    feed.style.maxHeight=feed.children.length>1&&first.offsetHeight?(first.offsetHeight+26)+'px':'';
  }
  function render(){
    if(!data)return;
    const log=ctx.chatLog?.()||doc.getElementById('lchat');
    if(log){if(!feed)feed=n('section',{class:'haze-group-feed','aria-label':'Community tips and rounds'});if(!panel){panel=n('details',{class:'haze-drop-panel',open:true},n('summary',{},'Community drops'),feed);panel.addEventListener?.('toggle',fit);}
      // Under the message box, so the conversation keeps the top of the window (Byl, 2026-11-20).
      if(!panel.isConnected){const form=ctx.chatInput?.()?.form;(form||log.closest('.lan-main')||log).after(panel);}feed.replaceChildren();}
    const now=Date.now()+clockOffset,me=currentUser();
    const drops=(data.drops||[]).filter(d=>groupVisible(d,now)).slice(0,30).map((d,i)=>[d,i]).sort((a,b)=>rank(a[0],me)-rank(b[0],me)||a[1]-b[1]).map(x=>x[0]);
    clocks.length=0;
    clearTimeout(expiryTimer);
    const deadlines=drops.map(d=>Date.parse(d.ended_at||'')+30*60*1000).filter(t=>Number.isFinite(t)&&t>now);
    if(deadlines.length)expiryTimer=setTimeout(()=>{if(!stopped)render();},Math.min(...deadlines)-now);
    if(button)button.textContent='🎉 Group tips'+(drops.some(d=>d.state==='open')?' · round live':'');
    paintChip(drops,me);
    if(!feed)return;panel.hidden=!drops.length;const live=drops.filter(d=>d.state==='open').length;
    panel.querySelector('summary').textContent='Community drops ('+drops.length+')'+(live?' · '+live+' live':'')+(drops.length>1?' · scroll for more':'');
    for(const drop of drops){
      const joinable=drop.state==='open'&&(!me||(drop.owner!==me&&!drop.joined&&drop.eligible));
      const card=n('article',{class:'haze-drop-card '+(drop.state==='confirmed'?'is-confirmed':drop.state==='open'?'is-open':'')+(joinable?' is-joinable':''),'data-group-id':drop.id});
      card.append(n('strong',{},drop.title),n('span',{class:'haze-drop-meta'},drop.creator+' · '+formatAtomic(drop.total_atomic)+' PEP · '+(MODES[drop.mode]||drop.mode)));
      const status=n('p',{role:'status'});card.append(status);
      if(drop.state==='open'){
        clocks.push({el:status,drop,card});paintClock(clocks.at(-1),now);
        if(!me){
          const join=n('button',{type:'button',class:'haze-tip-secondary'},'Log on with Discord to join');join.onclick=()=>ctx.login?.();card.append(join);
          card.append(n('small',{},'Watching as a guest. Joining needs a Discord sign-in and a linked Haze wallet.'));
        }else if(drop.owner!==currentUser()){
          if(drop.mode==='airdrop'){
            const join=n('button',{type:'button',class:'haze-tip-secondary'},drop.joined?'✓ You’re in':!drop.eligible?'Not eligible for this round':'🎁 Join airdrop');join.disabled=drop.joined||!drop.eligible||!ctx.wallet()?.address;
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
        if(/^[1-9][0-9]{0,19}$/.test(drop.won||'')){card.classList?.add('is-won');status.textContent+=' · you got '+formatAtomic(drop.won)+' PEP 💚';ctx.celebrate?.('drop:'+drop.id,{amount:formatAtomic(drop.won),from:drop.creator,anchor:card});}
        if(HASH.test(drop.txid||''))card.append(n('a',{href:'https://pepeblocks.com/tx/'+drop.txid,target:'_blank',rel:'noopener noreferrer'},'View group transaction ↗'));
      }else status.textContent=drop.state==='cancelled'?'Cancelled · no payment':'No eligible winners · no payment made';
      if(drop.recipients?.length){
        const names=drop.recipients.map(r=>r.nick+' '+formatAtomic(r.amount)+' PEP').join(' · ')+(drop.count>12?' · +'+(drop.count-12)+' more':'');
        if(drop.recipients.length>3)card.append(n('details',{class:'haze-group-details'},n('summary',{},'Recipients ('+drop.count+')'),n('p',{class:'haze-group-names'},names)));
        else card.append(n('p',{class:'haze-group-names'},names));
      }
      if(drop.owner===currentUser()&&['open','ready','empty'].includes(drop.state)&&!drop.submitted_txid&&!flights.has(drop.id)){const cancel=n('button',{type:'button',class:'haze-group-cancel'},'Cancel event');cancel.onclick=async()=>{try{await rpc('gry_haze_group_cancel',{p_id:drop.id});await sync(true);}catch(e){status.textContent=e.message;}};card.append(cancel);}
      if(!(drop.state==='open'&&drop.joined))card.append(n('small',{class:'haze-drop-foot'},'Haze Wallet · no entry fee'));feed.append(card);
    }
    fit();
    if(clocks.length&&!ticker)ticker=setInterval(tick,1000);else if(!clocks.length){clearInterval(ticker);ticker=null;}
  }
  // "🎁 1 live · Join" beside the chat title: drops are visible without scrolling. A new drop makes it pulse
  // and posts a short notice ("Byl started a 1000 PEP airdrop"). Tapping opens the panel at the first live card.
  function paintChip(drops,me){
    const open=drops.filter(d=>d.state==='open'),joinable=open.filter(d=>!me||(d.owner!==me&&!d.joined&&d.eligible));
    const fresh=open.filter(d=>!seenOpen.has(d.id));for(const d of open)seenOpen.add(d.id);
    if(!firstRender)for(const d of fresh)if(d.owner!==me)ctx.notify?.('🎁 '+d.creator+' started '+(d.mode==='airdrop'?'a '+formatAtomic(d.total_atomic)+' PEP airdrop':d.mode==='trivia'?'a '+formatAtomic(d.total_atomic)+' PEP trivia round':'“'+d.title+'” for '+formatAtomic(d.total_atomic)+' PEP')+' · see Community drops under the chat',true);
    firstRender=false;
    if(!chip)return;chip.hidden=!open.length;
    chip.textContent='🎁 '+open.length+' live'+(joinable.length?' · Join':'');
    chip.classList?.toggle('is-joinable',joinable.length>0);
    if(fresh.length&&chip.classList){chip.classList.remove('is-new');void chip.offsetWidth;chip.classList.add('is-new');}
  }
  function showLive(){
    if(!panel)return;panel.open=true;panel.hidden=false;
    const card=feed?.querySelector('.is-joinable')||feed?.querySelector('.is-open');
    if(card){card.scrollIntoView?.({block:'nearest',behavior:'smooth'});card.classList.remove('haze-for-me');void card.offsetWidth;card.classList.add('haze-for-me');}
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
    const seconds=n('select',{'aria-label':'Round duration'});let lengths='';
    const paintLengths=()=>{const kind=mode.value==='airdrop'?'airdrop':mode.value==='word'?'word':'round';if(kind===lengths)return;lengths=kind;seconds.replaceChildren();
      const list=kind==='airdrop'?AIRDROP_MINUTES.map(m=>[String(m*60),m<60?m+' minutes':m===60?'1 hour':m/60+' hours ('+m+' min)']):kind==='word'?WORD_SECONDS.map(v=>[String(v),lengthLabel(v)]):[['15','15 seconds'],['60','1 minute'],['300','5 minutes']];
      for(const [value,label]of list)seconds.append(n('option',{value},label));seconds.value=kind==='airdrop'?'900':kind==='word'?'300':'60';};
    const winners=n('input',{type:'number',min:'1',max:'200',value:'1','aria-label':'Maximum winners'}),note=n('input',{type:'text',maxlength:'160','aria-label':'Group tip note',placeholder:'A little appreciation for the pond 💚'});
    const selected=n('div',{class:'haze-group-selection'});for(const member of data?.members||[])selected.append(n('label',{},n('input',{type:'checkbox',value:member.id}),member.nick+' · '+(member.online?'online':'away')));
    const fields={audience:n('label',{},'Eligible audience',audience),count:n('label',{},'How many random frens?',count),title:n('label',{},'Question / title',title),answer:n('label',{},'Answer / word',answer),seconds:n('label',{},'How long',seconds),winners:n('label',{},'Maximum winners',winners),selected};
    function update(){const timed=['airdrop','trivia','word'].includes(mode.value),game=['trivia','word'].includes(mode.value);paintLengths();
      fields.audience.hidden=!['random','airdrop','trivia','word'].includes(mode.value);fields.count.hidden=mode.value!=='random';fields.title.hidden=mode.value==='word';fields.answer.hidden=!game;fields.seconds.hidden=!timed;fields.winners.hidden=!game;selected.hidden=mode.value!=='selected';
      for(const field of Object.values(fields))for(const input of field.querySelectorAll('input,select'))input.disabled=field.hidden;
      submit.textContent=timed?'Start the round':'Preview recipients';hint.textContent=mode.value==='trivia'?'People answer in chat with /answer. One attempt each; first correct answers win. You approve the payout after the round.':mode.value==='word'?'The word is announced to chat. First matching replies win; each person can win once. Up to 6 hours, alongside a trivia round. Quick start in chat: /word ribbit 500 pepe 2h 5':mode.value==='airdrop'?'Linked frens join freely during the window, then you review the payout. The pool is split evenly. Quick start in chat: /airdrop 500 pepe 600m':'The total is split evenly, with exact smallest-unit rounding. Offline frens can receive PEP without coming online.';
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
  // /airdrop 500 pepe 600m: starts a timed airdrop for all linked frens at once. Nothing is paid now; the host
  // reviews and approves the payout in Haze when the time is up. Returns false (not /airdrop), 'opened' or 'error'.
  function command(text){
    let word;try{word=parseWordCommand(text);}catch(e){ctx.notify?.(e.message);return 'error';}
    if(word)return wordCommand(word);
    let parsed;try{parsed=parseAirdropCommand(text);}catch(e){ctx.notify?.(e.message);return 'error';}
    if(!parsed)return false;
    let total;try{total=amountAtomic(parsed.amount);}catch(e){ctx.notify?.(e.message);return 'error';}
    try{signed();}catch{return 'error';}
    const start=async()=>{
      try{
        if(!ctx.wallet()?.address)await ctx.refreshWallet();
        if(!ctx.wallet()?.address){await ctx.connect(()=>start());return;}
        await rpc('gry_haze_group_create',{p_options:{mode:'airdrop',audience:'all',total_atomic:total,seconds:parsed.minutes*60,title:parsed.title,note:''}});
        ctx.notify?.('🎉 Airdrop live: '+formatAtomic(total)+' PEP for '+(parsed.minutes>=60&&parsed.minutes%60===0?parsed.minutes/60+(parsed.minutes===60?' hour':' hours'):parsed.minutes+' min')+'. Frens press Join airdrop under the chat; you approve the payout in Haze when it ends.',true);
        await sync(true);
      }catch(e){ctx.notify?.(e.message);}
    };
    void start();return 'opened';
  }
  // /word ribbit 500 pepe 2h 5: a say-the-word round for all linked frens; the first 5 to type "ribbit" win.
  function wordCommand(parsed){
    let total;try{total=amountAtomic(parsed.amount);}catch(e){ctx.notify?.(e.message);return 'error';}
    try{signed();}catch{return 'error';}
    const start=async()=>{
      try{
        if(!ctx.wallet()?.address)await ctx.refreshWallet();
        if(!ctx.wallet()?.address){await ctx.connect(()=>start());return;}
        await rpc('gry_haze_group_create',{p_options:{mode:'word',audience:'all',total_atomic:total,seconds:parsed.seconds,winners:parsed.winners,answer:parsed.word,title:'',note:''}});
        ctx.notify?.('🎉 Say “'+parsed.word+'”: '+formatAtomic(total)+' PEP for the first '+(parsed.winners===1?'fren':parsed.winners+' frens')+', '+lengthLabel(parsed.seconds)+'. You approve the payout in Haze when it ends.',true);
        await sync(true);
      }catch(e){ctx.notify?.(e.message);}
    };
    void start();return 'opened';
  }
  win.addEventListener('message',receive);const visible=()=>{if(!doc.hidden)void sync(true);};doc.addEventListener('visibilitychange',visible);
  return {setWalletLoading(value){if(button)button.disabled=value;},mount(parent){button=n('button',{type:'button',class:'haze-wallet-link',onclick:()=>void open()},'🎉 Group tips');button.disabled=!!currentUser();parent.append(' ',button);
      help=n('button',{type:'button',class:'haze-wallet-link','aria-label':'Chat help',title:'Commands, drops and bug reports'},'?');
      help.onclick=()=>{const view=modal('Chat help');view.body.append(
        n('p',{},'Link your receiving wallet through Haze to receive PEP. '+(ctx.messageTips===false?'Tap a fren’s name and use 💚 Tip on their card to tip them.':'Use Tip beside a message to tip that fren.')),
        n('p',{},'/tip nick amount pepe [note] opens a tip review, e.g. /tip Lemon 500 pepe. /answer your answer enters a trivia round. For Say the word, type the displayed word.'),
        n('p',{},'/airdrop amount pepe minutes [title] starts a timed airdrop for all linked frens, e.g. /airdrop 500 pepe 600m (1 to 600 minutes).'),
        n('p',{},'/word word amount pepe [time] [winners] starts Say the word, e.g. /word ribbit 500 pepe 2h 5: the first 5 frens to type ribbit win (10 seconds to 6 hours, 1 winner by default). It can run alongside a trivia round (up to 5 minutes).'),
        n('p',{},'🎁 N live beside the chat title shows drops you can still join; tap it to jump to them. Cards you can join glow, and they turn orange in the last 5 minutes.'),
        n('p',{},'Timed airdrop: press 🎁 Join airdrop before the timer ends. Other group tips use the audience chosen by the host. Entry is free; eligibility and winner limits apply.'),
        n('p',{},'Guests can watch drops. To join, log on with Discord (one fren, one account) and link a receiving wallet through Haze. Discord sign-in keeps airdrops fair: wallets alone are free to make by the dozen.'),
        n('p',{},'The host approves payment in Haze after the round. Joining does not guarantee payment. Finished drops disappear from this panel after 30 minutes. Messages are up to 200 characters.'),
        n('a',{href:'https://github.com/PepecoinHub/pepecoinhub.github.io/issues/new?template=correction.yml',target:'_blank',rel:'noopener noreferrer'},'Report a bug'),
        n('small',{},'Include what happened, your browser and a screenshot. Never include wallet passwords, seed phrases or private keys.'));
      };
      chip=n('button',{type:'button',class:'haze-live-chip',hidden:true,title:'Live drops you can join'});chip.onclick=showLive;
      const log=ctx.chatLog?.();(log?.closest('.lan-win')?.querySelector('.lan-top')||parent).append(chip,help);void sync(true);},sync,open,command,destroy(){stopped=true;save();clearTimeout(timer);clearTimeout(expiryTimer);clearInterval(ticker);win.removeEventListener('message',receive);doc.removeEventListener('visibilitychange',visible);panel?.remove();help?.remove();chip?.remove();button?.remove();}};
}
