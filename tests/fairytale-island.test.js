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

test('painted terrain has canonical coordinates so rebuilding props cannot change crack scale',()=>{
 const data=readFileSync(new URL('../public/assets/fairytale.glb',import.meta.url));
 const json=JSON.parse(data.toString('utf8',20,20+data.readUInt32LE(12)));
 for(const node of json.nodes){
  if(node.mesh===undefined||!json.meshes[node.mesh].primitives.some(p=>json.materials[p.material].name.startsWith('painted ')))continue;
  assert.deepEqual(node.scale??[1,1,1],[1,1,1],`${node.name}: terrain scale must be baked`);
  assert.deepEqual(node.translation??[0,0,0],[0,0,0],`${node.name}: terrain origin must be stable`);
  assert.deepEqual(node.rotation??[0,0,0,1],[0,0,0,1],`${node.name}: terrain rotation must be baked`);
 }
});

test('authored poison apple includes exposed green flesh on the reverse face only',()=>{
 const data=readFileSync(new URL('../public/assets/fairytale.glb',import.meta.url));
 const json=JSON.parse(data.toString('utf8',20,20+data.readUInt32LE(12)));
 const flesh=json.materials.findIndex(m=>m.name==='poison apple flesh');
 assert.ok(flesh>=0,'bite must expose a distinct poison-green interior');
 const usesFlesh=index=>{
  const node=json.nodes[index];
  return (node.mesh!==undefined&&json.meshes[node.mesh].primitives.some(p=>p.material===flesh))||(node.children??[]).some(usesFlesh);
 };
 assert.equal(usesFlesh(json.nodes.findIndex(n=>n.name==='fairytale-back')),true);
 assert.equal(usesFlesh(json.nodes.findIndex(n=>n.name==='fairytale-front')),false);
 const skin=json.materials.findIndex(m=>m.name==='poison apple'),bounds=new THREE.Box3();
 function measure(index,parent=new THREE.Matrix4()){
  const node=json.nodes[index],local=node.matrix?new THREE.Matrix4().fromArray(node.matrix):new THREE.Matrix4().compose(new THREE.Vector3(...(node.translation??[0,0,0])),new THREE.Quaternion(...(node.rotation??[0,0,0,1])),new THREE.Vector3(...(node.scale??[1,1,1])));
  const matrix=parent.clone().multiply(local);
  if(node.mesh!==undefined)for(const primitive of json.meshes[node.mesh].primitives)if(primitive.material===skin){
   const position=json.accessors[primitive.attributes.POSITION];
   bounds.union(new THREE.Box3(new THREE.Vector3(...position.min),new THREE.Vector3(...position.max)).applyMatrix4(matrix));
  }
  for(const child of node.children??[])measure(child,matrix);
 }
 measure(json.nodes.findIndex(n=>n.name==='fairytale-back'));
 assert.ok(bounds.getSize(new THREE.Vector3()).y>1,'poison apple must stay large enough to see at island scale');
});

test('authored plants sway independently while their roots and buildings remain fixed',()=>{
 const asset=new THREE.Group(),face=new THREE.Group();face.name='fairytale-front';asset.add(face);
 const plant=new THREE.Group();plant.userData.windPlant='tree';plant.position.set(3,1,2);face.add(plant);
 const terrain=createFairytaleKit(asset).terrain('front');let animated;terrain.root.traverse(o=>{if(o.userData.windPlant)animated=o;});
 const position=animated.position.clone();terrain.update(0,.4);const before=animated.rotation.clone();terrain.update(2,.4);
 assert.notEqual(animated.rotation.z,before.z);assert.deepEqual(animated.position,position);assert.equal(terrain.root.rotation.z,0);terrain.dispose();
});

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
test('theme shares one authored moon and uses side-specific fragments',()=>{
 const data=readFileSync(new URL('../public/assets/fairytale-environment.glb',import.meta.url));
 const json=JSON.parse(data.toString('utf8',20,20+data.readUInt32LE(12)));
 for(const name of ['orbit-front','fragment-front','fragment-back'])assert.ok(json.nodes.some(n=>n.name===name));
 assert.ok(!json.nodes.some(n=>n.name==='orbit-back'));
 assert.ok(data.length<1024*1024);
});

test('the first destination is a fixed fairytale design, not a random biome',()=>{
 const a=islandDefinition(createGame(),'spore'),b=islandDefinition(createGame(),'spore');
 assert.equal(a.theme,'fairytale');assert.equal(a.name,'童梦星屿');assert.deepEqual(a.layout,b.layout);
 assert.ok(a.layout.some(o=>o.type==='pod'));assert.ok(a.layout.some(o=>o.type==='portal'));
});
test('new exploration stops until another authored island is released',()=>{
 const g=createGame();assert.equal(islandCatalog(g).city,undefined);
 g.civilization.observations=3;assert.equal(discoverAdjacentIsland(g,'home',()=>0).name,'童梦星屿');
 g.civilization.visits.spore=1;g.civilization.observations=12;
 assert.equal(discoverAdjacentIsland(g,'spore'),null);
 assert.deepEqual(restore(serialize(g)).civilization.discoveryPath,['home','spore']);
 const legacy=createGame();legacy.version=23;legacy.civilization.discoveryPath=['home','spore','city'];legacy.civilization.visits.city=1;legacy.civilization.surveys.city=0;legacy.civilization.surveyDays.city=0;
 const migrated=restore(serialize(legacy));assert.equal(islandCatalog(migrated).city,undefined);assert.deepEqual(migrated.civilization.discoveryPath,['home','spore']);
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
