import {parseArgs} from 'node:util';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import {restore} from '../src/simulation.js';
import {CAPTURE_FRAME,captureIslands,prepareIslandCapture} from './island-capture-fixture.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const {values}=parseArgs({options:{island:{type:'string'},side:{type:'string',default:'both'},seed:{type:'string',default:'20260910'},save:{type:'string',default:join(root,'.data/orbit-life.json')},output:{type:'string',default:join(root,'artifacts/island-screenshots')},browser:{type:'string',default:'msedge'},list:{type:'boolean'},help:{type:'boolean'}}});
if(values.help){console.log('npm run screenshot:island -- --island 2 [--side front|back|both] [--seed 42]\n                         --list\nOptions: --save <save envelope.json> --output <directory> --browser msedge|chrome|chromium\nRead-only save snapshot; 1920x1080 README framing; noon, spores, tier-3 UFO.');process.exit(0);}
if(!values.list&&!/^[1-9]\d*$/.test(values.island??''))throw new Error('必须指定 --island 编号；使用 --list 查看当前存档的岛屿列表。');
if(!['front','back','both'].includes(values.side))throw new Error('--side 只能为 front、back 或 both');
if(!/^\d+$/.test(values.seed)||!Number.isSafeInteger(Number(values.seed))||Number(values.seed)>0xffffffff)throw new Error('--seed 必须是 0 到 4294967295 的整数');
if(!['msedge','chrome','chromium'].includes(values.browser))throw new Error('--browser 只能为 msedge、chrome 或 chromium');
const savePath=resolve(values.save),raw=await readFile(savePath,'utf8'),envelope=JSON.parse(raw);
if(!envelope.state)throw new Error('需要 .data/orbit-life.json 格式的存档，缺少 state 字段。');
const source=restore(JSON.stringify(envelope.state)),islands=captureIslands(source);
if(values.list){console.table(islands);process.exit(0);}
const number=Number(values.island),seed=Number(values.seed),sides=values.side==='both'?['front','back']:[values.side];
const fixtures=sides.map(side=>prepareIslandCapture(source,{islandNumber:number,side,seed}));
for(const fixture of fixtures)assert.deepEqual(fixture.state.objects,source.objects,'截图不能修改物品摆放');
const output=resolve(values.output);await mkdir(output,{recursive:true});
const report={island:fixtures[0].island,frame:CAPTURE_FRAME,minute:720,weather:'spores',seed,savePath,saveSha256:createHash('sha256').update(raw).digest('hex'),construction:source.civilization.projects[fixtures[0].island.id]?.construction??null,captures:[]};
let server,browser;
try{
 // No project plugins: this temporary server never mounts the save API.
 server=await createServer({root,configFile:false,logLevel:'error',server:{host:'127.0.0.1',port:0,open:false}});await server.listen();
 const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
 browser=await chromium.launch({headless:true,...(values.browser==='chromium'?{}:{channel:values.browser})});
 for(const fixture of fixtures){
  const page=await browser.newPage({viewport:CAPTURE_FRAME,deviceScaleFactor:1}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/api/**',route=>{errors.push(`Unexpected save/API access: ${route.request().url()}`);return route.abort();});
  await page.route('**/__island_capture.json',route=>route.fulfill({json:fixture}));
  await page.goto(`${origin}/tools/island-capture.html`);
  await page.locator('#world[data-ready=true]').waitFor({timeout:120000});
  assert.deepEqual(errors,[]);
  const pixels=await page.locator('canvas').first().evaluate(canvas=>{
   const copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;const ctx=copy.getContext('2d');ctx.drawImage(canvas,0,0);
   const data=ctx.getImageData(0,0,copy.width,copy.height).data,colors=new Set();for(let i=0;i<data.length;i+=128)colors.add(`${data[i]},${data[i+1]},${data[i+2]}`);
   return {width:canvas.width,height:canvas.height,colors:colors.size};
  });
  assert.equal(pixels.width,CAPTURE_FRAME.width);assert.equal(pixels.height,CAPTURE_FRAME.height);assert.ok(pixels.colors>200,'画布缺少有效场景内容');
  const filename=`island-${String(number).padStart(2,'0')}-${fixture.side}.png`;
  await page.locator('#world canvas').first().screenshot({path:join(output,filename),timeout:60000});
  report.captures.push({side:fixture.side,file:filename,pixels,residents:fixture.placements.map(({id,action})=>({id,action}))});
  await page.close();console.log(join(output,filename));
 }
 await writeFile(join(output,`island-${String(number).padStart(2,'0')}.json`),JSON.stringify(report,null,2));
}finally{await browser?.close();await server?.close();}
