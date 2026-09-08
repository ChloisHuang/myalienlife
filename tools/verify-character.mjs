import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';

// A close view of the shipped asset and production rig, using the game's daylight.
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:800}}),errors=[];page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/__character-review',route=>route.fulfill({contentType:'text/html',body:`<style>body{margin:0;background:#ece5ef}canvas{display:block}</style><script type="module">
 import * as THREE from '/node_modules/three/build/three.module.js';
 import {GLTFLoader} from '/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
 import {createCharacter,updateCharacter} from '/src/character-rig.js';
 import {defaultGenome} from '/src/genetics.js';
 import {stylizeAsset} from '/src/npr.js';
 const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1200,800);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;document.body.append(renderer.domElement);
 const scene=new THREE.Scene();scene.background=new THREE.Color('#ece5ef');const camera=new THREE.OrthographicCamera(-3.6,3.6,2.4,-2.4,.1,50);camera.position.set(5,3.4,10);camera.lookAt(0,1,0);
 scene.add(new THREE.HemisphereLight(0xe2eaff,0x70526e,1.3));const sun=new THREE.DirectionalLight(0xffe5d0,2.6);sun.position.set(-10,24,14);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.normalBias=.025;scene.add(sun);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshStandardMaterial({color:0xe2d8e7,roughness:.9}));ground.rotation.x=-Math.PI/2;ground.position.y=-.08;ground.receiveShadow=true;scene.add(ground);
 const source=(await new GLTFLoader().loadAsync('/assets/alien.glb')).scene;stylizeAsset(source,{character:true});
 const people=['#91dab9','#dc9dbf','#b6a5df'].map((color,i)=>({id:'review'+i,color,gender:'female',age:28,genome:defaultGenome(),x:(i-1)*2,z:5}));
 const rigs=people.map(p=>{const rig=createCharacter(source,p);scene.add(rig.root);return rig;});
 window.renderPose=(time,delta)=>{people.forEach((p,i)=>{p.z=5+time*.55;updateCharacter(rigs[i],{person:p,action:{type:'walk',phase:'walking'},time,delta});rigs[i].root.position.set((i-1)*2,-.08,0);rigs[i].root.rotation.y=[.2,1.15,-.55][i];rigs[i].root.updateMatrixWorld(true);});renderer.render(scene,camera);};
 window.renderPose(0,0);window.ready=true;
 window.renderLighting=mode=>{
  const ambient=scene.children.find(n=>n.isHemisphereLight);
  sun.intensity=mode==='night'?.65:mode==='back'?.65*.25:2.6;
  sun.color.set(mode==='back'?0x8895df:0xffe5d0);
  ambient.intensity=mode==='back'?.85*.68:mode==='night'?.85:1.3;
  ambient.color.set(mode==='back'?0x8194c8:0xe2eaff);
  scene.background.set(mode==='day'?'#ece5ef':'#171c39');renderer.render(scene,camera);
 };
 </script><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script>`}));
 await page.goto('http://127.0.0.1:5173/__character-review');await page.waitForFunction(()=>window.ready);
 for(let frame=1;frame<=45;frame++)await page.evaluate(frame=>window.renderPose(frame/60,1/60),frame);
 await page.screenshot({path:'artifacts/character-closeup.png'});
 const video=await page.evaluate(async()=>{
  const stream=document.querySelector('canvas').captureStream(30),recorder=new MediaRecorder(stream,{mimeType:'video/webm'}),chunks=[];recorder.ondataavailable=e=>chunks.push(e.data);
  const done=new Promise(resolve=>recorder.onstop=resolve);recorder.start();let previous=performance.now(),elapsed=45/60;
  await new Promise(resolve=>{function frame(now){const delta=Math.min((now-previous)/1000,.05);previous=now;elapsed+=delta;window.renderPose(elapsed,delta);if(elapsed<4.6)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});
  recorder.stop();await done;stream.getTracks().forEach(t=>t.stop());const bytes=new Uint8Array(await new Blob(chunks).arrayBuffer());let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary);
 });
 await writeFile('artifacts/character-walk-closeup.webm',Buffer.from(video,'base64'));
 for(const mode of ['night','back']){await page.evaluate(mode=>window.renderLighting(mode),mode);await page.screenshot({path:`artifacts/character-${mode}-closeup.png`});}
 if(errors.length)throw new Error(errors.join('\n'));console.log('CHARACTER_CLOSEUP_VERIFIED');
}finally{await browser.close();}

