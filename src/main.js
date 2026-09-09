import {applyCommand} from './game-commands.js';
import {createPresentation} from './presentation.js';
import './online.css';
import {createOnlineClient} from './online-client.js';
import {displayNumber} from './display-number.js';
import {UFO_WEAR_PER_FLIGHT,backDiscovered,ufoDefinition,shipFoodStatus} from './space-logistics.js';
import {actionAccessError} from './action-access.js';
import {islandCatalog,islandDefinition,discovered,civilizationError,voyageError,starVoyageError} from './civilization.js';
import {islandOf} from './island.js';
import {explorationContent} from './exploration-panel.js';
import {WONDER_OPTIONS,WONDER_ACTIONS,wonderStatus} from './wonders.js';
import {PRAYER_RULES,PRAYER_MUTATIONS,isNether,isRadiant,isDual,prayerRaceName} from './prayer.js';
import {SIDES,sideOf,sameSide} from './island.js';
import {createPersistence} from './persistence.js';
import {HEAD_SHAPE} from './genetics.js';

import {canWorkAt} from './simulation.js';
import {studyFacilitySkill,FOUNDATION_SKILLS,FOUNDATION_FOR,MAJORS,higherEducation,studyName,educationRequirements,EDUCATION_LEVELS,educationLevel,educationWage,isLearner,studyInterest} from './education.js';
import {projectActions,workbench} from './settlements.js';
import {materialSource} from './plants.js';
import {CROPS,plantStatus,plantActionError,harvestAmount,harvestPrice,MUSHROOM_SEED_COST} from './plants.js';
import {getWeather} from './weather.js';
import {BookOpen,NotebookPen,ChevronLeft,ChevronRight,CloudFog,CloudDrizzle,Wind} from 'lucide';
import './style.css';
import './resident-panel.css';
import './floating-island.css';
import {createFloatingIsland} from './floating-island.js';
import {PictureInPicture2,ArrowLeft} from 'lucide';
import {createElement,Orbit,Sun,Pause,Play,FastForward,Sparkles,Hammer,Save,Settings,CircleHelp,CloudSun,House,Flower2,Radio,Plus,Minus,Scan,LocateFixed,VolumeX,Smile,Compass,Heart,Coffee,HeartPulse,Users,BriefcaseBusiness,PackageOpen,ArrowUpRight,X,MousePointer2,ArrowRight,Move,GripVertical,Check,Frown,Volume2,TriangleAlert,Utensils,Zap,MessagesSquare,Droplets,Armchair,Atom,Sprout,BedDouble,Music2,Telescope,Gem,TreePine,Lamp,Footprints,Moon,Gift,Coins} from 'lucide';
import {createWorld} from './world.js';
import {interactionError,NEEDS,neighbors,birthDecision,gameMinutes,CAREERS,missingCareerSkills,careerEntryMessage,careerDefinition,cropDefinition,normalizeConfig,validConfig,MUTATION_PARTS,ITEMS,ACTIONS,createGame,tick,canAffordAction} from './simulation.js';
import {GENDERS,SKILLS,STAGES,lifeStage,skillProgress} from './characters.js';

const $=s=>document.querySelector(s);
const icons={BookOpen,NotebookPen,ChevronLeft,ChevronRight,CloudFog,CloudDrizzle,Wind,Orbit,Sun,Pause,Play,FastForward,Sparkles,Hammer,Save,Settings,CircleHelp,CloudSun,House,Flower2,Radio,Plus,Minus,Scan,LocateFixed,VolumeX,Smile,Compass,Heart,Coffee,HeartPulse,Users,BriefcaseBusiness,PackageOpen,ArrowUpRight,X,MousePointer2,ArrowRight,Move,GripVertical,Check,Frown,Volume2,TriangleAlert,Utensils,Zap,MessagesSquare,Droplets,Armchair,Atom,Sprout,BedDouble,Music2,Telescope,Gem,TreePine,Lamp,Footprints,Moon,Gift,Coins};
const icon=(name,cls='')=>{const el=createElement(icons[name]);el.setAttribute('class',`icon ${cls}`);el.setAttribute('aria-hidden','true');return el.outerHTML;};
Object.assign(icons,{PictureInPicture2,ArrowLeft});
const hosted=import.meta.env.VITE_SERVER_AUTHORITY==='1';
const persistence=hosted?null:createPersistence();let game;
const presentation=hosted?createPresentation():null;let visualGame;
const online=hosted?createOnlineClient({onState(next){
 if(!game)return;const previous=game;
 if(Object.hasOwn(islandCatalog(next),previous.viewIsland)){next.viewIsland=previous.viewIsland;next.viewSide=previous.viewSide;}
 if(previous.player.uid!==next.player.uid||islandOf(previous.player)!==islandOf(next.player)||sideOf(previous.player)!==sideOf(next.player)){next.viewIsland=islandOf(next.player);next.viewSide=sideOf(next.player);}
 game=next;presentation.push(next);
},onStatus(value){const el=document.querySelector('#online-status');if(!el)return;el.textContent=!value.connected?'连接中断 · 只读':value.error|| (value.canOperate?'操作中':value.authenticated?'已验证 · 只读':'访客 · 只读');document.querySelector('#claim-control').hidden=!value.authenticated;document.querySelector('#operator-login').hidden=value.authenticated;document.querySelector('#operator-logout').hidden=!value.authenticated;if(!value.canOperate&&build){build=false;cancelPlacement();document.querySelector('#build-button').classList.remove('active');}}}):null;
async function command(name,...args){
 try{return hosted?await online.mutate('/api/command',{name,args,view:{island:game.viewIsland,side:game.viewSide}}):applyCommand(game,{name,args});}
 catch(error){toast(error.message);return{ok:false,message:error.message};}
}
const enqueue=async(_game,...args)=>command('enqueue',...args);
const enqueueStudy=async(_game,...args)=>command('enqueueStudy',...args);
const destroyIsland=async(_game,...args)=>command('destroyIsland',...args);
const randomizeHeads=async(_game,...args)=>command('randomizeHeads',...args);
const takeOver=async(_game,...args)=>command('takeOver',...args);
const switchControl=async(_game,...args)=>command('switchControl',...args);
const cancelAction=async(_game,...args)=>command('cancelAction',...args);
const buyItem=async(_game,...args)=>command('buyItem',...args);
const sellItem=async(_game,...args)=>(await command('sellItem',...args)).ok;
const setCareer=async(_game,...args)=>(await command('setCareer',...args)).ok;
const setAutonomy=async(_game,...args)=>command('setAutonomy',...args);
const updateResident=async(_game,...args)=>command('updateResident',...args);
const loadShipFood=async(_game,...args)=>command('loadShipFood',...args);
const loadShipMaterials=async(_game,...args)=>command('loadShipMaterials',...args);
const unloadShipMaterials=async(_game,...args)=>command('unloadShipMaterials',...args);
$('#app').innerHTML='<div id="loading"><h2>正在读取星湾存档</h2><p>从服务器恢复你的生活进度…</p></div>';
try{game=hosted?await online.load():await persistence.load();}catch(error){
 console.error('游戏存档读取失败',error);
 $('#app').innerHTML='<div id="loading"><h2>暂时无法读取存档</h2><p>请检查游戏服务后重试，现有存档不会被覆盖。</p><button id="retry-load">重新读取</button></div>';
 $('#retry-load').onclick=()=>location.reload();throw error;
}
let navigationIsland=game.viewIsland,lastViewedIsland=game.viewIsland;
if(hosted)presentation.push(game);
let lastLifeState='';let world,tab='needs',build=false,speedBeforeBuild=1,pack='全部',selectedItem=null,context=null,toastTimer,portraits={},portraitKey='',selectedResident='player',lastMajorEvents='',lastPanel='',saveBlocked=false,epochRestarting=false;
const fmt=n=>Math.floor(n).toLocaleString('zh-CN');
const buttons=(items)=>items.map(([label,i,attr])=>`<button ${attr} title="${label}" aria-label="${label}">${icon(i)}</button>`).join('');

$('#app').innerHTML=`
 <div id="world" aria-label="可交互的外星家园 3D 场景"></div>
 <header class="topbar">
  <a class="brand" href="/" aria-label="星外日常">${icon('Orbit')}<div><b>星外日常<span>ORBIT LIFE</span></b><small>在宇宙的一角，好好生活。</small></div></a>
  <div class="time-control"><div class="day">${icon('Sun')}<span id="day">第 ${game.day} 天</span><b id="clock">08:30</b></div><div class="speed-buttons">${buttons([['暂停','Pause','data-speed="0"'],['正常速度','Play','data-speed="1"'],['三倍速度','FastForward','data-speed="3"']])}</div></div>
  <div class="top-actions"><div class="wallet">${icon('Sparkles')}<strong id="money">2,400</strong><small>星币</small></div><button id="build-button" class="build-button" aria-label="建造模式">${icon('Hammer')}<span>建造模式</span><kbd>B</kbd></button><button class="icon-button" id="config" title="参数配置" aria-label="参数配置">${icon('Settings')}</button><button class="icon-button" id="save" title="保存游戏" aria-label="保存游戏">${icon('Save')}</button><button class="icon-button" id="help" title="操作指南" aria-label="操作指南">${icon('CircleHelp')}</button></div>
 <span id="save-status" title="每 60 秒保存到服务器；离开页面和刷新前也会保存。"></span></header>
 <main class="scene-ui">
  <div class="location"><span class="eyebrow">KEPLER–186F / 居住区 07</span><h1>露米纳星湾<span class="live-dot"></span></h1><p id="weather" aria-label="当前天气"></p></div>
  <div class="locations" aria-label="星岛导航"></div>
  <aside id="life-alert" hidden></aside><aside id="journal" class="journal"><div class="card-label">${icon('Radio')} 星湾电台 <span class="live-dot"></span></div><div id="journal-text"></div><small id="journal-time">最近重大事件</small></aside>
  <div id="queue-wrap"><div class="queue-label"><span>行动队列</span><small>点击 × 取消</small></div><div id="queue"></div><p id="autonomy-reason" hidden></p></div>
  <div class="camera-controls"><div class="island-tools"><span id="island-side"></span><button id="flip-island" aria-label="翻转星岛">${icon('Orbit')} 翻转星岛</button><button id="travel-menu" aria-label="选择星门目的地">${icon('Compass')} 星门航路</button></div><div class="view-tools">${buttons([['拉近视角','Plus','id="zoom-in"'],['拉远视角','Minus','id="zoom-out"'],['重置视角','Scan','id="reset-view"'],['跟随凯伊','LocateFixed','id="focus-player"'],['环境音乐','VolumeX','id="sound"']])}</div></div>
  <div class="scene-caption"><span class="live-dot"></span> 生活正在发生 <i>·</i> 点击人物或物品互动</div>
 </main>
 <div id="build-hint" hidden>${icon('Move')} 点击地面摆放 <span>R 旋转</span><span>Esc 取消</span><button id="cancel-placement">取消</button></div>
 <section class="dashboard">
 <div id="dashboard-resize-handle" class="dashboard-resize-handle" role="separator" aria-orientation="vertical" aria-valuemin="300" aria-valuemax="760" aria-valuenow="380" aria-label="调整人物资料卡宽度" title="拖动调整人物资料卡宽度">${icon('GripVertical')}</div><div class="profile"><div id="character-switcher" class="character-switcher" role="menu" aria-label="选择主控居民" hidden></div><button id="active-character" class="avatar-wrap" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="切换主控居民"><img id="player-portrait" alt="凯伊的外星人头像"/><span class="mood-dot">✦</span></button><div class="profile-copy"><span class="eyebrow" id="player-bio">你的星际居民</span><h2 id="player-name">凯伊 <span>KAÏ</span></h2><span id="mood" class="mood">${icon('Smile')} 心情不错</span></div><div class="profile-traits"><span>${icon('Compass')} 好奇心旺盛</span><span>${icon('Heart')} 热爱生活</span></div><div class="current-activity"><span id="activity">${icon('Coffee')} 享受此刻的宁静</span><button id="autonomy" role="switch" aria-label="自主行为" aria-checked="true" title="自主行为已开启 · 点击关闭">自主</button></div></div>
  <div class="details"><nav class="panel-tabs"><button class="active" data-tab="needs">${icon('HeartPulse')} 需求</button><button data-tab="skills">${icon('Sparkles')} 技能</button><button data-tab="resident">${icon('Smile')} 人物</button><button data-tab="relations">${icon('Users')} 关系</button><button data-tab="career">${icon('BriefcaseBusiness')} 职业</button><button data-tab="life">${icon('Sprout')} 生命</button><button data-tab="exploration">${icon('Compass')} 探索</button><button data-tab="items">${icon('PackageOpen')} 物品包</button><span id="panel-tag">一切都刚刚好</span></nav><div id="panel-content"></div></div>
  <div class="neighbors"><div class="card-label">你的邻居 <span>4 位居民</span></div><div id="neighbor-portraits"></div><p>每个星球，都有值得认识的人。</p><button id="all-neighbors">查看关系 ${icon('ArrowUpRight')}</button></div>
 </section>
 <div id="tooltip" hidden></div><div id="context-menu" hidden></div><div id="toast" role="status" hidden></div>
 <div id="loading"><div class="loading-orbit">${icon('Orbit')}</div><h2>正在降落露米纳星湾</h2><p>唤醒居民，点亮蘑菇，准备新的日常…</p></div>
  <dialog id="help-dialog"><button class="dialog-close" aria-label="关闭指南">${icon('X')}</button><span class="eyebrow">欢迎来到露米纳</span><h2>你的生活，由你安排。</h2><p>你是凯伊，一位刚刚搬来星湾的外星居民。照顾自己、认识邻居、布置家园，再找到一份喜欢的工作。</p><div class="help-grid"><div>${icon('MousePointer2')}<b>点一点，开始生活</b><p>点击人物或物品选择互动；点击空地行走。可以连续安排 6 个行动。</p></div><div>${icon('HeartPulse')}<b>照顾六种需求</b><p>吃饭、星眠、净化、休息、跳舞与社交，会影响你的心情。</p></div><div>${icon('Hammer')}<b>打造异星小家</b><p>B 打开建造，选择家具后点击空地摆放。R 旋转，Esc 取消。建造中点击家具可出售。</p></div><div>${icon('BriefcaseBusiness')}<b>找到银河里的工作</b><p>职业页选择方向，在研究台完成班次赚取星币。入职和晋升都需要达到对应技能门槛。</p></div></div><div class="shortcut-row"><span><kbd>空格</kbd> 暂停</span><span><kbd>1 / 3</kbd> 时间速度</span><span>右键拖动旋转 · 中键平移 · 滚轮缩放</span></div><p class="save-note">每 60 秒保存到服务器文件，离开页面或刷新前也会保存。不同浏览器共享同一份进度；右上角显示保存状态。</p><button class="primary dialog-close">开始我的异星日常 ${icon('ArrowRight')}</button></dialog>
 <dialog id="config-dialog" aria-labelledby="config-title"><button class="dialog-close" aria-label="关闭参数配置">${icon('X')}</button><span class="eyebrow">星湾运行规则</span><h2 id="config-title">参数配置</h2><p>这里展示当前运行中的时间、生命、需求、动作、职业、经济与作物参数。</p><div id="config-content"></div><div class="config-dialog-actions"><button id="restart-epoch" class="island-destroy" type="button">重启纪元（删档）</button><button id="config-project-default" type="button">永久覆盖项目配置</button><button class="primary dialog-close" type="button">关闭参数配置</button></div></dialog>
`;

function toast(message){$('#toast').innerHTML=`${icon('Sparkles')} ${message}`;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,3500);}
async function save(manual=false,leaving=false){
 if(hosted){if(!manual)return true;try{await online.mutate('/api/checkpoint');toast('服务器进度已保存。');return true;}catch(error){toast(error.message);return false;}}
 if(epochRestarting)return false;
 if(saveBlocked)return false;
 $('#save-status').dataset.state='saving';
 try{
  const saved=await persistence.save(game,{leaving});if(saveBlocked)return false;
  if(saved){const time=new Date(saved.savedAt);$('#save-status').textContent=`${manual?'已保存':'已自动保存'} · ${time.toLocaleTimeString('zh-CN',{hour12:false})}`;$('#save-status').dataset.savedAt=String(time.getTime());}
  $('#save-status').dataset.state='saved';if(manual)toast('游戏已保存到服务器，下次继续你的星际日常。');return true;
 }catch(error){
  console.error('游戏保存失败',error);$('#save-status').dataset.state='error';
  if(error.status===409){
   saveBlocked=true;game.speed=0;
   $('#save-status').innerHTML='其他页面已有更新进度 · <button id="reload-save">载入最新存档</button>';
   $('#reload-save').onclick=()=>location.reload();toast('已暂停：请载入最新存档后继续，避免覆盖其他页面的进度。');
  }else{$('#save-status').textContent='保存失败 · 请勿关闭页面';if(manual)toast('未能保存进度，请勿关闭页面。');}
  return false;
 }
}
$('#save-status').textContent=hosted?'服务器持续运行 · 每 5 秒存档':'已恢复服务器存档 · 每分钟自动保存';
const floatingButton=document.createElement('button');floatingButton.id='float-island';floatingButton.title='开启浮窗';floatingButton.setAttribute('aria-label','开启浮窗');floatingButton.innerHTML=icon('PictureInPicture2');floatingButton.disabled=true;$('.view-tools').append(floatingButton);
$('#save-status').dataset.state='ready';
setInterval(()=>save(),60000);
document.addEventListener('visibilitychange',()=>{if(document.hidden)save(false,true);});
window.addEventListener('pagehide',()=>save(false,true));
window.addEventListener('beforeunload',()=>save(false,true));
if(import.meta.hot)import.meta.hot.on('vite:beforeFullReload',()=>save(false,true));

if(hosted){
 const bar=document.createElement('div');bar.className='online-controls';bar.innerHTML='<span id="online-status">连接中</span><button id="operator-login">验证 Token</button><button id="claim-control" hidden>获取操作权</button><button id="operator-logout" hidden>退出验证</button>';$('#app').append(bar);
 const dialog=document.createElement('dialog');dialog.id='operator-dialog';dialog.innerHTML='<form id="operator-form"><h2>操作验证</h2><label>Token<input id="operator-token" type="password" required autocomplete="off" maxlength="256"></label><p id="operator-error" role="alert"></p><button type="button" id="operator-close">取消</button><button type="submit">验证</button></form>';$('#app').append(dialog);
 $('#operator-login').onclick=()=>dialog.showModal();$('#operator-close').onclick=()=>{dialog.close();$('#operator-token').value='';};
 $('#operator-form').onsubmit=async event=>{event.preventDefault();const input=$('#operator-token'),token=input.value;input.value='';try{await online.login(token);dialog.close();toast('验证成功，点击获取操作权后可以操作。');}catch(error){$('#operator-error').textContent=error.message;}};
 $('#claim-control').onclick=()=>online.claim().catch(error=>toast(error.message));$('#operator-logout').onclick=()=>online.logout().catch(error=>toast(error.message));online.start();
}
const flightDialog=document.createElement('dialog');flightDialog.id='flight-dialog';$('#app').append(flightDialog);
const mutationControls='[data-speed],#autonomy,[data-character],[data-inherit],#new-life,[data-cancel],[data-action],[data-career],[data-item],[data-destroy-island],[data-star-voyage],[data-load-ship],[data-load-materials],[data-unload-materials],[data-sell],#work,#study,#save,#config-reset,#restart-epoch,#config-project-default,#build-button,#randomize-heads,#study-focus,#family-desire,#confirm-flight,#config-form input,#config-form button[type="submit"],#resident-form input,#resident-form select,#resident-form button[type="submit"]';
if(hosted)for(const type of ['click','change','submit'])$('#app').addEventListener(type,event=>{if(!online.canOperate&&(event.target.closest(mutationControls)||type==='submit'&&['resident-form','config-form'].includes(event.target.id))){event.preventDefault();event.stopImmediatePropagation();toast('当前为只读，请先获取操作权');}},true);
function openFlight(id,shipId=null){
 const portal=game.objects.find(o=>o.type==='portal'&&sameSide(o,game.player));
 const passengers=neighbors(game).filter(n=>sameSide(n,game.player)&&n.queue.length<6&&!n.queue.some(q=>['voyage','boardUfo'].includes(q.type)));
 flightDialog.innerHTML=`<button class="dialog-close" aria-label="关闭登船安排">${icon('X')}</button><h2>前往${islandDefinition(game,id).name}</h2><p>由${game.player.name}发起，UFO 自动导航；勾选随行居民（含幼体）。乘客完成当前队列后登船。</p><div class="flight-passengers">${passengers.map(n=>`<label><input type="checkbox" value="${n.id}"/> ${n.name} · ${prayerRaceName(n)||'星湾居民'} · ${n.queue.length?'先完成 '+n.queue.length+' 个安排':'可登船'}</label>`).join('')||'<p>附近暂无可邀请乘客，可独自出航。</p>'}</div><p id="flight-reason"></p><button class="primary" id="confirm-flight">安排登船</button>`;
 const selection=()=>[...flightDialog.querySelectorAll('input:checked')].map(el=>el.value);
 const update=()=>{const error=portal?voyageError(game,game.player,game.skills,id,selection().length+1,null,shipId):'请在当前岛面放置跃迁星门作为停机坪。';flightDialog.querySelector('#flight-reason').textContent=error||`共 ${selection().length+1} 人；尽量装入往返食物；当前星球有星厨时须备齐本航段食物；无星厨时每缺 1 份，每人扣 10 营养、5 能量，取消不扣。`;flightDialog.querySelector('#confirm-flight').disabled=!!error;};
 flightDialog.onchange=update;flightDialog.querySelector('#confirm-flight').onclick=async()=>{const result=await enqueue(game,'voyage',portal.id,undefined,null,id,selection(),shipId);if(result.ok){flightDialog.close();toast('已安排集合登船，乘客先完成已有行动。');refresh();}else{toast(result.message);update();}};
 update();flightDialog.showModal();
}
function showUfo(id){
 const previous=$('.ufo-dialog');if(previous){previous.close();previous.remove();}
 const ship=game.space.ships.find(s=>s.id===id);if(!ship)return;const def=ufoDefinition(ship),dialog=document.createElement('dialog');dialog.className='ufo-dialog';
 dialog.innerHTML=`<button class="dialog-close" aria-label="关闭 UFO">${icon('X')}</button><h2>${def.name}</h2><p>悬浮停靠于${islandDefinition(game,ship.island).name} · ${SIDES[ship.side]}</p><p>${def.seats} 个座位 · 耐久 ${ship.durability}/100 · 可达科技 ${def.range} 级星岛 · 舱内食物 ${ship.food} / ${shipFoodStatus(ship).capacity} 份 · ${shipFoodStatus(ship).full?'补给满载':'补给未满'}</p><p>每航段消耗 10 耐久，探索需至少 20 点，返航需至少 10 点；耗尽后到站回收。满载食物可供全船乘客往返；当前星球有在世星厨时，缺粮禁止出航；无星厨时每缺 1 份食物，每位乘客扣 10 营养、5 能量。</p><button class="island-launch" data-load-ship="${ship.id}">从岛上库存装载食物</button><p>${ship.reservedBy?'已安排航行，正在等待乘客登船。':'选择目的地后安排乘客。'}</p>${Object.entries(islandCatalog(game)).filter(([destination])=>destination!==ship.island&&discovered(game,destination)).map(([destination,island])=>{const error=voyageError(game,game.player,game.skills,destination,1,null,ship.id);return `<button class="island-launch" data-voyage="${destination}" data-ship="${ship.id}" ${error?'disabled':''} title="${error||''}">前往${island.name}${error?` · ${error}`:''}</button>`;}).join('')}`;
 const cargo=game.space.cargo[id]??0,stock=game.space.materials[ship.island]??0,max=Math.min(stock,def.cargoCapacity-cargo),locked=ship.reservedBy!==null||!sameSide(ship,game.player);
 const cargoSection=document.createElement('section');cargoSection.className='cargo-controls';cargoSection.innerHTML=`<h3>植生复材货舱</h3><p>已装 ${cargo} / ${def.cargoCapacity} 份 · 本岛库存 ${stock} 份</p><label>装载数量 <input id="cargo-amount" type="number" min="1" max="${max}" step="1" value="${Math.min(10,max)}" ${locked||max<1?'disabled':''}/></label><div><button data-load-materials="${id}" ${locked||max<1?'disabled':''}>装载材料</button><button data-unload-materials="${id}" ${locked||!cargo?'disabled':''}>卸回本岛</button></div><small>材料随飞船运输，抵达后自动卸入目标星岛仓库。货舱与乘客座位、食物补给独立。</small>`;
 dialog.querySelector('[data-load-ship]').after(cargoSection);
 $('#app').append(dialog);dialog.addEventListener('click',event=>{if(event.target.closest('[data-voyage]'))dialog.close();});dialog.onclose=()=>dialog.remove();dialog.showModal();
}
function changeTab(next){tab=next;document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));lastPanel='';renderPanel();}
function relationName(n){return n>=70?'挚友':n>=35?'朋友':'初识';}
function activeResidentId(){return game.controlledId??'player';}
function resident(){return game.player;}
function residentPicker(){return '';}
function careerSkillsText(skills,id,level=1){const requirements=careerDefinition(game,id).levels[level-1]?.skills||{};return Object.entries(requirements).map(([key,required])=>`${SKILLS[key].name} ${Math.floor(skills[key]??0)}/${displayNumber(required)}`).join(' · ')||'无';}
function careerMissingText(skills,id,level=1){return missingCareerSkills(skills,id,level,game.config).map(({key,current,required})=>`${SKILLS[key].name} ${Math.floor(current)}/${displayNumber(required)}`).join('、');}
function careerRequirementsText(id,level=1){const requirements=careerDefinition(game,id).levels[level-1]?.skills||{};return Object.entries(requirements).map(([key,required])=>`${SKILLS[key].name} ${displayNumber(required)}`).join(' · ')||'无';}
function configInput(path,value,min=0,max=1e9,step=1){return `<input class="config-input" data-config-path="${path}" type="number" min="${min}" max="${max}" step="${step}" value="${value}" required/>`;}
function actionLabel(type){const action=ACTIONS[type],cost=game.config?.actionCosts?.[type];return cost===undefined?action.name:action.name.replace(/\d+(?=\s*星币)/,String(cost));}
function renderConfig(){
 const config=game.config,stages=config.lifeStages;
 const stageRows=[['infant',null,'infantEnd','幼体只能接受照料'],['child','infantEnd','childEnd','可进行对应阶段的日常活动'],['teen','childEnd','teenEnd','可进行对应阶段的日常活动'],['adult','teenEnd','adultEnd','可进行对应阶段的日常活动'],['elder','adultEnd','elderEnd',`${stages.elderEnd} 星岁时寿终`]].map(([key,startKey,endKey,description])=>{const start=startKey?stages[startKey]:0,end=endKey==='elderEnd'?'': '&lt;';return `<div class="config-row"><span>${STAGES[key]}<small>${startKey?`从 ${stages[startKey]} 星岁开始`:'从出生开始'}</small></span><label class="config-number">范围 ${start}–${end}${configInput(`lifeStages.${endKey}`,stages[endKey],1,120)} 星岁</label><em>${description}</em></div>`;}).join('');
 const actionRows=Object.entries(ACTIONS).map(([type,action])=>{const effects=Object.entries(action.effects||{}).map(([key,value])=>`${NEEDS[key]?.[0]||key} ${value>0?'+':''}${value}`).join(' · '),cost=config.actionCosts[type]??action.cost??0,label=actionLabel(type),details=[effects,cost?`消耗 ${cost} 星币`:'',action.money?`获得 ${action.money} 星币`:'',action.skill?`技能：${SKILLS[action.skill].name}`:''].filter(Boolean).join(' · ')||'无额外效果';return `<div class="config-row"><span>${label}<small>${type}</small></span><label class="config-number">时长 ${configInput(`actionDurations.${type}`,config.actionDurations[type],0,3600)} 秒</label><em>${details}</em></div>`;}).join('');
 const mutationRows=Object.entries(MUTATION_PARTS).map(([key,name])=>`<div class="config-row"><span>${name}<small>${key}</small></span><label class="config-number">概率 ${configInput(`mutationRates.${key}`,config.mutationRates[key],0,100,.1)} %</label><em>每次出生最多变异一个部位</em></div>`).join(''),mutationTotal=Object.values(config.mutationRates).reduce((sum,value)=>sum+value,0).toFixed(1);
 const prayerRows=[['skillChance','正面 · 技能提升','随机一个未满级技能提升 1 级'],['rejuvenationChance','正面 · 返老还童',`仅长者参与，成功后回到 ${config.lifeStages.infantEnd} 星岁（儿童），保留技能与变异`],['radianceChance','正面 · 曦光属性','曦光属性 +1，累计 10 点觉醒曦灵族'],['netherChance','背面 · 幽冥属性','幽冥属性 +1'],['mutationChance','背面 · 永久变异','随机获得一种尚未拥有的变异'],['racialInheritanceRate','遗传 · 种族属性基准','父母种族属性均值的继承百分比'],['racialInheritanceStdDev','遗传 · 种族属性正态浮动','以继承基准为中心的正态分布标准差百分比'],['racialMutationInheritanceChance','遗传 · 种族变异','每种已有种族变异的遗传概率']].map(([key,label,description])=>`<div class="config-row"><span>${label}</span><label class="config-number">概率 ${configInput(`prayer.${key}`,config.prayer[key],0,100,.1)} %</label><em>${description}</em></div>`).join('');
 const careerRows=Object.entries(CAREERS).map(([id,career])=>{const current=careerDefinition(game,id);return `<div class="config-career"><h4>${career.name}</h4>${current.levels.map((level,index)=>`<div class="config-row"><span>Lv.${index+1} ${level.title}<small>${index?`晋升班次 ${level.shifts}`:'入职'}</small></span><label class="config-number">工资 ${configInput(`careers.${id}.levels.${index}.wage`,level.wage,0,1e6)} 星币</label><em>${index?`班次 ${configInput(`careers.${id}.levels.${index}.shifts`,level.shifts,0,1e4)} · `:''}技能：${Object.entries(level.skills).map(([key,value])=>`${SKILLS[key].name} ${configInput(`careers.${id}.levels.${index}.skills.${key}`,value,0,1e6)}`).join(' · ')}</em></div>`).join('')}</div>`;}).join('');
 const cropRows=Object.keys(CROPS).map(id=>{const crop=cropDefinition(game,id);return `<div class="config-row"><span>${ITEMS.find(item=>item.id===id).name}<small>${crop.name}</small></span><label class="config-number">成熟 ${configInput(`crops.${id}.minutes`,crop.minutes,1,1e7)} 分钟</label><em>产量 ${configInput(`crops.${id}.yield`,crop.yield,1,1e6)} · 售价 ${configInput(`crops.${id}.price`,crop.price,0,1e9)} 星币 / 份 · 巨型概率 ${configInput(`crops.${id}.giantChance`,crop.giantChance,0,100,.1)}%</em></div>`;}).join('');
 const needRows=Object.entries(NEEDS).map(([key,[name]])=>`<div class="config-row"><span>${name}<small>${key}</small></span><label class="config-number">每秒 -${configInput(`needDecay.${key}`,config.needDecay[key],0,100,.01)}</label><em>满值 100 · 幼体按 15% 速度衰减</em></div>`).join('');
 $('#config-content').innerHTML=`<form id="config-form"><div class="config-scroll"><section class="config-section"><h3>时间与生命</h3><div class="config-grid"><div class="config-value"><span>年龄换算</span><label>1 星岁 = ${configInput('time.starYearDays',config.time.starYearDays,1,100)} 游戏日</label></div><div class="config-value"><span>游戏时钟</span><label>1 现实秒 = ${configInput('time.gameMinutesPerRealSecond',config.time.gameMinutesPerRealSecond,.01,120,.01)} 游戏分钟</label></div><div class="config-value"><span>当前速度</span><b>${game.speed===0?'暂停':`${game.speed} 倍速`}</b></div><div class="config-value"><span>时间档位</span><b>暂停 / 1 倍 / 3 倍</b></div></div><div class="config-list">${stageRows}</div></section><section class="config-section"><h3>遗传变异概率</h3><p class="config-note">每个部位的数值就是每次出生的变异概率，一次最多变异一个部位，总和为总变异率（默认总计 ${mutationTotal}%）。</p><div class="config-list">${mutationRows}</div></section><section class="config-section"><h3>星灵树祈祷概率</h3><p class="config-note">每次完成祈祷时判定，各项奖励独立抽取，可同时获得；0% 关闭，100% 必定触发（需满足长者、技能未满级或仍有可获得变异等条件）。</p><div class="config-list">${prayerRows}</div></section><section class="config-section"><h3>需求衰减</h3><div class="config-list">${needRows}</div></section><section class="config-section"><h3>动作时长</h3><div class="config-actions">${actionRows}</div></section><section class="config-section"><h3>经济参数</h3><div class="config-grid"><div class="config-value"><span>政府补贴</span><label>${configInput('economy.governmentSubsidy',config.economy.governmentSubsidy,0,1e9)} 星币 / 游戏日</label><small>无父母未成年人、所有老人</small></div><div class="config-value"><span>星际晚餐</span><label>${configInput('actionCosts.eat',config.actionCosts.eat,0,1e9)} 星币 / 份</label><small>从行动执行者或监护家庭扣除</small></div><div class="config-value"><span>星芽孕育</span><label>${configInput('actionCosts.incubate',config.actionCosts.incubate,0,1e9)} 星币 / 次</label><small>完成孕育动作后扣除</small></div><div class="config-value"><span>赠礼</span><label>${configInput('actionCosts.gift',config.actionCosts.gift,0,1e9)} 星币 / 次</label><small>由送礼者承担</small></div></div></section><section class="config-section"><h3>职业门槛与晋升</h3><div class="config-careers">${careerRows}</div></section><section class="config-section"><h3>作物参数</h3><div class="config-list">${cropRows}</div></section></div><div class="config-footer"><button type="button" id="config-reset">恢复默认</button><button class="primary" type="submit">应用并保存配置</button></div></form>`;
}
async function applyConfig(event){
 event.preventDefault();const form=event.target;if(!form.checkValidity()){form.reportValidity();return;}
 const next=structuredClone(game.config);for(const input of form.querySelectorAll('[data-config-path]')){const path=input.dataset.configPath.split('.');let target=next;for(const key of path.slice(0,-1))target=target[key];target[path.at(-1)]=Number(input.value);}
 const normalized=normalizeConfig(next);if(!validConfig(normalized)){toast('配置范围无效：生命阶段必须按年龄递增，且变异概率总和不能超过 100%。');return;}
 if(!(await command('config',normalized)).ok)return;lastPanel='';refresh();renderConfig();if(await save(true))toast('参数配置已保存并开始生效。');
}
async function resetConfig(){if(!(await command('config',normalizeConfig())).ok)return;lastPanel='';refresh();renderConfig();toast('已恢复默认参数，点击应用并保存配置后持久化。');}
async function persistProjectConfig(){if(!confirm('将当前参数永久覆盖为项目默认配置，之后新建的星湾会使用这些参数。确定继续吗？'))return;try{hosted?await online.mutate('/api/project-config'):await persistence.saveProjectConfig(game.config);toast('当前配置已固化为项目默认配置。');}catch(error){console.error('项目配置保存失败',error);toast('项目配置保存失败，请检查游戏服务。');}}
async function startNewLife(){
 if(epochRestarting||hosted&&!online.canOperate)return;epochRestarting=true;const speed=game.speed;if(!hosted)game.speed=0;
 try{game=hosted?(await online.mutate('/api/new-game')).state:await persistence.createNewGame();saveBlocked=false;$('#save-status').dataset.state='saved';$('#save-status').textContent='新纪元已保存 · 从第 1 天开始';selectedResident='player';portraitKey='';lastPanel='';lastMajorEvents='';selectedItem=null;build=false;world.setBuild(null);$('#build-button').classList.remove('active');$('#build-hint').hidden=true;document.querySelectorAll('dialog[open]').forEach(d=>d.close());closeContext();closeCharacterSwitcher();world.resetCamera();changeTab('needs');refresh();toast('纪元已重启，从第 1 天重新开始。');}
 catch(error){game.speed=speed;console.error('重启纪元失败',error);toast('重启失败，当前进度未替换；请检查存档服务。');}
 finally{epochRestarting=false;}
}
function refreshPortraits(){
 if(!world)return;const activeId=activeResidentId(),others=neighbors(game),switchable=[...others].sort((a,b)=>b.age-a.age),entries=[{id:activeId,person:game.player},...others.map(n=>({id:n.id,person:game.npcs[n.id]}))],key=`${activeId}|${JSON.stringify(game.config.lifeStages)}|${entries.map(({id,person})=>`${id}-${person.uid}-${person.name}-${person.alive}-${person.gender}-${Math.floor(person.age)}-${lifeStage(person.age,game.config.lifeStages)}-${JSON.stringify(person.genome)}-${JSON.stringify(person.prayer)}-${person.devotion}`).join('|')}`;if(key===portraitKey)return;portraitKey=key;
 portraits=Object.fromEntries(entries.map(({id})=>[id,world.portrait(id===activeId?'player':id)]));portraits.player=portraits[activeId];$('#player-portrait').src=portraits[activeId];$('#player-portrait').alt=`${game.player.name}的外星人头像`;$('#player-name').textContent=game.player.name;$('.profile-traits').innerHTML=game.player.trait.split(' · ').map(t=>`<span>${icon('Sparkles')} ${t}</span>`).join('');$('.neighbors .card-label span').textContent=`${others.length} 位居民`;
  $('#character-switcher').innerHTML=switchable.map(n=>`<button type="button" class="character-option" data-character="${n.id}" role="menuitem" aria-label="切换到${n.name}"><img src="${portraits[n.id]}" alt="${n.name}"/><span><strong>${n.name}</strong><small>${Math.floor(n.age)} 星岁</small></span></button>`).join('');$('#active-character').setAttribute('aria-label',`切换主控居民，当前是${game.player.name}`);
  $('#neighbor-portraits').innerHTML=others.map(n=>`<button data-npc="${n.id}" title="${n.name} · ${GENDERS[game.npcs[n.id].gender]} · ${STAGES[lifeStage(game.npcs[n.id].age,game.config.lifeStages)]}" aria-label="与${n.name}互动"><img src="${portraits[n.id]}" alt="${n.name}"/><span>${n.name}</span><i></i></button>`).join('');lastPanel='';
}
function prayerDetails(person){return `<div class="prayer-status" data-race="${isDual(person)?'duality':isRadiant(person)?'radiant':isNether(person)?'nether':'alien'}"><strong>${prayerRaceName(person)||'星湾居民'}</strong><span>曦光属性 ${displayNumber(person.prayer.radiance)} / ${PRAYER_RULES.radianceThreshold}${isRadiant(person)?' · 已觉醒':''}</span><span>幽冥属性 ${displayNumber(person.prayer.nether)} / ${PRAYER_RULES.netherThreshold}${isNether(person)?' · 幽冥眼已觉醒':''}</span><small>两种属性各满 10 点，觉醒两仪族 · 祈祷变异：${person.prayer.mutations.map(key=>PRAYER_MUTATIONS[key]).join('、')||'暂无'}</small></div>`;}
function skillCards(person,skills,foundation=false,interests=false){
 return '<div class="skill-grid">'+Object.entries(SKILLS).map(([key,adultSkill])=>{
  const skill=foundation?FOUNDATION_SKILLS[FOUNDATION_FOR[key]]:adultSkill,p=skillProgress(foundation?person.education.foundation[FOUNDATION_FOR[key]]:skills[key]);
  return `<div class="skill-card" data-skill="${key}"><div class="skill-icon">${icon(skill.icon)}</div><div class="skill-copy"><strong>${skill.name}<b>Lv.${p.level}</b></strong><div class="meter"><span style="width:${p.progress}%"></span></div><small>${p.level===10?'已满级':`经验 ${displayNumber(p.xp)} / ${displayNumber(p.next)}`}${interests?` · 兴趣 ${displayNumber(studyInterest(person,key))}`:''}</small></div></div>`;
 }).join('')+'</div>';
}
function learningPanel(person,skills,compact=false){
 const level=educationLevel(person),next=EDUCATION_LEVELS[EDUCATION_LEVELS.indexOf(level)+1],credits=person.education.credits,advanced=higherEducation(person);
 const progress=next?Math.min(100,(credits-level.credits)/(next.credits-level.credits)*100):100;
 return `<div class="learning-panel"><div class="learning-heading"><div><span class="eyebrow">学历</span><h3>${level.name}</h3><p>${credits} 学分${next?` / ${next.credits} 学分 · 下一学历：${next.name}`:' · 已完成博士学业'}</p><div class="meter"><span style="width:${progress}%"></span></div><small>班次收入 ×${displayNumber(level.multiplier)}</small>${next?`<p class="education-requirements">升学条件：${next.credits} 学分 · ${educationRequirements(next)}</p>`:'' }<p class="education-path">${EDUCATION_LEVELS.map(l=>l.name).join(' → ')}</p></div><label>学习科目<select id="study-focus"><option value="" ${person.education.focus===null?'selected':''}>自主选科</option>${Object.entries(SKILLS).map(([key])=>`<option value="${key}" ${person.education.focus===key?'selected':''}>${studyName(person,key)}</option>`).join('')}</select></label><button class="primary" id="study" ${!person.alive||person.age<game.config.lifeStages.infantEnd?'disabled':''}>${icon('BookOpen')} ${compact?'继续学习':'开始学习'}</button></div>
 ${advanced?`<dl class="education-major"><dt>进修方向</dt><dd>${person.education.major?MAJORS[person.education.major]:'入学选科中'}</dd>${person.education.major?`<small>${SKILLS[person.education.major].name} · 学习效率 ×2</small>`:''}</dl>`:'<p class="education-phase">基础教育</p>'}
 <div class="learning-interest">${icon('Heart')} 兴趣偏好：${Object.entries(SKILLS).filter(([key])=>studyInterest(person,key)>0).sort(([a],[b])=>studyInterest(person,b)-studyInterest(person,a)).map(([key])=>studyName(person,key)).join('、')||'尚无明显偏好'}</div>
 ${compact?'':`<h4>${advanced?'专业技能':'基础能力'}</h4>${skillCards(person,skills,!advanced,true)}`}</div>`;
}
function renderPanel(){
 const educationOpen=$('.continuing-education')?.open;
 const activeId=activeResidentId();selectedResident='player';const person=resident(),skills=game.skills,funds=game.money;
 const signature=tab==='exploration'?JSON.stringify([game.civilization,game.space,game.career,game.skills,game.player.island,game.player.preferences,game.wonders,game.day,game.objects.filter(o=>o.wonder).map(o=>[o.id,o.wonder.chapter,o.wonder.coauthored,o.wonder.mode,Math.floor(o.wonder.charge||0),o.wonder.armed]),[game.player,...neighbors(game)].map(n=>[n.uid,n.prayer,n.mutations])]):tab==='life'?JSON.stringify([activeId,person.uid,person.alive,person.familyDesire,person.prayer,game.autonomy.enabled,birthDecision(game,'player').reason,Math.floor(game.minute),game.incubations,game.memorials,game.money,neighbors(game).map(n=>[n.id,Math.floor(n.needs.hunger),Math.floor(n.age)])]):tab==='needs'?Object.values(game.needs).map(Math.floor).join(','):tab==='relations'?JSON.stringify([game.relationships,neighbors(game).map(n=>game.npcs[n.id].activity)]):tab==='career'?JSON.stringify([activeId,game.career,skills,person.education,lifeStage(person.age,game.config.lifeStages),person.alive]):tab==='skills'?JSON.stringify([activeId,skills,person.education,lifeStage(person.age,game.config.lifeStages)]):tab==='resident'?`${activeId}-${person.gender}-${Math.floor(person.age)}-${Math.floor(funds)}-${JSON.stringify(person.prayer)}-${person.devotion}-${person.homeIsland??'home'}`:`${pack}-${build}`;
 const learning=isLearner(person,game.config.lifeStages);$('[data-tab="career"]').innerHTML=learning?`${icon('BookOpen')} 学习`:`${icon('BriefcaseBusiness')} 职业`;
 if(signature===lastPanel||tab==='life'&&document.activeElement?.matches('#panel-content select'))return;lastPanel=signature;
  $('#panel-tag').textContent=tab==='exploration'?'文明、记录与共享资源':tab==='needs'?'六种需求 · 一种好生活':tab==='relations'?'友谊也需要悉心照料':tab==='career'?'在银河找到自己的位置':tab==='skills'?'通过实际行动积累经验':tab==='resident'?`每 ${game.config.time.starYearDays} 天增长 1 星岁`:tab==='life'?'新生、陪伴与告别':build?'选择物品 → 点击地面摆放':`${new Set(ITEMS.map(i=>i.pack)).size} 个主题包 · ${ITEMS.length} 件物品`;
 if(tab==='exploration'){if(!$('.exploration-panel'))$('#panel-content').innerHTML='<div class="exploration-panel"></div>';$('.exploration-panel').innerHTML=explorationContent(game);}
 if(tab==='life'){
  const decision=birthDecision(game,'player'),children=[game.player,...neighbors(game),...game.memorials].filter(n=>n.parents.some(p=>p.uid===person.uid));
  if(!$('.life-panel'))$('#panel-content').innerHTML='<div class="life-panel"></div>';
  $('.life-panel').innerHTML=`<div class="life-person">${residentPicker()}${prayerDetails(person)}<label class="family-label">生育意愿 <select id="family-desire" ${person.alive?'':'disabled'}><option value="0" ${person.familyDesire<.4?'selected':''}>暂不考虑</option><option value="0.7" ${person.familyDesire>=.4&&person.familyDesire<.9?'selected':''}>顺其自然</option><option value="1" ${person.familyDesire>=.9?'selected':''}>期待家人</option></select></label><p id="fertility-reason">${decision.reason}</p><small>${selectedResident==='player'&&!game.autonomy.enabled?'开启「自主」后，主控居民才会自主安排生育。':'本地 AI 会把生育与日常需求一起权衡。'}</small><p class="family-line">亲代：${person.parents.map(p=>p.name).join('、')||'星湾初代'} · 子女：${children.map(p=>p.name).join('、')||'暂无'}</p><p class="family-line">遗传：${person.trait} · ${person.mutations.length?person.mutations.join('、'):'未发现突变'}<br>身高 ${Math.round(person.genome.stature*100)}% · 体型 ${Math.round(person.genome.build*100)}% · 触角 ${Math.round(person.genome.antenna*100)}%</p></div><div class="life-events"><h4>星芽育生 <span>3 天孵育 · 300 星币</span></h4>${game.incubations.length?game.incubations.map(b=>`<p class="birth-entry">${icon('Sprout')}<span>${b.parents.map(p=>p.name).join('与')}的星芽<small>${b.due>gameMinutes(game)?`还有 ${Math.ceil(b.due-gameMinutes(game))} 游戏分钟出生`:'已成熟，等待育生舱旁腾出空地'}</small></span></p>`).join(''):'<p class="life-empty">暂无孕育中的星芽。在物品包购买育生舱，让家园具备迎接新生命的条件。</p>'}<h4>星湾纪念 <span>${game.memorials.length} 位逝者</span></h4>${game.memorials.map(m=>`<p class="memorial-entry">${m.name}<small>${Math.floor(m.age)} 星岁 · 第 ${m.day} 天 · ${m.cause==='old_age'?'寿终':'长期饥饿'}</small></p>`).join('')||'<p class="life-empty">每一段生命，都值得被记住。</p>'}${!game.player.alive?`<div class="successors"><h4>选择继续陪伴的居民</h4>${neighbors(game).filter(n=>n.age>=3).map(n=>`<button data-inherit="${n.id}">接管 ${n.name}</button>`).join('')||'<p class="life-empty">暂无可接管的居民。</p><button id="new-life">重新开始星湾生活</button>'}</div>`:''}</div>`;
 }
 if(tab==='skills')$('#panel-content').innerHTML=`<div class="skill-panel"><h4>${learning&&!higherEducation(person)?'基础能力':'专业技能'}</h4>${skillCards(person,skills,learning&&!higherEducation(person))}</div>`;
  if(tab==='resident')$('#panel-content').innerHTML=`<div class="resident-panel">${residentPicker()}<dl class="resident-home"><dt>${icon('House')} 安居星岛</dt><dd id="resident-home-island">${islandDefinition(game,person.homeIsland??'home').name}</dd></dl>${prayerDetails(person)}<button type="button" id="randomize-heads">随机所有居民头型与触角</button><div class="resident-editor"><img id="resident-photo" src="${portraits[selectedResident]}" alt="居民外形预览"/><form id="resident-form"><fieldset ${person.alive?'':'disabled'}><div class="resident-fields"><label>性别<select id="resident-gender" aria-label="性别">${Object.entries(GENDERS).map(([key,label])=>`<option value="${key}" ${person.gender===key?'selected':''}>${label}</option>`).join('')}</select></label><label>年龄（星岁）<input id="resident-age" aria-label="年龄（星岁）" type="number" min="0" max="120" step="1" required value="${Math.floor(person.age)}"/></label><label>虔诚值<input id="resident-devotion" aria-label="虔诚值" type="number" min="0" max="100" step="1" required value="${person.devotion}"/></label>${Object.entries(HEAD_SHAPE).map(([key,label])=>`<label>${label}（%）<input name="${key}" aria-label="${label}" type="number" min="80" max="120" step="1" required value="${Math.round(person.genome[key]*100)}"/></label>`).join('')}<button class="primary" type="submit">应用人物设定</button></div><p id="resident-summary">${GENDERS[person.gender]} · ${Math.floor(person.age)} 星岁 · ${STAGES[lifeStage(person.age,game.config.lifeStages)]} · 余额 ${fmt(funds)} 星币</p><small>虔诚值越高，越倾向自主祈祷；不改变赐福成功率。幼体在摇篮中成长，${game.config.lifeStages.infantEnd} 星岁后活动；长者的体态随年龄改变，${game.config.lifeStages.elderEnd} 星岁自然离世。</small></fieldset></form></div></div>`;
 if(tab==='needs')$('#panel-content').innerHTML=`<div class="needs-grid">${Object.entries(NEEDS).map(([key,[name,i]])=>{const value=Math.floor(game.needs[key]);return`<div class="need ${value<30?'low':''}"><div class="need-icon">${icon(i)}</div><div class="need-info"><div><span>${name}</span><small>${value}<em> / 100</em></small></div><div class="meter"><span style="width:${value}%"></span></div></div></div>`;}).join('')}</div>`;
 if(tab==='relations')$('#panel-content').innerHTML=`<div class="relationship-grid">${neighbors(game).map(n=>`<button class="relationship" data-npc="${n.id}" aria-label="与${n.name}互动"><img src="${portraits[n.id]}" alt="${n.name}"/><div><strong>${n.name}<small>${relationName(game.relationships[n.id])}</small></strong><p class="npc-activity"></p><div class="meter"><span style="width:${game.relationships[n.id]}%"></span></div></div></button>`).join('')}</div>`;
 if(tab==='relations')document.querySelectorAll('.relationship').forEach(b=>b.querySelector('.npc-activity').textContent=game.npcs[b.dataset.npc].activity);
 if(tab==='career'&&learning)$('#panel-content').innerHTML=learningPanel(person,skills);
 if(tab==='career'&&!learning){const state=selectedResident==='player'?game.career:person.career,c=careerDefinition(game,state.id),level=c.levels[state.level-1],next=c.levels[state.level],isPlayer=selectedResident==='player';$('#panel-content').innerHTML=`<div class="career-layout">${residentPicker()}<div class="career-current"><div class="career-icon">${icon(c.icon)}</div><div><span class="eyebrow">${c.name} · 等级 ${state.level}</span><h3>${level.title}</h3><p>${educationWage(person,level.wage)} 星币 / 班次 · ${educationLevel(person).name} ×${displayNumber(educationLevel(person).multiplier)} <span>·</span> ${next?`晋升要求：${state.shifts} / ${next.shifts} 班次 · ${careerSkillsText(skills,state.id,state.level+1)}`:'已达最高等级'}</p><small>当前级别技能：${careerSkillsText(skills,state.id,state.level)}</small><p class="career-chain">${c.levels.map(l=>l.title).join(' → ')}</p></div>${isPlayer?`<button class="primary" id="work">开始工作 ${icon('ArrowRight')}</button>`:''}</div><details class="continuing-education"><summary>学历与继续教育</summary>${learningPanel(person,skills,true)}</details><div class="career-options">${Object.entries(CAREERS).map(([id,career])=>{const missing=missingCareerSkills(skills,id,1,game.config),chosen=id===state.id,locked=!isPlayer||chosen||missing.length;return `<button data-career="${id}" class="${chosen?'chosen':''}" aria-label="加入${career.name}" ${locked?'disabled':''} title="${chosen?'当前职业':missing.length?`技能不足：${careerMissingText(skills,id)}`:'达到入职门槛，可申请'}">${icon(career.icon)}<span>${career.name}</span><small>入职要求：${careerSkillsText(skills,id)}</small>${chosen?icon('Check'):icon('ArrowUpRight')}</button>`;}).join('')}</div><div class="skills">${Object.entries(SKILLS).map(([key,skill])=>`${skill.name} ${Math.floor(skills[key])}`).join(' <span>·</span> ')} <span>·</span> 入职与晋升均按配置检查技能</div></div>`;}
 if(educationOpen)$('.continuing-education')?.setAttribute('open','');
 if(tab==='items')$('#panel-content').innerHTML=`<div class="catalog"><div class="pack-filters">${['全部',...new Set(ITEMS.map(i=>i.pack))].map(p=>`<button data-pack="${p}" class="${pack===p?'active':''}">${p}</button>`).join('')}<small>${build?'摆放时按 R 旋转':'购买家具，装点你的星际小家'}</small></div><div class="item-grid">${ITEMS.filter(i=>pack==='全部'||i.pack===pack).map(i=>`<button class="item-card ${selectedItem===i.id?'selected':''}" data-item="${i.id}" aria-label="购买 ${i.name}"><div class="item-art ${i.pack==='生活舱'?'rose':i.pack==='星际科技'?'lavender':'green'}">${icon(i.icon)}</div><div><strong>${i.name}</strong><small>✦ ${i.price}</small></div><span class="item-description">${i.desc}</span></button>`).join('')}</div></div>`;
}
 function plantDetails(o){const p=o.plant,crop=cropDefinition(game,o.type),yieldAmount=harvestAmount(o,game.config.crops);return `<strong>${plantStatus(o)}</strong><div class="plant-meters">${[['生长',p.growth*100],['水分',p.water],['健康',p.health]].map(([label,value])=>`<div><span>${label}<b>${Math.floor(value)}%</b></span><div class="meter"><span style="width:${value}%"></span></div></div>`).join('')}</div><small>约 ${crop.minutes/60} 游戏小时 · 当前产量 ${yieldAmount} 份${crop.name}${p.giant?'（巨型作物）':''}</small><p>预计收入 ${yieldAmount*harvestPrice(o,game.config.crops)} 星币 · 自动出售${o.type==='mushroom'?` · 收获后植株消失 · 补种 ${MUSHROOM_SEED_COST} 星币`:''}</p>`;}
function refresh(){
 if(lastViewedIsland!==game.viewIsland){navigationIsland=game.viewIsland;lastViewedIsland=game.viewIsland;}
 const islands=Object.entries(islandCatalog(game)).filter(([id])=>discovered(game,id)),navKey=JSON.stringify([navigationIsland,islands.map(([id])=>[id,game.civilization.visits[id]>0])]);
 if($('.locations').dataset.signature!==navKey){$('.locations').dataset.signature=navKey;const index=islands.findIndex(([id])=>id===navigationIsland);$('.locations').innerHTML=`<button data-island-step="-1" aria-label="上一座星岛" ${index<=0?'disabled':''}>${icon('ChevronLeft')}</button><select id="island-select" aria-label="选择星岛">${islands.map(([id,island])=>`<option value="${id}" ${id===navigationIsland?'selected':''}>${island.name}${game.civilization.visits[id]?'':' · 待登陆'}</option>`).join('')}</select><button data-island-step="1" aria-label="下一座星岛" ${index>=islands.length-1?'disabled':''}>${icon('ChevronRight')}</button>`;}
 $('.location h1').innerHTML=islandDefinition(game,game.viewIsland).name+'<span class="live-dot"></span>';
 $('#flip-island').disabled=!backDiscovered(game,game.viewIsland);
 $('#island-side').textContent=SIDES[game.viewSide]+' · 居民在'+islandDefinition(game,islandOf(game.player)).name+' '+SIDES[sideOf(game.player)];
 document.body.dataset.islandSide=game.viewSide;
 $('#flip-island').title=backDiscovered(game,game.viewIsland)?'翻到'+SIDES[game.viewSide==='front'?'back':'front']+'，可查看和建造':'等待幽冥族自主闪现，发现这座岛的幽星面';
 const weather=getWeather(game);$('#weather').innerHTML=`${icon(weather.icon)} ${weather.temperature}° · ${weather.transitioning?`${weather.nextName}渐至`:weather.name} · ${weather.description}`;$('#weather').dataset.weather=weather.type;
 const lifeState=`${game.player.uid}-${game.player.alive}`;if(lifeState!==lastLifeState){lastLifeState=lifeState;if(!game.player.alive){closeContext();changeTab('life');}}
 if(context?.kind==='npc'&&!game.npcs[context.id])closeContext();
 refreshPortraits();$('#player-bio').textContent=`${GENDERS[game.player.gender]} · ${Math.floor(game.player.age)} 星岁${prayerRaceName(game.player)?' · '+prayerRaceName(game.player):''}`;
 $('#money').textContent=fmt(game.money);$('#day').textContent=`第 ${game.day} 天`;$('#clock').textContent=`${String(Math.floor(game.minute/60)).padStart(2,'0')}:${String(Math.floor(game.minute%60)).padStart(2,'0')}`;
 document.querySelectorAll('[data-speed]').forEach(b=>b.classList.toggle('active',Number(b.dataset.speed)===game.speed));
 const avg=Object.values(game.needs).reduce((a,b)=>a+b)/6;$('#mood').innerHTML=`${icon(avg<35?'Frown':avg>75?'Sparkles':'Smile')} ${avg<35?'需要一点关照':avg>75?'幸福感满满':'心情不错'}`;$('#mood').classList.toggle('unhappy',avg<35);
 const endangered=[...(game.player.alive&&game.player.starvation>=720?[game.player]:[]),...neighbors(game).filter(n=>n.starvation>=720)];
 $('#life-alert').hidden=game.player.alive&&!endangered.length;$('#life-alert').textContent=!game.player.alive?`${game.player.name}已离世。时间已暂停，请在生命页选择接管居民。`:`${endangered.map(n=>n.name).join('、')}持续饥饿，请立即进食或安排照料。`;
  const q=game.queue[0];$('#activity').innerHTML=q?`${icon(ACTIONS[q.type].icon)} ${q.phase==='walking'?'正在走过去…':q.phase==='waiting'?'等待家具空闲…':q.phase==='celebrating'?(q.blessing.side==='front'?'接受晴昼赐福':'接受幽冥赐福'):actionLabel(q.type)}`:`${icon('Coffee')} 享受此刻的宁静`;
 if(!game.player.alive){$('#activity').textContent='这段生命已落幕';$('#mood').textContent='留在星湾的记忆';}$('#autonomy').disabled=!game.player.alive;
 $('#autonomy').setAttribute('aria-checked',String(game.autonomy.enabled));$('#autonomy').title=game.autonomy.enabled?'自主行为已开启 · 点击关闭，手动指令优先':'自主行为已关闭 · 点击开启';
 $('#autonomy-reason').hidden=!game.autonomy.enabled;$('#autonomy-reason').textContent=`${game.player.name}的想法：${game.autonomy.reason}`;
 if(context?.kind==='npc'&&$('#npc-status')){const n=game.npcs[context.id];$('#npc-status').textContent=`${n.activity} · ${n.ai.reason}`;}
  $('#queue').innerHTML=game.queue.length?game.queue.map((q,i)=>`<div class="queue-action ${i===0?'current':''}" style="--progress:${q.phase==='celebrating'?Math.min(100,q.elapsed/PRAYER_RULES.celebrationSeconds*100):q.phase==='acting'?Math.min(100,q.elapsed/Math.max(.1,game.config.actionDurations[q.type])*100):0}%">${icon(ACTIONS[q.type].icon)}<span>${q.phase==='celebrating'?(q.blessing.side==='front'?'晴昼赐福':'幽冥赐福'):`${WONDER_ACTIONS[q.type]?.paired&&q.phase==='waiting'?'等候共同活动 · ':''}${actionLabel(q.type)}`}</span>${q.source==='ai'?'<small class="ai-badge">自主</small>':''}<button data-cancel="${q.id}" aria-label="取消${actionLabel(q.type)}">${icon('X')}</button></div>`).join(''):`<span class="queue-empty">${icon('MousePointer2')} ${game.autonomy.enabled?'正在考虑下一件小事':'给今天安排一点小事吧'}</span>`;
 const majorEvents=game.majorEvents||[],majorSignature=JSON.stringify(majorEvents);$('#journal').hidden=!majorEvents.length;if(majorSignature!==lastMajorEvents){lastMajorEvents=majorSignature;$('#journal-text').innerHTML=majorEvents.slice(0,3).map(event=>`<p class="journal-entry"><span>${event.text}</span><small>第 ${event.day} 天</small></p>`).join('');$('#journal-time').textContent=`最近 ${Math.min(3,majorEvents.length)} 条重大事件`;}
 refreshWonderMenu();refreshProjectMenu();refreshProfessionMenu();
 if(context?.kind==='object'){const o=game.objects.find(o=>o.id===context.id);if(!o)closeContext();else if(CROPS[o.type]&&$('#plant-status')){$('#plant-status').innerHTML=plantDetails(o);for(const b of document.querySelectorAll('#context-menu [data-action]')){const error=actionAccessError(game,{id:'player',position:game.player,skills:game.skills},b.dataset.action)||plantActionError(o,b.dataset.action);b.disabled=!!error;b.title=error||'';}}}
 renderPanel();
 if(hosted)document.querySelectorAll(mutationControls).forEach(el=>el.setAttribute('aria-disabled',String(!online.canOperate)));
}
function selectIsland(id){
 if(!discovered(game,id))return;navigationIsland=id;
 if(game.civilization.visits[id]){game.viewIsland=id;game.viewSide='front';world.resetCamera();closeContext();}
 else {tab='exploration';document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));toast('已发现星岛，先满足出航条件并完成首次登陆。');}
 const select=$('#island-select');if(select)select.value=navigationIsland;refresh();
}
 document.addEventListener('change',async e=>{if(e.target.id==='island-select')selectIsland(e.target.value);});
function refreshWonderMenu(){
 if(!context||!$('#wonder-status'))return;const o=game.objects.find(o=>o.id===context.id);if(!o)return;
 $('#wonder-status').textContent=o.type==='portal'?`文明记忆 ${game.wonders.archive} / 3 · 共享微尘 ${game.wonders.dust} 份 · 星城探访每天一次`:wonderStatus(game,o);
 for(const b of document.querySelectorAll('#context-menu [data-action]'))if(WONDER_ACTIONS[b.dataset.action]){const error=interactionError(game,b.dataset.action,o.id,$('#wonder-partner')?.value||null);b.disabled=!!error;b.title=error||'';let hint=b.querySelector('.interaction-reason');if(!hint){hint=document.createElement('em');hint.className='interaction-reason';b.querySelector('span').append(hint);}const partner=neighbors(game).find(n=>n.id===$('#wonder-partner')?.value);hint.textContent=error||(WONDER_ACTIONS[b.dataset.action].paired&&partner?`加入${partner.name}的队列 · 前面 ${partner.queue.length} 项，忙完后一起开始`:'');}
}
function refreshProjectMenu(){
 if(context?.kind!=='object')return;
 const o=game.objects.find(o=>o.id===context.id),project=o&&game.civilization.projects[islandOf(o)];
 if(!project||!workbench(o))return;
 let status=$('#project-status');if(!status){status=document.createElement('p');status.id='project-status';$('#context-menu .context-heading').after(status);}
 status.textContent=`蓝图 ${Math.floor(project.blueprint/300*100)}% · 建设 ${Math.floor(project.construction/600*100)}% · 本岛植生复材 ${game.space.materials[islandOf(o)]??0} 份`;
 for(const b of document.querySelectorAll('#context-menu [data-action]'))if(['developBlueprint','constructIsland','settleIsland'].includes(b.dataset.action)){const error=actionAccessError(game,{id:'player',position:game.player,skills:game.skills},b.dataset.action)||civilizationError(game,b.dataset.action,o,game.player,game.skills);b.disabled=!!error;b.title=error||'';}
}
function closeContext(){$('#context-menu').hidden=true;context=null;}
function refreshProfessionMenu(){
 if(context?.kind!=='object')return;const o=game.objects.find(o=>o.id===context.id);
 if(!o||!['materialCabinet','loadingPlatform','extractor'].includes(o.type))return;
 let status=$('#profession-status');if(!status){status=document.createElement('div');status.id='profession-status';$('#context-menu .context-heading').after(status);}
 const ships=game.space.ships.filter(s=>sameSide(s,o)),source=o.type==='extractor'?materialSource(game.objects,o):null,stock=game.space.materials[islandOf(o)]??0;
 if(o.type==='extractor'){
  status.textContent=source?`取材：${ITEMS.find(i=>i.id===source.type).name} · 设备提取产量增加 50% · 本岛库存 ${stock} 份`:'同岛面 6 米内没有成熟植物，请先培育或将提取器放在种植区旁。';
  const b=$('#context-menu [data-action="extractMaterials"]');if(b){const error=actionAccessError(game,{id:'player',position:game.player,skills:game.skills},'extractMaterials')||civilizationError(game,'extractMaterials',o,game.player,game.skills);b.disabled=!!error;b.title=error||'';}
 }else{
  const markup=`<p>${islandDefinition(game,islandOf(o)).name} · 植生复材 ${stock} 份</p><p>同岛面货舱合计 ${ships.reduce((n,s)=>n+(game.space.cargo[s.id]??0),0)} / ${ships.reduce((n,s)=>n+ufoDefinition(s).cargoCapacity,0)} 份</p>${ships.map(s=>`<button class="island-launch" data-ufo="${s.id}" ${sameSide(s,game.player)?'':'disabled'}>${ufoDefinition(s).name} · ${game.space.cargo[s.id]??0}/${ufoDefinition(s).cargoCapacity} 份 · 管理货舱</button>`).join('')||'<p>本岛面尚无飞船。</p>'}`;
  if(status.dataset.signature!==markup){status.innerHTML=markup;status.dataset.signature=markup;}
 }
}
function closeCharacterSwitcher(){const menu=$('#character-switcher');if(!menu)return;menu.hidden=true;$('#active-character')?.setAttribute('aria-expanded','false');}
function toggleCharacterSwitcher(){const menu=$('#character-switcher');if(!menu)return;const open=menu.hidden;menu.hidden=!open;$('#active-character').setAttribute('aria-expanded',String(open));}
async function showContext(target,x,y){
 if(target.kind==='ufo'){showUfo(target.id);return;}
 if(target.kind==='ground'){closeContext();const result=await enqueue(game,'walk',null,target.point);if(!result.ok)toast(result.message);refresh();return;}
 if(target.kind==='npc'&&!game.npcs[target.id])return;
 if(target.kind==='player'){changeTab('needs');world.focus('player');return;}
 context=target;let title,subtitle,actions;
 if(target.kind==='npc'){const npc=neighbors(game).find(n=>n.id===target.id),person=game.npcs[target.id];title=npc.name;subtitle=`${GENDERS[person.gender]} · ${Math.floor(person.age)} 星岁 · ${STAGES[lifeStage(person.age,game.config.lifeStages)]} · ${npc.trait} · 友好度 ${game.relationships[npc.id]}`;actions=person.age<game.config.lifeStages.infantEnd?['care']:['chat','joke','gift','study'];if(person.age>=game.config.lifeStages.teenEnd&&game.player.age>=game.config.lifeStages.teenEnd)actions.push('flirt');}
 else{const obj=game.objects.find(o=>o.id===target.id);const item=ITEMS.find(i=>i.id===obj.type);title=item.name;subtitle=item.desc;if(obj.type==='spiritTree')subtitle=sideOf(obj)==='front'?`跪下祈祷 · 独立 ${game.config.prayer.radianceChance}% 概率曦光属性 +1，${PRAYER_RULES.radianceThreshold} 点觉醒曦灵族 · ${game.config.prayer.skillChance}% 概率随机未满级技能升 1 级 · 长者独立 ${game.config.prayer.rejuvenationChance}% 概率返老还童至 ${game.config.lifeStages.infantEnd} 星岁`:`跪下祈祷 · ${game.config.prayer.netherChance}% 概率幽冥属性 +1，${PRAYER_RULES.netherThreshold} 点蜕变幽冥族 · 独立 ${game.config.prayer.mutationChance}% 概率永久变异，可多种共存`;actions=[...(WONDER_OPTIONS[obj.type]||(item.action?[item.action]:[]))];if(obj.type==='portal')actions.push('memoryExpedition');if(obj.type==='lab')actions.push('spaceResearch','buildUfo1','buildUfo2','buildUfo3');if(obj.type==='stove')actions.push('prepareRations');if(workbench(obj)&&islandOf(obj)!=='home')actions=[...new Set([...actions,...projectActions(obj)])];if(CROPS[obj.type])actions=['garden','harvest','extractMaterials','replant'];if(studyFacilitySkill(obj))actions.push('study');if(!isLearner(game.player,game.config.lifeStages)&&canWorkAt(game.career.id,obj.type))actions.push('work');if(obj.type==='sofa')actions.push('lounge');if(obj.type==='nursery'){const birth=game.incubations.find(b=>b.podId===obj.id);if(birth){subtitle=`${birth.parents.map(p=>p.name).join('与')}的星芽 · 还有 ${Math.ceil(birth.due-gameMinutes(game))} 游戏分钟出生`;actions=[];}}}
  actions=actions.filter(a=>canAffordAction(game,'player',a));const el=$('#context-menu');el.innerHTML=`<div class="context-heading"><div><strong>${title}</strong><small>${subtitle}</small></div><button id="context-close" aria-label="关闭互动菜单">${icon('X')}</button></div><div class="context-actions">${actions.map(a=>`<button data-action="${a}" ${ACTIONS[a].minRelation&&(game.relationships[target.id]??0)<ACTIONS[a].minRelation?'disabled title="需要 35 友好度"':''}>${icon(ACTIONS[a].icon)}<span>${a==='study'?`学习${studyName(game.player,studyFacilitySkill(game.npcs[target.id]??game.objects.find(o=>o.id===target.id)))}`:actionLabel(a)}</span><small>${game.config.actionDurations[a]} 秒</small></button>`).join('')}${build&&target.kind==='object'&&!game.objects.find(o=>o.id===target.id).fixed?`<button data-sell="${target.id}" class="sell-action">${icon('Coins')} 出售 · 返还 70% 星币</button>`:''}</div>`;el.hidden=false;el.style.left=`${Math.max(12,Math.min(x+15,innerWidth-320))}px`;el.style.top=`${Math.max(85,Math.min(y-40,innerHeight-325))}px`;
 if(target.kind==='object'){const obj=game.objects.find(o=>o.id===target.id);if(WONDER_OPTIONS[obj.type]||obj.type==='portal'){const status=document.createElement('p');status.id='wonder-status';el.querySelector('.context-heading').after(status);if(actions.some(a=>WONDER_ACTIONS[a]?.paired)){const label=document.createElement('label');label.className='birth-partner';label.innerHTML=`共同活动伙伴 <select id="wonder-partner"><option value="">选择邻居</option>${neighbors(game).filter(n=>sameSide(n,obj)&&n.age>=game.config.lifeStages.infantEnd).map(n=>`<option value="${n.id}">${n.name}</option>`).join('')}</select><small>邀请加入对方队列，完成已有安排后一起开始。</small>`;status.after(label);label.querySelector('select').onchange=refreshWonderMenu;}refreshWonderMenu();}}
 for(const b of el.querySelectorAll('[data-action]')){const error=actionAccessError(game,{id:'player',position:game.player,skills:game.skills},b.dataset.action)||civilizationError(game,b.dataset.action,game.objects.find(o=>o.id===target.id),game.player,game.skills);if(error){b.disabled=true;b.title=error;b.querySelector('span').insertAdjacentHTML('beforeend',`<em class="interaction-reason">${error}</em>`);}}
 if(target.kind==='object'&&game.objects.find(o=>o.id===target.id).type==='portal')el.querySelector('.context-actions').insertAdjacentHTML('beforeend',Object.entries(islandCatalog(game)).filter(([id])=>id!==islandOf(game.player)&&discovered(game,id)).map(([id,island])=>{const error=starVoyageError(game,game.player,game.skills,id);return `<button data-star-voyage="${id}" ${error?'disabled':''} title="${error||''}">${icon('Orbit')} 星门直达${island.name}（量子职业＋科学满级）</button>`;}).join(''));
 if(target.kind==='object'&&game.objects.find(o=>o.id===target.id).type==='portal')el.querySelector('.context-actions').insertAdjacentHTML('beforeend',Object.entries(islandCatalog(game)).filter(([id])=>id!==islandOf(game.player)&&discovered(game,id)).map(([id,island])=>{const error=civilizationError(game,'voyage',game.objects.find(o=>o.id===target.id),game.player,game.skills,id);return `<button data-action="voyage" data-destination="${id}" ${error?'disabled':''} title="${error||''}">${icon('Orbit')}<span>驾驶 UFO 前往${island.name}<em class="interaction-reason">${error||'符合出航条件'}</em></span></button>`;}).join(''));
 if(target.kind==='object'&&CROPS[game.objects.find(o=>o.id===target.id).type]){const o=game.objects.find(o=>o.id===target.id),status=document.createElement('div');status.id='plant-status';status.innerHTML=plantDetails(o);el.querySelector('.context-heading').after(status);for(const b of el.querySelectorAll('[data-action]')){const error=actionAccessError(game,{id:'player',position:game.player,skills:game.skills},b.dataset.action)||plantActionError(o,b.dataset.action);b.disabled=!!error;b.title=error||'';}}
 if(target.kind==='object'&&actions.includes('travel')){
  const gates=game.objects.filter(o=>o.type==='gate'&&o.id!==target.id&&islandOf(o)===islandOf(game.player));
  el.querySelector('[data-action="travel"]').outerHTML=gates.map(o=>`<button data-action="travel" data-destination="${o.id}">${icon('Orbit')}<span>前往 ${SIDES[sideOf(o)]}<small>星门 · (${o.x}, ${o.z})${o.fixed?' · 初始入口':''}</small></span></button>`).join('')||'<p>先在物品包放置另一座星门。</p>';
 }
 if(target.kind==='object'&&actions.includes('incubate')){const label=document.createElement('label');label.className='birth-partner';label.innerHTML=`共同亲代 <select id="birth-partner"><option value="">单亲芽殖</option>${neighbors(game).filter(n=>n.age>=game.config.lifeStages.teenEnd&&n.age<90&&n.familyDesire>=.4&&game.relationships[n.id]>=35).map(n=>`<option value="${n.id}">${n.name}</option>`).join('')}</select><small>双亲混合外形与兴趣；当前部位变异概率可在参数配置中调整。</small>`;el.querySelector('.context-heading').after(label);}
 refreshProjectMenu();refreshProfessionMenu();el.style.maxHeight=`${innerHeight-105}px`;el.style.top=`${Math.max(85,Math.min(y-40,innerHeight-el.offsetHeight-16))}px`;
 if(target.kind==='npc'){const n=game.npcs[target.id],status=document.createElement('p');status.id='npc-status';status.textContent=`${n.activity} · ${n.ai.reason}`;el.querySelector('.context-heading').after(status);}
}
async function selectItem(id){if(hosted&&!online.canOperate){toast('当前为只读，请先获取操作权');return;}selectedItem=id;if(!build){speedBeforeBuild=game.speed;await command('speed',0);}build=true;$('#build-button').classList.add('active');world.setBuild(id);$('#build-hint').hidden=false;lastPanel='';renderPanel();closeContext();toast(`已选择${ITEMS.find(i=>i.id===id).name}，点击地面摆放。`);}
function cancelPlacement(){selectedItem=null;world.setBuild(null);$('#build-hint').hidden=true;lastPanel='';renderPanel();}
async function toggleBuild(){if(hosted&&!online.canOperate){toast('当前为只读，请先获取操作权');return;}build=!build;$('#build-button').classList.toggle('active',build);if(build){speedBeforeBuild=game.speed;await command('speed',0);}else{cancelPlacement();await command('speed',speedBeforeBuild);}changeTab(build?'items':'needs');closeContext();refresh();}
const DASHBOARD_MIN_WIDTH=300,DASHBOARD_MAX_WIDTH=760;
function setDashboardWidth(width){
 const dashboard=$('.dashboard'),handle=$('#dashboard-resize-handle');if(!dashboard||!handle)return;
 const next=Math.round(Math.max(DASHBOARD_MIN_WIDTH,Math.min(DASHBOARD_MAX_WIDTH,width)));dashboard.style.setProperty('--dashboard-width',`${next}px`);document.documentElement.style.setProperty('--dashboard-width',`${next}px`);handle.setAttribute('aria-valuenow',String(next));
}
function setupDashboardResize(){
 const handle=$('#dashboard-resize-handle'),dashboard=$('.dashboard');if(!handle||!dashboard)return;
 let start=null;
 const stop=event=>{if(!start)return;start=null;dashboard.removeAttribute('data-resizing');if(event.pointerId!==undefined&&handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);};
 handle.addEventListener('pointerdown',event=>{if(event.button!==0)return;const width=dashboard.getBoundingClientRect().width;start={x:event.clientX,width};dashboard.dataset.resizing='true';handle.setPointerCapture(event.pointerId);event.preventDefault();});
 handle.addEventListener('pointermove',event=>{if(start)setDashboardWidth(start.width+start.x-event.clientX);});
 handle.addEventListener('pointerup',stop);handle.addEventListener('pointercancel',stop);handle.addEventListener('lostpointercapture',()=>stop({}));
 handle.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;const current=dashboard.getBoundingClientRect().width;const next=event.key==='Home'?DASHBOARD_MIN_WIDTH:event.key==='End'?DASHBOARD_MAX_WIDTH:current+(event.key==='ArrowLeft'?16:-16);setDashboardWidth(next);event.preventDefault();});
}
$('#app').addEventListener('click',async e=>{
 if(epochRestarting)return;
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.speed!==undefined){await command('speed',Number(b.dataset.speed));refresh();}
 if(b.id==='autonomy'){await setAutonomy(game,!game.autonomy.enabled);toast(game.autonomy.enabled?'自主行为已开启，手动安排随时优先。':'自主行为已关闭，保留你的手动安排。');refresh();}
 if(b.id==='active-character')toggleCharacterSwitcher();
 if(b.dataset.tab)changeTab(b.dataset.tab);
 if(b.dataset.character){const result=await switchControl(game,b.dataset.character);if(result.ok){selectedResident='player';portraitKey='';lastPanel='';closeCharacterSwitcher();closeContext();world.focus('player');refresh();save();toast(result.message||`现在由${game.player.name}主控。`);}else toast(result.message);}
 if(b.dataset.inherit){const result=await takeOver(game,b.dataset.inherit);if(result.ok){selectedResident='player';portraitKey='';lastPanel='';refresh();save();toast(`现在由你陪伴${game.player.name}生活。`);}else toast(result.message);}
 if(b.id==='new-life'&&confirm('重新开始将覆盖当前存档，确定开始新的星湾生活吗？'))startNewLife();
 if(b.dataset.cancel){await cancelAction(game,Number(b.dataset.cancel));refresh();}
 if(b.dataset.npc){const r=b.getBoundingClientRect();showContext({kind:'npc',id:b.dataset.npc},r.left,r.top-260);}
 if(b.dataset.action==='voyage'&&context){openFlight(b.dataset.destination);closeContext();return;}
 if(b.dataset.action&&context){const result=await enqueue(game,b.dataset.action,context.id,undefined,(WONDER_ACTIONS[b.dataset.action]?.paired?$('#wonder-partner')?.value:$('#birth-partner')?.value)||null,b.dataset.destination||null);if(!result.ok)toast(result.message);else toast(`已安排：${actionLabel(b.dataset.action)}`);closeContext();refresh();}
 if(b.dataset.career){const id=b.dataset.career;if(await setCareer(game,id)){toast(`已加入${CAREERS[id].name}职业。`);lastPanel='';refresh();}else toast(careerEntryMessage(game,id)||'请先完成或取消当前工作班次。');}
 if(b.dataset.pack){pack=b.dataset.pack;lastPanel='';renderPanel();}
 if(b.dataset.item)selectItem(b.dataset.item);
 if(b.dataset.destroyIsland){
  const id=b.dataset.destroyIsland,name=islandDefinition(game,id).name;
  if(!confirm(`确定摧毁「${name}」？地貌、建筑、家具与工程进度将永久删除，无法撤销。居民、飞船、库存食物和孕育中的星芽会撤回主岛；后续星岛保留。`))return;
  const result=await destroyIsland(game,id);if(result.ok){navigationIsland=game.viewIsland;closeContext();$('#tooltip').hidden=true;lastPanel='';world.resetCamera();refresh();save();}toast(result.message);
 }
 if(b.dataset.islandStep){const islands=Object.keys(islandCatalog(game)).filter(id=>discovered(game,id)),index=islands.indexOf(navigationIsland),id=islands[index+Number(b.dataset.islandStep)];if(id)selectIsland(id);}
 if(b.dataset.starVoyage){const portal=game.objects.find(o=>o.type==='portal'&&sameSide(o,game.player));const result=await enqueue(game,'starVoyage',portal?.id,undefined,null,b.dataset.starVoyage);toast(result.ok?'已安排独自通过星门航行。':result.message);closeContext();refresh();}
 if(b.dataset.loadShip){const result=await loadShipFood(game,b.dataset.loadShip);toast(result.message);b.closest('dialog').close();showUfo(b.dataset.loadShip);refresh();}
 if(b.dataset.loadMaterials||b.dataset.unloadMaterials){const id=b.dataset.loadMaterials||b.dataset.unloadMaterials,result=b.dataset.loadMaterials?await loadShipMaterials(game,id,Number($('#cargo-amount').value)):await unloadShipMaterials(game,id);toast(result.message);if(result.ok){showUfo(id);refresh();save();}}
 if(b.dataset.voyage){openFlight(b.dataset.voyage,b.dataset.ship||null);closeContext();}
 if(b.dataset.ufo){const ship=game.space.ships.find(s=>s.id===b.dataset.ufo);if(ship){game.viewIsland=ship.island;game.viewSide=ship.side;world.focusUfo(ship.id);showUfo(ship.id);refresh();}}
 if(b.dataset.sell){if(await sellItem(game,b.dataset.sell)){toast('家具已出售，返还 70% 星币。');refresh();}else toast('请先取消与这件家具相关的行动。');closeContext();}
 if(b.id==='work'){const lab=game.objects.find(o=>sameSide(o,game.player)&&canWorkAt(game.career.id,o.type));const result=await enqueue(game,'work',lab?.id);toast(result.ok?`已安排工作班次，${game.player.name}将前往${game.career.id==='chef'?'孢火星釜':'研究台'}。`:result.message);refresh();}
 if(b.id==='study'){const result=await enqueueStudy(game);toast(result.ok?'已安排学习。':result.message);refresh();}
 if(b.id==='save')save(true);
  if(b.id==='config'){renderConfig();$('#config-dialog').showModal();}
  if(b.id==='config-reset')resetConfig();
 if(b.id==='restart-epoch'&&confirm('重启纪元将永久清除当前居民进度、星岛、工程、材料、飞船与星币，从第 1 天重新开始。此操作无法撤销，确定删档重启吗？'))startNewLife();
  if(b.id==='config-project-default')persistProjectConfig();
 if(b.id==='help')$('#help-dialog').showModal();
 if(b.classList.contains('dialog-close'))b.closest('dialog')?.close();
 if(b.id==='flip-island'&&backDiscovered(game,game.viewIsland)){game.viewSide=game.viewSide==='front'?'back':'front';closeContext();$('#tooltip').hidden=true;world.resetCamera();refresh();}
 if(b.id==='travel-menu'){
  const gates=game.objects.filter(o=>o.type==='gate'&&sameSide(o,game.player)).sort((a,b)=>Math.hypot(a.x-game.player.x,a.z-game.player.z)-Math.hypot(b.x-game.player.x,b.z-game.player.z));
  if(gates.length){const r=b.getBoundingClientRect();showContext({kind:'object',id:gates[0].id},r.left,r.bottom+40);}else toast('这一面还没有星门，请在物品包中购买。');
 }
 if(b.id==='build-button')toggleBuild();
 if(b.id==='cancel-placement')cancelPlacement();
 if(b.id==='all-neighbors')changeTab('relations');
 if(b.id==='zoom-in')world.zoom(.15);if(b.id==='zoom-out')world.zoom(-.15);if(b.id==='reset-view')world.resetCamera();if(b.id==='focus-player'){game.viewIsland=islandOf(game.player);game.viewSide=sideOf(game.player);world.focus('player');refresh();}
 if(b.id==='context-close')closeContext();if(b.id==='sound')toggleSound();
});
$('#app').addEventListener('click',async e=>{if(e.target.closest('#randomize-heads')){await randomizeHeads(game);refreshPortraits();lastPanel='';refresh();toast('所有居民的头型与触角长度已随机。');}});
$('#app').addEventListener('change',async e=>{if(e.target.id==='study-focus'){await command('studyFocus',e.target.value||null);e.target.blur();save();lastPanel='';renderPanel();}if(e.target.id==='family-desire'){e.target.blur();await command('familyDesire',selectedResident,Number(e.target.value));lastPanel='';renderPanel();}});
$('#app').addEventListener('submit',async e=>{
 if(e.target.id==='config-form'){applyConfig(e);return;}if(e.target.id!=='resident-form')return;e.preventDefault();
 const headShape=Object.fromEntries(Object.keys(HEAD_SHAPE).map(key=>[key,Number($(`[name="${key}"]`).value)/100]));
 const result=await updateResident(game,selectedResident,{gender:$('#resident-gender').value,age:Number($('#resident-age').value),devotion:Number($('#resident-devotion').value),headShape});
 if(!result.ok){toast(result.message);return;}refreshPortraits();lastPanel='';refresh();toast('人物设定已更新。');
});
document.addEventListener('keydown',async e=>{if(document.body.classList.contains('island-floating')||document.querySelector('dialog[open]')||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;if(e.code==='Space'){e.preventDefault();await command('speed',game.speed?0:1);refresh();}if(e.key==='1'||e.key==='3'){await command('speed',Number(e.key));refresh();}if(e.key.toLowerCase()==='b')toggleBuild();if(e.key.toLowerCase()==='r'&&selectedItem)world.rotateBuild();if(e.key==='Escape'){cancelPlacement();closeContext();closeCharacterSwitcher();}});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#context-menu')&&!e.target.closest('[data-npc]'))closeContext();if(!e.target.closest('#character-switcher')&&!e.target.closest('#active-character'))closeCharacterSwitcher();});
setupDashboardResize();
let audioContext=null,audioOn=false;
async function toggleSound(){if(!audioContext){audioContext=new AudioContext();const gain=audioContext.createGain();gain.gain.value=.015;gain.connect(audioContext.destination);[130.81,196,261.63,329.63].forEach((f,i)=>{const osc=audioContext.createOscillator();osc.type='sine';osc.frequency.value=f;const volume=audioContext.createGain();volume.gain.value=.28;osc.connect(volume).connect(gain);const lfo=audioContext.createOscillator();lfo.frequency.value=.07+i*.03;const depth=audioContext.createGain();depth.gain.value=.14;lfo.connect(depth).connect(volume.gain);lfo.start();osc.start();});}audioOn=!audioOn;if(audioOn)await audioContext.resume();else await audioContext.suspend();$('#sound').innerHTML=icon(audioOn?'Volume2':'VolumeX');$('#sound').classList.toggle('active',audioOn);}

let lastHover=null;
function showHoverTooltip(target,x,y){
 const el=$('#tooltip');let text,cargo=false;
 if(target?.kind==='ufo'){
  const ship=game.space.ships.find(s=>s.id===target.id);if(!ship){el.hidden=true;return;}
  const def=ufoDefinition(ship);cargo=true;
  text=`${def.name}\n本岛建材库存 ${game.space.materials[ship.island]??0} 份\n建材装填 ${game.space.cargo[ship.id]??0} / ${def.cargoCapacity} 份\n补给 ${ship.food}/${shipFoodStatus(ship).capacity} · 剩余 ${Math.floor(ship.durability/UFO_WEAR_PER_FLIGHT)} 次单程航行`;
 }else{
  if(!target||target.kind==='player'||selectedItem||target.kind==='npc'&&!game.npcs[target.id]){el.hidden=true;return;}
  if(target.kind==='npc')text=`${neighbors(game).find(n=>n.id===target.id).name} · ${game.npcs[target.id].activity}`;
  else{
   const o=game.objects.find(o=>o.id===target.id);if(!o){el.hidden=true;return;}
   const name=ITEMS.find(i=>i.id===o.type).name;
   cargo=['materialCabinet','loadingPlatform'].includes(o.type);
   if(cargo){
    const ships=game.space.ships.filter(s=>sameSide(s,o)),loaded=ships.reduce((n,s)=>n+(game.space.cargo[s.id]??0),0),capacity=ships.reduce((n,s)=>n+ufoDefinition(s).cargoCapacity,0);
    text=`${name}\n本岛建材库存 ${game.space.materials[islandOf(o)]??0} 份\n同岛面飞船装填 ${loaded} / ${capacity} 份${ships.length?'':'\n本岛面暂无飞船'}`;
   }else text=`${name}${CROPS[o.type]?' · '+plantStatus(o):' · 点击互动'}`;
  }
 }
 el.textContent=text;el.toggleAttribute('data-cargo',cargo);el.hidden=false;
 el.style.maxWidth=`${Math.min(280,innerWidth-16)}px`;
 const bounds=el.getBoundingClientRect();
 el.style.left=`${Math.max(8,Math.min(x+15,innerWidth-bounds.width-8))}px`;
 el.style.top=`${Math.max(8,Math.min(y-bounds.height-12,innerHeight-bounds.height-8))}px`;
}

try{
 world=await createWorld($('#world'),()=>game,{
  onClick:showContext,
  onHover(target,x,y){lastHover={target,x,y};showHoverTooltip(target,x,y);},
  async onPlace(type,x,z,rotation){const result=await buyItem(game,type,x,z,rotation);if(result.ok){toast(type==='mushroom'?'已安排人物前往种植。':`${ITEMS.find(i=>i.id===type).name}已放入家园。`);cancelPlacement();refresh();}else toast(result.message);}
 });
 refreshPortraits();
 $('#loading').hidden=true;refresh();
 let previous=performance.now(),uiElapsed=0,frameWindow=window,frameId;
 function frame(){frameId=frameWindow.requestAnimationFrame(frame);const now=performance.now(),dt=Math.min((now-previous)/1000,.1);previous=now;if(!hosted)tick(game,dt);else visualGame=presentation.sample(game,now);world.render(visualGame);uiElapsed+=dt;if(uiElapsed>.2){refresh();if(lastHover&&!$('#tooltip').hidden)showHoverTooltip(lastHover.target,lastHover.x,lastHover.y);uiElapsed=0;}}
 const floating=createFloatingIsland($('#world'),{returnIcon:icon('ArrowLeft'),
  onEnter(){if(build)toggleBuild();cancelPlacement();closeContext();closeCharacterSwitcher();$('#tooltip').hidden=true;world.setSceneOnly(true);},
  onLeave(){world.setSceneOnly(false);floatingButton.focus();},
  onWindowChange(next){frameWindow.cancelAnimationFrame(frameId);frameWindow=next;previous=performance.now();frameId=frameWindow.requestAnimationFrame(frame);}
 });
 floatingButton.disabled=false;floatingButton.onclick=()=>floating.open().catch(error=>toast(error.message));frameId=frameWindow.requestAnimationFrame(frame);
 document.addEventListener('visibilitychange',()=>{previous=performance.now();});
}catch(error){console.error(error);$('#loading').innerHTML=`${icon('TriangleAlert')}<h2>星湾暂时无法加载</h2><p>请使用支持 WebGL 的现代浏览器，并确认 3D 资产加载正常。</p><button class="primary" onclick="location.reload()">重新降落</button>`;}
