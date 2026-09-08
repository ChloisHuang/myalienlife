import {islandOf} from './island.js';
import {sameSide} from './island.js';

export const WONDER_ACTIONS={
 lightDaily:{name:'切换日常星光',icon:'Lamp',duration:3,effects:{}},
 lightGrow:{name:'开启孢子生长光',icon:'Sprout',duration:3,effects:{}},
 lightParty:{name:'开启聚会星光',icon:'Users',duration:3,effects:{}},
 catchBugs:{name:'捕捉幽光虫 · 收集微尘',icon:'Sparkles',duration:10,effects:{fun:12},skill:'botany'},
 releaseBugs:{name:'放飞幽光虫 · 虫群表演',icon:'Wind',duration:10,effects:{fun:20}},
 traceRelic:{name:'拓印残纹 · 第一章',icon:'Gem',duration:18,effects:{fun:15},skill:'science'},
 decodeRelic:{name:'解读星图 · 第二章',icon:'Atom',duration:22,effects:{fun:18},skill:'science'},
 decodeTogether:{name:'邀请邻居协作解读',icon:'Users',duration:18,effects:{fun:18,social:20},skill:'science',paired:true},
 restoreMemory:{name:'重现文明记忆 · 第三章',icon:'Orbit',duration:24,effects:{fun:25},skill:'science'},
 tuneSleep:{name:'切换安眠 · 重新充能',icon:'Moon',duration:12,effects:{}},
 tuneInsight:{name:'切换灵感 · 重新充能',icon:'Atom',duration:12,effects:{}},
 activateCrystal:{name:'激活当前共振 · 1 幽光微尘',icon:'Zap',duration:8,effects:{}},
 chaseOrb:{name:'追逐漂浮光球',icon:'Footprints',duration:14,effects:{fun:35,energy:-6}},
 passOrb:{name:'邀请邻居双人传光',icon:'Users',duration:18,effects:{fun:25,social:25},paired:true},
 sootheOrb:{name:'用光球陪伴附近幼体',icon:'Heart',duration:12,effects:{social:15}},
 memoryExpedition:{name:'探访失落星城 · 每日一次',icon:'Compass',duration:32,effects:{fun:35,energy:-12},skill:'science'}
};
export const WONDER_OPTIONS={polelight:['lightDaily','lightGrow','lightParty'],glowlight:['catchBugs','releaseBugs'],relic:['traceRelic','decodeRelic','decodeTogether','restoreMemory'],crystal:['tuneSleep','tuneInsight','activateCrystal'],lamp:['chaseOrb','passOrb','sootheOrb']};
export const createWonders=()=>({dust:0,archive:0,lastExpeditionDay:0,expeditions:0,cityRecords:[],coauthored:false});
export function createWonder(type){
 if(type==='polelight')return {mode:'daily'};
 if(type==='glowlight')return {bugs:0,showUntil:0};
 if(type==='relic')return {chapter:0,nextStudy:0,coauthored:false};
 if(type==='crystal')return {mode:'sleep',charge:0,armed:false,retuneAfter:0};
 if(type==='lamp')return {cooldown:0};
}
const now=g=>(g.day-1)*1440+g.minute;
const near=(a,b,r)=>sameSide(a,b)&&Math.hypot(a.x-b.x,a.z-b.z)<=r;
const clamp=v=>Math.max(0,Math.min(100,v));
const peopleNear=(people,o,r)=>people.filter(p=>near(p.position,o,r));
const isBaby=(g,p)=>p.position.age<g.config.lifeStages.infantEnd;
const chapterFor={traceRelic:0,decodeRelic:1,decodeTogether:1,restoreMemory:2};
const modeFor={lightDaily:'daily',lightGrow:'grow',lightParty:'party'};
export const pairedCooldown=(g,type,o)=>Math.max(0,(type==='passOrb'?o.wonder.cooldown:type==='decodeTogether'?o.wonder.nextStudy:0)-now(g));
export function wonderError(g,type,o,person,people,partnerId=null,queued=false){
 if(!WONDER_ACTIONS[type])return null;
 if(!o||(type==='memoryExpedition'?o.type!=='portal':!WONDER_OPTIONS[o.type]?.includes(type)))return '请选择对应的互动设备。';
 const s=o.wonder;
 if(type in modeFor&&modeFor[type]===s?.mode)return '已经是这个星光模式。';
 if(['catchBugs','releaseBugs'].includes(type)&&s.bugs<1)return '还没有幽光虫；夜间每 3 游戏小时引来一只，最多三只。';
 if(type in chapterFor){if(s.chapter!==chapterFor[type])return s.chapter===3?'这座遗迹的记忆已经完整。':'请按章节拓印、解读，再重现记忆。';if(now(g)<s.nextStudy&&!(queued&&WONDER_ACTIONS[type].paired))return `残纹正在复原，${Math.ceil(s.nextStudy-now(g))} 游戏分钟后再研究。`;}
 if(['tuneSleep','tuneInsight'].includes(type)&&s.mode===(type==='tuneSleep'?'sleep':'insight'))return '已经是这个频率，无需重新充能。';
 if(type==='activateCrystal'){if(s.armed)return '晶簇已经调谐，将支持附近的一次睡眠或研究。';if(s.charge<100)return `晶簇正在蓄能：${Math.floor(s.charge)}%，充满需要 6 游戏小时。`;if(g.wonders.dust<1)return '需要 1 份幽光微尘，请先在幽辉地灯捕捉幽光虫。';}
 if(o.type==='lamp'&&now(g)<s.cooldown&&!(queued&&WONDER_ACTIONS[type].paired))return `光球休息中，${Math.ceil(s.cooldown-now(g))} 游戏分钟后恢复。`;
 if(type==='sootheOrb'&&!peopleNear(people,o,3).some(p=>isBaby(g,p)))return '请将光球放在幼体附近 3 米内。';
 if(type==='sootheOrb'&&person.position.age<g.config.lifeStages.teenEnd)return '成年居民才能陪伴幼体。';
 if(WONDER_ACTIONS[type].paired){const partner=people.find(p=>p.id===partnerId);if(!partner||partner.id===person.id||isBaby(g,partner)||!sameSide(partner.position,o))return '请选择同一面的非幼体邻居。';}
 if(type==='memoryExpedition'){if(islandOf(person.position)!=='city')return '请先通过太空科技与居民资格检查，乘星舟登上失落星城。';if(g.wonders.archive<3)return '先完成虚空遗迹的三章记忆，解锁失落星城航路。';if(g.wonders.lastExpeditionDay>=g.day)return '今天已经探访过失落星城，明天再出发。';}
 return null;
}
// Integral of night minutes, including intervals crossing midnight or several days.
const nightIntegral=t=>{const day=Math.floor(t/1440),m=t-day*1440;return day*720+Math.min(m,360)+Math.max(0,m-1080);};
export function advanceWonders(g,minutes,people){
 const night=nightIntegral(now(g))-nightIntegral(now(g)-minutes);
 for(const o of g.objects){const s=o.wonder;if(!s)continue;
  if(o.type==='glowlight')s.bugs=Math.min(3,s.bugs+night/180);
  if(o.type==='crystal'&&!s.armed)s.charge=Math.min(100,s.charge+minutes*100/360);
 }
 // Overlapping grow lights do not stack; dead plants still require replanting.
 for(const o of g.objects)if(o.plant?.health>0&&g.objects.some(l=>l.type==='polelight'&&l.wonder.mode==='grow'&&near(l,o,9)))o.plant.health=clamp(o.plant.health+minutes/15);
 for(const p of people){const q=p.queue[0];if(q?.phase==='acting'&&['chat','joke','flirt','lounge','passOrb','dance','decodeTogether'].includes(q.type)&&g.objects.some(l=>l.type==='polelight'&&l.wonder.mode==='party'&&near(l,p.position,9))&&people.some(other=>other.id!==p.id&&near(other.position,p.position,3)))p.needs.social=clamp(p.needs.social+minutes*.15);}
}
export function finishWonder(g,type,o,person,people,partnerId){
 const s=o.wonder;
 if(type in modeFor){s.mode=modeFor[type];return `已切换${{daily:'日常星光',grow:'孢子生长光 · 9 米内植物缓慢恢复健康',party:'聚会星光 · 9 米内多人活动增加社交收益'}[s.mode]}。`;}
 if(type==='catchBugs'){const count=Math.floor(s.bugs);s.bugs-=count;g.wonders.dust+=count;return `收集 ${count} 份幽光微尘，存入家园共享材料；现有 ${g.wonders.dust} 份。`;}
 if(type==='releaseBugs'){s.bugs-=Math.floor(s.bugs);s.showUntil=now(g)+60;for(const p of peopleNear(people,o,6))if(p.id!==person.id)p.needs.fun=clamp(p.needs.fun+20);return '幽光虫在空中绽放，6 米内的居民共同获得乐趣。';}
 if(type in chapterFor){s.chapter++;s.nextStudy=now(g)+360;s.coauthored ||= type==='decodeTogether';g.wonders.coauthored ||= s.coauthored;g.wonders.archive=Math.max(g.wonders.archive,s.chapter);return ['','拓印显露了古文明的迁徙残纹。','星图指向一座失落星城。'+(s.coauthored?' 两位居民共同发现了星城的生态线索。':''),'文明记忆已重现：已定位失落星城。需要深空跃迁科技与合格居民才能登岛。'][s.chapter];}
 if(['tuneSleep','tuneInsight'].includes(type)){s.mode=type==='tuneSleep'?'sleep':'insight';s.charge=0;s.armed=false;s.retuneAfter=now(g)+360;return `已切换${s.mode==='sleep'?'安眠':'灵感'}频率，从零开始充能；6 游戏小时充满后可用 1 份微尘激活。`;}
 if(type==='activateCrystal'){g.wonders.dust--;s.armed=true;return `晶簇已储存${s.mode==='sleep'?'安眠':'灵感'}共振，将帮助 5 米内完成的一次${s.mode==='sleep'?'睡眠，额外恢复 15 能量':'研究，额外获得 1 科学技能'}。`;}
 if(o.type==='lamp'){s.cooldown=now(g)+120;if(type==='sootheOrb'){for(const p of peopleNear(people,o,3).filter(p=>isBaby(g,p))){p.needs.fun=clamp(p.needs.fun+30);p.needs.social=clamp(p.needs.social+20);}return '光球陪幼体玩耍：乐趣 +30、社交 +20，仍需正常喂养与照料。';}return type==='passOrb'?`${person.position.name}与${people.find(p=>p.id===partnerId).position.name}完成双人传光，关系更亲近了。`:'追逐光球结束，它将休息 2 游戏小时。';}
 if(type==='memoryExpedition'){g.wonders.lastExpeditionDay=g.day;g.wonders.expeditions++;if(!g.wonders.cityRecords.includes(g.day%3))g.wonders.cityRecords.push(g.day%3);g.wonders.dust+=2;return ['在失落星城找到了星能补给，带回 2 份幽光微尘和 120 星币。','在星城档案馆补全星图，带回 2 份幽光微尘和 120 星币。','在星城温室发现了发光生态记录，带回 2 份幽光微尘和 120 星币。'][g.day%3];}
}
export function useCrystal(g,type,target,person){
 if(!target||!['sleep','research'].includes(type))return;
 const c=g.objects.find(o=>o.type==='crystal'&&o.wonder.armed&&o.wonder.mode===(type==='sleep'?'sleep':'insight')&&near(o,target,5));if(!c)return;
 if(type==='sleep')person.needs.energy=clamp(person.needs.energy+15);else person.skills.science++;
 c.wonder.armed=false;c.wonder.charge=0;
 return type==='sleep'?'安眠晶簇释放共振，额外恢复 15 能量。':'灵感晶簇释放共振，额外获得 1 科学技能。';
}
export function wonderStatus(g,o){
 const s=o.wonder;if(!s)return '';
 if(o.type==='polelight')return `当前：${{daily:'日常照明',grow:'孢子生长光 · 9 米内植物恢复健康',party:'聚会星光 · 9 米内多人活动增加社交收益'}[s.mode]}`;
 if(o.type==='glowlight')return `幽光虫 ${Math.floor(s.bugs)} / 3 · 夜间每 3 游戏小时引来一只 · 共享微尘 ${g.wonders.dust} 份`;
 if(o.type==='relic')return `记忆 ${s.chapter} / 3 章${s.coauthored?' · 双人生态线索已记录':''}${s.nextStudy>now(g)&&s.chapter<3?` · 复原还需 ${Math.ceil(s.nextStudy-now(g))} 游戏分钟`:''}`;
 if(o.type==='crystal')return `${s.mode==='sleep'?'安眠':'灵感'}频率 · 蓄能 ${Math.floor(s.charge)}% · ${s.armed?`${s.mode==='sleep'?'安眠':'灵感'}共振就绪 · 5 米范围`:'6 游戏小时充满'} · 共享微尘 ${g.wonders.dust} 份`;
 return s.cooldown>now(g)?`休息中 · 还有 ${Math.ceil(s.cooldown-now(g))} 游戏分钟`:'光球准备好了 · 玩耍后休息 2 游戏小时';
}
const range=(v,max)=>Number.isFinite(v)&&v>=0&&v<=max;
export function validWonder(o){const s=o.wonder;if(!WONDER_OPTIONS[o.type])return s===undefined;if(!s)return false;
 if(o.type==='polelight')return ['daily','grow','party'].includes(s.mode);
 if(o.type==='glowlight')return range(s.bugs,3)&&range(s.showUntil,1e12);
 if(o.type==='relic')return Number.isInteger(s.chapter)&&range(s.chapter,3)&&range(s.nextStudy,1e12)&&typeof s.coauthored==='boolean';
 if(o.type==='crystal')return ['sleep','insight'].includes(s.mode)&&range(s.charge,100)&&typeof s.armed==='boolean'&&range(s.retuneAfter,1e12)&&(!s.armed||s.charge===100);
 return range(s.cooldown,1e12);
}
export const validWonders=s=>s&&Number.isSafeInteger(s.expeditions)&&range(s.expeditions,1e12)&&typeof s.coauthored==='boolean'&&Array.isArray(s.cityRecords)&&s.cityRecords.length<=3&&new Set(s.cityRecords).size===s.cityRecords.length&&s.cityRecords.every(n=>Number.isInteger(n)&&range(n,2))&&Number.isSafeInteger(s.dust)&&range(s.dust,1e9)&&Number.isInteger(s.archive)&&range(s.archive,3)&&Number.isInteger(s.lastExpeditionDay)&&range(s.lastExpeditionDay,1e12);
