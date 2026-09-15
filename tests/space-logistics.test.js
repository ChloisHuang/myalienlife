import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,enqueue,tick,buyItem,serialize,restore,cancelAction,switchControl,autonomousCandidates,ACTIONS,dispatchUfo} from '../src/simulation.js';
import {removeUfo} from '../src/space-logistics.js';
import {backDiscovered} from '../src/space-logistics.js';
import {autonomyBonus} from '../src/autonomy.js';
import {generateIsland} from '../src/island-generator.js';
import {createProject} from '../src/settlements.js';
const run=(g,seconds=80)=>{for(let i=0;i<seconds*10;i++)tick(g,.1,()=>.5);};
function setup(){const g=createGame();g.civilization.seed=1;g.autonomy.enabled=false;for(const n of Object.values(g.npcs))n.ai.enabled=false;for(const key in g.config.needDecay)g.config.needDecay[key]=0;g.civilization.technology=240;g.civilization.observations=3;g.civilization.discoveryPath=['eva','spore'];g.skills.science=18;g.money=10000;return g;}
function equip(g,tier=2){g.space.ships.push({id:'ship-a',tier,island:'eva',side:'front',food:0,durability:100,reservedBy:null});g.space.provisions.eva=24;}
function addGenerated(g,index=0,visited=1){const island=generateIsland(g.civilization.seed,index);g.civilization.islands[island.id]=island;g.civilization.discoveryPath.push(island.id);g.civilization.visits[island.id]=visited;g.civilization.surveys[island.id]=0;g.civilization.surveyDays[island.id]=0;g.civilization.projects[island.id]=createProject(g.civilization.seed^index);return island;}
test('idle UFO removal returns cargo and rations, then removes the ship',()=>{
 const g=setup(),ship={id:'remove-me',tier:2,island:'eva',side:'front',food:4,durability:60,reservedBy:null};g.space.ships=[ship];g.space.cargo[ship.id]=12;g.space.materials.eva=8;g.space.provisions.eva=3;g.money=100;
 const result=removeUfo(g,ship.id);assert.equal(result.ok,true);assert.equal(g.space.ships.length,0);assert.equal(g.space.cargo[ship.id],undefined);assert.equal(g.space.materials.eva,20);assert.equal(g.space.provisions.eva,7);assert.equal(g.money,520);assert.match(result.message,/手动删除/);
});
test('reserved UFO cannot be removed before its voyage is cancelled',()=>{
 const g=setup(),ship={id:'reserved-ufo',tier:1,island:'eva',side:'front',food:0,durability:100,reservedBy:42};g.space.ships=[ship];const result=removeUfo(g,ship.id);assert.equal(result.ok,false);assert.match(result.message,/取消航行/);assert.equal(g.space.ships[0],ship);
});

test('a completed passenger flight parks the UFO on the island it reached',()=>{
 const g=setup();equip(g);assert.equal(enqueue(g,'voyage','portal',undefined,null,'spore').ok,true);
 for(let i=0;i<400&&g.player.island!=='spore';i++)tick(g,.1,()=>.5);
 const ship=g.space.ships[0];assert.equal(g.player.island,'spore');assert.equal(ship.island,'spore');assert.equal(ship.side,'front');assert.equal(ship.durability,90);assert.equal(ship.flight,undefined);assert.equal(ship.reservedBy,null);
 run(g,10);assert.equal(ship.island,'spore','automatic return to the departure island is switched off');
});

test('an idle remote UFO dispatches through the same visible empty-flight state without wearing out',()=>{
 const g=setup();equip(g);const ship=g.space.ships[0];ship.island='spore';ship.durability=70;
 const result=dispatchUfo(g,ship.id);assert.equal(result.ok,true);assert.equal(ship.island,'spore');assert.equal(ship.side,'front');assert.equal(ship.durability,70);assert.equal(ship.flight?.kind,'dispatch');assert.equal(ship.flight?.to.island,'eva');assert.match(result.message,/调度/);
 assert.equal(dispatchUfo(g,ship.id).ok,false);run(g,10);assert.equal(ship.island,'eva');assert.equal(ship.side,'front');assert.equal(ship.flight,undefined);
 ship.island='spore';ship.reservedBy=99;assert.equal(dispatchUfo(g,ship.id).ok,false);assert.equal(ship.durability,70);
});
test('UFO removal is a user build command, not a resident action',()=>{
 const g=setup();assert.equal(ACTIONS.removeUfo,undefined);assert.equal(autonomousCandidates(g,'player').some(q=>q.type==='removeUfo'),false);
});
test('manufacture and rations require their professions and create persisted resources after completion',()=>{
 const g=setup();g.career={id:'scientist',level:2,shifts:0};assert.equal(enqueue(g,'buildUfo2','lab').ok,true);run(g);assert.equal(g.space.ships[0].tier,2);assert.match(g.space.ships[0].id,/^ufo-\d+$/);assert.equal(g.money,8600);
 const stove=buyItem(g,'stove',5,5).object;assert.ok(stove);assert.equal(enqueue(g,'prepareRations',stove.id).ok,false);g.career={id:'chef',level:1,shifts:0};g.skills.cooking=3;const money=g.money;assert.equal(enqueue(g,'prepareRations',stove.id).ok,true);run(g);assert.equal(g.space.provisions.eva,8);assert.equal(g.money,money-30);assert.deepEqual(restore(serialize(g)).space,g.space);
});
test('passengers keep earlier work and every race plus infants can travel without pilot skills',()=>{
 let g=setup();equip(g);const guests=['nova','lumi','pip'];g.npcs.nova.prayer.nether=10;g.npcs.lumi.prayer.radiance=10;g.npcs.pip.age=1;for(const id of guests)g.npcs[id].skills.science=0;
 switchControl(g,'nova');enqueue(g,'research','lab');switchControl(g,'kai');g.autonomy.enabled=false;for(const n of Object.values(g.npcs))n.ai.enabled=false;const earlier=g.npcs.nova.queue[0].id;
 assert.equal(enqueue(g,'voyage','portal',undefined,null,'spore',guests).ok,true);assert.equal(g.npcs.nova.queue[0].id,earlier);assert.equal(g.npcs.nova.queue[1].type,'boardUfo');assert.equal(g.space.provisions.eva,20);
 g=restore(serialize(g));run(g);for(const p of [g.player,...guests.map(id=>g.npcs[id])])assert.equal(p.island,'spore');assert.equal(g.civilization.visits.spore,4);assert.equal(g.space.ships[0].food,0);assert.equal(g.queue.length,0);assert.equal(g.npcs.nova.queue.length,0);
});
test('canceling from a passenger releases the manifest and ship but keeps loaded food',()=>{
 const g=setup();equip(g);enqueue(g,'voyage','portal',undefined,null,'spore',['nova']);switchControl(g,'nova');cancelAction(g,g.queue[0].id);assert.equal(g.queue.length,0);assert.equal(g.npcs.kai.queue.length,0);assert.equal(g.space.ships[0].reservedBy,null);assert.equal(g.space.ships[0].food,2);assert.equal(g.space.provisions.eva,22);
});
test('one resident cannot be booked into competing flights and provisions cannot be double spent',()=>{
 const g=setup();equip(g);assert.ok(buyItem(g,'stove',5,5).object);g.space.ships.push({...g.space.ships[0],id:'ship-b'});g.npcs.zig.career.id='chef';g.space.provisions.eva=2;
 assert.equal(enqueue(g,'voyage','portal',undefined,null,'spore',['nova']).ok,true);switchControl(g,'lumi');assert.equal(enqueue(g,'voyage','portal',undefined,null,'spore',['nova']).ok,false);assert.equal(enqueue(g,'voyage','portal',undefined,null,'spore').ok,false);assert.equal(g.space.provisions.eva,0);
});
test('flight waiting for long prior work expires without cancelling that work',()=>{
 const g=setup();equip(g);switchControl(g,'nova');g.config.actionDurations.research=1000;enqueue(g,'research','lab');switchControl(g,'kai');g.autonomy.enabled=false;for(const n of Object.values(g.npcs))n.ai.enabled=false;enqueue(g,'voyage','portal',undefined,null,'spore',['nova']);run(g,200);assert.equal(g.queue.length,0);assert.equal(g.npcs.nova.queue[0].type,'research');assert.equal(g.npcs.nova.queue.length,1);assert.equal(g.space.ships[0].reservedBy,null);
});
test('home back is open by default; remote discovery requires Nether and gates must be purchased',()=>{
 const g=setup();equip(g);const home=structuredClone(g.objects.filter(o=>o.fixed));assert.equal(backDiscovered(g,'eva'),true);enqueue(g,'voyage','portal',undefined,null,'spore');run(g);
 g.civilization.projects.spore.blueprint=300;g.civilization.projects.spore.construction=600;
 assert.equal(backDiscovered(g,'spore'),false);g.viewSide='back';assert.equal(buyItem(g,'gate',5,5).ok,false);g.viewSide='front';assert.equal(enqueue(g,'senseNether','spore-portal').ok,false);g.player.prayer.nether=10;g.autonomy.enabled=true;g.autonomy.cooldown=0;g.autonomy.lastWorkDay=g.day;g.player.preferences.explore=10;for(let i=0;i<30;i++)tick(g,.1,()=>0);g.autonomy.enabled=false;g.queue=[];assert.equal(backDiscovered(g,'spore'),true);
 assert.equal(g.objects.filter(o=>o.island==='spore'&&o.type==='gate').length,0);g.viewSide='front';const front=buyItem(g,'gate',-7,3).object;g.viewSide='back';const back=buyItem(g,'gate',-7,3).object;assert.ok(front&&back);g.viewSide='front';assert.equal(enqueue(g,'travel',front.id,undefined,null,back.id).ok,true);run(g);assert.equal(g.player.side,'back');assert.deepEqual(g.objects.filter(o=>o.fixed&&(!o.island||o.island==='eva')),home);
});
test('qualified logistics actions are autonomous candidates and incompatible jobs cannot manufacture',()=>{
 const g=setup();g.career.level=2;const types=autonomousCandidates(g,'player').map(c=>c.type);assert.ok(types.includes('buildUfo2'));g.career.id='chef';assert.equal(enqueue(g,'buildUfo2','lab').ok,false);
});
test('version 15 migration keeps day, occupants, and main island gates',()=>{
 const g=setup();g.version=15;g.day=161;delete g.space;const objects=structuredClone(g.objects),player=structuredClone(g.player);const loaded=restore(serialize(g));assert.equal(loaded.day,161);assert.deepEqual(loaded.objects,objects);assert.deepEqual(loaded.player,player);assert.equal(backDiscovered(loaded,'eva'),true);
});

test('a flight and an earlier shared task cannot keep each other waiting in a cycle',()=>{
 const g=setup();equip(g);const lamp=buyItem(g,'lamp',5,5).object;assert.equal(enqueue(g,'passOrb',lamp.id,undefined,'nova').ok,true);assert.equal(enqueue(g,'voyage','portal',undefined,null,'spore',['nova']).ok,true);g.queue.reverse();tick(g,.1,()=>.5);assert.equal(g.queue[0].type,'passOrb');assert.equal(g.npcs.nova.queue.length,1);assert.equal(g.space.ships[0].reservedBy,null);run(g);assert.equal(g.queue.length,0);assert.equal(g.npcs.nova.queue.length,0);
});
test('autonomous voyage chooses its action first and only then draws occasional passengers',()=>{
 const g=setup();equip(g);g.player.preferences.voyage=10000;g.autonomy.enabled=true;for(const n of Object.values(g.npcs))n.preferences.explore=10;let draws=0;tick(g,.1,()=>{draws++;return 0;});assert.equal(g.queue[0].type,'voyage');assert.equal(g.queue[0].passengerUids.length,2);assert.equal(draws,4);assert.equal(Object.values(g.npcs).filter(n=>n.queue.some(q=>q.type==='boardUfo')).length,2);
});
test('autonomous settlements attract residents and keep them local until a need is critical',()=>{
 const g=setup(),island=addGenerated(g),id=island.id,person={id:'nova',position:g.npcs.nova,skills:g.npcs.nova.skills,needs:g.npcs.nova.needs,queue:[],ai:g.npcs.nova.ai};g.objects=[{id:'home-portal',type:'portal',island:'eva',side:'front',x:0,z:0,rotation:0},{id:`${id}-portal`,type:'portal',island:id,side:'front',x:0,z:0,rotation:0},{id:`${id}-food`,type:'food',island:id,side:'front',x:2,z:0,rotation:0},{id:`${id}-pod`,type:'pod',island:id,side:'front',x:4,z:0,rotation:0},{id:`${id}-shower`,type:'shower',island:id,side:'front',x:6,z:0,rotation:0}];
 for(const key in person.needs)person.needs[key]=80;const empty=autonomyBonus(g,person,{type:'voyage',targetId:'home-portal',destinationId:id},[person]);assert.ok(empty>10);
 g.civilization.projects[id].blueprint=300;g.civilization.projects[id].construction=600;
 person.position.island=id;for(const key in person.needs)person.needs[key]=40;const healthyReturn=autonomyBonus(g,person,{type:'voyage',targetId:`${id}-portal`,destinationId:'eva'},[person]);assert.equal(healthyReturn,null);
 for(const key in person.needs)person.needs[key]=80;assert.equal(autonomyBonus(g,person,{type:'voyage',targetId:`${id}-portal`,destinationId:'spore'},[person]),null);
 for(const key in person.needs)person.needs[key]=20;assert.equal(autonomyBonus(g,person,{type:'voyage',targetId:`${id}-portal`,destinationId:'eva'},[person]),null);
 for(const key in person.needs)person.needs[key]=10;assert.ok(autonomyBonus(g,person,{type:'voyage',targetId:`${id}-portal`,destinationId:'eva'},[person])>0);
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
 assert.equal(enqueue(g,'starVoyage','portal',undefined,null,'spore').ok,true);let loaded=restore(serialize(g));run(loaded,40);assert.equal(loaded.player.island,'spore');assert.equal(loaded.space.ships.length,0);assert.equal(enqueue(loaded,'starVoyage','spore-portal',undefined,null,'eva').ok,true);run(loaded,40);assert.equal(loaded.player.island,'eva');
});
test('unskilled residents can use provisioned UFO while ship loading conserves food',async()=>{
 const {loadShipFood,shipFoodStatus}=await import('../src/space-logistics.js');const g=setup();equip(g);g.skills.science=0;g.career.id='chef';const stock=g.space.provisions.eva;assert.equal(loadShipFood(g,'ship-a').ok,true);assert.equal(shipFoodStatus(g.space.ships[0]).full,true);assert.equal(g.space.provisions.eva+g.space.ships[0].food,stock);assert.equal(enqueue(g,'voyage','portal',undefined,null,'spore').ok,true);run(g);assert.equal(g.player.island,'spore');assert.equal(shipFoodStatus(g.space.ships[0]).full,false);
});

test('only an adult chef with a local stove blocks understocked voyages',async()=>{
 const {hasLocalChef}=await import('../src/space-logistics.js');const g=setup();equip(g);g.space.provisions.eva=0;g.npcs.nova.career.id='chef';g.npcs.nova.island='spore';
 assert.equal(hasLocalChef(g,'eva'),false);assert.ok(autonomousCandidates(g,'player').some(q=>q.type==='voyage'));assert.equal(enqueue(g,'voyage','portal',undefined,null,'spore').ok,true);cancelAction(g,g.queue[0].id);
 g.npcs.nova.island='eva';g.npcs.nova.side='back';assert.equal(hasLocalChef(g,'eva'),false);const stove=buyItem(g,'stove',5,5).object;assert.ok(stove);
 assert.equal(hasLocalChef(g,'eva'),true);assert.match(enqueue(g,'voyage','portal',undefined,null,'spore').message,/当前星球有星厨/);assert.ok(!autonomousCandidates(g,'player').some(q=>q.type==='voyage'));
 g.npcs.nova.alive=false;assert.equal(hasLocalChef(g,'eva'),false);g.career.id='chef';assert.equal(hasLocalChef(g,'eva'),true);assert.equal(enqueue(g,'voyage','portal',undefined,null,'spore').ok,false);
 g.career.id='scientist';g.npcs.nova.alive=true;g.npcs.nova.age=12;assert.equal(hasLocalChef(g,'eva'),false);assert.equal(enqueue(g,'voyage','portal',undefined,null,'spore').ok,true);cancelAction(g,g.queue[0].id);
 g.career.id='chef';g.space.provisions.eva=1;assert.equal(enqueue(g,'voyage','portal',undefined,null,'spore').ok,true);run(g);assert.equal(g.player.island,'spore');assert.equal(g.space.ships[0].food,0);
});
test('without a local chef missing food charges every passenger once and cannot make stocks negative',()=>{
 const g=setup();equip(g);g.space.provisions.eva=1;g.needs.hunger=80;g.needs.energy=80;g.npcs.nova.needs.hunger=80;g.npcs.nova.needs.energy=80;
 assert.equal(enqueue(g,'voyage','portal',undefined,null,'spore',['nova']).ok,true);run(g,40);
 for(const p of [g.player,g.npcs.nova])assert.equal(p.island,'spore');for(const needs of [g.needs,g.npcs.nova.needs]){assert.equal(needs.hunger,70);assert.equal(needs.energy,75);}assert.equal(g.space.provisions.eva,0);assert.equal(g.space.ships[0].food,0);assert.equal(g.space.ships[0].durability,90);assert.equal(g.space.ships[0].island,'spore');
});
test('a chef arriving during boarding stops an understocked departure and releases passengers',()=>{
 const g=setup();equip(g);assert.ok(buyItem(g,'stove',5,5).object);g.space.provisions.eva=0;assert.equal(enqueue(g,'voyage','portal',undefined,null,'spore',['nova']).ok,true);g.npcs.zig.career.id='chef';run(g,40);assert.equal(g.player.island??'eva','eva');assert.equal(g.npcs.nova.island??'eva','eva');assert.equal(g.queue.length,0);assert.equal(g.npcs.nova.queue.length,0);assert.equal(g.space.ships[0].durability,100);assert.equal(g.space.ships[0].reservedBy,null);
});
test('fleet capacity is one global slot per active island',async()=>{
 const {fleetLimit}=await import('../src/space-logistics.js');const g=setup();assert.equal(fleetLimit(g),2);addGenerated(g);assert.equal(fleetLimit(g),3);g.civilization.destroyedIslands.push('spore');assert.equal(fleetLimit(g),2);
});
test('fleet capacity includes pending manufacture and permits completion of the final global slot',async()=>{
 const {fleetLimit}=await import('../src/space-logistics.js');const g=setup();equip(g);assert.equal(fleetLimit(g),2);g.career={id:'scientist',level:2,shifts:0};assert.equal(enqueue(g,'buildUfo2','lab').ok,true);assert.equal(enqueue(g,'buildUfo2','lab').ok,false);run(g,120);assert.equal(g.space.ships.length,2);assert.equal(g.space.ships.at(-1).durability,100);switchControl(g,'nova');assert.equal(fleetLimit(g),2);
});
test('old ships migrate with durability and excess fleet is recycled without losing cargo',()=>{
 const g=setup();equip(g);g.version=20;g.space.ships=Array.from({length:6},(_,i)=>({...g.space.ships[0],id:`old-${i}`,food:2}));for(const s of g.space.ships)delete s.durability;const loaded=restore(serialize(g));assert.equal(loaded.space.ships.length,2);assert.ok(loaded.space.ships.every(s=>s.durability===100));assert.equal(loaded.space.provisions.eva,32);
});
test('a worn UFO is still repositioned for free and is recycled only by its final passenger landing',()=>{
 const g=setup();equip(g);assert.equal(enqueue(g,'voyage','portal',undefined,null,'spore').ok,true);run(g,40);
 const ship=g.space.ships[0];ship.durability=10;g.player.island=g.viewIsland='eva';g.player.side='front';   // the operator is back home while the ship waits on the story island
 assert.equal(dispatchUfo(g,ship.id).ok,true);assert.equal(ship.durability,10,'an empty dispatch costs no flight use');assert.equal(ship.island,'spore');assert.equal(ship.flight?.kind,'dispatch');
 run(g,10);assert.equal(ship.island,'eva');assert.equal(enqueue(g,'voyage','portal',undefined,null,'spore').ok,true);run(g,40);
 assert.equal(g.player.island,'spore');assert.equal(g.space.ships.length,0);assert.match(g.log.map(l=>l.text).join(' '),/耐久耗尽/);
});
test('a UFO with one remaining leg can take any route and is recycled after landing',()=>{
 const g=setup();equip(g);g.space.ships[0].durability=10;
 assert.equal(enqueue(g,'voyage','portal',undefined,null,'spore').ok,true);run(g,40);
 assert.equal(g.player.island,'spore');assert.equal(g.space.ships.length,0);assert.match(g.log.map(l=>l.text).join(' '),/耐久耗尽/);
 assert.equal(enqueue(g,'buildUfo1','spore-lab').ok,true);run(g,50);
 assert.equal(g.space.ships.length,1);assert.equal(g.space.ships[0].island,'spore');assert.equal(g.space.ships[0].durability,100);
});
test('rations made by a remote chef remain on that planet',()=>{
 const g=setup();equip(g);enqueue(g,'voyage','portal',undefined,null,'spore');run(g,40);g.career={id:'chef',level:1,shifts:0};g.skills.cooking=3;const stove=buyItem(g,'stove',5,5).object;assert.ok(stove);assert.equal(enqueue(g,'prepareRations',stove.id).ok,true);run(g);assert.equal(g.space.provisions.spore,8);assert.equal(g.space.provisions.eva,23);
});
function wantingToFly(g,island='eva'){g.player.island=g.viewIsland=island;g.player.preferences={voyage:100};for(const key in g.needs)g.needs[key]=90;g.autonomy.enabled=true;g.autonomy.cooldown=0;g.autonomy.lastAction=null;return g;}
// The trip has to win the resident's own weighted choice before a ship is called.
const untilCalled=(g,ship,steps=80)=>{for(let i=0;i<steps&&!ship.flight;i++)tick(g,.1,()=>.5);};
test('a resident with no UFO on their island face calls the nearest parked one over',()=>{
 const g=wantingToFly(setup());g.space.ships.push({id:'caller',tier:2,island:'spore',side:'front',food:0,durability:100,reservedBy:null});
 const ship=g.space.ships[0];untilCalled(g,ship);
 assert.equal(ship.flight?.kind,'dispatch');assert.equal(ship.flight?.to.island,'eva');assert.equal(ship.flight?.to.side,'front');assert.equal(ship.durability,100);assert.equal(ship.island,'spore');assert.match(g.log.map(l=>l.text).join(' '),/自动调度/);
 for(let i=0;i<200&&ship.flight;i++)tick(g,.1,()=>.5);
 assert.equal(ship.island,'eva');assert.equal(ship.side,'front');
 g.autonomy.enabled=false;assert.equal(enqueue(g,'voyage','portal',undefined,null,'spore').ok,true);
});
test('a UFO with no flight use left answers no travel demand and cannot be dispatched',()=>{
 const g=wantingToFly(setup());g.space.ships.push({id:'worn',tier:2,island:'spore',side:'front',food:0,durability:0,reservedBy:null});
 for(let i=0;i<20;i++)tick(g,.1,()=>.5);
 const ship=g.space.ships[0];assert.equal(ship.flight,undefined);assert.equal(ship.island,'spore');assert.equal(ship.dispatchedAt,undefined);assert.ok(!autonomousCandidates(g,'player').some(c=>c.callUfo));
 assert.equal(dispatchUfo(g,'worn').ok,false);
});
test('only one ship answers an island request, and a parked ship rests before it is called again',async()=>{
 const {dispatchableUfo,UFO_DISPATCH_COOLDOWN}=await import('../src/space-logistics.js');
 const g=setup(),ship={id:'shared',tier:3,island:'spore',side:'front',food:0,durability:100,reservedBy:null};g.space.ships.push(ship);
 // An empty repositioning leg carries nobody, so it is never gated on rations.
 assert.equal(dispatchableUfo(g,{island:'eva',side:'front'},0,0),ship);
 ship.flight={kind:'dispatch',from:{island:'spore',side:'front'},to:{island:'eva',side:'front'},elapsed:0,duration:6};
 assert.equal(dispatchableUfo(g,{island:'eva',side:'front'},0,0),undefined);
 assert.equal(dispatchableUfo(g,{island:'ocean',side:'front'},2,0),undefined);
 delete ship.flight;ship.island='eva';ship.dispatchedAt=100;
 assert.equal(dispatchableUfo(g,{island:'spore',side:'front'},0,100+UFO_DISPATCH_COOLDOWN-1),undefined);
 assert.equal(dispatchableUfo(g,{island:'spore',side:'front'},0,100+UFO_DISPATCH_COOLDOWN).id,'shared');
});
test('a hand-dispatched UFO lands on the day face even when the operator stands on the night face',()=>{
 const g=setup();equip(g);const ship=g.space.ships[0];ship.island='spore';ship.durability=70;g.player.side='back';g.viewSide='back';
 const result=dispatchUfo(g,ship.id);assert.equal(result.ok,true);assert.equal(ship.flight.to.island,'eva');assert.equal(ship.flight.to.side,'front');assert.match(result.message,/晴昼面/);
 run(g,10);assert.equal(ship.island,'eva');assert.equal(ship.side,'front');
});
test('an automatically dispatched UFO keeps its flight and parking cooldown across a reload',()=>{
 const g=wantingToFly(setup());g.space.ships.push({id:'reload',tier:2,island:'spore',side:'front',food:0,durability:100,reservedBy:null});
 const ship=g.space.ships[0];untilCalled(g,ship);
 const loaded=restore(serialize(g));
 assert.equal(loaded.space.ships[0].flight?.kind,'dispatch');assert.equal(loaded.space.ships[0].flight.to.island,'eva');assert.equal(loaded.space.ships[0].dispatchedAt,ship.dispatchedAt);
});
