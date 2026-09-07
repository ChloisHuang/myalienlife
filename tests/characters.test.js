import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import {appearance,lifeStage} from '../src/characters.js';

test('skills expose independent levels and progress rather than raw training counts',()=>{
 assert.equal(typeof sim.skillProgress,'function');
 assert.deepEqual(sim.skillProgress(0),{level:1,xp:0,next:3,progress:0});
 assert.deepEqual(sim.skillProgress(3),{level:2,xp:0,next:6,progress:0});
 assert.equal(sim.skillProgress(135).level,10);assert.equal(sim.skillProgress(135).progress,100);
});
test('gender and age edits change a residents profile and persist without changing skills',()=>{
 const g=sim.createGame();assert.equal(typeof sim.updateResident,'function');g.skills.science=9;
 assert.equal(sim.updateResident(g,'player',{gender:'female',age:65}).ok,true);
 assert.equal(g.player.gender,'female');assert.equal(g.player.age,65);assert.equal(g.skills.science,9);
 assert.deepEqual(sim.restore(sim.serialize(g)),g);assert.equal(sim.updateResident(g,'player',{gender:'unknown',age:-1}).ok,false);
});
test('aging advances with game time and freezes while paused',()=>{
 const g=sim.createGame();assert.equal(typeof g.player.age,'number');g.player.age=17.999;const before=g.player.age;
 sim.tick(g,30);assert.ok(g.player.age>before);g.speed=0;const paused=g.player.age;sim.tick(g,30);assert.equal(g.player.age,paused);
});
test('aging advances one star year per eight game days at normal speed',()=>{
 const g=sim.createGame(),before=g.player.age;
 sim.tick(g,1);
 assert.ok(Math.abs(g.player.age-(before+2/(1440*8)))<1e-12);
});
test('life stages follow configurable age boundaries',()=>{
 const stages={infantEnd:2,childEnd:5,teenEnd:9,adultEnd:14,elderEnd:20};
 assert.equal(lifeStage(1.99,stages),'infant');
 assert.equal(lifeStage(2,stages),'child');
 assert.equal(lifeStage(8.99,stages),'teen');
 assert.equal(lifeStage(9,stages),'adult');
 assert.equal(lifeStage(14,stages),'elder');
 const person=sim.createGame().player;person.age=14;assert.equal(appearance(person,stages).stage,'elder');
});
test('lifecycle boundaries are saved and control adult and elder behavior',()=>{
 const g=sim.createGame();assert.deepEqual(g.config.lifeStages,{infantEnd:3,childEnd:13,teenEnd:18,adultEnd:60,elderEnd:120});
 g.config.lifeStages={infantEnd:2,childEnd:5,teenEnd:9,adultEnd:14,elderEnd:20};g.player.age=8;
 assert.equal(sim.enqueue(g,'work','lab').ok,false);g.player.age=9;assert.equal(sim.enqueue(g,'work','lab').ok,true);
 g.queue=[];g.npcs.zig.age=20;sim.tick(g,1);assert.equal(g.npcs.zig,undefined);
 assert.deepEqual(sim.restore(sim.serialize(g)).config.lifeStages,g.config.lifeStages);
});
test('appearance mutation probabilities are configurable per body part',()=>{
 const g=sim.createGame();assert.deepEqual(g.config.mutationRates,{color:2.4,stature:2.4,build:2.4,head:2.4,antenna:2.4});
 const parent=g.player,forced=sim.inheritTraits([parent],()=>0,{color:100,stature:0,build:0,head:0,antenna:0});
 assert.deepEqual(forced.mutations,['肤色变异']);
 assert.deepEqual(sim.restore(sim.serialize(g)).config.mutationRates,g.config.mutationRates);
});
test('rotating furniture rotates its approach position so interaction reaches its front',()=>{
 const g=sim.createGame();g.objects.find(o=>o.id==='food').rotation=Math.PI/2;sim.enqueue(g,'eat','food');
 assert.ok(g.queue[0].target.x>2);assert.ok(Math.abs(g.queue[0].target.z+4)<.001);
});
test('romantic interactions are restricted to adult residents',()=>{
 const g=sim.createGame();assert.equal(typeof sim.updateResident,'function');sim.updateResident(g,'nova',{gender:'female',age:12});g.relationships.nova=80;
 assert.equal(sim.enqueue(g,'flirt','nova').ok,false);assert.equal(sim.enqueue(g,'chat','nova').ok,true);
});
test('version 2 saves gain demographics and new skills without losing experience',()=>{
 const g=sim.createGame();g.version=2;delete g.player.age;delete g.player.gender;delete g.skills.social;delete g.skills.music;g.skills.science=17;
 for(const n of Object.values(g.npcs)){delete n.age;delete n.gender;delete n.skills.social;delete n.skills.music;}
 const loaded=sim.restore(JSON.stringify(g));assert.equal(loaded.version,6);assert.equal(loaded.skills.science,17);assert.equal(loaded.skills.music,0);assert.equal(loaded.player.age,28);
});
test('legacy saves gain NPC money and personal harvest inventory',()=>{
 const g=sim.createGame();for(const n of Object.values(g.npcs)){delete n.money;delete n.inventory;}
 const loaded=sim.restore(sim.serialize(g));assert.equal(loaded.npcs.nova.money,600);assert.deepEqual(loaded.npcs.nova.inventory,{spores:0,mushrooms:0});
});
