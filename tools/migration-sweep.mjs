// Analytic settlement-crowding sweep over a real save.
//
// The behavioural harness in tools/migration-lab.mjs cannot answer this question: to fit years of
// settlement into a short wall-clock run it must accelerate the game clock, which also accelerates
// ageing, so cohorts die of old age long before a population spread can settle. What a real save
// *can* answer exactly is which crowding rule lets a resident move at all, and what equilibrium
// that rule drives, because every resident's environment fit is already recorded in the save.
//
// Usage: node tools/migration-sweep.mjs [--state=.data/orbit-life.json] [--out=.data/migration-sweep.json]
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {restore} from '../src/simulation.js';
import {environmentProfile,environmentFit,MIGRATION_MIN_ADVANTAGE,MIGRATION_PRESSURE_CAP,MIGRATION_PRESSURE_RADIUS} from '../src/island-preferences.js';
import {islandDefinition} from '../src/civilization.js';
import {root} from '../scripts/build-release.js';

const arg=(name,fallback)=>{const hit=process.argv.find(a=>a.startsWith(`--${name}=`));return hit?hit.slice(name.length+3):fallback;};
const STATE=resolve(root,arg('state','.data/orbit-life.json')),OUT=resolve(root,arg('out','.data/migration-sweep.json'));
const ISLANDS=['eva','spore','ocean'];
const crowding=settled=>Math.min(MIGRATION_PRESSURE_CAP,Math.sqrt(Math.max(0,settled-1))*MIGRATION_PRESSURE_RADIUS);

// Each design is "points charged for a crowded destination, points credited for a crowded home
// island". The shipped rule only ever charged the destination.
export const DESIGNS=[
 {id:'shipped',label:'线上现状：只罚目的地 (n-1)*2',legacy:true},
 {id:'C_target_only',label:'只罚目的地 · sqrt 目标2',target:2,depart:0},
 {id:'D_target2_depart1',label:'双向 · 目标2/出发1',target:2,depart:1},
 {id:'E_target2_depart1.5',label:'双向 · 目标2/出发1.5',target:2,depart:1.5},
 {id:'F_target2_depart2',label:'双向 · 目标2/出发2',target:2,depart:2},
 {id:'G_target2_depart2.5',label:'双向 · 目标2/出发2.5（新默认）',target:2,depart:2.5},
 {id:'H_target2_depart3',label:'双向 · 目标2/出发3',target:2,depart:3},
 {id:'I_target0_depart3',label:'只推出 · 出发3',target:0,depart:3},
 {id:'J_target0_depart6',label:'只推出 · 出发6',target:0,depart:6}
];

const raw=JSON.parse(await readFile(STATE,'utf8'));
const g=restore(JSON.stringify(raw.state??raw));
const people=[g.player,...Object.values(g.npcs)];
const profiles=Object.fromEntries(ISLANDS.map(id=>[id,environmentProfile(id,islandDefinition(g,id))]));
const fits=people.map(person=>Object.fromEntries(ISLANDS.map(id=>[id,environmentFit(person,profiles[id])])));
const origins=people.map(person=>person.settlementIsland??'eva');
const names=people.map(person=>person.name);
const charge=(design,targetSettled,originSettled)=>{
 if(design.legacy)return Math.max(0,targetSettled-1)*2;
 return crowding(targetSettled)*(design.target??0)-crowding(originSettled)*(design.depart??0);
};

function evaluate(design){
 const counts=Object.fromEntries(ISLANDS.map(id=>[id,0]));
 for(const origin of origins)counts[origin]++;
 const legal=[];
 for(let index=0;index<people.length;index++){
  for(const target of ISLANDS){
   if(target===origins[index])continue;
   const advantage=fits[index][target]-fits[index][origins[index]];
   const net=advantage-charge(design,counts[target],counts[origins[index]]);
   if(net>=MIGRATION_MIN_ADVANTAGE)legal.push({name:names[index],origin:origins[index],target,advantage,net});
  }
 }
 // Equilibrium: repeatedly take any legal move that actually relieves crowding.
 const live=[...origins],equilibrium=Object.fromEntries(ISLANDS.map(id=>[id,0]));
 for(const origin of live)equilibrium[origin]++;
 const moves=[];
 for(let round=0;round<40;round++){
  let changed=false;
  for(let index=0;index<people.length;index++){
   const origin=live[index];
   let best=null;
   for(const target of ISLANDS){
    if(target===origin)continue;
    const advantage=fits[index][target]-fits[index][origin];
    const net=advantage-charge(design,equilibrium[target],equilibrium[origin]);
    if(net>=MIGRATION_MIN_ADVANTAGE&&(!best||net>best.net))best={target,net};
   }
   if(best&&equilibrium[origin]>equilibrium[best.target]+1.5){
    equilibrium[origin]--;equilibrium[best.target]++;live[index]=best.target;moves.push(`${names[index]}:${origin}->${best.target}`);changed=true;
   }
  }
  if(!changed)break;
 }
 const villages=ISLANDS.map(id=>equilibrium[id]);
 const mean=villages.reduce((a,b)=>a+b,0)/villages.length;
 const variance=villages.reduce((sum,value)=>sum+(value-mean)**2,0)/villages.length;
 return {
  id:design.id,label:design.label,
  charged:Object.fromEntries(ISLANDS.map(id=>[id,Number(charge(design,counts[id],counts[id]).toFixed(2))])),
  legalPairs:legal.length,totalPairs:people.length*2,
  eligiblePeople:new Set(legal.map(row=>row.name)).size,
  moves:moves.length,sampleMoves:moves.slice(0,6),
  equilibrium,variance:Number(variance.toFixed(2))
 };
}

const results=DESIGNS.map(evaluate);
await mkdir(dirname(OUT),{recursive:true});
await writeFile(OUT,JSON.stringify({state:STATE,islands:ISLANDS,variants:results},null,1));

const pad=(value,width)=>String(value).padEnd(width);
const num=(value,width=5)=>String(value).padStart(width);
console.log(`存档 ${STATE}`);
console.log(`起始安居分布 ${JSON.stringify(results[0].equilibrium)} · 阈值 ${MIGRATION_MIN_ADVANTAGE} · 压力封顶 ${MIGRATION_PRESSURE_CAP}\n`);
console.log([pad('方案',26),num('可迁(人,目标)对',14),num('可迁居民',9),num('搬迁次数',9),pad('均衡分布',20),num('方差',7)].join(' '));
for(const result of results){
 console.log([
  pad(result.id,26),num(`${result.legalPairs}/${result.totalPairs}`,14),num(result.eligiblePeople,9),num(result.moves,9),
  pad(JSON.stringify(result.equilibrium),20),num(result.variance,7)
 ].join(' '));
}
console.log('\n样例搬迁：');
for(const result of results)console.log(` ${pad(result.id,26)} ${result.sampleMoves.join(' , ')||'-'}`);
console.log(`\nwrote ${OUT}`);
