import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,enqueue,tick,serialize,restore,autonomousCandidates} from '../src/simulation.js';
import {mutableResident,mutableSite,changeBond} from '../src/living-state.js';
import {livingBonus,advanceLiving} from '../src/living-world.js';

const actors=g=>[{id:'player',position:g.player,needs:g.needs,queue:g.queue},...Object.entries(g.npcs).map(([id,p])=>({id,position:p,needs:p.needs,queue:p.queue}))];
function quiet(){const g=createGame();g.autonomy.enabled=false;for(const p of Object.values(g.npcs))p.ai.enabled=false;return g;}
const run=(g,n)=>{for(let i=0;i<n*20;i++)tick(g,.05,()=>.99);};

test('a low tree is reserved for vulnerable residents rather than drained by a healthy adult',()=>{
 const g=quiet(),tree={id:'tree',type:'spiritTree',x:3,z:3,side:'front',rotation:0};g.objects.push(tree);mutableSite(g,tree).vitality=35;g.npcs.nova.age=90;g.npcs.nova.needs.energy=30;g.npcs.nova.x=3;g.npcs.nova.z=2;
 assert.equal(livingBonus(g,actors(g)[0],{type:'pray',targetId:'tree'},actors(g)),null);
 assert.ok(autonomousCandidates(g,'nova').some(c=>c.type==='treeRest'));
});
test('resting together under a tree restores it and actually helps a vulnerable resident',()=>{
 const g=quiet(),tree={id:'tree',type:'spiritTree',x:3,z:3,side:'front',rotation:0};g.objects.push(tree);mutableSite(g,tree).vitality=35;g.player.age=90;g.needs.energy=30;
 assert.equal(enqueue(g,'treeRest','tree').ok,true);run(g,40);
 assert.ok(g.needs.energy>40);assert.ok(g.living.sites.tree.vitality>40);assert.equal(restore(serialize(g)).living.version,2);
});
test('a frightened resident can seek light and a hostile resident refuses it',()=>{
 const g=quiet();g.npcs.nova.prayer.radiance=10;mutableResident(g,g.player).fear=80;
 assert.ok(autonomousCandidates(g,'player').some(c=>c.type==='seekLight'&&c.targetId==='nova'));
 assert.equal(enqueue(g,'seekLight','nova').ok,true);run(g,30);assert.ok(g.living.residents[g.player.uid].fear<30);
 changeBond(g,g.player,g.npcs.nova,{resentment:70});
 assert.equal(enqueue(g,'seekLight','nova').ok,false);
});
test('companionship follows a moving friend, including returning from ahead, without teleporting',()=>{
 const g=quiet();g.objects=[];g.player.prayer.nether=10;g.player.x=7;g.player.z=0;g.npcs.nova.x=0;g.npcs.nova.z=0;
 changeBond(g,g.player,g.npcs.nova,{trust:40});g.npcs.nova.queue.push({id:g.nextId++,type:'walk',targetId:null,target:{x:8,z:3,island:'home',side:'front'},source:'manual',phase:'walking',elapsed:0,path:null});
 assert.equal(enqueue(g,'accompany','nova').ok,true);run(g,1);assert.ok(g.player.x<7);assert.ok(!g.queue[0]?.blinkTransit);
 run(g,8);assert.ok(Math.hypot(g.player.x-g.npcs.nova.x,g.player.z-g.npcs.nova.z)<2.5);
 assert.doesNotThrow(()=>restore(serialize(g)));
});
test('tree rest heals nearby infants without putting them into an adult action queue',()=>{
 const g=quiet(),tree={id:'tree',type:'spiritTree',x:3,z:3,side:'front'};g.objects.push(tree);mutableSite(g,tree).vitality=60;g.npcs.nova.age=0;g.npcs.nova.x=3;g.npcs.nova.z=3;g.npcs.nova.needs.comfort=20;
 g.minute+=10;advanceLiving(g,actors(g));assert.ok(g.npcs.nova.needs.comfort>20);assert.equal(g.npcs.nova.queue.length,0);
});
