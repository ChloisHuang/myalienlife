import {createWonder} from '../src/wonders.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';

const run=(g,seconds,random=()=>0)=>{for(let i=0;i<seconds*10;i++)sim.tick(g,.1,random);};
const healthy=()=>({hunger:90,energy:90,social:90,fun:90,hygiene:90,comfort:90});

test('a hungry NPC chooses available food and restores its own hunger without spending player funds',()=>{
 const g=sim.createGame(),n=g.npcs.nova;n.needs={...healthy(),hunger:10};const money=g.money,personalMoney=n.money;
 run(g,1);assert.equal(n.queue[0]?.type,'eat');assert.match(n.ai.reason,/营养/);
 run(g,20);assert.ok(n.needs.hunger>60);assert.equal(g.money,money);assert.equal(n.money,personalMoney-10);
});
test('a minor splits meal costs equally between two living parents',()=>{
 const g=sim.createGame(),n=g.npcs.pip,a=g.npcs.nova,b=g.npcs.lumi;n.parents=[{uid:a.uid,name:a.name},{uid:b.uid,name:b.name}];n.money=10;n.needs={...healthy(),hunger:10};a.money=100;b.money=100;for(const other of Object.values(g.npcs))other.ai.enabled=other===n;
 run(g,20);assert.ok(n.needs.hunger>60);assert.equal(n.money,10);assert.equal(a.money,95);assert.equal(b.money,95);
});
test('a minor charges the full meal cost to its only living parent',()=>{
 const g=sim.createGame(),n=g.npcs.pip,parent=g.npcs.nova;n.parents=[{uid:parent.uid,name:parent.name}];n.money=10;n.needs={...healthy(),hunger:10};parent.money=100;for(const other of Object.values(g.npcs))other.ai.enabled=other===n;
 run(g,20);assert.ok(n.needs.hunger>60);assert.equal(n.money,10);assert.equal(parent.money,90);
});
test('an NPC without meal money removes eating from its autonomous choices',()=>{
 const g=sim.createGame(),n=g.npcs.nova;n.money=9;n.needs={...healthy(),hunger:10};run(g,1);
 assert.notEqual(n.queue[0]?.type,'eat');assert.notEqual(n.queue[0]?.targetId,'food');
});
test('a working NPC earns personal wages without changing player funds',()=>{
 const g=sim.createGame(),n=g.npcs.zig;sim.setAutonomy(g,false);Object.assign(n.needs,healthy());Object.assign(n.skills,sim.CAREERS.scientist.levels[0].skills);n.money=0;const householdMoney=g.money;
 run(g,1);assert.equal(n.queue[0]?.type,'work');
 run(g,40);assert.ok(n.money>0);assert.equal(g.money,householdMoney);
});
test('an autonomous NPC trains before taking a career whose entry skills are missing',()=>{
 const g=sim.createGame(),n=g.npcs.zig;sim.setAutonomy(g,false);Object.assign(n.needs,healthy());n.money=0;n.skills.science=0;
 run(g,1);assert.notEqual(n.queue[0]?.type,'work');
 n.queue=[];n.ai.cooldown=0;n.skills.science=sim.CAREERS.scientist.levels[0].skills.science;run(g,1);
 assert.equal(n.queue[0]?.type,'work');
});
test('urgent needs override a characters hobby preference',()=>{
 const g=sim.createGame();g.npcs.pip.needs={...healthy(),energy:5,fun:20};
 run(g,1);assert.equal(g.npcs.pip.queue[0]?.type,'sleep');
});
test('equal needs lead to different hobbies for botanist and musician',()=>{
 for(const [id,expected] of [['nova','garden'],['pip','dance']]){const g=sim.createGame();g.autonomy.enabled=false;for(const [key,n] of Object.entries(g.npcs)){n.needs=healthy();n.ai.enabled=key===id;}run(g,1);assert.equal(g.npcs[id].queue[0]?.type,expected);}
});
test('autonomous choices give lower-benefit actions a chance instead of always taking the top score',()=>{
 const selected=new Set();
 for(let i=0;i<100;i++){
  const g=sim.createGame();g.objects=g.objects.filter(o=>o.type==='gate');
  g.objects.push({id:'tree',type:'spiritTree',x:0,z:4,rotation:0,side:'front'},{id:'sofa-test',type:'sofa',x:0,z:2,rotation:0,side:'front'});
  g.npcs.nova.needs={hunger:100,energy:100,social:100,fun:20,hygiene:100,comfort:20};
  sim.tick(g,.1,()=>i/100);selected.add(g.npcs.nova.queue[0]?.type);
 }
 assert.ok(selected.has('relax'));assert.ok(selected.has('pray'));
});
test('AI reserves furniture and does not choose absent or unreachable food',()=>{
 const g=sim.createGame();g.npcs.nova.needs={...healthy(),hunger:5};g.npcs.zig.needs={...healthy(),hunger:5};run(g,1);
 assert.equal(Object.values(g.npcs).filter(n=>n.queue[0]?.targetId==='food').length,1);
 const h=sim.createGame();h.objects=h.objects.filter(o=>o.type!=='food');h.npcs.nova.needs={...healthy(),hunger:5};run(h,1);assert.notEqual(h.npcs.nova.queue[0]?.type,'eat');
 const k=sim.createGame();k.npcs.nova.needs={...healthy(),hunger:5};k.objects.push({id:'block',type:'crystal',wonder:createWonder('crystal'),x:1,z:-3,rotation:0});run(k,1);assert.notEqual(k.npcs.nova.queue[0]?.type,'eat');
});
test('player AI is enabled by default, can be disabled, and can be re-enabled',()=>{
 const g=sim.createGame();g.needs={...healthy(),hunger:5};assert.equal(g.autonomy.enabled,true);run(g,.1);assert.equal(g.queue[0]?.type,'eat');assert.equal(g.queue[0].source,'ai');
 assert.equal(typeof sim.setAutonomy,'function');sim.setAutonomy(g,false);assert.equal(g.queue.length,0);run(g,5);assert.equal(g.queue.length,0);
 sim.setAutonomy(g,true);run(g,.1);assert.equal(g.queue[0]?.type,'eat');assert.equal(g.queue[0].source,'ai');
});
test('manual orders interrupt autonomous actions and AI does not interrupt queued manual orders',()=>{
 const g=sim.createGame();assert.equal(typeof sim.setAutonomy,'function');sim.setAutonomy(g,true);g.needs={...healthy(),energy:5};run(g,.1);assert.equal(g.queue[0]?.type,'sleep');
 sim.enqueue(g,'walk',null,{x:0,z:5});sim.enqueue(g,'chat','nova');assert.deepEqual(g.queue.map(q=>q.source),['manual','manual']);
 run(g,.1);assert.equal(g.queue[0].type,'walk');sim.setAutonomy(g,false);assert.equal(g.queue.length,2);
});
test('NPCs can socialize with each other and recover social needs on both sides',()=>{
 const g=sim.createGame();const n=g.npcs.lumi;n.needs={...healthy(),social:5};run(g,.1);assert.equal(n.queue[0]?.type,'chat');
 const target=g.npcs[n.queue[0].targetId],targetBefore=target.needs.social;run(g,20);
 assert.ok(n.needs.social>25);assert.ok(Object.values(n.relationships).some(v=>v>0));assert.ok(target.needs.social>=targetBefore-1);
});
test('autonomous state survives save and pause freezes decisions',()=>{
 const g=sim.createGame();assert.equal(typeof sim.setAutonomy,'function');sim.setAutonomy(g,true);run(g,1);
 assert.deepEqual(sim.restore(sim.serialize(g)),g);g.speed=0;const before=sim.serialize(g);sim.tick(g,15);assert.equal(sim.serialize(g),before);
});
test('version 1 saves migrate once without losing household progress or manual orders',()=>{
 const legacy=sim.createGame();legacy.version=1;legacy.objects=legacy.objects.filter(o=>o.type!=='gate');delete legacy.autonomy;legacy.money=987;legacy.relationships.nova=65;
 for(const [id,n]of Object.entries(legacy.npcs))legacy.npcs[id]={x:n.x,z:n.z,timer:8,step:2,path:[],activity:'散步'};
 sim.enqueue(legacy,'eat','food');delete legacy.queue[0].source;
 const loaded=sim.restore(JSON.stringify(legacy));assert.equal(loaded.version,22);assert.equal(loaded.money,987);assert.equal(loaded.relationships.nova,65);assert.equal(loaded.autonomy.enabled,false);assert.equal(loaded.queue[0].source,'manual');assert.equal('timer'in loaded.npcs.nova,false);
});
