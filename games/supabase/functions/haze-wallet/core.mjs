import {secp256k1} from '@noble/curves/secp256k1.js';
import {sha256} from '@noble/hashes/sha2.js';
import {ripemd160} from '@noble/hashes/legacy.js';
import {base58check} from '@scure/base';
import {validateChallenge, authMessage, HUB_ORIGIN} from './protocol.mjs';

export const PEP_GENESIS = '37981c0c48b8d48965376c8a42ece9a0838daadb93ff975cb091f57f8c2a5faa';
export const isHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export const isUUID = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
export const exact = (value, keys) => !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value,key));
const fail = message => {throw new Error(message);};
const hex = bytes => [...bytes].map(byte=>byte.toString(16).padStart(2,'0')).join('');
const unhex = text => Uint8Array.from(text.match(/../g),byte=>parseInt(byte,16));
const base58 = base58check(sha256);

export function pepScript(address) {
  if(typeof address!=='string'||!/^P[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) fail('Invalid native Pepecoin address.');
  const decoded=base58.decode(address);
  if(decoded.length!==21||decoded[0]!==0x38) fail('Wrong receiving network.');
  return '76a914'+hex(decoded.slice(1))+'88ac';
}

export function verifyWalletProof(proof,challenge,now=Date.now()) {
  validateChallenge(challenge,{origin:HUB_ORIGIN,now});
  if(!exact(proof,[...Object.keys(challenge),'address','publicKey','signature'])||
      Object.keys(challenge).some(key=>proof[key]!==challenge[key])||
      typeof proof.publicKey!=='string'||!/^(02|03)[a-f0-9]{64}$/.test(proof.publicKey)||
      typeof proof.signature!=='string'||!/^[a-f0-9]{128}$/.test(proof.signature)) fail('Invalid wallet ownership proof.');
  pepScript(proof.address);
  const publicKey=unhex(proof.publicKey),derived=base58.encode(Uint8Array.from([0x38,...ripemd160(sha256(publicKey))]));
  if(derived!==proof.address||!secp256k1.verify(unhex(proof.signature),sha256(new TextEncoder().encode(authMessage(challenge,proof.address))),publicKey,{prehash:false,lowS:true})) fail('Wallet ownership could not be verified.');
  return proof.address;
}

function atomic(value) {
  if(typeof value!=='string'||!/^(0|[1-9][0-9]{0,19})$/.test(value)) fail('Indexer amount must use exact integer base units.');
  return BigInt(value);
}
function outputs(tx,limit=32) {
  if(!Array.isArray(tx?.vout)||!tx.vout.length||tx.vout.length>limit) fail('Unsupported transaction outputs.');
  const seen=new Set();
  for(const output of tx.vout) {
    if(!Number.isSafeInteger(output?.n)||output.n<0||seen.has(output.n)||typeof output.hex!=='string'||!/^[a-f0-9]{2,10000}$/.test(output.hex)) fail('Invalid transaction output.');
    seen.add(output.n);atomic(output.value);
  }
  return tx.vout;
}

// The operator pins a Pepecoin-mainnet Blockbook source. No caller-supplied URL
// is fetched. We re-read all funding outputs; explorer address labels are ignored.
export async function verifyTipTransaction(intent,tx,readTx) {
  if(!isHash(intent.txid)||tx?.txid!==intent.txid) fail('Transaction ID mismatch.');
  const destination=pepScript(intent.address),sender=pepScript(intent.sender),wanted=atomic(intent.amount_atomic);
  if(destination===sender||wanted<100000000n||wanted>10000000000000n) fail('Unsupported tip amount.');
  const out=outputs(tx),matches=out.filter(value=>value.hex===destination);
  if(matches.length!==1||atomic(matches[0].value)!==wanted||out.some(value=>value.hex!==destination&&value.hex!==sender)) fail('The payment destination or amount does not match this tip.');
  if(!Number.isSafeInteger(tx.confirmations)||tx.confirmations<0) fail('Invalid confirmation state.');
  if(tx.confirmations<2) return {state:'pending',confirmations:tx.confirmations};
  const from=Date.parse(intent.created_at)/1000-30,until=Date.parse(intent.expires_at)/1000+7200;
  if(!Number.isFinite(from)||!Number.isFinite(until)||!isHash(tx.blockHash)||!Number.isSafeInteger(tx.blockTime)||tx.blockTime<from||tx.blockTime>until) fail('This transaction is outside the tip time window.');
  if(!Array.isArray(tx.vin)||!tx.vin.length||tx.vin.length>20) fail('Unsupported transaction inputs.');
  const seen=new Set(),cache=new Map();let totalIn=0n;
  for(const input of tx.vin) {
    if(!isHash(input?.txid)||!Number.isSafeInteger(input.vout)||input.vout<0||input.vout>0xffffffff||seen.has(input.txid+':'+input.vout)) fail('Invalid or repeated funding input.');
    seen.add(input.txid+':'+input.vout);
    if(!cache.has(input.txid)) cache.set(input.txid,await readTx(input.txid));
    const parent=cache.get(input.txid);
    if(parent?.txid!==input.txid) fail('Funding transaction mismatch.');
    const previous=outputs(parent,10000).find(value=>value.n===input.vout);
    if(!previous||previous.hex!==sender) fail('This payment did not spend from your linked Haze address.');
    totalIn+=atomic(previous.value);
  }
  if(totalIn<=out.reduce((sum,value)=>sum+atomic(value.value),0n)) fail('Invalid payment totals.');
  return {state:'confirmed',vout:matches[0].n,block:tx.blockHash,time:tx.blockTime};
}

// Group manifests come from private SQL snapshots, never from the checking client.
export async function verifyGroupTransaction(intent,tx,readTx){
  if(!isHash(intent.txid)||tx?.txid!==intent.txid||!Array.isArray(intent.recipients)||intent.recipients.length<1||intent.recipients.length>200)fail('Invalid group transaction.');
  const sender=pepScript(intent.sender),expected=new Map();let total=0n;
  for(const recipient of intent.recipients){
    const script=pepScript(recipient.address),value=atomic(recipient.amount);
    if(script===sender||expected.has(script)||value<100000000n)fail('Invalid group recipient.');expected.set(script,value);total+=value;
  }
  if(total!==atomic(intent.total_atomic)||total>10000000000000n)fail('The group total does not match.');
  const out=outputs(tx,201),found=new Set();let change=0;
  for(const output of out){
    if(output.hex===sender){if(++change>1||atomic(output.value)===0n)fail('Unsupported group change.');continue;}
    if(!expected.has(output.hex)||found.has(output.hex)||atomic(output.value)!==expected.get(output.hex))fail('A group recipient or amount changed.');found.add(output.hex);
  }
  if(found.size!==expected.size)fail('A group recipient is missing.');
  if(!Number.isSafeInteger(tx.confirmations)||tx.confirmations<0||!Array.isArray(tx.vin)||tx.vin.length<1||tx.vin.length>20)fail('Invalid group funding or confirmations.');
  const seen=new Set(),cache=new Map();let inputTotal=0n;
  for(const input of tx.vin){
    if(!isHash(input?.txid)||!Number.isSafeInteger(input.vout)||input.vout<0||input.vout>0xffffffff||seen.has(input.txid+':'+input.vout))fail('Invalid or repeated group input.');
    seen.add(input.txid+':'+input.vout);if(!cache.has(input.txid))cache.set(input.txid,await readTx(input.txid));
    const parent=cache.get(input.txid);if(parent?.txid!==input.txid)fail('Group funding transaction mismatch.');
    const previous=outputs(parent,10000).find(value=>value.n===input.vout);
    if(!previous||previous.hex!==sender)fail('Group funding did not come from the linked sender.');inputTotal+=atomic(previous.value);
  }
  if(inputTotal<=out.reduce((sum,value)=>sum+atomic(value.value),0n))fail('Invalid group totals.');
  if(tx.confirmations<2)return {state:'pending',confirmations:tx.confirmations};
  if(!isHash(tx.blockHash)||!Number.isSafeInteger(tx.blockTime)||tx.blockTime<Date.parse(intent.created_at)/1000-30||tx.blockTime>Date.parse(intent.expires_at)/1000+7200)fail('Group payment is outside its time window.');
  if(!Number.isFinite(Date.parse(intent.created_at))||!Number.isFinite(Date.parse(intent.expires_at)))fail('Invalid group time window.');
  return {state:'confirmed',block:tx.blockHash,time:tx.blockTime};
}
