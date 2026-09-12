import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGame,restore} from '../src/simulation.js';
import {discoverAdjacentIsland,contributeCivilization} from '../src/civilization.js';
test('discovery uses the authored ocean instead of generating a random island',()=>{
 const g=createGame();g.civilization.observations=3;
 assert.equal(discoverAdjacentIsland(g,'home',()=>0).name,'童梦星屿');
 g.civilization.visits.spore=1;g.civilization.observations=12;
 assert.equal(discoverAdjacentIsland(g,'spore').theme,'ocean');
 assert.deepEqual(g.civilization.discoveryPath,['home','spore','ocean']);
 assert.equal(Object.keys(g.civilization.islands).length,0);
});
test('each later observation remains undiscovered and does not call random',()=>{
 const g=createGame();g.civilization.discoveryPath=['home','spore','ocean'];g.civilization.visits.ocean=1;g.civilization.observations=12;
 for(let i=0;i<3;i++){
  g.civilization.observations++;
  assert.equal(discoverAdjacentIsland(g,'ocean'),null);
 }
 assert.equal(Object.keys(g.civilization.islands).length,0);
});
test('saved worlds retain discovery history and can discover the new authored ocean',()=>{
 const g=createGame();g.civilization.discoveryPath=['home','spore'];g.civilization.visits.spore=1;g.civilization.observations=1000;
 const loaded=restore(JSON.stringify(g));
 assert.deepEqual(loaded.civilization.discoveryPath,['home','spore']);
 assert.equal(discoverAdjacentIsland(loaded,'spore').theme,'ocean');
 assert.equal(Object.keys(loaded.civilization.islands).length,0);
});
test('surveying the current frontier still records the survey without discovery',()=>{
 const g=createGame();g.civilization.discoveryPath=['home','spore'];g.civilization.visits.spore=1;
 contributeCivilization(g,'explore',{island:'spore'},null,null);
 assert.equal(g.civilization.surveys.spore,1);assert.equal(g.civilization.knowledge,6);assert.equal(Object.keys(g.civilization.islands).length,0);
});
