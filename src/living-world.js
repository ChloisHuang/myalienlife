import {islandOf,sideOf,sameSide} from './island.js';
import {isRadiant,isNether,isDual} from './prayer.js';
import {livingMinutes,livingResident,livingSite,mutableResident,mutableSite,bondTo,changeBond,bounded,pruneLiving,supportedIsland,LIVING_LIMITS} from './living-state.js';
import {practiceToday,adapt,fadeAdaptation,awaken} from './living-adaptation.js';

export const LIVING_ACTIONS={
 tendTree:{name:'照料圣树根系',icon:'TreePine',duration:16,effects:{fun:12,energy:-6,hygiene:-4},skill:'botany'},
 shareLight:{name:'展开曦轮安抚',icon:'Sun',duration:14,effects:{social:8,energy:-8}},
 accompany:{name:'陪伴同行',icon:'Footprints',duration:20,effects:{social:12,energy:-3}},
 confront:{name:'表达不满',icon:'MessageCircleWarning',duration:10,effects:{social:5,comfort:-3}},
 reconcile:{name:'道歉与修复',icon:'Handshake',duration:12,effects:{social:12}},
 listenForest:{name:'让影子归位',icon:'Moon',duration:14,effects:{comfort:8,energy:-3}}
};
export const LIVING_SOCIAL=new Set(['shareLight','accompany','confront','reconcile']);
export const livingConversation=type=>LIVING_SOCIAL.has(type)&&type!=='accompany';
export function validLivingQueue(g,q){
 if(!Object.hasOwn(LIVING_ACTIONS,q.type))return true;
 const o=g.objects.find(o=>o.id===q.targetId),other=q.targetId==='player'?g.player:g.npcs[q.targetId];
 if(LIVING_SOCIAL.has(q.type))return !!other?.alive;
 return q.type==='tendTree'?o?.type==='spiritTree'&&supportedIsland(o):o?.type==='gate'&&inForest(o);
}
export const inForest=p=>islandOf(p)==='spore'&&sideOf(p)==='back';
const nearby=(a,b,r)=>sameSide(a,b)&&Math.hypot(a.x-b.x,a.z-b.z)<=r;
export const lightActive=(g,p)=>isRadiant(p)&&(!isDual(p)||livingResident(g,p).mode==='light');
export const shadowActive=(g,p)=>isNether(p)&&(!isDual(p)||livingResident(g,p).mode==='shadow');
export const bondWeight=(g,a,b)=>{const r=bondTo(g,a,b);return r?r.trust*.4+r.dependence*.2-r.resentment*.7:0;};
export function relationLabel(g,a,b){
 const r=bondTo(g,a,b);if(!r)return '尚无共同经历';
 if(r.resentment>=20)return r.dependence>=15?'依赖却有怨气':r.trust>=20?'亲近但有隔阂':'关系紧张';
 return r.dependence>=15?'信赖的依靠':r.trust>=20?'熟悉的同伴':'逐渐熟悉';
}
export function livingOptions(g,o){
 if(!supportedIsland(o))return [];
 return [...(o.type==='spiritTree'?['tendTree']:[]),...(inForest(o)&&o.type==='gate'?['listenForest']:[])];
}
export function livingError(g,type,p,o,other){
 if(type==='pray'&&o?.type==='spiritTree'&&supportedIsland(o)&&livingSite(g,o).vitality<12)return '圣树垂光暗淡，先照料根系或等待恢复。';
 if(!Object.hasOwn(LIVING_ACTIONS,type))return null;
 if(!supportedIsland(p))return '这项互动属于露米纳星湾与童梦星屿。';
 if(type==='tendTree')return o?.type==='spiritTree'&&supportedIsland(o)?null:'请选择圣树照料根系。';
 if(type==='listenForest')return o?.type==='gate'&&inForest(o)&&inForest(p)?null:'请在童梦背面的折跃门旁让影子归位。';
 if(!other||!other.alive||p.uid===other.uid||!sameSide(p,other))return '请选择同岛面的一位居民。';
 if(other.age<g.config.lifeStages.infantEnd)return '幼体请使用照料互动。';
 if(type==='shareLight'&&!isRadiant(p))return '曦灵族或两仪族才能展开曦轮。';
 if(type==='confront'&&(bondTo(g,p,other)?.resentment??0)<15)return '目前没有需要表达的不满。';
 if(type==='reconcile'&&(bondTo(g,other,p)?.resentment??0)<10)return '对方目前没有需要修复的隔阂。';
 return null;
}

export function finishLiving(g,person,q,o,people,before={}){
 const p=person.position,other=people.find(a=>a.id===q.targetId),state=()=>mutableResident(g,p);
 if(!supportedIsland(p))return;
 if(['harvest','extractMaterials','replant'].includes(q.type)&&o&&g.living.sites[o.id])g.living.sites[o.id].rescue=null;
 const witnesses=people.filter(a=>a!==person&&nearby(p,a.position,5)).map(a=>a.position);
 if(q.type==='tendTree'){
  const site=mutableSite(g,o);
  if(site.vitality<25&&site.rescue===null&&site.keeper!==p.uid)site.rescue=p.uid;
  site.vitality=bounded(site.vitality+28);site.keeper=p.uid;practiceToday(g,p,'tree');
  if(site.vitality>=80&&site.rescue!==null){if(site.rescue===p.uid)awaken(g,p,'roots',witnesses);site.rescue=null;}
  for(const a of people)if(a!==person&&nearby(p,a.position,5))changeBond(g,a.position,p,{trust:3});
 }
 if(q.type==='pray'&&supportedIsland(o)){
  const site=mutableSite(g,o),low=site.vitality<45;site.vitality=bounded(site.vitality-12);
  if(low)for(const a of people)if(a.position.uid===site.keeper&&a!==person&&nearby(p,a.position,6))changeBond(g,a.position,p,{resentment:12});
 }
 if(q.type==='garden'&&islandOf(o)==='spore'&&sideOf(o)==='front'){
  const s=state(),site=mutableSite(g,o);
  if(before.health>0&&before.health<=25&&site.rescue===null&&site.keeper!==p.uid)site.rescue=p.uid;
  if(practiceToday(g,p,'garden'))adapt(g,p,'garden');s.charge=bounded(s.charge+24);site.keeper=p.uid;
  if(o.plant.health>=70&&site.rescue!==null){if(site.rescue===p.uid)awaken(g,p,'bloom',witnesses);site.rescue=null;}
 }
 if(q.type==='listenForest'){const s=state();s.fear=bounded(s.fear-30);if(practiceToday(g,p,'shadow'))adapt(g,p,'shadow');}
 if(q.type==='lounge')for(const a of people)if(a!==person&&a.queue[0]?.type==='lounge'&&a.queue[0]?.phase==='acting'&&a.queue[0]?.targetId===q.targetId){changeBond(g,p,a.position,{trust:4});changeBond(g,a.position,p,{trust:4});}
 if(!other)return;
 const b=other.position;
 if(['chat','joke','gift','flirt','care'].includes(q.type)){changeBond(g,p,b,{trust:3});changeBond(g,b,p,{trust:q.type==='care'?6:3});}
 if(q.type==='shareLight'||q.type==='accompany'){
  const own=state(),rescue=inForest(p)&&livingResident(g,b).fear>=60&&own.fear<=20&&(bondTo(g,p,b)?.trust??0)>=20;
  const s=mutableResident(g,b);s.fear=bounded(s.fear-(q.type==='shareLight'?35:18));other.needs.comfort=Math.min(100,other.needs.comfort+12);
  if(rescue&&awaken(g,p,'shade',[b]))person.needs.energy=Math.max(0,person.needs.energy-20);
  changeBond(g,b,p,{trust:7,dependence:5});changeBond(g,p,b,{trust:4});
 }
 if(q.type==='confront'){
  changeBond(g,p,b,{resentment:-8,trust:-3});changeBond(g,b,p,{resentment:6,trust:-3});other.needs.comfort=Math.max(0,other.needs.comfort-8);
 }
 if(q.type==='reconcile'){changeBond(g,b,p,{resentment:-18,trust:5});changeBond(g,p,b,{resentment:-8,trust:3});}
}

export function livingBonus(g,p,c,people){
 const person=p.position,s=livingResident(g,person),o=g.objects.find(o=>o.id===c.targetId),other=people.find(a=>a.id===c.targetId);
 if(livingError(g,c.type,person,o,other?.position))return null;
 if(c.type==='tendTree')return livingSite(g,o).vitality>80?null:18+(100-livingSite(g,o).vitality)*.7+(person.preferences.garden??0);
 if(c.type==='listenForest')return s.fear<25?null:s.fear*.7;
 if(c.type==='shareLight')return livingResident(g,other.position).fear<20||p.needs.energy<35?null:30+bondWeight(g,person,other.position);
 if(c.type==='accompany')return !inForest(person)||s.fear>=40||livingResident(g,other.position).fear<20||bondWeight(g,person,other.position)<-5?null:20+livingResident(g,other.position).fear*.5+bondWeight(g,person,other.position);
 if(c.type==='confront')return person.preferences.chat>=20?20:8;
 if(c.type==='reconcile')return (bondTo(g,person,other.position)?.trust??0)>=10?22:6;
 if(['chat','joke','gift','flirt'].includes(c.type)&&other)return bondWeight(g,person,other.position);
 if(c.type==='lounge'&&o){const keeper=livingSite(g,o).keeper;return keeper&&keeper!==person.uid?-4:0;}
 if(c.type==='voyage'||c.type==='starVoyage')return Math.max(0,...people.filter(a=>islandOf(a.position)===c.destinationId).map(a=>bondWeight(g,person,a.position)));
 return 0;
}

// One integer pulse per ten game minutes. No event history or per-frame data is saved.
export function advanceLiving(g,people){
 const pulse=Math.floor(livingMinutes(g)/LIVING_LIMITS.pulseMinutes),steps=pulse-g.living.pulse,days=Math.floor(pulse/144)-Math.floor(g.living.pulse/144);
 if(steps<=0)return;g.living.pulse=pulse;pruneLiving(g);
 const n=Math.min(steps,144),local=people.filter(a=>supportedIsland(a.position));
 const groups=new Map();for(const a of local){const key=`${islandOf(a.position)}:${sideOf(a.position)}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(a);}
 for(const o of g.objects)if(o.type==='spiritTree'&&g.living.sites[o.id]){const site=g.living.sites[o.id],guardian=local.some(a=>livingResident(g,a.position).imprint==='roots'&&nearby(a.position,o,5));site.vitality=bounded(site.vitality+n*(guardian?2:1));}
 for(const a of local){
  const p=a.position,neighbors=(groups.get(`${islandOf(p)}:${sideOf(p)}`)??[]).filter(b=>b!==a&&nearby(p,b.position,3));
  if(isDual(p)&&!a.queue[0]?.blinkTransit){const s=mutableResident(g,p);s.mode=a.queue[0]?.type==='shareLight'||neighbors.some(b=>livingResident(g,b.position).fear>=25)?'light':'shadow';}
 }
 for(const a of people){
  const p=a.position,forest=inForest(p),existing=g.living.residents[p.uid];if(!forest&&!existing)continue;
  const s=mutableResident(g,p),neighbors=(groups.get(`${islandOf(p)}:${sideOf(p)}`)??[]).filter(b=>b!==a&&nearby(p,b.position,3));
  if(days>0)fadeAdaptation(g,p,days);
  if(forest&&p.age>=g.config.lifeStages.infantEnd){
   const helper=neighbors.filter(b=>lightActive(g,b.position)||livingResident(g,b.position).imprint==='shade'||livingResident(g,b.position).shadow>=40||bondWeight(g,p,b.position)>=8).sort((b,c)=>bondWeight(g,p,c.position)-bondWeight(g,p,b.position))[0];
   if(practiceToday(g,p,'shadow'))adapt(g,p,'shadow');s.fear=bounded(s.fear+(helper?-6:s.shadow>=50||s.imprint==='shade'?-2:5)*n);
   if(helper&&s.fear<70){changeBond(g,p,helper.position,{trust:n,dependence:n});
    const bond=bondTo(g,helper.position,p);if((bondTo(g,p,helper.position)?.dependence??0)>35&&(helper.position.preferences.chat??0)<12)changeBond(g,helper.position,p,{resentment:n});
    else if(!bond)changeBond(g,helper.position,p,{trust:1});
   }
  }else s.fear=bounded(s.fear-8*n);
  if(s.garden>0){
   const gardens=g.objects.filter(o=>o.plant&&islandOf(o)==='spore'&&sideOf(o)==='front'&&nearby(p,o,4)&&o.plant.health>0);
   s.charge=bounded(s.charge+(gardens.length?4:s.imprint==='bloom'?-1:-2)*n);
   if(s.garden>=24&&s.charge>0)for(const o of gardens)o.plant.health=Math.min(100,o.plant.health+Math.min(s.imprint==='bloom'?5:3,n));
  }
  if(forest&&!neighbors.length&&s.fear>=40)a.needs.comfort=Math.max(0,a.needs.comfort-Math.min(n,4));
 }
 // Disputes are tied to actual use of a tended garden, not random negative rolls.
 for(const o of g.objects){
  const site=g.living.sites[o.id];if(!o.plant||!site?.keeper)continue;
  const keeper=local.find(a=>a.position.uid===site.keeper);if(!keeper||!nearby(keeper.position,o,5)||(keeper.position.preferences.chat??0)>=20)continue;
  for(const guest of local)if(guest!==keeper&&nearby(guest.position,o,4)&&['dance','lounge'].includes(guest.queue[0]?.type)&&guest.queue[0]?.phase==='acting')changeBond(g,keeper.position,guest.position,{resentment:2*n});
 }
}
