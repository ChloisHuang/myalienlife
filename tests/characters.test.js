import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import {appearance,lifeStage} from '../src/characters.js';
import {HEAD_SHAPE,residentHeadShape} from '../src/genetics.js';
test('randomizing head shape and antenna length preserves colors, body genes and progress',()=>{
 const g=sim.createGame(),before=structuredClone(g);let seed=17;sim.randomizeHeads(g,()=>((seed=seed*16807%2147483647)/2147483647));
 const people=[g.player,...Object.values(g.npcs)],original=[before.player,...Object.values(before.npcs)];
 assert.equal(new Set(people.map(p=>JSON.stringify(p.genome))).size,people.length);
 people.forEach((p,i)=>{assert.equal(p.color,original[i].color);for(const k of ['stature','build','head'])assert.equal(p.genome[k],original[i].genome[k]);for(const k of [...Object.keys(HEAD_SHAPE),'antenna'])assert.ok(p.genome[k]>=.8&&p.genome[k]<=1.2);});
 assert.equal(g.money,before.money);assert.deepEqual(sim.restore(sim.serialize(g)),g);
});

test('head shape edits persist, inherit and reject invalid values without partial writes',()=>{
 const g=sim.createGame(),headShape={headWidth:.85,headHeight:1.2,headDepth:1.1,jaw:1.15};
 assert.equal(sim.updateResident(g,'player',{gender:'male',age:28,headShape}).ok,true);
 const restored=sim.restore(sim.serialize(g));for(const key of Object.keys(HEAD_SHAPE))assert.equal(restored.player.genome[key],headShape[key]);
 const child=sim.inheritTraits([g.player,g.npcs.nova],()=>.9);for(const key of Object.keys(HEAD_SHAPE)){const low=Math.min(headShape[key],g.npcs.nova.genome[key]),high=Math.max(headShape[key],g.npcs.nova.genome[key]);assert.ok(child.genome[key]>=low-(high-low)*.2&&child.genome[key]<=high+(high-low)*.2);}
 const before=sim.serialize(g);assert.equal(sim.updateResident(g,'player',{gender:'female',age:18,headShape:{...headShape,headWidth:NaN}}).ok,false);assert.equal(sim.serialize(g),before);
});
test('two-parent numeric inheritance samples an extrapolated range instead of collapsing to the midpoint',()=>{
 const genome=Object.fromEntries(Object.keys(sim.createGame().player.genome).map(key=>[key,.9]));
 const a={color:'#444444',genome:{...genome},preferences:{research:20},familyDesire:.2,prayer:{radiance:0,nether:0,mutations:[]}};
 const b={color:'#888888',genome:{...genome,stature:1.1,headWidth:1.1},preferences:{research:40},familyDesire:.8,prayer:{radiance:0,nether:0,mutations:[]}};
 const rates={color:0,stature:0,build:0,head:0,antenna:0},child=sim.inheritTraits([a,b],()=>0,rates);
 assert.equal(child.genome.stature,.86);assert.equal(child.color,'#363636');assert.equal(child.preferences.research,16);assert.ok(Math.abs(child.familyDesire-.08)<1e-12);
 const same=sim.inheritTraits([a,a],()=>.99,rates);assert.ok(same.genome.build>.9);
});
test('racial attributes use thirty-percent parent-value baselines with normal variation and separate mutation inheritance',()=>{
 const g=sim.createGame(),a=structuredClone(g.player),b=structuredClone(g.npcs.nova),rates={color:0,stature:0,build:0,head:0,antenna:0};
 a.prayer={radiance:20,nether:0,mutations:['crown']};b.prayer={radiance:0,nether:50,mutations:['spines']};
 const baseline=sim.inheritTraits([a,b],()=>.25,rates);assert.equal(baseline.prayer.radiance,3);assert.equal(baseline.prayer.nether,8);assert.deepEqual(baseline.prayer.mutations,[]);
 const varied=sim.inheritTraits([a,b],()=>.01,rates);assert.ok(varied.prayer.radiance>3);assert.ok(varied.prayer.nether>8);assert.deepEqual(new Set(varied.prayer.mutations),new Set(['crown','spines']));
 const configured=sim.inheritTraits([a,b],()=>.25,rates,{racialInheritanceRate:50,racialInheritanceStdDev:0,racialMutationInheritanceChance:100});assert.equal(configured.prayer.radiance,5);assert.equal(configured.prayer.nether,13);assert.deepEqual(new Set(configured.prayer.mutations),new Set(['crown','spines']));
 const absent=sim.inheritTraits([structuredClone(g.player),structuredClone(g.npcs.nova)],()=>.01,rates);assert.deepEqual(absent.prayer,{radiance:0,nether:0,mutations:[]});
});
test('v6 saves gain head shape once while retaining existing appearance and progress',()=>{
 const g=sim.createGame();g.version=6;g.objects=g.objects.filter(o=>o.type!=='gate');g.money=1999;g.player.genome.stature=1.12;
 for(const p of [g.player,...Object.values(g.npcs)])for(const key of Object.keys(HEAD_SHAPE))delete p.genome[key];
 const loaded=sim.restore(sim.serialize(g));assert.equal(loaded.version,21);assert.equal(loaded.money,1999);assert.equal(loaded.player.genome.stature,1.12);
 for(const [key,value]of Object.entries(residentHeadShape(g.player.uid)))assert.equal(loaded.player.genome[key],value);
 delete loaded.player.genome.jaw;assert.throws(()=>sim.restore(sim.serialize(loaded)));
});

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
 const g=sim.createGame();g.version=2;g.objects=g.objects.filter(o=>o.type!=='gate');delete g.player.age;delete g.player.gender;delete g.skills.social;delete g.skills.music;g.skills.science=17;
 for(const n of Object.values(g.npcs)){delete n.age;delete n.gender;delete n.skills.social;delete n.skills.music;}
 const loaded=sim.restore(JSON.stringify(g));assert.equal(loaded.version,21);assert.equal(loaded.skills.science,17);assert.equal(loaded.skills.music,0);assert.equal(loaded.player.age,28);
});
test('legacy saves gain NPC money and personal harvest inventory',()=>{
 const g=sim.createGame();for(const n of Object.values(g.npcs)){delete n.money;delete n.inventory;}
 const loaded=sim.restore(sim.serialize(g));assert.equal(loaded.npcs.nova.money,600);assert.deepEqual(loaded.npcs.nova.inventory,{spores:0,mushrooms:0});
});
