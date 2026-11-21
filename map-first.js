/* Dustin's Trucking — map-first controls. All points and alerts are sourced, never fabricated. */
(function(){
"use strict";
let poiLayer=null,searchMarker=null,activeCategory="",poiTimer=null,poiRequest=0,foundPlace=null;
const poiCache=new Map();
let poiController=null,inventoryPromise=null;
function inventory(){if(!inventoryPromise)inventoryPromise=requestJson("./data/parking-inventory.json",6000).catch(()=>{inventoryPromise=null;return {elements:[]}});return inventoryPromise;}
const icons={stops:"⛽",parking:"P",fuel:"⛽",rest:"☕",weigh:"W"};
const poiDefs={
  stops:{title:"Truck stops",clauses:['nwr["highway"="services"]','nwr["amenity"="fuel"]["hgv"~"yes|designated"]','nwr["amenity"="fuel"]["brand"~"Pilot|Flying J|Love|TravelCenters|Petro|TA Travel",i]','nwr["amenity"="truck_stop"]'],fallback:"Truck stop / services"},
  parking:{title:"Truck parking",clauses:['nwr["amenity"="parking"]["hgv"~"yes|designated"]','nwr["amenity"="parking"]["capacity:hgv"]','nwr["parking"="truck"]'],fallback:"Truck parking"},
  fuel:{title:"Fuel stations",clauses:['nwr["amenity"="fuel"]'],fallback:"Fuel station"},
  rest:{title:"Rest areas",clauses:['nwr["highway"="rest_area"]','nwr["highway"="services"]'],fallback:"Rest area"},
  weigh:{title:"Weigh stations",clauses:['nwr["highway"="weigh_station"]','nwr["amenity"="weighbridge"]'],fallback:"Weigh station"}
};
function byId(id){return document.getElementById(id)}
function create(tag,cls,html){const n=document.createElement(tag);n.className=cls;if(html)n.innerHTML=html;return n}
function setStatus(message){const el=byId("map-poi-status");el.hidden=!message;el.textContent=message||"";const feedback=byId("map-search-feedback");if(feedback){feedback.hidden=!message;feedback.textContent=message||""}}
function setPressed(category){
 document.querySelectorAll(".quick-category,[data-stop]").forEach(el=>el.setAttribute("aria-pressed",String((el.dataset.category||el.dataset.stop)===category)));
}
function updateTabs(current){
 document.querySelectorAll(".cockpit-tab").forEach(el=>el.setAttribute("aria-pressed",String(el.dataset.mode===current)));
}
function openSheet(){byId("map-sheet").hidden=false;byId("map-dock").classList.add("is-hidden");updateTabs("trips");setTimeout(()=>state.map?.invalidateSize(),80)}
function closeSheet(){byId("map-sheet").hidden=true;byId("map-dock").classList.remove("is-hidden");updateTabs("places")}
function conditionPanel(){
 closeSheet();
 if(!state.selectedState){setStatus("Choose a state using the selector at the top right to see NWS alerts and available 511 events.");byId("state-select").focus();return}
 byId("state-overview").hidden=false;
 byId("road-inspector").hidden=true;
 updateTabs("conditions");
}
function official511(){window.dustinTraffic?.open()}
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
async function locatePlace(q){
 const trimmed=q.trim();if(trimmed.length<2){setStatus("Enter a city, stop or destination.");return}
 const input=byId("map-place-query"),btn=byId("map-search-go");btn.disabled=true;btn.textContent="…";
 setStatus("Searching for "+trimmed+"…");
 try{
  let place=null;
  try{
   const data=await requestJson("https://photon.komoot.io/api/?"+new URLSearchParams({q:trimmed,limit:5,lang:"en"}),11000);
   const first=(data.features||[]).find(f=>f.geometry?.coordinates?.length===2);
   if(first){const p=first.properties||{},c=first.geometry.coordinates;place={lat:+c[1],lon:+c[0],name:[p.name,p.city,p.state].filter((v,i,a)=>v&&a.indexOf(v)===i).join(", ")||trimmed}}
  }catch(e){console.info("Place search fallback:",e.message)}
  if(!place){const matches=await searchPlaces(trimmed);place=matches[0]}
  if(!place)throw Error("No location found. Try a city and state, such as Lewiston, Idaho.");
  foundPlace=place;
  input.value=place.name;
  state.map?.flyTo([place.lat,place.lon],12,{duration:0.65});
  if(searchMarker)state.map?.removeLayer(searchMarker);
  if(state.map&&window.L){
   searchMarker=L.marker([place.lat,place.lon],{icon:L.divIcon({className:"",html:'<div class="map-search-pin"><span>⌖</span></div>',iconSize:[36,36],iconAnchor:[18,34]})}).addTo(state.map).bindPopup("<strong>"+escapeHtml(place.name)+"</strong><small>Selected map location · not a verified truck entrance</small>").openPopup();
  }
  const result=byId("map-place-result");result.hidden=false;
  result.querySelector("strong").textContent=place.name;
  setStatus("Location found. Explore the map, choose a place category, or plan a route.");
 }catch(error){setStatus(error.message||"Search failed. Try again.");byId("map-place-result").hidden=true}
 finally{btn.disabled=false;btn.textContent="Find"}
}
function routeToFound(){
 if(!foundPlace)return;
 byId("destination-input").value=foundPlace.name;
 openSheet();
 byId("destination-input").focus();
 if(!byId("origin-input").value){byId("route-message").textContent="Set your starting location, then check route weather. This is not truck-restriction routing."}
}
function clearPoi(){poiController?.abort();clearTimeout(poiTimer);poiRequest++;activeCategory="";setPressed("");poiLayer?.clearLayers();setStatus("")}
function poiQuery(category,lat,lon,meters){
 const defs=poiDefs[category];
 const around="(around:"+meters+","+lat.toFixed(5)+","+lon.toFixed(5)+")";
 return "[out:json][timeout:10];("+defs.clauses.map(s=>s+around+";").join("")+");out center 200;";
}
function stylePoi(kind){return L.divIcon({className:"",html:'<div class="map-poi-pin">'+icons[kind]+"</div>",iconSize:[37,37],iconAnchor:[19,35],popupAnchor:[0,-30]})}
async function showPoi(category,fit=true){
 if(!state.map||!window.L){setStatus("Map is still loading. Try again.");return}
 if(!poiDefs[category])return;
 poiController?.abort();poiController=new AbortController();const signal=poiController.signal;
 const request=++poiRequest;activeCategory=category;setPressed(category);updateTabs("places");
 if(!poiLayer)poiLayer=L.layerGroup().addTo(state.map);
 const zoom=state.map.getZoom(),center=state.map.getCenter(),distance=zoom>=12&&["fuel","stops"].includes(category)?25000:75000;
 const key=category+":"+center.lat.toFixed(2)+":"+center.lng.toFixed(2)+":"+distance;
 setStatus("Finding "+poiDefs[category].title.toLowerCase()+" within "+Math.round(distance/1609.34)+" miles of map center…");
 let fallback=[],count=0,fitted=false;
 function render(features){
  if(request!==poiRequest||activeCategory!==category)return 0;
  const sorted=features.filter(f=>Number.isFinite(+(f.lat??f.center?.lat))&&Number.isFinite(+(f.lon??f.center?.lon)))
   .map(f=>({...f,meters:distanceMeters({lat:center.lat,lon:center.lng},{lat:+(f.lat??f.center?.lat),lon:+(f.lon??f.center?.lon)})})).sort((a,b)=>a.meters-b.meters).slice(0,150);
  poiLayer.clearLayers();const seen=new Set();
  for(const f of sorted){
   const lat=+(f.lat??f.center?.lat),lon=+(f.lon??f.center?.lon),tags=f.tags||{};
   const name=tags.name||tags.brand||poiDefs[category].fallback,id=f.type+":"+f.id;if(seen.has(id))continue;seen.add(id);
   const source=f.type==="inventory"?"FHWA/BTS inventory · 2019 survey · confirm site still operates":"OpenStreetMap listing · open status and truck access unverified";
   const details=[tags.description,tags.operator,tags.opening_hours].filter(Boolean).join(" · ");
   const url="https://www.google.com/maps/dir/?api=1&destination="+lat+","+lon+"&travelmode=driving";
   L.marker([lat,lon],{icon:stylePoi(category),keyboard:true,title:name}).bindTooltip(escapeHtml(name))
    .bindPopup('<strong>'+escapeHtml(name)+'</strong><small>'+escapeHtml(details)+'</small><small>'+escapeHtml(source)+'</small><small>No live parking availability or weigh-station operating status.</small><a href="'+url+'" target="_blank" rel="noopener noreferrer">Open directions</a>').addTo(poiLayer);
  }
  if(fit&&!fitted&&seen.size){fitted=true;state.map.fitBounds(L.latLngBounds(sorted.map(f=>[+(f.lat??f.center?.lat),+(f.lon??f.center?.lon)])),{paddingTopLeft:[45,65],paddingBottomRight:[45,300],maxZoom:13});}
  return seen.size;
 }
 try{
  const data=await inventory();if(request!==poiRequest)return;
  fallback=(data.elements||[]).filter(f=>f.categories.includes(category)&&distanceMeters({lat:center.lat,lon:center.lng},{lat:f.lat,lon:f.lon})<=distance);
  const cached=poiCache.get(key);
  if(cached&&Date.now()-cached.time<300000){count=render(cached.features);setStatus(count+" mapped locations · cached lookup · tap a pin for source and details.");return}
  count=render(fallback);
  if(count)setStatus(count+" inventory locations shown now. Checking OpenStreetMap for more…");
  if(!navigator.onLine){setStatus(count?count+" dated inventory sites · OFFLINE · verify before use":"No saved locations in this area. Connect to refresh.");return}
  const res=await requestOverpass(poiQuery(category,center.lat,center.lng,distance),12000,signal);
  if(request!==poiRequest)return;
  // Prefer current OSM listings; retain dated fallback sites where there is no nearby OSM match.
  const osm=res.elements||[];
  const merged=[...osm,...fallback.filter(f=>!osm.some(o=>distanceMeters({lat:f.lat,lon:f.lon},{lat:+(o.lat??o.center?.lat),lon:+(o.lon??o.center?.lon)})<150))];
  poiCache.set(key,{time:Date.now(),features:merged});if(poiCache.size>20)poiCache.delete(poiCache.keys().next().value);
  count=render(merged);
  setStatus(count?count+" locations near map center · tap a pin for source. Availability and operating status not verified.":"No mapped locations found within "+Math.round(distance/1609.34)+" miles. Pan toward your route or search a city.");
 }catch(error){
  if(request!==poiRequest)return;
  setStatus(count?count+" dated inventory locations shown · OpenStreetMap refresh unavailable. Tap a pin for details.":"Location provider unavailable here. Pan to another area or try again; no empty map is being treated as no facilities.");
 }
}
function schedulePoiRefresh(){
 if(!activeCategory)return;
 clearTimeout(poiTimer);
 poiTimer=setTimeout(()=>showPoi(activeCategory,false),1000);
}
function buildCockpit(){
 const wrap=document.querySelector(".map-wrap"),routeCard=document.querySelector("main > .route-card"),results=document.querySelector("main > .route-results");
 if(!wrap||!routeCard||!results)return;
 document.body.classList.add("map-first");
 const tabs=create("nav","cockpit-tabs",'<button type="button" class="cockpit-tab" data-mode="places" aria-pressed="true">⌖ Places</button><button type="button" class="cockpit-tab" data-mode="trips" aria-pressed="false">↗ Trips</button><button type="button" class="cockpit-tab" data-mode="conditions" aria-pressed="false">⚠ Weather</button><button type="button" class="cockpit-tab" data-mode="511" aria-pressed="false">511 Sources</button>');
 tabs.setAttribute("aria-label","Map navigation");
 wrap.appendChild(tabs);
 const gps=create("button","cockpit-gps","◎");gps.type="button";gps.setAttribute("aria-label","Center map on my location");gps.addEventListener("click",()=>locateMap());wrap.appendChild(gps);
 const dock=create("section","map-dock",'<div id="map-route-banner" class="map-route-banner" hidden><span>Route ready</span><button type="button" id="map-route-compare">Compare routes</button></div><form id="map-search-form" class="map-search-form"><span class="search-glass" aria-hidden="true">⌕</span><input id="map-place-query" list="map-place-suggestions" autocomplete="off" enterkeyhint="search" aria-label="Search city, place or destination" placeholder="Search a city, stop or destination"><datalist id="map-place-suggestions"></datalist><button type="submit" id="map-search-go" class="map-search-action">Find</button></form><div id="map-place-result" class="map-place-result" hidden><strong></strong><button type="button" id="map-route-here">Route here</button></div><div class="map-quick-row" aria-label="Map place filters"><button class="quick-category" data-category="stops" aria-pressed="false"><span>⛽</span> Truck Stops</button><button class="quick-category" data-category="parking" aria-pressed="false"><span>🅿</span> Truck Parking</button><button class="quick-category" data-category="fuel" aria-pressed="false"><span>◉</span> Fuel</button><button class="quick-category" data-category="rest" aria-pressed="false"><span>☕</span> Rest Areas</button><button class="quick-category" data-category="weigh" aria-pressed="false"><span>⚖</span> Weigh Stations</button><button class="quick-category" data-category="clear" aria-pressed="false"><span>×</span> Clear Pins</button></div><div class="map-poi-status" id="map-poi-status" role="status" aria-live="polite" hidden></div>');
 dock.id="map-dock";
 wrap.appendChild(dock);
 const feedback=create("p","map-search-feedback");feedback.id="map-search-feedback";feedback.hidden=true;feedback.setAttribute("role","status");dock.appendChild(feedback);
 const sheet=create("section","map-sheet",'<div class="map-sheet-head"><strong>Plan & check your trip</strong><button type="button" id="close-map-sheet" aria-label="Close trip planner">×</button></div><div id="map-sheet-content"></div>');
 sheet.id="map-sheet";sheet.hidden=true;sheet.setAttribute("aria-label","Trip planner and road intelligence");wrap.appendChild(sheet);
 byId("map-sheet-content").append(routeCard,results);
 tabs.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{
  if(b.dataset.mode==="trips"){openSheet();return}
  if(b.dataset.mode==="places"){closeSheet();return}
  if(b.dataset.mode==="conditions"){conditionPanel();return}
  if(b.dataset.mode==="511"){official511();return}
 }));
 byId("close-map-sheet").addEventListener("click",closeSheet);
 byId("map-search-form").addEventListener("submit",e=>{e.preventDefault();locatePlace(byId("map-place-query").value)});
 byId("map-route-here").addEventListener("click",routeToFound);
 byId("map-route-compare").addEventListener("click",openSheet);
 dock.querySelectorAll(".quick-category").forEach(b=>b.addEventListener("click",()=>b.dataset.category==="clear"?clearPoi():b.getAttribute("aria-pressed")==="true"?clearPoi():showPoi(b.dataset.category)));
 let suggestionTimer=0;
 byId("map-place-query").addEventListener("input",()=>{
  clearTimeout(suggestionTimer);
  const text=byId("map-place-query").value.trim();
  if(text.length<3){byId("map-place-suggestions").replaceChildren();return;}
  suggestionTimer=setTimeout(()=>searchPlaces(text).then(items=>{if(byId("map-place-query").value.trim()!==text)return;byId("map-place-suggestions").innerHTML=items.map(p=>'<option value="'+escapeHtml(p.name)+'"></option>').join("")}).catch(()=>{}),400);
 });
 const observer=new MutationObserver(()=>{
  if(results.hidden)return;
  const banner=byId("map-route-banner");banner.hidden=false;banner.querySelector("span").textContent="Route ready · "+byId("route-distance").textContent+" · "+byId("route-duration").textContent+" estimated";
  if(sheet.hidden){
   setStatus("Trip loaded. Tap Trips to compare routes, review alerts and view weather checkpoints.");
   return;
  }
  byId("map-sheet").querySelector(".map-sheet-head strong").textContent="Trip routes & conditions";
 });
 observer.observe(results,{attributes:true,attributeFilter:["hidden"]});
 byId("state-select").addEventListener("change",()=>{clearPoi();setStatus("State selected. Road map, NWS weather areas and available 511 events are loading.");});
 if(state.map){state.map.on("moveend",schedulePoiRefresh);state.map.on("zoomend",schedulePoiRefresh);state.map.invalidateSize();}
 document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!sheet.hidden)closeSheet()});
}
window.dustinPlaces={show:showPoi,clear:clearPoi};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",buildCockpit);else buildCockpit();
})();