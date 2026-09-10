import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,enqueue,tick,autonomousCandidates,buyItem} from '../src/simulation.js';
import {mutableResident,mutableSite,changeBond} from '../src/living-state.js';
import {spatialCandidates,shadowCompanionOffset,refuses} from '../src/living-spatial.js';

const actors=g=>[{id:'player',position:g.player,needs:g.needs,queue:g.queue},...Object.entries(g.npcs).map(([id,p])=>({id,position:p,needs:p.needs,queue:p.queue}))];
function quiet(){const g=createGame();g.autonomy.enabled=false;for(const p of Object.values(g.npcs))p.ai.enabled=false;return g;}
test('unfriendly residents choose the far seat rather than the first free neighboring seat',()=>{
 const g=quiet(),sofa=g.objects.find(o=>o.id==='sofa');Object.assign(g.player,{x:sofa.x+1.3,z:sofa.z});changeBond(g,g.player,g.npcs.nova,{resentment:60});
 g.npcs.nova.queue=[{id:g.nextId++,type:'relax',targetId:'sofa',target:{x:sofa.x+1.3,z:sofa.z},source:'manual',phase:'acting',elapsed:0,path:[],seat:0}];
 assert.equal(enqueue(g,'relax','sofa').ok,true);tick(g,.05);assert.equal(g.queue[0].seat,2);
});
test('an unfriendly resident declines a paired invitation rather than silently queuing it',()=>{
 const g=quiet();changeBond(g,g.npcs.nova,g.player,{resentment:60});
 const o=buyItem(g,'lamp',4,2).object;
 const result=enqueue(g,'passOrb',o.id,null,'nova');assert.equal(result.ok,false);assert.match(result.message,/不愿/);assert.equal(g.npcs.nova.queue.length,0);
});
test('a quiet keeper leaves the actual party space and an outgoing keeper can stay',()=>{
 const g=quiet(),o=g.objects.find(o=>o.plant);Object.assign(g.player,{island:'spore',x:0,z:2});Object.assign(o,{island:'spore',x:0,z:2});mutableSite(g,o).keeper=g.player.uid;
 Object.assign(g.npcs.nova,{island:'spore',x:1,z:2,queue:[{type:'dance',phase:'acting'}]});g.player.preferences.chat=0;
 assert.ok(spatialCandidates(g,actors(g)[0],actors(g),()=>true).some(c=>c.spaceWithdrawal&&Math.hypot(c.point.x-1,c.point.z-2)>3));
 g.player.preferences.chat=30;assert.ok(!spatialCandidates(g,actors(g)[0],actors(g),()=>true).some(c=>c.spaceWithdrawal));
});
test('shadow closeness and avoidance are intermittent, directional and render-only',()=>{
 const g=quiet();Object.assign(g.player,{island:'spore',side:'back',x:0,z:0});Object.assign(g.npcs.nova,{island:'spore',side:'back',x:2,z:0});changeBond(g,g.player,g.npcs.nova,{trust:40});
 const saved=JSON.stringify(g);assert.ok(shadowCompanionOffset(g,g.player,1).x>0);assert.equal(JSON.stringify(g),saved);assert.equal(shadowCompanionOffset(g,g.player,12).x,0);
 changeBond(g,g.player,g.npcs.nova,{resentment:30});assert.ok(shadowCompanionOffset(g,g.player,1).x<0);
});
test('an active prayer attracts a trusted witness even when the praying resident is busy',()=>{
 const g=quiet();changeBond(g,g.player,g.npcs.nova,{trust:30});g.npcs.nova.queue=[{type:'pray',phase:'acting'}];
 assert.ok(autonomousCandidates(g,'player').some(c=>c.type==='witnessPrayer'&&c.targetId==='nova'));
});

test('competing tree users wait at different positions while the current ritual continues',()=>{
 const g=quiet();g.objects=[];const tree=buyItem(g,'spiritTree',0,0).object;
 Object.assign(g.player,{x:0,z:1.6});Object.assign(g.npcs.nova,{x:0,z:2});g.npcs.nova.queue=[{id:g.nextId++,type:'pray',targetId:tree.id,target:{x:0,z:1.6,island:'home',side:'front'},source:'manual',phase:'acting',elapsed:0,path:[]}];
 enqueue(g,'pray',tree.id);for(let i=0;i<40;i++)tick(g,.05);
 assert.ok(Math.hypot(g.player.x-g.npcs.nova.x,g.player.z-g.npcs.nova.z)>1);assert.notEqual(g.queue[0].phase,'acting');
});

test('repeatedly blinking away from a dependent friend eventually costs their willingness to join',()=>{
 const g=quiet();g.objects=[];g.player.prayer.nether=10;Object.assign(g.npcs.nova,{x:1,z:0});changeBond(g,g.npcs.nova,g.player,{trust:40,dependence:30});
 for(let round=0;round<4;round++){Object.assign(g.player,{x:0,z:0});g.queue=[];enqueue(g,'walk',null,{x:8,z:0});for(let i=0;i<26;i++)tick(g,.1);}
 assert.equal(refuses(g,g.npcs.nova,g.player),true);
});
