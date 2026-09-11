import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import {restore} from '../src/simulation.js';
import {prepareIslandCapture} from './island-capture-fixture.js';
import {fileURLToPath} from 'node:url';
import {relative,resolve} from 'node:path';

const snapshotDir=process.argv[2];
const prefix=process.argv[3]??(snapshotDir?'batch-':'');
const dpr=Number(process.argv[4]??1);
const saved=JSON.parse(await readFile(snapshotDir?`${snapshotDir}/save.json`:'.data/orbit-life.json','utf8'));
const source=restore(JSON.stringify(saved.state));
const server=await createServer({configFile:false,logLevel:'error',server:{host:'127.0.0.1',port:0}});
const sourceRoot=fileURLToPath(new URL('../src/',import.meta.url));
const baselineServer=snapshotDir?await createServer({configFile:false,logLevel:'error',plugins:[{name:'original-render',enforce:'pre',load(id){if(id.startsWith(sourceRoot))return readFile(resolve(snapshotDir,'src',relative(sourceRoot,id.split('?')[0])),'utf8');}}],server:{host:'127.0.0.1',port:0}}):null;
let browser;
try{
 await server.listen();await baselineServer?.listen();browser=await chromium.launch({channel:'msedge',headless:true});
 await mkdir('artifacts/performance',{recursive:true});const results=[];
 for(const [name,islandNumber,side,viewport]of [
  ['home-front',1,'front',{width:1440,height:1000}],
  ['home-back-night',1,'back',{width:1440,height:1000}],
  ['home-rain',1,'front',{width:1440,height:1000}],
  ['spore-front',2,'front',{width:1440,height:1000}],
  ['spore-back',2,'back',{width:1440,height:1000}],
  ['spore-night',2,'back',{width:1440,height:1000}],
  ['mobile',2,'front',{width:390,height:844}],
 ]){
  const fixture=prepareIslandCapture(source,{islandNumber,side,seed:20260910});let previous;
  if(name.includes('night'))fixture.state.minute=1260;
  for(const baseline of [true,false]){
   const page=await browser.newPage({viewport,deviceScaleFactor:dpr}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
   await page.route('**/api/**',route=>{throw new Error(`Unexpected API access: ${route.request().url()}`);});
   await page.route('**/__island_capture.json',route=>route.fulfill({json:fixture}));
   if(name.includes('rain'))await page.route('**/tools/island-capture-fixture.js',async route=>{
    const response=await route.fetch(),text=await response.text();assert.ok(text.includes('weights:{clear:0,mist:0,rain:0,spores:1}'));
    await route.fulfill({response,body:text.replace('weights:{clear:0,mist:0,rain:0,spores:1}','weights:{clear:0,mist:0,rain:1,spores:0}')});
   });
   await page.route('**/src/world.js',async route=>{
    const response=await route.fetch();const body=(await response.text()).replace('Math.min((now-previousFrame)/1000,.1)','1/60');
    await route.fulfill({response,body});
   });
   if(baseline&&!snapshotDir)await page.route('**/src/character-rig.js',async route=>{
    const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('updateSkinBounds(skin)','skin.computeBoundingSphere()')});
   });
   const host=baseline&&baselineServer?baselineServer:server;
   await page.goto(`http://127.0.0.1:${host.httpServer.address().port}/tools/island-capture.html`);
   await page.locator('#world[data-ready=true]').waitFor({timeout:180000});assert.deepEqual(errors,[]);
   const encoded=await page.locator('canvas').first().evaluate(canvas=>{
    const copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;
    const ctx=copy.getContext('2d');ctx.drawImage(canvas,0,0);const pixels=ctx.getImageData(0,0,copy.width,copy.height).data,chunks=[];
    for(let i=0;i<pixels.length;i+=32768)chunks.push(String.fromCharCode(...pixels.subarray(i,i+32768)));
    return btoa(chunks.join(''));
   });
   const pixels=Buffer.from(encoded,'base64');
   await page.screenshot({path:`artifacts/performance/${prefix}${baseline?'before':'after'}-${name}.png`});
   if(baseline)previous=pixels;
   else{
    assert.equal(pixels.length,previous.length,'comparison canvas dimensions changed');
    let changed=0,totalDifference=0,largePixels=0;
    for(let i=0;i<pixels.length;i+=4){let max=0;for(let j=0;j<3;j++){const d=Math.abs(pixels[i+j]-previous[i+j]);if(d)changed++;totalDifference+=d;max=Math.max(max,d);}if(max>16)largePixels++;}
    const colors=new Set();for(let i=0;i<pixels.length;i+=128)colors.add(pixels.slice(i,i+3).join(','));
    const result={name,changedChannels:changed,meanDifference:totalDifference/(pixels.length/4*3),largePixelRatio:largePixels/(pixels.length/4),colors:colors.size};console.log(result);
    assert.ok(colors.size>200,'blank canvas');assert.ok(result.meanDifference<.02&&result.largePixelRatio<.0001,`${name}: visible rendering regression`);
    await page.screenshot({path:`artifacts/performance/${prefix}verified-${name}.png`});results.push(result);
   }
   await page.close();
  }
 }
 await writeFile(`artifacts/performance/${prefix}visual-verification.json`,JSON.stringify(results,null,2));console.log(results);
}finally{await browser?.close();await server.close();await baselineServer?.close();}
