import {test,expect} from '@playwright/test';
import {createGame} from '../src/simulation.js';
import {createSaveStore} from '../server/save-store.js';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const stores=new WeakMap(),fixtures=new WeakMap(),handlers=new WeakMap();
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

test('3D game supports social queue, pause, building, careers and persisted save',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
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
test('skills and resident appearance have dedicated panels and retain edits after reload',async({page})=>{
 const state=createGame();state.speed=0;state.skills.science=4;
 await page.addInitScript(g=>{if(!localStorage.getItem('orbit-life-v1'))localStorage.setItem('orbit-life-v1',JSON.stringify(g));},state);
 await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:30000});
 await page.getByRole('button',{name:'技能',exact:true}).click();await expect(page.locator('[data-skill="science"]')).toContainText('Lv.2');await expect(page.locator('.skill-card')).toHaveCount(4);
 await page.getByRole('button',{name:'人物',exact:true}).click();const before=await page.locator('#resident-photo').getAttribute('src');
 await page.getByLabel('性别',{exact:true}).selectOption('female');await page.getByLabel('年龄（星岁）',{exact:true}).fill('68');await page.getByRole('button',{name:'应用人物设定'}).click();
 await expect(page.locator('#resident-summary')).toContainText('长者');expect(await page.locator('#resident-photo').getAttribute('src')).not.toBe(before);
 await page.getByRole('button',{name:'保存游戏',exact:true}).click();await page.reload();await expect(page.locator('#loading')).toBeHidden({timeout:30000});
 await page.getByRole('button',{name:'人物',exact:true}).click();await expect(page.getByLabel('性别',{exact:true})).toHaveValue('female');await expect(page.getByLabel('年龄（星岁）',{exact:true})).toHaveValue('68');
 await page.setViewportSize({width:390,height:844});await expect(page.getByRole('button',{name:'应用人物设定'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
test('raycast interaction completes social action, earns wages, and places purchased furniture',async({page})=>{
 // Freeze the initial scene before rendering: autonomous NPCs now move immediately.
 await page.addInitScript(state=>{if(!localStorage.getItem('orbit-life-v1'))localStorage.setItem('orbit-life-v1',JSON.stringify(state));},{...createGame(),speed:0});
 await page.setViewportSize({width:1600,height:1000});await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:30000});
 await page.getByRole('button',{name:'暂停',exact:true}).click();
 // Click Nova's visible 3D body, not a substitute UI control.
 await page.mouse.click(805,407);await expect(page.locator('#context-menu')).toContainText('诺瓦');
 await page.locator('[data-action="chat"]').click();await page.getByRole('button',{name:'三倍速度',exact:true}).click();
 await expect(page.locator('#journal-text')).toContainText('完成：聊聊母星',{timeout:20000});
 await page.getByRole('button',{name:'职业',exact:true}).click();await page.getByRole('button',{name:'开始工作',exact:true}).click();
 await expect(page.locator('#journal-text')).toContainText('获得 180 星币',{timeout:25000});
 await page.getByRole('button',{name:'暂停',exact:true}).click();await page.getByRole('button',{name:'建造模式',exact:true}).click();
 await page.locator('[data-pack="孢子花园"]').click();await page.getByRole('button',{name:'购买 极光晶簇'}).click();
 await page.mouse.move(660,437);await page.mouse.click(660,437);await expect(page.locator('#toast')).toContainText('已放入家园');
 await page.getByRole('button',{name:'保存游戏',exact:true}).click();
 const saved=await savedState(page);
 expect(saved.relationships.nova).toBe(30);expect(saved.money).toBe(2460);expect(saved.objects).toHaveLength(9);expect(saved.objects.at(-1).type).toBe('crystal');
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
 const autonomy=page.getByRole('switch',{name:'自主行为',exact:true});await expect(autonomy).toHaveAttribute('aria-checked','false');
 await expect(page.locator('.profile .current-activity').getByRole('switch',{name:'自主行为',exact:true})).toBeVisible();await expect(autonomy).toHaveText('自主');
 await autonomy.click();await expect(autonomy).toHaveAttribute('aria-checked','true');await expect(page.locator('#queue .ai-badge')).toHaveText('自主');
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
 fixtures.set(page,structuredClone(g));await page.reload();await expect(page.locator('#loading')).toBeHidden();await page.getByRole('button',{name:'生命',exact:true}).click();await expect(page.locator('#resident-select option')).toHaveCount(6);await page.screenshot({path:'test-results/lifecycle-birth.png'});
 g.player.age=120;g.speed=1;sim.tick(g,1);fixtures.set(page,structuredClone(g));await page.reload();await expect(page.locator('#loading')).toBeHidden();await expect(page.locator('#life-alert')).toContainText('离世');await expect(page.locator('.memorial-entry')).toContainText('凯伊');await page.getByRole('button',{name:'接管 诺瓦',exact:true}).click();await expect(page.locator('.profile h2')).toContainText('诺瓦');await expect(page.locator('#life-alert')).toBeHidden();
 await page.getByRole('button',{name:'保存游戏',exact:true}).click();await page.reload();await expect(page.locator('#loading')).toBeHidden();await expect(page.locator('.profile h2')).toContainText('诺瓦');await page.getByRole('button',{name:'生命',exact:true}).click();await page.setViewportSize({width:390,height:844});await expect(page.locator('#family-desire')).toBeVisible();await page.screenshot({path:'test-results/lifecycle-mobile.png'});expect(errors).toEqual([]);
});
test('3D nursery lets the player choose two parents and the newborn displays inherited family traits',async({page})=>{
 const {OrthographicCamera,Vector3}=await import('three');const sim=await import('../src/simulation.js');const g=sim.createGame();g.speed=0;g.relationships.nova=75;g.objects.push({id:'nursery',type:'nursery',x:-6,z:4,rotation:0});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(state=>{if(!localStorage.getItem('orbit-life-v1'))localStorage.setItem('orbit-life-v1',JSON.stringify(state));},g);
 await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 const r=await page.locator('#world canvas').boundingBox(),camera=new OrthographicCamera(-14*r.width/r.height,14*r.width/r.height,14,-14,.1,180);camera.position.set(23,25,30);camera.lookAt(0,0,0);camera.updateMatrixWorld();const p=new Vector3(-6,.9,4).project(camera);await page.mouse.click(r.x+(p.x+1)*r.width/2,r.y+(1-p.y)*r.height/2);
 await expect(page.locator('#context-menu')).toContainText('星芽育生舱');await page.locator('#birth-partner').selectOption('nova');await page.locator('[data-action="incubate"]').click();await page.getByRole('button',{name:'三倍速度',exact:true}).click();await expect(page.locator('#journal-text')).toContainText('决定孕育',{timeout:20000});await page.getByRole('button',{name:'暂停',exact:true}).click();await page.getByRole('button',{name:'保存游戏',exact:true}).click();
 const saved=await savedState(page);expect(saved.incubations[0].parents.map(p=>p.name)).toEqual(['凯伊','诺瓦']);saved.incubations[0].due=sim.gameMinutes(saved);saved.speed=1;sim.tick(saved,1);saved.speed=0;const baby=Object.values(saved.npcs).find(n=>n.age<1);
 fixtures.set(page,structuredClone(saved));await page.reload();await expect(page.locator('#loading')).toBeHidden();await page.getByRole('button',{name:'生命',exact:true}).click();await page.locator('#resident-select').selectOption(baby.uid);await expect(page.locator('.family-line').first()).toContainText('凯伊、诺瓦');await expect(page.locator('.family-line').last()).toContainText('身高');
 await page.getByRole('button',{name:'跟随凯伊',exact:true}).click();for(let i=0;i<8;i++)await page.getByRole('button',{name:'拉近视角',exact:true}).click();await page.screenshot({path:'test-results/newborn-closeup.png'});expect(errors).toEqual([]);
});
test('plant menu shows condition, harvests into storage, sells produce and saves regrowth',async({page})=>{
 const {OrthographicCamera,Vector3}=await import('three');const g=createGame();g.speed=0;for(const n of Object.values(g.npcs))n.ai.enabled=false;g.objects.find(o=>o.type==='garden').plant.growth=1;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(state=>{if(!localStorage.getItem('orbit-life-v1'))localStorage.setItem('orbit-life-v1',JSON.stringify(state));},g);
 await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 const r=await page.locator('#world canvas').boundingBox(),camera=new OrthographicCamera(-14*r.width/r.height,14*r.width/r.height,14,-14,.1,180);camera.position.set(23,25,30);camera.lookAt(0,0,0);camera.updateMatrixWorld();const p=new Vector3(7,.9,3).project(camera);await page.mouse.click(r.x+(p.x+1)*r.width/2,r.y+(1-p.y)*r.height/2);
 await expect(page.locator('#plant-status')).toContainText('成熟可收获');await expect(page.locator('#plant-status')).toContainText('水分');await expect(page.locator('[data-action="replant"]')).toBeDisabled();await page.screenshot({path:'test-results/plant-mature.png'});
 await page.locator('[data-action="harvest"]').click();await page.getByRole('button',{name:'三倍速度',exact:true}).click();await expect(page.locator('#journal-text')).toContainText('收获了 3 份发光孢子',{timeout:20000});await page.getByRole('button',{name:'暂停',exact:true}).click();
 await page.getByRole('button',{name:'物品包',exact:true}).click();await page.getByRole('button',{name:'收成仓库',exact:true}).click();await expect(page.locator('#harvest-content')).toContainText('3 份');await page.locator('#harvest-dialog [data-sell-crop="spores"]').click();await expect(page.locator('#money')).toHaveText('2,454');await expect(page.locator('#harvest-dialog [data-sell-crop="spores"]')).toBeDisabled();await page.getByRole('button',{name:'关闭收成仓库'}).click();
 await page.getByRole('button',{name:'保存游戏',exact:true}).click();const saved=await savedState(page);expect(saved.objects.find(o=>o.type==='garden').plant.harvests).toBe(1);expect(saved.objects.find(o=>o.type==='garden').plant.growth).toBeLessThan(.2);await page.reload();await expect(page.locator('#loading')).toBeHidden();await expect(page.locator('#money')).toHaveText('2,454');
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'物品包',exact:true}).click();await page.getByRole('button',{name:'收成仓库',exact:true}).click();await expect(page.locator('#harvest-content')).toBeVisible();await page.screenshot({path:'test-results/harvest-mobile.png'});expect(errors).toEqual([]);
});
test('life scrolling survives live updates on desktop and narrow screens',async({page})=>{
 const g=createGame();g.memorials=Array.from({length:16},(_,i)=>({uid:`old-${i}`,name:`纪念居民 ${i}`,age:120,day:1,cause:'old_age',parents:[]}));
 await page.addInitScript(state=>localStorage.setItem('orbit-life-v1',JSON.stringify(state)),g);await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});await page.getByRole('button',{name:'生命',exact:true}).click();
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});const panel=page.locator('.life-panel');await panel.evaluate(el=>{el.scrollTop=180;});const before=await panel.evaluate(el=>el.scrollTop);expect(before).toBeGreaterThan(100);await page.waitForTimeout(1600);expect(await panel.evaluate(el=>el.scrollTop)).toBe(before);}
});
test('automatic save runs once a minute and reload flushes newer progress',async({page})=>{
 await page.clock.install();await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 const initial=(await stores.get(page).store.read()).revision;await page.clock.fastForward(5000);expect((await stores.get(page).store.read()).revision).toBe(initial);
 await page.clock.fastForward(55000);await expect(page.locator('#save-status')).toContainText('已自动保存');const stored=await savedState(page);expect(stored.minute).toBeGreaterThan(510);await expect(page.locator('#save-status')).toContainText('已自动保存');
 await page.getByRole('button',{name:'暂停',exact:true}).click();await page.getByRole('button',{name:'职业',exact:true}).click();await page.getByRole('button',{name:'加入异星植物'}).click();
 const time=await page.locator('#clock').innerText();await page.reload();await expect(page.locator('#loading')).toBeHidden();await expect(page.locator('#clock')).toHaveText(time);await page.getByRole('button',{name:'职业',exact:true}).click();await expect(page.locator('#panel-content')).toContainText('孢子培育员');
});
test('failed saves keep the previous snapshot and expose a persistent error',async({page})=>{
 const g=createGame();g.speed=0;
 await page.addInitScript(state=>localStorage.setItem('orbit-life-v1',JSON.stringify(state)),g);
 await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 await page.route('**/api/save',route=>route.request().method()==='POST'?route.fulfill({status:503,json:{error:'Disk unavailable'}}):route.fallback());
 await page.getByRole('button',{name:'职业',exact:true}).click();await page.getByRole('button',{name:'加入异星植物'}).click();await page.getByRole('button',{name:'保存游戏',exact:true}).click();
 await expect(page.locator('#save-status')).toContainText('保存失败');expect((await stores.get(page).store.read()).state.career.id).toBe('scientist');await expect(page.locator('#toast')).toContainText('未能保存');
});

test('separate browser profiles share disk progress and stale pages cannot overwrite it',async({page,browser})=>{
 const g=createGame();g.day=9;g.money=4260;g.speed=0;
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
