import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {prepareSurroundings,updateSurroundings} from '../src/storybook-surroundings.js';
import {createStoryMoon} from '../src/story-moon.js';
import {createLunarGeometry,MOON_LIGHT_DIRECTION} from '../src/lunar-surface.js';

test('ocean uses the storybook front moon and rotates it out without changing its phase',()=>{
 const surface=new THREE.Mesh(new THREE.SphereGeometry(),new THREE.MeshToonMaterial({name:'ivory'}));
 const ornament=new THREE.Mesh(new THREE.TorusGeometry(),new THREE.MeshToonMaterial({name:'gold'}));surface.add(ornament);
 const moon=createStoryMoon(surface),camera=new THREE.PerspectiveCamera();
 moon.update(0,true,0,camera,true);const start=moon.root.position.clone();
 assert.equal(ornament.visible,false);
 moon.update(Math.PI,true,1,camera,true);
 assert.equal(surface.morphTargetInfluences[0],0);assert.equal(moon.light.intensity,0);
 assert.equal(moon.root.visible,true);assert.ok(moon.root.position.y>20);
 moon.update(0,true,2,camera,true);assert.deepEqual(moon.root.position.toArray(),start.toArray());
 moon.update(0,true,3,camera);assert.equal(ornament.visible,true);
});

test('craters deform geometry and normals; orbiting the camera preserves world-space lighting',()=>{
 const geometry=createLunarGeometry(2.4),p=geometry.morphAttributes.position[0],n=geometry.morphAttributes.normal[0];
 let low=Infinity,high=0,changed=0;const v=new THREE.Vector3(),normal=new THREE.Vector3();
 for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);low=Math.min(low,v.length());high=Math.max(high,v.length());normal.fromBufferAttribute(n,i);if(normal.dot(v.normalize())<.99)changed++;}
 assert.ok(high-low>.025&&high-low<.09);assert.ok(changed>20);assert.equal(geometry.getAttribute('color'),undefined);
 const surface=new THREE.Mesh(new THREE.SphereGeometry(),new THREE.MeshToonMaterial({name:'ivory'})),moon=createStoryMoon(surface),camera=new THREE.PerspectiveCamera();
 const worldNormal=new THREE.Vector3(.2,.5,.8).normalize(),expected=worldNormal.dot(MOON_LIGHT_DIRECTION);
 for(const position of [[23,25,30],[-25,14,20],[10,9,-30]]){
  camera.position.set(...position);camera.lookAt(0,0,0);moon.update(Math.PI,true,0,camera);
  const viewNormal=worldNormal.clone().transformDirection(camera.matrixWorldInverse);
  assert.ok(Math.abs(viewNormal.dot(moon.keyDirection.value)-expected)<1e-6);
 }
});

test('one moon surface moves and rotates without swapping or fading its body',()=>{
 const surface=new THREE.Mesh(new THREE.SphereGeometry(),new THREE.MeshToonMaterial({name:'ivory'}));
 const moon=createStoryMoon(surface),camera=new THREE.PerspectiveCamera(),id=surface.uuid;
 moon.update(0,true,0,camera);const start=moon.root.position.clone();
 moon.update(Math.PI/2,true,1,camera);assert.ok(moon.root.visible);assert.equal(surface.material.opacity,1);assert.equal(surface.uuid,id);
 assert.ok(moon.root.position.distanceTo(start)>1);assert.ok(surface.rotation.y>0);
 moon.update(Math.PI,true,2,camera);assert.ok(moon.root.position.distanceTo(new THREE.Vector3(-8,-5.5,-26))<1e-9);assert.ok(moon.light.intensity>0);
 moon.update(0,true,3,camera);assert.deepEqual(moon.root.position.toArray(),start.toArray());assert.equal(surface.uuid,id);assert.equal(moon.light.intensity,0);
});

test('surroundings move and fade continuously through the flip midpoint in both directions',()=>{
 const entries=['front','back'].map(side=>{const root=new THREE.Group();root.add(new THREE.Mesh(new THREE.SphereGeometry(),new THREE.MeshBasicMaterial()));return {side,root,materials:prepareSurroundings(root)};});
 for(const entry of entries){
  updateSurroundings(entry,Math.PI/2-.001,true);const y=entry.root.position.y,alpha=entry.root.children[0].material.opacity;
  updateSurroundings(entry,Math.PI/2+.001,true);
  assert.ok(entry.root.visible);assert.ok(Math.abs(entry.root.position.y-y)<.02);assert.ok(Math.abs(entry.root.children[0].material.opacity-alpha)<.002);
  updateSurroundings(entry,entry.side==='back'?Math.PI:0,true);assert.ok(Math.abs(entry.root.position.y)<1e-9);assert.equal(entry.root.children[0].material.opacity,1);
  updateSurroundings(entry,Math.PI/2,false);assert.equal(entry.root.visible,false);
 }
});

test('environment stores only the original moon, without an obsolete painted back moon',()=>{
 const data=readFileSync(new URL('../public/assets/fairytale-environment.glb',import.meta.url));
 const json=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString());
 assert.ok(json.nodes.some(n=>n.name==='orbit-front'));
 assert.ok(!json.nodes.some(n=>n.name==='orbit-back'));
});

test('bat silhouettes move deterministically and reuse bounded geometry',async()=>{
 const module=await import('../src/blood-moon.js').catch(()=>null);assert.ok(module?.createMoonBats);
 const bats=module.createMoonBats(),camera=new THREE.PerspectiveCamera();camera.position.set(4,6,10);camera.lookAt(0,0,0);
 bats.update(0,camera);const before=bats.root.children.map(n=>n.position.clone());
 bats.update(2,camera);assert.ok(bats.root.children.some((n,i)=>n.position.distanceTo(before[i])>.1));
 assert.equal(bats.root.children.length,7);const after=bats.root.children.map(n=>n.position.toArray());
 bats.update(2,camera);assert.deepEqual(bats.root.children.map(n=>n.position.toArray()),after);
 bats.dispose();assert.equal(bats.root.parent,null);
});
