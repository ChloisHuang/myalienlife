import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,buyItem,enqueue,tick,serialize,restore,ACTIONS,ITEMS,cancelAction,switchControl} from '../src/simulation.js';

function setup(type){const g=createGame();g.autonomy.enabled=false;for(const n of Object.values(g.npcs))n.ai.enabled=false;g.config.needDecay=Object.fromEntries(Object.keys(g.needs).map(k=>[k,0]));g.objects=[];g.player.x=0;g.player.z=2;const result=buyItem(g,type,0,0);assert.equal(result.ok,true);return {g,o:result.object};}
function run(g,seconds=45){for(let i=0;i<seconds*10;i++)tick(g,.1,()=>.5);}
function perform(g,type,o,partner=null){const result=enqueue(g,type,o.id,undefined,partner);assert.equal(result.ok,true,result.message);run(g);assert.equal(g.queue.length,0);}
function busyNeighbor(g){const pod=buyItem(g,'pod',4,0).object;g.npcs.nova.queue.push({id:g.nextId++,type:'sleep',targetId:pod.id,target:{x:4,z:1,side:'front'},source:'ai',phase:'acting',elapsed:0,path:[]});g.config.actionDurations.sleep=35;return g.npcs.nova.queue[0];}

test('invitation immediately queues behind a busy neighbor and waits without granting early rewards',()=>{
 const {g,o}=setup('lamp'),prior=busyNeighbor(g),relation=g.relationships.nova;
 assert.equal(enqueue(g,'passOrb',o.id,undefined,'nova').ok,true);assert.equal(g.npcs.nova.queue.length,2);assert.equal(g.npcs.nova.queue[0],prior);
 run(g,20);assert.equal(g.queue[0].phase,'waiting');assert.equal(g.queue[0].elapsed,0);assert.equal(g.npcs.nova.queue[0].type,'sleep');assert.equal(g.relationships.nova,relation);
 const loaded=restore(serialize(g));run(loaded,55);assert.equal(loaded.relationships.nova,relation+18);assert.equal(loaded.queue.length,0);assert.equal(loaded.npcs.nova.queue.length,0);
});
test('canceling a queued invitation removes only its counterpart, preserving the neighbors work',()=>{
 const {g,o}=setup('lamp'),prior=busyNeighbor(g);enqueue(g,'passOrb',o.id,undefined,'nova');cancelAction(g,g.queue[0].id);
 assert.deepEqual(g.npcs.nova.queue,[prior]);assert.equal(g.relationships.nova,15);
});
test('guests wait for the matching host action when the host has earlier work queued',()=>{
 const {g,o}=setup('lamp'),lab=buyItem(g,'lab',4,0).object;g.config.actionDurations.research=40;enqueue(g,'research',lab.id);assert.equal(enqueue(g,'passOrb',o.id,undefined,'nova').ok,true);
 assert.equal(g.npcs.nova.queue.length,1);run(g,20);assert.equal(g.npcs.nova.queue[0].phase,'waiting');assert.equal(g.npcs.nova.queue[0].elapsed,0);assert.equal(g.relationships.nova,15);run(g,65);assert.equal(g.relationships.nova,33);
});
test('a full neighbor queue rejects atomically and cannot create an unsavable seventh action',()=>{
 const {g,o}=setup('lamp'),prior=busyNeighbor(g);for(let i=0;i<5;i++)g.npcs.nova.queue.push({...prior,id:g.nextId++});const snapshot=serialize(g);const result=enqueue(g,'passOrb',o.id,undefined,'nova');assert.equal(result.ok,false);assert.match(result.message,/队列已满/);assert.equal(serialize(g),snapshot);
});
test('switching control to the invited resident keeps the invitation linked and cancellable',()=>{
 const {g,o}=setup('lamp');enqueue(g,'passOrb',o.id,undefined,'nova');assert.equal(switchControl(g,'nova').ok,true);const invitation=g.queue.find(q=>q.hostActionId);assert.ok(invitation);cancelAction(g,invitation.id);run(g,1);assert.equal(Object.values(g.npcs).some(n=>n.queue.some(q=>q.type==='passOrb')),false);
});
test('switching control during a queued invitation still completes exactly once',()=>{
 const {g,o}=setup('lamp');busyNeighbor(g);enqueue(g,'passOrb',o.id,undefined,'nova');switchControl(g,'nova');const loaded=restore(serialize(g));run(loaded,90);assert.equal(loaded.relationships.kai,33);assert.equal(loaded.queue.length,0);assert.equal(loaded.npcs.kai.queue.length,0);
});
test('a guest finishing solo play can honor the queued invitation after the orb cooldown',()=>{
 const {g,o}=setup('lamp');g.npcs.nova.queue.push({id:g.nextId++,type:'chaseOrb',targetId:o.id,target:{x:0,z:1.25,side:'front'},source:'ai',phase:'acting',elapsed:0,path:[]});
 assert.equal(enqueue(g,'passOrb',o.id,undefined,'nova').ok,true);run(g,40);assert.equal(g.queue[0]?.phase,'waiting');assert.equal(g.relationships.nova,15);run(g,75);assert.equal(g.relationships.nova,33);
});
test('a conversation ahead of an invitation does not erase the guests queued participation',()=>{
 const {g,o}=setup('lamp');enqueue(g,'chat','nova');enqueue(g,'passOrb',o.id,undefined,'nova');run(g,65);assert.equal(g.relationships.nova,48);assert.equal(g.queue.length,0);assert.equal(g.npcs.nova.queue.length,0);
});

test('five objects have distinct interactions and obsolete admire is unavailable',()=>{
 assert.equal(ACTIONS.admire,undefined);for(const type of ['polelight','glowlight','relic','crystal','lamp'])assert.notEqual(ITEMS.find(i=>i.id===type).action,'admire');
 const {g,o}=setup('lamp');assert.equal(enqueue(g,'admire',o.id).ok,false);assert.equal(enqueue(g,'tuneSleep',o.id).ok,false);
});
test('growth light heals plants only in range on the same face and mode persists',()=>{
 const {g,o}=setup('polelight');const plant={growth:.2,water:70,health:40,harvests:0,giant:false};
 for(const [id,x,side] of [['near',2,'front'],['far',10,'front'],['back',2,'back']])g.objects.push({id,type:'garden',x,z:0,side,rotation:0,plant:{...plant}});
 perform(g,'lightGrow',o);assert.equal(o.wonder.mode,'grow');const before=g.objects.map(x=>x.plant?.health);run(g,60);
 assert.ok(g.objects[1].plant.health>before[1]);assert.equal(g.objects[2].plant.health,before[2]);assert.equal(g.objects[3].plant.health,before[3]);assert.equal(restore(serialize(g)).objects[0].wonder.mode,'grow');
});
test('night insects produce limited dust, cannot be harvested twice, charge supports one study',()=>{
 const {g,o}=setup('glowlight');run(g,100);assert.equal(o.wonder.bugs,0);g.minute=1200;run(g,100);assert.ok(o.wonder.bugs>=1);
 perform(g,'catchBugs',o);assert.ok(g.wonders.dust>0);assert.equal(enqueue(g,'catchBugs',o.id).ok,false);
 const crystal=buyItem(g,'crystal',3,0).object;crystal.wonder.charge=100;perform(g,'tuneInsight',crystal);crystal.wonder.charge=100;perform(g,'activateCrystal',crystal);assert.equal(crystal.wonder.armed,true);
 const lab=buyItem(g,'lab',5,0).object;const skill=g.skills.science;perform(g,'research',lab);assert.equal(g.skills.science,skill+2);assert.equal(crystal.wonder.armed,false);assert.ok(crystal.wonder.charge<100);
});
test('relic progresses in chapters with cooldown, unlocks a bounded expedition',()=>{
 const {g,o}=setup('relic');perform(g,'traceRelic',o);assert.equal(o.wonder.chapter,1);assert.equal(enqueue(g,'decodeRelic',o.id).ok,false);
 o.wonder.nextStudy=0;perform(g,'decodeRelic',o);o.wonder.nextStudy=0;g.skills.science=9;perform(g,'restoreMemory',o);assert.equal(g.wonders.archive,3);assert.equal(enqueue(g,'traceRelic',o.id).ok,false);
 const portal=buyItem(g,'portal',3,0).object;assert.equal(enqueue(g,'memoryExpedition',portal.id).ok,false);g.civilization.technology=120;g.skills.science=18;g.space.ships.push({id:'fixture-ufo',tier:3,island:'home',side:'front',food:2,reservedBy:null});g.skills.science=12;g.player.preferences.research=10;assert.equal(enqueue(g,'voyage',portal.id,undefined,null,'city').ok,true);run(g);const money=g.money;const cityPortal=g.objects.find(o=>o.id==='city-portal');perform(g,'memoryExpedition',cityPortal);assert.ok(g.money>money);assert.equal(enqueue(g,'memoryExpedition',portal.id).ok,false);
});
test('paired orb action requires a partner and cancellation cannot leave a guest stuck',()=>{
 const {g,o}=setup('lamp');assert.equal(enqueue(g,'passOrb',o.id).ok,false);const relation=g.relationships.nova;
 perform(g,'passOrb',o,'nova');assert.ok(g.relationships.nova>relation);assert.equal(g.npcs.nova.queue.length,0);
 o.wonder.cooldown=0;assert.equal(enqueue(g,'passOrb',o.id,undefined,'nova').ok,true);run(g,2);cancelAction(g,g.queue[0].id);run(g,1);assert.equal(g.npcs.nova.queue.length,0);
});
test('v10 migration removes legacy admire from queues, preferences and config without losing furniture',()=>{
 const {g,o}=setup('lamp');g.version=10;delete g.wonders;delete o.wonder;g.player.preferences.admire=10;g.autonomy.lastAction='admire';g.config.actionDurations.admire=8;
 g.queue=[{id:g.nextId++,type:'admire',targetId:o.id,target:{x:0,z:1,side:'front'},phase:'acting',source:'manual',elapsed:3,path:null}];
 const loaded=restore(serialize(g));assert.equal(loaded.version,18);assert.equal(loaded.objects[0].id,o.id);assert.equal(loaded.queue.length,0);assert.equal(loaded.autonomy.lastAction,null);assert.equal(loaded.player.preferences.admire,undefined);assert.equal(loaded.config.actionDurations.admire,undefined);assert.deepEqual(restore(serialize(loaded)),loaded);
 loaded.objects[0].wonder.cooldown=-1;assert.throws(()=>restore(serialize(loaded)));
});
test('insect release benefits only nearby same-face residents and consumes the captured swarm',()=>{
 const {g,o}=setup('glowlight');o.wonder.bugs=3;g.npcs.nova.x=2;g.npcs.nova.z=0;g.npcs.nova.needs.fun=10;g.npcs.zig.side='back';g.npcs.zig.needs.fun=10;
 perform(g,'releaseBugs',o);assert.equal(g.wonders.dust,0);assert.equal(g.npcs.nova.needs.fun,30);assert.equal(g.npcs.zig.needs.fun,10);assert.equal(o.wonder.bugs,0);assert.ok(o.wonder.showUntil>0);
});
test('crystal charge and insect accumulation stop while paused, and night integration crosses dawn',()=>{
 const {g,o}=setup('glowlight');g.minute=350;tick(g,10);assert.ok(Math.abs(o.wonder.bugs-10/180)<1e-9);g.speed=0;const snapshot=serialize(g);tick(g,500);assert.equal(serialize(g),snapshot);
});
test('shared dust is rechecked on completion so two queued tunings cannot spend one unit twice',()=>{
 const {g,o}=setup('crystal');const second=buyItem(g,'crystal',3,0).object;o.wonder.charge=second.wonder.charge=100;g.wonders.dust=1;
 assert.equal(enqueue(g,'activateCrystal',o.id).ok,true);assert.equal(enqueue(g,'activateCrystal',second.id).ok,true);run(g,65);
 assert.equal(g.wonders.dust,0);assert.equal(o.wonder.armed,true);assert.equal(second.wonder.armed,false);assert.equal(g.queue.length,0);
});
test('paired activity round-trips while guests are acting and both complete once',()=>{
 const {g,o}=setup('relic');o.wonder.chapter=1;assert.equal(enqueue(g,'decodeTogether',o.id,undefined,'nova').ok,true);run(g,5);
 const loaded=restore(serialize(g)),skill=loaded.skills.science;run(loaded,40);
 assert.equal(loaded.objects[0].wonder.chapter,2);assert.equal(loaded.objects[0].wonder.coauthored,true);assert.equal(loaded.skills.science,skill+1);assert.equal(loaded.npcs.nova.skills.science,1);assert.equal(loaded.npcs.nova.queue.length,0);
});
test('paired guests approach the opposite side and cannot join through a blocked standing spot',()=>{
 const {g,o}=setup('lamp');assert.equal(enqueue(g,'passOrb',o.id,undefined,'nova').ok,true);run(g,5);
 assert.ok(Math.hypot(g.player.x-g.npcs.nova.x,g.player.z-g.npcs.nova.z)>2);
 const next=setup('lamp');next.g.objects.push({id:'blocked',type:'food',x:0,z:-1.15,side:'front',rotation:0});assert.equal(enqueue(next.g,'passOrb',next.o.id,undefined,'nova').ok,true);run(next.g,3);assert.equal(next.g.queue.length,0);assert.equal(next.g.npcs.nova.queue.length,0);
});
test('orb accompaniment entertains an infant without feeding them or affecting a distant infant',()=>{
 const {g,o}=setup('lamp');Object.assign(g.npcs.nova,{age:0,x:1,z:0});Object.assign(g.npcs.zig,{age:0,x:9,z:0});for(const n of [g.npcs.nova,g.npcs.zig])Object.assign(n.needs,{hunger:30,fun:10,social:10});
 perform(g,'sootheOrb',o);assert.equal(g.npcs.nova.needs.fun,40);assert.equal(g.npcs.nova.needs.hunger,30);assert.equal(g.npcs.zig.needs.fun,10);
});
test('AI chooses the currently available relic chapter and never repeats completed lore',()=>{
 const {g,o}=setup('relic');g.autonomy.enabled=true;g.npcs={};g.relationships={};o.wonder.chapter=1;for(const key of Object.keys(g.needs))g.needs[key]=100;
 run(g,1);assert.equal(g.queue[0]?.type,'decodeRelic');run(g,40);assert.equal(o.wonder.chapter,2);assert.equal(g.queue.length,0);
});
