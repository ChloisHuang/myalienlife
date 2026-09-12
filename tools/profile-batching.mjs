import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from '@playwright/test';

const [label='batching-audit',snapshot='',dprText='1',savePath='.data/orbit-life.json',mode='replay']=process.argv.slice(2);
if(!['replay','realtime'].includes(mode))throw new Error('Mode must be replay or realtime');
const sourceRoot=fileURLToPath(new URL('../src/',import.meta.url));
const saved=JSON.parse(await readFile(savePath,'utf8'));
function replace(code,from,to){if(!code.includes(from))throw new Error(`Missing instrumentation anchor: ${from}`);return code.replace(from,to);}
const server=await createServer({configFile:false,logLevel:'error',server:{host:'127.0.0.1',port:0},plugins:[{
 name:'batching-profile',enforce:'pre',
 load(id){if(snapshot&&id.startsWith(sourceRoot))return readFile(resolve(snapshot,relative(sourceRoot,id.split('?')[0])),'utf8');},
 transform(code,id){
  if(id.endsWith('/src/world.js')){
   code=replace(code,'dynamicResolution.sample(frameDt*1000,now)','null');
   code=replace(code,'const composer=createPostProcessing(renderer,scene,camera);',`const composer=createPostProcessing(renderer,scene,camera);
    globalThis.batchProbe={renderer,scene,camera,frames:[],draws:[],gpu:[]};
    const gl=renderer.getContext(),timer=gl.getExtension('EXT_disjoint_timer_query_webgl2'),pending=[];
    const draw=renderer.renderBufferDirect.bind(renderer);
    renderer.renderBufferDirect=(camera,scene,geometry,material,object,group)=>{
     if(batchProbe.audit){const path=[];for(let n=object;n;n=n.parent)path.push(n.userData.target?.id||n.name||n.type);
      batchProbe.draws.push({path:path.reverse().join('/'),material:material.name||material.type,shadow:material.isMeshDepthMaterial||material.isMeshDistanceMaterial||false,triangles:(geometry.index?.count??geometry.attributes.position.count)/3});}
     return draw(camera,scene,geometry,material,object,group);
    };
    const render=composer.render.bind(composer);
    composer.render=()=>{
     if(timer)while(pending.length&&gl.getQueryParameter(pending[0],gl.QUERY_RESULT_AVAILABLE)){
      const q=pending.shift();if(!gl.getParameter(timer.GPU_DISJOINT_EXT)&&batchProbe.record)batchProbe.gpu.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q);
     }
     const q=timer&&pending.length<8?gl.createQuery():null;
     renderer.info.autoReset=false;renderer.info.reset();
     if(q)gl.beginQuery(timer.TIME_ELAPSED_EXT,q);render();if(q){gl.endQuery(timer.TIME_ELAPSED_EXT);pending.push(q);}
     batchProbe.info={...renderer.info.render,memory:{...renderer.info.memory}};
    };`);
   return code;
  }
  if(id.endsWith('/src/main.js')){
   if(mode==='replay')code=replace(code,'dt=Math.min((now-previous)/1000,.1)','dt=1/60');
   code=replace(code,'previous=now;recordFrameRate(dt);','previous=now;batchProbe.record=batchProbe.ticks>=300&&batchProbe.ticks<1200;batchProbe.audit=batchProbe.ticks===600;recordFrameRate(dt);');
   code=replace(code,'if(!hosted)tick(game,dt);','if(!hosted){const random=Math.random;Math.random=globalThis.simulationRandom;try{tick(game,dt,globalThis.simulationRandom);}finally{Math.random=random;}}');
   return replace(code,'world.render(visualGame);','const renderStart=performance.now();world.render(visualGame);batchProbe.ticks=(batchProbe.ticks||0)+1;if(batchProbe.record)batchProbe.frames.push({render:performance.now()-renderStart});if(batchProbe.ticks===1200){batchProbe.finalInfo=batchProbe.info;batchProbe.state={day:game.day,minute:game.minute,objects:game.objects.length};}');
  }
 }
}]});
let browser;
try{
 await server.listen();browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:Number(dprText)}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  let seed=20260912;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  let simSeed=20260912;globalThis.simulationRandom=()=>((simSeed=(Math.imul(simSeed,1664525)+1013904223)>>>0)/4294967296);
  globalThis.intervals=[];globalThis.longTasks=[];let last;
  requestAnimationFrame(function frame(t){if(globalThis.batchProbe?.record&&last)intervals.push(t-last);last=t;requestAnimationFrame(frame);});
  new PerformanceObserver(list=>{if(globalThis.batchProbe?.record)longTasks.push(...list.getEntries().map(e=>e.duration));}).observe({entryTypes:['longtask']});
 });
 await page.route('**/api/**',route=>route.fulfill({json:route.request().method()==='GET'?saved:{revision:saved.revision+1}}));
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`);
 await page.locator('#loading').waitFor({state:'hidden',timeout:180000});
 const cdp=await page.context().newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.start');
 await page.waitForFunction(()=>batchProbe.ticks>1200,{},{timeout:180000});
 const {profile}=await cdp.send('Profiler.stop');
 const result=await page.evaluate(()=>{
  function stats(a){a.sort((a,b)=>a-b);return {count:a.length,mean:a.reduce((s,v)=>s+v,0)/a.length,p95:a[Math.floor(a.length*.95)],p99:a[Math.floor(a.length*.99)],max:a.at(-1)};}
  const p=batchProbe,gl=p.renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
  return {environment:{dpr:devicePixelRatio,renderDpr:p.renderer.getPixelRatio(),gpu:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)},state:p.state,frame:stats(intervals),render:stats(p.frames.map(f=>f.render)),gpu:stats(p.gpu),longTasks:stats(longTasks),info:p.finalInfo,draws:p.draws};
 });
 if(errors.length)throw new Error(errors.join('\n'));
 await mkdir('artifacts/performance',{recursive:true});
 await writeFile(`artifacts/performance/${label}.json`,JSON.stringify({mode,savePath,...result},null,2));
 await writeFile(`artifacts/performance/${label}.cpuprofile`,JSON.stringify(profile));
 await page.screenshot({path:`artifacts/performance/${label}.png`});
 console.log(JSON.stringify({...result,draws:result.draws.length},null,2));
}finally{await browser?.close();await server.close();}
