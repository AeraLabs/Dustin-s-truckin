const CACHE="dustins-trucking-v19";
const CORE=["./","./index.html","./styles.css?v=13","./app.js?v=19","./manifest.webmanifest","./icon.svg"];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));self.skipWaiting()});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));self.clients.claim()});
self.addEventListener("fetch",event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=="GET"||url.origin!==location.origin)return;
 const refresh=request.mode==="navigate"||["/app.js","/index.html","/styles.css"].some(path=>url.pathname.endsWith(path));
 event.respondWith((async()=>{
  if(refresh){
   try{const response=await fetch(request,{cache:"no-store"});if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy))}return response}catch{return (await caches.match(request))||(await caches.match("./index.html"))}
  }
  return (await caches.match(request))||(await fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy))}return response}).catch(()=>caches.match("./index.html")));
 })());
});