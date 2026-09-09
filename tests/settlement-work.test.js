import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,enqueue,tick,restore,serialize,cancelAction} from '../src/simulation.js';
import {PROJECT_WORK} from '../src/settlements.js';
import {autonomyBonus} from '../src/autonomy.js';
function setup(){const g=createGame();g.autonomy.enabled=false;for(const p of Object.values(g.npcs))p.ai.enabled=false;g.player.island=g.viewIsland='spore';g.civilization.visits.spore=1;g.civilization.discoveryPath=['home','spore'];for(const k in g.config.needDecay)g.config.needDecay[k]=0;g.objects.push({id:'bench',type:'lab',island:'spore',side:'front',x:0,z:0,rotation:0});return g;}
test('construction is locked until shared blueprint work is complete',()=>{
 const g=setup();assert.equal(enqueue(g,'constructIsland','bench').ok,false);
 assert.equal(enqueue(g,'developBlueprint','bench').ok,true);for(let i=0;i<150;i++)tick(g,.1,()=>1);
 const project=g.civilization.projects.spore;assert.ok(project.blueprint>0);assert.equal(project.construction,0);
 assert.equal(restore(serialize(g)).civilization.projects.spore.blueprint,project.blueprint);
 g.queue=[];project.blueprint=PROJECT_WORK.blueprint;assert.equal(enqueue(g,'constructIsland','bench').ok,true);
 for(let i=0;i<150;i++)tick(g,.1,()=>1);assert.ok(project.construction>0);
});
test('completed work reveals the nursery once, survives reload, and low needs do not send a resident to planet one',()=>{
 const g=setup(),project=g.civilization.projects.spore;project.blueprint=300;project.construction=599;
 assert.equal(enqueue(g,'constructIsland','bench').ok,true);for(let i=0;i<450;i++)tick(g,.1,()=>1);
 assert.equal(project.construction,600);assert.equal(g.objects.filter(o=>o.type==='nursery'&&o.island==='spore').length,1);
 const loaded=restore(serialize(g));assert.equal(loaded.objects.filter(o=>o.type==='nursery'&&o.island==='spore').length,1);
 loaded.player.homeIsland='spore';loaded.needs.hunger=1;
 const p={id:'player',position:loaded.player,needs:loaded.needs,skills:loaded.skills,queue:[],ai:loaded.autonomy};
 assert.equal(autonomyBonus(loaded,p,{type:'voyage',targetId:'bench',destinationId:'home'},[p]),null);
});
test('canceling blueprint work preserves only the seconds actually worked',()=>{
 const g=setup();enqueue(g,'developBlueprint','bench');for(let i=0;i<100;i++)tick(g,.1,()=>1);
 const progress=g.civilization.projects.spore.blueprint;assert.ok(progress>0&&progress<30);cancelAction(g,g.queue[0].id);
 for(let i=0;i<100;i++)tick(g,.1,()=>1);assert.equal(g.civilization.projects.spore.blueprint,progress);
});
test('either workbench works without profession or scientific level; settlement requires completion',()=>{
 const g=setup();g.skills.science=0;g.career.id='diplomat';g.objects.find(o=>o.id==='bench').type='stove';
 assert.equal(enqueue(g,'developBlueprint','bench').ok,true);g.queue=[];
 assert.equal(enqueue(g,'settleIsland','bench').ok,false);Object.assign(g.civilization.projects.spore,PROJECT_WORK);
 assert.equal(enqueue(g,'settleIsland','bench').ok,true);for(let i=0;i<100;i++)tick(g,.1,()=>1);assert.equal(g.player.homeIsland,'spore');
});
