import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,tick,enqueue,cancelAction,restore,serialize,switchControl} from '../src/simulation.js';
import {loadConstructionCargo} from '../src/space-logistics.js';

function setup(tier=2){
 const g=createGame();g.autonomy.enabled=false;
 for(const n of Object.values(g.npcs)){n.ai.enabled=false;n.side='back';}
 for(const key in g.needs){g.needs[key]=90;g.config.needDecay[key]=0;}
 g.civilization.discoveryPath=['home','spore'];g.civilization.technology=240;
 g.space.materials.home=80;g.space.ships=[{id:'freighter',tier,island:'home',side:'front',food:10,durability:100,reservedBy:null}];return g;
}
function until(g,condition,steps=1000){for(let i=0;i<steps&&!condition();i++)tick(g,.1,()=>0);assert.ok(condition(),'simulation reached expected state');}
function arrange(g,ai=true){assert.equal(enqueue(g,'voyage','portal',undefined,null,'spore',[],'freighter').ok,true);if(ai)g.queue[0].source='ai';}

test('autonomous flight loads construction materials, delivers them, and an architect builds without manual loading',()=>{
 const g=setup();g.career.id='architect';g.player.preferences={voyage:100};g.autonomy.enabled=true;
 tick(g,.1,()=>0);assert.equal(g.queue[0].type,'voyage');assert.equal(g.queue[0].source,'ai');g.autonomy.enabled=false;
 until(g,()=>g.queue[0]?.phase==='acting');assert.equal(g.space.cargo.freighter,60);assert.equal(g.space.materials.home,20);
 const loaded=restore(serialize(g));until(loaded,()=>loaded.player.island==='spore');assert.equal(loaded.space.materials.spore,60);assert.equal(loaded.space.cargo.freighter,undefined);
 loaded.player.preferences={developBlueprint:100,constructIsland:100};loaded.autonomy.enabled=true;loaded.autonomy.cooldown=0;
 until(loaded,()=>loaded.civilization.projects.spore.construction===600,25000);
 assert.equal(loaded.civilization.projects.spore.blueprint,300);assert.equal(loaded.space.materials.spore,0);
});

test('automatic loading respects capacity and leaves material transactions conserved',()=>{
 const g=setup(1);arrange(g);until(g,()=>g.queue[0]?.phase==='acting');assert.equal(g.space.cargo.freighter,20);assert.equal(g.space.materials.home,60);
 cancelAction(g,g.queue[0].id);assert.equal(g.space.cargo.freighter,20);arrange(g);until(g,()=>g.queue[0]?.phase==='acting');assert.equal(g.space.cargo.freighter,20);assert.equal(g.space.materials.home,60);
});

test('only the unpaid construction deficit is shipped, accounting for destination stock and existing cargo',()=>{
 const g=setup();g.civilization.projects.spore.blueprint=300;g.civilization.projects.spore.construction=501;
 g.space.materials.spore=4;g.space.cargo.freighter=2;arrange(g);until(g,()=>g.queue[0]?.phase==='acting');
 assert.equal(g.space.cargo.freighter,5);assert.equal(g.space.materials.home,77);
});

test('manual flights and completed destinations do not automatically take materials',()=>{
 for(const completed of [false,true]){const g=setup();if(completed){g.civilization.projects.spore.blueprint=300;g.civilization.projects.spore.construction=600;}arrange(g,completed);until(g,()=>g.queue[0]?.phase==='acting');assert.equal(g.space.cargo.freighter,undefined);assert.equal(g.space.materials.home,80);}
});

test('canceling before departure never takes building materials from storage',()=>{
 const g=setup();arrange(g);cancelAction(g,g.queue[0].id);assert.equal(g.space.cargo.freighter,undefined);assert.equal(g.space.materials.home,80);
});

test('an NPC pilot can load local materials while the controlled resident is elsewhere',()=>{
 const g=setup();arrange(g);switchControl(g,'nova');assert.equal(g.player.side,'back');
 until(g,()=>g.npcs.kai.queue[0]?.phase==='acting');assert.equal(g.space.cargo.freighter,60);assert.equal(g.space.materials.home,20);
});

test('other reserved inbound cargo prevents duplicate supply, and canceled shipments release that demand',()=>{
 const g=setup();arrange(g);const q=g.queue[0];
 g.space.ships.push({id:'inbound',tier:2,island:'home',side:'front',food:4,durability:100,reservedBy:999});
 g.npcs.nova.queue=[{id:999,type:'voyage',source:'manual',shipId:'inbound',destinationId:'spore'}];g.space.cargo.inbound=50;
 assert.equal(loadConstructionCargo(g,q),10);assert.equal(loadConstructionCargo(g,q),0);
 g.npcs.nova.queue=[];g.space.ships[1].reservedBy=null;
 assert.equal(loadConstructionCargo(g,q),50);assert.equal(g.space.cargo.freighter,60);assert.equal(g.space.materials.home,20);
});

test('automatic shipping uses only stock beyond the departure islands own unfinished construction needs',()=>{
 const g=setup();arrange(g);g.civilization.projects.city.blueprint=300;g.civilization.projects.city.construction=401;
 g.space.ships[0].island='city';g.space.materials.city=25;
 assert.equal(loadConstructionCargo(g,g.queue[0]),6);assert.equal(g.space.materials.city,19);assert.equal(g.space.cargo.freighter,6);
 assert.equal(loadConstructionCargo(g,g.queue[0]),0);
});

test('missing stock does not create cargo or prevent an otherwise valid flight',()=>{
 const g=setup();g.space.materials={};arrange(g);until(g,()=>g.player.island==='spore');
 assert.deepEqual(g.space.cargo,{});assert.deepEqual(g.space.materials,{});
});
