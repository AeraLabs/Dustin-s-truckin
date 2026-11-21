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
// Project onto complete segments, not just OSM vertices.
function closestPoint(point,geometry){
 let best={distance:Infinity};const scale=Math.max(.01,Math.cos(point.lat*Math.PI/180));
 for(let i=1;i<geometry.length;i++){
  const a=geometry[i-1],b=geometry[i];
  const x=(a[0]-point.lon)*scale,y=a[1]-point.lat,dx=(b[0]-a[0])*scale,dy=b[1]-a[1],length=dx*dx+dy*dy;
  const t=length?Math.max(0,Math.min(1,-(x*dx+y*dy)/length)):0;
  const distance=Math.hypot(x+t*dx,y+t*dy)*111195;
  if(distance<best.distance)best={distance,point:{lat:a[1]+t*(b[1]-a[1]),lon:a[0]+t*(b[0]-a[0])}};
 }
 return best;
}
function snapRadius(lat,zoom){return Math.min(5000,Math.max(800,72*156543.03392*Math.cos(lat*Math.PI/180)/2**zoom))}
function chooseRoad(point,ways,radius,direct=40){
 const matches=ways.filter(w=>w.geometry?.length>1&&!/^(footway|path|steps|cycleway|bridleway|construction|proposed)$/.test(w.tags?.highway||''))
 .map(way=>({way,...closestPoint(point,way.geometry.map(p=>[p.lon,p.lat]))})).filter(m=>m.distance<=radius).sort((a,b)=>a.distance-b.distance);
 const hit=matches.find(m=>m.distance<=direct);
 // Preserve deliberate local-road taps. Off-road taps prefer through highways, not ramps or tracks.
 const match=hit||matches.find(m=>/^(motorway|trunk|primary)$/.test(m.way.tags?.highway||''));
 return match?{...match,snapped:!hit}:null;
}
function rankRoutes(routes,point,speed=55){
 const baseline=routes[0];
 return routes.map((route,index)=>({index,miles:Math.round(route.distance/1609.34),minutes:Math.round(route.distance/1609.34/speed*60),extraMiles:Math.round((route.distance-(baseline?.distance||0))/1609.34),near:point?lineDistance(point,route.geometry?.coordinates||[])<800:null}))
 .sort((a,b)=>Number(a.near)-Number(b.near)||a.minutes-b.minutes);
}
if(typeof module==='object'&&module.exports){module.exports={segmentDistance,lineDistance,rankRoutes,closestPoint,chooseRoad,snapRadius};return}
let token=0,controller=null,selected=null,line=null,halo=null,pin=null,eventsLayer=null,status='Checking nearby data',tone='loading',routesOpen=false;
const colors={loading:'#288ddd',ok:'#288ddd',caution:'#d59319',danger:'#d84639',cached:'#92734b',unavailable:'#788995'};
const el=id=>document.getElementById(id);
const coords=way=>(way.geometry||[]).map(p=>[p.lon,p.lat]);
function clear(){token++;controller?.abort();for(const layer of [line,halo,pin,eventsLayer])if(layer)state.map?.removeLayer(layer);line=halo=pin=eventsLayer=null;selected=null;routesOpen=false;if(el('decision-routes'))el('decision-routes').hidden=true}
function paint(){
 if(!selected||!state.map||!window.L)return;
 const color=["danger","caution"].includes(tone)?colors[tone]:colors.loading;
 if(line)line.setStyle({color,dashArray:null});
 if(pin)pin.setTooltipContent(esc((selected.name||'Selected point')+(selected.snapped?' · Snapped to highway':'')+' · '+status));
}
function draw(geometry,name){
 if(!selected||!state.map)return;
 if(line)state.map.removeLayer(line);
 if(halo)state.map.removeLayer(halo);
 halo=L.polyline(geometry.map(c=>[c[1],c[0]]),{color:'#fff',weight:15,opacity:.95,interactive:false}).addTo(state.map);
 line=L.polyline(geometry.map(c=>[c[1],c[0]]),{color:colors[tone],weight:9,opacity:.95,interactive:false}).addTo(state.map);
 selected.name=name;selected.geometry=geometry;
 if(el('focus-title'))el('focus-title').textContent=name;
 paint();
}
async function select(point,road){
 clear();const id=token;selected={...point,name:road.name||'Selected point'};tone='loading';status='Finding road';
 controller=new AbortController();
 pin=L.circleMarker([point.lat,point.lon],{radius:7,weight:3,color:'#fff',fillColor:'#288ddd',fillOpacity:1,interactive:false})
 .bindTooltip('',{permanent:true,direction:'top',offset:[0,-12],className:'decision-label'}).addTo(state.map);paint();
 routesOpen=false;renderRoutes();
 function apply(match){
  const name=(match.way.tags?.ref||match.way.tags?.name||'Mapped road').replace(/;/g,' / ').replace(/\bI (?=\d)/g,'I-');
  road.name=name;road.snapped=match.snapped;road.snapDistance=match.distance;
  Object.assign(selected,match.point,{snapped:match.snapped});pin.setLatLng([match.point.lat,match.point.lon]);
  status='Checking nearby data';draw(coords(match.way),name);renderRoutes();
  if(match.snapped)state.map.panInside([match.point.lat,match.point.lon],{paddingTopLeft:[35,90],paddingBottomRight:[35,Math.max(440,state.map.getSize().y-210)]});
  return {point:match.point,name,snapped:match.snapped,distance:match.distance};
 }
 if(road.geometry?.length>1){
  const match=closestPoint(point,road.geometry);Object.assign(selected,match.point);pin.setLatLng([match.point.lat,match.point.lon]);
  draw(road.geometry,road.name||'Selected road');return {point:match.point,name:road.name,snapped:false,distance:match.distance};
 }
 const zoom=state.map.getZoom(),radius=snapRadius(point.lat,zoom);
 const known=chooseRoad(point,[...state.roadDataCache.values()].flat(),radius);
 if(known&&(!known.snapped||!navigator.onLine))return apply(known);
 if(zoom<8){selected.name='Zoom closer to identify a road';paint();return null}
 if(!navigator.onLine){selected.name='Offline · road geometry unavailable';tone='cached';paint();return null}
 try{
  const at=point.lat+','+point.lon;
  const query='[out:json][timeout:8];(way(around:150,'+at+')["highway"]["highway"!~"footway|path|steps|cycleway|bridleway|construction|proposed"];way(around:'+Math.round(radius)+','+at+')["highway"~"^(motorway|trunk|primary)$"];);out tags geom;';
  const data=await requestJson('https://ovp.dresel.systems/api-na/interpreter?'+new URLSearchParams({data:query}),10000,{Accept:'application/json'},controller.signal);
  if(id!==token)return null;
  if(data.remark||!Array.isArray(data.elements))throw Error('Incomplete road lookup');
  const ways=data.elements.filter(w=>w.geometry?.length>1),match=chooseRoad(point,ways,radius);
  state.roadDataCache.set('tap:'+point.lat.toFixed(3)+','+point.lon.toFixed(3),ways);
  if(state.roadDataCache.size>12)state.roadDataCache.delete(state.roadDataCache.keys().next().value);
  if(!match){selected.name='No nearby highway found · selected point';paint();return null}
  return apply(match);
 }catch{if(id===token){if(known)return apply(known);selected.name='Selected point · road lookup unavailable';paint()}return null}
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
