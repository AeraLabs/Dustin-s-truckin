/* Dustin's Trucking — map tap weather and offline trip snapshot UX.
   A point forecast is not a verified report for the road surface or truck restrictions. */
(function(){
"use strict";
const $f=id=>document.getElementById(id);
const KEY="dustins-road-point-cache-v1";
let lastRequest=0,previewLine=null,indicator=null;
const readCache=()=>{try{return JSON.parse(localStorage.getItem(KEY)||"{}")}catch{return{}}};
const formatTime=t=>{const d=new Date(t);return Number.isFinite(d.getTime())?d.toLocaleString([],{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}):"unknown date"};
const html=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&quot;"}[c]));
function cacheKey(point){return point.lat.toFixed(2)+":"+point.lon.toFixed(2)}
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
 compare.textContent=state.route&&choices.length>1?"Compare "+choices.length+" routes":state.route?"Review trip":"Plan a trip";
}
function closeCard(){lastRequest++;$f("road-focus-card").hidden=true;if(indicator&&state.map){state.map.removeLayer(indicator);indicator=null}}
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
 if(!latlng||!Number.isFinite(latlng.lat)||!Number.isFinite(latlng.lng))return;
 const point={lat:+latlng.lat,lon:+latlng.lng},token=++lastRequest;
 if(state.map&&window.L){
  if(indicator)state.map.removeLayer(indicator);
  indicator=L.circleMarker([point.lat,point.lon],{radius:9,weight:3,color:"#fff",fillColor:"#117fe4",fillOpacity:1,interactive:false}).addTo(state.map);
 }
 $f("road-inspector").hidden=true;
 $f("state-overview").hidden=true;
 const coarse=state.map?.getZoom()<10;
 const title=road.name||"Selected map location";
 const detail=coarse?"Zoom closer for a specific road. Weather is sampled near this point.":"Nearby weather, not measured pavement conditions.";
 setCard({name:title,subtitle:point.lat.toFixed(3)+", "+point.lon.toFixed(3),tag:"CHECKING DATA",tagType:"loading",
  weather:"Checking nearby weather…",alerts:"NWS alerts: checking…",events:"511 events: checking coverage…",
  source:"Point weather · NWS · optional state 511",details:detail});
 const old=readCache()[cacheKey(point)];
 if(old){cachedPoint(point,old);if(navigator.onLine)$f("focus-details").textContent="Showing saved data while refreshing. "+detail}
 if(!navigator.onLine){if(!old)setCard({name:title,subtitle:"OFFLINE — no snapshot for this point",tag:"UNAVAILABLE",tagType:"unavailable",weather:"No current data offline",alerts:"NWS alerts unavailable offline",events:"511 events unavailable offline",source:"No verified road conditions",details:"Saved trips are available using the Saved button."});return}
 // All requests are independent and update the same panel as each returns.
 let latest={name:road.name||old?.name||title,temperature:null,condition:null,wind:null,gust:null,
 alerts:"NWS alerts: checking…",events:"511 feed: checking…",dotUrl:""};
 const samples=await Promise.allSettled([
  requestJson("https://api.open-meteo.com/v1/forecast?"+new URLSearchParams({latitude:point.lat,longitude:point.lon,current:"temperature_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,visibility",wind_speed_unit:"kmh",timezone:"auto"}),9000),
  requestJson("https://api.weather.gov/alerts/active?point="+point.lat+","+point.lon,8500,{Accept:"application/geo+json"}),
  reverse(point.lat,point.lon)
 ]);
 if(token!==lastRequest)return;
 const [weather,alerts,place]=samples;
 const inferredState=state.stateFeatures?.find(f=>pointInState([point.lon,point.lat],f))?.properties?.name;
 const placeData=place.status==="fulfilled"?place.value:null;
 const region=inferredState||stateFor(placeData?.region)||placeData?.region||"";
 const dot=roads[region];
 latest.dotUrl=dot?.[1]||"";
 if(!road.name&&placeData?.name&&placeData.name!=="Current location")latest.name=placeData.name;
 const time=new Date().toISOString();
 const goodWeather=weather.status==="fulfilled"&&weather.value?.current;
 let itemRisk=null;
 if(goodWeather){
  const c=weather.value.current;
  itemRisk=assess(c);
  latest.temperature=Math.round(c.temperature_2m*9/5+32);
  latest.condition=label(c.weather_code);
  latest.wind=mph(c.wind_speed_10m);
  latest.gust=mph(c.wind_gusts_10m);
  latest.weather="Weather "+latest.temperature+"°F · "+latest.condition+" · wind "+latest.wind+" mph · gusts "+latest.gust+" mph"+(Number.isFinite(c.visibility)?" · visibility "+(c.visibility/1609.34).toFixed(1)+" mi":"");
 }else{
  latest.weather=old?"Weather refresh failed; last saved: "+cachedWeather(old):"Nearby weather unavailable";
 }
 const alertOk=alerts.status==="fulfilled"&&Array.isArray(alerts.value?.features);
 const alertItems=alertOk?alerts.value.features.map(f=>f.properties).filter(Boolean):[];
 latest.alerts=alertOk?(alertItems.length?"NWS: "+alertItems.slice(0,3).map(a=>a.event||"Weather alert").join("; "):"NWS: 0 active alerts returned for this point"):"NWS: service unavailable";
 const configured=region&&native511[region]&&(state.incidentKeys[native511[region].code]||(native511[region].code==="ID"&&state.incidentKey));
 latest.events=!region?"511: state not identified":!native511[region]?"511: official feed not integrated":!configured?"511: not connected for "+region:"511: checking nearby events…";
 let level=itemRisk?.cls==="danger"?"HIGH WEATHER RISK":itemRisk?.cls==="caution"?"WEATHER CAUTION":goodWeather?"LOWER WEATHER RISK":"WEATHER UNKNOWN";
 const kind=itemRisk?.cls==="danger"?"danger":itemRisk?.cls==="caution"?"caution":goodWeather?"ok":"unavailable";
 const statusText=()=>goodWeather?"UPDATED "+formatTime(time):"DATA NOT CURRENT";
 function render(){
  setCard({name:latest.name,subtitle:(road.name?"Mapped road geometry · ":"Near selected point · ")+region+" · "+point.lat.toFixed(3)+", "+point.lon.toFixed(3),
   tag:level,tagType:kind,weather:latest.weather,alerts:latest.alerts,events:latest.events,
   source:"Nearby weather "+statusText()+" · road surface unverified",
   details:detail+" Official 511 reports are shown only when a supported feed is configured. An empty alert check is not proof the road is safe.",
   link:dot?{url:dot[1],text:dot[0]+" official map"}:null});
 }
 render();
 // Persist only successfully retrieved weather; preserve saved point snapshots when refresh fails.
 if(goodWeather)storePoint(point,{...latest,checkedAt:time});
 if(configured){
  try{
   const data=await stateIncidents(region,point);
   if(token!==lastRequest)return;
   const events=data.events||[];
   latest.events=events.length?"511: "+events.length+" event(s) within 5 mi — "+events.slice(0,2).map(e=>e.EventType||e.Description||"Reported event").join("; "):"511: 0 nearby events returned (coverage may be incomplete)";
  }catch(e){latest.events="511: official feed unavailable"}
  if(token!==lastRequest)return;
  render();
  if(goodWeather)storePoint(point,{...latest,checkedAt:time});
 }
}
function showSaved(trip){
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
function compare(){
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
 controls.innerHTML='<button id="focus-saved" type="button">↶ Saved trip</button><button id="focus-tools" type="button" aria-expanded="false" aria-controls="road-tools-drawer">⚙ More</button>';
 dock.appendChild(controls);
 const drawer=document.createElement("section");drawer.id="road-tools-drawer";drawer.className="road-tools-drawer";drawer.hidden=true;
 drawer.innerHTML='<div class="road-drawer-heading"><strong>Map tools</strong><button type="button" id="focus-close-tools" aria-label="Close map tools">×</button></div>';
 map.appendChild(drawer);
 for(const selector of [".cockpit-tabs",".state-map-toolbar",".map-quick-row",".road-ease-actions","#map-poi-status","#road-ease-message"]){
  const element=map.querySelector(selector);if(element)drawer.appendChild(element);
 }
 const card=document.createElement("section");card.id="road-focus-card";card.className="road-focus-card";card.hidden=true;card.setAttribute("aria-live","polite");
 card.innerHTML='<div class="focus-card-head"><div><p class="focus-eyebrow">POINT CONDITIONS</p><h2 id="focus-title">Selected road</h2><p id="focus-subtitle"></p></div><button id="focus-close" type="button" aria-label="Close conditions">×</button></div><div id="focus-tag" class="focus-tag" data-type="loading">CHECKING</div><p id="focus-weather" class="focus-primary"></p><p id="focus-alerts" class="focus-secondary"></p><p id="focus-events" class="focus-secondary"></p><p id="focus-source" class="focus-age"></p><p id="focus-details" class="focus-disclaimer"></p><div class="focus-card-actions"><button id="focus-compare" type="button">Plan a trip</button><a id="focus-dot-link" target="_blank" rel="noopener noreferrer" hidden>Official 511 / DOT</a></div>';
 map.appendChild(card);
 $f("focus-close").onclick=closeCard;
 $f("focus-compare").onclick=compare;
 $f("focus-saved").onclick=()=>{
  const trips=typeof saved==="function"?saved():[];
  if(trips.length)showSaved(trips[0]);else{compare();$f("route-message").textContent="No saved trips yet. Create a trip and tap Save Trip."}
 };
 $f("focus-tools").onclick=()=>toolsToggle();
 $f("focus-close-tools").onclick=()=>toolsToggle(false);
 drawer.querySelectorAll(".cockpit-tab").forEach(btn=>btn.addEventListener("click",()=>toolsToggle(false)));
 $f("map-search-form")?.addEventListener("submit",()=>toolsToggle(false));
 document.addEventListener("keydown",e=>{if(e.key==="Escape"){toolsToggle(false);closeCard()}});
 if(state.map)state.map.on("click",()=>{if(!drawer.hidden)toolsToggle(false)});
}
window.dustinRoadFocus={inspect,showSaved};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",setup);else setup();
})();