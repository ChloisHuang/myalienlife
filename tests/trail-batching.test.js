import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createLivingTrailVisual} from '../src/living-visuals.js';
import {instanceTrailGrowth} from '../src/trail-batching.js';
import {createGame} from '../src/simulation.js';

test('trail foliage uses at most four draws per side without removing stems',()=>{
 for(const side of ['front','back']){
  const visual=createLivingTrailVisual(side),meshes=[];
  visual.root.traverse(o=>{if(o.isMesh&&o.material.isMeshToonMaterial)meshes.push(o);});
  assert.equal(visual.growth.children.length,23);
  assert.ok(meshes.length<=4,`${side}: ${meshes.length} foliage draws`);
  assert.equal(meshes.reduce((n,m)=>n+m.count,0),23*(side==='front'?9:3));
  visual.dispose();
 }
});

test('live trail instances keep swaying, opening and updating after island reentry',()=>{
 const g=createGame();g.viewIsland='spore';Object.assign(g.player,{island:'spore',side:'back',x:-3,z:-2});
 const visual=createLivingTrailVisual('back'),batch=visual.root.getObjectByName('trail-instances');
 visual.update(g,0,1/60);const closed=Array.from(batch.instanceMatrix.array);
 visual.update(g,1,1/60);assert.notDeepEqual(Array.from(batch.instanceMatrix.array),closed);
 g.player.prayer.nether=10;visual.update(g,2,.25);
 assert.ok(visual.growth.children.every(stem=>Math.abs(stem.rotation.x)>1));
 const open=Array.from(batch.instanceMatrix.array);assert.equal(visual.steps.children[0].material.opacity,.6);
 g.viewIsland='home';visual.update(g,3,.25);assert.equal(visual.root.visible,false);
 assert.deepEqual(Array.from(batch.instanceMatrix.array),open);
 g.viewIsland='spore';visual.update(g,4,.25);assert.equal(visual.root.visible,true);
 assert.notDeepEqual(Array.from(batch.instanceMatrix.array),open);visual.dispose();
});

test('instances preserve every part transform, ray hit and moving bounds through a flip',()=>{
 const growth=new THREE.Group(),geometry=new THREE.SphereGeometry(1,10,6),material=new THREE.MeshToonMaterial();
 for(let i=0;i<3;i++){
  const stem=new THREE.Group();stem.position.set(i*2,0,0);stem.scale.setScalar(.6+i*.1);growth.add(stem);
  const head=new THREE.Group();head.position.y=.6;head.rotation.x=.2*i;stem.add(head);
  const part=new THREE.Mesh(geometry,material);part.scale.set(.2,.1,.3);part.position.x=.1;head.add(part);
 }
 const original=growth.clone(true),instances=instanceTrailGrowth(growth),root=new THREE.Group();root.add(growth,instances.root);
 const batch=instances.root.children[0],instance=new THREE.Matrix4(),point=new THREE.Vector3();
 for(const angle of [0,.8,Math.PI]){
  root.rotation.x=original.rotation.x=angle;
  for(let i=0;i<3;i++)for(const g of [growth,original]){g.children[i].rotation.z=angle*.1;g.children[i].rotation.x=angle*.3;}
  instances.update();root.updateMatrixWorld(true);original.updateMatrixWorld(true);
  for(let i=0;i<3;i++){
   const part=original.children[i].children[0].children[0];batch.getMatrixAt(i,instance);
   const world=new THREE.Matrix4().multiplyMatrices(batch.matrixWorld,instance);
   world.elements.forEach((v,j)=>assert.ok(Math.abs(v-part.matrixWorld.elements[j])<1e-6));
   for(let j=0;j<geometry.attributes.position.count;j++){
    point.fromBufferAttribute(geometry.attributes.position,j).applyMatrix4(instance);
    assert.ok(point.distanceTo(batch.boundingSphere.center)<=batch.boundingSphere.radius+1e-6);
   }
   const center=new THREE.Vector3().setFromMatrixPosition(part.matrixWorld);
   const ray=new THREE.Raycaster(center.clone().add(new THREE.Vector3(0,3,0)),new THREE.Vector3(0,-1,0));
   const before=ray.intersectObject(original,true)[0],after=ray.intersectObject(instances.root,true)[0];
   assert.ok(before&&after);assert.ok(before.point.distanceTo(after.point)<1e-6);
  }
 }
 let buffers=0,shared=0;batch.addEventListener('dispose',()=>buffers++);geometry.addEventListener('dispose',()=>shared++);
 instances.dispose();assert.equal(buffers,1);assert.equal(shared,0);
});
