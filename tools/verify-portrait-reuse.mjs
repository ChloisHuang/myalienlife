import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from '@playwright/test';

const [snapshot]=process.argv.slice(2),sourceRoot=fileURLToPath(new URL('../src/',import.meta.url));
assert.ok(snapshot,'Pass the before-change src directory');
const browser=await chromium.launch({channel:'msedge',headless:true}),results=[];
try{
 for(const dpr of [1,2]){
  const captures=[];
  for(const source of [snapshot,'']){
   const server=await createServer({configFile:false,logLevel:'error',server:{host:'127.0.0.1',port:0},plugins:[{
    name:'baseline-source',enforce:'pre',load(id){if(source&&id.startsWith(sourceRoot))return readFile(resolve(source,relative(sourceRoot,id.split('?')[0])),'utf8');}
   }]});
   const page=await browser.newPage({viewport:{width:dpr===1?1440:390,height:844},deviceScaleFactor:dpr});
   try{
    await server.listen();await page.route('**/portrait-check',r=>r.fulfill({contentType:'text/html',body:'<div id="world" style="width:100%;height:600px"></div>'}));
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/portrait-check`);
    captures.push(await page.evaluate(async()=>{
     let seed=7;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
     const {createWorld}=await import('/src/world.js'),{createGame}=await import('/src/simulation.js'),{mutableResident}=await import('/src/living-state.js');
     const game=createGame(),world=await createWorld(document.querySelector('#world'),()=>game,{onClick(){},onHover(){},onPlace(){}});
     const base=structuredClone(game.player),images=[];
     for(const age of [0,8,28,68])for(const color of ['#ff3355','#33ccff','#aaff44'])for(const variant of [3,0,1,0,2,0]){
      Object.assign(game.player,structuredClone(base),{age,color});
      game.player.prayer={radiance:variant&1?10:0,nether:variant&2?10:0,mutations:variant?['crown','eyes','freckles','spines']:[]};
      Object.assign(mutableResident(game,game.player),{garden:variant?40:0,charge:variant===1?0:10,imprint:[null,'roots','shade','bloom'][variant],mode:variant===2?'shadow':'light'});
      images.push(world.portrait('player'));
      const id=Object.keys(game.npcs)[0];images.push(world.portrait(id));
     }
     return images;
    }));
   }finally{await page.close();await server.close();}
  }
  const page=await browser.newPage();
  const comparison=await page.evaluate(async([before,after])=>{
   const pixels=async url=>{const img=new Image();img.src=url;await img.decode();const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);return ctx.getImageData(0,0,img.width,img.height).data;};
   let max=0,total=0,count=0;
   for(let n=0;n<before.length;n++){const a=await pixels(before[n]),b=await pixels(after[n]);if(a.length!==b.length)throw Error('Size changed');for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);max=Math.max(max,d);total+=d;count++;}}
   return {images:before.length,max,mean:total/count};
  },captures);await page.close();
  results.push({dpr,...comparison});assert.equal(comparison.max,0,JSON.stringify(results));
 }
 await mkdir('artifacts/performance',{recursive:true});await writeFile('artifacts/performance/portrait-rig-pixels.json',JSON.stringify(results,null,2));console.log(results);
}finally{await browser.close();}
