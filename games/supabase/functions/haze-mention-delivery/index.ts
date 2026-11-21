// Supabase Edge Function. JWT verification off; only requests signed by the Haze sender are accepted.
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
  const r=await fetch(base+'/rest/v1/rpc/haze_mention_delivery',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({p_args:args})});
  return r.ok?new Response(r.body,{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}}):new Response(null,{status:503});
 }catch{return new Response(null,{status:400});}
});
