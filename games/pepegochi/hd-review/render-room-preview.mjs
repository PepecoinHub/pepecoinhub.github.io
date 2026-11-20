// Reproduce the full, double-logical-size room preview from the actual renderer geometry.
// Requires ImageMagick. This is a static art composite, not a browser screenshot.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { BACKGROUND, ROOM_LAMP, ROOM_W, ROOM_H, ITEMS, fixedPlacements, roomScene } from '../../../docs/games/js/pepegochi-room.mjs';
const root = fileURLToPath(new URL('../../../docs/games/',import.meta.url));
const dest = fileURLToPath(new URL('room/preview.png',import.meta.url));
const sc=roomScene({stage:'adult',placements:fixedPlacements(Object.keys(ITEMS))});
const W=ROOM_W*2,H=ROOM_H*2,asset=src=>root+src.split('?')[0];
const args=[asset(BACKGROUND),'-filter','point','-resize',`${W}x${H}`,
  '-fill','#253e38','-stroke','#a28a51','-strokewidth','4','-draw','rectangle 56,96 220,182',
  '-fill','#d3c597','-stroke','none','-font','DejaVu-Sans-Mono','-pointsize','15','-gravity','NorthWest',
  '-annotate','+94+109','NO FUD','-annotate','+72+134','AFTER BEDTIME'];
function overlay(item,foot=100) {
  const width=Math.round(item.width*W/100),x=Math.round(item.left*W/100-width/2),y=Math.round(item.top*H/100-width*foot/100);
  args.push('(',asset(item.src),'-filter','point','-resize',`${width}x${width}!`,')','-gravity','NorthWest','-geometry',`+${x}+${y}`,'-compose','over','-composite');
}
for(const it of sc.items.filter(i=>i.z<49))overlay(it,it.wall?50:100);
overlay(ROOM_LAMP);
for(const it of sc.items.filter(i=>i.z>=49))overlay(it,it.wall?50:100);
overlay(sc.frog,sc.frog.foot/128*100);
execFileSync('magick',[...args,'-strip',dest],{stdio:'inherit'});
