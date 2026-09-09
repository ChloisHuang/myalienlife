import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGame,restore} from '../src/simulation.js';
import {ISLAND_DISCOVERY_CHANCE,discoverAdjacentIsland,contributeCivilization} from '../src/civilization.js';
function frontier(){const g=createGame();g.civilization.discoveryPath=['home','spore','city'];g.civilization.visits.city=1;g.civilization.observations=12;return g;}
test('random discovery is half the previous rate, exactly one in 96',()=>{
 assert.equal(ISLAND_DISCOVERY_CHANCE,1/96);let discoveries=0;
 for(let i=0;i<960;i++){const g=frontier();if(discoverAdjacentIsland(g,'city',()=>(i+.5)/960))discoveries++;}assert.equal(discoveries,10);
});
test('each observation gets one roll; upstream worlds cannot reveal another successor',()=>{
 const g=frontier(),c=g.civilization;c.observations=10000;assert.ok(discoverAdjacentIsland(g,'city',()=>0));assert.equal(discoverAdjacentIsland(g,'city',()=>0),null);c.observations++;assert.equal(discoverAdjacentIsland(g,'city',()=>0),null);assert.equal(Object.keys(c.islands).length,1);
});
test('saved worlds survive migration and loading does not roll past observations',()=>{
 const g=frontier();g.civilization.observations=1000;discoverAdjacentIsland(g,'city',()=>0);const islands=structuredClone(g.civilization.islands);g.version=19;delete g.civilization.lastDiscoveryObservation;const loaded=restore(JSON.stringify(g));assert.deepEqual(loaded.civilization.islands,islands);assert.equal(loaded.civilization.lastDiscoveryObservation,1000);assert.equal(discoverAdjacentIsland(loaded,'wild-0',()=>0),null);assert.deepEqual(restore(JSON.stringify(loaded)).civilization,loaded.civilization);
});
test('surveying on the visited frontier rolls, while upstream surveying only adds knowledge',()=>{
 const g=frontier();contributeCivilization(g,'explore',{island:'city'},null,null,()=>1);assert.equal(g.civilization.surveys.city,1);assert.equal(g.civilization.knowledge,6);assert.equal(Object.keys(g.civilization.islands).length,0);
 contributeCivilization(g,'observe',{island:'home'},null,null,()=>{throw Error('upstream must not roll');});
});
