import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import {createPlant,advancePlants} from '../src/plants.js';
import * as plants from '../src/plants.js';
const quiet=()=>{const g=sim.createGame();g.autonomy.enabled=false;for(const n of Object.values(g.npcs))n.ai.enabled=false;return g;};
const step=g=>{for(let i=0;i<40;i++)sim.tick(g,1,()=>.99);};
test('mushroom traits choose distinct assets and stack value multipliers',()=>{
 assert.equal(typeof plants.mushroomVariant,'function');
 for(const [traits,variant,amount,price] of [[{},'normal',2,25],[{giant:true},'giant',4,25],[{cluster:true},'cluster',6,25],[{mutant:true},'mutant',2,75],[{giant:true,cluster:true,mutant:true},'mutant-cluster',12,75]]){
  const o={type:'mushroom',plant:{...createPlant(),...traits}};assert.equal(plants.mushroomVariant(o.plant),variant);assert.equal(plants.harvestAmount(o),amount);assert.equal(plants.harvestPrice(o),price);
 }
});
test('resident walks to chosen soil, pays once, then sells and removes a one-shot mushroom',()=>{
 const g=quiet();assert.equal(sim.enqueue(g,'plantMushroom',null,{x:-5,z:4}).ok,true);
 assert.equal(g.money,2400);step(g);
 const o=g.objects.find(o=>o.type==='mushroom');assert.ok(o);assert.equal(o.x,-5);assert.equal(g.money,2380);
 o.plant.growth=1;o.plant.health=1;assert.equal(sim.enqueue(g,'harvest',o.id).ok,true);step(g);
 assert.equal(g.money,2405);assert.equal(g.harvest.mushrooms,0);assert.ok(!g.objects.includes(o));
 assert.deepEqual(sim.restore(sim.serialize(g)),g);
});
test('planting rejects occupied soil and insufficient funds, rechecks on completion',()=>{
 const g=quiet();assert.equal(sim.enqueue(g,'plantMushroom',null,{x:-5,z:-4}).ok,false);
 g.money=19;assert.equal(sim.enqueue(g,'plantMushroom',null,{x:-5,z:4}).ok,false);
 g.money=100;assert.equal(sim.enqueue(g,'plantMushroom',null,{x:-5,z:4}).ok,true);g.money=0;step(g);assert.ok(!g.objects.some(o=>o.type==='mushroom'));
});
test('autonomy chooses local free planting locations with a bounded crop population',()=>{
 const g=quiet();assert.ok(sim.autonomousCandidates(g,'nova').some(c=>c.type==='plantMushroom'&&c.point));
 for(let i=0;i<6;i++)g.objects.push({id:`m-${i}`,type:'mushroom',x:i*2-8,z:5,side:'front',island:'home',rotation:0,plant:createPlant()});
 assert.ok(!sim.autonomousCandidates(g,'nova').some(c=>c.type==='plantMushroom'));
});
test('urgent needs take priority over discretionary planting',()=>{
 const g=quiet();g.npcs.nova.needs.hunger=1;assert.ok(!sim.autonomousCandidates(g,'nova').some(c=>c.type==='plantMushroom'));
});
test('an autonomous NPC actually plants, paying only from its personal wallet',()=>{
 const g=quiet(),n=g.npcs.nova;g.objects=[];n.ai.enabled=true;for(const key in n.needs)n.needs[key]=100;
 sim.tick(g,.1,()=>0);assert.equal(n.queue[0].type,'plantMushroom');const target={...n.queue[0].target};assert.doesNotThrow(()=>sim.restore(sim.serialize(g)));n.ai.enabled=false;
 step(g);assert.equal(n.money,580);assert.equal(g.money,2400);assert.ok(g.objects.some(o=>o.type==='mushroom'&&o.x===target.x&&o.z===target.z));
});
test('pending autonomous plantings count toward the local crop limit',()=>{
 const g=quiet();for(let i=0;i<6;i++)g.queue.push({id:g.nextId++,type:'plantMushroom',targetId:null,target:{x:i*2-8,z:5,island:'home',side:'front'},source:'manual',elapsed:0,phase:'walking',path:null});
 assert.ok(!sim.autonomousCandidates(g,'nova').some(c=>c.type==='plantMushroom'));
});
test('dead mushroom replacement also requires seed money',()=>{
 const g=quiet();g.objects.push({id:'dead',type:'mushroom',x:-5,z:4,rotation:0,plant:{...createPlant(),health:0}});g.money=19;
 assert.equal(sim.enqueue(g,'replant','dead').ok,false);g.money=20;assert.equal(sim.enqueue(g,'replant','dead').ok,true);step(g);assert.equal(g.money,0);assert.equal(g.objects.find(o=>o.id==='dead').plant.health,100);
});
test('cancelled planting is free and competing harvest queues cannot duplicate sale',()=>{
 const g=quiet();sim.enqueue(g,'plantMushroom',null,{x:-5,z:4});sim.cancelAction(g,g.queue[0].id);step(g);assert.equal(g.money,2400);
 const o={id:'crop',type:'mushroom',x:-5,z:4,rotation:0,plant:{...createPlant(),growth:1}};g.objects.push(o);sim.enqueue(g,'harvest',o.id);sim.enqueue(g,'harvest',o.id);sim.enqueue(g,'garden',o.id);step(g);assert.equal(g.money,2450);assert.equal(g.queue.length,0);assert.doesNotThrow(()=>sim.restore(sim.serialize(g)));
});
test('mushroom giant, cluster and mutation are independent once-only maturity rolls',()=>{
 const o={type:'mushroom',plant:{...createPlant(),growth:.999}};advancePlants([o],2,undefined,()=>0);
 assert.equal(o.plant.giant,true);assert.equal(o.plant.cluster,true);assert.equal(o.plant.mutant,true);
 const saved=JSON.stringify(o.plant);advancePlants([o],0,undefined,()=>.99);assert.equal(JSON.stringify(o.plant),saved);
});
test('legacy harvest balances liquidate once to their owners on restore',()=>{
 const g=quiet();g.harvest.spores=3;g.npcs.nova.inventory.mushrooms=2;const money=g.npcs.nova.money;
 const loaded=sim.restore(sim.serialize(g));assert.equal(loaded.money,2454);assert.equal(loaded.npcs.nova.money,money+50);assert.equal(loaded.harvest.spores,0);
 assert.deepEqual(sim.restore(sim.serialize(loaded)),loaded);
});
