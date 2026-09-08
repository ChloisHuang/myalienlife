import test from 'node:test';
import assert from 'node:assert/strict';
import {generateIsland,validIslandBlueprint,BIOMES} from '../src/island-generator.js';
import {createGame,enqueue,tick,restore,serialize} from '../src/simulation.js';
import {contributeCivilization,STAR_ISLANDS} from '../src/civilization.js';
import {createIslandTerrain} from '../src/island-terrain.js';
import {Group} from 'three';

test('seeded generation is reproducible, diverse and valid for all 64 islands',()=>{
 const biomes=new Set(),names=new Set();
 for(let i=0;i<64;i++){const b=generateIsland(20260908,i);assert.deepEqual(b,generateIsland(20260908,i));assert.ok(validIslandBlueprint(b,b.id));biomes.add(b.biome);names.add(b.name);assert.equal(b.layout[0].type,'portal');
  for(const a of b.layout)for(const other of b.layout)if(a!==other)assert.ok(Math.hypot(a.x-other.x,a.z-other.z)>=3);
  assert.ok(b.decor.every(p=>Math.abs(p.x)>=11.8||Math.abs(p.z)>=8));
 }
 assert.equal(names.size,64);assert.equal(biomes.size,Object.keys(BIOMES).length);assert.notDeepEqual(generateIsland(1,0),generateIsland(2,0));
});
test('new exploration generates only remote blueprints and never replaces home furniture or occupants',()=>{
 const g=createGame(),home=structuredClone(g.objects),people=structuredClone(g.player);
 for(let i=0;i<18;i++)contributeCivilization(g,'observe',g.player);
 assert.equal(Object.keys(g.civilization.islands).length,2);assert.deepEqual(g.objects,home);assert.deepEqual(g.player,people);assert.equal(g.civilization.visits['wild-0'],0);
 const loaded=restore(serialize(g));assert.deepEqual(loaded.civilization.islands,g.civilization.islands);assert.deepEqual(loaded.objects,home);
 assert.throws(()=>createIslandTerrain(STAR_ISLANDS.home,new Group()),/固定/);
});
test('generated layouts support arrival, research, saving and return without altering home',()=>{
 const g=createGame();g.autonomy.enabled=false;for(const n of Object.values(g.npcs))n.ai.enabled=false;for(const k in g.config.needDecay)g.config.needDecay[k]=0;g.civilization.seed=20260908;
 for(let i=0;i<12;i++)contributeCivilization(g,'observe',g.player);g.civilization.technology=240;g.skills.science=18;g.space.ships.push({id:'fixture-ufo',tier:3,island:'home',side:'front',food:2,reservedBy:null});g.skills.botany=18;g.player.preferences.garden=10;
 const home=structuredClone(g.objects);assert.equal(enqueue(g,'voyage','portal',undefined,null,'wild-0').ok,true);for(let i=0;i<500;i++)tick(g,.1,()=>0);
 assert.equal(g.player.island,'wild-0');const lab=g.objects.find(o=>o.id==='wild-0-lab');assert.ok(lab);assert.equal(enqueue(g,'research',lab.id).ok,true);for(let i=0;i<400;i++)tick(g,.1,()=>0);assert.equal(g.queue.length,0);
 const loaded=restore(serialize(g));assert.equal(loaded.player.island,'wild-0');assert.deepEqual(loaded.objects.filter(o=>!o.island||o.island==='home').map(o=>({id:o.id,x:o.x,z:o.z,rotation:o.rotation})),home.map(o=>({id:o.id,x:o.x,z:o.z,rotation:o.rotation})));
});

test('detail generation is repeatable for all biomes, animates with simulation time and leaves blueprints untouched',()=>{
 const themes=new Set();for(let index=0;index<64&&themes.size<4;index++){const b=generateIsland(20260908,index);if(themes.has(b.biome))continue;themes.add(b.biome);const before=structuredClone(b),a=createIslandTerrain(b,new Group()),c=createIslandTerrain(b,new Group());
 const signature=root=>{const result=[];root.traverse(n=>{if(n.geometry)result.push([n.type,n.geometry.type,...n.position.toArray(),...n.scale.toArray()]);});return result;};assert.deepEqual(signature(a.root),signature(c.root));assert.deepEqual(b,before);
 const dust=a.root.getObjectByName('drifting-spores'),positions=()=>Array.from(dust.geometry.attributes.position.array);a.update(0);const first=positions();a.update(10);assert.notDeepEqual(positions(),first);const paused=positions();a.update(10);assert.deepEqual(positions(),paused);assert.ok(positions().every(Number.isFinite));a.dispose();c.dispose();}
 assert.equal(themes.size,4);
});
test('new generation varies building clearings across seeds and supports version one saved outlines',()=>{
 const layouts=new Set();for(let seed=0;seed<30;seed++){const b=generateIsland(seed,0);layouts.add(JSON.stringify(b.layout));assert.ok(validIslandBlueprint(b,b.id));}assert.equal(layouts.size,30);
 const old=generateIsland(17,0);old.generationVersion=1;old.decor=old.decor.slice(0,26);const before=structuredClone(old);assert.ok(validIslandBlueprint(old,old.id));const terrain=createIslandTerrain(old,new Group());terrain.dispose();assert.deepEqual(old,before);
});
