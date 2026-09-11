import test from 'node:test';
import assert from 'node:assert/strict';
import {
 DEVICE_CLASSES,
 QUALITY_LEVELS,
 detectDeviceClass,
 getQualityProfile,
 scoreDevice,
} from '../src/performance-settings.js';

test('device classes separate desktop, new mobile, and old mobile hardware',()=>{
 assert.equal(detectDeviceClass({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',hardwareConcurrency:8,viewportWidth:1440}),DEVICE_CLASSES.pc);
 assert.equal(detectDeviceClass({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',hardwareConcurrency:8,viewportWidth:634}),DEVICE_CLASSES.pc);
 assert.equal(detectDeviceClass({userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',hardwareConcurrency:6,deviceMemory:6,viewportWidth:390}),DEVICE_CLASSES.mobileNew);
 assert.equal(detectDeviceClass({userAgent:'Mozilla/5.0 (Linux; Android 9; Mobile)',hardwareConcurrency:4,deviceMemory:2,viewportWidth:360}),DEVICE_CLASSES.mobileOld);
});

test('each device class exposes ordered low, medium, and high render profiles',()=>{
 for(const deviceClass of Object.values(DEVICE_CLASSES)){
  const profiles=QUALITY_LEVELS.map(level=>getQualityProfile(deviceClass,level));
  assert.deepEqual(profiles.map(profile=>profile.level),QUALITY_LEVELS);
  assert.ok(profiles[0].weatherDensity<profiles[1].weatherDensity);
  assert.ok(profiles[1].weatherDensity<profiles[2].weatherDensity);
  assert.ok(profiles[0].shadowMapSize<=profiles[1].shadowMapSize);
  assert.ok(profiles[1].shadowMapSize<=profiles[2].shadowMapSize);
  assert.ok(profiles[0].maxPixelRatio<=profiles[1].maxPixelRatio);
  assert.ok(profiles[1].maxPixelRatio<=profiles[2].maxPixelRatio);
 }
});

test('high desktop profile keeps the full visual budget',()=>{
 const profile=getQualityProfile(DEVICE_CLASSES.pc,'high');
 assert.equal(profile.shadows,true);
 assert.equal(profile.treeAnimation,'full');
 assert.equal(profile.weatherDensity,1);
 assert.equal(profile.modelLod,'off');
 assert.equal(profile.textureQuality,'high');
});

test('high preset preserves the original visual budget on every device class',()=>{
 for(const deviceClass of Object.values(DEVICE_CLASSES)){
  const profile=getQualityProfile(deviceClass,'high');
  assert.deepEqual(profile,{level:'high',shadows:true,shadowMapSize:2048,treeAnimation:'full',weatherDensity:1,fogDensity:1,modelLod:'off',modelLodDistance:Infinity,textureQuality:'high',textureAnisotropy:1,maxPixelRatio:1.75});
 }
});

test('device score rewards CPU, memory, and a modern GPU without exceeding 100',()=>{
 const high=scoreDevice({hardwareConcurrency:12,deviceMemory:24,webglRenderer:'Apple M3 GPU',viewportWidth:1440,viewportHeight:1000,devicePixelRatio:1});
 const low=scoreDevice({hardwareConcurrency:2,deviceMemory:2,webglRenderer:'SwiftShader',viewportWidth:1440,viewportHeight:1000,devicePixelRatio:1});
 assert.ok(high>low);
 assert.ok(high<=100);
 assert.ok(low>=0);
});
