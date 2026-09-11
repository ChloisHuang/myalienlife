import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,destroyIsland,enqueue,restore,serialize,tick} from '../src/simulation.js';
import {contributeCivilization,discovered,islandCatalog} from '../src/civilization.js';
import {generateIsland} from '../src/island-generator.js';
import {createProject} from '../src/settlements.js';

function addGenerated(g,index,visited=1){
 const b=generateIsland(g.civilization.seed,index);g.civilization.islands[b.id]=b;g.civilization.discoveryPath.push(b.id);g.civilization.visits[b.id]=visited;g.civilization.surveys[b.id]=0;g.civilization.surveyDays[b.id]=0;g.civilization.projects[b.id]=createProject(g.civilization.seed^index);
}

function chain(){
 const g=createGame();g.civilization.observations=12;g.wonders.archive=3;
 g.civilization.discoveryPath=['home','spore'];
 g.civilization.visits.spore=1;addGenerated(g,0);addGenerated(g,1);
 return g;
}
test('home is protected and deleting a middle island preserves later islands',()=>{
 const g=chain(),before=serialize(g);assert.equal(destroyIsland(g,'home').ok,false);assert.equal(serialize(g),before);
 assert.equal(destroyIsland(g,'spore').ok,true);assert.equal(discovered(g,'spore'),false);assert.equal(islandCatalog(g).spore,undefined);assert.ok(islandCatalog(g)['wild-1']);
 assert.equal(destroyIsland(g,'wild-1').ok,true);contributeCivilization(g,'explore',{island:'wild-0'},null,null);
 assert.equal(islandCatalog(g)['wild-2'],undefined);assert.equal(islandCatalog(g)['wild-1'],undefined);
 assert.deepEqual(restore(serialize(g)).civilization,g.civilization);
});
test('destroying an inhabited island evacuates residents and ships and cancels its work',()=>{
 const g=chain();Object.assign(g.player,{island:'wild-0',homeIsland:'wild-0'});g.viewIsland='wild-0';
 g.objects.push({id:'wild-0-blueprint',type:'blueprintTable',island:'wild-0',side:'front',x:0,z:0,rotation:0});
 g.career.id='architect';assert.equal(enqueue(g,'developBlueprint','wild-0-blueprint').ok,true);
 g.space.ships.push({id:'rescue',tier:1,island:'wild-0',side:'back',food:4,durability:80,reservedBy:null});g.space.provisions['wild-0']=8;g.space.backs['wild-0']=true;
 assert.equal(destroyIsland(g,'wild-0').ok,true);assert.equal(g.player.island,'home');assert.equal(g.player.homeIsland,'home');assert.equal(g.viewIsland,'home');assert.equal(g.space.ships[0].island,'home');
 assert.equal(g.queue.length,0);assert.equal(g.objects.some(o=>o.island==='wild-0'),false);assert.equal(g.space.provisions['wild-0'],undefined);assert.equal(g.civilization.projects['wild-0'],undefined);
 const loaded=restore(serialize(g));assert.ok(loaded);tick(loaded,.1);assert.equal(islandCatalog(loaded)['wild-0'],undefined);
});
test('occupied incubators survive demolition and older saves acquire an empty destruction history',()=>{
 const g=chain();g.objects.push({id:'wild-0-nursery',type:'nursery',island:'wild-0',side:'front',x:0,z:0,rotation:0});
 const {uid,name,color,genome,preferences,familyDesire,prayer}=g.player;
 g.incubations.push({id:'egg-rescue',podId:'wild-0-nursery',due:10000,parents:[{uid,name,color,genome,preferences,familyDesire,prayer}]});
 assert.equal(destroyIsland(g,'wild-0').ok,true);assert.equal(g.incubations.length,1);assert.equal(g.objects.find(o=>o.id==='wild-0-nursery').island,'home');assert.ok(restore(serialize(g)));
 const old=createGame();delete old.civilization.destroyedIslands;assert.deepEqual(restore(serialize(old)).civilization.destroyedIslands,[]);
});
test('evacuation does not invalidate an existing population above the remaining island capacity',()=>{
 const g=chain(),template=Object.values(g.npcs)[0];
 for(let i=0;i<8;i++){const id=`evacuee-${i}`;g.npcs[id]={...structuredClone(template),id,uid:id,name:`撤离居民${i}`,island:'wild-0',homeIsland:'wild-0'};g.relationships[id]=20;}
 for(const n of Object.values(g.npcs))for(const id of Object.keys(g.npcs))if(id!==n.id)n.relationships[id]=20;
 assert.ok(restore(serialize(g)));
 for(const id of ['spore','wild-0','wild-1'])assert.equal(destroyIsland(g,id).ok,true);
 assert.ok(restore(serialize(g)));
});
