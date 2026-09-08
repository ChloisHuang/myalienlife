import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGame,restore} from '../src/simulation.js';
import {ISLAND_DISCOVERY_CHANCE,discoverProceduralIslands,contributeCivilization} from '../src/civilization.js';
test('new island base discovery rate is eight times lower than the former one per six observations',()=>{
 assert.equal(ISLAND_DISCOVERY_CHANCE,1/6/8);let discoveries=0;
 for(let i=0;i<480;i++){const c=createGame().civilization;c.observations=12;if(discoverProceduralIslands(c,()=>(i+.5)/480))discoveries++;}assert.equal(discoveries,10);
});
test('one observation gets one roll and can never backfill multiple islands from accumulated history',()=>{
 const c=createGame().civilization;c.observations=10000;assert.ok(discoverProceduralIslands(c,()=>0));assert.equal(Object.keys(c.islands).length,1);assert.equal(discoverProceduralIslands(c,()=>0),null);c.observations++;assert.equal(discoverProceduralIslands(c,()=>1),null);assert.equal(discoverProceduralIslands(c,()=>0),null);
});
test('saved islands survive migration and reload never rolls historical observations',()=>{
 const g=createGame();g.civilization.observations=1000;discoverProceduralIslands(g.civilization,()=>0);const islands=structuredClone(g.civilization.islands);g.version=19;delete g.civilization.lastDiscoveryObservation;const loaded=restore(JSON.stringify(g));assert.deepEqual(loaded.civilization.islands,islands);assert.equal(loaded.civilization.lastDiscoveryObservation,1000);assert.equal(discoverProceduralIslands(loaded.civilization,()=>0),null);assert.deepEqual(restore(JSON.stringify(loaded)).civilization,loaded.civilization);
});
test('failed discovery still grants normal shared knowledge and observations; remote surveying never rolls',()=>{
 const g=createGame();g.civilization.observations=11;contributeCivilization(g,'observe',g.player,undefined,undefined,()=>1);assert.equal(g.civilization.observations,12);assert.equal(g.civilization.knowledge,1);assert.equal(Object.keys(g.civilization.islands).length,0);contributeCivilization(g,'explore',{island:'spore'},undefined,undefined,()=>{throw Error('must not roll');});assert.equal(g.civilization.surveys.spore,1);
});
