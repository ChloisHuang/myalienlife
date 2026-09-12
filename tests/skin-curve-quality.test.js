import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {skinCurveArcDivisions,updateSkinBoneMatrix} from '../src/skin-curve-quality.js';

test('skin curves use a bounded arc-length budget matched to the bone count',()=>{
 assert.equal(skinCurveArcDivisions(9),32);
 assert.equal(skinCurveArcDivisions(5),24);
 assert.equal(skinCurveArcDivisions(20),64);
});

test('the nine-bone skin curve budget stays visually close to the 200-division reference',()=>{
 const points=[
  new THREE.Vector3(-.35,0,0),
  new THREE.Vector3(-.30,-.24,.06),
  new THREE.Vector3(-.12,-.55,.22),
  new THREE.Vector3(.08,-.72,.31),
  new THREE.Vector3(.34,-.68,.18),
 ];
 const reference=new THREE.CatmullRomCurve3(points.map(point=>point.clone()));
 reference.arcLengthDivisions=200;reference.updateArcLengths();
 const optimized=new THREE.CatmullRomCurve3(points.map(point=>point.clone()));
 optimized.arcLengthDivisions=skinCurveArcDivisions(9);optimized.updateArcLengths();
 let maxPositionError=0,maxTangentError=0;
 for(let i=0;i<9;i++){
  const u=i/8;
  maxPositionError=Math.max(maxPositionError,reference.getPointAt(u).distanceTo(optimized.getPointAt(u)));
  const dot=THREE.MathUtils.clamp(reference.getTangentAt(u).dot(optimized.getTangentAt(u)),-1,1);
  maxTangentError=Math.max(maxTangentError,THREE.MathUtils.radToDeg(Math.acos(dot)));
 }
 assert.ok(maxPositionError<.005,`position error ${maxPositionError}`);
 assert.ok(maxTangentError<1,`tangent error ${maxTangentError}°`);
});

test('ordered single-bone world updates match recursive updates at the end of the chain',()=>{
 const makeChain=()=>{
  const root=new THREE.Object3D(),bones=Array.from({length:9},()=>new THREE.Object3D());
  root.add(bones[0]);for(let i=1;i<bones.length;i++)bones[i-1].add(bones[i]);root.updateMatrixWorld(true);return{root,bones};
 };
 const recursive=makeChain(),ordered=makeChain();
 for(let i=0;i<9;i++){
  const position=new THREE.Vector3(.03*i,-.08*i,.015*i),rotation=.025*i;
  recursive.bones[i].position.copy(position);recursive.bones[i].rotation.z=rotation;recursive.bones[i].updateMatrixWorld(true);
  ordered.bones[i].position.copy(position);ordered.bones[i].rotation.z=rotation;updateSkinBoneMatrix(ordered.bones[i]);
 }
 for(let i=0;i<9;i++)assert.ok(recursive.bones[i].matrixWorld.equals(ordered.bones[i].matrixWorld),`bone ${i} matrix differs`);
});
