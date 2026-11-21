export const VERSION=1;
export const AUDIENCE='ph-community-v1';
export const RPC_FIELDS=Object.freeze({
 gry_me:[],gry_lobby_chat:['p_after','p_visitor'],gry_lobby_who:['p_visitor'],gry_lobby_say:['p_text','p_nick'],
 gry_haze_status:[],gry_haze_link_begin:[],gry_haze_chat:['p_messages'],gry_haze_tip_begin:['p_message','p_amount','p_reaction','p_note'],
 gry_haze_groups:[],gry_haze_group_create:['p_options'],gry_haze_group_join:['p_id'],gry_haze_group_review:['p_id'],gry_haze_group_cancel:['p_id'],
});
export const only=(value,keys)=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>keys.includes(key));
export const credential=(value,prefix)=>typeof value==='string'&&new RegExp('^'+prefix+'[A-Za-z0-9_-]{43}$').test(value);
export const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export const HASH=/^[a-f0-9]{64}$/;
const base64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export const secret=prefix=>prefix+base64(crypto.getRandomValues(new Uint8Array(32)));
export const sha256=async value=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
export const hash=async value=>Array.from(await sha256(value),byte=>byte.toString(16).padStart(2,'0')).join('');
export const challenge=async verifier=>base64(await sha256(verifier));
export async function boundedJSON(body,limit=32768){
 if(!body)throw Error('Missing request.');const reader=body.getReader(),chunks=[];let length=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>limit)throw Error('Request too large.');chunks.push(value);}}
 finally{await reader.cancel().catch(()=>{});}
 const bytes=new Uint8Array(length);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
