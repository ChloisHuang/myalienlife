import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,enqueue,tick,restore,serialize} from '../src/simulation.js';
import {mutableResident,changeBond} from '../src/living-state.js';

function world(side){const g=createGame();g.objects=[];g.autonomy.enabled=false;for(const p of Object.values(g.npcs))p.ai.enabled=false;g.player.island='spore';g.player.side=side;g.player.x=-5;g.player.z=side==='front'?2:-2;g.viewIsland='spore';g.viewSide=side;return g;}
test('ordinary walkers detour around living growth while a garden guide opens the short path',()=>{
 const g=world('front');enqueue(g,'walk',null,{x:-1,z:2});tick(g,.01);assert.ok(g.queue[0].path.some(p=>p.z!==2));
 const guided=world('front');Object.assign(mutableResident(guided,guided.player),{garden:40,charge:60});enqueue(guided,'walk',null,{x:-1,z:2});tick(guided,.01);
 assert.ok(guided.queue[0].path.some(p=>p.livingTrail==='garden'));assert.ok(guided.queue[0].path.every(p=>p.z===2));
});
test('forest shortcuts require an actual scouting pause and persist correctly mid-scout',()=>{
 const g=world('back');mutableResident(g,g.player).shadow=60;enqueue(g,'walk',null,{x:-1,z:-2});tick(g,.5);
 assert.ok(g.queue[0].scoutElapsed>0);assert.equal(g.player.x,-5);
 assert.doesNotThrow(()=>restore(serialize(g)));
 for(let i=0;i<100;i++)tick(g,.1);assert.equal(g.player.x,-1);
});
test('garden opening admits a nearby ordinary companion, not a remote resident',()=>{
 const g=world('front'),p=g.npcs.nova;Object.assign(p,{island:'spore',side:'front',x:-4,z:3});Object.assign(mutableResident(g,p),{garden:40,charge:60});changeBond(g,p,g.player,{trust:30});
 enqueue(g,'walk',null,{x:-1,z:2});tick(g,.01);assert.ok(g.queue[0].path.some(p=>p.livingTrail==='garden'));
});
