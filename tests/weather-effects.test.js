import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWeatherEffects} from '../src/weather-effects.js';

globalThis.devicePixelRatio=1;

test('weather quality scales rain geometry, splash geometry, and mist layers',()=>{
 const scene=new THREE.Scene(),effects=createWeatherEffects(scene,()=>.5);
 assert.equal(typeof effects.setQuality,'function');
 effects.setQuality({weatherDensity:.25,fogDensity:.5});
 effects.update(1,{weights:{rain:1,mist:1},wind:.2});
 const rain=scene.children.find(node=>node.isLineSegments),splashes=scene.children.find(node=>node.isPoints),mist=scene.children.find(node=>node.isGroup);
 assert.equal(rain.geometry.drawRange.count,210);
 assert.equal(splashes.geometry.drawRange.count,Math.floor(splashes.geometry.getAttribute('position').count*.25));
 assert.equal(mist.children.filter(node=>node.visible).length,1);
});
