import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,tick,enqueue,restore,serialize,autonomousCandidates} from '../src/simulation.js';
import {autonomyBonus} from '../src/autonomy.js';

function setup(){
 const g=createGame();g.civilization.discoveryPath=['home','spore','city'];g.civilization.technology=240;
 g.civilization.projects.spore.blueprint=300;g.civilization.projects.spore.construction=600;
 g.player.island=g.viewIsland='city';g.player.homeIsland='spore';g.player.x=0;g.player.z=2;
 g.objects=[['portal',0,0],['food',-5,-3],['pod',-2,-3],['shower',2,-3],['lab',5,-3],['music',5,3]].map(([type,x,z])=>({id:`city-${type}`,type,x,z,island:'city',side:'front',rotation:0}));
 for(const n of Object.values(g.npcs))n.ai.enabled=false;
 for(const key in g.needs){g.needs[key]=80;g.config.needDecay[key]=0;}
 g.space.ships=[{id:'return-ship',tier:2,island:'city',side:'front',food:10,durability:100,reservedBy:null}];
 g.player.preferences={explore:10,research:10,dance:20};g.autonomy.enabled=true;g.autonomy.cooldown=0;return g;
}
const person=g=>({id:'player',position:g.player,skills:g.skills,needs:g.needs,queue:g.queue,ai:g.autonomy});
const bonus=(g,destinationId='spore',type='voyage')=>autonomyBonus(g,person(g),{type,targetId:'city-portal',destinationId},[person(g)]);

test('unfinished islands encourage healthy residents to return to their own settled island despite basic facilities',()=>{
 const g=setup();assert.ok(bonus(g)>=50);assert.equal(bonus(g,'home'),null);
 g.civilization.projects.city.blueprint=300;g.civilization.projects.city.construction=600;assert.equal(bonus(g),null);
});

test('return from unfinished islands remains eligible immediately after a voyage, but never duplicates a queued flight',()=>{
 const g=setup();for(const lastAction of ['voyage','starVoyage']){g.autonomy.lastAction=lastAction;assert.ok(bonus(g)>0);assert.ok(bonus(g,'spore','starVoyage')>0);}
 g.queue.push({type:'boardUfo'});assert.equal(bonus(g),null);
});

test('higher return weight still permits other activities rather than forcing departure',()=>{
 const base=setup();let returns=0,other=0;
 for(let i=0;i<40;i++){
  const g=structuredClone(base);tick(g,.1,()=>i/40);
  if(g.queue[0]?.type==='voyage'&&g.queue[0].destinationId==='spore')returns++;
  else if(g.queue.length)other++;
 }
 assert.ok(returns>=10,`return choices: ${returns}`);assert.ok(other>0,`other choices: ${other}`);
});

test('the return preference does not interrupt an existing manual activity',()=>{
 const g=setup();assert.equal(enqueue(g,'research','city-lab').ok,true);const id=g.queue[0].id;
 tick(g,.1,()=>0);assert.equal(g.queue[0].id,id);assert.equal(g.queue[0].type,'research');assert.equal(g.player.island,'city');
});

test('a resident can autonomously travel from the main island to their settled island while healthy',()=>{
 const g=setup();g.player.island='home';g.player.homeIsland='city';g.objects.push(...[['portal',-5,3],['food',-2,3],['pod',2,3],['shower',5,3]].map(([type,x,z])=>({id:`home-${type}`,type,x,z,island:'home',side:'front',rotation:0})));
 g.space.ships=[{id:'home-ship',tier:2,island:'home',side:'front',food:10,durability:100,reservedBy:null}];
 assert.ok(bonus(g,'city')>0);
 assert.ok(autonomousCandidates(g,'player').some(q=>q.type==='voyage'&&q.destinationId==='city'));
});

test('loading interim visit records removes abandoned countdown data without moving residents',()=>{
 const g=setup();g.player.islandVisit={island:'city',arrivedAt:100};g.npcs.nova.islandVisit={island:'home',arrivedAt:100};
 const loaded=restore(serialize(g));assert.equal(loaded.player.islandVisit,undefined);assert.equal(loaded.npcs.nova.islandVisit,undefined);assert.equal(loaded.player.island,'city');assert.equal(loaded.player.homeIsland,'spore');assert.equal(loaded.day,g.day);
});
