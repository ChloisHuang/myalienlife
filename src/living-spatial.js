import {islandOf,sideOf,sameSide} from './island.js';
import {livingResident,bondTo,livingPeople} from './living-state.js';
import {isRadiant} from './prayer.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export const refuses=(g,p,other)=>{const bond=bondTo(g,p,other);return !!bond&&bond.resentment>=40&&bond.resentment>bond.trust;};
const sharedUse=new Set(['pray','tendTree','garden','harvest','replant']);
export function resourceTurn(g,person,q,people){
 if(!sharedUse.has(q.type))return true;
 const object=g.objects.find(o=>o.id===q.targetId);if(!object)return true;
 const contenders=people.filter(a=>a.queue[0]?.targetId===q.targetId&&sharedUse.has(a.queue[0].type)&&sameSide(a.position,object)&&distance(a.position,object)<=4);
 const priority=a=>['acting','celebrating'].includes(a.queue[0].phase)?1e12:(a.queue[0].type==='tendTree'&&(g.living.sites[object.id]?.vitality??100)<25?1e9:0)-a.queue[0].id;
 contenders.sort((a,b)=>priority(b)-priority(a));return !contenders.length||contenders[0].id===person.id;
}
export function spatialTarget(g,person,q,people,clear){
 const peer=people.find(a=>a.id===q.targetId),p=person.position;
 let center=null,radius=1.8;
 if(!resourceTurn(g,person,q,people)){center=g.objects.find(o=>o.id===q.targetId);radius=2.6;}
 if(q.type==='treeRest'){center=g.objects.find(o=>o.id===q.targetId);radius=2.3;}
 if(['seekLight','witnessPrayer'].includes(q.type)){center=peer?.position;radius=q.type==='seekLight'?1.7:2;}
 if(q.type==='accompany'){
  center=peer?.position;radius=1;
 }
 if(!center||!sameSide(p,center))return null;
 const peers=people.filter(a=>a.queue[0]?.targetId===q.targetId&&a.queue[0]?.type===q.type).sort((a,b)=>a.position.uid.localeCompare(b.position.uid));
 const offset=Math.max(0,peers.findIndex(a=>a.id===person.id));
 const angle=q.type==='accompany'?Math.atan2((peer.queue[0]?.target.z??center.z)-center.z,(peer.queue[0]?.target.x??center.x)-center.x)+Math.PI/2:offset*2.399;
 const points=Array.from({length:8},(_,i)=>({x:center.x+Math.cos(angle+i*Math.PI/4)*radius,z:center.z+Math.sin(angle+i*Math.PI/4)*radius,island:islandOf(center),side:sideOf(center)}));
 return points.find(point=>clear(point)&&!people.some(a=>a.id!==person.id&&sameSide(a.position,point)&&distance(a.position,point)<.6))??null;
}
export function spatialCandidates(g,person,people,clear){
 const p=person.position,s=livingResident(g,p),result=[];
 for(const other of people){
  if(other===person||other.id===person.id||!sameSide(p,other.position)||other.position.age<g.config.lifeStages.infantEnd)continue;
  const b=other.position,trust=bondTo(g,p,b)?.trust??0;
  if(isRadiant(b)&&s.fear>=25&&!refuses(g,p,b))result.push({type:'seekLight',targetId:other.id});
  if(other.queue[0]?.type==='pray'&&trust>=20&&!refuses(g,p,b))result.push({type:'witnessPrayer',targetId:other.id});
  if(other.queue[0]?.phase==='walking'&&trust>=20&&s.fear<35&&!refuses(g,p,b)&&other.queue[0].type!=='accompany')result.push({type:'accompany',targetId:other.id});
 }
 // Quiet keepers and unwilling recipients leave the actual occupied space.
 const intruder=people.find(a=>a.id!==person.id&&sameSide(p,a.position)&&distance(p,a.position)<3&&
  (isRadiant(a.position)&&s.fear>=25&&refuses(g,p,a.position)||
   ['dance','lounge'].includes(a.queue[0]?.type)&&(p.preferences.chat??0)<12&&g.objects.some(o=>o.plant&&g.living.sites[o.id]?.keeper===p.uid&&sameSide(o,p)&&distance(o,p)<4&&distance(o,a.position)<4)));
 if(intruder){
  const dx=p.x-intruder.position.x,dz=p.z-intruder.position.z,length=Math.hypot(dx,dz)||1;
  const point={x:p.x+(dx||1)/length*3,z:p.z+dz/length*3,island:islandOf(p),side:sideOf(p)};
  if(clear(point))result.push({type:'walk',targetId:null,point,spaceWithdrawal:true});
 }
 return result;
}
export function waitForCompany(g,person,people){
 if(Math.min(person.needs.hunger,person.needs.energy)<25)return false;
 const q=person.queue[0];
 if(q?.source==='manual'&&!['shareLight','pray'].includes(q.type))return false;
 return people.some(a=>a.id!==person.id&&a.queue[0]?.targetId===person.id&&['seekLight','accompany','witnessPrayer'].includes(a.queue[0].type)&&sameSide(a.position,person.position)&&
  (a.queue[0].type==='accompany'?(bondTo(g,person.position,a.position)?.trust??0)>=20&&distance(a.position,person.position)>2.2:a.queue[0].type==='seekLight'?!refuses(g,person.position,a.position):!refuses(g,person.position,a.position)&&distance(a.position,person.position)>2.5));
}
export function shadowCompanionOffset(g,p,time){
 if(Math.floor(time/8)%3!==0)return {x:0,z:0};
 const other=livingPeople(g).filter(o=>o.uid!==p.uid&&sameSide(o,p)&&distance(o,p)<3).sort((a,b)=>distance(a,p)-distance(b,p))[0];
 if(!other)return {x:0,z:0};
 const bond=bondTo(g,p,other);if(!bond||bond.trust<20&&bond.resentment<20)return {x:0,z:0};
 const d=Math.max(.1,distance(p,other)),weight=bond.resentment>=20?-.6:.35;
 return {x:(other.x-p.x)/d*weight,z:(other.z-p.z)/d*weight};
}
