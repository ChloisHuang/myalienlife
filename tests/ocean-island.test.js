import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,serialize,restore,ensureStarIsland,ITEMS,buyItem,canPlace,enqueue,tick} from '../src/simulation.js';
import {STAR_ISLANDS,discoverAdjacentIsland} from '../src/civilization.js';
import {localToWorld,groundHeight,approachPosition} from '../src/characters.js';
import {OCEAN_LAYOUT} from '../src/ocean-definition.js';

test('all ocean facility entrances face the traversable interior',()=>{
 for(const object of OCEAN_LAYOUT){
  const p=approachPosition({...object,island:'ocean',side:'front'});
  assert.ok(Math.abs(p.x)<=11&&Math.abs(p.z)<=7,`${object.type} entrance outside walking bounds: ${p.x}, ${p.z}`);
 }
});

test('normal gameplay discovers, visits, builds and settles ocean without the preview save',()=>{
 let g=createGame();g.autonomy.enabled=false;
 for(const person of Object.values(g.npcs))person.ai.enabled=false;
 for(const key in g.config.needDecay)g.config.needDecay[key]=0;
 g.civilization.technology=120;
 g.space.ships.push({id:'release-voyage',tier:2,island:'home',side:'front',food:0,durability:100,reservedBy:null});
 const act=(type,target,destination=null)=>{
  const result=enqueue(g,type,target,undefined,null,destination);assert.equal(result.ok,true,result.message);
  for(let i=0;i<3000&&g.queue.length;i++)tick(g,.1,()=>0);
  assert.equal(g.queue.length,0,`${type} must finish through the normal action queue`);
 };
 for(let i=0;i<3;i++)act('explore','portal');
 assert.deepEqual(g.civilization.discoveryPath,['home','spore']);
 act('voyage','portal','spore');act('explore','spore-portal');
 assert.deepEqual(g.civilization.discoveryPath,['home','spore','ocean']);
 act('voyage','spore-portal','ocean');
 assert.equal(g.player.island,'ocean');assert.equal(g.viewIsland,'ocean');
 assert.equal(g.civilization.visits.ocean,1);
 const project=g.civilization.projects.ocean;
 assert.equal(project.construction,0);assert.equal(g.space.backs.ocean,undefined);
 g.career.id='architect';g.space.materials.ocean=60;
 for(let i=0;i<30&&project.blueprint<300;i++)act('developBlueprint','ocean-blueprintTable');
 assert.equal(project.blueprint,300);
 for(let i=0;i<60&&project.construction<600;i++)act('constructIsland','ocean-constructionTerminal');
 assert.equal(project.construction,600);assert.equal(g.space.materials.ocean,0);
 act('settleIsland','ocean-constructionTerminal');assert.equal(g.player.homeIsland,'ocean');
 g.player.prayer.nether=10;g.autonomy.enabled=true;g.autonomy.cooldown=0;g.autonomy.lastWorkDay=g.day;
 for(const key in g.needs)g.needs[key]=90;
 g.player.preferences.explore=100;
 for(let i=0;i<300&&!g.space.backs.ocean;i++)tick(g,.1,()=>0);
 assert.equal(g.space.backs.ocean,true);
 g.autonomy.enabled=false;
 for(let i=0;i<3000&&g.queue.length;i++)tick(g,.1,()=>0);
 assert.equal(g.player.side,'back');
 assert.equal(buyItem(g,'oceanPearlLamp',-3,4).ok,true);
 g=restore(serialize(g));assert.equal(g.player.homeIsland,'ocean');
 assert.equal(g.space.backs.ocean,true);assert.equal(g.civilization.projects.ocean.construction,600);
 act('research','ocean-lab');assert.equal(g.player.side,'front');
 act('voyage','ocean-portal','home');assert.equal(g.player.island,'home',JSON.stringify(g.log.slice(0,3)));
});

test('restoring ocean updates authored furniture without moving purchased objects',()=>{
 const g=createGame();g.civilization.discoveryPath.push('spore','ocean');g.civilization.visits.ocean=1;ensureStarIsland(g,'ocean');
 g.viewIsland='ocean';assert.equal(buyItem(g,'oceanPearlLamp',0,-2).ok,true);
 const purchased=structuredClone(g.objects.find(o=>o.type==='oceanPearlLamp'));
 const food=g.objects.find(o=>o.id==='ocean-food');food.x=-4;food.z=-2.7;
 const loaded=restore(serialize(g));
 const spot=OCEAN_LAYOUT.find(o=>o.type==='food');
 assert.equal(loaded.objects.find(o=>o.id===food.id).x,spot.x);
 assert.equal(loaded.objects.find(o=>o.id===food.id).z,spot.z);
 assert.deepEqual(loaded.objects.find(o=>o.id===purchased.id),purchased);
});

test('ocean is a fixed authored theme with a separate purchasable item pack',()=>{
 assert.equal(STAR_ISLANDS.ocean?.theme,'ocean');
 assert.equal(STAR_ISLANDS.ocean.name,'珊瑚浅湾');
 const pack=ITEMS.filter(i=>i.pack==='珊瑚浅湾');
 assert.deepEqual(pack.map(i=>i.id),['oceanPearlLamp','oceanShellPlanter','oceanBubbleMobile']);
 assert.ok(!ITEMS.some(i=>['ocean-palace','ocean-lighthouse','ocean-wreck'].includes(i.id)));
});
test('ocean is discovered after the visited story island, not pre-unlocked',()=>{
 const g=createGame();assert.ok(!g.civilization.discoveryPath.includes('ocean'));
 g.civilization.discoveryPath.push('spore');g.civilization.visits.spore=1;g.civilization.observations=4;
 assert.equal(discoverAdjacentIsland(g,'spore')?.theme,'ocean');
 assert.equal(restore(serialize(g)).civilization.discoveryPath.at(-1),'ocean');
});
test('v24 migration adds only empty ocean bookkeeping and preserves existing world',()=>{
 const g=createGame();g.version=24;
 for(const key of ['projects','visits','surveys','surveyDays'])delete g.civilization[key].ocean;
 const objects=structuredClone(g.objects),money=g.money;
 const loaded=restore(serialize(g));assert.equal(loaded.version,25);
 assert.equal(loaded.civilization.projects.ocean.construction,0);
 assert.deepEqual(loaded.objects,objects);assert.equal(loaded.money,money);
 assert.deepEqual(loaded.civilization.discoveryPath,['home']);
 assert.equal(serialize(restore(serialize(loaded))),serialize(loaded));
});
test('ocean facilities survive saves; scenery excludes placement but underwater floor remains buildable',()=>{
 const g=createGame();g.civilization.discoveryPath.push('spore','ocean');g.civilization.visits.ocean=1;
 g.space.backs.ocean=true;g.viewIsland='ocean';ensureStarIsland(g,'ocean');
 assert.ok(g.objects.filter(o=>o.island==='ocean').length>=8);
 assert.equal(canPlace(g,7,-6,'back','ocean'),false);
 assert.equal(canPlace(g,0,1.2,'front','ocean'),false);
 g.viewSide='back';assert.equal(buyItem(g,'oceanPearlLamp',-3,4).ok,true);
 assert.equal(restore(serialize(g)).viewIsland,'ocean');
});

test('shell-bed pose follows its raised beach foundation instead of sinking into the terrain',()=>{
 const bed={type:'pod',island:'ocean',side:'front',x:-10.5,z:1.6,rotation:0};
 assert.equal(localToWorld(bed,[0,.99,0]).y,groundHeight(bed.x,bed.z,'front','ocean')+.99);
});
