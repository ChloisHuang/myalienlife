import {createWonder} from '../src/wonders.js';
import {test,expect} from '@playwright/test';
import {prayerFixture} from './helpers/prayer-fixture.js';
import {createGame,CAREERS} from '../src/simulation.js';
import {createSaveStore} from '../server/save-store.js';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {OrthographicCamera,Vector3} from 'three';
const stores=new WeakMap(),fixtures=new WeakMap(),handlers=new WeakMap();

test('mushroom variants render on desktop and mobile; harvesting clears the plant and menu',async({page})=>{
 const {createPlant}=await import('../src/plants.js');const state=createGame();state.speed=0;state.autonomy.enabled=false;for(const n of Object.values(state.npcs))n.ai.enabled=false;
 state.objects=[{}, {giant:true}, {cluster:true}, {mutant:true}, {mutant:true,cluster:true}].map((traits,i)=>({id:`crop-${i}`,type:'mushroom',x:-8+i*4,z:2,rotation:0,side:'front',island:'home',plant:{...createPlant(),growth:1,...traits}}));
 fixtures.set(page,state);const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});await page.waitForTimeout(300);
  const colors=await page.locator('#world canvas').evaluate(canvas=>{const c=document.createElement('canvas');c.width=canvas.width;c.height=canvas.height;const ctx=c.getContext('2d');ctx.drawImage(canvas,0,0);const data=ctx.getImageData(0,0,c.width,c.height).data,set=new Set();for(let i=0;i<data.length;i+=64)set.add(`${data[i]},${data[i+1]},${data[i+2]}`);return set.size;});
  expect(colors).toBeGreaterThan(100);await page.screenshot({path:`artifacts/mushroom-variants-${width}.png`});
 }
 await page.setViewportSize({width:1440,height:1000});await page.waitForTimeout(300);
 const b=await page.locator('#world canvas').boundingBox(),p=new Vector3(4,1.8,2).project(sceneCamera(b));await page.mouse.click(b.x+(p.x+1)*b.width/2,b.y+(1-p.y)*b.height/2);
 await expect(page.locator('#plant-status')).toContainText('变异');await expect(page.locator('#plant-status')).toContainText('150 星币');
 await page.locator('[data-action="harvest"]').click();await page.locator('[data-speed="3"]').click();await expect(page.locator('#money')).toHaveText('2,550',{timeout:20000});await page.locator('[data-speed="0"]').click();
 await expect(page.locator('#context-menu')).toBeHidden();await page.locator('#save').click();const saved=await savedState(page);expect(saved.objects.some(o=>o.id==='crop-3')).toBe(false);expect(saved.harvest.mushrooms).toBe(0);expect(errors).toEqual([]);
});

test('catalog mushroom placement queues a resident walking and planting on the chosen tile',async({page})=>{
 const state=createGame();state.speed=0;state.autonomy.enabled=false;for(const n of Object.values(state.npcs))n.ai.enabled=false;fixtures.set(page,state);
 await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});await page.getByRole('button',{name:'物品包',exact:true}).click();await page.locator('[data-item="mushroom"]').click();
 const b=await page.locator('#world canvas').boundingBox(),p=new Vector3(-5,.29,4).project(sceneCamera(b));await page.mouse.click(b.x+(p.x+1)*b.width/2,b.y+(1-p.y)*b.height/2);
 await expect(page.locator('#queue')).toContainText('种植星伞蘑菇');await expect(page.locator('#money')).toHaveText('2,400');await page.locator('[data-speed="3"]').click();await expect(page.locator('#money')).toHaveText('2,380',{timeout:20000});await page.locator('[data-speed="0"]').click();await page.locator('#save').click();
 const saved=await savedState(page),crop=saved.objects.find(o=>o.type==='mushroom');expect(crop.x).toBe(-5);expect(crop.z).toBe(4);expect(crop.plant.growth).toBeLessThan(.15);
});

test('repaired school record displays real foundation requirements and persists without inflated credits',async({page})=>{
 const {switchControl}=await import('../src/simulation.js');const g=createGame();switchControl(g,'pip');g.speed=0;g.player.education={version:2,credits:55,focus:null,foundation:{practical:2,logic:0,nature:1,expression:2,arts:2},major:null};fixtures.set(page,g);
 await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});await page.locator('[data-tab="career"]').click();
 await expect(page.locator('.learning-heading h3')).toHaveText('幼儿园');await expect(page.locator('.learning-heading')).toContainText('7 学分 / 6 学分');await expect(page.locator('.education-requirements')).toContainText('至少一项基础能力达到 Lv.2');await expect(page.locator('.learning-heading .meter>span')).toHaveAttribute('style','width:100%');
 await page.screenshot({path:'artifacts/education-repaired-desktop.png'});await page.setViewportSize({width:390,height:844});await page.locator('.education-requirements').scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/education-repaired-mobile.png'});
 await page.reload();await expect(page.locator('#loading')).toBeHidden({timeout:45000});await page.locator('[data-tab="career"]').click();await expect(page.locator('.learning-heading h3')).toHaveText('幼儿园');await expect(page.locator('.learning-heading')).toContainText('7 学分 / 6 学分');
});

test('education stages show foundations, readonly specialization and adult continuing study without noisy decimals',async({page})=>{
 const {switchControl}=await import('../src/simulation.js');const g=createGame();switchControl(g,'pip');g.speed=0;g.player.preferences.dance=24.123456789;g.player.prayer.radiance=2;g.player.education.foundation.arts=4;fixtures.set(page,g);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden();await page.locator('[data-tab="career"]').click();
 await expect(page.locator('.education-path')).toHaveText('幼儿园 → 小学 → 中学 → 高中 → 大学 → 研究生 → 博士');await expect(page.locator('#study-focus option[value="music"]')).toHaveText('艺术感知');await expect(page.locator('.learning-panel')).toContainText('基础能力');await expect(page.locator('.learning-panel')).toContainText('兴趣 24.12');await expect(page.locator('#panel-content')).not.toContainText('123456789');await page.screenshot({path:'artifacts/education-foundations.png'});
 await page.locator('[data-tab="resident"]').click();await expect(page.locator('.prayer-status')).toContainText('曦光属性 2');await expect(page.locator('.prayer-status')).not.toContainText('123456789');
 g.player.age=24;g.player.education.credits=60;for(const key in g.player.education.foundation)g.player.education.foundation[key]=18;g.player.education.major='music';g.skills.music=3.123456789;fixtures.set(page,g);await page.reload();await expect(page.locator('#loading')).toBeHidden();await page.locator('[data-tab="career"]').click();await page.locator('.continuing-education summary').click();
 await expect(page.locator('.education-major')).toContainText('星律艺术');await expect(page.locator('.education-major')).toContainText('音乐 · 学习效率 ×2');await expect(page.locator('.education-major select')).toHaveCount(0);await page.locator('#study-focus').selectOption('science');await expect(page.locator('.continuing-education')).toHaveAttribute('open','');await expect(page.locator('.education-major')).toContainText('星律艺术');
 await page.locator('#study').click();await expect(page.locator('#toast')).toContainText('已安排学习');await page.setViewportSize({width:390,height:844});await page.locator('.education-major').scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/education-university-mobile.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('[data-tab="skills"]').click();await expect(page.locator('[data-skill="music"]')).toContainText('经验 0.12 / 6');await expect(page.locator('#panel-content')).not.toContainText('123456789');expect(errors).toEqual([]);
});

test('resident dossier uses consistent typography and controls across desktop and mobile panels',async({page})=>{
 const state=createGame();state.speed=0;fixtures.set(page,state);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden();
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
  await page.setViewportSize(viewport);
  for(const tab of ['needs','skills','resident','career','life','relations','exploration','items']){
   await page.locator(`[data-tab="${tab}"]`).click();
   const metrics=await page.locator('#panel-content').evaluate(el=>{const controls=[...el.querySelectorAll('select,input,button.primary')].filter(c=>c.getClientRects().length);return {overflow:el.scrollWidth>el.clientWidth,font:getComputedStyle(el).fontSize,controls:controls.map(c=>({height:c.getBoundingClientRect().height,font:getComputedStyle(c).fontFamily}))};});
   expect(metrics.overflow,tab).toBe(false);expect(metrics.font).toBe('13px');for(const c of metrics.controls){expect(c.height).toBeGreaterThanOrEqual(36);expect(c.font).toContain('PingFang SC');}
   await page.screenshot({path:`artifacts/dossier-${tab}-${viewport.width}.png`});
  }
 }
 expect(errors).toEqual([]);
});

test('minor learning panel selects subjects, displays skill levels and switches back to adult careers',async({page})=>{
 const {switchControl}=await import('../src/simulation.js');const state=createGame();switchControl(state,'pip');state.speed=0;fixtures.set(page,state);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 await expect(page.locator('[data-tab="career"]')).toContainText('学习');await page.locator('[data-tab="career"]').click();await expect(page.locator('.learning-panel')).toContainText('幼儿园');await expect(page.locator('[data-career]')).toHaveCount(0);
 await page.locator('#study-focus').selectOption('music');await page.locator('#study').click();await expect(page.locator('#toast')).toContainText('已安排学习');await page.screenshot({path:'artifacts/education-desktop.png'});
 await page.setViewportSize({width:390,height:844});await expect(page.locator('#study-focus')).toBeVisible();await page.screenshot({path:'artifacts/education-mobile.png'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.keyboard.press('3');await expect(page.locator('.learning-heading')).toContainText('1 学分 / 6 学分',{timeout:25000});await page.keyboard.press('Space');await page.locator('.learning-panel .skill-card').last().scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/education-mobile-skills.png'});
 state.player.age=18;state.player.education.credits=144;for(const key in state.player.education.foundation)state.player.education.foundation[key]=18;fixtures.set(page,state);await page.reload();await expect(page.locator('#loading')).toBeHidden({timeout:45000});await page.locator('[data-tab="career"]').click();await expect(page.locator('[data-tab="career"]')).toContainText('职业');await expect(page.locator('.career-current')).toContainText('博士 ×1.6');expect(errors).toEqual([]);
});

test('hovering cargo shelves and UFOs shows local stock and loaded capacity without opening a dialog',async({page})=>{
 const {ufoDock}=await import('../src/ufo-visuals.js');const state=createGame();state.speed=0;
 state.objects=[{id:'cargo-shelf',type:'materialCabinet',x:0,z:3,island:'home',side:'front',rotation:0},{id:'cargo-platform',type:'loadingPlatform',x:5,z:3,island:'home',side:'front',rotation:0}];
 state.space.materials.home=42;state.space.ships=[{id:'hover-ship',tier:2,island:'home',side:'front',food:3,durability:80,reservedBy:null},{id:'back-ship',tier:1,island:'home',side:'back',food:0,durability:100,reservedBy:null}];state.space.cargo={'hover-ship':12,'back-ship':7};fixtures.set(page,state);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 const hover=async(x,y,z)=>{const bounds=await page.locator('#world canvas').boundingBox(),p=new Vector3(x,y,z).project(sceneCamera(bounds));await page.mouse.move(bounds.x+(p.x+1)*bounds.width/2,bounds.y+(1-p.y)*bounds.height/2);};
 const tooltip=page.locator('#tooltip');await hover(0,1,3);await expect(tooltip).toContainText('本岛建材库存 42 份');await expect(tooltip).toContainText('同岛面飞船装填 12 / 60 份');await expect(page.locator('dialog[open]')).toHaveCount(0);await page.screenshot({path:'artifacts/cargo-shelf-hover.png'});
 await hover(5,.7,3);await expect(tooltip).toContainText('星港装卸平台');await expect(tooltip).toContainText('同岛面飞船装填 12 / 60 份');
 const dock=ufoDock(state,state.space.ships[0]);await hover(dock.x,dock.y,dock.z);await expect(tooltip).toContainText('建材装填 12 / 60 份');await expect(tooltip).toContainText('本岛建材库存 42 份');await expect(tooltip).toContainText('补给 3/10');await page.screenshot({path:'artifacts/ufo-cargo-hover.png'});
 const box=await tooltip.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(1440);expect(box.y).toBeGreaterThanOrEqual(0);await page.mouse.move(20,20);await expect(tooltip).toBeHidden();
 state.space.ships=[];state.space.cargo={};state.space.materials={};fixtures.set(page,state);await page.setViewportSize({width:390,height:844});await page.reload();await expect(page.locator('#loading')).toBeHidden({timeout:45000});await hover(0,1,3);
 await expect(tooltip).toContainText('本岛建材库存 0 份');await expect(tooltip).toContainText('同岛面飞船装填 0 / 0 份');await expect(tooltip).toContainText('本岛面暂无飞船');const mobileBox=await tooltip.boundingBox();expect(mobileBox.x).toBeGreaterThanOrEqual(0);expect(mobileBox.x+mobileBox.width).toBeLessThanOrEqual(390);expect(mobileBox.y+mobileBox.height).toBeLessThanOrEqual(844);await page.screenshot({path:'artifacts/cargo-hover-mobile.png'});expect(errors).toEqual([]);
});

test('cargo hover inventory refreshes while the pointer stays still',async({page})=>{
 const {enqueue}=await import('../src/simulation.js');const state=createGame(),plant=state.objects.find(o=>o.type==='garden');
 state.speed=0;state.autonomy.enabled=false;for(const n of Object.values(state.npcs))n.ai.enabled=false;
 state.objects=[plant,{id:'live-shelf',type:'materialCabinet',x:0,z:3,island:'home',side:'front',rotation:0}];state.career.id='botanist';plant.plant.growth=1;state.player.x=plant.x;state.player.z=plant.z+1;
 expect(enqueue(state,'extractMaterials',plant.id).ok).toBe(true);fixtures.set(page,state);
 await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 const bounds=await page.locator('#world canvas').boundingBox(),p=new Vector3(0,1,3).project(sceneCamera(bounds));await page.mouse.move(bounds.x+(p.x+1)*bounds.width/2,bounds.y+(1-p.y)*bounds.height/2);
 const tooltip=page.locator('#tooltip');await expect(tooltip).toContainText('本岛建材库存 0 份');await page.keyboard.press('3');
 await expect(tooltip).toContainText('本岛建材库存 9 份',{timeout:20000});
});

test('Atoll preview follows the server save without starting or saving a game',async({page})=>{
 const state=createGame();state.day=159;state.civilization.discoveryPath=['home','spore'];state.civilization.visits.spore=1;state.viewIsland=state.player.island='spore';fixtures.set(page,state);
 const writes=[],errors=[];page.on('request',r=>{if(r.url().endsWith('/api/save')&&r.method()!=='GET')writes.push(r.method());});page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:600,height:420});await page.goto('http://127.0.0.1:5173/tools/atoll-verification.html');
 await expect(page.locator('#status')).toBeHidden({timeout:45000});await expect(page.locator('#world')).toHaveAttribute('data-day','159');await expect(page.locator('#world')).toHaveAttribute('data-island','spore');
 const colors=await page.evaluate(()=>{const c=document.querySelector('canvas'),gl=c.getContext('webgl2'),p=new Uint8Array(c.width*c.height*4);gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,p);const colors=new Set();for(let i=0;i<p.length;i+=64)colors.add(`${p[i]},${p[i+1]},${p[i+2]}`);return colors.size;});expect(colors).toBeGreaterThan(50);
 await page.screenshot({path:'artifacts/atoll-save-preview.png'});
 state.day=160;state.viewIsland='home';fixtures.set(page,state);await expect(page.locator('#world')).toHaveAttribute('data-day','160');await expect(page.locator('#world')).toHaveAttribute('data-island','home');
 expect(writes).toEqual([]);expect(errors).toEqual([]);
});

test('floating island moves the live canvas and restores it on return and window close',async({page,context})=>{
 const state=createGame();state.speed=1;fixtures.set(page,state);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 await page.evaluate(()=>window.originalIslandCanvas=document.querySelector('#world canvas'));
 const enter=async()=>{const opened=context.waitForEvent('page');await page.getByRole('button',{name:'开启浮窗',exact:true}).click();const popup=await opened;popup.on('pageerror',e=>errors.push(e.message));await popup.setViewportSize({width:640,height:480});await expect(popup.locator('#world canvas')).toBeVisible();return popup;};
 const popup=await enter();await expect(popup.locator('button')).toHaveCount(1);const back=popup.getByRole('button',{name:'回归',exact:true});await expect(back).toBeVisible();await expect(back).toHaveText('');await expect(back).toHaveCSS('background-color','rgb(224, 224, 224)');await expect(back).toHaveCSS('width','36px');await expect(back.locator('svg path').first()).toHaveAttribute('d','m12 19-7-7 7-7');await expect(page.locator('#world')).toHaveCount(0);
 expect(await page.evaluate(()=>documentPictureInPicture.window.document.querySelector('canvas')===window.originalIslandCanvas)).toBe(true);
 const pixels=()=>popup.evaluate(()=>{const c=document.querySelector('canvas'),gl=c.getContext('webgl2'),p=new Uint8Array(c.width*c.height*4);gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,p);const colors=new Set();for(let i=0;i<p.length;i+=64)colors.add(`${p[i]},${p[i+1]},${p[i+2]}`);return {colors:colors.size,sample:Array.from(p.filter((_,i)=>i%509===0)).join(',')};});
 await expect.poll(async()=>(await pixels()).colors).toBeGreaterThan(50);const first=(await pixels()).sample;await expect.poll(async()=>(await pixels()).sample).not.toBe(first);
 await popup.screenshot({path:'artifacts/floating-island.png'});await popup.setViewportSize({width:320,height:480});await expect.poll(async()=>(await pixels()).colors).toBeGreaterThan(50);await popup.screenshot({path:'artifacts/floating-island-narrow.png'});await popup.getByRole('button',{name:'回归',exact:true}).click();await expect(page.locator('#world canvas')).toBeVisible();expect(await page.evaluate(()=>document.querySelector('#world canvas')===window.originalIslandCanvas)).toBe(true);await expect(page.locator('.dashboard')).toBeVisible();
 const second=await enter();await second.close();await expect(page.locator('#world canvas')).toBeVisible();await page.setViewportSize({width:390,height:844});await expect(page.getByRole('button',{name:'开启浮窗',exact:true})).toBeVisible();await page.screenshot({path:'artifacts/floating-entry-mobile.png'});expect(errors).toEqual([]);
});

test('unsupported or denied floating windows keep the original scene usable',async({page})=>{
 fixtures.set(page,createGame());await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 await page.evaluate(()=>{documentPictureInPicture.requestWindow=()=>Promise.reject(new DOMException('浮窗开启被拒绝','NotAllowedError'));});
 await page.getByRole('button',{name:'开启浮窗',exact:true}).click();await expect(page.locator('#toast')).toContainText('浮窗开启被拒绝');await expect(page.locator('#world canvas')).toBeVisible();
 await page.evaluate(()=>Object.defineProperty(window,'documentPictureInPicture',{value:undefined,configurable:true}));await page.getByRole('button',{name:'开启浮窗',exact:true}).click();await expect(page.locator('#toast')).toContainText('当前浏览器不支持独立浮窗');await expect(page.locator('.dashboard')).toBeVisible();await expect(page.locator('#app')).not.toHaveAttribute('inert','');
});

test('left outer UFO fleet renders on desktop and mobile without blocking the rooms',async({page})=>{
 const state=createGame();state.speed=0;state.space.ships=[1,2,3].map(tier=>({id:`left-fleet-${tier}`,tier,island:'home',side:'front',food:4,durability:100,reservedBy:null}));fixtures.set(page,state);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});await expect(page.locator('#world')).toHaveAttribute('data-ufo-count','3');
 for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
  await page.setViewportSize({width,height});await page.locator('#reset-view').click();
  const colors=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>{const gl=document.querySelector('#world canvas').getContext('webgl2'),pixels=new Uint8Array(128*128*4);gl.readPixels(Math.floor(gl.drawingBufferWidth/2)-64,Math.floor(gl.drawingBufferHeight/2)-64,128,128,gl.RGBA,gl.UNSIGNED_BYTE,pixels);const colors=new Set();for(let i=0;i<pixels.length;i+=16)colors.add(`${pixels[i]},${pixels[i+1]},${pixels[i+2]}`);resolve(colors.size);})));expect(colors).toBeGreaterThan(8);
  await page.screenshot({path:`artifacts/ufo-left-${name}.png`});
 }
 expect(errors).toEqual([]);
});

test('professional packs render six devices and expose construction, extraction and shared cargo controls',async({page})=>{
 const renderedColors=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>{const gl=document.querySelector('#world canvas').getContext('webgl2'),pixels=new Uint8Array(128*128*4);gl.readPixels(Math.floor(gl.drawingBufferWidth/2)-64,Math.floor(gl.drawingBufferHeight/2)-64,128,128,gl.RGBA,gl.UNSIGNED_BYTE,pixels);const colors=new Set();for(let i=0;i<pixels.length;i+=16)colors.add(`${pixels[i]},${pixels[i+1]},${pixels[i+2]}`);resolve(colors.size);})));
 const state=createGame();state.speed=0;state.autonomy.enabled=false;state.career.id='architect';state.player.x=-8;state.player.z=5;state.space.materials.home=24;
 const types=['blueprintTable','constructionTerminal','cultivator','extractor','materialCabinet','loadingPlatform'];state.objects=types.map((type,i)=>({id:type,type,x:(i%3-1)*5,z:i<3?-3:3,island:'home',side:'front',rotation:0,...(type==='cultivator'?{plant:{growth:1,water:75,health:100,harvests:0,giant:false}}:{})}));
 state.space.ships.push({id:'pack-ship',tier:1,island:'home',side:'front',food:4,durability:100,reservedBy:null});fixtures.set(page,state);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 await page.locator('[data-tab="items"]').click();for(const pack of ['星穹营造','植生工坊','星港货运']){await page.locator(`[data-pack="${pack}"]`).click();await expect(page.locator('.item-card')).toHaveCount(2);}
 expect(await renderedColors()).toBeGreaterThan(8);await page.screenshot({path:'artifacts/profession-packs-desktop.png'});
 const clickAt=async(x,y,z)=>{const bounds=await page.locator('#world').boundingBox(),p=new Vector3(x,y,z).project(sceneCamera(bounds));await page.mouse.click(bounds.x+(p.x+1)*bounds.width/2,bounds.y+(1-p.y)*bounds.height/2);};
 await clickAt(0,1.35,3.4);expect(errors).toEqual([]);await expect(page.locator('#profession-status')).toContainText('植生复材 24 份');await page.locator('#profession-status [data-ufo="pack-ship"]').click();await expect(page.locator('.cargo-controls')).toContainText('本岛库存 24');await page.locator('.ufo-dialog .dialog-close').click();
 await expect(page.locator('#context-menu')).toBeHidden();await page.setViewportSize({width:390,height:844});await page.locator('#reset-view').click();await page.locator('[data-tab="items"]').click();await page.locator('[data-pack="星穹营造"]').click();await expect(page.locator('.item-card')).toHaveCount(2);expect(await renderedColors()).toBeGreaterThan(8);await page.screenshot({path:'artifacts/profession-packs-mobile.png'});expect(errors).toEqual([]);
});

test('restart epoch requires confirmation and persists a clean first day',async({page})=>{
 const state=createGame();state.day=40;state.money=50000;state.speed=0;state.space.materials.home=80;state.civilization.discoveryPath=['home','spore'];fixtures.set(page,state);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden();await page.locator('#config').click();
 page.once('dialog',d=>d.dismiss());await page.locator('#restart-epoch').click();await expect(page.locator('#day')).toContainText('40');
 await page.screenshot({path:'artifacts/restart-epoch.png'});await page.setViewportSize({width:390,height:844});await page.locator('#restart-epoch').scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/restart-epoch-mobile.png'});page.once('dialog',d=>d.accept());await page.locator('#restart-epoch').click();await expect(page.locator('#config-dialog')).toBeHidden();await expect(page.locator('#day')).toContainText('1');
 await expect.poll(async()=> (await savedState(page))?.day).toBe(1);const saved=await savedState(page);expect(saved.civilization.discoveryPath).toEqual(['home']);expect(saved.money).toBe(2400);expect(saved.space.materials).toEqual({});expect(saved.space.ships).toEqual([]);
 await page.reload();await expect(page.locator('#loading')).toBeHidden();await expect(page.locator('#day')).toContainText('1');expect(errors).toEqual([]);
});

test('cargo dialog loads and unloads local materials within ship capacity',async({page})=>{
 const state=createGame();state.speed=0;state.space.materials.home=30;state.space.ships.push({id:'cargo-ui',tier:1,island:'home',side:'front',food:4,durability:100,reservedBy:null});fixtures.set(page,state);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden();await page.locator('[data-tab="exploration"]').click();await page.locator('[data-ufo="cargo-ui"]').click();
 await page.locator('#cargo-amount').fill('12');await page.locator('[data-load-materials="cargo-ui"]').click();await expect(page.locator('.cargo-controls')).toContainText('已装 12 / 20');await expect(page.locator('.cargo-controls')).toContainText('本岛库存 18');await page.screenshot({path:'artifacts/cargo-desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.locator('#cargo-amount').scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/cargo-mobile.png'});
 await page.locator('[data-unload-materials="cargo-ui"]').click();await expect(page.locator('.cargo-controls')).toContainText('已装 0 / 20');await expect(page.locator('.cargo-controls')).toContainText('本岛库存 30');expect(errors).toEqual([]);
});

test('resident profile shows each residents settled island rather than the island being visited',async({page})=>{
 const state=createGame();state.speed=0;state.civilization.discoveryPath=['home','spore','city'];state.civilization.visits.spore=1;state.player.island=state.viewIsland='spore';state.player.homeIsland='city';state.npcs.nova.homeIsland='spore';fixtures.set(page,state);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});await page.locator('[data-tab="resident"]').click();
 const home=page.locator('#resident-home-island');await expect(home).toHaveText('失落星城');await page.screenshot({path:'artifacts/resident-home-desktop.png'});
 await page.locator('#active-character').click();await page.locator('[data-character="nova"]').click();await expect(home).toHaveText('孢海浮洲');
 await page.locator('#active-character').click();await page.locator('[data-character="zig"]').click();await expect(home).toHaveText('露米纳星湾');
 await page.setViewportSize({width:390,height:844});await expect(home).toBeVisible();await page.screenshot({path:'artifacts/resident-home-mobile.png'});expect(errors).toEqual([]);
});

test('destroy island confirms, evacuates, preserves the next island and survives reload',async({page})=>{
 const state=createGame();state.civilization.discoveryPath=['home','spore','city'];state.civilization.visits.spore=1;state.player.island=state.viewIsland='spore';state.player.homeIsland='spore';state.speed=0;fixtures.set(page,state);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});await page.locator('[data-tab="exploration"]').click();
 const destroy=page.locator('[data-destroy-island="spore"]');await expect(destroy).toBeVisible();await expect(page.locator('[data-destroy-island="home"]')).toHaveCount(0);
 page.once('dialog',dialog=>dialog.dismiss());await destroy.click();await expect(destroy).toBeVisible();
 await destroy.scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/destroy-island-desktop.png'});
 await page.setViewportSize({width:390,height:844});await destroy.scrollIntoViewIfNeeded();await expect(destroy).toBeVisible();await page.screenshot({path:'artifacts/destroy-island-mobile.png'});
 page.once('dialog',dialog=>{expect(dialog.message()).toContain('无法撤销');return dialog.accept();});await destroy.click();await expect(destroy).toHaveCount(0);await expect(page.locator('[data-destroy-island="city"]')).toBeVisible();
 await expect.poll(async()=> (await savedState(page))?.civilization.destroyedIslands).toEqual(['spore']);const saved=await savedState(page);expect(saved.player.island).toBe('home');expect(saved.player.homeIsland).toBe('home');
 await page.reload();await expect(page.locator('#loading')).toBeHidden({timeout:45000});await page.locator('[data-tab="exploration"]').click();await expect(destroy).toHaveCount(0);await expect(page.locator('[data-destroy-island="city"]')).toBeVisible();expect(errors).toEqual([]);
});

test('settlement workbench gates construction behind blueprints and persists construction work',async({page})=>{
 const state=createGame();state.civilization.discoveryPath=['home','spore'];state.civilization.visits.spore=1;state.player.island=state.viewIsland='spore';state.player.x=-2;state.player.z=1.2;state.speed=0;state.autonomy.enabled=false;for(const n of Object.values(state.npcs))n.ai.enabled=false;
 state.career.id='architect';state.space.materials.spore=60;state.objects.push({id:'settlement-bench',type:'lab',x:0,z:0,island:'spore',side:'front',rotation:0});state.civilization.projects.spore.blueprint=299;fixtures.set(page,state);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 const clickBench=async()=>{const bounds=await page.locator('#world').boundingBox(),point=new Vector3(.55,1.9,-.3).project(sceneCamera(bounds));await page.mouse.click(bounds.x+(point.x+1)*bounds.width/2,bounds.y+(1-point.y)*bounds.height/2);};
 await clickBench();expect(errors).toEqual([]);await expect(page.locator('[data-action="constructIsland"]')).toBeDisabled();await expect(page.locator('[data-action="developBlueprint"]')).toBeEnabled();
 await page.locator('[data-action="developBlueprint"]').click();await page.locator('[data-speed="3"]').click();await page.waitForTimeout(1800);await page.locator('[data-speed="0"]').click();await page.locator('#save').click();expect((await savedState(page)).civilization.projects.spore.blueprint).toBe(300);
 await clickBench();await expect(page.locator('[data-action="developBlueprint"]')).toBeDisabled();await expect(page.locator('[data-action="constructIsland"]')).toBeEnabled();await page.locator('[data-action="constructIsland"]').click();await page.locator('[data-speed="3"]').click();await page.waitForTimeout(2200);await page.locator('[data-speed="0"]').click();await page.locator('#save').click();expect((await savedState(page)).civilization.projects.spore.construction).toBeGreaterThan(0);expect(errors).toEqual([]);await page.screenshot({path:'artifacts/settlement-workbench.png'});
});
test.beforeEach(async({context,page})=>{
 const directory=await mkdtemp(join(tmpdir(),'orbit-browser-')),store=createSaveStore(directory);stores.set(page,{store,directory});
 const handler=async route=>{
  try{
   let data;
   if(route.request().method()==='GET'){
    if(fixtures.has(page)){const current=await store.read();await store.write({state:fixtures.get(page),baseRevision:current.revision,clientId:crypto.randomUUID(),sequence:1});fixtures.delete(page);}
    data=await store.read();
   }else data=await store.write(route.request().postDataJSON());
   await route.fulfill({json:{revision:data.revision,savedAt:data.savedAt,state:data.state}});
  }catch(error){await route.fulfill({status:error.status||500,json:{error:error.message}});}
 };handlers.set(page,handler);await context.route('**/api/save',handler);
});
test.afterEach(async({context,page})=>{await context.close();await rm(stores.get(page).directory,{recursive:true,force:true});});
async function savedState(page){await expect(page.locator('#save-status')).toHaveAttribute('data-state','saved');return(await stores.get(page).store.read()).state;}
function sceneCamera(bounds){const camera=new OrthographicCamera(-14*bounds.width/bounds.height,14*bounds.width/bounds.height,14,-14,.1,180);camera.position.set(23,25,30);camera.lookAt(0,0,0);camera.updateMatrixWorld();const offset=new Vector3().setFromMatrixColumn(camera.matrixWorld,0).multiplyScalar(2.4);camera.position.add(offset);camera.lookAt(offset);camera.zoom=.92;camera.updateProjectionMatrix();camera.updateMatrixWorld();return camera;}

test('loading day 159 with generated islands initializes dropdown arrows without resetting the displayed day',async({page})=>{
 const {discoverAdjacentIsland}=await import('../src/civilization.js');const state=createGame();state.day=159;state.speed=0;state.civilization.observations=18;state.wonders.archive=3;state.civilization.discoveryPath=['home','spore','city'];state.civilization.discoveryPath=['home','spore','city'];state.civilization.visits.city=1;discoverAdjacentIsland(state,'city',()=>0);state.civilization.observations++;state.civilization.visits['wild-0']=1;discoverAdjacentIsland(state,'wild-0',()=>0);fixtures.set(page,state);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});await expect(page.locator('#day')).toHaveText('第 159 天');await expect(page.locator('#island-select option')).toHaveCount(5);await page.locator('#island-select').click();await page.keyboard.press('Escape');await expect(page.locator('#island-select')).toBeFocused();
 await expect(page.getByRole('button',{name:'上一座星岛'})).toBeDisabled();await page.getByRole('button',{name:'下一座星岛'}).click();await expect(page.locator('#island-select')).toHaveValue('spore');await page.getByRole('button',{name:'下一座星岛'}).click();await expect(page.locator('#island-select')).toHaveValue('city');await page.getByRole('button',{name:'上一座星岛'}).click();await expect(page.locator('#island-select')).toHaveValue('spore');await expect(page.locator('#world')).toHaveAttribute('data-island','home');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await page.screenshot({path:'artifacts/island-dropdown-mobile.png'});await page.locator('#save').click();const saved=await savedState(page);expect(saved.day).toBe(159);expect(saved.objects).toEqual(state.objects);expect(errors).toEqual([]);
});

test('procedural island renders its saved blueprint after physical landing and reloading',async({page})=>{
 const {discoverAdjacentIsland}=await import('../src/civilization.js');const state=createGame();state.speed=0;state.autonomy.enabled=false;for(const n of Object.values(state.npcs))n.ai.enabled=false;state.civilization.seed=20260908;state.civilization.observations=12;state.civilization.technology=240;state.skills.science=18;state.space.ships.push({id:'fixture-ufo',tier:3,island:'home',side:'front',food:2,durability:100,reservedBy:null});state.civilization.discoveryPath=['home','spore','city'];state.civilization.visits.city=1;discoverAdjacentIsland(state,'city',()=>0);state.skills.botany=18;state.player.preferences.garden=10;fixtures.set(page,state);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});await page.locator('#island-select').selectOption('wild-0');await page.locator('[data-voyage="wild-0"]').click();await page.locator('#confirm-flight').click();await page.locator('[data-speed="3"]').click();await expect(page.locator('#world')).toHaveAttribute('data-island','wild-0',{timeout:35000});await expect(page.locator('.ufo-flight-board')).toBeHidden({timeout:20000});await page.locator('[data-speed="0"]').click();await page.screenshot({path:'artifacts/procedural-island.png'});await page.locator('#save').click();const saved=await savedState(page);expect(saved.civilization.islands).toEqual(state.civilization.islands);expect(saved.player.island).toBe('wild-0');await page.reload();await expect(page.locator('#loading')).toBeHidden({timeout:45000});await expect(page.locator('#world')).toHaveAttribute('data-island','wild-0');expect(errors).toEqual([]);
});

test('star island navigation shows discovery without granting landing or legacy location shortcuts',async({page})=>{
 const state=createGame();state.speed=0;state.civilization.observations=3;state.civilization.discoveryPath=['home','spore'];state.wonders.archive=3;state.civilization.discoveryPath=['home','spore','city'];fixtures.set(page,state);
 await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 await expect(page.locator('#island-select option')).toHaveCount(3);await expect(page.locator('.locations button')).toHaveCount(2);await expect(page.locator('.locations')).not.toContainText('孢子花园');await expect(page.locator('.locations')).not.toContainText('科研星港');
 await page.locator('#island-select').selectOption('city');await expect(page.locator('#world')).toHaveAttribute('data-island','home');
 await expect(page.locator('.exploration-panel')).toContainText('太空科技');await expect(page.locator('.exploration-panel')).not.toContainText('晶簇共振');await expect(page.locator('.exploration-panel')).not.toContainText('星灵觉醒');await expect(page.locator('[data-voyage="city"]')).toBeDisabled();
});

test('qualified resident lands on a distinct island, views home without teleporting, reloads and returns',async({page})=>{
 const state=createGame();state.speed=0;state.autonomy.enabled=false;for(const n of Object.values(state.npcs))n.ai.enabled=false;
 state.civilization.observations=3;state.civilization.discoveryPath=['home','spore'];state.civilization.technology=120;state.space.ships.push({id:'fixture-ufo',tier:2,island:'home',side:'front',food:2,durability:100,reservedBy:null});state.skills.botany=6;state.skills.science=12;state.player.preferences.observe=10;fixtures.set(page,state);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});await page.getByRole('button',{name:'探索',exact:true}).click();
 await page.locator('[data-voyage="spore"]').click();await page.locator('#confirm-flight').click();await page.locator('[data-speed="3"]').click();await expect(page.locator('#world')).toHaveAttribute('data-island','spore',{timeout:35000});await expect(page.locator('.ufo-flight-board')).toBeHidden({timeout:20000});await page.locator('[data-speed="0"]').click();await expect(page.locator('#flip-island')).toBeDisabled();
 await page.screenshot({path:'artifacts/star-island-spore.png'});await page.locator('#island-select').selectOption('home');await page.locator('#save').click();let saved=await savedState(page);expect(saved.player.island).toBe('spore');expect(saved.viewIsland).toBe('home');
 await page.reload();await expect(page.locator('#loading')).toBeHidden({timeout:45000});await page.locator('#island-select').selectOption('spore');await expect(page.locator('#world')).toHaveAttribute('data-island','spore');await page.getByRole('button',{name:'探索',exact:true}).click();await page.locator('[data-voyage="home"]').click();await page.locator('#confirm-flight').click();await page.locator('[data-speed="3"]').click();await expect(page.locator('#world')).toHaveAttribute('data-island','home',{timeout:30000});await expect(page.locator('.ufo-flight-board')).toBeHidden({timeout:20000});await page.locator('[data-speed="0"]').click();await page.locator('#save').click();saved=await savedState(page);expect(saved.player.island).toBe('home');expect(saved.civilization.visits.spore).toBe(1);expect(errors).toEqual([]);
});

test('exploration tab shows shared permanent records, preserves scrolling and fits mobile',async({page})=>{
 const {buyItem}=await import('../src/simulation.js');const state=createGame();state.speed=0;state.wonders={dust:7,archive:3,lastExpeditionDay:1,expeditions:4,cityRecords:[0,2],coauthored:true};const relic=buyItem(state,'relic',0,4).object;relic.wonder.chapter=3;relic.wonder.coauthored=true;buyItem(state,'crystal',3,4);fixtures.set(page,state);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});await page.getByRole('button',{name:'探索',exact:true}).click();
 const panel=page.locator('.exploration-panel');await expect(panel).toContainText('4 次');await expect(panel).toContainText('7 份');await expect(panel).toContainText('2 / 3');await expect(panel).toContainText('已发现双人生态线索');await panel.evaluate(e=>e.scrollTop=100);await expect.poll(()=>panel.evaluate(e=>e.scrollTop)).toBeGreaterThan(0);await page.screenshot({path:'artifacts/exploration-desktop.png'});
 await page.locator('#save').click();await savedState(page);await page.reload();await expect(page.locator('#loading')).toBeHidden({timeout:45000});await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'探索',exact:true}).click();await expect(panel).toContainText('4 次');expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await page.screenshot({path:'artifacts/exploration-mobile.png'});expect(errors).toEqual([]);
});

test('crystal can switch from an armed mode without dust and restart charging',async({page})=>{
 const {buyItem}=await import('../src/simulation.js'),{OrthographicCamera,Vector3}=await import('three');const state=createGame();state.objects=[];state.speed=0;state.autonomy.enabled=false;for(const n of Object.values(state.npcs))n.ai.enabled=false;const c=buyItem(state,'crystal',0,4).object;c.wonder.charge=100;c.wonder.armed=true;state.wonders.dust=0;fixtures.set(page,state);
 await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});const b=await page.locator('#world canvas').boundingBox(),camera=sceneCamera(b);const p=new Vector3(0,.85,4).project(camera);await page.mouse.click(b.x+(p.x+1)*b.width/2,b.y+(1-p.y)*b.height/2);
 await expect(page.locator('[data-action="tuneInsight"]')).toBeEnabled();await page.locator('[data-action="tuneInsight"]').click();await page.locator('[data-speed="3"]').click();await expect(page.locator('#queue .queue-action')).toHaveCount(0,{timeout:30000});await page.locator('[data-speed="0"]').click();await page.locator('#save').click();const saved=await savedState(page);expect(saved.objects[0].wonder.mode).toBe('insight');expect(saved.objects[0].wonder.charge).toBeLessThan(10);expect(saved.objects[0].wonder.armed).toBe(false);expect(saved.wonders.dust).toBe(0);
});

for(const [type,name,action] of [['polelight','星弧高杆灯','lightGrow'],['glowlight','幽辉地灯','releaseBugs'],['relic','虚空遗迹','decodeTogether'],['crystal','极光晶簇','activateCrystal'],['lamp','漂浮光球','passOrb']])test(`wonder ${type} menu, activity and save round-trip`,async({page})=>{
 const {buyItem}=await import('../src/simulation.js'),{OrthographicCamera,Vector3}=await import('three');const state=createGame();state.objects=[];state.autonomy.enabled=false;state.speed=0;state.player.x=2;state.player.z=4;
 for(const [i,n] of Object.values(state.npcs).entries()){n.ai.enabled=false;n.x=-3-i*2;n.z=4;}
 const o=buyItem(state,type,0,4).object;
 if(['relic','lamp'].includes(type)){const pod=buyItem(state,'pod',-5,-2).object;state.config.actionDurations.sleep=35;state.npcs.nova.queue.push({id:state.nextId++,type:'sleep',targetId:pod.id,target:{x:-5,z:-1,side:'front'},source:'ai',phase:'acting',elapsed:0,path:[]});}
 state.wonders.dust=3;if(type==='glowlight')o.wonder.bugs=3;if(type==='relic')o.wonder.chapter=1;if(type==='crystal')o.wonder.charge=100;fixtures.set(page,state);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
 await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 const open=async()=>{const bounds=await page.locator('#world canvas').boundingBox(),camera=sceneCamera(bounds);const p=new Vector3(0,type==='polelight'?3.68:.85,4).project(camera);await page.mouse.click(bounds.x+(p.x+1)*bounds.width/2,bounds.y+(1-p.y)*bounds.height/2);await expect(page.locator('#context-menu')).toContainText(name);};
 await open();await expect(page.locator('[data-action="admire"]')).toHaveCount(0);await expect(page.locator('#wonder-status')).toBeVisible();
 if(['decodeTogether','passOrb'].includes(action)){await expect(page.locator(`[data-action="${action}"]`)).toBeDisabled();await page.locator('#wonder-partner').selectOption('nova');}
 await expect(page.locator(`[data-action="${action}"]`)).toBeEnabled();await page.screenshot({path:`artifacts/wonder-${type}-menu.png`});await page.locator(`[data-action="${action}"]`).click();await expect(page.locator('#queue')).not.toBeEmpty();
 if(['decodeTogether','passOrb'].includes(action)){await page.locator('#save').click();const queued=await savedState(page);expect(queued.npcs.nova.queue.map(q=>q.type)).toEqual(['sleep',action]);await page.locator('[data-speed="3"]').click();await expect(page.locator('#queue')).toContainText('等候共同活动');await page.locator('[data-speed="0"]').click();await page.locator('#save').click();const waiting=await savedState(page);expect(waiting.queue[0].elapsed).toBe(0);await page.reload();await expect(page.locator('#loading')).toBeHidden({timeout:45000});}

 await page.locator('[data-speed="3"]').click();await expect(page.locator('#queue .queue-action')).toHaveCount(0,{timeout:30000});await page.locator('[data-speed="0"]').click();await page.locator('#save').click();const saved=await savedState(page);const result=saved.objects[0].wonder;
 if(type==='polelight')expect(result.mode).toBe('grow');if(type==='glowlight')expect(result.showUntil).toBeGreaterThan(0);if(type==='relic'){expect(result.chapter).toBe(2);expect(result.coauthored).toBe(true);}if(type==='crystal')expect(result.armed).toBe(true);if(type==='lamp')expect(saved.relationships.nova).toBe(33);
 await page.screenshot({path:`artifacts/wonder-${type}-result.png`});await page.reload();await expect(page.locator('#loading')).toBeHidden({timeout:45000});await page.setViewportSize({width:390,height:844});await open();await expect(page.locator('#wonder-status')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);const bounds=await page.locator('#context-menu').boundingBox();expect(bounds.y+bounds.height).toBeLessThanOrEqual(844);await page.screenshot({path:`artifacts/wonder-${type}-mobile.png`});expect(errors).toEqual([]);
});

test('star freckles produce visible glow in resident portraits',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/portrait-preview',route=>route.fulfill({contentType:'text/html',body:'<html><body><div id="world" style="width:320px;height:240px"></div><div id="portraits"></div></body></html>'}));
 await page.goto('http://127.0.0.1:5173/portrait-preview');
 const result=await page.evaluate(async()=>{
  const {createWorld}=await import('/src/world.js'),{createGame}=await import('/src/simulation.js');
  const game=createGame(),world=await createWorld(document.querySelector('#world'),()=>game,{});
  const canvas=document.createElement('canvas');canvas.width=canvas.height=160;const context=canvas.getContext('2d',{willReadFrequently:true});
  async function portrait(mutations,label){
   game.player.prayer.mutations=mutations;const image=new Image();image.src=world.portrait('player');await image.decode();
   context.drawImage(image,0,0);const pixels=context.getImageData(0,0,160,160).data;
   const figure=document.createElement('figure');figure.style.display='inline-block';figure.append(image,document.createTextNode(label));document.querySelector('#portraits').append(figure);return pixels;
  }
  const normal=await portrait([],'普通'),mutated=await portrait(['freckles'],'星辉斑');let haloPixels=0;
  for(let y=45;y<160;y++)for(let x=0;x<160;x++){
   const i=(y*160+x)*4;
   if([0,1,2].every(c=>normal[i+c]===normal[c])&&Math.max(...[0,1,2].map(c=>mutated[i+c]-normal[i+c]))>=3)haloPixels++;
  }
  return {haloPixels};
 });
 await page.locator('#portraits').screenshot({path:'test-results/portrait-freckles.png'});console.log('Portrait mutation glow',result);
 expect(errors).toEqual([]);expect(result.haloPixels).toBeGreaterThan(30);
});

test('repeated resident appearance changes reuse graphics contexts and keep the world rendering',async({page})=>{
 const state=createGame();state.speed=0;fixtures.set(page,state);
 await page.addInitScript(()=>{
  const original=HTMLCanvasElement.prototype.getContext,seen=new WeakSet();window.graphics={created:0,mainLost:0};
  HTMLCanvasElement.prototype.getContext=function(type,...args){
   const context=original.call(this,type,...args);
   if(context&&['webgl','webgl2','experimental-webgl'].includes(type)&&!seen.has(this)){
    seen.add(this);window.graphics.created++;
    this.addEventListener('webglcontextlost',()=>{if(this.closest('#world'))window.graphics.mainLost++;});
   }
   return context;
  };
 });
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/Too many active WebGL|context lost/i.test(m.text()))errors.push(m.text());});
 await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:30000});
 const contexts=await page.evaluate(()=>window.graphics.created),portrait=await page.locator('#player-portrait').getAttribute('src');
 await page.getByRole('button',{name:'人物',exact:true}).click();
 for(let i=0;i<8;i++){
  const previous=await page.locator('#player-portrait').getAttribute('src');
  await page.locator('#randomize-heads').click();await expect(page.locator('#player-portrait')).not.toHaveAttribute('src',previous);
 }
 for(const [age,gender]of [[8,'female'],[28,'male'],[68,'female'],[28,'male']]){
  const previous=await page.locator('#player-portrait').getAttribute('src');
  await page.locator('#resident-age').fill(String(age));await page.locator('#resident-gender').selectOption(gender);
  await page.getByRole('button',{name:'应用人物设定',exact:true}).click();await expect(page.locator('#player-portrait')).not.toHaveAttribute('src',previous);
 }
 await page.screenshot({path:'test-results/resident-graphics-after-changes.png'});
 const graphics=await page.evaluate(()=>window.graphics);console.log('Appearance graphics contexts',graphics);
 expect(graphics.mainLost).toBe(0);expect(graphics.created).toBe(contexts);expect(errors).toEqual([]);
 await expect(page.locator('#player-portrait')).not.toHaveAttribute('src',portrait);
 const before=await page.locator('#world canvas').evaluate(c=>c.toDataURL());await page.locator('#zoom-in').click();
 await expect.poll(()=>page.locator('#world canvas').evaluate(c=>c.toDataURL())).not.toBe(before);
});

test('elder prayer changes the portrait and age to childhood, celebrates and persists',async({page})=>{
 const state=prayerFixture('front');state.player.age=68;state.config.prayer.skillChance=0;state.config.prayer.rejuvenationChance=100;
 state.queue[0].elapsed=state.config.actionDurations.pray-.3;fixtures.set(page,state);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/Too many active WebGL|context lost/i.test(m.text()))errors.push(m.text());});
 await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:30000});
 await page.getByRole('button',{name:'人物',exact:true}).click();await expect(page.locator('#resident-age')).toHaveValue('68');
 const elderPortrait=await page.locator('#player-portrait').getAttribute('src');
 await page.getByRole('button',{name:'正常速度',exact:true}).click();await expect(page.locator('#journal')).toContainText('返老还童');
 await page.getByRole('button',{name:'暂停',exact:true}).click();await expect(page.locator('#resident-age')).toHaveValue('3');
 await expect(page.locator('#resident-summary')).toContainText('儿童');await expect(page.locator('#activity')).toContainText('晴昼赐福');
 await expect(page.locator('#player-portrait')).not.toHaveAttribute('src',elderPortrait);
 await page.locator('#focus-player').click();for(let i=0;i<7;i++)await page.locator('#zoom-in').click();
 await page.screenshot({path:'test-results/prayer-rejuvenation.png'});
 await page.getByRole('button',{name:'保存游戏',exact:true}).click();const saved=await savedState(page);
 expect(saved.player.age).toBeGreaterThanOrEqual(3);expect(saved.player.age).toBeLessThan(3.01);expect(saved.queue[0].blessing.rejuvenated).toBe(true);
 expect(saved.skills).toEqual(state.skills);expect(saved.player.genome).toEqual(state.player.genome);
 await page.reload();await expect(page.locator('#loading')).toBeHidden({timeout:30000});await page.getByRole('button',{name:'人物',exact:true}).click();
 await expect(page.locator('#resident-age')).toHaveValue('3');await expect(page.locator('#activity')).toContainText('晴昼赐福');expect(errors).toEqual([]);
});

for(const side of ['front','back'])test(`prayer ${side} blessing and resident traits survive reload without duplicate rewards`,async({page})=>{
 const state=prayerFixture(side,{success:true});fixtures.set(page,state);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
 await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:30000});
 await expect(page.locator('#activity')).toContainText(side==='front'?'晴昼赐福':'幽冥赐福');
 await page.getByRole('button',{name:'人物',exact:true}).click();
 await expect(page.locator('.prayer-status')).toContainText(side==='front'?'幽冥属性 0 / 10':'幽冥族');
 if(side==='back')for(const name of ['晶冠角','脊晶','星辉斑','异色瞳'])await expect(page.locator('.prayer-status')).toContainText(name);
 await page.locator('#focus-player').click();for(let i=0;i<7;i++)await page.locator('#zoom-in').click();
 await page.screenshot({path:`test-results/prayer-${side}-game.png`});
 await page.getByRole('button',{name:'保存游戏',exact:true}).click();const before=await savedState(page);
 await page.reload();await expect(page.locator('#loading')).toBeHidden({timeout:30000});
 await expect(page.locator('#activity')).toContainText(side==='front'?'晴昼赐福':'幽冥赐福');
 await page.getByRole('button',{name:'正常速度',exact:true}).click();await expect(page.locator('#queue [data-cancel]')).toHaveCount(0,{timeout:10000});
 await page.getByRole('button',{name:'暂停',exact:true}).click();await page.getByRole('button',{name:'保存游戏',exact:true}).click();
 const after=await savedState(page);expect(after.skills).toEqual(before.skills);expect(after.player.prayer).toEqual(before.player.prayer);
 await page.getByRole('button',{name:'人物',exact:true}).click();await page.setViewportSize({width:390,height:844});
 await expect(page.locator('.prayer-status')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await page.screenshot({path:`test-results/prayer-${side}-mobile.png`});expect(errors).toEqual([]);
});

test('spirit tree interaction menu schedules prayer instead of admire',async({page})=>{
 const {OrthographicCamera,Vector3}=await import('three');const state=prayerFixture('front');state.queue=[];fixtures.set(page,state);
 await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:30000});
 const bounds=await page.locator('#world canvas').boundingBox(),camera=sceneCamera(bounds);const p=new Vector3(0,1.3,4).project(camera);
 await page.mouse.click(bounds.x+(p.x+1)*bounds.width/2,bounds.y+(1-p.y)*bounds.height/2);
 await expect(page.locator('#context-menu')).toContainText('星灵垂光树');await expect(page.locator('[data-action="admire"]')).toHaveCount(0);
 await expect(page.locator('#context-menu')).toContainText('10%');await page.locator('[data-action="pray"]').click();
 await expect(page.locator('#queue')).toContainText('向星灵树祈祷');
});

test('spirit tree purchase previews, renders on both faces, and survives reload',async({page})=>{
 const {OrthographicCamera,Vector3}=await import('three');
 const g=createGame();g.speed=0;for(const n of Object.values(g.npcs))n.ai.enabled=false;fixtures.set(page,g);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
 await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:30000});
 const bounds=await page.locator('#world canvas').first().boundingBox();
 const camera=sceneCamera(bounds);
 const p=new Vector3(0,.29,5).project(camera),x=bounds.x+(p.x+1)*bounds.width/2,y=bounds.y+(1-p.y)*bounds.height/2;
 await page.getByRole('button',{name:'物品包',exact:true}).click();await page.locator('[data-pack="孢子花园"]').click();
 for(const side of ['front','back']){
  if(side==='back'){await page.getByRole('button',{name:'翻转星岛',exact:true}).click();await expect(page.locator('#world')).toHaveAttribute('data-side','back');await expect(page.locator('#world')).toHaveAttribute('data-flipping','false');}
  await page.getByRole('button',{name:'购买 星灵垂光树'}).click();await page.mouse.move(x,y);
  await page.screenshot({path:`test-results/spirit-tree-${side}-preview.png`});
  await page.mouse.click(x,y);await expect(page.locator('#toast')).toContainText('星灵垂光树已放入家园');
  await page.getByRole('button',{name:'保存游戏',exact:true}).click();
  const saved=await savedState(page);expect(saved.objects.filter(o=>o.type==='spiritTree')).toHaveLength(side==='front'?1:2);
  expect(saved.objects.at(-1).side).toBe(side);
  await page.screenshot({path:`test-results/spirit-tree-${side}.png`});
 }
 await page.reload();await expect(page.locator('#loading')).toBeHidden({timeout:30000});
 await expect(page.locator('#world')).toHaveAttribute('data-side','back');
 await page.getByRole('button',{name:'保存游戏',exact:true}).click();
 expect((await savedState(page)).objects.filter(o=>o.type==='spiritTree')).toHaveLength(2);expect(errors).toEqual([]);
});

test('dark reverse face supports building, free gate travel, cooking and reload',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
 const g=createGame();g.speed=0;g.money=10000;g.skills.cooking=3;
 for(const n of Object.values(g.npcs))n.ai.enabled=false;
 g.objects.push({id:'back-kitchen',type:'stove',side:'back',x:3,z:0,rotation:0},{id:'back-tea',type:'tea',side:'back',x:5,z:0,rotation:0},{id:'back-relic',type:'relic',wonder:createWonder('relic'),side:'back',x:6,z:-3,rotation:0},{id:'back-beacon',type:'beacon',side:'back',x:-4,z:-4,rotation:0});
 fixtures.set(page,g);
 await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 await page.screenshot({path:'test-results/island-front.png'});
 await page.getByRole('button',{name:'翻转星岛',exact:true}).click();
 await expect(page.locator('#world')).toHaveAttribute('data-side','back');await expect(page.locator('#world')).toHaveAttribute('data-flipping','false');
 await expect(page.locator('#island-side')).toHaveText('幽星面 · 居民在晴昼面');
 await page.getByRole('button',{name:'建造模式',exact:true}).click();
 await page.getByRole('button',{name:'星云膳坊',exact:true}).click();await expect(page.locator('.item-card')).toHaveCount(3);
 await page.getByRole('button',{name:'幽星秘境',exact:true}).click();await page.getByRole('button',{name:'购买 双面折跃门'}).click();
 const canvas=await page.locator('#world canvas').boundingBox();await page.mouse.click(canvas.x+canvas.width*.48,canvas.y+canvas.height*.56);
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'建造模式',exact:true}).click();
 await page.getByRole('button',{name:'保存游戏',exact:true}).click();
 const built=await savedState(page),newGate=built.objects.find(o=>o.type==='gate'&&!o.fixed);expect(newGate).toBeTruthy();expect(newGate.side).toBe('back');
 await page.getByRole('button',{name:'职业',exact:true}).click();await page.getByRole('button',{name:'加入星云膳造'}).click();
 await expect(page.locator('#panel-content')).toContainText('孢火学徒 → 星釜调味师 → 星宴织味宗师');
 await page.getByRole('button',{name:'选择星门目的地'}).click();await expect(page.locator('[data-destination]')).toHaveCount(2);
 await page.locator(`[data-destination="${newGate.id}"]`).click();await page.getByRole('button',{name:'三倍速度',exact:true}).click();
 await expect(page.locator('#island-side')).toHaveText('幽星面 · 居民在幽星面',{timeout:25000});
 await page.getByRole('button',{name:'开始工作'}).click();await expect(page.locator('#queue')).toContainText('开始一个工作班次');
 await expect(page.locator('#queue [data-cancel]')).toHaveCount(0,{timeout:25000});
 await page.getByRole('button',{name:'暂停',exact:true}).click();
 await page.getByRole('button',{name:'保存游戏',exact:true}).click();const saved=await savedState(page);expect(saved.player.side).toBe('back');expect(saved.career.shifts).toBe(1);
 await page.screenshot({path:'test-results/island-back.png'});
 await page.reload();await expect(page.locator('#loading')).toBeHidden({timeout:45000});await expect(page.locator('#island-side')).toHaveText('幽星面 · 居民在幽星面');
 expect(errors).toEqual([]);
});

test('camera controls stay separate on narrow screens and remote work automatically uses gates',async({page})=>{
 const g=createGame();g.speed=0;g.skills.cooking=3;g.career={id:'chef',level:1,shifts:0};
 for(const n of Object.values(g.npcs))n.ai.enabled=false;
 g.config.actionDurations.work=1;g.config.actionDurations.travel=.5;
 g.objects.push({id:'remote-stove',type:'stove',side:'back',x:3,z:0,rotation:0});fixtures.set(page,g);
 await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:900});
  const flip=await page.locator('#flip-island').boundingBox(),tools=await page.locator('.view-tools').boundingBox();
  expect(flip.y+flip.height).toBeLessThan(tools.y);expect(tools.x+tools.width).toBeLessThanOrEqual(width);
  await page.getByRole('button',{name:'翻转星岛',exact:true}).click();
  await expect(page.locator('#world')).toHaveAttribute('data-flipping','false');
  await page.screenshot({path:`test-results/island-controls-${width}.png`});
 }
 await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'职业',exact:true}).click();
 await page.getByRole('button',{name:'开始工作'}).click();await page.getByRole('button',{name:'三倍速度',exact:true}).click();
 await expect(page.locator('#island-side')).toHaveText('幽星面 · 居民在幽星面',{timeout:15000});
 await expect(page.locator('#queue [data-cancel]')).toHaveCount(0,{timeout:15000});
 await page.getByRole('button',{name:'暂停',exact:true}).click();await page.getByRole('button',{name:'保存游戏',exact:true}).click();
 const saved=await savedState(page);expect(saved.career.shifts).toBe(1);expect(saved.player.side).toBe('back');
});

test('3D game supports social queue, pause, building, careers and persisted save',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const state=createGame();state.speed=0;state.skills.botany=CAREERS.botanist.levels[0].skills.botany;
 await page.addInitScript(g=>{if(!localStorage.getItem('orbit-life-v1'))localStorage.setItem('orbit-life-v1',JSON.stringify(g));},state);
 await page.goto('http://127.0.0.1:5173');
 await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 await expect(page.locator('#world canvas')).toBeVisible();
 await page.getByRole('button',{name:'暂停',exact:true}).click();
 const time=await page.locator('#clock').innerText();await page.waitForTimeout(1000);expect(await page.locator('#clock').innerText()).toBe(time);
 await page.getByRole('button',{name:'关系',exact:true}).click();
 await page.locator('#panel-content').getByRole('button',{name:'与诺瓦互动'}).click();
 await page.locator('[data-action="chat"]').click();
 await expect(page.locator('#queue')).toContainText('聊聊母星');
 await page.locator('#queue [data-cancel]').click();
 await expect(page.locator('#queue')).not.toContainText('聊聊母星');
 await page.getByRole('button',{name:'职业',exact:true}).click();
 await expect(page.locator('#panel-content')).toContainText('入职要求');
 await expect.poll(()=>page.locator('#panel-content').evaluate(el=>({overflow:getComputedStyle(el).overflowY,scrollable:el.scrollHeight>el.clientHeight}))).toEqual({overflow:'auto',scrollable:true});
 await page.getByRole('button',{name:'加入异星植物'}).click();
 await expect(page.locator('#panel-content')).toContainText('孢子培育员');
 await page.getByRole('button',{name:'开始工作'}).click();
 await expect(page.locator('#queue')).toContainText('开始一个工作班次');
 await page.locator('#queue [data-cancel]').click();
 await page.getByRole('button',{name:'建造模式',exact:true}).click();
 await page.locator('#panel-content').getByRole('button',{name:'孢子花园',exact:true}).click();
 await page.getByRole('button',{name:'购买 极光晶簇'}).click();
 await expect(page.locator('#build-hint')).toBeVisible();
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'保存游戏',exact:true}).click();
 await expect(page.locator('#toast')).toContainText('已保存');
 await page.reload();await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 await page.getByRole('button',{name:'职业',exact:true}).click();
 await expect(page.locator('#panel-content')).toContainText('孢子培育员');
 expect(errors).toEqual([]);
 await page.screenshot({path:'test-results/gameplay.png',fullPage:true});
});
test('home layout removes the wish, moves radio left and resizes the right profile card',async({page})=>{
 const state=createGame();state.speed=0;state.majorEvents=[{type:'birth',text:'布局测试事件',day:3,at:100}];fixtures.set(page,state);
 await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:30000});
 await expect(page.locator('.aspiration')).toHaveCount(0);await expect(page.getByText('今日小心愿')).toHaveCount(0);
 const viewport=page.viewportSize(),dashboard=await page.locator('.dashboard').boundingBox(),world=await page.locator('#world').boundingBox(),details=await page.locator('.details').boundingBox(),profile=await page.locator('.profile').boundingBox(),neighbors=await page.locator('.neighbors').boundingBox(),journal=await page.locator('#journal').boundingBox(),corners=await page.locator('.dashboard').evaluate(el=>{const style=getComputedStyle(el);return{topLeft:style.borderTopLeftRadius,topRight:style.borderTopRightRadius};});
 expect(dashboard.x).toBeGreaterThan(viewport.width/2);expect(dashboard.y).toBeGreaterThan(80);expect(dashboard.y+dashboard.height).toBeCloseTo(viewport.height-16,0);expect(journal.x+journal.width).toBeLessThan(viewport.width/2);expect(profile.y).toBeLessThan(details.y);expect(details.y+details.height).toBeLessThanOrEqual(neighbors.y);expect(dashboard.x+dashboard.width).toBeCloseTo(viewport.width,0);expect(world.x).toBe(0);expect(world.x+world.width).toBeCloseTo(viewport.width,0);expect(corners.topLeft).not.toBe('0px');expect(corners.topRight).toBe('0px');
 const handle=page.locator('#dashboard-resize-handle');await expect(handle).toBeVisible();const handleBox=await handle.boundingBox();
 await page.mouse.move(handleBox.x+handleBox.width/2,handleBox.y+handleBox.height/2);await page.mouse.down();await page.mouse.move(handleBox.x-80,handleBox.y+handleBox.height/2);await page.mouse.up();
 const resized=await page.locator('.dashboard').boundingBox();expect(resized.width).toBeGreaterThan(dashboard.width+40);expect(resized.x).toBeLessThan(dashboard.x-40);expect(resized.x+resized.width).toBeCloseTo(dashboard.x+dashboard.width,0);
});
test('right profile card keeps panel content tall and stacks scrollable choices',async({page})=>{
 const state=createGame();state.speed=0;fixtures.set(page,state);await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:30000});
 await page.getByRole('button',{name:'人物',exact:true}).click();const residentPanel=page.locator('.resident-panel');const residentBox=await residentPanel.boundingBox();expect(residentBox.height).toBeGreaterThan(300);
 await page.getByRole('button',{name:'物品包',exact:true}).click();const itemGrid=page.locator('.item-grid');const itemStyle=await itemGrid.evaluate(el=>{const style=getComputedStyle(el);return{display:style.display,overflowX:style.overflowX,overflowY:style.overflowY,scrollableY:el.scrollHeight>el.clientHeight,scrollableX:el.scrollWidth>el.clientWidth};});expect(itemStyle).toEqual({display:'grid',overflowX:'hidden',overflowY:'auto',scrollableY:true,scrollableX:false});
 await page.getByRole('button',{name:'职业',exact:true}).click();await expect(page.locator('.career-options')).toHaveCSS('flex-direction','column');await expect(page.locator('.career-options button')).toHaveCount(Object.keys(CAREERS).length);
});
test('radio displays only the three latest major events',async({page})=>{
 const state=createGame();state.speed=0;state.majorEvents=[
  {type:'birth',text:'第三条重大事件',day:3,at:100},
  {type:'death',text:'第二条重大事件',day:2,at:100},
  {type:'mature',text:'第一条重大事件',day:1,at:100}
 ];
 await page.addInitScript(g=>{if(!localStorage.getItem('orbit-life-v1'))localStorage.setItem('orbit-life-v1',JSON.stringify(g));},state);
 await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:30000});
 await expect(page.locator('#journal')).toBeVisible();await expect(page.locator('.journal-entry')).toHaveCount(3);await expect(page.locator('.journal-entry').first()).toContainText('第三条重大事件');
});
test('configuration button opens the detailed parameter dialog',async({page})=>{
 const state=createGame();state.speed=0;
 let projectConfig;
 await page.route('**/api/project-config',async route=>{if(route.request().method()==='GET')return route.fulfill({json:{config:state.config}});projectConfig=route.request().postDataJSON().config;return route.fulfill({json:{config:projectConfig}});});
 await page.addInitScript(g=>{if(!localStorage.getItem('orbit-life-v1'))localStorage.setItem('orbit-life-v1',JSON.stringify(g));},state);
 await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:30000});
 await page.getByRole('button',{name:'参数配置',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'参数配置'});await expect(dialog).toBeVisible();
 await expect(dialog.locator('[data-config-path="time.starYearDays"]')).toHaveValue('8');await expect(dialog).toContainText('动作时长');await expect(dialog).toContainText('职业门槛');await expect(dialog).toContainText('需求衰减');await expect(dialog).toContainText('作物参数');await expect(dialog).toContainText('工作');
 await expect(dialog.locator('[data-config-path="lifeStages.infantEnd"]')).toHaveValue('3');
 await expect(dialog.locator('[data-config-path="mutationRates.color"]')).toHaveValue('2.4');
 await expect(dialog).toContainText('星灵树祈祷概率');
 for(const [key,value]of Object.entries({skillChance:10,netherChance:10,mutationChance:1,rejuvenationChance:.1,racialInheritanceRate:30,racialInheritanceStdDev:20,racialMutationInheritanceChance:5}))await expect(dialog.locator(`[data-config-path="prayer.${key}"]`)).toHaveValue(String(value));
 const prayer={skillChance:27.5,radianceChance:10,netherChance:0,mutationChance:100,rejuvenationChance:.2,racialInheritanceRate:42,racialInheritanceStdDev:13,racialMutationInheritanceChance:7};
 for(const [key,value]of Object.entries(prayer))await dialog.locator(`[data-config-path="prayer.${key}"]`).fill(String(value));
 await dialog.locator('[data-config-path="lifeStages.infantEnd"]').fill('4');
 await dialog.locator('[data-config-path="mutationRates.color"]').fill('3.1');
 await dialog.getByRole('button',{name:'应用并保存配置'}).click();
 await expect(dialog.locator('[data-config-path="lifeStages.infantEnd"]')).toHaveValue('4');
 await expect(dialog.locator('[data-config-path="mutationRates.color"]')).toHaveValue('3.1');
 await expect(page.locator('#toast')).toContainText('参数配置已保存');
 expect((await savedState(page)).config.prayer).toEqual(prayer);
 page.once('dialog',dialogEvent=>dialogEvent.accept());await dialog.getByRole('button',{name:'永久覆盖项目配置',exact:true}).click();await expect.poll(()=>projectConfig?.lifeStages.infantEnd).toBe(4);
 expect(projectConfig.prayer).toEqual(prayer);
 await dialog.locator('button[aria-label="关闭参数配置"]').click();await expect(dialog).toBeHidden();
 await page.reload();await expect(page.locator('#loading')).toBeHidden({timeout:30000});await page.getByRole('button',{name:'参数配置',exact:true}).click();
 for(const [key,value]of Object.entries(prayer))await expect(dialog.locator(`[data-config-path="prayer.${key}"]`)).toHaveValue(String(value));
 await dialog.locator('[data-config-path="prayer.skillChance"]').scrollIntoViewIfNeeded();await page.screenshot({path:'test-results/prayer-config.png'});
 await dialog.locator('#config-reset').click();
 for(const [key,value]of Object.entries({skillChance:10,netherChance:10,mutationChance:1,rejuvenationChance:.1,racialInheritanceRate:30,racialInheritanceStdDev:20,racialMutationInheritanceChance:5}))await expect(dialog.locator(`[data-config-path="prayer.${key}"]`)).toHaveValue(String(value));
});
test('skills and resident appearance have dedicated panels and retain edits after reload',async({page})=>{
 const state=createGame();state.speed=0;state.skills.science=4;
 await page.addInitScript(g=>{if(!localStorage.getItem('orbit-life-v1'))localStorage.setItem('orbit-life-v1',JSON.stringify(g));},state);
 await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:30000});
  await page.getByRole('button',{name:'技能',exact:true}).click();await expect(page.locator('[data-skill="science"]')).toContainText('Lv.2');await expect(page.locator('.skill-card')).toHaveCount(5);
  await page.getByRole('button',{name:'人物',exact:true}).click();await expect(page.locator('#resident-summary')).toContainText('余额 2,400 星币');await expect(page.locator('#character-switcher')).toBeHidden();await page.locator('#active-character').click();await expect(page.locator('#character-switcher')).toBeVisible();const options=page.locator('#character-switcher .character-option');await expect(options).toHaveCount(4);await expect(options.nth(0)).toHaveAttribute('data-character','zig');await expect(options.nth(0).locator('small')).toHaveText('68 星岁');await expect(options.nth(1)).toHaveAttribute('data-character','nova');await expect(options.nth(1).locator('small')).toHaveText('32 星岁');await page.locator('[data-character="nova"]').click();await expect(page.locator('#resident-summary')).toContainText('余额 600 星币');await expect(page.getByRole('switch',{name:'自主行为',exact:true})).toHaveAttribute('aria-checked','true');await page.locator('#active-character').click();await page.locator('[data-character="kai"]').click();await expect(page.locator('#resident-summary')).toContainText('余额 2,400 星币');const before=await page.locator('#resident-photo').getAttribute('src');
 await page.getByLabel('头部宽度',{exact:true}).fill('85');await page.getByLabel('头部长度',{exact:true}).fill('115');await page.getByLabel('下颌收窄',{exact:true}).fill('110');await page.getByRole('button',{name:'应用人物设定'}).click();
 expect(await page.locator('#resident-photo').getAttribute('src')).not.toBe(before);
 await page.getByLabel('性别',{exact:true}).selectOption('female');await page.getByLabel('年龄（星岁）',{exact:true}).fill('68');await page.getByRole('button',{name:'应用人物设定'}).click();
 await expect(page.locator('#resident-summary')).toContainText('长者');expect(await page.locator('#resident-photo').getAttribute('src')).not.toBe(before);
 await page.getByRole('button',{name:'保存游戏',exact:true}).click();await page.reload();await expect(page.locator('#loading')).toBeHidden({timeout:30000});
 await page.getByRole('button',{name:'人物',exact:true}).click();await expect(page.getByLabel('性别',{exact:true})).toHaveValue('female');await expect(page.getByLabel('年龄（星岁）',{exact:true})).toHaveValue('68');await expect(page.getByLabel('头部宽度',{exact:true})).toHaveValue('85');await expect(page.getByLabel('头部长度',{exact:true})).toHaveValue('115');
 await page.setViewportSize({width:390,height:844});await expect(page.getByRole('button',{name:'应用人物设定'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
test('insufficient funds remove eating from the food action menu',async({page})=>{
 const {OrthographicCamera,Vector3}=await import('three');const g={...createGame(),speed:0,money:9};
 await page.addInitScript(state=>{if(!localStorage.getItem('orbit-life-v1'))localStorage.setItem('orbit-life-v1',JSON.stringify(state));},g);await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:30000});
 const r=await page.locator('#world canvas').boundingBox(),camera=sceneCamera(r);const p=new Vector3(1,.9,-4).project(camera);await page.mouse.click(r.x+(p.x+1)*r.width/2,r.y+(1-p.y)*r.height/2);
 await expect(page.locator('#context-menu')).toContainText('营养合成器');await expect(page.locator('[data-action="eat"]')).toHaveCount(0);
});
test('sofa menu invites two neighbors into separate seats and saves the seated conversation',async({page})=>{
 const {OrthographicCamera,Vector3}=await import('three');const g=createGame();g.speed=0;for(const n of Object.values(g.npcs))n.ai.enabled=false;fixtures.set(page,g);
 await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:30000});
 const r=await page.locator('#world canvas').boundingBox(),camera=sceneCamera(r);const sofa=g.objects.find(o=>o.id==='sofa'),p=new Vector3(sofa.x,.8,sofa.z).project(camera);
 await page.mouse.click(r.x+(p.x+1)*r.width/2,r.y+(1-p.y)*r.height/2);await expect(page.locator('#context-menu')).toContainText('月弧沙发');await page.getByRole('button',{name:/邀请邻居坐下聊天/}).click();await page.getByRole('button',{name:'三倍速度',exact:true}).click();
 await page.waitForTimeout(3200);await page.getByRole('button',{name:'暂停',exact:true}).click();await page.getByRole('button',{name:'保存游戏',exact:true}).click();const state=await savedState(page),seats=[state.queue,...Object.values(state.npcs).map(n=>n.queue)].map(q=>q[0]).filter(q=>q?.type==='lounge');
 expect(seats).toHaveLength(3);expect(seats.every(q=>q.phase==='acting')).toBe(true);expect(new Set(seats.map(q=>q.seat)).size).toBe(3);expect(Object.values(state.relationships).filter(v=>v>15).length).toBe(2);
 await page.reload();await expect(page.locator('#loading')).toBeHidden({timeout:30000});await expect(page.locator('#queue')).toContainText('邀请邻居坐下聊天');
});
test('raycast interaction completes social action, earns wages, and places purchased furniture',async({page})=>{
 // Freeze the initial scene before rendering: autonomous NPCs now move immediately.
 await page.addInitScript(state=>{if(!localStorage.getItem('orbit-life-v1'))localStorage.setItem('orbit-life-v1',JSON.stringify(state));},{...createGame(),speed:0});
 await page.setViewportSize({width:1600,height:1000});await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:30000});
 await page.getByRole('button',{name:'暂停',exact:true}).click();
 // Click Nova's visible 3D body, not a substitute UI control.
 await page.mouse.click(805,407);await expect(page.locator('#context-menu')).toContainText('诺瓦');
 await page.locator('[data-action="chat"]').click();await page.getByRole('button',{name:'三倍速度',exact:true}).click();
 await expect(page.locator('#queue')).not.toContainText('聊聊母星',{timeout:20000});await expect(page.locator('#journal')).toBeHidden();
 await page.getByRole('button',{name:'职业',exact:true}).click();await page.getByRole('button',{name:'开始工作',exact:true}).click();
 await expect(page.locator('#queue')).not.toContainText('开始一个工作班次',{timeout:25000});await expect(page.locator('#journal')).toBeHidden();
 await page.getByRole('button',{name:'暂停',exact:true}).click();await page.getByRole('button',{name:'建造模式',exact:true}).click();
 await page.locator('[data-pack="孢子花园"]').click();await page.getByRole('button',{name:'购买 极光晶簇'}).click();
 await page.mouse.move(660,437);await page.mouse.click(660,437);await expect(page.locator('#toast')).toContainText('已放入家园');
 await page.getByRole('button',{name:'保存游戏',exact:true}).click();
 const saved=await savedState(page);
 expect(saved.relationships.nova).toBe(30);expect(saved.money).toBe(2460);expect(saved.objects).toHaveLength(11);expect(saved.objects.at(-1).type).toBe('crystal');
 await page.reload();await expect(page.locator('#loading')).toBeHidden({timeout:30000});await expect(page.locator('#money')).toHaveText('2,460');
});
test('narrow screens retain needs, career and item controls without horizontal overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:30000});
 await expect(page.locator('.needs-grid')).toBeVisible();await page.getByRole('button',{name:'职业',exact:true}).click();await expect(page.getByRole('button',{name:'开始工作'})).toBeVisible();
 await page.getByRole('button',{name:'物品包',exact:true}).click();await page.locator('[data-pack="孢子花园"]').click();await page.getByRole('button',{name:'购买 极光晶簇'}).click();await expect(page.locator('#build-hint')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
test('player autonomy can be toggled and manual commands override its queue while NPC decisions remain visible',async({page})=>{
 await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:30000});
 const autonomy=page.getByRole('switch',{name:'自主行为',exact:true});await expect(autonomy).toHaveAttribute('aria-checked','true');
 await expect(page.locator('.profile .current-activity').getByRole('switch',{name:'自主行为',exact:true})).toBeVisible();await expect(autonomy).toHaveText('自主');
 await autonomy.click();await expect(autonomy).toHaveAttribute('aria-checked','false');await autonomy.click();await expect(autonomy).toHaveAttribute('aria-checked','true');await expect(page.locator('#queue .ai-badge')).toHaveText('自主');
 await page.getByRole('button',{name:'暂停',exact:true}).click();
 await page.getByRole('button',{name:'关系',exact:true}).click();await expect(page.locator('.npc-activity').first()).not.toBeEmpty();
 await page.locator('#panel-content [data-npc="nova"]').click();await expect(page.locator('#npc-status')).not.toBeEmpty();await page.locator('[data-action="chat"]').click();
 await expect(page.locator('#queue')).toContainText('聊聊母星');await expect(page.locator('#queue .ai-badge')).toHaveCount(0);
 await autonomy.click();await expect(autonomy).toHaveAttribute('aria-checked','false');await expect(page.locator('#queue')).toContainText('聊聊母星');
 await autonomy.click();await page.getByRole('button',{name:'保存游戏',exact:true}).click();await page.reload();await expect(page.locator('#loading')).toBeHidden({timeout:30000});await expect(autonomy).toHaveAttribute('aria-checked','true');
 await page.setViewportSize({width:390,height:844});await expect(autonomy).toBeVisible();
 await page.screenshot({path:'test-results/ai-mobile.png'});
 await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'关系',exact:true}).click();await page.screenshot({path:'test-results/ai-desktop.png'});
});
test('life panel exposes fertility reasoning, birth countdown and successor selection',async({page})=>{
 const sim=await import('../src/simulation.js');const g=sim.createGame();g.speed=0;for(const k in g.needs)g.needs[k]=95;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(state=>{if(!localStorage.getItem('orbit-life-v1'))localStorage.setItem('orbit-life-v1',JSON.stringify(state));},g);
 await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 await page.getByRole('button',{name:'生命',exact:true}).click();await expect(page.locator('#panel-content')).toContainText('生育意愿');await expect(page.locator('#panel-content')).toContainText('需要一座空闲');
 await page.locator('#family-desire').selectOption('0');await expect(page.locator('#fertility-reason')).toContainText('没有生育意愿');
 g.speed=1;g.objects.push({id:'nursery',type:'nursery',x:-6,z:4,rotation:0});sim.enqueue(g,'incubate','nursery');for(let i=0;i<25;i++)sim.tick(g,1);g.speed=0;
 fixtures.set(page,structuredClone(g));await page.reload();await expect(page.locator('#loading')).toBeHidden();await page.getByRole('button',{name:'生命',exact:true}).click();await expect(page.locator('.birth-entry')).toContainText('凯伊');
 g.incubations[0].due=sim.gameMinutes(g);g.speed=1;sim.tick(g,1);g.speed=0;
 fixtures.set(page,structuredClone(g));await page.reload();await expect(page.locator('#loading')).toBeHidden();await page.getByRole('button',{name:'生命',exact:true}).click();await page.locator('#active-character').click();await expect(page.locator('#character-switcher .character-option')).toHaveCount(5);await page.screenshot({path:'test-results/lifecycle-birth.png'});
 g.player.age=120;g.speed=1;sim.tick(g,1);fixtures.set(page,structuredClone(g));await page.reload();await expect(page.locator('#loading')).toBeHidden();await expect(page.locator('#life-alert')).toContainText('离世');await expect(page.locator('.memorial-entry')).toContainText('凯伊');await page.getByRole('button',{name:'接管 诺瓦',exact:true}).click();await expect(page.locator('.profile h2')).toContainText('诺瓦');await expect(page.locator('#life-alert')).toBeHidden();
 await page.getByRole('button',{name:'保存游戏',exact:true}).click();await page.reload();await expect(page.locator('#loading')).toBeHidden();await expect(page.locator('.profile h2')).toContainText('诺瓦');await page.getByRole('button',{name:'生命',exact:true}).click();await page.setViewportSize({width:390,height:844});await expect(page.locator('#family-desire')).toBeVisible();await page.screenshot({path:'test-results/lifecycle-mobile.png'});expect(errors).toEqual([]);
});
test('3D nursery lets the player choose two parents and the newborn displays inherited family traits',async({page})=>{
 const {OrthographicCamera,Vector3}=await import('three');const sim=await import('../src/simulation.js');const g=sim.createGame();g.speed=0;g.relationships.nova=75;g.objects.push({id:'nursery',type:'nursery',x:-6,z:4,rotation:0});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(state=>{if(!localStorage.getItem('orbit-life-v1'))localStorage.setItem('orbit-life-v1',JSON.stringify(state));},g);
 await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 const r=await page.locator('#world canvas').boundingBox(),camera=sceneCamera(r);const p=new Vector3(-6,.9,4).project(camera);await page.mouse.click(r.x+(p.x+1)*r.width/2,r.y+(1-p.y)*r.height/2);
 await expect(page.locator('#context-menu')).toContainText('星芽育生舱');await page.locator('#birth-partner').selectOption('nova');await page.locator('[data-action="incubate"]').click();await page.getByRole('button',{name:'三倍速度',exact:true}).click();await expect(page.locator('#journal-text')).toContainText('决定孕育',{timeout:20000});await page.getByRole('button',{name:'暂停',exact:true}).click();await page.getByRole('button',{name:'保存游戏',exact:true}).click();
 const saved=await savedState(page);expect(saved.incubations[0].parents.map(p=>p.name)).toEqual(['凯伊','诺瓦']);saved.incubations[0].due=sim.gameMinutes(saved);saved.speed=1;sim.tick(saved,1);saved.speed=0;const baby=Object.values(saved.npcs).find(n=>n.age<1);
 fixtures.set(page,structuredClone(saved));await page.reload();await expect(page.locator('#loading')).toBeHidden();await page.getByRole('button',{name:'生命',exact:true}).click();await page.locator('#active-character').click();await page.locator(`[data-character="${baby.uid}"]`).click();await expect(page.locator('.family-line').first()).toContainText('凯伊、诺瓦');await expect(page.locator('.family-line').last()).toContainText('身高');
 await page.getByRole('button',{name:'跟随凯伊',exact:true}).click();for(let i=0;i<8;i++)await page.getByRole('button',{name:'拉近视角',exact:true}).click();await page.screenshot({path:'test-results/newborn-closeup.png'});expect(errors).toEqual([]);
});
test('plant menu automatically sells produce and saves regrowth',async({page})=>{
 const {OrthographicCamera,Vector3}=await import('three');const g=createGame();g.speed=0;g.autonomy.enabled=false;for(const n of Object.values(g.npcs))n.ai.enabled=false;g.objects.find(o=>o.type==='garden').plant.growth=1;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(state=>{if(!localStorage.getItem('orbit-life-v1'))localStorage.setItem('orbit-life-v1',JSON.stringify(state));},g);
 await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 const r=await page.locator('#world canvas').boundingBox(),camera=sceneCamera(r);const p=new Vector3(7,.9,3).project(camera);await page.mouse.click(r.x+(p.x+1)*r.width/2,r.y+(1-p.y)*r.height/2);
 await expect(page.locator('#plant-status')).toContainText('成熟可收获');await expect(page.locator('#plant-status')).toContainText('水分');await expect(page.locator('[data-action="replant"]')).toBeDisabled();await page.screenshot({path:'test-results/plant-mature.png'});
 await page.locator('[data-action="harvest"]').click();await page.getByRole('button',{name:'三倍速度',exact:true}).click();await expect(page.locator('#queue')).not.toContainText('收获成熟植物',{timeout:20000});await expect(page.locator('#journal')).toBeHidden();await page.getByRole('button',{name:'暂停',exact:true}).click();
 await expect(page.locator('#money')).toHaveText('2,454');await expect(page.locator('#harvest-dialog')).toHaveCount(0);
 await page.getByRole('button',{name:'保存游戏',exact:true}).click();const saved=await savedState(page);expect(saved.objects.find(o=>o.type==='garden').plant.harvests).toBe(1);expect(saved.objects.find(o=>o.type==='garden').plant.growth).toBeLessThan(.2);await page.reload();await expect(page.locator('#loading')).toBeHidden();await expect(page.locator('#money')).toHaveText('2,454');
 await page.setViewportSize({width:390,height:844});await expect(page.locator('#money')).toHaveText('2,454');await page.screenshot({path:'test-results/harvest-mobile.png'});expect(saved.harvest.spores).toBe(0);expect(errors).toEqual([]);
});
test('life scrolling survives live updates on desktop and narrow screens',async({page})=>{
 const g=createGame();g.memorials=Array.from({length:16},(_,i)=>({uid:`old-${i}`,name:`纪念居民 ${i}`,age:120,day:1,cause:'old_age',parents:[]}));
 await page.addInitScript(state=>localStorage.setItem('orbit-life-v1',JSON.stringify(state)),g);await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});await page.getByRole('button',{name:'生命',exact:true}).click();
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});const panel=page.locator('.life-panel');await panel.evaluate(el=>{el.scrollTop=180;});const before=await panel.evaluate(el=>el.scrollTop);expect(before).toBeGreaterThan(100);await page.waitForTimeout(1600);expect(await panel.evaluate(el=>el.scrollTop)).toBe(before);}
});
test('automatic save runs once a minute and reload flushes newer progress',async({page})=>{
 const state=createGame();state.autonomy.enabled=false;state.skills.botany=CAREERS.botanist.levels[0].skills.botany;
 await page.clock.install();await page.addInitScript(g=>{if(!localStorage.getItem('orbit-life-v1'))localStorage.setItem('orbit-life-v1',JSON.stringify(g));},state);await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 const initial=(await stores.get(page).store.read()).revision;await page.clock.fastForward(5000);expect((await stores.get(page).store.read()).revision).toBe(initial);
 await page.clock.fastForward(55000);await expect(page.locator('#save-status')).toContainText('已自动保存');const stored=await savedState(page);expect(stored.minute).toBeGreaterThan(510);await expect(page.locator('#save-status')).toContainText('已自动保存');
 await page.getByRole('button',{name:'暂停',exact:true}).click();await page.getByRole('button',{name:'职业',exact:true}).click();await page.getByRole('button',{name:'加入异星植物'}).click();
 const time=await page.locator('#clock').innerText();await page.reload();await expect(page.locator('#loading')).toBeHidden();await expect(page.locator('#clock')).toHaveText(time);await page.getByRole('button',{name:'职业',exact:true}).click();await expect(page.locator('#panel-content')).toContainText('孢子培育员');
});
test('failed saves keep the previous snapshot and expose a persistent error',async({page})=>{
 const g=createGame();g.speed=0;g.skills.botany=CAREERS.botanist.levels[0].skills.botany;
 await page.addInitScript(state=>localStorage.setItem('orbit-life-v1',JSON.stringify(state)),g);
 await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 await page.route('**/api/save',route=>route.request().method()==='POST'?route.fulfill({status:503,json:{error:'Disk unavailable'}}):route.fallback());
 await page.getByRole('button',{name:'职业',exact:true}).click();await page.getByRole('button',{name:'加入异星植物'}).click();await page.getByRole('button',{name:'保存游戏',exact:true}).click();
 await expect(page.locator('#save-status')).toContainText('保存失败');expect((await stores.get(page).store.read()).state.career.id).toBe('scientist');await expect(page.locator('#toast')).toContainText('未能保存');
});

test('separate browser profiles share disk progress and stale pages cannot overwrite it',async({page,browser})=>{
 const g=createGame();g.day=9;g.money=4260;g.speed=0;g.skills.botany=CAREERS.botanist.levels[0].skills.botany;
 await stores.get(page).store.write({state:g,baseRevision:0,clientId:'seed',sequence:1});
 await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden();
 const second=await browser.newContext();try{
  await second.route('**/api/save',handlers.get(page));
  await second.addInitScript(state=>localStorage.setItem('orbit-life-v1',JSON.stringify(state)),createGame());
  const other=await second.newPage();await other.goto('http://127.0.0.1:5173');await expect(other.locator('#loading')).toBeHidden();
  await expect(other.locator('#day')).toHaveText('第 9 天');await expect(other.locator('#money')).toHaveText('4,260');
  await page.getByRole('button',{name:'职业',exact:true}).click();await page.getByRole('button',{name:'加入异星植物'}).click();await page.getByRole('button',{name:'保存游戏',exact:true}).click();await expect(page.locator('#toast')).toContainText('已保存');
  await other.getByRole('switch',{name:'自主行为',exact:true}).click();await other.getByRole('button',{name:'保存游戏',exact:true}).click();await expect(other.locator('#reload-save')).toBeVisible();
  expect((await stores.get(page).store.read()).state.career.id).toBe('botanist');
  await other.getByRole('button',{name:'载入最新存档'}).click();await expect(other.locator('#loading')).toBeHidden();await other.getByRole('button',{name:'职业',exact:true}).click();await expect(other.locator('#panel-content')).toContainText('孢子培育员');
 }finally{await second.close();}
});


test('UFO passenger picker carries all races after earlier work and remote back can be viewed without moving residents',async({page})=>{
 const {enqueue,tick,switchControl}=await import('../src/simulation.js');const state=createGame();state.civilization.observations=3;state.civilization.discoveryPath=['home','spore'];state.civilization.technology=120;state.skills.science=6;state.space.ships.push({id:'family-ufo',tier:2,island:'home',side:'front',food:0,durability:100,reservedBy:null});state.space.provisions.home=8;state.npcs.nova.prayer.nether=10;state.npcs.lumi.prayer.radiance=10;state.npcs.pip.age=1;
 switchControl(state,'nova');enqueue(state,'research','lab');switchControl(state,'kai');state.autonomy.enabled=false;for(const n of Object.values(state.npcs))n.ai.enabled=false;for(const k in state.config.needDecay)state.config.needDecay[k]=0;state.speed=0;fixtures.set(page,state);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});await page.getByRole('button',{name:'探索',exact:true}).click();await page.locator('[data-voyage="spore"]').click();
 await expect(page.locator('#flight-dialog')).toContainText('先完成 1 个安排');for(const id of ['nova','lumi','pip'])await page.locator(`#flight-dialog input[value="${id}"]`).check();await expect(page.locator('#flight-reason')).toContainText('共 4 人');await page.locator('#confirm-flight').click();await page.locator('[data-speed="3"]').click();await expect(page.locator('#world')).toHaveAttribute('data-island','spore',{timeout:45000});await expect(page.locator('.ufo-flight-board')).toBeHidden({timeout:20000});await page.locator('[data-speed="0"]').click();await page.locator('#save').click();const saved=await savedState(page);for(const p of [saved.player,saved.npcs.nova,saved.npcs.lumi,saved.npcs.pip])expect(p.island).toBe('spore');expect(saved.space.ships[0].food).toBe(4);
 saved.player.prayer.nether=10;saved.speed=1;saved.autonomy.enabled=true;saved.autonomy.cooldown=0;saved.autonomy.lastWorkDay=saved.day;saved.player.preferences.explore=10;for(let i=0;i<30;i++)tick(saved,.1,()=>0);saved.autonomy.enabled=false;saved.queue=[];saved.viewSide='front';enqueue(saved,'walk',null,{x:0,z:2});for(let i=0;i<30;i++)tick(saved,.1,()=>0);saved.speed=0;fixtures.set(page,saved);await page.reload();await expect(page.locator('#loading')).toBeHidden({timeout:45000});await expect(page.locator('#flip-island')).toBeEnabled();await page.locator('#flip-island').click();await expect(page.locator('#world')).toHaveAttribute('data-side','back');await expect(page.locator('#world')).toHaveAttribute('data-flipping','false');await page.screenshot({path:'artifacts/remote-island-back.png'});await page.locator('#save').click();const back=await savedState(page);expect(back.player.side).toBe('front');expect(back.viewSide).toBe('back');expect(errors).toEqual([]);
});


test('manufactured UFO is a clickable floating scene entity and the selected ship is used for launch',async({page})=>{
 const {enqueue,tick}=await import('../src/simulation.js'),{ufoDock,UFO_HOVER_HEIGHT}=await import('../src/ufo-visuals.js'),{OrthographicCamera,Vector3}=await import('three');const state=createGame();state.career.level=2;state.skills.science=18;state.money=10000;state.civilization.technology=120;state.civilization.observations=3;state.civilization.discoveryPath=['home','spore'];state.autonomy.enabled=false;for(const n of Object.values(state.npcs))n.ai.enabled=false;enqueue(state,'buildUfo2','lab');for(let i=0;i<800;i++)tick(state,.1,()=>.5);expect(state.space.ships).toHaveLength(1);state.speed=0;state.space.provisions.home=8;fixtures.set(page,state);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});await expect(page.locator('#world')).toHaveAttribute('data-ufo-count','1');await page.screenshot({path:'artifacts/ufo-hovering.png'});
 const dock=ufoDock(state,state.space.ships[0]),box=await page.locator('#world canvas').boundingBox(),camera=sceneCamera(box);const point=new Vector3(dock.x,dock.y,dock.z).project(camera);await expect(page.locator('#tooltip')).toBeHidden();await page.mouse.move(box.x+(point.x+1)*box.width/2,box.y+(1-point.y)*box.height/2);await expect(page.locator('#tooltip')).toContainText('补给 0/10');await expect(page.locator('#tooltip')).toContainText('剩余 10 次单程航行');await page.mouse.move(20,20);await expect(page.locator('#tooltip')).toBeHidden();await page.mouse.click(box.x+(point.x+1)*box.width/2,box.y+(1-point.y)*box.height/2);await expect(page.locator('.ufo-dialog')).toContainText('星梭 UFO');await expect(page.locator('.ufo-dialog')).toContainText('悬浮停靠');await page.locator('.ufo-dialog [data-voyage="spore"]').click();await expect(page.locator('#flight-dialog')).toBeVisible();await page.locator('#confirm-flight').click();await page.locator('#save').click();const saved=await savedState(page);expect(saved.queue[0].shipId).toBe(state.space.ships[0].id);expect(saved.space.ships[0].reservedBy).toBe(saved.queue[0].id);await page.getByRole('button',{name:'探索',exact:true}).click();await page.locator('[data-ufo]').click();await expect(page.locator('.ufo-dialog')).toContainText('已安排航行');expect(errors).toEqual([]);
});


test('quantum science master can return through portal without a UFO',async({page})=>{
 const {enqueue,tick}=await import('../src/simulation.js');const state=createGame();state.civilization.observations=3;state.civilization.discoveryPath=['home','spore'];state.civilization.technology=40;state.skills.science=135;state.autonomy.enabled=false;for(const n of Object.values(state.npcs))n.ai.enabled=false;enqueue(state,'starVoyage','portal',undefined,null,'spore');for(let i=0;i<450;i++)tick(state,.1,()=>.5);expect(state.player.island).toBe('spore');state.speed=0;fixtures.set(page,state);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});await page.getByRole('button',{name:'探索',exact:true}).click();await page.locator('[data-star-voyage="home"]').click();await page.locator('[data-speed="3"]').click();await expect(page.locator('#world')).toHaveAttribute('data-island','home',{timeout:25000});await expect(page.locator('.ufo-flight-board')).toBeHidden({timeout:20000});await page.locator('[data-speed="0"]').click();await page.locator('#save').click();expect((await savedState(page)).space.ships).toHaveLength(0);expect(errors).toEqual([]);
});
test('UFO food indicators distinguish partial and full cargo and loading uses stored food',async({page})=>{
 const state=createGame();state.speed=0;state.minute=1100;state.space.ships=[{id:'supply-ship',tier:3,island:'home',side:'front',food:4,durability:100,reservedBy:null}];state.space.provisions.home=20;fixtures.set(page,state);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});await page.getByRole('button',{name:'探索',exact:true}).click();await page.locator('[data-ufo]').click();await expect(page.locator('.ufo-dialog')).toContainText('4 / 24 份 · 补给未满');await page.getByRole('button',{name:'关闭 UFO',exact:true}).click();await page.screenshot({path:'artifacts/ufo-food-partial.png'});
 await page.locator('[data-ufo]').click();await page.locator('[data-load-ship]').click();await expect(page.locator('.ufo-dialog')).toContainText('24 / 24 份 · 补给满载');await page.getByRole('button',{name:'关闭 UFO',exact:true}).click();await page.screenshot({path:'artifacts/ufo-food-full.png'});await page.locator('#save').click();const saved=await savedState(page);expect(saved.space.ships[0].food).toBe(24);expect(saved.space.provisions.home).toBe(0);expect(errors).toEqual([]);
});
for(const biome of ['fungal','crystalline','ruins','choral'])test(`refined seeded ${biome} island renders independently`,async({page})=>{
 const {generateIsland}=await import('../src/island-generator.js'),{enqueue,tick}=await import('../src/simulation.js');let seed=0;while(generateIsland(seed,0).biome!==biome)seed++;
 const state=createGame(),b=generateIsland(seed,0);state.civilization.islands[b.id]=b;state.civilization.visits[b.id]=state.civilization.surveys[b.id]=state.civilization.surveyDays[b.id]=0;state.civilization.technology=240;state.skills.science=135;state.autonomy.enabled=false;for(const n of Object.values(state.npcs))n.ai.enabled=false;enqueue(state,'starVoyage','portal',undefined,null,b.id);for(let i=0;i<450;i++)tick(state,.1,()=>.5);expect(state.player.island).toBe(b.id);state.speed=0;fixtures.set(page,state);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});await expect(page.locator('#world')).toHaveAttribute('data-island',b.id);await page.screenshot({path:`artifacts/island-${biome}.png`});expect(errors).toEqual([]);
});


test('large saves above keepalive quota can be saved and restored',async({page})=>{
 const state=createGame();state.day=170;state.speed=0;state.log.push({text:'large-save-'.repeat(7000),at:state.minute});fixtures.set(page,state);await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});await page.locator('[data-speed="1"]').click();await expect(page.locator('#clock')).not.toHaveText('08:30');await page.locator('[data-speed="0"]').click();await page.locator('#save').click();const saved=await savedState(page);expect(saved.day).toBe(170);expect(new TextEncoder().encode(JSON.stringify(saved)).byteLength).toBeGreaterThan(65536);await page.reload();await expect(page.locator('#loading')).toBeHidden({timeout:45000});await expect(page.locator('#day')).toHaveText('第 170 天');
});
test('resident devotion editor saves the individual prayer tendency',async({page})=>{
 const state=createGame();state.speed=0;fixtures.set(page,state);await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});await page.getByRole('button',{name:'人物',exact:true}).click();await page.getByRole('spinbutton',{name:'虔诚值',exact:true}).fill('95');await page.getByRole('button',{name:'应用人物设定'}).click();await page.locator('#save').click();expect((await savedState(page)).player.devotion).toBe(95);await page.reload();await expect(page.locator('#loading')).toBeHidden({timeout:45000});await page.getByRole('button',{name:'人物',exact:true}).click();await expect(page.getByRole('spinbutton',{name:'虔诚值',exact:true})).toHaveValue('95');
});


test('UFO moving approach is rendered on desktop and mobile',async({page})=>{
 const {enqueue}=await import('../src/simulation.js');const state=createGame();state.civilization.technology=120;state.civilization.observations=3;state.civilization.discoveryPath=['home','spore'];state.autonomy.enabled=false;for(const n of Object.values(state.npcs))n.ai.enabled=false;
 state.space.ships=[{id:'tilting-ufo',tier:3,island:'home',side:'front',food:8,durability:100,reservedBy:null}];expect(enqueue(state,'voyage','portal',undefined,null,'spore',[],'tilting-ufo').ok).toBe(true);
 state.queue[0].phase='acting';state.queue[0].path=[];state.queue[0].elapsed=state.config.actionDurations.voyage*.03;state.speed=0;fixtures.set(page,state);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});await expect(page.locator('.ufo-flight-board')).toContainText('前往接人');
 await page.screenshot({path:'artifacts/ufo-tilt-desktop.png'});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/ufo-tilt-mobile.png'});expect(errors).toEqual([]);
});

test('UFO flight displays a persistent route and animated departure before arrival',async({page})=>{
 const {enqueue}=await import('../src/simulation.js');const state=createGame();state.civilization.technology=120;state.civilization.observations=3;state.civilization.discoveryPath=['home','spore'];state.autonomy.enabled=false;for(const n of Object.values(state.npcs))n.ai.enabled=false;
 state.space.ships=[{id:'animated-ufo',tier:2,island:'home',side:'front',food:8,durability:100,reservedBy:null}];expect(enqueue(state,'voyage','portal',undefined,null,'spore',[],'animated-ufo').ok).toBe(true);
 state.queue[0].phase='acting';state.queue[0].path=[];state.queue[0].elapsed=3;state.speed=0;fixtures.set(page,state);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});await expect(page.locator('.ufo-flight-board')).toContainText('光束吸入');await expect(page.locator('#world')).toHaveAttribute('data-ufo-beams','1');await expect(page.locator('.ufo-flight-board')).toContainText('露米纳星湾 → 孢海浮洲');await page.screenshot({path:'artifacts/ufo-takeoff.png'});
 await page.locator('[data-speed="1"]').click();await expect(page.locator('.ufo-flight-board')).toContainText('星际航行',{timeout:15000});await expect(page.locator('#world')).toHaveAttribute('data-island','spore',{timeout:15000});await expect(page.locator('.ufo-flight-board')).toContainText('光束放下',{timeout:25000});await page.locator('[data-speed="0"]').click();await page.screenshot({path:'artifacts/ufo-landing.png'});
 await page.locator('#save').click();const saved=await savedState(page);expect(saved.space.ships).toHaveLength(1);expect(saved.queue[0].elapsed).toBeGreaterThan(0);await page.reload();await expect(page.locator('#loading')).toBeHidden({timeout:45000});await expect(page.locator('.ufo-flight-board')).toContainText('光束放下');await page.locator('[data-speed="1"]').click();await expect(page.locator('.ufo-flight-board')).toBeHidden({timeout:15000});await page.locator('[data-speed="0"]').click();await page.locator('#save').click();expect((await savedState(page)).space.ships[0].island).toBe('spore');expect(errors).toEqual([]);
});


test('Nether residents dissolve at full size while moving to cross-face work without a skill button',async({page})=>{
 const {enqueue}=await import('../src/simulation.js');const state=createGame();state.player.prayer.nether=10;state.money=0;state.objects=state.objects.filter(o=>o.type!=='gate');state.objects.push({id:'back-lab',type:'lab',x:0,z:0,rotation:0,island:'home',side:'back'});state.autonomy.enabled=false;for(const n of Object.values(state.npcs))n.ai.enabled=false;expect(enqueue(state,'research','back-lab').ok).toBe(true);state.speed=0;fixtures.set(page,state);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});await expect(page.locator('#nether-blink')).toHaveCount(0);await page.locator('[data-speed="1"]').click();await expect(page.locator('#world')).toHaveAttribute('data-blinking','1');await page.waitForTimeout(650);await page.locator('[data-speed="0"]').click();await page.screenshot({path:'artifacts/nether-blink.png'});await page.locator('#save').click();let saved=await savedState(page);expect(saved.queue[0].type).toBe('research');expect(saved.queue[0].blinkTransit.elapsed).toBeGreaterThan(0);await page.reload();await expect(page.locator('#loading')).toBeHidden({timeout:45000});await expect(page.locator('#world')).toHaveAttribute('data-blinking','1');await page.locator('[data-speed="1"]').click();await expect(page.locator('#world')).toHaveAttribute('data-blinking','0');await expect(page.locator('#world')).toHaveAttribute('data-side','back');await page.locator('[data-speed="0"]').click();await page.locator('#save').click();saved=await savedState(page);expect(saved.player.side).toBe('back');expect(saved.queue[0].type).toBe('research');expect(saved.money).toBe(0);expect(errors).toEqual([]);
});

test('Nether daily errands blink on the same face and unseen backs are discovered by autonomous movement',async({page})=>{
 const {enqueue}=await import('../src/simulation.js');const state=createGame();state.player.prayer.nether=10;state.money=0;state.autonomy.enabled=false;for(const n of Object.values(state.npcs))n.ai.enabled=false;enqueue(state,'research','lab');state.speed=0;fixtures.set(page,state);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});await expect(page.locator('#nether-blink')).toHaveCount(0);await page.locator('[data-speed="1"]').click();await expect(page.locator('#world')).toHaveAttribute('data-blinking','1');await page.waitForTimeout(600);await page.locator('[data-speed="0"]').click();await page.screenshot({path:'artifacts/nether-daily-blink.png'});await page.locator('#save').click();expect((await savedState(page)).queue[0].blinkTransit).toBeTruthy();await page.locator('[data-speed="1"]').click();await expect(page.locator('#world')).toHaveAttribute('data-blinking','0');await expect(page.locator('#world')).toHaveAttribute('data-side','front');
 const remote=createGame();remote.player.island='spore';remote.player.prayer.nether=10;remote.civilization.observations=3;remote.civilization.discoveryPath=['home','spore'];remote.civilization.visits.spore=1;remote.viewIsland='spore';remote.objects=[];remote.npcs={};remote.money=0;remote.speed=0;remote.autonomy.cooldown=0;for(const k in remote.needs)remote.needs[k]=80;fixtures.set(page,remote);await page.reload();await expect(page.locator('#loading')).toBeHidden({timeout:45000});await expect(page.locator('#flip-island')).toBeDisabled();await page.locator('[data-speed="1"]').click();await expect(page.locator('#world')).toHaveAttribute('data-blinking','1');await expect(page.locator('#world')).toHaveAttribute('data-side','back');await expect(page.locator('#world')).toHaveAttribute('data-blinking','0');await page.locator('[data-speed="0"]').click();await page.locator('#save').click();const saved=await savedState(page);expect(saved.space.backs.spore).toBe(true);expect(saved.player.side).toBe('back');expect(saved.objects.some(o=>o.type==='portal')).toBe(false);expect(errors).toEqual([]);
});
