import {createElement,Orbit,ScanLine,ArrowRight,X,ShieldCheck} from 'lucide';
import {translateText,localizePage} from './i18n.js';

const symbol=icon=>{const el=createElement(icon);el.setAttribute('aria-hidden','true');return el.outerHTML;};
const face=()=>`<span class="identity-art"><span class="identity-brand">${symbol(Orbit)}<span>ORBIT LIFE</span></span><span class="identity-main"><span class="identity-seal">${symbol(ScanLine)}</span><span><strong class="identity-tier">访客</strong><small class="identity-subtitle">星际通行证</small></span></span><span class="identity-footer"><span>OL / 001</span><span class="identity-bars" aria-hidden="true"></span></span></span>`;
const ease='cubic-bezier(0.23, 1, 0.32, 1)';

export function createIdentityCard({online,container,toast}){
 const bar=document.createElement('div');bar.className='online-controls';
 bar.innerHTML=`<div class="identity-paper"><div class="identity-caption"><span id="identity-hint">点击验证</span><span id="online-status" role="status">连接中</span></div><div class="identity-actions"><button id="claim-control" hidden>获取操作权</button></div></div><div class="identity-slot"><button id="operator-login" class="identity-card" data-tier="guest" aria-label="验证身份卡">${face()}</button><span class="identity-operating-label" role="status"><strong>操作中</strong><small>点击卡片退出操作模式</small></span></div>`;
 container.prepend(bar);
 const dialog=document.createElement('dialog');dialog.id='operator-dialog';dialog.setAttribute('aria-label',translateText('身份验证'));
 dialog.innerHTML=`<div class="identity-flight"><div class="identity-turn"><div class="identity-front identity-card" data-tier="guest">${face()}</div><div class="identity-back identity-card"><form id="operator-form"><div class="identity-brand">${symbol(Orbit)}<span>ORBIT LIFE / ID</span></div><h2>身份验证</h2><label for="operator-token">Token</label><input id="operator-token" type="password" required autocomplete="off" maxlength="256" spellcheck="false"><button type="submit"><span>验证</span>${symbol(ArrowRight)}</button></form></div></div></div><p id="identity-result" role="status"></p><button id="operator-close" type="button" aria-label="关闭身份卡">${symbol(X)}</button>`;
 // The modal follows the game's orientation, including its portrait-screen rotation.
 document.body.append(dialog);
 const card=bar.querySelector('#operator-login'),front=dialog.querySelector('.identity-front'),back=dialog.querySelector('.identity-back'),flight=dialog.querySelector('.identity-flight'),turn=dialog.querySelector('.identity-turn');
 const form=dialog.querySelector('form'),input=dialog.querySelector('input'),close=dialog.querySelector('#operator-close'),result=dialog.querySelector('#identity-result');
 let authenticated=false,operating=false,phase='docked';
 function scaleArt(el){(el===front?dialog:el).style.setProperty('--identity-scale',el.clientWidth/80);}
 const sizing=new ResizeObserver(entries=>{for(const {target} of entries)scaleArt(target);});
 sizing.observe(card);sizing.observe(front);scaleArt(card);
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 function setPhase(next){phase=next;dialog.dataset.phase=next;}
 function setEditing(enabled){form.inert=!enabled;input.disabled=!enabled;form.querySelector('button[type=submit]').disabled=!enabled;}
 function paint(el,vip){
  el.dataset.tier=vip?'vip':'guest';
  el.querySelector('.identity-tier').textContent=translateText(vip?'金卡 VIP':'访客');
  el.querySelector('.identity-subtitle').textContent=translateText(vip?'身份已验证':'星际通行证');
  el.querySelector('.identity-seal').innerHTML=symbol(vip?ShieldCheck:ScanLine);
 }
 async function animate(el,frames,duration=280){
  const animation=el.animate(reduced()?[{opacity:.6},{opacity:1}]:frames,{duration:reduced()?100:duration,easing:ease,fill:'both'});
  await animation.finished;animation.commitStyles();animation.cancel();
 }
 function dockTransform(lift=1){
  const target=card.getBoundingClientRect(),center=dialog.getBoundingClientRect();
  const rotated=dialog.dataset.rotated==='true',dx=target.x+target.width/2-center.x-center.width/2,dy=target.y+target.height/2-center.y-center.height/2;
  const scale=(rotated?target.height:target.width)/dialog.offsetWidth*lift;
  return `translate(${rotated?dy:dx}px,${rotated?-dx:dy}px) scale(${scale})`;
 }
 function syncOrientation(){dialog.dataset.rotated=String(getComputedStyle(document.querySelector('#app')).getPropertyValue('--rotated-layout').trim()==='1');}
 window.addEventListener('resize',syncOrientation);
 async function flip(showBack){
  back.inert=true;front.inert=true;
  await animate(turn,[{transform:showBack?'rotateX(0deg)':'rotateX(180deg)'},{transform:showBack?'rotateX(180deg)':'rotateX(0deg)'}]);
  turn.style.transform=showBack?'rotateX(180deg)':'rotateX(0deg)';
  back.inert=!showBack;front.inert=showBack;
  back.setAttribute('aria-hidden',String(!showBack));front.setAttribute('aria-hidden',String(showBack));
 }
 async function dock(){
  if(phase==='docked'||phase==='returning'||phase==='submitting')return;
  const wasBack=phase==='editing';setPhase('returning');close.disabled=true;result.textContent='';
  if(wasBack)await flip(false);
  paint(card,authenticated);paint(front,authenticated);
  await animate(flight,[{transform:'none'},{transform:dockTransform(1.08)}]);
  await animate(flight,[{transform:dockTransform(1.08)},{transform:dockTransform()}],160);
  dialog.close();bar.classList.remove('identity-in-flight');input.value='';setPhase('docked');card.focus({preventScroll:true});
 }
 card.addEventListener('keydown',()=>card.classList.remove('identity-pointer-focus'));
 card.onclick=async event=>{
  if(phase!=='docked')return;
  if(operating){card.disabled=true;try{await online.release();}catch(error){toast(error.message);}finally{card.disabled=false;}return;}
  card.classList.toggle('identity-pointer-focus',event.detail>0);
  paint(front,authenticated);result.textContent='';input.value='';setEditing(false);back.inert=true;
  turn.style.transform='rotateX(0deg)';flight.style.transform='none';flight.style.opacity='1';close.disabled=true;
  syncOrientation();setPhase('lifting');dialog.showModal();scaleArt(front);bar.classList.add('identity-in-flight');localizePage();
  await animate(flight,[{transform:dockTransform()},{transform:'none'}]);flight.style.transform='none';
  if(!authenticated){await flip(true);setEditing(true);setPhase('editing');input.focus({preventScroll:true});}
  else{setPhase('viewing');front.inert=false;front.setAttribute('aria-hidden','false');back.setAttribute('aria-hidden','true');}
  close.disabled=false;
 };
 close.onclick=dock;
 dialog.addEventListener('cancel',event=>{event.preventDefault();if(['editing','viewing'].includes(phase))void dock();});
 form.onsubmit=async event=>{
  event.preventDefault();if(phase!=='editing')return;
  const token=input.value;input.value='';setPhase('submitting');setEditing(false);close.disabled=true;form.setAttribute('aria-busy','true');
  let error;
  try{await online.login(token);}catch(failure){error=failure;}
  form.removeAttribute('aria-busy');
  paint(front,authenticated);result.textContent=translateText(error?error.message:'验证成功');
  await flip(false);setPhase('result');
  await new Promise(resolve=>setTimeout(resolve,reduced()?350:900));
  await dock();
  toast(error?error.message:'验证成功，点击获取操作权后可以操作。');
 };
 const claim=bar.querySelector('#claim-control');
 claim.onclick=async()=>{claim.disabled=true;try{await online.claim();}catch(error){toast(error.message);}finally{claim.disabled=false;}};
 return {setStatus(value){
  authenticated=value.authenticated;
  const status=!value.connected?'offline':value.error?'error':value.canOperate?'operator':authenticated?'verified':'guest';
  const el=bar.querySelector('#online-status');el.dataset.status=status;
  el.textContent=translateText(status==='error'?value.error:{offline:'连接中断 · 只读',operator:'操作中',verified:'已验证 · 只读',guest:'访客 · 只读'}[status]);
  bar.querySelector('#identity-hint').textContent=translateText(authenticated?'身份已验证':'点击验证');
  operating=value.connected&&value.canOperate;
  if(operating&&!bar.classList.contains('is-operating'))bar.style.width=`${bar.offsetWidth}px`;
  else if(!operating)bar.style.width='';
  bar.classList.toggle('is-operating',operating);
  if(operating)bar.style.setProperty('--insert-x',`${-card.parentElement.offsetLeft-card.offsetWidth/2}px`);
  bar.querySelector('.identity-operating-label strong').textContent=translateText('操作中');
  bar.querySelector('.identity-operating-label small').textContent=translateText('点击卡片退出操作模式');
  claim.hidden=!authenticated||operating;
  card.setAttribute('aria-label',translateText(operating?'退出操作模式':authenticated?'查看身份卡':'验证身份卡'));
  paint(card,authenticated);
 }};
}
