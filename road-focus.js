/* Dustin's Trucking — map tap weather and offline trip snapshot UX.
   A point forecast is not a verified report for the road surface or truck restrictions. */
(function(){
"use strict";
const $f=id=>document.getElementById(id);
const KEY="dustins-road-point-cache-v1";
let inspectionController=null;
let lastRequest=0,previewLine=null,indicator=null,altLine=null,previewIndex=null;
const readCache=()=>{try{return JSON.parse(localStorage.getItem(KEY)||"{}")}catch{return{}}};
const formatTime=t=>{const d=new Date(t);return Number.isFinite(d.getTime())?d.toLocaleString([],{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}):"unknown date"};
const html=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&quot;"}[c]));
function cacheKey(point){return point.lat.toFixed(3)+":"+point.lon.toFixed(3)}
function storePoint(point,item){
 try{
  const cache=readCache();cache[cacheKey(point)]={...item,checkedAt:new Date().toISOString()};
  const ordered=Object.entries(cache).sort((a,b)=>new Date(b[1].checkedAt)-new Date(a[1].checkedAt)).slice(0,25);
  localStorage.setItem(KEY,JSON.stringify(Object.fromEntries(ordered)));
 }catch(e){console.info("Road point cache unavailable",e)}
}
function setConnection(){
 const b=$f("focus-network");
 if(!b)return;
 b.textContent=navigator.onLine?"NETWORK AVAILABLE":"OFFLINE";
 b.dataset.online=String(navigator.onLine);
}
function setCard({name,subtitle,tag,tagType,weather,alerts,events,source,details,link}){
 const card=$f("road-focus-card");if(!card)return;
 card.hidden=false;
 window.dustinDecision?.update(tag||"Checking",tagType||"loading");
 $f("focus-title").textContent=name||"Selected map point";
 $f("focus-subtitle").textContent=subtitle||"Weather near selected point";
 $f("focus-tag").textContent=tag||"CHECKING";
 $f("focus-tag").dataset.type=tagType||"loading";
 $f("focus-weather").textContent=weather||"Requesting nearby conditions…";
 $f("focus-alerts").textContent=alerts||"NWS alerts: checking…";
 $f("focus-events").textContent=events||"Official 511: not confirmed";
 $f("focus-source").textContent=source||"Point forecast · not verified road surface";
 $f("focus-details").textContent=details||"";
 const l=$f("focus-dot-link");
 l.hidden=!link;
 if(link){l.href=link.url;l.textContent=link.text||"Official 511 / DOT";}
 const choices=state.routeChoices||[];
 const compare=$f("focus-compare");
 compare.textContent=choices.length>1?"Compare "+choices.length+" routes":state.route?"Review trip":"Plan a trip";
}
function closeCard(){window.dustinDecision?.clear();inspectionController?.abort();lastRequest++;previewIndex=null;$f("road-focus-card").hidden=true;if(indicator&&state.map){state.map.removeLayer(indicator);indicator=null}if(altLine&&state.map){state.map.removeLayer(altLine);altLine=null}}
function cachedWeather(item){
 if(!item)return"";
 return [item.temperature!=null?item.temperature+"°F":null,item.condition,item.wind!=null?"Wind "+item.wind+" mph":null,item.gust!=null?"Gust "+item.gust+" mph":null].filter(Boolean).join(" · ");
}
function cachedPoint(point,record){
 setCard({name:record.name||"Cached nearby conditions",
 subtitle:"OFFLINE SNAPSHOT · "+formatTime(record.checkedAt),
 tag:"CACHED — NOT LIVE",tagType:"cached",
 weather:cachedWeather(record),
 alerts:record.alerts||"NWS alerts not saved",
 events:record.events||"Official road events not saved",
 source:"Last retrieved "+formatTime(record.checkedAt)+" · location approximate",
 details:"Saved conditions can be outdated. Never assume the road is clear from cached information.",
 link:record.dotUrl?{url:record.dotUrl,text:"Official state 511"}:null});
}
async function inspect(latlng,road={}){
 previewIndex=null;
 if(altLine&&state.map){state.map.removeLayer(altLine);altLine=null;}
 if(!latlng||!Number.isFinite(latlng.lat)||!Number.isFinite(latlng.lng))return;
 inspectionController?.abort();
 inspectionController=new AbortController();
 const signal=inspectionController.signal;
 const point={lat:+latlng.lat,lon:+latlng.lng},token=++lastRequest;
 window.dustinDecision?.select(point,road);
 if(state.map&&window.L){
  if(indicator)state.map.removeLayer(indicator);
  indicator=L.circleMarker([point.lat,point.lon],{radius:9,weight:3,color:"#fff",fillColor:"#117fe4",fillOpacity:1,interactive:false}).addTo(state.map);
 }
 $f("road-inspector").hidden=true;$f("state-overview").hidden=true;
 const coarse=state.map?.getZoom()<10;
 const detail=coarse?"Zoom closer to select a specific road.":"This is nearby weather, not measured pavement conditions.";
 const old=readCache()[cacheKey(point)];
 let title=road.name||"Selected map location";
 let region=state.stateFeatures?.find(f=>pointInState([point.lon,point.lat],f))?.properties?.name||"";
 let dot=roads[region];
 let wxText="Checking nearby weather…",alertsText="NWS alerts: checking…",eventsText="511 coverage: checking…";
 let urgentAlert=false,nearbyClosure=false;
 let riskType="loading",riskLabel="CHECKING",wxChecked=false,wxTime="";
 let temperature=null,condition=null,wind=null,gust=null;
 if(old){cachedPoint(point,old);if(navigator.onLine)$f("focus-details").textContent="Showing a dated snapshot while checking for updated information. "+detail}
 else setCard({name:title,subtitle:point.lat.toFixed(3)+", "+point.lon.toFixed(3),tag:"CHECKING DATA",tagType:"loading",
   weather:wxText,alerts:alertsText,events:eventsText,source:"Nearby point forecast · NWS · official 511 if configured",details:detail});
 if(!navigator.onLine){
  if(!old)setCard({name:title,subtitle:"OFFLINE — no snapshot for this point",tag:"UNAVAILABLE",tagType:"unavailable",
   weather:"No nearby weather stored",alerts:"NWS unavailable offline",events:"511 unavailable offline",
   source:"No fresh observations",details:"Open Saved Trip to review locally saved routes and their last check times."});
  return;
 }
 function redraw(){
  if(token!==lastRequest)return;
  setCard({name:road.name||title,subtitle:(road.name?"Mapped road · ":"Selected area · ")+(region||"state unknown")+" · "+point.lat.toFixed(3)+", "+point.lon.toFixed(3),
   tag:nearbyClosure?"REPORTED CLOSURE NEARBY":urgentAlert?"SEVERE WEATHER ALERT":riskLabel,tagType:nearbyClosure||urgentAlert?"danger":riskType,weather:wxText,alerts:alertsText,events:eventsText,
   source:wxChecked?"WEATHER UPDATED "+formatTime(wxTime)+" · road surface unverified":"Weather refresh pending or unavailable",
   details:detail+" Check posted signs and official road reports; no data here confirms a route is truck-safe.",
   link:dot?{url:dot[1],text:dot[0]+" map"}:null});
 }
 function persist(){
  if(!wxChecked)return;
  storePoint(point,{name:title,temperature,condition,wind,gust,alerts:alertsText,events:eventsText,dotUrl:dot?.[1]||"",checkedAt:wxTime});
 }
 // Three independent network lookups: render each as soon as it completes.
 const weatherPromise=requestJson("https://api.open-meteo.com/v1/forecast?"+new URLSearchParams({
  latitude:point.lat,longitude:point.lon,
  current:"temperature_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,visibility",
  wind_speed_unit:"kmh",timezone:"auto"
 }),8500,{Accept:"application/json"},signal).then(data=>{
  if(token!==lastRequest)return;
  const c=data.current;if(!c)throw Error("No current weather data");
  const r=assess(c);riskType=r.cls==="danger"?"danger":r.cls==="caution"?"caution":"ok";
  riskLabel=r.cls==="danger"?"HIGH WEATHER RISK":r.cls==="caution"?"WEATHER CAUTION":"LOWER WEATHER RISK";
  temperature=Math.round(c.temperature_2m*9/5+32);condition=label(c.weather_code);
  wind=mph(c.wind_speed_10m);gust=mph(c.wind_gusts_10m);
  wxText=temperature+"°F · "+condition+" · wind "+wind+" mph · gusts "+gust+" mph"+
    (Number.isFinite(c.visibility)?" · visibility "+(c.visibility/1609.34).toFixed(1)+" mi":"");
  wxChecked=true;wxTime=new Date().toISOString();redraw();persist();
 }).catch(error=>{
  if(token!==lastRequest)return;
  riskType=old?"cached":"unavailable";riskLabel=old?"CACHED — NOT LIVE":"WEATHER UNAVAILABLE";
  wxText=old?cachedWeather(old):"Weather request failed";
  redraw();
 });
 const alertsPromise=requestJson("https://api.weather.gov/alerts/active?point="+point.lat+","+point.lon,8500,{Accept:"application/geo+json"},signal).then(data=>{
  if(token!==lastRequest)return;
  if(!Array.isArray(data.features))throw Error("Invalid alert response");
  const list=data.features.map(f=>f.properties).filter(Boolean);
  urgentAlert=list.some(a=>["Severe","Extreme"].includes(a.severity));
  alertsText=list.length?"NWS: "+list.slice(0,3).map(a=>a.event||"Weather alert").join("; "):"NWS: 0 active alerts returned for this point";
  redraw();persist();
 }).catch(()=>{
  if(token!==lastRequest)return;
  alertsText="NWS: service unavailable";redraw();persist();
 });
 const placePromise=reverse(point.lat,point.lon,signal).then(async place=>{
  if(token!==lastRequest)return;
  if(!region)region=stateFor(place.region)||place.region||"";
  if(!road.name&&place.name&&place.name!=="Current location")title=place.name;
  dot=roads[region];redraw();persist();
  if(!region){eventsText="State not identified · open State road reports";redraw();return}
  eventsText="Checking official road reports…";redraw();
  try{
   const data=await stateIncidents(region,point);
   if(token!==lastRequest)return;
   const events=data.events||[];
   nearbyClosure=events.some(e=>e.IsFullClosure===true||e.IsFullClosure==="true");
   window.dustinDecision?.incidents(events);
   eventsText=data.summary||(events.length?"511: "+events.length+" event(s) within 5 miles — "+events.slice(0,2).map(e=>e.EventType||e.Description||"Road event").join("; "):"511: 0 nearby events returned; coverage may be incomplete");
  }catch{
   if(token!==lastRequest)return;eventsText="511: official feed unavailable";
  }
  redraw();persist();
 }).catch(()=>{
  if(token!==lastRequest)return;
  eventsText="511: state lookup unavailable";redraw();persist();
 });
 await Promise.allSettled([weatherPromise,alertsPromise,placePromise]);
}
function showSaved(trip){
 window.dustinDecision?.clear();
 inspectionController?.abort();lastRequest++;previewIndex=null;
 toolsToggle(false);
 if($f("map-sheet"))$f("map-sheet").hidden=true;
 $f("map-dock")?.classList.remove("is-hidden");
 state.route=null;state.routeChoices=[];$f("route-results").hidden=true;if($f("map-route-banner"))$f("map-route-banner").hidden=true;if(state.layer&&state.map){state.map.removeLayer(state.layer);state.layer=null}state.markers.forEach(m=>state.map?.removeLayer(m));state.markers=[];
 if(indicator&&state.map){state.map.removeLayer(indicator);indicator=null}
 if(altLine&&state.map){state.map.removeLayer(altLine);altLine=null}
 if(!trip?.a?.name||!trip?.b?.name)return;
 const snap=trip.snapshot;
 $f("origin-input").value=trip.a.name;
 $f("destination-input").value=trip.b.name;
 if(!snap){setCard({name:trip.a.name+" → "+trip.b.name,subtitle:"Saved trip · "+formatTime(trip.date),tag:"SAVED LOCATIONS",tagType:"cached",weather:"Only trip endpoints were stored",alerts:"No cached alert information",events:"No cached road-event information",source:"Tap Trips, then Check Route Weather to refresh",details:"This saved trip predates offline snapshots; route geometry and weather are unavailable."});return}
 let geometry=Array.isArray(snap.coords)?snap.coords.filter(c=>Array.isArray(c)&&Number.isFinite(+c[0])&&Number.isFinite(+c[1])).map(c=>[+c[0],+c[1]]):[];
 if(state.map&&window.L&&geometry.length>1){
  if(previewLine)state.map.removeLayer(previewLine);
  if(state.layer){state.map.removeLayer(state.layer);state.layer=null}
  state.markers.forEach(m=>state.map.removeLayer(m));state.markers=[];
  previewLine=L.polyline(geometry,{color:"#72bde7",weight:5,dashArray:"8 8",opacity:.87}).addTo(state.map);
  state.map.fitBounds(previewLine.getBounds(),{padding:[42,42],maxZoom:11});
 }
 const age=formatTime(snap.checkedAt||trip.date);
 setCard({name:trip.a.name.split(",")[0]+" → "+trip.b.name.split(",")[0],subtitle:"SAVED TRIP · recorded "+age,
  tag:"CACHED — NOT LIVE",tagType:"cached",
  weather:[snap.distanceMiles!=null?snap.distanceMiles+" miles":null,snap.minutes!=null?Math.round(snap.minutes/60*10)/10+" h estimated":null,snap.risk||"Weather status unavailable"].filter(Boolean).join(" · "),
  alerts:"Recorded alert summary: "+(snap.alertCount||"not saved"),
  events:"Official 511 road events are NOT included in this snapshot",
  source:"Saved "+age+" · offline data",
  details:(snap.description||"No archived forecast description.")+" This route is not verified for commercial-truck restrictions. Refresh online before departure."});
}
function previewAlternative(index){
 window.dustinDecision?.clear();
 inspectionController?.abort();lastRequest++;
 const routes=state.routeChoices||[],choice=routes[index];
 if(!choice?.geometry?.coordinates?.length||!state.map||!window.L)return;
 previewIndex=index;
 if(altLine)state.map.removeLayer(altLine);
 altLine=L.polyline(choice.geometry.coordinates.map(c=>[c[1],c[0]]),{color:"#53b9ff",weight:7,dashArray:"10 7",opacity:.95}).addTo(state.map);
 state.map.fitBounds(altLine.getBounds(),{padding:[45,45]});
 const current=state.route?.rt;
 const miles=Math.round(choice.distance/1609.34);
 const difference=current?Math.round((choice.distance-current.distance)/1609.34):0;
 setCard({name:"Route "+(index+1)+" preview",subtitle:"ALTERNATIVE · NOT CHECKED FOR TRUCK RESTRICTIONS",
  tag:"GEOMETRY PREVIEW ONLY",tagType:"cached",
  weather:miles+" miles · "+(difference===0?"similar length":(difference>0?"+":"")+difference+" miles vs current route"),
  alerts:"Weather and NWS alerts for this alternative require a new check.",
  events:"511 closures and truck clearance are not verified for this route.",
  source:"Public car-routing data · preview, not a safe-route recommendation",
  details:"Use Check alternative weather to update forecast checkpoints before departure."});
 $f("focus-compare").textContent="Check alternative weather";
 $f("map-sheet")?.setAttribute("hidden","");
 $f("map-dock")?.classList.remove("is-hidden");
}
function compare(){
 inspectionController?.abort();lastRequest++;
 if(previewIndex!==null){state.preferredRouteIndex=previewIndex;previewIndex=null;if(altLine&&state.map){state.map.removeLayer(altLine);altLine=null}const form=$f("route-form");form?.requestSubmit();const button=document.querySelector('.cockpit-tab[data-mode="trips"]');button?.click();$f("road-focus-card").hidden=true;return}
 $f("road-focus-card").hidden=true;
 const button=document.querySelector('.cockpit-tab[data-mode="trips"]');
 button?.click();
 if(state.route&&state.routeChoices.length>1){
  $f("route-options")?.scrollIntoView({block:"nearest",behavior:"smooth"});
 }
}
function toolsToggle(force){
 const drawer=$f("road-tools-drawer");if(!drawer)return;
 const open=typeof force==="boolean"?force:drawer.hidden;
 drawer.hidden=!open;
 $f("focus-tools").setAttribute("aria-expanded",String(open));
}
function setup(){
 const map=document.querySelector(".map-wrap"),dock=$f("map-dock");
 if(!map||!dock||$f("road-focus-card"))return;
 document.body.classList.add("road-focus");
 // Keep the primary screen to one search bar + two shortcuts.
 const heading=document.createElement("div");heading.className="road-focus-hint";heading.innerHTML='<strong>Tap a road</strong><small>Check nearby weather and alerts</small>';
 map.appendChild(heading);
 const network=document.createElement("span");network.id="focus-network";network.className="focus-network";map.appendChild(network);setConnection();
 addEventListener("online",setConnection);addEventListener("offline",setConnection);
 const controls=document.createElement("div");controls.id="road-focus-actions";controls.className="road-focus-actions";
 controls.innerHTML='<button id="focus-plan" type="button">Plan trip</button><button id="focus-saved" type="button">↶ Saved trip</button><button id="focus-tools" type="button" aria-expanded="false" aria-controls="road-tools-drawer">⚙ More</button>';
 dock.appendChild(controls);
 const drawer=document.createElement("section");drawer.id="road-tools-drawer";drawer.className="road-tools-drawer";drawer.hidden=true;
 drawer.innerHTML='<div class="road-drawer-heading"><strong>Map tools</strong><button type="button" id="focus-close-tools" aria-label="Close map tools">×</button></div><button type="button" id="focus-road-colors" class="focus-road-colors" aria-pressed="false">Weather-color road overlay: Off</button><p class="focus-overlay-note">Optional nearby road geometry. Colors are weather estimates, not DOT pavement reports. Loading may take longer.</p>';
 map.appendChild(drawer);
 for(const selector of [".cockpit-tabs",".state-map-toolbar",".map-quick-row",".road-ease-actions","#map-poi-status","#road-ease-message"]){
  const element=map.querySelector(selector);if(element)drawer.appendChild(element);
 }
 const card=document.createElement("section");card.id="road-focus-card";card.className="road-focus-card";card.hidden=true;card.setAttribute("aria-live","polite");
 card.innerHTML='<div class="focus-card-head"><div><p class="focus-eyebrow">POINT CONDITIONS</p><h2 id="focus-title">Selected road</h2><p id="focus-subtitle"></p></div><button id="focus-close" type="button" aria-label="Close conditions">×</button></div><div id="focus-tag" class="focus-tag" data-type="loading">CHECKING</div><p id="focus-weather" class="focus-primary"></p><p id="focus-alerts" class="focus-secondary"></p><p id="focus-events" class="focus-secondary"></p><p id="focus-source" class="focus-age"></p><p id="focus-details" class="focus-disclaimer"></p><div class="focus-card-actions"><button id="focus-compare" type="button">Plan a trip</button><a id="focus-dot-link" target="_blank" rel="noopener noreferrer" hidden>Official 511 / DOT</a></div>';
 map.appendChild(card);
 $f("focus-plan").onclick=compare;
 $f("focus-close").onclick=closeCard;
 $f("focus-compare").onclick=compare;
 $f("focus-saved").onclick=()=>{
  const trips=typeof saved==="function"?saved():[];
  if(trips.length)showSaved(trips[0]);else{compare();$f("route-message").textContent="No saved trips yet. Create a trip and tap Save Trip."}
 };
 $f("focus-tools").onclick=()=>toolsToggle();
 $f("focus-close-tools").onclick=()=>toolsToggle(false);
 $f("focus-road-colors").onclick=()=>{state.enableRoadDetails=!state.enableRoadDetails;const on=state.enableRoadDetails;$f("focus-road-colors").setAttribute("aria-pressed",String(on));$f("focus-road-colors").textContent="Weather-color road overlay: "+(on?"On":"Off");if(!on)state.roadNetworkLayer?.clearLayers();else scheduleRoadNetworkLoad();if(on&&state.map?.getZoom()<11)toast("Zoom into a roadway to load weather-colored road segments.");};
 drawer.querySelectorAll(".cockpit-tab").forEach(btn=>btn.addEventListener("click",()=>toolsToggle(false)));
 $f("map-search-form")?.addEventListener("submit",()=>toolsToggle(false));
 document.addEventListener("keydown",e=>{if(e.key==="Escape"){toolsToggle(false);closeCard()}});
 if(state.map){
  try{const view=JSON.parse(localStorage.getItem("dustins-map-last-view-v1")||"null");if(view&&Number.isFinite(view.lat)&&Number.isFinite(view.lon)&&Number.isFinite(view.zoom)&&view.zoom>=3&&view.zoom<=18)state.map.setView([view.lat,view.lon],view.zoom,{animate:false})}catch{}
  state.map.on("moveend",()=>{try{const c=state.map.getCenter();localStorage.setItem("dustins-map-last-view-v1",JSON.stringify({lat:+c.lat.toFixed(5),lon:+c.lng.toFixed(5),zoom:state.map.getZoom()}))}catch{}});
  state.map.on("click",()=>{if(!drawer.hidden)toolsToggle(false)});
 }
}
window.dustinRoadFocus={inspect,showSaved,previewAlternative};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",setup);else setup();
})();