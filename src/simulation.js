import {groupId,advanceCooperation} from './cooperation.js';
import {STAR_ISLANDS,createCivilization,validCivilization,civilizationError,contributeCivilization} from './civilization.js';
import {actionPreference,autonomyBonus} from './autonomy.js';
import {WONDER_ACTIONS,WONDER_OPTIONS,createWonders,createWonder,wonderError,pairedCooldown,advanceWonders,finishWonder,useCrystal,validWonder,validWonders} from './wonders.js';
import {PRAYER_RULES,DEFAULT_PRAYER_CHANCES,createPrayerState,validPrayerState,validBlessing,resolvePrayer,prayerSucceeded,blessingMessage} from './prayer.js';
import {SIDES,sideOf,islandOf,sameSide,createGates,DEFAULT_GATE_POSITION} from './island.js';
import {CROPS,createPlant,advancePlants,plantActionError,tendPlant,harvestPlant,validPlant} from './plants.js';
import {defaultGenome,defaultHeadShape,residentHeadShape,HEAD_SHAPE,inheritTraits,generateResidentName,DEFAULT_MUTATION_RATES,MUTATION_PARTS} from './genetics.js';
export {inheritTraits,generateResidentName,DEFAULT_MUTATION_RATES,MUTATION_PARTS};
import {RESIDENTS,GENDERS,SKILLS,SOFA_SEATS,localToWorld,approachPosition,skillProgress,lifeStage,DEFAULT_LIFE_STAGES} from './characters.js';
export {skillProgress};
export const NEEDS={hunger:['营养','Utensils'],energy:['能量','Zap'],social:['社交','MessagesSquare'],fun:['乐趣','Sparkles'],hygiene:['洁净','Droplets'],comfort:['舒适','Armchair']};
export const NPCS=[{id:'nova',name:'诺瓦',role:'星际植物学家',trait:'热爱自然 · 温柔',color:'#edabbf',x:1,z:1},{id:'zig',name:'吉格',role:'量子工程师',trait:'天才 · 有点古怪',color:'#b4a0ef',x:5,z:-2},{id:'lumi',name:'露米',role:'银河外交官',trait:'外向 · 浪漫',color:'#f4c16d',x:-3,z:4},{id:'pip',name:'皮普',role:'星云音乐人',trait:'创意十足 · 贪玩',color:'#88cbdc',x:3,z:4}];
export const GOVERNMENT_SUBSIDY=50;
export const CAREERS={
 chef:{name:'星云膳造',icon:'Utensils',desc:'以孢火煨炼星海风味，为异星文明编织盛宴。',levels:[
  {title:'孢火学徒',wage:170,skills:{cooking:3}},
  {title:'星釜调味师',wage:270,shifts:3,skills:{cooking:12,botany:4}},
  {title:'星宴织味宗师',wage:430,shifts:5,skills:{cooking:26,botany:10,social:8}}
 ]},
 scientist:{name:'量子科学',icon:'Atom',desc:'研究异常晶体，揭开宇宙的秘密。',levels:[
  {title:'实验室助理',wage:180,skills:{science:6}},
  {title:'量子研究员',wage:260,shifts:3,skills:{science:15,social:4}},
  {title:'首席科学家',wage:400,shifts:5,skills:{science:30,botany:10,social:8}}
 ]},
 botanist:{name:'异星植物',icon:'Sprout',desc:'培育会发光的植物，让荒星长成家园。',levels:[
  {title:'孢子培育员',wage:160,skills:{botany:6}},
  {title:'异星植物学家',wage:240,shifts:3,skills:{botany:15,science:4}},
  {title:'生态设计师',wage:380,shifts:5,skills:{botany:30,science:12,social:6}}
 ]},
 diplomat:{name:'银河外交',icon:'Orbit',desc:'连接不同文明，让友谊跨越光年。',levels:[
  {title:'星际联络员',wage:200,skills:{social:6}},
  {title:'银河大使',wage:300,shifts:3,skills:{social:15,music:8}},
  {title:'星盟议长',wage:460,shifts:5,skills:{social:30,music:18,science:8}}
 ]}
};
const NPC_CAREERS={nova:'botanist',zig:'scientist',lumi:'diplomat',pip:'diplomat'};
const careerLevel=(id,level=1)=>CAREERS[id]?.levels[level-1];
export function careerSkillRequirements(id,level=1,config){return{...(careerDefinition(config?{config}:null,id).levels[level-1]?.skills||{})};}
export function missingCareerSkills(skills,id,level=1,config){return Object.entries(careerSkillRequirements(id,level,config)).filter(([key,required])=>(skills?.[key]??0)<required).map(([key,required])=>({key,required,current:skills?.[key]??0}));}
export function careerEntryMessage(g,id,skills=g.skills){
 const c=careerDefinition(g,id);if(!c)return '未知职业。';
 const missing=missingCareerSkills(skills,id,1,g.config);return missing.length?`技能不足：${missing.map(({key,current,required})=>`${SKILLS[key].name} ${current}/${required}`).join('、')}`:null;
}
export function recordMajorEvent(g,text,type='event'){
 g.majorEvents=[{type,text,at:g.minute,day:g.day},...(g.majorEvents||[])].slice(0,3);
}
export const ITEMS=[
 {id:'spiritTree',name:'星灵垂光树',pack:'孢子花园',price:380,icon:'TreePine',action:'pray',desc:'跪下祈祷 · 晴昼赐予技能与曦光属性 · 幽星赐予幽冥属性与稀有变异'},
 {id:'polelight',name:'星弧高杆灯',pack:'幽星秘境',price:240,icon:'Lamp',action:'lightDaily',lighting:{radius:9,intensity:32,color:0xb9d8ff,height:3.25},desc:'切换日常 / 生长 / 聚会星光 · 半径 9 米'},
 {id:'glowlight',name:'幽辉地灯',pack:'幽星秘境',price:140,icon:'Lamp',action:'catchBugs',lighting:{radius:6,intensity:16,color:0x83e5d4,height:.85},desc:'夜间引来幽光虫 · 捕捉微尘或放飞表演'},
 {id:'stove',name:'孢火星釜',pack:'星云膳坊',price:360,icon:'Utensils',action:'cook',desc:'烹饪 +1 · 营养 +55 · 厨师工作台'},
 {id:'tea',name:'星露萃饮台',pack:'星云膳坊',price:180,icon:'Coffee',action:'brew',desc:'烹饪 +1 · 能量 +20 · 5 星币'},
 {id:'banquet',name:'悬浮星宴桌',pack:'星云膳坊',price:240,icon:'Utensils',action:'taste',desc:'营养 +40 · 乐趣 +20 · 12 星币'},
 {id:'relic',name:'虚空遗迹',pack:'幽星秘境',price:220,icon:'Gem',action:'traceRelic',desc:'拓印、解读与重现记忆 · 解锁失落星城'},
 {id:'beacon',name:'幽光信标',pack:'幽星秘境',price:150,icon:'Lamp',action:'observe',desc:'科学 +1 · 乐趣 +35'},
 {id:'gate',name:'双面折跃门',pack:'幽星秘境',price:420,icon:'Orbit',action:'travel',desc:'自由选择任意星门 · 同面或跨面折跃'},
 {id:'nursery',name:'星芽育生舱',pack:'生活舱',price:480,icon:'Sprout',action:'incubate',desc:'成年居民孕育幼体 · 300 星币 · 3 天'},
 {id:'pod',name:'星眠舱',pack:'生活舱',price:420,icon:'BedDouble',action:'sleep',desc:'能量 +65 · 舒适 +20'},
 {id:'food',name:'营养合成器',pack:'生活舱',price:260,icon:'Utensils',action:'eat',desc:'营养 +65'},
 {id:'shower',name:'离子净化舱',pack:'生活舱',price:320,icon:'Droplets',action:'wash',desc:'洁净 +70'},
 {id:'sofa',name:'月弧沙发',pack:'生活舱',price:210,icon:'Armchair',action:'relax',desc:'舒适 +55 · 能量 +15'},
 {id:'lab',name:'全息研究台',pack:'星际科技',price:560,icon:'Atom',action:'research',desc:'科学技能 +1 · 乐趣 +15'},
 {id:'music',name:'星云唱片机',pack:'星际科技',price:230,icon:'Music2',action:'dance',desc:'乐趣 +55 · 社交 +10'},
 {id:'portal',name:'跃迁星门',pack:'星际科技',price:680,icon:'Orbit',action:'explore',desc:'探险奖励 80 星币'},
 {id:'telescope',name:'深空望远镜',pack:'星际科技',price:350,icon:'Telescope',action:'observe',desc:'科学技能 +1 · 乐趣 +35'},
 {id:'garden',name:'发光孢子花圃',pack:'孢子花园',price:160,icon:'Flower2',action:'garden',desc:'浇水养护 · 6 小时一熟 · 收获发光孢子'},
 {id:'crystal',name:'极光晶簇',pack:'孢子花园',price:120,icon:'Gem',action:'tuneSleep',desc:'免费切换频率 · 蓄能 6 小时 · 1 微尘激活 · 半径 5 米'},
 {id:'mushroom',name:'星伞蘑菇',pack:'孢子花园',price:190,icon:'TreePine',action:'garden',desc:'浇水养护 · 12 小时一熟 · 收获星伞菇'},
 {id:'lamp',name:'漂浮光球',pack:'孢子花园',price:90,icon:'Lamp',action:'chaseOrb',desc:'追逐光球 · 双人传光 · 陪伴幼体'}
];
export const ACTIONS={
 spaceResearch:{name:'研发太空科技',icon:'Orbit',duration:22,effects:{fun:18,energy:-5},skill:'science'},
 voyage:{name:'乘星舟登岛',icon:'Orbit',duration:18,effects:{fun:15,energy:-8}},
 ...WONDER_ACTIONS,
 pray:{name:'向星灵树祈祷',icon:'Sparkles',duration:12,effects:{comfort:10,fun:5}},
 travel:{name:'传送至所选星门',icon:'Orbit',duration:3,effects:{}},
 cook:{name:'烹制孢火星膳 · 15 星币',icon:'Utensils',duration:16,effects:{hunger:55,fun:15,hygiene:-5},skill:'cooking',cost:15},
 brew:{name:'萃取星露 · 5 星币',icon:'Coffee',duration:10,effects:{energy:20,fun:15},skill:'cooking',cost:5},
 taste:{name:'品尝星宴 · 12 星币',icon:'Utensils',duration:12,effects:{hunger:40,fun:20},cost:12},
 incubate:{name:'孕育星芽 · 300 星币',icon:'Sprout',duration:16,effects:{}},
 care:{name:'喂养与照料幼体',icon:'Heart',duration:12,effects:{social:10}},
 walk:{name:'走到这里',icon:'Footprints',duration:0,effects:{}},
 eat:{name:'合成一份星际晚餐 · 10 星币',icon:'Utensils',duration:10,effects:{hunger:65},cost:10,costMessage:'星币不足，无法合成晚餐。'},sleep:{name:'进入星眠',icon:'Moon',duration:18,effects:{energy:65,comfort:20}},
 wash:{name:'离子净化',icon:'Droplets',duration:10,effects:{hygiene:70}},relax:{name:'坐下休息',icon:'Armchair',duration:10,effects:{comfort:55,energy:15}},
 lounge:{name:'邀请邻居坐下聊天',icon:'MessagesSquare',duration:30,effects:{comfort:35,energy:10}},
 research:{name:'研究量子晶体',icon:'Atom',duration:14,effects:{fun:15},skill:'science'},dance:{name:'随星云音乐起舞',icon:'Music2',duration:12,effects:{fun:55,social:10},skill:'music'},
 explore:{name:'勘察星岛与轨道',icon:'Orbit',duration:24,effects:{fun:30,energy:-12},money:80},observe:{name:'观测遥远星系',icon:'Telescope',duration:12,effects:{fun:35},skill:'science'},
 harvest:{name:'收获成熟植物',icon:'Sprout',duration:10,effects:{fun:15,hygiene:-5},skill:'botany'},replant:{name:'清理并补种',icon:'Flower2',duration:12,effects:{fun:10,hygiene:-8},skill:'botany'},
 garden:{name:'浇水养护',icon:'Sprout',duration:12,effects:{fun:25,hygiene:-8},skill:'botany'},
 chat:{name:'聊聊母星',icon:'MessagesSquare',duration:10,effects:{social:30},relation:15,skill:'social'},joke:{name:'讲一个地球笑话',icon:'Smile',duration:10,effects:{social:20,fun:25},relation:12,skill:'social'},
 gift:{name:'赠送星尘 · 30 星币',icon:'Gift',duration:8,effects:{social:25},relation:25,cost:30},flirt:{name:'分享心动频率',icon:'Heart',duration:12,effects:{social:35,fun:15},relation:20,minRelation:35},
 work:{name:'开始一个工作班次',icon:'BriefcaseBusiness',duration:32,effects:{energy:-18,hunger:-15},work:true}
};
const clamp=n=>Math.max(0,Math.min(100,n));
export const DECAY={hunger:.18,energy:.12,social:.1,fun:.13,hygiene:.08,comfort:.07};
export const createDefaultConfig=()=>({
 time:{starYearDays:8,gameMinutesPerRealSecond:2},
 lifeStages:{...DEFAULT_LIFE_STAGES},
 mutationRates:{...DEFAULT_MUTATION_RATES},
 prayer:{...DEFAULT_PRAYER_CHANCES},
 actionDurations:Object.fromEntries(Object.entries(ACTIONS).map(([id,action])=>[id,action.duration])),
 actionCosts:{cook:15,brew:5,taste:12,eat:ACTIONS.eat.cost,gift:ACTIONS.gift.cost,incubate:300},
 needDecay:{...DECAY},
 economy:{governmentSubsidy:GOVERNMENT_SUBSIDY},
 careers:Object.fromEntries(Object.entries(CAREERS).map(([id,career])=>[id,{levels:career.levels.map(level=>({...level,skills:{...level.skills}}))}])),
  crops:Object.fromEntries(Object.entries(CROPS).map(([id,crop])=>[id,{minutes:crop.minutes,yield:crop.yield,price:crop.price,giantChance:crop.giantChance}]))
});
export function normalizeConfig(raw){
 const defaults=createDefaultConfig(),source=raw||{};
 return {
  time:{...defaults.time,...source.time},lifeStages:{...defaults.lifeStages,...source.lifeStages},mutationRates:{...defaults.mutationRates,...source.mutationRates},prayer:{...defaults.prayer,...source.prayer},actionDurations:{...defaults.actionDurations,...source.actionDurations},actionCosts:{...defaults.actionCosts,...source.actionCosts},needDecay:{...defaults.needDecay,...source.needDecay},economy:{...defaults.economy,...source.economy},
  careers:Object.fromEntries(Object.entries(CAREERS).map(([id,career])=>[id,{levels:career.levels.map((level,index)=>({...level,...source.careers?.[id]?.levels?.[index],skills:{...level.skills,...source.careers?.[id]?.levels?.[index]?.skills}}))}])),
  crops:Object.fromEntries(Object.entries(CROPS).map(([id,crop])=>[id,{minutes:source.crops?.[id]?.minutes??crop.minutes,yield:source.crops?.[id]?.yield??crop.yield,price:source.crops?.[id]?.price??crop.price,giantChance:source.crops?.[id]?.giantChance??crop.giantChance}]))
 };
}
const configRange=(value,min,max)=>Number.isFinite(value)&&value>=min&&value<=max;
const validLifeStages=stages=>stages&&configRange(stages.infantEnd,1,120)&&configRange(stages.childEnd,1,120)&&configRange(stages.teenEnd,1,120)&&configRange(stages.adultEnd,1,120)&&configRange(stages.elderEnd,1,120)&&stages.infantEnd<stages.childEnd&&stages.childEnd<stages.teenEnd&&stages.teenEnd<stages.adultEnd&&stages.adultEnd<stages.elderEnd;
export function validConfig(c){return !!(c&&configRange(c.time?.starYearDays,1,100)&&configRange(c.time?.gameMinutesPerRealSecond,.01,120)&&validLifeStages(c.lifeStages)&&Object.keys(DEFAULT_PRAYER_CHANCES).every(key=>configRange(c.prayer?.[key],0,100))&&Object.keys(DEFAULT_MUTATION_RATES).every(key=>configRange(c.mutationRates?.[key],0,100))&&Object.values(c.mutationRates).reduce((sum,value)=>sum+value,0)<=100&&Object.values(c.actionDurations||{}).every(v=>configRange(v,0,1e6))&&Object.values(c.actionCosts||{}).every(v=>configRange(v,0,1e9))&&Object.values(c.needDecay||{}).every(v=>configRange(v,0,100))&&configRange(c.economy?.governmentSubsidy,0,1e9)&&Object.values(c.crops||{}).every(v=>configRange(v.minutes,1,1e7)&&configRange(v.yield,1,1e6)&&configRange(v.price,0,1e9)&&configRange(v.giantChance,0,100))&&Object.values(c.careers||{}).every(v=>v.levels.length===3&&v.levels.every(level=>configRange(level.wage,0,1e9)&&configRange(level.shifts??0,0,1e6)&&Object.values(level.skills||{}).every(skill=>configRange(skill,0,1e9)))));}
export function careerDefinition(g,id){const base=CAREERS[id],config=g?.config?.careers?.[id];return{...base,levels:base.levels.map((level,index)=>({...level,...config?.levels?.[index],skills:{...level.skills,...config?.levels?.[index]?.skills}}))};}
export function cropDefinition(g,id){return{...CROPS[id],...g?.config?.crops?.[id]};}
const cropDefinitions=g=>Object.fromEntries(Object.keys(CROPS).map(id=>[id,cropDefinition(g,id)]));
const actionDuration=(g,type)=>g.config?.actionDurations?.[type]??ACTIONS[type].duration;
const actionCost=(g,type)=>g.config?.actionCosts?.[type]??ACTIONS[type]?.cost??0;
const stageConfig=g=>g.config?.lifeStages||DEFAULT_LIFE_STAGES;
const isInfant=(g,age)=>lifeStage(age,stageConfig(g))==='infant';
const adultStart=g=>stageConfig(g).teenEnd;
const elderStart=g=>stageConfig(g).adultEnd;
const lifeEnd=g=>stageConfig(g).elderEnd;
const PREFERENCES={player:{research:12,observe:12,garden:8,chat:8},nova:{garden:24,catchBugs:10},zig:{research:24,observe:18},lumi:{chat:24,chaseOrb:8},pip:{dance:24,chat:8}};
const createAI=enabled=>({enabled,cooldown:0,lastAction:null,lastTarget:null,reason:'正在观察周围',lastWorkDay:0});
const createSkills=()=>Object.fromEntries(Object.keys(SKILLS).map(key=>[key,0]));
const createInventory=()=>Object.fromEntries(Object.values(CROPS).map(c=>[c.key,0]));
const ADULT_STARTING_MONEY=600;
const startingMoney=id=>RESIDENTS[id]?.age>=18?ADULT_STARTING_MONEY:0;
const createCareer=id=>({id:NPC_CAREERS[id]||'scientist',level:1,shifts:0});
const placeholderName=/^星芽 \d+$/;
function migrateResidentNames(g){
 if(!g?.player||!g.npcs)return;
 const records=[g.player,...Object.values(g.npcs),...(Array.isArray(g.memorials)?g.memorials:[])].filter(person=>person&&typeof person.name==='string');
 const used=new Set(records.filter(person=>!placeholderName.test(person.name)).map(person=>person.name)),renamed=new Map();
 for(const person of records)if(placeholderName.test(person.name)){person.name=generateResidentName(person,[...used]);used.add(person.name);renamed.set(person.uid,person.name);}
 for(const person of records)for(const parent of person.parents||[])if(renamed.has(parent.uid))parent.name=renamed.get(parent.uid);
 for(const birth of g.incubations||[])for(const parent of birth.parents||[])if(renamed.has(parent.uid))parent.name=renamed.get(parent.uid);
}
const identity=(n,profile)=>({side:'front',uid:n.id,name:n.name,color:n.color,trait:n.trait,...profile,alive:true,starvation:0,prayer:createPrayerState(),parents:[],genome:{...defaultGenome(),...residentHeadShape(n.id)},mutations:[],familyDesire:n.id==='zig'?.25:.7,lastBirthDay:null,preferences:{...PREFERENCES[n.id]}});
const controlledResidentId=g=>g.controlledId??'player';
export const neighbors=g=>Object.entries(g.npcs).filter(([id])=>id!==controlledResidentId(g)).map(([id,n])=>({id,...n}));
const createNeighbor=n=>({x:n.x,z:n.z,...identity(n,RESIDENTS[n.id]),money:startingMoney(n.id),inventory:createInventory(),needs:{hunger:76,energy:85,social:78,fun:70,hygiene:82,comfort:78},skills:createSkills(),career:createCareer(n.id),relationships:Object.fromEntries(NPCS.filter(other=>other.id!==n.id).map(other=>[other.id,0])),queue:[],ai:createAI(true),activity:'享受星湾的微风'});
export function createGame(config){return {
 version:13,civilization:createCivilization(),viewIsland:'home',wonders:createWonders(),viewSide:'front',controlledId:'player',config:normalizeConfig(config),harvest:{spores:0,mushrooms:0},incubations:[],memorials:[],majorEvents:[],minute:510,day:1,speed:1,money:2400,player:{x:0,z:2,...identity({id:'kai',name:'凯伊',color:'#91dab9',trait:'好奇心旺盛 · 热爱生活'},RESIDENTS.player),preferences:{...PREFERENCES.player}},autonomy:createAI(true),
 npcs:Object.fromEntries(NPCS.map(n=>[n.id,createNeighbor(n)])),
 needs:{hunger:76,energy:88,social:62,fun:72,hygiene:85,comfort:79},relationships:{nova:15,zig:12,lumi:20,pip:8},
 career:{id:'scientist',level:1,shifts:0},skills:{...createSkills(),science:CAREERS.scientist.levels[0].skills.science},queue:[],nextId:1,
 objects:[{id:'pod',type:'pod',x:-5,z:-4,rotation:0},{id:'food',type:'food',x:1,z:-4,rotation:0},{id:'shower',type:'shower',x:-2,z:-4,rotation:0},{id:'sofa',type:'sofa',x:-5,z:0,rotation:0},{id:'lab',type:'lab',x:5,z:-4,rotation:0},{id:'music',type:'music',x:-2,z:0,rotation:0},{id:'garden',type:'garden',x:7,z:3,rotation:0,plant:createPlant()},{id:'portal',type:'portal',x:9,z:-4,rotation:0}].map(o=>({...o,side:'front'})).concat(createGates()),
 log:[{text:'欢迎回家，凯伊。你的异星日常，从这里开始。',at:510}],completed:0
};}
export function canPlace(g,x,z,side=g.viewSide,island=g.viewIsland){return Number.isFinite(x)&&Number.isFinite(z)&&Math.abs(x)<=10&&Math.abs(z)<=6&&Object.hasOwn(SIDES,side)&&!g.objects.some(o=>islandOf(o)===island&&sideOf(o)===side&&(Math.hypot(o.x-x,o.z-z)<1.8||o.type==='gate'&&Math.hypot(approachPosition(o).x-x,approachPosition(o).z-z)<1.8))&&!allActors(g).some(n=>islandOf(n.position)===island&&sideOf(n.position)===side&&isInfant(g,n.position.age)&&Math.hypot(n.position.x-x,n.position.z-z)<1.1);}
export function buyItem(g,type,x,z,rotation=0){const item=ITEMS.find(i=>i.id===type);if(!item||item.fixed)return{ok:false,message:'该物品不可购买'};if(g.money<item.price)return{ok:false,message:'星币不足，完成工作可赚取星币。'};if(!canPlace(g,x,z))return{ok:false,message:'这里没有足够的摆放空间。'};g.money-=item.price;const o={id:`${type}-${g.nextId++}`,type,x,z,rotation,island:g.viewIsland,side:g.viewSide};if(CROPS[type])o.plant=createPlant();if(WONDER_OPTIONS[type])o.wonder=createWonder(type);g.objects.push(o);return{ok:true,object:o};}
export function sellHarvest(g,key){
 const crop=Object.values(cropDefinitions(g)).find(c=>c.key===key);if(!crop||!g.harvest[key])return{ok:false,message:'仓库里还没有这类收成。'};
 const count=g.harvest[key],earned=count*crop.price;g.harvest[key]=0;g.money+=earned;const message=`出售 ${count} 份${crop.name}，获得 ${earned} 星币。`;g.log.unshift({text:message,at:g.minute});return{ok:true,message};
}
export function sellItem(g,id){if(g.objects.find(o=>o.id===id)?.fixed)return false;if(g.incubations.some(b=>b.podId===id))return false;if(allActors(g).some(a=>a.queue.some(q=>q.targetId===id||q.destinationId===id||q.path?.some(p=>p.gateId===id||p.destinationId===id))))return false;const i=g.objects.findIndex(o=>o.id===id);if(i<0)return false;g.money+=Math.floor(ITEMS.find(x=>x.id===g.objects[i].type).price*.7);g.objects.splice(i,1);return true;}
export function setCareer(g,id){if(!g.player.alive||g.player.age<adultStart(g)||!CAREERS[id]||careerEntryMessage(g,id))return false;if(g.queue.some(a=>a.type==='work'))return false;g.career={id,level:1,shifts:0};return true;}
export const workStationType=id=>id==='chef'?'stove':'lab';
function travelDestination(g,source,destinationId){
 if(source?.type!=='gate')return null;
 const gate=g.objects.find(o=>o.id===destinationId&&o.type==='gate'&&o.id!==source.id);
 if(!gate||islandOf(gate)!==islandOf(source))return null;
 const point=approachPosition(gate);
 if(g.objects.some(o=>sameSide(o,gate)&&Math.hypot(o.x-point.x,o.z-point.z)<.8))return null;
 return {...point,island:islandOf(gate),side:sideOf(gate)};
}
function destination(g,targetId,point){if(point)return point;const npc=g.npcs[targetId];if(npc)return{x:npc.x,z:npc.z+(isInfant(g,npc.age)?.65:1),island:islandOf(npc),side:sideOf(npc)};const o=g.objects.find(n=>n.id===targetId);return o?{...approachPosition(o),island:islandOf(o),side:sideOf(o)}:null;}
export function updateResident(g,id,{gender,age,headShape}){
 const person=id==='player'?g.player:g.npcs[id];
 if(!person||!person.alive||!Object.hasOwn(GENDERS,gender)||!Number.isInteger(age)||age<0||age>120)return{ok:false,message:'请选择有效性别，年龄需为 0–120 星岁。'};
 if(headShape&&!Object.keys(HEAD_SHAPE).every(k=>Number.isFinite(headShape[k])&&headShape[k]>=.8&&headShape[k]<=1.2))return{ok:false,message:'头型参数需为 80%–120%。'};
 const wasMinor=person.age<adultStart(g);person.gender=gender;person.age=age;if(id!=='player'&&wasMinor&&age>=adultStart(g)&&person.money===0)person.money=ADULT_STARTING_MONEY;if(headShape)for(const key of Object.keys(HEAD_SHAPE))person.genome[key]=headShape[key];
 if(isInfant(g,age))(id==='player'?g.queue:person.queue).length=0;
 if(id==='player'||g.queue.some(q=>q.targetId===id))g.queue=g.queue.filter(q=>q.type!=='flirt');
 return{ok:true};
}
function syncControlledResident(g){
 const id=controlledResidentId(g),current=g.player,recordId=id==='player'?current.uid:id;
 const record=id==='player'?{...current,money:g.money,inventory:{...g.harvest}}:g.npcs[id];
 Object.assign(record,{money:g.money,inventory:{...g.harvest},needs:g.needs,skills:g.skills,career:g.career,queue:g.queue,ai:{...g.autonomy,enabled:true,cooldown:0,reason:'正在观察周围'},relationships:{...g.relationships},activity:current.activity||'享受星湾的微风'});
 if(id==='player')g.npcs[recordId]=record;
 for(const [otherId,other] of Object.entries(g.npcs))if(otherId!==recordId)other.relationships[recordId]??=g.relationships[otherId]??0;
 return recordId;
}
function activateControlledResident(g,id){
 const target=g.npcs[id];g.player=target;g.controlledId=id;g.money=target.money;g.harvest=target.inventory;
 g.viewIsland=islandOf(target);g.viewSide=sideOf(target);g.needs=target.needs;g.skills=target.skills;g.career=target.career;g.queue=target.queue;g.autonomy={...target.ai,enabled:true,cooldown:0,reason:'正在观察需求和周围环境'};g.relationships={...target.relationships};delete g.relationships[id];
 target.needs=g.needs;target.skills=g.skills;target.career=g.career;target.queue=g.queue;target.ai=g.autonomy;target.relationships=g.relationships;target.inventory=g.harvest;
}
export function switchControl(g,id){
 const currentId=controlledResidentId(g);if(id===currentId)return{ok:true};
 const target=g.npcs[id];if(!g.player.alive)return takeOver(g,id);if(!target?.alive)return{ok:false,message:'这位居民暂时无法主控。'};
 const previousResidentId=currentId==='player'?g.player.uid:currentId;syncControlledResident(g);
 target.relationships??={};if(target.relationships[previousResidentId]===undefined)target.relationships[previousResidentId]=g.relationships[id]??0;
 for(const otherId of Object.keys(g.npcs))if(otherId!==id&&target.relationships[otherId]===undefined)target.relationships[otherId]=g.relationships[otherId]??0;
 activateControlledResident(g,id);return{ok:true,message:`现在由${g.player.name}主控。`};
}
export function randomizeHeads(g,random=Math.random){
 const people=[g.player,...Object.keys(g.npcs).filter(id=>id!==controlledResidentId(g)).map(id=>g.npcs[id])];for(const person of people)for(const key of [...Object.keys(HEAD_SHAPE),'antenna'])person.genome[key]=Math.round((.8+random()*.4)*100)/100;
}
export function enqueue(g,type,targetId,point,partnerId=null,destinationId=null){
 if(!g.player.alive)return{ok:false,message:'这段生命已结束，请在生命页选择接管居民。'};
 if(isInfant(g,g.player.age))return{ok:false,message:`幼体需要照料，${stageConfig(g).infantEnd} 星岁后开始自主活动。`};
 if(type==='pray'&&!g.objects.some(o=>o.id===targetId&&o.type==='spiritTree'))return{ok:false,message:'请选择星灵垂光树祈祷。'};
 const civilIssue=civilizationError(g,type,g.objects.find(o=>o.id===targetId),g.player,g.skills,destinationId);if(civilIssue)return{ok:false,message:civilIssue};
 const wonderIssue=interactionError(g,type,targetId,partnerId);if(wonderIssue)return{ok:false,message:wonderIssue};
 if(type==='work'&&g.player.age<adultStart(g))return{ok:false,message:'成年居民才能开始工作。'};
 if(type==='work'&&!g.objects.some(o=>o.id===targetId&&o.type===workStationType(g.career.id)))return{ok:false,message:g.career.id==='chef'?'厨师需要在孢火星釜工作。':'请先选择全息研究台。'};
 if(type==='work'){const error=careerEntryMessage(g,g.career.id);if(error)return{ok:false,message:`无法开始工作，${error}`};}
 if(type==='incubate'){const error=birthError(g,g.player,targetId)||partnerError(g,'player',partnerId);if(error)return{ok:false,message:error};}
  if(type==='care'&&(!g.npcs[targetId]||!isInfant(g,g.npcs[targetId].age)||g.player.age<adultStart(g)))return{ok:false,message:'成年居民可以照料幼体。'};
  if(['chat','joke','gift','flirt'].includes(type)&&(!g.npcs[targetId]||isInfant(g,g.npcs[targetId].age)))return{ok:false,message:'请使用照料互动陪伴幼体。'};
  if(['garden','harvest','replant'].includes(type)){const error=plantActionError(g.objects.find(o=>o.id===targetId),type);if(error)return{ok:false,message:error};}
 if(['relax','lounge'].includes(type)&&!g.objects.some(o=>o.id===targetId&&o.type==='sofa'))return{ok:false,message:'请先选择沙发。'};
  const a=ACTIONS[type],cost=actionCost(g,type);if(!a||g.queue.filter(q=>q.source!=='ai').length>=6)return{ok:false,message:'行动队列已满。'};
  if(cost&&!canAfford(g,actor(g,'player'),cost))return{ok:false,message:a.costMessage||'星币不足，无法完成该行动。'};
 if(type==='flirt'&&(g.player.age<adultStart(g)||g.npcs[targetId]?.age<adultStart(g)))return{ok:false,message:'心动互动仅对成年居民开放。'};
 if(a.minRelation&&(g.relationships[targetId]??0)<a.minRelation)return{ok:false,message:'友好度达到 35 后，可以分享心动频率。'};
 const target=destination(g,targetId,point?{...point,island:g.viewIsland,side:g.viewSide}:null);if(target&&!sameSide(g.player,target)&&!findPath(g,g.player,target))return{ok:false,message:'目标区域不可达，请在两面放置畅通的传送门。'};
 if(type==='travel'&&!travelDestination(g,g.objects.find(o=>o.id===targetId),destinationId))return{ok:false,message:'对面星门出口被挡住，或星门连接不可用。'};
 if(['cook','brew','taste'].includes(type)&&ITEMS.find(i=>i.id===g.objects.find(o=>o.id===targetId)?.type)?.action!==type)return{ok:false,message:'请选择对应的料理设备。'};
 if(!target)return{ok:false,message:'请先放置需要的物品。'};
 g.queue=g.queue.filter(q=>q.source!=='ai');const q=makeAction(g,type,targetId,target,'manual');if(type==='incubate'||WONDER_ACTIONS[type]?.paired)q.partnerId=partnerId;if(type==='travel'||type==='voyage')q.destinationId=destinationId;g.queue.push(q);if(WONDER_ACTIONS[type]?.paired)invitePaired(g,actor(g,'player'),q);
 if(g.autonomy){g.autonomy.cooldown=3;g.autonomy.reason='优先执行你的安排';}return{ok:true};
}
export function cancelAction(g,id){const q=g.queue.find(a=>a.id===id);if(WONDER_ACTIONS[q?.type]?.paired)cancelPaired(g,q);g.queue=g.queue.filter(a=>a.id!==id);g.autonomy.cooldown=5;g.autonomy.reason='稍作休息，再决定下一步';}
export function setAutonomy(g,enabled){g.autonomy.enabled=g.player.alive&&enabled;g.autonomy.cooldown=0;g.autonomy.reason=enabled?'正在观察需求和周围环境':'等待你的安排';if(!enabled)g.queue=g.queue.filter(q=>q.source!=='ai');}
function makeAction(g,type,targetId,target,source){return{id:g.nextId++,type,targetId,target,source,elapsed:0,phase:'walking',path:null,...(['relax','lounge'].includes(type)?{seat:null}:{})};}
function actor(g,id){return id==='player'?{id,position:g.player,needs:g.needs,skills:g.skills,queue:g.queue,ai:g.autonomy}:{...g.npcs[id],id,position:g.npcs[id]};}
export function interactionError(g,type,targetId,partnerId=null){const people=allActors(g);if(WONDER_ACTIONS[type]?.paired&&people.find(p=>p.id===partnerId)?.queue.length>=6)return '这位邻居的行动队列已满（6 项），请等一个动作完成。';return wonderError(g,type,g.objects.find(o=>o.id===targetId),actor(g,'player'),people,partnerId);}
function allActors(g){return [...(g.player.alive?['player']:[]),...Object.keys(g.npcs).filter(id=>id!==controlledResidentId(g))].map(id=>actor(g,id));}
function guestApproach(g,targetId){const o=g.objects.find(o=>o.id===targetId);return o?{...localToWorld(o,[0,0,-1.15]),island:islandOf(o),side:sideOf(o)}:null;}
function pairedHost(g,q){return allActors(g).find(p=>p.queue.some(a=>a.id===q.hostActionId));}
function pairedGuest(g,q){return allActors(g).find(p=>p.queue.some(a=>a.hostActionId===q.id));}
function invitePaired(g,host,q){
 const guest=allActors(g).find(p=>p.id===q.partnerId);if(!guest||guest.queue.length>=6)return '邻居的行动队列已满，邀请已取消。';
 const invitation=makeAction(g,q.type,q.targetId,guestApproach(g,q.targetId),'manual');Object.assign(invitation,{hostId:host.id,hostActionId:q.id});guest.queue.push(invitation);q.invited=true;return null;
}
function cancelPaired(g,q){const hostActionId=q.hostActionId??q.id;for(const p of allActors(g))for(let i=p.queue.length-1;i>=0;i--)if(p.queue[i].id===hostActionId||p.queue[i].hostActionId===hostActionId)p.queue.splice(i,1);}
function preparePaired(g,host,q){
 // Pre-existing saves may contain an invitation that has not yet been dispatched.
 if(!q.invited){const issue=invitePaired(g,host,q);if(issue)return issue;}
 const people=allActors(g),guest=pairedGuest(g,q),o=g.objects.find(o=>o.id===q.targetId);if(!guest)return '邻居已经取消，本次共同活动取消。';
 q.partnerId=guest.id;const invitation=guest.queue.find(a=>a.hostActionId===q.id);invitation.hostId=host.id;
 const error=wonderError(g,q.type,o,host,people,q.partnerId,true);if(error)return error;
 return null;
}
function finishPaired(g,host,q){
 const guest=pairedGuest(g,q),a=ACTIONS[q.type];
 for(const [need,value] of Object.entries(a.effects))guest.needs[need]=clamp(guest.needs[need]+value);
 if(a.skill)guest.skills[a.skill]++;
 if(host.id==='player')g.relationships[guest.id]=clamp(g.relationships[guest.id]+18);
 else if(guest.id==='player')g.relationships[host.id]=clamp(g.relationships[host.id]+18);
 else {host.relationships[guest.id]=clamp(host.relationships[guest.id]+18);guest.relationships[host.id]=clamp(guest.relationships[host.id]+18);}
 guest.queue.splice(0,1);guest.ai.cooldown=5;
}
function inheritEstate(g,person){
 const children=allActors(g).filter(child=>child.position.parents.some(parent=>parent.uid===person.position.uid));if(!children.length)return;
 const money=person.id==='player'?g.money:person.position.money,inventory=person.id==='player'?{...g.harvest}:person.position.inventory;
 if(person.id==='player'){g.money=0;for(const key of Object.keys(g.harvest))g.harvest[key]=0;}
 for(const [index,child] of children.entries()){
  const share=money/children.length;if(child.id==='player')g.money+=share;else child.position.money+=share;
  for(const key of Object.keys(inventory)){const base=Math.floor(inventory[key]/children.length),amount=base+(index<inventory[key]%children.length?1:0);if(child.id==='player')g.harvest[key]+=amount;else child.position.inventory[key]+=amount;}
 }
 const names=children.map(child=>child.position.name).join('、'),text=children.length===1?`${names}继承了${person.position.name}留下的星币和收成。`:`${names}平分了${person.position.name}留下的星币和收成。`;
 g.log.unshift({text,at:g.minute});recordMajorEvent(g,text,'inheritance');
}
const seatedAction=q=>q&&['relax','lounge'].includes(q.type);
function freeSofaSeat(g,id,exclude){const used=allActors(g).map(a=>a.queue[0]).filter(q=>q!==exclude&&seatedAction(q)&&q.targetId===id).map(q=>q.seat);return SOFA_SEATS.findIndex((_,i)=>!used.includes(i));}
function inviteSofaGuests(g,host,q){
 const candidates=allActors(g).filter(a=>sameSide(a.position,host.position)&&a.id!==host.id&&a.id!=='player'&&!isInfant(g,a.position.age)&&Math.min(a.needs.hunger,a.needs.energy,a.needs.hygiene)>20&&a.queue.length<6&&!a.queue.some(q=>q.type==='lounge')&&!conversationWith(g,a.id)).sort((a,b)=>Math.hypot(a.position.x-host.position.x,a.position.z-host.position.z)-Math.hypot(b.position.x-host.position.x,b.position.z-host.position.z));
 q.sofaGroup=q.id;for(const guest of candidates.slice(0,2)){const seat=freeSofaSeat(g,q.targetId);if(seat<0)break;const invite=makeAction(g,'lounge',q.targetId,destination(g,q.targetId),'manual');invite.seat=guest.queue.length?null:seat;invite.invited=true;invite.sofaGroup=q.id;guest.queue.push(invite);guest.ai.reason=`已收到${host.position.name}的沙发聊天邀请`;}
}
function chatOnSofas(g,dt){
 const occupants=allActors(g).filter(a=>seatedAction(a.queue[0])&&a.queue[0].phase==='acting');
 for(let i=0;i<occupants.length;i++)for(let j=i+1;j<occupants.length;j++){const a=occupants[i],b=occupants[j];if(a.queue[0].targetId!==b.queue[0].targetId)continue;
  for(const person of [a,b]){person.needs.social=clamp(person.needs.social+dt*.9);person.skills.social+=dt*.025;}
  if(a.id==='player')g.relationships[b.id]=clamp(g.relationships[b.id]+dt*.35);else if(b.id==='player')g.relationships[a.id]=clamp(g.relationships[a.id]+dt*.35);else{a.relationships[b.id]=clamp(a.relationships[b.id]+dt*.35);b.relationships[a.id]=clamp(b.relationships[a.id]+dt*.35);}
 }
}
function availableMoney(g,person){return person.id==='player'?g.money:person.position.money;}
function parentActors(g,person){const people=allActors(g),uids=new Set((person.position.parents||[]).map(parent=>parent.uid));return people.filter(parent=>uids.has(parent.position.uid));}
function expensePayers(g,person){const parents=person.position.age<adultStart(g)?parentActors(g,person):[];return parents.length?parents:[person];}
function canAfford(g,person,amount){const payers=expensePayers(g,person),share=amount/payers.length;return payers.every(payer=>availableMoney(g,payer)>=share);}
function changeMoney(g,person,amount){if(amount<0){const payers=expensePayers(g,person),share=amount/payers.length;for(const payer of payers){if(payer.id==='player')g.money+=share;else payer.position.money+=share;}return;}if(person.id==='player')g.money+=amount;else person.position.money+=amount;}
export function canAffordAction(g,id,type){const action=ACTIONS[type],cost=actionCost(g,type);return !!action&&(!cost||canAfford(g,actor(g,id),cost));}
function conversationWith(g,id){return allActors(g).find(a=>a.id!==id&&a.queue[0]?.targetId===id&&ACTIONS[a.queue[0].type].relation);}
function surfacePath(g,start,end){
 if(!sameSide(start,end))return null;
 const key=(x,z)=>`${x},${z}`,sx=Math.round(start.x),sz=Math.round(start.z),ex=Math.round(end.x),ez=Math.round(end.z);
 const nodes=[{x:sx,z:sz}],seen=new Map([[key(sx,sz),null]]);let found=false;
 for(let i=0;i<nodes.length;i++){const p=nodes[i];if(p.x===ex&&p.z===ez){found=true;break;}for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx,z=p.z+dz,k=key(x,z);if(Math.abs(x)>11||Math.abs(z)>7||seen.has(k)||g.objects.some(o=>sameSide(o,start)&&Math.hypot(o.x-x,o.z-z)<.8))continue;seen.set(k,p);nodes.push({x,z});}}
 if(!found)return null;const path=[{x:ex,z:ez,island:islandOf(start),side:sideOf(start)}];let prev=seen.get(key(ex,ez));while(prev){path.unshift({...prev,island:islandOf(start),side:sideOf(start)});prev=seen.get(key(prev.x,prev.z));}path.shift();path.push(end);return path;
}
// Dijkstra connects walkable surface paths with deliberate, timed gate crossings.
function findPath(g,start,end){
 if(islandOf(start)!==islandOf(end))return null;
 const gates=g.objects.filter(o=>o.type==='gate'),nodes=[start,...gates.map(o=>({...approachPosition(o),island:islandOf(o),side:sideOf(o)})),end],goal=nodes.length-1;
 const distances=nodes.map(()=>Infinity),routes=nodes.map(()=>null),visited=new Set();distances[0]=0;routes[0]=[];
 const pathLength=(from,path)=>{let length=0;for(const point of path){length+=Math.hypot(point.x-from.x,point.z-from.z);from=point;}return length;};
 while(visited.size<nodes.length){
  let current=-1;for(let i=0;i<nodes.length;i++)if(!visited.has(i)&&Number.isFinite(distances[i])&&(current<0||distances[i]<distances[current]))current=i;
  if(current<0)return null;if(current===goal)return routes[current];visited.add(current);
  for(let next=1;next<nodes.length;next++){
   if(visited.has(next))continue;
   let path=surfacePath(g,nodes[current],nodes[next]),cost=path?pathLength(nodes[current],path):Infinity;
   if(current>0&&current<goal&&next<goal){
    const arrival=travelDestination(g,gates[current-1],gates[next-1].id),travelCost=actionDuration(g,'travel')*2.8;
    if(arrival&&travelCost<cost){path=[{...arrival,gateId:gates[current-1].id,destinationId:gates[next-1].id}];cost=travelCost;}
   }
   if(path&&distances[current]+cost<distances[next]){distances[next]=distances[current]+cost;routes[next]=routes[current].concat(path);}
  }
 }
 return null;
}
function ensureNpcCareer(g,person){
 const current=person.position.career;
 if(current&&CAREERS[current.id]&&!missingCareerSkills(person.skills,current.id,1,g.config).length)return true;
 const eligible=Object.keys(CAREERS).filter(id=>!missingCareerSkills(person.skills,id,1,g.config).length);
 const id=eligible.find(candidate=>candidate===NPC_CAREERS[person.id])||eligible[0];
 if(!id){person.ai.reason='技能不足，先锻炼职业要求的技能';return false;}
 person.position.career={id,level:1,shifts:0};
 return true;
}
function chooseWeighted(candidates,random){
 const ordered=[...candidates].sort((a,b)=>b.score-a.score),total=ordered.reduce((sum,candidate)=>sum+candidate.score,0);
 let roll=Math.max(0,Math.min(1-Number.EPSILON,random()))*total;
 return ordered.find(candidate=>{roll-=candidate.score;return roll<0;})||ordered[ordered.length-1];
}
function cooperationPartners(g,person,type,o){return allActors(g).filter(partner=>partner.id!==person.id&&partner.queue.length<6&&!partner.queue.some(q=>WONDER_ACTIONS[q.type]?.paired)&&Math.min(partner.needs.hunger,partner.needs.energy)>=20&&!wonderError(g,type,o,person,allActors(g),partner.id));}
export function autonomousCandidates(g,id){
 const person=actor(g,id),people=allActors(g);
 const candidates=[];
 for(const o of g.objects){
  let types=WONDER_OPTIONS[o.type]||[ITEMS.find(i=>i.id===o.type).action];
  if(CROPS[o.type])types=[o.plant.health<=0?'replant':o.plant.growth>=1?'harvest':'garden'];
  if(o.type==='sofa')types=['relax','lounge'];if(o.type==='lab')types=['research','spaceResearch'];if(o.type==='portal')types=['explore','memoryExpedition','voyage'];
  for(const type of types){
   if(type==='incubate')continue;
   if(type==='voyage'){for(const id of Object.keys(STAR_ISLANDS))if(!civilizationError(g,type,o,person.position,person.skills,id))candidates.push({type,targetId:o.id,destinationId:id});}
   else if(type==='travel'){for(const gate of g.objects)if(gate.type==='gate'&&gate.id!==o.id&&travelDestination(g,o,gate.id))candidates.push({type,targetId:o.id,destinationId:gate.id});}
   else if(WONDER_ACTIONS[type]?.paired){if(cooperationPartners(g,person,type,o).length)candidates.push({type,targetId:o.id});}
   else candidates.push({type,targetId:o.id});
  }
 }
 if(person.position.age>=adultStart(g))for(const n of neighbors(g))if(isInfant(g,n.age))candidates.push({type:'care',targetId:n.id});
 // Births share the household budget and must pass resource and caregiver checks.
 for(const n of neighbors(g))if(!isInfant(g,n.age)&&n.id!==person.id&&!g.npcs[n.id].queue.length&&!conversationWith(g,n.id))for(const type of ['chat','joke','gift','flirt'])if(type!=='flirt'||person.position.age>=adultStart(g)&&n.age>=adultStart(g)&&(person.id==='player'?g.relationships[n.id]:person.relationships[n.id])>=35)candidates.push({type,targetId:n.id});
 const careerReady=person.id==='player'?!missingCareerSkills(person.skills,g.career.id,1,g.config).length:ensureNpcCareer(g,person);
 if(person.position.age>=adultStart(g)&&g.minute>=480&&g.minute<1080&&person.ai.lastWorkDay!==g.day&&Math.min(...Object.values(person.needs))>45&&careerReady){
  for(const o of g.objects)if(o.type===workStationType(person.id==='player'?g.career.id:person.position.career.id))candidates.push({type:'work',targetId:o.id});
 }
 const fertility=birthDecision(g,person.id);if(fertility.ready)candidates.push({type:'incubate',targetId:fertility.podId,partnerId:fertility.partnerId});
 const point={x:Math.round(Math.sin(g.day+g.minute/60+person.position.age)*8),z:Math.round(Math.cos(g.day+person.position.age)*5),island:islandOf(person.position),side:sideOf(person.position)};
 if(canPlace(g,point.x,point.z,point.side))candidates.push({type:'walk',targetId:null,point});
 return candidates;
}
function decide(g,person,random=Math.random){
 const candidates=autonomousCandidates(g,person.id);
 const active=allActors(g).flatMap(a=>a.queue.slice(0,1));
 const weights={hunger:1.8,energy:1.6,social:1.3,fun:1,hygiene:1.4,comfort:.8};
 const scored=[];
  for(const candidate of candidates){
   if(['relax','lounge'].includes(candidate.type)){if(freeSofaSeat(g,candidate.targetId)<0)continue;}else if(active.some(q=>q.targetId===candidate.targetId&&!WONDER_ACTIONS[candidate.type]?.paired))continue;
   const action=ACTIONS[candidate.type],cost=actionCost(g,candidate.type);if(cost&&!canAfford(g,person,cost))continue;const target=destination(g,candidate.targetId,candidate.point);
  if(!target)continue;
  if(civilizationError(g,candidate.type,g.objects.find(o=>o.id===candidate.targetId),person.position,person.skills,candidate.destinationId))continue;
  if(!WONDER_ACTIONS[candidate.type]?.paired&&wonderError(g,candidate.type,g.objects.find(o=>o.id===candidate.targetId),person,allActors(g),candidate.partnerId))continue;
  const bonus=autonomyBonus(g,person,candidate,allActors(g));if(bonus===null)continue;
  let score=bonus,dominant=null,largest=0;
  for(const [need,effect]of Object.entries(action.effects)){
   const value=person.needs[need],deficit=(100-value)/100;
   const benefit=effect>0?Math.min(effect,100-value)*deficit*deficit*weights[need]*(value<25?3:1):effect*(value<40?3:.25);
   score+=benefit;if(benefit>largest){largest=benefit;dominant=need;}
  }
  const preference=candidate.type==='chat'&&person.needs.social>=75?0:actionPreference(person,candidate.type);
  score+=preference;if(candidate.type==='relax'&&active.some(q=>seatedAction(q)&&q.targetId===candidate.targetId))score+=(100-person.needs.social)*.5;
  if(['garden','harvest','replant'].includes(candidate.type)){const p=g.objects.find(o=>o.id===candidate.targetId).plant;if(candidate.type==='garden'){if(p.water>=90&&p.health>=90)continue;score+=p.water<25?65:(100-p.health)*.4;}if(candidate.type==='harvest')score+=55+(person.position.preferences.garden||0);if(candidate.type==='replant')score+=35+(person.position.preferences.garden||0);}
  if(candidate.type==='incubate')score+=25+person.position.familyDesire*30;if(candidate.type==='care'){const baby=g.npcs[candidate.targetId];score+=(100-baby.needs.hunger)*2+(baby.starvation>0?300:0);if(baby.needs.hunger>70)continue;}if(candidate.type==='work')score+=availableMoney(g,person)<500?55:28;
  if(['traceRelic','decodeRelic','restoreMemory'].includes(candidate.type))score+=12;if(candidate.type==='catchBugs')score+=g.wonders.dust<3?15:0;
  score-=Math.hypot(person.position.x-target.x,person.position.z-target.z)*.35;
  if(person.ai.lastAction===candidate.type)score-=14;
  if(score<=0)continue;
  const path=findPath(g,person.position,target);if(!path)continue;
  const reason=candidate.type==='harvest'?'植物成熟了，先把收成带回家':candidate.type==='replant'?'清理枯萎植物，重新播种':candidate.type==='garden'?'给植物补水，让它健康生长':candidate.type==='incubate'?'生活稳定、照料人手充足，想迎接新的家人':candidate.type==='care'?'幼体需要喂养，先照料小居民':candidate.type==='work'?'状态良好，工作赚取星币':largest>preference&&dominant?`${NEEDS[dominant][0]}需要补充`:'想做一件自己喜欢的事';
  scored.push({...candidate,target,path,score,reason});
 }
 if(!scored.length){person.ai.reason='暂时没有合适的行动，休息观察';person.ai.cooldown=3;return;}
 // Select the activity first; participant choice has its own subsequent draw.
 for(const c of scored)if(WONDER_ACTIONS[c.type]?.paired||c.type==='lounge')c.score*=.7;
 const best=chooseWeighted(scored,random);
 if(WONDER_ACTIONS[best.type]?.paired){const partners=cooperationPartners(g,person,best.type,g.objects.find(o=>o.id===best.targetId));if(!partners.length)return;best.partnerId=chooseWeighted(partners.map(p=>({id:p.id,score:Math.max(1,20+(person.id==='player'?g.relationships[p.id]:person.relationships[p.id]??0)*.2-p.queue.length*2-Math.hypot(p.position.x-person.position.x,p.position.z-person.position.z)*.3)})),random).id;}
 const q=makeAction(g,best.type,best.targetId,best.target,'ai');q.path=best.path;if(best.partnerId!==undefined)q.partnerId=best.partnerId;if(best.destinationId)q.destinationId=best.destinationId;
 person.queue.push(q);if(WONDER_ACTIONS[q.type]?.paired)invitePaired(g,person,q);person.ai.reason=WONDER_ACTIONS[q.type]?.paired?`想邀请邻居一起${ACTIONS[q.type].name.includes('传光')?'传光':'解读遗迹'}`:best.reason;
}

function ensureStarIsland(g,id){
 if(id==='home'||g.objects.some(o=>islandOf(o)===id))return;
 const layout=[['portal',0,0],['pod',-5,-3],['food',-2,-3],['shower',2,-3],['lab',5,-3],[id==='spore'?'garden':'relic',5,2]];
 for(const [type,x,z] of layout){const o={id:`${id}-${type}`,island:id,side:'front',type,x,z,rotation:0,fixed:true};if(CROPS[type])o.plant=createPlant();if(WONDER_OPTIONS[type])o.wonder=createWonder(type);g.objects.push(o);}
}

function finishAction(g,person,q){
 const action=ACTIONS[q.type],cost=actionCost(g,q.type),isPlayer=person.id==='player';
 let cropMessage=null,prayerMessage=null;
 const object=g.objects.find(o=>o.id===q.targetId),civilIssue=civilizationError(g,q.type,object,person.position,person.skills,q.destinationId);
 if(civilIssue){releaseAction(person,q);g.log.unshift({text:civilIssue,at:g.minute});return;}
 if(q.type==='voyage'){
  const id=q.destinationId;ensureStarIsland(g,id);const spot=[[0,2],[2,2],[-2,2],[0,4],[4,4],[-4,4]].map(([x,z])=>({x,z,island:id,side:'front'})).find(p=>!g.objects.some(o=>sameSide(o,p)&&Math.hypot(o.x-p.x,o.z-p.z)<1.1));
  if(!spot){releaseAction(person,q);g.log.unshift({text:'星舟降落区被挡住，请腾出通路后再出发。',at:g.minute});return;}Object.assign(person.position,spot);g.civilization.visits[id]++;
  if(isPlayer){g.viewIsland=id;g.viewSide='front';g.completed++;}g.log.unshift({text:`${person.position.name}抵达${STAR_ISLANDS[id].name}。`,at:g.minute});releaseAction(person,q);return;
 }
 const wonderIssue=wonderError(g,q.type,object,person,allActors(g),q.partnerId);
 if(wonderIssue){person.queue.shift();person.ai.cooldown=3;g.log.unshift({text:wonderIssue,at:g.minute});return;}
 if(q.type==='travel'){
  const arrival=travelDestination(g,g.objects.find(o=>o.id===q.targetId),q.destinationId);
  releaseAction(person,q);
  if(!arrival){if(isPlayer)g.log.unshift({text:'目的地出口被家具挡住，请腾出通路。',at:g.minute});return;}
  Object.assign(person.position,arrival);if(isPlayer){g.viewSide=arrival.side;g.completed++;g.log.unshift({text:'穿过折跃门，抵达'+SIDES[arrival.side]+'。',at:g.minute});}return;
 }
 if(['garden','harvest','replant'].includes(q.type)){const o=g.objects.find(o=>o.id===q.targetId),error=plantActionError(o,q.type);if(error){person.queue.shift();person.ai.cooldown=3;if(isPlayer)g.log.unshift({text:error,at:g.minute});return;}if(q.type==='garden')tendPlant(o);if(q.type==='replant')o.plant={...createPlant(),growth:0,harvests:o.plant.harvests};if(q.type==='harvest'){const crop=cropDefinition(g,o.type),amount=harvestPlant(o,cropDefinitions(g)),inventory=isPlayer?g.harvest:person.position.inventory;inventory[crop.key]+=amount;cropMessage=`${person.position.name}收获了 ${amount} 份${crop.name}，已放入${isPlayer?'收成仓库':'个人物品包'}。`;g.log.unshift({text:cropMessage,at:g.minute});}}
 if(action.work){const state=isPlayer?g.career:person.position.career,error=state?careerEntryMessage(g,state.id,person.skills):'尚未申请职业。';if(error){person.queue.shift();person.ai.cooldown=3;if(isPlayer)g.log.unshift({text:`工作未完成：${error}`,at:g.minute});return;}}
 if(cost&&!canAfford(g,person,cost)){person.queue.shift();g.log.unshift({text:action.costMessage||'星币不足，礼物没有送出。',at:g.minute});return;}
 for(const [need,effect]of Object.entries(action.effects))person.needs[need]=clamp(person.needs[need]+effect);
 if(action.skill)person.skills[action.skill]++;
 contributeCivilization(g,q.type,person.position);
 const resonance=useCrystal(g,q.type,object,person);
 if(WONDER_ACTIONS[q.type]){cropMessage=finishWonder(g,q.type,object,person,allActors(g),q.partnerId);if(q.type==='memoryExpedition')changeMoney(g,person,120);if(action.paired)finishPaired(g,person,q);g.log.unshift({text:cropMessage,at:g.minute});if(['restoreMemory','memoryExpedition'].includes(q.type))recordMajorEvent(g,cropMessage,'discovery');}
 if(resonance){cropMessage=`${action.name}完成。${resonance}`;g.log.unshift({text:cropMessage,at:g.minute});}
 if(q.type==='pray'){
  const tree=g.objects.find(o=>o.id===q.targetId&&o.type==='spiritTree');
  const result=resolvePrayer(person.position,person.skills,sideOf(tree),g.config.prayer,g.config.lifeStages);
  prayerMessage=`${person.position.name}：${blessingMessage(result)}。`;g.log.unshift({text:prayerMessage,at:g.minute});
  if(prayerSucceeded(result)){q.blessing=result;recordMajorEvent(g,prayerMessage,'prayer');}
 }
 if(q.type==='incubate'){const decision=q.source==='ai'?birthDecision(g,person.id):null;const error=decision&&!decision.ready?decision.reason:birthError(g,person.position,q.targetId)||partnerError(g,person.id,q.partnerId,q.source==='ai');if(error){person.queue.shift();g.log.unshift({text:error,at:g.minute});return;}const parents=[person.position,...(q.partnerId?[g.npcs[q.partnerId]]:[])];for(const parent of parents)parent.lastBirthDay=g.day;const eventText=`${person.position.name}${q.source==='ai'?'自主决定':'决定'}孕育星芽，育生舱将在 3 天后迎来新生命。`;g.log.unshift({text:eventText,at:g.minute});recordMajorEvent(g,eventText,'incubation');g.incubations.push({id:`egg-${g.nextId++}`,podId:q.targetId,due:gameMinutes(g)+4320,parents:parents.map(p=>({uid:p.uid,name:p.name,color:p.color,genome:{...p.genome},preferences:{...p.preferences},familyDesire:p.familyDesire,prayer:structuredClone(p.prayer)}))});}
 if(q.type==='care'){const baby=g.npcs[q.targetId];if(baby){for(const key in baby.needs)baby.needs[key]=clamp(baby.needs[key]+85);baby.starvation=0;}}
 if(action.relation){
  const other=g.npcs[q.targetId];other.needs.social=clamp(other.needs.social+15);
  if(isPlayer)g.relationships[q.targetId]=clamp(g.relationships[q.targetId]+action.relation);
  else{person.relationships[q.targetId]=clamp(person.relationships[q.targetId]+action.relation);other.relationships[person.id]=clamp(other.relationships[person.id]+action.relation);}
 }
  if(cost)changeMoney(g,person,-cost);if(action.money)changeMoney(g,person,action.money);
  let text=q.type==='incubate'||cropMessage||prayerMessage?g.log[0].text:`完成：${action.name}`;
  if(action.work){
   const state=isPlayer?g.career:person.position.career,c=careerDefinition(g,state.id),level=c.levels[state.level-1],wage=level.wage;changeMoney(g,person,wage);person.ai.lastWorkDay=g.day;state.shifts++;text=`工作完成，获得 ${wage} 星币。`;
   const next=c.levels[state.level];
   if(next&&state.shifts>=next.shifts&&!missingCareerSkills(person.skills,state.id,state.level+1,g.config).length){state.level++;state.shifts=0;if(isPlayer)text+=` 晋升为${c.levels[state.level-1].title}！`;}
  }
  if(isPlayer){
   g.completed++;if(q.type!=='incubate'&&!cropMessage&&!prayerMessage)g.log.unshift({text,at:g.minute});g.log=g.log.slice(0,20);
  }
 if(q.blessing){q.phase='celebrating';q.elapsed=0;}else releaseAction(person,q);
}

function releaseAction(person,q){person.ai.lastAction=q.type;person.ai.lastTarget=q.targetId;person.ai.cooldown=4;person.ai.reason='刚刚完成行动，稍作休息';person.queue.shift();}

function advanceAction(g,person,dt){
 const q=person.queue[0];if(!q)return;
 if(q.phase==='celebrating'){q.elapsed+=dt;if(q.elapsed>=PRAYER_RULES.celebrationSeconds)releaseAction(person,q);return;}
 if(q.hostId&&!pairedHost(g,q)){person.queue.shift();return;}
 if(WONDER_ACTIONS[q.type]?.paired&&!q.hostId){const issue=preparePaired(g,person,q);if(issue){cancelPaired(g,q);person.ai.cooldown=3;g.log.unshift({text:issue,at:g.minute});return;}}
 const currentTarget=q.type==='walk'?q.target:q.hostId?guestApproach(g,q.targetId):destination(g,q.targetId);if(currentTarget&&(!sameSide(currentTarget,q.target)||Math.hypot(currentTarget.x-q.target.x,currentTarget.z-q.target.z)>1.5)){q.target=currentTarget;q.path=null;delete q.transit;q.phase='walking';}
 if(q.type!=='walk'&&!destination(g,q.targetId)){person.queue.shift();person.ai.cooldown=3;person.ai.reason='目标已不存在，重新观察';return;}
 if(seatedAction(q)){
  const sofa=g.objects.find(o=>o.id===q.targetId&&o.type==='sofa');if(!sofa){person.queue.shift();return;}
  if(!Number.isInteger(q.seat)||q.seat<0){const seat=freeSofaSeat(g,q.targetId,q);if(seat<0){q.phase='waiting';return;}q.seat=seat;q.path=null;q.phase='walking';}
  const approach=localToWorld(sofa,[1.3,0,SOFA_SEATS[q.seat]]);if(q.target.x!==approach.x||q.target.z!==approach.z){q.target={x:approach.x,z:approach.z,island:islandOf(sofa),side:sideOf(sofa)};q.path=null;}
  if(q.type==='lounge'&&!q.invited){q.invited=true;inviteSofaGuests(g,person,q);}
 }
 if(q.phase==='walking'){
  if(!q.path){if(g.npcs[q.targetId])q.target=destination(g,q.targetId);q.path=findPath(g,person.position,q.target);}
  if(!q.path){person.queue.shift();person.ai.cooldown=3;person.ai.reason='通路被挡住了';if(person.id==='player')g.log.unshift({text:'那里被挡住了，请在建造模式中留出通路。',at:g.minute});return;}
  const speed=person.id==='player'?2.8:1.7;let distance=dt*speed;
  while(q.path.length&&distance>0){const p=q.path[0];
   if(p.gateId){
    const source=g.objects.find(o=>o.id===p.gateId),arrival=travelDestination(g,source,p.destinationId);
    if(!source||!sameSide(source,person.position)){q.path=null;delete q.transit;return;}
    if(!arrival){q.path=null;delete q.transit;return;}
    q.transit??={sourceId:source.id,destinationId:p.destinationId,elapsed:0};
    const spend=Math.min(distance/speed,Math.max(0,actionDuration(g,'travel')-q.transit.elapsed));q.transit.elapsed+=spend;distance-=spend*speed;
    if(q.transit.elapsed<actionDuration(g,'travel'))return;
    const previousSide=sideOf(person.position);Object.assign(person.position,arrival);if(person.id==='player'&&g.viewSide===previousSide)g.viewSide=arrival.side;
    q.path.shift();delete q.transit;continue;
   }
   const dx=p.x-person.position.x,dz=p.z-person.position.z,d=Math.hypot(dx,dz);if(d<=distance){person.position.x=p.x;person.position.z=p.z;q.path.shift();distance-=d;}else{person.position.x+=dx/d*distance;person.position.z+=dz/d*distance;distance=0;}}
  if(q.path.length)return;q.phase='waiting';dt=distance/speed;
 }
 const reserved=allActors(g).some(a=>a.id!==person.id&&a.queue[0]?.targetId===q.targetId&&groupId(a.queue[0])!==groupId(q)&&a.queue[0].phase==='acting');
 if(q.type!=='walk'&&q.type!=='travel'&&!seatedAction(q)&&reserved){q.phase='waiting';return;}
 if(WONDER_ACTIONS[q.type]?.paired){
  const peer=q.hostId?pairedHost(g,q):pairedGuest(g,q),other=peer?.queue[0],matching=q.hostId?other?.id===q.hostActionId:other?.hostActionId===q.id;
  if(!matching||!['waiting','acting'].includes(other.phase)||other.path?.length!==0||pairedCooldown(g,q.type,g.objects.find(o=>o.id===q.targetId))>0){q.phase='waiting';return;}
  q.phase='acting';if(q.hostId){q.elapsed=other.elapsed;return;}
 }else q.phase='acting';q.elapsed+=dt;if(q.elapsed>=actionDuration(g,q.type))finishAction(g,person,q);
}

export function tick(g,seconds,random=Math.random){
 if(!g.speed)return;const dt=seconds*g.speed,time=g.config?.time||{gameMinutesPerRealSecond:2,starYearDays:8},gameMinutesPerSecond=time.gameMinutesPerRealSecond;g.minute+=dt*gameMinutesPerSecond;while(g.minute>=1440){g.minute-=1440;g.day++;payGovernmentSubsidy(g);}
 const crops=cropDefinitions(g);advancePlants(g.objects,dt*gameMinutesPerSecond,crops);advanceWonders(g,dt*gameMinutesPerSecond,allActors(g));
 for(const person of allActors(g))for(const q of [...person.queue])if(WONDER_ACTIONS[q.type]?.paired&&(q.hostId?!pairedHost(g,q):q.invited&&!pairedGuest(g,q)))cancelPaired(g,q);
 // Direct conversations take precedence over a neighbor's autonomous plan.
 advanceCooperation(allActors(g),dt,q=>WONDER_ACTIONS[q.type]?.paired);
 const manual=g.queue[0];
 if(manual?.source==='manual'&&ACTIONS[manual.type].relation){
  for(const [id,n]of Object.entries(g.npcs))if(id===manual.targetId||n.queue[0]?.targetId===manual.targetId){for(const q of [...n.queue])if(WONDER_ACTIONS[q.type]?.paired&&!q.hostId)cancelPaired(g,q);const invitations=n.queue.filter(q=>q.hostActionId);n.queue.splice(0,n.queue.length,...invitations);n.ai.cooldown=3;}
 }
 for(const person of allActors(g)){
  if(person.id!=='player'&&!g.npcs[person.id])continue;
  const wasMinor=person.position.age<adultStart(g);person.position.age=Math.min(120,person.position.age+dt*gameMinutesPerSecond/(1440*time.starYearDays));if(person.id!=='player'&&wasMinor&&person.position.age>=adultStart(g)&&person.position.money===0)person.position.money=ADULT_STARTING_MONEY;
  const hungerBefore=person.needs.hunger;
  const decay=g.config?.needDecay||DECAY,infant=isInfant(g,person.position.age);for(const key in decay)person.needs[key]=clamp(person.needs[key]-dt*decay[key]*(infant?.15:1));
  const zeroMinutes=Math.max(0,dt-hungerBefore/(decay.hunger*(infant?.15:1)))*gameMinutesPerSecond;
  if(advanceLife(g,person,zeroMinutes))continue;
  if(infant){person.queue.length=0;if(person.id!=='player')person.position.activity='在摇篮中休息 · 等待照料';continue;}
  const partner=conversationWith(g,person.id);
  if(partner){if(person.id!=='player')person.position.activity=partner.id==='player'?`和${g.player.name}交谈`:`和${g.npcs[partner.id].name}交谈`;continue;}
  person.ai.cooldown=Math.max(0,person.ai.cooldown-dt);
  if(person.ai.enabled&&!person.queue.length&&person.ai.cooldown===0)decide(g,person,random);
  advanceAction(g,person,dt);
  if(person.id!=='player'){const q=person.queue[0];person.position.activity=q?`${q.phase==='walking'?'前往 · ':q.phase==='waiting'?'等候 · ':''}${ACTIONS[q.type].name}`:'享受星湾的微风';}
 }
 chatOnSofas(g,dt);hatchReady(g);
}
function payGovernmentSubsidy(g){
 const amount=g.config?.economy?.governmentSubsidy??GOVERNMENT_SUBSIDY;for(const person of allActors(g)){const age=person.position.age;if(age>=elderStart(g)||(age<adultStart(g)&&!parentActors(g,person).length))changeMoney(g,person,amount);}
}
export const gameMinutes=g=>(g.day-1)*1440+g.minute;
export function birthDecision(g,id){
 const p=id==='player'?g.player:g.npcs[id],needs=id==='player'?g.needs:p?.needs;
 const no=reason=>({ready:false,reason});
 if(!p?.alive)return no('生命已结束');
 if(p.age<adultStart(g)||p.age>=90)return no(`${adultStart(g)}–89 星岁的成年居民会考虑生育`);
 if(p.familyDesire<.4)return no('目前没有生育意愿');
 if(g.incubations.some(b=>b.parents.some(parent=>parent.uid===p.uid)))return no('正在等待自己的星芽出生');
 if(p.lastBirthDay!==null&&g.day-p.lastBirthDay<30)return no(`先陪伴家人，${30-(g.day-p.lastBirthDay)} 天后再考虑`);
 const people=allActors(g).map(actor=>actor.position);
 const children=childCount(g,p.uid);
 if(children>=2)return no('已有两位子女，希望把时间留给家人');
 if(Math.min(...Object.values(needs))<65)return no('先照顾好自己的需求，再考虑生育');
 if(g.money<actionCost(g,'incubate')+600)return no(`需要 ${actionCost(g,'incubate')+600} 星币，孕育后保留 600 星币生活储备`);
 if(!g.objects.some(o=>sameSide(o,p)&&o.type==='food'))return no('家园需要营养合成器');
 if(people.length+g.incubations.length>=8)return no('星湾居民已较多，暂缓自主生育');
 const carers=allActors(g).filter(a=>sameSide(a.position,p)&&a.position.age>=adultStart(g)&&a.position.age<110&&Math.min(...Object.values(a.needs))>=45&&a.ai.enabled).length;
 const dependents=people.filter(n=>isInfant(g,n.age)).length+g.incubations.length;
 if(carers<2||dependents>=Math.min(2,carers-1))return no('需要至少两位状态良好的自主成年居民，并留出照料人手');
 if(people.some(n=>isInfant(g,n.age)&&(n===g.player?g.needs:n.needs).hunger<60))return no('先把现有幼体照料好');
 const pod=g.objects.find(o=>sameSide(o,p)&&o.type==='nursery'&&!g.incubations.some(b=>b.podId===o.id));
 if(!pod)return no('需要一座空闲的星芽育生舱');
 const partner=neighbors(g).filter(n=>n.id!==id&&!partnerError(g,id,n.id,true)).sort((a,b)=>relationTo(g,id,b.id)-relationTo(g,id,a.id))[0];
 return{ready:true,podId:pod.id,partnerId:partner?.id||null,reason:'愿意迎接家人，资金、需求与照料条件都已具备'};
}
const relationTo=(g,id,other)=>id==='player'?g.relationships[other]:g.npcs[id].relationships[other];
const childCount=(g,uid)=>[...allActors(g).map(a=>a.position),...g.memorials].filter(n=>n.parents.some(p=>p.uid===uid)).length;
function partnerError(g,id,partnerId,autonomous=false){
 if(partnerId===null)return null;
 const p=id==='player'?g.player:g.npcs[id],other=g.npcs[partnerId];
  if(!other||!sameSide(other,p)||other===p||other.age<adultStart(g)||other.age>=90||other.familyDesire<.4||relationTo(g,id,partnerId)<35)return '共同亲代需要成年、有生育意愿，并达到 35 友好度。';
 if(p.parents.some(n=>n.uid===other.uid)||other.parents.some(n=>n.uid===p.uid)||p.parents.some(n=>other.parents.some(o=>o.uid===n.uid)))return '近亲居民不能共同孕育。';
 if(other.lastBirthDay!==null&&g.day-other.lastBirthDay<30||g.incubations.some(b=>b.parents.some(n=>n.uid===other.uid)))return '共同亲代正在孕育或陪伴新生家人，请稍后再考虑。';
 if(autonomous&&childCount(g,other.uid)>=2)return '共同亲代已有两位子女，希望把时间留给家人。';
 if(Math.min(...Object.values(other.needs))<(autonomous?65:45))return '共同亲代需要先照顾好自己。';
 return null;
}
function birthError(g,parent,podId){
  if(!parent.alive||parent.age<adultStart(g))return '成年居民才能孕育星芽。';
 if(!g.objects.some(o=>o.id===podId&&o.type==='nursery'))return '请先摆放星芽育生舱。';
 if(g.incubations.some(b=>b.podId===podId))return '育生舱正在孕育，出生后才能再次使用。';
 if(Object.keys(g.npcs).length+Number(g.player.alive)-Number(controlledResidentId(g)!=='player')+g.incubations.length>=12)return '星湾最多容纳 12 位居民，请暂缓孕育。';
 const cost=actionCost(g,'incubate');if(g.money<cost)return `孕育需要 ${cost} 星币。`;
 return null;
}
function advanceLife(g,person,zeroMinutes){
 const p=person.position,before=p.starvation;p.starvation=person.needs.hunger<=0?p.starvation+zeroMinutes:0;
  if(before<720&&p.starvation>=720)g.log.unshift({text:`${p.name}持续饥饿，请尽快${isInfant(g,p.age)?'安排照料':'进食'}！再持续 12 小时将有生命危险。`,at:g.minute});
  const cause=p.age>=lifeEnd(g)?'old_age':p.starvation>=1440?'starvation':null;if(!cause)return false;
 p.alive=false;person.queue.length=0;person.ai.enabled=false;
 inheritEstate(g,person);
 g.memorials.unshift({uid:p.uid,name:p.name,age:p.age,day:g.day,cause,parents:p.parents});
 const eventText=`${p.name}${cause==='old_age'?'走完了漫长的一生':'因长期饥饿离世'}。星湾会记得这位居民。`;g.log.unshift({text:eventText,at:g.minute});recordMajorEvent(g,eventText,'death');
 if(person.id==='player'){g.speed=0;if(controlledResidentId(g)!=='player'){delete g.npcs[controlledResidentId(g)];g.controlledId='player';}}else{delete g.npcs[person.id];delete g.relationships[person.id];}
 for(const other of allActors(g)){const queue=other.queue;for(let i=queue.length-1;i>=0;i--)if(queue[i].targetId===person.id||queue[i].partnerId===person.id)queue.splice(i,1);if(other.id!=='player')delete other.relationships[person.id];}
 return true;
}
function hatchReady(g){
 for(const birth of [...g.incubations]){
  if(gameMinutes(g)<birth.due)continue;
  const pod=g.objects.find(o=>o.id===birth.podId);
  const spot=[[2,0],[-2,0],[0,2],[0,-2],[2,2],[-2,2],[2,-2],[-2,-2]].map(([x,z])=>({x:pod.x+x,z:pod.z+z})).find(p=>canPlace(g,p.x,p.z,sideOf(pod),islandOf(pod))&&allActors(g).every(a=>!sameSide(a.position,pod)||Math.hypot(a.position.x-p.x,a.position.z-p.z)>.9));
  if(!spot)continue;
  const serial=g.nextId++,id=`resident-${serial}`;
  const inherited=inheritTraits(birth.parents,Math.random,g.config?.mutationRates,g.config?.prayer);
  const usedNames=[g.player,...Object.values(g.npcs),...g.memorials].map(person=>person.name);
  const n={id,name:generateResidentName({uid:id,preferences:inherited.preferences},usedNames),color:inherited.color,trait:'星湾新生 · 喜爱陪伴',x:spot.x,z:spot.z};
  const baby=createNeighbor(n);Object.assign(baby,{island:islandOf(pod),side:sideOf(pod),uid:id,name:n.name,...inherited,gender:['male','female','nonbinary'][serial%3],age:0,money:0,inventory:createInventory(),parents:birth.parents.map(p=>({uid:p.uid,name:p.name})),activity:'在摇篮中休息 · 等待照料'});
  baby.relationships=Object.fromEntries(Object.keys(g.npcs).map(id=>[id,10]));
  for(const other of Object.values(g.npcs))other.relationships[id]=10;
  g.npcs[id]=baby;g.relationships[id]=birth.parents.some(p=>p.uid===g.player.uid)?60:10;
  g.incubations.splice(g.incubations.indexOf(birth),1);
  const eventText=`${n.name}出生了！${birth.parents.map(p=>p.name).join('与')}的星芽成为星湾的新居民，请照料这位幼体。${baby.mutations.length?' 本次出现了'+baby.mutations.join('、')+'。':''}`;g.log.unshift({text:eventText,at:g.minute});recordMajorEvent(g,eventText,'birth');
 }
}
export function takeOver(g,id){
  const n=g.npcs[id];if(g.player.alive||!n||isInfant(g,n.age))return{ok:false,message:`主控居民离世后，可接管 ${stageConfig(g).infantEnd} 星岁以上的居民。`};
 const {needs,skills,relationships,queue,ai,activity,money,inventory,career,...profile}=n;
 g.money+=money;for(const key of Object.keys(g.harvest))g.harvest[key]+=inventory[key];
 g.player=profile;g.controlledId='player';g.viewIsland=islandOf(profile);g.viewSide=sideOf(profile);g.needs=needs;g.skills=skills;g.relationships={...relationships};delete g.relationships[id];g.queue=[];g.autonomy={...ai,enabled:true,cooldown:0,reason:'正在观察需求和周围环境'};g.career=career||{id:'scientist',level:1,shifts:0};
 delete g.npcs[id];for(const other of Object.values(g.npcs)){delete other.relationships[id];other.queue=other.queue.filter(q=>q.targetId!==id&&q.partnerId!==id);}
 g.speed=0;g.log.unshift({text:`从现在起，你将陪伴${g.player.name}继续星湾的生活。`,at:g.minute});return{ok:true};
}
export function serialize(g){return JSON.stringify(g);}
export function restore(raw){
 const g=JSON.parse(raw),finite=Number.isFinite,point=p=>p&&finite(p.x)&&finite(p.z),range=(n,min,max)=>finite(n)&&n>=min&&n<=max;
 if(g?.version===1){
  if(!Array.isArray(g.queue)||!NPCS.every(n=>point(g.npcs?.[n.id])&&finite(g.npcs[n.id].timer)&&Number.isInteger(g.npcs[n.id].step)&&Array.isArray(g.npcs[n.id].path)&&g.npcs[n.id].path.every(point)))throw new Error('旧存档格式不兼容');
  // Only the shipped v1 schema is migrated; obsolete patrol state is discarded.
  g.npcs=Object.fromEntries(NPCS.map(n=>[n.id,{...createNeighbor(n),x:g.npcs[n.id].x,z:g.npcs[n.id].z}]));
  g.autonomy=createAI(false);g.queue=g.queue.map(q=>({...q,source:'manual'}));g.version=2;
 }
 if(g?.version===2){
  if(!g.player||!g.skills||!NPCS.every(n=>g.npcs?.[n.id]?.skills))throw new Error('旧人物存档格式不兼容');
  Object.assign(g.player,RESIDENTS.player);Object.assign(g.skills,{social:0,music:0});
  for(const n of NPCS){Object.assign(g.npcs[n.id],RESIDENTS[n.id]);Object.assign(g.npcs[n.id].skills,{social:0,music:0});}
  for(const q of [g.queue,...NPCS.map(n=>g.npcs[n.id].queue)].flat())if(q.phase==='walking'){q.path=null;if(g.objects.some(o=>o.id===q.targetId))q.target=destination(g,q.targetId);}
  g.version=3;
 }
 if(g?.version===3){
  if(!g.player||!NPCS.every(n=>g.npcs?.[n.id]))throw new Error('旧居民存档格式不兼容');
  Object.assign(g.player,identity({id:'kai',name:'凯伊',color:'#91dab9',trait:'好奇心旺盛 · 热爱生活'}, {gender:g.player.gender,age:g.player.age}),{preferences:{...PREFERENCES.player}});
  for(const n of NPCS)Object.assign(g.npcs[n.id],identity(n,{gender:g.npcs[n.id].gender,age:g.npcs[n.id].age}));
  g.incubations=[];g.memorials=[];g.version=4;
 }
 if(g?.version===4){
  for(const p of [g.player,...Object.values(g.npcs)])Object.assign(p,{genome:defaultGenome(),mutations:[]});
  g.incubations=g.incubations.map(b=>({id:b.id,podId:b.podId,due:b.due,parents:[{...b.parent,color:b.color,genome:defaultGenome(),preferences:{...PREFERENCES.player},familyDesire:.7}]}));
  for(const q of [g.queue,...Object.values(g.npcs).map(n=>n.queue)].flat())if(q.type==='incubate')q.partnerId=null;
  g.version=5;
 }
 if(g?.version===5){g.harvest={spores:0,mushrooms:0};for(const o of g.objects)if(CROPS[o.type])o.plant=createPlant();g.version=6;}
 if(g?.version===6){for(const p of [g.player,...Object.values(g.npcs),...g.incubations.flatMap(b=>b.parents)])Object.assign(p.genome,defaultHeadShape());g.version=7;}
 if(g?.version===7){for(const p of [g.player,...Object.values(g.npcs)])if(Object.keys(HEAD_SHAPE).every(k=>p.genome[k]===1))Object.assign(p.genome,residentHeadShape(p.uid));g.version=8;}
 if(g?.version===8){
  g.viewSide='front';g.player.side='front';g.skills.cooking=0;
  for(const n of Object.values(g.npcs)){n.side='front';n.skills.cooking=0;}
  for(const o of g.objects)o.side='front';
  for(const q of [g.queue,...Object.values(g.npcs).map(n=>n.queue)].flat()){q.target.side='front';q.path=null;}
  g.objects.push(...createGates());g.version=9;
 }
 if(g?.version===9){
  for(const p of [g.player,...Object.values(g.npcs)])p.prayer=createPrayerState();
  for(const q of [g.queue,...Object.values(g.npcs).map(n=>n.queue)].flat())if(q.type==='admire'&&g.objects.some(o=>o.id===q.targetId&&o.type==='spiritTree')){q.type='pray';q.phase='walking';q.elapsed=0;q.path=null;}
  g.version=10;
 }
 if(g?.version===10){
  g.wonders=createWonders();for(const o of g.objects)if(WONDER_OPTIONS[o.type])o.wonder=createWonder(o.type);
  for(const queue of [g.queue,...Object.values(g.npcs).map(n=>n.queue)])for(let i=queue.length-1;i>=0;i--)if(queue[i].type==='admire')queue.splice(i,1);
  for(const p of [g.player,...Object.values(g.npcs),...g.incubations.flatMap(b=>b.parents)])delete p.preferences.admire;
  for(const ai of [g.autonomy,...Object.values(g.npcs).map(n=>n.ai)])if(ai.lastAction==='admire'){ai.lastAction=null;ai.lastTarget=null;}
  if(g.config?.actionDurations)delete g.config.actionDurations.admire;
  g.version=11;
 }
 if(g?.version===11){
  Object.assign(g.wonders,{expeditions:0,cityRecords:[],coauthored:g.objects.some(o=>o.type==='relic'&&o.wonder.coauthored)});
  for(const o of g.objects)if(o.type==='crystal')o.wonder.retuneAfter=0;
  // Pending old tune actions meant activation of a fully charged crystal.
  for(const q of [g.queue,...Object.values(g.npcs).map(n=>n.queue)].flat())if(['tuneSleep','tuneInsight'].includes(q.type)){q.type='activateCrystal';q.phase='walking';q.elapsed=0;q.path=null;}
  g.version=12;
 }
 if(g?.version===12){g.civilization=createCivilization();g.viewIsland='home';g.version=13;}
 // Existing v10 prayer saves predate the independent front-side attribute.
 for(const p of [g.player,...Object.values(g.npcs||{})])if(p?.prayer&&p.prayer.radiance===undefined)p.prayer.radiance=0;
 for(const parent of (g.incubations||[]).flatMap(b=>b.parents||[]))if(!parent.prayer)parent.prayer=createPrayerState();else if(parent.prayer.radiance===undefined)parent.prayer.radiance=0;
 g.controlledId??='player';
 if(g.controlledId!=='player'&&g.npcs?.[g.controlledId]){g.player=g.npcs[g.controlledId];g.player.needs=g.needs;g.player.skills=g.skills;g.player.career=g.career;g.player.queue=g.queue;g.player.ai=g.autonomy;g.player.relationships=g.relationships;g.player.inventory??=g.harvest;g.player.money??=0;}
 for(const o of g.objects||[])if(o.type==='gate'&&o.fixed&&o.id.startsWith('island-gate-'))Object.assign(o,DEFAULT_GATE_POSITION);
 migrateResidentNames(g);
 g.config=normalizeConfig(g.config);
 for(const o of g.objects||[])if(CROPS[o.type]&&o.plant?.giant===undefined)o.plant.giant=false;
 if(g.majorEvents===undefined)g.majorEvents=[];
 for(const q of [g.queue,...Object.values(g.npcs||{}).map(n=>n.queue)].flat())if(seatedAction(q)&&q.seat===undefined){q.seat=null;q.phase='walking';q.path=null;}
 for(const [id,n] of Object.entries(g.npcs||{})){if(n.money===undefined)n.money=n.age>=18?600:0;n.inventory={...createInventory(),...(n.inventory||{})};if(!n.career)n.career=createCareer(id);}
 const validGenome=d=>d&&Object.keys(defaultGenome()).every(k=>range(d[k],.8,1.2));
 const validParents=p=>Array.isArray(p)&&p.length<=2&&p.every(n=>typeof n.uid==='string'&&typeof n.name==='string');
 const validNeeds=n=>Object.keys(NEEDS).every(k=>range(n?.[k],0,100));
 const validSkills=s=>Object.keys(SKILLS).every(k=>range(s?.[k],0,1e9));
 const validInventory=i=>i&&Object.values(CROPS).every(c=>Number.isSafeInteger(i[c.key])&&i[c.key]>=0);
 const validCareerState=state=>state&&CAREERS[state.id]&&Number.isInteger(state.level)&&state.level>=1&&state.level<=CAREERS[state.id].levels.length&&Number.isInteger(state.shifts)&&state.shifts>=0;
 const validMajorEvents=events=>Array.isArray(events)&&events.length<=3&&events.every(event=>event&&typeof event.type==='string'&&typeof event.text==='string'&&event.text.length<=200&&finite(event.at)&&Number.isInteger(event.day)&&event.day>0);
 const validResident=p=>p&&validPrayerState(p.prayer)&&Object.hasOwn(STAR_ISLANDS,islandOf(p))&&Object.hasOwn(SIDES,sideOf(p))&&Object.hasOwn(GENDERS,p.gender)&&range(p.age,0,120)&&validGenome(p.genome)&&Array.isArray(p.mutations)&&p.mutations.every(m=>typeof m==='string')&&range(p.familyDesire,0,1)&&(p.lastBirthDay===null||range(p.lastBirthDay,1,1e12))&&typeof p.alive==='boolean'&&typeof p.uid==='string'&&typeof p.name==='string'&&p.name.length<=40&&/^#[0-9a-f]{6}$/i.test(p.color)&&typeof p.trait==='string'&&range(p.starvation,0,1e12)&&validParents(p.parents)&&p.preferences&&Object.entries(p.preferences).every(([k,v])=>Object.hasOwn(ACTIONS,k)&&range(v,0,100));
 const validIncubationParent=p=>validGenome(p.genome)&&validPrayerState(p.prayer)&&/^#[0-9a-f]{6}$/i.test(p.color)&&range(p.familyDesire,0,1)&&p.preferences&&Object.entries(p.preferences).every(([k,v])=>Object.hasOwn(ACTIONS,k)&&range(v,0,100));
 const validAI=a=>a&&typeof a.enabled==='boolean'&&range(a.cooldown,0,60)&&typeof a.reason==='string'&&(a.lastAction===null||Object.hasOwn(ACTIONS,a.lastAction))&&(a.lastTarget===null||typeof a.lastTarget==='string')&&Number.isInteger(a.lastWorkDay)&&a.lastWorkDay>=0;
 const validQueue=q=>Array.isArray(q)&&q.length<=6&&q.every(a=>Object.hasOwn(ACTIONS,a.type)&&(!WONDER_ACTIONS[a.type]||(a.type==='memoryExpedition'?g.objects.some(o=>o.id===a.targetId&&o.type==='portal'):g.objects.some(o=>o.id===a.targetId&&WONDER_OPTIONS[o.type]?.includes(a.type))))&&(!WONDER_ACTIONS[a.type]?.paired||(a.hostId?typeof a.hostId==='string'&&Number.isInteger(a.hostActionId):typeof a.partnerId==='string'&&(a.partnerId==='player'||Object.hasOwn(g.npcs,a.partnerId))))&&(!seatedAction(a)||(a.seat===null||Number.isInteger(a.seat)&&a.seat>=0&&a.seat<SOFA_SEATS.length)&&g.objects?.some(o=>o.id===a.targetId&&o.type==='sofa'))&&(a.type!=='incubate'||a.partnerId===null||Object.hasOwn(g.npcs,a.partnerId))&&(a.type!=='travel'||typeof a.destinationId==='string'&&a.destinationId!==a.targetId&&g.objects.some(o=>o.id===a.destinationId&&o.type==='gate'))&&(!a.transit||range(a.transit.elapsed,0,1e9)&&a.path?.[0]?.gateId===a.transit.sourceId&&a.path[0].destinationId===a.transit.destinationId)&&(a.type!=='voyage'||Object.hasOwn(STAR_ISLANDS,a.destinationId)&&g.objects.some(o=>o.id===a.targetId&&o.type==='portal'))&&(a.blockedSeconds===undefined||range(a.blockedSeconds,0,1e9))&&point(a.target)&&Object.hasOwn(STAR_ISLANDS,islandOf(a.target))&&Object.hasOwn(SIDES,sideOf(a.target))&&Number.isInteger(a.id)&&['ai','manual'].includes(a.source)&&range(a.elapsed,0,1e9)&&(['walking','waiting','acting'].includes(a.phase)&&a.blessing===undefined||a.phase==='celebrating'&&a.type==='pray'&&range(a.elapsed,0,PRAYER_RULES.celebrationSeconds)&&validBlessing(a.blessing))&&(a.type!=='pray'||g.objects.some(o=>o.id===a.targetId&&o.type==='spiritTree'&&(a.phase!=='celebrating'||sideOf(o)===a.blessing.side)))&&(a.path===null||Array.isArray(a.path)&&a.path.every(point))&&(a.type==='walk'||Object.hasOwn(g.npcs,a.targetId)||g.objects?.some(o=>o.id===a.targetId)));
 const residentNpcCount=Object.keys(g.npcs||{}).length-Number(g.controlledId!=='player');
 const valid=g?.version===13&&validCivilization(g.civilization)&&Object.hasOwn(STAR_ISLANDS,g.viewIsland)&&validWonders(g.wonders)&&typeof g.controlledId==='string'&&['player',...Object.keys(g.npcs||{})].includes(g.controlledId)&&Object.hasOwn(SIDES,g.viewSide)&&validConfig(g.config)&&g.harvest&&Object.values(CROPS).every(c=>Number.isSafeInteger(g.harvest[c.key])&&g.harvest[c.key]>=0)&&validMajorEvents(g.majorEvents)&&point(g.player)&&validResident(g.player)&&validSkills(g.skills)&&range(g.money,0,1e12)&&Number.isInteger(g.day)&&g.day>0&&[0,1,3].includes(g.speed)
  &&validNeeds(g.needs)&&validAI(g.autonomy)&&g.npcs&&residentNpcCount<=12&&Object.entries(g.npcs).every(([id,n])=>id!=='player'&&(id===g.controlledId||range(g.relationships?.[id],0,100))&&point(n)&&validResident(n)&&n.alive&&range(n.money,0,1e12)&&validInventory(n.inventory)&&validNeeds(n.needs)&&validSkills(n.skills)&&validCareerState(n.career)&&validAI(n.ai)&&validQueue(n.queue)&&typeof n.activity==='string'&&Object.keys(g.npcs).filter(other=>other!==id).every(other=>range(n.relationships?.[other],0,100)))
  &&Array.isArray(g.incubations)&&g.incubations.length<=12&&g.incubations.every(b=>typeof b.id==='string'&&range(b.due,0,1e12)&&validParents(b.parents)&&b.parents.length>=1&&b.parents.every(validIncubationParent)&&g.objects.some(o=>o.id===b.podId&&o.type==='nursery'))&&new Set(g.incubations.map(b=>b.podId)).size===g.incubations.length
  &&Array.isArray(g.memorials)&&g.memorials.every(m=>typeof m.uid==='string'&&typeof m.name==='string'&&range(m.age,0,120)&&validParents(m.parents)&&['old_age','starvation'].includes(m.cause)&&range(m.day,1,1e12))
  &&new Set([g.player.uid,...Object.entries(g.npcs).filter(([id])=>id!==g.controlledId).map(([,n])=>n.uid)]).size===residentNpcCount+1
  &&(g.player.alive||g.queue.length===0)

  &&validCareerState(g.career)&&range(g.skills?.science,0,1e9)&&range(g.skills?.botany,0,1e9)
  &&Array.isArray(g.objects)&&g.objects.every(o=>point(o)&&Object.hasOwn(STAR_ISLANDS,islandOf(o))&&validWonder(o)&&Object.hasOwn(SIDES,sideOf(o))&&typeof o.id==='string'&&ITEMS.some(i=>i.id===o.type)&&finite(o.rotation)&&(!CROPS[o.type]||validPlant(o.plant)))&&new Set(g.objects.map(o=>o.id)).size===g.objects.length
  &&validQueue(g.queue)
  &&Array.isArray(g.log)&&g.log.every(l=>typeof l.text==='string'&&finite(l.at))&&Number.isInteger(g.nextId)&&range(g.nextId,1,1e12)&&Number.isInteger(g.completed);
 if(!valid)throw new Error('存档格式不兼容');
 g.majorEvents=g.majorEvents.filter(event=>event.type!=='mature');
 const occupied=allActors(g).map(a=>a.queue[0]).filter(q=>seatedAction(q)&&Number.isInteger(q.seat)).map(q=>`${q.targetId}:${q.seat}`);if(new Set(occupied).size!==occupied.length)throw new Error('沙发座位重复占用');return g;
}
