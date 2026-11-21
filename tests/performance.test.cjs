const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function requests(fetch){
 const source=fs.readFileSync('app.js','utf8');
 const start=source.indexOf('const pendingJson=');
 const end=source.indexOf('\nfunction normalizePlace',start);
 const context=vm.createContext({fetch,AbortController,DOMException,setTimeout,clearTimeout});
 vm.runInContext(source.slice(start,end),context);
 return context.requestJson;
}
test('concurrent requests share a fetch, but subsequent live weather is fetched again',async()=>{
 let calls=0;const request=requests(async()=>{calls++;return{ok:true,json:async()=>({current:{}})}});
 const url='https://api.open-meteo.com/v1/forecast?latitude=43';
 await Promise.all([request(url),request(url)]);assert.equal(calls,1);
 await request(url);assert.equal(calls,2);
});
test('place lookups reuse a bounded short-lived cache',async()=>{
 let calls=0;const request=requests(async()=>{calls++;return{ok:true,json:async()=>({features:[]})}});
 const url='https://photon.komoot.io/api/?q=Boise';
 await request(url);await request(url);assert.equal(calls,1);
});
test('road selection cancellation aborts the old fetch and leaves the new one independent',async()=>{
 let calls=0;const request=requests((url,{signal})=>new Promise((resolve,reject)=>{
  calls++;signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')));
  if(calls===2)resolve({ok:true,json:async()=>({current:{}})});
 }));
 const controller=new AbortController();
 const old=request('https://example.com/weather',1000,{},controller.signal);
 const rejection=assert.rejects(old,{name:'AbortError'});
 const next=request('https://example.com/weather',1000,{},new AbortController().signal);
 controller.abort();await rejection;await next;assert.equal(calls,2);
});
test('failed lookups are not cached',async()=>{
 let calls=0;const request=requests(async()=>{calls++;return{ok:false,status:503}});
 const url='https://photon.komoot.io/api/?q=Boise';
 await assert.rejects(request(url));await assert.rejects(request(url));assert.equal(calls,2);
});
test('versioned app shell loads from cache without network; live API requests bypass worker',async()=>{
 const listeners={};let fetches=0,responded=false;
 const context=vm.createContext({URL,location:{origin:'https://example.com'},self:{registration:{scope:'https://example.com/truck/'},addEventListener:(name,fn)=>listeners[name]=fn},caches:{open:async()=>({match:async()=>({status:200,fromCache:true})})},fetch:async()=>{fetches++;return{status:200}}});
 vm.runInContext(fs.readFileSync('sw.js','utf8'),context);
 let result;
 listeners.fetch({request:{method:'GET',url:'https://example.com/truck/index.html',mode:'navigate'},respondWith:p=>result=p});
 assert.equal((await result).fromCache,true);assert.equal(fetches,0);
 listeners.fetch({request:{method:'GET',url:'https://api.weather.gov/alerts/active',mode:'cors'},respondWith:()=>responded=true});assert.equal(responded,false);
 listeners.fetch({request:{method:'GET',url:'https://example.com/truck/missing.js',mode:'cors'},respondWith:()=>responded=true});assert.equal(responded,false);
});
test('cached application asset versions match the HTML',()=>{
 const html=fs.readFileSync('index.html','utf8'),worker=fs.readFileSync('sw.js','utf8');
 for(const [,asset] of html.matchAll(/(?:src|href)="(\.\/[^" ]+\.(?:js|css)\?v=\d+)"/g))assert.ok(worker.includes('"'+asset+'"'),asset);
});
