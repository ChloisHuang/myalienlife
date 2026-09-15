import {chromium} from '@playwright/test';
const browser=await chromium.launch();
const page=await browser.newPage();
const assets=[];
const t0=Date.now();
page.on('response',async r=>{
 const u=r.url();
 if(/\.(glb|png|webp|jpg|woff2|wasm|js|css)(\?|$)/.test(u)){
  const req=r.request();
  const start=req.timing?.()?.startTime??0;
  let size=0;try{size=(await r.body()).length;}catch{}
  assets.push({url:u.split('/').slice(-1)[0].slice(0,44),size,ms:Date.now()-t0,status:r.status(),type:req.resourceType()});
 }
});
page.on('websocket',s=>{s.on('framereceived',()=>{if(!globalThis.first)globalThis.first=Date.now()-t0;});});
await page.goto('https://www.doudouai.net:6443/',{waitUntil:'domcontentloaded',timeout:60000});
console.log('① DOMContentLoaded:',Date.now()-t0,'ms');
const marks=[];
for(let i=0;i<60;i++){
 await page.waitForTimeout(500);
 const vis=await page.locator('#loading').isVisible().catch(()=>false);
 marks.push([Date.now()-t0,vis,(await page.locator('#loading').innerText().catch(()=>'')).replace(/\n/g,' ').slice(0,34)]);
 if(!vis)break;
}
const last=marks.at(-1);
console.log('② 遮罩消失于:',last[0],'ms（共',(last[0]/1000).toFixed(1),'秒）');
console.log('③ 首帧到达:',globalThis.first??'未收到','ms');
const stages=[...new Set(marks.map(m=>m[2]))];
console.log('④ 遮罩文案变化:');for(const s of stages)console.log('    -',s);
console.log('⑤ 最慢的 12 个请求:');
assets.sort((a,b)=>b.ms-a.ms);
for(const a of assets.slice(0,12))console.log(`    ${String(a.ms).padStart(6)}ms  ${String(Math.round(a.size/1024)).padStart(5)}KB  ${a.type.padEnd(10)} ${a.url}`);
const big=assets.filter(a=>a.size>200*1024).sort((a,b)=>b.size-a.size);
console.log('⑥ 超过 200KB 的资源:');for(const a of big.slice(0,8))console.log(`    ${String(Math.round(a.size/1024)).padStart(5)}KB  ${a.url}`);
console.log('⑦ 资源总计:',assets.length,'个 /',Math.round(assets.reduce((s,a)=>s+a.size,0)/1024),'KB');
await browser.close();
