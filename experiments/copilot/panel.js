import './commands.js';
const {commands,validate,exact}=globalThis.RigCopilotCommands;
let panel,worker,ready=false,busy=false,recognizer,request=0,timer,pending='unknown',listening=false;
const el=id=>document.getElementById('copilot-'+id);
function status(text){el('status').textContent=text}
function output(text){el('output').textContent=text;if(el('speak').checked&&window.speechSynthesis){const voice=speechSynthesis.getVoices().find(v=>v.localService&&v.lang.startsWith('en'));if(voice){speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.voice=voice;speechSynthesis.speak(u)}}}
function stop(){request++;clearTimeout(timer);worker?.terminate();worker=null;ready=false;busy=false;recognizer?.abort();recognizer=null;listening=false;window.speechSynthesis?.cancel();pending='unknown';el('apply').hidden=true;el('load').disabled=false;el('mic').textContent='Tap to speak';status('Stopped. Exact commands still work; local AI is off.')}
function execute(key){
 const click=selector=>{const target=document.querySelector(selector);if(!target)throw Error('That control is unavailable.');target.click()};
 try{
  if(key==='light'||key==='dark'){const select=document.getElementById('theme-preference');if(!select)throw Error('Theme unavailable.');select.value=key;select.dispatchEvent(new Event('change',{bubbles:true}))}
  else if(key==='zoom_in'||key==='zoom_out'){click(key==='zoom_in'?'.leaflet-control-zoom-in':'.leaflet-control-zoom-out')}
  else if(['parking','stops','rest','weigh'].includes(key)){if(!window.dustinPlaces)throw Error('Map is not ready.');window.dustinPlaces.show(key)}
  else if(key==='clear_pins')window.dustinPlaces?.clear();
  else if(['trips','map','sources','conditions'].includes(key))click(`.cockpit-tab[data-mode="${({map:'places',sources:'511'})[key]||key}"]`);
  else {output('Try one of the example commands. This test cannot answer road-safety questions or change your route.');return}
  output(`${commands[key]}. Requested in the app.`);
 }catch(e){output(e.message)}
}
function submit(text){
 if(busy||listening)return;
 text=text.trim();if(!text)return;
 pending='unknown';el('apply').hidden=true;
 const command=exact(text);
 if(command!=='unknown'){status('Exact command · no model needed');execute(command);return}
 if(!ready){output('Load the local model for other wording, or use an exact example below.');return}
 busy=true;status('Interpreting on this phone…');const id=++request;worker.postMessage({type:'command',text:text.slice(0,240),id});
 timer=setTimeout(()=>{stop();output('Local AI took too long and was stopped. Try an exact command.');},45000);
}
function load(){
 if(worker)return;
 if(!window.isSecureContext||!window.Worker||!window.WebAssembly||!window.caches){status('This browser cannot run the local model. Exact typed commands remain available.');return}
 el('load').disabled=true;status('Loading local AI. First download may take several minutes…');
 try{worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'})}catch{stop();status('This browser could not start local AI. Exact commands still work.');return}
 const currentWorker=worker;
 worker.onmessage=({data})=>{
  if(worker!==currentWorker)return;
  if(data.type==='progress'){status(data.text);return}
  if(data.type==='ready'){ready=true;clearTimeout(timer);status('Local model ready · CPU mode');return}
  if(data.type==='error'){stop();status('Local AI unavailable: '+data.text);return}
  if(data.type==='result'&&data.id===request){clearTimeout(timer);busy=false;pending=validate(data.text);status('Interpreted locally · review before applying');output(pending==='unknown'?'I could not match one supported command. Try an exact example.':`Suggested action: ${commands[pending]}`);el('apply').hidden=pending==='unknown'}
 };
 worker.onerror=()=>{stop();status('Could not load local AI. Check connection and available phone memory; exact commands still work.')};
 timer=setTimeout(()=>{stop();status('Download timed out. Retry on Wi-Fi; already cached files can be reused.')},300000);
 worker.postMessage({type:'load'});
}
function microphone(){
 if(listening){recognizer?.stop();return}
 if(busy){status('Wait for the current command or tap Stop.');return}
 if(!el('consent').checked){status('Enable browser speech permission below first. Audio may go to your browser provider.');return}
 const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Recognition){status('Voice input is unavailable in this browser. Type a command instead.');return}
 window.speechSynthesis?.cancel();recognizer=new Recognition();recognizer.lang='en-US';recognizer.continuous=false;recognizer.interimResults=false;
 const current=recognizer;listening=true;el('mic').textContent='Stop listening';
 current.onresult=e=>{if(current!==recognizer)return;listening=false;const text=e.results[0][0].transcript;el('text').value=text;submit(text)};
 current.onerror=e=>{if(current===recognizer)status('Voice input: '+e.error+'. You can type instead.')};
 current.onend=()=>{if(current!==recognizer)return;listening=false;el('mic').textContent='Tap to speak'};
 try{current.start();status('Listening for one command…')}catch{listening=false;el('mic').textContent='Tap to speak';status('Microphone unavailable. Type a command instead.')}
}
export function open(){
 if(panel){panel.hidden=false;return}
 const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('./style.css',import.meta.url);document.head.append(css);
 panel=document.createElement('section');panel.id='copilot-panel';panel.setAttribute('aria-label','Experimental phone Copilot');
 panel.innerHTML=`<header><div><small>RIGAHEAD · PHONE EXPERIMENT</small><h2>Local Copilot</h2></div><button id="copilot-close" aria-label="Close Copilot">×</button></header>
 <p>A small model runs on your phone. First download uses roughly 250 MB including runtime; use Wi-Fi. No account or AI API key. Test while parked.</p>
 <button id="copilot-load">Download / load local AI</button><p id="copilot-status" role="status">Off · exact commands available without a model</p>
 <form id="copilot-form"><label for="copilot-text">Your command</label><input id="copilot-text" maxlength="240" autocomplete="off" placeholder="Show truck parking"><button>Send command</button></form>
 <div class="copilot-actions"><button id="copilot-mic">Tap to speak</button><button id="copilot-stop">Stop AI / audio</button></div>
 <label><input type="checkbox" id="copilot-consent"> Allow browser speech input. Audio may be processed online by the browser provider.</label>
 <label><input type="checkbox" id="copilot-speak"> Speak replies when a local device voice is available.</label>
 <p id="copilot-output" aria-live="polite">Try: “dark mode”, “zoom in”, “show truck parking”, “show rest areas”, “open trip planner”, “open official sources”. Other wording uses the model and asks you to apply its suggestion.</p>
 <button id="copilot-apply" hidden>Apply suggested action</button>
 <p class="copilot-note">Experimental app controls only. No automatic rerouting, road-safety answers, background listening or wake word. Maps and road data still need their usual connections.</p>
 <button id="copilot-remove">Remove downloaded model & disable</button>`;
 document.body.append(panel);
 el('load').onclick=load;el('stop').onclick=stop;el('mic').onclick=microphone;
 el('consent').onchange=()=>{if(!el('consent').checked){recognizer?.abort();recognizer=null;listening=false;el('mic').textContent='Tap to speak'}};
 el('speak').onchange=()=>{if(!el('speak').checked)window.speechSynthesis?.cancel()};
 el('close').onclick=()=>{stop();panel.hidden=true};
 el('form').onsubmit=e=>{e.preventDefault();submit(el('text').value)};
 el('apply').onclick=()=>{const key=pending;pending='unknown';el('apply').hidden=true;execute(key)};
 el('remove').onclick=async()=>{stop();try{await caches.delete('rigahead-copilot-model-v1');el('text').value='';el('consent').checked=false;el('speak').checked=false;const url=new URL(location.href);url.searchParams.delete('copilot');history.replaceState(null,'',url);output('Downloaded model removed. Copilot is disabled until you load it again.');status('Disabled · model cache removed')}catch{status('AI stopped, but model removal failed. Retry or remove this site’s stored data in browser settings.')}};
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
 window.addEventListener('pagehide',stop);
}
