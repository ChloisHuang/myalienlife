import {islandOf} from './island.js';

export const LIVING_LIMITS=Object.freeze({bonds:6,pulseMinutes:10,adaptationBudget:100,practiceDays:7});
const emptyPractice=()=>({garden:{day:0,days:0},shadow:{day:0,days:0},tree:{day:0,days:0}});
const frozenPractice=Object.freeze(Object.fromEntries(Object.entries(emptyPractice()).map(([k,v])=>[k,Object.freeze(v)])));
export const EMPTY_RESIDENT=Object.freeze({garden:0,shadow:0,charge:0,fear:0,mode:'light',bonds:Object.freeze([]),practice:frozenPractice,imprint:null});
export const EMPTY_SITE=Object.freeze({vitality:100,keeper:null,rescue:null});
export const livingMinutes=g=>(g.day-1)*1440+g.minute;
export const createLiving=g=>({version:2,pulse:Math.floor(livingMinutes(g)/LIVING_LIMITS.pulseMinutes),residents:{},sites:{}});
export const livingResident=(g,p)=>g.living.residents[p.uid]??EMPTY_RESIDENT;
export const livingSite=(g,o)=>g.living.sites[o.id]??EMPTY_SITE;
export const mutableResident=(g,p)=>g.living.residents[p.uid]??=( {...EMPTY_RESIDENT,bonds:[],practice:emptyPractice()} );
export const mutableSite=(g,o)=>g.living.sites[o.id]??={...EMPTY_SITE};
export const supportedIsland=p=>['home','spore'].includes(islandOf(p));
export const livingSiteObject=o=>supportedIsland(o)&&(o.type==='spiritTree'||islandOf(o)==='spore'&&!!o.plant);
export const livingPeople=g=>[g.player,...Object.entries(g.npcs).filter(([id])=>id!==g.controlledId).map(([,p])=>p)].filter(p=>p.alive);
export const bondTo=(g,a,b)=>livingResident(g,a).bonds.find(r=>r.uid===b.uid);
export const bounded=n=>Math.max(0,Math.min(100,Math.round(n)));

export function changeBond(g,a,b,{trust=0,resentment=0,dependence=0}){
 if(a.uid===b.uid)return;
 const state=mutableResident(g,a);let bond=state.bonds.find(r=>r.uid===b.uid);
 if(!bond){
  if(state.bonds.length===LIVING_LIMITS.bonds){
   let weakest=0;const weight=r=>r.trust+r.resentment+r.dependence;
   for(let i=1;i<state.bonds.length;i++)if(weight(state.bonds[i])<weight(state.bonds[weakest]))weakest=i;
   state.bonds.splice(weakest,1);
  }
  bond={uid:b.uid,trust:0,resentment:0,dependence:0};state.bonds.push(bond);
 }
 bond.trust=bounded(bond.trust+trust);bond.resentment=bounded(bond.resentment+resentment);bond.dependence=bounded(bond.dependence+dependence);
}

export function pruneLiving(g){
 const uids=new Set(livingPeople(g).map(p=>p.uid)),sites=new Set(g.objects.filter(livingSiteObject).map(o=>o.id));
 for(const [uid,state]of Object.entries(g.living.residents)){
  if(!uids.has(uid)){delete g.living.residents[uid];continue;}
  state.bonds=state.bonds.filter(b=>uids.has(b.uid));
 }
 for(const [id,site]of Object.entries(g.living.sites)){
  if(!sites.has(id)){delete g.living.sites[id];continue;}
  if(site.keeper!==null&&!uids.has(site.keeper))site.keeper=null;
  if(site.rescue!==null&&!uids.has(site.rescue))site.rescue=null;
 }
}

const record=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
const keys=(o,expected)=>record(o)&&Object.keys(o).length===expected.length&&expected.every(k=>Object.hasOwn(o,k));
const value=n=>Number.isInteger(n)&&n>=0&&n<=100;
export function validLiving(g,version=2){
 const l=g.living;
 if(!keys(l,['version','pulse','residents','sites'])||l.version!==version||!Number.isSafeInteger(l.pulse)||l.pulse<0||l.pulse>Math.floor(livingMinutes(g)/10)||!record(l.residents)||!record(l.sites))return false;
 const uids=new Set(livingPeople(g).map(p=>p.uid)),sites=new Set(g.objects.filter(livingSiteObject).map(o=>o.id));
 if(Object.keys(l.residents).length>uids.size||Object.keys(l.sites).length>sites.size)return false;
 const practice=p=>keys(p,['garden','shadow','tree'])&&Object.values(p).every(v=>keys(v,['day','days'])&&Number.isSafeInteger(v.day)&&v.day>=0&&v.day<=g.day&&Number.isInteger(v.days)&&v.days>=0&&v.days<=7&&(v.day===0)===(v.days===0));
 return Object.entries(l.residents).every(([uid,s])=>uids.has(uid)&&keys(s,['garden','shadow','charge','fear','mode','bonds',...(version===2?['practice','imprint']:[])])&&['garden','shadow','charge','fear'].every(k=>value(s[k]))&&(version===1||s.garden+s.shadow<=100&&practice(s.practice)&&[null,'bloom','shade','roots'].includes(s.imprint))&&['light','shadow'].includes(s.mode)&&Array.isArray(s.bonds)&&s.bonds.length<=LIVING_LIMITS.bonds&&new Set(s.bonds.map(b=>b?.uid)).size===s.bonds.length&&s.bonds.every(b=>keys(b,['uid','trust','resentment','dependence'])&&b.uid!==uid&&uids.has(b.uid)&&['trust','resentment','dependence'].every(k=>value(b[k]))))&&Object.entries(l.sites).every(([id,s])=>sites.has(id)&&keys(s,['vitality','keeper',...(version===2?['rescue']:[])])&&value(s.vitality)&&(s.keeper===null||uids.has(s.keeper))&&(version===1||s.rescue===null||uids.has(s.rescue)));
}

export function migrateLiving(g){
 if(g.living?.version!==1)return;
 if(!validLiving(g,1))throw new Error('旧环境存档格式不兼容');
 for(const s of Object.values(g.living.residents)){
  s.practice=emptyPractice();s.imprint=null;
  if(s.garden+s.shadow>100){s.garden=Math.round(s.garden*100/(s.garden+s.shadow));s.shadow=100-s.garden;}
 }
 for(const s of Object.values(g.living.sites))s.rescue=null;
 g.living.version=2;
}
