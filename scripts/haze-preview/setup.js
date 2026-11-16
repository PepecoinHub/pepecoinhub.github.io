const status=document.querySelector('[role=status]');
document.querySelector('button').onclick=async event=>{
  event.target.disabled=true;
  try{
    const response=await fetch('/__preview/vault');if(!response.ok)throw Error('Test wallet could not be loaded.');const record=await response.json();
    await new Promise((resolve,reject)=>{
      const request=indexedDB.open('doge_explorer_wallet',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('wallets');
      request.onerror=()=>reject(request.error);request.onsuccess=()=>{
        const db=request.result,tx=db.transaction('wallets','readwrite');tx.objectStore('wallets').put(record,'mainnet_v1');
        tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);
      };
    });
    location.href='/widget.html?standalone=1&preview-setup=1';
  }catch(error){status.textContent=error.message;event.target.disabled=false;}
};
