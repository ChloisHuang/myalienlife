import test from 'node:test';
import assert from 'node:assert/strict';
import {ACTIONS,createGame,restore,serialize} from '../src/simulation.js';
import {islandCatalog} from '../src/civilization.js';
import {explorationContent} from '../src/exploration-panel.js';
import {createProject} from '../src/settlements.js';

function legacyParent(g){
 const {uid,name,color,genome,preferences,familyDesire,prayer}=g.player;
 return {uid,name,color,genome:structuredClone(genome),preferences:{...preferences},familyDesire,prayer:structuredClone(prayer)};
}

test('new games no longer expose the legacy city or its expedition action',()=>{
 const g=createGame();
 assert.equal(islandCatalog(g).city,undefined);
 assert.equal(ACTIONS.memoryExpedition,undefined);
 assert.doesNotMatch(explorationContent(g),/失落星城|星城考察|探访失落星城/);
 assert.equal(g.civilization.projects.city,undefined);
 assert.equal(g.civilization.visits.city,undefined);
 assert.equal(g.wonders.cityRecords,undefined);
 assert.equal(g.wonders.expeditions,undefined);
 assert.equal(g.wonders.lastExpeditionDay,undefined);
});

test('v23 legacy city is evacuated like a destroyed island while global progress is preserved',()=>{
 const g=createGame();
 g.version=23;
 g.civilization.discoveryPath=['home','spore','city'];
 g.civilization.visits.city=4;
 g.civilization.surveys.city=3;
 g.civilization.surveyDays.city=7;
 g.civilization.projects.city=createProject();
 g.civilization.projects.city.blueprint=300;
 g.civilization.projects.city.construction=240;
 g.civilization.knowledge=77;
 g.civilization.technology=123;
 g.player.island='city';g.player.homeIsland='city';g.player.preferences.memoryExpedition=90;
 g.npcs.nova.island='city';g.npcs.nova.homeIsland='city';g.npcs.nova.preferences.memoryExpedition=60;
 g.viewIsland='city';g.viewSide='back';
 g.objects.push(
  {id:'legacy-city-portal',type:'portal',island:'city',side:'front',x:0,z:0,rotation:0},
  {id:'legacy-city-nursery',type:'nursery',island:'city',side:'front',x:4,z:2,rotation:0}
 );
 g.incubations.push({id:'legacy-starbud',podId:'legacy-city-nursery',due:10000,parents:[legacyParent(g)]});
 g.queue=[{id:g.nextId++,type:'memoryExpedition',targetId:'legacy-city-portal',target:{x:0,z:0,island:'city',side:'front'},source:'manual',phase:'walking',elapsed:0,path:null}];
 g.autonomy.lastAction='memoryExpedition';g.autonomy.lastTarget='legacy-city-portal';
 g.space.ships.push({id:'legacy-city-ship',tier:2,island:'city',side:'back',food:4,durability:80,reservedBy:null});
 g.space.provisions.home=5;g.space.provisions.city=8;
 g.space.materials.home=6;g.space.materials.city=11;g.space.backs.city=true;
 g.wonders.archive=3;g.wonders.dust=9;g.wonders.coauthored=true;g.wonders.expeditions=5;g.wonders.cityRecords=[0,2];g.wonders.lastExpeditionDay=6;

 const loaded=restore(serialize(g));
 assert.equal(loaded.version,24);
 assert.equal(islandCatalog(loaded).city,undefined);
 assert.equal(loaded.civilization.discoveryPath.includes('city'),false);
 assert.equal(loaded.civilization.destroyedIslands.includes('city'),false);
 for(const key of ['projects','visits','surveys','surveyDays'])assert.equal(loaded.civilization[key].city,undefined);
 assert.equal(loaded.player.island,'home');assert.equal(loaded.player.homeIsland,'home');
 assert.equal(loaded.npcs.nova.island,'home');assert.equal(loaded.npcs.nova.homeIsland,'home');
 assert.equal(loaded.viewIsland,'home');assert.equal(loaded.viewSide,'front');
 assert.equal(loaded.queue.some(q=>q.type==='memoryExpedition'),false);
 assert.equal(loaded.player.preferences.memoryExpedition,undefined);assert.equal(loaded.npcs.nova.preferences.memoryExpedition,undefined);
 assert.equal(loaded.autonomy.lastAction,null);assert.equal(loaded.autonomy.lastTarget,null);
 assert.equal(loaded.objects.some(o=>o.island==='city'),false);
 assert.equal(loaded.objects.find(o=>o.id==='legacy-city-nursery').island,'home');
 assert.equal(loaded.incubations.some(b=>b.id==='legacy-starbud'),true);
 assert.equal(loaded.space.ships.find(s=>s.id==='legacy-city-ship').island,'home');
 assert.equal(loaded.space.ships.find(s=>s.id==='legacy-city-ship').side,'front');
 assert.equal(loaded.space.provisions.home,13);assert.equal(loaded.space.provisions.city,undefined);
 assert.equal(loaded.space.materials.home,17);assert.equal(loaded.space.materials.city,undefined);assert.equal(loaded.space.backs.city,undefined);
 assert.equal(loaded.civilization.knowledge,77);assert.equal(loaded.civilization.technology,123);
 assert.equal(loaded.wonders.archive,3);assert.equal(loaded.wonders.dust,9);assert.equal(loaded.wonders.coauthored,true);
 assert.equal(loaded.wonders.expeditions,undefined);assert.equal(loaded.wonders.cityRecords,undefined);assert.equal(loaded.wonders.lastExpeditionDay,undefined);
 assert.doesNotMatch(explorationContent(loaded),/失落星城|星城考察|探访失落星城/);
});
