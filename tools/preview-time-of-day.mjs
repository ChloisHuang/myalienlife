import {chromium} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';

const directory='artifacts/time-of-day';
await mkdir(directory,{recursive:true});
const {state}=JSON.parse(await readFile('.data/orbit-life.json','utf8'));
state.speed=0;state.viewSide='front';
const times=[['04:15','凌晨',255],['06:00','清晨',360],['08:30','上午',510],['12:00','正午',720],['18:00','傍晚',1080],['23:00','深夜',1380]];
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 // Read the current island, but never write preview times to the user's save.
 await page.route('**/api/save',route=>route.fulfill({json:{state,revision:1,savedAt:null}}));
 // Hold weather constant to isolate time-dependent lighting and bioluminescence.
 await page.route('**/src/weather.js*',route=>route.fulfill({contentType:'application/javascript',body:`export function getWeather(){return {type:'clear',weights:{clear:1,mist:0,rain:0,spores:0},wind:.2,temperature:22,name:'晴空',icon:'CloudSun',description:'对比预览固定晴空',transitioning:false,nextName:'晴空'};}`}));
 const cards=[];
 for(const [time,name,minute]of times){
  state.minute=minute;
  await page.goto('http://127.0.0.1:5173');await page.locator('#loading').waitFor({state:'hidden',timeout:45000});await page.waitForTimeout(650);
  const file=time.replace(':','')+'.png';
  await page.screenshot({path:`${directory}/${file}`,clip:{x:280,y:120,width:1000,height:630}});
  cards.push(`<article><h2>${time} <span>${name}</span></h2><img src="${file}" alt="${time} 正面渲染"></article>`);
 }
 assert.deepEqual(errors,[]);
 const html=`<!doctype html><meta charset="utf-8"><title>正面不同时段渲染对比</title><style>*{box-sizing:border-box}body{margin:0;padding:28px;background:#171e32;color:#f2edf5;font-family:system-ui,"Microsoft YaHei",sans-serif}h1{font-size:26px;margin:0 0 8px}p{color:#b9c5d9;margin:0 0 24px;font-size:16px}main{display:grid;grid-template-columns:1fr 1fr;gap:18px}article{background:#252d44;border-radius:12px;overflow:hidden}h2{margin:0;padding:12px 18px;font-size:21px}span{font-size:16px;font-weight:400;color:#c6bed3;margin-left:10px}img{display:block;width:100%}</style><h1>正面 · 一天中的六个时段</h1><p>当前材质与补光版本 · 同一存档场景、同一视角 · 固定晴空，仅改变时间 · 不修改实际存档</p><main>${cards.join('')}</main>`;
 await writeFile(`${directory}/index.html`,html);
 const gallery=await browser.newPage({viewport:{width:1440,height:1000}});
 await gallery.goto('file:///'+process.cwd().replaceAll('\\','/')+`/${directory}/index.html`);
 await gallery.screenshot({path:`${directory}/comparison.png`,fullPage:true});
 console.log('Six time-of-day screenshots and comparison gallery created; no browser errors.');
}finally{await browser.close();}
