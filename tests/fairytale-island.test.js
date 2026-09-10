import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {createGame,buyItem,sellItem,serialize,restore,enqueue,tick,ITEMS,canPlace,ensureStarIsland} from '../src/simulation.js';
import {groundHeight} from '../src/characters.js';
import {islandDefinition,islandCatalog,discoverAdjacentIsland} from '../src/civilization.js';
import {createStoryWater} from '../src/fairytale-water.js';
import {createFairytaleKit} from '../src/fairytale.js';
import {StarToonMaterial} from '../src/npr.js';
import * as THREE from 'three';
import {fairytaleBlocked} from '../src/fairytale-definition.js';

test('authored construction stages reveal both faces from shared saved progress',()=>{
 const asset=new THREE.Group();
 for(const side of ['front','back']){
  const face=new THREE.Group();face.name=`fairytale-${side}`;asset.add(face);
  for(const revealAt of [0,.2,.4,.6,.8,1]){const stage=new THREE.Group();stage.userData.revealAt=revealAt;face.add(stage);}
 }
 const kit=createFairytaleKit(asset);
 for(const side of ['front','back']){
  const terrain=kit.terrain(side),states=[];terrain.root.traverse(o=>{if(o.isGroup&&typeof o.userData.revealAt==='number')states.push(o);});
  terrain.setProgress(0);assert.equal(states.filter(o=>o.visible).length,1);
  terrain.setProgress(.6);assert.equal(states.filter(o=>o.visible).length,4);
  terrain.setProgress(1);assert.equal(states.filter(o=>o.visible).length,6);
  terrain.dispose();
 }
});

test('reverse castle reserves the upper-right footprint without blocking the old center',()=>{
 assert.equal(fairytaleBlocked(6.5,-7,.8,'back'),true);
 assert.equal(fairytaleBlocked(0,-7,.8,'back'),false);
 assert.equal(fairytaleBlocked(0,-7,.8,'front'),true);
 assert.equal(fairytaleBlocked(6.5,-7,.8,'front'),false);
});

test('fairytale meshes use the main planet cel shader and preserve painted colors',()=>{
 const asset=new THREE.Group(),source=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial({vertexColors:true}));source.name='fairyBench';asset.add(source);
 const result=createFairytaleKit(asset).prop('fairyBench','home');
 result.traverse(o=>{if(o.isMesh){assert.ok(o.material instanceof StarToonMaterial);assert.equal(o.material.vertexColors,true);o.material.dispose();}});
 source.geometry.dispose();source.material.dispose();
});

test('clear stream animates with a waterfall while reverse pond has no falling water',()=>{
 const front=createStoryWater(false),back=createStoryWater(true);
 assert.equal(front.root.children.length,3);assert.equal(back.root.children.length,1);
 const fall=front.root.children[1].geometry.getAttribute('position');
 assert.equal(fall.getX(0)>13.7,true);assert.ok(Math.abs(fall.getY(0)-.075)<.001);
 assert.ok(fall.getX(fall.count-1)>14.6,'fall must clear the protruding book pages');
 front.update(12);back.update(12);
 assert.equal(front.root.children[0].material.uniforms.time.value,12);
 assert.equal(back.root.children[0].material.uniforms.dark.value,1);
 front.dispose();back.dispose();
});
test('theme replaces the orbit and fragments on both sides with authored assets',()=>{
 const data=readFileSync(new URL('../public/assets/fairytale-environment.glb',import.meta.url));
 const json=JSON.parse(data.toString('utf8',20,20+data.readUInt32LE(12)));
 for(const name of ['orbit-front','orbit-back','fragment-front','fragment-back'])assert.ok(json.nodes.some(n=>n.name===name));
 assert.ok(data.length<1024*1024);
});

test('the first destination is a fixed fairytale design, not a random biome',()=>{
 const a=islandDefinition(createGame(),'spore'),b=islandDefinition(createGame(),'spore');
 assert.equal(a.theme,'fairytale');assert.equal(a.name,'童梦星屿');assert.deepEqual(a.layout,b.layout);
 assert.ok(a.layout.some(o=>o.type==='pod'));assert.ok(a.layout.some(o=>o.type==='portal'));
});
test('new exploration skips the retired city but preserves discovered legacy cities',()=>{
 const g=createGame();assert.equal(islandCatalog(g).city,undefined);
 g.civilization.observations=3;assert.equal(discoverAdjacentIsland(g,'home',()=>0).name,'童梦星屿');
 g.civilization.visits.spore=1;g.civilization.observations=12;
 assert.equal(discoverAdjacentIsland(g,'spore',()=>0).id,'wild-0');
 assert.deepEqual(restore(serialize(g)).civilization.discoveryPath,['home','spore','wild-0']);
 const legacy=createGame();legacy.civilization.discoveryPath=['home','spore','city'];
 assert.equal(islandCatalog(restore(serialize(legacy))).city.name,'失落星城');
});
test('fairytale furniture is purchasable outside the island, fixed landmarks are not',()=>{
 const g=createGame();
 for(const id of ['fairyBench','fairyLantern','fairyPlanter'])assert.ok(ITEMS.some(i=>i.id===id&&i.pack==='童话花园'));
 const bought=buyItem(g,'fairyBench',-9,5);assert.equal(bought.ok,true);assert.equal(sellItem(g,bought.object.id),true);
 const money=g.money;assert.equal(buyItem(g,'fairyCastle',-9,5).ok,false);assert.equal(g.money,money);
 g.objects.push({id:'spore-pod',type:'pod',island:'spore',side:'front',x:-5,z:-3,rotation:0,fixed:true,sceneFixed:true});
 assert.equal(sellItem(g,'spore-pod'),false);
});
test('the authored GLB contains both faces and furniture within a small asset budget',()=>{
 const path=new URL('../public/assets/fairytale.glb',import.meta.url);
 assert.ok(statSync(path).size<4*1024*1024,'entire theme must remain below 4 MiB');
 const data=readFileSync(path);assert.equal(data.toString('ascii',0,4),'glTF');
 const json=JSON.parse(data.toString('utf8',20,20+data.readUInt32LE(12)));
 const names=new Set(json.nodes.map(n=>n.name));
 for(const side of ['front','back'])for(const percent of [0,20,40,60,80,100]){
  const node=json.nodes.find(n=>n.name===`fairytale-${side}-stage-${percent}`);
  assert.equal(node?.extras?.revealAt,percent/100);
 }
 for(const name of ['fairytale-front','fairytale-back','fairyBench','fairyLantern','fairyPlanter','fairy-pod','fairy-food','fairy-shower','fairy-lab','fairy-portal'])assert.ok(names.has(name),name);
 assert.ok(!json.images?.length,'no large texture payloads');
});
test('the garden bench supports actual resting and queued save reloads',()=>{
 const g=createGame();g.autonomy.enabled=false;for(const n of Object.values(g.npcs))n.ai.enabled=false;
 const o=buyItem(g,'fairyBench',-9,5).object;
 assert.equal(enqueue(g,'relax',o.id).ok,true);
 const loaded=restore(serialize(g));assert.equal(loaded.queue[0].targetId,o.id);
 for(let i=0;i<600&&loaded.queue.length;i++)tick(loaded,.1,()=>.9);
 assert.equal(loaded.queue.length,0);assert.ok(loaded.needs.comfort>95);
});
test('fairytale relief is shared by character grounding and fixed-landmark placement checks',()=>{
 assert.ok(groundHeight(0,-8,'front','spore')>1.5);
 assert.ok(groundHeight(0,7.5,'front','spore')<.1);
 assert.equal(groundHeight(0,-8,'front','spore'),groundHeight(0,-8,'back','spore'));
 const g=createGame();g.viewIsland='spore';ensureStarIsland(g,'spore');
 assert.equal(canPlace(g,-10,2),false);assert.equal(canPlace(g,0,-6),false);
 assert.equal(canPlace(g,3,4),true);
 assert.equal(sellItem(g,'spore-pod'),false);
});
