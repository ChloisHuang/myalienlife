import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceDailySpiritTrees,createGame,tick} from '../src/simulation.js';

function quietGame(){
 const g=createGame();g.objects=[];g.autonomy.enabled=false;
 for(const n of Object.values(g.npcs))n.ai.enabled=false;
 for(const key in g.config.needDecay)g.config.needDecay[key]=0;
 return g;
}

test('a successful daily roll grows at most one tree at a valid random position',()=>{
 const g=quietGame();advanceDailySpiritTrees(g,()=>0);
 const trees=g.objects.filter(o=>o.type==='spiritTree');
 assert.equal(trees.length,1);
 assert.deepEqual(trees.map(o=>o.side),['front']);
 assert.ok(trees.every(o=>Number.isInteger(o.x)&&Number.isInteger(o.z)&&Math.abs(o.x)<=10&&Math.abs(o.z)<=6));
 assert.ok(trees.every(o=>o.fixed===true));
 assert.equal(g.majorEvents.length,1);
 assert.ok(g.majorEvents.every(event=>event.type==='discovery'&&event.text.includes('星灵垂光树')));
 advanceDailySpiritTrees(g,()=>0);
 assert.equal(g.objects.filter(o=>o.type==='spiritTree').length,2);
});

test('a roll at exactly one percent does not grow a tree',()=>{
 const g=quietGame();advanceDailySpiritTrees(g,()=>.01);
 assert.equal(g.objects.filter(o=>o.type==='spiritTree').length,0);
 assert.equal(g.majorEvents.length,0);
});

test('daily growth uses one global roll and excludes faces that already have a tree',()=>{
 const g=quietGame();g.objects.push({id:'existing-tree',type:'spiritTree',x:0,z:0,rotation:0,island:'home',side:'front'});
 let rolls=0;advanceDailySpiritTrees(g,()=>{rolls++;return 0;});
 assert.equal(rolls,3);
 assert.deepEqual(g.objects.filter(o=>o.type==='spiritTree').map(o=>o.side).sort(),['back','front']);
});

test('a failed global roll does not retry another empty face',()=>{
 const g=quietGame();let draws=0;
 assert.equal(advanceDailySpiritTrees(g,()=>{draws++;return draws===1?.5:0;}),null);
 assert.equal(draws,1);
 assert.equal(g.objects.filter(o=>o.type==='spiritTree').length,0);
});

test('growth covers both faces of every discovered island, including an undiscovered reverse face',()=>{
 const g=quietGame();g.civilization.discoveryPath=['home','spore'];g.civilization.visits.spore=1;
 g.objects.push(
  {id:'home-front-tree',type:'spiritTree',x:0,z:0,rotation:0,island:'home',side:'front'},
  {id:'home-back-tree',type:'spiritTree',x:0,z:0,rotation:0,island:'home',side:'back'}
 );
 advanceDailySpiritTrees(g,()=>0);advanceDailySpiritTrees(g,()=>0);
 assert.deepEqual(g.objects.filter(o=>o.type==='spiritTree').map(o=>`${o.island}:${o.side}`).sort(),['home:back','home:front','spore:back','spore:front']);
});

test('daily growth runs once for each game day crossed by the clock',()=>{
 const g=quietGame();g.minute=1439;g.config.time.gameMinutesPerRealSecond=1;
 g.speed=1;tick(g,1,()=>.01);
 assert.equal(g.day,2);assert.equal(g.objects.filter(o=>o.type==='spiritTree').length,0);
 g.minute=1439;tick(g,1,()=>0);
 assert.equal(g.day,3);assert.equal(g.objects.filter(o=>o.type==='spiritTree').length,1);
});
