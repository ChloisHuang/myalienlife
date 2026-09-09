import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,enqueue,cancelAction,tick,serialize,restore} from '../src/simulation.js';
import {contributeProject} from '../src/settlements.js';
import {loadShipMaterials,unloadShipMaterials,UFOS} from '../src/space-logistics.js';
function setup(){const g=createGame();g.autonomy.enabled=false;for(const n of Object.values(g.npcs))n.ai.enabled=false;g.player.island=g.viewIsland='spore';g.civilization.discoveryPath=['home','spore'];g.civilization.visits.spore=1;g.objects.push({id:'bench',type:'lab',island:'spore',side:'front',x:0,z:0,rotation:0});return g;}
test('blueprints and construction require an architect and recheck profession while working',()=>{
 const g=setup();assert.equal(enqueue(g,'developBlueprint','bench').ok,false);g.career.id='architect';assert.equal(enqueue(g,'developBlueprint','bench').ok,true);g.career.id='scientist';for(let i=0;i<100;i++)tick(g,.1,()=>1);assert.equal(g.civilization.projects.spore.blueprint,0);
});
test('construction consumes one local material per ten seconds without double charging resumed work',()=>{
 const g=setup(),p=g.civilization.projects.spore;p.blueprint=300;g.space.materials.spore=1;
 contributeProject(g,'constructIsland',g.player,4);assert.equal(p.construction,4);assert.equal(g.space.materials.spore,0);
 contributeProject(g,'constructIsland',g.player,20);assert.equal(p.construction,10);assert.equal(g.space.materials.spore,0);
 g.space.materials.home=100;contributeProject(g,'constructIsland',g.player,20);assert.equal(p.construction,10);
 g.space.materials.spore=2;contributeProject(g,'constructIsland',g.player,15);assert.equal(p.construction,25);assert.equal(g.space.materials.spore,0);assert.equal(restore(serialize(g)).civilization.projects.spore.construction,25);
});
test('only botanists extract mature plants into local building materials, not a second harvest',()=>{
 const g=createGame();g.autonomy.enabled=false;for(const n of Object.values(g.npcs))n.ai.enabled=false;const plant=g.objects.find(o=>o.type==='garden');plant.plant.growth=1;
 assert.equal(enqueue(g,'extractMaterials',plant.id).ok,false);g.career.id='botanist';assert.equal(enqueue(g,'extractMaterials',plant.id).ok,true);
 for(let i=0;i<600;i++)tick(g,.1,()=>1);assert.ok(g.space.materials.home>0);assert.ok(plant.plant.growth<1);assert.equal(g.harvest.spores,0);assert.equal(enqueue(g,'extractMaterials',plant.id).ok,false);
});
test('cargo is capacity limited, local, reserved during flight, and unloads into the destination stock',()=>{
 const g=createGame(),ship={id:'cargo-test',tier:1,island:'home',side:'front',food:0,durability:100,reservedBy:null};g.space.ships.push(ship);g.space.materials.home=100;
 assert.equal(loadShipMaterials(g,ship.id,UFOS[0].cargoCapacity+1).ok,false);assert.equal(loadShipMaterials(g,ship.id,10).ok,true);assert.equal(g.space.materials.home,90);assert.equal(g.space.cargo[ship.id],10);
 ship.reservedBy=5;assert.equal(loadShipMaterials(g,ship.id,1).ok,false);assert.equal(unloadShipMaterials(g,ship.id).ok,false);ship.reservedBy=null;ship.island='spore';assert.equal(unloadShipMaterials(g,ship.id).ok,false);
 g.player.island='spore';assert.equal(unloadShipMaterials(g,ship.id).ok,true);assert.equal(g.space.materials.spore,10);assert.equal(g.space.cargo[ship.id],undefined);assert.ok(restore(serialize(g)));
});
test('an actual voyage carries materials across planets and cancellation never duplicates cargo',()=>{
 const g=createGame();g.autonomy.enabled=false;for(const n of Object.values(g.npcs))n.ai.enabled=false;g.civilization.discoveryPath=['home','spore'];g.civilization.technology=240;g.space.materials.home=20;
 const ship={id:'freighter',tier:1,island:'home',side:'front',food:4,durability:100,reservedBy:null};g.space.ships.push(ship);assert.equal(loadShipMaterials(g,ship.id,20).ok,true);
 assert.equal(enqueue(g,'voyage','portal',undefined,null,'spore',[],ship.id).ok,true);assert.equal(g.space.materials.spore,undefined);
 cancelAction(g,g.queue[0].id);assert.equal(g.space.cargo.freighter,20);assert.equal(g.space.materials.home,0);assert.equal(enqueue(g,'voyage','portal',undefined,null,'spore',[],ship.id).ok,true);
 const loaded=restore(serialize(g));for(let i=0;i<900;i++)tick(loaded,.1,()=>1);
 assert.equal(loaded.player.island,'spore');assert.equal(loaded.space.materials.spore,20);assert.equal(loaded.space.materials.home,0);assert.equal(loaded.space.cargo.freighter,undefined);assert.ok(restore(serialize(loaded)));
});
