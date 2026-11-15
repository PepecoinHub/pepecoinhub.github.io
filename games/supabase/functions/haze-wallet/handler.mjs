import {verifyWalletProof,verifyTipTransaction,exact,isHash,isUUID,PEP_GENESIS} from './core.mjs';
const ORIGIN='https://pepecoinhub.com';
const headers={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin','Cache-Control':'no-store','Content-Type':'application/json'};
const json=(status,value)=>new Response(JSON.stringify(value),{status,headers});
export async function boundedJSON(body,limit=16384) {
  if(!body) throw Error('Missing body.');
  const reader=body.getReader();let size=0;const chunks=[];
  try {for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit)throw Error('Request too large.');chunks.push(value);}}
  finally {await reader.cancel().catch(()=>{});}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
export async function handleHaze(req,{authenticate,rpc,readTx,readGenesis,now=()=>Date.now()}) {
  if(req.headers.get('origin')!==ORIGIN)return json(403,{error:'This integration is for PepecoinHub.'});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return json(405,{error:'POST required.'});
  const token=/^Bearer ([A-Za-z0-9._-]{16,8192})$/.exec(req.headers.get('authorization')||'')?.[1];
  if(!token)return json(401,{error:'Sign in with Discord first.'});
  let user;
  try {user=await authenticate(token);}catch{return json(401,{error:'Sign in again to continue.'});}
  if(!user||user.is_anonymous||!user.identities?.some(identity=>identity.provider==='discord'))return json(403,{error:'A Discord-linked account is required.'});
  try {
    const body=await boundedJSON(req.body);
    if(exact(body,['action','proof'])&&body.action==='link') {
      if(typeof body.proof?.nonce!=='string'||!/^[a-f0-9]{64}$/.test(body.proof.nonce))throw Error('Invalid wallet-link request.');
      const challenge=await rpc('haze_link_context',{p_user:user.id,p_nonce:body.proof.nonce});
      const address=verifyWalletProof(body.proof,challenge,now());
      return json(200,await rpc('haze_link_finish',{p_user:user.id,p_nonce:challenge.nonce,p_address:address}));
    }
    if(!exact(body,['action','intent','txid'])||body.action!=='check'||!isUUID(body.intent)||!isHash(body.txid))throw Error('Invalid tip request.');
    const intent=await rpc('haze_tip_context',{p_user:user.id,p_intent:body.intent,p_txid:body.txid});
    if(intent.confirmed)return json(200,{id:body.intent,state:'confirmed',txid:body.txid});
    if(await readGenesis()!==PEP_GENESIS)throw Error('The payment reader is not Pepecoin mainnet.');
    const result=await verifyTipTransaction(intent,await readTx(body.txid),readTx);
    if(result.state==='pending')return json(200,{id:body.intent,txid:body.txid,...result});
    return json(200,await rpc('haze_tip_confirm',{p_user:user.id,p_intent:body.intent,p_txid:body.txid,p_vout:result.vout,p_block:result.block,p_time:result.time}));
  }catch(error){return json(400,{error:error instanceof Error?error.message:'The tip could not be checked. Keep the transaction ID; do not send again.'});}
}
