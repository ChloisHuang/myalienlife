import {DEFAULT_PRAYER_CHANCES,PRAYER_RULES} from './prayer.js';
import {ENVIRONMENT_KEYS,DEFAULT_ENVIRONMENT_PREFERENCES} from './island-preferences.js';

export const HEAD_SHAPE={headWidth:'头部宽度',headHeight:'头部长度',headDepth:'前后厚度',jaw:'下颌收窄'};
export const defaultHeadShape=()=>Object.fromEntries(Object.keys(HEAD_SHAPE).map(key=>[key,1]));
export function residentHeadShape(uid){
 const values={kai:[.90,1.18,1.02,1.16],nova:[1.12,1.02,.96,1.20],zig:[.85,1.12,.90,1.04],lumi:[1.18,.86,1.12,.84],pip:[1.04,1.08,1.18,1.10]}[uid];
 return values?Object.fromEntries(Object.keys(HEAD_SHAPE).map((key,i)=>[key,values[i]])):defaultHeadShape();
}
export const defaultGenome=()=>({stature:1,build:1,head:1,antenna:1,...defaultHeadShape()});
export const DEFAULT_MUTATION_RATES={color:2.4,stature:2.4,build:2.4,head:2.4,antenna:2.4};
export const MUTATION_PARTS={color:'肤色',stature:'身高',build:'体型',head:'头部比例',antenna:'触角'};
export const RACIAL_ATTRIBUTES=['radiance','nether'];
const NAME_FIRST=[['艾','research','observe'],['阿','chat','dance'],['伊','observe','chat'],['欧','research','dance'],['洛','research','garden'],['维','research','observe'],['泽','garden','research'],['希','observe','chat'],['赛','research','dance'],['塔','research','garden'],['奈','chat','garden'],['科','research'],['弥','chat','dance'],['珂','garden','observe'],['芙','garden','chat'],['索','research','observe'],['乌','garden','observe'],['莱','research','garden'],['卡','dance','research'],['提','observe','dance'],['苏','garden','chat'],['尤','chat','observe'],['帕','dance','research'],['赫','research','observe']].map(([char,...styles])=>({char,styles}));
const NAME_SECOND=[['恩','research','observe'],['瓦','garden','observe'],['米','dance','chat'],['克','research'],['尔','research','observe'],['拉','garden','chat'],['弥','chat','dance'],['希','observe','chat'],['娅','chat','garden'],['斯','research','observe'],['特','research'],['昂','observe','research'],['珀','research','garden'],['诺','chat','observe'],['萨','garden','dance'],['因','research','observe'],['卡','dance','research'],['罗','chat','garden'],['泽','garden','research'],['亚','chat','observe'],['塔','research','garden'],['尤','chat','dance'],['安','chat'],['埃','observe','research']].map(([char,...styles])=>({char,styles}));
const nameHash=value=>{let hash=2166136261;for(const char of String(value)){hash^=char.codePointAt(0);hash=Math.imul(hash,16777619);}return hash>>>0;};
const namePartScore=(part,preferences)=>part.styles.reduce((score,key)=>score+(preferences?.[key]||0),0);
export function generateResidentName({uid,preferences={}},usedNames=[]){
 const used=new Set(usedNames),candidates=[];
 for(const first of NAME_FIRST)for(const second of NAME_SECOND){if(first.char===second.char)continue;const name=first.char+second.char;if(used.has(name))continue;candidates.push({name,score:namePartScore(first,preferences)+namePartScore(second,preferences),tie:nameHash(`${uid}:${name}`)});}
 candidates.sort((a,b)=>b.score-a.score||b.tie-a.tie);if(!candidates[0])throw new Error('外星名字库已用尽');return candidates[0].name;
}
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const randomExtended=(values,random,min,max,base)=>{
 const low=Math.min(...values),high=Math.max(...values),spread=high-low||base,extension=spread*.2;
 return clamp(low-extension+random()*(high-low+extension*2),min,max);
};
const normal=(random)=>{
 const u1=clamp(random(),Number.EPSILON,1-Number.EPSILON),u2=clamp(random(),Number.EPSILON,1-Number.EPSILON);
 return Math.sqrt(-2*Math.log(u1))*Math.cos(Math.PI*2*u2);
};
function inheritRacialTraits(parents,random,config=DEFAULT_PRAYER_CHANCES){
 const inheritanceRate=(config.racialInheritanceRate??DEFAULT_PRAYER_CHANCES.racialInheritanceRate)/100;
 const standardDeviation=(config.racialInheritanceStdDev??DEFAULT_PRAYER_CHANCES.racialInheritanceStdDev)/100;
 const mutationChance=(config.racialMutationInheritanceChance??DEFAULT_PRAYER_CHANCES.racialMutationInheritanceChance)/100;
 const attributes=Object.fromEntries(RACIAL_ATTRIBUTES.map(key=>{
  const values=parents.map(parent=>Math.max(0,parent.prayer?.[key]??0)),mean=values.reduce((sum,value)=>sum+value,0)/values.length,baseline=mean*inheritanceRate;
  if(!baseline)return[key,0];
  const spread=baseline*standardDeviation;
  return[key,Math.round(clamp(baseline+normal(random)*spread,0,PRAYER_RULES[`${key}Threshold`]))];
 }));
 const mutations=[...new Set(parents.flatMap(parent=>parent.prayer?.mutations||[]))].filter(()=>random()<mutationChance);
 return{...attributes,mutations};
}
export function inheritTraits(parents,random=Math.random,rates=DEFAULT_MUTATION_RATES,prayerConfig=DEFAULT_PRAYER_CHANCES){
 const genome=Object.fromEntries(Object.keys(defaultGenome()).map(key=>[key,randomExtended(parents.map(p=>p.genome[key]),random,.8,1.2,1)]));
 const channels=[1,3,5].map(offset=>Math.round(randomExtended(parents.map(p=>parseInt(p.color.slice(offset,offset+2),16)),random,0,255,255)));
 const preferences=Object.fromEntries([...new Set(parents.flatMap(p=>Object.keys(p.preferences)))].map(key=>[key,randomExtended(parents.map(p=>p.preferences[key]||0),random,0,100,100)]));
 const environmentPreferences=Object.fromEntries(ENVIRONMENT_KEYS.map(key=>[key,randomExtended(parents.map(p=>p.environmentPreferences?.[key]??DEFAULT_ENVIRONMENT_PREFERENCES[key]),random,0,100,100)]));
 const familyDesire=randomExtended(parents.map(p=>p.familyDesire),random,0,1,1),prayer=inheritRacialTraits(parents,random,prayerConfig),mutations=[];
 // Each configured body-part rate contributes to one bounded mutation roll.
 const parts=Object.keys(DEFAULT_MUTATION_RATES),total=Math.min(100,parts.reduce((sum,key)=>sum+(rates[key]??DEFAULT_MUTATION_RATES[key]),0));
 if(total>0&&random()<total/100){
  const pick=random()*total;let cursor=0;const part=parts.find(key=>(cursor+=rates[key]??DEFAULT_MUTATION_RATES[key])>pick)||parts.at(-1),delta=(random()<.5?-1:1)*.12;
  if(part==='color'){const shift=Math.round(delta*500),channel=Math.min(2,Math.floor(random()*3));channels[channel]=clamp(channels[channel]+shift,0,255);mutations.push('肤色变异');}
  else{genome[part]+=genome[part]+delta>1.2||genome[part]+delta<.8?-delta:delta;mutations.push(`${MUTATION_PARTS[part]}变异`);}
 }
 const color='#'+channels.map(n=>n.toString(16).padStart(2,'0')).join('');
 const favorite=Object.entries(preferences).sort((a,b)=>b[1]-a[1])[0]?.[0];
 const trait={research:'好奇心旺盛',observe:'爱观星',garden:'热爱自然',chat:'喜欢陪伴',dance:'热爱音乐'}[favorite]||'随和';
 return{genome,color,preferences,environmentPreferences,familyDesire,prayer,mutations,trait:`${trait} · ${mutations.length?'独特星芽':'家族传承'}`};
}
