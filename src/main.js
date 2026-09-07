import {createPersistence} from './persistence.js';
import {CROPS,plantStatus,plantActionError} from './plants.js';
import './style.css';
import {createElement,Orbit,Sun,Pause,Play,FastForward,Sparkles,Hammer,Save,CircleHelp,CloudSun,House,Flower2,Radio,Plus,Minus,Scan,LocateFixed,VolumeX,Smile,Compass,Heart,Coffee,HeartPulse,Users,BriefcaseBusiness,PackageOpen,ArrowUpRight,X,MousePointer2,ArrowRight,Move,Check,Frown,Volume2,TriangleAlert,Utensils,Zap,MessagesSquare,Droplets,Armchair,Atom,Sprout,BedDouble,Music2,Telescope,Gem,TreePine,Lamp,Footprints,Moon,Gift,Coins} from 'lucide';
import {createWorld} from './world.js';
import {NEEDS,neighbors,birthDecision,gameMinutes,takeOver,CAREERS,ITEMS,ACTIONS,createGame,tick,enqueue,cancelAction,buyItem,sellItem,setCareer,setAutonomy,sellHarvest,updateResident,canAffordAction} from './simulation.js';
import {GENDERS,SKILLS,STAGES,lifeStage,skillProgress} from './characters.js';

const $=s=>document.querySelector(s);
const icons={Orbit,Sun,Pause,Play,FastForward,Sparkles,Hammer,Save,CircleHelp,CloudSun,House,Flower2,Radio,Plus,Minus,Scan,LocateFixed,VolumeX,Smile,Compass,Heart,Coffee,HeartPulse,Users,BriefcaseBusiness,PackageOpen,ArrowUpRight,X,MousePointer2,ArrowRight,Move,Check,Frown,Volume2,TriangleAlert,Utensils,Zap,MessagesSquare,Droplets,Armchair,Atom,Sprout,BedDouble,Music2,Telescope,Gem,TreePine,Lamp,Footprints,Moon,Gift,Coins};
const icon=(name,cls='')=>{const el=createElement(icons[name]);el.setAttribute('class',`icon ${cls}`);el.setAttribute('aria-hidden','true');return el.outerHTML;};
const persistence=createPersistence();let game;
$('#app').innerHTML='<div id="loading"><h2>正在读取星湾存档</h2><p>从服务器恢复你的生活进度…</p></div>';
try{game=await persistence.load();}catch(error){
 console.error('游戏存档读取失败',error);
 $('#app').innerHTML='<div id="loading"><h2>暂时无法读取存档</h2><p>请检查游戏服务后重试，现有存档不会被覆盖。</p><button id="retry-load">重新读取</button></div>';
 $('#retry-load').onclick=()=>location.reload();throw error;
}
let lastLifeState='',lastHarvest='';let world,tab='needs',build=false,speedBeforeBuild=1,pack='全部',selectedItem=null,context=null,toastTimer,portraits={},portraitKey='',selectedResident='player',lastLog='',lastPanel='',saveBlocked=false;
const fmt=n=>Math.floor(n).toLocaleString('zh-CN');
const buttons=(items)=>items.map(([label,i,attr])=>`<button ${attr} title="${label}" aria-label="${label}">${icon(i)}</button>`).join('');

$('#app').innerHTML=`
 <div id="world" aria-label="可交互的外星家园 3D 场景"></div>
 <header class="topbar">
  <a class="brand" href="/" aria-label="星外日常">${icon('Orbit')}<div><b>星外日常<span>ORBIT LIFE</span></b><small>在宇宙的一角，好好生活。</small></div></a>
  <div class="time-control"><div class="day">${icon('Sun')}<span id="day">第 1 天</span><b id="clock">08:30</b></div><div class="speed-buttons">${buttons([['暂停','Pause','data-speed="0"'],['正常速度','Play','data-speed="1"'],['三倍速度','FastForward','data-speed="3"']])}</div></div>
  <div class="top-actions"><div class="wallet">${icon('Sparkles')}<strong id="money">2,400</strong><small>星币</small></div><button id="build-button" class="build-button" aria-label="建造模式">${icon('Hammer')}<span>建造模式</span><kbd>B</kbd></button><button class="icon-button" id="save" title="保存游戏" aria-label="保存游戏">${icon('Save')}</button><button class="icon-button" id="help" title="操作指南" aria-label="操作指南">${icon('CircleHelp')}</button></div>
 <span id="save-status" title="每 60 秒保存到服务器；离开页面和刷新前也会保存。"></span></header>
 <main class="scene-ui">
  <div class="location"><span class="eyebrow">KEPLER–186F / 居住区 07</span><h1>露米纳星湾<span class="live-dot"></span></h1><p>${icon('CloudSun')} 22° · 微风带着星尘</p></div>
  <div class="locations" aria-label="场景导航"><button class="active" data-location="all">${icon('House')}<span>我的家园</span></button><button data-location="garden">${icon('Flower2')}<span>孢子花园</span></button><button data-location="lab">${icon('Orbit')}<span>科研星港</span></button></div>
  <aside class="aspiration"><div class="card-label">${icon('Sparkles')} 今日小心愿 <span>01</span></div><h3 id="wish-title">宇宙这么大，先交个朋友</h3><p id="wish-desc">点击一位邻居，聊聊彼此的母星。</p><div class="wish-progress"><span id="wish-bar"></span></div><small id="wish-count">认识你的星际邻居 · 0 / 1</small></aside>
  <aside id="life-alert" hidden></aside><aside class="journal"><div class="card-label">${icon('Radio')} 星湾电台 <span class="live-dot"></span></div><p id="journal-text"></p><small id="journal-time">刚刚</small></aside>
  <div id="queue-wrap"><div class="queue-label"><span>行动队列</span><small>点击 × 取消</small></div><div id="queue"></div><p id="autonomy-reason" hidden></p></div>
  <div class="view-tools">${buttons([['拉近视角','Plus','id="zoom-in"'],['拉远视角','Minus','id="zoom-out"'],['重置视角','Scan','id="reset-view"'],['跟随凯伊','LocateFixed','id="focus-player"'],['环境音乐','VolumeX','id="sound"']])}</div>
  <div class="scene-caption"><span class="live-dot"></span> 生活正在发生 <i>·</i> 点击人物或物品互动</div>
 </main>
 <div id="build-hint" hidden>${icon('Move')} 点击地面摆放 <span>R 旋转</span><span>Esc 取消</span><button id="cancel-placement">取消</button></div>
 <section class="dashboard">
  <div class="profile"><div class="avatar-wrap"><img id="player-portrait" alt="凯伊的外星人头像"/><span class="mood-dot">✦</span></div><div class="profile-copy"><span class="eyebrow" id="player-bio">你的星际居民</span><h2 id="player-name">凯伊 <span>KAÏ</span></h2><span id="mood" class="mood">${icon('Smile')} 心情不错</span></div><div class="profile-traits"><span>${icon('Compass')} 好奇心旺盛</span><span>${icon('Heart')} 热爱生活</span></div><div class="current-activity"><span id="activity">${icon('Coffee')} 享受此刻的宁静</span><button id="autonomy" role="switch" aria-label="自主行为" aria-checked="false" title="自主行为已关闭 · 点击开启">自主</button></div></div>
  <div class="details"><nav class="panel-tabs"><button class="active" data-tab="needs">${icon('HeartPulse')} 需求</button><button data-tab="skills">${icon('Sparkles')} 技能</button><button data-tab="resident">${icon('Smile')} 人物</button><button data-tab="relations">${icon('Users')} 关系</button><button data-tab="career">${icon('BriefcaseBusiness')} 职业</button><button data-tab="life">${icon('Sprout')} 生命</button><button data-tab="items">${icon('PackageOpen')} 物品包</button><span id="panel-tag">一切都刚刚好</span></nav><div id="panel-content"></div></div>
  <div class="neighbors"><div class="card-label">你的邻居 <span>4 位居民</span></div><div id="neighbor-portraits"></div><p>每个星球，都有值得认识的人。</p><button id="all-neighbors">查看关系 ${icon('ArrowUpRight')}</button></div>
 </section>
 <dialog id="harvest-dialog"><button id="close-harvest" aria-label="关闭收成仓库">${icon('X')}</button><span class="eyebrow">星湾的收获</span><h2>收成仓库</h2><p>主控居民采收的产物会存放在这里；NPC 的收成归各自所有。</p><div id="harvest-content"></div></dialog><div id="tooltip" hidden></div><div id="context-menu" hidden></div><div id="toast" role="status" hidden></div>
 <div id="loading"><div class="loading-orbit">${icon('Orbit')}</div><h2>正在降落露米纳星湾</h2><p>唤醒居民，点亮蘑菇，准备新的日常…</p></div>
 <dialog id="help-dialog"><button class="dialog-close" aria-label="关闭指南">${icon('X')}</button><span class="eyebrow">欢迎来到露米纳</span><h2>你的生活，由你安排。</h2><p>你是凯伊，一位刚刚搬来星湾的外星居民。照顾自己、认识邻居、布置家园，再找到一份喜欢的工作。</p><div class="help-grid"><div>${icon('MousePointer2')}<b>点一点，开始生活</b><p>点击人物或物品选择互动；点击空地行走。可以连续安排 6 个行动。</p></div><div>${icon('HeartPulse')}<b>照顾六种需求</b><p>吃饭、星眠、净化、休息、跳舞与社交，会影响你的心情。</p></div><div>${icon('Hammer')}<b>打造异星小家</b><p>B 打开建造，选择家具后点击空地摆放。R 旋转，Esc 取消。建造中点击家具可出售。</p></div><div>${icon('BriefcaseBusiness')}<b>找到银河里的工作</b><p>职业页选择方向，在研究台完成班次赚取星币。每完成 3 个班次晋升一次，共 3 级。</p></div></div><div class="shortcut-row"><span><kbd>空格</kbd> 暂停</span><span><kbd>1 / 3</kbd> 时间速度</span><span>右键拖动旋转 · 中键平移 · 滚轮缩放</span></div><p class="save-note">每 60 秒保存到服务器文件，离开页面或刷新前也会保存。不同浏览器共享同一份进度；右上角显示保存状态。</p><button class="primary dialog-close">开始我的异星日常 ${icon('ArrowRight')}</button></dialog>
`;

function toast(message){$('#toast').innerHTML=`${icon('Sparkles')} ${message}`;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,3500);}
async function save(manual=false){
 if(saveBlocked)return false;
 $('#save-status').dataset.state='saving';
 try{
  const saved=await persistence.save(game);if(saveBlocked)return false;
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
$('#save-status').textContent='已恢复服务器存档 · 每分钟自动保存';
$('#save-status').dataset.state='ready';
setInterval(()=>save(),60000);
document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});
window.addEventListener('pagehide',()=>save());
window.addEventListener('beforeunload',()=>save());
if(import.meta.hot)import.meta.hot.on('vite:beforeFullReload',()=>save());

function changeTab(next){tab=next;document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));lastPanel='';renderPanel();}
function relationName(n){return n>=70?'挚友':n>=35?'朋友':'初识';}
function resident(){return selectedResident==='player'?game.player:game.npcs[selectedResident];}
function residentPicker(){return `<label class="resident-picker">查看居民 <select id="resident-select">${[{id:'player',name:`${game.player.name}（主控）`},...neighbors(game)].map(n=>`<option value="${n.id}" ${n.id===selectedResident?'selected':''}>${n.name}</option>`).join('')}</select></label>`;}
function refreshPortraits(){
 if(!world)return;const key=[game.player,...Object.values(game.npcs)].map(p=>`${p.uid}-${p.alive}-${p.gender}-${lifeStage(p.age)}`).join('|');if(key===portraitKey)return;portraitKey=key;
 portraits=Object.fromEntries(['player',...neighbors(game).map(n=>n.id)].map(id=>[id,world.portrait(id)]));$('#player-portrait').src=portraits.player;$('#player-portrait').alt=`${game.player.name}的外星人头像`;$('#player-name').textContent=game.player.name;$('.profile-traits').innerHTML=game.player.trait.split(' · ').map(t=>`<span>${icon('Sparkles')} ${t}</span>`).join('');$('.neighbors .card-label span').textContent=`${neighbors(game).length} 位居民`;
 $('#neighbor-portraits').innerHTML=neighbors(game).map(n=>`<button data-npc="${n.id}" title="${n.name} · ${GENDERS[game.npcs[n.id].gender]} · ${STAGES[lifeStage(game.npcs[n.id].age)]}" aria-label="与${n.name}互动"><img src="${portraits[n.id]}" alt="${n.name}"/><span>${n.name}</span><i></i></button>`).join('');lastPanel='';
}
function renderPanel(){
 if(selectedResident!=='player'&&!game.npcs[selectedResident])selectedResident='player';
 const person=resident(),skills=selectedResident==='player'?game.skills:person.skills,funds=selectedResident==='player'?game.money:person.money;
 const signature=tab==='life'?JSON.stringify([selectedResident,person.uid,person.alive,person.familyDesire,game.autonomy.enabled,birthDecision(game,selectedResident).reason,Math.floor(game.minute),game.incubations,game.memorials,game.money,neighbors(game).map(n=>[n.id,Math.floor(n.needs.hunger),Math.floor(n.age)])]):tab==='needs'?Object.values(game.needs).map(Math.floor).join(','):tab==='relations'?JSON.stringify([game.relationships,neighbors(game).map(n=>game.npcs[n.id].activity)]):tab==='career'?JSON.stringify([game.career,game.skills]):tab==='skills'?JSON.stringify([selectedResident,skills]):tab==='resident'?`${selectedResident}-${person.gender}-${Math.floor(person.age)}-${Math.floor(funds)}`:`${pack}-${build}`;
 if(signature===lastPanel||tab==='life'&&document.activeElement?.matches('#panel-content select'))return;lastPanel=signature;
 $('#panel-tag').textContent=tab==='needs'?'六种需求 · 一种好生活':tab==='relations'?'友谊也需要悉心照料':tab==='career'?'在银河找到自己的位置':tab==='skills'?'通过实际行动积累经验':tab==='resident'?'每 8 天增长 1 星岁':tab==='life'?'新生、陪伴与告别':build?'选择物品 → 点击地面摆放':`3 个主题包 · ${ITEMS.length} 件物品`;
 if(tab==='life'){
  const decision=birthDecision(game,selectedResident),children=[game.player,...Object.values(game.npcs),...game.memorials].filter(n=>n.parents.some(p=>p.uid===person.uid));
  if(!$('.life-panel'))$('#panel-content').innerHTML='<div class="life-panel"></div>';
  $('.life-panel').innerHTML=`<div class="life-person">${residentPicker()}<label class="family-label">生育意愿 <select id="family-desire" ${person.alive?'':'disabled'}><option value="0" ${person.familyDesire<.4?'selected':''}>暂不考虑</option><option value="0.7" ${person.familyDesire>=.4&&person.familyDesire<.9?'selected':''}>顺其自然</option><option value="1" ${person.familyDesire>=.9?'selected':''}>期待家人</option></select></label><p id="fertility-reason">${decision.reason}</p><small>${selectedResident==='player'&&!game.autonomy.enabled?'开启「自主」后，主控居民才会自主安排生育。':'本地 AI 会把生育与日常需求一起权衡。'}</small><p class="family-line">亲代：${person.parents.map(p=>p.name).join('、')||'星湾初代'} · 子女：${children.map(p=>p.name).join('、')||'暂无'}</p><p class="family-line">遗传：${person.trait} · ${person.mutations.length?person.mutations.join('、'):'未发现突变'}<br>身高 ${Math.round(person.genome.stature*100)}% · 体型 ${Math.round(person.genome.build*100)}% · 触角 ${Math.round(person.genome.antenna*100)}%</p></div><div class="life-events"><h4>星芽育生 <span>3 天孵育 · 300 星币</span></h4>${game.incubations.length?game.incubations.map(b=>`<p class="birth-entry">${icon('Sprout')}<span>${b.parents.map(p=>p.name).join('与')}的星芽<small>${b.due>gameMinutes(game)?`还有 ${Math.ceil(b.due-gameMinutes(game))} 游戏分钟出生`:'已成熟，等待育生舱旁腾出空地'}</small></span></p>`).join(''):'<p class="life-empty">暂无孕育中的星芽。在物品包购买育生舱，让家园具备迎接新生命的条件。</p>'}<h4>星湾纪念 <span>${game.memorials.length} 位逝者</span></h4>${game.memorials.map(m=>`<p class="memorial-entry">${m.name}<small>${Math.floor(m.age)} 星岁 · 第 ${m.day} 天 · ${m.cause==='old_age'?'寿终':'长期饥饿'}</small></p>`).join('')||'<p class="life-empty">每一段生命，都值得被记住。</p>'}${!game.player.alive?`<div class="successors"><h4>选择继续陪伴的居民</h4>${neighbors(game).filter(n=>n.age>=3).map(n=>`<button data-inherit="${n.id}">接管 ${n.name}</button>`).join('')||'<p class="life-empty">暂无可接管的居民。</p><button id="new-life">重新开始星湾生活</button>'}</div>`:''}</div>`;
 }
 if(tab==='skills')$('#panel-content').innerHTML=`<div class="skill-panel">${residentPicker()}<div class="skill-grid">${Object.entries(SKILLS).map(([key,skill])=>{const p=skillProgress(skills[key]);return `<div class="skill-card" data-skill="${key}"><div class="skill-icon">${icon(skill.icon)}</div><div class="skill-copy"><strong>${skill.name}<b>Lv.${p.level}</b></strong><div class="meter"><span style="width:${p.progress}%"></span></div><small>${p.level===10?'已满级':`经验 ${p.xp} / ${p.next}`} · ${skill.hint}</small></div></div>`;}).join('')}</div></div>`;
  if(tab==='resident')$('#panel-content').innerHTML=`<div class="resident-panel">${residentPicker()}<div class="resident-editor"><img id="resident-photo" src="${portraits[selectedResident]}" alt="居民外形预览"/><form id="resident-form"><fieldset ${person.alive?'':'disabled'}><div class="resident-fields"><label>性别<select id="resident-gender" aria-label="性别">${Object.entries(GENDERS).map(([key,label])=>`<option value="${key}" ${person.gender===key?'selected':''}>${label}</option>`).join('')}</select></label><label>年龄（星岁）<input id="resident-age" aria-label="年龄（星岁）" type="number" min="0" max="120" step="1" required value="${Math.floor(person.age)}"/></label><button class="primary" type="submit">应用人物设定</button></div><p id="resident-summary">${GENDERS[person.gender]} · ${Math.floor(person.age)} 星岁 · ${STAGES[lifeStage(person.age)]} · 余额 ${fmt(funds)} 星币</p><small>幼体在摇篮中成长，3 星岁后活动；长者的体态随年龄改变，120 星岁自然离世。</small></fieldset></form></div></div>`;
 if(tab==='needs')$('#panel-content').innerHTML=`<div class="needs-grid">${Object.entries(NEEDS).map(([key,[name,i]])=>{const value=Math.floor(game.needs[key]);return`<div class="need ${value<30?'low':''}"><div class="need-icon">${icon(i)}</div><div class="need-info"><div><span>${name}</span><small>${value}<em> / 100</em></small></div><div class="meter"><span style="width:${value}%"></span></div></div></div>`;}).join('')}</div>`;
 if(tab==='relations')$('#panel-content').innerHTML=`<div class="relationship-grid">${neighbors(game).map(n=>`<button class="relationship" data-npc="${n.id}" aria-label="与${n.name}互动"><img src="${portraits[n.id]}" alt="${n.name}"/><div><strong>${n.name}<small>${relationName(game.relationships[n.id])}</small></strong><p class="npc-activity"></p><div class="meter"><span style="width:${game.relationships[n.id]}%"></span></div></div></button>`).join('')}</div>`;
 if(tab==='relations')document.querySelectorAll('.relationship').forEach(b=>b.querySelector('.npc-activity').textContent=game.npcs[b.dataset.npc].activity);
 if(tab==='career'){const c=CAREERS[game.career.id];$('#panel-content').innerHTML=`<div class="career-layout"><div class="career-current"><div class="career-icon">${icon(c.icon)}</div><div><span class="eyebrow">${c.name} · 等级 ${game.career.level}</span><h3>${c.titles[game.career.level-1]}</h3><p>${c.wage*game.career.level} 星币 / 班次 <span>·</span> ${game.career.level===3?'已达最高等级':`晋升进度 ${game.career.shifts} / 3`}</p></div><button class="primary" id="work">开始工作 ${icon('ArrowRight')}</button></div><div class="career-options">${Object.entries(CAREERS).map(([id,c])=>`<button data-career="${id}" class="${id===game.career.id?'chosen':''}" aria-label="加入${c.name}" ${id===game.career.id?'disabled':''}>${icon(c.icon)}<span>${c.name}</span>${id===game.career.id?icon('Check'):icon('ArrowUpRight')}</button>`).join('')}</div><div class="skills">科学 ${game.skills.science} <span>·</span> 植物 ${game.skills.botany} <span>·</span> 在家具互动中提升技能</div></div>`;}
 if(tab==='items')$('#panel-content').innerHTML=`<div class="catalog"><div class="pack-filters">${['全部','生活舱','星际科技','孢子花园'].map(p=>`<button data-pack="${p}" class="${pack===p?'active':''}">${p}</button>`).join('')}<small>${build?'摆放时按 R 旋转':'购买家具，装点你的星际小家'}</small><button id="open-harvest">收成仓库</button></div><div class="item-grid">${ITEMS.filter(i=>pack==='全部'||i.pack===pack).map(i=>`<button class="item-card ${selectedItem===i.id?'selected':''}" data-item="${i.id}" aria-label="购买 ${i.name}"><div class="item-art ${i.pack==='生活舱'?'rose':i.pack==='星际科技'?'lavender':'green'}">${icon(i.icon)}</div><div><strong>${i.name}</strong><small>✦ ${i.price}</small></div><span class="item-description">${i.desc}</span></button>`).join('')}</div></div>`;
}
function plantDetails(o){const p=o.plant,crop=CROPS[o.type];return `<strong>${plantStatus(o)}</strong><div class="plant-meters">${[['生长',p.growth*100],['水分',p.water],['健康',p.health]].map(([label,value])=>`<div><span>${label}<b>${Math.floor(value)}%</b></span><div class="meter"><span style="width:${value}%"></span></div></div>`).join('')}</div><small>每轮约 ${crop.minutes/60} 游戏小时 · 健康时收获 ${crop.yield} 份${crop.name}</small><p>仓库：${game.harvest[crop.key]} 份${crop.name} · ${crop.price} 星币 / 份</p><button data-sell-crop="${crop.key}" ${game.harvest[crop.key]?'':'disabled'}>出售这类收成</button>`;}
function renderHarvest(){if(!$('#harvest-dialog').open)return;const signature=JSON.stringify(game.harvest);if(signature===lastHarvest)return;lastHarvest=signature;$('#harvest-content').innerHTML=Object.values(CROPS).map(c=>`<div class="harvest-row"><span>${c.name}<small>${c.price} 星币 / 份</small></span><b>${game.harvest[c.key]} 份</b><button data-sell-crop="${c.key}" ${game.harvest[c.key]?'':'disabled'}>出售</button></div>`).join('');}
function refresh(){
 const lifeState=`${game.player.uid}-${game.player.alive}`;if(lifeState!==lastLifeState){lastLifeState=lifeState;if(!game.player.alive){closeContext();changeTab('life');}}
 if(context?.kind==='npc'&&!game.npcs[context.id])closeContext();
 refreshPortraits();$('#player-bio').textContent=`${GENDERS[game.player.gender]} · ${Math.floor(game.player.age)} 星岁`;
 $('#money').textContent=fmt(game.money);$('#day').textContent=`第 ${game.day} 天`;$('#clock').textContent=`${String(Math.floor(game.minute/60)).padStart(2,'0')}:${String(Math.floor(game.minute%60)).padStart(2,'0')}`;
 document.querySelectorAll('[data-speed]').forEach(b=>b.classList.toggle('active',Number(b.dataset.speed)===game.speed));
 const avg=Object.values(game.needs).reduce((a,b)=>a+b)/6;$('#mood').innerHTML=`${icon(avg<35?'Frown':avg>75?'Sparkles':'Smile')} ${avg<35?'需要一点关照':avg>75?'幸福感满满':'心情不错'}`;$('#mood').classList.toggle('unhappy',avg<35);
 const endangered=[...(game.player.alive&&game.player.starvation>=720?[game.player]:[]),...neighbors(game).filter(n=>n.starvation>=720)];
 $('#life-alert').hidden=game.player.alive&&!endangered.length;$('#life-alert').textContent=!game.player.alive?`${game.player.name}已离世。时间已暂停，请在生命页选择接管居民。`:`${endangered.map(n=>n.name).join('、')}持续饥饿，请立即进食或安排照料。`;
 const q=game.queue[0];$('#activity').innerHTML=q?`${icon(ACTIONS[q.type].icon)} ${q.phase==='walking'?'正在走过去…':q.phase==='waiting'?'等待家具空闲…':ACTIONS[q.type].name}`:`${icon('Coffee')} 享受此刻的宁静`;
 if(!game.player.alive){$('#activity').textContent='这段生命已落幕';$('#mood').textContent='留在星湾的记忆';}$('#autonomy').disabled=!game.player.alive;
 $('#autonomy').setAttribute('aria-checked',String(game.autonomy.enabled));$('#autonomy').title=game.autonomy.enabled?'自主行为已开启 · 点击关闭，手动指令优先':'自主行为已关闭 · 点击开启';
 $('#autonomy-reason').hidden=!game.autonomy.enabled;$('#autonomy-reason').textContent=`${game.player.name}的想法：${game.autonomy.reason}`;
 if(context?.kind==='npc'&&$('#npc-status')){const n=game.npcs[context.id];$('#npc-status').textContent=`${n.activity} · ${n.ai.reason}`;}
 $('#queue').innerHTML=game.queue.length?game.queue.map((q,i)=>`<div class="queue-action ${i===0?'current':''}" style="--progress:${q.phase==='acting'?Math.min(100,q.elapsed/Math.max(.1,ACTIONS[q.type].duration)*100):0}%">${icon(ACTIONS[q.type].icon)}<span>${ACTIONS[q.type].name}</span>${q.source==='ai'?'<small class="ai-badge">自主</small>':''}<button data-cancel="${q.id}" aria-label="取消${ACTIONS[q.type].name}">${icon('X')}</button></div>`).join(''):`<span class="queue-empty">${icon('MousePointer2')} ${game.autonomy.enabled?'正在考虑下一件小事':'给今天安排一点小事吧'}</span>`;
 if(game.log[0]?.text!==lastLog){lastLog=game.log[0].text;$('#journal-text').textContent=lastLog;$('#journal-time').textContent=`第 ${game.day} 天 · ${$('#clock').textContent}`;}
 const friends=Object.values(game.relationships).some(n=>n>=30);$('#wish-count').textContent=friends?'认识你的星际邻居 · 已完成':'认识你的星际邻居 · 0 / 1';$('#wish-bar').style.width=friends?'100%':'12%';if(friends){$('#wish-title').textContent='你在这颗星球，有朋友了';$('#wish-desc').textContent='继续交谈、讲笑话，让初识成为挚友。';}
 if(context?.kind==='object'){const o=game.objects.find(o=>o.id===context.id);if(!o)closeContext();else if(CROPS[o.type]&&$('#plant-status')){$('#plant-status').innerHTML=plantDetails(o);for(const b of document.querySelectorAll('#context-menu [data-action]')){const error=plantActionError(o,b.dataset.action);b.disabled=!!error;b.title=error||'';}}}
 renderHarvest();renderPanel();
}
function closeContext(){$('#context-menu').hidden=true;context=null;}
function showContext(target,x,y){
 if(target.kind==='ground'){closeContext();const result=enqueue(game,'walk',null,target.point);if(!result.ok)toast(result.message);refresh();return;}
 if(target.kind==='npc'&&!game.npcs[target.id])return;
 if(target.kind==='player'){changeTab('needs');world.focus('player');return;}
 context=target;let title,subtitle,actions;
 if(target.kind==='npc'){const npc=neighbors(game).find(n=>n.id===target.id),person=game.npcs[target.id];title=npc.name;subtitle=`${GENDERS[person.gender]} · ${Math.floor(person.age)} 星岁 · ${STAGES[lifeStage(person.age)]} · ${npc.trait} · 友好度 ${game.relationships[npc.id]}`;actions=person.age<3?['care']:['chat','joke','gift'];if(person.age>=18&&game.player.age>=18)actions.push('flirt');}
 else{const obj=game.objects.find(o=>o.id===target.id);const item=ITEMS.find(i=>i.id===obj.type);title=item.name;subtitle=item.desc;actions=[item.action];if(CROPS[obj.type])actions=['garden','harvest','replant'];if(obj.type==='lab')actions.push('work');if(obj.type==='nursery'){const birth=game.incubations.find(b=>b.podId===obj.id);if(birth){subtitle=`${birth.parents.map(p=>p.name).join('与')}的星芽 · 还有 ${Math.ceil(birth.due-gameMinutes(game))} 游戏分钟出生`;actions=[];}}}
  actions=actions.filter(a=>canAffordAction(game,'player',a));const el=$('#context-menu');el.innerHTML=`<div class="context-heading"><div><strong>${title}</strong><small>${subtitle}</small></div><button id="context-close" aria-label="关闭互动菜单">${icon('X')}</button></div><div class="context-actions">${actions.map(a=>`<button data-action="${a}" ${ACTIONS[a].minRelation&&(game.relationships[target.id]??0)<ACTIONS[a].minRelation?'disabled title="需要 35 友好度"':''}>${icon(ACTIONS[a].icon)}<span>${ACTIONS[a].name}</span><small>${ACTIONS[a].duration} 秒</small></button>`).join('')}${build&&target.kind==='object'?`<button data-sell="${target.id}" class="sell-action">${icon('Coins')} 出售 · 返还 70% 星币</button>`:''}</div>`;el.hidden=false;el.style.left=`${Math.max(12,Math.min(x+15,innerWidth-320))}px`;el.style.top=`${Math.max(85,Math.min(y-40,innerHeight-325))}px`;
 if(target.kind==='object'&&CROPS[game.objects.find(o=>o.id===target.id).type]){const o=game.objects.find(o=>o.id===target.id),status=document.createElement('div');status.id='plant-status';status.innerHTML=plantDetails(o);el.querySelector('.context-heading').after(status);for(const b of el.querySelectorAll('[data-action]')){const error=plantActionError(o,b.dataset.action);b.disabled=!!error;b.title=error||'';}}
 if(target.kind==='object'&&actions.includes('incubate')){const label=document.createElement('label');label.className='birth-partner';label.innerHTML=`共同亲代 <select id="birth-partner"><option value="">单亲芽殖</option>${neighbors(game).filter(n=>n.age>=18&&n.age<90&&n.familyDesire>=.4&&game.relationships[n.id]>=35).map(n=>`<option value="${n.id}">${n.name}</option>`).join('')}</select><small>双亲混合外形与兴趣；每次出生有 12% 概率出现外形突变。</small>`;el.querySelector('.context-heading').after(label);}
 if(target.kind==='npc'){const n=game.npcs[target.id],status=document.createElement('p');status.id='npc-status';status.textContent=`${n.activity} · ${n.ai.reason}`;el.querySelector('.context-heading').after(status);}
}
function selectItem(id){selectedItem=id;if(!build){speedBeforeBuild=game.speed;game.speed=0;}build=true;$('#build-button').classList.add('active');world.setBuild(id);$('#build-hint').hidden=false;lastPanel='';renderPanel();closeContext();toast(`已选择${ITEMS.find(i=>i.id===id).name}，点击地面摆放。`);}
function cancelPlacement(){selectedItem=null;world.setBuild(null);$('#build-hint').hidden=true;lastPanel='';renderPanel();}
function toggleBuild(){build=!build;$('#build-button').classList.toggle('active',build);if(build){speedBeforeBuild=game.speed;game.speed=0;}else{cancelPlacement();game.speed=speedBeforeBuild;}changeTab(build?'items':'needs');closeContext();refresh();}
$('#app').addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.speed!==undefined){game.speed=Number(b.dataset.speed);refresh();}
 if(b.id==='autonomy'){setAutonomy(game,!game.autonomy.enabled);toast(game.autonomy.enabled?'自主行为已开启，手动安排随时优先。':'自主行为已关闭，保留你的手动安排。');refresh();}
 if(b.dataset.tab)changeTab(b.dataset.tab);
 if(b.dataset.inherit){const result=takeOver(game,b.dataset.inherit);if(result.ok){selectedResident='player';portraitKey='';lastPanel='';refresh();save();toast(`现在由你陪伴${game.player.name}生活。`);}else toast(result.message);}
 if(b.id==='new-life'&&confirm('重新开始将覆盖当前存档，确定开始新的星湾生活吗？')){game=createGame();selectedResident='player';portraitKey='';lastPanel='';closeContext();refresh();save(true);}
 if(b.dataset.cancel){cancelAction(game,Number(b.dataset.cancel));refresh();}
 if(b.dataset.npc){const r=b.getBoundingClientRect();showContext({kind:'npc',id:b.dataset.npc},r.left,r.top-260);}
 if(b.dataset.action&&context){const result=enqueue(game,b.dataset.action,context.id,undefined,$('#birth-partner')?.value||null);if(!result.ok)toast(result.message);else toast(`已安排：${ACTIONS[b.dataset.action].name}`);closeContext();refresh();}
 if(b.dataset.career){if(setCareer(game,b.dataset.career)){toast(`已加入${CAREERS[b.dataset.career].name}职业。`);lastPanel='';refresh();}else toast('请先完成或取消当前工作班次。');}
 if(b.dataset.pack){pack=b.dataset.pack;lastPanel='';renderPanel();}
 if(b.dataset.item)selectItem(b.dataset.item);
 if(b.dataset.location){document.querySelectorAll('[data-location]').forEach(x=>x.classList.toggle('active',x===b));if(b.dataset.location==='all')world.resetCamera();else world.focus(b.dataset.location);}
 if(b.dataset.sell){if(sellItem(game,b.dataset.sell)){toast('家具已出售，返还 70% 星币。');refresh();}else toast('请先取消与这件家具相关的行动。');closeContext();}
 if(b.id==='work'){const lab=game.objects.find(o=>o.type==='lab');const result=enqueue(game,'work',lab?.id);toast(result.ok?`已安排工作班次，${game.player.name}将前往研究台。`:result.message);refresh();}
 if(b.id==='open-harvest'){$('#harvest-dialog').showModal();renderHarvest();}
 if(b.id==='close-harvest')$('#harvest-dialog').close();
 if(b.dataset.sellCrop){const result=sellHarvest(game,b.dataset.sellCrop);toast(result.message);refresh();}
 if(b.id==='save')save(true);
 if(b.id==='help')$('#help-dialog').showModal();
 if(b.classList.contains('dialog-close'))$('#help-dialog').close();
 if(b.id==='build-button')toggleBuild();
 if(b.id==='cancel-placement')cancelPlacement();
 if(b.id==='all-neighbors')changeTab('relations');
 if(b.id==='zoom-in')world.zoom(.15);if(b.id==='zoom-out')world.zoom(-.15);if(b.id==='reset-view')world.resetCamera();if(b.id==='focus-player')world.focus('player');
 if(b.id==='context-close')closeContext();if(b.id==='sound')toggleSound();
});
$('#app').addEventListener('change',e=>{if(e.target.id==='family-desire'){e.target.blur();resident().familyDesire=Number(e.target.value);lastPanel='';renderPanel();}if(e.target.id==='resident-select'){e.target.blur();selectedResident=e.target.value;lastPanel='';renderPanel();}});
$('#app').addEventListener('submit',e=>{
 if(e.target.id!=='resident-form')return;e.preventDefault();
 const result=updateResident(game,selectedResident,{gender:$('#resident-gender').value,age:Number($('#resident-age').value)});
 if(!result.ok){toast(result.message);return;}refreshPortraits();lastPanel='';refresh();toast('人物设定已更新，外形已同步。');
});
document.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]')||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;if(e.code==='Space'){e.preventDefault();game.speed=game.speed?0:1;refresh();}if(e.key==='1'||e.key==='3'){game.speed=Number(e.key);refresh();}if(e.key.toLowerCase()==='b')toggleBuild();if(e.key.toLowerCase()==='r'&&selectedItem)world.rotateBuild();if(e.key==='Escape'){cancelPlacement();closeContext();}});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#context-menu')&&!e.target.closest('[data-npc]'))closeContext();});
let audioContext=null,audioOn=false;
async function toggleSound(){if(!audioContext){audioContext=new AudioContext();const gain=audioContext.createGain();gain.gain.value=.015;gain.connect(audioContext.destination);[130.81,196,261.63,329.63].forEach((f,i)=>{const osc=audioContext.createOscillator();osc.type='sine';osc.frequency.value=f;const volume=audioContext.createGain();volume.gain.value=.28;osc.connect(volume).connect(gain);const lfo=audioContext.createOscillator();lfo.frequency.value=.07+i*.03;const depth=audioContext.createGain();depth.gain.value=.14;lfo.connect(depth).connect(volume.gain);lfo.start();osc.start();});}audioOn=!audioOn;if(audioOn)await audioContext.resume();else await audioContext.suspend();$('#sound').innerHTML=icon(audioOn?'Volume2':'VolumeX');$('#sound').classList.toggle('active',audioOn);}

try{
 world=await createWorld($('#world'),()=>game,{
  onClick:showContext,
  onHover(target,x,y){const el=$('#tooltip');if(!target||target.kind==='player'||selectedItem||target.kind==='npc'&&!game.npcs[target.id]){el.hidden=true;return;}const name=target.kind==='npc'?neighbors(game).find(n=>n.id===target.id).name:ITEMS.find(i=>i.id===game.objects.find(o=>o.id===target.id).type).name;el.textContent=target.kind==='npc'?`${name} · ${game.npcs[target.id].activity}`:`${name}${CROPS[game.objects.find(o=>o.id===target.id).type]?' · '+plantStatus(game.objects.find(o=>o.id===target.id)):' · 点击互动'}`;el.style.left=`${Math.min(x+15,innerWidth-280)}px`;el.style.top=`${y-42}px`;el.hidden=false;},
  onPlace(type,x,z,rotation){const result=buyItem(game,type,x,z,rotation);if(result.ok){toast(`${ITEMS.find(i=>i.id===type).name}已放入家园。`);cancelPlacement();refresh();}else toast(result.message);}
 });
 refreshPortraits();
 $('#loading').hidden=true;refresh();
 let previous=performance.now(),uiElapsed=0;function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-previous)/1000,.1);previous=now;tick(game,dt);world.render(now/1000);uiElapsed+=dt;if(uiElapsed>.2){refresh();uiElapsed=0;}}requestAnimationFrame(frame);
 document.addEventListener('visibilitychange',()=>{previous=performance.now();});
}catch(error){console.error(error);$('#loading').innerHTML=`${icon('TriangleAlert')}<h2>星湾暂时无法加载</h2><p>请使用支持 WebGL 的现代浏览器，并确认 3D 资产加载正常。</p><button class="primary" onclick="location.reload()">重新降落</button>`;}
