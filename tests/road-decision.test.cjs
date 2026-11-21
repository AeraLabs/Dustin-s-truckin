const {test}=require('node:test');const assert=require('node:assert/strict');
const {lineDistance,rankRoutes}=require('../road-decision.js');
test('distance uses full road segments, including between widely spaced vertices',()=>{
 assert.equal(lineDistance({lat:40,lon:-100},[[-101,40],[-99,40]]),0);
 assert.ok(lineDistance({lat:40.01,lon:-100},[[-101,40],[-99,40]])>1000);
 assert.equal(lineDistance({lat:40,lon:-100},[]),Infinity);
});
test('route comparison ranks geographic alternatives without describing them as safe',()=>{
 const routes=[{distance:160934,geometry:{coordinates:[[-101,40],[-99,40]]}},{distance:177027,geometry:{coordinates:[[-101,41],[-99,41]]}}];
 const ranked=rankRoutes(routes,{lat:40,lon:-100},50);
 assert.equal(ranked[0].index,1);assert.equal(ranked[0].near,false);assert.equal(ranked[0].extraMiles,10);assert.equal(ranked[1].near,true);assert.equal(ranked[1].minutes,120);
 assert.equal(rankRoutes(routes,null)[0].near,null);
});
test('empty alternatives remain empty',()=>assert.deepEqual(rankRoutes([],null),[]));
const {closestPoint,chooseRoad,snapRadius}=require('../road-decision.js');
const way=(highway,lat,name=highway)=>({tags:{highway,name},geometry:[{lat,lon:-116.3},{lat,lon:-116.1}]});
test('off-road taps prefer a major highway over a closer mountain track or ramp',()=>{
 const hit=chooseRoad({lat:43.6,lon:-116.2},[way('track',43.601),way('motorway_link',43.602),way('motorway',43.605,'I-84')],2000);
 assert.equal(hit.way.tags.name,'I-84');assert.equal(hit.snapped,true);assert.equal(hit.point.lat,43.605);assert.ok(hit.distance>500);
});
test('a direct local road tap takes precedence over a nearby interstate',()=>{
 const hit=chooseRoad({lat:43.6,lon:-116.2},[way('residential',43.6001,'Main St'),way('motorway',43.601,'I-84')],2000);
 assert.equal(hit.way.tags.name,'Main St');assert.equal(hit.snapped,false);
});
test('chooses nearest through highway and refuses distant roads and footpaths',()=>{
 const hit=chooseRoad({lat:43.6,lon:-116.2},[way('primary',43.61),way('trunk',43.607),way('motorway',43.609)],2000);
 assert.equal(hit.way.tags.highway,'trunk');
 assert.equal(chooseRoad({lat:43.6,lon:-116.2},[way('motorway',44),way('footway',43.6)],800),null);
});
test('projected selection lands on the segment or its nearest endpoint',()=>{
 assert.deepEqual(closestPoint({lat:1,lon:1},[[0,0],[2,0]]).point,{lat:0,lon:1});
 assert.deepEqual(closestPoint({lat:0,lon:3},[[0,0],[2,0]]).point,{lat:0,lon:2});
 assert.equal(closestPoint({lat:0,lon:0},[]).distance,Infinity);
});
test('forgiving search scales with zoom and remains bounded',()=>{
 assert.equal(snapRadius(43,18),800);assert.equal(snapRadius(43,8),5000);assert.ok(snapRadius(43,12)>snapRadius(43,16));
});
