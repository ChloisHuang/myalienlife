import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1000,height:700}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/__toon-lighting',route=>route.fulfill({contentType:'text/html',body:`
 <style>body{margin:0}canvas{display:block}</style>
 <script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script>
 <script type="module">
 import * as THREE from 'three';
 import {GLTFLoader} from '/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
 import {StarToonMaterial,stylizeAsset} from '/src/npr.js';
 import {createCharacter,updateCharacter} from '/src/character-rig.js';
 import {defaultGenome} from '/src/genetics.js';
 const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1000,700);renderer.toneMapping=THREE.ACESFilmicToneMapping;document.body.append(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-3,3,2.1,-2.1,.1,30);camera.position.set(0,1,8);camera.lookAt(0,1,0);
 const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(0,1,8);scene.add(key);
 const patch=new THREE.Mesh(new THREE.PlaneGeometry(4,4),new StarToonMaterial({color:0xffffff}));patch.position.y=1;scene.add(patch);
 window.sample=(intensity,color)=>{key.intensity=intensity;key.color.set(color);renderer.render(scene,camera);const gl=renderer.getContext(),pixel=new Uint8Array(4);gl.readPixels(500,350,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);return [...pixel].slice(0,3);};
 const source=(await new GLTFLoader().loadAsync('/assets/alien.glb')).scene;stylizeAsset(source,{character:true});
 const rigs=['#f4c16d','#91dab9','#edabbf'].map((color,i)=>{
  const person={id:'lighting'+i,color,gender:'female',age:28,genome:defaultGenome(),x:0,z:0};
  const rig=createCharacter(source,person);updateCharacter(rig,{person,time:0,delta:0});rig.root.position.set((i-1)*1.8,-.08,0);rig.root.visible=false;scene.add(rig.root);return rig;
 });
 const ambient=new THREE.HemisphereLight(0xe2eaff,0x70526e,0);scene.add(ambient);
 const rim=new THREE.DirectionalLight(0xdacbff,0);rim.position.set(12,6,-16);scene.add(rim);
 const glow=new THREE.PointLight(0x83e5d4,0,6,2);glow.position.set(-2,.85,1.5);scene.add(glow);
 window.review=mode=>{patch.visible=false;rigs.forEach(r=>r.root.visible=true);const day=mode==='day';
  key.position.set(-10,24,14);key.intensity=day?2.6:.65;key.color.set(day?0xffe5d0:0x8895df);
  ambient.intensity=day?1.3:.884;ambient.color.set(day?0xe2eaff:0x8194c8);rim.intensity=day?1.2:1.5;rim.color.set(day?0xdacbff:0x60bfc6);glow.intensity=mode==='glow'?16:0;
  scene.background=new THREE.Color(day?0xb9b3cc:0x10152e);renderer.render(scene,camera);
 };window.ready=true;
 </script>`}));
 await page.goto('http://127.0.0.1:5173/__toon-lighting');await page.waitForFunction(()=>window.ready);
 const samples={};for(const [name,intensity,color]of [['unlit',0,0xffffff],['dim',.15,0xffffff],['bright',3,0xffffff],['cyan',.15,0x20ddff]])samples[name]=await page.evaluate(([i,c])=>window.sample(i,c),[intensity,color]);
 assert.ok(Math.max(...samples.unlit)<=1,'Non-emissive material must be dark without lights');
 assert.ok(samples.dim[1]<samples.bright[1]*.6,'Weak lights must produce substantially darker shading');
 assert.ok(samples.cyan[2]>samples.cyan[0]*2,'Colored illumination must affect reflected color');
 for(const mode of ['day','back','glow']){await page.evaluate(mode=>window.review(mode),mode);await page.screenshot({path:`artifacts/toon-lighting-${mode}.png`});}
 assert.deepEqual(errors,[]);console.log(JSON.stringify(samples));
}finally{await browser.close();}
