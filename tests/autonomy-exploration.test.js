import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,buyItem,enqueue,tick,restore,serialize,ACTIONS,autonomousCandidates} from '../src/simulation.js';
const run=(g,n)=>{for(let i=0;i<n*10;i++)tick(g,.1,()=>0);};
function setup(){const g=createGame();g.objects=[];g.autonomy.enabled=false;for(const n of Object.values(g.npcs))n.ai.enabled=false;g.config.needDecay=Object.fromEntries(Object.keys(g.needs).map(k=>[k,0]));return g;}
test('all object interactions can enter autonomous candidate generation, including paired invitations and expedition',()=>{
 const g=setup();buyItem(g,'lamp',0,0);buyItem(g,'relic',3,0).object.wonder.chapter=1;buyItem(g,'portal',6,0);const types=autonomousCandidates(g,'player').map(c=>c.type);
 for(const type of ['chaseOrb','passOrb','sootheOrb','decodeTogether','memoryExpedition'])assert.ok(types.includes(type),type);assert.ok(Object.values(ACTIONS).every(a=>!a.manualOnly));
});
test('AI invites a busy partner and keeps the shared action queued',()=>{
 const g=setup(),o=buyItem(g,'lamp',0,0).object;g.player.preferences={passOrb:100};g.autonomy.enabled=true;g.needs.fun=20;g.needs.social=10;
 g.npcs.nova.queue=[{id:g.nextId++,type:'walk',targetId:null,target:{x:8,z:4,side:'front'},source:'manual',phase:'walking',elapsed:0,path:null}];
 run(g,.1);assert.equal(g.queue[0].type,'passOrb');assert.ok(Object.values(g.npcs).some(n=>n.queue.some(q=>q.hostActionId===g.queue[0].id)));
});
test('crystal switches for free at any charge, resets it, then uses dust only when activated',()=>{
 const g=setup(),o=buyItem(g,'crystal',0,0).object;o.wonder.charge=72;g.wonders.dust=0;
 assert.equal(enqueue(g,'tuneInsight',o.id).ok,true);run(g,18);assert.equal(o.wonder.mode,'insight');assert.ok(o.wonder.charge<10);assert.equal(g.wonders.dust,0);assert.equal(o.wonder.armed,false);
 o.wonder.charge=100;g.wonders.dust=1;assert.equal(enqueue(g,'activateCrystal',o.id).ok,true);run(g,20);assert.equal(o.wonder.armed,true);assert.equal(g.wonders.dust,0);
 assert.equal(enqueue(g,'tuneSleep',o.id).ok,true);run(g,20);assert.equal(o.wonder.mode,'sleep');assert.equal(o.wonder.armed,false);assert.ok(o.wonder.charge<10);
});
test('discovery totals and distinct city records persist independently of furniture',()=>{
 const g=setup(),o=buyItem(g,'portal',0,0).object;g.wonders.archive=3;g.player.island=o.island='city';
 enqueue(g,'memoryExpedition',o.id);run(g,40);assert.equal(g.wonders.expeditions,1);assert.equal(g.wonders.cityRecords.length,1);assert.equal(restore(serialize(g)).wonders.expeditions,1);
});
test('an unlocked civilization expedition can be selected autonomously and persists its rewards',()=>{
 const g=setup();buyItem(g,'portal',0,0).object.island='city';g.player.island='city';g.wonders.archive=3;g.player.preferences={memoryExpedition:100};g.autonomy.enabled=true;run(g,.1);assert.equal(g.queue[0].type,'memoryExpedition');g.autonomy.enabled=false;run(g,40);assert.equal(g.wonders.expeditions,1);assert.equal(g.wonders.dust,2);
});
test('scientific skill and inherited research preference increase cooperative research weight',async()=>{
 const {actionPreference,autonomyBonus}=await import('../src/autonomy.js');const g=setup(),o=buyItem(g,'relic',0,0).object;
 const p={id:'player',position:g.player,skills:g.skills,needs:g.needs},partner={id:'nova',position:g.npcs.nova,needs:g.npcs.nova.needs,queue:[]},c={type:'decodeTogether',targetId:o.id,partnerId:'nova'};
 p.position.preferences={research:30};const low=autonomyBonus(g,p,c,[p,partner]);p.skills.science=30;assert.ok(autonomyBonus(g,p,c,[p,partner])>low);assert.equal(actionPreference(p,'decodeTogether'),19.5);
});
test('v11 exploration migration preserves archive and crystals without inventing past city visits',()=>{
 const g=setup(),o=buyItem(g,'crystal',0,0).object;g.version=11;g.wonders={dust:7,archive:3,lastExpeditionDay:1};o.wonder={mode:'insight',charge:100,armed:true};const loaded=restore(serialize(g));assert.equal(loaded.version,13);assert.equal(loaded.wonders.archive,3);assert.equal(loaded.wonders.dust,7);assert.equal(loaded.wonders.expeditions,0);assert.equal(loaded.objects[0].wonder.armed,true);
});
test('an NPC can autonomously invite the controlled resident without replacing their queue',()=>{
 const g=setup();buyItem(g,'lamp',0,0);g.npcs.nova.preferences={passOrb:100};g.npcs.nova.ai.enabled=true;g.npcs.nova.needs.fun=20;g.npcs.nova.needs.social=10;
 run(g,.1);const host=g.npcs.nova.queue[0];assert.equal(host.type,'passOrb');assert.equal(host.partnerId,'player');assert.equal(g.queue[0].hostActionId,host.id);g.npcs.nova.ai.enabled=false;run(g,45);assert.equal(g.relationships.nova,33);assert.doesNotThrow(()=>restore(serialize(g)));
});
test('autonomous sofa invitations preserve an invited residents earlier action',()=>{
 const g=setup(),sofa=buyItem(g,'sofa',0,0).object,pod=buyItem(g,'pod',4,0).object;g.player.preferences={lounge:100};g.autonomy.enabled=true;g.npcs.nova.queue=[{id:g.nextId++,type:'sleep',targetId:pod.id,target:{x:4,z:1,side:'front'},source:'manual',phase:'acting',elapsed:0,path:[]}];
 run(g,2);assert.equal(g.queue[0].type,'lounge');assert.equal(g.npcs.nova.queue[0].type,'sleep');assert.equal(g.npcs.nova.queue[1].type,'lounge');g.autonomy.enabled=false;run(g,65);assert.ok(g.relationships.nova>15);assert.doesNotThrow(()=>restore(serialize(g)));
});
