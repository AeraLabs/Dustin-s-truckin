/* Theme selection is independent of trip preferences and applies before first paint. */
(function(){
 const media=matchMedia('(prefers-color-scheme: light)');
 let preference='system';
 try{preference=localStorage.getItem('dustins-theme')||'system'}catch{}
 if(!['light','dark','system'].includes(preference))preference='system';
 function apply(){
  const theme=preference==='system'?(media.matches?'light':'dark'):preference;
  document.documentElement.dataset.theme=theme;
  document.querySelector('meta[name="theme-color"]').content=theme==='light'?'#f4f7fa':'#0b0e11';
  const button=document.getElementById('theme-toggle');
  if(button){button.textContent=theme==='light'?'☾ Dark':'☀ Light';button.setAttribute('aria-label','Switch to '+(theme==='light'?'dark':'light')+' mode')}
  const select=document.getElementById('theme-preference');if(select)select.value=preference;
 }
 function choose(value){preference=value;try{localStorage.setItem('dustins-theme',value)}catch{}apply()}
 function setup(){
  const button=document.createElement('button');button.id='theme-toggle';button.type='button';button.className='theme-toggle';
  document.querySelector('.topbar-right').prepend(button);
  button.onclick=()=>choose(document.documentElement.dataset.theme==='light'?'dark':'light');
  const row=document.createElement('label');row.className='setting-row';
  row.innerHTML='<span><strong>Appearance</strong><small>Use light, dark or your device setting.</small></span><select id="theme-preference"><option value="system">Device</option><option value="light">Light</option><option value="dark">Dark</option></select>';
  document.querySelector('#settings-dialog .dialog-head').after(row);
  row.querySelector('select').onchange=e=>choose(e.target.value);
  media.addEventListener('change',()=>{if(preference==='system')apply()});
  apply();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();
