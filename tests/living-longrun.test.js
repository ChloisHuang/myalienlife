import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,ensureStarIsland,tick,serialize,restore,buyItem} from '../src/simulation.js';
import {livingPeople,livingResident,mutableResident,changeBond} from '../src/living-state.js';

test('twenty autonomous days keep distinct lives, bounded state, valid reloads and physical movement',()=>{
 let g=createGame();g.config.time.gameMinutesPerRealSecond=30;g.config.time.starYearDays=100;
 g.civilization.discoveryPath.push('spore');g.civilization.visits.spore=1;Object.assign(g.civilization.projects.spore,{blueprint:300,construction:600});ensureStarIsland(g,'spore');g.space.backs.spore=true;
 Object.assign(g.npcs.nova,{island:'spore',side:'front',x:4,z:2});Object.assign(g.npcs.zig,{island:'spore',side:'back',x:-5,z:-2});
 g.npcs.zig.prayer.nether=10;
 g.npcs.zig.prayer.radiance=10;Object.assign(g.npcs.lumi,{island:'spore',side:'back',x:-4,z:-2});mutableResident(g,g.npcs.lumi).fear=75;
 changeBond(g,g.npcs.zig,g.npcs.lumi,{trust:35});changeBond(g,g.npcs.lumi,g.npcs.zig,{trust:35});
 Object.assign(mutableResident(g,g.npcs.nova),{garden:40,charge:40});buyItem(g,'spiritTree',3,3);g.player.age=65;g.needs.energy=30;
 let seed=7321;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const visited=new Map(),actions=new Set(),startDay=g.day;let maxBytes=0,reloads=0;
 while(g.day<startDay+20){
  const day=g.day;tick(g,1,random);g.log=[];
  for(const p of livingPeople(g)){if(!visited.has(p.uid))visited.set(p.uid,new Set());visited.get(p.uid).add(`${p.island}:${p.side}:${Math.round(p.x)},${Math.round(p.z)}`);const q=(p.uid===g.player.uid?g.queue:p.queue)[0];if(q)actions.add(q.type);const s=livingResident(g,p);assert.ok(s.garden+s.shadow<=100);assert.ok(s.bonds.length<=6);}
  maxBytes=Math.max(maxBytes,JSON.stringify(g.living).length);
  if(day!==g.day){g=restore(serialize(g));reloads++;}
 }
 assert.equal(reloads,20);assert.ok(maxBytes<25000);assert.ok([...visited.values()].filter(v=>v.size>10).length>=3);assert.ok(actions.size>=8);assert.ok(actions.has('seekLight')||actions.has('accompany'));assert.ok(actions.has('treeRest'));
 const adaptations=livingPeople(g).map(p=>livingResident(g,p));assert.ok(new Set(adaptations.map(s=>`${s.garden}:${s.shadow}`)).size>1);
 console.log(JSON.stringify({days:20,reloads,maxLivingBytes:maxBytes,actions:[...actions].sort(),routes:[...visited].map(([uid,cells])=>({uid,cells:cells.size}))}));
});
