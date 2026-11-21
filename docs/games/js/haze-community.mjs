// This file is hosted by PH. The full Supabase session never leaves PH's
// origin/account service. Only a PKCE-bound community code returns to Haze.
const KEY='ph-community-consent-v1',cfg=window.PEP_GRY||{},status=document.getElementById('status'),error=document.getElementById('error');
const consent=document.getElementById('consent'),signin=document.getElementById('signin'),approve=document.getElementById('approve'),cancel=document.getElementById('cancel');
const names={'profile:read':'Read your public community identity','chat:read':'Read pond chat and presence','chat:write':'Post messages as you, subject to PH moderation','wallet:link':'Link your public PEP receiving address','tips:read':'Read and verify tip receipts','tips:write':'Create fixed tip requests for your approval','groups:read':'Read rounds and group receipts','groups:write':'Start or join rounds and prepare group payouts'};
let pending=null,account=null,description=null,sb;
const nativeRedirect='https://hazewallet.com/app/community-auth';
const redirectOK=(client,raw)=>client==='haze-web'?raw==='https://hazewallet.com/community-auth.html':client==='haze-native'?raw===nativeRedirect:client==='haze-chrome'&&/^https:\/\/[a-p]{32}\.chromiumapp\.org\/community-auth$/.test(raw||'');
function loadPending(){
 const url=new URL(location.href),fields=['client_id','redirect_uri','state','code_challenge','code_challenge_method'];
 if(url.searchParams.has('client_id')){
  if([...url.searchParams.keys()].some((key,index,all)=>!fields.includes(key)||all.indexOf(key)!==index))throw Error('Unsupported consent request.');
  const value=Object.fromEntries(fields.map(key=>[key,url.searchParams.get(key)]));
  if(!redirectOK(value.client_id,value.redirect_uri)||!/^[A-Za-z0-9_-]{43}$/.test(value.state||'')||!/^[A-Za-z0-9_-]{43}$/.test(value.code_challenge||'')||value.code_challenge_method!=='S256')throw Error('Invalid community client or PKCE request.');
  sessionStorage.setItem(KEY,JSON.stringify({...value,createdAt:Date.now()}));history.replaceState(null,'','/games/haze-community.html');
 }
 try{pending=JSON.parse(sessionStorage.getItem(KEY)||'null');}catch{}
 if(pending&&(Date.now()-pending.createdAt<0||Date.now()-pending.createdAt>300000||!redirectOK(pending.client_id,pending.redirect_uri))){sessionStorage.removeItem(KEY);pending=null;}
}
async function api(body,authenticated=false){
 const endpoint=new URL('/functions/v1/haze-community',cfg.supabaseUrl);
 if(endpoint.origin!=='https://azbwciqfbsdpwubznncg.supabase.co')throw Error('Unsupported PH account service.');
 const session=authenticated?(await sb.auth.getSession()).data.session:null;
 if(authenticated&&!session?.access_token)throw Error('Sign in on PepecoinHub first.');
 const response=await fetch(endpoint,{method:'POST',credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(18000),headers:{apikey:cfg.supabaseKey,'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.access_token}:{})},body:JSON.stringify({version:1,...body})});
 const value=await response.json();if(!response.ok)throw Error(value.error||'PH declined this community request.');return value;
}
async function connections(){
 const host=document.getElementById('sessions');host.replaceChildren();if(!account){host.textContent='Sign in to see and revoke connections.';return;}
 for(const item of await api({action:'connections'},true)){
  const card=document.createElement('div');card.className='session';const text=document.createElement('p');text.textContent=item.label+' · expires '+new Date(item.expires_at).toLocaleString();
  const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent='Revoke '+item.label;button.onclick=async()=>{button.disabled=true;try{await api({action:'connections',revoke_id:item.id},true);await connections();status.textContent='Community access revoked.';}catch(problem){error.textContent=problem.message;button.disabled=false;}};
  card.append(text,button);host.append(card);
 }
 if(!host.childElementCount)host.textContent='No active community connections.';
}
async function paint(){
 error.textContent='';const session=(await sb.auth.getSession()).data.session;account=session?.user&&!session.user.is_anonymous?session.user:null;
 signin.hidden=!!account;consent.hidden=true;description=null;
 if(pending){
  description=await api({action:'describe',client_id:pending.client_id,redirect_uri:pending.redirect_uri});
  if(description.redirect_uri!==pending.redirect_uri||description.client_id!==pending.client_id||description.version!==1)throw Error('PH returned a different community client.');
  document.getElementById('client-name').textContent=description.label;
  const list=document.getElementById('permissions');list.replaceChildren();for(const scope of description.scopes){if(!Object.hasOwn(names,scope))throw Error('Unknown permission; this client needs review.');const li=document.createElement('li');li.textContent=names[scope];list.append(li);}
  consent.hidden=!account;status.textContent=account?'Review the limited permissions before connecting.':'Sign in on PH, then review limited community access.';
 }else status.textContent='Manage your community connections here. Start a new connection from Haze when ready.';
 await connections();
}
signin.onclick=async()=>{
 signin.disabled=true;error.textContent='';try{
  // Reuse PH's existing guest-to-Discord account-link behavior; no new Haze
  // redirect is added to Supabase Auth. OAuth always returns to this PH page.
  const {startOAuth}=await import('./backend.js');const session=(await sb.auth.getSession()).data.session;
  await startOAuth(sb,session,'discord',location.origin+'/games/haze-community.html',sessionStorage);
 }catch(problem){error.textContent=problem.message;signin.disabled=false;}
};
function returnToClient(value){
 const target=new URL(pending.redirect_uri);
 const params=new URLSearchParams({state:pending.state,...value});
 sessionStorage.removeItem(KEY);
 if(pending.client_id==='haze-native'){
  // A user-tapped HTTPS link gives the OS a chance to open the verified app.
  // The fragment keeps the one-use code out of the fallback HTTP request.
  target.hash=params.toString();
  const handoff=document.getElementById('native-return');
  const link=document.getElementById('open-haze-app');
  link.href=target.href;
  consent.hidden=true;
  handoff.hidden=false;
  status.textContent=value.code?'Community access approved.':'Community access declined.';
  link.focus();
 }else{
  target.search=params.toString();
  location.replace(target.href);
 }
 pending=null;
}
approve.onclick=async()=>{
 approve.disabled=true;cancel.disabled=true;error.textContent='';try{
  if(!pending||!description||Date.now()-pending.createdAt>300000)throw Error('Connection expired. Start again from Haze.');
  const result=await api({action:'authorize',client_id:pending.client_id,redirect_uri:pending.redirect_uri,code_challenge:pending.code_challenge,code_challenge_method:'S256',scopes:description.scopes},true);
  if(result.redirect_uri!==pending.redirect_uri||!/^phcode1_[A-Za-z0-9_-]{43}$/.test(result.code||''))throw Error('Invalid limited community code.');
  returnToClient({code:result.code});
 }catch(problem){error.textContent=problem.message;approve.disabled=false;cancel.disabled=false;}
};
cancel.onclick=()=>{if(pending)returnToClient({error:'denied'});};
try{
 if(window.parent!==window)throw Error('Open PH community consent in its own browser window.');
 loadPending();
 sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}});
 await sb.auth.getSession();
 history.replaceState(null,'','/games/haze-community.html');await paint();
}catch(problem){status.textContent='Community connection unavailable.';error.textContent=problem.message;}
