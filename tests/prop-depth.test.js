import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createPropFactory,colors} from '../src/props.js';

test('bed foot cover is above the mattress, not coplanar with it',()=>{
 const pod=createPropFactory({})('pod','home',false);pod.updateMatrixWorld(true);
 const ray=new THREE.Raycaster(new THREE.Vector3(0,3,1.05),new THREE.Vector3(0,-1,0));
 const hits=ray.intersectObject(pod,true),byMesh=new Map();
 for(const hit of hits)if(!byMesh.has(hit.object))byMesh.set(hit.object,hit);
 const surfaces=[...byMesh.values()];
 const cover=surfaces.find(h=>h.object.material.color.getHex()===colors.mint);
 const mattress=surfaces.find(h=>h.object.material.color.getHex()===colors.purple);
 assert.ok(cover&&mattress);
 assert.ok(cover.point.y-mattress.point.y>.015,`cover ${cover.point.y}, mattress ${mattress.point.y}`);
});
