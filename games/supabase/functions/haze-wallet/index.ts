import {handleHaze,boundedJSON,accessList} from './handler.mjs';

const sb=Deno.env.get('SUPABASE_URL')||'';
const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const configured=Deno.env.get('PEP_BLOCKBOOK_URL')||'';
const allowed=accessList(Deno.env.get('HAZE_ACCESS'));
let indexer: URL|null=null;
try {const url=new URL(configured);if(url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash&&url.pathname==='/')indexer=url;}catch{}

async function read(url: string,init: RequestInit={}) {
  const response=await fetch(url,{...init,redirect:'error',signal:AbortSignal.any([init.signal||AbortSignal.timeout(25000),AbortSignal.timeout(10000)])});
  if(!response.ok)throw Error('The payment reader or account service is unavailable. Keep your transaction ID and try again later.');
  return boundedJSON(response.body,2000000);
}
Deno.serve((req:Request)=>{
  if(!service||!sb||!indexer)return new Response(JSON.stringify({error:'Haze tipping is not configured yet.'}),{status:503,headers:{'Content-Type':'application/json'}});
  const budget=AbortSignal.timeout(25000);
  const requestRead=(url:string,init:RequestInit={})=>read(url,{...init,signal:budget});
  const rpc=(name:string,args:Record<string,unknown>)=>requestRead(sb+'/rest/v1/rpc/'+name,{
    method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},body:JSON.stringify(args)});
  return handleHaze(req,{
    allowed,
    authenticate:(token:string)=>requestRead(sb+'/auth/v1/user',{headers:{apikey:service,Authorization:'Bearer '+token}}),rpc,
    readGenesis:async()=>{const block=await requestRead(indexer!.href+'api/v2/block/0');return block.hash;},
    readTx:(txid:string)=>requestRead(indexer!.href+'api/v2/tx/'+txid),
  });
});
