// Local integration playground. It NEVER proxies a chain, Supabase, or broadcasts.
// Production files remain disabled. Origin substitutions below exist in memory only.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';

const source=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const walletRoot=path.resolve(process.env.HAZE_WALLET_ROOT||path.join(source,'../../..'));
const groupMode=process.env.HAZE_PREVIEW_GROUPS==='1';
const candidate=path.resolve(process.env.HAZE_TIP_CANDIDATE||path.join(walletRoot,groupMode?'outputs/pepecoinhub-groups-20261115/candidate':'outputs/pepecoinhub-reply-20261115/candidate'));
const basePort=Number(process.env.HAZE_PREVIEW_BASE_PORT||18920);
if(!Number.isInteger(basePort)||basePort<1024||basePort>65534)throw Error('Invalid local preview port.');
const PH='http://127.0.0.1:'+basePort,HAZE='http://127.0.0.1:'+(basePort+1);
const container=basePort===18920?'haze-ph-qa-preview-20261115':'haze-ph-qa-preview-'+basePort;
const uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const password='HazePreview!2026',token='haze_preview_disposable_discord_20261115';
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
const read=file=>fs.readFileSync(file,'utf8');
const dataModule=body=>'data:text/javascript;base64,'+Buffer.from(body).toString('base64');
const localOrigin=body=>body.replaceAll('https://pepecoinhub.com',PH);
let ownedContainer=false,stopping=false,demoPresenceTimer;const servers=[];
const psql=sql=>{
  try{return execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-d','postgres','-XAtq','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:15000}).trim();}
  catch(error){throw Error(String(error.stderr||error.message).match(/ERROR:[^\r\n]+/)?.[0].replace('ERROR:','').trim()||'Local preview database is unavailable.');}
};
async function stop(){
  if(stopping)return;stopping=true;for(const server of servers){server.closeAllConnections();server.close();}
  clearInterval(demoPresenceTimer);
  if(ownedContainer)try{execFileSync('docker',['stop','-t','1',container],{stdio:'ignore',timeout:10000});}catch{}
}
process.on('SIGINT',()=>{void stop().then(()=>process.exit());});process.on('SIGTERM',()=>{void stop().then(()=>process.exit());});

try{
  for(const file of ['wallet.js','widget.html','widget-boot.js','haze-bridge.js'])if(!fs.existsSync(path.join(candidate,file)))throw Error('Missing reviewed Haze candidate: '+file);
  // A dedicated, port-free, network-isolated, disposable database. Never reuse an
  // existing container with this name, and never read production credentials.
  execFileSync('docker',['run','--rm','--detach','--name',container,'--label','haze.pepecoinhub.preview=20261115','--network','none','--tmpfs','/var/lib/postgresql/data:rw','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine'],{stdio:'pipe'});ownedContainer=true;
  let ready=false;for(let i=0;i<60;i++){try{psql('select 1');ready=true;break;}catch{await new Promise(r=>setTimeout(r,250));}}
  if(!ready)throw Error('Local PostgreSQL did not start.');
  psql(read(path.join(source,'scripts/haze-preview/bootstrap.sql')));
  psql(read(path.join(source,'games/supabase/update_haze_tips.sql')));
  if(groupMode)psql(read(path.join(source,'games/supabase/update_haze_groups.sql')));
  const corePath=path.join(source,'games/supabase/functions/haze-wallet/core.mjs'),require=createRequire(corePath);
  const protocol=dataModule(localOrigin(read(path.join(source,'games/supabase/functions/haze-wallet/protocol.mjs'))));
  const core=dataModule(read(corePath).replace("'./protocol.mjs'",JSON.stringify(protocol)).replace(/from '(@[^']+)'/g,(_,name)=>'from '+JSON.stringify(pathToFileURL(require.resolve(name)).href)));
  const {pepScript,PEP_GENESIS}=await import(core);
  const handler=dataModule(localOrigin(read(path.join(source,'games/supabase/functions/haze-wallet/handler.mjs'))).replace("'./core.mjs'",JSON.stringify(core)));
  const {handleHaze}=await import(handler);
  const {createKey,importWif,addressScript}=await import(pathToFileURL(path.join(walletRoot,'wallet-core.js')));
  const {createVault}=await import(pathToFileURL(path.join(walletRoot,'wallet-vault.js')));
  const {walletLibraries}=await import(pathToFileURL(path.join(walletRoot,'vendor/wallet/_loader.js')));
  const libs=await walletLibraries(),B=libs.Buffer;
  const sender=await createKey('PEP'),recipient=await createKey('PEP'),assets={};
  for(const asset of ['DOGE','PEP','LTC','BTC'])assets[asset]=await importWif(sender.wif,asset);
  const vault=await createVault({assets},password),record={vault,createdAt:Date.now(),updatedAt:Date.now(),backedUpAt:Date.now()};
  // The private keys are disposable. Only the encrypted sender vault is served.
  sender.wif='';recipient.wif='';for(const asset of Object.values(assets))asset.wif='';
  psql(`insert into auth.users values(${quote(uid(1))}),(${quote(uid(2))}),(${quote(uid(3))});
    insert into auth.identities values(${quote(uid(1))},'discord'),(${quote(uid(2))},'discord'),(${quote(uid(3))},'discord');
    insert into games.profiles values(${quote(uid(1))},'Lew'),(${quote(uid(2))},'Byl'),(${quote(uid(3))},'Mika');
    update games.haze_settings set enabled=true;
    insert into games.haze_links(user_id,address) values(${quote(uid(2))},${quote(recipient.address)});
    insert into games.passport_badges values(${quote(uid(2))},'haze_linked');
    insert into games.lobby_chat(user_id,nick,body,verified) values
      (${quote(uid(2))},'Byl','gm frens! Try a little appreciation in the pond. These are sample messages for the Haze preview.',true),
      (${quote(uid(3))},'Mika','Wallets stay with their owners. I have not linked a receiving wallet yet.',true),
      (${quote(uid(1))},'Lew','Let’s test Haze tips 💚',true);`);
  const names={1:'Lew',2:'Byl',3:'Mika',4:'Jules',5:'Pip',6:'Nova',7:'Zeph'};
  const groupAddresses=new Map();
  if(groupMode){
    psql('update games.haze_settings set groups_enabled=true;');
    for(const i of [4,5,6,7]){const account=await createKey('PEP');groupAddresses.set(i,account.address);psql(`insert into auth.users values(${quote(uid(i))});insert into auth.identities values(${quote(uid(i))},'discord');insert into games.profiles values(${quote(uid(i))},${quote(names[i])});insert into games.haze_links(user_id,address) values(${quote(uid(i))},${quote(account.address)});`);account.wif='';}
    const presence=()=>psql(`insert into games.lobby_seen(visitor,user_id,seen_at) values('demo-byl',${quote(uid(2))},clock_timestamp()),('demo-jules',${quote(uid(4))},clock_timestamp()) on conflict(visitor) do update set seen_at=excluded.seen_at;`);
    presence();demoPresenceTimer=setInterval(presence,30000);
  }
  const ledger=new Map(),unspent=new Map(),submitted=new Map();
  const funding=new libs.Transaction();funding.addInput(B.alloc(32,19),0);
  funding.addOutput(B.from(await addressScript(sender.address,'PEP')),250000000000n);
  const fund={txid:funding.getId(),vout:0,amount:'250000000000',confirmations:6,rawHex:funding.toHex()};
  unspent.set(fund.txid+':0',fund);ledger.set(fund.txid,{txid:fund.txid,vout:[{n:0,hex:pepScript(sender.address),value:fund.amount}]});
  const params={
    gry_haze_status:[],gry_haze_link_begin:[],gry_haze_unlink:[],gry_haze_chat:[['p_messages','bigint[]']],
    gry_haze_tip_begin:[['p_message','bigint'],['p_amount','text'],['p_reaction','text'],['p_note','text']],
    haze_link_context:[['p_user','uuid'],['p_nonce','text']],haze_link_finish:[['p_user','uuid'],['p_nonce','text'],['p_address','text']],
    haze_tip_context:[['p_user','uuid'],['p_intent','uuid'],['p_txid','text']],
    haze_tip_confirm:[['p_user','uuid'],['p_intent','uuid'],['p_txid','text'],['p_vout','integer'],['p_block','text'],['p_time','bigint']],
    gry_haze_groups:[],gry_haze_group_create:[['p_options','jsonb']],gry_haze_group_join:[['p_id','uuid']],gry_haze_group_review:[['p_id','uuid']],gry_haze_group_cancel:[['p_id','uuid']],
    haze_group_context:[['p_user','uuid'],['p_intent','uuid'],['p_txid','text']],haze_group_confirm:[['p_user','uuid'],['p_intent','uuid'],['p_txid','text'],['p_block','text'],['p_time','bigint']],
  };
  const dbRpc=(fn,args={},service=false,actor=1)=>{
    if(!Object.hasOwn(params,fn)||fn.startsWith('haze_')!==service)throw Error('Preview RPC not permitted.');
    const values=params[fn].map(([name,type])=>{
      const value=args[name];if(type==='bigint[]'){
        if(!Array.isArray(value)||value.length>120||value.some(x=>!/^\d{1,15}$/.test(String(x))))throw Error('Invalid message batch.');
        return 'ARRAY['+value.map(String).join(',')+']::bigint[]';
      }
      if(value==null)throw Error('Missing '+name);return quote(type==='jsonb'?JSON.stringify(value):value)+'::'+type;
    });
    const result=JSON.parse(psql(`begin;set local role ${service?'service_role':'authenticated'};set local request.jwt.claim.sub=${quote(uid(actor))};select public.${fn}(${values.join(',')});commit;`));
    if(result?.audience==='https://pepecoinhub.com')result.audience=PH;return result;
  };
  const readTx=async txid=>{
    const tx=ledger.get(txid);if(!tx)throw Error('Transaction not found in the simulated chain.');
    const pending=submitted.get(txid);return pending?{...tx,confirmations:Date.now()-pending.at>=14000?2:0}:tx;
  };
  const state=()=>({simulation:true,sender:sender.address,recipient:recipient.address,
    badges:JSON.parse(psql(`select coalesce(json_agg(badge_id),'[]') from games.passport_badges where user_id=${quote(uid(1))};`)),
    tips:JSON.parse(psql("select coalesce(json_agg(json_build_object('id',id,'confirmed',confirmed_at is not null)),'[]') from games.haze_tips;")),
    submissions:submitted.size,groups:groupMode?JSON.parse(psql("select coalesce(json_agg(json_build_object('id',id,'mode',mode,'state',state)),'[]') from games.haze_groups;")):[]});
  const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.json':'application/json','.woff2':'font/woff2','.ico':'image/x-icon'};
  const send=(res,body,type='text/html; charset=utf-8')=>{res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(body);};
  const body=async req=>{let text='';for await(const chunk of req){text+=chunk;if(text.length>200000)throw Error('Preview request too large.');}return JSON.parse(text);};
  const safeFile=(root,pathname)=>{const file=path.resolve(root,'.'+decodeURIComponent(pathname));if(!file.startsWith(path.resolve(root)+path.sep))return null;return file;};
  const walletStatic=createRequire(import.meta.url)(path.join(walletRoot,'static.cjs'))({sendJson:json}).serveStatic;
  const css=read(path.join(source,'scripts/haze-preview/preview.css'));
  const htmlPage=(title,copy)=>`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>*{box-sizing:border-box}body{margin:0;background:#edf3e6;color:#173b2c;font:16px/1.6 system-ui}main{max-width:860px;margin:7vh auto;padding:24px}h1{font-size:clamp(32px,5vw,52px);line-height:1.1;letter-spacing:-2px}a,button{display:inline-block;color:#fff;background:#225c3b;border:0;border-radius:12px;padding:12px 19px;margin:8px 8px 8px 0;font:700 15px system-ui;text-decoration:none;cursor:pointer}small{display:block}code{background:#dbe7cc;padding:3px 7px;border-radius:4px}li{margin-bottom:12px}.tag{font-size:12px;font-weight:800;letter-spacing:2px;color:#507345}.card{background:white;border:1px solid #c8d5c0;border-radius:20px;padding:26px;margin:24px 0}</style><main>${copy}</main></html>`;
  function protection(address,outpoints){
    const scriptHex=pepScript(address),scriptHash=crypto.createHash('sha256').update(Buffer.from(scriptHex,'hex')).digest('hex');
    const sourceCommit='e6a383974524a88241408814b14aeff80e4178a2';
    return {schema:'haze-pepecoin-clean-utxos-v1',address,network:'pepecoin-mainnet',networkGenesisHash:PEP_GENESIS,sourceCommit,ruleset:'nintondo-prc20@'+sourceCommit,checkedAt:new Date().toISOString(),chain:{height:100,hash:'cd'.repeat(32)},atomicSnapshot:true,startHeight:0,jubileeHeight:0,mempoolChecked:true,
      outputs:outpoints.map(({txid,vout})=>{
        const item=unspent.get(txid+':'+vout),exists=!!item&&ledger.get(txid)?.vout[vout]?.hex===scriptHex;
        return {txid,vout,unspent:exists,inscriptionFree:exists,amountAtomic:exists?item.amount:null,scriptHex:exists?scriptHex:null,confirmations:exists?item.confirmations:null,coinbase:exists?false:null,reserved:false,
          indexer:exists?{outpoint:txid+':'+vout,unspentAtIndexedHeight:true,value:item.amount,ownerScriptSha256:scriptHash,inscriptionFree:true,inscriptionOffsets:[],hasPartialInscription:false,hasActiveTransfer:false}:{outpoint:txid+':'+vout,unspentAtIndexedHeight:false}};
      })};
  }
  for(const origin of [PH,HAZE]){
    const server=http.createServer(async(req,res)=>{
      const isWallet=origin===HAZE,url=new URL(req.url,origin),p=url.pathname;
      const requestedActor=Number(req.headers['x-preview-actor']||1),actor=groupMode&&Number.isInteger(requestedActor)&&requestedActor>=1&&requestedActor<=7?requestedActor:1;
      if(req.headers.host!==new URL(origin).host)return json(res,403,{error:'Open the exact loopback preview URL.'});
      res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
      res.setHeader('Content-Security-Policy',`default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-src ${HAZE}; font-src 'self' data:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors ${PH} ${HAZE}`);
      try{
        if(req.method==='POST'&&req.headers.origin!==origin)return json(res,403,{error:'Preview origin required.'});
        if(!isWallet&&p==='/__preview/rpc'){
          const {fn,args={}}=await body(req);let data;
          if(fn.startsWith('gry_haze_'))data=dbRpc(fn,args,false,actor);
          else if(fn==='gry_me')data={nick:names[actor],verified:true,is_host:false,discord_name:names[actor],user_id:uid(actor)};
          else if(fn==='gry_lobby')data={now:new Date().toISOString(),rooms:[],event:null};
          else if(fn==='gry_tables_lobby')data=[];
          else if(fn==='gry_ranking')data={rows:[]};
          else if(fn==='gry_my_mentions')data={verified:true,nick:'Lew',optout:true,items:[]};
          else if(fn==='gry_lobby_chat')data={online:3,can_mod:false,muted_until:null,hidden:[],messages:JSON.parse(psql(`select coalesce(json_agg(json_build_object('id',id,'user_id',user_id,'nick',nick,'body',body,'verified',verified,'at',created_at) order by id),'[]') from games.lobby_chat where hidden_at is null and id>${quote(args.p_after||0)}::bigint;`))};
          else if(fn==='gry_lobby_say'){
            const text=String(args.p_text||'').trim();if(!text||text.length>500)throw Error('Write a message up to 500 characters.');
            psql(`insert into games.lobby_chat(user_id,nick,body,verified) values(${quote(uid(actor))},${quote(names[actor])},${quote(text)},true);`);data={};
          }else if(['gry_mentions_seen','gry_mention_names','gry_mention_optout'].includes(fn))data=[];
          else throw Error('Only chat and tipping are enabled in this preview.');
          return json(res,200,{data});
        }
        if(!isWallet&&p==='/__preview/haze'){
          const input=await body(req);const response=await handleHaze(new Request(PH+p,{method:'POST',headers:{origin:PH,authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(input)}),{
            authenticate:async value=>value===token?{id:uid(actor),is_anonymous:false,identities:[{provider:'discord'}]}:null,
            rpc:async(fn,args)=>dbRpc(fn,args,true),readTx,readGenesis:async()=>PEP_GENESIS,
          });return json(res,response.status,await response.json());
        }
        if(!isWallet&&p==='/__preview/state')return json(res,200,state());
        if(!isWallet&&p==='/__preview/reset'&&req.method==='POST'){
          if(groupMode)psql("truncate games.haze_group_entries,games.haze_group_recipients,games.haze_group_eligible,games.haze_groups;delete from games.lobby_seen where visitor like 'haze:%';");
          psql('delete from games.haze_transactions;');
          psql(`truncate games.haze_tips,games.haze_challenges,games.haze_links,games.passport_badges,realtime.test_rings;
            insert into games.haze_links(user_id,address) values(${quote(uid(2))},${quote(recipient.address)});
            insert into games.passport_badges values(${quote(uid(2))},'haze_linked');`);
          for(const [i,address]of groupAddresses)psql(`insert into games.haze_links(user_id,address) values(${quote(uid(i))},${quote(address)});`);
          ledger.clear();unspent.clear();submitted.clear();
          ledger.set(fund.txid,{txid:fund.txid,vout:[{n:0,hex:pepScript(sender.address),value:fund.amount}]});unspent.set(fund.txid+':0',fund);
          return json(res,200,{reset:true});
        }
        if(isWallet&&p==='/__preview/vault')return json(res,200,record);
        if(isWallet&&p==='/__preview/protection'){
          const input=await body(req);if(!Array.isArray(input.outpoints)||input.outpoints.length>16)throw Error('Invalid fixture outputs.');
          const proof=protection(input.address,input.outpoints);res.setHeader('X-Lagoon-Time',String(Date.parse(proof.checkedAt)));return json(res,200,proof);
        }
        if(isWallet&&p==='/api/pepecoin/transaction/broadcast'){
          const input=await body(req);if(typeof input.tx!=='string'||!/^[a-f0-9]{2,100000}$/.test(input.tx))throw Error('Invalid synthetic transaction.');
          const tx=libs.Transaction.fromHex(input.tx),txid=tx.getId();if(submitted.has(txid))return json(res,200,{txid});
          let total=0n;const used=new Set();
          for(let i=0;i<tx.ins.length;i++){
            const vin=tx.ins[i],id=B.from(vin.hash).reverse().toString('hex'),key=id+':'+vin.index,item=unspent.get(key);
            if(!item||used.has(key))throw Error('The preview input is unavailable.');used.add(key);total+=BigInt(item.amount);
            const chunks=libs.script.decompile(vin.script);if(chunks?.length!==2||typeof chunks[0]==='number'||typeof chunks[1]==='number')throw Error('A signed native PEP transaction is required.');
            const signature=libs.script.signature.decode(chunks[0]),pubkey=B.from(chunks[1]);
            const own=libs.payments.p2pkh({pubkey}).output,expected=ledger.get(id).vout[vin.index].hex;
            if(B.from(own).toString('hex')!==expected||!libs.ECPair.fromPublicKey(pubkey).verify(tx.hashForSignature(i,B.from(expected,'hex'),signature.hashType),signature.signature))throw Error('Preview transaction signature is invalid.');
          }
          if(!tx.ins.length||tx.ins.length>20||tx.outs.length>(groupMode?201:2)||total<=tx.outs.reduce((n,out)=>n+BigInt(out.value),0n))throw Error('Invalid fixture payment totals.');
          const at=Date.now(),vout=tx.outs.map((out,n)=>({n,hex:B.from(out.script).toString('hex'),value:BigInt(out.value).toString()}));
          ledger.set(txid,{txid,vin:tx.ins.map(vin=>({txid:B.from(vin.hash).reverse().toString('hex'),vout:vin.index})),vout,blockHash:'cd'.repeat(32),blockTime:Math.floor(at/1000)});submitted.set(txid,{at});
          for(const key of used)unspent.delete(key);
          for(const out of vout)if(out.hex===pepScript(sender.address))unspent.set(txid+':'+out.n,{txid,vout:out.n,amount:out.value,confirmations:2,rawHex:input.tx});
          console.log('Synthetic PEP submission verified:',txid);return json(res,200,{txid});
        }
        if(isWallet&&p.startsWith('/api/')){
          if(req.method!=='GET')return json(res,403,{error:'Only synthetic native PEP payments are enabled.'});
          let value={};
          if(p==='/api/site/status')value=Object.fromEntries(['PEP','DOGE','LTC','BTC'].map(id=>[id,{online:true,source:'Synthetic local chain'}]));
          else if(p==='/api/site/config')value={assetProviders:{}};
          else if(p==='/api/rates')value={updated:Date.now(),rates:{PEP:{usd:0.0001}}};
          else if(p.endsWith('/fees'))value={rate:'1002'};
          else if(p.endsWith('/utxos'))value={utxos:p.includes(sender.address)?[...unspent.values()]:[]};
          else if(p.endsWith('/txs'))value={txs:[]};
          else if(p.includes('/address/')){const amount=p.includes(sender.address)?[...unspent.values()].reduce((n,u)=>n+BigInt(u.amount),0n):0n;value={balance:Number(amount)/1e8,confirmed_balance_sats:amount.toString(),utxo_count:unspent.size};}
          else if(p.startsWith('/api/assets/'))value={assets:[],nextCursor:null};
          return json(res,200,value);
        }
        if(p.startsWith('/__preview/')&&['backend.mjs','toolbar.js','preview.css','setup.js'].includes(p.split('/').at(-1))){
          const file=path.join(source,'scripts/haze-preview',p.split('/').at(-1));return send(res,read(file).replaceAll('http://127.0.0.1:18920',PH).replaceAll('http://127.0.0.1:18921',HAZE),mime[path.extname(file)]);
        }
        if(!isWallet&&p==='/'&&groupMode)return send(res,htmlPage('Community tips × Haze · local preview',`
          <p class="tag">PEPECOINHUB × HAZE WALLET</p><h1>Share PEP.<br>Light up the pond.</h1>
          <p>Whole-community tips, lucky draws, timed airdrops, trivia, and say-the-word rounds — right in chat.</p>
          <div class="card"><b>Local playground · 2500 synthetic PEP · no real funds</b>
          <ol><li><b>Prepare the test wallet</b>, review the self-custody terms, then use <b>Back to chat</b>.</li>
          <li>As <b>Lew (host)</b>, choose <b>Link Haze for tips</b> and approve the public-address connection.</li>
          <li>Choose <b>🎉 Group tips</b>. Share with the whole pond, online, away, random or chosen frens — or start a timed round.</li>
          <li>For a round, use <b>Demo member</b> at the top to become Byl or Jules. Join the airdrop, answer trivia with <b>/answer PEP</b>, or type the round's word in chat. Return to <b>Lew (host)</b>.</li>
          <li><b>Review payout</b> shows the winners. Haze shows every destination and the fee. Approve once, then chat follows confirmation automatically.</li></ol>
          <p>Password: <code>${password}</code>. No transaction-ID entry or extra payment window. A round never pays automatically.</p>
          <a href="${HAZE}/__preview/setup">Prepare test wallet →</a><a href="/games/#chat">Open PepecoinHub chat</a></div>
          <small>Discord, participants and confirmations are simulated; wallet signatures, transaction verification and PostgreSQL rules run locally. Only Lew's test wallet is funded. Never import or fund a personal wallet here. Production switches remain off. This local preview never deploys code or makes a real payment.</small>`));
        if(!isWallet&&p==='/')return send(res,htmlPage('PepecoinHub × Haze · local playground',`<p class="tag">PEPECOINHUB × HAZE WALLET</p><h1>A little PEP.<br>A lot of appreciation.</h1><p>Try direct chat tips in PepecoinHub’s actual Games lobby, using the real Haze wallet UI.</p><div class="card"><b>Local playground · no real funds</b><p>Discord and network confirmations are simulated. Wallet ownership signatures, payment signatures, the Haze verifier, and the tipping SQL run locally.</p><ol><li>Prepare the disposable Haze wallet with <b>2500 synthetic PEP</b>.</li><li>In the chat, click <b>Link Haze for tips</b> and approve the connection.</li><li>Click <b>Tip</b> on Byl’s sample message. Choose an amount, reaction and note.</li><li>Open Haze, unlock, review the network fee, then confirm the payment. It appears after two simulated confirmations (about 20 seconds).</li></ol><p>Test wallet password: <code>${password}</code></p><a href="${HAZE}/__preview/setup">Prepare test wallet →</a><a href="/games/#chat">Open PepecoinHub chat</a></div><small>Production switches remain off. This local preview makes no deployment, real Discord login, or blockchain submission. This validates the local flow; a separately reviewed staging test is still required before release.</small>`));
        if(isWallet&&p==='/__preview/setup')return send(res,htmlPage('Prepare disposable Haze wallet',`<p class="tag">HAZE · LOCAL PLAYGROUND</p><h1>Your test wallet is ready.</h1><div class="card"><p>Prepare a disposable encrypted wallet at <b>${HAZE}</b> with 2500 synthetic PEP. This affects only this loopback preview’s browser storage.</p><p>Password: <code>${password}</code></p><p>Do not import or fund a personal wallet here. All payments stay inside the simulator.</p><button type="button">Prepare wallet & open chat →</button><p role="status"></p></div><script type="module" src="/__preview/setup.js"></script>`));
        if(!isWallet){
          const pathname=p.endsWith('/')?p+'index.html':p,file=safeFile(path.join(source,'docs'),pathname);
          if(!file||!fs.existsSync(file)||!fs.statSync(file).isFile())return json(res,404,{error:'Preview file unavailable.'});
          let content=fs.readFileSync(file),ext=path.extname(file);
          if(ext==='.html'){
            content=content.toString().replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/i,'').replace(/<script[^>]+(?:gc\.zgo\.at)[\s\S]*?<\/script>/g,'');
            content=content.replace('</head>','<link rel="stylesheet" href="/__preview/preview.css"><script type="module" src="/__preview/toolbar.js"></script></head>');
          }else if(p==='/games/js/config.js')content="window.PEP_HAZE_GROUPS_PREVIEW="+groupMode+";window.PEP_GRY={backend:'local',testBuild:true,discord:false};localStorage.setItem('pepgry-nick',({1:'Lew',2:'Byl',3:'Mika',4:'Jules',5:'Pip',6:'Nova',7:'Zeph'})[localStorage.getItem('haze-preview-actor')||1]||'Lew');";
          else if(p==='/games/js/backend.js')content="import {previewBackend} from '/__preview/backend.mjs';\n"+content.toString().replace('if (instance) return instance;','return previewBackend;');
          else if(p==='/games/js/haze-tips.mjs')content=content.toString().replace('HAZE_TIPS_ENABLED = false','HAZE_TIPS_ENABLED = true').replaceAll('https://hazewallet.com',HAZE);
          else if(p==='/games/js/haze-groups.mjs'&&groupMode)content=content.toString().replace('HAZE_GROUPS_ENABLED=false','HAZE_GROUPS_ENABLED=true');
          return send(res,content,mime[ext]||'application/octet-stream');
        }
        if(['/wallet.js','/widget.html','/widget-boot.js','/haze-bridge.js',...['/wallet-core.js','/assets/haze-group-tips.js','/assets/haze-tip-journal.js'].filter(name=>fs.existsSync(path.join(candidate,name.slice(1))))].includes(p)){
          let content=read(path.join(candidate,p.slice(1)));
          if(p==='/widget.html')content=content.replace('</head>',`<style>${css}</style></head>`).replace('<body>','<body><div class="preview-wallet-banner"><strong>LOCAL SIMULATION</strong> · password '+password+' · <a href="'+PH+'/games/#chat" target="_top">Back to chat ↗</a></div>');
          return send(res,content,mime[path.extname(p)]);
        }
        if(['/haze-auth-protocol.js','/assets/haze-chat-tips.js','/assets/tip.html','/assets/tip.js','/assets/tip.css'].includes(p)){
          const reviewed=path.join(candidate,p.slice(1)),file=fs.existsSync(reviewed)?reviewed:path.join(walletRoot,p.slice(1));
          return send(res,localOrigin(read(file)),mime[path.extname(p)]);
        }
        if(p==='/haze-bridge-config.js')return send(res,`export const HAZE_AUTH_ALLOWED_ORIGINS=Object.freeze([${JSON.stringify(PH)}]);`,'text/javascript');
        if(p==='/haze-pep-spend-guard.js')return send(res,read(path.join(walletRoot,p.slice(1))).replace('https://tokenprinter.fun/api/lagoon/clean-utxos',HAZE+'/__preview/protection'),'text/javascript');
        return await walletStatic(req,res);
      }catch(error){return json(res,400,{error:error.message});}
    });
    servers.push(server);await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(new URL(origin).port,'127.0.0.1',resolve);});
  }
  console.log(JSON.stringify({ready:true,preview:PH,wallet:HAZE,simulation:true,container,password,sender:sender.address,recipient:recipient.address}));
}catch(error){console.error(error.message);await stop();process.exitCode=1;}
