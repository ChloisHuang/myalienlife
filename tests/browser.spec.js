import {test,expect} from '@playwright/test';
import {prayerFixture} from './helpers/prayer-fixture.js';
import {createGame,CAREERS} from '../src/simulation.js';
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
 const bounds=await page.locator('#world canvas').boundingBox(),camera=new OrthographicCamera(-14*bounds.width/bounds.height,14*bounds.width/bounds.height,14,-14,.1,180);
 camera.position.set(23,25,30);camera.lookAt(0,0,0);camera.updateMatrixWorld();const p=new Vector3(0,1.3,4).project(camera);
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
 const camera=new OrthographicCamera(-14*bounds.width/bounds.height,14*bounds.width/bounds.height,14,-14,.1,180);
 camera.position.set(23,25,30);camera.lookAt(0,0,0);camera.updateMatrixWorld();
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
 g.objects.push({id:'back-kitchen',type:'stove',side:'back',x:3,z:0,rotation:0},{id:'back-tea',type:'tea',side:'back',x:5,z:0,rotation:0},{id:'back-relic',type:'relic',side:'back',x:6,z:-3,rotation:0},{id:'back-beacon',type:'beacon',side:'back',x:-4,z:-4,rotation:0});
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
 for(const [key,value]of Object.entries({skillChance:10,netherChance:10,mutationChance:1,rejuvenationChance:.1}))await expect(dialog.locator(`[data-config-path="prayer.${key}"]`)).toHaveValue(String(value));
 const prayer={skillChance:27.5,netherChance:0,mutationChance:100,rejuvenationChance:.2};
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
 for(const [key,value]of Object.entries({skillChance:10,netherChance:10,mutationChance:1,rejuvenationChance:.1}))await expect(dialog.locator(`[data-config-path="prayer.${key}"]`)).toHaveValue(String(value));
});
test('skills and resident appearance have dedicated panels and retain edits after reload',async({page})=>{
 const state=createGame();state.speed=0;state.skills.science=4;
 await page.addInitScript(g=>{if(!localStorage.getItem('orbit-life-v1'))localStorage.setItem('orbit-life-v1',JSON.stringify(g));},state);
 await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:30000});
  await page.getByRole('button',{name:'技能',exact:true}).click();await expect(page.locator('[data-skill="science"]')).toContainText('Lv.2');await expect(page.locator('.skill-card')).toHaveCount(5);
  await page.getByRole('button',{name:'人物',exact:true}).click();await expect(page.locator('#resident-summary')).toContainText('余额 2,400 星币');await expect(page.locator('#character-switcher')).toBeHidden();await page.locator('#active-character').click();await expect(page.locator('#character-switcher')).toBeVisible();await expect(page.locator('#character-switcher .character-option')).toHaveCount(4);await page.locator('[data-character="nova"]').click();await expect(page.locator('#resident-summary')).toContainText('余额 600 星币');await page.locator('#active-character').click();await page.locator('[data-character="kai"]').click();await expect(page.locator('#resident-summary')).toContainText('余额 2,400 星币');const before=await page.locator('#resident-photo').getAttribute('src');
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
 const r=await page.locator('#world canvas').boundingBox(),camera=new OrthographicCamera(-14*r.width/r.height,14*r.width/r.height,14,-14,.1,180);camera.position.set(23,25,30);camera.lookAt(0,0,0);camera.updateMatrixWorld();const p=new Vector3(1,.9,-4).project(camera);await page.mouse.click(r.x+(p.x+1)*r.width/2,r.y+(1-p.y)*r.height/2);
 await expect(page.locator('#context-menu')).toContainText('营养合成器');await expect(page.locator('[data-action="eat"]')).toHaveCount(0);
});
test('sofa menu invites two neighbors into separate seats and saves the seated conversation',async({page})=>{
 const {OrthographicCamera,Vector3}=await import('three');const g=createGame();g.speed=0;for(const n of Object.values(g.npcs))n.ai.enabled=false;fixtures.set(page,g);
 await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:30000});
 const r=await page.locator('#world canvas').boundingBox(),camera=new OrthographicCamera(-14*r.width/r.height,14*r.width/r.height,14,-14,.1,180);camera.position.set(23,25,30);camera.lookAt(0,0,0);camera.updateMatrixWorld();const sofa=g.objects.find(o=>o.id==='sofa'),p=new Vector3(sofa.x,.8,sofa.z).project(camera);
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
 fixtures.set(page,structuredClone(g));await page.reload();await expect(page.locator('#loading')).toBeHidden();await page.getByRole('button',{name:'生命',exact:true}).click();await page.locator('#active-character').click();await expect(page.locator('#character-switcher .character-option')).toHaveCount(5);await page.screenshot({path:'test-results/lifecycle-birth.png'});
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
 fixtures.set(page,structuredClone(saved));await page.reload();await expect(page.locator('#loading')).toBeHidden();await page.getByRole('button',{name:'生命',exact:true}).click();await page.locator('#active-character').click();await page.locator(`[data-character="${baby.uid}"]`).click();await expect(page.locator('.family-line').first()).toContainText('凯伊、诺瓦');await expect(page.locator('.family-line').last()).toContainText('身高');
 await page.getByRole('button',{name:'跟随凯伊',exact:true}).click();for(let i=0;i<8;i++)await page.getByRole('button',{name:'拉近视角',exact:true}).click();await page.screenshot({path:'test-results/newborn-closeup.png'});expect(errors).toEqual([]);
});
test('plant menu shows condition, harvests into storage, sells produce and saves regrowth',async({page})=>{
 const {OrthographicCamera,Vector3}=await import('three');const g=createGame();g.speed=0;for(const n of Object.values(g.npcs))n.ai.enabled=false;g.objects.find(o=>o.type==='garden').plant.growth=1;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(state=>{if(!localStorage.getItem('orbit-life-v1'))localStorage.setItem('orbit-life-v1',JSON.stringify(state));},g);
 await page.goto('http://127.0.0.1:5173');await expect(page.locator('#loading')).toBeHidden({timeout:45000});
 const r=await page.locator('#world canvas').boundingBox(),camera=new OrthographicCamera(-14*r.width/r.height,14*r.width/r.height,14,-14,.1,180);camera.position.set(23,25,30);camera.lookAt(0,0,0);camera.updateMatrixWorld();const p=new Vector3(7,.9,3).project(camera);await page.mouse.click(r.x+(p.x+1)*r.width/2,r.y+(1-p.y)*r.height/2);
 await expect(page.locator('#plant-status')).toContainText('成熟可收获');await expect(page.locator('#plant-status')).toContainText('水分');await expect(page.locator('[data-action="replant"]')).toBeDisabled();await page.screenshot({path:'test-results/plant-mature.png'});
 await page.locator('[data-action="harvest"]').click();await page.getByRole('button',{name:'三倍速度',exact:true}).click();await expect(page.locator('#queue')).not.toContainText('收获成熟植物',{timeout:20000});await expect(page.locator('#journal')).toBeHidden();await page.getByRole('button',{name:'暂停',exact:true}).click();
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
 const state=createGame();state.skills.botany=CAREERS.botanist.levels[0].skills.botany;
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
