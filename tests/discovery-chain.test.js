import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,restore,serialize} from '../src/simulation.js';
import {contributeCivilization,discovered} from '../src/civilization.js';
const observe=(g,island)=>contributeCivilization(g,'observe',{island},null,null);
const explore=(g,island)=>contributeCivilization(g,'explore',{island},null,null);
test('only the released fairytale island is discoverable',()=>{
 const g=createGame();g.wonders.archive=3;g.civilization.visits.spore=1;
 for(let i=0;i<3;i++)observe(g,'home');
 assert.deepEqual(g.civilization.discoveryPath,['home']);assert.equal(g.civilization.lastDiscoveryObservation,0);
 explore(g,'home');
 assert.deepEqual(g.civilization.discoveryPath,['home','spore']);
 observe(g,'spore');
 assert.deepEqual(g.civilization.discoveryPath,['home','spore']);assert.equal(g.civilization.lastDiscoveryObservation,4);
 g.civilization.observations=12;explore(g,'spore');
 assert.deepEqual(g.civilization.discoveryPath,['home','spore']);
 assert.equal(g.civilization.surveys.spore,1);assert.equal(Object.keys(g.civilization.islands).length,0);
});
test('exploration stays empty after the last released island',()=>{
 const g=createGame();for(let i=0;i<100;i++)observe(g,'home');
 assert.deepEqual(g.civilization.discoveryPath,['home']);assert.equal(Object.keys(g.civilization.islands).length,0);
 g.wonders.archive=3;explore(g,'home');assert.equal(discovered(g,'city'),false);
 observe(g,'spore');assert.equal(discovered(g,'city'),false);
 g.civilization.visits.spore=1;explore(g,'spore');assert.equal(discovered(g,'city'),false);assert.equal(Object.keys(g.civilization.islands).length,0);
 for(let i=0;i<10;i++)explore(g,'spore');assert.equal(Object.keys(g.civilization.islands).length,0);
 assert.deepEqual(restore(serialize(g)).civilization,g.civilization);
});
test('old saves keep all discovered worlds without rolling new ones on reload',()=>{
 const g=createGame();g.version=21;delete g.civilization.discoveryPath;g.civilization.observations=50;g.wonders.archive=3;
 const loaded=restore(serialize(g));assert.deepEqual(loaded.civilization.discoveryPath,['home','spore']);assert.equal(Object.keys(loaded.civilization.islands).length,0);assert.equal(loaded.version,24);
});
