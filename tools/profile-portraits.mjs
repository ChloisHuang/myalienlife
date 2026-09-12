import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from '@playwright/test';

const [label='portraits',snapshot='',dpr='1',savePath='.data/orbit-life.json',verify='']=process.argv.slice(2),sourceRoot=fileURLToPath(new URL('../src/',import.meta.url));
const saved=JSON.parse(await readFile(savePath,'utf8'));saved.state.speed=0;
const server=await createServer({configFile:false,logLevel:'error',server:{host:'127.0.0.1',port:0},plugins:[{
 name:'portrait-probe',enforce:'pre',load(id){if(snapshot&&id.startsWith(sourceRoot))return readFile(resolve(snapshot,relative(sourceRoot,id.split('?')[0])),'utf8');},
 transform(code,id){
  if(id.endsWith('/src/main.js')){assert.ok(code.includes('function refreshPortraits(){'));return code.replace('function refreshPortraits(){',`globalThis.portraitProbe={get game(){return game;},get ids(){return ['player',...neighbors(game).map(n=>n.id)];},cached:id=>portraits[id],switch:id=>switchControl(game,id),refresh:()=>refreshPortraits(),force:()=>{portraitKey='';refreshPortraits();},direct:id=>world.portrait(id)};
   function refreshPortraits(){`);}
  if(id.endsWith('/src/world.js')){
   assert.ok(code.includes('portrait(id){'));
   code=code.replace('dynamicResolution.sample(frameDt*1000,now)','null');
   code=code.replace('const textures=new Set()',`const portraitGl=portraitRenderer.getContext(),createProgram=portraitGl.createProgram.bind(portraitGl);portraitGl.createProgram=()=>{globalThis.portraitPrograms=(globalThis.portraitPrograms||0)+1;return createProgram();};const textures=new Set()`);
   code=code.replace('portrait(id){','portrait(id){globalThis.portraitCalls?.push(id);const portraitStart=performance.now();let renderStart,readStart,cleanupStart;');
   code=code.replace('portraitComposer.render();const url=portraitRenderer.domElement.toDataURL();','renderStart=performance.now();portraitComposer.render();readStart=performance.now();const url=portraitRenderer.domElement.toDataURL();cleanupStart=performance.now();');
   return code.replace('return url;',`globalThis.portraitStages?.push({setup:renderStart-portraitStart,render:readStart-renderStart,readback:cleanupStart-readStart,cleanup:performance.now()-cleanupStart});return url;`);
  }
 }
}]});
let browser;
try{
 await server.listen();browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:verify==='mobile'?{width:390,height:844}:{width:1440,height:1000},deviceScaleFactor:Number(dpr)}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>{let s=20260912;Math.random=()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);});
 await page.route('**/api/**',r=>r.fulfill({json:r.request().method()==='GET'?saved:{revision:saved.revision+1}}));
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`);await page.locator('#loading').waitFor({state:'hidden',timeout:180000});
 const result=await page.evaluate(async verify=>{
  const results=[],probe=portraitProbe,person=probe.game.player;
  const pixels=async url=>{const img=new Image();img.src=url;await img.decode();const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);return ctx.getImageData(0,0,img.width,img.height).data;};
  const run=async(name,change)=>{
   let previous=await new Promise(requestAnimationFrame),frameId;const gaps=[];
   const frame=t=>{gaps.push(t-previous);previous=t;frameId=requestAnimationFrame(frame);};frameId=requestAnimationFrame(frame);
   globalThis.portraitCalls=[];globalThis.portraitStages=[];globalThis.portraitPrograms=0;const tasks=[];
   const observer=new PerformanceObserver(list=>tasks.push(...list.getEntries().map(e=>e.duration)));observer.observe({entryTypes:['longtask']});
   const start=performance.now();change();probe.refresh();const elapsed=performance.now()-start,calls=[...portraitCalls],stages=[...portraitStages],programs=portraitPrograms;
   await new Promise(resolve=>setTimeout(resolve,100));observer.disconnect();cancelAnimationFrame(frameId);
   gaps.sort((a,b)=>a-b);const mean=gaps.reduce((s,v)=>s+v,0)/gaps.length;
   const comparisons=[];
   if(verify)for(const id of probe.ids){
    const a=await pixels(probe.cached(id)),b=await pixels(probe.direct(id));let difference=0,max=0;
    for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);difference+=d;max=Math.max(max,d);}
    if(a.length!==b.length||difference/a.length>.02||max>16)throw new Error(`${name}: stale portrait ${id}, difference=${difference/a.length}, max=${max}`);
    comparisons.push({id,meanDifference:difference/a.length,max});
   }
   if(verify){const expected={'unchanged':0,'rename':0,'repeat':0,'switch-control':2,'forced-ui-refresh':0}[name]??1;if(calls.length!==expected)throw new Error(`${name}: expected ${expected} renders, got ${calls.length}`);}
   results.push({name,elapsed,calls,stages,programs,longTasks:tasks,frames:{count:gaps.length,mean,fps:1000/mean,p95:gaps[Math.floor(gaps.length*.95)],p99:gaps[Math.floor(gaps.length*.99)]},...(verify?{comparisons}:{})});
  };
  await run('unchanged',()=>{});
  await run('rename',()=>person.name+=' test');
  await run('one-genome',()=>person.genome.headWidth+=.01);
  await run('one-prayer',()=>person.prayer.mutations=person.prayer.mutations.includes('freckles')?person.prayer.mutations.filter(m=>m!=='freckles'):[...person.prayer.mutations,'freckles']);
  await run('one-age',()=>person.age=5);
  await run('repeat',()=>{});
  if(verify){await probe.switch(probe.ids[1]);await run('switch-control',()=>{});await run('forced-ui-refresh',()=>probe.force());}
  return {dpr:devicePixelRatio,results};
 },['verify','mobile'].includes(verify));
 assert.deepEqual(errors,[]);await mkdir('artifacts/performance',{recursive:true});
 if(verify){
  const toggle=page.locator('#dossier-toggle');if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();
  await page.locator('#player-portrait').waitFor({state:'visible'});await page.waitForTimeout(300);
  await page.locator('#player-portrait').screenshot({path:`artifacts/performance/${label}-portrait.png`});
 }
 await page.screenshot({path:`artifacts/performance/${label}.png`});
 await writeFile(`artifacts/performance/${label}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser?.close();await server.close();}
