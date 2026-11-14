const $ = (id) => document.getElementById(id);
const state = { route:null, map:null, routeLayer:null, markers:[], settings:{wind:25,unit:"fahrenheit"}, currentCoords:null };
const weatherCodes = {0:"Clear sky",1:"Mostly clear",2:"Partly cloudy",3:"Overcast",45:"Fog",48:"Freezing fog",51:"Light drizzle",53:"Drizzle",55:"Heavy drizzle",56:"Freezing drizzle",57:"Freezing drizzle",61:"Light rain",63:"Rain",65:"Heavy rain",66:"Freezing rain",67:"Freezing rain",71:"Light snow",73:"Snow",75:"Heavy snow",77:"Snow grains",80:"Rain showers",81:"Rain showers",82:"Heavy showers",85:"Snow showers",86:"Heavy snow showers",95:"Thunderstorms",96:"Thunderstorms / hail",99:"Severe thunderstorms"};
const weatherGlyph = (code) => code===0?"☀":code<=3?"◐":code===45||code===48?"≋":code>=71&&code<=86?"❄":code>=95?"ϟ":code>=51?"☂":"◌";
function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),3200)}
function setMessage(message){$("route-message").textContent=message}
function formatTemp(c){return state.settings.unit==="fahrenheit"?Math.round(c*9/5+32):Math.round(c)}
function formatWind(kmh){return Math.round(kmh*0.621371)}
function weatherLabel(code){return weatherCodes[code]||"Variable conditions"}
function setCurrentWeather(data,place){
 const c=data.current; $("current-temp").innerHTML=formatTemp(c.temperature_2m)+'<sup>°</sup>';
 $("current-condition").textContent=weatherLabel(c.weather_code); $("weather-symbol").textContent=weatherGlyph(c.weather_code);
 $("weather-location").textContent=place.toUpperCase(); $("current-wind").textContent=formatWind(c.wind_speed_10m)+" mph";
 $("current-gust").textContent=formatWind(c.wind_gusts_10m)+" mph";
 $("current-visibility").textContent=(c.visibility/1609.34).toFixed(1)+" mi";
}
async function geocode(query){
 const url="https://geocoding-api.open-meteo.com/v1/search?"+new URLSearchParams({name:query,count:1,language:"en",format:"json"});
 const r=await fetch(url);if(!r.ok)throw new Error("Location search is unavailable.");const j=await r.json();
 if(!j.results?.length)throw new Error('Could not find "'+query+'". Try a nearby city or ZIP code.');
 const p=j.results[0];return {lat:p.latitude,lon:p.longitude,name:[p.name,p.admin1,p.country].filter(Boolean).join(", ")};
}
async function reverseGeocode(lat,lon){
 try{const r=await fetch("https://geocoding-api.open-meteo.com/v1/reverse?"+new URLSearchParams({latitude:lat,longitude:lon,language:"en",format:"json"}));const j=await r.json();const p=j.results?.[0];return p?[p.name,p.admin1].filter(Boolean).join(", "):"Current location"}catch{return "Current location"}
}
async function fetchWeather(point){
 const params={latitude:point.lat,longitude:point.lon,current:"temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility",hourly:"temperature_2m,precipitation_probability,precipitation,rain,snowfall,weather_code,wind_speed_10m,wind_gusts_10m,visibility",forecast_days:2,timezone:"auto",wind_speed_unit:"kmh"};
 const r=await fetch("https://api.open-meteo.com/v1/forecast?"+new URLSearchParams(params));if(!r.ok)throw new Error("Weather forecast service returned an error.");return r.json();
}
async function getRoute(a,b){
 const url="https://router.project-osrm.org/route/v1/driving/"+a.lon+","+a.lat+";"+b.lon+","+b.lat+"?overview=full&geometries=geojson&steps=false";
 const r=await fetch(url);if(!r.ok)throw new Error("Route service is unavailable right now.");const j=await r.json();
 if(j.code!=="Ok"||!j.routes?.length)throw new Error("No driving route found between those locations.");
 return j.routes[0];
}
function pointAtFraction(coords,fraction){
 const target=Math.max(0,Math.min(coords.length-1,Math.round(fraction*(coords.length-1))));const p=coords[target];return {lon:p[0],lat:p[1]};
}
function buildCheckpoints(coords,distanceKm){
 const count=Math.max(3,Math.min(7,Math.ceil(distanceKm/250)+1));const points=[];
 for(let i=0;i<count;i++){const f=i/(count-1);points.push({...pointAtFraction(coords,f),fraction:f,distanceKm:distanceKm*f})}
 return points;
}
function nearestHour(data){
 const times=data.hourly.time;const now=Date.now();let best=0,delta=Infinity;
 times.forEach((t,i)=>{const d=Math.abs(new Date(t).getTime()-now);if(d<delta){delta=d;best=i}});
 return best;
}
function hourAtArrival(data,arrivalHours){
 const target=Date.now()+arrivalHours*3600000;const times=data.hourly.time;let best=0,delta=Infinity;
 times.forEach((t,i)=>{const d=Math.abs(new Date(t).getTime()-target);if(d<delta){delta=d;best=i}});return best;
}
function riskFor(c){
 const wind=formatWind(c.wind_speed_10m),gust=formatWind(c.wind_gusts_10m),vis=c.visibility/1609.34,code=c.weather_code;
 if(gust>=45||wind>=40||[56,57,66,67,75,86,95,96,99].includes(code)||vis<0.5)return {level:"HIGH RISK",className:"danger",label:"Higher risk",detail:"Severe weather indicators detected. Check official road advisories and consider delaying or changing plans."};
 if(gust>=state.settings.wind||wind>=state.settings.wind||vis<2||[61,63,65,71,73,80,81,82,85].includes(code)||c.precipitation>1)return {level:"USE CAUTION",className:"caution",label:"Use caution",detail:"Weather may affect handling or visibility. Reduce speed and reassess conditions as you approach."};
 return {level:"LOWER RISK",className:"",label:"Generally favorable",detail:"No major weather risk indicators detected in this forecast. Conditions can change; keep checking ahead."};
}
function updateRisk(checkpoints){
 const worst=checkpoints.map(x=>riskFor(x.weather.current)).sort((a,b)=>({danger:3,caution:2,"":1}[b.className]||1)-({danger:3,caution:2,"":1}[a.className]||1))[0]||{level:"STANDBY",className:"",detail:"Check a route to review weather risks."};
 $("risk-indicator").textContent=worst.level;$("risk-title").textContent=worst.label;$("risk-description").textContent=worst.detail;
 $("risk-card").dataset.risk=worst.className;$("risk-icon").textContent=worst.className==="danger"?"!":worst.className==="caution"?"△":"◈";
}
function renderCheckpoints(checkpoints,route){
 const list=$("checkpoint-list");list.innerHTML="";
 checkpoints.forEach((p,i)=>{
  const c=p.weather.current,arriveHours=(route.duration/3600)*p.fraction,idx=hourAtArrival(p.weather,arriveHours);
  const h=p.weather.hourly,forecast={temperature_2m:h.temperature_2m[idx],weather_code:h.weather_code[idx],wind_speed_10m:h.wind_speed_10m[idx],wind_gusts_10m:h.wind_gusts_10m[idx],visibility:h.visibility[idx],precipitation:h.precipitation[idx],precipitation_probability:h.precipitation_probability[idx],snowfall:h.snowfall[idx]};
  const risk=riskFor({...forecast,precipitation:forecast.precipitation,visibility:forecast.visibility,weather_code:forecast.weather_code});
  const row=document.createElement("article");row.className="checkpoint";
  const dist=Math.round(p.distanceKm*.621371);
  const arrival=new Date(Date.now()+arriveHours*3600000).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});
  row.innerHTML='<div class="checkpoint-distance">'+(i===0?"START":i===checkpoints.length-1?"DESTINATION":dist+" MI")+'<small>'+arrival+' ETA</small></div><div class="checkpoint-place"><strong>'+escapeHtml(p.name||("Route checkpoint "+(i+1)))+'</strong><small>'+escapeHtml(weatherLabel(forecast.weather_code))+' · '+formatWind(forecast.wind_speed_10m)+' mph wind · '+Math.round(forecast.precipitation_probability||0)+'% precip.</small><span class="risk-tag '+risk.className+'">'+risk.level+'</span></div><div class="checkpoint-weather"><strong>'+formatTemp(forecast.temperature_2m)+'°</strong><small>GUST '+formatWind(forecast.wind_gusts_10m)+' MPH</small></div>';
  list.appendChild(row);
 });
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function initMap(){
 if(state.map)return;
 state.map=L.map("route-map",{zoomControl:true,scrollWheelZoom:false}).setView([39.5,-98.35],4);
 L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(state.map);
}
function renderMap(route,checkpoints){
 initMap();if(state.routeLayer)state.map.removeLayer(state.routeLayer);state.markers.forEach(m=>state.map.removeLayer(m));state.markers=[];
 const latlngs=route.geometry.coordinates.map(p=>[p[1],p[0]]);
 state.routeLayer=L.polyline(latlngs,{color:"#b8d7d2",weight:4,opacity:.9}).addTo(state.map);
 checkpoints.forEach((p,i)=>{const marker=L.circleMarker([p.lat,p.lon],{radius:6,color:"#101719",weight:2,fillColor:i===0?"#b8d7d2":i===checkpoints.length-1?"#e7b66b":"#d5c49d",fillOpacity:1}).bindTooltip(escapeHtml(p.name||"Weather checkpoint"));marker.addTo(state.map);state.markers.push(marker)});
 state.map.fitBounds(state.routeLayer.getBounds(),{padding:[24,24]});setTimeout(()=>state.map.invalidateSize(),100);
}
async function checkRoute(event){
 event.preventDefault();const originText=$("origin-input").value.trim(),destinationText=$("destination-input").value.trim();if(!originText||!destinationText)return;
 const button=$("route-form").querySelector("button[type=submit]");button.disabled=true;button.querySelector("span").textContent="CHECKING ROUTE…";setMessage("Finding your route and gathering weather along the way…");
 try{
  const [a,b]=await Promise.all([geocode(originText),geocode(destinationText)]);
  const route=await getRoute(a,b);const coords=route.geometry.coordinates;const points=buildCheckpoints(coords,route.distance/1000);
  const checkpoints=await Promise.all(points.map(async(p,i)=>{const weather=await fetchWeather(p);let name=i===0?a.name:i===points.length-1?b.name:"";if(!name)name=await reverseGeocode(p.lat,p.lon);return {...p,name,weather}}));
  state.route={a,b,route,checkpoints};const first=checkpoints[0].weather;setCurrentWeather(first,a.name);updateRisk(checkpoints);renderCheckpoints(checkpoints,route);renderMap(route,checkpoints);
  $("route-title").textContent=a.name.split(",")[0]+" → "+b.name.split(",")[0];$("route-subtitle").textContent="Weather outlook for your planned drive";
  $("route-distance").textContent=Math.round(route.distance/1609.34).toLocaleString()+" mi";
  const hours=route.duration/3600;$("route-duration").textContent=Math.floor(hours)+"h "+Math.round((hours%1)*60)+"m";
  $("checkpoint-count").textContent=checkpoints.length;$("route-weather-time").textContent="UPDATED "+new Date().toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});
  $("route-results").hidden=false;$("empty-state").hidden=true;setMessage("Route checked. Review each weather checkpoint before you roll.");$("connection-label").textContent="FORECAST CONNECTED";
  $("route-results").scrollIntoView({behavior:"smooth",block:"start"});
 }catch(error){setMessage(error.message||"Something went wrong while checking the route.");toast(error.message||"Could not check route.");}
 finally{button.disabled=false;button.querySelector("span").textContent="CHECK ROUTE WEATHER"}
}
async function useCurrentLocation(){
 if(!navigator.geolocation){toast("Location is not available in this browser.");return}
 setMessage("Getting your current location…");
 navigator.geolocation.getCurrentPosition(async pos=>{const {latitude:lat,longitude:lon}=pos.coords;state.currentCoords={lat,lon};const name=await reverseGeocode(lat,lon);$("origin-input").value=name;try{const w=await fetchWeather({lat,lon});setCurrentWeather(w,name);setMessage("Current location set. Add your destination to check the route.")}catch(e){toast(e.message)}},err=>{setMessage(err.code===1?"Location permission was denied. Enter your starting city instead.":"Couldn't get your location. Enter your starting city instead.")},{enableHighAccuracy:true,timeout:12000,maximumAge:300000});
}
function init(){
 $("today-label").textContent=new Date().toLocaleDateString([],{weekday:"short",month:"short",day:"numeric"}).toUpperCase();$("footer-year").textContent=new Date().getFullYear();
 $("route-form").addEventListener("submit",checkRoute);$("use-location").addEventListener("click",useCurrentLocation);
 $("settings-button").addEventListener("click",()=>$("settings-dialog").showModal());
 $("save-settings").addEventListener("click",()=>{state.settings.wind=Number($("wind-threshold").value);state.settings.unit=$("temp-unit").value;if(state.route){updateRisk(state.route.checkpoints);renderCheckpoints(state.route.checkpoints,state.route.route)}});
 $("clear-route").addEventListener("click",()=>{$("route-results").hidden=true;$("empty-state").hidden=false;state.route=null;setMessage("Enter your start and destination to see conditions along the way.")});
 $("open-maps").addEventListener("click",()=>{if(!state.route)return;const {a,b}=state.route;const url="https://www.google.com/maps/dir/?api=1&origin="+encodeURIComponent(a.name)+"&destination="+encodeURIComponent(b.name)+"&travelmode=driving";window.open(url,"_blank","noopener,noreferrer")});
 if("serviceWorker" in navigator && location.protocol!=="file:")navigator.serviceWorker.register("./sw.js").catch(()=>{});
}
document.addEventListener("DOMContentLoaded",init);
