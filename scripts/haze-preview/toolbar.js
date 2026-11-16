const wallet='http://127.0.0.1:18921';
const bar=document.createElement('aside');bar.className='preview-bar';bar.setAttribute('aria-label','Local preview controls');
bar.innerHTML=`<div><b>LOCAL PLAYGROUND · synthetic PEP</b><span>Real chat + Haze UI · simulated Discord and network · no real funds</span></div><nav><a href="/">Test guide</a><a href="${wallet}/__preview/setup">1. Prepare test wallet</a><button type="button" id="preview-stamps">Passport stamps: loading…</button></nav><small>2. Link Haze in chat → 3. Tip Byl → unlock with <strong>HazePreview!2026</strong> → review fee and confirm. Demo confirmations take about 20 seconds.</small>`;
document.body.prepend(bar);
const refresh=async()=>{
  try{const s=await(await fetch('/__preview/state')).json();document.querySelector('#preview-stamps').textContent='Passport: '+(s.badges.length?s.badges.map(x=>x==='haze_linked'?'◇ Haze Linked':'💚 First Tip').join(' · '):'no Haze stamps yet');}catch{}
};
document.querySelector('#preview-stamps').onclick=refresh;void refresh();setInterval(refresh,4000);
const reset=document.createElement('button');reset.type='button';reset.textContent='Reset demo';
reset.onclick=async()=>{reset.disabled=true;try{const r=await fetch('/__preview/reset',{method:'POST'});if(!r.ok)throw Error('Reset failed.');location.href=wallet+'/__preview/setup';}catch(e){reset.textContent=e.message;reset.disabled=false;}};
bar.querySelector('nav').append(reset);
if(window.PEP_HAZE_GROUPS_PREVIEW){
  bar.querySelector('small').textContent='Link as Lew (host), then choose Group tips. Use Demo member to join an airdrop or answer in chat; return to Lew to review and approve the payout. All PEP here is simulated. Password: HazePreview!2026';
  const label=document.createElement('label');label.textContent='Demo member: ';
  const select=document.createElement('select');select.setAttribute('aria-label','Demo member');
  for(const [id,name]of [[1,'Lew (host)'],[2,'Byl'],[3,'Mika (unlinked)'],[4,'Jules'],[5,'Pip (away)'],[6,'Nova (away)'],[7,'Zeph (away)']]){const option=document.createElement('option');option.value=id;option.textContent=name;select.append(option);}
  select.value=localStorage.getItem('haze-preview-actor')||'1';select.onchange=()=>{localStorage.setItem('haze-preview-actor',select.value);location.reload();};label.append(select);bar.querySelector('nav').append(label);
}
