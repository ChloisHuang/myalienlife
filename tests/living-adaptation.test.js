import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,restore,serialize,ensureStarIsland,enqueue,tick,buyItem} from '../src/simulation.js';
import {mutableResident,mutableSite,changeBond} from '../src/living-state.js';
import {finishLiving,advanceLiving} from '../src/living-world.js';
import {adapt,adaptationCap,practiceToday,fadeAdaptation,awaken} from '../src/living-adaptation.js';
const actors=g=>[{id:'player',position:g.player,needs:g.needs,queue:g.queue},...Object.entries(g.npcs).filter(([id])=>id!==g.controlledId).map(([id,p])=>({id,position:p,needs:p.needs,queue:p.queue}))];
function gardenWorld(){const g=createGame();g.civilization.discoveryPath.push('spore');g.civilization.visits.spore=1;ensureStarIsland(g,'spore');return g;}

test('one day of repeated gardening cannot turn into permanent full adaptation',()=>{
 const g=gardenWorld(),p=g.player;p.island='spore';const o=g.objects.find(o=>o.island==='spore'&&o.plant),person=actors(g)[0];
 for(let i=0;i<100;i++)finishLiving(g,person,{type:'garden'},o,actors(g),{health:90});
 const s=mutableResident(g,p);assert.equal(s.garden,8);assert.equal(s.practice.garden.days,1);assert.equal(s.imprint,null);
});
test('inclination, competing adaptation and disuse prevent universal full forms',()=>{
 const g=createGame(),p=g.player,s=mutableResident(g,p);
 assert.notEqual(adaptationCap(p,'garden'),adaptationCap(g.npcs.nova,'garden'));
 for(let i=0;i<100;i++){adapt(g,p,'garden');adapt(g,p,'shadow');}
 assert.ok(s.garden+s.shadow<=100);assert.ok(s.garden<100&&s.shadow<100);
 g.day=20;fadeAdaptation(g,p,20);assert.equal(s.garden+s.shadow,0);
 s.imprint='bloom';s.garden=60;fadeAdaptation(g,p,20);assert.equal(s.garden,24);assert.equal(s.imprint,'bloom');
});
test('practice is distinct days, missed days reset continuity, and migration invents no awakenings',()=>{
 const g=createGame(),s=mutableResident(g,g.player);assert.equal(practiceToday(g,g.player,'tree'),true);assert.equal(practiceToday(g,g.player,'tree'),false);
 g.day=2;practiceToday(g,g.player,'tree');assert.equal(s.practice.tree.days,2);g.day=5;practiceToday(g,g.player,'tree');assert.equal(s.practice.tree.days,1);
 g.living.version=1;delete s.practice;delete s.imprint;s.garden=100;s.shadow=100;
 const loaded=restore(serialize(g));assert.equal(loaded.living.version,2);assert.equal(loaded.living.residents[g.player.uid].imprint,null);assert.equal(loaded.living.residents[g.player.uid].garden+loaded.living.residents[g.player.uid].shadow,100);
});
test('rescuing a neglected garden with a trusted witness can leave one rare permanent imprint',()=>{
 const g=gardenWorld(),p=g.npcs.nova,other=g.player;p.island=other.island='spore';p.x=other.x=0;p.z=other.z=0;
 const o=g.objects.find(o=>o.island==='spore'&&o.plant);o.x=0;o.z=0;o.plant.health=75;
 const s=mutableResident(g,p);g.day=5;s.garden=60;s.practice.garden={day:4,days:4};changeBond(g,p,other,{trust:25});
 finishLiving(g,actors(g).find(a=>a.id==='nova'),{type:'garden'},o,actors(g),{health:20});
 assert.equal(s.imprint,'bloom');assert.equal(restore(serialize(g)).living.residents[p.uid].imprint,'bloom');
 const second=mutableResident(g,other);second.garden=65;second.practice.garden={day:5,days:7};changeBond(g,other,p,{trust:30});assert.equal(awaken(g,other,'bloom',[p]),false);
});
test('being in the forest is temporary exposure, not a permanent awakening',()=>{
 const g=gardenWorld(),p=g.player;p.island='spore';p.side='back';
 for(let day=1;day<=30;day++){g.day=day;g.minute=600;advanceLiving(g,actors(g));}
 const s=mutableResident(g,p);assert.equal(s.imprint,null);assert.ok(s.shadow<=adaptationCap(p,'shadow'));
 p.island='home';p.side='front';g.day=60;advanceLiving(g,actors(g));assert.equal(s.shadow,0);assert.equal(s.fear,0);
});

test('real completed gardening carries the pre-care crisis through to a witnessed rescue',()=>{
 const g=gardenWorld(),p=g.player;p.preferences.garden=24;g.autonomy.enabled=false;for(const n of Object.values(g.npcs))n.ai.enabled=false;
 const o=g.objects.find(o=>o.island==='spore'&&o.plant);Object.assign(p,{island:'spore',side:'front',x:o.x,z:o.z+1.4});Object.assign(g.npcs.nova,{island:'spore',side:'front',x:o.x+1,z:o.z+1.4});
 g.day=5;Object.assign(mutableResident(g,p),{garden:60,practice:{garden:{day:4,days:4},shadow:{day:0,days:0},tree:{day:0,days:0}}});changeBond(g,p,g.npcs.nova,{trust:25});o.plant.health=20;o.plant.water=90;
 for(let i=0;i<8&&!mutableResident(g,p).imprint;i++){assert.equal(enqueue(g,'garden',o.id).ok,true);for(let t=0;t<250;t++)tick(g,.1,()=>.99);}
 assert.equal(mutableResident(g,p).imprint,'bloom');assert.doesNotThrow(()=>restore(serialize(g)));
});

test('forest guardianship needs helping another frightened resident, not just self-calming',()=>{
 const g=gardenWorld(),p=g.player,b=g.npcs.nova;Object.assign(p,{island:'spore',side:'back'});Object.assign(b,{island:'spore',side:'back'});g.day=5;
 const s=mutableResident(g,p);s.shadow=60;s.fear=10;s.practice.shadow={day:5,days:5};mutableResident(g,b).fear=75;changeBond(g,p,b,{trust:30});
 finishLiving(g,actors(g)[0],{type:'accompany',targetId:'nova'},null,actors(g));assert.equal(s.imprint,'shade');
 g.day=30;p.island='home';fadeAdaptation(g,p,25);assert.equal(s.imprint,'shade');assert.equal(s.shadow,24);
});

test('a roots oath requires sustained care, a recovered tree and two trusted witnesses',()=>{
 const g=createGame(),p=g.player,tree=buyItem(g,'spiritTree',0,4).object;p.prayer.radiance=10;Object.assign(p,{x:0,z:4});
 for(const b of [g.npcs.nova,g.npcs.zig]){Object.assign(b,{x:1,z:4});changeBond(g,p,b,{trust:30});}
 g.day=5;mutableResident(g,p).practice.tree={day:4,days:4};mutableSite(g,tree).vitality=10;
 for(let i=0;i<3;i++)finishLiving(g,actors(g)[0],{type:'tendTree'},tree,actors(g));
 assert.equal(mutableResident(g,p).imprint,'roots');assert.equal(mutableSite(g,tree).rescue,null);
});

test('self-neglect is not credited as a rescue and invalid v2 metadata is rejected',()=>{
 const g=gardenWorld(),p=g.player,o=g.objects.find(o=>o.island==='spore'&&o.plant);p.island='spore';mutableSite(g,o).keeper=p.uid;
 finishLiving(g,actors(g)[0],{type:'garden'},o,actors(g),{health:20});assert.equal(mutableSite(g,o).rescue,null);
 const invalid=structuredClone(g);mutableResident(invalid,invalid.player).practice.garden.days=100;assert.throws(()=>restore(serialize(invalid)));
});
