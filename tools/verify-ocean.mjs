import {chromium} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {prepareIslandCapture} from './island-capture-fixture.js';

const browser=await chromium.launch({channel:'msedge',headless:true});
const source=JSON.parse(await readFile('artifacts/ocean/preview-save/orbit-life.json','utf8')).state;
const report=[];
async function isolateSave(page){
 let state=structuredClone(source),revision=0;state.viewIsland='ocean';state.viewSide='front';
 await page.route('**/api/save',route=>{
  if(route.request().method()==='POST'){state=route.request().postDataJSON().state;revision++;}
  return route.fulfill({json:{state,revision,savedAt:new Date().toISOString()}});
 });
}
try{
 for(const [name,viewport]of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
  for(const side of ['front','back']){
   const page=await browser.newPage({viewport,deviceScaleFactor:1}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
   await page.route('**/__island_capture.json',r=>r.fulfill({json:prepareIslandCapture(source,{islandNumber:3,side,seed:42})}));
   await page.route('**/src/world.js*',async route=>{
    const response=await route.fetch();let body=await response.text();
    body=body.replace('const createCrystalMesh=createCrystalFactory(renderer);','renderer.info.autoReset=false;globalThis.__oceanRenderer=renderer;globalThis.__oceanScene=scene;const createCrystalMesh=createCrystalFactory(renderer);');
    body=body.replace('composer.render();','renderer.info.reset();composer.render();');
    await route.fulfill({response,body});
   });
   await page.goto('http://127.0.0.1:5186/tools/island-capture.html');
   await page.locator('#world[data-ready=true]').waitFor({timeout:180000});
   await page.screenshot({path:`artifacts/ocean/${name}-${side}.png`});
   const metrics=await page.evaluate(()=>{
    const r=globalThis.__oceanRenderer,canvas=r.domElement,c=document.createElement('canvas');c.width=canvas.width;c.height=canvas.height;
    const ctx=c.getContext('2d');ctx.drawImage(canvas,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data,colors=new Set();
    for(let i=0;i<pixels.length;i+=128)colors.add(`${pixels[i]},${pixels[i+1]},${pixels[i+2]}`);
    return {calls:r.info.render.calls,triangles:r.info.render.triangles,geometries:r.info.memory.geometries,colors:colors.size};
   });
   assert.ok(metrics.colors>200,'blank canvas');assert.deepEqual(errors,[]);
   report.push({name,side,...metrics});await page.close();
  }
 }
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 await isolateSave(page);
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5186/');
 await page.locator('#world[data-island=ocean]').waitFor({timeout:180000});
 await page.screenshot({path:'artifacts/ocean/game-front.png'});
 await page.locator('#flip-island').click();
 await page.locator('#world[data-side=back][data-flipping=false]').waitFor({timeout:15000});
 await page.screenshot({path:'artifacts/ocean/game-back.png'});
 const motion=await page.locator('#world canvas').first().evaluate(async canvas=>{
  const before=canvas.toDataURL();const deltas=[];let last=performance.now(),start=last;
  await new Promise(resolve=>{function frame(now){deltas.push(now-last);last=now;if(now-start<3000)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});
  return {moving:before!==canvas.toDataURL(),fps:1000/(deltas.reduce((a,b)=>a+b,0)/deltas.length)};
 });
 assert.ok(motion.moving,'water/sea-life animation is frozen');report.push({name:'live-game-back',...motion});
 await page.locator('#flip-island').click();
 await page.locator('#world[data-side=front][data-flipping=false]').waitFor({timeout:15000});
 assert.deepEqual(errors,[]);await page.close();
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await isolateSave(mobile);
 mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto('http://127.0.0.1:5186/');
 await mobile.locator('#world[data-island=ocean]').waitFor({timeout:180000});
 await mobile.screenshot({path:'artifacts/ocean/game-mobile.png'});
 assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'mobile horizontal overflow');
 assert.deepEqual(errors,[]);await mobile.close();
 await writeFile('artifacts/ocean/verification.json',JSON.stringify(report,null,2));console.log(report);
}finally{await browser.close();}
