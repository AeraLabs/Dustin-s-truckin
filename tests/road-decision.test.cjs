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
