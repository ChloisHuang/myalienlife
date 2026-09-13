import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';

await mkdir('artifacts/ocean',{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 for(const [name,viewport] of [['desktop',{width:1100,height:1000}],['mobile',{width:390,height:844}]]){
  const page=await browser.newPage({viewport}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5193/tools/wave-bench-preview.html');
  await page.locator('body[data-ready=true]').waitFor();
  await page.evaluate(()=>new Promise(requestAnimationFrame));
  const metrics=await page.evaluate(async()=>{
   const {Box3,Vector3}=await import('/node_modules/three/build/three.module.js');
   const {bench,camera,renderer}=window.benchPreview,box=new Box3().setFromObject(bench);
   let inwardCrestVertices=0;
   bench.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.getAttribute('position');
    for(let i=0;i<p.count;i++){const v=new Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);if(v.y>1.5&&v.x>.1)inwardCrestVertices++;}
   });
   const corners=[];
   for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])corners.push(new Vector3(x,y,z).project(camera).toArray());
   const canvas=document.createElement('canvas');canvas.width=renderer.domElement.width;canvas.height=renderer.domElement.height;
   const ctx=canvas.getContext('2d');ctx.drawImage(renderer.domElement,0,0);
   const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;let turquoise=0;
   for(let i=0;i<pixels.length;i+=4)if(pixels[i+1]>pixels[i]*1.8&&pixels[i+2]>pixels[i]*1.8)turquoise++;
   return {corners,turquoise,inwardCrestVertices,triangles:renderer.info.render.triangles};
  });
  assert.ok(metrics.turquoise>10000,'visible turquoise geometry');
  assert.ok(metrics.inwardCrestVertices>20,'backrest wave crests curl forward over the seat, not sideways');
  assert.ok(metrics.corners.every(p=>Math.abs(p[0])<1&&Math.abs(p[1])<1),'bench fits the viewport');
  await page.screenshot({path:`artifacts/ocean/wave-bench-${name}.png`});
  const before=await page.evaluate(()=>window.benchPreview.camera.position.toArray());
  await page.mouse.move(viewport.width/2,viewport.height/2);await page.mouse.down();await page.mouse.move(viewport.width/2+80,viewport.height/2,{steps:10});await page.mouse.up();
  const after=await page.evaluate(()=>window.benchPreview.camera.position.toArray());
  assert.notDeepEqual(before,after,'orbit interaction rotates the preview');assert.deepEqual(errors,[]);
  console.log(name,JSON.stringify(metrics));await page.close();
 }
 const state=JSON.parse(await readFile('artifacts/ocean/preview-save/orbit-life.json','utf8')).state;
 state.viewIsland='ocean';state.viewSide='front';
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/save',route=>route.fulfill({json:{state,revision:0,savedAt:new Date().toISOString()}}));
 await page.goto('http://127.0.0.1:5193/');
 await page.locator('#world[data-island=ocean]').waitFor({timeout:120000});
 await page.screenshot({path:'artifacts/ocean/wave-bench-island.png'});
 await page.locator('#flip-island').click();
 await page.locator('#world[data-side=back][data-flipping=false]').waitFor({timeout:15000});
 assert.deepEqual(errors,[]);console.log('live ocean island loaded and flipped without errors');
 await page.close();
}finally{await browser.close();}
