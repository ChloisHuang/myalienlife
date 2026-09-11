import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createPropFactory} from '../src/props.js';
import {StarToonMaterial} from '../src/npr.js';
import {batchStatic,disposeStaticBatches} from '../src/static-batching.js';

test('static sofa parts share one draw per material without changing their surface',()=>{
 const sofa=createPropFactory({})('sofa','home'),meshes=[];
 sofa.traverse(o=>{if(o.isMesh)meshes.push(o);});
 assert.equal(meshes.length,3);
 sofa.updateMatrixWorld(true);
 const ray=new THREE.Raycaster(new THREE.Vector3(0,4,0),new THREE.Vector3(0,-1,0));
 const hits=ray.intersectObject(sofa,true);assert.ok(hits.length>0);
 assert.ok(Math.abs(hits[0].point.y-.49)<.001);
 for(const mesh of meshes){assert.equal(mesh.castShadow,true);assert.equal(mesh.receiveShadow,true);}
});

test('transparent build previews keep the original independently sorted pieces',()=>{
 const sofa=createPropFactory({})('sofa','home',false),meshes=[];
 sofa.traverse(o=>{if(o.isMesh)meshes.push(o);});assert.equal(meshes.length,7);
 assert.equal(meshes.some(o=>o.isInstancedMesh),false);
});

test('merged surfaces preserve raycasting and release only their newly allocated buffers',()=>{
 const prop=createPropFactory({});
 for(const type of ['sofa','pod','food','loadingPlatform','blueprintTable']){
  const before=prop(type,'home',false),after=prop(type,'home');before.updateMatrixWorld(true);after.updateMatrixWorld(true);
  for(const x of [-.3,0,.3])for(const z of [-.3,0,.3]){
   const ray=new THREE.Raycaster(new THREE.Vector3(x,4,z),new THREE.Vector3(0,-1,0));
   const a=ray.intersectObject(before,true)[0],b=ray.intersectObject(after,true)[0];
   assert.equal(!!a,!!b,type);if(a)assert.ok(a.point.distanceTo(b.point)<1e-5,type);
  }
  const batched=[];after.traverse(o=>{if(o.name==='static-batch'&&!o.isInstancedMesh)batched.push(o.geometry);});
  let disposed=0;for(const geometry of batched)geometry.addEventListener('dispose',()=>disposed++);
  disposeStaticBatches(after);assert.equal(disposed,batched.length);disposeStaticBatches(after);assert.equal(disposed,batched.length);
 }
});

test('instances preserve transforms, ray hits and shared geometry ownership',()=>{
 const root=new THREE.Group(),geometry=new THREE.BoxGeometry(),material=new StarToonMaterial();
 for(const x of [-2,2]){const mesh=new THREE.Mesh(geometry,material);mesh.position.x=x;root.add(mesh);}
 root.position.set(4,0,2);root.rotation.y=.2;root.updateMatrixWorld(true);
 const ray=new THREE.Raycaster(new THREE.Vector3(2,3,2),new THREE.Vector3(0,-1,0));
 const before=ray.intersectObject(root,true).map(h=>h.point.toArray());
 batchStatic(root);root.updateMatrixWorld(true);
 assert.equal(root.children.length,1);assert.ok(root.children[0].isInstancedMesh);assert.equal(root.children[0].count,2);
 const after=ray.intersectObject(root,true).map(h=>h.point.toArray());assert.equal(after.length,before.length);
 after.forEach((p,i)=>p.forEach((v,j)=>assert.ok(Math.abs(v-before[i][j])<1e-6)));
 let disposed=false;geometry.addEventListener('dispose',()=>disposed=true);disposeStaticBatches(root);assert.equal(disposed,false);
});

test('batching keeps wind and construction boundaries, transparent effects and excluded animation nodes',()=>{
 const root=new THREE.Group(),material=new StarToonMaterial(),geometry=new THREE.BoxGeometry();
 const stages=[new THREE.Group(),new THREE.Group()];stages[0].userData.revealAt=.5;stages[1].userData.windPlant='tree';
 for(const stage of stages){root.add(stage);for(const x of [-1,1]){const mesh=new THREE.Mesh(geometry,material);mesh.position.x=x;stage.add(mesh);}}
 const effect=new THREE.Mesh(geometry,new StarToonMaterial({transparent:true,opacity:.4})),animated=new THREE.Mesh(geometry,material);
 root.add(effect,animated);batchStatic(root,{exclude:new Set([animated])});
 assert.equal(effect.parent,root);assert.equal(animated.parent,root);
 for(const stage of stages){assert.equal(stage.parent,root);assert.equal(stage.children.length,1);}
 stages[0].visible=false;stages[1].rotation.z=.3;root.updateMatrixWorld(true);
 assert.equal(stages[0].visible,false);assert.equal(stages[1].rotation.z,.3);
});
