import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const browser=await chromium.launch({channel:'msedge',headless:true});
const errors=[],requests=[],report=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>requests.push(r.url()));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:5174/tools/fairytale-preview.html');
 await page.locator('#world[data-ready=true]').waitFor({timeout:90000});
 await mkdir('artifacts/fairytale',{recursive:true});
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
  await page.setViewportSize(viewport);
  for(const side of ['front','back']){
   await page.locator(`button[data-side="${side}"]`).click();
   if(viewport.width===1440&&side==='back'){
    await page.waitForTimeout(120);
    await page.screenshot({path:'artifacts/fairytale/flip-midpoint.png',timeout:60000});
   }
   await page.locator(`#world[data-side="${side}"][data-flipping=false]`).waitFor({timeout:15000});
   await page.waitForTimeout(400);
   const pixels=await page.locator('#world canvas').first().evaluate(canvas=>{
    const c=document.createElement('canvas');c.width=canvas.width;c.height=canvas.height;
    const ctx=c.getContext('2d');ctx.drawImage(canvas,0,0);const data=ctx.getImageData(0,0,c.width,c.height).data;
    const colors=new Set();let light=0;
    for(let i=0;i<data.length;i+=64){colors.add(`${data[i]},${data[i+1]},${data[i+2]}`);if(data[i]>150&&data[i+1]>100)light++;}
    return {colors:colors.size,light};
   });
   await page.screenshot({path:`artifacts/fairytale/${side}-${viewport.width}.png`,timeout:60000});
   assert.ok(pixels.colors>200,'terrain must retain visible color detail');
   if(side==='front')assert.ok(pixels.light>200);
   else assert.ok(pixels.light>10,'dark face must retain localized light');
   report.push({side,...viewport,pixels});
  }
 }
 await page.setViewportSize({width:1440,height:1000});
 for(const value of [0,40,100]){
  await page.locator('#progress').evaluate((input,value)=>{input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));},value);await page.waitForTimeout(150);
  await page.screenshot({path:`artifacts/fairytale/construction-${value}.png`,timeout:60000});
 }
 await page.locator('#day').click();await page.waitForTimeout(600);
 await page.screenshot({path:'artifacts/fairytale/back-night.png',timeout:60000});
 await page.locator('[data-item="fairyLantern"]').click();
 await page.mouse.move(770,580);await page.waitForTimeout(250);
 await page.locator('#cancel').click();
 const before=await page.locator('#world canvas').first().screenshot();
 await page.mouse.move(720,450);await page.mouse.down({button:'right'});await page.mouse.move(850,470,{steps:10});await page.mouse.up({button:'right'});await page.waitForTimeout(300);
 const after=await page.locator('#world canvas').first().screenshot();assert.notDeepEqual(before,after,'orbit controls must move the real scene');
 assert.equal(requests.some(url=>url.includes('/api/')),false,'acceptance preview must not access a save API');
 assert.deepEqual(errors,[]);
 await writeFile('artifacts/fairytale/browser-verification.json',JSON.stringify({report,errors,saveApiRequests:0},null,2));
 console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
