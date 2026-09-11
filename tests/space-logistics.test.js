import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,enqueue,tick,buyItem,serialize,restore,cancelAction,switchControl,autonomousCandidates} from '../src/simulation.js';
import {backDiscovered} from '../src/space-logistics.js';
import {autonomyBonus} from '../src/autonomy.js';
import {generateIsland} from '../src/island-generator.js';
import {createProject} from '../src/settlements.js';
const run=(g,seconds=80)=>{for(let i=0;i<seconds*10;i++)tick(g,.1,()=>.5);};
function setup(){const g=createGame();g.autonomy.enabled=false;for(const n of Object.values(g.npcs))n.ai.enabled=false;for(const key in g.config.needDecay)g.config.needDecay[key]=0;g.civilization.technology=240;g.civilization.observations=3;g.civilization.discoveryPath=['home','spore'];g.skills.science=18;g.money=10000;return g;}
function equip(g,tier=2){g.space.ships.push({id:'ship-a',tier,island:'home',side:'front',food:0,durability:100,reservedBy:null});g.space.provisions.home=24;}
function addGenerated(g,index=0,visited=1){const island=generateIsland(g.civilization.seed,index);g.civilization.islands[island.id]=island;g.civilization.discoveryPath.push(island.id);g.civilization.visits[island.id]=visited;g.civilization.surveys[island.id]=0;g.civilization.surveyDays[island.id]=0;g.civilization.projects[island.id]=createProject(g.civilization.seed^index);return island;}
test('manufacture and rations require their professions and create persisted resources after completion',()=>{
 const g=setup();g.career={id:'scientist',level:2,shifts:0};assert.equal(enqueue(g,'buildUfo2','lab').ok,true);run(g);assert.equal(g.space.ships[0].tier,2);assert.match(g.space.ships[0].id,/^ufo-\d+$/);assert.equal(g.money,8600);
 const stove=buyItem(g,'stove',5,5).object;assert.ok(stove);assert.equal(enqueue(g,'prepareRations',stove.id).ok,false);g.career={id:'chef',level:1,shifts:0};g.skills.cooking=3;const money=g.money;assert.equal(enqueue(g,'prepareRations',stove.id).ok,true);run(g);assert.equal(g.space.provisions.home,8);assert.equal(g.money,money-30);assert.deepEqual(restore(serialize(g)).space,g.space);
});
test('passengers keep earlier work and every race plus infants can travel without pilot skills',()=>{
 let g=setup();equip(g);const guests=['nova','lumi','pip'];g.npcs.nova.prayer.nether=10;g.npcs.lumi.prayer.radiance=10;g.npcs.pip.age=1;for(const id of guests)g.npcs[id].skills.science=0;
 switchControl(g,'nova');enqueue(g,'research','lab');switchControl(g,'kai');g.autonomy.enabled=false;for(const n of Object.values(g.npcs))n.ai.enabled=false;const earlier=g.npcs.nova.queue[0].id;
 assert.equal(enqueue(g,'voyage','portal',undefined,null,'spore',guests).ok,true);assert.equal(g.npcs.nova.queue[0].id,earlier);assert.equal(g.npcs.nova.queue[1].type,'boardUfo');assert.equal(g.space.provisions.home,20);
 g=restore(serialize(g));run(g);for(const p of [g.player,...guests.map(id=>g.npcs[id])])assert.equal(p.island,'spore');assert.equal(g.civilization.visits.spore,4);assert.equal(g.space.ships[0].food,0);assert.equal(g.queue.length,0);assert.equal(g.npcs.nova.queue.length,0);
});
test('canceling from a passenger releases the manifest and ship but keeps loaded food',()=>{
 const g=setup();equip(g);enqueue(g,'voyage','portal',undefined,null,'spore',['nova']);switchControl(g,'nova');cancelAction(g,g.queue[0].id);assert.equal(g.queue.length,0);assert.equal(g.npcs.kai.queue.length,0);assert.equal(g.space.ships[0].reservedBy,null);assert.equal(g.space.ships[0].food,2);assert.equal(g.space.provisions.home,22);
});
test('one resident cannot be booked into competing flights and provisions cannot be double spent',()=>{
 const g=setup();equip(g);assert.ok(buyItem(g,'stove',5,5).object);g.space.ships.push({...g.space.ships[0],id:'ship-b'});g.npcs.zig.career.id='chef';g.space.provisions.home=2;
 assert.equal(enqueue(g,'voyage','portal',undefined,null,'spore',['nova']).ok,true);switchControl(g,'lumi');assert.equal(enqueue(g,'voyage','portal',undefined,null,'spore',['nova']).ok,false);assert.equal(enqueue(g,'voyage','portal',undefined,null,'spore').ok,false);assert.equal(g.space.provisions.home,0);
});
test('flight waiting for long prior work expires without cancelling that work',()=>{
 const g=setup();equip(g);switchControl(g,'nova');g.config.actionDurations.research=1000;enqueue(g,'research','lab');switchControl(g,'kai');g.autonomy.enabled=false;for(const n of Object.values(g.npcs))n.ai.enabled=false;enqueue(g,'voyage','portal',undefined,null,'spore',['nova']);run(g,200);assert.equal(g.queue.length,0);assert.equal(g.npcs.nova.queue[0].type,'research');assert.equal(g.npcs.nova.queue.length,1);assert.equal(g.space.ships[0].reservedBy,null);
});
test('home back is open by default; remote discovery requires Nether and gates must be purchased',()=>{
 const g=setup();equip(g);const home=structuredClone(g.objects.filter(o=>o.fixed));assert.equal(backDiscovered(g,'home'),true);enqueue(g,'voyage','portal',undefined,null,'spore');run(g);
 g.civilization.projects.spore.blueprint=300;g.civilization.projects.spore.construction=600;
 assert.equal(backDiscovered(g,'spore'),false);g.viewSide='back';assert.equal(buyItem(g,'gate',5,5).ok,false);g.viewSide='front';assert.equal(enqueue(g,'senseNether','spore-portal').ok,false);g.player.prayer.nether=10;g.autonomy.enabled=true;g.autonomy.cooldown=0;g.autonomy.lastWorkDay=g.day;g.player.preferences.explore=10;for(let i=0;i<30;i++)tick(g,.1,()=>0);g.autonomy.enabled=false;g.queue=[];assert.equal(backDiscovered(g,'spore'),true);
 assert.equal(g.objects.filter(o=>o.island==='spore'&&o.type==='gate').length,0);g.viewSide='front';const front=buyItem(g,'gate',-7,3).object;g.viewSide='back';const back=buyItem(g,'gate',-7,3).object;assert.ok(front&&back);g.viewSide='front';assert.equal(enqueue(g,'travel',front.id,undefined,null,back.id).ok,true);run(g);assert.equal(g.player.side,'back');assert.deepEqual(g.objects.filter(o=>o.fixed&&(!o.island||o.island==='home')),home);
});
test('qualified logistics actions are autonomous candidates and incompatible jobs cannot manufacture',()=>{
 const g=setup();g.career.level=2;const types=autonomousCandidates(g,'player').map(c=>c.type);assert.ok(types.includes('buildUfo2'));g.career.id='chef';assert.equal(enqueue(g,'buildUfo2','lab').ok,false);
});
test('version 15 migration keeps day, occupants, and main island gates',()=>{
 const g=setup();g.version=15;g.day=161;delete g.space;const objects=structuredClone(g.objects),player=structuredClone(g.player);const loaded=restore(serialize(g));assert.equal(loaded.day,161);assert.deepEqual(loaded.objects,objects);assert.deepEqual(loaded.player,player);assert.equal(backDiscovered(loaded,'home'),true);
});

test('a flight and an earlier shared task cannot keep each other waiting in a cycle',()=>{
 const g=setup();equip(g);const lamp=buyItem(g,'lamp',5,5).object;assert.equal(enqueue(g,'passOrb',lamp.id,undefined,'nova').ok,true);assert.equal(enqueue(g,'voyage','portal',undefined,null,'spore',['nova']).ok,true);g.queue.reverse();tick(g,.1,()=>.5);assert.equal(g.queue[0].type,'passOrb');assert.equal(g.npcs.nova.queue.length,1);assert.equal(g.space.ships[0].reservedBy,null);run(g);assert.equal(g.queue.length,0);assert.equal(g.npcs.nova.queue.length,0);
});
test('autonomous voyage chooses its action first and only then draws occasional passengers',()=>{
 const g=setup();equip(g);g.player.preferences.voyage=10000;g.autonomy.enabled=true;for(const n of Object.values(g.npcs))n.preferences.explore=10;let draws=0;tick(g,.1,()=>{draws++;return 0;});assert.equal(g.queue[0].type,'voyage');assert.equal(g.queue[0].passengerUids.length,2);assert.equal(draws,4);assert.equal(Object.values(g.npcs).filter(n=>n.queue.some(q=>q.type==='boardUfo')).length,2);
});
test('autonomous settlements attract residents and keep them local until a need is critical',()=>{
 const g=setup(),island=addGenerated(g),id=island.id,person={id:'nova',position:g.npcs.nova,skills:g.npcs.nova.skills,needs:g.npcs.nova.needs,queue:[],ai:g.npcs.nova.ai};g.objects=[{id:'home-portal',type:'portal',island:'home',side:'front',x:0,z:0,rotation:0},{id:`${id}-portal`,type:'portal',island:id,side:'front',x:0,z:0,rotation:0},{id:`${id}-food`,type:'food',island:id,side:'front',x:2,z:0,rotation:0},{id:`${id}-pod`,type:'pod',island:id,side:'front',x:4,z:0,rotation:0},{id:`${id}-shower`,type:'shower',island:id,side:'front',x:6,z:0,rotation:0}];
 for(const key in person.needs)person.needs[key]=80;const empty=autonomyBonus(g,person,{type:'voyage',targetId:'home-portal',destinationId:id},[person]);assert.ok(empty>10);
 g.civilization.projects[id].blueprint=300;g.civilization.projects[id].construction=600;
 person.position.island=id;for(const key in person.needs)person.needs[key]=40;const healthyReturn=autonomyBonus(g,person,{type:'voyage',targetId:`${id}-portal`,destinationId:'home'},[person]);assert.equal(healthyReturn,null);
 for(const key in person.needs)person.needs[key]=80;assert.equal(autonomyBonus(g,person,{type:'voyage',targetId:`${id}-portal`,destinationId:'spore'},[person]),null);
 for(const key in person.needs)person.needs[key]=20;assert.equal(autonomyBonus(g,person,{type:'voyage',targetId:`${id}-portal`,destinationId:'home'},[person]),null);
 for(const key in person.needs)person.needs[key]=10;assert.ok(autonomyBonus(g,person,{type:'voyage',targetId:`${id}-portal`,destinationId:'home'},[person])>0);
});
test('autonomous residents use a local UFO before taking a direct star-gate route',()=>{
 const g=setup();equip(g,2);g.skills.science=135;const candidates=autonomousCandidates(g,'player');assert.ok(candidates.some(q=>q.type==='voyage'&&q.destinationId==='spore'));assert.equal(candidates.some(q=>q.type==='starVoyage'&&q.destinationId==='spore'),false);
});
test('a visited island receives local social and leisure facilities',()=>{
 const g=setup();equip(g);assert.equal(enqueue(g,'voyage','portal',undefined,null,'spore').ok,true);run(g,40);
 const legacy=structuredClone(g);legacy.objects=legacy.objects.filter(o=>!(o.island==='spore'&&['sofa','music'].includes(o.type)));const loaded=restore(serialize(legacy));
 const remote=loaded.objects.filter(o=>o.island==='spore');assert.ok(remote.some(o=>o.type==='sofa'&&o.fixed));assert.ok(remote.some(o=>o.type==='music'&&o.fixed));
});

test('only quantum scientists with science level ten can travel by portal without ships or food',()=>{
 const g=setup();g.skills.science=135;g.career.id='chef';assert.equal(enqueue(g,'starVoyage','portal',undefined,null,'spore').ok,false);g.career.id='scientist';g.skills.science=134;assert.equal(enqueue(g,'starVoyage','portal',undefined,null,'spore').ok,false);g.skills.science=135;
 assert.equal(enqueue(g,'starVoyage','portal',undefined,null,'spore').ok,true);let loaded=restore(serialize(g));run(loaded,40);assert.equal(loaded.player.island,'spore');assert.equal(loaded.space.ships.length,0);assert.equal(enqueue(loaded,'starVoyage','spore-portal',undefined,null,'home').ok,true);run(loaded,40);assert.equal(loaded.player.island,'home');
});
test('unskilled residents can use provisioned UFO while ship loading conserves food',async()=>{
 const {loadShipFood,shipFoodStatus}=await import('../src/space-logistics.js');const g=setup();equip(g);g.skills.science=0;g.career.id='chef';const stock=g.space.provisions.home;assert.equal(loadShipFood(g,'ship-a').ok,true);assert.equal(shipFoodStatus(g.space.ships[0]).full,true);assert.equal(g.space.provisions.home+g.space.ships[0].food,stock);assert.equal(enqueue(g,'voyage','portal',undefined,null,'spore').ok,true);run(g);assert.equal(g.player.island,'spore');assert.equal(shipFoodStatus(g.space.ships[0]).full,false);
});

test('only an adult chef with a local stove blocks understocked voyages',async()=>{
 const {hasLocalChef}=await import('../src/space-logistics.js');const g=setup();equip(g);g.space.provisions.home=0;g.npcs.nova.career.id='chef';g.npcs.nova.island='spore';
 assert.equal(hasLocalChef(g,'home'),false);assert.ok(autonomousCandidates(g,'player').some(q=>q.type==='voyage'));assert.equal(enqueue(g,'voyage','portal',undefined,null,'spore').ok,true);cancelAction(g,g.queue[0].id);
 g.npcs.nova.island='home';g.npcs.nova.side='back';assert.equal(hasLocalChef(g,'home'),false);const stove=buyItem(g,'stove',5,5).object;assert.ok(stove);
 assert.equal(hasLocalChef(g,'home'),true);assert.match(enqueue(g,'voyage','portal',undefined,null,'spore').message,/当前星球有星厨/);assert.ok(!autonomousCandidates(g,'player').some(q=>q.type==='voyage'));
 g.npcs.nova.alive=false;assert.equal(hasLocalChef(g,'home'),false);g.career.id='chef';assert.equal(hasLocalChef(g,'home'),true);assert.equal(enqueue(g,'voyage','portal',undefined,null,'spore').ok,false);
 g.career.id='scientist';g.npcs.nova.alive=true;g.npcs.nova.age=12;assert.equal(hasLocalChef(g,'home'),false);assert.equal(enqueue(g,'voyage','portal',undefined,null,'spore').ok,true);cancelAction(g,g.queue[0].id);
 g.career.id='chef';g.space.provisions.home=1;assert.equal(enqueue(g,'voyage','portal',undefined,null,'spore').ok,true);run(g);assert.equal(g.player.island,'spore');assert.equal(g.space.ships[0].food,0);
});
test('without a local chef missing food charges every passenger once and cannot make stocks negative',()=>{
 const g=setup();equip(g);g.space.provisions.home=1;g.needs.hunger=80;g.needs.energy=80;g.npcs.nova.needs.hunger=80;g.npcs.nova.needs.energy=80;
 assert.equal(enqueue(g,'voyage','portal',undefined,null,'spore',['nova']).ok,true);run(g,40);
 for(const p of [g.player,g.npcs.nova])assert.equal(p.island,'spore');for(const needs of [g.needs,g.npcs.nova.needs]){assert.equal(needs.hunger,70);assert.equal(needs.energy,75);}assert.equal(g.space.provisions.home,0);assert.equal(g.space.ships[0].food,0);assert.equal(g.space.ships[0].durability,90);
});
test('a chef arriving during boarding stops an understocked departure and releases passengers',()=>{
 const g=setup();equip(g);assert.ok(buyItem(g,'stove',5,5).object);g.space.provisions.home=0;assert.equal(enqueue(g,'voyage','portal',undefined,null,'spore',['nova']).ok,true);g.npcs.zig.career.id='chef';run(g,40);assert.equal(g.player.island??'home','home');assert.equal(g.npcs.nova.island??'home','home');assert.equal(g.queue.length,0);assert.equal(g.npcs.nova.queue.length,0);assert.equal(g.space.ships[0].durability,100);assert.equal(g.space.ships[0].reservedBy,null);
});
test('fleet capacity is two per active island',async()=>{
 const {fleetLimit}=await import('../src/space-logistics.js');const g=setup();assert.equal(fleetLimit(g),4);addGenerated(g);assert.equal(fleetLimit(g),6);g.civilization.destroyedIslands.push('spore');assert.equal(fleetLimit(g),4);
});
test('fleet capacity includes pending manufacture and permits completion of the final slot',async()=>{
 const {fleetLimit}=await import('../src/space-logistics.js');const g=setup();equip(g);assert.equal(fleetLimit(g),4);g.space.ships.push({...g.space.ships[0],id:'ship-b'});g.career={id:'scientist',level:2,shifts:0};assert.equal(enqueue(g,'buildUfo2','lab').ok,true);assert.equal(enqueue(g,'buildUfo2','lab').ok,true);assert.equal(enqueue(g,'buildUfo2','lab').ok,false);run(g,120);assert.equal(g.space.ships.length,4);assert.equal(g.space.ships.at(-1).durability,100);switchControl(g,'nova');assert.equal(fleetLimit(g),4);
});
test('old ships migrate with durability and excess fleet is recycled without losing cargo',()=>{
 const g=setup();equip(g);g.version=20;g.space.ships=Array.from({length:6},(_,i)=>({...g.space.ships[0],id:`old-${i}`,food:2}));for(const s of g.space.ships)delete s.durability;const loaded=restore(serialize(g));assert.equal(loaded.space.ships.length,4);assert.ok(loaded.space.ships.every(s=>s.durability===100));assert.equal(loaded.space.provisions.home,28);
});
test('last durability supports a return flight and recycles only after landing',()=>{
 const g=setup();equip(g);assert.equal(enqueue(g,'voyage','portal',undefined,null,'spore').ok,true);run(g,40);const ship=g.space.ships[0];ship.durability=10;assert.equal(enqueue(g,'voyage','spore-portal',undefined,null,'home').ok,true);run(g,40);assert.equal(g.player.island,'home');assert.equal(g.space.ships.length,0);assert.match(g.log.map(l=>l.text).join(' '),/耐久耗尽/);
});
test('a UFO with one remaining leg can take any route and is recycled after landing',()=>{
 const g=setup();equip(g);g.space.ships[0].durability=10;
 assert.equal(enqueue(g,'voyage','portal',undefined,null,'spore').ok,true);run(g,40);
 assert.equal(g.player.island,'spore');assert.equal(g.space.ships.length,0);assert.match(g.log.map(l=>l.text).join(' '),/耐久耗尽/);
 assert.equal(enqueue(g,'buildUfo1','spore-lab').ok,true);run(g,50);
 assert.equal(g.space.ships.length,1);assert.equal(g.space.ships[0].island,'spore');assert.equal(g.space.ships[0].durability,100);
});
test('rations made by a remote chef remain on that planet',()=>{
 const g=setup();equip(g);enqueue(g,'voyage','portal',undefined,null,'spore');run(g,40);g.career={id:'chef',level:1,shifts:0};g.skills.cooking=3;const stove=buyItem(g,'stove',5,5).object;assert.ok(stove);assert.equal(enqueue(g,'prepareRations',stove.id).ok,true);run(g);assert.equal(g.space.provisions.spore,8);assert.equal(g.space.provisions.home,23);
});
