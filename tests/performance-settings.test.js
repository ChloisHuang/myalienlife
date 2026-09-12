import test from 'node:test';
import assert from 'node:assert/strict';
import {
 DEVICE_CLASSES,
 QUALITY_LEVELS,
 createDynamicResolutionController,
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

test('dynamic resolution lowers pixel ratio only after sustained slow frames',()=>{
 const controller=createDynamicResolutionController({devicePixelRatio:2,maxPixelRatio:1.75,warmupMs:0,sampleCount:10,downCooldownMs:0,upCooldownMs:0});
 for(let i=0;i<9;i++)assert.equal(controller.sample(34,i*34),null);
 assert.equal(controller.sample(34,9*34),1.6);
 assert.equal(controller.pixelRatio,1.6);
});

test('dynamic resolution ignores isolated long frames and uses hysteresis before recovering quality',()=>{
 const controller=createDynamicResolutionController({devicePixelRatio:2,maxPixelRatio:1.75,warmupMs:0,sampleCount:10,downCooldownMs:0,upCooldownMs:0});
 for(const [i,frameMs] of [16,16,16,16,120,16,16,16,16,16].entries())controller.sample(frameMs,i*16);
 assert.equal(controller.pixelRatio,1.75);
 for(let i=0;i<10;i++)controller.sample(34,1000+i*34);
 assert.equal(controller.pixelRatio,1.6);
 for(let i=0;i<10;i++)controller.sample(20,2000+i*20);
 assert.equal(controller.pixelRatio,1.6);
 for(let i=0;i<10;i++)controller.sample(16,3000+i*16);
 assert.equal(controller.pixelRatio,1.7);
});

test('dynamic resolution never exceeds the quality/device ceiling or drops below 1x',()=>{
 const controller=createDynamicResolutionController({devicePixelRatio:2,maxPixelRatio:1.75,warmupMs:0,sampleCount:4,downCooldownMs:0,upCooldownMs:0});
 for(let batch=0;batch<10;batch++)for(let i=0;i<4;i++)controller.sample(40,batch*100+i*40);
 assert.equal(controller.pixelRatio,1);
 for(let batch=0;batch<20;batch++)for(let i=0;i<4;i++)controller.sample(10,5000+batch*100+i*10);
 assert.equal(controller.pixelRatio,1.75);
 const standardDpr=createDynamicResolutionController({devicePixelRatio:1,maxPixelRatio:1.75,warmupMs:0,sampleCount:4,downCooldownMs:0,upCooldownMs:0});
 for(let i=0;i<20;i++)standardDpr.sample(40,i*40);
 assert.equal(standardDpr.pixelRatio,1);
});

test('default dynamic resolution converges quickly when high-DPI rendering is persistently slow',()=>{
 const controller=createDynamicResolutionController({devicePixelRatio:2,maxPixelRatio:1.75});
 for(let i=0;i<125;i++)controller.sample(40,i*40);
 assert.ok(controller.pixelRatio<=1.15,`expected <= 1.15 after 5s of sustained 25 FPS, got ${controller.pixelRatio}`);
});
