const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {lineDistance}=require('../road-decision.js');
function load({age=0,features=[],feeds=[{status:'downloaded',source:'Test DOT'}]}={}){
 const context=vm.createContext({window:{dustinDecision:{lineDistance}},document:{readyState:'loading',addEventListener(){}},native511:{},state:{incidentKeys:{}},stateAbbreviations:{Idaho:'ID'},Date,Promise,Map,
 requestJson:async url=>url.includes('state-sources')?{Idaho:{code:'ID'}}:{checkedAt:new Date(Date.now()-age).toISOString(),features,feeds},distanceMeters:(a,b)=>Math.hypot(a.lat-b.lat,a.lon-b.lon)*111195});
 vm.runInContext(fs.readFileSync('traffic-sources.js','utf8'),context);return context.window.dustinTraffic;
}
const feature=(change={})=>({type:'Feature',geometry:{type:'LineString',coordinates:[[-117,43],[-115,43]]},properties:{name:'Test road',closed:true,feedUpdatedAt:new Date().toISOString(),retrievedAt:new Date().toISOString(),end:new Date(Date.now()+3600000).toISOString(),...change}});
test('nearby work zones use segment distance and disclose partial snapshot coverage',async()=>{
 const result=await load({features:[feature()]}).nearby('Idaho',{lat:43,lon:-116});assert.equal(result.events.length,1);assert.equal(result.events[0].Cached,true);assert.match(result.summary,/Full 511 traffic feed not connected/);assert.match(result.summary,/snapshot/);
});
test('stale snapshots never become current full-closure flags',async()=>{
 const result=await load({age:3600000,features:[feature()]}).nearby('Idaho',{lat:43,lon:-116});assert.equal(result.events[0].IsFullClosure,false);assert.equal(result.events[0].ReportedClosure,true);assert.match(result.summary,/STALE/);
});
test('expired and future work zones are excluded',async()=>{
 const result=await load({features:[feature({end:new Date(Date.now()-1000).toISOString()}),feature({start:new Date(Date.now()+3600000).toISOString()})]}).nearby('Idaho',{lat:43,lon:-116});assert.equal(result.events.length,0);
});
test('missing feeds are explicitly unconnected, never a clear road',async()=>{
 const result=await load({feeds:[]}).nearby('Idaho',{lat:43,lon:-116});assert.equal(result.configured,false);assert.match(result.summary,/No public work-zone feed loaded/);
});
test('official source directory covers exactly all 50 states',()=>{
 const sources=JSON.parse(fs.readFileSync('data/state-sources.json'));assert.equal(Object.keys(sources).length,50);assert.equal(new Set(Object.values(sources).map(s=>s.code)).size,50);for(const value of Object.values(sources))assert.ok(value.url.startsWith('https://'));
});
test('public parking fallback is not mislabeled commercial truck stops',()=>{
 const data=JSON.parse(fs.readFileSync('data/parking-inventory.json'));assert.ok(data.elements.length>1900);assert.ok(data.elements.every(e=>e.categories.includes('parking')&&!e.categories.includes('stops')));assert.ok(data.elements.some(e=>e.categories.includes('weigh')));assert.ok(data.elements.some(e=>e.categories.includes('rest')));
});
