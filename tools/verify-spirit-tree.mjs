import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';

await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1100,height:850}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 // A minimal document on the Vite origin exercises the production tree and renderer without loading or writing a game save.
 await page.route('http://127.0.0.1:5173/tree-preview',r=>r.fulfill({contentType:'text/html',body:'<html><body style="margin:0"></body></html>'}));
 await page.goto('http://127.0.0.1:5173/tree-preview');
 await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {createSpiritTree}=await import('/src/spirit-tree.js');
  const {createPostProcessing}=await import('/src/npr.js');
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1100,850);renderer.toneMapping=THREE.ACESFilmicToneMapping;document.body.append(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x080f21);
  const camera=new THREE.PerspectiveCamera(36,1100/850,.1,80);camera.position.set(8,5.5,11);camera.lookAt(0,2.8,0);
  const ambient=new THREE.HemisphereLight(0xc4e9ff,0x45344e,2);scene.add(ambient);
  const sun=new THREE.DirectionalLight(0xffe9ce,2);sun.position.set(-3,8,5);scene.add(sun);
  const ground=new THREE.Mesh(new THREE.CircleGeometry(4.4,80),new THREE.MeshStandardMaterial({color:0x283246,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.015;scene.add(ground);
  const tree=createSpiritTree();scene.add(tree);const composer=createPostProcessing(renderer,scene,camera);composer.setSize(1100,850);
  window.drawTree=(side,time)=>{ambient.intensity=side==='front'?2:.8;sun.intensity=side==='front'?2:.4;tree.userData.spiritTree.update(time,side,1,.5);composer.render();return renderer.domElement.toDataURL();};
  window.drawBlessing=(side,elapsed)=>{tree.userData.spiritTree.updateBlessing({type:'pray',phase:'celebrating',elapsed,blessing:{side}},camera);window.drawTree(side,7);return renderer.domElement.toDataURL();};
 });
 const front=await page.evaluate(()=>window.drawTree('front',7));await page.screenshot({path:'artifacts/spirit-tree-front.png'});
 const back=await page.evaluate(()=>window.drawTree('back',7));await page.screenshot({path:'artifacts/spirit-tree-back.png'});
 assert.notEqual(front,back,'Face palettes must produce different pixels');
 assert.equal(back,await page.evaluate(()=>window.drawTree('back',7)),'Paused simulation time must freeze the light');
 assert.notEqual(back,await page.evaluate(()=>window.drawTree('back',9)),'Advancing simulation time must animate the light');
 for(const side of ['front','back']){
  const closed=await page.evaluate(side=>window.drawBlessing(side,0),side);
  const opened=await page.evaluate(side=>window.drawBlessing(side,1.3),side);await page.screenshot({path:`artifacts/spirit-tree-eye-${side}.png`});
  assert.notEqual(opened,closed,'A successful prayer must open a visible eye on the tree');
  assert.equal(opened,await page.evaluate(side=>window.drawBlessing(side,1.3),side),'Pausing must freeze the blessing eye');
  const ended=await page.evaluate(side=>window.drawBlessing(side,4),side);
  const difference=await page.evaluate(async({closed,ended})=>{const images=await Promise.all([closed,ended].map(async src=>{const image=new Image();image.src=src;await image.decode();return image;}));const canvas=document.createElement('canvas');canvas.width=1100;canvas.height=850;const ctx=canvas.getContext('2d');const data=images.map(image=>{ctx.drawImage(image,0,0);return ctx.getImageData(0,0,1100,850).data;});let max=0,count=0;for(let i=0;i<data[0].length;i++){const delta=Math.abs(data[0][i]-data[1][i]);max=Math.max(max,delta);if(delta>2)count++;}return {max,count};},{closed,ended});console.log(side,difference);
  assert.equal(difference.count,0,'The eye must disappear when celebration ends');
 }
 assert.deepEqual(errors,[]);console.log('Tree shaders render; face lighting differs, pause freezes and time animates. Screenshots in artifacts/.');
}finally{await browser.close();}
