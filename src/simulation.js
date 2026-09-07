import {CROPS,createPlant,advancePlants,plantActionError,tendPlant,harvestPlant,validPlant} from './plants.js';
import {defaultGenome,inheritTraits,generateResidentName} from './genetics.js';
export {inheritTraits,generateResidentName};
import {RESIDENTS,GENDERS,SKILLS,approachPosition,skillProgress} from './characters.js';
export {skillProgress};
export const NEEDS={hunger:['营养','Utensils'],energy:['能量','Zap'],social:['社交','MessagesSquare'],fun:['乐趣','Sparkles'],hygiene:['洁净','Droplets'],comfort:['舒适','Armchair']};
export const NPCS=[{id:'nova',name:'诺瓦',role:'星际植物学家',trait:'热爱自然 · 温柔',color:'#edabbf',x:1,z:1},{id:'zig',name:'吉格',role:'量子工程师',trait:'天才 · 有点古怪',color:'#b4a0ef',x:5,z:-2},{id:'lumi',name:'露米',role:'银河外交官',trait:'外向 · 浪漫',color:'#f4c16d',x:-3,z:4},{id:'pip',name:'皮普',role:'星云音乐人',trait:'创意十足 · 贪玩',color:'#88cbdc',x:3,z:4}];
const NPC_WAGES={nova:160,zig:180,lumi:200,pip:160};
const GOVERNMENT_SUBSIDY=50;
export const CAREERS={scientist:{name:'量子科学',icon:'Atom',titles:['实验室助理','量子研究员','首席科学家'],wage:180,desc:'研究异常晶体，揭开宇宙的秘密。'},botanist:{name:'异星植物',icon:'Sprout',titles:['孢子培育员','异星植物学家','生态设计师'],wage:160,desc:'培育会发光的植物，让荒星长成家园。'},diplomat:{name:'银河外交',icon:'Orbit',titles:['星际联络员','银河大使','星盟议长'],wage:200,desc:'连接不同文明，让友谊跨越光年。'}};
export const ITEMS=[
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
 {id:'crystal',name:'极光晶簇',pack:'孢子花园',price:120,icon:'Gem',action:'admire',desc:'舒适 +30 · 乐趣 +15'},
 {id:'mushroom',name:'星伞蘑菇',pack:'孢子花园',price:190,icon:'TreePine',action:'garden',desc:'浇水养护 · 12 小时一熟 · 收获星伞菇'},
 {id:'lamp',name:'漂浮光球',pack:'孢子花园',price:90,icon:'Lamp',action:'admire',desc:'舒适 +30 · 乐趣 +15'}
];
export const ACTIONS={
 incubate:{name:'孕育星芽 · 300 星币',icon:'Sprout',duration:8,effects:{},manualOnly:true},
 care:{name:'喂养与照料幼体',icon:'Heart',duration:6,effects:{social:10}},
 walk:{name:'走到这里',icon:'Footprints',duration:0,effects:{}},
 eat:{name:'合成一份星际晚餐 · 10 星币',icon:'Utensils',duration:5,effects:{hunger:65},cost:10,costMessage:'星币不足，无法合成晚餐。'},sleep:{name:'进入星眠',icon:'Moon',duration:9,effects:{energy:65,comfort:20}},
 wash:{name:'离子净化',icon:'Droplets',duration:5,effects:{hygiene:70}},relax:{name:'坐下休息',icon:'Armchair',duration:5,effects:{comfort:55,energy:15}},
 research:{name:'研究量子晶体',icon:'Atom',duration:7,effects:{fun:15},skill:'science'},dance:{name:'随星云音乐起舞',icon:'Music2',duration:6,effects:{fun:55,social:10},skill:'music'},
 explore:{name:'星门探险',icon:'Orbit',duration:12,effects:{fun:30,energy:-12},money:80},observe:{name:'观测遥远星系',icon:'Telescope',duration:6,effects:{fun:35},skill:'science'},
 harvest:{name:'收获成熟植物',icon:'Sprout',duration:5,effects:{fun:15,hygiene:-5},skill:'botany'},replant:{name:'清理并补种',icon:'Flower2',duration:6,effects:{fun:10,hygiene:-8},skill:'botany'},
 garden:{name:'浇水养护',icon:'Sprout',duration:6,effects:{fun:25,hygiene:-8},skill:'botany'},admire:{name:'欣赏异星奇观',icon:'Sparkles',duration:4,effects:{comfort:30,fun:15}},
 chat:{name:'聊聊母星',icon:'MessagesSquare',duration:5,effects:{social:30},relation:15,skill:'social'},joke:{name:'讲一个地球笑话',icon:'Smile',duration:5,effects:{social:20,fun:25},relation:12,skill:'social'},
 gift:{name:'赠送星尘 · 30 星币',icon:'Gift',duration:4,effects:{social:25},relation:25,cost:30},flirt:{name:'分享心动频率',icon:'Heart',duration:6,effects:{social:35,fun:15},relation:20,minRelation:35},
 work:{name:'开始一个工作班次',icon:'BriefcaseBusiness',duration:16,effects:{energy:-18,hunger:-15},work:true}
};
const clamp=n=>Math.max(0,Math.min(100,n));
const DECAY={hunger:.18,energy:.12,social:.1,fun:.13,hygiene:.08,comfort:.07};
const PREFERENCES={player:{research:12,observe:12,garden:8,chat:8},nova:{garden:24,admire:10},zig:{research:24,observe:18},lumi:{chat:24,admire:8},pip:{dance:24,chat:8}};
const createAI=enabled=>({enabled,cooldown:0,lastAction:null,lastTarget:null,reason:'正在观察周围',lastWorkDay:0});
const createSkills=()=>Object.fromEntries(Object.keys(SKILLS).map(key=>[key,0]));
const createInventory=()=>Object.fromEntries(Object.values(CROPS).map(c=>[c.key,0]));
const startingMoney=id=>RESIDENTS[id]?.age>=18?600:0;
const placeholderName=/^星芽 \d+$/;
function migrateResidentNames(g){
 if(!g?.player||!g.npcs)return;
 const records=[g.player,...Object.values(g.npcs),...(Array.isArray(g.memorials)?g.memorials:[])].filter(person=>person&&typeof person.name==='string');
 const used=new Set(records.filter(person=>!placeholderName.test(person.name)).map(person=>person.name)),renamed=new Map();
 for(const person of records)if(placeholderName.test(person.name)){person.name=generateResidentName(person,[...used]);used.add(person.name);renamed.set(person.uid,person.name);}
 for(const person of records)for(const parent of person.parents||[])if(renamed.has(parent.uid))parent.name=renamed.get(parent.uid);
 for(const birth of g.incubations||[])for(const parent of birth.parents||[])if(renamed.has(parent.uid))parent.name=renamed.get(parent.uid);
}
const identity=(n,profile)=>({uid:n.id,name:n.name,color:n.color,trait:n.trait,...profile,alive:true,starvation:0,parents:[],genome:defaultGenome(),mutations:[],familyDesire:n.id==='zig'?.25:.7,lastBirthDay:null,preferences:{...PREFERENCES[n.id]}});
export const neighbors=g=>Object.entries(g.npcs).map(([id,n])=>({id,...n}));
const createNeighbor=n=>({x:n.x,z:n.z,...identity(n,RESIDENTS[n.id]),money:startingMoney(n.id),inventory:createInventory(),needs:{hunger:76,energy:85,social:78,fun:70,hygiene:82,comfort:78},skills:createSkills(),relationships:Object.fromEntries(NPCS.filter(other=>other.id!==n.id).map(other=>[other.id,0])),queue:[],ai:createAI(true),activity:'享受星湾的微风'});
export function createGame(){return {
 version:6,harvest:{spores:0,mushrooms:0},incubations:[],memorials:[],minute:510,day:1,speed:1,money:2400,player:{x:0,z:2,...identity({id:'kai',name:'凯伊',color:'#91dab9',trait:'好奇心旺盛 · 热爱生活'},RESIDENTS.player),preferences:{...PREFERENCES.player}},autonomy:createAI(false),
 npcs:Object.fromEntries(NPCS.map(n=>[n.id,createNeighbor(n)])),
 needs:{hunger:76,energy:88,social:62,fun:72,hygiene:85,comfort:79},relationships:{nova:15,zig:12,lumi:20,pip:8},
 career:{id:'scientist',level:1,shifts:0},skills:createSkills(),queue:[],nextId:1,
 objects:[{id:'pod',type:'pod',x:-5,z:-4,rotation:0},{id:'food',type:'food',x:1,z:-4,rotation:0},{id:'shower',type:'shower',x:-2,z:-4,rotation:0},{id:'sofa',type:'sofa',x:-5,z:0,rotation:0},{id:'lab',type:'lab',x:5,z:-4,rotation:0},{id:'music',type:'music',x:-2,z:0,rotation:0},{id:'garden',type:'garden',x:7,z:3,rotation:0,plant:createPlant()},{id:'portal',type:'portal',x:9,z:-4,rotation:0}],
 log:[{text:'欢迎回家，凯伊。你的异星日常，从这里开始。',at:510}],completed:0
};}
export function canPlace(g,x,z){return Number.isFinite(x)&&Number.isFinite(z)&&Math.abs(x)<=10&&Math.abs(z)<=6&&!g.objects.some(o=>Math.hypot(o.x-x,o.z-z)<1.8)&&!Object.values(g.npcs).some(n=>n.age<3&&Math.hypot(n.x-x,n.z-z)<1.1);}
export function buyItem(g,type,x,z,rotation=0){const item=ITEMS.find(i=>i.id===type);if(!item)return{ok:false,message:'未知物品'};if(g.money<item.price)return{ok:false,message:'星币不足，完成工作可赚取星币。'};if(!canPlace(g,x,z))return{ok:false,message:'这里没有足够的摆放空间。'};g.money-=item.price;const o={id:`${type}-${g.nextId++}`,type,x,z,rotation};if(CROPS[type])o.plant=createPlant();g.objects.push(o);return{ok:true,object:o};}
export function sellHarvest(g,key){
 const crop=Object.values(CROPS).find(c=>c.key===key);if(!crop||!g.harvest[key])return{ok:false,message:'仓库里还没有这类收成。'};
 const count=g.harvest[key],earned=count*crop.price;g.harvest[key]=0;g.money+=earned;const message=`出售 ${count} 份${crop.name}，获得 ${earned} 星币。`;g.log.unshift({text:message,at:g.minute});return{ok:true,message};
}
export function sellItem(g,id){if(g.incubations.some(b=>b.podId===id))return false;if(allActors(g).some(a=>a.queue.some(q=>q.targetId===id)))return false;const i=g.objects.findIndex(o=>o.id===id);if(i<0)return false;g.money+=Math.floor(ITEMS.find(x=>x.id===g.objects[i].type).price*.7);g.objects.splice(i,1);return true;}
export function setCareer(g,id){if(!g.player.alive||g.player.age<18||!CAREERS[id])return false;if(g.queue.some(a=>a.type==='work'))return false;g.career={id,level:1,shifts:0};return true;}
function destination(g,targetId,point){if(point)return point;const npc=g.npcs[targetId];if(npc)return{x:npc.x,z:npc.z+(npc.age<3?.65:1)};const o=g.objects.find(n=>n.id===targetId);return o?approachPosition(o):null;}
export function updateResident(g,id,{gender,age}){
 const person=id==='player'?g.player:g.npcs[id];
 if(!person||!person.alive||!Object.hasOwn(GENDERS,gender)||!Number.isInteger(age)||age<0||age>120)return{ok:false,message:'请选择有效性别，年龄需为 0–120 星岁。'};
 person.gender=gender;person.age=age;
 if(age<3)(id==='player'?g.queue:person.queue).length=0;
 if(id==='player'||g.queue.some(q=>q.targetId===id))g.queue=g.queue.filter(q=>q.type!=='flirt');
 return{ok:true};
}
export function enqueue(g,type,targetId,point,partnerId=null){
 if(!g.player.alive)return{ok:false,message:'这段生命已结束，请在生命页选择接管居民。'};
 if(g.player.age<3)return{ok:false,message:'幼体需要照料，3 星岁后开始自主活动。'};
 if(type==='work'&&g.player.age<18)return{ok:false,message:'成年居民才能开始工作。'};
 if(type==='incubate'){const error=birthError(g,g.player,targetId)||partnerError(g,'player',partnerId);if(error)return{ok:false,message:error};}
  if(type==='care'&&(!g.npcs[targetId]||g.npcs[targetId].age>=3||g.player.age<18))return{ok:false,message:'成年居民可以照料幼体。'};
  if(['chat','joke','gift','flirt'].includes(type)&&(!g.npcs[targetId]||g.npcs[targetId].age<3))return{ok:false,message:'请使用照料互动陪伴幼体。'};
  if(['garden','harvest','replant'].includes(type)){const error=plantActionError(g.objects.find(o=>o.id===targetId),type);if(error)return{ok:false,message:error};}
  const a=ACTIONS[type];if(!a||g.queue.filter(q=>q.source!=='ai').length>=6)return{ok:false,message:'行动队列已满。'};
  if(a.cost&&!canAfford(g,actor(g,'player'),a.cost))return{ok:false,message:a.costMessage||'星币不足，无法完成该行动。'};
 if(type==='flirt'&&(g.player.age<18||g.npcs[targetId]?.age<18))return{ok:false,message:'心动互动仅对成年居民开放。'};
 if(a.minRelation&&(g.relationships[targetId]??0)<a.minRelation)return{ok:false,message:'友好度达到 35 后，可以分享心动频率。'};
 const target=destination(g,targetId,point);if(!target)return{ok:false,message:'请先放置需要的物品。'};
 g.queue=g.queue.filter(q=>q.source!=='ai');const q=makeAction(g,type,targetId,target,'manual');if(type==='incubate')q.partnerId=partnerId;g.queue.push(q);
 if(g.autonomy){g.autonomy.cooldown=3;g.autonomy.reason='优先执行你的安排';}return{ok:true};
}
export function cancelAction(g,id){g.queue=g.queue.filter(a=>a.id!==id);g.autonomy.cooldown=5;g.autonomy.reason='稍作休息，再决定下一步';}
export function setAutonomy(g,enabled){g.autonomy.enabled=g.player.alive&&enabled;g.autonomy.cooldown=0;g.autonomy.reason=enabled?'正在观察需求和周围环境':'等待你的安排';if(!enabled)g.queue=g.queue.filter(q=>q.source!=='ai');}
function makeAction(g,type,targetId,target,source){return{id:g.nextId++,type,targetId,target,source,elapsed:0,phase:'walking',path:null};}
function actor(g,id){return id==='player'?{id,position:g.player,needs:g.needs,skills:g.skills,queue:g.queue,ai:g.autonomy}:{...g.npcs[id],id,position:g.npcs[id]};}
function allActors(g){return [...(g.player.alive?['player']:[]),...Object.keys(g.npcs)].map(id=>actor(g,id));}
function availableMoney(g,person){return person.id==='player'?g.money:person.position.money;}
function parentActors(g,person){const people=allActors(g),uids=new Set((person.position.parents||[]).map(parent=>parent.uid));return people.filter(parent=>uids.has(parent.position.uid));}
function expensePayers(g,person){const parents=person.position.age<18?parentActors(g,person):[];return parents.length?parents:[person];}
function canAfford(g,person,amount){const payers=expensePayers(g,person),share=amount/payers.length;return payers.every(payer=>availableMoney(g,payer)>=share);}
function changeMoney(g,person,amount){if(amount<0){const payers=expensePayers(g,person),share=amount/payers.length;for(const payer of payers){if(payer.id==='player')g.money+=share;else payer.position.money+=share;}return;}if(person.id==='player')g.money+=amount;else person.position.money+=amount;}
export function canAffordAction(g,id,type){const action=ACTIONS[type];return !!action&&(!action.cost||canAfford(g,actor(g,id),action.cost));}
function npcWage(id){return NPC_WAGES[id]||160;}
function conversationWith(g,id){return allActors(g).find(a=>a.id!==id&&a.queue[0]?.targetId===id&&ACTIONS[a.queue[0].type].relation);}
function findPath(g,start,end){
 const key=(x,z)=>`${x},${z}`,sx=Math.round(start.x),sz=Math.round(start.z),ex=Math.round(end.x),ez=Math.round(end.z);
 const nodes=[{x:sx,z:sz}],seen=new Map([[key(sx,sz),null]]);let found=false;
 for(let i=0;i<nodes.length;i++){const p=nodes[i];if(p.x===ex&&p.z===ez){found=true;break;}for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx,z=p.z+dz,k=key(x,z);if(Math.abs(x)>11||Math.abs(z)>7||seen.has(k)||g.objects.some(o=>Math.hypot(o.x-x,o.z-z)<.8))continue;seen.set(k,p);nodes.push({x,z});}}
 if(!found)return null;const path=[{x:ex,z:ez}];let prev=seen.get(key(ex,ez));while(prev){path.unshift(prev);prev=seen.get(key(prev.x,prev.z));}path.shift();path.push(end);return path;
}
function decide(g,person){
 const candidates=g.objects.filter(o=>!ACTIONS[ITEMS.find(i=>i.id===o.type).action].manualOnly).map(o=>({type:CROPS[o.type]?(o.plant.health<=0?'replant':o.plant.growth>=1?'harvest':'garden'):ITEMS.find(i=>i.id===o.type).action,targetId:o.id}));
 if(person.position.age>=18)for(const n of neighbors(g))if(n.age<3)candidates.push({type:'care',targetId:n.id});
 // Births share the household budget and must pass resource and caregiver checks.
 for(const n of neighbors(g))if(n.age>=3&&n.id!==person.id&&!g.npcs[n.id].queue.length&&!conversationWith(g,n.id))candidates.push({type:'chat',targetId:n.id});
 if(person.position.age>=18&&g.minute>=480&&g.minute<1080&&person.ai.lastWorkDay!==g.day&&Math.min(...Object.values(person.needs))>45){
  for(const o of g.objects)if(o.type==='lab')candidates.push({type:'work',targetId:o.id});
 }
 const fertility=birthDecision(g,person.id);if(fertility.ready)candidates.push({type:'incubate',targetId:fertility.podId,partnerId:fertility.partnerId});
 const active=allActors(g).flatMap(a=>a.queue.slice(0,1));
 const weights={hunger:1.8,energy:1.6,social:1.3,fun:1,hygiene:1.4,comfort:.8};
 let best=null;
  for(const candidate of candidates){
   if(active.some(q=>q.targetId===candidate.targetId))continue;
   const action=ACTIONS[candidate.type];if(action.cost&&!canAfford(g,person,action.cost))continue;const target=destination(g,candidate.targetId);
  let score=0,dominant=null,largest=0;
  for(const [need,effect]of Object.entries(action.effects)){
   const value=person.needs[need],deficit=(100-value)/100;
   const benefit=effect>0?Math.min(effect,100-value)*deficit*deficit*weights[need]*(value<25?3:1):effect*(value<40?3:.25);
   score+=benefit;if(benefit>largest){largest=benefit;dominant=need;}
  }
  const preference=candidate.type==='chat'&&person.needs.social>=75?0:(person.position.preferences[candidate.type]||0);
  score+=preference;if(['garden','harvest','replant'].includes(candidate.type)){const p=g.objects.find(o=>o.id===candidate.targetId).plant;if(candidate.type==='garden'){if(p.water>=90&&p.health>=90)continue;score+=p.water<25?65:(100-p.health)*.4;}if(candidate.type==='harvest')score+=55+(person.position.preferences.garden||0);if(candidate.type==='replant')score+=35+(person.position.preferences.garden||0);}
  if(candidate.type==='incubate')score+=25+person.position.familyDesire*30;if(candidate.type==='care'){const baby=g.npcs[candidate.targetId];score+=(100-baby.needs.hunger)*2+(baby.starvation>0?300:0);if(baby.needs.hunger>70)continue;}if(candidate.type==='work')score+=availableMoney(g,person)<500?55:28;
  score-=Math.hypot(person.position.x-target.x,person.position.z-target.z)*.35;
  if(person.ai.lastAction===candidate.type)score-=14;
  if(score<8||best&&score<=best.score)continue;
  const path=findPath(g,person.position,target);if(!path)continue;
  const reason=candidate.type==='harvest'?'植物成熟了，先把收成带回家':candidate.type==='replant'?'清理枯萎植物，重新播种':candidate.type==='garden'?'给植物补水，让它健康生长':candidate.type==='incubate'?'生活稳定、照料人手充足，想迎接新的家人':candidate.type==='care'?'幼体需要喂养，先照料小居民':candidate.type==='work'?'状态良好，工作赚取星币':largest>preference&&dominant?`${NEEDS[dominant][0]}需要补充`:'想做一件自己喜欢的事';
  best={...candidate,target,path,score,reason};
 }
 if(!best){person.ai.reason='暂时没有合适的行动，休息观察';person.ai.cooldown=3;return;}
 const q=makeAction(g,best.type,best.targetId,best.target,'ai');q.path=best.path;if(best.type==='incubate')q.partnerId=best.partnerId;
 person.queue.push(q);person.ai.reason=best.reason;
}

function finishAction(g,person,q){
 const action=ACTIONS[q.type],isPlayer=person.id==='player';
 let cropMessage=null;
 if(['garden','harvest','replant'].includes(q.type)){const o=g.objects.find(o=>o.id===q.targetId),error=plantActionError(o,q.type);if(error){person.queue.shift();person.ai.cooldown=3;if(isPlayer)g.log.unshift({text:error,at:g.minute});return;}if(q.type==='garden')tendPlant(o);if(q.type==='replant')o.plant={...createPlant(),growth:0,harvests:o.plant.harvests};if(q.type==='harvest'){const crop=CROPS[o.type],amount=harvestPlant(o),inventory=isPlayer?g.harvest:person.position.inventory;inventory[crop.key]+=amount;cropMessage=`${person.position.name}收获了 ${amount} 份${crop.name}，已放入${isPlayer?'收成仓库':'个人物品包'}。`;g.log.unshift({text:cropMessage,at:g.minute});}}
 if(action.cost&&!canAfford(g,person,action.cost)){person.queue.shift();g.log.unshift({text:action.costMessage||'星币不足，礼物没有送出。',at:g.minute});return;}
 for(const [need,effect]of Object.entries(action.effects))person.needs[need]=clamp(person.needs[need]+effect);
 if(action.skill)person.skills[action.skill]++;
 if(q.type==='incubate'){const decision=q.source==='ai'?birthDecision(g,person.id):null;const error=decision&&!decision.ready?decision.reason:birthError(g,person.position,q.targetId)||partnerError(g,person.id,q.partnerId,q.source==='ai');if(error){person.queue.shift();g.log.unshift({text:error,at:g.minute});return;}g.money-=300;const parents=[person.position,...(q.partnerId?[g.npcs[q.partnerId]]:[])];for(const parent of parents)parent.lastBirthDay=g.day;g.log.unshift({text:`${person.position.name}${q.source==='ai'?'自主决定':'决定'}孕育星芽，育生舱将在 3 天后迎来新生命。`,at:g.minute});g.incubations.push({id:`egg-${g.nextId++}`,podId:q.targetId,due:gameMinutes(g)+4320,parents:parents.map(p=>({uid:p.uid,name:p.name,color:p.color,genome:{...p.genome},preferences:{...p.preferences},familyDesire:p.familyDesire}))});}
 if(q.type==='care'){const baby=g.npcs[q.targetId];if(baby){for(const key in baby.needs)baby.needs[key]=clamp(baby.needs[key]+85);baby.starvation=0;}}
 if(action.relation){
  const other=g.npcs[q.targetId];other.needs.social=clamp(other.needs.social+15);
  if(isPlayer)g.relationships[q.targetId]=clamp(g.relationships[q.targetId]+action.relation);
  else{person.relationships[q.targetId]=clamp(person.relationships[q.targetId]+action.relation);other.relationships[person.id]=clamp(other.relationships[person.id]+action.relation);}
 }
  if(action.cost)changeMoney(g,person,-action.cost);if(action.money)changeMoney(g,person,action.money);
  let text=q.type==='incubate'||cropMessage?g.log[0].text:`完成：${action.name}`;
  if(action.work){
   const wage=isPlayer?CAREERS[g.career.id].wage*g.career.level:npcWage(person.id);changeMoney(g,person,wage);person.ai.lastWorkDay=g.day;
   if(isPlayer){
    const c=CAREERS[g.career.id];g.career.shifts++;text=`工作完成，获得 ${wage} 星币。`;
    if(g.career.shifts>=3&&g.career.level<3){g.career.level++;g.career.shifts=0;text+=` 晋升为${c.titles[g.career.level-1]}！`;}
   }
  }
  if(isPlayer){
   g.completed++;if(q.type!=='incubate'&&!cropMessage)g.log.unshift({text,at:g.minute});g.log=g.log.slice(0,20);
  }
 person.ai.lastAction=q.type;person.ai.lastTarget=q.targetId;person.ai.cooldown=4;person.ai.reason='刚刚完成行动，稍作休息';person.queue.shift();
}

function advanceAction(g,person,dt){
 const q=person.queue[0];if(!q)return;
 if(q.type!=='walk'&&!destination(g,q.targetId)){person.queue.shift();person.ai.cooldown=3;person.ai.reason='目标已不存在，重新观察';return;}
 if(q.phase==='walking'){
  if(!q.path){if(g.npcs[q.targetId])q.target=destination(g,q.targetId);q.path=findPath(g,person.position,q.target);}
  if(!q.path){person.queue.shift();person.ai.cooldown=3;person.ai.reason='通路被挡住了';if(person.id==='player')g.log.unshift({text:'那里被挡住了，请在建造模式中留出通路。',at:g.minute});return;}
  const speed=person.id==='player'?2.8:1.7;let distance=dt*speed;
  while(q.path.length&&distance>0){const p=q.path[0],dx=p.x-person.position.x,dz=p.z-person.position.z,d=Math.hypot(dx,dz);if(d<=distance){person.position.x=p.x;person.position.z=p.z;q.path.shift();distance-=d;}else{person.position.x+=dx/d*distance;person.position.z+=dz/d*distance;distance=0;}}
  if(q.path.length)return;q.phase='waiting';dt=distance/speed;
 }
 const reserved=allActors(g).some(a=>a.id!==person.id&&a.queue[0]?.targetId===q.targetId&&a.queue[0].id<q.id);
 if(q.type!=='walk'&&reserved){q.phase='waiting';return;}
 q.phase='acting';q.elapsed+=dt;if(q.elapsed>=ACTIONS[q.type].duration)finishAction(g,person,q);
}

export function tick(g,seconds){
 if(!g.speed)return;const dt=seconds*g.speed;g.minute+=dt*2;while(g.minute>=1440){g.minute-=1440;g.day++;payGovernmentSubsidy(g);}
 advancePlants(g.objects,dt*2);
 // Direct conversations take precedence over a neighbor's autonomous plan.
 const manual=g.queue[0];
 if(manual?.source==='manual'&&ACTIONS[manual.type].relation){
  for(const [id,n]of Object.entries(g.npcs))if(id===manual.targetId||n.queue[0]?.targetId===manual.targetId){n.queue.length=0;n.ai.cooldown=3;}
 }
 for(const person of allActors(g)){
  if(person.id!=='player'&&!g.npcs[person.id])continue;
  person.position.age=Math.min(120,person.position.age+dt*2/(1440*8));
  const hungerBefore=person.needs.hunger;
  for(const key in DECAY)person.needs[key]=clamp(person.needs[key]-dt*DECAY[key]*(person.position.age<3?.15:1));
  const zeroMinutes=Math.max(0,dt-hungerBefore/(DECAY.hunger*(person.position.age<3?.15:1)))*2;
  if(advanceLife(g,person,zeroMinutes))continue;
  if(person.position.age<3){person.queue.length=0;if(person.id!=='player')person.position.activity='在摇篮中休息 · 等待照料';continue;}
  const partner=conversationWith(g,person.id);
  if(partner){if(person.id!=='player')person.position.activity=partner.id==='player'?`和${g.player.name}交谈`:`和${g.npcs[partner.id].name}交谈`;continue;}
  person.ai.cooldown=Math.max(0,person.ai.cooldown-dt);
  if(person.ai.enabled&&!person.queue.length&&person.ai.cooldown===0)decide(g,person);
  advanceAction(g,person,dt);
  if(person.id!=='player'){const q=person.queue[0];person.position.activity=q?`${q.phase==='walking'?'前往 · ':q.phase==='waiting'?'等候 · ':''}${ACTIONS[q.type].name}`:'享受星湾的微风';}
 }
 hatchReady(g);
}
function payGovernmentSubsidy(g){
 for(const person of allActors(g)){const age=person.position.age;if(age>=60||(age<18&&!parentActors(g,person).length))changeMoney(g,person,GOVERNMENT_SUBSIDY);}
}
export const gameMinutes=g=>(g.day-1)*1440+g.minute;
export function birthDecision(g,id){
 const p=id==='player'?g.player:g.npcs[id],needs=id==='player'?g.needs:p?.needs;
 const no=reason=>({ready:false,reason});
 if(!p?.alive)return no('生命已结束');
 if(p.age<18||p.age>=90)return no('18–89 星岁的成年居民会考虑生育');
 if(p.familyDesire<.4)return no('目前没有生育意愿');
 if(g.incubations.some(b=>b.parents.some(parent=>parent.uid===p.uid)))return no('正在等待自己的星芽出生');
 if(p.lastBirthDay!==null&&g.day-p.lastBirthDay<30)return no(`先陪伴家人，${30-(g.day-p.lastBirthDay)} 天后再考虑`);
 const people=[...(g.player.alive?[g.player]:[]),...Object.values(g.npcs)];
 const children=childCount(g,p.uid);
 if(children>=2)return no('已有两位子女，希望把时间留给家人');
 if(Math.min(...Object.values(needs))<65)return no('先照顾好自己的需求，再考虑生育');
 if(g.money<900)return no('需要 900 星币，孕育后保留 600 星币生活储备');
 if(!g.objects.some(o=>o.type==='food'))return no('家园需要营养合成器');
 if(people.length+g.incubations.length>=8)return no('星湾居民已较多，暂缓自主生育');
 const carers=allActors(g).filter(a=>a.position.age>=18&&a.position.age<110&&Math.min(...Object.values(a.needs))>=45&&a.ai.enabled).length;
 const dependents=people.filter(n=>n.age<3).length+g.incubations.length;
 if(carers<2||dependents>=Math.min(2,carers-1))return no('需要至少两位状态良好的自主成年居民，并留出照料人手');
 if(people.some(n=>n.age<3&&(n===g.player?g.needs:n.needs).hunger<60))return no('先把现有幼体照料好');
 const pod=g.objects.find(o=>o.type==='nursery'&&!g.incubations.some(b=>b.podId===o.id));
 if(!pod)return no('需要一座空闲的星芽育生舱');
 const partner=neighbors(g).filter(n=>n.id!==id&&!partnerError(g,id,n.id,true)).sort((a,b)=>relationTo(g,id,b.id)-relationTo(g,id,a.id))[0];
 return{ready:true,podId:pod.id,partnerId:partner?.id||null,reason:'愿意迎接家人，资金、需求与照料条件都已具备'};
}
const relationTo=(g,id,other)=>id==='player'?g.relationships[other]:g.npcs[id].relationships[other];
const childCount=(g,uid)=>[...allActors(g).map(a=>a.position),...g.memorials].filter(n=>n.parents.some(p=>p.uid===uid)).length;
function partnerError(g,id,partnerId,autonomous=false){
 if(partnerId===null)return null;
 const p=id==='player'?g.player:g.npcs[id],other=g.npcs[partnerId];
 if(!other||other===p||other.age<18||other.age>=90||other.familyDesire<.4||relationTo(g,id,partnerId)<35)return '共同亲代需要成年、有生育意愿，并达到 35 友好度。';
 if(p.parents.some(n=>n.uid===other.uid)||other.parents.some(n=>n.uid===p.uid)||p.parents.some(n=>other.parents.some(o=>o.uid===n.uid)))return '近亲居民不能共同孕育。';
 if(other.lastBirthDay!==null&&g.day-other.lastBirthDay<30||g.incubations.some(b=>b.parents.some(n=>n.uid===other.uid)))return '共同亲代正在孕育或陪伴新生家人，请稍后再考虑。';
 if(autonomous&&childCount(g,other.uid)>=2)return '共同亲代已有两位子女，希望把时间留给家人。';
 if(Math.min(...Object.values(other.needs))<(autonomous?65:45))return '共同亲代需要先照顾好自己。';
 return null;
}
function birthError(g,parent,podId){
 if(!parent.alive||parent.age<18)return '成年居民才能孕育星芽。';
 if(!g.objects.some(o=>o.id===podId&&o.type==='nursery'))return '请先摆放星芽育生舱。';
 if(g.incubations.some(b=>b.podId===podId))return '育生舱正在孕育，出生后才能再次使用。';
 if(Object.keys(g.npcs).length+Number(g.player.alive)+g.incubations.length>=12)return '星湾最多容纳 12 位居民，请暂缓孕育。';
 if(g.money<300)return '孕育需要 300 星币。';
 return null;
}
function advanceLife(g,person,zeroMinutes){
 const p=person.position,before=p.starvation;p.starvation=person.needs.hunger<=0?p.starvation+zeroMinutes:0;
 if(before<720&&p.starvation>=720)g.log.unshift({text:`${p.name}持续饥饿，请尽快${p.age<3?'安排照料':'进食'}！再持续 12 小时将有生命危险。`,at:g.minute});
 const cause=p.age>=120?'old_age':p.starvation>=1440?'starvation':null;if(!cause)return false;
 p.alive=false;person.queue.length=0;person.ai.enabled=false;
 g.memorials.unshift({uid:p.uid,name:p.name,age:p.age,day:g.day,cause,parents:p.parents});
 g.log.unshift({text:`${p.name}${cause==='old_age'?'走完了漫长的一生':'因长期饥饿离世'}。星湾会记得这位居民。`,at:g.minute});
 if(person.id==='player')g.speed=0;else{delete g.npcs[person.id];delete g.relationships[person.id];}
 for(const other of allActors(g)){const queue=other.queue;for(let i=queue.length-1;i>=0;i--)if(queue[i].targetId===person.id||queue[i].partnerId===person.id)queue.splice(i,1);if(other.id!=='player')delete other.relationships[person.id];}
 return true;
}
function hatchReady(g){
 for(const birth of [...g.incubations]){
  if(gameMinutes(g)<birth.due)continue;
  const pod=g.objects.find(o=>o.id===birth.podId);
  const spot=[[2,0],[-2,0],[0,2],[0,-2],[2,2],[-2,2],[2,-2],[-2,-2]].map(([x,z])=>({x:pod.x+x,z:pod.z+z})).find(p=>canPlace(g,p.x,p.z)&&allActors(g).every(a=>Math.hypot(a.position.x-p.x,a.position.z-p.z)>.9));
  if(!spot)continue;
  const serial=g.nextId++,id=`resident-${serial}`;
  const inherited=inheritTraits(birth.parents);
  const usedNames=[g.player,...Object.values(g.npcs),...g.memorials].map(person=>person.name);
  const n={id,name:generateResidentName({uid:id,preferences:inherited.preferences},usedNames),color:inherited.color,trait:'星湾新生 · 喜爱陪伴',x:spot.x,z:spot.z};
  const baby=createNeighbor(n);Object.assign(baby,{uid:id,name:n.name,...inherited,gender:['male','female','nonbinary'][serial%3],age:0,money:0,inventory:createInventory(),parents:birth.parents.map(p=>({uid:p.uid,name:p.name})),activity:'在摇篮中休息 · 等待照料'});
  baby.relationships=Object.fromEntries(Object.keys(g.npcs).map(id=>[id,10]));
  for(const other of Object.values(g.npcs))other.relationships[id]=10;
  g.npcs[id]=baby;g.relationships[id]=birth.parents.some(p=>p.uid===g.player.uid)?60:10;
  g.incubations.splice(g.incubations.indexOf(birth),1);
  g.log.unshift({text:`${n.name}出生了！${birth.parents.map(p=>p.name).join('与')}的星芽成为星湾的新居民，请照料这位幼体。${baby.mutations.length?' 本次出现了'+baby.mutations.join('、')+'。':''}`,at:g.minute});
 }
}
export function takeOver(g,id){
 const n=g.npcs[id];if(g.player.alive||!n||n.age<3)return{ok:false,message:'主控居民离世后，可接管 3 星岁以上的居民。'};
 const {needs,skills,relationships,queue,ai,activity,money,inventory,...profile}=n;
 g.money+=money;for(const key of Object.keys(g.harvest))g.harvest[key]+=inventory[key];
 g.player=profile;g.needs=needs;g.skills=skills;g.relationships={...relationships};delete g.relationships[id];g.queue=[];g.autonomy={...ai,enabled:false,cooldown:0,reason:'等待你的安排'};g.career={id:'scientist',level:1,shifts:0};
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
 migrateResidentNames(g);
 for(const n of Object.values(g.npcs||{})){if(n.money===undefined)n.money=n.age>=18?600:0;n.inventory={...createInventory(),...(n.inventory||{})};}
 const validGenome=d=>d&&Object.keys(defaultGenome()).every(k=>range(d[k],.8,1.2));
 const validParents=p=>Array.isArray(p)&&p.length<=2&&p.every(n=>typeof n.uid==='string'&&typeof n.name==='string');
 const validNeeds=n=>Object.keys(NEEDS).every(k=>range(n?.[k],0,100));
 const validSkills=s=>Object.keys(SKILLS).every(k=>range(s?.[k],0,1e9));
 const validInventory=i=>i&&Object.values(CROPS).every(c=>Number.isSafeInteger(i[c.key])&&i[c.key]>=0);
 const validResident=p=>p&&Object.hasOwn(GENDERS,p.gender)&&range(p.age,0,120)&&validGenome(p.genome)&&Array.isArray(p.mutations)&&p.mutations.every(m=>typeof m==='string')&&range(p.familyDesire,0,1)&&(p.lastBirthDay===null||range(p.lastBirthDay,1,1e12))&&typeof p.alive==='boolean'&&typeof p.uid==='string'&&typeof p.name==='string'&&p.name.length<=40&&/^#[0-9a-f]{6}$/i.test(p.color)&&typeof p.trait==='string'&&range(p.starvation,0,1e12)&&validParents(p.parents)&&p.preferences&&Object.entries(p.preferences).every(([k,v])=>Object.hasOwn(ACTIONS,k)&&range(v,0,100));
 const validAI=a=>a&&typeof a.enabled==='boolean'&&range(a.cooldown,0,60)&&typeof a.reason==='string'&&(a.lastAction===null||Object.hasOwn(ACTIONS,a.lastAction))&&(a.lastTarget===null||typeof a.lastTarget==='string')&&Number.isInteger(a.lastWorkDay)&&a.lastWorkDay>=0;
 const validQueue=q=>Array.isArray(q)&&q.length<=6&&q.every(a=>Object.hasOwn(ACTIONS,a.type)&&(a.type!=='incubate'||a.partnerId===null||Object.hasOwn(g.npcs,a.partnerId))&&point(a.target)&&Number.isInteger(a.id)&&['ai','manual'].includes(a.source)&&range(a.elapsed,0,1e9)&&['walking','waiting','acting'].includes(a.phase)&&(a.path===null||Array.isArray(a.path)&&a.path.every(point))&&(a.type==='walk'||Object.hasOwn(g.npcs,a.targetId)||g.objects?.some(o=>o.id===a.targetId)));
 const valid=g?.version===6&&g.harvest&&Object.values(CROPS).every(c=>Number.isSafeInteger(g.harvest[c.key])&&g.harvest[c.key]>=0)&&point(g.player)&&validResident(g.player)&&validSkills(g.skills)&&range(g.money,0,1e12)&&range(g.minute,0,1440)&&Number.isInteger(g.day)&&g.day>0&&[0,1,3].includes(g.speed)
  &&validNeeds(g.needs)&&validAI(g.autonomy)&&g.npcs&&Object.keys(g.npcs).length<=12&&Object.entries(g.npcs).every(([id,n])=>id!=='player'&&range(g.relationships?.[id],0,100)&&point(n)&&validResident(n)&&n.alive&&range(n.money,0,1e12)&&validInventory(n.inventory)&&validNeeds(n.needs)&&validSkills(n.skills)&&validAI(n.ai)&&validQueue(n.queue)&&typeof n.activity==='string'&&Object.keys(g.npcs).filter(other=>other!==id).every(other=>range(n.relationships?.[other],0,100)))
  &&Array.isArray(g.incubations)&&g.incubations.length<=12&&g.incubations.every(b=>typeof b.id==='string'&&range(b.due,0,1e12)&&validParents(b.parents)&&b.parents.length>=1&&b.parents.every(p=>validGenome(p.genome)&&/^#[0-9a-f]{6}$/i.test(p.color)&&range(p.familyDesire,0,1)&&p.preferences&&Object.entries(p.preferences).every(([k,v])=>Object.hasOwn(ACTIONS,k)&&range(v,0,100)))&&g.objects.some(o=>o.id===b.podId&&o.type==='nursery'))&&new Set(g.incubations.map(b=>b.podId)).size===g.incubations.length
  &&Array.isArray(g.memorials)&&g.memorials.every(m=>typeof m.uid==='string'&&typeof m.name==='string'&&range(m.age,0,120)&&validParents(m.parents)&&['old_age','starvation'].includes(m.cause)&&range(m.day,1,1e12))
  &&new Set([g.player.uid,...Object.values(g.npcs).map(n=>n.uid)]).size===Object.keys(g.npcs).length+1
  &&(g.player.alive||g.queue.length===0)

  &&CAREERS[g.career?.id]&&range(g.career.level,1,3)&&Number.isInteger(g.career.shifts)&&g.career.shifts>=0&&range(g.skills?.science,0,1e9)&&range(g.skills?.botany,0,1e9)
  &&Array.isArray(g.objects)&&g.objects.every(o=>point(o)&&typeof o.id==='string'&&ITEMS.some(i=>i.id===o.type)&&finite(o.rotation)&&(!CROPS[o.type]||validPlant(o.plant)))&&new Set(g.objects.map(o=>o.id)).size===g.objects.length
  &&validQueue(g.queue)
  &&Array.isArray(g.log)&&g.log.every(l=>typeof l.text==='string'&&finite(l.at))&&Number.isInteger(g.nextId)&&range(g.nextId,1,1e12)&&Number.isInteger(g.completed);
 if(!valid)throw new Error('存档格式不兼容');return g;
}
