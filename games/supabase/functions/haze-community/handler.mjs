import {VERSION,AUDIENCE,RPC_FIELDS,only,credential,UUID,HASH,secret,hash,challenge,boundedJSON} from './contract.mjs';

// The only endpoint accepting PH Supabase JWTs is the PH-origin consent/account
// route. Every Haze operation requires a non-JWT opaque community credential.
/**
 * @param {{rpc:(name:string,args:Record<string,unknown>,signal:AbortSignal)=>Promise<any>,
 * authenticate:(token:string,signal:AbortSignal)=>Promise<any>,
 * verification?:any,hubOrigin?:string}} options
 */
export function createCommunityHandler({rpc:rawRPC,authenticate,verification,hubOrigin='https://pepecoinhub.com'}){
 let inFlight=0;
 return async function handle(req){
  const origin=req.headers.get('origin')||'';
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
  const json=(status,value)=>new Response(JSON.stringify(value),{status,headers});
  if(inFlight>=24)return json(503,{error:'Community is busy. Try again shortly.'});inFlight++;
  const budget=AbortSignal.any([req.signal,AbortSignal.timeout(25000)]),rpc=(name,args)=>rawRPC(name,args,budget);
  try{
   // Origin is a browser boundary, not authentication. Tokens are independently
   // scoped, owner-bound and checked in PH's database on every operation.
   const permitted=origin===hubOrigin||await rpc('community_v1_origin',{origin});
   if(!permitted)return json(403,{error:'This Community origin is not registered.'});
   Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Max-Age':'300'});
   if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
   if(req.method!=='POST'||new URL(req.url).search)return json(400,{error:'POST with no query parameters is required.'});
   const body=await boundedJSON(req.body);if(body?.version!==VERSION)return json(400,{error:'Unsupported Community version.'});
   const firstParty=['describe','authorize','connections'].includes(body.action);
   let user;
   if(firstParty){
    if(origin!==hubOrigin)return json(403,{error:'Connect and manage community access on PepecoinHub.'});
    if(body.action!=='describe'){
     const full=/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(req.headers.get('authorization')||'')?.[1];
     if(!full||full.length>8192)return json(401,{error:'Sign in on PepecoinHub.'});
     try{user=await authenticate(full,budget);}catch{}
     if(!user||!UUID.test(user.id)||user.is_anonymous||!user.identities?.some(item=>item.provider==='discord'))return json(401,{error:'Sign in with Discord on PepecoinHub.'});
    }
   }
   if(body.action==='describe'||body.action==='authorize'){
    const fields=['version','action','client_id','redirect_uri',...(body.action==='authorize'?['code_challenge','code_challenge_method','scopes']:[])];
    if(!only(body,fields)||typeof body.client_id!=='string'||!/^[a-z][a-z0-9-]{2,40}$/.test(body.client_id)||typeof body.redirect_uri!=='string'||body.redirect_uri.length>250)return json(400,{error:'Invalid community client.'});
    if(body.action==='describe')return json(200,await rpc('community_v1_describe',{client_id:body.client_id,redirect_uri:body.redirect_uri}));
    if(body.code_challenge_method!=='S256'||!/^[A-Za-z0-9_-]{43}$/.test(body.code_challenge||'')||!Array.isArray(body.scopes)||body.scopes.length>8||body.scopes.some(item=>typeof item!=='string'||item.length>30))return json(400,{error:'PKCE S256 and the reviewed community permissions are required.'});
    const code=secret('phcode1_'),result=await rpc('community_v1_authorize',{user_id:user.id,client_id:body.client_id,redirect_uri:body.redirect_uri,challenge:body.code_challenge,code_hash:await hash(code),scopes:body.scopes});
    return json(200,{version:VERSION,code,redirect_uri:result.redirect_uri,expires_in:result.expires_in});
   }
   if(body.action==='connections'){
    if(!only(body,['version','action','revoke_id'])||(body.revoke_id!==undefined&&!UUID.test(body.revoke_id)))return json(400,{error:'Invalid connection management request.'});
    return json(200,await rpc('community_v1_app_connections',{user_id:user.id,...(body.revoke_id?{revoke_id:body.revoke_id}:{})}));
   }
   if(body.action==='exchange'||body.action==='refresh'){
    let result;const access=secret('phc1_'),refresh=secret('phr1_');
    if(body.action==='exchange'){
     const device=body.installation_id;
     if(device!==undefined && (body.client_id!=='haze-native'||typeof device!=='string'||!UUID.test(device)))return json(400,{error:'Invalid mobile installation.'});
     if(!only(body,['version','action','client_id','redirect_uri','code','code_verifier','installation_id'])||!credential(body.code,'phcode1_')||!/^[A-Za-z0-9_-]{43}$/.test(body.code_verifier||'')||typeof body.client_id!=='string'||typeof body.redirect_uri!=='string')return json(400,{error:'Invalid community code exchange.'});
     result=await rpc(device?'community_v1_exchange_device':'community_v1_exchange',{...(device?{installation_id:device}:{}),origin,client_id:body.client_id,redirect_uri:body.redirect_uri,code_hash:await hash(body.code),challenge:await challenge(body.code_verifier),access_hash:await hash(access),refresh_hash:await hash(refresh)});
    }else{
     if(!only(body,['version','action','refresh_token'])||!credential(body.refresh_token,'phr1_'))return json(401,{error:'A limited community refresh credential is required.'});
     result=await rpc('community_v1_refresh',{origin,refresh_hash:await hash(body.refresh_token),access_hash:await hash(access),next_refresh_hash:await hash(refresh)});
     if(result.invalid)return json(401,{error:'Community connection expired or was revoked. Reconnect on PepecoinHub.'});
    }
    return json(200,{version:VERSION,audience:AUDIENCE,token_type:'Bearer',access_token:access,refresh_token:refresh,expires_in:result.expires_in,session_expires_at:result.session_expires_at,scope:result.scopes,user:{id:result.user_id}});
   }
   if(body.action==='revoke'){
    if(!only(body,['version','action','refresh_token'])||!credential(body.refresh_token,'phr1_'))return json(400,{error:'A limited community refresh credential is required.'});
    return json(200,await rpc('community_v1_revoke',{origin,refresh_hash:await hash(body.refresh_token)}));
   }
   const access=/^Bearer (phc1_[A-Za-z0-9_-]{43})$/.exec(req.headers.get('authorization')||'')?.[1];
   if(!access)return json(401,{error:'Use a limited community token. PH account sessions are not accepted here.'});
   const accessHash=await hash(access);
   if(body.action==='rpc'){
    if(!only(body,['version','action','method','args'])||!Object.hasOwn(RPC_FIELDS,body.method)||!only(body.args||{},RPC_FIELDS[body.method]))return json(403,{error:'Method or arguments are outside community-v1.'});
    if(body.method==='gry_haze_chat'&&(!Array.isArray(body.args?.p_messages)||body.args.p_messages.length>120||body.args.p_messages.some(id=>!Number.isSafeInteger(id)||id<0)))return json(400,{error:'Invalid message batch.'});
    const method=body.method==='gry_haze_mentions'?'community_v1_mentions':'community_v1_rpc';
    const result=await rpc(method,{origin,access_hash:accessHash,method:body.method,args:body.args||{}});
    const failure=result?.__community_error||result?.error;
    return typeof failure==='string'?json(400,{error:failure.slice(0,240)}):json(200,result);
   }
   if(body.action==='verify'){
    if(!only(body,['version','action','request'])||!verification)return json(400,{error:'Unsupported community verification request.'});
    const input=body.request;
    const call=async(method,args)=>{const result=await rpc('community_v1_verify',{origin,access_hash:accessHash,method,args});if(typeof result?.__community_error==='string')throw Error(result.__community_error);return result;};
    if(only(input,['action','proof'])&&input.action==='link'&&typeof input.proof?.nonce==='string'&&HASH.test(input.proof.nonce)){
     const pending=await call('haze_link_context',{p_nonce:input.proof.nonce});
     const address=verification.verifyWalletProof(input.proof,pending);
     return json(200,await call('haze_link_finish',{p_nonce:pending.nonce,p_address:address}));
    }
    if(!only(input,['action','intent','txid'])||!['check','group-check'].includes(input.action)||!UUID.test(input.intent||'')||!HASH.test(input.txid||''))return json(400,{error:'Invalid fixed tip verification request.'});
    const group=input.action==='group-check',pending=await call(group?'haze_group_context':'haze_tip_context',{p_intent:input.intent,p_txid:input.txid});
    if(pending.confirmed)return json(200,{id:input.intent,state:'confirmed',txid:input.txid});
    if(await verification.readGenesis(budget)!==verification.PEP_GENESIS)throw Error('The payment reader is not Pepecoin mainnet.');
    const readTx=txid=>verification.readTx(txid,budget);
    const checked=await (group?verification.verifyGroupTransaction:verification.verifyTipTransaction)(pending,await readTx(input.txid),readTx);
    if(checked.state==='pending')return json(200,{id:input.intent,txid:input.txid,...checked});
    return json(200,await call(group?'haze_group_confirm':'haze_tip_confirm',{p_intent:input.intent,p_txid:input.txid,...(group?{}:{p_vout:checked.vout}),p_block:checked.block,p_time:checked.time}));
   }
   return json(400,{error:'Action is outside community-v1.'});
  }catch(error){
   // No request/token/body logging. Database errors are user-facing policy
   // messages, never the upstream PostgREST envelope or service credentials.
   const message=error instanceof Error?error.message:'Community request failed.';
   const expired=/token expired|token.*revoked|missing permission/i.test(message);
   return json(expired?401:400,{error:message.slice(0,240)});
  }finally{inFlight--;}
 };
}
