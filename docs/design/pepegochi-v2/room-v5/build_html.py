import base64,os,json,re
root=os.path.dirname(os.path.abspath(__file__))
template=open(root+'/room_v5_template.html').read()
core=open(root+'/room_core.mjs').read()
core=re.sub(r'\bexport\s+','',core)
icons={}
for file in os.listdir(root+'/assets'):
 if not file.endswith('.png'):continue
 with open(root+'/assets/'+file,'rb') as f:
  icons[file[:-4]]='data:image/png;base64,'+base64.b64encode(f.read()).decode()
with open(root+'/assets/pepegochi_adult_idle.png','rb') as f:icons['pepegochi_adult_idle']='data:image/png;base64,'+base64.b64encode(f.read()).decode()
html=template.replace('__CORE__',core).replace('__IMAGES__',json.dumps(icons,separators=(',',':')))
assert all(key in html for key in ['room_clean_base','crt_tv','p_poster'])
assert 'fetch(' not in html and 'localStorage' in html  # Mentioned as not used in UI copy only
open(root+'/room_v5_standalone.html','w').write(html)
print('assets',len(icons),'bytes',len(html))