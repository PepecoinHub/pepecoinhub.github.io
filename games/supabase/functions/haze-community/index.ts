import {createCommunityHandler} from './handler.mjs';
import {verifyWalletProof,verifyTipTransaction,verifyGroupTransaction,PEP_GENESIS} from '../haze-wallet/core.mjs';
import {boundedJSON} from './contract.mjs';
// These credentials remain exclusively on PH's Supabase Edge runtime.
const project=Deno.env.get('SUPABASE_URL')||'',service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
let indexer:URL|null=null;
try{const value=new URL(Deno.env.get('PEP_BLOCKBOOK_URL')||'');if(value.protocol==='https:'&&!value.username&&!value.password&&!value.search&&!value.hash&&value.pathname==='/')indexer=value;}catch{}
async function read(url:string,init:RequestInit={}){
 const response=await fetch(url,{...init,redirect:'error',signal:AbortSignal.any([init.signal||AbortSignal.timeout(10000),AbortSignal.timeout(10000)])});
 const result=await boundedJSON(response.body,2000000);
 if(!response.ok)throw Error(typeof result.message==='string'?result.message:'PH account service or payment reader is unavailable.');
 return result;
}
const handler=createCommunityHandler({
 rpc:(name:string,args:unknown,signal:AbortSignal)=>read(project+'/rest/v1/rpc/'+name,{method:'POST',signal,headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},body:JSON.stringify({p_args:args})}),
 authenticate:(token:string,signal:AbortSignal)=>read(project+'/auth/v1/user',{signal,headers:{apikey:service,Authorization:'Bearer '+token}}),
 verification:{verifyWalletProof,verifyTipTransaction,verifyGroupTransaction,PEP_GENESIS,
  readGenesis:async(signal:AbortSignal)=>{if(!indexer)throw Error('The PH payment reader is not configured.');return (await read(indexer.href+'api/v2/block/0',{signal})).hash;},
  readTx:(txid:string,signal:AbortSignal)=>{if(!indexer)throw Error('The PH payment reader is not configured.');return read(indexer.href+'api/v2/tx/'+txid,{signal});},
 },
});
Deno.serve((req:Request)=>{
 if(!project||!service)return new Response(JSON.stringify({error:'Community is not configured.'}),{status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 return handler(req);
});
