import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {Group,Mesh,BoxGeometry,MeshStandardMaterial,Scene,OrthographicCamera,Texture,Matrix4} from 'three';
import {createWeatherEffects} from '../src/weather-effects.js';
import {createAtmosphere} from '../src/npr.js';
import {createOceanKit,createOceanWater,createOceanFragments,createOceanCaustics} from '../src/ocean.js';
import {OCEAN_WATER,oceanHeight,oceanFrontLand} from '../src/ocean-definition.js';

test('underwater face has no surface disk or waterfall curtain',()=>{
 const w=OCEAN_WATER.back;assert.ok(w.rx*w.rz/(14.6*10.4)>.95);
 const water=createOceanWater('back');assert.equal(water.surface.position.y,w.y);
 water.update(12);assert.equal(water.surface.material.uniforms.time.value,12);
 assert.ok(water.surface.material.transparent);assert.equal(water.surface.material.depthWrite,false);
 assert.equal(water.root.children.length,0);
 water.dispose();
});
test('front outlet has no isolated waterfall panel',()=>{
 const water=createOceanWater('front');
 assert.ok(!water.root.children.some(o=>o.geometry?.parameters.height===1.6));water.dispose();
});
test('dynamic ocean caustics use bounded turbulence in the shared 30 Hz pass',()=>{
 let renders=0,current=null;const renderer={getRenderTarget:()=>current,setRenderTarget:value=>{current=value;},render:()=>{renders++;}};
 const caustics=createOceanCaustics(renderer,{size:384,hz:30});
 assert.equal(caustics.target.width,384);assert.equal(caustics.target.height,384);assert.equal(caustics.texture.isTexture,true);
 const shader=caustics.material.fragmentShader;
 assert.match(shader,/n<5/);assert.match(shader,/sin\(/);assert.match(shader,/cos\(/);
 assert.doesNotMatch(shader,/perlinNoise|refract\(|dFdx|dFdy/);
 caustics.update(0,true);assert.equal(renders,1);caustics.update(.01,true);assert.equal(renders,1);caustics.update(.04,true);assert.equal(renders,2);caustics.update(.08,false);assert.equal(renders,2);
 caustics.dispose();
});
test('ocean caustics sample one shared texture instead of procedural hash loops',()=>{
 const caustics=new Texture(),water=createOceanWater('front',caustics),shader=water.surface.material.fragmentShader;
 assert.equal(water.surface.material.uniforms.causticsMap.value,caustics);
 assert.match(shader,/texture2D\(causticsMap/);assert.doesNotMatch(shader,/oceanHash|for\(int y=-1/);
 water.dispose();caustics.dispose();
});

test('ocean kit preserves the dynamic render target sampler without requiring missing mip levels',()=>{
 const caustics=createOceanCaustics({}),ground=new Texture();
 const {minFilter,magFilter,generateMipmaps,version}=caustics.texture;
 createOceanKit(new Group(),ground,caustics.texture);
 assert.equal(caustics.texture.minFilter,minFilter);
 assert.equal(caustics.texture.magFilter,magFilter);
 assert.equal(caustics.texture.generateMipmaps,generateMipmaps);
 assert.equal(caustics.texture.version,version);
 caustics.dispose();ground.dispose();
});

test('submerged PBR materials share the same caustics texture',()=>{
 const asset=new Group(),node=new Group();node.name='ocean-back';
 node.add(new Mesh(new BoxGeometry(),new MeshStandardMaterial({name:'lagoonBed'})));asset.add(node);
 const ground=new Texture(),caustics=new Texture(),terrain=createOceanKit(asset,ground,caustics).terrain('back');
 let material;terrain.root.traverse(o=>{if(o.isMesh&&o.material.name==='lagoonBed')material=o.material;});
 const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>'};material.onBeforeCompile(shader);
 assert.equal(shader.uniforms.causticsMap.value,caustics);assert.match(shader.fragmentShader,/texture2D\(causticsMap/);assert.doesNotMatch(shader.fragmentShader,/oceanHash|for\(int y=-1/);
 terrain.dispose();ground.dispose();caustics.dispose();
});
test('submerged weather suppresses rain and ground mist but restores them above water',()=>{
 const scene=new Scene(),weather=createWeatherEffects(scene,()=>.5),rain={weights:{rain:1,mist:1},wind:1};
 weather.update(1,rain,0);assert.ok(scene.children.every(o=>!o.visible));
 weather.update(2,rain,1);assert.ok(scene.children.every(o=>o.visible));
});
test('fish swim above the ruins and bubbles occupy the water column',()=>{
 const asset=new Group(),node=new Group();node.name='ocean-back';asset.add(node);
 const terrain=createOceanKit(asset,new Texture()).terrain('back');terrain.update(4);
 const fish=terrain.root.getObjectByName('ocean-midwater-fish'),matrix=new Matrix4();
 for(let i=0;i<fish.count;i++){fish.getMatrixAt(i,matrix);assert.ok(matrix.elements[13]>2.4);}
 assert.ok(terrain.root.getObjectByName('ocean-rising-bubbles'));terrain.dispose();
});
test('jellyfish and their tentacles clear the authored ruin columns',()=>{
 const asset=new Group(),node=new Group();node.name='ocean-back';asset.add(node);
 const terrain=createOceanKit(asset,new Texture()).terrain('back');terrain.update(4);
 const columns=[[-4,-1],[-1,-2],[2,0],[5,3],[-2,5],[7,1],[-6,3],[1,6],[5,6],[-9,5]];
 terrain.root.traverse(o=>{if(o.name==='ocean-glowing-jellyfish')for(const [x,z]of columns)assert.ok(Math.hypot(o.position.x-x,o.position.z-z)>1.1);});
 terrain.dispose();
});
test('authored stages stay independent and item pack is not a scenery alias',()=>{
 const asset=new Group();for(const name of ['ocean-front','ocean-back','oceanPearlLamp']){
  const root=new Group();root.name=name;const stage=new Group();stage.userData.revealAt=1;
  stage.add(new Mesh(new BoxGeometry(),new MeshStandardMaterial()));root.add(stage);asset.add(root);
 }
 const kit=createOceanKit(asset,new Texture()),front=kit.terrain('front'),back=kit.terrain('back');
 front.setProgress(.5);back.setProgress(1);
 assert.equal(front.root.getObjectByProperty('visible',false)?.userData.revealAt,1);
 assert.equal(back.root.children[0].children[0].visible,true);
 assert.equal(kit.prop('ocean-palace','ocean'),null);
 assert.ok(kit.prop('oceanPearlLamp','home'));
 front.dispose();back.dispose();
});

test('shore ground uses the actual albedo texture with world-scaled UVs',()=>{
 const asset=new Group(),node=new Group();node.name='ocean-front';
 const material=new MeshStandardMaterial({name:'sand'});node.add(new Mesh(new BoxGeometry(),material));asset.add(node);
 const texture=new Texture(),terrain=createOceanKit(asset,texture).terrain('front');
 let shore;terrain.root.traverse(o=>{if(o.isMesh&&o.material.name==='sand')shore=o;});
 assert.equal(shore.material.map,texture);assert.ok(shore.geometry.getAttribute('uv'));
 assert.equal(shore.material.color.getHex(),0xffffff);terrain.dispose();texture.dispose();
});

test('ground material ships as one small shared WebP, not the source PNG',()=>{
 const bytes=readFileSync(new URL('../public/assets/ocean-ground.webp',import.meta.url));
 assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.ok(bytes.length<48*1024);
 assert.equal(existsSync(new URL('../public/assets/ocean-ground.png',import.meta.url)),false);
});

test('dynamic caustics do not ship the rejected static texture',()=>{
 assert.equal(existsSync(new URL('../public/assets/ocean-caustics.png',import.meta.url)),false);
});

test('lighthouse flame emits light without brightening the cottage glass material',()=>{
 const asset=new Group(),root=new Group();root.name='ocean-front';asset.add(root);
 const glass=new MeshStandardMaterial({name:'ocean warm glass',emissive:0xffdda6,emissiveIntensity:.35});
 for(const revealAt of [.4,1]){const stage=new Group();stage.userData.revealAt=revealAt;stage.add(new Mesh(new BoxGeometry(),glass));root.add(stage);}
 const terrain=createOceanKit(asset,new Texture()).terrain('front'),strengths=[];
 terrain.root.traverse(o=>{if(o.isMesh&&o.material.name==='ocean warm glass')strengths.push(o.material.emissiveIntensity);});
 assert.deepEqual(strengths.sort((a,b)=>a-b),[.35,2.3]);
 const light=terrain.root.getObjectByName('ocean-lighthouse-beacon');assert.equal(light.isPointLight,true);
 terrain.setProgress(.8);assert.equal(light.visible,false);terrain.setProgress(1);assert.equal(light.visible,true);terrain.dispose();
});

test('ocean atmosphere selects its own underwater sky instead of the default star field',()=>{
 globalThis.devicePixelRatio=1;
 const scene=new Scene(),camera=new OrthographicCamera(-20,20,15,-15),a=createAtmosphere(scene,camera,()=>.5);
 a.update(12,{weights:{rain:0,mist:0,spores:0},wind:0},0,false,true);
 const sky=camera.children.find(o=>o.isMesh);
 assert.equal(sky.material.uniforms.ocean?.value,1);
 const bubbles=camera.getObjectByName('ocean-immersion-bubbles');assert.equal(bubbles.visible,false);
 a.update(12,{weights:{rain:0,mist:0,spores:0},wind:0},.5,false,true);assert.equal(bubbles.visible,false);
 a.update(12,{weights:{rain:0,mist:0,spores:0},wind:0},1,false,true);assert.equal(bubbles.visible,false);
 a.update(12,{weights:{rain:0,mist:0,spores:0},wind:0},.5,false,true);assert.equal(bubbles.visible,true);
 a.update(12,{weights:{rain:0,mist:0,spores:0},wind:0},1,true,false);
 assert.equal(sky.material.uniforms.ocean.value,0);
});

test('entry bubbles stop spawning when the flip ends and drain offscreen',()=>{
 globalThis.devicePixelRatio=1;
 const scene=new Scene(),camera=new OrthographicCamera(-20,20,15,-15),a=createAtmosphere(scene,camera,()=>.5);
 const weather={weights:{rain:0,mist:0,spores:0},wind:0};
 a.update(0,weather,1,false,true);a.update(.5,weather,.5,false,true);a.update(1,weather,0,false,true);
 const bubbles=camera.getObjectByName('ocean-immersion-bubbles');assert.equal(bubbles.visible,true);
 a.update(1.25,weather,0,false,true);assert.equal(bubbles.visible,true);
 const uniforms=bubbles.material.uniforms;
 assert.equal(uniforms.bubbleStopAge.value,.5);
 a.update(1.5,weather,0,false,true);assert.equal(bubbles.visible,true);
 a.update(2.5,weather,0,false,true);assert.equal(bubbles.visible,true);
 assert.equal(uniforms.bubbleAge.value,2);assert.equal(uniforms.bubbleStopAge.value,.5);
 a.update(9,weather,0,false,true);assert.equal(bubbles.visible,false);
 a.update(10,weather,.5,false,true);assert.equal(bubbles.visible,false);
 a.update(11,weather,1,false,true);a.update(12,weather,.5,false,true);
 a.update(12.1,weather,0,false,false);assert.equal(bubbles.visible,false);
});

test('front silhouette is an open horseshoe with a sea-level outlet, not a closed plate',()=>{
 assert.equal(oceanFrontLand(0,0),false);
 assert.equal(oceanFrontLand(8,9),false);
 assert.equal(oceanFrontLand(-10,0),true);
 assert.equal(oceanFrontLand(7,-7),true);
 assert.ok(oceanHeight(-10,0,'front')>1.3);
 assert.ok(oceanHeight(8,9,'front')<.4);
 assert.equal(oceanHeight(-10,0,'back'),.29);
});

test('peripheral reefs use one instanced draw and preserve the source orbit objects',()=>{
 const source=new Mesh();source.geometry.parameters={radius:2};source.position.set(12,0,8);
 const fragments=createOceanFragments([source]);fragments.update(true);
 assert.equal(fragments.root.isInstancedMesh,true);assert.equal(fragments.root.count,3);
 assert.deepEqual(source.position.toArray(),[12,0,8]);
 fragments.update(false);assert.equal(fragments.root.visible,false);
 fragments.root.geometry.dispose();fragments.root.material.dispose();fragments.root.dispose();
});
