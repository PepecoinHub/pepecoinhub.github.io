// Build a portable, offline review package from the actual runtime sprites.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),out=path.join(root,'games/pepegochi/companion-a10'),assets=path.join(root,'docs/games/img/pepegochi/');
(async()=>{
 const {EXPRESSIONS,expressionFrames}=await import('../docs/meme/pepegochi-expressions.mjs');
 fs.mkdirSync(path.join(out,'frames'),{recursive:true});
 const all={};
 for(const a of ['taskbar/tb_adult_sit.png','taskbar/tb_adult_sleepy.png',...Object.keys(EXPRESSIONS).flatMap(expressionFrames)]){
  const b=fs.readFileSync(path.join(assets,a));all[a]='data:image/png;base64,'+b.toString('base64');fs.writeFileSync(path.join(out,'frames',path.basename(a)),b);
 }
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(EXPRESSIONS,null,2)+'\n');
 const titles={nuzzle:'Głaskanie',welcome:'Powitanie',curious:'Ciekawość',sulk:'Foch',yawn:'Ziewanie'};
 const cards=Object.entries(EXPRESSIONS).map(([name,a])=>`<article><h2>${titles[name]}</h2><div class="stage"><img id="${name}" width="192" height="192" alt="${titles[name]}" src="${all['taskbar/'+a.base+'.png']}"></div><p>4 klatki · ${a.order.length*a.ms} ms</p><button data-play="${name}">Odtwórz</button><details><summary>Klatki 1:1</summary>${[1,2,3,4].map(i=>`<img width="48" height="48" alt="Klatka ${i}" src="${all['taskbar/anim/tb_'+name+'_0'+i+'.png']}">`).join('')}</details></article>`).join('');
 fs.writeFileSync(path.join(out,'preview.html'),`<!doctype html><html lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PepeGochi · A10</title><style>
*{box-sizing:border-box}body{margin:0;padding:32px;background:#102c2c;color:#e9f3dc;font:16px/1.5 system-ui}main{max-width:1200px;margin:auto}h1{font-size:36px;letter-spacing:-1px;margin:0}header p{max-width:750px;color:#b7d1c6}.tag{color:#c7f571;font:700 12px monospace;letter-spacing:2px}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-top:28px}article{padding:16px;background:#c0c0c0;color:#152b24;border:2px solid;border-color:white #555 #555 white}h2{margin:0;font-size:17px;background:#002f63;color:white;padding:4px 8px}.stage{height:216px;display:grid;place-items:end center;border-bottom:6px ridge #ddd;background:#c0c0c0}.stage img{image-rendering:pixelated}article p{font:13px monospace}button{padding:8px 16px;background:#dedede;border:2px outset white;font:600 14px system-ui;cursor:pointer}button:active{border-style:inset}button:focus-visible{outline:3px solid #2679d1}details{margin-top:12px}details img{image-rendering:pixelated}footer{margin-top:28px;color:#b7d1c6;font-size:14px}.dark .stage{background:#173a34}body.dark{background:#081c1c}</style><main><header><div class="tag">PEPEGOCHI / PACZKA A10</div><h1>Małe gesty. Więcej charakteru.</h1><p>Pięć krótkich animacji towarzysza. Ten podgląd korzysta z gotowych plików gry i działa bez internetu. Grafiki 48 × 48 px, tutaj powiększone czterokrotnie.</p><button id="all">Odtwórz wszystkie</button> <button id="stop">Zatrzymaj</button> <button id="theme">Zmień tło</button></header><section>${cards}</section><footer>20 nowych klatek · przezroczystość · oryginalna paleta i logo bluzy · bez zapętlania<br>W grze stan zwierzaka i ustawienie ograniczonego ruchu mają pierwszeństwo.</footer></main><script>
const sequences=${JSON.stringify(EXPRESSIONS)},assets=${JSON.stringify(all)},timers={};
function stop(name){clearTimeout(timers[name]);const a=sequences[name],img=document.getElementById(name);img.src=assets['taskbar/'+a.base+'.png'];img.style.transform='';}
function play(name){stop(name);const a=sequences[name],img=document.getElementById(name);let i=0;function step(){if(i>=a.order.length){stop(name);return}img.src=assets['taskbar/anim/tb_'+name+'_0'+a.order[i]+'.png'];if(name==='welcome'&&!matchMedia('(prefers-reduced-motion: reduce)').matches)img.style.transform='translateY('+([0,-8,-16,-16,-8,0,0][i])+'px)';i++;timers[name]=setTimeout(step,a.ms)}step()}
document.querySelectorAll('[data-play]').forEach(b=>b.onclick=()=>play(b.dataset.play));document.getElementById('all').onclick=()=>Object.keys(sequences).forEach(play);document.getElementById('stop').onclick=()=>Object.keys(sequences).forEach(stop);document.getElementById('theme').onclick=()=>document.body.classList.toggle('dark');document.addEventListener('visibilitychange',()=>{if(document.hidden)Object.keys(sequences).forEach(stop)});
</script></html>`);
 // Contact sheet: baseline plus four actual exports for every expression.
 const tiles=[];
 for(const [r,name] of Object.keys(EXPRESSIONS).entries())for(let c=0;c<5;c++){
  const a=c===0?'taskbar/'+EXPRESSIONS[name].base+'.png':`taskbar/anim/tb_${name}_0${c}.png`;
  tiles.push({input:await sharp(path.join(assets,a)).resize(240,240,{kernel:'nearest'}).png().toBuffer(),left:c*260,top:r*260});
 }
 await sharp({create:{width:1300,height:1300,channels:4,background:'#c0c0c0'}}).composite(tiles).png().toFile(path.join(out,'contact-sheet.png'));
 fs.mkdirSync('/tmp/pepegochi-gif',{recursive:true});
 for(let k=0;k<24;k++){
  const comps=[];
  for(const [c,name]of Object.keys(EXPRESSIONS).entries()){
   const a=EXPRESSIONS[name],index=Math.floor((k*100-200)/a.ms),f=index<0||index>=a.order.length?'taskbar/'+a.base+'.png':`taskbar/anim/tb_${name}_0${a.order[index]}.png`;
   comps.push({input:await sharp(path.join(assets,f)).resize(144,144,{kernel:'nearest'}).png().toBuffer(),left:c*160+8,top:8});
  }
  await sharp({create:{width:800,height:160,channels:4,background:'#c0c0c0'}}).composite(comps).png().toFile('/tmp/pepegochi-gif/'+String(k).padStart(2,'0')+'.png');
 }
})().catch(e=>{console.error(e);process.exitCode=1});
