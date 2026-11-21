const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function harness(select){
 const elements=new Map(),requests=[];const el=id=>{if(!elements.has(id))elements.set(id,{hidden:true,dataset:{}});return elements.get(id)};
 const marker={addTo(){return this},setLatLng(){return this}};
 const context=vm.createContext({window:{L:{},dustinDecision:{select,update(){},incidents(){}}},L:{circleMarker:()=>marker},document:{readyState:'loading',addEventListener(){},getElementById:el},navigator:{onLine:true},localStorage:{getItem:()=>null,setItem(){}},AbortController,URLSearchParams,console,state:{map:{getZoom:()=>12,removeLayer(){}},stateFeatures:[],routeChoices:[]},roads:{Idaho:['Idaho 511','https://511.idaho.gov/']},stateFor:x=>x,reverse:async()=>({region:'Idaho'}),stateIncidents:async(name,point)=>{requests.push({events:point});return{events:[]}},requestJson:async url=>{requests.push({url});return url.includes('open-meteo')?{current:{temperature_2m:10,weather_code:0,wind_speed_10m:0,wind_gusts_10m:0}}:{features:[]}},assess:()=>({cls:'ok'}),label:()=>'Clear',mph:x=>x});
 vm.runInContext(fs.readFileSync('road-focus.js','utf8'),context);return{inspect:context.window.dustinRoadFocus.inspect,requests,elements};
}
test('weather, NWS and road reports use the snapped road location',async()=>{
 const h=harness(async(p,road)=>{road.name='I-84';return{point:{lat:43.7,lon:-116.1},name:'I-84',snapped:true,distance:800}});
 await h.inspect({lat:43.6,lng:-116.2});
 assert.ok(h.requests.find(r=>r.url?.includes('latitude=43.7&longitude=-116.1')));
 assert.ok(h.requests.find(r=>r.url?.includes('point=43.7,-116.1')));
 assert.equal(h.requests.find(r=>r.events).events.lat,43.7);
 assert.match(h.elements.get('focus-subtitle').textContent,/Snapped to highway/);
});
test('a slow earlier road match cannot launch stale condition checks',async()=>{
 let resolve;const h=harness((p,road)=>p.lat===43.6?new Promise(r=>resolve=r):Promise.resolve({point:{lat:44,lon:-116},name:'Next',snapped:true,distance:200}));
 const first=h.inspect({lat:43.6,lng:-116.2});await h.inspect({lat:44,lng:-116});
 resolve({point:{lat:43.7,lon:-116.1},name:'Old',snapped:true,distance:800});await first;
 assert.equal(h.requests.filter(r=>r.url?.includes('open-meteo')).length,1);
 assert.ok(h.requests.every(r=>!r.url?.includes('43.7')));
});
