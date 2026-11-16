// Public payment recovery only. No keys, password, signature or signed raw tx.
const TTL=3*60*60*1000,LIMIT=128;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,HASH=/^[a-f0-9]{64}$/,ADDRESS=/^P[1-9A-HJ-NP-Za-km-z]{33}$/;
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
function identity(input){
 if(!exact(input,['intent','sender','payments'])||!UUID.test(input.intent)||!ADDRESS.test(input.sender)||!Array.isArray(input.payments)||input.payments.length<1||input.payments.length>200)throw Error('Invalid payment recovery identity.');
 const seen=new Set();let total=0n;
 const payments=input.payments.map(p=>{if(!exact(p,['address','amount'])||!ADDRESS.test(p.address)||p.address===input.sender||seen.has(p.address)||typeof p.amount!=='string'||!/^[1-9][0-9]{0,13}$/.test(p.amount)||BigInt(p.amount)<100000000n)throw Error('Invalid recovery payment.');seen.add(p.address);total+=BigInt(p.amount);return {address:p.address,amount:p.amount};});
 if(total>10000000000000n)throw Error('Invalid recovery payment total.');return {intent:input.intent,sender:input.sender,payments};
}
const unavailable=()=>Error('Payment recovery storage is unavailable. Open Haze Wallet and restore browser storage before approving a tip.');
function browserStore(){
 let database;
 const open=()=>database||=(new Promise((resolve,reject)=>{
  let request;try{request=globalThis.indexedDB.open('haze_pepecoinhub_payment_recovery_v1',1);}catch{return reject(unavailable());}
  request.onupgradeneeded=()=>request.result.createObjectStore('attempts');request.onerror=request.onblocked=()=>reject(unavailable());
  request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>db.close();resolve(db);};
 })).catch(error=>{database=null;throw error;});
 return {async transact(mode,transform){
  const db=await open();return new Promise((resolve,reject)=>{
   let tx,value,failure;try{try{tx=db.transaction('attempts',mode,{durability:'strict'});}catch{tx=db.transaction('attempts',mode);}}catch{return reject(unavailable());}
   tx.oncomplete=()=>resolve(value);tx.onabort=tx.onerror=()=>reject(failure||unavailable());
   const store=tx.objectStore('attempts'),request=store.getAll(undefined,LIMIT+1);
   request.onsuccess=()=>{try{const result=transform(request.result);value=result.value;if(result.rows){store.clear();for(const row of result.rows)store.put(row,row.payment.intent);}}catch(error){failure=error;tx.abort();}};
  });
 }};
}
export function createTipJournal({storage=browserStore(),now=()=>Date.now()}={}){
 function read(rows){
  try{if(!Array.isArray(rows)||rows.length>LIMIT)throw unavailable();const seen=new Set();for(const row of rows){if(!exact(row,['payment','txid','at'])||!HASH.test(row.txid)||!Number.isSafeInteger(row.at)||row.at<=0||row.at>now()+30000||seen.has(row.payment?.intent))throw unavailable();identity(row.payment);seen.add(row.payment.intent);}return rows.filter(row=>now()-row.at<TTL);}catch{throw unavailable();}
 }
 function find(rows,payment){const row=rows.find(r=>r.payment.intent===payment.intent);if(row&&JSON.stringify(row.payment)!==JSON.stringify(payment))throw Error('This payment intent already has different approved details. Follow the original payment in chat.');return row;}
 return Object.freeze({
  async lookup(input){const payment=identity(input);return storage.transact('readonly',raw=>({value:find(read(raw),payment)?.txid||null}));},
  async record(input,txid){
   const payment=identity(input);if(!HASH.test(txid))throw Error('Invalid recovery transaction ID.');
   // One IndexedDB read/write transaction serializes all tabs and intents.
   // Resolve only after commit; failed persistence never authorizes broadcast.
   return storage.transact('readwrite',raw=>{const rows=read(raw),old=find(rows,payment);if(old)return {value:{txid:old.txid,created:false}};if(rows.length>=LIMIT)throw Error('Too many recent payment attempts. Wait for pending tips before approving another.');return {rows:[...rows,{payment,txid,at:now()}],value:{txid,created:true}};});
  },
 });
}
