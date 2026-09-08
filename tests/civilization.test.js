import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,enqueue,tick,serialize,restore,switchControl,autonomousCandidates,buyItem} from '../src/simulation.js';
import {spaceLevel,discovered,voyageError} from '../src/civilization.js';
import {sameSide} from '../src/island.js';
import {explorationContent} from '../src/exploration-panel.js';
const run=(g,n)=>{for(let i=0;i<n*10;i++)tick(g,.1,()=>0);};
function setup(){const g=createGame();g.autonomy.enabled=false;for(const n of Object.values(g.npcs))n.ai.enabled=false;for(const k in g.config.needDecay)g.config.needDecay[k]=0;return g;}

function ship(g){g.skills.science=6;g.space.ships.push({id:'test-ship',tier:2,island:'home',side:'front',food:0,reservedBy:null});g.space.provisions.home=8;}
test('discovery, technology, manufacture and food each gate landing',()=>{
 const g=setup();g.civilization.observations=3;assert.ok(discovered(g,'spore'));
 assert.match(voyageError(g,g.player,g.skills,'spore'),/科技/);g.civilization.technology=40;
 g.skills.science=0;
 assert.match(voyageError(g,g.player,g.skills,'spore'),/制造/);ship(g);g.space.provisions.home=0;
 assert.match(voyageError(g,g.player,g.skills,'spore'),/食物/);g.space.provisions.home=8;
 assert.equal(voyageError(g,g.player,g.skills,'spore'),null);g.player.age=12;g.skills.science=0;assert.equal(voyageError(g,g.player,g.skills,'spore'),null);
 g.player.age=28;g.wonders.archive=3;assert.match(voyageError(g,g.player,g.skills,'city'),/科技 2/);
});
test('a real UFO voyage creates a playable island and reserves return food',()=>{
 const g=setup();g.civilization.observations=3;g.civilization.technology=40;ship(g);
 assert.equal(enqueue(g,'voyage','portal',undefined,null,'spore').ok,true);run(g,40);
 assert.equal(g.player.island,'spore');assert.equal(g.viewIsland,'spore');assert.equal(g.civilization.visits.spore,1);assert.equal(g.space.ships[0].food,1);
 assert.equal(enqueue(g,'research','lab').ok,false);assert.equal(enqueue(g,'explore','spore-portal').ok,true);run(g,35);assert.equal(g.civilization.surveys.spore,1);
 assert.equal(enqueue(g,'explore','spore-portal').ok,false);assert.equal(g.civilization.technology,40);assert.equal(g.civilization.knowledge,6);
 g.player.preferences={};g.skills.botany=0;const loaded=restore(serialize(g));assert.equal(enqueue(loaded,'voyage','spore-portal',undefined,null,'home').ok,true);run(loaded,35);assert.equal(loaded.player.island,'home');assert.equal(loaded.space.ships[0].food,0);
});
test('different islands cannot interact or cross through the ordinary gate network',()=>{
 const g=setup();g.objects.push({id:'remote-gate',type:'gate',island:'spore',side:'front',x:0,z:0,rotation:0});
 assert.equal(sameSide(g.player,g.objects.at(-1)),false);assert.equal(enqueue(g,'travel','island-gate-front',undefined,null,'remote-gate').ok,false);
 assert.equal(enqueue(g,'walk',null,{x:0,z:0,island:'spore'}).ok,true); // User walks are scoped to the viewed island.
 g.queue=[];g.viewIsland='spore';assert.equal(enqueue(g,'walk',null,{x:0,z:0}).ok,false);
});
test('research is shared across residents and remains after switching control and reloading',()=>{
 const g=setup();g.career.level=2;g.skills.science=18;enqueue(g,'spaceResearch','lab');run(g,40);assert.equal(g.civilization.technology,5);
 switchControl(g,'zig');g.autonomy.enabled=false;enqueue(g,'research','lab');run(g,30);assert.equal(g.civilization.technology,5);
 const loaded=restore(serialize(g));assert.equal(loaded.civilization.technology,5);const html=explorationContent(loaded);assert.match(html,/太空科技/);assert.doesNotMatch(html,/晶簇共振|星灵觉醒/);
});
test('v12 migration preserves existing lore and does not invent technology or island visits',()=>{
 const g=setup();g.version=12;delete g.civilization;delete g.viewIsland;g.wonders.archive=3;
 const loaded=restore(serialize(g));assert.equal(loaded.version,18);assert.equal(loaded.wonders.archive,3);assert.equal(loaded.civilization.technology,0);assert.equal(loaded.civilization.visits.city,0);
});
test('a multiplayer activity has exactly one candidate regardless of eligible partner count',()=>{
 const g=setup();g.objects=[];const o=buyItem(g,'lamp',0,0).object;
 for(const population of [1,4]){for(const [i,n]of Object.values(g.npcs).entries())n.side=i<population?'front':'back';const candidates=autonomousCandidates(g,'player').filter(c=>c.type==='passOrb'&&c.targetId===o.id);assert.equal(candidates.length,1);assert.equal(candidates[0].partnerId,undefined);}
});
test('autonomous action choice occurs before the separate partner draw',()=>{
 const g=setup();g.objects=[];buyItem(g,'lamp',0,0);g.player.preferences={passOrb:100};g.autonomy.enabled=true;let draws=0;
 tick(g,.1,()=>{draws++;return draws===1?0:.99;});assert.equal(g.queue[0].type,'passOrb');assert.equal(draws,2);assert.ok(g.queue[0].partnerId);assert.ok(Object.values(g.npcs).some(n=>n.queue[0]?.hostActionId===g.queue[0].id));
});
