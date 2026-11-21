const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function harness(requestOverpass,center={lat:43.6,lng:-116.2}){
 const markers=[],fits=[],status={};const layer={addTo(){return this},clearLayers(){markers.length=0}};
 const L={layerGroup:()=>layer,divIcon:x=>x,latLngBounds:x=>x,marker:(point,options)=>({bindTooltip(){return this},bindPopup(){return this},addTo(){markers.push({point,title:options.title});return this}})};
 const context=vm.createContext({window:{L},L,document:{readyState:'loading',addEventListener(){},getElementById:()=>status,querySelectorAll:()=>[]},state:{map:{getZoom:()=>12,getCenter:()=>center,fitBounds:x=>fits.push(x)}},navigator:{onLine:true},AbortController,setTimeout,clearTimeout,requestOverpass,requestJson:async()=>JSON.parse(fs.readFileSync('data/parking-inventory.json')),distanceMeters:(a,b)=>Math.hypot(a.lat-b.lat,(a.lon-b.lon)*.72)*111195});
 vm.runInContext(fs.readFileSync('map-first.js','utf8'),context);return{show:context.window.dustinPlaces.show,markers,fits,status};
}
test('public inventory paints weigh stations even when live lookup fails and fits them into view',async()=>{
 const h=harness(async()=>{throw Error('unavailable')},{lat:45.96,lng:-119.34});await h.show('weigh');assert.ok(h.markers.length>0);assert.equal(h.fits.length,1);assert.match(h.status.textContent,/inventory/);
});
test('truck stops render provider results and pan refresh does not refit the viewport',async()=>{
 const h=harness(async()=>({elements:[{type:'node',id:1,lat:43.61,lon:-116.21,tags:{name:'Test truck stop'}}]}));await h.show('stops',false);assert.equal(h.markers[0].title,'Test truck stop');assert.equal(h.fits.length,0);
});
test('superseded category results cannot replace the latest markers',async()=>{
 let first;let calls=0;const h=harness(()=>++calls===1?new Promise(r=>first=r):Promise.resolve({elements:[{type:'node',id:2,lat:43.61,lon:-116.21,tags:{name:'Latest fuel'}}]}));
 const old=h.show('stops');while(!first)await new Promise(r=>setImmediate(r));await h.show('fuel');first({elements:[{type:'node',id:1,lat:43.61,lon:-116.21,tags:{name:'Old stop'}}]});await old;assert.deepEqual(h.markers.map(x=>x.title),['Latest fuel']);
});
