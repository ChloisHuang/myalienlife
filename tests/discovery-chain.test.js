import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,restore,serialize} from '../src/simulation.js';
import {contributeCivilization,discovered} from '../src/civilization.js';
const observe=(g,island,random=()=>0)=>contributeCivilization(g,'observe',{island},null,null,random);
const explore=(g,island,random=()=>0)=>contributeCivilization(g,'explore',{island},null,null,random);
test('only exploration on the current frontier may discover its successor',()=>{
 const g=createGame();g.wonders.archive=3;g.civilization.visits.spore=1;
 for(let i=0;i<3;i++)observe(g,'home');
 assert.deepEqual(g.civilization.discoveryPath,['home']);assert.equal(g.civilization.lastDiscoveryObservation,0);
 explore(g,'home');
 assert.deepEqual(g.civilization.discoveryPath,['home','spore']);
 observe(g,'spore');
 assert.deepEqual(g.civilization.discoveryPath,['home','spore']);assert.equal(g.civilization.lastDiscoveryObservation,4);
 g.civilization.observations=12;explore(g,'spore');
 assert.deepEqual(g.civilization.discoveryPath,['home','spore','wild-0']);
 assert.equal(g.civilization.surveys.spore,1);assert.match(g.log[0].text,/童梦星屿勘察时发现/);
});
test('home reveals only spore, and the next discovery requires a visit to the frontier',()=>{
 const g=createGame();for(let i=0;i<100;i++)observe(g,'home');
 assert.deepEqual(g.civilization.discoveryPath,['home']);assert.equal(Object.keys(g.civilization.islands).length,0);
 g.wonders.archive=3;explore(g,'home');assert.equal(discovered(g,'city'),false);
 observe(g,'spore');assert.equal(discovered(g,'city'),false);
 g.civilization.visits.spore=1;explore(g,'spore');assert.equal(discovered(g,'city'),false);assert.ok(g.civilization.islands['wild-0']);
 for(let i=0;i<10;i++)explore(g,'spore');assert.equal(Object.keys(g.civilization.islands).length,1);
 explore(g,'wild-0');assert.equal(Object.keys(g.civilization.islands).length,1);
 g.civilization.visits['wild-0']=1;explore(g,'wild-0');assert.ok(g.civilization.islands['wild-1']);
 assert.deepEqual(restore(serialize(g)).civilization,g.civilization);
});
test('old saves keep all discovered worlds without rolling new ones on reload',()=>{
 const g=createGame();g.version=21;delete g.civilization.discoveryPath;g.civilization.observations=50;g.wonders.archive=3;
 const loaded=restore(serialize(g));assert.deepEqual(loaded.civilization.discoveryPath,['home','spore','city']);assert.equal(Object.keys(loaded.civilization.islands).length,0);
});
