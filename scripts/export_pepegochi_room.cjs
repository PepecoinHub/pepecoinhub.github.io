// Technical export only: generated background -> 320x200 logical pixels -> 640x400 PNG.
const sharp=require('sharp'),path=require('node:path');
const root=path.resolve(__dirname,'..');
(async()=>{
 const pixels=await sharp(path.join(root,'games/pepegochi/room-a11/source/generated-room.png')).resize(320,200,{fit:'fill',kernel:'nearest'}).removeAlpha().png({palette:true,colours:256,dither:0}).toBuffer();
 await sharp(pixels).resize(640,400,{kernel:'nearest'}).png().toFile(path.join(root,'docs/games/img/pepegochi/room_pond_den_v1.png'));
})().catch(e=>{console.error(e);process.exitCode=1});
