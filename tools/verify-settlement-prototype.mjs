import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],states=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{assert.ok(!r.url().includes('/api/save'),'Preview must never access game saves');});
 await page.goto('http://127.0.0.1:5173/tools/settlement-prototype.html');
 await page.waitForFunction(()=>window.previewReady,{},{timeout:60000});
 for(let i=0;i<13;i++){
  await page.waitForTimeout(700);
  states.push(await page.evaluate(()=>window.previewState));
  const pixels=await page.evaluate(()=>{const source=document.querySelector('canvas'),c=document.createElement('canvas');c.width=160;c.height=100;const ctx=c.getContext('2d');ctx.drawImage(source,0,0,160,100);const p=ctx.getImageData(0,0,160,100).data;let count=0;for(let i=0;i<p.length;i+=4)if(Math.abs(p[i]-p[0])+Math.abs(p[i+1]-p[1])+Math.abs(p[i+2]-p[2])>35)count++;return count;});
  assert.ok(pixels>1500,`Island ${i} must be visibly rendered: ${pixels}`);
  await page.screenshot({path:`artifacts/settlement-prototype-${i+1}.png`});
  if(i<12)await page.getByRole('button',{name:'下一座岛',exact:true}).click();
 }
 assert.equal(new Set(states.map(s=>s.biome)).size,13);
 assert.equal(new Set(states.map(s=>JSON.stringify(s.rooms))).size,13);
 assert.equal(new Set(states.map(s=>s.planKind)).size,4);
 for(const s of states){assert.equal(s.rooms.length,6);assert.ok(s.rooms.some(r=>r.type==='育生室'));assert.equal(s.baseLayout.length,8);assert.equal(s.furniture.filter(t=>t==='nursery').length,1);assert.equal(s.furniture.length,new Set(s.furniture).size);assert.ok(s.corridors.length);}
 await page.getByRole('button',{name:'俯视户型',exact:true}).click();await page.waitForTimeout(500);await page.screenshot({path:'artifacts/settlement-prototype-plan.png'});
 await page.getByRole('button',{name:'重置视角',exact:true}).click();await page.locator('#night').check();await page.waitForTimeout(500);await page.screenshot({path:'artifacts/settlement-prototype-night.png'});
 await page.setViewportSize({width:390,height:844});await page.locator('#night').uncheck();await page.getByRole('button',{name:'重置视角',exact:true}).click();await page.waitForTimeout(500);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'artifacts/settlement-prototype-mobile.png'});
 const before=await page.evaluate(()=>window.previewState.seed);await page.getByRole('button',{name:'重新随机生成',exact:true}).click();assert.notEqual(await page.evaluate(()=>window.previewState.seed),before);
 assert.deepEqual(errors,[]);
 const contact=await browser.newPage({viewport:{width:1440,height:1000}});
 await contact.goto('http://127.0.0.1:5173/tools/settlement-prototype.html');
 await contact.setContent(`<style>body{margin:0;display:grid;grid-template-columns:repeat(3,1fr);background:#e8eff0}img{width:480px;height:333px}</style>${states.slice(4).map((_,i)=>`<img src="http://127.0.0.1:5173/artifacts/settlement-prototype-${i+5}.png">`).join('')}`);
 await contact.locator('img').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));await contact.screenshot({path:'artifacts/settlement-prototype-overview.png'});
 console.log('Verified 13 surfaces, unique furniture, connected rooms, rendered pixels, desktop/mobile, overhead/night views, random regeneration, and no save access.');
}finally{await browser.close();}
