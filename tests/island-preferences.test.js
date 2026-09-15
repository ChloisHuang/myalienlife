import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,enqueue,tick,restore,serialize,autonomousCandidates,findPath} from '../src/simulation.js';
import {PROJECT_WORK} from '../src/settlements.js';
import {ensureStarIsland} from '../src/simulation.js';
import {approachPosition} from '../src/characters.js';
import {oceanBlocked} from '../src/ocean-definition.js';
import {fairytaleBlocked} from '../src/fairytale-definition.js';
import {islandOf} from '../src/island.js';
import {autonomyBonus,relocationChance} from '../src/autonomy.js';
import {environmentProfile,environmentFit,migrationPreference,migrationCooldownRemaining,MIGRATION_COOLDOWN_MINUTES,MIGRATION_MIN_ADVANTAGE,populationPressure} from '../src/island-preferences.js';
import {settlementAppeal} from '../src/autonomy.js';

const run=(g,n)=>{for(let i=0;i<n*10;i++)tick(g,.1,()=>0);};
function remoteGame(){
 const g=createGame();g.autonomy.enabled=false;for(const n of Object.values(g.npcs))n.ai.enabled=false;
 g.civilization.discoveryPath=['eva','spore'];g.civilization.visits.spore=1;Object.assign(g.civilization.projects.spore,PROJECT_WORK);
 g.player.island=g.viewIsland='spore';g.player.settlementIsland='eva';g.player.x=0;g.player.z=2;g.config.time.gameMinutesPerRealSecond=2;
 g.objects.push({id:'spore-terminal',type:'constructionTerminal',island:'spore',side:'front',x:3,z:2,rotation:0});
 return g;
}

test('a construction terminal offers the same settlement action on the home island',()=>{
 const g=createGame();g.civilization.discoveryPath=['eva','spore'];g.civilization.visits.spore=1;g.player.settlementIsland='spore';
 g.objects.push({id:'home-terminal',type:'constructionTerminal',island:'eva',side:'front',x:3,z:2,rotation:0});
 assert.equal(enqueue(g,'settleIsland','home-terminal').ok,true);
 run(g,8);
 assert.equal(g.player.settlementIsland,'eva');
 assert.ok(g.player.migrationCooldownUntil-((g.day-1)*1440+g.minute)>MIGRATION_COOLDOWN_MINUTES-20);
});

test('migration preference differs by resident and only a meaningful advantage creates an autonomous candidate',()=>{
 const g=remoteGame();
 const natureLover=g.player;
 natureLover.environmentPreferences={nature:100,community:0,discovery:100,calm:0};
 const quietResident=g.npcs.zig;
 quietResident.island='spore';quietResident.settlementIsland='eva';quietResident.environmentPreferences={nature:10,community:10,discovery:20,calm:100};
 const nature=migrationPreference(natureLover,'spore',environmentProfile('spore'), 'eva',environmentProfile('eva'));
 const quiet=migrationPreference(quietResident,'spore',environmentProfile('spore'), 'eva',environmentProfile('eva'));
 assert.ok(nature.advantage>=MIGRATION_MIN_ADVANTAGE);
 assert.ok(quiet.advantage<MIGRATION_MIN_ADVANTAGE);
 const candidates=autonomousCandidates(g,'player').filter(c=>c.type==='settleIsland');
 assert.equal(candidates.length,1);
});

test('crowding is measured by who is on the island, not by who calls it home',()=>{
 const g=remoteGame();g.player.environmentPreferences={nature:50,community:50,discovery:50,calm:50};
 g.player.settlementIsland='spore';g.civilization.visits.eva=1;
 const person={id:'player',position:g.player,needs:g.needs,skills:g.skills,queue:[],ai:g.autonomy};
 // Everybody here calls a far island home, so a settlement census would see no crowding at all.
 // The resident weighs leaving their own island (spore) for eva, so both are ordinary options.
 const appealWith=(onTarget,onOrigin)=>{
  const people=[person];
  for(let i=0;i<onTarget;i++)people.push({id:`t${i}`,position:{island:'eva',settlementIsland:'ocean'},needs:g.needs,skills:g.skills,queue:[],ai:g.autonomy});
  for(let i=0;i<onOrigin;i++)people.push({id:`o${i}`,position:{island:'spore',settlementIsland:'ocean'},needs:g.needs,skills:g.skills,queue:[],ai:g.autonomy});
  return settlementAppeal(g,person,people,'eva');
 };
 const even=appealWith(4,4);
 assert.ok(even>0,'an even pair of islands still offers a destination');
 assert.ok(appealWith(14,4)<even,'a packed destination scores lower');
 assert.ok(appealWith(4,14)>even,'a packed origin makes leaving more attractive');
});

test('crowding lowers the drive to move onto a packed island and raises the drive to leave one',()=>{
 assert.ok(populationPressure(3,17)<populationPressure(3,3),'a packed home island lowers the bar for leaving');
 assert.ok(populationPressure(17,3)>populationPressure(3,3),'a packed destination raises the bar for arriving');
 assert.ok(populationPressure(17,3)-populationPressure(3,3)>0,'the two effects do not cancel out');
});

test('every island gate is walkable, so residents can always leave where they live',()=>{
 // A gate whose approach point sits inside scenery strands everyone on that island: no voyage
 // candidate can produce a path, and the population silently piles up there instead of spreading.
 const g=createGame();
 for(const id of ['spore','ocean']){if(!g.civilization.discoveryPath.includes(id))g.civilization.discoveryPath.push(id);ensureStarIsland(g,id);}
 for(const id of ['eva','spore','ocean']){
  const gate=g.objects.find(o=>o.type==='portal'&&islandOf(o)===id);
  assert.ok(gate,`${id} has a gate`);
  const approach=approachPosition(gate);
  const blocked=id==='ocean'?oceanBlocked(approach.x,approach.z,.25,'front'):id==='spore'?fairytaleBlocked(approach.x,approach.z,.25,'front'):false;
  assert.equal(blocked,false,`${id} gate approach (${approach.x},${approach.z}) must be walkable`);
  const spot=[[-4,0],[4,0],[0,3],[0,-3]].find(([x,z])=>!g.objects.some(o=>islandOf(o)===id&&o.side==='front'&&Math.hypot(o.x-x,o.z-z)<.9));
  assert.ok(spot,`${id} has a free standing spot`);
  const reachable=findPath(g,{x:spot[0],z:spot[1],island:id,side:'front'},{...approach,island:id,side:'front'});
  assert.ok(reachable,`a resident on ${id} must have a path to its gate`);
 }
});

test('a settlement terminal only offers the island it actually stands on',()=>{
 const g=remoteGame();g.player.island='eva';g.player.settlementIsland='eva';
 g.objects.push({id:'home-terminal',type:'constructionTerminal',island:'eva',side:'front',x:-3,z:2,rotation:0});
 const offers=autonomousCandidates(g,'player').filter(c=>c.type==='settleIsland');
 assert.ok(offers.length>0,'standing on the home island still offers its own terminal');
 assert.ok(offers.every(c=>c.destinationId==='eva'),`candidates must carry their own island: ${JSON.stringify(offers)}`);
});

test('an island is crowded by the residents standing on it, whatever island they call home',()=>{
 const g=remoteGame();g.player.island='eva';g.player.settlementIsland='eva';g.player.environmentPreferences={nature:60,community:50,discovery:50,calm:50};
 for(const key in g.needs)g.needs[key]=80;
 const person={id:'player',position:g.player,needs:g.needs,skills:g.skills,queue:[],ai:g.autonomy};
 const voyageToSpore={type:'voyage',targetId:'home-terminal',destinationId:'spore'};
 const withResidents=(count,home)=>{const people=[person];for(let i=0;i<count;i++)people.push({id:`r${i}`,position:{island:'spore',settlementIsland:home},needs:g.needs,skills:g.skills,queue:[],ai:g.autonomy});return autonomyBonus(g,person,voyageToSpore,people);};
 const empty=withResidents(0,'spore');
 const busy=withResidents(6,'spore');
 assert.ok(busy<empty,`a busier destination should look worse: busy=${busy} empty=${empty}`);
 // The same six people, now calling a different island home, still crowd the island they stand on.
 assert.equal(withResidents(6,'ocean'),busy,'a settlement census on another island must not uncrowd this one');
});

test('experience nudges environmental fit and migration is cooled down after moving',()=>{
 const g=remoteGame();
 g.player.environmentPreferences={nature:100,community:10,discovery:90,calm:20};
 const before=environmentFit(g.player,environmentProfile('spore'));
 g.player.environmentExperience={nature:60,community:0,discovery:30,calm:-20};
 const after=environmentFit(g.player,environmentProfile('spore'));
 assert.ok(after>before);
 g.player.migrationCooldownUntil=(g.day-1)*1440+g.minute+MIGRATION_COOLDOWN_MINUTES;
 const person={id:'player',position:g.player,needs:g.needs,skills:g.skills,queue:[],ai:g.autonomy};
 assert.equal(migrationCooldownRemaining(g.player,(g.day-1)*1440+g.minute),MIGRATION_COOLDOWN_MINUTES);
 assert.equal(autonomyBonus(g,person,{type:'settleIsland',targetId:'spore-terminal'},[person]),null);
 g.player.island='eva';g.objects.push({id:'home-terminal',type:'constructionTerminal',island:'eva',side:'front',x:-3,z:2,rotation:0});
 assert.equal(enqueue(g,'settleIsland','home-terminal').ok,false);
});

test('environment preferences, experience, birthplace and migration cooldown survive reload',()=>{
 const g=remoteGame();g.player.environmentPreferences.nature=91;g.player.environmentExperience.discovery=-12;g.player.lastEnvironmentExperienceDay=4;g.player.migrationCooldownUntil=9000;g.player.settlementIsland='spore';
 const loaded=restore(serialize(g));
 assert.equal(loaded.player.environmentPreferences.nature,91);
 assert.equal(loaded.player.environmentExperience.discovery,-12);
 assert.equal(loaded.player.lastEnvironmentExperienceDay,4);
 assert.equal(loaded.player.migrationCooldownUntil,9000);
 const baby=loaded.npcs.nova;
 assert.equal(baby.settlementIsland,'eva');
});

test('a terminal on the far face of the same island is offered, and the walk crosses the gate',()=>{
 const g=createGame();
 g.player.island='eva';g.player.side='front';g.player.x=0;g.player.z=2;g.player.settlementIsland='spore';
 g.objects.push({id:'back-terminal',type:'constructionTerminal',island:'eva',side:'back',x:3,z:-5,rotation:0});
 // The gate between the two faces is a passage, so an object on the other face is reachable and the
 // action is offered directly instead of waiting for a separate walk roll to reach the gate.
 const offers=autonomousCandidates(g,'player').filter(c=>c.type==='settleIsland');
 assert.equal(offers.length,1,`the far-face terminal must offer settlement: ${JSON.stringify(offers)}`);
 assert.equal(offers[0].destinationId,'eva');
 const path=findPath(g,g.player,{...approachPosition(g.objects.find(o=>o.id==='back-terminal')),island:'eva',side:'back'});
 assert.ok(path?.some(step=>step.gateId),`the route must use the island gate: ${JSON.stringify(path)}`);
});

test('relocation is a probability that rises with appeal and falls with crowding',()=>{
 const g=remoteGame();
 g.player.environmentPreferences={nature:100,community:0,discovery:100,calm:0};
 g.player.island='spore';g.player.settlementIsland='eva';
 const person={id:'player',position:g.player,needs:g.needs,skills:g.skills,queue:[],ai:g.autonomy};
 const people=extra=>[person,...Array.from({length:extra},(_,i)=>({id:`r${i}`,position:{island:'spore',settlementIsland:'ocean'},needs:g.needs,skills:g.skills,queue:[],ai:g.autonomy}))];
 const open=relocationChance(g,person,people(0),'spore');
 const packed=relocationChance(g,person,people(16),'spore');
 assert.ok(open>0&&open<1,`moving must be possible but never certain: ${open}`);
 assert.ok(packed<open,`a packed island is less likely to win the resident: packed=${packed} open=${open}`);
 assert.equal(relocationChance(g,person,people(0),'eva'),0,'the island they already live on is never a move');
});

test('the island underfoot is weighed against the settlement that would be given up',()=>{
 const g=remoteGame();g.player.environmentPreferences={nature:50,community:50,discovery:50,calm:50};
 g.player.island='spore';g.player.settlementIsland='eva';
 const person={id:'player',position:g.player,needs:g.needs,skills:g.skills,queue:[],ai:g.autonomy};
 const appeal=spot=>count=>{
  const people=[person];
  for(let i=0;i<count;i++)people.push({id:`${spot}${i}`,position:{island:spot==='home'?'eva':'spore',settlementIsland:'ocean'},needs:g.needs,skills:g.skills,queue:[],ai:g.autonomy});
  return settlementAppeal(g,person,people,'spore');
 };
 const home=appeal('home'),target=appeal('target');
 assert.ok(home(14)>home(0),'a crowded home island makes the island underfoot more attractive');
 assert.ok(target(14)<target(0),'a crowded destination still scores lower');
});
