import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {relative,resolve} from 'node:path';

const label=process.argv[2]||'local';
const baselineRef=process.argv[5]||'HEAD';
const qualityOverride=process.argv[6]||'';
const skipPreviews=process.argv[7]==='no-previews';
const captureRenderInfo=process.argv[8]==='render-info';
const snapshotDir=process.argv[9];
const sourceRoot=fileURLToPath(new URL('../src/',import.meta.url));
const saved=JSON.parse(await readFile(process.argv[3]||new URL('../.data/orbit-life.json',import.meta.url),'utf8'));
const server=await createServer({configFile:false,logLevel:'error',plugins:[{
 name:'profile-local',enforce:'pre',load(id){if(snapshotDir&&id.startsWith(sourceRoot))return readFile(resolve(snapshotDir,relative(sourceRoot,id.split('?')[0])),'utf8');},transform(code,id){
  if(label==='baseline'&&['character-rig.js','i18n.js'].some(name=>id.endsWith(`/src/${name}`)))return execFileSync('git',['show',`${baselineRef}:src/${id.split('/').at(-1)}`],{encoding:'utf8'});
  if(id.endsWith('/src/main.js')){let instrumented=code.replace('previous=now;recordFrameRate(dt);if(!hosted)tick(game,dt);','const rawDt=now-previous;previous=now;const t0=performance.now();if(!hosted)tick(game,dt);const t1=performance.now();').replace('world.render(visualGame);','world.render(visualGame);const t2=performance.now();globalThis.frameSamples?.push({dt:rawDt,tick:t1-t0,render:t2-t1});');if(qualityOverride)instrumented=instrumented.replace("qualityLevel='high'",`qualityLevel='${qualityOverride}'`);return instrumented;}
  if(id.endsWith('/src/world.js')){let instrumented=code.replace('const composer=createPostProcessing(renderer,scene,camera);','const composer=createPostProcessing(renderer,scene,camera);globalThis.profileRenderer=renderer;');
   if(captureRenderInfo)instrumented=instrumented.replace('const composer=createPostProcessing(renderer,scene,camera);',`const composer=createPostProcessing(renderer,scene,camera);
   const gl=renderer.getContext(),timer=gl.getExtension('EXT_disjoint_timer_query_webgl2'),queries=[];
   globalThis.gpuProfile={supported:!!timer,ms:[],renderer:gl.getParameter(gl.RENDERER)};
  `).replace('else {controls.update();updateModelLod();composer.render();}',`else {controls.update();renderer.info.autoReset=false;renderer.info.reset();
   if(timer)while(queries.length&&gl.getQueryParameter(queries[0],gl.QUERY_RESULT_AVAILABLE)){
    const query=queries.shift();if(!gl.getParameter(timer.GPU_DISJOINT_EXT))globalThis.gpuProfile.ms.push(gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6);gl.deleteQuery(query);
   }
   const query=timer&&queries.length<8?gl.createQuery():null;if(query)gl.beginQuery(timer.TIME_ELAPSED_EXT,query);
   composer.render();if(query){gl.endQuery(timer.TIME_ELAPSED_EXT);queries.push(query);}
   globalThis.renderInfo={...renderer.info.render,programs:renderer.info.programs.length,memory:{...renderer.info.memory}};
  }`);
   if(skipPreviews)instrumented=instrumented.replace("if(container.dataset.flipping==='false')void islandPreviews.update(g,now);",'');return instrumented;}
 }
}],server:{host:'127.0.0.1',port:0}});
let browser;
try{
 await server.listen();browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:Number(process.argv[4]||1)});
 await page.addInitScript(()=>{let seed=20260910;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 await page.route('**/api/**',route=>route.fulfill({json:route.request().method()==='GET'?saved:{revision:saved.revision+1}}));
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`);
 await page.locator('#loading').waitFor({state:'hidden',timeout:180000});
 await page.waitForTimeout(5000);
 const cdp=await page.context().newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.start');
 const heapBefore=await cdp.send('Runtime.getHeapUsage');
 await page.evaluate(()=>{globalThis.frameSamples=[];if(globalThis.gpuProfile)globalThis.gpuProfile.ms=[];});await page.waitForTimeout(12000);
 const {profile}=await cdp.send('Profiler.stop');
 const result=await page.evaluate(()=>({samples:globalThis.frameSamples,renderInfo:globalThis.renderInfo,gpu:globalThis.gpuProfile}));
 const heapAfter=await cdp.send('Runtime.getHeapUsage');
 if(errors.length)throw new Error(`Invalid profile: ${errors.join('\n')}`);
 if(!result.samples?.length)throw new Error('Frame instrumentation did not produce samples');
 const environment=await page.evaluate(()=>{const r=globalThis.profileRenderer,gl=r.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');return {viewport:{width:innerWidth,height:innerHeight},devicePixelRatio,renderPixelRatio:r.getPixelRatio(),gpu:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),quality:document.querySelector('#world')?.dataset.quality};});
 const summary={label,snapshotDir,environment,objects:saved.state.objects.length,island:saved.state.viewIsland,renderInfo:result.renderInfo,heapBefore,heapAfter,gpu:result.gpu,errors};
 for(const key of ['dt','tick','render']){const a=result.samples.map(s=>s[key]).sort((a,b)=>a-b);summary[key]={mean:a.reduce((s,x)=>s+x,0)/a.length,p50:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)]};}
 summary.fps=1000/summary.dt.mean;
 if(summary.gpu?.ms?.length){const values=summary.gpu.ms.sort((a,b)=>a-b);summary.gpu={supported:true,renderer:summary.gpu.renderer,mean:values.reduce((s,x)=>s+x,0)/values.length,p95:values[Math.floor(values.length*.95)],samples:values.length};}
 const counts=new Map();for(const id of profile.samples||[])counts.set(id,(counts.get(id)||0)+1);
 const nodes=new Map(profile.nodes.map(n=>[n.id,n]));
 const inclusive=id=>(counts.get(id)||0)+(nodes.get(id).children||[]).reduce((sum,id)=>sum+inclusive(id),0);
 summary.cpu=Object.fromEntries(['computeBoundingSphere','updateCharacter','tick','refresh','(garbage collector)'].map(name=>[name,profile.nodes.filter(n=>n.callFrame.functionName===name).reduce((sum,n)=>sum+inclusive(n.id),0)/(profile.samples?.length||1)*100]));
 summary.hot=profile.nodes.map(n=>({name:n.callFrame.functionName,url:n.callFrame.url,line:n.callFrame.lineNumber+1,samples:counts.get(n.id)||0})).sort((a,b)=>b.samples-a.samples).slice(0,25);
 await mkdir('artifacts/performance',{recursive:true});await writeFile(`artifacts/performance/${label}.json`,JSON.stringify(summary,null,2));await writeFile(`artifacts/performance/${label}.cpuprofile`,JSON.stringify(profile));
 await page.screenshot({path:`artifacts/performance/${label}.png`});console.log(JSON.stringify(summary,null,2));
}finally{await browser?.close();await server.close();}
