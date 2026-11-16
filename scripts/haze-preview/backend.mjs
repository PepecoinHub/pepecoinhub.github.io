// Served only by the loopback preview server; never imported by the public site.
const actor=window.PEP_HAZE_GROUPS_PREVIEW?Number(localStorage.getItem('haze-preview-actor')||1):1;
export const user={id:'00000000-0000-4000-8000-'+String(actor).padStart(12,'0'),is_anonymous:false};
async function post(path,body){
  const res=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-Preview-Actor':String(actor)},body:JSON.stringify(body)});
  const result=await res.json();if(!res.ok||result.error)throw Error(result.error||'Preview request failed.');return result.data??result;
}
export const previewBackend={
  kind:'supabase',session:()=>({user}),rpc:(fn,args={})=>post('/__preview/rpc',{fn,args}),haze:body=>post('/__preview/haze',body),
  channel(){return {send(){},close(){}};},
  async guest(){},async discord(){},async logout(){throw Error('This preview uses the disposable Lew account.');},
};
