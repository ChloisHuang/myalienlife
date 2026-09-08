import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,buyItem,canPlace,enqueue,tick,setCareer,CAREERS,restore,serialize,sellItem} from '../src/simulation.js';

function game(){const g=createGame();for(const n of Object.values(g.npcs))n.ai.enabled=false;return g;}
function run(g,seconds=60){for(let i=0;i<seconds*10;i++)tick(g,.1);}

test('new games place the default teleport gates in the open southwest clearing',()=>{
 const g=game(),gates=g.objects.filter(o=>o.type==='gate'&&o.fixed);
 assert.deepEqual(gates.map(({x,z})=>({x,z})),[{x:-7,z:3},{x:-7,z:3}]);
 assert.deepEqual(({x:g.objects.find(o=>o.id==='portal').x,z:g.objects.find(o=>o.id==='portal').z}),{x:9,z:-4});
});

test('legacy saves move only the original teleport gates to the new clearing',()=>{
 const g=game();for(const gate of g.objects.filter(o=>o.type==='gate'&&o.fixed)){gate.x=-10;gate.z=0;}
 const restored=restore(serialize(g));
 assert.deepEqual(restored.objects.filter(o=>o.type==='gate'&&o.fixed).map(({x,z})=>({x,z})),[{x:-7,z:3},{x:-7,z:3}]);
 assert.deepEqual(({x:restored.objects.find(o=>o.id==='portal').x,z:restored.objects.find(o=>o.id==='portal').z}),{x:9,z:-4});
});

test('opposite faces can hold furniture at the same coordinates',()=>{
 const g=game();g.objects=g.objects.filter(o=>o.type!=='gate');g.viewSide='back';
 assert.equal(canPlace(g,-5,-4),true);
 const result=buyItem(g,'stove',-5,-4);assert.equal(result.ok,true);assert.equal(result.object.side,'back');
 assert.equal(canPlace(g,-5,-4),false);
 assert.equal(enqueue(g,'cook',result.object.id).ok,false);
 assert.equal(enqueue(g,'walk',null,{x:0,z:0}).ok,false);
});

test('gate network transports to a chosen destination and returns home',()=>{
 const g=game(),front=g.objects.find(o=>o.type==='gate'&&o.side==='front'),back=g.objects.find(o=>o.type==='gate'&&o.side==='back');
 assert.ok(front);assert.ok(back);assert.equal(sellItem(g,front.id),false);
 g.objects.push({id:'back-food',type:'food',side:'back',x:3,z:0,rotation:0});const money=g.money;
 assert.equal(enqueue(g,'travel',front.id,null,null,back.id).ok,true);
 assert.equal(enqueue(g,'eat','back-food').ok,true);tick(g,.1);assert.equal(g.player.side,'front');
 run(g);assert.equal(g.player.side,'back');assert.equal(g.viewSide,'back');assert.equal(g.queue.length,0);
 assert.equal(g.money,money-10);
 assert.equal(enqueue(g,'travel',back.id,null,null,front.id).ok,true);run(g);assert.equal(g.player.side,'front');
});

test('blocked gate landing refuses travel without relocating the resident',()=>{
 const g=game(),front=g.objects.find(o=>o.type==='gate'&&o.side==='front'),back=g.objects.find(o=>o.type==='gate'&&o.side==='back');assert.ok(front);assert.ok(back);
 g.objects.push({id:'block',type:'lamp',side:'back',x:back.x,z:back.z+1.7,rotation:0});
 assert.equal(enqueue(g,'travel',front.id,null,null,back.id).ok,false);assert.equal(g.player.side,'front');
});

test('cooking trains the chef career and chef shifts require a kitchen',()=>{
 const g=game(),result=buyItem(g,'stove',3,0);assert.equal(result.ok,true);
 assert.equal(g.skills.cooking,0);g.needs.hunger=10;const money=g.money;
 assert.equal(enqueue(g,'cook',result.object.id).ok,true);run(g,30);
 assert.equal(g.skills.cooking,1);assert.ok(g.needs.hunger>50);assert.equal(g.money,money-15);
 Object.assign(g.skills,CAREERS.chef.levels[1].skills);assert.equal(setCareer(g,'chef'),true);
 assert.equal(enqueue(g,'work','lab').ok,false);
 const before=g.money;for(let i=0;i<3;i++){assert.equal(enqueue(g,'work',result.object.id).ok,true);run(g);}
 assert.equal(g.career.level,2);assert.equal(g.money,before+CAREERS.chef.levels[0].wage*3);
});

test('both faces and cooking survive save roundtrip; version 8 upgrades explicitly',()=>{
 const g=game();g.viewSide='back';g.player.side='back';g.skills.cooking=12;buyItem(g,'stove',3,0);
 const loaded=restore(serialize(g));assert.equal(loaded.player.side,'back');assert.equal(loaded.viewSide,'back');assert.equal(loaded.skills.cooking,12);
 const old=game();old.version=8;delete old.viewSide;delete old.skills.cooking;old.objects=old.objects.filter(o=>o.type!=='gate');
 for(const p of [old.player,...Object.values(old.npcs)]){delete p.side;if(p.skills)delete p.skills.cooking;}
 for(const o of old.objects)delete o.side;
 const upgraded=restore(serialize(old));assert.equal(upgraded.version,10);assert.equal(upgraded.skills.cooking,0);assert.equal(upgraded.player.side,'front');assert.equal(upgraded.objects.filter(o=>o.type==='gate').length,2);
 const invalid=structuredClone(loaded);invalid.player.side='void';assert.throws(()=>restore(serialize(invalid)));
});

test('NPCs cannot choose unreachable furniture or conversations without a gate',()=>{
 const g=game();g.objects=g.objects.filter(o=>o.type!=='gate');g.npcs.nova.side='back';g.npcs.nova.ai.enabled=true;g.npcs.nova.needs.hunger=1;
 run(g,3);assert.equal(g.npcs.nova.queue.length,0);
});

test('purchased gates accept any other gate, including destinations on the same face',()=>{
 const g=game(),front=g.objects.find(o=>o.type==='gate'&&o.side==='front');
 const a=buyItem(g,'gate',3,0);assert.equal(a.ok,true);
 const b=buyItem(g,'gate',6,0);assert.equal(b.ok,true);
 assert.equal(enqueue(g,'travel',front.id,null,null,b.object.id).ok,true);run(g);
 assert.equal(g.player.side,'front');assert.equal(g.player.x,6);
 assert.equal(enqueue(g,'travel',b.object.id,null,null,a.object.id).ok,true);run(g);
 assert.equal(g.player.x,3);assert.equal(enqueue(g,'travel',a.object.id,null,null,a.object.id).ok,false);
 assert.equal(enqueue(g,'travel',a.object.id).ok,false);
});

test('manual interactions route through a gate and finish on the other face',()=>{
 const g=game();g.objects.push({id:'dark-food',type:'food',side:'back',x:3,z:0,rotation:0});g.needs.hunger=5;
 assert.equal(enqueue(g,'eat','dark-food').ok,true);tick(g,.1);assert.equal(g.player.side,'front');
 run(g,50);assert.equal(g.player.side,'back');assert.ok(g.needs.hunger>50);assert.equal(g.queue.length,0);
});
test('autonomous residents use the gate network to satisfy needs on another face',()=>{
 const g=game();g.npcs.nova.side='back';g.npcs.nova.needs.hunger=5;g.npcs.nova.ai.enabled=true;
 run(g,55);assert.equal(g.npcs.nova.side,'front');assert.ok(g.npcs.nova.needs.hunger>45);
});
test('a gate route saved during transit resumes and pays for the target action once',()=>{
 const g=game();g.objects.push({id:'dark-food',type:'food',side:'back',x:3,z:0,rotation:0});
 assert.equal(enqueue(g,'eat','dark-food').ok,true);let iterations=0;while(!g.queue[0]?.transit&&iterations++<500)tick(g,.1);
 assert.ok(g.queue[0].transit);const loaded=restore(serialize(g)),money=g.money;run(loaded,50);
 assert.equal(loaded.player.side,'back');assert.equal(loaded.queue.length,0);assert.equal(loaded.money,money-10);
});

test('residents approaching opposite ends can cross without deadlocking each other',()=>{
 const g=game();g.objects.push({id:'dark-food',type:'food',side:'back',x:3,z:0,rotation:0});
 const n=g.npcs.nova;n.side='back';n.x=-10;n.z=1.7;n.needs.hunger=5;n.ai.enabled=true;
 g.player.x=-10;g.player.z=1.7;assert.equal(enqueue(g,'eat','dark-food').ok,true);
 run(g,55);assert.equal(g.player.side,'back');assert.equal(n.side,'front');assert.ok(n.needs.hunger>45);assert.equal(g.queue.length,0);
});

test('area lamps can be purchased on either face, used, saved and sold',()=>{
 const g=game(),money=g.money;g.viewSide='back';const result=buyItem(g,'glowlight',3,0);
 assert.equal(result.ok,true);assert.equal(result.object.side,'back');assert.ok(g.money<money);
 assert.equal(enqueue(g,'admire',result.object.id).ok,true);run(g,45);assert.equal(g.player.side,'back');
 const loaded=restore(serialize(g));assert.ok(loaded.objects.some(o=>o.id===result.object.id));
 const before=loaded.money;assert.equal(sellItem(loaded,result.object.id),true);assert.ok(loaded.money>before);assert.ok(!loaded.objects.some(o=>o.id===result.object.id));
});

test('tall pole lamps are available on both faces and retain their placement',()=>{
 const g=game(),front=buyItem(g,'polelight',3,0);assert.equal(front.ok,true);
 g.viewSide='back';const back=buyItem(g,'polelight',3,0);assert.equal(back.ok,true);
 const loaded=restore(serialize(g));assert.deepEqual(loaded.objects.filter(o=>o.type==='polelight'),[front.object,back.object]);
});
