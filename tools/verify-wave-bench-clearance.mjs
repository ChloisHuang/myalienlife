import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';

const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1100,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5193/tools/wave-bench-preview.html');
 await page.locator('body[data-ready=true]').waitFor();
 const report=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {createGame}=await import('/src/simulation.js');
  const {createCharacter,updateCharacter}=await import('/src/character-rig.js');
  const {objectHeight}=await import('/src/characters.js');
  const {stylizeAsset}=await import('/src/npr.js');
  const {loader,scene,bench}=benchPreview,asset=(await loader.loadAsync('/assets/alien.glb')).scene;
  stylizeAsset(asset,{character:true});const game=createGame();
  const object={type:'sofa',x:0,z:0,rotation:0,side:'front',island:'ocean'},triangles=[];
  bench.updateMatrixWorld(true);
  bench.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.getAttribute('position'),index=o.geometry.index;
   for(let i=0;i<(index?.count??p.count);i+=3){const vertices=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i+j):i+j).applyMatrix4(o.matrixWorld));triangles.push({triangle:new THREE.Triangle(...vertices),material:o.material.name});}
  });
  const report=[];
  for(const seat of [0,1,2]){
   const person={...structuredClone(game.player),x:0,z:0,side:'front',island:'ocean'};
   const rig=createCharacter(asset,{...person,color:0xa9d5c3});
   updateCharacter(rig,{person,object,action:{id:'clearance',type:'relax',phase:'acting',elapsed:3,seat},time:3,delta:0,config:game.config});
   rig.root.position.y-=objectHeight(object);scene.add(rig.root);rig.root.updateMatrixWorld(true);
   const head=new THREE.Box3().setFromObject(rig.joints.Head,true).expandByScalar(.035);
   if(head.isEmpty())throw new Error('Character head bounds are empty');
   const hits=triangles.filter(t=>head.intersectsTriangle(t.triangle)),byMaterial={};
   for(const hit of hits){const entry=byMaterial[hit.material]??={count:0,center:new THREE.Vector3()};entry.count++;entry.center.add(hit.triangle.getMidpoint(new THREE.Vector3()));}
   for(const entry of Object.values(byMaterial))entry.center=entry.center.divideScalar(entry.count).toArray();
   report.push({seat,headMin:head.min.toArray(),headMax:head.max.toArray(),intersections:hits.length,byMaterial});
  }
  return report;
 });
 await page.screenshot({path:'artifacts/ocean/wave-bench-seated.png'});
 await page.evaluate(()=>{const{camera,controls}=benchPreview;camera.position.copy(controls.target).add({x:6,y:3,z:5});controls.update();});
 await page.screenshot({path:'artifacts/ocean/wave-bench-edge-seated.png'});
 await writeFile('artifacts/ocean/wave-bench-clearance.json',JSON.stringify(report,null,2));
 assert.deepEqual(errors,[]);
 for(const sample of report)assert.equal(sample.intersections,0,`seat ${sample.seat}: head plus 3.5 cm margin intersects the bench`);
 console.log(report);
}finally{await browser.close();}
