(function(){
  if(!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').then(reg=>{
    reg.update();
    reg.addEventListener('updatefound',()=>{
      const w=reg.installing;
      if(!w)return;
      w.addEventListener('statechange',()=>{
        if(w.state==='installed' && navigator.serviceWorker.controller) showUpdate();
      });
    });
  }).catch(()=>{});
  async function showUpdate(){
    if(document.getElementById('updateBanner'))return;
    const d=document.createElement('div');d.id='updateBanner';d.className='update-banner';
    d.innerHTML='<b>A trainer update is available.</b><br><button id="applyUpdate" class="primary">Update now</button>';
    document.body.appendChild(d);
    document.getElementById('applyUpdate').onclick=()=>{navigator.serviceWorker.getRegistration().then(r=>r&&r.waiting&&r.waiting.postMessage({type:'SKIP_WAITING'}));setTimeout(()=>location.reload(),500)};
  }
  navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload());
})();
