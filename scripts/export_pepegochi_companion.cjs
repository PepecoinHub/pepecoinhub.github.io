// Technical export of generated expressions: slice, nearest-neighbour resample,
// binary alpha, approved palette, and registration to the existing locked costume.
// Requires sharp and pngjs; runtime assets and QA have no new dependency.
const sharp = require('sharp');
const { PNG } = require('pngjs');
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'docs/games/img/pepegochi/taskbar');
const source = path.join(root, 'games/pepegochi/companion-a10/source/generated-expressions.png');
const names = ['nuzzle', 'welcome', 'curious', 'sulk', 'yawn'];
(async () => {
 const base = PNG.sync.read(fs.readFileSync(path.join(dir, 'tb_adult_sit.png')));
 const palette = [...new Map(Array.from({length:48*48},(_,i)=>[...base.data.slice(i*4,i*4+4)]).filter(c=>c[3]===255).map(c=>[c.join(','),c])).values()];
 const {width,height}=await sharp(source).metadata();
 const report=[];
 for(let row=0;row<5;row++) for(let col=0;col<4;col++) {
  const left=Math.round(col*width/4), top=Math.round(row*height/5);
  const w=Math.round((col+1)*width/4)-left,h=Math.round((row+1)*height/5)-top;
  const raw=await sharp(source).extract({left,top,width:w,height:h}).ensureAlpha().raw().toBuffer();
  let x0=w,y0=h,x1=0,y1=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(raw[(y*w+x)*4+3]>=192){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
  // Each generated pose registered by its silhouette height, never smoothed.
  const oh=40,ow=Math.round((x1-x0+1)*oh/(y1-y0+1));
  const resized=await sharp(raw,{raw:{width:w,height:h,channels:4}}).extract({left:x0,top:y0,width:x1-x0+1,height:y1-y0+1}).resize(ow,oh,{kernel:'nearest'}).raw().toBuffer();
  const out=new PNG({width:48,height:48});
  const ox=Math.round(24-ow/2),oy=47-oh;
  for(let y=0;y<oh;y++)for(let x=0;x<ow;x++) {
   const i=(y*ow+x)*4;if(resized[i+3]<192)continue;
   const c=palette.reduce((best,p)=>{const d=(p[0]-resized[i])**2+(p[1]-resized[i+1])**2+(p[2]-resized[i+2])**2;return d<best.d?{p,d}:best;},{d:Infinity}).p;
   out.data.set(c,((y+oy)*48+x+ox)*4);
  }
  // Preserve the supplied P, hoodie core and complete lower body pixel for pixel.
  // Expressions live above the collar; generated arms remain outside the core.
  for(let y=26;y<48;y++)for(let x=0;x<48;x++) {
   if(y>=37 || (y>=29&&x>=18&&x<30) || (y>=26&&y<32&&x>=21&&x<29)) {
    const i=(y*48+x)*4;out.data.set(base.data.slice(i,i+4),i);
   }
  }
  const name=`tb_${names[row]}_0${col+1}.png`;
  fs.writeFileSync(path.join(dir,'anim',name),PNG.sync.write(out));
  report.push({file:name,sourceCell:[row,col],colours:palette.length});
 }
 fs.writeFileSync(path.join(root,'games/pepegochi/companion-a10/export.json'),JSON.stringify({source:'source/generated-expressions.png',method:'Generated artwork; technical nearest-neighbour export to approved palette with locked costume/lower body',frames:report},null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1;});
