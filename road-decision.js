/* Road selection geometry and quick route comparisons. No fabricated traffic coverage. */
(function(root){
'use strict';
function segmentDistance(point,a,b){
 const scale=Math.cos(point.lat*Math.PI/180),x=(a[0]-point.lon)*scale,y=a[1]-point.lat;
 const dx=(b[0]-a[0])*scale,dy=b[1]-a[1],length=dx*dx+dy*dy;
 const t=length?Math.max(0,Math.min(1,-(x*dx+y*dy)/length)):0;
 return Math.hypot(x+t*dx,y+t*dy)*111195;
}
function lineDistance(point,coords){let best=Infinity;for(let i=1;i<coords.length;i++)best=Math.min(best,segmentDistance(point,coords[i-1],coords[i]));return best}
function rankRoutes(routes,point,speed=55){
 const baseline=routes[0];
 return routes.map((route,index)=>({index,miles:Math.round(route.distance/1609.34),minutes:Math.round(route.distance/1609.34/speed*60),extraMiles:Math.round((route.distance-(baseline?.distance||0))/1609.34),near:point?lineDistance(point,route.geometry?.coordinates||[])<800:null}))
 .sort((a,b)=>Number(a.near)-Number(b.near)||a.minutes-b.minutes);
}
if(typeof module==='object'&&module.exports){module.exports={segmentDistance,lineDistance,rankRoutes};return}
let token=0,controller=null,selected=null,line=null,pin=null,eventsLayer=null,status='Checking nearby data',tone='loading',routesOpen=false;
const colors={loading:'#288ddd',ok:'#288ddd',caution:'#d59319',danger:'#d84639',cached:'#92734b',unavailable:'#788995'};
const el=id=>document.getElementById(id);
const coords=way=>(way.geometry||[]).map(p=>[p.lon,p.lat]);
function clear(){token++;controller?.abort();for(const layer of [line,pin,eventsLayer])if(layer)state.map?.removeLayer(layer);line=pin=eventsLayer=null;selected=null;routesOpen=false;if(el('decision-routes'))el('decision-routes').hidden=true}
function paint(){
 if(!selected||!state.map||!window.L)return;
 const color=colors[tone]||colors.loading;
 if(line)line.setStyle({color,dashArray:['loading','cached','unavailable'].includes(tone)?'8 7':null});
 if(pin)pin.setTooltipContent(esc((selected.name||'Selected point')+' · '+status));
}
function draw(geometry,name){
 if(!selected||!state.map)return;
 if(line)state.map.removeLayer(line);
 line=L.polyline(geometry.map(c=>[c[1],c[0]]),{color:colors[tone],weight:9,opacity:.95,interactive:false}).addTo(state.map);
 selected.name=name;selected.geometry=geometry;
 if(el('focus-title'))el('focus-title').textContent=name;
 paint();
}
function nearest(point,ways){let match=null,distance=150;for(const way of ways){const c=coords(way),d=lineDistance(point,c);if(d<distance){distance=d;match=way}}return match}
async function select(point,road){
 clear();const id=token;selected={...point,name:road.name||'Selected point'};tone='loading';status='Checking nearby data';
 controller=new AbortController();
 pin=L.circleMarker([point.lat,point.lon],{radius:7,weight:3,color:'#fff',fillColor:'#288ddd',fillOpacity:1,interactive:false})
 .bindTooltip('',{permanent:true,direction:'top',offset:[0,-12],className:'decision-label'}).addTo(state.map);paint();
 routesOpen=false;renderRoutes();
 if(road.geometry?.length){draw(road.geometry,road.name||'Selected road');return}
 const cached=[...state.roadDataCache.values()].flat();const known=nearest(point,cached);
 if(known){road.name=known.tags?.name||known.tags?.ref||'Mapped road';draw(coords(known),road.name);return}
 if(state.map.getZoom()<10){status='Zoom closer to identify a road';paint();return}
 if(!navigator.onLine){status='Offline · road geometry unavailable';tone='cached';paint();return}
 try{
  const query='[out:json][timeout:6];way(around:180,'+point.lat+','+point.lon+')["highway"]["highway"!~"footway|path|steps|cycleway|bridleway"];out tags geom 35;';
  const data=await requestJson('https://ovp.dresel.systems/api-na/interpreter?'+new URLSearchParams({data:query}),7500,{Accept:'application/json'},controller.signal);
  if(id!==token)return;
  const ways=(data.elements||[]).filter(w=>w.geometry?.length>1),way=nearest(point,ways);
  if(!way){selected.name='Selected point · road not identified';paint();return}
  state.roadDataCache.set('tap:'+point.lat.toFixed(3)+','+point.lon.toFixed(3),ways);
  if(state.roadDataCache.size>12)state.roadDataCache.delete(state.roadDataCache.keys().next().value);
  road.name=way.tags?.name||way.tags?.ref||'Mapped road';draw(coords(way),road.name);
 }catch{if(id===token){selected.name='Selected point · road lookup unavailable';paint()}}
}
function update(label,type){if(!selected)return;status=label;tone=type;paint()}
function incidents(events){
 if(!selected)return;
 if(eventsLayer)state.map.removeLayer(eventsLayer);
 eventsLayer=L.layerGroup().addTo(state.map);
 for(const event of events){
  if(event.Latitude==null||event.Longitude==null)continue;
  const lat=+event.Latitude,lon=+event.Longitude;if(!Number.isFinite(lat)||!Number.isFinite(lon))continue;
  const closed=event.IsFullClosure===true||event.IsFullClosure==='true';
  if(event.geometry)L.geoJSON({type:'Feature',geometry:event.geometry,properties:{}},{style:{color:event.ReportedClosure?'#d84639':'#d59319',weight:6,dashArray:'6 5'},interactive:false}).addTo(eventsLayer);
  L.circleMarker([lat,lon],{radius:9,color:'#fff',weight:2,fillColor:closed?'#d84639':'#d59319',fillOpacity:1})
   .bindTooltip(closed?'Reported closure nearby':'Reported event nearby')
   .bindPopup('<strong>'+esc(event.RoadwayName||'Nearby road event')+'</strong><p>'+esc(event.Description||event.EventType||'Official 511 event')+'</p><small>'+esc(event.Cached?'Work-zone snapshot · retrieved '+new Date(event.RetrievedAt).toLocaleString()+(event.Stale?' · STALE':''):'Official 511 report')+'</small><small>Nearby report; road and direction may differ from your selection.</small>').addTo(eventsLayer);
 }
}
function renderRoutes(){
 const panel=el('decision-routes');if(!panel)return;panel.hidden=!routesOpen;
 const shortcut=el('decision-alternatives');if(shortcut)shortcut.textContent=state.routeChoices.length>1?state.routeChoices.length+' routes':'Other routes';
 if(!routesOpen)return;
 const routes=state.routeChoices||[];
 const ranked=rankRoutes(routes,selected,state.settings.speed);
 el('decision-route-list').innerHTML=ranked.length?ranked.map(r=>'<button type="button" data-decision-route="'+r.index+'"><strong>Route '+(r.index+1)+' · '+r.miles+' mi · '+Math.floor(r.minutes/60)+'h '+r.minutes%60+'m</strong><small>'+(r.near===null?'Available route':r.near?'Within ½ mile of selected point':'Outside ½ mile of selected point')+' · '+(r.extraMiles>0?'+':'')+r.extraMiles+' mi vs Route 1</small><span>Preview route</span></button>').join(''):'<p>Set a start and destination with Plan trip to load available routes.</p>';
 el('decision-route-note').textContent=ranked.length?'Geographic comparison only. Traffic, closures, bridge clearance and truck restrictions are not checked for these alternatives.':'Route alternatives need a destination. The service may return only one route.';
 panel.querySelectorAll('[data-decision-route]').forEach(button=>button.onclick=()=>{routesOpen=false;panel.hidden=true;window.dustinRoadFocus.previewAlternative(+button.dataset.decisionRoute)});
}
function setup(){
 const dock=el('map-dock');if(!dock)return;
 const shortcuts=document.createElement('nav');shortcuts.className='driver-shortcuts';shortcuts.setAttribute('aria-label','Long haul shortcuts');
 shortcuts.innerHTML='<button type="button" data-stop="stops">Truck stops</button><button type="button" data-stop="parking">Truck parking</button><button type="button" data-stop="rest">Rest areas / stops</button><button type="button" data-stop="weigh">Weigh stations</button><button type="button" data-stop="fuel">Fuel</button><button type="button" id="decision-511">511 reports</button>';
 dock.appendChild(shortcuts);
 const alternatives=document.createElement('button');alternatives.id='decision-alternatives';alternatives.type='button';alternatives.textContent='Other routes';el('road-focus-actions').insertBefore(alternatives,el('focus-tools'));
 el('decision-511').onclick=()=>window.dustinTraffic?.open();
 shortcuts.querySelectorAll('[data-stop]').forEach(button=>button.onclick=()=>window.dustinPlaces?.show(button.dataset.stop));
 el('decision-alternatives').onclick=()=>{routesOpen=!routesOpen;renderRoutes()};
 const panel=document.createElement('section');panel.id='decision-routes';panel.className='decision-routes';panel.hidden=true;panel.setAttribute('aria-label','Route alternatives');
 panel.innerHTML='<div class="decision-heading"><strong>Compare routes</strong><button type="button" id="decision-close" aria-label="Close route alternatives">×</button></div><div id="decision-route-list"></div><p id="decision-route-note"></p>';
 document.querySelector('.map-wrap').appendChild(panel);el('decision-close').onclick=()=>{routesOpen=false;panel.hidden=true};
 const compare=el('focus-compare');compare.addEventListener('click',event=>{if(state.routeChoices.length>1&&compare.textContent!=='Check alternative weather'){event.stopImmediatePropagation();routesOpen=true;renderRoutes()}},true);
 document.addEventListener('keydown',event=>{if(event.key==='Escape'){routesOpen=false;panel.hidden=true}});
}
root.dustinDecision={select,update,incidents,clear,refresh:renderRoutes,lineDistance};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})(typeof window==='undefined'?globalThis:window);
