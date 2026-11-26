const CACHE="dustins-trucking-v40";
const CORE=["./experiments/copilot/loader.js?v=1","./traffic-sources.js?v=1","./traffic-sources.css?v=1","./data/state-sources.json","./data/parking-inventory.json","./road-decision.js?v=6","./road-decision.css?v=2","./vendor/leaflet/leaflet.js","./vendor/leaflet/leaflet.css","./vendor/leaflet/images/layers.png","./vendor/leaflet/images/layers-2x.png","./vendor/leaflet/images/marker-icon.png","./vendor/leaflet/images/marker-icon-2x.png","./vendor/leaflet/images/marker-shadow.png","./","./index.html","./styles.css?v=13","./app.js?v=29","./map-first.css?v=2","./map-first.js?v=7","./road-ease.css?v=1","./road-ease.js?v=2","./road-focus.css?v=2","./road-focus.js?v=7","./theme.css?v=1","./theme.js?v=1","./manifest.webmanifest","./icon.svg"];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("dustins-trucking-")&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=="GET"||url.origin!==location.origin)return;
 const isCore=CORE.some(path=>new URL(path,self.registration.scope).href===url.href);
 if(!isCore)return;
 // App files are versioned with the worker: no network wait on repeat opens.
 // API data and map tiles keep their own freshness and provider caching rules.
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  const cached=await cache.match(request);
  if(cached)return cached;
  if(request.mode==="navigate"){
   const shell=await cache.match(new URL("./index.html",self.registration.scope));
   if(shell)return shell;
  }
  return fetch(request);
 })());
});
