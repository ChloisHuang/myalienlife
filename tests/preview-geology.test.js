import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {generateIsland} from '../src/island-generator.js';
import {SURFACES,decorateSurface} from '../src/planet-surfaces.js';
import {housingLayout,insideOutline} from '../src/housing-layout.js';
import {createPropFactory} from '../src/props.js';

test('preview uses the production portal, including its animated shader and twelve glyphs',()=>{
 const portal=createPropFactory({})('portal');
 assert.equal(portal.userData.glyphs.children.length,12);
 assert.equal(portal.userData.portal.geometry.parameters.radius,1.1);
 assert.ok(portal.userData.portal.material.isShaderMaterial);
 assert.ok(portal.userData.portal.material.uniforms.time);
});
test('housing has four structural plans with nonoverlapping rooms on the island',()=>{
 const kinds=new Set();
 for(let seed=0;seed<200;seed++){
  const b=generateIsland(seed,seed%64),plan=housingLayout(seed);kinds.add(plan.kind);
  for(const r of [...plan.rooms,...plan.corridors])for(const x of [-1,1])for(const z of [-1,1])assert.ok(insideOutline(b.outline,r.x+x*r.w/2,r.z+z*r.d/2),`seed ${seed} footprint`);
  for(let i=0;i<plan.rooms.length;i++)for(let j=i+1;j<plan.rooms.length;j++){const a=plan.rooms[i],b=plan.rooms[j];assert.ok(Math.abs(a.x-b.x)>=(a.w+b.w)/2-.001||Math.abs(a.z-b.z)>=(a.d+b.d)/2-.001);}
 }
 assert.equal(kinds.size,4);
});
test('new surfaces stay muted and every mineral/deposit vertex lies inside the usable ground',()=>{
 for(const s of SURFACES.filter(s=>!s.original)){
  assert.ok(new THREE.Color(s.color).getHSL({},THREE.SRGBColorSpace).s<.3,s.name);
  for(let seed=0;seed<5;seed++){
   const definition=generateIsland(seed,4),root=new THREE.Group(),rooms=housingLayout(seed).rooms,dispose=decorateSurface(root,definition,s,rooms),outline=definition.outline.map(p=>({x:p.x*.91,z:p.z*.91}));
   root.updateMatrixWorld(true);let count=0;const v=new THREE.Vector3();
   root.traverse(m=>{if(!m.isMesh)return;const p=m.geometry.attributes.position;for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld);assert.ok(insideOutline(outline,v.x,v.z),`${s.id} overhang`);}count++;});
   assert.ok(count>5);dispose();
  }
 }
});
