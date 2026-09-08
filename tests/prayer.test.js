import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,buyItem,enqueue,tick,serialize,restore,cancelAction,takeOver,ITEMS,skillProgress} from '../src/simulation.js';
import {resolvePrayer,PRAYER_MUTATIONS,validBlessing,isRadiant,prayerRaceName} from '../src/prayer.js';

test('radiance uses an independent ten-percent front roll and never rewards the back',()=>{
 for(const [side,roll,expected]of [['front',.0999,true],['front',.1,false],['back',0,false]]){
  const g=createGame();g.config.prayer.skillChance=g.config.prayer.netherChance=g.config.prayer.mutationChance=0;
  const result=resolvePrayer(g.player,g.skills,side,g.config.prayer,g.config.lifeStages,()=>roll);
  assert.equal(result.radiance,expected);assert.equal(g.player.prayer.radiance,expected?1:0);
 }
 const g=createGame();g.player.prayer.radiance=1e9;
 assert.equal(resolvePrayer(g.player,g.skills,'front',g.config.prayer,g.config.lifeStages,()=>0).radiance,false);
});

test('player and NPC dawn awakening persists without rerolling and coexists with nether',t=>{
 t.mock.method(Math,'random',()=>.5);
 for(const npc of [false,true]){
  const {g,tree}=setup(),person=npc?g.npcs.nova:g.player;
  person.side='front';person.x=0;person.z=5.6;person.prayer.radiance=9;person.prayer.nether=10;
  Object.assign(g.config.prayer,{skillChance:0,radianceChance:100});
  enqueue(g,'pray',tree.id);if(npc){person.queue=g.queue;g.queue=[];}
  advance(g,()=>(npc?person.queue:g.queue)[0]?.phase==='celebrating');
  const result=(npc?person.queue:g.queue)[0].blessing;
  assert.equal(result.radianceTransformed,true);assert.equal(validBlessing(result),true);
  assert.equal(isRadiant(person),true);assert.equal(prayerRaceName(person),'两仪族');
  assert.match(g.majorEvents[0].text,/淡金曦轮/);
  const loaded=restore(serialize(g)),resident=npc?loaded.npcs.nova:loaded.player;
  advance(loaded,()=>!(npc?resident.queue:loaded.queue).length);assert.equal(resident.prayer.radiance,10);
  const next=resolvePrayer(resident,npc?resident.skills:loaded.skills,'front',loaded.config.prayer,loaded.config.lifeStages,()=>.5);
  assert.equal(next.radiance,true);assert.equal(next.radianceTransformed,false);
 }
});

test('old saves gain zero radiance, while malformed radiance and wrong-side blessings are rejected',()=>{
 const g=createGame();for(const person of [g.player,...Object.values(g.npcs)])delete person.prayer.radiance;
 delete g.config.prayer.radianceChance;
 const loaded=restore(serialize(g));assert.equal(loaded.player.prayer.radiance,0);assert.equal(loaded.config.prayer.radianceChance,10);
 for(const value of [-1,.5,'10',null,1e9+1]){const invalid=structuredClone(loaded);invalid.player.prayer.radiance=value;assert.throws(()=>restore(serialize(invalid)));}
 const blessing={side:'front',skill:null,nether:false,mutation:null,transformed:false,radiance:true,radianceTransformed:true};
 assert.ok(validBlessing(blessing));assert.equal(validBlessing({...blessing,side:'back'}),false);
 assert.equal(validBlessing({...blessing,radiance:false}),false);
});

test('either awakening order converges into the dual race only once',()=>{
 for(const side of ['front','back']){
  const g=createGame();g.player.prayer.radiance=side==='front'?9:10;g.player.prayer.nether=side==='back'?9:10;
  assert.equal(prayerRaceName(g.player),side==='front'?'幽冥族':'曦灵族');
  const result=resolvePrayer(g.player,g.skills,side,g.config.prayer,g.config.lifeStages,()=>0);
  assert.equal(result.converged,true);assert.ok(validBlessing(result));assert.equal(prayerRaceName(g.player),'两仪族');
  assert.equal(resolvePrayer(g.player,g.skills,side,g.config.prayer,g.config.lifeStages,()=>0).converged,false);
  assert.equal(prayerRaceName(restore(serialize(g)).player),'两仪族');
 }
});

function setup(side='front'){
 const g=createGame();for(const n of Object.values(g.npcs))n.ai.enabled=false;
 for(const key of Object.keys(g.skills))g.skills[key]=0;
 g.viewSide=side;g.player.side=side;g.player.x=0;g.player.z=5.6;
 const tree=buyItem(g,'spiritTree',0,4).object;
 return {g,tree};
}
function advance(g,until){for(let i=0;i<500&&!until();i++)tick(g,.1);assert.ok(until());}

test('configured prayer percentages control actual player and NPC rewards independently',t=>{
 t.mock.method(Math,'random',()=>.5);
 for(const side of ['front','back'])for(const npc of [false,true]){
  const {g,tree}=setup(side),person=npc?g.npcs.nova:g.player;person.side=side;person.x=0;person.z=5.6;
  const skills=npc?person.skills:g.skills;
  for(const chances of [{skillChance:0,netherChance:0,mutationChance:0},{skillChance:100,netherChance:100,mutationChance:0},{skillChance:0,netherChance:0,mutationChance:100}]){
   g.config.prayer={...g.config.prayer,...chances};const beforeSkills={...skills},before=structuredClone(person.prayer);
   enqueue(g,'pray',tree.id);if(npc){person.queue=g.queue;g.queue=[];}
   advance(g,()=>!(npc?person.queue:g.queue).length);
   assert.equal(JSON.stringify(skills)!==JSON.stringify(beforeSkills),side==='front'&&chances.skillChance===100);
   assert.equal(person.prayer.nether-before.nether,side==='back'?chances.netherChance/100:0);
   assert.equal(person.prayer.mutations.length-before.mutations.length,side==='back'?chances.mutationChance/100:0);
  }
 }
});

test('prayer configuration persists, migrates older saves and rejects invalid percentages',()=>{
 const g=createGame();assert.deepEqual(g.config.prayer,{skillChance:10,radianceChance:10,netherChance:10,mutationChance:1,rejuvenationChance:.1,racialInheritanceRate:30,racialInheritanceStdDev:20,racialMutationInheritanceChance:5});
 g.config.prayer={skillChance:27.5,radianceChance:10,netherChance:0,mutationChance:100,rejuvenationChance:.2,racialInheritanceRate:42,racialInheritanceStdDev:13,racialMutationInheritanceChance:7};assert.deepEqual(restore(serialize(g)).config.prayer,g.config.prayer);
 for(const key of Object.keys(g.config.prayer))for(const value of [-1,100.1,'10',null]){
  const invalid=structuredClone(g);invalid.config.prayer[key]=value;assert.throws(()=>restore(serialize(invalid)));
 }
 delete g.config.prayer;assert.deepEqual(restore(serialize(g)).config.prayer,{skillChance:10,radianceChance:10,netherChance:10,mutationChance:1,rejuvenationChance:.1,racialInheritanceRate:30,racialInheritanceStdDev:20,racialMutationInheritanceChance:5});
});

test('tree offers prayer only and rejects prayer at other furniture',()=>{
 const {g,tree}=setup();assert.equal(ITEMS.find(i=>i.id==='spiritTree').action,'pray');
 assert.equal(enqueue(g,'pray','food').ok,false);
 assert.equal(enqueue(g,'admire',tree.id).ok,false);
 assert.equal(enqueue(g,'pray',tree.id).ok,true);
});

test('elder front prayer rejuvenates to configured childhood and survives a saved celebration',t=>{
 t.mock.method(Math,'random',()=>.5);
 for(const npc of [false,true]){
  const {g,tree}=setup(),person=npc?g.npcs.nova:g.player;person.age=75;person.x=0;person.z=5.6;
  g.config.lifeStages.infantEnd=5;g.config.prayer.skillChance=0;g.config.prayer.rejuvenationChance=100;
  person.prayer={nether:12,mutations:['freckles']};person.mutations=['身高变异'];
  const skills=structuredClone(npc?person.skills:g.skills),genome={...person.genome},relationships=structuredClone(g.relationships);
  enqueue(g,'pray',tree.id);if(npc){person.queue=g.queue;g.queue=[];}
  advance(g,()=>(npc?person.queue:g.queue)[0]?.phase==='celebrating');
  assert.equal(person.age,5);assert.equal((npc?person.queue:g.queue)[0].blessing.rejuvenated,true);
  assert.deepEqual(npc?person.skills:g.skills,skills);assert.deepEqual(person.genome,genome);assert.deepEqual(person.prayer,{nether:12,mutations:['freckles']});assert.deepEqual(g.relationships,relationships);
  assert.match(g.majorEvents[0].text,/返老还童/);
  const loaded=restore(serialize(g)),young=npc?loaded.npcs.nova:loaded.player;loaded.speed=0;tick(loaded,20);assert.equal(young.age,5);
  young.age=6;loaded.speed=1;advance(loaded,()=>!(npc?young.queue:loaded.queue).length);assert.ok(young.age>=6&&young.age<6.01,'saved celebration must not award rejuvenation again');
 }
});

test('rejuvenation uses its configured boundary and only living elders on the front are eligible',()=>{
 for(const [side,age,alive,roll,success]of [['front',60,true,.0009,true],['front',60,true,.001,false],['front',59,true,0,false],['front',60,false,0,false],['back',60,true,0,false]]){
  const {g}=setup(side);g.player.age=age;g.player.alive=alive;g.config.prayer.skillChance=0;
  const result=resolvePrayer(g.player,g.skills,side,g.config.prayer,g.config.lifeStages,()=>roll);
  assert.equal(!!result.rejuvenated,success);assert.equal(g.player.age,success?g.config.lifeStages.infantEnd:age);
 }
 const {g}=setup();g.player.age=55;g.config.lifeStages.adultEnd=50;g.config.prayer.skillChance=g.config.prayer.rejuvenationChance=100;
 const result=resolvePrayer(g.player,g.skills,'front',g.config.prayer,g.config.lifeStages,()=>0);
 assert.ok(result.skill&&result.rejuvenated,'both front rewards can happen together');
});

test('blessing validation accepts old rewards and rejuvenation but rejects invalid or back rejuvenation',()=>{
 const old={side:'front',skill:'science',nether:false,mutation:null,transformed:false};assert.equal(validBlessing(old),true);
 const young={...old,skill:null,rejuvenated:true};assert.equal(validBlessing(young),true);
 for(const result of [{...young,rejuvenated:'true'},{...young,side:'back'},{...young,rejuvenated:false}])assert.equal(validBlessing(result),false);
 const g=createGame();delete g.config.prayer.rejuvenationChance;assert.equal(restore(serialize(g)).config.prayer.rejuvenationChance,.1);
});

test('front blessing raises one non-maxed skill by one level and does not reroll during saved celebration',t=>{
 t.mock.method(Math,'random',()=>0);
 const {g,tree}=setup();g.skills.cooking=135;
 enqueue(g,'pray',tree.id);advance(g,()=>g.queue[0]?.phase==='celebrating');
 assert.equal(skillProgress(g.skills.science).level,2);assert.equal(g.skills.cooking,135);
 assert.equal(Object.values(g.skills).filter(v=>v>0).length,2);assert.equal(g.player.prayer.nether,0);
 const saved=restore(serialize(g)),skills={...saved.skills};saved.speed=0;tick(saved,20);assert.equal(saved.queue[0].elapsed,0);
 saved.speed=1;advance(saved,()=>saved.queue.length===0);assert.deepEqual(saved.skills,skills);
});

test('back rolls nether and mutation independently, transforms at threshold, and stacks distinct mutations',t=>{
 let rolls=[0,.9];t.mock.method(Math,'random',()=>rolls.shift()??.9);
 const {g,tree}=setup('back');g.player.prayer.nether=9;
 enqueue(g,'pray',tree.id);advance(g,()=>g.queue[0]?.phase==='celebrating');
 assert.equal(g.player.prayer.nether,10);assert.equal(g.queue[0].blessing.transformed,true);assert.deepEqual(g.player.prayer.mutations,[]);
 advance(g,()=>!g.queue.length);
 for(let i=0;i<2;i++){
  rolls=[.9,0,0];enqueue(g,'pray',tree.id);advance(g,()=>g.queue[0]?.phase==='celebrating');
  assert.equal(g.player.prayer.nether,10);assert.equal(g.player.prayer.mutations.length,i+1);
  advance(g,()=>!g.queue.length);
 }
 assert.equal(new Set(g.player.prayer.mutations).size,2);
 assert.deepEqual(restore(serialize(g)).player.prayer,g.player.prayer);
 assert.ok(Object.values(g.skills).every(v=>v===0));
});

test('cancelled, paused and unsuccessful prayers do not grant rewards',t=>{
 t.mock.method(Math,'random',()=>.9);const {g,tree}=setup('back');
 enqueue(g,'pray',tree.id);advance(g,()=>g.queue[0]?.phase==='acting');
 g.speed=0;tick(g,100);assert.equal(g.player.prayer.nether,0);assert.deepEqual(g.player.prayer.mutations,[]);
 cancelAction(g,g.queue[0].id);g.speed=1;tick(g,20);assert.equal(g.player.prayer.nether,0);
 enqueue(g,'pray',tree.id);advance(g,()=>!g.queue.length);assert.equal(g.player.prayer.nether,0);assert.deepEqual(g.player.prayer.mutations,[]);
});

test('prayer outcome follows the placed tree despite viewing the other island face',t=>{
 t.mock.method(Math,'random',()=>0);const {g,tree}=setup('back');g.viewSide='front';
 enqueue(g,'pray',tree.id);advance(g,()=>g.queue[0]?.phase==='celebrating');
 assert.equal(g.player.prayer.nether,1);assert.equal(g.queue[0].blessing.side,'back');assert.ok(Object.values(g.skills).every(v=>v===0));
});

test('version 9 gains independent prayer state and version 10 rejects corrupt prayer data',()=>{
 const {g,tree}=setup();g.version=9;for(const p of [g.player,...Object.values(g.npcs)])delete p.prayer;
 const loaded=restore(serialize(g));assert.equal(loaded.version,10);assert.deepEqual(loaded.player.prayer,{radiance:0,nether:0,mutations:[]});
 assert.equal(loaded.money,g.money);assert.ok(loaded.objects.some(o=>o.id===tree.id));
 for(const prayer of [undefined,{nether:-1,mutations:[]},{nether:1.5,mutations:[]},{nether:0,mutations:['unknown']},{nether:0,mutations:['crown','crown']}]){
  const invalid=structuredClone(loaded);invalid.player.prayer=prayer;assert.throws(()=>restore(serialize(invalid)));
 }
});

test('probability boundaries distinguish a ten-percent blessing from a one-percent mutation',()=>{
 for(const [roll,success]of [[.0999,true],[.1,false]]){
  const {g}=setup();const rolls=[roll,0],result=resolvePrayer(g.player,g.skills,'front',g.config.prayer,g.config.lifeStages,()=>rolls.shift());
  assert.equal(result.skill!==null,success);
 }
 for(const [roll,success]of [[.0099,true],[.01,false]]){
  const {g}=setup('back'),rolls=[.9,roll,0],result=resolvePrayer(g.player,g.skills,'back',g.config.prayer,g.config.lifeStages,()=>rolls.shift());
  assert.equal(result.nether,false);assert.equal(result.mutation!==null,success);
 }
 const {g}=setup();for(const key in g.skills)g.skills[key]=135;
 assert.equal(resolvePrayer(g.player,g.skills,'front',g.config.prayer,g.config.lifeStages,()=>0).skill,null);assert.ok(Object.values(g.skills).every(v=>v===135));
});

test('all prayer mutations coexist without replacing inherited mutations or duplicating an exhausted pool',()=>{
 const {g}=setup('back');g.player.mutations=['身高变异'];g.player.genome.stature=1.12;
 for(let i=0;i<10;i++)resolvePrayer(g.player,g.skills,'back',g.config.prayer,g.config.lifeStages,()=>0);
 assert.deepEqual(new Set(g.player.prayer.mutations),new Set(Object.keys(PRAYER_MUTATIONS)));
 assert.deepEqual(g.player.mutations,['身高变异']);assert.equal(g.player.genome.stature,1.12);
});

test('NPC prayer rewards belong to that resident and survive becoming the player',t=>{
 t.mock.method(Math,'random',()=>0);const {g,tree}=setup('back'),npc=g.npcs.nova;
 npc.side='back';npc.x=0;npc.z=5.6;npc.prayer.nether=9;
 enqueue(g,'pray',tree.id);npc.queue=g.queue;g.queue=[];
 advance(g,()=>npc.queue[0]?.phase==='celebrating');assert.equal(npc.prayer.nether,10);assert.equal(npc.prayer.mutations.length,1);
 assert.equal(g.player.prayer.nether,0);assert.deepEqual(g.player.prayer.mutations,[]);
 advance(g,()=>!npc.queue.length);const prayer=structuredClone(npc.prayer);g.player.alive=false;
 assert.equal(takeOver(g,'nova').ok,true);assert.deepEqual(restore(serialize(g)).player.prayer,prayer);
});

test('legacy admire at the tree migrates to an unfinished prayer without giving a free blessing',()=>{
 const {g,tree}=setup();enqueue(g,'pray',tree.id);g.version=9;g.queue[0].type='admire';g.queue[0].phase='acting';g.queue[0].elapsed=7;
 const loaded=restore(serialize(g));assert.equal(loaded.queue[0].type,'pray');assert.equal(loaded.queue[0].elapsed,0);assert.equal(loaded.queue[0].phase,'walking');assert.equal(loaded.player.prayer.nether,0);
});
