import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

await mkdir('artifacts',{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1000,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://127.0.0.1:5173/mutation-preview',r=>r.fulfill({contentType:'text/html',body:'<html><body style="margin:0"></body></html>'}));
 await page.goto('http://127.0.0.1:5173/mutation-preview');
 await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
  const {createCharacter,updateCharacter}=await import('/src/character-rig.js');
  const {createGame}=await import('/src/simulation.js');
  const {stylizeAsset,createPostProcessing}=await import('/src/npr.js');
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1000,900);renderer.toneMapping=THREE.ACESFilmicToneMapping;document.body.append(renderer.domElement);
  const asset=await new GLTFLoader().loadAsync('/assets/alien.glb');stylizeAsset(asset.scene,{character:true});
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x0c1426);scene.add(new THREE.HemisphereLight(0xc5deff,0x42374b,1.5));
  const light=new THREE.DirectionalLight(0xffe6cf,2);light.position.set(-3,5,4);scene.add(light);
  const camera=new THREE.PerspectiveCamera(36,1000/900,.1,60);
  const composer=createPostProcessing(renderer,scene,camera);composer.setSize(1000,900);const bloom=composer.passes[1];
  const person=createGame().player;person.x=0;person.z=5;const rig=createCharacter(asset.scene,person);scene.add(rig.root);
  const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=900;const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const pixels=()=>{ctx.drawImage(renderer.domElement,0,0);return ctx.getImageData(0,0,1000,900).data;};
  const maskMaterial=new THREE.MeshBasicMaterial({color:0xffffff});
  function draw(mutations,nether,back){
   person.prayer={nether,mutations};updateCharacter(rig,{person,time:20,delta:0});rig.root.position.set(0,0,0);rig.root.rotation.y=0;rig.root.updateMatrixWorld(true);
   camera.position.set(back?-2:2,1.9,back?-4.6:4.6);camera.lookAt(0,1.2,0);
  }
  function haloPixels(){
   bloom.enabled=false;composer.render();const sharp=pixels();bloom.enabled=true;composer.render();const glowing=pixels();
   const background=scene.background;scene.background=new THREE.Color(0);scene.overrideMaterial=maskMaterial;bloom.enabled=false;composer.render();const mask=pixels();
   scene.background=background;scene.overrideMaterial=null;bloom.enabled=true;
   let count=0;
   for(let i=0;i<mask.length;i+=4)if(mask[i]<20&&Math.max(glowing[i]-sharp[i],glowing[i+1]-sharp[i+1],glowing[i+2]-sharp[i+2])>=8)count++;
   return count;
  }
  window.measureMutation=key=>{
   // Existing antenna bulbs cannot satisfy a mutation's halo regression.
   for(const side of ['Left','Right'])rig.body.getObjectByName(side+'AntennaLight').visible=false;
   const back=key==='spines';draw([],0,back);const baseline=haloPixels();draw(key==='nether'?[]:[key],key==='nether'?10:0,back);const changed=haloPixels();
   for(const side of ['Left','Right'])rig.body.getObjectByName(side+'AntennaLight').visible=true;
   composer.render();return {key,baseline,changed,extraHaloPixels:changed-baseline};
  };
  window.drawAllMutations=back=>{draw(['crown','spines','freckles','eyes'],10,back);composer.render();};
 });
 const results=[];
 for(const key of ['crown','spines','freckles','eyes','nether']){
  const result=await page.evaluate(key=>window.measureMutation(key),key);results.push(result);
  await page.screenshot({path:`artifacts/mutation-glow-${key}.png`});
 }
 for(const back of [false,true]){await page.evaluate(back=>window.drawAllMutations(back),back);await page.screenshot({path:`artifacts/mutation-glow-all-${back?'back':'front'}.png`});}
 console.log(JSON.stringify(results));await writeFile('artifacts/mutation-glow-check.json',JSON.stringify(results,null,2));
 assert.deepEqual(errors,[]);assert.deepEqual(results.filter(r=>r.extraHaloPixels<80).map(r=>r.key),[],'Each mutation must produce visible bloom beyond its geometry');
}finally{await browser.close();}
