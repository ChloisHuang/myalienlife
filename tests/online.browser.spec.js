import {test,expect} from '@playwright/test';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHttpService} from '../server/http-service.js';
import {createGame,ensureStarIsland} from '../src/simulation.js';

test('VIP lettering retains its gold facets without restoring the guest white stripe',async({page})=>{
 await page.setContent('<div class="identity-card" data-tier="guest"><span class="identity-art"><strong class="identity-tier">Guest</strong></span></div><div class="identity-card" data-tier="vip"><span class="identity-art"><strong class="identity-tier">VIP</strong></span></div>');
 await page.addStyleTag({content:await readFile(resolve('src/online.css'),'utf8')});
 const lettering=tier=>page.locator(`[data-tier=${tier}] .identity-tier`);
 await expect(lettering('vip')).toHaveCSS('background-image','linear-gradient(125deg, rgb(105, 67, 13) 0%, rgb(105, 67, 13) 34%, rgb(170, 123, 33) 34%, rgb(170, 123, 33) 43%, rgb(255, 241, 176) 43%, rgb(255, 241, 176) 48%, rgb(117, 75, 13) 48%, rgb(117, 75, 13) 78%, rgb(155, 108, 25) 78%)');
 await expect(lettering('guest')).toHaveCSS('background-image','linear-gradient(125deg, rgb(40, 78, 67) 0%, rgb(82, 126, 105) 45%, rgb(48, 91, 73) 100%)');
});

test('operating VIP lettering gains a stronger sheen only while control is held',async({page})=>{
 await page.setContent('<div class="online-controls"><div class="identity-card" data-tier="vip"><span class="identity-tier">VIP</span></div><div class="identity-card" data-tier="guest"><span class="identity-tier">Guest</span></div></div>');
 await page.addStyleTag({content:await readFile(resolve('src/online.css'),'utf8')});
 const vip=page.locator('[data-tier=vip] .identity-tier'),guest=page.locator('[data-tier=guest] .identity-tier');
 const styles=el=>{const s=getComputedStyle(el);return {background:s.backgroundImage,filter:s.filter,width:el.getBoundingClientRect().width};};
 const original=await vip.evaluate(styles),guestOriginal=await guest.evaluate(styles);
 await page.locator('.online-controls').evaluate(el=>el.classList.add('is-operating'));
 const active=await vip.evaluate(styles);
 expect(active.background).not.toBe(original.background);expect(active.filter).toContain('drop-shadow');expect(active.width).toBe(original.width);
 expect(await guest.evaluate(styles)).toEqual(guestOriginal);
 await page.locator('.online-controls').evaluate(el=>el.classList.remove('is-operating'));
 expect(await vip.evaluate(styles)).toEqual(original);
});

test('identity card flips for token verification and docks as guest or VIP',async({browser})=>{
 const directory=await mkdtemp(join(tmpdir(),'orbit-identity-')),initial=createGame();initial.speed=0;
 const token='identity-test-'.repeat(5),service=await createHttpService({directory,dist:resolve('.deploy/release/dist'),token,origin:'http://127.0.0.1:18195',initial});
 await new Promise(r=>service.server.listen(18195,'127.0.0.1',r));
 try{
  for(const viewport of [{width:1440,height:1000},{width:390,height:844},{width:844,height:390}]){
   const page=await browser.newPage({viewport,locale:'zh-CN'});
   try{
    await page.goto('http://127.0.0.1:18195');await expect(page.locator('#loading')).toBeHidden({timeout:60000});
    const card=page.locator('#operator-login'),dialog=page.locator('#operator-dialog');
    await expect(card).toHaveAttribute('data-tier','guest');await expect(page.locator('#identity-hint')).toHaveText('点击验证');
    const sizes=await card.evaluate(el=>({card:el.offsetHeight,paper:el.closest('.online-controls').offsetHeight}));expect(sizes.card).toBeLessThan(sizes.paper);
    const inset=await card.evaluate(el=>{const c=el.getBoundingClientRect(),p=el.closest('.online-controls').getBoundingClientRect(),rotated=getComputedStyle(document.querySelector('#app')).getPropertyValue('--rotated-layout').trim()==='1';return rotated?[c.left-p.left,p.right-c.right]:[c.top-p.top,p.bottom-c.bottom];});expect(Math.min(...inset)).toBeGreaterThan(0);
    for(const [credential,tier] of [['wrong-token','guest'],[token,'vip']]){
     await card.click();await expect(dialog).toHaveAttribute('data-phase','editing');
     await expect(dialog).toHaveAttribute('data-rotated',String(viewport.width<viewport.height));
     const corners=await dialog.locator('.identity-front,.identity-back').evaluateAll(elements=>elements.map(el=>getComputedStyle(el).borderRadius));expect(corners[0]).toBe(corners[1]);
     const rotation=await dialog.locator('.identity-turn').evaluate(el=>{const matrix=new DOMMatrix(getComputedStyle(el).transform);return [matrix.m11,matrix.m22,matrix.m33];});expect(rotation).toEqual([1,-1,-1]);
     await expect(page.locator('#operator-token')).toBeFocused();
     await page.screenshot({path:`artifacts/identity-back-${viewport.width}.png`});
     await page.locator('#operator-token').fill(credential);await page.locator('#operator-form button[type="submit"]').click();
     await expect(dialog).toHaveAttribute('data-phase','result');
     await expect(dialog.locator('.identity-front')).toHaveAttribute('data-tier',tier);
     await expect(dialog.locator('.identity-tier')).toHaveCSS('background-clip','text');
     const artStyles=await page.locator('#operator-login .identity-art,.identity-front .identity-art').evaluateAll(elements=>elements.map(el=>{const s=getComputedStyle(el);return [s.width,s.height,s.fontSize,s.padding,el.textContent];}));expect(artStyles).toHaveLength(2);expect(artStyles[0]).toEqual(artStyles[1]);
     await expect(page.locator('#operator-token')).toHaveValue('');
     await page.screenshot({path:`artifacts/identity-${tier}-${viewport.width}.png`});
     await expect(dialog).not.toBeVisible();await expect(card).toHaveAttribute('data-tier',tier);
     await expect(card).toBeFocused();
    }
    await expect(page.locator('#claim-control')).toBeVisible();
    await page.locator('#claim-control').click();
    await expect(page.locator('.online-controls')).toHaveClass(/is-operating/);
    await expect(card.locator('.identity-tier')).toHaveCSS('filter','drop-shadow(rgb(255, 243, 161) 0px 0px 0.6px)');
    await page.screenshot({path:`artifacts/identity-operating-${viewport.width}.png`});
    await card.click();await expect(page.locator('.online-controls')).not.toHaveClass(/is-operating/);
    await expect(card.locator('.identity-tier')).toHaveCSS('filter','none');
    await page.locator('#visitor-stats').click();await expect(page.locator('#visitor-results')).toBeVisible();
    for(const id of ['visitor-dialog','config-dialog']){
     if(id==='config-dialog')await page.locator('#config').click();
     const modal=page.locator(`#${id}`);await expect(modal).toBeVisible();
     const bounds=await modal.boundingBox();expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.y).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(viewport.width);expect(bounds.y+bounds.height).toBeLessThanOrEqual(viewport.height);
     if(Math.min(viewport.width,viewport.height)<500)expect(await modal.evaluate(el=>el.offsetWidth>el.offsetHeight)).toBe(true);
     await page.screenshot({path:`artifacts/${id}-${viewport.width}.png`});
     await modal.locator(id==='visitor-dialog'?'button[aria-label="关闭访问统计"]':'button[aria-label="关闭参数配置"]').click();
    }
    await expect(page.locator('#operator-logout')).toHaveCount(0);
    await page.emulateMedia({reducedMotion:'reduce'});await card.click();await expect(dialog).toHaveAttribute('data-phase','viewing');
    await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(card).toBeFocused();
    await page.screenshot({path:`artifacts/identity-docked-${viewport.width}.png`});
   }finally{await page.close();}
  }
 }finally{await service.close();await rm(directory,{recursive:true,force:true});}
});

test('guest authentication strip extends flush from the left edge',async({browser})=>{
 const directory=await mkdtemp(join(tmpdir(),'orbit-auth-strip-')),initial=createGame();initial.speed=0;
 const service=await createHttpService({directory,dist:resolve('.deploy/release/dist'),token:'strip-test-'.repeat(5),origin:'http://127.0.0.1:18193',initial});
 await new Promise(r=>service.server.listen(18193,'127.0.0.1',r));
 try{
  for(const viewport of [{width:1440,height:1000},{width:390,height:844},{width:844,height:390}]){
   const page=await browser.newPage({viewport,locale:'en-US'});
   try{
    await page.goto('http://127.0.0.1:18193');await expect(page.locator('#loading')).toBeHidden({timeout:60000});
    await expect(page.locator('#online-status')).toHaveAttribute('data-status','guest');
    const strip=page.locator('.online-controls');
    const geometry=await strip.evaluate(el=>{const style=getComputedStyle(el),rect=el.getBoundingClientRect(),rotated=getComputedStyle(document.querySelector('#app')).getPropertyValue('--rotated-layout').trim()==='1';return {x:rotated?rect.y:rect.x,radii:[style.borderTopLeftRadius,style.borderBottomLeftRadius,style.borderTopRightRadius,style.borderBottomRightRadius]};});
    expect(geometry.x).toBe(0);expect(geometry.radii).toEqual(['0px','0px','6px','6px']);
    await expect(strip).toHaveCSS('border-left-width','0px');
    await expect(strip).toHaveCSS('border-top-width','0px');
    await expect(strip).toHaveCSS('border-right-width','0px');
    await expect(strip).toHaveCSS('border-bottom-width','0px');
    await expect(page.locator('#operator-login')).toBeInViewport();
    if(viewport.width===1440){
     const gap=await page.locator('.location').evaluate(el=>parseFloat(document.querySelector('#journal').style.top)-el.offsetTop-el.offsetHeight);
     expect(gap).toBeGreaterThanOrEqual(24);
    }
    if(Math.min(viewport.width,viewport.height)<500){
     const gap=await strip.evaluate(el=>{const bar=el.getBoundingClientRect(),queue=document.querySelector('#queue-wrap').getBoundingClientRect(),rotated=getComputedStyle(document.querySelector('#app')).getPropertyValue('--rotated-layout').trim()==='1';return rotated?queue.left-bar.right:bar.top-queue.bottom;});
     expect(gap).toBeGreaterThanOrEqual(8);
    }
    await page.screenshot({path:`artifacts/guest-strip-${viewport.width}.png`});
    await page.locator('#operator-login').click();await expect(page.locator('#operator-dialog')).toBeVisible();
   }finally{await page.close();}
  }
 }finally{await service.close();await rm(directory,{recursive:true,force:true});}
});

test('guests browse resident dossiers locally and navigate once without tracking',async({browser})=>{
 const directory=await mkdtemp(join(tmpdir(),'orbit-dossier-guest-')),initial=createGame();initial.speed=0;
 initial.civilization.discoveryPath.push('spore');initial.civilization.visits.spore=1;ensureStarIsland(initial,'spore');
 Object.assign(initial.npcs.nova,{island:'spore',side:'back',x:3,z:3});initial.npcs.nova.needs.hunger=17;
 const service=await createHttpService({directory,dist:resolve('.deploy/release/dist'),token:'dossier-test-'.repeat(5),origin:'http://127.0.0.1:18192',initial});
 await new Promise(r=>service.server.listen(18192,'127.0.0.1',r));
 const page=await browser.newPage({viewport:{width:1440,height:1000},locale:'zh-CN'}),writes=[],errors=[];
 page.on('request',r=>{if(r.method()==='POST'&&new URL(r.url()).pathname.startsWith('/api/'))writes.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:18192');await expect(page.locator('#loading')).toBeHidden({timeout:60000});
  await expect(page.locator('#online-status')).toHaveAttribute('data-status','guest');
  await page.locator('#dossier-select').click();await page.locator(`[data-dossier-option="${initial.npcs.nova.uid}"]`).click();
  await expect(page.locator('#player-name')).toHaveText(initial.npcs.nova.name);
  await expect(page.locator('#world')).toHaveAttribute('data-island','spore');await expect(page.locator('#world')).toHaveAttribute('data-side','back');
  await expect(page.locator('#dossier-body .needs-grid')).toContainText('17');
  Object.assign(service.authority.state.npcs.nova,{island:'home',side:'front',x:-3,z:-3});service.authority.state.npcs.nova.needs.hunger=42;
  await expect(page.locator('#dossier-body .needs-grid')).toContainText('42');
  await expect(page.locator('#world')).toHaveAttribute('data-island','spore');await expect(page.locator('#world')).toHaveAttribute('data-side','back');
  await page.locator('#dossier-next').click();await page.locator('#dossier-select').click();await page.locator(`[data-dossier-option="${initial.npcs.nova.uid}"]`).click();
  await expect(page.locator('#world')).toHaveAttribute('data-island','home');await expect(page.locator('#world')).toHaveAttribute('data-side','front');
  expect(service.authority.state.player.uid).toBe(initial.player.uid);expect(writes).toEqual([]);expect(errors).toEqual([]);
 }finally{await page.close();await service.close();await rm(directory,{recursive:true,force:true});}
});

test('hosted world renders on phones, transfers authority, and runs with every browser closed',async({browser})=>{
 const directory=await mkdtemp(join(tmpdir(),'orbit-online-browser-')),token='browser-test-'.repeat(5),initial=createGame();initial.speed=0;
 const service=await createHttpService({directory,dist:resolve('.deploy/release/dist'),token,origin:'http://127.0.0.1:18191',initial});
 await new Promise(r=>service.server.listen(18191,'127.0.0.1',r));const errors=[];
 const a=await browser.newPage({viewport:{width:1440,height:1000},locale:'zh-CN'}),b=await browser.newPage({viewport:{width:390,height:844},locale:'zh-CN'});
 const deltas=[];let polls=0;a.on('request',request=>{if(request.url().endsWith('/api/state'))polls++;});
 a.on('websocket',socket=>socket.on('framereceived',event=>{const value=JSON.parse(event.payload);if(value.patch)deltas.push(value);}));
 try{
  for(const page of [a,b]){page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});page.on('console',m=>{if(m.type()==='error')console.error(m.text());});await page.goto('http://127.0.0.1:18191');await expect(page.locator('#loading')).toBeHidden({timeout:45000});await expect(page.locator('#online-status')).toHaveText('访客 · 只读');await expect(page.locator('#online-status')).toHaveAttribute('data-status','guest');await expect(page.locator('#online-status')).toHaveCSS('color','rgb(47, 111, 186)');}
  await a.locator('[data-speed="3"]').dispatchEvent('click');expect(service.authority.state.speed).toBe(0);
  const authBox=await a.locator('.online-controls').boundingBox(),labelBox=await a.locator('.location .eyebrow').boundingBox();
  expect(authBox.y+authBox.height).toBeLessThanOrEqual(labelBox.y);
  service.authority.state.player.side='back';
  await expect(a.locator('#world')).toHaveAttribute('data-side','back');
  service.authority.state.player.side='front';
  await expect(a.locator('#world')).toHaveAttribute('data-side','front');
  const originalPlayer=service.authority.state.player.uid;
  let viewerWrites=0;a.on('request',request=>{if(request.method()==='POST'&&new URL(request.url()).pathname.startsWith('/api/'))viewerWrites++;});
  await a.locator('#active-character').click();const watched=await a.locator('[data-character]').first().getAttribute('data-character');await a.locator('[data-character]').first().click();
  await expect(a.locator('#toast')).toContainText('视角');
  expect(service.authority.state.player.uid).toBe(originalPlayer);expect(viewerWrites).toBe(0);
  service.authority.state.npcs[watched].side='back';await expect(a.locator('#world')).toHaveAttribute('data-side','front');
  await expect(b.locator('#world')).toHaveAttribute('data-side','front');
  await a.locator('#dossier-select').click();await a.locator(`[data-dossier-option="${service.authority.state.npcs[watched].uid}"]`).click();await expect(a.locator('#world')).toHaveAttribute('data-side','back');
  service.authority.state.npcs[watched].side='front';await expect(a.locator('#world')).toHaveAttribute('data-side','back');
  await a.locator('#focus-player').click();await expect(a.locator('#world')).toHaveAttribute('data-side','front');
  for(const page of [a,b]){
   await page.locator('#operator-login').click();await page.locator('#operator-token').fill(token);await page.locator('#operator-form button[type="submit"]').click();await expect(page.locator('#operator-dialog')).not.toBeVisible();
   const heights=await page.locator('.online-controls button:visible:not(#operator-login)').evaluateAll(buttons=>buttons.map(button=>button.offsetHeight));
   expect(Math.max(...heights)-Math.min(...heights)).toBeLessThanOrEqual(1);
   await page.locator('#visitor-stats').click();await expect(page.locator('#visitor-results')).toBeVisible();await expect(page.locator('#visitor-total')).toHaveText('1');await expect(page.locator('#visitor-online')).toHaveText('2');await expect(page.locator('#visitor-operator')).toHaveText(page===a?'无人持有':'有人持有');
   await page.screenshot({path:`artifacts/visitors-${page===a?'desktop':'mobile'}.png`});await page.getByRole('button',{name:'关闭访问统计',exact:true}).click();
   await page.locator('#claim-control').click();await expect(page.locator('#online-status')).toHaveText('操作中');await expect(page.locator('#online-status')).toHaveAttribute('data-status','operator');await expect(page.locator('#online-status')).toHaveCSS('color','rgb(230, 126, 34)');
   await expect(page.locator('.online-controls')).toHaveClass(/is-operating/);await expect(page.locator('.identity-operating-label')).toBeVisible();await expect(page.locator('#claim-control')).toBeHidden();
   await expect(page.locator('.identity-operating-label small')).toHaveText('点击卡片退出操作模式');
   const statusGap=await page.locator('.identity-operating-label').evaluate(el=>{const label=el.getBoundingClientRect(),stats=document.querySelector('#visitor-stats').getBoundingClientRect(),rotated=getComputedStyle(document.querySelector('#app')).getPropertyValue('--rotated-layout').trim()==='1';return rotated?stats.top-label.bottom:stats.left-label.right;});expect(statusGap).toBeGreaterThanOrEqual(8);
   await expect.poll(()=>page.locator('#operator-login').evaluate(el=>{const r=el.getBoundingClientRect(),rotated=getComputedStyle(document.querySelector('#app')).getPropertyValue('--rotated-layout').trim()==='1';return rotated?r.y/r.height:r.x/r.width;})).toBe(-.5);
   await page.screenshot({path:`artifacts/control-inserted-${page===a?'desktop':'mobile'}.png`});
   await page.locator('#operator-login').click();await expect(page.locator('.online-controls')).not.toHaveClass(/is-operating/);await expect(page.locator('#operator-login')).toHaveAttribute('data-tier','vip');await expect(page.locator('#operator-dialog')).not.toBeVisible();
   await page.locator('#claim-control').click();await expect(page.locator('.online-controls')).toHaveClass(/is-operating/);
  }
  await expect(a.locator('#online-status')).toHaveText('已验证 · 只读');await expect(a.locator('#online-status')).toHaveAttribute('data-status','verified');await expect(a.locator('#online-status')).toHaveCSS('color','rgb(196, 154, 26)');
  await expect(a.locator('.online-controls')).not.toHaveClass(/is-operating/);await expect(a.locator('#claim-control')).toBeVisible();
  await a.locator('[data-speed="3"]').dispatchEvent('click');expect(service.authority.state.speed).toBe(0);
  await b.locator('[data-speed="1"]').click();await expect.poll(()=>service.authority.state.speed).toBe(1);
  await b.locator('#dossier-toggle').click();await b.locator('#autonomy').click();await expect.poll(()=>service.authority.state.autonomy.enabled).toBe(false);
  for(const [page,width] of [[a,1440],[b,390]]){
   await page.waitForTimeout(2200);
   const movingFrames=await page.locator('#world canvas').evaluate(canvas=>new Promise(resolve=>{
    const image=document.createElement('canvas');image.width=96;image.height=96;const ctx=image.getContext('2d'),hashes=[];
    function sample(){ctx.drawImage(canvas,0,0,96,96);const pixels=ctx.getImageData(0,0,96,96).data;let hash=2166136261;for(let i=0;i<pixels.length;i+=4)hash=Math.imul(hash^pixels[i],16777619);hashes.push(hash);if(hashes.length===30)resolve(new Set(hashes).size);else requestAnimationFrame(sample);}requestAnimationFrame(sample);
   }));expect(movingFrames).toBeGreaterThan(15);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   const colors=await page.locator('#world canvas').evaluate(canvas=>{const c=document.createElement('canvas');c.width=canvas.width;c.height=canvas.height;const ctx=c.getContext('2d');ctx.drawImage(canvas,0,0);const d=ctx.getImageData(0,0,c.width,c.height).data,s=new Set();for(let i=0;i<d.length;i+=64)s.add(`${d[i]},${d[i+1]},${d[i+2]}`);return s.size;});expect(colors).toBeGreaterThan(100);
   await page.screenshot({path:`artifacts/online-${width}.png`});
  }
  expect(deltas.length).toBeGreaterThan(2);expect(deltas.every(value=>!Object.hasOwn(value,'state'))).toBe(true);
  expect(polls).toBe(0);
  await a.context().setOffline(true);await expect(a.locator('#online-status')).toContainText('连接中断',{timeout:20000});await expect(a.locator('#online-status')).toHaveAttribute('data-status','offline');
  await a.context().setOffline(false);await expect(a.locator('#online-status')).toHaveText('已验证 · 只读',{timeout:20000});await expect(a.locator('#online-status')).toHaveAttribute('data-status','verified');
  const before=service.authority.state.minute;await a.close();await b.close();await new Promise(r=>setTimeout(r,1500));expect(service.authority.state.minute).toBeGreaterThan(before);expect(errors).toEqual([]);
 }finally{await a.close();await b.close();await service.close();await rm(directory,{recursive:true,force:true});}
});
