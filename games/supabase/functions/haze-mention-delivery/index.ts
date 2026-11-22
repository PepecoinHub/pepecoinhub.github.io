// Supabase Edge Function. JWT verification off; only requests signed by the Haze sender are accepted.
// Adaptive polling (2026-11-22): every "take" reply carries X-Haze-Poll-After (seconds) and Retry-After so the
// Haze worker can slow down to ~60 s while the queue is empty and speed up while it is draining. The body stays
// exactly what the worker already parses (a JSON array for "take", {} for "finish"); old workers that ignore the
// header keep working unchanged.
import { pollAfter } from './poll.mjs';
const base=Deno.env.get('SUPABASE_URL')!, key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const publicKey=Deno.env.get('HAZE_MENTION_WORKER_PUBLIC_KEY')||'';
const decode=(v:string)=>Uint8Array.from(atob(v.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
Deno.serve(async req=>{
 const stamp=req.headers.get('x-haze-time')||'',sig=req.headers.get('x-haze-signature')||'';
 if(req.method!=='POST'||!/^\d{13}$/.test(stamp)||Math.abs(Date.now()-Number(stamp))>45000||!/^[A-Za-z0-9_-]{86}$/.test(sig)||!/^[A-Za-z0-9_-]{43}$/.test(publicKey))return new Response(null,{status:403});
 if(!req.body)return new Response(null,{status:400});
 const reader=req.body.getReader(),bytes=new Uint8Array(2048);let used=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;if(used+value.length>2048)return new Response(null,{status:413});bytes.set(value,used);used+=value.length;}}finally{await reader.cancel().catch(()=>{});}
 const content=new TextDecoder().decode(bytes.subarray(0,used));
 const verify=await crypto.subtle.importKey('raw',decode(publicKey),'Ed25519',false,['verify']);
 if(!await crypto.subtle.verify('Ed25519',verify,decode(sig),new TextEncoder().encode(stamp+'.'+content)))return new Response(null,{status:403});
 try{
  const args=JSON.parse(content);
  if(!['take','finish'].includes(args.action))return new Response(null,{status:400});
  // hint:true asks update_haze_mentions_adaptive.sql for {items,poll_after}; the old SQL ignores it and returns the array.
  const rpcArgs=args.action==='take'?{...args,hint:true}:args;
  const r=await fetch(base+'/rest/v1/rpc/haze_mention_delivery',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({p_args:rpcArgs})});
  if(!r.ok)return new Response(null,{status:503,headers:{'Retry-After':'30','X-Haze-Poll-After':'30'}});
  const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store'};
  if(args.action!=='take')return new Response(r.body,{headers});
  const {body,seconds}=pollAfter(await r.json());
  headers['X-Haze-Poll-After']=String(seconds);headers['Retry-After']=String(seconds);
  return new Response(JSON.stringify(body),{headers});
 }catch{return new Response(null,{status:400});}
});
