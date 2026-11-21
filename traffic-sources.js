/* State-level coverage is explicit: public work-zone snapshots are not full live 511 traffic. */
(function(){
'use strict';
const snapshots=new Map();let directoryPromise=null,dialogRequest=0;
const byId=id=>document.getElementById(id);
function directory(){return directoryPromise||(directoryPromise=requestJson('./data/state-sources.json',6000).catch(e=>{directoryPromise=null;throw e}))}
async function snapshot(name){
 const sources=await directory(),code=sources[name]?.code;if(!code)throw Error('State not found');
 const cached=snapshots.get(code);if(cached&&Date.now()-cached.time<60000)return cached.data;
 const data=await requestJson('./data/roads/'+code+'.json?t='+Math.floor(Date.now()/60000),8000);
 if(!Array.isArray(data.features)||!Array.isArray(data.feeds))throw Error('Invalid state feed');
 snapshots.set(code,{time:Date.now(),data});return data;
}
function flattened(geometry){
 const c=geometry?.coordinates;if(!Array.isArray(c))return[];
 if(geometry.type==='Point')return[c];
 if(['LineString','MultiPoint'].includes(geometry.type))return c;
 if(['MultiLineString','Polygon'].includes(geometry.type))return c.flat();
 if(geometry.type==='MultiPolygon')return c.flat(2);
 return[];
}
function proximity(point,geometry){
 const c=flattened(geometry);if(!c.length)return Infinity;
 if(['Point','MultiPoint'].includes(geometry.type))return Math.min(...c.map(p=>distanceMeters(point,{lat:p[1],lon:p[0]})));
 // Evaluate each part independently; do not create imaginary links across disjoint lines.
 const lines=geometry.type==='LineString'?[c]:geometry.type==='MultiPolygon'?geometry.coordinates.flat():geometry.coordinates;
 return Math.min(...lines.map(line=>window.dustinDecision.lineDistance(point,line)));
}
async function nearby(name,point){
 const config=native511[name],hasKey=config&&!!state.incidentKeys[config.code];
 const [publicResult,nativeResult]=await Promise.allSettled([snapshot(name),hasKey?nativeStateIncidents(name,point):Promise.resolve(null)]);
 const data=publicResult.status==='fulfilled'?publicResult.value:null,native=nativeResult.status==='fulfilled'?nativeResult.value:null;
 const successful=data?.feeds.filter(f=>f.status==='downloaded')||[];
 const age=data?Date.now()-Date.parse(data.checkedAt):Infinity,fresh=age>=0&&age<45*60000;
 const features=(data?.features||[]).filter(f=>{
  const end=Date.parse(f.properties?.end),start=Date.parse(f.properties?.start);
  return (!Number.isFinite(end)||end>Date.now())&&(!Number.isFinite(start)||start<=Date.now())&&(!point||proximity(point,f.geometry)<8000);
 });
 const events=features.map(f=>{
  const p=f.properties,c=flattened(f.geometry)[0]||[];
  const feedTime=Date.parse(p.feedUpdatedAt),feedFresh=Number.isFinite(feedTime)&&Date.now()-feedTime<86400000&&feedTime<=Date.now()+300000;
  return {Latitude:c[1],Longitude:c[0],RoadwayName:p.name,Description:p.description,EventType:'Work-zone snapshot',IsFullClosure:!!p.closed&&fresh&&feedFresh,ReportedClosure:!!p.closed,geometry:f.geometry,Source:p.source,RetrievedAt:p.retrievedAt,FeedUpdatedAt:p.feedUpdatedAt,Cached:true,Stale:!fresh||!feedFresh};
 });
 if(native?.events)events.push(...native.events);
 const when=data?.checkedAt?new Date(data.checkedAt).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'';
 let summary=native?'511: '+native.events.length+' nearby official event(s). ':hasKey?'511 event feed unavailable. ':'Full 511 traffic feed not connected. ';
 summary+=successful.length?events.filter(e=>e.Cached).length+' nearby work-zone report(s) · snapshot '+when+(fresh?'':' · STALE')+'.':data?'No public work-zone feed loaded for '+name+'.':'Work-zone snapshot unavailable.';
 summary+=' Traffic speeds and pavement conditions are not covered.';
 return {supported:true,configured:!!native||successful.length>0,config:config||{code:stateAbbreviations[name]},events,summary,coverage:'partial',checkedAt:data?.checkedAt,stale:!fresh};
}
async function open(){
 const dialog=byId('traffic-dialog');dialog.showModal();
 const select=byId('traffic-state');
 try{
  const sources=await directory();
  select.innerHTML=Object.keys(sources).map(name=>'<option>'+esc(name)+'</option>').join('');
  const center=state.map?.getCenter();
  const region=state.selectedState||state.stateFeatures.find(f=>center&&pointInState([center.lng,center.lat],f))?.properties?.name||'Idaho';
  select.value=sources[region]?region:'Idaho';await show();
 }catch{byId('traffic-status').textContent='State directory unavailable. Try again online.'}
}
async function show(){
 const id=++dialogRequest,name=byId('traffic-state').value,sources=await directory();
 const link=byId('traffic-official');link.href=sources[name].url;link.textContent='Open '+sources[name].name;
 byId('traffic-status').textContent='Checking published feed coverage…';byId('traffic-count').textContent='';
 try{
  const data=await snapshot(name);if(id!==dialogRequest)return;
  const feeds=data.feeds.filter(f=>f.status==='downloaded');
  const age=Date.now()-Date.parse(data.checkedAt);
  byId('traffic-status').textContent=feeds.length?'Public work-zone snapshot · '+(age<45*60000?'recently retrieved':'stale')+' · '+new Date(data.checkedAt).toLocaleString():data.requiresKey?'A registered work-zone feed requires an API key. Full traffic is not connected.':'No public work-zone feed loaded. Use the official state source below.';
  byId('traffic-count').textContent=feeds.length?data.features.length+' published work-zone features from '+feeds.map(f=>f.source).join(', ')+'. This does not include every closure, crash, traffic speed or road condition.':'';
 }catch{if(id===dialogRequest)byId('traffic-status').textContent='Feed unavailable. The official state source is still accessible below.'}
}
function setup(){
 const dialog=document.createElement('dialog');dialog.id='traffic-dialog';dialog.className='settings-dialog';
 dialog.innerHTML='<form method="dialog"><div class="dialog-head"><h2>State road reports</h2><button class="icon-button" aria-label="Close state road reports">×</button></div></form><label class="truck-field">State<select id="traffic-state" aria-label="State road report source"></select></label><p id="traffic-status" role="status"></p><p id="traffic-count"></p><a id="traffic-official" class="traffic-official" target="_blank" rel="noopener noreferrer">Official state road reports</a><p class="dialog-help">All 50 states have official sources here. Only successfully retrieved feeds are shown as connected. Work-zone snapshots refresh on a scheduled basis, not instantly.</p>';
 document.body.appendChild(dialog);byId('traffic-state').onchange=show;
}
window.dustinTraffic={nearby,open,snapshot};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();
