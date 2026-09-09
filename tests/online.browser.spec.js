import {test,expect} from '@playwright/test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHttpService} from '../server/http-service.js';
import {createGame} from '../src/simulation.js';

test('hosted world renders on phones, transfers authority, and runs with every browser closed',async({browser})=>{
 const directory=await mkdtemp(join(tmpdir(),'orbit-online-browser-')),token='browser-test-'.repeat(5),initial=createGame();initial.speed=0;
 const service=await createHttpService({directory,dist:resolve('.deploy/release/dist'),token,origin:'http://127.0.0.1:18191',initial});
 await new Promise(r=>service.server.listen(18191,'127.0.0.1',r));const errors=[];
 const a=await browser.newPage({viewport:{width:1440,height:1000}}),b=await browser.newPage({viewport:{width:390,height:844}});
 try{
  for(const page of [a,b]){page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});page.on('console',m=>{if(m.type()==='error')console.error(m.text());});await page.goto('http://127.0.0.1:18191');await expect(page.locator('#loading')).toBeHidden({timeout:45000});await expect(page.locator('#online-status')).toHaveText('访客 · 只读');}
  await a.locator('[data-speed="3"]').dispatchEvent('click');expect(service.authority.state.speed).toBe(0);
  for(const page of [a,b]){
   await page.locator('#operator-login').click();await page.locator('#operator-token').fill(token);await page.locator('#operator-form button[type="submit"]').click();await expect(page.locator('#operator-dialog')).not.toBeVisible();
   await page.locator('#claim-control').click();await expect(page.locator('#online-status')).toHaveText('操作中');
  }
  await expect(a.locator('#online-status')).toHaveText('已验证 · 只读');
  await a.locator('[data-speed="3"]').dispatchEvent('click');expect(service.authority.state.speed).toBe(0);
  await b.locator('[data-speed="1"]').click();await expect.poll(()=>service.authority.state.speed).toBe(1);
  await b.locator('#autonomy').click();await expect.poll(()=>service.authority.state.autonomy.enabled).toBe(false);
  for(const [page,width] of [[a,1440],[b,390]]){
   await page.route('**/api/state',async route=>{await new Promise(r=>setTimeout(r,450));await route.continue();});
   await page.waitForTimeout(2200);
   const movingFrames=await page.locator('#world canvas').evaluate(canvas=>new Promise(resolve=>{
    const image=document.createElement('canvas');image.width=96;image.height=96;const ctx=image.getContext('2d'),hashes=[];
    function sample(){ctx.drawImage(canvas,0,0,96,96);const pixels=ctx.getImageData(0,0,96,96).data;let hash=2166136261;for(let i=0;i<pixels.length;i+=4)hash=Math.imul(hash^pixels[i],16777619);hashes.push(hash);if(hashes.length===30)resolve(new Set(hashes).size);else requestAnimationFrame(sample);}requestAnimationFrame(sample);
   }));expect(movingFrames).toBeGreaterThan(15);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   const colors=await page.locator('#world canvas').evaluate(canvas=>{const c=document.createElement('canvas');c.width=canvas.width;c.height=canvas.height;const ctx=c.getContext('2d');ctx.drawImage(canvas,0,0);const d=ctx.getImageData(0,0,c.width,c.height).data,s=new Set();for(let i=0;i<d.length;i+=64)s.add(`${d[i]},${d[i+1]},${d[i+2]}`);return s.size;});expect(colors).toBeGreaterThan(100);
   await page.screenshot({path:`artifacts/online-${width}.png`});
  }
  const before=service.authority.state.minute;await a.close();await b.close();await new Promise(r=>setTimeout(r,1500));expect(service.authority.state.minute).toBeGreaterThan(before);expect(errors).toEqual([]);
 }finally{await a.close();await b.close();await service.close();await rm(directory,{recursive:true,force:true});}
});
