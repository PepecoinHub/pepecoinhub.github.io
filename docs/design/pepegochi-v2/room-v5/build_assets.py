from PIL import Image, ImageDraw, ImageFont
import os, random, json, math
BASE=os.path.dirname(os.path.abspath(__file__))
ROOT=os.path.join(BASE,'assets')
os.makedirs(ROOT,exist_ok=True)
S=2
# Art is composed at 320x200 logical-pixel resolution, upscaled nearest to 640x400.
C={
 'outline':'#293047','night':'#131b4e','blue':'#2a367f','purple':'#846ba1','wall':'#ab91b3','wall_hi':'#bca2c0','wall_dark':'#816b96','brown':'#a66640','wood_hi':'#cc8651','wood_dark':'#6c432f','leaf':'#6fa747','leaf_hi':'#a7cf66','leaf_shadow':'#416a46','white':'#f1e7c8','teal':'#608d9f','yellow':'#f9d869','red':'#de7751','gray':'#78758b','gray_light':'#c2bcc9'
}
FNT='/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf'
try:fnt=ImageFont.truetype(FNT,14)
except:fnt=ImageFont.load_default()

def new(w,h):
    im=Image.new('RGBA',(w,h),(0,0,0,0));return im,ImageDraw.Draw(im)

def save(im,name,resize=None):
    if resize: im=im.resize(resize, Image.Resampling.NEAREST)
    im.save(os.path.join(ROOT,name));return os.path.join(ROOT,name)

def shape_dotted(d, bounds, col, seed=44, every=6):
    rng=random.Random(seed);x0,y0,x1,y1=bounds
    for _ in range((x1-x0)*(y1-y0)//every):
        x=rng.randint(x0,x1-1);y=rng.randint(y0,y1-1);d.rectangle((x,y,x,y),fill=col)

def sprite(name, painter):
    im,d=new(64,64);painter(d);save(im,name+'.png',(128,128))

# --- A truly clean, prop-free room; the TV / poster / lamp / potted plant are not baked in. ---
im,d=new(320,200)
d.rectangle((0,0,319,135),fill=C['wall']);d.rectangle((0,0,319,3),fill='#866f9f')
# Wallpaper tone strips and crosses, intentionally subdued to keep objects readable.
for y in range(12,126,24):
 for x in range(10,320,24):
  d.rectangle((x,y,x+1,y+5),fill='#977ba9');d.rectangle((x-2,y+2,x+3,y+3),fill='#977ba9')
  d.rectangle((x+10,y+10,x+10,y+10),fill='#d4bbce')
shape_dotted(d,(0,4,320,134),'#a18aae',seed=20,every=22)
# Wooden skirting and floor, 2D game look
for k,col in [(136,'#524263'),(139,'#70506b'),(142,'#bd7c50')]:d.rectangle((0,k,319,k+2),fill=col)
d.rectangle((0,145,319,199),fill='#b17b4d')
for row,y in enumerate(range(145,204,11)):
 d.line([(0,y),(319,y)],fill='#70482e',width=2)
 for x in range((0 if row%2==0 else 32),320,64):
  d.line([(x,y),(x,y+10)],fill='#8f5c3b',width=1)
for y in range(148,200,18):
 for x in range(12,320,41):d.point((x,y),fill='#d59a63')
# Window looking out over pond, on right of wall
x,y=223,10
d.rectangle((x+2,y+4,x+72,y+81),fill='#5d3d49')
d.rectangle((x,y,x+69,y+77),fill='#533a40')
d.rectangle((x+4,y+4,x+65,y+73),fill='#c98b55')
d.rectangle((x+8,y+8,x+61,y+69),fill='#202b64')
d.rectangle((x+9,y+8,x+60,y+39),fill='#283771')
d.rectangle((x+9,y+41,x+60,y+69),fill='#275e78')
d.ellipse((x+43,y+12,x+55,y+24),fill='#f8eaa8')
for sx,sy in [(x+17,y+19),(x+31,y+28),(x+37,y+13),(x+14,y+34)]:
 d.point((sx,sy),fill='#fff2ac');d.point((sx+1,sy),fill='#fff2ac')
d.polygon([(x+9,y+47),(x+20,y+40),(x+29,y+46),(x+37,y+36),(x+47,y+45),(x+60,y+36),(x+61,y+67),(x+9,y+67)],fill='#416959')
d.polygon([(x+9,y+56),(x+27,y+54),(x+44,y+57),(x+61,y+53),(x+61,y+69),(x+9,y+69)],fill='#327f87')
d.line([(x+25,y+64),(x+37,y+64)],fill='#b3cea7',width=2)
d.rectangle((x+33,y+5,x+37,y+73),fill='#9d633f')
d.rectangle((x+8,y+37,x+62,y+41),fill='#ac764d')
d.rectangle((x+3,y+3,x+66,y+6),fill='#e1a66d')
d.line([(x+1,y+4),(x+1,y+74),(x+68,y+74)],fill='#4e3131',width=3)
# Floating shelf for collectibles, no collectible drawn
for x,y,w in [(111,74,75)]:
 d.rectangle((x+4,y+6,x+11,y+17),fill='#684432')
 d.rectangle((x+w-11,y+6,x+w-4,y+17),fill='#684432')
 d.rectangle((x,y,x+w,y+6),fill='#603c30')
 d.rectangle((x+2,y+1,x+w-2,y+3),fill='#ce9160')
# Fixed dresser, top is usable as a slot
x,y=15,111
d.polygon([(x+3,y),(x+59,y),(x+64,y+8),(x,y+8)],fill='#d08d57',outline='#54392d')
d.rectangle((x+3,y+8,x+61,y+57),fill='#70432d')
d.rectangle((x+7,y+13,x+57,y+53),fill='#ad673a')
for yy in [123,143]:
 d.rectangle((x+11,yy,x+53,yy+17),fill='#d28d54',outline='#6b432f',width=2)
 d.rectangle((x+30,yy+6,x+34,yy+10),fill='#f0c375',outline='#55402c')
d.rectangle((x+3,y+57,x+11,y+63),fill='#5e3b30')
d.rectangle((x+53,y+57,x+60,y+63),fill='#5e3b30')
# Rug under frog
cx,cy=162,177
d.polygon([(80,164),(238,164),(267,196),(58,196)],fill='#36496f',outline='#242847')
d.polygon([(87,168),(230,168),(251,191),(74,191)],fill='#c2b14e',outline='#647248')
d.polygon([(94,172),(224,172),(239,187),(85,187)],fill='#6b8e9e')
for x in range(96,225,14):d.line([(x,173),(x+6,187)],fill='#829ca7')
# Bed behind pet
x,y=110,129
d.ellipse((x-4,y-5,x+94,y+43),fill='#263364')
d.ellipse((x,y,x+90,y+36),fill='#879dc3')
d.ellipse((x+9,y+7,x+81,y+27),fill='#d8c0ae')
d.arc((x+10,y+8,x+80,y+29),180,360,fill='#8b7ca7',width=2)
d.rectangle((x+1,y+24,x+87,y+35),fill='#596ca8')
for tx in [x+12,x+26,x+42,x+57,x+72]:d.line([(tx,y+26),(tx+3,y+33)],fill='#3b4e8c')
# Fixed TV stand with empty top; no TV in pixels
x,y=243,126
d.polygon([(x,y),(x+68,y),(x+73,y+8),(x-6,y+8)],fill='#d79a61',outline='#5a382c')
d.rectangle((x+1,y+8,x+68,y+39),fill='#86563a')
d.rectangle((x+8,y+13,x+62,y+17),fill='#bd7d50')
d.rectangle((x+11,y+39,x+18,y+54),fill='#583930');d.rectangle((x+54,y+39,x+61,y+54),fill='#583930')
d.rectangle((x+23,y+24,x+47,y+35),fill='#583e42')
# Fixed small side table to right of bed, top slot at 453,258
x,y=187,133
d.polygon([(x,y),(x+51,y),(x+55,y+7),(x-3,y+7)],fill='#bd8652',outline='#65402d')
d.rectangle((x+2,y+7,x+50,y+11),fill='#7b4f35')
d.rectangle((x+5,y+11,x+12,y+31),fill='#765036');d.rectangle((x+40,y+11,x+47,y+31),fill='#765036')
# Small detail at corners
for cx,cy in [(8,138),(310,138)]:d.rectangle((cx,cy,cx+4,cy+4),fill='#634d63')
save(im,'room_clean_base.png',(640,400))

# six individually usable item sprites 128x128 RGBA. Their objects occupy center and are bottom-anchored.
def draw_tv(d):
 d.line([(19,12),(28,23),(37,10)],fill='#2b3542',width=2)
 d.ellipse((17,9,22,13),fill='#c5c5c8',outline='#30343d')
 d.ellipse((35,8,40,12),fill='#c5c5c8',outline='#30343d')
 d.rectangle((4,22,60,53),fill='#252a46')
 d.polygon([(6,23),(58,23),(61,51),(3,51)],fill='#54576e',outline='#252a43')
 d.rectangle((9,26,50,48),fill='#171e37')
 d.rectangle((12,29,47,45),fill='#5a858e')
 d.rectangle((14,31,46,43),fill='#304f69')
 d.polygon([(18,39),(21,35),(27,37),(33,31),(40,35),(45,33),(46,44),(14,44)],fill='#3b765f')
 d.rectangle((51,27,57,46),fill='#77738a')
 d.ellipse((52,30,55,33),fill='#e1d394',outline='#282a41')
 d.ellipse((52,39,55,42),fill='#e1d394',outline='#282a41')
 d.rectangle((12,53,19,58),fill='#33354b');d.rectangle((46,53,54,58),fill='#33354b')
 d.line([(9,26),(15,26)],fill='#b1afbd',width=2)

def draw_lava(d):
 d.polygon([(25,8),(42,8),(43,13),(23,13)],fill='#d5d8dd',outline='#2b2b48')
 d.polygon([(25,14),(41,14),(50,46),(16,46)],fill='#b9e3a7',outline='#37354c')
 d.polygon([(28,15),(38,15),(44,43),(22,43)],fill='#d3ed7e')
 d.polygon([(28,17),(32,17),(27,43),(22,43)],fill='#e8f8a3')
 d.ellipse((25,23,35,34),fill='#78b955')
 d.ellipse((35,34,43,42),fill='#a8c24d')
 d.ellipse((27,36,35,43),fill='#7cbf52')
 d.ellipse((32,17,38,22),fill='#a4bc3c')
 d.rectangle((18,44,48,52),fill='#9296a3',outline='#313249',width=2)
 d.rectangle((22,52,44,56),fill='#373c51')
 d.line([(19,44),(47,44)],fill='#f5ecb0',width=1)

def draw_plant(d):
 # pot and beautiful dangling leaves
 d.ellipse((20,34,49,38),fill='#e3a063',outline='#3b3949')
 d.polygon([(22,36),(47,36),(43,56),(26,56)],fill='#ba764a',outline='#59402e')
 d.rectangle((21,37,47,40),fill='#e6a166')
 d.line([(31,41),(29,54)],fill='#d48f53',width=2)
 for dx,dy,w,h in [(23,20,18,14),(38,17,19,12),(11,26,20,11),(27,8,17,17),(43,28,15,13),(6,35,20,9),(41,37,17,10),(16,14,14,16)]:
  d.ellipse((dx,dy,dx+w,dy+h),fill='#3d7545',outline='#274637',width=2)
  d.ellipse((dx+3,dy+1,dx+w-3,dy+h-3),fill='#7caf4d')
 d.line([(34,12),(34,36)],fill='#356c46',width=2)
 d.line([(17,34),(34,24),(48,38)],fill='#356c46',width=2)

def draw_poster(d):
 d.polygon([(11,9),(53,7),(55,53),(9,55)],fill='#e7cb95',outline='#382f4d')
 d.polygon([(15,13),(49,11),(51,49),(13,51)],fill='#343c83',outline='#20284f')
 d.rectangle((20,17,45,44),fill='#3b4e9c')
 d.text((25,18),'P',font=fnt,fill='#f8ebcc',stroke_width=0)
 d.rectangle((10,53,54,56),fill='#7e6a5e')
 d.ellipse((30,7,34,11),fill='#a89c72',outline='#433a42')

def draw_duck(d):
 d.ellipse((12,32,53,54),fill='#e5a738',outline='#382e3e',width=2)
 d.ellipse((15,30,49,51),fill='#f5cf49')
 d.ellipse((17,12,39,37),fill='#f1ce4e',outline='#473b41',width=2)
 d.ellipse((20,14,34,30),fill='#fee56c')
 d.ellipse((33,19,36,22),fill='#27354a')
 d.polygon([(38,28),(51,30),(53,34),(38,36)],fill='#d87838',outline='#5b443f')
 d.arc((27,35,43,47),20,160,fill='#d29c36',width=2)
 d.line([(8,53),(54,53)],fill='#806441',width=2)

def draw_mug(d):
 d.polygon([(13,20),(45,20),(44,53),(16,53)],fill='#676ca9',outline='#2d2e50')
 d.rectangle((17,22,41,50),fill='#8d94cf')
 d.ellipse((13,16,45,25),fill='#dee1eb',outline='#31314c',width=2)
 d.ellipse((19,19,40,22),fill='#654b42')
 d.arc((40,27,60,48),260,95,fill='#414666',width=6)
 d.arc((43,29,57,44),270,85,fill='#adb6d5',width=3)
 d.text((22,30),'P',font=fnt,fill='#f6e5be')
 d.line([(17,53),(44,53)],fill='#363950',width=2)

def draw_floppy(d):
 d.rectangle((12,12,52,52),fill='#2c376c',outline='#1d2544')
 d.rectangle((17,12,46,27),fill='#bec7d0',outline='#404762')
 d.rectangle((24,13,42,22),fill='#555b70')
 d.rectangle((17,32,47,48),fill='#f2e9d6',outline='#5c6488')
 d.line([(22,38),(42,38)],fill='#95a0b3');d.line([(22,43),(42,43)],fill='#95a0b3')
 d.rectangle((46,44,50,52),fill='#a4b0bd')

def draw_crown(d):
 d.polygon([(8,21),(16,33),(24,16),(32,31),(42,14),(50,33),(57,20),(52,48),(13,48)],fill='#e8ae32',outline='#785029')
 d.polygon([(12,25),(19,35),(24,23),(31,35),(42,21),(48,35),(53,26),(48,43),(16,43)],fill='#ffda60')
 for x,y,col in [(18,36,'#a14a75'),(31,40,'#4b89c0'),(43,35,'#69a05a')]:d.ellipse((x-3,y-3,x+3,y+3),fill=col,outline='#5a5344')
 d.rectangle((12,44,53,51),fill='#d18b36',outline='#755027')

for nm,fun in [('crt_tv',draw_tv),('lava_lamp',draw_lava),('potted_plant',draw_plant),('p_poster',draw_poster),('rubber_duck',draw_duck),('mug',draw_mug),('floppy_disk',draw_floppy),('paper_crown',draw_crown)]:sprite(nm,fun)
# keep a manifest with pixels dimensions and anchor semantics
items={}
for nm in ['crt_tv','lava_lamp','potted_plant','p_poster','rubber_duck','mug','floppy_disk','paper_crown']:
 im=Image.open(os.path.join(ROOT,nm+'.png')); alpha=im.getchannel('A');items[nm]={'file':nm+'.png','dimensions':[128,128],'visible_bounds':list(alpha.getbbox()),'alpha':True,'pixelated':True,'candidate':True}
if os.path.isfile(os.path.join(ROOT,'pepegochi_adult_idle.png')):
 items['pepegochi_adult_idle']={'file':'pepegochi_adult_idle.png','dimensions':[128,128],'alpha':True,'candidate':True,'origin':'earlier approved visual reference / character sprite'}
with open(os.path.join(BASE,'ART_MANIFEST.json'),'w') as f:json.dump({'version':5,'room':{'file':'room_clean_base.png','dimensions':[640,400],'props_baked_in':False},'item_sprites':items,'status':'pixel-art functional candidate, artwork not final approved'},f,indent=2)
print('assets',len(os.listdir(ROOT)))