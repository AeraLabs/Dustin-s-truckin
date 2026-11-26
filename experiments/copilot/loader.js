// Removal: remove this script tag from index.html, then delete experiments/copilot.
(function(){
 function install(){
  const button=document.createElement('button');button.type='button';button.className='secondary-button';button.textContent='Try phone Copilot · experimental';
  document.querySelector('#settings-dialog .dialog-actions')?.before(button);
  let loading=false;
  button.onclick=async()=>{if(loading)return;loading=true;try{
   const {open}=await import('./panel.js');document.getElementById('settings-dialog')?.close();open();
  }catch{button.textContent='Could not open Copilot. Tap to retry.'}finally{loading=false}};
  if(new URLSearchParams(location.search).get('copilot')==='1')button.click();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
