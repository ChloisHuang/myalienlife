import {chromium} from '@playwright/test';
import {mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createSaveStore} from '../server/save-store.js';
import {createGame,enqueue,tick} from '../src/simulation.js';
await mkdir('artifacts',{recursive:true});
const fixtureDirectory=await mkdtemp(join(tmpdir(),'orbit-poses-'));
async function seed(page,state){
 const store=createSaveStore(join(fixtureDirectory,crypto.randomUUID()));await store.write({state,baseRevision:0,clientId:'fixture',sequence:1});
 await page.route('**/api/save',async route=>{try{const data=route.request().method()==='GET'?await store.read():await store.write(route.request().postDataJSON());await route.fulfill({json:data});}catch(error){await route.fulfill({status:error.status||500,json:{error:error.message}});}});
}
const browser=await chromium.launch({channel:'msedge',headless:true});
for(const [type,targetId]of [['sleep','pod'],['relax','sofa'],['lounge','sofa'],['eat','food'],['wash','shower'],['research','lab'],['garden','garden']]){
 const state=createGame();for(const n of Object.values(state.npcs))n.ai.enabled=false;
 enqueue(state,type,targetId);for(let i=0;i<400;i++){tick(state,.1);if(state.queue[0]?.phase==='acting'&&state.queue[0].elapsed>=2.5&&(type!=='lounge'||Object.values(state.npcs).filter(n=>n.queue[0]?.type==='lounge'&&n.queue[0].phase==='acting').length===2))break;}
 if(state.queue[0]?.phase!=='acting')throw new Error(`${type} did not reach interaction`);state.speed=0;
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>console.log('PAGE_ERROR',e.message));
 await seed(page,state);
 await page.goto('http://127.0.0.1:5173');await page.locator('#loading').waitFor({state:'hidden',timeout:30000});
 await page.locator('#focus-player').click();for(let i=0;i<10;i++)await page.locator('#zoom-in').click();
 await page.waitForTimeout(250);await page.screenshot({path:`artifacts/${type}.png`});await page.close();console.log('POSE_VERIFIED',type);
}
const state=createGame();for(const n of Object.values(state.npcs))n.ai.enabled=false;enqueue(state,'walk',null,{x:6,z:5});
const page=await browser.newPage({viewport:{width:1440,height:1000}});await seed(page,state);
await page.goto('http://127.0.0.1:5173');await page.locator('#loading').waitFor({state:'hidden',timeout:30000});
const video=await page.evaluate(async()=>{
 const stream=document.querySelector('#world canvas').captureStream(24),recorder=new MediaRecorder(stream,{mimeType:'video/webm'}),chunks=[];
 recorder.ondataavailable=e=>chunks.push(e.data);const done=new Promise(resolve=>recorder.onstop=resolve);recorder.start();await new Promise(resolve=>setTimeout(resolve,4000));recorder.stop();await done;stream.getTracks().forEach(track=>track.stop());
 const buffer=await new Blob(chunks,{type:'video/webm'}).arrayBuffer();let binary='';for(const value of new Uint8Array(buffer))binary+=String.fromCharCode(value);return btoa(binary);
});await writeFile('artifacts/walking.webm',Buffer.from(video,'base64'));await browser.close();await rm(fixtureDirectory,{recursive:true,force:true});
