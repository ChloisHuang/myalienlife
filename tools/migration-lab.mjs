// Behavioural lab for settlement balance.
//
// One simulated day is one game day (clock 8 minutes per tick, 3 ticks a day), so ageing keeps
// its real pace and a long run cannot be mistaken for a population crash. The lab reports where
// residents actually live, where they are settled, how often they move between islands and how
// many one-way moves turn into a new home.
//
// Usage:
//   node tools/migration-lab.mjs --days=180 --seeds=3 --json
//   ORBIT_MIGRATION_DEPART_WEIGHT=2.5 ORBIT_ATTRACTION_SCALE=1 node tools/migration-lab.mjs
import {createGame,tick,ensureStarIsland,canPlace} from '../src/simulation.js';
import {PROJECT_WORK} from '../src/settlements.js';
import {islandCatalog,islandDefinition,populationCapacity} from '../src/civilization.js';
import {generateResidentName} from '../src/genetics.js';
import {NEEDS} from '../src/simulation.js';
import {createPlant,CROPS} from '../src/plants.js';
import {islandOf} from '../src/island.js';

const arg=(name,fallback)=>{const hit=process.argv.find(a=>a.startsWith(`--${name}=`));return hit?Number(hit.slice(name.length+3)):fallback;};
const DAYS=arg('days',180),SEEDS=arg('seeds',3),PEOPLE=arg('people',21),TICKS=arg('ticks',3),AS_JSON=process.argv.includes('--json');
const VIEW=process.argv.find(a=>a.startsWith('--view='))?.slice('--view='.length)??'eva';
export const ISLANDS=['eva','spore','ocean'];

function seededRandom(seed){let state=(seed>>>0)||1;return()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};}

export function scenario(seed,{people=PEOPLE,view=VIEW}={}){
 const g=createGame();g.speed=1;g.civilization.seed=1;
 // Deep-space voyages need technology; a lab world where nobody can sail measures nothing.
 g.civilization.technology=400;g.civilization.knowledge=20000;
 g.config.time.gameMinutesPerRealSecond=8;
 // Real needs by default. ORBIT_LAB_NO_DECAY=1 isolates the relocation logic from survival
 // pressure, so the two effects can be measured separately.
 if(globalThis.process?.env?.ORBIT_LAB_NO_DECAY)for(const key of Object.keys(NEEDS))g.config.needDecay[key]=0;
 for(const id of ISLANDS){
  if(!g.civilization.discoveryPath.includes(id))g.civilization.discoveryPath.push(id);
  g.civilization.visits[id]=1;g.civilization.surveys[id]=0;g.civilization.surveyDays[id]=0;
  if(id!=='eva')g.civilization.projects[id]={...g.civilization.projects[id],blueprint:PROJECT_WORK.blueprint,construction:PROJECT_WORK.construction};
  // Use each island's authored layout. Hand-placing a portal at the origin silently pushed the
  // gate approach into spore/ocean scenery, which blocked every path off those islands.
  if(id==='eva')for(const [type,x,z] of [['portal',0,0],['pod',-5,-3],['food',-2,-3],['shower',2,-3],['lab',5,-3],['garden',5,2],['music',8,5]])
   g.objects.push({id:`home-${type}`,island:'eva',side:'front',type,x,z,rotation:0,...(CROPS[type]?{plant:createPlant()}:{})});
  else ensureStarIsland(g,id);
  for(const type of ['garden','mushroom']){
   if(g.objects.some(o=>islandOf(o)===id&&o.type===type))continue;
   const spot=[[-9,2],[9,2],[-9,-5],[9,-5]].find(([x,z])=>canPlace(g,x,z,'front',id));
   if(spot)g.objects.push({id:`${id}-${type}`,island:id,side:'front',type,x:spot[0],z:spot[1],rotation:0,plant:createPlant()});
  }
  g.space.provisions[id]=48;
  g.space.ships.push({id:`ship-${id}`,tier:3,island:id,side:'front',food:12,durability:100,reservedBy:null});
 }
 // Each island must own a ship, or its residents have no reachable destination at all.
 for(const ship of g.space.ships){const id=ship.id.replace('ship-','');if(ISLANDS.includes(id)){ship.island=id;ship.side='front';}}
 const roster=[...Object.values(g.npcs)],template=structuredClone(roster[0]),used=[g.player.name,...roster.map(person=>person.name)];
 for(let i=0;i<people-1-roster.length;i++){
  const uid=`lab-${seed}-${i}`,name=generateResidentName({uid,preferences:template.preferences},used);used.push(name);
  Object.assign(template,{uid,name,x:0,z:2,money:600,queue:[],parents:[],
   needs:{hunger:80,energy:85,social:78,fun:70,hygiene:82,comfort:78},migrationCooldownUntil:0,lastEnvironmentExperienceDay:0});
  const clone=structuredClone(template);clone.relationships=Object.fromEntries(Object.keys(g.npcs).map(id=>[id,20]));g.npcs[uid]=clone;g.relationships[uid]=20;
 }
 // Start lopsided, the way a played world ends up: balance has to be achieved, not inherited.
 const population=[g.player,...Object.values(g.npcs)];
 population.forEach((person,index)=>{const island=index<population.length*.62?'eva':index<population.length*.85?'spore':'ocean';person.settlementIsland=island;person.island=island;person.side='front';person.x=0;person.z=2;person.migrationCooldownUntil=0;});
 g.viewIsland=view;g.player.island=view;g.player.settlementIsland=view;
 for(const person of Object.values(g.npcs))person.ai.enabled=true;
 g.autonomy.enabled=true;
 return g;
}

const settledCounts=g=>{
 const counts=Object.fromEntries(ISLANDS.map(id=>[id,0]));
 for(const person of [g.player,...Object.values(g.npcs)])if(Object.hasOwn(counts,person.settlementIsland??'eva'))counts[person.settlementIsland??'eva']++;
 return counts;
};
const liveCounts=g=>{
 const counts=Object.fromEntries(ISLANDS.map(id=>[id,0]));
 for(const person of [g.player,...Object.values(g.npcs)])if(person.alive&&Object.hasOwn(counts,person.island??'eva'))counts[person.island??'eva']++;
 return counts;
};
const gini=values=>{
 const sorted=[...values].sort((a,b)=>a-b),total=sorted.reduce((sum,v)=>sum+v,0),n=sorted.length;
 if(!total)return 0;
 return (2*sorted.reduce((sum,v,index)=>sum+v*(index+1),0))/(n*total)-(n+1)/n;
};

export function run({seed,days=DAYS,ticksPerDay=TICKS,people=PEOPLE,view=VIEW}){
 const g=scenario(seed,{people,view}),random=seededRandom(seed*7919+13);
 const startSettled=settledCounts(g);
 const trails=new Map(),moves={},travels={},arrivals={},departures={};
 for(const person of [g.player,...Object.values(g.npcs)])trails.set(person.uid,person.settlementIsland??'eva');
 let migrations=0,trips=0,settleAttempts=0,settleFailures=0;
 const liveTime=Object.fromEntries(ISLANDS.map(id=>[id,0]));let occupied=0;const liveSamples=[];
 const lateTime=Object.fromEntries(ISLANDS.map(id=>[id,0]));let lateDays=0;
 const samples=[];
 const watch=new Map();
 for(const person of [g.player,...Object.values(g.npcs)])watch.set(person.uid,person.island??'eva');
 for(let day=0;day<days;day++){
  for(let i=0;i<ticksPerDay;i++)tick(g,1,random);
  for(const person of [g.player,...Object.values(g.npcs)]){
   const here=person.island??'eva',uid=person.uid;
   if(watch.get(uid)!==here){watch.set(uid,here);trips++;travels[uid]=(travels[uid]??0)+1;arrivals[here]=(arrivals[here]??0)+1;departures[watch.get(uid+'prev')??here]=(departures[watch.get(uid+'prev')??here]??0)+1;}
   watch.set(uid+'prev',here);
   const settled=person.settlementIsland??'eva';
   if(trails.get(uid)!==settled){trails.set(uid,settled);migrations++;moves[uid]=(moves[uid]??0)+1;}
  }
  for(const queue of [g.queue,...Object.values(g.npcs).map(person=>person.queue??[])])
   for(const action of queue)if(action.type==='settleIsland')action.phase==='acting'?settleAttempts++:null;
  const here=liveCounts(g);
  if(day%Math.max(1,Math.floor(days/25))===0)liveSamples.push({day:g.day,...liveCounts(g),last30:JSON.stringify(settledCounts(g))});
  for(const id of ISLANDS){liveTime[id]=(liveTime[id]??0)+here[id];}
  occupied++;
  // The opening days still carry the lopsided starting world; equilibrium is the settled half.
  if(day>=days/2)for(const id of ISLANDS){lateTime[id]=(lateTime[id]??0)+here[id];}
  if(day>=days/2)lateDays++;
  if(day%Math.max(1,Math.floor(days/30))===0)samples.push(gini(ISLANDS.map(id=>settledCounts(g)[id])));
 }
 const settled=settledCounts(g),live=liveCounts(g);
 const values=ISLANDS.map(id=>settled[id]);
 const liveValues=ISLANDS.map(id=>live[id]);
 const population=[g.player,...Object.values(g.npcs)];
 return {
  seed,days,startSettled,settled,live,values,liveValues,
  settledGini:gini(values),liveGini:gini(liveValues),giniTrail:samples,
  liveAverage:Object.fromEntries(ISLANDS.map(id=>[id,Number((liveTime[id]/Math.max(1,occupied)).toFixed(2))])),
  lateAverage:Object.fromEntries(ISLANDS.map(id=>[id,Number((lateTime[id]/Math.max(1,lateDays)).toFixed(2))])),
  lateGini:gini(ISLANDS.map(id=>lateTime[id]/Math.max(1,lateDays))),
  lateMaxShare:Math.max(...ISLANDS.map(id=>lateTime[id]/Math.max(1,lateDays)))/Math.max(.0001,ISLANDS.reduce((sum,id)=>sum+lateTime[id]/Math.max(1,lateDays),0)),
  liveAverageGini:gini(ISLANDS.map(id=>liveTime[id]/Math.max(1,occupied))),
  liveAverageMaxShare:Math.max(...ISLANDS.map(id=>liveTime[id]/Math.max(1,occupied)))/Math.max(1,ISLANDS.reduce((sum,id)=>sum+liveTime[id]/Math.max(1,occupied),0)),
  maxSettledShare:Math.max(...values)/Math.max(1,values.reduce((a,b)=>a+b,0)),
  maxLiveShare:Math.max(...liveValues)/Math.max(1,liveValues.reduce((a,b)=>a+b,0)),
  arrivals,departures,liveSamples,
  migrations,movedPeople:Object.keys(moves).length,repeatMovers:Object.values(moves).filter(count=>count>=2).length,
  trips,travellers:Object.keys(travels).length,repeatTravellers:Object.values(travels).filter(count=>count>=2).length,
  alive:population.filter(person=>person.alive).length,
  capacity:populationCapacity(g)
 };
}

if(AS_JSON||process.argv[1]?.endsWith('migration-lab.mjs')){
 const results=[];
 for(let seed=1;seed<=SEEDS;seed++)results.push(run({seed}));
 const mean=key=>results.reduce((sum,result)=>sum+result[key],0)/results.length;
 const summary={seeds:SEEDS,days:DAYS,people:PEOPLE,ticks:TICKS,
  weights:{depart:Number(process.env.ORBIT_MIGRATION_DEPART_WEIGHT??2.5),target:Number(process.env.ORBIT_MIGRATION_TARGET_WEIGHT??2),cap:Number(process.env.ORBIT_MIGRATION_PRESSURE_CAP??12),radius:Number(process.env.ORBIT_MIGRATION_PRESSURE_RADIUS??3),attraction:Number(process.env.ORBIT_ATTRACTION_SCALE??1),gate:Number(process.env.ORBIT_MIGRATION_MIN_ADVANTAGE??6)},
  startSettled:results[0]?.startSettled,
  settled:results[0]?.settled,settledGini:mean('settledGini'),maxSettledShare:mean('maxSettledShare'),
  live:results[0]?.live,liveGini:mean('liveGini'),maxLiveShare:mean('maxLiveShare'),
  liveAverage:results[0]?.liveAverage,liveAverageGini:mean('liveAverageGini'),liveAverageMaxShare:mean('liveAverageMaxShare'),
  lateAverage:results[0]?.lateAverage,lateGini:mean('lateGini'),lateMaxShare:mean('lateMaxShare'),
  migrations:mean('migrations'),movedPeople:mean('movedPeople'),repeatMovers:mean('repeatMovers'),
  trips:mean('trips'),travellers:mean('travellers'),repeatTravellers:mean('repeatTravellers'),
  alive:mean('alive'),capacity:results[0]?.capacity,
  runs:results};
 console.log(JSON.stringify(summary,AS_JSON?0:1));
}
