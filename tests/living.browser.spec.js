import {test,expect} from '@playwright/test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {OrthographicCamera,Vector3} from 'three';
import {createGame,ensureStarIsland,enqueue} from '../src/simulation.js';
import {mutableResident,mutableSite,changeBond} from '../src/living-state.js';
import {createSaveStore} from '../server/save-store.js';

const sessions=new WeakMap();
test.beforeEach(async({page})=>{
 const directory=await mkdtemp(join(tmpdir(),'orbit-living-')),store=createSaveStore(directory);sessions.set(page,{store,directory,errors:[]});
 page.on('pageerror',error=>sessions.get(page).errors.push(error.message));
 page.on('console',msg=>{if(msg.type()==='error')sessions.get(page).errors.push(msg.text());});
 await page.route('**/api/project-config',route=>route.fulfill({json:{config:null}}));
 await page.route('**/api/save',async route=>{
  try{const data=route.request().method()==='GET'?await store.read():await store.write(route.request().postDataJSON());await route.fulfill({json:data});}
  catch(error){await route.fulfill({status:400,json:{error:error.message}});}
 });
});
test.afterEach(async({page})=>{const {directory,errors}=sessions.get(page);await page.close();await rm(directory,{recursive:true,force:true});expect(errors).toEqual([]);});
function quiet(){const g=createGame();g.speed=0;g.autonomy.enabled=false;for(const n of Object.values(g.npcs))n.ai.enabled=false;return g;}
async function load(page,g){const {store}=sessions.get(page),current=await store.read();await store.write({state:g,baseRevision:current.revision,clientId:crypto.randomUUID(),sequence:1});await page.goto('/');await expect(page.locator('#loading')).toBeHidden({timeout:45000});}
async function saved(page){await page.locator('#save').click();await expect(page.locator('#save-status')).toHaveAttribute('data-state','saved');return(await sessions.get(page).store.read()).state;}
async function clickWorld(page,x,y,z){
 const r=await page.locator('#world canvas').first().boundingBox(),v=14*Math.max(1,1.3*r.height/r.width),c=new OrthographicCamera(-v*r.width/r.height,v*r.width/r.height,v,-v,.1,180);
 c.position.set(23,25,30);c.lookAt(0,0,0);c.updateMatrixWorld();const offset=new Vector3().setFromMatrixColumn(c.matrixWorld,0).multiplyScalar(2.4);c.position.add(offset);c.lookAt(offset);c.zoom=.92;c.updateProjectionMatrix();c.updateMatrixWorld();const p=new Vector3(x,y,z).project(c);
 await page.mouse.click(r.x+(p.x+1)*r.width/2,r.y+(1-p.y)*r.height/2);
}
async function canvasStats(page){return page.locator('#world canvas').first().evaluate(canvas=>{
 const out=document.createElement('canvas');out.width=canvas.width;out.height=canvas.height;const ctx=out.getContext('2d');ctx.drawImage(canvas,0,0);const pixels=ctx.getImageData(0,0,out.width,out.height).data;let bright=0,red=0;
 for(let i=0;i<pixels.length;i+=4){if(Math.max(pixels[i],pixels[i+1],pixels[i+2])>70)bright++;if(pixels[i]>100&&pixels[i]>pixels[i+1]*1.55&&pixels[i]>pixels[i+2]*1.4)red++;}
 return {bright,red};
});}

test('tree care is clickable, visibly animated, persisted and available on narrow screens',async({page})=>{
 const g=quiet(),tree={id:'living-tree',type:'spiritTree',x:0,z:4,side:'front',rotation:0};g.objects.push(tree);mutableSite(g,tree).vitality=20;
 await load(page,g);await clickWorld(page,0,2.5,4);
 await expect(page.locator('[data-action="tendTree"]')).toBeVisible();await expect(page.locator('#living-status')).toContainText('20 / 100');
 await page.locator('[data-action="tendTree"]').click();await page.locator('[data-speed="3"]').click();
 await expect(page.locator('#queue')).toContainText('照料圣树根系');await page.waitForTimeout(2000);await page.screenshot({path:'artifacts/living-tree-care.png'});
 await expect(page.locator('#queue')).not.toContainText('照料圣树根系',{timeout:20000});await page.locator('[data-speed="0"]').click();
 const state=await saved(page);expect(state.living.sites[tree.id].vitality).toBeGreaterThan(20);expect(state.living.sites[tree.id].keeper).toBe(g.player.uid);
 await page.reload();await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'关系',exact:true}).click();await page.locator('#panel-content [data-npc="nova"]').click();
 await expect(page.locator('[data-action="accompany"]')).toBeVisible();await expect(page.locator('[data-action="shareLight"]')).toBeDisabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await page.screenshot({path:'artifacts/living-menu-mobile.png'});
});

test('mixed relationships expose repair and light support through real controls',async({page})=>{
 const g=quiet();g.player.prayer.radiance=10;mutableResident(g,g.npcs.nova).fear=60;changeBond(g,g.npcs.nova,g.player,{trust:30,resentment:40,dependence:25});
 await load(page,g);await page.getByRole('button',{name:'关系',exact:true}).click();await page.locator('#panel-content [data-npc="nova"]').click();
 await expect(page.locator('#living-status')).toContainText('依赖却有怨气');await page.locator('[data-action="reconcile"]').click();await page.locator('[data-speed="3"]').click();
 await expect(page.locator('#queue')).not.toContainText('道歉与修复',{timeout:20000});await page.locator('[data-speed="0"]').click();
 expect((await saved(page)).living.residents.nova.bonds.find(b=>b.uid===g.player.uid).resentment).toBeLessThan(40);
});

test('fairytale back shows blood moon, moving bat silhouettes, independent shadows and light support',async({page})=>{
 const g=quiet();g.civilization.discoveryPath.push('spore');g.civilization.visits.spore=1;Object.assign(g.civilization.projects.spore,{blueprint:300,construction:600});ensureStarIsland(g,'spore');g.space.backs.spore=true;g.viewIsland='spore';g.viewSide='back';
 Object.assign(g.player,{island:'spore',side:'back',x:0,z:3});g.player.prayer.radiance=10;
 Object.assign(g.npcs.nova,{island:'spore',side:'back',x:2,z:3});Object.assign(mutableResident(g,g.player),{garden:48,shadow:52,charge:70});Object.assign(mutableResident(g,g.npcs.nova),{shadow:20,fear:65});
 enqueue(g,'shareLight','nova');Object.assign(g.queue[0],{phase:'acting',elapsed:3,path:[]});
 await load(page,g);await expect(page.locator('#world')).toHaveAttribute('data-flipping','false');
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(800);const stats=await canvasStats(page);expect(stats.bright).toBeGreaterThan(15000);expect(stats.red).toBeGreaterThan(100);await page.screenshot({path:`artifacts/living-forest-${width}.png`});}
 await page.setViewportSize({width:1440,height:1000});const before=await page.locator('#world canvas').first().screenshot();await page.locator('[data-speed="1"]').click();await page.waitForTimeout(1400);await page.locator('[data-speed="0"]').click();const after=await page.locator('#world canvas').first().screenshot();expect(before.equals(after)).toBe(false);
 expect((await saved(page)).living.residents[g.player.uid].garden).toBe(48);
 for(const side of ['front','back']){
  await page.locator('#flip-island').click();await expect(page.locator('#world')).toHaveAttribute('data-flipping','true');
  await page.screenshot({path:`artifacts/living-flip-to-${side}.png`});
  await expect(page.locator('#world')).toHaveAttribute('data-flipping','false');await expect(page.locator('#world')).toHaveAttribute('data-side',side);
  await page.screenshot({path:`artifacts/living-moon-${side}.png`});
 }
});

test('garden affinity renders living blossoms and antenna buds on both viewports',async({page})=>{
 const g=quiet();g.civilization.discoveryPath.push('spore');g.civilization.visits.spore=1;Object.assign(g.civilization.projects.spore,{blueprint:300,construction:600});ensureStarIsland(g,'spore');g.viewIsland='spore';
 const garden=g.objects.find(o=>o.id==='spore-garden');Object.assign(g.player,{island:'spore',x:5,z:3.5});Object.assign(mutableResident(g,g.player),{garden:48,charge:80});mutableSite(g,garden).keeper=g.player.uid;
 await load(page,g);for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(700);expect((await canvasStats(page)).bright).toBeGreaterThan(15000);await page.screenshot({path:`artifacts/living-garden-${width}.png`});}
});

test('a permanent flower imprint remains visible and named after ordinary adaptation has faded',async({page})=>{
 const g=quiet();Object.assign(mutableResident(g,g.player),{imprint:'bloom',garden:0,charge:0});
 await load(page,g);await page.getByRole('button',{name:'人物',exact:true}).click();
 await expect(page.locator('.living-experience')).toContainText('永久印记：花契');
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});await page.screenshot({path:`artifacts/living-imprint-${width}.png`});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 }
 const state=await saved(page);expect(state.living.residents[g.player.uid].imprint).toBe('bloom');
});
