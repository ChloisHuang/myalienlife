import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createPrayerVisuals} from '../src/prayer-visuals.js';

test('nether keeps opaque skin and changes exactly one facial eye, reversibly',()=>{
 const body=new THREE.Group(),skin=new THREE.MeshStandardMaterial();skin.name='Alien skin';
 const mesh=new THREE.Mesh(new THREE.SphereGeometry(),skin);body.add(mesh);
 for(const side of ['Left','Right']){const eye=new THREE.Mesh(new THREE.SphereGeometry(),new THREE.MeshStandardMaterial({color:0x112233}));eye.name=side+'Eye';body.add(eye);}
 const visuals=createPrayerVisuals({body,limbs:{LeftLeg:{mesh}},joints:{Head:new THREE.Group(),Core:new THREE.Group()}});
 const person={prayer:{nether:10,radiance:10,mutations:['freckles']}};visuals.update(person);
 assert.equal(skin.opacity,1);assert.equal(skin.transparent,false);assert.equal(skin.depthWrite,true);
 assert.equal(body.getObjectByName('LeftEye').material.color.getHex(),0x112233);
 assert.equal(visuals.netherEye.value,1);assert.equal(visuals.dawnHalo.visible,true);assert.equal(visuals.skinUniforms.freckles.value,1);
 const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>\n#include <emissivemap_fragment>'};skin.onBeforeCompile(shader);
 assert.doesNotMatch(shader.fragmentShader,/spiritEye|uniform float nether/);
 const eyeShader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>\n#include <emissivemap_fragment>'};
 body.getObjectByName('RightEye').material.onBeforeCompile(eyeShader);
 assert.equal(eyeShader.uniforms.netherEye,visuals.netherEye);assert.match(eyeShader.fragmentShader,/irisRing/);
 visuals.update(person,0,'shadow');assert.ok(visuals.dawnHalo.scale.x<.7);assert.equal(visuals.netherEye.value,1);
 visuals.update(person,0,'light');assert.equal(visuals.dawnHalo.scale.x,1);assert.ok(visuals.netherEye.value<1);
 const ordinaryShader={uniforms:{}};body.getObjectByName('LeftEye').material.onBeforeCompile(ordinaryShader);assert.deepEqual(ordinaryShader.uniforms,{});
 person.prayer.nether=0;visuals.update(person);assert.equal(visuals.netherEye.value,0);visuals.dispose();
});
