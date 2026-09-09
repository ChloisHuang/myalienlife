import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,buyItem,enqueue,tick,restore,serialize,autonomousCandidates} from '../src/simulation.js';
import {createPropFactory} from '../src/props.js';
globalThis.devicePixelRatio=1;
const types=['blueprintTable','constructionTerminal','cultivator','extractor','materialCabinet','loadingPlatform'];
function game(){const g=createGame();g.money=10000;g.autonomy.enabled=false;for(const n of Object.values(g.npcs))n.ai.enabled=false;return g;}
test('six professional objects can be bought, rendered and restored without inserting invalid AI actions',()=>{
 const g=game();for(const [i,type]of types.entries()){const result=buyItem(g,type,-8+i*3,-5,0,{island:'spore',side:'front'});assert.ok(result.ok,type);const visual=createPropFactory({})(type);assert.ok(visual.children.length>=3,type);}
 assert.ok(restore(serialize(g)));assert.ok(autonomousCandidates(g,'player').every(c=>c.type));
});
test('design and construction stations offer different tasks and retain architect qualification',()=>{
 const g=game();g.player.island=g.viewIsland='spore';g.civilization.discoveryPath=['home','spore'];g.civilization.visits.spore=1;
 const design=buyItem(g,'blueprintTable',0,-3).object,site=buyItem(g,'constructionTerminal',3,-3).object;
 assert.equal(enqueue(g,'developBlueprint',design.id).ok,false);g.career.id='architect';assert.equal(enqueue(g,'developBlueprint',site.id).ok,false);assert.equal(enqueue(g,'developBlueprint',design.id).ok,true);
 g.queue=[];g.civilization.projects.spore.blueprint=300;g.space.materials.spore=2;assert.equal(enqueue(g,'constructIsland',design.id).ok,false);assert.equal(enqueue(g,'constructIsland',site.id).ok,true);
});
test('extractor consumes one nearby mature crop and cannot harvest plants on a different island or face',()=>{
 const g=game(),extractor=buyItem(g,'extractor',0,-3,0,{island:'spore',side:'front'}).object,plant=buyItem(g,'cultivator',3,-3,0,{island:'spore',side:'front'}).object;
 g.player.island=g.viewIsland='spore';g.civilization.discoveryPath=['home','spore'];plant.plant.growth=1;g.career.id='botanist';
 plant.side='back';assert.equal(enqueue(g,'extractMaterials',extractor.id).ok,false);plant.side='front';assert.equal(enqueue(g,'extractMaterials',extractor.id).ok,true);
 for(let i=0;i<600;i++)tick(g,.1,()=>1);assert.equal(g.space.materials.spore,18);assert.ok(plant.plant.growth<1);assert.equal(plant.plant.harvests,1);assert.equal(enqueue(g,'extractMaterials',extractor.id).ok,false);assert.ok(restore(serialize(g)));
});
