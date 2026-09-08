import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {prayerFixture} from '../tests/helpers/prayer-fixture.js';

await mkdir('artifacts',{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1100,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://127.0.0.1:5173/prayer-preview',r=>r.fulfill({contentType:'text/html',body:'<html><body style="margin:0"></body></html>'}));
 await page.goto('http://127.0.0.1:5173/prayer-preview');
 await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
  const {createCharacter,updateCharacter}=await import('/src/character-rig.js');
  const {stylizeAsset,createPostProcessing}=await import('/src/npr.js');
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1100,900);renderer.toneMapping=THREE.ACESFilmicToneMapping;document.body.append(renderer.domElement);
  const asset=await new GLTFLoader().loadAsync('/assets/alien.glb');stylizeAsset(asset.scene,{character:true});
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x101829);scene.add(new THREE.HemisphereLight(0xc5deff,0x42374b,2));
  const light=new THREE.DirectionalLight(0xffe6cf,3);light.position.set(-3,5,-4);scene.add(light);
  const camera=new THREE.PerspectiveCamera(36,1100/900,.1,60);camera.position.set(2.7,1.85,3.5);camera.lookAt(0,.85,0);
  const ground=new THREE.Mesh(new THREE.CircleGeometry(2,64),new THREE.MeshStandardMaterial({color:0x263442}));ground.rotation.x=-Math.PI/2;ground.position.y=-.01;scene.add(ground);
  const composer=createPostProcessing(renderer,scene,camera);composer.setSize(1100,900);let rig,lastElapsed=null;
  window.drawPrayer=(state,elapsed=null,standing=false)=>{
   const person=state.player,action=standing?undefined:state.queue[0],object=state.objects.find(o=>o.type==='spiritTree');
   if(!rig){rig=createCharacter(asset.scene,person);scene.add(rig.root);}if(action&&elapsed!==null)action.elapsed=elapsed;
   updateCharacter(rig,{person,action,object,time:20+(elapsed??0),delta:elapsed!==lastElapsed?1:0,config:state.config});
   lastElapsed=elapsed;rig.root.position.set(0,0,0);rig.root.rotation.y=standing?0:2.6;rig.root.updateMatrixWorld(true);
   if(standing){camera.position.set(2,1.9,4.6);camera.lookAt(0,1.2,0);}else{camera.position.set(2.7,1.85,3.5);camera.lookAt(0,.85,0);}
   composer.render();return renderer.domElement.toDataURL();
  };
 });
 for(const side of ['front','back']){
  for(const success of [false,true]){
   const state=prayerFixture(side,{success});const first=await page.evaluate(s=>window.drawPrayer(s),state);
   await page.screenshot({path:`artifacts/prayer-${side}-${success?'blessing':'kneel'}.png`});
   assert.ok(first===await page.evaluate(s=>window.drawPrayer(s),state),'Frozen pose and effects must reproduce identical pixels');
   if(success)assert.ok(first!==await page.evaluate(s=>window.drawPrayer(s,2.5),state),'Blessing animation must progress');
  }
 }
 const nether=prayerFixture('back',{success:true});await page.evaluate(s=>window.drawPrayer(s,null,true),nether);await page.screenshot({path:'artifacts/nether-mutations.png'});
 assert.deepEqual(errors,[]);console.log('Both kneeling poses, animated blessings, nether tattoo and stacked mutations rendered without errors.');
}finally{await browser.close();}
