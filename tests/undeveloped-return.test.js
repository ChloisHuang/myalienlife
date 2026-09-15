import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,tick,enqueue,restore,serialize,autonomousCandidates} from '../src/simulation.js';
import {autonomyBonus} from '../src/autonomy.js';
import {generateIsland} from '../src/island-generator.js';
import {createProject} from '../src/settlements.js';

function setup(){
 const g=createGame();g.civilization.seed=1;g.civilization.discoveryPath=['eva','spore'];g.civilization.technology=240;
 g.civilization.projects.spore.blueprint=300;g.civilization.projects.spore.construction=600;const island=generateIsland(g.civilization.seed,0);g.civilization.islands[island.id]=island;g.civilization.discoveryPath.push(island.id);g.civilization.visits[island.id]=1;g.civilization.surveys[island.id]=0;g.civilization.surveyDays[island.id]=0;g.civilization.projects[island.id]=createProject(g.civilization.seed);
 g.player.island=g.viewIsland=island.id;g.player.settlementIsland='spore';g.player.x=0;g.player.z=2;
 g.objects=[['portal',0,0],['food',-5,-3],['pod',-2,-3],['shower',2,-3],['lab',5,-3],['music',5,3]].map(([type,x,z])=>({id:`${island.id}-${type}`,type,x,z,island:island.id,side:'front',rotation:0}));
 for(const n of Object.values(g.npcs))n.ai.enabled=false;
 for(const key in g.needs){g.needs[key]=80;g.config.needDecay[key]=0;}
 g.space.ships=[{id:'return-ship',tier:3,island:'wild-0',side:'front',food:10,durability:100,reservedBy:null}];
 g.player.preferences={explore:10,research:10,dance:20};g.autonomy.enabled=true;g.autonomy.cooldown=0;return g;
}
const person=g=>({id:'player',position:g.player,skills:g.skills,needs:g.needs,queue:g.queue,ai:g.autonomy});
const bonus=(g,destinationId='spore',type='voyage')=>autonomyBonus(g,person(g),{type,targetId:'wild-0-portal',destinationId},[person(g)]);
const residents=g=>Object.entries(g.npcs).map(([id,n])=>({id,position:n,needs:n.needs,skills:n.skills,queue:n.queue,ai:n.ai}));
const withBonds=(g,destinationId='spore')=>autonomyBonus(g,person(g),{type:'voyage',targetId:'wild-0-portal',destinationId},[person(g),...residents(g)]);

test('unfinished islands encourage healthy residents to return to their own settled island despite basic facilities',()=>{
 const g=setup();const encouraged=bonus(g);assert.ok(encouraged>=50);assert.equal(bonus(g,'eva'),null);
 g.civilization.projects['wild-0'].blueprint=300;g.civilization.projects['wild-0'].construction=600;
 // A finished island drops the strong pull; only the gentler self-driven homesick wish may remain.
 const settled=bonus(g);assert.ok(settled===null||settled<=20,`settled=${settled} encouraged=${encouraged}`);
});
test('homesickness comes from family, deep bonds and a better-fitting home island, while the critical return stays hard',()=>{
 const g=setup(),project=g.civilization.projects['wild-0'];project.blueprint=300;project.construction=600;
 const flat={nature:50,community:50,discovery:50,calm:50},fitting={nature:75,community:40,discovery:85,calm:35};
 g.player.environmentPreferences={...flat};
 assert.equal(withBonds(g),null);
 g.player.parents=[{uid:'lumi',name:'露米'}];g.npcs.lumi.island='spore';assert.ok(withBonds(g)>0,'living family on the home island');
 g.player.parents=[];g.npcs.lumi.island='wild-0';g.relationships.lumi=80;assert.equal(withBonds(g),null,'a bond on another island is not homesickness');
 g.npcs.lumi.island='spore';assert.ok(withBonds(g)>0,'a deep bond on the home island');
 g.relationships.lumi=20;assert.equal(withBonds(g),null);
 g.player.environmentPreferences={...fitting};assert.ok(withBonds(g)>0,'the home island clearly suits them better');
 g.player.environmentPreferences={...flat};for(const key in g.needs)g.needs[key]=20;assert.equal(withBonds(g),null);
 for(const key in g.needs)g.needs[key]=10;assert.ok(withBonds(g)>=36,'a critical need still forces the return');
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
 const g=setup();assert.equal(enqueue(g,'research','wild-0-lab').ok,true);const id=g.queue[0].id;
 tick(g,.1,()=>0);assert.equal(g.queue[0].id,id);assert.equal(g.queue[0].type,'research');assert.equal(g.player.island,'wild-0');
});

test('a resident visiting another island can autonomously sail back to their settled island while healthy',()=>{
 // The point is the way home: a healthy resident who is away should be able to return to their
 // own settlement, whichever island that happens to be.
 const g=setup();g.player.island='spore';g.player.settlementIsland='wild-0';g.player.x=0;g.player.z=2;
 g.space.ships=[{id:'spore-ship',tier:3,island:'spore',side:'front',food:10,durability:100,reservedBy:null}];
 assert.equal(bonus(g,'wild-0'),null,'being away is not by itself a reason to sail home');
 for(const key in g.needs)g.needs[key]=10;
 assert.ok(bonus(g,'wild-0')>0,'a critical need still brings a resident home');
 assert.ok(autonomousCandidates(g,'player').some(q=>q.type==='voyage'&&q.destinationId==='wild-0'));
});

test('loading interim visit records removes abandoned countdown data without moving residents',()=>{
 const g=setup();g.player.islandVisit={island:'wild-0',arrivedAt:100};g.npcs.nova.islandVisit={island:'eva',arrivedAt:100};
 const loaded=restore(serialize(g));assert.equal(loaded.player.islandVisit,undefined);assert.equal(loaded.npcs.nova.islandVisit,undefined);assert.equal(loaded.player.island,'wild-0');assert.equal(loaded.player.settlementIsland,'spore');assert.equal(loaded.day,g.day);
});
