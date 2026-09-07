import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {createGame} from '../src/simulation.js';
import {createPlant} from '../src/plants.js';
import assert from 'node:assert/strict';

const label=process.argv[2]||'npr';
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const state=createGame();state.speed=0;
await page.route('**/api/save',route=>route.fulfill({json:{state,revision:1,savedAt:null}}));
await page.goto('http://127.0.0.1:5173');
await page.locator('#loading').waitFor({state:'hidden',timeout:45000});
await page.waitForTimeout(800);
await page.screenshot({path:`artifacts/${label}-day.png`});
if(label!=='before'){
 const canvasFrame=()=>page.locator('#world canvas').evaluate(canvas=>canvas.toDataURL());
 const paused=await canvasFrame();await page.waitForTimeout(300);
 const pausedDiff=await page.evaluate(async before=>{
  const current=document.querySelector('#world canvas'),copy=document.createElement('canvas');copy.width=current.width;copy.height=current.height;
  const ctx=copy.getContext('2d'),image=new Image();image.src=before;await image.decode();ctx.drawImage(image,0,0);const a=ctx.getImageData(0,0,copy.width,copy.height).data;
  ctx.clearRect(0,0,copy.width,copy.height);ctx.drawImage(current,0,0);const b=ctx.getImageData(0,0,copy.width,copy.height).data;
  let pixels=0,max=0;for(let i=0;i<a.length;i+=4){const d=Math.max(...[0,1,2].map(k=>Math.abs(a[i+k]-b[i+k])));if(d>2)pixels++;max=Math.max(max,d);}return {pixels,max,total:a.length/4};
 },paused);console.log('Paused pixel difference',pausedDiff);assert.ok(pausedDiff.pixels/pausedDiff.total<.0001,'paused scene must freeze every effect');
 await page.keyboard.press('1');
 const record=()=>page.evaluate(async()=>{
  const stream=document.querySelector('#world canvas').captureStream(24),recorder=new MediaRecorder(stream,{mimeType:'video/webm'}),chunks=[];
  recorder.ondataavailable=e=>chunks.push(e.data);const done=new Promise(resolve=>recorder.onstop=resolve);
  const frames=[];let active=true;function measure(t){frames.push(t);if(active)requestAnimationFrame(measure);}requestAnimationFrame(measure);
  recorder.start();await new Promise(resolve=>setTimeout(resolve,5000));recorder.stop();await done;active=false;stream.getTracks().forEach(t=>t.stop());
  const data=new Uint8Array(await new Blob(chunks).arrayBuffer());let binary='';for(const b of data)binary+=String.fromCharCode(b);
  return {video:btoa(binary),fps:1000*(frames.length-1)/(frames.at(-1)-frames[0])};
 });
 const recording=await record();
 await writeFile(`artifacts/${label}-motion.webm`,Buffer.from(recording.video,'base64'));console.log('Desktop FPS',recording.fps.toFixed(1));
 assert.ok(await canvasFrame()!==paused,'running scene must animate');
 await page.getByRole('button',{name:'建造模式',exact:true}).click();
 await page.locator('#panel-content').getByRole('button',{name:'星际科技',exact:true}).click();
 await page.getByRole('button',{name:'购买 跃迁星门',exact:true}).click();
 await page.mouse.move(900,550);await page.keyboard.press('r');await page.waitForTimeout(150);await page.keyboard.press('Escape');
 state.minute=23*60;state.speed=0;await page.reload();await page.locator('#loading').waitFor({state:'hidden',timeout:45000});await page.waitForTimeout(500);
 await page.screenshot({path:`artifacts/${label}-night.png`});
 state.objects.find(o=>o.type==='garden').plant.growth=1;
 state.objects.push({id:'render-crystal',type:'crystal',x:5,z:4,rotation:0},{id:'render-mushroom',type:'mushroom',x:6,z:6,rotation:0,plant:{...createPlant(),growth:1}});
 await page.reload();await page.locator('#loading').waitFor({state:'hidden',timeout:45000});
 await page.locator('[data-location="garden"]').click();for(let i=0;i<6;i++)await page.locator('#zoom-in').click();await page.waitForTimeout(800);
 await page.screenshot({path:`artifacts/${label}-bioluminescence.png`});
 await page.keyboard.press('1');const bioRecording=await record();await writeFile(`artifacts/${label}-biocurrent.webm`,Buffer.from(bioRecording.video,'base64'));
 await page.getByRole('button',{name:'暂停',exact:true}).click();await page.screenshot({path:`artifacts/${label}-biocurrent-after.png`});
 const movingTissue=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js'),{BiolumeMaterial}=await import('/src/npr.js');
  const renderer=new THREE.WebGLRenderer({preserveDrawingBuffer:true});renderer.setSize(128,128);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,1,.1,10);camera.position.z=3;
  const material=new BiolumeMaterial({color:0xe8a1bc,emissive:0xdc9fc9,emissiveIntensity:1});material.bio.strength.value=1.5;
  const sphere=new THREE.Mesh(new THREE.SphereGeometry(.8,32,24),material);scene.add(sphere);
  const gl=renderer.getContext(),frames=[];
  for(const t of [0,1]){material.bio.time.value=t;renderer.render(scene,camera);const pixels=new Uint8Array(128*128*4);gl.readPixels(0,0,128,128,gl.RGBA,gl.UNSIGNED_BYTE,pixels);frames.push(pixels);}
  let changed=0;for(let i=0;i<frames[0].length;i+=4)if(Math.abs(frames[0][i]-frames[1][i])>5)changed++;
  sphere.geometry.dispose();material.dispose();renderer.dispose();return changed;
 });console.log('Stationary tissue pixels changed by current',movingTissue);assert.ok(movingTissue>100,'current must move across stationary tissue');
 await page.locator('#reset-view').click();await page.waitForTimeout(500);
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);await page.screenshot({path:`artifacts/${label}-mobile.png`});
}
await browser.close();console.log(JSON.stringify({errors}));if(errors.length)process.exitCode=1;
