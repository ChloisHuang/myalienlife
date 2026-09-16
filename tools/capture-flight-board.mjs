// PROTOTYPE helper (throwaway) — real-game screenshots of the UFO flight board: 1/2/3 concurrent
// flights, plus a filmstrip of the stub tearing off when boarding completes. Reads
// .data/orbit-life.json but never writes it: every /api/save call is answered from a temp store.
import {readFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {chromium} from '@playwright/test';

const root=fileURLToPath(new URL('../',import.meta.url));
const {values}=parseArgs({options:{browser:{type:'string',default:'chromium'},width:{type:'string',default:'1440'},height:{type:'string',default:'1000'},output:{type:'string',default:'artifacts/flight-board'},island:{type:'string',default:'spore'},mode:{type:'string',default:'board'}}});
const ISLAND=values.island,out=join(root,values.output);
await mkdir(out,{recursive:true});
const source=JSON.parse(await readFile(join(root,'.data/orbit-life.json'),'utf8')).state;

// Three legs covering every state the board can print: still boarding, still boarding with the beam
// running, and long since boarded.
const LEGS=[
 {progress:.10,destination:'eva'},
 {progress:.24,destination:'ocean'},
 {progress:.65,destination:'eva'}
];

function stage(count,{speed=0,progress=null}={}){
 const state=structuredClone(source);
 state.speed=speed;
 state.autonomy={...state.autonomy,enabled:false};
 state.player.island=ISLAND;state.player.side='front';
 state.viewIsland=ISLAND;state.viewSide='front';
 for(const person of Object.values(state.npcs)){person.queue=[];if(person.ai)person.ai.enabled=false;}
 state.queue=[];
 const residents=Object.values(state.npcs).filter(person=>person.alive&&person.island===ISLAND&&person.side==='front');
 const hosts=(residents.length?residents:[{queue:state.queue}]).map(person=>person.queue);
 const ships=(state.space.ships??[]).slice(0,count);
 while(ships.length<count)ships.push({id:`ufo-board-${ships.length+1}`,tier:3,island:ISLAND,side:'front',food:0,durability:100,reservedBy:null,dispatchedAt:0});
 const duration=state.config.actionDurations.voyage;
 for(let index=0;index<count;index++){
  const id=1090000+index,leg=LEGS[index%LEGS.length],at=progress??leg.progress;
  hosts[index%hosts.length].push({id,type:'voyage',targetId:`${ISLAND}-portal`,target:{x:0,z:1.7,island:ISLAND,side:'front'},source:'ai',elapsed:at*duration,phase:'acting',path:[],destinationId:leg.destination,shipId:ships[index].id,passengerUids:[]});
  Object.assign(ships[index],{island:ISLAND,side:'front',durability:100,reservedBy:id,dispatchedAt:0});
 }
 state.space.ships=ships;
 state.nextId=1090100;
 return state;
}

// One page for every capture: the scene needs a WebGL context, and creating one per screenshot runs
// the browser out of them. Reloading with a fresh fixture is enough to restage the flights.
async function session(browser,first){
 // A deliberately dumb in-memory store: the real save-store rejects writes whose baseRevision went
 // stale, and the game autosaves while a page is unloading — right when the next load is reading.
 const holder={state:first};
 let revision=1;
 const page=await browser.newPage({viewport:{width:Number(values.width),height:Number(values.height)},deviceScaleFactor:1,locale:'zh-CN'}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 let pending=true;
 const snapshot=()=>({revision:++revision,savedAt:new Date().toISOString(),state:holder.state});
 await page.route('**/api/save',async route=>{
  if(route.request().method()!=='GET'||pending)pending=false;
  await route.fulfill({json:snapshot()});
 });
 const visit=async state=>{
  holder.state=state;pending=true;
  if(!page.url().startsWith('http'))await page.goto('http://127.0.0.1:5173',{waitUntil:'domcontentloaded',timeout:120000});else await page.reload({waitUntil:'domcontentloaded',timeout:120000});
  try{
   await page.locator('#loading').waitFor({state:'hidden',timeout:60000});
  }catch(error){
   console.log('加载失败，页面报错：',errors.slice(0,6));
   console.log('加载文案：',await page.locator('#loading').innerText().catch(()=>'?'));
   throw error;
  }
  await page.waitForTimeout(2500);
  await page.evaluate(async()=>{try{await document.fonts.ready;}catch{}});
 };
 return {page,errors,visit,close:async()=>{await page.close();}};
}

const browser=await chromium.launch({headless:true,...(values.browser==='chromium'?{}:{channel:values.browser})});
try{
 if(values.mode==='board'){
  const {page,errors,visit,close}=await session(browser,stage(1));
  for(const count of [1,2,3]){
   await visit(stage(count));
   const info=await page.evaluate(()=>{
    const box=node=>{const rect=node.getBoundingClientRect();return {x:Math.round(rect.x),y:Math.round(rect.y),w:Math.round(rect.width),h:Math.round(rect.height)};};
    const node=document.querySelector('.ufo-flight-board');
    return {board:box(node),tickets:[...document.querySelectorAll('.ufo-ticket')].map(box),card:box(document.querySelector('.ufo-card')),text:node.innerText};
   });
   await page.screenshot({path:join(out,`board-${count}.png`),timeout:120000});
   console.log(`${count} 班  board=${JSON.stringify(info.board)}  票=${JSON.stringify(info.tickets)}  票面=${JSON.stringify(info.card)}\n      ${JSON.stringify(info.text)}`);
   if(errors.length)console.log('  page errors:',errors);
  }
  await close();
 }else{
  // One ship just short of the boarding threshold, then a frame every 140 ms as it crosses it.
  const {page,errors,visit,close}=await session(browser,stage(1,{speed:1,progress:.13}));
  await visit(stage(1,{speed:1,progress:.13}));
  for(let frame=1;frame<=10;frame++){
   await page.waitForTimeout(140);
   const state=await page.evaluate(()=>{const tab=document.querySelector('.ufo-stub-tab'),ticket=document.querySelector('.ufo-ticket'),stub=document.querySelector('.ufo-stub');return {text:document.querySelector('.ufo-flight-board').innerText,tearing:ticket.hasAttribute('data-tearing'),opacity:getComputedStyle(tab).opacity,width:Math.round(stub.getBoundingClientRect().width)};});
   await page.screenshot({path:join(out,`tear-${String(frame).padStart(2,'0')}.png`),timeout:120000});
   console.log(`帧 ${frame}  撕票=${state.tearing}  票根宽=${state.width}px  不透明度=${Number(state.opacity).toFixed(2)}  ${JSON.stringify(state.text)}`);
  }
  if(errors.length)console.log('  page errors:',errors);
  await close();
 }
}finally{await browser.close();}
