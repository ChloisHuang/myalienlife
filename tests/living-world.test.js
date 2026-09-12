import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,buyItem,sellItem,enqueue,tick,serialize,restore,switchControl,ensureStarIsland,cancelAction,autonomousCandidates} from '../src/simulation.js';
import {changeBond,bondTo,mutableResident,mutableSite,validLiving,LIVING_LIMITS} from '../src/living-state.js';
import {livingBonus,relationLabel,advanceLiving} from '../src/living-world.js';
import {canBlinkTo} from '../src/nether-blink.js';
import patch from 'fast-json-patch';

function quiet(){
 const g=createGame();g.autonomy.enabled=false;for(const n of Object.values(g.npcs))n.ai.enabled=false;
 return g;
}
function run(g,seconds){for(let i=0;i<seconds*10;i++)tick(g,.1,()=>.99);}

test('living state is versioned, compact, and migrates v22 without changing residents',()=>{
 const g=quiet();assert.equal(g.living?.version,2);
 const old=structuredClone(g);old.version=22;delete old.living;
 const loaded=restore(JSON.stringify(old));assert.equal(loaded.version,25);
 assert.deepEqual(loaded.living,g.living);assert.equal(loaded.player.uid,g.player.uid);
 assert.ok(JSON.stringify(loaded.living).length<100);
});

test('v22 unused ocean metadata becomes an empty authored ocean project without losing built progress',()=>{
 const g=quiet();g.version=22;delete g.living;
 const c=g.civilization;c.projects.ocean=structuredClone(c.projects.spore);
 for(const key of ['visits','surveys','surveyDays'])c[key].ocean=0;
 c.projects.spore.blueprint=300;c.projects.spore.construction=600;
 const loaded=restore(serialize(g));
 assert.equal(loaded.civilization.projects.spore.construction,600);
 assert.equal(loaded.civilization.projects.ocean.construction,0);
 for(const key of ['visits','surveys','surveyDays'])assert.equal(loaded.civilization[key].ocean,0);
 c.visits.ocean=1;assert.throws(()=>restore(serialize(g)),/不兼容/);
});

test('tree care restores shared vitality and prayer spends it only on completion',()=>{
 const g=quiet(),tree=buyItem(g,'spiritTree',0,4).object;
 assert.equal(enqueue(g,'tendTree',tree.id).ok,true);run(g,40);
 assert.equal(g.living.sites[tree.id].vitality,100);
 assert.equal(g.living.sites[tree.id].keeper,g.player.uid);
 assert.equal(enqueue(g,'pray',tree.id).ok,true);run(g,25);
 assert.ok(g.living.sites[tree.id].vitality<100);
 const before=g.living.sites[tree.id].vitality;
 assert.equal(enqueue(g,'tendTree',tree.id).ok,true);run(g,35);
 assert.ok(g.living.sites[tree.id].vitality>before);
 assert.deepEqual(restore(serialize(g)).living,g.living);
});

test('only tending the real fairytale garden develops persistent botanical affinity',()=>{
 const g=quiet();g.civilization.discoveryPath.push('spore');g.civilization.visits.spore=1;ensureStarIsland(g,'spore');
 const garden=g.objects.find(o=>o.island==='spore'&&o.plant);
 assert.ok(garden);Object.assign(g.player,{island:'spore',side:'front',x:garden.x,z:garden.z+1.4});g.viewIsland='spore';
 assert.equal(enqueue(g,'garden',garden.id).ok,true);run(g,20);
 assert.ok(g.living.residents[g.player.uid].garden>0);
 const before=g.living.residents[g.player.uid].garden;
 Object.assign(g.player,{island:'home',side:'front',x:7,z:4.4});g.viewIsland='home';
 enqueue(g,'garden','garden');run(g,20);
 assert.equal(g.living.residents[g.player.uid].garden,before);
});

test('forest exposure changes residents but pauses do not advance it',()=>{
 const g=quiet();g.civilization.discoveryPath.push('spore');g.civilization.visits.spore=1;ensureStarIsland(g,'spore');g.space.backs.spore=true;
 Object.assign(g.player,{island:'spore',side:'back',x:0,z:2});g.viewIsland='spore';g.viewSide='back';
 run(g,40);assert.ok(g.living.residents[g.player.uid].shadow>0);assert.ok(g.living.residents[g.player.uid].fear>0);
 g.speed=0;const before=serialize(g);tick(g,100);assert.equal(serialize(g),before);
 const uid=g.player.uid;assert.equal(switchControl(g,'nova').ok,true);
 assert.deepEqual(restore(serialize(g)).living.residents[uid],g.living.residents[uid]);
});

test('resentment can coexist with dependence and apology changes a real relationship',()=>{
 const g=quiet(),other=g.npcs.nova;
 changeBond(g,other,g.player,{trust:30,resentment:40,dependence:25});
 assert.equal(relationLabel(g,other,g.player),'依赖却有怨气');
 assert.equal(enqueue(g,'reconcile','nova').ok,true);run(g,25);
 assert.ok(bondTo(g,other,g.player).resentment<40);
 assert.ok(bondTo(g,other,g.player).trust>30);
 assert.equal(enqueue(g,'confront','nova').ok,false,'cannot manufacture conflict without cause');
});

test('light support requires a real awakened resident and changes fear and dependency',()=>{
 const g=quiet(),n=g.npcs.nova;mutableResident(g,n).fear=70;
 assert.equal(enqueue(g,'shareLight','nova').ok,false);
 g.player.prayer.radiance=10;
 assert.equal(enqueue(g,'shareLight','nova').ok,true);run(g,25);
 assert.ok(bondTo(g,n,g.player).dependence>0);assert.ok(g.living.residents[n.uid].fear<70);
});

test('dual light mode and choosing to accompany someone suspend blinking, not racial identity',()=>{
 const g=quiet();g.player.prayer.radiance=10;g.player.prayer.nether=10;
 const target={x:6,z:5,island:'home',side:'front'},s=mutableResident(g,g.player);
 s.mode='light';assert.equal(canBlinkTo(g,g.player,target),false);
 s.mode='shadow';assert.equal(canBlinkTo(g,g.player,target),true);
 assert.equal(enqueue(g,'accompany','nova').ok,true);
 assert.equal(canBlinkTo(g,g.player,target),false);
 assert.equal(g.player.prayer.nether,10);
});

test('tree resource and resentment are not charged for cancellation',()=>{
 const g=quiet(),tree=buyItem(g,'spiritTree',0,4).object;
 const site=mutableSite(g,tree);site.vitality=30;site.keeper=g.npcs.nova.uid;
 Object.assign(g.npcs.nova,{x:1,z:4});
 enqueue(g,'pray',tree.id);cancelAction(g,g.queue[0].id);
 assert.equal(site.vitality,30);assert.equal(bondTo(g,g.npcs.nova,g.player),undefined);
 enqueue(g,'pray',tree.id);run(g,22);
 assert.ok(bondTo(g,g.npcs.nova,g.player).resentment>0);
});

test('sold sites are removed immediately, invalid or oversized state is rejected',()=>{
 const g=quiet(),tree=buyItem(g,'spiritTree',0,4).object;mutableSite(g,tree);
 assert.equal(sellItem(g,tree.id),true);assert.equal(g.living.sites[tree.id],undefined);
 assert.doesNotThrow(()=>restore(serialize(g)));
 for(const corrupt of [s=>s.fear=-1,s=>s.shadow=2.5,s=>s.bonds.push({uid:'missing',trust:0,resentment:0,dependence:0}),s=>s.history=Array(1000).fill('unused')]){
  const invalid=structuredClone(g);corrupt(mutableResident(invalid,invalid.player));assert.throws(()=>restore(JSON.stringify(invalid)));
 }
});

test('relationships are bounded, integer and independent of selected control slot',()=>{
 const g=quiet();
 for(let i=0;i<40;i++){
  const p=structuredClone(g.npcs.nova);p.uid=`test-${i}`;g.npcs[p.uid]=p;
  changeBond(g,g.player,p,{trust:500,resentment:7});
 }
 const s=g.living.residents[g.player.uid];assert.equal(s.bonds.length,LIVING_LIMITS.bonds);
 assert.equal(validLiving(g),true);assert.ok(JSON.stringify(s).length<800);
});

test('new candidates include repair and sympathy, but refuse unrelated sites and unsafe targets',()=>{
 const g=quiet(),tree=buyItem(g,'spiritTree',0,4).object;
 mutableSite(g,tree).vitality=20;
 const candidates=autonomousCandidates(g,'player');assert.ok(candidates.some(c=>c.type==='tendTree'&&c.targetId===tree.id));
 assert.equal(enqueue(g,'tendTree','lab').ok,false);
 assert.equal(enqueue(g,'listenForest','portal').ok,false);
 const p={id:'player',position:g.player,needs:g.needs},others=[p,{id:'nova',position:g.npcs.nova,needs:g.npcs.nova.needs}];
 changeBond(g,g.player,g.npcs.nova,{trust:20,resentment:60});
 assert.ok(livingBonus(g,p,{type:'chat',targetId:'nova'},others)<0);
});

test('idle frame replication does not write living floats, histories or animation data',()=>{
 const g=quiet(),before=structuredClone(g);tick(g,.1);
 assert.deepEqual(g.living,before.living);
 assert.equal(patch.compare(before,g).filter(op=>op.path.startsWith('/living')).length,0);
});

test('queued living interactions still address the same person after switching control',()=>{
 const g=quiet();changeBond(g,g.npcs.nova,g.player,{trust:30,resentment:40});
 enqueue(g,'reconcile','nova');const uid=g.player.uid;
 switchControl(g,'nova');g.autonomy.enabled=false;g.npcs[uid].ai.enabled=false;
 assert.doesNotThrow(()=>restore(serialize(g)));
 run(g,30);assert.ok(bondTo(g,g.player,g.npcs[uid]).resentment<40);
});

test('an NPC living interaction can address the controlled resident and survive a save mid-action',()=>{
 const g=quiet();changeBond(g,g.player,g.npcs.nova,{resentment:30});
 enqueue(g,'accompany','nova');const q=g.queue.shift();q.type='reconcile';q.targetId='player';g.npcs.nova.queue.push(q);
 assert.doesNotThrow(()=>restore(serialize(g)));run(g,30);
 assert.ok(bondTo(g,g.player,g.npcs.nova).resentment<30);
});
