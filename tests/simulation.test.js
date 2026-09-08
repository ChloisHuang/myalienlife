import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame, tick, enqueue, cancelAction, buyItem, setCareer, serialize, restore, canPlace, CAREERS, ACTIONS, recordMajorEvent} from '../src/simulation.js';

test('pause freezes clock, needs, and active actions', () => {
 const g=createGame(); enqueue(g,'eat','food'); g.speed=0; const before=JSON.stringify(g); tick(g,10); assert.equal(JSON.stringify(g),before);
});
test('interactive action durations are explicit while walking keeps its duration',()=>{
 const expected={incubate:16,care:12,eat:10,sleep:18,wash:10,relax:10,research:14,dance:12,explore:24,observe:12,harvest:10,replant:12,garden:12,admire:8,chat:10,joke:10,gift:8,flirt:12,work:32};
 for(const [type,duration] of Object.entries(expected))assert.equal(ACTIONS[type].duration,duration,type);
 assert.equal(ACTIONS.walk.duration,0);
});
test('radio keeps only the three most recent major events',()=>{
 const g=createGame();
 for(const text of ['事件一','事件二','事件三','事件四'])recordMajorEvent(g,text);
 assert.deepEqual(g.majorEvents.map(event=>event.text),['事件四','事件三','事件二']);
 enqueue(g,'chat','nova');for(let i=0;i<250;i++)tick(g,.1);
 assert.deepEqual(g.majorEvents.map(event=>event.text),['事件四','事件三','事件二']);
});
test('ordinary crop maturity leaves radio events unchanged',()=>{
 const g=createGame();g.speed=1;for(const n of Object.values(g.npcs))n.ai.enabled=false;
 g.config.crops.garden.giantChance=0;
 const plant=g.objects.find(o=>o.type==='garden');plant.plant.growth=.99;plant.plant.water=100;
 recordMajorEvent(g,'保留的事件');const events=structuredClone(g.majorEvents);
 tick(g,3);assert.equal(plant.plant.growth,1);assert.equal(plant.plant.giant,false);assert.deepEqual(g.majorEvents,events);
});
test('giant crop maturity creates one major event when growth crosses the threshold',()=>{
 const g=createGame();g.speed=1;for(const n of Object.values(g.npcs))n.ai.enabled=false;
 g.config.crops.garden.giantChance=100;
 const plant=g.objects.find(o=>o.type==='garden');plant.plant.growth=.99;plant.plant.water=100;
 tick(g,3);assert.equal(plant.plant.giant,true);assert.equal(g.majorEvents.filter(event=>event.type==='mature').length,1);assert.equal(g.majorEvents[0].text,'巨型发光孢子成熟了，可以收获。');
 tick(g,1);assert.equal(g.majorEvents.filter(event=>event.type==='mature').length,1);
});
test('queued eating restores hunger only after arrival and completion',()=>{
 const g=createGame();g.autonomy.enabled=false; g.needs.hunger=20; enqueue(g,'eat','food'); tick(g,0.1); assert.ok(g.needs.hunger<21);
 for(let i=0;i<200;i++)tick(g,0.1); assert.ok(g.needs.hunger>65); assert.equal(g.queue.length,0);
});
test('completed eating charges ten coins from household funds',()=>{
 const g=createGame();g.autonomy.enabled=false;g.needs.hunger=0;const funds=g.money;enqueue(g,'eat','food');
 for(let i=0;i<200;i++)tick(g,0.1);
 assert.equal(g.money,funds-10);assert.ok(g.needs.hunger>60);assert.equal(g.queue.length,0);
});
test('eating with insufficient funds does not restore hunger',()=>{
 const g=createGame();g.money=9;g.needs.hunger=0;const result=enqueue(g,'eat','food');
 assert.equal(result.ok,false);assert.equal(g.money,9);assert.equal(g.needs.hunger,0);assert.equal(g.queue.length,0);
});
test('manual eating with insufficient funds is unavailable before movement',()=>{
 const g=createGame();g.money=9;const result=enqueue(g,'eat','food');
 assert.equal(result.ok,false);assert.equal(result.message,'星币不足，无法合成晚餐。');assert.equal(g.queue.length,0);
});
test('government subsidy pays minors and elders once per game day',()=>{
 const g=createGame();g.speed=1;g.minute=1439;g.player.age=18;g.npcs.nova.age=17;g.npcs.zig.age=59;g.npcs.lumi.age=60;g.npcs.pip.age=10;g.npcs.nova.parents=[{uid:g.npcs.zig.uid,name:g.npcs.zig.name},{uid:g.npcs.lumi.uid,name:g.npcs.lumi.name}];
 for(const n of Object.values(g.npcs))n.ai.enabled=false;
 const before={player:g.money,nova:g.npcs.nova.money,zig:g.npcs.zig.money,lumi:g.npcs.lumi.money,pip:g.npcs.pip.money};
 tick(g,1);assert.equal(g.day,2);assert.equal(g.money,before.player);assert.equal(g.npcs.nova.money,before.nova);assert.equal(g.npcs.zig.money,before.zig);assert.equal(g.npcs.lumi.money,before.lumi+50);assert.equal(g.npcs.pip.money,before.pip+50);
 tick(g,1);assert.equal(g.npcs.nova.money,before.nova);assert.equal(g.npcs.lumi.money,before.lumi+50);
});
test('cancelling an action prevents its reward',()=>{
 const g=createGame();g.autonomy.enabled=false; enqueue(g,'work','lab'); const funds=g.money; cancelAction(g,g.queue[0].id); tick(g,60); assert.equal(g.money,funds);
});
test('work earns wages and repeated shifts promote the chosen career',()=>{
 const g=createGame();Object.assign(g.skills,CAREERS.botanist.levels[1].skills);assert.equal(setCareer(g,'botanist'),true); const money=g.money;
 for(let j=0;j<3;j++){enqueue(g,'work','lab');for(let i=0;i<700;i++)tick(g,0.1);}
 assert.ok(g.money>money); assert.equal(g.career.level,2);
});
test('career entry and promotion use configured skill requirements',()=>{
 const g=createGame(),career=CAREERS.botanist;
 assert.ok(career.levels[0].skills.botany>0);
 assert.equal(setCareer(g,'botanist'),false);
 Object.assign(g.skills,career.levels[0].skills);assert.equal(setCareer(g,'botanist'),true);
 for(let j=0;j<3;j++){enqueue(g,'work','lab');for(let i=0;i<700;i++)tick(g,0.1);}
 assert.equal(g.career.level,1);
 Object.assign(g.skills,career.levels[1].skills);enqueue(g,'work','lab');for(let i=0;i<700;i++)tick(g,0.1);
 assert.equal(g.career.level,2);
 assert.ok(Object.keys(CAREERS.scientist.levels[2].skills).length>1);
});
test('social actions increase a specific relationship',()=>{
 const g=createGame();enqueue(g,'chat','nova');for(let i=0;i<250;i++)tick(g,0.1); assert.ok(g.relationships.nova>15);assert.equal(g.relationships.zig,12);
});
test('purchase refuses insufficient funds and occupied cells without charging',()=>{
 const g=createGame();g.money=1;assert.equal(buyItem(g,'crystal',5,5).ok,false);assert.equal(g.money,1);
 g.money=2000;assert.equal(buyItem(g,'crystal',-5,-4).ok,false);assert.equal(g.money,2000);
 assert.equal(buyItem(g,'crystal',5,5).ok,true);assert.ok(g.money<2000);assert.equal(canPlace(g,5,5),false);
});
test('save roundtrip preserves time, furniture, career and relationships',()=>{
 const g=createGame();buyItem(g,'crystal',5,5);g.relationships.nova=63;Object.assign(g.skills,CAREERS.diplomat.levels[0].skills);assert.equal(setCareer(g,'diplomat'),true);tick(g,2);
 const loaded=restore(serialize(g));assert.deepEqual(loaded,g);assert.throws(()=>restore('{"version":999}'));assert.throws(()=>restore('invalid'));
});
test('needs remain bounded over extended simulation',()=>{
 const g=createGame();for(let i=0;i<1000;i++)tick(g,1);for(const n of Object.values(g.needs))assert.ok(n>=0&&n<=100);
});
test('neighbors wander autonomously but stay still during a conversation',()=>{
 const g=createGame(); const before=JSON.stringify(g.npcs);for(let i=0;i<150;i++)tick(g,.1);assert.notEqual(JSON.stringify(g.npcs),before);
 enqueue(g,'chat','nova');const position={x:g.npcs.nova.x,z:g.npcs.nova.z};tick(g,.1);assert.equal(g.npcs.nova.x,position.x);assert.equal(g.npcs.nova.z,position.z);
});
test('corrupt saves with invalid needs or furniture are rejected',()=>{
 const g=createGame();g.needs.hunger='broken';assert.throws(()=>restore(JSON.stringify(g)));
 const h=createGame();h.objects[0].type='invalid';assert.throws(()=>restore(JSON.stringify(h)));
});
