const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
function harness(){
 const elements=new Map();const get=id=>{if(!elements.has(id))elements.set(id,{textContent:'',hidden:false,checked:false,value:'',disabled:false,append(){},setAttribute(){}});return elements.get(id)};
 const workers=[];let timeout;
 const context={console,URL,Event,clearTimeout(){},setTimeout(fn){timeout=fn;return 1},location:{href:'https://example.com/?copilot=1'},history:{replaceState(){}},caches:{open:async()=>({}),delete:async()=>true},WebAssembly:{},RigCopilotCommands:require('../experiments/copilot/commands.js'),document:{hidden:false,getElementById:get,createElement:()=>({setAttribute(){}}),head:{append(){}},body:{append(){}},addEventListener(){},querySelector:()=>null},Worker:class{constructor(){workers.push(this)}postMessage(data){this.sent=data}terminate(){this.terminated=true}}};context.window=context;context.isSecureContext=true;context.addEventListener=()=>{};
 vm.createContext(context);const code=fs.readFileSync('experiments/copilot/panel.js','utf8').replace("import './commands.js';",'').replaceAll('import.meta.url',"'https://example.com/experiments/copilot/panel.js'").replace('export function open','function open');vm.runInContext(code,context);vm.runInContext('open()',context);return{get,workers,run:s=>vm.runInContext(s,context),timeout:()=>timeout()};
}
test('stopping cancels an outstanding local interpretation and ignores its late result',()=>{
 const h=harness();h.run('load()');const w=h.workers[0];w.onmessage({data:{type:'ready'}});h.run("submit('Make it brighter')");const id=w.sent.id;h.run('stop()');w.onmessage({data:{type:'result',id,text:'light'}});assert.equal(w.terminated,true);assert.equal(h.get('copilot-apply').hidden,true);assert.match(h.get('copilot-status').textContent,/Stopped/);
});
test('local model results require explicit apply; invalid results cannot be applied',()=>{
 const h=harness();h.run('load()');const w=h.workers[0];w.onmessage({data:{type:'ready'}});h.run("submit('Make it brighter')");w.onmessage({data:{type:'result',id:w.sent.id,text:'light'}});assert.equal(h.get('copilot-apply').hidden,false);assert.match(h.get('copilot-output').textContent,/Suggested action/);h.run("submit('is this road safe')");w.onmessage({data:{type:'result',id:w.sent.id,text:'The road is clear'}});assert.equal(h.get('copilot-apply').hidden,true);
});
test('timeout terminates inference and removal resets consent without clearing app data',async()=>{
 const h=harness();h.run('load()');const w=h.workers[0];w.onmessage({data:{type:'ready'}});h.run("submit('Make it brighter')");h.timeout();assert.equal(w.terminated,true);h.get('copilot-consent').checked=true;await h.get('copilot-remove').onclick();assert.equal(h.get('copilot-consent').checked,false);assert.match(h.get('copilot-status').textContent,/cache removed/);
});
